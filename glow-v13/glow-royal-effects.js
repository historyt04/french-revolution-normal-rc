/* ID 11: luminous gold threads. Procedural vector artwork, no image effects. */
(function(g){'use strict';
  const registry=g.GlowReferenceRenderers||(g.GlowReferenceRenderers={});
  registry['11']=function(uid){
    const id=n=>uid+'-royal-'+n,U=n=>'url(#'+id(n)+')';
    let seed=11073;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    const n=v=>v.toFixed(2);
    const path=(d,stroke,w,extra='')=>`<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" ${extra}/>`;
    const defs=`<defs>
      <linearGradient id="${id('gold')}" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#a86815" stop-opacity="0"/><stop offset=".26" stop-color="#d49321"/><stop offset=".62" stop-color="#ffe49a"/><stop offset=".78" stop-color="#fffbe4"/><stop offset="1" stop-color="#d59626" stop-opacity=".1"/></linearGradient>
      <linearGradient id="${id('ray')}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff2c5" stop-opacity=".38"/><stop offset=".5" stop-color="#ffd983" stop-opacity=".12"/><stop offset="1" stop-color="#b27420" stop-opacity="0"/></linearGradient>
      <radialGradient id="${id('halo')}"><stop stop-color="#ffe39b" stop-opacity=".74"/><stop offset=".19" stop-color="#ffc85c" stop-opacity=".22"/><stop offset="1" stop-color="#eaa438" stop-opacity="0"/></radialGradient>
      <filter id="${id('bloom')}" x="-70%" y="-70%" width="240%" height="240%"><feGaussianBlur stdDeviation="2.4"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>`;
    let body='';
    // Fine rising palm/crown branches, intentionally open across the center.
    for(const side of [0,1]){
      body+=`<g transform="${side?'translate(400 0) scale(-1 1)':'translate(0 0)'}">`;
      body+=`<ellipse class="gry-aureole" cx="26" cy="155" rx="45" ry="141" fill="${U('halo')}"/>`;
      const ds=[
        'M8 368 C67 295 -12 245 36 173 C73 118 36 89 27 34',
        'M19 354 C81 268 27 235 50 192 C84 144 91 129 69 94',
        'M25 285 C28 214 -9 193 23 139 C53 87 97 61 93 21',
        'M29 215 C60 173 84 160 85 126 C86 92 117 91 126 65',
        'M24 147 C52 104 36 74 54 47 C66 31 68 16 63 4'
      ];
      ds.forEach((d,i)=>{
        body+=`<g class="gry-thread" style="--delay:${-i*1.3-side*2.1}s;--dur:${7.1+i*.83}s">`;
        body+=path(d,U('gold'),4,'opacity=".19" filter="'+U('bloom')+'"');
        body+=path(d,U('gold'),i===0?1.25:.68,'opacity=".85"');
        body+=path(d,'#fff3cb',i===0?1.4:.9,`class="gry-travel" pathLength="100" stroke-dasharray="4 96" style="--dur:${5.4+i*.61}s;--delay:${-i*.8-side*2}s"`);
        body+='</g>';
      });
      // Tiny individual gold leaves echo antique engraving without redrawing a frame.
      [[35,171,-18],[28,126,21],[60,183,-33],[80,134,14],[64,56,-12]].forEach(([x,y,r],i)=>{
        body+=`<g transform="translate(${x} ${y}) rotate(${r})"><path class="gry-leaf" d="M0 0 Q-15 -9 -7 -20 Q5 -12 0 0 M0 0 Q14 -4 13 -15 Q3 -12 0 0" fill="${U('gold')}" opacity=".55" style="--delay:${-i*1.4-side}s"/></g>`;
      });
      for(let i=0;i<5;i++){
        const x=22+i*6,y=12+i*5;
        body+=`<path class="gry-shaft" d="M${x} ${y} L${x+2} ${y+3} L${68+i*9} ${122+i*13} L${61+i*8} ${119+i*13}Z" fill="${U('ray')}" style="--delay:${-i*.9-side*1.9}s;--dur:${8+i*.7}s"/>`;
      }
      body+='</g>';
    }
    // A small crown-like flare at the upper edge; no disc, darkness or central cover.
    body+=`<g class="gry-crown">`;
    for(let i=-4;i<=4;i++){
      const x=200+i*13,y=6+Math.abs(i)*2.5;
      body+=path(`M200 -12 Q${x} ${y} ${x+i*3} ${y+20-Math.abs(i)*2}`,U('gold'),i%2?.7:1.25);
    }
    body+='</g>';
    for(let i=0;i<40;i++){
      const x=i%2?344+rand()*44:12+rand()*44,y=30+rand()*320,r=.4+rand()*1.0;
      body+=`<circle class="gry-mote" cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${i%4?'#eec071':'#fff8df'}" style="--dur:${n(5+rand()*5)}s;--delay:${n(-rand()*11)}s"/>`;
    }
    [[33,72,4],[368,96,3],[48,228,2.8],[353,265,3.2],[28,320,2]].forEach(([x,y,r],i)=>{
      body+=`<g class="gry-jewel" style="--delay:${-i*1.7}s"><circle cx="${x}" cy="${y}" r="${r*5}" fill="${U('halo')}"/><path d="M${x-r*2} ${y} Q${x} ${y-1} ${x} ${y-r*3} Q${x+1} ${y} ${x+r*2} ${y} Q${x} ${y+1} ${x} ${y+r*3} Q${x-1} ${y} ${x-r*2} ${y}" fill="#fff6d7"/></g>`;
    });
    return `<svg class="gc-field gry-field" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 370" preserveAspectRatio="none" aria-hidden="true" focusable="false">${defs}${body}</svg>`;
  };
})(globalThis);
