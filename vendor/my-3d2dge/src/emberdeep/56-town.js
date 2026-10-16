/* =============================================================================
 * EMBERHOLD, THE LAST LIT TOWN  (TOWN.build: the hand-built town that replaces the core's fallback green)
 * A walled town at dusk, 48 x 40 cells. A cobbled plaza laid in rings round the waystone and its rune circle;
 * timber and plaster houses with pitched tile roofs, glowing windows and smoking chimneys along the north and
 * west (nothing tall stands between the camera and the people); the forge yard, the market stall, the mystic's
 * tower, the tavern terrace; a low wall, lamps, a well, trees, gardens and a chicken coop along the front.
 * Its people are def('npcs', ...) with update(n, dt, rs) built on a small STEP MACHINE (walk somewhere, face
 * something, rig fields, hand targets solved with IK, held items painted from the real joints, sounds and
 * particles on cue), a GREETING layer (turn, wave, smile, a bubble, then back to work) and a TALK layer (gestures
 * while the dialog runs). Animals (Duchess the chicken, the cat) are things with Blob rigs.
 * Everything private lives in this block; TOWN.build and def('npcs', ...) are the only ways out.
 * ============================================================================= */
{
const TW = 48, TH = 40, U = 16;                                   // map size in cells, cell size in world units
const TWN_NPCS = ['harrow', 'seren', 'cobb', 'ilsa', 'pip', 'bram', 'finch'];
/* the town's own sounds (voices, not names, so nothing collides with other modules' A.define) */
const TWN_SFX = {
  hiss: [{ wave: 'noise', freq: 6000, to: 2400, dur: .9, vol: .16, filter: 'highpass' }, { wave: 'noise', freq: 1200, to: 500, dur: .35, vol: .12, filter: 'bandpass' }],
  whoosh: { wave: 'noise', freq: 800, to: 260, dur: .38, vol: .16, filter: 'lowpass' },
  squawk: [{ wave: 'square', freq: 820, to: 1500, dur: .07, vol: .1 }, { wave: 'saw', freq: 1400, to: 640, dur: .16, vol: .09, vib: [34, .12] }],
  cluck: { wave: 'square', freq: 540, to: 360, dur: .045, vol: .05 },
  meow: { wave: 'triangle', freq: 760, arp: [0, 5, 3, -4], step: .07, dur: .3, vol: .13, vib: [9, .03] },
  catHiss: { wave: 'noise', freq: 5000, to: 3000, dur: .4, vol: .13, filter: 'highpass' },
  pluck: { wave: 'triangle', freq: 'D4', to: 'D4', dur: .32, vol: .09 },
  page: { wave: 'noise', freq: 2600, to: 1100, dur: .07, vol: .05 },
  hum: { wave: 'sine', freq: 196, to: 294, dur: 1.4, vol: .07, vib: [5, .05] },
  burst: [{ wave: 'sine', freq: 520, to: 1560, dur: .5, vol: .1 }, { wave: 'triangle', freq: 1320, arp: [0, 7, 12, 19], step: .06, dur: .45, vol: .1 }],
  tink: { wave: 'square', freq: 1760, arp: [0, 7], step: .03, dur: .07, vol: .045 },
  sweep: { wave: 'noise', freq: 3200, to: 1400, dur: .16, vol: .045, filter: 'highpass' },
  giggle: { wave: 'square', freq: 740, arp: [0, 4, 0, 4, 7], step: .06, dur: .32, vol: .05 },
  yawn: { wave: 'triangle', freq: 320, to: 170, dur: .8, vol: .07, vib: [4, .06] },
  blip: { wave: 'square', freq: 620, dur: .03, vol: .05 },
  tick: { wave: 'noise', freq: 2000, dur: .03, vol: .06 },
  creak: [{ wave: 'saw', freq: 150, to: 330, dur: .42, vol: .05, vib: [26, .25] }, { wave: 'square', freq: 90, to: 120, dur: .3, vol: .03 }]
};
/** a sound from somewhere in town: quieter with distance from the hero, silent far away */
function tsfx(v, x, y, o = {}) { const h = ED.hero; if (!h) return; const k = clamp(1 - Math.hypot(h.x - x, h.y - y) / 260, 0, 1); if (k > .05) sfx(v, Object.assign({}, o, { vol: (o.vol === undefined ? 1 : o.vol) * k })); }
/* where things are (world units). The plaza's centre, the waystone on it, the forge, the stall, the tower... */
const PC = { x: 392, y: 328, r: 131 };                            // the plaza: a disc of cobbles laid in rings
const WS = { x: 392, y: 318 };                                    // the waystone (stands on its rune circle)
const MARKET = { x0: 316, y0: 142, x1: 470, y1: 230 };            // cobbles running north to the stall
const HEARTH = { x0: 112, y0: 224, x1: 144, y1: 256, h: 22 };     // the forge hearth (brick), mouth on its south face
const ANVIL = { x: 186, y: 296 }, QUENCH = { x: 150, y: 312 }, BELLOWS = { x: 158, y: 244 };
const TOWER = { x: 632, y: 88, r: 30, h: 66 };                    // Seren's round tower (drawn by hand, not TileMap)
const WELL = { x: 506, y: 392 };
const COUNTER = { x0: 352, x1: 464, y: 128 };                     // the stall counter row (cells y 8), lane behind it
/* ---------- buildings: TileMap wall blocks plus a hand-drawn pitched roof, windows, a door, a chimney ----------
 * face: which wall face has the door; ridge 'x' (gables east / west) or 'y' (gables north / south) */
const HOUSES = [
  { id: 'tavern', x0: 3, y0: 2, x1: 12, y1: 7, type: 5, roof: '#a0462e', ridge: 'x', rise: 24, chimney: [178, 58],
    door: { face: 's', at: 120, open: true }, windows: [['s', 72, 10], ['s', 168, 10], ['s', 72, 23, 1], ['s', 120, 24, 1], ['s', 168, 23, 1], ['e', 70, 12], ['e', 100, 12]] },
  { id: 'cottageA', x0: 15, y0: 2, x1: 19, y1: 6, type: 6, roof: '#4a5a80', ridge: 'x', rise: 20, chimney: [252, 50],
    door: { face: 's', at: 284 }, windows: [['s', 254, 11], ['s', 308, 11], ['e', 72, 11]] },
  { id: 'store', x0: 22, y0: 2, x1: 28, y1: 5, type: 7, roof: '#7a563a', ridge: 'x', rise: 14,
    door: { face: 's', at: 440 }, windows: [['s', 372, 12], ['e', 60, 12], ['e', 60, 26, 1]] },
  { id: 'cottageC', x0: 31, y0: 2, x1: 34, y1: 6, type: 8, roof: '#5a6e3c', ridge: 'y', rise: 22, chimney: [516, 44],
    door: { face: 's', at: 536 }, windows: [['s', 510, 11], ['e', 60, 11], ['e', 92, 11]] },
  { id: 'smithy', x0: 1, y0: 13, x1: 6, y1: 19, type: 9, roof: '#403a48', ridge: 'y', rise: 22,
    door: { face: 'e', at: 292 }, windows: [['e', 268, 12], ['s', 40, 11], ['s', 80, 11]] },
  { id: 'cottageD', x0: 1, y0: 26, x1: 6, y1: 31, type: 6, roof: '#b0602e', ridge: 'y', rise: 22, chimney: [44, 440],
    door: { face: 'e', at: 456 }, windows: [['e', 424, 11], ['e', 490, 11], ['s', 56, 11]] }
];
/* wall materials (TileMap types): face = side pattern, roof = top pattern (hidden under the pitched roofs) */
const TYPES = {
  1: { h: 20, face: 'stone', roof: 'slab', top: '#6e6878', side: '#8a8496', line: '#4a4458', course: 7 },    // the town wall (back)
  2: { h: 12, face: 'stone', roof: 'slab', top: '#6e6878', side: '#8a8496', line: '#4a4458', course: 6 },    // the town wall (front: low)
  3: { h: 30, face: 'stone', roof: 'slab', top: '#7a7486', side: '#958ea0', line: '#4a4458', course: 7 },    // gate pillars
  4: { h: 20, face: 'plank', roof: 'plain', top: '#5a3a24', side: '#6e4a2c' },                                // the gate
  5: { h: 34, face: 'timber', roof: 'tiles', top: '#6a2e20', side: '#e2d0ac', beam: '#4a2e1e' },             // tavern: tudor
  6: { h: 30, face: 'plaster', roof: 'tiles', top: '#3a4460', side: '#d4c6ae' },                              // cottage: plaster
  7: { h: 38, face: 'plank', roof: 'tiles', top: '#5a3e2a', side: '#8e6846' },                               // the store: boards
  8: { h: 30, face: 'timber', roof: 'tiles', top: '#44522c', side: '#d8c8a4', beam: '#5a3a26' },             // cottage: tudor
  9: { h: 30, face: 'stone', roof: 'tiles', top: '#3a3440', side: '#7c7482', line: '#4a4252', course: 8 },   // the smithy
  10: { h: HEARTH.h, face: 'brick', roof: 'plain', top: '#4a3a38', side: '#9a5a46', line: '#5a2a24', course: 5 },   // the forge hearth
  11: { h: 9, face: 'none', roof: 'plain', top: '#b8885a', side: '#8a5a36' }                                 // the stall counter (boards painted by the stall)
};
/* ---------- the map: cells (walls) and floor kinds, built once and kept (the floor bakes once per view) ---------- */
const K = { GRASS: 0, COBBLE: 1, PATH: 2, DECK: 3, YARD: 4, RUG: 5, SOIL: 6, BASE: 7 };   // floor kinds
/** dirt paths: polylines (world units) with a width; the floor reads a distance field baked from them */
const PATHS = [
  [[392, 640], [392, 560], [396, 450]], [[300, 290], [226, 226], [150, 196], [110, 190]], [[284, 116], [292, 150], [322, 196]],
  [[536, 116], [520, 160], [462, 214]], [[478, 262], [560, 206], [636, 190]], [[264, 336], [214, 312], [170, 300]],
  [[270, 392], [190, 440], [118, 458]], [[522, 342], [612, 360], [664, 420], [668, 500]], [[470, 430], [530, 500], [572, 548]],
  [[392, 460], [300, 520], [230, 560]]
].map((p, i) => ({ p, w: [34, 28, 22, 22, 26, 30, 24, 24, 20, 20][i] }));
const RUGS = [{ x0: 596, y0: 130, x1: 676, y1: 184, c: '#7a2a4a', b: '#d8a848', m: '#2e3a74' }];
const DECK = { x0: 48, y0: 128, x1: 208, y1: 186 }, YARD = { x0: 112, y0: 212, x1: 246, y1: 350 }, SOIL = { x0: 146, y0: 522, x1: 238, y1: 590 };
let MAP = null;   // { cells, tags, blocked, kind, pathD, map, flow } built on the first visit
function buildMap() {
  const cells = new Array(TW * TH).fill(0), tags = new Array(TW * TH).fill(null), blocked = new Uint8Array(TW * TH), kind = new Uint8Array(TW * TH);
  const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < TW && y < TH) cells[y * TW + x] = v; };
  for (let x = 0; x < TW; x++) { set(x, 0, 1); set(x, TH - 1, 2); }
  for (let y = 0; y < TH; y++) { set(0, y, 1); set(TW - 1, y, 2); }
  set(0, TH - 1, 1); set(TW - 1, 0, 1);
  for (const x of [22, 26]) set(x, TH - 1, 3);
  for (let x = 23; x <= 25; x++) set(x, TH - 1, 4);
  for (const Hs of HOUSES) for (let y = Hs.y0; y <= Hs.y1; y++) for (let x = Hs.x0; x <= Hs.x1; x++) set(x, y, Hs.type);
  for (let y = HEARTH.y0 / U; y < HEARTH.y1 / U; y++) for (let x = HEARTH.x0 / U; x < HEARTH.x1 / U; x++) set(x, y, 10);
  for (let x = COUNTER.x0 / U; x < COUNTER.x1 / U; x++) set(x, COUNTER.y / U, 11);
  // floor kinds per cell (rects); the plaza and the paths are resolved per pixel
  const rect = (R0, k) => { for (let y = Math.floor(R0.y0 / U); y < Math.ceil(R0.y1 / U); y++) for (let x = Math.floor(R0.x0 / U); x < Math.ceil(R0.x1 / U); x++) if (x >= 0 && y >= 0 && x < TW && y < TH) kind[y * TW + x] = k; };
  rect(DECK, K.DECK); rect(YARD, K.YARD); rect(SOIL, K.SOIL); for (const R0 of RUGS) rect(R0, K.RUG);
  for (let y = Math.floor(SOIL.y0 / U); y < Math.ceil(SOIL.y1 / U); y++) for (let x = Math.floor(SOIL.x0 / U); x < Math.ceil(SOIL.x1 / U); x++) blocked[y * TW + x] = 1;   // the fenced garden
  // the tower's footprint: blocked floor under a hand-drawn stone drum
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) { const d = Math.hypot((x + .5) * U - TOWER.x, (y + .5) * U - TOWER.y); if (d < TOWER.r + 6) { blocked[y * TW + x] = 1; tags[y * TW + x] = 'tower'; } if (d < TOWER.r + 14) kind[y * TW + x] = K.BASE; }
  // the path distance field (1 world unit per sample): distance to the nearest centre line minus half the width
  const MW = TW * U, MH = TH * U, pathD = new Float32Array(MW * MH).fill(99);
  for (const { p, w } of PATHS) for (let s = 0; s + 1 < p.length; s++) {
    const [ax, ay] = p[s], [bx, by] = p[s + 1], vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy, m = w / 2 + 12;
    for (let y = Math.max(0, Math.floor(Math.min(ay, by) - m)); y < Math.min(MH, Math.ceil(Math.max(ay, by) + m)); y++)
      for (let x = Math.max(0, Math.floor(Math.min(ax, bx) - m)); x < Math.min(MW, Math.ceil(Math.max(ax, bx) + m)); x++) {
        const t = clamp(((x - ax) * vx + (y - ay) * vy) / L2, 0, 1), d = Math.hypot(x - ax - vx * t, y - ay - vy * t) - w / 2, k = y * MW + x;
        if (d < pathD[k]) pathD[k] = d;
      }
  }
  const map = new E.TileMap({ w: TW, h: TH, tile: U, cells, types: TYPES, floorTex: (x, y, tag) => floorTex(x, y, tag) });
  map.floorTags = tags; map.blocked = blocked;
  MAP = { cells, tags, blocked, kind, pathD, map, MW };
  MAP.flow = new E.FlowField(map);
  return MAP;
}

/* ---------- the floor: one function per pixel, baked once per view. Crafted, not noisy: big soft patches,
 * cobbles in rings with a lit rim, dirt with pebbles and ragged grassy edges, planks, a rug, soot, soil rows ---------- */
const rgb = h => E.hex(h), mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const FC = {
  grass: ['#34603c', '#3f6e42', '#4a7c48', '#5a8c50', '#6c9c58'].map(rgb), flowers: ['#e8d070', '#d87aa0', '#eef0f4', '#a890e0'].map(rgb),
  stone: ['#7e7688', '#8a8292', '#766e80', '#948c9c', '#847a8a'].map(rgb), mortar: rgb('#443e4c'), stoneLt: rgb('#aaa2b4'), stoneSh: rgb('#5e566a'), moss: rgb('#4e6e44'),
  dirt: ['#6c5238', '#7e6044', '#8e6e4c', '#a0805a'].map(rgb), pebble: rgb('#b49a74'), pebbleSh: rgb('#5a4430'),
  plank: ['#8e5e38', '#7e5230', '#9a6a40'].map(rgb), plankLine: rgb('#3e2618'), nail: rgb('#c8b89a'),
  yard: ['#6a5a4c', '#5c4e44', '#76665a', '#4e423c'].map(rgb), soot: rgb('#3a3032'), ash: rgb('#8a7e74'), ember: [255, 140, 60, .9],
  soil: ['#4e3628', '#3a281e', '#5e4432'].map(rgb), sprout: ['#5a8a3e', '#7aa84e'].map(rgb),
  base: ['#6a6474', '#5a5464', '#7a7484'].map(rgb), rune: [47, 127, 130, .5], runeHi: [111, 214, 204, 1], runeDim: [60, 100, 110, .25]
};
const nz = (x, y) => E.noise2(x, y), hs = (x, y) => E.hash2(x, y);
function grassAt(x, y) {
  // soft patches at two scales, then sparse blade marks and rare flower clusters (no single-pixel static)
  const n = nz(x * .045, y * .045) * .6 + nz(x * .13, y * .13) * .4, G = FC.grass;
  const row = Math.floor(y / 5), X = x + (row & 1) * 3, k = hs(Math.floor(X / 7), row), lx = X - Math.floor(X / 7) * 7, ly = y - row * 5;
  if (k < .1 && ly > 2.6 && Math.abs(lx - 3.5) < .6) return n > .5 ? G[3] : G[4];              // a lit blade
  if (k < .1 && ly > 3.4 && Math.abs(lx - 3.5) < 1.6) return G[0];                            // its shadow at the root
  const fl = nz(x * .09 + 30, y * .09 + 30);
  if (fl > .78 && k > .93 && ly > 2 && lx > 2 && lx < 5) return FC.flowers[Math.floor(hs(row, 7) * 4)];
  return n < .3 ? G[1] : n < .72 ? G[2] : G[3];
}
function cobbleAt(x, y) {
  // stones laid in rings round the plaza centre, each ring offset: a bevel lit from the camera side, mortar gaps, moss
  const dx = x - PC.x, dy = y - PC.y, d = Math.hypot(dx, dy), ring = Math.floor(d / 6.2), th = Math.atan2(dy, dx) / TAU + .5, n = Math.max(6, Math.round(TAU * (ring + .5) * 6.2 / 7.2));
  const a = d / 6.2 - ring, q = th * n + hs(ring, 3) * 3, j = Math.floor(q), b = q - j, ka = ring, kb = j % n, sa = 6.2, sb = TAU * (ring + .5) * 6.2 / n;
  const ux = dx / (d || 1), uy = dy / (d || 1), dxw = ux * (a - .5) * sa - uy * (b - .5) * sb, dyw = uy * (a - .5) * sa + ux * (b - .5) * sb;
  if (a < .13 || b * sb < .9) return hs(ka * 7 + kb, 11) < .12 ? FC.moss : FC.mortar;
  const lit = -(dxw + dyw) * .707, h = hs(ka * 31 + kb, ka);
  if (lit > Math.min(sa, sb) * .3) return FC.stoneLt;
  if (lit < -Math.min(sa, sb) * .33) return FC.stoneSh;
  const c = FC.stone[Math.floor(h * 5)];
  return hs(Math.floor(x * 1.7), Math.floor(y * 1.7)) < .04 ? FC.stoneSh : c;
}
function dirtAt(x, y, edge) {
  const n = nz(x * .07, y * .07) * .7 + nz(x * .21, y * .21) * .3, D = FC.dirt, pb = nz(x * .5 + 9, y * .5 + 3);
  if (pb > .82) return nz(x * .5 + 9, (y - 1) * .5 + 3) > .82 ? FC.pebbleSh : FC.pebble;
  let c = n < .3 ? D[0] : n < .55 ? D[1] : n < .78 ? D[2] : D[3];
  if (edge > -3) c = mixc(c, FC.grass[1], clamp((edge + 3) / 5, 0, .6));   // grass creeps over the verge
  return c;
}
function runeAt(x, y) {
  // the waystone's rune circle: two rings, sixteen spokes, glyph dashes between them (4th value = GPU glow)
  const dx = x - WS.x, dy = y - WS.y, d = Math.hypot(dx, dy), R0 = 44;
  if (d > R0 + 1.5) return null;
  if (Math.abs(d - R0) < .9 || Math.abs(d - R0 * .78) < .7) return FC.rune;
  if (d > R0 * .78 && d < R0) { const a = (Math.atan2(dy, dx) / TAU + 1) * 16; if (a % 1 < .04) return FC.rune; if (Math.abs(d - R0 * .89) < 2 && hs(Math.floor(a * 3), Math.floor(d * .5)) > .35 && ((Math.floor(x) + Math.floor(y)) & 1)) return FC.runeHi; }
  if (Math.abs(d - R0 * .42) < .6) return FC.runeDim;
  return null;
}
function rugAt(x, y, R0) {
  const u = x - R0.x0, v = y - R0.y0, w = R0.x1 - R0.x0, h = R0.y1 - R0.y0, e = Math.min(u, v, w - u, h - v);
  const P = R0._p || (R0._p = { c: rgb(R0.c), cs: rgb(E.shade(R0.c, -.25)), b: rgb(R0.b), bs: rgb(E.shade(R0.b, -.3)), m: rgb(R0.m), f: rgb('#e8d8b0') });
  if ((u < 2.5 || w - u < 2.5) && Math.floor(v) % 2 === 0) return P.f;                          // fringe
  if (u < 2.5 || w - u < 2.5) return null;
  if (e < 3.5) return e < 1.2 ? P.bs : P.b;                                                     // border
  if (e < 5) return P.cs;
  const cu = Math.abs(u - w / 2), cv = Math.abs(v - h / 2), dm = cu / (w / 2 - 5) + cv / (h / 2 - 5);   // a diamond medallion
  if (Math.abs(dm - .62) < .06 || dm < .18) return P.b;
  if (dm < .56 && ((Math.floor(u / 3) + Math.floor(v / 3)) & 1)) return P.m;
  return (Math.floor(u) + Math.floor(v * 2)) % 7 === 0 ? P.cs : P.c;
}
function floorTex(x, y, tag) {
  const M = MAP, cx = Math.floor(x / U), cy = Math.floor(y / U), kd = M.kind[cy * TW + cx];
  if (kd === K.RUG) for (const R0 of RUGS) if (x >= R0.x0 && x < R0.x1 && y >= R0.y0 && y < R0.y1) { const c = rugAt(x, y, R0); if (c) return c; }
  if (kd === K.DECK && x >= DECK.x0 && x < DECK.x1 && y >= DECK.y0 && y < DECK.y1) {   // the tavern terrace: boards running east-west
    const row = Math.floor((y - DECK.y0) / 5.5), ly = y - DECK.y0 - row * 5.5, len = 26 + Math.floor(hs(row, 3) * 20), j = (x + row * 13) % len;
    if (ly < .9 || j < .9) return FC.plankLine;
    if (Math.abs(j - 2) < .6 && Math.abs(ly - 2.7) < .6) return FC.nail;
    return FC.plank[Math.floor(hs(Math.floor((x + row * 13) / len), row) * 3)];
  }
  if (kd === K.BASE) {   // the tower's plinth: big dressed stones in a ring
    const d = Math.hypot(x - TOWER.x, y - TOWER.y);
    if (d < TOWER.r + 12) { const ring = Math.floor((d - TOWER.r) / 6), a = Math.floor((Math.atan2(y - TOWER.y, x - TOWER.x) / TAU + .5) * (24 + ring * 4)); const f = (d - TOWER.r) / 6 - ring; return f < .15 ? FC.mortar : FC.base[Math.floor(hs(a, ring) * 3)]; }
  }
  // the plaza and the market front: cobbles (the edge wanders; stones go missing near it)
  const dx = x - PC.x, dy = y - PC.y, d = Math.hypot(dx, dy), wob = (nz(x * .05, y * .05) - .5) * 16;
  const inM = x > MARKET.x0 + wob * .5 && x < MARKET.x1 - wob * .5 && y > MARKET.y0 && y < MARKET.y1;
  if (d < PC.r + wob || inM) {
    const edge = inM ? 99 : PC.r + wob - d;
    if (!inM && edge < 5 && hs(Math.floor(x / 6), Math.floor(y / 6)) < .45 - edge * .08) return dirtAt(x, y, -9);
    const r = d < 60 ? runeAt(x, y) : null; if (r) return r;
    return cobbleAt(x, y);
  }
  if (kd === K.YARD) {   // the forge yard: packed dark earth, soot and ash, a cold ember or two
    const n = nz(x * .06, y * .06) * .7 + nz(x * .2, y * .2) * .3, e = Math.min(x - YARD.x0, YARD.x1 - x, y - YARD.y0, YARD.y1 - y) + (nz(x * .1, y * .1) - .5) * 14;
    if (e > 0) {
      const dh = Math.hypot(x - (HEARTH.x0 + HEARTH.x1) / 2, y - HEARTH.y1), soot = nz(x * .11 + 5, y * .11) - dh / 90;   // soot and cinders thicken toward the hearth
      if (soot > .35 && hs(Math.floor(x), Math.floor(y)) < .012) return FC.ember;
      if (soot > .3) return soot > .42 ? FC.soot : FC.yard[3];
      if (nz(x * .45, y * .45) > .82) return FC.ash;
      return n < .32 ? FC.yard[1] : n < .7 ? FC.yard[0] : FC.yard[2];
    }
  }
  if (kd === K.SOIL) {   // garden rows: furrows running east-west, sprouts on the ridges
    const f = ((y - SOIL.y0) / 7) % 1, e = Math.min(x - SOIL.x0, SOIL.x1 - x, y - SOIL.y0, SOIL.y1 - y);
    if (e > 0) { if (f > .35 && f < .55 && hs(Math.floor(x / 5), Math.floor(y / 7)) > .5 && Math.abs(x % 5 - 2.5) < 1) return FC.sprout[f < .45 ? 1 : 0]; return f < .3 ? FC.soil[1] : f > .7 ? FC.soil[2] : FC.soil[0]; }
  }
  const pd = M.pathD[Math.floor(y) * M.MW + Math.floor(x)] + (nz(x * .09, y * .09) - .5) * 7;
  if (pd < 0) return dirtAt(x, y, pd);
  return grassAt(x, y);
}

/* ---------- 3D paint helpers (world points through r.w, so they work in every view and at every zoom) ---------- */
const W3 = (r, p) => r.w(p[0], p[1], p[2]);
const quad = (r, g, pts, c) => px.poly(g, pts.map(p => W3(r, p)), c);
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const line3 = (r, g, a, b, c, w = 1) => { const A = W3(r, a), B = W3(r, b); px.line(g, A[0], A[1], B[0], B[1], c, w); };
const zw = r => Math.max(1, Math.round(r.view.zoom || 1));
/** light a glowing thing at height: a light on the ground point its screen position covers (so it reads bright under the
 *  lighting pass without being emissive: emissive items are redrawn over everything, even people standing in front) */
function glowAt(r, x, y, z, rad, k, color) { const [sx, sy] = r.w(x, y, z), q = r.view.toGround(sx + r.ix, sy + r.iy); if (q) L.add(q[0], q[1], 0, rad, k, { color }); else L.add(x, y, z, rad, k, { color }); }
/** does a face with outward ground normal (nx, ny) face the camera? (vertical faces; roofs add their tilt) */
const faces = (r, nx, ny) => nx * r.view.fx + ny * r.view.fy > .02;
/** bake a static painting into a canvas per view (like the TileMap's wall blocks): o = { pts: [[x, y, z]...], paint(g) } */
function baked(o, r) {
  const v = r.view, key = v.id + ':' + v.yawDeg + ':' + v.pitchDeg + ':' + v.scale;
  if (o._bk && o._bk.key === key) return o._bk;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of o.pts) { const q = v.p(p[0], p[1], p[2]); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
  x0 = Math.floor(x0) - 4; y0 = Math.floor(y0) - 4;
  const cv = E.mkCanvas(Math.max(1, Math.ceil(x1) - x0 + 8), Math.max(1, Math.ceil(y1) - y0 + 8)), cg = E.ctx2d(cv), sx = r.ix, sy = r.iy;
  r.ix = x0; r.iy = y0; try { o.paint(cg, r); } finally { r.ix = sx; r.iy = sy; }
  return (o._bk = { key, cv, x0, y0 });
}
const drawBaked = (o, r, g) => { if (g._info) { o.paint(g, r); return; } const b = baked(o, r); g.drawImage(b.cv, b.x0 - r.ix, b.y0 - r.iy); };

