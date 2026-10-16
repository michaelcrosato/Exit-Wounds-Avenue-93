/* =============================================================================
 * THE GAME, on Rapier 0.19.3 (SIMD), in the engine's units with z up (Rapier's length unit is 16, gravity -480 z:
 * the 2D slimes' own cartoon gravity). It never reads the renderer: SIM.step(dt, ctl) takes the player's controls as
 * input (ctl, below) and the same inputs give the same state, and the same hash, with any renderer or none.
 *   bodies     the hall's fixed colliders (10-hall); the hero, a kinematic capsule moved by Rapier's character
 *              controller (it walks, slides along walls, climbs the stairs and the dais, jumps onto low walls and
 *              galleries, pushes crates and shoves monsters aside); every monster a dynamic body (walkers capsules,
 *              slimes balls, wisps weightless balls that hover); crates and barrels; the fallen, until they fade
 *   the crowd  the 2D page's AI on bodies: each step it sets the velocity a monster wants and the physics resolves the
 *              crowd (no separation code: bodies push each other). Attack tokens (up to three at once, a gap between
 *              wind-ups), telegraphs, rings of waiting monsters kept out of the camera's way, slimes that hop and
 *              pounce, wisps that orbit and shoot; paths from the hall's flow field (stairs and dais included)
 *   combat     the hero's moves from E.MOVES (slash, backslash, spin; a thrust out of a dash; an ember bolt), hits in
 *              cones with a height check; knockback is velocity, big hits throw bodies up (Launch), the fallen fly
 *              and slide; crates and barrels in a swing's arc fly off
 *   waves      kills stay down until the wave is cleared; the hero cheers and the wave marches back in
 *   ctl        { move: [x, y] ground direction (length 0..1), aim: an angle or null, pressed(action, window): a press
 *              of 'attack' | 'dash' | 'jump' | 'skill' within the window, not yet used; use(action) uses it up;
 *              cam: [fx, fy, k] the ground direction toward the camera and how much a body in front of the hero hides
 *              him from it (0 from straight above) }
 *   SIM.run(n) resets, runs n steps of a scripted fight and returns the state's hash (the proof: the same on WebGPU
 *              and WebGL 2, and when run again); SIM.hash(), SIM.reset(seed), SIM.placeHero(x, y)
 * Randomness in the game comes from SIM.rnd (seeded); the particles and the rigs' idle motion use Math.random (looks
 * only, never read back).
 * ============================================================================= */
await RAPIER.init({});
const S = { monsters: 0, mix: 'balanced', skin: 'hd', behavior: 'swarm', lights: 12, rate: 0, pcap: 2000, props: 24, god: true, outlines: true, capes: false,
  lod: false, monsterLights: false, iters: 4, launch: true, shadows: true, torchLights: true, fog: true };
const GRAVITY = 480;
// collision groups (Rapier: membership << 16 | filter; a pair touches when each one's filter has the other's membership)
const ig = (member, filter) => (member << 16) | filter;
const GROUPS = { world: ig(1, 0xffff), prop: ig(2, 1 | 2 | 4 | 8 | 32), hero: ig(4, 1 | 2 | 8), mob: ig(8, 1 | 2 | 4 | 8), wisp: ig(16, 1 | 16), dead: ig(32, 1 | 2) };
const HERO_QUERY = ig(4, 1 | 2);   // the hero's controller steers round the hall and the props only: its capsule shoves monsters aside
const SIM = { world: null, n: 0, time: 0, real: 0, hitstop: 0, shake: 0, wave: 0, note: null, rnd: Math.random, ms: { logic: 0, physics: 0 } };
const rndPick = a => a[(SIM.rnd() * a.length) | 0];
const freeze = t => { SIM.hitstop = Math.max(SIM.hitstop, t); };
const shake = a => { SIM.shake = Math.max(SIM.shake, a); };
const note = text => { SIM.note = { text, end: SIM.real + 1.4 }; };

/* ---- particles: the engine's own emitters (sparks, dust, bits, rings, text, glints, impacts), landing on the hall's
 *      surfaces (topH) instead of a flat floor ---- */
const P = new E.Particles({ freeze, shake, flash() {}, audio: { sfx() {} } });
P.update = function (dt) {
  const L = this.list;
  for (let i = L.length - 1; i >= 0; i--) {
    const p = L[i]; p.life += dt;
    if (p.life >= p.max) { L[i] = L[L.length - 1]; L.pop(); continue; }
    const k = Math.exp(-p.drag * dt);
    p.vx *= k; p.vy *= k; p.vz = p.vz * k - p.g * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    const fl = p.floor !== undefined ? p.floor : topH(p.x, p.y);
    if (p.z < fl && p.kind !== 'ring') { if (fl - p.z > 6 && p.floor === undefined) { p.vx = -p.vx * .5; p.vy = -p.vy * .5; p.x += p.vx * dt * 2; p.y += p.vy * dt * 2; } else { p.z = fl; if (p.bounce) { p.vz = -p.vz * p.bounce; p.vx *= .7; p.vy *= .7; } else p.vz = 0; } }
  }
};

/* ---- the cast: the 2D page's monsters (its skins, colors and its takes on E.MOVES), unchanged data ---- */
const HUSK_COLORS = [
  { skin: '#8fa38a', hair: '#3a3f38', cloth: '#5b4a3c', pants: '#3d3530', boot: '#2c2622', belt: '#7a6a4a', cape: '#4a3a5a', capeIn: '#2c2236' },
  { skin: '#9a9a7a', hair: '#403a30', cloth: '#4a5a4c', pants: '#35302c', boot: '#2a2420', belt: '#6a5a3a', cape: '#5a3a30', capeIn: '#32201a' },
  { skin: '#7f9a9a', hair: '#303a3f', cloth: '#5a4a5a', pants: '#302a36', boot: '#221e26', belt: '#6a6a7a', cape: '#3a4a5a', capeIn: '#202a36' }
];
const BONE_COLORS = [
  { bone: '#d8cfb4', cloth: '#2c2434', belt: '#5a4a38', metal: '#b3b8c0', metalDk: '#636872', hilt: '#6a5038', cape: '#3a3040', capeIn: '#1e1826' },
  { bone: '#c2c7ae', cloth: '#26303a', belt: '#4a4034', metal: '#8f9a96', metalDk: '#525a58', hilt: '#5a4430', cape: '#2a3a3a', capeIn: '#161e20' }
];
const KNIGHT_COLORS = ['#7a2e34', '#2e4a78', '#3f5a3a'].map(tabard => ({ cloth: tabard, pants: '#34303c', boot: '#2a2630', belt: '#6a5030', trim: '#d0a85a',
  metal: '#b9c1cf', metalDk: '#687488', skin: '#d6a58a', hair: '#3a2a22', cape: E.shade(tabard, -.2), capeIn: E.shade(tabard, -.45) }));
