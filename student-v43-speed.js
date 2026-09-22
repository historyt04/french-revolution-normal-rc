/* v4.3: prepare attempts before play, then verify complete transcripts once on the server. */
(function(){'use strict';
 const quizModes=new Set(['beginner','intermediate']);
 const prepared=new Map(),preparing=new Map(),activating=new Map();
 let scheduled=false,ownerToken='';
 const key=(mode,options={})=>mode==='matching'?`${mode}:${options.variant||matchMode2}:${options.setCount||matchSets2}`:mode;
 const supported=a=>a?.status==='prepared'&&(quizModes.has(a.mode)?Array.isArray(a.state?.localQuestions):a.mode!=='matching'||a.state?.cards?.every(c=>c.matchKey&&c.eventId!==undefined));
 async function prepare(mode,options={}){
  if(!state42||!api42.session||!state42.visibility?.game||!state42.allowed)return null;
  if(!state42.testOnly&&!state42.unlocked?.[mode])return null;
  const k=key(mode,options);if(prepared.has(k))return prepared.get(k);if(preparing.has(k))return preparing.get(k);
  const task=api42.request('attempt.prepare',{mode,...options}).then(a=>{if(!supported(a)){const e=Error('서버와 게임 버전이 맞지 않습니다. 화면을 새로고침해 주세요.');e.code='SERVER_VERSION_MISMATCH';throw e}prepared.set(k,a);return a}).finally(()=>preparing.delete(k));
  preparing.set(k,task);return task;
 }
 function warmMatchingAssets(){return Promise.allSettled([HistoryCards.frameURL('normal'),...Q.map(q=>HistoryContent.image(event41(q.contentRef)))].map(readyAsset41))}
 function schedule(){if(scheduled||!state42)return;scheduled=true;setTimeout(()=>{prepare('beginner').catch(()=>{});if(state42?.unlocked?.intermediate)setTimeout(()=>prepare('intermediate').catch(()=>{}),180)},0)}
 const applyStateBase=applyState42;
 applyState42=function(s){if(api42.session?.token!==ownerToken){prepared.clear();preparing.clear();activating.clear();scheduled=false;ownerToken=api42.session?.token||''}applyStateBase(s);if(s){scheduled=false;schedule()}else{prepared.clear();preparing.clear();activating.clear();scheduled=false}};
 const goBase=go;
 go=function(v){goBase(v);if(view!==v||!state42)return;if(quizModes.has(v))prepare(v).catch(()=>{});if(v==='matching'){void warmMatchingAssets();prepare('matching',{variant:matchMode2,setCount:matchSets2}).catch(()=>{})}};
 function beginPrepared(a,options={}){
  const mode=a.mode,local=clone42(a),now=Date.now();local.status='active';local.startedAt=new Date(now).toISOString();local.serverNow=now;local.state.runningSince=now;
  if(mode==='matching'){local.state.playAt=now+5000;local.state.open=[];local.state.done=[];local.state.moves=0;local.state.mismatchUntil=0}
  applyAttempt42(local);view=mode;if(mode==='matching'){matchGame.localMoves=[];matchGame.activationPending=true}render42();clock();bonusClock();
  const task=api42.request('attempt.activate',{attemptId:a.attemptId,revision:a.state.revision}).then(server=>{const live=attempts42[mode];if(live?.attemptId===server.attemptId){live.state.revision=server.state.revision;live.startedAt=server.startedAt;live.expiresAt=server.expiresAt;if(mode==='matching'&&matchGame)matchGame.activationPending=false}return server}).catch(error=>{const live=attempts42[mode];if(live?.attemptId===a.attemptId){delete attempts42[mode];if(mode==='matching')matchGame=null;if(quizModes.has(mode))P[mode]=freshQ(mode);toast42('게임 시작을 서버에서 확인하지 못했습니다. 다시 시도해 주세요.');render42()}throw error}).finally(()=>activating.delete(mode));
  activating.set(mode,task);void task.catch(()=>{});return local;
 }
 async function awaitActivation(mode){const task=activating.get(mode);if(task)await task;const a=attempts42[mode];if(!a||a.status!=='active'||a.state.revision<1){const e=Error('게임 시작 확인이 끝나지 않았습니다. 다시 시도해 주세요.');e.code='ACTIVATION_REQUIRED';throw e}return a}
 async function startPrepared(mode,options={}){const k=key(mode,options);let a=prepared.get(k);if(!a){toast42('게임을 준비하고 있습니다. 잠시만 기다려 주세요.');a=await prepare(mode,options)}if(!a)throw Error('게임을 준비할 수 없습니다. 연결을 확인해 주세요.');prepared.delete(k);return beginPrepared(a,options)}
 const startBase=start;
 start=function(mode){if(!quizModes.has(mode))return startBase(mode);if(activating.has(mode))return;const a=prepared.get(key(mode));return a?startPrepared(mode):run42(()=>startPrepared(mode))};
 const startMatchingBase=startMatching;
 startMatching=function(variant=matchMode2,setCount=matchSets2){if(activating.has('matching'))return;void warmMatchingAssets();const options={variant,setCount},a=prepared.get(key('matching',options));return a?startPrepared('matching',options):run42(()=>startPrepared('matching',options))};
 const flipBase=flipMatch;
 flipMatch=function(index){
  if(!matchGame?.cards?.every(c=>c.matchKey))return flipBase(index);
  if(matchGame.preview||matchGame.submitting||matchGame.done.includes(index)||matchGame.open.includes(index)||matchGame.lock)return;
  matchGame.open.push(index);
  if(matchGame.open.length===1){render42();return}
  const [first,second]=matchGame.open;matchGame.lock=true;matchGame.moves++;matchGame.localMoves.push({first,second});const same=matchGame.cards[first].matchKey===matchGame.cards[second].matchKey;
  if(same){matchGame.done.push(first,second);matchGame.open=[];matchGame.lock=false;render42();if(matchGame.done.length===matchGame.cards.length){matchGame.submitting=true;run42(async()=>{await awaitActivation('matching');const out=await api42.request('attempt.match.complete',payload42('matching',{moves:matchGame.localMoves}));applyState42(out.student);applyAttempt42(out);render42()})}return}
  render42();const current=matchGame;setTimeout(()=>{if(matchGame===current&&!current.submitting){current.open=[];current.lock=false;render42()}},700);
 };
 window.HistoryV43Speed={prepare,awaitActivation};
 const logoutBase=logout42;logout42=async function(){prepared.clear();preparing.clear();activating.clear();scheduled=false;ownerToken='';return logoutBase()};
 schedule();
})();
