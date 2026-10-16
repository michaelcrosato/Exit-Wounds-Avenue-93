/* =============================================================================
 * BOSSES: a monster with phases of patterns, a bar across the top and a loot shower
 * A BOSS is def('bosses', id, { name, title, arch (archetype for the body), size, hp (x a normal monster), dmg, el,
 *   music: 'boss', phases: [{ at: 1, patterns: ['slam', 'charge'], gap: 1.2 }, { at: .5, ... }],
 *   intro(b), update(b, dt), onPhase(b, i), onDie(b), minDepth, pal (its own colors), composed (made by composeBoss) })
 * A PATTERN is def('patterns', id, { name, range: [min, max] (distance it likes), role: 'close' | 'zone' | 'aid' (how a
 *   composed boss uses it: closes in and strikes, fills the floor with danger, or calls help), unique, start(b, P) -> runtime
 *   { update(dt) -> keep going?, rig: { fields for the body's rig } } }). Patterns are verbs any boss can use:
 * procedural bosses past the planned depths pick a body, an element and a set of patterns.
 * ============================================================================= */
function spawnBoss(id, x, y, o = {}) {
  const B = REG.bosses[id]; if (!B) return null;
  const arch = REG.archetypes[B.arch || 'knight'];
  const m = spawnMonster(arch.id, x, y, Object.assign({ elite: 3, hpMul: (B.hp || 14) * TUNE.bossHp, dmgMul: (B.dmg || 1.3) * TUNE.bossDmg, el: B.el || o.el, instant: true, scale: B.size || 1.8, pal: B.pal ? shiftPal(B.pal, o.hue || 0) : undefined }, o));
  if (!m) return null;
  m.boss = true; m.bossDef = B; m.name = o.name || B.name; m.title = o.title || B.title || ''; m.mass = 99; m.phase = 0; m.pat = null; m.patT = 1.5;   // (its experience is 25 monsters' worth: doubled, one kill handed out three levels)
  m.patterns = o.patterns || null;
  // a boss that has beaten the hero still bears his wounds when he comes back: 15% of its life gone for each defeat at its
  // depth (to 55% after three), and a little of its fury. A hard first try, but no depth that stops a descent for good
  const sc = Math.min(3, BOSS_SCARS[m.level] || 0); if (sc && !o.noScars) { m.maxHp = m.hp = Math.round(m.maxHp * (1 - .15 * sc)); m.dmg *= 1 - .05 * sc; m.bossScars = sc; }
  m.r = (arch.r || 5) * m.scale * .8; m.head = (arch.head || 28) * m.scale;
  m.arch = Object.assign(Object.create(arch), { ai: 'boss', stagger: false });
  if (B.intro) B.intro(m);
  ED.boss = m; m.introT = 2.2;
  if (o.dormant) { m.dormant = true; m.introT = 0; m.ai.aware = false; return m; }   // it wakes (name, music) when the hero comes: see wakeBoss
  wakeBoss(m, true);
  return m;
}
/** the boss wakes: its name, its music, a heavy stir (the roar itself comes with its entrance: the arena's rise and roar,
 *  or a body's own drop or eruption, so a waking boss roars once) */
