import { WantedSystem } from './wanted.js';
export const SERVICES = Object.freeze({ food: { price: 10, label: 'Hot meal — restore health' }, armor: { price: 60, label: 'Work vest — refill armor' }, repair: { price: 80, label: 'Repair and respray' } });
export class EconomySystem {
  /** @param {import('../game/state.js').GameState} state @param {WantedSystem} [wanted] */
  constructor(state, wanted = new WantedSystem(state)) { this.state = state; this.wanted = wanted; }
  /** @param {'food'|'armor'|'repair'} service @param {{transactionId:string,vehicleId?:string,useFavor?:boolean}} options */
  purchase(service, { transactionId, vehicleId, useFavor = true }) {
    const s = this.state, id = `${s.runId}:purchase:${transactionId}`;
    if (s.economy.transactions.includes(id)) return { ok: false, reason: 'transaction-already-completed' };
    if (!SERVICES[service]) return { ok: false, reason: 'unknown-service' };
    if (s.player.health <= 0 || s.mission.failure) return { ok: false, reason: 'incapacitated' };
    if (service === 'food' && s.player.health >= 100) return { ok: false, reason: 'health-full' };
    if (service === 'armor' && s.player.armor >= 100) return { ok: false, reason: 'armor-full' };
    const vehicle = vehicleId ? s.vehicles[vehicleId] : null;
    if (service === 'repair' && (!vehicle || vehicle.health <= 0)) return { ok: false, reason: 'vehicle-unavailable' };
    if (service === 'repair' && s.wanted.visible) return { ok: false, reason: 'police-can-see-vehicle' };
    const favor = service === 'repair' && useFavor && s.mission.favor === 'earned';
    const price = favor ? 0 : SERVICES[service].price;
    if (s.player.wallet < price) return { ok: false, reason: 'insufficient-funds' };
    s.player.wallet -= price;
    if (service === 'food') s.player.health = 100;
    if (service === 'armor') s.player.armor = 100;
    if (service === 'repair' && vehicle) {
      vehicle.health = 100; vehicle.disabled = false; vehicle.appearance++;
      this.wanted.respray(vehicleId);
      if (favor) s.mission.favor = 'consumed';
    }
    s.economy.transactions.push(id); s.mission.pendingCheckpoint = true;
    return { ok: true, price, favorConsumed: favor };
  }
}
