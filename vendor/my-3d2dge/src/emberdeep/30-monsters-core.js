/* =============================================================================
 * MONSTERS: the runtime, the shared AI, elite affixes, packs, and the stress test's crowd
 * An ARCHETYPE is def('archetypes', id, {
 *   name, tags, minDepth, weight, el (natural element), hp, dmg, speed, r, xp, head, mass, armor, res: { fire: .5 },
 *   body: 'humanoid' | 'blob' | 'wisp' | (m) => custom body { update(dt, s), draw(g, ox, oy, view) },
 *   rig: Humanoid options, blob: Blob options, palettes: [colors, ...] (one is picked and hue-shifted per depth),
 *   ai: an id in REG.ai ('melee', 'pouncer', 'orb', ...) or (m, dt) => {},
 *   attacks: [{ move: 'claw', over: { ... }, dmg: 1, wind: 2 (x the move's wind), kind: 'melee' }]  (melee AI),
 *   shot: { every, speed, dmg, look, spread, n } (ranged AIs), onSpawn(m), update(m, dt), onDie(m, hit), draw(m, r)
 * })
 * A MONSTER is a unit (see 10-combat.js) plus { arch, kind, level, elite: 0 | 1 champion | 2 rare | 3 boss, affixes,
 * pal, rig | blob | body, ai: {}, atk, cool, spawnT, name }.
 * An ELITE AFFIX is def('affixes', id, { name, color, minDepth, apply(m), update(m, dt), onHit(m, tgt, hit), onDie(m), draw(m, r) }).
 * ============================================================================= */
const MOVE_FIX = {   // monster takes on E.MOVES (from the stress test), so each reads at game size
  claw: { plane: 'side', a0: 1.5, a1: -1.2, reach: 7, crouch: .5, lean: .45, hold: .45 },
  slash: { a0: 2.1, z0: 1, twist: 1.8, crouch: .4 },
  hook: { a1: -1, reach: 6.6, lunge: .8, lean: .1, twist: 2.4, hold: .12 },
  haymaker: { hold: .55 },
  bash: { reach: 6, hop: 1.8, lean: .6, crouch: .5 },
  overhead: { a0: 2.4 - TAU, a1: -1.25 - TAU, twist: 0 }
};
/** a monster attack spec: the move with the monster's fixes, a slower telegraphed wind-up and a longer recovery. The
 *  wind-up never drops under .36 s (.42 s for heavy bodies, mass 2+): long enough to see the red arc grow and roll */
function foeSpec(a, arch) {
  const sp = new E.Attack(a.move, Object.assign({}, MOVE_FIX[a.move] || {}, a.over || {})).spec;
  return Object.assign(sp, { wind: TUNE.windUp * Math.max(arch && (arch.mass || 1) >= 2 ? .42 : .36, sp.wind * (a.wind || 2.2)), recover: sp.recover + (a.recover === undefined ? .14 : a.recover) });
}
const strikePt = (rig, spec) => rig.o.weapon && spec.blade !== 0 && spec.hand !== 'L' ? rig.tip() : rig.hand(spec.hand === 'L' ? 'L' : 'R');
/** measure each attack once on a spare rig: how far its strike reaches and where the monster should stand for it */
function measureAttacks(arch) {
  if (arch._measured || !arch.attacks) return; arch._measured = true;
  const size = (arch.rig && arch.rig.size) || 1;
  for (const a of arch.attacks) {
    a.spec = foeSpec(a, arch);
    if (arch.body !== 'humanoid' && arch.body !== undefined) { a.reach = a.reach || 14; a.stand = a.stand || 12; continue; }
    const rig = new E.Humanoid(arch.rig || {}); let far = 0, head = 0;
    for (let u = 0; u <= 1; u += .1) { rig.update(1, { x: 0, y: 0, stance: arch.stance, attack: { spec: a.spec, phase: 'active', u } }); far = Math.max(far, strikePt(rig, a.spec)[0]); head = Math.max(head, rig.head()[0]); }
    a.reach = far; a.stand = Math.max(far + 4.5 - 1.5, head + 8.5 * size);
  }
}