const HUSK = { weapon: null, hunch: .4, lean: .18, stride: 5, swing: 2.5, speedRef: 40, armLower: 5.6, headR: 3.2, eyeGlow: '#ff6a3d' };
const SKINS = {
  classic: { rig: Object.assign({ style: 'classic' }, HUSK), colors: HUSK_COLORS, moves: ['claw', 'haymaker'], hp: 32, speed: 28, dmg: 10 },
  hd: { rig: HUSK, colors: HUSK_COLORS, moves: ['claw', 'haymaker', 'hook'], hp: 32, speed: 28, dmg: 10 },
  skeleton: { rig: { build: 'skeleton', bladeLen: 9 }, colors: BONE_COLORS, moves: ['slash', 'overhead', 'thrust'], hp: 24, speed: 34, dmg: 10 },
  knight: { rig: { build: 'bulky', armor: true, sleeves: 'long', hat: { style: 'helmet', color: '#737c90' }, speedRef: 45 }, colors: KNIGHT_COLORS,
    moves: ['overhead', 'bash', 'thrust'], hp: 56, speed: 22, dmg: 14, r: 6, stance: 'ready' }
};
const MOVE = {
  claw: { plane: 'side', a0: 1.5, a1: -1.2, reach: 7, crouch: .5, lean: .45, hold: .45 },
  slash: { a0: 2.1, z0: 1, twist: 1.8, crouch: .4 },
  hook: { a1: -1, reach: 6.6, lunge: .8, lean: .1, twist: 2.4, hold: .12 },
  haymaker: { hold: .55 },
  bash: { reach: 6, hop: 1.8, lean: .6, crouch: .5 },
  overhead: { a0: 2.4 - TAU, a1: -1.25 - TAU, twist: 0 }
};
const HERO_R = 4.5, HERO_HALF = 9, HERO_FOOT = HERO_HALF + HERO_R;   // the hero's capsule (units): radius, half the straight part
const strikePt = (rig, spec) => rig.o.weapon && spec.blade !== 0 ? rig.tip() : rig.hand();
// each move measured once on a spare rig (its clock at 0, so the numbers never change): its reach and the distance it
// connects from (k.stand), as on the 2D page
for (const k of Object.values(SKINS)) {
  k.specs = k.moves.map(m => { const sp = new E.Attack(m, MOVE[m]).spec; return Object.assign(sp, { wind: Math.max(.34, sp.wind * 2), recover: sp.recover + .12 }); });
  k.reach = []; k.stand = k.specs.map(spec => {
    const rig = new E.Humanoid(k.rig); rig.t = 0; let far = 0, head = 0;
    for (let u = 0; u <= 1; u += .1) {
      rig.update(1, { x: 0, y: 0, stance: k.stance, attack: { spec, phase: 'active', u } });
      far = Math.max(far, strikePt(rig, spec)[0]); head = Math.max(head, rig.head()[0]);
    }
    k.reach.push(far);
    return Math.max(far + HERO_R - 1.5, head + 8.5);
  });
}
const MONSTER_CAPE = { len: 5, width: 4, seg: 2.3 }, HERO_CAPE = { len: 6, width: 5, seg: 2.5 };
const SLIME_PARTS = [{}, {}, { horns: true }, { ears: 'cat' }, { wings: true }];
const BITS = { slime: ['#c95f9a', '#f5a3cc', '#6d2658'], wisp: ['#c78bff', '#f4e6ff', '#7a4ac0'] };

/* ---- the world ---- */
const hero = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: HERO_R, facing: -Math.PI / 2, aim: undefined, hp: 100, max: 100, inv: 0, hurtT: 0, flash: 0, hitA: 0,
  dashT: 0, dashCD: 0, dashDir: 0, boltCD: 0, castT: 0, cheer: 0, dead: false, deadT: 0, grounded: true, hop: 0,
  combo: null, thrust: null, rig: null, body: null, col: null, cc: null };
const HIT = {
  slash: { range: 27, half: 1.35, dmg: 12, kb: 130, push: 70 },
  backslash: { range: 27, half: 1.35, dmg: 12, kb: 130, push: 70 },
  spin: { range: 34, half: Math.PI, dmg: 22, kb: 230, push: 40, big: true },
  thrust: { range: 38, half: .45, dmg: 20, kb: 220, push: 130, big: true }
};
const SPEED = 80, JUMP = 150;
const enemies = [], corpses = [], shots = [], PROPS = [];
const HERO_START = [CXu, CYu + 40];
/** a fresh world: the hall, the hero, the props (the crowd is added by setMonsters) */
SIM.reset = function (seed = 1) {
  if (SIM.world) SIM.world.free();
  const world = SIM.world = new RAPIER.World({ x: 0, y: 0, z: -GRAVITY });
  world.lengthUnit = U; world.numSolverIterations = S.iters;
  SIM.rnd = E.rng(seed); SIM.n = 0; SIM.time = 0; SIM.hitstop = 0; SIM.shake = 0; SIM.wave = 0; SIM.note = null;
  enemies.length = 0; corpses.length = 0; shots.length = 0; PROPS.length = 0; P.list.length = 0; tokens = 0; nextTurn = 0;
  hallColliders(world, GROUPS.world);
  // the hero: a kinematic capsule and the character controller that moves it
  const [sx, sy] = HERO_START, sz = floorH(sx, sy);
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(sx, sy, sz + HERO_FOOT + .4));
  const col = world.createCollider(RAPIER.ColliderDesc.capsule(HERO_HALF, HERO_R).setRotation(Z_UP).setCollisionGroups(GROUPS.hero), body);
  const cc = world.createCharacterController(.3);
  cc.setUp({ x: 0, y: 0, z: 1 }); cc.enableSnapToGround(4); cc.enableAutostep(4, 2, false); cc.setMaxSlopeClimbAngle(50 * Math.PI / 180); cc.setSlideEnabled(true);
  cc.setApplyImpulsesToDynamicBodies(true); cc.setCharacterMass(2500);
  Object.assign(hero, { x: sx, y: sy, z: sz, vx: 0, vy: 0, vz: 0, facing: -Math.PI / 2, aim: undefined, hp: hero.max, inv: 0, hurtT: 0, flash: 0, dashT: 0, dashCD: 0, boltCD: 0, castT: 0,
    cheer: 0, dead: false, deadT: 0, grounded: true, hop: 0, body, col, cc,
    combo: new E.Combo(['slash', new E.Attack('backslash', { a1: 2.2, z1: -3 }), new E.Attack('spin', { z0: -12, z1: -12 })], { window: .3 }),
    thrust: new E.Attack('thrust', { reach: 10 }) });
  if (!hero.rig) hero.rig = new E.Humanoid({ cape: HERO_CAPE, colors: { cloth: '#2f8f86', cape: '#c8452f', capeIn: '#7a2622', hair: '#2e2230' } });
  setProps(S.props);
};

