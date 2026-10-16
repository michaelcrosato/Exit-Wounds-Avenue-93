/* =============================================================================
 * LEVEL MECHANICS (A): the new element of depths 2, 3, 4, 6, 7 and 8 (the spec is in 45-mechanics-core.js)
 *   wards   The Warded Halls      rune circles: inside, the hero hits harder and faster; foes inside are slowed, exposed
 *   chasm   The Sundered Bridges  the floor torn open: foes knocked into the dark fall screaming, for full experience
 *   gale    The Howling Galleries fan vents blow wind lanes: drift, curving shots, knockback carried down the wind
 *   ice     The Rime Deep         sheets of ice: foes slide, slam into walls and bowl each other over; the frozen shatter
 *   brood   The Brood Warrens     flesh nests birth swarmers while the hero is near; burst one for a spray of loot
 *   pylons  The Stormglass Mines  strike a pylon to charge it; charged pylons arc to each other and zap what comes near
 * Any level with pits (chasm, the islands layout, anything that tears the floor) also gets the abyss drawn under the
 * floor (cliff faces, drifting motes, embers far below) and loot that lands in the void hopping back to the edge.
 * A theme that paints the void itself (51-themes.js raycasts its cliffs) is detected and keeps its own look; L.abyss =
 * false turns the abyss off by hand. Falling itself is the chasm mechanic's (the core fades fallers out elsewhere).
 * Test mixes: ?mechs=chasm,gale in the URL, or eval window.__mkaMechs = 'ice,pylons' and then __ed.descend(4).
 * ============================================================================= */
{
const MKA = { falls: [], motes: [], chips: [] };   // falling monsters, motes in the dark, pebbles tumbling after a fall
const MKA_D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/* ---------- shared: cells, placement, reachability ---------- */
const MKA_in = (L0, cx, cy) => cx >= 0 && cy >= 0 && cx < L0.w && cy < L0.h;
const MKA_open = (L0, cx, cy) => MKA_in(L0, cx, cy) && L0.map.walkable(cx, cy);
const MKA_tag = (L0, cx, cy) => MKA_in(L0, cx, cy) && L0.map.floorTags ? L0.map.floorTags[cy * L0.w + cx] : null;
const MKA_pit = (L0, cx, cy) => MKA_tag(L0, cx, cy) === 'pit' && L0.map.cells[cy * L0.w + cx] === 0;
const MKA_pitAt = (L0, x, y) => MKA_pit(L0, Math.floor(x / 16), Math.floor(y / 16));
const MKA_cc = c => (c + .5) * 16;   // a cell's world center
const MKA_mass = u => Math.pow(Math.max(1, u.mass || 1), .8);
/** a hit from the hero's side: mechanics credit him with what they kill */
const MKA_hit = (amount, el, o) => Object.assign({ src: ED.hero, amount, el, kb: 0, tags: ['mechanic'] }, o || {});
/** can a mechanic take this cell: open floor (untagged unless tagOk; never a rail, a bridge or lava), clear of the start, exit, torches, props, things, runes */
function MKA_free(L0, cx, cy, o = {}) {
  const tg = MKA_tag(L0, cx, cy);
  if (!MKA_open(L0, cx, cy) || (tg && (!o.tagOk || tg === 'rail' || tg === 'bridge' || tg === 'lava'))) return false;
  const x = MKA_cc(cx), y = MKA_cc(cy), near = (p, d) => Math.abs(p.x - x) < d && Math.abs(p.y - y) < d;
  if (Math.hypot(x - L0.start.x, y - L0.start.y) < (o.start === undefined ? 64 : o.start)) return false;
  if (Math.hypot(x - L0.exit.x, y - L0.exit.y) < (o.exit === undefined ? 48 : o.exit)) return false;
  for (const b of L0.torches) if (near(b, o.torch || 20)) return false;
  for (const t of L0.things) if (!t.dead && !t.mark && near(t, (t.kind === 'ward' ? 6 : t.r || 5) + (o.thing || 12))) return false;
  for (const p of L0.props) if (near(p, o.prop || 10)) return false;
  for (const rc of L0.runes || []) if (Math.hypot(rc.x - x, rc.y - y) < rc.r + (o.rune === undefined ? 6 : o.rune)) return false;
  return true;
}
/** every cell within k of (cx, cy) is open: room to stand around a thing */
const MKA_room = (L0, cx, cy, k) => { for (let y = -k; y <= k; y++) for (let x = -k; x <= k; x++) if (!MKA_open(L0, cx + x, cy + y)) return false; return true; };
/** how many open cells can be walked to from the start: a mechanic must never cut the level in two */
function MKA_reach(L0) {
  const W = L0.w, H = L0.h, seen = new Uint8Array(W * H), q = new Int32Array(W * H), sx = Math.floor(L0.start.x / 16), sy = Math.floor(L0.start.y / 16);
  if (!MKA_open(L0, sx, sy)) return 0;
  let h = 0, t = 0; q[t++] = sy * W + sx; seen[sy * W + sx] = 1;
  while (h < t) { const i = q[h++], x = i % W, y = (i / W) | 0; for (const [dx, dy] of MKA_D4) { const nx = x + dx, ny = y + dy, j = ny * W + nx; if (MKA_open(L0, nx, ny) && !seen[j]) { seen[j] = 1; q[t++] = j; } } }
  return t;
}
/** the nearest point on open, solid floor (a faller's last foothold, loot that lands in the void) */
function MKA_safe(L0, x, y, rad = 6) {
  const cx = Math.floor(x / 16), cy = Math.floor(y / 16); let best = null, bd = 1e9;
  for (let j = -rad; j <= rad; j++) for (let i = -rad; i <= rad; i++) {
    const X = cx + i, Y = cy + j; if (!MKA_open(L0, X, Y)) continue;
    const qx = clamp(x, X * 16 + 4, X * 16 + 12), qy = clamp(y, Y * 16 + 4, Y * 16 + 12), d = Math.hypot(qx - x, qy - y);
    if (d < bd) { bd = d; best = [qx, qy]; }
  }
  return best || [L0.start.x, L0.start.y];
}
/** a 16x16 icon helper: rects in icon units, whole pixels at any size */
const MKA_ir = (g, x, y, s) => (a, b, w, h, c) => px.rect(g, x + a * s, y + b * s, Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s)), c);

/* =============================================================================
 * THE ABYSS (any level with pits): cliff faces baked once per view and drawn UNDER the floor, so the floor's own
 * edge hides what sinks below it; motes and embers drift in the dark; loot that lands in the void hops back out
 * ============================================================================= */
function MKA_prepPits(L0) {
  const m = L0.map; if (!m || !m.floorTags) return;
  const T = m.floorTags, W = L0.w; let n = 0, sig = 0;
  for (let i = 0; i < T.length; i++) if (T[i] === 'pit' && m.cells[i] === 0) { n++; sig = (sig * 31 + i) % 1000000007; }
  if (n === (L0.mkaPit || 0) && sig === (L0._mkaSig || 0)) return;
  L0.mkaPit = n; L0._mkaSig = sig; L0.mkaPitVer = (L0.mkaPitVer || 0) + 1; L0.mkaOwnVoid = n ? MKA_ownVoid(L0) : false;
  // embers glow far below the widest parts of the dark
  L0.mkaGlows = [];
  for (let i = 0; i < T.length; i++) {
    const x = i % W, y = (i / W) | 0; if (!MKA_pit(L0, x, y) || !MKA_D4.every(([dx, dy]) => MKA_pit(L0, x + dx, y + dy))) continue;
    const X = MKA_cc(x), Y = MKA_cc(y); if (L0.mkaGlows.some(q => Math.abs(q.x - X) < 56 && Math.abs(q.y - Y) < 56)) continue;
    L0.mkaGlows.push({ x: X, y: Y, ph: E.hash2(x, y) * 9 });
  }
  // the map draws the abyss first, then its floor over it (the floor's pit cells are empty)
  if (n && !m._mkaAbyss) { m._mkaAbyss = true; const base = m.drawFloor; m.drawFloor = function (r) { if (MKA_under(L0)) MKA_abyss(L0, r); return base.call(this, r); }; }
}
/** does the theme paint the void itself (cliffs raycast into its floor texture, as the themes of 51-themes.js do)?
 *  Then the abyss stays off, and falling bodies are drawn in the normal pass (they would hide behind its cliffs) */
function MKA_ownVoid(L0) {
  const th = L0.theme, v = game.view; if (!th || !th.floor || !v) return false;
  let n = 0;
  for (let i = 0; i < L0.w * L0.h && n < 60; i++) {   // probe just inside edges whose rock lies away from the camera: a painted cliff shows there
    const x = i % L0.w, y = (i / L0.w) | 0; if (!MKA_pit(L0, x, y)) continue;
    for (const [dx, dy] of MKA_D4) {
      if (MKA_pit(L0, x + dx, y + dy) || dx * v.fx + dy * v.fy >= -.02) continue;
      n++; const px0 = x * 16 + 8 + dx * 6, py0 = y * 16 + 8 + dy * 6;
      try { if (th.floor(L0, px0, py0, 'pit')) return true; } catch (e) { return false; }
    }
  }
  return false;
}
const MKA_under = L0 => L0.abyss !== false && !!L0.mkaPit && !L0.mkaOwnVoid;   // the abyss (and falls) are drawn under the floor
/** the cliff faces of every pit edge turned to the camera: the floor slab, then rock in strata, fading into the dark */
function MKA_bake(L0, view) {
  const key = view.id + ':' + view.yawDeg + ':' + view.pitchDeg + ':' + view.scale + ':' + L0.mkaPitVer, C = L0._mkaAby || (L0._mkaAby = {});
  if (C[key] !== undefined) return C[key];
  const ks = Object.keys(C); if (ks.length > 5) for (const k of ks) delete C[k];
  const m = L0.map, W = L0.w, H = L0.h, D = 96, faces = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!MKA_pit(L0, x, y)) continue;
    for (const [nx, ny] of MKA_D4) {
      if (MKA_pit(L0, x + nx, y + ny) || -(nx * view.fx + ny * view.fy) <= .02) continue;   // the face looks into the pit: only those turned to us show
      const x0 = x * 16, y0 = y * 16, A = nx ? [nx < 0 ? x0 : x0 + 16, y0] : [x0, ny < 0 ? y0 : y0 + 16], B = nx ? [A[0], y0 + 16] : [x0 + 16, A[1]];
      faces.push({ A, B, x, y, nx, ny, lit: -nx * .6 - ny * .8, k: view.order((A[0] + B[0]) / 2, (A[1] + B[1]) / 2) });
    }
  }
  if (!faces.length) return (C[key] = null);
  faces.sort((a, b) => a.k - b.k);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const f of faces) for (const p of [f.A, f.B]) for (const z of [0, -D]) { const q = view.p(p[0], p[1], z); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
  x0 = Math.floor(x0) - 2; y0 = Math.floor(y0) - 2;
  const cw = Math.ceil(x1) - x0 + 4, ch = Math.ceil(y1) - y0 + 4; if (cw * ch > 8e6) return (C[key] = null);
  const cv = E.mkCanvas(cw, ch), g = E.ctx2d(cv), Pj = (x, y, z) => { const q = view.p(x, y, z); return [q[0] - x0, q[1] - y0]; };
  const side = (m.types[1] && m.types[1].side) || '#3d3750', t = E.tones(side), slab = (L0.pal && L0.pal.stones && L0.pal.stones[1]) || t.lt, ts = E.tones(slab);
  const K = '#07050c', d1 = E.mix(t.deep, K, .4), d2 = E.mix(t.deep, K, .75);   // the rock goes dark fast: a hole, never a block
  const bands = [[0, 2, ts.base, 1], [2, 3, ts.deep, 1], [3, 8, t.base, 1], [8, 14, t.sh, 1], [14, 22, t.deep, 1], [22, 32, d1, 1], [32, 48, d2, 1], [48, D, K, .6]];
  for (const f of faces) {
    const sh = c => f.lit > .2 ? E.shade(c, .1) : f.lit < -.2 ? E.shade(c, -.2) : c, hs = E.hash2(f.x * 7 + f.nx * 3, f.y * 13 + f.ny * 5);
    const at = (u, z) => Pj(lerp(f.A[0], f.B[0], u), lerp(f.A[1], f.B[1], u), -z);
    for (const [z0, z1, c, a] of bands) { const pts = [at(0, z0), at(1, z0), at(1, z1), at(0, z1)]; if (a < 1) px.blend(g, a, 'normal', () => px.poly(g, pts, sh(c))); else px.poly(g, pts, sh(c)); }
    for (const [z, c] of [[5.5 + hs * 1.5, t.sh], [11 + hs * 2, t.deep], [19 + hs * 3, d1]]) { const a0 = at(0, z + (hs - .5) * 3), a1 = at(1, z - (hs - .5) * 3); px.line(g, a0[0], a0[1], a1[0], a1[1], sh(c)); }   // strata
    if (hs > .45) { const u = .2 + hs * .55, p0 = at(u, 3.5), p1 = at(u + .08, 10 + hs * 8), p2 = at(u - .05, 20 + hs * 10); px.line(g, p0[0], p0[1], p1[0], p1[1], sh(t.deep)); px.line(g, p1[0], p1[1], p2[0], p2[1], sh(d1)); }   // a crack
    for (let k = 0; k < 3; k++) { const h2 = E.hash2(f.x * 3 + k, f.y * 5 - k * 7), p = at(h2, 4 + h2 * 7); px.dot(g, p[0], p[1], sh(k ? t.lt : t.hi)); }
    const l0 = at(0, .6), l1 = at(1, .6); px.line(g, l0[0], l0[1], l1[0], l1[1], ts.hi);   // the lip catches the light
  }
  return (C[key] = { cv, x0, y0 });
}
/** under the floor, every frame: the baked cliffs, motes in the dark, pebbles and whatever is falling */
function MKA_abyss(L0, r) {
  const b = MKA_bake(L0, r.view), g = r.ctx, zm = r.view.zoom || 1;
  if (b) g.drawImage(b.cv, b.x0 - r.ix, b.y0 - r.iy);
  for (const q of MKA.motes) {
    const [x, y] = r.w(q.x, q.y, q.z), a = Math.sin(clamp(q.t / q.max, 0, 1) * Math.PI); if (a < .12) continue;
    px.blend(g, a * (q.ember ? .9 : .55), q.ember ? 'add' : 'normal', () => px.rect(g, x, y, q.s, q.s, q.c));
  }
  for (const c of MKA.chips) { const [x, y] = r.w(c.x, c.y, c.z); px.rect(g, x, y, Math.max(1, Math.round(c.s * zm)), Math.max(1, Math.round(c.s * zm)), c.c); }
  for (const m of MKA.falls) MKA_drawFall(r, m);
}
/** the global step for pit levels: motes, pebbles, loot rescue, and a rescan when something tears the floor */
function MKA_pitStep(L0, dt) {
  if ((L0._mkaScan = (L0._mkaScan || 0) - dt) <= 0) { L0._mkaScan = .5; MKA_prepPits(L0); }
  if (!L0.mkaPit) return;
  const h = ED.hero;
  if (h && MKA_under(L0) && MKA.motes.length < 40 && Math.random() < dt * 24) {
    const cx = Math.floor(h.x / 16) + ((Math.random() * 25) | 0) - 12, cy = Math.floor(h.y / 16) + ((Math.random() * 19) | 0) - 9;
    if (MKA_pit(L0, cx, cy)) { const em = Math.random() < .35; MKA.motes.push({ x: (cx + Math.random()) * 16, y: (cy + Math.random()) * 16, z: -92 + Math.random() * 50, vz: 5 + Math.random() * 14, vx: (Math.random() - .5) * 6, t: 0, max: 2.5 + Math.random() * 2.5, ember: em, c: em ? (Math.random() < .5 ? '#ff8a3a' : '#ffb85c') : '#7a7092', s: Math.random() < .25 ? 2 : 1 }); }
  }
  for (let i = MKA.motes.length - 1; i >= 0; i--) { const q = MKA.motes[i]; q.t += dt; q.z += q.vz * dt; q.x += q.vx * dt; if (q.t > q.max || q.z > -3) MKA.motes.splice(i, 1); }
  for (let i = MKA.chips.length - 1; i >= 0; i--) { const c = MKA.chips[i]; c.vz -= 320 * dt; c.z += c.vz * dt; c.x += c.vx * dt; c.y += c.vy * dt; if (c.z < -150) MKA.chips.splice(i, 1); }
  // loot that lands over the void hops back to the nearest edge
  for (const d of ED.drops) {
    if ((d.z > 4 && !d.rest) || !MKA_pitAt(L0, d.x, d.y)) continue;
    const q = MKA_safe(L0, d.x, d.y), dx = q[0] - d.x, dy = q[1] - d.y, l = Math.hypot(dx, dy) || 1, sp = Math.max(60, l * 2.6);
    d.rest = false; d.bounces = 0; d.vz = Math.max(d.vz || 0, 95); d.vx = dx / l * sp; d.vy = dy / l * sp;
    P.dust(d.x, d.y, 0, 3, { speed: 20 });
  }
}

