/* =============================================================================
 * LAYOUTS: the shapes of the deep beyond the core's halls
 *   islands  floating islands over the void, joined by narrow bridges (the chasm depths, the sky spires)
 *   caves    organic caves: noisy chambers, winding tunnels with chokepoints, rock pillars, dead-end pockets
 *   arena    a round or octagonal boss arena with a pillared ring, an antechamber and two side vaults
 *   ring     a ring gallery around a central well of void, chambers off it, sometimes a bridge across
 * Every layout returns cells (0 floor, 1 rock, 2 pillar, 3 low wall), per-cell floor tags ('pit' = void, 'bridge'),
 * rooms (the open spaces: each room rect is walkable ground, so packs, torches and mechanics can use it) and
 * start / exit. rooms[0] never gets monster packs (buildLevel skips it): the start room, or the boss arena.
 * Extra facts for themes ride on the rooms: room.kind ('island' 'chamber' 'arena' 'vault' 'ring'), island centers
 * and radii (ix, iy, ir), and rooms.extra (open spaces that are not rooms, like the arena's antechamber).
 * ============================================================================= */
/** is a cell open ground (floor and not void) */
const WLD_open = (cells, tags, w, i) => cells[i] === 0 && tags[i] !== 'pit';
/** the biggest walkable rectangle around cell (cx, cy): grow a square first, then each side while it stays open */
function WLD_rect(cells, tags, w, h, cx, cy, max = 99) {
  const ok = (x, y) => x > 0 && y > 0 && x < w - 1 && y < h - 1 && WLD_open(cells, tags, w, y * w + x);
  if (!ok(cx, cy)) return null;
  let x0 = cx, x1 = cx, y0 = cy, y1 = cy;
  const col = (x, a, b) => { for (let y = a; y <= b; y++) if (!ok(x, y)) return false; return true; };
  const row = (y, a, b) => { for (let x = a; x <= b; x++) if (!ok(x, y)) return false; return true; };
  while (x1 - x0 < max && col(x0 - 1, y0 - 1, y1 + 1) && col(x1 + 1, y0 - 1, y1 + 1) && row(y0 - 1, x0, x1) && row(y1 + 1, x0, x1)) { x0--; x1++; y0--; y1++; }
  for (let grow = true; grow;) {
    grow = false;
    if (x1 - x0 < max && col(x0 - 1, y0, y1)) { x0--; grow = true; } if (x1 - x0 < max && col(x1 + 1, y0, y1)) { x1++; grow = true; }
    if (y1 - y0 < max && row(y0 - 1, x0, x1)) { y0--; grow = true; } if (y1 - y0 < max && row(y1 + 1, x0, x1)) { y1++; grow = true; }
  }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, cx: (x0 + x1 + 1) / 2, cy: (y0 + y1 + 1) / 2 };
}
/** walking distance (4-neighbour steps over open ground) from cell s to every cell; -1 where unreachable */
function WLD_bfs(cells, tags, w, h, s) {
  const d = new Int32Array(w * h).fill(-1), q = new Int32Array(w * h); let qh = 0, qt = 0;
  if (!WLD_open(cells, tags, w, s)) return d;
  d[s] = 0; q[qt++] = s;
  while (qh < qt) {
    const c = q[qh++], x = c % w, y = (c / w) | 0;
    if (x > 0 && d[c - 1] < 0 && WLD_open(cells, tags, w, c - 1)) { d[c - 1] = d[c] + 1; q[qt++] = c - 1; }
    if (x < w - 1 && d[c + 1] < 0 && WLD_open(cells, tags, w, c + 1)) { d[c + 1] = d[c] + 1; q[qt++] = c + 1; }
    if (y > 0 && d[c - w] < 0 && WLD_open(cells, tags, w, c - w)) { d[c - w] = d[c] + 1; q[qt++] = c - w; }
    if (y < h - 1 && d[c + w] < 0 && WLD_open(cells, tags, w, c + w)) { d[c + w] = d[c] + 1; q[qt++] = c + w; }
  }
  return d;
}
/** a blob whose edge wobbles: a few sines around the circle (whole cycles, so it closes) */
function WLD_blob(R, r) { const ph = [R() * TAU, R() * TAU, R() * TAU], k = [R.range(.07, .19), R.range(.05, .13), R.range(.03, .07)]; return a => r * (1 + k[0] * Math.sin(3 * a + ph[0]) + k[1] * Math.sin(5 * a + ph[1]) + k[2] * Math.sin(8 * a + ph[2])); }
/** join a set of nodes with a spanning tree (nearest first, by gap between their edges) plus a few loops */
function WLD_tree(R, nodes, loops, maxLoop) {
  const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) - (a.r || 0) - (b.r || 0), edges = [], joined = [0], rest = nodes.map((_, i) => i).slice(1);
  while (rest.length) {
    let bi = 0, bj = 0, bd = 1e9;
    rest.forEach((i, ii) => joined.forEach(j => { const d = gap(nodes[i], nodes[j]); if (d < bd) { bd = d; bi = ii; bj = j; } }));
    edges.push([rest[bi], bj]); joined.push(rest.splice(bi, 1)[0]);
  }
  const has = (a, b) => edges.some(e => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a));
  const cand = []; for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) if (!has(i, j) && gap(nodes[i], nodes[j]) < maxLoop) cand.push([i, j]);
  R.shuffle(cand); for (let k = 0; k < loops && k < cand.length; k++) edges.push(cand[k]);
  return edges;
}
/** the node farthest by walking from node 0 (the exit goes there), among those allowed */
function WLD_farthest(cells, tags, w, h, nodes, ok = () => true) {
  const d = WLD_bfs(cells, tags, w, h, Math.floor(nodes[0].cy) * w + Math.floor(nodes[0].cx));
  let best = nodes[nodes.length - 1], bd = -1;
  for (const n of nodes.slice(1)) { const v = d[Math.floor(n.cy) * w + Math.floor(n.cx)]; if (v > bd && ok(n)) { bd = v; best = n; } }
  return best;
}

