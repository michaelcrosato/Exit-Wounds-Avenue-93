/* =============================================================================
 * THE BESTIARY: ten monsters with their own bodies, movesets and minds, and ten elite affixes
 *   humanoids  bonethrower (bone javelins from range), cultist (fire bolts, raises the dead, blinks away), brute
 *              (haymaker, sweep, ground slam, head-down charge), duelist (sidesteps your swing and ripostes, flying
 *              kick), monk (punch combos, blocks from the front), bulwark (a shield you flank, spin or smash)
 *   blobs      bat (roosts on walls, drops, sine dives), imp (hops, lobs fireballs, blinks), bloater (waddles, swells,
 *              bursts on friend and foe), mireslime (splits in two, then two again)
 *   affixes    burning frozen shocking teleporter illusionist molten shielded plagued berserk vortex
 * Shared parts: MON_fight (the core melee loop, generalized: combos that flow, gap closers, slow turners), MON_blink
 * (fade, rings, reappear), MON_raise (a body climbs out of the floor), MON_guard (chained onBeforeHit filters), and
 * MON_draw (an archetype's floor runes and glows around the core drawFoe). Private names start with MON_.
 * ============================================================================= */
A.define('monScreech', [{ wave: 'saw', freq: 2600, to: 1500, dur: .16, vol: .1, vib: [34, .12] }, { wave: 'square', freq: 3200, to: 2400, dur: .08, vol: .05 }]);
A.define('monBlink', [{ wave: 'sine', freq: 300, to: 1500, dur: .2, vol: .2 }, { wave: 'noise', freq: 6000, to: 2500, dur: .12, vol: .08, filter: 'highpass' }]);
A.define('monPop', [{ wave: 'square', freq: 620, to: 1500, dur: .07, vol: .14 }, { wave: 'noise', freq: 3000, dur: .05, vol: .1, filter: 'highpass' }]);
A.define('monSplat', [{ wave: 'noise', freq: 1200, to: 180, dur: .28, vol: .4, filter: 'lowpass' }, { wave: 'sine', freq: 220, to: 50, dur: .25, vol: .35 }]);
A.define('monSwell', { wave: 'sine', freq: 110, to: 520, dur: 1, vol: .22, vib: [16, .2] });
A.define('monChant', { wave: 'triangle', freq: 196, arp: [0, 3, 7, 10, 7, 3], step: .11, dur: 1, vol: .14, vib: [5, .06] });
A.define('monRise', [{ wave: 'noise', freq: 700, to: 120, dur: .55, vol: .3, filter: 'lowpass' }, { wave: 'saw', freq: 70, to: 150, dur: .5, vol: .1 }]);
A.define('monSnort', [{ wave: 'noise', freq: 500, to: 140, dur: .3, vol: .35, filter: 'lowpass' }, { wave: 'saw', freq: 90, to: 60, dur: .25, vol: .12 }]);
A.define('monAbsorb', { wave: 'triangle', freq: 880, to: 1320, dur: .09, vol: .12 });
A.define('monShatter', [{ wave: 'noise', freq: 7000, to: 2500, dur: .3, vol: .22, filter: 'highpass' }, { wave: 'triangle', freq: 2000, to: 500, dur: .3, vol: .12 }]);
A.define('monVortex', { wave: 'sine', freq: 320, to: 80, dur: .9, vol: .22, vib: [11, .25] });

/* ---------- small shared pieces ---------- */
const MON_R = { next: 0 };   // ranged wind-ups are spaced out across the level, so shots arrive one after another, readably
const MON_rangedOk = () => game.time >= MON_R.next;
const MON_rangedUsed = () => { MON_R.next = game.time + .16 + Math.random() * .1; };
/** a telegraphed spec from E.MOVES with overrides, the way the core builds its monsters' (MOVE_FIX style) */
const MON_spec = (move, over, wind = 2.2, recover) => foeSpec({ move, over, wind, recover });
/** can a walker stand at (x, y)? (no wall, pit or deep water) */
function MON_open(x, y) { const map = ED.L && ED.L.map; return !map || map.walkable(Math.floor(x / T16), Math.floor(y / T16)); }
/** line of sight to the hero, cached a moment per monster (map.los walks the line) */
function MON_los(m, h) { const a = m.ai; if (game.time < (a.losUntil || 0)) return a.los; a.losUntil = game.time + .25 + Math.random() * .15; const map = ED.L && ED.L.map; a.los = !map || map.los(m.x, m.y, h.x, h.y); return a.los; }
/** a clear spot d0..d1 from (x, y), around angle a0 (+- spread) or anywhere; null if none */
function MON_spot(x, y, d0, d1, a0 = null, spread = Math.PI) {
  for (let k = 0; k < 16; k++) {
    const a = a0 === null ? Math.random() * TAU : a0 + (Math.random() * 2 - 1) * spread, d = d0 + Math.random() * (d1 - d0), sx = x + Math.cos(a) * d, sy = y + Math.sin(a) * d;
    if (MON_open(sx, sy) && MON_open(sx + 6, sy) && MON_open(sx - 6, sy) && MON_open(sx, sy + 6) && MON_open(sx, sy - 6)) return [sx, sy];
  }
  return null;
}
/** chain a damage filter onto a unit (blocks, shields, bubbles): fn(hit, amt) -> amt runs after any earlier one */
function MON_guard(m, fn) { const prev = m.onBeforeHit; m.onBeforeHit = prev ? function (hit, amt) { amt = prev.call(this, hit, amt); return amt > 0 ? fn.call(this, hit, amt) : amt; } : fn; }
const MON_tag = (hit, ...ts) => !!hit.tags && ts.some(t => hit.tags.includes(t));
/** does a hit come from in front of m? (the attacker's side; against a projectile's flight) */
function MON_front(m, hit, half) {
  const s = hit.src; let a;
  if (s && s !== m && s.x !== undefined && !MON_tag(hit, 'proj')) a = Math.atan2(s.y - m.y, s.x - m.x);
  else if (hit.ang !== undefined) a = hit.ang + Math.PI; else return false;
  return Math.abs(E.angDiff(m.facing, a)) < half;
}
/** a word over a monster, at most every so often (BLOCK, ABSORB) */
function MON_say(m, text, color) { if (game.time - (m.MON_sayT || 0) < .5) return; m.MON_sayT = game.time; P.text(m.x, m.y, (m.head || 20) * (m.scale || 1) + 4, text, color); }
/** an afterimage of a rig (the engine's ghost trail) from an invisible second draw */
function MON_ghost(m, r, color, every = .045, life = .26) {
  if (!m.rig || game.time - (m.MON_gT || 0) < every) return; m.MON_gT = game.time;
  r.actor(m.x, m.y, m.z, (g, ox, oy) => m.rig.draw(g, ox, oy, r.view), { alpha: .001, outline: false, rim: false, ghost: { color, life } });
}
/** dotted circle in screen pixels (bubbles, rings) */
function MON_circle(g, cx, cy, rx, ry, c, n = 24, a0 = 0, span = TAU) { for (let i = 0; i <= n; i++) { const a = a0 + span * i / n; px.dot(g, cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, c); } }
/** the projected centre and radii of a Blob, as Blob draws itself (for things drawn on or in its body) */
function MON_blobFrame(b, ox, oy, view) {
  if (b.o.charView !== false) view = E.charView(view);
  const R = b.o.R * b.scale, a = 1 - b.sq * .55, bb = 1 + b.sq, sc = view.scale, sp = Math.sin(view.pitch), cp = Math.cos(view.pitch) * view.zBoost;
  const c = view.p(0, 0, R * bb);
  return { cx: ox + c[0], cy: oy + c[1], rx: R * a * sc, ry: R * sc * Math.sqrt((a * sp) ** 2 + (bb * cp) ** 2) };
}
/**
 * Draw one of this bestiary's monsters: arch.pre (floor runes, warnings), the core body (drawFoe, with the arch's own
 * draw hidden for the call), then arch.post (a special's smear, a charging staff, afterimages). Used as arch.draw.
 */
function MON_draw(m, r) {
  const A0 = m.arch, plain = A0.MON_plain || (A0.MON_plain = Object.create(A0, { draw: { value: null } }));
  if (A0.pre) A0.pre(m, r);
  m.arch = plain; try { drawFoe(m, r); } finally { m.arch = A0; }
  if (A0.post) A0.post(m, r);
}

/* =============================================================================
 * MON_fight: the melee loop the humanoids share. Like the core 'melee' AI it circles just out of reach and takes turns,
 * but a turn plays a PLAN: one attack or a string of them by name from arch.attacks (arch.plans: [{ seq, w, depth }]).
 * The next hit of a string starts during the last one's recovery and winds up faster (at.chain x the move's own wind),
 * so a combo reads as one flowing string. at.leap: a gap closer that carries the body to the target during its strike.
 * o: { turn (turn rate while winding up), moveK }
 * ============================================================================= */
function MON_plan(m) {
  const P0 = m.arch.plans;
  if (!P0) { const at = m.arch.attacks.filter(a => !a.leap); return [rnd.pick(at).name]; }
  const ok = P0.filter(p => (p.depth || 0) <= (m.level || 1));
  return wpick(ok.length ? ok : P0, p => p.w || 1).seq.slice();
}
function MON_startAtk(m, name, chained) {
  const arch = m.arch, i = Math.max(0, arch.attacks.findIndex(a => a.name === name)), at = arch.attacks[i];
  const sp = chained ? (at.cspec || (at.cspec = Object.assign({}, at.spec, { wind: Math.max(.08, (E.MOVES[at.move] || at.spec).wind * (at.chain || 2.4)) }))) : at.spec;
  m.next = i; m.atk = new E.Attack(sp); m.atk.start();
  return at;
}
function MON_fight(m, dt, o = {}) {
  const h = ED.hero, arch = m.arch, dx = h.x - m.x, dy = h.y - m.y, d = Math.hypot(dx, dy) || 1, toH = Math.atan2(dy, dx);
  const at = arch.attacks[m.next] || arch.attacks[0], stand = Math.max(at.stand * m.scale, m.r + h.r + 5);
  let mv = [0, 0];
  m.cool -= dt;
  if (!AI.aware(m)) { AI.idle(m, dt); return; }
  if (m.stunT <= 0) {
    const A = m.atk;
    if (A) {
      if (A.phase === 'wind') { AI.face(m, toH, dt, at.turn || o.turn || 2.5); if (!at.leap && Math.abs(d - stand) > 1) { const s = Math.sign(d - stand); mv = [dx / d * s, dy / d * s]; } }
      const began = A.update(dt * statusSpeed(m));
      if (began === 'active') {
        if (at.leap) { const v = clamp((d - m.r - h.r) / Math.max(.1, A.spec.active), 0, at.leap); m.vx = Math.cos(m.facing) * v; m.vy = Math.sin(m.facing) * v; }
        else if (d > stand) { const v = Math.min(70, Math.sqrt(1000 * (d - stand))); m.vx += Math.cos(m.facing) * v; m.vy += Math.sin(m.facing) * v; }
        sfx(at.sound || 'swing', { vol: .35, pitch: at.pitch || 1 });
        if (at.onActive) at.onActive(m, A);
      }
      if (began === 'recover' && at.leap) { m.vx *= .25; m.vy *= .25; }
      const reach = Math.max(at.leap ? m.r + h.r + 9 : 0, stand - h.r + 1 + (at.extraReach || 0));
      A.hits([h], t => E.inArc(m, m.facing, t, reach, at.half || 1.1), () => MON_land(m, h, at, A, toH));
      if (m.plan && m.plan.length && !h.dead && A.phase === 'recover' && A.u >= (at.flow === undefined ? .3 : at.flow)) MON_startAtk(m, m.plan.shift(), true);
      else if (!A.busy) { m.atk = null; m.plan = null; m.cool = (at.cool || .8) + Math.random(); }
    } else if (!h.dead) {
      // no turn yet: circle just outside contact distance (the camera side waits further back), then take one
      const v = game.view, front = Math.max(0, -(dx * v.fx + dy * v.fy) / d) * Math.cos(v.pitch), ring = stand + 8 + 18 * front;
      const sway = Math.sin(game.time * .9 + m.ph);
      mv = d > ring + 3 ? AI.steer(m, h.x, h.y) : d < ring - 3 ? [-dx / d * .5, -dy / d * .5] : [-dy / d * .4 * sway, dx / d * .4 * sway];
      AI.face(m, d > ring + 3 ? Math.atan2(mv[1], mv[0]) : toH + sway * .25, dt, o.turn ? o.turn * 2 : 5);
      if (d < ring + 6 && m.cool <= -1.5 * front && AI.takeTurn(m)) { const plan = MON_plan(m); MON_startAtk(m, plan.shift(), false); m.plan = plan; }
    }
  }
  AI.move(m, mv, dt, o.moveK);
}
/** a melee hit lands on the hero: damage, an impact star where the fist, foot or blade is, the affixes' reactions */
function MON_land(m, h, at, A, ang) {
  if (!dealDamage(h, { src: m, amount: m.dmg * (at.dmg || 1), el: at.el || m.el, kb: at.kb || 80, ang, knockdown: at.knockdown })) return;
  const p = !m.rig ? [m.x, m.y, 10] : A.spec.kick ? (w => [m.x + w[0], m.y + w[1], m.z + w[2]])(m.rig._w(m.rig.J.footR)) : strikePt(m.rig, A.spec);
  P.impact(p[0], p[1], p[2], at.big ? 9 : 6, at.color || '#ffb08a'); if (at.big) shake(3);
  if (at.hitSfx) sfx(at.hitSfx, { vol: .5 });
  onFoeHit(m, h);
}
/** vanish (fade, rings, embers), reappear at (x, y). MON_blinkStep(m, dt) runs it every step until it returns false */
function MON_blinkStart(m, x, y, o = {}) {
  const c = o.color || '#ff8a3a';
  m.MON_bl = { t: 0, x, y, out: o.out || .22, in: o.in || .26, color: c, moved: false, at: -1 };
  m.vx = m.vy = 0; m.atk = null; m.plan = null;
  P.ring(m.x, m.y, 2, 18, c, .35); sfx('monBlink', { vol: .45 });
}
function MON_blinkStep(m, dt) {
  const b = m.MON_bl; if (!b) return false;
  if (b.at === ED.t) return true; b.at = ED.t;   // an AI and an affix may both step it: once per step
  b.t += dt; m.vx *= .7; m.vy *= .7;
  const c = b.color;
  if (!b.moved) {
    m.fade = clamp(1 - b.t / b.out, 0, 1);
    if (Math.random() < .7) P.add({ kind: 'ember', x: m.x + (Math.random() - .5) * 10, y: m.y + (Math.random() - .5) * 10, z: Math.random() * (m.head || 20) * (m.scale || 1), vz: 30 + Math.random() * 30, max: .45, color: c });
    if (b.t >= b.out) {
      b.moved = true; m.untargetable = true;
      P.ring(m.x, m.y, 3, 22, c, .4); P.smoke(m.x, m.y, 6, 3, { size: 3, color: E.shade(c, -.35), dark: E.shade(c, -.55), light: c });
      m.x = b.x; m.y = b.y; m.vx = m.vy = 0;
      P.ring(m.x, m.y, 22, 3, c, .35); sfx('monBlink', { vol: .3, pitch: 1.5 });
    }
  } else {
    const u = (b.t - b.out) / b.in; m.fade = clamp(u, .05, 1); m.untargetable = u < .5;
    if (Math.random() < .5) P.glints(m.x, m.y, (m.head || 20) * .5, 1, c, 12);
    if (u >= 1) { m.fade = undefined; m.untargetable = false; m.MON_bl = null; return false; }
  }
  return true;
}
/** a body climbs out of the floor: spawned lying flat, it pulls itself up (the rig's down weight eases from 1 to 0) */
function MON_raise(kind, x, y, owner) {
  const id = REG.archetypes[kind] ? kind : 'skeleton', s = spawnMonster(id, x, y, { instant: true, level: owner ? owner.level : undefined });
  if (!s) return null;
  s.ai.aware = true; s.MON_rise = { t: 0, dur: 1.6 }; s.MON_owner = owner || null; s.xp *= .5; s.noLoot = Math.random() < .75; s.cool = .6;
  if (ED.hero) s.facing = angTo(s, ED.hero);
  if (s.rig) { s.rig.downW = 1; s.rig.update(0, { x: s.x, y: s.y, facing: s.facing, down: 1 }); }
  s.rigState = { down: 1, hurt: false, expr: null }; s.stunT = 1.6;
  P.dust(x, y, 0, 12, { speed: 50, color: '#5a4a3a' }); P.bits(x, y, 2, 10, ['#4a3a2a', '#6a5a44', '#2a2018', '#d8cfb4']); P.ring(x, y, 3, 18, '#ff8a3a', .4);
  if (owner) (owner.MON_minions || (owner.MON_minions = [])).push(s);
  return s;
}
function MON_riseStep(m, dt) {
  const R0 = m.MON_rise; R0.t += dt; const u = R0.t / R0.dur;
  if (u >= 1) { m.MON_rise = null; m.rigState = null; m.stunT = 0; return; }
  const k = clamp((u - .22) / .78, 0, 1);
  m.rigState = { down: 1 - E.ease.inOut(k), hurt: false, expr: null, pose: k > .5 && k < .92 ? 'crouch' : null };
  m.stunT = Math.max(m.stunT, .05); m.vx *= .8; m.vy *= .8;
  if (Math.random() < dt * 16 * (1 - k)) { P.dust(m.x + (Math.random() - .5) * 14, m.y + (Math.random() - .5) * 14, 0, 1, { speed: 20, color: '#5a4a3a' }); if (Math.random() < .3) P.bits(m.x, m.y, 1, 2, ['#4a3a2a', '#2a2018']); }
}
BUS.on('step', e => { for (const m of ED.foes) if (m.MON_rise && m.alive) MON_riseStep(m, e.dt); }, 'global');
// spawnMonster leaves stunT unset, and `m.stunT -= dt` turns it into NaN, so `m.stunT <= 0` never holds and no AI acts
// until something hits it. Every new monster starts unstunned (a workaround for the core; see the report)
BUS.on('spawn', e => { const m = e.m; if (typeof m.stunT !== 'number' || m.stunT !== m.stunT) m.stunT = 0; }, 'global');

