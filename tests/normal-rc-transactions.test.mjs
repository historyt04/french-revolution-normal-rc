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
const invalid=await service({...req('student.login'),ticket:null});assert.equal(invalid.code,'REQUEST_EXPIRED');assert.equal(transactionCount,0);
const loginRequest=n=>req('student.login',{schoolId:'school-01',schoolYear:2026,grade:2,classNo:98,number:n,code:'54321'});
const first=loginRequest(1),student1=success(await service(first));
assert(!student1.student,'login must not calculate the full student state');
const replay=await service(first);assert(replay.replayed);assert.equal(replay.data.token,student1.token);assert.equal(tables.sessions.length,1);
assert.equal((await service({...first,payload:{...first.payload,code:'different'}})).code,'REQUEST_CONFLICT');
const student2=success(await service(loginRequest(2)));
const [s1,s2]=await Promise.all([student1,student2].map(s=>service(req('attendance.claim',{},s.token)).then(success)));
assert(s1.student.profile.id!==s2.student.profile.id);assert.equal(tables.attendance.length,2);
assert.equal((await service(req('teacher.overview',{},student1.token))).code,'FORBIDDEN');
assert.equal((await service(req('student.state',{studentId:student2.user.id},student1.token))).code,'FORBIDDEN');
const prepared=success(await service(req('attempt.prepare',{mode:'beginner'},student1.token)));
const active=success(await service(req('attempt.activate',{attemptId:prepared.attemptId,revision:prepared.state.revision},student1.token)));
clock+=10000;
const byId=new Map(active.state.localQuestions.map(q=>[q.id,q]));
const complete=req('attempt.quiz.complete',{attemptId:active.attemptId,revision:active.state.revision,submissions:active.state.originalSequence.map(questionId=>({questionId,answer:byId.get(questionId).answers[0]}))},student1.token);
const before=JSON.stringify(tables);failWrite=true;
assert.equal((await service(complete)).code,'INJECTED_FAILURE');assert.equal(JSON.stringify(tables),before,'all effects roll back on commit failure');
const completed=success(await service(complete));assert(['completed','review'].includes(completed.status));
const afterCompletion=tables.records.length,packCount=()=>tables.packs.filter(r=>r.studentId===student1.user.id).reduce((n,r)=>n+r.count,0);
const beforeReplay=packCount();assert((await service(complete)).replayed);assert.equal(tables.records.length,afterCompletion);assert.equal(packCount(),beforeReplay);
assert((await service({...complete,requestId:'completion-new-request-id'})).replayed);assert.equal(tables.records.length,afterCompletion);assert.equal(packCount(),beforeReplay);
assert.equal((await service({...complete,requestId:'other-student-attempt-claim',token:student2.token})).ok,false);
const opening=req('cards.openPack',{packId:'basic',count:1},student1.token);
const opened=success(await service(opening));assert.equal(opened.cards.length,1);
const inventory=JSON.stringify({cards:tables.cards,variants:tables.cardVariants,packs:tables.packs,shards:tables.shinyWallet});
const duplicate=await service(opening);assert(duplicate.replayed);assert.deepEqual(duplicate.data.cards,opened.cards);assert.equal(JSON.stringify({cards:tables.cards,variants:tables.cardVariants,packs:tables.packs,shards:tables.shinyWallet}),inventory);
assert.equal((await service({...opening,payload:{packId:'basic',count:2}})).code,'REQUEST_CONFLICT');
success(await service(req('cards.openings.list',{},student1.token)));
success(await service(req('student.records.read',{},student1.token)));
const samePack=req('cards.openPack',{packId:'basic',count:1},student1.token),beforeOpen=packCount();
const simultaneous=await Promise.all([service(samePack),service(samePack),service(samePack)]);simultaneous.forEach(success);assert.equal(packCount(),beforeOpen-1);assert.equal(simultaneous.filter(r=>r.replayed).length,2);
const teacher=success(await service(req('teacher.login',{schoolYear:2026,loginId:'fixture-teacher',code:'local-only-credential'})));
const create=req('teacher.student.create',{students:Array.from({length:30},(_,i)=>({schoolYear:2026,grade:2,classNo:98,number:i+10,name:`Local fixture ${i+10}`}))},teacher.token);
const created=success(await service(create));assert.equal(created.created.length,30);assert.equal(tables.students.length,32);
assert((await service(create)).replayed);assert.equal(tables.students.length,32);
success(await service(req('session.logout',{},student1.token)));assert.equal((await service(req('student.state',{},student1.token))).code,'SESSION_EXPIRED');
const relogin=success(await service(loginRequest(1))),persisted=success(await service(req('student.state',{},relogin.token)));assert(persisted.completed.beginner);assert(persisted.cards.length>0);assert.equal(tables.records.length,afterCompletion);
console.log('PASS: minimal login/replay; student boundaries; attendance; completion rollback and two replay paths; pack atomic replay/conflict; opening/report rate partitions; 30-row teacher registration; logout/relogin persistence. In-memory adapter, NOT a hosted load benchmark.');
