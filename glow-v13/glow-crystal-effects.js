/* Reference optics v1.1. All light is SVG geometry, never a bitmap overlay.
   The host owns the artwork mask, intensity, lifecycle, and original card frame.
   Coordinates are normalized to the game's 400 × 370 artwork viewport. */
(function (g) {
  'use strict';
  const registry = g.GlowReferenceRenderers || (g.GlowReferenceRenderers = {});
  const n = value => Number(value).toFixed(2);
  const random = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);

  function opticalField(uid, effect) {
    const prefix = String(uid).replace(/[^a-zA-Z0-9_-]/g, '') + '-grc-' + effect;
    const id = name => prefix + '-' + name;
    const fill = name => 'url(#' + id(name) + ')';
    const rnd = random(71413 + Number(effect) * 419);
    const linear = (name, stops, vertical = false) => `<linearGradient id="${id(name)}" x1="0%" y1="0%" x2="${vertical ? '0' : '100'}%" y2="100%">${stops.map((entry, i) => `<stop offset="${n(i / (stops.length - 1) * 100)}%" stop-color="${Array.isArray(entry) ? entry[0] : entry}" stop-opacity="${Array.isArray(entry) ? entry[1] : 1}"/>`).join('')}</linearGradient>`;
    const radial = (name, color) => `<radialGradient id="${id(name)}"><stop stop-color="${color}" stop-opacity=".83"/><stop offset=".24" stop-color="${color}" stop-opacity=".49"/><stop offset=".62" stop-color="${color}" stop-opacity=".13"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;
    const ellipse = (x, y, rx, ry, grad, extra = '') => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill(grad)}" ${extra}/>`;
    const path = (d, color, width, extra = '') => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
    const group = (cls, content, delay = 0, extra = '') => `<g class="${cls}" style="--grc-delay:${delay}s" ${extra}>${content}</g>`;
    let defs = linear('ice', ['#f7ffff', '#80eeff', '#0783ff', '#044be9', '#b8ffff']) +
      linear('iceFace', ['#fbffff', '#c6faff', '#209dff', '#4278ff']) +
      linear('iceEdge', [['#84f9ff', 0], ['#a4f6ff', .9], ['#fff', 1], ['#187dff', .8], ['#017aff', 0]], true) +
      linear('rainbow', ['#ff93eb', '#fc53ff', '#3cd7ff', '#38ffd6', '#fff57f', '#ff9128', '#ff57d8', '#8d78ff', '#45edff'], true) +
      linear('rainbowCross', ['#c9ffff', '#5cddff', '#39ffd0', '#fff372', '#ff7cce', '#bba7ff', '#fff']) +
      linear('crystal', [['#f4feff', .93], ['#97d6ff', .5], ['#eaffff', .85], ['#d9bbff', .6], ['#fcffff', .94]]) +
      linear('crystalFace', [['#fff', .96], ['#b7ecff', .55], ['#98bdff', .15]]) +
      linear('crystalSpectral', [['#a5f8ff', 0], ['#d2ffff', .7], ['#fff', 1], ['#92e2ff', .8], ['#d6baff', .64], ['#ffc6eb', .5], ['#fff4ae', 0]]) +
      linear('pearl', [['#a4ebff', .12], ['#fff4e4', .88], ['#fff', 1], ['#ffb9e7', .76], ['#c4b9ff', .77], ['#b6f7f8', .75], ['#ffffe8', .91], ['#fff', .5]], true) +
      linear('pearlPink', [['#ffd2f4', 0], ['#ffd5ed', .9], ['#fffff5', .95], ['#b9efff', .7], ['#d9c5ff', .12]]) +
      radial('blueGlow', '#008fff') + radial('cyanGlow', '#59e7ff') + radial('whiteGlow', '#efffff') +
      radial('pinkGlow', '#ffa8ef') + radial('lilacGlow', '#baadff') + radial('mintGlow', '#82ffee') + radial('creamGlow', '#fff5c8');
    defs += `<filter id="${id('bloom')}" x="-70%" y="-70%" width="240%" height="240%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="1.6"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
    defs += `<clipPath id="${id('edgeClip')}"><path d="M0 0H400V370H0Z M76 49V313Q200 342 324 313V49Q200 28 76 49Z" clip-rule="evenodd"/></clipPath>`;

    function star(x, y, size, delay, cls = 'grc-star', color = '#edffff') {
      return `<g class="grc-anchor" transform="translate(${x} ${y})"><g class="${cls}" style="--grc-delay:${delay}s;--grc-time:${n(2.7 + rnd() * 2.8)}s"><circle r="${n(size * 5.7)}" fill="${fill('whiteGlow')}" opacity=".65"/><path d="M0 ${n(-size * 3.7)} Q${n(size * .23)} ${n(-size * .22)} ${n(size * 2.5)} 0 Q${n(size * .18)} ${n(size * .3)} 0 ${n(size * 3.7)} Q${n(-size * .18)} ${n(size * .3)} ${n(-size * 2.5)} 0 Q${n(-size * .23)} ${n(-size * .22)} 0 ${n(-size * 3.7)}Z" fill="${color}"/><circle r="${n(size * .37)}" fill="#fff"/></g></g>`;
    }

    function particles(count, colors, cls) {
      let result = '';
      for (let i = 0; i < count; i++) {
        const left = i % 2 === 0;
        const x = left ? 8 + rnd() * 45 : 347 + rnd() * 45;
        const y = 15 + rnd() * 340;
        const radius = .35 + rnd() * 1.2;
        result += `<circle class="${cls}" cx="${n(x)}" cy="${n(y)}" r="${n(radius)}" fill="${colors[i % colors.length]}" style="--grc-delay:${n(-rnd() * 12)}s;--grc-time:${n(3.5 + rnd() * 4)}s"/>`;
      }
      return result;
    }

    /* Large deliberately asymmetric natural facets, with a separate spine.
       Nested transform groups preserve placement when CSS animates the light. */
    function shard(x, y, size, angle, mode, delay) {
      const icy = mode === 'ice';
      const vivid = mode === 'rainbow';
      const base = fill(icy ? 'ice' : vivid ? 'rainbowCross' : 'crystal');
      const edge = icy ? '#b9fbff' : '#fff';
      const facet = icy ? '#1198ff' : vivid ? '#e7ff98' : '#c3efff';
      const cls = icy ? 'grc-ice-facet' : vivid ? 'grc-spectrum-facet' : 'grc-clear-facet';
      return `<g class="grc-anchor" transform="translate(${x} ${y}) rotate(${angle}) scale(${size / 36})"><g class="${cls}" style="--grc-delay:${delay}s"><path d="M-9 -36 L24 -20 L15 27 L-15 38 L-21 5Z" fill="${base}" fill-opacity="${icy ? '.94' : vivid ? '.87' : '.54'}" stroke="${edge}" stroke-width=".7"/>
        <path d="M-9 -36 L3 1 L24 -20Z" fill="${icy ? '#ecffff' : '#fff'}" opacity="${icy ? '.96' : '.83'}"/>
        <path d="M3 1 L24 -20 L15 27Z" fill="${facet}" opacity="${icy ? '.72' : '.5'}"/>
        <path d="M3 1 L-15 38 L15 27Z" fill="${icy ? '#2581ff' : vivid ? '#ff89ec' : '#d5c3ff'}" opacity=".63"/>
        <path d="M-21 5 L-9 -36 L3 1 L-15 38Z" fill="${fill(icy ? 'iceFace' : vivid ? 'rainbowCross' : 'crystalFace')}" opacity="${icy ? '.78' : '.66'}"/>
        <path d="M-9 -36 L3 1 L15 27 M-21 5 L3 1 L24 -20 M3 1 L-15 38" stroke="#edffff" stroke-width=".75" fill="none" opacity=".9"/>
        <path class="grc-facet-flare" style="--grc-delay:${delay}s" d="M-9 -36 L3 1 L-15 38 M-21 5 L3 1 L24 -20" stroke="#fff" stroke-width="1.15" fill="none"/>
      </g></g>`;
    }

    function lightThread(d, gradient, width = 1, extra = '') {
      return path(d, fill(gradient), width * 4.5, `opacity=".17" ${extra}`) + path(d, fill(gradient), width, `opacity=".91" ${extra}`);
    }

    let body = '';
    if (effect === '02') {
      body += group('grc-cold-bed', ellipse(16, 27, 84, 77, 'blueGlow') + ellipse(384, 25, 79, 72, 'blueGlow') + ellipse(14, 343, 78, 69, 'blueGlow') + ellipse(387, 341, 79, 80, 'blueGlow'));
      body += ellipse(3, 178, 30, 161, 'cyanGlow', 'opacity=".43"') + ellipse(397, 178, 30, 155, 'cyanGlow', 'opacity=".43"');
      body += group('grc-cold-thread', lightThread('M35 3 Q-3 64 18 108 Q36 145 11 197 M18 266 Q2 321 49 363', 'iceEdge', 1.4) + lightThread('M364 1 Q403 57 384 116 Q372 151 390 193 M386 257 Q401 315 352 368', 'iceEdge', 1.2));
      const shards = [[25, 26, 38, -46], [49, 14, 24, 52], [7, 57, 31, 15], [372, 23, 38, 45], [348, 11, 23, -58], [394, 62, 29, -10], [20, 337, 36, 44], [45, 354, 23, -65], [7, 294, 28, -14], [378, 337, 37, -44], [352, 356, 24, 68], [395, 295, 29, 9]];
      shards.forEach((p, i) => { body += shard(...p, 'ice', -i * .67); });
      body += group('grc-cold-needle', path('M3 144 L19 111 L10 169 L4 181 M388 182 L380 215 L397 189 M7 234 L20 255 L11 281', '#7adcff', .85, 'opacity=".82"'));
      body += particles(28, ['#bdefff', '#61dfff', '#f2ffff'], 'grc-ice-dust');
      [[34, 30, 2.8, -.2], [374, 28, 3, -2.7], [21, 323, 2.6, -1.2], [372, 342, 3.1, -3.8], [14, 121, 1.1, -2], [388, 229, 1.2, -4.3]].forEach(s => { body += star(...s); });
    }

    if (effect === '10') {
      body += group('grc-spectrum-bed', ellipse(13, 57, 56, 96, 'pinkGlow') + ellipse(15, 283, 49, 110, 'mintGlow') + ellipse(384, 74, 53, 90, 'mintGlow') + ellipse(386, 295, 62, 94, 'pinkGlow'));
      const ribbons = [
        'M67 -15 C24 29 31 73 13 102 C0 125 22 153 17 181 C11 139 -14 124 -1 90 C18 44 5 18 36 -15Z',
        'M10 178 C33 216 4 240 25 288 C39 319 35 336 80 377 L37 381 C2 345 13 314 8 287 C-10 245 17 213 10 178Z',
        'M343 -15 C380 17 373 57 391 98 C409 133 379 159 389 193 C375 163 395 131 381 112 C355 70 367 32 318 -10Z',
        'M389 177 C399 210 370 234 384 273 C397 310 374 346 335 382 L298 382 C357 339 382 308 371 275 C356 241 385 210 389 177Z',
        'M-9 31 C32 -4 75 1 125 -7 L134 4 C78 11 39 8 -9 53Z',
        'M283 375 C326 343 369 365 407 321 L407 345 C372 374 337 358 321 382Z'
      ];
      ribbons.forEach((d, i) => { body += group('grc-spectrum-ribbon', `<path d="${d}" fill="${fill(i % 3 === 0 ? 'rainbowCross' : 'rainbow')}" opacity="${i < 4 ? '.91' : '.76'}"/>`, -i * 1.39); });
      const lines = ['M58 0 C5 41 22 107 13 143', 'M16 210 C-3 291 42 330 71 369', 'M337 0 C389 42 367 92 391 147', 'M387 216 C371 256 403 307 326 370'];
      lines.forEach((d, i) => { body += group('grc-spectrum-thread', lightThread(d, 'rainbowCross', 1.75), -i * .9); });
      [[36, 33, 23, -37], [18, 80, 14, 16], [364, 28, 23, 36], [388, 71, 17, -7], [23, 326, 24, 46], [43, 359, 14, -49], [369, 323, 26, -43], [351, 351, 15, 44]].forEach((p, i) => { body += shard(...p, 'rainbow', -i * .7); });
      body += particles(24, ['#fff7ba', '#bffff6', '#ffd6fd'], 'grc-spectrum-dust');
      [[32, 32, 2.2, -1], [375, 61, 2.4, -3.5], [25, 308, 2, -2], [350, 344, 2.6, -4.8]].forEach(s => { body += star(...s, 'grc-spectrum-star'); });
    }

    if (effect === '16') {
      /* Only 16 gets these denser optical materials. The shared definitions and
         the 02/10/17 render strings remain byte-for-byte unchanged. */
      /* v1.3 seats the existing geometry, rather than scaling the crystals.
         Eighteen art units = 4.5% of the original artwork width. The original
         host mask clips the spill beneath the unchanged decorative frame. */
      const edgeX = x => x < 200 ? x - 18 : x + 18;
      const seat = (content, left) => `<g class="grc-edge-seat" transform="translate(${left ? -18 : 18} 0)">${content}</g>`;
      defs += linear('foregroundCrystal', ['#fbffff', '#d7f8ff', '#86ceff', '#eee6ff', '#ffffff']);
      defs += linear('foregroundPrism', [['#86d9ff', .34], ['#d4ffff', .9], ['#fff', 1], ['#b8dbff', .98], ['#d5b5ff', .83], ['#ffcbef', .61], ['#f6ffff', .22]]);
      defs += linear('foregroundFacet', ['#ffffff', '#f4ffff', '#a9e4ff', '#739fea']);
      body += group('grc-clear-aura', ellipse(edgeX(32), 47, 74, 84, 'whiteGlow') + ellipse(edgeX(363), 324, 71, 86, 'whiteGlow'), -1);
      body += ellipse(edgeX(31), 303, 68, 100, 'cyanGlow', 'opacity=".68"') + ellipse(edgeX(365), 63, 66, 91, 'lilacGlow', 'opacity=".58"');

      /* Continuous bowed ribbons connect the corner crystals without a middle
         exclusion hole. They stop at the shared artwork viewport, not at an
         invented inner boundary in front of the illustration. */
      const clearBands = [
        'M89 0 C37 31 35 76 26 123 C16 166 28 192 25 223 C19 271 32 322 89 370 L60 370 C14 331 8 281 12 227 C17 192 5 164 12 125 C22 75 9 38 55 0Z',
        'M314 0 C360 34 366 73 375 116 C390 159 374 190 377 227 C385 278 364 334 309 370 L340 370 C387 331 397 282 389 226 C386 190 400 155 389 115 C380 69 393 38 348 0Z',
        'M74 4 C45 17 31 40 23 65 L14 78 C19 39 34 11 58 0Z',
        'M375 294 C364 329 338 351 305 370 L328 370 C362 354 378 329 388 299Z'
      ];
      clearBands.forEach((d, i) => { body += seat(group('grc-clear-ribbon', `<path d="${d}" fill="${fill('foregroundPrism')}" opacity=".98"/>`, -i * 1.25), i % 2 === 0); });
      /* These are the exact two v1.2 thread subpaths. Separating their static
         placement does not change their geometry, stroke or animation clock. */
      body += group('grc-clear-thread',
        seat(lightThread('M77 0 C18 44 20 82 20 128 C10 182 25 205 20 254 C19 312 47 345 85 370', 'foregroundPrism', 2.5), true) +
        seat(lightThread('M325 0 C382 43 382 87 382 129 C397 182 378 213 382 254 C383 311 350 346 311 370', 'foregroundPrism', 2.5), false));

      /* No edgeClip here: the old even-odd central hole cut the moving prism
         exactly at the middle of the painting. The host still clips the whole
         effect to the original art window, below frame, year and text. */
      body += group('grc-clear-sweep', `<path d="M-98 390L-71 390L195 -25L182 -25Z" fill="${fill('foregroundPrism')}" opacity=".93"/>${path('M-73 390 L194 -25', '#faffff', 1.8, 'opacity=".96"')}`);

      const frontShard = (x, y, size, angle, delay) => {
        const time = n(4.4 + rnd() * 2.6);
        return `<g class="grc-anchor" transform="translate(${x} ${y}) rotate(${angle}) scale(${size / 36})"><g class="grc-front-crystal" style="--grc-delay:${delay}s;--grc-time:${time}s">
          <path d="M-9 -36 L24 -20 L15 27 L-15 38 L-21 5Z" fill="${fill('foregroundCrystal')}" stroke="#f5ffff" stroke-width="1.1"/>
          <path d="M-9 -36 L3 1 L24 -20Z" fill="#fff" opacity=".97"/>
          <path d="M3 1 L24 -20 L15 27Z" fill="#80c5ff" opacity=".89"/>
          <path d="M3 1 L-15 38 L15 27Z" fill="#d3b9fc" opacity=".92"/>
          <path d="M-21 5 L-9 -36 L3 1 L-15 38Z" fill="${fill('foregroundFacet')}" opacity=".94"/>
          <path d="M-9 -36 L-5 -3 L3 1Z" fill="#baffff" opacity=".94"/>
          <path d="M3 1 L15 27 L9 17Z" fill="#ffdeef" opacity=".92"/>
          <path d="M-9 -36 L3 1 L15 27 M-21 5 L3 1 L24 -20 M3 1 L-15 38" stroke="#fff" stroke-width="1.1" fill="none" opacity=".96"/>
          <path class="grc-front-crystal-glint" style="--grc-delay:${delay}s;--grc-time:${time}s" d="M-9 -36 L3 1 L-15 38 M-21 5 L3 1 L24 -20" stroke="#fff" stroke-width="2" fill="none"/>
        </g></g>`;
      };
      /* Keep all fourteen shapes, sizes, angles and phase offsets. Only the X
         anchors move outward; foreground faces never gain an inner cut-out. */
      [[40, 47, 34, -36], [65, 28, 20, 58], [27, 104, 20, -14], [23, 175, 15, 9], [30, 266, 19, -18], [40, 322, 33, 44], [70, 342, 19, -60], [359, 48, 33, 38], [334, 29, 19, -57], [374, 109, 20, 13], [377, 196, 15, -11], [369, 271, 20, 17], [360, 319, 35, -38], [332, 341, 20, 63]].forEach(([x, y, size, angle], i) => { body += frontShard(edgeX(x), y, size, angle, -i * .71); });
      body += particles(27, ['#ffffff', '#ccf4ff', '#fff1fb'], 'grc-clear-dust');
      [[38, 39, 3.6, -.4], [363, 45, 3.2, -2.2], [39, 324, 3.4, -4.3], [357, 327, 3.5, -3.1], [23, 169, 1.4, -2.8], [375, 204, 1.3, -4.7]].forEach(([x, y, size, delay]) => { body += star(edgeX(x), y, size, delay, 'grc-clear-star'); });
    }

    if (effect === '17') {
      const clouds = [[14, 44, 57, 94, 'creamGlow'], [15, 114, 46, 102, 'pinkGlow'], [11, 219, 43, 109, 'mintGlow'], [33, 332, 74, 59, 'lilacGlow'], [385, 55, 58, 98, 'pinkGlow'], [386, 168, 44, 113, 'mintGlow'], [386, 282, 51, 104, 'lilacGlow'], [350, 350, 71, 65, 'creamGlow']];
      clouds.forEach(([x, y, rx, ry, color], i) => { body += group('grc-opal-cloud', ellipse(x, y, rx, ry, color, 'opacity=".67"') + ellipse(x, y, rx * .53, ry * .71, 'whiteGlow', 'opacity=".51"'), -i * 2.2); });
      const bands = [
        'M77 -12 C5 47 42 87 12 132 C-9 166 23 197 14 229 C-9 185 -11 161 1 131 C25 77 -2 41 42 -11Z',
        'M16 201 C30 240 -4 266 19 310 C34 337 47 348 90 380 L58 390 C9 352 4 330 6 307 C-10 268 13 237 16 201Z',
        'M333 -12 C405 40 368 87 387 123 C411 165 375 187 389 223 C370 198 392 161 375 135 C345 85 385 58 310 -8Z',
        'M389 203 C374 244 409 268 380 320 C364 346 351 355 319 381 L296 387 C344 345 375 320 368 285 C360 254 384 234 389 203Z',
        'M-8 25 C27 0 61 -3 126 -10 L119 6 C74 13 28 14 -8 42Z',
        'M276 378 C322 346 381 369 411 333 L417 353 C379 376 340 362 307 386Z'
      ];
      bands.forEach((d, i) => { body += group('grc-opal-flow', `<path d="${d}" fill="${fill(i % 3 === 0 ? 'pearlPink' : 'pearl')}" opacity=".88"/>`, -i * 2.4); });
      const ridges = ['M63 -4 C-2 35 29 79 11 119', 'M8 261 C5 310 30 346 78 373', 'M344 -4 C398 37 370 84 390 137', 'M387 253 C402 302 359 348 327 373'];
      ridges.forEach((d, i) => { body += group('grc-opal-lustre', lightThread(d, 'pearlPink', 2.1) + path(d, '#fafff2', .55, 'opacity=".73"'), -i * 1.8); });
      /* Small elliptical pearls carry soft, moving catchlights, never facets. */
      [[24, 40, 9, 16, -24], [382, 63, 7, 13, 25], [26, 328, 8, 15, 31], [377, 320, 8, 16, -23], [14, 156, 3, 8, -10], [388, 213, 3, 8, 17]].forEach(([x, y, rx, ry, a], i) => {
        body += `<g class="grc-anchor" transform="translate(${x} ${y}) rotate(${a})">${group('grc-opal-pearl', `<ellipse rx="${rx}" ry="${ry}" fill="${fill('pearlPink')}" opacity=".55"/><ellipse cx="${-rx * .25}" cy="${-ry * .22}" rx="${rx * .43}" ry="${ry * .62}" fill="${fill('whiteGlow')}" opacity=".83"/>`, -i * 1.7)}</g>`;
      });
      body += particles(20, ['#fff6ed', '#ffdcf6', '#d7ffff'], 'grc-opal-dust');
      [[36, 26, 1.8, -.9], [377, 79, 1.6, -3.3], [27, 315, 1.7, -2], [365, 343, 1.9, -4.4]].forEach(s => { body += star(...s, 'grc-opal-star', '#fffdf4'); });
    }
    return `<svg class="gc-field grc-reference-field" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 370" preserveAspectRatio="none" aria-hidden="true" focusable="false"><defs>${defs}</defs>${body}</svg>`;
  }
  ['02', '10', '16', '17'].forEach(effect => { registry[effect] = uid => opticalField(uid, effect); });
})(globalThis);