/* ---------- making monsters ---------- */
const ELITE_NAMES = { a: ['Gor', 'Vel', 'Mor', 'Kra', 'Ash', 'Bal', 'Dra', 'Esk', 'Fen', 'Grim', 'Hul', 'Ith', 'Kel', 'Lor', 'Nak', 'Ov', 'Rath', 'Sul', 'Thar', 'Ul', 'Vor', 'Zer'], b: ['ak', 'eth', 'grim', 'moth', 'rak', 'vel', 'zul', 'dor', 'gash', 'mir', 'nok', 'rus', 'thul', 'ven', 'xis'], c: ['the Hollow', 'the Unbound', 'Bonegnaw', 'the Starved', 'Ashmaw', 'the Pale', 'Gloomcaller', 'the Rotten', 'Grimhide', 'the Weeping', 'Doomhand', 'the Blind', 'Emberbane', 'the Thrice-Slain'] };
function eliteName(R) { return R.pick(ELITE_NAMES.a) + R.pick(ELITE_NAMES.b) + ' ' + R.pick(ELITE_NAMES.c); }
/** the palette for a monster: one of the archetype's, hue-shifted for deep levels and tinted by element */
function foePalette(arch, R, depth, el) {
  const base = arch.palettes ? R.pick(arch.palettes) : {};
  const L0 = ED.L, deg = L0 && L0.hue ? L0.hue * .6 : 0;
  let pal = shiftPal(base, deg);
  if (el && el !== 'phys' && arch.elTint !== false) { const e = EL(el); for (const k of arch.elKeys || ['cloth', 'cape', 'base', 'eye']) if (pal[k]) pal[k] = E.mix(pal[k], e.color, .45); pal.eyeGlow = e.light; }
  return pal;
}
function spawnMonster(id, x, y, o = {}) {
  const arch = REG.archetypes[id]; if (!arch) { E.warn('ed:arch:' + id, 'EMBERDEEP: no archetype "' + id + '"'); return null; }
  measureAttacks(arch);
  const depth = o.level || ED.depth || 1, R = o.rng || rnd, elite = o.elite || 0, el = o.el || arch.el || 'phys';
  const eK = (b, k) => 1 + (b - 1) * k;   // (Tuning scales an elite's extra life and damage)
  const hpK = SCALE.foeHp(depth) * DIFF.foeHp * eK([1, 2.6, 4.2, 1][elite], TUNE.eliteHp) * (o.hpMul || 1), dmgK = SCALE.foeDmg(depth) * eK([1, 1.25, 1.45, 1][elite], TUNE.eliteDmg) * (o.dmgMul || 1);
  const m = {
    team: 'foe', arch, kind: id, name: arch.name, x, y, z: 0, vx: 0, vy: 0, vz: 0, r: arch.r || 5, alive: true, spawnT: o.instant ? 0 : .6, facing: R() * TAU,
    st: {}, res: Object.assign({}, arch.res || {}), armor: (arch.armor || 0) * (1 + depth * TUNE.foeArmorGrowth), head: arch.head || 28, mass: arch.mass || 1,
    level: depth, el, elite, affixes: [], dmg: arch.dmg * dmgK, speed: (arch.speed || 30) * (1 + Math.min(TUNE.foeSpeedCap, depth * TUNE.foeSpeedGrowth)) * (.9 + R() * .2),   // (DIFF.foeSpeed runs its whole clock: updateFoes)
    xp: (arch.xp || 10) * SCALE.foeXp(depth) * [1, 3, 6, 25][elite], ai: {}, atk: null, cool: R() * 1.5, next: 0, flash: 0, ph: R() * TAU, tok: false, kbT: 0, stunT: 0,
    canFly: !!arch.flies, scale: o.scale || (elite === 2 ? 1.12 : 1)
  };
  m.maxHp = m.hp = Math.round(arch.hp * hpK);
  if (el !== 'phys') m.res[el] = Math.max(m.res[el] || 0, .4);
  m.pal = o.pal || foePalette(arch, R, depth, el);
  makeBody(m, o);
  m.react = foeReact; m.onDie = foeDie;
  if (!elite && o.affixes) for (const id2 of o.affixes) addAffix(m, id2);   // deep packs: normal monsters that share an affix
  if (elite) {
    m.name = o.name || (elite === 2 ? eliteName(R) : arch.name);
    const pool = Object.values(REG.affixes).filter(a => (a.minDepth || 1) <= depth && (!a.ok || a.ok(arch)));
    const ids = o.affixes || (elite === 3 ? [] : R.shuffle(pool.slice()).slice(0, elite === 2 ? Math.max(0, Math.min(3, 1 + Math.floor(depth / 6)) + TUNE.eliteAffixes) : 1).map(a => a.id));   // bosses bring their own tricks
    for (const id2 of ids) addAffix(m, id2);
    if (elite === 1) m.name = REG.affixes[m.affixes[0]] ? REG.affixes[m.affixes[0]].name + ' ' + arch.name : arch.name;
  }
  if (arch.onSpawn) arch.onSpawn(m, o);
  ED.foes.push(m); BUS.emit('spawn', { m });
  return m;
}
function addAffix(m, id) { const a = REG.affixes[id]; if (!a || m.affixes.includes(id)) return; m.affixes.push(id); if (a.apply) a.apply(m); }
function makeBody(m, o) {
  const arch = m.arch, b = arch.body || 'humanoid';
  if (typeof b === 'function') { m.body = b(m, o); return; }
  if (b === 'humanoid') {
    const ro = Object.assign({}, arch.rig || {}, { colors: Object.assign({}, (arch.rig && arch.rig.colors) || {}, m.pal), size: ((arch.rig && arch.rig.size) || 1) * m.scale });
    if (m.pal.eyeGlow) ro.eyeGlow = m.pal.eyeGlow;
    if (arch.cape === true) ro.cape = { len: 5, width: 4, seg: 2.3 };
    m.rig = new E.Humanoid(ro); m.rig.update(0, { x: m.x, y: m.y, facing: m.facing }); return;
  }
  if (b === 'blob') { m.blob = new E.Blob(Object.assign({ R: 6.2, face: 'front' }, arch.blob || {}, o.blob || {}, { colors: Object.assign({}, (arch.blob && arch.blob.colors) || {}, m.pal) })); m.blob.scale = m.scale; return; }
}

/* ---------- reactions and death ---------- */
function foeReact(hit) {
  const m = this;
  // the hit flash. A boss or an elite takes many light hits a second, and a full-body flash on each hid its palette under a
  // white strobe: every hit flares only its outline (rimT), and the whole body flashes (briefly) only on a crit or a blow
  // worth 3% of its life, at most every .22 s
  if (m.boss || m.elite) { m.rimT = .08; if ((hit.crit || (hit.dmg || 0) > m.maxHp * .03) && game.time - (m.flashAt || -9) > .22) { m.flashAt = game.time; m.flash = hit.crit ? .07 : .05; } }
  else m.flash = hit.crit ? .09 : .06;
  const stag = m.boss ? 0 : m.arch.stagger === false ? 0 : 1;
  if (stag && (hit.kb || 0) > 20) { knock(m, hit.ang !== undefined ? hit.ang : angTo(hit.src || m, m), hit.kb, hit.up || 0); m.kbT = .25; }
  if (stag && !m.st.freeze) {
    // poise: a hit with weight (or a stun) staggers, but at most 3 times a second (2 for an elite), so a flurry of
    // light hits can't pin a monster forever; every hit still makes it flinch
    if ((hit.kb || 0) > 20 || hit.stun) {
      if (game.time - (m.stagT0 || -9) > 1) { m.stagT0 = game.time; m.stagN = 0; }
      if (m.stagN++ < (m.elite ? 2 : 3)) {
        m.stunT = Math.max(m.stunT || 0, hit.kb > 150 ? .3 : .18);
        if (m.atk && m.atk.phase === 'wind' && (hit.kb || 0) > 60) { m.atk = null; m.cool = .4; }   // a solid hit interrupts a wind-up (and frees its turn)
      }
    }
    if (m.rig) m.rig.kick(2.5); else if (m.blob) m.blob.kick(5); else if (m.body && m.body.kick) m.body.kick(3);
  }
  if (m.arch.react) m.arch.react(m, hit);
  for (const id of m.affixes) { const a = REG.affixes[id]; if (a && a.onHurt) a.onHurt(m, hit); }
}
function foeDie(hit) {
  const m = this;
  m.deadT = 0; m.atk = null;
  // an overkill (a hit far bigger than the life left) throws the body: it flies back, spinning into its fall. The throw
  // sets the speed along the blow (the hit's own knockback is already in vx, vy: it is topped up, never stacked), and a
  // corpse never flies faster than 150 (a few tiles, so the fall happens on screen, not off it)
  if (hit && hit.dmg > m.maxHp * .45 && !m.boss && !m.canFly && hit.ang !== undefined) {
    const c = Math.cos(hit.ang), s = Math.sin(hit.ang), k = Math.min(150, 90 + hit.dmg / m.maxHp * 25) / Math.sqrt(Math.max(1, m.mass || 1)), along = m.vx * c + m.vy * s;
    if (along < k) { m.vx += c * (k - along); m.vy += s * (k - along); }
    m.vz = Math.max(m.vz || 0, 55 + Math.random() * 35); m.z = Math.max(m.z, .5);
  }
  if (!m.boss) { const v = Math.hypot(m.vx, m.vy), cap = (m.canFly ? 80 : 150) / Math.sqrt(Math.max(1, m.mass || 1)); if (v > cap) { m.vx *= cap / v; m.vy *= cap / v; } }   // a flyer drops out of the air (it is not thrown)
  if (hit && hit.noGore || m.noGore) {}
  else if (m.rig) P.bits(m.x, m.y, 8, 6, [m.rig.C.skin, m.rig.C.cloth, m.rig.C.boot]);
  else if (m.blob) { const c = m.blob.C; P.bits(m.x, m.y, m.z + 6, 12, [c.base, c.lt, c.dk]); P.ring(m.x, m.y, 3, 22, c.lt, .3); }
  for (const id of m.affixes) { const a = REG.affixes[id]; if (a && a.onDie) a.onDie(m, hit); }
  if (m.arch.onDie) m.arch.onDie(m, hit);
  ED.stats.kills++;
  if (ED.hero) { gainXp(ED.hero, m.xp); ED.hero.kills = (ED.hero.kills || 0) + 1; }
  if (m.elite) { sfx('explode', { vol: .4 }); P.glints(m.x, m.y, 16, 10, m.elite === 2 ? '#ffd36a' : '#6a9aff'); }
}

