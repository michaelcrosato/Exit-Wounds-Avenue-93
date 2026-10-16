/* =============================================================================
 * LEVELS: recipes (what a depth is made of), layouts, themes, and building a level from a recipe
 * A LAYOUT is def('layouts', id, { name, gen(R, o) -> { w, h, cells, tags, rooms: [{ x, y, w, h, cx, cy }], start: [cx, cy], exit: [cx, cy] } })
 *   cells: 0 floor, 1 outer wall, 2 pillar, 3 low wall, 4+ theme extras. tags: per-cell floor tag or null ('pit', 'water', 'ice'...).
 * A THEME is def('themes', id, { name, nouns: ['Vaults'], pal, floor(L, x, y, tag) -> [r, g, b(, glow)], walls: { 1: {...}, 2, 3 },
 *   torch: 'brazier' | prop name, light: '#ff9a4a', ambient, decorate(L, R), ambience(L, dt), sky: [..] | null, music, pool: [archetype ids] })
 * A RECIPE is { depth, seed, name, theme, hue, layout, mechs: [ids], newMech, boss, pool, size }.
 * ============================================================================= */
const T16 = 16;
/* the planned descent: one new element per depth, a boss every fifth. Past the plan, recipes compose themselves */
const PLAN = [
  null,
  { mech: 'powder', theme: 'crypt', layout: 'halls' },
  { mech: 'wards', theme: 'crypt', layout: 'halls' },
  { mech: 'chasm', theme: 'ruins', layout: 'islands' },
  { mech: 'gale', theme: 'ruins', layout: 'halls' },
  { mech: 'magma', theme: 'forge', layout: 'arena', boss: 'cinderking' },
  { mech: 'ice', theme: 'frost', layout: 'caves' },
  { mech: 'brood', theme: 'fungal', layout: 'caves' },
  { mech: 'pylons', theme: 'mine', layout: 'halls' },
  { mech: 'timewell', theme: 'clockwork', layout: 'halls' },
  { mech: 'webs', theme: 'fungal', layout: 'arena', boss: 'broodmother' },
  { mech: 'dark', theme: 'abyss', layout: 'caves' },
  { mech: 'bloodrush', theme: 'ossuary', layout: 'halls' },
  { mech: 'launch', theme: 'sky', layout: 'islands' },
  { mech: 'flood', theme: 'aqueduct', layout: 'halls' },
  { mech: 'quake', theme: 'cavern', layout: 'arena', boss: 'wyrm' }
];
const PLANNED = PLAN.length - 1;
/** the recipe for a depth. visit changes the seed so a depth plays differently each time you go down it */
function recipe(depth, visit = 0) {
  const R = RNG('emberdeep:' + depth + ':' + visit);
  const has = (k, id) => id && REG[k][id];
  const p = PLAN[depth];
  const rec = { depth, seed: R.int(1, 2e9), R, hue: 0, size: [52, 52] };
  if (p) {
    rec.theme = has('themes', p.theme) ? p.theme : 'crypt';
    rec.layout = has('layouts', p.layout) ? p.layout : 'halls';
    rec.newMech = has('mechanics', p.mech) ? p.mech : null;
    rec.mechs = rec.newMech ? [rec.newMech] : [];
    rec.boss = p.boss && REG.bosses[p.boss] ? p.boss : null;
  } else {
    // composed depths: a known theme (recolored further the deeper you go), one NEW combination of mechanics (pairs,
    // then triples and quads phasing in: comboAt), and a composed boss every fifth depth
    const themes = Object.keys(REG.themes);
    rec.theme = R.pick(themes); rec.layout = R.pick(Object.keys(REG.layouts).filter(id => !REG.layouts[id].bossOnly));
    rec.hue = ((depth - PLANNED) * 37 + R.int(-20, 20)) % 360;
    const combo = comboAt(depth);
    rec.mechs = combo; rec.newMech = combo[0]; rec.combo = true;
    if (depth % 5 === 0) { rec.boss = composeBoss(depth, R); rec.layout = REG.layouts.arena ? 'arena' : rec.layout; }
  }
  rec.pool = levelPool(rec.theme, depth);
  rec.name = levelName(rec, R);
  return rec;
}
/** the monsters of a level: archetypes that live in its theme (arch.themes) or anywhere (no themes), deep enough.
 *  Past the planned depths every archetype may turn up anywhere */
function levelPool(theme, depth) {
  const all = Object.values(REG.archetypes).filter(a => !a.noPack && (a.minDepth || 1) <= depth + 1);
  let pool = all.filter(a => !a.themes || a.themes.includes(theme) || depth > PLANNED);
  const th = REG.themes[theme]; if (th && th.pool) pool = pool.concat(th.pool.map(id => REG.archetypes[id]).filter(a => a && !pool.includes(a)));
  const ids = pool.map(a => a.id);
  return ids.length ? ids : ['husk', 'skeleton', 'slime'];
}
/* ---------- composed depths: every depth brings one NEW combination of mechanics, and they grow ----------
 * The pace (DESIGN.md): pairs to depth 30; triples one depth in three from 31 and two in three from 61; quads one in
 * three from 101 and two in three from 201. Each size phases in over a stretch instead of switching on, so a new size
 * is a spike before it is the norm; a boss arena keeps one element fewer than the depths around it (never under two):
 * the boss is the show there. Within a size every combination comes once, and each depth takes the one whose elements
 * the player has seen least recently, so all fifteen keep turning up (pairs sorted by age left flood and the quake
 * out of play to depth 107 and kept complexity flat at two for 105 depths). A size that runs dry (past depth ~2000
 * for the quads) draws random ones: still endless */
function comboSize(depth) {
  const d = depth, m3 = d % 3;
  const k = d <= 30 ? 2 : d <= 60 ? (m3 === 0 ? 3 : 2) : d <= 100 ? (m3 === 1 ? 2 : 3) : d <= 200 ? (m3 === 0 ? 4 : 3) : (m3 === 1 ? 3 : 4);
  return Math.max(2, d % 5 === 0 ? k - 1 : k);
}
/** every k-element subset of ids, each newest element first */
function comboSets(ids, k) {
  const out = [], pick = (from, acc) => { if (acc.length === k) { out.push(acc.slice().reverse()); return; } for (let i = from; i < ids.length; i++) { acc.push(ids[i]); pick(i + 1, acc); acc.pop(); } };
  pick(0, []); return out;
}
const COMBO = { ids: null, lists: {}, seq: [], last: null };
/** the combination of mechanics for a composed depth (newest element first). Built depth by depth from PLANNED + 1 and
 *  memoised, since each pick depends on what the depths before it showed */