function wakeBoss(m, quiet) {
  m.dormant = false; m.ai.aware = true; m.introT = 2.2;
  if (m.bossScars && !m.scarSaid) { m.scarSaid = true; game.after(2.4, () => { if (m.alive) notify(String(m.name).toUpperCase() + ' STILL BEARS YOUR WOUNDS', '#ffb070', 3); }); }
  if (!quiet) { sfx('thud', { vol: .7, pitch: .6 }); shake(4); }
  bossMusic(m); BUS.emit('bossWake', { m });
}
/** its music starts once, however it woke (walked up to, struck, spawned awake) */
function bossMusic(m) { if (m.woke) return; m.woke = true; A.music((m.bossDef && m.bossDef.music) || 'boss'); }
def('ai', 'boss', { update(m, dt) {
  const B = m.bossDef, h = ED.hero; if (!h || m.dormant) { if (m.dormant) { AI.move(m, [0, 0], dt); m.rigState = m.pat && m.pat.rig || m.rigState; } return; }   // asleep on its throne until the hero comes
  bossMusic(m);
  if (m.introT > 0) { m.introT -= dt; AI.face(m, angTo(m, h), dt, 3); m.rigState = { pose: m.introT > .8 ? 'cheer' : null, expr: 'shout' }; if (m.introT > 1 && Math.random() < .2) shake(1); return; }
  // phases at health thresholds: a roar, a flash, new patterns
  const phases = B.phases || [{ at: 1, patterns: m.patterns || ['slam', 'charge'] }];
  const next = phases[m.phase + 1];
  if (next && m.hp / m.maxHp <= next.at) { m.phase++; m.pat = null; m.patT = 1; m.introT = 1.2; game.flash('#ff8a5a', .2, .6); sfx('boom'); shake(5); P.ring(m.x, m.y, 6, 60, '#ff8a5a', .5); if (B.onPhase) B.onPhase(m, m.phase); notify(m.name.toUpperCase() + ' GROWS ENRAGED', '#ff8a5a', 2); return; }
  const ph = phases[m.phase];
  if (B.update) B.update(m, dt);
  if (m.pat) { const keep = m.pat.update(dt * statusSpeed(m) * TUNE.bossTempo); m.rigState = m.pat.rig || null; if (!keep) { m.pat = null; m.patT = (ph.gap || 1.1) * (.8 + Math.random() * .4) / TUNE.bossTempo; m.rigState = null; } return; }
  // between patterns: stalk the hero, then pick a pattern that suits the distance
  m.patT -= dt; const d = Math.hypot(h.x - m.x, h.y - m.y);
  AI.face(m, angTo(m, h), dt, 4); AI.move(m, d > 40 ? AI.steer(m, h.x, h.y) : [0, 0], dt, .8);
  if (m.patT <= 0) {
    const ids = (m.patterns && m.phase === 0 ? m.patterns : ph.patterns || m.patterns || ['slam']).filter(id => REG.patterns[id]);
    const fit = ids.filter(id => { const rg = REG.patterns[id].range || [0, 999]; return d >= rg[0] && d <= rg[1]; });
    // never the same verb twice running when it has another: when the only one that suits the distance is the last one (a
    // hero hugging a boss whose leaps want room), it reaches for another anyway rather than repeat itself all fight
    const pool = fit.length ? fit : ids, fresh = pool.length > 1 ? pool.filter(q => q !== m.lastPat) : pool[0] === m.lastPat && ids.length > 1 ? ids.filter(q => q !== m.lastPat) : pool;
    const id = rnd.pick(fresh); if (!id) return;
    m.pat = REG.patterns[id].start(m, ph) || null; m.lastPat = id;
  }
} });
/** defeats per depth at the hands of its (awake) boss this session: see spawnBoss; a win there clears them */
const BOSS_SCARS = {};
BUS.on('heroDie', () => { const b = ED.boss; if (b && b.alive && b.woke && !b.dormant && ED.mode === 'level') BOSS_SCARS[b.level] = (BOSS_SCARS[b.level] || 0) + 1; }, 'global');
BUS.on('kill', e => {
  const m = e.tgt; if (!m.boss) return;
  if (m.level) delete BOSS_SCARS[m.level];
  if (ED.boss === m) ED.boss = null;
  game.flash('#fff4d0', .3); shake(8); slowMo(.3, 2, 'bossdown');
  P.explosion(m.x, m.y, 10, 2, { flash: false }); sfx('boom');
  if (m.bossDef.onDie) m.bossDef.onDie(m);
  BUS.emit('bossDown', { m });
  A.music('victory');
});