/* ---------- a house: pitched roof (two planes of shingle rows, a ridge cap, eaves), gables, a chimney ---------- */
function houseParts(Hs) {
  const T0 = TYPES[Hs.type], X0 = Hs.x0 * U, X1 = (Hs.x1 + 1) * U, Y0 = Hs.y0 * U, Y1 = (Hs.y1 + 1) * U, h = T0.h, rz = h + Hs.rise, e = 5, g = 3;
  const X = Hs.ridge === 'x', half = X ? (Y1 - Y0) / 2 : (X1 - X0) / 2, zE = h - Hs.rise * e / half, m = X ? (Y0 + Y1) / 2 : (X0 + X1) / 2;
  Object.assign(Hs, { X0, X1, Y0, Y1, h, rz, m });
  // planes: [eave a, eave b, ridge b, ridge a] and the outward ground normal; gables: triangles on the end walls
  Hs.planes = X ? [{ n: [0, -1], q: [[X0 - g, Y0 - e, zE], [X1 + g, Y0 - e, zE], [X1 + g, m, rz], [X0 - g, m, rz]] }, { n: [0, 1], q: [[X0 - g, Y1 + e, zE], [X1 + g, Y1 + e, zE], [X1 + g, m, rz], [X0 - g, m, rz]] }]
    : [{ n: [-1, 0], q: [[X0 - e, Y0 - g, zE], [X0 - e, Y1 + g, zE], [m, Y1 + g, rz], [m, Y0 - g, rz]] }, { n: [1, 0], q: [[X1 + e, Y0 - g, zE], [X1 + e, Y1 + g, zE], [m, Y1 + g, rz], [m, Y0 - g, rz]] }];
  Hs.gables = X ? [{ n: [-1, 0], t: [[X0, Y1, h], [X0, Y0, h], [X0, m, rz]] }, { n: [1, 0], t: [[X1, Y0, h], [X1, Y1, h], [X1, m, rz]] }]
    : [{ n: [0, -1], t: [[X0, Y0, h], [X1, Y0, h], [m, Y0, rz]] }, { n: [0, 1], t: [[X1, Y1, h], [X0, Y1, h], [m, Y1, rz]] }];
  const ch = Hs.chimney; Hs.chim = ch ? { x: ch[0], y: ch[1], z0: h, z1: rz + 10 } : null;
  Hs.pts = Hs.planes.flatMap(p => p.q).concat(Hs.gables.flatMap(q => q.t)); if (Hs.chim) Hs.pts.push([ch[0] - 5, ch[1] - 5, rz + 13], [ch[0] + 5, ch[1] + 5, rz + 13], [ch[0], ch[1], h]);
  Hs.smoke = [];
  Hs.paint = (gg, r) => paintRoof(gg, r, Hs);
}
function paintRoof(g, r, Hs) {
  const T0 = TYPES[Hs.type], rt = E.tones(Hs.roof), zm = zw(r);
  const far = Hs.planes.filter(p => !faces(r, p.n[0], p.n[1])), near = Hs.planes.filter(p => faces(r, p.n[0], p.n[1]));
  const plane = (P, lit) => {
    const [A, B, C, D] = P.q, base = lit ? rt.base : rt.sh, dark = lit ? rt.sh : rt.deep, light = lit ? rt.lt : rt.base;
    quad(r, g, P.q, base);
    const len = Math.hypot(D[0] - A[0], D[1] - A[1], D[2] - A[2]), rows = Math.max(3, Math.round(len / 3.6)), span = Math.hypot(B[0] - A[0], B[1] - A[1]), cols = Math.max(2, Math.round(span / 6));
    for (let k = 0; k < rows; k++) {
      const v0 = k / rows, v1 = (k + 1) / rows, a0 = lerp3(A, D, v0), b0 = lerp3(B, C, v0), a1 = lerp3(A, D, v1), b1 = lerp3(B, C, v1);
      for (let j = 0; j < cols; j++) {   // a few shingles in each row step out lighter or darker (hand-laid, not printed)
        const hsj = hs(j * 7 + k * 13 + Hs.x0, k), u0 = (j + (k & 1) * .5) / cols, u1 = Math.min(1, u0 + 1 / cols);
        if (hsj < .16 || hsj > .9) quad(r, g, [lerp3(a0, b0, u0), lerp3(a0, b0, u1), lerp3(a1, b1, u1), lerp3(a1, b1, u0)], hsj < .16 ? dark : light);
        const jt = lerp3(a0, b0, u0), jb = lerp3(a1, b1, u0); line3(r, g, jt, lerp3(jt, jb, .75), dark);
      }
      line3(r, g, a0, b0, rt.deep, zm);                                                   // the shadow under each row's lip
      line3(r, g, lerp3(a0, a1, .25), lerp3(b0, b1, .25), light);                         // and the lit lip itself
    }
    line3(r, g, A, B, rt.deep, zm + 1);                                                   // eave edge
    for (const [p0, p1] of [[A, D], [B, C]]) line3(r, g, p0, p1, lit ? rt.lt : rt.base, zm);   // verge boards
  };
  const gable = G => {   // the end wall under the roof: the house's own material, beams on timber houses, boards or courses on the rest
    const wt = E.tones(T0.side), bt = E.tones(T0.beam || '#4a3222'), [A, B, C] = G.t, lit = G.n[0] + G.n[1] > 0;
    quad(r, g, G.t, lit ? wt.base : wt.sh);
    if (T0.face === 'timber') { line3(r, g, A, B, bt.sh, zm + 1); line3(r, g, lerp3(A, B, .5), C, bt.sh, zm + 1); line3(r, g, lerp3(A, B, .15), lerp3(lerp3(A, B, .5), C, .55), bt.base, zm); line3(r, g, lerp3(A, B, .85), lerp3(lerp3(A, B, .5), C, .55), bt.base, zm); }
    else if (T0.face === 'plank') { for (let k = 1; k < 8; k++) { const u = k / 8; line3(r, g, lerp3(A, B, u), lerp3(lerp3(A, B, u), C, Math.min(u, 1 - u) * 2), wt.sh); } }
    else if (T0.face === 'stone') { for (let k = 1; k < 4; k++) { const u = k / 4; line3(r, g, lerp3(A, C, u), lerp3(B, C, u), wt.sh); } }
    line3(r, g, A, B, wt.deep);
  };
  for (const P of far) plane(P, false);
  for (const G of Hs.gables) if (faces(r, G.n[0], G.n[1])) gable(G);
  for (const P of near) plane(P, true);
  // ridge cap: a rounded row of lighter tiles along the top
  const RA = Hs.planes[0].q[3], RB = Hs.planes[0].q[2]; line3(r, g, [RA[0], RA[1], RA[2] + 1], [RB[0], RB[1], RB[2] + 1], rt.base, zm + 2); line3(r, g, [RA[0], RA[1], RA[2] + 2], [RB[0], RB[1], RB[2] + 2], rt.hi, zm);
  // the chimney: brick stack, a stone cap, the dark flue
  const c = Hs.chim; if (c) {
    r.box(g, c.x - 4, c.y - 4, c.z0, c.x + 4, c.y + 4, c.z1, '#6a3a34', '#9a5646');
    for (let z = c.z1 - 3; z > Hs.rz - 12; z -= 3) { const s = (z / 3) & 1 ? 1.5 : -1.5; line3(r, g, [c.x - 4, c.y + 4.1, z], [c.x + 4, c.y + 4.1, z], '#6a3430'); line3(r, g, [c.x + s, c.y + 4.1, z], [c.x + s, c.y + 4.1, z + 3], '#6a3430'); }
    r.box(g, c.x - 5, c.y - 5, c.z1, c.x + 5, c.y + 5, c.z1 + 2.5, '#9a94a4', '#6a6474'); r.box(g, c.x - 2.5, c.y - 2.5, c.z1 + 2.5, c.x + 2.5, c.y + 2.5, c.z1 + 2.8, '#1a1016', '#1a1016');
  }
}
/** chimney smoke: soft lilac puffs that swell, drift with the evening breeze and fade, drawn right after the roof */
function stepSmoke(Hs, dt, rate = 1) {
  const c = Hs.chim; if (!c) return; const S = Hs.smoke;
  if (Math.random() < dt * 3.2 * rate && S.length < 18) S.push({ x: c.x, y: c.y, z: c.z1 + 3, t: 0, max: 2.6 + Math.random() * 1.4, s: 1.6 + Math.random() * .8, vx: 5 + Math.random() * 3, vy: -3 - Math.random() * 2, k: Math.random() });
  for (let i = S.length - 1; i >= 0; i--) { const p = S[i]; p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += (11 - p.t * 2) * dt; p.vx += dt * 2; if (p.t > p.max) S.splice(i, 1); }
}
function drawSmoke(g, r, S, dark = '#5a5068', mid = '#8a8098', hi = '#b4aac0') {
  const s = r.view.scale;
  for (const p of S) {
    const u = p.t / p.max, [x, y] = r.w(p.x, p.y, p.z), R = (p.s + u * 4.5) * s * .8, a = u < .12 ? u / .12 : 1 - (u - .12) / .88;
    px.blend(g, a * .75, 'normal', () => { px.disc(g, x, y, R, dark); px.disc(g, x - R * .2, y - R * .25, R * .75, mid); px.disc(g, x - R * .38, y - R * .45, R * .36, hi); });
  }
}

/* ---------- windows and doors, painted on the wall planes ---------- */
/** a point on a house face: face 's' | 'e' | 'n' | 'w', u = world x (s / n) or y (e / w), z; out = offset off the wall */
function onFace(Hs, f, u, z, out = .3) { return f === 's' ? [u, Hs.Y1 + out, z] : f === 'n' ? [u, Hs.Y0 - out, z] : f === 'e' ? [Hs.X1 + out, u, z] : [Hs.X0 - out, u, z]; }
const FN = { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0] };
/** corners of a rectangle on a face: du along the face, z0..z1 */
function faceRect(Hs, f, u, du, z0, z1, out) { return [onFace(Hs, f, u - du, z0, out), onFace(Hs, f, u + du, z0, out), onFace(Hs, f, u + du, z1, out), onFace(Hs, f, u - du, z1, out)]; }
function drawWindow(r, Hs, W0, t) {
  const [f, u, z0, small] = W0, n = FN[f]; if (!faces(r, n[0], n[1])) return;
  const hw = small ? 3.5 : 4.5, hh = small ? 7 : 9, T0 = TYPES[Hs.type], p = onFace(Hs, f, u, z0 + hh / 2, 1);
  if (!r.visible(p[0], p[1], p[2], 30, 30, 30)) return;
  const shut = E.tones(Hs.shutter || (Hs.type === 6 ? '#3a5a7a' : Hs.type === 9 ? '#4a3a30' : '#5a7a3a'));
  r.queue(p[0], p[1], 0, g => {   // frame, shutters and sill (lit by the scene)
    const bt = E.tones(T0.beam || '#4a3222');
    quad(r, g, faceRect(Hs, f, u, hw + 1.2, z0 - 1.2, z0 + hh + 1.2, .4), bt.sh);
    if (!small) for (const s of [-1, 1]) { quad(r, g, faceRect(Hs, f, u + s * (hw + 3.4), 2.1, z0 - .4, z0 + hh + .4, .5), shut.base); line3(r, g, onFace(Hs, f, u + s * (hw + 3.4), z0 + 1, .6), onFace(Hs, f, u + s * (hw + 3.4), z0 + hh - 1, .6), shut.sh); }
    quad(r, g, faceRect(Hs, f, u, hw + 2, z0 - 2.2, z0 - 1, .8), bt.lt);
    if (!small && Hs.flowers) for (let k = -2; k <= 2; k++) { const q = W3(r, onFace(Hs, f, u + k * 2, z0 - .2, 1.6)); px.dot(g, q[0], q[1] - 1, k & 1 ? '#e87aa0' : '#f0d060'); px.dot(g, q[0], q[1], '#4a7a3a'); }
  }, { bias: .002 });
  r.queue(p[0], p[1], 0, g => {   // the glass: warm light from inside (a glow light keeps it bright; never emissive), mullions, a flicker
    const fl = .5 + .5 * Math.sin(t * 3.1 + u * .7) * Math.sin(t * 1.7 + z0);
    quad(r, g, faceRect(Hs, f, u, hw, z0, z0 + hh, .5), fl > .7 ? '#ffd88a' : '#f8c46a');
    quad(r, g, faceRect(Hs, f, u, hw * .55, z0 + hh * .2, z0 + hh * .8, .55), '#fff0c0');
    quad(r, g, faceRect(Hs, f, u, hw, z0, z0 + hh * .18, .56), '#e0963e');
    const bt = E.tones(T0.beam || '#4a3222').deep;
    line3(r, g, onFace(Hs, f, u, z0, .6), onFace(Hs, f, u, z0 + hh, .6), bt); line3(r, g, onFace(Hs, f, u - hw, z0 + hh * .55, .6), onFace(Hs, f, u + hw, z0 + hh * .55, .6), bt);
  }, { bias: .003 });
  const gp = onFace(Hs, f, u, z0 + hh / 2, 1), sp = onFace(Hs, f, u, 0, 10), fl = .9 + .1 * Math.sin(t * 3.1 + u);
  glowAt(r, gp[0], gp[1], gp[2], small ? 10 : 12, .8 * fl, '#ffc070'); L.add(sp[0], sp[1], 0, small ? 20 : 30, .3 * fl, { color: '#ffa850' });
}
function drawDoor(r, Hs, t) {
  const D = Hs.door, f = D.face, n = FN[f]; if (!faces(r, n[0], n[1])) return;
  const u = D.at, p = onFace(Hs, f, u, 10, 1); if (!r.visible(p[0], p[1], p[2], 40, 40, 40)) return;
  const wood = E.tones(Hs.doorColor || '#6a4226'), hw = 5.5, top = 19;
  r.queue(p[0], p[1], 0, g => {
    quad(r, g, faceRect(Hs, f, u, hw + 1.6, 0, top + 1.6, .3), '#3a2a24');   // stone surround
    line3(r, g, onFace(Hs, f, u - hw - 1.6, top + 1.6, .4), onFace(Hs, f, u + hw + 1.6, top + 1.6, .4), '#8a8290', zw(r));
    if (D.open) {   // an open doorway: warm light inside, the leaf swung in against the jamb
      quad(r, g, faceRect(Hs, f, u, hw, 0, top, .35), '#2a140c');
      const a = onFace(Hs, f, u + hw, 0, .4), b = onFace(Hs, f, u + hw, top, .4);
      quad(r, g, [a, [a[0] - n[0] * 7, a[1] - n[1] * 7, 0], [b[0] - n[0] * 7, b[1] - n[1] * 7, top], b], wood.sh);
    } else {
      quad(r, g, faceRect(Hs, f, u, hw, 0, top, .35), wood.base);
      for (let k = -1; k <= 1; k++) line3(r, g, onFace(Hs, f, u + k * 2.8, .5, .45), onFace(Hs, f, u + k * 2.8, top - .5, .45), wood.sh);
      for (const z of [4, top - 4]) line3(r, g, onFace(Hs, f, u - hw, z, .5), onFace(Hs, f, u + hw, z, .5), '#3a3440');
      const k = W3(r, onFace(Hs, f, u + hw - 2, 9, .6)); px.dot(g, k[0], k[1], '#e8c860');
    }
    quad(r, g, faceRect(Hs, f, u, hw + 2.5, 0, .9, 2.5), '#8a8494');   // the step
  }, { bias: .002 });
  if (D.open) {
    r.queue(p[0], p[1], 0, g => { quad(r, g, faceRect(Hs, f, u - 1.5, hw - 1.5, 1, top - 3, .5), '#c8702e'); quad(r, g, faceRect(Hs, f, u - 1.5, hw - 3, 2, top - 6, .55), '#f0a850'); }, { bias: .003 });
    const gp = onFace(Hs, f, u, 9, 1), lp = onFace(Hs, f, u, 0, 16), fl = .9 + .12 * Math.sin(t * 5.3) * Math.sin(t * 2.1);
    glowAt(r, gp[0], gp[1], gp[2], 16, .85 * fl, '#ffb060'); L.add(lp[0], lp[1], 4, 60, .55 * fl, { color: '#ff9a4a' });
  }
}

/* ---------- solid shapes: an oriented box, a faceted cylinder (a PS1 drum), a tapered stone, a spinning crystal ---------- */
const LIT = (nx, ny) => nx * .6 + ny * .8;                         // the scene's light comes from the camera side (as on the walls)
const tone4 = (t, k) => k > .55 ? t.lt : k > .05 ? t.base : k > -.45 ? t.sh : t.deep;
/** box centred on (x, y), half length hl along angle a, half width hw, from z0 to z1 */
function obox(r, g, x, y, z0, z1, hl, hw, a, top, side, o = {}) {
  const c = Math.cos(a), s = Math.sin(a), P = (u, v, z) => r.w(x + u * c - v * s, y + u * s + v * c, z), C = [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]], st = E.tones(side);
  for (let i = 0; i < 4; i++) {
    const [u0, v0] = C[i], [u1, v1] = C[(i + 1) % 4], nu = (u0 + u1) / 2, nv = (v0 + v1) / 2, l = Math.hypot(nu, nv) || 1, nx = (nu * c - nv * s) / l, ny = (nu * s + nv * c) / l;
    if (nx * r.view.fx + ny * r.view.fy <= .02) continue;
    const pts = [P(u0, v0, z0), P(u1, v1, z0), P(u1, v1, z1), P(u0, v0, z1)]; px.poly(g, pts, tone4(st, LIT(nx, ny)));
    if (o.grain) for (let k = 1; k < o.grain; k++) { const z = z0 + (z1 - z0) * k / o.grain, A = P(u0, v0, z), B = P(u1, v1, z); px.line(g, A[0], A[1], B[0], B[1], st.sh); }
  }
  if (top) { const tt = E.tones(top), T0 = C.map(([u, v]) => P(u, v, z1)); px.poly(g, T0, top); if (o.edge !== false) { px.line(g, T0[3][0], T0[3][1], T0[0][0], T0[0][1], tt.lt); px.line(g, T0[0][0], T0[0][1], T0[1][0], T0[1][1], tt.lt); } }
}
/** a vertical drum of n facets: the camera-facing facets shaded by the light, then the top. o: { top, bands: [z...], band, staves } */
function cyl(r, g, x, y, z0, z1, R, side, o = {}) {
  const n = o.n || 14, st = E.tones(side), v = r.view, P = (a, z, rr = R) => r.w(x + Math.cos(a) * rr, y + Math.sin(a) * rr, z);
  for (let i = 0; i < n; i++) {
    const a0 = i / n * TAU, a1 = (i + 1) / n * TAU, am = (a0 + a1) / 2, nx = Math.cos(am), ny = Math.sin(am);
    if (nx * v.fx + ny * v.fy <= -.05) continue;
    const k = LIT(nx, ny) + (o.shine || 0); px.poly(g, [P(a0, z0), P(a1, z0), P(a1, z1), P(a0, z1)], k > .75 ? st.hi : tone4(st, k));
    if (o.staves) { const A = P(a0, z0), B = P(a0, z1); px.line(g, A[0], A[1], B[0], B[1], st.deep); }
  }
  if (o.bands) for (const z of o.bands) for (let i = 0; i < n; i++) { const a0 = i / n * TAU, a1 = (i + 1) / n * TAU, am = (a0 + a1) / 2; if (Math.cos(am) * v.fx + Math.sin(am) * v.fy <= 0) continue; const A = P(a0, z, R + .3), B = P(a1, z, R + .3); px.line(g, A[0], A[1], B[0], B[1], o.band || st.deep, o.bw || 1); }
  if (o.top !== null) { const pts = []; for (let i = 0; i < n; i++) pts.push(P(i / n * TAU, z1)); px.poly(g, pts, o.top || st.lt); }
}
/** a tapered square stone (obelisk, plinth): half widths w0 at z0 to w1 at z1, turned by a */
function frustum(r, g, x, y, z0, z1, w0, w1, a, side, o = {}) {
  const c = Math.cos(a), s = Math.sin(a), P = (u, v, z, w) => r.w(x + (u * c - v * s) * w, y + (u * s + v * c) * w, z), C = [[-1, -1], [1, -1], [1, 1], [-1, 1]], st = E.tones(side);
  for (let i = 0; i < 4; i++) {
    const [u0, v0] = C[i], [u1, v1] = C[(i + 1) % 4], nu = (u0 + u1) / 2, nv = (v0 + v1) / 2, nx = nu * c - nv * s, ny = nu * s + nv * c;
    if (nx * r.view.fx + ny * r.view.fy <= .02) continue;
    const q = [P(u0, v0, z0, w0), P(u1, v1, z0, w0), P(u1, v1, z1, w1), P(u0, v0, z1, w1)]; px.poly(g, q, tone4(st, LIT(nx, ny)));
    px.line(g, q[3][0], q[3][1], q[0][0], q[0][1], st.lt);
  }
  if (o.top) px.poly(g, C.map(([u, v]) => P(u, v, z1, w1)), o.top);
}
/** an octahedral crystal spinning round z: faces sorted back to front, each shaded by its normal */
function crystal(r, g, x, y, z, R, up, down, spin, col) {
  const t = E.tones(col), v = r.view, pts = [0, 1, 2, 3].map(i => { const a = spin + i * TAU / 4; return [x + Math.cos(a) * R, y + Math.sin(a) * R, z]; }), T0 = [x, y, z + up], B0 = [x, y, z - down], F = [];
  for (let i = 0; i < 4; i++) { const a = pts[i], b = pts[(i + 1) % 4], am = spin + (i + .5) * TAU / 4, nx = Math.cos(am), ny = Math.sin(am); F.push({ p: [a, b, T0], nx, ny, nz: .6 }, { p: [b, a, B0], nx, ny, nz: -.6 }); }
  for (const f of F) f.d = f.nx * v.dx + f.ny * v.dy + f.nz * v.dz;
  F.sort((p, q) => p.d - q.d);
  for (const f of F) { if (f.d < -.2) continue; const k = LIT(f.nx, f.ny) * .7 + f.nz * .6; px.poly(g, f.p.map(p => W3(r, p)), k > .9 ? t.lt : k > .3 ? t.base : k > -.2 ? t.sh : t.deep); }
  const tp = W3(r, T0); px.dot(g, tp[0], tp[1], '#ffffff');
}
/** a small flame (animated from time; never a frame list): base (x, y) in screen pixels, width, height, phase */
function flame(g, x, y, w, h, t, ph, hot = '#fff4c0', mid = '#ffb040', out = '#ff5a1a') {
  const sw = Math.sin(t * 9 + ph) * w * .25 + Math.sin(t * 17 + ph * 2) * w * .12, hh = h * (.85 + .15 * Math.sin(t * 13 + ph));
  px.poly(g, [[x - w / 2, y], [x + sw, y - hh], [x + w / 2, y]], out); px.poly(g, [[x - w * .3, y], [x + sw * .7, y - hh * .66], [x + w * .3, y]], mid); px.disc(g, x, y - Math.max(1, h * .12), Math.max(.5, w * .2), hot);
}

/* ---------- the waystone: an obelisk of blue stone on a low dais, runes that breathe, a crystal spinning above ---------- */
const TWN = { pray: 0, forgeFlare: 0, heat: 0 };   // shared live state (Ilsa's prayer brightens the stone, the bellows feed the fire)
function waystoneThing() {
  return { kind: 'waystone', x: WS.x, y: WS.y, r: 7.5, solid: true, keep: true,
    update(dt) { if (Math.random() < dt * (1.5 + TWN.pray * 6)) P.glints(WS.x + (Math.random() - .5) * 10, WS.y + (Math.random() - .5) * 10, 44 + Math.random() * 16, 1, '#bff6ff', 6); },
    draw(r) {
      const t = game.time, pulse = .5 + .5 * Math.sin(t * 2.2), glow = clamp(.35 + pulse * .25 + TWN.pray * .35, 0, 1.1), bob = Math.sin(t * 1.6) * 2;
      if (!r.visible(WS.x, WS.y, 0, 80, 120, 60)) return;
      r.decal(() => { r.groundDisc(WS.x, WS.y, 17, '#2a2436', .55); r.groundRing(WS.x, WS.y, 20 + pulse * 1.5, '#6fd6cc', .35 + glow * .3); }, { emissive: .6 });
      r.queue(WS.x, WS.y, 0, g => {
        // the dais: two octagonal steps, then the obelisk (blue-grey stone) and its pyramid cap
        for (const [z0, z1, R] of [[0, 1.6, 15], [1.6, 3.2, 11]]) cyl(r, g, WS.x, WS.y, z0, z1, R, '#4e4a62', { n: 8, top: '#5e5a74' });
        frustum(r, g, WS.x, WS.y, 3.2, 34, 5.4, 3.8, Math.PI / 4, '#3c3e5c');
        const cap = [0, 1, 2, 3].map(i => { const a = Math.PI / 4 + i * TAU / 4 + Math.PI / 4; return [WS.x + Math.cos(a) * 3.8 * Math.SQRT2, WS.y + Math.sin(a) * 3.8 * Math.SQRT2, 34]; }), ap = [WS.x, WS.y, 41], st = E.tones('#48486a');
        for (let i = 0; i < 4; i++) { const a = cap[i], b = cap[(i + 1) % 4], mx = (a[0] + b[0]) / 2 - WS.x, my = (a[1] + b[1]) / 2 - WS.y; if (mx * r.view.fx + my * r.view.fy <= 0) continue; px.poly(g, [W3(r, a), W3(r, b), W3(r, ap)], tone4(st, LIT(mx, my) / 4 + .3)); }
      });
      r.queue(WS.x, WS.y, 0, g => {   // carved runes that breathe light (lit, not emissive: people in front must cover them)
        const rc = glow > .8 ? '#e0fff8' : glow > .55 ? '#8ff0e0' : '#4fb8b0', v = r.view;
        for (const [nx, ny] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
          const fx = nx * .707 - ny * .707, fy = nx * .707 + ny * .707; if (fx * v.fx + fy * v.fy <= .05) continue;   // the obelisk is turned 45 degrees
          for (let k = 0; k < 5; k++) { const z = 8 + k * 5, w = 5.2 - k * .3, px0 = WS.x + fx * w, py0 = WS.y + fy * w, sx = -fy, sy = fx, gl = hs(k, nx * 3 + ny + 5);
            const A = W3(r, [px0 - sx * 1.2, py0 - sy * 1.2, z]), B = W3(r, [px0 + sx * 1.2, py0 + sy * 1.2, z + 2.5]), C0 = W3(r, [px0, py0, z + 3]);
            px.line(g, A[0], A[1], gl < .5 ? B[0] : C0[0], gl < .5 ? B[1] : C0[1], rc); px.dot(g, C0[0], C0[1], rc); }
        }
      }, { bias: .005 });
      r.queue(WS.x, WS.y, 0, g => {   // the crystal (high above heads, so it may glow through the dark), its halo, the motes
        const v = r.view, cz = 52 + bob, [cx, cy] = r.w(WS.x, WS.y, cz), s = v.scale;
        px.glow(g, 1); r.glowDisc(g, cx, cy, 9 * s * (.8 + glow * .3), '#4fb8b0', .1 + glow * .08);
        crystal(r, g, WS.x, WS.y, cz, 4.6, 9, 7, t * .9, glow > .9 ? '#bff8f0' : '#7fe8dc');
        for (let i = 0; i < 5; i++) { const a = t * 1.3 + i * TAU / 5, rr = 9 + Math.sin(t * 2 + i) * 2, [mx, my] = r.w(WS.x + Math.cos(a) * rr, WS.y + Math.sin(a) * rr, cz + Math.sin(a * 2 + i) * 5); px.dot(g, mx, my, i & 1 ? '#ffffff' : '#bff6ff'); }
        const [bx, by] = r.w(WS.x, WS.y, 41), [ex, ey] = r.w(WS.x, WS.y, cz - 7);   // a thread of light joins the crystal to the stone
        px.blend(g, .25 + glow * .25, 'add', () => px.line(g, bx, by, ex, ey, '#8ff0e0'));
      }, { emissive: true, bias: .01 });
      L.add(WS.x, WS.y, 40, 90 + TWN.pray * 30, .45 + glow * .3, { color: '#6fd6cc' }); glowAt(r, WS.x + r.view.fx * 5, WS.y + r.view.fy * 5, 20, 18, .3 + glow * .2, '#8ff0e0');
    } };
}

/* ---------- Seren's tower: a drum of dressed stone, arched windows, a slate cone with a star on top ---------- */
const TOWER_O = { pts: [], paint(g, r) {
  const T0 = TOWER, n = 18, v = r.view, st = E.tones('#7a7088'), P = (a, z, rr = T0.r) => r.w(T0.x + Math.cos(a) * rr, T0.y + Math.sin(a) * rr, z), vis = a => Math.cos(a) * v.fx + Math.sin(a) * v.fy > -.02;
  cyl(r, g, T0.x, T0.y, 0, 4, T0.r + 3, '#6a6474', { n, top: '#7a7484' });                                     // plinth ring
  cyl(r, g, T0.x, T0.y, 4, T0.h, T0.r, '#7a7088', { n, top: null });
  for (let z = 4 + 7, k = 0; z < T0.h - 2; z += 7, k++) for (let i = 0; i < n; i++) {                            // stone courses, joints staggered
    const a0 = i / n * TAU, a1 = (i + 1) / n * TAU; if (!vis((a0 + a1) / 2)) continue;
    const A = P(a0, z, T0.r + .3), B = P(a1, z, T0.r + .3); px.line(g, A[0], A[1], B[0], B[1], st.deep);
    const aj = a0 + ((k & 1) ? .5 : 0) / n * TAU; if (vis(aj)) { const J0 = P(aj, z, T0.r + .3), J1 = P(aj, z + 7, T0.r + .3); px.line(g, J0[0], J0[1], J1[0], J1[1], st.sh); }
  }
  cyl(r, g, T0.x, T0.y, T0.h - 3, T0.h + 1, T0.r + 2.5, '#6a6078', { n, top: '#5a5068' });                    // the parapet band
  // the cone: slate triangles from an overhanging rim to the point, back faces first
  const rim = T0.r + 6, apex = [T0.x, T0.y, T0.h + 44], rt = E.tones('#4a4a78'), F = [];
  for (let i = 0; i < n; i++) { const a0 = i / n * TAU, a1 = (i + 1) / n * TAU, am = (a0 + a1) / 2; F.push({ a0, a1, d: Math.cos(am) * v.fx + Math.sin(am) * v.fy, k: LIT(Math.cos(am), Math.sin(am)) }); }
  F.sort((p, q) => p.d - q.d);
  for (const f of F) {
    const A = [T0.x + Math.cos(f.a0) * rim, T0.y + Math.sin(f.a0) * rim, T0.h - 1], B = [T0.x + Math.cos(f.a1) * rim, T0.y + Math.sin(f.a1) * rim, T0.h - 1];
    px.poly(g, [W3(r, A), W3(r, B), W3(r, apex)], f.d < 0 ? rt.deep : tone4(rt, f.k * .8 + .2));
    if (f.d > 0) for (let k = 1; k < 6; k++) { const u = k / 6, a = lerp3(A, apex, u), b = lerp3(B, apex, u); line3(r, g, a, b, rt.sh); }
    if (f.d > 0) line3(r, g, A, B, rt.deep, zw(r));
  }
} };
function towerThing() {
  return { kind: 'tower', x: TOWER.x, y: TOWER.y, r: 0, keep: true,
    draw(r) {
      if (!r.visible(TOWER.x, TOWER.y, 0, 200, 260, 120)) return;
      const t = game.time, v = r.view;
      if (!TOWER_O.pts.length) for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; TOWER_O.pts.push([TOWER.x + Math.cos(a) * (TOWER.r + 7), TOWER.y + Math.sin(a) * (TOWER.r + 7), 0], [TOWER.x + Math.cos(a) * (TOWER.r + 7), TOWER.y + Math.sin(a) * (TOWER.r + 7), TOWER.h + 46]); }
      r.queue(TOWER.x + v.fx * TOWER.r * .7, TOWER.y + v.fy * TOWER.r * .7, 0, g => drawBaked(TOWER_O, r, g), { occluder: true });
      // windows spiral up the drum (a stair inside), lit from within; a star on the point (high up: the one emissive part)
      const WIN = [[1.2, 12, 0], [.4, 26, 0], [2.1, 30, 0], [1.1, 42, 1], [-.1, 50, 0], [2.6, 48, 0]];
      for (const [a, z, big] of WIN) if (Math.cos(a) * v.fx + Math.sin(a) * v.fy >= .15) glowAt(r, TOWER.x + Math.cos(a) * TOWER.r, TOWER.y + Math.sin(a) * TOWER.r, z + 5, big ? 13 : 10, 1, '#c8a0ff');
      r.queue(TOWER.x + v.fx * (TOWER.r + 1), TOWER.y + v.fy * (TOWER.r + 1), 0, g => {
        for (const [a, z, big] of WIN) {
          if (Math.cos(a) * v.fx + Math.sin(a) * v.fy < .15) continue;
          const R = TOWER.r + .4, w = big ? .1 : .075, hgt = big ? 10 : 7, P = (da, dz) => r.w(TOWER.x + Math.cos(a + da) * R, TOWER.y + Math.sin(a + da) * R, z + dz);
          const fl = .5 + .5 * Math.sin(t * 2.3 + a * 5), c = fl > .6 ? '#d8b0ff' : '#b890f0';
          px.poly(g, [P(-w - .03, -1), P(w + .03, -1), P(w + .03, hgt), P(0, hgt + 3), P(-w - .03, hgt)], '#2a2034');
          px.poly(g, [P(-w, 0), P(w, 0), P(w, hgt - .5), P(0, hgt + 2), P(-w, hgt - .5)], c);
          const m0 = P(0, 0), m1 = P(0, hgt + 1.5); px.line(g, m0[0], m0[1], m1[0], m1[1], '#6a4a8a');
        }
      }, { bias: .01, occluder: true });
      r.queue(TOWER.x + v.fx * (TOWER.r + 1), TOWER.y + v.fy * (TOWER.r + 1), 0, g => {
        const [sx, sy] = r.w(TOWER.x, TOWER.y, TOWER.h + 48 + Math.sin(t * 1.4) * 1.5), s = v.scale, tw = 2 + Math.sin(t * 3) * .6;
        px.glow(g, 1); r.glowDisc(g, sx, sy, 9 * s, '#c8a0ff', .3);
        px.line(g, sx - tw * s * 2, sy, sx + tw * s * 2, sy, '#fff0ff'); px.line(g, sx, sy - tw * s * 2.4, sx, sy + tw * s * 2, '#fff0ff'); px.disc(g, sx, sy, Math.max(1, s), '#ffffff');
      }, { emissive: true, bias: .01 });
      L.add(TOWER.x, TOWER.y + TOWER.r + 6, 20, 70, .5 + .1 * Math.sin(t * 2.3), { color: '#b890f0' });
    } };
}

