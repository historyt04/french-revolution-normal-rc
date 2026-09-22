import {createHmac, randomBytes, randomUUID} from 'node:crypto';
import {createService,rules} from './gas-v6-domain.mjs';
import {Repository, invariant, durableTables, validateTables, sealBackup, openBackup} from './rc-data.mjs';

export const gasHash = pepper => value => createHmac('sha256',pepper).update(String(value)).digest('base64url');
const random = () => randomBytes(4).readUInt32BE()/4294967296;
const failure = code => ({ok:false,code,message:code==='BUSY'?'같은 요청 번호로 잠시 후 다시 시도하세요.':'서버에서 요청을 확인하지 못했습니다.'});
const rewardActions=new Set(['cards.openPack','cards.synthesize','missions.claim','attendance.claim']);

export function validateRequest(req) {
  invariant(req && typeof req==='object' && !Array.isArray(req) && typeof req.action==='string' && req.action.length<=100,'INVALID_REQUEST');
  invariant(req.payload===undefined || (req.payload && typeof req.payload==='object' && !Array.isArray(req.payload)),'INVALID_REQUEST');
  function walk(x,depth=0) {
    invariant(depth<=30,'INVALID_REQUEST');
    if(x && typeof x==='object') for(const key of Object.keys(x)) {
      invariant(!['__proto__','constructor','prototype'].includes(key),'INVALID_REQUEST'); walk(x[key],depth+1);
    }
  }
  walk(req);
  invariant(JSON.stringify(req).length<=200000,'BODY_TOO_LARGE');
}

// Pure server execution. No network or irreversible side effect before CAS commit.
export function execute(snapshot,request,options) {
  validateRequest(request);
  const {pepper,backupKey,now=()=>Date.now(),token=()=>randomBytes(32).toString('base64url'),rng=random,backupEnvelope}=options;
  invariant(typeof pepper==='string' && pepper.length>=16,'SERVER_CONFIGURATION_REQUIRED');
  const repo=new Repository(snapshot.tables), backups=[], copies=[];
  const hash=gasHash(pepper);
  const backup=(action,p,c,tables)=>{
    invariant(backupKey instanceof Uint8Array && backupKey.length===32,'BACKUP_CONFIGURATION_REQUIRED');
    if(action==='teacher.backup.create') {
      const stamp=new Date(now()).toISOString(),id=token();
      const data={version:'4.2',backupScope:c.role==='teacher'?'scoped':'full',snapshotAt:stamp,tables:durableTables(tables)};
      backups.push({id,envelope:sealBackup(data,backupKey)});
      repo.put('backups',{id,schoolYear:c.year,actorId:c.user.id,fileId:'rc:'+id,snapshotAt:stamp,status:'ready',label:String(p.label||'수동 백업').slice(0,80),createdAt:stamp,deletedAt:'',deletionId:''});
      return {backupId:id,snapshotAt:stamp};
    }
    invariant(action==='teacher.backup.restoreCopy','UNKNOWN_ACTION');
    const b=repo.get('backups',String(p.backupId));
    invariant(b?.status==='ready' && b.fileId==='rc:'+b.id && backupEnvelope,'BACKUP_BLOB_REQUIRED');
    const data=openBackup(backupEnvelope,backupKey);
    invariant(data.version==='4.2','BACKUP_VERSION_MISMATCH');
    const restored=durableTables(data.tables);validateTables(restored);
    const namespace='restore-'+randomUUID(); copies.push({namespace,tables:restored});
    // As in GAS restoreCopy, the active dataset is never overwritten/switched.
    return {restoreNamespace:namespace,snapshotAt:b.snapshotAt,activeDataUnchanged:true,reviewRequired:true};
  };
  const service=createService({repo,now,token,hash,random:rng,backup},rules);
  try {
    if(rewardActions.has(request.action)) {
      const c=service.authenticate(request.token);
      invariant(!c.testOnly && !repo.all('attempts').some(a=>a.studentId===c.user.id && a.status==='active' && a.state?.practice),'PRACTICE_NO_REWARDS');
    }
    const result=service.dispatch(request);
    return {result,changes:repo.changes(),backups,copies};
  } catch(error) {
    return {result:error.code?{ok:false,code:error.code,message:error.message}:failure('SERVER_ERROR'),
      changes:error.code?repo.changes(['sessionRevocations3','limits','securityEvents']):[],backups:[],copies:[]};
  }
}

export function makeService({store,namespace,pepper,backupKey,now,token,rng,maxRetries=8}) {
  invariant(/^(rc-|restore-)[a-zA-Z0-9_-]{3,100}$/.test(namespace),'RC_NAMESPACE_REQUIRED');
  return async request=>{
    try {
      validateRequest(request);
      for(let retry=0;retry<maxRetries;retry++) {
        const snapshot=await store.load(namespace);
        const backupEnvelope=request.action==='teacher.backup.restoreCopy' ? await store.readBackup(namespace,String(request.payload?.backupId||'')) : undefined;
        const outcome=execute(snapshot,request,{pepper,backupKey,now,token,rng,backupEnvelope});
        if(!outcome.changes.length&&!outcome.backups.length&&!outcome.copies.length) return outcome.result;
        const committed=await store.commit(namespace,snapshot.revision,outcome.changes,outcome.backups,outcome.copies);
        if(committed.committed) return outcome.result;
        // Reload, reauthenticate and recheck receipts after every competing commit.
        // Never reuse a losing random draw or return an uncommitted reward.
        if(retry+1<maxRetries) await new Promise(resolve=>setTimeout(resolve,Math.min(10*(retry+1),80)));
      }
      return failure('BUSY');
    } catch(error) {return failure(error.code||'SERVER_ERROR');}
  };
}