/* ---------- falling: a knocked foe over the void sinks, shrinks, spins and screams; full xp; loot at the edge ---------- */
function MKA_fallCheck(L0) {
  const W = L0.w, H = L0.h, tags = L0.map.floorTags, cells = L0.map.cells; let out = null;
  for (const m of ED.foes) {
    if (!m.alive || m.spawnT > 0 || m.canFly || m.boss || m.noFall || m.elite === 3 || (m.mass || 1) >= 20) continue;
    const cx = Math.floor(m.x / 16), cy = Math.floor(m.y / 16), i = cy * W + cx;
    if (cx < 0 || cy < 0 || cx >= W || cy >= H || tags[i] !== 'pit' || cells[i] !== 0) { m._mkaSx = m.x; m._mkaSy = m.y; continue; }
    if (m.air || m.z > 2) { m.kbT = Math.max(m.kbT || 0, .03); continue; }   // over the void in the air: let it come down IN it (the core would set it back on the edge)
    (out || (out = [])).push(m);
  }
  if (out) for (const m of out) MKA_fall(L0, m);
}
function MKA_fall(L0, m) {
  const i = ED.foes.indexOf(m); if (i >= 0) ED.foes.splice(i, 1);
  m.falling = { t: 0, dur: 1, vx: m.vx * .7, vy: m.vy * .7, hh: (m.head || 24) * (m.scale || 1), spin: (Math.random() < .5 ? -1 : 1) * (7 + Math.random() * 7), ex: m._mkaSx === undefined ? m.x : m._mkaSx, ey: m._mkaSy === undefined ? m.y : m._mkaSy, size: m.rig ? m.rig.o.size : 1, bs: m.blob ? m.blob.scale : 1, x0: m.x, y0: m.y };
  m.atk = null; m.tok = false; m.untargetable = true; m._mkaFrz = -9;
  MKA.falls.push(m);
  const rock = E.tones((L0.map.types[1] && L0.map.types[1].side) || '#3d3750'), f = m.falling;
  P.dust(f.ex, f.ey, 0, 4, { speed: 26, size: .9 });
  for (let k = 0; k < 6; k++) MKA.chips.push({ x: m.x + (Math.random() - .5) * 8, y: m.y + (Math.random() - .5) * 8, z: 0, vx: (Math.random() - .5) * 20, vy: (Math.random() - .5) * 20, vz: 10 + Math.random() * 30, c: k % 2 ? rock.lt : rock.base, s: 1 + (k % 3 === 0 ? 1 : 0) });
  // the scream: a falling saw wail that fades as it drops away (smaller things shriek higher)
  const p = clamp(1.25 / ((m.scale || 1) * (m.r || 5) / 5), .6, 1.7) * (m.blob ? 1.35 : 1);
  sfx([{ wave: 'saw', freq: 640 * p, to: 120 * p, dur: 1.05, vol: .09, vib: [17, .05] }, { wave: 'square', freq: 960 * p, to: 180 * p, dur: .8, vol: .025, vib: [11, .05] }], { vary: .08 });
  sfx('whoosh', { vol: .4, pitch: .6 });
}
function MKA_fallStep(L0, dt) {
  for (let i = MKA.falls.length - 1; i >= 0; i--) {
    const m = MKA.falls[i], f = m.falling; f.t += dt;
    const k = Math.exp(-1.6 * dt); f.vx *= k; f.vy *= k; m.x += f.vx * dt; m.y += f.vy * dt;   // the blow carries it out over the dark
    m.z = -(f.t * f.t) * 90 - f.t * 6; m.facing += f.spin * dt * Math.min(1, f.t * 3);
    if (m.rig) m.rig.update(dt, { x: m.x, y: m.y, z: m.z, vx: 0, vy: 0, facing: m.facing, air: true, hurt: true, pose: Math.floor(f.t * 7) % 2 ? 'cheer' : 'wave', expr: 'shout' });   // arms flail between two poses
    else if (m.blob) m.blob.update(dt, { squash: Math.sin(f.t * 34) * .3, squint: true, flap: 1, look: [Math.cos(m.facing), Math.sin(m.facing)] });
    else if (m.body && m.body.update) m.body.update(dt, m);
    if (f.t >= f.dur) { MKA.falls.splice(i, 1); MKA_fallDone(L0, m); }
  }
}
function MKA_fallDone(L0, m) {
  const f = m.falling, h = ED.hero, [ex, ey] = MKA_safe(L0, f.ex, f.ey, 3);
  m.x = ex; m.y = ey; m.z = 0; m.falling = null; m._mkaFrz = -9;
  const n0 = P.list.length;
  killUnit(m, { src: h, amount: m.hp, el: 'phys', tags: ['fall'], noNumber: true });
  for (let k = P.list.length - 1; k >= n0; k--) { const p = P.list[k]; if (p.kind === 'bit' || p.kind === 'ring') P.list.splice(k, 1); }   // no gore: it is gone into the dark
  m.gone = true;
  sfx({ wave: 'noise', freq: 240, to: 50, dur: .45, vol: .08, filter: 'lowpass' });   // far, far below
}
/** a falling monster, drawn under the floor so the near edge swallows it: shrinking, spinning, darkening */
function MKA_drawFall(r, m, queued) {
  const f = m.falling; if (!f || !r.visible(m.x, m.y, m.z, 70, 70, 220)) return;
  if (m.arch.draw) return;   // custom-drawn bodies fall in the normal pass (MKA 'draw' listener)
  const u = clamp(f.t / f.dur, 0, 1), k = 1 - .7 * u * u, o = { outline: true, rim: false, flash: '#0c0818', flashMix: Math.round(clamp(u * 1.05, 0, .88) * 8) / 8, alpha: Math.round(clamp((1 - u) * 5, 0, 1) * 8) / 8 };
  let fn = null;
  if (m.rig) fn = (g, ox, oy) => { const o0 = m.rig.o, s0 = o0.size, c0 = o0.cape; o0.size = f.size * k; o0.cape = null; try { m.rig.draw(g, ox, oy, r.view); } finally { o0.size = s0; o0.cape = c0; } };
  else if (m.blob) fn = (g, ox, oy) => { const s0 = m.blob.scale; m.blob.scale = f.bs * k; try { m.blob.draw(g, ox, oy, r.view); } finally { m.blob.scale = s0; } };
  else if (m.body && m.body.draw) fn = (g, ox, oy) => m.body.draw(g, ox, oy, r.view, m);
  if (!fn || o.alpha <= 0) return;
  const z = (queued ? m.z * .3 : m.z) + f.hh * (1 - k) * .5;   // it shrinks about its middle, not its feet (and sinks less where nothing hides it)
  if (queued) r.actor(m.x, m.y, z, fn, o);   // over a theme's own painted void: in the normal pass, shrinking and fading
  else if (r._composite) r._composite(r.ctx, m.x, m.y, z, fn, o);
  else { const [ox, oy] = r.w(m.x, m.y, z); fn(r.ctx, Math.round(ox), Math.round(oy)); }
}

/* ---------- global hooks: the abyss for any pit level, custom bodies falling, test mixes ---------- */
BUS.on('step', e => { const L0 = e.L; if (L0 && L0.map && L0.map.floorTags && (ED.mode === 'level' || ED.mode === 'proving')) MKA_pitStep(L0, e.dt); }, 'global');
BUS.on('draw', e => {
  const L0 = e.L, r = e.r; if (!L0 || !L0.mkaPit) return;
  const h = ED.hero; let n = 0;   // embers far below: a faint warm glow in the widest dark
  if (h && L0.mkaGlows && MKA_under(L0)) for (const q of L0.mkaGlows) { if (n > 4 || Math.abs(q.x - h.x) > 220 || Math.abs(q.y - h.y) > 180) continue; n++; L.add(q.x, q.y, 0, 44, .22 + .08 * Math.sin(game.time * 1.7 + q.ph), { color: '#ff6a2a' }); }
  for (const m of MKA.falls) {   // custom-drawn bodies, and every faller over a painted void, fall in the normal pass
    if (m.arch.draw && m.falling) m.arch.draw(m, r, clamp((1 - m.falling.t / m.falling.dur) * 3, 0, 1));
    else if (!MKA_under(L0)) MKA_drawFall(r, m, true);
  }
}, 'global');
BUS.on('levelStart', e => {
  const L0 = e.L; MKA.falls.length = 0; MKA.motes.length = 0; MKA.chips.length = 0;
  // the mechanics a link (?mechs=a,b) or Settings > Tools > Extra mechanics (DEV.mechs) adds to every depth
  const want = String(qs.get('mechs') || DEV.mechs.join(',') || (typeof window !== 'undefined' && window.__mkaMechs) || '').split(',').map(s => s.trim()).filter(Boolean);
  let k = 0;
  for (const id of want) {
    const M = REG.mechanics[id]; if (!M || L0.mechs.includes(id)) continue;
    if (M.place) M.place(L0, RNG(((L0.rec && L0.rec.seed) || 1) + 101 * ++k));
    L0.mechs.push(id); if (M.start) M.start(L0);
  }
  if (k) { L0.map.floors = {}; if (L0.flow) L0.flow.tx = -1; notify('TEST MIX: ' + L0.mechs.join(' + ').toUpperCase(), '#8fe3ff', 3); }
  MKA_prepPits(L0);
}, 'global');
BUS.on('levelEnd', () => { const h = ED.hero; if (h) MKA_wardLook(h, false); }, 'global');

/* =============================================================================
 * WARDS (depth 2): rune circles in the rooms. Standing inside empowers the hero (damage, attack and cast speed, ember),
 * more for every foe standing in the circle with him; foes inside are slowed and Exposed. Fight from the circles.
 * ============================================================================= */
