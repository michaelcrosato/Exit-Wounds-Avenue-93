import { SCHEMA_VERSION, stateDigest } from './state.js';
import { DIALOGUE } from '../mission/dialogue.js';
import { IncomingCall } from '../systems/incoming-call.js';
/** @typedef {import('./state.js').GameState} GameState */
/** @typedef {{getItem:(key:string)=>string|null,setItem:(key:string,value:string)=>void,removeItem:(key:string)=>void}} StorageLike */
export const SAVE_KEY = 'exit-wounds-avenue-93.save.v1';
export const SETTINGS_KEY = 'exit-wounds-avenue-93.settings.v1';
const PHASES = ['INTRO', 'COLLECTION', 'APPROACH', 'RECOVERY', 'EXTRACTION', 'EVASION', 'DECISION', 'HANDOFF', 'AFTERMATH'];
const SETTINGS_NUMBERS={brightness:[.6,1.4],hudScale:[.8,1.35],subtitleScale:[.8,1.4],sensitivity:[.3,1.8],shake:[0,1],masterVolume:[0,1],musicVolume:[0,1],dialogueVolume:[0,1]};
const SETTINGS_CHOICES={quality:['high','medium','low'],aimMode:['hold','toggle'],sprintMode:['hold','toggle'],invertY:['true','false',true,false]};

