/* v4.3 fast path: play learning quizzes locally; verify one transcript at completion. */
(function(){'use strict';
 const quizModes=new Set(['beginner','intermediate']);
 const prepared=new Map(),preparing=new Map(),activating=new Map(),cancelledQuizAttempts=new Set(),abandoningQuizAttempts=new Map();
 let ownerToken='';
 const key=(mode,options={})=>mode==='matching'?`${mode}:${options.variant||matchMode2}:${options.setCount||matchSets2}`:mode;
 const supported=a=>a?.status==='prepared'&&(quizModes.has(a.mode)?Array.isArray(a.state?.localQuestions):a.mode!=='matching'||a.state?.cards?.every(c=>c.matchKey&&c.eventId!==undefined));
 function abandonQuizAttempt(a){
  if(!a?.attemptId||String(a.attemptId).startsWith('local-'))return Promise.resolve(null);
  const id=a.attemptId;if(abandoningQuizAttempts.has(id))return abandoningQuizAttempts.get(id);
  const task=api42.request('attempt.abandon',{attemptId:id,revision:a.state?.revision||0},{maxAttempts:2,timeoutMs:5000}).catch(()=>null).finally(()=>abandoningQuizAttempts.delete(id));
  abandoningQuizAttempts.set(id,task);return task;
 }
 async function prepare(mode,options={}){
  if(!state42||!api42.session||!state42.visibility?.game||!state42.allowed)return null;
  if(!state42.testOnly&&!state42.unlocked?.[mode])return null;
  const k=key(mode,options);if(prepared.has(k))return prepared.get(k);if(preparing.has(k))return preparing.get(k);
  const task=api42.request('attempt.prepare',{mode,...options},{maxAttempts:2,timeoutMs:12000}).then(a=>{if(!supported(a)){const e=Error('서버와 게임 버전이 맞지 않습니다. 화면을 새로고침해 주세요.');e.code='SERVER_VERSION_MISMATCH';throw e}prepared.set(k,a);return a}).finally(()=>preparing.delete(k));
  preparing.set(k,task);return task;
 }
 function warmMatchingAssets(){return Promise.allSettled([HistoryCards.frameURL('normal'),...Q.map(q=>HistoryContent.image(event41(q.contentRef)))].map(readyAsset41))}
 const applyStateBase=applyState42;
 applyState42=function(s){if(api42.session?.token!==ownerToken){prepared.clear();preparing.clear();activating.clear();ownerToken=api42.session?.token||''}applyStateBase(s);if(!s){prepared.clear();preparing.clear();activating.clear()}};
 const goBase=go;
 go=function(v){goBase(v);if(view!==v||!state42)return;if(v==='matching'){void warmMatchingAssets();prepare('matching',{variant:matchMode2,setCount:matchSets2}).catch(()=>{})}};
 function beginPrepared(a){
  const mode=a.mode,local=clone42(a),now=Date.now();local.clientRequestId='match-'+api42.newRequestId();local.activationPayload={attemptId:a.attemptId,revision:a.state.revision};local.status='active';local.startedAt=new Date(now).toISOString();local.serverNow=now;local.state.runningSince=now;
  if(mode==='matching'){local.state.playAt=now+5000;local.state.open=[];local.state.done=[];local.state.moves=0;local.state.mismatchUntil=0}
  applyAttempt42(local);view=mode;if(mode==='matching'){matchGame.localMoves=[];matchGame.activationPending=true}render42();clock();bonusClock();
  let task;task=api42.request('attempt.activate',local.activationPayload,{requestId:local.clientRequestId+'-activate',maxAttempts:5,timeoutMs:20000}).then(server=>{const live=attempts42[mode];if(live?.attemptId===server.attemptId){live.state.revision=server.state.revision;live.startedAt=server.startedAt;live.expiresAt=server.expiresAt;live.activationError=false;if(mode==='matching'&&matchGame)matchGame.activationPending=false}return server}).catch(error=>{const live=attempts42[mode];if(live?.attemptId===a.attemptId)live.activationError=true;throw error}).finally(()=>{if(activating.get(mode)===task)activating.delete(mode)});
  activating.set(mode,task);void task.catch(()=>{});return local;
 }
 async function startPrepared(mode,options={}){const k=key(mode,options);let a=prepared.get(k);if(!a){toast42('게임을 준비하고 있습니다. 잠시만 기다려 주세요.');a=await prepare(mode,options)}if(!a)throw Error('게임을 준비할 수 없습니다. 연결을 확인해 주세요.');prepared.delete(k);return beginPrepared(a)}
 function localQuizQuestions(mode){
  const source=window.FR42QuizBank50?.[mode];if(!source?.questions||!source?.eventMap)throw Error('최종 문제은행을 불러오지 못했습니다. 화면을 새로고침해 주세요.');
  return source.eventMap.map(event=>{const choices=source.questions.filter(q=>q.eventId===event.eventId),q=choices[Math.floor(Math.random()*choices.length)],type=choices.indexOf(q)+1;return{id:q.id,eventId:q.eventId,type,prompts:[q.prompt],answers:q.acceptedAnswers.slice(),answerLabel:q.answerTitle,image:q.imageUsed?(q.image||event.image):null,hints:[q.round2Hint,q.round3Hint]}}).sort(()=>Math.random()-.5);
 }
 function registerLocalQuiz(local){
  const mode=local.mode,questionIds=local.state.originalSequence.slice(),tempId=local.attemptId;
  const requestBase=local.clientRequestId||(local.clientRequestId=local.attemptId);
  let task;task=(async()=>{
   const ready=await api42.request('attempt.prepare',{mode,questionIds,restart:true},{requestId:requestBase+'-prepare',maxAttempts:2,timeoutMs:12000});
   if(cancelledQuizAttempts.has(tempId)){await abandonQuizAttempt(ready);return ready}
   const server=await api42.request('attempt.activate',{attemptId:ready.attemptId,revision:ready.state.revision},{requestId:requestBase+'-activate',maxAttempts:2,timeoutMs:12000});
   if(cancelledQuizAttempts.has(tempId)){await abandonQuizAttempt(server);return server}
   const live=attempts42[mode];if(live?.attemptId!==tempId&&live?.attemptId!==server.attemptId)return server;
   live.attemptId=server.attemptId;live.startedAt=server.startedAt;live.expiresAt=server.expiresAt;live.serverNow=server.serverNow;live.state.revision=server.state.revision;live.activationError=false;if(P[mode])P[mode].run=server.attemptId;return server
  })().catch(error=>{const live=attempts42[mode];if(live?.attemptId===tempId)live.activationError=true;throw error}).finally(()=>{if(activating.get(mode)===task)activating.delete(mode)});
  activating.set(mode,task);void task.catch(()=>{});return task;
 }
 function startLocalQuiz(mode){
  const questions=localQuizQuestions(mode),sequence=questions.map(q=>q.id),now=Date.now(),attemptId='local-'+api42.newRequestId();
  const state={v26:true,questionBankVersion:2,practice:!!state42.testOnly,revision:0,errors:0,hints:0,checks:0,history:[],slots:[],deck:[],moves:0,pos:0,phase:'first',passed:{},totalAttempts:{},retryRounds:{},roundAttempts:0,result:'',first:0,successIds:[],correctAnswers:0,answerStreak:0,maxStreak:0,variant:'basic',sequence:sequence.slice(),originalSequence:sequence.slice(),localQuestions:questions,runningSince:now};
  const local={attemptId,clientRequestId:attemptId,mode,status:'active',startedAt:new Date(now).toISOString(),expiresAt:new Date(now+86400000).toISOString(),serverNow:now,state};applyAttempt42(local);view=mode;render42();clock();bonusClock();registerLocalQuiz(local);return local;
 }
 async function awaitActivation(mode){
  const task=activating.get(mode);if(task)try{await task}catch{}
  let a=attempts42[mode];
  if(mode==='matching'&&a&&(a.activationError||a.state.revision<1)){const server=await api42.request('attempt.activate',{attemptId:a.attemptId,revision:a.state.revision},{maxAttempts:5,timeoutMs:20000});if(attempts42[mode]?.attemptId===server.attemptId){a=attempts42[mode];a.state.revision=server.state.revision;a.startedAt=server.startedAt;a.expiresAt=server.expiresAt;a.activationError=false;if(matchGame)matchGame.activationPending=false}}
  else if(a?.activationError||String(a?.attemptId||'').startsWith('local-')){a.activationError=false;await registerLocalQuiz(a);a=attempts42[mode]}
  if(!a||a.status!=='active'||a.state.revision<1){const e=Error('게임 시작 확인이 끝나지 않았습니다. 다시 시도해 주세요.');e.code='ACTIVATION_REQUIRED';throw e}return a;
 }
 const startBase=start;
 start=function(mode){if(!quizModes.has(mode))return startBase(mode);if(activating.has(mode)||attempts42[mode]?.status==='active')return;try{return startLocalQuiz(mode)}catch(error){toast42(error.message)}};
 const startMatchingBase=startMatching;
 startMatching=function(variant=matchMode2,setCount=matchSets2){if(activating.has('matching'))return;void warmMatchingAssets();const options={variant,setCount},a=prepared.get(key('matching',options));return a?startPrepared('matching',options):run42(()=>startPrepared('matching',options))};
 const retryGameBase43=retryGame2;
 retryGame2=function(mode){if(mode!=='matching')return retryGameBase43(mode);const s=attempts42.matching?.state||matchGame||{},options={variant:s.variant||matchMode2,setCount:s.setCount||matchSets2};return prepared.has(key('matching',options))?startPrepared('matching',options):run42(()=>startPrepared('matching',options))};
 const bonusNowBase43=bonusNow;
 bonusNow=function(s){return s===matchGame&&s?.submitting?Number(s.finishedMs)||0:bonusNowBase43(s)};
 const flipBase=flipMatch;
 flipMatch=function(index){
  if(!matchGame?.cards?.every(c=>c.matchKey))return flipBase(index);
  if(matchGame.preview||matchGame.submitting||matchGame.done.includes(index)||matchGame.open.includes(index)||matchGame.lock)return;
  matchGame.open.push(index);if(matchGame.open.length===1){render42();return}
  const [first,second]=matchGame.open;matchGame.lock=true;matchGame.moves++;matchGame.localMoves.push({first,second});const same=matchGame.cards[first].matchKey===matchGame.cards[second].matchKey;
  if(same){matchGame.done.push(first,second);matchGame.open=[];matchGame.lock=false;if(matchGame.done.length===matchGame.cards.length){const completed=matchGame,options={variant:completed.variant,setCount:completed.setCount};completed.finishedMs=bonusNowBase43(completed);completed.submitting=true;if(window.HistoryNormalCompletion&&!state42?.testOnly){void window.HistoryNormalCompletion.submitMatching(attempts42.matching,completed);return}render42();run42(async()=>{await awaitActivation('matching');const out=await api42.request('attempt.match.complete',payload42('matching',{moves:completed.localMoves}));applyState42(out.student);applyAttempt42(out);render42();void prepare('matching',options).catch(()=>{})});return}render42();return}
  render42();const current=matchGame;setTimeout(()=>{if(matchGame===current&&!current.submitting){current.open=[];current.lock=false;render42()}},700);
 };
 const stopGameBase43=stopGame2;
 stopGame2=function(mode,nextView){
  if(!quizModes.has(mode)&&mode!=='matching')return stopGameBase43(mode,nextView);
  const current=active2(mode);if(!current)return;
  if(!confirm('현재 진행은 저장되지 않습니다. 게임을 중단할까요?'))return;
  const tempId=current.attemptId,pendingActivation=activating.get(mode);
  cancelledQuizAttempts.add(tempId);
  if(pendingActivation){activating.delete(mode);const cleanup=mode==='matching'?pendingActivation.then(abandonQuizAttempt):pendingActivation;void cleanup.finally(()=>cancelledQuizAttempts.delete(tempId)).catch(()=>{})}
  else{void abandonQuizAttempt(current);cancelledQuizAttempts.delete(tempId)}
  delete attempts42[mode];if(Array.isArray(state42?.pendingAttempts))state42.pendingAttempts=state42.pendingAttempts.filter(x=>x.mode!==mode&&x.attemptId!==tempId);
  if(quizModes.has(mode))P[mode]=freshQ(mode);else matchGame=null;stage2Dialog=null;view=nextView||(quizModes.has(mode)?'results':'bonus');render42();clock();bonusClock();
 };
 window.HistoryV43Speed={prepare,awaitActivation};
 const logoutBase=logout42;logout42=async function(){prepared.clear();preparing.clear();activating.clear();ownerToken='';return logoutBase()};
})();
