(function(){'use strict';
 const api=HistoryGameAPI;
 const key='v49-teacher-gift:'+(window.HISTORY_API_CONFIG?.rcUrl||'local');
 let running=false;
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const owner=()=>api.session?.user?.id||'';
 function requireSession(){if(!api.session?.token||!owner()||api.session.expiresAt&&Date.parse(api.session.expiresAt)<=Date.now()){api.clear();const e=Error('로그인 시간이 지났습니다. 다시 로그인한 뒤 지급하세요.');e.code='SESSION_EXPIRED';throw e}}
 function progress(op,out){if(out?.batchStatus){for(const k of ['totalCount','successCount','remainingCount'])if(Number.isInteger(out[k]))op[k]=out[k];save(op)}}
 function closed(out){return ['abandoned','cancelled','expired'].includes(out?.batchStatus)}
 function read(){try{const value=JSON.parse(sessionStorage.getItem(key)||'null');return value?.ownerId===owner()&&value?.operationId&&value?.payload?value:null}catch{return null}}
 function save(value){if(value)sessionStorage.setItem(key,JSON.stringify(value));else sessionStorage.removeItem(key);show()}
 function show(){const main=document.querySelector('#teacherApp main');if(!main)return;main.querySelector('#v49-gift-progress')?.remove();const op=read();if(!op)return;const box=document.createElement('section');box.className='panel';box.id='v49-gift-progress';box.setAttribute('role','status');box.setAttribute('aria-live','polite');box.innerHTML=`<h2>교사 지급 확인</h2><p>${escape(op.who)} · ${escape(op.what)}</p><p>전체 ${op.totalCount||'?'}명 · 서버 확인 성공 ${Number(op.successCount)||0}명 · 남음 ${Number.isInteger(op.remainingCount)&&op.totalCount?op.remainingCount:'?'}명</p><p>이어서 지급은 기존 원장에 지급 완료된 학생을 건너뜁니다. 포기는 이미 지급된 보상을 회수하지 않으며, 새 지급은 중복될 수 있습니다.</p><button type="button" data-gift-resume ${running?'disabled':''}>이어서 지급</button>${op.payload.scope!=='student'?` <button type="button" data-gift-abandon ${running?'disabled':''}>이 지급 포기하고 새로 시작</button>`:''}`;box.querySelector('[data-gift-resume]').onclick=()=>task(continueGift);const abandon=box.querySelector('[data-gift-abandon]');if(abandon)abandon.onclick=()=>task(abandonGift);main.prepend(box)}
 async function abandonGift(){const op=read();if(!op||running)return;requireSession();if(!confirm(`${op.who}\n${op.what}\n\n서버에서 이 지급을 종료할까요? 이미 지급된 보상은 유지됩니다. 새 지급 시 일부 학생에게 중복될 수 있습니다.`))return;running=true;show();try{const out=await api.request('teacher.gift.abandon',op.payload,{requestId:op.operationId,timeoutMs:20000,maxAttempts:1});if(!closed(out)&&out.batchStatus!=='complete')throw Error('서버 종료를 확인하지 못했습니다. 기존 작업을 유지합니다.');api.resolveRequest?.(op.operationId);save(null);msg(`서버에서 지급 종료 확인. 이미 지급 ${out.successCount}명, 미지급 ${out.remainingCount}명. 이미 받은 학생은 제외하여 새로 지급하세요.`)}finally{running=false;show()}}
 async function continueGift(){const op=read();if(!op||running)return;requireSession();running=true;show();try{
  for(let turn=0;turn<60;turn++){
   let out;
   try{out=await api.request('teacher.gift',op.payload,{requestId:op.operationId,timeoutMs:20000,maxAttempts:1})}
   catch(error){progress(op,error.data);if(error.code==='BATCH_ABANDONED'&&closed(error.data)){api.resolveRequest?.(op.operationId);save(null);msg(`서버에서 종료된 지급입니다. 이미 지급 ${error.data.successCount}명, 미지급 ${error.data.remainingCount}명.`);return}if(error.code==='PENDING_OPERATION'&&error.data?.operationId){op.operationId=error.data.operationId;save(op)}throw error}
   if(!out.batchStatus){save(null);await refresh();msg('지급 완료.');return}
   progress(op,out);
   if(out.batchStatus==='complete'&&out.remainingCount===0){save(null);await refresh();msg(`${op.who}에게 ${op.what} 지급 완료. ${out.successCount}명 반영.`);return}
   if(!['pending','partial'].includes(out.batchStatus)||out.remainingCount<1)throw Error('지급 상태를 확인할 수 없습니다. 같은 작업을 이어서 확인하세요.');
   await new Promise(resolve=>setTimeout(resolve,0));
  }
  throw Error('지급이 아직 진행 중입니다. 같은 작업 번호로 이어서 지급하세요.');
 }finally{running=false;show()}}
 giveCards25=function(event){event.preventDefault();const form=event.target;try{requireSession()}catch(e){return task(()=>Promise.reject(e))}RCTeacher.syncStudent(form);if(read()){show();return msg('진행 중인 지급을 먼저 이어서 완료하세요. 새 작업 번호로 다시 지급하지 마세요.')}const raw=formData(form),reward=readReward25(form,'gift_');if(!reward.card&&!reward.pack)return msg('지급할 보상을 선택하세요.');const target=Object.fromEntries(['scope','studentId','schoolYear','grade','classNo','unitId','reason'].filter(k=>raw[k]!==undefined).map(k=>[k,raw[k]]));const payload=reward.card?{...target,...reward.card,kind:reward.pack?'both':'card',unowned:reward.card.unregistered}:{...target,kind:'pack',packId:reward.pack.packId,count:reward.pack.count};if(reward.card&&reward.pack){payload.packId=reward.pack.packId;payload.packCount=reward.pack.count}const student=info.students.find(s=>s.id===target.studentId);if(target.scope==='student'&&!student)return msg('학년도·학년·반·번호로 학생을 먼저 확인하세요.');const who=target.scope==='student'?`${student.grade}학년 ${student.classNo}반 ${student.number}번 ${student.name}`:target.scope==='class'?`${target.grade}학년 ${target.classNo}반 전체`:target.scope==='grade'?`${target.grade}학년 전체`:`${target.schoolYear}학년도 허용 범위 전체`;const what=[reward.card?`카드 ${rarityNames[reward.card.rarity]||'무작위 등급'} ${reward.card.count}장`:null,reward.pack?`${packNames[reward.pack.packId]} ${reward.pack.count}개`:null].filter(Boolean).join(' + ');if(!confirm(`${who}\n${what}\n\n이 대상을 마지막으로 확인하고 지급하시겠습니까?`))return;if(api.session?.context3)payload.context3={...api.session.context3,schoolYear:payload.schoolYear||api.session.context3.schoolYear};save({ownerId:owner(),operationId:api.newRequestId(),payload,who,what,totalCount:0,successCount:0,remainingCount:0});task(continueGift)};
 const previousRender=render;render=function(){previousRender();show()};show();
})();
