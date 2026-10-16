/* =============================================================================
 * BOSSES: THE CINDER KING, THE MAGMA VENTS, THE BOSS PATTERN LIBRARY, BOSS BODIES AND THE ARENA
 * THE CINDER KING (depth 5, "The Cinder Throne"): a burnt giant who kneels before his throne, his flaming greatsword
 *   planted in the floor. He rises, roars, and flame bursts from the stones. Phase 1: a three-hit greatsword string,
 *   leaping slams and rings of fire waves. Phase 2 (60%): burning husks claw up from the floor and meteors fall.
 *   Phase 3 (30%): ablaze and hasted, he leaves the floor burning behind him and spins into a chain of fire novas.
 *   His death is slow: a stagger, his knees, a column of fire that eats him, a fountain of loot and a chest from above.
 * THE MAGMA MECHANIC ('magma'): molten fissures (the 'lava' floor tag, which the core makes burn) and vents that glow,
 *   then erupt in geysers of fire that hurt everyone. Lure monsters (and bosses: a vent scalds a boss for a share of
 *   its life and leaves it Exposed) onto them; a hit on a vent sets it off early.
 * THE PATTERN LIBRARY: boss verbs any body can use (composed bosses past depth 15 pick them at random). Every one is
 *   warned on the floor, scales with the boss (BOS_sz), strikes in its element (b.el) for its damage (b.dmg), drives
 *   a Humanoid through the rig fields it returns and squashes other bodies (BOS_kick):
 *   meteorrain firewave sweepbeam spinattack leapchain shockring spiral groundspikes teleportstrike mirror enrage
 * BOSS BODIES (bossBody): the Bone King, the Armored Colossus, the Flesh Titan, the Six-Armed Reaver.
 * THE ARENA, for every boss: it slumbers kneeling, rises and roars when woken (walking close or striking it), a name
 *   card, embers or ash in the air, element smears on every swing, a burst of its element when it dies and a treasure
 *   chest that falls from above and opens when struck. Also for every boss: leaping patterns keep their flight (the core
 *   would drop a boss that leaves the ground like a knocked-back body), lava does not burn it, a pattern cut short by a
 *   phase change never leaves it invisible. Boss spec fields this file reads (all optional): sleepRig (its slumber pose),
 *   bosRoar(b, kind) (its own roar effect: kind 'wake' | 'spawn' | 'phase'), arena: false (skip the waking, card, death
 *   burst and chest: a boss that stages its own). An archetype with ownEntrance (a body that stages its own waking and
 *   enrages) gets only the name card and its bosRoar visuals from the arena, so every boss has one entrance.
 * Private names start with BOS_. Everything here plugs in through def(), spec hooks, rig wrappers and BUS events.
 * ============================================================================= */

/* ---------- helpers ---------- */
/** open floor at a world point (no wall, pit or deep water) in a level (the current one by default) */
function BOS_openAt(L0, x, y) { const m = L0 && L0.map; return !m || m.walkable(Math.floor(x / 16), Math.floor(y / 16)); }
const BOS_open = (x, y) => BOS_openAt(ED.L, x, y);
/** the last open point on the way from (x0, y0) to (x1, y1): leaps and blinks never end inside a wall */
function BOS_reach(x0, y0, x1, y1) { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 5)); let bx = x0, by = y0; for (let i = 1; i <= n; i++) { const x = lerp(x0, x1, i / n), y = lerp(y0, y1, i / n); if (!BOS_open(x, y)) break; bx = x; by = y; } return [bx, by]; }
/** the nearest open point to (x, y) (spiralling out a few cells) */
function BOS_openNear(x, y, L0 = ED.L) { if (BOS_openAt(L0, x, y)) return [x, y]; for (let d = 8; d < 90; d += 8) for (let k = 0; k < 12; k++) { const a = k / 12 * TAU, px0 = x + Math.cos(a) * d, py0 = y + Math.sin(a) * d; if (BOS_openAt(L0, px0, py0)) return [px0, py0]; } return [x, y]; }
/** squash and stretch for any body: a Humanoid, a Blob, or a custom body with kick() */
function BOS_kick(b, v) { if (b.rig) b.rig.kick(v); else if (b.blob) b.blob.kick(v * 1.5); else if (b.body && b.body.kick) b.body.kick(v); }
/** how big a boss's attacks are: they grow gently with its scale (bosses are 1.8 .. 2.4) */
const BOS_sz = b => .55 + .25 * (b.scale || 1.8);
/** the boss's weapon hand in the world (its chest for bodies without hands) */
const BOS_hand = b => b.rig ? b.rig.hand('R') : [b.x, b.y, (b.head || 28) * .6];
/** a projectile's look in an element: physical bosses throw bone shards */
const BOS_look = (el, size = 1.7) => el === 'phys' ? { kind: 'bone' } : { kind: 'orb', size };
/** four tones of an element's flame, dark to white-hot */
const BOS_FIRE = ['#c83a1a', '#ff8a3a', '#ffe070', '#fffbe0'];
/** four tones of stone and dust, dark to light: a physical boss's eruptions are rock, not a pale grey flame (which read as a
 *  crowd of white ghosts around it) */
const BOS_STONE = ['#3a3028', '#6a5c4c', '#a08c70', '#d4c4a4'];
const BOS_tones = el => !el || el === 'fire' ? BOS_FIRE : el === 'phys' ? BOS_STONE : [EL(el).dark, EL(el).color, EL(el).light, '#ffffff'];
const BOS_near = (x, y, d) => { const h = ED.hero; return !!h && Math.hypot(h.x - x, h.y - y) < d; };
/** a flame tongue standing at screen (x, y): three nested tongues that sway with the phase t */
function BOS_flame(g, x, y, h, w, t, c = BOS_FIRE) {
  const sw = Math.sin(t) * w * .6;
  px.poly(g, [[x - w, y], [x + sw, y - h], [x + w, y]], c[0]);
  px.poly(g, [[x - w * .64, y], [x + sw * .75, y - h * .74], [x + w * .64, y]], c[1]);
  if (h > 3) px.poly(g, [[x - w * .3, y], [x + sw * .45, y - h * .42], [x + w * .3, y]], c[2]);
}
/** a crystal (or bone, or ice) spike standing at screen (x, y): a lit face, a shadow face, a bright ridge */
function BOS_spike(g, x, y, h, w, c) {
  if (h < 1) return;
  px.poly(g, [[x - w, y], [x, y - h], [x, y + 1]], c[1]); px.poly(g, [[x, y + 1], [x, y - h], [x + w, y]], c[0]);
  px.line(g, x, y - h, x - w * .45, y - h * .4, c[2]); px.dot(g, x, y - h, c[3]);
}
/** wrap one rig's draw with extras drawn from its own joints: under() before the body, over() after it (per instance) */
function BOS_wrapRig(m, under, over) {
  const rig = m.rig; if (!rig || rig.bosWrapped) return; rig.bosWrapped = true;
  const base = rig.draw;
  rig.draw = function (g, ox, oy, view) { if (under) under(g, ox, oy, view); base.call(this, g, ox, oy, view); if (over) over(g, ox, oy, view); };
}
/** the root of a unit on screen, rounded like r.actor rounds it (for rigScreen overlays in r.queue) */
const BOS_root = (r, m) => { const [x, y] = r.w(m.x, m.y, m.z || 0); return [Math.round(x), Math.round(y)]; };
/** screen pixels per rig unit (for line widths and radii of rig extras) */
const BOS_u = (rig, view) => (rig._lastView || view).scale * rig.o.size;

/* ---------- sounds ---------- */
A.define('bos_rumble', { wave: 'noise', freq: 220, to: 60, dur: .9, vol: .3, filter: 'lowpass' });
A.define('bos_geyser', [{ wave: 'noise', freq: 1500, to: 220, dur: .9, vol: .4, filter: 'lowpass' }, { wave: 'saw', freq: 95, to: 40, dur: .6, vol: .14 }]);
A.define('bos_blink', { wave: 'sine', freq: 1500, to: 220, dur: .25, vol: .2, vib: [30, .2] });
A.define('bos_chest', { wave: 'triangle', freq: 523, arp: [0, 4, 7, 12, 16, 19, 24], step: .05, dur: .6, vol: .25 });
A.define('bos_ring', [{ wave: 'saw', freq: 60, to: 190, dur: .45, vol: .16 }, { wave: 'noise', freq: 900, to: 300, dur: .45, vol: .2, filter: 'bandpass' }]);
A.define('bos_roar', [{ wave: 'saw', freq: 90, to: 55, dur: 1.1, vol: .22, vib: [10, .15] }, { wave: 'noise', freq: 500, to: 150, dur: 1.1, vol: .3, filter: 'lowpass' }, { wave: 'square', freq: 45, to: 38, dur: .9, vol: .08 }]);

/* ---------- shared effects ---------- */
/** is a hero-side unit standing in front of world point (x, y, z) and over it on screen (within hw px to the side, up px
 *  above)? Then whatever glows there is drawn in depth order (lit) rather than unlit on top of everything */
function BOS_coveredAt(r, x, y, z, hw, up) {
  const v = r.view, [kx, ky] = r.w(x, y, z), zm = v.zoom || 1, k0 = v.order(x, y, 0);
  for (const u of heroSide()) { if (v.order(u.x, u.y, 0) <= k0) continue; const [hx, hy] = r.w(u.x, u.y, u.z || 0); if (Math.abs(hx - kx) < hw + 8 * zm && hy > ky - up && hy < ky + 40 * zm) return true; }
  return false;
}
/**
 * a geyser of flame (or of any element) out of the floor: a turbulent column in four tones under a billowing crown, a splash
 * at its foot. Vent eruptions, roar bursts, the pillars of a boss's death. o: { h: height, w: half width, dur, el, light: false,
 * sparks: particles per second, bias }
 */
function BOS_column(x, y, o = {}) {
  if (o.el === 'phys') return BOS_rockBurst(x, y, o);   // physical: the floor bursts in rock and dust instead
  const H = o.h || 70, W0 = o.w || 8, dur = o.dur || 1, c = BOS_tones(o.el), seed = (Math.random() * 97) | 0;
  return FX.visual(dur, (r, u) => {
    if (!r.visible(x, y, 0, 60, H * 1.6 + 40, 40)) return;
    const grow = Math.min(1, u / .1), fade = u > .6 ? (1 - u) / .4 : 1, hh = H * E.ease.outQuad(grow) * (.45 + .55 * fade), ww = W0 * (.5 + .5 * fade) * (.8 + .2 * grow);
    r.decal(() => { r.groundDisc(x, y, ww * 1.8, c[1], .32 * fade); r.groundRing(x, y, ww * 2 + u * 10, c[2], .55 * fade); }, { emissive: .8 });
    const zm = r.view.zoom || 1;
    r.queue(x, y, 0, g => {
      const t = game.time, n = 10, Lr = [], Rr = [], T = Math.floor(t * 18);
      for (let k = 0; k <= n; k++) {   // ragged edges: each side flickers on its own
        const v = k / n, [sx, sy] = r.w(x, y, hh * v), wob = Math.sin(t * 19 + k * 1.4 + seed) * ww * .2 * zm * v, w = ww * zm * (1.06 - .34 * v);
        Lr.push([sx + wob - w * (.88 + .3 * E.hash2(k + seed, T)), sy]); Rr.push([sx + wob + w * (.88 + .3 * E.hash2(k + seed + 40, T)), sy]);
      }
      const cx = Lr.map((p, k) => (p[0] + Rr[k][0]) / 2), band = (kw, top = n) => { const out = []; for (let k = 0; k <= top; k++) out.push([cx[k] + (Lr[k][0] - cx[k]) * kw, Lr[k][1]]); for (let k = top; k >= 0; k--) out.push([cx[k] + (Rr[k][0] - cx[k]) * kw, Rr[k][1]]); return out; };
      px.glow(g, 1);
      px.blend(g, .8, 'normal', () => px.poly(g, band(1.14), c[0])); px.poly(g, band(.96), c[1]); px.poly(g, band(.58), c[2]); if (ww * zm > 2.5) px.poly(g, band(.22, n - 3), c[3]);
      for (let k = 1; k < 5; k++) { const v = k / 5, kk = Math.round(v * n), s2 = (k + seed) % 2 ? 1 : -1, p = s2 > 0 ? Rr[kk] : Lr[kk]; BOS_flame(g, p[0], p[1] + zm, (3 + 3.5 * E.hash2(k + seed, Math.floor(t * 12))) * zm, 1.4 * zm, t * 13 + k, c); }
      // the crown: puffs that roll up off the top, swell, redden and thin out
      const [tx, ty] = r.w(x, y, hh), R = ww * zm, up = r.view.bz;
      for (let k = 4; k >= 0; k--) {
        const ph = (t * 1.6 + k / 5 + seed * .13) % 1, rad = R * (1 - .45 * ph) * (k % 2 ? .8 : 1), px0 = tx + Math.sin(k * 2.3 + seed) * R * .55 * (1 + ph * .6), py0 = ty + up * R * 1.3 * ph;
        px.disc(g, px0, py0, rad * 1.14, c[0]); px.disc(g, px0, py0, rad, ph < .6 ? c[1] : c[0]); if (ph < .35) px.disc(g, px0 - rad * .2, py0 - rad * .2, rad * .5, c[2]);
      }
      px.disc(g, tx, ty, R * .7, c[2]); if (R > 3) px.disc(g, tx - R * .2, ty - R * .15, R * .28, c[3]);
    }, { emissive: !BOS_coveredAt(r, x, y, 0, ww * zm * 1.6, (hh + ww) * zm * 1.2), bias: o.bias || .05 });
    if (o.light !== false) L.add(x, y, hh * .4, 30 + H * .9, 1.3 * fade, { color: c[1] });
  }, (f, dt) => {
    const u = f.t / dur; if (Math.random() < (o.sparks || 30) * dt * (u < .7 ? 1 : .3)) P.add({ kind: Math.random() < .5 ? 'fire' : 'ember', x: x + (rnd() - .5) * W0, y: y + (rnd() - .5) * W0, z: rnd() * H * .8, vx: (rnd() - .5) * 30, vy: (rnd() - .5) * 30, vz: 50 + rnd() * 70, g: -10, drag: 1.5, max: .45 + rnd() * .4, size: 1.6 + rnd() * 1.8, color: c[1] });
    if (u < .8 && Math.random() < dt * H * .06) P.smoke(x, y, H * .9, 1, { size: W0 * .5, color: '#5a4a4a', dark: '#2a2024', light: '#7a6a68' });
  });
}
/**
 * the stone twin of BOS_column: the floor cracks and a cluster of rock spikes bursts up (the tallest in the middle, each a beat
 * after the last, overshooting), holds, and sinks back while dust rolls off it; a tall one (a death) raises a plume of dust
 */
function BOS_rockBurst(x, y, o = {}) {
  const H0 = o.h || 70, H = Math.min(44, H0 * .62), W0 = o.w || 8, dur = o.dur || 1, seed = (Math.random() * 997) | 0, n = W0 > 7 ? 7 : 4, rocks = [];
  for (let i = 0; i < n; i++) { const a = E.hash2(i, seed) * TAU, d = i ? W0 * (.45 + .75 * E.hash2(i + 9, seed)) : 0; rocks.push({ dx: Math.cos(a) * d, dy: Math.sin(a) * d, h: H * (i ? .38 + .42 * E.hash2(i + 3, seed) : 1), w: W0 * (i ? .32 + .2 * E.hash2(i + 5, seed) : .55), at: i * .025 }); }
  P.bits(x, y, 3, 3 + n, BOS_STONE.slice(0, 3)); P.dust(x, y, 0, 2 + n, { speed: 30 + W0 * 4 });
  return FX.visual(dur, (r, u) => {
    if (!r.visible(x, y, 0, 40, H * 1.5 + 20, 30)) return;
    const fade = u > .72 ? (1 - u) / .28 : 1, v = r.view;
    r.decal(() => { r.groundDisc(x, y, W0 * 1.5, '#1a140f', .5 * fade); r.groundRing(x, y, W0 * 1.7 + u * 5, BOS_STONE[1], .45 * fade); });
    for (const k of rocks) {   // each spike is queued at its own foot, so the hero and the boss sort among them
      const px0 = x + k.dx, py0 = y + k.dy, t = clamp((u * dur - k.at) / .1, 0, 1); if (t <= 0) continue;
      r.queue(px0, py0, 0, g => { const zm = v.zoom || 1, [sx, sy] = r.w(px0, py0, 0), hh = k.h * E.ease.outBack(t) * fade * zm, w = Math.max(1.2, k.w * zm); BOS_spike(g, sx, sy + zm, hh, w, BOS_STONE); if (hh > 6) px.line(g, sx - w * .55, sy - hh * .35, sx - w * .15, sy - hh * .55, BOS_STONE[0]); });   // (a crack across the lit face)
    }
  }, (f, dt) => {
    const u = f.t / dur; if (u > .85) return;
    if (Math.random() < dt * (6 + W0)) P.add({ kind: 'dust', x: x + (rnd() - .5) * W0 * 2, y: y + (rnd() - .5) * W0 * 2, z: rnd() * H * .5, vx: (rnd() - .5) * 24, vy: (rnd() - .5) * 24, vz: 10 + rnd() * 18, g: -4, drag: 2, max: .6 + rnd() * .5, size: 1.4 + rnd() * 1.4, color: rnd() < .5 ? '#8a7a66' : '#5e5244' });
    if (H0 > 60 && u < .6 && Math.random() < dt * 10) P.smoke(x + (rnd() - .5) * W0, y + (rnd() - .5) * W0, H * .6 + rnd() * H, 1, { size: W0 * .6, color: '#6a5e50', dark: '#3a322a', light: '#9a8c78' });
  });
}
/** rings of small element pillars bursting out of the floor around (x, y): a roar, a waking, a death */
function BOS_burstRings(x, y, el, rings = 2, o = {}) {
  const h = ED.hero;
  for (let k = 0; k < rings; k++) game.after(k * .15, () => {
    const n = 7 + k * 4, R = (o.r0 || 22) + k * (o.step || 19), off = k * .4;
    for (let i = 0; i < n; i++) { const a = off + i / n * TAU, px0 = x + Math.cos(a) * R, py0 = y + Math.sin(a) * R; if (BOS_open(px0, py0)) BOS_column(px0, py0, { h: 14 + 5 * k, w: 4.6, dur: .5 + k * .05, el, light: i % 4 === 0, sparks: 5 }); }
    P.ring(x, y, R - 6, R + 8, BOS_tones(el)[2], .35); shake(2 + k); sfx('explode', { vol: .25 });
    if (h && h.alive && Math.hypot(h.x - x, h.y - y) < R + 10) knock(h, angTo({ x, y }, h), 160);
  });
}

/**
 * a wave that runs along the floor from the boss: flame tongues (fire) or crystal spikes (every other element) spring up
 * behind its front and sink back. It hits each unit of the hero's side once (like FX.wave, without its particle storm,
 * so a dozen of them at once stay readable). o: { speed, len, w, el, dmg (x b.dmg), kb, up, h (spike height) }
 */