/* ---------- ISLANDS: floating islands over the void, joined by narrow bridges ----------
 * Everything between them is 'pit' (void): no outer walls, the void blocks walkers (monsters knocked back fly
 * over it and fall). A margin of void on every side leaves room for the rock the islands hang from. */
def('layouts', 'islands', { name: 'Islands', gen(R, o) {
  const w = 56, h = 56, M = 6, cells = new Array(w * h).fill(0), tags = new Array(w * h).fill('pit'), isl = [];
  const set = (x, y, v) => { if (x >= 1 && y >= 1 && x < w - 1 && y < h - 1) tags[y * w + x] = v; };
  // islands: the first (the start) is broad enough for the landing rune; the rest spread with void gaps between
  for (let tries = 0; tries < 900 && isl.length < 12; tries++) {
    const r = isl.length === 0 ? R.range(5.4, 6.3) : R.range(3.7, 6.4), x = R.range(M + r, w - M - r), y = R.range(M + r, h - M - r);
    if (isl.some(q => Math.hypot(q.x - x, q.y - y) < q.r + r + R.range(3.2, 5.6))) continue;
    isl.push({ x, y, r, edge: WLD_blob(R, r) });
  }
  for (const q of isl) for (let y = Math.floor(q.y - q.r * 1.5); y <= q.y + q.r * 1.5; y++) for (let x = Math.floor(q.x - q.r * 1.5); x <= q.x + q.r * 1.5; x++) {
    const dx = x + .5 - q.x, dy = y + .5 - q.y; if (Math.hypot(dx, dy) <= q.edge(Math.atan2(dy, dx))) set(x, y, null);
  }
  // bridges: a spanning tree plus a loop or two, two cells wide (a 2x2 brush keeps them 4-connected on diagonals)
  const bridge = (a, b) => {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 4);
    for (let i = 0; i <= n; i++) { const t = i / n, px0 = Math.floor(lerp(a.x, b.x, t) - .5), py0 = Math.floor(lerp(a.y, b.y, t) - .5); for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const x = px0 + ox, y = py0 + oy; if (x > 0 && y > 0 && x < w - 1 && y < h - 1 && tags[y * w + x] === 'pit') tags[y * w + x] = 'bridge'; } }
  };
  for (const [i, j] of WLD_tree(R, isl, R.int(1, 2), 7)) bridge(isl[i], isl[j]);
  // islets: small unreachable rocks drifting in the void (scenery: they hang from the dark like the big ones)
  for (let k = 0, tries = 0; k < 7 && tries < 200; tries++) {
    const r = R.range(.9, 1.9), x = R.range(M - 2, w - M + 2), y = R.range(M - 2, h - M + 2);
    let clear = true; for (let yy = Math.floor(y - r - 2); yy <= y + r + 2 && clear; yy++) for (let xx = Math.floor(x - r - 2); xx <= x + r + 2; xx++) if (xx < 0 || yy < 0 || xx >= w || yy >= h || tags[yy * w + xx] !== 'pit') { clear = false; break; }
    if (!clear) continue;
    k++; for (let yy = Math.floor(y - r); yy <= y + r; yy++) for (let xx = Math.floor(x - r); xx <= x + r; xx++) if (Math.hypot(xx + .5 - x, yy + .5 - y) <= r) set(xx, yy, null);
  }
  // rooms: the biggest open rectangle on each island (before ruins go on them), so packs and torches land on rock
  const rooms = [];
  for (const q of isl) { const rc = WLD_rect(cells, tags, w, h, Math.floor(q.x), Math.floor(q.y), 13); if (rc && rc.w >= 3 && rc.h >= 3) rooms.push(Object.assign(rc, { kind: 'island', ix: q.x, iy: q.y, ir: q.r })); }
  // ruins on the bigger islands: a broken colonnade, a stretch of balustrade on the rim (never near a bridge head)
  const nearBridge = (x, y, d) => { for (let yy = y - d; yy <= y + d; yy++) for (let xx = x - d; xx <= x + d; xx++) if (xx >= 0 && yy >= 0 && xx < w && yy < h && tags[yy * w + xx] === 'bridge') return true; return false; };
  const solidAround = (x, y) => { for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) if (tags[yy * w + xx] !== null) return false; return true; };
  rooms.forEach((rm, ri) => {
    if (rm.ir >= 5 && ri > 0 && R.chance(.55)) {
      const n = R.int(3, 5), a0 = R() * TAU;
      for (let k = 0; k < n; k++) { const a = a0 + k / n * TAU + R.range(-.2, .2), x = Math.floor(rm.ix + Math.cos(a) * rm.ir * .62), y = Math.floor(rm.iy + Math.sin(a) * rm.ir * .62); if (solidAround(x, y) && !nearBridge(x, y, 2) && Math.hypot(x + .5 - rm.ix, y + .5 - rm.iy) > 2.5) cells[y * w + x] = 2; }
    }
    if (R.chance(.4)) {
      const a0 = R() * TAU, len = R.int(3, 6);
      for (let k = 0; k < len * 3; k++) {
        const a = a0 + k * .09, x = Math.floor(rm.ix + Math.cos(a) * (rm.ir - .6)), y = Math.floor(rm.iy + Math.sin(a) * (rm.ir - .6)), i = y * w + x;
        if (tags[i] !== null || nearBridge(x, y, 3)) continue;
        let rim = false; for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (tags[i + oy * w + ox] === 'pit') rim = true;
        if (rim && Math.hypot(x + .5 - rm.ix, y + .5 - rm.iy) > 2.8) cells[i] = 3;
      }
    }
  });
  const exit = WLD_farthest(cells, tags, w, h, rooms, rm => rm.ir >= 4.3 && rm.w >= 4 && rm.h >= 4);
  // the exit room sits last, so the rare pack that guards it is found where the path ends
  return { w, h, cells, tags, rooms, start: [Math.floor(rooms[0].cx), Math.floor(rooms[0].cy)], exit: [Math.floor(exit.cx), Math.floor(exit.cy)], exitRoom: exit };
} });