const MKA_WC = { deep: '#15383f', sh: '#2f7f82', base: '#6fd6cc', lt: '#bff6ff', hi: '#ffffff' };
const MKA_WARD_SMEAR = ['#ffffff', '#dff8ff', '#6fd6cc', '#2f7f82'];
const MKA_GLYPHS = [[[-1.5, -1, 1.5, -1], [0, -1, 0, 1.6]], [[-1.4, -1.2, 1.4, 1.2], [-1.4, 1.2, 1.4, -1.2]], [[-1.5, -1.2, -1.5, 1.4], [-1.5, -.2, 1.5, 1.2]], [[-1.5, 1.2, 0, -1.4], [0, -1.4, 1.5, 1.2]], [[-1.5, 0, 1.5, 0], [-.6, -1.3, -.6, 1.3], [.8, -1.3, .8, 1.3]]];
const MKA_RUNE_SPR = [['a.a', 'aaa', '.a.', '.a.', '.a.'], ['aa.', 'a.a', 'aa.', 'a.a', 'a..'], ['a..', 'aa.', 'a.a', 'aa.', 'a..']].map(rows => E.sprite(rows, { a: '#bff6ff' }));
def('mechanics', 'wards', { name: 'Warding Circles', title: 'The Warded Halls', adj: 'Warded', noun: 'Rune Halls', color: '#6fd6cc', depth: 2, weight: 10,
  tip: 'Rune circles empower you while you stand inside, more for every foe in there with you. Foes inside are slowed and exposed: pull packs in.',
  brief: 'They empower you, more per foe inside.', lure: 'into a rune circle', act: 'fight from inside the circle', zone: 'rune circles',
  icon(g, x, y, s) {
    const R = MKA_ir(g, x, y, s);
    R(5, 0, 6, 12, MKA_WC.deep); R(6, 0, 4, 12, MKA_WC.sh); R(7, 0, 2, 12, MKA_WC.base);
    for (let i = 0; i < 22; i++) { const a = i / 22 * TAU; R(7.5 + Math.cos(a) * 6.5, 11.5 + Math.sin(a) * 3, 1, 1, Math.sin(a) > 0 ? MKA_WC.lt : MKA_WC.sh); }
    R(6, 4, 4, 1, '#ffffff'); R(7, 3, 2, 5, '#ffffff'); R(7, 11, 2, 1, MKA_WC.lt);
  },
  place(L0, R) {
    const wards = L0.mkaWards || (L0.mkaWards = []), want = wards.length + Math.max(2, Math.round(L0.rooms.length * .6));
    const rooms = R.shuffle(L0.rooms.filter(r0 => !(L0.start.x >= r0.x * 16 && L0.start.x < (r0.x + r0.w) * 16 && L0.start.y >= r0.y * 16 && L0.start.y < (r0.y + r0.h) * 16)));
    for (const r0 of rooms) {
      if (wards.length >= want) break;
      for (let k = 0; k < 14; k++) {
        const cx = r0.x + 2 + R.int(0, Math.max(0, r0.w - 5)), cy = r0.y + 2 + R.int(0, Math.max(0, r0.h - 5)), rad = R.range(24, 30), x = MKA_cc(cx), y = MKA_cc(cy);
        if (!MKA_room(L0, cx, cy, 1) || !MKA_free(L0, cx, cy, { tagOk: true, start: 84, exit: 64, rune: rad + 8 }) || wards.some(w => Math.hypot(w.x - x, w.y - y) < 90)) continue;
        if (L0.torches.some(b => Math.hypot(b.x - x, b.y - y) < rad - 3)) continue;   // no brazier standing in the circle
        L0.runes.push({ x, y, r: rad });   // the theme's floor bakes its rune rings (the crypt does)
        wards.push(addThing(L0, { kind: 'ward', x, y, r: rad, on: 0, rot: R() * TAU, ph: R() * TAU, n: 0, mapColor: MKA_WC.base, draw(r) { MKA_wardDraw(this, r); } }));
        break;
      }
    }
    L0.map.floors = {};
  },
  start(L0) {
    // a foe that dies in a lit circle gives up its spark: it flies to the hero as ember
    BUS.on('kill', e => {
      const m = e.tgt, h = ED.hero; if (m.team !== 'foe' || !h || !h.alive) return;
      const w = (L0.mkaWards || []).find(q => q.on > .5 && Math.hypot(q.x - m.x, q.y - m.y) < q.r + 3); if (w) MKA_soul(m.x, m.y, (m.head || 20) * .5 * (m.scale || 1));
    }, 'level');
  },
  update(L0, dt) {
    const h = ED.hero, W0 = L0.mkaWards; if (!h || !W0) return;
    let mine = null;
    for (const w of W0) {
      const inside = h.alive && !h.dead && Math.hypot(h.x - w.x, h.y - w.y) < w.r;
      w.on = approach(w.on, inside ? 1 : 0, dt * (inside ? 5 : 2)); w.rot += dt * (.25 + 1.4 * w.on);
      w.n = 0;
      eachEnemy('hero', w.x, w.y, w.r - 3, m => {   // foes in the circle: bound (slowed) and exposed
        if (!m.st.vuln || m.st.vuln.t < .3) m.st.vuln = { t: .3 };
        m.speedK = (m.speedK === undefined ? 1 : m.speedK) * .75; m._mkaW = game.time; w.n++;
      });
      if (inside) mine = w;
    }
    const b = h.buffs.find(q => q.id === 'mka-ward');
    if (mine) {
      const n = Math.min(8, mine.n), stats = { incDmg: 30 + 6 * n, atkSpeed: 25, castSpeed: 25, emberRegen: 10 };
      if (!b) {
        h.buffs.push({ id: 'mka-ward', name: 'Warded', color: MKA_WC.base, t: .45, stats }); computeStats(h);
        sfx('chime', { vol: .4, pitch: .8 }); P.ring(mine.x, mine.y, 4, mine.r + 4, MKA_WC.lt, .4); P.glints(h.x, h.y, 14, 8, MKA_WC.lt, 16);
        if (!L0._mkaWardTold) { L0._mkaWardTold = true; notify('THE WARD EMPOWERS YOU', MKA_WC.base, 2.5); }
      } else { b.t = .45; if (b.stats.incDmg !== stats.incDmg) { b.stats = stats; computeStats(h); } }
      MKA_wardLook(h, true);
      if (Math.random() < dt * 14) P.add({ kind: 'ember', x: h.x + (Math.random() - .5) * 10, y: h.y + (Math.random() - .5) * 10, z: 1, vz: 22 + Math.random() * 16, drag: .5, max: .7, color: MKA_WC.base });
    } else if (!b) MKA_wardLook(h, false);
  },
  draw(L0, r) {
    const h = ED.hero; if (!h) return;
    // foes bound in a circle: a teal brand under their feet
    for (const m of ED.foes) if (m.alive && game.time - (m._mkaW || -9) < .05 && r.visible(m.x, m.y, 0)) r.decal(g => { r.groundRing(m.x, m.y, m.r * (m.scale || 1) + 2.5, MKA_WC.base, .75); r.groundRing(m.x, m.y, m.r * (m.scale || 1) + 1, MKA_WC.sh, .5); }, { emissive: .7 });
    // the empowered hero: runes circle him, his eyes and his blade burn teal
    if (h._mkaWard && h.alive) {
      for (let i = 0; i < 3; i++) { const a = game.time * 2.4 + i * TAU / 3, x = h.x + Math.cos(a) * 10, y = h.y + Math.sin(a) * 10, z = 13 + Math.sin(game.time * 3 + i * 2) * 3; r.sprite(x, y, z, MKA_RUNE_SPR[i], { anchor: 'center', glow: 1 }); }
      L.add(h.x, h.y, 12, 64, .7, { color: MKA_WC.base });
    }
  }
});
/** the empowered look: the hero's blade leaves teal trails and his eyes glow while he stands in a circle */
function MKA_wardLook(h, on) {
  if (on) { if (!h._mkaWard) h._mkaWard = { rig: h.rig, eye: h.rig.o.eyeGlow }; if (h._mkaWard.rig !== h.rig) h._mkaWard = { rig: h.rig, eye: h.rig.o.eyeGlow }; h.smear = MKA_WARD_SMEAR; h.rig.o.eyeGlow = MKA_WC.lt; return; }
  if (!h._mkaWard) return;
  const s = h._mkaWard; h._mkaWard = null; if (h.rig === s.rig) h.rig.o.eyeGlow = s.eye;
  h.smear = h.look ? EL(h.look.el).smear : h.smear;
}
function MKA_wardDraw(w, r) {
  if (!r.visible(w.x, w.y, 0, 90, 150, 70)) return;
  const t = game.time, on = w.on, C = MKA_WC, pul = .5 + .5 * Math.sin(t * 2.2 + w.ph), R0 = w.r;
  r.decal(g => {
    r.groundDisc(w.x, w.y, R0, C.sh, .08 + .14 * on);
    r.groundRing(w.x, w.y, R0, C.base, .5 + .3 * on + .15 * pul);
    r.groundRing(w.x, w.y, R0 - 1.6, C.lt, .2 + .55 * on);
    r.groundRing(w.x, w.y, R0 * .78, C.base, .35 + .45 * on);
    for (let i = 0; i < 12; i++) {   // rune glyphs between the rings, turning slowly (fast while he stands inside)
      const a = w.rot + i / 12 * TAU, rr = R0 * .89, gx = w.x + Math.cos(a) * rr, gy = w.y + Math.sin(a) * rr, ca = Math.cos(a), sa = Math.sin(a);
      const p = (u, v) => r.w(gx + ca * u - sa * v, gy + sa * u + ca * v, 0), hot = on > .4 && (i + Math.floor(t * 9)) % 12 === 0;
      for (const s of MKA_GLYPHS[i % MKA_GLYPHS.length]) { const A0 = p(s[0], s[1]), B0 = p(s[2], s[3]); px.line(g, A0[0], A0[1], B0[0], B0[1], hot ? C.hi : on > .4 ? C.lt : C.base); }
    }
    for (const [sg, off] of [[1, 0], [-1, Math.PI / 3]]) {   // a six-point star: two triangles turning against each other
      const pts = [0, 1, 2].map(k => { const a = -w.rot * .6 * sg + off + k * TAU / 3; return r.w(w.x + Math.cos(a) * R0 * .76, w.y + Math.sin(a) * R0 * .76, 0); });
      px.blend(g, .3 + .5 * on, 'normal', () => { for (let k = 0; k < 3; k++) { const A0 = pts[k], B0 = pts[(k + 1) % 3]; px.line(g, A0[0], A0[1], B0[0], B0[1], C.base); } });
    }
    r.groundDisc(w.x, w.y, 3.5 + 2 * pul, C.lt, .45 + .45 * on);
  }, { emissive: .6 + .4 * on });
  // the pillar of light: a cylinder of nested shells (faint and wide outside, bright and narrow inside) in curved bands
  // that fade and narrow upward, a brighter band flowing up it, motes rising through. It is a beacon: bright while the
  // circle waits, it thins to a veil while the hero fights in it (the power is in him now, and the foes inside must
  // read). Only the part above head height glows through the dark (emissive items are drawn again after lighting,
  // over whatever stood in front of them: a glowing trunk would bleach every body in the circle)
  const view = r.view, fa0 = Math.atan2(view.fy, view.fx), top = 60 + 30 * on, st = 9, flow = (t * (.35 + .5 * on) + w.ph) % 1, veil = 1 - .55 * on, HEAD = 4;   // bands below HEAD are the trunk
  const arc = (rad, z) => { const pts = []; for (let i = 0; i <= 10; i++) { const a = fa0 - Math.PI / 2 + i / 10 * Math.PI; pts.push(r.w(w.x + Math.cos(a) * rad, w.y + Math.sin(a) * rad, z)); } return pts; };
  const shells = [[.46, .06 * on, C.sh], [.34, (.1 + .04 * pul) * veil, C.base], [.21, .13 * veil, C.lt], [.07, .15 * veil, C.hi]];   // (alpha steps are eighths)
  const pillar = (k0, k1) => g => {
    px.glow(g, 1); const lift = k0 ? 1 : 1.35;   // the trunk is drawn once and lit by the room; the glowing top twice
    for (const [s0, a1, c] of shells) {
      const a0 = a1 * lift;
      const rad = R0 * s0;
      if (!k0) px.blend(g, a0 * 1.1, 'add', () => px.poly(g, r.groundPts(w.x, w.y, rad * 1.15, 16, 0), c));   // the foot of the beam on the floor
      for (let k = k0; k < k1; k++) {
        const z0 = top * k / st, z1 = top * (k + 1) / st, fade = Math.pow(1 - k / st, 1.15), band = Math.abs((k + .5) / st - flow) < .12 ? 1.8 : 1;
        const pts = arc(rad * (1 - .25 * k / st), z0).concat(arc(rad * (1 - .25 * (k + 1) / st), z1).reverse());
        px.blend(g, a0 * fade * band, 'add', () => px.poly(g, pts, c));
      }
    }
    const [x, y] = r.w(w.x, w.y, 0), [, ty] = r.w(w.x, w.y, top), hgt = y - ty, hw = R0 * .3 * view.scale;
    for (let i = 0; i < 6; i++) { const u = (t * (.3 + .25 * on) + i / 6 + w.ph) % 1; if ((u * st >= HEAD) !== (k0 >= HEAD)) continue; const mx = x + Math.sin(i * 2.3 + t * 1.3) * hw, my = y - hgt * u; px.blend(g, Math.sin(u * Math.PI) * (.45 + .55 * on), 'add', () => px.rect(g, mx, my, 1, 2, C.hi)); }
  };
  r.queue(w.x, w.y, 0, pillar(0, HEAD), { bias: -.2 });
  r.queue(w.x, w.y, 0, pillar(HEAD, st), { emissive: true, bias: -.19 });
  L.add(w.x, w.y, 8, 66 + 30 * on, .5 + .2 * pul + .5 * on, { color: C.base });
}
/** a spark from a foe slain in a lit circle: it arcs to the hero and becomes ember */
function MKA_soul(x, y, z) {
  const h = ED.hero, sa = Math.random() * TAU;
  FX.visual(.5, (r, u) => {
    const k = u * u, bx = lerp(x, h.x, k) + Math.cos(sa) * Math.sin(u * Math.PI) * 14, by = lerp(y, h.y, k) + Math.sin(sa) * Math.sin(u * Math.PI) * 14, bz = lerp(z, 16, k) + Math.sin(u * Math.PI) * 16;
    r.queue(bx, by, bz, g => { const [X, Y] = r.w(bx, by, bz), zm = r.view.zoom || 1; px.glow(g, 1); r.glowDisc(g, X, Y, 5 * zm, MKA_WC.base, .5); px.disc(g, X, Y, 1.5 * zm, MKA_WC.lt); px.dot(g, X, Y, '#ffffff'); }, { emissive: true });
  });
  game.after(.5, () => { if (!h.alive) return; h.ember = Math.min(h.maxEmber, h.ember + 6); P.glints(h.x, h.y, 16, 3, MKA_WC.lt, 10); sfx('blip', { vol: .35, pitch: 1.6 }); });
}

/* =============================================================================
 * CHASM (depth 3): the floor torn open. Rifts with narrow bridges across the rooms, sinkholes, corridors whose sides
 * have fallen away. Anything knocked (or launched) over the void falls: full experience, loot pops out at the edge.
 * The hero's dodge leaps a narrow gap (he is airborne); chevrons and a dotted arc show where.
 * ============================================================================= */
/** a jagged rift straight across a room, a bridge left standing somewhere along it */
function MKA_rift(r0, R) {
  const acrossX = r0.w >= r0.h, len = acrossX ? r0.h : r0.w, span = acrossX ? r0.w : r0.h, wid = R.chance(.3) ? 3 : 2, cells = [];
  let c = Math.floor(span * (.35 + R() * .25)); const b0 = R.int(1, Math.max(1, len - 3)), bw = R.pick([1, 2, 2]);
  for (let t = 0; t < len; t++) {
    if (t && t % 2 === 0) c = clamp(c + R.int(-1, 1), 2, span - 2 - wid);
    if (t >= b0 && t < b0 + bw) continue;
    const w = t === 0 || t === len - 1 ? Math.max(1, wid - 1) : wid;
    for (let k = 0; k < w; k++) cells.push(acrossX ? [r0.x + c + k, r0.y + t] : [r0.x + t, r0.y + c + k]);
  }
  return cells;
}
/** a ragged sinkhole in the middle of a big room, walkable all around */
function MKA_sink(r0, R) {
  const cells = [], cx = r0.x + r0.w / 2 + R.range(-1, 1), cy = r0.y + r0.h / 2 + R.range(-1, 1), rx = Math.min(r0.w / 2 - 2.2, R.range(1.7, 3.1)), ry = Math.min(r0.h / 2 - 2.2, R.range(1.5, 2.7)), s = R() * 99;
  if (rx < 1.2 || ry < 1.2) return cells;
  for (let y = r0.y; y < r0.y + r0.h; y++) for (let x = r0.x; x < r0.x + r0.w; x++) { const dx = (x + .5 - cx) / rx, dy = (y + .5 - cy) / ry; if (dx * dx + dy * dy < .85 + E.noise2(x * .7 + s, y * .7) * .5) cells.push([x, y]); }
  return cells;
}
/** tear pits into the level (refused if it would cut anything off from the start) */
function MKA_carve(L0, cells) {
  const W = L0.w, m = L0.map, before = MKA_reach(L0), seen = new Set(), list = [];
  for (const [cx, cy] of cells) { const i = cy * W + cx; if (seen.has(i)) continue; seen.add(i); if (MKA_free(L0, cx, cy, { start: 90, exit: 60, rune: 12, thing: 10, prop: 12 })) list.push(i); }
  if (list.length < Math.max(2, seen.size * .6)) return 0;
  for (const i of list) m.blocked[i] = 1;
  if (MKA_reach(L0) !== before - list.length) { for (const i of list) m.blocked[i] = 0; return 0; }
  for (const i of list) m.floorTags[i] = 'pit';
  return list.length;
}
/** 3-wide corridors whose sides fell away: a one-lane bridge (or a two-lane ledge) over the dark */
function MKA_breaks(L0, R, n) {
  const W = L0.w, H = L0.h, inRoom = (x, y) => L0.rooms.some(r0 => x >= r0.x - 1 && x <= r0.x + r0.w && y >= r0.y - 1 && y <= r0.y + r0.h);
  const wall = (x, y) => L0.map.cell(x, y) !== 0, op = (x, y) => MKA_open(L0, x, y) && !MKA_tag(L0, x, y), cands = [];
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    let ok = true; for (let k = 0; k < 4 && ok; k++) ok = !inRoom(x + k, y) && op(x + k, y - 1) && op(x + k, y) && op(x + k, y + 1) && wall(x + k, y - 2) && wall(x + k, y + 2);
    if (ok) cands.push({ x, y, hz: 1 });
    ok = true; for (let k = 0; k < 4 && ok; k++) ok = !inRoom(x, y + k) && op(x - 1, y + k) && op(x, y + k) && op(x + 1, y + k) && wall(x - 2, y + k) && wall(x + 2, y + k);
    if (ok) cands.push({ x, y, hz: 0 });
  }
  R.shuffle(cands); const used = []; let done = 0;
  for (const c of cands) {
    if (done >= n) break;
    if (used.some(u => Math.abs(u.x - c.x) + Math.abs(u.y - c.y) < 12)) continue;
    const len = R.int(2, 3), sides = R.chance(.6) ? [-1, 1] : [R.pick([-1, 1])], cells = [];
    for (let k = 0; k < len; k++) for (const s of sides) cells.push(c.hz ? [c.x + k, c.y + s] : [c.x + s, c.y + k]);
    if (MKA_carve(L0, cells)) { done++; used.push(c); }
  }
}
/** narrow gaps (one or two cells of void between floor) where a dodge carries the hero across */
function MKA_leaps(L0) {
  const out = [], W = L0.w, H = L0.h;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) for (const [dx, dy] of [[1, 0], [0, 1]]) {
    if (!MKA_open(L0, x, y) || !MKA_pit(L0, x + dx, y + dy)) continue;
    let k = 1; while (k <= 3 && MKA_pit(L0, x + dx * k, y + dy * k)) k++;
    if (k > 3 || !MKA_open(L0, x + dx * k, y + dy * k)) continue;
    const ax = MKA_cc(x), ay = MKA_cc(y), bx = MKA_cc(x + dx * k), by = MKA_cc(y + dy * k), mx = (ax + bx) / 2, my = (ay + by) / 2;
    if (out.some(q => Math.hypot(q.mx - mx, q.my - my) < 48)) continue;
    out.push({ ax, ay, bx, by, mx, my });
  }
  return out;
}
def('mechanics', 'chasm', { name: 'Chasms', title: 'The Sundered Bridges', adj: 'Sundered', noun: 'Bridges', color: '#b8a8e0', depth: 3, weight: 10,
  tip: 'The floor is torn open. Knock foes over the edge and they fall for full experience. A dodge leaps a narrow gap.',
  brief: 'Foes knocked over the edge fall, for full XP.', lure: 'to the edge', act: 'knock them over the edge',
  icon(g, x, y, s) {
    const R = MKA_ir(g, x, y, s), Q = pts => pts.map(([a, b]) => [x + a * s, y + b * s]);
    R(1, 2, 14, 13, '#4b4559'); R(1, 2, 14, 1, '#7a7290'); R(1, 14, 14, 1, '#2a2634'); R(2, 6, 3, 1, '#5d566c'); R(11, 11, 3, 1, '#5d566c');
    px.poly(g, Q([[5, 2], [11, 2], [9, 5], [11, 8], [9, 11], [10, 15], [6, 15], [7, 11], [5, 8], [7, 5]]), '#2a2438');   // the rift's lit lip
    px.poly(g, Q([[6, 2], [10, 2], [8.3, 5], [10, 8], [8.2, 11], [9, 15], [7, 15], [7.8, 11], [6, 8], [7.7, 5]]), '#07050c');
    R(8, 8, 1, 1, '#ff8a3a'); R(8, 12, 1, 1, '#ff5a2a'); R(10, 3, 1, 1, '#b8a8e0'); R(5, 8, 1, 1, '#b8a8e0');
  },
  place(L0, R) {
    const m = L0.map, n0 = L0.w * L0.h; let pits = 0, floor = 0;
    for (let i = 0; i < n0; i++) if (m.cells[i] === 0) { floor++; if (m.floorTags[i] === 'pit') pits++; }
    const big = pits > floor * .06;   // an islands map already has its chasms: tear only a little more
    const rooms = R.shuffle(L0.rooms.filter(r0 => r0.w >= 6 && r0.h >= 6 && !(L0.start.x >= r0.x * 16 && L0.start.x < (r0.x + r0.w) * 16 && L0.start.y >= r0.y * 16 && L0.start.y < (r0.y + r0.h) * 16)));
    const want = big ? 1 : Math.max(2, Math.round(L0.rooms.length * .5)); let made = 0;
    for (const r0 of rooms) { if (made >= want) break; const sink = r0.w >= 9 && r0.h >= 8 && R.chance(.4); if (MKA_carve(L0, sink ? MKA_sink(r0, R) : MKA_rift(r0, R)) || (sink && MKA_carve(L0, MKA_rift(r0, R)))) made++; }
    MKA_breaks(L0, R, big ? 1 : 2 + R.int(0, 1));
    m.floors = {}; if (L0.flow) L0.flow.tx = -1;
    L0.mkaLeaps = MKA_leaps(L0);
    // loose stones along the fresh edges
    const rock = (m.types[1] && m.types[1].side) || '#6a6480'; let rocks = 0;
    for (let k = 0; k < 400 && rocks < 8 + made * 2; k++) { const cx = R.int(1, L0.w - 2), cy = R.int(1, L0.h - 2); if (!MKA_free(L0, cx, cy, { start: 60, prop: 20 }) || !MKA_D4.some(([dx, dy]) => MKA_pit(L0, cx + dx, cy + dy))) continue; L0.props.push({ name: 'rock', x: MKA_cc(cx) + R.range(-4, 4), y: MKA_cc(cy) + R.range(-4, 4), o: { size: .45 + R() * .35, color: E.shade(rock, .15) } }); rocks++; }
    MKA_prepPits(L0);
  },
  update(L0, dt) {
    MKA_fallCheck(L0); MKA_fallStep(L0, dt);
    const h = ED.hero;
    if (h && L0.mkaLeaps && !L0._mkaLeapTold) for (const q of L0.mkaLeaps) if (Math.hypot(h.x - q.mx, h.y - q.my) < 40) { L0._mkaLeapTold = true; notify('DODGE (SPACE) LEAPS A NARROW GAP', '#bff6ff', 3.5); break; }
  },
  draw(L0, r) {
    const h = ED.hero; if (!h || !L0.mkaLeaps) return;
    for (const q of L0.mkaLeaps) {   // leap hints near the hero: marching chevrons at both lips, a dotted arc over the gap
      const d = Math.hypot(h.x - q.mx, h.y - q.my); if (d > 76) continue;
      const a = clamp((76 - d) / 28, 0, 1), fromA = Math.hypot(h.x - q.ax, h.y - q.ay) < Math.hypot(h.x - q.bx, h.y - q.by);
      const sx = fromA ? q.ax : q.bx, sy = fromA ? q.ay : q.by, ex = fromA ? q.bx : q.ax, ey = fromA ? q.by : q.ay, ang = Math.atan2(ey - sy, ex - sx), ca = Math.cos(ang), sa = Math.sin(ang), gap = Math.hypot(ex - sx, ey - sy), t = game.time;
      r.decal(g => {
        const w2 = Math.max(1, Math.round((r.view.zoom || 1) * 1.2));
        for (const [u0, k0] of [[-10, 0], [-4, 1], [gap + 2, 2]]) {   // two on this side, one where you land
          const pulse = .45 + .55 * Math.max(0, Math.sin(t * 7 - k0 * 1.3)), c0 = sx + ca * u0, c1 = sy + sa * u0;
          const P1 = r.w(c0 - ca * 2.5 - sa * 4, c1 - sa * 2.5 + ca * 4, 0), P2 = r.w(c0 + ca * 2, c1 + sa * 2, 0), P3 = r.w(c0 - ca * 2.5 + sa * 4, c1 - sa * 2.5 - ca * 4, 0);
          px.blend(g, a * pulse * .6, 'normal', () => { px.line(g, P1[0], P1[1] + 1, P2[0], P2[1] + 1, '#10202a', w2); px.line(g, P2[0], P2[1] + 1, P3[0], P3[1] + 1, '#10202a', w2); });   // a dark twin: it reads on pale stone
          px.blend(g, a * pulse, 'normal', () => { px.line(g, P1[0], P1[1], P2[0], P2[1], '#bff6ff', w2); px.line(g, P2[0], P2[1], P3[0], P3[1], '#bff6ff', w2); });
        }
      }, { emissive: .7 });
      r.queue(q.mx, q.my, 6, g => {
        const zm = r.view.zoom || 1, n = 14, head = (t * 1.4) % 1, sz = Math.max(2, Math.round(zm * 1.5));   // the leap's arc: bold dots with a travelling head
        for (let i = 1; i < n; i++) {
          const u = i / n, [X, Y] = r.w(lerp(sx, ex, u), lerp(sy, ey, u), Math.sin(u * Math.PI) * 13 + 3), near = Math.abs(u - head) < .1;
          if (i % 2 && !near) continue;
          px.blend(g, a * (near ? 1 : .75), 'normal', () => { px.rect(g, X, Y + 1, sz, sz, '#10202a'); px.rect(g, X, Y, sz, sz, near ? '#ffffff' : '#bff6ff'); });
        }
      }, { emissive: true, bias: .4 });
    }
  }
});

