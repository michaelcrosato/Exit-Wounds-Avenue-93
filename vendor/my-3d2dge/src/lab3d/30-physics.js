/* =============================================================================
 * GAMEPLAY AND PHYSICS: Rapier 0.19.3 (SIMD) on the CPU at a fixed 60 Hz. Nothing here reads the renderer, and the
 * renderer only reads this: the same inputs give the same state, and the same hash, on WebGPU, WebGL 2 or no renderer.
 *   SIM.reset()              builds the world from ROOM (20-world): a collider per wall and pillar, the floor, the crates,
 *                            the hero's capsule, and a post for each of the cast's other two at their spots
 *   SIM.step(input)          one fixed step. input: { move: [x, z] (a ground direction in metres, length 0..1), attack, dash }
 *                            attack and dash are presses (true on the step the button went down)
 *   SIM.hash(), SIM.state()  the state's hash (the hero, every crate, the step count) and a readable copy
 *   SIM.run(n)               reset, then n steps of SCRIPT: the proof run (the same hash on every backend)
 *   LAP(t), SCRIPT(i)        the hero's lap round the pillars, and the proof run's inputs
 * The hero is a kinematic capsule moved by Rapier's character controller: it walks, slides along walls, pushes crates
 * (the controller hands impulses to dynamic bodies) and its swings knock crates away (an impulse in the swing's arc).
 * Its attacks are the engine's own E.Combo of E.MOVES, so the timing is the engine's. Dan swings at the air on a
 * timetable; the mocap figure stands at its spot. Both are posts the hero can't walk through.
 * ============================================================================= */
await RAPIER.init();
const HERO = { radius: .3, half: .55, walk: 4.6, lapSpeed: 42 / U, dash: 11, dashTime: .16, dashRest: .45, accel: 40, reach: 1.7 };
/** the hero's lap: a rounded rectangle round the outside of the pillars (t in radians), as in the free camera room */
function LAP(t, out = [0, 0]) {
  const c = Math.cos(t), s = Math.sin(t), cx = ROOM.W / 2, cz = ROOM.H / 2;
  out[0] = cx + 4.6 * Math.sign(c) * Math.sqrt(Math.abs(c)); out[1] = cz + 3.6 * Math.sign(s) * Math.sqrt(Math.abs(s));
  return out;
}
/** the proof run: walk through the crates, swinging, with a dash now and then (each leg 100 steps) */
const SCRIPT_PATH = [[5.0, 3.6], [6.2, 4.8], [8.4, 4.6], [8.1, 6.9], [5.3, 6.9], [2.5, 5.0]];
function SCRIPT(i, h) {
  const [tx, tz] = SCRIPT_PATH[Math.floor(i / 100) % SCRIPT_PATH.length], dx = tx - h.x, dz = tz - h.z, d = Math.hypot(dx, dz);
  return { move: d > .25 ? [dx / d, dz / d] : [0, 0], attack: i >= 40 && i % 24 === 12, dash: i % 150 === 75 };
}
// Dan's timetable: a swing every 150 steps (right, left, a whirl), and a roar after the whirl. Moves as Emberdeep's Dan has them
const DAN_MOVES = [
  Object.assign({}, E.MOVES.slash, { name: 'dan_cut', hand: 'R', wind: .08, recover: .22 }),
  Object.assign({}, E.MOVES.backslash, { name: 'dan_cut2', hand: 'L', wind: .07, recover: .22 }),
  { name: 'dan_whirl', hand: 'both', spin: 2, wind: .12, active: .6, recover: .25 }
];