/* ---------- the forge: the hearth's fire and chimney, the bellows and their lever, the anvil, the quench barrel ---------- */
const MOUTH = { x: 128, y: HEARTH.y1, z: 3 };
function forgeThing() {
  const chim = { x: 128, y: 236, z1: 70 }, smoke = [];
  return { kind: 'forge', x: 128, y: 250, r: 0, keep: true,
    update(dt) {
      TWN.forgeFlare = Math.max(0, TWN.forgeFlare - dt * 1.6);
      stepSmoke({ chim: { x: chim.x, y: chim.y, z1: chim.z1 }, smoke }, dt, 1.4 + TWN.forgeFlare * 2);
      if (Math.random() < dt * (3 + TWN.forgeFlare * 30)) P.add({ kind: 'ember', x: MOUTH.x + (Math.random() - .5) * 10, y: MOUTH.y + 2, z: 8 + Math.random() * 4, vx: (Math.random() - .5) * 14, vy: 8 + Math.random() * 14, vz: 16 + Math.random() * 30 + TWN.forgeFlare * 30, drag: 1.2, max: .8 + Math.random() * .8, color: '#ff8a3a' });
      if (Math.random() < dt * 1.2) P.add({ kind: 'ember', x: chim.x + (Math.random() - .5) * 4, y: chim.y + (Math.random() - .5) * 4, z: chim.z1 + 3, vx: 6, vy: -2, vz: 24 + Math.random() * 20, drag: .6, max: 1.4, color: '#ffb050' });
    },
    draw(r) {
      if (!r.visible(this.x, this.y, 0, 160, 200, 100)) return;
      const t = game.time, fl = flicker(t) + TWN.forgeFlare * .5, v = r.view;
      // the chimney stack above the hearth, and its smoke (sorted with the hearth block)
      r.queue(HEARTH.x1 - 1, HEARTH.y1 - 1, 0, g => {
        r.box(g, chim.x - 7, chim.y - 7, HEARTH.h, chim.x + 7, chim.y + 7, chim.z1, '#5a3a34', '#8a5040');
        for (let z = HEARTH.h + 5; z < chim.z1; z += 5) { line3(r, g, [chim.x - 7, chim.y + 7.1, z], [chim.x + 7, chim.y + 7.1, z], '#5a302a'); line3(r, g, [chim.x + 7.1, chim.y - 7, z], [chim.x + 7.1, chim.y + 7, z], '#5a302a'); }
        r.box(g, chim.x - 8.5, chim.y - 8.5, chim.z1, chim.x + 8.5, chim.y + 8.5, chim.z1 + 3, '#8a8494', '#5e5868'); r.box(g, chim.x - 4, chim.y - 4, chim.z1 + 3, chim.x + 4, chim.y + 4, chim.z1 + 3.3, '#1a0c08', '#1a0c08');
        drawSmoke(g, r, smoke, '#4a4048', '#6e6470', '#948a96');
      }, { bias: .02 });
      if (faces(r, 0, 1)) r.queue(MOUTH.x, MOUTH.y + .5, 0, g => {   // the mouth: a stone arch, glowing coals, flames that roar when the bellows blow
        const P0 = (dx, z) => r.w(MOUTH.x + dx, MOUTH.y + .6, z), arch = (R, z, k) => { const o = []; for (let i = 0; i <= 8; i++) { const a = Math.PI * i / 8; o.push(P0(Math.cos(a) * R, z + Math.sin(a) * k)); } return o; };
        px.poly(g, [P0(-8.5, 1.5), P0(8.5, 1.5)].concat(arch(8.5, 10, 5.5)), '#4a3a3e');   // stone voussoirs round the opening
        px.poly(g, [P0(-7, 2), P0(7, 2)].concat(arch(7, 10, 4)), '#1a0806');
        const [cx, cy] = P0(0, 3), s = v.scale;
        px.glow(g, 1); px.ell(g, cx, cy, 6 * s, 2 * s, fl > 1 ? '#ffd070' : '#ff8a2a'); for (let i = -2; i <= 2; i++) px.dot(g, cx + i * 2.4 * s, cy - (i & 1), '#fff0a0');
        for (let i = 0; i < 4; i++) flame(g, cx + (i - 1.5) * 3 * s, cy, 3.4 * s, (5 + i % 2 * 2) * s * (1 + TWN.forgeFlare * .8), t, i * 1.7);
        px.poly(g, [P0(-9, 10), P0(9, 10), P0(9, 11.5), P0(-9, 11.5)], '#6a5a60');
      }, { bias: .01 });
      glowAt(r, MOUTH.x, MOUTH.y, 7, 16, 1.2, '#ffb050');
      L.add(MOUTH.x, MOUTH.y + 12, 8, 110 + TWN.forgeFlare * 30, (1.05 + TWN.forgeFlare * .6) * fl, { color: '#ff8a3a', shadow: true });
      L.heat(MOUTH.x, MOUTH.y + 4, 14, 10, 1 + TWN.forgeFlare);
    } };
}
/** the bellows beside the hearth: a leather wedge between two boards, a lever Harrow pulls (open 0..1 from his hand) */
function bellowsThing() {
  return { kind: 'bellows', x: BELLOWS.x, y: BELLOWS.y, r: 7, solid: true, keep: true, open: 1,
    draw(r) {
      if (!r.visible(this.x, this.y, 0, 60, 60, 40)) return;
      const o = this.open, x = this.x, y = this.y;
      r.queue(x, y, 0, g => {
        obox(r, g, x + 1, y, 0, 6, 7, 4, 0, '#6a5a50', '#4a3e38');                                                         // a stone block to rest on
        const hz = 6.5, len = 19, top = hz + 2 + o * 6, P = (u, v, z) => [x - 9 + u, y + v, z], wAt = u => 2 + u / len * 5;   // hinge at the nozzle (west) end
        const le = E.tones('#6a4030'), lz = u => hz + (top - hz) * u / len;
        quad(r, g, [P(0, -2, hz), P(len, -7, hz), P(len, 7, hz), P(0, 2, hz)], '#6a4428');                                // bottom board
        for (const sd of [-1, 1]) { const pts = []; for (let k = 0; k <= 6; k++) { const u = k / 6 * len, pl = (k & 1) ? .9 : 0; pts.push(P(u, sd * (wAt(u) - pl), hz + (lz(u) - hz) * .5)); }   // pleated leather sides
          px.poly(g, [W3(r, P(0, sd * 2, hz))].concat(pts.map(p => W3(r, p))).concat([W3(r, P(len, sd * 7, lz(len))), W3(r, P(len, sd * 7, hz))]), sd > 0 ? le.base : le.sh);
          for (let k = 1; k < 6; k += 2) { const u = k / 6 * len; line3(r, g, P(u, sd * (wAt(u) - .9), hz + .3), P(u, sd * (wAt(u) - .9), lz(u) - .3), le.deep); } }
        const bt = E.tones('#a07044'); quad(r, g, [P(0, -2, hz + 1), P(len, -7, top), P(len, 7, top), P(0, 2, hz + 1)], bt.base);   // the top board, a brass boss on it
        line3(r, g, P(1, 0, hz + 1.2), P(len - 1, 0, top - .1), bt.sh); const bq = W3(r, P(len * .6, 0, lz(len * .6) + .3)); px.disc(g, bq[0], bq[1], Math.max(1, r.view.scale * .9), '#d8a848');
        const nz0 = W3(r, P(0, 0, hz + .6)), nz1 = W3(r, P(-6, 0, hz - .5)); px.line(g, nz0[0], nz0[1], nz1[0], nz1[1], '#2a2a34', zw(r) + 1);   // the iron nozzle into the hearth
        const hb = P(len + 1, 0, top), hdl = this.handle || [x + 14, y + 10, 15 + o * 5]; line3(r, g, hb, hdl, '#4a2e1a', zw(r)); line3(r, g, [hb[0], hb[1] - .6, hb[2] + .4], [hdl[0], hdl[1] - .6, hdl[2] + .4], '#8a5a34');   // the lever to Harrow's hand
        const hk = W3(r, hdl); px.disc(g, hk[0], hk[1], Math.max(1, r.view.scale * .8), '#6a4a2e');
      });
    } };
}
function anvilThing() {
  return { kind: 'anvil', x: ANVIL.x, y: ANVIL.y, r: 6.5, solid: true, hittable: true, keep: true,
    onHit(hit) { P.sparks(this.x, this.y, 14, 10, hit.ang, { color: '#ffd070', hot: '#ffffff' }); P.impact(this.x, this.y, 14, 6, '#ffe070'); sfx('clang', { vol: .7, pitch: .9 + Math.random() * .2 }); shake(1.5); game.freeze(.03); },
    draw(r) {
      if (!r.visible(this.x, this.y, 0, 50, 60, 40)) return;
      const x = this.x, y = this.y, a = -Math.PI / 4;
      r.queue(x, y, 0, g => {
        cyl(r, g, x, y, 0, 6, 6.5, '#6a4a30', { n: 10, top: '#8a6a48', bands: [1.5] });                                       // the stump
        obox(r, g, x, y, 6, 8.5, 5.5, 3.5, a, '#4a4a58', '#3a3a48'); obox(r, g, x, y, 8.5, 11, 2.6, 2, a, '#4a4a58', '#3a3a48');   // foot and waist
        obox(r, g, x, y, 11, 14, 6, 2.8, a, '#5e5e6e', '#3a3a48');                                                            // the face
        const c = Math.cos(a), s = Math.sin(a), P = (u, v, z) => [x + u * c - v * s, y + u * s + v * c, z];
        quad(r, g, [P(6, -2.2, 14), P(12, 0, 13.4), P(6, 2.2, 14)], '#56566a'); quad(r, g, [P(6, 2.2, 14), P(12, 0, 13.4), P(6, 2.2, 11.5)], '#3e3e4e');   // the horn
        line3(r, g, P(-6, -2.8, 14), P(6, -2.8, 14), '#9a9aac');
        if (TWN.heat > .25) { const q = W3(r, P(0, 0, 14.2)); px.blend(g, .25 + TWN.heat * .2, 'add', () => px.ell(g, q[0], q[1], 3.2 * r.view.scale, 1.1 * r.view.scale, '#ff6a1a')); }
      });
    } };
}
function quenchThing() {
  const ripples = [];
  return { kind: 'quench', x: QUENCH.x, y: QUENCH.y, r: 7, solid: true, keep: true, ripples,
    update(dt) { for (let i = ripples.length - 1; i >= 0; i--) if ((ripples[i].t += dt) > 1) ripples.splice(i, 1); },
    draw(r) {
      if (!r.visible(this.x, this.y, 0, 50, 60, 40)) return;
      const x = this.x, y = this.y, t = game.time;
      r.queue(x, y, 0, g => {
        cyl(r, g, x, y, 0, 13, 7, '#7a5232', { n: 12, staves: true, top: null, bands: [2.5, 10.5], band: '#4a4a58', bw: zw(r) });
        cyl(r, g, x, y, 12.2, 13, 6.3, '#2a4a6a', { n: 12, top: '#2a4a6e' });
        const [cx, cy] = r.w(x, y, 13), s = r.view.scale; px.dot(g, cx - 2 * s, cy - s * .5, '#9ad0ff'); px.dot(g, cx + s + Math.sin(t) * s, cy + s * .3, '#6aa0d0');
        for (const q of ripples) { const R = (1 + q.t * 5) * s; px.blend(g, 1 - q.t, 'normal', () => { const pts = []; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; pts.push([cx + q.dx * s + Math.cos(a) * R, cy + q.dy * s + Math.sin(a) * R * .5]); } for (const p0 of pts) px.dot(g, p0[0], p0[1], '#c8e8ff'); }); }
      });
    } };
}

/* ---------- the market stall: a striped awning on the store's front (sorted cell by cell so it sits between the wall
 * and Cobb), goods on the counter, a signpost with a lantern ---------- */
const AWN = { x0: 352, x1: 464, yb: 96, zb: 35, yf: 116, zf: 30 };
function stallThing() {
  const potions = [[364, 134, '#e04a5a'], [370, 138, '#4a8ae8'], [376, 134, '#6ad06a'], [382, 138, '#e8a040']];
  return { kind: 'stall', x: 408, y: 128, r: 0, keep: true,
    draw(r) {
      if (!r.visible(this.x, this.y, 0, 160, 160, 100)) return;
      const t = game.time, A = AWN;
      for (let cx = A.x0; cx < A.x1; cx += 16) r.queue(cx + 8, A.yb + 1, 0, g => {   // one cell of canvas: two stripes, their scalloped valance, the iron bracket
        for (let k = 0; k < 2; k++) {
          const x0 = cx + k * 8, x1 = x0 + 8, red = !k, ct = E.tones(red ? '#b83a3a' : '#e8dcc0'), sw = Math.sin(t * 1.3 + x0 * .05) * .35;
          quad(r, g, [[x0, A.yb, A.zb], [x1, A.yb, A.zb], [x1, A.yf, A.zf + sw], [x0, A.yf, A.zf + sw]], ct.base);
          line3(r, g, [x0 + 4, A.yb, A.zb], [x0 + 4, A.yf, A.zf + sw], ct.lt);
          const pts = []; for (let i = 0; i <= 5; i++) { const u = i / 5; pts.push(W3(r, [x0 + u * 8, A.yf, A.zf + sw - 2.5 - Math.sin(u * Math.PI) * 2.5])); }
          px.poly(g, [W3(r, [x0, A.yf, A.zf + sw]), W3(r, [x1, A.yf, A.zf + sw])].concat(pts.reverse()), ct.sh);
        }
        line3(r, g, [cx, A.yb, A.zb], [cx + 16, A.yb, A.zb], '#4a3020', zw(r) + 1); line3(r, g, [cx, A.yf, A.zf], [cx + 16, A.yf, A.zf], '#5a3a2a', zw(r));
        if (cx === A.x0 || cx + 16 >= A.x1) line3(r, g, [cx + (cx === A.x0 ? 1 : 15), A.yb, A.zb - 6], [cx + (cx === A.x0 ? 1 : 15), A.yf, A.zf], '#2a2430', zw(r));
      }, { bias: .002, occluder: true });
      if (faces(r, 0, 1)) r.queue(408, COUNTER.y + 16.5, 0, g => {   // the counter's front: two courses of boards and a lit top rail
        const y = COUNTER.y + 16.2; for (const z of [3, 6]) line3(r, g, [COUNTER.x0, y, z], [COUNTER.x1, y, z], '#5a3820');
        for (let x = COUNTER.x0 + 5, k = 0; x < COUNTER.x1; x += 11, k++) line3(r, g, [x + (k & 1) * 4, y, k & 1 ? 3 : 6], [x + (k & 1) * 4, y, k & 1 ? 6 : 9], '#5a3820');
        line3(r, g, [COUNTER.x0, y, 8.6], [COUNTER.x1, y, 8.6], '#c89a68', zw(r));
      }, { bias: .001 });
      r.queue(408, COUNTER.y + 17, 0, g => {   // goods on the counter: potions, apples, loaves, a stack of coin
        const s = r.view.scale;
        for (const [x, y, c] of potions) { const q = W3(r, [x, y + 8, 9]), ct = E.tones(c); px.rect(g, q[0] - s, q[1] - 4 * s, Math.max(2, 2 * s), 4 * s, ct.base); px.rect(g, q[0] - s, q[1] - 4 * s, 1, 4 * s, ct.hi); px.rect(g, q[0] - .5 * s, q[1] - 5.5 * s, Math.max(1, s), 1.5 * s, '#c8b89a'); }
        const bq = W3(r, [424, 138, 9]); px.ell(g, bq[0], bq[1], 5 * s, 2.4 * s, '#6a4a2a'); for (let i = 0; i < 6; i++) px.disc(g, bq[0] + (i - 2.5) * 1.6 * s, bq[1] - 1.5 * s - (i & 1) * s, Math.max(1, 1.3 * s), i % 3 ? '#c83a3a' : '#e8c040');
        const lq = W3(r, [446, 136, 9]); px.ell(g, lq[0], lq[1] - s, 4 * s, 1.8 * s, '#b0783a'); px.ell(g, lq[0] - s, lq[1] - 1.6 * s, 2.4 * s, 1 * s, '#d8a060');
        const cq = W3(r, [404, 136, 9]); for (let i = 0; i < 4; i++) px.ell(g, cq[0], cq[1] - i * s * .8, 2.2 * s, .9 * s, i === 3 ? '#fff0a0' : '#d8a038');
      }, { bias: .003 });
      r.queue(338, 142, 0, g => {   // the signpost: COBB'S, a gold coin painted on the board
        obox(r, g, 338, 142, 0, 31, 1.3, 1.3, 0, '#7a5232', '#5a3a22'); line3(r, g, [338, 142, 30], [347, 143, 30], '#2a2430', zw(r));
        const bz = 15, P = (dx, z) => [338 + dx, 143.6, z];
        quad(r, g, [P(-11, bz), P(11, bz), P(11, bz + 7), P(-11, bz + 7)], '#5a3820'); quad(r, g, [P(-10, bz + .8), P(10, bz + .8), P(10, bz + 6.2), P(-10, bz + 6.2)], '#9a6a3e');
        const cq = W3(r, P(-6, bz + 3.5)), s = r.view.scale; px.disc(g, cq[0], cq[1], Math.max(1, 1.8 * s), '#e8b840'); px.dot(g, cq[0] - 1, cq[1] - 1, '#fff0a0');
        const tq = W3(r, P(3, bz + 3.5)); E.font.text(g, 'COBB', Math.round(tq[0]), Math.round(tq[1]) - 2, '#3a2010', { align: 'center', font: 'tiny', outline: false });
      });
      const BA = ED.L.broomAt || BROOM_AT, onCounter = !!ED.L.broomAt;
      if (!ED.L.broomHeld) r.queue(BA[0], BA[1], 0, g => {   // the broom leans on the crates until Cobb needs it (or on the counter's back, if a customer called him away)
        const [bx, by] = BA, b = W3(r, [bx, by + 1, 0]), t0 = W3(r, onCounter ? [bx + 1.5, by + 4.5, 15] : [bx + 1, by - 6.5, 17]), s2 = r.view.scale;
        px.line(g, b[0], b[1] - 4 * s2, t0[0], t0[1], '#6a4428', zw(r) + 1); px.line(g, b[0] - 1, b[1] - 4 * s2, t0[0] - 1, t0[1], '#9a6a3e', zw(r));
        px.poly(g, [[b[0] - 1.5 * s2, b[1] - 5 * s2], [b[0] + 1.5 * s2, b[1] - 5 * s2], [b[0] + 3 * s2, b[1]], [b[0] - 3 * s2, b[1]]], '#c8a050'); px.line(g, b[0] - 3 * s2, b[1], b[0] + 3 * s2, b[1], '#8a6a30');
      });
      L.add(408, 150, 20, 64, .5, { color: '#ffc070' }); L.add(408, COBB_LANE - 2, 22, 58, .45, { color: '#ffc880' });   // the counter front, and the lane under the awning
    } };
}
/* ---------- the stash: an iron-bound oak strongbox beside Cobb's stall. E opens it (the UI's 'stash' panel): the lid swings
 * up on its hinges with a creak and a spring's overshoot, the red velvet lining and a heap of gold catch the light; when
 * the panel closes it drops shut with a thud, bounces once and puffs dust. Every piece is a world point through r.w,
 * so it reads in every view and at every zoom ---------- */
const STASH = { x: 322, y: 172, a: -.64, hl: 8.5, hw: 5.5, z0: 1.4, z1: 9.8, hL: 3.8 };
function stashThing() {
  const K = STASH, c = Math.cos(K.a), sn = Math.sin(K.a), Q = (u, v, z) => [K.x + u * c - v * sn, K.y + u * sn + v * c, z];
  return { kind: 'stash', x: K.x, y: K.y, r: 9, solid: true, hittable: true, keep: true, mapColor: '#e8c860', lid: 0, lv: 0, peek: 0, tr: 0, want: 0,
    onHit(hit) { this.lv += 3; tsfx('clang', this.x, this.y, { vol: .5, pitch: 1.4 }); P.sparks(this.x, this.y, 8, 5, hit.ang, { color: '#ffd070', hot: '#ffffff' }); },   // a knock makes the lid jump
    use() { this.peek = UI.panels.stash ? 0 : 1; UI.open('stash', { chest: this }); UI.keyNav = true; },
    step(dt) {   // a damped spring toward open (the panel is up) or shut; called from draw so it runs while the panel is modal
      const want = UI.isOpen('stash') || this.peek > 0 ? 1 : 0; this.peek -= dt;
      if (want && !this.want) { tsfx(TWN_SFX.creak, this.x, this.y); P.glints(this.x, this.y, K.z1 + 2, 8, '#ffe8a0', 10); }
      this.want = want; this.lv += ((want - this.lid) * 120 - this.lv * 12) * dt; this.lid += this.lv * dt;
      if (this.lid < 0) { if (this.lv < -1.5) { tsfx('thud', this.x, this.y, { vol: .4, pitch: 1.2 }); P.dust(this.x, this.y, 0, 6, { speed: 26 }); shake(.6); } this.lid = 0; this.lv = Math.abs(this.lv) * .22; if (this.lv < .3) this.lv = 0; }
      if (this.lid > 1.1) { this.lid = 1.1; this.lv = 0; }
    },
    draw(r) {
      const now = game.real, dt = clamp(now - (this.tr || now), 0, .05); this.tr = now; this.step(dt);
      if (!r.visible(K.x, K.y, 0, 50, 60, 40)) return;
      const th = this.lid * 1.9, open = this.lid > .04, v = r.view;
      r.queue(K.x, K.y, 0, g => {
        const zm = zw(r), wd = E.tones('#7a4a2a'), ir = E.tones('#4a4a5a'), au = E.tones('#e0b040'), W = p => W3(r, p);
        for (const k of [-6, 6]) { const q = Q(k, 0, 0); obox(r, g, q[0], q[1], 0, K.z0, .9, K.hw + .5, K.a, '#4a3020', '#3a2418'); }   // skids
        obox(r, g, K.x, K.y, K.z0, K.z1, K.hl, K.hw, K.a, null, '#7a4a2a', { grain: 3 });                                    // the body
        const band = (u, vv, nx, ny) => { if (nx * v.fx + ny * v.fy <= .02) return; line3(r, g, Q(u, vv, K.z0), Q(u, vv, K.z1), ir.deep, zm + 1); line3(r, g, Q(u, vv, K.z0 + .3), Q(u, vv, K.z1 - .3), ir.lt, zm); };
        for (const u of [-5.5, 5.5]) band(u, K.hw + .15, -sn, c);                                                          // straps on the front,
        for (const sd of [-1, 1]) band(sd * (K.hl + .15), 0, sd * c, sd * sn);                                             // and round the ends
        for (const z of [K.z0 + 1.6, K.z1 - 1.4]) if (-sn * v.fx + c * v.fy > .02) line3(r, g, Q(-K.hl, K.hw + .15, z), Q(K.hl, K.hw + .15, z), ir.sh);   // a rail top and bottom
        if (-sn * v.fx + c * v.fy > .02) {   // the lock plate and its keyhole
          quad(r, g, [Q(-1.6, K.hw + .25, 4.6), Q(1.6, K.hw + .25, 4.6), Q(1.6, K.hw + .25, 8.4), Q(-1.6, K.hw + .25, 8.4)], au.sh);
          quad(r, g, [Q(-1.2, K.hw + .3, 5), Q(1.2, K.hw + .3, 5), Q(1.2, K.hw + .3, 8), Q(-1.2, K.hw + .3, 8)], au.base);
          const kh = W(Q(0, K.hw + .35, 6.3)); px.rect(g, kh[0], kh[1] - 1, 1, 2, '#1a1010'); const hl = W(Q(-.9, K.hw + .35, 7.8)); px.dot(g, hl[0], hl[1], au.hi);
        }
        // the lid: a barrel top in six facets turned about the back hinge by th; each facet shaded by its normal, the inside velvet
        const arc = []; for (let i = 0; i <= 6; i++) { const t = i / 6, ph = Math.PI * t, dv = K.hw * (1 + Math.cos(ph)), dz = K.hL * Math.sin(ph), nv = Math.cos(ph) / K.hw, nz = Math.sin(ph) / K.hL;
          arc.push({ v: -K.hw + dv * Math.cos(th) - dz * Math.sin(th), z: K.z1 + dv * Math.sin(th) + dz * Math.cos(th), nv: nv * Math.cos(th) - nz * Math.sin(th), nz: nv * Math.sin(th) + nz * Math.cos(th) }); }
        const L0 = K.hl + .3, F = [];
        for (let i = 0; i < 6; i++) { const a = arc[i], b = arc[i + 1], nv = (a.nv + b.nv) / 2, nz = (a.nz + b.nz) / 2, l = Math.hypot(nv, nz) || 1, nx = -sn * nv / l, ny = c * nv / l, nzz = nz / l;
          const m = Q(0, (a.v + b.v) / 2, (a.z + b.z) / 2); F.push({ q: [Q(-L0, a.v, a.z), Q(L0, a.v, a.z), Q(L0, b.v, b.z), Q(-L0, b.v, b.z)], d: nx * v.dx + ny * v.dy + nzz * v.dz, k: LIT(nx, ny) * .6 + nzz * .7, dp: v.depth(m[0], m[1], m[2]), i, a, b }); }
        const cap = sd => ({ q: arc.map(p => Q(sd * L0, p.v, p.z)), d: sd * (c * v.dx + sn * v.dy), cap: true });
        const lidDraw = () => {
          for (const sd of [-1, 1]) { const C0 = cap(sd); if (C0.d > 0) quad(r, g, C0.q, wd.sh); }
          for (const f of F.slice().sort((p, q) => p.dp - q.dp)) {   // far facets first
            if (f.d > 0) { quad(r, g, f.q, f.k > .75 ? wd.lt : f.k > .3 ? wd.base : f.k > -.1 ? wd.sh : wd.deep); if (f.i % 2 === 0) line3(r, g, f.q[0], f.q[1], wd.deep); }
            else if (open) {   // the quilted velvet lining: darker toward the hinge, a gold button in each tuft
              quad(r, g, f.q, f.i > 3 ? '#5a1424' : f.i > 1 ? '#7a2032' : '#8e2c3e');
              if (f.i % 2 === 1) for (const u of [-5, 0, 5]) { const q = W(Q(u, (f.a.v + f.b.v) / 2, (f.a.z + f.b.z) / 2)); px.dot(g, q[0], q[1], '#d8a040'); px.dot(g, q[0] + 1, q[1] + 1, '#3a0a14'); }
            }
          }
          if (open) {   // the lid's wooden frame round the lining: its front edge and both curved ends
            line3(r, g, Q(-L0, arc[0].v, arc[0].z), Q(L0, arc[0].v, arc[0].z), wd.base, zm + 1);
            for (const sd of [-1, 1]) for (let i = 0; i < 6; i++) line3(r, g, Q(sd * L0, arc[i].v, arc[i].z), Q(sd * L0, arc[i + 1].v, arc[i + 1].z), wd.sh, zm + 1);
          }
          for (const u of [-5.5, 5.5]) for (let i = 0; i < 6; i++) { const a = arc[i], b = arc[i + 1]; if (F[i].d > 0) { line3(r, g, Q(u, a.v, a.z), Q(u, b.v, b.z), ir.deep, zm + 1); line3(r, g, Q(u, a.v, a.z + .2), Q(u, b.v, b.z + .2), ir.lt, zm); } }   // iron hoops over the lid
          const f0 = arc[0], hp = W(Q(0, f0.v + .2, f0.z)), hq = W(Q(0, f0.v + .2 - 2 * Math.cos(th), f0.z - 2 * Math.cos(th) + (1 - Math.cos(th)) * 1.5)); px.line(g, hp[0], hp[1], hq[0], hq[1], au.base, zm + 1); px.dot(g, hq[0], hq[1], au.hi);   // the hasp
        };
        const cavity = () => {   // the open box: a dark hold, a heap of coin and a gem or two, lit from within
          quad(r, g, [Q(-K.hl + .6, -K.hw + .6, K.z1), Q(K.hl - .6, -K.hw + .6, K.z1), Q(K.hl - .6, K.hw - .6, K.z1), Q(-K.hl + .6, K.hw - .6, K.z1)], '#1a0e0a');
          const s = v.scale, t = game.time;
          for (let i = 0; i < 24; i++) { const u = (hs(i, 3) - .5) * 13, vv = (hs(i, 5) - .5) * 7, zz = K.z1 - .8 + (1 - Math.abs(u) / 7) * 1.3 + (i > 12 ? .4 : 0), q = W(Q(u, vv, zz)); px.ell(g, q[0], q[1], 1.3 * s, .65 * s, i < 8 ? au.deep : i % 3 ? au.base : au.sh); if (i % 4 === 0 && i > 8) px.dot(g, q[0], q[1] - .5, au.hi); }   // a heap of coin, the deeper ones darker
          const gq = W(Q(-2.5, 1, K.z1 + .2)); px.disc(g, gq[0], gq[1], 1.2 * s, '#c83a5a'); px.dot(g, gq[0] - .4, gq[1] - .4, '#ffc0d0');
          const gq2 = W(Q(3, -1.5, K.z1)); px.disc(g, gq2[0], gq2[1], s, '#3a8ae8'); if (Math.sin(t * 3) > .6) px.dot(g, gq2[0], gq2[1] - s, '#ffffff');
        };
        if (open && th > 1.05) { lidDraw(); cavity(); } else { if (open) cavity(); lidDraw(); }
      });
      if (this.lid > .15) { glowAt(r, K.x, K.y, K.z1 + 1, 10, .9 * this.lid, '#ffd070'); L.add(K.x, K.y, K.z1 + 4, 40, .5 * this.lid, { color: '#ffc060' }); }
    } };
}
/* ---------- small set pieces: barrels, crates, sacks, tables, stools, the well, benches, hay, the coop, stones ---------- */
/** one static piece: kind, position, a collision radius, a painter (r, g, x, y), and o.light(r) for any glow it gives */
const piece = (kind, x, y, rr, paint, o = {}) => ({ kind, x, y, r: rr, solid: rr > 0, keep: true, draw(r) { if (!r.visible(x, y, 0, 60, 80, 50)) return; r.queue(x, y, 0, g => paint(r, g, x, y)); if (o.light) o.light(r); } });
/** a still piece drawn as a shape (docs/ASSETS.md: a core id or an entry): r.shape's placement in o; the piece's circle
 *  is still its collision, so the town plays as it did */
