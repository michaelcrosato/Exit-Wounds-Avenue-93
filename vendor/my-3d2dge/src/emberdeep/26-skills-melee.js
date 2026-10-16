/* =============================================================================
 * MELEE SKILLS: the hero's sword-and-fist arts. Eight actives with contractual ids:
 *   cleave (Overhead Cleave)  whirlwind (Whirlwind)   lunge (Piercing Lunge)  leap (Leap Slam)
 *   uppercut (Rising Blade)   kick (Spinning Kick)    flurry (Brawler's Flurry) bladethrow (Returning Blade)
 * Each is a skills registry entry (the spec is in 25-skills-core.js) whose cast() returns an action that drives the
 * Humanoid through anticipation, strike, follow-through and recovery, with hit-stop, shake, sparks, element smears
 * and chip sounds. Every skill has two runes that change what it does (an element, more waves, a pull, a status).
 * The shared kit (SKM_*): move specs, the impact kit, the JUGGLE bonus (airborne foes take 30% more from these
 * skills: launch with Rising Blade, Leap Slam or the Flurry's finisher, then keep them up), floor cracks, kicked
 * bodies that bowl others over, the thrown sword, and a guard that always gives the hero his sword back.
 * ============================================================================= */

/* ---------- sounds (chip voices layered per blow) ---------- */
A.define('skmChop', [{ wave: 'noise', freq: 2400, to: 380, dur: .17, vol: .3, filter: 'bandpass', q: 1.6 }, { wave: 'saw', freq: 260, to: 70, dur: .14, vol: .09 }]);
A.define('skmSlam', [{ wave: 'sine', freq: 120, to: 30, dur: .36, vol: .62 }, { wave: 'noise', freq: 1100, to: 80, dur: .34, vol: .42, filter: 'lowpass' }, { wave: 'square', freq: 82, to: 38, dur: .12, vol: .12 }, { wave: 'noise', freq: 3000, to: 900, dur: .08, vol: .18, filter: 'bandpass', delay: .02 }]);
A.define('skmWhirl', [{ wave: 'noise', freq: 700, to: 2600, dur: .15, vol: .16, filter: 'bandpass', q: 2 }, { wave: 'noise', freq: 2600, to: 900, dur: .1, vol: .1, filter: 'bandpass', q: 2, delay: .12 }]);
A.define('skmRise', [{ wave: 'noise', freq: 500, to: 3600, dur: .18, vol: .24, filter: 'bandpass', q: 1.8 }, { wave: 'triangle', freq: 260, to: 1040, dur: .14, vol: .1 }]);
A.define('skmDash', [{ wave: 'noise', freq: 4200, to: 700, dur: .2, vol: .26, filter: 'bandpass', q: 1.4 }, { wave: 'square', freq: 520, to: 180, dur: .06, vol: .06 }]);
A.define('skmThrow', [{ wave: 'noise', freq: 900, to: 3000, dur: .14, vol: .22, filter: 'bandpass', q: 2.2 }]);
A.define('skmWhirr', { wave: 'noise', freq: 1500, to: 2100, dur: .07, vol: .09, filter: 'bandpass', q: 5 });
A.define('skmCatch', [{ wave: 'square', freq: 1480, to: 1400, dur: .07, vol: .1 }, { wave: 'triangle', freq: 2960, dur: .22, vol: .08 }, { wave: 'noise', freq: 6000, dur: .03, vol: .14, filter: 'highpass' }, { wave: 'triangle', freq: 1975, dur: .3, vol: .06, delay: .06 }]);
A.define('skmBowl', [{ wave: 'sine', freq: 150, to: 55, dur: .16, vol: .5 }, { wave: 'noise', freq: 900, to: 200, dur: .1, vol: .3, filter: 'lowpass' }]);

/* ---------- the shared kit ---------- */
const SKM_JUGGLE = 1.3, SKM_LIGHT = ['#ffffff', '#eafcff', '#a8e8ff', '#4a9ad4'], SKM_ROCK = ['#6a5a52', '#4a4050', '#8a7a6a', '#2e2834', '#9a8a78'];
/** a move spec: an E.MOVES entry plus overrides. The rig keys its wind-up on the spec object, so one object drives a whole swing */
const SKM_spec = (name, over) => Object.assign({ name, hitAt: .35, wind: .06, active: .1, recover: .18 }, E.MOVES[name] || {}, over || {});
/** the attack state the rig wants for a spec at a moment (skills that time their own phases) */
const SKM_st = (spec, phase, u) => ({ spec, phase, u: clamp(u, 0, 1) });
/** '260%': a skill scale at a rank, as the tooltip reads it (heroHit adds 12% per rank) */
const SKM_pct = (scale, rank) => Math.round(scale * (1 + Math.max(0, (rank || 1) - 1) * .12) * 100) + '%';
const SKM_air = u => !!(u.air || ((u.z || 0) > 3 && !u.canFly));
/** can the hero stand at (x, y): open floor (no wall, pit or deep water) under him and around his feet */
function SKM_open(x, y, r = 4.5) {
  const m = ED.L && ED.L.map; if (!m) return true;
  for (const [dx, dy] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) if (!m.walkable(Math.floor((x + dx) / m.T), Math.floor((y + dy) / m.T))) return false;
  return true;
}
/** the hit a melee skill lands on u: ctx.hit plus an angle, launch, stun and status. Airborne foes take the juggle bonus
 *  and are lifted again (o.lift: false for blows that should not: whirlwind ticks, bodies colliding, slams) */
function SKM_hit(ctx, u, scale, o = {}) {
  const h = ED.hero, x = { ang: o.ang !== undefined ? o.ang : Math.atan2(u.y - h.y, u.x - h.x) };
  if (o.up) x.up = o.up; if (o.stun) x.stun = o.stun; if (o.status) x.status = o.status; if (o.statusChance !== undefined) x.statusChance = o.statusChance;
  const q = { kb: o.kb || 0, extra: x }; if (o.el && o.el !== ctx.S.el) q.el = o.el; if (o.tags) q.tags = o.tags;
  const air = SKM_air(u) && u.team === 'foe' && !o.nojug;
  if (!air) u.skmJugN = 0;   // back on its feet: the next juggle starts fresh
  // juggle decay (as in fighting games): every blow that lifts a foe already in the air lifts it less (x0.8 each), the
  // flurry's knee and uppercut included, so a string ends with the foe on the floor after six or seven blows instead
  // of an endless, helpless float (the flurry alone used to keep one foe up for good)
  const dk = air && !u.boss && (o.up || o.lift !== false) ? Math.pow(.8, u.skmJugN = (u.skmJugN || 0) + 1) : 1;
  if (o.up) x.up = o.up * dk;
  if (air && !o.up && o.lift !== false && !u.boss) {   // the juggle: a blow on an airborne foe keeps it up, hanging just in front of him
    const top = 26 * dk;   // 21, 17, 13...
    x.up = Math.max(28, Math.sqrt(1040 * Math.max(0, top - (u.z || 0))) * Math.sqrt(u.mass || 1)); q.kb = 21;   // just enough to float back up to the top: it hangs there
    const fx = h.x + Math.cos(h.facing) * 9, fy = h.y + Math.sin(h.facing) * 9;
    if (Math.hypot(u.x - h.x, u.y - h.y) < 40) { u.vx = (fx - u.x) * 2.5; u.vy = (fy - u.y) * 2.5; } else { u.vx *= .3; u.vy *= .3; }
  }
  if (air && game.time - (u.skmJug || 0) > .6 && game.time - SKM_hit.pop > .35) {   // the label pops on the far side of the foe from him (the juggled foe hangs right in front of him: over it, it sat on his head)
    u.skmJug = SKM_hit.pop = game.time; const dx = u.x - h.x, dy = u.y - h.y, d = Math.hypot(dx, dy) || 1;
    P.text(u.x + dx / d * 14, u.y + dy / d * 14, (u.z || 0) + (u.head || 20) * .8, u.skmJugN > 1 ? 'JUGGLE x' + u.skmJugN : 'JUGGLE', '#ffd23a');
  }
  return ctx.hit(scale * (air ? SKM_JUGGLE : 1), q);
}
SKM_hit.pop = -1;   // the JUGGLE popup, at most every .35 s
/** the punch of a landed blow: hit-stop, shake, an impact star, sparks along the blow, element bits, a sound */
function SKM_impact(u, ang, p = 1, el = 'phys', snd = 'hit') {
  const e = EL(el), z = (u.z || 0) + (u.head || 20) * .5, r0 = (u.r || 4) * .6, x = u.x - Math.cos(ang) * r0, y = u.y - Math.sin(ang) * r0;
  game.freeze(clamp(.022 + .018 * p, .02, .085)); shake(.8 + p * 1.1);
  P.impact(x, y, z, 2.6 + p * 1.7, el === 'phys' ? '#ffe070' : e.light);
  P.sparks(x, y, z, Math.round(3 + p * 4), ang, el === 'phys' ? undefined : { color: e.color, hot: e.light });
  if (el !== 'phys') elBurst(x, y, z, el, Math.round(3 + p * 2), ang);
  if (snd) sfx(snd, { vol: .35 + .12 * p });
}
/** sparks thrown straight up (launchers): the engine's sparks fly along the floor, these rise */
function SKM_upSparks(x, y, z, n, c = '#fff2c4', hot = '#ffffff') {
  for (let i = 0; i < n; i++) P.add({ kind: 'spark', x: x + (Math.random() - .5) * 6, y: y + (Math.random() - .5) * 6, z, vx: (Math.random() - .5) * 50, vy: (Math.random() - .5) * 50, vz: 150 + Math.random() * 170, g: 380, drag: 2.5, max: .22 + Math.random() * .2, color: c, hot });
}
/** a light that flares and fades (lights are rebuilt every frame, so an FX keeps adding it) */
function SKM_flare(x, y, z, rad, color, dur = .22, k = 1.3) { FX.visual(dur, (r, u) => L.add(x, y, z, rad, k * (1 - u) * (1 - u), { color })); }
/** a web of cracks on the floor (chops, slams, landings): jagged dark lines with a lit lip; glowing for fire and frost */
function SKM_crack(x, y, o = {}) {
  const n = o.n || 7, R = o.r || 22, dur = o.dur || 2.4, el = o.el || 'phys', segs = [];
  for (let i = 0; i < n; i++) {
    let a = o.ang === undefined ? i / n * TAU + Math.random() * .6 : o.ang + (n > 1 ? i / (n - 1) - .5 : 0) * (o.spread || 1.4) + (Math.random() - .5) * .25;
    let cx = x, cy = y; const len = R * (.5 + Math.random() * .5), pts = [[x, y]];
    for (let k = 0; k < 4; k++) {
      a += (Math.random() - .5) * .8; cx += Math.cos(a) * len / 4; cy += Math.sin(a) * len / 4; pts.push([cx, cy]);
      if (k === 1 && Math.random() < .6) { const b = a + (Math.random() < .5 ? -1 : 1) * (.6 + Math.random() * .5), bl = len * .28; segs.push({ pts: [[cx, cy], [cx + Math.cos(b) * bl * .5, cy + Math.sin(b) * bl * .5], [cx + Math.cos(b + .3) * bl, cy + Math.sin(b + .3) * bl]], w: 0 }); }
    }
    segs.push({ pts, w: 1 });
  }
  const glow = el === 'fire' ? ['#fff0a0', '#ff8a3a'] : el === 'frost' ? ['#ffffff', '#7fd8ff'] : el === 'storm' ? ['#ffffff', '#ffe45a'] : el === 'void' ? ['#ecd8ff', '#b070ff'] : el === 'venom' ? ['#e0ffc0', '#8ae04a'] : null;
  FX.visual(dur, (r, u) => {
    const a = clamp((1 - u) * 2.2, 0, 1), hot = glow ? clamp(1 - u * 1.8, 0, 1) : 0;
    r.decal(() => {
      const g = r.tgt, zm = r.view.zoom || 1, W = Math.max(1, Math.round(zm));
      px.blend(g, a, 'normal', () => { for (const s of segs) for (let i = 1; i < s.pts.length; i++) {
        const [x0, y0] = r.w(s.pts[i - 1][0], s.pts[i - 1][1], 0), [x1, y1] = r.w(s.pts[i][0], s.pts[i][1], 0), w = s.w && i < 3 ? W + (zm > 1.4 ? 1 : 0) : W;
        px.line(g, x0, y0 + 1, x1, y1 + 1, '#8a7a70'); px.line(g, x0, y0, x1, y1, '#140c14', w);   // a lit lip below, the dark cleft
      } });
      if (hot > 0) px.blend(g, hot, 'add', () => { for (const s of segs) for (let i = 1; i < s.pts.length; i++) { const [x0, y0] = r.w(s.pts[i - 1][0], s.pts[i - 1][1], 0), [x1, y1] = r.w(s.pts[i][0], s.pts[i][1], 0); px.line(g, x0, y0, x1, y1, i < 3 ? glow[0] : glow[1]); } });
    }, { emissive: hot * .9 });
    if (hot > 0) L.add(x, y, 3, R + 18, .6 * hot, { color: glow[1] });
  });
}
/** dust thrown out in a ring (landings, stomps) */
function SKM_dustRing(x, y, n, sp, color) { for (let i = 0; i < n; i++) { const a = i / n * TAU + Math.random() * .3, v = sp * (.8 + Math.random() * .5); P.add({ kind: 'dust', x: x + Math.cos(a) * 4, y: y + Math.sin(a) * 4, z: 1, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: 6 + Math.random() * 10, g: -2, drag: 6, max: .28 + Math.random() * .2, size: .8 + Math.random() * .5, color: color || '#b9a88f' }); } }
/** speed lines streaming back from a point (dashes, kicks) */
function SKM_streak(x, y, z, ang, n = 2, c = '#e8f4ff') { for (let i = 0; i < n; i++) { const o = (Math.random() - .5) * 10; P.add({ kind: 'spark', x: x - Math.sin(ang) * o, y: y + Math.cos(ang) * o, z: z + (Math.random() - .5) * 10, vx: -Math.cos(ang) * 240, vy: -Math.sin(ang) * 240, vz: 0, g: 0, drag: 7, max: .12, color: c, hot: '#ffffff' }); } }

