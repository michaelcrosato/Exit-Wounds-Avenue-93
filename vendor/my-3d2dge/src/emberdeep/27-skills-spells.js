/* =============================================================================
 * SPELLS, SUMMONS AND UTILITY SKILLS: eight actives for the six slots (ids are contractual)
 *   frostnova       Frost Nova: both hands drive the blade into the floor; a ring of ice spikes chills and freezes
 *   chainlightning  Chain Lightning: the free hand flings an arc that hops from enemy to enemy
 *   meteor          Meteor: the sword raised to the sky calls a burning rock down on the cursor
 *   voidrift        Void Rift: the free hand tears a vortex open at the cursor; it drags enemies in, then implodes
 *   bladestorm      Spectral Blades: ghost swords peel off the blade and orbit him, cutting what they pass
 *   echo            Echo of the Deep: a spectral copy of the hero steps out of him, fights at his side, repeats his swings
 *   warcry          War Cry: a roar that fires him up and sends monsters running
 *   blink           Shadow Step: he dissolves into smoke, crosses the room as a shadow and strikes out of it
 * Shared looks: frozen monsters wear a faceted ice shell (SKS_ice), frightened ones run and show a skull (SKS_fear).
 * Every effect lives in ED.fx or ED.allies, so levels, the town, the proving grounds and the gallery all show it.
 * Private names start with SKS_.
 * ============================================================================= */

/* ---------- sounds ---------- */
A.define('sks_gather', { wave: 'saw', freq: 110, to: 520, dur: .3, vol: .08, vib: [24, .08] });
A.define('sks_frost', [{ wave: 'noise', freq: 7000, to: 1800, dur: .4, vol: .26, filter: 'highpass' }, { wave: 'triangle', freq: 2600, to: 900, dur: .32, vol: .12 }, { wave: 'sine', freq: 150, to: 45, dur: .3, vol: .5 }]);
A.define('sks_shatter', [{ wave: 'noise', freq: 5000, to: 2200, dur: .22, vol: .3, filter: 'bandpass', q: 3 }, { wave: 'triangle', freq: 3100, to: 2400, dur: .18, vol: .1 }, { wave: 'triangle', freq: 2100, dur: .25, vol: .08, delay: .04 }]);
A.define('sks_crackle', [{ wave: 'noise', freq: 5200, dur: .2, vol: .13, filter: 'bandpass', q: 5 }, { wave: 'square', freq: 90, to: 140, dur: .18, vol: .04, vib: [60, .4] }]);
A.define('sks_call', [{ wave: 'saw', freq: 140, to: 700, dur: .55, vol: .12, vib: [9, .05] }, { wave: 'noise', freq: 800, to: 3000, dur: .5, vol: .12, filter: 'bandpass' }]);
A.define('sks_whistle', { wave: 'sine', freq: 1900, to: 260, dur: .75, vol: .09, vib: [16, .03] });
A.define('sks_rift', [{ wave: 'sine', freq: 70, to: 45, dur: 1.3, vol: .32, vib: [5, .25] }, { wave: 'noise', freq: 500, to: 200, dur: 1.2, vol: .14, filter: 'lowpass' }]);
A.define('sks_implode', [{ wave: 'noise', freq: 250, to: 3200, dur: .18, vol: .28, filter: 'lowpass' }, { wave: 'sine', freq: 70, to: 28, dur: .55, vol: .6, delay: .16 }, { wave: 'noise', freq: 900, to: 60, dur: .6, vol: .4, filter: 'lowpass', delay: .16 }]);
A.define('sks_blades', [{ wave: 'triangle', freq: 1700, to: 2600, dur: .28, vol: .14 }, { wave: 'noise', freq: 6000, to: 2600, dur: .24, vol: .13, filter: 'highpass' }, { wave: 'triangle', freq: 2550, dur: .3, vol: .07, delay: .08 }]);
A.define('sks_bladehit', [{ wave: 'noise', freq: 4400, to: 1400, dur: .06, vol: .2 }, { wave: 'square', freq: 1500, to: 800, dur: .05, vol: .05 }]);
A.define('sks_echo', [{ wave: 'triangle', freq: 330, arp: [0, 7, 12, 19, 24], step: .07, dur: .5, vol: .18, vib: [6, .02] }, { wave: 'sine', freq: 180, to: 720, dur: .6, vol: .12 }]);
A.define('sks_echofade', { wave: 'triangle', freq: 330, arp: [24, 19, 12, 7, 0], step: .08, dur: .5, vol: .12, vib: [6, .03] });
A.define('sks_warcry', [{ wave: 'saw', freq: 190, to: 130, dur: .7, vol: .2, vib: [17, .09] }, { wave: 'square', freq: 290, to: 200, dur: .55, vol: .08, vib: [23, .07] }, { wave: 'noise', freq: 1100, to: 280, dur: .6, vol: .26, filter: 'lowpass' }]);
A.define('sks_vanish', [{ wave: 'noise', freq: 3400, to: 300, dur: .22, vol: .26 }, { wave: 'sine', freq: 700, to: 140, dur: .16, vol: .16 }]);
A.define('sks_appear', [{ wave: 'noise', freq: 300, to: 3800, dur: .12, vol: .22 }, { wave: 'sine', freq: 180, to: 900, dur: .1, vol: .14 }]);

/* ---------- shared helpers ---------- */
const SKS_V = E.V3, SKS_LIGHT = SKS_V.norm([-.45, -.55, .7]);   // the scene's key light: upper left, above
const SKS_SMEAR = { frost: ['#ffffff', '#e8fbff', '#9fe6ff', '#4bb1d4'], ghost: ['#ffffff', '#c8fbff', '#6fe0ff', '#2a8ab0'], shadow: ['#f4e8ff', '#c890ff', '#7a40c0', '#2a1040'] };
const SKS_SMOKE = { size: 4.2, color: '#6a5088', dark: '#3a2458', light: '#a488c8' };   // violet smoke for the shadow step
const SKS_ICE = E.tones('#8fdfff'), SKS_BLADE = E.tones('#8fe8ff'), SKS_ICEBITS = ['#ffffff', '#bfefff', '#7fd8ff', '#4bb1d4'];
const SKS_I = v => Math.max(1, Math.round(v));   // whole-pixel sizes for px.rect / px.line widths
const SKS_cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** '85%' of weapon damage at a rank (heroHit's rank bonus included) */
const SKS_pc = (scale, rank) => Math.round(scale * 100 * (1 + Math.max(0, rank - 1) * .12)) + '%';
/** the tone of a face with world normal n under the key light */
const SKS_tone = (T, n) => { const l = SKS_V.dot(n, SKS_LIGHT); return l > .62 ? T.hi : l > .3 ? T.lt : l > -.05 ? T.base : l > -.4 ? T.sh : T.deep; };
/** run fn after t seconds of level time (an FX, so it goes away with the level) */
function SKS_later(t, fn) { const f = addFx({ kind: 'sksLater', t: 0, update(dt) { if ((f.t += dt) < t) return true; fn(); return false; } }); return f; }
/** the cursor, clamped to a range from the hero (min .. range) */
function SKS_aimPt(h, ctx, range, min = 0) {
  const tx = ctx.tx === undefined ? h.x + Math.cos(h.aim) * 60 : ctx.tx, ty = ctx.ty === undefined ? h.y + Math.sin(h.aim) * 60 : ctx.ty;
  const d = Math.hypot(tx - h.x, ty - h.y), a = d > 2 ? Math.atan2(ty - h.y, tx - h.x) : h.aim, k = clamp(d, min, range);
  return [h.x + Math.cos(a) * k, h.y + Math.sin(a) * k];
}
/** the farthest point toward (x1, y1) that is never inside a wall: the march stops at the first wall and lands on
 *  walkable floor (a pit or deep water on the way may be crossed, but never ended in) */
function SKS_reach(x0, y0, x1, y1) {
  const m = ED.L && ED.L.map; if (!m) return [x1, y1];
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 3)); let bx = x0, by = y0;
  for (let i = 1; i <= n; i++) {
    const x = lerp(x0, x1, i / n), y = lerp(y0, y1, i / n);
    if (m.solidAt(x, y)) break;
    if (m.walkable(Math.floor(x / 16), Math.floor(y / 16))) { bx = x; by = y; }
  }
  return [bx, by];
}
/** a burst of ice: shards, glints and a puff of cold mist */
function SKS_iceBurst(x, y, z, k = 1) {
  P.bits(x, y, z, Math.round(10 * k), SKS_ICEBITS); P.glints(x, y, z, Math.round(4 * k), '#e8fbff', 10 * k);
  P.smoke(x, y, Math.max(0, z - 4), Math.round(2 * k), { size: 3.5 * k, color: '#cfeaf6', dark: '#9ac4dc', light: '#f4fcff' });
}

/**
 * A faceted ice crystal, drawn inside a queue callback: a three-sided spike at (x, y, z), height H, base radius w,
 * leaning toward ang by lean (share of H), turned by rot. Only faces toward the camera are drawn, far first, each
 * shaded by its normal under the key light and outlined in the deepest tone.
 */
function SKS_crystal(r, g, x, y, z, H, w, ang, lean, rot, T = SKS_ICE) {
  if (H < .6) return;
  const v = r.view, ap = [x + Math.cos(ang) * lean * H, y + Math.sin(ang) * lean * H, z + H], faces = [];
  const b = [0, 1, 2].map(k => { const a = rot + k * TAU / 3; return [x + Math.cos(a) * w, y + Math.sin(a) * w, z]; });
  for (let k = 0; k < 3; k++) {
    const p0 = b[k], p1 = b[(k + 1) % 3], c = [(p0[0] + p1[0] + ap[0]) / 3, (p0[1] + p1[1] + ap[1]) / 3, (p0[2] + p1[2] + ap[2]) / 3];
    let n = SKS_V.norm(SKS_cross(SKS_V.sub(p1, p0), SKS_V.sub(ap, p0))); if ((c[0] - x) * n[0] + (c[1] - y) * n[1] < 0) n = SKS_V.mul(n, -1);
    if (n[0] * v.dx + n[1] * v.dy + n[2] * v.dz <= 0) continue;
    faces.push({ pts: [r.w(p0[0], p0[1], p0[2]), r.w(p1[0], p1[1], p1[2]), r.w(ap[0], ap[1], ap[2])], col: SKS_tone(T, n), d: v.depth(c[0], c[1], c[2]) });
  }
  faces.sort((p, q) => p.d - q.d);
  for (const f of faces) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) px.poly(g, f.pts.map(p => [p[0] + dx, p[1] + dy]), T.deep);
  for (const f of faces) px.poly(g, f.pts, f.col);
  if (faces.length) { const t = faces[faces.length - 1].pts[2]; px.dot(g, t[0], t[1], '#ffffff'); }
}

/* ---------- frozen: a translucent ice shell grows around the monster, glints, and bursts when it thaws ---------- */
function SKS_ice(m) {
  if (!m || !m.alive || !m.st || !m.st.freeze || m.boss || (m.sksIce && ED.fx.includes(m.sksIce))) return;   // one shell per monster (the handle goes stale if a level clears its effects)
  const s = m.scale || 1, R0 = (m.r + 1.4) * s, H0 = Math.max(8, (m.head || 20) * s * .84), seed = Math.random() * 100;
  const J = [0, 1, 2, 3, 4, 5].map(k => [.82 + .3 * E.hash2(k, seed | 0), .88 + .22 * E.hash2(k + 9, seed | 0)]);
  const f = m.sksIce = addFx({ kind: 'sksIce', t: 0, update(dt) {
    f.t += dt;
    if (!m.alive || !m.st.freeze) { m.sksIce = null; SKS_iceBurst(m.x, m.y, (m.z || 0) + H0 * .5, m.alive ? 1 : 1.6); sfx('sks_shatter', { vol: m.alive ? .3 : .5 }); return false; }
    if (Math.random() < dt * 2) P.glints(m.x + (Math.random() - .5) * R0, m.y, (m.z || 0) + Math.random() * H0, 1, '#ffffff', 4);
    return true;
  }, draw(r) {
    if (!m.alive || !m.st.freeze || !r.visible(m.x, m.y, m.z || 0, 40, 40, 60)) return;
    const grow = E.ease.outBack(clamp(f.t / .14, 0, 1)), v = r.view, z0 = Math.max(0, (m.z || 0) - 1.5);
    r.decal(() => r.groundDisc(m.x, m.y, R0 * 1.25 * grow, '#dff6ff', .35, 0), { emissive: .2 });
    r.queue(m.x, m.y, m.z || 0, g => {
      const bot = [], top = [];
      for (let k = 0; k < 6; k++) { const a = seed + k * TAU / 6; bot.push([m.x + Math.cos(a) * R0 * J[k][0] * grow, m.y + Math.sin(a) * R0 * J[k][0] * grow, z0]); top.push([m.x + Math.cos(a) * R0 * .72 * J[k][0] * grow, m.y + Math.sin(a) * R0 * .72 * J[k][0] * grow, z0 + H0 * J[k][1] * grow]); }
      const W = p => r.w(p[0], p[1], p[2]), faces = [];
      for (let k = 0; k < 6; k++) {
        const k2 = (k + 1) % 6, mx = (bot[k][0] + bot[k2][0]) / 2 - m.x, my = (bot[k][1] + bot[k2][1]) / 2 - m.y, l = Math.hypot(mx, my) || 1, n = [mx / l * .92, my / l * .92, .38];
        if (n[0] * v.dx + n[1] * v.dy + n[2] * v.dz <= 0) continue;
        faces.push({ pts: [W(bot[k]), W(bot[k2]), W(top[k2]), W(top[k])], col: SKS_tone(SKS_ICE, n) });
      }
      px.glow(g, .5);
      px.blend(g, .28, 'normal', () => { for (const fc of faces) px.poly(g, fc.pts, fc.col); });   // clear ice: the frozen body shows through
      px.blend(g, .42, 'normal', () => px.poly(g, top.map(W), SKS_ICE.hi));
      for (const fc of faces) {   // crisp edges carry the shape: dark foot, lit vertical edges, a white rim
        px.line(g, fc.pts[0][0], fc.pts[0][1], fc.pts[1][0], fc.pts[1][1], SKS_ICE.sh);
        px.line(g, fc.pts[1][0], fc.pts[1][1], fc.pts[2][0], fc.pts[2][1], fc.col === SKS_ICE.hi || fc.col === SKS_ICE.lt ? '#ffffff' : SKS_ICE.lt);
        px.line(g, fc.pts[0][0], fc.pts[0][1], fc.pts[3][0], fc.pts[3][1], SKS_ICE.lt);
      }
      const tp = top.map(W); for (let k = 0; k < 6; k++) { const q = tp[(k + 1) % 6]; px.line(g, tp[k][0], tp[k][1], q[0], q[1], '#ffffff'); }
      if (faces.length) { const fc = faces[0], sh = (f.t * .6 + seed) % 1.8; px.blend(g, .8, 'normal', () => px.line(g, lerp(fc.pts[0][0], fc.pts[1][0], .3), lerp(fc.pts[0][1], fc.pts[1][1], .3) - 1, lerp(fc.pts[3][0], fc.pts[2][0], .5), lerp(fc.pts[3][1], fc.pts[2][1], .5) + 1, '#ffffff')); if (sh < 1) { const a0 = fc.pts[0], a3 = fc.pts[3]; px.dot(g, lerp(a0[0], a3[0], sh) + 1, lerp(a0[1], a3[1], sh), '#ffffff'); } }   // a streak of shine, a glint crawling up
      for (let k = 0; k < 3; k++) { const q = top[k * 2], a = seed + k * 2 * TAU / 6; SKS_crystal(r, g, q[0], q[1], q[2] - 2, (2.5 + 2.5 * J[k][1]) * grow * s, 1.2 * s, a, .45, a + 1); }
    }, { bias: .06, emissive: false });
  } });
}