const shapePiece = (kind, id, x, y, rr, o = {}) => ({ kind, x, y, r: rr, solid: rr > 0, keep: true, draw(r) { r.shape(id, x, y, o.z || 0, o); } });
/** a material in another color (a darker oak for one barrel), its pattern and numbers kept */
const recolor = (id, c) => Object.assign({}, E.material(id).q, { color: c, ramp: undefined });
const turned = (x, y) => E.hash2(Math.round(x), Math.round(y)) * TAU;   // (each piece faces a way of its own)
/** a pine beyond the wall: the pine generator, as a prop's record drawProps draws (this file needs nothing but the core) */
const pineAt = (Lv, x, y, size, color) => Lv.props.push({ name: 'pine', shape: 'pine', x, y, z: 0, o: { size }, so: { facing: turned(x, y), scale: Math.round(size * 16) / 16, mats: { l: recolor('needles', color) } } });
/** the town's own entries, written as the store's are */
const TOWN_SHAPES = {
  table: { about: 'round tavern table on a post, two full mugs and an empty one', mats: { t: 'oak', l: 'walnut', m: '#b08850', f: '#f8f0d8', e: '#6a3a1a' },
    parts: [['cyl','l',[0,0,0],1.6,9], ['cyl','t',[0,0,9],8,1.5], ['cyl','m',[-3,-2,10.5],1.3,3.5], ['cyl','f',[-3,-2,14],1.1,.2], ['cyl','m',[0,4,10.5],1.3,3.5], ['cyl','f',[0,4,14],1.1,.2], ['cyl','m',[3,1,10.5],1.3,3.5], ['cyl','e',[3,1,14],1.1,.2]] },
  hay: { about: 'hay bale bound with two bands of twine', mats: { s: 'straw', t: '#8a6a3a' }, parts: [['box','s',[0,0,0],[16,10,8]], ['mirror','x',['box','t',[3,0,0],[.8,10.2,8.2]]]] }
};
const barrel = (x, y, c = '#8a5a32') => shapePiece('barrel', 'barrel', x, y, 5.5, { scale: .75, facing: turned(x, y), mats: { w: recolor('oak', c) } });
const crate = (x, y, a = 0, s = 1, z = 0) => shapePiece('crate', 'crate', x, y, z ? 0 : 6 * s, { z, scale: .72 * s, facing: a + Math.PI / 2 });
const sack = (x, y, c = '#c8b088') => shapePiece('sack', 'sack', x, y, 4, { scale: .9, facing: turned(x, y), mats: { b: recolor('burlap', c) } });
const table = (x, y) => shapePiece('table', TOWN_SHAPES.table, x, y, 7.5, { facing: turned(x, y) });
const stool = (x, y) => shapePiece('stool', 'stool', x, y, 3, { scale: .6, facing: turned(x, y) });
const bench = (x, y, a) => shapePiece('bench', 'bench', x, y, 5, { scale: .7, facing: a + Math.PI / 2 });
function hay(x, y, a = 0) { return shapePiece('hay', TOWN_SHAPES.hay, x, y, 7, { facing: a + Math.PI / 2 }); }
function stone(x, y, h, w, c = '#7a7688') { return piece('stone', x, y, w + 1, (r, g) => { frustum(r, g, x, y, 0, h, w, w * .78, .3, c, { top: E.tones(c).lt }); const tq = W3(r, [x, y, h]); px.dot(g, tq[0], tq[1] + 2, E.tones(c).deep); }); }
function wellThing() { return shapePiece('well', 'well', WELL.x, WELL.y, 13, { scale: 1.2 }); }
function coopThing(x, y) {
  return piece('coop', x, y, 12, (r, g) => {
    obox(r, g, x, y, 0, 3, 11, 8, 0, '#5a4a3a', '#4a3a2a'); obox(r, g, x, y, 3, 15, 10, 7, 0, '#9a7048', '#8a6038', { grain: 4 });
    const rt = E.tones('#8a4a2a'); quad(r, g, [[x - 12, y - 9, 14], [x + 12, y - 9, 14], [x + 12, y, 21], [x - 12, y, 21]], rt.sh); quad(r, g, [[x - 12, y + 9, 14], [x + 12, y + 9, 14], [x + 12, y, 21], [x - 12, y, 21]], rt.base); line3(r, g, [x - 12, y, 21], [x + 12, y, 21], rt.lt);
    if (faces(r, 0, 1)) { quad(r, g, [[x - 3, y + 7.1, 3], [x + 3, y + 7.1, 3], [x + 3, y + 7.1, 9], [x - 3, y + 7.1, 9]], '#2a1a12'); line3(r, g, [x + 2, y + 7.2, 0], [x + 6, y + 13, 0], '#8a6a4a', zw(r) + 1); }
  });
}
function scarecrow(x, y) {
  return piece('scarecrow', x, y, 0, (r, g) => {
    const t = game.time, sw = Math.sin(t * 1.4) * .6; line3(r, g, [x, y, 0], [x, y, 26], '#6a4a2a', zw(r) + 1); line3(r, g, [x - 9, y, 19 + sw], [x + 9, y, 19 - sw], '#6a4a2a', zw(r));
    const [bx, by] = r.w(x, y, 16), s = r.view.scale, st = E.tones('#6a7a9a'); px.poly(g, [[bx - 4 * s, by - 5 * s], [bx + 4 * s, by - 5 * s], [bx + 5 * s, by + 5 * s], [bx - 5 * s, by + 5 * s]], st.base); px.rect(g, bx - 4 * s, by + 1 * s, 8 * s, 1, st.sh);
    for (let i = -1; i <= 1; i++) px.line(g, bx + i * 3 * s, by + 5 * s, bx + i * 3.6 * s, by + 7.5 * s, '#e0c070');
    const [hx, hy] = r.w(x, y, 25), ht = E.tones('#c8a878'); px.disc(g, hx, hy, 3.4 * s, ht.sh); px.disc(g, hx - .5, hy - .5, 2.8 * s, ht.base); px.dot(g, hx - s, hy - .5 * s, '#2a1a12'); px.dot(g, hx + s, hy - .5 * s, '#2a1a12'); px.line(g, hx - s, hy + s, hx + s, hy + 1.3 * s, '#6a2a1a');
    px.ell(g, hx, hy - 2.6 * s, 5 * s, 1.4 * s, '#5a4a2e'); px.ell(g, hx, hy - 4 * s, 2.6 * s, 2 * s, '#6a5a36');
  });
}
/** leaf-clump bushes, no two alike (one outline round the mass, a body and lit top per clump, leaf dots, blossoms) */
function bushThing(x, y, s = 1, c = '#3e6e40', bloom = null) {
  const k = Math.floor(x * 3 + y * 7), H = i => hs(k, i), n = 4 + Math.floor(H(0) * 4), C = E.ramp(c, 5, 1.1), cl = [];
  for (let i = 0; i < n; i++) { const a = H(i + 9) - .5, b = H(i + 19); cl.push([a * (9 + H(1) * 10), -(3 + b * 4 + (.5 - Math.abs(a)) * 7), 3 + b * 2]); }
  return piece('bush', x, y, 5 * s, (r, g) => {
    const [bx, by] = r.w(x, y, 0), sc = r.view.scale * s * .9;
    for (const [X, Y, R] of cl) px.disc(g, bx + X * sc, by + Y * sc, R * sc + 1, C[0]);
    for (const [X, Y, R] of cl) { px.disc(g, bx + X * sc, by + Y * sc, R * sc, C[1]); px.disc(g, bx + (X - R * .3) * sc, by + (Y - R * .35) * sc, R * .6 * sc, C[2]); }
    for (let i = 0; i < n * 3; i++) { const [X, Y, R] = cl[i % n]; px.dot(g, bx + (X + (H(i + 29) - .6) * R * 1.5) * sc, by + (Y + (H(i + 59) - .7) * R * 1.4) * sc, bloom && i % 3 < 1 ? bloom : C[3 + i % 2]); }
  });
}

/* =============================================================================
 * PEOPLE: a rig hook (hand targets by IK, held items from the real joints, a beard), a step machine, greetings and talk
 * ============================================================================= */
const V3 = E.V3;
const HEAT = ['#5a5a6a', '#7a3a2a', '#c8402a', '#ff7a2a', '#ffc050', '#fff0b0'];
const heatCol = k => HEAT[clamp(Math.round(k * (HEAT.length - 1)), 0, HEAT.length - 1)];
/** a local rig point (f, r, z) -> world */
const rigWorld = (rig, p) => { const w = rig._w(p); return [rig.x + w[0], rig.y + w[1], rig.z + w[2]]; };
/** install the hook on an NPC's rig: before the body, hands move to their targets (two-bone IK from the shoulder) and
 *  the items in the far hand are painted; after it, the near hand's items and the face extras */
function hookRig(n) {
  const rig = n.rig, base = Object.getPrototypeOf(rig).draw;
  n.ikw = { L: 0, R: 0 }; n.ikp = { L: [4, -3, 0], R: [4, 3, 0] }; n.ikRel = { L: 'sh', R: 'sh' }; n.items = n.items || [];
  rig.draw = function (g, ox, oy, view) {
    const J = this.J, o = this.o, port = view.id === 'portrait';
    for (const sd of ['L', 'R']) {
      const w = n.ikw[sd]; if (w <= .01 || !J['sh' + sd] || port) continue;
      const T = n.ikp[sd], b = n.ikRel[sd] === 'sh' ? J.shC : n.ikRel[sd] === 'hip' ? J.hipC : [0, 0, 0], tgt = [b[0] + T[0], b[1] + T[1], b[2] + T[2]];
      const [el, hd] = E.ik3(J['sh' + sd], V3.lerp(J['hand' + sd], tgt, w), o.armUpper, o.armLower, [-1, (sd === 'L' ? -1 : 1) * .8, -.3]);
      J['elbow' + sd] = el; J['hand' + sd] = hd;
    }
    if (n.bladeDir && n.bladeW > .01) J.bladeDir = V3.norm(V3.lerp(J.bladeDir, n.bladeDir, n.bladeW));
    const v = this._lastView || view, c = this._w(V3.lerp(J.hipC, J.shC, .5)), dc = v.depth(c[0], c[1], c[2]);
    const far = it => { const hd = J['hand' + (it.hand || 'R')], w = this._w(hd); return v.depth(w[0], w[1], w[2]) < dc - .4 * o.size; };
    if (!port) for (const it of n.items) if (far(it)) paintItem(g, this, ox, oy, view, it, n);
    base.call(this, g, ox, oy, view);
    if (!port) for (const it of n.items) if (!far(it)) paintItem(g, this, ox, oy, view, it, n);
    if (n.S.face) n.S.face(g, this, ox, oy, view, n);
  };
}
/** held things, painted from the joints (so they follow every pose, swing and step) */
function paintItem(g, rig, ox, oy, view, it, n) {
  const J = rig.J, H = J['hand' + (it.hand || 'R')], S = (p) => rigScreen(rig, p, ox, oy, view), z = (view.zoom || 1) * rig.o.size, lw = Math.max(1, Math.round(z));
  const [hx, hy] = S(H);
  if (it.kind === 'hammer') {   // a handle along the rig's weapon line, a heavy iron head across it
    const bd = J.bladeDir, end = V3.add(H, V3.mul(bd, 6.5)), ax = V3.norm([bd[2], 0, -bd[0]]), a = S(V3.add(end, V3.mul(ax, 2.2))), b = S(V3.add(end, V3.mul(ax, -1.6))), e = S(end), tail = S(V3.add(H, V3.mul(bd, -1.2)));
    px.line(g, tail[0], tail[1], e[0], e[1], '#4a2c18', lw + 1); px.line(g, tail[0], tail[1], e[0], e[1], '#8a5a34', lw);
    px.line(g, a[0], a[1], b[0], b[1], '#2e2e3a', Math.max(3, Math.round(3.2 * z))); px.line(g, a[0], a[1], b[0], b[1], '#6a6a7c', Math.max(2, Math.round(2.2 * z))); px.dot(g, a[0], a[1] - 1, '#c8c8d8');
  } else if (it.kind === 'tongs') {   // two iron jaws and, in their bite, the blade he is working (its colour is its heat)
    const to = it.to ? V3.norm(V3.sub(it.to, H)) : V3.norm([.7, -.1, -.5]), j = V3.add(H, V3.mul(to, 6)), bt = V3.add(j, V3.mul(to, 7.5));
    const side = V3.norm([-to[1], to[0], 0]), sp = V3.mul(side, .5), q1 = S(V3.add(j, sp)), q2 = S(V3.sub(j, sp));
    px.line(g, hx, hy, q1[0], q1[1], '#2a2a34', lw); px.line(g, hx, hy, q2[0], q2[1], '#4a4a58', lw);
    const flip = it.flip || 0, w = V3.mul(V3.norm([side[0] * Math.cos(flip), side[1] * Math.cos(flip), Math.sin(flip)]), .9), b0 = S(V3.add(j, w)), b1 = S(V3.add(bt, V3.mul(w, .4))), b2 = S(V3.sub(bt, V3.mul(w, .4))), b3 = S(V3.sub(j, w)), k = TWN.heat;
    px.poly(g, [b0, b1, b2, b3], heatCol(k * .9)); px.line(g, b0[0], b0[1], b1[0], b1[1], heatCol(Math.min(1, k + .15)));
    const tp = S(bt); if (k > .5) px.dot(g, tp[0], tp[1], '#fffbe0');
  } else if (it.kind === 'broom') {   // from the brush on the floor up through both hands
    const B = it.at, top = V3.add(B, V3.mul(V3.norm(V3.sub(J.handL, B)), 21)), b = S(B), t0 = S(top), dx = t0[0] - b[0], dy = t0[1] - b[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, bw = 3.2 * z;
    px.line(g, b[0], b[1], t0[0], t0[1], '#6a4428', lw + 1); px.line(g, b[0] - 1, b[1], t0[0] - 1, t0[1], '#9a6a3e', lw);
    const u = 5 * z / l; px.poly(g, [[b[0] + dx * u + nx * bw * .5, b[1] + dy * u + ny * bw * .5], [b[0] + dx * u - nx * bw * .5, b[1] + dy * u - ny * bw * .5], [b[0] - nx * bw, b[1] - ny * bw + 1], [b[0] + nx * bw, b[1] + ny * bw + 1]], '#c8a050');
    px.line(g, b[0] - nx * bw, b[1] - ny * bw + 1, b[0] + nx * bw, b[1] + ny * bw + 1, '#8a6a30');
  } else if (it.kind === 'coins') {   // a few coins in his palm, one flipping to the other hand
    for (const sd of ['L', 'R']) { const [cx, cy] = S(J['hand' + sd]), k = sd === 'L' ? 3 : 1; for (let i = 0; i < k; i++) px.ell(g, cx, cy - 1 - i * z * .8, 1.8 * z, .9 * z, i === k - 1 ? '#f0c040' : '#b07820'); px.dot(g, cx - z * .6, cy - 1.5 - (k - 1) * z * .8, '#fff4c0'); }
    if (it.flip >= 0 && it.flip < 1) { const u = it.flip, p = V3.lerp(J.handL, J.handR, u); p[2] += Math.sin(u * Math.PI) * 5; const [cx, cy] = S(p), w = Math.abs(Math.cos(u * 14)) * 1.6 * z; px.ell(g, cx, cy, Math.max(.5, w), 1.4 * z, u * 14 % 2 < 1 ? '#fff0a0' : '#d8a038'); }
  } else if (it.kind === 'lantern') {   // an iron lantern on a short chain, a teal flame inside
    const [lx, ly] = [hx, hy + 4 * z], c = it.color || '#8ff0e0';
    px.line(g, hx, hy, lx, ly - 2.5 * z, '#2a2430');
    px.rect(g, lx - 2.2 * z, ly - 3 * z, 4.4 * z, 1.2 * z, '#2a2430'); px.rect(g, lx - 2 * z, ly - 1.8 * z, 4 * z, 4.2 * z, c); px.rect(g, lx - 1.2 * z, ly - 1.2 * z, 1.4 * z, 2.8 * z, '#f0fffc');
    px.rect(g, lx - 2.2 * z, ly + 2.4 * z, 4.4 * z, 1.2 * z, '#2a2430'); px.rect(g, lx - .4 * z, ly - 1.8 * z, Math.max(1, .8 * z), 4.2 * z, '#3a3440');
  } else if (it.kind === 'halberd') {   // an ash pole taller than he is (its butt on the ground when it.ground is 1), an axe blade, a back spike, a top spike, a red pennant that flutters
    const g0 = it.ground || 0, up = V3.norm([.1 * (1 - g0) + .03, .04, 1]), below = (1 - g0) * 9 + g0 * H[2] / up[2], B0 = V3.sub(H, V3.mul(up, below)), len = 38;
    const Pp = k => V3.add(B0, V3.mul(up, k)), fw = V3.norm(V3.sub([1, 0, 0], V3.mul(up, up[0]))), sd = V3.norm([-fw[1], fw[0], 0]), t = game.time + (n ? n.x * .01 : 0);
    const a = S(B0), b = S(Pp(len)); px.line(g, a[0], a[1], b[0], b[1], '#2a1a10', lw + 1); px.line(g, a[0], a[1], b[0], b[1], '#8a5a34', lw); px.dot(g, b[0], b[1], '#b07a48');
    const fl = Math.sin(t * 5.2) * 1.4, fl2 = Math.sin(t * 5.2 - 1.1) * 1.8, pn = [Pp(len - 10.5), Pp(len - 15), V3.add(V3.add(Pp(len - 13.5), V3.mul(fw, -6.5)), V3.mul(sd, fl2)), V3.add(V3.add(Pp(len - 11), V3.mul(fw, -5.5)), V3.mul(sd, fl))].map(S);
    px.poly(g, pn, '#a8302e'); px.line(g, pn[0][0], pn[0][1], pn[3][0], pn[3][1], '#e8c860'); px.line(g, pn[1][0], pn[1][1], pn[2][0], pn[2][1], '#6a1a1a');   // the pennant
    const mt = E.tones('#8e98a8'), bl = [Pp(len - 8.5), V3.add(Pp(len - 9.2), V3.mul(fw, 3.6)), V3.add(Pp(len - 5.5), V3.mul(fw, 4.1)), V3.add(Pp(len - 2.6), V3.mul(fw, 3.2)), Pp(len - 3.2)].map(S);
    px.poly(g, bl, '#2a2430'); px.poly(g, bl.map(p => [p[0] - .4, p[1] - .4]), mt.base); px.line(g, bl[1][0], bl[1][1], bl[2][0], bl[2][1], mt.hi); px.line(g, bl[2][0], bl[2][1], bl[3][0], bl[3][1], mt.lt);   // the axe blade, its edge lit
    const bk = [Pp(len - 6.8), V3.add(Pp(len - 5.8), V3.mul(fw, -2.8)), Pp(len - 5)].map(S); px.poly(g, bk, mt.sh);                                             // the back spike
    const tp = [V3.add(Pp(len - .5), V3.mul(fw, .6)), Pp(len + 4.5), V3.add(Pp(len - .5), V3.mul(fw, -.6))].map(S); px.poly(g, tp, mt.base); px.dot(g, tp[1][0], tp[1][1], mt.hi);   // the top spike
  } else if (it.kind === 'lute') {   // a pear-shaped body at the belly, the neck across the chest to the left hand
    const B = it.rel === 'sh' ? V3.add(J.shC, it.body) : it.body, N = it.rel === 'sh' ? V3.add(J.shC, it.neck) : it.neck, nd = V3.norm(V3.sub(N, B)), wd = V3.norm([-nd[1], nd[0], .15]), pts = [];
    for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, k = Math.cos(a) < 0 ? 1.35 : .9, w = Math.cos(a) < 0 ? 1.15 : .9; pts.push(S(V3.add(B, V3.add(V3.mul(nd, Math.cos(a) * 4.4 * k), V3.mul(wd, Math.sin(a) * 3.8 * w))))); }
    const wt = E.tones(it.color || '#c8883a'); px.poly(g, pts, wt.deep); px.poly(g, pts.map(p => [p[0] - .5, p[1] - .5]), wt.sh); px.poly(g, pts.map(p => [p[0] * .8 + (pts[4][0] + pts[12][0]) * .1 - .8, p[1] * .8 + (pts[4][1] + pts[12][1]) * .1 - .8]), wt.base);   // a rounded belly: rim, body, lit bowl
    const hole = S(V3.add(B, V3.mul(nd, 1.1))); px.disc(g, hole[0], hole[1], Math.max(1.4, 1.3 * z), wt.lt); px.disc(g, hole[0], hole[1], Math.max(1, .9 * z), '#2a1a10');   // the rosette
    const n0 = S(V3.add(B, V3.mul(nd, 3))), n1 = S(N), pg = S(V3.add(N, V3.add(V3.mul(nd, 1.6), [0, 0, -1.2])));
    px.line(g, n0[0], n0[1], n1[0], n1[1], '#5a3418', lw + 1); px.line(g, n1[0], n1[1], pg[0], pg[1], '#3a2010', lw + 1);
    const br = S(V3.add(B, V3.mul(nd, -2))); px.line(g, br[0], br[1], n1[0], n1[1], '#e8e0c8');
  }
}
/* ---------- the step machine ---------- */
const ang = (a, b) => Math.atan2(b[1] - a.y, b[0] - a.x);
/** run the NPC's current step. A step: { d, go: [x, y] | fn(n), sp, face: angle | 'hero' | [x, y] | fn(n, u), rig(n, u, dt) ->
 *  fields, ik(n, u) -> { L: [f, r, z, rel], R }, z(n, u) (hover), enter(n), tick(n, u, dt), exit(n), walkWork (work while walking) } */
function runSteps(n, dt, rs, steps) {
  let st = steps[n.k % steps.length];
  for (let guard = 0; n.sT === undefined && guard < steps.length; guard++) {   // entering a step (skip the ones that say so)
    if (st.skip && st.skip(n)) { n.k++; st = steps[n.k % steps.length]; continue; }
    n.sT = 0; n.arrived = !st.go; n.cues = {}; if (st.enter) st.enter(n); break;
  }
  const target = st.go ? (typeof st.go === 'function' ? st.go(n) : st.go) : null;
  let walking = false;
  if (target && !n.arrived) {
    const dx = target[0] - n.x, dy = target[1] - n.y, d = Math.hypot(dx, dy), sp = st.sp || 30;
    if (d < 1.5) { n.arrived = true; n.vx = n.vy = 0; }
    else { walking = true; n.vx = dx / d * Math.min(sp, d * 4); n.vy = dy / d * Math.min(sp, d * 4); n.facing = E.approachAng(n.facing, Math.atan2(dy, dx), dt * 8); }
  } else n.vx = n.vy = 0;
  const work = !walking || st.walkWork;
  if (walking && st.walkRig) Object.assign(rs, typeof st.walkRig === 'function' ? st.walkRig(n, dt) : st.walkRig);
  if (work) n.sT += dt;
  const u = clamp(n.sT / st.d, 0, 1);
  if (!walking && st.face !== undefined) { const f = typeof st.face === 'function' ? st.face(n, u) : st.face === 'hero' ? angTo(n, ED.hero) : Array.isArray(st.face) ? ang(n, st.face) : st.face; n.facing = E.approachAng(n.facing, f, dt * (st.turn || 7)); }
  const ik = work && st.ik ? st.ik(n, u) : null;
  setIK(n, ik, dt);
  if (work && st.rig) Object.assign(rs, typeof st.rig === 'function' ? st.rig(n, u, dt) : st.rig);
  if (st.z) n.z = st.z(n, u);
  if (work && st.tick) st.tick(n, u, dt);
  if (n.sT >= st.d && n.arrived) { if (st.exit) st.exit(n); n.k++; n.sT = undefined; }
}
function setIK(n, ik, dt) {
  for (const sd of ['L', 'R']) {
    const T = ik && ik[sd];
    n.ikw[sd] = approach(n.ikw[sd], T ? (T[4] === undefined ? 1 : T[4]) : 0, dt * 7);
    if (T) { const P0 = n.ikp[sd], k = n.ikw[sd] < .05 ? 1 : Math.min(1, dt * 16); for (let i = 0; i < 3; i++) P0[i] += (T[i] - P0[i]) * k; n.ikRel[sd] = T[3] || 'sh'; }
  }
}
/** the whole life of a town NPC: talking, greeting, then the work loop (S.steps). S.idle(n, dt, rs) runs every frame */
function life(n, dt, rs) {
  const S = n.S, h = ED.hero;
  n.lt = (n.lt || 0) + dt; n.greetT = Math.max(0, (n.greetT || 0) - dt); n.bubbleCd = Math.max(0, (n.bubbleCd || 0) - dt);
  if (S.idle) S.idle(n, dt, rs);
  if (n.talking && h) {   // gestures while the dialog runs: a pose every beat, turned to the hero
    n.vx = n.vy = 0; n.facing = E.approachAng(n.facing, angTo(n, h), dt * 6); setIK(n, S.talkIK ? S.talkIK(n) : null, dt);
    const g0 = S.talk || [null, 'hips', null, 'cast'], k = Math.floor(n.lt / 1.3) % g0.length; rs.pose = g0[k];
    if (S.hover) { n.z = approach(n.z, S.hover(n), dt * 10); rs.z = n.z; }
    return;
  }
  if (n.greetT > 0 && h && !n.serving) {   // a greeting: turn, wave (the core's wave pose), smile; the work waits a moment (a shopkeeper hurrying to his customer waves on the way)
    n.vx = n.vy = 0; n.facing = E.approachAng(n.facing, angTo(n, h), dt * 7); setIK(n, null, dt);
    if (n.waveT <= 0) rs.pose = S.greetPose || 'hips';
    if (S.hover) { n.z = approach(n.z, S.hover(n), dt * 10); rs.z = n.z; }
    return;
  }
  if (S.work) S.work(n, dt, rs); else runSteps(n, dt, rs, S.steps);
  if (S.hover && !n.talking) rs.z = n.z;
}
/** the greeting hook (the core calls S.near when the hero first comes close) */
function greet(n) {
  const S = n.S; n.greetT = S.greetT || 2.4; n.rig.kick(2.5);
  if (S.hi && n.bubbleCd <= 0) { say(n, S.hi[Math.floor(Math.random() * S.hi.length)], 2.4); n.bubbleCd = 6; tsfx(TWN_SFX.blip, n.x, n.y, { pitch: S.voice || 1 }); }
}
/** dialog lines: an introduction the first time, then the others in a shuffled order with no repeats */
function linesOf(S) {
  return (n) => {
    if (!n.S._met) { n.S._met = true; return S.intro ? [S.intro].concat([S.lines[0]]) : [S.lines[0]]; }
    const L0 = S.lines, bag = n.S._bag || (n.S._bag = []);
    if (!bag.length) { for (let i = 1; i < L0.length; i++) bag.push(i); for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; } }
    const extra = S.extra ? S.extra(n, ED.hero) : null;
    return extra && Math.random() < .4 ? [extra] : [L0[bag.pop()]];
  };
}
/** register a town NPC: the step machine drives it, the core frames it (bubbles, name tags, talk, service panels) */
function townNPC(id, S) {
  const lines = S.lines;
  return def('npcs', id, Object.assign({ update: life, near: greet, talkR: 30 }, S, { lines: linesOf(Object.assign({}, S, { lines })) }));
}
/** attack states from a move spec at time u of a strike cycle (wind / active / recover shares) */
function strike(spec, u, a = .45, b = .12) { return u < a ? { spec, phase: 'wind', u: u / a } : u < a + b ? { spec, phase: 'active', u: (u - a) / b } : { spec, phase: 'recover', u: (u - a - b) / (1 - a - b) }; }
/** true once when the timer u passes the mark k (per NPC; the marks reset when a step begins) */
const cue = (n, u, k, key = 'c') => { const id = key + k; n.cues = n.cues || {}; if (u < k) { n.cues[id] = false; return false; } if (n.cues[id]) return false; n.cues[id] = true; return true; };

/* =============================================================================
 * HARROW, the blacksmith: heats a blade while he pumps the bellows, beats it on the anvil in a smith's rhythm (sparks,
 * a clang, the blade cooling from yellow to red), turns it, taps it true, quenches it in a hiss of steam, wipes his brow
 * ============================================================================= */