function BOS_wave(b, ang, o = {}) {
  const el = o.el || b.el, hel = b.el, c = BOS_tones(el), ca = Math.cos(ang), sa = Math.sin(ang), H = o.h || 12;
  const f = addFx({ kind: 'bosWave', t: 0, x: b.x, y: b.y, len: o.len || 150, speed: o.speed || 180, w: o.w || 12, set: new Set(), marks: [], last: -9, end: 0 });
  f.update = dt => {
    f.t += dt; const d = f.t * f.speed, map = ED.L && ED.L.map;
    if (d <= f.len) {
      const hx = f.x + ca * d, hy = f.y + sa * d;
      if ((map && map.solidAt(hx, hy)) || (d > b.r + 4 && ED.L.things.some(q => q.solid && !q.dead && Math.hypot(q.x - hx, q.y - hy) < q.r))) f.len = d;   // walls and the throne break it
      else {
        hitCircle('foe', hx, hy, f.w / 2, () => ({ src: b, amount: b.dmg * (o.dmg || .8), el: hel, kb: o.kb || 110, ang, up: o.up || 0 }), f.set);
        if (d - f.last > 8 && d > b.r * .9) { f.last = d; const j = (rnd() - .5) * f.w * .5; f.marks.push({ x: hx - sa * j, y: hy + ca * j, t: game.time, s: rnd() }); if (rnd() < .3) P.add({ kind: el === 'fire' ? 'fire' : 'ember', x: hx, y: hy, z: 3, vz: 25, g: -8, drag: 2, max: .35, size: 1.8, color: c[1] }); }
      }
      f.end = game.time;
    }
    return d <= f.len || game.time - f.end < .6;
  };
  f.draw = r => {
    const zm = r.view.zoom || 1;
    for (const m of f.marks) {
      const age = game.time - m.t, a = 1 - age / .6; if (a <= 0 || !r.visible(m.x, m.y, 0, 20, 40, 20)) continue;
      const hh = H * (.7 + .5 * m.s) * Math.sin(Math.min(1, age * 9) * Math.PI / 2) * Math.min(1, a * 2.2) * zm;
      r.queue(m.x, m.y, 0, g => {
        const [x, y] = r.w(m.x, m.y, 0); px.glow(g, el === 'phys' ? 0 : 1);
        if (el === 'fire') { BOS_flame(g, x, y, hh, 2.4 * zm, game.time * 12 + m.s * 9); if (m.s > .5) BOS_flame(g, x + 2.5 * zm, y + zm, hh * .6, 1.6 * zm, game.time * 14 + m.s * 5); }
        else { BOS_spike(g, x, y + zm, hh, 2.2 * zm, c); BOS_spike(g, x - 2.6 * zm, y, hh * (.4 + m.s * .3), 1.5 * zm, c); BOS_spike(g, x + 2.4 * zm, y - zm, hh * (.35 + (1 - m.s) * .3), 1.4 * zm, c); }
      }, { emissive: el !== 'phys' });
    }
    if (game.time - f.end < .2) L.add(f.x + ca * Math.min(f.len, f.t * f.speed), f.y + sa * Math.min(f.len, f.t * f.speed), 6, 40, .5, { color: c[1] });
  };
  return f;
}
/** a move from E.MOVES with explicit heights: the engine's side-plane moves (plunge, overhead, twohand...) carry no z0 / z1, which
 *  leaves a rig's attack height NaN for a few frames after them (a hand that vanishes as the arm blends back) */
const BOS_mv = (name, over) => Object.assign({ wind: .06, active: .1, recover: .18 }, E.MOVES[name] || E.MOVES.slash, { name, z0: -7, z1: -7 }, over || {});
/** 'drive': both hands raise the weapon high overhead, then bring it down point-first into the floor before the feet */
const BOS_DRIVE = BOS_mv('plunge', { name: 'drive', hand: 'both', a0: 2.3, a1: -1.4, r0: 6, r1: 8.5, crouch: .6, lean: .55, lunge: 1.6, hold: .7 });

/* =============================================================================
 * THE PATTERN LIBRARY. A pattern is def('patterns', id, { name, range: [near, far], start(b, phase) -> runtime
 * { update(dt) -> keep going?, rig: { rig fields for the body } } }). b is the boss: b.el, b.dmg, b.scale, b.r,
 * b.head, b.phase (0, 1, 2), b.rig (a Humanoid) or b.blob / b.body. Every one warns before it hurts.
 * ============================================================================= */

// meteorrain: the boss calls the sky down. Warned circles, the first on the hero, then ahead of him and around him
def('patterns', 'meteorrain', { name: 'Meteor Rain', role: 'zone', range: [0, 420], start(b) {
  const h = ED.hero, n = 6 + 2 * Math.min(3, b.phase), el = b.el, z = BOS_sz(b);
  let k = 0; sfx('bos_rumble', { vol: .5 }); shake(2);
  return { t: 0, rig: { pose: 'cheer' }, update(dt) {
    this.t += dt; b.vx *= .85; b.vy *= .85;
    if (this.t > .45 && k < n && this.t > .45 + k * .17) {
      let x, y;
      if (k === 0) { x = h.x; y = h.y; } else if (k % 3 === 1) { x = h.x + h.vx * .8; y = h.y + h.vy * .8; } else { const a = rnd() * TAU, d = 22 + rnd() * 72; x = h.x + Math.cos(a) * d; y = h.y + Math.sin(a) * d; }
      if (BOS_open(x, y)) FX.meteor({ team: 'foe', src: b, x, y, r: 15 * z, delay: 1.05, el, size: .7 + .25 * z, burn: el === 'fire' || el === 'venom' || el === 'void' ? 2.2 : 0, hit: { amount: b.dmg * .9, kb: 110 } });
      k++;
    }
    const up = this.t < .45 + n * .17;
    if (up && Math.random() < .5) { const p = BOS_hand(b); elBurst(p[0], p[1], p[2] + 4, el, 1); }
    this.rig = { pose: up ? 'cheer' : null, expr: up ? 'shout' : 'angry' };
    return this.t < .75 + n * .17;
  } };
} });

// firewave: the weapon is driven into the floor and rings of waves run out along warned spokes: stand in the gaps.
// Each ring is turned half a spoke from the last, so the safe gaps move
def('patterns', 'firewave', { name: 'Fire Wave', role: 'zone', range: [0, 170], start(b) {
  const el = b.el, z = BOS_sz(b), rings = 2 + (b.phase > 0 ? 1 : 0), n = 8 + Math.min(2, b.phase), len = 150 * z, wind = .8, gap = .65, off = rnd() * TAU, sp = BOS_DRIVE;
  const spokes = i => { const out = []; for (let k = 0; k < n; k++) out.push(off + (k + (i % 2) * .5) / n * TAU); return out; };
  const warn = (i, dur) => { for (const a of spokes(i)) FX.telegraph({ shape: 'line', x: b.x, y: b.y, ang: a, len, w: 10, dur, owner: b }); };
  warn(0, wind); let fired = 0;
  const hitT = wind + .12, ringT = i => hitT + i * gap, endT = ringT(rings - 1) + .25;
  return { t: 0, rig: {}, update(dt) {
    this.t += dt; const t = this.t; b.vx = b.vy = 0;
    // up over the head, down into the floor, held there while the rings go, then wrenched out
    this.rig = t < wind ? { attack: { spec: sp, phase: 'wind', u: t / wind }, expr: 'angry' } : t < endT ? { attack: { spec: sp, phase: 'active', u: Math.min(1, (t - wind) / .12) }, expr: 'shout' } : { attack: { spec: sp, phase: 'recover', u: Math.min(1, (t - endT) / .45) }, expr: 'angry' };
    if (fired < rings && t >= ringT(fired)) {
      for (const a of spokes(fired)) BOS_wave(b, a, { speed: 170, len, w: 13, dmg: .85, kb: 120, h: 13 });
      if (fired === 0) { shake(5); sfx('boom', { vol: .5 }); game.freeze(.04); FX.scorch(b.x, b.y, 16 * z); P.dust(b.x, b.y, 0, 14, { speed: 70 }); BOS_kick(b, -5); const tp = b.rig ? b.rig.tip() : [b.x, b.y, 0]; elBurst(tp[0], tp[1], 2, el, 14); }
      else { shake(2); sfx('explode', { vol: .3 }); }
      P.ring(b.x, b.y, 4, 30 * z, EL(el).light, .35);
      fired++; if (fired < rings) warn(fired, gap);
    }
    return t < endT + .5;
  } };
} });

// sweepbeam: the whole sector it will sweep is warned first, then a beam pours from the boss's hands across it
def('patterns', 'sweepbeam', { name: 'Sweeping Beam', role: 'zone', range: [40, 230], start(b) {
  const h = ED.hero, el = b.el, dir = rnd.chance(.5) ? 1 : -1, arc = 1.8 + .25 * Math.min(2, b.phase), dur = 1.6 + .25 * Math.min(2, b.phase), warm = .85, len = 200;
  const a0 = angTo(b, h) - dir * arc * .5;
  FX.telegraph({ shape: 'arc', x: b.x, y: b.y, r: len * .8, ang: a0 + dir * arc * .5, half: arc * .5, dur: warm, owner: b });
  let beam = null;
  return { t: 0, rig: { pose: 'cast' }, update(dt) {
    this.t += dt; b.vx = b.vy = 0;
    if (!beam) { b.facing = E.approachAng(b.facing, a0, dt * 8); if (this.t > .3) beam = FX.beam({ team: 'foe', src: b, from: b, x: b.x, y: b.y, z: (b.head || 28) * .45, ang: a0, turn: 0, len, w: 4 + 2 * (b.scale || 1.8), dur: warm - .3 + dur, warm: warm - .3, tick: .12, el, hit: { amount: b.dmg * .4, kb: 50 } }); }
    else { beam.turn = this.t > warm ? dir * arc / dur : 0; b.facing = beam.ang; if (Math.random() < .4) { const p = BOS_hand(b); elBurst(p[0], p[1], p[2], el, 1); } }
    this.rig = { pose: 'cast', expr: this.t > warm ? 'shout' : 'angry' };
    return this.t < warm + dur + .35;
  } };
} });

/** a whirlwind drawn on the floor around a spinning boss: element arcs racing round it */
function BOS_whirl(b, R, dur) {
  const c = BOS_tones(b.el);
  return FX.visual(dur, (r, u) => {
    const a = Math.min(1, u * 8, (1 - u) * 8), sp = game.time * 14;
    r.decal(() => { for (let k = 0; k < 3; k++) r.groundArc(b.x, b.y, R * (.55 + k * .15), R * (.55 + k * .15) + 2.5, sp + k * 2.1, sp + k * 2.1 + 1.7, c[1 + (k % 2)], .55 * a); r.groundRing(b.x, b.y, R, c[1], .45 * a); }, { emissive: .6 });
  });
}
// spinattack: a crouch inside a warned circle, a whirlwind that chases the hero (slower than he runs), then a dizzy moment to punish
def('patterns', 'spinattack', { name: 'Whirlwind', role: 'close', range: [0, 140], start(b) {
  const h = ED.hero, el = b.el, z = BOS_sz(b), R = b.r + 16 * z, spinT = 2.2 + .5 * Math.min(2, b.phase), sp = E.move('spin').spec, set = new Set();
  FX.telegraph({ shape: 'circle', x: b.x, y: b.y, r: R, dur: .6, owner: b, follow: b });
  let hitT = 0, dir = angTo(b, h), fx = null;
  return { t: 0, rig: { pose: 'crouch' }, update(dt) {
    this.t += dt; const t = this.t;
    if (t < .6) { b.vx *= .8; b.vy *= .8; AI.face(b, angTo(b, h), dt, 6); this.rig = { pose: 'crouch', expr: 'angry' }; return true; }
    if (t < .6 + spinT) {
      if (!fx) { fx = BOS_whirl(b, R, spinT); sfx('whoosh', { pitch: .6 }); }
      const ph = (t - .6) * 2.8 % 1; this.rig = { attack: { spec: sp, phase: 'active', u: 1 - Math.cbrt(1 - ph) }, expr: 'shout' };   // an even turn: undo the move's ease
      dir = E.approachAng(dir, angTo(b, h), dt * 1.5); const v = (b.speed || 30) * 1.5 + 22; b.vx = Math.cos(dir) * v; b.vy = Math.sin(dir) * v;
      hitT -= dt; if (hitT <= 0) { hitT = .32; set.clear(); if (hitCircle('foe', b.x, b.y, R, u => ({ src: b, amount: b.dmg * .65, el, kb: 180, ang: Math.atan2(u.y - b.y, u.x - b.x) }), set)) shake(2); if (Math.random() < .5) sfx('whoosh', { vol: .3, pitch: .7 + rnd() * .3 }); }
      if (!b.rig && Math.random() < dt * 8) BOS_kick(b, 2);
      if (Math.random() < dt * 24) { const a = rnd() * TAU; P.add({ kind: 'dust', x: b.x + Math.cos(a) * R * .8, y: b.y + Math.sin(a) * R * .8, z: 2, vx: -Math.sin(a) * 70, vy: Math.cos(a) * 70, vz: 14, drag: 3, max: .45, size: 1.7, color: '#9a8a78' }); }
      if (Math.random() < dt * 10) { const p = b.rig ? b.rig.tip() : [b.x, b.y, 10]; elBurst(p[0], p[1], p[2], el, 2); }
      return true;
    }
    b.vx *= .88; b.vy *= .88; this.rig = { expr: 'wince' };
    if (Math.random() < dt * 6) P.glints(b.x, b.y, (b.head || 28) + 4, 1, '#fff2c4', 10);   // dizzy stars
    return t < .6 + spinT + .9;
  } };
} });

// leapchain: three leaps at the hero, each landing warned by a circle that fills as the boss comes down; the last lands
// with a ring of waves
def('patterns', 'leapchain', { name: 'Leap Chain', role: 'close', range: [40, 280], start(b) {
  const h = ED.hero, el = b.el, z = BOS_sz(b), n = 3, air = .6, sp = BOS_mv('plunge');
  let i = 0, st = 'crouch', t = 0, sx = b.x, sy = b.y, tx = b.x, ty = b.y, H = 40;
  const crouchT = k => k ? .24 : .45, rad = k => (k === n - 1 ? 34 : 24) * z;
  const aim = () => { [tx, ty] = BOS_reach(b.x, b.y, h.x + h.vx * .3, h.y + h.vy * .3); sx = b.x; sy = b.y; H = 34 + 12 * z + Math.hypot(tx - sx, ty - sy) * .15; FX.telegraph({ shape: 'circle', x: tx, y: ty, r: rad(i), dur: crouchT(i) + air, owner: b }); };
  const land = () => {
    const last = i === n - 1, rr = rad(i);
    FX.nova({ team: 'foe', src: b, x: b.x, y: b.y, r0: 6, r1: rr, dur: .22, el, hit: { amount: b.dmg * (last ? 1.4 : 1.1), kb: 220 } });
    P.dust(b.x, b.y, 0, 18, { speed: 80 }); FX.scorch(b.x, b.y, rr * .6); shake(last ? 7 : 5); sfx(last ? 'boom' : 'thud'); game.freeze(.04); BOS_kick(b, -6); elBurst(b.x, b.y, 2, el, 10);
    if (last) for (let k = 0; k < 8; k++) BOS_wave(b, k / 8 * TAU + .2, { speed: 190, len: 110 * z, w: 12, dmg: .8, kb: 120 });
  };
  aim();
  return { t: 0, rig: { pose: 'crouch' }, update(dt) {
    t += dt;
    if (st === 'crouch') { b.vx = b.vy = 0; AI.face(b, Math.atan2(ty - b.y, tx - b.x), dt, 10); this.rig = { pose: 'crouch', expr: 'angry' }; if (t >= crouchT(i)) { st = 'air'; t = 0; BOS_kick(b, 5); sfx('jump', { pitch: .5 }); P.dust(b.x, b.y, 0, 8); } return true; }
    if (st === 'air') {
      const u = Math.min(1, t / air), e = E.ease.inOut(u);
      b.x = lerp(sx, tx, e); b.y = lerp(sy, ty, e); b.z = Math.sin(u * Math.PI) * H; b.vx = b.vy = 0;
      this.rig = { air: true, attack: { spec: sp, phase: u < .5 ? 'wind' : 'active', u: u < .5 ? u * 2 : (u - .5) * 2 }, expr: 'shout' };
      if (u >= 1) { b.z = 0; st = 'land'; t = 0; land(); }
      return true;
    }
    this.rig = { pose: 'crouch', attack: { spec: sp, phase: 'recover', u: Math.min(1, t / .3) } };
    if (t >= (i === n - 1 ? .6 : .3)) { i++; if (i >= n) return false; st = 'crouch'; t = 0; aim(); }
    return true;
  } };
} });

/** the floor warning for a shock ring: red where the ring will run, a cool blue lane where its gap will be */
function BOS_gapWarn(b, gapA, gw, max, dur) {
  const x = b.x, y = b.y, r0 = b.r + 4;
  return FX.visual(dur, (r, u) => {
    const R1 = lerp(r0 + 8, max, E.ease.outQuad(Math.min(1, u * 1.3)));
    r.decal(() => {
      r.groundArc(x, y, r0, R1, gapA + gw, gapA + TAU - gw, '#ff4a3a', .1 + .17 * u);
      r.groundArc(x, y, r0, max, gapA - gw, gapA + gw, '#8fe3ff', .16 + .24 * u);
      for (const s of [-1, 1]) r.groundArc(x, y, r0, max, gapA + s * gw - .012, gapA + s * gw + .012, '#e8fbff', .5 + .4 * u);
    }, { emissive: .5 });
  });
}
/** an expanding ring wall with a gap: a unit on the ground that the front crosses outside the gap is hit once */
function BOS_ringWave(b, gapA, gw, o = {}) {
  const el = b.el, c = BOS_tones(el), f = addFx({ kind: 'bosRing', t: 0, x: b.x, y: b.y, R: b.r + 4, max: o.max || 170, speed: o.speed || 100, set: new Set() });
  const inGap = a => Math.abs(E.angDiff(gapA, a)) < gw;
  f.update = dt => {
    f.t += dt; f.R += f.speed * dt;
    for (const u of heroSide()) {
      if (f.set.has(u)) continue; const d = Math.hypot(u.x - f.x, u.y - f.y);
      if (Math.abs(d - f.R) < 4 + u.r && (u.z || 0) < 10 && !inGap(Math.atan2(u.y - f.y, u.x - f.x))) { f.set.add(u); dealDamage(u, { src: b, amount: b.dmg * (o.dmg || 1), el, kb: 190, ang: Math.atan2(u.y - f.y, u.x - f.x) }); }
    }
    return f.R < f.max;
  };
  f.draw = r => {
    const R = f.R, a = clamp((f.max - R) / 30, 0, 1), n = Math.min(56, Math.max(18, Math.round(R * TAU / 10))), zm = r.view.zoom || 1, hh = (el === 'fire' ? 10 : 8) * zm * (.4 + .6 * a);
    r.decal(() => { r.groundArc(f.x, f.y, R - 3, R + 1, gapA + gw, gapA + TAU - gw, c[1], .7 * a); r.groundArc(f.x, f.y, R - 7, R - 3, gapA + gw, gapA + TAU - gw, c[0], .3 * a); }, { emissive: .7 });
    for (let i = 0; i < n; i++) {
      const an = gapA + gw + (TAU - 2 * gw) * (i + .5) / n, x = f.x + Math.cos(an) * R, y = f.y + Math.sin(an) * R;
      if (!r.visible(x, y, 0, 20, 30, 20)) continue;
      const hs = hh * (.7 + .6 * E.hash2(i, Math.floor(f.t * 20)));
      r.queue(x, y, 0, g => { const [sx, sy] = r.w(x, y, 0); px.glow(g, 1); if (el === 'fire') BOS_flame(g, sx, sy, hs, 2.3 * zm, f.t * 12 + i, c); else BOS_spike(g, sx, sy, hs, 2 * zm, c); }, { emissive: el !== 'phys' });
    }
    L.add(f.x, f.y, 6, R + 30, .45 * a, { color: c[1] });
  };
  return f;
}
// shockring: the boss pounds the floor again and again; each blow sends a ring wall out with one gap, shown on the floor first
def('patterns', 'shockring', { name: 'Shock Rings', role: 'zone', range: [0, 170], start(b) {
  const h = ED.hero, n = 2 + (b.phase > 0 ? 1 : 0), warn = .85, every = 1.05, max = 165 * BOS_sz(b) / 1.05, gw = .42, sp = BOS_mv('overhead');
  const plan = []; let g0 = angTo(b, h) + (rnd() - .5) * 2.6;
  for (let i = 0; i < n; i++) { plan.push(g0); g0 += (rnd.chance(.5) ? 1 : -1) * (1.3 + rnd() * 1.5); }
  BOS_gapWarn(b, plan[0], gw, max, warn);
  let k = 0, last = -9;
  const fireT = i => warn + i * every;
  return { t: 0, rig: {}, update(dt) {
    this.t += dt; const t = this.t; b.vx = b.vy = 0;
    const since = t - last, until = k < n ? fireT(k) - t : 99;
    this.rig = since < .08 ? { attack: { spec: sp, phase: 'active', u: since / .08 }, expr: 'shout' } : until < .45 ? { attack: { spec: sp, phase: 'wind', u: 1 - until / .45 }, expr: 'angry' } : since < .5 ? { attack: { spec: sp, phase: 'recover', u: (since - .08) / .42 }, expr: 'angry' } : { expr: 'angry' };
    if (k < n && t >= fireT(k)) {
      BOS_ringWave(b, plan[k], gw, { max, speed: 100 }); last = t;
      shake(4); sfx('bos_ring'); game.freeze(.03); BOS_kick(b, -4); P.dust(b.x, b.y, 0, 10, { speed: 60 }); elBurst(b.x, b.y, 2, b.el, 8);
      k++; if (k < n) BOS_gapWarn(b, plan[k], gw, max, every);
    }
    return t < fireT(n - 1) + .7;
  } };
} });

