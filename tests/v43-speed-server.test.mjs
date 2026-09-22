import assert from 'node:assert/strict';
import {emptyTables,Repository} from '../supabase/functions/_shared/rc-data.mjs';
import {createService,rules} from '../supabase/functions/_shared/gas-v6-domain.mjs';
import {gasHash,makeBatchService,makeService,publicBootstrap} from '../supabase/functions/_shared/rc-service.mjs';
import {QUIZ_BANK50} from '../supabase/functions/_shared/quiz-bank50.mjs';

const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const apply=(tables,changes)=>{
  const repo=new Repository(tables);
  for(const change of changes)repo.put(change.table,change.row);
  repo.commit();
  return repo.snapshot();
};

function fakeStore(initialTables=emptyTables()) {
  let snapshot={revision:0,tables:initialTables},loads=0,commits=0;
  return {
    async load(){loads++;await wait(15);return structuredClone(snapshot)},
    async commit(namespace,revision,changes){commits++;await wait(10);if(revision!==snapshot.revision)return{committed:false,revision:snapshot.revision};snapshot={revision:revision+1,tables:apply(snapshot.tables,changes)};return{committed:true,revision:snapshot.revision}},
    async readBackup(){throw new Error('not used')},
    stats(){return{loads,commits,revision:snapshot.revision,securityEvents:snapshot.tables.securityEvents.length}}
  };
}

const pepper='0123456789abcdef0123456789abcdef',backupKey=new Uint8Array(32),namespace='rc-concurrency-test';
let id=0;
const token=()=>`token-${++id}`;
const invalidRequests=Array.from({length:30},(_,i)=>({action:'student.login',payload:{index:i}}));

const legacyStore=fakeStore();
const legacy=makeService({store:legacyStore,namespace,pepper,backupKey,token,maxRetries:8});
const legacyResults=await Promise.all(invalidRequests.map(request=>legacy(request)));
const legacyStats=legacyStore.stats();
assert(legacyResults.some(result=>result.code==='BUSY'));

id=0;
const batchStore=fakeStore();
const batch=makeBatchService({store:batchStore,namespace,pepper,backupKey,token,maxRetries:8,batchWindowMs:20,maxBatchSize:64,cacheMs:2000});
const batchResults=await Promise.all(invalidRequests.map(request=>batch(request)));
const batchStats=batchStore.stats();
assert.equal(batchResults.filter(result=>result.code==='BUSY').length,0);
assert.equal(batchStats.loads,1);
assert.equal(batchStats.commits,1);
assert.equal(batchStats.securityEvents,30);

const bootstrap=publicBootstrap({pepper,schools:[{id:'school-01',name:'학교'}],token:()=> 'nonce',now:()=>1_000_000});
assert.equal(bootstrap.ok,true);
assert.equal(bootstrap.data.ticket.expiresAt,1_120_000);
assert.equal(bootstrap.data.schools.length,1);