const FORGE = { F: [134, 277], A: [ANVIL.x - 8.5, ANVIL.y - 8.5], Q: [164, 300] };
const OVERHEAD = Object.assign({}, E.MOVES.overhead, { a0: 2.5, a1: -1.02, lunge: .9, crouch: .4, lean: .38, hold: .3 });
const TAP = Object.assign({}, E.MOVES.overhead, { a0: 1.2, a1: -1.02, lunge: .3, crouch: .12, lean: .2, hold: .2 });
function anvilHit(n, k) {
  const x = ANVIL.x, y = ANVIL.y, z = 14.5, h = TWN.heat;
  P.sparks(x, y, z, Math.round(3 + h * 12 * k), null, { color: h > .5 ? '#ffb040' : '#ff7a3a', hot: '#fff8d0' });
  P.impact(x, y, z, 2 + k * 2.2, h > .35 ? '#ffe070' : '#d8d8e8');
  if (k >= 1) P.add({ kind: 'dust', x, y, z: 14, vz: 10, max: .4, size: 2, color: '#8a8290' });
  tsfx('clang', x, y, { vol: .45 + k * .4, pitch: (k < 1 ? 1.18 : .96) + Math.random() * .06 });
  n.rig.kick(-2.4 * k); TWN.heat = Math.max(0, h - .03);
}
const hammerStep = (spec, d, k) => ({ d, go: FORGE.A, face: Math.PI / 4, sp: 26, turn: 12,
  rig: (n, u) => ({ attack: strike(spec, u, k >= 1 ? .5 : .4, .1), expr: k >= 1 && u > .5 && u < .7 ? 'shout' : null }),
  ik: () => ({ L: [6.8, -3.4, 11.2, 'root'] }),
  enter: n => { n.items[1].to = [12, 1.2, 12.6]; n.items[1].flip = 0; },
  tick: (n, u) => { if (cue(n, u, k >= 1 ? .6 : .5)) anvilHit(n, k); } });
townNPC('harrow', {
  name: 'HARROW', title: 'Blacksmith', service: 'smith', at: FORGE.A, facing: Math.PI / 4, talkR: 32, voice: .7, greetPose: 'hips',
  rig: { build: 'bulky', size: 1.12, weapon: null, outfit: 'coat', sleeves: 'none', hair: 'short', hat: { style: 'band', color: '#2e2420' }, face: { bangs: .25 },
    colors: { skin: '#dc9c74', hair: '#b8542a', cloth: '#6e4428', coat: '#7a4a2a', trim: '#3e2414', pants: '#3e3434', boot: '#2e2420', belt: '#2a1a12', glove: '#5a4a44', eye: '#1a1010' } },
  items: () => [{ kind: 'hammer', hand: 'R' }, { kind: 'tongs', hand: 'L', to: null, flip: 0 }],
  face: harrowBeard,
  talk: ['hips', null, 'hips', 'guard'],
  idle(n, dt) { const B = ED.L.bellows; if (B && (n.talking || n.greetT > 0)) { B.handle = null; B.open = approach(B.open, 1, dt * 2); } },   // he lets go of the bellows lever to greet or talk (it springs back open)
  steps: [
    { d: .1, go: FORGE.F, sp: 30, enter: n => { n.items[1].to = null; } },
    { d: 3.6, face: -Math.PI / 2, turn: 9,   // heat: the blade in the coals, the right hand pumps the bellows lever
      ik: (n, u) => { const p = (n.sT / 1.2) % 1, down = .5 + .5 * Math.cos(p * TAU); return { L: [9, -2.2, 10.5, 'root'], R: [5.4, 9.6, 12.6 + 6 * down, 'root'] }; },
      enter: n => { n.items[1].to = [17, -.5, 6.2]; },
      tick: (n, u, dt) => {
        const B = ED.L.bellows, p = (n.sT / 1.2) % 1; if (B) { B.handle = rigWorld(n.rig, n.rig.J.handR); B.open = .5 + .5 * Math.cos(p * TAU); }
        if (cue(n, p, .5, 'pump' + Math.floor(n.sT / 1.2))) { TWN.forgeFlare = 1; tsfx(TWN_SFX.whoosh, MOUTH.x, MOUTH.y, { vol: .8 }); P.sparks(MOUTH.x, MOUTH.y + 2, 8, 6, Math.PI / 2, { color: '#ff9a3a', hot: '#fff0a0' }); }
        TWN.heat = Math.min(1, TWN.heat + dt * .34);
      },
      exit: () => { const B = ED.L.bellows; if (B) { B.handle = null; B.open = 1; } } },
    hammerStep(OVERHEAD, .82, 1), hammerStep(OVERHEAD, .82, 1), hammerStep(OVERHEAD, .64, 1), hammerStep(OVERHEAD, .64, 1),
    { d: 1.1, face: Math.PI / 4, ik: (n, u) => ({ L: [6.8 - Math.sin(u * Math.PI) * .8, -3.4, 11.2 + Math.sin(u * Math.PI) * 2.6, 'root'] }),   // turn the blade over
      tick: (n, u) => { n.items[1].flip = ease(u) * Math.PI; if (cue(n, u, .55)) tsfx(TWN_SFX.tick, ANVIL.x, ANVIL.y, { pitch: 1.6 }); } },
    hammerStep(TAP, .46, .55), hammerStep(TAP, .46, .55), hammerStep(TAP, .46, .55),
    { d: .1, go: FORGE.Q, sp: 26, enter: n => { n.items[1].to = null; } },
    { d: 2.6, face: Math.PI * .75, turn: 9,   // quench: in with a hiss and a cloud of steam, hold it, lift it to the light
      ik: (n, u) => ({ L: u < .22 ? [7, -2.6, 17, 'root'] : u < .72 ? [9.4, -1.6, 7.6, 'root'] : [7.2, -1.8, 20.5, 'root'], R: u > .72 ? [6, 2.5, 13, 'root', .6] : null }),
      rig: (n, u) => ({ expr: u > .74 ? 'smile' : null }),
      enter: n => { n.items[1].to = [12.5, -1.2, 11]; },
      tick: (n, u, dt) => {
        const it = n.items[1]; it.to = u < .22 ? [12.5, -1.2, 11] : u < .72 ? [12.5, -.8, 1.5] : [11, -1.4, 27];
        if (cue(n, u, .27)) { const q = ED.L.quench, x = QUENCH.x, y = QUENCH.y, hot = TWN.heat;
          for (let i = 0; i < 8 + hot * 10; i++) P.add({ kind: 'smoke', x: x + (Math.random() - .5) * 8, y: y + (Math.random() - .5) * 8, z: 13 + Math.random() * 3, vx: (Math.random() - .5) * 14, vy: (Math.random() - .5) * 14, vz: 26 + Math.random() * 26, g: -8, drag: 2.2, max: .9 + Math.random() * .8, size: 2.6 + Math.random() * 2, color: '#e8e8f0', dark: '#b0b0c0', light: '#ffffff' });
          P.sparks(x, y, 14, 4, null, { color: '#ffd070' }); tsfx(TWN_SFX.hiss, x, y, { vol: .5 + hot * .5 }); if (q) for (let i = 0; i < 3; i++) q.ripples.push({ t: -i * .15, dx: (Math.random() - .5) * 5, dy: (Math.random() - .5) * 3 }); TWN.heat = 0; }
        if (u > .27 && u < .7 && Math.random() < dt * 9) P.add({ kind: 'smoke', x: QUENCH.x + (Math.random() - .5) * 6, y: QUENCH.y + (Math.random() - .5) * 6, z: 14, vz: 18 + Math.random() * 10, g: -6, drag: 2, max: .8, size: 2, color: '#e0e0ec', dark: '#a8a8b8', light: '#ffffff' });
      } },
    { d: 1.7, face: Math.PI * .6, turn: 5,   // wipe the brow with the back of the hammer hand, a drop of sweat flies
      ik: (n, u) => ({ R: u < .15 ? [3.5, 4.5, 24, 'root', u / .15] : u < .7 ? [4.3, 4 - (u - .15) / .55 * 7.5, 27.4, 'root'] : [4, -2.5, 25, 'root', 1 - (u - .7) / .3], L: [3, -4.6, 13, 'root', .7] }),
      rig: (n, u) => ({ expr: u > .2 && u < .75 ? 'wince' : null }),
      tick: (n, u) => { if (cue(n, u, .62)) { const [x, y, z] = n.rig.head(); P.add({ kind: 'bit', x, y, z: z + 1, vx: Math.cos(n.facing + 1.6) * 30, vy: Math.sin(n.facing + 1.6) * 30, vz: 50, g: 300, max: .7, size: 1, color: '#bfe8ff' }); P.add({ kind: 'dust', x, y, z: z - 2, vz: 6, max: .6, size: 1.6, color: '#d8d8e8' }); } } },
    { d: 1.8, face: Math.PI * .45, rig: { pose: 'hips', expr: 'smile' }, enter: n => n.rig.kick(2) }
  ],
  hi: ['Mind the sparks!', 'Oi, delver!', 'Back in one piece?', 'Anvil\'s hot!'],
  bye: ['Don\'t dull it on the first skull.', 'Go on, then.', 'Bring it back in one piece.'],
  intro: 'Harrow. I keep the forge. You keep bleeding on my good steel, and I keep fixing it.',
  lines: ['Steel remembers every blow. So do I. Bring me whatever the deep has been chewing on.',
    'Hot iron, cold ale and a customer who pays. That is the whole of my religion.',
    'You swing like a man chopping onions. Hand it here before you lose a finger.',
    'This forge has not gone out in forty winters. Neither has my temper.',
    'Found something that glows? Let me hit it until it glows properly.',
    'If it cracked, I can mend it. If it bit you, I can make it sharper.',
    'Mind where you stand. The last fellow who stood there still has no eyebrows.'],
  extra: (n, h) => h && h.maxDepth >= 5 ? 'Depth ' + h.maxDepth + ', is it? Then you need better than tin. Let me see that blade.' : null
});
function harrowBeard(g, rig, ox, oy, view, n) {
  // a big ginger beard and moustache, painted over the jaw when the face is toward the camera
  const J = rig.J, R = rig.o.headR, H = J.head, v = view.id === 'portrait' ? view : rig._lastView || view, P = (f, r, z) => { const w = rig._w([H[0] + f * R, H[1] + r * R, H[2] + z * R]), q = v.p(w[0], w[1], w[2]); return [ox + q[0], oy + q[1]]; };
  const c0 = rig._w(H), c1 = rig._w([H[0] + R, H[1], H[2]]); if (v.depth(c1[0], c1[1], c1[2]) < v.depth(c0[0], c0[1], c0[2]) - .1) return;
  const ht = E.tones(rig.C.hair), pts = [P(.75, -.72, -.05), P(.7, -.8, -.55), P(.62, -.45, -1.12), P(.72, 0, -1.3), P(.62, .45, -1.12), P(.7, .8, -.55), P(.75, .72, -.05), P(.96, 0, -.3)];
  px.poly(g, pts, ht.sh); px.poly(g, pts.slice(1, 6).concat([P(.95, 0, -.55)]).map(p => [p[0] - .4, p[1] - .6]), ht.base);
  const m0 = P(1, -.42, -.35), m1 = P(1, .42, -.35), mm = P(1.02, 0, -.28); px.line(g, m0[0], m0[1], mm[0], mm[1], ht.deep); px.line(g, mm[0], mm[1], m1[0], m1[1], ht.deep);
  const ch = P(.8, -.1, -1.05); px.dot(g, ch[0], ch[1], ht.lt);
}
const ease = u => u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;

/* =============================================================================
 * SEREN, the mystic: floats cross-legged over her rug reading a book that turns its own pages; rises, channels (runes
 * gather and orbit her, faster and tighter), bursts into light, and settles back to her reading
 * ============================================================================= */
const SEREN_AT = [636, 152];
/** a few runes as strokes on a 4 x 5 grid (drawn at any zoom) */
const RUNE_STROKES = [[[2, 0, 2, 5], [2, 2, 0, 0], [2, 2, 4, 0]], [[1, 0, 1, 5], [1, 1, 4, 0], [1, 3, 4, 2]], [[2, 0, 4, 2], [4, 2, 2, 4], [2, 4, 0, 2], [0, 2, 2, 0], [1, 3, 0, 5], [3, 3, 4, 5]],
  [[2, 0, 2, 5], [0, 2, 2, 0], [4, 2, 2, 0]], [[1, 0, 1, 5], [1, 0, 3, 1], [3, 1, 1, 2.5], [1, 2.5, 4, 5]], [[0, 0, 4, 5], [4, 0, 0, 5]]];
function drawRune(g, x, y, k, s, c, hot) {
  const R = RUNE_STROKES[k % RUNE_STROKES.length], sc = Math.max(1, s * .75);
  for (const [a, b, c2, d] of R) px.line(g, x + (a - 2) * sc, y + (b - 2.5) * sc, x + (c2 - 2) * sc, y + (d - 2.5) * sc, c);
  px.dot(g, x, y, hot);
}
function drawBook(g, r, x, y, z, open, flip, alpha, t) {
  if (alpha <= .05) return;
  const [cx, cy] = r.w(x, y, z), s = r.view.scale, w = 5.5 * s, h = 4 * s, lift = (1 - open) * 1;
  px.blend(g, alpha, 'normal', () => {
    px.poly(g, [[cx - w - 1, cy + 1], [cx, cy + 2.5 * s], [cx + w + 1, cy + 1], [cx + w + 1, cy - h + 1], [cx, cy - h * .6], [cx - w - 1, cy - h + 1]], '#6a2438');   // the cover
    const pw = w * (.35 + .65 * open);
    px.poly(g, [[cx - pw, cy], [cx, cy + 1.5 * s], [cx, cy - h * .7 - lift], [cx - pw, cy - h]], '#f0e4c8'); px.poly(g, [[cx + pw, cy], [cx, cy + 1.5 * s], [cx, cy - h * .7 - lift], [cx + pw, cy - h]], '#e4d4b4');
    for (let i = 1; i < 4; i++) { const yy = cy - h + i * h * .22; px.line(g, cx - pw * .85, yy, cx - pw * .2, yy + s * .3, i === 2 ? '#8a5ad8' : '#b0a080'); px.line(g, cx + pw * .2, yy + s * .3, cx + pw * .85, yy, '#b0a080'); }
    if (flip > 0 && flip < 1 && open > .8) { const fx = Math.cos(flip * Math.PI) * pw, up = Math.sin(flip * Math.PI) * 2.2 * s; px.poly(g, [[cx, cy + 1.5 * s], [cx + fx, cy - up * .5], [cx + fx, cy - h - up], [cx, cy - h * .7]], '#fff8e8'); }
    px.line(g, cx, cy + 1.5 * s, cx, cy - h * .7, '#8a6a4a');
  });
}
townNPC('seren', {
  name: 'SEREN', title: 'Mystic', service: 'mystic', at: SEREN_AT, facing: Math.PI / 4, talkR: 34, voice: 1.5, greetPose: null,
  rig: { build: 'heroic', size: 1, weapon: 'staff', outfit: 'robe', sleeves: 'long', hair: 'long', hat: { style: 'pointed', color: '#3a2a6e' }, cape: { len: 5, width: 5, seg: 2.2 }, face: { eyes: 'big', bangs: .55 },
    colors: { skin: '#f2d8cc', hair: '#e4e2f2', cloth: '#4a3a8a', trim: '#e8c860', belt: '#e8c860', pants: '#3a2e6a', boot: '#2a2040', cape: '#2a2058', capeIn: '#8a6ae0', staff: '#5a3a2a', orb: '#b890ff', eye: '#3a2a6a', iris: '#8a5ad8' } },
  hover: n => n.hov === undefined ? 7 : n.hov,
  talk: [null, 'cast', null, 'hips'],
  idle(n, dt) {
    n.book = n.book || { open: 1, alpha: 1, flip: -1 }; n.runes = n.runes || { n: 0, R: 20, sp: 1.2, a: 0, fly: 0, glow: 0 };
    const q = n.runes; q.a += q.sp * dt; if (q.fly > 0) { q.fly += dt * 1.6; if (q.fly > 1) { q.fly = 0; q.n = 0; } }
    n.flash = Math.max(0, (n.flash || 0) - dt * 1.4);
    if (q.n > 0 && Math.random() < dt * q.n * 1.5) P.glints(n.x + (Math.random() - .5) * 20, n.y + (Math.random() - .5) * 20, n.z + 8 + Math.random() * 16, 1, '#e0c8ff', 4);
    n.rig.C.orb = q.glow > .5 ? '#f0e0ff' : '#b890ff';
  },
  steps: [
    { d: 6, go: SEREN_AT, face: Math.PI / 4, sp: 16, turn: 3,   // read: kneeling on the air, the book floating before her, a page every 1.8 s
      rig: { pose: 'kneel' }, z: n => (n.hov = approach(n.hov || 7, 7 + Math.sin(n.lt * 1.6) * 1.5, .5)),
      ik: (n, u) => ({ L: [4.4, -3.6, -5.2 + Math.sin(n.lt * 1.6) * .4, 'sh'], R: [4.2, 3.2, -4.8 + Math.sin(n.lt * 1.6 + 1) * .4, 'sh', .9] }),
      tick: (n, u, dt) => {
        const b = n.book; b.open = approach(b.open, 1, dt * 2); b.alpha = approach(b.alpha, 1, dt * 2);
        const k = Math.floor(n.sT / 1.8); b.flip = (n.sT % 1.8) < .6 ? (n.sT % 1.8) / .6 : -1;
        if (cue(n, n.sT % 1.8, .05, 'pg' + k)) { tsfx(TWN_SFX.page, n.x, n.y, { vol: .8 }); const [bx, by] = bookAt(n); for (let i = 0; i < 3; i++) P.add({ kind: 'glint', x: bx, y: by, z: n.z + 18, vx: (Math.random() - .5) * 6, vy: (Math.random() - .5) * 6, vz: 10 + Math.random() * 8, max: .8, size: 1, color: '#d8c0ff' }); }
      } },
    { d: 1.4, face: Math.PI / 4, z: (n, u) => (n.hov = 7 + E.ease.inOut(u) * 6), rig: (n, u) => ({ pose: u < .35 ? 'kneel' : null }),   // rise: the book shuts and fades
      tick: (n, u, dt) => { const b = n.book; b.open = approach(b.open, 0, dt * 3); b.alpha = approach(b.alpha, 0, dt * 1.2); b.flip = -1; } },
    { d: 4.4, face: Math.PI / 4, z: n => (n.hov = 13 + Math.sin(n.lt * 2.2) * 1.2), rig: (n, u) => ({ pose: 'cast', expr: u > .6 ? 'shout' : null }),   // channel: runes gather, orbit faster and tighter
      enter: n => tsfx(TWN_SFX.hum, n.x, n.y, { vol: .9 }),
      tick: (n, u) => { const q = n.runes; q.n = Math.min(6, Math.floor(u * 9) + 1); q.R = 20 - u * 8; q.sp = 1.2 + u * 4.2; q.glow = u; if (cue(n, u, .5)) tsfx(TWN_SFX.hum, n.x, n.y, { vol: .8, pitch: 1.5 }); } },
    { d: 1.3, face: Math.PI / 4, z: (n, u) => (n.hov = 13 + Math.sin(u * Math.PI) * 3), rig: (n, u) => ({ pose: u < .7 ? 'cheer' : null, expr: 'smile' }),   // burst
      tick: (n, u) => { if (cue(n, u, .1)) {
        const q = n.runes; q.fly = .01; q.glow = 1; n.flash = 1; n.rig.kick(4);
        P.ring(n.x, n.y, 4, 46, '#c8a0ff', .6); P.ring(n.x, n.y, 2, 28, '#ffffff', .35); P.glints(n.x, n.y, n.z + 18, 22, '#e8d8ff', 30);
        for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; P.add({ kind: 'spark', x: n.x, y: n.y, z: n.z + 16, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, vz: 30 + Math.random() * 40, g: 120, drag: 3, max: .5, color: '#b890ff', hot: '#ffffff' }); }
        tsfx(TWN_SFX.burst, n.x, n.y); const h = ED.hero; if (h && Math.hypot(h.x - n.x, h.y - n.y) < 120) game.flash('#c8a0ff', .08, .18);
      } } },
    { d: 1.9, face: Math.PI / 4, z: (n, u) => (n.hov = 13 - E.ease.inOut(u) * 6), rig: (n, u) => ({ pose: u > .35 ? 'kneel' : null }),   // settle, the book comes back
      tick: (n, u, dt) => { const b = n.book, q = n.runes; q.glow = approach(q.glow, 0, dt); if (u > .4) { b.alpha = approach(b.alpha, 1, dt * 1.5); b.open = approach(b.open, 1, dt * 1.2); } } }
  ],
  after(n, r) {
    const t = game.time, q = n.runes || { n: 0 }, b = n.book;
    if (b && b.alpha > .05) { const [bx, by] = bookAt(n), bz = n.z + 13 + Math.sin(t * 2) * .8; r.queue(bx, by, 0, g => drawBook(g, r, bx, by, bz, b.open, b.flip, b.alpha, t)); glowAt(r, bx, by, bz, 9, .6 * b.alpha, '#e8d8ff'); }
    if (q.n > 0) for (let i = 0; i < q.n; i++) {   // the orbiting runes, each sorted in the world with her
      const a = q.a + i * TAU / 6, R = q.R * (1 + q.fly * 2.5), x = n.x + Math.cos(a) * R, y = n.y + Math.sin(a) * R, z = n.z + 12 + Math.sin(a * 2 + t) * 2 + q.fly * 10, k = i;
      r.queue(x, y, 0, g => { const [sx, sy] = r.w(x, y, z), s = r.view.scale; px.blend(g, 1 - q.fly, 'normal', () => { r.glowDisc(g, sx, sy, 2.6 * s, '#8a5ad8', .22); drawRune(g, sx, sy, k, s * 1.25, q.glow > .6 ? '#f0e4ff' : '#c8a0ff', '#ffffff'); }); });
    }
    if (q.n > 0) r.decal(() => { const R = 14 + (q.glow || 0) * 4; r.groundRing(n.x, n.y, R, '#b890ff', .35 + q.glow * .4); r.groundRing(n.x, n.y, R * .7, '#e0c8ff', .25 + q.glow * .3); });
    L.add(n.x, n.y, n.z + 14, 44 + (n.flash || 0) * 90 + q.n * 4, .35 + (n.flash || 0) * 1 + (q.glow || 0) * .25, { color: '#b890ff' });
    glowAt(r, n.x, n.y, n.z + 14, 13, .35 + (q.glow || 0) * .5, '#c8a0ff');
  },
  hi: ['The stars whisper...', 'Ah. You again.', 'Hmm. Curious.', 'Mind the candles, dear.'],
  bye: ['The stars will be watching.', 'Go gently, dear.', 'Come back stranger.'],
  intro: 'I am Seren. I read the stars, the stones and, on slow evenings, other people\'s letters.',
  lines: ['The stars are loud tonight. They say you should buy something. I did not argue with them.',
    'Every stone you carry up from the deep hums a little song. Let me listen to yours.',
    'I read your fortune in the tea leaves. It said "more tea". The leaves are rarely wrong.',
    'Magic is only patience that learned to glow.',
    'Hold still. There is a thread of fate on your shoulder... no. It is lint.',
    'The deep dreams of the surface, you know. Try not to wake it too rudely.',
    'Bring me the strange things. The stranger, the sweeter.'],
  extra: (n, h) => h && h.level >= 5 ? 'Level ' + h.level + '. Your aura has grown a whole shade brighter. It suits you.' : null
});
const bookAt = n => [n.x + Math.cos(n.facing) * 8, n.y + Math.sin(n.facing) * 8];

/* =============================================================================
 * COBB, the merchant: counts his coins behind the counter, calls out to passers-by, fetches his broom and sweeps the
 * lane, puts it back, and surveys his kingdom with his hands on his hips. A customer at the counter comes first: he
 * leans the broom back on the crates, bustles along the counter to wherever the hero stands, and counts coins there,
 * facing him, until he leaves. His lane runs in front of the awning's valance (y 117 to 123), so he never stands
 * under the canvas, and two lanterns hang from it to light him
 * ============================================================================= */
const COBB_AT = [404, 120], BROOM_AT = [478, 126], BROOM_PICK = [469, 121], COBB_LANE = 121;
/** where Cobb stands to take the broom: by the crates, or beside the spot on the counter he propped it */
const broomPick = () => { const b = ED.L.broomAt; return b ? [b[0] - 8, COBB_LANE] : BROOM_PICK; };
const sweepIK = (n, sw) => { const B = [7.5, sw, .6], T = [-.5, 6.5, 19]; n.items[0].at = B; return { L: V3.lerp(B, T, .74).concat('root'), R: V3.lerp(B, T, .44).concat('root') }; };
/** the hero is at the counter: in front of it (the counter row is y 128 to 144), within ~64 of its front and its ends */
function cobbCustomer(n, dt) {
  const h = ED.hero; if (!h || !h.alive) return null;
  const m = n.serving ? 14 : 0, at = h.y > COUNTER.y + 12 - m && h.y < COUNTER.y + 16 + 64 + m && h.x > COUNTER.x0 - 22 - m && h.x < COUNTER.x1 + 22 + m;
  n.custT = at ? 0 : (n.custT || 0) + dt;   // he lingers a second after the hero steps away
  return at || (n.serving && n.custT < 1) ? h : null;
}
/** walk n toward (x, y) at speed sp; true once there */
function stepTo(n, x, y, sp, dt) {
  const dx = x - n.x, dy = y - n.y, d = Math.hypot(dx, dy); if (d < 1.5) { n.vx = n.vy = 0; return true; }
  n.vx = dx / d * Math.min(sp, d * 4); n.vy = dy / d * Math.min(sp, d * 4); n.facing = E.approachAng(n.facing, Math.atan2(dy, dx), dt * 9); return false;
}
function cobbServe(n, dt, rs, h) {
  const L0 = ED.L;
  if (!n.serving) { n.serving = true; n.sT = undefined; n.svT = 0; n.svX = null; n.items = []; setIK(n, null, dt); }
  if (L0.broomHeld) {   // a customer! the broom is propped on the counter right where he stands (no trip to the crates)
    n.items = n.items.length ? n.items : [{ kind: 'broom', at: [7.5, 0, .6] }]; n.vx = n.vy = 0; n.svT += dt;
    n.facing = E.approachAng(n.facing, Math.PI / 2, dt * 10);
    if (n.svT < .22) setIK(n, sweepIK(n, 0), dt); else { L0.broomHeld = false; L0.broomAt = [n.x + 3, n.y + 4]; n.items = []; setIK(n, null, dt); n.svT = 0; tsfx(TWN_SFX.tick, n.x, n.y, { pitch: .8 }); }
    return;
  }
  // to the stretch of counter nearest the hero (re-aimed only when he moves well along it, so Cobb does not jitter)
  const want = clamp(h.x, COUNTER.x0 + 7, COUNTER.x1 - 4); if (n.svX === null || Math.abs(want - n.svX) > 14) n.svX = want;
  if (!stepTo(n, n.svX, COBB_LANE, 40, dt)) { rs.expr = 'smile'; n.items = []; setIK(n, null, dt); return; }
  n.facing = E.approachAng(n.facing, angTo(n, h), dt * 7); n.svT += dt;
  if (!n.items.length) n.items = [{ kind: 'coins', flip: -1 }];   // then he counts, a coin flipping hand to hand, an eye on his customer
  const k = Math.floor(n.svT / .55); n.items[0].flip = (n.svT % .55) / .45;
  setIK(n, { L: [4.6, -2.4, -6.2, 'sh'], R: [4.6, 2.4, -6.4 + Math.max(0, Math.sin(n.svT / .55 * TAU)) * .8, 'sh'] }, dt); rs.expr = 'smile';
  if (cue(n, n.svT % .55, .45, 'svc' + k)) { tsfx(TWN_SFX.tink, n.x, n.y, { pitch: 1 + (k % 3) * .12 }); n.rig.kick(1.2); }
}
townNPC('cobb', {
  name: 'COBB', title: 'Merchant', service: 'vendor', at: COBB_AT, facing: Math.PI / 2 - .3, talkR: 40, voice: 1.2, greetPose: 'hips',
  rig: { size: .95, weapon: null, outfit: 'coat', sleeves: 'long', hair: 'short', hat: { style: 'cap', color: '#b8402a' }, face: { eyes: 'big', bangs: .8 },
    colors: { skin: '#f0c49a', hair: '#6a3a1e', cloth: '#3a6a4a', coat: '#3a6a4a', trim: '#e8c860', pants: '#5a4030', boot: '#3a2a1a', belt: '#e8c860', eye: '#2a2a3a', iris: '#4a6a3a' } },
  items: () => [{ kind: 'coins', flip: -1 }],
  talk: ['hips', null, 'cast', 'hips'],
  work(n, dt, rs) {   // a customer first; otherwise the loop (from its start, the counting, once the customer has gone)
    const c = cobbCustomer(n, dt); if (c) { cobbServe(n, dt, rs, c); return; }
    if (n.serving) { n.serving = false; n.k = 0; n.sT = undefined; }
    runSteps(n, dt, rs, n.S.steps);
  },
  steps: [
    { d: 4.4, go: COBB_AT, face: Math.PI / 2 - .3, sp: 22,   // count the takings: a coin flips from hand to hand, a nod for each
      enter: n => { n.items = [{ kind: 'coins', flip: -1 }]; },
      ik: (n, u) => ({ L: [4.6, -2.4, -6.2, 'sh'], R: [4.6, 2.4, -6.4 + Math.max(0, Math.sin(n.sT / .55 * TAU)) * .8, 'sh'] }),
      rig: { expr: 'smile' },
      tick: (n, u) => { const k = Math.floor(n.sT / .55); n.items[0].flip = (n.sT % .55) / .45; if (cue(n, n.sT % .55, .45, 'coin' + k)) { tsfx(TWN_SFX.tink, n.x, n.y, { pitch: 1 + (k % 3) * .12 }); n.rig.kick(1.2); } } },
    { d: 2.4, face: 'hero', skip: n => { const h = ED.hero; return !h || Math.hypot(h.x - n.x, h.y - n.y) > 210 || Math.hypot(h.x - n.x, h.y - n.y) < 40; },   // call out to the hero
      enter: n => { n.items = []; },
      rig: (n, u) => ({ pose: 'hips', expr: u > .08 && u < .7 ? 'shout' : 'smile' }), ik: (n, u) => ({ R: [3.2, 1.4, 4.4, 'sh', u < .75 ? 1 : 0] }),
      tick: (n, u) => { if (cue(n, u, .08)) { say(n, COBB_CALLS[Math.floor(Math.random() * COBB_CALLS.length)], 2.2); for (let i = 0; i < 3; i++) game.after(i * .07, () => tsfx(TWN_SFX.blip, n.x, n.y, { pitch: 1.2 + Math.random() * .4 })); } } },
    { d: .1, go: () => broomPick(), sp: 24, enter: n => { n.items = []; } },
    { d: .8, face: n => ang(n, ED.L.broomAt || BROOM_AT), rig: (n, u) => ({ pose: u > .15 && u < .7 ? 'crouch' : null }),   // pick up the broom (from the crates, or the counter if a customer came)
      tick: (n, u) => { if (cue(n, u, .45)) { ED.L.broomHeld = true; ED.L.broomAt = null; n.items = [{ kind: 'broom', at: [7.5, 0, .6] }]; } } },
    { d: 1, go: [372, COBB_LANE - 1], sp: 13, walkWork: true,   // sweep the lane, dust puffing at every stroke
      ik: n => sweepIK(n, Math.sin(n.sT * 5) * 3.2),
      tick: (n, u) => { if (cue(n, (n.sT * 5 / Math.PI) % 1, .5, 'sw' + Math.floor(n.sT * 5 / Math.PI))) { const b = rigWorld(n.rig, n.items[0].at); P.dust(b[0], b[1], 0, 2, { speed: 18, color: '#a89880' }); tsfx(TWN_SFX.sweep, n.x, n.y); } } },
    { d: 1, go: [436, COBB_LANE], sp: 13, walkWork: true, ik: n => sweepIK(n, Math.sin(n.sT * 5) * 3.2),
      tick: (n, u) => { if (cue(n, (n.sT * 5 / Math.PI) % 1, .5, 'sw' + Math.floor(n.sT * 5 / Math.PI))) { const b = rigWorld(n.rig, n.items[0].at); P.dust(b[0], b[1], 0, 2, { speed: 18, color: '#a89880' }); tsfx(TWN_SFX.sweep, n.x, n.y); } } },
    { d: .1, go: BROOM_PICK, sp: 24, ik: n => sweepIK(n, 0) },
    { d: .8, face: BROOM_AT, rig: (n, u) => ({ pose: u > .15 && u < .7 ? 'crouch' : null }), ik: (n, u) => u < .45 ? sweepIK(n, 0) : null,   // lean it back on the crates
      tick: (n, u) => { if (cue(n, u, .45)) { ED.L.broomHeld = false; n.items = []; } } },
    { d: 2.6, go: COBB_AT, sp: 22, face: (n, u) => Math.PI / 2 - .3 + Math.sin(u * TAU) * .7, turn: 4, rig: { pose: 'hips', expr: 'smile' } }   // survey the plaza
  ],
  bye: ['Pleasure doing business!', 'Come back soon!', 'Mind the change!', 'Tell your friends!'],
  hi: ['Welcome, welcome!', 'Customer!', 'Ooh, shiny boots!', 'Back again? Excellent!'],
  intro: 'Cobb\'s Goods, and I am Cobb! Honest trade since... this morning. But honestly!',
  lines: ['Welcome, welcome! Everything is on sale, and the sale is also on sale.',
    'Potions, rope, bandages and a very nice hat. Nobody ever buys the hat. Nobody.',
    'You look like someone who needs more bags. Everybody who goes down there needs more bags.',
    'I buy junk, I sell treasure, and some days I forget which pile is which.',
    'Gold spends the same down there as up here. That is to say, not at all. Spend it here!',
    'My prices are fair! Fair as in fairly high, but fair!',
    'If a monster offers you a better deal, it is a trap. Probably. Come back and tell me.'],
  extra: (n, h) => h && h.gold > 500 ? 'Is that ' + fmt(Math.floor(h.gold)) + ' gold I hear jingling? Music to my ears. Pure music.' : null
});
const COBB_CALLS = ['Potions! Fresh potions!', 'Bargains, delver!', 'Rope! Never too much rope!', 'Best prices in Emberhold!', 'Only prices in Emberhold!', 'Psst! Shiny things!'];