// spiral: motes gather into the boss, then arms of bolts pour out and turn slowly: step into the widening gaps
def('patterns', 'spiral', { name: 'Bolt Spiral', role: 'zone', range: [0, 220], start(b) {
  const el = b.el, arms = Math.min(5, 3 + b.phase), dur = 2 + .4 * Math.min(2, b.phase), dir = rnd.chance(.5) ? 1 : -1, z0 = (b.head || 28) * .42, charge = .75, col = EL(el).color;
  let a = rnd() * TAU, next = 0, vol = 0;
  FX.telegraph({ shape: 'circle', x: b.x, y: b.y, r: 22 * BOS_sz(b), dur: charge, owner: b, follow: b });
  return { t: 0, rig: { pose: 'cast' }, update(dt) {
    this.t += dt; b.vx = b.vy = 0;
    if (this.t < charge) {
      if (Math.random() < .7) { const q = rnd() * TAU, d = 26 + rnd() * 10; P.add({ kind: 'ember', x: b.x + Math.cos(q) * d, y: b.y + Math.sin(q) * d, z: z0 + (rnd() - .5) * 12, vx: -Math.cos(q) * d * 2, vy: -Math.sin(q) * d * 2, drag: 1, max: .45, color: col }); }
      this.rig = { pose: 'cast', expr: 'angry' }; return true;
    }
    a += dir * 1.35 * dt; next -= dt;
    if (next <= 0) { next = .14; vol++; for (let k = 0; k < arms; k++) FX.bolt({ team: 'foe', src: b, x: b.x, y: b.y, z: z0, ang: a + k / arms * TAU, speed: 82, life: 3.2, r: 3, el, hit: { amount: b.dmg * .45, kb: 50 }, look: BOS_look(el, 1.5), light: 0 }); if (vol % 2) sfx('shoot', { vol: .14, pitch: .55 }); }
    b.facing = a; this.rig = { pose: 'cast', expr: 'shout' };
    return this.t < charge + dur;
  } };
} });

/** a line of crystal spikes (in the element's colors) bursting up and sinking back; fire bosses raise spikes of obsidian */
const BOS_spikeWave = (b, ang, len) => BOS_wave(b, ang, { speed: 240, len, w: 13, dmg: .8, kb: 90, up: 120, h: 14, el: b.el === 'fire' ? 'phys' : b.el });
// groundspikes: the weapon hammers the floor; each blow bursts warned lines of spikes outward, each set turned between the last
def('patterns', 'groundspikes', { name: 'Ground Spikes', role: 'zone', range: [0, 190], start(b) {
  const z = BOS_sz(b), blows = 2 + Math.min(2, b.phase), n = 6, len = 150 * z, every = .8, first = .6, sp = BOS_mv('overhead'), off = rnd() * TAU;
  const lines = i => { const out = []; for (let j = 0; j < n; j++) out.push(off + (j + (i % 2) * .5) / n * TAU); return out; };
  const warn = (i, dur) => { for (const a of lines(i)) FX.telegraph({ shape: 'line', x: b.x, y: b.y, ang: a, len, w: 12, dur, owner: b }); };
  warn(0, first);
  let k = 0, last = -9;
  const fireT = i => first + i * every;
  return { t: 0, rig: {}, update(dt) {
    this.t += dt; const t = this.t; b.vx = b.vy = 0;
    const since = t - last, until = k < blows ? fireT(k) - t : 99;
    this.rig = since < .08 ? { attack: { spec: sp, phase: 'active', u: since / .08 }, expr: 'shout' } : until < .42 ? { attack: { spec: sp, phase: 'wind', u: 1 - until / .42 }, expr: 'angry' } : since < .45 ? { attack: { spec: sp, phase: 'recover', u: (since - .08) / .37 }, expr: 'angry' } : { expr: 'angry' };
    if (k < blows && t >= fireT(k)) {
      for (const a of lines(k)) BOS_spikeWave(b, a, len);
      last = t; shake(4); sfx('crack'); sfx('thud', { vol: .5 }); game.freeze(.03); BOS_kick(b, -4); P.dust(b.x, b.y, 0, 12, { speed: 70 });
      k++; if (k < blows) warn(k, every);
    }
    return t < fireT(blows - 1) + .6;
  } };
} });

/** a spot next to the hero, behind him if it is open, else to his sides, else in front */
function BOS_besideHero(d) {
  const h = ED.hero;
  for (const off of [Math.PI, Math.PI * .6, -Math.PI * .6, Math.PI / 2, -Math.PI / 2, 0]) { const a = h.facing + off, [x, y] = BOS_reach(h.x, h.y, h.x + Math.cos(a) * d, h.y + Math.sin(a) * d); if (Math.hypot(x - h.x, y - h.y) > d * .7) return [x, y]; }
  return [h.x, h.y];
}
/** motes of an element streaming off (dir 1) or into (dir -1) a body */
function BOS_motes(b, el, dir = 1) {
  const q = rnd() * TAU, d = dir > 0 ? 3 : 26, z = rnd() * (b.head || 28);
  P.add({ kind: 'ember', x: b.x + Math.cos(q) * d, y: b.y + Math.sin(q) * d, z, vx: Math.cos(q) * 40 * dir, vy: Math.sin(q) * 40 * dir, vz: 15, drag: 1.5, max: .5, color: EL(el).color });
}
// teleportstrike: the boss dissolves, a circle opens behind the hero (in the element's color), it steps out and strikes
def('patterns', 'teleportstrike', { name: 'Blink Strike', role: 'close', range: [50, 420], start(b) {
  const h = ED.hero, el = b.el, z = BOS_sz(b), R = b.r + 22 * z;
  let st = 'out', t = 0, tx = 0, ty = 0, atk = null;
  sfx('bos_blink'); elBurst(b.x, b.y, (b.head || 28) * .5, el, 12); b.bosVanish = true;
  return { t: 0, rig: { pose: 'crouch' }, update(dt) {
    t += dt; b.vx = b.vy = 0;
    if (st === 'out') {
      b.fade = Math.max(0, 1 - t / .35); this.rig = { pose: 'crouch', expr: 'angry' }; if (Math.random() < .7) BOS_motes(b, el, 1);
      if (t >= .35) { st = 'gone'; t = 0; b.fade = 0; b.untargetable = true; [tx, ty] = BOS_besideHero(b.r + h.r + 12 * z); FX.telegraph({ shape: 'circle', x: tx, y: ty, r: b.r + 6, dur: .55, owner: b, color: EL(el).color }); }
      return true;
    }
    if (st === 'gone') {
      if (Math.random() < .6) P.add({ kind: 'ember', x: tx + (rnd() - .5) * b.r * 2, y: ty + (rnd() - .5) * b.r * 2, z: 1, vz: 40, max: .5, color: EL(el).color });
      if (t >= .55) {
        st = 'in'; t = 0; b.x = tx; b.y = ty; b.untargetable = false; b.facing = angTo(b, h);
        atk = new E.Attack(BOS_mv('overhead', { wind: .45, active: .1, recover: .5 })); atk.start();
        FX.telegraph({ shape: 'arc', x: b.x, y: b.y, r: R, ang: b.facing, half: .85, dur: .5, owner: b, follow: b, followAng: true });
        elBurst(b.x, b.y, 10, el, 14); P.ring(b.x, b.y, 3, 24, EL(el).light, .3); sfx('bos_blink', { pitch: .6 }); BOS_kick(b, 4);
      }
      return true;
    }
    if (b.bosVanish) { b.fade = Math.min(1, t / .15); if (b.fade >= 1) { b.fade = undefined; b.bosVanish = false; } }
    const began = atk.update(dt); if (atk.phase === 'wind') AI.face(b, angTo(b, h), dt, 2.2);
    if (began === 'active') {
      hitCone('foe', b.x, b.y, b.facing, R, .85, () => ({ src: b, amount: b.dmg * 1.5, el, kb: 220, ang: b.facing, knockdown: true }));
      shake(5); sfx('slash2'); sfx('kick'); BOS_kick(b, -3);
      const tp = b.rig ? b.rig.tip() : [b.x + Math.cos(b.facing) * R, b.y + Math.sin(b.facing) * R, 2]; elBurst(tp[0], tp[1], 2, el, 10); FX.scorch(tp[0], tp[1], 8);
    }
    this.rig = { attack: atk.state, expr: 'angry' };
    return atk.busy;
  } };
} });

/* ---- mirror images: illusions of the boss (its own body, shimmering) that each cast at the hero ---- */
/** the illusions' mind: face the hero, shimmer (the real boss never does), warn with a line, then shoot along it */
function BOS_cloneAI(m, dt) {
  const h = ED.hero; if (!h) return;
  m.vx *= .85; m.vy *= .85; AI.face(m, angTo(m, h), dt, 5);
  m.fade = .5 + .25 * Math.sin(game.time * 9 + m.ph);
  m.bosCloneT -= dt; m.shotT -= dt;
  const charging = m.shotT < .6;
  if (charging && !m.bosTele) m.bosTele = FX.telegraph({ shape: 'line', x: m.x, y: m.y, ang: angTo(m, h), len: 170, w: 8, dur: Math.max(.1, m.shotT), owner: m });
  if (m.shotT <= 0) {
    const src = m.bosCloneOf || m;
    FX.bolt({ team: 'foe', src: m, x: m.x, y: m.y, z: (m.head || 28) * .45, ang: m.bosTele ? m.bosTele.ang : angTo(m, h), speed: 130, life: 1.9, r: 3, el: m.el, hit: { amount: src.dmg * .5, kb: 60 }, look: BOS_look(m.el, 1.8), light: 24 });
    sfx('shoot', { vol: .2, pitch: .8 }); m.shotT = 2.4 + rnd(); m.bosTele = null;
  }
  m.rigState = charging ? { pose: 'cast', expr: 'angry' } : null;
  if (m.bosCloneT <= 0 || !m.bosCloneOf || !m.bosCloneOf.alive) BOS_cloneVanish(m);
}
function BOS_clonePop(m) { elBurst(m.x, m.y, (m.head || 28) * .5, m.el, 12); P.smoke(m.x, m.y, 8, 5, { size: 4, color: '#6a6078', dark: '#2a2436', light: '#9a90a8' }); sfx('bos_blink', { vol: .6, pitch: 1.4 }); m.gone = true; }
function BOS_cloneVanish(m) { if (!m.alive) return; m.alive = false; m.hp = 0; BOS_clonePop(m); }
/** an illusion of boss b at (x, y): the same body and palette, one hit bursts it, no loot, no experience */
function BOS_clone(b, x, y) {
  const m = spawnMonster(b.kind, x, y, { elite: 3, affixes: [], scale: b.scale, pal: b.pal, el: b.el, instant: true, name: b.name, level: b.level });
  if (!m) return null;
  Object.assign(m, { hp: 1, maxHp: 1, xp: 0, noLoot: true, bosCloneOf: b, mass: 99, r: b.r, head: b.head, bosCloneT: 7 + rnd() * 2, shotT: 1.1 + rnd() * .9, facing: angTo({ x, y }, ED.hero) });
  m.ai.aware = true;
  // a serpent body's own step would take the illusion underground (unhittable while it shoots): it stays reared instead
  const worm = m.hz !== undefined && m.body && m.body.rig, up = worm ? m.body.rig.o.headR * m.body.rig.o.size * 3 : 0;
  m.arch = Object.assign(Object.create(m.arch), { ai: BOS_cloneAI, stagger: false, onDie: BOS_clonePop, corpseT: .05 }, worm ? { update: c => { c.hz = approach(c.hz, up, 3); c.bstJaw = .4; c.untargetable = false; } } : {});
  if (worm) m.hz = up * .5;
  return m;
}
// mirror: the boss flickers out and the ring around the hero fills with it: illusions and the real one, all casting
def('patterns', 'mirror', { name: 'Mirror Images', role: 'aid', range: [0, 320], start(b) {
  const h = ED.hero, el = b.el, live = ED.foes.filter(m => m.alive && m.bosCloneOf === b).length;
  if (live >= 2 || !REG.archetypes[b.kind]) return { t: 0, rig: { pose: 'cheer' }, update(dt) { this.t += dt; this.rig = { pose: 'cheer', expr: 'shout' }; return this.t < .6; } };
  const n = Math.min(4, 2 + b.phase), R = 64 + 10 * BOS_sz(b), a0 = rnd() * TAU, spots = [];
  for (let i = 0; i <= n; i++) { const a = a0 + i / (n + 1) * TAU, [x, y] = BOS_reach(h.x, h.y, h.x + Math.cos(a) * R, h.y + Math.sin(a) * R); spots.push([x, y]); FX.telegraph({ shape: 'circle', x, y, r: b.r + 4, dur: .5, color: EL(el).color }); }
  sfx('bos_blink'); b.bosVanish = true;
  return { t: 0, rig: { pose: 'cast' }, update(dt) {
    this.t += dt; b.vx = b.vy = 0;
    if (this.t < .5) { b.fade = 1 - this.t / .5 * .9; this.rig = { pose: 'cast', expr: 'angry' }; if (Math.random() < .8) BOS_motes(b, el, 1); return true; }
    if (!this.split) {
      this.split = true; const mine = rnd.int(0, spots.length - 1);
      spots.forEach(([x, y], j) => { if (j === mine) { b.x = x; b.y = y; } else BOS_clone(b, x, y); elBurst(x, y, 14, el, 10); P.smoke(x, y, 6, 3, { size: 4 }); });
      b.fade = undefined; b.bosVanish = false; b.facing = angTo(b, h); sfx('bos_blink', { pitch: .7 }); shake(3);
    }
    this.rig = { pose: 'cast', expr: 'shout' };
    return this.t < 1.1;
  } };
} });

/** enraged for dur seconds: hasted (faster moves and patterns), 30% more damage, a burning aura. Enraging again extends it.
 *  The state lives on the boss (ticked by BOS_bossStep), so it ends cleanly even across a town portal */
function BOS_enrage(b, dur) { if (b.bosRage) { b.bosRage.t = 0; b.bosRage.dur = dur; return; } b.bosRage = { t: 0, dur, k: 1.3 }; b.dmg *= 1.3; }
function BOS_rageStep(b, dt) {
  const rg = b.bosRage; rg.t += dt; if (rg.t >= rg.dur || !b.alive) { b.dmg /= rg.k; b.bosRage = null; return; }
  b.st.haste = { t: .3 };
  if (Math.random() < dt * 16) { const a = rnd() * TAU, d = b.r * (.4 + rnd() * .6); P.add({ kind: b.el === 'fire' || b.el === 'phys' ? 'fire' : 'ember', x: b.x + Math.cos(a) * d, y: b.y + Math.sin(a) * d, z: 2 + rnd() * (b.head || 28) * .6, vz: 30 + rnd() * 20, g: -10, drag: 2, max: .5, size: 1.8, color: BOS_tones(b.el)[1] }); }
}
function BOS_rageDraw(b, r) { const c = BOS_tones(b.el), p = .5 + .5 * Math.sin(game.time * 9); r.decal(() => { r.groundRing(b.x, b.y, b.r + 3 + p * 2, c[1], .7); r.groundDisc(b.x, b.y, b.r + 2, '#ff3a2a', .18 + .1 * p); }, { emissive: .7 }); L.add(b.x, b.y, 12, 60, .5 + .2 * p, { color: c[1] }); }
// enrage: a crouch, then a roar that throws the hero back, then a burning aura: hasted and harder hitting for a while
def('patterns', 'enrage', { name: 'Enrage', role: 'aid', range: [0, 420], start(b) {
  const el = b.el;
  return { t: 0, rig: { pose: 'crouch' }, update(dt) {
    this.t += dt; b.vx *= .8; b.vy *= .8; const t = this.t;
    if (t > .4 && !this.done) {
      this.done = true; sfx('bos_roar'); shake(6); game.flash('#ff5a3a', .1, .35); BOS_kick(b, 5);
      FX.nova({ team: 'foe', src: b, x: b.x, y: b.y, r0: b.r, r1: b.r + 40 * BOS_sz(b), dur: .3, el, hit: { amount: b.dmg * .3, kb: 280 } });
      BOS_enrage(b, 7 + 2 * Math.min(2, b.phase));
    }
    this.rig = t < .4 ? { pose: 'crouch', expr: 'angry' } : { pose: t < 1.25 ? 'cheer' : null, expr: 'shout' };
    return t < 1.4;
  } };
} });

/* =============================================================================
 * BOSS BODIES for composed bosses (bossBody: true; noPack: true, so they never turn up in packs). Their extras are
 * drawn from the rig's own joints (BOS_wrapRig), so they follow every pose and swing in every view, behind the body
 * or in front of it as they should.
 * ============================================================================= */
// the Bone King: a robed skeleton with a crown, a long cape and a staff whose orb burns in its element; souls circle its skull
def('archetypes', 'boneking', { name: 'Bone King', tags: ['undead'], bossBody: true, noPack: true, minDepth: 999, weight: 0, hp: 52, dmg: 13, speed: 28, r: 5, head: 30, mass: 3, armor: 6, xp: 40,
  rig: { build: 'skeleton', weapon: 'staff', outfit: 'robe', sleeves: 'long', hat: { style: 'crown', color: '#e8c050' }, cape: { len: 8, width: 5.5, seg: 2.3 }, eyeGlow: '#8ff0ff' },
  palettes: [
    { bone: '#e2d8be', cloth: '#3a2a4e', cape: '#4a1e5a', capeIn: '#1e1028', belt: '#c8a040', trim: '#e8c050', staff: '#3a2e2a', orb: '#8ff0ff' },
    { bone: '#d0c8b0', cloth: '#26383a', cape: '#1e3a3a', capeIn: '#0e1a1c', belt: '#a08a50', trim: '#c8b060', staff: '#2e2a26', orb: '#b8ff8a' }],
  elKeys: ['cloth', 'cape', 'orb'],
  ai: 'melee', attacks: [{ move: 'overhead', dmg: 1.2, kb: 150 }, { move: 'thrust' }],
  onSpawn(m) { m.glow = [(m.rig && m.rig.C.orb) || '#8ff0ff', 50]; },
  bosDraw(m, r) {
    const rig = m.rig; if (!rig || !m.alive || !r.visible(m.x, m.y, m.z, 70, 140, 40)) return;
    const c = rig.C.orb || EL(m.el).color, t = game.time + m.ph;
    r.queue(m.x, m.y, m.z, g => px.blend(g, m.fade === undefined ? 1 : m.fade, 'normal', () => {
      const [ox, oy] = BOS_root(r, m), J = rig.J, hd = J.head, zm = r.view.zoom || 1;
      px.glow(g, 1);
      for (let k = 0; k < 3; k++) { const a = t * 2.1 + k * TAU / 3, p = rigScreen(rig, [hd[0] + Math.cos(a) * 6, hd[1] + Math.sin(a) * 6, hd[2] + 2 + Math.sin(t * 3 + k) * 1.5], ox, oy, r.view); r.glowDisc(g, p[0], p[1], 3 * zm, c, .45); px.disc(g, p[0], p[1], 1.1 * zm, c); px.dot(g, p[0], p[1], '#ffffff'); }
      const q = rigScreen(rig, E.V3.add(J.handR, E.V3.mul(J.bladeDir, 10)), ox, oy, r.view); r.glowDisc(g, q[0], q[1], 7 * zm, c, .4);
      if (Math.random() < .15) P.add({ kind: 'ember', x: m.x, y: m.y, z: (m.head || 30) * .9, vx: (rnd() - .5) * 20, vy: (rnd() - .5) * 20, vz: 16, max: .6, color: c });
    }), { emissive: foeGlowSeen(m.x, m.y, (m.head || 30) * (m.scale || 1) * .8), bias: .05 });
  } });