/* ---------- the hero's weapon: smears colored by the skill's element, the sword hidden while it flies ---------- */
// a rune's element colors the swing ribbon through the ACTION (drawHero prefers act.smear), so the hero's own smear
// (his weapon's, a unique's, a mechanic's) is never overwritten and nothing has to be put back
function SKM_smear(h, el) { if (el && el !== 'phys' && h.act) h.act.smear = EL(el).smear; }
function SKM_unsmear(h) { if (h.skmSmear) { h.smear = EL(h.look && h.look.el || 'phys').smear; h.skmSmear = false; } }   // (old saves mid-skill)
/** hide the rig's sword (Returning Blade): remembers the weapon kind; runs every step so a rig rebuilt by new gear hides it too */
function SKM_takeSword(h) { if (h.rig.o.weapon) { h.skmHidden = h.rig.o.weapon; h.rig.o.weapon = null; } }
function SKM_giveSword(h) { if (h.skmHidden) { if (!h.rig.o.weapon) h.rig.o.weapon = h.skmHidden; h.skmHidden = null; } }
/** a melee skill's action: an end() that always gives back the smear (and whatever the skill's own end restores) */
function SKM_act(h, o) {
  const act = Object.assign({ skm: true, t: 0, moveK: .25, cancel: true, free: false, face: h.aim, rig: {} }, o), end0 = o.end;
  act.end = function (interrupted) { SKM_unsmear(h); if (end0) end0.call(this, interrupted); };
  return act;
}
/* the guard: whatever cut an action short (a scene change sets h.act = null, death, a new level), the sword comes back */
BUS.on('step', () => { const h = ED.hero; if (!h || !h.rig) return;   // (killed mid-leap, he falls: updateHero drops him)
  if (h.act && h.act.skm) return; if (h.skmHidden) SKM_giveSword(h); if (h.skmSmear) SKM_unsmear(h); }, 'global');
BUS.on('levelEnd', () => { const h = ED.hero; if (h && h.rig) { SKM_giveSword(h); SKM_unsmear(h); } }, 'global');

/* ---------- pixel icons (16 x 16 at size s) ---------- */
const SKM_P = (x, y, s) => (a, b) => [x + a * s, y + b * s];
/** a sword on an icon: pommel at (ax, ay), tip at (bx, by), with grip, guard, a two-tone blade and a glint */
function SKM_iconSword(g, x, y, s, ax, ay, bx, by, o = {}) {
  const P = SKM_P(x, y, s), dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, gx = ax + ux * 3, gy = ay + uy * 3, W = Math.max(1, Math.round(s));
  const steel = o.steel || '#dce8f1', t = E.tones(steel), gw = o.guard || 2.6;
  px.line(g, ...P(ax, ay), ...P(gx, gy), '#6a3a22', W);
  px.line(g, ...P(gx - uy * gw, gy + ux * gw), ...P(gx + uy * gw, gy - ux * gw), o.hilt || '#e8b04e', W);
  px.line(g, ...P(gx + ux + uy * .6, gy + uy - ux * .6), ...P(bx, by), t.sh, W);
  px.line(g, ...P(gx + ux - uy * .5, gy + uy + ux * .5), ...P(bx, by), steel, W);
  if (o.wide) px.line(g, ...P(gx + ux * 2 - uy * 1.2, gy + uy * 2 + ux * 1.2), ...P(bx - ux * 2, by - uy * 2), t.hi, W);
  px.dot(g, ...P(ax, ay), '#ffd36a'); px.dot(g, ...P(bx, by), '#ffffff');
}
/** a curved motion arc of dots on an icon (centre cx, cy, radius r, from angle a0 to a1) */
function SKM_iconArc(g, x, y, s, cx, cy, r, a0, a1, c, n = 9) { const t = E.tones(c); for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); px.rect(g, x + (cx + Math.cos(a) * r) * s, y + (cy + Math.sin(a) * r) * s, Math.max(1, s), Math.max(1, s), i > n * .6 ? t.hi : i > n * .3 ? c : t.sh); } }

/* =============================================================================
 * OVERHEAD CLEAVE: both hands raise the sword high, the body coils and hops, then the blade comes down
 * in one crushing chop that splits the floor. Long wind-up, huge payoff.
 * ============================================================================= */
const SKM_CLEAVE = SKM_spec('twohand', { wind: .27, active: .085, recover: .44, hold: .52, hop: 1.8, crouch: .7, lunge: 2.8, lean: .6, hitAt: .55 });
def('skills', 'cleave', {
  name: 'Overhead Cleave', kind: 'core', tags: ['melee', 'attack', 'aoe'], el: 'phys', cost: 14, unlock: 2, color: '#7a3a2e',
  runes: [{ id: 'sunder', name: 'Sundering Cleave', desc: 'The blow splits the floor: three fissures race out and throw enemies into the air.' },
    { id: 'molten', name: 'Molten Cleave', desc: 'The blade burns white-hot: Fire damage that ignites, and the cleft burns on.' }],
  desc: (rank, rune) => 'A two-handed overhead chop: ' + SKM_pct(2.6, rank) + ' weapon damage in a long arc that staggers everything and bounces it off the floor.' +
    (rune === 'sunder' ? ' Three fissures race out from the blow.' : rune === 'molten' ? ' Deals Fire damage and leaves the cleft burning.' : ''),
  icon: (g, x, y, s) => {
    const P = SKM_P(x, y, s), W = Math.max(1, Math.round(s));
    SKM_iconArc(g, x, y, s, 9, 10, 7, -2.9, -1.75, '#ffe8b0', 6);
    px.rect(g, ...P(1, 13.5), 14 * s, 2 * s, '#8a6a58'); px.rect(g, ...P(1, 13.5), 14 * s, Math.max(1, s * .6), '#b0907a');   // the floor, split by the blow
    px.line(g, ...P(9, 13.5), ...P(3, 15), '#1a0e10', W); px.line(g, ...P(9, 13.5), ...P(14, 15), '#1a0e10', W); px.line(g, ...P(9, 13.5), ...P(8, 15.5), '#1a0e10', W);
    SKM_iconSword(g, x, y, s, 13.5, 1.5, 9, 13, { wide: true, guard: 3 });
    px.dot(g, ...P(8, 13), '#ffe070'); px.dot(g, ...P(10, 12), '#ffe070'); px.dot(g, ...P(7, 12), '#fff8d0'); px.dot(g, ...P(11, 14), '#ff9a3a');
  },
  cast(h, ctx) {
    const fire = ctx.rune === 'molten', el = fire ? 'fire' : ctx.el, atk = new E.Attack(SKM_CLEAVE), set = new Set(); atk.start(); h.facing = h.aim;
    const act = SKM_act(h, { name: 'cleave', moveK: .12, speed: h.atkMul, face: h.aim, rig: { attack: null, expr: 'angry' },
      update(dt) {
        const began = atk.update(dt), st = atk.state; this.rig.attack = st; this.t += dt;
        if (fire) SKM_smear(h, 'fire');
        if (st && st.phase === 'wind' && st.u > .72 && !this.gleam) { this.gleam = true; const [tx, ty, tz] = h.rig.tip(); P.add({ kind: 'glint', x: tx, y: ty, z: tz, vz: 0, max: .22, size: 2.2, color: fire ? '#ffe070' : '#ffffff' }); }
        if (began === 'active') { sfx('skmChop', { vol: .9 }); this.rig.expr = 'shout'; h.vx += Math.cos(h.facing) * 80; h.vy += Math.sin(h.facing) * 80; }
        if (st && st.phase === 'active' && st.u >= SKM_CLEAVE.hitAt && !this.struck) { this.struck = true; strike(); }
        if (st && st.phase === 'recover' && st.u > .5) this.rig.expr = null;
        this.free = !st || (st.phase === 'recover' && st.u > .4);
        return atk.busy;
      } });
    function strike() {
      const a = h.facing, ix = h.x + Math.cos(a) * 20, iy = h.y + Math.sin(a) * 20, R = 40 * ctx.area;
      const mk = u => { const ang = angTo(h, u); SKM_impact(u, ang, 2.3, el, 'hit'); return SKM_hit(ctx, u, 2.6, { kb: 140, up: 75, stun: .6, ang, el, statusChance: fire ? .9 : undefined }); };
      hitCone('hero', h.x, h.y, a, R, .62, mk, set); hitCircle('hero', ix, iy, 14 * ctx.area, mk, set);
      // the floor takes the blow
      game.freeze(.075); shake(5.5); sfx('skmSlam'); sfx('slash2', { vol: .8 }); h.rig.kick(-5);
      SKM_crack(ix, iy, { ang: a, spread: 1.9, n: 7, r: 30 * ctx.area, el });
      SKM_dustRing(ix, iy, 14, 70); P.bits(ix, iy, 2, 12, SKM_ROCK); P.ring(ix, iy, 3, 24 * ctx.area, fire ? '#ffb050' : '#fff2c4', .32);
      P.impact(ix, iy, 3, 7, fire ? '#ffb050' : '#fff2c4'); SKM_upSparks(ix, iy, 2, 8, fire ? '#ff9a3a' : '#ffe8b0', fire ? '#fff0a0' : '#ffffff');
      SKM_flare(ix, iy, 8, 80, fire ? '#ff9a3a' : '#fff0d0', .3, 1.4);
      if (ctx.rune === 'sunder') { const n = 3 + ctx.proj; for (let i = 0; i < n; i++) FX.wave({ team: 'hero', src: h, x: ix, y: iy, ang: a + (i / (n - 1) - .5) * .8, speed: 240, len: 100 * ctx.area, w: 14, el: 'phys', up: 120, hit: ctx.hit(.8, { kb: 90 }) }); }
      if (fire) { for (let i = 0; i < 3; i++) FX.area({ team: 'hero', src: h, x: ix + Math.cos(a) * i * 13, y: iy + Math.sin(a) * i * 13, r: 11 * ctx.area, dur: 3.2, tick: .5, el: 'fire', hit: ctx.hit(.2, { el: 'fire', tags: ['aoe', 'dot'], extra: { statusChance: .5 } }) }); P.fire(ix, iy, 3, 12, { size: 4, speed: 50 }); }
    }
    return act;
  }
});