/* =============================================================================
 * GALE (depth 4): bronze fan vents against the walls blow two-cell wind lanes across the rooms, in gusts. Units in a
 * lane drift downwind (heavy ones less, fliers more), shots curve with it, knockback along the wind is carried far,
 * smoke and embers bend. Ride a lane to cross a room in a blink; knock packs down one into a wall or a chasm.
 * ============================================================================= */
const MKA_gust = (t, ph) => { const c = ((t / 4.6 + ph) % 1 + 1) % 1; return c < .68 ? .28 + .72 * Math.pow(Math.sin(c / .68 * Math.PI), .6) : .28; };
const MKA_LEAF = ['#c89a4a', '#a8743a', '#8a9a4a', '#d8b060', '#9a5a2a'];
/** the wind at a point: [wx, wy] (full gust = length 1) or null */
function MKA_wind(L0, x, y) {
  const G = L0.mkaWind; if (!G) return null;
  const cx = Math.floor(x / 16), cy = Math.floor(y / 16); if (!MKA_in(L0, cx, cy)) return null;
  const i = cy * L0.w + cx, l = G.lane[i]; if (!l) return null;
  const k = L0.mkaLanes[l - 1].gust; return [G.x[i] * k, G.y[i] * k];
}
/** a vent against the wall at (cx, cy) blowing along (dx, dy): its lane runs two cells wide until a wall stops it */
function MKA_lane(L0, c, R) {
  const { cx, cy, dx, dy } = c, ox = dy ? 1 : 0, oy = dx ? 1 : 0, W = L0.w, G = L0.mkaWind, m = L0.map;
  const lane2 = k => [[cx + dx * k, cy + dy * k], [cx + ox + dx * k, cy + oy + dy * k]];
  for (const [x, y] of lane2(0)) if (!MKA_free(L0, x, y, { tagOk: true, start: 70, exit: 40, thing: 10 }) || m.cell(x - dx, y - dy) === 0) return false;
  let len = 0; while (len < 14 && lane2(len).every(([x, y]) => MKA_in(L0, x, y) && m.cell(x, y) === 0)) len++;
  if (len < 5) return false;
  for (let k = 0; k < len; k++) for (const [x, y] of lane2(k)) if (G.lane[y * W + x] || Math.hypot(MKA_cc(x) - L0.start.x, MKA_cc(y) - L0.start.y) < 36) return false;
  const id = L0.mkaLanes.length + 1;
  for (let k = 0; k < len; k++) { const f = 1 - .45 * k / len; for (const [x, y] of lane2(k)) { const i = y * W + x; G.lane[i] = id; G.x[i] = dx * f; G.y[i] = dy * f; } }
  // the vent sits against the wall between the two lane cells; the lane starts at its mouth
  const midX = MKA_cc(cx) + ox * 8, midY = MKA_cc(cy) + oy * 8, wx = dx ? cx * 16 + (dx > 0 ? 0 : 16) : midX, wy = dy ? cy * 16 + (dy > 0 ? 0 : 16) : midY;
  const ln = { dir: [dx, dy], ax: -dy, ay: dx, x: wx + dx * 13, y: wy + dy * 13, len: len * 16 - 13, gust: 0, ph: R(), spin: R() * TAU, howl: false, streaks: [] };
  for (let i = 0; i < 12; i++) ln.streaks.push({ u: R() * ln.len, o: R.range(-1, 1), z: R.range(3, 24), l: R.range(8, 20), k: R.range(.8, 1.3), ph: R() * 9 });
  L0.mkaLanes.push(ln);
  // (kind 'galevent', never 'vent': the Cinder King wakes every 'vent' thing, meaning the magma vents)
  addThing(L0, { kind: 'galevent', x: wx + dx * 7, y: wy + dy * 7, r: 6, solid: true, lane: ln, mapColor: '#dff0ff', draw(r) { MKA_ventDraw(this, r); } });
  for (let k = 2; k < len; k += 2) addThing(L0, { kind: 'windmark', mark: true, hidden: true, x: midX + dx * k * 16, y: midY + dy * k * 16, mapColor: '#3a5a6a' });   // the lane on the minimap
  return true;
}
def('mechanics', 'gale', { name: 'Gale Vents', title: 'The Howling Galleries', adj: 'Howling', noun: 'Galleries', color: '#cfe8b0', depth: 4, weight: 10,
  tip: 'Vents blow wind lanes in gusts: you drift, shots curve, and foes knocked downwind fly. Ride a lane; knock packs down one.',
  brief: 'Gusts carry you, your shots and foes.', lure: 'into a wind lane', act: 'knock them downwind', move: 'Knock packs down a wind lane',
  icon(g, x, y, s) {
    const R = MKA_ir(g, x, y, s), Ln = (x0, y0, x1, y1, c) => px.line(g, x + x0 * s, y + y0 * s, x + x1 * s, y + y1 * s, c);
    Ln(1, 4, 10, 4, '#e8f4ff'); Ln(10, 4, 12, 2, '#e8f4ff'); Ln(12, 2, 10, 1, '#9ab8d0');
    Ln(2, 8, 12, 8, '#cfe8ff'); Ln(12, 8, 14, 10, '#cfe8ff'); Ln(14, 10, 12, 12, '#9ab8d0');
    Ln(1, 12, 7, 12, '#9ab8d0'); R(4, 13, 2, 1, '#d8b060'); R(6, 14, 1, 1, '#8a5a2a'); R(9, 11, 1, 1, '#8a9a4a');
  },
  place(L0, R) {
    L0.mkaLanes = L0.mkaLanes || []; const n = L0.w * L0.h;
    L0.mkaWind = L0.mkaWind || { x: new Float32Array(n), y: new Float32Array(n), lane: new Uint8Array(n) };
    const want = L0.mkaLanes.length + Math.max(3, Math.round(L0.rooms.length * .8)), cands = [];
    for (const r0 of L0.rooms) for (let k = 0; k < 16; k++) {
      const [dx, dy] = R.pick(MKA_D4); let cx, cy;
      if (dx) { cx = dx > 0 ? r0.x : r0.x + r0.w - 1; cy = r0.y + R.int(1, Math.max(1, r0.h - 3)); } else { cy = dy > 0 ? r0.y : r0.y + r0.h - 1; cx = r0.x + R.int(1, Math.max(1, r0.w - 3)); }
      cands.push({ cx, cy, dx, dy });
    }
    R.shuffle(cands);
    for (const c of cands) { if (L0.mkaLanes.length >= want) break; if (L0.mkaLanes.length < 255) MKA_lane(L0, c, R); }
    L0.mkaLeaves = [];
  },
  start(L0) {
    // knockback along the wind is carried much further
    BUS.on('hit', e => {
      const u = e.tgt, hit = e.hit; if (u.team !== 'foe' || !u.alive || u.boss || !(hit.kb > 20) || hit.ang === undefined) return;
      const w = MKA_wind(L0, u.x, u.y); if (!w) return;
      const wl = Math.hypot(w[0], w[1]), wa = Math.atan2(w[1], w[0]), al = Math.cos(hit.ang - wa); if (wl < .05 || al <= .2) return;
      knock(u, wa, hit.kb * 1.1 * al * wl, 0); u.kbT = Math.max(u.kbT || 0, .35);
      P.dust(u.x, u.y, 2, 4, { speed: 16, vx: w[0] * 70, vy: w[1] * 70, color: '#d8e0e8' });
    }, 'level');
  },
  update(L0, dt) {
    const lanes = L0.mkaLanes; if (!lanes || !lanes.length) return;
    const t = L0.t || 0, h = ED.hero, S = 58;   // full-gust drift in world units per second for a body of mass 1
    for (const ln of lanes) {
      const was = ln.gust; ln.gust = MKA_gust(t, ln.ph); ln.spin += dt * (3 + 24 * ln.gust);
      for (const s of ln.streaks) { s.u += (40 + 160 * ln.gust) * s.k * dt; if (s.u - s.l > ln.len) { s.u = -Math.random() * 30; s.o = Math.random() * 2 - 1; s.z = 3 + Math.random() * 21; } }
      const near = h && Math.hypot(h.x - ln.x, h.y - ln.y) < 230;
      if (near && was < .6 && ln.gust >= .6) {   // a gust starts: the vent howls
        const v = clamp(1 - Math.hypot(h.x - ln.x, h.y - ln.y) / 230, .15, 1);
        sfx([{ wave: 'noise', freq: 420, to: 1300, dur: 1.5, vol: .07 * v, filter: 'bandpass', q: 5 }, { wave: 'sine', freq: 380, to: 470, dur: 1.3, vol: .025 * v, vib: [5, .07] }], { vary: .1 });
      }
      if (near && Math.random() < dt * 5 * ln.gust) { const u = Math.random() * ln.len; P.dust(ln.x + ln.dir[0] * u + ln.ax * (Math.random() - .5) * 26, ln.y + ln.dir[1] * u + ln.ay * (Math.random() - .5) * 26, 1, 1, { speed: 6, vx: ln.dir[0] * 90 * ln.gust, vy: ln.dir[1] * 90 * ln.gust, color: '#cfe0ee' }); }   // (dust in the lane's cool colour)
      if (near && L0.mkaLeaves.length < 26 && Math.random() < dt * 1.6 * ln.gust) L0.mkaLeaves.push({ x: ln.x + ln.ax * (Math.random() - .5) * 20, y: ln.y + ln.ay * (Math.random() - .5) * 20, z: 5 + Math.random() * 12, vx: 0, vy: 0, ph: Math.random() * 9, t: 0, c: MKA_LEAF[(Math.random() * MKA_LEAF.length) | 0] });
    }
    const drift = (u, k) => { const w = MKA_wind(L0, u.x, u.y); if (!w) return; const f = S * k; u.drift = u.drift ? [u.drift[0] + w[0] * f, u.drift[1] + w[1] * f] : [w[0] * f, w[1] * f]; };
    if (h && h.alive) drift(h, 1 / MKA_mass(h));
    for (const m of ED.foes) {
      if (!m.alive || m.spawnT > 0 || m.boss) continue;
      if (m.air || (m.z > 2 && !m.canFly)) { const w = MKA_wind(L0, m.x, m.y); if (w) { m.vx += w[0] * 160 * dt; m.vy += w[1] * 160 * dt; } continue; }   // in the air the wind carries the body itself
      drift(m, (m.canFly ? 1.7 : .8) / MKA_mass(m));
    }
    for (const f of ED.fx) if (f.kind === 'bolt') { const w = MKA_wind(L0, f.x, f.y); if (w) { f.vx += w[0] * 320 * dt; f.vy += w[1] * 320 * dt; } }   // shots ride the wind
    for (const p of P.list) if (p.kind === 'dust' || p.kind === 'smoke' || p.kind === 'ember' || p.kind === 'fire') { const w = MKA_wind(L0, p.x, p.y); if (w) { p.vx += w[0] * 110 * dt; p.vy += w[1] * 110 * dt; } }
    // leaves tumble down the lanes, and settle where the wind lets them go
    const LV = L0.mkaLeaves;
    for (let i = LV.length - 1; i >= 0; i--) {
      const f = LV[i], w = MKA_wind(L0, f.x, f.y); f.t += dt;
      if (w && Math.hypot(w[0], w[1]) > .12) { f.vx = approach(f.vx, w[0] * 150 + Math.sin(f.ph + f.t * 5) * 14 * w[1], 300 * dt); f.vy = approach(f.vy, w[1] * 150 - Math.sin(f.ph + f.t * 5) * 14 * w[0], 300 * dt); f.z = Math.max(0, f.z + Math.sin(f.t * 7 + f.ph) * 22 * dt); }
      else { f.vx *= Math.exp(-3 * dt); f.vy *= Math.exp(-3 * dt); f.z = Math.max(0, f.z - 16 * dt); if (f.z <= 0) f.t += dt * 2; }
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.t > 6 || L0.map.solidAt(f.x, f.y)) LV.splice(i, 1);
    }
  },
  draw(L0, r) {
    const lanes = L0.mkaLanes; if (!lanes) return;
    const t = game.time;
    for (const ln of lanes) {
      const ex = ln.x + ln.dir[0] * ln.len, ey = ln.y + ln.dir[1] * ln.len;
      if (!r.visible(ln.x, ln.y, 0, 160, 120, 160) && !r.visible(ex, ey, 0, 160, 120, 160) && !r.visible((ln.x + ex) / 2, (ln.y + ey) / 2, 0, 160, 120, 160)) continue;
      const [dx, dy] = ln.dir, ax = ln.ax, ay = ln.ay, gu = ln.gust;
      r.decal(g => {   // the lane on the floor, readable from a still frame: a scoured band two cells wide (darker stone, a
        // cool sheen that swells with the gust), solid rails along both edges, and one broad chevron across the whole
        // lane every 22 units, pointing downwind and sweeping along it faster as the gust builds. (Every mark has a dark
        // twin a pixel below it, so the lane reads on pale stone as well as dark, in every view)
        const off = (t * (26 + 70 * gu)) % 22, L0p = (u, o) => r.w(ln.x + dx * u + ax * o, ln.y + dy * u + ay * o, 0), zw = Math.max(1, Math.round(r.view.zoom || 1));
        const band = [L0p(0, -15), L0p(ln.len, -15), L0p(ln.len, 15), L0p(0, 15)];
        px.blend(g, .22, 'normal', () => px.poly(g, band, '#0c1420'));
        px.blend(g, .09 + .13 * gu, 'add', () => px.poly(g, band, '#7aa4c8'));
        const mark = (A0, B0, c, a, w = 1) => { px.blend(g, a * .6, 'normal', () => px.line(g, A0[0], A0[1] + 1, B0[0], B0[1] + 1, '#141c28', w)); px.blend(g, a, 'normal', () => px.line(g, A0[0], A0[1], B0[0], B0[1], c, w)); };
        for (const o of [-15, 15]) mark(L0p(4, o), L0p(ln.len - 4, o), '#a8c4dc', .42 + .3 * gu);
        for (let u = off; u < ln.len; u += 22) {
          const fade = Math.min(1, u / 16, (ln.len - u) / 16), a = (.5 + .45 * gu) * fade; if (a < .08) continue;
          const tip = L0p(u + 3, 0), l = L0p(u - 5, -11), rr = L0p(u - 5, 11);
          mark(l, tip, '#e4f2ff', a, zw); mark(tip, rr, '#e4f2ff', a, zw);
          const hl = L0p(u - 2, -5), hr = L0p(u - 2, 5); px.blend(g, a * .7, 'add', () => { px.line(g, hl[0], hl[1], tip[0], tip[1], '#ffffff'); px.line(g, tip[0], tip[1], hr[0], hr[1], '#ffffff'); });   // a hot core near the tip
        }
      }, { emissive: .3 });
      for (const s of ln.streaks) {   // streaks of wind at every height, a little wavy, brightest at the head
        const u = s.u; if (u < 0 || u - s.l > ln.len) continue;
        const a = (.15 + .7 * gu) * Math.min(1, Math.sin(clamp(u / ln.len, 0, 1) * Math.PI) * 2.5); if (a < .06) continue;
        const hx = ln.x + dx * u + ax * s.o * 13, hy = ln.y + dy * u + ay * s.o * 13, tx = hx - dx * s.l, ty = hy - dy * s.l, wig = Math.sin(t * 9 + s.ph) * 1.6;
        r.queue(hx, hy, s.z, g => { const H0 = r.w(hx, hy, s.z), M0 = r.w((hx + tx) / 2 + ax * wig, (hy + ty) / 2 + ay * wig, s.z + wig * .6), T0 = r.w(tx, ty, s.z), Q0 = r.w(hx - dx * s.l * .25, hy - dy * s.l * .25, s.z); px.blend(g, a, 'normal', () => { px.line(g, T0[0], T0[1], M0[0], M0[1], '#bcd4e8'); px.line(g, M0[0], M0[1], H0[0], H0[1], '#f0f8ff'); }); px.blend(g, a, 'add', () => px.line(g, Q0[0], Q0[1], H0[0], H0[1], '#ffffff', 2)); }, { emissive: true, bias: .2 });
      }
    }
    for (const f of L0.mkaLeaves || []) {
      if (!r.visible(f.x, f.y, f.z, 10, 10, 10)) continue;
      const a = f.t > 5 ? 6 - f.t : 1;
      r.queue(f.x, f.y, f.z, g => { const [X, Y] = r.w(f.x, f.y, f.z), fl = Math.sin(f.ph + f.t * 16) > 0, zm = Math.max(1, Math.round(r.view.zoom || 1)); px.blend(g, a, 'normal', () => { px.rect(g, X, Y, (fl ? 2 : 1) * zm, (fl ? 1 : 2) * zm, fl ? f.c : E.shade(f.c, -.3)); px.dot(g, X, Y, E.shade(f.c, .25)); }); });
    }
  }
});
/** a bronze fan in a stone frame: the blades spin up with every gust, you look down its dark throat from the front */
function MKA_ventDraw(v, r) {
  if (!r.visible(v.x, v.y, 0, 50, 70, 40)) return;
  const ln = v.lane, [dx, dy] = ln.dir, ax = -dy, ay = dx, view = r.view, cz = 12.5, R0 = 8.5, face = dx * view.fx + dy * view.fy > 0, zm = view.zoom || 1;
  const st = E.tones('#6a6272'), br = E.tones('#b8803a');
  const Wp = (a, b, f) => r.w(v.x + ax * a + dx * f, v.y + ay * a + dy * f, cz + b);
  const ring = (rad, f) => { const pts = []; for (let i = 0; i < 18; i++) { const a = i / 18 * TAU; pts.push(Wp(Math.cos(a) * rad, Math.sin(a) * rad, f)); } return pts; };
  r.shadow(v.x, v.y, 9, .5);
  r.queue(v.x, v.y, 0, g => {
    r.box(g, v.x - 6, v.y - 6, 0, v.x + 6, v.y + 6, 3, st.base, st.sh);
    const posts = [-1, 1].map(sd => [v.x + ax * (R0 + 2.2) * sd - dx, v.y + ay * (R0 + 2.2) * sd - dy]).sort((p, q) => view.order(p[0], p[1]) - view.order(q[0], q[1]));
    const post = p => { r.box(g, p[0] - 1.5, p[1] - 1.5, 3, p[0] + 1.5, p[1] + 1.5, cz + 3, st.lt, st.sh); const [X, Y] = r.w(p[0], p[1], cz + 3); px.rect(g, X - 1, Y - 1, 2, 2, br.base); };
    const back = ring(R0 * .92, -6.5), front = ring(R0, 1.4);
    const blades = () => {
      for (let k = 0; k < 4; k++) { const a = ln.spin + k * TAU / 4, pts = [Wp(Math.cos(a - .6) * 1.6, Math.sin(a - .6) * 1.6, 0), Wp(Math.cos(a - .26) * (R0 - .7), Math.sin(a - .26) * (R0 - .7), 0), Wp(Math.cos(a + .26) * (R0 - .7), Math.sin(a + .26) * (R0 - .7), 0), Wp(Math.cos(a + .6) * 1.6, Math.sin(a + .6) * 1.6, 0)]; px.poly(g, pts, Math.cos(a + .7) > 0 ? br.lt : br.base); px.line(g, pts[1][0], pts[1][1], pts[2][0], pts[2][1], br.hi); }
      const hb = Wp(0, 0, .6); px.disc(g, hb[0], hb[1], 1.7 * zm, br.sh); px.dot(g, hb[0] - .5, hb[1] - .5, br.hi);
    };
    const duct = () => { for (let i = 0; i < 18; i++) { const j = (i + 1) % 18, v = Math.sin((i + .5) / 18 * TAU + .5); px.poly(g, [back[i], back[j], front[j], front[i]], v > .6 ? br.lt : v > 0 ? br.base : v > -.6 ? br.sh : br.deep); } };   // a round drum: lit on top
    post(posts[0]);
    if (face) {   // looking into the duct: the throat, the blades, the lip
      duct(); px.poly(g, front, '#120e16'); blades();
      for (let i = 0; i < 18; i++) { const j = (i + 1) % 18; px.line(g, front[i][0], front[i][1], front[j][0], front[j][1], i < 9 ? br.hi : br.lt, Math.max(1, Math.round(zm))); }
    } else {      // from behind: the housing's domed back, a grille over the intake, rivets round the rim, the hub
      blades(); duct();
      px.poly(g, back, br.deep); px.poly(g, ring(R0 * .84, -6.7), br.sh); px.poly(g, ring(R0 * .62, -7), br.base);
      const hl = []; for (let i = 0; i <= 6; i++) { const a = 1.9 + i / 6 * 1.3; hl.push(Wp(Math.cos(a) * R0 * .74, Math.sin(a) * R0 * .74, -6.8)); } for (let i = 1; i < hl.length; i++) px.line(g, hl[i - 1][0], hl[i - 1][1], hl[i][0], hl[i][1], br.lt);   // the lit shoulder
      for (let k = -2; k <= 2; k++) { const hgt = Math.sqrt(Math.max(0, 1 - (k * 2.3 / (R0 * .62)) ** 2)) * R0 * .62, A0 = Wp(k * 2.3, -hgt, -7.1), B0 = Wp(k * 2.3, hgt, -7.1); px.line(g, A0[0], A0[1], B0[0], B0[1], br.deep); }
      for (let k = 0; k < 8; k++) { const a = k * TAU / 8 + .4, q = Wp(Math.cos(a) * R0 * .9, Math.sin(a) * R0 * .9, -6.6); px.dot(g, q[0], q[1], k < 4 ? br.hi : br.lt); }
      const hb = Wp(0, 0, -7.3); px.disc(g, hb[0], hb[1], 1.8 * zm, br.sh); px.disc(g, hb[0] - .5, hb[1] - .5, 1.1 * zm, br.lt); px.dot(g, hb[0] - 1, hb[1] - 1, br.hi);
    }
    post(posts[1]);
  });
}

