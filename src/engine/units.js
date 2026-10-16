/** The only world-unit boundary. Rapier/engine: X east, Y south, Z up, 16 units/metre. */
export const U = 16;
export const GRAVITY = 9.81 * U;
export const m = metres => metres * U;
export const metres = units => units / U;
export const point = (x, y, z = 0) => ({ x: m(x), y: m(y), z: m(z) });
export const toMetres = p => ({ x: metres(p.x), y: metres(p.y), z: metres(p.z ?? 0) });
export function toThree(E, p, out) { return E.World3D.toThree(p.x, p.y, p.z ?? 0, out); }
export function fromThree(v) { return { x: m(v.x), y: m(v.z), z: m(v.y) }; }
export const yawQuaternion = yaw => ({ x: 0, y: 0, z: Math.sin(yaw / 2), w: Math.cos(yaw / 2) });
// Reflect the physics Z-up coordinate basis to Three's Y-up basis.
export const threeQuaternion = q => ({ x: -q.x, y: -q.z, z: -q.y, w: q.w });
export function rotateLocal(p, yaw, origin = { x: 0, y: 0, z: 0 }) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return { x: origin.x + p.x * c - p.y * s, y: origin.y + p.x * s + p.y * c, z: (origin.z ?? 0) + (p.z ?? 0) };
}
export const metresToUnits = m;
export const unitsToMetres = metres;