function comboAt(depth) {
  const C = COMBO;
  if (!C.ids) {
    const intro = id => { const i = PLAN.findIndex(p => p && p.mech === id); return i > 0 ? i : 50 + (REG.mechanics[id].depth || 0); };
    C.ids = Object.keys(REG.mechanics).filter(id => !REG.mechanics[id].bossOnly).sort((a, b) => intro(a) - intro(b));
    C.last = new Map(C.ids.map(id => [id, 0]));
  }
  const ids = C.ids, N = ids.length;
  if (N < 2) return ids.slice(0, 1);
  for (let d = PLANNED + 1 + C.seq.length; d <= depth; d++) {
    const k = Math.min(comboSize(d), N), L0 = C.lists[k] || (C.lists[k] = RNG('emberdeep:combos:' + k).shuffle(comboSets(ids, k)));
    let pick;
    if (L0.length) {   // stalest first: the most recently seen member decides, then the sum (ties: the seeded order)
      let bi = 0, bm = Infinity, bs = Infinity;
      for (let i = 0; i < L0.length; i++) { let m = 0, s = 0; for (const id of L0[i]) { const v = C.last.get(id); if (v > m) m = v; s += v; } if (m < bm || (m === bm && s < bs)) { bm = m; bs = s; bi = i; } }
      pick = L0.splice(bi, 1)[0];
    } else pick = RNG('emberdeep:combo:' + d).shuffle(ids.slice()).slice(0, k).sort((a, b) => ids.indexOf(b) - ids.indexOf(a));
    for (const id of pick) C.last.set(id, d);
    C.seq.push(pick);
  }
  return C.seq[depth - PLANNED - 1].slice();
}
/** a level is named after its new element (the brief), and a composed one after where it is too:
 *  - a planned depth: the mechanic's own title ('The Powder Vaults');
 *  - a planned boss depth: the element woven into the boss's lair ('The Brood Mother's Lair' + webs: 'The Webbed Lair');
 *  - a composed depth: every element's adjective, newest first, on a place noun of its theme ('The Molten, Howling
 *    Crypts') */
function levelName(rec, R) {
  const ms = rec.mechs.map(id => REG.mechanics[id]).filter(Boolean), th = REG.themes[rec.theme], B = rec.boss && REG.bosses[rec.boss];
  // (a noun holding any mechanic's adjective is skipped too: 'Sundered Halls' would promise chasms that are not there)
  const adjs = ms.map(m => m.adj).filter(Boolean), used = new Set(Object.values(REG.mechanics).map(m => m.adj || '').join(' ').toLowerCase().split(/\s+/));
  const nouns = (th && th.nouns && th.nouns.length ? th.nouns : ['Deep']), fit = nouns.filter(n => !n.toLowerCase().split(/\s+/).some(w => used.has(w)));
  const noun = R.pick(fit.length ? fit : nouns);
  if (!ms.length) return (B && B.levelName) || 'The ' + noun;
  if (rec.depth <= PLANNED) {
    if (B && B.levelName && ms[0].adj) return 'The ' + ms[0].adj + ' ' + B.levelName.split(/\s+/).pop();
    return ms[0].title || 'The ' + (ms[0].adj || '') + ' ' + (ms[0].noun || noun);
  }
  return 'The ' + (adjs.length ? adjs.join(', ') + ' ' : '') + noun;
}

/* ---------- the level card: what the scene shows when a depth starts ---------- */
/* Short words for mechanics defined outside the mechanics files (their own brief / lure / act fields win) */
const LVL_WORDS = {
  magma: { brief: 'Vents erupt in fire that burns all near.', lure: 'onto a vent', act: 'set the vent off' },
  webs: { brief: 'Silk slows you, never spiders; fire burns it.', lure: 'onto the silk', act: 'set the silk alight', zone: 'the silk' },
  quake: { brief: 'The ground heaves: fissures stun, rocks fall.', lure: 'onto a red fissure', act: 'let the quake stun them' }
};
/* pairs whose elements really work on each other in code (keyed by the two ids, sorted) */
const LVL_SYNERGY = {
  'flood+pylons': 'Pylon arcs that touch the water run through the whole pool.',
  'flood+magma': 'Fire on the water raises scalding steam: erupt a vent in the shallows.',
  'magma+webs': 'Fire burns silk in a rush of flame: erupt a vent under a nest.',
  'powder+webs': 'A keg blast is fire: blow one on the silk and the web goes up.',
  'chasm+gale': 'Gusts carry knocked foes far: blow a pack over the edge.',
  'chasm+ice': 'Foes knocked on ice slide, and skate right off the edge.',
  'gale+ice': 'Knock packs downwind on the ice: they fly the length of the room.',
  'bloodrush+brood': 'Farm the swarmers: every kill feeds the streak.',
  'flood+webs': 'Water and silk both slow you: keep to dry stone, and let them wade.'
};
const lvlWord = (M, k) => M[k] || (LVL_WORDS[M.id] || {})[k];
const lvlCap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
/** one line on how two elements play together: a hand-written pair when their systems touch, else a sentence built
 *  from their words (a mover's move toward the other's lure; a zone to fight in with the other's act) */
function lvlSynergy(A, B) {
  const key = [A.id, B.id].sort().join('+'); if (LVL_SYNERGY[key]) return LVL_SYNERGY[key];
  const w = (M, k) => lvlWord(M, k);
  for (const [X, Y] of [[A, B], [B, A]]) {
    if (X.id === 'bloodrush') return (w(Y, 'act') ? lvlCap(w(Y, 'act')) + ' to chain kills' : 'Chain kills fast') + ': each one feeds the streak.';
    if (X.id === 'brood' && w(Y, 'lure') && w(Y, 'act')) return 'Lure the swarmers ' + w(Y, 'lure') + ', then ' + w(Y, 'act') + '.';
  }
  for (const [X, Y] of [[A, B], [B, A]]) if (w(X, 'move') && w(Y, 'lure') && !w(Y, 'move')) return w(X, 'move') + ' ' + w(Y, 'lure') + '.';
  if (w(A, 'zone') && w(B, 'zone')) return 'Fight where ' + w(A, 'zone') + ' and ' + w(B, 'zone') + ' meet.';
  const [X, Y] = w(B, 'zone') && !w(A, 'zone') ? [B, A] : [A, B];   // the zone (where to stand) lures, the other finishes
  if (w(X, 'lure') && w(Y, 'act')) return 'Pull packs ' + w(X, 'lure') + ', then ' + w(Y, 'act') + '.';
  if (w(Y, 'lure') && w(X, 'act')) return 'Pull packs ' + w(Y, 'lure') + ', then ' + w(X, 'act') + '.';
  return 'Use one to set up the other.';
}
/** the level card for a level: { title, sub, mech }. title is the level name, sub 'DEPTH n', mech the new element's
 *  spec (a copy) or null: on a planned depth the mechanic itself (its tip is the card's text); on a combination
 *  { name: 'A + B', combo: true, ids, lines, tip: '' } where lines are one row per element, 'Magma Vents: Vents erupt in
 *  fire...' (the card picks the name out in its colour), and a last 'Together: ...' line on how they play off each other */