/** @param {unknown} error */
function errorMessage(error) { return error instanceof Error ? error.message : String(error); }
/** @param {unknown} value @returns {boolean} */
function finiteTree(value) {
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(finiteTree);
  if (value && typeof value === 'object') return Object.values(value).every(finiteTree);
  return value === null || ['string', 'boolean'].includes(typeof value);
}
/** Accept partial/legacy settings, but never feed invalid known controls into audio, camera or CSS. @param {unknown} value */
function validSettings(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||!finiteTree(value))return false;
  for(const [name,[min,max]] of Object.entries(SETTINGS_NUMBERS)){
    if(Object.hasOwn(value,name)){
      const number=value[name];
      if(typeof number!=='number'||!Number.isFinite(number)||number<min||number>max)return false;
    }
  }
  for(const [name,choices] of Object.entries(SETTINGS_CHOICES))if(Object.hasOwn(value,name)&&!choices.includes(value[name]))return false;
  return true;
}
/** Validate semantics before attaching restored passengers or paying rewards. @param {any} s @returns {{ok:boolean,reason?:string}} */
export function validateGameState(s) {
  if (!s || typeof s !== 'object' || s.schemaVersion !== SCHEMA_VERSION) return { ok: false, reason: 'unsupported-version' };
  if (!finiteTree(s)) return { ok: false, reason: 'invalid-number-or-value' };
  if (typeof s.runId !== 'string' || !s.runId || !Number.isInteger(s.tick) || s.tick < 0 || !Number.isInteger(s.rngState)) return { ok: false, reason: 'invalid-run' };
  if (!s.mission || !PHASES.includes(s.mission.phase) || !Array.isArray(s.mission.processedEvents) || !Array.isArray(s.mission.messages) || !Array.isArray(s.mission.defeatedCrew) || !Array.isArray(s.mission.acknowledgedDialogue) || !s.mission.actorRecoveryAttempts) return { ok: false, reason: 'invalid-mission' };
  if(s.mission.eliCall!=null){try{new IncomingCall({lineCount:DIALOGUE.intro.length,ringSeconds:14,snapshot:s.mission.eliCall});}catch{return {ok:false,reason:'invalid-eli-call'};}}
  if (!['caseRecovered', 'junReached', 'junExtracted', 'completed', 'rewardPaid', 'alarmTriggered'].every(key => typeof s.mission[key] === 'boolean')) return { ok: false, reason: 'invalid-mission-flags' };
  if (!['available', 'carrying', 'earned', 'consumed'].includes(s.mission.favor)) return { ok: false, reason: 'invalid-favor' };
  if (!s.player || s.player.id !== 'mara' || !Number.isFinite(s.player.health) || s.player.health < 0 || s.player.health > 100 || !Number.isFinite(s.player.armor) || s.player.armor < 0 || s.player.armor > 100 || !Number.isInteger(s.player.wallet) || s.player.wallet < 0 || !s.player.combat) return { ok: false, reason: 'invalid-player' };
  if (!s.player.position || !['x', 'y', 'z'].every(k => Number.isFinite(s.player.position[k]))) return { ok: false, reason: 'invalid-player-position' };
  if (!s.player.inventory || !s.player.inventory.weapons || !Array.isArray(s.player.inventory.pickups) || !['unarmed', 'pistol', 'smg'].includes(s.player.inventory.equipped) || typeof s.player.inventory.case !== 'boolean' || typeof s.player.inventory.toolbox !== 'boolean') return { ok: false, reason: 'invalid-inventory' };
  for (const [id, capacity] of [['pistol', 12], ['smg', 30]]) {
    const w = s.player.inventory.weapons[id];
    if (!w || typeof w.owned !== 'boolean' || !Number.isInteger(w.magazine) || w.magazine < 0 || w.magazine > capacity || !Number.isInteger(w.reserve) || w.reserve < 0 || !Number.isInteger(w.reloadEndTick) || w.reloadEndTick < 0 || !Number.isInteger(w.nextFireTick)) return { ok: false, reason: 'invalid-ammunition' };
  }
  const m = s.mission;
  if (m.completed !== m.rewardPaid || (m.completed && (!['broker', 'reporter'].includes(m.ending) || m.phase !== 'AFTERMATH' || s.player.inventory.case))) return { ok: false, reason: 'inconsistent-completion' };
  if (m.caseRecovered && !m.completed && !s.player.inventory.case) return { ok: false, reason: 'missing-case' };
  if (!s.wanted || ![0, 1, 2, 3].includes(s.wanted.tier) || typeof s.wanted.visible !== 'boolean' || !Number.isFinite(s.wanted.clearProgress) || !Number.isFinite(s.wanted.unseenSeconds) || !['Unaware', 'Reporting', 'Dispatched', 'Pursuing', 'Searching', 'Cleared'].includes(s.wanted.status) || !Array.isArray(s.wanted.vehicleIds) || !Array.isArray(s.wanted.reportsReceived) || !s.crime || !Array.isArray(s.crime.incidents) || !Array.isArray(s.crime.reports)) return { ok: false, reason: 'invalid-crime-state' };
  if (!s.vehicles || !s.actors || !s.actors.jun || !s.economy || !Array.isArray(s.economy.transactions) || !s.district) return { ok: false, reason: 'missing-persistent-state' };
  const dialogue=s.district.dialogue;
  if(dialogue!==undefined){
    const validLine=line=>line&&typeof line.speaker==='string'&&typeof line.text==='string'&&Number.isFinite(line.seconds)&&line.seconds>0&&line.seconds<=30&&(line.dialogueId===null||typeof line.dialogueId==='string')&&(line.lineIndex===null||Number.isInteger(line.lineIndex));
    if(!dialogue||!Array.isArray(dialogue.queue)||dialogue.queue.length>100||!(dialogue.lastId===null||typeof dialogue.lastId==='string')||!Number.isFinite(dialogue.remaining)||dialogue.remaining<0||dialogue.remaining>30||(dialogue.current!==null&&!validLine(dialogue.current))||!dialogue.queue.every(validLine))return {ok:false,reason:'invalid-dialogue'};
  }
  const occupants = new Set();
  for (const vehicle of Object.values(s.vehicles)) {
    const car = /** @type {any} */ (vehicle);
    if (!car.seats || !car.position || !car.velocity || !Number.isFinite(car.health)) return { ok: false, reason: 'invalid-vehicle' };
    for (const occupant of Object.values(car.seats)) {
      if (occupant === null) continue;
      if (typeof occupant !== 'string' || occupants.has(occupant)) return { ok: false, reason: 'duplicate-seat-occupant' };
      occupants.add(occupant);
    }
  }
  for (const actor of [s.player, ...Object.values(s.actors)]) {
    const a = /** @type {any} */ (actor);
    if (a.vehicleId && (!s.vehicles[a.vehicleId] || !a.seat || s.vehicles[a.vehicleId].seats[a.seat] !== (a.id ?? Object.keys(s.actors).find(k => s.actors[k] === a)))) return { ok: false, reason: 'invalid-seat-attachment' };
  }
  return { ok: true };
}

/** Version 1 is the first shipping schema; unknown older/newer versions need an explicit future migration. @param {any} state */
export function migrateSave(state) {
  if (state?.schemaVersion !== SCHEMA_VERSION) return { ok: false, reason: 'unsupported-version', state: null };
  const valid = validateGameState(state);
  if(valid.ok&&!state.district.dialogue)state.district.dialogue={lastId:null,current:null,remaining:0,queue:[]};
  return { ...valid, state: valid.ok ? /** @type {GameState} */ (state) : null };
}