const SIM = { world: null, n: 0 };
SIM.reset = function () {
  if (SIM.world) SIM.world.free();
  const world = SIM.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = STEP;
  const fixed = (x, y, z) => world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z));
  // the floor, then a box for every wall and pillar cell (the map's own heights)
  world.createCollider(RAPIER.ColliderDesc.cuboid(ROOM.W / 2, .5, ROOM.H / 2).setFriction(.8), fixed(ROOM.W / 2, -.5, ROOM.H / 2));
  for (const c of ROOM.cells) { const h = c.kind === 'pillar' ? PILLAR_H : WALL_H; world.createCollider(RAPIER.ColliderDesc.cuboid(.5, h / 2, .5), fixed(c.x + .5, h / 2, c.z + .5)); }
  // the stores (20-world): a box each from E.shapeBox, turned about three's y as the shape turns about the engine's z
  for (const st of STORES) { const b = E.shapeBox(st.id, st.x, st.y, st.z, st.o), h = (b.top - b.z) / U, t = -Math.atan2(b.s, b.c) / 2;
    world.createCollider(RAPIER.ColliderDesc.cuboid(b.hx / U, h / 2, b.hy / U).setRotation({ x: 0, y: Math.sin(t), z: 0, w: Math.cos(t) }).setFriction(.8), fixed(b.x / U, h / 2, b.y / U)); }
  // the crates: dynamic boxes (about 20 kg each)
  SIM.crates = ROOM.crates.map(k => {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), k.yaw);
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(k.x, k.y, k.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }).setAngularDamping(.6).setLinearDamping(.2));
    world.createCollider(RAPIER.ColliderDesc.cuboid(CRATE / 2, CRATE / 2, CRATE / 2).setDensity(48).setFriction(.7).setRestitution(.05), body);
    return { body, hit: 0 };
  });
  // the hero: a kinematic capsule on the lap's start, moved by the character controller
  const [sx, sz] = LAP(0), y0 = HERO.half + HERO.radius + .02;
  const hb = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(sx, y0, sz));
  const hc = world.createCollider(RAPIER.ColliderDesc.capsule(HERO.half, HERO.radius), hb);
  const cc = world.createCharacterController(.02);
  cc.enableSnapToGround(.3); cc.setMaxSlopeClimbAngle(50 * Math.PI / 180); cc.setSlideEnabled(true);
  cc.setApplyImpulsesToDynamicBodies(true); cc.setCharacterMass(60);
  SIM.hero = { body: hb, col: hc, cc, x: sx, y: 0, z: sz, vx: 0, vz: 0, vy: 0, facing: Math.PI / 2, lapT: 0, dashT: 0, dashCool: 0, dashDir: [0, 0],
    combo: new E.Combo(['slash', 'backslash', 'spin'].map(n => new E.Attack(n)), { window: .3 }), moved: [0, 0] };
  // the other two: posts at their spots (they do not move), Dan with his timetable of swings
  const post = (s, r) => { world.createCollider(RAPIER.ColliderDesc.cylinder(.9, r), fixed(s.x, .9, s.z)); return { x: s.x, z: s.z }; };
  SIM.figure = Object.assign(post(ROOM.spots.m, .32), { facing: 0 });
  SIM.dan = Object.assign(post(ROOM.spots.d, .5), { facing: Math.PI, atk: null, k: 0, roar: 0, hurt: 0 });
  SIM.figure.facing = Math.atan2(ROOM.centre.z - SIM.figure.z, ROOM.centre.x - SIM.figure.x);
  SIM.n = 0;
};