// Valid classroom login burst: initialize the real domain, seed 30 students,
// and verify that every session is persisted by one combined commit.
id=0;
const seeded=new Repository(emptyTables()),fixedNow=Date.parse('2026-09-22T09:00:00+09:00'),hash=gasHash(pepper);
let clock=fixedNow;
const domain=createService({repo:seeded,now:()=>clock,token,hash,random:()=>0.25},rules);
domain.init(2026);
seeded.put('schools3',{id:'school-01',schoolYear:0,name:'학교',active:true,createdAt:new Date(fixedNow).toISOString()});
seeded.put('system',{id:'authority3',schoolYear:0,key:'authority3',value:{version:3,legacySchoolId:'school-01'},updatedAt:new Date(fixedNow).toISOString()});
for(let number=1;number<=30;number++){
  const studentId=`2026-2-4-${number}`,code=String(10000+number);
  seeded.put('students',{id:studentId,schoolYear:2026,grade:2,classNo:4,number,name:`학생${number}`,nickname:`학생${number}`,codeHash:hash(`credential:student:${studentId}:${code}`),active:true,createdAt:new Date(fixedNow).toISOString()});
  seeded.put('studentScopes3',{id:studentId,schoolYear:2026,studentId,schoolId:'school-01',units:['fr-revolution'],createdAt:new Date(fixedNow).toISOString()});
  for(const mode of ['beginner','intermediate','advanced'])seeded.put('records',{id:`seed-${studentId}-${mode}`,schoolYear:2026,studentId,unitId:'fr-revolution',mode,attemptId:`seed-${studentId}-${mode}`,elapsedMs:60000,attempts:1,hintCount:0,score:12,official:false,status:'normal',reason:'',createdAt:new Date(fixedNow-86400000).toISOString()});
}
seeded.commit();
const loginStore=fakeStore(seeded.snapshot()),loginBatch=makeBatchService({store:loginStore,namespace,pepper,backupKey,token,now:()=>clock,batchWindowMs:20,maxBatchSize:64,cacheMs:2000});
const loginTicket=publicBootstrap({pepper,schools:[{id:'school-01',name:'학교'}],token,now:()=>fixedNow}).data.ticket;
const loginResults=await Promise.all(Array.from({length:30},(_,i)=>loginBatch({action:'student.login',payload:{schoolId:'school-01',schoolYear:2026,grade:2,classNo:4,number:i+1,code:String(10001+i),rememberDevice:false},requestId:`login-request-${String(i+1).padStart(2,'0')}`,ticket:loginTicket})));
assert.equal(loginResults.filter(result=>!result.ok).length,0);
assert.equal(new Set(loginResults.map(result=>result.data.token)).size,30);
const prepareResults=await Promise.all(loginResults.map((loginResult,i)=>loginBatch({action:'attempt.prepare',payload:{mode:'beginner'},requestId:`prepare-request-${String(i+1).padStart(2,'0')}`,ticket:loginTicket,token:loginResult.data.token})));
assert.equal(prepareResults.filter(result=>!result.ok).length,0);
assert(prepareResults.every(result=>result.data.status==='prepared'&&result.data.state.localQuestions.length===result.data.state.originalSequence.length));
assert(prepareResults.every(result=>result.data.state.originalSequence.length===10&&new Set(result.data.state.localQuestions.map(q=>q.eventId)).size===10));
const activateResults=await Promise.all(prepareResults.map((prepared,i)=>loginBatch({action:'attempt.activate',payload:{attemptId:prepared.data.attemptId,revision:prepared.data.state.revision},requestId:`activate-request-${String(i+1).padStart(2,'0')}`,ticket:loginTicket,token:loginResults[i].data.token})));
assert.equal(activateResults.filter(result=>!result.ok).length,0);
clock+=4000;
const completeRequests=activateResults.map((active,i)=>{const byId=new Map(active.data.state.localQuestions.map(q=>[q.id,q]));return{action:'attempt.quiz.complete',payload:{attemptId:active.data.attemptId,revision:active.data.state.revision,submissions:active.data.state.originalSequence.map(questionId=>({questionId,answer:byId.get(questionId).answers[0]}))},requestId:`complete-request-${String(i+1).padStart(2,'0')}`,ticket:loginTicket,token:loginResults[i].data.token}});
const completeResults=await Promise.all(completeRequests.map(request=>loginBatch(request)));
assert.equal(completeResults.filter(result=>!result.ok).length,0);
assert(completeResults.every(result=>['completed','review'].includes(result.data.status)));
const repeated=await loginBatch(completeRequests[0]);
assert.equal(repeated.ok,true);
assert.equal(repeated.replayed,true);
const stolen=await loginBatch({...completeRequests[0],requestId:'stolen-attempt-request',token:loginResults[1].data.token});
assert.equal(stolen.ok,false);
const adminDenied=await loginBatch({action:'teacher.overview',payload:{schoolYear:2026},requestId:'student-admin-request',ticket:loginTicket,token:loginResults[0].data.token});
assert.equal(adminDenied.ok,false);

const matchPrepared=await loginBatch({action:'attempt.prepare',payload:{mode:'matching',variant:'advanced',setCount:12},requestId:'match-prepare-request',ticket:loginTicket,token:loginResults[0].data.token});
assert.equal(matchPrepared.ok,true);assert.equal(matchPrepared.data.status,'prepared');assert(matchPrepared.data.state.cards.every(card=>card.matchKey&&!('pair' in card)));
const matchActive=await loginBatch({action:'attempt.activate',payload:{attemptId:matchPrepared.data.attemptId,revision:matchPrepared.data.state.revision},requestId:'match-activate-request',ticket:loginTicket,token:loginResults[0].data.token});
assert.equal(matchActive.ok,true);clock+=6000;
const groups=new Map();matchActive.data.state.cards.forEach((card,index)=>groups.set(card.matchKey,[...(groups.get(card.matchKey)||[]),index]));
const matchMoves=[...groups.values()].map(([first,second])=>({first,second}));
const incomplete=await loginBatch({action:'attempt.match.complete',payload:{attemptId:matchActive.data.attemptId,revision:matchActive.data.state.revision,moves:matchMoves.slice(0,-1)},requestId:'match-incomplete-request',ticket:loginTicket,token:loginResults[0].data.token});
assert.equal(incomplete.ok,false);
const matchDone=await loginBatch({action:'attempt.match.complete',payload:{attemptId:matchActive.data.attemptId,revision:matchActive.data.state.revision,moves:matchMoves},requestId:'match-complete-request',ticket:loginTicket,token:loginResults[0].data.token});
assert.equal(matchDone.ok,true);assert(['completed','review'].includes(matchDone.data.status));