/* =============================================================================
 * WHIRLWIND: hold to keep spinning, the blade held out at arm's length, the cape flaring; he drifts slowly
 * and every foe in reach is cut again and again. Drains Ember every second; release (or run dry) and he
 * finishes the turn and settles.
 * ============================================================================= */
const SKM_WHIRL = SKM_spec('spin', { a0: 1.35, z0: -5.2, z1: -5.2, reach: 8.4, crouch: 0, hop: 1.3, lean: .16, lunge: 0, wind: .13, recover: .26, hold: .15 });
const SKM_WHIRL_RATE = 2.6;   // turns per second
def('skills', 'whirlwind', {
  name: 'Whirlwind', kind: 'core', tags: ['melee', 'attack', 'aoe', 'channel'], el: 'phys', cost: 6, unlock: 12, color: '#3a5a6a', drain: 16,
  runes: [{ id: 'vortex', name: 'Vortex', desc: 'The spin drags nearby enemies in toward the blade.' },
    { id: 'glacial', name: 'Glacial Whirl', desc: 'Frost damage: every cut chills, and a freezing gale spins off the blade.' }],
  desc: (rank, rune) => 'Hold to spin with the blade held out, cutting all around you for ' + SKM_pct(.42, rank) + ' weapon damage six times a second. Drains Ember.' +
    (rune === 'vortex' ? ' Enemies are dragged into the spin.' : rune === 'glacial' ? ' Frost damage that chills and freezes.' : ''),
  icon: (g, x, y, s) => {
    const P = SKM_P(x, y, s);
    for (let i = 0; i < 22; i++) { const a = i * .5, rr = 1.6 + i * .27, c = i > 16 ? '#ffffff' : i > 9 ? '#bfefff' : '#6ab4d4'; px.rect(g, x + (8 + Math.cos(a) * rr) * s, y + (8.5 + Math.sin(a) * rr * .8) * s, Math.max(1, s), Math.max(1, s), c); }
    SKM_iconSword(g, x, y, s, 6.5, 9.5, 14.5, 3.5, { guard: 2 });
    px.dot(g, ...P(8, 8.5), '#ffe070');
  },
  cast(h, ctx) {
    const glacial = ctx.rune === 'glacial', vortex = ctx.rune === 'vortex', el = glacial ? 'frost' : ctx.el, R = (27 + ctx.rank * .6) * ctx.area;
    const drain = 16 * (1 - clamp((h.stats.costRed || 0) / 100, 0, .6)), dust = glacial ? '#d8f4ff' : '#d8ccb4';
    let phase = 'wind', pt = 0, turns = 0, tick = 0, half = 0, stopAt = -1;
    const act = SKM_act(h, { name: 'whirlwind', hold: true, moveK: .5, face: null, interrupt: false, speed: h.atkMul, rig: { attack: null, pose: 'crouch', expr: 'angry' },
      update(dt) {
        this.t += dt; pt += dt;
        if (glacial) SKM_smear(h, 'frost');
        if (phase === 'wind') {
          this.rig.attack = SKM_st(SKM_WHIRL, 'wind', pt / SKM_WHIRL.wind);
          if (pt >= SKM_WHIRL.wind) { phase = 'spin'; pt = 0; this.rig.pose = null; this.rig.expr = 'shout'; h.rig.kick(3); SKM_dustRing(h.x, h.y, 8, 40, dust); }
          return true;
        }
        if (phase === 'spin') {
          turns += dt * SKM_WHIRL_RATE;
          if (stopAt < 0 && (this.release || h.ember <= 0) && this.t > (ED.mode === 'gallery' ? 1.9 : .55)) stopAt = Math.floor(turns) + 1;   // finish the turn: no snap back
          if (stopAt > 0 && turns >= stopAt) { phase = 'recover'; pt = 0; this.rig.expr = null; this.rig.attack = SKM_st(SKM_WHIRL, 'recover', 0); h.rig.kick(-3); return true; }
          const s = turns % 1; this.rig.attack = SKM_st(SKM_WHIRL, 'active', 1 - Math.cbrt(1 - s));   // outCubic(u) = s: a steady turn
          if (stopAt < 0) h.ember = Math.max(0, h.ember - drain * dt);
          if (Math.floor(turns * 2) !== half) { half = Math.floor(turns * 2); sfx('skmWhirl', { vol: .5, pitch: .92 + Math.random() * .2 }); }
          // cuts: a fresh set every tick, swept along the spin (and outward, unless the vortex holds them in)
          if ((tick -= dt) <= 0) {
            tick = 1 / 6; let n = 0;
            hitCircle('hero', h.x, h.y, R, u => { const a = angTo(h, u) - (vortex ? 1.35 : .85); n++; P.sparks(u.x, u.y, (u.z || 0) + 10, 3, a, glacial ? { color: '#bfefff', hot: '#ffffff' } : undefined); if (glacial) elBurst(u.x, u.y, 10, 'frost', 3); return SKM_hit(ctx, u, .42, { kb: vortex ? 30 : 45, ang: a, el, statusChance: glacial ? .55 : undefined, lift: false }); }, new Set());   // light shoves: the pack stays in the blade (at kb 75 one cut threw a husk out of reach)
            if (n) { game.freeze(.018); shake(1.2); sfx('hit', { vol: .35, pitch: 1.1 + Math.random() * .2 }); }
          }
          if (vortex) eachEnemy('hero', h.x, h.y, R * 2.4, u => { if (u.boss || SKM_air(u)) return; const d = Math.hypot(h.x - u.x, h.y - u.y); if (d < R * .55) return; const a = angTo(u, h), k = 95 * dt * Math.min(1, d / 24) / (u.mass || 1); u.x += Math.cos(a) * k + Math.cos(a + 1.57) * k * .5; u.y += Math.sin(a) * k + Math.sin(a + 1.57) * k * .5; });
          // the gale: dust (or frost) whipped around the blade's circle
          const k0 = -turns * TAU;
          if (Math.random() < dt * 40) { const a = h.facing + k0 + 1.35 - Math.random() * .8, d = R * (.6 + Math.random() * .4), v = 170 + Math.random() * 80;   // wind streaks thrown off the blade's edge
            P.add({ kind: 'spark', x: h.x + Math.cos(a) * d, y: h.y + Math.sin(a) * d, z: 4 + Math.random() * 10, vx: Math.cos(a - 1.4) * v, vy: Math.sin(a - 1.4) * v, vz: 0, g: 0, drag: 5, max: .16, color: glacial ? '#bfefff' : '#e8e0d0', hot: '#ffffff' }); }
          if (glacial && Math.random() < dt * 12) P.glints(h.x + (Math.random() - .5) * R, h.y + (Math.random() - .5) * R, 4 + Math.random() * 8, 1, '#e8fbff', 2);
          if (Math.random() < dt * 10) { const a = Math.random() * TAU; P.add({ kind: 'dust', x: h.x + Math.cos(a) * 5, y: h.y + Math.sin(a) * 5, z: 1, vx: Math.cos(a - 1.4) * 50, vy: Math.sin(a - 1.4) * 50, vz: 6, g: -2, drag: 5, max: .3, size: .9, color: dust }); }
          return true;
        }
        this.rig.attack = SKM_st(SKM_WHIRL, 'recover', pt / SKM_WHIRL.recover); this.free = pt > .08;
        return pt < SKM_WHIRL.recover;
      },
      draw(r) {
        if (phase !== 'spin') return;
        const k0 = h.facing - turns * TAU, col = glacial ? '#bfefff' : vortex ? '#e8d8b0' : '#f0e8d8', fade = Math.min(1, this.t * 4);
        r.decal(() => { for (let i = 0; i < 3; i++) { const rr = R * (.62 + i * .16), a = k0 + i * 2.1; r.groundArc(h.x, h.y, rr, rr + 2, a, a + 1.9 - i * .35, col, (.4 - i * .09) * fade); } if (glacial) r.groundDisc(h.x, h.y, R, '#7fd8ff', .12 * fade); }, { emissive: glacial ? .6 : .25 });
        if (glacial) L.add(h.x, h.y, 10, R + 30, .45, { color: '#a8ecff' });
      } });
    return act;
  }
});

/* =============================================================================
 * PIERCING LUNGE: coil low with the blade drawn back, then a flat-out dash-thrust through a whole line of
 * enemies, afterimages streaming behind; he skids to a stop in a spray of dust.
 * ============================================================================= */