function levelCardInfo(L0) {
  const rec = L0.rec || {}, depth = L0.depth, M = rec.newMech && REG.mechanics[rec.newMech];
  const info = { title: L0.name || rec.name || '', sub: 'DEPTH ' + depth, mech: null };
  if (!M) return info;
  const ms = (rec.mechs || []).map(id => REG.mechanics[id]).filter(Boolean);
  if (depth <= PLANNED || ms.length < 2) { info.mech = Object.assign({}, M); return info; }
  // the together line: a pair with a hand-written synergy if the combination holds one (the newest element's first), else the newest two
  let pair = [ms[0], ms[1]];
  outer: for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) if (LVL_SYNERGY[[ms[i].id, ms[j].id].sort().join('+')]) { pair = [ms[i], ms[j]]; break outer; }
  const lines = ms.map(m => m.name + ': ' + (lvlWord(m, 'brief') || (m.tip || '').split(/(?<=\.)\s/)[0])).concat('Together: ' + lvlSynergy(pair[0], pair[1]));
  info.mech = Object.assign({}, M, { name: ms.map(m => m.name).join(' + '), combo: true, ids: ms.map(m => m.id), lines, tip: '' });
  return info;
}

/* ---------- the classic layout: rooms joined by wide corridors ---------- */
def('layouts', 'halls', { name: 'Halls', gen(R, o) {
  const w = o.w || 52, h = o.h || 52, cells = new Array(w * h).fill(1), tags = new Array(w * h).fill(null), rooms = [];
  const carve = (x, y, rw, rh) => { for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) if (i > 0 && j > 0 && i < w - 1 && j < h - 1) cells[j * w + i] = 0; };
  for (let tries = 0; tries < 400 && rooms.length < (o.rooms || 11); tries++) {
    const rw = R.int(7, 13), rh = R.int(7, 12), x = R.int(2, w - rw - 2), y = R.int(2, h - rh - 2);
    if (rooms.some(r0 => x < r0.x + r0.w + 2 && x + rw + 2 > r0.x && y < r0.y + r0.h + 2 && y + rh + 2 > r0.y)) continue;
    rooms.push({ x, y, w: rw, h: rh, cx: x + rw / 2, cy: y + rh / 2 }); carve(x, y, rw, rh);
  }
  // corridors: each room to its nearest joined neighbour (a spanning tree), plus a couple of loops
  const joined = [rooms[0]], rest = rooms.slice(1), corr = (a, b) => {
    let x = Math.floor(a.cx), y = Math.floor(a.cy); const tx = Math.floor(b.cx), ty = Math.floor(b.cy), hor = R.chance(.5);
    const step = (dx, dy) => { carve(x - 1, y - 1, 3, 3); x += dx; y += dy; };
    if (hor) { while (x !== tx) step(Math.sign(tx - x), 0); while (y !== ty) step(0, Math.sign(ty - y)); }
    else { while (y !== ty) step(0, Math.sign(ty - y)); while (x !== tx) step(Math.sign(tx - x), 0); }
    carve(x - 1, y - 1, 3, 3);
  };
  while (rest.length) {
    let bi = 0, bj = 0, bd = 1e9;
    rest.forEach((r0, i) => joined.forEach((q, j) => { const d = Math.hypot(r0.cx - q.cx, r0.cy - q.cy); if (d < bd) { bd = d; bi = i; bj = j; } }));
    corr(rest[bi], joined[bj]); joined.push(rest.splice(bi, 1)[0]);
  }
  for (let k = 0; k < 2 && rooms.length > 4; k++) corr(R.pick(rooms), R.pick(rooms));
  // pillars in the big rooms, the odd low wall
  for (const r0 of rooms) {
    if (r0.w >= 11 && r0.h >= 10 && R.chance(.6)) for (const [dx, dy] of [[2, 2], [r0.w - 3, 2], [2, r0.h - 3], [r0.w - 3, r0.h - 3]]) cells[(r0.y + dy) * w + r0.x + dx] = 2;
    else if (R.chance(.35)) { const hz = R.chance(.5), lx = r0.x + R.int(2, r0.w - 5), ly = r0.y + R.int(2, r0.h - 4); for (let k = 0; k < 3; k++) cells[(ly + (hz ? 0 : k)) * w + lx + (hz ? k : 0)] = 3; }
  }
  const far = farthestRoom(cells, w, h, rooms, 0);
  return { w, h, cells, tags, rooms, start: [Math.floor(rooms[0].cx), Math.floor(rooms[0].cy)], exit: [Math.floor(far.cx), Math.floor(far.cy)], exitRoom: far };
} });
/** the room farthest (by walking) from room i: the exit goes there */
function farthestRoom(cells, w, h, rooms, i) {
  const d = new Int32Array(w * h).fill(-1), q = [], s = Math.floor(rooms[i].cy) * w + Math.floor(rooms[i].cx); d[s] = 0; q.push(s);
  for (let k = 0; k < q.length; k++) { const c = q[k], x = c % w, y = (c / w) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = (y + dy) * w + x + dx; if (x + dx < 0 || y + dy < 0 || x + dx >= w || y + dy >= h || d[n] >= 0 || cells[n] === 1 || cells[n] === 2) continue; d[n] = d[c] + 1; q.push(n); } }
  let best = rooms[rooms.length - 1], bd = -1;
  for (const r0 of rooms) { const v = d[Math.floor(r0.cy) * w + Math.floor(r0.cx)]; if (v > bd) { bd = v; best = r0; } }
  return best;
}

/* ---------- the stress test's rune hall as a theme: flagstones, teal runes, moss at the edges ---------- */
const CRYPT = { stones: ['#4b4559', '#554f64', '#433e51', '#5d566c'], mortar: '#221e2b', hi: '#6f6782', lo: '#322d3e', speck: '#3e384b', moss: ['#3f5a44', '#4d6b4b'], rune: '#2f7f82', runeHi: '#6fd6cc',
  cliff: '#3e3850', lip: '#4d6b4b', plank: '#5a4a3a', void: '#07060e' };   // (the rock under a chasm, its mossy lip, bridge planks: 51-themes.js reads these)