/* ---------- afraid: the monster turns and runs, and a little skull shivers over its head ---------- */
// (the core flee step points away from the hero but AI.move flips feared speed again, so the velocity is set here too)
function SKS_fear(m, t) {
  if (!m || !m.alive || m.boss || !m.st || (m.arch && (m.arch.tags || []).includes('object'))) return;   // things (training dummies) know no fear
  applyStatus(m, 'fear', 0, ED.hero); if (!m.st.fear) return;
  m.st.fear.t = Math.max(m.st.fear.t, t); m.atk = null; m.tok = false; if (m.ai && m.ai.state === 'wind') { m.ai.state = 'idle'; m.ai.t = .3; }
  if (m.sksFear && ED.fx.includes(m.sksFear)) return;
  const f = m.sksFear = addFx({ kind: 'sksFear', t: 0, update(dt) {
    f.t += dt; const h = ED.hero;
    if (!m.alive || !m.st.fear || !h) { m.sksFear = null; return false; }
    if (!(m.st.freeze || m.st.stun || m.kbT > 0 || m.air || m.spawnT > 0)) {
      const a = Math.atan2(m.y - h.y, m.x - h.x) + Math.sin(f.t * 3 + m.x) * .35, sp = m.speed * 1.2 * statusSpeed(m);
      m.vx = Math.cos(a) * sp; m.vy = Math.sin(a) * sp; m.facing = E.approachAng(m.facing, a, dt * 10);
    }
    if (Math.random() < dt * 3) P.add({ kind: 'bit', x: m.x, y: m.y, z: (m.z || 0) + (m.head || 20) * (m.scale || 1) * .9, vx: (Math.random() - .5) * 30, vy: (Math.random() - .5) * 30, vz: 40, g: 260, max: .45, color: '#9fd8ff' });   // cold sweat
    return true;
  }, draw(r) {
    if (!m.alive || !m.st.fear) return;
    const zm = r.view.zoom || 1, hd = (m.head || 20) * (m.scale || 1), bar = OPT.bars && !m.boss && (m.elite || m.hp < m.maxHp), z = (m.z || 0) + (bar ? hd * zm + 4 : hd + 2), pop = E.ease.outBack(Math.min(1, f.t / .18));
    if (!r.visible(m.x, m.y, z, 20, 20, 20)) return;
    r.queue(m.x, m.y, z, g => {   // a little bone-white skull that shivers just over the head (or over the health bar when it shows): fright, not a wisp
      const [x0, y0] = r.w(m.x, m.y, z), x = Math.round(x0 + Math.sin(f.t * 38) * zm * .7), y = Math.round(y0 - (bar ? 6 : 4) * zm - Math.abs(Math.sin(f.t * 7)) * 2 * zm), k = zm * pop, o = '#1a0c24';
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { px.disc(g, x + dx, y + dy, 2.4 * k, o); px.rect(g, x - 1.4 * k + dx, y + 1.2 * k + dy, SKS_I(2.9 * k), SKS_I(1.8 * k), o); }
      px.disc(g, x, y, 2.4 * k, '#d8d0e8'); px.disc(g, x - .5, y - .5, 1.7 * k, '#f8f4ff'); px.rect(g, x - 1.4 * k, y + 1.2 * k, SKS_I(2.9 * k), SKS_I(1.8 * k), '#c8bcdc');
      px.rect(g, x - 1.4 * k, y - .2 * k, SKS_I(k), SKS_I(1.2 * k), o); px.rect(g, x + .5 * k, y - .2 * k, SKS_I(k), SKS_I(1.2 * k), o); px.dot(g, x, y + 2 * k, o);
      if (Math.sin(f.t * 9) > 0) { px.line(g, x - 4 * k, y - 2 * k, x - 5.5 * k, y - 3.5 * k, '#b8a8ff'); px.line(g, x + 4 * k, y - 2 * k, x + 5.5 * k, y - 3.5 * k, '#b8a8ff'); }   // shiver marks
    }, { emissive: true, bias: 1 });
  } });
}

/* ---------- pictograms (16x16 at s = 1) ---------- */
const SKS_ICON = {
  frost(g, x, y, s) {
    const cx = x + 8 * s, cy = y + 8 * s, w = SKS_I(s);
    for (let k = 0; k < 3; k++) {
      const a = k * Math.PI / 3 + Math.PI / 2, dx = Math.cos(a) * 6 * s, dy = Math.sin(a) * 6 * s;
      px.line(g, cx - dx + s, cy - dy + s, cx + dx + s, cy + dy + s, '#10284a', w);
      px.line(g, cx - dx, cy - dy, cx + dx, cy + dy, '#9fe6ff', w);
      for (const sg of [-1, 1]) { const ex = cx + dx * sg * .62, ey = cy + dy * sg * .62, ba = a + (sg < 0 ? Math.PI : 0); for (const b of [-.95, .95]) px.line(g, ex, ey, ex + Math.cos(ba + b) * 2.2 * s, ey + Math.sin(ba + b) * 2.2 * s, '#e8fbff', w); }
    }
    px.disc(g, cx, cy, 1.6 * s, '#ffffff'); px.dot(g, cx, cy, '#7fd8ff');
  },
  chain(g, x, y, s) {
    const w = SKS_I(s), P0 = [[2.5, 13], [7.5, 4], [10.5, 11], [14, 4.5]].map(([a, b]) => [x + a * s, y + b * s]);
    for (let i = 0; i < 3; i++) { const [a0, b0] = P0[i], [a1, b1] = P0[i + 1], mx = (a0 + a1) / 2 + (i % 2 ? 1.6 : -1.6) * s, my = (b0 + b1) / 2 + .8 * s; for (const [c, ww] of [['#b08a1a', w + 1], ['#ffe45a', w], ['#ffffff', 1]]) { px.line(g, a0, b0, mx, my, c, ww); px.line(g, mx, my, a1, b1, c, ww); } }
    for (const [a, b] of P0.slice(1)) { px.disc(g, a, b, 1.9 * s, '#2a1018'); px.disc(g, a - .4 * s, b - .4 * s, 1.2 * s, '#d06a5a'); px.dot(g, a - .8 * s, b - .8 * s, '#ffd0c0'); }
    px.disc(g, P0[0][0], P0[0][1], 2 * s, '#6a4128'); px.disc(g, P0[0][0] - .3 * s, P0[0][1] - .3 * s, 1.4 * s, '#f1c7a0');
  },
  meteor(g, x, y, s) {
    px.poly(g, [[x + 1 * s, y + 1 * s], [x + 13 * s, y + 8 * s], [x + 8 * s, y + 13 * s]], '#b83a1a');
    px.poly(g, [[x + 3.5 * s, y + 3.5 * s], [x + 12.5 * s, y + 9 * s], [x + 9 * s, y + 12.5 * s]], '#ff8a3a');
    px.poly(g, [[x + 6.5 * s, y + 6.5 * s], [x + 12 * s, y + 10 * s], [x + 10 * s, y + 12 * s]], '#ffe070');
    px.disc(g, x + 11 * s, y + 11 * s, 3.5 * s, '#24140e'); px.disc(g, x + 10.6 * s, y + 10.6 * s, 2.7 * s, '#6a4030'); px.disc(g, x + 10 * s, y + 10 * s, 1.3 * s, '#a0704a');
    px.dot(g, x + 12.5 * s, y + 12 * s, '#ffd36a'); px.dot(g, x + 11 * s, y + 13 * s, '#ff8a3a');
  },
  rift(g, x, y, s) {   // three arms spiralling into a slit of night
    const cx = x + 8 * s, cy = y + 8 * s, w = SKS_I(s);
    for (let arm = 0; arm < 3; arm++) { let lx = cx, ly = cy; for (let i = 1; i <= 14; i++) { const u = i / 14, a = arm * TAU / 3 + u * 4.2, rr = u * 6.9 * s, nx = cx + Math.cos(a) * rr, ny = cy + Math.sin(a) * rr * .85; px.line(g, lx, ly, nx, ny, u < .35 ? '#ffffff' : u < .7 ? '#d8b0ff' : '#9a60e0', w); lx = nx; ly = ny; } }
    px.ell(g, cx, cy, 2.5 * s, 4.8 * s, '#3a1a6a'); px.ell(g, cx, cy, 2 * s, 4.3 * s, '#ecd8ff'); px.ell(g, cx, cy, 1.1 * s, 3.5 * s, '#0a0412'); px.dot(g, cx, cy - s, '#b070ff');
  },
  blades(g, x, y, s) {
    const cx = x + 8 * s, cy = y + 8.5 * s, w = SKS_I(s);
    for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; px.dot(g, cx + Math.cos(a) * 6 * s, cy + Math.sin(a) * 5 * s, i % 2 ? '#2a6a8a' : '#4fb0d0'); }
    for (let k = 0; k < 3; k++) {
      const a = k * TAU / 3 - Math.PI / 2, ox = cx + Math.cos(a) * 5.4 * s, oy = cy + Math.sin(a) * 4.5 * s, ta = a + Math.PI / 2, dx = Math.cos(ta), dy = Math.sin(ta);
      px.line(g, ox - dx * 3 * s + s, oy - dy * 3 * s + s, ox + dx * 3.6 * s + s, oy + dy * 3.6 * s + s, '#0e3050', w + 1);
      px.line(g, ox - dx * 3 * s, oy - dy * 3 * s, ox + dx * 3.6 * s, oy + dy * 3.6 * s, '#bff4ff', w); px.dot(g, ox + dx * 3.6 * s, oy + dy * 3.6 * s, '#ffffff');
      px.line(g, ox - dx * 1.6 * s - dy * 1.4 * s, oy - dy * 1.6 * s + dx * 1.4 * s, ox - dx * 1.6 * s + dy * 1.4 * s, oy - dy * 1.6 * s - dx * 1.4 * s, '#ffe9a0', w);
    }
  },
  echo(g, x, y, s) {
    const fig = (ox, c1, c2, c3) => { px.poly(g, [[x + (ox - 3) * s, y + 15 * s], [x + (ox - 2.2) * s, y + 7.5 * s], [x + (ox + 2.2) * s, y + 7.5 * s], [x + (ox + 3) * s, y + 15 * s]], c2); px.disc(g, x + ox * s, y + 5 * s, 2.4 * s, c1); px.disc(g, x + (ox - .6) * s, y + 3.8 * s, 1.6 * s, c3); };
    fig(10.5, '#bff8ff', '#3fb0e0', '#e8ffff'); px.dot(g, x + 11.3 * s, y + 5 * s, '#ffffff');
    fig(6, '#f1c7a0', '#2f8f86', '#2e2230'); px.line(g, x + 2 * s, y + 2 * s, x + 2 * s, y + 12 * s, '#dce8f1', SKS_I(s)); px.line(g, x + .8 * s, y + 10 * s, x + 3.2 * s, y + 10 * s, '#e8b04e');
  },
  cry(g, x, y, s) {
    const cx = x + 7.5 * s, cy = y + 8.5 * s, w = SKS_I(s);
    px.disc(g, cx, cy, 4.6 * s, '#6a3a2a'); px.disc(g, cx - .4 * s, cy - .4 * s, 4 * s, '#f1c7a0'); px.disc(g, cx, cy - 3.4 * s, 3 * s, '#2e2230');
    px.line(g, cx - 3 * s, cy - 1.6 * s, cx - 1 * s, cy - .8 * s, '#2e2230', w); px.line(g, cx + 3 * s, cy - 1.6 * s, cx + 1 * s, cy - .8 * s, '#2e2230', w);
    px.ell(g, cx, cy + 2 * s, 1.6 * s, 1.8 * s, '#4a1418'); px.rect(g, cx - 1 * s, cy + 2.6 * s, SKS_I(2 * s), SKS_I(s * .8), '#d83a3a');
    for (const sd of [-1, 1]) for (let k = 0; k < 2; k++) { const R = (6 + k * 2) * s; for (let i = -2; i <= 2; i++) { const a = (sd > 0 ? 0 : Math.PI) + i * .22; px.dot(g, cx + Math.cos(a) * R, cy + 1 * s + Math.sin(a) * R, k ? '#ff9a4a' : '#ffe070'); } }
  },
  blink(g, x, y, s) {   // he lunges out of two fading shadows, rimmed in violet, smoke at his heels
    const fig = (ox, oy, c) => { px.disc(g, x + (ox + .8) * s, y + (4.3 + oy) * s, 2.1 * s, c); px.poly(g, [[x + (ox - 2.8) * s, y + (13.5 + oy) * s], [x + (ox - 1.4) * s, y + (6.8 + oy) * s], [x + (ox + 2.6) * s, y + (6.6 + oy) * s], [x + (ox + 3.6) * s, y + (13.5 + oy) * s]], c); };
    fig(3.2, 0, '#3a2060'); fig(6.6, 0, '#5a3a90');
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) fig(10.8 + dx * .9, dy * .9, '#d8b0ff');
    fig(10.8, 0, '#120a1e'); px.dot(g, x + 12.2 * s, y + 4 * s, '#f4e8ff');
    for (const yy of [5.5, 9, 12]) px.line(g, x + .8 * s, y + yy * s, x + 3 * s, y + yy * s, '#c890ff');
    for (const [a, b, r0] of [[7.5, 14.6, 1.3], [10, 15, 1.6], [13.5, 14.8, 1.4]]) px.disc(g, x + a * s, y + b * s, r0 * s, '#a488c8');
  }
};

/* =============================================================================
 * FROST NOVA: both hands raise the sword and drive it point-first into the floor; the ring bursts from the blade
 * ============================================================================= */