/* ---------- CAVES: noisy chambers, winding tunnels (the chokepoints), pockets and rock pillars ----------
 * Chambers are wobbly blobs, tunnels are drunken walks two or three cells wide, then a cellular-automaton pass
 * roughens every edge (the cores of chambers and tunnels are protected, so nothing gets cut off). */
def('layouts', 'caves', { name: 'Caves', gen(R, o) {
  const w = 56, h = 56, cells = new Array(w * h).fill(1), tags = new Array(w * h).fill(null), core = new Uint8Array(w * h), ch = [];
  const carve = (x, y, keep) => { if (x >= 2 && y >= 2 && x < w - 2 && y < h - 2) { cells[y * w + x] = 0; if (keep) core[y * w + x] = 1; } };
  for (let tries = 0; tries < 700 && ch.length < 12; tries++) {
    const r = ch.length === 0 ? R.range(5, 5.8) : R.range(3.2, 6.6), x = R.range(3 + r, w - 3 - r), y = R.range(3 + r, h - 3 - r);
    if (ch.some(q => Math.hypot(q.x - x, q.y - y) < q.r + r + R.range(2.5, 5))) continue;
    ch.push({ x, y, r, edge: WLD_blob(R, r) });
  }
  for (const q of ch) for (let y = Math.floor(q.y - q.r * 1.4); y <= q.y + q.r * 1.4; y++) for (let x = Math.floor(q.x - q.r * 1.4); x <= q.x + q.r * 1.4; x++) {
    const dx = x + .5 - q.x, dy = y + .5 - q.y, d = Math.hypot(dx, dy), e = q.edge(Math.atan2(dy, dx)); if (d <= e) carve(x, y, d <= e * .62);
  }
  // tunnels: drunken walks toward the other chamber; their width breathes between two and three cells
  const tunnels = [];
  const tunnel = (a, b) => {
    let x = a.x, y = a.y, wob = R() * TAU; const ph = R() * TAU, pts = [];
    for (let s = 0; s < 500 && Math.hypot(b.x - x, b.y - y) > .8; s++) {
      wob += R.range(-.45, .45); const ang = Math.atan2(b.y - y, b.x - x) + Math.sin(wob) * .75;
      x += Math.cos(ang) * .5; y += Math.sin(ang) * .5; pts.push([x, y]);
      const rad = 1.02 + .55 * (.5 + .5 * Math.sin(s * .11 + ph));
      for (let yy = Math.floor(y - rad); yy <= y + rad; yy++) for (let xx = Math.floor(x - rad); xx <= x + rad; xx++) if (Math.hypot(xx + .5 - x, yy + .5 - y) <= rad) carve(xx, yy, false);
      carve(Math.floor(x), Math.floor(y), true);
    }
    tunnels.push(pts);
  };
  for (const [i, j] of WLD_tree(R, ch, R.int(2, 3), 9)) tunnel(ch[i], ch[j]);
  // pockets: small dead-end hollows off the tunnels (loot, ambushes, somewhere to catch your breath)
  for (let k = 0; k < 5 && tunnels.length; k++) {
    const t = R.pick(tunnels); if (t.length < 12) continue;
    const [x0, y0] = t[R.int(4, t.length - 5)], a = R() * TAU, d = R.range(2.2, 3.2), pr = R.range(1.5, 2.3), px0 = x0 + Math.cos(a) * d, py0 = y0 + Math.sin(a) * d;
    for (let yy = Math.floor(py0 - pr); yy <= py0 + pr; yy++) for (let xx = Math.floor(px0 - pr); xx <= px0 + pr; xx++) if (Math.hypot(xx + .5 - px0, yy + .5 - py0) <= pr) carve(xx, yy, false);
    for (let s = 0; s <= 6; s++) carve(Math.floor(lerp(x0, px0, s / 6)), Math.floor(lerp(y0, py0, s / 6)), true);
  }
  // roughen: nibble the walls, then two cellular-automaton passes (4-5 rule) with the cores held open
  for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) { const i = y * w + x; if (cells[i] === 1 && (cells[i - 1] === 0 || cells[i + 1] === 0 || cells[i - w] === 0 || cells[i + w] === 0) && R.chance(.3)) cells[i] = 0; }
  for (let pass = 0; pass < 2; pass++) {
    const nx = cells.slice();
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x; if (core[i]) { nx[i] = 0; continue; }
      if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) { nx[i] = 1; continue; }
      let n = 0; for (let yy = -1; yy <= 1; yy++) for (let xx = -1; xx <= 1; xx++) if (cells[i + yy * w + xx] !== 0) n++;
      nx[i] = n >= 5 ? 1 : 0;
    }
    for (let i = 0; i < w * h; i++) cells[i] = nx[i];
  }
  // anything the start cannot reach becomes rock again
  const s0 = Math.floor(ch[0].y) * w + Math.floor(ch[0].x), d0 = WLD_bfs(cells, tags, w, h, s0);
  for (let i = 0; i < w * h; i++) if (cells[i] === 0 && d0[i] < 0) cells[i] = 1;
  const rooms = [];
  ch.forEach((q, i) => { const rc = WLD_rect(cells, tags, w, h, Math.floor(q.x), Math.floor(q.y), 12); if (rc && rc.w >= 3 && rc.h >= 3 && (i === 0 || rooms.length)) rooms.push(Object.assign(rc, { kind: 'chamber', ix: q.x, iy: q.y, ir: q.r })); });
  const exit = WLD_farthest(cells, tags, w, h, rooms, rm => rm.w >= 4 && rm.h >= 4);
  // rock pillars and boulders in the big chambers; each one is kept only if every room is still reachable
  const reach = () => { const d = WLD_bfs(cells, tags, w, h, s0); return rooms.every(rm => d[Math.floor(rm.cy) * w + Math.floor(rm.cx)] >= 0); };
  for (const rm of rooms) {
    if (rm.ir < 4.6) continue;
    for (let k = R.int(1, 3); k > 0; k--) {
      const a = R() * TAU, d = rm.ir * R.range(.36, .62), x = Math.floor(rm.ix + Math.cos(a) * d), y = Math.floor(rm.iy + Math.sin(a) * d), big = R.chance(.35), put = [[x, y]].concat(big ? [[x + 1, y], [x, y + 1], [x + 1, y + 1]] : []);
      if (put.some(([px0, py0]) => cells[py0 * w + px0] !== 0 || Math.hypot(px0 + .5 - rooms[0].cx, py0 + .5 - rooms[0].cy) < 3.5 || Math.hypot(px0 + .5 - exit.cx, py0 + .5 - exit.cy) < 3.5)) continue;
      const v = R.chance(.75) ? 2 : 3; put.forEach(([px0, py0]) => { cells[py0 * w + px0] = v; });
      if (!reach()) put.forEach(([px0, py0]) => { cells[py0 * w + px0] = 0; });
    }
  }
  return { w, h, cells, tags, rooms, start: [Math.floor(rooms[0].cx), Math.floor(rooms[0].cy)], exit: [Math.floor(exit.cx), Math.floor(exit.cy)], exitRoom: exit };
} });

