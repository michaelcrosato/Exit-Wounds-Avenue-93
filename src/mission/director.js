import { PHASES, ENDINGS } from './definition.js';
import { CrimeSystem } from '../systems/crime.js';
import { createEvent } from '../game/events.js';
/** @typedef {import('../game/state.js').GameState} GameState */
/** @typedef {import('../game/events.js').GameEvent} GameEvent */
/** @typedef {import('../game/state.js').MissionPhase} MissionPhase */
/** @typedef {{ok:boolean,reason?:string,duplicate?:boolean,events:GameEvent[]}} MissionResult */
export class MissionDirector {
  /** @param {GameState} state @param {{crime?:CrimeSystem,depotPosition?:{x:number,y:number,z:number}}} [options] */
  constructor(state, { crime = new CrimeSystem(state), depotPosition = { x: 170, y: -145, z: 0 } } = {}) {
    this.state = state; this.crime = crime; this.depotPosition = depotPosition;
  }
  get phase() { return this.state.mission.phase; }
  get objective() {
    const m = this.state.mission;
    if (m.phase === 'DECISION' && m.choice) return `Deliver the case to the ${m.choice === 'broker' ? 'broker loading bay ($1,200)' : 'waterfront reporter ($600)'}. You may change your choice before confirming.`;
    return PHASES[m.phase].objective;
  }
  get destination() { return this.state.mission.choice && ['DECISION', 'HANDOFF'].includes(this.phase) ? ENDINGS[this.state.mission.choice].destination : PHASES[this.phase].locationId; }
  /** Events only change domain state after guards pass. @param {GameEvent} event @returns {MissionResult} */
  handle(event) {
    const s = this.state, m = s.mission, p = event.payload ?? {};
    /** @type {GameEvent[]} */ const events = [];
    if (m.processedEvents.includes(event.id)) return { ok: true, duplicate: true, events };
    /** @param {string} reason */ const fail = reason => ({ ok: false, reason, events });
    if (m.failure && event.type !== 'ActorDown' && event.type !== 'ActorFailed' && event.type !== 'DialogueAcknowledged') return fail('retry-required');
    /** @param {MissionPhase} next */ const transition = next => {
      const previous = m.phase;
      m.phase = next; m.phaseEnteredTick = s.tick;
      const checkpoint = PHASES[next].checkpoint;
      if (checkpoint) { m.checkpointId = checkpoint; m.pendingCheckpoint = true; }
      events.push(createEvent('MissionPhaseChanged', s.tick, 'mission', null, { previous, phase: next }, `${s.runId}:phase:${next}`));
      if (checkpoint) events.push(createEvent('CheckpointRequested', s.tick, 'mission', null, { checkpointId: checkpoint }, `${s.runId}:checkpoint:${checkpoint}:${s.tick}`));
    };
    switch (event.type) {
      case 'JobAccepted':
        if (m.phase !== 'INTRO') return fail('job-already-started');
        transition('COLLECTION'); break;
      case 'CollectionCompleted':
        if (m.phase !== 'COLLECTION') return fail('not-at-collection-stage');
        this.message('depot-address'); transition('APPROACH'); break;
      case 'ApproachCommitted':
        if (m.phase !== 'APPROACH' || (p.route !== 'gate' && p.route !== 'service')) return fail('invalid-approach');
        m.route = p.route; transition('RECOVERY'); break;
      case 'JunReached':
        if (m.phase !== 'RECOVERY') return fail('jun-not-available');
        m.junReached = true; s.actors.jun.state = 'follow'; break;
      case 'EnemyDefeated': {
        const enemyId = p.enemyId ?? event.targetId;
        if (!enemyId || !['RECOVERY', 'EXTRACTION', 'EVASION'].includes(m.phase)) return fail('invalid-crew-event');
        if (!m.defeatedCrew.includes(enemyId)) m.defeatedCrew.push(enemyId);
        break;
      }
      case 'CaseRecovered':
        if (m.phase !== 'RECOVERY' || !m.junReached) return fail('reach-jun-before-case');
        m.caseRecovered = true; s.player.inventory.case = true;
        if (!m.alarmTriggered) {
          this.crime.remoteAlarm(this.depotPosition); m.alarmTriggered = true;
          events.push(createEvent('RemoteAlarmTriggered', s.tick, 'case-cabinet', 'depot-dispatcher', { position: this.depotPosition }, `${s.runId}:alarm`));
        }
        transition('EXTRACTION'); break;
      case 'VehicleEntered':
      case 'CompanionExtracted': {
        if (event.type === 'VehicleEntered' && p.actorId !== 'jun' && event.sourceId !== 'jun') return fail('waiting-for-jun');
        if (m.phase !== 'EXTRACTION' || !m.caseRecovered) return fail('not-extracting');
        const vehicleId = p.vehicleId;
        if (vehicleId) {
          const car = s.vehicles[vehicleId];
          if (!car || car.disabled || car.health <= 0) return fail('escape-vehicle-unavailable');
          const seat = p.seat ?? Object.keys(car.seats).find(key => key !== 'driver' && (!car.seats[key] || car.seats[key] === 'jun'));
          if (!seat || seat === 'driver' || (car.seats[seat] && car.seats[seat] !== 'jun')) return fail('no-passenger-seat');
          car.seats[seat] = 'jun'; s.actors.jun.vehicleId = vehicleId; s.actors.jun.seat = seat; s.actors.jun.state = 'seated';
        } else if (!p.onFoot) return fail('no-extraction-route');
        m.junExtracted = true; transition('EVASION'); break;
      }
      case 'WantedCleared':
        if (m.phase !== 'EVASION' || s.wanted.tier > 0 || !m.junExtracted || !m.caseRecovered) return fail('escape-not-clear');
        transition('DECISION'); break;
      case 'EndingChosen':
        if (!['DECISION', 'HANDOFF'].includes(m.phase) || (p.ending !== 'broker' && p.ending !== 'reporter')) return fail('choice-unavailable');
        m.choice = p.ending;
        if (m.phase === 'HANDOFF') transition('DECISION');
        m.pendingCheckpoint = true; break;
      case 'HandoffRequested':
        if (m.phase !== 'DECISION' || !m.choice || p.locationId !== ENDINGS[m.choice].destination) return fail('wrong-handoff-location');
        if (s.wanted.tier > 0 || s.wanted.visible) return fail('lose-police-before-handoff');
        if (!s.player.inventory.case || !m.junExtracted) return fail('case-or-jun-missing');
        if (s.actors.jun.vehicleId) return fail('jun-still-seated');
        if (Math.hypot(s.player.position.x - s.actors.jun.position.x, s.player.position.y - s.actors.jun.position.y) > 8) return fail('wait-for-jun');
        transition('HANDOFF'); break;
      case 'HandoffCommitted': {
        if (m.completed || m.rewardPaid) return fail('handoff-already-completed');
        if (m.phase !== 'HANDOFF' || !m.choice || !s.player.inventory.case || s.wanted.tier > 0 || s.wanted.visible) return fail('handoff-not-ready');
        const ending = ENDINGS[m.choice];
        // One synchronous commit owns case removal, payment, completion and district consequences.
        m.ending = m.choice; m.completed = true; m.rewardPaid = true; s.player.inventory.case = false;
        s.player.wallet += ending.reward; s.economy.transactions.push(`${s.runId}:mission-reward`);
        s.district.investigationNotice = m.ending === 'reporter';
        s.district.contractorTakeover = m.ending === 'broker'; s.district.marketShuttered = m.ending === 'broker';
        s.district.radio = m.ending === 'reporter' ? 'payroll-investigation' : 'contractor-expansion';
        s.actors.jun.state = 'safe'; s.actors.jun.health = 100;
        this.message(ending.messageId); transition('AFTERMATH');
        events.push(createEvent('MissionCompleted', s.tick, 'mission', null, { ending: m.ending, reward: ending.reward }, `${s.runId}:completed`));
        break;
      }
      case 'FavorStarted':
        if (m.favor !== 'available') return fail('toolbox-already-collected');
        m.favor = 'carrying'; s.player.inventory.toolbox = true; break;
      case 'FavorCompleted':
        if (m.favor !== 'carrying' || !s.player.inventory.toolbox) return fail('toolbox-not-carried');
        m.favor = 'earned'; s.player.inventory.toolbox = false; this.message('favor-earned'); m.pendingCheckpoint = true; break;
      case 'ActorDown':
      case 'ActorFailed': {
        const actorId = p.actorId ?? event.targetId;
        if (actorId !== 'mara' && actorId !== 'jun') return fail('nonessential-actor');
        if (m.completed && actorId === 'jun') return fail('jun-is-safe');
        m.failure = { reason: typeof p.reason === 'string' ? p.reason : actorId === 'mara' ? 'Mara is down. Retry the last checkpoint.' : 'Jun could not be recovered. Retry the last checkpoint.', tick: s.tick };
        break;
      }
      case 'DialogueAcknowledged':
        if (!p.dialogueId) return fail('missing-dialogue-id');
        if (!m.acknowledgedDialogue.includes(p.dialogueId)) m.acknowledgedDialogue.push(p.dialogueId);
        break;
      default: return fail('unhandled-event');
    }
    m.processedEvents.push(event.id);
    return { ok: true, events };
  }
  /** @param {string} id */
  message(id) { if (!this.state.mission.messages.includes(id)) this.state.mission.messages.push(id); }
  acceptJob() { return this.handle(createEvent('JobAccepted', this.state.tick, 'mara', 'eli', {}, `${this.state.runId}:accept-job`)); }
  /** @param {'broker'|'reporter'} ending */
  chooseEnding(ending) { return this.handle(createEvent('EndingChosen', this.state.tick, 'mara', 'jun', { ending }, `${this.state.runId}:choose:${ending}:${this.state.tick}`)); }
  commitHandoff() { return this.handle(createEvent('HandoffCommitted', this.state.tick, 'mara', this.state.mission.choice, {}, `${this.state.runId}:handoff`)); }
  /** Runtime supplies a validated offscreen point; repeated failure is always explicit. @param {string} actorId @param {{x:number,y:number,z:number}|null} validPoint @param {boolean} eitherVisible */
  recoverActor(actorId, validPoint, eitherVisible) {
    const m = this.state.mission;
    const actor = this.state.actors[actorId];
    if (!actor) return { ok: false, reason: 'unknown-actor' };
    const attempts = m.actorRecoveryAttempts[actorId] ?? 0;
    if (attempts >= 2) {
      m.failure = { reason: `${actorId === 'jun' ? 'Jun' : actorId} cannot reach a safe route. Retry checkpoint.`, tick: this.state.tick };
      return { ok: false, reason: 'retry-required' };
    }
    if (eitherVisible || !validPoint) return { ok: false, reason: 'regroup-instruction-required' };
    m.actorRecoveryAttempts[actorId] = attempts + 1; actor.position = { ...validPoint }; actor.state = 'regroup';
    return { ok: true };
  }
  /** @param {number} _dt */
  tick(_dt) { /* Progression depends on verified domain events, never elapsed animation time. */ }
}