/* =============================================================================
 * ILSA, the waykeeper: stands guard by the waystone with her lantern raised, walks a slow round to look toward the
 * gate, then sets the lantern down and kneels at the stone with her sword planted (the stone brightens as she prays),
 * rises and salutes it. She kneels on the stone's north-east side, so the camera (from the south-east) sees her in
 * profile: the planted blade, her joined hands and the lantern at her knee all read. Bare-headed, a gold circlet with
 * a waystone chip in it, her blonde ponytail swinging: nothing like Bram's iron hat and halberd
 * ============================================================================= */
const ILSA_AT = [440, 304], ILSA_PRAY = [412, 296];
/** a gold circlet round her brow with a teal gem at the front (the gem brightens as she prays) */
function ilsaCirclet(g, rig, ox, oy, view, n) {
  const J = rig.J, R = rig.o.headR, H = J.head, v = view.id === 'portrait' ? view : rig._lastView || view;
  const W = (f, r, z) => rig._w([H[0] + f * R, H[1] + r * R, H[2] + z * R]), S = w => { const q = v.p(w[0], w[1], w[2]); return [ox + q[0], oy + q[1]]; };
  const c = rig._w(H), dc = v.depth(c[0], c[1], c[2]), c0 = S(c), c1 = S(W(0, 1, 0)), rs = Math.hypot(c1[0] - c0[0], c1[1] - c0[1]), lw = Math.max(1, Math.round(rs * .22));
  let prev = null;
  for (let i = 0; i <= 20; i++) {   // the band: only the arc on the camera's side of the head
    const a = i / 20 * TAU, w = W(Math.cos(a) * 1.02, Math.sin(a) * 1.02, .4), d = v.depth(w[0], w[1], w[2]), p = S(w);
    if (prev && d > dc - .15 && prev.d > dc - .15) { px.line(g, prev.p[0], prev.p[1] + 1, p[0], p[1] + 1, '#8a6a2a', lw); px.line(g, prev.p[0], prev.p[1], p[0], p[1], '#f0cc60', lw); }
    prev = { p, d };
  }
  const gw = W(1.04, 0, .45); if (v.depth(gw[0], gw[1], gw[2]) > dc) { const q = S(gw), k = n.prayK || 0; px.disc(g, q[0], q[1], Math.max(1, rs * .3), '#2a8a8a'); px.dot(g, q[0], q[1], k > .4 ? '#ffffff' : '#8ff0e0'); }
}
townNPC('ilsa', {
  name: 'ILSA', title: 'Waykeeper', service: 'waystone', at: ILSA_AT, facing: Math.PI / 2, talkR: 30, voice: .9, greetPose: null,
  face: ilsaCirclet,
  rig: { build: 'heroic', size: 1.02, weapon: 'sword', bladeLen: 12, armor: true, outfit: 'tunic', hair: 'ponytail', cape: { len: 7, width: 6, seg: 2.5 }, face: { bangs: .45 },
    colors: { cloth: '#3a5a8a', cape: '#2a3a6a', capeIn: '#1a2440', hair: '#c8a060', trim: '#e8c860', skin: '#e8c0a0', pants: '#2e3448', boot: '#3a3040', belt: '#6a4a2a', metal: '#c8d4e4', metalDk: '#6a7a90', hilt: '#e8c860', eye: '#2a2a3a', iris: '#3a6aa8' } },
  items: () => [{ kind: 'lantern', hand: 'L', color: '#8ff0e0' }],
  talk: [null, 'block', null, null],
  idle(n, dt) { if (n.prayK !== undefined) TWN.pray = n.prayK; },
  steps: [
    { d: 4.6, go: ILSA_AT, sp: 22, face: (n, u) => Math.PI / 2 + Math.sin(u * TAU) * .5, turn: 2.5,   // stand guard, lantern raised, looking about
      enter: n => { n.items = [{ kind: 'lantern', hand: 'L', color: '#8ff0e0' }]; n.lanternDown = null; },
      ik: () => ({ L: [4.4, -3.4, -2.6, 'sh'] }) },
    { d: 2.4, go: [430, 356], sp: 20, face: Math.PI / 2 - .2, ik: (n, u) => ({ L: [5.2, -2.2, .8 + Math.sin(u * Math.PI) * 1.2, 'sh'] }) },   // peer toward the gate
    { d: .1, go: ILSA_PRAY, sp: 20 },
    { d: 5.8, face: n => angTo(n, WS), turn: 4,   // kneel: the lantern set down beside her, both hands on the planted sword
      rig: (n, u) => ({ pose: 'kneel', expr: null }),
      ik: (n, u) => u < .12 ? { L: [4, -3.5, -9, 'sh'] } : { L: [4.2, -.6, -5.2, 'sh'], R: [4.2, .6, -6.4, 'sh'] },
      tick: (n, u, dt) => {
        if (cue(n, u, .1)) { const a = n.facing - 1.1; n.lanternDown = [n.x + Math.cos(a) * 7, n.y + Math.sin(a) * 7]; n.items = []; tsfx('chime', n.x, n.y, { vol: .35, pitch: .8 }); }
        if (cue(n, u, .9)) { n.lanternDown = null; n.items = [{ kind: 'lantern', hand: 'L', color: '#8ff0e0' }]; }
        n.bladeDir = [.3, 0, -1]; n.bladeW = approach(n.bladeW || 0, u > .1 && u < .88 ? 1 : 0, dt * 4);
        n.prayK = Math.sin(clamp((u - .12) / .76, 0, 1) * Math.PI);
        if (n.prayK > .3 && Math.random() < dt * 5) P.glints(n.x + (Math.random() - .5) * 8, n.y + (Math.random() - .5) * 8, 10 + Math.random() * 10, 1, '#bff6ff', 4);
      },
      exit: n => { n.prayK = 0; n.bladeW = 0; } },
    { d: 1.6, face: n => angTo(n, WS), rig: (n, u) => ({ pose: u > .2 && u < .85 ? 'block' : null }), ik: () => ({ L: [4.4, -3.4, -4, 'sh', .6] }) }   // rise and salute the stone
  ],
  after(n, r) {
    const t = game.time, fl = .9 + .1 * Math.sin(t * 7) * Math.sin(t * 3.3);
    if (n.lanternDown) { const [x, y] = n.lanternDown; r.queue(x, y, 0, g => { const [lx, ly] = r.w(x, y, 3), s = r.view.scale; px.rect(g, lx - 2.2 * s, ly - 3 * s, 4.4 * s, 1.2 * s, '#2a2430'); px.rect(g, lx - 2 * s, ly - 1.8 * s, 4 * s, 4.4 * s, '#8ff0e0'); px.rect(g, lx - 1.2 * s, ly - 1.2 * s, 1.4 * s, 2.8 * s, '#f0fffc'); px.rect(g, lx - 2.2 * s, ly + 2.4 * s, 4.4 * s, 1.2 * s, '#2a2430'); }); glowAt(r, x, y, 3, 9, 1.1, '#8ff0e0'); L.add(x, y, 4, 46, .7 * fl, { color: '#6fd6cc' }); }
    else if (n.items.length) { const p = rigWorld(n.rig, n.rig.J.handL); glowAt(r, p[0], p[1], p[2] - 4, 9, 1.1, '#8ff0e0'); L.add(p[0], p[1], p[2], 52, .65 * fl, { color: '#6fd6cc' }); }
  },
  hi: ['Light keep you.', 'Welcome home.', 'The stone is warm tonight.'],
  bye: ['Come home safe.', 'The stone will remember.', 'Light keep you.'],
  intro: 'Ilsa, keeper of the waystone. I keep the light; you keep coming back. That is our bargain.',
  lines: ['The waystone remembers every depth you reach. Step close to it when you are ready to go down.',
    'The stone hums lower at every fifth depth. It knows what waits there.',
    'Down there the dark rebuilds itself behind you. Up here, we keep the lamps lit.',
    'Pray? No. I only listen. The stone does most of the talking.',
    'Come home whenever you need to. The waystone always knows the way back.',
    'Every lamp in Emberhold is lit from this stone. Mind you do not let it go out.'],
  extra: (n, h) => h && h.maxDepth > 1 ? 'The stone remembers depth ' + h.maxDepth + '. It will take you there, or anywhere it has kept for you.' : null
});

/* =============================================================================
 * PIP and DUCHESS: a boy chasing a chicken round the plaza. He runs her down, lunges, misses (she bursts away in a flurry
 * of feathers), catches his breath hands on knees, laughs and bounces, and goes again
 * ============================================================================= */
const CHICK = { dk: '#b8a890', base: '#f4efe4', lt: '#ffffff', spec: '#ffffff', eye: '#1a1010', pupil: '#1a1010', ext: '#e8a030' };
function chickenThing() {
  const b = new E.Blob({ R: 3.2, colors: CHICK, feet: true });
  const c = { kind: 'chicken', x: 356, y: 380, z: 0, vz: 0, r: 4, hittable: true, keep: true, rig: b, st: 'peck', t: 1, vx: 0, vy: 0, face: 0, flap: 0, feathers: [],
    onHit(hit) { this.flee(hit.src || ED.hero, 1.4); this.vz = 70; P.bits(this.x, this.y, 6, 5, ['#ffffff', '#f4efe4', '#e8e0d0']); tsfx(TWN_SFX.squawk, this.x, this.y, { pitch: 1.2 }); },
    flee(from, k = 1) { const a = Math.atan2(this.y - from.y, this.x - from.x) + (Math.random() - .5) * 1.2; this.st = 'flee'; this.t = .9 + Math.random() * .5; this.vx = Math.cos(a) * 64 * k; this.vy = Math.sin(a) * 64 * k; this.flap = 1; if (this.z <= 0) this.vz = 30 + Math.random() * 20; },
    update(dt) {
      this.t -= dt; this.flap = Math.max(0, this.flap - dt * 1.4);
      const h = ED.hero; if (h && this.st !== 'flee' && Math.hypot(h.x - this.x, h.y - this.y) < 18 && Math.hypot(h.vx, h.vy) > 30) { this.flee(h, .8); tsfx(TWN_SFX.squawk, this.x, this.y); }
      if (this.st === 'flee') { if (Math.random() < dt * 3) P.add({ kind: 'bit', x: this.x, y: this.y, z: this.z + 5, vx: (Math.random() - .5) * 20, vy: (Math.random() - .5) * 20, vz: 20, g: 30, drag: 3, max: 1.2, size: 1, color: '#ffffff' }); if (this.t <= 0) { this.st = 'peck'; this.t = 1 + Math.random() * 2; } }
      else if (this.t <= 0) { if (this.st === 'peck') { this.st = 'walk'; this.t = 1 + Math.random() * 1.5; const a = Math.random() * TAU; this.vx = Math.cos(a) * 14; this.vy = Math.sin(a) * 14; } else { this.st = 'peck'; this.t = 1.2 + Math.random() * 2; this.vx = this.vy = 0; if (Math.random() < .5) tsfx(TWN_SFX.cluck, this.x, this.y, { vol: .6, pitch: .9 + Math.random() * .3 }); } }
      if (this.st === 'peck') { this.vx *= .8; this.vy *= .8; if (Math.random() < dt * 3) { b.kick(-3); this.peck = .18; } }
      this.peck = Math.max(0, (this.peck || 0) - dt);
      // stay on the plaza, off the waystone, out of benches and lamps
      const dx = this.x - PC.x, dy = this.y - PC.y, d = Math.hypot(dx, dy); if (d > PC.r - 18) { this.vx -= dx / d * 200 * dt; this.vy -= dy / d * 200 * dt; }
      const ws = Math.hypot(this.x - WS.x, this.y - WS.y); if (ws < 26) { this.vx += (this.x - WS.x) / ws * 240 * dt; this.vy += (this.y - WS.y) / ws * 240 * dt; }
      this.x += this.vx * dt; this.y += this.vy * dt; collideUnit(this);
      this.vz -= 300 * dt; this.z = Math.max(0, this.z + this.vz * dt); if (this.z <= 0) this.vz = 0;
      const sp = Math.hypot(this.vx, this.vy); if (sp > 3) this.face = Math.atan2(this.vy, this.vx);
      b.update(dt, { look: [Math.cos(this.face), Math.sin(this.face)], walk: Math.min(1, sp / 20), squash: this.peck > 0 ? .25 : sp > 40 ? -.1 : 0 });
    },
    draw(r) {
      if (!r.visible(this.x, this.y, this.z, 30, 30, 30)) return;
      r.shadow(this.x, this.y, 3.4, .45);
      r.actor(this.x, this.y, this.z, (g, ox, oy) => {
        const v = E.charView(r.view), s = v.scale, R = 3.2, f = this.face, [cx, cy] = v.p(0, 0, R), bx = ox + cx, by = oy + cy, fwd = v.p(Math.cos(f), Math.sin(f), 0), side = fwd[0] >= 0 ? 1 : -1;
        const tail = [bx - fwd[0] * R * 1.1, by - fwd[1] * R * 1.1 - 1.5 * s];
        px.poly(g, [[tail[0], tail[1] + 2 * s], [tail[0] - side * 2 * s, tail[1] - 3 * s], [tail[0] + side * 1 * s, tail[1] - 1 * s]], '#e8e0d0');   // tail tuft
        b.draw(g, ox, oy, r.view);
        const fl = this.flap > 0 ? Math.sin(game.time * 40) * 2 * s * this.flap : 0;   // wings: flap when she bolts
        for (const sd of [-1, 1]) px.ell(g, bx + sd * R * .9 * s, by + .5 * s - Math.abs(fl) * (this.flap > 0 ? 1 : 0), 1.4 * s + Math.abs(fl) * .4, 1 * s, '#e0d8c8');
        const hx = bx + fwd[0] * R * .85 * s / Math.max(.3, Math.hypot(fwd[0], fwd[1])) * .7, hy = by - R * .5 * s - (this.peck > 0 ? -2 * s : 0);
        px.disc(g, bx + side * .6 * s, by - R * s * .95, Math.max(1, .9 * s), '#d82a2a'); px.disc(g, bx + side * 1.5 * s, by - R * s * .8, Math.max(1, .7 * s), '#e83a3a');   // comb
        px.poly(g, [[hx, hy], [hx + side * 2.4 * s, hy + .6 * s], [hx, hy + 1.2 * s]], '#f0a020'); px.dot(g, hx + side * .6 * s, hy + 1.6 * s, '#d82a2a');   // beak, wattle
      }, { outline: true });
    } };
  return c;
}
townNPC('pip', {
  name: 'PIP', title: 'Troublemaker', at: [330, 360], facing: 0, talkR: 26, voice: 1.8, greetPose: 'cheer',
  rig: { size: .78, weapon: null, outfit: 'tunic', hair: 'spiky', face: { eyes: 'big', bangs: 1 }, colors: { skin: '#f4c8a0', hair: '#8a4a22', cloth: '#e8a83a', trim: '#fff0c0', pants: '#4a5a8a', boot: '#6a4a2a', belt: '#6a3a1e', eye: '#2a2a3a', iris: '#3a7a4a' } },
  talk: ['cheer', null, 'hips', null],
  work(n, dt, rs) {
    const c = ED.L.duchess; if (!c) return;
    pushOut(n);
    n.pip = n.pip || { st: 'chase', t: 3 }; const q = n.pip; q.t -= dt;
    const d = Math.hypot(c.x - n.x, c.y - n.y), toC = Math.atan2(c.y - n.y, c.x - n.x);
    setIK(n, null, dt); n.z = Math.max(0, n.z + (n.vz = (n.vz || 0) - 320 * dt) * dt); if (n.z <= 0) n.vz = 0;
    if (q.st === 'chase') {   // run her down; when close, lunge
      const sp = 58, ws = Math.hypot(n.x - WS.x, n.y - WS.y); let a = toC;
      if (ws < 40) { const aw = Math.atan2(n.y - WS.y, n.x - WS.x), side = E.angDiff(aw, toC) > 0 ? 1 : -1; a = aw + side * Math.PI / 2 * clamp((40 - ws) / 14, .3, 1); }   // round the waystone, never through it
      n.vx = Math.cos(a) * sp; n.vy = Math.sin(a) * sp; n.facing = E.approachAng(n.facing, a, dt * 10); rs.expr = 'smile';
      if (d < 15) { q.st = 'lunge'; q.t = .45; n.vz = 70; c.flee(n, 1.15); tsfx(TWN_SFX.squawk, c.x, c.y); P.bits(c.x, c.y, 6, 6, ['#ffffff', '#f4efe4', '#e8e0d0']); }
      if (q.t < -4) { q.st = 'pant'; q.t = 1.6; }
    } else if (q.st === 'lunge') {   // arms out, a dive, empty hands
      n.vx = Math.cos(n.facing) * 44; n.vy = Math.sin(n.facing) * 44; rs.pose = 'cast'; rs.expr = 'shout';
      if (q.t <= 0) { q.st = 'oops'; q.t = .5; n.rig.kick(-4); P.dust(n.x, n.y, 0, 5, { speed: 30 }); }
    } else if (q.st === 'oops') { n.vx *= .8; n.vy *= .8; rs.pose = 'crouch'; rs.expr = 'wince'; if (q.t <= 0) { q.st = Math.random() < .5 ? 'pant' : 'laugh'; q.t = q.st === 'pant' ? 1.6 : 1.4; } }
    else if (q.st === 'pant') {   // hands on knees, quick breaths
      n.vx = n.vy = 0; rs.pose = 'crouch'; setIK(n, { L: [3, -2.2, 4.4, 'root'], R: [3, 2.2, 4.4, 'root'] }, dt); if (Math.random() < dt * 5) n.rig.kick(1.5);
      if (q.t <= 0) { q.st = 'laugh'; q.t = 1.4; }
    } else if (q.st === 'laugh') {   // a giggle and two bounces, then off again
      n.vx = n.vy = 0; n.facing = E.approachAng(n.facing, toC, dt * 5); rs.pose = 'cheer'; rs.expr = 'shout';
      if (cue(n, 1.4 - q.t, .05, 'lg')) { tsfx(TWN_SFX.giggle, n.x, n.y); if (n.bubbleCd <= 0) { say(n, PIP_SAYS[Math.floor(Math.random() * PIP_SAYS.length)], 1.8); n.bubbleCd = 5; } }
      if (n.z <= 0 && (cue(n, 1.4 - q.t, .15, 'b1') || cue(n, 1.4 - q.t, .75, 'b2'))) n.vz = 60;
      if (q.t <= 0) { q.st = 'chase'; q.t = 3 + Math.random() * 3; }
    }
    rs.z = n.z;
  },
  hi: ['Did you see that?!', 'Hi hi hi!', 'Wanna help?', 'She\'s SO fast!'],
  intro: 'I\'m Pip! That\'s Duchess. She\'s the fastest chicken in the whole world. I\'m second fastest.',
  lines: ['I almost caught her! Almost! She cheats, you know. She has wings.',
    'When I grow up I\'m going down the waystone too! Mum says no. Mum says no to everything.',
    'Did you fight a monster? Was it THIS big? Was it BIGGER?',
    'Harrow says if I touch the anvil again he\'ll turn me into a horseshoe.',
    'Watch this! ...she ran away. Watch again later!',
    'Seren gave me a crystal once. Then she took it back. She said it was hers. It was.'],
  extra: (n, h) => h && h.maxDepth >= 3 ? 'Depth ' + h.maxDepth + '?! That\'s like... ' + h.maxDepth + ' whole depths!' : null
});
/** push a free-roaming NPC out of the town's solid things (but not out of its own body) */
function pushOut(n) { for (const t of ED.L.things) if (t.solid && !t.dead && t.n !== n) { const dx = n.x - t.x, dy = n.y - t.y, d = Math.hypot(dx, dy), m = n.r + t.r; if (d < m && d > .001) { n.x = t.x + dx / d * m; n.y = t.y + dy / d * m; } } }
const PIP_SAYS = ['Hee hee!', 'Almost!', 'Come back, Duchess!', 'So close!', 'Wait up!'];

/* =============================================================================
 * BRAM, the night watch: a stocky guard in a brick-red gambeson and an iron kettle hat, a walrus moustache, a halberd
 * in one fist and a lantern in the other. He walks a lit round of the south and east (the gate, the memorial, the east
 * wall, the tower, the plaza, the garden) and at every stop he peers into the dark with the lantern raised, thumps the
 * halberd down and stands to attention, or stretches and yawns. His route keeps a body's width off every bush and tree
 * ============================================================================= */
const BRAM_ROUTE = [[392, 609, 'attn'], [520, 606], [606, 598, 'look'], [700, 560], [742, 516, 'yawn'], [746, 440], [746, 372, 'look'], [712, 300], [650, 262, 'attn'],
  [612, 330], [560, 420, 'look'], [470, 470], [392, 520], [300, 560], [228, 606, 'look'], [140, 606, 'yawn'], [300, 610]];
/** the carry: halberd upright in the right fist, the lantern low in the left, swinging with his stride */
const bramCarry = (n, lift = 0) => { const sw = Math.sin(n.rig.phase || 0); return { R: [3.2, 4.2, 15 + Math.abs(sw) * .5, 'root'], L: [2 + sw * 1.6 + lift * 4, -4.4 + lift * 1.8, 10.5 + lift * 10, 'root'] }; };
const bramBeat = {
  look: { d: 2.6, face: (n, u) => n.facing0 + Math.sin(u * TAU) * .8, turn: 3, enter: n => { n.facing0 = n.facing; },   // lantern up, peering into the dark
    ik: (n, u) => bramCarry(n, Math.sin(clamp(u / .2, 0, 1) * Math.PI / 2) * (u < .85 ? 1 : (1 - u) / .15)) },
  attn: { d: 2.3, enter: n => n.rig.kick(1.5),   // the halberd thumps down, he stands to attention, then shoulders it again
    ik: (n, u) => ({ R: [1.4, 4.4, 15.5, 'root'], L: [.6, -4.4, 10.5, 'root'] }), rig: (n, u) => ({ expr: u > .15 && u < .8 ? 'angry' : null }),
    tick: (n, u) => { n.grounded = u > .08 && u < .82; if (cue(n, u, .12)) { const b = rigWorld(n.rig, [n.rig.J.handR[0], n.rig.J.handR[1], 0]); P.dust(b[0], b[1], 0, 4, { speed: 22 }); tsfx('thud', n.x, n.y, { vol: .35, pitch: 1.3 }); n.rig.kick(-2); } },
    exit: n => { n.grounded = false; } },
  yawn: { d: 2.4, rig: (n, u) => ({ pose: u > .1 && u < .7 ? 'cheer' : null, expr: u > .15 && u < .6 ? 'shout' : null }), ik: (n, u) => u > .08 && u < .75 ? null : bramCarry(n),   // a stretch, arms, lantern and halberd high
    tick: (n, u) => { if (cue(n, u, .15)) { tsfx(TWN_SFX.yawn, n.x, n.y); if (n.bubbleCd <= 0) { say(n, '*yawn*', 1.6); n.bubbleCd = 4; } } } }
};
/** his kettle hat (a wide iron brim, a riveted dome with a ridge) and a walrus moustache, painted over the head */
function bramKettle(g, rig, ox, oy, view, n) {
  const J = rig.J, R = rig.o.headR, H = J.head, v = view.id === 'portrait' ? view : rig._lastView || view;
  const W = (f, r, z) => rig._w([H[0] + f * R, H[1] + r * R, H[2] + z * R]), S = w => { const q = v.p(w[0], w[1], w[2]); return [ox + q[0], oy + q[1]]; }, D = w => v.depth(w[0], w[1], w[2]);
  const c = rig._w(H), dc = D(c), fr = W(1, 0, 0), faceOn = D(fr) >= dc - .1, c0 = S(c), c1 = S(W(0, 1, 0)), rs = Math.hypot(c1[0] - c0[0], c1[1] - c0[1]);
  const ht = E.tones(rig.C.hair), mt = E.tones('#7a8290');
  if (faceOn) {   // the moustache: two drooping wings under the nose
    for (const sd of [-1, 1]) { const pts = [W(1.02, 0, -.22), W(1, sd * .5, -.3), W(.9, sd * .72, -.72), W(.94, sd * .52, -.62), W(1.04, sd * .12, -.46)].map(S); px.poly(g, pts, ht.sh); px.line(g, pts[0][0], pts[0][1], pts[1][0], pts[1][1], ht.base); }
  }
  // the brim sits high on the brow, so his eyes and moustache show under its front edge
  const rim = [], N = 18; for (let i = 0; i < N; i++) { const a = i / N * TAU; rim.push({ w: W(Math.cos(a) * 1.4, Math.sin(a) * 1.4, .6 - Math.max(0, Math.cos(a)) * .08), a }); }
  px.poly(g, rim.map(p => S(p.w)), mt.sh);                                                    // the brim (underside tone)
  const top = S(W(0, 0, 1)); px.disc(g, top[0], top[1], rs * .82 + .5, mt.deep); px.disc(g, top[0], top[1] + .3, rs * .82 - .3, mt.base);   // the dome
  const hl = S(W(.15, -.3, 1.4)); px.disc(g, hl[0], hl[1], Math.max(.8, rs * .28), mt.lt); px.dot(g, hl[0] - .5, hl[1] - .5, mt.hi);
  const r0 = S(W(-.75, 0, 1.2)), r1 = S(W(0, 0, 1.78)), r2 = S(W(.75, 0, 1.2)); px.line(g, r0[0], r0[1], r1[0], r1[1], mt.lt); px.line(g, r1[0], r1[1], r2[0], r2[1], mt.lt);   // the ridge
  for (let i = 0; i < N; i++) { const a = rim[i], b = rim[(i + 1) % N]; if (D(a.w) >= dc - .2 && D(b.w) >= dc - .2) { const p = S(a.w), q = S(b.w); px.line(g, p[0], p[1], q[0], q[1], mt.lt); px.line(g, p[0], p[1] + 1, q[0], q[1] + 1, mt.deep); } }   // the lit front edge
  for (const a of [.6, -.6]) { const w = W(Math.cos(a) * .8, Math.sin(a) * .8, .72); if (D(w) > dc) { const q = S(w); px.dot(g, q[0], q[1], mt.hi); } }   // rivets
}
townNPC('bram', {
  name: 'BRAM', title: 'Night Watch', at: BRAM_ROUTE[0], facing: 0, talkR: 30, voice: .8, greetPose: null,
  rig: { build: 'bulky', size: 1.04, weapon: null, outfit: 'coat', sleeves: 'long', hair: 'short', face: { bangs: 0 },
    colors: { cloth: '#6a2a24', coat: '#8a3a2a', trim: '#d8b048', skin: '#d8a888', hair: '#5a3a24', pants: '#3e3a44', boot: '#2e2626', belt: '#3a2618', glove: '#6a4a30', eye: '#1a1a24' } },
  items: () => [{ kind: 'halberd', hand: 'R', ground: 0 }, { kind: 'lantern', hand: 'L', color: '#ffd070' }],
  face: bramKettle,
  talk: [null, null, 'hips', null], talkIK: n => bramCarry(n),
  idle(n, dt) { const it = n.items[0]; if (it) it.ground = approach(it.ground || 0, n.grounded && !n.talking ? 1 : 0, dt * 9); },
  steps: BRAM_ROUTE.flatMap(([x, y, beat]) => [{ d: .1, go: [x, y], sp: 24, walkWork: true, ik: n => bramCarry(n) }].concat(beat ? [bramBeat[beat]] : [])),
  after(n, r) {   // the lantern lights his round (warm, where Ilsa's is teal)
    const t = game.time, fl = .9 + .1 * Math.sin(t * 8) * Math.sin(t * 2.9), p = rigWorld(n.rig, n.rig.J.handL);
    glowAt(r, p[0], p[1], p[2] - 4, 9, 1.1, '#ffd070'); L.add(p[0], p[1], p[2], 64, .8 * fl, { color: '#ffb050' });
  },
  hi: ['All quiet.', 'Evening.', 'Move along. Or don\'t.'],
  intro: 'Bram, night watch. I walk the wall. The wall does not walk anywhere, so somebody has to.',
  lines: ['Quiet night. Good. I like quiet. Quiet does not bite.',
    'Walls keep things out. The deep is under us. I try not to think about that.',
    'Sixteen laps of the wall a night. I counted once. Then I stopped counting.',
    'If anything crawls up out of the waystone, I am to shout very loudly. I have been practising.',
    'The lamps stay lit until dawn. That is the whole rule of Emberhold.',
    'This halberd was my father\'s. He never used it either. Proud tradition.',
    'You could help with the rounds, you know. No? Figured.']
});