/* ---- crates and barrels: dynamic bodies on spots chosen once from a seed (every fifth stacked on the one before) ---- */
const PROP_SPOTS = (() => {
  const R = E.rng(21), out = [];
  for (let tries = 0; out.length < 300 && tries < 20000; tries++) {
    const cx = 2 + Math.floor(R() * (MW - 4)), cy = 2 + Math.floor(R() * (MH - 4));
    if (!'.='.includes(tile(cx, cy))) continue;
    const x = (cx + .25 + R() * .5) * T, y = (cy + .25 + R() * .5) * T;
    if (Math.hypot(x - HERO_START[0], y - HERO_START[1]) < 60 || Math.hypot(x - CXu, y - CYu) < DAIS.R0 + 8) continue;
    const kind = R() < .6 ? 'crate' : 'barrel', last = out[out.length - 1];
    if (out.length % 5 === 4 && last && last.kind === 'crate' && kind === 'crate') out.push({ kind, x: last.x + (R() - .5) * 2, y: last.y + (R() - .5) * 2, z: last.z + 12.2, yaw: R() * TAU });
    else out.push({ kind, x, y, z: floorH(x, y) + (kind === 'crate' ? 6.1 : 7.1), yaw: R() * TAU });
  }
  return out;
})();
function setProps(n) {
  const world = SIM.world; S.props = n = clamp(n | 0, 0, PROP_SPOTS.length);
  while (PROPS.length > n) world.removeRigidBody(PROPS.pop().body);
  while (PROPS.length < n) {
    const sp = PROP_SPOTS[PROPS.length], half = sp.yaw / 2, crate = sp.kind === 'crate';
    const rot = crate ? { x: 0, y: 0, z: Math.sin(half), w: Math.cos(half) } : Z_UP;
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(sp.x, sp.y, sp.z).setRotation(rot).setLinearDamping(.3).setAngularDamping(.8));
    world.createCollider((crate ? RAPIER.ColliderDesc.cuboid(6, 6, 6) : RAPIER.ColliderDesc.cylinder(7, 6)).setDensity(.5).setFriction(.7).setRestitution(.05).setCollisionGroups(GROUPS.prop), body);
    PROPS.push({ kind: sp.kind, body, x: sp.x, y: sp.y, z: sp.z, q: [rot.x, rot.y, rot.z, rot.w], hit: 0 });
  }
}
/** knock a prop: a push of dv units per second away from (fx, fy), up by up */
function knockProp(p, fx, fy, dv, up) {
  const dx = p.x - fx, dy = p.y - fy, d = Math.hypot(dx, dy) || 1, m = p.body.mass();
  p.body.applyImpulse({ x: dx / d * dv * m, y: dy / d * dv * m, z: up * m }, true);
  p.body.applyTorqueImpulse({ x: -dy / d * m * 40, y: dx / d * m * 40, z: (SIM.rnd() - .5) * m * 60 }, true);
  p.hit = 10;
}

/* ---- monsters ---- */
function makeBody(e, x, y, z) {
  const world = SIM.world, wisp = e.type === 'wisp';
  const desc = RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z + e.foot).lockRotations().setCanSleep(true);
  if (wisp) desc.setGravityScale(0);
  e.body = world.createRigidBody(desc);
  const shape = e.type === 'walker' ? RAPIER.ColliderDesc.capsule(8, e.r).setRotation(Z_UP) : RAPIER.ColliderDesc.ball(e.r);
  e.col = world.createCollider(shape.setFriction(0).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min).setRestitution(0).setDensity(1).setCollisionGroups(wisp ? GROUPS.wisp : GROUPS.mob), e.body);
}
function makeWalker(x, y) {
  const k = SKINS[S.skin === 'mixed' ? rndPick(['hd', 'skeleton', 'knight']) : S.skin], r = k.r || 5;
  return { type: 'walker', kind: k, x, y, z: 0, vx: 0, vy: 0, vz: 0, r, foot: r + 8, hp: k.hp, max: k.hp, facing: SIM.rnd() * TAU, atk: null, cool: SIM.rnd(),
    stun: 0, flash: 0, spawnT: .6, alive: true, head: 30, speed: k.speed + SIM.rnd() * 12, next: (SIM.rnd() * k.specs.length) | 0, ph: SIM.rnd() * TAU, airT: 0,
    rig: new E.Humanoid(Object.assign({ colors: rndPick(k.colors), cape: S.capes ? MONSTER_CAPE : null }, k.rig)) };
}
function makeSlime(x, y) {
  return { type: 'slime', x, y, z: 0, vx: 0, vy: 0, vz: 0, r: 6, foot: 6, hp: 20, max: 20, state: 'idle', t: SIM.rnd(), stun: 0, flash: 0, spawnT: .6, alive: true, head: 16, flap: 0, airT: 0,
    facing: 0, blob: new E.Blob(Object.assign({ R: 6.2, face: 'front' }, rndPick(SLIME_PARTS))) };
}
function makeWisp(x, y) {
  return { type: 'wisp', x, y, z: 20, vx: 0, vy: 0, vz: 0, r: 5, foot: 0, hp: 14, max: 14, t: SIM.rnd() * 9, fire: 2 + SIM.rnd() * 2, charge: 0, stun: 0, flash: 0, spawnT: .6, alive: true,
    orbit: SIM.rnd() < .5 ? 1 : -1, head: 10, facing: 0 };
}
const MAKERS = { walker: makeWalker, slime: makeSlime, wisp: makeWisp }, MIXES = { humanoids: 'walker', slimes: 'slime', wisps: 'wisp' };
function pickType() { if (MIXES[S.mix]) return MIXES[S.mix]; const r = SIM.rnd(); return r < .5 ? 'walker' : r < .8 ? 'slime' : 'wisp'; }
function randomFloor(minDist) {
  for (let k = 0; k < 40; k++) {
    const cx = 1 + ((SIM.rnd() * (MW - 2)) | 0), cy = 1 + ((SIM.rnd() * (MH - 2)) | 0);
    if (solidTile(cx, cy) || tile(cx, cy) === '^') continue;
    const x = (cx + .2 + SIM.rnd() * .6) * T, y = (cy + .2 + SIM.rnd() * .6) * T;
    if (minDist && Math.hypot(x - hero.x, y - hero.y) < minDist) continue;
    return [x, y];
  }
  return [CXu + (SIM.rnd() - .5) * 200, CYu + 140];
}
function spawnOne(instant) {
  const [x, y] = randomFloor(S.behavior === 'swarm' ? 80 : 0), e = MAKERS[pickType()](x, y);
  e.z = floorH(x, y) + (e.type === 'wisp' ? 20 : 0);
  makeBody(e, x, y, e.z);
  if (instant) e.spawnT = 0;
  enemies.push(e); return e;
}
function removeBody(e) { if (e.body) { SIM.world.removeRigidBody(e.body); e.body = null; } }
/** grow or shrink the crowd to exactly n (instant = skip the spawn fade) */
function setMonsters(n, instant) {
  S.monsters = n;
  while (enemies.length > n) removeBody(enemies.pop());
  while (enemies.length < n) spawnOne(instant);
}
function applyCapes() { for (const e of enemies) if (e.rig) { e.rig.o.cape = S.capes ? MONSTER_CAPE : null; e.rig.capeL = null; } }