/* =============================================================================
 * ICE (depth 6): sheets of rime ice (the core takes the traction away). Foes knocked on ice slide far, slam into walls
 * (damage and a stun), bowl each other over and skate off edges. Rime crystals burst into a freezing blast when
 * struck (they grow back); frozen foes shatter in a burst of shards that chills their neighbours. Frost breath,
 * mirror-bright floors, glare sweeping across the ice.
 * ============================================================================= */
const MKA_ICE = { deep: '#2f6ab0', sh: '#5aa8d8', base: '#9fdfff', lt: '#dff8ff', hi: '#ffffff' };
def('mechanics', 'ice', { name: 'Rime Ice', title: 'The Rime Deep', adj: 'Frozen', noun: 'Rime Halls', color: '#8fd8ff', depth: 6, weight: 10,
  tip: 'Foes knocked on ice slide far and slam into walls. Strike a rime crystal to freeze a pack, then break one: the frozen shatter, one into the next.',
  brief: 'Knocked foes slide far; crystals freeze packs.', lure: 'onto the ice', act: 'freeze them with a rime crystal', move: 'Knock packs sliding across the ice',
  icon(g, x, y, s) {
    const R = MKA_ir(g, x, y, s);
    px.poly(g, [[x + 8 * s, y + 1 * s], [x + 12 * s, y + 6 * s], [x + 10.5 * s, y + 15 * s], [x + 5.5 * s, y + 15 * s], [x + 4 * s, y + 6 * s]], MKA_ICE.sh);
    px.poly(g, [[x + 8 * s, y + 1 * s], [x + 4 * s, y + 6 * s], [x + 5.5 * s, y + 15 * s], [x + 8 * s, y + 15 * s]], MKA_ICE.lt);
    px.line(g, x + 8 * s, y + 2 * s, x + 8 * s, y + 14 * s, '#ffffff'); R(10, 4, 1, 1, '#ffffff'); R(2, 13, 2, 1, MKA_ICE.base); R(12, 12, 3, 1, MKA_ICE.base); R(1, 3, 1, 1, '#ffffff'); R(14, 2, 1, 1, MKA_ICE.lt);
  },
  place(L0, R) {
    const m = L0.map, W = L0.w, seeds = [], n = Math.max(3, Math.round(L0.rooms.length * .9));
    for (let k = 0; k < n * 4 && seeds.length < n; k++) { const [x, y] = L0.randomFloor(R, { minStart: 64 }); if (!seeds.some(s => Math.hypot(s.x - x, s.y - y) < 80)) seeds.push({ x, y, r: R.range(3.2, 5.8) * 16, s: R() * 99 }); }
    let ice = 0;
    for (const s of seeds) {
      const c0x = Math.floor(s.x / 16), c0y = Math.floor(s.y / 16), k = Math.ceil(s.r / 16) + 1;
      for (let y = c0y - k; y <= c0y + k; y++) for (let x = c0x - k; x <= c0x + k; x++) {
        if (!MKA_open(L0, x, y) || MKA_tag(L0, x, y)) continue;
        const d = Math.hypot(MKA_cc(x) - s.x, MKA_cc(y) - s.y); if (d > s.r * (.6 + E.noise2(x * .45 + s.s, y * .45 - s.s) * .7) || Math.hypot(MKA_cc(x) - L0.start.x, MKA_cc(y) - L0.start.y) < 40) continue;
        m.floorTags[y * W + x] = 'ice'; ice++;
      }
    }
    m.floors = {};
    // rime crystals to shatter, glowing shards along the walls of the ice
    let crystals = 0;
    for (const s of R.shuffle(seeds.slice())) {
      if (crystals >= Math.max(2, Math.ceil(seeds.length * .6))) break;
      for (let k = 0; k < 16; k++) { const cx = Math.floor(s.x / 16) + R.int(-2, 2), cy = Math.floor(s.y / 16) + R.int(-2, 2); if (MKA_tag(L0, cx, cy) !== 'ice' || !MKA_room(L0, cx, cy, 1) || !MKA_free(L0, cx, cy, { tagOk: true, start: 80, thing: 16 })) continue; addThing(L0, MKA_rime(MKA_cc(cx) + R.range(-3, 3), MKA_cc(cy) + R.range(-3, 3), R)); crystals++; break; }
    }
    let deco = 0;
    for (let k = 0; k < 600 && deco < seeds.length * 3; k++) {
      const cx = R.int(1, L0.w - 2), cy = R.int(1, L0.h - 2); if (MKA_tag(L0, cx, cy) !== 'ice' || !MKA_free(L0, cx, cy, { tagOk: true, start: 50, prop: 18 })) continue;
      const wl = MKA_D4.find(([dx, dy]) => m.cell(cx + dx, cy + dy) > 0); if (!wl) continue;
      L0.props.push({ name: 'crystal', x: MKA_cc(cx) + wl[0] * 5, y: MKA_cc(cy) + wl[1] * 5, o: { color: R.pick(['#a8e8ff', '#c8f0ff', '#8fd0ff']), size: .6 + R() * .5 } }); deco++;
    }
    L0.mkaIce = (L0.mkaIce || 0) + ice; L0.mkaChunks = L0.mkaChunks || [];
  },
  start(L0) {
    BUS.on('hit', e => {
      const u = e.tgt, hit = e.hit; if (u.team !== 'foe') return;
      if (u.st.freeze) u._mkaFrz = game.time;
      if (!u.alive || u.boss || !(hit.kb > 20) || L0.map.floorAt(u.x, u.y) !== 'ice') return;
      knock(u, hit.ang !== undefined ? hit.ang : angTo(hit.src || u, u), hit.kb * .6, 0); u._mkaSlide = 1.6; u.kbT = Math.max(u.kbT || 0, .3);   // no footing: the blow carries it away
    }, 'level');
    BUS.on('kill', e => { const m = e.tgt; if (m.team === 'foe' && !m.boss && !m.gone && game.time - (m._mkaFrz || -9) < .15) MKA_shatter(L0, m); }, 'level');
  },
  update(L0, dt) {
    const h = ED.hero, map = L0.map;
    for (const m of ED.foes) {
      if (!m.alive) continue;
      if (m.st.freeze) m._mkaFrz = game.time;
      if (!(m._mkaSlide > 0)) continue;
      m._mkaSlide -= dt;
      const sp = Math.hypot(m.vx, m.vy); if (sp < 30) { m._mkaSlide = 0; continue; }
      if (map.floorAt(m.x, m.y) === 'ice' && sp > 70) m.kbT = Math.max(m.kbT, .05);   // still skating: keeps its momentum (and may go over an edge)
      if (sp < 95 || m.air) continue;
      const ux = m.vx / sp, uy = m.vy / sp, ax = m.x + ux * (m.r + 3), ay = m.y + uy * (m.r + 3), cx = Math.floor(ax / 16), cy = Math.floor(ay / 16);
      let hitT = null; for (const t of L0.things) if (t.solid && !t.dead && Math.hypot(t.x - ax, t.y - ay) < t.r + 1) { hitT = t; break; }
      if (hitT || (!map.walkable(cx, cy) && !MKA_pit(L0, cx, cy))) { MKA_slam(L0, m, sp, ux, uy, hitT); continue; }
      if (sp > 110) GRID.each(m.x, m.y, m.r + 3, o => {   // bowling: a sliding body bowls the next one over
        if (o === m || !o.alive || o.boss || o._mkaBowl === m || m._mkaBowl === o || (o.x - m.x) * ux + (o.y - m.y) * uy <= 0) return;   // only what lies ahead, once
        const a = Math.atan2(o.y - m.y, o.x - m.x); o._mkaBowl = m; m._mkaBowl = o; knock(o, a, sp * .75, 0); o._mkaSlide = 1.4; o.kbT = Math.max(o.kbT || 0, .3);
        dealDamage(o, MKA_hit(heroHitAmount(.45), 'phys', { ang: a })); m.vx *= .45; m.vy *= .45;
        P.impact((m.x + o.x) / 2, (m.y + o.y) / 2, 10, 7, '#dff8ff'); sfx('punch', { vol: .5 }); shake(1.5);
      });
    }
    // frost breath: every living thing puffs a little cloud now and then (the undead do not breathe)
    const breathe = u => {
      if ((u._mkaBr = (u._mkaBr === undefined ? Math.random() * 2 : u._mkaBr) - dt) > 0) return;
      u._mkaBr = 1.5 + Math.random() * 1.2 - (u === h && Math.hypot(h.vx, h.vy) > 40 ? .6 : 0);
      let x, y, z; const f = u.facing || 0;
      if (u.rig) { const hd = u.rig.head(); x = hd[0] + Math.cos(f) * 2.4; y = hd[1] + Math.sin(f) * 2.4; z = hd[2] - 1.2 * (u.rig.o.size || 1); }
      else if (u.blob) { x = u.x + Math.cos(f) * 5; y = u.y + Math.sin(f) * 5; z = (u.z || 0) + 6 * (u.scale || 1); }
      else return;
      for (let k = 0; k < 3; k++) P.add({ kind: 'dust', x, y, z, vx: Math.cos(f) * (12 + k * 5) + (Math.random() - .5) * 4, vy: Math.sin(f) * (12 + k * 5) + (Math.random() - .5) * 4, vz: 3 + k, g: -3, drag: 2.4, max: .7 + k * .15, size: .8 + k * .25, color: '#eef6ff' });
    };
    if (h && h.alive && !h.dead) breathe(h);
    let n = 0; if (h) for (const m of ED.foes) { if (n > 18) break; if (!m.alive || m.spawnT > 0 || (m.arch.tags && m.arch.tags.includes('undead')) || m.arch.body === 'wisp' || Math.abs(m.x - h.x) > 200 || Math.abs(m.y - h.y) > 160) continue; n++; breathe(m); }
    // ice chunks skitter across the floor after a shatter
    const C = L0.mkaChunks || [];
    for (let i = C.length - 1; i >= 0; i--) {
      const c = C[i]; c.t += dt; const onIce = map.floorAt(c.x, c.y) === 'ice', k = Math.exp(-(onIce ? .7 : 5) * dt); c.vx *= k; c.vy *= k;
      const nx = c.x + c.vx * dt, ny = c.y + c.vy * dt; if (map.solidAt(nx, c.y)) c.vx = -c.vx * .5; else c.x = nx; if (map.solidAt(c.x, ny)) c.vy = -c.vy * .5; else c.y = ny;
      c.rot += c.vr * dt * Math.min(1, Math.hypot(c.vx, c.vy) / 40);
      if (c.t > c.max || MKA_pitAt(L0, c.x, c.y)) C.splice(i, 1);
    }
  },
  draw(L0, r) {
    const h = ED.hero; if (!h) return;
    const t = game.time, cx0 = Math.floor(h.x / 16), cy0 = Math.floor(h.y / 16), zm = r.view.zoom || 1, D0 = (t * 46) % 280, tw = [];
    // glare sweeping across the ice in parallel bands, and twinkles that come and go
    r.decal(g => {
      for (let cy = cy0 - 12; cy <= cy0 + 12; cy++) for (let cx = cx0 - 13; cx <= cx0 + 13; cx++) {
        if (MKA_tag(L0, cx, cy) !== 'ice') continue;
        const x0 = cx * 16, y0 = cy * 16;
        for (const [lag, a] of [[0, .4], [5, .22], [9, .12]]) {
          let c = ((D0 - lag - (x0 + y0)) % 280 + 280) % 280; if (c >= 32) continue;
          const A0 = c <= 16 ? r.w(x0 + c, y0, 0) : r.w(x0 + 16, y0 + c - 16, 0), B0 = c <= 16 ? r.w(x0, y0 + c, 0) : r.w(x0 + c - 16, y0 + 16, 0);
          px.blend(g, a, 'add', () => px.line(g, A0[0], A0[1], B0[0], B0[1], '#e8fbff'));
        }
        const hs = E.hash2(cx * 7, cy * 11); if (hs > .8 && tw.length < 14 && (t * .8 + hs * 13) % 3 < .45) tw.push([x0 + (hs * 97 % 1) * 16, y0 + (hs * 57 % 1) * 16, (t * .8 + hs * 13) % 3 / .45]);
      }
    }, { emissive: .5 });
    for (const [x, y, u] of tw) r.queue(x, y, 0, g => { const [X, Y] = r.w(x, y, .5), k = Math.round(Math.sin(u * Math.PI) * 2.5 * zm); px.glow(g, 1); px.rect(g, X - k, Y, k * 2 + 1, 1, MKA_ICE.lt); px.rect(g, X, Y - k, 1, k * 2 + 1, MKA_ICE.lt); px.dot(g, X, Y, '#ffffff'); }, { emissive: true, bias: -.5 });
    // mirror ice: whoever stands on it shows upside down beneath (Symphony of the Night's marble gallery)
    if (r.view.pitchDeg <= 70) {
      const refl = u => {
        if (!u || (!u.rig && !u.blob) || L0.map.floorAt(u.x, u.y) !== 'ice' || !r.visible(u.x, u.y, 0, 40, 70, 60)) return;
        r.decal(g => { if (g._info) return; const [ox, oy] = r.w(u.x, u.y, 0), [, oz] = r.w(u.x, u.y, Math.max(0, u.z || 0)), X = Math.round(ox), Y = Math.round(oy); px.blend(g, .26, 'normal', () => { g.save(); g.translate(0, Y * 2); g.scale(1, -1); try { (u.rig || u.blob).draw(g, X, Math.round(oz), r.view); } finally { g.restore(); } }); });
      };
      if (h.alive || h.dead) refl(h);
      let n = 0; for (const m of ED.foes) { if (n >= 12) break; if (m.alive && m.spawnT <= 0 && Math.abs(m.x - h.x) < 180 && Math.abs(m.y - h.y) < 150) { n++; refl(m); } }
    }
    for (const c of L0.mkaChunks || []) {
      if (!r.visible(c.x, c.y, 0, 10, 10, 10)) continue;
      const a = clamp((c.max - c.t) * 2, 0, 1);
      r.queue(c.x, c.y, 0, g => { const [X, Y] = r.w(c.x, c.y, .6), s = c.s * zm, q = c.rot; px.blend(g, a, 'normal', () => { px.poly(g, [[X + Math.cos(q) * s * 1.5, Y + Math.sin(q) * s * .8], [X + Math.cos(q + 2.1) * s, Y + Math.sin(q + 2.1) * s * .6 - s * .6], [X + Math.cos(q + 4.1) * s, Y + Math.sin(q + 4.1) * s * .6]], MKA_ICE.base); px.dot(g, X, Y - 1, '#ffffff'); }); });
    }
  }
});
/** a cluster of rime crystal: strike it and it bursts, freezing everything near; it grows back */
function MKA_rime(x, y, R) {
  const shards = [];
  for (let i = 0; i < 5; i++) { const a = R() * TAU, d = i ? 2 + R() * 3.2 : 0; shards.push({ dx: Math.cos(a) * d, dy: Math.sin(a) * d, h: i ? 8 + R() * 8 : 19 + R() * 5, w: i ? 1.8 + R() * 1.1 : 3.3, lx: Math.cos(a) * (i ? 2.5 + R() * 3 : .4), ly: Math.sin(a) * (i ? 2.5 + R() * 3 : .4) }); }
  return { kind: 'rime', x, y, r: 6, solid: true, hittable: true, grow: 1, shards, flash: 0, mapColor: '#dff8ff',
    onHit(hit) { if (this.grow < 1) return; this.grow = 0; this.hittable = false; this.solid = false; MKA_rimeBurst(this); },
    update(dt) { this.flash -= dt; if (this.grow < 1 && (this.grow = Math.min(1, this.grow + dt / 18)) >= 1) { this.hittable = true; this.solid = true; P.glints(this.x, this.y, 12, 6, '#e8fbff', 12); sfx('chime', { vol: .2, pitch: 1.5 }); } },
    draw(r) { MKA_rimeDraw(this, r); } };
}
function MKA_rimeBurst(c) {
  const h = ED.hero, x = c.x, y = c.y;
  sfx('freeze', { vol: 1 }); sfx('crack', { vol: .9 }); sfx('explode', { vol: .3, pitch: 1.8 }); game.freeze(.07); shake(4); game.flash('#bfefff', .12, .4);
  P.bits(x, y, 10, 28, ['#ffffff', '#dff8ff', '#9fdfff', '#5aa8d8']); P.glints(x, y, 12, 14, '#e8fbff', 30); P.ring(x, y, 4, 60, '#bfefff', .45); P.ring(x, y, 2, 36, '#ffffff', .3);
  eachEnemy('hero', x, y, 62, u => applyStatus(u, 'chill', u.boss ? 1 : 4, h));   // five stacks: frozen solid
  // (no knockback: the pack freezes where it stood, bunched, so that breaking one shatters the rest)
  FX.nova({ team: 'hero', src: h, x, y, r0: 6, r1: 62, dur: .32, el: 'frost', color: '#bfefff', hit: MKA_hit(heroHitAmount(1.2), 'frost', { kb: 0, statusChance: 0, tags: ['aoe', 'mechanic'] }) });
  FX.scorch(x, y, 24, '#a8d8f0', 7);
  MKA_chunks(ED.L, x, y, 10);
}
function MKA_rimeDraw(c, r) {
  if (!r.visible(c.x, c.y, 0, 40, 70, 40)) return;
  const k = c.grow < 1 ? .22 + .5 * c.grow : 1, view = r.view, fl = c.flash > 0, T = MKA_ICE, glow = c.grow >= 1;
  r.shadow(c.x, c.y, 7, .45);
  const order = c.shards.map((s, i) => [view.order(c.x + s.dx, c.y + s.dy), i]).sort((a, b) => a[0] - b[0]);
  r.queue(c.x, c.y, 0, g => {
    for (const [, i] of order) {
      const s = c.shards[i], bx = c.x + s.dx, by = c.y + s.dy, H = s.h * k, w = s.w;
      const qx = view.ax / view.scale, qy = view.ay / view.scale, [tx, ty] = r.w(bx + s.lx * k, by + s.ly * k, H), [lx, ly] = r.w(bx - qx * w, by - qy * w, 0), [rx, ry] = r.w(bx + qx * w, by + qy * w, 0), [mx, my] = r.w(bx, by, 0);
      px.poly(g, [[lx, ly], [tx, ty], [mx, my + 1]], fl ? '#ffffff' : T.lt); px.poly(g, [[mx, my + 1], [tx, ty], [rx, ry]], fl ? T.lt : T.sh);
      px.line(g, mx, my, tx, ty, T.hi); px.dot(g, tx, ty + 1, '#ffffff');
    }
  }, { emissive: glow, bias: .01 });
  if (glow) { L.add(c.x, c.y, 12, 44, .45 + .1 * Math.sin(game.time * 2 + c.x), { color: '#a8e8ff' }); r.decal(() => r.groundRing(c.x, c.y, 9 + Math.sin(game.time * 3) * .8, '#bfefff', .35), { emissive: .5 }); }
}
function MKA_chunks(L0, x, y, n) {
  if (!L0) return; const A = L0.mkaChunks || (L0.mkaChunks = []);
  for (let i = 0; i < n && A.length < 70; i++) { const a = Math.random() * TAU, sp = 40 + Math.random() * 100; A.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: Math.random() * TAU, vr: (Math.random() - .5) * 14, s: 1.1 + Math.random() * 1.5, t: 0, max: 1.6 + Math.random() * 1.6 }); }
}
/** a sliding body meets a wall (or a pylon, a keg, a crystal): a crunch, damage by speed, a stun */
function MKA_slam(L0, m, sp, ux, uy, thing) {
  const k = clamp(sp / 170, .6, 1.8);
  m.vx = -ux * sp * .22; m.vy = -uy * sp * .22; m._mkaSlide = 0;
  dealDamage(m, MKA_hit(heroHitAmount(1.1) * k + m.maxHp * .05, 'phys', { stun: .8 * k, ang: Math.atan2(-uy, -ux), tags: ['slam', 'mechanic'] }));
  if (thing && thing.hittable) hitThing(thing, MKA_hit(heroHitAmount(.6), 'phys', { ang: Math.atan2(uy, ux), kb: 60 }));
  const cx = m.x + ux * m.r, cy = m.y + uy * m.r, z = (m.head || 20) * .4 * (m.scale || 1);
  P.impact(cx, cy, z, 10, '#ffffff'); P.bits(cx, cy, z, 10, ['#dff8ff', '#9fdfff', '#ffffff']); P.dust(cx, cy, 2, 6, { speed: 40 });
  game.freeze(.05); shake(3); sfx('thud', { vol: .9 }); sfx('crack', { vol: .45 });
  if (m.rig) m.rig.kick(4); else if (m.blob) m.blob.kick(7);
}
/** a frozen foe breaks apart: shards fly, the body is gone, and the burst chills (and hurts) its neighbours. Frozen
 *  neighbours are brittle: the shards take a third of their life, so a frozen pack breaks in a chain, one into the next */
