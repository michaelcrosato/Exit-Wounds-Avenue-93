import { WantedSystem } from './wanted.js';
/** @typedef {import('../game/state.js').GameState} GameState */
/** @typedef {import('../game/events.js').Position} Position */
/** @typedef {'theft'|'assault'|'gunfire'|'collision'|'homicide'|'depot-alarm'} CrimeKind */
/** @typedef {{id:string,kind:CrimeKind,position:Position,severity:1|2|3,perpetratorId:string|null,vehicleId:string|null,tick:number}} CrimeIncident */
/** @typedef {{id:string,crimeId:string,witnessId:string,witnessKind:'civilian'|'police'|'remote',position:Position,severity:1|2|3,observedPersonId:string|null,observedVehicleId:string|null,delay:number,elapsed:number,status:'Reporting'|'Dispatched'|'Cancelled'}} CrimeReport */
export class CrimeSystem {
  /** @param {GameState} state @param {WantedSystem} [wanted] */
  constructor(state, wanted = new WantedSystem(state)) { this.state = state; this.wanted = wanted; }
  /** Recording an unwitnessed crime never identifies anyone or creates heat. @param {CrimeIncident} incident */
  recordCrime(incident) {
    if (this.state.crime.incidents.some(c => c.id === incident.id)) return { ok: false, reason: 'duplicate-crime' };
    this.state.crime.incidents.push(structuredClone(incident));
    return { ok: true, crimeId: incident.id };
  }
  /** @param {{crimeId:string,witnessId:string,witnessKind:'civilian'|'police',hasLineOfSight:boolean,seesPerson?:boolean,seesVehicle?:boolean,reportDelay?:number}} observation */
  observe(observation) {
    const crime = this.state.crime.incidents.find(c => c.id === observation.crimeId);
    if (!crime) return { ok: false, reason: 'unknown-crime' };
    if (!observation.hasLineOfSight) return { ok: false, reason: 'occluded' };
    const id = `${crime.id}:report:${observation.witnessId}`;
    if (this.state.crime.reports.some(r => r.id === id)) return { ok: false, reason: 'duplicate-observation' };
    /** @type {CrimeReport} */
    const report = {
      id, crimeId: crime.id, witnessId: observation.witnessId, witnessKind: observation.witnessKind,
      position: { ...crime.position }, severity: crime.severity,
      observedPersonId: observation.seesPerson ? crime.perpetratorId : null,
      observedVehicleId: observation.seesVehicle ? crime.vehicleId : null,
      delay: observation.witnessKind === 'police' ? 0 : Math.max(0, observation.reportDelay ?? 3), elapsed: 0, status: 'Reporting',
    };
    this.state.crime.reports.push(report);
    if (report.delay === 0) {
      this.dispatch(report);
      this.wanted.sight({ position: crime.position, personId: report.observedPersonId, vehicleId: report.observedVehicleId, confirmedSuspect: true });
    } else if (!this.wanted.active) this.state.wanted.status = 'Reporting';
    return { ok: true, report };
  }
  /** Wired alarm supplies a location and offense, never Mara's identity or a car. @param {Position} position @param {string} [id] */
  remoteAlarm(position, id = `${this.state.runId}:depot-alarm`) {
    this.recordCrime({ id, kind: 'depot-alarm', position, severity: 2, perpetratorId: null, vehicleId: null, tick: this.state.tick });
    if (this.state.crime.reports.some(r => r.id === `${id}:dispatcher`)) return { ok: false, reason: 'duplicate-alarm' };
    /** @type {CrimeReport} */
    const report = { id: `${id}:dispatcher`, crimeId: id, witnessId: 'depot-dispatcher', witnessKind: 'remote', position: { ...position }, severity: 2, observedPersonId: null, observedVehicleId: null, delay: 0, elapsed: 0, status: 'Reporting' };
    this.state.crime.reports.push(report); this.dispatch(report);
    return { ok: true, report };
  }
  /** A witness whose call has not completed can be interrupted. @param {string} witnessId */
  interruptReport(witnessId) {
    let interrupted = false;
    for (const report of this.state.crime.reports) if (report.witnessId === witnessId && report.status === 'Reporting') { report.status = 'Cancelled'; interrupted = true; }
    if (!this.wanted.active && !this.state.crime.reports.some(r => r.status === 'Reporting')) this.state.wanted.status = 'Unaware';
    return { ok: interrupted };
  }
  /** @param {number} dt */
  tick(dt) {
    /** @type {CrimeReport[]} */ const dispatched = [];
    for (const report of this.state.crime.reports) {
      if (report.status !== 'Reporting') continue;
      report.elapsed += Math.max(0, dt);
      if (report.elapsed + 1e-6 >= report.delay) { this.dispatch(report); dispatched.push(report); }
    }
    if (this.state.tick > 0 && this.state.tick % 1200 === 0) this.pruneHistory();
    return dispatched;
  }
  /** Keep active calls and recent evidence; old completed calls no longer drive pursuit. */
  pruneHistory() {
    const s = this.state, cutoff = s.tick - 120 * 45;
    const pending = new Set(s.crime.reports.filter(r => r.status === 'Reporting').map(r => r.crimeId));
    const kept = s.crime.incidents.filter(c => c.tick >= cutoff || pending.has(c.id));
    const recent = kept.length > 256 ? kept.slice(-256) : kept;
    const ids = new Set(recent.map(c => c.id));
    s.crime.incidents = recent;
    const reporting = s.crime.reports.filter(r => r.status === 'Reporting');
    const resolvedBudget = Math.max(0, 384 - reporting.length);
    const resolved = resolvedBudget ? s.crime.reports.filter(r => r.status !== 'Reporting' && ids.has(r.crimeId)).slice(-resolvedBudget) : [];
    s.crime.reports = [...resolved, ...reporting];
    const reportIds = new Set(s.crime.reports.map(r => r.id));
    s.wanted.reportsReceived = s.wanted.reportsReceived.filter(id => reportIds.has(id));
  }
  /** @param {CrimeReport} report */
  dispatch(report) { report.status = 'Dispatched'; this.wanted.receiveReport(report); }
}
