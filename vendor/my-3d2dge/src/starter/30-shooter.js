/* =====================================================================================
 * SLICE 3  SHOOTER  (vertical shoot-'em-up: Raiden, 1943, Strikers 1945)
 * A tall "tate" screen (240 x 320) scrolls up over farmland, a river town and an air base where a flying fortress waits.
 * 'overhead' maps world x/y to screen pixels; the 272 px world pans a little with the ship. z only orders the drawing:
 * ground 0-3, air shadows 4, clouds 5-6, aircraft 8-12, air blasts 14, ship bullets 20; foe bullets over every panel.
 * PS1 LOOK: real alpha and additive light (px.blend), never dither; altitude shadows, one-point perspective buildings.
 * HUD on top, radio calls in a see-through box at the bottom edge. Z / Space fires (a tap: a burst), X bombs. TOUCH: a
 * thumb anywhere on the screen steers (input.steer = 'drag', input.drag()), the ship going 1.5x as far as the thumb (DRAG:
 * one swipe crosses the screen), and it fires by itself; BOMB is the button.
 * ANY SCREEN: res [240, 320] with expand. The map is WW wide; a wider screen (landscape, a desktop) shows the valley going
 * on beyond it (2b) and the playfield is the whole screen (span()): the ship flies edge to edge and the waves spread to
 * match (air() maps their x). W x H are the screen's, read each step. game.go('shooter', { at: 30 }) starts at the boss.
 * ===================================================================================== */