/* ---------- shared AI helpers ---------- */
const AI = {
  tokens: 0, nextTurn: 0, shotNext: 0,
  maxAttackers: () => Math.round(Math.min(8, 3 + Math.floor((ED.depth || 1) / 4)) * TUNE.maxAttackers),
  /** attack turns: a few monsters attack at once, each new wind-up a moment after the last, so every hit has a readable author */
  takeTurn(m) { if (AI.tokens >= AI.maxAttackers() || game.time < AI.nextTurn || !ED.hero || !ED.hero.alive) return false; AI.tokens++; AI.nextTurn = game.time + .22 * TUNE.turnGap * (.7 + Math.random() * .6) / DIFF.foeSpeed; return true; },
  /** walk direction toward a point around walls (the level's flow field toward the hero; straight when close and in the
   *  open, so a monster round a corner follows the field instead of pressing into the wall) */
  steer(m, tx, ty) { const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy) || 1, fl = ED.L && ED.L.flow; if (!fl || d < 20 || (d < 64 && AI.clear(m, tx, ty))) return [dx / d, dy / d]; return fl.dir(m.x, m.y, tx, ty); },
  /** an open line from a monster to a point (cached a moment per monster: map.los walks the line) */
  clear(m, tx, ty) { const a = m.ai || (m.ai = {}); if (game.time < (a.clrT || 0) && Math.abs(tx - a.clrX) + Math.abs(ty - a.clrY) < 12) return a.clr; a.clrT = game.time + .2 + Math.random() * .1; a.clrX = tx; a.clrY = ty; const map = ED.L && ED.L.map; return (a.clr = !map || map.los(m.x, m.y, tx, ty)); },
  /** is the hero close enough (and seen) for this monster to wake and chase? */
  aware(m, rad = 150) {
    rad *= TUNE.sight; const h = ED.hero; if (!h || !h.alive) return false; if (m.ai.aware) return true;
    const d = Math.hypot(h.x - m.x, h.y - m.y);
    if (d < rad && (d < 60 || !ED.L || !ED.L.map || ED.L.map.los(m.x, m.y, h.x, h.y))) {   // it sees him: the whole pack wakes, and says so
      m.ai.aware = true; for (const o of ED.foes) if (o.pack === m.pack && m.pack) o.ai.aware = true;
      if (game.time - (AI.alertT || -9) > .6) { AI.alertT = game.time; P.text(m.x, m.y, (m.z || 0) + (m.head || 24) * (m.scale || 1) + 8, '!', m.elite ? '#ffd36a' : '#ff6a5a', { scale: 2 }); sfx('blip', { vol: .5, pitch: .7 }); }
    }
    return m.ai.aware;
  },
  face(m, a, dt, k = 6) { m.facing = E.approachAng(m.facing, a, dt * k); },
  move(m, dir, dt, k = 1) { const sp = m.speed * k * statusSpeed(m) * (m.speedK === undefined ? 1 : m.speedK), acc = (m.stunT > 0 || m.kbT > 0 ? 120 : 500) * dt * (m.traction === undefined ? 1 : m.traction); m.vx = approach(m.vx, dir[0] * sp, acc); m.vy = approach(m.vy, dir[1] * sp, acc); },
  /** idle wander near home until the hero comes */
  idle(m, dt) {
    const a = m.ai; a.wt = (a.wt || 0) - dt;
    if (a.wt <= 0) { a.wt = 1.5 + Math.random() * 3; const an = Math.random() * TAU, d = Math.random() < .5 ? 0 : 10 + Math.random() * 24; a.wx = (m.homeX || m.x) + Math.cos(an) * d; a.wy = (m.homeY || m.y) + Math.sin(an) * d; }
    const dx = (a.wx || m.x) - m.x, dy = (a.wy || m.y) - m.y, d = Math.hypot(dx, dy);
    if (d > 3) { AI.move(m, [dx / d, dy / d], dt, .35); AI.face(m, Math.atan2(dy, dx), dt, 4); } else AI.move(m, [0, 0], dt);
  }
};

/* ---- melee (humanoids): wait in a ring around the hero, take turns, wind up with a red arc, lunge, strike ---- */
def('ai', 'melee', { update(m, dt) {
  const h = ED.hero, arch = m.arch, dx = h.x - m.x, dy = h.y - m.y, d = Math.hypot(dx, dy) || 1, toH = Math.atan2(dy, dx), A = m.atk;
  const at = arch.attacks[m.next] || arch.attacks[0], stand = Math.max(at.stand * m.scale, m.r + h.r + 5);
  let mv = [0, 0];
  m.cool -= dt;
  if (!AI.aware(m)) { AI.idle(m, dt); return; }
  if (m.stunT <= 0) {
    if (A) {
      if (A.phase === 'wind') { AI.face(m, toH, dt, 2.5); if (Math.abs(d - stand) > 1) { const s = Math.sign(d - stand); mv = [dx / d * s, dy / d * s]; } }
      if (A.update(dt * statusSpeed(m)) === 'active' && d > stand) { const v = Math.min(70, Math.sqrt(1000 * (d - stand))); m.vx += Math.cos(m.facing) * v; m.vy += Math.sin(m.facing) * v; }
      A.hits([h], t => E.inArc(m, m.facing, t, stand - h.r + 1 + (at.extraReach || 0), at.half || 1.1), () => { if (dealDamage(h, { src: m, amount: m.dmg * (at.dmg || 1), el: at.el || m.el, kb: at.kb || 80, ang: toH, knockdown: at.knockdown })) { P.impact(...strikePt(m.rig || { tip: () => [m.x, m.y, 10], hand: () => [m.x, m.y, 10], o: {} }, A.spec), 6, '#ffb08a'); onFoeHit(m, h); } });
      if (at.onActive && A.phase === 'active' && !A._fired) { A._fired = true; at.onActive(m, A); }
      if (!A.busy) { m.atk = null; m.cool = (at.cool || .8) + Math.random(); m.next = (Math.random() * arch.attacks.length) | 0; }
    } else if (!h.dead) {
      // no turn yet: circle just outside contact distance, facing the hero. Waiters on the camera side stand further back
      const v = game.view, front = Math.max(0, -(dx * v.fx + dy * v.fy) / d) * Math.cos(v.pitch), ring = stand + 8 + 18 * front;
      const sway = Math.sin(game.time * .9 + m.ph);
      mv = d > ring + 3 ? AI.steer(m, h.x, h.y) : d < ring - 3 ? [-dx / d * .5, -dy / d * .5] : [-dy / d * .4 * sway, dx / d * .4 * sway];
      AI.face(m, d > ring + 3 ? Math.atan2(mv[1], mv[0]) : toH + sway * .25, dt, 5);
      if (d < ring + 6 && m.cool <= -1.5 * front && AI.takeTurn(m)) { m.atk = new E.Attack(at.spec); m.atk.start(); }
    }
  }
  AI.move(m, mv, dt);
} });