def('themes', 'crypt', { name: 'Crypt', nouns: ['Vaults', 'Crypts', 'Halls', 'Catacombs'], pal: CRYPT, torch: 'brazier', light: '#ff9a4a', ambient: .12, music: 'deep',
  // wall tops: broken rock over the solid mass, paving on pillars and low walls (the engine's default speckle read as
  // static). 'rubble' comes with the themes' masonry (51-themes.js); without it the tops stay plain
  walls: { 1: { h: 38, cut: true, cutH: 6, top: '#57506a', side: '#3d3750', line: '#2a2538', course: 8, roof: 'rubble' }, 2: { h: 36, top: '#6a6280', side: '#4a4360', line: '#302a40', course: 10, roof: 'slab' }, 3: { h: 12, top: '#5d566f', side: '#433d55', line: '#2e2940', course: 6, roof: 'slab' } },
  // the void under a chasm (composed depths put the crypt on islands and rings): rock hangs into it (51-themes.js)
  floor: (L0, x, y, tag) => { const c = cryptFloor(L0, x, y, tag, L0.pal); return c === null && tag === 'pit' && typeof WLD_cliff === 'function' ? WLD_cliff(L0, x, y) : c; },
  back: { sky: ['#04030a', '#0c0a18', '#16122a', '#221a30'], layers: [{ kind: 'fog', color: '#2a2440', y: .6, height: .24, parallax: .1, drift: 2 }, { kind: 'fog', color: '#2f7f82', y: .95, height: .18, parallax: .22, drift: 4 }] },
  decorate(L0, R) {
    if (typeof WLD_dress !== 'function') {   // the core alone: a prop in half the rooms, a cobweb in some corners
      for (const r0 of L0.rooms) { if (R.chance(.5)) L0.props.push({ name: R.pick(['bones', 'skull', 'crate', 'pot', 'barrel']), x: (r0.x + 1 + R() * (r0.w - 2)) * T16, y: (r0.y + 1 + R() * (r0.h - 2)) * T16 }); if (R.chance(.35)) L0.props.push({ name: 'cobweb', x: (r0.x + .5) * T16, y: (r0.y + .5) * T16, o: { size: 1.2 } }); }
      return;
    }
    // a burial vault: stores stacked against the walls, sarcophagi, bones where they fell, candles left burning
    WLD_setup(L0, this);
    const store = (L1, R1, x, y, nx, ny) => { const ax = ny ? 1 : 0, ay = nx ? 1 : 0; for (let k = R1.int(1, 3), o = 0; k > 0; k--, o += R1.range(9, 12)) WLD_prop(L1, R1.pick(['barrel', 'barrel', 'crate']), x + ax * o - nx * R1.range(0, 3), y + ay * o - ny * R1.range(0, 3), { color: R1.pick(['#7a5a3a', '#6a4a32', '#5a4a3e']), size: R1.range(1, 1.2) }); };
    WLD_dress(L0, R, [
      { w: 2.2, edge: 1, gap: 26, f: store },
      { w: 2.2, f: WLD_pp('bones', R1 => ({ color: '#d8d0c0', size: R1.range(1, 1.3), flip: R1.chance(.5) })) }, { w: 1.5, f: WLD_pp('skull', { color: '#d8d0c0' }) },
      { w: 1.3, edge: 1, f: WLD_pp('pot', R1 => ({ color: R1.pick(['#8a5a3a', '#7a6a5a']), size: R1.range(.9, 1.2) })) },
      { w: 1.2, open: 1, gap: 22, f: WLD_dd('coffin', R1 => ({ solid: true, alongY: R1.chance(.5), color: '#5d566f' })) },
      { w: .8, edge: 1, f: WLD_pp('statue', R1 => ({ color: '#6a6280', size: R1.range(1.1, 1.3), flip: R1.chance(.5) })) },
      { w: .9, edge: 1, f: WLD_pp('pillar', R1 => ({ broken: true, color: '#6a6280', size: R1.range(1, 1.25), flip: R1.chance(.5) })) },
      { w: 1.3, edge: 1, f: WLD_pp('candle', R1 => ({ size: R1.range(1, 1.3) })) },
      { w: .5, f: WLD_dd('chain', R1 => ({ cage: R1.chance(.5), len: R1.range(30, 48) })) },
      { w: .5, edge: 1, inset: 6, f: WLD_dd('skullpile', { solid: true }) }
    ], 16, 3, 7);
    for (const r0 of L0.rooms) if (R.chance(.45)) WLD_prop(L0, 'cobweb', (r0.x + .5) * T16, (r0.y + .5) * T16, { size: R.range(1.1, 1.4) });
  },
  ambience(L0, dt) { if (typeof WLD_mood !== 'function') return; WLD_mood(this); WLD_motes(dt, 3, (x, y) => ({ kind: 'dust', x, y, z: 30 + Math.random() * 30, vx: 1.5, vy: 1, vz: -3, max: 5, size: .8, color: '#8a809a' })); }
});
/* ---------- standard floor tags: every theme renders them, the core applies their effects ----------
 * pit (nothing: the void shows; blocked for walkers), water (shallow: slows), deep (deep water: blocked), ice (no
 * traction), lava (burns), web (slows, fire clears it), blood, snow. A theme's floor() calls standardFloor first:
 *   const s = standardFloor(L, x, y, tag, base); if (s !== undefined) return s;   // base(x, y) = the theme's own floor */