/* =============================================================================
 * BONETHROWER: a skeleton that keeps its distance, backs away from you, circles, and throws bone javelins
 * ============================================================================= */
const MON_BONE = ['#efe8d4', '#d8cfb4', '#a89c80'];
const MON_THROW = MON_spec('throw', { reach: 7.5, hold: .35, lean: .5 }, 3.2);
def('ai', 'thrower', { update(m, dt) {
  const h = ED.hero, a = m.ai, dx = h.x - m.x, dy = h.y - m.y, d = Math.hypot(dx, dy) || 1, toH = Math.atan2(dy, dx);
  if (!AI.aware(m, 170)) { AI.idle(m, dt); return; }
  m.cool -= dt; let mv = [0, 0];
  if (!m.atk && a.tel) { a.tel.cancelled = true; a.tel = null; }   // a hit broke the wind-up: the warning goes too
  if (m.stunT <= 0 && !h.dead) {
    const A = m.atk;
    if (A) {
      if (A.phase === 'wind') AI.face(m, toH, dt, 4);
      if (A.update(dt * statusSpeed(m)) === 'recover') { MON_javelin(m, h, { n: m.level >= 10 && Math.random() < .35 ? 3 : 1 }); a.tel = null; }   // let go at the end of the arc
      if (!A.busy) { m.atk = null; m.cool = 2 + Math.random() * 1.4; a.strafe = Math.random() < .5 ? 1 : -1; }
    } else {
      const see = MON_los(m, h);
      if (d < 58) mv = [-dx / d, -dy / d];                                        // too close: backpedal, still facing him
      else if (d > 118 || !see) mv = AI.steer(m, h.x, h.y);
      else { const s = a.strafe || 1; mv = [-dy / d * s * .55, dx / d * s * .55]; }   // in range: circle
      AI.face(m, (d < 118 && see) || m.cool < .3 ? toH : Math.atan2(mv[1], mv[0]), dt, 6);
      if (m.cool <= 0 && see && d < 150 && d > 26 && Math.abs(E.angDiff(m.facing, toH)) < .5 && MON_rangedOk()) {
        MON_rangedUsed(); m.atk = new E.Attack(MON_THROW); m.atk.start();
        a.tel = FX.telegraph({ shape: 'line', x: m.x, y: m.y, ang: toH, len: Math.min(d + 16, 160), w: 5, dur: MON_THROW.wind, owner: m, follow: m, followAng: true });
      }
    }
  }
  AI.move(m, mv, dt, d < 58 ? .85 : 1);
} });
/** a bone javelin on a shallow arc, aimed a little ahead of where he is going */
function MON_javelin(m, h, o = {}) {
  const [hx, hy, hz] = m.rig ? m.rig.hand('R') : [m.x, m.y, 16], sp = o.speed || 165;
  const t0 = Math.hypot(h.x - hx, h.y - hy) / sp, tx = h.x + (h.vx || 0) * t0 * .45, ty = h.y + (h.vy || 0) * t0 * .45;
  const T = Math.max(.15, Math.hypot(tx - hx, ty - hy) / sp), grav = 170, vz = (10 - hz) / T + grav * T / 2, n = o.n || 1;
  for (let i = 0; i < n; i++) {
    const ang = Math.atan2(ty - hy, tx - hx) + (n > 1 ? (i / (n - 1) - .5) * .5 : 0);
    FX.bolt({ team: 'foe', src: m, x: hx, y: hy, z: hz, ang, speed: sp, life: T + .8, r: 3, grav, vz, el: m.el, hit: { amount: m.dmg * 1.1, kb: 110 }, look: { kind: 'bone', draw: MON_drawJavelin }, light: 0,
      onHit: (p, u) => { if (u.lastHit !== game.time) return; onFoeHit(m, u); P.impact(p.x, p.y, p.z, 7, '#fff2c4'); P.bits(p.x, p.y, p.z, 5, MON_BONE); },
      onEnd: p => { if (!p.hitSet.size) MON_stuck(p); } });
  }
  sfx('whoosh', { vol: .45, pitch: 1.4 });
}
function MON_drawJavelin(g, x, y, p, r) {
  const k = 5.5 / (Math.hypot(p.vx, p.vy, p.vz) || 1), dx = p.vx * k, dy = p.vy * k, dz = p.vz * k, zm = r.view.zoom || 1, b = E.tones('#d8cfb4');
  const [tx, ty] = r.w(p.x + dx, p.y + dy, p.z + dz), [bx, by] = r.w(p.x - dx, p.y - dy, p.z - dz);
  px.line(g, bx, by + 1, tx, ty + 1, b.deep, Math.max(1, Math.round(zm)));
  px.line(g, bx, by, tx, ty, b.base, Math.max(1, Math.round(1.4 * zm)));
  px.line(g, lerp(bx, tx, .3), lerp(by, ty, .3) - 1, lerp(bx, tx, .8), lerp(by, ty, .8) - 1, b.hi);
  px.disc(g, bx, by, 1.3 * zm, b.lt); px.dot(g, bx + .5, by + .5, b.sh);   // the knuckle end
  px.dot(g, tx, ty, '#ffffff');
}
/** a javelin that missed: it sticks in the floor, quivers and sinks away (or shatters on a wall) */
function MON_stuck(p) {
  if (p.z > 1.5) { P.bits(p.x, p.y, p.z, 6, MON_BONE); sfx('crack', { vol: .25, pitch: 1.6 }); return; }
  const a = Math.atan2(p.vy, p.vx), x = p.x, y = p.y, b = E.tones('#d8cfb4'); P.dust(x, y, 0, 4); P.bits(x, y, 1, 3, ['#4a4050', '#2a2430']); sfx('thud', { vol: .2, pitch: 2.2 });
  FX.visual(1.8, (r, u) => {
    if (!r.visible(x, y, 0)) return;
    r.queue(x, y, 0, g => {
      const k = u > .75 ? (1 - u) / .25 : 1, q = u < .15 ? Math.sin(u * 120) * (1 - u / .15) * 1.2 : 0, zm = r.view.zoom || 1;
      const [bx, by] = r.w(x - Math.cos(a) * 6 * k - Math.sin(a) * q, y - Math.sin(a) * 6 * k + Math.cos(a) * q, 5 * k), [tx, ty] = r.w(x, y, 0);
      px.line(g, bx, by + 1, tx, ty + 1, b.deep, Math.max(1, Math.round(zm))); px.line(g, bx, by, tx, ty, b.base, Math.max(1, Math.round(1.4 * zm))); px.disc(g, bx, by, 1.3 * zm, b.lt);
    });
  });
}
/** bonethrower extras on the rig: a bundle of bone javelins on the back, one cocked in the throwing hand */
function MON_quiver(g, m, ox, oy, view) {
  const rig = m.rig, J = rig.J; if (!J.shC || (rig.downW || 0) > .25) return;
  const b = E.tones(m.pal.bone || '#d8cfb4'), P0 = p => rigScreen(rig, p, ox, oy, view), sh = J.shC, dC = P0(sh)[2], zm = Math.max(1, Math.round(view.scale * rig.o.size * .6));
  for (let i = 0; i < 3; i++) {   // three shafts poking up over the right shoulder
    const lo = [sh[0] - 2, sh[1] + .4 + i * .5, sh[2] - 6], hi = [sh[0] - 3.2, sh[1] + 1.2 + i * .8, sh[2] + 3 + i * .7], A0 = P0(lo), B = P0(hi);
    if (A0[2] < dC) { const top = P0([lo[0] + (hi[0] - lo[0]) * .62, lo[1] + (hi[1] - lo[1]) * .62, lo[2] + (hi[2] - lo[2]) * .62]); A0[0] = top[0]; A0[1] = top[1]; }   // behind him: only the ends above the shoulder show
    px.line(g, A0[0], A0[1], B[0], B[1], b.sh, zm); px.line(g, A0[0] - .5, A0[1], B[0] - .5, B[1], b.base); px.disc(g, B[0], B[1], .9 * zm, b.lt);
  }
  const A = m.atk; if (!A || A.phase === 'recover') return;
  const H = J.handR, t0 = P0([H[0] - 5, H[1], H[2] + 1.4]), t1 = P0([H[0] + 6, H[1], H[2] - .6]);   // cocked above the shoulder, pointing at him
  px.line(g, t0[0], t0[1] + 1, t1[0], t1[1] + 1, b.deep, zm); px.line(g, t0[0], t0[1], t1[0], t1[1], b.base, zm); px.disc(g, t0[0], t0[1], 1.1 * zm, b.lt); px.dot(g, t1[0], t1[1], '#ffffff');
}
def('archetypes', 'bonethrower', { name: 'Bonethrower', tags: ['undead', 'ranged'], themes: ['crypt', 'ruins', 'ossuary', 'cavern', 'mine'], minDepth: 2, weight: 8,
  hp: 22, dmg: 9, speed: 31, r: 5, xp: 12, head: 28,
  rig: { build: 'skeleton', weapon: null, outfit: 'tunic', hat: { style: 'band', color: '#8a2a24' }, hunch: .25 },
  palettes: [{ bone: '#d8cfb4', cloth: '#5a2a24', belt: '#6a5038' }, { bone: '#c8c0a4', cloth: '#2c3a2a', belt: '#5a4a34' }, { bone: '#b4ab94', cloth: '#3a2a44', belt: '#4a3a2a' }], elKeys: ['cloth'],
  ai: 'thrower', onSpawn(m) { m.drawExtra = (g, ox, oy, view) => MON_quiver(g, m, ox, oy, view); } });

/* =============================================================================
 * EMBER CULTIST: robed, hooded, a staff and glowing eyes. Casts fire bolts, raises skeletons out of the floor, and
 * blinks away when you close in. Kill it and the dead it raised crumble (a target to reach first)
 * ============================================================================= */
const MON_CAST = MON_spec('cast', { reach: 8, hold: .35 }, 2.5);
const MON_minions = m => (m.MON_minions = (m.MON_minions || []).filter(s => s.alive)).length;
def('ai', 'cultist', { update(m, dt) {
  const h = ED.hero, a = m.ai, dx = h.x - m.x, dy = h.y - m.y, d = Math.hypot(dx, dy) || 1, toH = Math.atan2(dy, dx);
  if (a.blinkCd === undefined) { a.blinkCd = 1.5; a.sumCd = 1.5 + Math.random() * 2.5; }
  a.blinkCd -= dt; a.sumCd -= dt; m.cool -= dt;
  if (MON_blinkStep(m, dt)) return;
  if (a.rite) { MON_rite(m, dt); return; }
  if (!AI.aware(m, 170)) { AI.idle(m, dt); return; }
  if (!m.atk && a.tel) { a.tel.cancelled = true; a.tel = null; }
  let mv = [0, 0];
  if (m.stunT <= 0 && !h.dead) {
    const A = m.atk;
    if (A) {
      if (A.phase === 'wind') { AI.face(m, toH, dt, 4); if (Math.random() < .6) MON_gather(m, EL(m.el === 'phys' ? 'fire' : m.el).color); }
      if (A.update(dt * statusSpeed(m)) === 'recover') { MON_firebolt(m, h); a.tel = null; }   // the staff has come down level: fire
      if (!A.busy) { m.atk = null; m.cool = 2.4 + Math.random() * 1.4; a.strafe = Math.random() < .5 ? 1 : -1; }
    } else {
      const see = MON_los(m, h);
      if (d < 40 && a.blinkCd <= 0) {   // too close: vanish and reappear further off, away from him
        const s = MON_spot(m.x, m.y, 70, 105, Math.atan2(-dy, -dx), 1.1) || MON_spot(m.x, m.y, 60, 100);
        if (s) { MON_blinkStart(m, s[0], s[1], { color: '#ff8a3a' }); a.blinkCd = 4.5 + Math.random() * 2; return; }
        a.blinkCd = .8;
      }
      if (a.sumCd <= 0 && see && d < 170 && !m.MON_decoy && MON_minions(m) < (m.level >= 8 ? 3 : 2)) { MON_riteStart(m, h); if (a.rite) return; }
      mv = d < 64 ? [-dx / d, -dy / d] : d > 128 || !see ? AI.steer(m, h.x, h.y) : [-dy / d * (a.strafe || 1) * .5, dx / d * (a.strafe || 1) * .5];
      AI.face(m, (d < 128 && see) || m.cool < .3 ? toH : Math.atan2(mv[1], mv[0]), dt, 6);
      if (m.cool <= 0 && see && d < 165 && d > 24 && Math.abs(E.angDiff(m.facing, toH)) < .5 && MON_rangedOk()) {
        MON_rangedUsed(); m.atk = new E.Attack(MON_CAST); m.atk.start(); sfx('charge', { vol: .2, pitch: 1.4 });
        a.tel = FX.telegraph({ shape: 'line', x: m.x, y: m.y, ang: toH, len: Math.min(d + 20, 170), w: 6, dur: MON_CAST.wind, owner: m, follow: m, followAng: true });
      }
    }
  }
  AI.move(m, mv, dt);
} });
/** fire gathers into the staff's orb while it winds up */
function MON_gather(m, col) { const tp = m.rig.tip(), a = Math.random() * TAU, d = 9 + Math.random() * 7; P.add({ kind: 'ember', x: tp[0] + Math.cos(a) * d, y: tp[1] + Math.sin(a) * d, z: tp[2] + (Math.random() - .5) * 8, vx: -Math.cos(a) * d * 3.2, vy: -Math.sin(a) * d * 3.2, max: .3, color: col }); }
function MON_firebolt(m, h) {
  const tp = m.rig.tip(), el = m.el === 'phys' ? 'fire' : m.el, n = m.level >= 9 ? 3 : 1, base = Math.atan2(h.y - tp[1], h.x - tp[0]);
  for (let i = 0; i < n; i++) FX.bolt({ team: 'foe', src: m, x: tp[0], y: tp[1], z: clamp(tp[2], 8, 18), ang: base + (n > 1 ? (i - 1) * .28 : 0), speed: 125, life: 2.2, r: 3, el, hit: { amount: m.dmg * .95, kb: 70, statusChance: .35 }, look: { kind: 'bolt', size: 2.4 }, light: 40,
    onHit: (p, u) => { if (u.lastHit === game.time) onFoeHit(m, u); } });
  sfx('shoot', { vol: .45, pitch: .8 }); P.fire(tp[0], tp[1], tp[2], 4, { size: 2.2 }); P.ring(tp[0], tp[1], 2, 10, EL(el).light, .25, tp[2]);
}
/** the rite: the staff raised, runes burn into the floor where the dead will rise, then they climb out */
function MON_riteStart(m, h) {
  const n = m.level >= 8 ? 3 : 2, spots = [];
  for (let i = 0; i < n; i++) { const s = MON_spot(m.x, m.y, 22, 36, angTo(m, h) + (i - (n - 1) / 2) * .95, .3); if (s) spots.push(s); }
  if (!spots.length) { m.ai.sumCd = 2; return; }
  m.ai.rite = { t: 0, spots, done: false }; m.vx = m.vy = 0; sfx('monChant', { vol: .5 });
}
function MON_rite(m, dt) {
  const R0 = m.ai.rite; R0.t += dt * statusSpeed(m); AI.face(m, angTo(m, ED.hero), dt, 3); AI.move(m, [0, 0], dt);
  m.rigState = { pose: R0.t < 1.25 ? 'cheer' : null, expr: 'shout' };
  for (const [x, y] of R0.spots) if (Math.random() < .35) P.add({ kind: 'ember', x: x + (Math.random() - .5) * 16, y: y + (Math.random() - .5) * 16, z: 1, vz: 20 + Math.random() * 30, max: .6, color: '#ff8a3a' });
  if (Math.random() < .5) { const tp = m.rig.tip(); P.add({ kind: 'fire', x: tp[0], y: tp[1], z: tp[2], vz: 16, g: -8, drag: 3, max: .3, size: 2 }); }
  if (R0.t >= 1.05 && !R0.done) { R0.done = true; for (const [x, y] of R0.spots) MON_raise('skeleton', x, y, m); sfx('monRise', { vol: .6 }); shake(2); }
  if (R0.t >= 1.5) { m.ai.rite = null; m.rigState = null; m.ai.sumCd = 9 + Math.random() * 4; m.cool = Math.min(m.cool, .8); }
}
def('archetypes', 'cultist', { name: 'Ember Cultist', tags: ['human', 'caster', 'summoner'], themes: ['crypt', 'ruins', 'forge', 'abyss', 'ossuary'], minDepth: 3, weight: 4,
  el: 'fire', hp: 28, dmg: 10, speed: 30, r: 5, xp: 18, head: 30,
  rig: { build: 'heroic', weapon: 'staff', outfit: 'robe', hood: true, hat: { style: 'pointed', color: '#4a1414' }, sleeves: 'long', hair: 'short', hunch: .3, cape: { len: 7, width: 4.2, seg: 2.3 }, face: { bangs: 1 } },
  palettes: [
    { cloth: '#6a1a1a', hair: '#4a1414', skin: '#3a2a2a', pants: '#2a1414', boot: '#1e1418', belt: '#c89a40', trim: '#d8a040', cape: '#4a1214', capeIn: '#1e0a0c', staff: '#3a2418', orb: '#ff8a3a', eye: '#ffb040' },
    { cloth: '#2e1a30', hair: '#20121e', skin: '#2e262e', pants: '#1a1018', boot: '#140e14', belt: '#b0703a', trim: '#e07a3a', cape: '#24142a', capeIn: '#120a14', staff: '#2a1a14', orb: '#ffa040', eye: '#ffb040' },
    { cloth: '#4a3a2a', hair: '#34281e', skin: '#3a302a', pants: '#2a2018', boot: '#1e1814', belt: '#d8a040', trim: '#ff8a3a', cape: '#2a1a12', capeIn: '#160e0a', staff: '#4a2a18', orb: '#ff6a2a', eye: '#ffd060' }],
  elKeys: ['orb', 'trim'], elTint: true, ai: 'cultist', draw: MON_draw,
  onSpawn(m) { m.rig.o.eyeGlow = m.pal.eyeGlow || '#ffb040'; m.rig.o.hat = Object.assign({}, m.rig.o.hat, { color: m.pal.hair }); },
  react(m, hit) {
    const R0 = m.ai.rite; if (R0 && !R0.done && (hit.kb || 0) >= 100) { m.ai.rite = null; m.rigState = null; m.ai.sumCd = 3; MON_say(m, 'INTERRUPTED', '#ffd36a'); for (const [x, y] of R0.spots) P.ring(x, y, 12, 2, '#ff8a3a', .3); return; }
    if (hit.src === ED.hero && m.hp > 0 && !m.MON_bl && m.ai.blinkCd <= 0 && Math.random() < .5) {   // struck up close: it may slip away
      const s = MON_spot(m.x, m.y, 70, 105, angTo(ED.hero, m), 1.1) || MON_spot(m.x, m.y, 60, 100); if (s) { MON_blinkStart(m, s[0], s[1], { color: '#ff8a3a', out: .16 }); m.ai.blinkCd = 4.5 + Math.random() * 2; m.ai.rite = null; m.rigState = null; }
    }
  },
  onDie(m) { (m.MON_minions || []).forEach((s, i) => game.after(.25 + i * .18, () => { if (!s.alive) return; P.bits(s.x, s.y, 10, 10, MON_BONE); P.ring(s.x, s.y, 3, 16, '#ff8a3a', .3); killUnit(s, { src: null, el: 'phys', amount: s.hp, tags: ['collapse'] }); })); },
  pre(m, r) {   // the rite's circles burning into the floor
    const R0 = m.alive && m.ai.rite; if (!R0) return;
    const u = clamp(R0.t / 1.05, 0, 1), t = game.time;
    for (const [x, y] of R0.spots) {
      r.decal(() => {
        const rad = 14, R1 = rad * (.35 + .65 * E.ease.outQuad(u));
        r.groundDisc(x, y, R1, '#2a0604', .55); r.groundRing(x, y, R1, '#ff8a3a', .9); r.groundRing(x, y, R1 - 1.5, '#b8401a', .7); r.groundRing(x, y, R1 * .55, '#ffd36a', .75);
        for (let k = 0; k < 5; k++) { const a = t * 1.6 + k / 5 * TAU, b = a + TAU * 2 / 5; const [ax, ay] = [x + Math.cos(a) * R1 * .96, y + Math.sin(a) * R1 * .96], [bx, by] = [x + Math.cos(b) * R1 * .96, y + Math.sin(b) * R1 * .96]; const A0 = r.w(ax, ay, 0), B0 = r.w(bx, by, 0); px.blend(r.tgt, .8, 'normal', () => px.line(r.tgt, A0[0], A0[1], B0[0], B0[1], '#ff9a4a')); }   // a burning pentagram
      }, { emissive: .8 });
      L.add(x, y, 4, 44, .8 * u, { color: '#ff7a2a' });
    }
  },
  post(m, r) {   // the staff's orb swells while it charges a bolt or calls the dead
    if (!m.alive || !m.rig) return;
    const A = m.atk, k = A && A.phase === 'wind' ? A.u : m.ai.rite && m.ai.rite.t < 1.1 ? .5 + .3 * Math.sin(game.time * 20) : 0; if (!k) return;
    const tp = m.rig.tip(), e = EL(m.el === 'phys' ? 'fire' : m.el);
    r.queue(tp[0], tp[1], tp[2], g => { const [x, y] = r.w(tp[0], tp[1], tp[2]), zm = r.view.zoom || 1; px.glow(g, 1); r.glowDisc(g, x, y, (3 + 3.5 * k) * zm, e.glow, .45); px.disc(g, x, y, (1.2 + 1.1 * k) * zm, e.color); px.disc(g, x - .5, y - .5, (.6 + .7 * k) * zm, e.light); if (k > .6) px.dot(g, x - 1, y - 1, '#ffffff'); }, { emissive: foeGlowSeen(tp[0], tp[1], tp[2]), bias: .5 });
    L.add(tp[0], tp[1], tp[2], 40 + 30 * k, .9, { color: e.glow });
  } });