const SKM_LUNGE = SKM_spec('thrust', { wind: .13, active: .16, recover: .3, hold: .5, r0: 2.2, r1: 11.5, lunge: 4.5, lean: .42, crouch: .6, z0: -5.5, z1: -4.5 });
def('skills', 'lunge', {
  name: 'Piercing Lunge', kind: 'mobility', tags: ['melee', 'attack', 'movement'], el: 'phys', cost: 8, cd: 3, unlock: 3, color: '#3a4a7a',
  runes: [{ id: 'impale', name: 'Impaling Lunge', desc: 'Enemies are skewered and carried along the dash, then flung off the blade.' },
    { id: 'viper', name: 'Viper Lunge', desc: 'Venom damage that poisons, and the dash leaves a trail of venom behind.' }],
  desc: (rank, rune) => 'A dash-thrust through a whole line of enemies: ' + SKM_pct(1.8, rank) + ' weapon damage each, and they are thrown aside.' +
    (rune === 'impale' ? ' Skewers and carries them, then flings them off the blade.' : rune === 'viper' ? ' Poisons, and leaves a venom trail.' : ''),
  icon: (g, x, y, s) => {
    const P = SKM_P(x, y, s), W = Math.max(1, Math.round(s));
    for (const [yy, c] of [[5, '#5a8ab4'], [8, '#8fe0f2'], [11, '#5a8ab4']]) px.line(g, ...P(1, yy), ...P(yy === 8 ? 3 : 5, yy), c, W);
    px.blend(g, .5, 'normal', () => px.line(g, ...P(4, 9.5), ...P(10, 9.5), '#8fe0f2', W));
    SKM_iconSword(g, x, y, s, 3.5, 8, 15, 8, { guard: 3 });
    px.dot(g, ...P(15, 7), '#ffffff'); px.dot(g, ...P(15, 9), '#bfefff');
  },
  cast(h, ctx) {
    const a = h.aim, impale = ctx.rune === 'impale', viper = ctx.rune === 'viper', el = viper ? 'venom' : ctx.el, col = viper ? '#8ae04a' : '#bff6ff';
    const want = Math.hypot(ctx.tx - h.x, ctx.ty - h.y), D = clamp(want + 14, 48, 84 + ctx.rank * 2 + ctx.pierce * 8), V = D / SKM_LUNGE.active;
    const set = new Set(), carried = [], ca = Math.cos(a), sa = Math.sin(a);
    let phase = 'wind', pt = 0, sx = h.x, sy = h.y, lx = 0, ly = 0, step = 0;
    h.facing = a;
    const fling = () => { for (const u of carried) { if (!u.alive) continue; u.skmCarried = false; dealDamage(u, SKM_hit(ctx, u, 1, { kb: 250, up: 150, ang: a, el, stun: .4, nojug: true })); SKM_impact(u, a, 1.6, el, 'kick'); SKM_upSparks(u.x, u.y, 8, 5); } carried.length = 0; };
    const act = SKM_act(h, { name: 'lunge', moveK: 0, face: a, speed: h.atkMul, rig: { attack: null, expr: 'angry' },
      update(dt) {
        pt += dt; this.t += dt;
        if (viper) SKM_smear(h, 'venom');
        if (phase === 'wind') {
          this.rig.attack = SKM_st(SKM_LUNGE, 'wind', pt / SKM_LUNGE.wind);
          if (pt >= SKM_LUNGE.wind) { phase = 'dash'; pt = 0; sx = h.x; sy = h.y; lx = h.x; ly = h.y; this.cancel = false; this.ghost = col; this.rig.expr = 'shout'; sfx('skmDash'); h.rig.kick(3); P.dust(h.x, h.y, 0, 8, { speed: 60 }); P.ring(h.x, h.y, 2, 12, col, .2); }
          return true;
        }
        if (phase === 'dash') {
          const u0 = pt / SKM_LUNGE.active;
          if (step > 0 && Math.hypot(h.x - lx, h.y - ly) < step * .3 && u0 > .12) {   // a wall: the point bites stone
            const [tx, ty, tz] = h.rig.tip(); P.sparks(tx, ty, tz, 10, a + Math.PI, { color: '#ffe8a0' }); P.impact(tx, ty, tz, 7); sfx('clang'); shake(3); game.freeze(.05); pt = SKM_LUNGE.active;
          }
          lx = h.x; ly = h.y; step = V * dt; h.x += ca * step; h.y += sa * step; h.vx = h.vy = 0;
          this.rig.attack = SKM_st(SKM_LUNGE, 'active', pt / SKM_LUNGE.active);
          SKM_streak(h.x, h.y, 12, a, 2, col);
          if (viper && Math.random() < .35) P.add({ kind: 'dust', x: h.x + (Math.random() - .5) * 6, y: h.y + (Math.random() - .5) * 6, z: 2, vz: 10, g: -4, drag: 3, max: .45, size: 1.1, color: Math.random() < .5 ? '#8ae04a' : '#c8f090' });
          // everything on the line: a swept circle at the blade's point, each foe once
          hitCircle('hero', h.x + ca * 9, h.y + sa * 9, 11, u => {
            const side = Math.sign(-sa * (u.x - h.x) + ca * (u.y - h.y)) || 1, ka = a + side * 1.25, grab = impale && !u.boss && (u.mass || 1) < 3 && u.team === 'foe';
            SKM_impact(u, a, 1.5, el, 'hit'); sfx('slash2', { vol: .6 });
            if (grab) { carried.push(u); u.skmCarried = true; }
            return SKM_hit(ctx, u, 1.8, { kb: grab ? 0 : 130, ang: grab ? a : ka, stun: .45, el, statusChance: viper ? 1 : undefined });
          }, set);
          carried.forEach((u, i) => { if (!u.alive) return; u.x = h.x + ca * (12 + i * 5); u.y = h.y + sa * (12 + i * 5); u.z = 5; u.vx = u.vy = u.vz = 0; u.stunT = Math.max(u.stunT || 0, .3); });
          if (pt >= SKM_LUNGE.active) {
            phase = 'skid'; pt = 0; this.cancel = true; fling();
            if (viper) { const d0 = Math.hypot(h.x - sx, h.y - sy); for (let d = 6; d < d0; d += 15) FX.area({ team: 'hero', src: h, x: sx + ca * d, y: sy + sa * d, r: 9 * ctx.area, dur: 2.8, tick: .5, el: 'venom', hit: ctx.hit(.14, { el: 'venom', tags: ['aoe', 'dot'], extra: { statusChance: .6 } }) }); }
          }
          return true;
        }
        // the skid: the body slides on, the lead foot ploughs dust, the thrust holds, then the blade comes home
        const u1 = pt / SKM_LUNGE.recover, slide = Math.max(0, 1 - pt / .14);
        h.x += ca * V * .32 * slide * slide * dt; h.y += sa * V * .32 * slide * slide * dt;
        if (slide > 0 && Math.random() < .7) P.dust(h.x + ca * 4, h.y + sa * 4, 0, 1, { speed: 25 });
        if (pt > .06) this.ghost = null;
        this.rig.attack = SKM_st(SKM_LUNGE, 'recover', u1); if (u1 > .5) this.rig.expr = null;
        this.free = pt > .12;
        return u1 < 1;
      },
      end() { if (carried.length) fling(); this.ghost = null; } });
    return act;
  }
});

/* =============================================================================
 * LEAP SLAM: a coiled crouch, then a high arc to the cursor: legs tucked, the sword raised overhead in both
 * hands; over the top he chops down and plunges, lands point-first and the floor erupts in a shockwave that
 * throws everyone around into the air.
 * ============================================================================= */
const SKM_LEAP = { name: 'leapslam', rel: true, plane: 'side', hand: 'both', a0: 2.4, a1: -1.4, reach: 7, r0: 6, r1: 9.5, wind: .1, active: .2, recover: .44, hold: .5, lunge: .6, crouch: .3, lean: .6, twist: 0, hitAt: 0 };
def('skills', 'leap', {
  name: 'Leap Slam', kind: 'mobility', tags: ['melee', 'attack', 'aoe', 'movement'], el: 'phys', cost: 12, cd: 6, unlock: 8, color: '#5a4a2a',
  runes: [{ id: 'meteor', name: 'Meteor Slam', desc: 'He comes down like a falling star: a fire blast on landing that leaves the ground burning.' },
    { id: 'quake', name: 'Aftershock', desc: 'Two more shockwaves roll out after the landing, each wider than the last.' }],
  desc: (rank, rune) => 'Leap to the cursor and plunge the sword into the floor: ' + SKM_pct(2.3, rank) + ' weapon damage and a shockwave that launches. Untouchable in the air.' +
    (rune === 'meteor' ? ' Lands in a fire blast and burning ground.' : rune === 'quake' ? ' Two aftershocks follow.' : ''),
  icon: (g, x, y, s) => {
    const P = SKM_P(x, y, s), W = Math.max(1, Math.round(s));
    for (let i = 0; i <= 8; i++) { const u = i / 8, xx = 1.5 + u * 9, yy = 13 - Math.sin(u * Math.PI) * 10; if (i % 2 === 0) px.rect(g, x + xx * s, y + yy * s, Math.max(1, s), Math.max(1, s), i > 5 ? '#ffe8b0' : '#b8a888'); }
    SKM_iconSword(g, x, y, s, 12, 3, 12, 12.5, { guard: 2.2 });
    px.line(g, ...P(6, 14.5), ...P(15, 14.5), '#2a1a1a', W);
    for (const [dx, dy] of [[-3, -1.5], [3, -1.5], [-4, 0], [4, 0]]) px.line(g, ...P(12, 13.5), ...P(12 + dx, 13.5 + dy), '#ffe070', W);
    px.dot(g, ...P(12, 13), '#ffffff');
  },
  cast(h, ctx) {
    const meteor = ctx.rune === 'meteor', el = meteor ? 'fire' : ctx.el, col = meteor ? '#ffb050' : '#fff2c4', maxD = 96 + ctx.rank * 3, a = Math.atan2(ctx.ty - h.y, ctx.tx - h.x);
    let d = clamp(Math.hypot(ctx.tx - h.x, ctx.ty - h.y), 0, maxD);
    while (d > 0 && !SKM_open(h.x + Math.cos(a) * d, h.y + Math.sin(a) * d)) d -= 4;   // land on open floor, never in a pit
    d = Math.max(0, d);
    const F = .42 + d / 400, H = 18 + d * .15, CROUCH = .14, LAND = .44, set = new Set();
    let phase = 'crouch', pt = 0, sx = 0, sy = 0, px0 = 0, py0 = 0;
    h.facing = a;
    const land = () => {
      const R = 22 * ctx.area;
      hitCircle('hero', h.x, h.y, R, u => { const ang = angTo(h, u); SKM_impact(u, ang, 2, el, null); return SKM_hit(ctx, u, 2.3, { kb: 130, up: 150, stun: .5, ang, el, statusChance: meteor ? .8 : undefined }); }, set);
      FX.nova({ team: 'hero', src: h, x: h.x, y: h.y, r0: R, r1: 50 * ctx.area, dur: .32, el, color: col, set, hit: ctx.hit(.9, { kb: 160, el, extra: { up: 80, stun: .3 } }) });
      game.freeze(.085); shake(6.5); sfx('skmSlam'); sfx('thud'); h.rig.kick(-7);
      SKM_crack(h.x, h.y, { n: 9, r: 34 * ctx.area, el }); SKM_dustRing(h.x, h.y, 22, 110); P.bits(h.x, h.y, 2, 16, SKM_ROCK);
      P.ring(h.x, h.y, 4, 30 * ctx.area, '#ffffff', .22); P.ring(h.x, h.y, 6, 54 * ctx.area, col, .45); P.impact(h.x + Math.cos(a) * 10, h.y + Math.sin(a) * 10, 2, 8, col);
      SKM_upSparks(h.x + Math.cos(a) * 10, h.y + Math.sin(a) * 10, 2, 10, col); SKM_flare(h.x, h.y, 10, 110, meteor ? '#ff8a3a' : '#fff0d0', .35, 1.6); FX.scorch(h.x, h.y, 16, '#1a1016', 3);
      if (meteor) { P.explosion(h.x, h.y, 4, 1.4, { flash: false, shake: 0, freeze: false }); FX.area({ team: 'hero', src: h, x: h.x, y: h.y, r: 26 * ctx.area, dur: 3.5, tick: .5, el: 'fire', hit: ctx.hit(.22, { el: 'fire', tags: ['aoe', 'dot'], extra: { statusChance: .6 } }) }); }
      if (ctx.rune === 'quake') { const x0 = h.x, y0 = h.y; let n = 0; addFx({ kind: 'skmQuake', t: 0, update(dt2) { this.t += dt2; if (this.t > .3 * (n + 1)) { n++;
        FX.nova({ team: 'hero', src: h, x: x0, y: y0, r0: 12, r1: (50 + n * 18) * ctx.area, dur: .38, el: 'phys', color: '#e8d8b8', hit: ctx.hit(.7, { kb: 140, extra: { up: 120 } }) });
        SKM_crack(x0, y0, { n: 6, r: (40 + n * 16) * ctx.area }); SKM_dustRing(x0, y0, 14, 90 + n * 30); shake(4); sfx('thud', { vol: .8 }); sfx('skmSlam', { vol: .5, pitch: .8 }); } return n < 2; }, draw() {} }); }
    };
    const act = SKM_act(h, { name: 'leap', moveK: 0, face: a, cancel: false, interrupt: false, speed: h.atkMul, rig: { pose: 'crouch', expr: 'shout', attack: null },
      update(dt) {
        pt += dt; this.t += dt;
        if (meteor) SKM_smear(h, 'fire');
        if (phase === 'crouch') {   // coil: knees give, the blade starts up
          this.rig.attack = SKM_st(SKM_LEAP, 'wind', pt / CROUCH * .25);
          if (pt >= CROUCH) { phase = 'fly'; pt = 0; sx = px0 = h.x; sy = py0 = h.y; this.rig.pose = null; this.rig.air = true; h.rig.kick(7); sfx('skmRise', { vol: .8, pitch: .8 }); SKM_dustRing(h.x, h.y, 12, 60); P.ring(h.x, h.y, 3, 16, '#fff2c4', .25); }
          return true;
        }
        if (phase === 'fly') {
          const u = Math.min(1, pt / F), s = u + .3 * Math.sin(TAU * u) / TAU;   // hang at the top of the arc
          const tx = sx + Math.cos(a) * d * s, ty = sy + Math.sin(a) * d * s;
          h.x += tx - px0; h.y += ty - py0; px0 = tx; py0 = ty; h.vx = h.vy = 0;   // moved by the delta, so walls still stop him
          this.z = 4 * H * s * (1 - s) + 1; h.inv = Math.max(h.inv, .12);
          this.rig.attack = s < .5 ? SKM_st(SKM_LEAP, 'wind', .25 + .75 * s / .5) : SKM_st(SKM_LEAP, 'active', (s - .5) / .5);
          if (s > .5) { if (s > .68) this.ghost = meteor ? '#ff8a3a' : '#bff6ff'; if (!this.chop) { this.chop = true; sfx('skmChop', { vol: .7, pitch: 1.2 }); } }
          if (meteor && s > .35) { if (Math.random() < .5) P.fire(h.x, h.y, this.z + 8, 1, { size: 2.4, speed: 16 }); if (Math.random() < .5) P.add({ kind: 'ember', x: h.x, y: h.y, z: this.z + 10, vx: (Math.random() - .5) * 40, vy: (Math.random() - .5) * 40, vz: 30, max: .5, color: '#ff8a3a' }); }
          if (u >= 1) { phase = 'land'; pt = 0; this.z = 0; this.ghost = null; this.rig.air = false; this.rig.pose = 'crouch'; this.cancel = true; land(); }
          return true;
        }
        this.rig.attack = SKM_st(SKM_LEAP, 'recover', pt / LAND); if (pt > .2) this.rig.pose = null; if (pt > .3) this.rig.expr = null;
        this.free = pt > .22;
        return pt < LAND;
      },
      draw(r) { if (phase !== 'fly') return; const ex = sx + Math.cos(a) * d, ey = sy + Math.sin(a) * d, u = pt / F; r.decal(() => { r.groundRing(ex, ey, 22 * ctx.area * (1 - u * .4), col, .35 + .3 * u); r.groundDisc(ex, ey, 6, col, .25 * u); }, { emissive: .5 }); } });
    return act;
  }
});

