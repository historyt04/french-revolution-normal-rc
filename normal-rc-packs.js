/* Persist an opening request before contacting the server. No credentials stored. */
(function(){'use strict';
 const namespace=HISTORY_API_CONFIG.rcUrl+'|'+HISTORY_API_CONFIG.rcStorageScope;
 const owner=()=>api42.session?.role==='student'&&!state42?.testOnly&&state42?.profile?.id===api42.session?.user?.id?namespace+'|'+state42.profile.id:null;
 const patchRows=(original,changes,key)=>{const rows=[...(original||[])];for(const change of changes||[]){const index=rows.findIndex(row=>key(row)===key(change));if(index<0)rows.push(change);else rows[index]={...rows[index],...change}}return rows};
 function applyOpeningDelta(result){
  if(result.student){applyState42(result.student);return}
  const s=state42,book=s.collection25||{entries:[],variants:[],completions:[],shards:0},opening=result.opening;
  const summary={id:opening.id,packId:opening.packId,count:opening.count,revealed:opening.revealed,seenAt:opening.seenAt,source:opening.source,createdAt:opening.createdAt};
  const prior=s.packOpenings28||{pending:[],recent:[],pendingCount:0};
  const known=prior.pending.some(x=>x.id===summary.id)||prior.recent.some(x=>x.id===summary.id),pending=[summary,...prior.pending.filter(x=>x.id!==summary.id)].slice(0,20);
  const packChanges=result.packChanges?.length?result.packChanges:[{packId:result.spent.packId,count:result.remainingPacks}];
  applyState42({...s,packs:patchRows(s.packs,packChanges,x=>x.packId),cards:patchRows(s.cards,result.cardChanges,x=>x.id),collection25:{...book,entries:patchRows(book.entries,result.collectionChanges,x=>x.id),variants:patchRows(book.variants,result.variantChanges,x=>x.id),completions:patchRows(book.completions,result.completionChanges,x=>x.id),shards:result.shards??book.shards},packOpenings28:{...prior,pending,pendingCount:Math.max(pending.length,(prior.pendingCount||0)+(known?0:1))}});
 }
 const store=new HistoryNormalOutbox.IndexedCompletionStore('history-normal-pack-requests-v1'); let pending=[],timer=null,starting=false,loading=null,loadedOwner='',requested=null;
 const queue=new HistoryNormalOutbox.CompletionQueue({store,owner,request:(...args)=>api42.request(...args),
  onChange(row){pending=pending.filter(x=>x.id!==row.id);if(row.owner===owner()&&row.status!=='confirmed')pending.push(row);schedule()},
  async onConfirmed(row,result){const who=owner();if(!who)return;if(result.duplicate||result.needsRefresh){try{await refresh42()}catch{applyOpeningDelta(result);toast42('최신 보유 수량을 다시 확인해 주세요. 개봉 카드는 아래에 표시됩니다.')}}else applyOpeningDelta(result);if(who!==owner())return;for(const kind of ['collection','missions','records'])window.HistoryLazyStep3?.invalidate(kind);requested=null;if(!opening28)attachOpening28(result.opening,row.revealMode);else{render42();toast42('카드팩 개봉 결과를 확인했습니다. 보관함에서 이어서 볼 수 있습니다.')}}
 });
 function schedule(){clearTimeout(timer);const now=Date.now(),rows=pending.filter(x=>x.owner===owner()&&x.status==='pending');if(rows.length){const delay=Math.max(250,Math.min(...rows.map(r=>Math.max(0,(Number(r.nextRetryAt)||now+4000)-now))));timer=setTimeout(()=>void queue.flush().catch(storageError),delay)}}
 function storageError(){toast42('개봉 요청을 기기에 보관하지 못했습니다. 저장 공간을 확인해 주세요. 저장 전에는 팩을 차감하지 않습니다.')} function load(force=false){if(loading)return loading;const who=owner();if(!who)return Promise.resolve();if(!force&&loadedOwner===who)return Promise.resolve();loading=(async()=>{const rows=await queue.rows();if(who!==owner())return;pending=rows.filter(x=>x.status!=='confirmed');loadedOwner=who;schedule();void queue.flush().catch(storageError)})().catch(storageError).finally(()=>{loading=null});return loading}
 const beginBase=beginOpening28;
 beginOpening28=async function(mode){
  if(state42?.testOnly)return beginBase(mode);
  if(starting||busy42||!openPlan42||opening28||!owner())return;
  starting=true;
  try{
   await load();if(pending.length){toast42('카드팩을 여는 중입니다. 잠시만 기다려 주세요.');void queue.flush();return}
   const revealMode=mode||openPlan42.mode||'single',count=revealMode==='all'?openPlan42.total:1;
   const input={clientId:'pack-'+api42.newRequestId(),mode:'pack',action:'cards.openPack',direct:true,payload:{packId:openPlan42.packId,count},revealMode};
   requested=input.clientId;await queue.enqueue(input);toast42('카드팩 개봉을 확인 중입니다. 화면을 다시 열어도 같은 요청으로 확인합니다.');void queue.flush().catch(storageError);
  }catch{storageError()}finally{starting=false}
 };
 const vaultBase=packVaultV38;packVaultV38=function(){return (pending.length?'<section role="status"><p>카드팩 개봉 요청을 확인 중입니다. 아직 결과가 표시되지 않아도 새 팩을 다시 차감하지 않습니다.</p><button class="btn alt" onclick="HistoryNormalPacks.retry()">개봉 결과 다시 확인</button></section>':'')+vaultBase()};
 const applyBase=applyState42;applyState42=function(s){applyBase(s);if(owner())void load()}; async function retry(){try{await load(true);await queue.retryBlocked();await queue.flush(true)}catch{storageError()}}
 addEventListener('online',()=>void load(true).then(()=>queue.flush(true)).catch(storageError)); addEventListener('history-session-changed',()=>{pending=[];requested=null;loadedOwner='';clearTimeout(timer)}); window.HistoryNormalPacks={retry};if(owner())void load();
})();
