/** @typedef {import('../game/state.js').GameState} GameState */
/** @typedef {'pistol'|'smg'} WeaponId */
export const SIMULATION_HZ = 120;
export const WEAPONS = Object.freeze({
  pistol: { name: 'Service pistol', capacity: 12, initialReserve: 48, damage: 34, cadenceTicks: 30, reloadTicks: 168, range: 90, spread: 0.006 },
  smg: { name: 'Compact SMG', capacity: 30, initialReserve: 90, damage: 20, cadenceTicks: 10, reloadTicks: 228, range: 65, spread: 0.025 },
});
export const MELEE = Object.freeze({ damage: [16, 20, 28], cadenceTicks: 48, comboWindowTicks: 120, dodgeTicks: 45, dodgeCooldownTicks: 90, blockReduction: 0.8 });
export class CombatSystem {
  /** @param {GameState} state */
  constructor(state) { this.state = state; }
  /** Fire cadence and ammo are authoritative; runtime casts camera then muzzle and supplies actual obstruction. @param {{weaponId?:WeaponId,muzzleBlocked?:boolean,muzzleHitId?:string|null}} [context] */
  fire({ weaponId, muzzleBlocked = false, muzzleHitId = null } = {}) {
    const s = this.state, id = weaponId ?? s.player.inventory.equipped;
    if (s.player.health <= 0 || s.mission.failure) return { ok: false, reason: 'incapacitated' };
    if (s.player.vehicleId) return { ok: false, reason: 'driving-gunplay-unavailable' };
    if (id === 'unarmed') return { ok: false, reason: 'unarmed' };
    const weapon = s.player.inventory.weapons[id], def = WEAPONS[id];
    if (!weapon.owned) return { ok: false, reason: 'weapon-not-owned' };
    if (weapon.reloadEndTick > 0) return { ok: false, reason: 'reloading' };
    if (s.tick < weapon.nextFireTick) return { ok: false, reason: 'cadence' };
    if (weapon.magazine <= 0) return { ok: false, reason: 'empty' };
    weapon.magazine--; weapon.nextFireTick = s.tick + def.cadenceTicks;
    return { ok: true, weaponId: id, damage: def.damage, range: def.range, spread: def.spread, obstructed: muzzleBlocked, hitId: muzzleBlocked ? null : muzzleHitId };
  }
  /** Reload completion transfers ammo once; animation never changes ammunition. @param {WeaponId} [id] */
  reload(id) {
    const equipped = id ?? this.state.player.inventory.equipped;
    if (equipped === 'unarmed') return { ok: false, reason: 'unarmed' };
    const w = this.state.player.inventory.weapons[equipped], def = WEAPONS[equipped];
    if (!w.owned || w.reloadEndTick || w.magazine >= def.capacity || w.reserve <= 0) return { ok: false, reason: 'reload-unavailable' };
    w.reloadEndTick = this.state.tick + def.reloadTicks;
    return { ok: true, finishTick: w.reloadEndTick };
  }
  /** @param {WeaponId} id */
  cancelReload(id) { this.state.player.inventory.weapons[id].reloadEndTick = 0; }
  /** @param {number} _dt */
  tick(_dt) {
    /** @type {WeaponId[]} */ const completed = [];
    for (const id of /** @type {WeaponId[]} */ (['pistol', 'smg'])) {
      const w = this.state.player.inventory.weapons[id];
      if (!w.reloadEndTick || this.state.tick < w.reloadEndTick) continue;
      const count = Math.min(WEAPONS[id].capacity - w.magazine, w.reserve);
      w.magazine += count; w.reserve -= count; w.reloadEndTick = 0; completed.push(id);
    }
    return completed;
  }
  /** @param {'unarmed'|'pistol'|'smg'} id */
  equip(id) {
    const s = this.state;
    if (id !== 'unarmed' && !s.player.inventory.weapons[id].owned) return { ok: false, reason: 'weapon-not-owned' };
    const current = s.player.inventory.equipped;
    if (current !== 'unarmed' && current !== id) this.cancelReload(current);
    s.player.inventory.equipped = id; s.player.combat.blocking = false;
    return { ok: true };
  }
  /** @param {string} pickupId @param {WeaponId} id @param {{reserve?:number,grantWeapon?:boolean}} [options] */
  pickup(pickupId, id, { reserve = WEAPONS[id].initialReserve, grantWeapon = true } = {}) {
    const inventory = this.state.player.inventory;
    if (inventory.pickups.includes(pickupId)) return { ok: false, reason: 'pickup-already-taken' };
    const w = inventory.weapons[id];
    if (!w.owned && grantWeapon) { w.owned = true; w.magazine = WEAPONS[id].capacity; }
    w.reserve += Math.max(0, Math.floor(reserve)); inventory.pickups.push(pickupId);
    return { ok: true };
  }
  /** @param {boolean} held */
  block(held) {
    this.state.player.combat.blocking = held && this.state.player.inventory.equipped === 'unarmed' && !this.state.player.vehicleId;
    return this.state.player.combat.blocking;
  }
  /** @param {{x:number,y:number}} direction */
  dodge(direction) {
    const p = this.state.player;
    if (p.health <= 0 || this.state.mission.failure || !p.combat.blocking || p.inventory.equipped !== 'unarmed' || Math.hypot(direction.x, direction.y) < 0.1 || this.state.tick < p.combat.nextDodgeTick) return { ok: false, reason: 'dodge-unavailable' };
    const length = Math.hypot(direction.x, direction.y);
    p.combat.dodgingUntilTick = this.state.tick + MELEE.dodgeTicks;
    p.combat.nextDodgeTick = this.state.tick + MELEE.dodgeCooldownTicks;
    return { ok: true, direction: { x: direction.x / length, y: direction.y / length }, duration: MELEE.dodgeTicks / SIMULATION_HZ };
  }
  meleeStrike() {
    const p = this.state.player, c = p.combat;
    if (p.inventory.equipped !== 'unarmed' || p.vehicleId || p.health <= 0 || this.state.tick < c.nextMeleeTick) return { ok: false, reason: 'melee-unavailable' };
    if (this.state.tick > c.comboExpiresTick) c.combo = 0;
    const index = c.combo % MELEE.damage.length;
    c.combo = (index + 1) % MELEE.damage.length; c.comboExpiresTick = this.state.tick + MELEE.comboWindowTicks; c.nextMeleeTick = this.state.tick + MELEE.cadenceTicks;
    return { ok: true, combo: index + 1, damage: MELEE.damage[index], range: 1.7 };
  }
  /**
   * Runtime validates physics query masks and obstruction before calling. Jun ignores
   * friendly damage and ordinary hostile bullets; severe hazards require retry.
   * @param {string} targetId
   * @param {{damage:number,sourceId?:string,kind?:'bullet'|'melee'|'impact'|'fire'|'fall',blockedByGeometry?:boolean,frontal?:boolean,severe?:boolean}} hit
   */
  resolveHit(targetId, { damage, sourceId = 'mara', kind = 'bullet', blockedByGeometry = false, frontal = true, severe = false }) {
    if (blockedByGeometry) return { ok: false, reason: 'obstructed', damage: 0, down: false };
    if (!Number.isFinite(damage) || damage < 0) return { ok: false, reason: 'invalid-damage', damage: 0, down: false };
    if (targetId === 'jun') {
      if (this.state.mission.completed) return { ok: true, damage: 0, down: false };
      if (sourceId === 'mara' || sourceId === 'jun') return { ok: true, damage: 0, down: false };
      if (severe && ['impact', 'fire', 'fall'].includes(kind)) {
        this.state.mission.failure = { reason: `Jun was lost to a ${kind === 'impact' ? 'severe vehicle impact' : kind === 'fall' ? 'fall outside the district' : 'sustained fire hazard'}. Retry checkpoint.`, tick: this.state.tick };
        return { ok: true, damage: 0, down: true };
      }
      this.state.actors.jun.state = 'cover';
      return { ok: true, damage: 0, down: false, reaction: 'retreat' };
    }
    const target = targetId === 'mara' ? this.state.player : this.state.actors[targetId];
    if (!target) return { ok: false, reason: 'unknown-target', damage: 0, down: false };
    if (target.health <= 0) return { ok: false, reason: 'already-down', damage: 0, down: true };
    let amount = damage;
    if (targetId === 'mara' && kind === 'melee') {
      const c = this.state.player.combat;
      if (this.state.tick < c.dodgingUntilTick) amount = 0;
      else if (c.blocking && frontal) amount *= 1 - MELEE.blockReduction;
    }
    const total = amount;
    if (targetId === 'mara') {
      const absorbed = Math.min(this.state.player.armor, amount); this.state.player.armor -= absorbed; amount -= absorbed;
    }
    target.health = Math.max(0, target.health - amount);
    if (targetId === 'mara' && target.health === 0) this.state.mission.failure = { reason: 'Mara is down. Retry the last checkpoint.', tick: this.state.tick };
    return { ok: true, damage: total, down: target.health <= 0 };
  }
}

/**
 * Assist never selects friendlies or occluded geometry; preserve caller's target metadata.
 * @template {{id:string,hostile:boolean,visible:boolean,angle:number,distance:number}} T
 * @param {T[]} candidates @param {number} [maxAngle] @returns {T|null}
 */
export function selectAimAssistTarget(candidates, maxAngle = 0.12) {
  return candidates.filter(c => c.hostile && c.visible && Math.abs(c.angle) <= maxAngle && c.distance <= 65)
    .sort((a, b) => Math.abs(a.angle) - Math.abs(b.angle) || a.distance - b.distance || a.id.localeCompare(b.id))[0] ?? null;
}
