/* Normal RC data path. Kept separate from the requested later menu/question UI changes. */
(function(){'use strict';
 if(!window.HistoryNormalOutbox)return;
 const namespace=HISTORY_API_CONFIG.rcUrl+'|'+HISTORY_API_CONFIG.rcStorageScope;
 const owner=()=>{const id=api42.session?.user?.id;return id&&api42.session?.role==='student'&&!api42.session?.testOnly&&!state42?.testOnly&&state42?.profile?.id===id?namespace+'|'+id:null};
 const rewardTrackers=new Map();
 function trackAsyncReward(jobId,attemptId){
  const scope=owner();if(!scope||!window.HistoryAsyncRewardStatus||
    typeof jobId!=='string'||!/^[A-Za-z0-9_-]{12,100}$/.test(jobId)||
    rewardTrackers.has(jobId))return;
  const controller=HistoryAsyncRewardStatus.create({
   readStatus:id=>api42.request('completion.reward.status',{jobId:id},{maxAttempts:1}),
   visible:()=>!document.hidden,
   onChange:({state,result,settlement})=>{
    if(owner()!==scope)return;
    const a=Object.values(attempts42).find(value=>value?.attemptId===attemptId);
    if(!a)return;
    if(state==='done'&&result){
     a.completionReward=result;a.state.rewardResult=result;a.rewardStatus='done';
     if(settlement&&Object.hasOwn(settlement,'xp'))a.state.xpResult=settlement.xp;
     if(Array.isArray(settlement?.study))a.state.studyRewards=settlement.study;
     rewardTrackers.delete(jobId);render42();
     // Attendance was verified by login/day readiness. Refresh the committed
     // inventory without another attendance mutation competing with rewards.
     void refresh42({claimAttendance:false}).then(render42).catch(()=>{});
    }else if(state==='waiting'||state==='dead'){
     a.rewardStatus=state;
     a.completionReward={granted:false,reason:'pending',
       message:'보상 확인이 지연되고 있습니다. 완료 기록과 다음 단계는 유지됩니다.',cards:[],packs:[]};
     render42();
    }
   }
  });
  rewardTrackers.set(jobId,controller);controller.begin(scope,jobId);
 }
 window.HistoryAsyncCompletionReward={retry(){for(const controller of rewardTrackers.values())controller.retry()}};
 // A later card/mission menu visit may happen after automatic status checks
 // stop. Recheck that existing job with a cooldown; never resend completion.
 if(typeof go==='function'){
  const goForReward=go;let lastMenuRewardCheck=0;
  go=function(v){const before=view,result=goForReward(v);
   if(owner()&&before!==view&&view===v&&
      (v==='collection'||v==='missions')&&
      Date.now()-lastMenuRewardCheck>=30000){
    let checked=false;
    for(const controller of rewardTrackers.values())
     if(['waiting','dead'].includes(controller.snapshot?.().state))
      checked=controller.retry()||checked;
    if(checked)lastMenuRewardCheck=Date.now();
   }
   return result;
  };
 }
 const applyFullAttempt=applyAttempt42;
 applyAttempt42=function(result){
  if(!result?.completion)return applyFullAttempt(result);
  const previous=attempts42[result.mode],change=result.completion;
  if(state42){
   if(change.completedStage)state42.completed[change.completedStage]=true;
   for(const mode of change.newlyUnlocked||[])state42.unlocked[mode]=true;
   if(change.bestMs!==null&&change.bestMs!==undefined)state42.best[result.mode]=change.bestMs;
   if(result.rewardStatus!=='pending'&&!change.duplicate)for(const reward of change.rewards?.packs||[]){let held=state42.packs.find(pack=>pack.packId===reward.packId);if(!held){held={id:state42.profile.id+':fr-revolution:'+reward.packId,studentId:state42.profile.id,unitId:'fr-revolution',packId:reward.packId,count:0};state42.packs.push(held)}held.count+=reward.count}
   writeStateCache42(state42);
  }
  if(!previous?.state){if(result.rewardStatus==='pending')trackAsyncReward(result.rewardJobId,result.attemptId);void refresh42().then(render42).catch(()=>{});return}
  const reward=result.rewardStatus==='pending'
   ?{granted:false,reason:'pending',message:'보상 계산 중 · 완료 기록과 다음 단계는 저장되었습니다.',cards:[],packs:[]}
   :change.rewards;
  const state={...previous.state,...result.outcome,rewardResult:reward,status:result.status},view={...previous,...result,state,completionReward:reward};
  applyFullAttempt(view);
  if(result.rewardStatus==='pending')trackAsyncReward(result.rewardJobId,result.attemptId);
  // The verified completion delta already updates the visible result/unlock.
  // Settlement refreshes canonical state once, after its XP/cards are stored.
  if(result.rewardStatus!=='pending')void refresh42().then(render42).catch(()=>{});
 };
 const store=new HistoryNormalOutbox.IndexedCompletionStore('history-normal-completions-v1'); const notices=new Map();let retryTimer=null,loading=true,loadingPromise=null,loadedOwner='';
 const queue=new HistoryNormalOutbox.CompletionQueue({store,owner,request:(...args)=>api42.request(...args),
  onChange(row){notices.set(row.id,row);const a=attempts42[row.mode];if(a?.clientRequestId===row.clientId){a.syncStatus=row.status;a.syncError=row.lastError||'';if(state42)render42()}schedule()},
  onConfirmed(row,result){const a=attempts42[row.mode];if(!a||a.clientRequestId===row.clientId||a.attemptId===row.active?.attemptId){
   // Atomic completion carries a verified completion delta and an empty
   // student envelope. Keep the current profile until the full refresh.
   if(!(result.completion&&result.student&&Object.keys(result.student).length===0))applyState42(result.student);
   applyAttempt42(result);render42()}else if(state42){void refresh42().then(()=>render42()).catch(()=>{})}}
 });
 function schedule(){clearTimeout(retryTimer);const who=owner(),now=Date.now(),rows=[...notices.values()].filter(r=>r.owner===who&&r.status==='pending');if(who&&rows.length){const delay=Math.max(250,Math.min(...rows.map(r=>Math.max(0,(Number(r.nextRetryAt)||now+4000)-now))));retryTimer=setTimeout(()=>{void queue.flush().catch(showStorageError)},delay)}}
 function showStorageError(){toast42('기기에 완료 기록을 보관하지 못했습니다. 이 화면을 닫지 말고 저장을 다시 시도해 주세요.')} async function load(force=false){const who=owner();if(!who){loading=false;return}if(loadingPromise)return loadingPromise;if(!force&&loadedOwner===who){loading=false;schedule();return}loadingPromise=(async()=>{try{for(const r of await queue.rows())notices.set(r.id,r);loadedOwner=who;loading=false;schedule();void queue.flush().catch(showStorageError)}catch{loading=false;showStorageError()}finally{loadingPromise=null}})();return loadingPromise} function pending(){return Object.values(attempts42).some(a=>a.unsavedCompletion||a.syncStatus==='saving')||[...notices.values()].some(r=>r.owner===owner()&&r.status==='pending')}
 function canStart(){if(loading||pending()){toast42('앞 게임의 완료 기록을 먼저 서버에 확인하고 있습니다. 저장 상태를 확인해 주세요.');return false}return true}
 const applyStateBase=applyState42;applyState42=function(s){applyStateBase(s);if(owner())void load()};
 const beginBase=begin42;begin42=function(...args){if(canStart())return beginBase(...args)};
 const startBase=start;start=function(...args){if(canStart())return startBase(...args)};
 const matchingBase=startMatching;startMatching=function(...args){if(canStart())return matchingBase(...args)};
 const retryBase=retryGame2;retryGame2=function(...args){if(canStart())return retryBase(...args)};
 const decorateBase=decorateStage2Body;decorateStage2Body=function(html){const a=attempts42[view];if(a?.syncStatus&&a.syncStatus!=='confirmed')return `<section class="shell quiz center" aria-live="polite"><h2>${escape41(label2[a.mode]||a.mode)} 학습 완료</h2><p>${a.syncStatus==='saving'?'이 기기에 완료 기록을 보관하고 있습니다.':a.syncStatus==='blocked'?'완료 답안을 보관했습니다. 서버 확인이 필요합니다.':'이 기기에 완료 기록을 보관했습니다. 서버에 저장 중입니다.'}</p><p>서버가 확인한 뒤 기록과 보상이 반영됩니다.</p>${a.syncError?`<p>확인 상태: ${escape41(a.syncError)}</p>`:''}<div class="bonus-actions"><button class="btn" onclick="HistoryNormalCompletion.retry()">저장 다시 확인</button><button class="btn alt" onclick="go('results')">게임 선택으로</button></div></section>`;return decorateBase(html)};
 const resultBase=result42;result42=function(){const rows=[...notices.values()].filter(r=>r.owner===owner()&&r.status!=='confirmed');return (rows.length?`<section class="shell" role="status"><h2>완료 기록 ${rows.length}건 확인 중</h2><p>이 기기에 보관된 답안을 같은 학생으로 접속하면 다시 전송합니다.</p><button class="btn alt" onclick="HistoryNormalCompletion.retry()">저장 다시 확인</button></section>`:'')+resultBase()};
 async function submitQuiz(a){
  if(state42?.testOnly)return false;
  const clientId=a.clientRequestId||(a.clientRequestId='complete-'+api42.newRequestId());
  const input={clientId,mode:a.mode,action:'attempt.quiz.complete',payload:{submissions:clone42(a.localSubmissions)},...(clientId.startsWith('local-')?{prepare:{mode:a.mode,questionIds:a.state.originalSequence.slice(),restart:true}}:{active:{attemptId:a.attemptId,revision:a.state.revision}})};
  a.syncStatus='saving';a.status='pending';render42();
  try{await queue.enqueue(input);void queue.flush().catch(showStorageError)}catch{a.syncStatus='saving';a.unsavedCompletion=input;showStorageError();render42()}
  return true;
 }
 async function submitMatching(a,completed){
  const clientId=a.clientRequestId||(a.clientRequestId='match-'+api42.newRequestId());
  const input={clientId,mode:'matching',action:'attempt.match.complete',payload:{moves:clone42(completed.localMoves)},...(a.activationPayload?{activation:clone42(a.activationPayload)}:{active:{attemptId:a.attemptId,revision:a.state.revision}})};
  a.syncStatus='saving';a.status='pending';render42();
  try{await queue.enqueue(input);void queue.flush().catch(showStorageError)}catch{a.unsavedCompletion=input;showStorageError();render42()}
 } async function retry(){for(const a of Object.values(attempts42)){if(a.unsavedCompletion){try{await queue.enqueue(a.unsavedCompletion);delete a.unsavedCompletion}catch{showStorageError();return}}}try{await load(true);await queue.retryBlocked();await queue.flush(true)}catch{showStorageError()}}
 async function submitDecision(mode,action,payload){
  const a=attempts42[mode];if(!a||a.status!=='active'||a.syncStatus&&a.syncStatus!=='confirmed')return;
  const clientId='decision-'+api42.newRequestId();a.clientRequestId=clientId;
  const input={clientId,mode,action,payload:clone42(payload),active:{attemptId:a.attemptId,revision:a.state.revision}};
  a.syncStatus='saving';a.status='pending';render42();
  try{await queue.enqueue(input);void queue.flush().catch(showStorageError)}catch{a.unsavedCompletion=input;showStorageError();render42()}
 }
 const checkBase=check;check=function(mode){if(state42?.testOnly)return checkBase(mode);return submitDecision(mode,'attempt.order',{slots:clone42(P[mode].slots)})};
 const boardBase=submitBoard26;submitBoard26=function(mode){if(state42?.testOnly)return boardBase(mode);return submitDecision(mode,'attempt.board.submit',{placements:clone42(attempts42[mode].state.placements)})};
 const timedBase=submitTimed26;submitTimed26=function(mode,explicit){if(state42?.testOnly)return timedBase(mode,explicit);const s=gameObject2(mode);if(busy42||!s||s.slots.some(x=>!x)||!explicit&&state42.learning26.submission[mode]!=='auto')return;return submitDecision(mode,'attempt.order',{slots:clone42(s.slots),submission:explicit?'confirm':'auto'})};
 const faceBase=checkFace;checkFace=function(){if(state42?.testOnly)return faceBase();return submitDecision('faceoff','attempt.order',{slots:clone42(face.board)})};
 // These submissions may need another answer. Announce receipt, not a passed game.
 const decisionDecorate=decorateStage2Body;decorateStage2Body=function(html){const a=attempts42[view];let out=decisionDecorate(html);if(a?.clientRequestId?.startsWith('decision-')&&a.syncStatus&&a.syncStatus!=='confirmed')out=out.replace('학습 완료</h2>','답안 제출 완료</h2>').replaceAll('완료 기록','제출 답안');return out};
 window.HistoryNormalCompletion={submitQuiz,submitMatching,retry};
 addEventListener('beforeunload',event=>{if(Object.values(attempts42).some(a=>a.unsavedCompletion||a.syncStatus==='saving')){event.preventDefault();event.returnValue=''}}); addEventListener('online',()=>void load(true).then(()=>queue.flush(true)).catch(showStorageError));addEventListener('history-session-changed',()=>{for(const controller of rewardTrackers.values())controller.stop();rewardTrackers.clear();loading=true;loadingPromise=null;loadedOwner='';notices.clear();clearTimeout(retryTimer);if(owner())void load();else loading=false});
 if(typeof document!=='undefined')document.addEventListener('visibilitychange',()=>{if(!document.hidden)for(const controller of rewardTrackers.values())controller.resume()});
 addEventListener('history-login-verified',()=>{const status=document.querySelector('#connection42');if(status)status.textContent='학생 확인 완료 · 출석과 학습 상태를 불러옵니다.'});
 if(owner())void load();else loading=false;
})();
