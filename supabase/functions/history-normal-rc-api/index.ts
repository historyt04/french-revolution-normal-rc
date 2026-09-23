import postgres from 'npm:postgres@3.4.7';
import {makeTransactionalService} from '../_shared/transaction-service.mjs';
import {publicBootstrap} from '../_shared/rc-service.mjs';

const connectionString=Deno.env.get('SUPABASE_DB_URL');
const pepper=Deno.env.get('HISTORY_RC_LEGACY_PEPPER');
const keyString=Deno.env.get('HISTORY_RC_BACKUP_KEY');
const backupKey=keyString?Uint8Array.from(atob(keyString),c=>c.charCodeAt(0)):null;
const sql=connectionString?postgres(connectionString,{prepare:false,max:5,idle_timeout:10,connect_timeout:10,max_lifetime:300}):null;
const database={transaction:async(fn:any)=>{
 if(!sql)throw Object.assign(Error(),{code:'SERVER_CONFIGURATION_REQUIRED'});
 return sql.begin(async tx=>{
  try { await tx`set local role history_v5_worker`; } catch { throw Object.assign(Error(),{code:'WORKER_ROLE_DENIED'}); }
  await tx`set local statement_timeout='8s'`;
  await tx`set local lock_timeout='5s'`;
  await tx`set local idle_in_transaction_session_timeout='10s'`;
  const adapter={
   legacySchool:async()=>{const r=await tx`select data->'value'->>'legacySchoolId' as id from history_v5.gas_system where id='authority3'`;return r[0]?.id||'';},
   session:async(hash:string)=>{const r=await tx`select data from history_v5.gas_sessions where data->>'tokenHash'=${hash}`;return r[0]?.data;},
   lock:async(actor:string,staff:boolean)=>{if(staff)await tx`select pg_advisory_xact_lock(73432023,0)`;else await tx`select pg_advisory_xact_lock_shared(73432023,0)`;await tx`select pg_advisory_xact_lock(hashtextextended(${actor},73432023))`;},
   load:async(actor:string,session:string,request:string,action:string,staff:boolean,limits:string[],payload:any)=>{await tx`select set_config('history_v5.limit_ids',${limits.join(',')},true),set_config('history_v5.rank_mode',${String(payload?.mode||'speedrun').slice(0,40)},true)`;const r=await tx`select history_v5.load_scope(${actor},${session},${request||''},${action},${staff}) as tables`;return r[0].tables;},
   loginReceipt:async(actor:string,request:string)=>{const r=await tx`select body_hash,envelope from history_v5.login_receipts where actor=${actor} and request_id=${request}`;return r[0];},
   saveLoginReceipt:async(actor:string,request:string,hash:string,envelope:any)=>{await tx`insert into history_v5.login_receipts(actor,request_id,body_hash,envelope) values(${actor},${request},${hash},${tx.json(envelope)})`;},
   readBackup:async(id:string)=>{const r=await tx`select envelope from history_v5.backup_objects where id=${id}`;return r[0]?.envelope;},
   write:async(changes:any[],backups:any[],copies:any[])=>{if(changes.length)await tx`select history_v5.write_rows(${tx.json(changes)})`;for(const b of backups)await tx`insert into history_v5.backup_objects(id,envelope) values(${b.id},${tx.json(b.envelope)})`;for(const c of copies)await tx`insert into history_v5.restore_copies(id,tables) values(${c.namespace},${tx.json(c.tables)})`;}
  };
  return fn(adapter);
 });
}};
const service=pepper&&backupKey?.length===32?makeTransactionalService({database,pepper,backupKey}):null;
Deno.serve(async req=>{
 const start=performance.now(),origin=req.headers.get('origin');
 const allowed=new Set((Deno.env.get('HISTORY_RC_ALLOWED_ORIGINS')||'').split(',').map(x=>x.trim()).filter(Boolean));
 const headers:Record<string,string>={'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'content-type,authorization,apikey,x-client-info','Access-Control-Expose-Headers':'server-timing'};
 if(origin&&allowed.has(origin))headers['Access-Control-Allow-Origin']=origin;
 const reply=(body:any,status=200)=>{headers['Server-Timing']=`app;dur=${(performance.now()-start).toFixed(1)}`;return new Response(JSON.stringify(body),{status,headers});};
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
  return reply(result,result.ok?200:result.code==='BUSY'?503:result.code==='RATE_LIMIT'?429:400);
 }catch{return reply({ok:false,code:'INVALID_REQUEST'},400);}
});
