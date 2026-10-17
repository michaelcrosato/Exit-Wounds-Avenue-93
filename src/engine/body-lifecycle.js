/** Rapier SIMD can retain a solver contact when a touching body is disabled.
 * Suspend its collider solver masks before disabling the body, then restore
 * the exact masks after re-enabling it. Keep collision/query groups intact.
 */
const suspendedSolverGroups = new WeakMap();

/** @param {any} body @param {boolean} enabled */
export function setBodyEnabled(body, enabled) {
  if (!body) return;
  if (!enabled) {
    let masks = suspendedSolverGroups.get(body);
    if (!masks) { masks = new Map(); suspendedSolverGroups.set(body, masks); }
    for (let index = 0; index < body.numColliders(); index++) {
      const collider = body.collider(index);
      if (!masks.has(collider.handle)) masks.set(collider.handle, { collider, mask: collider.solverGroups() });
      collider.setSolverGroups(0);
    }
    body.setEnabled(false);
    return;
  }
  body.setEnabled(true);
  const masks = suspendedSolverGroups.get(body);
  if (masks) {
    for (const { collider, mask } of masks.values()) if (collider.isValid()) collider.setSolverGroups(mask);
    suspendedSolverGroups.delete(body);
  }
}