/* =============================================================================
 * RISING BLADE: a deep crouch, then the blade sweeps up from the floor in a vertical crescent as he springs
 * with it; everything in front is launched into the air (a juggle: airborne foes take 30% more from these skills).
 * ============================================================================= */
const SKM_RISE = SKM_spec('rising', { wind: .14, active: .1, recover: .32, hold: .45, hop: 5.5, crouch: .75, lunge: 1.5, lean: .3, hitAt: .28 });
/** a vertical crescent of light (Skyward): drawn in the plane of its flight, bright leading edge */
function SKM_drawCrescent(g, r, p, cols) {
  const a = Math.atan2(p.vy, p.vx), fx = Math.cos(a), fy = Math.sin(a), s = p.sz || 1, fade = clamp((p.life - p.t) / .15, 0, 1), out = [], inn = [];
  for (let i = 0; i <= 10; i++) { const t = -1.25 + i * .25, c = Math.cos(t), sn = Math.sin(t); out.push(r.w(p.x + fx * c * 6 * s, p.y + fy * c * 6 * s, p.z + sn * 12 * s)); inn.push(r.w(p.x + fx * (c * 3.2 - 2.4) * s, p.y + fy * (c * 3.2 - 2.4) * s, p.z + sn * 9 * s)); }
  const poly = out.concat(inn.reverse());
  px.glow(g, 1); px.blend(g, .55 * fade, 'add', () => px.poly(g, poly, cols[3]));
  px.blend(g, fade, 'normal', () => { px.poly(g, poly, cols[2]); for (let i = 1; i < out.length; i++) px.line(g, out[i - 1][0], out[i - 1][1], out[i][0], out[i][1], i > 2 && i < 9 ? cols[0] : cols[1], 1); });
}
def('skills', 'uppercut', {
  name: 'Rising Blade', kind: 'core', tags: ['melee', 'attack'], el: 'phys', cost: 10, unlock: 6, color: '#3a6a5a',
  runes: [{ id: 'skyward', name: 'Skyward Crescent', desc: 'The swing looses a crescent of light that flies on, launching everything in its path.' },
    { id: 'thunder', name: 'Thunderclap', desc: 'Storm damage. At the top of their flight, lightning smashes the launched back down onto their friends.' }],
  desc: (rank, rune) => 'A rising cut that launches enemies: ' + SKM_pct(1.5, rank) + ' weapon damage. Airborne enemies take 30% more from melee skills.' +
    (rune === 'skyward' ? ' Looses a flying crescent.' : rune === 'thunder' ? ' Lightning slams the launched back down.' : ''),
  icon: (g, x, y, s) => {
    const P = SKM_P(x, y, s), W = Math.max(1, Math.round(s));
    SKM_iconArc(g, x, y, s, 4, 12, 9, -.1, -1.45, '#bff6ff', 9);
    SKM_iconSword(g, x, y, s, 5, 14.5, 10, 3, { guard: 2.2 });
    px.line(g, ...P(13, 7), ...P(13, 2), '#ffe070', W); px.line(g, ...P(11, 4), ...P(13, 2), '#ffe070', W); px.line(g, ...P(15, 4), ...P(13, 2), '#ffe070', W);
    px.line(g, ...P(1, 15), ...P(8, 15), '#6a5a4a', W);
  },
  cast(h, ctx) {
    const thunder = ctx.rune === 'thunder', el = thunder ? 'storm' : ctx.el, atk = new E.Attack(SKM_RISE), set = new Set(); atk.start(); h.facing = h.aim;
    const wel = thunder ? 'storm' : h.look && h.look.el || 'phys', cols = wel === 'phys' ? SKM_LIGHT : EL(wel).smear;   // a plain blade looses white sword-light
    const act = SKM_act(h, { name: 'uppercut', moveK: .1, face: h.aim, speed: h.atkMul, rig: { attack: null, expr: 'angry' },
      update(dt) {
        const began = atk.update(dt), st = atk.state; this.rig.attack = st; this.t += dt;
        if (thunder) SKM_smear(h, 'storm');
        if (began === 'active') {
          sfx('skmRise'); this.rig.expr = 'shout'; h.vx += Math.cos(h.facing) * 70; h.vy += Math.sin(h.facing) * 70; SKM_dustRing(h.x, h.y, 8, 50); h.rig.kick(4);
          if (ctx.rune === 'skyward') { const n = 1 + ctx.proj; for (let i = 0; i < n; i++) { const an = h.facing + (n > 1 ? (i / (n - 1) - .5) * .5 : 0);
            FX.bolt({ team: 'hero', src: h, x: h.x + Math.cos(an) * 10, y: h.y + Math.sin(an) * 10, z: 11, ang: an, speed: 215, life: .5, r: 9 * ctx.area, pierce: 99, el, tags: ['melee', 'proj'], light: 34,
              hit: ctx.hit(.85, { kb: 30, el, extra: { up: 175 } }), onHit: (p, u) => SKM_upSparks(u.x, u.y, 8, 4, cols[1]), look: { kind: 'skmCrescent', color: cols[2], core: cols[0], trail: false, draw: (g, x, y, p, r) => { p.sz = ctx.area; SKM_drawCrescent(g, r, p, cols); } } }); } }
        }
        if (st && st.phase === 'active' && st.u >= SKM_RISE.hitAt && !this.struck) {
          this.struck = true; const a = h.facing;
          hitCone('hero', h.x, h.y, a, 30, .85, u => {
            const ang = a, air = SKM_air(u); SKM_impact(u, ang, 1.6, el, 'hit'); sfx('kick', { vol: .5 }); SKM_upSparks(u.x, u.y, (u.z || 0) + 6, 6, cols[1], cols[0]);
            for (let i = 0; i < 3; i++) P.add({ kind: 'dust', x: u.x + (Math.random() - .5) * 8, y: u.y + (Math.random() - .5) * 8, z: 2, vz: 60 + Math.random() * 40, g: 20, drag: 2, max: .45, size: 1.6, color: '#e8e0d0' });
            if (thunder && u.team === 'foe' && !u.boss && !u.canFly) SKM_thunder(h, ctx, u);
            return SKM_hit(ctx, u, 1.5, { kb: air ? 12 : 26, up: air ? 175 : 190, ang, el, stun: .3, statusChance: thunder ? .7 : undefined });
          }, set);
        }
        if (st && st.phase === 'recover' && st.u > .45) this.rig.expr = null;
        this.free = !st || st.phase === 'recover';
        return atk.busy;
      } });
    return act;
  }
});
/** Thunderclap: follow a launched foe; at the top of its flight a bolt smashes it back down, and it lands in a crackle */
function SKM_thunder(h, ctx, m) {
  if (m.skmBolt) return; m.skmBolt = true;
  let state = 'rise', t = 0, bolt = -1;
  addFx({ kind: 'skmThunder', update(dt) {
    t += dt; if (bolt >= 0) bolt += dt;
    if (state === 'rise' && t > .06 && ((m.vz || 0) <= 20 || t > .7)) {
      state = 'fall'; bolt = 0; m.vz = -420; m.air = true;
      if (m.alive) dealDamage(m, SKM_hit(ctx, m, .9, { kb: 0, el: 'storm', statusChance: 1, ang: 0, lift: false }));
      elBurst(m.x, m.y, (m.z || 0) + 10, 'storm', 10); sfx('zap'); shake(2.5); game.freeze(.04); SKM_flare(m.x, m.y, (m.z || 0) + 20, 90, '#fff0a0', .2, 1.6);
    } else if (state === 'fall' && (m.z || 0) <= .5) {
      state = 'done'; m.skmBolt = false;
      FX.nova({ team: 'hero', src: h, x: m.x, y: m.y, r0: 4, r1: 26 * ctx.area, dur: .22, el: 'storm', hit: ctx.hit(.45, { el: 'storm', kb: 90 }) });
      P.dust(m.x, m.y, 0, 8, { speed: 50 }); sfx('thud', { vol: .7 }); shake(2);
    }
    return state !== 'done' && t < 2;
  }, draw(r) {
    if (bolt < 0 || bolt > .16) return;
    const x = m.x, y = m.y, z = (m.z || 0) + 10;
    r.queue(x, y, z, g => { const [x0, y0] = r.w(x, y, z + 150), [x1, y1] = r.w(x, y, z); px.glow(g, 1); zig(g, x0, y0, x1, y1, '#ffe45a', 3, 6, x | 0); zig(g, x0, y0, x1, y1, '#ffffff', 1, 6, x | 0); r.glowDisc(g, x1, y1, 9, '#fff0a0', .6); }, { emissive: true, bias: .5 });
  } });
}

/* =============================================================================
 * SPINNING KICK: he whips all the way around (the cape flares), then the roundhouse lashes out of the spin.
 * Kicked enemies fly like bowling balls: whoever they crash into is hurt and bowled over, and a body that
 * hits a wall is slammed against it.
 * ============================================================================= */