// a spatial hash: hits and shots look only near themselves
const grid = new Map(), GC = 12, gkey = (x, y) => ((x / GC) | 0) + ((y / GC) | 0) * 8192, _near = [];
function rebuildGrid() { grid.clear(); for (const e of enemies) { if (!e.alive) continue; const k = gkey(e.x, e.y); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(e); } }
function near(x, y, rad = 1) {
  _near.length = 0; const cx = (x / GC) | 0, cy = (y / GC) | 0;
  for (let oy = -rad; oy <= rad; oy++) for (let ox = -rad; ox <= rad; ox++) { const a = grid.get(cx + ox + (cy + oy) * 8192); if (a) for (const e of a) _near.push(e); }
  return _near;
}
/** in a hit cone, at a height the swing reaches */
const inArc3 = (a, facing, b, range, half) => Math.abs((b.z || 0) - a.z) < 24 && E.inArc(a, facing, b, range, half);

/* ---- the hero ---- */
const MAX_ATTACKERS = 3, TURN_GAP = .25;
let tokens = 0, nextTurn = 0;
function takeTurn() {
  if (tokens >= MAX_ATTACKERS || SIM.time < nextTurn || hero.dead) return false;
  tokens++; nextTurn = SIM.time + TURN_GAP * (.8 + SIM.rnd() * .6); return true;
}
function heroIntent(dt, ctl) {
  const h = hero;
  h.inv -= dt; h.hurtT -= dt; h.dashCD -= dt; h.boltCD -= dt; h.flash -= dt; h.castT -= dt; h.hop = 0;
  if (h.cheer > 0 && (h.cheer -= dt) <= 0) setMonsters(S.monsters);   // the next wave marches in after the cheer
  if (h.dead) {
    h.deadT += dt; h.vx = h.vy = 0;
    if (h.deadT > 2) { Object.assign(h, { dead: false, hp: h.max, inv: 1.5 }); const [sx, sy] = HERO_START; h.body.setTranslation({ x: sx, y: sy, z: floorH(sx, sy) + HERO_FOOT + .4 }, true); h.vz = 0; }
    moveHero(dt, 0, 0); return;
  }
  const free = h.cheer <= 0, md = free ? ctl.move : [0, 0], mlen = Math.hypot(md[0], md[1]);
  let aimA = free ? ctl.aim : null;
  if ((aimA === null || aimA === undefined) && mlen > .1) aimA = Math.atan2(md[1], md[0]);
  if (aimA !== null && aimA !== undefined) h.aim = aimA;
  if (free && ctl.pressed('dash', .12) && h.dashCD <= 0 && h.dashT <= 0) {
    ctl.use('dash'); const a = mlen > .1 ? Math.atan2(md[1], md[0]) : h.facing;
    Object.assign(h, { dashDir: a, dashT: .2, dashCD: .45, facing: a }); h.inv = Math.max(h.inv, .24); h.combo.cancel(); h.thrust.cancel();
    P.dust(h.x, h.y, h.z, 6, { speed: 40 }); P.ring(h.x, h.y, 3, 14, '#bff6ff', .25, h.z); h.rig.kick(-3);
  }
  if (free && h.grounded && ctl.pressed('jump', .12)) { ctl.use('jump'); h.vz = JUMP; h.grounded = false; P.dust(h.x, h.y, h.z, 5, { speed: 30 }); h.rig.kick(-2); }
  if (free && ctl.pressed('attack', .18)) {   // out of a dash it is the thrust (keeping the dash's direction), otherwise the combo's next hit
    const dashing = h.dashT > 0;
    if (dashing ? h.thrust.start() : (!h.thrust.busy && h.combo.press())) { ctl.use('attack'); h.dashT = 0; if (!dashing && h.aim !== undefined) h.facing = h.aim; }
  }
  const A = h.thrust.busy ? h.thrust : h.combo;
  if (h.dashT > 0) { h.dashT -= dt; const u = 1 - h.dashT / .2, sp = 260 * (1 - .5 * u * u); h.vx = Math.cos(h.dashDir) * sp; h.vy = Math.sin(h.dashDir) * sp; }
  else { const slow = A.busy ? .25 : 1, acc = (h.grounded ? 900 : 420) * dt; h.vx = approach(h.vx, md[0] * SPEED * slow, acc); h.vy = approach(h.vy, md[1] * SPEED * slow, acc); }
  const began = A.update(dt), st = A.state, hit = st && HIT[st.spec.name];
  if (began === 'active') { h.vx += Math.cos(h.facing) * hit.push; h.vy += Math.sin(h.facing) * hit.push; }
  if (hit) {
    A.hits(near(h.x, h.y, 4), e => e.alive && e.spawnT <= 0 && inArc3(h, h.facing, e, hit.range, hit.half), e => damageEnemy(e, hit.dmg, Math.atan2(e.y - h.y, e.x - h.x), hit.kb, hit.big));
    A.hits(PROPS, p => Math.abs(p.z - h.z - 8) < 22 && E.inArc(h, h.facing, p, hit.range + 4, hit.half), p => knockProp(p, h.x, h.y, hit.big ? 110 : 75, hit.big ? 60 : 40));
  }
  if (free && ctl.pressed('skill', .15) && h.boltCD <= 0) { ctl.use('skill'); fireBolt(); h.boltCD = .3; h.castT = .18; }
  const cheering = h.cheer > .4 && h.cheer < 1.35;
  if (cheering) h.hop = Math.abs(Math.sin(h.cheer * 4.5)) * 2.5;
  const cam = ctl.cam;
  if (!free) h.facing = E.approachAng(h.facing, h.cheer > .4 ? Math.atan2(cam[1], cam[0]) : h.aim ?? h.facing, dt * 8);
  else if (!A.busy && h.hurtT > 0) h.facing = E.approachAng(h.facing, h.hitA, dt * 30);
  else if (!A.busy && h.dashT <= 0 && h.aim !== undefined) h.facing = E.approachAng(h.facing, h.aim, dt * 16);
  moveHero(dt, h.vx, h.vy);
}
/** put the hero on the floor at (x, y), standing still (tests and agents: a known place to start from) */
SIM.placeHero = function (x, y) {
  const z = floorH(x, y); hero.body.setTranslation({ x, y, z: z + HERO_FOOT + .4 }, true);
  Object.assign(hero, { x, y, z, vx: 0, vy: 0, vz: 0, dashT: 0 });
};
/** the controller moves the capsule as far as it can (sliding along walls, up stairs and slopes, pushing props); the
 *  world's step then carries the body there */