/* =============================================================================
 * GRAVE BRUTE: a hulking corpse in shackles (size 1.5, mass 3). Haymaker and sweep up close; a telegraphed ground
 * slam (a crouch, a hop, both fists down, a shockwave); a head-down charge down a red lane that bowls monsters aside,
 * and dazes it if it meets a wall (bait it into one)
 * ============================================================================= */
const MON_SLAM = { rel: true, hand: 'both', plane: 'side', a0: 2.05, a1: -1.2, reach: 6.8, blade: 0, lunge: 1.5, lean: .7, crouch: .8, hold: .5, twist: 0, wind: .5, active: .12, recover: .6 };
def('ai', 'brute', { update(m, dt) {
  const h = ED.hero, a = m.ai;
  if (a.slamCd === undefined) { a.slamCd = 1.5 + Math.random() * 2; a.chargeCd = 2.5 + Math.random() * 3; }
  a.slamCd -= dt; a.chargeCd -= dt;
  if (m.sp) { if (!m.sp.update(dt * statusSpeed(m))) { m.sp = null; m.rigState = null; m.tok = false; m.canFly = false; } return; }
  if (AI.aware(m) && m.stunT <= 0 && !m.atk && !h.dead) {
    const d = Math.hypot(h.x - m.x, h.y - m.y);
    if (a.chargeCd <= 0 && d > 64 && d < 170 && MON_los(m, h) && AI.takeTurn(m)) { m.sp = MON_charge(m, h); a.chargeCd = 7 + Math.random() * 3; m.tok = true; return; }
    if (a.slamCd <= 0 && d < 54 && AI.takeTurn(m)) { m.sp = MON_slam(m, h); a.slamCd = 6.5 + Math.random() * 2.5; m.tok = true; return; }
  }
  MON_fight(m, dt, { turn: 2.2 });
} });
function MON_slam(m, h) {
  const sx = m.x, sy = m.y, ang = angTo(m, h), hop = clamp(Math.hypot(h.x - m.x, h.y - m.y) - 16, 0, 26), tx = sx + Math.cos(ang) * hop, ty = sy + Math.sin(ang) * hop;
  const R = 44 * m.scale, WIND = .55, AIR = .42;
  FX.telegraph({ shape: 'circle', x: tx, y: ty, r: R, dur: WIND + AIR, owner: m });
  m.facing = ang; sfx('monSnort', { vol: .5 });
  let t = 0, landed = false;
  return { kind: 'slam', update(dt) {
    t += dt;
    if (t < WIND) {   // coil: crouch low, both fists drawn up, trembling
      const k = t / WIND; m.vx *= .8; m.vy *= .8; m.rigState = { attack: { spec: MON_SLAM, phase: 'wind', u: k * .55 }, pose: 'crouch', expr: 'angry' };
      if (Math.random() < .35) m.rig.kick((Math.random() - .5) * 2.5); if (Math.random() < dt * 20) P.dust(m.x, m.y, 0, 1, { speed: 25 });
      return true;
    }
    if (t < WIND + AIR) {   // the hop: it drives its own height (canFly keeps the core's ballistic arc off it)
      const u = (t - WIND) / AIR; m.canFly = true; m.z = Math.sin(u * Math.PI) * 20 * m.scale; m.vx = (tx - sx) / AIR; m.vy = (ty - sy) / AIR;
      m.rigState = { attack: { spec: MON_SLAM, phase: 'wind', u: .55 + u * .45 }, air: u < .7, expr: 'shout' };
      return true;
    }
    if (!landed) { landed = true; m.z = 0; m.canFly = false; m.vx = m.vy = 0; MON_slamLand(m, R); }
    const u = t - WIND - AIR; m.vx = m.vy = 0;
    m.rigState = { attack: { spec: MON_SLAM, phase: u < .12 ? 'active' : 'recover', u: u < .12 ? u / .12 : clamp((u - .12) / .6, 0, 1) }, expr: 'angry' };
    return u < .75;
  } };
}
function MON_slamLand(m, R) {
  const x = m.x, y = m.y;
  FX.nova({ team: 'foe', src: m, x, y, r0: 6, r1: R, dur: .26, el: m.el, color: m.el === 'phys' ? '#f0d8b0' : undefined, hit: { amount: m.dmg * 1.5, kb: 230, knockdown: true } });
  P.dust(x, y, 0, 22, { speed: 90, size: 2 }); P.bits(x, y, 2, 14, ['#5a5068', '#3a3448', '#8a7a6a']); P.ring(x, y, 4, R + 8, '#fff2c4', .35);
  shake(7); game.freeze(.06); sfx('boom', { vol: .7 }); sfx('thud');
  FX.scorch(x, y, R * .45); MON_cracks(x, y, R);
  m.rig.kick(-6);
}
/** radial cracks in the floor where something heavy landed; they fade */
function MON_cracks(x, y, R, dur = 2.6) {
  const cr = [];
  for (let i = 0; i < 7; i++) {
    let cx = x, cy = y, a = i / 7 * TAU + Math.random() * .5; const pts = [[x, y]], n = 3 + (Math.random() * 3 | 0);
    for (let k = 0; k < n; k++) { a += (Math.random() - .5) * .8; const l = R / n * (.6 + Math.random() * .5); cx += Math.cos(a) * l; cy += Math.sin(a) * l; pts.push([cx, cy]); }
    cr.push(pts);
  }
  FX.visual(dur, (r, u) => {
    if (!r.visible(x, y, 0, 120, 120, 120)) return;
    const al = u < .6 ? .95 : (1 - u) / .4 * .95;
    r.decal(() => { const g = r.tgt; px.blend(g, al, 'normal', () => { for (const pts of cr) for (let k = 1; k < pts.length; k++) { const A0 = r.w(pts[k - 1][0], pts[k - 1][1], 0), B = r.w(pts[k][0], pts[k][1], 0); px.line(g, A0[0], A0[1] + 1, B[0], B[1] + 1, '#8a8098'); px.line(g, A0[0], A0[1], B[0], B[1], '#0e0a12', k < 2 ? 2 : 1); } }); });
  });
}
function MON_charge(m, h) {
  const ang = angTo(m, h), len = Math.min(210, Math.hypot(h.x - m.x, h.y - m.y) + 50), AIM = .8, SPD = 240 * clamp(m.speed / 24, .9, 1.3);
  FX.telegraph({ shape: 'line', x: m.x, y: m.y, ang, len, w: 18 * m.scale, dur: AIM, owner: m });
  sfx('monSnort', { vol: .6, pitch: .8 });
  let t = 0, t0 = 0, st = 'aim', hit = false, dist = 0, daze = 0; const bowled = new Set();
  return { kind: 'charge', update(dt) {
    t += dt; m.facing = ang;
    if (st === 'aim') {   // head down, pawing the floor
      m.vx *= .8; m.vy *= .8; m.rigState = { pose: 'crouch', expr: 'angry', run: t > AIM * .5 ? .6 : 0 };
      if (Math.random() < dt * 14) P.dust(m.x - Math.cos(ang) * 6, m.y - Math.sin(ang) * 6, 0, 1, { speed: 30 });
      if (t >= AIM) { st = 'rush'; sfx('roar', { vol: .3, pitch: 1.6 }); shake(2); }
      return true;
    }
    if (st === 'rush') {
      m.vx = Math.cos(ang) * SPD; m.vy = Math.sin(ang) * SPD; dist += SPD * dt; m.rigState = { dash: true, expr: 'shout' };
      if (Math.random() < dt * 30) P.dust(m.x, m.y, 0, 2, { speed: 40 });
      // monsters in the lane are bowled aside; kegs and other things take the hit
      eachEnemy('hero', m.x, m.y, m.r + 6, u => { if (u === m || bowled.has(u) || u.boss) return; bowled.add(u); const side = E.angDiff(ang, angTo(m, u)) > 0 ? 1 : -1; knock(u, ang + side * 1.1, 190, 80); u.kbT = .3; u.stunT = Math.max(u.stunT || 0, .45); P.impact(u.x, u.y, 12, 6, '#fff2c4'); sfx('punch', { vol: .4 }); });
      eachThing(m.x, m.y, m.r + 4, th => { if (!bowled.has(th)) { bowled.add(th); hitThing(th, { src: m, amount: m.dmg, el: 'phys', kb: 200, ang, tags: ['blast'] }); } });
      if (!hit && h.alive && Math.hypot(h.x - m.x, h.y - m.y) < m.r + h.r + 5) {
        hit = true;
        if (dealDamage(h, { src: m, amount: m.dmg * 1.6, el: m.el, kb: 280, ang, knockdown: true })) { onFoeHit(m, h); P.impact(h.x, h.y, 14, 10, '#fff2c4'); shake(5); game.freeze(.06); sfx('kick'); }
      }
      const fx = m.x + Math.cos(ang) * (m.r + 5), fy = m.y + Math.sin(ang) * (m.r + 5);
      if (ED.L && ED.L.map && ED.L.map.solidAt(fx, fy)) {   // into a wall: a crash and a daze
        st = 'daze'; daze = 1.4; m.vx = -Math.cos(ang) * 60; m.vy = -Math.sin(ang) * 60;
        shake(6); game.freeze(.05); sfx('boom', { vol: .6 }); P.dust(fx, fy, 8, 14, { speed: 70 }); P.bits(fx, fy, 10, 10, ['#5a5068', '#3a3448', '#8a7a6a']); P.impact(fx, fy, 16, 11, '#fff2c4');
        applyStatus(m, 'vuln'); MON_say(m, 'DAZED', '#ffd36a'); return true;
      }
      if (dist >= len || !MON_open(fx, fy)) { st = 'stop'; t0 = t; }
      return true;
    }
    if (st === 'daze') {
      daze -= dt; m.vx *= .9; m.vy *= .9; m.rigState = { hurt: true, pose: daze > .35 ? 'kneel' : null, expr: 'wince' };
      if (Math.random() < dt * 8) P.glints(m.x + (Math.random() - .5) * 10, m.y + (Math.random() - .5) * 10, (m.head || 40) * m.scale + 2, 1, '#fff2c4', 4);
      return daze > 0;
    }
    m.vx *= Math.exp(-7 * dt); m.vy *= Math.exp(-7 * dt); m.rigState = { pose: 'crouch', expr: 'angry' };   // the skid
    if (Math.random() < dt * 20) P.dust(m.x, m.y, 0, 1, { speed: 20 });
    return t - t0 < .45;
  } };
}
/** the brute's dressing, drawn on its rig: an iron collar with a hanging chain, cuffs with chain on both wrists, tusks,
 *  stitched seams on the arms and over the skull (where it was put back together). Parts on the far side are skipped */