const SKS_SLAM = { name: 'frostslam', rel: true, hand: 'both', plane: 'side', a0: 2.3, a1: -1.3, reach: 6.4, wind: .24, active: .08, recover: .46, hold: .6, lunge: .5, crouch: .15, hop: 3, lean: .5, hitAt: 0 };
/** a ring of ice crystals that erupts just behind an expanding front (radius R over dur, ease out), holds, then breaks */
function SKS_spikeRing(x, y, R, dur, life = .9) {
  const S = [], m = ED.L && ED.L.map;
  for (const [k0, k1, dn] of [[.28, .55, .32], [.62, .96, .44]]) {
    const n = Math.max(6, Math.round(R * dn));
    for (let i = 0; i < n; i++) {
      const a = (i + Math.random() * .7) / n * TAU, d = R * lerp(k0, k1, Math.random()), sx = x + Math.cos(a) * d, sy = y + Math.sin(a) * d;
      if (m && m.solidAt(sx, sy)) continue;
      S.push({ x: sx, y: sy, a, H: (5 + Math.random() * 6) * (.6 + d / R * .7), w: 1.7 + Math.random() * 1.3, rot: Math.random() * TAU, lean: .15 + Math.random() * .35, born: dur * (1 - Math.sqrt(Math.max(0, 1 - d / R))), end: life * (.8 + Math.random() * .4), broke: false });
    }
  }
  const f = addFx({ kind: 'sksSpikes', t: 0, x, y, S, update(dt) {
    f.t += dt; let live = false;
    for (const s of S) { const age = f.t - s.born; if (!s.broke && age > s.end) { s.broke = true; P.bits(s.x, s.y, s.H * .5, 2, SKS_ICEBITS); if (Math.random() < .3) P.glints(s.x, s.y, s.H * .6, 1, '#ffffff', 4); } if (age < s.end + .2) live = true; }
    if (f.t > dur && !f.snd && S.some(s => s.broke)) { f.snd = true; sfx('sks_shatter', { vol: .35 }); }
    return live;
  }, draw(r) {
    for (const s of S) {
      const age = f.t - s.born; if (age <= 0) continue;
      const grow = age < .07 ? age / .07 * 1.25 : age < .13 ? 1.25 - (age - .07) / .06 * .25 : 1, k = s.broke ? clamp(1 - (age - s.end) / .2, 0, 1) : 1, H = s.H * grow * k;
      if (H < .6 || !r.visible(s.x, s.y, 0, 24, 24, 24)) continue;
      r.queue(s.x, s.y, 0, g => { px.glow(g, .45); SKS_crystal(r, g, s.x, s.y, 0, H, s.w * Math.min(1, grow) * (.5 + .5 * k), s.a, s.lean, s.rot); });
    }
  } });
  return f;
}
/** frost on the floor: a pale bloom with cracks of rime running out from the centre, fading over dur */
function SKS_rime(x, y, R, dur) {
  const K = []; for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + Math.random() * .5, pts = [[0, 0]]; let px0 = 0, py0 = 0, an = a; for (let j = 0; j < 4; j++) { an += (Math.random() - .5) * .9; const l = R * (.2 + Math.random() * .16); px0 += Math.cos(an) * l; py0 += Math.sin(an) * l; pts.push([px0, py0]); } K.push(pts); }
  return FX.visual(dur, (r, u) => {
    const a = Math.min(1, (1 - u) * 3);
    r.decal(() => {
      r.groundDisc(x, y, R, '#7fc4e4', .22 * a); r.groundDisc(x, y, R * .55, '#bfe8f8', .25 * a);
      const g = r.tgt; px.blend(g, .7 * a, 'normal', () => { for (const pts of K) for (let j = 1; j < pts.length; j++) { const p0 = r.w(x + pts[j - 1][0], y + pts[j - 1][1], 0), p1 = r.w(x + pts[j][0], y + pts[j][1], 0); px.line(g, p0[0], p0[1], p1[0], p1[1], j < 2 ? '#ffffff' : '#cfeeff'); } });
    }, { emissive: .3 * a });
  });
}
function SKS_nova(h, ctx, x, y, R) {
  const frz = 1.4 + .1 * ctx.rank, seen = new Set(), frozen = [];
  shake(4); game.freeze(.06); game.flash('#bfefff', .12, .3); sfx('sks_frost');
  FX.nova({ team: 'hero', src: h, x, y, r0: 6, r1: R, dur: .34, el: 'frost', color: '#9fe6ff', hit: ctx.hit(.85, { kb: 110, extra: { status: 'chill', statusChance: 1, statusPower: 4 } }),
    onTick(f) { for (const u of f.set) if (!seen.has(u)) { seen.add(u); if (!u.st || !u.alive) continue; if (u.st.freeze) { u.st.freeze.t = Math.max(u.st.freeze.t, frz); SKS_ice(u); frozen.push(u); } P.glints(u.x, u.y, 10, 2, '#e8fbff', 10); } } });
  SKS_spikeRing(x, y, R, .34, ctx.rune === 'shatter' ? .8 : 1);
  P.bits(x, y, 4, 14, SKS_ICEBITS); P.glints(x, y, 6, 8, '#e8fbff', 16);
  for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; P.add({ kind: 'dust', x: x + Math.cos(a) * 5, y: y + Math.sin(a) * 5, z: 1, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, vz: 6, drag: 4.5, max: .45, size: 1.7, color: '#bfe2f2' }); }   // cold mist blown out by the ring
  SKS_rime(x, y, R * .55, 3.5);
  FX.visual(.55, (r, u) => { L.add(x, y, 8, R + 40, 1.8 * (1 - u) * (1 - u), { color: '#a8ecff' }); if (u < .16) r.decal(() => r.groundDisc(x, y, R * (.25 + u * 3), '#ffffff', .25 * (1 - u / .16)), { emissive: 1 }); });
  if (ctx.rune === 'shatter') SKS_later(.85, () => {
    let n = 0;
    for (const u of frozen) if (u.alive && u.st && u.st.freeze) { n++; delete u.st.freeze; dealDamage(u, ctx.hit(1.3, { kb: 120, extra: { ang: Math.atan2(u.y - y, u.x - x), up: 60 } })); SKS_iceBurst(u.x, u.y, (u.z || 0) + 10, 2); SKS_spikeRing(u.x, u.y, 12, .08, .35); }
    if (n) { sfx('sks_shatter'); sfx('crack', { vol: .6 }); shake(3 + Math.min(4, n * .5)); game.freeze(.05); FX.visual(.3, (r, uu) => L.add(x, y, 8, R + 30, 1.2 * (1 - uu), { color: '#e8fbff' })); }
  });
  if (ctx.rune === 'rime') {
    FX.area({ team: 'hero', src: h, x, y, r: R * .8, dur: 4, tick: .5, el: 'frost', color: '#9fe6ff', hit: ctx.hit(.1, { extra: { status: 'chill', statusChance: 1, statusPower: 0 } }), onTick(f) { eachEnemy('hero', f.x, f.y, f.r, u => { if (u.st && u.st.freeze) SKS_ice(u); }); } });
    const C = [], m = ED.L && ED.L.map; for (let i = 0; i < 9; i++) { const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * R * .7, cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d; if (!(m && m.solidAt(cx, cy))) C.push([cx, cy, a, 2 + Math.random() * 3, Math.random() * TAU]); }   // rime crystals sprout across the field
    FX.visual(4, (r, u) => { const k = Math.min(1, u * 20, (1 - u) * 8); for (const [cx, cy, a, H, rot] of C) r.queue(cx, cy, 0, g => SKS_crystal(r, g, cx, cy, 0, H * k, 1.2, a, .3, rot)); });
  }
}
def('skills', 'frostnova', {
  name: 'Frost Nova', kind: 'core', tags: ['spell', 'aoe'], el: 'frost', cost: 22, cd: 6, unlock: 3, range: 45, color: '#1f4a7a',   // range: how close the autopilot wants the pack
  runes: [{ id: 'shatter', name: 'Shattering Nova', desc: 'A moment later every enemy still frozen bursts apart in a spray of ice for heavy damage.' },
    { id: 'rime', name: 'Rime Field', desc: 'The ring leaves a field of rime for 4 seconds that keeps chilling, and freezes again whoever stays.' }],
  desc: (rank, rune) => 'Raise the sword in both hands and drive it into the floor: a ring of ice spikes bursts out for ' + SKS_pc(.85, rank) + ' weapon damage as Frost and freezes enemies solid for ' + (1.4 + .1 * rank).toFixed(1) + ' seconds.' +
    (rune === 'shatter' ? ' Frozen enemies then shatter for ' + SKS_pc(1.3, rank) + '.' : rune === 'rime' ? ' A rime field lingers for 4 seconds.' : ''),
  icon: (g, x, y, s) => SKS_ICON.frost(g, x, y, s),
  cast(h, ctx) {
    const atk = new E.Attack(Object.assign({}, SKS_SLAM)); atk.start(); h.facing = h.aim; sfx('sks_gather');
    const R = 50 * ctx.area * (1 + .03 * (ctx.rank - 1));
    return { name: 'frostnova', atk, moveK: .12, face: h.aim, cancel: true, speed: h.castMul, rig: { attack: null, expr: 'angry' }, free: false, smear: SKS_SMEAR.frost,   // the ribbon rides on the action: the hero's own smear is never touched
      update(dt) {
        this.t += dt; const began = atk.update(dt), st = atk.state; this.rig.attack = st;
        if (st && st.phase === 'wind' && Math.random() < .8) { const [bx, by, bz] = h.rig.tip(), a = Math.random() * TAU, d = 7 + Math.random() * 7; P.add({ kind: 'dust', x: bx + Math.cos(a) * d, y: by + Math.sin(a) * d, z: bz + (Math.random() - .5) * 8, vx: -Math.cos(a) * d * 6, vy: -Math.sin(a) * d * 6, drag: 3, max: .2, size: 1.1, color: '#dff8ff' }); }
        if (began === 'recover') { this.rig.expr = 'shout'; this.rig.pose = 'kneel'; h.rig.kick(-5); const [tx, ty] = h.rig.tip(), [x, y] = SKS_reach(h.x, h.y, tx, ty); SKS_nova(h, ctx, x, y, R); }
        if (st && st.phase === 'recover' && st.u > .5) { this.rig.pose = null; this.rig.expr = null; }   // down on one knee with the blade in the floor, then up
        this.free = !st || (st.phase === 'recover' && st.u > .45);
        return atk.busy;
      },
      draw(r) {   // frost gathers on the blade during the wind-up
        const st = atk.state; if (!st || st.phase !== 'wind') return;
        const [bx, by, bz] = h.rig.tip(), k = st.u;
        r.queue(bx, by, bz, g => { const [x, y] = r.w(bx, by, bz), zm = r.view.zoom || 1; px.glow(g, 1); r.glowDisc(g, x, y, (4 + 6 * k) * zm, '#7fd8ff', .55); px.disc(g, x, y, (1 + 1.6 * k) * zm, '#e8fbff'); if (k > .5) { px.rect(g, x - 3 * k * zm, y, SKS_I(6 * k * zm) + 1, 1, '#ffffff'); px.rect(g, x, y - 3 * k * zm, 1, SKS_I(6 * k * zm) + 1, '#ffffff'); } }, { emissive: true, bias: .7 });
        L.add(bx, by, bz, 30 + 30 * k, .9 * k, { color: '#a8ecff' });
      } };
  }
});

/* =============================================================================
 * CHAIN LIGHTNING: the free hand draws back crackling, then flings the arc; it hops from enemy to enemy
 * ============================================================================= */