function moveHero(dt, vx, vy) {
  const h = hero;
  h.vz = Math.max(-600, h.vz - GRAVITY * dt);
  h.cc.computeColliderMovement(h.col, { x: vx * dt, y: vy * dt, z: h.vz * dt }, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, HERO_QUERY);
  const m = h.cc.computedMovement(), p = h.body.translation();
  const ground = h.cc.computedGrounded();
  if (ground && h.vz <= 0) h.vz = 0;
  if (!ground && h.vz > 0 && m.z < h.vz * dt * .5) h.vz = 0;   // a head bump
  if (ground && !h.grounded && h.dashT <= 0) { h.rig.kick(-3); P.dust(h.x, h.y, h.z, 4, { speed: 25 }); }
  h.grounded = ground;
  h.body.setNextKinematicTranslation({ x: p.x + m.x, y: p.y + m.y, z: p.z + m.z });
}
function hurtHero(dmg, ang) {
  const h = hero; if (h.inv > 0 || h.dead) return false;
  h.inv = S.god ? .25 : .8; h.hurtT = .22; h.flash = .05; const kb = S.god ? 110 : 170;
  h.hitA = ang + Math.PI;
  h.vx += Math.cos(ang) * kb; h.vy += Math.sin(ang) * kb;
  freeze(.05); shake(3); P.sparks(h.x, h.y, h.z + 12, 6, ang + Math.PI);
  if (S.god) return true;
  h.hp -= dmg; h.combo.cancel(); h.thrust.cancel(); P.text(h.x, h.y, h.z + 30, '-' + dmg, '#ff7a6a');
  if (h.hp <= 0) { h.hp = 0; h.dead = true; h.deadT = 0; P.bits(h.x, h.y, h.z + 8, 20, ['#2f8f86', '#c8452f', '#f1c7a0']); }
  return true;
}
function fireBolt() {
  const h = hero, a = h.aim !== undefined ? h.aim : h.facing; h.facing = a;
  shots.push({ x: h.x + Math.cos(a) * 8, y: h.y + Math.sin(a) * 8, z: h.z + 11, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, vz: 0, life: 1.2, from: 'hero', dmg: 9, color: '#ffb347', core: '#fff3c4', r: 3 });
}

/* ---- combat ---- */
let numCol = null;
function damageNumber(e, dmg, color) {
  const t = SIM.time, c = numCol && t - numCol.t < .12 && Math.hypot(e.x - numCol.x, e.y - numCol.y) < 28 ? numCol : numCol = { x: e.x, y: e.y, z: (e.z || 0) + e.head + 4, n: 0 };
  c.t = t; P.text(c.x, c.y, c.z + (c.n++ % 5) * 8, dmg, color);
}
function damageEnemy(e, dmg, ang, kb, big) {
  e.hp -= dmg; e.flash = big ? .04 : .07; e.stun = .22; e.vx += Math.cos(ang) * kb; e.vy += Math.sin(ang) * kb;
  if (big && S.launch) e.vz = Math.max(e.vz, 70);   // a big hit throws the body up a little (it lands where the push takes it)
  if (e.rig) { e.atk = null; e.rig.kick(2.5); }
  else if (e.type === 'slime') { e.blob.kick(5); e.state = 'idle'; e.t = .5; } else e.charge = 0;
  freeze(big ? .06 : .045); shake(big ? 3 : 2);
  P.sparks(lerp(hero.x, e.x, .6), lerp(hero.y, e.y, .6), e.type === 'wisp' ? e.z : e.z + 10, 7, ang);
  damageNumber(e, dmg, big ? '#ffd36a' : '#fff2c4');
  if (e.hp <= 0) {
    e.alive = false; e.deadT = 0;
    if (e.rig) P.bits(e.x, e.y, e.z + 8, 6, [e.rig.C.skin, e.rig.C.cloth, e.rig.C.boot]);
    else { P.bits(e.x, e.y, e.z + 6, 12, BITS[e.type]); P.ring(e.x, e.y, 3, 22, BITS[e.type][1], .3, e.z); }
    if (e.type === 'wisp') { e.vx = e.vy = 0; P.glints(e.x, e.y, e.z, 10, '#e3c8ff'); removeBody(e); return; }
    // the fallen fly with the blow (a big one throws them high), then slide to a stop; they no longer block the crowd
    if (S.launch) { e.vz = Math.max(e.vz, big ? 170 : 95); e.vx *= 1.3; e.vy *= 1.3; }
    e.col.setCollisionGroups(GROUPS.dead); e.col.setFriction(.9); e.col.setFrictionCombineRule(RAPIER.CoefficientCombineRule.Average);
  }
  if (e.body) e.body.setLinvel({ x: e.vx, y: e.vy, z: e.vz }, true);
}

