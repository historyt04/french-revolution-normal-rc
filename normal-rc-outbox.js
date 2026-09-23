/* Durable completion queue. No tokens or login codes are persisted here. */
(function(root){'use strict';
 class IndexedCompletionStore{
  constructor(name){this.name=name;this.opening=null}
  open(){if(!this.opening)this.opening=new Promise((resolve,reject)=>{const r=indexedDB.open(this.name,1);r.onupgradeneeded=()=>{const s=r.result.createObjectStore('jobs',{keyPath:'id'});s.createIndex('owner','owner')};r.onsuccess=()=>{r.result.onversionchange=()=>{r.result.close();this.opening=null};resolve(r.result)};r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('LOCAL_STORAGE_BLOCKED'))}).catch(error=>{this.opening=null;throw error});return this.opening}
  async run(mode,operation){const db=await this.open();return new Promise((resolve,reject)=>{let tx;try{tx=db.transaction('jobs',mode,{durability:'strict'})}catch{tx=db.transaction('jobs',mode)}let result;tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('LOCAL_STORAGE_ABORTED'));operation(tx.objectStore('jobs'),v=>{result=v})})}
  get(id){return this.run('readonly',(s,done)=>{const r=s.get(id);r.onsuccess=()=>done(r.result)})}
  list(owner){return this.run('readonly',(s,done)=>{const r=s.index('owner').getAll(owner);r.onsuccess=()=>done(r.result)})}
  put(row){return this.run('readwrite',(s,done)=>{const r=s.get(row.id);r.onsuccess=()=>{const old=r.result;if(old&&(old.owner!==row.owner||old.fingerprint!==row.fingerprint)){s.transaction.abort();return}if(old?.status==='confirmed'){done(old);return}s.put(row);done(row)}})}
 }
 const retryable=new Set(['CONNECTION_ERROR','BUSY','SERVER_ERROR','REQUEST_EXPIRED','RATE_LIMIT','SESSION_CHANGED','SESSION_EXPIRED','AUTH_REQUIRED','SESSION_REVOKED','ACCESS_DENIED','ACTIVATION_REQUIRED']);
 class CompletionQueue{
  constructor({store,owner,request,onChange=()=>{},onConfirmed=()=>{}}){Object.assign(this,{store,owner,request,onChange,onConfirmed});this.running=null}
  async enqueue(input){const owner=this.owner();if(!owner)throw Object.assign(Error('AUTH_REQUIRED'),{code:'AUTH_REQUIRED'});const fingerprint=JSON.stringify(input),id=owner+'|'+input.clientId,prior=await this.store.get(id);if(prior){if(prior.fingerprint!==fingerprint)throw Object.assign(Error('LOCAL_REQUEST_CONFLICT'),{code:'LOCAL_REQUEST_CONFLICT'});this.onChange(prior);return prior}const row={...input,id,owner,fingerprint,status:'pending',createdAt:Date.now(),retries:0};const saved=await this.store.put(row);this.onChange(saved);return saved}
  async rows(){const owner=this.owner();return owner?(await this.store.list(owner)).sort((a,b)=>a.createdAt-b.createdAt):[]}
  flush(){if(this.running)return this.running;this.running=this.drain().finally(()=>{this.running=null});return this.running}
  async drain(){const owner=this.owner();if(!owner)return;const rows=await this.rows();for(const row of rows){if(row.status!=='pending')continue;if(this.owner()!==owner)return;
   try{
    const call=async(action,payload,suffix)=>{if(this.owner()!==owner)throw Object.assign(Error('SESSION_CHANGED'),{code:'SESSION_CHANGED'});return this.request(action,payload,{requestId:row.clientId+'-'+suffix,maxAttempts:1,timeoutMs:10000})};
    let active=row.active;
    if(row.prepare){const ready=await call('attempt.prepare',row.prepare,'prepare');active=await call('attempt.activate',{attemptId:ready.attemptId,revision:ready.state.revision},'activate')}
    else if(row.activation)active=await call('attempt.activate',row.activation,'activate');
    if(!active?.attemptId)throw Object.assign(Error('INVALID_LOCAL_RECORD'),{code:'INVALID_LOCAL_RECORD'});
    const result=await call(row.action,{attemptId:active.attemptId,revision:active.state?.revision??active.revision,...row.payload},'complete');
    // Commit confirmation before notifying UI. Never retain the response's full student state.
    const confirmed={id:row.id,owner,clientId:row.clientId,fingerprint:row.fingerprint,mode:row.mode,status:'confirmed',createdAt:row.createdAt,confirmedAt:Date.now(),serverAttemptId:result.attemptId};
    await this.store.put(confirmed);this.onChange(confirmed);if(this.owner()===owner)await this.onConfirmed(row,result);
   }catch(error){const next={...row,retries:row.retries+1,lastError:error.code||'CONNECTION_ERROR',status:!error.code||retryable.has(error.code)?'pending':'blocked'};const saved=await this.store.put(next);this.onChange(saved);break}
  }}
 }
 const exports={IndexedCompletionStore,CompletionQueue};if(typeof module!=='undefined'&&module.exports)module.exports=exports;else root.HistoryNormalOutbox=exports;
})(typeof window!=='undefined'?window:globalThis);