/** @param {GameState} state @param {number} [savedAt] */
export function encodeSave(state, savedAt = Date.now()) {
  const valid = validateGameState(state);
  if (!valid.ok) throw new Error(`Cannot save: ${valid.reason}`);
  return JSON.stringify({ schemaVersion: SCHEMA_VERSION, savedAt, checksum: stateDigest(state), state });
}
/** @param {string} raw */
export function decodeSave(raw) {
  try {
    const envelope = JSON.parse(raw);
    if (envelope.schemaVersion !== SCHEMA_VERSION) return { ok: false, reason: 'unsupported-version', state: null };
    if (!envelope.state || envelope.checksum !== stateDigest(envelope.state)) return { ok: false, reason: 'checksum-mismatch', state: null };
    return migrateSave(envelope.state);
  } catch (error) { return { ok: false, reason: 'invalid-json', message: errorMessage(error), state: null }; }
}

/** Storage is injected, allowing real localStorage and deterministic failure fixtures. */
export class SaveStore {
  /** @param {StorageLike} storage @param {string} [key] */
  constructor(storage, key = SAVE_KEY) { this.storage = storage; this.key = key; this.backupKey = `${key}.backup`; }
  /** Never silently loads a corrupt primary's backup. @param {{useBackup?:boolean}} [options] */
  load({ useBackup = false } = {}) {
    try {
      const raw = this.storage.getItem(useBackup ? this.backupKey : this.key);
      if (raw === null) {
        const backup = useBackup ? null : this.storage.getItem(this.backupKey);
        return { ok: false, reason: 'missing', backupAvailable: backup !== null && decodeSave(backup).ok, state: null };
      }
      const decoded = decodeSave(raw);
      let backupAvailable = false;
      if (!decoded.ok && !useBackup) {
        const backup = this.storage.getItem(this.backupKey);
        backupAvailable = backup !== null && decodeSave(backup).ok;
      }
      return { ...decoded, backupAvailable, source: useBackup ? 'backup' : 'primary' };
    } catch (error) { return { ok: false, reason: 'storage-unavailable', message: errorMessage(error), backupAvailable: false, state: null }; }
  }
  /** Only stable domain boundaries may be persisted. @param {GameState} state @param {{seatTransition?:boolean,commitInProgress?:boolean,replaceCorrupt?:boolean}} [context] */
  save(state, { seatTransition = false, commitInProgress = false, replaceCorrupt = false } = {}) {
    if (seatTransition || commitInProgress || state.mission.phase === 'HANDOFF' || state.mission.failure) return { ok: false, reason: 'unstable-transition', queued: true };
    try {
      const raw = encodeSave(state);
      const current = this.storage.getItem(this.key);
      if (current !== null) {
        if (decodeSave(current).ok) this.storage.setItem(this.backupKey, current);
        else if (!replaceCorrupt) return { ok: false, reason: 'corrupt-save-requires-choice', queued: false };
      }
      this.storage.setItem(this.key, raw);
      return { ok: true, queued: false };
    } catch (error) { return { ok: false, reason: 'storage-or-validation-failed', message: errorMessage(error), queued: false }; }
  }
  /** User must explicitly choose New Game before destructive save removal. @param {{confirmed:boolean}} options */
  clear({ confirmed }) {
    if (!confirmed) return { ok: false, reason: 'confirmation-required' };
    try { this.storage.removeItem(this.key); this.storage.removeItem(this.backupKey); return { ok: true }; }
    catch (error) { return { ok: false, reason: 'storage-unavailable', message: errorMessage(error) }; }
  }
}

/** Separate settings persistence never replaces a gameplay save. */
export class SettingsStore {
  /** @param {StorageLike} storage */
  constructor(storage) { this.storage = storage; }
  /** @param {Record<string,unknown>} settings */
  save(settings) {
    if(!validSettings(settings))return{ok:false,reason:'invalid-settings'};
    try { this.storage.setItem(SETTINGS_KEY, JSON.stringify({ version: 1, settings })); return { ok: true }; }
    catch (error) { return { ok: false, reason: errorMessage(error) }; }
  }
  load() {
    try {
      const raw = this.storage.getItem(SETTINGS_KEY);
      if (!raw) return { ok: false, reason: 'missing', settings: null };
      const data = JSON.parse(raw);
      if (!data || data.version !== 1 || !validSettings(data.settings)) return { ok: false, reason: 'invalid-settings', settings: null };
      return { ok: true, settings: data.settings };
    } catch (error) { return { ok: false, reason: errorMessage(error), settings: null }; }
  }
}