/** the Colossus's full helm: a visor bar and nose guard over its steel face, and horns (the far one behind the head) */
function BOS_colossusHelm(m, g, ox, oy, view, near) {
  const rig = m.rig, J = rig.J, R = rig.o.headR, u = BOS_u(rig, view), H = rigScreen(rig, J.head, ox, oy, view), ht = E.tones('#e8dcc0'), mt = E.tones(rig.C.metal || '#9aa2b4');
  for (const s of [-1, 1]) {
    const root = rigScreen(rig, [J.head[0] - .3, J.head[1] + s * R * .9, J.head[2] + R * .35], ox, oy, view); if ((root[2] >= H[2]) !== near) continue;
    const mid = rigScreen(rig, [J.head[0] - .2, J.head[1] + s * R * 1.75, J.head[2] + R * .55], ox, oy, view), tip = rigScreen(rig, [J.head[0] + .7, J.head[1] + s * R * 2.15, J.head[2] + R * 1.35], ox, oy, view);   // bull horns: out, then up and forward
    const w = Math.max(1, Math.round(u * .9));
    px.line(g, root[0], root[1], mid[0], mid[1], ht.sh, w + 1); px.line(g, mid[0], mid[1], tip[0], tip[1], ht.sh, w);
    px.line(g, root[0], root[1] - 1, mid[0], mid[1] - 1, ht.lt); px.line(g, mid[0], mid[1] - 1, tip[0], tip[1], ht.base); px.dot(g, tip[0], tip[1], ht.hi);
  }
  if (!near) return;
  const fr = rigScreen(rig, [J.head[0] + R * .9, J.head[1], J.head[2]], ox, oy, view); if (fr[2] <= H[2]) return;   // the face is turned away
  const b0 = rigScreen(rig, [J.head[0] + R * .88, J.head[1] - R * .7, J.head[2] + R * .3], ox, oy, view), b1 = rigScreen(rig, [J.head[0] + R * .88, J.head[1] + R * .7, J.head[2] + R * .3], ox, oy, view);
  const n0 = rigScreen(rig, [J.head[0] + R * .95, J.head[1], J.head[2] + R * .35], ox, oy, view), n1 = rigScreen(rig, [J.head[0] + R * .95, J.head[1], J.head[2] - R * .55], ox, oy, view);
  px.line(g, b0[0], b0[1], b1[0], b1[1], mt.deep, Math.max(1, Math.round(u * .7))); px.line(g, b0[0], b0[1] - 1, b1[0], b1[1] - 1, mt.lt);
  px.line(g, n0[0], n0[1], n1[0], n1[1], mt.deep, Math.max(1, Math.round(u * .55))); px.dot(g, n0[0] - 1, n0[1], mt.hi);
}
/** the Colossus's kite shield strapped to its left forearm: rim, face in its cloth (element) color, a boss and rivets */
function BOS_colossusShield(m, g, ox, oy, view, near) {
  const rig = m.rig, J = rig.J, V = E.V3, c0 = rigScreen(rig, J.shC, ox, oy, view), mid = V.lerp(J.elbowL, J.handL, .55), cen = V.add(mid, [.4, -1.6, .3]);
  const P0 = rigScreen(rig, cen, ox, oy, view); if ((P0[2] >= c0[2] - .5) !== near) return;
  const pt = (f, z) => rigScreen(rig, V.add(cen, [f, 0, z]), ox, oy, view);
  const out = [pt(-2.7, 4), pt(2.7, 4), pt(3, .8), pt(0, -5.4), pt(-3, .8)], inn = [pt(-2.1, 3.3), pt(2.1, 3.3), pt(2.3, .8), pt(0, -4.3), pt(-2.3, .8)];
  const mt = E.tones(rig.C.metal || '#9aa2b4'), cl = E.tones(rig.C.cloth || '#6a2a2e'), gd = E.tones(rig.C.trim || '#d0a85a');
  px.poly(g, out, mt.sh); px.poly(g, inn, cl.base); px.poly(g, [inn[0], inn[1], P0, inn[4]], cl.lt);
  px.line(g, out[0][0], out[0][1], out[1][0], out[1][1], mt.lt);
  const [cx, cy] = P0; px.disc(g, cx, cy, Math.max(1.5, BOS_u(rig, view) * .9), gd.sh); px.dot(g, cx - 1, cy - 1, gd.hi);
  for (const q of [out[0], out[1], out[3]]) px.dot(g, lerp(q[0], cx, .2), lerp(q[1], cy, .2), gd.lt);
}
// the Armored Colossus: plate from head to foot, a horned full helm, a kite shield and a long blade held ready
def('archetypes', 'colossus', { name: 'Armored Colossus', tags: ['construct', 'armored'], bossBody: true, noPack: true, minDepth: 999, weight: 0, hp: 72, dmg: 15, speed: 22, r: 6, head: 30, mass: 5, armor: 30, xp: 40, stance: 'ready',
  rig: { build: 'bulky', armor: true, hat: { style: 'helmet', color: '#5a6070' }, sleeves: 'long', weapon: 'sword', bladeLen: 15, outfit: 'tunic', hair: 'bald', eyeGlow: '#ff6a3a', speedRef: 44 },
  palettes: [
    { cloth: '#6a2a2e', pants: '#3a3a46', boot: '#4a4c58', belt: '#8a6a3a', trim: '#d0a85a', metal: '#9aa2b4', metalDk: '#555c6c', glove: '#6a7080', skin: '#5a606e', hilt: '#8a6a3a', hair: '#3a3a44' },
    { cloth: '#2a3a5a', pants: '#34343e', boot: '#44444e', belt: '#6a5a3a', trim: '#c8b070', metal: '#b0a890', metalDk: '#686050', glove: '#7a7460', skin: '#686458', hilt: '#5a4a30', hair: '#34302a' }],
  elKeys: ['cloth'],
  ai: 'melee', attacks: [{ move: 'overhead', dmg: 1.4, kb: 180 }, { move: 'bash', dmg: 1, kb: 220 }],
  onSpawn(m) { BOS_wrapRig(m, (g, ox, oy, v) => { BOS_colossusShield(m, g, ox, oy, v, false); BOS_colossusHelm(m, g, ox, oy, v, false); }, (g, ox, oy, v) => { BOS_colossusHelm(m, g, ox, oy, v, true); BOS_colossusShield(m, g, ox, oy, v, true); }); } });

/** the Titan's back: bone spikes through the flesh (behind the body when its back is turned away) */
function BOS_titanSpikes(m, g, ox, oy, view, near) {
  const rig = m.rig, J = rig.J, o = rig.o, V = E.V3, c0 = rigScreen(rig, J.shC, ox, oy, view), bt = E.tones('#e0d4b8'), u = BOS_u(rig, view);
  for (const [dz, dr, len] of [[-.5, -1.4, 4.2], [-.2, 1.5, 4.6], [-3, -.8, 3.4], [-3.2, 1, 3]]) {
    const base = V.add(J.shC, [-o.torsoW * .55, dr, dz]), root = rigScreen(rig, base, ox, oy, view); if ((root[2] > c0[2]) !== near) continue;
    const tip = rigScreen(rig, V.add(base, [-len, dr * .5, len * .7]), ox, oy, view), w = Math.max(1.2, u * .75), vx = tip[0] - root[0], vy = tip[1] - root[1], l = Math.hypot(vx, vy) || 1, nx = -vy / l * w, ny = vx / l * w;
    px.poly(g, [[root[0] + nx, root[1] + ny], [tip[0], tip[1]], [root[0] - nx, root[1] - ny]], bt.sh); px.line(g, root[0] - nx * .3, root[1] - ny * .3, tip[0], tip[1], bt.lt); px.dot(g, tip[0], tip[1], bt.hi);
    px.disc(g, root[0], root[1], w * .9, '#5a2a2a');   // torn flesh where it breaks through
  }
}
/** the Titan's stitches across its chest and arms, and boils that glow in its element */
function BOS_titanStitches(m, g, ox, oy, view) {
  const rig = m.rig, J = rig.J, o = rig.o, V = E.V3, fr = rigScreen(rig, V.add(J.shC, [2, 0, -3]), ox, oy, view), bk = rigScreen(rig, V.add(J.shC, [-2, 0, -3]), ox, oy, view), sc = '#3a1a1c', el = EL(m.el === 'phys' ? 'venom' : m.el);
  if (fr[2] > bk[2]) {   // chest toward the camera: a long seam with cross stitches
    let prev = null;
    for (let k = 0; k <= 5; k++) { const p = V.lerp(J.shL, J.hipR, .1 + k * .15), q = rigScreen(rig, [p[0] + o.torsoW * .6, p[1], p[2]], ox, oy, view); if (prev) px.line(g, prev[0], prev[1], q[0], q[1], sc); px.line(g, q[0] - 1, q[1] - 1, q[0] + 1, q[1] + 1, sc); prev = q; }
  }
  for (const [sh, sd] of [[J.shL, -1], [J.shR, 1]]) {
    const b = rigScreen(rig, V.add(sh, [.4, sd * .6, 1]), ox, oy, view); if (b[2] < fr[2] - 3) continue;
    px.disc(g, b[0], b[1], 1.3, el.dark); px.dot(g, b[0], b[1], el.light);
  }
}
// the Flesh Titan: a hunched hulk of stitched flesh, arms to its knees, bone spikes through its back
def('archetypes', 'fleshtitan', { name: 'Flesh Titan', tags: ['undead', 'brute'], bossBody: true, noPack: true, minDepth: 999, weight: 0, hp: 80, dmg: 16, speed: 25, r: 6, head: 28, mass: 5, armor: 4, xp: 40,
  rig: { build: 'bulky', weapon: null, hair: 'bald', hunch: .6, lean: .22, sleeves: 'none', outfit: 'shirt', armUpper: 6, armLower: 6.6, limbW: 3.1, headR: 2.7, eyeGlow: '#e8ff6a', speedRef: 40, stride: 6.2, swing: 3 },
  palettes: [
    { skin: '#b8948a', cloth: '#5a4038', pants: '#4a3830', boot: '#3a2a26', belt: '#6a4a30', trim: '#3a2a26', hair: '#2a1a1a' },
    { skin: '#9aa08a', cloth: '#3e4a3a', pants: '#34302a', boot: '#2a2622', belt: '#5a5040', trim: '#2a2622', hair: '#1a1a14' }],
  elKeys: ['cloth'],
  ai: 'melee', attacks: [{ move: 'haymaker', dmg: 1.4, kb: 200 }, { move: 'claw' }],
  onSpawn(m) { BOS_wrapRig(m, (g, ox, oy, v) => BOS_titanSpikes(m, g, ox, oy, v, false), (g, ox, oy, v) => { BOS_titanStitches(m, g, ox, oy, v); BOS_titanSpikes(m, g, ox, oy, v, true); }); } });

/* ---- the Six-Armed Reaver: a hooded giant with two more pairs of arms out of its back, a curved blade in every hand ---- */
/** it remembers where its own two hands went (rig-local, from the shoulders) for the last .4 s: the extra arms replay that
 *  path a beat late, so one swing becomes a cascade of three blades and an idle hand's sway ripples down its sides */
function BOS_reaverRecord(m) {
  const rig = m.rig, J = rig.J, H = m.bosArms || (m.bosArms = []); if (!J.handR || (H.length && H[H.length - 1].t === game.time)) return;
  H.push({ t: game.time, R: E.V3.sub(J.handR, J.shR), L: E.V3.sub(J.handL, J.shL), bd: (J.bladeDir || [1, 0, 0]).slice() });
  while (H.length > 2 && game.time - H[1].t > .4) H.shift();
}
/** the pose of its hands lag seconds ago (the oldest kept when the record is shorter) */
function BOS_reaverAt(m, lag) { const H = m.bosArms || []; for (let i = H.length - 1; i >= 0; i--) if (game.time - H[i].t >= lag) return H[i]; return H[0]; }
/** one extra arm: out of the back below the shoulder of side s (tier k: 0 the upper pair, 1 the lower), its hand where the
 *  main hand of that side was a beat ago (swept a little wider and lower), an elbow bent out and back (E.ik3), a sickle blade */
function BOS_reaverArm(m, g, ox, oy, view, s, k, near) {
  const rig = m.rig, J = rig.J, o = rig.o, V = E.V3, c0 = rigScreen(rig, J.shC, ox, oy, view), sh = s > 0 ? J.shR : J.shL;
  const root = V.add(sh, [-1.1 - .3 * k, s * (.35 + .45 * k), -1.5 - 1.8 * k]), P0 = rigScreen(rig, root, ox, oy, view); if ((P0[2] >= c0[2] - .2) !== near) return;
  const q = BOS_reaverAt(m, .07 + .08 * k), t = game.time * (1.6 + .3 * k) + m.ph + s + k * 1.7;
  if (!q) return;
  // a fan held out from the body (the upper pair raised, the lower pair at the hip), moved by how far the main hand of that
  // side has swung from where it hangs at rest, a beat ago: the cascade
  const rel = s > 0 ? q.R : q.L, reach = o.armUpper + o.armLower, rest = [.6, s * .9, -reach * .78], ready = [1.8 + .6 * k, s * (reach * .55 + 1.2 * k), k ? -reach * .45 : -reach * .05];
  const tgt = V.add(root, V.add(ready, V.add(V.mul(V.sub(rel, rest), .9 - .12 * k), [.35 * Math.sin(t), .3 * s * Math.sin(t * .7), .45 * Math.sin(t * .8)])));
  const [el, hd] = E.ik3(root, tgt, o.armUpper * .92, o.armLower * .95, [-1, s * .9, -.2]), A = P0, B = rigScreen(rig, el, ox, oy, view), C = rigScreen(rig, hd, ox, oy, view);
  const u = BOS_u(rig, view), w = Math.max(2, (o.limbW || 2) * u * .72), sk = E.tones(rig.C.skin || '#8a8098'), mt = E.tones(rig.C.metal || '#c8ccd8'), OL = '#140c1c';
  // the blade first when it points away (it goes behind the forearm), the arm, then the blade when it points out
  const fore = V.norm(V.sub(hd, el)), bd = V.norm(V.add(s > 0 ? q.bd : V.add(fore, [0, 0, .7]), [.2, s * .55, .35])), Lb = (o.bladeLen || 11) * (.62 - .06 * k);
  const tip = rigScreen(rig, V.add(hd, V.mul(bd, Lb)), ox, oy, view), mid = rigScreen(rig, V.add(V.add(hd, V.mul(bd, Lb * .55)), [0, 0, 1.1]), ox, oy, view), back = C[2] > tip[2];
  const blade = () => {
    const bw = Math.max(1, Math.round(u * .75));
    px.line(g, C[0], C[1], mid[0], mid[1], OL, bw + 2); px.line(g, mid[0], mid[1], tip[0], tip[1], OL, bw + 1);
    px.line(g, C[0], C[1], mid[0], mid[1], mt.sh, bw + 1); px.line(g, mid[0], mid[1], tip[0], tip[1], mt.base, bw);
    px.line(g, C[0], C[1] - 1, mid[0], mid[1] - 1, mt.lt); px.line(g, mid[0], mid[1] - 1, tip[0], tip[1], mt.hi); px.dot(g, tip[0], tip[1], '#ffffff');
  };
  if (back) blade();
  // shaded capsules like the rig's own limbs (the beasts' limb painter): the far arms a shade darker; a bony fist
  const ra = w * .5, far = !near || k > 0;
  BST_limb(g, A, B, ra, ra * .85, sk, far, OL); BST_limb(g, B, C, ra * .85, ra * .7, sk, far, OL);
  px.disc(g, C[0], C[1], ra * .9 + 1, OL); px.disc(g, C[0], C[1], ra * .9, far ? sk.sh : sk.base); px.dot(g, C[0] - ra * .3, C[1] - ra * .3, sk.lt);
  if (!back) blade();
}
/** the rune seam down its back and a glowing mark on the hood, in its element (the knot the arms grow from) */
function BOS_reaverSeam(m, g, ox, oy, view) {
  const rig = m.rig, J = rig.J, V = E.V3, e = EL(m.el === 'phys' ? 'void' : m.el), fr = rigScreen(rig, V.add(J.shC, [1.5, 0, -2]), ox, oy, view), bk = rigScreen(rig, V.add(J.shC, [-1.5, 0, -2]), ox, oy, view);
  if (bk[2] <= fr[2]) return;   // its back is turned toward the camera: the seam shows
  let prev = null; for (let k = 0; k <= 4; k++) { const p = rigScreen(rig, V.add(V.lerp(J.shC, J.hipC, k / 5), [-1.6, 0, 0]), ox, oy, view); if (prev) px.line(g, prev[0], prev[1], p[0], p[1], k % 2 ? e.color : e.dark); px.dot(g, p[0], p[1], e.light); prev = p; }
}
// the Six-Armed Reaver: a tall hooded giant in a long robe (the hood is drawn in its 'hair' color), a curved blade in each of
// its six hands. Its four extra arms replay its own two a beat late: every swing is a cascade
def('archetypes', 'reaver', { name: 'Six-Armed Reaver', tags: ['demon', 'melee'], bossBody: true, noPack: true, minDepth: 999, weight: 0, hp: 64, dmg: 14, speed: 30, r: 5.5, head: 32, mass: 4, armor: 10, xp: 40,
  rig: { build: 'heroic', weapon: 'sword', bladeLen: 12, outfit: 'robe', sleeves: 'none', hood: true, hair: 'long', hunch: .25, lean: .08, cape: { len: 7, width: 5, seg: 2.3 }, eyeGlow: '#ff5a7a', speedRef: 60 },
  palettes: [
    { skin: '#8a8098', hair: '#2a2234', cloth: '#2c2234', coat: '#221a2a', pants: '#241c2a', boot: '#1a141e', belt: '#6a4a3a', trim: '#b8905a', glove: '#8a8098', metal: '#d0d4e0', metalDk: '#6a6e80', hilt: '#4a3a30', cape: '#3e1a2c', capeIn: '#1a0c14' },
    { skin: '#7a8a80', hair: '#1c2422', cloth: '#1e2c2a', coat: '#16201e', pants: '#1c2422', boot: '#141a18', belt: '#5a4a34', trim: '#a8a060', glove: '#7a8a80', metal: '#c8c0a8', metalDk: '#6a6450', hilt: '#3a3026', cape: '#2a3a26', capeIn: '#101a10' }],
  elKeys: ['cloth', 'cape'],
  ai: 'melee', attacks: [{ move: 'slash', dmg: 1.1 }, { move: 'backslash' }, { move: 'spin', dmg: 1.3, kb: 160 }],
  onSpawn(m) {
    BOS_wrapRig(m, (g, ox, oy, v) => { BOS_reaverRecord(m); for (const k of [1, 0]) for (const s of [-1, 1]) BOS_reaverArm(m, g, ox, oy, v, s, k, false); },
      (g, ox, oy, v) => { BOS_reaverSeam(m, g, ox, oy, v); for (const k of [1, 0]) for (const s of [-1, 1]) BOS_reaverArm(m, g, ox, oy, v, s, k, true); });
  } });

/* =============================================================================
 * THE ARENA: what every boss gets. It slumbers kneeling until woken (walk close, or strike it), rises, roars with a
 * burst of its element, and its name comes up on a card; embers (or ash) drift through the arena while it lives;
 * its swings leave element smears; when it dies its element bursts up in a column and a treasure chest falls from
 * above, to be struck open. The per-boss step runs after the core's boss AI (a wrapped arch.update).
 * ============================================================================= */
