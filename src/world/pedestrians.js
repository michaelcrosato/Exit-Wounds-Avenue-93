import { m, metres } from '../engine/units.js';

const OUTFITS = [
  { cloth: '#826d58', pants: '#343e43', skin: '#c19a7b', hair: '#372e29', hat: 'cap' },
  { cloth: '#4d7077', pants: '#292f3d', skin: '#ad7858', hair: '#252829', hat: null },
  { cloth: '#825951', pants: '#3d4544', skin: '#d0ab91', hair: '#514536', hat: null },
  { cloth: '#65734d', pants: '#303b3f', skin: '#986c51', hair: '#252828', hat: 'cap' },
  { cloth: '#878779', pants: '#3c3734', skin: '#bc9273', hair: '#40362f', hat: null },
  { cloth: '#4e5974', pants: '#353c3a', skin: '#c9a18a', hair: '#29252a', hat: null },
];

/** Street life, fear and evidence-backed civilian calls, using engine kinematic actors. */
export class PedestrianSystem {
  constructor({ E, world, footGraph, queries, crime = null, onCrime = (_event = null) => {}, count = 24, seed = 2193 }) {
    this.E = E; this.world = world; this.graph = footGraph; this.queries = queries; this.crime = crime; this.onCrime = onCrime;
    this.records = []; this.actors = []; this.pendingCrimes = []; this.seed = seed; this.time = 0;
    this.nodes = new Map(footGraph.nodes.map(n => [n.id, n]));
    this.ambientNodes = footGraph.nodes.filter(n => /^f\d\d$/.test(n.id) || ['market', 'food', 'armor', 'garage-lane-west'].includes(n.id));
    const allowed = new Set(this.ambientNodes.map(n => n.id));
    this.edges = footGraph.edges.filter(e => allowed.has(e.from) && allowed.has(e.to));
    for (let i = 0; i < count; i++) {
      const node = this.ambientNodes[i % this.ambientNodes.length], outfit = OUTFITS[i % OUTFITS.length];
      const x = node.x + ((i % 3) - 1) * 1.1, y = node.y + (Math.floor(i / 6) % 3) * 1.1;
      const actor = world.hero({ x: m(x), y: m(y), z: 0, r: 4.1, half: 8.7, mass: 72, step: 4, snap: 4, look: 'puppet',
        rig: new E.Humanoid({ build: 'heroic', size: .94 + (i % 3) * .035, weapon: null, outfit: i % 2 ? 'shirt' : 'jacket', sleeves: 'long', hat: outfit.hat,
          colors: { ...outfit, boot: '#292b2b', belt: '#4d4336' } }) });
      actor.id = `resident-${i}`; actor.data.entityId = actor.id; actor.facing = this.random() * Math.PI * 2;
      this.actors.push(actor); this.queries?.register?.(actor.body, actor);
      this.records.push({ actor, id: actor.id, nodeId: node.id, targetId: null, previousId: null, state: i % 4 ? 'walk' : 'wait', wait: .5 + this.random() * 4, fear: 0, danger: null, stalled: 0, previous: { x, y }, identified: new Set() });
    }
    this.initialState = this.snapshot();
  }
  random() { this.seed ^= this.seed << 13; this.seed ^= this.seed >>> 17; this.seed ^= this.seed << 5; return (this.seed >>> 0) / 4294967296; }
  position(record) { return { x: metres(record.actor.x), y: metres(record.actor.y), z: metres(record.actor.z) }; }
  see(record, point, radius = 44, targetId = null) {
    const p = this.position(record);
    return Math.hypot(p.x - point.x, p.y - point.y) < radius && (!this.queries || this.queries.lineOfSight({ ...p, z: p.z + 1.5 }, { ...point, z: (point.z || 0) + 1.1 }, { exclude: [record.actor], targetId, endpointTolerance: 1.2 }));
  }
  /** Root records a crime, then asks residents to inspect it. Occluded crimes remain unwitnessed. */
  witness(incident) {
    if (!incident.id) incident = { ...incident, id: `street-crime-${this.world.n}-${this.pendingCrimes.length}`, perpetratorId: 'mara', tick: this.world.n };
    this.crime?.recordCrime(incident);
    if (this.pendingCrimes.some(c => c.incident.id === incident.id)) return;
    const candidates = this.records.filter(r => this.see(r, incident.position, incident.kind === 'gunfire' ? 60 : 40, incident.vehicleId||null));
    this.pendingCrimes.push({ incident, candidates: candidates.map(r => ({ record: r, seen: 0, called: false, lost: 0 })), age: 0 });
    this.fear(incident.position, incident.kind === 'gunfire' ? 60 : 24);
  }
  fear(position, radius = 35) {
    for (const record of this.records) if (Math.hypot(this.position(record).x - position.x, this.position(record).y - position.y) < radius) { record.fear = Math.max(record.fear, 8); record.danger = { ...position }; record.state = 'flee'; }
  }
  chooseTarget(record) {
    let choices = this.edges.filter(e => e.from === record.nodeId && e.to !== record.previousId);
    if (!choices.length) choices = this.edges.filter(e => e.from === record.nodeId);
    if (!choices.length) { record.state = 'wait'; record.wait = 3; return; }
    record.targetId = choices[Math.floor(this.random() * choices.length)].to;
  }
  update(dt, context = {}) {
    this.time += dt;
    if (context.noise?.position) this.fear(context.noise.position, context.noise.radius || 35);
    for (const record of this.records) {
      const actor = record.actor, p = this.position(record);
      record.fear = Math.max(0, record.fear - dt);
      if (record.fear && record.danger) {
        const dx = p.x - record.danger.x, dy = p.y - record.danger.y, length = Math.hypot(dx, dy) || 1;
        let vx = dx / length, vy = dy / length;
        // Turn along a visible obstruction; the KCC resolves the last few centimetres.
        if (this.queries && !this.queries.lineOfSight({ ...p, z: p.z + .9 }, { x: p.x + vx * 2, y: p.y + vy * 2, z: p.z + .9 }, { exclude: [actor], endpointTolerance: .1 })) [vx, vy] = [-vy, vx];
        if (p.x < 30 && vx < 0 || p.x > 444 && vx > 0) vx = -vx;
        if (p.y < 32 && vy < 0 || p.y > 387 && vy > 0) vy = -vy;
        actor.vx = m(vx * 3.1); actor.vy = m(vy * 3.1); actor.facing = Math.atan2(vy, vx); actor.anim = { sprint: true, stance: 'ready' }; continue;
      }
      if (record.state === 'flee') {
        const nearest = this.ambientNodes.filter(n => this.see(record, n, 80)).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
        if (nearest) { record.nodeId = nearest.id; record.targetId = nearest.id; record.previousId = null; }
        record.state = 'wait'; record.wait = 2.5;
      }
      if (record.wait > 0) { record.wait -= dt; actor.vx = actor.vy = 0; actor.anim = { pose: record.state === 'report' ? 'phone' : (Number(record.id.split('-')[1]) % 2 ? 'hips' : 'idle') }; continue; }
      if (!record.targetId) this.chooseTarget(record);
      const target = this.nodes.get(record.targetId); if (!target) continue;
      const dx = target.x - p.x, dy = target.y - p.y, distance = Math.hypot(dx, dy);
      if (distance < 1.1) { record.previousId = record.nodeId; record.nodeId = target.id; record.targetId = null; record.wait = this.random() < .35 ? .8 + this.random() * 3 : 0; actor.vx = actor.vy = 0; continue; }
      const edge = this.edges.find(e => e.from === record.nodeId && e.to === record.targetId);
      let waitForCar = false;
      if (edge?.crossing && context.vehicles) for (const vehicle of context.vehicles) {
        const v = vehicle.position || vehicle;
        if (Math.hypot(v.x - p.x, v.y - p.y) < 9 && Math.abs((vehicle.speed || 0) / 16) > 1) { waitForCar = true; break; }
      }
      const movement = Math.hypot(p.x - record.previous.x, p.y - record.previous.y); record.previous = { x: p.x, y: p.y };
      record.stalled = movement < .003 ? record.stalled + dt : 0;
      if (record.stalled > 3) { record.targetId = null; record.previousId = null; record.wait = .4; record.stalled = 0; }
      actor.vx = waitForCar ? 0 : m(dx / distance * (1.02 + Number(record.id.split('-')[1]) % 3 * .12));
      actor.vy = waitForCar ? 0 : m(dy / distance * (1.02 + Number(record.id.split('-')[1]) % 3 * .12));
      actor.facing = Math.atan2(dy, dx); actor.anim = { stance: 'ready' };
    }
    for (const pending of [...this.pendingCrimes]) {
      pending.age += dt;
      const suspect = context.playerPosition || pending.incident.position;
      for (const candidate of pending.candidates) {
        const record = candidate.record, sees = this.see(record, suspect, 46,context.playerVehicleId===pending.incident.vehicleId?pending.incident.vehicleId:null);
        if (!candidate.called) {
          candidate.seen = sees ? candidate.seen + dt : 0;
          // Leaving before a face/vehicle is identified can prevent a call.
          if (candidate.seen < .8) continue;
          candidate.called = true; record.state = 'report'; record.wait = 3; record.fear = 0;
          this.crime?.observe({ crimeId: pending.incident.id, witnessId: record.id, witnessKind: 'civilian', hasLineOfSight: true, seesPerson: !pending.incident.vehicleId, seesVehicle: !!pending.incident.vehicleId, reportDelay: 2.8 });
          this.onCrime({ type: 'CivilianReporting', witnessId: record.id, incident: pending.incident });
        }
        candidate.lost = sees ? 0 : candidate.lost + dt;
      }
      if (pending.age > 5) this.pendingCrimes.splice(this.pendingCrimes.indexOf(pending), 1);
    }
  }
  get positions() { return this.records.map(record => this.position(record)); }
  snapshot() {
    return { time: this.time, seed: this.seed, records: this.records.map(r => ({ id: r.id, position: this.position(r), facing: r.actor.facing, nodeId: r.nodeId, targetId: r.targetId, previousId: r.previousId, state: r.state, wait: r.wait, fear: r.fear, danger: r.danger && { ...r.danger }, stalled: r.stalled, previous: { ...r.previous }, identified: [...r.identified] })), pendingCrimes: this.pendingCrimes.map(p => ({ incident: structuredClone(p.incident), age: p.age, candidates: p.candidates.map(c => ({ id: c.record.id, seen: c.seen, called: c.called, lost: c.lost })) })) };
  }
  restore(snapshot) {
    if (!snapshot) return this.reset();
    this.time = snapshot.time || 0; this.seed = snapshot.seed || 2193;
    for (const s of snapshot.records || []) {
      const r = this.records.find(record => record.id === s.id); if (!r) continue;
      Object.assign(r, { nodeId: s.nodeId, targetId: s.targetId, previousId: s.previousId, state: s.state, wait: s.wait || 0, fear: s.fear || 0, danger: s.danger && { ...s.danger }, stalled: s.stalled || 0, previous: { ...s.previous }, identified: new Set(s.identified || []) });
      r.actor.place(m(s.position.x), m(s.position.y), m(s.position.z || 0)); r.actor.facing = s.facing || 0; r.actor.vx = r.actor.vy = 0;
    }
    this.pendingCrimes = (snapshot.pendingCrimes || []).map(p => ({ incident: structuredClone(p.incident), age: p.age, candidates: p.candidates.map(c => ({ record: this.records.find(r => r.id === c.id), seen: c.seen, called: c.called, lost: c.lost })).filter(c => c.record) }));
  }
  reset() { this.restore(structuredClone(this.initialState)); }
  dispose() { for (const actor of this.actors) { this.queries?.unregister?.(actor.body); this.world.remove?.(actor); } this.pendingCrimes.length = 0; }
}