const STD_TAGS = ['pit', 'water', 'deep', 'ice', 'lava', 'web', 'blood', 'snow'];
function standardFloor(L0, x, y, tag, base) {
  if (!tag || !STD_TAGS.includes(tag)) return undefined;
  if (tag === 'pit') {   // the edge of a chasm: a lip of darker stone, then nothing
    const cx = Math.floor(x / T16), cy = Math.floor(y / T16), lx = x - cx * T16, ly = y - cy * T16, m = L0.map, tg = (a, b) => m && m.floorTags ? m.floorTags[b * L0.w + a] : null;
    const lip = (tg(cx, cy - 1) !== 'pit' && ly < 3) || (tg(cx - 1, cy) !== 'pit' && lx < 3);
    if (lip && m && m.cell(cx, cy - (ly < 3 ? 1 : 0)) === 0) { const b = base(x, y); return b ? b.map((v, i) => i < 3 ? v * (.45 + (ly < 3 ? ly : lx) * .08) : v) : null; }
    return null;
  }
  const n = E.noise2(x * .06, y * .06);
  if (tag === 'water' || tag === 'deep') {   // bands of depth, a caustic net of light, wind crests in patches, shallows (no per-pixel speckle)
    const deep = tag === 'deep', w = Math.sin(x * .3 + Math.sin(y * .15) * 2 + y * .04), n2 = E.noise2(x * .1 + 3, y * .1 - 7);
    const c = deep ? (n > .5 ? [26, 58, 110] : [20, 46, 92]) : (n > .5 ? [52, 110, 160] : [42, 92, 140]);
    if (w > .95 && n2 > .56) return deep ? [70, 120, 180] : [150, 205, 235];
    if (Math.abs(n2 - .5) < .016) return deep ? [34, 72, 128] : [72, 136, 186];
    if (!deep && n < .3) { const b = base(x, y); if (b) return b.map((v, i) => i < 3 ? v * .4 + c[i] * .6 : v); }   // the floor shows through the shallows
    return c;
  }
  if (tag === 'ice') {
    const crack = Math.abs(E.noise2(x * .08, y * .08) - .5) < .02 || Math.abs(E.noise2(x * .05 + 9, y * .05) - .5) < .012;
    if (crack) return [108, 146, 186];   // (kept well below white: the lights add their colour on top, and pale ice bleached out)
    const streak = ((x + y * .6) % 23 + 23) % 23 < 1.2 && n > .45;
    return streak ? [200, 226, 244] : n > .55 ? [150, 186, 214] : [132, 170, 204];
  }
  if (tag === 'lava') {
    const crust = E.noise2(x * .09, y * .09) * .7 + E.noise2(x * .3, y * .3) * .3;
    if (crust > .62) return crust > .72 ? [58, 30, 26] : [96, 40, 26];
    return crust > .5 ? [220, 90, 30, .8] : crust > .35 ? [255, 150, 50, 1] : [255, 214, 110, 1];
  }
  const b = base(x, y) || [40, 36, 48];
  if (tag === 'web') {
    const u = x / T16, v = y / T16, fu = u - Math.floor(u), fv = v - Math.floor(v), ring = Math.hypot(fu - .5, fv - .5);
    const strand = Math.abs(fu - fv) < .03 || Math.abs(fu + fv - 1) < .03 || Math.abs(fu - .5) < .025 || Math.abs(fv - .5) < .025 || Math.abs(ring - .3) < .02 || Math.abs(ring - .45) < .02;
    return strand ? [230, 230, 236] : b.map((v2, i) => i < 3 ? v2 * .8 + 30 : v2);
  }
  if (tag === 'blood') {   // pools with a dark rim and a glossy sheen (blotches, not per-pixel speckle), a stain around them
    if (n > .45) return n < .47 ? [70, 12, 20] : E.noise2(x * .18 + 5, y * .18) > .63 ? [146, 36, 46] : [106, 18, 28];
    return b.map((v2, i) => i < 3 ? v2 * .7 + (i === 0 ? 30 : 0) : v2);
  }
  if (tag === 'snow') return E.hash2(Math.floor(x / 2), Math.floor(y / 2)) > .985 ? [226, 234, 246] : n > .6 ? [206, 214, 230] : n < .32 ? [176, 188, 210] : [190, 200, 220];
  return undefined;
}
/** what standing on a tag does (hero and monsters alike): the core rules every theme and mechanic share */
function floorEffects(u, dt) {
  const m = ED.L && ED.L.map; if (!m || !m.floorTags || u.canFly || (u.z || 0) > 2) return;
  const tag = m.floorAt(u.x, u.y); if (!tag) return;
  if (tag === 'water') { u.speedK = (u.speedK === undefined ? 1 : u.speedK) * .78; if (Math.random() < dt * Math.hypot(u.vx || 0, u.vy || 0) * .08) P.ring(u.x, u.y, 2, 9, '#bfe8ff', .3); }
  else if (tag === 'ice') u.traction = Math.min(u.traction === undefined ? 1 : u.traction, .12);
  else if (tag === 'web') u.speedK = (u.speedK === undefined ? 1 : u.speedK) * .45;
  else if (tag === 'lava' && !(u.res && u.res.fire >= .75)) { u.lavaT = (u.lavaT || 0) - dt; if (u.lavaT <= 0) { u.lavaT = .5; dealDamage(u, { src: null, amount: (u.team === 'hero' ? u.maxHp * .06 : u.boss ? u.maxHp * .008 : u.maxHp * .08) + 2, el: 'fire', kb: 0, statusChance: 1, noNumber: u.team !== 'hero', tags: ['floor'] }); } }
}
/** flagstones with rune circles around every rune point (L.runes), moss creeping in from the walls */
function cryptFloor(L0, x, y, tag, pal) {
  const P0 = L0._pal || (L0._pal = { stones: pal.stones.map(E.hex), mortar: E.hex(pal.mortar), hi: E.hex(pal.hi), lo: E.hex(pal.lo), speck: E.hex(pal.speck), moss: pal.moss.map(E.hex), rune: [...E.hex(pal.rune), .45], runeHi: [...E.hex(pal.runeHi), 1] });
  if (tag) { const sf = standardFloor(L0, x, y, tag, (a, b) => cryptFloor(L0, a, b, null, pal)); if (sf !== undefined) return sf; }
  for (const rc of L0.runes || []) {
    const dx = x - rc.x, dy = y - rc.y, d = Math.hypot(dx, dy), R0 = rc.r;
    if (d > R0 + 2) continue;
    if (Math.abs(d - R0) < .8 || Math.abs(d - R0 * .8) < .6) return P0.rune;
    if (d > R0 * .8 && d < R0) { const a = (Math.atan2(dy, dx) / TAU + 1) * 16; if (a % 1 < .05) return P0.rune; if (Math.abs(d - R0 * .9) < 2 && E.hash2(Math.floor(a), Math.floor(d * .5)) > .35 && ((Math.floor(x) + Math.floor(y)) & 1)) return P0.runeHi; }
    if (d < R0 * .13) return d < R0 * .055 ? P0.runeHi : E.tex.flagstone(x, y, P0);
  }
  let c = E.tex.flagstone(x, y, P0);
  const cx = Math.floor(x / T16), cy = Math.floor(y / T16), m = L0.map;
  let wall = 0; if (m) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (m.cell(cx + ox, cy + oy) === 1) wall = 1;
  if (wall && E.noise2(x * .13, y * .13) > .55) c = P0.moss[E.hash2(x | 0, y | 0) < .5 ? 0 : 1];
  return c;
}