/** the step every boss runs after its AI: slumber, the waking, leaps, lava, clean-ups */
function BOS_bossStep(m, dt) {
  const B = m.bossDef || {};
  m.lavaT = Math.max(m.lavaT || 0, .6);   // bosses stride through molten floor; their adds burn
  if (m.rig && !isFinite(m.rig.atkZ)) m.rig.atkZ = -7;   // before the rig updates (see BOS_mv)
  if (m.bosRage) BOS_rageStep(m, dt);
  // mid-pattern leaps (the core slam too): keep the AI flying the boss while it is off the ground, instead of letting
  // the core drop it like a knocked-back body
  if (m.pat && m.z > .01 && !m.canFly) { m.canFly = true; m.bosFly = true; }
  else if (m.bosFly && (!m.pat || m.z <= 0)) { m.canFly = false; m.bosFly = false; }
  // a pattern cut short (a phase change) must not leave the boss invisible or untargetable
  if (!m.pat && m.bosVanish) { m.fade = undefined; m.untargetable = false; m.bosVanish = false; }
  if (m.dormant) {   // slumber: kneel where it waits (the core would let a sleeping boss wander toward the hero)
    m.vx = m.vy = 0; m.bosSlept = true;
    if (!m.pat || !m.pat.bosSleep) m.pat = { bosSleep: true, rig: B.sleepRig || { pose: 'kneel' }, update: () => m.dormant };
    m.rigState = m.pat.rig; return;
  }
  if (m.introT > 0 && B.arena !== false) {
    if (!m.bosIntro) { m.bosIntro = { t: 0, kind: m.phase !== (m.bosPh || 0) ? 'phase' : m.bosSlept && !m.bosWoke ? 'wake' : m.bosWoke ? 'phase' : 'spawn' }; m.bosWoke = true; m.bosPh = m.phase; }
    BOS_intro(m, m.bosIntro, dt);
  } else m.bosIntro = null;
}
/** the waking (kneel, rise, roar), a phase change (a stagger, a roar) or a boss that arrives awake (a roar).
 *  A body that stages its own entrance (arch.ownEntrance: the Brood Mother's drop, the Wyrm's eruption) keeps it: the
 *  arena adds only its name card at the entrance's climax (1.05 s in) and the body's bosRoar visuals, no second roar */
function BOS_intro(m, I, dt) {
  const B = m.bossDef || {}, rig = m.rig, pw = rig && rig.poseW, own = !!m.arch.ownEntrance; I.t += dt; const t = I.t;
  if (own) {
    const at = I.kind === 'wake' ? 1.05 : 0; if (t < at || I.roared) return;
    I.roared = true; if (B.bosRoar) B.bosRoar(m, I.kind); if (I.kind !== 'phase') BOS_showCard(m); return;
  }
  m.vx *= .8; m.vy *= .8;
  let roarT = -1;
  if (I.kind === 'wake') {
    if (t < .3) { m.rigState = { pose: 'kneel', expr: 'angry' }; if (pw) pw.kneel = 1; if (!I.stir) { I.stir = true; shake(2); P.dust(m.x, m.y, 0, 10, { speed: 40 }); } }
    else if (t < 1.05) { const w = 1 - E.ease.inOut((t - .3) / .75); if (pw) pw.kneel = Math.min(1, w + dt * 9); m.rigState = { expr: 'angry' }; if (Math.random() < .25) P.dust(m.x + (rnd() - .5) * m.r * 2, m.y + (rnd() - .5) * m.r * 2, 0, 1); }
    else roarT = t - 1.05;
  } else if (I.kind === 'phase') {
    if (t < .25) { m.rigState = { expr: 'wince', hurt: true }; if (!I.stag) { I.stag = true; BOS_kick(m, -5); } }
    else roarT = t - .25;
  } else roarT = t;
  if (roarT < 0) return;
  if (!I.roared) {
    I.roared = true; sfx('bos_roar'); shake(6); BOS_kick(m, 6);
    if (B.bosRoar) B.bosRoar(m, I.kind); else { BOS_burstRings(m.x, m.y, m.el, I.kind === 'phase' ? 1 : 2, { r0: m.r + 12 }); game.flash(BOS_tones(m.el)[1], .1, .3); }
    if (I.kind !== 'phase') BOS_showCard(m);
  }
  m.rigState = roarT < .9 ? { pose: 'cheer', expr: 'shout' } : { expr: 'angry' };
}

/* ---- the name card: letterbox bars, the name in the boss's element colors over a flared rule, its title under it ---- */
let BOS_card = null;
/** one name on screen at a time: the level's card (it names the depth) gives way to the boss's, and the boss's card
 *  takes the half of the screen the boss is not in, so its entrance plays in the open */
function BOS_showCard(m) {
  if (UI.card && UI.cardT > .35) UI.cardT = .35;
  const s = game.view.p(m.x, m.y, (m.z || 0) + (m.head || 28) * (m.scale || 1) * .5), sy = s[1] - game.cam.y;
  BOS_card = { name: String(m.name || 'The Nameless').toUpperCase(), title: m.title || '', el: m.el || 'fire', t0: game.real, low: sy < game.screen.H * .52 };
}
function BOS_drawCard(r) {
  const C = BOS_card; if (!C) return;
  const t = game.real - C.t0, dur = 3.8; if (t > dur || t < 0) { BOS_card = null; return; }
  const a = clamp(Math.min(t / .35, (dur - t) / .6), 0, 1), bars = E.ease.outQuad(clamp(Math.min(t / .4, (dur - t) / .5), 0, 1)), e = EL(C.el), c = BOS_tones(C.el);
  r.overlay(g => {
    const W = r.W, H = r.H, cx = Math.round(W / 2), bh = Math.round(20 * bars), y = Math.round(H * (C.low ? .62 : .22)) + Math.round(6 * (1 - a));
    px.blend(g, .92, 'normal', () => { px.rect(g, 0, 0, W, bh, '#05030a'); px.rect(g, 0, H - Math.round(bh * .5), W, Math.round(bh * .5), '#05030a'); });
    px.blend(g, a, 'normal', () => {
      px.blend(g, .5, 'normal', () => px.rect(g, 0, y - 12, W, 50, '#05030a'));
      const sc = E.font.width(C.name, { scale: 3 }) <= W - 30 ? 3 : 2, rw = Math.round(Math.min(W * .38, 160) * E.ease.outQuad(clamp(t / .7, 0, 1)));
      E.font.title(g, C.name, cx, y - 6, { scale: sc, colors: [c[3], e.light, e.color, e.dark], depth: 2, align: 'center' });
      const ry = y + 7 * sc - 2;
      for (const s of [-1, 1]) { px.rect(g, s < 0 ? cx - rw : cx + 6, ry, rw - 6, 1, e.color); px.rect(g, s < 0 ? cx - rw + 8 : cx + 6, ry + 1, rw - 14, 1, e.dark); const ex = cx + s * rw; px.poly(g, [[ex, ry - 2], [ex + s * 3, ry], [ex, ry + 2]], c[2]); }
      px.poly(g, [[cx, ry - 3], [cx + 3, ry], [cx, ry + 3], [cx - 3, ry]], c[2]); px.dot(g, cx, ry, '#ffffff');
      if (C.title) E.font.text(g, C.title, cx, ry + 6, '#e8e0f8', { align: 'center', shadow: '#05040a', outline: false });
    });
  });
}

/* ---- the air of an arena: embers rise around a fire boss, ash and motes drift down around the others ---- */
function BOS_ambience(dt) {
  const B = ED.boss, h = ED.hero; if (!B || !h || !B.alive) return;
  if (Math.hypot(B.x - h.x, B.y - h.y) > 300) return;
  const el = B.el || 'fire', c = BOS_tones(el), n = (B.dormant ? 8 : 20) * dt;
  for (let k = 0; k < 3; k++) {
    if (Math.random() > n / 3) continue;
    const x = h.x + (rnd() - .5) * 300, y = h.y + (rnd() - .5) * 240;
    if (el === 'fire') P.add({ kind: 'ember', x, y, z: rnd() * 10, vx: (rnd() - .5) * 16, vy: (rnd() - .5) * 16 - 6, vz: 18 + rnd() * 26, drag: .4, max: 1.6 + rnd() * 1.4, color: rnd() < .5 ? c[1] : c[0] });
    else if (rnd() < .65) P.add({ kind: 'dust', x, y, z: 70 + rnd() * 50, vx: 6 + rnd() * 8, vy: (rnd() - .5) * 8, vz: -14 - rnd() * 8, drag: .2, max: 3 + rnd() * 2, size: .8, color: rnd() < .5 ? '#8a8494' : '#5a5464' });
    else P.add({ kind: 'ember', x, y, z: rnd() * 40, vx: (rnd() - .5) * 10, vy: (rnd() - .5) * 10, vz: 6 + rnd() * 8, drag: .5, max: 1.5 + rnd(), color: c[1] });
  }
}

/* ---- the treasure chest: falls from above where a boss died, lands with a thud, opens when struck ---- */
/** a chest landing at (x, y) (moved to open floor). o: { depth, big } */
function BOS_chestDrop(x, y, o = {}) {
  const L0 = ED.L; if (!L0 || !L0.things) return null;
  const ex = L0.exit; if (ex) { const d = Math.hypot(x - ex.x, y - ex.y); if (d < 30) { const a = d > .1 ? Math.atan2(y - ex.y, x - ex.x) : Math.PI / 2; x = ex.x + Math.cos(a) * 30; y = ex.y + Math.sin(a) * 30; } }   // (a chest is solid: never on the waystone)
  [x, y] = BOS_openNear(x, y, L0);
  return addThing(L0, { kind: 'bosschest', x, y, z: 170, vz: 0, r: o.big ? 9 : 7.5, solid: false, hittable: false, keep: true, mapColor: '#ffd36a', lid: 0, openT: 0, opened: false, landed: false, t: 0, depth: o.depth || ED.depth || 1, big: !!o.big,
    onHit() { if (!this.landed || this.opened) return; this.opened = true; this.hittable = false; BOS_chestOpen(this); },
    update(dt) {
      this.t += dt;
      if (!this.landed) {
        this.vz -= 420 * TUNE.gravity * dt; this.z += this.vz * dt;
        if (this.z <= 0) { this.z = 0; if (this.vz < -110) { this.vz = -this.vz * .25; shake(3); sfx('thud'); P.dust(this.x, this.y, 0, 16, { speed: 70 }); P.ring(this.x, this.y, 4, 26, '#ffe070', .35); } else { this.vz = 0; this.landed = true; this.hittable = true; this.solid = true; notify('A TREASURE CHEST!  STRIKE IT OPEN', '#ffd36a', 3); } }
        return;
      }
      if (this.opened) { this.openT = Math.min(1, this.openT + dt * 2.8); this.lid = E.ease.outBack(this.openT); this.since = (this.since || 0) + dt; }
      else if (Math.random() < dt * 2.5) P.glints(this.x + (rnd() - .5) * 14, this.y + (rnd() - .5) * 8, 6 + rnd() * 10, 1, '#fff2a0', 4);
    },
    draw(r) { BOS_drawChest(r, this); } });
}
/** the lid flies open: light, a chime and a spray of loot toward the hero (one rare or better guaranteed) */
function BOS_chestOpen(C) {
  const h = ED.hero, depth = C.depth, mf = (h && h.stats.magicFind) || 0, n = (C.big ? 3 : 2) + (rnd.chance(.4) ? 1 : 0), toward = h ? angTo(C, h) : Math.PI / 2;
  sfx('bos_chest'); sfx('secret', { vol: .5 }); shake(3); game.freeze(.05); P.glints(C.x, C.y, 12, 16, '#ffe070', 16); P.ring(C.x, C.y, 4, 34, '#ffe070', .45); game.flash('#ffe8a0', .08, .25);
  const toss = (kind, o, i) => game.after(.12 + i * .1, () => { const a = toward + (rnd() - .5) * 2, sp = 25 + rnd() * 45; dropLoot(kind, C.x, C.y, Object.assign({ z: 12, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 150 + rnd() * 70 }, o)); if (kind === 'gold') sfx('coin', { vol: .3, pitch: 1 + rnd() * .5 }); });
  for (let i = 0; i < n; i++) toss('item', { item: makeItem({ ilvl: depth + 1, rarity: i === 0 ? 2 : rollRarity(depth, rnd, mf, .5) }) }, i);
  const g0 = Math.max(1, Math.round((6 + rnd() * 8) * SCALE.gold(depth) * (C.big ? 2 : 1)));
  for (let i = 0; i < 5; i++) toss('gold', { n: g0 }, n + i);
  if (rnd.chance(.6)) toss('potion', {}, n + 5);
}
function BOS_drawChest(r, C) {
  const x = C.x, y = C.y, z = Math.max(0, C.z), v = r.view; if (!r.visible(x, y, z, 50, 60, 40)) return;
  const k = C.big ? 1.3 : 1.05, W = 8 * k, D = 5.5 * k, H = 7.5 * k, x0 = x - W, x1 = x + W, y0 = y - D, y1 = y + D, zm = v.zoom || 1;
  const wd = E.tones('#8a5230'), gd = E.tones('#e8b040'), th = C.lid * 1.95, open = C.lid > .02;
  r.shadow(x, y, W + 2, .5 * (z > 0 ? Math.max(.3, 1 - z / 120) : 1));
  if (!C.landed) r.decal(() => { r.groundRing(x, y, W + 4 + Math.sin(game.time * 8) * 2, '#ffe070', .6); r.groundDisc(x, y, W, '#ffe070', .15); }, { emissive: .7 });   // where it will land
  // the lid: a rounded prism hinged on the back top edge, turned open by th
  const prof = [[0, 0], [D * .35, 2.8 * k], [D * .8, 4 * k], [D * 1.2, 4 * k], [D * 1.65, 2.8 * k], [D * 2, 0]].map(([dy, dz]) => [y0 + dy * Math.cos(th) - dz * Math.sin(th), z + H + dy * Math.sin(th) + dz * Math.cos(th)]);
  const lid = g => {   // a shell: the outside where it faces the camera, the dark inside where the lid is thrown back
    const fac = [];
    for (let i = 0; i < prof.length - 1; i++) { const [ya, za] = prof[i], [yb, zb] = prof[i + 1]; fac.push({ ya, za, yb, zb, d: v.depth(x, (ya + yb) / 2, (za + zb) / 2) }); }
    fac.sort((a, b) => a.d - b.d);
    for (const { ya, za, yb, zb } of fac) {
      const ny = -(zb - za), nz = yb - ya, l = Math.hypot(ny, nz) || 1, out = (ny * v.dy + nz * v.dz) / l > .01;
      const q = [r.w(x0, ya, za), r.w(x1, ya, za), r.w(x1, yb, zb), r.w(x0, yb, zb)], lit = nz / l * .7 + ny / l * .3;
      px.poly(g, q, out ? (lit > .6 ? wd.lt : lit > .05 ? wd.base : wd.sh) : '#3a1c0e'); px.line(g, q[0][0], q[0][1], q[1][0], q[1][1], out ? wd.deep : '#26120a');
    }
    for (const [xc, s] of [[x0, -1], [x1, 1]]) if (s * v.dx > .01) { px.poly(g, prof.map(([yy, zz]) => r.w(xc, yy, zz)), wd.sh); const a = prof.map(([yy, zz]) => r.w(xc, yy, zz)); for (let i = 0; i < a.length - 1; i++) px.line(g, a[i][0], a[i][1], a[i + 1][0], a[i + 1][1], gd.sh); }
    for (const s of [-.55, .55]) { const xs = x + s * W; for (let i = 0; i < prof.length - 1; i++) { const a = r.w(xs, prof[i][0], prof[i][1]), b = r.w(xs, prof[i + 1][0], prof[i + 1][1]); px.line(g, a[0], a[1], b[0], b[1], gd.base, Math.max(1, Math.round(1.6 * zm))); } }
    const e0 = r.w(x0, prof[5][0], prof[5][1]), e1 = r.w(x1, prof[5][0], prof[5][1]); px.line(g, e0[0], e0[1], e1[0], e1[1], gd.lt);
  };
  const body = g => {
    r.box(g, x0, y0, z, x1, y1, z + H, open ? '#2a140a' : wd.base, wd.base);
    if (v.dy > .01) {   // the front: gold straps, the lock, a gold foot
      for (const s of [-.55, .55]) { const a = r.w(x + s * W, y1, z), b = r.w(x + s * W, y1, z + H); px.line(g, a[0], a[1], b[0], b[1], gd.base, Math.max(1, Math.round(1.6 * zm))); }
      const b0 = r.w(x0, y1, z + .6), b1 = r.w(x1, y1, z + .6); px.line(g, b0[0], b0[1], b1[0], b1[1], gd.sh);
      const lk = r.w(x, y1, z + H * .72); px.rect(g, lk[0] - 2 * zm, lk[1] - 2 * zm, 4 * zm, 4 * zm, gd.base); px.rect(g, lk[0] - 2 * zm, lk[1] - 2 * zm, 4 * zm, 1, gd.hi); px.dot(g, lk[0], lk[1], '#2a1a0a');
    }
    if (open) for (let i = 0; i < 8; i++) { const p = r.w(x + (E.hash2(i, 3) - .5) * W * 1.5, y + (E.hash2(i, 7) - .5) * D * 1.3, z + H + .3); px.ell(g, p[0], p[1], 1.6 * zm, zm, gd.base); px.dot(g, p[0] - .5, p[1] - .5, gd.hi); }
  };
  r.queue(x, y, z, g => { if (open && th > 1.1 && v.dy > 0) { lid(g); body(g); } else { body(g); lid(g); } });
  if (open) {
    const sh = clamp(1.2 - (C.since || 0) * .4, .3, 1);   // a shaft of light that settles into a glow
    r.queue(x, y, z + H, g => { const [sx, sy] = r.w(x, y, z + H + 1); px.glow(g, 1); r.glowDisc(g, sx, sy, 7 * zm, '#ffb040', .25 * sh + .1); px.blend(g, .22 * sh, 'add', () => { px.rect(g, sx - 2 * zm, sy - 70 * zm, 4 * zm, 70 * zm, '#ffe070'); px.rect(g, sx - .5 * zm, sy - 70 * zm, Math.max(1, zm), 70 * zm, '#ffffff'); }); }, { emissive: true, bias: .02 });
    L.add(x, y, 12, 70, .9, { color: '#ffd36a' });
  } else if (C.landed) L.add(x, y, 10, 40, .5, { color: '#ffd36a' });
}

/* ---- the step and draw hooks every boss shares ---- */
BUS.on('step', ({ dt }) => {
  if (ED.mode !== 'level' && ED.mode !== 'proving' && ED.mode !== 'gallery') return;   // (the Gallery's boss reel too)
  for (const m of ED.foes) {
    if (!m.alive) continue;
    if ((m.boss || m.bosCloneOf) && m.rig && !isFinite(m.rig.atkZ)) m.rig.atkZ = -7;   // see BOS_mv
    if (m.boss && !m.bosInit) { m.bosInit = true; const a = m.arch = Object.create(m.arch), base = a.update; a.update = function (m2, dt2) { if (base) base.call(this, m2, dt2); BOS_bossStep(m2, dt2); }; }
    if (m.bosBurning && m.spawnT <= 0 && Math.random() < dt * 8) P.add({ kind: 'fire', x: m.x + (rnd() - .5) * 6, y: m.y + (rnd() - .5) * 6, z: 12 + rnd() * (m.head || 26) * .6, vz: 22, g: -10, drag: 3, max: .35, size: 2 });
  }
  BOS_ambience(dt);
});
BUS.on('draw', ({ r }) => {
  if (ED.mode !== 'level' && ED.mode !== 'proving' && ED.mode !== 'gallery') return;   // (the Gallery's boss reel too)
  for (const m of ED.foes) {
    if (!m.alive) continue;
    if (m.arch.bosDraw) m.arch.bosDraw(m, r);
    if (m.bosRage) BOS_rageDraw(m, r);
    // bosses swing through their patterns' rig fields, not the monster attack the core smears: smear them here
    if (m.boss && m.rig && m.rigState && m.rigState.attack && !m.dormant) { const T = m.rig.trail; if (T.length > 1 && Math.hypot(T[0].t[0] - T[T.length - 1].t[0], T[0].t[1] - T[T.length - 1].t[1]) > 4) m.rig.drawSmear(r, EL(m.el).smear); }
  }
  BOS_drawCard(r);
});
// a boss struck while it slumbers wakes (no sniping it in its sleep)
BUS.on('hit', e => { const m = e.tgt; if (m && m.boss && m.dormant && m.alive) wakeBoss(m); });
// every boss death: its illusions burst, its element rises in a column, a chest falls (the Cinder King stages his own)
BUS.on('bossDown', ({ m }) => {
  for (const c of ED.foes) if (c.bosCloneOf === m) BOS_cloneVanish(c);
  // the dead a boss called up (the Cinder King's burning husks) crumble to ash with it, one after another: the fight is over
  ED.foes.filter(c => c.alive && c.bosBurning).forEach((c, i) => game.after(.5 + i * .2, () => { if (c.alive) killUnit(c, { src: null, amount: c.hp, el: 'fire', tags: ['collapse'] }); }));
  if (m.bosOwnDeath || (m.bossDef && m.bossDef.arena === false)) return;
  BOS_column(m.x, m.y, { h: 110, w: 11, dur: 1.6, el: m.el, sparks: 50 }); BOS_burstRings(m.x, m.y, m.el, 2, { r0: m.r + 8 });
  const h = ED.hero, a = h ? angTo(m, h) : 0, x = m.x + Math.cos(a) * 26, y = m.y + Math.sin(a) * 26, depth = m.level || ED.depth || 1;
  if (!m.noLoot) game.after(1.2, () => BOS_chestDrop(x, y, { depth }));   // (a boss that drops nothing, like the Gallery's, gets no chest)
});
BUS.on('kill', e => { const m = e.tgt; if (m && m.bosBurning) { P.fire(m.x, m.y, 10, 6, { size: 3.5 }); P.smoke(m.x, m.y, 14, 3, { size: 3 }); } });
BUS.on('levelStart', () => { BOS_card = null; });