/* =============================================================================
 * FINCH, the bard: plays his lute on the tavern terrace (notes rise and drift), flourishes, bows to nobody, retunes
 * ============================================================================= */
const FINCH_AT = [160, 172], LUTE_B = [3, 1.8, -7.4], LUTE_N = [4.6, -7.2, -1.6];
const luteIK = (n, strum, hi = 0) => ({ L: V3.lerp(LUTE_B, LUTE_N, .8).concat('sh'), R: [LUTE_B[0] + .9, LUTE_B[1] + .6 + hi * 3, LUTE_B[2] + 1.6 + strum + hi * 8, 'sh'] });
function spawnNote(n, big) {
  const q = n.notes || (n.notes = []), c = ['#fff0a0', '#ffd0e8', '#c8e8ff', '#ffe8c0'][Math.floor(Math.random() * 4)];
  const sd = n.facing + Math.PI / 2 * (Math.random() < .5 ? 1 : -1);
  q.push({ x: n.x + Math.cos(n.facing) * 5 + Math.cos(sd) * 7, y: n.y + Math.sin(n.facing) * 5 + Math.sin(sd) * 7, z: 18, vx: Math.cos(sd) * 6 + 3, vy: Math.sin(sd) * 6 - 3, t: 0, max: 2.2 + Math.random(), c, big });
  const h = ED.hero; if (h && Math.hypot(h.x - n.x, h.y - n.y) < 150) tsfx(TWN_SFX.pluck, n.x, n.y, { vol: .6, pitch: [1, 1.125, 1.26, 1.5, 1.68, 2][Math.floor(Math.random() * 6)] });
}
townNPC('finch', {
  name: 'FINCH', title: 'Bard', at: FINCH_AT, facing: Math.PI / 4, talkR: 30, voice: 1.3, greetPose: null,
  rig: { size: 1, weapon: null, outfit: 'tunic', sleeves: 'long', hair: 'ponytail', hat: { style: 'pointed', color: '#3a7a4a' }, face: { eyes: 'big', bangs: .6 },
    colors: { skin: '#f0c8a8', hair: '#8a4a2a', cloth: '#c8543a', trim: '#f0d070', pants: '#3a3a5a', boot: '#5a3a24', belt: '#f0d070', eye: '#2a2030', iris: '#6a4a2a' } },
  items: () => [{ kind: 'lute', hand: 'R', body: LUTE_B, neck: LUTE_N, rel: 'sh', color: '#c8883a' }],
  talkIK: n => luteIK(n, 0),
  talk: [null, null, 'hips', null],
  idle(n, dt) { const q = n.notes || []; for (let i = q.length - 1; i >= 0; i--) { const o = q[i]; o.t += dt; o.x += o.vx * dt; o.y += o.vy * dt; o.z += 12 * dt; o.vx += Math.sin(o.t * 3 + i) * 10 * dt; if (o.t > o.max) q.splice(i, 1); } },
  steps: [
    { d: 6.4, go: FINCH_AT, face: (n, u) => Math.PI / 4 + Math.sin(n.sT * 1.3) * .18, turn: 3,   // play: strums, a sway, notes on the beat
      ik: n => luteIK(n, Math.abs(Math.sin(n.sT * 7)) * 1.4 - .7), rig: (n, u) => ({ expr: Math.sin(n.sT * .9) > .3 ? 'smile' : null }),
      tick: (n, u) => { const k = Math.floor(n.sT / .6); if (cue(n, n.sT % .6, .02, 'nt' + k)) { spawnNote(n); n.rig.kick(1.2); } } },
    { d: 1.6, face: Math.PI / 4, ik: (n, u) => luteIK(n, 0, Math.sin(clamp(u / .5, 0, 1) * Math.PI)), rig: (n, u) => ({ expr: u < .7 ? 'shout' : 'smile' }),   // the flourish: a big strum, a high note
      tick: (n, u) => { if (cue(n, u, .22)) { spawnNote(n, 1); spawnNote(n, 1); spawnNote(n); n.rig.kick(3); } } },
    { d: 1.5, face: Math.PI / 4, rig: (n, u) => ({ pose: u > .15 && u < .75 ? 'crouch' : null, expr: 'smile' }), ik: n => luteIK(n, 0) },   // a bow to his audience (the cat)
    { d: 2.4, face: Math.PI / 4 - .3, ik: (n, u) => ({ L: V3.lerp(LUTE_B, LUTE_N, .8).concat('sh'), R: V3.add(LUTE_N, [.6, .4, 1 + Math.sin(n.sT * 9) * .4]).concat('sh') }),   // retune: a twist of the pegs, a plink
      tick: (n, u) => { if (cue(n, u, .3) || cue(n, u, .6) || cue(n, u, .85)) tsfx(TWN_SFX.pluck, n.x, n.y, { vol: .4, pitch: .9 + u * .3 }); } }
  ],
  after(n, r) {
    for (const o of n.notes || []) r.queue(o.x, o.y, 0, g => { const [sx, sy] = r.w(o.x, o.y, o.z), u = o.t / o.max; px.blend(g, u < .15 ? u / .15 : 1 - Math.max(0, (u - .6) / .4), 'normal', () => E.font.text(g, '♪', Math.round(sx), Math.round(sy), o.c, { align: 'center', outline: '#2a1a2a', scale: o.big && r.view.scale > 1.6 ? 2 : 1 })); });
  },
  hi: ['A request?', 'La la laaa!', 'Encore? Already?'],
  intro: 'Finch, minstrel of Emberhold! Also its only minstrel, which makes me the best one.',
  lines: ['A song for the delver! Ahem: "Down he went, and down some more..." I am still working on the rhymes.',
    'Every depth deserves a ballad. Tell me yours, and please bring back a good ending.',
    'The tavern pays me in stew. The stew pays me in regret.',
    'Music keeps the lamps warm. That is science.',
    'I only know four chords. The trick is playing them with feeling.',
    'Should you perish gloriously, I shall write you something in a minor key. You are welcome.']
});

/** the cat asleep: a curled loaf with tabby stripes, the tail wrapped round the front, head tucked; awake, the head lifts
 *  and the eyes follow you (painted in the character view, so it reads in every camera) */
function curledCat(g, ox, oy, view, face, awake, look) {
  const v = E.charView(view), s = v.scale, t = game.time, br = Math.sin(t * 1.4) * .25, T0 = E.tones(CAT.base);
  const fwd = v.p(Math.cos(face), Math.sin(face), 0), side = fwd[0] >= 0 ? 1 : -1, [cx, cy] = v.p(0, 0, 2.6), bx = ox + cx, by = oy + cy;
  const rx = 5.4 * s, ry = (2.6 + br * .3) * s;
  px.ell(g, bx, by, rx, ry + .6 * s, T0.sh); px.ell(g, bx - .5, by - .6, rx - 1, ry - .4, T0.base); px.ell(g, bx - s, by - ry * .5, rx * .55, ry * .35, T0.lt);   // the loaf
  for (let k = -1; k <= 1; k++) { const sx = bx + k * 1.8 * s; px.line(g, sx - .6 * s, by - ry + .5, sx + .6 * s, by - .6 * s, T0.deep); }                                // tabby stripes
  const tail = []; for (let i = 0; i <= 8; i++) { const u = i / 8, a = Math.PI * (.1 + u * .85); tail.push([bx - side * Math.cos(a) * rx * 1.02, by + Math.sin(a) * ry * .9 + s]); }   // the tail round the front
  for (let i = 0; i < 8; i++) px.line(g, tail[i][0], tail[i][1], tail[i + 1][0], tail[i + 1][1], i > 5 ? T0.deep : T0.sh, Math.max(1, Math.round(1.6 * s)));
  const lift = awake * 3 * s, hx = bx + side * rx * .72, hy = by - ry * .3 - lift, hr = 2.2 * s;
  px.disc(g, hx, hy, hr + .5, T0.sh); px.disc(g, hx - .4, hy - .4, hr, T0.base);
  for (const e of [-1, 1]) px.poly(g, [[hx + e * hr * .9 - .5 * s, hy - hr * .5], [hx + e * hr * .95, hy - hr * 1.7], [hx + e * hr * .2, hy - hr * .8]], T0.sh);            // ears
  const lx = clamp(v.p(Math.cos(look), Math.sin(look), 0)[0], -1, 1) * .8 * s;
  for (const e of [-1, 1]) { const ex = hx + e * .9 * s + lx, ey = hy; if (awake > .5) { px.rect(g, ex, ey - s * .6, Math.max(1, s * .8), Math.max(1, s * 1.2), '#3a6a2a'); } else px.rect(g, ex - s * .4, ey, Math.max(1, s * 1.1), 1, T0.deep); }
  px.dot(g, hx + lx * .5, hy + s * .9, '#e87a8a');
}
/* ---------- the tavern cat: curled up asleep by the open door; opens one eye if you come close, bolts if you swing at her ---------- */
const CAT = { dk: '#8a5028', base: '#e8a050', lt: '#ffd8a0', spec: '#fff0e0', pupil: '#2a4a1a', inner: '#f8b0b0', ext: '#fff0e0' };
function catThing(x, y) {
  const b = new E.Blob({ R: 4, colors: CAT, ears: 'cat', tail: true, mouth: true });
  return { kind: 'cat', x, y, z: 0, vz: 0, r: 4, hittable: true, keep: true, rig: b, home: [x, y], awake: 0, zzz: 0, run: 0, face: Math.PI * .75,
    onHit() { if (this.run > 0) return; this.run = 1.2; this.vz = 90; const a = Math.random() * TAU; this.vx = Math.cos(a) * 70; this.vy = Math.sin(a) * 70; b.kick(-6); tsfx(TWN_SFX.catHiss, this.x, this.y); P.bits(this.x, this.y, 5, 4, ['#e8a050', '#ffd8a0']); this.bub = { t: 1.2, s: 'HSSS!' }; },
    update(dt) {
      const h = ED.hero, d = h ? Math.hypot(h.x - this.x, h.y - this.y) : 999;
      if (this.bub && (this.bub.t -= dt) <= 0) this.bub = null;
      if (this.run > 0) { this.run -= dt; this.x += this.vx * dt; this.y += this.vy * dt; this.vx *= .96; this.vy *= .96; collideUnit(this); this.face = Math.atan2(this.vy, this.vx); if (this.run <= 0) { this.home = [this.x, this.y]; } }
      else { const wake = d < 30 ? 1 : 0; if (wake && this.awake < .5 && !this.bub) { this.bub = { t: 1.3, s: 'mrrp?' }; tsfx(TWN_SFX.meow, this.x, this.y); } this.awake = approach(this.awake, wake, dt * (wake ? 3 : .4)); }
      this.vz -= 400 * dt; this.z = Math.max(0, this.z + this.vz * dt); if (this.z <= 0) this.vz = 0;
      this.zzz -= dt; if (this.awake < .2 && this.run <= 0 && this.zzz <= 0) { this.zzz = 1.6; (this.zs = this.zs || []).push({ t: 0 }); }
      if (this.zs) for (let i = this.zs.length - 1; i >= 0; i--) if ((this.zs[i].t += dt) > 2) this.zs.splice(i, 1);
      const breathe = Math.sin(game.time * 1.4) * .05, look = this.awake > .5 && h ? [h.x - this.x, h.y - this.y] : [Math.cos(this.face), Math.sin(this.face)];
      b.update(dt, { squash: this.run > 0 ? -.15 : .22 - this.awake * .15 + breathe, squint: this.awake < .5 && this.run <= 0, look, walk: this.run > 0 ? 1 : 0 });
    },
    draw(r) {
      if (!r.visible(this.x, this.y, 0, 30, 40, 30)) return;
      r.shadow(this.x, this.y, 4.5, .45);
      const curled = this.run <= 0 && this.z <= 0, aw = this.awake, h = ED.hero, f = this.face;
      r.actor(this.x, this.y, this.z, (g, ox, oy) => { if (curled) curledCat(g, ox, oy, r.view, f, aw, h ? Math.atan2(h.y - this.y, h.x - this.x) : f); else b.draw(g, ox, oy, r.view); }, { outline: true });
      const x = this.x, y = this.y;
      if (this.zs) for (const zz of this.zs) r.queue(x, y, 0, g => { const u = zz.t / 2, [sx, sy] = r.w(x + 3 + u * 7, y - u * 3, 13 + u * 14); px.blend(g, u < .15 ? u / .15 : 1 - u, 'normal', () => E.font.text(g, u > .5 ? 'Z' : 'z', Math.round(sx + Math.sin(u * 6) * 2), Math.round(sy), '#c8d0ff', { outline: '#1a1428' })); }, { bias: .05 });
      if (this.bub) { const s = this.bub.s; r.overlay(g => { const [sx, sy] = r.w(x, y, 16), w = E.font.width(s, { font: 'tiny' }) + 6; E.ui.box(g, sx - w / 2, sy - 11, w, 9, { bg: '#f0e8d8', border: '#3a2a3a', shadow: false, gradient: false }); E.font.text(g, s, sx, sy - 9, '#2a1a2a', { align: 'center', font: 'tiny', outline: false }); }); }
    } };
}

/* =============================================================================
 * BUILD: TOWN.build() returns Emberhold (the map is built once; things and people fresh on every visit)
 * ============================================================================= */
function buildTown() {
  const M = MAP || buildMap();
  const Lv = { kind: 'town', name: 'Emberhold', depth: 0, w: TW, h: TH, cells: M.cells, tags: M.tags, map: M.map, flow: M.flow, things: [], props: [], torches: [], npcs: [], mechs: [], hue: 0, t: 0,
    runes: [{ x: WS.x, y: WS.y, r: 44 }], rooms: [{ x: 17, y: 13, w: 15, h: 15, cx: 24.5, cy: 20.5 }, { x: 34, y: 13, w: 10, h: 12, cx: 39, cy: 19 }, { x: 16, y: 29, w: 18, h: 7, cx: 25, cy: 32 }],
    seen: new Uint8Array(TW * TH).fill(1), ambient: .22, music: 'town',
    sky: ['#140f2c', '#241a44', '#3e2656', '#6a3458', '#a4505a', '#d8805c'] };
  Lv.waystone = { x: WS.x, y: WS.y }; Lv.portalSpot = { x: WS.x - 54, y: WS.y + 4 }; Lv.start = { x: WS.x, y: WS.y + 36 }; Lv.emberhold = true;
  Lv.randomFloor = (R, o) => randomFloor(Lv, R, o);
  for (const Hs of HOUSES) { if (!Hs.planes) houseParts(Hs); Hs.smoke.length = 0; addThing(Lv, houseThing(Hs)); }
  addThing(Lv, waystoneThing()); addThing(Lv, towerThing()); Lv.drawWaystone = true;
  dressTown(Lv);
  Lv.duchess = addThing(Lv, chickenThing()); addThing(Lv, catThing(98, 144)); Lv.broomHeld = false; Lv.broomAt = null; TWN.pray = 0; TWN.heat = 0;
  for (const id of TWN_NPCS) if (REG.npcs[id]) {
    const n = makeNPC(id); n.items = n.S.items ? n.S.items() : []; hookRig(n); n.k = 0; Lv.npcs.push(n);
    addThing(Lv, { kind: 'npcBody', n, x: n.x, y: n.y, r: 4 * (n.rig.o.size || 1), solid: true, keep: true, update() { this.x = n.x; this.y = n.y; } });   // people are solid: the hero walks round them
  }
  addThing(Lv, ambienceThing());
  Lv.drawBack = r => drawOutskirts(r); Lv.drawUnder = r => drawStars(r); dressOutskirts(Lv);
  return Lv;
}
function houseThing(Hs) {
  return { kind: 'house', x: (Hs.X0 + Hs.X1) / 2, y: (Hs.Y0 + Hs.Y1) / 2, r: 0, keep: true,
    update(dt) { stepSmoke(Hs, dt); },
    draw(r) {
      const v = r.view, t = game.time;
      if (!r.visible(this.x, this.y, 0, 260, 260, 200)) return;
      let fx = Hs.X0 - 5, fy = Hs.Y0 - 5, best = -1e9; for (const [x, y] of [[Hs.X0 - 5, Hs.Y0 - 5], [Hs.X1 + 5, Hs.Y0 - 5], [Hs.X0 - 5, Hs.Y1 + 5], [Hs.X1 + 5, Hs.Y1 + 5]]) { const k = v.fx * x + v.fy * y; if (k > best) { best = k; fx = x; fy = y; } }
      r.queue(fx, fy, 0, g => { drawBaked(Hs, r, g); drawSmoke(g, r, Hs.smoke); }, { bias: .01, occluder: true });
      for (const W0 of Hs.windows) drawWindow(r, Hs, W0, t);
      if (Hs.door) drawDoor(r, Hs, t);
    } };
}
/* ---------- trees: a tapered trunk and a canopy of leaf clumps placed in 3D (sorted, shaded, rim-lit, swaying) ---------- */
function treeThing(x, y, sz, c) {
  const k = Math.floor(x * 7 + y * 3), H = i => hs(k, i), n = 9 + Math.floor(H(0) * 4), C = E.ramp(c, 5, 1.15), top = 26 * sz, cl = [];
  for (let i = 0; i < n; i++) { const a = H(i + 3) * TAU, d = (i ? .35 + H(i + 5) * .65 : 0) * 10 * sz, z = top + (H(i + 7) - .3) * 12 * sz - d * .3; cl.push({ dx: Math.cos(a) * d, dy: Math.sin(a) * d, z, R: (5.5 + H(i + 9) * 3) * sz, ph: H(i) * 6 }); }
  const lean = (H(40) - .5) * 3;
  return { kind: 'tree', x, y, r: 4.5, solid: true, keep: true,
    draw(r) {
      if (!r.visible(x, y, 0, 90, 150, 60)) return;
      const t = game.time, v = r.view, s = v.scale;
      r.queue(x, y, 0, g => {
        const b = W3(r, [x, y, 0]), m = W3(r, [x + lean * .5, y, top * .55]), tp = W3(r, [x + lean, y, top - 4 * sz]), bt = E.tones('#6a4a2e');
        px.ell(g, b[0], b[1], 4.5 * s * sz, 1.6 * s * sz, bt.deep);                                                 // roots
        px.poly(g, [[b[0] - 2.4 * s * sz, b[1]], [b[0] + 2.4 * s * sz, b[1]], [m[0] + 1.6 * s * sz, m[1]], [tp[0] + 1 * s * sz, tp[1]], [tp[0] - 1 * s * sz, tp[1]], [m[0] - 1.6 * s * sz, m[1]]], bt.sh);
        px.line(g, b[0] - 1.2 * s * sz, b[1], m[0] - .9 * s * sz, m[1], bt.base, Math.max(1, Math.round(s * sz)));
        const wind = Math.sin(t * .9 + x) * .8, P0 = cl.map(q => { const sw = Math.sin(t * 1.3 + q.ph) * .5 + wind; const p = W3(r, [x + q.dx + sw + lean, y + q.dy, q.z]); return { q, p, d: v.depth(q.dx, q.dy, q.z) }; }).sort((a, b2) => a.d - b2.d);
        for (const { q, p } of P0) px.disc(g, p[0], p[1], q.R * s + 1, C[0]);                                         // one dark mass
        for (const { q, p } of P0) { const R = q.R * s; px.disc(g, p[0], p[1], R, C[1]); px.disc(g, p[0] - R * .22, p[1] - R * .28, R * .74, C[2]); px.disc(g, p[0] - R * .4, p[1] - R * .45, R * .36, C[3]); }
        for (let i = 0; i < n * 2; i++) { const { q, p } = P0[i % n], R = q.R * s; px.dot(g, p[0] + (H(i + 60) - .5) * R * 1.4, p[1] + (H(i + 80) - .6) * R * 1.2, i % 3 ? C[4] : C[0]); }
      }, { occluder: true });
    } };
}
/* ---------- things that glow (lit, never emissive, so a person in front always covers them) ---------- */
/** an oil street lamp: an iron post, a glass head with a flame, moths that circle it, a pool of warm light */
function lampThing(x, y) {
  return { kind: 'lamp', x, y, r: 3, solid: true, keep: true, ph: hs(x, y) * 9,
    draw(r) {
      if (!r.visible(x, y, 0, 60, 120, 50)) return;
      const t = game.time + this.ph, fl = .9 + .06 * Math.sin(t * 11) + .05 * Math.sin(t * 23);
      r.queue(x, y, 0, g => {
        cyl(r, g, x, y, 0, 3, 3.2, '#3a3a4a', { n: 8, top: '#4a4a5a' }); cyl(r, g, x, y, 3, 40, 1.1, '#2e2e3c', { n: 6, top: null, bands: [8, 30], band: '#4a4a5a' });
        obox(r, g, x, y, 40, 41.5, 3.6, 3.6, Math.PI / 4, '#4a4a5a', '#2a2a36');
        const s = r.view.scale, [hx, hy] = r.w(x, y, 44), lw = Math.max(1, Math.round(s * .7));   // a lantern cage: tapered glass, iron bars, a flame, a peaked cap
        px.poly(g, [[hx - 2.6 * s, hy - 3.2 * s], [hx + 2.6 * s, hy - 3.2 * s], [hx + 1.8 * s, hy + 2.6 * s], [hx - 1.8 * s, hy + 2.6 * s]], fl > .95 ? '#ffe8a0' : '#ffd070');
        px.poly(g, [[hx - 1.2 * s, hy - 2.4 * s], [hx + .4 * s, hy - 2.4 * s], [hx, hy + 1.8 * s], [hx - 1 * s, hy + 1.8 * s]], '#fff6d0');
        flame(g, hx, hy + 1.8 * s, 1.4 * s, 2.8 * s, t, x, '#ffffff', '#fff0a0', '#ffb040');
        for (const k of [-1, 1]) px.line(g, hx + k * 2.6 * s, hy - 3.2 * s, hx + k * 1.8 * s, hy + 2.6 * s, '#2a2430', lw);
        px.rect(g, hx - 2.2 * s, hy + 2.4 * s, 4.4 * s, Math.max(1, s), '#2a2430');
        const [cx, cy] = r.w(x, y, 47.5); px.poly(g, [[cx - 3.6 * s, cy + 1.2 * s], [cx + 3.6 * s, cy + 1.2 * s], [cx, cy - 2 * s]], '#3a3a4a'); px.line(g, cx - 3.6 * s, cy + 1.2 * s, cx, cy - 2 * s, '#5a5a6a'); px.dot(g, cx, cy - 2.6 * s, '#5a5a6a');
        for (let i = 0; i < 2; i++) { const a = t * (2.3 + i) + i * 3, q = W3(r, [x + Math.cos(a) * 6, y + Math.sin(a) * 6, 44 + Math.sin(a * 1.7) * 4]); px.dot(g, q[0], q[1], '#e8e0d0'); }
      });
      glowAt(r, x, y, 44, 12, 1.3, '#ffe0a0'); L.add(x, y, 30, 74, 1 * fl, { color: '#ffc070' });
    } };
}
/** a lantern on an iron bracket out of a wall face (or hung from a post: f = null) */
function lanternThing(x, y, z, f, c = '#ffb040') {
  const n = f ? FN[f] : [0, 0], lx = x + n[0] * 5, ly = y + n[1] * 5;
  return { kind: 'lantern', x: lx, y: ly, r: 0, keep: true, ph: hs(x, z) * 7,
    draw(r) {
      if (!r.visible(lx, ly, z, 40, 60, 40)) return;
      const t = game.time + this.ph, sw = Math.sin(t * 1.9) * .6;
      r.queue(lx, ly, 0, g => {
        if (f) { line3(r, g, [x, y, z + 3], [lx, ly, z + 3], '#2a2430', zw(r)); line3(r, g, [x, y, z - 1], [lx - n[0] * 2, ly - n[1] * 2, z + 3], '#2a2430'); }
        const s = r.view.scale, [ax, ay] = r.w(lx, ly, z + 3), [hx, hy] = r.w(lx + sw * .3, ly, z - 1.5);
        px.line(g, ax, ay, hx, hy - 2.5 * s, '#2a2430');
        px.rect(g, hx - 2 * s, hy - 3 * s, 4 * s, 1.2 * s, '#2a2430'); px.rect(g, hx - 1.8 * s, hy - 1.8 * s, 3.6 * s, 4 * s, c); px.rect(g, hx - 1.2 * s, hy - 1.2 * s, 1.4 * s, 2.6 * s, '#fff0c0');
        px.rect(g, hx - 2 * s, hy + 2.2 * s, 4 * s, 1.2 * s, '#2a2430'); px.rect(g, hx - .4 * s, hy - 1.8 * s, Math.max(1, .8 * s), 4 * s, '#3a2a24');
      });
      glowAt(r, lx, ly, z - 1.5, 9, 1.2, '#ffd08a'); L.add(lx, ly, z, 40, .55 + .08 * Math.sin(t * 7), { color: '#ffa850' });
    } };
}
/** a cluster of crystals growing from the ground, slowly shimmering, each lit by its own glow */
function crystalCluster(x, y, c, sz = 1) {
  const parts = [[0, 0, 1], [-4, 2, .65], [3.5, 3, .55], [1, -3, .5]].map(([dx, dy, k], i) => ({ x: x + dx * sz, y: y + dy * sz, k: k * sz, sp: hs(x + i, y) * TAU }));
  return { kind: 'crystal', x, y, r: 5 * sz, solid: true, keep: true,
    draw(r) {
      if (!r.visible(x, y, 0, 40, 60, 30)) return;
      const t = game.time;
      r.queue(x, y, 0, g => { const [bx, by] = r.w(x, y, 0), s = r.view.scale; px.ell(g, bx, by, 6 * s * sz, 2.4 * s * sz, '#3a3440'); for (const p of parts) crystal(r, g, p.x, p.y, 3 * p.k, 2.4 * p.k, 12 * p.k, 3 * p.k, p.sp + Math.sin(t * .4 + p.sp) * .3, c); });
      glowAt(r, x, y, 7 * sz, 9 * sz, .35 + .1 * Math.sin(t * 1.7 + x), c); L.add(x, y, 6, 30 * sz, .3, { color: c });
    } };
}
/** candles: a stub of wax and a little flame (a cluster shares one light) */
function candles(list, lightK = .5) {
  const cx = list.reduce((a, p) => a + p[0], 0) / list.length, cy = list.reduce((a, p) => a + p[1], 0) / list.length;
  return { kind: 'candles', x: cx, y: cy, r: 0, keep: true,
    draw(r) {
      if (!r.visible(cx, cy, 0, 50, 50, 40)) return;
      const t = game.time;
      for (const [x, y, h = 4] of list) r.queue(x, y, 0, g => { const s = r.view.scale, [bx, by] = r.w(x, y, 0), [tx, ty] = r.w(x, y, h); px.rect(g, tx - s, ty, Math.max(2, 2 * s), by - ty + 1, '#e8dcc0'); px.rect(g, tx + s * .3, ty, Math.max(1, .7 * s), by - ty + 1, '#b8a890'); flame(g, tx, ty, 1.6 * s, 3.4 * s, t, x * .7); });
      glowAt(r, cx, cy, 5, 16, .8, '#ffc070'); L.add(cx, cy, 4, 34, lightK * (.9 + .1 * Math.sin(t * 9 + cx)), { color: '#ffb060' });
    } };
}
/** an iron fire bowl on three legs: coals and a crackling fire */
function fireBowl(x, y) {
  return { kind: 'firebowl', x, y, r: 5, solid: true, keep: true,
    update(dt) { if (Math.random() < dt * 4) P.add({ kind: 'ember', x: x + (Math.random() - .5) * 6, y: y + (Math.random() - .5) * 6, z: 14, vx: (Math.random() - .5) * 10, vy: (Math.random() - .5) * 10, vz: 20 + Math.random() * 25, drag: 1, max: 1 + Math.random(), color: '#ff8a3a' }); },
    draw(r) {
      if (!r.visible(x, y, 0, 50, 60, 40)) return;
      const t = game.time;
      r.queue(x, y, 0, g => {
        for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + .3; line3(r, g, [x + Math.cos(a) * 5, y + Math.sin(a) * 5, 0], [x + Math.cos(a) * 3, y + Math.sin(a) * 3, 9], '#2a2430', zw(r)); }
        cyl(r, g, x, y, 8, 12, 6, '#3a3440', { n: 10, top: '#1a0c08' });
        const [cx, cy] = r.w(x, y, 12), s = r.view.scale; px.ell(g, cx, cy, 4.6 * s, 1.8 * s, '#ff7a2a'); for (let i = -1; i <= 1; i++) px.dot(g, cx + i * 2 * s, cy, '#ffe070');
        for (let i = 0; i < 3; i++) flame(g, cx + (i - 1) * 2.4 * s, cy, 3 * s, (5 + (i & 1) * 2) * s, t, x + i * 2);
      });
      glowAt(r, x, y, 15, 12, .9, '#ffb050'); L.add(x, y, 16, 80, .8 * flicker(t + x), { color: '#ff9a4a' });
    } };
}
/* ---------- ambience: fireflies over the grass, a star-pricked dusk beyond the wall ---------- */
function ambienceThing() {
  return { kind: 'ambience', x: 0, y: 0, r: 0, keep: true,
    update(dt) {
      const h = ED.hero; if (!h) return;
      if (Math.random() < dt * 9) {   // fireflies drift low over grass and hedges near the hero, blinking yellow-green
        const x = h.x + (Math.random() - .5) * 360, y = h.y + (Math.random() - .5) * 300, cx = Math.floor(x / U), cy = Math.floor(y / U);
        if (cx > 0 && cy > 0 && cx < TW - 1 && cy < TH - 1 && !MAP.cells[cy * TW + cx] && MAP.kind[cy * TW + cx] === K.GRASS && Math.hypot(x - PC.x, y - PC.y) > PC.r + 10)
          P.add({ kind: 'ember', x, y, z: 3 + Math.random() * 16, vx: (Math.random() - .5) * 10, vy: (Math.random() - .5) * 10, vz: (Math.random() - .5) * 5, drag: .2, max: 2.5 + Math.random() * 2.5, color: Math.random() < .7 ? '#d8ff6a' : '#fff0a0' });
      }
    } };
}
function drawStars(r) {
  const t = game.real, v = r.view, g = r.ctx, W = r.W, H = r.H;
  for (let i = 0; i < 70; i++) {
    const sx = Math.floor(hs(i, 71) * W), sy = Math.floor(hs(i, 73) * H * .8), q = v.toGround(sx + r.ix, sy + r.iy);
    if (q && outDist(q[0], q[1]) < OUT.fade1) continue;   // only where the sky shows (past the outskirts' fade)
    const tw = Math.sin(t * (1 + hs(i, 5) * 2) + i) > .6, c = hs(i, 9) < .2 ? '#ffe8c0' : '#d8d8ff';
    px.dot(g, sx, sy, tw ? '#ffffff' : c); if (tw && hs(i, 11) < .3) { px.dot(g, sx - 1, sy, c); px.dot(g, sx + 1, sy, c); px.dot(g, sx, sy - 1, c); px.dot(g, sx, sy + 1, c); }
  }
}
/** the forge yard's weapon rack: a slotted base beam, two uprights, a notched crossbar, and three finished swords standing
 *  point-down in the slots, leaning back on the bar: lit and shaded blades with a fuller, a gold guard, a wrapped grip, a pommel */
