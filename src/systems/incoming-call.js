/**
 * Eli's opening call. This owns the call's clock and transcript position only.
 * The caller owns dialogue presentation and decides when to dispatch JobAccepted.
 *
 * @typedef {'idle'|'ringing'|'missed'|'declined'|'active'|'interrupted'|'completed'|'superseded'} CallStatus
 * @typedef {{version:1,status:CallStatus,remaining:number,nextLine:number,contacted:boolean,completed:boolean}} CallSnapshot
 */

const STATUSES = new Set(['idle', 'ringing', 'missed', 'declined', 'active', 'interrupted', 'completed', 'superseded']);

/** @param {CallSnapshot} value @param {number} lineCount @param {number} ringSeconds */
function validSnapshot(value, lineCount, ringSeconds) {
  if (!value || value.version !== 1 || !STATUSES.has(value.status)) return false;
  if (!Number.isFinite(value.remaining) || value.remaining < 0 || value.remaining > ringSeconds) return false;
  if (!Number.isInteger(value.nextLine) || value.nextLine < 0 || value.nextLine > lineCount) return false;
  if (typeof value.contacted !== 'boolean' || typeof value.completed !== 'boolean') return false;
  if (value.status === 'ringing') return value.remaining > 0 && !value.contacted && !value.completed;
  if (value.remaining !== 0) return false;
  if (['idle', 'missed', 'declined'].includes(value.status)) return !value.contacted && !value.completed && value.nextLine === 0;
  if (['active', 'interrupted', 'completed', 'superseded'].includes(value.status) && !value.contacted) return false;
  if (value.status === 'completed' && !value.completed) return false;
  return true;
}

/** A result's `changed` flag is false for repeat actions; callers should react only to a new change. */
export class IncomingCall {
  /**
   * @param {{lineCount:number,ringSeconds?:number,snapshot?:CallSnapshot|null}} options
   */
  constructor({ lineCount, ringSeconds = 14, snapshot = null }) {
    if (!Number.isInteger(lineCount) || lineCount < 1) throw new RangeError('lineCount must be a positive integer');
    if (!Number.isFinite(ringSeconds) || ringSeconds <= 0) throw new RangeError('ringSeconds must be positive and finite');
    this.lineCount = lineCount;
    this.ringSeconds = ringSeconds;
    /** @type {CallSnapshot} */
    this.state = { version: 1, status: 'idle', remaining: 0, nextLine: 0, contacted: false, completed: false };
    if (snapshot) this.restore(snapshot);
  }

  get status() { return this.state.status; }
  get remaining() { return this.state.remaining; }
  get nextLine() { return this.state.nextLine; }
  get contacted() { return this.state.contacted; }
  get completed() { return this.state.completed; }

  /** Start the one opening ring. Repeated calls never reset its timer. */
  start() {
    if (this.status !== 'idle') return { ok: true, changed: false, duplicate: true };
    this.state.status = 'ringing';
    this.state.remaining = this.ringSeconds;
    return { ok: true, changed: true, kind: 'ringing' };
  }

  /** Tick with unpaused game time; returns `kind: 'missed'` once at expiry. @param {number} seconds */
  tick(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return { ok: false, changed: false, reason: 'invalid-duration' };
    if (this.status !== 'ringing' || seconds === 0) return { ok: true, changed: false };
    this.state.remaining = Math.max(0, this.state.remaining - seconds);
    if (this.state.remaining > 0) return { ok: true, changed: true, kind: 'ringing' };
    this.state.status = 'missed';
    return { ok: true, changed: true, kind: 'missed' };
  }

  /** Answer the live ring. The caller can use `firstContact` to show the opening dialogue once. */
  answer() {
    if (this.status === 'active') return { ok: true, changed: false, duplicate: true, firstContact: false, nextLine: this.nextLine };
    if (this.status !== 'ringing') return { ok: false, changed: false, reason: 'not-ringing' };
    this.state.status = 'active';
    this.state.remaining = 0;
    this.state.contacted = true;
    return { ok: true, changed: true, kind: 'answered', firstContact: true, nextLine: 0 };
  }

