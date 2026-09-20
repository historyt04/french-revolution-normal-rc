/* Reference-corona effects 13–15. Procedural SVG, no image textures.
 * This optional module registers artwork-only renderers with the shared engine.
 * Existing v1.0 effect code, card assets and server effect assignments are unchanged.
 */
(function (g) {
  'use strict';
  const renderers = g.GlowReferenceRenderers || (g.GlowReferenceRenderers = {});
  const n = value => Number(value).toFixed(2);
  const seeded = seed => () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  function field(uid, effect) {
    const random = seeded(23091 + Number(effect) * 727);
    const id = name => uid + '-grh-' + name;
    const url = name => 'url(#' + id(name) + ')';
    const defs = [];
    function radial(name, color, strength = 1) {
      defs.push(`<radialGradient id="${id(name)}"><stop stop-color="${color}" stop-opacity="${strength}"/><stop offset=".16" stop-color="${color}" stop-opacity="${n(strength * .64)}"/><stop offset=".45" stop-color="${color}" stop-opacity="${n(strength * .24)}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`);
      return url(name);
    }
    function linear(name, stops, x1 = '0%', y1 = '100%', x2 = '0%', y2 = '0%') {
      defs.push(`<linearGradient id="${id(name)}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([at, color, opacity = 1]) => `<stop offset="${at}" stop-color="${color}" stop-opacity="${opacity}"/>`).join('')}</linearGradient>`);
      return url(name);
    }
    const ellipse = (x, y, rx, ry, paint, attr = '') => `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(ry)}" fill="${paint}" ${attr}/>`;
    const path = (d, color, width, attr = '') => `<path class="grh-line" d="${d}" stroke="${color}" stroke-width="${width}" ${attr}/>`;
    const timing = (duration, delay) => `style="--grh-duration:${n(duration)}s;--grh-delay:${n(delay)}s"`;
    function light(d, color, width = 1, core = '#fffce5') {
      return path(d, color, width * 13, 'opacity=".055"') + path(d, color, width * 6, 'opacity=".16"') + path(d, color, width * 2.4, 'opacity=".64"') + path(d, core, width, 'opacity=".98"');
    }
    function star(x, y, size, halo, color = '#ffffff', duration = 3) {
      const delay = -random() * duration;
      return `<g class="grh-star" ${timing(duration, delay)}>${ellipse(x, y, size * 5.4, size * 5.4, halo)}<path d="M${n(x - size * 2.8)} ${n(y)} Q${n(x - size * .22)} ${n(y - size * .19)} ${n(x)} ${n(y - size * 4)} Q${n(x + size * .22)} ${n(y - size * .19)} ${n(x + size * 2.8)} ${n(y)} Q${n(x + size * .22)} ${n(y + size * .19)} ${n(x)} ${n(y + size * 4)} Q${n(x - size * .22)} ${n(y + size * .19)} ${n(x - size * 2.8)} ${n(y)}Z" fill="${color}"/><circle cx="${n(x)}" cy="${n(y)}" r="${n(size * .48)}" fill="#ffffff"/></g>`;
    }
    let body = '';

    if (effect === '13') {
      // v1.3 adds filled, lobed volume UNDER the unchanged v1.2 centre lines.
      // No parent scaling/translation: the oval and its fine currents stay put.
      const gold = radial('solar-gold', '#ffb713', .99);
      const honey = radial('solar-honey', '#fff2aa', .98);
      const copper = radial('solar-copper', '#ed5607', .85);
      const metal = linear('solar-metal', [['0%', '#9d3408', .28], ['12%', '#ff9820'], ['28%', '#fff1a4'], ['41%', '#ffd41f'], ['56%', '#fffadc'], ['71%', '#ffb815'], ['87%', '#ed710e'], ['100%', '#a93805', .32]], '0%', '0%', '100%', '100%');
      const platinum = linear('solar-platinum', [['0%', '#ffb72f', .38], ['23%', '#fff9d5'], ['42%', '#fffef3'], ['67%', '#ffdf55'], ['85%', '#fffce8'], ['100%', '#ffa517', .25]], '0%', '100%', '100%', '0%');
      const amber = linear('solar-amber', [['0%', '#ed6706', .18], ['19%', '#ffad17', .91], ['44%', '#ffe44a'], ['66%', '#fff4ba'], ['83%', '#ffb124', .95], ['100%', '#dc5108', .12]]);
      const volumeGold = linear('solar-volume-gold', [['0%', '#a3460d', .56], ['13%', '#df7b13', .87], ['29%', '#ffcb35', .88], ['47%', '#fff1ae', .86], ['62%', '#ffc126', .78], ['82%', '#de770e', .66], ['100%', '#a9450a', .2]], '0%', '0%', '100%', '100%');
      const champagne = radial('solar-champagne-volume', '#fff2be', .78);
      // Outer contours deliberately pass beyond the artwork viewport. The
      // EXISTING artwork clip trims them beneath the unmodified card frame.
      // These are filled irregular bodies, not enlarged strokes or moved arcs.
      const solarBodies = [
        'M124 -17 C91 -15 66 -8 43 6 C18 19 1 45 -11 70 C-20 89 -20 119 -16 145 L17 151 Q40 137 47 115 C54 99 49 83 63 68 Q72 52 85 47 C94 36 102 29 113 26 Q120 12 124 -17Z',
        'M-17 110 Q-8 142 -18 173 Q-23 202 -13 226 L-17 279 Q0 291 26 278 C48 268 53 248 49 225 Q54 208 44 190 C48 173 43 157 48 140 Q36 124 28 115Z',
        'M-19 236 C-15 263 -20 286 -6 310 C4 331 4 352 25 369 Q59 392 121 386 L126 355 Q111 340 95 336 C78 326 68 313 62 296 Q48 280 53 260 C45 246 27 239 9 237Z',
        'M279 -18 C310 -15 341 -5 361 10 Q390 29 407 62 C422 85 420 119 415 149 L383 153 C362 143 354 124 350 105 Q349 85 338 70 C333 52 316 47 307 34 Q290 31 285 18Z',
        'M416 113 Q404 143 419 171 Q423 197 410 224 L416 278 C404 290 381 286 367 275 Q347 256 353 238 C346 218 357 200 353 182 Q361 163 351 146 C360 128 373 118 389 116Z',
        'M418 237 C413 263 422 286 406 309 Q397 334 379 358 C357 381 322 390 276 386 L269 355 Q284 337 304 333 C326 320 329 307 338 292 Q351 276 348 259 C359 243 378 238 396 237Z'
      ];
      solarBodies.forEach((d, i) => {
        body += '<g class="grh-solar-volume" ' + timing(7.17+i*.593,-i*1.347) + '><path class="grh-solar-body" d="' + d + '" fill="' + volumeGold + '"/></g>';
      });
      // Broad asymmetric hot clouds bridge the body and existing core. The
      // inner half is transparent; no layer crosses the central historical scene.
      [[46,42,72,63],[29,113,59,85],[25,190,54,92],[32,267,65,88],[66,335,86,55],[351,45,72,66],[374,121,61,91],[376,197,57,90],[365,274,68,88],[332,339,85,56]].forEach(([x,y,rx,ry],i)=>{
        body += '<g class="grh-solar-volume-haze" ' + timing(8.31+i*.427,-i*1.093) + '>' + ellipse(x,y,rx,ry,copper,'opacity=".53"') + ellipse(x,y,rx*.88,ry*.9,gold,'opacity=".8"') + ellipse(x,y,rx*.67,ry*.64,champagne,'opacity=".72"') + '</g>';
      });
      [[62,39,63,48],[27,110,41,71],[26,237,45,77],[62,323,65,51],[340,42,64,46],[372,121,43,75],[369,249,46,79],[334,328,66,48]].forEach(([x,y,rx,ry],i)=>{
        body += `<g class="grh-solar-heat" ${timing(4.7+i*.37,-i*.91)}>${ellipse(x,y,rx,ry,copper)}${ellipse(x,y,rx*.81,ry*.86,gold)}${ellipse(x,y,rx*.3,ry*.6,honey,'opacity=".71"')}</g>`;
      });
      const arcs = [
        ['M112 9 C84 16 65 35 52 53 Q43 64 39 79 C32 93 30 111 27 130',10.6,8.1],
        ['M27 123 C24 145 27 156 23 175 Q20 189 26 204 C22 222 30 243 31 260',8.4,9.7],
        ['M30 251 Q31 273 43 293 C47 311 67 329 84 339 Q94 348 108 353',11.1,7.9],
        ['M293 11 C322 22 344 38 355 60 Q365 74 367 90 C374 104 372 122 377 138',10.1,8.7],
        ['M376 129 C377 148 373 167 377 184 Q379 200 372 216 C376 232 368 254 365 265',8.8,10.3],
        ['M367 254 Q363 277 352 293 C344 313 324 332 307 340 Q297 349 282 355',11.7,8.3]
      ];
      arcs.forEach(([d,width,duration],i)=>{
        // Saturated amber undersides and near-white ridges keep depth at 100%.
        body += `<g class="grh-solar-arc" ${timing(4.91+i*.417,-i*.731)}>${path(d,'#ff6c08',width*3.3,'opacity=".085"')}${path(d,'#ffab13',width*2.12,'opacity=".19"')}${path(d,metal,width,'opacity=".95" stroke-dasharray="64 2 37 5 78 3"')}${path(d,'#ffc229',width*.66,'opacity=".93" stroke-dasharray="32 5 53 2 39 7"')}${path(d,platinum,width*.38,'opacity=".98" stroke-dasharray="49 5 27 7 36 3"')}</g>`;
        body += `<g class="grh-solar-current" ${timing(duration,-i*1.137)}>${path(d,amber,width*.85,'opacity=".9" stroke-dasharray="22 44 9 35 17 64"')}${path(d,'#fffef1',width*.19,'opacity="1" stroke-dasharray="14 50 4 40 10 71"')}</g>`;
      });
      // Tapered curls emerge from the core at unequal angles, so it reads as
      // turbulent golden energy rather than a uniformly thick painted hoop.
      const curls = [
        ['M39 85 C56 67 53 56 69 43 Q82 36 80 22',2.1],
        ['M63 49 Q58 31 76 22 Q84 20 92 9',1.5],
        ['M30 140 Q39 124 33 113 Q31 104 45 92',1.2],
        ['M29 213 C39 225 25 239 40 252 Q48 259 43 274',1.4],
        ['M42 286 Q61 294 60 311 Q69 322 83 321 Q91 322 99 338',2.2],
        ['M58 321 Q51 341 81 346 Q92 352 96 361',1.6],
        ['M354 73 Q341 60 346 45 Q335 35 326 37 Q316 31 313 18',1.9],
        ['M338 47 Q349 25 325 20 Q312 16 307 7',1.4],
        ['M375 149 Q363 133 368 119 Q370 106 359 93',1.1],
        ['M373 210 Q359 223 367 239 Q365 253 353 263',1.5],
        ['M354 292 Q337 290 333 311 Q325 324 310 323 Q300 330 295 341',2.3],
        ['M333 329 Q341 343 316 349 Q304 354 299 363',1.7]
      ];
      curls.forEach(([d,width],i)=>{
        body += `<g class="grh-solar-curl" ${timing(3.31+i*.293,-i*.629)}>${path(d,'#ff7d09',width*7.2,'opacity=".11"')}${path(d,amber,width*3.1,'opacity=".89"')}${path(d,platinum,width*1.12,'opacity=".97"')}${path(d,'#ffffee',width*.38,'opacity=".98" stroke-dasharray="15 5 9 3"')}</g>`;
      });
      const clusters = [[59,49],[29,121],[30,246],[65,325],[342,50],[372,131],[364,253],[332,324]];
      for(let i=0;i<64;i++){
        const [cx,cy]=clusters[i%clusters.length],x=cx+(random()-.5)*43,y=cy+(random()-.5)*61,size=.43+random()*1.58;
        body += `<g class="grh-solar-mote" style="--grh-duration:${n(3.3+random()*5.7)}s;--grh-delay:${n(-random()*9)}s;--grh-drift:${n((random()-.5)*8)}px;--grh-rise:${n(9+random()*21)}px">${ellipse(x,y,size*4.1,size*4.1,gold)}<circle cx="${n(x)}" cy="${n(y)}" r="${n(size)}" fill="${['#fffef1','#fff1a0','#ffce31','#ff9c16'][i%4]}"/></g>`;
      }
      // Small, localized lens glints. Each has its own >4 s pulse cycle; the
      // major arcs never disappear, and the whole artwork never flashes white.
      [[58,43,4.2,33],[33,109,2.4,10],[28,250,2.8,-21],[67,326,4,20],[342,48,3.8,-31],[372,130,2.2,12],[363,261,3.1,25],[328,329,4.3,-24]].forEach(([x,y,s,angle],i)=>{
        body += `<g transform="rotate(${angle} ${x} ${y})"><g class="grh-solar-glint" ${timing(4.83+i*.719,-i*.937)}>${ellipse(x,y,s*7,s*7,honey)}${ellipse(x,y,s*1.5,s*8.9,honey)}<path d="M${n(x-s*3.9)} ${y} Q${n(x-s*.29)} ${n(y-s*.25)} ${x} ${n(y-s*6.3)} Q${n(x+s*.29)} ${n(y-s*.25)} ${n(x+s*3.9)} ${y} Q${n(x+s*.29)} ${n(y+s*.25)} ${x} ${n(y+s*6.3)} Q${n(x-s*.29)} ${n(y+s*.25)} ${n(x-s*3.9)} ${y}Z" fill="#fffef2"/><circle cx="${x}" cy="${y}" r="${n(s*.7)}" fill="#fff"/></g></g>`;
      });
    }

    if (effect === '14') {
      // v1.3: a fixed, massive red-gold heat mantle with molten seams. There
      // are NO rising flame tongues, copied flame silhouettes, smoke or stars.
      // The v1.2 side paths remain the flow axes; only body volume grows outward.
      const redGold = radial('molten-redgold', '#da3b16', .93);
      const amberHeat = radial('molten-amber-heat', '#ffad29', .93);
      const whiteHeat = radial('molten-white-heat', '#fff3bd', .96);
      const mantle = linear('molten-mantle', [['0%', '#9e321b', .88], ['14%', '#d45724', .95], ['31%', '#a92f17', .84], ['47%', '#e47a2b', .92], ['62%', '#ffd36d', .81], ['74%', '#c44d20', .91], ['88%', '#df672a', .65], ['100%', '#b63719', .13]], '0%', '0%', '100%', '100%');
      const copperMetal = linear('molten-copper-metal', [['0%', '#aa351c', .18], ['16%', '#bf5529', .83], ['36%', '#e89a49', .97], ['49%', '#fff1ba', .95], ['58%', '#ffcd69', .94], ['74%', '#cf622b', .88], ['100%', '#a93518', .08]], '0%', '100%', '100%', '0%');
      const goldMetal = linear('molten-gold-metal', [['0%', '#ce4718', .05], ['17%', '#e57223', .68], ['41%', '#ffd077', .93], ['53%', '#fff2c7', .99], ['67%', '#ffb833', .9], ['85%', '#d6541b', .72], ['100%', '#a63316', .03]], '0%', '0%', '100%', '100%');
      const fissure = linear('molten-fissure', [['0%', '#e65b1e', .1], ['16%', '#ffa62e', .86], ['37%', '#ffe29a'], ['52%', '#fffbdc'], ['69%', '#ffc047', .97], ['85%', '#ee701a', .82], ['100%', '#cf4619', .06]], '0%', '100%', '100%', '0%');
      const left = 'M69 7 C63 23 43 26 45 43 C47 53 26 57 29 77 C31 88 16 99 18 122 C21 141 11 154 13 179 C16 197 8 216 14 238 C18 251 10 263 21 278 C31 291 17 303 31 315 C35 320 29 327 42 334 C50 337 48 346 62 351';
      const right = 'M337 7 C345 18 357 22 356 38 C355 49 374 56 372 74 C370 89 386 101 382 123 C379 144 391 156 387 179 C382 199 393 218 386 237 C380 251 389 266 377 280 C367 293 381 304 367 317 C360 323 367 330 353 337 C346 341 346 349 333 354';

      // Fully filled, asymmetric perimeter bodies extend past x=0/400 and
      // y=0/370. The unchanged artwork mask, then the frame, clips this underlap.
      // The centreline does not move and the clear centre is not covered.
      const mantles = [
        'M98 -17 Q60 -16 32 5 C2 23 -10 61 -16 91 L-18 174 Q-11 210 -17 247 C-21 277 -10 300 -4 325 Q4 352 28 372 C51 386 78 386 101 381 L99 352 Q84 337 71 324 C62 309 49 301 52 281 Q43 263 48 244 C40 226 49 208 43 190 Q50 173 43 156 C51 139 46 123 51 106 Q57 91 58 73 C69 58 66 43 81 34 Q95 16 98 -17Z',
        'M307 -17 Q342 -16 369 6 C397 26 412 56 417 95 L419 174 Q410 210 418 247 C422 278 411 302 403 326 Q395 353 373 372 C348 387 320 387 296 380 L299 351 Q314 337 328 323 C337 311 350 301 347 282 Q359 264 352 245 C361 227 352 209 359 190 Q350 174 357 157 C348 139 355 123 348 106 Q344 89 341 73 C333 57 335 43 321 33 Q307 17 307 -17Z'
      ];
      mantles.forEach((d,i)=>{
        body += '<g class="grh-molten-mantle" ' + timing(8.41+i*1.79,-i*3.113) + '><path class="grh-molten-body" d="' + d + '" fill="' + mantle + '"/></g>';
      });

      // Unequal, rounded masses of heated copper interlock along the old axis.
      // Their silhouette never grows upward. Slow alpha pulsation changes heat
      // without translating/scaling either the mass or the original axis.
      const cells = [[48,32,34,32],[24,75,30,40],[14,125,29,42],[12,177,31,39],[12,227,30,44],[22,279,35,44],[43,324,42,34],[74,353,45,27],[354,34,35,33],[378,77,29,40],[387,129,29,43],[387,182,32,40],[387,231,30,45],[378,281,35,43],[355,325,42,34],[325,355,46,28]];
      cells.forEach(([x,y,w,h],i)=>{
        const side = x < 200 ? 1 : -1;
        const a = .78 + random()*.24, b = .69 + random()*.25;
        const contour = 'M'+n(x-w)+' '+n(y-h*.31)+' C'+n(x-w*1.13)+' '+n(y-h*.78)+' '+n(x-w*.37)+' '+n(y-h*1.05)+' '+n(x+w*.24)+' '+n(y-h*.82)+' Q'+n(x+w*.89)+' '+n(y-h*.61)+' '+n(x+w)+' '+n(y-h*.09)+' C'+n(x+w*.95)+' '+n(y+h*.34)+' '+n(x+w*.52)+' '+n(y+h*a)+' '+n(x-w*.17)+' '+n(y+h*.79)+' Q'+n(x-w*.94)+' '+n(y+h*b)+' '+n(x-w)+' '+n(y-h*.31)+'Z';
        body += '<g class="grh-molten-lobe" ' + timing(5.79+i*.419,-i*.873) + '>' + ellipse(x,y,w*1.62,h*1.45,redGold,'opacity=".65"') + '<path class="grh-molten-cell" d="'+contour+'" fill="'+(i%3 ? copperMetal : goldMetal)+'" opacity=".82"/>' + ellipse(x+side*4,y-h*.13,w*.89,h*.63,amberHeat,'opacity=".7"') + ellipse(x+side*6,y-h*.15,w*.38,h*.37,whiteHeat,'opacity=".43"') + '</g>';
      });

      // The two exact historical axes survive as narrow metallic detail,
      // not as the mantle silhouette. Currents counterflow at independent rates.
      [left,right].forEach((d,i)=>{
        body += '<g class="grh-molten-flow'+(i?' grh-molten-flow-reverse':'')+'" '+timing(12.37+i*2.81,-i*4.113)+' data-centerline="v1.2-fixed">' + path(d,copperMetal,9.7,'opacity=".58" stroke-dasharray="43 7 19 11 58 5"') + path(d,fissure,3.1,'opacity=".95" stroke-dasharray="26 17 41 11 12 28"') + path(d,'#fff2bb',.78,'opacity=".96" stroke-dasharray="8 35 19 43 5 39"') + '</g>';
      });

      // Short, branched fissures sit inside the massive copper body. Their
      // unequal curves are fixed; only local incandescent runs travel through.
      const seams = [
        'M9 46 Q22 39 28 48 L37 45 Q47 36 62 35',
        'M3 92 L16 84 Q23 89 32 78 M18 84 Q21 71 36 65',
        'M-4 134 Q12 145 19 137 L29 140 Q32 127 43 122',
        'M4 184 L13 176 Q25 181 31 169 M14 176 Q8 165 16 152',
        'M-2 225 Q11 211 22 219 L29 214 Q34 207 41 206',
        'M5 265 Q20 252 27 258 L36 252 M24 256 Q21 240 29 235',
        'M6 300 Q25 294 34 305 L46 299 Q53 300 58 315',
        'M24 339 L41 330 Q54 337 61 330 M44 331 Q50 316 65 320',
        'M49 362 Q63 346 75 351 L86 343',
        'M390 43 Q377 39 368 48 L357 42 Q347 35 337 36',
        'M402 89 L385 82 Q376 91 368 78 M384 82 Q378 68 367 63',
        'M405 139 Q389 147 380 137 L371 141 Q366 128 357 124',
        'M397 187 L386 176 Q374 181 367 170 M386 176 Q392 161 383 153',
        'M402 227 Q389 212 378 220 L370 214 Q363 208 356 209',
        'M395 267 Q381 254 371 260 L364 251 M374 258 Q380 243 370 238',
        'M393 303 Q376 296 365 306 L353 301 Q345 304 341 316',
        'M374 340 L358 330 Q346 338 337 331 M356 332 Q352 318 338 320',
        'M349 364 Q337 347 324 353 L313 344'
      ];
      seams.forEach((d,i)=>{
        body += '<g class="grh-molten-fissure'+(i%3===0?' grh-molten-fissure-reverse':'')+'" '+timing(6.91+i*.347,-i*.793)+'>' + path(d,'#e35f19',8.7,'opacity=".15"') + path(d,fissure,2.3,'opacity=".93"') + path(d,'#fff5cc',.68,'opacity=".94" stroke-dasharray="5 12 9 17 3 14"') + '</g>';
      });

      // Brief hot-metal splinters, not stars/fireworks. Ejections include inward,
      // diagonal, upward and shallow downward vectors; no continuous rising field.
      const ejections = [[24,76],[16,135],[17,191],[15,248],[33,302],[54,335],[374,81],[385,141],[384,198],[383,253],[365,304],[344,337]];
      const vectors = [[18,-9],[13,8],[8,-18],[22,3],[12,-13],[17,11],[6,-15],[21,-5]];
      for(let i=0;i<28;i++){
        const [cx,cy] = ejections[i%ejections.length], inward = cx<200?1:-1;
        const x=cx+(random()-.5)*13,y=cy+(random()-.5)*21;
        const [vx,vy]=vectors[i%vectors.length],dx=inward*vx*(.73+random()*.41),dy=vy*(.7+random()*.55);
        const size=.37+random()*.66,trail=.15+random()*.13;
        const duration=5.31+random()*5.37,delay=-random()*11.19;
        const sparkLine='M'+n(x)+' '+n(y)+' L'+n(x-dx*trail)+' '+n(y-dy*trail);
        body += '<g class="grh-metal-spark" style="--grh-duration:'+n(duration)+'s;--grh-delay:'+n(delay)+'s;--grh-spark-x:'+n(dx)+'px;--grh-spark-y:'+n(dy)+'px">' + ellipse(x,y,size*5.2,size*4.1,amberHeat,'opacity=".66"') + path(sparkLine,i%3?'#ffc061':'#fff2b1',n(size),'opacity=".96"') + '<circle cx="'+n(x)+'" cy="'+n(y)+'" r="'+n(size*.61)+'" fill="'+(i%4?'#ffb44c':'#fff4c6')+'"/></g>';
      }
      // These flashes are compact heat spots without pointed star silhouettes.
      [[33,83,9,13],[21,248,9,15],[50,326,15,10],[369,85,8,12],[380,253,10,13],[349,331,15,10]].forEach(([x,y,rx,ry],i)=>{
        body += '<g class="grh-molten-flare" '+timing(7.63+i*.877,-i*1.317)+'>'+ellipse(x,y,rx*2.1,ry*1.8,amberHeat)+ellipse(x,y,rx,ry,whiteHeat,'opacity=".93"')+'</g>';
      });
    }

    if (effect === '15') {
      const violet = radial('violet-cloud', '#811dff', .89);
      const purple = radial('purple-cloud', '#a233ff', .84);
      const lavender = radial('lavender-cloud', '#d2a5ff', .72);
      const starHalo = radial('violet-star', '#c086ff', .95);
      const starBlue = radial('blue-star', '#a6aaff', .86);
      const wisp = linear('lavender-wisp', [['0%', '#9140ff', 0], ['28%', '#bd69ff', .23], ['53%', '#edd5ff', .59], ['75%', '#a149ff', .29], ['100%', '#9140ff', 0]], '0%', '0%', '100%', '100%');
      // Overlapping local clouds leave the historical subjects untouched in the centre.
      const clouds = [
        [40, 35, 57, 45], [12, 83, 41, 72], [25, 150, 40, 66], [9, 221, 44, 73], [31, 286, 48, 67], [60, 343, 69, 45],
        [359, 37, 55, 45], [392, 91, 39, 66], [374, 163, 43, 77], [392, 228, 43, 68], [369, 291, 46, 69], [340, 342, 64, 45]
      ];
      clouds.forEach(([x, y, rx, ry], i) => {
        const inward = x < 200 ? 1 : -1;
        body += `<g class="grh-nebula-lobe" ${timing(8.7 + i * .47, -i * 1.87)}>${ellipse(x, y, rx, ry, violet)}${ellipse(x + inward * 9, y - 12, rx * .79, ry * .63, purple)}${ellipse(x + inward * 5, y + 15, rx * .4, ry * .36, lavender, 'opacity=".48"')}</g>`;
      });
      const wisps = [
        'M28 10 C58 28 8 56 27 77 C44 91 12 109 25 131',
        'M13 160 C42 180 5 203 31 225 C47 242 18 257 29 282',
        'M34 290 C19 316 71 321 74 352',
        'M374 8 C344 32 392 51 369 75 C350 91 391 103 375 138',
        'M387 157 C356 178 395 203 370 223 C351 243 383 262 367 284',
        'M369 296 C388 320 331 328 327 359'
      ];
      wisps.forEach((d, i) => {
        body += `<g class="grh-nebula-wisp" ${timing(10.2 + i * .71, -i * 2.1)}>${path(d, '#9a3dff', 13, 'opacity=".09"')}${path(d, wisp, 4.8, 'opacity=".72"')}${path(d, '#dec0ff', .48, 'opacity=".29" stroke-dasharray="25 9 38 16"')}</g>`;
      });
      // Stars are clustered and staggered, not uniformly distributed border dots.
      const anchors = [[42, 41], [25, 96], [20, 205], [40, 284], [73, 340], [355, 43], [378, 105], [377, 219], [355, 296], [326, 346]];
      anchors.forEach(([x, y], i) => {
        body += star(x, y, 1.5 + random() * 1.1, i % 3 ? starHalo : starBlue, '#f7eaff', 2.1 + random() * 3.8);
        for (let j = 0; j < 3; j++) {
          const sx = x + (random() - .5) * 35;
          const sy = y + (random() - .5) * 43;
          const size = .35 + random() * 1.1;
          body += `<g class="grh-stellar-dust" ${timing(3.3 + random() * 5.4, -random() * 8.7)}>${ellipse(sx, sy, size * 4, size * 4, starHalo)}<circle cx="${n(sx)}" cy="${n(sy)}" r="${n(size)}" fill="${j % 2 ? '#ffffff' : '#dfb7ff'}"/></g>`;
        }
      });
      // Tiny tilted gem-like stars visible in the reference's brightest violet knots.
      [[26, 56, 2.1], [38, 252, 2.3], [359, 309, 2.7], [374, 81, 2.1]].forEach(([x, y, size], i) => {
        body += `<g class="grh-nebula-diamond" ${timing(4.4 + i * .6, -i * 1.2)}>${ellipse(x, y, 11, 11, starHalo)}<path d="M${x} ${y - size * 2} L${x + size * 1.3} ${y} L${x} ${y + size * 2} L${x - size * 1.3} ${y}Z" fill="#fbebff"/></g>`;
      });
    }
    return `<svg class="gc-field grh-field" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 370" preserveAspectRatio="none" aria-hidden="true" focusable="false"><defs>${defs.join('')}</defs>${body}</svg>`;
  }
  ['13', '14', '15'].forEach(effect => { renderers[effect] = uid => field(uid, effect); });
})(globalThis);