function MKA_shatter(L0, m) {
  const x = m.x, y = m.y, z = (m.head || 20) * .5 * (m.scale || 1);
  m.gone = true;
  sfx('crack', { vol: 1 }); sfx('freeze', { vol: .7, pitch: .7 }); game.freeze(.05); shake(3);
  P.bits(x, y, z, 24, ['#ffffff', '#dff8ff', '#9fdfff', m.rig ? m.rig.C.cloth : m.blob ? m.blob.C.base : '#7fd8ff']); P.glints(x, y, z, 9, '#e8fbff', 16); P.ring(x, y, 3, 36, '#bfefff', .35); P.impact(x, y, z, 11, '#bfefff');
  MKA_chunks(L0, x, y, 7);
  const set = new Set([m]), n = (L0 && (L0._mkaShN = (L0._mkaShN || 0) + 1)) || 1;
  game.after(.06, () => { if (L0) L0._mkaShN = Math.max(0, (L0._mkaShN || 1) - 1); });
  eachEnemy('hero', x, y, 34, u => {   // (the brittle ones a beat later, nearest first: the chain reads as a ripple of cracks)
    if (set.has(u)) return; set.add(u); const brittle = !!u.st.freeze && !u.boss, d = Math.hypot(u.x - x, u.y - y);
    const hit = () => { if (!u.alive) return; if (brittle) u._mkaFrz = game.time; dealDamage(u, MKA_hit(heroHitAmount(brittle ? 1.4 : .7) + (brittle ? u.maxHp * .34 : 0), 'frost', { kb: brittle ? 0 : 110, ang: Math.atan2(u.y - y, u.x - x), statusChance: brittle ? 0 : 1, statusPower: 1.2, tags: ['aoe', 'shatter', 'mechanic'] })); };
    if (brittle && n < 40) game.after(.05 + d / 400, hit); else hit();
  });
}

/* =============================================================================
 * BROOD (depth 7): pulsing flesh nests, veined to each other across the floor. While the hero is near, each births a
 * swarmer every few beats (broodlings, crawlers, or little flesh slimes). Burst a nest: gore, a spray of loot and a
 * chunk of experience. Power-levelers farm the spawns; speedrunners burn the nests.
 * ============================================================================= */
