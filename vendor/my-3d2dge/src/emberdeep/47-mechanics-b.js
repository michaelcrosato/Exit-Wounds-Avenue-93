/* =============================================================================
 * MECHANICS B: the one new element of depths 9, 11, 12, 13 and 14
 *   timewell  THE STILLED CLOCKWORKS  clockwork domes where monsters (and their shots) run at a third of their speed
 *   dark      THE LIGHTLESS MAW       pitch black; struck lanterns burn down slowly; lit monsters are Exposed, hidden ones shrug blows off
 *   bloodrush THE CRIMSON RUSH        kills within 2.5 s chain into a streak: speed, attack speed and up to 3x experience
 *   launch    THE LEAPING SPIRES      linked rune pads throw the hero (and monsters) in high arcs across the level
 *   flood     THE DROWNED AQUEDUCT    a breathing tide and deep canals; storm arcs through a whole pool, fire on water scalds
 * They work in any theme, layout and depth, alone or mixed with anything. ?mechs=dark,flood adds any of these five to
 * any level (a global levelStart listener at the bottom). Private names start with MKB_.
 * ============================================================================= */
const MKB = { ids: ['timewell', 'dark', 'bloodrush', 'launch', 'flood'], frame: 0, hissT: 0, tickT: 0, rushT: 0 };
const MKB_SND = {
  tick: { wave: 'square', freq: 1900, to: 1500, dur: .02, vol: .06 }, tock: { wave: 'square', freq: 1250, to: 950, dur: .025, vol: .05 },
  hiss: { wave: 'noise', freq: 5200, to: 1500, dur: .55, vol: .13, filter: 'highpass' }, ignite: { wave: 'noise', freq: 420, to: 2600, dur: .3, vol: .22 },
  gutter: { wave: 'noise', freq: 1600, to: 260, dur: .4, vol: .1 }, pad: { wave: 'triangle', freq: 180, to: 900, dur: .24, vol: .24 },
  rush: { wave: 'square', freq: 330, to: 500, dur: .05, vol: .07 }, tide: { wave: 'triangle', freq: 70, to: 52, dur: 1.1, vol: .22 }
};
const MKB_N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
/** a share of the hero's hit in one element: what these mechanics deal, so they keep pace with his gear at any depth */
const MKB_hit = (scale, el = 'phys') => ED.hero ? heroHit(ED.hero, scale, { el, tags: ['aoe'] }).amount : heroHitAmount(scale);
const MKB_idx = (L0, x, y) => { const cx = Math.floor(x / T16), cy = Math.floor(y / T16); return cx < 0 || cy < 0 || cx >= L0.w || cy >= L0.h ? -1 : cy * L0.w + cx; };
/** a free spot on a room's floor: clear of the start rune, the exit, torches, big props and other things (o.big: honour
 *  big things' radii). o.near [x, y]: of the free spots found, the one nearest that point */
function MKB_spot(L0, R, o = {}) {
  const ms = o.minStart || 56, mx = o.minExit || 34, rr = o.r || 5, gap = o.gap === undefined ? 8 : o.gap;
  let best = null, bd = 1e9;
  for (let k = 0, found = 0; k < 24 && found < (o.near ? 6 : 1); k++) {
    const p = L0.randomFloor(R, { room: o.room, edge: o.edge === undefined ? 1 : o.edge, minStart: ms, minExit: mx });
    if (Math.hypot(p[0] - L0.start.x, p[1] - L0.start.y) < ms || (L0.exit && Math.hypot(p[0] - L0.exit.x, p[1] - L0.exit.y) < mx)) continue;   // randomFloor's fallback
    // big things (time wells) keep clear of each other and of ward circles; small things keep off a big thing's hub, and a
    // big one keeps its hub clear of them (a nest or a pylon may stand under a dome, never on its clock face's centre)
    if (L0.things.some(t => { if (t.dead || t.mark) return false; const d = Math.hypot(t.x - p[0], t.y - p[1]); return t.MKB_big ? d < (o.big ? t.r : 0) + rr + gap : t.kind === 'ward' ? d < t.r + rr + gap : d < (o.big ? (t.r || 5) + 16 : (t.r || 5) + rr + gap); })) continue;
    if (L0.torches.some(t => Math.hypot(t.x - p[0], t.y - p[1]) < (o.big ? 22 : rr + 10))) continue;
    if (L0.props.some(q => Math.hypot(q.x - p[0], q.y - p[1]) < (o.big ? 12 : rr + 4) + ((q.o && q.o.size) || 1) * 5)) continue;
    found++; const d = o.near ? Math.hypot(p[0] - o.near[0], p[1] - o.near[1]) : 0; if (d < bd) { bd = d; best = p; }
  }
  return best;
}
/** walking steps from a world point over open ground (walls, pits and deep water block); -1 where it cannot reach */
function MKB_bfs(L0, x, y) {
  const w = L0.w, h = L0.h, m = L0.map, d = new Int32Array(w * h).fill(-1), q = new Int32Array(w * h), s = MKB_idx(L0, x, y); let qh = 0, qt = 0;
  if (s < 0 || !m.walkable(s % w, (s / w) | 0)) return d;
  d[s] = 0; q[qt++] = s;
  while (qh < qt) { const c = q[qh++], cx = c % w, cy = (c / w) | 0; for (const [dx, dy] of MKB_N4) { const nx = cx + dx, ny = cy + dy, j = ny * w + nx; if (nx < 0 || ny < 0 || nx >= w || ny >= h || d[j] >= 0 || !m.walkable(nx, ny)) continue; d[j] = d[c] + 1; q[qt++] = j; } }
  return d;
}
const MKB_reach = L0 => { let n = 0; for (const v of MKB_bfs(L0, L0.start.x, L0.start.y)) if (v >= 0) n++; return n; };

/* ---------- shared: several of these mechanics shade the same monster (darkness hides it, steam veils it, light
   exposes it). Each step they multiply their share into m.MKB_fk (visibility) and m.MKB_dk (damage taken); one step
   listener writes the products into m.fade and m.dmgTaken, and gives back whatever other code had there ---------- */
function MKB_fade(m, k) { m.MKB_fk = (m.MKB_fk === undefined ? 1 : m.MKB_fk) * k; }
function MKB_taken(m, k) { m.MKB_dk = (m.MKB_dk === undefined ? 1 : m.MKB_dk) * k; }
function MKB_apply() {
  for (const m of ED.foes) {
    const f = m.MKB_fk, d = m.MKB_dk; m.MKB_fk = m.MKB_dk = undefined;
    if (m.fallT > 0) continue;   // falling into a chasm: the core fades it out
    if (f !== undefined && f < .995) { m.fade = f; m.MKB_fo = 1; } else if (m.MKB_fo) { m.fade = undefined; m.MKB_fo = 0; }
    if (m.MKB_dw !== undefined && m.dmgTaken !== m.MKB_dw) m.MKB_db = m.dmgTaken;   // someone else set it meanwhile: that is the new base
    if (d !== undefined && Math.abs(d - 1) > .005) { if (m.MKB_dw === undefined) m.MKB_db = m.dmgTaken; m.dmgTaken = (m.MKB_db === undefined ? 1 : m.MKB_db) * d; m.MKB_dw = m.dmgTaken; }
    else if (m.MKB_dw !== undefined) { m.dmgTaken = m.MKB_db; m.MKB_dw = m.MKB_db = undefined; }
  }
}
function MKB_hook() { const l = BUS.L.step; if (!l || !l.some(x => x.fn === MKB_apply)) BUS.on('step', MKB_apply, 'level'); }

/* =============================================================================
 * TIME WELLS (depth 9): THE STILLED CLOCKWORKS
 * Brass clock faces set into the floor, each under a faint dome of stilled time. A monster inside lives on a slow
 * clock (m.timeK: it walks, winds up, swings, even falls at 30%), its shots crawl, and it trails grey afterimages.
 * The hero keeps his own time. The exploit: fight inside, where every wind-up is three times as readable.
 * ============================================================================= */
const MKB_TW = { k: .3, boss: .55, edge: 8, brass: E.tones('#c8963a'), dome: '#7ec8f0', domeHi: '#e0f6ff' };
def('mechanics', 'timewell', { name: 'Time Wells', title: 'The Stilled Clockworks', adj: 'Stilled', noun: 'Clockworks', color: '#8ad8ff', depth: 9, weight: 8,
  tip: 'Inside a clockwork dome monsters move, strike and shoot at a third of their speed. You keep your own time: fight inside.',
  brief: 'Monsters in the domes move at a third speed.', lure: 'into a time well', act: 'fight inside the dome', zone: 'time wells',
  icon(g, x, y, s) {
    const cx = x + 8 * s, cy = y + 8 * s, B = MKB_TW.brass;
    px.disc(g, cx, cy, 7 * s, B.deep); px.disc(g, cx, cy, 6.3 * s, B.base); px.disc(g, cx - .5 * s, cy - .5 * s, 5.6 * s, B.lt); px.disc(g, cx, cy, 5 * s, '#15304a');
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; px.dot(g, cx + Math.cos(a) * 4 * s, cy + Math.sin(a) * 4 * s, i % 3 ? '#4a8ab8' : '#dff6ff'); }
    px.line(g, cx, cy, cx, cy - 3.6 * s, '#fff0c0'); px.line(g, cx, cy, cx + 2.6 * s, cy + 1.2 * s, B.hi); px.dot(g, cx, cy, '#ffffff');
  },
  place(L0, R) {
    const rooms = L0.rooms.length > 1 ? L0.rooms.slice(1) : L0.rooms, n = clamp(Math.round(L0.rooms.length * .45), 2, 6);
    for (let i = 0, k = 0; i < n && k < n * 5; k++) {
      const room = R.pick(rooms), rad = clamp(Math.min(room.w, room.h) * T16 * .4, 34, 58);
      const p = MKB_spot(L0, R, { room, edge: 2, r: rad, gap: 6, minStart: 44 + rad, minExit: 16 + rad, big: true });
      if (p) { addThing(L0, { kind: 'MKB_well', MKB_big: true, x: p[0], y: p[1], r: rad, rad, ph: R() * TAU, spin: R.chance(.5) ? 1 : -1, mapColor: '#8ad8ff', solid: false, hittable: false }); i++; }
    }
  },
  start(L0) { MKB_hook(); L0.MKB_wells = L0.things.filter(t => t.kind === 'MKB_well'); },
  update(L0, dt) {
    const W = L0.MKB_wells; if (!W || !W.length) return;
    const slow = (x, y, lo) => { let k = 1; for (const w of W) { const dx = x - w.x, dy = y - w.y, d2 = dx * dx + dy * dy; if (d2 < w.rad * w.rad) k = Math.min(k, lerp(1, lo, clamp((w.rad - Math.sqrt(d2)) / MKB_TW.edge, 0, 1))); } return k; };
    const rec = game.time - (L0.MKB_twRec || 0) > .06; if (rec) L0.MKB_twRec = game.time;
    for (const m of ED.foes) {
      if (!m.alive) continue;
      const k = slow(m.x, m.y, m.boss ? MKB_TW.boss : MKB_TW.k);
      if (k < .999) {
        if (!m.MKB_tw) { m.MKB_tw = 1; m.MKB_hist = []; P.ring(m.x, m.y, 2, 12 * (m.scale || 1), '#bfeaff', .35); }   // it crosses into stilled time
        m.timeK = k;
        if (rec) { const H = m.MKB_hist; H.push([m.x, m.y, m.z]); if (H.length > 12) H.shift(); }
      } else if (m.MKB_tw) { m.MKB_tw = 0; m.timeK = 1; m.MKB_hist = null; }
    }
    // their shots crawl too: each monster bolt's clock is wrapped once, then its rate is steered every step
    for (const f of ED.fx) {
      if (f.team !== 'foe' || f.kind !== 'bolt') continue;
      const k = slow(f.x, f.y, MKB_TW.k);
      if (!f.MKB_k) { if (k > .999) continue; const u0 = f.update; f.update = d => u0(d * f.MKB_k); }
      f.MKB_k = k;
    }
    // standing in a well, the hero hears the clockwork
    const h = ED.hero; if (h && h.alive && slow(h.x, h.y, 0) < .999 && (MKB.tickT -= dt) <= 0) { MKB.tickT = .5; sfx((L0.MKB_tock = !L0.MKB_tock) ? MKB_SND.tick : MKB_SND.tock); }
  },
  draw(L0, r) {
    for (const w of L0.MKB_wells || []) if (r.visible(w.x, w.y, 0, w.rad * 2 + 30, w.rad + 70, w.rad + 50)) { MKB_wellFloor(w, r); MKB_dome(w, r); L.add(w.x, w.y, 12, w.rad + 26, .42, { color: '#6ab8f0' }); }
    // slowed monsters: a turning tick ring at the feet and grey afterimages that trail their slow motion
    // (an echo is a full tinted body draw, the costliest thing here: the few slowed monsters nearest the hero get
    // them, two for the nearest two, one for the next, five at most; a crowd in a dome stays cheap)
    const echo = [], h = ED.hero;
    for (const m of ED.foes) {
      if (!m.MKB_tw || !m.alive || !r.visible(m.x, m.y, m.z, 40, 70, 40)) continue;
      const a = game.time * 1.3 + m.ph, rr = (m.r || 5) * (m.scale || 1);
      r.decal(() => { for (const o of [0, Math.PI]) r.groundArc(m.x, m.y, rr + 2, rr + 3.3, a + o, a + o + 1.1, '#9ad8ff', .65); }, { emissive: .5 });
      if (m.MKB_hist) echo.push(m);
    }
    if (h && echo.length > 1) echo.sort((p, q) => dist2(p, h) - dist2(q, h));
    let budget = 5;
    echo.forEach((m, n) => {
      const H = m.MKB_hist;
      for (const [back, al] of n < 2 ? [[4, .34], [8, .18]] : [[6, .28]]) {
        const q = H[H.length - 1 - back]; if (!q || budget <= 0) break;
        if (Math.hypot(q[0] - m.x, q[1] - m.y) < 2.5 && Math.abs(q[2] - m.z) < 1.5) continue;   // only when it really moved
        budget--; MKB_echo(r, m, q, al * (m.fade === undefined ? 1 : m.fade));
      }
    });
    // crawling shots leave a pale wake
    for (const f of ED.fx) if (f.MKB_k && f.MKB_k < .9 && f.vx !== undefined && r.visible(f.x, f.y, f.z, 20, 20, 20)) {
      const sp = Math.hypot(f.vx, f.vy) || 1, ux = f.vx / sp, uy = f.vy / sp;
      r.queue(f.x, f.y, f.z, g => px.blend(g, .5, 'add', () => { for (let i = 1; i <= 5; i++) { const [sx, sy] = r.w(f.x - ux * i * 3.5, f.y - uy * i * 3.5, f.z); px.dot(g, sx, sy, i < 3 ? '#dff6ff' : '#5a7a9a'); } }), { emissive: true, bias: .2 });
    }
  }
});
/** a desaturated copy of a monster's body at an older position (its slow motion, smeared) */
function MKB_echo(r, m, q, a) {
  const v = r.view, o = { flash: '#8a9cb4', flashMix: .8, alpha: a, outline: false, rim: false, bias: -.03 };
  if (m.rig) r.actor(q[0], q[1], q[2], (g, ox, oy) => m.rig.draw(g, ox, oy, v), o);
  else if (m.blob) r.actor(q[0], q[1], q[2], (g, ox, oy) => m.blob.draw(g, ox, oy, v), o);
  else if (m.body && m.body.draw) r.actor(q[0], q[1], q[2], (g, ox, oy) => m.body.draw(g, ox, oy, v, m), o);
}
/** a clock hand lying on the floor: a tapered blade with a counterweight tail, outlined, with a lit ridge */
function MKB_hand(r, g, x, y, a, len, wd, B) {
  const c = Math.cos(a), s = Math.sin(a), q = (f, sd) => r.w(x + c * f - s * sd, y + s * f + c * sd, 0);
  px.poly(g, [q(-6, 0), q(0, wd + 1), q(len + 1.6, 0), q(0, -wd - 1)], B.deep);
  px.poly(g, [q(-4.6, 0), q(0, wd), q(len, 0), q(0, -wd)], B.base);
  const [x0, y0] = q(-4, 0), [x1, y1] = q(len - .5, 0); px.line(g, x0, y0, x1, y1, B.hi);
}
/** the clock face on the floor: a brass bezel with minute and hour ticks, a turning gear, hands that tick backwards
 *  (a notch at a time with an overshoot) and ripples of time drawn inward */