/* ---------- core patterns: the vocabulary procedural bosses are built from ---------- */
// slam: a crouch, a leap at the hero, a landing shockwave
def('patterns', 'slam', { name: 'Slam', role: 'close', range: [20, 140], start(b) {
  const h = ED.hero, tx = h.x, ty = h.y, sx = b.x, sy = b.y, R = 34 * (b.scale || 1);
  FX.telegraph({ shape: 'circle', x: tx, y: ty, r: R, dur: 1, owner: b });
  const P0 = { t: 0, rig: { pose: 'crouch' }, update(dt) {
    this.t += dt; const t = this.t;
    if (t < .35) { this.rig = { pose: 'crouch', expr: 'angry' }; AI.face(b, Math.atan2(ty - b.y, tx - b.x), dt, 8); return true; }
    if (t < 1) { const u = (t - .35) / .65; b.x = lerp(sx, tx, u); b.y = lerp(sy, ty, u); b.z = Math.sin(u * Math.PI) * 60; b.vx = b.vy = 0; this.rig = { air: true, attack: E.move('plunge', u, u < .5 ? 'wind' : 'active') }; return true; }
    if (!this.landed) { this.landed = true; b.z = 0; FX.nova({ team: 'foe', src: b, x: b.x, y: b.y, r0: 6, r1: R, dur: .25, el: b.el, hit: { amount: b.dmg * 1.6, kb: 240, knockdown: true } }); FX.wave({ team: 'foe', src: b, x: b.x, y: b.y, ang: angTo(b, h), speed: 200, len: 140, w: 14, el: b.el, hit: { amount: b.dmg, kb: 150 } }); P.dust(b.x, b.y, 0, 16, { speed: 80 }); shake(6); sfx('boom'); FX.scorch(b.x, b.y, R * .7); }
    this.rig = { pose: 'crouch' }; return t < 1.6;
  } };
  return P0;
} });
// charge: lines up, a red lane on the floor, then a rush that bowls the hero over
def('patterns', 'charge', { name: 'Charge', role: 'close', range: [50, 260], start(b) {
  const h = ED.hero, ang = angTo(b, h), len = Math.min(220, Math.hypot(h.x - b.x, h.y - b.y) + 60);
  FX.telegraph({ shape: 'line', x: b.x, y: b.y, ang, len, w: 20 * (b.scale || 1), dur: .8, owner: b });
  return { t: 0, hitDone: false, rig: {}, update(dt) {
    this.t += dt; b.facing = ang;
    if (this.t < .8) { this.rig = { pose: 'crouch', expr: 'angry' }; b.vx = b.vy = 0; return true; }
    if (this.t < .8 + len / 320) { b.vx = Math.cos(ang) * 320; b.vy = Math.sin(ang) * 320; this.rig = { dash: true, expr: 'shout' }; if (Math.random() < .5) P.dust(b.x, b.y, 0, 2);
      if (!this.hitDone && Math.hypot(h.x - b.x, h.y - b.y) < b.r + h.r + 6) { this.hitDone = true; dealDamage(h, { src: b, amount: b.dmg * 1.4, el: b.el, kb: 260, ang, knockdown: true }); }
      if (ED.L.map.solidAt(b.x + Math.cos(ang) * (b.r + 4), b.y + Math.sin(ang) * (b.r + 4))) { shake(5); sfx('boom'); b.stunT = 1; P.dust(b.x, b.y, 10, 10); return false; }
      return true; }
    b.vx *= .8; b.vy *= .8; this.rig = {}; return this.t < 1.3 + len / 320;
  } };
} });
// nova: raises the weapon, a ring of bolts in the boss's element (rotated waves in later phases)
def('patterns', 'nova', { name: 'Nova', role: 'zone', range: [0, 200], start(b) {
  let waves = 1 + b.phase, fired = 0;
  return { t: 0, rig: { pose: 'cast' }, update(dt) {
    this.t += dt;
    if (this.t > .5 + fired * .35 && fired < waves) { const n = 12 + 2 * b.phase; for (let i = 0; i < n; i++) FX.bolt({ team: 'foe', src: b, x: b.x, y: b.y, z: 14, ang: i / n * TAU + fired * .13, speed: 90, life: 3, r: 3, el: b.el === 'phys' ? 'fire' : b.el, hit: { amount: b.dmg * .6, kb: 50 }, look: { kind: 'orb', size: 1.6 }, light: 0 }); fired++; sfx('shoot', { pitch: .6 }); }
    this.rig = { pose: 'cast', expr: 'shout' };
    return this.t < .6 + waves * .35;
  } };
} });
// summon: calls a pack of its kind around it
def('patterns', 'summon', { name: 'Summon', role: 'aid', range: [0, 400], start(b) {
  return { t: 0, rig: { pose: 'cheer' }, update(dt) {
    this.t += dt;
    if (this.t > .6 && !this.done) {   // (never more than 8 of its callers alive at once: a long fight must not drown in them)
      this.done = true; const p0 = ED.L && ED.L.rec && ED.L.rec.pool, pool = p0 && p0.length ? p0 : ['husk'], n = Math.min(3 + b.phase, 8 - ED.foes.filter(q => q.alive && q.calledBy === b).length);
      for (let i = 0; i < n; i++) { const a = i / n * TAU, x = b.x + Math.cos(a) * 40, y = b.y + Math.sin(a) * 40; if (ED.L.map.walkable(Math.floor(x / 16), Math.floor(y / 16))) { const m = spawnMonster(rnd.pick(pool), x, y, {}); if (m) { m.ai.aware = true; m.calledBy = b; P.ring(x, y, 2, 16, '#ff8a5a', .4); } } }
      sfx('warp'); }
    this.rig = { pose: 'cheer', expr: 'shout' }; return this.t < 1.2;
  } };
} });
// cleave: a huge telegraphed swing in a wide arc in front
def('patterns', 'cleave', { name: 'Cleave', role: 'close', range: [0, 60], start(b) {
  const atk = new E.Attack('twohand', { wind: .75, active: .12, recover: .5 }); atk.start();
  const h = ED.hero, R = 44 * (b.scale || 1) * .8;
  return { t: 0, rig: {}, update(dt) {
    const began = atk.update(dt); this.rig = { attack: atk.state, expr: 'angry' };
    if (atk.phase === 'wind') { AI.face(b, angTo(b, h), dt, 3); if (!this.tel) { this.tel = true; FX.telegraph({ shape: 'arc', x: b.x, y: b.y, r: R, ang: b.facing, half: 1.2, dur: .75, owner: b, follow: b, followAng: true }); } }
    if (began === 'active') { hitCone('foe', b.x, b.y, b.facing, R, 1.2, () => ({ src: b, amount: b.dmg * 1.8, el: b.el, kb: 240, ang: b.facing, knockdown: true })); shake(4); sfx('kick'); FX.wave({ team: 'foe', src: b, x: b.x, y: b.y, ang: b.facing, speed: 240, len: 100, w: 12, el: b.el, hit: { amount: b.dmg * .8, kb: 120 } }); }
    return atk.busy;
  } };
} });

