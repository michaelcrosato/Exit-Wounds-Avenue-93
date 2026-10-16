import { m, metres } from '../engine/units.js';

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const angleDelta = (a, b) => ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;

/** Smooth right-hand lanes through authored intersections; steering follows a drivable radius. */
function roundedLane(loop, nodes, lane = 2.9) {
  const ids = loop.slice(0, -1), points = [], radius = 12;
  for (let i = 0; i < ids.length; i++) {
    const previous = nodes.get(ids[(i - 1 + ids.length) % ids.length]), current = nodes.get(ids[i]), next = nodes.get(ids[(i + 1) % ids.length]);
    const inLength = Math.hypot(current.x - previous.x, current.y - previous.y), outLength = Math.hypot(next.x - current.x, next.y - current.y);
    const incoming = { x: (current.x - previous.x) / inLength, y: (current.y - previous.y) / inLength };
    const outgoing = { x: (next.x - current.x) / outLength, y: (next.y - current.y) / outLength };
    const cross = incoming.x * outgoing.y - incoming.y * outgoing.x, heading = Math.atan2(incoming.y, incoming.x);
    if (Math.abs(cross) < .01) { points.push({ x: current.x - incoming.y * lane, y: current.y + incoming.x * lane, nodeId: current.id, nodeIndex: i, heading, turnStart: true }); continue; }
    const r = Math.min(radius, inLength * .3, outLength * .3);
    const start = { x: current.x - incoming.x * r - incoming.y * lane, y: current.y - incoming.y * r + incoming.x * lane };
    const end = { x: current.x + outgoing.x * r - outgoing.y * lane, y: current.y + outgoing.y * r + outgoing.x * lane };
    const control = { x: current.x - incoming.y * lane - outgoing.y * lane, y: current.y + incoming.x * lane + outgoing.x * lane };
    for (let j = 0; j <= 5; j++) { const t = j / 5, s = 1 - t; points.push({ x: s * s * start.x + 2 * s * t * control.x + t * t * end.x, y: s * s * start.y + 2 * s * t * control.y + t * t * end.y, nodeId: current.id, nodeIndex: i, heading, turnStart: j === 0 }); }
  }
  return points;
}

/**
 * Ambient cars use the same Rapier raycast-wheel vehicles as the player.
 * This system supplies controls before VehicleSystem.preStep; it never steps physics.
 */