const SKS_ZAP = { name: 'zap', rel: true, hand: 'L', a0: -2.2, a1: .12, z0: 3, z1: -.3, reach: 8.8, wind: .16, active: .06, recover: .26, hold: .5, lunge: 1.3, lean: .35, twist: 1.6, blade: 0, hitAt: 0 };
/** the arcs, one hop every 65 ms: each hop is an FX.chain strike plus a glow layer, forks and an impact */
function SKS_chain(h, ctx, el, hp, first) {
  const fork = ctx.rune === 'fork', max = (fork ? 6 : 3) + Math.floor(ctx.rank / 2) + ctx.chains + ctx.proj, e = EL(el), arcs = [], set = new Set();
  const base = ctx.hit(.95, { el, kb: 45, extra: el === 'fire' ? { status: 'burn', statusChance: 1 } : { statusChance: .6 } });
  let wave = [{ from: { x: hp[0], y: hp[1], z: hp[2] }, to: first, i: 0 }], n = 0;
  const strike = s => {
    const a = s.from.team ? [s.from.x, s.from.y, (s.from.z || 0) + (s.from.head || 20) * .55] : [s.from.x, s.from.y, s.from.z], u = s.to, b = [u.x, u.y, (u.z || 0) + (u.head || 20) * .55];
    FX.chain({ team: 'hero', src: h, from: null, x: a[0], y: a[1], z: a[2], first: u, hops: 1, range: 1, el, hit: Object.assign({}, base, { amount: base.amount * Math.pow(fork ? .84 : .9, s.i) }), set: new Set() });
    arcs.push({ a, b, t: f.t, seed: (Math.random() * 999) | 0 });
    P.impact(b[0], b[1], b[2], 7, e.light); P.sparks(b[0], b[1], b[2], 7, null, { color: e.color, hot: '#ffffff' });
    if (el === 'fire') P.fire(b[0], b[1], b[2] - 4, 3, { size: 3 });
    if (s.i === 0) { game.freeze(.035); shake(2.2); }
  };
  const f = addFx({ kind: 'sksChain', t: 0, next: 0, update(dt) {
    f.t += dt;
    if (wave.length && f.t >= f.next) {
      const cur = wave; wave = []; f.next = f.t + .065;
      for (const s of cur) {
        if (n >= max || !s.to.alive || set.has(s.to)) continue;
        n++; set.add(s.to); strike(s);
        const nb = []; eachEnemy('hero', s.to.x, s.to.y, 92, u => { if (!set.has(u) && u !== s.to) nb.push(u); });
        nb.sort((p, q) => dist2(p, s.to) - dist2(q, s.to));
        for (const u of nb.slice(0, fork ? 2 : 1)) wave.push({ from: s.to, to: u, i: s.i + 1 });
      }
    }
    for (let i = arcs.length - 1; i >= 0; i--) if (f.t - arcs[i].t > .4) arcs.splice(i, 1);
    return wave.length > 0 || arcs.length > 0;
  }, draw(r) {
    for (const A0 of arcs) {
      const age = f.t - A0.t, k = 1 - age / .4, m = [(A0.a[0] + A0.b[0]) / 2, (A0.a[1] + A0.b[1]) / 2, Math.max(A0.a[2], A0.b[2])];
      r.queue(m[0], m[1], m[2], g => {
        const [x0, y0] = r.w(A0.a[0], A0.a[1], A0.a[2]), [x1, y1] = r.w(A0.b[0], A0.b[1], A0.b[2]), zm = r.view.zoom || 1;
        px.glow(g, 1);
        px.blend(g, .3 * k, 'add', () => zig(g, x0, y0, x1, y1, e.color, SKS_I(2.6 * zm), 6, A0.seed));
        if (age < .22) for (let j = 0; j < 2; j++) {   // forking side branches that flicker off the main arc
          const u = .3 + j * .35 + E.hash2(A0.seed, j + Math.floor(game.real * 20)) * .1, bx = lerp(x0, x1, u), by = lerp(y0, y1, u), an = Math.atan2(y1 - y0, x1 - x0) + (j ? 1 : -1) * (.6 + E.hash2(j, A0.seed) * .6), L0 = (6 + 8 * E.hash2(A0.seed, j)) * zm;
          zig(g, bx, by, bx + Math.cos(an) * L0, by + Math.sin(an) * L0, e.light, 1, 3, A0.seed + j);
        }
        if (age < .1) { px.disc(g, x1, y1, 1.8 * zm, '#ffffff'); r.glowDisc(g, x1, y1, 5 * zm, e.color, .5); }
      }, { emissive: true, bias: 2.2 });
      L.add(A0.b[0], A0.b[1], A0.b[2], 46, 1.1 * k, { color: e.glow });
    }
  } });
  return f;
}
/** no one in reach: the arc grounds itself at the cursor in a spray of sparks */
function SKS_fizzle(h, hp, el) {
  const e = EL(el), [x, y] = SKS_reach(h.x, h.y, ...SKS_aimPt(h, { tx: h.tx, ty: h.ty }, 80, 30)), seed = (Math.random() * 999) | 0;
  P.sparks(x, y, 1, 12, null, { color: e.color, hot: '#ffffff' }); P.impact(x, y, 2, 6, e.light); FX.scorch(x, y, 6, '#1a1016', 2.5); sfx('zap', { vol: .6 }); shake(1);
  FX.visual(.3, (r, u) => { r.queue(x, y, 6, g => { const [x0, y0] = r.w(hp[0], hp[1], hp[2]), [x1, y1] = r.w(x, y, 0); px.glow(g, 1); if (u < .6) zig(g, x0, y0, x1, y1, e.color, 2, 6, seed); zig(g, x0, y0, x1, y1, '#ffffff', 1, 6, seed); }, { emissive: true, bias: 2 }); L.add(x, y, 4, 40, 1 - u, { color: e.glow }); });
}
def('skills', 'chainlightning', {
  name: 'Chain Lightning', kind: 'core', tags: ['spell', 'chain'], el: 'storm', cost: 14, unlock: 2, color: '#6a5a10',
  runes: [{ id: 'fork', name: 'Forked Lightning', desc: 'Every enemy struck splits the arc in two: it spreads through a pack like a branching tree.' },
    { id: 'fire', name: 'Chain of Embers', desc: 'The arcs burn instead of shock: Fire damage that sets every target ablaze.' }],
  desc: (rank, rune) => 'Fling lightning from the free hand. It strikes the enemy nearest the cursor for ' + SKS_pc(.95, rank) + ' weapon damage as ' + (rune === 'fire' ? 'Fire' : 'Storm') + ', then hops to ' + ((rune === 'fork' ? 5 : 2) + Math.floor(rank / 2)) + ' more, losing a little each hop.' +
    (rune === 'fork' ? ' Each hop forks in two.' : rune === 'fire' ? ' Every target burns.' : ''),
  icon: (g, x, y, s) => SKS_ICON.chain(g, x, y, s),
  cast(h, ctx) {
    const el = ctx.rune === 'fire' ? 'fire' : 'storm', e = EL(el), atk = new E.Attack(Object.assign({}, SKS_ZAP)); atk.start(); h.facing = h.aim; sfx('sks_crackle');
    return { name: 'chainlightning', atk, moveK: .45, face: h.aim, cancel: true, speed: h.castMul, rig: { attack: null, expr: 'angry' }, free: false,
      update(dt) {
        const began = atk.update(dt), st = atk.state, hp = h.rig.hand('L'); this.rig.attack = st;
        if (st && st.phase === 'wind' && Math.random() < .55) P.sparks(hp[0], hp[1], hp[2], 1, null, { color: e.color, hot: '#ffffff' });
        if (began === 'active') {
          const [ax, ay] = SKS_aimPt(h, ctx, 170);
          let first = nearestEnemy('hero', ax, ay, 36);
          if (!first || Math.hypot(first.x - h.x, first.y - h.y) > 185) first = nearestEnemy('hero', h.x + Math.cos(h.aim) * 45, h.y + Math.sin(h.aim) * 45, 70);
          if (first && ED.L && ED.L.map && !ED.L.map.los(h.x, h.y, first.x, first.y)) first = null;
          if (first) SKS_chain(h, ctx, el, hp, first); else SKS_fizzle(h, hp, el);
          P.glints(hp[0], hp[1], hp[2], 3, e.light, 6); this.flash = .1;
        }
        this.flash = (this.flash || 0) - dt;
        this.free = !st || st.phase === 'recover';
        return atk.busy;
      },
      draw(r) {   // a crackling ball in the palm, a flash as it leaves
        const st = atk.state; if (!st) return;
        const hp = h.rig.hand('L'), k = st.phase === 'wind' ? st.u : this.flash > 0 ? 1.4 : 0; if (k <= 0) return;
        r.queue(hp[0], hp[1], hp[2], g => { const [x, y] = r.w(hp[0], hp[1], hp[2]), zm = r.view.zoom || 1, sd = Math.floor(game.real * 30); px.glow(g, 1); r.glowDisc(g, x, y, (2 + 3 * k) * zm, e.color, .45); px.disc(g, x, y, (.8 + .6 * k) * zm, '#ffffff');
          for (let j = 0; j < 3; j++) { const a = E.hash2(j, sd) * TAU, L0 = (2.5 + 3.5 * k) * zm; zig(g, x, y, x + Math.cos(a) * L0, y + Math.sin(a) * L0, j ? e.color : '#ffffff', 1, 2, sd + j); } }, { emissive: true, bias: .8 });
        L.add(hp[0], hp[1], hp[2], 26 + 24 * k, .8 * Math.min(1, k), { color: e.glow });
      } };
  }
});

/* =============================================================================
 * METEOR: a crouch, then the sword thrust to the sky (the cheer pose, shouting); a pillar of fire answers and a
 * burning rock falls on the cursor
 * ============================================================================= */
/** the falling meteor, drawn in place of FX.meteor's plain fireball (same path: it falls from high up and behind the
 *  target): a chunky faceted rock, white hot on its leading face, trailing three layers of flame and a spray of embers */
function SKS_rockDraw(mfx, x, y, delay, size, el) {
  const T = E.tones(el === 'frost' ? '#8aa8d0' : '#8a5236'), e = EL(el), seed = Math.random() * 9, J = [0, 1, 2, 3, 4, 5].map(i => .72 + .38 * E.hash2(i, (seed * 97) | 0));
  sfx('sks_whistle', { vol: .7 * size });
  return r => {
    const u = Math.min(1, mfx.t / delay), z = 240 * (1 - u) * (1 - u) + 2, mx = x - 60 * (1 - u), my = y - 30 * (1 - u);
    if (Math.random() < .5) P.add({ kind: el === 'fire' ? 'fire' : 'dust', x: mx - 4 * size, y: my - 2 * size, z: z + 7 * size, vx: (Math.random() - .5) * 20, vy: (Math.random() - .5) * 20, vz: 20, g: -10, drag: 3, max: .3, size: 2.6 * size, color: '#dff4ff' });
    if (Math.random() < .5) P.add({ kind: 'ember', x: mx, y: my, z, vx: (Math.random() - .5) * 50, vy: (Math.random() - .5) * 50, vz: 30 + Math.random() * 30, drag: 1, max: .5, color: e.light });
    L.add(mx, my, z, 70 * size, 1, { color: e.glow });
    if (!r.visible(mx, my, z, 60, 60, 60)) return;
    r.queue(mx, my, z, g => {
      const [sx, sy] = r.w(mx, my, z), [tx, ty] = r.w(mx - 16, my - 8, z + 30), zm = r.view.zoom || 1, R = 3.4 * size * zm, l = Math.hypot(tx - sx, ty - sy) || 1, ux = (tx - sx) / l, uy = (ty - sy) / l, nx = -uy, ny = ux, wb = Math.sin(game.time * 47) * R * .25;
      const tail = (len, w, c, a, mode) => px.blend(g, a, mode, () => px.poly(g, [[sx + nx * w, sy + ny * w], [sx + ux * len * .55 + nx * w * .6 + wb, sy + uy * len * .55 + ny * w * .6], [sx + ux * len, sy + uy * len], [sx + ux * len * .55 - nx * w * .6 - wb, sy + uy * len * .55 - ny * w * .6], [sx - nx * w, sy - ny * w], [sx - ux * w * .7, sy - uy * w * .7]], c));
      px.glow(g, 1); r.glowDisc(g, sx, sy, R * 2.6, e.glow, .3);
      tail(R * 7.5, R * 1.3, e.dark, .55, 'normal'); tail(R * 5.5, R * 1.05, e.color, .8, 'add'); tail(R * 3.2, R * .65, e.light, .9, 'add');
      const pts = J.map((k, i) => { const a = i / 6 * TAU + seed + u * 5; return [sx + Math.cos(a) * R * k, sy + Math.sin(a) * R * k]; });
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) px.poly(g, pts.map(p => [p[0] + ox, p[1] + oy]), T.deep);
      px.poly(g, pts, T.sh); px.poly(g, pts.map(p => [lerp(p[0], sx, .28) - .9 * zm, lerp(p[1], sy, .28) - .9 * zm]), T.base); px.poly(g, pts.map(p => [lerp(p[0], sx, .62) - 1.4 * zm, lerp(p[1], sy, .62) - 1.4 * zm]), T.lt);
      for (let i = 0; i < 6; i++) { const p = pts[i], q = pts[(i + 1) % 6]; if ((p[0] + q[0] - 2 * sx) * ux + (p[1] + q[1] - 2 * sy) * uy < 0) px.line(g, p[0], p[1], q[0], q[1], e.light, SKS_I(zm)); }   // the leading faces burn white hot
      const hx = sx - ux * R * .55, hy = sy - uy * R * .55; px.line(g, hx, hy, sx + nx * R * .4, sy + ny * R * .4, e.color); px.line(g, hx, hy, sx - nx * R * .5 + ux * R * .3, sy - ny * R * .5 + uy * R * .3, e.color); px.dot(g, hx, hy, '#ffffff');
    }, { emissive: true, bias: .45 });
  };
}
/** where the rock lands: crater, flying stones, a column of flame or frost, and the light of it */
function SKS_crater(x, y, R, el, size) {
  const e = EL(el), frost = el === 'frost';
  FX.scorch(x, y, R * .85, frost ? '#bfe6f6' : '#140c10', 6); game.freeze(.07 * Math.min(1, size * size)); shake(2 + 2 * size); game.flash(frost ? '#dff8ff' : '#ffd080', .1, .45 * size);   // (a shower's small rocks barely stop time)
  P.bits(x, y, 6, Math.round(12 * size), frost ? SKS_ICEBITS : ['#3a2a24', '#5a3a2e', '#8a5a3a', '#ffb040']);
  if (frost) { SKS_spikeRing(x, y, R * 1.05, .18, 1.2); SKS_iceBurst(x, y, 6, 2 * size); sfx('sks_frost'); }
  for (let i = 0; i < (frost ? 8 : 14) * size; i++) { const a = Math.random() * TAU, sp = 60 + Math.random() * 120; P.add({ kind: frost ? 'dust' : 'fire', x, y, z: 4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 90 + Math.random() * 120, g: 220, drag: 1.5, max: .5 + Math.random() * .4, size: (frost ? 1.4 : 3) * size, color: '#cfeaf6' }); }
  FX.visual(1.3, (r, u) => {
    const k = 1 - u;
    r.decal(() => { r.groundDisc(x, y, R * .55, frost ? '#9fe6ff' : '#ff8a3a', .5 * k * k); r.groundRing(x, y, R * (.3 + u * 1.6), e.light, .8 * k * (u < .5 ? 1 : 0)); }, { emissive: k });
    if (u < .3) r.queue(x, y, 0, g => {   // a tongue of flame (or frost) licks up out of the crater, tapering and wavering
      const q = u / .3, [bx, by] = r.w(x, y, 0), [, ty] = r.w(x, y, (26 + 40 * E.ease.outQuad(q)) * size), zm = r.view.zoom || 1, w0 = (7 - 3 * q) * size * zm, wb = Math.sin(game.time * 40) * 1.5 * zm;
      const tongue = (w, top, c, a) => px.blend(g, a, 'normal', () => px.poly(g, [[bx - w, by], [bx - w * .75 + wb, lerp(by, top, .45)], [bx - w * .3 - wb, lerp(by, top, .8)], [bx + wb, top], [bx + w * .35 + wb, lerp(by, top, .75)], [bx + w * .8 - wb, lerp(by, top, .4)], [bx + w, by]], c));
      px.glow(g, 1); tongue(w0, ty, e.dark, .75 * (1 - q)); tongue(w0 * .7, lerp(by, ty, .85), e.color, .9 * (1 - q)); tongue(w0 * .38, lerp(by, ty, .55), e.light, 1 - q * .7);
    }, { emissive: true, bias: .4 });
    L.add(x, y, 10, R * 2 + 50, 2 * k * k, { color: e.glow });
  });
}
function SKS_callMeteor(h, ctx, x, y, o) {
  const el = o.el, frz = 1.5 + .1 * ctx.rank;
  const mfx = FX.meteor({ team: 'hero', src: h, x, y, r: o.r, delay: o.delay, el, size: o.size, burn: o.burn, hit: ctx.hit(o.dmg, { el, extra: el === 'frost' ? { status: 'chill', statusChance: 1, statusPower: 4 } : { statusChance: .8 } }),
    then: f => { SKS_crater(f.x, f.y, f.r, el, o.size); if (el === 'frost') eachEnemy('hero', f.x, f.y, f.r + 4, u => { if (u.st && u.st.freeze) { u.st.freeze.t = Math.max(u.st.freeze.t, frz); SKS_ice(u); } }); } });
  mfx.draw = SKS_rockDraw(mfx, x, y, o.delay, o.size, el);   // this meteor is drawn as a burning rock (the verb still times, warns and strikes)
}
def('skills', 'meteor', {
  name: 'Meteor', kind: 'ultimate', tags: ['spell', 'aoe'], el: 'fire', cost: 40, cd: 9, unlock: 11, color: '#7a2a10',
  runes: [{ id: 'shower', name: 'Meteor Shower', desc: 'Calls a storm of small meteors over the whole area instead of one great rock.' },
    { id: 'comet', name: 'Frozen Comet', desc: 'A comet of ice falls instead: Frost damage that freezes everything it hits and leaves a frost field.' }],
  desc: (rank, rune) => 'Raise the sword to the sky and call a meteor down on the cursor: ' + (rune === 'shower' ? (6 + Math.floor(rank / 3)) + ' small meteors each deal ' + SKS_pc(1.15, rank) : SKS_pc(3.2, rank)) + ' weapon damage as ' + (rune === 'comet' ? 'Frost' : 'Fire') + ' and hurl enemies into the air.' +
    (rune === 'comet' ? ' Everything struck freezes.' : ' The crater burns for a while.'),
  icon: (g, x, y, s) => SKS_ICON.meteor(g, x, y, s),
  cast(h, ctx) {
    const el = ctx.rune === 'comet' ? 'frost' : 'fire', e = EL(el), [tx, ty] = SKS_aimPt(h, ctx, 170, 20), face = Math.atan2(ty - h.y, tx - h.x);
    h.facing = face;
    return { name: 'meteor', moveK: .1, face, cancel: true, speed: h.castMul, rig: { pose: 'crouch', expr: 'angry' }, free: false, called: 0,
      update(dt) {
        this.t += dt; const t = this.t;
        if (t < .2) { this.rig.pose = 'crouch'; if (Math.random() < .5) P.add({ kind: el === 'fire' ? 'ember' : 'dust', x: h.x + (Math.random() - .5) * 14, y: h.y + (Math.random() - .5) * 14, z: 1, vz: 30, drag: 1, max: .5, size: 1.2, color: e.color }); }
        else if (t < .88) {
          this.rig.pose = 'cheer'; this.rig.expr = 'shout';
          if (!this.called && t >= .3) {   // the pose needs a beat to bring the blade up
            this.called = t; sfx('sks_call'); shake(2); h.rig.kick(3);
            if (ctx.rune === 'shower') { const n = 6 + Math.floor(ctx.rank / 3) + ctx.proj; for (let i = 0; i < n; i++) SKS_later(i * .13, () => { const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * 46 * ctx.area; SKS_callMeteor(h, ctx, tx + Math.cos(a) * d, ty + Math.sin(a) * d, { el, r: 17 * ctx.area, delay: .7, size: .7, burn: 1.2, dmg: 1.15 }); }); }
            else SKS_callMeteor(h, ctx, tx, ty, { el, r: 30 * ctx.area, delay: .85, size: 1.35, burn: el === 'fire' ? 2.5 + .25 * ctx.rank : 3, dmg: 3.2 });
          }
          const tp = h.rig.tip(); if (Math.random() < .6) P.add({ kind: el === 'fire' ? 'ember' : 'glint', x: tp[0], y: tp[1], z: tp[2], vx: (Math.random() - .5) * 20, vy: (Math.random() - .5) * 20, vz: 60 + Math.random() * 40, drag: 1, max: .5, size: 1, color: e.light });
        } else { this.rig.pose = null; this.rig.expr = null; }
        this.free = t > .7;
        return t < 1.02;
      },
      draw(r) {   // the pillar of light from the raised blade into the sky
        if (!this.called) return;
        const age = this.t - this.called; if (age > .45) return;
        const tp = h.rig.tip(), a = 1 - age / .45;
        r.queue(tp[0], tp[1], tp[2], g => {
          const [x, y] = r.w(tp[0], tp[1], tp[2]), [, y2] = r.w(tp[0], tp[1], tp[2] + 300), zm = r.view.zoom || 1, w = (2 + 4 * a) * zm;
          px.glow(g, 1); px.blend(g, .7 * a, 'add', () => { px.rect(g, x - w, y2, SKS_I(w * 2), SKS_I(y - y2), e.color); px.rect(g, x - w * .4, y2, SKS_I(w * .8), SKS_I(y - y2), e.light); });
          r.glowDisc(g, x, y, 10 * zm * a, e.glow, .7); px.disc(g, x, y, 2 * zm, '#ffffff');
        }, { emissive: true, bias: .8 });
        L.add(tp[0], tp[1], tp[2], 90, 1.5 * a, { color: e.glow });
      } };
  }
});

