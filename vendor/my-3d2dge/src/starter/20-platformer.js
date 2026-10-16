/* =====================================================================================
 * SLICE 2  PLATFORMER  (side-scroller in the style of Castlevania: SotN, Mega Man X and Klonoa)
 * A night approach to a castle in five zones (graveyard, bailey, lava moat, rampart above the clouds, gate hall). Space jumps,
 * C dashes, X attacks (the move set is in reset()). Cut down skeletons, bats and knights, break candles for gold and hearts,
 * reach the gate. V switches to a 2.5D view, - / = zoom. How the look is built:
 *   1. SKIES   three E.Backdrops cross-faded by zone, a painted moon, a castle on its crag, soft mist, a sea of clouds
 *   2. LAYERS  two E.PlatformMaps: BACK (small-brick walls, never solid) and ROWS (big stone blocks you stand on)
 *   3. DRESS   engine props in two depth rows (against the wall, on the path in front), baked decals, an earth cut
 *   4. BLEND   PS1-style additive and half-transparent drawing, never dithered screen-door patterns
 *   5. LIGHT   each zone has a colored darkness; every flame punches a smooth hole in it and adds a colored glow
 *   6. CAST    engine rigs with E.MOVES move sets (a caped hero, rising skeletons, a knight), a hand-drawn bat
 *   7. HITS    game.hitFx (numbers stack in rows), a short tint and a flinch; 'die' topples, skeletons fall apart into bones
 *   8. ANY SCREEN  wider shows more of the level; taller (a phone held upright) lifts it onto a band of SOIL, clear of the
 *              touch buttons, and hangs the skies from the level's foot (FOOT) instead of the screen's
 * ===================================================================================== */