const requestedIntermediate=QUIZ_BANK50.intermediate.eventMap.map(event=>QUIZ_BANK50.intermediate.questions.find(q=>q.eventId===event.eventId).id);
const requestedPrepared=await loginBatch({action:'attempt.prepare',payload:{mode:'intermediate',questionIds:requestedIntermediate,restart:true},requestId:'requested-quiz-prepare',ticket:loginTicket,token:loginResults[0].data.token});
assert.equal(requestedPrepared.ok,true);assert.deepEqual(requestedPrepared.data.state.originalSequence,requestedIntermediate);
assert.equal(requestedPrepared.data.state.localQuestions.length,10);
assert(requestedPrepared.data.state.localQuestions.filter(q=>q.image).every(q=>q.prompts[0]===''));
const requestedActive=await loginBatch({action:'attempt.activate',payload:{attemptId:requestedPrepared.data.attemptId,revision:requestedPrepared.data.state.revision},requestId:'requested-quiz-activate',ticket:loginTicket,token:loginResults[0].data.token});
const requestedAnswers=new Map(requestedActive.data.state.localQuestions.map(q=>[q.id,q.answers[0]]));
const requestedComplete=await loginBatch({action:'attempt.quiz.complete',payload:{attemptId:requestedActive.data.attemptId,revision:requestedActive.data.state.revision,submissions:requestedActive.data.state.originalSequence.map(questionId=>({questionId,answer:requestedAnswers.get(questionId)}))},requestId:'requested-quiz-complete',ticket:loginTicket,token:loginResults[0].data.token});
assert.equal(requestedComplete.ok,true);assert(['completed','review'].includes(requestedComplete.data.status));

let connection=await loginBatch({action:'attempt.prepare',payload:{mode:'connections',variant:'basic',restart:true},requestId:'connection-prepare',ticket:loginTicket,token:loginResults[0].data.token});
assert.equal(connection.ok,true);assert.equal(connection.data.state.connectionVersion,2);assert.equal(connection.data.state.connectionTotal,5);
connection=await loginBatch({action:'attempt.activate',payload:{attemptId:connection.data.attemptId,revision:connection.data.state.revision},requestId:'connection-activate',ticket:loginTicket,token:loginResults[0].data.token});
for(let round=0;round<5;round++){
  connection=await loginBatch({action:'attempt.board.submit',payload:{attemptId:connection.data.attemptId,revision:connection.data.state.revision,placements:{middle:connection.data.state.connectionRound.middle}},requestId:`connection-round-${round+1}`,ticket:loginTicket,token:loginResults[0].data.token});
  assert.equal(connection.ok,true);
}
assert(['completed','review'].includes(connection.data.status));assert.equal(connection.data.state.connectionDone.length,5);
let advancedConnection=await loginBatch({action:'attempt.prepare',payload:{mode:'connections',variant:'advanced',restart:true},requestId:'connection-advanced-prepare',ticket:loginTicket,token:loginResults[0].data.token});
assert.equal(advancedConnection.ok,true);assert.equal(advancedConnection.data.state.connectionTotal,5);
advancedConnection=await loginBatch({action:'attempt.activate',payload:{attemptId:advancedConnection.data.attemptId,revision:advancedConnection.data.state.revision},requestId:'connection-advanced-activate',ticket:loginTicket,token:loginResults[0].data.token});
for(let round=0;round<5;round++){
  const expected=advancedConnection.data.state.connectionRound;
  advancedConnection=await loginBatch({action:'attempt.board.submit',payload:{attemptId:advancedConnection.data.attemptId,revision:advancedConnection.data.state.revision,placements:{previous:expected.previous,next:expected.next}},requestId:`connection-advanced-round-${round+1}`,ticket:loginTicket,token:loginResults[0].data.token});
  assert.equal(advancedConnection.ok,true);
}
assert(['completed','review'].includes(advancedConnection.data.status));assert.equal(advancedConnection.data.state.connectionDone.length,5);
const loginStats=loginStore.stats();
assert(loginStats.loads<=3);

console.log(JSON.stringify({legacy:legacyStats,legacyBusy:legacyResults.filter(result=>result.code==='BUSY').length,batch:batchStats,batchBusy:0,bootstrap:'database-free',classroomFlow:{...loginStats,logins:30,prepared:30,activated:30,quizCompleted:30,matchingCompleted:1,adminDenied:true,stolenAttemptDenied:true}}));