/* ---------- ARENA: a boss arena (round or octagonal) behind an antechamber with two side vaults ----------
 * The hero lands in the antechamber (south), the side vaults hold the level's packs, a gate leads north into the
 * arena. A ring of pillars stands inside the wall (cover, and something for charges to hit). The exit waystone
 * sits toward the far side, and the boss waits over it. rooms[0] is the arena, so no packs clutter the fight. */
def('layouts', 'arena', { name: 'Arena', bossOnly: true, gen(R, o) {
  const w = 52, h = 50, cells = new Array(w * h).fill(1), tags = new Array(w * h).fill(null);
  const cx = 26, cy = 20, Ra = R.int(12, 14), oct = R.chance(.5);
  const dist = (x, y) => { const dx = Math.abs(x + .5 - cx), dy = Math.abs(y + .5 - cy); return oct ? Math.max(dx, dy, (dx + dy) * Math.SQRT1_2) : Math.hypot(dx, dy); };
  const rect = (x, y, rw, rh) => { for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) if (i > 0 && j > 0 && i < w - 1 && j < h - 1) cells[j * w + i] = 0; };
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) if (dist(x, y) <= Ra) cells[y * w + x] = 0;
  const ante = { x: cx - 6, y: 37, w: 12, h: 9 }, vW = { x: 4, y: 36, w: 10, h: 9 }, vE = { x: w - 14, y: 36, w: 10, h: 9 };
  rect(ante.x, ante.y, ante.w, ante.h); rect(vW.x, vW.y, vW.w, vW.h); rect(vE.x, vE.y, vE.w, vE.h);
  rect(cx - 2, cy + Ra - 2, 4, ante.y - (cy + Ra - 2) + 1);                        // the gate: four cells wide
  rect(vW.x + vW.w - 1, 39, ante.x - (vW.x + vW.w) + 2, 3); rect(ante.x + ante.w - 1, 39, vE.x - (ante.x + ante.w) + 2, 3);
  const arena = WLD_rect(cells, tags, w, h, cx, cy, 99), rooms = [Object.assign(arena, { kind: 'arena', ix: cx + .5, iy: cy + .5, ir: Ra, oct })];
  for (const v of [vW, vE]) rooms.push(Object.assign({ cx: v.x + v.w / 2, cy: v.y + v.h / 2, kind: 'vault' }, v));
  // the pillared ring (none on the north-south axis: the way in and the boss's spot stay clear)
  const n = oct ? 8 : R.pick([10, 12]), rp = Ra - 3.2; rooms[0].pillars = n;   // (the braziers stand in the gaps between them)
  for (let k = 0; k < n; k++) { const a = -Math.PI / 2 + (k + .5) / n * TAU, x = Math.floor(cx + .5 + Math.cos(a) * rp), y = Math.floor(cy + .5 + Math.sin(a) * rp); cells[y * w + x] = 2; if (Ra >= 14) cells[y * w + x + (Math.cos(a) > 0 ? 1 : -1)] = 2; }
  // the gate's flanking pillars and a pair of low walls in each vault (cover)
  cells[ante.y * w + ante.x + 1] = 2; cells[ante.y * w + ante.x + ante.w - 2] = 2;
  for (const v of [vW, vE]) if (R.chance(.7)) { const lx = v.x + 3 + R.int(0, 2), ly = v.y + 2 + R.int(0, 3); for (let k = 0; k < 3; k++) cells[ly * w + lx + k] = 3; }
  rooms.extra = [Object.assign({ cx: ante.x + ante.w / 2, cy: ante.y + ante.h / 2, kind: 'ante' }, ante)];
  // the waystone: toward the far wall but well out in front of it (a throne or a dais at the wall must not swallow it),
  // and clear of the centre sigil
  const ex = cx, ey = cy - Ra + 7;
  return { w, h, cells, tags, rooms, start: [cx, ante.y + 5], exit: [ex, ey], exitRoom: rooms[0] };
} });