const PLAT = (() => {
  const T = 16, MAXHP = 80, BONE = '#e4dcc4';
  // 2. LAYERS. PLAY LAYER: a 16x16 tile per character, top row first; letters are spawn points (LEGEND).
  const ROWS = [
    '                                                                                                            ',
    '                                                                                                            ',
    '                                                                    k                                       ',
    '                                                      b       c c c                                         ',
    '                               k                b          HSSSSSSSSSSSSSSSS                                ',
    '             c                c c                          H                           k c c     k          ',
    '           c                oooooo       c c      c        H          v                                     ',
    '            k    k                      ====   c     c     H                                  g       F     ',
    '           M  v       k              SS                    H k                      SSSSSSSSSSSSSSSSSSSSSSSS',
    '          MM             SS          SS                    H                       SDDDDGDDDDDDGDDDDDDDDGDDD',
    ' @      sMMM    s        SS   g      SS   s                H    g             s   SSDDDDDDDDDDDDDDDDDDDDDDDD',
    '####################SSSSSSSSSSSSSSSSSSSSSSSSS     m     SSSSSSSSSSSS^^^SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS',
    '####################SSSSSSSSSSSSSSSSSSSSSSSSSLLLLLLLLLLLSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS'
  ];
  const LEGEND = { '#': 1, S: 2, D: 13, M: 14, G: 13, o: 5, '=': 6, H: 7, '^': 8, L: 9,
    '@': 'hero', c: 'coin', k: 'candle', g: 'knight', s: 'skeleton', b: 'bat', v: 'roost', m: 'lift', F: 'gate' };   // v: a bat roosting upside down
  // styles shade with tones of `side`; `top` colors tops in 2.5D
  const TYPES = { 1: { style: 'ground', side: '#4a3a48', top: '#4a7a62', flower: '#c8b8f0' }, 2: { style: 'stone', side: '#8a8298', top: '#5e5a72', moss: '#56704e' },   // soil, castle blocks
    13: { style: 'stone', side: '#655d78' }, 14: { style: 'stone', side: '#6c7a76', top: '#46604c', moss: '#4f7a4a' },                                    // foundation, mossy ruin
    5: { kind: 'oneway', style: 'plank', side: '#948aa4' }, 6: { kind: 'oneway', style: 'plank', side: '#8a5a3a' }, 7: { kind: 'ladder', side: '#a07850' },   // balcony, scaffold
    8: { kind: 'hazard', style: 'spikes', side: '#b8c0d8' }, 9: { kind: 'hazard', style: 'liquid', side: '#c8401a' } };                                  // lava: see lavaDraw()
  // BACK LAYER, aligned with ROWS: walls behind the play plane (never solid); small bricks behind big blocks is a cheap depth
  // cue. Letters place engine props (see PROP) or baked decals (W A t g).
  const BACK = [
    '                                                        v###                ################################',
    '                                                        ####                --------------------------------',
    '                    # # # # # # # # # # # # #           ####                #vq#########h##########h#######Q',
    '                    -v----------------------v-          ##### # # # # # # # ################N#######N#######',
    '                    #########N#########N######          ####                ################################',
    '                    ########FFFFFF############          ####----------------################################',
    '                    ####W#########W########W##          #W##w  ||  j  ||   e#########T##W####T##W##T#####T##',
    '                    --------------------------          ####   ||     ||    ####R#########C#######U#######U#',
    '          eV        ##########################          ####   P|     P|    ################################',
    '                    ##T#####T#######T####T####          #T##   ||     ||    ################################',
    'lutgpgicg  xKtigpfflI##########C##A##########I          ####   ||     ||    #Z#A############################',
    '                                                                                                            ',
    '                                                                                                            '
  ];
  // FRONT: small, darker props on the graveyard path in front of the characters
  const FRONT = ' , k,m   ,o  ,  k,m ', FP = { ',': { name: 'grass', size: 1.3, color: '#1e3430' }, k: { name: 'skull', size: .8, color: '#8a8478', dx: -5 },
    m: { name: 'mushroom', size: .45, color: '#4a1a3a' }, o: { name: 'rock', size: .9, color: '#2e2a3a' } };
  const on = (spawn, tile = 1) => ({ tile, spawn }), back = new E.PlatformMap({ rows: BACK, types: { 1: { kind: 'back', style: 'brick', side: '#6e6890', course: 6 },
    2: { kind: 'back', style: 'stone', side: '#7e789c' }, 3: { kind: 'back', style: 'stone', side: '#9a94b8' } }, legend: { '#': 1, '-': 2, '|': 3, W: on('glass'), A: on('arch'), v: on('vines'),
    T: on('torch'), N: on('banner'), C: on('candelabra'), I: on('pillar'), Z: on('brazier'), P: on('torch', 3), R: on('ruin'), F: on('rail'), U: on('statue'), h: on('chandelier'), q: on('web'), Q: on('webR'),
    t: 'tree', g: 'grave', f: 'fence', ',': 'grass', l: 'lamp', x: 'bones', p: 'ruin', k: 'skull', m: 'mushroom', i: 'offering', V: 'vines', w: 'web', e: 'webR', j: 'lantern',
    c: 'cross', u: 'urn', K: 'tomb' } });
  // shapes from the asset store (docs/ASSETS.md): a stone cross, an urn and a sarcophagus, cut from kenney-graveyard into
  // the page's 'platformer' set (src/assets/sets/platformer.js); r.shape options per BACK tag, y as PROP's
  const STONES = E.addAssets((window.ASSETS || {}).platformer || { set: 'platformer', shapes: {} }).shapes.length ? {
    cross: { id: 'platformer:cross', y: -4, scale: 1.1, facing: Math.PI / 2, mats: { a: '#5a566e speck' } },
    urn: { id: 'platformer:urn-round', y: -2, scale: 1.3, facing: Math.PI / 2 },
    tomb: { id: 'platformer:crypt-a', y: -5, scale: .9, facing: 0, mats: { a: '#605c74 speck' } } } : {};
  // 3. DRESS: r.prop options per BACK tag (y < 0: against the wall; top: hangs from its cell; name: a variant).
  const PROP = { torch: { y: -7 }, banner: { y: -8, color: '#6a1830', emblem: '#d8a040' }, candelabra: { y: -4 }, pillar: { y: -6, color: '#8a84a0' }, ruin: { name: 'pillar', broken: true, y: -5, color: '#7c7892' },
    statue: { y: -6, color: '#8e8aa4' }, brazier: { y: -4, size: 1.2 }, fence: { y: -3, color: '#34304a' }, grass: { y: -2, color: '#3e6a58' }, lamp: { y: -2, halo: false }, bones: { y: -2, color: '#b8b0a8' },
    skull: { y: -1, color: '#d8d0c0' }, offering: { name: 'candle', y: -3, size: .5 }, mushroom: { y: -1, color: '#6a3a8a', size: .6 }, vines: { y: -1, top: 1, color: '#3e7048' }, web: { name: 'cobweb', y: -7, top: 1, color: '#a8a6c8' },
    webR: { name: 'cobweb', y: -7, top: 1, flip: true, color: '#a8a6c8' }, chandelier: { y: -4, top: 1 }, rail: { name: 'fence', y: 3, color: '#7a7290' }, lantern: { y: -3, top: 1, color: '#e0902a' } };
  for (const k in PROP) if (PROP[k].top) PROP[k].anchor = 'top';
  const FLAME = { torch: 24, candelabra: 30, brazier: 20, lamp: 29, offering: 6, chandelier: -8, lantern: -8 };   // flame heights, for the light pass
  // 1. SKIES: one Backdrop per mood, far layers pale and blue; close sky stops (ramp) hide the gradient dither. The castle,
  // clouds and moon are drawn in sky().
  const ramp = (...cs) => cs.slice(1).flatMap((c, i) => [0, .2, .4, .6, .8].map(k => E.mix(cs[i], c, k))).concat(cs.slice(-1)), BG = [
    new E.Backdrop({ sky: ramp('#050820', '#0c1a3e', '#1a3460', '#2e5078'), stars: 90, layers: [{ kind: 'clouds', color: '#24345e', y: .42, height: .34, parallax: .01, drift: 2, nebula: true },
      { kind: 'mountains', color: '#34507c', y: .6, height: .24, parallax: .03 }] }),
    new E.Backdrop({ sky: ramp('#0c040c', '#2a0a18', '#5c1420', '#a8361c'), stars: 16, layers: [{ kind: 'mountains', color: '#4a1a24', y: .6, height: .28, parallax: .03, seed: 5 }] }),
    new E.Backdrop({ sky: ramp('#02030f', '#0a0f34', '#1e2860', '#4a4a88'), stars: 140, layers: [{ kind: 'mountains', color: '#5a6aa8', y: .74, height: .3, parallax: .02, snow: '#d8e0ff', seed: 12 }] })];
  // 5. LIGHT, part 1: ZONES set the sky, the darkness (color, strength) and the rim light, blended over 90 units
  const ZONES = [{ x: 0, bg: 0, amb: '#060a28', dark: .42, rim: '#a8c4ff' }, { x: 330, bg: 0, amb: '#12061a', dark: .6, rim: '#ffc890' }, { x: 720, bg: 1, amb: '#2a0404', dark: .32, rim: '#ffa060' },
    { x: 930, bg: 2, amb: '#060826', dark: .38, rim: '#b8c4ff' }, { x: 1250, bg: 2, amb: '#140610', dark: .62, rim: '#ffd8a0' }];
  const zoneAt = x => ZONES.slice(1).reduce((z, Z) => { const u = clamp((x - Z.x + 45) / 90, 0, 1); return u ? { amb: E.mix(z.amb, Z.amb, u), dark: lerp(z.dark, Z.dark, u), rim: u > .5 ? Z.rim : z.rim,
    bg: z.bg.map((w, i) => lerp(w, i === Z.bg ? 1 : 0, u)) } : z; }, Object.assign({}, ZONES[0], { bg: [1, 0, 0] }));
  // 4. BLENDING: PS1 translucency is additive ('lighter') or half (globalAlpha), never a dither. bake(): draw once, stamp often.
  const blend = (g, mode, a, fn) => { g.globalCompositeOperation = mode; g.globalAlpha = a; fn(); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; };
  const cache = new Map(), bake = (key, w, h, fn) => { if (!cache.has(key)) { const c = E.mkCanvas(w, h); fn(E.ctx2d(c)); cache.set(key, c); } return cache.get(key); };
  // soft sprites with per-pixel alpha (stacked discs would band)
  const soft = (key, w, h, c, fn) => bake(key, w, h, g => { const im = g.createImageData(w, h), rgb = E.hex(c); for (let i = 0; i < w * h; i++) im.data.set([...rgb, 255 * fn(i % w, i / w | 0)], i * 4); g.putImageData(im, 0, 0); });
  const halo = (R, c) => soft('h' + R + c, 2 * R + 1, 2 * R + 1, c, (x, y) => Math.max(0, 1 - Math.hypot(x - R, y - R) / R) ** 2);   // a light: quadratic falloff
  // mist: a seamless 320 px band, billowy on top, thickest low
  const fog = c => soft('fog' + c, 320, 32, c, (x, y) => { const u = x / 320 * E.TAU, top = 12 - 7 * Math.sin(u * 3) - 4 * Math.sin(u * 7 + 1); return y < top ? 0 : Math.sin((y - top) / (32 - top) * Math.PI) ** 1.5 * .7; });
  // 3. DECALS. Stained glass reads by its lead lines: a red and gold rose, blue lancets with a diamond lattice.
  const glass = () => bake('glass', 23, 46, g => { for (let y = 0; y < 46; y++) for (let x = 0; x < 23; x++) {
    const dx = x - 11, dy = y - 11, d = Math.hypot(dx, dy), e = y < 11 ? d : Math.abs(dx), a = (Math.atan2(dy, dx) / (Math.PI / 4) + 8) % 8, h = E.hash2((x + y) / 5 | 0, (x - y + 99) / 5 | 0), K = '#140c18';
    if (e <= 11.5) px.dot(g, x, y, e > 9.3 || y > 42 ? (dx < -1 ? '#a8a2bc' : dx > 1 ? '#4c4660' : '#7a7490') : d < 6.6 ? (d > 5.6 || a % 1 < .2 ? K : d < 1.8 ? '#fff4c8' : a & 1 ? '#e8b040' : '#c8303c')
      : y < 19 ? '#2a3a98' : !dx || y === 19 || (x + y) % 5 === 0 || (x - y + 99) % 5 === 0 ? K : h > .86 ? '#9a3ac8' : h < .1 ? '#3aa070' : h < .2 ? '#e8b040' : y < 30 ? '#5a82e8' : '#3a58c0'); } });
  // a deep arched recess: a dark interior, a ring of wedge stones, a pale keystone
  const arch = (w, h) => bake('arch' + w, w, h, g => { const R = w / 2; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = x + .5 - R, dy = y + .5 - R, d = y < R ? Math.hypot(dx, dy) : Math.abs(dx), seg = y < R ? Math.atan2(dy, dx) * 5 : y / 7, j = seg - Math.floor(seg); if (d > R) continue;
    px.dot(g, x, y, d > R - 5 ? (j < .14 || d > R - .8 ? '#1e1628' : y < 5 && Math.abs(dx) < 3 ? '#c0bad4' : Math.floor(seg) % 2 ? '#8a84a0' : '#6e6886') : y < R + 6 ? '#07040c' : y < h * .7 ? '#0e0818' : '#170e22'); } });
  // the graveyard soil in cross-section: wavy strata, buried stones, roots
  const earth = () => bake('earth', 160, 48, g => { const rnd = E.rng(4), S = ['#4a3848', '#3c2e3e', '#463646', '#30242f'];
    for (let x = 0; x < 160; x++) for (let k = 0, y = 0; k < 4; k++) { const h = [6, 11, 12, 30][k] + Math.round(2 * Math.sin((x / 160 * (k + 2) + k * .3) * E.TAU)); px.rect(g, x, y, 1, h, S[k]); px.dot(g, x, y + h - 1, '#241a28'); y += h; }
    for (let i = 0; i < 16; i++) { const x = 8 + rnd() * 144, y = 10 + rnd() * 34, w = 2.5 + rnd() * 3.5, t = E.tones(['#8a8098', '#6e6680', '#7a6a60'][i % 3]);
      px.ell(g, x, y, w + 1, w * .7 + 1, '#1e1622'); px.ell(g, x, y, w, w * .7, t.sh); px.ell(g, x - .6, y - .6, w - .8, w * .7 - .8, t.base); px.line(g, x - w * .5, y - w * .6, x + w * .2, y - w * .7, t.lt); }
    for (let i = 0; i < 10; i++) { let x = 4 + rnd() * 152; const n = 5 + rnd() * 16; for (let y = 0; y < n; y++) { x += (rnd() - .5) * 1.5; px.dot(g, x, y, '#1a1220'); if (y % 3 === 1) px.dot(g, x + 1, y, '#5a4450'); } }
 });
  // foreground weeds and rubble, scrolling faster than the camera (depth, as in Klonoa)
  const fore = () => bake('fore', 480, 36, g => { const rnd = E.rng(11); for (let x = 0; x < 480; x += 2 + rnd() * 5) px.line(g, x, 36, x + (rnd() - .5) * 6, 32 - rnd() * 14, '#04050c', rnd() < .3 ? 2 : 1);
    for (let i = 0; i < 9; i++) { const x = rnd() * 480, w = 8 + rnd() * 18; px.ell(g, x, 34, w, 5 + rnd() * 6, '#04050c'); px.ell(g, x - w * .3, 30, w * .4, 1.5, '#1a1e30'); } px.rect(g, 0, 33, 480, 3, '#04050c'); });
  // a row of cumulus (seamless): shadowed discs, the same discs lit and nudged up-left
  const CLOUD = ['#8088c0', '#545c96', '#30366a'], clouds = k => bake('cl' + k, 600, 72, g => { const t = E.tones(CLOUD[k]), rnd = E.rng(k + 3), puffs = [];
    for (let x = 0; x < 600; x += 6 + rnd() * 8) puffs.push([x, 26 + Math.sin(x / 600 * E.TAU * 3 + k) * 7 + rnd() * 5, 7 + rnd() * 10]);
    for (const [c, dx, dy, f] of [[t.deep, 0, 2, 1], [t.sh, 0, 0, 1], [t.base, -2, -3, .78], [t.lt, -4, -6, .38]]) for (const [x, y, rad] of puffs) for (const o of [-600, 0, 600]) px.disc(g, x + o + dx, y + dy, rad * f, c);
    px.rect(g, 0, 34, 600, 38, t.deep); });
  // dead trees: seeded recursive branches with a moonlit edge; also the far treeline
  const branches = (g, rnd, x, y, a, len, w, c, e) => { const x1 = x + Math.cos(a) * len, y1 = y + Math.sin(a) * len; px.line(g, x, y, x1, y1, c, Math.max(1, Math.round(w)));
    if (w > 1.4) px.line(g, x + w / 2, y, x1 + w / 3, y1, e); if (len > 4) for (const s of [-1, 1]) branches(g, rnd, x1, y1, a + s * (.3 + rnd() * .45) + (rnd() - .5) * .2, len * (.62 + rnd() * .16), w * .6, c, e); };
  const tree = seed => bake('tree' + seed, 100, 120, g => { branches(g, E.rng(seed), 50, 120, -1.57 + (seed % 3 - 1) * .12, 36, 7, '#0a0e1a', '#3a4c72'); px.poly(g, [[38, 120], [62, 120], [52, 106], [48, 106]], '#0a0e1a'); });
  const treeline = () => bake('tl', 320, 90, g => { const rnd = E.rng(5); for (let i = 0; i < 11; i++) branches(g, rnd, 8 + i * 30 + rnd() * 10, 90, -1.57 + (rnd() - .5) * .3, 14 + rnd() * 12, 4, '#0c1830', '#1c2e50'); px.rect(g, 0, 84, 320, 6, '#0c1830'); });
  // the far castle on its crag: conical roofs, lit windows, a moonlit rim
  const castle = (c, e, win) => bake('castle' + c, 190, 170, g => { const rnd = E.rng(3), hi = E.mix(e, '#ffffff', .3);
    px.poly(g, [[0, 170], [26, 120], [50, 104], [66, 112], [82, 98], [150, 100], [168, 120], [190, 170]], c); px.line(g, 150, 100, 190, 170, e, 2); px.rect(g, 30, 84, 130, 20, c); for (let x = 30; x < 160; x += 4) px.rect(g, x, 81, 2, 3, c);
    for (const [x, w, top, roof] of [[40, 12, 70, 14], [62, 10, 56, 12], [78, 16, 40, 22], [100, 20, 30, 30], [126, 12, 50, 16], [144, 10, 64, 12]]) {
      px.rect(g, x, top, w, 104 - top, c); px.rect(g, x + w - 3, top, 3, 104 - top, e); px.rect(g, x + w - 1, top, 1, 104 - top, hi); px.poly(g, [[x - 2, top], [x + w + 2, top], [x + w / 2, top - roof]], c); px.line(g, x + w / 2, top - roof, x + w + 1, top, hi);
      for (let y = top + 5; y < 96; y += 7) if (rnd() < .45) px.rect(g, x + 2 + Math.floor(rnd() * (w - 5)), y, 2, 3, win); } });
  const grave = v => bake('grave' + v, 18, 27, g => { const t = E.tones(v ? '#6e6c86' : '#848498'); px.rect(g, 2, 8, 14, 19, t.sh); px.disc(g, 9, 8, 7, t.sh); px.rect(g, 3, 8, 11, 18, t.base); px.disc(g, 8, 8, 5.6, t.base);   // tombstone with a cross
    px.rect(g, 12, 5, 2, 20, t.lt); px.rect(g, 7, 7, 2, 10, t.deep); px.rect(g, 5, 9, 6, 2, t.deep); px.rect(g, 0, 24, 18, 3, '#243e30'); px.rect(g, 2, 23, 5, 1, '#3e6a48'); });
  // the dialog portrait: a hand-placed E.sprite like SotN's close-ups
  const VALE = E.sprite([
    '.................DDDDDDDDD',
    '.............DDDDDDDCAADDDDD',
    '........DDDDDDDDDDDAABCCBBDDDDD',
    '........DDDDDDCCAAACCBCCCCBBBDDDD',
    '.......DDDDDDDAACCCCCCBCCCCBCBBDD',
    '.......DDDDDAADBCCCCCCBCCCCCBCCDD',
    '......DDDDAADCDCBCCCCCCBCCCCBCCCDD',
    '......DDDDDDDCBCCCCCCCDBCCCCCBCCCD',
    '......DDDDDDDCBCCCCDCDcCCCCDcBCCCD',
    '.....DDDDDDDDDBCCCCDCDcCCCCDcCCCDD',
    '.....DDDDEDDCDBCCCCDCDccCCDEEECCDDD',
    '....DDDDDEDDCDBCCCCDCDccCCDcccCCDDD',
    '....DDDDDEDDCDBCCCCDDdcccDcccccDcDD',
    '....DDDDDEDDCDCBCCCDDdcccDcccccDcD',
    '....DDDDDEDDCDCBCCDCDccckkkkkkkccD',
    '....DDDDEDDCDDEBCCDCDcccccwAiwcdcc',
    '....DDDDEDDCDDEBCCDDdcccccwiiwccdc',
    '....DDDDEDDCDDEBCCDDdcccccccccccdc',
    '.....DDDEDDCDDEBCCDddccccccbbccccd',
    '.....DDDEDDCDDECCCDddccccccccccccdc',
    '.....DDDEDDCDDECCCDdddcccccccccccca',
    '.....DDDEDDCDDEDCCDdddcccccccccccccc',
    '.....DDDEDDCDDEDCCDdddccccccccccec',
    '.....DDDEDDCDDEDCCDdddcccccccccccc',
    '.....DDEDDCDDEDDCDdddddccccccccccc',
    '.....DDEDDCDDEDDCDdddddccccccccccc',
    '.....DDEDDCDDEDDCDddddddccccmmmmc',
    '.....DDEDDCDDEDDDDddddddcccccdccc',
    '.....DDEDDCDDEDDDDDddddddcccccce',
    '.....DDEDDCDDEyDDDDddddddcccceer',
    '.....DDEDDCDDEryyDDdddddddccerrrr',
    '.....DDEDDCDvErrryddddeeeeeerrrrr',
    '....DDvvvvvvvrrrrryydddddyrrrrrrr',
    'vvvvvvvvvvvvvrrrrrrryydyyrrrrrrrrr',
    'vvvvvvvvvvvvvrrrrrrrrryrrrrrrrrrrr',
    'vvvvvvvvvvvvvrrrrrrrrrrrrrrrrrrrrr',
    'vvvvvvvvvvvvrrrrrrrrrrrrrrrrrrrrrr',
    'vvvvvvvvvvvvrrrrrrrrrrrrrrrrrrrrrrr'], { a: '#fff0e0', b: '#fce0c8', c: '#f0c8a8', d: '#d49a88', e: '#9a6070', A: '#ffffff', B: '#eceaf8', C: '#cfcbe6', D: '#9a94c0', E: '#5a5288',
    v: '#2a2256', r: '#8a1a30', y: '#f0c860', k: '#2a1020', w: '#f8eef0', i: '#a01830', m: '#b05868' });
  // 6. CAST, part 1: the bat, drawn by hand. f.beat: wing phase, f.open: spread (0..1). Upside down on the roost and dead, it
  // rolls upright in the screen plane when it drops (never edge-on); f.tilt cocks it before a dive.
  function bat(g, x, y, f) {
    const s = Math.sin(f.beat) * f.open, sp = .3 + .7 * f.open, c = E.tones('#4a2a5a'), a = (f.roost || f.dead ? Math.PI : Math.PI * clamp((f.drop + .05) / .15, 0, 1)) + f.tilt; y -= 9;
    if (a) { g.save(); g.translate(x, y); g.rotate(a); g.translate(-x, -y); }
    for (const d of [-1, 1]) {
      const P = (a, b) => [x + d * a * sp, y + b], w = P(7, -3 - s * 5), tips = [P(15, -s * 6), P(11, 5 - s * 3), P(5, 6)];
      px.poly(g, [P(2, -2), w, tips[0], P(11, 1 - s * 4), tips[1], P(7, 3 - s), tips[2], P(2, 3)], c.sh);   // membrane, scalloped between the fingers
      for (const p of tips) px.line(g, w[0], w[1], p[0], p[1], c.lt);
      px.line(g, x + d * 2, y - 1, w[0], w[1], c.hi, 2); px.dot(g, w[0], w[1] - 1, '#e8dcf0');   // arm and thumb claw
      px.poly(g, [[x + d * 1, y - 4], [x + d * 3, y - 10], [x + d * 3, y - 3]], c.deep);   // ear
    }
    px.ell(g, x, y + 1, 3, 4.5, c.deep); px.ell(g, x - .5, y + 1.5, 2, 3, c.base); px.dot(g, x - 1, y + 2, c.lt);
    px.disc(g, x, y - 3, 2.6, c.sh); px.dot(g, x - 1, y - 4, c.lt); for (const d of [-1, 1]) { px.dot(g, x + d, y - 3, '#ff4a2a'); px.dot(g, x + d, y - 1, '#ffffff'); }
    if (a) g.restore();
  }
  // 6. CAST, part 2: E.MOVES move sets. HIT per hero move: box [forward, behind, low, high], damage x, knockback, launch.
  const HIT = { slash: [27, 6, -6, 52, 1, 90, 50], backslash: [27, 6, -6, 52, 1, 90, 70], overhead: [31, 4, -6, 60, 1.5, 170, 90],
    rising: [26, 4, 8, 80, 1.2, 120, 240], thrust: [38, 0, 6, 40, 1.3, 180, 40], spin: [28, 28, -4, 50, 1.4, 150, 110], plunge: [12, 12, -18, 16, 1.2, 40, 0] };
  const CHARGE = .45;                                  // seconds of holding X for the spin
  // Enemies: their own moves, slow enough to dodge (a long wind-up, a glint on the raised blade). heavy: never staggered.
  // LUNGE: a thrust draws the blade back (the telegraph), then lunges on the hit.
  const LUNGE = { r0: -1.5, a0: .15, lunge: 4, active: .1 };
  const FOES = {
    // a knight: bulky, plate over a violet tabard; a slow two-hand cleave, a lunging thrust
    knight: { hp: 90, w: 14, h: 34, pts: 300, walk: 20, chase: 34, dmg: 16, heavy: true, make: () => ({ moves: [new E.Attack('twohand', { range: 32, wind: .5, active: .16, recover: .5 }),
      new E.Attack('thrust', { range: 44, wind: .42, recover: .45, ...LUNGE })], rig: new E.Humanoid({ size: 1.3, build: 'bulky',
      armor: true, sleeves: 'long', outfit: 'tunic', hat: { style: 'helmet', color: '#8a92b0' }, eyeGlow: '#ff5a30', bladeLen: 14,
      colors: { skin: '#1a1422', cloth: '#5a2a78', pants: '#767c98', boot: '#3e3e52', metal: '#9aa2bc', glove: '#767c98', belt: '#8a6a3a', trim: '#d8b050' } }) }) },
    // a skeleton: a heap of bones (down: 1) until you come near; it grabs its blade and rises through 'kneel'
    skeleton: { hp: 30, w: 12, h: 30, pts: 200, walk: 22, chase: 30, dmg: 10, make: () => ({ sleep: 1, rise: 0, moves: [new E.Attack('overhead', { range: 22, wind: .4, active: .15, recover: .45 }),
      new E.Attack('thrust', { range: 32, wind: .34, recover: .4, ...LUNGE })],
      rig: new E.Humanoid({ size: 1.2, build: 'skeleton', weapon: null, cheat: .85, headR: 2.8, hunch: .4, bladeLen: 10, colors: { bone: BONE, cloth: '#1c1424', belt: '#6a5a44', metal: '#a89a80', hilt: '#5a4430' } }) }) },
    bat: { hp: 12, w: 16, h: 12, pts: 150, make: () => ({ open: 1, beat: 0, cool: 1, drop: -1, tilt: 0 }) }
  };
  const DEBRIS = { knight: ['#c0c8e0', '#5a2a78', '#e0d4b8'], skeleton: [BONE, '#b0a68c', '#fff4dc'], bat: ['#4a2a5a', '#8a6a9a', '#1a0c22'] };
  const S = { shadow: '#05030a', outline: false }, SC = Object.assign({ align: 'center' }, S);   // HUD text styles
  const talk = new E.Dialog(game, { bg: ['#2a2450', '#0e0a1e'], border: '#e0d0a8' }), say = text => talk.say(text, { name: 'VALE', auto: 2.5,
    portrait: (g, x, y) => { E.ui.box(g, x - 2, y - 2, 44, 44, { bg: ['#4a1a3a', '#0c0612'], border: '#e0d0a8' }); px.sprite(g, VALE, x, y + 2); if (game.real % 4 < .12) px.rect(g, x + 26, y + 17, 4, 2, '#f0c8a8'); } });   // + a blink
  const fx = [], lights = [], shafts = [], addFx = (kind, x, z, o) => fx.push(Object.assign({ kind, x, z, t: 0, max: .3, size: 1, c: '#ffffff', vx: 0, vz: 0, dir: 1 }, o));
  let level, hero, rig, combo, MV, atk, charge, idle, land, foes, coins, candles, drops, lift, lives, score, gold, hp, inv, cheer, clear, spawn, gate, lava, age, hint, darkCv, rimWas;
  // 8. ANY SCREEN: soil = the band of earth under the level on a screen taller than it (0 on a wide one); FOOT = the level's
  // foot on screen when the camera rests on the ground (the screen's bottom edge, or the top of the soil): the skies hang from it
  let soil = 0, FOOT = 240;
  const soilFor = (b, H) => { const lh = b.y1 - b.y0; return H > lh ? Math.min(160, Math.round((H - lh) * .55)) : 0; };

  function reset(full) {
    if (full) {
      level = new E.PlatformMap({ rows: ROWS, legend: LEGEND, types: TYPES }); lives = 3; score = 0; gold = 0; clear = false; spawn = level.find('hero'); gate = level.find('gate'); drops = []; fx.length = 0;
      coins = level.findAll('coin').map(c => ({ x: c.x, z: c.z + 3, w: 8, h: 10 }));
      candles = level.findAll('candle').map(c => ({ kind: 'candle', x: c.x, z: c.z, w: 10, h: 20 }));
      foes = level.spawns.filter(s => FOES[s.tag] || s.tag === 'roost').map(s => { const kind = FOES[s.tag] ? s.tag : 'bat';   // a roost is a bat asleep, wings folded
        return Object.assign({ kind, x: s.x, z: s.z, vx: 0, vz: 0, t: Math.random() * 9, flash: 0, stun: 0, cool: 0, dir: -1 }, FOES[kind], FOES[kind].make(), s.tag === 'roost' && { roost: true, open: 0 }); });
      const m = level.find('lift'), cols = []; lift = { x0: m.x, x: m.x, z: m.z + 10, w: 44, h: 6, vx: 0, vz: 0, t: 0 };
      for (let cx = 0; cx < level.w; cx++) if (level.cell(cx, 0) === 9) cols.push(cx * T); lava = { x0: cols[0], x1: cols[cols.length - 1] + T, z: T };
    }
    hero = new E.Platformer({ x: spawn.x, z: spawn.z, w: 10, h: 30, run: 105, jump: 300, dash: 250, dashTime: .2 });
    // The hero: 'heroic' build, cheat: .7 turns him to the camera; a readable palette on dark stages.
    rig = rig || new E.Humanoid({ size: 1.25, build: 'heroic', outfit: 'coat', hair: { style: 'long', len: 4 }, sleeves: 'long', stride: 6, lift: 4.6, swing: 5.5, lean: .06, bladeLen: 13, cheat: .7, face: { eyes: 'big', bangs: .2 }, cape: { len: 5, width: 6, seg: 2.6 },
      colors: { skin: '#f4d2b0', hair: '#e4e0f4', cloth: '#b02840', coat: '#861a30', pants: '#d8ccb8', boot: '#3a2638', belt: '#3a2020', trim: '#f0c860', glove: '#f4f0e8', metal: '#dce6f4', hilt: '#f0c050',
        cape: '#3a2e70', capeIn: '#5a6ad8', eye: '#2a1840' } });
    // the hero's moves, tuned for the side view: X chains a chest-high chop > a backhand around the body from behind the head
    // (plane: 'ground', the torso turns) > a stepping, crouching overhead; up + X rising; down + X in the air a plunge (a tuck,
    // then the blade driven below the feet); X in a dash thrust; hold X: spin
    combo = new E.Combo([new E.Attack('slash', { a0: 1.35, a1: -.45 }), new E.Attack('backslash', { plane: 'ground', a0: -2.6, a1: .6, z0: 5, z1: -9, twist: 2 }),
      new E.Attack('overhead', { lunge: 3.5, crouch: .7, a1: -.9 })], { window: .3 });
    const spin = new E.Attack('spin', { a0: .3 });      // side views: a windmill loop in front that ends blade forward
    MV = { rising: new E.Attack('rising', { a1: 1.45, recover: .42 }), plunge: new E.Attack('plunge', { hand: 'both', lean: .45, a0: 1.3, r0: 4, r1: 9.5, wind: .1, active: .28 }), thrust: new E.Attack('thrust'), spin,
      charge: { spec: { ...spin.spec, plane: 'side', a0: 2.4 }, phase: 'wind' } };   // charging holds the blade raised behind the head; on release it chops into the spin
    atk = null; charge = idle = land = 0; hp = MAXHP; inv = full ? 0 : 1.5; cheer = 0;   // inv: blink after a respawn
    game.follow(hero, { z: 34, lead: 24 });            // the camera tracks the hero, looking ahead
  }
  // 7. HITS. A kill: an additive glow, then the engine explosion with debris in the victim's colors
  function burst(x, z, s, colors) { addFx('glow', x, z, { max: .25, size: 22 * s, c: '#ff9a40' }); P.explosion(x, 0, z, s, { debris: colors, flash: false }); }
  function crumble(f) {                                // the end of a foe: a burst; a skeleton falls apart into a skull and bones
    f.corpse = 0; if (f.kind !== 'skeleton') return burst(f.x, f.z + (f.rig ? 6 : f.h / 2), f.rig ? .9 : .6, DEBRIS[f.kind]);
    P.dust(f.x, 0, f.z + 2, 12, { color: '#8a8070' }); A.sfx('bump', { pitch: .6 });
    for (let i = 0; i < 7; i++) addFx('blade', f.x + E.rand(-9, 9), f.z + 4, { max: 1.5, vx: E.rand(-50, 50), vz: E.rand(40, 130), a: E.rand(0, 6), spin: E.rand(-14, 14), L: i ? E.rand(4, 8) : 0, c: BONE });
  }
  // a fallen fighter drops the sword (weapon: null): it tumbles, bounces and lies flat (see update)
  function disarm(rg, dir, max) {
    const h = rg.hand(), t = rg.tip(); rg.o.weapon = null;
    addFx('blade', (h[0] + t[0]) / 2, (h[2] + t[2]) / 2, { max, vx: dir * 50, vz: 110, a: Math.atan2(t[2] - h[2], t[0] - h[0]), spin: dir * -12, L: rg.o.bladeLen * rg.o.size, c: rg.C.metal, h: rg.C.hilt });
  }
  function hurt(dir, n = 10) {
    if (inv > 0 || clear || hero.ko) return; hp -= n; inv = 1.2; hero.knock(dir); A.sfx('hurt'); game.flash('#ff2030', .12, .25); stop();   // knocked back (the hurt pose)
    game.hitFx(hero.x, 0, hero.z + 24, { power: 1.2, angle: dir > 0 ? 0 : Math.PI, color: '#ff8080', sound: false, damage: n, textZ: 32, textScale: 2, textColor: '#ff6a6a' });
    if (hp <= 0) die();
  }
  const stop = () => { if (atk) atk.cancel(); charge = 0; };   // a hit interrupts the hero's move
  function die() {                                     // knocked out: pose 'down', then respawn or game over
    if (hero.ko) return; hp = 0; lives--; hero.ko = 1.6; stop(); disarm(rig, -hero.facing, 1.6); A.sfx('die'); game.flash('#ffffff', .5, .7); game.shake(4);
    addFx('glow', hero.x, hero.z + 16, { max: .5, size: 30, c: '#ff4060' }); P.sparks(hero.x, 0, hero.z + 16, 14); P.bits(hero.x, 0, hero.z + 20, 8, ['#b02840', '#e4e0f4', '#f0c860']);
  }
  // one hit: game.hitFx (hit-stop, shake, star, sparks, sound, a number), a slash flare, chips and a flinch (f.flash),
  // knocked back (and up) by the move's HIT speeds
  function damage(f, n, dir, crit, k) {
    f.hp -= n; f.flash = .3; f.vx = dir * (k ? k[5] : 60) * (f.heavy ? .3 : 1); const z = f.z + f.h * .55;
    if (!f.heavy) { f.stun = .4; f.vz = k ? k[6] : 60; f.swoop = null; if (f.atk) f.atk.cancel(); }
    f.pop = game.time - f.popT < .8 ? (f.pop + 1) % 3 : 0; f.popT = game.time;   // quick hits stack their numbers in rows
    game.hitFx(f.x - dir * 3, 0, z, { power: crit ? 2 : 1, angle: dir > 0 ? 0 : Math.PI, color: crit ? '#ffd040' : '#ffe8a0', damage: n, textZ: 26 + f.pop * 16, textScale: 2, textColor: crit ? '#ffd040' : '#ffffff' });
    addFx('cut', f.x, z, { max: .14, dir, c: crit ? '#ffe066' : '#c8f0ff' }); P.bits(f.x, 0, z, 4, DEBRIS[f.kind]);
    if (f.hp > 0) return;
    f.dead = true; f.corpse = f.rig ? 1.2 : .5; score += f.pts; P.text(f.x, 0, f.z + f.h + 50, '+' + f.pts, '#ffe066');
    if (f.rig) disarm(f.rig, dir, 1.2);
  }
  function snuff(c) {                                  // a candle: a puff of light, chips and loot that drops
    c.dead = true; addFx('glow', c.x, c.z + 16, { max: .2, size: 16, c: '#ffb050' }); P.sparks(c.x, 0, c.z + 16, 6); P.bits(c.x, 0, c.z + 12, 8, ['#e8dcc0', '#ffb040', '#4a4058']); A.sfx('bump');
    drops.push({ x: c.x, z: c.z + 8, w: 8, h: 8, vx: 0, vz: 140, heart: Math.random() < .35 });
  }
  // facing angle; in the 2.5D view foes turn 3/4 to the camera
  const face = dir => (dir < 0) * Math.PI + dir * (game.view.pitchDeg > 5) * .5;
  // is f inside the box [forward, behind, low, high] ahead of a (facing dir)?
  const within = (a, dir, f, [fw, bk, lo, hi]) => { const dx = (f.x - a.x) * dir; return dx > -bk - f.w / 2 && dx < fw + f.w / 2 && f.z < a.z + hi && f.z + f.h > a.z + lo; };
  function updateFoe(f, dt) {
    const dx = hero.x - f.x, dz = hero.z - f.z, near = Math.abs(dx) < 90 && Math.abs(dz) < 30 && !(hero.ko > 0), facing = face(f.dir); f.t += dt; f.flash -= dt; f.stun -= dt; f.cool -= dt;
    const ov = (hero.w + f.w) / 2 - Math.abs(dx), push = ov > 0 && Math.abs(dz) < f.h && f.onGround ? (Math.sign(dx) || f.dir) * ov * 10 : 0;   // never stand inside the hero: step out
    if (f.dead) {                                      // carried by the blow, a rig dies (stagger, buckle, topple), a bat tumbles; then they crumble
      f.corpse -= dt; f.vz -= 700 * dt; f.vx = approach(f.vx, 0, 250 * dt) - push; level.move(f, dt); if (f.corpse <= 0) crumble(f);
      return f.rig && f.rig.update(dt, { x: f.x, y: 0, z: f.z, vx: 0, vy: 0, facing, pose: 'die' });
    }
    if (Math.abs(dx) > 260) return;                    // sleep until near, like 16-bit enemies
    if (f.kind === 'bat') return fly(f, dt, dx);
    if (f.sleep) {                                     // a heap of bones until the hero comes near; then it pulls itself up
      if (Math.abs(dx) < 100 && Math.abs(dz) < 40) { f.sleep = 0; f.rise = .9; f.cool = 1.5; f.rig.o.weapon = 'sword'; f.dir = Math.sign(dx) || -1; P.dust(f.x, 0, f.z + 2, 10, { color: '#8a8070' }); A.sfx('bump', { pitch: .5 }); }
      return f.rig.update(dt, { x: f.x, y: 0, z: f.z, vx: 0, vy: 0, facing, down: 1 });
    }
    if (f.rise > 0) { f.rise -= dt; return f.rig.update(dt, { x: f.x, y: 0, z: f.z, vx: 0, vy: 0, facing, down: clamp((f.rise - .5) * 2.5, 0, 1), pose: f.rise > .2 ? 'kneel' : null }); }   // sit up, kneel, stand
    // walkers: patrol, close in on a near hero (weapon ready), wait at ledges, telegraph and strike
    const busy = f.atk && f.atk.busy, free = !busy && f.stun <= 0 && f.onGround;
    if (near && free) f.dir = Math.sign(dx) || f.dir;
    const ahead = level.groundBelow(f.x + f.dir * 9, f.z + 1), blocked = f.hitWall === f.dir || (f.onGround && (ahead === null || ahead < f.z - 1));
    if (blocked && !near) f.dir = -f.dir;              // turn at walls and ledges
    f.vx = (f.stun > 0 || !f.onGround ? approach(f.vx, 0, (f.onGround ? 500 : 60) * dt) : busy || blocked || (near && Math.abs(dx) < f.moves[0].spec.range - 4) ? 0 : f.dir * (near ? f.chase : f.walk)) - push;   // stunned: slide back; in reach: hold ground
    const m = near && free && f.cool <= 0 && Math.abs(dz) < 24 && f.moves.find(mv => Math.abs(dx) < mv.spec.range);
    if (m) { f.atk = m; m.start(); f.cool = .8; }
    if (f.atk) { if (f.atk.update(dt) === 'active') A.sfx('swing', { vol: .6, pitch: .7 }); f.atk.hits([hero], h => f.atk.u > .5 && within(f, f.dir, h, [f.atk.spec.range + 6, 8, -6, 52]), () => hurt(f.dir, f.dmg)); }   // once the blade is low (or the thrust out)
    f.vz -= 900 * dt; level.move(f, dt);
    f.rig.update(dt, { x: f.x, y: 0, z: f.z, vx: f.stun > 0 ? 0 : f.vx, vy: 0, facing: face(f.dir), attack: f.atk && f.atk.state, hurt: f.stun > 0 || f.flash > 0, stance: near ? 'ready' : null });   // every hit flinches
  }
  // a bat roosts until the hero passes below, drops, hovers over his head and swoops through him. The telegraph: it rears up
  // beating hard, then folds its wings and cocks back.
  function fly(f, dt, dx) {
    const s = f.swoop, tuck = s && s.u > -.12 && s.u < 0, d = s ? Math.sign(s.x1 - s.x0) : 0;
    f.open = approach(f.open, f.roost ? 0 : tuck ? .1 : s && s.u > 0 ? .5 : 1, dt * (tuck ? 12 : 4)); f.beat += dt * (f.roost ? 0 : !s ? 15 : s.u < 0 ? 28 : 7);
    f.tilt = approach(f.tilt, tuck ? -.5 * d : s && s.u > 0 ? .3 * d : 0, dt * 8);   // lean away, then into the dive
    if (f.roost) { if (Math.abs(dx) < 80 && hero.z < f.z) { f.roost = false; f.drop = .25; f.vz = -90; f.cool = .9; A.sfx('whoosh', { vol: .4, pitch: 1.6 }); } return; }
    f.drop -= dt;                                    // it falls, unfolding, then rolls upright
    if (f.stun > 0) { f.x += f.vx * dt; f.z += f.vz * dt; f.vx = approach(f.vx, 0, 300 * dt); f.vz = approach(f.vz, 0, 400 * dt); return; }   // knocked away (or bouncing off)
    if (s) {
      s.u += dt / .8; const u = clamp(s.u, 0, 1); f.x = lerp(s.x0, s.x1, u); f.z = s.z0 + (s.u < 0 ? 5 * Math.sin(-s.u / .3 * Math.PI) : 6 * u - Math.sin(u * Math.PI) * s.dip);
      if (s.u >= 1) { f.swoop = null; f.cool = 1.4; f.vx = Math.sign(s.x1 - s.x0) * 60; } return;
    }
    f.vz = approach(f.vz, 0, 150 * dt); f.vx = approach(f.vx, Math.sign(dx) * 48, 110 * dt); f.x += f.vx * dt;
    f.z = approach(f.z + f.vz * dt, hero.z + 46 + Math.sin(f.t * 3) * 5, 50 * dt);
    if (f.cool <= 0 && Math.abs(dx) < 40) { f.swoop = { u: -.3, x0: f.x, z0: f.z, x1: hero.x + Math.sign(dx || 1) * 40, dip: f.z - hero.z - 14 }; A.sfx('whoosh', { vol: .5, pitch: 1.3 }); }
  }
  // a buffered X picks a move from the context (cutting the last one's follow-through). The plunge holds its stab until it
  // lands or pogos off a foe. Holding X charges the spin.
  function fight(inp, dt, diving) {
    if (inp.buffered('attack') && !(atk && atk.busy && atk.state.phase !== 'recover') && !hero.climbing) {
      const m = hero.dashing > 0 ? MV.thrust : inp.down('up') ? MV.rising : inp.down('down') && hero.air ? MV.plunge : combo;
      if (atk && atk !== m) atk.cancel();
      if (m === combo ? combo.press() : m.start(true)) {
        inp.consume('attack'); atk = m; charge = 0;
        if (m === MV.thrust) hero.dashing = Math.max(hero.dashing, .16);   // the thrust rides the dash on
        if (m === MV.rising && hero.onGround) hero.vz = 170;              // and the rising cut hops
      }
    }
    if (inp.down('attack') && !(atk && atk.busy) && !hero.climbing) { if ((charge += dt) >= CHARGE && charge - dt < CHARGE) A.sfx('charge'); }   // charged: the blade glints (see draw)
    else { if (charge >= CHARGE && !inp.down('attack')) { atk = MV.spin; MV.spin.start(); } charge = 0; }   // released charged: spin
    if (atk && !(diving && atk.active && atk.u > .9) && atk.update(dt) === 'active') A.sfx(atk === MV.spin || atk.state.spec.name === 'overhead' ? 'whoosh' : 'swing');
    if (!atk || !atk.active) return;
    const name = atk.state.spec.name, k = HIT[name];
    atk.hits(foes.concat(candles), f => atk.active && atk.state.u > .3 && !f.sleep && !(f.rise > 0) && within(hero, hero.facing, f, k), f => {   // 16-24 damage x the move's, one hit in seven a critical
      if (f.kind === 'candle') return snuff(f);
      const crit = Math.random() < .15; damage(f, Math.round(E.randInt(16, 24) * k[4] * (crit ? 2 : 1)), Math.sign(f.x - hero.x) || hero.facing, crit, k);
      if (name === 'plunge') { hero.vz = 250; atk.cancel(); rig.kick(3); }   // pogo off whatever the plunge stabs
    });
  }
  function update(dt) {
    for (const f of fx) { f.t += dt; f.x += f.vx * dt; f.z += f.vz * dt;
      if (f.kind !== 'blade') continue;               // a dropped sword falls, bounces and settles flat
      const gz = level.groundBelow(f.x, f.z + 8); f.vz -= 700 * dt; f.a += f.spin * dt;
      if (gz !== null && f.z < gz + 1) { f.z = gz + 1; f.vz = f.vz < -90 ? -f.vz * .3 : 0; f.vx *= .6; f.spin = (Math.round(f.a / Math.PI) * Math.PI - f.a) * 10; }
    }
    E.prune(fx, f => f.t >= f.max);
    const inp = game.input, ko = hero.ko > 0; inv -= dt; cheer -= dt; land -= dt; age += dt; if (!talk.open && age > 2) hint -= dt;
    talk.update(dt);
    if (age > 1.8 && age - dt <= 1.8 && !clear) say('The dead will not rest tonight. I must reach the gate.');
    lift.t += dt; const nx = lift.x0 + Math.sin(lift.t * .8) * 64; lift.vx = (nx - lift.x) / dt; lift.x = nx;   // the lift glides over the moat and carries riders
    if (ko) { hero.ko -= dt; if (!level.touching(hero, 'hazard')) hero.update(dt, level, { x: 0 }, [lift]); if (hero.ko <= 0) return lives > 0 ? reset(false) : game.go('over', { from: 'platformer' }); }
    else {
      const diving = atk === MV.plunge && atk.busy && atk.phase !== 'recover' && hero.air;
      if (diving) hero.vz = Math.min(hero.vz, -300);
      hero.update(dt, level, clear ? { x: gate.x > hero.x + 2 ? .4 : 0 } : inp, [lift]);
      if (hero.jumped) { A.sfx('jump'); rig.kick(3); }                                 // stretch on take-off, squash and dust on landing
      if (hero.landed) { A.sfx(diving ? 'stomp' : 'land'); rig.kick(diving ? -8 : -5); for (const s of [-1, 1]) addFx('smoke', hero.x + s * 6, hero.z + 2, { vx: s * (diving ? 70 : 30), vz: 6, max: .35, size: 2.5 }); }
      if (hero.landed && diving) { game.shake(3); land = .3; P.dust(hero.x, 0, hero.z, 14, { speed: 70 }); P.sparks(hero.x + hero.facing * 4, 0, hero.z, 6); }   // the dive's impact
      if (!clear) fight(inp, dt, diving);
      for (const c of coins) if (!c.got && E.overlapBox(hero, c)) { c.got = true; gold++; score += 100; A.sfx('coin'); P.glints(c.x, 0, c.z + 5, 4, '#fff6c0', 10); }
    }
    for (const d of drops) {                           // candle loot falls and is picked up with a cheer (a heart heals 20)
      d.vz -= 700 * dt; level.move(d, dt);
      if (d.got || ko || !E.overlapBox(hero, d)) continue; d.got = true; cheer = .7; P.glints(d.x, 0, d.z + 4, 6, '#fff6c0', 12);
      if (d.heart) { hp = Math.min(MAXHP, hp + 20); A.sfx('heal'); P.text(hero.x, 0, hero.z + 56, 20, '#7aff8a', { scale: 2, bounce: true }); } else { gold += 5; score += 500; A.sfx('powerup'); P.text(hero.x, 0, hero.z + 56, '+5', '#ffe066', { scale: 2 }); }
    }
    for (const f of foes) {                            // enemies: stomp from above (bounce) or take a hit
      if (f.dead && !(f.corpse > 0)) continue; updateFoe(f, dt); if (ko || f.dead || f.sleep || f.rise > 0 || !E.overlapBox(hero, f)) continue;
      const d = hero.x < f.x ? 1 : -1; if (hero.vz < 0 && hero.z > f.z + f.h * .5) { hero.vz = 230; A.sfx('stomp'); damage(f, 20, d, false); continue; }
      hurt(-d, f.dmg || 8); if (f.kind === 'bat') Object.assign(f, { swoop: null, stun: .35, cool: 1.4, vx: d * 110, vz: 130 });   // a bat bounces off
    }
    if (Math.random() < dt * 9) {                      // ambient life: fireflies, dust, embers and smoke over the lava
      const x = hero.x + E.rand(-170, 190), lv = x > lava.x0 && x < lava.x1, ff = x < 330;
      addFx('mote', x, lv ? lava.z + 4 : hero.z + E.rand(0, 110), { vx: E.rand(-8, 8) - (ff ? 0 : 6), vz: lv ? E.rand(25, 45) : E.rand(-6, 8), max: E.rand(1.2, 2.6), size: E.pick([1, 1, 2]), c: lv ? '#ff7a2a' : ff ? '#b8ff70' : '#a898c8' });
      if (lv && Math.random() < .3) addFx('smoke', x, lava.z + 4, { vz: E.rand(12, 22), vx: -4, max: 2.2, size: E.rand(6, 10) });
    }
    if (!clear && !ko && (level.touching(hero, 'hazard') || hero.z < -40)) die();
    if (!clear && !ko && Math.abs(hero.x - gate.x) < 12 && hero.z >= gate.z - 2) {   // goal: step into the castle gate
      clear = true; stop(); score += 1000; A.music('victory'); game.flash('#fff4d0', .6, .7); P.glints(gate.x, 0, gate.z + 20, 12, '#fff6c0', 30); game.after(6, () => game.go('title'));
      say(['The gate is open. Whatever waits inside, I am ready.', 'Score ' + score + '   Best ' + best('platformer', score)]);
    }
    // poses: cheer (gate, pickups); down when knocked out; crouch (a tuck) over the plunge and its landing; hips after a long idle,
    // blade tip down. The sword is held ready, except running and on ladders (weapon: null), where he turns his back to the
    // camera and climbs hand over hand.
    const won = clear && hero.onGround && Math.abs(gate.x - hero.x) < 3, busy = atk && atk.busy, cheering = won || (cheer > 0 && hero.onGround && !busy && !charge);
    idle = hero.onGround && !hero.vx && !busy && !charge ? idle + dt : 0; if (!(hero.ko > 0)) rig.o.weapon = hero.climbing ? null : 'sword';
    rig.update(dt, hero.rigState({ attack: (atk && atk.state) || (charge > .1 ? { ...MV.charge, u: clamp((charge - .1) / (CHARGE - .1), 0, 1) } : null), ...(hero.climbing && { facing: -Math.PI / 2 }),
      stance: cheering || hero.climbing || idle > 6 || (hero.onGround && Math.abs(hero.vx) > 40) ? null : 'ready', point: idle > 6, aim: -.5, expr: cheering ? 'smile' : hero.stun > 0 ? 'wince' : null,
      pose: hero.ko > 0 ? 'down' : cheering ? 'cheer' : land > 0 || (atk === MV.plunge && busy && hero.air) ? 'crouch' : idle > 6 ? 'hips' : null }));   // the plunge squats over its blade
  }
  function coin(g, x, y, ph) {                         // spinning coin: its width follows |cos| of a phase
    const w = Math.abs(Math.cos(ph)) * 5; px.ell(g, x, y, Math.max(1, w), 6, '#a0600c'); px.ell(g, x - .5, y - .5, Math.max(.6, w - 1.2), 4.8, '#f8c030');
    if (w > 2) { px.rect(g, x - 1, y - 3, 1, 5, '#fff2a8'); px.dot(g, x + 1, y + 3, '#c07a10'); }
  }
  // lights for the light pass: a world point, a radius, a color, a strength (flick() makes flames breathe)
  const lit = (r, x, z, R, c, a, y = 0) => { const [sx, sy] = r.w(x, y, z), p = Math.max(6, Math.round(R * r.view.scale / 6) * 6); if (sx > -p && sx < r.bw + p && sy > -p && sy < r.bh + p) lights.push({ x: Math.round(sx), y: Math.round(sy), R: p, c, a }); };
  const flick = (x, k = 1) => 1 + .12 * k * Math.sin(game.real * 13 + x) * Math.sin(game.real * 7.3 + x * 3);
  // ground mist over the graveyard: the fog band at two depths and speeds, behind the play layer and faintly in front
  const mist = (r, g, Z, a, k, y) => { if (Z.bg[0] < .01) return; const [, sy] = r.w(0, y, 2 * T), o = ((r.ix * k + game.time * 5 * k) % 320 + 320) % 320;
    blend(g, 'source-over', a * Z.bg[0], () => { for (let x = -o; x < r.bw; x += 320) g.drawImage(fog('#a8b8e8'), x, Math.round(sy) - 24); }); };
  function sky(r, g, Z) {
    let first = true;
    Z.bg.forEach((w, i) => { if (w > .01) { blend(g, 'source-over', first ? 1 : w, () => BG[i].draw(r)); first = false; } });   // each Backdrop draws with the alpha we set
    const mo = Z.bg[0] + Z.bg[2], mx = Math.round(r.W * .76 - r.ix * .01), my = 44, t = E.tones('#f0ead8');
    if (mo > .01) {   // the moon: a smooth additive halo, then craters on a lit disc
      blend(g, 'lighter', .55 * mo, () => g.drawImage(halo(60, '#4a68c8'), mx - 60, my - 60));
      blend(g, 'source-over', mo, () => { px.disc(g, mx, my, 16, t.sh); px.disc(g, mx - 1, my - 1, 15, t.base); px.disc(g, mx - 4, my - 5, 7, t.lt); for (const [a, b, c] of [[5, 3, 4], [-6, 6, 3], [2, -8, 2], [-2, 10, 2]]) px.disc(g, mx + a, my + b, c, t.sh); });
    }
    // the far castle (blue by moonlight, red over the moat), mist at its foot, a faster treeline
    const cx = Math.round(r.W * .28 - r.ix * .03), cy = Math.round(FOOT * .72 - r.iy * .04);
    for (const [i, c, e, w] of [[0, '#16223e', '#34507e', '#ffc868'], [1, '#3a0e18', '#8a2a20', '#ff8a3a']]) if (Z.bg[i] > .01) blend(g, 'source-over', Z.bg[i], () => g.drawImage(castle(c, e, w), cx, cy - 170));
    blend(g, 'source-over', .8, () => { const o = ((r.ix * .05 + game.time * 3) % 320 + 320) % 320; for (let x = -o; x < r.bw; x += 320) g.drawImage(fog(Z.bg[1] > .5 ? '#b8482a' : '#5a7aa8'), x, cy - 30); });
    if (Z.bg[0] > .01) blend(g, 'source-over', Z.bg[0], () => { const ty = Math.round(FOOT * .9 - 90 - r.iy * .12), o = ((r.ix * .22) % 320 + 320) % 320; for (let x = -o; x < r.bw; x += 320) g.drawImage(treeline(), x, ty); px.rect(g, 0, ty + 90, r.bw, r.bh, '#0c1830'); });
    if (Z.bg[2] > .01) blend(g, 'source-over', Z.bg[2], () => { for (let k = 0; k < 3; k++) {   // the sea of clouds: three billowy rows, nearer = darker and faster
      const y = Math.round(FOOT * (.58 + k * .12) - r.iy * .05 * (k + 1)), o = ((r.ix * (.05 + k * .07) + game.time * (2 + k * 2)) % 600 + 600) % 600;
      for (let x = -o; x < r.bw; x += 600) g.drawImage(clouds(k), x, y); px.rect(g, 0, y + 70, r.bw, r.bh, E.tones(CLOUD[k]).deep); } });
  }
  function decor(r, g) {                               // baked decals behind the play layer; engine props are queued
    for (const s of back.spawns) {
      const [sx, sy] = r.w(s.x, -8, s.z), x = Math.round(sx), y = Math.round(sy), fl = FLAME[s.tag];
      if (x < -90 || x > r.bw + 90) continue;
      if (s.tag === 'glass') { g.drawImage(glass(), x - 11, y - 46); lit(r, s.x, s.z + 18, 40, '#5a7aff', .22, -8); shafts.push([x, y, (s.z - (level.groundBelow(s.x + 30, s.z) || 0)) * r.view.scale + 30]); }   // + a light shaft
      else if (s.tag === 'arch') { g.drawImage(arch(44, 76), x - 10, y - 76); if (Math.sin(game.real * .7 + s.cx) > .8) blend(g, 'lighter', 1, () => { px.dot(g, x + 9, y - 40, '#ff4030'); px.dot(g, x + 13, y - 40, '#ff4030'); }); }   // eyes in the dark
      else if (s.tag === 'tree') g.drawImage(tree(s.cx), x - 40, y - 100);
      else if (s.tag === 'grave') g.drawImage(grave(s.cx % 2), x - 9, y - 26);
      else if (STONES[s.tag] || !PROP[s.tag]) { const o = STONES[s.tag]; if (o) r.shape(o.id, s.x, o.y, s.z, o); }   // (no set on the page: no stones)
      else { const o = PROP[s.tag], z = o.top ? s.z + T : s.z; r.prop(o.name || s.tag, s.x, o.y, z, o); if (fl) lit(r, s.x, z + fl, s.tag === 'lamp' ? 44 : s.tag === 'offering' ? 30 : 56, '#ff9a40', .45 * flick(s.x), -6); }
    }
    for (let i = 0; i < FRONT.length; i++) { const o = FP[FRONT[i]]; if (o) r.prop(o.name, i * T + 8 + (o.dx || 0), 7, 2 * T, o); }   // the FRONT row, in front of the path
  }
  // LAVA: a rolling surface, a bright crest, molten bands darkening with depth, drifting crust, streaks and bubbles that pop.
  // It also lights the walls (lit).
  function lavaDraw(r, g) {
    const [x0, y0] = r.w(lava.x0, 8, lava.z), [x1, y1] = r.w(lava.x1, 8, 0), t = game.time, B = ['#fff4c0', '#ffd050', '#ffa030', '#f07020', '#d04818', '#a02c14', '#6a1810', '#3a0c0c'];
    for (let x = Math.max(0, Math.round(x0)); x < Math.min(r.bw, Math.round(x1)); x++) {
      const wx = x + r.ix, top = Math.round(y0 + Math.sin(wx * .09 + t * 2) * 1.5 + Math.sin(wx * .23 - t * 3.1) * .8), n = E.noise2(wx * .07 + t * .25, t * .1);
      let y = top; for (let k = 0; k < B.length; k++) { const h = k < 7 ? [1, 1, 2, 3, 4, 5, 6][k] : y1 - y + 2; px.rect(g, x, y, 1, h, B[k]); y += h; }
      if (n > .6) { px.rect(g, x, top + 1, 1, n > .7 ? 4 : 2, '#2a0a08'); if (n < .62) px.dot(g, x, top + 1, '#ff8a20'); }
      if ((wx + Math.floor(t * 18)) % 29 < 7) px.dot(g, x, top + 6 + wx % 3, '#ffc040');
    }
    for (let k = 0; k < 4; k++) { const u = (t * .6 + k * .29) % 1, bx = lava.x0 + 8 + E.hash2(Math.floor(t * .6 + k * .29), k) * (lava.x1 - lava.x0 - 16), [sx, sy] = r.w(bx, 8, lava.z);
      if (u < .85) { px.disc(g, sx, sy + 1 - u * 2, 1 + u * 3, '#ff9a30'); px.dot(g, sx - 1, sy - u * 4, '#fff4c0'); } else blend(g, 'lighter', 1, () => px.disc(g, sx, sy - 2, 5, '#ff6a20')); }
    for (let x = lava.x0 + 8; x < lava.x1; x += 40) lit(r, x, lava.z + 6, 64, '#ff5a1a', .42 * flick(x, 2));
  }
  function drawFx(r) {                                 // FX: additive glows, slash flares and motes; half-transparent smoke
    for (const f of fx) r.queue(f.x, 6, f.z, g => {
      const u = f.t / f.max, [x, y] = r.w(f.x, 0, f.z), s = r.view.scale;
      if (f.kind === 'blade') { const c = Math.cos(f.a) * f.L * s / 2, n = Math.sin(f.a) * f.L * s / 2;   // a dropped sword (blade, hilt), a bone or a skull
        if (f.max - f.t < .3 && (f.t * 20 | 0) % 2) return;   // blinks out
        if (!f.h) return f.L ? px.line(g, x - c, y + n, x + c, y - n, f.c, 2) : (px.disc(g, x, y - 2, 2.6 * s, f.c), px.rect(g, x - 1, y - 2, 3, 1, '#1a1020'));
        px.line(g, x - c * .6, y + n * .6, x + c, y - n, f.c); return px.line(g, x - c, y + n, x - c * .6, y + n * .6, f.h, 2); }
      if (f.kind === 'smoke') return blend(g, 'source-over', .5 * (1 - u), () => { px.disc(g, x, y, f.size * s * (.6 + u), '#2e2a3a'); px.disc(g, x - 1, y - 1, f.size * s * (.35 + u * .6), '#4e4860'); });
      blend(g, 'lighter', f.kind === 'mote' ? Math.sin(u * Math.PI) : 1 - u, () => {
        if (f.kind === 'glow') { const R = Math.round(f.size * s / 6) * 6; g.drawImage(halo(R, f.c), x - R, y - R); }
        else if (f.kind === 'cut') { const L = 22 - u * 8, k = f.dir; px.poly(g, [[x - L * k, y - L * .55], [x + 2 * k, y - 2], [x + L * k, y + L * .55], [x - 2 * k, y + 2]], f.c); px.line(g, x - L * .7 * k, y - L * .38, x + L * .7 * k, y + L * .38, '#ffffff'); }   // SotN's slash flare across the target
        else px.rect(g, x, y, f.size, f.size, f.c);
      });
    }, { bias: 2 });
  }
  function draw(r) {
    const view = r.view, t = game.time, g = r.ctx, Z = zoneAt(hero.x), tilted = view.pitchDeg > 5, b = level.bounds(view);
    lights.length = shafts.length = 0; soil = soilFor(b, r.H); FOOT = r.H - soil;
    sky(r, g, Z);                                      // 1. skies (cross-faded), moon, castle, mist, clouds
    back.draw(r); decor(r, g); mist(r, g, Z, .55, .6, -8);   // 2. castle walls, decals, props on them, the far mist layer
    level.draw(r); lavaDraw(r, g);                     // 3. the play layer, the lava painted over its tiles, the earth cut
    if (soil) {   // 8. the SOIL under the level: the earth cut's strata, darkening; above the clouds it gives way to them
      const top = Math.round(b.y1 - 4 - r.iy), o = ((r.ix % 160) + 160) % 160;
      blend(g, 'source-over', 1 - Z.bg[2], () => { for (let x = -o; x < r.bw; x += 160) g.drawImage(earth(), x, top); for (let k = 0; k < 4; k++) px.rect(g, 0, top + 48 + k * 10, r.bw, k < 3 ? 10 : r.bh, ['#2a2030', '#211a28', '#18131f', '#100c16'][k]); });
    }
    { const [ex, ey] = r.w(0, 8, 2 * T), [x1, eb] = r.w(20 * T, 8, 0), w = (x1 - ex) / 3; if (x1 > 0) for (let k = 0; k < 3; k++) g.drawImage(earth(), Math.round(ex + k * w), Math.round(ey) + 3, Math.round(w), Math.round(eb - ey) - 3); }
    const shadow = (x, z) => { const gz = tilted && level.groundBelow(x, z); if (gz !== null && gz !== false) r.shadow(x, 0, 6, .35, '#000', gz); };   // contact shadows in the 2.5D view
    for (const c of candles) if (!c.dead) {            // floating candles on iron cups: slash them for loot
      r.prop('candle', c.x, -2, c.z + 5, { size: 1.1 }); lit(r, c.x, c.z + 18, 40, '#ffb060', .4 * flick(c.x));
      r.queue(c.x, -3, c.z + 5, g2 => { const [x, y] = r.w(c.x, -2, c.z + 5); px.poly(g2, [[x - 6, y], [x + 6, y], [x + 2, y + 4], [x - 2, y + 4]], '#3a3040'); px.rect(g2, x - 6, y, 12, 1, '#9a8aa0'); px.rect(g2, x - 1, y + 4, 2, 4, '#2a2230'); px.dot(g2, x, y + 8, '#c8b060'); });
    }
    for (const c of coins) if (!c.got) r.queue(c.x, 0, c.z, g2 => { const [x, y] = r.w(c.x, 0, c.z + 5); coin(g2, x, y + Math.round(Math.sin(t * 3 + c.x) * 1.5), t * 4 + c.x * .1); });
    for (const d of drops) if (!d.got) r.queue(d.x, 1, d.z, g2 => { const [x, y] = r.w(d.x, 0, d.z); if (d.heart) E.ui.hearts(g2, x - 3, y - 7, 1, 1); else coin(g2, x, y - 6, t * 5); });
    r.queue(lift.x, 0, lift.z, g2 => {                 // the lift: a floating slab with runes
      const [x, y] = r.w(lift.x, 0, lift.z + lift.h), w = Math.round(lift.w * view.scale), X = Math.round(x - w / 2), st = E.tones('#6a6280'), H = Math.round(lift.h * view.scale) + 3;
      blend(g2, 'lighter', .35 + .15 * Math.sin(t * 4), () => { px.ell(g2, x, y + H + 6, w * .42, 5, '#1a5aa0'); px.ell(g2, x, y + H + 5, w * .25, 3, '#3ab8ff'); });
      px.poly(g2, [[X + 3, y + H], [X + w - 3, y + H], [x + 6, y + H + 8], [x - 6, y + H + 8]], st.deep); px.rect(g2, X, y, w, H, st.base); px.rect(g2, X, y, w, 2, st.lt); px.rect(g2, X, y, w, 1, st.hi);
      px.rect(g2, X, y + H - 2, w, 2, st.deep); px.rect(g2, X + 2, y + 3, w - 4, 1, st.sh); for (const k of [1, 2]) px.rect(g2, X + Math.round(w * k / 3), y + 4, 1, H - 6, st.deep);
      blend(g2, 'lighter', .6 + .4 * Math.sin(t * 4), () => { for (const k of [-.33, 0, .33]) { px.rect(g2, x + k * w - 1, y + 5, 3, 1, '#3ab8ff'); px.dot(g2, x + k * w, y + 6, '#bfefff'); } });
    });
    lit(r, lift.x, lift.z - 6, 34, '#3ab8ff', .3);
    const [gx, gy] = r.w(gate.x, -8, gate.z); g.drawImage(arch(60, 90), Math.round(gx) - 30, Math.round(gy) - 90);   // the gate: a double door in a carved arch (it swings open on clear)
    r.prop('door', gate.x, -6, gate.z, { size: 1.55, color: '#5a2e22', open: clear });
    if (clear) lit(r, gate.x, gate.z + 30, 80, '#ffe0a0', .6);
    for (const f of foes) { if (f.dead && !(f.corpse > 0)) continue;
      const o = { flash: f.flash > .24 || (f.dead && f.corpse < .4 && (game.real * 20 | 0) % 2 === 0), rimColor: Z.rim }; shadow(f.x, f.z);   // a hit: a white tint for 3-4 frames
      if (f.kind === 'bat') { r.actor(f.x, 0, f.z, (g2, ox, oy) => bat(g2, ox, oy, f), o); lit(r, f.x, f.z + 10, 12, '#ff5030', f.swoop && f.swoop.u < 0 ? .9 : .4); }   // the eyes flare before a swoop
      else { r.actor(f.x, 0, f.z, (g2, ox, oy) => f.rig.draw(g2, ox, oy, view), Object.assign(o, { bias: f.atk && f.atk.busy ? 1 : 0 })); f.rig.drawSmear(r, ['#fff4e0', '#f0d8b0', '#d0986a', '#8a4a3a']);   // striking: over the hero, a rusty trail
        if (!f.dead && !f.sleep) { const h = f.rig.head(); lit(r, h[0] + f.dir * 2, h[2], 8, '#ff4020', .3); if (f.atk && f.atk.phase === 'wind') { const w = f.rig.hand(); lit(r, w[0], w[2], 20, '#ff6040', .4); } } }   // eye glow; the raised blade glints
    }
    {   // the hero: a red flicker when hurt, then a blink; dashing and spinning leave blue ghosts
      const blink = inv > 0 && !hero.ko && Math.floor(game.real * 16) % 2 === 0, red = hero.stun > 0 && (game.real * 20 | 0) % 2 === 0, w = rig.tip(); shadow(hero.x, hero.z);
      r.actor(hero.x, 0, hero.z, (g2, ox, oy) => rig.draw(g2, ox, oy, view),
        { alpha: blink && hero.stun <= 0 ? .45 : 1, flash: red && '#ff3050', flashMix: .4, rimColor: Z.rim, ghost: (hero.dashing > 0 || (atk === MV.spin && atk.active)) && (game.real * 60 | 0) % 3 === 0 ? { color: '#5a8aff', life: .25 } : null });
      lit(r, hero.x, hero.z + 26, 46, '#ffe8d0', .25); rig.drawSmear(r, ['#ffffff', '#e0f0ff', '#8ab8ff', '#5a6ad8']); if ((atk && atk.active) || charge >= CHARGE) lit(r, w[0], w[2], 30, '#a0d8ff', charge ? .5 * flick(w[0], 3) : .35);   // the blade lights up
      if (charge >= CHARGE) r.queue(w[0], 9, w[2], g2 => { const [x, y] = r.w(w[0], 0, w[2]), k = 3 + 2 * Math.sin(game.real * 30);   // charged: a star glints on the tip
        blend(g2, 'lighter', 1, () => { px.line(g2, x - k, y, x + k, y, '#bfe8ff'); px.line(g2, x, y - k, x, y + k, '#bfe8ff'); px.dot(g2, x, y, '#ffffff'); }); });
    }
    drawFx(r);
    r.queue(0, -1.5, 0, g2 => shade(g2, r, Z, Z.dark));   // full darkness: after the walls and wall props, before the characters
    r.overlay(g2 => { shade(g2, r, Z, Z.dark * .3); glow(g2); mist(r, g2, Z, .3, 1.3, 8);   // a third of it over everything, the colored glows, the near mist
      for (const [x, y, L] of shafts) blend(g2, 'lighter', .09, () => { const k = L / 126, b = y - 30 + L; px.poly(g2, [[x - 8, y - 30], [x + 8, y - 30], [x + 70 * k, b], [x + 40 * k, b]], '#8098ff'); px.poly(g2, [[x - 3, y - 30], [x + 3, y - 30], [x + 58 * k, b], [x + 50 * k, b]], '#c0c8ff'); });   // shafts end on the floor
      const fo = ((r.ix * 1.3) % 480 + 480) % 480, fy = soil ? Math.round(b.y1 - 4 - r.iy) : r.bh; if (Z.bg[1] < .99) blend(g2, 'source-over', 1 - Z.bg[1], () => { for (let x = -fo; x < r.bw; x += 480) g2.drawImage(fore(), x, fy - 36); });
      hud(g2, r); });
    talk.draw(r);
  }
  // 5. LIGHT, part 2: a darkness layer in the zone color with every light punched out, over the walls fully and over everything
  // at a third, so sprites stay brighter than rooms (as in SotN).
  function shade(g, r, Z, a) {
    const W = r.bw, H = r.bh; if (!darkCv || darkCv.width !== W || darkCv.height !== H) darkCv = E.mkCanvas(W, H);
    if (darkCv.frame !== game.real) {                  // built once per frame, used twice
      const d = darkCv.getContext('2d'); darkCv.frame = game.real; d.globalCompositeOperation = 'source-over'; d.globalAlpha = 1; d.fillStyle = Z.amb; d.fillRect(0, 0, W, H);
      d.globalCompositeOperation = 'destination-out'; for (const L of lights) { d.globalAlpha = Math.min(1, L.a * 2); d.drawImage(halo(L.R, '#ffffff'), L.x - L.R, L.y - L.R); }
    }
    blend(g, 'source-over', a, () => g.drawImage(darkCv, 0, 0));
  }
  const glow = g => { for (const L of lights) { const R = Math.max(6, Math.round(L.R * .55 / 6) * 6); blend(g, 'lighter', L.a * .5, () => g.drawImage(halo(R, L.c), L.x - R, L.y - R)); } };
  // HUD in the SotN manner: a gold HP medallion, an ornate HP bar, lives and gold
  function hud(g, r) {
    const gt = E.tones('#d8a848'), w = Math.round(84 * clamp(hp / MAXHP, 0, 1));
    px.rect(g, 30, 8, 96, 11, '#0c0610'); px.rect(g, 31, 9, 94, 9, gt.sh); px.rect(g, 32, 10, 92, 7, gt.lt); px.rect(g, 33, 11, 90, 5, '#1a0610');
    px.rect(g, 37, 11, w, 5, '#c8243a'); px.rect(g, 37, 11, w, 1, '#ff8a94'); px.rect(g, 37, 15, w, 1, '#6a0818'); px.poly(g, [[124, 7], [132, 13], [124, 20]], gt.sh); px.poly(g, [[124, 9], [130, 13], [124, 17]], gt.lt);
    px.disc(g, 19, 19, 18, '#0c0610'); px.disc(g, 19, 19, 17, gt.sh); px.disc(g, 18, 18, 16, gt.lt); px.disc(g, 19, 19, 14, '#2a0a1c'); px.disc(g, 19, 19, 13, '#4a1430'); px.dot(g, 11, 8, gt.hi);
    E.font.text(g, String(Math.max(0, hp)), 20, 12, '#ffffff', { align: 'center', scale: 2, gradient: ['#ffffff', '#ffb0b8'], shadow: '#10040a', outline: false });
    E.font.text(g, '♥', 40, 23, '#ff5a6a', S); E.font.text(g, '×' + lives, 48, 23, '#f0e8ff', S); coin(g, 74, 27, 0); E.font.text(g, String(gold), 81, 23, '#ffe066', S);
    const ribbon = (y, h, a) => blend(g, 'source-over', a, () => { px.rect(g, 0, y, r.W, h, '#05030a'); px.rect(g, 0, y, r.W, 1, '#d8a848'); px.rect(g, 0, y + h - 1, r.W, 1, '#d8a848'); });
    if (age < 1.8) { const a = clamp((1.8 - age) * 2, 0, 1); ribbon(58, 26, .5 * a); if (a > .3) E.font.title(g, 'Castle Approach', r.W / 2, 64, { scale: 2, align: 'center', colors: ['#ffffff', '#d8c8f0', '#9a7ad0'], depth: 1, depthColor: '#1c1430' }); }
    else if (hint > 0 && !talk.open) {   // controls after the dialog, in the player's own keys; over the soil when there is some
      const k = a => game.input.label(a), y = soil ? r.H - soil + 6 : r.H - 17, s = hint > 4 ? [prompt('jump', 'jump'), prompt('attack', 'slash'), prompt('dash', 'dash'), touch() ? '' : 'V 2.5D'].filter(Boolean).join('  •  ')
        : ['↑' + k('attack') + ' rise', '↓' + k('attack') + ' dive', k('dash') + '+' + k('attack') + ' thrust', 'hold ' + k('attack') + ' spin'].join('  •  '), fit = E.font.width(s) < r.W - 8;
      ribbon(y, 13, .55 * clamp(hint, 0, 1)); E.font.text(g, s, r.W / 2, y + (fit ? 3 : 4), '#e8e0ff', fit ? SC : Object.assign({ font: 'tiny' }, SC));
    }
    if (clear) { ribbon(40, 30, .6); E.font.title(g, 'STAGE CLEAR', r.W / 2, 46, { scale: 2, align: 'center', colors: ['#fffbe8', '#ffd36a', '#e0662a'] }); }   // a translucent ribbon keeps the lit gate visible
  }
  return { view: 'side', views: ['side', 'brawler'], input: 'PLATFORMER', res: 'ps1', pausable: true, touch: ['jump', 'attack', 'dash'], propSize: 1.5, camera: { zoom: [.75, 2], tall: 1.5 },   // props at the hero's scale; the player zooms .75x to 2x (no turning), a phone held upright starts at 1.5x: the level fills more of it
    enter() { reset(true); age = 0; hint = 8; talk.close(); game.cam.bounds = v => { const b = level.bounds(v); return Object.assign({}, b, { y1: b.y1 + soilFor(b, game.H) }); }; A.music('adventure'); L.enabled = false; rimWas = game.r.rimAlpha; game.r.rimAlpha = .5;   // a stronger, zone-colored rim light
      P.ground = (x, y, z) => level.groundBelow(x, z + 1); },              // sparks and debris land and bounce on the platform under them
    exit() { game.r.rimAlpha = rimWas; P.ground = null; }, update, draw };
})();
scenes.platformer = PLAT;