export class TrafficSystem {
  constructor({ E, world, roadGraph, vehicles, queries, onCrime = (_event = null) => {}, count = 12, seed = 93 }) {
    this.E = E; this.world = world; this.graph = roadGraph; this.vehicles = vehicles; this.queries = queries; this.onCrime = onCrime;
    this.records = []; this.actors = []; this.reservations = new Map(); this.time = 0; this.seed = seed; this.pendingThefts = [];
    this.nodes = new Map(roadGraph.nodes.map(n => [n.id, n]));
    const loops = roadGraph.loops.filter(loop => loop.length > 3);
    const colors = ['#737c71', '#a49b7e', '#646f82', '#8f6352', '#5c7774', '#979a94'];
    for (let i = 0; i < count; i++) {
      const loop = loops[i % loops.length], edgeIndex = (Math.floor(i / loops.length) + i) % (loop.length - 1);
      const from = this.nodes.get(loop[edgeIndex]), to = this.nodes.get(loop[edgeIndex + 1]);
      const fraction = .2 + (Math.floor(i / loops.length) % 3) * .26;
      const yaw = Math.atan2(to.y - from.y, to.x - from.x), lane = 2.9;
      const x = from.x + (to.x - from.x) * fraction - Math.sin(yaw) * lane;
      const y = from.y + (to.y - from.y) * fraction + Math.cos(yaw) * lane;
      // Deterministic spacing prevents stacked initial cars even when loops share an edge.
      if (this.records.some(r => Math.hypot(r.vehicle.position.x - x, r.vehicle.position.y - y) < 11)) continue;
      const vehicle = vehicles.create({ id: `ambient-car-${i}`, kind: i % 5 === 4 ? 'van' : 'sedan', x, y, z: .82, yaw, color: colors[i % colors.length] });
      const driver = this.createDriver(i, x, y, yaw);
      vehicles.enter(driver, vehicle, 0);
      // Initial population is already seated at boot; no unfinished .95s transition enters a checkpoint.
      vehicles.transitions.delete(driver); vehicles.attach(driver, vehicle, 0);
      const route = roundedLane(loop, this.nodes, lane), index = (edgeIndex + 1) % (loop.length - 1);
      const routeIndex = route.findIndex(point => point.nodeIndex === index && point.turnStart);
      const record = { id: vehicle.id, vehicle, driver, loop, route, routeIndex, index, lane, wait: .4 + i * .08, stalled: 0, reverse: 0, fleeing: false, abandoned: false, previous: { x, y }, progress: 0, targetSpeed: 6 + (i % 3) * 1.3, crossingNode: null, blockedTime: 0, detour: null };
      this.records.push(record);
    }
    this.initialState = this.snapshot();
  }
  createDriver(i, x, y, yaw) {
    const colors = ['#776650', '#48656b', '#7d5553', '#68734f', '#7f7d71', '#444f62'];
    const actor = this.world.hero({ x: m(x), y: m(y), z: 0, r: 4.1, half: 8.7, mass: 75, facing: yaw, look: 'puppet',
      rig: new this.E.Humanoid({ build: 'heroic', size: .98, weapon: null, outfit: 'shirt', sleeves: 'long', hat: i % 3 === 0 ? 'cap' : null,
        colors: { skin: i % 2 ? '#a77c60' : '#bf997d', hair: '#2b3031', cloth: colors[i % colors.length], pants: '#313b3d', boot: '#262a2c', belt: '#493f33' } }) });
    actor.id = `civilian-driver-${i}`; actor.data.entityId = actor.id; actor.anim = { pose: 'sit' }; this.actors.push(actor); return actor;
  }
  /** A short ordinary exit/entry sequence, interruptible by VehicleSystem collision rules. */
  attemptTake(vehicleOrId, playerActor) {
    const vehicle = this.vehicles.get(vehicleOrId), record = this.records.find(r => r.vehicle === vehicle);
    if (!record || record.abandoned || vehicle.seats[0] !== record.driver) return { ok: false, reason: 'not-ambient-driver' };
    if (Math.abs(vehicle.speed) > m(1.2)) return { ok: false, reason: 'moving' };
    if (Math.hypot(playerActor.x - vehicle.x, playerActor.y - vehicle.y) > m(5)) return { ok: false, reason: 'too-far' };
    if (this.pendingThefts.some(t => t.vehicle === vehicle)) return { ok: false, reason: 'busy' };
    const result = this.vehicles.exit(record.driver);
    if (!result.ok) return result;
    record.abandoned = true; record.fleeing = true; this.vehicles.setControl(vehicle, { throttle: 0, brake: 0, handbrake: true });
    this.pendingThefts.push({ vehicle, playerActor, record, elapsed: 0 });
    return { ok: true, pending: true, vehicle };
  }
  /** An impact interrupts a taking sequence without leaving a seated driver in a permanently abandoned car. */
  cancelTake(vehicleOrId) {
    const vehicle=this.vehicles.get(vehicleOrId),index=this.pendingThefts.findIndex(t=>t.vehicle===vehicle);
    if(index<0)return false;
    const theft=this.pendingThefts.splice(index,1)[0],record=theft.record,driver=record.driver;
    this.vehicles.cancelTransition(driver);
    if(!this.vehicles.occupant(driver)&&vehicle.health>0&&!vehicle.disabled&&Math.abs(vehicle.speed)<m(1.2))this.vehicles.enter(driver,vehicle,0);
    const seated=!!this.vehicles.occupant(driver);
    record.abandoned=!seated;record.fleeing=!seated;
    this.vehicles.setControl(vehicle,{throttle:0,brake:1,handbrake:true});
    return true;
  }
  signalAllows(nodeId, heading) {
    const signal = this.graph.signals?.find(s => s.id === nodeId);
    if (!signal) return true;
    const phase = this.time % signal.period, horizontal = Math.abs(Math.cos(heading)) > .7;
    return horizontal ? phase < signal.green : phase > signal.period / 2 && phase < signal.period / 2 + signal.green;
  }
  update(dt, context = {}) {
    this.time += dt;
    for (const [id, reservation] of this.reservations) if (reservation.until < this.time) this.reservations.delete(id);
    for (const record of this.records) {
      const v = record.vehicle;
      if (record.fleeing && !this.vehicles.occupant(record.driver)) {
        const fleeYaw = v.yaw + (Number(record.id.replace(/\D/g, '')) % 2 ? 1 : -1) * Math.PI / 2;
        record.driver.vx = Math.cos(fleeYaw) * m(3.7); record.driver.vy = Math.sin(fleeYaw) * m(3.7); record.driver.facing = fleeYaw;
        record.driver.anim = { sprint: true, stance: 'ready' };
        const p = { x: metres(record.driver.x), y: metres(record.driver.y) };
        if (p.x < 28 || p.x > 445 || p.y < 30 || p.y > 388) { record.driver.vx = record.driver.vy = 0; record.driver.anim = { pose: 'phone' }; }
      }
      if (record.abandoned || v.seats[0] !== record.driver || v.health <= 0 || v.disabled) continue;
      if (record.wait > 0) { record.wait -= dt; this.vehicles.setControl(v, { throttle: 0, brake: 0, handbrake: true }); continue; }
      const p = v.position;
      let point = record.route[record.routeIndex], distance = Math.hypot(point.x - p.x, point.y - p.y);
      if (distance < 3.5) { record.routeIndex = (record.routeIndex + 1) % record.route.length; point = record.route[record.routeIndex]; distance = Math.hypot(point.x - p.x, point.y - p.y); }
      record.index = point.nodeIndex;
      const target = this.nodes.get(point.nodeId), heading = point.heading, nodeDistance = Math.hypot(target.x - p.x, target.y - p.y);
      const desiredYaw = Math.atan2(point.y - p.y, point.x - p.x), error = angleDelta(v.yaw, desiredYaw);
      let targetSpeed = record.targetSpeed * Math.max(.25, 1 - Math.abs(error) * .45);
      if (nodeDistance < 22) targetSpeed = Math.min(targetSpeed, 4.8);
      let blocked = false, obstruction = null, obstructionDistance = Infinity, pedestrianBlocked = false;
      for (const other of this.vehicles.list) {
        if (other === v) continue;
        const ox = (other.x - v.x) / 16, oy = (other.y - v.y) / 16;
        const forward = ox * Math.cos(v.yaw) + oy * Math.sin(v.yaw), lateral = Math.abs(-ox * Math.sin(v.yaw) + oy * Math.cos(v.yaw));
        if (forward > 0 && forward < 10 + Math.abs(v.speed) / 16 && lateral < 2.6) {
          blocked = true; targetSpeed = Math.min(targetSpeed, Math.max(0, (forward - 6) * .9));
          if (forward < obstructionDistance) { obstruction = other; obstructionDistance = forward; }
        }
      }
      // A visible crossing pedestrian or player has priority.
      const people = [...(context.pedestrians || []), context.playerPosition].filter(Boolean);
      for (const person of people) {
        const point = person.position || person, ox = point.x - p.x, oy = point.y - p.y;
        const ahead = ox * Math.cos(v.yaw) + oy * Math.sin(v.yaw), side = Math.abs(-ox * Math.sin(v.yaw) + oy * Math.cos(v.yaw));
        if (ahead > 0 && ahead < 9 && side < 2.4) { blocked = true; pedestrianBlocked = true; targetSpeed = 0; }
      }
      record.blockedTime = obstruction && Math.abs(obstruction.speed) < m(.6) && !pedestrianBlocked ? record.blockedTime + dt : 0;
      if (record.blockedTime > 5 && !record.detour && nodeDistance > 30) {
        // A stopped car is a local navigation obstruction, rather than a permanent queue.
        // Reserve the opposing gap, pass slowly with real wheel steering, then merge back.
        const c = Math.cos(heading), s = Math.sin(heading), o = obstruction.position;
        const targets = [
          { x: o.x + s * 3.9, y: o.y - c * 3.9 },
          { x: o.x + c * 9 + s * 3.9, y: o.y + s * 9 - c * 3.9 },
          { x: o.x + c * 20, y: o.y + s * 20 },
        ];
        const oncoming = this.vehicles.list.some(other => {
          if (other === v || other === obstruction) return false;
          const op = other.position, forward = (op.x - p.x) * c + (op.y - p.y) * s;
          return forward > -4 && forward < 28 && Math.cos(other.yaw - heading) < -.5 && Math.hypot(op.x - targets[0].x, op.y - targets[0].y) < 28;
        });
        const staticHit = this.queries?.sphereSweep({ x: v.x, y: v.y, z: m(1.2) }, { x: m(targets[0].x), y: m(targets[0].y), z: m(1.2) }, m(.9), { staticOnly: true });
        if (!oncoming && !staticHit) { record.detour = targets; record.blockedTime = 0; }
      }
      if (record.detour && !pedestrianBlocked) {
        while (record.detour.length && Math.hypot(record.detour[0].x - p.x, record.detour[0].y - p.y) < 2.2) record.detour.shift();
        if (record.detour.length) {
          const detour = record.detour[0], turn = angleDelta(v.yaw, Math.atan2(detour.y - p.y, detour.x - p.x)), speed = v.speed / 16;
          this.vehicles.setControl(v, { throttle: clamp((2.8 - speed) * .18, 0, .4), brake: speed > 3.3 ? .4 : 0, steer: clamp(turn * 2.1, -1, 1) });
          continue;
        }
        record.detour = null;
      }
      if (record.crossingNode) {
        const oldNode = this.nodes.get(record.crossingNode);
        if (Math.hypot(oldNode.x - p.x, oldNode.y - p.y) > 19) { if (this.reservations.get(record.crossingNode)?.id === record.id) this.reservations.delete(record.crossingNode); record.crossingNode = null; }
      }
      if (nodeDistance < 27 && record.crossingNode !== target.id) {
        const held = this.reservations.get(target.id);
        if (!this.signalAllows(target.id, heading) || (held && held.id !== record.id)) targetSpeed = Math.min(targetSpeed, Math.max(0, nodeDistance - 16) * .8);
        else if (nodeDistance < 23) { this.reservations.set(target.id, { id: record.id, until: this.time + 7 }); record.crossingNode = target.id; }
      }
      const progress = Math.hypot(p.x - record.previous.x, p.y - record.previous.y); record.previous = { x: p.x, y: p.y };
      record.stalled = progress < .015 && targetSpeed > 1 && !blocked ? record.stalled + dt : Math.max(0, record.stalled - dt * 2);
      if (record.stalled > 4.5) { record.reverse = 1.5; record.stalled = 0; }
      if (record.reverse > 0) { record.reverse -= dt; this.vehicles.setControl(v, { throttle: 0, brake: .45, reverse: true, steer: -Math.sign(error || 1) * .8 }); continue; }
      const speed = v.speed / 16;
      this.vehicles.setControl(v, { throttle: clamp((targetSpeed - speed) * .15, 0, .65), brake: targetSpeed < .1 ? 0 : speed > targetSpeed + .5 ? clamp((speed - targetSpeed) * .2, 0, 1) : 0, handbrake: targetSpeed < .1, steer: clamp(error * 1.65, -1, 1) });
    }
    for (const theft of [...this.pendingThefts]) {
      theft.elapsed += dt;
      if (this.vehicles.transitions.has(theft.record.driver)) continue;
      if (theft.elapsed > 3 || Math.hypot(theft.playerActor.x - theft.vehicle.x, theft.playerActor.y - theft.vehicle.y) > m(7)) { this.pendingThefts.splice(this.pendingThefts.indexOf(theft), 1); continue; }
      const result = this.vehicles.enter(theft.playerActor, theft.vehicle, 0);
      if (result.ok) {
        this.onCrime({ kind: 'theft', position: theft.vehicle.position, vehicleId: theft.vehicle.id, witnessId: theft.record.driver.id, severity: 1 });
        this.pendingThefts.splice(this.pendingThefts.indexOf(theft), 1);
      }
    }
  }
  get activeCount() { return this.records.filter(r => !r.abandoned).length; }
  snapshot() {
    return { time: this.time, seed: this.seed, records: this.records.map(r => ({ id: r.id, index: r.index, routeIndex: r.routeIndex, wait: r.wait, stalled: r.stalled, reverse: r.reverse, fleeing: r.fleeing, abandoned: r.abandoned, previous: { ...r.previous }, blockedTime: r.blockedTime, detour: r.detour?.map(p => ({ ...p })) || null, driverPosition: { x: metres(r.driver.x), y: metres(r.driver.y), z: metres(r.driver.z) }, driverFacing: r.driver.facing, seated: r.vehicle.seats[0] === r.driver })) };
  }
  /** Restore vehicle snapshots first, passing traffic.actors in the VehicleSystem actor map. */
  restore(snapshot) {
    if (!snapshot) return this.reset();
    this.time = snapshot.time || 0; this.seed = snapshot.seed || 93; this.reservations.clear(); this.pendingThefts.length = 0;
    for (const s of snapshot.records || []) {
      const r = this.records.find(r0 => r0.id === s.id); if (!r) continue;
      Object.assign(r, { index: s.index, routeIndex: s.routeIndex ?? r.route.findIndex(p => p.nodeIndex === s.index && p.turnStart), crossingNode: null, wait: s.wait || 0, stalled: s.stalled || 0, reverse: s.reverse || 0, fleeing: !!s.fleeing, abandoned: !!s.abandoned, previous: { ...s.previous }, blockedTime: s.blockedTime || 0, detour: s.detour?.map(p => ({ ...p })) || null });
      if (!s.seated && r.driver.body) r.driver.place(m(s.driverPosition.x), m(s.driverPosition.y), m(s.driverPosition.z || 0));
      if (s.seated && !this.vehicles.occupant(r.driver) && !r.vehicle.seats[0]) {
        r.driver.place(r.vehicle.x, r.vehicle.y, 0);
        const result = this.vehicles.enter(r.driver, r.vehicle, 0);
        if (result.ok) { this.vehicles.transitions.delete(r.driver); this.vehicles.attach(r.driver, r.vehicle, 0); }
      }
      r.driver.facing = s.driverFacing || 0; r.driver.vx = r.driver.vy = 0;
    }
  }
  reset() { this.restore(structuredClone(this.initialState)); }
  dispose() {
    for (const record of this.records) {
      const v = record.vehicle, actor = record.driver;
      this.vehicles.cancelTransition(actor); this.vehicles.seated.delete(actor);
      if (actor._seatBody) { actor.body = actor._seatBody; delete actor._seatBody; }
      this.world.remove?.(actor); this.queries?.unregister?.(v.body);
      try { this.world.pw.removeVehicleController(v.controller); this.world.pw.removeRigidBody(v.body); } catch { /* World owner may have disposed first. */ }
      v.visual?.root?.removeFromParent();
      const owned = new Set(); v.visual?.root?.traverse(o => { if (o.geometry) owned.add(o.geometry); for (const mat of Array.isArray(o.material) ? o.material : [o.material]) if (mat) owned.add(mat); });
      for (const resource of owned) resource.dispose?.();
      const index = this.vehicles.list.indexOf(v); if (index >= 0) this.vehicles.list.splice(index, 1); this.vehicles.byId.delete(v.id);
    }
    this.pendingThefts.length = 0; this.reservations.clear();
    this.records.length = 0; this.actors.length = 0;
  }
}