/* =============================================================================
 * VOID RIFT: the free hand tears the air open; a slit of night hangs over the cursor, its spiral drags enemies in,
 * then it snaps shut and implodes, flinging them up together
 * ============================================================================= */
const SKS_TEAR = { name: 'tear', rel: true, hand: 'L', a0: 1.15, a1: -.85, z0: 3.5, z1: .8, reach: 8.6, wind: .2, active: .12, recover: .5, hold: .7, lunge: .9, lean: .25, twist: 1.3, blade: 0, hitAt: 0 };
/** an eye-shaped slit (a lens) in screen space: half-width w, half-height hh */
function SKS_lens(g, x, y, w, hh, c) { if (w < .3 || hh < .5) return; const L0 = [], R0 = [], n = 10; for (let i = 0; i <= n; i++) { const t = i / n, yy = y - hh + 2 * hh * t, hw = w * Math.sin(Math.PI * t); L0.push([x - hw, yy]); R0.unshift([x + hw, yy]); } px.poly(g, L0.concat(R0), c); }
function SKS_rift(h, ctx, x0, y0) {
  const maw = ctx.rune === 'maw', D = maw ? 2.4 : 1.6, R = 60 * ctx.area * (maw ? 1.2 : 1), seed = Math.random() * 9, hit = ctx.hit(.18, { kb: 0 });
  const pull = FX.pull({ team: 'hero', src: h, x: x0, y: y0, r: R, force: 290, dur: D + .05, el: 'void' });
  sfx('sks_rift'); shake(2);
  const f = addFx({ kind: 'sksRift', t: 0, x: x0, y: y0, nt: .25, done: false, update(dt) {
    f.t += dt; pull.x = f.x; pull.y = f.y;
    if (maw && f.t < D - .2) {   // the hungry maw drifts toward the thickest crowd near it
      const tg = nearestEnemy('hero', f.x, f.y, 110);
      if (tg) { const a = Math.atan2(tg.y - f.y, tg.x - f.x), [nx, ny] = SKS_reach(f.x, f.y, f.x + Math.cos(a) * 40 * dt, f.y + Math.sin(a) * 40 * dt); f.x = nx; f.y = ny; }
    }
    if ((f.nt -= dt) <= 0 && f.t < D) { f.nt = .3; hitCircle('hero', f.x, f.y, R * .5, u => Object.assign({}, hit, { ang: Math.atan2(f.y - u.y, f.x - u.x), noNumber: true })); }
    for (let i = 0; i < 2; i++) if (f.t < D && Math.random() < .8) {   // motes spiral in along the arms
      const a = Math.random() * TAU, d = R * (.5 + Math.random() * .5), sp = d * 1.8;
      P.add({ kind: 'ember', x: f.x + Math.cos(a) * d, y: f.y + Math.sin(a) * d, z: 1 + Math.random() * 10, vx: -Math.cos(a) * sp + Math.cos(a + 1.4) * 60, vy: -Math.sin(a) * sp + Math.sin(a + 1.4) * 60, vz: 4, drag: 1.2, max: .55, color: Math.random() < .5 ? '#b070ff' : '#ecd8ff' });
    }
    if (f.t >= D - .16 && !f.snd) { f.snd = true; sfx('sks_implode'); }
    if (f.t >= D && !f.done) { f.done = true; implode(); }
    return f.t < D + .6;
  }, draw(r) {
    const t = f.t, open = clamp(t / .25, 0, 1), close = t > D - .18 ? clamp((D - t) / .18, 0, 1) : 1, k = E.ease.outQuad(open) * close, x = f.x, y = f.y, spin = t * 4.5;
    if (t < D) {
      r.decal(() => {
        r.groundDisc(x, y, R * .95 * k, '#1a0c2e', .35); r.groundDisc(x, y, R * .42 * k, '#0c0616', .7);
        for (let a = 0; a < 3; a++) for (let j = 0; j < 7; j++) { const rad = R * k * (.18 + j * .12), a0 = spin * (1 + (6 - j) * .12) + a * TAU / 3 + j * .5; r.groundArc(x, y, rad, rad + 2.2, a0, a0 + .55 + j * .05, j < 2 ? '#ecd8ff' : j < 4 ? '#b070ff' : '#6a30c0', .75 - j * .07); }
        r.groundRing(x, y, R * k, '#6a30c0', .5);
      }, { emissive: .7 });
      r.queue(x, y, 30, g => {   // the tear itself: a slit of night rimmed in violet fire, hanging over the heap it gathers
        const [sx, sy] = r.w(x, y, 30 + Math.sin(t * 3) * 1.5), zm = r.view.zoom || 1, w = (3.6 + Math.sin(t * 14) * .4) * k * zm * (t > D - .18 ? .4 + .6 * close : 1), hh = 13 * Math.min(1, k * 1.4) * zm;
        px.glow(g, 1); r.glowDisc(g, sx, sy, 16 * k * zm, '#7a40c0', .45);
        SKS_lens(g, sx, sy, w * 1.9, hh * 1.12, '#5a2a9a'); SKS_lens(g, sx, sy, w * 1.4, hh * 1.05, '#b070ff'); SKS_lens(g, sx, sy, w, hh, '#0a0412');
        px.line(g, sx - w * .5, sy - hh * .6, sx - w * .8, sy + hh * .3, '#ecd8ff');
        for (let j = 0; j < 4; j++) { const q = E.hash2(j, Math.floor(t * 8)); px.dot(g, sx + (q - .5) * w * .8, sy + (E.hash2(j + 7, Math.floor(t * 8)) - .5) * hh * 1.2, q > .5 ? '#ffffff' : '#b070ff'); }
        if (Math.floor(t * 12) % 3 === 0) { const a = E.hash2(seed | 0, Math.floor(t * 12)) * TAU; zig(g, sx, sy, sx + Math.cos(a) * 14 * zm, sy + Math.sin(a) * 9 * zm, '#c890ff', 1, 3, Math.floor(t * 12)); }
        if (t > D - .18) px.disc(g, sx, sy, (1 - close) * 4 * zm, '#ffffff');
      }, { emissive: true, bias: .5 });
      L.add(x, y, 20, R + 30, (.8 + .25 * Math.sin(t * 9)) * k, { color: '#c890ff' });
    } else {
      const u = (t - D) / .6;
      r.decal(() => { r.groundRing(x, y, R * (.2 + u * 1.1), '#ecd8ff', .8 * (1 - u)); r.groundRing(x, y, R * (.1 + u * .8), '#b070ff', .7 * (1 - u)); }, { emissive: 1 - u });
      L.add(x, y, 10, R + 50, 2 * (1 - u), { color: '#c890ff' });
    }
  } });
  function implode() {
    const x = f.x, y = f.y;
    hitCircle('hero', x, y, R * .7, u => ctx.hit(1.9, { kb: 40, extra: { ang: Math.atan2(y - u.y, x - u.x), up: 130, statusChance: .6 } }));
    elBurst(x, y, 10, 'void', 26); P.ring(x, y, 2, R * .9, '#ecd8ff', .35); P.impact(x, y, 14, 14, '#ecd8ff');
    P.smoke(x, y, 6, 6, { size: 5, color: '#4a3068', dark: '#1a1028', light: '#8a6ab0' });
    shake(5); game.freeze(.06); game.flash('#c890ff', .1, .4);
    if (ctx.rune === 'abyss') {
      FX.area({ team: 'hero', src: h, x, y, r: R * .5, dur: 4, tick: .4, el: 'void', color: '#8a50d0', hit: ctx.hit(.15, { extra: { status: 'slow', statusChance: 1 } }) });
      FX.pull({ team: 'hero', src: h, x, y, r: R * .6, force: 90, dur: 4, el: 'void' });
    }
  }
  return f;
}
def('skills', 'voidrift', {
  name: 'Void Rift', kind: 'core', tags: ['spell', 'aoe'], el: 'void', cost: 26, cd: 8, unlock: 7, color: '#3a1a6a',
  runes: [{ id: 'maw', name: 'Hungering Maw', desc: 'The rift is larger, lasts longer and drifts toward the nearest enemies, swallowing the pack as it goes.' },
    { id: 'abyss', name: 'Abyssal Pool', desc: 'After the implosion a pool of void lingers for 4 seconds: it keeps dragging, slows and wounds whatever stands in it.' }],
  desc: (rank, rune) => 'Tear the air open at the cursor. The rift drags enemies toward its heart for ' + (rune === 'maw' ? 2.4 : 1.6) + ' seconds (' + SKS_pc(.18, rank) + ' as Void every 0.3 s), then implodes for ' + SKS_pc(1.9, rank) + ' and flings them into the air.' +
    (rune === 'maw' ? ' It hunts the nearest enemies.' : rune === 'abyss' ? ' A void pool lingers.' : ''),
  icon: (g, x, y, s) => SKS_ICON.rift(g, x, y, s),
  cast(h, ctx) {
    const [ax, ay] = SKS_aimPt(h, ctx, 150, 24), [tx, ty] = SKS_reach(h.x, h.y, ax, ay), face = Math.atan2(ty - h.y, tx - h.x), atk = new E.Attack(Object.assign({}, SKS_TEAR));
    atk.start(); h.facing = face; sfx('sks_gather', { pitch: .6 });
    return { name: 'voidrift', atk, moveK: .3, face, cancel: true, speed: h.castMul, rig: { attack: null, expr: 'angry' }, free: false, rift: null,
      update(dt) {
        const began = atk.update(dt), st = atk.state; this.rig.attack = st;
        if (began === 'active') { this.rift = SKS_rift(h, ctx, tx, ty); h.rig.kick(2); }
        this.free = !st || (st.phase === 'recover' && st.u > .3);
        return atk.busy;
      },
      draw(r) {
        const st = atk.state; if (!st) return;
        const hp = h.rig.hand('L');
        if (st.phase === 'wind') r.queue(hp[0], hp[1], hp[2], g => { const [x, y] = r.w(hp[0], hp[1], hp[2]), zm = r.view.zoom || 1; px.glow(g, 1); r.glowDisc(g, x, y, (3 + 5 * st.u) * zm, '#7a40c0', .6); px.disc(g, x, y, 1.5 * zm, '#ecd8ff'); }, { emissive: true, bias: .8 });
        else if (this.rift && this.rift.t < .5) {   // a thread of void still ties the hand to the tear
          const f = this.rift, a = 1 - f.t / .5;
          r.queue((hp[0] + f.x) / 2, (hp[1] + f.y) / 2, 30, g => { const [x0, y0] = r.w(hp[0], hp[1], hp[2]), [x1, y1] = r.w(f.x, f.y, 30), n = 12; px.glow(g, 1); let lx = x0, ly = y0; for (let i = 1; i <= n; i++) { const u = i / n, w = Math.sin(u * Math.PI) * 4 * Math.sin(game.time * 30 + u * 9) * a, nx = lerp(x0, x1, u) + w, ny = lerp(y0, y1, u) - w * .5; px.line(g, lx, ly, nx, ny, u < .5 ? '#ecd8ff' : '#b070ff'); lx = nx; ly = ny; } }, { emissive: true, bias: 1 });
        }
      } };
  }
});

/* =============================================================================
 * SPECTRAL BLADES: blade upright before the face, then a spin; ghost swords peel off the edge one by one and
 * orbit him on a tilted halo, spinning end over end, in front of him and behind him, cutting whatever they cross
 * ============================================================================= */
/** one spectral sword in 3D: grip centre c, blade direction d, flat normal n (both unit), size k. The flat is lit by how
 *  it faces the key light and the camera, so a turning blade flashes; a dark outline keeps it readable on any floor */