/* a boss at every fifth depth: the planned ones by name, then composed ones (a body, an element, patterns, a name).
 * Every composed boss wears a bespoke boss body (bossBody: the Bone King, the Armored Colossus, the Flesh Titan, the
 * Six-Armed Reaver...): a scaled-up knight or skeleton read as a big minion, not a boss. The planned set pieces (the Brood
 * Mother, the Wyrm) come back only past depth 100, and never in their own element. The line of composed bosses is drawn in
 * order, each from its own seed, so a depth always meets the same boss, no body comes up again within three boss depths
 * and no name within twenty */
const BOSS_NAMES = { a: ['Vor', 'Mal', 'Gor', 'Ser', 'Kha', 'Ul', 'Dre', 'Az', 'Mor', 'Thes', 'Ny', 'Bael', 'Ish', 'Cor', 'Vex', 'Oru'], b: ['gath', 'akar', 'eth', 'uun', 'orix', 'avel', 'grim', 'oth', 'ira', 'eon', 'ulus', 'aroth', 'emne', 'yx'],
  t: ['the Deep King', 'Warden of the Stair', 'the Hungering', 'Who Waits Below', 'the Unmade', 'Heart of the Pit', 'the Hollow Crown', 'the Last Door', 'Keeper of the Dark'],
  el: { fire: ['the Last Flame', 'the Cinderborn'], frost: ['the Pale Winter', 'Who Never Thaws'], storm: ['the Thunder Below', 'Stormcaller'], void: ['the Starless', 'Eater of Light'], venom: ['the Rot Queen', 'the Bloom of Plague'], phys: ['the Unbroken', 'Iron Hunger'] } };