const MKA_FLESH = { deep: '#2c0818', sh: '#5c1630', base: '#8a2644', lt: '#b8506a', hi: '#f0a0a8', vein: '#3a0620', glow: '#f0e070' };
const MKA_FLESH_FL = { deep: '#c86a7a', sh: '#e08a98', base: '#f0b0b8', lt: '#ffd8dc', hi: '#ffffff', vein: '#c86a7a', glow: '#ffffff' };
const MKA_GORE = ['#9a2e4a', '#c85a6e', '#6a1a34', '#f0a0a8', '#d8c8a0'];
const MKA_BROOD_SLIME = { dk: '#4a1428', base: '#b04a5a', lt: '#f0a0a8', spec: '#fff0f0', eye: '#f0e070', pupil: '#2a0810' };
const MKA_beat = p => { const c = ((p % 1) + 1) % 1; return Math.exp(-(((c - .08) / .045) ** 2)) + .65 * Math.exp(-(((c - .27) / .05) ** 2)); };   // lub-dub
def('mechanics', 'brood', { name: 'Brood Nests', title: 'The Brood Warrens', adj: 'Teeming', noun: 'Warrens', color: '#d8506a', depth: 7, weight: 10,
  tip: 'Nests birth swarmers while you are near. Farm the brood for experience, or burst the nests for loot and move on.',
  brief: 'Nests birth swarmers: farm or burst them.', lure: 'to a nest', act: 'burst the nest',
  icon(g, x, y, s) {
    const R = MKA_ir(g, x, y, s);
    px.ell(g, x + 8 * s, y + 10 * s, 7 * s, 5.2 * s, MKA_FLESH.deep); px.ell(g, x + 8 * s, y + 9.6 * s, 6 * s, 4.4 * s, '#b0405a'); px.ell(g, x + 6.2 * s, y + 8 * s, 2.6 * s, 1.8 * s, '#e07888'); R(5, 7, 1, 1, '#ffd0d8');
    px.ell(g, x + 8 * s, y + 6 * s, 2.2 * s, 1.1 * s, MKA_FLESH.deep); R(7, 6, 2, 1, MKA_FLESH.glow);
    px.line(g, x + 3 * s, y + 12 * s, x + 5 * s, y + 9 * s, MKA_FLESH.vein); px.line(g, x + 12 * s, y + 12 * s, x + 10.5 * s, y + 8 * s, MKA_FLESH.vein); R(1, 14, 3, 1, MKA_FLESH.sh); R(12, 14, 3, 1, MKA_FLESH.sh);
  },
  place(L0, R) {
    const nests = L0.mkaNests || (L0.mkaNests = []), want = nests.length + Math.max(3, Math.round(L0.rooms.length * .8)), m = L0.map;
    const rooms = R.shuffle(L0.rooms.filter(r0 => !(L0.start.x >= r0.x * 16 && L0.start.x < (r0.x + r0.w) * 16 && L0.start.y >= r0.y * 16 && L0.start.y < (r0.y + r0.h) * 16)));
    for (const r0 of rooms) for (let j = 0; j < (r0.w * r0.h > 90 ? 2 : 1) && nests.length < want; j++) for (let k = 0; k < 16; k++) {
      const cx = r0.x + 1 + R.int(0, Math.max(0, r0.w - 3)), cy = r0.y + 1 + R.int(0, Math.max(0, r0.h - 3)), x = MKA_cc(cx), y = MKA_cc(cy);
      if (!MKA_room(L0, cx, cy, 1) || !MKA_free(L0, cx, cy, { tagOk: true, start: 110, exit: 70, thing: 14 }) || nests.some(n => Math.hypot(n.x - x, n.y - y) < 64)) continue;
      nests.push(addThing(L0, MKA_nest(L0, x + R.range(-3, 3), y + R.range(-3, 3), R))); break;
    }
    // veins: each nest to its nearest one or two in sight
    L0.mkaVeins = [];
    for (const a of nests) for (const b of nests.filter(q => q !== a && Math.hypot(q.x - a.x, q.y - a.y) < 230 && m.los(a.x, a.y, q.x, q.y)).sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y)).slice(0, 2))
      if (!L0.mkaVeins.some(v => (v.a === a && v.b === b) || (v.a === b && v.b === a))) L0.mkaVeins.push(MKA_vein(a, b, R));
  },
  draw(L0, r) {
    const t = game.time, zm = r.view.zoom || 1;
    for (const v of L0.mkaVeins || []) {
      if (!r.visible(v.a.x, v.a.y, 0, 200, 150, 150) && !r.visible(v.b.x, v.b.y, 0, 200, 150, 150)) continue;
      const dead = v.a.dead || v.b.dead;
      r.decal(g => {
        const c1 = dead ? '#2e2228' : MKA_FLESH.vein, c2 = dead ? '#4a3a3e' : MKA_FLESH.base; let prev = null;
        for (let i = 1; i < v.pts.length - 1; i++) { const p = v.pts[i], q = r.w(p[0], p[1], 0); if (prev) { px.line(g, prev[0], prev[1], q[0], q[1], c1, 2); px.line(g, prev[0], prev[1] - 1, q[0], q[1] - 1, c2); } prev = q; }
        if (dead) return;
        for (const off of [0, .5]) {   // the heartbeat runs along the vein
          const u = ((t * .55 + v.ph + off) % 1), f = 1 + u * (v.pts.length - 3), i = Math.floor(f), w = f - i, p0 = v.pts[i], p1 = v.pts[Math.min(i + 1, v.pts.length - 1)], q = r.w(lerp(p0[0], p1[0], w), lerp(p0[1], p1[1], w), 0);
          px.disc(g, q[0], q[1], 1.4 * zm, '#e0506a'); px.dot(g, q[0], q[1] - 1, '#ffc0c8');
        }
      }, { emissive: dead ? 0 : .3 });
    }
    for (const n of L0.mkaNests || []) {   // creep (raw flesh spreading over the floor) and tendrils reaching out from the base
      if (!r.visible(n.x, n.y, 0, 70, 70, 50)) continue;
      const dry = n.dead ? clamp(n.deadT / 20, 0, 1) : 0, bt = n.dead ? 0 : MKA_beat(t * n.rate + n.ph);
      r.decal(g => {
        for (const [k, c, a] of [[1.9, '#2a0612', .55], [1.45, '#4a0c22', .5], [1.1, '#6a1830', .45]]) {
          const pts = []; for (let i = 0; i < 20; i++) { const an = i / 20 * TAU, w = 1 + .22 * Math.sin(an * 3 + n.seed) + .14 * Math.sin(an * 7 + n.seed * 2) + bt * .03; pts.push(r.w(n.x + Math.cos(an) * n.R * k * w, n.y + Math.sin(an) * n.R * k * w, 0)); }
          px.blend(g, a * (1 - dry * .6), 'normal', () => px.poly(g, pts, c));
        }
      });
      if (n.dead) continue;
      r.decal(g => {
        for (let i = 0; i < 6; i++) {
          const a0 = n.seed + i * TAU / 6, len = 10 + (i * 7 % 5) * 1.6; let prev = null;
          for (let s = 0; s <= 5; s++) { const u = s / 5, a = a0 + Math.sin(t * 1.4 + i * 2 + u * 3) * .22 * u, rr = n.R * .85 + u * len, q = r.w(n.x + Math.cos(a) * rr, n.y + Math.sin(a) * rr, 0); if (prev) px.line(g, prev[0], prev[1], q[0], q[1], u < .5 ? MKA_FLESH.sh : MKA_FLESH.vein, u < .4 ? 2 : 1); prev = q; }
        }
      });
    }
  }
});
function MKA_vein(a, b, R) {
  const pts = [], dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, bend = (R() - .5) * len * .35, s = R() * 9;
  for (let i = 0; i <= 16; i++) { const u = i / 16, w = Math.sin(u * Math.PI) * (bend + Math.sin(u * 17 + s) * 2.4); pts.push([a.x + dx * u + nx * w, a.y + dy * u + ny * w]); }
  return { a, b, pts, ph: R() };
}
function MKA_nest(L0, x, y, R) {
  return { kind: 'nest', x, y, r: 9, R: 9 + R() * 2, H: 11 + R() * 3, solid: true, hittable: true, keep: true, hp: 0, maxHp: 0, depth: L0.depth || ED.depth || 1, ph: R() * TAU, rate: .85 + R() * .3, cd: .6 + R() * 1.4, birth: 0, open: 0, sq: 0, sqV: 0, flash: 0, kids: [], seed: R() * 99, mapColor: '#d8506a',
    onHit(hit) { MKA_nestHit(this, hit); }, update(dt) { MKA_nestStep(L0, this, dt); }, draw(r) { MKA_nestDraw(this, r); } };
}
function MKA_nestHp(n) { if (!n.maxHp) n.maxHp = n.hp = Math.round(75 * SCALE.foeHp(n.depth) * DIFF.foeHp); }
function MKA_nestHit(n, hit) {
  if (n.dead) return; MKA_nestHp(n);
  const src = hit.src, crit = !!(src && src.critChance && Math.random() < src.critChance), amt = Math.max(1, (hit.amount || 1) * (crit ? src.critMul || 1.5 : 1) * DIFF.heroDmg);
  n.hp -= amt; n.flash = .08; n.sqV += 7; n.hitA = hit.ang;
  const a = hit.ang !== undefined ? hit.ang + Math.PI : Math.random() * TAU, hx = n.x + Math.cos(a) * n.R * .8, hy = n.y + Math.sin(a) * n.R * .8;
  P.impact(hx, hy, 8, crit ? 9 : 6, '#ffb0b8'); P.bits(hx, hy, 8, 5, MKA_GORE); sfx('punch', { vol: .5, pitch: .75 }); sfx('bloop', { vol: .25, pitch: .6 }); game.freeze(.03); shake(1.5);
  if (OPT.numbers) P.text(n.x + (Math.random() - .5) * 6, n.y, 24, fmt(amt) + (crit ? '!' : ''), crit ? '#ffd23a' : '#fff2c4', { scale: crit ? 2 : 1, bounce: crit });
  if (n.hp <= 0) MKA_nestBurst(n);
}
function MKA_nestBurst(n) {
  n.dead = true; n.hittable = false; n.deadT = 0; n.mapColor = null;
  const x = n.x, y = n.y, d = n.depth, h = ED.hero;
  sfx('explode', { vol: .55, pitch: 1.4 }); sfx({ wave: 'noise', freq: 900, to: 120, dur: .4, vol: .35, filter: 'lowpass' }); sfx('bloop', { vol: .5, pitch: .5 });
  game.freeze(.08); shake(5); game.flash('#ff6a7a', .1, .3);
  P.bits(x, y, 10, 44, MKA_GORE); P.ring(x, y, 4, 46, '#ff8a9a', .4); P.smoke(x, y, 6, 6, { size: 4, color: '#8a3a4a', dark: '#4a1a24', light: '#b86a78' }); FX.scorch(x, y, 24, '#3a0c18', 14);
  for (let i = 0; i < 10; i++) { const a = Math.random() * TAU, sp = 50 + Math.random() * 90; P.add({ kind: 'bit', x, y, z: 12, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 90 + Math.random() * 110, g: 420, bounce: .3, drag: .6, max: 1.4, size: 2, color: MKA_GORE[i % 3] }); }
  // a spray of loot and a chunk of experience
  const gf = (h && h.stats.goldFind) || 0, mf = (h && h.stats.magicFind) || 0;
  for (let i = 0; i < 4; i++) dropLoot('gold', x, y, { n: Math.max(1, Math.round((4 + rnd() * 6) * SCALE.gold(d) * (1 + gf / 100) * DIFF.loot)) });
  dropLoot('item', x, y, { item: makeItem({ ilvl: d + 1, rarity: rollRarity(d + 1, rnd, mf, .3) }) });
  if (rnd.chance(.45 * DIFF.loot)) dropLoot('item', x, y, { item: makeItem({ ilvl: d + 1, rarity: rollRarity(d + 1, rnd, mf, .15) }) });
  if (h && rnd.chance(.35) && h.potions < h.maxPotions) dropLoot('potion', x, y);
  if (h && h.alive) { const xp = Math.round(50 * SCALE.foeXp(d)); gainXp(h, xp); P.text(x, y, 34, '+' + fmt(xp * (1 + (h.stats.xpGain || 0) / 100) * DIFF.xp) + ' XP', '#c8a0ff'); }
  for (const k of n.kids) if (k.alive) k.stunT = Math.max(k.stunT || 0, .9);   // its brood reels
  notify('NEST BURST', '#ff8a9a', 1.6);
}
function MKA_nestStep(L0, n, dt) {
  n.sqV += (-220 * n.sq - 11 * n.sqV) * dt; n.sq = clamp(n.sq + n.sqV * dt, -.35, .35); n.flash -= dt;
  if (n.dead) { n.deadT += dt; return; }
  MKA_nestHp(n);
  if (n.kids.some(k => !k.alive)) n.kids = n.kids.filter(k => k.alive);
  n.open = approach(n.open, n.birth > 0 ? 1 : 0, dt * (n.birth > 0 ? 3 : 4));
  if (n.birth > 0) { n.sqV += Math.sin(game.time * 45) * 60 * dt; if (Math.random() < dt * 20) P.add({ kind: 'bit', x: n.x, y: n.y, z: n.H, vx: (Math.random() - .5) * 30, vy: (Math.random() - .5) * 30, vz: 40, g: 300, max: .5, color: MKA_FLESH.hi }); if ((n.birth -= dt) <= 0) MKA_birth(L0, n); return; }
  const h = ED.hero; if (!h || !h.alive || Math.hypot(h.x - n.x, h.y - n.y) > 170 || n.kids.length >= 4) return;
  let all = 0; for (const q of L0.mkaNests) all += q.kids.length; if (all >= 26) return;
  if ((n.cd -= dt * (1 + Math.min(1, (n.depth - 1) * .03))) <= 0) { n.cd = 2 + Math.random() * 1.2; n.birth = .55; sfx({ wave: 'sine', freq: 140, to: 90, dur: .5, vol: .18, vib: [9, .2] }); }
}
function MKA_birth(L0, n) {
  const id = REG.archetypes.broodling ? 'broodling' : REG.archetypes.crawler ? 'crawler' : 'slime', h = ED.hero;
  const a = (h ? Math.atan2(h.y - n.y, h.x - n.x) : 0) + (Math.random() - .5) * 1.4, x = n.x + Math.cos(a) * (n.r + 2), y = n.y + Math.sin(a) * (n.r + 2);
  const o = { instant: true, level: n.depth };
  if (id === 'slime') Object.assign(o, { scale: .7, pal: MKA_BROOD_SLIME, blob: { mouth: 'fangs', feet: true } });
  const m = spawnMonster(id, x, y, o); if (!m) return;
  m.noLoot = true; m.xp *= .5; m.ai.aware = true; m.brood = n; n.kids.push(m);
  m.z = n.H * .8; m.vz = 120 + Math.random() * 40; m.air = true; m.vx = Math.cos(a) * 60; m.vy = Math.sin(a) * 60;   // flung out of the mouth
  n.sqV -= 12; P.bits(n.x, n.y, n.H, 14, MKA_GORE); P.add({ kind: 'dust', x: n.x, y: n.y, z: n.H, vz: 14, max: .6, size: 2.5, color: '#c86a7a' });
  sfx({ wave: 'noise', freq: 700, to: 180, dur: .2, vol: .3, filter: 'lowpass' }); sfx('bloop', { vol: .35, pitch: .8 });
}
function MKA_nestDraw(n, r) {
  if (!r.visible(n.x, n.y, 0, 60, 70, 40)) return;
  const t = game.time, zm = r.view.zoom || 1, view = r.view;
  if (n.dead) {   // a torn, collapsed husk that dries out
    const a = clamp(1 - (n.deadT - 25) / 5, 0, 1); if (a <= 0) return;
    r.queue(n.x, n.y, 0, g => px.blend(g, a, 'normal', () => {
      px.poly(g, r.groundPts(n.x, n.y, n.R * 1.05, 16, 0), '#2a0a16'); px.poly(g, r.groundPts(n.x, n.y, n.R * .8, 16, 2.5), '#4a1424');
      for (let i = 0; i < 7; i++) { const b = n.seed + i * TAU / 7, q0 = r.w(n.x + Math.cos(b) * n.R * .7, n.y + Math.sin(b) * n.R * .7, 2.5), q1 = r.w(n.x + Math.cos(b + .2) * n.R * .5, n.y + Math.sin(b + .2) * n.R * .5, 5 + (i % 3) * 2); px.poly(g, [[q0[0] - 2 * zm, q0[1]], q1, [q0[0] + 2 * zm, q0[1]]], i % 2 ? '#6a1a34' : '#8a2a40'); }
      px.poly(g, r.groundPts(n.x, n.y, n.R * .45, 12, 2.6), '#12060a');
    }));
    return;
  }
  const bt = MKA_beat(t * n.rate + n.ph), R0 = n.R * (1 + bt * .06 - n.sq * .25), H = n.H * (1 + bt * .08 + n.sq * .5) + n.open * 2, C = n.flash > 0 ? MKA_FLESH_FL : MKA_FLESH, hurt = 1 - n.hp / (n.maxHp || 1);
  r.shadow(n.x, n.y, R0 + 2, .55);
  r.queue(n.x, n.y, 0, g => {
    // a lumpy dome of stacked slices (each slice a wobbly ring, darker at the foot, wet and bright on top)
    const cols = [C.deep, C.sh, C.sh, C.base, C.base, C.base, C.lt, C.lt], lump = (a, u) => 1 + .09 * Math.sin(a * 3 + n.seed) + .06 * Math.sin(a * 5 - n.seed * 2 + u * 2) + .03 * Math.sin(a * 2 + t * 2 + n.ph);
    const surf = (a, u) => { const rad = R0 * Math.sqrt(Math.max(0, 1 - u * u * .9)) * lump(a, u); return r.w(n.x - u * .9 + Math.cos(a) * rad, n.y - u * .9 + Math.sin(a) * rad, H * u * .92); };
    for (let k = 0; k < 8; k++) { const u = k / 8, pts = []; for (let i = 0; i < 22; i++) pts.push(surf(i / 22 * TAU, u)); px.poly(g, pts, cols[k]); }
    px.poly(g, r.groundPts(n.x - R0 * .34, n.y - R0 * .38, R0 * .26, 10, H * .74), C.hi); px.poly(g, r.groundPts(n.x - R0 * .3, n.y - R0 * .5, R0 * .1, 6, H * .8), '#ffffff');   // the wet sheen
    const side = a => Math.cos(a) * view.fx + Math.sin(a) * view.fy;
    for (let i = 0; i < 9; i++) {   // pores and blisters on the side we see
      const a = n.seed * 2 + i * 1.7, u = .2 + (i * .37 % 1) * .55; if (side(a) < .15) continue;
      const q = surf(a, u); px.rect(g, q[0], q[1], Math.max(1, Math.round(zm)), Math.max(1, Math.round(zm)), i % 3 ? C.deep : C.hi);
    }
    for (let i = 0; i < 7; i++) {   // veins down the side we see: thick trunks, a twig off each
      const a0 = n.ph + i * .9; if (side(a0) < -.05) continue;
      let prev = null;
      for (let s = 0; s <= 6; s++) {
        const u = .95 - s * .15, a = a0 + Math.sin(s * 1.3 + i) * .2, q = surf(a, u);
        if (prev) { px.line(g, prev[0], prev[1], q[0], q[1], C.vein, s > 2 ? 2 : 1); if (s === 3) { const tw = surf(a + .35, u + .12); px.line(g, q[0], q[1], tw[0], tw[1], C.vein); } }
        prev = q;
      }
    }
    if (hurt > .3) for (let i = 0; i < 1 + Math.floor(hurt * 3); i++) {   // splits in the skin, glowing inside, as it weakens
      const a = n.seed * 3 + i * 2.1; if (Math.cos(a) * view.fx + Math.sin(a) * view.fy < .1) continue;
      const q0 = r.w(n.x + Math.cos(a) * R0 * .85, n.y + Math.sin(a) * R0 * .85, H * .25), q1 = r.w(n.x + Math.cos(a + .15) * R0 * .7, n.y + Math.sin(a + .15) * R0 * .7, H * .6);
      px.line(g, q0[0], q0[1], q1[0], q1[1], C.deep, 2); px.glow(g, 1); px.line(g, q0[0], q0[1], q1[0], q1[1], C.glow); px.glow(g, 0);
    }
    const mo = 1.6 + 3.3 * n.open;   // the mouth on top: puckered, it gapes when it births
    px.poly(g, r.groundPts(n.x, n.y, mo + 1.1, 12, H * .95), C.sh); px.poly(g, r.groundPts(n.x, n.y, mo, 12, H * .96), C.deep);
    if (n.open > .1) { px.glow(g, 1); px.poly(g, r.groundPts(n.x, n.y, mo * .55, 10, H * .97), C.glow); px.glow(g, 0); }
    for (let i = 0; i < 6; i++) {   // eggs and pustules around the base
      const a = n.seed + i * TAU / 6 + Math.sin(i * 7) * .4; if (Math.cos(a) * view.fx + Math.sin(a) * view.fy < -.25) continue;
      const [ex, ey] = r.w(n.x + Math.cos(a) * R0 * .98, n.y + Math.sin(a) * R0 * .98, 1.4), s2 = (1.1 + (i % 3) * .4) * zm * (1 + bt * .12), egg = i % 2;
      px.disc(g, ex, ey, s2 + .7, C.deep); px.disc(g, ex, ey, s2, egg ? '#b89a6a' : C.sh); px.disc(g, ex - s2 * .25, ey - s2 * .25, s2 * .6, egg ? '#e8d8a8' : C.lt); px.dot(g, ex - s2 * .45, ey - s2 * .45, '#ffffff');
    }
  });
  if (n.open > .1) L.add(n.x, n.y, n.H, 44, .55 * n.open, { color: '#e0e070' });
  L.add(n.x, n.y, 6, 34, .18 + .22 * bt, { color: '#ff5a6a' });
}