const SKM_KICK = SKM_spec('roundhouse', { wind: .2, active: .13, recover: .3, hold: .4, hop: 2.6, lean: -.34, twist: 1.4, reach: 7.6, hitAt: .3 });
/** a kicked body: tumbles through the air, bowls over whoever it hits (who may fly on, with Domino), slams into walls */
function SKM_bowl(h, ctx, m, o) {
  if (!m || m.boss || m.canFly || (m.mass || 1) >= 4 || m.skmBowl) return;
  const set = new Set([m]); let left = 3 + ctx.pierce, t = 0;
  const f = addFx({ kind: 'skmBowl', update(dt) {
    t += dt; const sp = Math.hypot(m.vx || 0, m.vy || 0), fa = Math.atan2(m.vy || 0, m.vx || 0), air = SKM_air(m);
    if (t > 1.3 || (t > .12 && sp < 55 && !air)) { m.skmBowl = null; return false; }
    if (air) m.facing += dt * 13;   // tumbling
    else { const k = Math.exp(-6 * dt); m.vx *= k; m.vy *= k; if (sp > 60 && Math.random() < dt * 40) P.dust(m.x, m.y, 0, 1, { speed: 20 }); }
    if (o.blaze && Math.random() < dt * 30) P.fire(m.x, m.y, (m.z || 0) + 8, 1, { size: 2.6, speed: 10 });
    // a wall in the way: the body is slammed against it
    const map = ED.L && ED.L.map, ah = (m.r || 5) + 2.5;
    if (map && sp > 110 && map.heightAt(m.x + Math.cos(fa) * ah, m.y + Math.sin(fa) * ah) > (m.z || 0) + 4) {
      if (m.alive) { dealDamage(m, SKM_hit(ctx, m, .6 * o.pow, { kb: 0, ang: fa + Math.PI, el: o.el, stun: .9, nojug: true, lift: false })); P.glints(m.x, m.y, (m.head || 20) + 4, 4, '#fff2c4', 8); }
      const wx = m.x + Math.cos(fa) * ah, wy = m.y + Math.sin(fa) * ah;
      P.dust(wx, wy, 8, 10, { speed: 50 }); P.bits(wx, wy, 10, 8, SKM_ROCK); P.impact(wx, wy, 10, 9, '#fff2c4'); shake(3.5); game.freeze(.05); sfx('thud'); sfx('crack', { vol: .6 });
      if (o.blaze) FX.nova({ team: 'hero', src: h, x: m.x, y: m.y, r0: 4, r1: 22 * ctx.area, dur: .2, el: 'fire', hit: ctx.hit(.45, { el: 'fire', kb: 80 }) });
      m.vx *= -.25; m.vy *= -.25; m.skmBowl = null; return false;
    }
    // bowling: every foe the body crashes into
    if (left > 0 && sp > 85) eachEnemy('hero', m.x, m.y, (m.r || 5) + 2, u => {
      if (set.has(u) || left <= 0 || Math.abs((u.z || 0) - (m.z || 0)) > 22) return; set.add(u); left--;
      const ang = E.lerpAng(fa, Math.atan2(u.y - m.y, u.x - m.x), .55), pw = o.pow;
      dealDamage(u, SKM_hit(ctx, u, .9 * pw, { kb: 215 * pw, up: 85 * pw, ang, stun: .5, el: o.el, statusChance: o.blaze ? .8 : undefined }));
      if (m.alive) dealDamage(m, SKM_hit(ctx, m, .3 * pw, { kb: 0, ang: fa + Math.PI, el: o.el, nojug: true, lift: false }));
      m.vx *= .72; m.vy *= .72;
      SKM_impact(u, ang, 1.3 * pw, o.el, null); sfx('skmBowl', { vol: .8 }); sfx('punch', { vol: .5 }); P.dust((m.x + u.x) / 2, (m.y + u.y) / 2, 4, 6, { speed: 40 });
      if (o.blaze) FX.nova({ team: 'hero', src: h, x: u.x, y: u.y, r0: 4, r1: 20 * ctx.area, dur: .2, el: 'fire', hit: ctx.hit(.4, { el: 'fire', kb: 60 }) });
      if (o.domino && o.gen < 2) SKM_bowl(h, ctx, u, Object.assign({}, o, { gen: o.gen + 1, pow: pw * .8 }));
    });
    return true;
  }, draw(r) {
    const sp = Math.hypot(m.vx || 0, m.vy || 0); if (sp < 110 || !r.visible(m.x, m.y, m.z || 0)) return;
    const fa = Math.atan2(m.vy, m.vx), z = (m.z || 0) + 10, len = Math.min(26, sp * .07), c = o.blaze ? '#ffb050' : '#f0ecf8';
    r.queue(m.x, m.y, z, g => { px.blend(g, .55, 'normal', () => { for (const off of [-4, 0, 4]) { const bx = m.x - Math.sin(fa) * off, by = m.y + Math.cos(fa) * off, [x0, y0] = r.w(bx - Math.cos(fa) * 5, by - Math.sin(fa) * 5, z + off * .6), [x1, y1] = r.w(bx - Math.cos(fa) * (5 + len), by - Math.sin(fa) * (5 + len), z + off * .6); px.line(g, x0, y0, x1, y1, c); } }); }, { bias: -.3, emissive: !!o.blaze });
  } });
  m.skmBowl = f;
}
def('skills', 'kick', {
  name: 'Spinning Kick', kind: 'core', tags: ['melee', 'attack'], el: 'phys', cost: 9, unlock: 5, color: '#6a4a2a',
  runes: [{ id: 'domino', name: 'Domino Kick', desc: 'Enemies bowled over fly on themselves, knocking down whoever they hit in turn.' },
    { id: 'blaze', name: 'Blazing Kick', desc: 'Fire damage: kicked enemies burn and burst into flame on every impact.' }],
  desc: (rank, rune) => 'A spinning roundhouse: ' + SKM_pct(1.3, rank) + ' weapon damage. Kicked enemies bowl over their friends (' + SKM_pct(.9, rank) + ') and slam into walls.' +
    (rune === 'domino' ? ' Bowled enemies fly on in a chain.' : rune === 'blaze' ? ' Kicked enemies burn and burst on impact.' : ''),
  icon: (g, x, y, s) => {   // a leg lashing out in a roundhouse, the arc behind it, a foe knocked flying off the boot
    const P = SKM_P(x, y, s), W = Math.max(1, Math.round(s)), pt = E.tones('#3b3552'), bt = E.tones('#8a5a32'), ft = E.tones('#c95f9a');
    SKM_iconArc(g, x, y, s, 4, 13, 9, -.25, -1.35, '#ffe8b0', 7);
    px.poly(g, [P(1, 15), P(3.5, 12.5), P(8, 8.5), P(9.5, 10), P(4, 15)], pt.sh); px.poly(g, [P(1.6, 14.6), P(3.8, 12.6), P(8, 9), P(8.6, 9.8), P(3.2, 14.2)], pt.base);
    px.poly(g, [P(7.2, 8.2), P(9.6, 6), P(11, 7.4), P(13.4, 7.2), P(13.2, 9), P(10, 9.6), P(9, 10.4)], bt.deep); px.poly(g, [P(7.8, 8.4), P(9.6, 6.6), P(10.8, 7.8), P(12.8, 7.8), P(12.6, 8.6), P(9.8, 9.2)], bt.base);
    px.line(g, ...P(8.2, 8.2), ...P(9.6, 6.9), bt.hi, W); px.line(g, ...P(10.6, 9.4), ...P(13.2, 9), '#2a1a12', W);   // the boot: shaft, toe cap and a dark sole
    for (const [dx, dy] of [[1.5, -1.5], [2, .5], [0, -2]]) px.line(g, ...P(12.5, 5.5), ...P(12.5 + dx, 5.5 + dy), '#ffe070', W);
    px.disc(g, ...P(13.5, 2.6), 1.7 * s, ft.sh); px.disc(g, ...P(13.2, 2.3), 1.1 * s, ft.base); px.dot(g, ...P(12.8, 1.9), ft.hi);
  },
  cast(h, ctx) {
    const blaze = ctx.rune === 'blaze', el = blaze ? 'fire' : ctx.el, atk = new E.Attack(SKM_KICK), set = new Set(); atk.start(); h.facing = h.aim;
    const act = SKM_act(h, { name: 'kick', moveK: .15, face: h.aim, speed: h.atkMul, rig: { attack: null, facing: h.facing, expr: 'angry' },
      update(dt) {
        const began = atk.update(dt), st = atk.state; this.rig.attack = st; this.t += dt;
        if (blaze) SKM_smear(h, 'fire');
        // the spin: a full turn through the wind-up (the rig alone turns; his aim holds), the kick comes out of it
        const spin = st && st.phase === 'wind' ? -TAU * E.ease.inQuad(st.u) : 0;
        this.rig.facing = h.facing + spin;
        if (st && st.phase === 'wind' && Math.random() < .5) P.dust(h.x, h.y, 0, 1, { speed: 30 });
        if (began === 'active') { sfx('whoosh', { vol: .7, pitch: 1.2 }); this.rig.expr = 'shout'; h.vx += Math.cos(h.facing) * 60; h.vy += Math.sin(h.facing) * 60; if (blaze) P.fire(h.x + Math.cos(h.facing) * 8, h.y + Math.sin(h.facing) * 8, 12, 4, { size: 3 }); }
        if (st && st.phase === 'active' && st.u >= SKM_KICK.hitAt) hitCone('hero', h.x, h.y, h.facing, 26 * ctx.area, 1.25, u => {
          const ang = E.lerpAng(h.facing, angTo(h, u), .5);
          SKM_impact(u, ang, 2, el, 'kick'); sfx('punch', { vol: .6 });
          if (u.team === 'foe') SKM_bowl(h, ctx, u, { gen: 0, pow: 1, el, blaze, domino: ctx.rune === 'domino' });
          return SKM_hit(ctx, u, 1.3, { kb: 250, up: 105, ang, el, statusChance: blaze ? 1 : undefined });
        }, set);
        if (st && st.phase === 'recover' && st.u > .4) this.rig.expr = null;
        this.free = !st || (st.phase === 'recover' && st.u > .15);
        return atk.busy;
      } });
    return act;
  }
});

/* =============================================================================
 * BRAWLER'S FLURRY: the sword stays in the right hand while the free hand and the knees do the work:
 * jab, elbow, a jumping knee and a rising uppercut that launches (the juggle starter). A generator: each
 * press (or holding the key) chains the next blow.
 * ============================================================================= */
const SKM_FLURRY = [
  SKM_spec('jab', { wind: .04, active: .06, recover: .13, r1: 9, lunge: 1.2 }),
  SKM_spec('elbow', { hand: 'L', wind: .05, active: .07, recover: .15, reach: 4.4, lunge: 1.8, lean: .35 }),
  SKM_spec('knee', { wind: .06, active: .08, recover: .17, hop: 3, lunge: 1.8, z1: .95 }),
  SKM_spec('uppercut', { hand: 'L', wind: .09, active: .09, recover: .26, hop: 4, crouch: .7, hold: .4 })
];
const SKM_HAYMAKER = SKM_spec('haymaker', { hand: 'L', wind: .15, active: .1, recover: .3, hold: .45 });
/** Thunder Fists' finisher: the axe kick. The right heel swings up past his head and chops straight down (E.MOVES.axekick),
 *  a hop into it, and the sky answers with a bolt on the target */
const SKM_AXE = SKM_spec('axekick', { wind: .16, active: .09, recover: .3, hold: .45, hop: 3.5, lean: -.25, crouch: .3, reach: 5.4, hitAt: .55 });
const SKM_AXE_HIT = { r: 21, half: .8, dmg: 1.15, kb: 40, snd: 'kick', p: 2, push: 65, big: true };
/** a bolt out of the sky onto a point (the axe kick's thunder): a zigzag from high up, a flare, a storm burst and a small
 *  storm nova. An airborne foe under it is spiked into the floor */