SIM.step = function (inp) {
  const h = SIM.hero, dt = STEP, world = SIM.world;
  // 1. where the hero wants to go: the input's direction at walking pace (snappy: a high acceleration), or a dash
  h.combo.update(dt);
  if (inp.attack) h.combo.press();
  h.dashCool = Math.max(0, h.dashCool - dt);
  if (inp.dash && h.dashCool <= 0 && h.dashT <= 0) { const m = Math.hypot(inp.move[0], inp.move[1]); h.dashDir = m > .1 ? [inp.move[0] / m, inp.move[1] / m] : [Math.cos(h.facing), Math.sin(h.facing)]; h.dashT = HERO.dashTime; h.dashCool = HERO.dashRest; h.combo.cancel(); }
  let tx = inp.move[0] * (inp.speed || HERO.walk), tz = inp.move[1] * (inp.speed || HERO.walk);
  const swinging = h.combo.busy;
  if (swinging) { tx *= .25; tz *= .25; if (h.combo.active) { tx += Math.cos(h.facing) * 1.4; tz += Math.sin(h.facing) * 1.4; } }   // a swing roots the hero, with a small lunge
  if (h.dashT > 0) { h.dashT -= dt; tx = h.dashDir[0] * HERO.dash; tz = h.dashDir[1] * HERO.dash; }
  h.vx = E.approach(h.vx, tx, HERO.accel * dt); h.vz = E.approach(h.vz, tz, HERO.accel * dt);
  h.vy = Math.max(-20, h.vy - 9.81 * dt);
  // 2. the controller moves the capsule as far as it can (sliding along walls, shoving crates), then the world steps
  h.cc.computeColliderMovement(h.col, { x: h.vx * dt, y: h.vy * dt, z: h.vz * dt });
  const m = h.cc.computedMovement(), p = h.body.translation();
  if (h.cc.computedGrounded()) h.vy = 0;
  h.body.setNextKinematicTranslation({ x: p.x + m.x, y: p.y + m.y, z: p.z + m.z });
  // 3. the swing's hits: crates in the arc in front (all round for the spin) fly off, Dan flinches
  if (h.combo.active) {
    const spec = h.combo.current.spec, half = spec.spin ? Math.PI : 1.3;
    const inArc = (x, z) => { const dx = x - h.x, dz = z - h.z; return Math.hypot(dx, dz) < HERO.reach + .4 && Math.abs(E.angDiff(h.facing, Math.atan2(dz, dx))) < half; };
    h.combo.hits(SIM.crates, c => { const t = c.body.translation(); return inArc(t.x, t.z); }, c => {
      const t = c.body.translation(), dx = t.x - h.x, dz = t.z - h.z, d = Math.hypot(dx, dz) || 1, k = c.body.mass();
      c.body.applyImpulse({ x: dx / d * 4.2 * k, y: 2.6 * k, z: dz / d * 4.2 * k }, true);
      c.body.applyTorqueImpulse({ x: dz / d * .4 * k, y: .3 * k, z: -dx / d * .4 * k }, true);
      c.hit = 12;
    });
    h.combo.hits([SIM.dan], d => inArc(d.x, d.z), d => { d.hurt = .3; });
  }
  world.step();
  // 4. read the result back: the hero's feet, real velocity (for the rig's stride) and facing
  const q = h.body.translation(), mx = q.x - h.x, mz = q.z - h.z;
  h.moved = [mx / dt, mz / dt]; h.x = q.x; h.z = q.z; h.y = q.y - HERO.half - HERO.radius;
  const want = Math.hypot(tx, tz) > .3 ? Math.atan2(tz, tx) : null;
  if (want !== null && !(swinging && h.combo.active)) h.facing = E.approachAng(h.facing, want, dt * (swinging ? 4 : 14));
  for (const c of SIM.crates) if (c.hit) c.hit--;
  // 5. Dan: face the hero, swing on the timetable, flinch when hit
  const D = SIM.dan; D.hurt = Math.max(0, D.hurt - dt); D.roar = Math.max(0, D.roar - dt);
  D.facing = E.approachAng(D.facing, Math.atan2(h.z - D.z, h.x - D.x), dt * 3);
  if (D.atk) { D.atk.update(dt); if (!D.atk.busy) { if (D.atk.spec.spin) D.roar = .9; D.atk = null; } }
  if (SIM.n % 150 === 90) { D.atk = new E.Attack(DAN_MOVES[D.k++ % DAN_MOVES.length]); D.atk.start(); }
  SIM.n++;
};
/** the input for live play: walk the lap (with a three-hit combo every four seconds), or the player's */
SIM.lapInput = function () {
  const h = SIM.hero, p = [0, 0];
  for (let k = 0; k < 40; k++) { LAP(h.lapT, p); if (Math.hypot(p[0] - h.x, p[1] - h.z) > .7) break; h.lapT += .03; }
  const dx = p[0] - h.x, dz = p[1] - h.z, d = Math.hypot(dx, dz) || 1, c = SIM.n % 240;
  return { move: [dx / d, dz / d], speed: HERO.lapSpeed, attack: c === 120 || c === 138 || c === 156, dash: false };
};
SIM.hash = () => {
  const h = SIM.hero, list = [SIM.n, h.x, h.y, h.z, h.facing];
  for (const c of SIM.crates) { const t = c.body.translation(), r = c.body.rotation(); list.push(t.x, t.y, t.z, r.x, r.y, r.z, r.w); }
  return hashNumbers(list);
};
SIM.state = () => ({
  step: SIM.n, hash: SIM.hash(),
  hero: { x: SIM.hero.x, y: SIM.hero.y, z: SIM.hero.z, facing: SIM.hero.facing, attacking: SIM.hero.combo.busy },
  crates: SIM.crates.map(c => { const t = c.body.translation(); return [t.x, t.y, t.z]; })
});
SIM.run = function (n) {
  SIM.reset();
  for (let i = 0; i < n; i++) SIM.step(SCRIPT(i, SIM.hero));
  return SIM.hash();
};