/* ---- pouncer (slimes): hop to a ring around the hero; with a turn, squash and shiver, then pounce ---- */
const SLIME_G = 480, HOP = { vz: 150, air: 2 * 150 / 480 }, POUNCE = { vz: 85, air: 2 * 85 / 480 }, SLIME_RING = 34;
def('ai', 'pouncer', { update(m, dt) {
  const h = ED.hero, a = m.ai; let dx = h.x - m.x, dy = h.y - m.y, d = Math.hypot(dx, dy) || 1;
  if (!a.state) { a.state = 'idle'; a.t = Math.random(); }
  const awake = AI.aware(m, 130);
  if (m.z <= 0 && m.vz <= 0) {
    m.vx = approach(m.vx, 0, 400 * dt); m.vy = approach(m.vy, 0, 400 * dt);
    if (m.stunT <= 0 && statusSpeed(m) > 0) {
      a.t -= dt * statusSpeed(m);
      if (a.state === 'wind') { m.blob.kick((Math.random() - .5) * 3); m.facing = Math.atan2(dy, dx); }
      if (a.state === 'idle' && a.t <= 0) {
        const turn = awake && Math.abs(d - SLIME_RING) < 8 && AI.takeTurn(m);
        a.state = turn ? 'wind' : 'crouch'; a.t = turn ? .5 : .28; m.facing = Math.atan2(dy, dx);
        if (turn) { m.tok = true; FX.telegraph({ shape: 'arc', x: m.x, y: m.y, r: d - h.r, ang: m.facing, half: .6, dur: .5, owner: m }); }
      } else if ((a.state === 'crouch' || a.state === 'wind') && a.t <= 0) {
        const pounce = a.state === 'wind', jump = pounce ? POUNCE : HOP, out = awake && !pounce && d < SLIME_RING;
        const dir = !awake ? [Math.cos(m.ph + game.time), Math.sin(m.ph + game.time)] : pounce ? [dx, dy] : out ? [-dx, -dy] : AI.steer(m, h.x, h.y), l = Math.hypot(dir[0], dir[1]) || 1;
        const len = pounce ? d - m.r - h.r + 3 : awake ? Math.min(Math.abs(d - SLIME_RING), 44) : 16;
        if (len < 4) { a.state = 'idle'; a.t = .3; }
        else { a.state = pounce ? 'pounce' : 'air'; m.vz = jump.vz; const sp = len / jump.air * Math.max(.5, statusSpeed(m)); m.vx = dir[0] / l * sp; m.vy = dir[1] / l * sp; m.blob.kick(pounce ? 6 : 4.5); }
      }
    }
  }
  if (m.z > 0 || m.vz > 0) { m.vz -= SLIME_G * TUNE.gravity * dt; m.z += m.vz * dt; if (m.z <= 0) { m.z = 0; m.vz = 0; const rest = a.state === 'pounce' ? 1.1 : .45; a.state = 'idle'; a.t = rest + Math.random() * .6; m.blob.kick(-5); m.tok = false; } }
  dx = h.x - m.x; dy = h.y - m.y; d = Math.hypot(dx, dy) || 1;
  if (h.alive && m.z < 6 && d < m.r + h.r + 1 && a.state === 'pounce') { if (dealDamage(h, { src: m, amount: m.dmg, el: m.el, kb: 90, ang: Math.atan2(dy, dx) })) onFoeHit(m, h); a.state = 'air'; m.vx *= -.7; m.vy *= -.7; m.vz = Math.max(m.vz, 90); }
  a.flap = approach(a.flap || 0, m.z > 0 ? 1 : 0, dt * 5);
  const low = a.state === 'crouch' || a.state === 'wind';
  m.blobState = { squash: a.state === 'wind' ? -.42 : low ? -.32 : m.z > 0 ? clamp(m.vz / 600, -.2, .28) : 0, look: [dx, dy], squint: low, flap: a.flap };
} });

/* ---- orb (wisps): hover at range, circle the hero, charge and shoot ---- */
def('ai', 'orb', { update(m, dt) {
  const h = ED.hero, a = m.ai, dx = h.x - m.x, dy = h.y - m.y, d = Math.hypot(dx, dy) || 1, sh = m.arch.shot || {};
  a.t = (a.t || Math.random() * 9) + dt; if (a.orbit === undefined) { a.orbit = Math.random() < .5 ? 1 : -1; a.fire = 1 + Math.random() * 2; }
  let ax = 0, ay = 0;
  const see = AI.clear(m, h.x, h.y);
  if (AI.aware(m, 170) && m.stunT <= 0) {
    if (!see && ED.L && ED.L.flow) { const s = ED.L.flow.dir(m.x, m.y, h.x, h.y); ax = s[0] * 60; ay = s[1] * 60; }   // a wall between: float round it (the level's flow field), never hover pinned behind it
    else { const want = d > (sh.far || 110) ? 1 : d < (sh.near || 70) ? -1 : 0; ax = dx / d * want * 60 + (-dy / d) * a.orbit * 34; ay = dy / d * want * 60 + (dx / d) * a.orbit * 34; }
  }
  const k = statusSpeed(m) * m.speed / 30;
  m.vx += (ax * k - m.vx * 1.6) * dt; m.vy += (ay * k - m.vy * 1.6) * dt;
  m.z = (m.arch.hover || 20) + Math.sin(a.t * 2) * 3;
  if (m.ai.aware && h.alive && m.stunT <= 0 && d < 180 && statusSpeed(m) > 0 && (see || a.charge > 0)) {
    if (a.charge > 0) { a.charge -= dt; if (a.charge <= 0) { const n = sh.n || 1; for (let i = 0; i < n; i++) { const an = Math.atan2(dy, dx) + (n > 1 ? (i / (n - 1) - .5) * (sh.spread || .5) : 0); FX.bolt({ team: 'foe', src: m, x: m.x, y: m.y, z: m.z, ang: an, speed: sh.speed || 95, life: 3, r: 3, el: m.el === 'phys' ? 'void' : m.el, hit: { amount: m.dmg * (sh.dmg || .8), kb: 60 }, look: Object.assign({ kind: 'orb', size: 1.6 }, sh.look || {}), light: 30 }); } sfx('shoot', { vol: .35, pitch: .7 }); a.fire = (sh.every || 2.5) + Math.random() * 2; } }
    else { a.fire -= dt; if (a.fire <= 0 && game.time >= AI.shotNext) { a.charge = .6; AI.shotNext = game.time + (.14 + Math.random() * .1) / DIFF.foeSpeed; } }   // a swarm's shots come one after another, never as one volley
  }
} });

