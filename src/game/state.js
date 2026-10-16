import { seedToUint } from './rng.js';

export const SCHEMA_VERSION = 1;
export const STARTING_WALLET = 80;
/** @typedef {ReturnType<typeof createGameState>} GameState */
/** @typedef {'INTRO'|'COLLECTION'|'APPROACH'|'RECOVERY'|'EXTRACTION'|'EVASION'|'DECISION'|'HANDOFF'|'AFTERMATH'} MissionPhase */
/** @typedef {'broker'|'reporter'} Ending */
/** @typedef {{position:{x:number,y:number,z:number},rotation:number,velocity:{x:number,y:number,z:number},health:number,color?:string,appearance:number,disabled:boolean,seats:Record<string,string|null>}} VehicleState */
/** @param {{seed?:number|string,runId?:string}} [options] */
export function createGameState({ seed = 93, runId = 'run-93-1' } = {}) {
  return {
    schemaVersion: SCHEMA_VERSION, runId, seed: seedToUint(seed), tick: 0, elapsed: 0, rngState: seedToUint(seed),
    mission: {
      phase: /** @type {MissionPhase} */ ('INTRO'), phaseEnteredTick: 0,
      route: /** @type {'gate'|'service'|null} */ (null), junReached: false, caseRecovered: false, junExtracted: false,
      choice: /** @type {Ending|null} */ (null), ending: /** @type {Ending|null} */ (null), completed: false, rewardPaid: false,
      alarmTriggered: false, checkpointId: 'new-run', pendingCheckpoint: true,
      favor: /** @type {'available'|'carrying'|'earned'|'consumed'} */ ('available'),
      defeatedCrew: /** @type {string[]} */ ([]), processedEvents: /** @type {string[]} */ ([]),
      acknowledgedDialogue: /** @type {string[]} */ ([]), messages: ['eli-opening'],
      eliCall: /** @type {import('../systems/incoming-call.js').CallSnapshot|null} */ (null),
      failure: /** @type {{reason:string,tick:number}|null} */ (null), actorRecoveryAttempts: /** @type {Record<string,number>} */ ({}),
    },
    player: {
      id: 'mara', position: { x: 0, y: 0, z: 0 }, rotation: 0, health: 100, armor: 0,
      wallet: STARTING_WALLET, vehicleId: /** @type {string|null} */ (null), seat: /** @type {string|null} */ (null),
      inventory: {
        case: false, toolbox: false, equipped: /** @type {'unarmed'|'pistol'|'smg'} */ ('pistol'),
        weapons: {
          pistol: { owned: true, magazine: 12, reserve: 48, nextFireTick: 0, reloadEndTick: 0 },
          smg: { owned: false, magazine: 0, reserve: 0, nextFireTick: 0, reloadEndTick: 0 },
        },
        pickups: /** @type {string[]} */ ([]),
      },
      combat: { blocking: false, dodgingUntilTick: 0, nextDodgeTick: 0, nextMeleeTick: 0, combo: 0, comboExpiresTick: 0 },
    },
    vehicles: /** @type {Record<string,VehicleState>} */ ({}),
    actors: /** @type {Record<string,{position:{x:number,y:number,z:number},health:number,state:string,vehicleId:string|null,seat:string|null,recoveryAttempts?:number,lastSafe?:{x:number,y:number,z:number},lastKnown?:{x:number,y:number,z:number}|null}>} */ ({
      jun: { position: { x: 0, y: 0, z: 0 }, health: 100, state: 'cover', vehicleId: null, seat: null, recoveryAttempts: 0, lastSafe: { x: 0, y: 0, z: 0 } },
    }),
    crime: {
      incidents: /** @type {import('../systems/crime.js').CrimeIncident[]} */ ([]),
      reports: /** @type {import('../systems/crime.js').CrimeReport[]} */ ([]),
    },
    wanted: {
      tier: /** @type {0|1|2|3} */ (0), status: /** @type {'Unaware'|'Reporting'|'Dispatched'|'Pursuing'|'Searching'|'Cleared'} */ ('Unaware'),
      personId: /** @type {string|null} */ (null), vehicleIds: /** @type {string[]} */ ([]),
      lastKnown: /** @type {{x:number,y:number,z:number}|null} */ (null), radius: 0,
      visible: false, lastSeenTick: -1, unseenSeconds: 0, clearProgress: 0,
      reportsReceived: /** @type {string[]} */ ([]), surrendered: false,
    },
    economy: { transactions: /** @type {string[]} */ ([]) },
    district: { investigationNotice: false, contractorTakeover: false, marketShuttered: false, radio: 'local-evening', traffic: /** @type {any} */(null), pedestrians: /** @type {any} */(null), crewMeta: /** @type {any} */(null), dialogue: /** @type {{lastId:string|null,current:any,remaining:number,queue:any[]}} */({lastId:null,current:null,remaining:0,queue:[]}) },
  };
}

/** Restore in place so system references remain valid. @param {GameState} target @param {GameState} snapshot */
export function restoreGameState(target, snapshot) {
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, structuredClone(snapshot));
  return target;
}

/** Replay resets inventory, wallet, heat, favor and district; completed free-roam save stays separate. @param {GameState} previous @param {string} newRunId @param {number|string} [seed] */
export function createReplayState(previous, newRunId, seed = previous.seed) {
  if (newRunId === previous.runId) throw new Error('Replay requires a distinct run ID.');
  return createGameState({ seed, runId: newRunId });
}

/** Stable semantic digest, independent of object property insertion order. @param {unknown} value */
export function stateDigest(value) {
  /** @param {unknown} input @returns {unknown} */
  function canonical(input) {
    if (Array.isArray(input)) return input.map(canonical);
    if (input && typeof input === 'object') return Object.fromEntries(Object.keys(input).sort().map(key => [key, canonical(input[key])]));
    return input;
  }
  const data = JSON.stringify(canonical(value));
  let h = 2166136261;
  for (let i = 0; i < data.length; i++) h = Math.imul(h ^ data.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, '0');
}