function MKB_wellFloor(w, r) {
  const R0 = w.rad, x = w.x, y = w.y, t = game.time, B = MKB_TW.brass;
  r.decal(() => {
    const g = r.tgt, P0 = (a, d) => r.w(x + Math.cos(a) * d, y + Math.sin(a) * d, 0);
    r.groundDisc(x, y, R0, '#0c2034', .4); r.groundDisc(x, y, R0 * .64, '#1c4a6a', .16 + .06 * Math.sin(t * 1.3 + w.ph));
    r.groundRing(x, y, R0, B.hi, .9); r.groundRing(x, y, R0 - .9, B.base, .95); r.groundRing(x, y, R0 - 2, B.deep, .85);
    for (let i = 0; i < 60; i++) { const a = i / 60 * TAU + w.ph, big = i % 5 === 0, [x0, y0] = P0(a, R0 - 3), [x1, y1] = P0(a, R0 - (big ? 8.5 : 5)); px.line(g, x0, y0, x1, y1, big ? B.hi : B.sh, 1); if (big) { const [x2, y2] = P0(a + .012, R0 - 3.2); px.line(g, x2, y2, x1, y1, B.lt, 1); } }
    const Rg = R0 * .5, ga = t * .12 * w.spin;
    r.groundRing(x, y, Rg + .4, B.lt, .8); r.groundRing(x, y, Rg - 1.8, B.deep, .8);
    for (let i = 0; i < 16; i++) { const a = ga + i / 16 * TAU; r.groundArc(x, y, Rg, Rg + 2.8, a - .085, a + .085, i % 4 ? B.base : B.lt, .95); }
    for (let i = 0; i < 3; i++) { const a = -ga * 1.7 + i / 3 * TAU, [x0, y0] = P0(a, 4), [x1, y1] = P0(a, Rg - 2); px.line(g, x0, y0, x1, y1, B.sh, 1); }
    const u = (t * .42 + w.ph) % 1; r.groundRing(x, y, lerp(R0 - 7, 5, E.ease.inQuad(u)), '#bfeaff', .55 * Math.min(1, (1 - u) * u * 5));   // time drawn inward
    const tk = t * .9 + w.ph * 3, n = Math.floor(tk), fr = tk - n, step = TAU / 12;
    MKB_hand(r, g, x, y, -Math.PI / 2 - w.spin * tk * step / 12, R0 * .42, 2.2, B);
    MKB_hand(r, g, x, y, -Math.PI / 2 - w.spin * (n + E.ease.outBack(clamp(fr * 4, 0, 1))) * step * .5, R0 * .68, 1.5, B);
    r.groundDisc(x, y, 3.4, B.deep, 1); r.groundDisc(x, y, 2.4, B.base, 1); r.groundDisc(x - .6, y - .6, 1.1, B.hi, 1);
  }, { emissive: .5 });
}
/** the dome: a glassy fill, its silhouette (the contour of a flattened hemisphere, worked out for the current view),
 *  winking rings of stilled light, faint ribs and a bright band that climbs it. The half behind the well is queued
 *  at its far edge and the near half at its near edge, so monsters inside sort between the two */
function MKB_dome(w, r) {
  const v = r.view, fx = v.fx, fy = v.fy, R0 = w.rad, K = .58, Hd = R0 * K, t = game.time, band = (t * .22 + w.ph) % 1;
  // contour: points q of the unit sphere with q . (dx, dy, dz / K) = 0, scaled back to the flattened dome
  let d = [v.dx, v.dy, v.dz / K]; const dl = Math.hypot(...d); d = d.map(c => c / dl);
  let u = [-d[1], d[0], 0]; const ul = Math.hypot(u[0], u[1]) || 1; u = ul > 1e-3 ? [u[0] / ul, u[1] / ul, 0] : [1, 0, 0];
  let e = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]]; if (e[2] < 0) e = e.map(c => -c);
  const rim = [], N = 40; for (let i = 0; i <= N; i++) { const a = i / N * Math.PI, q = [Math.cos(a) * u[0] + Math.sin(a) * e[0], Math.cos(a) * u[1] + Math.sin(a) * e[1], Math.sin(a) * e[2]]; rim.push(r.w(w.x + q[0] * R0, w.y + q[1] * R0, Math.max(0, q[2]) * Hd)); }
  const base = []; for (let i = 0; i <= 24; i++) { const a = Math.atan2(u[1], u[0]) + Math.PI + i / 24 * Math.PI; base.push(r.w(w.x + Math.cos(a) * R0, w.y + Math.sin(a) * R0, 0)); }
  const half = back => g => {
    if (back) px.blend(g, .1, 'add', () => px.poly(g, rim.concat(base), '#4a90c8'));   // the glass
    px.blend(g, .42, 'add', () => {
      for (let k = 0; k < 5; k++) {
        const hot = k === 4, lat = hot ? band * Math.PI / 2 * .96 : (k + .5) / 4 * Math.PI / 2 * .9, rr = R0 * Math.cos(lat), z = Hd * Math.sin(lat), n = Math.max(14, Math.round(rr * (hot ? 1.2 : .5)));   // (sparse: every dot is an additive fill)
        if (hot && band > .92) continue;
        for (let i = 0; i < n; i++) {
          const a = i / n * TAU + t * .06 * (k % 2 ? 1 : -1) + w.ph, ca = Math.cos(a), sa = Math.sin(a);
          if ((ca * fx + sa * fy < 0) !== back || (!hot && E.hash2(i + k * 97, Math.floor(t * 4 + i * .37)) < .55)) continue;   // dots wink in and out
          const [sx, sy] = r.w(w.x + ca * rr, w.y + sa * rr, z); px.dot(g, sx, sy, hot ? MKB_TW.domeHi : MKB_TW.dome);
        }
      }
      for (let j = 0; j < 10; j++) {   // ribs, slowly turning
        const a = j / 10 * TAU + t * .05 + w.ph, ca = Math.cos(a), sa = Math.sin(a); if ((ca * fx + sa * fy < 0) !== back) continue;
        for (let s2 = 1; s2 < 9; s2++) if ((s2 + Math.floor(t * 5 + j)) % 4) { const lat = s2 / 9 * Math.PI / 2, [sx, sy] = r.w(w.x + ca * R0 * Math.cos(lat), w.y + sa * R0 * Math.cos(lat), Hd * Math.sin(lat)); px.dot(g, sx, sy, '#3a6a98'); }
      }
    });
    if (!back) px.blend(g, .5, 'add', () => { for (let i = 1; i < rim.length; i++) if ((i + Math.floor(t * 8)) % 7) px.line(g, rim[i - 1][0], rim[i - 1][1], rim[i][0], rim[i][1], i % 5 ? MKB_TW.dome : MKB_TW.domeHi); });   // the silhouette
  };
  r.queue(w.x - fx * R0 * .8, w.y - fy * R0 * .8, 0, half(true));   // (not emissive: the after-lighting pass would paint it over the monsters inside)
  r.queue(w.x + fx * R0 * .8, w.y + fy * R0 * .8, 0, half(false), { emissive: true });
}

/* =============================================================================
 * THE LIGHTLESS MAW (depth 11)
 * The braziers are dead and the ambient light is gone; the hero's own glow reaches a few steps. Iron lanterns stand
 * in the rooms (the snuffed braziers became lanterns too). Strike one and it flares into a big warm light that burns
 * down over half a minute. In the dark a monster is only a pair of eyes and shrugs off half of every blow; in lantern
 * light it is Exposed (the 'vuln' status) and takes half again as much. Light is the resource.
 * ============================================================================= */
