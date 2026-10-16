/** Deterministic xorshift32. Keep `state` in the save, never replace with Math.random. */
export class SeededRng {
  /** @param {number|string} seed */
  constructor(seed = 93) { this.state = seedToUint(seed); }
  next() {
    let n = this.state;
    n ^= n << 13; n ^= n >>> 17; n ^= n << 5;
    this.state = n >>> 0;
    return this.state / 4294967296;
  }
  /** @param {number} min @param {number} max */
  int(min, max) { return Math.floor(this.next() * (max - min + 1)) + min; }
  /** @template T @param {readonly T[]} values @returns {T} */
  pick(values) {
    if (!values.length) throw new RangeError('Cannot choose from an empty collection.');
    return values[this.int(0, values.length - 1)];
  }
  snapshot() { return this.state; }
  /** @param {number} state */
  restore(state) { this.state = state >>> 0 || 0x93a7c1; }
}

/** @param {number|string} seed */
export function seedToUint(seed) {
  if (typeof seed === 'number') return seed >>> 0 || 0x93a7c1;
  let n = 2166136261;
  for (let i = 0; i < seed.length; i++) n = Math.imul(n ^ seed.charCodeAt(i), 16777619);
  return n >>> 0 || 0x93a7c1;
}
