import { m } from './units.js';
const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };
/** All gameplay queries explicitly include dynamic props and vehicles, unlike world.clear(). */
export class QuerySystem {
  constructor(E, world) { this.E = E; this.world = world; this.entities = new Map(); }
  register(body, entity) { if (body) { this.entities.set(body.handle, entity); body.userData = { ...(body.userData || {}), entityId: entity.id }; } return entity; }
  unregister(body) { if (body) this.entities.delete(body.handle); }
  entity(collider) { return this.entities.get(collider?.parent()?.handle) || null; }
  predicate(options = {}) {
    const ignored = new Set([...(options.ignore || []), options.ignoreEntity].filter(Boolean));
    return collider => {
      const body = collider.parent(), entity = this.entities.get(body?.handle);
      if (ignored.has(collider) || ignored.has(body) || ignored.has(entity) || ignored.has(entity?.id)) return false;
      if (options.staticOnly && !body?.isFixed() && !body?.isKinematic()) return false;
      if (options.ignoreActors && (collider.collisionGroups() >>> 16 & (4 | 8 | 16 | 32))) return false;
      return !options.filter || options.filter(collider, entity);
    };
  }
  ray(from, to, options = {}) {
    const R = this.E.RAPIER, dx = to.x - from.x, dy = to.y - from.y, dz = (to.z ?? 0) - (from.z ?? 0), length = Math.hypot(dx, dy, dz);
    if (length < 1e-6) return null;
    const dir = { x: dx / length, y: dy / length, z: dz / length };
    const hit = this.world.pw.castRayAndGetNormal(new R.Ray(from, dir), length, true, R.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, undefined, this.predicate(options));
    if (!hit) return null;
    const distance = hit.timeOfImpact;
    return { ...hit, distance, point: { x: from.x + dir.x * distance, y: from.y + dir.y * distance, z: (from.z ?? 0) + dir.z * distance }, body: hit.collider.parent(), entity: this.entity(hit.collider) };
  }
  raycast(from, to, options = {}) {
    const scale = p => ({ x: m(p.x), y: m(p.y), z: m(p.z ?? 0) });
    const hit = this.ray(scale(from), scale(to), { ...options, ignore: options.ignoreIds || options.exclude || options.ignore || [] });
    return hit ? { ...hit, point: { x: hit.point.x / 16, y: hit.point.y / 16, z: hit.point.z / 16 }, distance: hit.distance / 16 } : null;
  }
  lineOfSight(from, to, options = {}) { const hit = this.raycast(from, to, options); return !hit || (options.target != null && hit.entity === options.target) || (options.targetId != null && hit.entity?.id === options.targetId) || Math.hypot(hit.point.x - to.x, hit.point.y - to.y, hit.point.z - (to.z ?? 0)) < (options.endpointTolerance ?? .8); }
  visible(from, to, options = {}) {
    const hit = this.ray(from, to, options);
    return !hit || hit.distance >= Math.hypot(to.x - from.x, to.y - from.y, (to.z ?? 0) - (from.z ?? 0)) - .15;
  }
  sphereSweep(from, to, radius, options = {}) {
    const R = this.E.RAPIER, velocity = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
    return this.world.pw.castShape(from, IDENTITY, velocity, new R.Ball(radius), .02, 1, true, R.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, undefined, this.predicate(options));
  }
  capsuleClear(position, radius = m(.3), half = m(.6), options = {}) {
    const R = this.E.RAPIER;
    let blocked = false;
    this.world.pw.intersectionsWithShape({ x: position.x, y: position.y, z: position.z + radius + half + .4 }, { x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 }, new R.Capsule(half, radius), () => { blocked = true; return false; }, R.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, undefined, this.predicate(options));
    return !blocked;
  }
  floorAt(x, y, nearZ = m(2), options = {}) {
    const hit = this.ray({ x, y, z: nearZ + m(.24) }, { x, y, z: nearZ - m(50) }, { ignoreActors: true, ...options });
    return hit ? hit.point.z : this.world.bottom;
  }
  /** Camera chooses a target; muzzle obstruction remains authoritative. */
  shot(cameraFrom, cameraTo, muzzle, options = {}) {
    const target = this.ray(cameraFrom, cameraTo, options)?.point || cameraTo;
    return { target, hit: this.ray(muzzle, target, options) };
  }
}