/* ---------- building a level from a recipe ---------- */
/** past the plan every level turns its theme's hue, but materials stay near their own: wood, brass, bone and sand
 *  (warm and not vivid) turn at most 20 degrees, so brass never goes lime, bone never green, wood never violet;
 *  stone, moss, ice, glows and skies turn freely. A turned material never comes out brighter than it went in (a few
 *  percent of luma at most): at one HSL lightness green and yellow read far brighter than blue, so pale ice turned mint
 *  glared and swallowed white skeletons. Glows (vivid colours) keep their lightness. levelPal is shiftPal with those
 *  rules, and lk scales the lightness of every material (a pale theme passes .9 when it turns: th.pale); 51-themes.js
 *  uses levelHue for its decorations */
const LVL_HUE = new Map();   // memo: decorations ask for their colours every frame
const lvlLuma = c => { const [r, g, b] = E.hex(c); return .2126 * r + .7152 * g + .0722 * b; };
function levelHue(c, deg, lk = 1) {
  if ((!deg && lk === 1) || typeof c !== 'string' || c[0] !== '#') return c;
  const key = c + '|' + deg + '|' + lk; let v = LVL_HUE.get(key); if (v) return v;
  const [h, s, l] = E.toHsl(c); let d = ((deg % 360) + 540) % 360 - 180;
  if (h >= 16 && h <= 62 && s > .12 && s < .7) d = clamp(d, -20, 20);
  v = hueShift(c, d);
  if (s < .72) {   // a material: hold its brightness (a few steps of HSL lightness find it), then scale it for a pale theme
    const cap = lvlLuma(c) * lk * 1.04 + 2; let L1 = l * lk;
    for (let k = 0; k < 4 && lvlLuma(E.hsl(h + d, s, L1)) > cap; k++) L1 *= cap / Math.max(1, lvlLuma(E.hsl(h + d, s, L1)));
    if (L1 !== l) v = E.hsl(h + d, s, clamp(L1, 0, 1));
  }
  if (LVL_HUE.size > 4000) LVL_HUE.clear();
  LVL_HUE.set(key, v); return v;
}
const levelPal = (pal, deg, lk = 1) => { const o = {}; for (const k in pal) o[k] = levelHue(pal[k], deg, lk); return o; };
function buildLevel(rec) {
  const R = RNG(rec.seed), th = REG.themes[rec.theme] || REG.themes.crypt, lay = REG.layouts[rec.layout] || REG.layouts.halls;
  const G0 = lay.gen(R, { w: rec.size[0], h: rec.size[1], depth: rec.depth });
  const L0 = { kind: 'level', rec, depth: rec.depth, name: rec.name, theme: th, hue: rec.hue || 0, w: G0.w, h: G0.h, cells: G0.cells, tags: G0.tags, rooms: G0.rooms,
    things: [], props: [], torches: [], runes: [], mechs: rec.mechs.slice(), seen: new Uint8Array(G0.w * G0.h), t: 0 };
  // (a pale theme, th.pale, dims a little when it turns: its floor and walls keep their contrast with the units)
  const lk = L0.hue && th.pale ? th.pale : 1;
  L0.pal = levelPal(th.pal || CRYPT, L0.hue, lk);
  // walls: the theme's types, recolored for deep levels; the exit gets a rune circle
  const types = {}; for (const k in th.walls) types[k] = levelPal(th.walls[k], L0.hue, lk);
  const [sx, sy] = G0.start, [ex, ey] = G0.exit;
  // the landing and the waystone stand on open floor, whatever the layout: no pillar or low wall inside their rune
  // circles (a halls low wall across the exit cell once left the waystone out of reach)
  for (const [qx, qy] of [G0.start, G0.exit]) for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const k = (qy + j) * G0.w + qx + i, c = G0.cells[k]; if ((c === 2 || c === 3) && i * i + j * j <= 5) G0.cells[k] = 0; }
  L0.start = { x: (sx + .5) * T16, y: (sy + .5) * T16 }; L0.exit = { x: (ex + .5) * T16, y: (ey + .5) * T16, open: !rec.boss };
  L0.runes.push({ x: L0.start.x, y: L0.start.y, r: 30 }, { x: L0.exit.x, y: L0.exit.y, r: 26 });
  const floorTag = G0.tags.slice();
  L0.map = new E.TileMap({ w: G0.w, h: G0.h, tile: T16, cells: G0.cells, types, floorTex: (x, y, tag) => th.floor(L0, x, y, tag) });
  L0.map.floorTags = floorTag; L0.map.blocked = new Uint8Array(G0.w * G0.h);
  L0.map.floorTags.forEach((t, i) => { if (t === 'pit' || t === 'deep') L0.map.blocked[i] = 1; });
  deepCutaway(L0.map);
  L0.flow = new E.FlowField(L0.map);
  L0.randomFloor = (Rr, o = {}) => randomFloor(L0, Rr, o);
  // light sources along the rooms (braziers stand in the room, sconces on walls)
  // (th.lightR / th.lightI: a pale theme's braziers reach less far and burn less bright, or they bleach its floor)
  const torch = (x, y) => L0.torches.push({ x, y, t: R() * 9, kind: th.torch || 'brazier', color: th.light || '#ff9a4a', r: 4.5, solid: true, radius: th.lightR, i: th.lightI });
  for (const r0 of G0.rooms) {
    if (r0.kind === 'arena' && r0.ir) {   // a boss arena: braziers by its wall, in the gaps of the pillar ring, frame the fight; none stand in it
      const n = r0.pillars || 8;          // the pillars stand at (k + .5) / n of the way round from north, the gaps at k / n
      for (let k = 1; k < n; k++) {
        if (k === n / 2 || (n > 8 && !(k & 1))) continue;   // not across the gate; every other gap in the bigger rings
        const a = -Math.PI / 2 + k / n * TAU;
        for (const rr of [1.8, 2.4, 1.2]) { const cx = r0.ix + Math.cos(a) * (r0.ir - rr), cy = r0.iy + Math.sin(a) * (r0.ir - rr); if (L0.map.walkable(Math.floor(cx), Math.floor(cy))) { torch(cx * T16, cy * T16); break; } }
      }
      continue;
    }
    const n = Math.max(1, Math.round((r0.w * r0.h) / 60 * (th.lights || 1)));
    for (let i = 0; i < n; i++) { const x = (r0.x + 1.5 + R() * (r0.w - 3)) * T16, y = (r0.y + 1.5 + R() * (r0.h - 3)) * T16; if (L0.map.walkable(Math.floor(x / T16), Math.floor(y / T16)) && Math.hypot(x - L0.start.x, y - L0.start.y) > 40 && Math.hypot(x - L0.exit.x, y - L0.exit.y) > 34) torch(x, y); }
  }
  if (th.decorate) th.decorate(L0, R);
  // the mechanics place their things (a missing mechanic is skipped: the level still plays)
  for (const id of L0.mechs) { const M = REG.mechanics[id]; if (M && M.place) M.place(L0, R); }
  // the mechanics reshape the floor after the theme dressed it (a flood's canals, chasms, lava): set dressing left
  // standing in deep water, lava, the void or a wall goes (hanging things, z > 0, and decorations meant to float over
  // the void, overVoid, stay)
  const sunk = (x, y) => { const cx = Math.floor(x / T16), cy = Math.floor(y / T16), t = L0.map.floorTags[cy * L0.w + cx]; return L0.map.cell(cx, cy) !== 0 || t === 'deep' || t === 'pit' || t === 'lava'; };
  L0.props = L0.props.filter(p => (p.z || 0) > 0 || !sunk(p.x, p.y)); L0.torches = L0.torches.filter(b => !sunk(b.x, b.y));
  L0.things = L0.things.filter(t => t.kind !== 'deco' || t.overVoid || !sunk(t.x, t.y));
  // monsters: packs in every room but the first, a rare pack guarding the exit room, champions here and there
  const depth = rec.depth, rooms = G0.rooms.slice(1);
  L0.packs = [];
  for (const r0 of rooms) {
    const area = r0.w * r0.h, packs = Math.max(1, Math.round(area / 55 * DIFF.density * TUNE.packsPerRoom * (1 + Math.min(depth, 60) * .02)));   // (crowds thicken to depth 60, then the stats carry the climb)
    for (let k = 0; k < packs; k++) L0.packs.push({ x: (r0.x + 1 + R() * (r0.w - 2)) * T16, y: (r0.y + 1 + R() * (r0.h - 2)) * T16, elite: 0 });
  }
  R.shuffle(L0.packs);
  for (let i = 0; i < Math.min(L0.packs.length, Math.max(0, 1 + Math.floor(depth / 4) + TUNE.championPacks)); i++) L0.packs[i].elite = 1;
  if (!rec.boss) L0.packs.push({ x: L0.exit.x + 20, y: L0.exit.y + 10, elite: 2 });
  return L0;
}
/** walls that stand in front of any floor within a few cells drop to their cut height (not just the first row),
 *  so the solid rock between rooms never hides the hero in the tilted views */