  /** Declining silences the ring; the transcript can still be returned from the phone. */
  decline() {
    if (this.status === 'declined') return { ok: true, changed: false, duplicate: true };
    if (this.status !== 'ringing') return { ok: false, changed: false, reason: 'not-ringing' };
    this.state.status = 'declined';
    this.state.remaining = 0;
    return { ok: true, changed: true, kind: 'declined' };
  }

  /**
   * Mark a completed line before the caller removes it from the subtitle queue.
   * An interrupted line is replayed because only finished lines advance the cursor.
   * @param {number} index Zero-based line index in the opening transcript.
   */
  acknowledgeLine(index) {
    if (this.status !== 'active') return { ok: false, changed: false, reason: 'not-active' };
    if (!Number.isInteger(index) || index < 0 || index >= this.lineCount) return { ok: false, changed: false, reason: 'invalid-line' };
    if (index < this.nextLine) return { ok: true, changed: false, duplicate: true, nextLine: this.nextLine };
    if (index !== this.nextLine) return { ok: false, changed: false, reason: 'out-of-order-line' };
    this.state.nextLine++;
    return { ok: true, changed: true, nextLine: this.nextLine };
  }

  /** Stop live dialogue while retaining the first unfinished line for phone resume. */
  interrupt() {
    if (this.status === 'interrupted') return { ok: true, changed: false, duplicate: true, nextLine: this.nextLine };
    if (this.status !== 'active') return { ok: false, changed: false, reason: 'not-active' };
    this.state.status = 'interrupted';
    return { ok: true, changed: true, kind: 'interrupted', nextLine: this.nextLine };
  }

  /**
   * Return a missed/declined call, resume an interrupted one, or replay a finished
   * transcript. The caller queues DIALOGUE.intro.slice(result.nextLine).
   */
  returnFromPhone() {
    if (this.status === 'idle') return { ok: false, changed: false, reason: 'call-not-started' };
    if (this.status === 'active') return { ok: true, changed: false, duplicate: true, firstContact: false, nextLine: this.nextLine };
    if (this.status === 'ringing') return this.answer();
    const previous = this.status;
    const firstContact = !this.contacted;
    if (previous !== 'interrupted') this.state.nextLine = 0;
    this.state.status = 'active';
    this.state.contacted = true;
    return {
      ok: true, changed: true,
      kind: previous === 'interrupted' ? 'resumed' : previous === 'completed' || previous === 'superseded' ? 'replaying' : 'returned',
      firstContact, nextLine: this.nextLine,
    };
  }

  /** Dialogue ended or was skipped. This never advances the mission. */
  complete() {
    if (this.status === 'completed') return { ok: true, changed: false, duplicate: true, firstCompletion: false };
    if (this.status !== 'active') return { ok: false, changed: false, reason: 'not-active' };
    const firstCompletion = !this.completed;
    this.state.status = 'completed';
    this.state.completed = true;
    this.state.nextLine = this.lineCount;
    return { ok: true, changed: true, kind: 'completed', firstCompletion };
  }

  /** Eli was met at the garage; silence any ring without requiring a phone action. */
  resolveInPerson() {
    if (this.status === 'superseded') return { ok: true, changed: false, duplicate: true };
    this.state.status = 'superseded';
    this.state.remaining = 0;
    this.state.contacted = true;
    return { ok: true, changed: true, kind: 'superseded' };
  }

  /** Plain data for `state.mission.eliCall`, checkpoints and save files. @returns {CallSnapshot} */
  snapshot() { return { ...this.state }; }

  /** @param {CallSnapshot} snapshot */
  restore(snapshot) {
    if (!validSnapshot(snapshot, this.lineCount, this.ringSeconds)) throw new RangeError('Invalid incoming call snapshot');
    this.state = { version: 1, status: snapshot.status, remaining: snapshot.remaining, nextLine: snapshot.nextLine, contacted: snapshot.contacted, completed: snapshot.completed };
    return this;
  }
}
