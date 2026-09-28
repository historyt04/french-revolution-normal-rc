'use strict';

const rankingModes47={connections:'연결하기',beginner:'초급',intermediate:'중급',advanced:'고급',challenge:'도전',speedrun:'스피드런',baitrun:'미끼런',matching:'짝맞추기',revolutionmap:'혁명 지도',faceoff:'페이스오프'};

ranking=function(){
  const rowMarkup=r=>{
    if(r.group)return `<tr><td>${E(r.group)}</td><td>${r.participants}명</td><td>${ranks.metric==='completions'?r.completions+'회':'평균 '+(r.averageMs/1000).toFixed(2)+'초 · 최고 '+(r.bestMs/1000).toFixed(2)+'초'}</td><td>같은 소단원·종목</td></tr>`;
    if(ranks.metric==='completions')return `<tr><td>${r.rank||'—'}</td><td>${E(r.student.grade)}학년 ${E(r.student.classNo)}반 ${E(r.student.name)}</td><td>${r.count}회</td><td>정상 공식 완료</td></tr>`;
    return `<tr><td>${r.rank||'—'}</td><td>${E(r.student.grade)}학년 ${E(r.student.classNo)}반 ${E(r.student.name)}</td><td>${(r.elapsedMs/1000).toFixed(2)}초<br><small>${E(r.reason)}</small></td><td><button onclick="reviewRecord('${r.id}','${r.status==='normal'?'excluded':'normal'}')">${r.status==='normal'?'제외':'정상 복원'}</button></td></tr>`;
  };
  return `<section class="panel"><h2>소단원별 순위·완료 횟수</h2><p class="muted">TOP 100까지 조회할 수 있습니다. 전광판과 학생 개인 순위는 서버 캐시를 사용해 반복 조회 부하를 줄입니다.</p><form id="rankForm" onsubmit="queryRanks(event)"><div class="formgrid"><label>학년도<input name="schoolYear" type="number" value="${year}"></label><label>학년 (빈칸=전체)<input name="grade" type="number" min="1"></label><label>반 (빈칸=전체)<input name="classNo" type="number" min="1"></label><label>소단원<select name="unitId"><option value="fr-revolution">프랑스 혁명이 일어나다</option></select></label><label>게임 모드<select name="mode">${opts(rankingModes47,'speedrun')}</select></label><label>짝맞추기 세트<select name="setCount">${opts({0:'전체',6:'6세트',8:'8세트',10:'10세트',12:'12세트'},'0')}</select></label><label>기간<select name="period">${opts({today:'오늘',weekly:'이번 주',monthly:'이번 달',yearly:'올해',all:'역대'},'weekly')}</select></label><label>집계 기준<select name="metric">${opts({best:'최고 기록',completions:'완료 횟수'},'best')}</select></label><label>집계 단위<select name="scope">${opts({individual:'개인',class:'학급',grade:'학년'},'individual')}</select></label><label>기록 상태<select name="status">${opts({normal:'정상 공식 기록',review:'검토 필요',excluded:'제외 기록'},'normal')}</select></label><label>표시 인원<select name="limit">${opts({10:'TOP 10',30:'TOP 30',50:'TOP 50',100:'TOP 100'},'30')}</select></label></div><button class="primary">조회</button></form>${ranks?`<h3 style="margin-top:22px">${E(ranks.periodLabel)} · ${ranks.metric==='completions'?'완료 횟수':'최고 기록'}</h3><div class="tablewrap"><table><thead><tr><th>순위/집단</th><th>학생/참여</th><th>기록</th><th>처리</th></tr></thead><tbody>${ranks.rows.map(rowMarkup).join('')||'<tr><td colspan="4">해당 기록이 없습니다.</td></tr>'}</tbody></table></div>`:''}</section>`;
};

queryRanks=function(e){e.preventDefault();const p=Object.fromEntries(new FormData(e.target));for(const key of ['schoolYear','grade','classNo','setCount','limit'])p[key]=p[key]?+p[key]:0;if(p.mode!=='matching')p.setCount=0;task(async()=>{ranks=await API.request('rankings.read',p);render()})};

const renderTeacher47Base=render;
render=function(){renderTeacher47Base();document.title='역사 학습 통합 플랫폼 v4.7';const version=document.querySelector('.topbar div:last-child small');if(version)version.textContent=version.textContent.replace('v4.6','v4.7');const loginVersion=document.querySelector('.login .muted');if(loginVersion)loginVersion.textContent=loginVersion.textContent.replace('v4.6','v4.7')};
render();