function deepCutaway(map, reach = 4) {
  map._isFront = function (cx, cy, view) {
    if (!this.cutaway || view.isTop || view.pitchDeg > 75) return false;
    const t = this.types[this.cell(cx, cy)]; if (!t || !t.cut) return false;
    const bx = -Math.round(view.fx), by = -Math.round(view.fy);
    for (let k = 1; k <= reach; k++) if ((bx && this.cell(cx + bx * k, cy) === 0) || (by && this.cell(cx, cy + by * k) === 0) || (bx && by && this.cell(cx + bx * k, cy + by * k) === 0)) return true;
    return false;
  };
  return map;
}
/** a random walkable point in the level. o: { minStart (distance from the start), edge (cells from walls), room } */
function randomFloor(L0, R, o = {}) {
  for (let k = 0; k < 80; k++) {
    const r0 = o.room || R.pick(L0.rooms), cx = r0.x + 1 + R.int(0, Math.max(0, r0.w - 3)), cy = r0.y + 1 + R.int(0, Math.max(0, r0.h - 3));
    if (!L0.map.walkable(cx, cy)) continue;
    if (o.edge) { let ok = true; for (let dy = -o.edge; dy <= o.edge && ok; dy++) for (let dx = -o.edge; dx <= o.edge; dx++) if (!L0.map.walkable(cx + dx, cy + dy)) { ok = false; break; } if (!ok) continue; }
    const x = (cx + .2 + R() * .6) * T16, y = (cy + .2 + R() * .6) * T16;
    if (o.minStart && Math.hypot(x - L0.start.x, y - L0.start.y) < o.minStart) continue;
    if (o.minExit && Math.hypot(x - L0.exit.x, y - L0.exit.y) < o.minExit) continue;
    return [x, y];
  }
  return [L0.start.x + 20, L0.start.y];
}
/** spawn the level's packs (called when the level starts; the rare at the exit last) */
/** the deeper, the stranger the packs: an element (recolor + status), a shared affix, giants and swarms */
function packVariant(depth, R) {
  const v = {};
  if (depth > 4 && R.chance(Math.min(.55, (depth - 4) * .05))) v.el = R.pick(['fire', 'frost', 'storm', 'void', 'venom']);
  if (depth > 11 && R.chance(Math.min(.45, (depth - 11) * .03))) { const aff = Object.values(REG.affixes).filter(a => (a.minDepth || 1) <= depth); if (aff.length) v.affix = R.pick(aff).id; }
  if (depth > 17) { const k = R(); if (k < .14) Object.assign(v, { scale: 1.32, hpMul: 1.9, dmgMul: 1.3, speedMul: .82, prefix: 'Giant' }); else if (k < .24) Object.assign(v, { scale: .78, hpMul: .45, dmgMul: .7, speedMul: 1.25, count: 2, prefix: 'Swarming' }); }
  return v;
}
function populate(L0) {
  const R = RNG(L0.rec.seed + 99);
  for (const p of L0.packs) { const v = packVariant(L0.rec.depth, R); spawnPack(p.x, p.y, { pool: L0.rec.pool, elite: p.elite, rng: R, instant: true, n: p.elite === 2 ? 3 + R.int(0, 2) : undefined, el: v.el, mod: v }); }
  if (L0.rec.boss) spawnBoss(L0.rec.boss, L0.exit.x, L0.exit.y - 10, { hue: L0.hue, dormant: true });
}