function MON_bruteExtras(g, m, ox, oy, view) {
  const rig = m.rig, J = rig.J; if (!J.handL || (rig.downW || 0) > .92) return;   // (drawn from the joints, so they ride the topple down)
  const Q = p => rigScreen(rig, p, ox, oy, view), mt = E.tones('#6a6a78'), u = view.scale * rig.o.size, sk = E.tones(m.pal.skin || '#8a9a78'), seam = sk.deep, lw = Math.max(1, Math.round(u * .45));
  const mid = z => Q([(J.hipC[0] + J.shC[0]) / 2, 0, z])[2];   // the body's depth at a height: what is behind it is hidden
  // stitched seams down the near upper arms
  for (const s of ['L', 'R']) {
    const S0 = J['sh' + s], E0 = J['elbow' + s], a = Q(S0), b = Q(E0); if ((a[2] + b[2]) / 2 < mid(S0[2]) - .5) continue;
    const p0 = [lerp(a[0], b[0], .2), lerp(a[1], b[1], .2)], p1 = [lerp(a[0], b[0], .8), lerp(a[1], b[1], .8)]; px.line(g, p0[0] + .5, p0[1], p1[0] + .5, p1[1], seam);
    for (let k = 1; k < 4; k++) { const x = lerp(p0[0], p1[0], k / 4), y = lerp(p0[1], p1[1], k / 4); px.line(g, x - 1, y, x + 1.5, y, seam); }
  }
  // cuffs and chains on both wrists
  for (const s of ['L', 'R']) {
    const H = J['hand' + s], El = J['elbow' + s], w = [lerp(H[0], El[0], .28), lerp(H[1], El[1], .28), lerp(H[2], El[2], .28)], [x, y, dd] = Q(w);
    if (dd < mid(w[2]) - 1.5) continue;
    px.ell(g, x, y, Math.max(1.5, .9 * u), Math.max(1, .7 * u), mt.deep); px.ell(g, x - .4, y - .4, Math.max(1, .7 * u), Math.max(.6, .45 * u), mt.base); px.dot(g, x - .6 * u, y - .4 * u, mt.hi);
    let cx = x, cy = y + .6 * u;
    for (let k = 1; k <= 3; k++) { const sw = Math.sin(rig.t * 4 + k * .9 + (s === 'L' ? 1 : 0)) * .5 * k; cx += sw * .6; cy += .9 * u; px.rect(g, Math.round(cx) - 1, Math.round(cy) - 1, 2, 2, k % 2 ? mt.sh : mt.base); px.dot(g, cx - 1, cy - 1, mt.lt); }
  }
  // an iron collar (its near half) with a ring and a short chain on the chest
  const N = J.shC, nz = N[2] + .5, cd = mid(nz), HQ = Q(J.head), hr = rig.o.headR * u * .95; let prev = null;
  const underHead = p => p[2] < HQ[2] && Math.hypot(p[0] - HQ[0], p[1] - HQ[1]) < hr;   // the hunched head hangs in front of the collar
  for (let i = 0; i <= 12; i++) {
    const a = i / 12 * TAU, p = Q([N[0] + Math.cos(a) * 2.2, N[1] + Math.sin(a) * 2.4, nz]);
    if (prev && p[2] >= cd - .3 && prev[2] >= cd - .3 && !underHead(p) && !underHead(prev)) { px.line(g, prev[0], prev[1], p[0], p[1], mt.deep, lw + 1); px.line(g, prev[0], prev[1] - 1, p[0], p[1] - 1, mt.base); }
    prev = p;
  }
  const ring = Q([N[0] + 2.4, N[1], nz - .6]); if (ring[2] >= cd && !underHead(ring)) { px.disc(g, ring[0], ring[1] + u * .6, Math.max(1, u * .55), mt.sh); px.dot(g, ring[0] - .5, ring[1] + u * .3, mt.hi); for (let k = 1; k <= 2; k++) px.rect(g, ring[0] - 1 + Math.sin(rig.t * 3 + k) * .6, ring[1] + u * (.6 + k * .9), 2, 2, k % 2 ? mt.base : mt.sh); }
  // tusks, if the face is toward us
  const Hd = J.head, R = rig.o.headR, hc = Q(Hd)[2];
  for (const sd of [-1, 1]) { const t0 = Q([Hd[0] + R * .9, Hd[1] + sd * R * .38, Hd[2] - R * .55]); if (t0[2] > hc + .2) { const t1 = Q([Hd[0] + R * 1.05, Hd[1] + sd * R * .45, Hd[2] - R * .15]); px.line(g, t0[0], t0[1], t1[0], t1[1], '#e8e0c8', Math.max(1, Math.round(u * .4))); px.dot(g, t1[0], t1[1], '#ffffff'); } }
  // the seam over the skull, ear to ear
  let last = null;
  for (let i = 0; i <= 8; i++) {
    const a = -1.3 + i / 8 * 2.6, p = Q([Hd[0] - R * .1, Hd[1] + R * .96 * Math.sin(a), Hd[2] + R * .96 * Math.cos(a)]);
    if (p[2] >= hc - .2) { if (last) px.line(g, last[0], last[1], p[0], p[1], seam); if (i % 2) px.line(g, p[0] - 1, p[1] - 1, p[0] + 1, p[1] + 1, seam); last = p; } else last = null;
  }
}
def('archetypes', 'brute', { name: 'Grave Brute', tags: ['undead', 'melee', 'heavy'], themes: ['crypt', 'ossuary', 'cavern', 'mine', 'ruins'], minDepth: 5, weight: 3,
  hp: 95, dmg: 17, speed: 24, r: 8, xp: 34, head: 42, mass: 3, armor: 8, corpseT: 2.2,
  rig: { build: 'bulky', size: 1.5, weapon: null, hair: 'bald', hunch: .55, lean: .12, sleeves: 'none', outfit: 'shirt', speedRef: 50, eyeGlow: '#f0f0b0', face: { bangs: 0 } },
  palettes: [
    { skin: '#8a9a78', cloth: '#4a3a2e', pants: '#3a3030', boot: '#2a2420', belt: '#6a5a3a', hair: '#3a3a30' },
    { skin: '#8a9eb0', cloth: '#3a2c3e', pants: '#2e2a34', boot: '#221e26', belt: '#8a5a3a', hair: '#302a30' },
    { skin: '#b0967a', cloth: '#2e3a2a', pants: '#32282a', boot: '#241c1c', belt: '#7a5a3a', hair: '#2a3030' }], elKeys: ['cloth'],
  ai: 'brute', draw: MON_draw,
  attacks: [
    { name: 'haymaker', move: 'haymaker', dmg: 1.5, kb: 215, knockdown: true, big: true, wind: 2.4, pitch: .6, hitSfx: 'punch' },
    { name: 'sweep', move: 'sweep', over: { crouch: .9, reach: 8 }, dmg: 1.1, kb: 160, half: 1.6, big: true, wind: 2.6, sound: 'whoosh', pitch: .7, hitSfx: 'kick' }],
  plans: [{ seq: ['haymaker'], w: 3 }, { seq: ['sweep'], w: 2 }, { seq: ['sweep', 'haymaker'], w: 2, depth: 8 }],
  onSpawn(m) { m.drawExtra = (g, ox, oy, view) => MON_bruteExtras(g, m, ox, oy, view); },
  react(m) { if (m.sp) m.stunT = 0; },   // no flinch mid-slam or mid-charge: it has to be dodged
  post(m, r) {
    if (!m.alive || !m.sp) return;
    if (m.sp.kind === 'slam') m.rig.drawSmear(r, CLAW_SMEAR);
    else if (m.rigState && m.rigState.dash) MON_ghost(m, r, '#ff6a4a', .05, .3);
  } });

/* =============================================================================
 * HOLLOW DUELIST: tall, fast, a ponytail and a coat. Reads your wind-up and steps across it, then ripostes; chains
 * backslash into thrust; closes gaps with a flying kick down a warned lane
 * ============================================================================= */
/** the hero's attack the duelist should answer: a wind-up or early strike aimed its way, or a bolt flying at it */
function MON_threat(m, h) {
  const act = h.act, st = act && act.rig && act.rig.attack, d = Math.hypot(h.x - m.x, h.y - m.y);
  if (st && d < 48 && (st.phase === 'wind' || (st.phase === 'active' && st.u < .4)) && Math.abs(E.angDiff(h.facing, angTo(h, m))) < 1.2) {
    if (m.ai.seenSp === st.spec) return null; m.ai.seenSp = st.spec; return angTo(h, m);   // one roll per swing
  }
  for (const f of ED.fx) if (f.kind === 'bolt' && f.team === 'hero' && !f.ended) {
    const dx = m.x - f.x, dy = m.y - f.y, dd = Math.hypot(dx, dy); if (dd > 55 || dd < 3) continue;
    const sp = Math.hypot(f.vx, f.vy) || 1; if ((dx * f.vx + dy * f.vy) / (dd * sp) > .94 && m.ai.seenBolt !== f) { m.ai.seenBolt = f; return Math.atan2(f.vy, f.vx); }
  }
  return null;
}
function MON_sidestep(m, h, ang) {
  const room = s => MON_open(m.x + Math.cos(ang + s * 1.2) * 28, m.y + Math.sin(ang + s * 1.2) * 28);
  let side = Math.random() < .5 ? 1 : -1; if (!room(side)) side = -side;
  const dir = ang + side * 1.25, T = .26; let t = 0;
  sfx('whoosh', { vol: .5, pitch: 1.6 }); P.dust(m.x, m.y, 0, 5, { speed: 40 }); m.untargetable = true;
  return { kind: 'step', update(dt) {
    t += dt; const u = t / T, v = 210 * (1 - u * u);
    m.vx = Math.cos(dir) * v; m.vy = Math.sin(dir) * v; AI.face(m, angTo(m, h), dt, 14);
    m.untargetable = u < .7; m.rigState = { pose: 'crouch', expr: null };
    if (u < 1) return true;
    // the riposte: a lunging thrust into the opening he left (it takes a turn even when the attackers are all busy)
    if (h.alive && Math.hypot(h.x - m.x, h.y - m.y) < 80) { AI.tokens++; MON_startAtk(m, 'riposte', true); m.plan = []; m.facing = angTo(m, h); }
    return false;
  } };
}
def('ai', 'duelist', { update(m, dt) {
  const h = ED.hero, a = m.ai;
  a.dodgeCd = (a.dodgeCd === undefined ? .6 : a.dodgeCd) - dt; a.kickCd = (a.kickCd === undefined ? 1.5 : a.kickCd) - dt;
  if (m.sp) { if (!m.sp.update(dt * statusSpeed(m))) { m.sp = null; m.rigState = null; m.untargetable = false; } return; }
  if (AI.aware(m) && m.stunT <= 0 && !h.dead && ED.mode !== 'gallery') {
    const d = Math.hypot(h.x - m.x, h.y - m.y), threat = MON_threat(m, h);
    if (threat !== null && a.dodgeCd <= 0 && (!m.atk || m.atk.phase === 'wind')) {
      if (Math.random() < .65) { m.atk = null; m.plan = null; m.sp = MON_sidestep(m, h, threat); a.dodgeCd = 1.8 + Math.random(); return; }
    }
    if (!m.atk && a.kickCd <= 0 && d > 46 && d < 96 && MON_los(m, h) && AI.takeTurn(m)) {
      MON_startAtk(m, 'flyingkick', false); a.kickCd = 4.5 + Math.random() * 2; m.facing = angTo(m, h);
      FX.telegraph({ shape: 'line', x: m.x, y: m.y, ang: m.facing, len: d + 6, w: 12, dur: m.atk.spec.wind, owner: m, follow: m, followAng: true });
    }
  }
  MON_fight(m, dt, { turn: 3.5 });
} });
def('archetypes', 'duelist', { name: 'Hollow Duelist', tags: ['undead', 'melee', 'agile'], themes: ['ruins', 'clockwork', 'sky', 'aqueduct', 'ossuary'], minDepth: 6, weight: 4,
  hp: 34, dmg: 12, speed: 42, r: 5, xp: 22, head: 32, stance: 'ready',
  rig: { build: 'heroic', weapon: 'sword', bladeLen: 12, outfit: 'coat', hair: 'ponytail', sleeves: 'long', eyeGlow: '#8ae8ff', speedRef: 70 },
  palettes: [
    { skin: '#c8c8d4', hair: '#dcdcec', cloth: '#3a2a4a', coat: '#2a2038', pants: '#22202e', boot: '#1a1622', belt: '#c8a04a', trim: '#d8b060', metal: '#dce4f0', metalDk: '#7a8498', hilt: '#c8a04a' },
    { skin: '#bcc4cc', hair: '#2a2a3a', cloth: '#2a3a4a', coat: '#1e2a38', pants: '#1c2028', boot: '#14181e', belt: '#9ab0c8', trim: '#b8c8e0', metal: '#e4ecf4', metalDk: '#7a8a9a', hilt: '#8a9ab0' },
    { skin: '#d0c8cc', hair: '#f0f0f8', cloth: '#4a2224', coat: '#381a1c', pants: '#241a1c', boot: '#1a1214', belt: '#d8a040', trim: '#e8c070', metal: '#e8e0d8', metalDk: '#8a7a70', hilt: '#d8a040' }], elKeys: ['coat', 'cloth'],
  ai: 'duelist', draw: MON_draw,
  attacks: [
    { name: 'backslash', move: 'backslash', over: { a1: 2.1, z1: -3 }, dmg: .9, kb: 90, wind: 3, chain: 2.6 },
    { name: 'thrust', move: 'thrust', over: { r1: 11 }, dmg: 1.2, kb: 140, half: .6, extraReach: 5, wind: 2.8, chain: 2.2, sound: 'slash2' },
    { name: 'riposte', move: 'thrust', over: { r1: 11, lunge: 4.5, lean: .6, active: .16 }, dmg: 1.3, kb: 150, half: .7, wind: 2, chain: 1.6, leap: 190, sound: 'slash2', big: true },
    { name: 'flyingkick', move: 'flyingkick', over: { crouch: .8 }, dmg: 1.1, kb: 190, wind: 4.5, leap: 250, sound: 'whoosh', hitSfx: 'kick', big: true }],
  plans: [{ seq: ['backslash', 'thrust'], w: 4 }, { seq: ['thrust'], w: 2 }, { seq: ['backslash'], w: 1 }, { seq: ['backslash', 'backslash', 'thrust'], w: 2, depth: 9 }],
  post(m, r) { if (!m.alive) return; if (m.sp && m.sp.kind === 'step') MON_ghost(m, r, '#8ae8ff', .035, .28); else if (m.atk && m.atk.phase === 'active' && (m.atk.spec.kick || m.arch.attacks[m.next].leap)) MON_ghost(m, r, '#8ae8ff', .04, .22); } });

/* =============================================================================
 * ASHEN MONK: bare fists in a boxer's guard. Jab, cross, hook, uppercut and roundhouse strings; blocks what comes
 * at it from the front (its guard breaks after a few blocks, or to heavy hits), and counters fast after a block
 * ============================================================================= */
def('ai', 'monk', { update(m, dt) {
  const a = m.ai; a.guard = Math.min(3, (a.guard === undefined ? 3 : a.guard) + dt / 1.6);
  m.MON_blockT = (m.MON_blockT || 0) - dt;
  m.rigState = m.MON_blockT > 0 && !m.atk ? { pose: 'guard', expr: 'angry' } : null;
  if (Math.random() < dt * 3) P.add({ kind: 'ember', x: m.x + (Math.random() - .5) * 8, y: m.y + (Math.random() - .5) * 8, z: 8 + Math.random() * 18, vz: 14, max: .9, color: Math.random() < .5 ? '#ff8a3a' : '#8a8078' });   // ash and sparks drift off it
  MON_fight(m, dt, { turn: 3.2 });
} });
function MON_monkBlock(hit, amt) {
  const m = this;
  if (ED.mode === 'gallery' || !m.alive || m.stunT > 0 || m.st.freeze || m.st.stun || (m.atk && m.atk.phase !== 'wind') || m.MON_bl) return amt;
  if (MON_tag(hit, 'dot', 'floor', 'area', 'aoe', 'blast', 'beam', 'chain') || !MON_front(m, hit, 1.15)) return amt;
  const a = m.ai; a.guard = (a.guard === undefined ? 3 : a.guard) - ((hit.kb || 0) >= 200 ? 2 : 1);
  if (a.guard <= 0) {   // the guard gives: a stagger, and this hit lands harder
    a.guard = 0; m.stunT = .9; m.MON_blockT = 0; m.atk = null; m.plan = null;
    MON_say(m, 'GUARD BREAK', '#ffd36a'); sfx('crack', { vol: .5 }); P.impact(m.x, m.y, 16, 9, '#ffd36a');
    return amt * 1.25;
  }
  m.MON_blockT = .35; m.MON_blockedAt = game.time; m.atk = null; m.plan = null; m.cool = Math.min(m.cool, .12);   // blocked: forearms take it, and it counters soon
  hit.kb = (hit.kb || 0) * .25; hit.up = 0;
  const f = m.facing, bx = m.x + Math.cos(f) * 5, by = m.y + Math.sin(f) * 5;
  P.sparks(bx, by, 17, 6, f, { color: '#ffe0a0' }); P.impact(bx, by, 17, 5, '#ffe0a0'); sfx('punch', { vol: .45, pitch: .7 });
  MON_say(m, 'BLOCK', '#c8c0d8'); if (m.rig) m.rig.kick(-1.5);
  return amt * .2;
}
def('archetypes', 'monk', { name: 'Ashen Monk', tags: ['human', 'melee', 'martial'], themes: ['ruins', 'sky', 'frost', 'clockwork', 'forge'], minDepth: 5, weight: 4,
  hp: 40, dmg: 8, speed: 36, r: 5, xp: 22, head: 30, stance: 'guard',
  rig: { build: 'heroic', weapon: null, hair: 'bald', outfit: 'tunic', sleeves: 'none', hat: { style: 'band', color: '#c83a2a' }, eyeGlow: '#ff9a4a', face: { bangs: 0 } },
  palettes: [
    { skin: '#9a948c', cloth: '#6a645c', pants: '#4a4640', boot: '#3a3430', belt: '#1a1618', trim: '#c83a2a' },
    { skin: '#b0aaa2', cloth: '#3a3634', pants: '#2a2826', boot: '#221e1c', belt: '#c83a2a', trim: '#e0a040' },
    { skin: '#7a746e', cloth: '#d8d0c0', pants: '#8a8274', boot: '#4a4440', belt: '#2a2220', trim: '#ff8a3a' }], elKeys: ['cloth'],
  ai: 'monk',
  attacks: [
    { name: 'jab', move: 'jab', dmg: .6, kb: 40, wind: 2.2, chain: 2.4, flow: .25, sound: 'swing', pitch: 1.5, hitSfx: 'punch' },
    { name: 'cross', move: 'cross', dmg: .8, kb: 70, wind: 2.2, chain: 2.4, flow: .25, pitch: 1.3, hitSfx: 'punch' },
    { name: 'hook', move: 'hook', dmg: .9, kb: 90, wind: 2.2, chain: 2.4, flow: .3, pitch: 1.1, hitSfx: 'punch' },
    { name: 'uppercut', move: 'uppercut', dmg: 1.2, kb: 150, wind: 2.4, chain: 2.4, big: true, pitch: .9, hitSfx: 'punch' },
    { name: 'roundhouse', move: 'roundhouse', dmg: 1.3, kb: 190, half: 1.4, wind: 2.6, chain: 2.4, big: true, sound: 'whoosh', hitSfx: 'kick' }],
  plans: [{ seq: ['jab', 'cross'], w: 4 }, { seq: ['jab', 'cross', 'hook'], w: 3, depth: 5 }, { seq: ['jab', 'jab', 'uppercut'], w: 2, depth: 7 }, { seq: ['roundhouse'], w: 2 }, { seq: ['uppercut'], w: 1 }, { seq: ['jab', 'cross', 'hook', 'roundhouse'], w: 2, depth: 10 }],
  onSpawn(m) { MON_guard(m, MON_monkBlock); }, react: MON_blocked });