const MKB_DK = { amb: .015, dark: .965, heroR: 54, heroI: .75, burn: 32, lit: .5, hide: .3, iron: E.tones('#3e3446'), flame: E.tones('#ff9a3a') };
def('mechanics', 'dark', { name: 'Darkness', title: 'The Lightless Maw', adj: 'Lightless', noun: 'Maw', color: '#ffb050', depth: 11, weight: 7,
  tip: 'Only eyes shine in the dark, and unseen monsters shrug off blows. Strike a lantern: in its light they are Exposed and take far more.',
  brief: 'Unseen foes resist; lanterns expose them.', lure: 'into lantern light', act: 'strike them while they are Exposed', zone: 'lantern light',
  icon(g, x, y, s) {
    const I = MKB_DK.iron, F = MKB_DK.flame, cx = x + 8 * s;
    px.rect(g, cx - .5 * s, y + s, s, 2 * s, I.lt); px.poly(g, [[cx - 4 * s, y + 5 * s], [cx + 4 * s, y + 5 * s], [cx + 2 * s, y + 3 * s], [cx - 2 * s, y + 3 * s]], I.base);
    px.rect(g, cx - 3.5 * s, y + 5 * s, 7 * s, 7 * s, F.base); px.rect(g, cx - 2.5 * s, y + 6 * s, 5 * s, 5 * s, F.lt);
    px.poly(g, [[cx, y + 6 * s], [cx + 1.6 * s, y + 10 * s], [cx - 1.6 * s, y + 10 * s]], '#fff4c0');
    for (const dx of [-3.5, 3.5]) px.rect(g, cx + dx * s - .5, y + 5 * s, 1, 7 * s, I.deep);
    px.poly(g, [[cx - 4 * s, y + 12 * s], [cx + 4 * s, y + 12 * s], [cx + 2.5 * s, y + 14 * s], [cx - 2.5 * s, y + 14 * s]], I.sh);
  },
  place(L0, R) {
    for (const b of L0.torches.splice(0)) {   // the snuffed braziers (one that stood on the exit's rune steps off it)
      let x = b.x, y = b.y; const e = L0.exit, d = e ? Math.hypot(x - e.x, y - e.y) : 99;
      if (d < 34) { const a = d > .5 ? Math.atan2(y - e.y, x - e.x) : R() * TAU; x = e.x + Math.cos(a) * 36; y = e.y + Math.sin(a) * 36; }
      if (!L0.map.walkable(Math.floor(x / T16), Math.floor(y / T16)) || L0.things.some(t => !t.dead && !t.mark && Math.hypot(t.x - x, t.y - y) < Math.min(t.r || 5, 30) + 6)) continue;
      addThing(L0, MKB_lantern(x, y, R, 0));
    }
    const n = Math.round(L0.rooms.length * 1.1);
    for (let i = 0; i < n; i++) { const p = MKB_spot(L0, R, { edge: 1, gap: 28 }); if (p) addThing(L0, MKB_lantern(p[0], p[1], R, 0)); }
    // one still burns beside the start rune: the first thing the hero sees is what light does
    for (let k = 0; k < 12; k++) { const a = R() * TAU, x = L0.start.x + Math.cos(a) * 42, y = L0.start.y + Math.sin(a) * 42; if (L0.map.walkable(Math.floor(x / T16), Math.floor(y / T16)) && L0.map.walkable(Math.floor((x + 6) / T16), Math.floor(y / T16))) { addThing(L0, MKB_lantern(x, y, R, .85)); break; } }
  },
  start(L0) {
    MKB_hook(); L0.MKB_lanterns = L0.things.filter(t => t.kind === 'MKB_lantern');
    const gp = game.gpu; L0.MKB_dkWas = L.darkness; L.ambient = MKB_DK.amb; L.darkness = MKB_DK.dark;
    if (gp && gp.ambient && !L0.MKB_gpuWas) { L0.MKB_gpuWas = gp.ambient.slice(); gp.ambient = gp.ambient.map(v => v * .1); }
    const h = ED.hero; if (h && !L0.MKB_hl) L0.MKB_hl = { h, r: h.lightR, i: h.lightI };   // his own glow shrinks while the dark runs (set every step)
    BUS.on('levelEnd', () => {
      L.darkness = L0.MKB_dkWas; if (gp && L0.MKB_gpuWas) { gp.ambient = L0.MKB_gpuWas; L0.MKB_gpuWas = null; }
      const s = L0.MKB_hl; if (s) { s.h.lightR = s.r; s.h.lightI = s.i; L0.MKB_hl = null; }
    }, 'level');
  },
  update(L0, dt) {
    const h = ED.hero; if (h) { h.lightR = MKB_DK.heroR; h.lightI = MKB_DK.heroI; }
    const Q = L0.MKB_wakeQ; if (Q && Q.length && game.time >= Q[0].at) MKB_flare(Q.shift().t, !Q.length);   // the arena's lanterns, one after another
    if (L0.MKB_dkF !== MKB.frame) {   // a new frame's lights are in: measure every monster once
      L0.MKB_dkF = MKB.frame;
      for (const m of ED.foes) if (m.alive) { const [a, b] = MKB_lightAt(m.x, m.y); m.MKB_lv = a; m.MKB_lx = b; }
    }
    for (const m of ED.foes) {
      if (!m.alive || m.spawnT > 0 || m.MKB_lv === undefined) continue;
      const v = m.MKB_lv, x = m.MKB_lx; let f = .05 + .95 * E.ease.inOut(clamp((v - .12) / .5, 0, 1));
      // a boss is too big for the dark to swallow once it is up: whole while it wakes and roars (its name card is up),
      // never under .6 after; and its waking lights the arena (asleep it is only a pair of eyes, which is the point)
      if (m.boss && !m.dormant) { f = Math.max(f, m.introT > 0 ? 1 : .6); if (!m.MKB_woke) { m.MKB_woke = 1; MKB_wake(L0, m); } }
      MKB_fade(m, f);
      if (x >= MKB_DK.lit) {
        if (!m.st.vuln) { P.glints(m.x, m.y, (m.z || 0) + (m.head || 20) * (m.scale || 1), 3, '#ffd36a', 8); }
        applyStatus(m, 'vuln', 0); MKB_taken(m, 1.2);
      } else if (v < MKB_DK.hide) MKB_taken(m, .5);
    }
  },
  draw(L0, r) {
    MKB.frame++;
    const h = ED.hero;   // find the hero's own glow (drawHero added it this frame at h.lightR): it shows him, it exposes nothing
    if (h) for (const q of L.list) if (q.x === h.x && q.y === h.y && q.r === MKB_DK.heroR) { q.MKB_hero = 1; break; }
    MKB_eyes(r);
    // a waking boss is lit by its own fury (its element's colour) until the lanterns round it have caught
    const B = ED.boss; if (B && B.alive && !B.dormant && B.MKB_woke && B.introT > 0) L.add(B.x, B.y, 26, 150, 1.2 * clamp(B.introT / .6, 0, 1), { color: EL(B.el || 'fire').light || '#ffb060' });
    // Exposed monsters stand in a broken ring of gold, so the player reads where the light pays
    for (const m of ED.foes) if (m.alive && m.st.vuln && m.MKB_lx >= MKB_DK.lit && r.visible(m.x, m.y, 0, 30, 30, 30)) { const a = -game.time * 2 + m.ph, rr = (m.r || 5) * (m.scale || 1) + 3; r.decal(() => { for (let i = 0; i < 3; i++) r.groundArc(m.x, m.y, rr, rr + 1.2, a + i * 2.1, a + i * 2.1 + 1.2, '#ffd36a', .75); }, { emissive: .6 }); }
  }
});
/** light at a ground point from the last frame's lights: [everything, everything but the hero's own glow] */
function MKB_lightAt(x, y) {
  let a = L.ambient, b = 0;
  for (const q of L.list) { const dx = q.x - x, dy = q.y - y, d2 = dx * dx + dy * dy, R2 = q.r * q.r; if (d2 >= R2) continue; const f = (1 - d2 / R2) * q.i; a += f; if (!q.MKB_hero) b += f; }
  return [a, b];
}
/** eyes in the dark: two glints where a hidden monster's head is, facing the camera side; they flare white-hot in a wind-up */
function MKB_eyes(r) {
  const v = r.view, t = game.time;
  for (const m of ED.foes) {
    const f = m.fade; if (!m.alive || m.spawnT > 0 || f === undefined || f > .75 || !r.visible(m.x, m.y, m.z, 30, 90, 30)) continue;
    const a = clamp((.8 - f) / .5, 0, 1), wind = !!(m.atk && m.atk.phase === 'wind') || (m.ai && (m.ai.state === 'wind' || m.ai.charge > 0));
    if (m.arch.body === 'wisp') { r.queue(m.x, m.y, m.z, g => { const [sx, sy] = r.w(m.x, m.y, m.z); px.glow(g, 1); r.glowDisc(g, sx, sy, 4 * (v.zoom || 1), EL(m.el === 'phys' ? 'void' : m.el).color, .3 * a); px.dot(g, sx, sy, '#ffffff'); }, { emissive: true, bias: .08 }); continue; }
    const face = m.blob ? Math.atan2(v.fy, v.fx) : m.facing, fx = Math.cos(face), fy = Math.sin(face);
    if (fx * v.fx + fy * v.fy < -.3 || (!wind && Math.sin(t * 1.3 + m.ph * 5) > .985)) continue;   // facing away, or a blink
    const sc = m.scale || 1, hd = m.rig ? m.rig.head() : [m.x, m.y, (m.z || 0) + (m.blob ? 6.8 * sc : (m.head || 20) * .75 * sc)];
    const col = wind ? '#fff4e0' : m.pal && m.pal.eyeGlow || (m.rig && m.rig.o.eyeGlow) || '#ff4a2a', halo = wind ? '#ff2a1a' : col, sx = -fy, sy = fx, fw = m.blob ? 5 * sc : 2.6 * sc, sp = (m.blob ? 2.2 : 1.7) * sc;
    r.queue(hd[0], hd[1], hd[2], g => {   // two short slits, a hair apart: a pair of eyes, never a single blob
      const zm = v.zoom || 1, [ax, ay] = r.w(hd[0] + fx * fw + sx * sp, hd[1] + fy * fw + sy * sp, hd[2] + .4), [bx, by] = r.w(hd[0] + fx * fw - sx * sp, hd[1] + fy * fw - sy * sp, hd[2] + .4);
      const ew = Math.max(1, Math.round(zm * (wind ? 2 : 1.5))), gap = Math.abs(ax - bx) < ew + 2 ? (ax < bx ? -1 : 1) * (ew + 2 - Math.abs(ax - bx)) / 2 : 0;
      px.glow(g, 1); if (wind) r.glowDisc(g, (ax + bx) / 2, (ay + by) / 2, 6 * zm, halo, .35); else { r.glowDisc(g, ax + gap, ay, 2.2 * zm, halo, .14 * a); r.glowDisc(g, bx - gap, by, 2.2 * zm, halo, .14 * a); }
      px.blend(g, clamp(a * 1.5, 0, 1), 'normal', () => { for (const [ex, ey] of [[ax + gap, ay], [bx - gap, by]]) { px.rect(g, Math.round(ex - ew / 2), Math.round(ey), ew, 1, col); if (wind) px.rect(g, Math.round(ex - ew / 2), Math.round(ey) - 1, ew, 1, halo); } });
    }, { emissive: true, bias: .08 });
  }
}
/** an iron lantern on a post: struck, it flares into a big warm light and burns down; struck again, it swings */
function MKB_lantern(x, y, R, fuel) {
  return { kind: 'MKB_lantern', x, y, r: 3.2, solid: true, hittable: true, fuel, flare: fuel ? .5 : 0, sw: 0, swv: 0, arm: R() * TAU, ph: R() * 9, mapColor: fuel ? '#ffc060' : '#5a4a40', hitT: 0,
    onHit(hit) {
      if (game.time - this.hitT < .15) return; this.hitT = game.time;
      const a = hit.ang !== undefined ? hit.ang : 0; this.swv += (Math.cos(a - this.arm) >= 0 ? 1 : -1) * 7;
      P.sparks(this.x + Math.cos(this.arm) * 6, this.y + Math.sin(this.arm) * 6, 24, 5, a, { color: '#ffd070' }); sfx('clang', { vol: .3, pitch: 1.3 + Math.random() * .2 });
      if (this.fuel < .85) { const cold = this.fuel <= 0; this.fuel = 1; this.flare = 1; MKB_ignite(this, cold); }
    },
    update(dt) {
      this.swv += (-38 * this.sw - 2.4 * this.swv) * dt; this.sw = clamp(this.sw + this.swv * dt, -1.1, 1.1); this.flare = Math.max(0, this.flare - dt * 1.4);
      if (this.fuel > 0) {
        this.fuel = Math.max(0, this.fuel - dt / MKB_DK.burn);
        if (this.fuel < .12 && Math.random() < dt * 3) P.add({ kind: 'ember', x: this.x + Math.cos(this.arm) * 6, y: this.y + Math.sin(this.arm) * 6, z: 24, vz: 14, max: .7, color: '#ff8a3a' });
        if (!this.fuel) { const hx = this.x + Math.cos(this.arm) * 6, hy = this.y + Math.sin(this.arm) * 6; P.smoke(hx, hy, 24, 3, { size: 2.5, color: '#4a4448', dark: '#2a2428', light: '#6a6468' }); if (ED.hero && Math.hypot(ED.hero.x - this.x, ED.hero.y - this.y) < 220) sfx(MKB_SND.gutter); }
      }
      this.mapColor = this.fuel > 0 ? '#ffc060' : '#5a4a40';
    },
    draw(r) { MKB_drawLantern(this, r); } };
}
/** a boss wakes in the dark: every lantern round its arena flares, nearest first, a beat apart, so the fight has light to
 *  be read by (and to Expose the boss in). Cold ones catch too. Outside an arena: the lanterns within 200 of it */
function MKB_wake(L0, m) {
  const ar = L0.rooms && L0.rooms[0] && L0.rooms[0].kind === 'arena' && L0.rooms[0].ir ? L0.rooms[0] : null;
  const cx = ar ? ar.ix * T16 : m.x, cy = ar ? ar.iy * T16 : m.y, R0 = ar ? ar.ir * T16 + 24 : 200, d = t => Math.hypot(t.x - m.x, t.y - m.y);
  const ls = (L0.MKB_lanterns || L0.things.filter(t => t.kind === 'MKB_lantern')).filter(t => !t.dead && Math.hypot(t.x - cx, t.y - cy) < R0).sort((a, b) => d(a) - d(b));
  L0.MKB_wakeQ = ls.map((t, i) => ({ t, at: game.time + .3 + i * .16 }));
}
/** one lantern of the cascade: a gentler catch than a struck one (no flash or shake per lantern), the last one chimes */
function MKB_flare(t, last) {
  if (t.fuel >= .85) return;
  t.fuel = 1; t.flare = 1; t.swv += (Math.random() < .5 ? -1 : 1) * 3;
  const hx = t.x + Math.cos(t.arm) * 6, hy = t.y + Math.sin(t.arm) * 6;
  P.fire(hx, hy, 22, 4, { size: 2.4, speed: 18 }); P.glints(hx, hy, 24, 4, '#fff0b0', 10); P.ring(t.x, t.y, 4, 30, '#ffd070', .4);
  sfx(MKB_SND.ignite, { vol: .6, pitch: .9 + Math.random() * .3 }); if (last) sfx('chime', { vol: .2, pitch: .7 });
}
function MKB_ignite(t, cold) {
  const hx = t.x + Math.cos(t.arm) * 6, hy = t.y + Math.sin(t.arm) * 6;
  P.fire(hx, hy, 22, cold ? 7 : 3, { size: 2.6, speed: 20 }); P.glints(hx, hy, 24, 6, '#fff0b0', 10); P.ring(t.x, t.y, 4, cold ? 46 : 26, '#ffd070', .5);
  sfx(MKB_SND.ignite); if (cold) { sfx('chime', { vol: .22, pitch: .8 }); shake(1.5); game.flash('#ffb050', .08, .18); }
}
function MKB_drawLantern(t, r) {
  const x = t.x, y = t.y, f = t.fuel, lit = f > 0, T = game.time, ax = Math.cos(t.arm), ay = Math.sin(t.arm), hx = x + ax * 6, hy = y + ay * 6;
  const fl = lit ? flicker(T * 1.1 + t.ph) * (f < .12 && Math.sin(T * 31 + t.ph) > .2 ? .45 : 1) : 0;
  if (lit) L.add(hx, hy, 22, 44 + 96 * Math.sqrt(f) + 24 * t.flare, (.55 + .85 * f + .6 * t.flare) * fl, { color: '#ffb060', shadow: true });
  if (!r.visible(x, y, 0, 40, 80, 30)) return;
  const I = MKB_DK.iron, F = MKB_DK.flame;
  r.queue(x, y, 0, g => {
    const zm = r.view.zoom || 1;
    r.box(g, x - 2.4, y - 2.4, 0, x + 2.4, y + 2.4, 2.5, '#5c5462', '#3c3444');   // the stone foot
    const [bx, by] = r.w(x, y, 2.5), [tx, ty] = r.w(x, y, 31), [ex, ey] = r.w(hx, hy, 31), [mx, my] = r.w(x + ax * 2.5, y + ay * 2.5, 26);
    px.line(g, bx, by, tx, ty, I.deep, Math.max(2, Math.round(2 * zm))); px.line(g, bx + 1, by, tx + 1, ty, I.base);   // the post, lit on one edge
    px.line(g, tx, ty, ex, ey, I.deep, Math.max(1, Math.round(1.5 * zm))); px.line(g, mx, my, (tx + ex) / 2, (ty + ey) / 2, I.sh);   // the arm and its brace
    px.disc(g, tx, ty - zm, 1.4 * zm, I.lt); px.dot(g, tx, ty - 2 * zm, I.hi);
    // the lantern hangs from the arm's tip and swings when struck (tilting the way the arm points on screen)
    const sw = t.sw, [cx, cy] = r.w(hx + ax * Math.sin(sw) * 3, hy + ay * Math.sin(sw) * 3, 31 - 3 * Math.cos(sw)), dirx = r.w(x + ax, y + ay, 0)[0] - r.w(x, y, 0)[0];
    px.line(g, ex, ey, cx, cy, I.sh);
    const tl = -sw * clamp(dirx, -1, 1) * .8, c = Math.cos(tl), s = Math.sin(tl), k = zm * 1.3, Q = (lx, ly) => [cx + (lx * c - ly * s) * k, cy + (lx * s + ly * c) * k];
    px.poly(g, [Q(-3.2, 3), Q(3.2, 3), Q(1.7, .8), Q(-1.7, .8)], I.base); px.line(g, ...Q(-1.6, 1), ...Q(1.6, 1), I.lt);   // cap
    px.poly(g, [Q(-2.7, 3), Q(2.7, 3), Q(2.7, 9.4), Q(-2.7, 9.4)], lit ? F.base : '#23202e');                                 // glass
    if (lit) {
      px.poly(g, [Q(-1.9, 3.6), Q(1.9, 3.6), Q(1.9, 8.8), Q(-1.9, 8.8)], F.lt);
      const hgt = (2.8 + 1.4 * f) * fl, sway = Math.sin(T * 9 + t.ph) * .5 - sw * .8;
      px.poly(g, [Q(-1.3, 8.2), Q(sway, 8.2 - hgt - 1.4), Q(1.3, 8.2)], '#ff8a2a'); px.poly(g, [Q(-.6, 8.3), Q(sway * .6, 8.2 - hgt * .7), Q(.6, 8.3)], '#fff4c0');
      px.glow(g, 1); r.glowDisc(g, ...Q(0, 6), (6 + 5 * f + 4 * t.flare) * zm, '#ffb050', .3 * fl);
    } else { px.dot(g, ...Q(-1.4, 4.6), '#6a6888'); px.dot(g, ...Q(-1.4, 5.6), '#4a4866'); }
    for (const bx2 of [-2.7, 2.7]) px.line(g, ...Q(bx2, 3), ...Q(bx2, 9.4), I.deep);
    if (!lit) px.line(g, ...Q(0, 3), ...Q(0, 9.4), I.deep);
    px.poly(g, [Q(-3.2, 9.4), Q(3.2, 9.4), Q(2, 11), Q(-2, 11)], I.sh); px.dot(g, ...Q(0, 12), I.base);
  }, { emissive: lit });
  if (!lit) r.queue(hx, hy, 24, g => {   // a cold lantern keeps an ember: its cage shows faintly around it, so it never reads as eyes
    const zm = r.view.zoom || 1, [cx, cy] = r.w(hx, hy, 28), p0 = .5 + .5 * Math.sin(T * 2.2 + t.ph), Q = (lx, ly) => [cx + lx * zm * 1.3, cy + ly * zm * 1.3];
    px.glow(g, 1); px.blend(g, .55, 'normal', () => { for (const [a0, b0] of [[[-3.2, 3], [3.2, 3]], [[-2.7, 3], [-2.7, 9.4]], [[2.7, 3], [2.7, 9.4]], [[-3.2, 9.4], [3.2, 9.4]], [[-1.7, .8], [1.7, .8]]]) px.line(g, ...Q(...a0), ...Q(...b0), '#6a3418'); });
    const [ex, ey] = Q(0, 7.6); r.glowDisc(g, ex, ey, 2.4 * zm, '#ff6a10', .1 + .1 * p0); px.rect(g, Math.round(ex) - (zm > 1.3 ? 1 : 0), Math.round(ey), zm > 1.3 ? 2 : 1, 1, p0 > .5 ? '#ffb040' : '#e0601a');
  }, { emissive: true, bias: .01 });
}