/** when a monster's hit lands on the hero: its affixes react (vampiric heals, burning ignites...) */
function onFoeHit(m, tgt) { for (const id of m.affixes) { const a = REG.affixes[id]; if (a && a.onHit) a.onHit(m, tgt); } if (m.arch.onHit) m.arch.onHit(m, tgt); }

/* ---------- the per-step monster update ---------- */
function updateFoes(dt) {
  const list = ED.foes;
  for (let i = list.length - 1; i >= 0; i--) if (!list[i].alive) ED.corpses.push(list.splice(i, 1)[0]);
  GRID.build(list);
  AI.tokens = 0; for (const m of list) if (m.atk || m.tok || (m.ai && m.ai.state === 'wind')) AI.tokens++;
  const dt0 = dt;
  for (const m of list) {
    // the monster's clock (foeClock): a mechanic may slow it (time wells), the Monster speed slider runs every monster
    // faster or slower: its walk, wind-ups, swings, cooldowns and boss patterns. Its statuses and flashes keep world time
    const tk = m.timeK === undefined ? 1 : m.timeK; dt = dt0 * foeClock(m);
    m.flash -= dt0; m.rimT = (m.rimT || 0) - dt0; m.stunT -= dt; m.kbT -= dt;
    if (m.spawnT > 0) { m.spawnT -= dt; continue; }
    tickStatus(m, dt0 * tk); if (!m.alive) continue;
    // launched into the air (uppercuts, explosions): a ballistic arc, no thinking until it lands
    if (m.air || (m.z > 0 && !m.canFly && m.arch.ai !== 'pouncer' && !(m.boss && m.pat) && !m.leaping)) {
      m.vz -= 520 * TUNE.gravity * dt; m.z += m.vz * dt; m.x += m.vx * dt; m.y += m.vy * dt;
      if (m.z <= 0) { m.z = 0; m.air = false; if (m.vz < -140) { m.vz = -m.vz * .25; m.air = true; } else m.vz = 0; P.dust(m.x, m.y, 0, 5); if (m.rig) m.rig.kick(-4); m.stunT = Math.max(m.stunT, .35); }
      collideUnit(m); animFoe(m, dt); continue;
    }
    // over a pit with nothing under the feet: it falls (the chasm mechanic stages its own fall when it runs the level)
    if (!m.canFly && m.z <= 0 && !m.air && !m.boss && ED.L && ED.L.map.floorTags && ED.L.map.floorAt(m.x, m.y) === 'pit' && !(ED.L.mechs || []).includes('chasm')) {
      m.fallT = (m.fallT || 0) + dt; m.z = -m.fallT * m.fallT * 260; m.fade = clamp(1 - m.fallT * 2, 0, 1); m.vx *= .9; m.vy *= .9;
      if (m.fallT > .5) { m.noLoot = false; killUnit(m, { src: m.hitBy && m.hitBy.team === 'hero' ? m.hitBy : ED.hero, amount: m.hp, el: 'phys', tags: ['fall'] }); m.gone = true; }
      continue;
    }
    const frozen = m.st.freeze || m.st.stun;
    if (!frozen) {
      if (m.st.fear) { const h = ED.hero, a = Math.atan2(m.y - h.y, m.x - h.x); AI.move(m, [Math.cos(a), Math.sin(a)], dt, .8); AI.face(m, a, dt, 8); }
      else { const ai = typeof m.arch.ai === 'function' ? { update: m.arch.ai } : REG.ai[m.arch.ai || 'melee']; if (ai) ai.update(m, dt); }
      if (m.arch.update) m.arch.update(m, dt);
      for (const id of m.affixes) { const a = REG.affixes[id]; if (a && a.update) a.update(m, dt); }
    } else { const dmp = Math.exp(-6 * dt * (m.traction === undefined ? 1 : m.traction)); m.vx *= dmp; m.vy *= dmp; }   // frozen on ice: it glides
    m.x += m.vx * dt; m.y += m.vy * dt;
    if (m.drift) { m.x += m.drift[0] * dt; m.y += m.drift[1] * dt; }
    m.traction = undefined; m.speedK = undefined; m.drift = null;   // set by mechanics every step (ice, mud, wind)
    collideUnit(m);
    if (ED.hero && ED.hero.alive) { const h = ED.hero, R = (m.atk && m.atk.phase !== 'wind' && m.atk.spec) ? Math.max(m.r + h.r - 1, 6) : m.r + h.r + 2; const dx = m.x - h.x, dy = m.y - h.y, dd = Math.hypot(dx, dy); if (dd < R && dd > .01 && !m.canFly) { m.x = h.x + dx / dd * R; m.y = h.y + dy / dd * R; } }
    animFoe(m, dt);
  }
  separate(list, dt0);
}
/** how fast a unit's clock runs against the world's: a monster's (time wells, the Monster speed slider), 1 for the rest.
 *  Effects a monster owns (its telegraphs, its shots) can run on it, so a warning always fills as its wind-up does */