function SKM_skyBolt(h, ctx, u) {
  const x = u.x, y = u.y; let t = 0;
  if (SKM_air(u) && !u.boss && !u.canFly) { u.vz = -420; u.air = true; }   // the spike: a juggled foe is driven into the floor
  addFx({ kind: 'skmSkyBolt', update(dt) { t += dt; if (t > .16) return false; return true; }, draw(r) {
    const z = (u.z || 0) + 10;
    r.queue(x, y, z, g => { const [x0, y0] = r.w(x, y, z + 150), [x1, y1] = r.w(x, y, z), zm = r.view.zoom || 1; px.glow(g, 1); zig(g, x0, y0, x1, y1, '#ffe45a', 3, 6, x | 0); zig(g, x0, y0, x1, y1, '#ffffff', 1, 6, x | 0); r.glowDisc(g, x1, y1, 9 * zm, '#fff0a0', .6); }, { emissive: true, bias: .5 });
  } });
  elBurst(x, y, (u.z || 0) + 8, 'storm', 10); sfx('zap'); SKM_flare(x, y, 20, 90, '#fff0a0', .2, 1.6);
  FX.nova({ team: 'hero', src: h, x, y, r0: 4, r1: 24 * ctx.area, dur: .2, el: 'storm', set: new Set([u]), hit: ctx.hit(.5, { el: 'storm', kb: 80 }) });
}
const SKM_FLURRY_HIT = [{ r: 19, half: .6, dmg: .5, kb: 22, snd: 'punch', p: .8, push: 55 }, { r: 17, half: .85, dmg: .55, kb: 30, snd: 'punch', p: 1, push: 60 }, { r: 17, half: .75, dmg: .65, kb: 45, up: 60, snd: 'kick', p: 1.2, push: 70 },
  { r: 20, half: .75, dmg: 1, kb: 28, up: 180, snd: 'kick', p: 1.8, push: 80, big: true }];   // light pushes so the chain stays in reach; he steps in with every blow
def('skills', 'flurry', {
  name: 'Brawler\'s Flurry', kind: 'basic', tags: ['melee', 'attack'], el: 'phys', cost: 0, gen: 5, unlock: 1, color: '#6a3a4a',
  runes: [{ id: 'thunder', name: 'Thunder Fists', desc: 'Storm damage: every blow arcs lightning to the enemies beside the target, and the finisher is an axe kick that calls a thunderbolt down (and spikes airborne enemies into the floor).' },
    { id: 'iron', name: 'Iron Knuckles', desc: 'Every blow stuns, and the finisher is a crushing haymaker that hurls enemies away.' }],
  desc: (rank, rune) => 'Jab, elbow, knee and a launching uppercut from the free hand (' + SKM_pct(.5, rank) + ' to ' + SKM_pct(1, rank) + '). Press or hold to chain. Generates Ember.' +
    (rune === 'thunder' ? ' Blows arc lightning; the finisher is a thunderous axe kick.' : rune === 'iron' ? ' Blows stun; the finisher hurls.' : ''),
  icon: (g, x, y, s) => {   // a shaded fist driving in, two fading blows behind it, the impact star it lands
    const P = SKM_P(x, y, s), W = Math.max(1, Math.round(s)), sk = E.tones('#f1c7a0'), sl = E.tones('#2f8f86');
    const fist = (fx, fy, a) => px.blend(g, a, 'normal', () => {
      px.rect(g, ...P(fx - 3, fy + .5), 3 * s, 3 * s, sl.sh); px.rect(g, ...P(fx - 3, fy + .5), 3 * s, 1.2 * s, sl.base);
      px.rect(g, ...P(fx, fy - .5), 4.5 * s, 5 * s, sk.deep); px.rect(g, ...P(fx, fy - .5), 4 * s, 4.4 * s, sk.sh); px.rect(g, ...P(fx + .5, fy), 3.4 * s, 3 * s, sk.base);
      for (let k = 0; k < 3; k++) px.dot(g, ...P(fx + 3.4, fy + .4 + k * 1.3), sk.deep);
      px.rect(g, ...P(fx + .8, fy + .2), 2.4 * s, Math.max(1, s * .8), sk.hi);
    });
    fist(4, 11, .35); fist(5.5, 8, .6); fist(7.5, 5, 1);
    for (const [x0, y0] of [[1, 10], [2, 7], [3, 4]]) px.line(g, ...P(x0, y0), ...P(x0 + 2.5, y0 - 1), '#ffffff', W);
    for (const [dx, dy] of [[2.2, -2], [2.8, .4], [1.6, 2.2], [0, -2.8]]) px.line(g, ...P(13, 6), ...P(13 + dx, 6 + dy), '#ffe070', W);
    px.dot(g, ...P(13, 6), '#ffffff');
  },
  cast(h, ctx) {
    const iron = ctx.rune === 'iron', thunder = ctx.rune === 'thunder', el = thunder ? 'storm' : ctx.el, set = new Set();
    const specs = SKM_FLURRY.slice(); if (iron) specs[3] = SKM_HAYMAKER; if (thunder) specs[3] = SKM_AXE;
    const self = this, combo = comboResume(self, ctx.rune || '', () => new E.Combo(specs, { window: .32 })); combo.press(); h.facing = h.aim;   // (moving out of a blow keeps the string: the next press throws the next one)
    const act = SKM_act(h, { name: 'flurry', moveK: .35, face: h.aim, speed: h.atkMul, combo, rig: { attack: null }, end() { comboLeft(self); },
      update(dt) {
        const began = combo.update(dt), st = combo.state, i = combo.step, fin = i === 3, axe = fin && thunder, H = axe ? SKM_AXE_HIT : SKM_FLURRY_HIT[i] || SKM_FLURRY_HIT[0]; this.rig.attack = st; this.t += dt;
        if (thunder) SKM_smear(h, 'storm');
        this.rig.expr = st && st.phase !== 'recover' ? (fin ? 'shout' : 'angry') : null;
        if (began === 'active') { set.clear(); sfx('whoosh', { vol: .35, pitch: 1.5 + i * .1 }); const p = H.push; h.vx += Math.cos(h.facing) * p; h.vy += Math.sin(h.facing) * p; if (fin && !iron) h.rig.kick(axe ? -4 : 3); }
        if (st && st.phase === 'active' && st.u >= (axe ? SKM_AXE.hitAt : .3)) hitCone('hero', h.x, h.y, h.facing, H.r * (fin ? ctx.area : 1), H.half, u => {
          const ang = h.facing, hay = fin && iron;
          SKM_impact(u, ang, H.p * (hay ? 1.3 : 1), el, H.snd); if (fin) { sfx('hit', { vol: .5 }); if (!iron && !axe) SKM_upSparks(u.x, u.y, (u.z || 0) + 8, 5); }
          if (axe) { SKM_skyBolt(h, ctx, u); shake(3); P.dust(u.x, u.y, 0, 8, { speed: 50 }); SKM_crack(u.x, u.y, { n: 5, r: 16, el: 'storm', dur: 1.6 }); }   // the heel comes down: thunder
          if (thunder && u.team === 'foe') FX.chain({ team: 'hero', src: h, from: u, hops: fin ? 3 : 1, range: 60, el: 'storm', set: new Set([u]), hit: ctx.hit(.3, { el: 'storm', kb: 30 }) });
          return SKM_hit(ctx, u, H.dmg * (hay ? 1.3 : 1), { kb: hay ? 330 : H.kb, up: hay ? 60 : axe ? undefined : H.up, lift: axe ? false : undefined, ang, el, stun: iron ? (hay ? .9 : .45) : axe ? .4 : undefined, statusChance: thunder ? .35 : undefined });
        }, set);
        // (holding the key keeps the blows coming: updateHero repeats a held slot through again())
        this.free = !st || st.phase === 'recover';
        return combo.busy;
      } });
    return act;
  },
  again(h, act, ctx) {
    if (!act.combo) return false;
    if (act.combo.press()) { act.face = h.aim; h.facing = h.aim; if (act.combo.step === 0) act.gained = 0; return true; }
    return false;
  }
});

/* =============================================================================
 * RETURNING BLADE: he throws his own sword. It spins out flat toward the cursor, slows, turns and whirls back
 * to his hand, cutting everything on both passes; he catches it with a twirl. While it flies his hand is empty, but
 * he is free: a skill or a dodge snaps the sword back to him and a spectral copy finishes the flight.
 * ============================================================================= */