const SHOOT = (() => {
  const WW = 272, MAP_H = 84 * 16, SCROLL = 32, PERSP = .0042, D = Math.PI / 2, INTRO = 3.2;   // world width (the playfield), stage length, scroll px/s, building perspective, stage card seconds
  const DRAG = 1.5;   // how far the ship goes for a thumb's move on a touch screen (2/3 of the screen's width crosses it)
  let W = 240, H = 320;   // the screen (at least 240 x 320): set from game.W, game.H every step

  /* ---- 1. PS1 LIGHT: px.blend draws with real alpha ('normal') or additive light ('add') ---- */
  // a round glow baked once per size and color: 4 nested discs (visible steps)
  const STAMPS = new Map();
  function glow(g, x, y, R, color, a = 1) {
    R = Math.max(2, Math.round(R)); let c = STAMPS.get(R + color);
    if (!c) { c = E.mkCanvas(R * 2 + 1, R * 2 + 1); const cg = E.ctx2d(c); cg.globalAlpha = .3; for (let k = 4; k > 0; k--) px.disc(cg, R, R, R * k / 4, color); STAMPS.set(R + color, c); }
    if (a > 0) px.blend(g, a, 'add', () => g.drawImage(c, Math.round(x) - R, Math.round(y) - R));
  }
  const tint = (g, src, color) => { g.clearRect(0, 0, src.width, src.height); g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; px.rect(g, 0, 0, src.width, src.height, color); g.globalCompositeOperation = 'source-over'; };   // a solid silhouette of src
  function ring(g, x, y, R, w, color) {   // a pixel ring: per row, the spans between two circles
    x = Math.round(x); y = Math.round(y); px.col(g, color);
    for (let dy = -Math.floor(R); dy <= R; dy++) { const o = Math.floor(Math.sqrt(R * R - dy * dy)), i = Math.abs(dy) < R - w ? Math.floor(Math.sqrt((R - w) ** 2 - dy * dy)) : -1;
      if (i < 0) g.fillRect(x - o, y + dy, o * 2 + 1, 1); else { g.fillRect(x - o, y + dy, o - i, 1); g.fillRect(x + i + 1, y + dy, o - i, 1); } }
  }

  /* ---- 2. THE GROUND: one painting baked through a TileMap floorTex; every color is a function of the world point ----
   * (no tiles, so nothing seams). A sine river, bridges wherever a road crosses it, noise-bent borders, muted colors. */
  const BASE_Y = 372, TOWN_Y = 760, STREETS = [470, 650], RIVER = y => 136 + 160 * Math.sin(TAU * (y - 560) / 680);
  const warp = (x, y, k) => (E.noise2(x * .06, y * .06) - .5) * k, pmod = (a, n) => ((a % n) + n) % n;   // (pmod: the valley goes on left of x 0)
  // distance past the river bank and the road edge (< 0 inside)
  const river = (x, y) => y < BASE_Y + 12 ? 99 : Math.abs(x - RIVER(y)) / Math.hypot(1, 1.48 * Math.cos(TAU * (y - 560) / 680)) - 14 - 3 * Math.sin(y * .02) + warp(x, y, 5);
  const road = (x, y) => Math.min(Math.abs(x - 136) - 10, y > BASE_Y && y < TOWN_Y ? Math.min(...STREETS.map(s => Math.abs(y - s) - 8)) : 99);
  const isField = (x, y) => y > TOWN_Y + warp(x, y, 30) && E.noise2(x * .011 + 7, y * .011) > .5 && river(x, y) > 10 && road(x, y) > 8;
  const forest = (x, y) => y > BASE_Y + 20 && E.noise2(x * .02 + 40, y * .02) > .6;
  const C = {}, TUFT = ['1.1', '.1.', '.2.'], PARK = [[100, 262], [172, 262], [96, 176], [176, 176]];   // [r, g, b] palette; a 'v' grass tuft; parked jets
  for (const [k, v] of Object.entries({ grass: '#26442d #305236 #3c5f3e #4b7148 #6a8e5e', water: '#1b4264 #24587e #3a7a96 #c4dee4', bank: '#6a5e46 #837456', road: '#3e3f46 #46474e #c2a24a #8a8986',
    walk: '#7a7873 #6a6863', deck: '#8a857a #c4beb0 #152e46', hedge: '#1e3623 #2b482f', gravel: '#69634f #5a5446', tarmac: '#3b3c43 #c49c3c', slab: '#77787e #707177 #7c7d83 #55565d #86878d #626369',
    crops: '#a08848 #8a7440 #5a7640 #4c6636 #6c5038 #5a4230 #76688e #645880' })) C[k] = v.split(' ').map(E.hex);
  const SLAB = { stones: C.slab.slice(0, 3), mortar: C.slab[3], hi: C.slab[4], lo: C.slab[5], speck: C.slab[1] };
  function grass(x, y) {   // patches, clumps, a 1 px tuft in each 7 px cell
    const n = E.noise2(x * .045, y * .045) * .7 + E.noise2(x * .21, y * .21) * .3 - (forest(x, y) ? .22 : 0), cx = Math.floor(x / 7), cy = Math.floor(y / 7), h = E.hash2(cx, cy);
    const m = h > .4 && n > .28 && (TUFT[Math.floor(y) - cy * 7 - 1 - Math.floor(h * 70) % 3] || '')[Math.floor(x) - cx * 7 - 1 - Math.floor(h * 30) % 3];
    return m === '1' ? C.grass[4] : m === '2' ? C.grass[0] : C.grass[n > .62 ? 3 : n > .45 ? 2 : n > .28 ? 1 : 0];
  }
  function field(x, y) {   // patchwork plots with hedges, each with its own crop and rows
    const u = x + warp(x, y, 10), v = y + warp(y, x, 10), fx = Math.floor(u / 54), fy = Math.floor(v / 46), k = E.hash2(fx, fy + 99);
    return u - fx * 54 < 3 || v - fy * 46 < 3 ? C.hedge[E.noise2(x * .4, y * .4) > .5 ? 1 : 0] : C.crops[Math.floor(k * 4) * 2 + (Math.floor(k > .5 ? u : v) % 4 ? 0 : 1)];
  }
  function base(x, y) {   // concrete slabs, oil stains, a taxiway, parking boxes
    const d = Math.abs(x - 136), c = E.tex.flagstone(x, y, SLAB, 32);
    if (d < 13) return d < 1 && y % 16 < 9 ? C.tarmac[1] : d > 11.5 ? C.road[3] : C.tarmac[0];
    return PARK.some(([a, b]) => Math.floor(Math.max(Math.abs(x - a), Math.abs(y - b))) === 14) ? C.tarmac[1] : E.noise2(x * .04 + 3, y * .04) > .66 ? c.map(v => v * .85) : c;
  }
  function paint(x, y) {   // the ground's color at a world point, before the baked shadows (ground adds them)
    const rv = river(x, y), rd = road(x, y), edge = BASE_Y + warp(x, 0, 16), n = s => E.noise2(x * s, y * s) > .5 ? 0 : 1;
    const dash = (Math.abs(x - 136) < 1 && y % 14 < 7 && road(x + 20, y) > 0) || (STREETS.some(s => Math.abs(y - s) < 1) && pmod(x, 14) < 7 && Math.abs(x - 136) > 10);
    return (y < edge ? base(x, y) : y < edge + 5 ? C.gravel[n(.5)]
      : rd < 0 ? (rv < 3 ? C.deck[rd > -2 ? 1 : 0] : rd > -1 ? C.road[3] : dash ? C.road[2] : C.road[n(.3)])   // bridge deck, road
      : rv < 0 ? (road(x - 3, y - 4) < 0 ? C.deck[2] : rv > -2 ? C.water[3] : rv > -6 || Math.sin(x * .3 + y * .12 + Math.sin(y * .05) * 2) > .93 ? C.water[2] : C.water[n(.05)])   // water
      : rv < 5 ? C.bank[n(.3)] : y < TOWN_Y && rd < 3 ? C.walk[pmod(x, 6) < 1 || y % 6 < 1 ? 1 : 0] : isField(x, y) ? field(x, y) : grass(x, y));
  }
  const ground = (x, y) => shade(x, y, paint(x, y));
  const SUN = [.5, .65];   // shadow length per unit of height (sun up-left)
  function shade(x, y, c) {   // baked shadows: boxes swept along the sun, round canopies
    for (const o of BAND[Math.floor(y / 32)] || []) if (o.z ? Math.max((x - o.x - o.w) / SUN[0], (y - o.y - o.d) / SUN[1], 0) <= Math.min((x - o.x) / SUN[0], (y - o.y) / SUN[1], o.z)
      : ((x - o.x - 6 * o.sh) / (9 * o.sh)) ** 2 + ((y - o.y + 4 * o.sh) / (5 * o.sh)) ** 2 < 1) return [c[0] * .5, c[1] * .56, c[2] * .7];
    return c;
  }

  /* ---- 3. BUILDINGS AND PROPS: the air base by hand, town and farm lots from a seeded random walk ---- */
  const LOTS = [[8, 30, 60, 44, 28, 'hangar'], [204, 30, 60, 44, 28, 'hangar'], [10, 200, 52, 40, 22, 'hangar'], [210, 200, 52, 40, 22, 'hangar'],
    [186, 300, 22, 22, 50, 'tower'], [38, 110, 34, 26, 12, 'flat'], [200, 110, 34, 26, 12, 'flat']];   // [x, y, width, depth, height, style]
  const near = (b, x, y, w, d, m) => x < b[0] + b[2] + m && x + w + m > b[0] && y < b[1] + b[3] + m && y + d + m > b[1];
  for (let i = 0, rnd = E.rng(11); i < 90; i++) {
    const y = BASE_Y + 14 + rnd() * (MAP_H - BASE_Y - 50), town = y < TOWN_Y, w = 22 + rnd() * 12 | 0, d = 18 + rnd() * 10 | 0, x = rnd() * (WW - w), z = town ? 14 + rnd() * 14 | 0 : 12;
    if ((town || rnd() < .1) && !isField(x + w / 2, y + d / 2) && !LOTS.some(b => near(b, x, y, w, d, 5)) && [0, .5, 1].every(u => [0, .5, 1].every(v => river(x + u * w, y + v * d) > 5 && road(x + u * w, y + v * d) > 4)))
      LOTS.push([x, y, w, d, z, town && rnd() < .3 ? 'flat' : 'roof']);
  }
  const ROOF = ['#9a4a38', '#4e5f7a', '#3c6a66', '#a07c3c', '#7a4a5a'], WALL = ['#b8a88c', '#9a9088', '#a89478'];
  const BLDS = LOTS.map(([x, y, w, d, z, style], i) => ({ x, y, w, d, z, style, roof: E.tones({ hangar: '#5e7a6a', tower: '#74767e', flat: '#74767e' }[style] || ROOF[i % 5]), wall: E.tones(/roof|flat/.test(style) ? WALL[i % 3] : '#8a8e94') }));
  const PROPS = [], TINT = { tree: '#3b6a44', pine: '#2c5446', bush: '#3c6a42', fence: '#8a6a48' };
  for (let i = 0, rnd = E.rng(5); i < 1600; i++) {
    const x = rnd() * WW, y = BASE_Y + 16 + rnd() * (MAP_H - BASE_Y), k = rnd(), s = Math.round(7 + rnd() * 3) / 10, name = forest(x, y) ? (k < .65 ? 'tree' : 'pine') : ['tree', 'bush', 'rock', 'flowers'][Math.floor(k * 80)];
    if (name && river(x, y) > 6 && road(x, y) > 5 && !isField(x, y) && !LOTS.some(b => near(b, x - 6, y - 10, 12, 12, 2))) PROPS.push({ name, x, y, s: /tree|pine/.test(name) ? s : .9, sh: /tree|pine/.test(name) ? s : name === 'bush' ? .45 : 0 });
  }
  for (let y = 24; y < BASE_Y; y += 56) PROPS.push({ name: 'lamp', x: 119, y, s: .7 }, { name: 'lamp', x: 153, y, s: .7 });
  for (let x = 6; x < WW; x += 15) if (Math.abs(x - 136) > 20) PROPS.push({ name: 'fence', x, y: BASE_Y + 4, s: .9 });
  PROPS.sort((a, b) => a.y - b.y);
  // shapes (docs/ASSETS.md), on a seed of their own (the props stay as they were): hay in the fields from the asset store,
  // cut into the page's 'shooter' set (src/assets/sets/shooter.js: none without it); carts parked by the farm road from the
  // core library
  const DRESS = [], STRAW = { a: '#c8a456 thatch' };   // (the kit's straw came pink at this size)
  if (E.addAssets((window.ASSETS || {}).shooter || { set: 'shooter' }).shapes.length) for (let i = 0, rnd = E.rng(23); i < 500 && DRESS.length < 24; i++) {
    const x = 10 + rnd() * (WW - 20), y = TOWN_Y + 30 + rnd() * (MAP_H - TOWN_Y - 60), a = rnd() < .5 ? 0 : D, id = rnd() < .5 ? 'shooter:hay-bale' : 'shooter:hay-bale-bundled';
    if ([-10, 0, 10].every(d => isField(x + d, y) && isField(x, y + d)) && !DRESS.some(p => Math.hypot(p.x - x, p.y - y) < 36)) DRESS.push({ id, x, y, o: { facing: a, scale: .6, mats: STRAW } });
  }
  for (const [x, y, a] of [[116, 880, D], [157, 1046, -D], [116, 1196, D]]) if (river(x, y) > 12 && !isField(x, y)) DRESS.push({ id: 'cart', x, y, o: { facing: a, scale: .8 } });
  DRESS.sort((a, b) => a.y - b.y);
  const BAND = [];   // shadow casters per 32 px band
  for (const o of [...BLDS, ...PROPS.filter(p => p.sh)]) for (let b = Math.floor((o.y - 14) / 32); b <= (o.y + (o.d || 0) + (o.z || 0) * SUN[1] + 14) / 32; b++) (BAND[b] = BAND[b] || []).push(o);
  const map = new E.TileMap({ rows: Array(MAP_H / 16).fill('.'.repeat(WW / 16)), floorTex: ground, ao: 0, shimmer: false });

  /* ---- 2b. BEYOND THE PLAYFIELD: a screen wider than WW sees the valley go on to each side, painted by the same functions
   * (no baked shadows), baked as strips of rows when they come into view and a few ahead each step (a whole side at once
   * would stall the start), with trees of its own. A curtain dims it (draw): the game is played in the middle ---- */
  const EDGE = 512, STRIP = 8, edges = [0, 1].map(() => ({ cv: E.mkCanvas(EDGE, MAP_H), done: new Int16Array(MAP_H / STRIP) }));   // done: columns baked per strip
  function bakeStrip(side, k, w) {   // side 0: x in [-w, 0), side 1: [WW, WW + w); columns already baked are kept
    const e = edges[side], from = e.done[k]; if (from >= w) return false;
    const n = w - from, g = E.ctx2d(e.cv), im = g.createImageData(n, STRIP), d = im.data;
    for (let row = 0; row < STRIP; row++) for (let i = 0; i < n; i++) {
      const col = from + i, x = side ? WW + col + .5 : -col - .5, c = paint(x, k * STRIP + row + .5), o = (row * n + (side ? i : n - 1 - i)) * 4;
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
    g.putImageData(im, side ? from : EDGE - w, k * STRIP); e.done[k] = w; return true;
  }
  function edgeStep(r) {   // bake what shows now, then up to two strips ahead
    const w = Math.min(EDGE, Math.ceil((r.W - WW) / 2) + 4); if (w <= 4) return 0;
    const k0 = Math.max(0, Math.floor((scroll - 2) / STRIP)), k1 = Math.min(MAP_H / STRIP - 1, Math.floor((scroll + r.H + 2) / STRIP));
    for (let k = k0; k <= k1; k++) for (const side of [0, 1]) bakeStrip(side, k, w);
    let ahead = 2; for (let k = k0 - 1; k >= 0 && ahead > 0; k--) for (const side of [0, 1]) if (bakeStrip(side, k, w)) ahead--;
    return w;
  }
  const EDGE_PROPS = [];   // trees, bushes and rocks out there (their own seed: the playfield's are kept as they were)
  for (let i = 0, rnd = E.rng(6); i < 6000; i++) {
    const side = rnd() < .5, x = side ? WW + 4 + rnd() * EDGE : -4 - rnd() * EDGE, y = BASE_Y + 16 + rnd() * (MAP_H - BASE_Y), k = rnd(), s = Math.round(7 + rnd() * 3) / 10;
    const name = forest(x, y) ? (k < .65 ? 'tree' : 'pine') : ['tree', 'bush', 'rock', 'flowers'][Math.floor(k * 80)];
    if (name && river(x, y) > 6 && road(x, y) > 5 && !isField(x, y)) EDGE_PROPS.push({ name, x, y, s: /tree|pine/.test(name) ? s : .9 });
  }
  EDGE_PROPS.sort((a, b) => a.y - b.y);
  function building(g, r, b) {   // one-point perspective: height z pushes a point out from the screen center
    const vx = r.bw / 2, vy = r.bh * .55, Pt = (x, y, z) => { const [a, c] = r.w(x, y), k = 1 + z * PERSP; return [vx + (a - vx) * k, vy + (c - vy) * k]; };
    const { x, y, w, d, z, roof: R, wall: Q, style } = b, x1 = x + w, y1 = y + d, L2 = (A, B, k) => [lerp(A[0], B[0], k), lerp(A[1], B[1], k)];
    // only walls facing the screen center show, shaded by side
    for (const [ax, ay, bx, by, t, show] of [[x, y, x1, y, 'lt', Pt(x, y, 0)[1] > vy], [x, y, x, y1, 'base', Pt(x, y, 0)[0] > vx], [x, y1, x1, y1, 'sh', Pt(x, y1, 0)[1] < vy], [x1, y, x1, y1, 'deep', Pt(x1, y, 0)[0] < vx]]) if (show) {
      const P = (s, h) => Pt(lerp(ax, bx, s), lerp(ay, by, s), h), len = Math.hypot(bx - ax, by - ay); px.poly(g, [P(0, 0), P(1, 0), P(1, z), P(0, z)], Q[t]);
      if (style === 'hangar') { if (t === 'sh') px.poly(g, [P(.12, 0), P(.88, 0), P(.88, z * .7), P(.12, z * .7)], '#1c2026'); }
      else for (let h = 4; h < z - 5; h += 9) for (let s = 3 / len; s < 1 - 5 / len; s += 6 / len) px.poly(g, [P(s, h), P(s + 3 / len, h), P(s + 3 / len, h + 4), P(s, h + 4)], style === 'tower' && h > z - 16 ? '#6ac0e0' : t === 'lt' ? '#56708a' : '#26303c');
    }
    const A = Pt(x, y, z), B = Pt(x1, y, z), Cc = Pt(x1, y1, z), Dd = Pt(x, y1, z);
    if (style === 'roof') {   // gable roof along the long side
      const h = z + Math.min(w, d) * .35, along = w >= d, m0 = along ? Pt(x, y + d / 2, h) : Pt(x + w / 2, y, h), m1 = along ? Pt(x1, y + d / 2, h) : Pt(x + w / 2, y1, h);
      if (along) { px.poly(g, [A, m0, Dd], Q.base); px.poly(g, [B, m1, Cc], Q.deep); } else { px.poly(g, [A, m0, B], Q.lt); px.poly(g, [Dd, m1, Cc], Q.sh); }
      (along ? [[A, B], [Dd, Cc]] : [[A, Dd], [B, Cc]]).forEach(([e0, e1], i) => { px.poly(g, [e0, e1, m1, m0], i ? R.deep : R.lt); for (const k of [.35, .7]) px.line(g, ...L2(e0, m0, k), ...L2(e1, m1, k), i ? R.sh : R.base); px.line(g, ...e0, ...e1, '#1c1418'); });
      px.line(g, ...m0, ...m1, R.hi);
    } else if (style === 'hangar') {   // barrel vault: six strips from lit to dark, ribs
      const Y = k => y + d * k / 6, Z = k => z + Math.sin(Math.PI * k / 6) * d * .3, arc = xx => [0, 1, 2, 3, 4, 5, 6].map(k => Pt(xx, Y(k), Z(k)));
      px.poly(g, arc(x), Q.base); px.poly(g, arc(x1), Q.deep);
      for (let k = 0; k < 6; k++) px.poly(g, [Pt(x, Y(k), Z(k)), Pt(x1, Y(k), Z(k)), Pt(x1, Y(k + 1), Z(k + 1)), Pt(x, Y(k + 1), Z(k + 1))], R[['hi', 'lt', 'base', 'base', 'sh', 'deep'][k]]);
      for (let s = 10; s < w; s += 12) arc(x + s).reduce((p, q) => (px.line(g, ...p, ...q, R.sh), q));
    } else {   // flat roof: parapet, deck, vents
      px.poly(g, [A, B, Cc, Dd], R.lt); px.poly(g, [Pt(x + 2, y + 2, z), Pt(x1 - 2, y + 2, z), Pt(x1 - 2, y1 - 2, z), Pt(x + 2, y1 - 2, z)], R.sh);
      for (const [u, v] of [[.25, .3], [.6, .55]]) { const q = Pt(x + w * u, y + d * v, z); px.rect(g, q[0], q[1], 5, 4, R.deep); px.rect(g, q[0], q[1], 5, 1, R.hi); }
    }
  }

  /* ---- 4. CRAFT: vector art in a local frame (u = right, v = forward), so anything can turn and bank ----
   * Parts are SVG-like polygons 'key u,v u,v ...' (the right half, mirrored), painted back to front in the palette key's
   * E.tones, the sunlit half lighter; 'key/1' lifts a tone. 'line' = seams, 'mark' = roundels u,v,radius ('mark/dark'
   * picks the color), 'sheen' = a gloss streak added as light, 'fire' = nozzles. Flat tone clusters, never dither. */
  const art = s => s.split('|').map(p => { const [k, ...q] = p.trim().split(' '), [key, lift] = k.split('/'); return [key, q.map(c => c.split(',').map(Number)), isNaN(lift) ? lift : +lift]; });
  const TONE = ['deep', 'sh', 'base', 'lt', 'hi'], frame = (x, y, a, s = 1) => { const c = Math.cos(a), n = Math.sin(a); return (u, v) => [x + (v * c - u * n) * s, y + (v * n + u * c) * s]; };
  // bank (-1..1) rolls the craft: the dipping half shortens and turns a tone darker, the rising one widens, and raised
  // parts (canopy, gloss: du) slide toward the dip as the fuselage turns its flank up
  const roll = (bank, s) => s * (1 - Math.abs(bank) * .25) * (1 - s * bank * .3);
  function sym(g, P, a, pts, tone, bank = 0, lift = 0, du = 0) {
    const lit = Math.sin(a) > Math.cos(a) ? 1 : -1;
    for (const s of [-1, 1]) px.poly(g, pts.map(([u, v]) => P(u * roll(bank, s) + du, v)), tone[TONE[clamp((s === lit ? 3 : 1) + lift - (s * bank > .25), 0, 4)]]);
  }
  function plane(g, x, y, a, bank, parts, pal, s, up = 0) {   // up > 0 lifts every tone (the boss's hit flash)
    const P = frame(x, y, a, s), both = [roll(bank, -1), roll(bank, 1)];
    for (const [key, pts, lift = 0] of parts) {
      if (key === 'line') { for (const m of both) pts.reduce((p, q) => (px.line(g, ...P(p[0] * m, p[1]), ...P(q[0] * m, q[1]), E.tones(pal.hull).deep), q)); }
      else if (key === 'fire') { if (!pal.off) for (const [u, v] of pts) for (const m of u ? both : [0]) { const f = 1.5 + Math.sin(game.real * 53 + u * 3 + x) * .8, q = P(u * m, v - f), c = P(u * m, v - .4); px.disc(g, q[0], q[1], 1.6 * s, '#ff7a2a'); px.disc(g, c[0], c[1], 1.1 * s, '#fff0b0'); } }
      else if (key === 'mark') { const T = E.tones(pal[lift] || pal.trim); for (const [u, v, rr] of pts) for (const m of u ? both : [0]) { const q = P(u * m, v); px.disc(g, q[0], q[1], rr * s, T.deep); px.disc(g, q[0], q[1], rr * s * .5, T.hi); } }
      else if (key === 'sheen') { const m = both[Math.sin(a) > Math.cos(a) ? 1 : 0]; px.blend(g, .3, 'add', () => px.poly(g, pts.map(([u, v]) => P(u * m + bank, v)), '#fff0e0')); }
      else sym(g, P, a, pts, E.tones(pal[key]), bank, lift + up, key === 'glass' ? bank * 1.6 : 0);
    }
  }
  const nozzles = (parts, x, y, a, s) => { const P = frame(x, y, a, s), out = []; for (const [key, pts] of parts) if (key === 'fire') for (const [u, v] of pts) for (const m of u ? [-1, 1] : [0]) out.push(P(u * m, v - 2)); return out; };
  const PLAYER = art(`fire 3.8,-14.5|wing 2.5,-7 7.5,-13 7.5,-15.5 2.5,-13.5|wing 3,5 12.5,-4 13,-8.5 3,-7|wing/1 3,5 12.5,-4 12.6,-5.3 3,3.6|trim 9.5,-2.2 12.5,-4 13,-8.5 10,-7.8
    |dark 2.6,-2 5.2,-3 5.2,-14.5 2.6,-14.5|hull 0,17 1.6,13 3.2,6 3.4,-11 2.2,-14.5 0,-14.5|sheen .4,14 1.2,12 2,5 2,-11 .6,-13|trim 0,2.5 3.3,2.5 3.35,-.5 0,-.5|glass 0,11 1.4,9 1.5,4.5 0,3.5
    |mark 8.5,-4.8,1.6|line 1.6,13 .9,4 1.4,-12|line 5,-9 10.5,-5.5`);
  const JET = art(`fire 0,-11|wing 1.2,-6 5,-10.5 5,-12 1.2,-10.5|wing 1.8,4 10,-5 10,-7.5 1.8,-3|wing/1 1.8,4 10,-5 10,-5.8 1.8,3|trim 7.8,-3.4 10,-5 10,-7.5 8,-6|mark 6.2,-2.8,1.3
    |dark 2,2 3.2,1.5 3.2,-5 2,-5|hull 0,11 1.5,7.5 2.3,2 2.4,-8 1.3,-11 0,-11|sheen .3,9.5 1,7.2 1.4,2 1.4,-8 .5,-10|glass 0,8 1.1,6 1.1,2.5 0,1.5`);
  const JET2 = art(`fire 2.2,-11.5|wing 1.5,-7 6,-9 6.5,-12.5 1.5,-11.5|hull/1 6.1,5 7.3,5 7.3,-3 6.1,-3|trim 6.1,6 7.3,6 7.3,4.6 6.1,4.6|wing 2,6 8,1 11,-4 11,-6.5 2,-4|wing/1 2,6 8,1 8.5,0 2,4.8
    |trim 9,-3 11,-4 11,-6.5 9,-5.5|mark 6.8,-2.6,1.4|dark 3.2,-4 4.6,-4 5,-11 3.6,-11|hull 0,12 1.8,8 3.2,2 3.4,-9 2.2,-11.5 0,-11.5|sheen .4,10.5 1.2,8 2,2 2,-9 .6,-10.5|glass 0,8.5 1.3,6.5 1.3,3 0,2`);
  const HELI = art(`hull 0,-6 1.6,-6 1.1,-19 0,-19|wing/-1 0,-16 5,-18 5,-20.5 0,-20.5|mark/star 0,-12,1.6|dark 3.5,2.5 10,1.5 10,-2 3.5,-2|trim 8,5.5 11,5.5 11,-4 8,-4|mark/dark 9.5,4.6,1.2|line 8,1 11,1
    |hull 0,12 3.8,10 5.2,4 5,-5 2.4,-8 0,-8|dark 4,1 5.3,1 5.1,-4 4,-4|sheen .5,10.5 2,9 2.8,3 2.4,-5 .6,-6.5|glass 0,11.5 2.8,9.5 3.2,6.5 0,6|glass/-1 0,5 3,4.5 3,2 0,1.5|line 0,-8 4.8,-5`);
  const BOMBER = art(`fire 9.5,-10 17.5,-9|wing 1.5,-14 11,-18 11,-21 1.5,-20|wing 3.5,6 26,-2 26,-7 3.5,-5|wing/1 3.5,6 26,-2 26,-3 3.5,5|trim 23,-1.6 26,-2 26,-7 23,-6.6|dark 8,8 11,8 11,-9 8,-9
    |dark 16,6 19,6 19,-8 16,-8|mark 21.5,-3.2,2|hull 0,20 3,16 4.6,6 4,-16 1.6,-21 0,-21|sheen .5,18 2,15 2.8,6 2.4,-16 .6,-19|glass 0,17 2,14.5 2,11 0,10|glass 0,-19 1,-19 1,-21.5 0,-21.5
    |mark/glass 0,3,2.2|line 4.5,2 0,1|line 4.2,-8 0,-9|line 11,2 16,1`);
  const BOSS = art(`fire 8,-50 18,-48|dark 4,-32 24,-32 24,-50 4,-50|wing/1 6,-45 11,-45 11,-51 6,-51|wing/1 15,-43 21,-43 21,-49 15,-49|wing 14,20 38,8 40,-18 34,-26 14,-30|wing/1 14,20 38,8 38.5,5 14,15
    |dark 27,1 35,-2 35,-4 27,-1|dark 27,-5 35,-8 35,-10 27,-7|dark 27,-11 35,-14 35,-16 27,-13|hull 0,56 7,50 15,32 24,20 26,-32 17,-42 0,-46|wing/-1 20,16 26,12 26,-28 20,-31|hull/1 0,44 8,36 12,16 12,-26 0,-34
    |trim 12,12 20,17 20,13 12,7|trim 12,-4 20,1 20,-3 12,-9|dark 4,-16 9,-16 9,-24 4,-24|dark 3,42 6,42 6,57 3,57|glass 0,32 6,28 6,22 0,20|sheen 1,42 5,37 8,18 8,-24 4,-30 1,-28
    |sheen 10,36 14,30 16,20 16,-28 14,-30 14,16 11,30|line 7,50 12,16 12,-26|line 26,-28 0,-28|line 14,20 14,-30|mark/dark 31,-19,4.5`);
  const POD = art('fire 0,-20|wing 0,20 6,16 8,-14 5,-20 0,-20|dark 0,12 4,10 4,-10 0,-12|trim 0,18 5,15 5.5,12 0,14|sheen 4.5,15 6,14 7,-12 5.5,-13|line 6,16 8,-14');
  const PAL = { player: { hull: '#e8e4ee', wing: '#c83a30', trim: '#2f58d0', glass: '#5ab0f0', dark: '#4a4e5e' }, jet: { hull: '#b8c2d0', wing: '#4f6a98', trim: '#f0a030', glass: '#e05030', dark: '#34384a' },
    jet2: { hull: '#d8743a', wing: '#9a3a2a', trim: '#f0c040', glass: '#58c0f0', dark: '#3e2a26' }, heli: { hull: '#8e8c5a', wing: '#5e6444', dark: '#2e322a', trim: '#c8a040', glass: '#58c8f0', star: '#d8402e' },   // saturated, to pop off clouds
    bomber: { hull: '#8e909e', wing: '#6a7088', trim: '#d84a3a', glass: '#58d8e8', dark: '#3a3c48' },
    boss: { hull: '#7a2638', wing: '#56627c', dark: '#2e3042', trim: '#d8a040', glass: '#8af0ff' }, dead: { hull: '#3a302e', wing: '#2e2a2c', dark: '#1e1a1c', trim: '#4a3a30', glass: '#2a2020', off: true } };
  PAL.parked = { ...PAL.jet, off: true };   // engines off
  function turret(g, x, y, aim, kick = 0, color = '#5a6078') {   // twin barrels under a dome
    const Q = frame(x, y, aim), T = E.tones(color); for (const s of [-2, 2]) px.line(g, ...Q(s, 2), ...Q(s, 14 - kick * 4), '#22202a', 2);
    px.disc(g, x, y, 6, T.deep); px.disc(g, x - .6, y - .6, 5, T.base); px.disc(g, x - 2, y - 2, 1.8, T.hi);
  }
  function tank(g, x, y, f) {   // tread links roll as it drives
    const P = frame(x, y, f.a), Q = frame(x, y, f.aim), B = E.tones('#a08a58'), K = E.tones('#3a3630'), [cx, cy] = Q(0, -1);
    for (const s of [-1, 1]) { px.poly(g, [P(s * 5, 11), P(s * 9, 11), P(s * 9, -11), P(s * 5, -11)], K.sh); for (let v = -10 + f.odo % 3; v < 11; v += 3) px.line(g, ...P(s * 5, v), ...P(s * 9, v), K.deep); }
    sym(g, P, f.a, [[0, 11], [5.5, 10], [5.5, -10], [0, -11]], B); sym(g, P, f.a, [[0, -6], [4, -6], [4, -10], [0, -10]], B, 0, -1);
    px.line(g, ...Q(0, 3), ...Q(0, 17 - f.kick * 4), K.base, 3); px.line(g, ...Q(-1, 5), ...Q(-1, 16 - f.kick * 4), K.lt);
    px.disc(g, cx, cy, 6.5, B.deep); px.disc(g, cx - .6, cy - .6, 5.5, B.base); px.disc(g, cx - 2, cy - 2, 2, B.hi); px.disc(g, cx + 1.5, cy + 1, 1.5, B.sh);
  }
  function gun(g, x, y, f) {   // sandbag ring, pad, turret
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, bx = x + Math.cos(a) * 11, by = y + Math.sin(a) * 11; px.disc(g, bx, by, 3, '#5e5440'); px.disc(g, bx - .7, by - .7, 2.2, '#a8966c'); }
    px.disc(g, x, y, 8.5, '#55565d'); turret(g, x, y, f.aim, f.kick, '#8e5a4a');
  }
  function rotor(g, x, y, t) {   // a see-through blur disc, a lit tip ring, two grey blades edged dark
    px.blend(g, .25, 'normal', () => px.disc(g, x, y, 22, '#0c1014')); px.blend(g, .6, 'add', () => ring(g, x, y, 22, 1, '#8a98a8'));
    for (const q of [0, D]) { const b = t * 24 + q, c = Math.cos(b) * 22, n = Math.sin(b) * 22; for (const [col, w] of [['#23272e', 2], ['#9aa4ae', 1]]) px.line(g, x - c, y - n, x + c, y + n, col, w); }
  }
  // the fortress is one r.actor (up to ~250 px); its frame turns and shrinks the falling wreck
  const wingGuns = (x, y, f) => [-1, 1].map(s => frame(x, y, D + f.spin, 1.3 * f.scale)(s * 31, -19));
  function paintBoss(g, x, y, f) {
    const s = 1.3 * f.scale, P = frame(x, y, D + f.spin, s), up = f.flash > 0 ? 1 : 0, guns = !f.dying;
    for (const p of f.parts.slice(0, 2)) {   // swinging gun pods; a dead pod stays as a burnt shell
      const q = P(p.s * 46, -4); px.line(g, ...P(p.s * 20, 0), ...q, '#2c2e3a', 6 * f.scale); px.line(g, ...P(p.s * 20, 1), ...q, '#5a6078', 2);
      plane(g, q[0], q[1], D + f.spin + Math.sin(f.t * .9 + p.s) * .2, 0, POD, p.hp > 0 ? PAL.boss : PAL.dead, s, up); if (p.hp > 0 && guns) turret(g, q[0], q[1] + 4, p.aim, p.kick);
    }
    plane(g, x, y, D + f.spin, 0, BOSS, PAL.boss, s, up); if (guns) { turret(g, ...P(0, 34), f.aim, 0, '#6a3040'); for (const q of wingGuns(x, y, f)) turret(g, ...q, f.aim, f.kick, '#56627c'); }
    px.disc(g, x, y, 9 * f.scale, '#140c14'); px.disc(g, x, y, 7 * f.scale, '#3a0c10');
  }
  function bossLayers(r, f) {   // anchored 50 px low: the actor box has more room above
    const alt = 120 * f.scale ** 3, art = (g, x, y) => paintBoss(g, x, y - 50, f);   // the falling wreck's shadow slides in under it
    r.actor(f.x + alt * SUN[0], f.y + alt * SUN[1] + 50, 4, art, { flash: '#0c0a14', flashMix: 1, alpha: .45, outline: false });
    r.actor(f.x, f.y + 50, 7, art);
    r.queue(f.x, f.y, 7.5, g => {   // additive light: the pulsing core, the engines
      const [x, y] = r.w(f.x, f.y), core = f.parts[2], p = 5 + Math.sin(game.real * (core.hp < core.max / 2 ? 16 : 7)) * 1.5;
      if (!f.dying || Math.random() < .5) { glow(g, x, y, 16, '#ff4a2a', .6); px.disc(g, x, y, p, '#ff5a30'); px.disc(g, x - 1, y - 1, p * .5, '#fff0c0'); }
      for (const q of nozzles(BOSS, x, y, D + f.spin, 1.3 * f.scale)) glow(g, q[0], q[1], 10, '#ff8030', .9);
      // telegraphs: a glow swells and a ring closes in on each charging gun (in its bullets' color); the wing guns light their lines of fire
      if (!f.dying) for (const o of [...f.parts, f]) if (o.chg > 0 && !(o.hp <= 0)) {
        const u = 1 - o.chg / o.chg0, big = o === f.parts[2], c = o === f ? '#3a7aff' : big ? '#ff8a30' : '#ff4a9a';
        for (const [cx, cy] of o === f ? wingGuns(x, y, f) : [r.w(o.x, o.y + (big ? 0 : 10))]) {
          glow(g, cx, cy, 3 + u * (big ? 20 : 8), c, u); px.blend(g, u, 'add', () => ring(g, cx, cy, 2 + (1 - u) * (big ? 44 : 18), 1, c));
          if (o !== f) continue;   // the wing guns' 2 px sight lines cross on the ship (a lock-on ring there) and blink just before the shot
          const [sx, sy] = r.w(ship.x, ship.y), a = Math.atan2(sy - cy, sx - cx);
          if (u < .6 || game.real * 16 % 2 < 1) px.blend(g, .2 + u * .6, 'add', () => { px.line(g, cx, cy, cx + Math.cos(a) * 330, cy + Math.sin(a) * 330, c, 2); ring(g, sx, sy, 7, 1, '#9ac8ff'); });
        }
      }
    });
  }

  /* ---- 5. EXPLOSIONS: a white-hot flash, ground light, a shockwave, lumpy fire puffs cooling along a ramp, engine sparks,
   * debris and late smoke. A chain passes shake: 0, freeze: false. Air blasts scroll along. */
  const FIRE = ['#fffbe6', '#ffe27a', '#ffb040', '#f07028', '#9a3a28', '#4a3432'];
  const add = o => fx.length < 500 && fx.push(Object.assign({ t: 0, vx: 0, vy: 0, delay: 0 }, o));
  function boom(x, y, size = 1, o = {}) {
    const air = !!o.air, R = E.rand, z = air ? 14 : 3;
    add({ k: 'flash', x, y, r: 12 * size, life: .16, air }); add({ k: 'light', x, y, r: 26 * size, life: .5 + .1 * size, air });
    add({ k: 'ring', x, y, r: 28 * size, life: .45, air });
    for (let i = 0; i < 5 + 4 * size; i++) { const a = R(0, TAU), c = Math.cos(a), n = Math.sin(a), sp = R(10, 55) * size; add({ k: 'fire', x: x + c * 3 * size, y: y + n * 3 * size, vx: c * sp, vy: n * sp, r: R(5, 8) * Math.sqrt(size) * (i ? 1 : 1.6), life: R(.45, .8), delay: i * .03, lump: R(0, TAU), air }); }
    P.bits(x, y, z, 3 + 3 * size | 0, ['#3a3032', '#c8b8a0', '#ff9030']); P.sparks(x, y, z, 4 + 4 * size | 0); game.after(.3, () => P.smoke(x, y, z, 1 + size | 0, { size: 4 * Math.sqrt(size) }));
    if (o.sound !== false) A.sfx(size >= 1.8 ? 'boom' : 'explode', { vol: .45 });
    game.shake(o.shake ?? Math.min(4, 1.2 * size)); if (o.freeze !== false && size >= 2) { game.freeze(.05); game.flash('#fff0d0', .1, .3); }   // big kills: hit-stop, screen flash
  }
  function drawFx(g, r, layer) {   // layer 0: ground light, 1: ground blasts, 2: air blasts
    for (const kind of layer ? ['fire', 'ring', 'flash'] : ['light']) for (const p of fx) {
      const u = (p.t - p.delay) / p.life, [x, y] = r.w(p.x, p.y), R = p.r;
      if (p.k !== kind || u < 0 || (layer && (layer === 2) !== !!p.air)) continue;
      if (kind === 'light') glow(g, x, y, R, '#ff7a30', (1 - u) * .75);
      else if (kind === 'fire') {   // a lumpy puff (rim, body, lit cap, hot core) cooling to soot
        const i = Math.min(5, Math.floor(u * 8)), s = R * (u < .2 ? .4 + u * 3 : 1 + (u - .2) * .35), lx = x + Math.cos(p.lump) * s * .6, ly = y + Math.sin(p.lump) * s * .6, rim = FIRE[Math.min(5, i + 2)];
        px.blend(g, u > .4 ? (1 - u) / .6 : 1, 'normal', () => { px.disc(g, x, y, s, rim); px.disc(g, lx, ly, s * .7, rim); px.disc(g, x - s * .2, y - s * .2, s * .75, FIRE[i]); px.disc(g, x - s * .4, y - s * .4, s * .35, FIRE[Math.max(0, i - 1)]); });
        if (u < .45) px.blend(g, 1 - u * 2, 'add', () => px.disc(g, x - s * .35, y - s * .35, s * .45, '#fff0c0'));
      } else if (kind === 'ring') px.blend(g, (1 - u) * .9, 'add', () => ring(g, x, y, 2 + R * E.ease.outQuad(u), Math.max(1, 4 * (1 - u)), '#ffd890'));
      else {   // a white-hot disc and a star glint
        const k = R * 1.8 * (1 - u); px.blend(g, 1 - u, 'add', () => { px.disc(g, x, y, R * (.6 + u), '#fff6e0'); px.line(g, x - k, y, x + k, y, '#fff0c0'); px.line(g, x, y - k, x, y + k, '#fff0c0'); });
        glow(g, x, y, R * 2, '#ffc070', 1 - u);
      }
    }
  }
  const crater0 = (x, y, r, burn) => ({ x, y, r, burn, t: 0, shape: Array.from({ length: 12 }, () => E.rand(.8, 1.2)) });
  function crater(g, r, c) {   // scorch halo, lit rim, dark pit
    const [x, y] = r.w(c.x, c.y), P = (s, d = 0) => c.shape.map((q, i) => [x + d + Math.cos(i * TAU / 12) * q * c.r * s, y + d + Math.sin(i * TAU / 12) * q * c.r * s]);
    px.blend(g, .5, 'normal', () => px.poly(g, P(1.8), '#1c140e')); px.poly(g, P(1.05), '#6e5c48'); px.poly(g, P(.85, .6), '#3a2c22'); px.poly(g, P(.6, -.6), '#120c08');
  }
  // bullets by team: a shape per kind, each with an additive halo
  const ORB = E.sprite(['.kkkk.', 'kmppmk', 'kpwwpk', 'kpwwpk', 'kmppmk', '.kkkk.'], { k: '#40082a', m: '#ff2a8a', p: '#ff9ad0', w: '#ffffff' });
  const BIG = E.sprite(['..kkkk..', '.kmmmmk.', 'kmppppmk', 'kmpwwpmk', 'kmpwwpmk', 'kmppppmk', '.kmmmmk.', '..kkkk..'], { k: '#4a1206', m: '#ff6a1a', p: '#ffc050', w: '#ffffff' });
  function bullets(g, r, team) {
    for (const b of shots.list) if (b.team === team) {
      const [x, y] = r.w(b.x, b.y), s = Math.hypot(b.vx, b.vy) || 1, dx = b.vx / s, dy = b.vy / s, L = (k, c, w) => px.line(g, x - dx * k, y - dy * k, x + dx * 2, y + dy * 2, c, w);
      if (team === 'ship') { glow(g, x, y, 5, '#ffa040', .5); L(10, '#ff8a20', 3); L(8, '#fff8d0'); }   // vulcan tracer
      else if (b.art === 'needle') { glow(g, x, y, 6, '#3a7aff', .6); L(7, '#2a4ae8', 3); L(6, '#e8f6ff'); }   // aimed needle
      else { const n = b.art === 'big' ? 4 : 3; glow(g, x, y, n * 2 + 2, n > 3 ? '#ff6a1a' : '#ff2a8a', .5); px.sprite(g, n > 3 ? BIG : ORB, x - n, y - n); }
    }
  }

  /* ---- 6. STATE, WAVES AND UNITS ---- */
  let ship, foes, items, craters, fx, clouds, shots, scroll, t, wave, lives, bombs, score, power, boss, won, fireT, warnT;
  const STATS = { jet: [3, 9, 100, 1.1], jet2: [6, 10, 150, 1.3], heli: [16, 13, 300, 1.5], bomber: [80, 26, 2000, 2.4], tank: [10, 10, 500, 1.3], gun: [14, 10, 400, 1.3], parked: [4, 10, 200, 1.1] };   // hp, hit radius, points, blast
  const ART = { jet: [JET, 'jet', 1.15, 40], jet2: [JET2, 'jet2', 1.15, 40], heli: [HELI, 'heli', 1.3, 30, 12], bomber: [BOMBER, 'bomber', 1.5, 64, 18], parked: [JET, 'parked', 1.3] };   // parts, palette, scale, altitude (shadow offset), nose gun (v)
  const muzzle = f => frame(f.x, f.y, f.a, f.art[2])(0, f.art[4]), TELL = .4;   // heli, bomber guns glow TELL s before a volley
  const unit = (kind, x, y, o) => { const [hp, r, pts, size] = STATS[kind]; return foes.push(Object.assign({ kind, x, y, vx: 0, vy: 0, a: D, aim: D, hp, r, pts, size, t: 0, flash: -1, fire: .6 + Math.random(), bank: 0, odo: 0, kick: 0, n: 0, art: ART[kind], air: !/tank|gun|parked/.test(kind) }, o)); };
  // the PLAYFIELD: the map's width, or the whole screen where it is wider (the camera then rests on the map's middle)
  const span = () => { const e = Math.max(0, (W - WW) / 2); return [-e, WW + e]; };
  const air = (kind, x, sy, o) => { const [a, b] = span(); return unit(kind, a + x * (b - a) / WW, scroll + sy, o); };   // x in map units, spread across the playfield; sy from the screen's top
  // jets fly in single file on the leader's path (the 34 px gaps hold through the turn) and loop back up (turn = rad/s, a U
  // 240 / turn px wide) or dive straight; helicopters hover and aim
  const swoop = (n, x, turn, w = .7) => { for (let i = 0; i < n; i++) air('jet', x, -14 - i * 34, { sp: 120, turn, wait: w + i * 34 / 120, turned: 0 }); };
  const pincer = (n, turn) => { swoop(n, 28, -turn); swoop(n, 244, turn, 1.05); };   // each file loops in its own half, the right one a beat later
  const dive = xs => xs.forEach((x, i) => air('jet2', x, -14 - i * 26, { sp: 105, turn: 0, wait: 99, turned: 0 })), helis = xs => xs.forEach((x, i) => air('heli', x, -24 - i * 12, { hover: 60 + i % 2 * 30, stay: 5 }));
  const TIMELINE = [[3.5, () => swoop(6, 40, -2.2)], [5, () => swoop(6, 232, 2.2)], [6.5, () => helis([70, 200])], [8, () => dive([60, 212, 136, 90, 180])],   // wave 1 waits for the stage card and the first call
    [9.5, () => air('bomber', 136, -40, { drop: 'P' })], [11.5, () => pincer(5, 2.6)], [14, () => helis([50, 222])],   // the helis flank the bomber's lane
    [16.5, () => dive([40, 100, 170, 230, 70, 200])], [18.5, () => air('bomber', 90, -40, { drop: 'B' })], [21, () => pincer(6, 2.8)],
    [23.5, () => helis([80, 190, 136])], [25.5, () => air('bomber', 190, -40, { drop: 'P' })], [27.5, () => dive([50, 110, 160, 220, 136, 80, 190])]];
  const GROUND = [['tank', 131, 1250, D], ['tank', 141, 1120, -D], ['tank', 131, 960, D], ['gun', 90, 1030], ['gun', 222, 870], ['tank', 141, 820, -D], ['tank', 40, 470, 0], ['tank', 232, 650, Math.PI],
    ['tank', 131, 560, D], ['tank', 141, 420, -D], ['gun', 70, 160], ['gun', 202, 160], ['gun', 100, 340], ['gun', 172, 342], ...PARK.map(([x, y]) => ['parked', x, y, -D])];
  const CLOUDS = [[3, 96, 60], [8, 72, 48], [21, 120, 70]].map(([seed, w, h]) => {   // painted once (puffs never stack alpha), plus a shadow copy
    const c = E.mkCanvas(w, h), g = E.ctx2d(c), rnd = E.rng(seed), puffs = Array.from({ length: 16 }, () => { const a = rnd() * TAU, d = Math.sqrt(rnd()); return [w / 2 + Math.cos(a) * d * w * .3, h / 2 + Math.sin(a) * d * h * .24, h * (.3 - d * .14)]; });
    for (const [ox, oy, k, col] of [[.15, .2, 1, '#8a98bc'], [0, 0, .92, '#dde5f0'], [-.3, -.35, .5, '#ffffff']]) for (const [x, y, r] of puffs) px.disc(g, x + ox * r, y + oy * r, r * k, col);   // underside, body, sunlit tops
    const s = E.mkCanvas(w, h); tint(E.ctx2d(s), c, '#0a1420'); return { c, s, w, h };
  });
  function reset(at) {
    scroll = Math.max(0, MAP_H - H - SCROLL * at); t = at; wave = 0; while (wave < TIMELINE.length && TIMELINE[wave][0] < at) wave++;
    ship = { kind: 'player', art: [PLAYER, 'player', 1.2, 40], a: -D, x: WW / 2, y: scroll + H - 86, r: 2.5, inv: 0, respawn: 0, bank: 0, gun: 0, burst: 0 };   // no 'dead' field: E.Bullets skips those
    foes = []; items = []; craters = []; fx = []; shots = shots || new E.Bullets(game, { plane: 'ground', max: 1200 }); shots.clear();
    for (const [kind, x, y, a] of GROUND) unit(kind, x, y, { a: a ?? D, aim: a ?? D });
    clouds = [0, 1, 2, 3, 4, 5, 6].map(i => ({ x: cloudX(), y: i * 70 - 80, art: CLOUDS[i % 3], high: i > 3 }));
    lives = 2; bombs = 3; score = 0; power = 1; boss = null; won = 0; fireT = 0; warnT = 0; radio(PILOT, 'EAGLE 1', 'Fortress sighted over the valley. Weapons free!', { point: true, aim: .9, expr: 'smile' });
  }
  const cloudX = () => { const m = Math.max(0, (W - WW) / 2); return E.rand(-30 - m, WW - 60 + m); };   // across the whole screen
  const shoot = (x, y, vels, art = 'orb') => shots.burst({ x, y, z: 20, r: art === 'big' ? 3 : 2, life: 7, team: 'foe', art }, vels);
  // score pops rise 14 px on screen and blink out in .6 s
  const pop = (x, y, n, big = n >= 1000) => { score += n; P.add({ kind: 'text', x, y, vy: -24 - (scroll > 0 ? SCROLL : 0), max: .6, text: '' + n, color: big ? '#ffd040' : '#fff', scale: big ? 2 : 1 }); };
  function kill(f) {
    f.gone = true; pop(f.x, f.y - 10, f.pts); boom(f.x, f.y, f.size, { air: f.air, sound: !/jet/.test(f.kind) || Math.random() < .5 });
    if (!f.air) craters.push(crater0(f.x, f.y, f.kind === 'parked' ? 10 : 8, 5)); if (f.drop) items.push({ type: f.drop, x: f.x, y: f.y, t: 0, r: 8 });
  }
  function hitShip() {   // not while out or shielded: a hit-stop, a .4 s spin-out (see draw), then the blast
    if (ship.respawn > 0 || ship.inv > 0) return; ship.respawn = 2; lives--; power = Math.max(1, power - 1); shots.clear('foe');
    game.freeze(.06); game.after(.4, () => boom(ship.x, ship.y, 2, { air: true }));
    if (!talk.open) radio(PILOT, 'EAGLE 1', "I'm hit! Coming back around!", { expr: 'wince' }, { upright: true });   // face-on, not bowed
  }
  function bomb() {   // a carpet of blasts sweeps up the screen and scorches it
    bombs--; ship.inv = Math.max(ship.inv, 2); shots.clear('foe'); game.flash('#fff0d0', .4, .8); game.shake(5); A.sfx('boom');
    for (let i = 0; i < 9; i++) game.after(i * .06, () => { const [a, b] = span(), x = E.rand(a + 24, b - 24), y = scroll + H - 50 - i * 30; boom(x, y, 1.5, { sound: i % 4 === 0, shake: 0, freeze: false }); if (i % 2) craters.push(crater0(x, y, 6, 2)); });
    for (const f of foes) if (f.seen) f.hp -= 40; if (boss && !boss.dying) for (const p of boss.parts) if (p.hp > 0) p.hp -= 30;
  }
  // every boss attack is telegraphed: the gun charges (drawn in bossLayers), then fires
  const charge = (o, secs, fire) => { o.chg = o.chg0 = secs; o.shot = fire; };
  function bossFire(f) {   // pods: aimed fans; core: rings, then a needle spiral; wing guns: needles down their line of fire
    const [L, R, core] = f.parts, rage = L.hp <= 0 && R.hp <= 0, pat = E.pattern; f.fire = rage ? .09 : .12; f.n++;
    for (const p of [L, R]) if (p.hp > 0 && f.n % 10 === (p.s > 0 ? 6 : 1)) charge(p, .45, () => { p.kick = 1; shoot(p.x, p.y + 10, pat.spread(p.aim, 5, .5, 110)); });
    if (f.n % 18 === 1) { A.sfx('charge', { vol: .3 }); charge(core, 1, () => { game.shake(2); add({ k: 'flash', x: core.x, y: core.y, r: 14, life: .15, air: true }); shoot(core.x, core.y, pat.ring(20, 75, f.t), 'big'); }); }
    if (rage || core.hp < core.max * .6) shoot(core.x, core.y, [pat.dir(f.t * 2.2, 85), pat.dir(f.t * 2.2 + Math.PI, 85)], 'needle');
    if (f.n % 16 === 8) charge(f, .5, () => { f.kick = 1; for (const [x, y] of wingGuns(f.x, f.y, f)) shoot(x, y, [pat.dir(E.angleTo({ x, y }, ship), 130)], 'needle'); });
  }
  function bossStep(f, dt) {
    const P0 = frame(f.x, f.y, D + f.spin, 1.3 * f.scale), [L, R, core] = f.parts;
    for (const p of [L, R]) { [p.x, p.y] = P0(p.s * 46, -4); p.aim = E.approachAng(p.aim, E.angleTo(p, ship), 2 * dt); p.kick = Math.max(0, p.kick - dt * 4); }
    [core.x, core.y] = P0(0, 4); f.trail = approach(f.trail, core.hp / core.max, dt * .3); f.aim = E.approachAng(f.aim, E.angleTo(f, ship), 2 * dt);
    if (f.dying) {   // the wreck spins and shrinks (falls) in chain blasts
      const u = 1 - f.dying / 3.4; f.scale = 1 - u * .45; f.spin += dt * u * .8; f.y += 12 * dt;
      if (Math.random() < dt * 8) boom(f.x + E.rand(-50, 50) * f.scale, f.y + E.rand(-55, 55) * f.scale, E.rand(.5, 1.2), { air: true, sound: Math.random() < .35, shake: 0, freeze: false });
      game.shake(dt * 20);
      if ((f.dying -= dt) > 0) return;
      f.gone = true; boss = null; won = t; best('shooter', score); A.music('victory'); game.after(2.8, () => {   // a dip (anticipation), then the fists pump; zoomed out so they show
        const mood = { pose: 'crouch', expr: 'smile' }; radio(PILOT, 'EAGLE 1', 'Target down. Heading home!', mood, { zoom: 2.3, headY: .62 }); game.after(.2, () => mood.pose = 'cheer');
      }); game.after(7, () => game.go('title'));   // the crash
      boom(f.x, f.y, 4); for (let i = 0; i < 8; i++) game.after(i * .06, () => boom(f.x + E.rand(-45, 45), f.y + E.rand(-40, 40), 2, { sound: false, shake: 0, freeze: false }));
      add({ k: 'ring', x: f.x, y: f.y, r: 170, life: 1 }); game.flash('#fff4e0', 1.1, 1); game.shake(8); craters.push(crater0(f.x, f.y, 24, 14), crater0(f.x - 34, f.y + 18, 10, 8)); return;
    }
    f.x = WW / 2 + Math.sin(f.t * .5) * 44; f.y += (f.y - scroll < 112 ? 40 : 0) * dt;
    // damage states: a dead pod burns, a hurt hull smokes
    for (const p of [L, R]) if (p.hp <= 0 && Math.random() < dt * 10) P[Math.random() < .5 ? 'fire' : 'smoke'](p.x + E.rand(-6, 6), p.y + E.rand(-8, 8), 14, 1, { size: 3 });
    if (core.hp < core.max * .6 && Math.random() < dt * 8) P.smoke(f.x + E.rand(-30, 30), f.y + E.rand(-40, 10), 14, 1, { size: 4 });
    for (const p of f.parts) if (p.hp <= 0 && !p.done) {
      p.done = true; pop(p.x, p.y, p.pts);
      if (p.s) { game.shake(4); game.freeze(.06); for (let i = 0; i < 4; i++) game.after(i * .1, () => boom(p.x + E.rand(-10, 10), p.y + E.rand(-14, 14), 1.3, { air: true, shake: 0 })); } else { f.dying = 3.4; A.music(null); shots.clear('foe'); }
    }
    for (const o of [f, ...f.parts]) if (o.chg > 0 && (o.chg -= dt) <= 0 && !(o.hp <= 0) && ship.respawn <= 0) o.shot();   // a charge ran out: fire
    if (f.fire <= 0 && f.y - scroll > 60 && ship.respawn <= 0 && !talk.open) bossFire(f);   // no new attack under a radio call
    if (Math.abs(ship.x - f.x) < 36 && Math.abs(ship.y - f.y) < 50) hitShip();
  }

  /* ---- 7. UPDATE ---- */
  function update(dt) {
    W = game.W; H = game.H;
    const over = Math.max(0, scroll + H - MAP_H);   // a window grown taller mid-stage: keep the map's foot on the screen's bottom
    if (over) { scroll -= over; for (const o of [ship, ...items, ...shots.list, ...foes.filter(f => f.air)]) o.y -= over; }
    const inp = game.input, move = Math.min(scroll, SCROLL * dt);
    t += dt; scroll -= move;
    for (const o of [ship, ...items, ...shots.list, ...foes.filter(f => f.air)]) o.y -= move;   // flyers move with the camera
    for (const p of fx) { p.t += dt; if (p.air) p.y -= move; if (p.t < p.delay) continue; const k = Math.exp(-3 * dt); p.vx *= k; p.vy *= k; p.x += p.vx * dt; p.y += p.vy * dt; }
    E.prune(fx, p => p.t > p.delay + p.life);
    talk.update(dt);   // radio chatter (not modal)
    while (wave < TIMELINE.length && t >= TIMELINE[wave][0]) TIMELINE[wave++][1]();
    // the fortress: a warning, and HQ's call (zoomed out and turned so the raised fist stays in frame; a low camera clears the brim)
    if (scroll <= 0 && warnT === 0 && !won) { warnT = 3.4; A.music(null); radio(HQ, 'HQ', 'A flying fortress! Shoot off its gun pods first!', { point: true, aim: .6, expr: 'angry' }, { pitch: 4, zoom: 2, turn: .7 }); for (let i = 0; i < 4; i++) game.after(i * .75, () => A.sfx({ wave: 'square', freq: 'A5', to: 'D5', dur: .45, vol: .25 })); }
    if (warnT > 0 && (warnT -= dt) <= 0) {   // the boss: a core and two gun pods
      boss = { kind: 'boss', x: WW / 2, y: scroll - 90, t: 0, flash: -1, fire: 2, n: 0, aim: D, kick: 0, trail: 1, air: true, scale: 1, spin: 0, dying: 0, parts: [-1, 1, 0].map(s => ({ s, hp: s ? 90 : 380, r: s ? 15 : 30, aim: D, kick: 0, pts: s ? 5000 : 50000 })) };
      boss.parts.forEach(p => Object.assign(p, { boss, x: boss.x, y: boss.y, max: p.hp })); foes.push(boss); A.music('boss');
    }
    if (ship.respawn > 0) { if (ship.respawn > 1.6) P.fire(ship.x, ship.y, 12, 1, { size: 3 }); if ((ship.respawn -= dt) <= 0) { if (lives < 0) { best('shooter', score); game.go('over', { from: 'shooter' }); return; } Object.assign(ship, { x: WW / 2, y: scroll + H - 86, inv: 2.5, respawn: 0 }); } }
    else {
      const d = inp.drag(), mv = d ? [clamp(d[0] / (125 * dt), -1, 1), clamp(d[1] / (125 * dt), -1, 1)] : inp.move(); ship.inv -= dt; ship.gun -= dt; ship.bank = approach(ship.bank, mv[0], 5 * dt);   // a thumb steers one to one
      const [fa, fb] = span(); ship.x = clamp(ship.x + (d ? d[0] * DRAG : mv[0] * 125 * dt), fa + 10, fb - 10); ship.y = clamp(ship.y + (d ? d[1] * DRAG : mv[1] * 125 * dt), scroll + 30, scroll + H - 20);
      if (inp.pressed('fire')) ship.burst = .5;
      if ((inp.down('fire') || touch() || (ship.burst -= dt) > 0) && (fireT -= dt) <= 0) {   // more guns, a wider fan per power level; on a touch screen it fires by itself
        fireT = .07; ship.gun = .035; A.sfx('shoot', { vol: .2 });
        for (const [dx, da] of [[-5, 0], [5, 0], [-10, -.08], [10, .08], [-13, -.2], [13, .2], [-4, -.34], [4, .34]].slice(0, power * 2)) shots.fire({ x: ship.x + dx, y: ship.y - 16, z: 20, vx: Math.sin(da) * 440, vy: -Math.cos(da) * 440, r: 3, life: .9, team: 'ship' });
      }
      if (inp.pressed('bomb') && bombs > 0) bomb();
    }
    for (const f of foes) {
      f.t += dt; f.flash -= dt; f.fire -= dt; f.kick = Math.max(0, f.kick - dt * 4);
      if (f.kind === 'boss') { bossStep(f, dt); continue; }
      const sy = f.y - scroll, seen = f.seen = sy > -8 && sy < H + 8 && f.x > span()[0] - 8 && f.x < span()[1] + 8, aim = E.angleTo(f, ship);
      if (/jet/.test(f.kind)) {   // the jet rolls in a moment before the turn (anticipation), loops 218 degrees (the files peel apart), rolls out
        if (f.t > f.wait && f.turned < 3.8) { f.a += f.turn * dt; f.turned += Math.abs(f.turn) * dt; }
        f.bank = approach(f.bank, f.t > f.wait - .25 && f.turned < 3.8 ? Math.sign(f.turn) : 0, 4 * dt); f.vx = Math.cos(f.a) * f.sp; f.vy = Math.sin(f.a) * f.sp;
      }
      else if (f.kind === 'heli') { f.vy = approach(f.vy, f.t > f.stay ? 60 : sy < f.hover ? 70 : 0, 90 * dt); f.a = E.approachAng(f.a, aim, 2 * dt); }
      else if (f.kind === 'bomber') f.vy = 14;
      else if (seen && f.kind !== 'parked') {
        f.aim = E.approachAng(f.aim, aim, 1.8 * dt);
        if (f.kind === 'tank') { f.vx = Math.cos(f.a) * 18; f.vy = Math.sin(f.a) * 18; f.odo += 18 * dt; }
      }
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.fire <= 0 && seen && sy < H - 70 && t > INTRO && ship.respawn <= 0 && f.kind !== 'parked' && !won && !boss?.dying) {   // silent once the fortress falls
        if (/jet/.test(f.kind)) { f.fire = 99; for (let i = 0; i < (f.kind === 'jet2' ? 3 : 1); i++) game.after(i * .1, () => f.gone || shoot(f.x, f.y, [E.pattern.dir(E.angleTo(f, ship), 150)], 'needle')); }   // an aimed needle, or a stream of three
        else if (f.art?.[4]) {   // heli, bomber: the nose gun flashes and the craft recoils
          const heli = f.kind === 'heli', m = muzzle(f); f.fire = heli ? 1.3 : 1.1; f.kick = 1; add({ k: 'flash', x: m[0], y: m[1], r: heli ? 4 : 6, life: .1, air: true });
          shoot(m[0], m[1], heli ? (f.n++ % 2 ? E.pattern.ring(10, 80, f.t) : E.pattern.spread(aim, 5, .7, 105)) : E.pattern.spread(D + Math.sin(f.t) * .4, 9, 2.2, 80), heli ? 'orb' : 'big');
        }
        else { f.fire = f.kind === 'gun' ? 1.5 : 2.2; f.kick = 1; const m = frame(f.x, f.y, f.aim)(0, 16); add({ k: 'flash', x: m[0], y: m[1], r: 4, life: .08 }); shoot(m[0], m[1], E.pattern.spread(f.aim, f.kind === 'gun' ? 3 : 1, .25, 100)); }
      }
      if (f.air && ship.respawn <= 0 && E.overlap(f, ship)) { hitShip(); if (f.kind !== 'bomber') f.hp = 0; }
      if (sy > H + 40 || (f.air && (sy < -90 && f.t > 4 || f.x < span()[0] - 40 || f.x > span()[1] + 40))) f.gone = true;
    }
    shots.update(dt);
    const targets = foes.filter(f => f.seen).concat(boss && !boss.dying && boss.y > scroll ? boss.parts.filter(p => p.hp > 0) : []);
    shots.hit(targets, (b, f) => {   // flash, spark; boss hits land on its parts
      f.hp -= b.dmg; const o = f.boss || f; if (o.flash < -.06) o.flash = .05; P.sparks(b.x, b.y, 14, 1, -D); add({ k: 'flash', x: b.x, y: b.y - 2, r: 3, life: .06, air: true }); if (Math.random() < .15) A.sfx('hit', { vol: .15 });
    }, 'ship');
    for (const f of foes) if (f.hp <= 0 && !f.gone && f.kind !== 'boss') kill(f);
    if (ship.respawn <= 0) shots.hit([ship], hitShip, 'foe');   // the shield soaks up bullets
    for (const c of craters) {   // wrecks smoulder
      c.t += dt; if (c.t < c.burn && Math.random() < dt * 5) P.smoke(c.x, c.y, 2, 1, { size: 3 + c.r * .15 });
      if (c.t < c.burn * .6 && Math.random() < dt * (c.r > 20 ? 20 : 4)) P.fire(c.x + E.rand(-.5, .5) * c.r, c.y + E.rand(-.4, .4) * c.r, 2, 1, { size: 3, speed: 5 });
    }
    for (const it of items) {
      it.t += dt; it.y += 22 * dt; it.x += Math.sin(it.t * 2) * 30 * dt; if (it.y > scroll + H + 10) it.gone = true;
      if (ship.respawn <= 0 && E.overlap(it, { x: ship.x, y: ship.y, r: 10 })) { it.gone = true; A.sfx('powerup'); P.glints(it.x, it.y, 14, 8); if (it.type === 'P' && power < 4) power++; else if (it.type === 'B' && bombs < 5) bombs++; else score += 1000; }
    }
    E.prune(foes, f => f.gone); E.prune(items, i => i.gone); E.prune(craters, c => c.y > scroll + H + 40);
    for (const c of clouds) if ((c.y += (c.high ? 80 : 44) * (move ? 1 : .5) * dt) > H + 30) Object.assign(c, { y: -c.art.h - 20 - E.rand(0, 60), x: cloudX() });
    // live portraits: the speaker acts out its line; the pilot winces while shot down
    for (const rig of [PILOT, HQ]) rig.update(dt, { x: 0, y: 0, hurt: rig === PILOT && ship.respawn > 0, ...(talk.open && rig.mood) });
    // a screen narrower than the playfield pans with the ship, a wider one centres it; whole pixels, no lag: no shimmer
    game.focus(W / 2 + Math.round((WW - W) / 2 + (ship.x / WW - .5) * Math.max(0, WW - W)), Math.round(scroll) + H / 2, 0);
  }

  /* ---- 8. DRAW ---- */
  function craft(r, f, z, o) {   // r.actor adds outline, rim light, hit flash; a gun's kick rocks the craft back 2 px
    const [parts, pal, s, alt] = f.art || [], k = (f.kick || 0) * 2, fn = parts ? (g, x, y) => plane(g, x - Math.cos(f.a) * k, y - Math.sin(f.a) * k, f.a, f.bank, parts, PAL[pal], s) : (g, x, y) => (f.kind === 'tank' ? tank : gun)(g, x, y, f);
    // the altitude shadow (a depth cue since 1943): hull and wings as one see-through silhouette, offset along the sun
    if (alt) { const sil = f.art.sil ??= parts.filter(p => /hull|wing/.test(p[0])); r.actor(f.x + alt * SUN[0], f.y + alt * SUN[1], 4, (g, x, y) => plane(g, x, y, f.a, f.bank, sil, PAL.dead, s), { flash: '#04080e', flashMix: 1, alpha: .75, outline: false }); }
    r.actor(f.x, f.y, z, fn, o);
    if (parts && !PAL[pal].off) r.queue(f.x, f.y, z + .2, g => { for (const q of nozzles(parts, ...r.w(f.x, f.y), f.a, s)) glow(g, q[0], q[1], 3 + 3 * s, '#ff8030', .7); });
    if (f.kind === 'heli') r.queue(f.x, f.y, z + .3, g => {   // the tail rotor turns edge-on (a blade that grows and shrinks), then the main rotor
      const [x, y] = r.w(f.x, f.y), T = frame(x, y, f.a, 1.3), c = Math.cos(f.t * 37) * 3.5; px.line(g, ...T(3, -23 - c), ...T(3, -23 + c), '#9aa4ae'); rotor(g, x, y, f.t);
    });
    if (f.art?.[4] && f.fire > 0 && f.fire < TELL && t > INTRO) r.queue(f.x, f.y, z + .4, g => {   // the fire tell: like the boss guns, a glow swells and a ring closes in (bullet color)
      const u = 1 - f.fire / TELL, [x, y] = r.w(...muzzle(f)), c = f.kind === 'heli' ? '#ff4a9a' : '#ff8a30';
      glow(g, x, y, 2 + u * 6, c, u); px.blend(g, u, 'add', () => ring(g, x, y, 2 + (1 - u) * 12, 1, c));
    });
  }
  function draw(r) {
    W = r.W; H = r.H;
    map.drawFloor(r);
    const ew = edgeStep(r), [lx] = r.w(0, 0), [rx] = r.w(WW, 0);   // 2b: the valley beyond the playfield, its trees
    if (ew) { const [, ty] = r.w(0, 0); for (const [side, x] of [[0, lx - EDGE], [1, rx]]) r.ctx.drawImage(edges[side].cv, Math.round(x), Math.round(ty));
      for (const p of EDGE_PROPS) if (p.y > scroll - 4 && p.y < scroll + H + 44 && p.x > -ew - 16 && p.x < WW + ew + 16) r.prop(p.name, p.x, p.y, 0, { size: p.s, color: TINT[p.name] }); }
    r.decal(g => {   // craters; glints drifting downstream make the river flow
      for (const c of craters) crater(g, r, c);
      px.blend(g, .5, 'normal', () => { for (let i = 0; i < 30; i++) { const y = scroll - 10 + (i * 53 + game.time * 22) % (H + 20), x = RIVER(y) + (i * 29 % 21) - 10; if (river(x, y) < -4) px.rect(g, ...r.w(x, y), 2 + i % 3, 1, '#a8d4e8'); } });
    });
    for (const b of BLDS) if (b.y < scroll + H + 20 && b.y + b.d > scroll - 30) r.queue(b.x + b.w / 2, b.y + b.d, 1, g => building(g, r, b));
    for (const p of PROPS) if (p.y > scroll - 4 && p.y < scroll + H + 44) r.prop(p.name, p.x, p.y, 0, { size: p.s, color: TINT[p.name] });
    for (const p of DRESS) if (p.y > scroll - 10 && p.y < scroll + H + 50) r.shape(p.id, p.x, p.y, 0, p.o);
    for (const c of clouds) {   // two solid parallax layers under the planes, and their shadows
      const x = c.x, y = scroll + c.y;
      r.queue(x, y, 1.6, g => px.blend(g, .25, 'normal', () => g.drawImage(c.art.s, ...r.w(x + 26, y + 36).map(Math.round))));
      r.queue(x, y, c.high ? 6 : 5, g => g.drawImage(c.art.c, ...r.w(x, y).map(Math.round)));
    }
    [2.9, 3, 14].forEach((z, i) => r.queue(0, scroll, z, g => drawFx(g, r, i)));
    for (const f of foes) if (f.kind === 'boss') bossLayers(r, f); else craft(r, f, f.air ? (f.kind === 'bomber' ? 8 : 10) : 2, { flash: f.flash > 0 && '#ffffff' });
    for (const it of items) r.queue(it.x, it.y, 18, g => {   // a capsule spinning (width = cos)
      const [x, y] = r.w(it.x, it.y), w = Math.abs(Math.cos(it.t * 5)) * 6 + 1, c = E.tones(it.type === 'P' ? '#e8482e' : '#3ab04a');
      glow(g, x, y, 12, c.lt, .6); px.ell(g, x, y, w + 1, 7, '#1a0a10'); px.ell(g, x, y, w, 6, c.base); px.ell(g, x - w * .3, y - 2, w * .5, 3, c.hi);
    });
    if (ship.respawn <= 0) {   // muzzle flashes; wingtip vapor in a hard bank; a pulsing shield while invulnerable
      craft(r, ship, 12);
      r.queue(ship.x, ship.y, 12.5, g => { const [x, y] = r.w(ship.x, ship.y), vapor = Math.abs(ship.bank) - .4; if (ship.gun > 0) for (const d of [-5, 5]) { glow(g, x + d, y - 21, 8, '#ffc050'); px.rect(g, x + d - 1, y - 25, 3, 7, '#fff8d0'); }
        if (vapor > 0) for (const s of [-1, 1]) { const q = frame(x, y, -D, 1.2)(12.8 * roll(ship.bank, s), -6); px.blend(g, vapor, 'add', () => px.line(g, q[0], q[1], q[0] - ship.bank * 4, q[1] + 11, '#c8dcff')); }
        if (ship.inv > 0) px.blend(g, .5 + Math.sin(game.real * 20) * .25, 'add', () => ring(g, x, y, 22, 2, '#58b8ff')); });
    } else if (ship.respawn > 1.6) { const u = (2 - ship.respawn) / .4;   // spinning out: turns, rolls and drops (the shadow slides in), flickering red
      craft(r, { ...ship, a: u * u * 4 - D, bank: Math.sin(u * 12), art: [PLAYER, 'player', 1.2 - u * .5, 40 - u * 40] }, 12, { flash: game.real * 20 % 2 < 1 && '#ff6a40' });
    }
    r.queue(0, scroll, 20, g => bullets(g, r, 'ship'));
    r.overlay(hud); talk.draw(r); r.overlay(g => bullets(g, r, 'foe'));   // never hidden by a panel
  }

  /* ---- 9. HUD: see-through windows (E.ui.box alpha) on top, led by the pilot's live portrait. Radio chatter (Star Fox 64):
   * talk.say(line, { portrait: rig, auto, modal: false, alpha }). */
  const LIFE = E.sprite(['....w....', '...wbw...', '...www...', '.r.www.r.', 'rrrwwwrrr', 'rr.www.rr', '...w.w...', '...o.o...'], { w: '#e8e4ee', b: '#5ab0f0', r: '#c83a30', o: '#ff9a30' });
  const BOMBI = E.sprite(['.kkk.', 'kwyyk', 'kyyyk', 'krrrk', 'kyyyk', '.kyk.', 'kk.kk'], { k: '#2a1a0a', y: '#f0c040', w: '#fff8d0', r: '#d8402a' }), pad = n => String(n).padStart(7, '0');
  const PILOT = new E.Humanoid({ size: 1.3, weapon: null, hair: 'spiky', face: { eyes: 'big', bangs: .8 }, colors: { hair: '#e0a040', cloth: '#c83a30', trim: '#2f58d0', skin: '#f0c8a0' } });
  const HQ = new E.Humanoid({ size: 1.3, weapon: null, build: 'bulky', hair: 'bald', hat: { style: 'cap', color: '#4a5a3a' }, colors: { skin: '#d8a880', cloth: '#4a5a3a', trim: '#e8c060' } });
  const BLUE = ['#3a4c98', '#0a0e2a'], RED = ['#8a2a36', '#1c060c'], GOLD = '#e8c870';
  const talk = new E.Dialog(game, { lines: 2, border: GOLD });
  // radio calls: a see-through box on the bottom edge (Star Fox 64), clear of the lanes where enemies enter. The speaker's live
  // close-up acts out the line: mood is its rig.update state (a pose, expr), cam its portrait framing; the mouth moves while it types
  const radio = (rig, name, line, mood, cam) => {
    PILOT.mood = HQ.mood = null; rig.mood = mood; talk.bg = rig === HQ ? RED : BLUE;
    talk.say(line, { name, auto: 2.5, modal: false, alpha: .7, portrait: rig, portraitOpts: { zoom: 3, turn: .4, upright: false, ...cam } });
  };
  const txt = (g, s, x, y, c, o) => E.font.text(g, s, x, y, c, Object.assign({ shadow: '#05060c', outline: false }, o));
  function hud(g) {
    const mid = W / 2, win = (x, y, w, h, bg) => E.ui.box(g, x, y, w, h, { bg, border: GOLD, alpha: .8 });
    const band = (y, h, c) => { px.blend(g, .6, 'normal', () => px.rect(g, 0, y, W, h, c)); for (const yy of [y, y + h - 1]) px.rect(g, 0, yy, W, 1, GOLD); };   // see-through band, gold rules
    // pilot portrait; score, lives, bombs
    PILOT.drawPortrait(g, 4, 4, 21, { zoom: 2.2, turn: .4, upright: false, bg: ship.respawn > 0 ? RED : BLUE, border: GOLD });
    win(27, 2, 74, 25, BLUE); txt(g, '1P', 31, 5, '#ffd36a'); txt(g, pad(score), 46, 5, '#fff', { gradient: ['#ffffff', '#9ac0ff'] });
    for (let i = 0; i < lives; i++) px.sprite(g, LIFE, 31 + i * 10, 16); for (let i = 0; i < bombs; i++) px.sprite(g, BOMBI, 94 - i * 7, 17);
    // hi-score; lit power chevrons run hot
    const R = Math.min(W, cornerX());   // (clear of the corner's menu button)
    win(R - 76, 2, 74, 25, RED); txt(g, 'HI', R - 72, 5, '#ff9a7a'); txt(g, pad(Math.max(score, E.store.get('best:shooter', 0))), R - 55, 5, '#fff', { gradient: ['#ffffff', '#ffc8a0'] });
    txt(g, power < 4 ? 'POW' : 'MAX', R - 72, 17, '#ffd36a');
    for (let i = 0; i < 4; i++) { const x = R - 48 + i * 10, on = i < power; px.poly(g, [[x, 16], [x + 5, 16], [x + 9, 20], [x + 5, 24], [x, 24], [x + 4, 20]], on ? ['#ffd040', '#ffa030', '#ff6a30', '#ff3a5a'][i] : '#5a6494'); px.line(g, x + 1, 16, x + 5, 16, on ? '#fff4c0' : '#9aa4d0'); }
    if (boss) {   // a pale damage trail drains after the health
      const f = boss.parts[2].hp / boss.parts[2].max, w = Math.round(118 * f), o = Math.round(mid) - 120; win(o + 44, 30, 152, 13, RED); txt(g, 'BOSS', o + 48, 33, '#ff9a8a');
      E.ui.bar(g, o + 72, 34, 120, 6, boss.trail, '#ffe8b0', { border: '#140b12', bg: '#2a0a12' }); px.rect(g, o + 73, 35, w, 4, boss.flash > 0 ? '#ff8a90' : '#e8404a'); px.rect(g, o + 73, 35, w, 1, '#ff9aa0');
    }
    if (t < INTRO) {   // stage card above the radio call; nobody fires until it clears
      band(40, 62, '#080a1c'); E.font.title(g, 'STAGE 1', mid, 46, { align: 'center', scale: 3 });
      txt(g, 'EMERALD VALLEY', mid, 74, '#fff', { align: 'center', gradient: ['#ffffff', '#b8f0c0'] }); txt(g, (touch() ? 'DRAG to fly, AUTO-FIRE' : prompt('fire', 'shot')) + '     ' + prompt('bomb', 'bomb'), mid, 87, '#c8d0f0', { align: 'center' });   // the player's own keys
    }
    if (warnT > 0) {
      band(60, 62, '#2a0406');
      E.font.title(g, 'WARNING', mid, 75, { align: 'center', scale: 3, colors: ['#ffffff', Math.floor(warnT * 5) % 2 ? '#ff8a7a' : '#ffe0d0', '#e0202a'], depthColor: '#3a0808' }); txt(g, 'A HUGE ENEMY APPROACHES', mid, 101, '#ffd0c0', { align: 'center' });
    }
    if (won && t - won > 2.2) { win(Math.round(mid) - 108, 64, 216, 52, BLUE); E.font.title(g, 'STAGE CLEAR', mid, 70, { align: 'center', scale: 3 }); txt(g, 'SCORE  ' + pad(score), mid, 98, '#fff', { align: 'center', gradient: ['#ffffff', '#ffe08a'] }); }
  }
  return { view: 'overhead', views: ['overhead'], input: 'SHMUP', res: [240, 320], pausable: true, touch: ['fire', 'bomb'], propSize: 1,
    camera: { zoom: false },   // the playfield is the whole screen: zooming in would hide bullets and push the ship off the bottom
    enter(d) {   // the camera is shared: set it here, restore on exit
      W = game.W; H = game.H; reset((d && d.at) || 0); game.resetCamera(); Object.assign(game.cam, { bounds: null, room: null, smooth: 0 }); A.music('adventure'); L.enabled = false; if (gpu) gpu.enabled = false;
      game.input.touchSet('fire', null, false); game.input.steer = 'drag';   // a touch screen fires by itself (no button for it), a thumb anywhere steers
    },
    exit() { game.cam.smooth = .18; game.input.steer = 'stick'; }, update, draw,
    state: () => ({ ship, span: span(), score }) };   // for tests (span: the playfield's left and right ends)
})();
scenes.shooter = SHOOT;
