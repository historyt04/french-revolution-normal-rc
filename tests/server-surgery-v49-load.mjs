// Domain/adapter regression tests, NOT hosted database or classroom load tests.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyTables,Repository} from '../supabase/functions/_shared/rc-data.mjs';
import {createService,rules} from '../supabase/functions/_shared/gas-v6-domain.mjs';
import {gasHash,publicBootstrap} from '../supabase/functions/_shared/rc-service.mjs';
import {makeTransactionalService} from '../supabase/functions/_shared/transaction-service.mjs';

const pepper='local-regression-only-not-a-deployed-secret',backupKey=new Uint8Array(32),hash=gasHash(pepper);
let clock=Date.parse('2026-09-23T09:00:00+09:00'),serial=0;
const stamp=()=>new Date(clock).toISOString(),now=()=>clock;
const repo=new Repository(emptyTables());
const domain=createService({repo,now,token:()=>`fixture-${++serial}`,hash,random:()=>0.25},rules);
domain.init(2026);
repo.put('schools3',{id:'school-01',schoolYear:0,name:'Local regression',active:true,createdAt:stamp()});
repo.put('system',{id:'authority3',schoolYear:0,key:'authority3',value:{version:3,legacySchoolId:'school-01'},updatedAt:stamp()});
// Default access rules allow learning; no deployed policy is altered.
for(let n=1;n<=2;n++){
 const id=`2026-2-98-${n}`;
 repo.put('students',{id,schoolYear:2026,grade:2,classNo:98,number:n,name:`Regression ${n}`,nickname:`Regression ${n}`,codeHash:hash(`credential:student:${id}:54321`),active:true,createdAt:stamp()});
 repo.put('studentScopes3',{id,schoolYear:2026,studentId:id,schoolId:'school-01',units:[rules.unitId],createdAt:stamp()});
}
repo.put('teachers',{id:'fixture-teacher',schoolYear:2026,loginId:'fixture-teacher',displayName:'Local only',codeHash:hash('credential:teacher:fixture-teacher:local-only-credential'),active:true,createdAt:stamp()});
repo.put('teacherPolicies',{id:'2026:fixture-teacher',schoolYear:2026,teacherId:'fixture-teacher',role:'teacher',approval:'approved',schoolId:'school-01',classes:['2-98'],units:[rules.unitId],startsAt:stamp(),endsAt:'2027-01-01T00:00:00Z',status:'active',sessionVersion:1,recoveryVersion:1});
repo.commit();
let tables=repo.snapshot(),failWrite=false,transactionCount=0;
const receipts=new Map(),locks=new Map();
const source=readFileSync(new URL('../supabase/migrations/20260923022805_isolated_normal_rc_student_transactions.sql',import.meta.url),'utf8');
const shared=new Set([...source.matchAll(/catalog values \('([^']+)','[^']+',true\)/g)].map(x=>x[1]));
const owner=(table,r)=>table==='students'?r.id:table==='system'?r.value?.studentId:r.studentId||r.userId||r.actorId;
const minimalTables=new Set(['students','studentScopes3','teachers','teacherPolicies','schools3','system','games','scopedSettings3','sessions','sessionScopes3','sessionRevocations3','limits','receipts']);
const database={async transaction(fn){
 transactionCount++;let unlock,working,changes=[],receiptWrite;
 const tx={
  async legacySchool(){return 'school-01'},
  async session(tokenHash){return structuredClone(tables.sessions.find(r=>r.tokenHash===tokenHash))},
  async lock(actor){const prior=locks.get(actor)||Promise.resolve();const next=new Promise(r=>unlock=r);locks.set(actor,prior.then(()=>next));await prior;},
  async load(actor,session,request,action,staff,limitIds){
   working=structuredClone(tables);
   for(const [t,rows] of Object.entries(working))working[t]=rows.filter(r=>{
    if(action.endsWith('.login')&&!minimalTables.has(t))return false;
    if(action.endsWith('.login')&&['students','teachers'].includes(t))return r.id===actor;
    if(action.endsWith('.login')&&t==='teacherPolicies')return r.teacherId===actor;
    if(action.endsWith('.login')&&['sessions','studentScopes3'].includes(t))return owner(t,r)===actor;
    if(staff)return true;
    if(t==='students')return r.id===actor;
    if(t==='system')return !r.value?.studentId||r.value.studentId===actor;
    if(t==='receipts')return r.userId===actor&&r.requestId===request;
    if(t==='limits')return limitIds.includes(r.id);
    if(['sessionScopes3','sessionRevocations3'].includes(t))return r.id===session||r.userId===actor;
    if(shared.has(t))return true;
    if(['audit','securityEvents','journals','migration','backups','boardSnapshots27'].includes(t))return false;
    return owner(t,r)===actor;
   });
   return working;
  },
  async loginReceipt(actor,id){return receipts.get(actor+':'+id)},
  async saveLoginReceipt(actor,id,body_hash,envelope){receiptWrite=[actor+':'+id,{body_hash,envelope}]},
  async write(rows){changes=structuredClone(rows);if(failWrite){failWrite=false;throw Object.assign(Error('injected pre-commit fault'),{code:'INJECTED_FAILURE'})}},
  async readBackup(){throw Error('not exercised')}
 };
 try{const out=await fn(tx);for(const {table,row} of changes){const i=tables[table].findIndex(x=>x.id===row.id);if(i<0)tables[table].push(row);else tables[table][i]=row}if(receiptWrite)receipts.set(...receiptWrite);return out}finally{unlock?.()}
}};
const service=makeTransactionalService({database,pepper,backupKey,now});
const ticket=()=>publicBootstrap({pepper,now}).data.ticket;
const req=(action,payload={},token,requestId=`regression-request-${++serial}`)=>({action,payload,token,requestId,ticket:ticket()});
const success=out=>{assert.equal(out.ok,true,JSON.stringify(out));return out.data};
const teacher=success(await service(req('teacher.login',{schoolYear:2026,loginId:'fixture-teacher',code:'local-only-credential'})));
const created=success(await service(req('teacher.student.create',{students:Array.from({length:30},(_,index)=>({schoolYear:2026,grade:2,classNo:98,number:index+10,name:`Load fixture ${index+10}`}))},teacher.token))).created;
assert.equal(created.length,30);
const roster=created.map(({student,code})=>({student,code}));
const packsFor=id=>tables.packs.filter(row=>row.studentId===id&&row.packId==='basic').reduce((n,row)=>n+row.count,0);
async function ready(entry){
 const student=success(await service(req('student.login',{schoolId:'school-01',schoolYear:2026,grade:2,classNo:98,number:entry.student.number,code:entry.code})));
 const prepared=success(await service(req('attempt.prepare',{mode:'beginner'},student.token)));
 const active=success(await service(req('attempt.activate',{attemptId:prepared.attemptId,revision:prepared.state.revision},student.token)));
 const questions=new Map(active.state.localQuestions.map(q=>[q.id,q]));
 return{entry,student,request:req('attempt.quiz.complete',{attemptId:active.attemptId,revision:active.state.revision,submissions:active.state.originalSequence.map(questionId=>({questionId,answer:questions.get(questionId).answers[0]}))},student.token)};
}
function percentile(values,share){const ordered=[...values].sort((a,b)=>a-b);return Math.round(ordered[Math.min(ordered.length-1,Math.ceil(ordered.length*share)-1)]*100)/100}
async function group(entries,concurrent){
 const attempts=concurrent?await Promise.all(entries.map(ready)):await (async()=>{const list=[];for(const entry of entries)list.push(await ready(entry));return list})();
 const beforeRecords=tables.records.length,beforePacks=new Map(entries.map(entry=>[entry.student.id,packsFor(entry.student.id)]));clock+=10000;
 const submit=async item=>{const start=performance.now(),out=await service(item.request);return{item,out,ms:performance.now()-start,bytes:Buffer.byteLength(JSON.stringify(out))}};
 const results=concurrent?await Promise.all(attempts.map(submit)):await (async()=>{const list=[];for(const item of attempts)list.push(await submit(item));return list})();
 for(const {item,out} of results){success(out);assert.equal(out.data.status,'completed');const delta=out.data.completion;if(delta){assert.equal(delta.success,true);assert.equal(delta.completedStage,'beginner');assert.equal(delta.completionCount,tables.records.filter(r=>r.studentId===item.entry.student.id&&r.mode==='beginner').length)}else assert.equal(out.data.student.unlocked.intermediate,true)}
 assert.equal(tables.records.length,beforeRecords+entries.length,'each attempt must create exactly one record');
 for(const entry of entries){const prior=beforePacks.get(entry.student.id),expected=prior===0?1:prior;assert.equal(packsFor(entry.student.id),expected,'first-completion pack policy must be exact')}
 const times=results.map(row=>row.ms),sizes=results.map(row=>row.bytes);
 return{attempts,metrics:{n:results.length,errors:0,integrityErrors:0,bytesP50:percentile(sizes,.5),bytesP95:percentile(sizes,.95),msP50:percentile(times,.5),msP95:percentile(times,.95),msMax:percentile(times,1)}};
}
const five=await group(roster.slice(0,5),false);
for(const item of five.attempts){const state=success(await service(req('student.state',{},item.student.token)));assert.equal(state.unlocked.intermediate,true);const again=success(await service(req('student.login',{schoolId:'school-01',schoolYear:2026,grade:2,classNo:98,number:item.entry.student.number,code:item.entry.code})));assert.equal(success(await service(req('student.state',{},again.token))).unlocked.intermediate,true)}
const repeated=await service(five.attempts[0].request);assert.equal(repeated.replayed,true);if(repeated.data.completion)assert.equal(repeated.data.completion.duplicate,true);
const thirty=await group(roster,true);
console.log('SERVER_SURGERY_LOAD',JSON.stringify({five:five.metrics,thirty:thirty.metrics,adapter:'local in-memory, isolated fixtures'}));