/* =============================================================================
 * THE CINDER KING
 * A burnt giant (bulky, 2.3x) in blackened iron with ember cracks, a crown and a long crimson cape with a burning hem,
 * a greatsword of molten metal with fire along its edge. His throne stands at the back of his arena.
 * ============================================================================= */
const BOS_KING_PAL = { skin: '#5a3c34', hair: '#645a5a', cloth: '#403a4a', coat: '#322c3c', pants: '#2e2a36', boot: '#4a4452', belt: '#ff8a3a', trim: '#ff7a2a', glove: '#4a4452',
  cape: '#8a2228', capeIn: '#2e0e12', metal: '#ffb44a', metalDk: '#c8501a', hilt: '#8a6a3a', eye: '#1a0a08', eyeGlow: '#ffd060' };
/** his pauldrons: three lames of dark iron stacked down over each upper arm with ember seams between them and a horn of
 *  iron rising off the top; the far one is drawn before the body, so the body covers it */
function BOS_kingPads(m, g, ox, oy, view, near) {
  const rig = m.rig, J = rig.J, u = BOS_u(rig, view), c0 = rigScreen(rig, J.shC, ox, oy, view), t = E.tones('#4e4858'), hot = m.phase >= 2, T = Math.floor(game.time * 3);
  for (const s of [-1, 1]) {
    const sh = s > 0 ? J.shR : J.shL, P0 = rigScreen(rig, [sh[0] - .3, sh[1] + s * .6, sh[2] + .8], ox, oy, view);
    if ((P0[2] >= c0[2]) !== near) continue;
    const R = 2.2 * u, tip = rigScreen(rig, [sh[0] - 1, sh[1] + s * 2.2, sh[2] + 3.9], ox, oy, view), bs = rigScreen(rig, [sh[0] - .3, sh[1] + s * .9, sh[2] + 1.4], ox, oy, view);
    px.poly(g, [[bs[0] - R * .38, bs[1]], [tip[0], tip[1]], [bs[0] + R * .38, bs[1]]], t.sh); px.line(g, bs[0] - R * .15, bs[1] - 1, tip[0], tip[1], t.lt); px.dot(g, tip[0], tip[1], t.hi);
    for (let k = 2; k >= 0; k--) {
      const q = rigScreen(rig, [sh[0] - .25, sh[1] + s * (.6 + k * .45), sh[2] + .8 - k * 1.3], ox, oy, view), rr = R * (1 - k * .17), seam = hot || (k + T) % 3 === 0 ? '#ffd070' : '#ff7a2a';
      px.ell(g, q[0], q[1], rr, rr * .74, t.deep); px.ell(g, q[0] - .5, q[1] - .6, Math.max(1, rr - 1), Math.max(1, rr * .74 - 1), k ? t.sh : t.base);
      px.line(g, q[0] - rr * .55, q[1] - rr * .42, q[0] + rr * .2, q[1] - rr * .62, k ? t.base : t.lt);
      px.line(g, q[0] - rr * .7, q[1] + rr * .62, q[0] + rr * .7, q[1] + rr * .62, seam);
    }
    px.dot(g, P0[0] - R * .45, P0[1] - R * .5, t.hi);
  }
}
/** his greatsword, broad and molten: a wide blade with a dark fuller and a white-hot edge, a heavy crossguard. Drawn over
 *  the engine's thin blade, before the body when the blade is on the far side of it */
function BOS_kingBlade(m, g, ox, oy, view, near) {
  const rig = m.rig, J = rig.J, V = E.V3, bd = J.bladeDir, u = BOS_u(rig, view), Lv = BOS_bladeVis(m), c0 = rigScreen(rig, J.shC, ox, oy, view);
  const mid = rigScreen(rig, V.add(J.handR, V.mul(bd, Lv * .5)), ox, oy, view); if ((mid[2] >= c0[2] - .3) !== near) return;
  const b0 = rigScreen(rig, V.add(J.handR, V.mul(bd, 1.7)), ox, oy, view), tp = rigScreen(rig, V.add(J.handR, V.mul(bd, Lv)), ox, oy, view), pm = rigScreen(rig, V.add(J.handR, V.mul(bd, -1.8)), ox, oy, view);
  const vx = tp[0] - b0[0], vy = tp[1] - b0[1], l = Math.hypot(vx, vy) || 1, nx = -vy / l, ny = vx / l, w0 = Math.max(1.5, .95 * u), w1 = w0 * .55, cut = Lv < (m.bosLb || Lv) * .9;
  const at = (k, w) => [b0[0] + vx * k + nx * w, b0[1] + vy * k + ny * w], tipPt = cut ? null : [tp[0], tp[1]];
  const shape = (ws) => { const pts = [at(0, w0 * ws), at(.86, w1 * ws)]; if (tipPt) pts.push(tipPt); else pts.push(at(1, w1 * ws), at(1, -w1 * ws)); pts.push(at(.86, -w1 * ws), at(0, -w0 * ws)); return pts; };
  px.poly(g, shape(1.25), '#6a1e0c'); px.poly(g, shape(1), '#e0602a'); px.poly(g, shape(.58), '#ffb44a');
  const f0 = at(.06, 0), f1 = at(.8, 0); px.line(g, f0[0], f0[1], f1[0], f1[1], '#c8401a');   // the fuller
  const e0 = at(.02, w0 * .9), e1 = at(.86, w1 * .9); px.line(g, e0[0], e0[1], e1[0], e1[1], '#fff0b0'); if (tipPt) px.line(g, e1[0], e1[1], tipPt[0], tipPt[1], '#fff0b0');
  const it = E.tones('#4e4858'), gd = E.tones('#d8a238'), gw = w0 * 2.6, gA = [b0[0] + nx * gw, b0[1] + ny * gw], gB = [b0[0] - nx * gw, b0[1] - ny * gw];   // crossguard and grip
  px.line(g, pm[0], pm[1], b0[0], b0[1], '#3a2418', Math.max(1, Math.round(u * .6)));
  px.line(g, gA[0], gA[1], gB[0], gB[1], it.deep, Math.max(2, Math.round(u * .9))); px.line(g, gA[0], gA[1] - 1, gB[0], gB[1] - 1, it.lt); px.dot(g, gA[0], gA[1], gd.lt); px.dot(g, gB[0], gB[1], gd.lt);
  px.disc(g, pm[0], pm[1], Math.max(1, u * .55), gd.sh); px.dot(g, pm[0] - .5, pm[1] - .5, gd.hi);
}
/** ember cracks across his breastplate, breathing brighter and dimmer (always bright once he is ablaze) */
function BOS_kingCracks(m, g, ox, oy, view) {
  const rig = m.rig, J = rig.J, o = rig.o, V = E.V3, fr = rigScreen(rig, V.add(J.shC, [2, 0, -3]), ox, oy, view), bk = rigScreen(rig, V.add(J.shC, [-2, 0, -3]), ox, oy, view);
  if (fr[2] < bk[2]) return;   // his chest is turned away
  const f = o.torsoW * .62, pulse = .5 + .5 * Math.sin(game.time * 2.6 + m.ph), hot = m.phase >= 2 || pulse > .55, c1 = hot ? '#ffd070' : '#ff8a3a', c0 = hot ? '#ff7a2a' : '#b8401a';
  for (const L0 of [[[.12, -.7], [.3, .2], [.5, -.3], [.78, .5]], [[.3, 1.1], [.48, .6], [.66, 1.2], [.9, .9]], [[.55, -1.2], [.7, -.8]]]) {
    let prev = null;
    for (const [hz, rr] of L0) { const p = V.lerp(J.hipC, J.shC, hz), q = rigScreen(rig, [p[0] + f, rr * o.torsoW * .35, p[2]], ox, oy, view); if (prev) { px.line(g, prev[0], prev[1], q[0], q[1], c0); px.dot(g, (prev[0] + q[0]) / 2, (prev[1] + q[1]) / 2, c1); } prev = q; }
  }
}
/** how much of the blade shows above the floor: a blade driven into the stone is cut where it enters (rig units) */
function BOS_bladeVis(m) { const rig = m.rig, o = rig.o, J = rig.J, L0 = m.bosLb || o.bladeLen, bd = J.bladeDir, hz = J.handR[2] + (m.z || 0) / o.size; return bd[2] < -.05 ? Math.max(2, Math.min(L0, hz / -bd[2] + .3)) : L0; }
/** fire along the edge of his greatsword, tallest near the middle: the samples on one side of his body (near or far) */
function BOS_bladeFire(m, g, ox, oy, view, near, glow) {
  const rig = m.rig, J = rig.J, V = E.V3, Lb = BOS_bladeVis(m), t = game.time, zm = view.zoom || 1, s0 = rig.o.size / 2.3, hot = m.phase >= 2, c0 = rigScreen(rig, J.shC, ox, oy, view)[2];
  for (let k = 0; k < 7; k++) {
    const s = .2 + k * .12, q = rigScreen(rig, V.add(J.handR, V.mul(J.bladeDir, Lb * s)), ox, oy, view); if ((q[2] >= c0 - .3) !== near) continue;
    const fl = E.hash2(k + (m.ph * 10 | 0), Math.floor(t * 14));
    if (glow) glow(g, q[0], q[1], 4 * zm * s0);
    BOS_flame(g, q[0], q[1] + 1, (3 + fl * 4 + (1 - Math.abs(s - .6)) * 3) * zm * s0 * (hot ? 1.3 : 1), (1.3 + fl * .8) * zm * s0, t * 11 + k * 1.7);
  }
}
/** what glows on him: fire along the near side of the blade, flames on the crown, flames off his shoulders when ablaze.
 *  Drawn unlit, on top, unless the hero stands in front of him (then in depth order, lit by his own light). The blade's
 *  far-side fire is drawn inside his own draw, before the body, so the body covers it */
function BOS_kingGlow(m, r) {
  const rig = m.rig; if (!rig || !r.visible(m.x, m.y, m.z, 130, 200, 70)) return;
  const J = rig.J, V = E.V3, Lb = BOS_bladeVis(m), full = m.bosLb || rig.o.bladeLen, t = game.time, hot = m.phase >= 2, alive = m.alive;
  r.queue(m.x, m.y, m.z, g => {
    const [ox, oy] = BOS_root(r, m), zm = r.view.zoom || 1, s0 = rig.o.size / 2.3;
    px.glow(g, 1);
    BOS_bladeFire(m, g, ox, oy, r.view, true, (g2, x, y, rr) => r.glowDisc(g2, x, y, rr, '#ff8a3a', .35));
    const R = rig.o.headR;
    for (const kk of [-1, 0, 1]) { const q = rigScreen(rig, [J.head[0], J.head[1] + kk * R * .6, J.head[2] + R * 1.6], ox, oy, r.view); BOS_flame(g, q[0], q[1] + 1, (2 + E.hash2(kk + 5, Math.floor(t * 12)) * 2.5) * zm * s0, .9 * zm * s0, t * 13 + kk); }
    if (hot && alive) for (const sh of [J.shL, J.shR]) { const q = rigScreen(rig, V.add(sh, [-.5, 0, 1.4]), ox, oy, r.view); BOS_flame(g, q[0], q[1], (5 + E.hash2(sh === J.shL ? 1 : 2, Math.floor(t * 12)) * 5) * zm * s0, 2.2 * zm * s0, t * 9 + (sh === J.shL ? 0 : 2)); }
    const q0 = rigScreen(rig, V.add(J.handR, V.mul(J.bladeDir, Lb)), ox, oy, r.view);
    if (Lb < full * .9 && q0[2] >= rigScreen(rig, J.shC, ox, oy, r.view)[2] - .3) {   // where the blade enters the stone (in front of him): a glowing split
      const q = q0, p = .7 + .3 * Math.sin(t * 7);
      r.glowDisc(g, q[0], q[1], 7 * zm * s0, '#ff7a2a', .45 * p); px.ell(g, q[0], q[1], 4 * zm * s0, 1.3 * zm * s0, '#ff8a3a'); px.ell(g, q[0], q[1], 2.2 * zm * s0, .7 * zm * s0, '#fff0b0');
    }
  }, { emissive: !BOS_coveredAt(r, m.x, m.y, m.z || 0, 28 * (m.scale || 1) * (r.view.zoom || 1), 60 * (m.scale || 1) * (r.view.zoom || 1)) && foeGlowSeen(m.x, m.y, (m.head || 30) * (m.scale || 1) * .6), bias: .05 });
  const w = rig._w(V.add(J.handR, V.mul(J.bladeDir, Lb * .5)));
  L.add(m.x + w[0], m.y + w[1], m.z + w[2], hot ? 90 : 64, .75, { color: '#ff8a3a' });
  if (alive) L.add(m.x + 6, m.y + 10, (m.head || 60) * .8, 70, .55, { color: '#ffc890' });   // the fire he carries lights his own armor
}
/** embers and flame puffs streaming off the blade, more the faster it moves */
function BOS_kingEmbers(m, dt) {
  const rig = m.rig; if (!rig || !m.alive) return;
  const tip = rig.tip(), hd = rig.hand('R'), lt = m.bosTip || tip, vx = (tip[0] - lt[0]) / Math.max(dt, 1e-3), vy = (tip[1] - lt[1]) / Math.max(dt, 1e-3), sp = Math.hypot(vx, vy); m.bosTip = tip;
  const rate = (m.dormant ? 5 : 9) + Math.min(70, sp * .15) + (m.phase >= 2 ? 10 : 0);
  if (Math.random() < rate * dt) {
    const k = .2 + rnd() * .8, x = lerp(hd[0], tip[0], k), y = lerp(hd[1], tip[1], k), z = lerp(hd[2], tip[2], k), fire = rnd() < .45;
    P.add({ kind: fire ? 'fire' : 'ember', x, y, z, vx: -vx * .08 + (rnd() - .5) * 20, vy: -vy * .08 + (rnd() - .5) * 20, vz: 16 + rnd() * 26, g: fire ? -12 : 4, drag: 2, max: fire ? .35 : .7 + rnd() * .6, size: 1.5 + rnd(), color: rnd() < .5 ? '#ff8a3a' : '#ffd070' });
  }
  if (m.phase >= 2 && Math.random() < dt * 5) P.add({ kind: 'fire', x: m.x + (rnd() - .5) * m.r, y: m.y + (rnd() - .5) * m.r, z: (m.head || 60) * (.55 + rnd() * .3), vz: 26, g: -12, drag: 3, max: .4, size: 2.4 });
}
def('archetypes', 'cinderking', { name: 'The Cinder King', tags: ['boss', 'fire'], noPack: true, minDepth: 999, weight: 0, hp: 60, dmg: 15, speed: 27, r: 6, head: 30, mass: 99, armor: 18, xp: 60, el: 'fire', res: { fire: .5 }, elTint: false,
  rig: { build: 'bulky', weapon: 'sword', bladeLen: 19, outfit: 'coat', hair: 'long', hat: { style: 'crown', color: '#f0b030' }, sleeves: 'long', cape: { len: 9, width: 6.5, seg: 2.5 }, speedRef: 48, face: { bangs: .3 } },
  palettes: [BOS_KING_PAL],
  ai: 'melee', attacks: [{ move: 'twohand', dmg: 1.4, kb: 200 }, { move: 'slash' }],
  onSpawn(m) {
    m.glow = ['#ff7a2a', 80]; m.bosLb = m.rig.o.bladeLen;
    BOS_wrapRig(m, (g, ox, oy, v) => { m.rig.o.bladeLen = BOS_bladeVis(m); BOS_kingBlade(m, g, ox, oy, v, false); BOS_bladeFire(m, g, ox, oy, v, false); BOS_kingPads(m, g, ox, oy, v, false); }, (g, ox, oy, v) => { BOS_kingCracks(m, g, ox, oy, v); BOS_kingPads(m, g, ox, oy, v, true); BOS_kingBlade(m, g, ox, oy, v, true); m.rig.o.bladeLen = m.bosLb; });
  },
  update(m, dt) { BOS_kingEmbers(m, dt); },
  bosDraw(m, r) { BOS_kingGlow(m, r); } });