/* =============================================================================
 * THE CRIMSON RUSH (depth 12)
 * A kill-streak meter: kills within 2.5 s chain. The streak stacks move speed and attack speed and multiplies the
 * experience of every kill (up to 3x at 51). Blood altars refill the timer and burst in a crimson nova; kills near an
 * altar that is still refilling feed it. The counter is drawn big in the HUD and shakes on every kill.
 * ============================================================================= */
const MKB_BR = { win: 2.5, cap: 3, per: .04, stacks: 30, mv: 1, as: 1.5, cd: 14, feed: 110, touch: 17 };
def('mechanics', 'bloodrush', { name: 'Blood Rush', title: 'The Crimson Rush', adj: 'Crimson', noun: 'Killing Floors', color: '#ff3a4a', depth: 12, weight: 8,
  tip: 'Kills within 2.5 seconds chain into a streak: faster steps, faster blows, up to triple experience. Blood altars refill the timer and burst.',
  brief: 'Fast kills chain a streak: speed and 3x XP.', act: 'keep the streak alive',
  icon(g, x, y, s) {
    const cx = x + 8 * s;
    px.poly(g, [[cx, y + 1.5 * s], [cx + 5 * s, y + 9 * s], [cx + 4 * s, y + 12.5 * s], [cx, y + 14.5 * s], [cx - 4 * s, y + 12.5 * s], [cx - 5 * s, y + 9 * s]], '#6a0612');
    px.poly(g, [[cx, y + 3 * s], [cx + 4 * s, y + 9.4 * s], [cx + 3.2 * s, y + 12 * s], [cx, y + 13.4 * s], [cx - 3.2 * s, y + 12 * s], [cx - 4 * s, y + 9.4 * s]], '#d81c2c');
    px.disc(g, cx - 1.4 * s, y + 10 * s, 1.3 * s, '#ff8a8a'); px.dot(g, cx - 1.8 * s, y + 9.4 * s, '#ffffff');
    for (let i = 0; i < 3; i++) px.line(g, x + (1 + i * 2) * s, y + (6 - i) * s, x + (2.5 + i * 2) * s, y + (3.5 - i) * s, '#ffd36a');
  },
  place(L0, R) {
    const n = clamp(Math.round(L0.rooms.length * .35), 2, 5);
    for (let i = 0; i < n; i++) {
      const p = MKB_spot(L0, R, { edge: 2, gap: 30, r: 12, minStart: 70 }); if (!p) continue;
      addThing(L0, MKB_altar(p[0], p[1], R));
      for (const [d, name, o] of [[15, 'candle', { size: .8 }], [16, 'candle', { size: .7 }], [19, R.pick(['skull', 'bones']), {}]]) {   // candles and bones at its foot
        const a = R() * TAU, x = p[0] + Math.cos(a) * d, y = p[1] + Math.sin(a) * d; if (L0.map.walkable(Math.floor(x / T16), Math.floor(y / T16))) L0.props.push({ name, x, y, o });
      }
    }
  },
  start(L0) {
    MKB_hook();
    L0.MKB_rush = L0.MKB_rush || { n: 0, t: 0, mul: 1, xp: 0, best: 0, shake: 0, pop: 0, endT: 0, last: 0, lastXp: 0 };
    L0.MKB_altars = L0.things.filter(t => t.kind === 'MKB_altar');
    BUS.on('kill', e => MKB_rushKill(L0, e), 'level');
    BUS.on('draw', e => { if (e.L === L0) MKB_rushHud(e.r, L0); }, 'level');
    BUS.on('heroDie', () => { if (L0.MKB_rush.n) MKB_rushEnd(L0, ED.hero); }, 'level');
  },
  update(L0, dt) {
    const S = L0.MKB_rush, h = ED.hero; if (!S) return;
    S.shake = Math.max(0, S.shake - dt * 3.5); S.pop = Math.max(0, S.pop - dt); S.endT = Math.max(0, S.endT - dt);
    if (S.t > 0) {
      S.t -= dt;
      const b = h && h.buffs.find(q => q.id === 'MKB_rush'); if (b) b.t = Math.max(.05, S.t);
      if (S.t <= 0) { S.t = 0; MKB_rushEnd(L0, h); }
    }
    if (h && h.alive && S.t > 0) for (const a of L0.MKB_altars) if (a.charge >= 1 && Math.hypot(h.x - a.x, h.y - a.y) < MKB_BR.touch) MKB_altarFire(a, L0);
  }
});
function MKB_rushKill(L0, e) {
  const m = e.tgt, h = ED.hero, S = L0.MKB_rush; if (!m || m.team !== 'foe' || !h || !h.alive || ED.L !== L0) return;
  S.n++; S.t = MKB_BR.win; S.shake = 1; S.pop = .09; S.best = Math.max(S.best, S.n);
  S.mul = Math.min(MKB_BR.cap, 1 + (S.n - 1) * MKB_BR.per);
  const extra = (m.xp || 0) * (S.mul - 1); if (extra > 0) { gainXp(h, extra); S.xp += extra * (1 + (h.stats.xpGain || 0) / 100) * DIFF.xp; }
  MKB_rushBuff(h, S);
  FX.scorch(m.x + (Math.random() - .5) * 4, m.y + (Math.random() - .5) * 4, 4 + Math.random() * 4, '#4a0610', 6);   // blood on the floor
  P.bits(m.x, m.y, 8, 4, ['#a8141e', '#e0303a', '#5a0610']);
  if (game.time - MKB.rushT > .05) { MKB.rushT = game.time; const k = Math.pow(2, Math.min(24, S.n) / 12); sfx(Object.assign({}, MKB_SND.rush, { freq: 330 * k, to: 500 * k })); }
  if ([10, 25, 50, 100, 200, 500].includes(S.n)) { notify('BLOOD RUSH  x' + S.n + (S.n >= 51 ? '  •  TRIPLE EXPERIENCE' : ''), '#ff5a6a', 2.5); sfx('powerup', { vol: .4, pitch: 1.2 }); game.flash('#ff2a3a', .1, .25); P.ring(h.x, h.y, 4, 44, '#ff3a4a', .45); }
  for (const a of L0.MKB_altars || []) if (a.charge < 1 && Math.hypot(a.x - m.x, a.y - m.y) < MKB_BR.feed) { a.charge = Math.min(1, a.charge + .12); MKB_mote(m, a); }   // kills feed the altars
}
/** the streak's buff: one entry in h.buffs, its stacks re-summed only when they change */
function MKB_rushBuff(h, S) {
  const st = Math.min(MKB_BR.stacks, S.n), mv = Math.round(st * MKB_BR.mv), as = Math.round(st * MKB_BR.as);
  let b = h.buffs.find(q => q.id === 'MKB_rush');
  if (!b) { b = { id: 'MKB_rush', name: 'Blood Rush', color: '#ff3a4a', t: S.t, stats: {} }; h.buffs.push(b); }
  b.t = Math.max(.05, S.t);
  if (b.stats.moveSpeed !== mv || b.stats.atkSpeed !== as) { b.stats = { moveSpeed: mv, atkSpeed: as }; computeStats(h); }
}
function MKB_rushEnd(L0, h) {
  const S = L0.MKB_rush; if (!S) return;
  if (S.n >= 3) { S.endT = 2.6; S.last = S.n; S.lastXp = S.xp; if (S.n >= 10) sfx('cancel', { vol: .35, pitch: .6 }); }
  S.n = 0; S.xp = 0; S.mul = 1; S.t = 0;
  if (h) { const i = h.buffs.findIndex(q => q.id === 'MKB_rush'); if (i >= 0) { h.buffs.splice(i, 1); computeStats(h); } }
}
/** a blood mote lobbed from a kill into an altar */
function MKB_mote(m, a) {
  for (let k = 0; k < 3; k++) { const T = Math.hypot(a.x - m.x, a.y - m.y) / 150 + k * .05, g = 260; P.add({ kind: 'ember', x: m.x, y: m.y, z: 8, vx: (a.x - m.x) / T, vy: (a.y - m.y) / T, vz: g * T / 2 + 1, g, max: T, color: k ? '#c81020' : '#ff4a5a' }); }
}
function MKB_altar(x, y, R) {
  const pool = []; for (let i = 0; i < 7; i++) { const a = R() * TAU, d = 6 + R() * 12; pool.push([Math.cos(a) * d, Math.sin(a) * d, 2.5 + R() * 5]); }   // blood splashed around it
  return { kind: 'MKB_altar', x, y, r: 7, solid: true, pool, hittable: true, charge: 1, pulse: 0, ph: R() * 9, mapColor: '#ff3a4a', hitT: 0,
    onHit(hit) { if (game.time - this.hitT < .2) return; this.hitT = game.time; if (this.charge >= 1 && ED.L) MKB_altarFire(this, ED.L); else { P.sparks(this.x, this.y, 8, 4, hit.ang, { color: '#ff6a6a' }); sfx('clang', { vol: .22, pitch: .7 }); } },
    update(dt) {
      this.pulse = Math.max(0, this.pulse - dt * 1.6);
      if (this.charge < 1) { this.charge = Math.min(1, this.charge + dt / MKB_BR.cd); if (this.charge >= 1) { P.glints(this.x, this.y, 10, 8, '#ff8a8a', 12); P.ring(this.x, this.y, 3, 18, '#ff3a4a', .35); sfx('chime', { vol: .18, pitch: .6 }); } }
      else if (Math.random() < dt * 4) P.add({ kind: 'ember', x: this.x + (Math.random() - .5) * 5, y: this.y + (Math.random() - .5) * 4, z: 9, vz: 10 + Math.random() * 10, max: .8, color: '#ff2a3a' });
      this.mapColor = this.charge >= 1 ? '#ff3a4a' : '#6a2030';
    },
    draw(r) { MKB_drawAltar(this, r); } };
}
function MKB_altarFire(a, L0) {
  const h = ED.hero, S = L0.MKB_rush; a.charge = 0; a.pulse = 1;
  if (S) { S.t = MKB_BR.win; S.shake = 1.4; S.pop = .14; if (h && S.n > 0) MKB_rushBuff(h, S); }
  FX.nova({ team: 'hero', src: h, x: a.x, y: a.y, r0: 8, r1: 84, dur: .45, el: 'phys', color: '#ff2a3a', tags: ['aoe'], hit: { amount: MKB_hit(2.4), kb: 200, up: 80, status: 'bleed', statusChance: 1, statusPower: MKB_hit(.5) } });
  P.ring(a.x, a.y, 6, 64, '#ff6a7a', .5); FX.scorch(a.x, a.y, 30, '#3a0610', 7);
  for (let i = 0; i < 28; i++) { const an = Math.random() * TAU, sp = 20 + Math.random() * 70; P.add({ kind: 'bit', x: a.x, y: a.y, z: 9, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, vz: 120 + Math.random() * 140, g: 420, bounce: .2, max: .9 + Math.random() * .5, size: Math.random() < .4 ? 2 : 1, color: ['#e0202e', '#a8101c', '#ff6a6a'][i % 3] }); }
  game.flash('#ff1a2a', .12, .35); shake(5); game.freeze(.06); sfx('boom', { vol: .45, pitch: .8 }); sfx('roar', { vol: .18, pitch: 1.7 });
}
function MKB_drawAltar(a, r) {
  const x = a.x, y = a.y, ch = a.charge, rdy = ch >= 1, t = game.time, pu = a.pulse, v = r.view;
  L.add(x, y, 12, 34 + 44 * ch + 60 * pu, (rdy ? .8 + .15 * Math.sin(t * 4 + a.ph) : .3) + pu, { color: '#ff3040' });
  if (!r.visible(x, y, 0, 50, 90, 50)) return;
  r.decal(() => {   // blood pooled and splashed on the stones, a turning ring of runes
    for (const [dx, dy, rr] of a.pool) { r.groundDisc(x + dx, y + dy, rr, '#3a0610', .7); r.groundDisc(x + dx - .6, y + dy - .5, rr * .6, '#6a0a16', .6); }
    r.groundDisc(x, y, 12, '#4a0810', .55);
    r.groundRing(x, y, 19, '#8a1020', .65); r.groundRing(x, y, 16.8, '#4a0810', .6);
    for (let i = 0; i < 10; i++) { const an = i / 10 * TAU + t * .15; r.groundArc(x, y, 17.2, 18.6, an, an + .26, rdy ? '#ff3040' : '#6a1018', .85); }
    if (rdy || pu > 0) r.groundDisc(x, y, 19, '#ff2030', .08 + .05 * Math.sin(t * 4) + .3 * pu);
  }, { emissive: rdy ? .5 : .1 });
  r.queue(x, y, 0, g => {
    const zm = v.zoom || 1;
    r.box(g, x - 7.5, y - 6.5, 0, x + 7.5, y + 6.5, 2.5, '#4a3c46', '#2e2430');       // plinth
    r.box(g, x - 5.6, y - 4.6, 2.5, x + 5.6, y + 4.6, 11, '#6e5e66', '#4a3c46');     // the altar stone
    r.box(g, x - 6.4, y - 5.4, 11, x + 6.4, y + 5.4, 12.6, '#8a7880', '#5a4a54');    // its slab
    // the carved skull on the face toward the camera, eyes lit while it is charged; blood runs down under it
    const f = [x + v.fx * 5.7, y + v.fy * 4.7], [sx, sy] = r.w(f[0], f[1], 7.2);
    px.disc(g, sx, sy, 2.3 * zm, '#2a1c22'); px.disc(g, sx, sy - .4 * zm, 1.9 * zm, '#d8ccb0'); px.rect(g, sx - 1.2 * zm, sy + .9 * zm, 2.4 * zm, 1.3 * zm, '#c8bca0');
    for (const e of [-1, 1]) px.rect(g, Math.round(sx + e * .9 * zm - .5), Math.round(sy - .6 * zm), Math.max(1, Math.round(zm * .9)), Math.max(1, Math.round(zm * .9)), rdy ? '#ff3040' : '#2a1418');
    if (rdy) for (const [ox, len] of [[-3.2, 4 + 2 * Math.sin(t + a.ph)], [2.6, 3 + 2 * Math.sin(t * 1.3 + a.ph)]]) { const [dx0, dy0] = r.w(f[0] - v.fy * ox, f[1] + v.fx * ox, 11), [dx1, dy1] = r.w(f[0] - v.fy * ox, f[1] + v.fx * ox, 11 - len); px.line(g, dx0, dy0, dx1, dy1, '#a8101c'); px.dot(g, dx1, dy1 + 1, '#ff4a5a'); }
    for (const s of [-1, 1]) {   // two curling bone horns rise from the back of the slab
      const pts = [[x + s * 4.4, y - 3.2, 12.6], [x + s * 7.4, y - 4, 16], [x + s * 8, y - 4.4, 21], [x + s * 6.4, y - 4.2, 25.5], [x + s * 4.4, y - 3.6, 27]].map(p => r.w(p[0], p[1], p[2]));
      for (let i = 1; i < pts.length; i++) { const w = Math.max(1, Math.round((3.2 - i * .6) * zm)); px.line(g, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], '#5a4c40', w + 1); px.line(g, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], i < 3 ? '#d8ccb0' : '#f0e6d0', w); }
      px.dot(g, pts[4][0], pts[4][1], '#fff8ec');
    }
    px.poly(g, r.groundPts(x, y, 4.4, 14, 12.65), '#1e1418');   // the basin, and the blood in it (it refills)
    px.poly(g, r.groundPts(x, y, 3.7 * (.3 + .7 * ch), 14, 12.7), rdy ? '#d81c2c' : '#5a0a14');
    if (rdy) { const [bx, by] = r.w(x - 1.2, y - .9, 12.8); px.rect(g, bx, by, 2, 1, '#ff9a9a'); }
  });
  if (rdy || pu > 0) r.queue(x, y, 12.8, g => { const [bx, by] = r.w(x, y, 12.8), zm = v.zoom || 1; px.glow(g, 1); r.glowDisc(g, bx, by, (6 + 1.5 * Math.sin(t * 5 + a.ph) + 12 * pu) * zm, '#ff2030', .2 + .3 * pu); }, { emissive: true, bias: .02 });
}
/** the streak counter: a big crimson number that shakes on every kill, the timer draining under it, the rewards */
function MKB_rushHud(r, L0) {
  const S = L0.MKB_rush; if (!S || (S.n < 1 && S.t <= 0 && S.endT <= 0) || UI.hideHud) return;
  r.overlay(g => { const f = HUD_in(g, r); try {
    const x = f.W - 8, y = 64 + HUD_under(), sh = S.shake * S.shake, jx = Math.round((Math.random() * 2 - 1) * sh * 3), jy = Math.round((Math.random() * 2 - 1) * sh * 2);
    if (S.n >= 1 || S.t > 0) {
      const sc = (S.n >= 50 ? 4 : 3) + (S.pop > 0 ? 1 : 0), hot = S.pop > 0, cols = hot ? ['#ffffff', '#ffffff', '#ffd0d0', '#ff6a7a'] : S.mul >= MKB_BR.cap ? ['#fff6d0', '#ffd36a', '#ff5a2a', '#8a1010'] : ['#fff0f0', '#ff8a8a', '#e0202e', '#7a0614'];
      E.font.text(g, 'KILL STREAK', x, y, '#ff8a8a', { align: 'right', font: 'tiny', outline: '#1a0008' });
      const tw = E.font.title(g, String(S.n), x + jx, y + 8 + jy - (hot ? 3 : 0), { scale: sc, colors: cols, depth: 2, depthColor: '#2a0008', outline: '#12000a', align: 'right' });
      E.font.title(g, 'x', x + jx - tw.w - 2, y + 8 + jy + 7 * sc - 14, { scale: 2, colors: ['#ffc0c0', '#e0202e'], depth: 1, depthColor: '#2a0008', outline: '#12000a', align: 'right' });
      const bw = 62, by = y + 12 + 7 * (S.n >= 50 ? 4 : 3), u = clamp(S.t / MKB_BR.win, 0, 1), warn = u < .3 && Math.floor(game.real * 10) % 2;
      px.rect(g, x - bw, by, bw, 5, '#12000a'); px.rect(g, x - bw + 1, by + 1, bw - 2, 3, '#3a0610');
      px.rect(g, x - bw + 1, by + 1, Math.round((bw - 2) * u), 3, warn ? '#ffffff' : '#e0202e'); px.rect(g, x - bw + 1, by + 1, Math.round((bw - 2) * u), 1, warn ? '#ffffff' : '#ff8a8a');
      const st = Math.min(MKB_BR.stacks, S.n);
      E.font.text(g, 'XP x' + S.mul.toFixed(2).replace(/0$/, ''), x, by + 8, S.mul >= MKB_BR.cap ? '#ffd36a' : '#ffc0a0', { align: 'right', outline: '#1a0008' });
      if (st) E.font.text(g, '+' + Math.round(st * MKB_BR.mv) + '% SPEED  +' + Math.round(st * MKB_BR.as) + '% ATTACK', x, by + 18, '#e8a0a8', { align: 'right', font: 'tiny', outline: '#1a0008' });
    } else if (S.endT > 0) {
      const a = clamp(S.endT / .6, 0, 1);
      px.blend(g, a, 'normal', () => {
        E.font.text(g, 'STREAK ENDED', x, y, '#c88a90', { align: 'right', font: 'tiny', outline: '#1a0008' });
        E.font.title(g, 'x' + S.last, x, y + 8, { scale: 2, colors: ['#e8c8c8', '#a84050'], depth: 1, depthColor: '#2a0008', outline: '#12000a', align: 'right' });
        if (S.lastXp >= 1) E.font.text(g, '+' + fmt(S.lastXp) + ' BONUS XP', x, y + 26, '#ffd36a', { align: 'right', outline: '#1a0008' });
      });
    }
  } finally { HUD_out(g); } });
}