/* ---------- RING: a gallery around a well of void, chambers around it, sometimes a bridge across ----------
 * Chambers sit around the ring like the hours of a clock, each joined to the gallery by a short passage (and some
 * to their neighbours); half the time a narrow bridge crosses the well through a tiny platform in the middle. */
def('layouts', 'ring', { name: 'Ring', gen(R, o) {
  const w = 58, h = 58, cells = new Array(w * h).fill(1), tags = new Array(w * h).fill(null), cx = w / 2, cy = h / 2;
  const Rw = R.range(5.5, 7.5), Rg = Rw + R.range(3.5, 4.5), ph = WLD_blob(R, 1);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const dx = x + .5 - cx, dy = y + .5 - cy, d = Math.hypot(dx, dy), k = ph(Math.atan2(dy, dx));
    if (d <= Rg * (.94 + (k - 1) * .5)) { cells[y * w + x] = 0; if (d <= Rw * k) tags[y * w + x] = 'pit'; }
  }
  const rect = (x, y, rw, rh) => { for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) if (i > 1 && j > 1 && i < w - 2 && j < h - 2 && cells[j * w + i] === 1) cells[j * w + i] = 0; };
  const path = (a, b, wd) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 3); for (let i = 0; i <= n; i++) { const t = i / n; rect(Math.floor(lerp(a[0], b[0], t) - wd / 2 + .5), Math.floor(lerp(a[1], b[1], t) - wd / 2 + .5), wd, wd); } };
  const n = R.int(6, 8), a0 = R() * TAU, chs = [];
  for (let k = 0; k < n; k++) {
    const a = a0 + k / n * TAU + R.range(-.12, .12), rw = R.int(7, 10), rh = R.int(7, 9), d = Rg + 3.5 + Math.max(rw, rh) * .55 + R.range(0, 2);
    const x = clamp(Math.round(cx + Math.cos(a) * d - rw / 2), 2, w - rw - 2), y = clamp(Math.round(cy + Math.sin(a) * d - rh / 2), 2, h - rh - 2);
    if (chs.some(c => x < c.x + c.w + 1 && x + rw + 1 > c.x && y < c.y + c.h + 1 && y + rh + 1 > c.y)) continue;
    rect(x, y, rw, rh); chs.push({ x, y, w: rw, h: rh, cx: x + rw / 2, cy: y + rh / 2, a });
  }
  for (const c of chs) path([c.cx, c.cy], [cx + Math.cos(c.a) * (Rg - 1), cy + Math.sin(c.a) * (Rg - 1)], 3);
  const first = chs[0]; chs.sort((p, q) => p.a - q.a);
  for (let k = 0; k < chs.length; k++) if (R.chance(.4)) { const p = chs[k], q = chs[(k + 1) % chs.length]; path([p.cx, p.cy], [q.cx, q.cy], 2); }
  // a narrow bridge across the well, through a tiny platform in the middle
  if (R.chance(.5)) {
    const a = R() * Math.PI;
    for (let t = -Rg; t <= Rg; t += .25) for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const x = Math.floor(cx + Math.cos(a) * t - .5) + ox, y = Math.floor(cy + Math.sin(a) * t - .5) + oy, i = y * w + x; if (tags[i] === 'pit') tags[i] = 'bridge'; }
    for (let y = Math.floor(cy - 2); y <= cy + 2; y++) for (let x = Math.floor(cx - 2); x <= cx + 2; x++) if (Math.hypot(x + .5 - cx, y + .5 - cy) <= 1.7) tags[y * w + x] = null;
  }
  const rooms = [first].concat(chs.filter(c => c !== first)).map(c => Object.assign({}, c, { kind: 'chamber' }));   // the start chamber first
  // the gallery itself is open ground too: six stretches of it as rooms, all the way round (four sparse slivers left
  // most of the ring empty and squeezed its packs into strips two cells deep); each keeps clear of the others
  const gal = [];
  for (let k = 0; k < 6; k++) {
    const a = a0 + (k + .5) / 6 * TAU, rc = WLD_rect(cells, tags, w, h, Math.floor(cx + Math.cos(a) * (Rw + Rg) / 2), Math.floor(cy + Math.sin(a) * (Rw + Rg) / 2), 7);
    if (rc && rc.w >= 3 && rc.h >= 3 && !gal.some(q => rc.x < q.x + q.w && rc.x + rc.w > q.x && rc.y < q.y + q.h && rc.y + rc.h > q.y)) gal.push(Object.assign(rc, { kind: 'ring' }));
  }
  rooms.push(...gal);
  // pillars in the bigger chambers' corners
  for (const c of chs) if (c !== first && c.w >= 9 && c.h >= 8 && R.chance(.6)) for (const [px0, py0] of [[c.x + 2, c.y + 2], [c.x + c.w - 3, c.y + 2], [c.x + 2, c.y + c.h - 3], [c.x + c.w - 3, c.y + c.h - 3]]) cells[py0 * w + px0] = 2;
  const exit = WLD_farthest(cells, tags, w, h, rooms, rm => rm.kind === 'chamber');
  return { w, h, cells, tags, rooms, start: [Math.floor(rooms[0].cx), Math.floor(rooms[0].cy)], exit: [Math.floor(exit.cx), Math.floor(exit.cy)], exitRoom: exit };
} });
