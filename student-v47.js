'use strict';

function rankCacheKey47(mode,period,setCount){const day=new Date(Date.now()+9*3600000).toISOString().slice(0,10),student=api42.session?.user?.id||'student';return `history-rank-v47:${student}:${day}:${mode}:${period}:${setCount||0}`}
function rankCacheRead47(key){try{const value=JSON.parse(localStorage.getItem(key)||'null');return value&&Date.now()-value.savedAt<86400000?value.data:null}catch{return null}}
function rankCacheWrite47(key,data){try{localStorage.setItem(key,JSON.stringify({savedAt:Date.now(),data}))}catch{}}

loadRank42=async function(mode='speedrun',period='weekly',setCount=0,force=false){
  view='rankings';setCount=mode==='matching'?Number(setCount)||0:0;const key=rankCacheKey47(mode,period,setCount),cached=!force&&rankCacheRead47(key);
  if(cached){rank42=cached;render42();return}
  rank42=null;render42();await run42(async()=>{rank42=await api42.request('rankings.read',{mode,period,setCount,selfOnly:true});rankCacheWrite47(key,rank42);render42()});
};

rankTable42=function(rows,metric='best'){return rows.length?`<table class="table42"><thead><tr><th>순위</th><th>표시 이름</th><th>${metric==='completions'?'완료':'기록'}</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${x.rank}위</td><td>${escape41(x.displayName)}${x.isMe?' (나)':''}</td><td>${metric==='completions'?x.count+'회':precise(x.elapsedMs)}</td></tr>`).join('')}</tbody></table>`:'<p>아직 공개할 공식 기록이 없습니다.</p>'};

rankMarkup42=function(){
  if(!rank42)return '<section class="shell"><h2>순위·기록</h2><p>서버 기록을 불러오는 중입니다.</p></section>';
  const modes=['connections','beginner','intermediate','advanced','challenge','speedrun','baitrun','matching','revolutionmap','faceoff'],labels={challenge:'도전',speedrun:'스피드런',baitrun:'미끼런',matching:'짝맞추기',faceoff:'페이스오프',revolutionmap:'혁명 지도'},rankArgs=`document.querySelector('[data-rank-mode47]').value,document.querySelector('[data-rank-period47]').value,document.querySelector('[data-rank-set47]').value`;
  return `<section class="shell"><h2>프랑스 혁명 · 나의 순위와 기록</h2><div class="rank-controls42"><select data-rank-mode47 aria-label="게임 모드" onchange="loadRank42(${rankArgs})">${modes.map(m=>`<option value="${m}" ${m===rank42.mode?'selected':''}>${names[m]||labels[m]}</option>`).join('')}</select><select data-rank-period47 aria-label="기간" onchange="loadRank42(${rankArgs})">${Object.entries({today:'오늘',weekly:'이번 주',monthly:'이번 달',yearly:'올해',all:'역대'}).map(([key,label])=>`<option value="${key}" ${key===rank42.period?'selected':''}>${label}</option>`).join('')}</select><select data-rank-set47 aria-label="짝맞추기 세트" onchange="loadRank42(${rankArgs})" ${rank42.mode==='matching'?'':'disabled'}><option value="0">전체 세트</option>${[6,8,10,12].map(n=>`<option value="${n}" ${n===Number(rank42.setCount)?'selected':''}>${n}세트</option>`).join('')}</select><button type="button" onclick="loadRank42(${rankArgs},true)">새로고침</button></div><p>${escape41(rank42.periodLabel)} · 내 기록과 내 순위만 불러옵니다.</p><div class="rank42"><article>나의 최고기록<strong>${rank42.personalBest?precise(rank42.personalBest):'기록 없음'}${rank42.myClassRank?' · '+rank42.myClassRank+'위':''}</strong></article><article>나의 완료 횟수<strong>${rank42.personalCompletions||0}회${rank42.completionClassRank?' · '+rank42.completionClassRank+'위':''}</strong></article></div><p>TOP 100 전체 순위는 교실 전광판에서 확인할 수 있습니다. 기간은 한국 표준시 서버 기준입니다.</p></section>`;
};

document.title='프랑스 혁명 학습 게임 v4.9 RC';