/* =============================================================================
 * BULWARK: a shield knight. Holds its kite shield up (the 'block' pose) and turns slowly: frontal hits spark off the
 * shield. Get behind it, or break its guard with a heavy hit (a spin, a lunge, a blast). Bashes with the shield
 * ============================================================================= */
def('ai', 'bulwark', { update(m, dt) {
  m.MON_shFlash = (m.MON_shFlash || 0) - dt; m.MON_brokeT = (m.MON_brokeT || 0) - dt;
  const guarding = !m.atk && m.stunT <= 0 && m.MON_brokeT <= 0;
  m.rigState = guarding ? { pose: 'block' } : null;
  MON_fight(m, dt, { turn: 1.6, moveK: guarding ? .85 : 1 });
} });
/** where the shield is in the world (the left hand, pushed forward a little) */
function MON_shieldPt(m) { const [x, y, z] = m.rig.hand('L'); return [x + Math.cos(m.facing) * 2, y + Math.sin(m.facing) * 2, z]; }
function MON_shieldBlock(hit, amt) {
  const m = this;
  if (ED.mode === 'gallery' || !m.alive || m.stunT > 0 || m.MON_brokeT > 0 || m.st.freeze || m.st.stun || (m.atk && m.atk.phase === 'active')) return amt;
  if (MON_tag(hit, 'dot', 'floor', 'area') || !MON_front(m, hit, 1.25)) return amt;
  const [sx, sy, sz] = MON_shieldPt(m), back = m.facing;
  if ((hit.kb || 0) >= 200 || MON_tag(hit, 'blast')) {   // a heavy hit knocks the shield aside: a stagger, the hit mostly lands
    m.MON_brokeT = .9; m.stunT = .9; m.atk = null; m.plan = null;
    sfx('clang', { pitch: .6 }); sfx('crack', { vol: .4 }); P.sparks(sx, sy, sz, 14, back); P.impact(sx, sy, sz, 10, '#fff2c4'); shake(3); game.freeze(.05);
    MON_say(m, 'GUARD BROKEN', '#ffd36a');
    return amt * .7;
  }
  const proj = MON_tag(hit, 'proj'), spell = !proj && MON_tag(hit, 'aoe', 'spell', 'beam', 'chain');
  m.MON_shFlash = .12; m.MON_blockedAt = game.time; hit.kb = (hit.kb || 0) * .15; hit.up = 0;
  P.sparks(sx, sy, sz, 9, back, { color: '#fff0c0', hot: '#ffffff' }); P.impact(sx, sy, sz, 6, '#fff4d0'); sfx('clang', { vol: .5, pitch: .9 + Math.random() * .2 });
  const h = ED.hero; if (hit.src === h && MON_tag(hit, 'melee')) { game.freeze(.04); shake(1.5); const a = angTo(m, h); h.vx += Math.cos(a) * 70; h.vy += Math.sin(a) * 70; }   // the blade bounces off
  MON_say(m, 'BLOCK', '#c8d8f0'); if (m.rig) m.rig.kick(-1);
  return amt * (spell ? .5 : .12);
}
/** a blocked hit lands on forearms or a shield: no flinch and no stun (so the next hit can be blocked too) */
function MON_blocked(m) { if (m.MON_blockedAt === game.time) { m.stunT = 0; m.flash = .03; } }
/** the kite shield on the left arm: face (heraldic field, band, boss, rim) or back (planks, straps), shaded */
function MON_drawShield(g, m, ox, oy, view) {
  const rig = m.rig, J = rig.J; if (!J.handL || (rig.downW || 0) > .45) return;
  const H = J.handL, broke = clamp((m.MON_brokeT || 0) / .9, 0, 1), yaw = -.3 - broke * 1.2, cy = Math.cos(yaw), sy = Math.sin(yaw), tilt = broke * .5;
  const f0 = H[0] + 1.4, r0 = H[1] * (.5 + .5 * broke);   // held out in front, drawn in toward the midline
  const S = (u, v, n = 0) => rigScreen(rig, [f0 - sy * u + cy * n, r0 + cy * u + sy * n, H[2] + v + tilt * u], ox, oy, view);
  const W = 4.3, T = 5.6, B = 7.4, pts = [S(-W, T), S(-W * .5, T + .7), S(W * .5, T + .7), S(W, T), S(W * .95, -1.4), S(0, -B), S(-W * .95, -1.4)];
  const face = S(0, 0, 1)[2] > S(0, 0, 0)[2], c = S(0, 0);
  const field = E.tones(m.MON_shFlash > 0 ? '#f0ece0' : m.pal.cloth || '#2e4a78'), rim = E.tones(m.pal.metal || '#b9c1cf'), trim = E.tones(m.pal.trim || '#d0a85a'), wood = E.tones('#6a4a30');
  const inset = (P0, d) => P0.map(p => { const vx = p[0] - c[0], vy = p[1] - c[1], l = Math.hypot(vx, vy) || 1, k = Math.max(0, l - d) / l; return [c[0] + vx * k - .5, c[1] + vy * k - .5]; });
  px.poly(g, pts, rim.deep); px.poly(g, inset(pts, .9), rim.sh);
  if (face) {
    px.poly(g, inset(pts, 1.8), field.sh); px.poly(g, inset(pts, 2.6), field.base);
    const b0 = S(0, T + .2), b1 = S(0, -B + 1.6); px.line(g, b0[0], b0[1], b1[0], b1[1], trim.sh, Math.max(1, Math.round(view.scale * rig.o.size * .9)));
    px.line(g, b0[0] - .5, b0[1], b1[0] - .5, b1[1], trim.base);   // the band down the middle
    const l0 = S(-W + 1, 1.2), l1 = S(W - 1, 1.2); px.line(g, l0[0], l0[1], l1[0], l1[1], trim.base);
    px.disc(g, c[0], c[1] - 1, Math.max(1, view.scale * rig.o.size * .9), rim.base); px.dot(g, c[0] - .5, c[1] - 1.5, rim.hi);   // the boss
    px.line(g, pts[0][0], pts[0][1], pts[1][0], pts[1][1], rim.hi); px.line(g, pts[6][0], pts[6][1], pts[0][0], pts[0][1], rim.lt);
  } else {
    px.poly(g, inset(pts, 1.6), wood.sh);
    for (let k = -1; k <= 1; k++) { const p0 = S(k * 1.6, T - .5), p1 = S(k * 1.6, -B + 2.5); px.line(g, p0[0], p0[1], p1[0], p1[1], wood.deep); }
    const s0 = S(-W + 1, 1), s1 = S(W - 1, 1); px.line(g, s0[0], s0[1], s1[0], s1[1], '#3a2418', 2);   // the arm strap
  }
  if (c[2] < rigScreen(rig, [(J.hipC[0] + J.shC[0]) / 2, 0, H[2]], ox, oy, view)[2] - .5) rig.draw(g, ox, oy, view);   // behind the body (at its own height): the body goes back over it
}
def('archetypes', 'bulwark', { name: 'Bulwark', tags: ['undead', 'melee', 'armored', 'shield'], themes: ['crypt', 'ruins', 'forge', 'clockwork', 'aqueduct'], minDepth: 4, weight: 4,
  hp: 64, dmg: 13, speed: 21, r: 6, xp: 26, head: 31, mass: 2.5, armor: 14, cape: true,
  rig: { build: 'bulky', armor: true, sleeves: 'long', hat: { style: 'helmet', color: '#7a8496' }, weapon: 'sword', bladeLen: 8, speedRef: 45 },
  palettes: ['#2e4a78', '#7a2e34', '#3f5a3a', '#4a3a6a'].map(t => ({ cloth: t, pants: '#34303c', boot: '#2a2630', belt: '#6a5030', trim: '#d0a85a', metal: '#b9c1cf', metalDk: '#687488', skin: '#c8a88e', hair: '#3a2a22', cape: E.shade(t, -.2), capeIn: E.shade(t, -.45) })),
  elKeys: ['cloth', 'cape'], ai: 'bulwark',
  attacks: [
    { name: 'bash', move: 'bash', dmg: 1.1, kb: 220, wind: 2.6, big: true, sound: 'whoosh', pitch: .8, hitSfx: 'clang' },
    { name: 'thrust', move: 'thrust', dmg: 1.2, kb: 120, half: .6, extraReach: 3, wind: 2.4, chain: 2.2 }],
  plans: [{ seq: ['bash'], w: 3 }, { seq: ['thrust'], w: 2 }, { seq: ['bash', 'thrust'], w: 2, depth: 7 }],
  onSpawn(m) { MON_guard(m, MON_shieldBlock); m.drawExtra = (g, ox, oy, view) => MON_drawShield(g, m, ox, oy, view); }, react: MON_blocked });

/* =============================================================================
 * BAT: wings and fangs, flies. Some roost upside down under a wall's lip until you come near (or the pack wakes),
 * then drop, circle, and dive at you on a sine curve with a screech and a small warning on the floor
 * ============================================================================= */
/** hang a bat from the nearest tall wall: find one within reach, hug it, lift it under the lip */
function MON_roost(m) {
  const map = ED.L && ED.L.map; if (!map) return;
  let best = null;
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU;
    for (let s = 6; s <= 42; s += 4) { const x = m.x + Math.cos(a) * s, y = m.y + Math.sin(a) * s, hh = map.heightAt(x, y); if (hh > 0) { const c = [Math.floor(x / T16), Math.floor(y / T16)]; if (hh >= 24 && !MON_cutWall(map, c) && (!best || s < best.s)) best = { s, a, hh, c }; break; } }
  }
  if (!best) return;
  const d = best.s - 6, x = m.x + Math.cos(best.a) * d, y = m.y + Math.sin(best.a) * d; if (!MON_open(x, y)) return;
  m.x = m.homeX = x; m.y = m.homeY = y; m.z = Math.min(best.hh - 7, 32); m.MON_roost = true; m.MON_roostCell = best.c; m.facing = best.a + Math.PI;
}
/** is a wall cell drawn cut down to a stub in this view (a wall in front of the floor)? A bat can't hang from one */
const MON_cutWall = (map, c) => !!(map.cutaway && map._isFront && map._isFront(c[0], c[1], game.view));
def('ai', 'bat', { update(m, dt) {
  const h = ED.hero, a = m.ai, dx = h.x - m.x, dy = h.y - m.y, d = Math.hypot(dx, dy) || 1, k = statusSpeed(m);
  a.t = (a.t || Math.random() * 9) + dt;
  if (!a.s) a.s = m.MON_roost ? 'roost' : 'fly';
  if (a.s === 'roost') {   // asleep: wings folded, a slow breath; wakes to him, to its pack, or to a hit
    if (m.MON_roostCell && ED.L && MON_cutWall(ED.L.map, m.MON_roostCell)) { a.s = 'fly'; m.MON_roost = false; return; }   // the view turned and cut its wall down: it lets go and hovers
    m.vx = m.vy = 0; m.blobState = { hang: true, flap: 0, squint: true, squash: .06 * Math.sin(a.t * 2.2), look: [dx, dy] };
    if ((d < 80 && h.alive) || a.aware || m.hp < m.maxHp) { a.s = 'drop'; a.st = 0; a.aware = true; AI.aware(m, 999); sfx('monScreech', { vol: .4 }); P.dust(m.x, m.y, m.z + 4, 4, { color: '#5a4a5a', speed: 20 }); }
    return;
  }
  if (a.s === 'drop') { a.st += dt; m.z = Math.max(9, m.z - dt * 70 * (1 - a.st)); m.blobState = { hang: a.st < .1, flap: a.st > .14 ? 1 : .2, look: [dx, dy], squash: -.12 }; if (a.st > .45) a.s = 'fly'; return; }
  if (m.stunT > 0) { if (a.s !== 'fly') { a.s = 'fly'; a.cd = 1.2; m.tok = false; } m.vx *= .93; m.vy *= .93; m.blobState = { flap: .6, squash: -.2, squint: true, look: [dx, dy] }; return; }
  if (!AI.aware(m, 150)) {   // hovering on the spot, bobbing
    m.vx *= .95; m.vy *= .95; m.z = approach(m.z, 14 + 3 * Math.sin(a.t * 2.4), 20 * dt); m.blobState = { flap: 1, look: [Math.cos(a.t * .5), Math.sin(a.t * .5)] }; return;
  }
  if (a.s === 'fly') {   // loop around him at a wavering height
    const orbit = 46 + 10 * Math.sin(a.t * .7 + m.ph), dir = a.dir || (a.dir = Math.random() < .5 ? 1 : -1);
    const an = Math.atan2(m.y - h.y, m.x - h.x) + dir * .55, tx = h.x + Math.cos(an) * orbit, ty = h.y + Math.sin(an) * orbit;
    let [ux, uy] = d > 130 ? AI.steer(m, h.x, h.y) : [tx - m.x, ty - m.y]; const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
    const sp = m.speed * k; m.vx = approach(m.vx, ux * sp, 280 * dt); m.vy = approach(m.vy, uy * sp, 280 * dt);
    m.z = approach(m.z, 16 + 5 * Math.sin(a.t * 3.1 + m.ph), 30 * dt); m.facing = Math.atan2(m.vy, m.vx);
    m.blobState = { flap: 1, look: [dx, dy], squash: .08 * Math.sin(a.t * 14) };
    a.cd = (a.cd === undefined ? .8 + Math.random() * 2 : a.cd) - dt;
    if (a.cd <= 0 && d < 92 && h.alive && MON_los(m, h) && AI.takeTurn(m)) { a.s = 'wind'; a.st = 0; m.tok = true; a.tx = h.x; a.ty = h.y; sfx('monScreech', { vol: .55 }); FX.telegraph({ shape: 'circle', x: h.x, y: h.y, r: 11, dur: .42, owner: m }); }
    return;
  }
  if (a.s === 'wind') {   // it pulls up and back, wings wide, then drops
    a.st += dt * k; m.vx *= .9; m.vy *= .9; m.z = approach(m.z, 27, 45 * dt); m.blobState = { flap: 1, squash: -.28, look: [dx, dy] };
    if (a.st > .42) {
      const an = Math.atan2(a.ty - m.y, a.tx - m.x), dd = Math.hypot(a.tx - m.x, a.ty - m.y);
      Object.assign(a, { s: 'dive', st: 0, sx: m.x, sy: m.y, sz: m.z, ex: a.tx + Math.cos(an) * 34, ey: a.ty + Math.sin(an) * 34, T: clamp((dd + 34) / 190, .45, .9), hit: false }); sfx('whoosh', { vol: .4, pitch: 1.8 });
    }
    return;
  }
  if (a.s === 'dive') {   // the sine dive: down through his chest height and back up past him, wiggling
    a.st += dt * k; const u = clamp(a.st / a.T, 0, 1), perp = Math.atan2(a.ey - a.sy, a.ex - a.sx) + Math.PI / 2, wig = Math.sin(u * TAU) * 7;
    const nx = lerp(a.sx, a.ex, u) + Math.cos(perp) * wig, ny = lerp(a.sy, a.ey, u) + Math.sin(perp) * wig;
    m.vx = (nx - m.x) / Math.max(dt, 1e-3); m.vy = (ny - m.y) / Math.max(dt, 1e-3); m.facing = Math.atan2(m.vy, m.vx);
    m.z = a.sz - (a.sz - 6) * Math.sin(u * Math.PI);
    m.blobState = { flap: .25, squash: .24, look: [m.vx, m.vy] };   // wings tucked, stretched long
    if (!a.hit && h.alive && m.z < 13 && Math.hypot(h.x - m.x, h.y - m.y) < m.r + h.r + 3) {
      a.hit = true;
      if (dealDamage(h, { src: m, amount: m.dmg, el: m.el, kb: 70, ang: m.facing, status: 'bleed', statusChance: .3 })) { onFoeHit(m, h); P.impact(h.x, h.y, 13, 6, '#ffb08a'); sfx('hit', { vol: .4, pitch: 1.5 }); }
    }
    if (u >= 1) { a.s = 'fly'; a.cd = 1.5 + Math.random() * 1.8; m.tok = false; m.vx *= .3; m.vy *= .3; }
  }
} });
def('archetypes', 'bat', { name: 'Cave Bat', tags: ['beast', 'flying'], minDepth: 1, weight: 7, hp: 11, dmg: 6, speed: 62, r: 4, xp: 5, head: 12, body: 'blob', flies: true,
  blob: { R: 4.2, wings: true, mouth: 'fangs', ears: 'cat', face: 'front' },
  palettes: [
    { dk: '#231726', base: '#4a3452', lt: '#8a6a96', wing: '#3a2442', eye: '#ffe060', pupil: '#300808', inner: '#c86a8a' },
    { dk: '#2a1c14', base: '#5a4030', lt: '#9a7a5a', wing: '#4a3020', eye: '#ffcf40', pupil: '#2a0a04', inner: '#c87a6a' },
    { dk: '#4a3a4a', base: '#a898a8', lt: '#ece0ec', wing: '#7a6480', eye: '#ff4040', pupil: '#3a0000', inner: '#f0a0b0' }], elKeys: ['base', 'wing'],
  ai: 'bat', draw: MON_draw,
  post(m, r) {   // eyes that shine in the dark (drawn again after lighting), where the blob puts them, hanging or not
    if (!m.alive || !m.blob || foeAlpha(m) < .5) return;
    const b = m.blob, zz = m.z;
    r.queue(m.x, m.y, zz, g => {
      const [ox, oy] = r.w(m.x, m.y, zz), f = MON_blobFrame(b, Math.round(ox), Math.round(oy), r.view), pv = Math.round(oy - b.o.R * b.scale * r.view.scale), lx = clamp(r.view.p(b.look[0], b.look[1], 0)[0], -1, 1);
      px.glow(g, 1);
      for (const sd of [-1, 1]) { const X = Math.round(f.cx + lx * f.rx * .25 + sd * f.rx * .36), Y0 = Math.round(f.cy - f.ry * .12), Y = b.hang ? 2 * pv - Y0 : Y0; if (b.squint) px.rect(g, X - 1, Y, 2, 1, b.C.eye); else { px.rect(g, X - 1, Y - 1, 2, 2, b.C.eye); px.dot(g, X - 1, Y - 1, '#ffffff'); } }
    }, { emissive: foeGlowSeen(m.x, m.y, zz), bias: .05 });
  },
  onSpawn(m, o) { if (!o.MON_decoy && o.roost !== false && (o.roost || Math.random() < .5)) MON_roost(m); if (!m.MON_roost) m.z = 14; } });