const foeClock = u => u && u.team === 'foe' ? (u.timeK === undefined ? 1 : u.timeK) * DIFF.foeSpeed : 1;
/** pose the body from the monster's state (skipped while frozen solid) */
function animFoe(m, dt) {
  if (m.st.freeze) return;
  const vis = !OPT.lod || isVisible(m);
  if (m.rig) {
    if (!vis) return;
    const pommel = !!(m.atk && m.atk.spec.blade === 0 && m.rig.o.weapon);
    m.rig.update(dt * (m.st.chill ? .75 : 1), Object.assign({ x: m.x, y: m.y, z: m.z, vx: m.vx, vy: m.vy, facing: m.facing, hurt: m.stunT > 0 || m.air, air: m.air, attack: m.atk && m.atk.state, stance: m.arch.stance, point: pommel, aim: 1.2,
      expr: m.stunT > 0 ? 'wince' : m.atk ? 'angry' : null }, m.rigState || {}));
  } else if (m.blob) m.blob.update(dt, m.blobState || { squash: m.air ? .2 : 0, look: [ED.hero.x - m.x, ED.hero.y - m.y], flap: 1 });
  else if (m.body && m.body.update) m.body.update(dt, m);
}
const isVisible = m => { const s = game.view.p(m.x, m.y, 0), vx = s[0] - game.cam.x, vy = s[1] - game.cam.y; return vx > -80 && vx < game.screen.W + 80 && vy > -60 && vy < game.screen.H + 140; };
function separate(list) {
  const G = GRID;
  for (const e of list) {
    if (!e.alive || e.air) continue;
    const cx = (e.x / G.C) | 0, cy = (e.y / G.C) | 0;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const a = G.m.get(G.key(cx + ox, cy + oy)); if (!a) continue;
      for (const b of a) { if (b === e || b.air) continue; const dx = e.x - b.x, dy = e.y - b.y, d = Math.hypot(dx, dy), mm = e.r + b.r + 2; if (d < mm && d > .01) { const k = (mm - d) / d * .5 * (b.mass || 1) / ((e.mass || 1) + (b.mass || 1)) * 2; e.x += dx * k; e.y += dy * k; } }
    }
  }
}
const DEAD_T = 1.6, POP_T = .35;
function updateCorpses(dt) {
  const C = ED.corpses; while (C.length > 160) C.shift();
  for (let i = C.length - 1; i >= 0; i--) {
    const m = C[i]; m.deadT += dt; m.flash -= dt;
    const life = m.arch.body === 'wisp' ? POP_T : m.arch.corpseT || DEAD_T;
    if (m.deadT > life || m.gone) { C.splice(i, 1); continue; }
    const airborne = m.z > 0;
    if (!airborne) { const k = 480 * dt / (Math.hypot(m.vx, m.vy) || 1); m.vx = approach(m.vx, 0, Math.abs(m.vx) * k); m.vy = approach(m.vy, 0, Math.abs(m.vy) * k); }   // a body skids to a stop along its line
    m.x += m.vx * dt; m.y += m.vy * dt;
    if (airborne) { m.vz = (m.vz || 0) - 520 * dt; m.z = Math.max(0, m.z + m.vz * dt); if (m.z === 0) { P.dust(m.x, m.y, 0, 5); if (m.rig) m.rig.kick(-4); } }
    collideUnit(m);
    // the topple: the rig's own 'die' drops the body flat in a sixth of a second once the knees give (.45 s), a snap on a
    // big body. It falls like a tree instead (slow, then faster), the heavier the slower: 'down' eases in over T seconds
    // (the rig's own die clock, so a death that holds a boss on its knees keeps it there)
    if (m.rig) { const T = .26 * Math.sqrt(m.rig.o.size || 1), u = ((m.rig.dieT || 0) + dt - .45) / T; m.rig.update(dt, { x: m.x, y: m.y, z: m.z, facing: m.facing, pose: 'die', down: u <= 0 ? 0 : Math.min(1, u * u) }); }
    else if (m.blob) { m.z = Math.max(0, m.z - 80 * dt); m.blob.update(dt, { squash: -.42, squint: true, flap: 0 }); }
    else if (m.body && m.body.update) m.body.update(dt, m);
  }
}

/* ---------- drawing ---------- */
const FLASH = '#ffe6d8', FLASH_LINE = '#fff4e6', CLAW_SMEAR = ['#ffffff', '#ffd6c8', '#ff7a5a', '#b8302a'];
function foeAlpha(m) { return !m.alive ? clamp(m.arch.body === 'wisp' ? 1 - m.deadT / POP_T : ((m.arch.corpseT || DEAD_T) - m.deadT) * 2, 0, 1) : m.spawnT > 0 ? clamp(1 - m.spawnT / .6, .05, 1) : m.fade !== undefined ? m.fade : 1; }
/** what a monster's body shows this frame: [flash color, mix, outline color]. The hit flash (brief, and throttled on bosses
 *  and elites: see foeReact), else its strongest status as a gentle tint (statusTint); a boss or an elite struck by a light
 *  blow flares only its outline, so its own colors always show. Custom bodies (33-beasts) draw with it too */
function foeTint(m) {
  const t = m.flash > 0 ? [FLASH, m.boss ? .26 : .3] : m.alive ? statusTint(m) : null;
  const oc = m.flash > 0 || (m.alive && m.rimT > 0) ? FLASH_LINE : m.elite && m.alive ? (m.elite === 2 ? '#5a3a10' : '#18204a') : undefined;
  return [t && t[0], t ? t[1] : 0, oc];
}
function drawFoe(m, r) {
  const view = r.view, alpha = foeAlpha(m), s = m.scale || 1;
  if (!r.visible(m.x, m.y, m.z, 60 * s, 40 * s, 110 * s)) { r.game.stats.culled++; return; }
  if (m.arch.draw) { m.arch.draw(m, r, alpha); return; }
  const [fl, fm, oc] = foeTint(m), outline = OPT.outlines !== false && !(PERF.low && !m.elite && !m.boss);   // the governor drops ordinary outlines when frames run long
  r.shadow(m.x, m.y, (m.r + 1) * s * (m.z > 0 ? Math.max(.4, 1 - m.z * .02) : 1), .5 * alpha);
  if (m.alive && m.elite) r.decal(() => { const c = m.elite === 2 ? '#ffc040' : m.elite === 3 ? '#ff5a3a' : '#6a9aff'; r.groundRing(m.x, m.y, m.r * s + 4, c, .6 + .3 * Math.sin(game.time * 5)); }, { emissive: .6 });
  const A0 = m.alive && m.atk && m.atk.busy ? m.atk : null;
  if (A0 && A0.phase === 'wind' && m.arch.attacks) { const at = m.arch.attacks[m.next] || m.arch.attacks[0]; telegraphArc(r, m, A0.u, (at.reach || 12) * s + (at.extraReach || 0), at.half || .8); }
  if (r.gpu) L.caster(m.x, m.y, 3.2 * s, 22 * s);
  if (m.rig) r.actor(m.x, m.y, m.z, (g, ox, oy) => { m.rig.draw(g, ox, oy, view); if (m.drawExtra) m.drawExtra(g, ox, oy, view); }, { flash: fl, flashMix: fm, alpha, outline: outline || !!fl || oc === FLASH_LINE, outlineColor: oc, rim: outline });
  else if (m.blob) r.actor(m.x, m.y, m.z, (g, ox, oy) => { m.blob.draw(g, ox, oy, view); if (m.drawExtra) m.drawExtra(g, ox, oy, view); }, { flash: fl, flashMix: fm, alpha, outline: outline || !!fl || oc === FLASH_LINE, outlineColor: oc, rim: outline });
  else if (m.arch.body === 'wisp') r.actor(m.x, m.y, m.z, (g, ox, oy) => drawWisp(g, ox, oy, m, r), { rim: false, alpha, emissive: 1, outline });
  else if (m.body) r.actor(m.x, m.y, m.z, (g, ox, oy) => m.body.draw(g, ox, oy, view, m), { flash: fl, flashMix: fm, alpha, outline: outline || !!fl || oc === FLASH_LINE, outlineColor: oc, rim: outline });
  if (A0 && m.rig) m.rig.drawSmear(r, m.el !== 'phys' ? EL(m.el).smear.slice().reverse() : CLAW_SMEAR);
  for (const id of m.affixes) { const a = REG.affixes[id]; if (a && a.draw && m.alive) a.draw(m, r); }
  if (m.glow && m.alive) L.add(m.x, m.y, m.z + 10, m.glow[1] || 50, .7, { color: m.glow[0] });
}
/**
 * is a glow at world (x, y, z) in the open, or hidden behind a wall standing in front of it on screen? The emissive
 * pass draws glowing items again after the lighting, over everything (walls too), so eyes and orbs would shine through
 * rock. Glows use { emissive: foeGlowSeen(...) }: hidden ones stay in the depth-sorted pass, where the wall covers them.
 * It walks the floor toward the camera along the glow's own screen column (a few cells at most) and asks whether a
 * wall's top (at its drawn height: walls in front of a floor are cut down to stubs) rises over the glow.
 */