/* ---- the crowd's AI: each monster's wanted velocity this step ---- */
const _dir = [0, 0];
function steer(e, dt, out) {
  const h = hero;
  if (S.behavior === 'swarm' && !h.dead) {
    const dx = h.x - e.x, dy = h.y - e.y, d = Math.hypot(dx, dy) || 1;
    if (d < 70 && Math.abs(h.z - e.z) < 8) { out[0] = dx / d; out[1] = dy / d; return out; }
    if (FLOW.dir(e.x, e.y, out)) return out;
    out[0] = dx / d; out[1] = dy / d; return out;
  }
  if (S.behavior === 'wander') {
    e.wtT = (e.wtT || 0) - dt;
    if (!e.wt || e.wtT <= 0 || Math.hypot(e.wt[0] - e.x, e.wt[1] - e.y) < 6) {
      e.wtT = 2 + SIM.rnd() * 4;
      const a = SIM.rnd() * TAU, d = 20 + SIM.rnd() * 60, x = e.x + Math.cos(a) * d, y = e.y + Math.sin(a) * d;
      e.wt = solidTile(Math.floor(x / T), Math.floor(y / T)) ? [e.x - Math.cos(a) * 10, e.y - Math.sin(a) * 10] : [x, y];
    }
    const dx = e.wt[0] - e.x, dy = e.wt[1] - e.y, d = Math.hypot(dx, dy) || 1; out[0] = dx / d * .6; out[1] = dy / d * .6; return out;
  }
  out[0] = out[1] = 0; return out;
}
function setVel(e, vx, vy, vz) { e.vx = vx; e.vy = vy; e.vz = vz; e.body.setLinvel({ x: vx, y: vy, z: vz }, true); }
function walkerIntent(e, dt, cam) {
  const h = hero, k = e.kind, dx = h.x - e.x, dy = h.y - e.y, d = Math.hypot(dx, dy) || 1, toH = Math.atan2(dy, dx), A = e.atk, level = Math.abs(h.z - e.z) < 14;
  const stand = Math.max(k.stand[e.next], e.r + h.r + 5);
  let mx = 0, my = 0;
  e.cool -= dt;
  if (e.stun <= 0 && e.grounded) {
    if (A) {
      if (A.phase === 'wind') { e.facing = E.approachAng(e.facing, toH, dt * 2.5); if (Math.abs(d - stand) > 1) { const s = Math.sign(d - stand); mx = dx / d * s; my = dy / d * s; } }
      if (A.update(dt) === 'active' && d > stand) { const v = Math.min(70, Math.sqrt(1000 * (d - stand))); e.vx += Math.cos(e.facing) * v; e.vy += Math.sin(e.facing) * v; }
      A.hits([h], t => level && E.inArc(e, e.facing, t, stand - h.r + 1, 1.1), () => hurtHero(k.dmg, toH) && P.impact(...strikePt(e.rig, A.spec), 6, '#ffb08a'));
      if (!A.busy) { e.atk = null; e.cool = .8 + SIM.rnd(); e.next = (SIM.rnd() * k.specs.length) | 0; }
    } else if (S.behavior === 'swarm' && !h.dead && level) {
      // wait in a ring outside contact distance (further back, and longer, on the camera's side of the hero), swaying
      const front = Math.max(0, -(dx * cam[0] + dy * cam[1]) / d) * cam[2], ring = stand + 10 + 20 * front;
      const sway = Math.sin(SIM.time * .9 + e.ph);
      if (d > ring + 3) { steer(e, dt, _dir); mx = _dir[0]; my = _dir[1]; } else if (d < ring - 3) { mx = -dx / d * .5; my = -dy / d * .5; } else { mx = -dy / d * .4 * sway; my = dx / d * .4 * sway; }
      e.facing = E.approachAng(e.facing, d > ring + 3 ? Math.atan2(my, mx) : toH + sway * .25, dt * 5);
      if (d < ring + 6 && e.cool <= -2 * front && takeTurn()) { e.atk = new E.Attack(k.specs[e.next]); e.atk.start(); }
    } else { steer(e, dt, _dir); mx = _dir[0]; my = _dir[1]; if (mx || my) e.facing = E.approachAng(e.facing, Math.atan2(my, mx), dt * 5); }
  }
  if (e.grounded) { const acc = (e.stun > 0 ? 160 : 500) * dt; setVel(e, approach(e.vx, mx * e.speed, acc), approach(e.vy, my * e.speed, acc), e.vz); }
  else if (e.atk) { e.atk = null; }   // (thrown into the air: the swing is lost)
}
const SLIME_G = GRAVITY, HOP = { vz: 150, air: 2 * 150 / SLIME_G }, POUNCE = { vz: 85, air: 2 * 85 / SLIME_G }, SLIME_RING = 34;
function slimeIntent(e, dt) {
  const h = hero, swarm = S.behavior === 'swarm';
  const dx = h.x - e.x, dy = h.y - e.y, d = Math.hypot(dx, dy) || 1, level = Math.abs(h.z - e.z) < 14;
  if (e.state === 'air' || e.state === 'pounce') {
    e.airT += dt;
    // landed: back on the floor, or stopped falling on something (a crate, a step)
    const landed = e.airT > .1 && (e.z - floorH(e.x, e.y) < 1.2 || (e.pvz < -40 && e.vz > -2));
    if (!landed) {
      if (e.state === 'pounce' && !h.dead && e.z < h.z + 12 && Math.hypot(dx, dy) < e.r + h.r + 1) { hurtHero(6, Math.atan2(dy, dx)); e.state = 'air'; setVel(e, -e.vx * .7, -e.vy * .7, Math.max(e.vz, 90)); }
      return;
    }
    const rest = e.state === 'pounce' ? 1.1 : .45; e.state = 'idle'; e.t = rest + SIM.rnd() * .6; e.blob.kick(-5);
  }
  let vx = approach(e.vx, 0, 400 * dt), vy = approach(e.vy, 0, 400 * dt), vz = e.vz;
  if (e.stun <= 0 && S.behavior !== 'hold' && S.behavior !== 'freeze') {
    e.t -= dt;
    if (e.state === 'wind') { e.blob.kick((SIM.rnd() - .5) * 3); e.facing = Math.atan2(dy, dx); }
    if (e.state === 'idle' && e.t <= 0) {
      const turn = swarm && level && Math.abs(d - SLIME_RING) < 8 && takeTurn();
      e.state = turn ? 'wind' : 'crouch'; e.t = turn ? .5 : .28; e.facing = Math.atan2(dy, dx);
    } else if ((e.state === 'crouch' || e.state === 'wind') && e.t <= 0) {
      const pounce = e.state === 'wind', jump = pounce ? POUNCE : HOP, out = swarm && level && !pounce && d < SLIME_RING;
      const dir = pounce ? [dx, dy] : out ? [-dx, -dy] : steer(e, dt, _dir).slice();
      const l = Math.hypot(dir[0], dir[1]) || 1, len = pounce ? d - e.r - h.r + 3 : swarm && level ? Math.min(Math.abs(d - SLIME_RING), 44) : 44;
      if (len < 4 || !(dir[0] || dir[1])) { e.state = 'idle'; e.t = .3; }
      else { e.state = pounce ? 'pounce' : 'air'; e.airT = 0; vz = jump.vz; vx = dir[0] / l * len / jump.air; vy = dir[1] / l * len / jump.air; e.blob.kick(pounce ? 6 : 4.5); }
    }
  }
  setVel(e, vx, vy, vz);
}
function wispIntent(e, dt) {
  const h = hero, dx = h.x - e.x, dy = h.y - e.y, d = Math.hypot(dx, dy) || 1; e.t += dt;
  let ax = 0, ay = 0;
  if (e.stun <= 0) {
    if (S.behavior === 'swarm') { const want = d > 100 ? 1 : d < 70 ? -1 : 0; ax = dx / d * want * 60 + (-dy / d) * e.orbit * 34; ay = dy / d * want * 60 + (dx / d) * e.orbit * 34; }
    else if (S.behavior === 'wander') { steer(e, dt, _dir); ax = _dir[0] * 50; ay = _dir[1] * 50; }
  }
  const want = floorH(e.x, e.y) + 20 + Math.sin(e.t * 2) * 3;   // it hovers over whatever is below: the floor, the dais, a gallery
  setVel(e, e.vx + (ax - e.vx * 1.6) * dt, e.vy + (ay - e.vy * 1.6) * dt, (want - e.z) * 6);
  if (S.behavior === 'swarm' && !h.dead && e.stun <= 0 && d < 160) {
    if (e.charge > 0) {
      e.charge -= dt;
      if (e.charge <= 0) {   // a shot at the hero's chest, wherever he stands
        const tz = h.z + 14, dz = tz - e.z, L = Math.hypot(dx, dy, dz) || 1;
        shots.push({ x: e.x, y: e.y, z: e.z, vx: dx / L * 95, vy: dy / L * 95, vz: dz / L * 95, life: 3, from: 'enemy', dmg: 8, color: '#c78bff', core: '#f4e6ff', r: 3 });
        e.fire = 2.5 + SIM.rnd() * 2;
      }
    } else { e.fire -= dt; if (e.fire <= 0) e.charge = .6; }
  }
}
function enemiesIntent(dt, cam) {
  for (let i = enemies.length - 1; i >= 0; i--) if (!enemies[i].alive) corpses.push(enemies.splice(i, 1)[0]);
  if (!enemies.length && S.monsters && hero.cheer <= 0 && corpses.every(c => c.deadT > .8)) { hero.cheer = 1.6; note('WAVE ' + ++SIM.wave + ' CLEARED'); P.glints(hero.x, hero.y, hero.z + 26, 14, '#ffd36a'); }
  if (S.behavior === 'freeze') return;
  if (S.behavior === 'swarm') FLOW.update(hero.x, hero.y);
  tokens = 0; for (const e of enemies) if (e.atk || e.state === 'wind' || e.state === 'pounce') tokens++;
  for (const e of enemies) {
    e.flash -= dt; e.stun -= dt;
    if (e.spawnT > 0) { e.spawnT -= dt; continue; }
    if (e.type === 'walker') walkerIntent(e, dt, cam); else if (e.type === 'slime') slimeIntent(e, dt); else wispIntent(e, dt);
  }
}
const DEAD_T = 1.6, POP_T = .35;
function corpsesStep(dt) {
  while (corpses.length > 300) removeBody(corpses.shift());
  for (let i = corpses.length - 1; i >= 0; i--) {
    const e = corpses[i]; e.deadT += dt; e.flash -= dt;
    if (e.deadT > (e.type === 'wisp' ? POP_T : DEAD_T)) { removeBody(e); corpses.splice(i, 1); continue; }
    if (e.body && e.grounded) { const k = 300 * dt; e.body.setLinvel({ x: approach(e.vx, 0, k), y: approach(e.vy, 0, k), z: e.vz }, true); }
  }
}

