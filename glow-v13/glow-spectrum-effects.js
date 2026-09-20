/* Foreground spectra v1.2. Pure SVG geometry and CSS clocks, no image overlays.
   Host: original 400 x 370 artwork window, original frame above the effect.
   Only 07 and 18 are registered here; no tier or award rules are changed. */
(function (g) {
  'use strict';
  const registry = g.GlowReferenceRenderers || (g.GlowReferenceRenderers = {});
  const fixed = value => Number(value).toFixed(2);
  const seeded = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);

  function spectrum(uid, effect) {
    const prefix = String(uid).replace(/[^a-zA-Z0-9_-]/g, '') + '-grs-' + effect;
    const id = name => prefix + '-' + name;
    const paint = name => 'url(#' + id(name) + ')';
    const random = seeded(281107 + Number(effect) * 7919);
    let defs = '';
    const gradient = (name, stops, direction = [0, 0, 0, 100]) => {
      defs += `<linearGradient id="${id(name)}" x1="${direction[0]}%" y1="${direction[1]}%" x2="${direction[2]}%" y2="${direction[3]}%">${stops.map(([at, color, opacity = 1]) => `<stop offset="${at}%" stop-color="${color}" stop-opacity="${opacity}"/>`).join('')}</linearGradient>`;
      return paint(name);
    };
    const halo = (name, color, opacity = 1) => {
      defs += `<radialGradient id="${id(name)}"><stop stop-color="#ffffff" stop-opacity="${opacity}"/><stop offset=".13" stop-color="${color}" stop-opacity="${opacity * .86}"/><stop offset=".4" stop-color="${color}" stop-opacity="${opacity * .34}"/><stop offset=".72" stop-color="${color}" stop-opacity="${opacity * .09}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;
      return paint(name);
    };
    const clock = (duration, phase = 0) => `style="--grs-time:${fixed(duration)}s;--grs-delay:${fixed(phase)}s"`;
    const group = (cls, content, duration, phase = 0) => `<g class="${cls}" ${clock(duration, phase)}>${content}</g>`;
    const surface = (d, fill, opacity = 1, extra = '') => `<path d="${d}" fill="${fill}" opacity="${opacity}" ${extra}/>`;
    const line = (d, color, width, extra = '') => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
    const ellipse = (x, y, rx, ry, color, opacity = 1) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${color}" opacity="${opacity}"/>`;

    const white = halo('white', '#f4ffff', .94);
    const pink = halo('pink', '#ff98f1', .84);
    const cyan = halo('cyan', '#80f6ff', .84);
    const gold = halo('gold', '#fff4a3', .84);

    function flare(x, y, size, duration, phase, pearlescent = false) {
      const d = `M0 ${fixed(-size * 3.6)} Q${fixed(size * .16)} ${fixed(-size * .22)} ${fixed(size * 2.65)} 0 Q${fixed(size * .18)} ${fixed(size * .23)} 0 ${fixed(size * 3.6)} Q${fixed(-size * .18)} ${fixed(size * .23)} ${fixed(-size * 2.65)} 0 Q${fixed(-size * .16)} ${fixed(-size * .22)} 0 ${fixed(-size * 3.6)}Z`;
      return `<g class="grs-anchor" transform="translate(${x} ${y}) rotate(${pearlescent ? 34 : -12})">${group(pearlescent ? 'grs-pearl-flare' : 'grs-spectrum-flare', ellipse(0, 0, size * 8.5, size * 7, white, .83) + surface(d, '#fffef8', .98) + ellipse(0, 0, size * 1.5, size * 1.5, '#fff', .94) + (pearlescent ? ellipse(0, 0, size * 9, size * .5, white, .72) : ''), duration, phase)}</g>`;
    }

    function facet(x, y, scale, angle, phase) {
      return `<g class="grs-anchor" transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})">${group('grs-foil-facet',
        surface('M-21 -23 L23 -30 L34 9 L0 31 L-30 12Z', paint('facet'), .97) +
        surface('M-21 -23 L1 0 L23 -30Z', '#fbffff', .98) +
        surface('M23 -30 L1 0 L34 9Z', '#23f4ff', .98) +
        surface('M1 0 L34 9 L0 31Z', '#07bafd', .93) +
        surface('M1 0 L0 31 L-30 12Z', '#fcf79b', .93) +
        surface('M-30 12 L-21 -23 L1 0Z', '#eb80ff', .88) +
        line('M-21 -23 L1 0 L23 -30 M1 0 L34 9 M1 0 L0 31 M-30 12 L1 0', '#fffffc', 1.35, 'opacity=".95"') +
        line('M-21 -23 L23 -30 L34 9 L0 31 L-30 12Z', '#e5ffff', .8, 'opacity=".88"'), 4.9 + random() * 2.3, phase)}</g>`;
    }

    let body = '';
    if (effect === '07') {
      const rainbow = gradient('rainbow', [[0, '#fff56b'], [9, '#ff9448'], [19, '#ff63d4'], [28, '#ca52ff'], [36, '#4868ff'], [43, '#26d8ff'], [52, '#37f6da'], [62, '#f6f884'], [71, '#ffaf43'], [81, '#f056ed'], [91, '#7367ff'], [100, '#52fbff']]);
      const opposing = gradient('opposing', [[0, '#5bfff2'], [13, '#90efff'], [23, '#cc79ff'], [34, '#ffacec'], [46, '#fff295'], [57, '#70ffca'], [68, '#22ceff'], [81, '#8775ff'], [92, '#ff8de9'], [100, '#fff78f']]);
      const goldFilm = gradient('warm-film', [[0, '#ffee7b', .94], [24, '#ff81d9', .9], [47, '#b84bf8', .28], [66, '#48f4ff', .81], [84, '#fffda3', .92], [100, '#ff77d7', .93]], [0, 0, 100, 100]);
      const icyFilm = gradient('cool-film', [[0, '#ffffff', .98], [16, '#94fdff', .92], [37, '#50e0ff', .91], [56, '#7860ff', .81], [76, '#ff7cde', .84], [100, '#fff597', .97]], [100, 0, 0, 100]);
      const crest = gradient('crest', [[0, '#fff', .15], [14, '#ffffe4', .96], [35, '#e6ffff', .96], [51, '#fff3ff', .2], [72, '#fcffd6', .94], [91, '#fff', .94], [100, '#fff', .15]]);
      gradient('facet', [[0, '#fffff1'], [24, '#b4ffff'], [46, '#3bdbff'], [64, '#9d77ff'], [80, '#ffade7'], [100, '#fffa7e']], [0, 0, 100, 100]);

      /* Broad, bowed, tapered foil bands define the silhouette themselves.
         There is no rectangular central clip: inner folds remain in front. */
      body += ellipse(27, 48, 84, 91, gold, .62) + ellipse(372, 58, 80, 93, cyan, .64) + ellipse(24, 324, 79, 82, cyan, .65) + ellipse(373, 320, 84, 89, pink, .63);
      const films = [
        ['M96 -10 C70 6 50 22 41 48 C19 95 42 115 24 157 C13 184 21 215 17 232 C-6 201 4 175 8 146 C17 109 0 79 17 44 C29 18 44 2 60 -10Z', rainbow, 6.3, -.7],
        ['M22 193 C27 222 36 243 26 270 C11 316 55 334 89 374 L48 382 C19 349 -2 327 8 288 C17 253 8 231 22 193Z', opposing, 7.1, -3.2],
        ['M300 -13 C343 8 359 29 374 62 C388 94 375 120 391 148 C404 173 388 211 392 230 C374 209 388 177 370 153 C343 118 363 91 342 54 C335 34 311 15 279 -6Z', opposing, 6.9, -2.4],
        ['M388 194 C373 228 367 252 378 283 C391 314 350 344 314 378 L350 386 C390 352 412 323 396 287 C388 262 399 225 388 194Z', rainbow, 7.7, -5.1],
        ['M-7 40 C27 5 59 -5 130 -6 L156 4 C98 6 55 9 23 33 L-7 57Z', icyFilm, 8.1, -1.8],
        ['M267 -7 C311 -2 354 4 409 44 L409 63 C355 24 328 14 279 9Z', goldFilm, 8.7, -6.4]
      ];
      films.forEach(([d, fill, duration, phase]) => { body += group('grs-foil-flow', surface(d, fill, .9), duration, phase); });
      const folds = [
        ['M63 8 C22 37 35 70 19 101 C28 75 54 59 59 41 C64 28 67 18 63 8Z', goldFilm],
        ['M17 91 C10 124 32 145 15 180 C40 159 36 146 30 124 C26 108 32 99 40 88Z', icyFilm],
        ['M15 224 C2 269 24 290 28 304 C31 324 46 344 73 358 C51 326 53 313 35 291 C18 268 26 247 15 224Z', goldFilm],
        ['M351 14 C348 38 372 57 375 89 C393 57 372 32 351 14Z', icyFilm],
        ['M383 103 C366 130 395 153 382 184 C411 156 384 133 394 111Z', goldFilm],
        ['M382 213 C388 241 361 258 372 292 C378 318 343 340 330 357 C369 343 393 315 384 291 C374 263 399 242 382 213Z', icyFilm]
      ];
      folds.forEach(([d, fill], i) => { body += group('grs-foil-fold', surface(d, fill, .86), 5.1 + i * .37, -i * .84); });
      const rails = ['M81 0 C7 37 43 75 23 116 C10 145 27 172 18 196', 'M23 215 C9 249 15 285 34 318 C46 336 62 352 78 365', 'M320 1 C389 30 360 80 383 118 C400 144 380 175 389 202', 'M382 221 C388 255 372 275 379 299 C381 328 345 350 328 366'];
      rails.forEach((d, i) => {
        body += line(d, crest, i % 2 ? 3.1 : 3.8, 'opacity=".8"');
        body += group('grs-foil-current', line(d, '#fffef7', 2.6, 'pathLength="1000" stroke-dasharray="74 926" opacity=".96"'), 1.35 + i * .09, -i * .41);
      });
      [[35, 38, .72, -32], [366, 40, .72, 33], [25, 321, .7, 40], [373, 322, .73, -37], [17, 106, .35, 8], [387, 252, .4, -14]].forEach((args, i) => { body += facet(...args, -i * .93); });
      [[34, 34, 4.3, 4.6, -.3], [372, 48, 4, 5.4, -2.6], [30, 319, 3.8, 5.9, -3.7], [371, 326, 4.4, 6.2, -1.8]].forEach(args => { body += flare(...args); });
      for (let i = 0; i < 20; i++) {
        const x = i % 2 ? 355 + random() * 37 : 8 + random() * 39;
        const y = 26 + random() * 315;
        body += `<circle class="grs-foil-dust" cx="${fixed(x)}" cy="${fixed(y)}" r="${fixed(.48 + random() * 1.15)}" fill="${['#fffec2', '#d3ffff', '#ffd6f8'][i % 3]}" ${clock(4.1 + random() * 3.5, -random() * 9)}/>`;
      }
    }

    if (effect === '18') {
      const outer = gradient('opal-outer', [[0, '#fff8ce', .83], [15, '#ffc2ec', .88], [31, '#dccaff', .9], [45, '#a5f3ff', .88], [57, '#c5ffe1', .82], [73, '#fff5ce', .88], [86, '#f8bdff', .85], [100, '#bcefff', .9]]);
      const shell = gradient('opal-shell', [[0, '#f9ffff', .97], [13, '#fff7fa', .97], [27, '#ffc6eb', .83], [39, '#e3d7ff', .83], [51, '#c3f9ff', .94], [63, '#faffea', .98], [76, '#fff9f3', .98], [89, '#edd2ff', .89], [100, '#e3feff', .95]], [100, 0, 0, 100]);
      const pearl = gradient('opal-core', [[0, '#ffffff', .3], [13, '#fffefb', .98], [29, '#f4ffff', 1], [40, '#fff7ff', .96], [54, '#ffffff', .52], [65, '#fffdf3', .96], [81, '#ffffff', 1], [94, '#f2ffff', .96], [100, '#fffaff', .25]]);
      const wet = gradient('opal-wet', [[0, '#ffd1f0', .25], [18, '#ffffff', .97], [37, '#cafff6', .65], [50, '#ffffff', .99], [71, '#e6c4ff', .74], [90, '#ffffff', .97], [100, '#c9f8ff', .15]], [0, 100, 100, 0]);
      const inner = gradient('opal-inner', [[0, '#fac1ff', .76], [22, '#fffad8', .82], [45, '#b7fffa', .77], [67, '#ccc0ff', .73], [85, '#ffe5f1', .81], [100, '#c7f9ff', .76]], [0, 0, 100, 100]);
      const soft = halo('pearl-soft', '#fff2fc', .85);
      const mint = halo('mint', '#d3ffe6', .74);

      /* Four thick curved nacre lobes overlap with separate inner catchlights.
         No gemstone polygons, central hole, global veil, or colour filter. */
      const beds = [[34, 55, 81, 93, pink], [16, 190, 43, 110, cyan], [43, 313, 83, 81, mint], [369, 48, 77, 89, cyan], [389, 176, 45, 112, pink], [363, 316, 85, 84, soft]];
      beds.forEach(([x, y, rx, ry, fill], i) => { body += group('grs-pearl-bed', ellipse(x, y, rx, ry, fill, .68), 8.5 + i * .83, -i * 1.13); });
      const lobes = [
        'M96 -5 C41 9 34 48 28 80 C23 110 30 151 16 177 C1 151 0 115 7 80 C14 43 17 13 58 -5Z',
        'M14 183 C42 220 23 249 33 279 C40 304 53 335 88 374 L46 382 C11 342 2 312 8 281 C13 246 -4 217 14 183Z',
        'M305 -6 C360 14 370 44 376 78 C386 114 375 148 391 178 C408 139 398 111 394 78 C388 40 383 11 345 -7Z',
        'M389 180 C365 215 379 250 370 280 C360 312 348 336 307 374 L349 382 C386 347 400 314 393 280 C387 245 406 211 389 180Z'
      ];
      lobes.forEach((d, i) => { body += group('grs-pearl-lobe', surface(d, outer, .87), 8.3 + i * 1.05, -i * 1.74); });
      const nacre = [
        'M74 0 C33 31 44 52 32 92 C23 124 24 148 19 166 C8 140 12 115 20 82 C29 45 17 24 55 -2Z',
        'M18 212 C27 242 23 268 29 289 C39 323 54 342 75 360 C43 351 27 329 20 298 C13 266 16 244 18 212Z',
        'M329 0 C369 26 362 62 378 94 C390 119 377 144 387 168 C397 143 390 122 388 96 C384 61 389 28 348 -2Z',
        'M386 213 C377 242 381 267 370 296 C358 324 344 345 323 363 C353 354 376 329 382 300 C391 271 380 242 386 213Z',
        'M4 42 C21 17 68 2 120 -2 L132 7 C82 8 52 20 29 37 L13 61Z',
        'M270 0 C318 -1 358 15 397 39 L392 59 C355 30 323 11 282 11Z'
      ];
      nacre.forEach((d, i) => { body += group('grs-pearl-lamella', surface(d, shell, .95), 6.8 + i * .67, -i * 1.56); });
      const wetCores = [
        'M65 6 C24 35 40 73 27 106 C17 130 22 148 18 160 C30 141 25 120 37 97 C50 64 35 34 65 6Z',
        'M22 233 C21 282 33 319 69 351 C45 321 39 290 36 263 C34 249 30 240 22 233Z',
        'M340 8 C375 41 362 65 379 109 C388 130 380 150 388 164 C385 142 396 128 384 99 C367 61 385 38 340 8Z',
        'M380 227 C374 248 378 271 367 301 C361 322 345 343 331 354 C363 336 380 314 382 288 C386 264 376 246 380 227Z'
      ];
      wetCores.forEach((d, i) => { body += group('grs-pearl-core', surface(d, pearl, .98), 5.7 + i * .72, -i * 1.1); });
      const innerLips = ['M54 11 C22 51 51 76 33 108', 'M31 259 C29 301 46 326 75 346', 'M346 17 C384 48 358 77 378 115', 'M370 258 C382 295 353 328 329 347'];
      innerLips.forEach((d, i) => {
        body += group('grs-pearl-ridge', line(d, inner, 7.5, 'opacity=".67"') + line(d, wet, 3.6, 'opacity=".95"'), 7.3 + i * .79, -i * 1.72);
        body += group('grs-pearl-current', line(d, '#fffffb', 2.8, 'pathLength="1000" stroke-dasharray="210 790" opacity=".94"'), 4.4 + i * .51, -i * 1.02);
      });
      /* Moving pearly lens flares, broader and slower than 07's hard facets. */
      [[32, 40, 6.1, 5.8, -.6], [374, 42, 5.7, 6.7, -3.2], [34, 318, 6.3, 7.3, -4.8], [368, 323, 6.1, 6.1, -2.1]].forEach(args => { body += flare(...args, true); });
      [[19, 110, 6, 14, -12], [386, 118, 5, 13, 19], [27, 287, 7, 18, -27], [375, 280, 6, 15, 31]].forEach(([x, y, rx, ry, angle], i) => {
        body += `<g class="grs-anchor" transform="translate(${x} ${y}) rotate(${angle})">${group('grs-pearl-lens', ellipse(0, 0, rx * 1.7, ry * 1.55, soft, .74) + ellipse(0, 0, rx, ry, wet, .89) + ellipse(-rx * .24, -ry * .2, rx * .34, ry * .62, white, .98), 7.4 + i * .67, -i * 1.3)}</g>`;
      });
      for (let i = 0; i < 14; i++) {
        const x = i % 2 ? 356 + random() * 29 : 14 + random() * 33;
        const y = 38 + random() * 299;
        body += `<ellipse class="grs-pearl-mote" cx="${fixed(x)}" cy="${fixed(y)}" rx="${fixed(.5 + random() * .78)}" ry="${fixed(.65 + random() * 1.38)}" fill="${['#fffef3', '#f6e2ff', '#d9ffff'][i % 3]}" ${clock(5.2 + random() * 4.5, -random() * 12)}/>`;
      }
      /* v1.3: the complete v1.2 nacre surface is unchanged inside this static
         seat. Expand around (200,185), not around an animated bounding box:
         x' = 1.08x - 16; y' = 1.045y - 8.325. Only the original host art mask
         clips the outer spill beneath the unchanged frame and text plates. */
      body = `<g class="grs-opal-seat" transform="matrix(1.08 0 0 1.045 -16 -8.325)">${body}</g>`;
    }
    return `<svg class="gc-field grs-field" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 370" preserveAspectRatio="none" aria-hidden="true" focusable="false"><defs>${defs}</defs>${body}</svg>`;
  }
  ['07', '18'].forEach(effect => { registry[effect] = uid => spectrum(uid, effect); });
})(globalThis);
