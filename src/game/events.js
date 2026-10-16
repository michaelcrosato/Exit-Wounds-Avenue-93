/**
 * @typedef {'JobAccepted'|'CollectionCompleted'|'ApproachCommitted'|'JunReached'|'CaseRecovered'|'EnemyDefeated'|'VehicleEntered'|'CompanionExtracted'|'WantedCleared'|'EndingChosen'|'HandoffRequested'|'HandoffCommitted'|'FavorStarted'|'FavorCompleted'|'ActorDown'|'ActorFailed'|'DialogueAcknowledged'|'CrimeObserved'|'ReportCompleted'|'RemoteAlarmTriggered'|'CheckpointRequested'|'MissionPhaseChanged'|'MissionCompleted'|'PurchaseCompleted'|'WeaponFired'|'ReloadCompleted'|'DamageApplied'} EventType
 * @typedef {{x:number,y:number,z:number}} Position
 * @typedef {{route?:'gate'|'service',enemyId?:string,actorId?:string,vehicleId?:string,seat?:string,ending?:'broker'|'reporter',locationId?:string,reason?:string,dialogueId?:string,[key:string]:unknown}} EventPayload
 * @typedef {{id:string,type:EventType,tick:number,sourceId:string,targetId:string|null,payload:EventPayload}} GameEvent
 */
/** @param {EventType} type @param {number} tick @param {string} sourceId @param {string|null} targetId @param {EventPayload} payload @param {string} [id] @returns {GameEvent} */
export function createEvent(type, tick, sourceId = 'world', targetId = null, payload = {}, id) {
  return { id: id ?? `${type}:${sourceId}:${targetId ?? ''}:${tick}`, type, tick, sourceId, targetId, payload };
}
/** A single deterministic, synchronous event queue; events emitted during drain run afterward. */
export class EventQueue {
  constructor() { /** @type {GameEvent[]} */ this.events = []; }
  /** @param {GameEvent} event */
  push(event) { this.events.push(event); }
  /** @param {(event:GameEvent)=>void} handle */
  drain(handle) {
    let count = 0;
    while (this.events.length) {
      if (++count > 4096) throw new Error('Event feedback loop exceeded 4096 events.');
      handle(this.events.shift());
    }
  }
  clear() { this.events.length = 0; }
}