/* =============================================================================
 * THE LEAPING SPIRES (depth 13)
 * Rune pads in linked pairs (each pair its own color). Step on one and it throws the hero in a high arc to its
 * partner: a coil, a pirouette with the blade out at the top of the arc, the sword raised and driven down into a
 * slam that bursts around the landing. Monsters that wander onto a pad are thrown too and crash-land, hurting
 * everything they hit. One chain of pairs runs from the start to the exit's room: the speedrunner's route.
 * ============================================================================= */
const MKB_LP = { cols: ['#6affd0', '#ffb04a', '#c890ff', '#6ab8ff', '#ff6a9a', '#d8ff6a'], r: 9, max: 660 };
/** the flight between two pads: distance, time in the air, apex height */
const MKB_arc = (p, q) => { const D = Math.hypot(q.x - p.x, q.y - p.y); return { D, T: clamp(.5 + D / 400, .75, 1.7), H: clamp(26 + D * .12, 44, 72) }; };   // (the core camera looks at z 8, so the apex stays on screen)
def('mechanics', 'launch', { name: 'Launch Runes', title: 'The Leaping Spires', adj: 'Leaping', noun: 'Spires', color: '#6affd0', depth: 13, weight: 7,
  tip: 'Stand on a rune pad to be thrown to its twin; the landing slams everything around it. Monsters that wander onto one crash down. The pads chain toward the exit.',
  brief: 'Pads throw you to a twin; landings slam.', lure: 'to a landing pad', act: 'slam down on them from a pad',
  icon(g, x, y, s) {
    px.ell(g, x + 5 * s, y + 13 * s, 4 * s, 1.8 * s, '#1a5a4a'); px.ell(g, x + 5 * s, y + 13 * s, 3 * s, 1.1 * s, '#6affd0');
    px.ell(g, x + 12.5 * s, y + 13.5 * s, 3 * s, 1.4 * s, '#1a5a4a'); px.ell(g, x + 12.5 * s, y + 13.5 * s, 2 * s, .8 * s, '#6affd0');
    let q = null; for (let i = 0; i <= 8; i++) { const u = i / 8, p = [x + (5 + 7.5 * u) * s, y + (12 - 11 * 4 * u * (1 - u)) * s]; if (q) px.line(g, q[0], q[1], p[0], p[1], i % 2 ? '#bffff0' : '#6affd0'); q = p; }
    px.poly(g, [[x + 12.5 * s, y + 12 * s], [x + 10.5 * s, y + 8.6 * s], [x + 14 * s, y + 9.4 * s]], '#ffffff');
  },
  place(L0, R) {
    MKB_padPairs(L0, R).forEach(([a, b], i) => {
      const col = MKB_LP.cols[i % MKB_LP.cols.length], A = MKB_pad(a, col, R), B = MKB_pad(b, col, R); A.to = B; B.to = A; addThing(L0, A); addThing(L0, B);
    });
  },
  start(L0) { MKB_hook(); L0.MKB_pads = L0.things.filter(t => t.kind === 'MKB_pad'); L0.MKB_fly = L0.MKB_fly || []; },
  update(L0, dt) {
    const h = ED.hero, pads = L0.MKB_pads; if (!pads || !h) return;
    for (const p of pads) {
      p.flash = Math.max(0, p.flash - dt * 2.2);
      const d = Math.hypot(h.x - p.x, h.y - p.y), flying = h.act && h.act.name === 'MKB_launch';
      if (p.hold && d > p.r + 5 && !flying) p.hold = false;   // re-armed once he has stepped off (never mid-flight)
      // it catches him when he stands on it (a beat, or a stop): walking straight over a pad on the way somewhere
      // else never throws him back where he came from, so the pads can be ignored
      const on = !p.hold && d < p.r - 2.5 && h.alive && !h.dead && (h.z || 0) < 1 && h.dodgeT <= 0 && !(h.act && h.act.cancel === false);
      p.dwell = on ? (p.dwell || 0) + dt : 0;
      if (on && (p.dwell >= .2 || (p.dwell >= .06 && Math.hypot(h.vx, h.vy) < 25))) { p.dwell = 0; MKB_launchHero(h, p); }
      GRID.each(p.x, p.y, p.r - 4, m => { if (!m.boss && !m.canFly && !m.air && (m.z || 0) < 1 && !(m.spawnT > 0) && !((m.MKB_lt || 0) > game.time) && !m.fallT) MKB_launchFoe(m, p, L0); });
    }
    // thrown monsters: the crash when they come down
    for (let i = L0.MKB_fly.length - 1; i >= 0; i--) {
      const f = L0.MKB_fly[i], m = f.m; f.t += dt;
      if (!m.alive) { L0.MKB_fly.splice(i, 1); continue; }
      if (f.t > .12 && (m.z || 0) <= .01) { L0.MKB_fly.splice(i, 1); MKB_crash(m, f); }
    }
  },
  draw(L0, r) {
    for (const p of L0.MKB_pads || []) MKB_drawPad(p, r);
    const h = ED.hero; if (!h || !h.alive || (h.act && h.act.name === 'MKB_launch')) return;
    for (const p of L0.MKB_pads || []) { const d = Math.hypot(h.x - p.x, h.y - p.y); if (d < 90 && !p.hold) MKB_arcPreview(p, r, clamp((90 - d) / 40, 0, 1)); }
  }
});
/** pairs of pad spots: a chain start room -> middle of the level -> the exit's room, then a couple of long loops */
function MKB_padPairs(L0, R) {
  const w = L0.w, d = MKB_bfs(L0, L0.start.x, L0.start.y), at = r0 => { let best = -1; for (let y = r0.y; y < r0.y + r0.h; y++) for (let x = r0.x; x < r0.x + r0.w; x++) { const v = d[y * w + x]; if (v >= 0) { best = v; break; } } return best; };
  const rooms = L0.rooms.map(r0 => ({ r0, d: at(r0) })).filter(q => q.d >= 0).sort((a, b) => a.d - b.d);
  if (rooms.length < 2) return [];
  const used = [], pairs = [], ex = L0.exit, inRoom = (r0, p) => p[0] >= r0.x * T16 && p[0] < (r0.x + r0.w) * T16 && p[1] >= r0.y * T16 && p[1] < (r0.y + r0.h) * T16;
  // a free spot in a room (near: of a dozen, the one nearest that point: the route's pads sit where the runner already is)
  // (route pads may stand a cell from a wall and just off the start rune: the islands' rooms are small)
  const spot = (r0, near) => { let best = null, bd = 1e9; for (let k = 0; k < (near ? 14 : 10); k++) { const p = MKB_spot(L0, R, { room: r0, edge: near || k > 5 ? 1 : 2, gap: 14, r: 9, minStart: near ? 46 : 60, minExit: 42 }); if (!p || used.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 40)) continue; if (!near) return p; const d = Math.hypot(p[0] - near[0], p[1] - near[1]); if (d < bd) { bd = d; best = p; } } return best; };
  const add = (ra, rb, na, nb) => { if (!ra || !rb || ra === rb) return false; const a = spot(ra, na); if (!a) return false; used.push(a); const b = spot(rb, nb); const D = b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : 0; if (!b || D < 96 || D > MKB_LP.max) { used.pop(); return false; } used.push(b); pairs.push([a, b]); return true; };
  const eq = ex && rooms.find(q => inRoom(q.r0, [ex.x, ex.y])), exitRoom = (eq || rooms[rooms.length - 1]).r0, n = rooms.length;
  const mid = rooms[Math.max(1, Math.floor(n / 2))].r0, first = rooms[0].r0, st = [L0.start.x, L0.start.y];
  // the route: a pad by the start rune, its twin in the middle of the level; the next pad a few steps from where that
  // one lands, its twin as near the exit as the room allows
  if (!add(first, mid, st)) add(rooms[Math.min(1, n - 1)].r0, mid, st);
  const land = pairs.length ? pairs[pairs.length - 1][1] : null, to = ex ? [ex.x, ex.y] : null;
  if (!add(mid, exitRoom, land, to)) add(rooms[Math.min(n - 1, Math.floor(n / 2) + 1)].r0, exitRoom, land, to);
  for (let k = 0; k < 14 && pairs.length < clamp(Math.round(n / 3), 2, 5); k++) { const a = R.pick(rooms), b = R.pick(rooms); if (Math.abs(a.d - b.d) > 12) add(a.r0, b.r0); }
  return pairs;
}
function MKB_pad(p, col, R) { return { kind: 'MKB_pad', x: p[0], y: p[1], r: MKB_LP.r, col, T: E.tones(col), ph: R() * 9, spin: R.chance(.5) ? 1 : -1, flash: 0, hold: false, solid: false, hittable: false, mapColor: col, to: null }; }
function MKB_launchHero(h, p) {
  const q = p.to, { T, H } = MKB_arc(p, q), ang = Math.atan2(q.y - p.y, q.x - p.x), C = .16, REC = .32;
  p.hold = q.hold = true; p.flash = .6; sfx('charge', { vol: .3, pitch: 2.2 });
  startAction(h, { name: 'MKB_launch', cancel: false, interrupt: false, moveK: 0, face: ang, z: 0, rig: { pose: 'crouch' },
    update(dt) {
      this.t += dt; h.traction = 0; h.inv = Math.max(h.inv, .15);
      const t = this.t;
      if (t < C) { const k = Math.min(1, dt * 18); h.vx = dt > 0 ? (p.x - h.x) * k / dt : 0; h.vy = dt > 0 ? (p.y - h.y) * k / dt : 0; this.rig = { pose: 'crouch', expr: 'angry' }; return true; }   // the coil on the pad
      if (!this.up) { this.up = true; MKB_padBurst(p, h); this.ghost = p.col; }
      const u = clamp((t - C) / T, 0, 1);
      if (u < 1) {
        const tx = lerp(p.x, q.x, u), ty = lerp(p.y, q.y, u);
        h.vx = dt > 0 ? (tx - h.x) / dt : 0; h.vy = dt > 0 ? (ty - h.y) / dt : 0; this.z = H * 4 * u * (1 - u);   // the movement step lands him exactly on the arc
        // tucked on the way up, a pirouette with the blade out at the top, the sword raised, then driven down
        if (u < .2) this.rig = { air: true, expr: 'shout' };
        else if (u < .52) this.rig = { air: true, expr: 'shout', attack: E.move('spin', (u - .2) / .32, 'active') };
        else if (u < .76) this.rig = { air: true, expr: 'angry', attack: E.move('plunge', (u - .52) / .24, 'wind') };
        else this.rig = { air: u < .93, expr: 'shout', attack: E.move('plunge', (u - .76) / .24, 'active') };
        return true;
      }
      if (!this.landed) { this.landed = true; this.ghost = null; MKB_padLand(q, h); }
      h.vx = h.vy = 0; h.traction = 1; this.z = 0;
      const k = (t - C - T) / REC; this.rig = { pose: 'crouch', expr: 'angry', attack: E.move('plunge', clamp(k, 0, 1), 'recover') };
      return k < 1;
    } });
}
function MKB_padBurst(p, h) {
  p.flash = 1; P.ring(p.x, p.y, 4, 34, p.col, .35); P.dust(p.x, p.y, 0, 10, { speed: 60 }); h.rig.kick(5);
  for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; P.add({ kind: 'spark', x: p.x + Math.cos(a) * 7, y: p.y + Math.sin(a) * 7, z: 1, vx: Math.cos(a) * 10, vy: Math.sin(a) * 10, vz: 140 + Math.random() * 140, g: 160, drag: 1, max: .45 + Math.random() * .2, color: p.col, hot: '#ffffff' }); }
  sfx('jump2', { vol: .5 }); sfx(MKB_SND.pad); shake(2);
}
function MKB_padLand(q, h) {
  q.flash = 1; h.x = q.x; h.y = q.y; h.rig.kick(-7);
  FX.nova({ team: 'hero', src: h, x: q.x, y: q.y, r0: 6, r1: 50, dur: .3, el: 'phys', color: q.col, tags: ['aoe', 'melee'], hit: { amount: MKB_hit(1.8), kb: 230, up: 150 } });
  P.dust(q.x, q.y, 0, 22, { speed: 95 }); P.ring(q.x, q.y, 4, 46, '#e8f4ff', .35); P.bits(q.x, q.y, 2, 10, ['#6a6070', '#8a8090', '#4a4050', q.col]);
  FX.scorch(q.x, q.y, 13); shake(6); game.freeze(.07); sfx('thud', { vol: .9 }); sfx('explode', { vol: .35, pitch: .7 });
}
function MKB_launchFoe(m, p, L0) {
  const q = p.to, T = clamp(.5 + Math.hypot(q.x - m.x, q.y - m.y) / 460, .7, 1.5);
  m.vx = (q.x - m.x) / T; m.vy = (q.y - m.y) / T; m.vz = 260 * T; m.air = true; m.z = Math.max(m.z || 0, .5); m.atk = null; m.kbT = T; m.stunT = Math.max(m.stunT || 0, T + .3); m.MKB_lt = game.time + 3;
  if (m.ai && m.ai.state) { m.ai.state = 'idle'; m.ai.t = .6; } m.tok = false;   // a slime's hop state resets, its attack turn is freed
  L0.MKB_fly.push({ m, t: 0, T, to: q });
  p.flash = Math.max(p.flash, .7); P.ring(p.x, p.y, 3, 24, p.col, .3); sfx('jump', { vol: .25, pitch: .7 });
  FX.telegraph({ shape: 'circle', x: q.x, y: q.y, r: 16, dur: T / Math.max(.3, m.timeK === undefined ? 1 : m.timeK), color: '#ff8a3a' });   // where it will come down
}
/** a thrown monster hits the floor: it takes a share of the hero's hit and its own life, and bowls over its neighbours */
function MKB_crash(m, f) {
  const h = ED.hero;
  dealDamage(m, { src: h, amount: MKB_hit(1.4) + m.maxHp * .12, el: 'phys', kb: 0, stun: .6, tags: ['MKB_crash'] });
  hitCircle('hero', m.x, m.y, 20, u => u === m ? null : { src: h, amount: MKB_hit(.8), el: 'phys', kb: 150, up: 60, ang: Math.atan2(u.y - m.y, u.x - m.x), tags: ['aoe', 'MKB_crash'] });
  if (h && h.alive && Math.hypot(h.x - m.x, h.y - m.y) < 11) dealDamage(h, { src: m, amount: m.dmg * .8, el: 'phys', kb: 150, ang: Math.atan2(h.y - m.y, h.x - m.x) });
  P.dust(m.x, m.y, 0, 12, { speed: 70 }); P.ring(m.x, m.y, 3, 26, '#e8dcc8', .3); FX.scorch(m.x, m.y, 8); shake(2.5); game.freeze(.03); sfx('thud', { vol: .55 });
  m.vx *= .25; m.vy *= .25; void f;
}
function MKB_drawPad(p, r) {
  const t = game.time, c = p.col, T0 = p.T, fl = p.flash, ang = Math.atan2(p.to.y - p.y, p.to.x - p.x), ca = Math.cos(ang), sa = Math.sin(ang);
  L.add(p.x, p.y, 8, 44 + 36 * fl, .5 + .9 * fl, { color: c });
  if (!r.visible(p.x, p.y, 0, 50, 90, 40)) return;
  r.decal(() => {
    const g = r.tgt, W = (d, s) => r.w(p.x + ca * d - sa * s, p.y + sa * d + ca * s, 0);
    // a carved stone disc: a lit lip, a dark groove, a glowing rune channel that turns, and a sunken glowing core
    r.groundDisc(p.x, p.y, 12, '#16121c', .55); r.groundDisc(p.x, p.y, 11, '#3e3848', 1); r.groundDisc(p.x - .6, p.y - .6, 10, '#524a5e', 1);
    r.groundDisc(p.x, p.y, 9, '#221c2a', 1); r.groundDisc(p.x, p.y, 7.6, T0.deep, 1);
    r.groundRing(p.x, p.y, 11, '#6a6278', .9); r.groundRing(p.x, p.y, 8.3, c, .5 + .3 * fl);
    for (let i = 0; i < 8; i++) { const a = t * .7 * p.spin + i / 8 * TAU; r.groundArc(p.x, p.y, 7.8, 8.8, a, a + .38, i % 2 ? T0.hi : c, .95); }
    const dw = clamp((p.dwell || 0) / .2, 0, 1);   // it gathers itself under his feet before it throws
    r.groundDisc(p.x, p.y, 5.6, c, .3 + .12 * Math.sin(t * 3 + p.ph) + .5 * fl + .4 * dw); r.groundRing(p.x, p.y, 5.6, T0.hi, .7); if (dw > 0) r.groundRing(p.x, p.y, 8.3 - 4 * dw, T0.hi, .9);
    for (let k = 0; k < 3; k++) {   // chevrons flow outward toward the twin
      const u = (t * 1.3 + k / 3) % 1, d = u * 6 - 3.5, a = Math.sin(u * Math.PI), tip = W(d + 2.2, 0), l = W(d, 2.2), rr = W(d, -2.2);
      px.blend(g, a, 'normal', () => { px.line(g, l[0], l[1], tip[0], tip[1], T0.hi); px.line(g, rr[0], rr[1], tip[0], tip[1], T0.hi); });
    }
  }, { emissive: .7 });
  const h = ED.hero, near = h ? clamp((Math.hypot(h.x - p.x, h.y - p.y) - 6) / 10, 0, 1) : 1;   // the stone fades while the hero stands on the pad
  r.queue(p.x, p.y, 12, g => {   // a rune stone floats over it; a pillar of light while it throws
    const zm = r.view.zoom || 1, bob = Math.sin(t * 2.2 + p.ph) * 1.5, [x, y] = r.w(p.x, p.y, 13 + bob), [bx, by] = r.w(p.x, p.y, 0);
    px.glow(g, 1);
    if (fl > 0) { const top = y - 30 * zm * fl; px.blend(g, .45 * fl, 'add', () => px.rect(g, bx - 5 * zm, top, 10 * zm, by - top, c)); px.blend(g, .6 * fl * fl, 'add', () => px.rect(g, bx - 2 * zm, top, 4 * zm, by - top, '#ffffff')); }
    if (near <= 0) return;
    px.blend(g, .25 * near, 'add', () => px.rect(g, bx - Math.max(1, zm) / 2, y, Math.max(1, zm), by - y, c));   // a thread of light ties it to its disc
    const w = 3 * zm, h2 = 5.5 * zm, s = Math.sin(t * 2.4 + p.ph) * w;   // a turning diamond: its lit facet sweeps across
    px.blend(g, near, 'normal', () => {
      r.glowDisc(g, x, y, (6 + 4 * fl) * zm, c, .35 + .3 * fl);
      px.poly(g, [[x, y - h2 - 1], [x + w + 1, y], [x, y + h2 + 1], [x - w - 1, y]], T0.deep);
      px.poly(g, [[x, y - h2], [x + w, y], [x, y + h2], [x - w, y]], T0.sh);
      px.poly(g, [[x, y - h2], [x + s, y], [x, y + h2], [x - w, y]], T0.base);
      px.line(g, x, y - h2, x + s, y, T0.hi); px.dot(g, x - w * .45, y - h2 * .35, '#ffffff');
    });
  }, { emissive: true, bias: .01 });
}
/** near a pad: the arc it will throw along, drawn as glints flowing toward the twin */
function MKB_arcPreview(p, r, a) {
  const q = p.to, { D, H } = MKB_arc(p, q), n = Math.ceil(D / 8), t = game.time;
  r.queue(p.x, p.y, 60, g => px.blend(g, .8 * a, 'add', () => {
    for (let i = 0; i < n; i++) {
      const u = (i + (t * 2.2) % 1) / n; if (u > 1) continue;
      const [sx, sy] = r.w(lerp(p.x, q.x, u), lerp(p.y, q.y, u), H * 4 * u * (1 - u)), k = i % 5 === 0, near = u < .25 ? u / .25 : 1;
      if (near < .3 && !k) continue;
      px.rect(g, sx - 1, sy - 1, 2, 2, k ? '#ffffff' : p.col);
      if (k) { px.rect(g, sx - 3, sy - .5, 6, 1, p.col); px.rect(g, sx - .5, sy - 3, 1, 6, p.col); }
    }
    const [lx, ly] = r.w(q.x, q.y, 0); r.glowDisc(g, lx, ly, 9 * (r.view.zoom || 1), p.col, .25);
  }), { emissive: true, bias: 5 });
}

