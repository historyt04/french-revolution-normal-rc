const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {test}=require('node:test');

test('compact completion opens intermediate immediately and keeps the result screen',async()=>{
 const state={profile:{id:'local-student'},completed:{beginner:false},unlocked:{beginner:true,intermediate:false},best:{},packs:[]};
 const attempts={beginner:{attemptId:'local-attempt',mode:'beginner',status:'pending',startedAt:'2026-09-29T00:00:00Z',state:{originalSequence:[1,2],localQuestions:[{id:1},{id:2}],first:2,practice:false}}};
 let shown=null,cached=0,refreshed=0;
 class Store{}
 class Queue{constructor(options){this.options=options}}
 const context={window:{HistoryNormalOutbox:{IndexedCompletionStore:Store,CompletionQueue:Queue}},HistoryNormalOutbox:{IndexedCompletionStore:Store,CompletionQueue:Queue},HISTORY_API_CONFIG:{rcUrl:'local',rcStorageScope:'fixture'},api42:{session:null},state42:state,attempts42:attempts,applyAttempt42:a=>{shown=a;attempts[a.mode]=a},applyState42:()=>{},writeStateCache42:()=>{cached++},refresh42:async()=>{refreshed++},render42:()=>{},begin42:()=>{},start:()=>{},startMatching:()=>{},retryGame2:()=>{},decorateStage2Body:x=>x,result42:()=>'',check:()=>{},submitBoard26:()=>{},submitTimed26:()=>{},checkFace:()=>{},addEventListener:()=>{},setTimeout,clearTimeout,view:'beginner',escape41:x=>x,label2:{beginner:'초급'},busy42:false};
 vm.createContext(context);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'..','normal-rc-client.js'),'utf8'),context);
 const response={attemptId:'local-attempt',mode:'beginner',status:'completed',startedAt:'2026-09-29T00:00:00Z',serverNow:Date.parse('2026-09-29T00:00:10Z'),outcome:{finishedMs:10000,official:true,first:2,hints:0},completion:{success:true,completedStage:'beginner',newlyUnlocked:['intermediate'],rewards:{granted:true,message:'일반팩 1개',cards:[],packs:[{packId:'basic',count:1}]},completionCount:1,bestMs:10000,duplicate:false}};
 context.applyAttempt42(response);
 assert.equal(state.completed.beginner,true);assert.equal(state.unlocked.intermediate,true);assert.equal(state.packs[0].count,1);assert.equal(state.best.beginner,10000);assert.equal(shown.state.originalSequence.length,2);assert.equal(shown.completionReward.packs[0].count,1);assert(cached>0);
 context.applyAttempt42({...response,completion:{...response.completion,duplicate:true}});
 assert.equal(state.packs[0].count,1,'a replay must not double the visible pack balance');
 await new Promise(resolve=>setImmediate(resolve));assert(refreshed>0);
});