/* ---- the throne: a basalt dais, a tall spiked back with a gold crown worked into it, ember cracks, braziers ---- */
/** where the throne stands in a level: against the far (north) wall of the exit's room, as central as the wall allows */
function BOS_throneSpot(L0) {
  if (L0.bosThrone) return L0.bosThrone;
  const ex = L0.exit, m = L0.map, room = BOS_roomAt(L0, ex.x, ex.y), cx0 = Math.floor(ex.x / 16);
  let best = null;
  if (room) for (let k = 0; k < room.w && !best; k++) {
    const cx = cx0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2), cy = room.y;   // from the exit's column outward
    if (cx < room.x + 1 || cx > room.x + room.w - 2) continue;
    let ok = !m.walkable(cx, cy - 1);   // a wall behind it, not a corridor
    for (let dy = 0; dy < 3 && ok; dy++) for (let dx = -1; dx <= 1; dx++) if (!m.walkable(cx + dx, cy + dy)) { ok = false; break; }
    if (ok && Math.hypot((cx + .5) * 16 - ex.x, cy * 16 + 17 - ex.y) < 34) ok = false;   // never on the waystone (a solid throne there would bar the way down)
    if (ok) best = { x: (cx + .5) * 16, y: cy * 16 + 17 };
  }
  return (L0.bosThrone = best || { x: ex.x + (ex.x > L0.w * 8 ? -56 : 56), y: room ? room.y * 16 + 17 : ex.y - 40 });
}
function BOS_throne(L0, x, y) {
  return addThing(L0, { kind: 'throne', x, y, r: 14, solid: true, keep: true, mapColor: '#ff8a3a', heat: 1, flare: 0, t: 0,
    update(dt) {
      this.t += dt; const king = ED.boss && ED.boss.bossDef && ED.boss.bossDef.id === 'cinderking' && ED.boss.alive;
      this.heat = approach(this.heat, king ? 1 : .2, dt * .4); this.flare = Math.max(0, this.flare - dt * .8);
      if (Math.random() < dt * 5 * (this.heat + this.flare) && BOS_near(this.x, this.y, 260)) { const s = rnd() < .5 ? -1 : 1; P.add({ kind: rnd() < .4 ? 'fire' : 'ember', x: this.x + s * 11.75 + (rnd() - .5) * 3, y: this.y + 1, z: 21, vx: (rnd() - .5) * 8, vz: 24 + rnd() * 20, g: -6, drag: 1.5, max: .5 + rnd() * .5, size: 1.8, color: '#ff8a3a' }); }
    },
    draw(r) { BOS_drawThrone(r, this); } });
}
function BOS_drawThrone(r, T) {
  const x = T.x, y = T.y, v = r.view; if (!r.visible(x, y, 0, 100, 170, 60)) return;
  const st = E.tones('#554a58'), dk = E.tones('#403844'), cu = E.tones('#8a2228'), gd = E.tones('#d8a238'), heat = Math.min(1.6, T.heat + T.flare), zm = v.zoom || 1, t = game.time;
  const P3 = (a, b, c) => r.w(x + a, y + b, c), hot = heat > .5, c0 = hot ? '#ff7a2a' : '#8a3018', c1 = hot ? '#ffd070' : '#c8501a';
  const cracks = (g, lines, yy) => { for (const L0 of lines) for (let i = 0; i < L0.length - 1; i++) { const a = P3(L0[i][0], yy, L0[i][1]), b = P3(L0[i + 1][0], yy, L0[i + 1][1]); px.line(g, a[0], a[1], b[0], b[1], c0); px.dot(g, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, c1); } };
  // one item, painted back to front for this view: the dais, then the back (the far side), the seat and the arms (nearer last).
  // Its cracks and braziers are drawn in the same pass (not as unlit overlays), so the King in front covers them
  r.queue(x, y, 0, g => {
    r.box(g, x - 22, y - 15, 0, x + 22, y + 15, 3, dk.base, dk.sh);   // a two-step dais of dark basalt
    r.box(g, x - 17, y - 12, 3, x + 17, y + 11, 6, dk.lt, dk.sh);
    for (const L0 of [[[-20, 12], [-15, 8], [-17, 3]], [[19, 13], [14, 9]], [[-8, 14], [-4, 11]]]) for (let i = 0; i < L0.length - 1; i++) { const a = P3(L0[i][0], L0[i][1], 3.05), b = P3(L0[i + 1][0], L0[i + 1][1], 3.05); px.line(g, a[0], a[1], b[0], b[1], c0); }
    const back = () => {
      r.box(g, x - 13, y - 11, 6, x + 13, y - 6, 52, st.base, st.lt);
      for (const dx of [-10, -5, 0, 5, 10]) {   // spikes along the top, the middle one tallest, gilded tips
        const hh = dx ? 11 - Math.abs(dx) * .25 : 19, a = P3(dx - 2.6, -8.5, 52), b = P3(dx + 2.6, -8.5, 52), tp = P3(dx, -8.5, 52 + hh), mid = P3(dx, -8.5, 52), tk = P3(dx, -8.5, 52 + hh * .7);
        px.poly(g, [a, tp, mid], st.lt); px.poly(g, [mid, tp, b], st.sh); px.line(g, tk[0], tk[1], tp[0], tp[1], gd.lt); px.dot(g, tp[0], tp[1], gd.hi);
      }
      if (v.fy > .05) {   // the gold frame, the crown worked into the stone, the jewel, the cracks
        const f = [P3(-13, -6, 7), P3(-13, -6, 52), P3(13, -6, 52), P3(13, -6, 7)];
        for (let i = 0; i < 3; i++) px.line(g, f[i][0], f[i][1], f[i + 1][0], f[i + 1][1], gd.base);
        const cr = [[-6, 36], [-6, 43], [-3, 40], [0, 46], [3, 40], [6, 43], [6, 36]].map(([a, c]) => P3(a, -5.9, c));
        px.poly(g, cr, gd.base); for (let i = 0; i < cr.length - 1; i++) px.line(g, cr[i][0], cr[i][1], cr[i + 1][0], cr[i + 1][1], gd.lt); px.line(g, cr[6][0], cr[6][1], cr[0][0], cr[0][1], gd.sh);
        const j = P3(0, -5.8, 41); px.disc(g, j[0], j[1], 1.4 * zm, hot ? '#ff5a2a' : '#8a2a1a'); px.dot(g, j[0] - .5, j[1] - .5, '#fff0b0');
        cracks(g, [[[-5, 8], [-3, 15], [-6, 22], [-2, 30]], [[7, 7], [4, 13], [7, 20], [5, 26]], [[1, 50], [-1, 47], [2, 49]]], -5.9);
      }
    };
    const seat = () => { r.box(g, x - 10, y - 6, 6, x + 10, y + 7, 12, st.base, st.sh); r.box(g, x - 9, y - 6, 12, x + 9, y + 6, 14, cu.lt, cu.sh); const a = P3(-9, 6, 14), b = P3(9, 6, 14); if (v.fy > .05) px.line(g, a[0], a[1], b[0], b[1], gd.base); };
    const arm = s => () => {   // an armrest with a brazier bowl on it
      r.box(g, s < 0 ? x - 13.5 : x + 10, y - 6, 6, s < 0 ? x - 10 : x + 13.5, y + 8, 20, st.lt, st.sh);
      const c = P3(s * 11.75, 4, 20.2); px.ell(g, c[0], c[1], 3.4 * zm, 1.7 * zm, '#1a1014'); px.ell(g, c[0], c[1] - zm, 2.4 * zm, zm, hot ? '#c84a1a' : '#5a2a1a');
      px.glow(g, 1); BOS_flame(g, c[0], c[1] - zm, (5 + 4 * heat + 3 * E.hash2(s + 3, Math.floor(t * 12))) * zm, 2.3 * zm, t * 10 + s * 2); px.glow(g, 0);
    };
    const parts = [arm(-1), seat, arm(1)]; if (v.fx < 0) parts.reverse();   // side by side along x: the nearer one last
    if (v.fy >= 0) { back(); parts.forEach(f => f()); } else { parts.forEach(f => f()); back(); }
  });
  L.add(x, y + 4, 22, 70 + 40 * heat, .55 + .5 * heat, { color: '#ff7a2a' });
}

/* ---- his unique patterns ---- */
// kingcombo: the greatsword string. A wide slash, a backslash, then an overhead that sends a wave of fire along the floor
def('patterns', 'kingcombo', { name: 'Cinder Reaver', unique: true, range: [0, 90], start(b) {
  const h = ED.hero, R = b.r + (b.rig ? (b.rig.o.bladeLen * .85 + 5) * b.rig.o.size : 30);
  const seq = [['slash', { wind: .55, active: .12, recover: .2 }, 1.25, 1.1], ['backslash', { wind: .34, active: .12, recover: .2 }, 1.25, 1.1], ['overhead', { wind: .52, active: .1, recover: .6, z0: -7, z1: -7 }, .5, 1.6]];
  let i = -1, atk = null;
  const next = () => {
    i++; if (i >= seq.length) return false;
    const [mv, over, half] = seq[i]; atk = new E.Attack(BOS_mv(mv, over)); atk.start();
    if (i < 2) FX.telegraph({ shape: 'arc', x: b.x, y: b.y, r: R, ang: b.facing, half, dur: over.wind, owner: b, follow: b, followAng: true });
    else FX.telegraph({ shape: 'line', x: b.x, y: b.y, ang: b.facing, len: R + 150, w: 22, dur: over.wind, owner: b, follow: b, followAng: true });
    return true;
  };
  next();
  return { t: 0, rig: {}, update(dt) {
    const [, , half, dmgK] = seq[i], began = atk.update(dt);
    if (atk.phase === 'wind') AI.face(b, angTo(b, h), dt, i === 0 ? 3 : 1.6);
    if (began === 'active') {
      b.vx += Math.cos(b.facing) * 60; b.vy += Math.sin(b.facing) * 60;
      const hit = hitCone('foe', b.x, b.y, b.facing, R, half, () => ({ src: b, amount: b.dmg * dmgK, el: b.el, kb: i === 2 ? 240 : 160, ang: b.facing, knockdown: i === 2 }));
      sfx('slash2'); sfx('kick', { vol: .6 }); shake(i === 2 ? 6 : 3); if (hit) game.freeze(.05);
      const tp = b.rig ? b.rig.tip() : [b.x + Math.cos(b.facing) * R, b.y + Math.sin(b.facing) * R, 4];
      if (i === 2) { BOS_wave(b, b.facing, { speed: 230, len: R + 150, w: 18, dmg: .9, kb: 150, h: 16 }); P.explosion(tp[0], tp[1], 2, .8, { flash: false, shake: 0, freeze: false }); FX.scorch(tp[0], tp[1], 12); BOS_kick(b, -5); }
      else elBurst(tp[0], tp[1], tp[2], b.el, 6, b.facing);
    }
    b.vx *= .9; b.vy *= .9;
    this.rig = { attack: atk.state, expr: 'angry' };
    if (!atk.busy) return next();
    return true;
  } };
} });
// kingsummon: he drives the greatsword into the floor and calls; burning husks claw up out of fire circles around him
def('patterns', 'kingsummon', { name: 'Call the Burning', unique: true, range: [0, 420], start(b) {
  const h = ED.hero, alive = ED.foes.filter(m => m.alive && m.bosBurning).length, n = Math.max(0, Math.min(3 + b.phase, 7 - alive)), spots = [], sp = BOS_DRIVE;
  for (let k = 0; k < n * 4 && spots.length < n; k++) { const a = rnd() * TAU, d = 38 + rnd() * 55, x = b.x + Math.cos(a) * d, y = b.y + Math.sin(a) * d; if (BOS_open(x, y) && Math.hypot(x - h.x, y - h.y) > 26 && spots.every(s => Math.hypot(s[0] - x, s[1] - y) > 20) && ED.L.things.every(q => !q.solid || Math.hypot(q.x - x, q.y - y) > q.r + 10)) spots.push([x, y]); }
  for (const [x, y] of spots) FX.telegraph({ shape: 'circle', x, y, r: 12, dur: .95, color: '#ff8a3a' });
  return { t: 0, rig: {}, update(dt) {
    this.t += dt; const t = this.t; b.vx = b.vy = 0;
    this.rig = t < .45 ? { attack: { spec: sp, phase: 'wind', u: t / .45 }, expr: 'angry' } : t < 1.3 ? { attack: { spec: sp, phase: 'active', u: Math.min(1, (t - .45) / .1) }, expr: 'shout' } : { attack: { spec: sp, phase: 'recover', u: Math.min(1, (t - 1.3) / .4) } };
    if (t > .55 && !this.hitDone) { this.hitDone = true; shake(4); sfx('thud'); FX.scorch(b.x, b.y, 14); const tp = b.rig ? b.rig.tip() : [b.x, b.y, 0]; elBurst(tp[0], tp[1], 2, 'fire', 12); }
    if (t > .95 && !this.done) {
      this.done = true; const pool = REG.archetypes.husk ? ['husk'] : ((ED.L && ED.L.rec && ED.L.rec.pool) || []).filter(id => REG.archetypes[id]);
      for (const [x, y] of spots) {
        if (!pool.length) break;
        const m = spawnMonster(pool[0], x, y, { el: 'fire' }); if (!m) continue;
        m.ai.aware = true; m.bosBurning = true; m.glow = ['#ff8a3a', 36]; m.noLoot = rnd.chance(.6);
        BOS_column(x, y, { h: 44, w: 5, dur: .7, sparks: 20 }); P.fire(x, y, 2, 6, { size: 3 });
      }
      if (spots.length) sfx('explode', { vol: .45 });
    }
    return t < 1.75;
  } };
} });
// inferno: a crouch in a warned ring, a spin with the burning blade, a fire nova; a dash at the hero; again, bigger at the end
def('patterns', 'inferno', { name: 'Spinning Inferno', unique: true, range: [0, 220], start(b) {
  const h = ED.hero, z = BOS_sz(b), spins = 3 + (b.phase >= 2 ? 1 : 0), R = b.r + 26 * z, sp = E.move('spin').spec, set = new Set();
  let i = 0, st = 'coil', t = 0;
  const coil = () => FX.telegraph({ shape: 'circle', x: b.x, y: b.y, r: R * (i === spins - 1 ? 2.1 : 1.45), dur: .38, owner: b, follow: b });
  coil();
  return { t: 0, rig: {}, update(dt) {
    t += dt;
    if (st === 'coil') { b.vx *= .7; b.vy *= .7; AI.face(b, angTo(b, h), dt, 8); this.rig = { pose: 'crouch', expr: 'angry' }; if (t >= .38) { st = 'spin'; t = 0; set.clear(); sfx('whoosh', { pitch: .5 }); BOS_kick(b, 4); } return true; }
    if (st === 'spin') {
      const u = Math.min(1, t / .42); this.rig = { attack: { spec: sp, phase: 'active', u: 1 - Math.cbrt(1 - u) }, expr: 'shout' };
      const a = angTo(b, h); b.vx = Math.cos(a) * 55; b.vy = Math.sin(a) * 55;
      hitCircle('foe', b.x, b.y, R, u2 => ({ src: b, amount: b.dmg * .9, el: 'fire', kb: 200, ang: Math.atan2(u2.y - b.y, u2.x - b.x) }), set);
      if (Math.random() < .35) { const q = rnd() * TAU; P.add({ kind: rnd() < .5 ? 'fire' : 'ember', x: b.x + Math.cos(q) * R * .8, y: b.y + Math.sin(q) * R * .8, z: 6 + rnd() * 10, vx: -Math.sin(q) * 60, vy: Math.cos(q) * 60, vz: 20, g: -10, drag: 2, max: .35, size: 2.6 }); }
      if (u >= 1) {
        st = 'nova'; t = 0; const last = i === spins - 1;
        FX.nova({ team: 'foe', src: b, x: b.x, y: b.y, r0: b.r, r1: R * (last ? 2.1 : 1.45), dur: last ? .4 : .28, el: 'fire', hit: { amount: b.dmg * (last ? 1.1 : .7), kb: 210 } });
        shake(last ? 7 : 4); sfx(last ? 'boom' : 'explode', { vol: .5 }); P.fire(b.x, b.y, 4, last ? 16 : 8, { size: 4, speed: 60 }); FX.scorch(b.x, b.y, R * .8);
        if (last) { game.freeze(.05); for (let k = 0; k < 16; k++) FX.bolt({ team: 'foe', src: b, x: b.x, y: b.y, z: 14, ang: k / 16 * TAU, speed: 95, life: 2.6, r: 3, el: 'fire', hit: { amount: b.dmg * .5, kb: 50 }, look: { kind: 'orb', size: 1.8 }, light: 0 }); }
      }
      return true;
    }
    if (st === 'nova') {
      this.rig = { attack: { spec: sp, phase: 'recover', u: Math.min(1, t / .3) }, expr: 'angry' }; b.vx *= .85; b.vy *= .85;
      if (t >= (i === spins - 1 ? .75 : .1)) { i++; if (i >= spins) return false; st = 'dash'; t = 0; }
      return true;
    }
    // the dash: straight at the hero, blade trailing fire, into the next coil
    b.facing = E.approachAng(b.facing, angTo(b, h), dt * 6); b.vx = Math.cos(b.facing) * 150; b.vy = Math.sin(b.facing) * 150; this.rig = { dash: true, expr: 'shout' };
    if (Math.random() < .5) P.add({ kind: 'fire', x: b.x, y: b.y, z: 4, vz: 12, g: -6, drag: 3, max: .4, size: 2.4 });
    if (t >= .3 || Math.hypot(h.x - b.x, h.y - b.y) < R * .7) { st = 'coil'; t = 0; coil(); }
    return true;
  } };
} });

/* ---- his death: slow motion, a stagger, his knees, a column of fire that eats him, a fountain of loot, a chest ---- */
function BOS_kingDeath(b) {
  const bare = !!b.noLoot;   // spawned to drop nothing (the Gallery): the same death, no fountain and no chest
  b.noLoot = true; b.bosOwnDeath = true; b.arch = Object.assign(Object.create(b.arch), { corpseT: 99 });   // the corpse stays until the fire takes it (b.gone)
  const x = b.x, y = b.y, depth = b.level || ED.depth || 5, h = ED.hero, mf = (h && h.stats.magicFind) || 0, gf = (h && h.stats.goldFind) || 0, T = ED.L && ED.L.things && ED.L.things.find(q => q.kind === 'throne');
  const loot = [];   // the fountain: what the core would drop for a boss (a legendary first), plus a potion
  const nItems = 5 + rnd.int(0, 3); for (let i = 0; i < nItems; i++) loot.push(['item', { item: makeItem({ ilvl: depth + 1, rarity: i === 0 ? 3 : rollRarity(depth, rnd, mf, .6) }) }]);
  const gold = Math.max(1, Math.round((3 + rnd() * 7) * SCALE.gold(depth) * (1 + gf / 100) * 24)); for (let i = 0; i < 6; i++) loot.splice(1 + i * 2, 0, ['gold', { n: Math.ceil(gold / 6) }]);
  if (h && h.potions < h.maxPotions) loot.push(['potion', {}]);
  if (bare) loot.length = 0;
  let rt = 0, knees = false, col = false, gone = false, chest = false, spray = 0, nt = 0;
  sfx('bos_roar', { pitch: .75 }); if (T) T.flare = 1;
  const f = addFx({ kind: 'bosKingDeath', t: 0, update: dt => {
    const real = dt / Math.max(.05, game.timeScale); rt += real;
    if (rt < 3) slowMo(rt < 1.1 ? .3 : lerp(.3, 1, (rt - 1.1) / 1.9), .05, 'bossdown');   // the core's slowdown, reshaped into his long fall
    const rig = b.rig;
    if (rig && !gone) {
      if (rt < 1.1) { rig.dieT = .08; rig.expr = 'shout'; }                                  // the stagger: head thrown back
      else if (rt < 2.9) { rig.dieT = .34; rig.expr = 'wince'; if (!knees) { knees = true; shake(5); sfx('thud'); P.dust(x, y, 0, 20, { speed: 70 }); FX.scorch(x, y, 18); } }   // his knees hit the stone
      if (Math.random() < real * 30) { const q = rnd() * TAU; P.add({ kind: rnd() < .5 ? 'fire' : 'ember', x: x + Math.cos(q) * b.r * .6, y: y + Math.sin(q) * b.r * .6, z: 10 + rnd() * (b.head || 60) * .7, vz: 30 + rnd() * 30, g: -10, drag: 2, max: .5, size: 2, color: '#ff8a3a' }); }
    }
    if (rt > 2.0 && !col) { col = true; BOS_column(x, y, { h: 170, w: 17, dur: 2.8, sparks: 90, bias: .2 }); BOS_burstRings(x, y, 'fire', 3, { r0: 26, step: 20 }); game.flash('#ffb050', .25, .7); shake(8); sfx('boom'); if (T) T.flare = 1.5; }
    if (col && spray < loot.length && rt > 2.35) { nt -= real; if (nt <= 0) { nt = .11; const [kind, o] = loot[spray++], a = spray * 2.4 + rnd() * .6, sp = 40 + rnd() * 45; dropLoot(kind, x, y, Object.assign({ z: 50 + rnd() * 20, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 170 + rnd() * 70 }, o)); if (kind === 'gold') sfx('coin', { vol: .3 }); } }
    if (rt > 3.3 && !gone) { gone = true; b.gone = true; P.smoke(x, y, 20, 10, { size: 6, color: '#4a4048', dark: '#1a1418', light: '#6a6068' }); for (let i = 0; i < 24; i++) P.add({ kind: 'dust', x: x + (rnd() - .5) * 20, y: y + (rnd() - .5) * 20, z: rnd() * 50, vx: (rnd() - .5) * 30, vy: (rnd() - .5) * 30, vz: 20 + rnd() * 30, g: -4, drag: 1, max: 1.5 + rnd(), size: 1.4, color: rnd() < .5 ? '#5a5058' : '#8a7a78' }); }
    if (rt > 3.9 && !chest) { chest = true; if (bare) return rt < 4.3; const cx = T ? T.x : x, cy = T ? T.y + 40 : y; BOS_chestDrop(cx, cy, { depth, big: true }); }
    return rt < 4.3;
  } });
  void f;
}

