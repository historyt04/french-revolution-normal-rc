/* History glow engine, 1.2 preview. DOM/SVG geometry + CSS animation; no canvas,
   videos, remote services, credentials, rewards, or writes. */
(function(g){'use strict';
  let serial=0;
  const instances=new Set();
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number.isFinite(+n)?+n:a));
  function validateEffect(value){const fx=String(value);if(fx!=='none'&&!g.GlowEffectsConfig.effects.some(e=>e.id===fx))throw new RangeError('알 수 없는 광휘: '+fx);return fx;}
  const rng=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const N=n=>Number(n).toFixed(2);
  function field(effect,uid){
    if(g.GlowReferenceRenderers?.[effect])return g.GlowReferenceRenderers[effect](uid);
    if(['02','07','10','11','13','14','15','16','17','18'].includes(effect))throw new Error('광휘 모듈이 누락되었습니다: '+effect);
    const id=n=>uid+'-'+n,url=n=>'url(#'+id(n)+')',random=rng(371+Number(effect)*977);
    const linear=(name,colors,x1='0%',y1='0%',x2='100%',y2='100%')=>`<linearGradient id="${id(name)}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${colors.map((c,i)=>`<stop offset="${i/(colors.length-1)*100}%" stop-color="${Array.isArray(c)?c[0]:c}" stop-opacity="${Array.isArray(c)?c[1]:1}"/>`).join('')}</linearGradient>`;
    const radial=(name,color)=>`<radialGradient id="${id(name)}"><stop stop-color="${color}" stop-opacity=".82"/><stop offset=".3" stop-color="${color}" stop-opacity=".38"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;
    let defs=`${linear('spectrum',['#ff9ddd','#ffc36c','#fff5a1','#7dffd4','#7ccfff','#b592ff','#ffb2ec'])}${linear('ice',['#dcffff','#ffffff','#52bfff','#4769d4','#a6eeff'])}${linear('silver',['#ffffff','#a0c7e5','#faffff','#dceafa','#80b4df','#ffffff'])}${linear('gold', [['#ffc335',0],['#ffdb66',.7],['#fff8d7',1],['#ffc442',.72],['#dc881c',0]])}${linear('emerald',[['#08a06e',0],['#19f79d',.85],['#e0ffee',1],['#34c7b6',.5],['#23d58c',0]])}${linear('fire',[['#ce152e',0],['#ff2e1f',.8],['#ff901f',.92],['#ffe48b',.95]],'0%','0%','0%','100%')}${linear('pearl',[['#effaff',.1],['#ffffff',.85],['#f8c9e8',.8],['#beeff3',.8],['#c4b5ed',.5],['#faffef',.1]])}${radial('goldHalo','#ffbd3c')}${radial('iceHalo','#6bc9ff')}${radial('violetHalo','#8e35f2')}${radial('pinkHalo','#e779ff')}${radial('mintHalo','#13ff9b')}${radial('whiteHalo','#f4f5ff')}${radial('roseHalo','#ffb9de')}${radial('pearlBlue','#afd8ff')}
      <filter id="${id('soft')}" x="-70%" y="-70%" width="240%" height="240%"><feGaussianBlur stdDeviation="3.5"/></filter>
      <filter id="${id('bloom')}" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2.2"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
    defs+=radial('fireHalo','#ff482e');
    const ellipse=(cx,cy,rx,ry,fill,extra='')=>`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`;
    const line=(d,color,w,extra='')=>`<path class="gc-light-path" d="${d}" stroke="${color}" stroke-width="${w}" ${extra}/>`;
    const ribbon=(d,color,w=3)=>line(d,color,w*3,`opacity=".18" filter="${url('soft')}"`)+line(d,color,w,`opacity=".9"`)+line(d,'#f3ffef',.55,'opacity=".72"');
    function star(x,y,s,color,delay=0){return `<g class="gc-spark" style="--delay:${delay}s;--dur:${N(3+random()*4)}s"><circle cx="${x}" cy="${y}" r="${s*2.9}" fill="${url(color==='gold'?'goldHalo':'iceHalo')}"/><path d="M ${x-s*2} ${y} Q ${x} ${y-s*.23} ${x} ${y-s*2.8} Q ${x+s*.18} ${y} ${x+s*2} ${y} Q ${x} ${y+s*.2} ${x} ${y+s*2.8} Q ${x-s*.18} ${y} ${x-s*2} ${y}" fill="#fff8e8"/><circle cx="${x}" cy="${y}" r="${s*.29}" fill="#fff"/></g>`;}
    function dust(color,count=24,kind='gc-dust'){
      let out='';for(let i=0;i<count;i++){
        const left=i%2===0,x=left?9+random()*65:325+random()*65,y=20+random()*325,r=.45+random()*1.25;
        out+=`<circle class="${kind}" cx="${N(x)}" cy="${N(y)}" r="${N(r)}" fill="${color}" style="--delay:${N(-random()*9)}s;--dur:${N(4+random()*5)}s"/>`;
      }return out;
    }
    function shard(x,y,s,angle,silver=false,delay=0){
      const cl=silver?'gc-silver-shard':'gc-ice',grad=url(silver?'silver':'ice');
      return `<g transform="translate(${x} ${y}) rotate(${angle})"><g class="${cl}" style="--delay:${delay}s">
        <path d="M0 ${-s} L${s*.57} ${-s*.16} L${s*.25} ${s*.77} L${-s*.48} ${s*.46} L${-s*.6} ${-s*.35}Z" fill="${grad}" stroke="#e8faff" stroke-width=".6"/>
        <path d="M0 ${-s} L${s*.12} 0 L${-s*.6} ${-s*.35}Z M${s*.12} 0 L${s*.57} ${-s*.16} L${s*.25} ${s*.77}Z" fill="#faffff" opacity=".78"/>
        <path d="M${s*.12} 0 L${-s*.48} ${s*.46} L${s*.25} ${s*.77}Z" fill="${silver?'#547ba4':'#2264c9'}" opacity=".6"/>
        <path class="gc-ice-light" style="--delay:${delay}s" d="M0 ${-s} L${s*.12} 0 L${s*.25} ${s*.77} M${-s*.6} ${-s*.35} L${s*.12} 0 L${s*.57} ${-s*.16}" stroke="#fff" stroke-width="1" fill="none"/>
      </g></g>`;
    }
    let body='';
    switch(effect){
      case '01':{
        body=ellipse(15,80,83,111,url('roseHalo'))+ellipse(385,279,91,111,url('iceHalo'));
        const bands=[['M-15 302 C65 232 22 118 141 -22 L173 -22 C40 141 80 256 9 335',.72],['M244 390 C380 311 326 179 422 83 L452 123 C349 231 407 324 282 397',.75],['M-20 90 Q138 -22 80 -35 L139 -33 Q175 43 -10 132',.48]];
        body+=`<g class="gc-rainbow-veil">${bands.map(([d,o])=>`<path d="${d}" fill="${url('spectrum')}" opacity="${o}"/>`).join('')}</g>`;
        body+=`<g class="gc-rainbow-edge">${ribbon('M7 304 C77 218 29 108 127 0',url('spectrum'),2.5)}${ribbon('M278 371 C381 286 336 167 397 108',url('spectrum'),2.4)}</g>`;
        body+=dust('#eff8ff',24)+star(47,54,5,'ice',-2)+star(361,308,4,'ice',-4)+star(83,305,2.6,'ice',-1);
        break;}
      case '02':{
        body=ellipse(25,87,77,125,url('iceHalo'))+ellipse(385,300,85,117,url('iceHalo'));
        [[24,38,28,27],[68,12,19,70],[29,123,18,-14],[12,254,28,-32],[46,336,34,-38],[372,313,32,22],[386,182,20,6],[355,64,29,35]].forEach((a,i)=>{body+=shard(...a,false,-i*.6);});
        body+=line('M15 70 L42 96 L21 143 M362 79 L384 108 L374 152', '#b4f5ff',1.1,'opacity=".65"')+dust('#b7f7ff',18)+star(40,33,4,'ice',-1)+star(377,280,4,'ice',-3);
        break;}
      case '03':{
        body=ellipse(36,13,117,93,url('goldHalo'))+ellipse(374,329,77,100,url('goldHalo'));
        [[18,75,50,250],[60,84,66,195],[28,102,106,311]].forEach(([x1,x2,x3,y],i)=>{body+=`<g class="gc-gold-ray" style="--delay:${-i*2}s"><path d="M${x1} -20 L${x2} -20 L${x3} ${y}Z" fill="${url('gold')}" opacity=".5"/>${line(`M${x2-13} -10 L${x3-5} ${y}`,url('gold'),1.5)}</g>`;});
        body+=`<g class="gc-gold-glint">${ribbon('M28 3 C7 90 62 155 26 260',url('gold'),1.2)}${ribbon('M387 115 C340 197 395 252 361 360',url('gold'),2)}</g>`;
        body+=dust('#ffe399',38)+star(46,20,8,'gold',-1.7)+star(368,303,4,'gold',-3)+star(24,212,2.7,'gold',-2);
        break;}
      case '04':{
        body=ellipse(11,335,108,134,url('fireHalo'))+ellipse(385,320,90,136,url('fireHalo'));
        const flames=['M-5 379 C62 330 -12 299 38 236 C15 307 75 306 61 368Z','M34 382 C88 336 34 325 81 290 C63 340 111 340 102 381Z','M393 378 C344 343 407 291 363 229 C391 314 315 322 342 378Z','M292 380 C324 349 306 334 334 311 C329 347 361 348 353 380Z'];
        flames.forEach((d,i)=>{body+=`<g class="gc-flame" style="--delay:${-i*.9}s"><path d="${d}" fill="${url('fire')}" opacity=".36" filter="${url('soft')}"/><path d="${d}" fill="${url('fire')}" opacity=".58"/></g>`;});
        body+=`<g class="gc-flame" style="--delay:-1.2s">${ribbon('M15 370 C53 340 16 325 29 294',url('fire'),1.7)}</g><g class="gc-flame" style="--delay:-2.8s">${ribbon('M382 370 C342 341 384 311 366 268',url('fire'),1.6)}</g>`+dust('#ffb74f',26,'gc-ember')+`<g filter="${url('bloom')}">${dust('#fff0ac',9,'gc-ember')}</g>`+star(358,354,2,'gold',-3);
        break;}
      case '05':{
        body=ellipse(10,133,72,160,url('mintHalo'))+ellipse(390,254,70,138,url('mintHalo'));
        const d1='M35 -10 C104 53 -34 92 45 176 C107 245 -21 289 31 382',d2='M377 -18 C306 64 430 140 358 216 C303 274 404 315 366 383';
        body+=`<g class="gc-aurora" style="--delay:-1.5s">${line(d1,url('emerald'),35,'opacity=".62" filter="'+url('soft')+'"')}${line(d1,url('emerald'),15)}${line(d1,'#b8ffda',1.8,'opacity=".82"')}</g><g class="gc-aurora" style="--delay:-4.5s">${line(d2,url('emerald'),32,'opacity=".64" filter="'+url('soft')+'"')}${line(d2,url('emerald'),12)}${line(d2,'#d5ffe6',1.5,'opacity=".88"')}</g>`;
        body+=`<g class="gc-aurora-thread">${line('M16 -10 C93 55 -43 106 28 190 S-13 310 17 380','#59ffc0',.9,'stroke-dasharray="28 20 2 12"')}${line('M391 -10 C335 62 441 132 377 221 S410 326 387 380','#86ffe0',.7,'stroke-dasharray="24 9 3 16"')}</g>`+dust('#98ffcb',27)+star(26,179,3,'ice',-4);
        break;}
      case '06':{
        [[8,76,74,110],[48,308,105,92],[381,196,80,151],[315,4,111,57]].forEach(([x,y,rx,ry],i)=>{body+=`<g class="gc-nebula" style="--delay:${-i*3}s">${ellipse(x,y,rx,ry,url('violetHalo'))}${ellipse(x+14,y-22,rx*.58,ry*.54,url('pinkHalo'))}</g>`;});
        body+=`<g class="gc-nebula-thread">${line('M8 9 C120 55 -14 91 27 165 S82 256 18 327','#e4b0ff',1,'opacity=".6"')}${line('M381 5 C338 81 407 114 374 189 S316 269 380 350','#bb7fff',2,'opacity=".5"')}</g>`;
        body+=dust('#deb0ff',28,'gc-spark')+star(34,92,4,'ice',-1)+star(349,256,4,'ice',-2.9)+star(70,315,3,'ice',-4)+star(304,20,2,'ice',-2);
        break;}
      case '07':{
        body=ellipse(15,37,84,72,url('whiteHalo'))+ellipse(384,303,80,99,url('iceHalo'));
        [[28,32,22,30],[53,63,14,-30],[13,226,21,2],[33,339,27,62],[374,332,24,-30],[385,184,12,25],[354,21,22,50]].forEach((a,i)=>body+=shard(...a,true,-i*.7));
        // A sparse, narrow transient spectral reflection. No permanent rainbow film.
        body+=`<g class="gc-silver-sweep"><path d="M-40 370 L-20 370 L211 -20 L193 -20Z" fill="${url('spectrum')}" opacity=".64"/>${line('M-18 370 L212 -20','#f7ffff',2.4)}${line('M-12 370 L218 -20','#9bcbff',.65)}</g>`;
        body+=dust('#ecf9ff',15)+star(30,29,5,'ice',-2)+star(377,325,5,'ice',-5);
        break;}
      case '08':{
        const bolts=['M41 -12 L19 48 L48 43 L25 102 L54 123 L23 181 L51 209 L28 256','M357 91 L382 131 L358 171 L389 198 L355 250 L371 280 L337 329 L354 387'];
        bolts.forEach((d,i)=>{body+=`<g class="gc-bolt-bed" style="--delay:${-i*3.2}s">${line(d,'#5a6fff',12,`opacity=".5" filter="${url('soft')}"`)}</g><g class="gc-bolt" style="--delay:${-i*3.2}s">${line(d,'#398cff',5,'opacity=".55"')}${line(d,'#d4f7ff',1.7)}</g>`;});
        body+=`<g class="gc-bolt-branch">${line('M25 102 L62 93 L78 58 M51 209 L70 236 L57 281 M48 43 L87 28','#a8c6ff',1.1)}</g><g class="gc-bolt-branch" style="--delay:-3.2s">${line('M358 171 L327 151 L316 182 M355 250 L316 263 L309 300','#a5d1ff',1.1)}</g>`+dust('#b1d8ff',14,'gc-spark');
        break;}
      case '09':{
        body=ellipse(16,202,53,150,url('iceHalo'))+ellipse(382,209,55,136,url('roseHalo'));
        [-1,1].forEach((side,i)=>{body+=`<g class="gc-orbit" style="--delay:${-i*4.5}s"><ellipse cx="200" cy="185" rx="177" ry="179" fill="none" stroke="${url('spectrum')}" stroke-width="3" transform="rotate(${side*12} 200 185)"/><ellipse cx="200" cy="185" rx="168" ry="177" fill="none" stroke="${url('spectrum')}" stroke-width=".8" transform="rotate(${side*17} 200 185)"/></g>`;});
        [0,-3.6].forEach(delay=>{body+=`<g class="gc-wave" style="--delay:${delay}s"><ellipse cx="200" cy="185" rx="188" ry="191" fill="none" stroke="${url('spectrum')}" stroke-width="2.3"/><ellipse cx="200" cy="185" rx="182" ry="186" fill="none" stroke="#e1faff" stroke-width=".65" opacity=".5"/></g>`;});
        body+=star(26,135,3,'ice',-1)+star(374,240,3,'ice',-3);
        break;}
      case '10':{
        const pieces=[['0,0 46,0 28,45','#e49648'],['46,0 92,0 71,54 28,45','#c4539f'],['0,0 28,45 0,87','#57b1ef'],['28,45 71,54 45,105 5,84','#70cad7'],['0,87 45,105 22,164 0,183','#b079eb'],['0,183 22,164 47,224 0,256','#e2a544'],['400,370 343,370 372,323','#edbd58'],['343,370 303,370 330,318 372,323','#5c9fe9'],['400,370 372,323 400,281','#b18ddd'],['372,323 330,318 356,259 395,278','#e07bae'],['400,281 356,259 382,206 400,192','#76c8ca']];
        pieces.forEach(([points,color],i)=>{body+=`<g class="gc-glass" style="--delay:${-i*.73}s"><polygon points="${points}" fill="${color}" fill-opacity=".42" stroke="#ffedc4" stroke-opacity=".8" stroke-width=".8"/><polygon class="gc-caustic" points="${points}" fill="${color}" transform="translate(${i<6?12:-12} ${i<6?16:-16})" style="--delay:${-i*.73}s"/></g>`;});
        body+=star(28,45,3,'gold',-4)+star(372,323,3,'gold',-2)+dust('#f4e5bc',14);
        break;}
      case '11':{
        // The eclipse sits at the corner, not over the central historical subject.
        body=`<g class="gc-eclipse-halo">${ellipse(310,84,89,89,url('goldHalo'))}</g>`;
        let rays='';for(let i=0;i<54;i++){const a=i*Math.PI/27,r=51,l=5+random()*17;const x=310+Math.cos(a)*r,y=84+Math.sin(a)*r; rays+=line(`M${N(x)} ${N(y)} Q${N(310+Math.cos(a+.045)*(r+l*.6))} ${N(84+Math.sin(a+.045)*(r+l*.6))} ${N(310+Math.cos(a+.06)*(r+l))} ${N(84+Math.sin(a+.06)*(r+l))}`,i%3?'#d89d42':'#ffe9ad',i%3?.65:1.25,`opacity="${N(.24+random()*.65)}"`);}
        body+=`<g class="gc-corona">${rays}</g><circle cx="310" cy="84" r="51" fill="#100e16" fill-opacity=".87"/><circle cx="310" cy="84" r="50.6" fill="none" stroke="${url('gold')}" stroke-width="2.1"/>${line('M266 65 A48 48 0 0 1 330 40','#fff4c7',1.5)}${star(274,48,4,'gold',-2)}${dust('#d7b369',17)}`;
        body+=line('M-10 300 Q56 298 53 379','#daac54',1,'opacity=".4"');break;}
      case '12':{
        [[15,94,74,145],[383,255,75,144],[85,350,91,54],[307,16,85,49]].forEach(([x,y,rx,ry],i)=>{body+=`<g class="gc-opal" style="--delay:${-i*3.6}s">${ellipse(x,y,rx,ry,url('whiteHalo'))}${ellipse(x+(i%2?-16:16),y-24,rx*.8,ry*.6,url('roseHalo'))}${ellipse(x,y+25,rx*.73,ry*.58,url('pearlBlue'))}</g>`;});
        ['M7 -8 C78 90 -6 192 35 267 S56 332 9 381','M400 -9 C335 60 415 173 366 249 S391 325 381 383','M-12 313 C29 360 63 323 112 377'].forEach((d,i)=>{body+=`<g class="gc-opal-ridge" style="--delay:${-i*3}s">${line(d,url('pearl'),16,`filter="${url('soft')}"`)}${line(d,url('pearl'),6)}</g>`;});
        body+=dust('#fff1fa',14,'gc-spark')+star(28,63,1.8,'ice',-3)+star(367,267,2,'ice',-4);break;}
      default: return '';
    }
    return `<svg class="gc-field" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 370" preserveAspectRatio="none" aria-hidden="true" focusable="false"><defs>${defs}</defs>${body}</svg>`;
  }
  function mount(card,options={}){
    if(!(card instanceof Element))throw new TypeError('카드 요소가 필요합니다.');
    const initialEffect=validateEffect(options.effect??'03');
    // Resolve all modules before replacing a working controller.
    const initialMarkup=field(initialEffect,'gc'+(++serial));
    const host=card.querySelector('.history-card__front')||card;
    if(card.__glowEffect)card.__glowEffect.destroy();
    const windowEl=document.createElement('div');windowEl.className='gc-window';windowEl.setAttribute('aria-hidden','true');host.append(windowEl);
    if(card.classList.contains('history-card'))card.classList.add('glow-kit-mounted');
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    let current=initialEffect,paused=!!options.paused||reduced.matches,destroyed=false;
    const api={
      element:windowEl,
      setEffect(value){const fx=validateEffect(value),markup=field(fx,'gc'+(++serial));current=fx;windowEl.dataset.effect=fx;windowEl.innerHTML=markup;return api;},
      setIntensity(n){windowEl.style.setProperty('--gc-intensity',String(clamp(n,0,g.GlowEffectsConfig.maxIntensity)));return api;},
      pause(){paused=true;windowEl.dataset.state='paused';return api;},
      play(){paused=reduced.matches;windowEl.dataset.state=paused?'paused':'playing';return api;},
      getState(){return {effect:current,paused,intensity:Number(windowEl.style.getPropertyValue('--gc-intensity')),visible:windowEl.dataset.visible!=='false'};},
      destroy(){if(destroyed)return;destroyed=true;observer?.disconnect();reduced.removeEventListener?.('change',onReduced);instances.delete(api);windowEl.remove();card.classList.remove('glow-kit-mounted');delete card.__glowEffect;}
    };
    const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{windowEl.dataset.visible=String(entries[0].isIntersecting);},{rootMargin:'60px'}):null;
    const onReduced=e=>{if(e.matches)api.pause();};reduced.addEventListener?.('change',onReduced);
    observer?.observe(card);windowEl.dataset.documentHidden=String(document.hidden);windowEl.dataset.state=paused?'paused':'playing';
    api.setIntensity(options.intensity??1);windowEl.dataset.effect=initialEffect;windowEl.innerHTML=initialMarkup;instances.add(api);card.__glowEffect=api;return api;
  }
  document.addEventListener('visibilitychange',()=>{for(const i of instances)i.element.dataset.documentHidden=String(document.hidden);});
  g.GlowEffects=Object.freeze({version:'1.2.0-preview.1',mount,activeCount:()=>instances.size});
})(globalThis);
