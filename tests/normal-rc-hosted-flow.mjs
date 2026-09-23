// Real hosted-server flow using the deployed client's transport and completion queue.
// This is NOT a 30-browser visual test. Pair results with student UI observations.
// Requires a JSON export from the EXISTING authenticated teacher registration UI.
// Never generates accounts or bypasses authentication. Never prints credentials.
import fs from 'node:fs/promises';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {CompletionQueue}=require('../normal-rc-outbox.js');
const root=new URL('../',import.meta.url);
const origin='https://historyt04.github.io';
const site=origin+'/french-revolution-normal-rc/';
const endpoint='https://mrrvuknoxkpowlqcwahk.supabase.co/functions/v1/history-normal-rc-api';
const runId=process.env.RC_RUN_ID;
if(!/^[a-zA-Z0-9-]{8,40}$/.test(runId||'')||!process.env.RC_TEST_CREDENTIALS_FILE)throw Error('Set RC_RUN_ID and RC_TEST_CREDENTIALS_FILE to the privately downloaded test roster.');
const credentials=JSON.parse(await fs.readFile(process.env.RC_TEST_CREDENTIALS_FILE,'utf8'));
assert(credentials.length>=30,'30 authorized fixture accounts required');
const fixtures=credentials.slice(0,30);
assert(fixtures.every(x=>x.student.schoolYear===2026&&x.student.grade===2&&x.student.classNo===98&&/^RC시험/.test(x.student.name)&&/^\d{5}$/.test(x.code)),'Only the approved RC fixture class can be used');
const sources={};
for(const name of ['game-api.js','quiz-bank50.js','normal-rc-outbox.js']){
 const response=await fetch(site+name+'?verify='+runId);assert(response.ok,'Deployed client source unavailable');
 const deployed=await response.text(),local=await fs.readFile(new URL(name,root),'utf8');
 assert.equal(crypto.createHash('sha256').update(deployed).digest('hex'),crypto.createHash('sha256').update(local).digest('hex'),'Deployed client differs from checkout: '+name);sources[name]=deployed;
}
const metrics=[];
const storage=()=>{const m=new Map();return{getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}};
function client(cohort){
 const events=new EventTarget();
 const context={URL,URLSearchParams,TextEncoder,AbortController,crypto:crypto.webcrypto,performance,setTimeout,clearTimeout,CustomEvent,
  location:{pathname:'/french-revolution-normal-rc/student-preview.html',hostname:'historyt04.github.io',search:'?rcMetrics=1'},localStorage:storage(),sessionStorage:storage(),
  addEventListener:events.addEventListener.bind(events),dispatchEvent:events.dispatchEvent.bind(events),
  console:{info(message){if(message.startsWith('RC_METRIC '))metrics.push({cohort,...JSON.parse(message.slice(10))})}},
  HISTORY_API_CONFIG:{mode:'supabase-rc',rcUrl:endpoint,rcRegion:'ap-northeast-2',rcStorageScope:'normal-rc-20260923'},
  fetch:(url,options)=>{const parsed=new URL(url);assert.equal(parsed.origin+parsed.pathname,endpoint);return fetch(url,{...options,headers:{...options?.headers,Origin:origin}})}
 };
 context.window=context;vm.createContext(context);vm.runInContext(sources['game-api.js'],context);vm.runInContext(sources['quiz-bank50.js'],context);return{api:context.HistoryGameAPI,bank:context.FR42QuizBank50};
}
class MemoryStore{
 constructor(){this.rows=new Map()}
 async get(id){return structuredClone(this.rows.get(id))}
 async list(owner){return [...this.rows.values()].filter(x=>x.owner===owner).map(x=>structuredClone(x))}
 async put(row){const old=this.rows.get(row.id);if(old?.status==='confirmed')return old;this.rows.set(row.id,structuredClone(row));return row}
}
const identity=x=>({schoolId:'school-01',schoolYear:2026,grade:2,classNo:98,number:x.student.number,code:x.code,rememberDevice:false,deviceName:'Authorized RC flow check'});
const sorted=rows=>[...(rows||[])].sort((a,b)=>String(a.id).localeCompare(String(b.id)));
const inventory=s=>JSON.stringify({cards:sorted(s.cards),packs:sorted(s.packs),variants:sorted(s.collection25?.variants),shards:s.collection25?.shards,completed:s.completed,xp:s.learning26?.total});
const packCount=s=>(s.packs||[]).filter(x=>x.packId==='basic').reduce((n,x)=>n+x.count,0);
async function studentFlow(fixture,index,cohort){
 const {api,bank}=client(cohort),stepTimes={};let step='login';const totalStarted=performance.now();
 const time=async(label,fn)=>{step=label;const t=performance.now();const result=await fn();stepTimes[label]=Math.round(performance.now()-t);return result};
 try{
  const login=await time('loginAttendance',()=>api.login('student',identity(fixture)));assert.equal(login.student.profile.id,fixture.student.id);
  const qids=bank.beginner.eventMap.map(event=>{const choices=bank.beginner.questions.filter(q=>q.eventId===event.eventId);return choices[(index+cohort)%choices.length].id});
  const id=`${runId}-${cohort}-${index}`;
  const prepare=await time('prepare',()=>api.request('attempt.prepare',{mode:'beginner',questionIds:qids,restart:true},{requestId:id+'-prepare'}));
  const active=await time('activate',()=>api.request('attempt.activate',{attemptId:prepare.attemptId,revision:prepare.state.revision},{requestId:id+'-activate'}));
  const answers=qids.map(questionId=>({questionId,answer:bank.beginner.questions.find(q=>q.id===questionId).acceptedAnswers[0]}));
  const store=new MemoryStore();let completed;
  const queue=new CompletionQueue({store,owner:()=>fixture.student.id,request:(...args)=>api.request(...args),onConfirmed:(_,r)=>{completed=r}});
  await time('complete',async()=>{await queue.enqueue({clientId:id,mode:'beginner',action:'attempt.quiz.complete',active:{attemptId:active.attemptId,revision:active.state.revision},payload:{submissions:answers}});await queue.flush();assert(completed,'Completion is still pending or blocked')});
  assert.equal(completed.status,'completed');assert(completed.student.completed.beginner);
  const duplicate=await time('completionReplay',()=>api.request('attempt.quiz.complete',{attemptId:active.attemptId,revision:active.state.revision,submissions:answers},{requestId:id+'-complete'}));
  assert.equal(inventory(duplicate.student),inventory(completed.student),'duplicate completion changed inventory');
  const before=packCount(completed.student);assert(before>=1,'No pack available from configured rewards');
  const opened=await time('openPack',()=>api.request('cards.openPack',{packId:'basic',count:1},{requestId:id+'-pack'}));
  assert.equal(packCount(opened.student),before-1);assert.equal(opened.cards.length,1);
  const replay=await time('packReplay',()=>api.request('cards.openPack',{packId:'basic',count:1},{requestId:id+'-pack'}));
  assert.equal(replay.opening.id,opened.opening.id);assert.equal(inventory(replay.student),inventory(opened.student));
  await time('logout',()=>api.logout());
  const again=await time('reloginAttendance',()=>api.login('student',identity(fixture)));assert.equal(inventory(again.student),inventory(opened.student),'relogin changed saved inventory');
  const records=await time('records',()=>api.request('student.records.read'));
  assert(records,'Record read failed');await api.logout();
  return{ok:true,stepTimes,totalMs:Math.round(performance.now()-totalStarted)};
 }catch(error){return{ok:false,step,code:error.code||error.name||'ERROR',stepTimes,totalMs:Math.round(performance.now()-totalStarted)}}
}
const summary={runId,kind:'hosted-client-module-flow-not-multi-browser',cohorts:[],metrics};
for(const n of [5,15,30]){
 const started=performance.now();const results=await Promise.all(fixtures.slice(0,n).map((x,i)=>studentFlow(x,i,n)));
 summary.cohorts.push({n,durationMs:Math.round(performance.now()-started),results});
 console.log(JSON.stringify({cohort:n,passed:results.filter(x=>x.ok).length,failed:results.filter(x=>!x.ok).length}));
 await fs.writeFile(new URL(`docs/validation/hosted-flow-${runId}.json`,root),JSON.stringify(summary,null,2));
 if(results.some(x=>!x.ok)){process.exitCode=1;break}
}
// A separate 25-login sample is only reached after all complete flows pass.
if(!process.exitCode){const results=await Promise.all(fixtures.slice(0,25).map(async x=>{const {api}=client(25),started=performance.now();try{await api.login('student',identity(x));const durationMs=Math.round(performance.now()-started);await api.logout();return{ok:true,durationMs}}catch(e){return{ok:false,code:e.code||e.name}}}));summary.login25=results;await fs.writeFile(new URL(`docs/validation/hosted-flow-${runId}.json`,root),JSON.stringify(summary,null,2));}