/* =============================================================================
 * IMP: horns, a tail, fangs, feet. Hops about at range, lobs fireballs that land on a warned circle and leave fire,
 * and blinks out of reach in a puff when you get close
 * ============================================================================= */
def('ai', 'imp', { update(m, dt) {
  const h = ED.hero, a = m.ai, dx = h.x - m.x, dy = h.y - m.y, d = Math.hypot(dx, dy) || 1, k = statusSpeed(m);
  a.t = (a.t || 0) + dt; a.blinkCd = (a.blinkCd === undefined ? 1.5 : a.blinkCd) - dt; m.cool -= dt;
  if (MON_blinkStep(m, dt)) { m.blobState = { squash: .3, squint: true, look: [dx, dy] }; return; }
  if (m.z > 0 || m.vz > 0) {   // a hop's arc (canFly while airborne keeps the core's ballistics off it)
    m.vz -= 460 * TUNE.gravity * dt * k; m.z += m.vz * dt * k;
    if (m.z <= 0) { m.z = 0; m.vz = 0; m.canFly = false; m.blob.kick(-5); P.dust(m.x, m.y, 0, 3, { speed: 20 }); a.rest = .22 + Math.random() * .4; m.vx *= .25; m.vy *= .25; }
    m.blobState = { squash: clamp(m.vz / 500, -.2, .3), look: [dx, dy] }; return;
  }
  m.vx = approach(m.vx, 0, 400 * dt); m.vy = approach(m.vy, 0, 400 * dt);
  if (!AI.aware(m, 150)) { AI.idle(m, dt); m.blobState = { look: [m.vx || 1, m.vy], walk: Math.hypot(m.vx, m.vy) > 3 ? 1 : 0 }; return; }
  if (m.stunT > 0 || k === 0) { a.cast = null; m.blobState = { squash: -.12, squint: true, look: [dx, dy] }; return; }
  if (a.cast) {   // squash down while the fireball swells over its horns, then spring up and throw
    a.cast.t += dt * k; const u = a.cast.t / .6; m.facing = Math.atan2(dy, dx);
    m.blobState = { squash: u < .8 ? -.34 * u / .8 : .3, look: [dx, dy], squint: u > .8 };
    if (Math.random() < .5) P.add({ kind: 'ember', x: m.x, y: m.y, z: m.z + 16 * m.scale, vx: (Math.random() - .5) * 30, vy: (Math.random() - .5) * 30, vz: 20, max: .3, color: EL(m.el === 'phys' ? 'fire' : m.el).color });
    if (u >= 1) { MON_impBall(m, h); a.cast = null; m.cool = 2.3 + Math.random(); m.blob.kick(7); }
    return;
  }
  if (d < 34 && a.blinkCd <= 0) { const s = MON_spot(m.x, m.y, 40, 62, Math.atan2(-dy, -dx), 1.3) || MON_spot(m.x, m.y, 36, 60); if (s) { MON_blinkStart(m, s[0], s[1], { color: '#ff6a3a', out: .14, in: .2 }); a.blinkCd = 3.5 + Math.random() * 2; return; } a.blinkCd = .6; }
  if (m.cool <= 0 && d < 150 && d > 30 && MON_los(m, h) && MON_rangedOk()) { MON_rangedUsed(); a.cast = { t: 0 }; sfx('charge', { vol: .25, pitch: 1.8 }); return; }
  a.rest = (a.rest || 0) - dt * k;
  if (a.rest <= 0) {   // hop: in toward range, back out, or sideways
    const want = d > 110 ? 1 : d < 60 ? -1 : 0; if (!a.side || Math.random() < .25) a.side = Math.random() < .5 ? 1 : -1;
    const dir = want > 0 ? AI.steer(m, h.x, h.y) : want < 0 ? [-dx / d, -dy / d] : [-dy / d * a.side, dx / d * a.side], len = 18 + Math.random() * 16, T = 2 * 120 / 460;
    m.vz = 120; m.z = .01; m.canFly = true; m.vx = dir[0] * len / T; m.vy = dir[1] * len / T; m.blob.kick(4); m.facing = Math.atan2(dir[1], dir[0]);
  }
  m.blobState = { squash: a.rest < .12 ? -.25 : .03 * Math.sin(a.t * 6), look: [dx, dy] };
} });
function MON_impBall(m, h) {
  const z0 = m.z + 16 * m.scale, sp = 110, t0 = Math.hypot(h.x - m.x, h.y - m.y) / sp, tx = h.x + (h.vx || 0) * t0 * .5, ty = h.y + (h.vy || 0) * t0 * .5;
  const T = Math.max(.25, Math.hypot(tx - m.x, ty - m.y) / sp), grav = 300, vz = -z0 / T + grav * T / 2, el = m.el === 'phys' ? 'fire' : m.el;
  FX.telegraph({ shape: 'circle', x: tx, y: ty, r: 15, dur: T });
  FX.bolt({ team: 'foe', src: m, x: m.x, y: m.y, z: z0, ang: Math.atan2(ty - m.y, tx - m.x), speed: sp, life: T + .5, r: 4, grav, vz, el, hit: { amount: m.dmg, kb: 80 }, look: { kind: 'orb', size: 2.2 }, light: 40,
    onEnd: p => { if (p.hitSet.size) return; FX.nova({ team: 'foe', src: m, x: p.x, y: p.y, r0: 3, r1: 16, dur: .2, el, hit: { amount: m.dmg * .7, kb: 90 } }); FX.area({ team: 'foe', src: m, x: p.x, y: p.y, r: 12, dur: 1.8, tick: .5, el, hit: { amount: m.dmg * .2 }, light: false }); sfx('explode', { vol: .3, pitch: 1.4 }); } });
  sfx('shoot', { vol: .4, pitch: 1.2 });
}
def('archetypes', 'imp', { name: 'Imp', tags: ['demon', 'ranged'], themes: ['forge', 'abyss', 'cavern', 'mine', 'ossuary'], minDepth: 3, weight: 6, el: 'fire', hp: 16, dmg: 8, speed: 40, r: 5, xp: 10, head: 16, body: 'blob',
  blob: { R: 5, horns: true, tail: true, mouth: 'fangs', feet: true, face: 'front' },
  palettes: [
    { dk: '#5a1410', base: '#b83424', lt: '#ff7a4a', horn: '#2a1614', eye: '#ffe070', pupil: '#2a0800', ext: '#3a0c08' },
    { dk: '#3a1440', base: '#7a2a8a', lt: '#c86ad0', horn: '#1a0a1a', eye: '#ffd040', pupil: '#2a0820', ext: '#240a28' },
    { dk: '#2a2424', base: '#4a4040', lt: '#8a7a70', horn: '#c8a060', eye: '#ff5020', pupil: '#200000', ext: '#1a1414' }], elTint: false,
  ai: 'imp', draw: MON_draw,
  react(m, hit) { if (m.ai.blinkCd <= 0 && Math.random() < .45 && m.hp > 0) { const s = MON_spot(m.x, m.y, 36, 56); if (s) { MON_blinkStart(m, s[0], s[1], { color: '#ff6a3a', out: .12, in: .2 }); m.ai.blinkCd = 3.5; } } },
  post(m, r) {   // the fireball forming over its head
    const c = m.alive && m.ai.cast; if (!c) return;
    const u = clamp(c.t / .6, 0, 1), e = EL(m.el === 'phys' ? 'fire' : m.el), z = m.z + (16 + 4 * u) * m.scale;
    r.queue(m.x, m.y, z, g => { const [x, y] = r.w(m.x, m.y, z), zm = r.view.zoom || 1, s = (1 + u * 1.4) * zm, fl = Math.sin(game.time * 40) * .4; px.glow(g, 1); r.glowDisc(g, x, y, (3 + 2.5 * u) * zm, e.glow, .45); px.disc(g, x, y, (.9 + .9 * u) * zm + fl, e.color); px.disc(g, x - .5, y - .5, (.5 + .5 * u) * zm, e.light); if (u > .5) px.dot(g, x - 1, y - 1, '#ffffff'); }, { emissive: foeGlowSeen(m.x, m.y, z), bias: .4 });
    L.add(m.x, m.y, z, 30 + 30 * u, .9, { color: e.glow });
  } });

/* =============================================================================
 * BLOATER: a swollen, pustuled blob that waddles at you. Close in and it swells, trembling, inside a warning ring,
 * then bursts: venom (or fire) that hurts monsters as much as you. Kill it and its corpse still pops a moment later,
 * so drag it into a pack before you do
 * ============================================================================= */
const MON_BURST_R = 42;
const MON_PUS = [[-.62, .32, .18], [.6, .36, .16], [.08, .64, .13], [-.3, -.64, .12], [.38, -.62, .11], [-.8, -.1, .09], [.82, -.04, .1]];
def('ai', 'bloater', { update(m, dt) {
  const h = ED.hero, a = m.ai, dx = h.x - m.x, dy = h.y - m.y, d = Math.hypot(dx, dy) || 1;
  a.t = (a.t || 0) + dt;
  if (a.swell !== undefined) {
    a.swell += dt; const u = a.swell / 1.05; m.vx *= .85; m.vy *= .85; m.MON_swell = u;
    m.blob.kick((Math.random() - .5) * 5 * u); m.blobState = { squash: .1 * Math.sin(a.t * 30) * u, look: [dx, dy], squint: true };
    if (Math.random() < dt * 20 * u) elBurst(m.x + (Math.random() - .5) * 10, m.y + (Math.random() - .5) * 10, 8 + Math.random() * 10, m.MON_bel, 1);
    if (u >= 1) { m.MON_selfBurst = true; killUnit(m, { src: null, el: m.MON_bel, amount: 0, tags: ['burst'] }); }
    return;
  }
  if (!AI.aware(m, 130)) { AI.idle(m, dt); m.blobState = { look: [m.vx || 1, m.vy], walk: Math.hypot(m.vx, m.vy) > 3 ? .8 : 0 }; return; }
  if (m.stunT <= 0 && h.alive && d < m.r + h.r + 16) { a.swell = 0; m.tok = true; sfx('monSwell', { vol: .5 }); FX.telegraph({ shape: 'circle', x: m.x, y: m.y, r: MON_BURST_R * m.scale, dur: 1.05, owner: m }); return; }
  AI.move(m, m.stunT > 0 ? [0, 0] : AI.steer(m, h.x, h.y), dt); AI.face(m, Math.atan2(dy, dx), dt, 3);
  const w = Math.hypot(m.vx, m.vy) / Math.max(1, m.speed);
  m.blobState = { squash: .07 * Math.sin(a.t * 9) * w - .03, look: [dx, dy], walk: clamp(w * 1.4, 0, 1) };
} });
/** the burst: everyone in the ring takes it, monsters hardest; a pool stays */
function MON_burst(m, src) {
  if (m.MON_popped) return; m.MON_popped = true; m.gone = true;
  const x = m.x, y = m.y, el = m.MON_bel || 'venom', R = MON_BURST_R * (m.scale || 1), e = EL(el), c = m.blob ? m.blob.C : { base: e.color, lt: e.light, dk: e.dark };
  hitCircle('hero', x, y, R, u => u === m ? null : ({ src, amount: m.dmg * 3, el, kb: 200, up: 90, ang: Math.atan2(u.y - y, u.x - x), statusChance: .8, tags: ['aoe', 'blast'] }));
  const h = ED.hero; if (h && h.alive && Math.hypot(h.x - x, h.y - y) < R + h.r) dealDamage(h, { src: m, amount: m.dmg * 2, el, kb: 190, ang: Math.atan2(h.y - y, h.x - x), statusChance: .7 });
  elBurst(x, y, 8, el, 24); P.bits(x, y, 6, 22, [c.base, c.lt, c.dk]); P.ring(x, y, 4, R + 6, e.light, .4);
  P.smoke(x, y, 4, 8, el === 'venom' ? { size: 6, color: '#6a8a3a', dark: '#2a3a1a', light: '#a8c878' } : { size: 6 });
  if (el === 'fire') P.explosion(x, y, 6, 1.3, { flash: false, sound: false });
  FX.scorch(x, y, R * .7, el === 'venom' ? '#1e2a10' : '#1a1016', 5);
  FX.area({ team: 'foe', src: null, x, y, r: R * .6, dur: 3.5, tick: .5, el, hit: { amount: m.dmg * .3, statusChance: .6 } });
  shake(5); game.freeze(.05); sfx('monSplat'); sfx('explode', { vol: .5 });
}
/** its body: the blob, grown and flushed while it swells, with pustules and a stitched belly drawn on */
function MON_bloatBody(m) {
  const b = m.blob, draw0 = b.draw, upd0 = b.update, C0 = Object.assign({}, b.C);
  b.update = function (dt, s) {
    if (!m.alive && m.MON_dying) { m.MON_swell = Math.min(1.25, (m.MON_swell || 0) + dt * 1.7); s = { squash: .12 * Math.sin(this.t * 40), squint: true, look: this.look }; }
    return upd0.call(this, dt, s);
  };
  b.draw = function (g, ox, oy, view) {
    const sw = Math.min(1.25, m.MON_swell || 0), fl = sw > 0 && Math.sin(game.time * (14 + sw * 24)) > 0;
    this.scale = (m.scale || 1) * (1 + .38 * E.ease.outQuad(Math.min(1, sw)));
    if (sw > 0) { const k = .45 * Math.min(1, sw); this.C.base = E.mix(C0.base, fl ? '#ff8a6a' : C0.lt, k); this.C.dk = E.mix(C0.dk, fl ? '#a02a2a' : C0.base, k * .6); }
    draw0.call(this, g, ox, oy, view);
    const f = MON_blobFrame(this, ox, oy, view), t = this.t, ct = E.tones(C0.lt), kk = 1 + sw * .5;
    for (let i = 0; i < MON_PUS.length; i++) {
      const [u, v, s] = MON_PUS[i], x = f.cx + (u + Math.sin(t * 3 + i * 1.7) * .03) * f.rx, y = f.cy + v * f.ry, r0 = Math.max(1, s * f.rx * kk * (1 + .15 * Math.sin(t * 5 + i)));
      px.disc(g, x, y + .5, r0, ct.sh); px.disc(g, x - .3, y - .3, Math.max(.5, r0 - .7), sw > .3 && (i + Math.floor(t * 12)) % 2 ? '#fff0c0' : ct.base); px.dot(g, x - r0 * .4, y - r0 * .4, ct.hi);
    }
    const sy = f.cy + f.ry * .56, st = E.tones(C0.dk);   // a stitched seam across the belly
    px.line(g, f.cx - f.rx * .42, sy, f.cx + f.rx * .34, sy - f.ry * .08, st.deep);
    for (let i = 0; i < 4; i++) { const x = f.cx - f.rx * .34 + i * f.rx * .22, y = sy - i * f.ry * .02; px.line(g, x, y - 1.5, x + 1, y + 1.5, st.deep); }
  };
}
def('archetypes', 'bloater', { name: 'Bloater', tags: ['undead', 'volatile'], themes: ['fungal', 'aqueduct', 'crypt', 'abyss', 'ossuary'], minDepth: 3, weight: 5,
  hp: 36, dmg: 12, speed: 17, r: 8, xp: 14, head: 22, mass: 2, body: 'blob',
  blob: { R: 8, feet: true, mouth: true, face: 'front' },
  palettes: [
    { dk: '#3a4a1a', base: '#8a9a4a', lt: '#d0e08a', eye: '#ffe0a0', pupil: '#2a1a0a', ext: '#2a3010' },
    { dk: '#4a2a4a', base: '#8a5a7a', lt: '#d0a0c0', eye: '#ffe0a0', pupil: '#2a0a1a', ext: '#301a30' },
    { dk: '#6a2a1a', base: '#c86a3a', lt: '#ffb07a', eye: '#fff0a0', pupil: '#2a0a00', ext: '#401a10', burst: 'fire' }], elKeys: ['base', 'lt'],
  ai: 'bloater',
  onSpawn(m) { m.MON_bel = m.el !== 'phys' ? m.el : m.pal.burst || 'venom'; MON_bloatBody(m); },
  onDie(m, hit) {
    const src = hit && hit.src && hit.src.team === 'hero' ? hit.src : null;
    if (m.MON_selfBurst || m.MON_decoy) { MON_burst(m, src); return; }
    // popped by him: the corpse keeps swelling a moment, then goes (pull it into a pack first)
    m.vx = m.vy = m.vz = 0; m.z = 0; m.MON_dying = true; m.MON_swell = Math.max(.3, m.MON_swell || 0);
    FX.telegraph({ shape: 'circle', x: m.x, y: m.y, r: MON_BURST_R * m.scale, dur: .6 }); sfx('monSwell', { vol: .4, pitch: 1.6 });
    game.after(.6, () => MON_burst(m, src));
  } });