/* =============================================================================
 * THE DROWNED AQUEDUCT (depth 14)
 * Floodwater pools (floor tag 'water': the core slows walkers and ripples them) and deep canals ('deep': blocked,
 * crossed by a ford; a canal is only dug where it cuts nothing off). The tide breathes: a band of cells around every
 * pool floods and drains on a half-minute cycle. The band is re-tagged live but never re-baked (a bake costs a
 * visible hitch): the floor bakes it dry and its water is drawn over it, surging in with foam and leaving wet
 * stones that dry. Storm hits on anything in the water arc through the whole body of water (flood-filled, capped);
 * fire on water (hits, bolts, burning ground, burning units) raises scalding steam that veils monsters.
 * ============================================================================= */
const MKB_FL = { low: .52, high: .95, per: 28, arcK: .65, arcCap: 14, clouds: 26, dry: 5, surge: 1.8, water: '#3a7cb4', wet: '#0a1422', foam: '#e0f4ff' };
def('mechanics', 'flood', { name: 'Floodwater', title: 'The Drowned Aqueduct', adj: 'Drowned', noun: 'Aqueduct', color: '#5ab0e8', depth: 14, weight: 7,
  tip: 'The tide breathes through the halls. A storm hit on anything in the water arcs through the whole pool; fire on water raises scalding steam.',
  brief: 'Storm arcs through water; fire makes steam.', lure: 'into the water', act: 'strike the water with storm', zone: 'the water',
  icon(g, x, y, s) {
    px.rect(g, x + s, y + 9 * s, 14 * s, 6 * s, '#1a3a6a'); px.rect(g, x + s, y + 9 * s, 14 * s, 2 * s, '#2c6496');
    for (let k = 0; k < 2; k++) for (let i = 0; i < 7; i++) px.dot(g, x + (1.5 + i * 2 + k) * s, y + (9 + k * 3 + (i % 2)) * s, '#bfe8ff');
    px.poly(g, [[x + 8 * s, y + s], [x + 11 * s, y + 5.5 * s], [x + 8 * s, y + 8 * s], [x + 5 * s, y + 5.5 * s]], '#5ab0e8'); px.dot(g, x + 7 * s, y + 5 * s, '#ffffff');
    px.line(g, x + 12 * s, y + 2 * s, x + 14 * s, y + 5 * s, '#ffe45a'); px.line(g, x + 14 * s, y + 5 * s, x + 13 * s, y + 5 * s, '#ffe45a'); px.line(g, x + 13 * s, y + 5 * s, x + 15 * s, y + 8 * s, '#ffe45a');
  },
  place(L0, R) { MKB_floodPlace(L0, R); },
  start(L0) { MKB_hook(); BUS.on('hit', e => MKB_floodHit(L0, e), 'level'); },
  update(L0, dt) { if (L0.MKB_fl) { MKB_tide(L0, dt); MKB_floodStep(L0, dt); } },
  draw(L0, r) { if (L0.MKB_fl) { MKB_drawTide(L0, r); MKB_drawFloodFx(L0, r); } }
});
function MKB_floodPlace(L0, R) {
  const w = L0.w, h = L0.h, n = w * h, m = L0.map, tags = m.floorTags, cells = m.cells; if (!tags) return;
  const S = L0.MKB_fl = { v: new Float32Array(n).fill(9), own: new Uint8Array(n), vis: new Float32Array(n), wet: new Float32Array(n), band: [], deep: [], lab: null, labT: -9, dirty: true, arcs: [], bolts: [], zaps: [], clouds: [], phase: R() * MKB_FL.per * .5, level: 0, tick: 0, bodyT: {} };
  const dry = i => cells[i] === 0 && !tags[i];
  const nearRune = i => { const x = (i % w + .5) * T16, y = ((i / w) | 0) * T16 + 8; return Math.hypot(x - L0.start.x, y - L0.start.y) < 46 || (L0.exit && Math.hypot(x - L0.exit.x, y - L0.exit.y) < 38); };
  // a canal never swallows what other mechanics placed (a launch pad in deep water would land the hero in it): it keeps
  // off small things, off ward circles, off a time well's clock face, and off the props on the floor (no barrel afloat)
  const held = L0.things.filter(t => !t.dead && !t.mark && (t.r || t.solid || t.hittable)).concat(L0.torches, (L0.props || []).filter(p => !((p.z || 0) > 0)));
  const nearThing = i => { const x = (i % w + .5) * T16, y = ((i / w) | 0) * T16 + 8; return held.some(t => Math.hypot(t.x - x, t.y - y) < (t.MKB_big ? t.r * .6 : Math.min(t.r || 5, 32)) + 14); };
  // deep canals: two cells wide across a room with a ford left in them; kept only when nothing gets cut off
  let reach = MKB_reach(L0);
  for (const r0 of R.shuffle(L0.rooms.filter(q => q.w >= 8 && q.h >= 8)).slice(0, clamp(Math.round(L0.rooms.length * .3), 1, 3))) {
    const hor = r0.w >= r0.h ? R.chance(.7) : R.chance(.3), cs = [];
    if (hor) { const y0 = r0.y + R.int(2, r0.h - 4), gap = r0.x + R.int(1, r0.w - 3); for (let x = r0.x - 1; x <= r0.x + r0.w; x++) if (x < gap || x > gap + 1) cs.push(y0 * w + x, (y0 + 1) * w + x); }
    else { const x0 = r0.x + R.int(2, r0.w - 4), gap = r0.y + R.int(1, r0.h - 3); for (let y = r0.y - 1; y <= r0.y + r0.h; y++) if (y < gap || y > gap + 1) cs.push(y * w + x0, y * w + x0 + 1); }
    const ok = cs.filter(i => i >= 0 && i < n && dry(i) && !nearRune(i) && !nearThing(i)); if (ok.length < 6) continue;
    for (const i of ok) { tags[i] = 'deep'; m.blocked[i] = 1; }
    const now = MKB_reach(L0);
    if (now < reach - ok.length) { for (const i of ok) { tags[i] = null; m.blocked[i] = 0; } continue; }
    reach = now; for (const i of ok) { S.own[i] = 2; S.deep.push(i); }
  }
  // pools: distance to a few seeds (roughened by noise) decides how soon a cell floods; the canals get shallow banks
  const seeds = [], K = clamp(Math.round(L0.rooms.length * .9), 4, 12);
  for (let k = 0; k < K; k++) { const r0 = R.pick(L0.rooms); seeds.push([r0.x + R() * r0.w, r0.y + R() * r0.h, 2.8 + R() * Math.min(r0.w, r0.h) * .5]); }
  for (let i = 0; i < n; i++) {
    if (!dry(i) || nearRune(i)) continue;
    const cx = i % w + .5, cy = ((i / w) | 0) + .5; let v = 9;
    for (const [sx, sy, sr] of seeds) v = Math.min(v, Math.hypot(cx - sx, cy - sy) / sr);
    v += (E.noise2(cx * .4 + 17, cy * .4 - 5) - .5) * .45;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const j = i + dy * w + dx; if (j >= 0 && j < n && S.own[j] === 2) v = Math.min(v, .25 + Math.abs(dx * dy) * .2); }
    if (v >= MKB_FL.high) continue;
    S.v[i] = v; S.own[i] = 1;
    if (v < MKB_FL.low) tags[i] = 'water'; else S.band.push(i);
  }
  // the floor bakes the band dry (its water is drawn live) and gives the canals kerb stones and the pools a wet shore
  const orig = m.MKB_tex0 || (m.MKB_tex0 = m.floorTex);
  m.floorTex = (x, y, tag) => MKB_floodTex(L0, orig, x, y, tag);
  m.floors = {}; if (L0.flow) L0.flow.tx = -1;
  MKB_tideAtlas(L0);
}
/** the theme's own water, painted once into a 16 x 16 tile per tide-band cell: the live tide is drawn from these, so
 *  the water that floods in is the same water the pools were baked with (not a flat tint over the stones) */
