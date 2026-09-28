import postgres from 'npm:postgres@3.4.7';
import {makeTransactionalService} from '../_shared/transaction-service.mjs';
import {publicBootstrap} from '../_shared/rc-service.mjs';

const connectionString=Deno.env.get('SUPABASE_DB_URL');
const pepper=Deno.env.get('HISTORY_RC_LEGACY_PEPPER');
const keyString=Deno.env.get('HISTORY_RC_BACKUP_KEY');
const backupKey=keyString?Uint8Array.from(atob(keyString),c=>c.charCodeAt(0)):null;
const sql=connectionString?postgres(connectionString,{prepare:false,max:5,idle_timeout:10,connect_timeout:10,max_lifetime:300}):null;
type Timings=Record<string,number>;
const resultTimings=new WeakMap<object,Timings>();
const addTiming=(timings:Timings,key:string,started:number)=>{timings[key]=(timings[key]||0)+(performance.now()-started)};
const database={transaction:async(fn:any)=>{
 if(!sql)throw Object.assign(Error(),{code:'SERVER_CONFIGURATION_REQUIRED'});
 return sql.begin(async tx=>{
  const timings:Timings={},transactionStarted=performance.now();
  const timed=async<T>(key:string,task:()=>Promise<T>)=>{const started=performance.now();try{return await task()}finally{addTiming(timings,key,started)}};
  try { await timed('setup',()=>tx.unsafe("set local role history_v5_worker; set local statement_timeout='8s'; set local lock_timeout='5s'; set local idle_in_transaction_session_timeout='10s'")); }
  catch { throw Object.assign(Error(),{code:'WORKER_ROLE_DENIED'}); }
  const adapter={
   legacySchool:async()=>timed('identity',async()=>{const r=await tx`select data->'value'->>'legacySchoolId' as id from history_v5.gas_system where id='authority3'`;return r[0]?.id||'';}),
   session:async(hash:string)=>timed('session',async()=>{const r=await tx`select data from history_v5.gas_sessions where data->>'tokenHash'=${hash}`;return r[0]?.data;}),
   lock:async(actor:string,exclusive:boolean)=>timed('lock',async()=>{await tx`select history_v5.lock_actor_v45(${actor},${exclusive})`;}),
   load:async(actor:string,session:string,request:string,action:string,staff:boolean,limits:string[],payload:any)=>timed('load',async()=>{const r=await tx`select history_v5.load_scope_v45(${actor},${session},${request||''},${action},${staff},${limits.join(',')},${String(payload?.mode||'speedrun').slice(0,40)}) as tables`;return r[0].tables;}),
   loginReceipt:async(actor:string,request:string)=>timed('receipt',async()=>{const r=await tx`select body_hash,envelope from history_v5.login_receipts where actor=${actor} and request_id=${request}`;return r[0];}),
   saveLoginReceipt:async(actor:string,request:string,hash:string,envelope:any)=>timed('receipt',async()=>{await tx`insert into history_v5.login_receipts(actor,request_id,body_hash,envelope) values(${actor},${request},${hash},${tx.json(envelope)})`;}),
   readBackup:async(id:string)=>timed('backup',async()=>{const r=await tx`select envelope from history_v5.backup_objects where id=${id}`;return r[0]?.envelope;}),
   write:async(changes:any[],backups:any[],copies:any[])=>timed('write',async()=>{if(changes.length)await tx`select history_v5.write_rows(${tx.json(changes)})`;for(const b of backups)await tx`insert into history_v5.backup_objects(id,envelope) values(${b.id},${tx.json(b.envelope)})`;for(const c of copies)await tx`insert into history_v5.restore_copies(id,tables) values(${c.namespace},${tx.json(c.tables)})`;}),
   measure:async<T>(key:string,task:()=>Promise<T>|T)=>{const started=performance.now();try{return await task()}finally{addTiming(timings,key,started)}}
  };
  const out=await fn(adapter);timings.transaction=performance.now()-transactionStarted;
  if(out&&typeof out==='object')resultTimings.set(out,timings);
  return out;
 });
}};
const service=pepper&&backupKey?.length===32?makeTransactionalService({database,pepper,backupKey}):null;
Deno.serve(async req=>{
 const start=performance.now(),origin=req.headers.get('origin');
 const allowed=new Set((Deno.env.get('HISTORY_RC_ALLOWED_ORIGINS')||'').split(',').map(x=>x.trim()).filter(Boolean));
 const headers:Record<string,string>={'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'content-type,authorization,apikey,x-client-info','Access-Control-Expose-Headers':'server-timing'};
 if(origin&&allowed.has(origin))headers['Access-Control-Allow-Origin']=origin;
 const reply=(body:any,status=200,action='')=>{const timings=body&&typeof body==='object'?resultTimings.get(body)||{}:{};const serializeStarted=performance.now(),json=JSON.stringify(body);timings.serialize=performance.now()-serializeStarted;const app=performance.now()-start;headers['Server-Timing']=[`app;dur=${app.toFixed(1)}`,...Object.entries(timings).map(([key,value])=>`${key};dur=${value.toFixed(1)}`)].join(', ');if(action&&app>=1500)console.info(JSON.stringify({event:'normal-rc-slow',action,appMs:Math.round(app),phases:Object.fromEntries(Object.entries(timings).map(([key,value])=>[key,Math.round(value)])),responseBytes:new TextEncoder().encode(json).length}));return new Response(json,{status,headers});};
 if(!origin||!allowed.has(origin))return reply({ok:false,code:'ORIGIN_DENIED'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({ok:false,code:'METHOD_NOT_ALLOWED'},405);
 if(!service||!sql)return reply({ok:false,code:'SERVER_CONFIGURATION_REQUIRED'},503);
 try{
  const reader=req.body?.getReader();if(!reader)return reply({ok:false,code:'INVALID_REQUEST'},400);
  let size=0;const chunks:Uint8Array[]=[];
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>262144){await reader.cancel();return reply({ok:false,code:'BODY_TOO_LARGE'},413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  const body=JSON.parse(new TextDecoder().decode(bytes));
  if(body.action==='public.bootstrap'){
   const config=JSON.parse(Deno.env.get('HISTORY_RC_PUBLIC_BOOTSTRAP')||'{"schoolYear":2026,"schools":[{"id":"school-01","name":"동주중학교"}],"copyright":{}}');
   return reply(publicBootstrap({pepper,...config}));
  }
  const result=await service(body);
  return reply(result,result.ok?200:result.code==='BUSY'?503:result.code==='RATE_LIMIT'?429:400,String(body.action||''));
 }catch{return reply({ok:false,code:'INVALID_REQUEST'},400);}
});