/* =============================================================================
 * MIRE SLIME: a big slime with a skull adrift inside it. Split it and two medium ones spring out; split those and
 * two small ones do. (The core pouncer AI drives all three sizes)
 * ============================================================================= */
const MON_MIRE = { hp: [1, .42, .2], R: [1, .68, .46], r: [9, 6.5, 4.5], dmg: [1, .8, .6], mass: [2.4, 1.4, 1] };
function MON_mireBody(m) {
  const b = m.blob, draw0 = b.draw;
  b.draw = function (g, ox, oy, view) {
    draw0.call(this, g, ox, oy, view);
    const f = MON_blobFrame(this, ox, oy, view), t = this.t, dk = E.tones(this.C.dk);
    px.blend(g, .5, 'normal', () => {
      if (!m.MON_tier && f.rx > 6) {   // a skull adrift in the ooze
        const sx = f.cx - f.rx * .28 + Math.sin(t * .7) * f.rx * .06, sy = f.cy + f.ry * .3 + Math.sin(t * 1.1), sr = Math.max(1.5, f.rx * .2);
        px.disc(g, sx, sy, sr, '#d8cfb4'); px.rect(g, sx - sr * .5, sy + sr * .55, sr, Math.max(1, sr * .5), '#c8bfa4'); px.dot(g, sx - sr * .4, sy, '#2a2018'); px.dot(g, sx + sr * .3, sy, '#2a2018');
      }
      for (let i = 0; i < 4; i++) { const ph = (t * .35 + i * .27) % 1, bx = f.cx + Math.sin(i * 2.3 + t * .5) * f.rx * .45, by = f.cy + f.ry * (.6 - ph * 1.1), br = Math.max(.7, f.rx * (.06 + .03 * (i % 2))); px.disc(g, bx, by, br, dk.deep); px.dot(g, bx - br * .4, by - br * .4, this.C.lt); }
    });
    for (const s of [-1, 1]) { const k = (t * .8 + (s > 0 ? .5 : 0)) % 1, x = f.cx + s * f.rx * .45, y = f.cy + f.ry * .86 + k * 2.5; px.ell(g, x, y, Math.max(.8, f.rx * .08), Math.max(1, f.ry * .07 + k * 1.5), this.C.dk); }   // drips
  };
}
function MON_split(m, hit) {
  if ((m.MON_tier || 0) >= 2 || m.MON_decoy) return;
  const tier = (m.MON_tier || 0) + 1, a0 = hit && hit.ang !== undefined ? hit.ang : Math.random() * TAU;
  for (const s of [-1, 1]) {
    const a = a0 + s * Math.PI / 2 + (Math.random() - .5) * .6, x = m.x + Math.cos(a) * 5, y = m.y + Math.sin(a) * 5, ok = MON_open(x, y);
    const c = spawnMonster('mireslime', ok ? x : m.x, ok ? y : m.y, { tier, instant: true, pal: m.pal, el: m.el, level: m.level });
    if (!c) continue;
    c.ai.aware = true; c.z = 3; c.vz = 130 + Math.random() * 40; c.vx = Math.cos(a) * 55; c.vy = Math.sin(a) * 55; c.blob.kick(6); c.untargetable = true; c.MON_untT = .3; c.facing = a;
  }
  const C = m.blob.C; P.bits(m.x, m.y, 6, 14, [C.base, C.lt, C.dk]); P.ring(m.x, m.y, 3, 20 * (m.scale || 1), C.lt, .3); sfx('monSplat', { vol: .5, pitch: 1.1 + tier * .25 });
}
def('archetypes', 'mireslime', { name: 'Mire Slime', tags: ['beast', 'ooze'], themes: ['fungal', 'aqueduct', 'cavern', 'crypt', 'abyss'], minDepth: 3, weight: 5,
  hp: 56, dmg: 11, speed: 28, r: 9, xp: 16, head: 24, mass: 2.4, body: 'blob', ai: 'pouncer',
  blob: { R: 9.5, face: 'front', mouth: true },
  palettes: [{ dk: '#2a4a22', base: '#5a8a3a', lt: '#b8e088', eye: '#fff8d0', pupil: '#1a2a10' }, { dk: '#3a3018', base: '#7a6a38', lt: '#c8b878', eye: '#fff0c0', pupil: '#2a200a' }, { dk: '#241a36', base: '#4e3a6e', lt: '#9a88c8', eye: '#f0e8ff', pupil: '#1a1028' }],
  elKeys: ['base', 'lt'],
  onSpawn(m, o) {
    const t = m.MON_tier = o.tier || 0;
    if (t) { m.maxHp = m.hp = Math.max(1, Math.round(m.maxHp * MON_MIRE.hp[t])); m.xp *= MON_MIRE.hp[t] * 1.5; m.dmg *= MON_MIRE.dmg[t]; m.r = MON_MIRE.r[t]; m.head = 24 * MON_MIRE.R[t]; m.mass = MON_MIRE.mass[t]; m.blob.o.R = 9.5 * MON_MIRE.R[t]; }
    MON_mireBody(m);
  },
  update(m, dt) {
    if (m.MON_untT > 0 && (m.MON_untT -= dt) <= 0) m.untargetable = false;
    if (m.MON_air && m.z <= 0) { const C = m.blob.C; P.add({ kind: 'dust', x: m.x, y: m.y, z: 1, vz: 4, max: .5, size: m.r * .5, color: C.dk }); if (!m.MON_tier) P.bits(m.x, m.y, 1, 3, [C.base, C.lt]); }   // splat on landing
    m.MON_air = m.z > 0;
  },
  onDie(m, hit) { MON_split(m, hit); } });

/** deep packs share an affix among normal monsters: those get a lighter dose than an elite */
const MON_dose = m => m.elite ? 1 : .55;
const MON_VX = { until: 0 };   // one vortex pulls at a time
/* =============================================================================
 * ELITE AFFIXES: each one shows (an aura, a trail, particles, a glow) and plays (a trail to avoid, a nova to outrun,
 * a bubble to break, a pull to dodge)
 * ============================================================================= */
def('affixes', 'burning', { name: 'Burning', color: '#ff8a3a', minDepth: 2,
  apply(m) { m.res.fire = Math.max(m.res.fire || 0, .5); m.MON_trail = { d: 0, x: m.x, y: m.y }; },
  update(m, dt) {
    const tr = m.MON_trail; tr.d += Math.hypot(m.x - tr.x, m.y - tr.y); tr.x = m.x; tr.y = m.y;
    if (tr.d > 13 / MON_dose(m)) { tr.d = 0; FX.area({ team: 'foe', src: m, x: m.x, y: m.y, r: 7 + m.r * .4, dur: 2.4 * MON_dose(m), tick: .45, el: 'fire', hit: { amount: m.dmg * .22, statusChance: .35 }, light: false }); }
    if (Math.random() < dt * 9) P.add({ kind: 'fire', x: m.x + (Math.random() - .5) * m.r * 2, y: m.y + (Math.random() - .5) * m.r * 2, z: (m.z || 0) + 3 + Math.random() * (m.head || 20) * (m.scale || 1) * .7, vz: 22, g: -10, drag: 3, max: .35, size: 2 });
  },
  onHit(m, tgt) { applyStatus(tgt, 'burn', m.dmg * .35, m); },
  draw(m, r) { const s = m.scale || 1; r.decal(() => r.groundDisc(m.x, m.y, m.r * s + 4, '#ff6a2a', .22 + .1 * Math.sin(game.time * 9 + m.ph)), { emissive: .6 }); L.add(m.x, m.y, 10, 54, .7, { color: '#ff8a3a' }); } });

def('affixes', 'frozen', { name: 'Frozen', color: '#9fe8ff', minDepth: 3,
  apply(m) { m.res.frost = Math.max(m.res.frost || 0, .5); },
  update(m, dt) { if (Math.random() < dt * 5) P.add({ kind: 'dust', x: m.x + (Math.random() - .5) * 10, y: m.y + (Math.random() - .5) * 10, z: 1, vz: 5, g: -2, drag: 2, max: .8, size: 2.2, color: '#cfefff' }); if (Math.random() < dt * 3) P.glints(m.x, m.y, (m.head || 20) * (m.scale || 1) * .6, 1, '#e8fbff', 12); },
  onHit(m, tgt) { applyStatus(tgt, 'chill', .5, m); },
  onDie(m) {   // a frost nova a moment after it falls, with ice spikes running out
    const x = m.x, y = m.y, R = 46 * (m.scale || 1), dmg = m.dmg * MON_dose(m);
    FX.telegraph({ shape: 'circle', x, y, r: R, dur: .7, then() {
      FX.nova({ team: 'foe', src: null, x, y, r0: 6, r1: R, dur: .3, el: 'frost', hit: { amount: dmg * 1.2, kb: 90, status: 'chill', statusChance: 1, statusPower: 2 } });
      for (let i = 0; i < 8; i++) FX.wave({ team: 'foe', src: null, x, y, ang: i / 8 * TAU, speed: 170, len: R * .9, w: 8, el: 'frost', hit: { amount: dmg * .4, kb: 40 } });
      sfx('freeze'); P.glints(x, y, 10, 14, '#e8fbff', 30); shake(3);
    } });
  },
  draw(m, r) {
    const s = m.scale || 1, t = game.time, H = (m.head || 20) * s;
    r.decal(() => { r.groundRing(m.x, m.y, m.r * s + 5, '#bfefff', .55); r.groundDisc(m.x, m.y, m.r * s + 4, '#7fd8ff', .16); }, { emissive: .5 });
    for (let i = 0; i < 3; i++) {   // ice shards orbiting it
      const a = t * 1.8 + i * TAU / 3 + m.ph, x = m.x + Math.cos(a) * (m.r * s + 6), y = m.y + Math.sin(a) * (m.r * s + 6), z = m.z + H * .55 + Math.sin(t * 3 + i) * 3;
      r.queue(x, y, z, g => { const [sx, sy] = r.w(x, y, z), k = (r.view.zoom || 1); px.glow(g, 1); px.poly(g, [[sx, sy - 3 * k], [sx + 1.6 * k, sy], [sx, sy + 3 * k], [sx - 1.6 * k, sy]], '#9fe8ff'); px.line(g, sx, sy - 3 * k, sx, sy + 2 * k, '#ffffff'); }, { emissive: foeGlowSeen(x, y, z) });
    }
    L.add(m.x, m.y, 12, 44, .5, { color: '#9fe8ff' });
  } });

def('affixes', 'shocking', { name: 'Shocking', color: '#ffe45a', minDepth: 2,
  update(m, dt) { if (Math.random() < dt * 4) P.sparks(m.x + (Math.random() - .5) * 8, m.y + (Math.random() - .5) * 8, (m.head || 20) * (m.scale || 1) * (.3 + Math.random() * .5), 1, null, { color: '#ffe45a', hot: '#ffffff' }); },
  onHurt(m, hit) {   // struck, it arcs lightning back at whoever stands near
    if (!hit.src || hit.src.team !== 'hero' || game.time - (m.MON_zapT || 0) < .6) return;
    m.MON_zapT = game.time; FX.chain({ team: 'foe', src: m, from: m, hops: 2, range: 80, el: 'storm', hit: { amount: m.dmg * .45, kb: 20, statusChance: .5 } });
    P.sparks(m.x, m.y, 14, 8, null, { color: '#ffe45a', hot: '#ffffff' });
  },
  draw(m, r) {
    const s = m.scale || 1, H = (m.head || 20) * s, seed = Math.floor(game.time * 14);
    if ((seed + (m.ph * 10 | 0)) % 3 === 0) r.queue(m.x, m.y, m.z + H * .5, g => {   // little arcs crawl over it
      const [x0, y0] = r.w(m.x - 4 * s, m.y, m.z + H * (.3 + E.hash2(seed, 1) * .5)), [x1, y1] = r.w(m.x + 4 * s, m.y, m.z + H * (.3 + E.hash2(seed, 2) * .5));
      px.glow(g, 1); zig(g, x0, y0, x1, y1, '#ffe45a', 1, 3, seed); px.dot(g, x1, y1, '#ffffff');
    }, { emissive: foeGlowSeen(m.x, m.y, m.z + H * .5), bias: .5 });
    L.add(m.x, m.y, 12, 40, .4 + .3 * Math.random(), { color: '#ffe45a' });
  } });

def('affixes', 'teleporter', { name: 'Teleporting', color: '#c890ff', minDepth: 4,
  apply(m) { m.MON_tpT = 2 + Math.random() * 2; },
  update(m, dt) {
    if (m.MON_bl) { MON_blinkStep(m, dt); return; }
    const h = ED.hero; m.MON_tpT -= dt;
    if (m.boss || m.MON_tpT > 0 || !m.ai.aware || !h || !h.alive || m.atk || m.stunT > 0) return;
    const d = Math.hypot(h.x - m.x, h.y - m.y), s = d > 50 && d < 230 ? MON_spot(h.x, h.y, 24, 34, h.facing + Math.PI, 1.3) : null;   // it likes to arrive behind him
    if (s) { MON_blinkStart(m, s[0], s[1], { color: '#c890ff' }); m.MON_tpT = (4.5 + Math.random() * 2.5) / MON_dose(m); } else m.MON_tpT = .6;
  },
  draw(m, r) {
    const s = m.scale || 1, t = game.time, H = (m.head || 20) * s;
    r.queue(m.x, m.y, m.z + H * .5, g => { px.glow(g, 1); for (let i = 0; i < 4; i++) { const a = t * 3 + i * TAU / 4 + m.ph, [x, y] = r.w(m.x + Math.cos(a) * (m.r * s + 5), m.y + Math.sin(a) * (m.r * s + 5), m.z + H * (.3 + .4 * ((i % 2) ? Math.sin(t * 2) * .5 + .5 : Math.cos(t * 2) * .5 + .5))); px.dot(g, x, y, i % 2 ? '#e8d0ff' : '#b070ff'); } }, { emissive: foeGlowSeen(m.x, m.y, m.z + H * .5) });
    r.decal(() => r.groundRing(m.x, m.y, m.r * s + 4, '#b070ff', .4 + .2 * Math.sin(t * 4)), { emissive: .5 });
  } });

