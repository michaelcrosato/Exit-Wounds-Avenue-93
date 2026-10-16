/** @typedef {import('../game/state.js').GameState} GameState */
/** @typedef {import('../game/events.js').Position} Position */
export const POLICE_TIERS = Object.freeze({
  1: { patrols: 1, officers: 2, roadblocks: 0, radius: 60, clearSeconds: 8 },
  2: { patrols: 2, officers: 4, roadblocks: 0, radius: 100, clearSeconds: 12 },
  3: { patrols: 3, officers: 6, roadblocks: 1, radius: 140, clearSeconds: 16 },
});
/** Geographical clearance and identification are separate from merely dispatching police. */
export class WantedSystem {
  /** @param {GameState} state */
  constructor(state) { this.state = state; }
  get active() { return this.state.wanted.tier > 0; }
  get response() { return this.active ? POLICE_TIERS[this.state.wanted.tier] : null; }

  /** @param {import('./crime.js').CrimeReport} report */
  receiveReport(report) {
    const w = this.state.wanted;
    if (w.reportsReceived.includes(report.id)) return { ok: false, reason: 'already-reported' };
    w.reportsReceived.push(report.id);
    w.tier = /** @type {1|2|3} */ (Math.min(3, Math.max(w.tier, report.severity)));
    w.radius = POLICE_TIERS[w.tier].radius;
    w.lastKnown = { ...report.position };
    if (report.observedPersonId) w.personId = report.observedPersonId;
    if (report.observedVehicleId && !w.vehicleIds.includes(report.observedVehicleId)) w.vehicleIds.push(report.observedVehicleId);
    if (!w.visible) w.status = 'Dispatched';
    w.unseenSeconds = 0; w.clearProgress = 0;
    return { ok: true };
  }

  /**
   * Caller supplies a genuine unobstructed police observation. Unknown people require
   * `confirmedSuspect` (e.g. observed committing the offense), never proximity alone.
   * @param {{position:Position,personId?:string|null,vehicleId?:string|null,confirmedSuspect?:boolean}} observation
   */
  sight(observation) {
    const w = this.state.wanted;
    if (!this.active) return { ok: false, reason: 'no-investigation' };
    const personKnown = observation.personId && observation.personId === w.personId;
    const carKnown = observation.vehicleId && w.vehicleIds.includes(observation.vehicleId);
    if (!personKnown && !carKnown && !observation.confirmedSuspect) return { ok: false, reason: 'unidentified' };
    if (observation.personId) w.personId = observation.personId;
    if (observation.vehicleId && !w.vehicleIds.includes(observation.vehicleId)) w.vehicleIds.push(observation.vehicleId);
    w.lastKnown = { ...observation.position }; w.lastSeenTick = this.state.tick;
    w.visible = true; w.status = 'Pursuing'; w.unseenSeconds = 0; w.clearProgress = 0;
    return { ok: true };
  }

  /** Call once perception finds no officer with current sight. */
  loseSight() {
    const w = this.state.wanted;
    w.visible = false;
    if (this.active && w.status === 'Pursuing') w.status = 'Searching';
  }

  /** Update only on fixed simulation time. The player must be unseen AND outside the search region. @param {number} dt @param {Position} [position] */
  tick(dt, position = this.state.player.position) {
    const w = this.state.wanted;
    if (!this.active || w.visible) return { ok: true, cleared: false };
    if (w.status === 'Dispatched') w.status = 'Searching';
    w.unseenSeconds += Math.max(0, dt);
    const outside = !w.lastKnown || Math.hypot(position.x - w.lastKnown.x, position.y - w.lastKnown.y) > w.radius;
    w.clearProgress = outside ? w.clearProgress + Math.max(0, dt) : 0;
    if (w.clearProgress + 1e-6 < POLICE_TIERS[w.tier].clearSeconds) return { ok: true, cleared: false };
    w.tier = 0; w.status = 'Cleared'; w.radius = 0; w.visible = false;
    w.personId = null; w.vehicleIds = []; w.lastKnown = null; w.unseenSeconds = 0; w.clearProgress = 0;
    return { ok: true, cleared: true };
  }

  /** A seen switch links the new car. An unseen switch does not erase person identification. @param {string|null} oldId @param {string|null} newId @param {boolean} seen */
  changeVehicle(oldId, newId, seen) {
    if (!this.active) return { ok: true, identified: false };
    const w = this.state.wanted;
    if (seen && newId && !w.vehicleIds.includes(newId)) w.vehicleIds.push(newId);
    if (seen && w.personId === null) w.personId = this.state.player.id;
    return { ok: true, identified: Boolean(seen || (newId && w.vehicleIds.includes(newId))) };
  }

  /** Respray is allowed under heat only after losing actual sight. @param {string} vehicleId */
  respray(vehicleId) {
    const w = this.state.wanted;
    if (w.visible) return { ok: false, reason: 'police-can-see-vehicle' };
    w.vehicleIds = w.vehicleIds.filter(id => id !== vehicleId);
    return { ok: true };
  }

  /** @param {{safe:boolean,holstered:boolean,heldSeconds:number}} context */
  surrender(context) {
    if (this.state.wanted.tier !== 1 || !context.safe || !context.holstered || context.heldSeconds < 1) return { ok: false, reason: 'surrender-unavailable' };
    this.state.wanted.surrendered = true;
    this.state.mission.failure = { reason: 'Arrested. Retry the last checkpoint.', tick: this.state.tick };
    return { ok: true };
  }
}