function foeGlowSeen(x, y, z) {
  const map = ED.L && ED.L.map, v = game.view; if (!map || !map.types || v.isTop) return true;
  let ux = -v.ay, uy = v.ax; const l = Math.hypot(ux, uy) || 1; ux /= l; uy /= l;
  let g = v.bx * ux + v.by * uy; if (g < 0) { ux = -ux; uy = -uy; g = -g; }   // the floor direction that runs down the screen
  if (g < .05 || v.bz >= 0) return true;
  const reach = Math.min(90, -v.bz * Math.max(0, 50 - z) / g), T = map.T || 16;
  for (let s = 5; s <= reach; s += 5) {
    const cx = Math.floor((x + ux * s) / T), cy = Math.floor((y + uy * s) / T), c = map.cell(cx, cy); if (c === 0) continue; if (c < 0 || !map.types[c]) return true;
    const h = map._isFront && map._isFront(cx, cy, v) ? (map.types[c].cutH || 6) : map.types[c].h;
    if (g * s < -v.bz * (h - z)) return false;
  }
  return true;
}
/** the red wind-up arc on the floor that grows toward the target */
function telegraphArc(r, m, u, reach, half = .8) {
  r.decal(() => r.groundArc(m.x, m.y, m.r * .6, m.r * .6 + (reach - m.r * .6) * u, m.facing - half, m.facing + half, '#ff4a3a', .25 + .45 * u), { emissive: .2 + .35 * u });
}
function drawWisp(g, ox, oy, m, r) {
  const a = m.ai, e = EL(m.el === 'phys' ? 'void' : m.el), k = !m.alive ? 1 + m.deadT / POP_T * 1.8 : a.charge > 0 ? 1 + (1 - a.charge / .6) * .8 : 1, zm = r.view.zoom || 1;
  r.glowDisc(g, ox, oy, 7 * k * zm, e.dark, .55);
  px.disc(g, ox, oy, 3.2 * k * zm, m.flash > 0 ? '#ffffff' : e.color); px.disc(g, ox - .5, oy - .5, 1.8 * k * zm, e.light);
  for (let i = 0; i < 3; i++) { const an = (a.t || 0) * 4 + i * TAU / 3; px.dot(g, ox + Math.cos(an) * 6 * k * zm, oy + Math.sin(an) * 3 * k * zm, e.light); }
}
/** health bars and names over damaged or elite monsters (screen space) */
function drawFoeBars(r) {
  if (!OPT.bars) return;
  r.overlay(g => {
    const names = [];
    for (const m of ED.foes) {
      if (!m.alive || m.spawnT > 0 || m.boss || (!m.elite && m.hp >= m.maxHp)) continue;
      if (!r.visible(m.x, m.y, m.z, 20, 20, 40)) continue;
      const [x, y] = r.w(m.x, m.y, m.z + (m.head || 28) * (m.scale || 1) + 4), w = m.elite ? 26 : 16;
      px.rect(g, x - w / 2 - 1, y - 1, w + 2, 4, '#0c0818'); px.rect(g, x - w / 2, y, w, 2, '#3a1a26'); px.rect(g, x - w / 2, y, Math.max(0, Math.round(w * m.hp / m.maxHp)), 2, m.elite === 2 ? '#ffb040' : m.elite ? '#6a9aff' : '#e0463c');
      if (m.elite === 2) names.push({ m, x, y: y - 9 });   // rares only (a champion pack reads by its blue bars; its names crowded the fight)
    }
    // names never pile up: bottom to top on screen, a name that would overlap one already placed moves up a line (a few
    // at most), and a copy of a name already shown there (an illusionist's decoys) is left out: one name per group
    names.sort((a, b) => b.y - a.y); const placed = [];
    for (const n of names) {
      const hw = E.font.width(n.m.name, { font: 'tiny' }) / 2 + 2, hit = y => placed.find(p => Math.abs(p.x - n.x) < p.hw + hw && Math.abs(p.y - y) < 8);
      let y = n.y, p = hit(y); if (p && p.name === n.m.name) continue;
      for (let k = 0; k < 3 && p; k++) { y = p.y - 8; p = hit(y); }
      placed.push({ x: n.x, y, hw, name: n.m.name });
      E.font.text(g, n.m.name, n.x, y, n.m.elite === 2 ? '#ffd36a' : '#9ab8ff', { align: 'center', font: 'tiny', outline: '#0c0818' });
    }
  });
}

/* ---------- packs ---------- */
/** pick from the level's pool by weight: pool is [archetype ids] */
function pickArch(pool, R, depth) { const opts = pool.map(id => REG.archetypes[id]).filter(a => a && (a.minDepth || 1) <= Math.max(depth, 1) + 2 && !a.noPack); return opts.length ? R.weighted(opts, a => a.weight || 10).id : 'husk'; }
/**
 * a pack around (x, y): n monsters of one or two kinds from the pool, maybe led by a champion group or a rare.
 * o: { pool, n, elite: 0 | 1 | 2, R, radius, kinds }
 */
