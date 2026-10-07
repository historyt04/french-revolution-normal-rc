/* R3-A1C: student-scoped, display-only records cache. Disabled unless the test client opts in. */
(function(root){'use strict';
 const SCHEMA=1, PREFIX='history-r3a1c:v1:', FRESH_MS=15*60*1000, MIN_REFRESH_MS=15*60*1000;
 const SLOT_COUNT=360, SLOT_MS=1000, MAX_FAILURES=3;
 const fields=['summary','events','games','attempts','attemptTotal','xp','levels','rewards','missions','missionClaims','attendance','collection','period','formulas','serverNow'];
 const arrays=['events','games','attempts','xp','levels','rewards','missions','missionClaims'];
 const now=()=>Date.now();
 const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 async function digest(value){const bytes=new TextEncoder().encode(value);return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)))}
 function scopeOf(session,state,content){
  if(session?.role!=='student'||session.testOnly||!session.token||!session.user?.id||!state?.profile?.id||String(session.user.id)!==String(state.profile.id)||!session.context3?.schoolId||!content||session.revokedAt||session.expiresAt&&Date.parse(session.expiresAt)<=Date.now())return null;
  if(session.user.schoolId&&String(session.user.schoolId)!==String(session.context3.schoolId))return null;
  if(state.profile.schoolId&&String(state.profile.schoolId)!==String(session.context3.schoolId))return null;
  if(session.context3.unitId&&content.unitId&&String(session.context3.unitId)!==String(content.unitId))return null;
  return [String(session.context3.schoolId),String(session.context3.schoolYear||''),String(session.user.id),String(content.unitId||session.context3.unitId||''),String(content.contentId||''),String(content.period||'all')];
 }
 function validate(data){
  if(!data||typeof data!=='object'||Array.isArray(data)||!data.summary||typeof data.summary!=='object'||!data.formulas||typeof data.formulas!=='object'||!Number.isFinite(Number(data.serverNow)))return false;
  if(!arrays.every(k=>Array.isArray(data[k]))||!data.attendance||typeof data.attendance!=='object'||Array.isArray(data.attendance)||!data.collection||typeof data.collection!=='object')return false;
  if(!Number.isInteger(data.attemptTotal)||data.attemptTotal<0)return false;
  const inspect=(x,depth)=>{if(depth>12)return false;if(!x||typeof x!=='object')return true;for(const [k,v] of Object.entries(x)){if(/^(token|sessionToken|sessionHash|code|codeHash|password|serviceRoleKey|dbUrl)$/i.test(k))return false;if(!inspect(v,depth+1))return false}return true};
  return inspect(data,0);
 }
 function displayData(data){if(!validate(data))return null;const out={};for(const k of fields)if(Object.prototype.hasOwnProperty.call(data,k))out[k]=data[k];return out}
 function slotFromDigest(hash){return parseInt(hash.slice(0,8),16)%SLOT_COUNT}
 function create({storage,clock=now,request,onChange=()=>{},isVisible=()=>!root.document?.hidden,lockApi=root.navigator?.locks}={}){
  if(typeof request!=='function')throw Error('records request required');
  try{storage=storage||root.localStorage}catch{storage=null}
  if(!storage){const m=new Map();storage={getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k),key:i=>Array.from(m.keys())[i]??null,get length(){return m.size}}}
  let identity=null,generation=0,timer=null,flight=null,tabId=hex(crypto.getRandomValues(new Uint8Array(12)));
  const volatile=new Map();
  const read=key=>{try{const raw=storage.getItem(key);return raw===null?volatile.get(key)||null:JSON.parse(raw)}catch{return volatile.get(key)||null}};
  const write=(key,value)=>{try{storage.setItem(key,JSON.stringify(value));volatile.delete(key);return true}catch{volatile.set(key,value);return false}};
  const remove=key=>{volatile.delete(key);try{storage.removeItem(key)}catch{}};
  const cacheKey=()=>identity&&PREFIX+'data:'+identity.hash;
  const stateKey=()=>identity&&PREFIX+'state:'+identity.hash;
  function entry(){if(!identity)return null;const row=read(cacheKey());if(row?.schemaVersion!==SCHEMA||row.scopeHash!==identity.hash||row.responseVersion!==identity.version||!Number.isFinite(row.cachedAt)||!validate(row.data))return null;return row}
  function status(){const row=entry(),s=read(stateKey())||{};return {data:row?.data||null,cachedAt:row?.cachedAt||0,serverUpdatedAt:row?.serverUpdatedAt||null,stale:!!row&&clock()-row.cachedAt>FRESH_MS,pending:!!s.pending,refreshing:!!flight,error:!!s.error,nextAllowedAt:Number(s.nextAllowedAt)||0}}
  function emit(){onChange(status())}
  function clearTimer(){if(timer){clearTimeout(timer);timer=null}}
  function cleanup(){try{const rows=[];for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key?.startsWith(PREFIX+'data:')){const item=read(key);rows.push({key,time:Number(item?.cachedAt)||0})}}rows.sort((a,b)=>b.time-a.time);for(const row of rows.slice(12))if(row.key!==cacheKey())remove(row.key)}catch{}}
  async function select(session,state,content,version='records-v1'){
   const scope=scopeOf(session,state,content);const seq=++generation;clearTimer();flight=null;identity=null;emit();if(!scope)return null;
   const hash=await digest(JSON.stringify([SCHEMA,scope,version]));if(seq!==generation)return null;
   identity={hash,version,scope:JSON.stringify(scope),sessionToken:session.token,slot:slotFromDigest(hash)};emit();return status();
  }
  function current(session,state,content){const scope=scopeOf(session,state,content);return !!identity&&!!scope&&identity.sessionToken===session.token&&identity.scope===JSON.stringify(scope)}
  function schedule({afterLogin=false}={}){
   if(!identity||timer&&!afterLogin)return;clearTimer();const row=entry(),s=read(stateKey())||{},base=clock();
   if(afterLogin&&row&&base-row.cachedAt<FRESH_MS){timer=setTimeout(()=>schedule(),Math.max(1000,FRESH_MS-(base-row.cachedAt)));return}
   const spread=identity.slot*SLOT_MS+(parseInt(identity.hash.slice(8,12),16)%500);
   const due=Math.max(base+spread,Number(s.nextAllowedAt)||0,row?row.cachedAt+MIN_REFRESH_MS:0);
   timer=setTimeout(()=>{timer=null;if(isVisible())void refresh()},Math.max(0,due-base));
  }
  async function refresh({manual=false}={}){
   if(!identity)return null;if(flight)return flight;const s=read(stateKey())||{},t=clock();
   if(t<Number(s.nextAllowedAt||0)||manual&&t<Number(s.lastManualAt||0)+10000||!manual&&t<Number(s.lastSuccessAt||0)+MIN_REFRESH_MS||!manual&&Number(s.failures||0)>=MAX_FAILURES)return null;
   if(manual)write(stateKey(),{...s,lastManualAt:t});
   const seq=generation,hash=identity.hash,leaseKey=PREFIX+'lease:'+hash;
   const run=async()=>{
    const lease=read(leaseKey);if(lease&&lease.expiresAt>clock()&&lease.owner!==tabId)return null;
    write(leaseKey,{owner:tabId,expiresAt:clock()+35000});
    if(read(leaseKey)?.owner!==tabId)return null;
    try{const response=await request();if(seq!==generation||hash!==identity?.hash)return null;const data=displayData(response);if(!data)throw Error('INVALID_RECORD_RESPONSE');
     const stored={schemaVersion:SCHEMA,scopeHash:hash,responseVersion:identity.version,cachedAt:clock(),serverUpdatedAt:data.serverNow,data};
     write(cacheKey(),stored);write(stateKey(),{pending:false,error:false,failures:0,lastSuccessAt:clock(),lastManualAt:manual?t:Number(s.lastManualAt)||0,nextAllowedAt:0});cleanup();emit();schedule();return data;
    }catch(error){if(seq!==generation)return null;const failures=Math.min(MAX_FAILURES,Number(s.failures||0)+1);write(stateKey(),{...s,error:true,failures,lastManualAt:manual?t:Number(s.lastManualAt)||0,nextAllowedAt:clock()+Math.min(300000,30000*2**(failures-1))});emit();if(failures<MAX_FAILURES)schedule();return null;
    }finally{if(read(leaseKey)?.owner===tabId)remove(leaseKey)}
   };
   const running=Promise.resolve().then(()=>lockApi?.request?lockApi.request('history-records-'+hash,{ifAvailable:true},lock=>lock?run():null):run()).catch(()=>null).finally(()=>{if(flight===running){flight=null;emit()}});flight=running;emit();return running;
  }
  function markPending(){if(!identity)return;const s=read(stateKey())||{};write(stateKey(),{...s,pending:true});emit();schedule()}
  function leave(){generation++;clearTimer();identity=null;flight=null;emit()}
  function visibility(){if(isVisible()&&identity&&!timer&&!flight)schedule()}
  return {select,current,status,schedule,refresh,markPending,leave,visibility,slot:()=>identity?.slot??null};
 }
 const api={create,scopeOf,validate,displayData,slotFromDigest,SCHEMA,SLOT_COUNT,SLOT_MS};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.HistoryRecordsCache=api;
})(typeof window!=='undefined'?window:globalThis);
