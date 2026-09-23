/* Persist an opening request before contacting the server. No credentials stored. */
(function(){'use strict';
 const namespace=HISTORY_API_CONFIG.rcUrl+'|'+HISTORY_API_CONFIG.rcStorageScope;
 const owner=()=>api42.session?.role==='student'&&!state42?.testOnly&&state42?.profile?.id===api42.session?.user?.id?namespace+'|'+state42.profile.id:null;
 const store=new HistoryNormalOutbox.IndexedCompletionStore('history-normal-pack-requests-v1');
 let pending=[],timer=null,starting=false,loading=null,requested=null;
 const queue=new HistoryNormalOutbox.CompletionQueue({store,owner,request:(...args)=>api42.request(...args),
  onChange(row){pending=pending.filter(x=>x.id!==row.id);if(row.owner===owner()&&row.status!=='confirmed')pending.push(row);schedule()},
  onConfirmed(row,result){if(!owner())return;applyState42(result.student);if(requested===row.clientId){requested=null;attachOpening28(result.opening,row.revealMode==='all');if(row.revealMode==='auto'){packAutoV38=true;render42()}}else{render42();toast42('카드팩 개봉 결과를 확인했습니다. 보관함에서 확인하세요.')}}
 });
 function schedule(){clearTimeout(timer);if(owner()&&pending.some(x=>x.status==='pending'))timer=setTimeout(()=>void queue.flush().catch(storageError),4000)}
 function storageError(){toast42('개봉 요청을 기기에 보관하지 못했습니다. 저장 공간을 확인해 주세요. 저장 전에는 팩을 차감하지 않습니다.')}
 function load(){if(loading)return loading;const who=owner();loading=(async()=>{const rows=await queue.rows();if(who!==owner())return;pending=rows.filter(x=>x.status!=='confirmed');schedule();void queue.flush().catch(storageError)})().catch(storageError).finally(()=>{loading=null});return loading}
 const beginBase=beginOpening28;
 beginOpening28=async function(mode='manual'){
  if(state42?.testOnly)return beginBase(mode);
  if(starting||busy42||!openPlan42||opening28||!owner())return;
  starting=true;
  try{
   await load();if(pending.length){toast42('앞서 요청한 카드팩 개봉을 확인 중입니다. 같은 요청으로 다시 확인합니다.');void queue.flush();return}
   const input={clientId:'pack-'+api42.newRequestId(),mode:'pack',action:'cards.openPack',direct:true,payload:{packId:openPlan42.packId,count:openPlan42.total},revealMode:mode===true?'all':mode===false?'manual':mode};
   requested=input.clientId;await queue.enqueue(input);toast42('카드팩 개봉을 확인 중입니다. 화면을 다시 열어도 같은 요청으로 확인합니다.');void queue.flush().catch(storageError);
  }catch{storageError()}finally{starting=false}
 };
 const vaultBase=packVaultV38;packVaultV38=function(){return (pending.length?'<section role="status"><p>카드팩 개봉 요청을 확인 중입니다. 아직 결과가 표시되지 않아도 새 팩을 다시 차감하지 않습니다.</p><button class="btn alt" onclick="HistoryNormalPacks.retry()">개봉 결과 다시 확인</button></section>':'')+vaultBase()};
 const applyBase=applyState42;applyState42=function(s){applyBase(s);if(owner())void load()};
 addEventListener('online',()=>void load());
 addEventListener('history-session-changed',()=>{pending=[];requested=null;clearTimeout(timer)});
 window.HistoryNormalPacks={retry:()=>load()};if(owner())void load();
})();