/* ---- shots: embers and the wisps' bolts fly in 3D; walls, pillars, the floor and props stop them ---- */
function shotsStep(dt) {
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i]; s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
    let dead = s.life <= 0 || s.z < topH(s.x, s.y);
    if (!dead) for (const p of PROPS) if (Math.abs(p.x - s.x) < 9 && Math.abs(p.y - s.y) < 9 && Math.abs(p.z - s.z) < 9) { knockProp(p, s.x - s.vx, s.y - s.vy, 40, 15); dead = true; break; }
    if (!dead && s.from === 'hero') {
      for (const e of near(s.x, s.y)) {
        if (!e.alive || e.spawnT > 0) continue;
        const hit = e.type === 'wisp' ? Math.hypot(e.x - s.x, e.y - s.y, e.z - s.z) < e.r + s.r + 2 : Math.hypot(e.x - s.x, e.y - s.y) < e.r + s.r && s.z > e.z - 2 && s.z < e.z + e.head + 4;
        if (hit) { damageEnemy(e, s.dmg, Math.atan2(s.vy, s.vx), 70, false); dead = true; break; }
      }
    } else if (!dead && s.from === 'enemy' && Math.hypot(hero.x - s.x, hero.y - s.y) < hero.r + s.r && s.z > hero.z - 2 && s.z < hero.z + 30) { hurtHero(s.dmg, Math.atan2(s.vy, s.vx)); dead = true; }
    if (dead) { P.ring(s.x, s.y, 1, 9, s.color, .2, Math.max(0, s.z - 6)); shots.splice(i, 1); }
  }
}
/* ---- the particle storm (the panel's): embers off the lit braziers, sparks and dust round the hero ---- */
let emitAcc = 0;
function storm(dt) {
  P.max = S.pcap;
  if (!S.rate) { emitAcc = 0; return; }
  emitAcc += S.rate * dt;
  const n = S.lights;
  while (emitAcc >= 1) {
    emitAcc--;
    if (n && Math.random() < .45) {
      const b = TORCHES[(Math.random() * n) | 0];
      P.add({ kind: 'ember', x: b.x + (Math.random() - .5) * 6, y: b.y + (Math.random() - .5) * 6, z: b.z + 14, vx: (Math.random() - .5) * 14, vy: (Math.random() - .5) * 14, vz: 20 + Math.random() * 40, max: .8 + Math.random() * .8, color: '#ff8a3a' });
    } else {
      const a = Math.random() * TAU, rr = Math.random() * 170, x = hero.x + Math.cos(a) * rr, y = hero.y + Math.sin(a) * rr, k = Math.random();
      P.add({ kind: k < .55 ? 'spark' : k < .8 ? 'dust' : 'bit', x, y, z: topH(x, y) + 2, vx: (Math.random() - .5) * 60, vy: (Math.random() - .5) * 60, vz: 60 + Math.random() * 120, g: 300, drag: 1.5, bounce: .4, max: .6 + Math.random() * .6, color: k < .8 ? '#ffb85c' : '#7fe3d6', size: 1.3 });
    }
  }
}