// Coalesce requests that arrive together into one optimistic commit.  The
// original RC adapter loaded and committed the full namespace once per
// request, so a classroom burst made every student compete for one revision.
// Requests in a batch are still executed in a deterministic serial order, but
// their disjoint row changes are persisted by a single rc_commit call.
export function makeBatchService({store,namespace,pepper,backupKey,now=()=>Date.now(),token,rng,maxRetries=8,batchWindowMs=20,maxBatchSize=64,cacheMs=2000}) {
  invariant(/^(rc-|restore-)[a-zA-Z0-9_-]{3,100}$/.test(namespace),'RC_NAMESPACE_REQUIRED');
  const queue=[];
  let timer=null,flushing=false,cached=null,cachedAt=0,loadPromise=null;
  const clone=x=>structuredClone(x);
  const applyChanges=(snapshot,changes)=>{
    if(!changes.length)return snapshot;
    const repo=new Repository(snapshot.tables);
    for(const change of changes)repo.put(change.table,change.row);
    repo.commit();
    return {revision:snapshot.revision,tables:repo.snapshot()};
  };
  const refresh=()=>{
    if(loadPromise)return loadPromise;
    loadPromise=store.load(namespace).then(snapshot=>{
      if(!cached||Number(snapshot.revision)>=Number(cached.revision)){cached=snapshot;cachedAt=now();}
      return snapshot;
    }).finally(()=>{loadPromise=null;});
    return loadPromise;
  };
  const load=async force=>{
    if(cached&&!force){
      if(now()-cachedAt>=cacheMs)void refresh().catch(()=>undefined);
      return cached;
    }
    return refresh();
  };
  const run=async items=>{
    try {
      for(let retry=0;retry<maxRetries;retry++) {
        const base=await load(retry>0),results=[],changes=new Map(),backups=[],copies=[];
        let working=base;
        for(const item of items) {
          const request=item.request;
          const backupEnvelope=request.action==='teacher.backup.restoreCopy'
            ? await store.readBackup(namespace,String(request.payload?.backupId||'')) : undefined;
          const outcome=execute(working,request,{pepper,backupKey,now,token,rng,backupEnvelope});
          results.push(outcome.result);
          for(const change of outcome.changes)changes.set(change.table+'\0'+change.row.id,change);
          backups.push(...outcome.backups);copies.push(...outcome.copies);
          working=applyChanges(working,outcome.changes);
        }
        const merged=[...changes.values()];
        if(!merged.length&&!backups.length&&!copies.length)return results;
        const committed=await store.commit(namespace,base.revision,merged,backups,copies);
        if(committed.committed) {
          const revision=Number.isFinite(committed.revision)?committed.revision:Number(base.revision)+1;
          cached={revision,tables:working.tables};cachedAt=now();return results;
        }
        cached=null;cachedAt=0;
        if(retry+1<maxRetries)await new Promise(resolve=>setTimeout(resolve,Math.min(15*(retry+1),120)));
      }
      return items.map(()=>failure('BUSY'));
    } catch(error) {
      cached=null;cachedAt=0;
      return items.map(()=>failure(error.code||'SERVER_ERROR'));
    }
  };
  const flush=async()=>{
    if(flushing)return;flushing=true;
    try {
      while(queue.length) {
        const items=queue.splice(0,maxBatchSize),results=await run(items);
        items.forEach((item,index)=>item.resolve(results[index]));
      }
    } finally {flushing=false;if(queue.length)schedule();}
  };
  const schedule=()=>{
    if(timer||flushing)return;
    timer=setTimeout(()=>{timer=null;void flush();},batchWindowMs);
  };
  return request=>new Promise(resolve=>{
    try {validateRequest(request);}catch(error){resolve(failure(error.code||'INVALID_REQUEST'));return;}
    queue.push({request,resolve});
    if(queue.length>=maxBatchSize&&timer){clearTimeout(timer);timer=null;void flush();}else schedule();
  });
}

export function publicBootstrap({pepper,schoolYear=2026,schools=[],copyright={},now=()=>Date.now(),token=()=>randomBytes(32).toString('base64url')}) {
  invariant(typeof pepper==='string'&&pepper.length>=16,'SERVER_CONFIGURATION_REQUIRED');
  const expiresAt=now()+120000,nonce=token(),hash=gasHash(pepper);
  return {ok:true,data:{ticket:{expiresAt,nonce,signature:hash('ticket:'+expiresAt+':'+nonce)},serverNow:now(),schoolYear,version:'4.3-quiz50',schools,copyright}};
}

export function makeRpcStore({url,key,fetchImpl=fetch}) {
  invariant(/^https:\/\//.test(url) && typeof key==='string' && key.length>0,'SERVER_CONFIGURATION_REQUIRED');
  async function rpc(name,args) {
    const response=await fetchImpl(url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(15000)});
    invariant(response.ok,'DATABASE_UNAVAILABLE');return response.json();
  }
  return {
    load:namespace=>rpc('rc_snapshot',{p_namespace:namespace}),
    commit:(namespace,revision,changes,backups,copies)=>rpc('rc_commit',{p_namespace:namespace,p_revision:revision,p_changes:changes,p_backups:backups,p_copies:copies}),
    readBackup:(namespace,id)=>rpc('rc_read_backup',{p_namespace:namespace,p_id:id})
  };
}
