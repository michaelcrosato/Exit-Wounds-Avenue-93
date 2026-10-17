import { m, metres, yawQuaternion, threeQuaternion, rotateLocal } from './units.js';
import { setBodyEnabled } from './body-lifecycle.js';

export const VEHICLE_TUNING = {
  sedan: { mass: 1430, length: 4.55, width: 1.84, height: 1.45, wheelbase: 2.65, track: 1.53, radius: .34, force: 7600, brake: 260, steer: .55, color: '#52676d', seats: 4 },
  van: { mass: 2440, length: 5.2, width: 2.05, height: 2.28, wheelbase: 3.12, track: 1.69, radius: .38, force: 9700, brake: 370, steer: .47, color: '#a3997c', seats: 2 },
  cruiser: { mass: 1750, length: 4.9, width: 1.96, height: 1.51, wheelbase: 2.87, track: 1.61, radius: .35, force: 10600, brake: 330, steer: .53, color: '#d8dfdb', seats: 4 }
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = t => t * t * (3 - 2 * t);

/** Original detailed vehicle silhouettes, local +X is forward. Geometry is authored in metres. */
export function createVehicleVisual(E, kind, color) {
  const T = E.THREE;
  if (!T) return null;
  const tune = VEHICLE_TUNING[kind], root = new T.Group(), wheels = [], doors = [];
  const materials = {};
  const mat = (color0, roughness = .5, metalness = .08) => materials[color0] ||= new T.MeshStandardNodeMaterial({ color: color0, roughness, metalness });
  const paint = mat(color || tune.color, .32, .4), dark = mat('#171c20', .65), trim = mat('#9aafb1', .22, .8), glass = mat('#263d46', .14, .55), rubber = mat('#14181b', .9), interior = mat('#343a38', .9);
  function box(parent, dimensions, position, material, bevel = false) {
    const mesh = new T.Mesh(new T.BoxGeometry(...dimensions), material); mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  glass.transparent = true; glass.opacity = .38; glass.depthWrite = false;
  const L = tune.length, W = tune.width, van = kind === 'van';
  box(root, [L, .48, W], [0, -.08, 0], paint);
  box(root, [L * .97, .12, W + .03], [0, -.31, 0], dark);
  const hood = box(root, [L * .35, .2, W * .94], [L * .32, .23, 0], paint);
  box(root, [L * .23, .2, W * .93], [-L * .39, .23, 0], paint);
  // The cabin leaves window apertures open; seats, dashboard and wheel remain visible.
  const cabinL = van ? L * .71 : L * .48, cabinX = van ? -L * .08 : -.18, roofY = van ? 1.42 : .81;
  box(root, [cabinL, .1, W * .84], [cabinX, roofY, 0], paint);
  for (const side of [-1, 1]) {
    for (const x of [cabinX - cabinL / 2, cabinX + cabinL / 2]) box(root, [.09, roofY - .2, .09], [x, (roofY + .2) / 2, side * W * .41], paint);
    box(root, [.085, roofY - .2, .09], [cabinX, (roofY + .2) / 2, side * W * .41], paint);
    box(root, [cabinL, .08, .1], [cabinX, .25, side * W * .44], trim);
  }
  const frontX = cabinX + cabinL / 2;
  const windshield = box(root, [.035, roofY * .55, W * .77], [frontX, roofY * .64, 0], glass);
  windshield.rotation.z = .13;
  box(root, [.035, roofY * .55, W * .77], [cabinX - cabinL / 2, roofY * .64, 0], glass);
  for (const row of [0, -1]) for (const side of [-1, 1]) {
    if (van && row === -1) continue;
    const x = row ? -.85 : .38, z = side * .44;
    box(root, [.55, .12, .49], [x, -.03, z], interior);
    const seatback = box(root, [.12, .57, .5], [x - .23, .22, z], interior); seatback.rotation.z = -.12;
    box(root, [.13, .2, .33], [x - .25, .59, z], interior);
  }
  box(root, [.22, .26, W * .8], [frontX - .24, .31, 0], dark);
  const steering = new T.Mesh(new T.TorusGeometry(.17, .025, 5, 12), rubber);
  steering.position.set(frontX - .4, .43, -.43); steering.rotation.y = Math.PI / 2; root.add(steering);
  box(root, [.65, .12, .22], [.04, .08, 0], dark);
  for (const side of [-1, 1]) {
    const door = new T.Group(), hinge = frontX - .18;
    door.position.set(hinge, .1, side * W * .46);
    box(door, [.89, .38, .07], [-.45, 0, 0], paint);
    box(door, [.78, .34, .025], [-.44, .36, 0], glass);
    box(door, [.12, .035, .035], [-.73, .06, side * .05], trim);
    root.add(door); doors.push({ group: door, side, angle: 0 });
    box(root, [.18, .11, .17], [frontX - .08, .47, side * (W * .5 + .06)], paint);
  }
  if (van) {
    box(root, [L * .46, 1.1, W * .94], [-L * .24, .73, 0], paint);
    for (const side of [-1, 1]) box(root, [L * .29, .06, .02], [-L * .29, .75, side * W * .48], trim);
    box(root, [.025, .85, .025], [-L * .499, .75, 0], dark);
  }
  const headMat = new T.MeshBasicNodeMaterial({ color: '#ffe4ab' }), rearMat = new T.MeshBasicNodeMaterial({ color: '#9f2920' });
  const brakeLights = [];
  for (const side of [-1, 1]) {
    box(root, [.035, .14, .38], [L / 2 + .005, .09, side * W * .32], headMat);
    brakeLights.push(box(root, [.035, .17, .27], [-L / 2 - .005, .09, side * W * .36], rearMat));
  }
  box(root, [.04, .12, W * .72], [L / 2 + .018, -.08, 0], dark);
  for (const sign of [-1, 1]) box(root, [.06, .13, W + .06], [sign * L * .49, -.19, 0], trim);
  box(root, [.025, .13, .33], [-L / 2 - .04, -.13, 0], mat('#d6d7bf'));
  for (const x of [tune.wheelbase / 2, -tune.wheelbase / 2]) for (const side of [-1, 1]) {
    const pivot = new T.Group(); pivot.position.set(x, -.4, side * tune.track / 2); root.add(pivot);
    const roll = new T.Group(); pivot.add(roll);
    const tire = new T.Mesh(new T.CylinderGeometry(tune.radius, tune.radius, .23, 14), rubber); tire.rotation.x = Math.PI / 2; tire.castShadow = true; roll.add(tire);
    const rim = new T.Mesh(new T.CylinderGeometry(tune.radius * .61, tune.radius * .61, .237, 10), trim); rim.rotation.x = Math.PI / 2; roll.add(rim);
    const hub = box(roll, [.08, tune.radius * 1.1, .245], [0, 0, 0], dark);
    wheels.push({ pivot, roll, tire, rim, hub, x, side });
  }
  let lightbar = null;
  if (kind === 'cruiser') {
    box(root, [L * .44, .13, .025], [-.1, .1, W / 2 + .013], mat('#25363f'));
    box(root, [L * .44, .13, .025], [-.1, .1, -W / 2 - .013], mat('#25363f'));
    lightbar = new T.Group(); lightbar.position.set(-.25, .96, 0); root.add(lightbar);
    box(lightbar, [.31, .11, .8], [0, 0, 0], dark);
    box(lightbar, [.3, .13, .34], [0, .04, -.22], new T.MeshBasicNodeMaterial({ color: '#3768ff' }));
    box(lightbar, [.3, .13, .34], [0, .04, .22], new T.MeshBasicNodeMaterial({ color: '#ed3f36' }));
  }
  const smoke = new T.Group(); smoke.position.set(L * .29, .43, 0); root.add(smoke); smoke.visible = false;
  const smokeMaterial = new T.MeshBasicNodeMaterial({color:'#6b7476',transparent:true,opacity:.18,depthWrite:false});
  for(let i=0;i<5;i++){const puff=new T.Mesh(new T.IcosahedronGeometry(.2,0),smokeMaterial);smoke.add(puff);}
  // Batch unarticulated body geometry by material; doors, hood and wheel rigs remain articulated.
  const staticGroups=new Map();
  for(const child of [...root.children])if(child.isMesh&&child!==hood&&child!==steering){const group=staticGroups.get(child.material)||[];group.push(child);staticGroups.set(child.material,group);}
  for(const [material,meshes] of staticGroups){
    const positions=[],normals=[],uvs=[];
    for(const mesh of meshes){mesh.updateMatrix();const geo=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();geo.applyMatrix4(mesh.matrix);positions.push(...geo.attributes.position.array);normals.push(...geo.attributes.normal.array);uvs.push(...geo.attributes.uv.array);geo.dispose();root.remove(mesh);mesh.geometry.dispose();}
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.computeBoundingSphere();const batch=new T.Mesh(geometry,material);batch.castShadow=batch.receiveShadow=true;root.add(batch);
  }
  const wheelBatches=[];
  for(const partName of ['tire','rim','hub']){const parts=wheels.map(wheel=>wheel[partName]);const instances=new T.InstancedMesh(parts[0].geometry,parts[0].material,4);instances.instanceMatrix.setUsage(T.DynamicDrawUsage);instances.castShadow=instances.receiveShadow=true;instances.frustumCulled=false;for(const part of parts)part.visible=false;root.add(instances);wheelBatches.push({instances,parts});}
  const rootInverse=new T.Matrix4(),wheelMatrix=new T.Matrix4();
  root.name = `vehicle-${kind}`;
  return { root, wheels, doors, brakeLights, lightbar, steering, hood, smoke, paint, wheelBatches, rootInverse, wheelMatrix };
}

/** Rapier raycast wheels share the engine's single physics step. All creation positions are metres. */
export class VehicleSystem {
  constructor(E, world, queries, options = {}) { this.E = E; this.world = world; this.queries = queries; this.list = []; this.byId = new Map(); this.seated = new Map(); this.transitions = new Map(); this.onEvent = options.onEvent || (() => {}); }
  create(options) {
    const R = this.E.RAPIER, kind = options.kind || 'sedan', tune = VEHICLE_TUNING[kind];
    if (!tune) throw new Error(`Unknown vehicle ${kind}`);
    if (this.byId.has(options.id)) throw new Error(`Duplicate vehicle ${options.id}`);
    const pos = { x: m(options.x), y: m(options.y), z: m(options.z ?? .78) }, yaw = options.yaw || 0;
    const body = this.world.pw.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setRotation(yawQuaternion(yaw)).setLinearDamping(.12).setAngularDamping(1.6).setCanSleep(true).setCcdEnabled(true));
    const collider = this.world.pw.createCollider(R.ColliderDesc.cuboid(m(tune.length / 2), m(tune.width / 2), m(.32)).setMass(tune.mass).setFriction(.65).setRestitution(.03).setCollisionGroups(0x0002ffff), body);
    const cabinCollider=this.world.pw.createCollider(R.ColliderDesc.cuboid(m(kind === 'van' ? 1.72 : 1.05),m(tune.width * .43),m(kind === 'van' ? .7 : .35)).setTranslation(m(kind === 'van' ? -.35 : -.18),0,m(kind === 'van' ? .7 : .38)).setDensity(0).setCollisionGroups(0x0002ffff),body);
    const controller = this.world.pw.createVehicleController(body);
    controller.indexUpAxis = 2; controller.setIndexForwardAxis = 0;
    for (const x of [tune.wheelbase / 2, -tune.wheelbase / 2]) for (const side of [-1, 1]) {
      controller.addWheel({ x: m(x), y: m(side * tune.track / 2), z: m(-.12) }, { x: 0, y: 0, z: -1 }, { x: 0, y: -1, z: 0 }, m(.32), m(tune.radius));
      const i = controller.numWheels() - 1;
      controller.setWheelSuspensionStiffness(i, 38);
      controller.setWheelSuspensionCompression(i, 4.5); controller.setWheelSuspensionRelaxation(i, 5.2);
      controller.setWheelMaxSuspensionTravel(i, m(.22)); controller.setWheelMaxSuspensionForce(i, tune.mass * m(9.81) * .8);
      controller.setWheelFrictionSlip(i, 4.7); controller.setWheelSideFrictionStiffness(i, 1);
    }
    const visual = options.visual || createVehicleVisual(this.E, kind, options.color);
    if (visual?.root && this.world.scene) this.world.scene.add(visual.root);
    const vehicle = { id: options.id, kind, tune, body, collider, cabinCollider, colliderHandles:new Set([collider.handle,cabinCollider.handle]), controller, visual, x: pos.x, y: pos.y, z: pos.z, yaw, speed: 0, health: 100, appearance: 0, color: options.color || tune.color, controls: {}, steering: 0, seats: Array(tune.seats).fill(null), locked: !!options.locked, siren: false, disabled: false, previousVelocity: { x: 0, y: 0, z: 0 }, impactCooldown: 0 };
    Object.defineProperty(vehicle, 'position', { get: () => ({ x: metres(vehicle.x), y: metres(vehicle.y), z: metres(vehicle.z) }) });
    this.list.push(vehicle); this.byId.set(vehicle.id, vehicle); this.queries?.register(body, vehicle); this.sync(vehicle); return vehicle;
  }
  get(id) { return typeof id === 'string' ? this.byId.get(id) : id; }
  nearest(actor, maxMetres = 4) { return this.list.filter(v => Math.hypot(v.x - actor.x, v.y - actor.y) < m(maxMetres)).sort((a, b) => Math.hypot(a.x - actor.x, a.y - actor.y) - Math.hypot(b.x - actor.x, b.y - actor.y))[0] || null; }
  setControl(id, frame = {}) { const v = this.get(id); if (v) v.controls = frame; }
  control(id, frame) { this.setControl(id, frame); }
  preStep(dt) {
    for (const v of this.list) {
      const c = v.controls || {}, tune = v.tune, speed = Math.abs(v.speed), alive = v.health > 0 && !v.disabled;
      const throttle = alive ? clamp(c.throttle || 0, 0, 1) : 0, brake = clamp(c.brake || 0, 0, 1), handbrake = c.handbrake || c.held?.has('handbrake');
      const steer = clamp(c.steer ?? c.moveX ?? 0, -1, 1) * tune.steer / (1 + speed / m(23));
      v.steering += (steer - v.steering) * Math.min(1, dt * 7);
      const reverse = alive && c.reverse === true && brake > .1 && v.speed < m(.7) && !handbrake;
      // Raycast-wheel engine force does not wake a Rapier chassis left sleeping
      // during a service stop; deliberate throttle or reverse must wake it.
      if ((throttle > .05 || reverse) && v.body.isSleeping()) v.body.wakeUp();
      const force = (throttle - (reverse ? brake * .65 : 0)) * m(tune.force) * (.36 + .64 * v.health / 100);
      for (let i = 0; i < 4; i++) {
        v.controller.setWheelSteering(i, i < 2 ? v.steering : 0);
        v.controller.setWheelEngineForce(i, i >= 2 ? force / 2 : 0);
        v.controller.setWheelBrake(i, (handbrake && i >= 2 ? m(tune.brake * 3) : 0) + (!reverse ? brake * m(tune.brake) : 0) + (!throttle && !reverse ? m(3) : 0));
        v.controller.setWheelFrictionSlip(i, handbrake && i >= 2 ? 1.2 : 4.7);
      }
      v.previousVelocity = v.body.linvel(); v.impactCooldown = Math.max(0, v.impactCooldown - dt);
      v.controller.updateVehicle(dt, this.E.RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, collider => !v.colliderHandles.has(collider.handle));
    }
    this.updateTransitions(dt);
  }
  postStep(dt) {
    for (const v of this.list) {
      const p = v.body.translation(), q = v.body.rotation(), velocity = v.body.linvel();
      v.x = p.x; v.y = p.y; v.z = p.z; v.yaw = Math.atan2(2 * (q.w * q.z + q.x * q.y), 1 - 2 * (q.y * q.y + q.z * q.z));
      v.speed = velocity.x * Math.cos(v.yaw) + velocity.y * Math.sin(v.yaw);
      const dv = Math.hypot(velocity.x - v.previousVelocity.x, velocity.y - v.previousVelocity.y);
      let contact = false; this.world.pw.contactPairsWith(v.collider, () => { contact = true; });
      if (contact && dv > m(3.7) && !v.impactCooldown) { const damage = clamp((dv / 16 - 3) * 3.2, 0, 55); v.health = Math.max(0, v.health - damage); v.impactCooldown = .45; this.emit('VehicleImpact', v, { damage, deltaSpeed: metres(dv) }); }
      const upZ=1-2*(q.x*q.x+q.y*q.y);
      if (p.z < m(-4) || upZ < .2) v.disabled = true;
      this.sync(v);
      for (let seat = 0; seat < v.seats.length; seat++) if (v.seats[seat] && !this.transitions.has(v.seats[seat])) this.attach(v.seats[seat], v, seat);
    }
  }
  sync(v) {
    const root = v.visual?.root;
    if (!root) return;
    const q = threeQuaternion(v.body.rotation()); root.position.set(metres(v.x), metres(v.z), metres(v.y)); root.quaternion.set(q.x, q.y, q.z, q.w);
    v.visual.wheels?.forEach((wheel, i) => {
      const connection = v.controller.wheelChassisConnectionPointCs(i), length = v.controller.wheelSuspensionLength(i) ?? m(.32);
      wheel.pivot.position.set(metres(connection.x), metres(connection.z - length), metres(connection.y));
      wheel.pivot.rotation.y = i < 2 ? -v.steering : 0;
      wheel.roll.rotation.z = -(v.controller.wheelRotation(i) || 0);
    });
    if(v.visual.wheelBatches){root.updateMatrixWorld(true);v.visual.rootInverse.copy(root.matrixWorld).invert();for(const {instances,parts} of v.visual.wheelBatches){parts.forEach((part,index)=>{v.visual.wheelMatrix.multiplyMatrices(v.visual.rootInverse,part.matrixWorld);instances.setMatrixAt(index,v.visual.wheelMatrix);});instances.instanceMatrix.needsUpdate=true;}}
    if (v.visual.steering) v.visual.steering.rotation.x = -v.steering * 1.6;
    if (v.visual.lightbar) v.visual.lightbar.visible = v.siren ? Math.floor(this.world.time * 9) % 2 === 0 : true;
    if(v.visual.hood) v.visual.hood.rotation.z = (1-v.health/100)*.08;
    if(v.visual.smoke){v.visual.smoke.visible=v.health<48;v.visual.smoke.children.forEach((puff,i)=>{const u=(this.world.time*.55+i*.2)%1;puff.position.set(Math.sin(i*7+this.world.time)*u*.3,u*1.7,Math.cos(i*4)*u*.25);puff.scale.setScalar(.5+u*2.8);});}
    const braking=(v.controls?.brake||0)>.1;for(const lamp of v.visual.brakeLights||[])lamp.material.color.set(braking?'#ff493c':'#9f2920');
    root.userData.health = v.health;
  }
  seatLocal(v, seat) { return { x: m(seat < 2 ? .25 : -.93), y: m(seat % 2 === 0 ? -.45 : .45), z: m(v.kind === 'van' ? -.35 : -.75) }; }
  doorPosition(v, seat, extra = .4) { return rotateLocal({ x: m(seat < 2 ? .05 : -.95), y: m((seat % 2 === 0 ? -1 : 1) * (v.tune.width / 2 + extra)), z: 0 }, v.yaw, v); }
  attach(actor, v, seat) {
    const p = rotateLocal(this.seatLocal(v, seat), v.yaw, v);
    Object.assign(actor, p, { vx: 0, vy: 0, vz: 0, facing: v.yaw, grounded: true, vehicleId: v.id, seatIndex: seat });
    actor.anim = { pose: 'sit', seated: true };
    if (actor.rig && !actor.data?.animationManaged) actor.rig.update(1 / 120, { ...actor, ...(actor.anim || {}) });
  }
  /** @param {any} actor @param {any} id @param {number|string} seat */
  enter(actor, id, seat = 0) {
    const v = this.get(id); seat = seat === 'driver' ? 0 : seat === 'passenger' ? 1 : seat;
    if (!v) return { ok: false, reason: 'missing-vehicle' };
    if (this.seated.has(actor) || this.transitions.has(actor)) return { ok: false, reason: 'busy' };
    if (v.locked) return { ok: false, reason: 'locked' };
    if (v.health <= 0 || v.disabled) return { ok: false, reason: 'disabled' };
    if (Math.abs(v.speed) > m(1.2)) return { ok: false, reason: 'moving' };
    if (v.seats[seat]) return { ok: false, reason: 'occupied' };
    if (Math.hypot(actor.x - v.x, actor.y - v.y) > m(5)) return { ok: false, reason: 'too-far' };
    v.seats[seat] = actor; this.seated.set(actor, { vehicle: v, seat });
    if (actor.body) { actor._seatBody = actor.body; setBodyEnabled(actor._seatBody, false); actor.body = null; }
    actor.vx = actor.vy = actor.vz = 0;
    this.transitions.set(actor, { kind: 'enter', vehicle: v, seat, time: 0, duration: .95, from: { x: actor.x, y: actor.y, z: actor.z }, target: rotateLocal(this.seatLocal(v, seat), v.yaw, v) });
    this.emit('VehicleEntryStarted', v, { actorId: actor.id, seat }); return { ok: true, vehicle: v, seat };
  }
  exit(actor) {
    const seated = this.seated.get(actor); if (!seated) return { ok: false, reason: 'not-seated' };
    if (this.transitions.has(actor)) return { ok: false, reason: 'busy' };
    const { vehicle: v, seat } = seated;
    if (Math.abs(v.speed) > m(2)) return { ok: false, reason: 'moving' };
    let target = null;
    for (const sideSeat of [seat, seat ^ 1]) for (const extra of [.62, 1.1, 1.7]) {
      const p = this.doorPosition(v, sideSeat, extra), floor = this.queries?.floorAt(p.x, p.y, v.z + m(.5), { ignore: [v] }) ?? 0;
      p.z = floor;
      if (floor > m(-2) && (!this.queries || this.queries.capsuleClear(p, actor.r, actor.half, { ignore: [v, actor, actor._seatBody] }))) { target = p; break; }
    }
    if (!target) return { ok: false, reason: 'doors-blocked' };
    this.transitions.set(actor, { kind: 'exit', vehicle: v, seat, time: 0, duration: .85, from: { x: actor.x, y: actor.y, z: actor.z }, target });
    return { ok: true, position: target };
  }
  updateTransitions(dt) {
    for (const [actor, transition] of this.transitions) {
      const t = transition; t.time += dt; const u = clamp(t.time / t.duration, 0, 1), k = smooth(u);
      for (const axis of ['x', 'y', 'z']) actor[axis] = t.from[axis] + (t.target[axis] - t.from[axis]) * k;
      actor.facing = t.vehicle.yaw; actor.anim = { pose: u < .6 ? 'interact' : 'sit', seatTransition: true };
      if (actor.rig && !actor.data?.animationManaged) actor.rig.update(dt, { ...actor, ...actor.anim });
      const door = t.vehicle.visual?.doors?.[t.seat % 2]; if (door) door.group.rotation.y = door.side * Math.sin(u * Math.PI) * 1.05;
      if (u < 1) continue;
      this.transitions.delete(actor);
      if (t.kind === 'enter') { this.attach(actor, t.vehicle, t.seat); this.emit('VehicleEntered', t.vehicle, { actorId: actor.id, seat: t.seat }); }
      else {
        t.vehicle.seats[t.seat] = null; this.seated.delete(actor); actor.vehicleId = null; actor.seatIndex = null;
        actor.body = actor._seatBody; delete actor._seatBody;
        if (actor.body) { setBodyEnabled(actor.body, true); actor.place(t.target.x, t.target.y, t.target.z); }
        actor.anim = {}; this.emit('VehicleExited', t.vehicle, { actorId: actor.id, seat: t.seat });
      }
    }
  }
  cancelTransition(actor) {
    const t = this.transitions.get(actor); if (!t) return false;
    this.transitions.delete(actor);
    if (t.kind === 'enter') {
      t.vehicle.seats[t.seat] = null; this.seated.delete(actor); actor.body = actor._seatBody; delete actor._seatBody;
      if (actor.body) { setBodyEnabled(actor.body, true); actor.place(t.from.x, t.from.y, t.from.z); }
    } else this.attach(actor, t.vehicle, t.seat);
    actor.anim = {}; return true;
  }
  occupant(actor) { return this.seated.get(actor) || null; }
  emit(type, vehicle, payload) { this.onEvent({ type, tick: this.world.n, sourceId: vehicle.id, targetId: payload.actorId || null, payload }); }
  repair(id) { const v = this.get(id); if (!v) return false; v.health = 100; v.disabled = false; v.appearance=(v.appearance||0)+1;v.color=['#38575d','#7b493b','#465d45','#837869'][v.appearance%4];v.visual?.paint?.color.set(v.color);return true; }
  snapshot() { return this.list.map(v => ({ id: v.id, kind: v.kind, position: v.position, rotation: v.body.rotation(), velocity: v.body.linvel(), angularVelocity: v.body.angvel(), health: v.health, color: v.color, appearance:v.appearance, disabled: v.disabled, seats: v.seats.map(a => a?.id || null) })); }
  restore(snapshots, actors = new Map()) {
    // Reconstruct attachments atomically; stale transitions must never retain a seat.
    for(const actor of new Set([...this.seated.keys(),...this.transitions.keys()])) {
      if(actor._seatBody){actor.body=actor._seatBody;delete actor._seatBody;setBodyEnabled(actor.body,true);if(actor.place)actor.place(actor.x,actor.y,actor.z);}
      actor.vehicleId=null;actor.seatIndex=null;actor.anim={};
    }
    this.seated.clear();this.transitions.clear();
    for(const vehicle of this.list){vehicle.seats.fill(null);vehicle.controls={};vehicle.steering=0;for(const door of vehicle.visual?.doors||[])door.group.rotation.y=0;}
    for (const state of snapshots) {
      const v = this.get(state.id) || this.create({ ...state, x: state.position.x, y: state.position.y, z: state.position.z });
      v.body.setTranslation({ x: m(state.position.x), y: m(state.position.y), z: m(state.position.z) }, true); v.body.setRotation(state.rotation, true); v.body.setLinvel(state.velocity, true); v.body.setAngvel(state.angularVelocity, true); v.health = state.health; v.disabled = state.disabled;v.previousVelocity={...state.velocity};v.impactCooldown=.5;v.appearance=state.appearance||0;if(state.color){v.color=state.color;v.visual?.paint?.color.set(state.color);}
      const p=v.body.translation(),q=v.body.rotation();v.x=p.x;v.y=p.y;v.z=p.z;v.yaw=Math.atan2(2*(q.w*q.z+q.x*q.y),1-2*(q.y*q.y+q.z*q.z));
      v.seats.fill(null);
      state.seats.forEach((id, seat) => { const actor = actors.get(id); if (actor) { if (actor.body) { actor._seatBody = actor.body; setBodyEnabled(actor.body,false); actor.body = null; } v.seats[seat] = actor; this.seated.set(actor, { vehicle: v, seat }); this.attach(actor, v, seat); } });
    }
    this.postStep(0);
  }
  dispose() {
    for (const actor of [...this.seated.keys()]) { this.cancelTransition(actor); const entry = this.seated.get(actor); if (entry) { actor.body = actor._seatBody; delete actor._seatBody; if (actor.body) setBodyEnabled(actor.body,true); this.seated.delete(actor); } }
    for (const v of this.list) { this.queries?.unregister(v.body); this.world.pw.removeVehicleController(v.controller); this.world.pw.removeRigidBody(v.body); if (v.visual?.root) {this.world.scene?.remove(v.visual.root);const resources=new Set();v.visual.root.traverse(node=>{if(node.geometry)resources.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:node.material?[node.material]:[])resources.add(material);});for(const resource of resources)resource.dispose();} }
    this.list.length = 0; this.byId.clear(); this.transitions.clear();
  }
}