/** a planned boss's body (the Brood Mother, the Wyrm): the bosses registered by name that wear it */
const bossPlanned = id => Object.values(REG.bosses).find(B => B.arch === id && !B.composed) || null;
/** a composed boss's name */
const bossName = R => R.pick(BOSS_NAMES.a) + R.pick(BOSS_NAMES.b);
const BOSS_SEQ = [];
/** the k-th composed boss (depth 5k): its body and name, drawn in order from their own seeds */
function bossSeq(k) {
  const bodies = Object.keys(REG.archetypes).filter(id => REG.archetypes[id].bossBody), own = bodies.filter(id => !bossPlanned(id));
  if (!own.length) own.push('knight');   // (a build without the boss bodies falls back on a big knight)
  for (let i = BOSS_SEQ.length; i <= k; i++) {
    const R = RNG('emberdeep:boss:' + i), prev = BOSS_SEQ.slice(-2).map(q => q.body), used = BOSS_SEQ.slice(-20).map(q => q.name);
    const all = i * 5 > 100 ? bodies : own, fresh = all.filter(id => !prev.includes(id)), pool = fresh.length ? fresh : all;
    const body = R.weighted(pool, id => bossPlanned(id) ? .5 : 1);   // the set pieces come back now and then; the descent's own bodies lead
    let name = ''; for (let n = 0; n < 60 && (!name || used.includes(name)); n++) name = bossName(R);
    BOSS_SEQ.push({ body, name });
  }
  return BOSS_SEQ[k];
}
/** compose (once) and register the boss of a depth; o: { body, id } composes one on a given body (the Gallery's showcase) */
function composeBoss(depth, R, o = {}) {
  const q = bossSeq(Math.max(0, Math.floor(depth / 5))), arch = o.body && REG.archetypes[o.body] ? o.body : q.body, planned = bossPlanned(arch);
  let el = R.pick(ELEMENT_IDS); if (planned && el === (planned.el || REG.archetypes[arch].el)) el = ELEMENT_IDS[(ELEMENT_IDS.indexOf(el) + 1 + R.int(0, 4)) % ELEMENT_IDS.length];   // a set piece returns in a new element
  // its verbs by role (a pattern's role: 'close' closes in and strikes, 'zone' fills the floor with danger, 'aid' calls
  // help or powers up): a fight needs both a threat to dodge and one to outrun. Two random verbs were often two leaps,
  // every one of them rolled out of: a composed boss of depth 20 fought for 45 s without landing a blow
  const pool = Object.keys(REG.patterns).filter(id => !REG.patterns[id].unique), by = r => R.shuffle(pool.filter(id => (REG.patterns[id].role || 'zone') === r));
  const close = by('close'), zone = by('zone'), aid = by('aid'), pats = [close[0], zone[0], close[1], zone[1], aid[0]].concat(depth > 40 ? [zone[2]] : []).filter(Boolean), title = R.pick(BOSS_NAMES.t.concat(BOSS_NAMES.el[el] || [], BOSS_NAMES.el[el] || [])), size = 1.9 + R() * .5;
  const hue = 60 + R.int(0, 240), id = o.id || 'composed' + depth; if (REG.bosses[id]) return id;
  // a returning set piece is recolored from head to foot (a new hue, its glowing parts in the new element), so the Brood
  // Mother of depth 10 never walks in again as herself; the earth it churns keeps its color
  const A0 = REG.archetypes[arch], P0 = planned && A0.palettes && A0.palettes[0], pal = P0 ? shiftPal(P0, hue) : undefined;
  if (pal) { for (const k of A0.elKeys || []) if (pal[k]) pal[k] = E.mix(pal[k], EL(el).color, .65); if (P0.dirt) pal.dirt = P0.dirt; }
  // its life: the hero's single-target damage outgrows the monsters' life through the first few dozen depths (a composed
  // boss of depth 25 fell in 15 s untouched), so a composed boss's share climbs from 42 to twice that, then holds
  const hp = 42 * (2 - Math.exp(-Math.max(0, depth - 20) / 10));
  def('bosses', id, { name: o.body ? bossName(R) : q.name, title, arch, el, size: planned ? planned.size || size : size, hp, dmg: 1.75, composed: true, pal,
    phases: [{ at: 1, patterns: pats.slice(0, 3), gap: .9 }, { at: .6, patterns: pats.slice(0, 5), gap: .75 }, { at: .3, patterns: pats, gap: .5 }] });
  return id;
}