def('bosses', 'cinderking', { name: 'The Cinder King', title: 'Sovereign of Ash', arch: 'cinderking', size: 2.3, hp: 17, dmg: 1.4, el: 'fire', levelName: 'The Cinder Throne', music: 'boss', minDepth: 5,
  pal: BOS_KING_PAL,
  phases: [   // (the first boss must take a careless hero below a quarter of his life: a longer fight, less breathing room)
    { at: 1, patterns: ['kingcombo', 'slam', 'firewave'], gap: 1 },
    { at: .6, patterns: ['kingcombo', 'kingsummon', 'meteorrain', 'firewave', 'slam'], gap: .85 },
    { at: .3, patterns: ['inferno', 'kingcombo', 'meteorrain', 'slam', 'firewave'], gap: .62 }],
  sleepRig: { pose: 'kneel', attack: { spec: BOS_mv('plunge'), phase: 'active', u: 1 }, expr: null },   // kneeling, the greatsword driven into the floor before him
  /** at his spawn: the throne behind him (in his own arena he takes his place before it) */
  intro(b) {
    const L0 = ED.L; if (!L0 || !L0.things) return;
    const own = L0.rec && L0.rec.boss === 'cinderking', sp = own && L0.exit ? BOS_throneSpot(L0) : { x: b.x, y: b.y - 34 };
    if (own) { b.x = sp.x; b.y = sp.y + 30; }
    if (!L0.things.some(q => q.kind === 'throne')) BOS_throne(L0, sp.x, sp.y);
    b.facing = Math.PI / 2;
  },
  /** his roar: flame bursts from the floor in rings; when he wakes, the vents of his hall erupt one after another */
  bosRoar(b, kind) {
    BOS_burstRings(b.x, b.y, 'fire', kind === 'wake' ? 3 : 2, { r0: b.r + 14, step: 20 }); game.flash('#ff8a3a', .12, .4);
    const T = ED.L.things.find(q => q.kind === 'throne'); if (T) T.flare = 1;
    if (kind === 'wake') for (const v of ED.L.things) if (v.kind === 'vent' && v.prime && Math.hypot(v.x - b.x, v.y - b.y) < 240) game.after(.35 + Math.hypot(v.x - b.x, v.y - b.y) / 300, () => v.prime(null));
  },
  update(b, dt) {
    if (b.bosForce && !b.pat && !b.dormant) { const id = b.bosForce; b.bosForce = null; if (REG.patterns[id]) { b.pat = REG.patterns[id].start(b, (b.bossDef.phases || [])[b.phase]); b.lastPat = id; } }
    if (b.phase >= 2 && !b.dormant) {   // ablaze: hasted, and the floor burns where he walks
      b.st.haste = { t: .25 };
      if (!b.bosTrail) b.bosTrail = [b.x, b.y];
      if (Math.hypot(b.x - b.bosTrail[0], b.y - b.bosTrail[1]) > 13) { b.bosTrail = [b.x, b.y]; if (BOS_open(b.x, b.y)) FX.area({ team: 'foe', src: b, x: b.x, y: b.y, r: 10, dur: 3.5, tick: .5, el: 'fire', light: false, hit: { amount: b.dmg * .2, kb: 0, statusChance: .4 } }); }
    }
  },
  onPhase(b, i) {
    if (i === 1) { b.bosForce = 'kingsummon'; notify('THE CINDER KING CALLS THE BURNING DEAD', '#ff8a3a', 2.5); }
    if (i === 2) { b.bosForce = 'inferno'; b.speed *= 1.15; b.glow = ['#ffb040', 110]; notify('THE CINDER KING IS ABLAZE', '#ffd070', 2.5); }
  },
  onDie(b) { BOS_kingDeath(b); }
});

/* =============================================================================
 * MAGMA (depth 5): molten fissures and fire vents
 * Fissures are one-cell cracks of the standard 'lava' floor tag (the core burns whoever stands in them). Vents glow and
 * rumble, then a geyser of fire bursts out of them: it hurts everyone near, the hero included, and it scalds a boss
 * for a share of its life and leaves it Exposed (+25% damage taken). A hit on a vent sets it off early. In the boss
 * arena a ring of vents surrounds the floor, and cracks run out from the throne.
 * ============================================================================= */
const BOS_VENT_R = 22, BOS_VENT_WARN = 1.15;
function BOS_vent(L0, x, y, R) {
  return addThing(L0, { kind: 'vent', x, y, r: 7, hittable: true, solid: false, mapColor: '#ff6a2a', st: 'idle', t: R() * 4, period: 5.5 + R() * 3.5, cool: 0, glow: .25, ph: R() * TAU, src: null, tick: 0,
    prime(src) {
      if (this.st !== 'idle' || this.cool > 0) return false;
      this.st = 'warn'; this.t = 0; this.src = src || ED.hero;
      if (BOS_near(this.x, this.y, 240)) sfx('bos_rumble', { vol: .3 });
      FX.telegraph({ shape: 'circle', x: this.x, y: this.y, r: BOS_VENT_R, dur: BOS_VENT_WARN });
      return true;
    },
    onHit(hit) { this.prime(hit.src && hit.src.team === 'hero' ? hit.src : ED.hero); },
    update(dt) { BOS_ventStep(this, dt); },
    draw(r) { BOS_drawVent(r, this); } });
}
function BOS_ventStep(v, dt) {
  v.t += dt; v.cool -= dt;
  if (v.st === 'idle') {
    v.glow = approach(v.glow, .22 + .1 * Math.sin(game.time * 2 + v.ph), dt * 2);
    if (!BOS_near(v.x, v.y, 260)) v.t -= dt;   // far from the hero its clock stops: it only simmers (no unseen eruptions farming kills)
    if (v.t >= v.period && v.cool <= 0) v.prime(ED.hero);
    if (Math.random() < dt * 1.2 && BOS_near(v.x, v.y, 220)) P.smoke(v.x, v.y, 6, 1, { size: 2.5, color: '#5a4a4a', dark: '#2a2226', light: '#7a6a68' });
  } else if (v.st === 'warn') {
    const u = v.t / BOS_VENT_WARN; v.glow = .3 + .7 * u;
    if (Math.random() < dt * (6 + 22 * u)) P.sparks(v.x, v.y, 6, 1, null, { color: '#ff9a3a', hot: '#fff0a0' });
    if (Math.random() < dt * 9 * u) P.add({ kind: 'bit', x: v.x + (rnd() - .5) * 6, y: v.y + (rnd() - .5) * 6, z: 5, vx: (rnd() - .5) * 30, vy: (rnd() - .5) * 30, vz: 60 + rnd() * 60, g: 420, max: .6, size: 1, color: rnd() < .5 ? '#ff8a3a' : '#ffd070' });   // it spits
    if (v.t >= BOS_VENT_WARN) { v.st = 'erupt'; v.t = 0; BOS_erupt(v); }
  } else if (v.st === 'erupt') {
    v.glow = 1; v.tick -= dt; if (v.tick <= 0) { v.tick = .3; BOS_ventBurn(v, BOS_VENT_R - 4, .5); }
    if (Math.random() < dt * 40) P.add({ kind: 'bit', x: v.x, y: v.y, z: 20 + rnd() * 50, vx: (rnd() - .5) * 90, vy: (rnd() - .5) * 90, vz: 40 + rnd() * 90, g: 420, bounce: .2, max: .9, size: rnd() < .3 ? 2 : 1, color: rnd() < .5 ? '#ff8a3a' : '#ffd070' });   // lava droplets
    if (v.t >= .9) { v.st = 'burn'; v.t = 0; v.tick = .5; }
  } else if (v.st === 'burn') {
    v.glow = approach(v.glow, .35, dt); v.tick -= dt; if (v.tick <= 0) { v.tick = .5; BOS_ventBurn(v, 13, .25); }
    if (Math.random() < dt * 14) P.add({ kind: 'fire', x: v.x + (rnd() - .5) * 18, y: v.y + (rnd() - .5) * 18, z: 1, vz: 16, g: -8, drag: 3, max: .45, size: 2.2 });
    if (v.t >= 1.8) { v.st = 'idle'; v.t = 0; v.cool = 1.5; v.period = 5.5 + rnd() * 3.5; }
  }
}
/** a boss caught in a geyser: a scald worth a share of its life, and Exposed for a while */
function BOS_scaldBoss(u, src) {
  dealDamage(u, { src, amount: Math.max(heroHitAmount(1.5), u.maxHp * .03), el: 'phys', kb: 0, tags: ['magma'] });
  applyStatus(u, 'vuln', 0, src); BOS_kick(u, -4); P.text(u.x, u.y, (u.head || 40) + 8, 'EXPOSED', '#ff6a8a'); P.fire(u.x, u.y, 10, 6, { size: 4 });
}
/** the geyser: everything close is blasted up and set alight (the hero too), bosses are scalded */
function BOS_erupt(v) {
  const x = v.x, y = v.y, R = BOS_VENT_R, src = v.src && v.src.alive !== false ? v.src : ED.hero, amt = heroHitAmount(3), set = new Set([v]);
  hitCircle('hero', x, y, R, u => { if (u.boss && u.dormant) return null; if (u.boss) BOS_scaldBoss(u, src); return { src, amount: amt, el: 'fire', kb: 150, up: u.boss ? 0 : 150, ang: Math.atan2(u.y - y, u.x - x), statusChance: .8, tags: ['aoe', 'magma'] }; }, set);
  const h = ED.hero; if (h && h.alive && Math.hypot(h.x - x, h.y - y) < R + h.r) dealDamage(h, { src: null, amount: h.maxHp * .14 + 3 * (ED.depth || 1), el: 'fire', kb: 200, ang: angTo(v, h), statusChance: .6 });
  BOS_column(x, y, { h: 62, w: 8, dur: 1.15, sparks: 40 });
  P.fire(x, y, 4, 10, { size: 4, speed: 50 }); P.ring(x, y, 4, R + 8, '#ffe070', .4); FX.scorch(x, y, 14);
  if (BOS_near(x, y, 260)) { shake(4); sfx('bos_geyser'); }
}
/** the lingering burn around a vent while it spouts and after */
function BOS_ventBurn(v, R, k) {
  const src = v.src || ED.hero, amt = heroHitAmount(3) * k * .5;
  eachEnemy('hero', v.x, v.y, R, u => { if (!u.boss) dealDamage(u, { src, amount: amt, el: 'fire', kb: 0, statusChance: .5, tags: ['magma', 'dot'] }); });
  const h = ED.hero; if (h && h.alive && (h.z || 0) < 4 && Math.hypot(h.x - v.x, h.y - v.y) < R + h.r) dealDamage(h, { src: null, amount: h.maxHp * .05 * k * 2 + 1, el: 'fire', kb: 60, ang: angTo(v, h), statusChance: .3 });
}
function BOS_drawVent(r, v) {
  if (!r.visible(v.x, v.y, 0, 40, 60, 30)) return;
  const gl = v.glow, rock = E.tones('#4a3c3c'), zm = r.view.zoom || 1, hot = E.mix('#5a1a10', '#ffe070', clamp(gl, 0, 1)), crack = gl > .55 ? '#ffb040' : gl > .3 ? '#e0602a' : '#8a3018';
  r.decal(() => {   // scorched ground and glowing cracks around the mouth
    const g = r.tgt; r.groundDisc(v.x, v.y, 13, '#1a1012', .5);
    for (let k = 0; k < 5; k++) { const a = v.ph + k * 1.26, a2 = a + .35 * Math.sin(k * 3.1), p0 = r.w(v.x + Math.cos(a) * 7, v.y + Math.sin(a) * 7, 0), p1 = r.w(v.x + Math.cos(a) * 11, v.y + Math.sin(a) * 11, 0), p2 = r.w(v.x + Math.cos(a2) * (14 + k % 3 * 2), v.y + Math.sin(a2) * (14 + k % 3 * 2), 0); px.line(g, p0[0], p0[1], p1[0], p1[1], crack); px.line(g, p1[0], p1[1], p2[0], p2[1], crack); }
  }, { emissive: gl });
  r.queue(v.x, v.y, 0, g => {   // the cone: stacked rings of rock, darker at the foot, a lit rim at the top
    for (let k = 0; k <= 5; k++) { const c = k < 2 ? rock.deep : k < 4 ? rock.sh : rock.base; px.poly(g, r.groundPts(v.x, v.y, lerp(9, 5, k / 5), 14, k), c); }
    px.poly(g, r.groundPts(v.x - .5, v.y - .5, 4.6, 12, 5.4), rock.lt);
  });
  r.queue(v.x, v.y, 0, g => {   // unlit: the mouth, and lava running down the flank
    px.glow(g, 1);
    px.poly(g, r.groundPts(v.x, v.y, 3.3, 12, 5.6), hot); if (gl > .45) px.poly(g, r.groundPts(v.x - .3, v.y - .3, 1.8, 10, 5.7), '#fff4c0');
    if (gl > .35) for (const a of [v.ph, v.ph + 2.4]) { const p0 = r.w(v.x + Math.cos(a) * 4, v.y + Math.sin(a) * 4, 5), p1 = r.w(v.x + Math.cos(a) * 7.5, v.y + Math.sin(a) * 7.5, 1); px.line(g, p0[0], p0[1], p1[0], p1[1], crack, Math.max(1, Math.round(zm))); }
  }, { emissive: foeGlowSeen(v.x, v.y, 5), bias: .001 });
  if (v.st !== 'idle') L.add(v.x, v.y, 8, 26 + 60 * gl, .25 + .8 * gl, { color: '#ff7a2a' });   // idle vents lean on the cracks' light
}
/** the room a point is in (or the nearest room) */
function BOS_roomAt(L0, x, y) { const cx = x / 16, cy = y / 16; let best = null, bd = 1e9; for (const q of L0.rooms) { const d = cx >= q.x && cx < q.x + q.w && cy >= q.y && cy < q.y + q.h ? -1 : Math.hypot(q.cx - cx, q.cy - cy); if (d < bd) { bd = d; best = q; } } return best; }
function BOS_placeMagma(L0, R) {
  const m = L0.map, W = L0.w, tags = m.floorTags, start = L0.start, ex = L0.exit, lava = L0.bosLava = L0.bosLava || [];
  const ok = (cx, cy) => {
    if (cx < 1 || cy < 1 || cx >= W - 1 || cy >= L0.h - 1) return false; const i = cy * W + cx; if (m.cell(cx, cy) !== 0 || tags[i] || m.blocked[i]) return false;
    const x = (cx + .5) * 16, y = (cy + .5) * 16; if (Math.hypot(x - start.x, y - start.y) <= 56 || (ex && Math.hypot(x - ex.x, y - ex.y) <= 40)) return false;
    // nothing stands in the magma: kegs, pylons and chests keep their feet cool, and so do the braziers
    return !(L0.things || []).some(t => Math.hypot(t.x - x, t.y - y) < (t.r || 6) + 12) && !(L0.torches || []).some(b => Math.hypot(b.x - x, b.y - y) < 12);
  };
  const tag = (cx, cy) => { if (ok(cx, cy)) { tags[cy * W + cx] = 'lava'; lava.push(cy * W + cx); } };
  const boss = L0.rec && L0.rec.boss, bossRoom = boss && ex ? BOS_roomAt(L0, ex.x, ex.y) : null, spot = boss === 'cinderking' && ex ? BOS_throneSpot(L0) : null;
  // fissures: meandering one-cell cracks of molten rock across the rooms (the landing room stays cool)
  for (const room of L0.rooms) {
    if (room === L0.rooms[0]) continue;
    const cracks = Math.max(1, Math.round(room.w * room.h / 60));
    for (let k = 0; k < cracks; k++) {
      if (!R.chance(.7)) continue;
      let cx = room.x + 1 + R.int(0, Math.max(0, room.w - 3)), cy = room.y + 1 + R.int(0, Math.max(0, room.h - 3)), dx = R.chance(.5) ? 1 : 0, dy = dx ? 0 : 1;
      if (R.chance(.5)) { dx = -dx; dy = -dy; }
      for (let s = 0, len = R.int(4, 9); s < len; s++) {
        tag(cx, cy);
        if (R.chance(.35)) { const s2 = R.chance(.5) ? 1 : -1, ndx = -dy * s2, ndy = dx * s2; dx = ndx; dy = ndy; }
        cx += dx; cy += dy;
        if (cx <= room.x || cy <= room.y || cx >= room.x + room.w - 1 || cy >= room.y + room.h - 1) break;
      }
    }
  }
  // cracks running out from the throne's dais into the arena
  if (spot) for (const a of [.6, Math.PI - .6, Math.PI / 2 + .15]) { let x = spot.x + Math.cos(a) * 30, y = spot.y + 14 + Math.sin(a) * 18; for (let s = 0; s < 6; s++) { tag(Math.floor(x / 16), Math.floor(y / 16)); const w = a + (R() - .5) * .9; x += Math.cos(w) * 14; y += Math.sin(w) * 14; } }
  // vents: a few per room, spaced out; in a boss arena a ring of them around the floor
  const vents = [], far = (x, y) => vents.every(q => Math.hypot(q.x - x, q.y - y) > 44) && Math.hypot(x - start.x, y - start.y) > 70;
  const free = (x, y) => { const cx = Math.floor(x / 16), cy = Math.floor(y / 16); return BOS_openAt(L0, x, y) && !tags[cy * W + cx]; };
  for (const room of L0.rooms) {
    if (room === L0.rooms[0] || room === bossRoom) continue;
    const n = R.int(1, Math.max(1, Math.round(room.w * room.h / 45)));
    for (let k = 0; k < n; k++) { const [x, y] = L0.randomFloor(R, { room, edge: 1, minStart: 70 }); if (free(x, y) && far(x, y)) vents.push(BOS_vent(L0, x, y, R)); }
  }
  if (bossRoom) {
    const cx = (bossRoom.x + bossRoom.w / 2) * 16, cy = (bossRoom.y + bossRoom.h / 2) * 16 + 8, rad = Math.max(40, Math.min(bossRoom.w, bossRoom.h) * 16 * .34), n = rad > 60 ? 7 : 5;
    for (let k = 0; k < n; k++) { const a = k / n * TAU + .3, x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad; if (free(x, y) && far(x, y) && (!spot || Math.hypot(x - spot.x, y - spot.y) > 42) && (!ex || Math.hypot(x - ex.x, y - ex.y) > 24)) vents.push(BOS_vent(L0, x, y, R)); }
  }
  L0.bosLavaPts = lava.filter((_, i) => i % 3 === 0).map(i => [(i % W + .5) * 16, (Math.floor(i / W) + .5) * 16]);
  m.shimmer = true; m.floors = {};
}
/** molten cracks bubble and spit embers near the hero */
function BOS_magmaAmbience(L0, dt) {
  const lava = L0.bosLava, h = ED.hero; if (!lava || !lava.length || !h) return;
  for (let k = 0; k < 3; k++) {
    const i = lava[(Math.random() * lava.length) | 0], x = (i % L0.w + Math.random()) * 16, y = (Math.floor(i / L0.w) + Math.random()) * 16;
    if (Math.abs(x - h.x) > 200 || Math.abs(y - h.y) > 160 || Math.random() > dt * 40) continue;
    if (Math.random() < .5) P.add({ kind: 'ember', x, y, z: 1, vx: (rnd() - .5) * 10, vy: (rnd() - .5) * 10, vz: 20 + rnd() * 30, drag: .8, max: .8 + rnd() * .8, color: rnd() < .5 ? '#ff8a3a' : '#ffd070' });
    else P.add({ kind: 'fire', x, y, z: 0, vz: 8, g: -4, drag: 3, max: .3, size: 1.4 });
  }
}
/** the cracks light their surroundings (the nearest ones, capped) */
function BOS_magmaLights(L0) {
  const pts = L0.bosLavaPts, h = ED.hero; if (!pts || !h) return;
  let n = 0; const t = game.time;
  for (const [x, y] of pts) { if (Math.abs(x - h.x) > 190 || Math.abs(y - h.y) > 150) continue; L.add(x, y, 2, 38, .5 + .12 * Math.sin(t * 3 + x * .1), { color: '#ff6a2a' }); if (++n >= 6) break; }
}
def('mechanics', 'magma', { name: 'Magma Vents', title: 'The Cinder Throne', adj: 'Molten', noun: 'Forges', color: '#ff6a2a', depth: 5, weight: 10, themes: ['forge'],
  tip: 'Vents glow, then erupt in pillars of fire that burn everyone near. Lure monsters (and bosses) onto them; strike a vent to set it off. Molten cracks burn.',
  icon: (g, x, y, s) => {
    px.poly(g, [[x + 1 * s, y + 15 * s], [x + 6 * s, y + 7 * s], [x + 10 * s, y + 7 * s], [x + 15 * s, y + 15 * s]], '#4a3a3a'); px.poly(g, [[x + 3 * s, y + 15 * s], [x + 6.5 * s, y + 8 * s], [x + 8 * s, y + 8 * s], [x + 6 * s, y + 15 * s]], '#6a5048');
    px.poly(g, [[x + 5.5 * s, y + 7 * s], [x + 8 * s, y], [x + 10.5 * s, y + 7 * s]], '#ff8a3a'); px.poly(g, [[x + 6.8 * s, y + 7 * s], [x + 8 * s, y + 3 * s], [x + 9.2 * s, y + 7 * s]], '#ffe070');
    px.line(g, x + 9 * s, y + 8 * s, x + 11 * s, y + 13 * s, '#ff6a2a');
  },
  place(L0, R) { BOS_placeMagma(L0, R); },
  update(L0, dt) { BOS_magmaAmbience(L0, dt); },
  draw(L0) { BOS_magmaLights(L0); }
});