function spawnPack(x, y, o = {}) {
  const R = o.rng || rnd, depth = ED.depth || 1, pool = o.pool || ['husk', 'skeleton', 'slime', 'wisp'], packId = ++spawnPack.n;
  const main = o.kind || pickArch(pool, R, depth), second = R.chance(.45) ? pickArch(pool, R, depth) : main;
  const n = o.n || Math.max(1, Math.round((4 + R.int(0, 4)) * DIFF.density * TUNE.packSize)), out = [], rad = o.radius || 26;
  const place = () => { for (let k = 0; k < 12; k++) { const a = R() * TAU, d = R() * rad, px0 = x + Math.cos(a) * d, py0 = y + Math.sin(a) * d; if (ED.L && ED.L.map && !ED.L.map.walkable(Math.floor(px0 / 16), Math.floor(py0 / 16))) continue; return [px0, py0]; } return [x, y]; };
  const affixes = o.elite === 1 ? R.shuffle(Object.values(REG.affixes).filter(a => (a.minDepth || 1) <= depth && (!a.ok || a.ok(REG.archetypes[main])))).slice(0, 1).map(a => a.id) : null;
  const mod = o.mod || {};   // pack variants from deep recipes: { scale, hpMul, dmgMul, speedMul, prefix, affix }
  if (o.elite === 2) { const [px0, py0] = place(); const m = spawnMonster(main, px0, py0, { elite: 2, rng: R, instant: o.instant, el: o.el }); if (m) { m.pack = packId; out.push(m); } }
  for (let i = 0; i < n * (mod.count || 1); i++) {
    const [px0, py0] = place(), champ = o.elite === 1 && i < 3 + (R() * 2 | 0);
    const m = spawnMonster(i % 3 === 2 ? second : main, px0, py0, { elite: champ ? 1 : 0, affixes: champ ? affixes : !champ && mod.affix && (!REG.affixes[mod.affix].ok || REG.affixes[mod.affix].ok(REG.archetypes[i % 3 === 2 ? second : main])) ? [mod.affix] : null, rng: R, instant: o.instant, el: o.el, scale: mod.scale, hpMul: mod.hpMul, dmgMul: mod.dmgMul });
    if (m) { m.pack = packId; m.homeX = px0; m.homeY = py0; out.push(m); if (champ && !out.some(q => q.packLead)) m.packLead = true; if (mod.speedMul) m.speed *= mod.speedMul; if (mod.prefix && !champ) m.name = mod.prefix + ' ' + m.name; if (mod.scale && mod.scale > 1) m.mass *= mod.scale * mod.scale; }
  }
  return out;
}
spawnPack.n = 0;

/* ---------- the stress test's crowd: husks, skeletons, knights, slimes and wisps ---------- */
const HUSK_COLORS = [
  { skin: '#8fa38a', hair: '#3a3f38', cloth: '#5b4a3c', pants: '#3d3530', boot: '#2c2622', belt: '#7a6a4a', cape: '#4a3a5a', capeIn: '#2c2236' },
  { skin: '#9a9a7a', hair: '#403a30', cloth: '#4a5a4c', pants: '#35302c', boot: '#2a2420', belt: '#6a5a3a', cape: '#5a3a30', capeIn: '#32201a' },
  { skin: '#7f9a9a', hair: '#303a3f', cloth: '#5a4a5a', pants: '#302a36', boot: '#221e26', belt: '#6a6a7a', cape: '#3a4a5a', capeIn: '#202a36' }
];
def('archetypes', 'husk', { name: 'Husk', tags: ['undead', 'melee'], minDepth: 1, weight: 14, hp: 30, dmg: 9, speed: 29, r: 5, xp: 9, head: 28,
  rig: { weapon: null, hunch: .4, lean: .18, stride: 5, swing: 2.5, speedRef: 40, armLower: 5.6, headR: 3.2, eyeGlow: '#ff6a3d' }, palettes: HUSK_COLORS,
  ai: 'melee', attacks: [{ move: 'claw', dmg: 1 }, { move: 'haymaker', dmg: 1.3, kb: 140 }, { move: 'hook', dmg: 1 }] });
def('archetypes', 'skeleton', { name: 'Skeleton', tags: ['undead', 'melee'], minDepth: 1, weight: 12, hp: 24, dmg: 10, speed: 34, r: 5, xp: 10, head: 28,
  rig: { build: 'skeleton', bladeLen: 9 }, palettes: [
    { bone: '#d8cfb4', cloth: '#2c2434', belt: '#5a4a38', metal: '#b3b8c0', metalDk: '#636872', hilt: '#6a5038', cape: '#3a3040', capeIn: '#1e1826' },
    { bone: '#c2c7ae', cloth: '#26303a', belt: '#4a4034', metal: '#8f9a96', metalDk: '#525a58', hilt: '#5a4430', cape: '#2a3a3a', capeIn: '#161e20' }], elKeys: ['cloth'],
  ai: 'melee', attacks: [{ move: 'slash' }, { move: 'overhead', dmg: 1.3 }, { move: 'thrust' }] });
def('archetypes', 'knight', { name: 'Hollow Knight', tags: ['undead', 'melee', 'armored'], minDepth: 2, weight: 7, hp: 56, dmg: 14, speed: 22, r: 6, xp: 18, head: 30, mass: 2, armor: 12, stance: 'ready',
  rig: { build: 'bulky', armor: true, sleeves: 'long', hat: { style: 'helmet', color: '#737c90' }, speedRef: 45 },
  palettes: ['#7a2e34', '#2e4a78', '#3f5a3a'].map(t => ({ cloth: t, pants: '#34303c', boot: '#2a2630', belt: '#6a5030', trim: '#d0a85a', metal: '#b9c1cf', metalDk: '#687488', skin: '#d6a58a', hair: '#3a2a22', cape: E.shade(t, -.2), capeIn: E.shade(t, -.45) })),
  ai: 'melee', attacks: [{ move: 'overhead', dmg: 1.3, kb: 160 }, { move: 'bash', dmg: 1, kb: 200 }, { move: 'thrust' }] });
const SLIME_PARTS = [{}, {}, { horns: true }, { ears: 'cat' }, { wings: true }];
def('archetypes', 'slime', { name: 'Slime', tags: ['beast'], minDepth: 1, weight: 10, hp: 20, dmg: 7, speed: 30, r: 6, xp: 7, head: 16, body: 'blob', ai: 'pouncer',
  blob: { R: 6.2 }, palettes: [{ dk: '#6d2658', base: '#c95f9a', lt: '#f5a3cc' }, { dk: '#1e5a3a', base: '#4fb86a', lt: '#b8f0c0' }, { dk: '#1e4a86', base: '#4f98e0', lt: '#b8dcff' }], elKeys: ['base', 'lt'],
  onSpawn(m, o) { if (!o.blob) Object.assign(m.blob.o, rnd.pick(SLIME_PARTS)); } });
def('archetypes', 'wisp', { name: 'Wisp', tags: ['spirit', 'ranged'], minDepth: 1, weight: 7, hp: 14, dmg: 8, speed: 30, r: 5, xp: 8, head: 10, body: 'wisp', ai: 'orb', flies: true, el: 'void', stagger: true,
  shot: { every: 2.5, speed: 95, dmg: .9 } });

/* ---------- a few elite affixes (more live in the monster content files) ---------- */
def('affixes', 'hasted', { name: 'Hasted', color: '#8affc8', minDepth: 1, apply(m) { m.speed *= 1.45; }, update(m, dt) { if (Math.random() < dt * 6) P.add({ kind: 'dust', x: m.x, y: m.y, z: 2, vz: 6, max: .3, size: 1.2, color: '#8affc8' }); } });
def('affixes', 'stoneskin', { name: 'Stoneskin', color: '#b8b0a0', minDepth: 2, apply(m) { m.armor += 40 + m.level * 6; m.mass *= 2; m.dmgTaken = .7; } });
def('affixes', 'vampiric', { name: 'Vampiric', color: '#d83a5a', minDepth: 3, onHit(m) { m.hp = Math.min(m.maxHp, m.hp + m.maxHp * .08); P.glints(m.x, m.y, 18, 3, '#ff5a7a'); } });