function weaponRack(r, g, x, y) {
  const wood = E.tones('#7a5232'), zm = zw(r), yb = y - 2.2;
  obox(r, g, x, y + .8, 0, 3, 9, 2.2, 0, wood.lt, wood.base, { grain: 2 });                                        // the base beam
  for (const k of [-8, 8]) obox(r, g, x + k, yb, 0, 15, .9, .9, 0, wood.base, wood.sh);                           // uprights
  obox(r, g, x, yb, 12, 13.8, 9, 1, 0, wood.lt, wood.base);                                                      // the crossbar
  for (let i = -1; i <= 1; i++) { const q = W3(r, [x + i * 5, yb + 1.05, 13.8]); px.rect(g, q[0] - zm, q[1] - zm, 2 * zm, zm + 1, wood.deep); }   // its notches
  const bt = E.tones('#b8c4d4'), ht = E.tones('#d8a848'), sw = 1.05;
  for (let i = -1; i <= 1; i++) {
    const bx = x + i * 5 + (i === 0 ? .4 : 0), tip = [bx, y + 1.2, 1.2], gd = [bx + .3, yb + .6, 14.6], L0 = [bx - sw, gd[1], gd[2]], R0 = [bx + sw, gd[1], gd[2]];
    quad(r, g, [[tip[0] - .2, tip[1], tip[2]], [tip[0] + .2, tip[1], tip[2]], R0, L0], '#2a2430');                   // the blade: a dark outline, a shaded half, a lit half, a fuller
    quad(r, g, [tip, [tip[0] + .15, tip[1], tip[2]], [R0[0] - .2, R0[1], R0[2]], [gd[0], gd[1], gd[2]]], bt.sh);
    quad(r, g, [tip, [gd[0], gd[1], gd[2]], [L0[0] + .2, L0[1], L0[2]], [tip[0] - .15, tip[1], tip[2]]], bt.lt);
    line3(r, g, lerp3(tip, gd, .2), lerp3(tip, gd, .92), bt.hi);
    line3(r, g, [bx - 2, gd[1], gd[2]], [bx + 2.6, gd[1], gd[2]], ht.deep, zm + 1); line3(r, g, [bx - 2, gd[1], gd[2] + .3], [bx + 2.6, gd[1], gd[2] + .3], ht.lt, zm);   // the guard
    line3(r, g, [gd[0], gd[1], gd[2] + .8], [gd[0] + .15, gd[1] - .2, gd[2] + 4.6], '#3a2418', zm + 1); line3(r, g, [gd[0], gd[1], gd[2] + 1.6], [gd[0] + .1, gd[1] - .1, gd[2] + 2.2], '#8a5a34');   // the grip, one wrap lit
    const pm = W3(r, [gd[0] + .2, gd[1] - .25, gd[2] + 5.3]); px.disc(g, pm[0], pm[1], Math.max(1, r.view.scale * .9), ht.sh); px.dot(g, pm[0] - .5, pm[1] - .5, ht.hi);   // the pommel
  }
}
/* ---------- the outskirts: the land beyond the wall, so the town never floats on the dusk. A road leaves the gate between
 * hedged fields (wheat, cabbages, furrows, pasture), a stream winds through the east meadow, the north and west are dark
 * meadow under the pines; the ground dims with distance and dithers out into the sky. Baked per view in 128-unit chunks,
 * lazily (a few per frame), only the ones on screen ---------- */
const OMW = TW * U, OMH = TH * U, OUT = { fade0: 110, fade1: 205, C: 128, x0: -256, y0: -256, x1: TW * U + 256, y1: TH * U + 256, cache: null };
const DUSK = rgb('#231c3a'), HEDGE = ['#1e3a2a', '#27462f', '#315438'].map(rgb), WHEAT = ['#8a6a32', '#a8864a', '#c4a25a'].map(rgb), WATER = ['#1e3450', '#2a4a6e', '#6a9ac8'].map(rgb);
/** how far a point lies outside the walls (0 inside) */
function outDist(x, y) { const dx = Math.max(0, -x, x - OMW), dy = Math.max(0, -y, y - OMH); return Math.hypot(dx, dy); }
const roadX = y => 392 + Math.sin((y - OMH) / 55) * 9 + (y - OMH) * .1, streamX = y => 868 + Math.sin(y / 83) * 26 + Math.sin(y / 31) * 6;
function fieldAt(x, y) {   // hedged plots of four kinds, each plot its own; a verge of grass along the road
  const X = x + 36, Y = y - OMH - 20, px0 = Math.floor(X / 104), py0 = Math.floor(Y / 74), lx = X - px0 * 104, ly = Y - py0 * 74, bump = (nz(x * .2, y * .2) - .5) * 3;
  if (lx < 4 + bump || ly < 4 + bump) return HEDGE[(lx < 2 + bump || ly < 2 + bump) ? 0 : nz(x * .4, y * .4) > .5 ? 2 : 1];
  const kind = Math.floor(hs(px0 + 7, py0 + 3) * 4);
  if (kind === 0) { const f = (x % 4 + 4) % 4; return f < 1.2 ? WHEAT[0] : nz(x * .3, y * .08) > .55 ? WHEAT[2] : WHEAT[1]; }                                   // wheat in rows
  if (kind === 1) { const f = (y % 6 + 6) % 6, cx = ((x + Math.floor(y / 6) * 3) % 6 + 6) % 6; if (f > 1.5 && f < 4.5 && cx > 1.5 && cx < 4.5) return (f - 1.5) < 1.2 ? FC.sprout[1] : FC.sprout[0]; return f < 1.3 ? FC.soil[1] : FC.soil[0]; }   // cabbages
  if (kind === 2) { const f = (y % 5 + 5) % 5; return f < 1.4 ? FC.soil[1] : f > 3.6 ? FC.soil[2] : FC.soil[0]; }                                                   // fresh furrows
  return grassAt(x, y);                                                                                                                                              // pasture
}
function outTex(x, y) {
  const d = outDist(x, y); if (d <= 0) return null;
  let c = null;
  if (y > OMH) {   // the road out of the gate: wheel ruts, pebbles, grass creeping over its edges
    const rx = roadX(y), e = Math.abs(x - rx) - (14 - Math.min(5, (y - OMH) * .03)) + (nz(x * .09, y * .09) - .5) * 5;
    if (e < 0) { c = dirtAt(x, y, e); if (Math.abs(Math.abs(x - rx) - 5) < .9) c = mixc(c, FC.pebbleSh, .45); }
    else if (e > 8 && y > OMH + 16) c = fieldAt(x, y);
  }
  if (!c && x > OMW + 24) {   // the east meadow's stream: dark water, lit ripples, reeds on the banks
    const e = Math.abs(x - streamX(y)) - 4.5 - (nz(x * .1, y * .1) - .5) * 2;
    if (e < 0) c = hs(Math.floor(x * .7), Math.floor(y * .35)) < .06 ? WATER[2] : e < -2.5 ? WATER[0] : WATER[1];
    else if (e < 2.2 && hs(Math.floor(x), Math.floor(y / 2)) < .35) c = HEDGE[2];
  }
  if (!c) c = grassAt(x, y);
  if (d < 7) c = mixc(c, [18, 14, 28], (7 - d) / 7 * .45);   // the wall's shadow at its foot
  return mixc(c, DUSK, clamp((d - 20) / 200, 0, 1) * .6);   // the land dims into the dusk with distance
}
function drawOutskirts(r) {
  const v = r.view; if (!v.inv) return;
  const key = v.id + ':' + v.yawDeg + ':' + v.pitchDeg + ':' + v.scale;
  if (!OUT.cache || OUT.cache.key !== key) OUT.cache = { key, m: new Map() };
  let budget = 2;   // chunks baked this frame, ~12 ms each at the closest zoom (the rest next frame: no hitch when the view or the zoom changes)
  for (let cy = OUT.y0; cy < OUT.y1; cy += OUT.C) for (let cx = OUT.x0; cx < OUT.x1; cx += OUT.C) {
    if (cx >= 0 && cy >= 0 && cx + OUT.C <= OMW && cy + OUT.C <= OMH) continue;   // wholly inside the walls
    if (Math.hypot(Math.max(0, cx - OMW, -(cx + OUT.C)), Math.max(0, cy - OMH, -(cy + OUT.C))) > OUT.fade1) continue;   // wholly past the fade
    const idx = cx + ':' + cy; let ch = OUT.cache.m.get(idx);
    if (!ch) {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const [a, b] of [[cx, cy], [cx + OUT.C, cy], [cx, cy + OUT.C], [cx + OUT.C, cy + OUT.C]]) { const q = v.p(a, b, 0); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
      ch = { x0: Math.floor(x0), y0: Math.floor(y0), w: Math.ceil(x1) - Math.floor(x0) + 1, h: Math.ceil(y1) - Math.floor(y0) + 1, cv: null };
      OUT.cache.m.set(idx, ch);
    }
    const sx = ch.x0 - r.ix, sy = ch.y0 - r.iy; if (sx > r.bw || sy > r.bh || sx + ch.w < 0 || sy + ch.h < 0) continue;   // off screen
    if (!ch.cv) {
      if (budget-- <= 0) continue;
      const cv = E.mkCanvas(ch.w, ch.h), g = cv.getContext('2d'), img = g.createImageData(ch.w, ch.h), dd = img.data;
      for (let py = 0; py < ch.h; py++) for (let pxx = 0; pxx < ch.w; pxx++) {
        const q = v.toGround(pxx + ch.x0 + .5, py + ch.y0 + .5); if (!q) continue;
        const gx = q[0], gy = q[1]; if (gx < cx || gy < cy || gx >= cx + OUT.C || gy >= cy + OUT.C) continue;
        const dist = outDist(gx, gy); if (dist <= 0 || dist > OUT.fade1) continue;
        if (dist > OUT.fade0 && (dist - OUT.fade0) / (OUT.fade1 - OUT.fade0) > E.bayer(pxx + ch.x0, py + ch.y0)) continue;   // dithered into the sky
        const c = outTex(gx, gy); if (!c) continue;
        const k = (py * ch.w + pxx) * 4; dd[k] = c[0]; dd[k + 1] = c[1]; dd[k + 2] = c[2]; dd[k + 3] = 255;
      }
      g.putImageData(img, 0, 0); ch.cv = cv;
    }
    r.ctx.drawImage(ch.cv, sx, sy);
  }
}
/** the low things out there: fence posts along the road, haystacks, a signpost home, a wayside lamp; pines only far off */
function dressOutskirts(Lv) {
  const T = Lv.things, add = t => { T.push(t); t.dead = false; return t; };
  for (let y = OMH + 26; y < OMH + 150; y += 20) for (const sd of [-1, 1]) { const x = roadX(y) + sd * 20; add(piece('post', x, y, 0, (r, g) => { obox(r, g, x, y, 0, 7, .8, .8, 0, '#6a4a2e', '#4a3220'); if (y + 20 < OMH + 150) line3(r, g, [x, y, 5.5], [roadX(y + 20) + sd * 20, y + 20, 5.5], '#5a3a24', zw(r)); })); }
  for (const [x, y, a] of [[300, 700, .2], [318, 712, -.4], [520, 690, .5], [236, 742, .1], [604, 748, -.2]]) add(hay(x, y, a));
  const sgx = roadX(704) + 24; add(piece('waysign', sgx, 704, 0, (r, g) => {   // EMBERHOLD, on a post by the road
    obox(r, g, sgx, 704, 0, 24, 1.1, 1.1, 0, '#7a5232', '#5a3a22'); const P0 = (dx, z) => [sgx + dx, 705, z];
    quad(r, g, [P0(-12, 15), P0(12, 15), P0(12, 21), P0(-12, 21)], '#5a3820'); quad(r, g, [P0(-11, 15.7), P0(11, 15.7), P0(11, 20.3), P0(-11, 20.3)], '#9a6a3e');
    const q = W3(r, P0(0, 18)); E.font.text(g, 'EMBERHOLD', Math.round(q[0]), Math.round(q[1]) - 2, '#3a2010', { align: 'center', font: 'tiny', outline: false });
  }));
  add(lampThing(360, 668));
  for (let i = 0; i < 14; i++) pineAt(Lv, 20 + i * 62 + hs(i, 21) * 30, OMH + 104 + hs(i, 22) * 60, 1.4 + hs(i, 23) * .7, i % 3 ? '#1e3c34' : '#24463a');
  for (let i = 0; i < 11; i++) pineAt(Lv, OMW + 96 + hs(i, 24) * 70, 30 + i * 56 + hs(i, 25) * 26, 1.4 + hs(i, 26) * .7, i % 3 ? '#1e3c34' : '#24463a');
  for (const [x, y] of [[180, 668], [470, 676], [690, 700], [812, 520], [836, 300], [800, 160]]) add(bushThing(x, y, 1, '#2e5236', null));
}
/* ---------- set dressing: where every piece stands ---------- */
function dressTown(Lv) {
  const T = Lv.things, add = t => { T.push(t); t.dead = false; return t; }, prop = (name, x, y, o = {}, z = 0) => Lv.props.push({ name, x, y, z, o });
  add(forgeThing()); add(Lv.bellows = bellowsThing()); add(anvilThing()); add(Lv.quench = quenchThing()); add(stallThing()); add(wellThing());
  const chest = add(stashThing()); Lv.uses = [{ x: chest.x, y: chest.y, r: 21, label: '[E] Open the stash', use: () => chest.use() }];   // the stash by Cobb's stall
  // the forge yard: a coal heap, a woodpile, a weapon rack, the smithy's sign
  add(piece('coal', 122, 334, 6, (r, g, x, y) => { const [cx, cy] = r.w(x, y, 0), s = r.view.scale; for (let i = 0; i < 14; i++) { const a = hs(i, 3) * TAU, d = hs(i, 5) * 6; px.disc(g, cx + Math.cos(a) * d * s, cy + Math.sin(a) * d * s * .5 - (6 - d) * s * .6, 2.2 * s, i % 4 ? '#2a2428' : '#4a4048'); } px.dot(g, cx - s, cy - 4 * s, '#8a8290'); }));
  add(piece('logs', 232, 318, 8, (r, g, x, y) => { for (let row = 0; row < 3; row++) for (let i = 0; i < 4 - row; i++) { const lx = x - 7 + i * 4.6 + row * 2.3, [cx, cy] = r.w(lx, y + 4, 3 + row * 4), s = r.view.scale; obox(r, g, lx, y, row * 4, row * 4 + 4, 2, 7, 0, null, '#7a5232', { edge: false }); px.disc(g, cx, cy, 2 * s, '#b08a5a'); px.dot(g, cx, cy, '#7a5a3a'); } }));
  add(piece('rack', 228, 236, 6, weaponRack));
  add(barrel(222, 268, '#7a5232')); add(crate(206, 342, .3));
  // the stall's stock: barrels, crates, sacks round the counter
  add(barrel(334, 110)); add(barrel(338, 128, '#7a4a2a')); add(crate(482, 112, .15)); add(crate(482, 112, .4, .8, 10)); add(crate(486, 132, -.2, .9)); add(sack(474, 150)); add(sack(482, 158, '#b8a078')); add(sack(330, 148, '#c8b890'));
  // the tavern terrace: tables with mugs, stools, barrels by the door, fire bowls at its corners
  add(table(78, 164)); add(table(184, 150)); for (const [x, y] of [[66, 156], [90, 172], [70, 178], [196, 142], [194, 164]]) add(stool(x, y));
  add(barrel(60, 136, '#7a4a2a')); add(barrel(72, 134)); add(crate(200, 134, .1, .8));
  add(fireBowl(206, 192)); add(fireBowl(52, 190));
  // lamps round the plaza, by the gate, the tower path and the forge yard (oil lamps: they flicker like flames)
  for (const [x, y] of [[289, 225], [495, 225], [282, 430], [502, 432], [360, 596], [424, 596], [560, 236], [258, 222], [210, 470], [606, 420]]) add(lampThing(x, y));   // (the forge-yard lamp stands east of the rack, not in front of it)
  for (const [x, y] of [[726, 470], [714, 342], [118, 588]]) add(lampThing(x, y));   // Bram's round: the east wall and the garden corner
  // Seren's corner: crystals, candles, a crystal ball on a little table
  for (const [x, y, c, sz] of [[604, 136, '#b48aff', 1.2], [668, 138, '#6ad8f0', 1], [674, 178, '#c890ff', 1.3], [598, 182, '#8ac8ff', .9]]) add(crystalCluster(x, y, c, sz));
  add(candles([[600, 170, 5], [605, 175, 3.5], [609, 169, 4.5]])); add(candles([[664, 131, 4], [670, 132, 5.5], [675, 151, 3.5], [678, 157, 4.5]]));
  add(piece('orb', 620, 146, 5, (r, g, x, y) => { cyl(r, g, x, y, 0, 9, 1.4, '#3a2a3a', { n: 6 }); cyl(r, g, x, y, 9, 10.5, 5, '#4a3448', { n: 10, top: '#5a4058' });
    const t = game.time, [ox, oy] = r.w(x, y, 14.5), s = r.view.scale; px.disc(g, ox, oy, 3.4 * s, '#6a4ab0'); px.disc(g, ox - .5 * s, oy - .5 * s, 2.6 * s, '#9a7ae0'); for (let i = 0; i < 3; i++) { const a = t * 2 + i * 2.1; px.dot(g, ox + Math.cos(a) * 1.8 * s, oy + Math.sin(a * 1.3) * 1.5 * s, '#f0e0ff'); } px.dot(g, ox - 1.4 * s, oy - 1.4 * s, '#ffffff'); }, { light: r => glowAt(r, 620, 146, 14.5, 9, 1.1, '#c8a8ff') }));
  // benches round the plaza
  add(bench(330, 392, -Math.PI / 4)); add(bench(462, 262, -Math.PI / 4)); add(bench(452, 402, -Math.PI / 4 + .3));
  // the south-east: a memorial of standing stones with candles, the coop and its hay, the garden and its scarecrow
  for (const [x, y, h, w] of [[560, 540, 16, 4], [574, 548, 20, 4.6], [590, 542, 14, 3.8]]) add(stone(x, y, h, w));
  add(candles([[566, 554, 3], [582, 557, 4], [596, 551, 3.5], [556, 550, 2.5]], .6));
  prop('flowers', 572, 560, { color: '#e8e0f0', color2: '#c890ff' });
  add(coopThing(688, 470)); add(hay(652, 500, .2)); add(hay(708, 508, -.3)); add(hay(716, 494, .1));
  add(scarecrow(192, 552));
  for (let x = SOIL.x0; x <= SOIL.x1; x += 15) { prop('fence', x + 7, SOIL.y0 - 2, { size: 1 }); prop('fence', x + 7, SOIL.y1 + 2, { size: 1 }); }
  // trees (with trunks you bump into), pines beyond the wall, bushes, flowers and tufts
  for (const [x, y, sz, c] of [[228, 188, 1.1, '#3e7a48'], [586, 300, 1.25, '#3a6e44'], [700, 250, 1.3, '#447a44'], [716, 360, 1.2, '#3a6a40'], [598, 480, 1.1, '#3e7040'], [724, 580, 1.25, '#3a6a44'], [470, 590, 1.05, '#447848'], [290, 590, 1.2, '#3a6a40'], [196, 404, 1.1, '#3e7448'], [60, 370, 1.2, '#3a6a42'], [44, 580, 1.25, '#447444'], [300, 486, 1, '#3e7040'], [660, 330, 1, '#447a48'], [520, 200, .9, '#3e7244']]) add(treeThing(x, y, sz, c));
  for (let i = 0; i < 20; i++) pineAt(Lv, 10 + i * 40 + hs(i, 1) * 16, -6 - hs(i, 2) * 26, 1.5 + hs(i, 3) * .8, i % 3 ? '#23473c' : '#2a5040');
  for (let i = 0; i < 16; i++) pineAt(Lv, -8 - hs(i, 4) * 24, 12 + i * 40 + hs(i, 5) * 14, 1.5 + hs(i, 6) * .8, i % 3 ? '#23473c' : '#2a5040');
  for (const [x, y, s0, c, b] of [[230, 120, 1, '#3e6e40', '#e87aa0'], [334, 94, .8, '#3a6a3e', null], [480, 94, .9, '#3e6e40', '#f0d060'], [572, 104, 1.1, '#3a6a40', '#c890ff'], [700, 150, 1.2, '#3e6e40', null], [728, 206, 1, '#3a6a3e', '#e87aa0'],
    [120, 400, 1, '#3e6e40', '#f0d060'], [124, 520, 1.1, '#3a6a40', null], [260, 540, .9, '#3e6e40', '#e87aa0'], [344, 574, 1, '#3a6a3e', null], [440, 574, 1, '#3e6e40', '#f0d060'], [640, 560, 1, '#3a6a40', '#e87aa0'], [734, 424, 1, '#3e6e40', null], [30, 216, .9, '#3a6a3e', null], [248, 360, .9, '#3e6e40', '#e87aa0']]) add(bushThing(x, y, s0, c, b));
  for (const Hs of HOUSES) { Hs.flowers = true; }
  for (const [x, y, c] of [[250, 118, '#e87aa0'], [308, 118, '#f0d060'], [520, 118, '#c890ff'], [120, 262, '#f0d060'], [118, 430, '#e87aa0'], [118, 484, '#f0f0f8'], [60, 196, '#e87aa0'], [196, 196, '#f0d060'], [500, 380, '#e87aa0']]) prop('flowers', x, y, { color: c, color2: '#fff4a0' });
  for (let i = 0; i < 60; i++) {   // tufts on open grass only
    const x = 20 + hs(i, 11) * 728, y = 20 + hs(i, 12) * 600, cx = Math.floor(x / U), cy = Math.floor(y / U);
    if (MAP.cells[cy * TW + cx] || MAP.kind[cy * TW + cx] || MAP.pathD[Math.floor(y) * MAP.MW + Math.floor(x)] < 4 || Math.hypot(x - PC.x, y - PC.y) < PC.r + 8) continue;
    prop('grass', x, y, { color: i % 2 ? '#4a7a44' : '#5a8a4c', size: .9 + hs(i, 13) * .5 });
  }
  // lanterns hung by doors (and one on Cobb's signpost); signs over the tavern and the smithy
  for (const [x, y, z, f] of [[102, 128, 30, 's'], [138, 128, 30, 's'], [266, 112, 28, 's'], [552, 112, 28, 's'], [112, 278, 27, 'e'], [112, 442, 27, 'e']]) add(lanternThing(x, y, z, f));
  add(lanternThing(346, 143, 29, null)); add(lanternThing(378, 117, 24, null, '#ffc860')); add(lanternThing(438, 117, 24, null, '#ffc860'));   // two hang from the awning's valance over Cobb's lane
  add(piece('tavernSign', 186, 130, 0, (r, g) => signBoard(r, g, 186, 131, 26, 's', 'mug')));
  add(piece('smithySign', 114, 316, 0, (r, g) => signBoard(r, g, 113, 316, 25, 'e', 'anvil')));
  dressDetails(Lv, add);
}
/** the town's smaller stories, from the asset store (the page's 'emberdeep' set, which 53-scenes.js registers; docs/ASSETS.md):
 *  the garden's crops, graves by the memorial stones, a woodpile, the coop's feed, a grindstone in the forge yard, a
 *  produce cart, a signpost on the south road. Each stands clear of the townsfolk's rounds; without the set, none */
function dressDetails(Lv, add) {
  const D = 'emberdeep:', put = (id, x, y, s, rr = 0, o = {}) => { if (E.SHAPES[id]) add(shapePiece('detail', id, x, y, rr, Object.assign({ scale: s, facing: turned(x, y) }, o))); };
  // the garden: cabbages, onions, cabbages, then a row of pumpkins, round the scarecrow (the fenced soil is not walked)
  for (let row = 0; row < 4; row++) for (let i = 0; i < 6; i++) {
    const x = SOIL.x0 + 12 + i * 14 + (row & 1) * 5, y = SOIL.y0 + 10 + row * 16;
    if (Math.hypot(x - 192, y - 552) < 13) continue;   // (the scarecrow's post)
    put(D + ['cabbage', 'onion', 'cabbage', 'crop-pumpkin'][row], x, y, [.42, .55, .42, .5][row]);
  }
  // beside the memorial stones: two headstones, a mound with flowers on it
  put(D + 'gravestone-round', 612, 534, .75, 4, { facing: Math.PI / 2 - .1 }); put(D + 'grave', 612, 549, .45, 0, { facing: Math.PI / 2 - .1, mats: { a: '#4e4434 noise' } });   // (the kit's earth came as copper)
  put(D + 'gravestone-cross', 632, 543, .5, 4, { facing: Math.PI / 2 + .25 });
  Lv.props.push({ name: 'flowers', x: 611, y: 551, z: 0, o: { color: '#e8e0f0', color2: '#f0d060', size: .8 } });
  // the south-west corner: a chopping stump, a log waiting for it, chips
  put(D + 'trunk', 52, 532, .5, 6, { mats: { a: '#7a5638 bark' } }); put(D + 'tree-log', 74, 520, .42, 0, { facing: .35, mats: { a: '#6e4c32 bark' } }); put(D + 'debris-wood', 62, 546, .45);
  // the coop's feed and water; the smith's grindstone; Cobb's produce cart, laden, south of the plaza
  add(sack(658, 456, '#b8a078')); put(D + 'bucket', 667, 489, .5, 3);
  put(D + 'workbench-grind', 206, 250, .75, 6, { facing: .3 });
  put('cart', 456, 506, 1, 10, { facing: -.45 }); put(D + 'crop-pumpkin', 438, 520, .5, 3); put(D + 'cabbage', 447, 528, .42); add(sack(476, 496, '#c8b890'));
  put(D + 'signpost-single', 418, 548, .8, 2, { facing: Math.PI });
  // out past the wall: pumpkins by the hay, a cart left on the verge
  for (const [x, y] of [[534, 700], [548, 709], [561, 699], [544, 692]]) put(D + 'crop-pumpkin', x, y, .5);
  put('cart', 458, 702, 1, 10, { facing: 1.2 });
}
/** a hanging signboard on an iron bracket, with a painted icon */
function signBoard(r, g, x, y, z, f, icon) {
  const t = game.time, sw = Math.sin(t * 1.7 + x) * .8, n = FN[f], out = 6, bx = x + n[0] * out, by = y + n[1] * out, s = r.view.scale;
  line3(r, g, [x, y, z + 2], [bx + n[0] * 1, by + n[1] * 1, z + 2], '#2a2430', zw(r)); line3(r, g, [x, y, z - 2], [bx - n[0] * 2, by - n[1] * 2, z + 2], '#2a2430');
  const [ax, ay] = r.w(bx, by, z + 2), [cx, cy] = r.w(bx + n[1] * sw * .6, by - n[0] * sw * .6, z - 5), W = 6 * s, H = 5 * s;
  px.line(g, ax - W * .6, ay, cx - W * .6, cy - H, '#3a3440'); px.line(g, ax + W * .6, ay, cx + W * .6, cy - H, '#3a3440');
  px.rect(g, cx - W - 1, cy - H - 1, W * 2 + 2, H * 2 + 2, '#3a2418'); px.rect(g, cx - W, cy - H, W * 2, H * 2, '#8a5a34'); px.rect(g, cx - W, cy - H, W * 2, 1, '#b07a48');
  if (icon === 'mug') { px.rect(g, cx - 2 * s, cy - 2 * s, 4 * s, 4.5 * s, '#e8b840'); px.rect(g, cx - 2 * s, cy - 3 * s, 4 * s, 1.4 * s, '#fff4d8'); px.rect(g, cx + 2 * s, cy - s, 1.4 * s, 2.4 * s, '#c89030'); }
  else { px.rect(g, cx - 3.5 * s, cy - 1.5 * s, 6 * s, 1.8 * s, '#c8c8d8'); px.poly(g, [[cx + 2.5 * s, cy - 1.5 * s], [cx + 4.5 * s, cy - 1.5 * s], [cx + 2.5 * s, cy]], '#c8c8d8'); px.rect(g, cx - 1.5 * s, cy, 2.4 * s, 2 * s, '#9a9aac'); px.rect(g, cx - 2.8 * s, cy + 2 * s, 5 * s, 1.2 * s, '#9a9aac'); }
}
TOWN.build = buildTown;
}