const SKM_THROW = SKM_spec('throw', { wind: .17, active: .08, recover: .24, hold: .35, lunge: 2.2, lean: .5, blade: 0 });
const SKM_TWIRL = { name: 'twirl', rel: true, plane: 'side', a0: 1.2, a1: 1.2 - TAU, reach: 3.2, z0: 0, z1: 0, wind: .03, active: .22, recover: .26, hold: .3, lunge: -.3, lean: -.12, twist: .4, crouch: 0 };
/** the flying sword: out (easing to a stop), maybe hanging (Reaping Orbit), then home to the hand. phantom: a spectral copy */
function SKM_blade(h, ctx, o) {
  const b = addFx({ kind: 'skmBlade', x: o.x, y: o.y, z: o.z, sx: o.x, sy: o.y, ex: o.ex, ey: o.ey, phase: 'out', t: 0, spin: 0, sp: 0, outSet: new Set(), backSet: new Set(), phantom: !!o.phantom, snd: 0, tick: 0, trail: [],
    update(dt) {
      b.t += dt; b.spin += dt * (b.phase === 'hang' ? 46 : 30); const el = o.el;
      if (!b.phantom && (b.snd -= dt) <= 0) { b.snd = b.phase === 'hang' ? .07 : .11; sfx('skmWhirr', { vol: .7, pitch: .9 + Math.random() * .3 }); }
      b.trail.push([b.x, b.y, b.z]); if (b.trail.length > 6) b.trail.shift();
      const hitR = 9 * ctx.area, map = ED.L && ED.L.map;
      if (b.phase === 'out') {
        const u = Math.min(1, b.t / o.T), k = E.ease.outQuad(u), nx = lerp(b.sx, b.ex, k), ny = lerp(b.sy, b.ey, k);
        if (map && map.heightAt(nx, ny) > b.z) { P.sparks(b.x, b.y, b.z, 10, Math.atan2(b.ey - b.sy, b.ex - b.sx) + Math.PI, { color: '#ffe8a0' }); P.impact(b.x, b.y, b.z, 7); if (!b.phantom) { sfx('clang'); shake(2); } b.phase = o.reap ? 'hang' : 'back'; b.t = 0; }
        else { b.x = nx; b.y = ny; b.z = lerp(o.z, 11, u); }
        const fa = Math.atan2(b.ey - b.sy, b.ex - b.sx);
        hitCircle('hero', b.x, b.y, hitR, u2 => { SKM_impact(u2, fa, b.phantom ? .8 : 1.3, el, b.phantom ? null : 'hit'); sfx('slash2', { vol: .5 }); return SKM_hit(ctx, u2, b.phantom ? .6 : 1.3, { kb: 80, ang: fa, el }); }, b.outSet);
        if (u >= 1 && b.phase === 'out') { b.phase = o.reap ? 'hang' : 'back'; b.t = 0; if (!b.phantom) P.glints(b.x, b.y, b.z, 3, '#ffffff', 6); }
      } else if (b.phase === 'hang') {   // Reaping Orbit: it hangs spinning, dragging enemies into its edge
        const R = 46 * ctx.area;
        eachEnemy('hero', b.x, b.y, R, u2 => { if (u2.boss || SKM_air(u2)) return; const d = Math.hypot(b.x - u2.x, b.y - u2.y); if (d < 6) return; const a = Math.atan2(b.y - u2.y, b.x - u2.x), k = 110 * dt * Math.min(1, d / 18) / (u2.mass || 1); u2.x += Math.cos(a) * k; u2.y += Math.sin(a) * k; });
        if ((b.tick -= dt) <= 0) { b.tick = .14; hitCircle('hero', b.x, b.y, hitR * 1.3, u2 => { P.sparks(u2.x, u2.y, 10, 3, Math.random() * TAU); sfx('slash2', { vol: .35 }); return SKM_hit(ctx, u2, .32, { kb: 20, el, lift: false }); }, new Set()); }
        if (Math.random() < .5) { const a = Math.random() * TAU, d = R * (.4 + Math.random() * .6); P.add({ kind: 'spark', x: b.x + Math.cos(a) * d, y: b.y + Math.sin(a) * d, z: 3 + Math.random() * 8, vx: -Math.cos(a) * 90 + Math.cos(a + 1.57) * 120, vy: -Math.sin(a) * 90 + Math.sin(a + 1.57) * 120, vz: 0, g: 0, drag: 4, max: .18, color: '#e8e0f0', hot: '#ffffff' }); }   // the air spiralling in
        if (b.t > .8) { b.phase = 'back'; b.t = 0; }
      } else {   // home to the hand: it speeds up as it comes
        const [hx, hy, hz] = h.rig.hand('R'), dx = hx - b.x, dy = hy - b.y, dz = hz - b.z, d = Math.hypot(dx, dy) || 1;
        b.sp = Math.min(460, b.sp + 1500 * dt); const st = Math.min(d, b.sp * dt);
        b.x += dx / d * st; b.y += dy / d * st; b.z += dz * Math.min(1, dt * 8);
        const ba = Math.atan2(dy, dx);
        hitCircle('hero', b.x, b.y, hitR, u2 => { SKM_impact(u2, ba, b.phantom ? .7 : 1.1, el, b.phantom ? null : 'hit'); sfx('slash2', { vol: .5 }); return SKM_hit(ctx, u2, b.phantom ? .45 : 1, { kb: 100, ang: ba, el }); }, b.backSet);
        if (d < 7 || b.t > 2.6) { b.caught = true; if (b.phantom) { P.glints(b.x, b.y, b.z, 4, '#c890ff', 6); sfx('chime', { vol: .25, pitch: 1.6 }); } return false; }
      }
      return !b.gone;
    },
    draw(r) {
      if (!r.visible(b.x, b.y, b.z, 30, 30, 30)) return;
      if (!b.phantom) r.shadow(b.x, b.y, 3.5, .35);
      const C = h.rig.C, cols = o.cols, m = E.tones(b.phantom ? '#c890ff' : C.metal), ht = E.tones(b.phantom ? '#8a50e0' : C.hilt || '#e8b04e');
      r.queue(b.x, b.y, b.z, g => {
        const zm = r.view.zoom || 1, W = Math.max(1, Math.round(zm)), sp = b.spin, P0 = (d, off, a = sp) => r.w(b.x + Math.cos(a) * d - Math.sin(a) * off, b.y + Math.sin(a) * d + Math.cos(a) * off, b.z + Math.sin(a) * d * .28);   // spins on a slightly tilted plane, like a thrown boomerang
        px.glow(g, 1);
        // propeller blur: three fading copies of the blade behind the real one, and a faint disc
        px.blend(g, .14, 'add', () => px.poly(g, r.groundPts(b.x, b.y, 12, 16, b.z), cols[2]));
        for (const [k, al, c] of [[1.5, .22, 3], [1, .38, 2], [.5, .6, 1]]) px.blend(g, al * (b.phantom ? .6 : 1), 'normal', () => { const [x0, y0] = P0(1.8, 0, sp - k), [x1, y1] = P0(12, 0, sp - k); px.line(g, x0, y0, x1, y1, cols[c], W + (zm > 1.4 && k < 1 ? 1 : 0)); });
        const draw = () => {
          const [ax, ay] = P0(1.8, 1.5), [bx2, by2] = P0(1.8, -1.5), [tx, ty] = P0(12.2, 0), [c0x, c0y] = P0(1.8, .45), [m0x, m0y] = P0(9, .5);
          px.poly(g, [[ax, ay], [m0x, m0y], [tx, ty], [bx2, by2]], m.sh); px.line(g, c0x, c0y, tx, ty, m.base, W); px.line(g, c0x, c0y, m0x, m0y, m.hi);
          const [g0x, g0y] = P0(1.4, -3), [g1x, g1y] = P0(1.4, 3); px.line(g, g0x, g0y, g1x, g1y, ht.sh, W + (zm > 1.3 ? 1 : 0)); px.line(g, g0x, g0y - 1, g1x, g1y - 1, ht.lt);
          const [p0x, p0y] = P0(1.1, 0), [p1x, p1y] = P0(-2.8, 0); px.line(g, p0x, p0y, p1x, p1y, '#5a3620', W + (zm > 1.3 ? 1 : 0));
          const [qx, qy] = P0(-3.4, 0); px.disc(g, qx, qy, Math.max(.6, zm), ht.base); px.dot(g, qx - 1, qy - 1, ht.hi); px.dot(g, tx, ty, '#ffffff');
        };
        if (b.phantom) px.blend(g, .7, 'normal', draw); else draw();
      }, { emissive: true, bias: .4 });
      if (b.phase === 'hang') r.decal(() => { const a = b.spin * .3; for (let i = 0; i < 3; i++) r.groundArc(b.x, b.y, 16 + i * 10, 18 + i * 10, a + i * 2, a + i * 2 + 1.8, cols[1], .4 - i * .1); }, { emissive: .5 });
      L.add(b.x, b.y, b.z, b.phantom ? 30 : 44, .55, { color: b.phantom ? '#c890ff' : cols[1] });
    } });
  return b;
}
def('skills', 'bladethrow', {
  name: 'Returning Blade', kind: 'core', tags: ['melee', 'attack', 'proj'], el: 'phys', cost: 12, unlock: 10, color: '#4a3a6a',
  runes: [{ id: 'echo', name: 'Phantom Blades', desc: 'Two spectral blades fly out beside the sword and return with it.' },
    { id: 'reap', name: 'Reaping Orbit', desc: 'At the far end the sword hangs spinning, dragging enemies into its edge, before it comes back.' }],
  desc: (rank, rune) => 'Throw your sword: it spins out and whirls back to your hand, cutting for ' + SKM_pct(1.3, rank) + ' going out and ' + SKM_pct(1, rank) + ' coming back.' +
    (rune === 'echo' ? ' Two phantom blades fly beside it.' : rune === 'reap' ? ' It hangs at the far end, reaping.' : ''),
  icon: (g, x, y, s) => {
    const P = SKM_P(x, y, s), W = Math.max(1, Math.round(s));
    for (let i = 0; i < 14; i++) { const a = -.6 + i * .38, c = i > 9 ? '#ffe8b0' : '#8a7ab8'; px.rect(g, x + (8 + Math.cos(a) * 6) * s, y + (9 + Math.sin(a) * 4.5) * s, Math.max(1, s), Math.max(1, s), c); }
    px.line(g, ...P(12.5, 12.5), ...P(14.5, 11), '#ffe8b0', W); px.line(g, ...P(12.5, 12.5), ...P(14.5, 14), '#ffe8b0', W);
    SKM_iconSword(g, x, y, s, 4.5, 11.5, 12, 3, { guard: 2.2 });
    for (const [dx, dy] of [[-1, -1], [1, 1]]) px.dot(g, ...P(8 + dx * 4, 7 + dy * 4), '#ffffff');
  },
  cast(h, ctx) {
    const a = h.aim, echo = ctx.rune === 'echo', reap = ctx.rune === 'reap', el = ctx.el, atk = new E.Attack(SKM_THROW); atk.start(); h.facing = a;
    const D = clamp(Math.hypot(ctx.tx - h.x, ctx.ty - h.y), 44, 112 + ctx.rank * 3), cols = EL(h.look && h.look.el || 'phys').smear;
    let phase = 'throw', pt = 0, blade = null;
    const recall = () => { if (blade && !blade.caught) { blade.gone = true; P.glints(blade.x, blade.y, blade.z, 6, '#ffffff', 8); P.glints(h.x, h.y, 14, 4, '#ffffff', 6); } };
    // cut short while the sword flies (another skill, a dodge, a knock-down): the sword snaps back into his hand in a
    // flash and a spectral copy finishes the flight at a phantom's damage, so the throw is never a trap. Dead, it just goes
    const release = () => {
      if (!blade || blade.caught || blade.gone || blade.phantom) return;
      if (h.dead || !h.alive) { recall(); return; }
      blade.phantom = true; P.glints(blade.x, blade.y, blade.z, 5, '#c890ff', 8);
      const [hx, hy, hz] = h.rig.hand('R'); P.glints(hx, hy, hz, 5, '#ffffff', 6); sfx('skmCatch', { vol: .45, pitch: 1.2 });
    };
    const act = SKM_act(h, { name: 'bladethrow', moveK: .2, face: a, speed: h.atkMul, rig: { attack: null, expr: 'angry' },
      update(dt) {
        pt += dt; this.t += dt;
        if (phase === 'throw') {
          const began = atk.update(dt), st = atk.state; this.rig.attack = st;
          if (began === 'active') {   // let go: the sword leaves the hand
            const [hx, hy, hz] = h.rig.hand('R'), T = .3 + D / 420, ex = h.x + Math.cos(a) * D, ey = h.y + Math.sin(a) * D;
            SKM_takeSword(h); sfx('skmThrow'); this.rig.expr = 'shout';
            blade = SKM_blade(h, ctx, { x: hx, y: hy, z: Math.max(8, hz), ex, ey, T, el, cols, reap });
            const n = (echo ? 2 : 0) + ctx.proj; for (let i = 0; i < n; i++) { const off = (i % 2 ? 1 : -1) * (.42 + Math.floor(i / 2) * .3), d2 = D * .85;
              SKM_blade(h, ctx, { x: hx, y: hy, z: Math.max(8, hz), ex: h.x + Math.cos(a + off) * d2, ey: h.y + Math.sin(a + off) * d2, T: T * .92, el: 'void', cols: EL('void').smear, phantom: true }); }
          }
          if (!atk.busy) { phase = 'wait'; pt = 0; this.moveK = .75; this.rig.expr = null; }
          return true;
        }
        if (!blade) { SKM_giveSword(h); return false; }
        if (!blade.caught && !blade.gone) SKM_takeSword(h);   // keep his hand empty (a rig rebuilt by new gear too)
        if (phase === 'wait') {
          this.rig.attack = null; this.free = true; this.moveCancel = false;   // an empty hand, not an idle hero: any skill or a dodge may follow (walking does not end the throw)
          const d = Math.hypot(blade.x - h.x, blade.y - h.y), back = blade.phase === 'back';
          this.face = back || blade.phase === 'hang' ? Math.atan2(blade.y - h.y, blade.x - h.x) : a;
          this.rig.point = back && d < 60; this.rig.aim = .2;   // the hand goes out to meet it
          if (blade.caught || blade.gone || pt > 4) {
            SKM_giveSword(h); recall(); phase = 'catch'; pt = 0; this.rig.point = false; this.moveK = .2;
            const [hx, hy, hz] = h.rig.hand('R'); sfx('skmCatch'); P.glints(hx, hy, hz, 5, '#ffffff', 6); P.sparks(hx, hy, hz, 5, h.facing + Math.PI, { color: '#fff2c4' }); game.freeze(.03); h.rig.kick(2);
            this.face = h.facing; this.rig.expr = 'smile'; this.moveCancel = true;
          }
          return true;
        }
        // the catch: the sword twirls once in the hand and settles
        const tw = SKM_TWIRL, u = pt < tw.wind ? pt / tw.wind : pt < tw.wind + tw.active ? (pt - tw.wind) / tw.active : (pt - tw.wind - tw.active) / tw.recover;
        this.rig.attack = SKM_st(tw, pt < tw.wind ? 'wind' : pt < tw.wind + tw.active ? 'active' : 'recover', u);
        this.free = pt > tw.wind + tw.active;
        return pt < tw.wind + tw.active + tw.recover;
      },
      end() { if (phase !== 'catch') release(); SKM_giveSword(h); this.rig.point = false; } });
    return act;
  }
});