/** an illusionist's copy: the same look, one hit pops it (no loot, no xp) */
function MON_decoy(m, x, y) {
  const d = spawnMonster(m.kind, x, y, { instant: true, pal: m.pal, el: m.el, level: m.level, scale: m.scale, blob: m.blob ? m.blob.o : undefined, MON_decoy: true, roost: false });
  if (!d) return null;
  d.maxHp = d.hp = 1; d.xp = 0; d.noLoot = true; d.elite = m.elite; d.name = m.name; d.MON_decoy = m; d.ai.aware = true; d.dmg = m.dmg * .3; d.affixes = []; d.facing = m.facing; d.packLead = m.packLead;
  d.onBeforeHit = function () { MON_pop(this); return 0; };
  return d;
}
function MON_pop(d) {
  if (!d.alive) return;
  d.elite = 0; d.gone = true; P.smoke(d.x, d.y, 8, 5, { size: 4, color: '#8a6ab0', dark: '#4a3a6a', light: '#d8b0ff' }); P.glints(d.x, d.y, 12, 8, '#d8b0ff', 14); P.ring(d.x, d.y, 3, 16, '#d8b0ff', .3); sfx('monPop', { vol: .5 });
  killUnit(d, { src: null, el: 'void', amount: 1, tags: ['pop'] });
}
def('affixes', 'illusionist', { name: 'Illusionist', color: '#d8b0ff', minDepth: 4, ok: A0 => !['bloater', 'mireslime'].includes(A0.id) && !A0.noPack,
  apply(m) { m.MON_decT = 1.2; m.MON_decoys = []; },
  update(m, dt) {
    if (m.MON_decoy || m.boss || !REG.affixes.illusionist.ok(m.arch)) return;   // bosses keep their dignity (and their size)
    const ds = m.MON_decoys = m.MON_decoys.filter(d => d.alive), most = m.elite ? 2 : 1;
    for (const u of [m, ...ds]) if (Math.random() < dt * 2.5) P.glints(u.x, u.y, (u.head || 20) * (u.scale || 1) * .6, 1, '#d8b0ff', 12);   // the same shimmer on it and its copies
    if (!m.ai.aware || (m.MON_decT -= dt) > 0) return;
    if (ds.length >= most || ED.foes.filter(u => u.MON_decoy && u.alive).length >= 10) { m.MON_decT = 2; return; }
    m.MON_decT = 8 + Math.random() * 3; P.smoke(m.x, m.y, 8, 4, { size: 4, color: '#8a6ab0', dark: '#4a3a6a', light: '#d8b0ff' }); sfx('monBlink', { vol: .4, pitch: .8 });
    for (let i = ds.length; i < most; i++) { const s = MON_spot(m.x, m.y, 14, 26); if (s) { const d = MON_decoy(m, s[0], s[1]); if (d) { ds.push(d); P.ring(d.x, d.y, 3, 14, '#d8b0ff', .3); } } }
    if (ds.length && Math.random() < .7) { const d = rnd.pick(ds), x = m.x, y = m.y; m.x = d.x; m.y = d.y; d.x = x; d.y = y; P.ring(m.x, m.y, 14, 3, '#d8b0ff', .3); }   // and trades places with one
  },
  onDie(m) { for (const d of m.MON_decoys || []) if (d.alive) MON_pop(d); } });

def('affixes', 'molten', { name: 'Molten', color: '#ff6a2a', minDepth: 5, ok: A0 => A0.id !== 'bloater',
  apply(m) { m.res.fire = Math.max(m.res.fire || 0, .6); },
  update(m, dt) {
    const s = m.scale || 1;
    if (Math.random() < dt * 5) P.add({ kind: 'fire', x: m.x + (Math.random() - .5) * m.r * 1.6, y: m.y + (Math.random() - .5) * m.r * 1.6, z: (m.head || 20) * s * (.3 + Math.random() * .4), vz: -20, g: 220, max: .4, size: 1.5 });   // lava drips off it
    if (Math.random() < dt * 4) P.add({ kind: 'ember', x: m.x, y: m.y, z: (m.head || 20) * s * .8, vx: (Math.random() - .5) * 20, vy: (Math.random() - .5) * 20, vz: 26, max: .9, color: '#ff6a2a' });
  },
  onDie(m) {   // it cracks open: a warning ring, then it blows
    if (m.arch.id === 'bloater' || m.MON_decoy) return;
    const x = m.x, y = m.y, R = 40 * (m.scale || 1), dmg = m.dmg * MON_dose(m); sfx('charge', { vol: .35, pitch: .7 });
    FX.visual(1, (r, u) => { r.queue(x, y, 6, g => { const [sx, sy] = r.w(x, y, 6), k = (r.view.zoom || 1) * (1 + u * .8), fl = Math.sin(u * u * 90) > 0; px.glow(g, 1); r.glowDisc(g, sx, sy, 5 * k, '#ff6a2a', .4 + .3 * u); px.disc(g, sx, sy, 1.3 * k, fl ? '#ffffff' : '#ffd36a'); for (let i = 0; i < 5; i++) { const a = i * 1.26 + x; px.line(g, sx, sy, sx + Math.cos(a) * 4 * k * u, sy + Math.sin(a) * 2.4 * k * u, '#ffb040'); } }, { emissive: foeGlowSeen(x, y, 6), bias: .6 }); L.add(x, y, 8, 40 + 50 * u, 1, { color: '#ff7a2a' }); if (Math.random() < .5) P.add({ kind: 'ember', x, y, z: 6, vx: (Math.random() - .5) * 40, vy: (Math.random() - .5) * 40, vz: 40, max: .5, color: '#ff8a3a' }); });   // a glowing core with cracks of light spreading out of it
    FX.telegraph({ shape: 'circle', x, y, r: R, dur: 1, then() {
      FX.nova({ team: 'foe', src: null, x, y, r0: 6, r1: R, dur: .3, el: 'fire', hit: { amount: dmg * 1.8, kb: 200, statusChance: .8 } });
      P.explosion(x, y, 6, 1.5, { flash: false }); FX.scorch(x, y, R * .6); FX.area({ team: 'foe', src: null, x, y, r: R * .5, dur: 2.5, tick: .5, el: 'fire', hit: { amount: dmg * .2 } }); shake(6);
    } });
  },
  draw(m, r) {
    const s = m.scale || 1, H = (m.head || 20) * s, p = .5 + .5 * Math.sin(game.time * 5 + m.ph);
    r.queue(m.x, m.y, m.z + H * .45, g => { const [x, y] = r.w(m.x, m.y, m.z + H * .45), k = r.view.zoom || 1; px.glow(g, 1); r.glowDisc(g, x, y, (3.5 + 1.5 * p) * k * s, '#ff5a1a', .25 + .15 * p); px.blend(g, .5 + .3 * p, 'add', () => { px.dot(g, x - 1, y, '#ffd36a'); px.dot(g, x + 1, y - 2, '#ff8a3a'); px.dot(g, x, y + 2, '#ff8a3a'); }); }, { emissive: foeGlowSeen(m.x, m.y, m.z + H * .45), bias: .5 });
    r.decal(() => r.groundDisc(m.x, m.y, m.r * s + 3, '#ff3a0a', .18 + .12 * p), { emissive: .7 });
    L.add(m.x, m.y, 10, 50, .6 + .3 * p, { color: '#ff6a2a' });
  } });

/** the shielded affix's bubble: soaks damage until it breaks, then regrows once it has been left alone a while */
function MON_bubble(hit, amt) {
  const s = this.MON_sh; if (!s || s.v <= 0 || MON_tag(hit, 'floor')) return amt;
  const take = Math.min(amt, s.v); s.v -= take; s.t = 0; s.hitT = .15;
  if (game.time - (s.fx || 0) > .08) { s.fx = game.time; P.glints(this.x, this.y, (this.head || 20) * .5, 2, '#bff6ff', 10); sfx('monAbsorb', { vol: .35 }); if (OPT.numbers) P.text(this.x, this.y, (this.head || 20) * (this.scale || 1) + 6, fmt(take), '#8ad8ff'); }
  if (s.v <= 0) { sfx('monShatter'); P.bits(this.x, this.y, 12, 16, ['#e8fbff', '#8ad8ff', '#bff6ff']); P.ring(this.x, this.y, 4, 24, '#bff6ff', .35); P.glints(this.x, this.y, 14, 8, '#ffffff', 16); game.freeze(.04); MON_say(this, 'SHIELD DOWN', '#8ad8ff'); }
  return amt - take;
}
def('affixes', 'shielded', { name: 'Shielded', color: '#8ad8ff', minDepth: 3,
  apply(m) { const mx = m.maxHp * .45; m.MON_sh = { v: mx, max: mx, t: 9, hitT: 0 }; MON_guard(m, MON_bubble); },
  update(m, dt) {
    const s = m.MON_sh; s.t += dt; s.hitT -= dt;
    if (s.v < s.max && s.t > 4) { const was = s.v; s.v = Math.min(s.max, s.v + s.max * .4 * dt); if (was <= 0) { sfx('monAbsorb', { pitch: .6 }); P.ring(m.x, m.y, 4, m.r * (m.scale || 1) + 10, '#bff6ff', .4); } }
  },
  draw(m, r) {
    const s = m.MON_sh; if (s.v <= 0) return;
    const sc = m.scale || 1, H = (m.head || 20) * sc, z = m.z + H * .5, k = s.v / s.max, hit = s.hitT > 0, t = game.time;
    r.queue(m.x, m.y, z, g => {
      const [x, y] = r.w(m.x, m.y, z), rad = Math.max(m.r * sc + 3, H * .42) * r.view.scale, ry = rad * 1.12;
      px.glow(g, 1);
      px.blend(g, (hit ? .2 : .06) + .06 * k, 'add', () => px.ell(g, x, y, rad, ry, '#2a70b0'));
      px.blend(g, .5 + .4 * k, 'add', () => { MON_circle(g, x, y, rad, ry, hit ? '#ffffff' : '#8ad8ff', Math.round(rad * 3)); MON_circle(g, x, y, rad * .96, ry * .4, '#4ab8ff', Math.round(rad * 2), t % TAU, Math.PI); });
      for (let i = 0; i < 3; i++) { const a = -2.3 + i * .18; px.dot(g, x + Math.cos(a) * rad * .8, y + Math.sin(a) * ry * .8, '#ffffff'); }   // a highlight up on the lit side
    }, { emissive: foeGlowSeen(m.x, m.y, z), bias: .5 });
  } });

def('affixes', 'plagued', { name: 'Plagued', color: '#8ae04a', minDepth: 2,
  apply(m) { m.res.venom = Math.max(m.res.venom || 0, .5); m.MON_plT = 2 + Math.random() * 2; },
  update(m, dt) {
    if (Math.random() < dt * 4) P.add({ kind: 'dust', x: m.x + (Math.random() - .5) * 10, y: m.y + (Math.random() - .5) * 10, z: (m.head || 20) * (m.scale || 1) * Math.random(), vz: 8, g: -4, drag: 2, max: .8, size: 1.8, color: '#8ae04a' });
    const h = ED.hero; if (!m.ai.aware || !h || !h.alive || (m.MON_plT -= dt) > 0) return;
    m.MON_plT = (3.2 + Math.random() * 1.5) / MON_dose(m);
    const at = m.elite && Math.random() < .55 && Math.hypot(h.x - m.x, h.y - m.y) < 140 ? [h.x, h.y] : [m.x, m.y], dmg = m.dmg;   // on him (warned), or around itself
    FX.telegraph({ shape: 'circle', x: at[0], y: at[1], r: 24, dur: .7, then() {
      FX.area({ team: 'foe', src: null, x: at[0], y: at[1], r: 24, dur: 4, tick: .5, el: 'venom', hit: { amount: dmg * .25, statusChance: .8, statusPower: dmg * .15 }, light: false,
        onTick: f => { if (f.t < f.dur - .6) P.smoke(f.x + (Math.random() - .5) * f.r, f.y + (Math.random() - .5) * f.r, 2, 2, { size: 5, color: '#6a8a3a', dark: '#3a4a1a', light: '#a8d070' }); } });
      sfx('monSplat', { vol: .3, pitch: 1.6 });
    } });
  },
  draw(m, r) { const s = m.scale || 1; r.decal(() => r.groundDisc(m.x, m.y, m.r * s + 5, '#5a8a2a', .25 + .1 * Math.sin(game.time * 3 + m.ph)), { emissive: .3 }); } });

/** berserk: past 40% life it roars and grows, reddens, hastens and hits harder */
function MON_redden(m) {
  const R = '#e02a1a';
  if (m.rig) { const C = m.rig.C; for (const k of ['cloth', 'skin', 'cape', 'coat', 'pants', 'hair', 'bone']) if (C[k]) C[k] = E.mix(C[k], R, .38); m.rig.o.eyeGlow = '#ff3a2a'; }
  if (m.blob) { const C = m.blob.C; for (const k of ['base', 'dk', 'lt', 'wing']) if (C[k]) C[k] = E.mix(C[k], R, .38); }
}
def('affixes', 'berserk', { name: 'Berserk', color: '#ff3a3a', minDepth: 3,
  update(m, dt) {
    const b = m.MON_rage;
    if (!b) {
      if (m.hp < m.maxHp * .4) {
        m.MON_rage = { t: 0, s0: m.scale || 1, r0: m.rig ? m.rig.o.size : 0, b0: m.blob ? m.blob.scale : 0 }; MON_redden(m); m.speed *= 1.2; m.dmg *= 1.25;
        sfx('roar', { vol: .4, pitch: 1.3 }); shake(3); P.ring(m.x, m.y, 4, 30, '#ff3a2a', .4); MON_say(m, 'ENRAGED', '#ff5a4a');
      }
      return;
    }
    b.t += dt; const k = m.boss ? 1 : 1 + .25 * E.ease.outQuad(Math.min(1, b.t / .45)) + (b.t < .45 ? Math.sin(b.t * 40) * .02 : 0);   // bosses are big enough already
    m.scale = b.s0 * k; if (m.rig) m.rig.o.size = b.r0 * k; if (m.blob) m.blob.scale = b.b0 * k;
    if (!m.st.haste || m.st.haste.t < .5) applyStatus(m, 'haste', 0);
    if (Math.random() < dt * 10) P.add({ kind: 'dust', x: m.x + (Math.random() - .5) * 8, y: m.y + (Math.random() - .5) * 8, z: (m.head || 20) * m.scale * (.5 + Math.random() * .5), vz: 22, g: -6, drag: 2, max: .5, size: 1.6, color: '#ff4a3a' });
  },
  draw(m, r) { if (!m.MON_rage) return; const s = m.scale || 1, p = Math.sin(game.time * 12); r.decal(() => { r.groundDisc(m.x, m.y, m.r * s + 5, '#ff2a1a', .25 + .12 * p); r.groundRing(m.x, m.y, m.r * s + 7, '#ff6a4a', .5); }, { emissive: .7 }); L.add(m.x, m.y, 12, 46, .6, { color: '#ff3a2a' }); } });

def('affixes', 'vortex', { name: 'Vortex', color: '#b070ff', minDepth: 5,
  apply(m) { m.MON_vxT = 2 + Math.random() * 2; },
  update(m, dt) {
    const h = ED.hero; if (!h || !h.alive) { m.MON_vx = null; return; }
    const v = m.MON_vx, d = Math.hypot(h.x - m.x, h.y - m.y);
    if (v) {   // a swirl warns around him, then it drags him in
      v.t += dt;
      if (v.t < .65) { if (Math.random() < .6) { const a = Math.random() * TAU; P.add({ kind: 'ember', x: h.x + Math.cos(a) * 18, y: h.y + Math.sin(a) * 18, z: 2, vx: -Math.sin(a) * 60, vy: Math.cos(a) * 60, vz: 10, drag: 2, max: .4, color: '#b070ff' }); } }
      else if (v.t < 1.35) {
        if (d > m.r + h.r + 12) { const a = Math.atan2(m.y - h.y, m.x - h.x); h.drift = [Math.cos(a) * 150, Math.sin(a) * 150]; }
        if (Math.random() < .8) { const u = Math.random(); P.add({ kind: 'ember', x: lerp(h.x, m.x, u), y: lerp(h.y, m.y, u), z: 6 + Math.random() * 8, vx: (m.x - h.x) * 1.5, vy: (m.y - h.y) * 1.5, max: .25, color: Math.random() < .5 ? '#b070ff' : '#e8d0ff' }); }
      } else m.MON_vx = null;
      return;
    }
    m.MON_vxT -= dt;
    if (m.MON_vxT <= 0 && m.ai.aware && m.stunT <= 0) { if (d > 44 && d < 150 && game.time > MON_VX.until && MON_los(m, h)) { m.MON_vx = { t: 0 }; MON_VX.until = game.time + 1.6; m.MON_vxT = (7 + Math.random() * 3) / MON_dose(m); sfx('monVortex', { vol: .5 }); } else m.MON_vxT = .5; }
  },
  draw(m, r) {
    const s = m.scale || 1, t = game.time, v = m.MON_vx, h = ED.hero;
    r.decal(() => { for (let k = 0; k < 2; k++) r.groundArc(m.x, m.y, m.r * s + 3 + k * 4, m.r * s + 5 + k * 4, t * 4 + k * 3, t * 4 + k * 3 + 2, '#b070ff', .5); }, { emissive: .6 });
    if (!v || !h) return;
    if (v.t < .65) r.decal(() => { const u = v.t / .65; for (let k = 0; k < 3; k++) r.groundArc(h.x, h.y, 8 + k * 6, 10 + k * 6, -t * 6 + k * 2, -t * 6 + k * 2 + 2.2, '#b070ff', .3 + .5 * u); }, { emissive: .7 });
    else r.queue(m.x, m.y, 12, g => { const [x0, y0] = r.w(m.x, m.y, m.z + 12), [x1, y1] = r.w(h.x, h.y, 12); px.glow(g, 1); zig(g, x0, y0, x1, y1, '#b070ff', 2, 4, m.ph * 99 | 0); zig(g, x0, y0, x1, y1, '#e8d0ff', 1, 4, m.ph * 99 | 0); }, { emissive: true, bias: 1 });
    L.add(m.x, m.y, 10, 50, .6, { color: '#b070ff' });
  } });
