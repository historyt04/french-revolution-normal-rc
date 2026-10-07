/* Step 3: independent, on-demand reads for collection, missions, records and ranks. */
(function(){'use strict';
 const prefix='history-step3:'+HISTORY_API_CONFIG.rcStorageScope+':';
 const menu=Object.fromEntries(['collection','missions','records','rankings'].map(key=>[key,{status:'idle',version:'',error:'',sequence:0,promise:null}]));
 let session='';
 const recordsCacheEnabled=HISTORY_API_CONFIG.recordsCacheEnabled===true&&!!window.HistoryRecordsCache;
 let recordsCache=null,recordsScope='',recordsCacheStatus=null;
 const recordContent=()=>({unitId:api42.session?.context3?.unitId,contentId:api42.session?.context3?.contentId||'',period:recordPeriod27});
 function updateRecordsCache(status){recordsCacheStatus=status;if(!recordsCacheEnabled||!state42)return;if(status?.data){recordsOwner27=state42.profile.id;records27=status.data;menu.records.status='ready'}else if(view==='records27')menu.records.status=status?.error?'error':'loading';if(view==='records27')render42()}
 async function primeRecordsCache(){
  if(!recordsCacheEnabled||!state42||!owner())return null;
  const s=api42.session,c=recordContent(),tag=JSON.stringify([s?.token,s?.context3?.schoolId,s?.user?.id,c.unitId,c.contentId,c.period]);
  if(tag===recordsScope&&recordsCache?.current(s,state42,c))return recordsCache;
  recordsCache?.leave();records27=null;recordsOwner27='';recordsScope=tag;
  const period=c.period,instance=window.HistoryRecordsCache.create({request:()=>api42.request('student.records.read',{period},{maxAttempts:1,timeoutMs:25000}),onChange:status=>{if(recordsCache===instance)updateRecordsCache(status)}});
  recordsCache=instance;const selected=await instance.select(s,state42,c,'records-response-v1');if(recordsCache!==instance||!selected)return null;
  updateRecordsCache(selected);instance.schedule({afterLogin:true});return instance;
 }
 const owner=()=>api42.session?.role==='student'?api42.session.token||'':'';
 const key=(kind,filter='')=>prefix+kind+':'+filter;
 function cached(kind,version,filter='',ttl=86400000){try{const item=JSON.parse(sessionStorage.getItem(key(kind,filter))||'null');return item?.owner===owner()&&item.version===version&&Date.now()-item.savedAt<ttl?item.data:null}catch{return null}}
 function save(kind,version,data,filter=''){try{sessionStorage.setItem(key(kind,filter),JSON.stringify({owner:owner(),version,savedAt:Date.now(),data}))}catch{}}
 function clear(kind){try{for(let i=sessionStorage.length-1;i>=0;i--){const name=sessionStorage.key(i);if(name?.startsWith(prefix+kind+':'))sessionStorage.removeItem(name)}}catch{}}
 if(recordsCacheEnabled)clear('records');
 function reset(){recordsCache?.leave();recordsCache=null;recordsScope='';recordsCacheStatus=null;for(const item of Object.values(menu)){item.status='idle';item.version='';item.error='';item.sequence++;item.promise=null}records27=null;rank42=null;session=owner()}
 function invalidate(kind){if(kind==='records'&&recordsCacheEnabled){recordsCache?.markPending();if(view==='records27')render42();return}const item=menu[kind];if(!item)return;item.status='idle';item.version='';item.error='';item.sequence++;item.promise=null;clear(kind);if(kind==='records')records27=null;if(kind==='rankings')rank42=null;if(view===kind||kind==='records'&&view==='records27')render42()}
 const applyBase=applyState42;
 applyState42=function(s){if(!s)return applyBase(s);if(session!==owner())reset();const next={...s},versions=s.lazyVersions||{};
  for(const kind of ['collection','missions','records'])if(menu[kind].status==='ready'&&(kind==='records'?!menu[kind].version.startsWith(versions[kind]+':'):menu[kind].version!==versions[kind])){if(kind==='records'&&recordsCacheEnabled){recordsCache?.markPending();continue}menu[kind].status='idle';menu[kind].version='';menu[kind].sequence++;menu[kind].promise=null;if(kind==='records')records27=null}
  const book=menu.collection.status==='ready'?cached('collection',versions.collection):null;
  if(menu.collection.status==='ready'&&!book&&!next.collection25)menu.collection.status='idle';
  if(book&&!next.collection25){next.collection25=book.collection25;next.cards=book.cards}
  const missions=menu.missions.status==='ready'?cached('missions',versions.missions):null;
  if(menu.missions.status==='ready'&&!missions&&!next.missions?.length)menu.missions.status='idle';
  if(missions&&!next.missions?.length){next.missions=missions.missions;next.attendanceLabels=missions.attendanceLabels}
  applyBase(next);if(recordsCacheEnabled)queueMicrotask(()=>void primeRecordsCache());
 };
 function statusMarkup(kind,title){const item=menu[kind],message=item.status==='error'?escape41(item.error||'조회에 실패했습니다.'):item.status==='loading'?'자료를 불러오는 중입니다.':'아직 조회하지 않았습니다.';
  return `<section class="shell" role="status"><h2>${title}</h2><p>${message}</p>${item.status!=='loading'?`<button class="btn" onclick="HistoryLazyStep3.retry('${kind}')">${item.status==='error'?'다시 시도':'불러오기'}</button>`:''}${kind==='collection'?'<button class="btn alt" onclick="collectionModeV34=\'packs\';render42()">카드팩 보관함</button>':''}</section>`;
 }
 async function loadCollection(force=false){const item=menu.collection,version=state42?.lazyVersions?.collection;if(!state42||!owner())return;if(item.promise&&item.version===version)return item.promise;if(!force&&item.status==='ready'&&item.version===version&&state42.collection25)return;
  const saved=!force&&cached('collection',version);if(saved){state42.collection25=saved.collection25;state42.cards=saved.cards;item.status='ready';item.version=version;if(view==='collection')render42();return}
  const seq=++item.sequence,who=owner();item.status='loading';item.version=version;item.error='';if(view==='collection')render42();item.promise=api42.request('collection.read').then(out=>{if(seq!==item.sequence||who!==owner())return;state42.collection25=out.collection25;state42.cards=out.cards;state42.lazyVersions.collection=out.version;item.status='ready';item.version=out.version;save('collection',out.version,{collection25:out.collection25,cards:out.cards});writeStateCache42(state42)}).catch(error=>{if(seq!==item.sequence||who!==owner())return;item.status='error';item.error=error.message}).finally(()=>{if(seq===item.sequence){item.promise=null;if(view==='collection')render42()}});return item.promise;
 }
 async function loadMissions(force=false){const item=menu.missions,version=state42?.lazyVersions?.missions;if(!state42||!owner())return;if(item.promise&&item.version===version&&Array.isArray(state42.missions))return item.promise;if(!force&&item.status==='ready'&&item.version===version&&Array.isArray(state42.missions))return;
  const saved=!force&&cached('missions',version);if(saved){state42.missions=saved.missions;state42.attendanceLabels=saved.attendanceLabels;item.status='ready';item.version=version;if(view==='missions')render42();return}
  const seq=++item.sequence,who=owner();item.status='loading';item.version=version;item.error='';if(view==='missions')render42();item.promise=api42.request('missions.read').then(out=>{if(seq!==item.sequence||who!==owner())return;state42.missions=out.missions;state42.attendanceLabels=out.attendanceLabels;state42.lazyVersions.missions=out.version;item.status='ready';item.version=out.version;save('missions',out.version,{missions:out.missions,attendanceLabels:out.attendanceLabels});writeStateCache42(state42)}).catch(error=>{if(seq!==item.sequence||who!==owner())return;item.status='error';item.error=error.message}).finally(()=>{if(seq===item.sequence){item.promise=null;if(view==='missions')render42()}});return item.promise;
 }
 const collectionBase=collectionPage;
 collectionPage=function(){if(collectionModeV34==='packs'||menu.collection.status==='ready')return collectionBase();return statusMarkup('collection','카드 도감')};
 const missionsBase=missions42;
 missions42=function(){if(view!=='missions')return `<section class="shell missions26"><h2>나의 미션</h2><p>미션 진행량은 메뉴를 열 때 확인합니다.</p><button class="btn alt" onclick="go('missions')">미션 보기</button></section>`;if(menu.missions.status!=='ready')return statusMarkup('missions','나의 미션');const html=missionsBase();return !state42.missions?.length?html+'<p class="shell">진행 중인 미션이 없습니다.</p>':html};
 const resultBase=result42;
 result42=function(){return view==='missions'?missions42():resultBase()};
 const gateBase=gate42;
 gate42=function(v){return v==='missions'?!!state42&&!state42.testOnly:gateBase(v)};
 const recordsBase=recordsPage27;
 recordsPage27=function(){const item=menu.records;if(recordsCacheEnabled){const s=recordsCacheStatus,age=s?.cachedAt?Math.max(0,Math.floor((Date.now()-s.cachedAt)/60000)):0;
  let html=s?.data?recordsBase().replace('onclick="loadRecords27()"','onclick="HistoryLazyStep3.retry(\'records\')"'):'<section class="shell r27" role="status"><h2>나의 학습 기록</h2><p>기록을 준비하고 있습니다. 다른 메뉴와 게임은 계속 사용할 수 있습니다.</p></section>';
  const status=s?.data?`마지막 갱신: ${age}분 전${age>=15?' · 오래된 기록':''}${s.pending?' · 새 기록 반영 대기 중':''}`:'기록 준비 중';
  html=`<section class="shell r27-cache-status" role="status"><p>${status}${s?.refreshing?' · 기록 갱신 중':''}</p>${s?.error?'<p>현재 서버가 혼잡하여 이전 기록을 표시합니다.</p>':''}<button class="btn alt" onclick="HistoryLazyStep3.retry('records')" ${s?.refreshing?'disabled':''}>다시 시도</button></section>`+html;
  if(s?.data&&s.data.attemptTotal===0)html+='<p class="shell">아직 완료한 학습 기록이 없습니다.</p>';return html}
  if(item.status==='error')return statusMarkup('records','나의 학습 기록');let html=recordsBase();if(item.status==='loading'&&!records27)html=statusMarkup('records','나의 학습 기록');if(records27&&records27.attemptTotal===0)html+='<p class="shell">아직 완료한 학습 기록이 없습니다.</p>';return html};
 loadRecords27=async function(force=false){const item=menu.records,version=state42?.lazyVersions?.records,filter=recordPeriod27;if(!state42||!owner())return;
  if(recordsCacheEnabled){const cache=await primeRecordsCache();if(!cache)return;if(force)return cache.refresh({manual:true});cache.schedule();return}
  if(item.promise&&item.version===version+':'+filter)return item.promise;if(!force&&item.status==='ready'&&item.version===version+':'+filter)return;
  const saved=!force&&cached('records',version,filter);if(saved){recordsOwner27=state42.profile.id;records27=saved;item.status='ready';item.version=version+':'+filter;if(view==='records27')render42();return}
  const seq=++item.sequence,who=owner();item.status='loading';item.version=version+':'+filter;item.error='';records27=null;recordsLoading27=true;if(view==='records27')render42();item.promise=api42.request('student.records.read',{period:filter}).then(out=>{if(seq!==item.sequence||who!==owner())return;recordsOwner27=state42.profile.id;records27=out;item.status='ready';save('records',version,out,filter)}).catch(error=>{if(seq!==item.sequence||who!==owner())return;item.status='error';item.error=error.message}).finally(()=>{if(seq===item.sequence){item.promise=null;recordsLoading27=false;if(view==='records27')render42()}});return item.promise;
 };
 const rankBase=rankMarkup42;
 rankMarkup42=function(){if(menu.rankings.status==='error'&&!rank42)return statusMarkup('rankings','나의 순위');return rankBase()};
 loadRank42=async function(mode='speedrun',period='weekly',setCount=0,force=false){const item=menu.rankings;if(!state42||!owner())return;view='rankings';setCount=mode==='matching'?Number(setCount)||0:0;const filter=[mode,period,setCount].join(':'),version=state42.lazyVersions?.records||'';if(!force&&item.status==='ready'&&item.version===version+':'+filter&&cached('rankings',version,filter,60000)){render42();return}if(item.promise&&item.version===version+':'+filter)return item.promise;
  const saved=!force&&cached('rankings',version,filter,60000);if(saved){rank42=saved;item.status='ready';item.version=version+':'+filter;render42();return}
  const seq=++item.sequence,who=owner();item.status='loading';item.version=version+':'+filter;item.error='';rank42=null;render42();item.promise=api42.request('rankings.read',{mode,period,setCount,selfOnly:true}).then(out=>{if(seq!==item.sequence||who!==owner())return;rank42=out;item.status='ready';save('rankings',version,out,filter)}).catch(error=>{if(seq!==item.sequence||who!==owner())return;item.status='error';item.error=error.message}).finally(()=>{if(seq===item.sequence){item.promise=null;if(view==='rankings')render42()}});return item.promise;
 };
 const goBase=go;
 go=function(v){const out=goBase(v);if(view===v){if(v==='collection')void loadCollection();if(v==='missions')void loadMissions()}return out};
 const renderBase=render42;
 render42=function(){renderBase();if(!state42)return;const nav=document.querySelector('.tabs');if(nav&&!state42.testOnly&&!nav.querySelector('[data-missions3]')){const button=document.createElement('button');button.type='button';button.dataset.missions3='';button.className='tab'+(view==='missions'?' active':'');button.textContent='미션';button.onclick=()=>go('missions');nav.insertBefore(button,Array.from(nav.children).find(x=>x.textContent.includes('도감'))||null)}if(view==='collection'&&menu.collection.status==='idle')queueMicrotask(()=>void loadCollection());if(view==='missions'&&menu.missions.status==='idle')queueMicrotask(()=>void loadMissions())};
 render=renderV28=renderV29=renderV30=renderV31=renderV32=renderV33=renderV34=renderV35=renderV36=renderV37=renderV38=renderV39=renderV40=renderV41=render42;
 const attemptBase=applyAttempt42;
 applyAttempt42=function(out){const result=attemptBase(out);if(out?.completion&&!out.completion.duplicate)for(const kind of ['collection','missions','records','rankings'])invalidate(kind);return result};
 function retry(kind){if(kind==='collection')return loadCollection(true);if(kind==='missions')return loadMissions(true);if(kind==='records')return loadRecords27(true);if(kind==='rankings'){const parts=(menu.rankings.version||'').split(':');return loadRank42(parts.at(-3)||'speedrun',parts.at(-2)||'weekly',Number(parts.at(-1))||0,true)}}
 addEventListener('history-session-changed',reset);
 if(recordsCacheEnabled)document.addEventListener('visibilitychange',()=>recordsCache?.visibility());
 window.HistoryLazyStep3={invalidate,retry,loadCollection,loadMissions};
})();
