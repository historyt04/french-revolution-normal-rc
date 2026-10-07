(function(){
  'use strict';
  const app=document.getElementById('teacherApp');
  if(!app)return;

  function studentUrl(){
    const url=new URL(window.HISTORY_API_CONFIG?.studentUrl||'');
    if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||
       !url.pathname.endsWith('/student-preview.html'))throw Error('학생용 주소 설정을 확인하세요.');
    return url.href;
  }

  function close(dialog){
    if(document.fullscreenElement===dialog)document.exitFullscreen().catch(()=>{});
    dialog.close();
  }

  function open(){
    const existing=document.getElementById('studentAccessQrDialog');
    if(existing)return;
    let address,svg;
    try{
      address=studentUrl();
      const qr=window.qrcode(0,'M');
      qr.addData(address,'Byte');
      qr.make();
      svg=qr.createSvgTag({cellSize:14,margin:56,scalable:true,
        title:'학생용 사이트 접속 QR',alt:'학생용 사이트 주소 QR 코드'});
    }catch(error){
      window.alert(error.message||'QR 코드를 만들 수 없습니다.');
      return;
    }
    const dialog=document.createElement('dialog');
    dialog.id='studentAccessQrDialog';
    dialog.className='student-access-qr';
    dialog.innerHTML='<div class="student-access-qr-panel">'+
      '<div class="student-access-qr-heading"><h2>학생 접속 QR</h2><button type="button" data-qr-action="close" aria-label="QR 닫기">닫기</button></div>'+
      '<div class="student-access-qr-image"></div><p class="student-access-qr-address"></p>'+
      '<div class="student-access-qr-actions">'+
      '<button type="button" data-qr-action="copy">주소 복사</button>'+
      '<button type="button" data-qr-action="save">QR 이미지 저장</button>'+
      '<button type="button" data-qr-action="print">인쇄</button>'+
      '<button type="button" data-qr-action="fullscreen">전체화면</button></div>'+
      '<p class="student-access-qr-note" role="status">학생용 사이트 주소만 포함합니다.</p></div>';
    dialog.querySelector('.student-access-qr-image').innerHTML=svg;
    dialog.querySelector('.student-access-qr-address').textContent=address;
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});
    dialog.addEventListener('click',async event=>{
      if(event.target===dialog){close(dialog);return;}
      const action=event.target.closest('[data-qr-action]')?.dataset.qrAction;
      if(!action)return;
      if(action==='close'){close(dialog);return;}
      if(action==='fullscreen'){
        if(dialog.classList.contains('student-access-qr-fullscreen')){
          dialog.classList.remove('student-access-qr-fullscreen');
          return;
        }
        try{
          if(document.fullscreenElement===dialog)await document.exitFullscreen();
          else await dialog.requestFullscreen();
        }catch{
          dialog.classList.add('student-access-qr-fullscreen');
          dialog.querySelector('.student-access-qr-note').textContent='큰 화면으로 표시합니다.';
        }
      }
      if(action==='copy'){
        try{
          await navigator.clipboard.writeText(address);
          dialog.querySelector('.student-access-qr-note').textContent='학생용 주소를 복사했습니다.';
        }catch{dialog.querySelector('.student-access-qr-note').textContent='복사할 수 없습니다. 아래 주소를 직접 복사하세요.';}
      }
      if(action==='save'){
        const blob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'});
        const objectUrl=URL.createObjectURL(blob);
        const link=document.createElement('a');
        link.href=objectUrl;
        link.download='v4.9-student-access-qr.svg';
        link.click();
        setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);
      }
      if(action==='print')window.print();
    });
    document.body.append(dialog);
    dialog.showModal();
  }

  function attachButton(){
    const topbar=app.querySelector('.topbar');
    if(!topbar||topbar.querySelector('[data-student-access-qr]'))return;
    const button=document.createElement('button');
    button.type='button';
    button.textContent='학생 접속 QR';
    button.dataset.studentAccessQr='';
    button.addEventListener('click',open);
    topbar.lastElementChild.append(button);
  }
  new MutationObserver(attachButton).observe(app,{childList:true});
  attachButton();
  window.HistoryStudentAccessQR={open,getAddress:studentUrl};
})();
