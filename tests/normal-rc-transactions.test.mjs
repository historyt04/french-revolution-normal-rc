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
const packAmount=(studentId,packId)=>tables.packs.find(x=>x.studentId===studentId&&x.packId===packId)?.count||0;
success(await service(req('teacher.gift',{scope:'student',studentId:student1.user.id,schoolYear:2026,grade:2,classNo:98,unitId:rules.unitId,kind:'pack',packId:'normal',count:10,reason:'one by one regression'},teacher.token)));
const tenNormal=packAmount(student1.user.id,'normal');
for(let i=0;i<3;i++)success(await service(req('cards.openPack',{packId:'normal',count:1},student1.token)));
assert.equal(packAmount(student1.user.id,'normal'),tenNormal-3,'opening three one-by-one requests must leave exactly seven of the granted ten packs');
const premiumBefore=packAmount(student1.user.id,'premium');success(await service(req('teacher.gift',{scope:'student',studentId:student1.user.id,schoolYear:2026,grade:2,classNo:98,unitId:rules.unitId,kind:'pack',packId:'premium',count:10,reason:'all and resume regression'},teacher.token)));
const allRequest=req('cards.openPack',{packId:'premium',count:premiumBefore+10},student1.token),allOpened=success(await service(allRequest));assert.equal(allOpened.opening.cards.length,premiumBefore+10);assert.equal(packAmount(student1.user.id,'premium'),0,'all mode must commit the full held quantity');
success(await service(req('cards.openings.ack',{openingId:allOpened.opening.id,revealed:3,seen:false},student1.token)));
const allResumed=success(await service(req('cards.openings.read',{openingId:allOpened.opening.id},student1.token)));assert.equal(allResumed.opening.revealed,3);assert.deepEqual(allResumed.opening.cards,allOpened.opening.cards,'closing and resuming all mode must keep the same remaining results');
assert((await service(allRequest)).replayed);assert.equal(packAmount(student1.user.id,'premium'),0,'replaying all mode must not grant or subtract again');
success(await service(req('teacher.gift',{scope:'student',studentId:student1.user.id,schoolYear:2026,grade:2,classNo:98,unitId:rules.unitId,kind:'pack',packId:'myth',count:15,reason:'NEW persistence regression'},teacher.token)));
const newSequence=[];for(let i=0;i<15;i++)newSequence.push(success(await service(req('cards.openPack',{packId:'myth',count:1},student1.token))));
const firstNew=newSequence[0],secondNew=newSequence.at(-1);
assert.equal(firstNew.cards[0].isNew,true);assert.equal(secondNew.cards[0].isNew,false,'an already-owned card variant must not be NEW');
const reopenedNew=success(await service(req('cards.openings.read',{openingId:firstNew.opening.id},student1.token)));
assert.equal(reopenedNew.opening.cards[0].isNew,true,'resume must preserve the server NEW decision');
const cardKey=(eventId,rarity)=>`${student1.user.id}:${rules.unitId}:${eventId}:${rarity}`;
const variantKey=(eventId,rarity,effect)=>`${cardKey(eventId,rarity)}:${effect}`;
const upsertRow=(table,row)=>{const at=tables[table].findIndex(x=>x.id===row.id);if(at<0)tables[table].push(row);else tables[table][at]={...tables[table][at],...row}};
for(let eventId=1;eventId<=6;eventId++){
 upsertRow('cards',{id:cardKey(eventId,'normal'),schoolYear:2026,studentId:student1.user.id,unitId:rules.unitId,eventId,legacyId:eventId,rarity:'normal',count:10,firstAcquiredAt:stamp(),updatedAt:stamp()});
 upsertRow('cardVariants',{id:variantKey(eventId,'normal','01'),schoolYear:2026,studentId:student1.user.id,unitId:rules.unitId,eventId,rarity:'normal',effect:'01',count:eventId===6?1:5,locked:false,firstAcquiredAt:stamp(),updatedAt:stamp()});
}
const normalMaterial=eventId=>({eventId,rarity:'normal',effect:'normal'}),glowMaterial=eventId=>({eventId,rarity:'normal',effect:'01'});
const oneGlow=success(await service(req('cards.synthesize',{materials:[glowMaterial(1),normalMaterial(2),normalMaterial(3),normalMaterial(4),normalMaterial(5)]},student1.token)));
assert.equal(oneGlow.odds.shinyMaterials,1);assert.equal(oneGlow.odds.shinyBonus,5);assert.equal(oneGlow.odds.finalSuccess,Math.min(100,oneGlow.odds.baseSuccess+5));assert.equal(oneGlow.card.shiny,false,'glow material must not add to the result glow chance');
const fourGlowRequest=req('cards.synthesize',{materials:[glowMaterial(1),glowMaterial(2),glowMaterial(3),glowMaterial(4),normalMaterial(5)]},student1.token);
const fourGlow=success(await service(fourGlowRequest));assert.equal(fourGlow.odds.shinyMaterials,4);assert.equal(fourGlow.odds.shinyBonus,20);assert.equal(fourGlow.odds.finalSuccess,Math.min(100,fourGlow.odds.baseSuccess+20));
const afterFourGlow=tables.cardVariants.filter(x=>x.studentId===student1.user.id).reduce((n,x)=>n+x.count,0);
assert((await service(fourGlowRequest)).replayed);assert.equal(tables.cardVariants.filter(x=>x.studentId===student1.user.id).reduce((n,x)=>n+x.count,0),afterFourGlow,'replayed synthesis must not consume materials twice');
const protectedGlowCount=tables.cardVariants.find(x=>x.id===variantKey(6,'normal','01')).count;
const protectedAttempt=await service(req('cards.synthesize',{materials:[glowMaterial(6),normalMaterial(1),normalMaterial(2),normalMaterial(3),normalMaterial(4)]},student1.token));
assert.equal(protectedAttempt.code,'PROTECTED_LAST_CARD');assert.equal(tables.cardVariants.find(x=>x.id===variantKey(6,'normal','01')).count,protectedGlowCount,'the final glow copy must remain protected on the server');
const teacherPractice=success(await service(req('teacher.test.issue',{},teacher.token)));
const practiceState=success(await service(req('student.state',{},teacherPractice.token)));
assert.equal(practiceState.testOnly,true);assert.equal(practiceState.visibility.collection,false);
const practiceProtectedBefore=JSON.stringify({cards:tables.cards,packs:tables.packs,records:tables.records,openings:tables.packOpenings28,fusions:tables.fusion});
const advancedPrepared=success(await service(req('attempt.prepare',{mode:'advanced'},teacherPractice.token)));
const advancedActive=success(await service(req('attempt.activate',{attemptId:advancedPrepared.attemptId,revision:advancedPrepared.state.revision},teacherPractice.token)));
assert.equal(advancedActive.state.localQuestions.length,12);
for(const question of advancedActive.state.localQuestions){assert.equal(question.choices.length,5);assert.equal(question.answers[0],String(question.correctIndex+1));assert(question.explanation.length>=20)}
clock+=10000;
const advancedComplete=success(await service(req('attempt.quiz.complete',{attemptId:advancedActive.attemptId,revision:advancedActive.state.revision,submissions:advancedActive.state.originalSequence.map(questionId=>{const question=advancedActive.state.localQuestions.find(row=>row.id===questionId);return{questionId,answer:String(question.correctIndex+1)}})},teacherPractice.token)));
assert.equal(advancedComplete.status,'completed');assert.equal(advancedComplete.state.successIds.length,12);assert.equal(tables.records.some(row=>row.studentId==='TEST:fixture-teacher'&&row.mode==='advanced'),false,'teacher practice must not create student records or rewards');
assert.equal(JSON.stringify({cards:tables.cards,packs:tables.packs,records:tables.records,openings:tables.packOpenings28,fusions:tables.fusion}),practiceProtectedBefore,'teacher practice must not mutate real cards, packs, records, openings, or fusion history');
const missionOverview=success(await service(req('teacher.overview',{schoolYear:2026},teacher.token)));
const studentMissionsBefore=success(await service(req('student.state',{},student1.token))).missions.map(x=>x.id).sort();
const missionDraft=structuredClone(missionOverview.missions25.program.draft);missionDraft[0]={...missionDraft[0],active:true,title:'RC 초안 저장 검증',games:['beginner']};
success(await service(req('teacher.missions.save',{schoolYear:2026,missions:missionDraft},teacher.token)));
assert.deepEqual(success(await service(req('student.state',{},student1.token))).missions.map(x=>x.id).sort(),studentMissionsBefore,'saving a draft must not change the active student mission run');
success(await service(req('teacher.missions.control',{schoolYear:2026,action:'start',confirmed:true},teacher.token)));
const studentMissionsAfter=success(await service(req('student.state',{},student1.token))).missions;assert.equal(studentMissionsAfter.length,1);assert.equal(studentMissionsAfter[0].title,'RC 초안 저장 검증');
const directGift=success(await service(req('teacher.gift',{scope:'student',studentId:student1.user.id,schoolYear:2026,grade:2,classNo:98,unitId:rules.unitId,kind:'card',eventId:14,rarity:'myth',count:1,form:'normal',effect:'auto',effectPolicy:'missing',duplicate:'allow',unowned:false,reason:'NEW result regression'},teacher.token)));
assert.equal(directGift.results[0].cards.length,1);const giftOpening=tables.packOpenings28.find(x=>x.studentId===student1.user.id&&x.source==='teacherGift');assert(giftOpening);assert.deepEqual(giftOpening.cards,directGift.results[0].cards,'teacher gift result must preserve the server NEW decision');
// Stable legacy IDs now represent server-enforced guarantee distributions, and fixed
// guarantee packs do not consume the probability-pack pity counter.
assert.deepEqual(rules.packs.find(x=>x.id==='rare').odds,{normal:0,rare:80,unique:15,legend:4,myth:1});
assert.deepEqual(rules.packs.find(x=>x.id==='unique').odds,{normal:0,rare:0,unique:85,legend:13,myth:2});
assert.deepEqual(rules.packs.find(x=>x.id==='legend').odds,{normal:0,rare:0,unique:0,legend:95,myth:5});
const rarityOrder=['normal','rare','unique','legend','myth'];
for(const [packId,minimum] of [['normal','normal'],['rare','rare'],['unique','unique'],['legend','legend'],['myth','myth']]){
 success(await service(req('teacher.gift',{scope:'student',studentId:student1.user.id,schoolYear:2026,grade:2,classNo:98,unitId:rules.unitId,kind:'pack',packId,count:1,reason:'guarantee regression'},teacher.token)));
 const pityBefore=structuredClone(tables.pity.find(x=>x.studentId===student1.user.id)?.state||null);
 const result=success(await service(req('cards.openPack',{packId,count:1},student1.token)));
 assert(rarityOrder.indexOf(result.cards[0].rarity)>=rarityOrder.indexOf(minimum),`${packId} must enforce its server minimum rarity`);
 assert.deepEqual(tables.pity.find(x=>x.studentId===student1.user.id)?.state||null,pityBefore,'guarantee packs must not change probability-pack pity');
}
const create=req('teacher.student.create',{students:Array.from({length:30},(_,i)=>({schoolYear:2026,grade:2,classNo:98,number:i+10,name:`Local fixture ${i+10}`}))},teacher.token);
const created=success(await service(create));assert.equal(created.created.length,30);assert.equal(tables.students.length,32);
assert((await service(create)).replayed);assert.equal(tables.students.length,32);
const beforeRotate={records:tables.records.filter(x=>x.studentId===student1.user.id).length,cards:tables.cards.filter(x=>x.studentId===student1.user.id).reduce((n,x)=>n+x.count,0)};
const rotated=success(await service(req('teacher.student.code.rotate',{studentId:student1.user.id,reason:'forgotten code regression',confirmed:true},teacher.token)));assert.match(rotated.code,/^\d{5}$/);assert.equal((await service(req('student.state',{},student1.token))).code,'SESSION_EXPIRED');
const relogin=success(await service(req('student.login',{schoolId:'school-01',schoolYear:2026,grade:2,classNo:98,number:1,code:rotated.code}))),persisted=success(await service(req('student.state',{},relogin.token)));assert(persisted.completed.beginner);assert(persisted.cards.length>0);assert.equal(tables.records.filter(x=>x.studentId===student1.user.id).length,beforeRotate.records);assert.equal(tables.cards.filter(x=>x.studentId===student1.user.id).reduce((n,x)=>n+x.count,0),beforeRotate.cards);
console.log('PASS: login/replay; one-by-one 10→7 packs; atomic duplicate opening; persisted NEW/duplicate result; all guarantee rules; glow fusion +5pp/+20pp cap, protected final glow, synthesis replay safety; teacher practice without real cards/packs/records; mission and identity persistence. In-memory adapter, NOT a hosted load benchmark.');