function SKS_drawBlade(r, g, c, d, n, k = 1, alpha = 1) {
  const zm = r.view.zoom || 1, w = SKS_V.norm(SKS_cross(n, d)), W = (s, o = 0) => r.w(c[0] + d[0] * s + w[0] * o, c[1] + d[1] * s + w[1] * o, c[2] + d[2] * s + w[2] * o);
  const tip = W(8.5 * k), b0 = W(.4 * k, 1.5 * k), b1 = W(.4 * k, -1.5 * k), m0 = W(4.5 * k, 1.05 * k), m1 = W(4.5 * k, -1.05 * k), mid = W(.4 * k), g0 = W(0, 3 * k), g1 = W(0, -3 * k), pom = W(-2.8 * k), T = SKS_BLADE;
  const lit = Math.abs(SKS_V.dot(n, SKS_LIGHT)), face = Math.abs(n[0] * r.view.dx + n[1] * r.view.dy + n[2] * r.view.dz), body = [b0, m0, tip, m1, b1];
  const draw = () => {
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { px.poly(g, body.map(p => [p[0] + ox, p[1] + oy]), '#0c2a44'); px.line(g, g0[0] + ox, g0[1] + oy, g1[0] + ox, g1[1] + oy, '#0c2a44', SKS_I(zm)); px.line(g, pom[0] + ox, pom[1] + oy, mid[0] + ox, mid[1] + oy, '#0c2a44', SKS_I(zm)); }
    px.poly(g, body, face > .55 ? T.base : T.sh); px.poly(g, [b0, m0, tip, mid], lit > .45 || face > .8 ? T.hi : T.lt);   // two bevels: one catches the light
    px.line(g, mid[0], mid[1], tip[0], tip[1], '#ffffff');
    px.line(g, pom[0], pom[1], mid[0], mid[1], '#3a88b0', SKS_I(zm)); px.line(g, g0[0], g0[1], g1[0], g1[1], '#dff4ff', SKS_I(zm)); px.dot(g, pom[0], pom[1], '#bff4ff'); px.dot(g, tip[0], tip[1], '#ffffff');
  };
  px.glow(g, 1); px.blend(g, .3 * alpha, 'add', () => px.line(g, mid[0], mid[1], tip[0], tip[1], '#3fb8ff', SKS_I(3 * zm)));
  if (alpha < 1) px.blend(g, alpha, 'normal', draw); else draw();
}
const SKS_BLADE_BOLT = (g, x, y, p, r) => { const a = Math.atan2(p.vy, p.vx), d = [Math.cos(a), Math.sin(a), 0], c = [p.x - d[0] * 3, p.y - d[1] * 3, p.z]; void x; void y; SKS_drawBlade(r, g, c, d, [0, 0, 1], .9); };
function SKS_blades(h, ctx, N, dur, R0) {
  const buff = { id: 'bladestorm', name: 'Spectral Blades', color: '#9fe8ff', t: dur, stats: { armor: 6 + 3 * ctx.rank } };
  h.buffs.push(buff); computeStats(h);
  buff.sksMake = () => SKS_bladesFx(h, ctx, N, R0, buff); buff.sksFx = buff.sksMake();   // the halo is bound to the buff (and comes back if a new level clears the effects)
}
function SKS_bladesFx(h, ctx, N, R0, buff) {
  const tip0 = h.rig.tip(), B = [];
  for (let i = 0; i < N; i++) B.push({ i, born: i * .26 / N, from: tip0, ph: i / N * TAU, x: tip0[0], y: tip0[1], z: tip0[2], trail: [] });
  const hitT = new Map(); let fz = 0;
  const hitFor = (b, u) => {
    if (u.z !== undefined && Math.abs((u.z || 0) + (u.head || 20) * .45 - b.z) > (u.head || 20) * .7 + 6) return null;   // flying or launched ones pass over the halo
    const nt = hitT.get(u) || 0; if (game.time < nt) return null; hitT.set(u, game.time + .32);
    const ta = Math.atan2(b.y - h.y, b.x - h.x) + Math.PI / 2;
    P.impact(b.x, b.y, b.z, 6, '#dff8ff'); P.sparks(b.x, b.y, b.z, 4, ta, { color: '#8fe8ff', hot: '#ffffff' }); sfx('sks_bladehit', { vol: .45 });
    if (game.time > fz) { fz = game.time + .09; game.freeze(.015); shake(.8); }
    return ctx.hit(.36, { kb: 70, extra: { ang: ta } });
  };
  const f = addFx({ kind: 'sksBlades', h, t: 0, ang: h.facing, end: -1, update(dt) {
    f.t += dt; f.ang += dt * 4.6;
    const gone = !h.buffs.includes(buff) || h.dead || f.kill;
    if (gone && f.end < 0) {
      f.end = f.t;
      if (ctx.rune === 'volley' && !h.dead) { const used = new Set(); for (const b of B) { const tg = nearestEnemy('hero', b.x, b.y, 150, used); if (tg) used.add(tg); const a = tg ? Math.atan2(tg.y - b.y, tg.x - b.x) : Math.atan2(b.y - h.y, b.x - h.x); FX.bolt({ team: 'hero', src: h, x: b.x, y: b.y, z: Math.max(8, b.z), ang: a, speed: 260, life: .9, r: 4, el: 'phys', home: 8, pierce: 1, hit: ctx.hit(1.1, { kb: 130 }), look: { kind: 'blade', color: '#8fe8ff', core: '#ffffff', draw: SKS_BLADE_BOLT }, light: 30 }); } sfx('sks_blades'); f.volley = true; }
      else sfx('sks_echofade', { vol: .6 });
    }
    if (f.end >= 0 && (f.volley || f.t - f.end > .45)) { if (hitT.size) hitT.clear(); return false; }
    if (hitT.size > 300) for (const [u, t0] of hitT) if (t0 < game.time) hitT.delete(u);
    const fade = f.end >= 0 ? (f.t - f.end) / .45 : 0, tilt = f.t * .9;
    for (const b of B) {
      const age = f.t - b.born; if (age < 0) continue;
      const k = E.ease.outCubic(clamp(age / .25, 0, 1)), phi = f.ang + b.ph, R = R0 * (1 + fade * 1.5) + Math.sin(f.t * 3 + b.i) * 1.5;
      const sx = h.x + Math.cos(phi) * R, sy = h.y + Math.sin(phi) * R, sz = h.z + 10 + 4.5 * Math.sin(phi - tilt);
      b.x = lerp(b.from[0], sx, k); b.y = lerp(b.from[1], sy, k); b.z = lerp(b.from[2], sz, k); b.phi = phi; b.k = k;
      b.trail.push([b.x, b.y, b.z]); if (b.trail.length > 6) b.trail.shift();
      if (k > .6 && f.end < 0) hitCircle('hero', b.x, b.y, 7, u => hitFor(b, u));
    }
    return true;
  }, draw(r) {
    const fade = f.end >= 0 ? clamp((f.t - f.end) / .45, 0, 1) : 0, a = 1 - fade;
    for (const b of B) {
      if (f.t < b.born || b.k === undefined || !r.visible(b.x, b.y, b.z, 30, 30, 30)) continue;
      const radial = [Math.cos(b.phi), Math.sin(b.phi), 0], ax = SKS_V.norm([radial[0], radial[1], .4]), tg = [-Math.sin(b.phi), Math.cos(b.phi), 0], e2 = SKS_cross(ax, tg), psi = f.t * 11 + b.i * 1.3;   // each tumbles end over end in the plane along its orbit, its flat turned outward
      const d = SKS_V.norm(SKS_V.add(SKS_V.mul(tg, Math.cos(psi)), SKS_V.mul(e2, Math.sin(psi)))), c = [b.x, b.y, b.z];
      r.queue(b.x, b.y, b.z, g => {
        const T0 = b.trail; px.glow(g, 1);
        px.blend(g, .5 * a, 'add', () => { for (let i = 1; i < T0.length; i++) { const p0 = r.w(T0[i - 1][0], T0[i - 1][1], T0[i - 1][2]), p1 = r.w(T0[i][0], T0[i][1], T0[i][2]); px.line(g, p0[0], p0[1], p1[0], p1[1], i > T0.length - 3 ? '#bff4ff' : '#3f98c8', i > T0.length - 3 ? 2 : 1); } });
        SKS_drawBlade(r, g, c, d, ax, .7 + .3 * b.k, a);
      }, { emissive: true });
      if (fade > 0 && Math.random() < .3) P.add({ kind: 'ember', x: b.x, y: b.y, z: b.z, vz: 20, max: .4, color: '#8fe8ff' });
    }
    if (f.end < 0) { r.decal(() => r.groundRing(h.x, h.y, R0, '#4fd0ff', .25 + .1 * Math.sin(f.t * 6)), { emissive: .4 }); L.add(h.x, h.y, 12, R0 + 40, .6, { color: '#8fe8ff' }); }
  } });
  return f;
}
def('skills', 'bladestorm', {
  name: 'Spectral Blades', kind: 'core', tags: ['spell', 'aoe'], el: 'phys', cost: 30, cd: 12, unlock: 9, range: 40, color: '#1a4a5a',
  runes: [{ id: 'legion', name: 'Legion of Blades', desc: 'Six blades on a wider halo, and they last a second longer.' },
    { id: 'volley', name: 'Parting Volley', desc: 'When the spell ends the blades do not fade: they hurl themselves at the nearest enemies.' }],
  desc: (rank, rune) => 'Ghost swords peel off the blade and orbit you for ' + (6 + (rune === 'legion' ? 1 : 0) + .25 * (rank - 1)).toFixed(1) + ' seconds. Each cuts what it passes for ' + SKS_pc(.36, rank) + ' weapon damage. +' + (6 + 3 * rank) + ' Armor while they turn.' +
    (rune === 'legion' ? ' Six blades.' : rune === 'volley' ? ' At the end they fly at the nearest enemies for ' + SKS_pc(1.1, rank) + ' each.' : ''),
  icon: (g, x, y, s) => SKS_ICON.blades(g, x, y, s),
  cast(h, ctx) {
    const legion = ctx.rune === 'legion', N = (legion ? 6 : 4) + ctx.proj, dur = 6 + (legion ? 1 : 0) + .25 * (ctx.rank - 1), R0 = (legion ? 22 : 18) * Math.sqrt(ctx.area);
    for (const f of ED.fx) if (f.kind === 'sksBlades' && f.h === h) f.kill = true;   // a recast replaces the old halo
    h.buffs = h.buffs.filter(b => b.id !== 'bladestorm');
    return { name: 'bladestorm', moveK: .35, face: h.aim, cancel: true, speed: h.castMul, rig: { pose: 'block', expr: 'angry' }, free: false, spin: null,
      update(dt) {
        this.t += dt;
        if (this.t < .24) { if (Math.random() < .7) { const tp = h.rig.tip(), a = Math.random() * TAU; P.add({ kind: 'ember', x: tp[0] + Math.cos(a) * 9, y: tp[1] + Math.sin(a) * 9, z: tp[2] + (Math.random() - .5) * 10, vx: -Math.cos(a) * 50, vy: -Math.sin(a) * 50, drag: 3, max: .25, color: '#8fe8ff' }); } }
        else if (!this.spin) { this.spin = new E.Attack('spin', { wind: .04, active: .3, recover: .2, z0: -8, z1: -8 }); this.spin.start(); this.rig.pose = null; this.rig.expr = 'shout'; sfx('sks_blades'); P.ring(h.x, h.y, 4, 26, '#bff4ff', .3); SKS_blades(h, ctx, N, dur, R0); }
        if (this.spin) { this.spin.update(dt); this.rig.attack = this.spin.state; if (!this.spin.busy) return false; this.free = this.spin.phase === 'recover'; }
        return true;
      },
      draw(r) {   // spectral light runs up the blade held before his face
        if (this.t >= .26) return; const tp = h.rig.tip(), hd = h.rig.hand('R'), k = this.t / .24;
        r.queue(tp[0], tp[1], tp[2], g => { const [x, y] = r.w(tp[0], tp[1], tp[2]), [x0, y0] = r.w(hd[0], hd[1], hd[2]), zm = r.view.zoom || 1, mx = lerp(x0, x, k), my = lerp(y0, y, k); px.glow(g, 1); px.blend(g, .6, 'add', () => px.line(g, x0, y0, mx, my, '#3fb8ff', SKS_I(3 * zm))); px.line(g, x0, y0, mx, my, '#dff8ff'); r.glowDisc(g, mx, my, 3 * zm, '#8fe8ff', .5); px.dot(g, mx, my, '#ffffff'); }, { emissive: true, bias: .8 });
        L.add(tp[0], tp[1], tp[2], 40, .8 * k, { color: '#8fe8ff' });
      } };
  }
});

/* =============================================================================
 * ECHO OF THE DEEP: hands pressed forward, he calls up his own echo; a second Humanoid built from his look, recolored
 * in spectral tones, splits out of him with afterimages. It repeats his melee swings a beat later (the echo) or
 * fights on its own, mirrors his dodges and spell gestures, and dissolves upward when its time runs out.
 * It lives in ED.allies as { team: 'hero', alive, x, y, r, update(dt) -> keep, draw(r) } and cannot be struck.
 * ============================================================================= */
