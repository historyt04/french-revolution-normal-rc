/* Normal RC data path. Kept separate from the requested later menu/question UI changes. */
(function(){'use strict';
 if(!window.HistoryNormalOutbox)return;
 const namespace=HISTORY_API_CONFIG.rcUrl+'|'+HISTORY_API_CONFIG.rcStorageScope;
 const owner=()=>{const id=api42.session?.user?.id;return id&&api42.session?.role==='student'&&!api42.session?.testOnly&&!state42?.testOnly&&state42?.profile?.id===id?namespace+'|'+id:null};
 const store=new HistoryNormalOutbox.IndexedCompletionStore('history-normal-completions-v1');
 const notices=new Map();let retryTimer=null,loading=true;
 const queue=new HistoryNormalOutbox.CompletionQueue({store,owner,request:(...args)=>api42.request(...args),
  onChange(row){notices.set(row.id,row);const a=attempts42[row.mode];if(a?.clientRequestId===row.clientId){a.syncStatus=row.status;a.syncError=row.lastError||'';if(state42)render42()}schedule()},
  onConfirmed(row,result){const a=attempts42[row.mode];if(!a||a.clientRequestId===row.clientId||a.attemptId===row.active?.attemptId){applyState42(result.student);applyAttempt42(result);render42()}else if(state42){void refresh42().then(()=>render42()).catch(()=>{})}}
 });
 function schedule(){clearTimeout(retryTimer);if(owner()&&[...notices.values()].some(r=>r.owner===owner()&&r.status==='pending'))retryTimer=setTimeout(()=>{void queue.flush().catch(showStorageError)},4000)}
 function showStorageError(){toast42('기기에 완료 기록을 보관하지 못했습니다. 이 화면을 닫지 말고 저장을 다시 시도해 주세요.')}
 async function load(){try{for(const r of await queue.rows())notices.set(r.id,r);loading=false;schedule();void queue.flush().catch(showStorageError)}catch{loading=false;showStorageError()}}
 function pending(){return Object.values(attempts42).some(a=>a.unsavedCompletion||a.syncStatus==='saving')||[...notices.values()].some(r=>r.owner===owner()&&r.status!=='confirmed')}
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
 }
 async function retry(){for(const a of Object.values(attempts42)){if(a.unsavedCompletion){try{await queue.enqueue(a.unsavedCompletion);delete a.unsavedCompletion}catch{showStorageError();return}}}void load()}
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
 addEventListener('beforeunload',event=>{if(Object.values(attempts42).some(a=>a.unsavedCompletion||a.syncStatus==='saving')){event.preventDefault();event.returnValue=''}});
 addEventListener('online',()=>void load());addEventListener('history-session-changed',()=>{loading=true;notices.clear();clearTimeout(retryTimer);if(owner())void load();else loading=false});
 addEventListener('history-login-verified',()=>{const status=document.querySelector('#connection42');if(status)status.textContent='학생 확인 완료 · 출석과 학습 상태를 불러옵니다.'});
 if(owner())void load();else loading=false;
})();
