// v4.3 deployment source. Uses the verified GAS v6 domain and RPC-backed RC store.
import {makeBatchService, makeRpcStore, publicBootstrap} from '../_shared/rc-service.mjs';

let serviceCache:{key:string,service:(body:unknown)=>Promise<unknown>,warm:Promise<unknown>|null}|null=null;

function configuredService(url:string,key:string,namespace:string,pepper:string,backupKey:Uint8Array) {
  const cacheKey=url+'\0'+namespace;
  if(!serviceCache||serviceCache.key!==cacheKey)serviceCache={key:cacheKey,service:makeBatchService({
    store:makeRpcStore({url,key}),namespace,pepper,backupKey,batchWindowMs:20,maxBatchSize:64,cacheMs:2000
  }),warm:null};
  return serviceCache.service;
}

function warmService(service:(body:unknown)=>Promise<unknown>) {
  if(!serviceCache)return;
  if(!serviceCache.warm)serviceCache.warm=service({action:'public.bootstrap'});
  const task=serviceCache.warm.catch(()=>undefined);
  const runtime=(globalThis as unknown as {EdgeRuntime?:{waitUntil:(task:Promise<unknown>)=>void}}).EdgeRuntime;
  if(runtime)runtime.waitUntil(task);else void task;
}

function publicConfig() {
  const fallback={schoolYear:2026,schools:[{id:'school-01',name:'학습 공간 5X5oY5'}],copyright:{creatorName:'김기훈',notice:'© 2026 김기훈 · 허가 없는 복제·재배포 금지',visible:true,opacity:0.06,licenseId:'FR42-PUBLIC-397DR0CFJA'}};
  const encoded=Deno.env.get('HISTORY_RC_PUBLIC_BOOTSTRAP');
  if(!encoded)return fallback;
  try {
    const value=JSON.parse(encoded);
    if(Number.isInteger(value.schoolYear)&&Array.isArray(value.schools)&&value.schools.length&&value.schools.every((x:unknown)=>x&&typeof x==='object'&&typeof (x as {id?:unknown}).id==='string'&&typeof (x as {name?:unknown}).name==='string')&&value.copyright&&typeof value.copyright==='object')return value;
  } catch {}
  return fallback;
}

Deno.serve(async (req: Request) => {
  const allowed=new Set((Deno.env.get('HISTORY_RC_ALLOWED_ORIGINS')||'').split(',').map(x=>x.trim()).filter(Boolean));
  const origin=req.headers.get('Origin');
  const headers:Record<string,string>={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin',
    'Access-Control-Allow-Headers':'content-type,authorization,apikey,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
  if(origin && allowed.has(origin))headers['Access-Control-Allow-Origin']=origin;
  const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{headers,status});
  if(!origin || !allowed.has(origin)) return reply({ok:false,code:'ORIGIN_DENIED'},403);
  if(req.method==='OPTIONS')return new Response(null,{headers,status:204});
  if(req.method!=='POST')return reply({ok:false,code:'METHOD_NOT_ALLOWED'},405);
  if(Deno.env.get('HISTORY_RC_ENABLED')!=='YES')return reply({ok:false,code:'RC_NOT_ENABLED'},503);
  try {
    const reader=req.body?.getReader();if(!reader)return reply({ok:false,code:'INVALID_REQUEST'},400);
    let size=0;const chunks:Uint8Array[]=[];
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>262144){await reader.cancel();return reply({ok:false,code:'BODY_TOO_LARGE'},413);}chunks.push(value);}
    const bytes=new Uint8Array(size);let pos=0;for(const chunk of chunks){bytes.set(chunk,pos);pos+=chunk.length;}
    let body;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{return reply({ok:false,code:'INVALID_JSON'},400);}
    const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const pepper=Deno.env.get('HISTORY_RC_LEGACY_PEPPER'),encodedBackupKey=Deno.env.get('HISTORY_RC_BACKUP_KEY');
    const namespace=Deno.env.get('HISTORY_RC_NAMESPACE');
    if(!url||!key||!pepper||!encodedBackupKey||!namespace)return reply({ok:false,code:'SERVER_CONFIGURATION_REQUIRED'},503);
    // Secrets are runtime inputs only. Never log requests, responses, or environment values.
    const backupKey=Uint8Array.from(atob(encodedBackupKey),c=>c.charCodeAt(0));
    if(backupKey.length!==32)return reply({ok:false,code:'SERVER_CONFIGURATION_REQUIRED'},503);
    const service=configuredService(url,key,namespace,pepper,backupKey);
    if(body?.action==='public.bootstrap'){
      warmService(service);
      return reply(publicBootstrap({pepper,...publicConfig()}));
    }
    const result=await service(body);
    return reply(result,result.ok?200:result.code==='BUSY'?503:result.code==='RATE_LIMIT'?429:400);
  }catch{return reply({ok:false,code:'SERVER_ERROR'},503);}
});