const SKS_ECHO = { lag: .12, fade: .9, speed: 96 };
const SKS_ECHO_COMBO = ['slash', { move: 'backslash', over: { a1: 2.2, z1: -3 } }, { move: 'spin', over: { z0: -12, z1: -12 } }];
/** spectral colors: every part keeps its value but drifts into cold cyan */
function SKS_spectral(colors) { const out = {}; for (const k in colors) { const c = colors[k]; if (typeof c === 'string' && c[0] === '#') out[k] = E.mix(E.mix(c, '#6fdcff', .55), '#ffffff', .1); } out.skin = '#5ab4d8'; out.hair = '#1c4a6a'; out.eye = '#0c2a48'; return out; }   // a deeper face so the glowing eyes read
function SKS_echo(h, ctx, side, life, scale) {
  const lk = h.look, rig = charRig(h, lk, { colors: SKS_spectral(lk.colors), eyeGlow: '#e8ffff' });   // his own body, in spectral colors (a custom body may keep its own)
  const e = { kind: 'echo', team: 'hero', alive: true, targetable: false, x: h.x, y: h.y, z: 0, vx: 0, vy: 0, r: 4.5, facing: h.facing, rig, t: 0, life, side, scale, ctx, owner: h,
    atk: null, combo: 0, set: new Set(), cool: 0, mirror: [], mcur: null, mspec: null, mph: null, dash: 0, dashDir: 0, pose: null, poseT: 0, lastGhost: 0, alpha: 0, tgt: null,
    update(dt) { return SKS_echoStep(this, dt); }, draw(r) { SKS_echoDraw(this, r); } };
  rig.update(0, { x: e.x, y: e.y, facing: e.facing });
  ED.allies.push(e);
  return e;
}
/** where the echo stands when it has nothing to strike: beside him, a little behind */
function SKS_echoSlot(e, h) { const f = h.facing, s = e.side; return [h.x + Math.cos(f + s * 1.9) * 17, h.y + Math.sin(f + s * 1.9) * 17]; }
function SKS_echoHit(e, spec, set) {
  const h = e.owner, b = BLADE_HIT[spec.name] || BLADE_HIT.slash, big = !!b.big;
  hitCone('hero', e.x, e.y, e.facing, b.range * (spec.name === 'spin' ? e.ctx.area : 1), b.half, u => {
    const ang = Math.atan2(u.y - e.y, u.x - e.x);
    P.sparks(lerp(e.x, u.x, .6), lerp(e.y, u.y, .6), 10, 6, ang, { color: '#8fe8ff', hot: '#ffffff' }); P.impact(lerp(e.x, u.x, .7), lerp(e.y, u.y, .7), 12, big ? 8 : 6, '#bff8ff');
    sfx('hit', { vol: .3, pitch: 1.35 }); game.freeze(big ? .035 : .02);
    return e.ctx.hit(b.dmg * e.scale, { el: h.look.el || 'phys', tags: ['melee', 'summon'], kb: b.kb, extra: { ang, status: e.ctx.rune === 'requiem' ? 'vuln' : undefined, statusChance: e.ctx.rune === 'requiem' ? .5 : undefined } });
  }, set);
}
function SKS_echoStep(e, dt) {
  const h = e.owner; e.t += dt; e.cool -= dt; e.dash -= dt; e.poseT -= dt;
  if (!h || !h.alive || h.dead || h !== ED.hero) e.life = Math.min(e.life, e.t + SKS_ECHO.fade);   // he fell (or left): it fades with him
  const left = e.life - e.t, fading = left < SKS_ECHO.fade;
  if (left <= 0) { SKS_echoGone(e); e.alive = false; return false; }
  e.alpha = Math.min(1, e.t / .45) * (fading ? Math.max(0, left / SKS_ECHO.fade) : 1);
  // his melee swings go into a delay line; the echo replays them SKS_ECHO.lag seconds later
  const act = h.act, S = act && act.skill && REG.skills[act.skill];
  if (!fading && e.t > .3 && act && act.rig && act.rig.attack && S && S.tags && S.tags.includes('melee')) e.mirror.push({ at: e.t + SKS_ECHO.lag, st: act.rig.attack, face: h.facing });
  while (e.mirror.length && e.mirror[0].at <= e.t) e.mcur = e.mirror.shift();
  const mst = e.mcur && e.t - e.mcur.at < .06 ? e.mcur.st : null;
  // a target: the nearest enemy to the echo, never far from him
  if (!e.tgt || !e.tgt.alive || Math.hypot(e.tgt.x - h.x, e.tgt.y - h.y) > 130 || (e.t * 4 | 0) !== (e.tt || 0)) { e.tt = e.t * 4 | 0; const c = nearestEnemy('hero', e.x, e.y, 95); e.tgt = c && Math.hypot(c.x - h.x, c.y - h.y) < 120 ? c : null; }
  const tg = fading ? null : e.tgt, split = e.t < .32;
  let want = [0, 0], face = e.facing, attack = null;
  if (split) {   // stepping out of him to its place at his side
    const [sx, sy] = SKS_echoSlot(e, h), dx = sx - e.x, dy = sy - e.y, d = Math.hypot(dx, dy); if (d > 1) want = [dx / d * Math.min(260, d * 14), dy / d * Math.min(260, d * 14)]; face = h.facing;
  } else if (e.dash > 0) want = [Math.cos(e.dashDir) * 250, Math.sin(e.dashDir) * 250];
  else if (mst) {   // the echo of his swing, aimed at its own foe when one is at hand
    if (e.atk) { e.atk = null; }
    if (mst.spec !== e.mspec || (mst.phase === 'wind' && e.mph !== 'wind')) { e.mspec = mst.spec; e.set = new Set(); }
    if (mst.phase === 'active' && e.mph === 'wind') { const p = 70; e.vx += Math.cos(e.facing) * p; e.vy += Math.sin(e.facing) * p; sfx('swing', { vol: .3, pitch: 1.3 }); }
    e.mph = mst.phase; attack = mst;
    face = tg && Math.hypot(tg.x - e.x, tg.y - e.y) < 42 ? Math.atan2(tg.y - e.y, tg.x - e.x) : e.mcur.face;
    if (mst.phase === 'active' && mst.u >= (mst.spec.hitAt === undefined ? .3 : mst.spec.hitAt)) SKS_echoHit(e, mst.spec, e.set);
  } else {
    e.mph = null;
    if (e.atk) {   // its own blade dance
      const began = e.atk.update(dt), st = e.atk.state; attack = st;
      if (began === 'active') { e.vx += Math.cos(e.facing) * 70; e.vy += Math.sin(e.facing) * 70; sfx('swing', { vol: .3, pitch: 1.3 }); }
      if (st && st.phase === 'active' && st.u >= (st.spec.hitAt === undefined ? .3 : st.spec.hitAt)) SKS_echoHit(e, st.spec, e.set);
      if (tg) face = Math.atan2(tg.y - e.y, tg.x - e.x);
      if (!e.atk.busy) { e.atk = null; e.cool = e.combo % 3 === 0 ? .45 : .06; }
    } else if (tg && !fading) {
      const dx = tg.x - e.x, dy = tg.y - e.y, d = Math.hypot(dx, dy) || 1, stand = tg.r + e.r + 6;
      face = Math.atan2(dy, dx);
      if (d > stand + 4) want = [dx / d * SKS_ECHO.speed, dy / d * SKS_ECHO.speed];
      else if (e.cool <= 0) { const c = SKS_ECHO_COMBO[e.combo++ % 3]; e.atk = typeof c === 'string' ? new E.Attack(c) : new E.Attack(c.move, c.over); e.atk.start(); e.set = new Set(); }
    } else {   // nothing to fight: keep to his side and look where he looks
      const [sx, sy] = SKS_echoSlot(e, h), dx = sx - e.x, dy = sy - e.y, d = Math.hypot(dx, dy);
      if (d > 3) { const sp = Math.min(SKS_ECHO.speed * 1.2, d * 5); want = [dx / d * sp, dy / d * sp]; face = d > 12 ? Math.atan2(dy, dx) : h.facing; } else face = h.facing;
    }
  }
  if (Math.hypot(h.x - e.x, h.y - e.y) > 170 && !fading) { P.smoke(e.x, e.y, 6, 3, { size: 4, color: '#8ad8f0', dark: '#3a7898', light: '#dff8ff' }); const [sx, sy] = SKS_echoSlot(e, h); e.x = sx; e.y = sy; e.vx = e.vy = 0; P.ring(e.x, e.y, 3, 16, '#8fe8ff', .3); }   // left behind: it steps back to him out of nowhere
  const acc = (e.dash > 0 || split ? 3000 : attack ? 500 : 900) * dt;
  e.vx = approach(e.vx, attack && !split ? 0 : want[0], acc); e.vy = approach(e.vy, attack && !split ? 0 : want[1], acc);
  e.x += e.vx * dt; e.y += e.vy * dt; collideUnit(e);
  e.facing = E.approachAng(e.facing, face, dt * (attack ? 30 : 14));
  e.z = fading ? (1 - left / SKS_ECHO.fade) * 7 : 0;
  const rs = { x: e.x, y: e.y, z: e.z, vx: e.vx, vy: e.vy, facing: e.facing, dash: e.dash > 0 || split, attack, pose: e.poseT > 0 ? e.pose : fading ? 'cast' : null, expr: attack ? 'angry' : e.poseT > 0 && e.pose === 'cheer' ? 'shout' : null };
  e.rig.update(dt, rs);
  if (!(attack && attack.phase === 'active') && e.dash <= 0) settleCape(e.rig, dt, clamp(1 - Math.hypot(e.vx, e.vy) / 60, 0, 1));
  if (Math.random() < dt * 14 * e.alpha) P.add({ kind: 'ember', x: e.x + (Math.random() - .5) * 9, y: e.y + (Math.random() - .5) * 5, z: e.z + 2 + Math.random() * 20, vz: 12 + Math.random() * 18, drag: 1, max: .7, color: Math.random() < .6 ? '#8ff0ff' : '#e8ffff' });
  e.attacking = !!attack;
  return true;
}
function SKS_echoGone(e) {
  P.glints(e.x, e.y, 14, 12, '#bff8ff', 16); P.ring(e.x, e.y, 3, 24, '#8fe8ff', .45); sfx('sks_echofade');
  for (let i = 0; i < 16; i++) P.add({ kind: 'ember', x: e.x + (Math.random() - .5) * 8, y: e.y + (Math.random() - .5) * 6, z: 4 + Math.random() * 22, vx: (Math.random() - .5) * 30, vy: (Math.random() - .5) * 30, vz: 40 + Math.random() * 50, drag: 1.2, max: .9, color: '#8ff0ff' });
  if (e.ctx.rune === 'requiem' && ED.hero) { FX.nova({ team: 'hero', src: e.owner, x: e.x, y: e.y, r0: 4, r1: 56 * e.ctx.area, dur: .3, el: 'phys', color: '#8fe8ff', hit: e.ctx.hit(1.5, { kb: 180, extra: { status: 'vuln', statusChance: 1 } }) }); shake(3); sfx('sks_frost', { pitch: .7 }); }
}
function SKS_echoDraw(e, r) {
  const A = e.alpha; if (A <= .02 || !r.visible(e.x, e.y, e.z)) return;
  const flick = e.life - e.t < SKS_ECHO.fade && Math.floor(e.t * 24) % 3 === 0 ? .55 : 1;
  r.decal(() => { r.groundDisc(e.x, e.y, 6.5, '#3fb8ff', .22 * A); r.groundRing(e.x, e.y, 7 + Math.sin(e.t * 6), '#9fefff', .5 * A); }, { emissive: .6 * A });
  const fast = e.dash > 0 || e.t < .32 || (e.attacking && Math.hypot(e.vx, e.vy) > 30), ghost = fast && game.time - e.lastGhost > .04 ? (e.lastGhost = game.time, { color: '#3fb8ff', life: .3 }) : null;
  r.actor(e.x, e.y, e.z, (g, ox, oy) => { px.glow(g, .6); e.rig.draw(g, ox, oy, r.view); }, { alpha: A * .82 * flick, flash: '#d8fcff', flashMix: .3, outlineColor: '#0c2a48', ghost });
  if (e.attacking) e.rig.drawSmear(r, SKS_SMEAR.ghost);
  if (e.t < .6) {   // the column of pale light it rises in
    const u = e.t / .6;
    r.queue(e.x, e.y, 0, g => { const [x, y] = r.w(e.x, e.y, 0), [, ty] = r.w(e.x, e.y, 20 + 30 * E.ease.outQuad(u)), zm = r.view.zoom || 1, w = (6 - 3 * u) * zm, a = .4 * (1 - u); px.glow(g, 1);
      px.blend(g, a, 'add', () => { px.poly(g, [[x - w, y], [x - w * .15, ty], [x + w * .15, ty], [x + w, y]], '#3fb8ff'); px.poly(g, [[x - w * .4, y], [x, ty + (y - ty) * .3], [x + w * .4, y]], '#e8ffff'); }); }, { emissive: true, bias: .3 });   // a tapering shaft of pale light it rises in
  }
  L.add(e.x, e.y, 14, 58, .75 * A, { color: '#6fe0ff' });
}
// the echo mirrors his dodges (a dash with afterimages) and the gestures of his spells
BUS.on('dodge', ev => { for (const a of ED.allies) if (a.kind === 'echo' && a.alive && a.owner === ev.h) { a.dash = .22; a.dashDir = ev.h.dodgeDir; a.atk = null; a.rig.kick(-3); P.dust(a.x, a.y, 0, 4, { speed: 40, color: '#8ad8f0' }); } });
BUS.on('skill', ev => { const S = REG.skills[ev.id], tg = (S && S.tags) || []; if (!S || ev.id === 'echo' || !(tg.includes('spell') || tg.includes('shout'))) return; for (const a of ED.allies) if (a.kind === 'echo' && a.alive && a.owner === ev.h) { a.pose = tg.includes('shout') || ev.id === 'meteor' ? 'cheer' : 'cast'; a.poseT = .5; } });
def('skills', 'echo', {
  name: 'Echo of the Deep', kind: 'ultimate', tags: ['spell', 'summon'], el: 'phys', cost: 45, cd: 22, unlock: 13, color: '#14506a',
  runes: [{ id: 'twin', name: 'Twin Echoes', desc: 'Two echoes step out of you, one on each side, each a little weaker.' },
    { id: 'requiem', name: 'Requiem', desc: 'The echo lasts longer, its blows leave enemies Exposed, and it bursts in a spectral nova when it fades.' }],
  desc: (rank, rune) => 'Your echo steps out of you and fights at your side for ' + (rune === 'requiem' ? 10 : rune === 'twin' ? 7 : 8) + ' seconds. It repeats your melee swings a heartbeat later, or finds its own targets, for ' + SKS_pc(rune === 'twin' ? .45 : .6, rank) + ' of their damage.' +
    (rune === 'twin' ? ' Two echoes.' : rune === 'requiem' ? ' It bursts for ' + SKS_pc(1.5, rank) + ' when it fades.' : ''),
  icon: (g, x, y, s) => SKS_ICON.echo(g, x, y, s),
  cast(h, ctx) {
    const twin = ctx.rune === 'twin', life = ctx.rune === 'requiem' ? 10 : twin ? 7 : 8, scale = twin ? .45 : .6;
    for (const a of ED.allies) if (a.kind === 'echo' && a.owner === h && a.alive) a.life = Math.min(a.life, a.t + SKS_ECHO.fade);   // one call at a time: older echoes fade
    return { name: 'echo', moveK: .15, face: h.aim, cancel: true, speed: h.castMul, rig: { pose: 'cast', expr: null }, free: false, made: false,
      update(dt) {
        this.t += dt; const t = this.t;
        if (t < .32) { this.rig.pose = 'cast'; this.rig.stance = null; if (Math.random() < .8) { const a = Math.random() * TAU, d = 12 + Math.random() * 8; P.add({ kind: 'ember', x: h.x + Math.cos(a) * d, y: h.y + Math.sin(a) * d, z: 2 + Math.random() * 18, vx: -Math.cos(a) * d * 3, vy: -Math.sin(a) * d * 3, drag: 2, max: .35, color: '#8ff0ff' }); } }
        else if (!this.made) {
          this.made = true; this.rig.pose = null; this.rig.expr = 'shout'; sfx('sks_echo'); shake(2); h.rig.kick(-3);
          P.ring(h.x, h.y, 3, 30, '#8fe8ff', .45); P.glints(h.x, h.y, 14, 10, '#e8ffff', 16);
          if (twin) { SKS_echo(h, ctx, 1, life, scale); SKS_echo(h, ctx, -1, life, scale); } else SKS_echo(h, ctx, Math.random() < .5 ? 1 : -1, life, scale);
        }
        this.free = t > .45;
        return t < .62;
      },
      draw(r) { if (this.t >= .34) return; const k = this.t / .32; r.decal(() => { r.groundRing(h.x, h.y, 24 * (1 - k) + 5, '#8fe8ff', .7 * k); r.groundDisc(h.x, h.y, 8, '#3fb8ff', .3 * k); }, { emissive: k }); L.add(h.x, h.y, 16, 60, 1.2 * k, { color: '#6fe0ff' }); } };
  }
});

/* =============================================================================
 * WAR CRY: he coils (crouch, squash), then throws his head back and roars with the sword raised (cheer, shout).
 * The shout is a visible wave; monsters close by turn and run; a fire burns in him for a while
 * ============================================================================= */
