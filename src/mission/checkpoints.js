import { restoreGameState } from '../game/state.js';
/** @typedef {import('../game/state.js').GameState} GameState */
/** Logical checkpoint owner. Runtime restores definition/entities/physics/attachments before presentation. */
export class CheckpointManager {
  /** @param {GameState} state */
  constructor(state) {
    this.state = state;
    this.snapshot = structuredClone(state);
    this.pendingId = /** @type {string|null} */ (null);
  }
  /** @param {string} [id] @param {{seatTransition?:boolean,commitInProgress?:boolean}} [context] */
  capture(id = this.state.mission.checkpointId, { seatTransition = false, commitInProgress = false } = {}) {
    if (seatTransition || commitInProgress || this.state.mission.phase === 'HANDOFF' || this.state.mission.failure) {
      this.pendingId = id;
      return { ok: false, queued: true, reason: 'unstable-transition' };
    }
    this.state.mission.checkpointId = id; this.state.mission.pendingCheckpoint = false;
    this.snapshot = structuredClone(this.state); this.pendingId = null;
    return { ok: true, queued: false, snapshot: structuredClone(this.snapshot) };
  }
  /** @param {{seatTransition?:boolean,commitInProgress?:boolean}} [context] */
  flush(context = {}) {
    if (this.pendingId || this.state.mission.pendingCheckpoint) return this.capture(this.pendingId ?? this.state.mission.checkpointId, context);
    return { ok: true, queued: false };
  }
  retry() {
    restoreGameState(this.state, this.snapshot);
    this.state.mission.failure = null;
    return { ok: true, state: this.state, restoreOrder: ['world', 'entities', 'transforms-velocities-health', 'attachments', 'mission-ai-wanted', 'ui'] };
  }
  /** @param {GameState} snapshot */
  setSnapshot(snapshot) { this.snapshot = structuredClone(snapshot); }
  exportSnapshot() { return structuredClone(this.snapshot); }
}