function MKB_tideAtlas(L0) {
  const S = L0.MKB_fl, orig = L0.map.MKB_tex0, w = L0.w, n = S.band.length; S.atlas = null; if (!orig || !n) return;
  const cols = Math.ceil(Math.sqrt(n)), cv = E.mkCanvas(cols * 16, Math.ceil(n / cols) * 16), g = E.ctx2d(cv), img = g.createImageData(cv.width, cv.height), d = img.data, at = new Map();
  S.band.forEach((i, k) => {
    const tx = (k % cols) * 16, ty = ((k / cols) | 0) * 16, x0 = (i % w) * T16, y0 = ((i / w) | 0) * T16; at.set(i, [tx, ty]);
    for (let py = 0; py < 16; py++) for (let qx = 0; qx < 16; qx++) {
      let c = null; try { c = orig(x0 + qx + .5, y0 + py + .5, 'water'); } catch (e) { c = null; }
      if (!c) c = [42, 92, 140];
      const o = ((ty + py) * cv.width + tx + qx) * 4; d[o] = clamp(c[0], 0, 255); d[o + 1] = clamp(c[1], 0, 255); d[o + 2] = clamp(c[2], 0, 255); d[o + 3] = 255;
    }
  });
  g.putImageData(img, 0, 0); S.atlas = { cv, at };
}
function MKB_edge(L0, cx, cy, lx, ly, other) {   // how far a point in cell (cx, cy) is from the nearest side that borders `other`
  const w = L0.w, i = cy * w + cx; let e = 99;
  if (cy > 0 && other(i - w)) e = Math.min(e, ly); if (cy < L0.h - 1 && other(i + w)) e = Math.min(e, T16 - ly);
  if (cx > 0 && other(i - 1)) e = Math.min(e, lx); if (cx < w - 1 && other(i + 1)) e = Math.min(e, T16 - lx);
  return e;
}
function MKB_floodTex(L0, orig, x, y, tag) {
  const S = L0.MKB_fl, w = L0.w, cx = Math.floor(x / T16), cy = Math.floor(y / T16), i = cy * w + cx, o = S.own[i];
  if (!o) return orig(x, y, tag);
  if (o === 1 && tag === 'water' && S.v[i] >= MKB_FL.low) return orig(x, y, null);   // the tide band bakes dry
  const tags = L0.map.floorTags, cells = L0.map.cells, lx = x - cx * T16, ly = y - cy * T16;
  if (o === 2 && tag === 'deep') {
    const e = MKB_edge(L0, cx, cy, lx, ly, j => tags[j] !== 'deep');
    if (e < 2.4) { const b = orig(x, y, null) || [90, 84, 96], k = e < .9 ? 1.34 : 1.14; return [b[0] * k + 8, b[1] * k + 8, b[2] * k + 10, b[3]]; }   // the kerb stones
    if (e < 3.6) return [12, 22, 44];   // the kerb's shadow on the water
    return orig(x, y, 'deep');
  }
  if (o === 1 && tag === 'water') {
    const wv = orig(x, y, 'water'), e = MKB_edge(L0, cx, cy, lx, ly, j => cells[j] === 0 && (S.own[j] === 1 ? S.v[j] >= MKB_FL.low : tags[j] !== 'water' && tags[j] !== 'deep'));
    if (e < 2.4 && wv) { const b = orig(x, y, null) || wv, k = e / 2.4; if (E.hash2(x | 0, y | 0) < .1 * (1 - k)) return [200, 228, 242]; return wv.map((v, q) => q < 3 ? v * (.4 + .6 * k) + b[q] * (.6 - .6 * k) * .8 : v); }   // a wet shore
    return wv;
  }
  return orig(x, y, tag);
}
/** the tide: a slow cosine between the two levels; band cells flood and drain as it passes their depth */
function MKB_tide(L0, dt) {
  const S = L0.MKB_fl, F = MKB_FL, tags = L0.map.floorTags; S.phase += dt;
  const lv = F.low + (F.high - F.low) * (.5 - .5 * Math.cos(S.phase / F.per * TAU)), rising = lv > S.level; S.level = lv;
  if ((S.tick -= dt) <= 0) {
    S.tick = .2;
    for (const i of S.band) { const want = S.v[i] < lv, tg = tags[i]; if (want && !tg) { tags[i] = 'water'; S.dirty = true; } else if (!want && tg === 'water') { tags[i] = null; S.wet[i] = 1; S.dirty = true; } }
  }
  for (const i of S.band) { const on = tags[i] === 'water'; S.vis[i] = on ? Math.min(1, S.vis[i] + dt * F.surge) : Math.max(0, S.vis[i] - dt * F.surge); if (!on && S.wet[i] > 0) S.wet[i] = Math.max(0, S.wet[i] - dt / F.dry); }
  if (rising !== S.rising) { S.rising = rising; if (rising && ED.t > 4 && (S.turns = (S.turns || 0) + 1) <= 3) { notify('THE WATER RISES', '#8ac8ff', 2.2); sfx(MKB_SND.tide); } }
}
/** bodies of water: flood-fill labels over water and deep cells, rebuilt when the tide moved (at most once a second otherwise) */
function MKB_labels(L0) {
  const S = L0.MKB_fl; if (S.lab && !S.dirty && game.time - S.labT < 1) return S.lab;
  const w = L0.w, n = w * L0.h, tags = L0.map.floorTags, lab = S.lab || (S.lab = new Int32Array(n)), q = S.q || (S.q = new Int32Array(n)), wet = j => tags[j] === 'water' || tags[j] === 'deep';
  lab.fill(0); let id = 0;
  for (let s = 0; s < n; s++) {
    if (lab[s] || !wet(s)) continue;
    id++; let qh = 0, qt = 0; lab[s] = id; q[qt++] = s;
    while (qh < qt) { const c = q[qh++], cx = c % w; if (cx > 0 && !lab[c - 1] && wet(c - 1)) { lab[c - 1] = id; q[qt++] = c - 1; } if (cx < w - 1 && !lab[c + 1] && wet(c + 1)) { lab[c + 1] = id; q[qt++] = c + 1; } if (c >= w && !lab[c - w] && wet(c - w)) { lab[c - w] = id; q[qt++] = c - w; } if (c + w < n && !lab[c + w] && wet(c + w)) { lab[c + w] = id; q[qt++] = c + w; } }
  }
  S.dirty = false; S.labT = game.time; return lab;
}
function MKB_floodHit(L0, e) {
  const hit = e.hit, u = e.tgt; if (!hit || !u || ED.L !== L0 || (u.z || 0) > 3) return;
  const tg = hit.tags; if (tg && (tg.includes('MKB_arc') || tg.includes('floor'))) return;
  const f = L0.map.floorAt(u.x, u.y); if (f !== 'water' && f !== 'deep') return;
  if (hit.el === 'storm') MKB_conduct(L0, e);
  else if (hit.el === 'fire') MKB_steam(L0, u.x, u.y, .7);
}
/** a storm hit on a unit in the water: the whole body of water lights up and arcs to everyone else standing in it */
function MKB_conduct(L0, e) {
  const S = L0.MKB_fl, tgt = e.tgt, lab = MKB_labels(L0), i0 = MKB_idx(L0, tgt.x, tgt.y), id = i0 >= 0 ? lab[i0] : 0; if (!id) return;
  if (game.time - (S.bodyT[id] || -9) < .3) return; S.bodyT[id] = game.time;
  const team = e.src && e.src.team === 'foe' ? 'foe' : 'hero', list = [];
  for (const u of enemiesOf(team)) { if (u === tgt || !u.alive || (u.z || 0) > 3 || u.spawnT > 0 || u.canFly) continue; const j = MKB_idx(L0, u.x, u.y); if (j >= 0 && lab[j] === id) list.push(u); }
  list.sort((a, b) => dist2(a, tgt) - dist2(b, tgt)); if (list.length > MKB_FL.arcCap) list.length = MKB_FL.arcCap;
  const amt = Math.max(1, (e.dmg || 0) * MKB_FL.arcK);
  list.forEach((u, k) => S.arcs.push({ at: game.time + .04 + k * .03, x: tgt.x, y: tgt.y, u, amt, src: e.src }));
  const cells = []; for (let j = 0; j < lab.length; j++) if (lab[j] === id) cells.push(j);
  // one flash per body of water: a pool that conducts again (charged pylons keep a pool humming) restarts its flash
  const z0 = S.zaps.find(z => z.id === id); if (z0) Object.assign(z0, { t0: game.time, cells, x: tgt.x, y: tgt.y, seed: (rnd() * 999) | 0 });
  else { S.zaps.push({ id, t0: game.time, cells, x: tgt.x, y: tgt.y, seed: (rnd() * 999) | 0 }); if (S.zaps.length > 3) S.zaps.shift(); }
  sfx('zap', { vol: .55, pitch: .8 }); elBurst(tgt.x, tgt.y, 2, 'storm', 8); if (list.length) { shake(2 + Math.min(3, list.length * .3)); game.freeze(.04); game.flash('#fff4a0', .06, .2); }
}
/** steam where fire meets water: a cloud that swells, drifts, veils monsters and scalds everyone inside */
function MKB_steam(L0, x, y, k = 1) {
  const S = L0.MKB_fl; if (!S) return null;
  for (const c of S.clouds) if (Math.hypot(c.x - x, c.y - y) < 12) { c.life = Math.max(c.life, c.t + 2.6 + k); c.rMax = Math.min(28, c.rMax + 2.5 * k); return c; }
  if (S.clouds.length >= MKB_FL.clouds) S.clouds.shift();
  const a = rnd() * TAU, c = { x, y, r: 5, rMax: 12 + 8 * k, t: 0, life: 2.8 + 1.4 * k, seed: rnd() * 9, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3 };
  S.clouds.push(c); P.glints(x, y, 6, 3, '#e8f6ff', 8);
  if (game.time - MKB.hissT > .25) { MKB.hissT = game.time; sfx(MKB_SND.hiss); }
  return c;
}
function MKB_floodStep(L0, dt) {
  const S = L0.MKB_fl, h = ED.hero, map = L0.map, t = game.time;
  const wetAt = u => { const f = map.floorAt(u.x, u.y); return (f === 'water' || f === 'deep') && (u.z || 0) < 3; };
  // conducted arcs land a beat apart, nearest first
  for (let k = S.arcs.length - 1; k >= 0; k--) {
    const a = S.arcs[k]; if (t < a.at) continue; S.arcs.splice(k, 1); const u = a.u; if (!u.alive) continue;
    dealDamage(u, { src: a.src, amount: a.amt, el: 'storm', kb: 30, ang: Math.atan2(u.y - a.y, u.x - a.x), statusChance: .6, tags: ['MKB_arc', 'aoe'] });
    elBurst(u.x, u.y, 8, 'storm', 5); S.bolts.push({ x0: a.x, y0: a.y, x1: u.x, y1: u.y, t0: t, seed: (rnd() * 999) | 0 }); if (S.bolts.length > 30) S.bolts.shift();
  }
  // fire over water: bolts hiss a trail of steam, burning ground and novas boil the pools they cover
  for (const f of ED.fx) {
    if (f.el !== 'fire' || f.x === undefined || (f.MKB_st || 0) > t) continue;
    let x = f.x, y = f.y;
    if (f.kind === 'area' || f.kind === 'nova') { const rr = f.kind === 'area' ? f.r : lerp(f.r0, f.r1, clamp(f.t / f.dur, 0, 1)), a = rnd() * TAU, d = Math.sqrt(rnd()) * rr; x += Math.cos(a) * d; y += Math.sin(a) * d; }
    else if (f.kind === 'wave') { const q = f.marks && f.marks[f.marks.length - 1]; if (!q) continue; x = q.x; y = q.y; }
    else if (f.kind !== 'bolt' || f.z > 24 || f.t < .1) continue;   // (a bolt hisses once it has left the caster's hand)
    const tg = map.floorAt(x, y); if (tg === 'water' || tg === 'deep') { MKB_steam(L0, x, y, f.kind === 'bolt' ? .45 : .8); f.MKB_st = t + (f.kind === 'bolt' ? .07 : .22); }
  }
  // water puts out burning: the flames die in a burst of steam
  for (const m of ED.foes) if (m.alive && m.st.burn && wetAt(m)) { delete m.st.burn; MKB_steam(L0, m.x, m.y, .5); }
  if (h && h.alive && h.st.burn && wetAt(h)) { delete h.st.burn; MKB_steam(L0, h.x, h.y, .5); }
  // steam: swells, drifts, veils and scalds (monsters for a share of the hero's hit, the hero by depth)
  const dps = MKB_hit(.8, 'fire'), hdps = 3 + 5 * SCALE.foeDmg(ED.depth || 1);
  for (let k = S.clouds.length - 1; k >= 0; k--) {
    const c = S.clouds[k]; c.t += dt; if (c.t >= c.life) { S.clouds.splice(k, 1); continue; }
    c.r = Math.min(c.rMax, c.r + dt * 6); c.x += c.vx * dt; c.y += c.vy * dt;
    const heat = 1 - c.t / c.life, R0 = c.r * .85;
    GRID.each(c.x, c.y, R0, m => { if ((m.z || 0) > 18 || m.spawnT > 0) return; MKB_fade(m, .45); dot(m, dps * heat * dt, 'fire', m.MKB_sc || (m.MKB_sc = { src: h })); });
    if (h && h.alive && h.z < 18 && Math.hypot(h.x - c.x, h.y - c.y) < R0) {
      dot(h, hdps * heat * dt, 'fire', h.MKB_sc || (h.MKB_sc = { src: null }));
      if ((h.MKB_scT = (h.MKB_scT || 0) - dt) <= 0) { h.MKB_scT = .7; h.flash = .05; sfx('hurt', { vol: .22, pitch: 1.5 }); P.add({ kind: 'dust', x: h.x, y: h.y, z: 14, vz: 16, g: -6, drag: 2, max: .6, size: 2, color: '#ffb0a0' }); }
    }
  }
}
/** the tide band's water, drawn live: cells grouped by how far the water has come in (so translucent cells never
 *  overlap), foam along the front, and dark wet stones where it drained */