function SKS_aura(h, buff, col, col2) {
  const f = addFx({ kind: 'sksAura', t: 0, update(dt) {
    f.t += dt; if (!h.buffs.includes(buff) || h.dead) return false;
    if (Math.random() < dt * 18) P.add({ kind: 'ember', x: h.x + (Math.random() - .5) * 10, y: h.y + (Math.random() - .5) * 8, z: 2 + Math.random() * 8, vz: 26 + Math.random() * 22, drag: 1.4, max: .7, color: Math.random() < .5 ? col : col2 });
    return true;
  }, draw(r) {
    const p = (f.t * 1.5) % 1, a = Math.min(1, f.t * 4, buff.t * 2);
    r.decal(() => { r.groundRing(h.x, h.y, 5 + p * 13, col, .6 * (1 - p) * a); r.groundDisc(h.x, h.y, 7, col, .12 * a); }, { emissive: .5 * a });
    L.add(h.x, h.y, 10, 44, .4 * a, { color: col });
  } });
  return f;
}
def('skills', 'warcry', {
  name: 'War Cry', kind: 'core', tags: ['shout', 'aoe'], el: 'phys', cost: 0, cd: 16, unlock: 5, range: 60, color: '#7a3a14',
  runes: [{ id: 'rally', name: 'Rallying Cry', desc: 'The cry heals you for 20% of your life and quickens your attacks while it lasts.' },
    { id: 'thunder', name: 'Thunder Shout', desc: 'The cry is a shockwave of Storm that hurls enemies back and calls lightning down on the nearest; their fear is brief.' }],
  desc: (rank, rune) => 'Roar: enemies close by turn and flee for ' + (rune === 'thunder' ? 1 : (2.4 + .15 * rank)).toFixed(1) + ' seconds, and for ' + (6 + .5 * (rank - 1)).toFixed(1) + ' seconds you deal +' + (20 + 4 * rank) + '% damage and move 12% faster.' +
    (rune === 'rally' ? ' Heals 20% life, +20% attack speed.' : rune === 'thunder' ? ' The shout strikes for ' + SKS_pc(1.1, rank) + ' as Storm.' : ''),
  icon: (g, x, y, s) => SKS_ICON.cry(g, x, y, s),
  cast(h, ctx) {
    const R = 74 * ctx.area, thunder = ctx.rune === 'thunder', rally = ctx.rune === 'rally', col = rally ? '#ffd36a' : thunder ? '#ffe45a' : '#ff8a3a';
    return { name: 'warcry', moveK: .15, face: h.aim, cancel: true, speed: h.castMul, rig: { pose: 'crouch', expr: 'angry' }, free: false, cried: false,
      update(dt) {
        this.t += dt; const t = this.t;
        if (t < .2) { this.rig.pose = 'crouch'; if (t < dt * 1.5) h.rig.kick(-4); }
        else if (!this.cried) {
          this.cried = true; this.rig.pose = 'cheer'; this.rig.expr = 'shout'; h.rig.kick(6);
          sfx('sks_warcry'); shake(4); game.freeze(.04); game.flash(col, .1, .25);
          P.ring(h.x, h.y, 4, R, col, .45); SKS_later(.08, () => P.ring(h.x, h.y, 4, R * .7, '#fff0c0', .35));
          for (let i = 0; i < 20; i++) { const a = i / 20 * TAU; P.add({ kind: 'dust', x: h.x + Math.cos(a) * 5, y: h.y + Math.sin(a) * 5, z: 1, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, vz: 10, drag: 4, max: .5, size: 2.2, color: '#c8b8a0' }); }
          eachEnemy('hero', h.x, h.y, R, u => SKS_fear(u, thunder ? 1 : 2.4 + .15 * ctx.rank));
          if (thunder) {
            FX.nova({ team: 'hero', src: h, x: h.x, y: h.y, r0: 6, r1: R * .85, dur: .3, el: 'storm', hit: ctx.hit(1.1, { el: 'storm', kb: 220, extra: { status: 'shock', statusChance: 1 } }) });
            const near = []; eachEnemy('hero', h.x, h.y, R, u => near.push(u)); near.sort((a, b) => dist2(a, h) - dist2(b, h));
            near.slice(0, 3).forEach((u, i) => FX.strike({ team: 'hero', src: h, x: u.x, y: u.y, r: 14, delay: .12 + i * .08, el: 'storm', hit: ctx.hit(1.1, { el: 'storm', kb: 80, extra: { status: 'shock', statusChance: 1 } }) }));
          }
          const buff = { id: 'warcry', name: rally ? 'Rallying Cry' : 'War Cry', color: col, t: 6 + .5 * (ctx.rank - 1), stats: Object.assign({ incDmg: 20 + 4 * ctx.rank, moveSpeed: 12 }, rally ? { atkSpeed: 20, lifeRegen: 2 + ctx.rank } : {}) };
          h.buffs = h.buffs.filter(b => b.id !== 'warcry'); h.buffs.push(buff); computeStats(h);
          if (rally) { h.hp = Math.min(h.maxHp, h.hp + h.maxHp * .2); P.glints(h.x, h.y, 16, 12, '#ffd36a', 16); sfx('heal', { vol: .6 }); }
          buff.sksMake = () => SKS_aura(h, buff, col, rally ? '#fff0b0' : thunder ? '#ffffff' : '#ffd36a'); buff.sksFx = buff.sksMake();   // the old cry's aura ends with its buff
          this.shout = game.time;
        }
        this.free = t > .62;
        return t < .85;
      },
      draw(r) {   // the roar made visible: arcs pour out of his mouth and a ring rolls across the floor
        if (!this.shout) return;
        const u = (game.time - this.shout) / .5; if (u > 1) return;
        const hd = h.rig.head(), fa = h.facing, mz = hd[2] - 1.5;
        r.queue(hd[0], hd[1], hd[2] + 30, g => {   // sound waves out of his mouth, drawn on the screen: arcs toward where he faces, rings when he faces you
          const [mx, my] = r.w(hd[0] + Math.cos(fa) * 2, hd[1] + Math.sin(fa) * 2, mz), [fx, fy] = r.w(hd[0] + Math.cos(fa) * 12, hd[1] + Math.sin(fa) * 12, mz), zm = r.view.zoom || 1;
          const dl = Math.hypot(fx - mx, fy - my), th = Math.atan2(fy - my, fx - mx), span = lerp(Math.PI, .95, clamp(dl / (9 * zm), 0, 1));
          px.glow(g, 1);
          for (let k = 0; k < 3; k++) {
            const q = u * 1.25 - k * .14; if (q <= 0 || q >= 1) continue;
            const rad = (3 + q * 26) * zm, a = 1 - q, n = Math.max(8, Math.round(rad * span * 1.2));
            px.blend(g, a, 'add', () => { for (let i = 0; i <= n; i++) { const an = th - span + 2 * span * i / n; px.rect(g, mx + Math.cos(an) * rad, my + Math.sin(an) * rad * .8, k ? 1 : 2, k ? 1 : 2, k ? col : '#fff0c0'); } });
          }
        }, { emissive: true, bias: .6 });
        r.decal(() => r.groundRing(h.x, h.y, 8 + u * R, col, .7 * (1 - u)), { emissive: 1 - u });
      } };
  }
});

/* =============================================================================
 * SHADOW STEP: a crouch, then he bursts into smoke; his shadow slides across the floor (the dark afterimages mark
 * the path), and he steps out of the smoke at the far end with a spinning cut. Never ends inside a wall.
 * ============================================================================= */
function SKS_blinkPath(h, ctx, range) {
  let [tx, ty] = SKS_aimPt(h, ctx, range, 30), foe = null;
  if (ctx.rune === 'ambush') { const m = nearestEnemy('hero', ctx.tx === undefined ? tx : ctx.tx, ctx.ty === undefined ? ty : ctx.ty, 28); if (m && Math.hypot(m.x - h.x, m.y - h.y) < range + 25) { const a = angTo(h, m); tx = m.x + Math.cos(a) * (m.r + 9); ty = m.y + Math.sin(a) * (m.r + 9); foe = m; } }
  const [ex, ey] = SKS_reach(h.x, h.y, tx, ty);
  return { ex, ey, foe };
}
def('skills', 'blink', {
  name: 'Shadow Step', kind: 'mobility', tags: ['spell', 'mobility', 'aoe'], el: 'void', cost: 12, cd: 3.5, unlock: 4, color: '#2a1440',
  runes: [{ id: 'trail', name: 'Rift Trail', desc: 'Everything on the path is cut as you pass, and shadow flames burn along it for a while.' },
    { id: 'ambush', name: 'Ambush', desc: 'Step behind the enemy under the cursor. The cut out of the smoke always crits and stuns.' }],
  desc: (rank, rune) => 'Vanish into smoke and step out of it at the cursor (up to 105 away, never into a wall), striking all around for ' + SKS_pc(1.3, rank) + ' weapon damage.' +
    (rune === 'trail' ? ' The path is cut and burns.' : rune === 'ambush' ? ' Lands behind the target; the cut crits and stuns.' : ''),
  icon: (g, x, y, s) => SKS_ICON.blink(g, x, y, s),
  cast(h, ctx) {
    const range = 105 * ctx.area, { ex, ey, foe } = SKS_blinkPath(h, ctx, range), x0 = h.x, y0 = h.y, len = Math.hypot(ex - x0, ey - y0);
    if (len < 10) return null;   // a wall right in front: nothing happens, nothing is spent
    const face = foe ? Math.atan2(foe.y - ey, foe.x - ex) : Math.atan2(ey - y0, ex - x0), T0 = .08, T1 = .16;
    h.facing = Math.atan2(ey - y0, ex - x0);
    return { name: 'blink', sksBlink: true, moveK: 0, face: h.facing, cancel: false, speed: 1, rig: { pose: 'crouch', expr: 'angry' }, free: false, ghosts: [], spin: null, set: new Set(), hitDone: false,
      update(dt) {
        this.t += dt; const t = this.t;
        if (t < T0) { if (Math.random() < .6) P.smoke(h.x, h.y, 1, 1, Object.assign({}, SKS_SMOKE, { size: 3 })); return true; }
        if (!this.gone) {   // gone: a burst of smoke where he stood
          this.gone = true; h.fade = 0; h.sksFaded = true; h.inv = Math.max(h.inv, .4); this.rig.pose = null; this.rig.dash = true; this.z = 5;
          P.smoke(x0, y0, 4, 9, SKS_SMOKE); elBurst(x0, y0, 10, 'void', 10); sfx('sks_vanish'); P.ring(x0, y0, 3, 16, '#b070ff', .3);
          if (ctx.rune === 'trail') {
            const hit = ctx.hit(.8, { kb: 60, el: 'void' }), set = new Set(), mx = (x0 + ex) / 2, my = (y0 + ey) / 2, ca = (ex - x0) / len, sa = (ey - y0) / len;
            eachEnemy('hero', mx, my, len / 2 + 10, u => { const dx = u.x - x0, dy = u.y - y0, al = dx * ca + dy * sa, sd = Math.abs(-dx * sa + dy * ca); if (al > -4 && al < len + 4 && sd < 11 + u.r && !set.has(u)) { set.add(u); dealDamage(u, Object.assign({}, hit, { ang: Math.atan2(sa, ca) + Math.PI / 2 })); P.sparks(u.x, u.y, 12, 6, null, { color: '#c890ff', hot: '#ffffff' }); } });
            const n = Math.max(1, Math.round(len / 22)); for (let i = 0; i < n; i++) { const u = (i + .5) / n; FX.area({ team: 'hero', src: h, x: lerp(x0, ex, u), y: lerp(y0, ey, u), r: 11, dur: 2.5, tick: .5, el: 'void', color: '#8a50d0', hit: ctx.hit(.15, { el: 'void' }) }); }
            FX.visual(.4, (r, u) => r.queue(mx, my, 8, g => { const a = r.w(x0, y0, 9), b = r.w(ex, ey, 9); px.glow(g, 1); px.blend(g, 1 - u, 'add', () => { px.line(g, a[0], a[1], b[0], b[1], '#c890ff', 3); px.line(g, a[0], a[1], b[0], b[1], '#ffffff', 1); }); }, { emissive: true, bias: 1 }));
          }
        }
        if (t < T1) {   // his shadow crosses the floor; dark afterimages mark the way
          const k = E.ease.inOut((t - T0) / (T1 - T0));
          h.x = lerp(x0, ex, k); h.y = lerp(y0, ey, k); h.vx = h.vy = 0;
          const need = Math.floor(k * 4); while (this.ghosts.length < need) { const q = (this.ghosts.length + 1) / 4.6; this.ghosts.push({ x: lerp(x0, ex, q), y: lerp(y0, ey, q), t: game.time }); }
          if (Math.random() < .8) P.add({ kind: 'ember', x: h.x, y: h.y, z: 4 + Math.random() * 14, vz: 16, max: .5, color: '#b070ff' });
          return true;
        }
        if (!this.spin) {   // back: out of the smoke with a spinning cut
          h.x = ex; h.y = ey; this.z = 0; this.rig.dash = false; this.face = face; h.facing = face; this.cancel = true;
          P.smoke(ex, ey, 4, 8, SKS_SMOKE); elBurst(ex, ey, 10, 'void', 12); P.ring(ex, ey, 3, 30 * ctx.area, '#c890ff', .3); sfx('sks_appear');
          this.spin = new E.Attack('spin', { wind: .02, active: .2, recover: .22, lunge: 0, z0: -10, z1: -10 }); this.spin.start(); this.rig.expr = 'shout'; this.smear = SKS_SMEAR.shadow; this.back = t;
        }
        h.fade = Math.min(1, (t - this.back) / .07); if (h.fade >= 1) { h.fade = undefined; h.sksFaded = false; }
        this.spin.update(dt); const st = this.spin.state; this.rig.attack = st;
        if (st && st.phase === 'active' && st.u > .15 && !this.hitDone) {
          this.hitDone = true; const amb = ctx.rune === 'ambush';
          let n = 0; hitCircle('hero', h.x, h.y, 28 * ctx.area, u => { n++; const a = angTo(h, u); P.sparks(lerp(h.x, u.x, .6), lerp(h.y, u.y, .6), 10, 7, a, { color: '#c890ff', hot: '#ffffff' }); P.impact(lerp(h.x, u.x, .7), lerp(h.y, u.y, .7), 12, 7, '#ecd8ff'); return ctx.hit(1.3, { kb: 170, extra: Object.assign({ ang: a }, amb ? { crit: true, stun: 1 } : {}) }); });
          if (n) { game.freeze(.05); shake(3); sfx('hit', { vol: .55 }); }
        }
        if (st && st.phase === 'recover') this.free = true;
        return !!st;
      },
      draw(r) {
        this.ghosts.forEach((q, i) => {   // shadows of him along the way: solid dark, rimmed in violet, the oldest faintest
          const a = (1 - (game.time - q.t) / .4) * (.45 + .55 * (i + 1) / 5); if (a <= 0) return;
          r.actor(q.x, q.y, 0, (g, ox, oy) => h.rig.draw(g, ox, oy, r.view), { alpha: a * .75, flash: '#1c0e30', flashMix: 1, outlineColor: '#a060e0', rim: false });
        });
      },
      end() { if (h.sksFaded) { h.fade = undefined; h.sksFaded = false; } this.z = 0; } };
  }
});
// a safety net: whatever ends the step (death, a level change), he is never left invisible
BUS.on('step', () => {
  const h = ED.hero; if (!h) return;
  if (h.sksFaded && !(h.act && h.act.sksBlink)) { h.fade = undefined; h.sksFaded = false; }
  if (!h.dead) for (const b of h.buffs) if (b.sksMake && !ED.fx.includes(b.sksFx)) b.sksFx = b.sksMake();   // a new level cleared the effects, not the buffs: the blades and the aura come back
});