/* =============================================================================
 * PYLONS (depth 8): stormglass spires on copper-studded plinths. Every blow (a sword, a bolt, a blast) charges one;
 * charged pylons in reach of each other arc lightning between them, burning anything that crosses, and zap foes that
 * come near. A full pylon spills charge down its links: charge a hub and the web grows. Drag packs through it.
 * ============================================================================= */
const MKA_PY = { dull: '#5a4a8a', bright: '#cdb8ff', storm: '#ffe45a', arc: '#b890ff' };
def('mechanics', 'pylons', { name: 'Stormglass Pylons', title: 'The Stormglass Mines', adj: 'Stormlit', noun: 'Stormglass Mines', color: '#ffe45a', depth: 8, weight: 10,
  tip: 'Strike a pylon to charge it. Charged pylons arc lightning to each other and zap what comes near. Charge a web, then drag packs through it.',
  brief: 'Struck pylons charge and arc bolts.', lure: 'between the pylons', act: 'charge the pylons',
  icon(g, x, y, s) {
    const R = MKA_ir(g, x, y, s);
    px.poly(g, [[x + 8 * s, y + 1 * s], [x + 11 * s, y + 5 * s], [x + 11 * s, y + 13 * s], [x + 5 * s, y + 13 * s], [x + 5 * s, y + 5 * s]], '#7a6ab8');
    px.poly(g, [[x + 8 * s, y + 1 * s], [x + 5 * s, y + 5 * s], [x + 5 * s, y + 13 * s], [x + 8 * s, y + 13 * s]], MKA_PY.bright);
    R(3, 13, 10, 2, '#4a4458'); R(3, 12, 10, 1, '#c87a3a');
    px.poly(g, [[x + 9 * s, y + 3 * s], [x + 6 * s, y + 8 * s], [x + 8 * s, y + 8 * s], [x + 7 * s, y + 12 * s], [x + 10 * s, y + 6.5 * s], [x + 8 * s, y + 6.5 * s]], MKA_PY.storm);
    R(1, 4, 1, 1, MKA_PY.storm); R(14, 7, 1, 1, MKA_PY.storm);
  },
  place(L0, R) {
    const PY = L0.mkaPylons || (L0.mkaPylons = []), want = PY.length + Math.max(5, Math.round(L0.rooms.length * 1.5));
    for (let k = 0; k < want * 10 && PY.length < want; k++) {
      let cx, cy;
      if (PY.length && R.chance(.6)) { const b = R.pick(PY), a = R() * TAU, d = R.range(52, 100); cx = Math.floor((b.x + Math.cos(a) * d) / 16); cy = Math.floor((b.y + Math.sin(a) * d) / 16); }   // grow clusters, so webs can form
      else { const p = L0.randomFloor(R, { minStart: 70, edge: 1 }); cx = Math.floor(p[0] / 16); cy = Math.floor(p[1] / 16); }
      const x = MKA_cc(cx), y = MKA_cc(cy);
      if (!MKA_room(L0, cx, cy, 1) || !MKA_free(L0, cx, cy, { tagOk: true, start: 80, exit: 50, thing: 10 }) || PY.some(q => Math.hypot(q.x - x, q.y - y) < 46)) continue;
      PY.push(addThing(L0, MKA_pylon(x + R.range(-3, 3), y + R.range(-3, 3), R)));
    }
    for (const p of PY) p.links = PY.filter(q => q !== p && Math.hypot(q.x - p.x, q.y - p.y) < 132 && L0.map.los(p.x, p.y, q.x, q.y));
    L0.mkaArcs = [];
  },
  update(L0, dt) {
    const PY = L0.mkaPylons; if (!PY) return;
    const arcs = L0.mkaArcs || (L0.mkaArcs = []); arcs.length = 0;
    for (const a of PY) if (a.charge >= .3) for (const b of a.links) if (b.charge >= .3 && a.x + a.y * 1e-3 < b.x + b.y * 1e-3) arcs.push([a, b]);
    if ((L0._mkaArcT = (L0._mkaArcT || 0) - dt) > 0 || !arcs.length) return;
    L0._mkaArcT = .2; let hits = 0;
    for (const [a, b] of arcs) {   // the beam burns whatever crosses it
      const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy, len = Math.sqrt(l2), k = Math.min(a.charge, b.charge);
      eachEnemy('hero', (a.x + b.x) / 2, (a.y + b.y) / 2, len / 2 + 8, u => {
        const s = clamp(((u.x - a.x) * dx + (u.y - a.y) * dy) / l2, 0, 1), qx = a.x + dx * s, qy = a.y + dy * s;
        if (Math.hypot(u.x - qx, u.y - qy) > u.r + 4 || (u.z || 0) > 30) return;
        dealDamage(u, MKA_hit(heroHitAmount(.55 + .35 * k), 'storm', { kb: 50, ang: Math.atan2(u.y - qy, u.x - qx), statusChance: .35, tags: ['beam', 'mechanic'] }));
        P.sparks(u.x, u.y, 14, 5, null, { color: MKA_PY.storm, hot: '#ffffff' }); hits++;
      });
    }
    if (hits) { sfx('zap', { vol: .35, pitch: .9 }); shake(1); }
  },
  draw(L0, r) {
    for (const [a, b] of L0.mkaArcs || []) {
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, k = Math.min(a.charge, b.charge); if (!r.visible(mx, my, 18, 200, 200, 200)) continue;
      r.queue(mx, my, 18, g => {
        const [x0, y0] = r.w(a.x, a.y, 20), [x1, y1] = r.w(b.x, b.y, 20), sd = (a.ph * 100) | 0;
        px.glow(g, 1); px.blend(g, .3 + .3 * k, 'add', () => zig(g, x0, y0, x1, y1, MKA_PY.arc, 3, 6, sd + 7));
        zig(g, x0, y0, x1, y1, MKA_PY.storm, 1, 5, sd); if (Math.random() < .5) zig(g, x0, y0, x1, y1, '#ffffff', 1, 4, sd + 3);
      }, { emissive: true, bias: .5 });
      L.add(mx, my, 18, Math.hypot(b.x - a.x, b.y - a.y) * .5 + 20, .45 + .4 * k, { color: '#d8c0ff' });
      r.decal(() => { r.groundRing(a.x, a.y, 9, MKA_PY.storm, .35 * k); r.groundRing(b.x, b.y, 9, MKA_PY.storm, .35 * k); }, { emissive: .5 });
    }
  }
});
function MKA_pylon(x, y, R) {
  return { kind: 'pylon', x, y, r: 5.5, solid: true, hittable: true, charge: 0, zapT: 1, flash: 0, wob: 0, ph: R() * TAU, links: [], mapColor: '#6a5a9a',
    onHit(hit) { MKA_pylonHit(this, hit); }, update(dt) { MKA_pylonStep(this, dt); }, draw(r) { MKA_pylonDraw(this, r); } };
}
function MKA_pylonHit(p, hit) {
  const was = p.charge, k = .3 + clamp((hit.amount || 0) / Math.max(1, heroHitAmount(1)) * .08, 0, .25);
  p.charge = Math.min(1, p.charge + k); p.flash = .1; p.wob = 1;
  sfx('zap', { vol: .5, pitch: .8 + p.charge * .8 }); sfx('clang', { vol: .3, pitch: 1.4 });
  P.sparks(p.x, p.y, 16, 9, hit.ang !== undefined ? hit.ang + Math.PI : null, { color: MKA_PY.storm, hot: '#ffffff' }); P.glints(p.x, p.y, 20, 3, '#e8d8ff', 10); P.impact(p.x, p.y, 16, 7, MKA_PY.storm);
  game.freeze(.03); shake(1.5);
  if (was < .3 && p.charge >= .3) { P.ring(p.x, p.y, 4, 32, MKA_PY.storm, .35); sfx('chime', { vol: .35, pitch: 1.6 }); }
  if (was < 1 && p.charge >= 1) { P.ring(p.x, p.y, 4, 48, '#fff6c0', .45); sfx('powerup', { vol: .25, pitch: 1.5 }); }
}
function MKA_pylonStep(p, dt) {
  p.flash -= dt; p.wob = approach(p.wob, 0, dt * 3);
  if (p.charge <= 0) { p.mapColor = '#6a5a9a'; return; }
  p.charge = Math.max(0, p.charge - dt * .04);
  p.mapColor = p.charge >= .3 ? MKA_PY.storm : '#9a8ac8';
  if (p.charge < .3) return;
  if (Math.random() < dt * (3 + 8 * p.charge)) P.sparks(p.x + (Math.random() - .5) * 5, p.y + (Math.random() - .5) * 5, 8 + Math.random() * 22, 1, null, { color: MKA_PY.storm, hot: '#ffffff' });
  if ((p.zapT -= dt * (.55 + p.charge * .8)) <= 0) {
    p.zapT = 1 + Math.random() * .6;
    const tgt = nearestEnemy('hero', p.x, p.y, 64 + 40 * p.charge);
    if (tgt) { FX.chain({ team: 'hero', src: ED.hero, from: { x: p.x, y: p.y, z: 12 }, first: tgt, hops: 1 + Math.round(p.charge * 2), range: 56, el: 'storm', falloff: .8, hit: MKA_hit(heroHitAmount(.8 + .5 * p.charge), 'storm', { kb: 70, statusChance: .5, tags: ['spell', 'chain', 'mechanic'] }) }); p.flash = .08; p.wob = .6; game.freeze(.02); shake(1); }
  }
  if (p.charge > .92) for (const q of p.links) if (q.charge < p.charge - .25) q.charge = Math.min(1, q.charge + dt * .16);   // a full pylon spills its charge down the links
}
function MKA_pylonDraw(p, r) {
  if (!r.visible(p.x, p.y, 0, 40, 90, 40)) return;
  const k = p.charge, on = k >= .3, t = game.time, zm = r.view.zoom || 1, sc = r.view.scale, fl = p.flash > 0;
  const glass = E.mix(MKA_PY.dull, MKA_PY.bright, Math.min(1, k * 1.2)), T = E.tones(glass), sway = Math.sin(t * 38) * p.wob * .9 * zm;
  r.shadow(p.x, p.y, 6.5, .5);
  r.queue(p.x, p.y, 0, g => {   // the plinth: dark stone, copper studs
    r.box(g, p.x - 5, p.y - 5, 0, p.x + 5, p.y + 5, 4, '#5a5468', '#3e3a4a');
    for (const [dx, dy] of [[-4.2, -4.2], [4.2, -4.2], [-4.2, 4.2], [4.2, 4.2]]) { const [x, y] = r.w(p.x + dx, p.y + dy, 4.1); px.rect(g, x - 1, y - 1, 2, 2, '#c87a3a'); px.dot(g, x - 1, y - 1, '#f0b070'); }
  });
  r.queue(p.x, p.y, 4, g => {
    const [bx, by] = r.w(p.x, p.y, 4), [, my] = r.w(p.x, p.y, 25), [, ty] = r.w(p.x, p.y, 32), w = 3.3 * sc;
    for (const sd of [-1, 1]) {   // two lesser shards lean out of the base
      const ox = bx + sd * w * 1.15, [, sy] = r.w(p.x, p.y, sd > 0 ? 17 : 13), tx = ox + sd * 3.2 * zm + sway * .4;
      px.poly(g, [[ox - w * .42, by], [tx, sy], [ox + w * .42, by]], fl ? '#ffffff' : T.sh); px.poly(g, [[ox - w * .42, by], [tx, sy], [ox, by]], fl ? T.hi : T.base); px.line(g, ox, by, tx, sy, T.lt);
    }
    px.poly(g, [[bx - w, by], [bx - w * .8 + sway, my], [bx + sway, ty], [bx, by + 1]], fl ? '#ffffff' : T.lt);
    px.poly(g, [[bx, by + 1], [bx + sway, ty], [bx + w * .8 + sway, my], [bx + w, by]], fl ? T.hi : T.sh);
    px.line(g, bx, by, bx + sway, ty, T.hi); px.line(g, bx - w, by, bx - w * .8 + sway, my, T.deep); px.line(g, bx + w, by, bx + w * .8 + sway, my, T.deep);
    const bw = Math.round(w * 2 + 2), bh = Math.max(1, Math.round(2 * zm));   // the copper band
    px.rect(g, bx - w - 1, by - 3 * zm, bw, bh, '#b86a2a'); px.rect(g, bx - w - 1, by - 3 * zm, bw, 1, '#f0a860');
    if (k > .05) {   // charge: a glow, lightning crawling up the glass
      px.glow(g, 1); r.glowDisc(g, bx, (by * .6 + ty * .4), (4 + 5 * k) * zm, MKA_PY.arc, .1 + .2 * k);
      zig(g, bx + sway * .3, by - 3, bx + sway, ty + 3, on ? '#fff6c0' : '#d8c8ff', 1, 1.6 * zm, (p.ph * 50) | 0);
      if (on) { px.dot(g, bx + sway, ty, '#ffffff'); if (Math.sin(t * 20 + p.ph) > .6) px.rect(g, bx + sway - 1, ty - 1, 3, 3, '#fff6c0'); }
    }
  }, { emissive: k > .05, bias: .01 });
  if (k > .05) L.add(p.x, p.y, 20, 30 + 56 * k, .35 + .6 * k, { color: '#c8a8ff' });
}
}