/* ---- after the physics: where everything is now ---- */
function readBack() {
  const h = hero, t = h.body.translation();
  h.x = t.x; h.y = t.y; h.z = Math.max(t.z - HERO_FOOT - .3, -40);
  if (h.grounded) { const f = floorH(h.x, h.y); if (Math.abs(h.z - f) < 1.5) h.z = f; }   // (feet on the floor, not the controller's skin above it)
  for (const L of [enemies, corpses]) for (const e of L) {
    if (!e.body) continue;
    const p = e.body.translation(), v = e.body.linvel();
    e.x = p.x; e.y = p.y; e.z = p.z - e.foot; e.pvz = e.vz; e.vx = v.x; e.vy = v.y; e.vz = v.z;
    // on its feet: barely moving up or down, and on the floor or resting on something (not at the top of a throw)
    e.grounded = e.type === 'wisp' || (Math.abs(e.vz) < 6 && (e.z - floorH(e.x, e.y) < 2 || Math.abs(e.vz - e.pvz) < 1));
    if (e.z < -60 || e.x < 0 || e.y < 0 || e.x > HW || e.y > HH) {   // (lost through the world: put it back on the floor)
      const [x, y] = randomFloor(0); e.body.setTranslation({ x, y, z: floorH(x, y) + e.foot + 1 }, true); e.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
  }
  for (const p of PROPS) {
    const q = p.body.translation(), r = p.body.rotation(); p.x = q.x; p.y = q.y; p.z = q.z; p.q[0] = r.x; p.q[1] = r.y; p.q[2] = r.z; p.q[3] = r.w; if (p.hit) p.hit--;
    if (q.z < -60) { const sp = PROP_SPOTS[PROPS.indexOf(p)]; p.body.setTranslation({ x: sp.x, y: sp.y, z: sp.z + 20 }, true); p.body.setLinvel({ x: 0, y: 0, z: 0 }, true); }
  }
}

/* ---- the animation system (shared, unchanged): each rig poses from its body's state ---- */
const CAMP = [0, 1, .5];   // the camera's ground direction and tilt factor this step (from ctl)
let VISIBLE = null;        // (the drawing marks what it saw last frame; with "skip off-screen animation" the rest don't pose)
function settleCape(rig, dt, w) {
  const k = Math.min(1, dt * 16 * w), fx = Math.cos(rig.facing), fy = Math.sin(rig.facing);
  for (const ch of [rig.capeL, rig.capeR]) ch.forEach((n, i) => {
    n.x = lerp(n.x, ch[0].x - fx * i * .5, k); n.y = lerp(n.y, ch[0].y - fy * i * .5, k); n.z = lerp(n.z, ch[0].z - i * HERO_CAPE.seg, k);
    n.px = lerp(n.px, n.x, k); n.py = lerp(n.py, n.y, k); n.pz = lerp(n.pz, n.z, k);
  });
}
function animate(dt) {
  const h = hero, A = h.thrust.busy ? h.thrust : h.combo, free = h.cheer <= 0, cheering = h.cheer > .4 && h.cheer < 1.35;
  if (h.dead) h.rig.update(dt, { x: h.x, y: h.y, z: h.z, facing: h.facing, pose: 'die' });
  else {
    h.rig.update(dt, { x: h.x, y: h.y, z: h.z + h.hop, vx: h.vx, vy: h.vy, facing: h.facing, dash: h.dashT > 0, hurt: h.hurtT > 0 && !A.busy, attack: A.state, air: !h.grounded,
      pose: cheering ? 'cheer' : !free ? 'guard' : h.castT > 0 ? 'cast' : null, expr: h.hurtT > 0 ? 'wince' : cheering ? 'shout' : null });
    if (h.dashT <= 0 && !(A.active && A.state.u < .6) && h.rig.capeL) settleCape(h.rig, dt, h.hurtT > 0 ? 1 : clamp(1 - Math.hypot(h.vx, h.vy) / 60, 0, 1));
  }
  if (S.behavior === 'freeze') return;
  for (const e of enemies) {
    if (S.lod && VISIBLE && !VISIBLE.has(e)) continue;
    if (e.type === 'walker') {
      const pommel = !!(e.atk && e.atk.spec.blade === 0 && e.rig.o.weapon);
      e.rig.update(dt, { x: e.x, y: e.y, z: e.z, vx: e.vx, vy: e.vy, facing: e.facing, hurt: e.stun > 0, attack: e.atk && e.atk.state, stance: e.kind.stance, point: pommel, aim: 1.2,
        air: !e.grounded, expr: e.stun > 0 ? 'wince' : e.atk ? 'angry' : null });
    } else if (e.type === 'slime') {
      e.flap = approach(e.flap, e.state === 'air' || e.state === 'pounce' ? 1 : 0, dt * 5);
      const low = e.state === 'crouch' || e.state === 'wind';
      e.blob.update(dt, { squash: e.state === 'wind' ? -.42 : low ? -.32 : !e.grounded ? clamp(e.vz / 600, -.2, .28) : 0, look: [hero.x - e.x, hero.y - e.y], squint: low, flap: e.flap });
    }
  }
  for (const e of corpses) {
    if (e.rig) e.rig.update(dt, { x: e.x, y: e.y, z: e.z, facing: e.facing, pose: 'die', air: !e.grounded });
    else if (e.blob) { e.flap = approach(e.flap, 0, dt * 5); e.blob.update(dt, { squash: -.42, squint: true, flap: e.flap }); }
  }
}

/* ---- one step ---- */
const _now = () => performance.now();
SIM.step = function (dt, ctl) {
  SIM.real += dt; SIM.shake *= Math.exp(-dt * 9);
  if (SIM.hitstop > 0) { SIM.hitstop -= dt; return; }
  const t0 = _now();
  SIM.time += dt; SIM.n++;
  CAMP[0] = ctl.cam[0]; CAMP[1] = ctl.cam[1]; CAMP[2] = ctl.cam[2];
  rebuildGrid();
  heroIntent(dt, ctl);
  enemiesIntent(dt, CAMP);
  corpsesStep(dt);
  shotsStep(dt);
  storm(dt);
  const t1 = _now();
  const w = SIM.world; w.timestep = dt; if (w.numSolverIterations !== S.iters) w.numSolverIterations = S.iters;
  w.step();
  const t2 = _now();
  readBack();
  animate(dt);
  P.update(dt);
  SIM.ms.physics += t2 - t1; SIM.ms.logic += (t1 - t0) + (_now() - t2);
};
/** the state's hash: the step count, the wave, the hero, every monster and every prop (positions by their float bits) */
SIM.hash = () => {
  const list = [SIM.n, SIM.wave, hero.x, hero.y, hero.z, hero.hp];
  for (const e of enemies) list.push(e.x, e.y, e.z, e.hp);
  for (const p of PROPS) list.push(p.x, p.y, p.z);
  return hashNumbers(list);
};
/** the proof: a fixed fight (a mixed crowd of 40, 16 props), the hero walking a square, swinging, dashing, jumping and
 *  throwing on a timetable; n steps of exactly STEP. Returns the hash. The live game starts again after it */
SIM.run = function (n = 600) {
  const keep = Object.assign({}, S);
  Object.assign(S, { mix: 'balanced', skin: 'mixed', behavior: 'swarm', props: 16, god: true, launch: true, iters: 4, capes: false, lod: false });
  SIM.reset(7); setMonsters(40, true);
  const PATH = [[CXu + 90, CYu + 60], [CXu + 90, CYu - 80], [CXu - 110, CYu - 80], [CXu - 110, CYu + 60]];
  let i = 0;
  const ctl = { move: [0, 0], aim: null, cam: [0, 1, .5], use() {},
    pressed: a => (a === 'attack' && i % 24 === 12) || (a === 'dash' && i % 150 === 75) || (a === 'jump' && i % 200 === 130) || (a === 'skill' && i % 90 === 40) };
  for (i = 0; i < n; i++) {
    const [tx, ty] = PATH[Math.floor(i / 120) % PATH.length], dx = tx - hero.x, dy = ty - hero.y, d = Math.hypot(dx, dy);
    ctl.move = d > 6 ? [dx / d, dy / d] : [0, 0];
    SIM.step(STEP, ctl);
  }
  const out = SIM.hash();
  Object.assign(S, keep);
  return out;
};