/* ---------- drawing a level: floor, walls, torches, props, things ---------- */
const flicker = t => .9 + Math.sin(t * 13) * .05 + Math.sin(t * 29) * .04 + Math.sin(t * 7.3) * .04;
function drawBrazier(g, r, b) { drawBrazierBase(g, r, b); drawBrazierFlame(g, r, b); }
function drawBrazierBase(g, r, b) {
  r.box(g, b.x - 3, b.y - 3, 0, b.x + 3, b.y + 3, 8, '#5d566f', '#433d55');
  px.poly(g, r.groundPts(b.x, b.y, 5.5, 14, 11), '#2b2430'); px.poly(g, r.groundPts(b.x, b.y, 5.5, 14, 9), '#3a3036');
}
function drawBrazierFlame(g, r, b) {
  px.glow(g, .9); px.poly(g, r.groundPts(b.x, b.y, 4, 12, 11.2), b.color === '#ff9a4a' ? '#ff8a3c' : b.color);
  const sc = r.view.scale, t = b.t, hot = b.color === '#ff9a4a' ? ['#ff7a2a', '#ffd36a'] : [b.color, E.tones(b.color).hi];
  for (let k = 0; k < 3; k++) {
    const a = k * 2.1 + t * .6, bx = b.x + Math.cos(a) * 1.6, by = b.y + Math.sin(a) * 1.6, h = 7 + Math.sin(t * 9 + k * 2) * 2.2 + Math.sin(t * 17 + k) * 1.2, sw = Math.sin(t * 6 + k * 1.7) * 1.4;
    const [x0, y0] = r.w(bx, by, 11), [tx, ty] = r.w(bx + sw, by, 11 + h), w = 2.2 * sc;
    px.poly(g, [[x0 - w, y0], [tx, ty], [x0 + w, y0]], hot[0]);
    const [mx, my] = r.w(bx + sw * .5, by, 11 + h * .65); px.poly(g, [[x0 - w * .55, y0], [mx, my], [x0 + w * .55, y0]], hot[1]);
  }
}
function drawTorches(L0, r) {
  let heats = 0;
  for (const b of L0.torches) {
    b.t += 1 / 60;
    if (b.kind === 'brazier') { if (r.visible(b.x, b.y, 0)) { r.queue(b.x, b.y, 0, g => drawBrazierBase(g, r, b)); r.queue(b.x, b.y, 11, g => drawBrazierFlame(g, r, b), { emissive: true, bias: .002 }); if (heats++ < 6) L.heat(b.x, b.y, 17, 7, 1.1); } }
    else r.prop(b.kind, b.x, b.y, 0, { size: b.size || 1.2, halo: true });
    if (r.visible(b.x, b.y, 0, 200, 200, 200)) L.add(b.x, b.y, 16, b.radius || 124, (b.i || 1.25) * flicker(b.t), { color: b.color, shadow: true });
    L.caster(b.x, b.y, 4.5, 11);
  }
}
function drawProps(L0, r) { for (const p of L0.props) if (p.shape) r.shape(p.shape, p.x, p.y, p.z || 0, p.so); else r.prop(p.name, p.x, p.y, p.z || 0, p.o || {}); }   // (p.shape: WLD_shape's)
/** the exit waystone: a crystal floating over its rune circle, a faint beam of light rising from it so it can be found
 *  across a room. While the level's boss lives it lies dormant, sunk in the floor (dark, small, no glow: the boss
 *  stands over it); when the boss falls it rises out of the floor and wakes */
function drawExit(L0, r) {
  const e = L0.exit, t = game.time, open = e.open;
  if (!open) e.shut = true; else if (e.shut) { e.shut = false; e.openAt = t; P.ring(e.x, e.y, 2, 34, '#6fd6cc', .5); P.glints(e.x, e.y, 6, 10, '#bff6ff', 16); }
  const u = open ? (e.openAt === undefined ? 1 : clamp((t - e.openAt) / 1.4, 0, 1)) : 0, k = E.ease.outBack(u);
  const bob = Math.sin(t * 2) * 2 * u, z = lerp(3, 18, k) + bob, sz = lerp(.7, 1, k);
  r.decal(() => { if (open) { r.groundRing(e.x, e.y, 14 + Math.sin(t * 3) * 1.5, '#6fd6cc', .8 * u); r.groundDisc(e.x, e.y, 12, '#2f7f82', .3 * u); } else r.groundDisc(e.x, e.y, 6, '#1a1422', .5); }, { emissive: open ? .8 * u : 0 });
  if (!r.visible(e.x, e.y, 0, 60, 90)) return;
  r.queue(e.x, e.y, 0, g => {
    const [x, y] = r.w(e.x, e.y, z), s = (r.view.zoom || 1) * sz;
    if (open) {
      px.glow(g, 1); r.glowDisc(g, x, y, 12 * s, '#6fd6cc', .4 * u);
      // the beacon: a thin shaft of light over the crystal, breathing, a pulse of light climbing it now and then (thinner
      // and taller than a ward's column, and additive, so it never hides what is behind it)
      const [, yt] = r.w(e.x, e.y, z + 96), a = (.16 + .08 * Math.sin(t * 2.6)) * u, zm = r.view.zoom || 1, bw = Math.max(1, Math.round(zm));
      if (yt < y - 12 * s) {
        px.blend(g, a, 'add', () => { px.rect(g, Math.round(x) - bw, yt, bw * 2, y - 9 * s - yt, '#6fd6cc'); px.rect(g, Math.round(x) - (bw >> 1), yt, Math.max(1, bw), y - 9 * s - yt, '#e0fff8'); });
        const ph = (t * .55) % 1, [, yp] = r.w(e.x, e.y, z + 10 + ph * 80);
        px.blend(g, (1 - ph) * .55 * u, 'add', () => px.ell(g, x, yp, (4 - ph * 2) * zm, 1.3 * zm, '#bff6ff'));
      }
    }
    const hi = open ? '#e0fff8' : '#5a4e6c', base = open ? '#8ff0e0' : '#3a3048', sh = open ? '#4fb8b0' : '#261e32';
    px.poly(g, [[x, y - 9 * s], [x + 4 * s, y], [x, y + 7 * s], [x - 4 * s, y]], base);
    px.poly(g, [[x, y - 9 * s], [x, y + 7 * s], [x - 4 * s, y]], hi);
    px.poly(g, [[x + 4 * s, y], [x, y + 7 * s], [x + 1 * s, y + 1 * s]], sh);
    if (!open) px.dot(g, x - 1 * s, y - 3 * s, '#8a6ab8');   // one cold spark left in it
  }, { emissive: open });
  if (open) { L.add(e.x, e.y, 20, 90, (.9 + .2 * Math.sin(t * 4)) * (.3 + .7 * u), { color: '#6fd6cc' }); if (Math.random() < (u < 1 ? .8 : .2)) P.glints(e.x, e.y, z, 1, '#bff6ff', 14); }
}
