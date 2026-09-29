import postgres from 'npm:postgres@3.4.7';
import {makeTransactionalService} from '../_shared/transaction-service.mjs';
import {publicBootstrap} from '../_shared/rc-service.mjs';

const projectRef='mrrvuknoxkpowlqcwahk';
const databaseRegion='ap-northeast-2';
const pooledConnection=(value:string|null)=>{
 if(!value)return null;
 try{
  const url=new URL(value),direct=url.hostname===`db.${projectRef}.supabase.co`,shared=url.hostname.endsWith('.pooler.supabase.com');
  if(direct){url.hostname=`aws-0-${databaseRegion}.pooler.supabase.com`;url.username=`postgres.${projectRef}`;url.port='6543';}
  else if(shared)url.port='6543';
  return url.href;
 }catch{return value;}
};
// Edge/serverless traffic must use Supavisor transaction mode. A direct or
// session-pooled connection lets every isolate reserve a database connection.
const connectionString=pooledConnection(Deno.env.get('HISTORY_RC_DB_POOL_URL')||Deno.env.get('SUPABASE_DB_URL'));
const pepper=Deno.env.get('HISTORY_RC_LEGACY_PEPPER');
const keyString=Deno.env.get('HISTORY_RC_BACKUP_KEY');
const backupKey=keyString?Uint8Array.from(atob(keyString),c=>c.charCodeAt(0)):null;
// The pooled endpoint protects PostgreSQL. Four bounded lanes prevent unrelated
// students in one warm Edge isolate from blocking each other during class bursts.
const sql=connectionString?postgres(connectionString,{prepare:false,max:4,idle_timeout:20,connect_timeout:8,max_lifetime:180}):null;
const SHARED_TTL_MS=4000;
let sharedCache:{at:number,tables:Record<string,unknown[]>}|null=null;
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
  const sharedTables=async()=>{
   if(sharedCache&&Date.now()-sharedCache.at<SHARED_TTL_MS)return sharedCache.tables;
   const r=await timed('shared',()=>tx`select history_v5.load_shared_v46() as tables`);
   sharedCache={at:Date.now(),tables:r[0].tables};return sharedCache.tables;
  };
  const fail=(code:string)=>{throw Object.assign(Error(code),{code})};
  const adapter={
   legacySchool:async()=>timed('identity',async()=>{const r=await tx`select data->'value'->>'legacySchoolId' as id from history_v5.gas_system where id='authority3'`;return r[0]?.id||'';}),
   session:async(hash:string)=>timed('session',async()=>{const r=await tx`select data from history_v5.gas_sessions where data->>'tokenHash'=${hash}`;return r[0]?.data;}),
   lock:async(actor:string,exclusive:boolean)=>timed('lock',async()=>{await tx`select history_v5.lock_actor_v45(${actor},${exclusive})`;if(exclusive)sharedCache=null;}),
   load:async(actor:string,session:string,request:string,action:string,staff:boolean,limits:string[],payload:any)=>timed('load',async()=>{const login=action==='student.login'||action==='teacher.login',skipShared=!staff&&!login;const r=await tx`select history_v5.load_scope_v46(${actor},${session},${request||''},${action},${staff},${limits.join(',')},${String(payload?.mode||'speedrun').slice(0,40)},${skipShared}) as tables`;const tables=r[0].tables;if(skipShared){const shared=await sharedTables();for(const [key,value] of Object.entries(shared))tables[key]=value;}return tables;}),
   fastAction:async(action:string,actor:string,p:any)=>timed('fast',async()=>{
    if(action==='cards.openings.ack'){
     if(typeof p.openingId!=='string'||p.openingId.length>100||!Number.isInteger(p.revealed)||p.revealed<0||typeof p.seen!=='boolean')fail('INVALID_INPUT');
     const rows=await tx`select data from history_v5.gas_packopenings28 where id=${p.openingId} and owner_id=${actor}`;const row=rows[0]?.data;
     if(!row||row.deletedAt)fail('NOT_FOUND');if(p.revealed>row.count||p.seen&&p.revealed!==row.count)fail('INVALID_INPUT');
     row.revealed=Math.max(Number(row.revealed)||0,p.revealed);if(p.seen)row.seenAt=row.seenAt||new Date().toISOString();row.updatedAt=new Date().toISOString();
     await tx`update history_v5.gas_packopenings28 set data=${tx.json(row)} where id=${p.openingId} and owner_id=${actor}`;
     return{opening:{id:row.id,packId:row.packId,count:row.count,revealed:row.revealed,seenAt:row.seenAt,source:row.source||'pack',createdAt:row.createdAt}};
    }
    if(action==='attempt.abandon'){
     if(typeof p.attemptId!=='string'||p.attemptId.length>100||!Number.isInteger(p.revision)||p.revision<0)fail('INVALID_INPUT');
     const rows=await tx`select data from history_v5.gas_attempts where id=${p.attemptId} and owner_id=${actor}`;const attempt=rows[0]?.data;
     if(!attempt||attempt.deletedAt)fail('NOT_FOUND');const state=attempt.state||{};
     if(attempt.status==='abandoned'&&Number(state.revision)===p.revision+1)return{attemptId:attempt.id,mode:attempt.mode,status:'abandoned',state:{revision:state.revision}};
     if(!['active','paused'].includes(attempt.status)||Date.parse(attempt.expiresAt)<=Date.now())fail('ATTEMPT_CLOSED');if(Number(state.revision)!==p.revision)fail('STALE_STATE');
     const rules=await tx`select data from history_v5.gas_completionrules where id=${String(attempt.schoolYear)+':'+String(attempt.unitId)}`;if(rules[0]?.data?.settings?.resume?.[attempt.mode]==='resume')fail('RESUME_POLICY');
     const now=Date.now(),base=Math.max(0,Number(state.accruedMs)||0),running=attempt.status==='paused'?0:Math.max(0,now-Number(state.runningSince||state.playAt||Date.parse(attempt.startedAt)||now));
     state.accruedMs=base+running;state.abandonedAt=new Date(now).toISOString();state.abandonedReason='student_restart';state.revision=p.revision+1;state.rewardResult={granted:false,reason:'abandoned',message:'포기한 시도에는 기록과 보상이 지급되지 않습니다',cards:[],packs:[]};attempt.state=state;attempt.status='abandoned';
     await tx`update history_v5.gas_attempts set data=${tx.json(attempt)} where id=${p.attemptId} and owner_id=${actor}`;
     if(['beginner','intermediate','advanced','challenge'].includes(attempt.mode)&&!state.practice){const progressState=structuredClone(state);progressState.status='not_started';progressState.run=attempt.id;progressState.elapsed=Math.floor(state.accruedMs/1000);progressState.answer='';const progress={id:actor+':'+attempt.unitId+':'+attempt.mode,schoolYear:attempt.schoolYear,studentId:actor,unitId:attempt.unitId,mode:attempt.mode,state:progressState,completedAt:'',updatedAt:new Date(now).toISOString(),deletedAt:'',deletionId:''};await tx`insert into history_v5.gas_progress(id,data) values(${progress.id},${tx.json(progress)}) on conflict(id) do update set data=excluded.data`;}
     const rewardKey=attempt.mode==='matching'?`${attempt.mode}.${state.variant}.${state.setCount}`:attempt.mode==='baitrun'?`${attempt.mode}.${state.decoyCount}`:['connections','revolutionmap'].includes(attempt.mode)?`${attempt.mode}.${state.variant}`:attempt.mode;
     const event={id:`v46:${attempt.id}:abandoned:${state.revision}`,schoolYear:attempt.schoolYear,studentId:actor,unitId:attempt.unitId,attemptId:attempt.id,mode:attempt.mode,rewardKey,kind:'abandoned',data:{practice:!!state.practice,teacherPractice:false,resumedPractice:!!state.resumedPractice,reason:'student_restart',revision:state.revision},createdAt:new Date(now).toISOString(),deletedAt:'',deletionId:''};
     await tx`insert into history_v5.gas_attemptevents27(id,data) values(${event.id},${tx.json(event)}) on conflict(id) do nothing`;
     return{attemptId:attempt.id,mode:attempt.mode,status:'abandoned',state:{revision:state.revision}};
    }
    return undefined;
   }),
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
 const headers:Record<string,string>={'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store','Vary':'Origin, Accept-Encoding','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'content-type,authorization,apikey,x-client-info','Access-Control-Expose-Headers':'server-timing'};
 if(origin&&allowed.has(origin))headers['Access-Control-Allow-Origin']=origin;
 const reply=(body:any,status=200,action='')=>{const timings=body&&typeof body==='object'?resultTimings.get(body)||{}:{};const serializeStarted=performance.now(),json=JSON.stringify(body);timings.serialize=performance.now()-serializeStarted;const app=performance.now()-start;headers['Server-Timing']=[`app;dur=${app.toFixed(1)}`,...Object.entries(timings).map(([key,value])=>`${key};dur=${value.toFixed(1)}`)].join(', ');if(action&&app>=1500)console.info(JSON.stringify({event:'normal-rc-slow',action,appMs:Math.round(app),phases:Object.fromEntries(Object.entries(timings).map(([key,value])=>[key,Math.round(value)])),responseBytes:new TextEncoder().encode(json).length}));if(json.length>1024&&/\bgzip\b/.test(req.headers.get('accept-encoding')||'')){headers['Content-Encoding']='gzip';return new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip')),{status,headers});}return new Response(json,{status,headers});};
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