function MKB_drawTide(L0, r) {
  const S = L0.MKB_fl, w = L0.w, t = game.time;
  r.decal(() => {
    const g = r.tgt, tags = L0.map.floorTags, cells = L0.map.cells, groups = MKB_FL.groups || (MKB_FL.groups = Array.from({ length: 16 }, () => [])), bw = r.bw, bh = r.bh;
    for (const q of groups) q.length = 0;
    const quad = i => { const x0 = (i % w) * T16, y0 = ((i / w) | 0) * T16; return [r.w(x0, y0), r.w(x0 + T16, y0), r.w(x0 + T16, y0 + T16), r.w(x0, y0 + T16)]; };
    const foam = [];
    for (const i of S.band) {
      const vis = S.vis[i], wet = S.wet[i]; if (vis < .06 && wet < .06) continue;
      const [sx, sy] = r.w((i % w + .5) * T16, (((i / w) | 0) + .5) * T16); if (sx < -30 || sy < -30 || sx > bw + 30 || sy > bh + 30) continue;
      if (vis >= .06) { groups[Math.max(1, Math.min(7, Math.round(vis * 7)))].push(i); if (vis > .4) for (const [dx, dy, a, b] of [[0, -1, 0, 1], [1, 0, 1, 2], [0, 1, 2, 3], [-1, 0, 3, 0]]) { const j = i + dy * w + dx; if (cells[j] === 0 && tags[j] !== 'water' && tags[j] !== 'deep') foam.push([i, a, b]); } }
      else groups[8 + Math.max(1, Math.min(7, Math.round(wet * 7)))].push(i);
    }
    const alpha = E.style.trans !== 'dither', A = S.atlas;
    const cv = MKB_FL.cv || (MKB_FL.cv = E.mkCanvas(bw, bh)), cg = MKB_FL.cg || (MKB_FL.cg = E.ctx2d(cv));
    if (alpha && (cv.width !== bw || cv.height !== bh)) { cv.width = bw; cv.height = bh; cg._c = null; }
    // a band cell's water tile, laid on the floor by an affine map (exact for these orthographic views), a hair
    // oversized so neighbours overlap instead of leaving seams (they overlap on the scratch canvas, never in alpha)
    const tile = i => { const t = A && A.at.get(i); if (!t) { px.poly(cg, quad(i), MKB_FL.water); return; } const x0 = (i % w) * T16 - .5, y0 = ((i / w) | 0) * T16 - .5, p0 = r.w(x0, y0), p1 = r.w(x0 + 17, y0), p3 = r.w(x0, y0 + 17); cg.save(); cg.imageSmoothingEnabled = false; cg.transform((p1[0] - p0[0]) / 16, (p1[1] - p0[1]) / 16, (p3[0] - p0[0]) / 16, (p3[1] - p0[1]) / 16, p0[0], p0[1]); cg.drawImage(A.cv, t[0], t[1], 16, 16, 0, 0, 16, 16); cg.restore(); };
    for (let k = 1; k < 16; k++) {
      const list = groups[k]; if (!list.length || k === 8) continue;
      const water = k < 8, col = water ? MKB_FL.water : MKB_FL.wet, a = water ? (A ? k / 7 * .96 : k / 7 * .72) : (k - 8) / 7 * .34;
      if (!alpha) { for (const i of list) px.polyDither(g, quad(i), col, a, r.ix, r.iy); continue; }
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;   // only the group's own rectangle is cleared and copied
      for (const i of list) for (const [qx, qy] of quad(i)) { if (qx < x0) x0 = qx; if (qx > x1) x1 = qx; if (qy < y0) y0 = qy; if (qy > y1) y1 = qy; }
      x0 = clamp(Math.floor(x0) - 2, 0, bw); y0 = clamp(Math.floor(y0) - 2, 0, bh); x1 = clamp(Math.ceil(x1) + 3, 0, bw); y1 = clamp(Math.ceil(y1) + 3, 0, bh); if (x1 <= x0 || y1 <= y0) continue;
      cg.clearRect(x0, y0, x1 - x0, y1 - y0); for (const i of list) { if (water) tile(i); else px.poly(cg, quad(i), col); }
      px.blend(g, a, 'normal', () => g.drawImage(cv, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0));
    }
    if (foam.length) px.blend(g, .6 + .25 * Math.sin(t * 3), 'normal', () => { for (const [i, a, b] of foam) { const q = quad(i), [x0, y0] = q[a], [x1, y1] = q[b]; px.line(g, x0, y0, x1, y1, MKB_FL.foam); const n = 4, ph = t * 2 + i; for (let k = 0; k < n; k++) { const u = (k + .5) / n, o = Math.sin(ph + k * 1.7) > .3 ? 1 : 0; if (o) px.dot(g, lerp(x0, x1, u), lerp(y0, y1, u) + 1, '#ffffff'); } } });   // the water's front, frothing
    // the canals flow: glints drift along the deep water
    for (const i of S.deep) {
      if (tags[i] !== 'deep') continue;
      const cx = i % w, cy = (i / w) | 0, ph = E.hash2(cx * 7, cy * 13), u = (t * .3 + ph) % 1, [sx, sy] = r.w(cx * T16 + u * T16, cy * T16 + ((ph * 7.3) % 1) * T16);
      if (sx < -4 || sy < -4 || sx > bw + 4 || sy > bh + 4 || Math.sin(u * Math.PI) < .4) continue;
      px.rect(g, sx, sy, 3, 1, '#5a8ac8'); px.dot(g, sx + 1, sy, '#9ac4f0');
    }
  });
}
function MKB_drawFloodFx(L0, r) {
  const S = L0.MKB_fl, w = L0.w, t = game.time;
  // a conducting pool lights up: the whole body flashes and crackles
  for (const z of S.zaps) {
    const u = (t - z.t0) / .38; if (u >= 1 || u < 0) continue;
    const vis = z.cells.filter(i => { const [sx, sy] = r.w((i % w + .5) * T16, (((i / w) | 0) + .5) * T16); return sx > -20 && sy > -20 && sx < r.bw + 20 && sy < r.bh + 20; }).slice(0, 170);
    r.decal(() => { const g = r.tgt; px.blend(g, .5 * (1 - u), 'add', () => { for (const i of vis) { const x0 = (i % w) * T16, y0 = ((i / w) | 0) * T16; px.poly(g, [r.w(x0, y0), r.w(x0 + T16, y0), r.w(x0 + T16, y0 + T16), r.w(x0, y0 + T16)], '#fff09a'); } }); }, { emissive: 1 - u });
    r.queue(z.x, z.y, 1, g => { px.glow(g, 1); for (let k = 0, n = 0; k < vis.length && n < 26; k += 3) { const i = vis[k], x0 = (i % w) * T16, y0 = ((i / w) | 0) * T16, hs = E.hash2(i, z.seed + Math.floor(t * 20)); if (hs > .6) continue; n++; const a = r.w(x0 + hs * 16, y0 + 2, .5), b = r.w(x0 + 14 - hs * 10, y0 + 14, .5); zig(g, a[0], a[1], b[0], b[1], u < .5 ? '#ffffff' : '#ffe45a', 1, 3, i); } }, { emissive: true, bias: -2 });
    L.add(z.x, z.y, 4, 110, 1.3 * (1 - u), { color: '#ffe890' });
  }
  let lit = 0;   // (a few of the arcs light the water: a light per arc would cost more than it shows)
  for (const b of S.bolts) {
    const u = (t - b.t0) / .26; if (u >= 1 || !r.visible((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, 2, 90, 90, 90)) continue;
    r.queue((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, 2, g => { const [x0, y0] = r.w(b.x0, b.y0, 2), [x1, y1] = r.w(b.x1, b.y1, 6); px.glow(g, 1); if (u < .6) zig(g, x0, y0, x1, y1, '#ffe45a', 2, 5, b.seed); zig(g, x0, y0, x1, y1, '#ffffff', 1, 5, b.seed); }, { emissive: true, bias: 1 });
    if (lit++ < 6) L.add(b.x1, b.y1, 6, 40, .8 * (1 - u), { color: '#fff0a0' });
  }
  // steam: soft puffs in three flat tones that rise, swell and fade (queued above the floor so they cover what is inside)
  for (const c of S.clouds) {
    if (!r.visible(c.x, c.y, 10, 60, 70, 40)) continue;
    const a = Math.min(1, c.t * 4) * Math.min(1, (c.life - c.t) / 1.2), s = r.view.scale;
    for (let k = 0; k < 6; k++) {
      const an = c.seed + k * 2.39 + c.t * .25, d = c.r * (.2 + .6 * ((k * .618 + c.seed) % 1)), x = c.x + Math.cos(an) * d, y = c.y + Math.sin(an) * d, z = 3 + k * 2.4 + c.t * 3.5, rad = (3.6 + c.r * .24 + c.t * 1.1) * (1 + .12 * Math.sin(c.t * 2 + k));
      r.queue(x, y, z, g => { const [sx, sy] = r.w(x, y, z), R0 = rad * s; px.blend(g, .62 * a, 'normal', () => { px.disc(g, sx, sy + R0 * .15, R0, '#7e909e'); px.disc(g, sx - R0 * .12, sy - R0 * .12, R0 * .8, '#bccad4'); px.disc(g, sx - R0 * .3, sy - R0 * .36, R0 * .38, '#eef6fa'); }); }, { bias: .15 });
    }
  }
}

/* ---------- ?mechs=dark,flood: add any of these five to the running level (testing combinations) ---------- */
BUS.on('levelStart', e => {
  const L0 = e && e.L; if (!L0 || !L0.mechs || !L0.map) return;
  const want = (new URLSearchParams(location.search).get('mechs') || '').split(',').map(s => s.trim()).filter(id => MKB.ids.includes(id));
  if (!want.length) return;
  const R = RNG(((L0.rec && L0.rec.seed) || 1) + 4242);
  for (const id of want) { if (L0.mechs.includes(id)) continue; const M = REG.mechanics[id]; if (!M) continue; L0.mechs.push(id); if (M.place) M.place(L0, R); if (M.start) M.start(L0); }
}, 'global');
