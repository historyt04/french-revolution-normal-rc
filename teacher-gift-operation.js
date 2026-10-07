(function(){'use strict';
 const api=HistoryGameAPI;
 const key='v49-teacher-gift:'+(window.HISTORY_API_CONFIG?.rcUrl||'local');
 let running=false;
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const owner=()=>api.session?.user?.id||'';
 function read(){try{const value=JSON.parse(sessionStorage.getItem(key)||'null');return value?.ownerId===owner()&&value?.operationId&&value?.payload?value:null}catch{return null}}
 function save(value){if(value)sessionStorage.setItem(key,JSON.stringify(value));else sessionStorage.removeItem(key);show()}
 function show(){const main=document.querySelector('#teacherApp main');if(!main)return;main.querySelector('#v49-gift-progress')?.remove();const op=read();if(!op)return;const box=document.createElement('section');box.className='panel';box.id='v49-gift-progress';box.setAttribute('role','status');box.setAttribute('aria-live','polite');box.innerHTML=`<h2>교사 지급 진행 중</h2><p>${escape(op.who)} · ${escape(op.what)}</p><p>전체 ${Number(op.totalCount)||'?'}명 · 성공 ${Number(op.successCount)||0}명 · 남음 ${Number(op.remainingCount)||'?' }명</p><p>같은 작업 번호로 남은 학생만 지급합니다. 새 지급을 시작하지 마세요.</p><button type="button" ${running?'disabled':''}>이어서 지급</button>`;box.querySelector('button').onclick=()=>task(continueGift);main.prepend(box)}
 async function continueGift(){const op=read();if(!op||running)return;running=true;show();try{
  for(let turn=0;turn<60;turn++){
   let out;
   try{out=await api.request('teacher.gift',op.payload,{requestId:op.operationId,timeoutMs:20000})}
   catch(error){if(error.code==='PENDING_OPERATION'&&error.data?.operationId){op.operationId=error.data.operationId;save(op)}throw error}
   if(!out.batchStatus){save(null);await refresh();msg('지급 완료.');return}
   op.totalCount=out.totalCount;op.successCount=out.successCount;op.remainingCount=out.remainingCount;save(op);
   if(out.batchStatus==='complete'&&out.remainingCount===0){save(null);await refresh();msg(`${op.who}에게 ${op.what} 지급 완료. ${out.successCount}명 반영.`);return}
   if(!['pending','partial'].includes(out.batchStatus)||out.remainingCount<1)throw Error('지급 상태를 확인할 수 없습니다. 같은 작업을 이어서 확인하세요.');
   await new Promise(resolve=>setTimeout(resolve,0));
  }
  throw Error('지급이 아직 진행 중입니다. 같은 작업 번호로 이어서 지급하세요.');
 }finally{running=false;show()}}
 giveCards25=function(event){event.preventDefault();const form=event.target;RCTeacher.syncStudent(form);if(read()){show();return msg('진행 중인 지급을 먼저 이어서 완료하세요. 새 작업 번호로 다시 지급하지 마세요.')}const raw=formData(form),reward=readReward25(form,'gift_');if(!reward.card&&!reward.pack)return msg('지급할 보상을 선택하세요.');const target=Object.fromEntries(['scope','studentId','schoolYear','grade','classNo','unitId','reason'].filter(k=>raw[k]!==undefined).map(k=>[k,raw[k]]));const payload=reward.card?{...target,...reward.card,kind:reward.pack?'both':'card',unowned:reward.card.unregistered}:{...target,kind:'pack',packId:reward.pack.packId,count:reward.pack.count};if(reward.card&&reward.pack){payload.packId=reward.pack.packId;payload.packCount=reward.pack.count}const student=info.students.find(s=>s.id===target.studentId);if(target.scope==='student'&&!student)return msg('학년도·학년·반·번호로 학생을 먼저 확인하세요.');const who=target.scope==='student'?`${student.grade}학년 ${student.classNo}반 ${student.number}번 ${student.name}`:target.scope==='class'?`${target.grade}학년 ${target.classNo}반 전체`:target.scope==='grade'?`${target.grade}학년 전체`:`${target.schoolYear}학년도 허용 범위 전체`;const what=[reward.card?`카드 ${rarityNames[reward.card.rarity]||'무작위 등급'} ${reward.card.count}장`:null,reward.pack?`${packNames[reward.pack.packId]} ${reward.pack.count}개`:null].filter(Boolean).join(' + ');if(!confirm(`${who}\n${what}\n\n이 대상을 마지막으로 확인하고 지급하시겠습니까?`))return;save({ownerId:owner(),operationId:api.newRequestId(),payload,who,what,totalCount:0,successCount:0,remainingCount:0});task(continueGift)};
 const previousRender=render;render=function(){previousRender();show()};show();
})();
