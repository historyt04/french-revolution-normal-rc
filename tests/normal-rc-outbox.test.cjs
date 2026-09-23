// Fault tests for the client queue; not a hosted browser/concurrency benchmark.
const assert=require('node:assert/strict');
const {CompletionQueue}=require('../normal-rc-outbox.js');
class Store{
 constructor(){this.data=new Map();this.failNext=false}
 async get(id){return structuredClone(this.data.get(id))}
 async list(owner){return [...this.data.values()].filter(r=>r.owner===owner).map(r=>structuredClone(r))}
 async put(row){if(this.failNext){this.failNext=false;throw Error('disk full')}const old=this.data.get(row.id);if(old&&old.fingerprint!==row.fingerprint)throw Error('conflict');if(old?.status==='confirmed')return structuredClone(old);this.data.set(row.id,structuredClone(row));return row}
}
(async()=>{
 const store=new Store();let owner='student-A',loseResponse=true,effects=0,confirmed=0;const receipts=new Map(),calls=[];
 const request=async(action,payload,opts)=>{
  calls.push({action,payload:structuredClone(payload),id:opts.requestId});
  if(receipts.has(opts.requestId))return structuredClone(receipts.get(opts.requestId));
  let out;
  if(action==='attempt.prepare')out={attemptId:'attempt-A',state:{revision:0}};
  else if(action==='attempt.activate')out={attemptId:'attempt-A',state:{revision:1}};
  else{effects++;out={attemptId:'attempt-A',student:{profile:{id:'student-A'}}}}
  receipts.set(opts.requestId,out);
  if(action==='attempt.quiz.complete'&&loseResponse){loseResponse=false;throw Object.assign(Error('lost after commit'),{code:'CONNECTION_ERROR'})}
  return out;
 };
 const make=()=>new CompletionQueue({store,owner:()=>owner,request,onConfirmed:()=>confirmed++});
 let queue=make();const input={clientId:'stable-request',mode:'beginner',action:'attempt.quiz.complete',prepare:{mode:'beginner',questionIds:['q1'],restart:true},payload:{submissions:[{questionId:'q1',answer:'answer'}]}};
 await queue.enqueue(input);await queue.flush();assert.equal(effects,1);assert.equal((await queue.rows())[0].status,'pending');
 // Closing and reopening the page with a NEW session uses the same student-owned queue.
 queue=make();await Promise.all([queue.flush(),queue.flush()]);assert.equal(effects,1);assert.equal(confirmed,1);assert.equal((await queue.rows())[0].status,'confirmed');
 for(const action of ['attempt.prepare','attempt.activate','attempt.quiz.complete'])assert.equal(new Set(calls.filter(c=>c.action===action).map(c=>c.id)).size,1);
 await assert.rejects(()=>queue.enqueue({...input,payload:{submissions:[]}}),e=>e.code==='LOCAL_REQUEST_CONFLICT');
 owner='student-B';assert.deepEqual(await queue.rows(),[]);const count=calls.length;await queue.flush();assert.equal(calls.length,count);
 // Failure to save locally does not send anything to the server.
 store.failNext=true;await assert.rejects(()=>queue.enqueue({...input,clientId:'no-disk'}));await queue.flush();assert.equal(calls.length,count);
 // Logout while activation is in flight cannot complete under the next student's session.
 let switchCalls=0;const switchQueue=new CompletionQueue({store,owner:()=>owner,request:async()=>{switchCalls++;owner='student-C';return {attemptId:'attempt-B',state:{revision:0}}}});
 await switchQueue.enqueue({...input,clientId:'switch'});await switchQueue.flush();assert.equal(switchCalls,1);assert.equal((await store.list('student-B'))[0].status,'pending');
 // Terminal validation failures retain the original transcript for review.
 owner='student-C';const invalidQueue=new CompletionQueue({store,owner:()=>owner,request:async()=>{throw Object.assign(Error('invalid'),{code:'INVALID_TRANSCRIPT'})}});
 await invalidQueue.enqueue({...input,clientId:'invalid'});await invalidQueue.flush();const blocked=(await invalidQueue.rows())[0];assert.equal(blocked.status,'blocked');assert.deepEqual(blocked.payload,input.payload);
 // A local confirmation write failure causes a replay, not another server effect.
 owner='student-D';let writes=0;const diskQueue=new CompletionQueue({store,owner:()=>owner,request:async(action,payload,opts)=>{const result=await request(action,payload,opts);if(action==='attempt.quiz.complete'&&writes++===0)store.failNext=true;return result}});
 await diskQueue.enqueue({...input,clientId:'confirm-disk-failure'});await diskQueue.flush();assert.equal((await diskQueue.rows())[0].status,'pending');const before=effects;await diskQueue.flush();assert.equal(effects,before);assert.equal((await diskQueue.rows())[0].status,'confirmed');
 console.log('PASS: response loss, page reload, session isolation, ID conflicts, local write failure, terminal transcript retention, confirmation replay');
})().catch(e=>{console.error(e);process.exitCode=1});
