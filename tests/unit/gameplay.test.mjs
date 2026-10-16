import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState, createReplayState, stateDigest } from '../../src/game/state.js';
import { createEvent } from '../../src/game/events.js';
import { SeededRng } from '../../src/game/rng.js';
import { emptyActionFrame, clearActionFrame } from '../../src/game/actions.js';
import { MissionDirector } from '../../src/mission/director.js';
import { CheckpointManager } from '../../src/mission/checkpoints.js';
import { CombatSystem, WEAPONS, selectAimAssistTarget } from '../../src/systems/combat.js';
import { CrimeSystem } from '../../src/systems/crime.js';
import { WantedSystem } from '../../src/systems/wanted.js';
import { EconomySystem } from '../../src/systems/economy.js';
import { SaveStore, SettingsStore, SAVE_KEY, encodeSave, decodeSave, validateGameState } from '../../src/game/save.js';

function fixture() {
  const state = createGameState({ seed: 93, runId: 'test-run' });
  const wanted = new WantedSystem(state), crime = new CrimeSystem(state, wanted);
  const director = new MissionDirector(state, { crime, depotPosition: { x: 0, y: 0, z: 0 } });
  let serial = 0;
  const event = (type, payload = {}) => director.handle(createEvent(type, state.tick, 'mara', null, payload, `test:${++serial}`));
  return { state, wanted, crime, director, event };
}
function reachRecovery(f, route = 'gate') {
  assert.equal(f.director.acceptJob().ok, true);
  assert.equal(f.event('CollectionCompleted').ok, true);
  assert.equal(f.event('ApproachCommitted', { route }).ok, true);
}
function reachDecision(f, route = 'gate') {
  reachRecovery(f, route);
  assert.equal(f.event('JunReached').ok, true);
  assert.equal(f.event('CaseRecovered').ok, true);
  assert.equal(f.event('CompanionExtracted', { onFoot: true }).ok, true);
  f.state.player.position.x = 200;
  f.state.actors.jun.position = { ...f.state.player.position };
  assert.equal(f.wanted.tick(12).cleared, true);
  assert.equal(f.event('WantedCleared').ok, true);
}
function car() { return { position: { x: 0, y: 0, z: 0 }, rotation: 0, velocity: { x: 0, y: 0, z: 0 }, health: 35, appearance: 0, disabled: false, seats: { driver: null, passenger: null } }; }
function memoryStorage() {
  const data = new Map();
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}

test('mission guards prevent skipping Jun, extracting without case, and premature handoff', () => {
  const f = fixture();
  assert.equal(f.event('CaseRecovered').ok, false);
  assert.equal(f.event('CompanionExtracted', { onFoot: true }).ok, false);
  assert.equal(f.event('HandoffCommitted').ok, false);
  reachRecovery(f);
  assert.equal(f.event('CaseRecovered').reason, 'reach-jun-before-case');
  assert.equal(f.state.player.inventory.case, false);
});
for (const [ending, route, reward] of [['broker', 'gate', 1200], ['reporter', 'service', 600]]) {
  test(`${ending} ending completes all phases, rewards once, and changes district state`, () => {
    const f = fixture(); reachDecision(f, route);
    assert.equal(f.state.mission.route, route);
    assert.equal(f.director.chooseEnding(ending).ok, true);
    assert.equal(f.event('HandoffRequested', { locationId: ending === 'broker' ? 'broker' : 'waterfront' }).ok, true);
    assert.equal(f.director.commitHandoff().ok, true);
    const wallet = 80 + reward;
    assert.equal(f.state.player.wallet, wallet);
    assert.equal(f.state.mission.phase, 'AFTERMATH');
    assert.equal(f.state.mission.ending, ending);
    assert.equal(f.state.player.inventory.case, false);
    assert.equal(f.state.actors.jun.health, 100);
    assert.equal(f.state.district.investigationNotice, ending === 'reporter');
    assert.equal(f.state.district.marketShuttered, ending === 'broker');
    assert.equal(f.director.commitHandoff().duplicate, true);
    assert.equal(f.event('HandoffCommitted').ok, false);
    assert.equal(f.state.player.wallet, wallet);
    const restored = decodeSave(encodeSave(f.state)).state;
    assert.ok(restored);
    new MissionDirector(restored).commitHandoff();
    assert.equal(restored.player.wallet, wallet);
  });
}
test('ending is changeable before commitment, destination and active wanted status are guarded', () => {
  const f = fixture(); reachDecision(f);
  f.director.chooseEnding('broker'); f.state.tick++;
  f.director.chooseEnding('reporter');
  assert.equal(f.event('HandoffRequested', { locationId: 'broker' }).ok, false);
  f.state.wanted.tier = 1;
  assert.equal(f.event('HandoffRequested', { locationId: 'waterfront' }).reason, 'lose-police-before-handoff');
  assert.equal(f.state.mission.phase, 'DECISION');
});
test('handoff waits for the living companion to physically arrive', () => {
  const f = fixture(); reachDecision(f); f.director.chooseEnding('reporter');
  f.state.actors.jun.position = { x: f.state.player.position.x - 68, y: f.state.player.position.y + 17, z: 0 };
  assert.equal(f.event('HandoffRequested', { locationId: 'waterfront' }).reason, 'wait-for-jun');
  assert.equal(f.state.mission.phase, 'DECISION');
  f.state.actors.jun.position = { x: f.state.player.position.x - 3, y: f.state.player.position.y, z: 0 };
  assert.equal(f.event('HandoffRequested', { locationId: 'waterfront' }).ok, true);
});
test('cabinet alarm uses normal reporting, has no magical identity, and persists at extraction checkpoint', () => {
  const f = fixture(); reachRecovery(f); f.event('JunReached'); f.event('CaseRecovered');
  assert.equal(f.state.wanted.tier, 2);
  assert.equal(f.state.wanted.personId, null);
  assert.deepEqual(f.state.wanted.vehicleIds, []);
  assert.equal(f.state.crime.reports[0].witnessKind, 'remote');
  const checkpoints = new CheckpointManager(f.state);
  checkpoints.capture('extraction');
  f.state.wanted.tier = 0; f.state.player.inventory.case = false;
  checkpoints.retry();
  assert.equal(f.state.wanted.tier, 2);
  assert.equal(f.state.player.inventory.case, true);
  assert.equal(f.state.mission.phase, 'EXTRACTION');
});
test('Jun boards only a viable free passenger seat and never displaces driver', () => {
  const f = fixture(); reachRecovery(f); f.event('JunReached'); f.event('CaseRecovered');
  f.state.vehicles.van = car(); f.state.vehicles.van.seats.driver = 'mara';
  assert.equal(f.event('VehicleEntered', { actorId: 'jun', vehicleId: 'van', seat: 'driver' }).ok, false);
  f.state.vehicles.van.disabled = true;
  assert.equal(f.event('VehicleEntered', { actorId: 'jun', vehicleId: 'van' }).ok, false);
  f.state.vehicles.van.disabled = false;
  assert.equal(f.event('VehicleEntered', { actorId: 'jun', vehicleId: 'van' }).ok, true);
  assert.equal(f.state.vehicles.van.seats.driver, 'mara');
  assert.equal(f.state.vehicles.van.seats.passenger, 'jun');
  assert.equal(f.state.actors.jun.vehicleId, 'van');
  assert.equal(validateGameState(f.state).ok, true);
});
test('checkpoints queue seat transitions and preserve a late valid retry', () => {
  const f = fixture(); reachRecovery(f);
  const checkpoints = new CheckpointManager(f.state);
  checkpoints.capture('recovery');
  f.event('JunReached'); f.event('CaseRecovered');
  assert.equal(checkpoints.capture('case', { seatTransition: true }).queued, true);
  f.state.player.health = 0; f.event('ActorDown', { actorId: 'mara' });
  checkpoints.retry();
  assert.equal(f.state.mission.phase, 'RECOVERY');
  assert.equal(f.state.player.health, 100);
  assert.equal(f.state.mission.failure, null);
});
test('optional favor is earned once, consumed once and paid repair follows', () => {
  const f = fixture(), economy = new EconomySystem(f.state, f.wanted);
  assert.equal(f.event('FavorCompleted').ok, false);
  f.event('FavorStarted'); f.event('FavorCompleted');
  assert.equal(f.event('FavorCompleted').ok, false);
  f.state.vehicles.sedan = car();
  f.state.wanted.visible = true;
  assert.equal(economy.purchase('repair', { transactionId: 'blocked', vehicleId: 'sedan' }).ok, false);
  assert.equal(f.state.mission.favor, 'earned');
  f.state.wanted.visible = false;
  assert.equal(economy.purchase('repair', { transactionId: 'one', vehicleId: 'sedan' }).price, 0);
  assert.equal(f.state.mission.favor, 'consumed');
  assert.equal(f.state.player.wallet, 80);
  assert.equal(economy.purchase('repair', { transactionId: 'one', vehicleId: 'sedan' }).ok, false);
  assert.equal(economy.purchase('repair', { transactionId: 'two', vehicleId: 'sedan' }).price, 80);
  assert.equal(f.state.player.wallet, 0);
});
test('post-mission reward is usable for food, armor and repair with precise balances', () => {
  const f = fixture(); reachDecision(f); f.director.chooseEnding('reporter');
  f.event('HandoffRequested', { locationId: 'waterfront' }); f.director.commitHandoff();
  f.state.player.health = 10; f.state.vehicles.sedan = car();
  const economy = new EconomySystem(f.state);
  economy.purchase('food', { transactionId: 'food' }); economy.purchase('armor', { transactionId: 'vest' }); economy.purchase('repair', { transactionId: 'repair', vehicleId: 'sedan' });
  assert.equal(f.state.player.wallet, 530);
  assert.equal(f.state.player.health, 100); assert.equal(f.state.player.armor, 100);
  assert.equal(f.state.vehicles.sedan.health, 100);
});
test('offscreen actor recovery validates visibility, limits retries and reports explicit failure', () => {
  const f = fixture(), point = { x: 10, y: 20, z: 0 };
  assert.equal(f.director.recoverActor('jun', point, true).ok, false);
  assert.equal(f.director.recoverActor('jun', point, false).ok, true);
  assert.equal(f.director.recoverActor('jun', point, false).ok, true);
  assert.equal(f.director.recoverActor('jun', point, false).reason, 'retry-required');
  assert.match(f.state.mission.failure.reason, /Retry/);
});
test('unwitnessed or occluded crimes never dispatch police', () => {
  const f = fixture();
  f.crime.recordCrime({ id: 'theft', kind: 'theft', position: { x: 0, y: 0, z: 0 }, severity: 1, perpetratorId: 'mara', vehicleId: 'sedan', tick: 0 });
  f.crime.tick(100);
  assert.equal(f.state.wanted.tier, 0);
  assert.equal(f.crime.observe({ crimeId: 'theft', witnessId: 'civilian', witnessKind: 'civilian', hasLineOfSight: false, seesPerson: true }).ok, false);
  assert.equal(f.state.wanted.tier, 0);
});
test('civilian reporting has a real delay and interruptible report, police observation is immediate', () => {
  const f = fixture();
  f.crime.recordCrime({ id: 'shot', kind: 'gunfire', position: { x: 0, y: 0, z: 0 }, severity: 2, perpetratorId: 'mara', vehicleId: null, tick: 0 });
  f.crime.observe({ crimeId: 'shot', witnessId: 'witness', witnessKind: 'civilian', hasLineOfSight: true, seesPerson: true, reportDelay: 3 });
  f.crime.tick(2); assert.equal(f.state.wanted.tier, 0);
  f.crime.interruptReport('witness'); f.crime.tick(10); assert.equal(f.state.wanted.tier, 0);
  f.crime.observe({ crimeId: 'shot', witnessId: 'officer', witnessKind: 'police', hasLineOfSight: true, seesPerson: true });
  assert.equal(f.state.wanted.tier, 2); assert.equal(f.state.wanted.status, 'Pursuing'); assert.equal(f.state.wanted.personId, 'mara');
});
test('unknown alarm does not turn unrelated police sight into suspect identification', () => {
  const f = fixture(); f.crime.remoteAlarm({ x: 0, y: 0, z: 0 });
  assert.equal(f.wanted.sight({ position: { x: 0, y: 0, z: 0 }, personId: 'mara' }).reason, 'unidentified');
  assert.equal(f.wanted.sight({ position: { x: 0, y: 0, z: 0 }, personId: 'mara', confirmedSuspect: true }).ok, true);
});
for (const tier of [1, 2, 3]) {
  test(`tier ${tier} only clears outside its search radius after its full unseen interval`, () => {
    const f = fixture();
    f.wanted.receiveReport({ id: 'report', position: { x: 0, y: 0, z: 0 }, severity: tier, observedPersonId: 'mara', observedVehicleId: 'sedan' });
    const seconds = [0, 8, 12, 16][tier], radius = [0, 60, 100, 140][tier];
    f.wanted.sight({ position: { x: 0, y: 0, z: 0 }, personId: 'mara' });
    assert.equal(f.wanted.tick(100, { x: radius + 10, y: 0, z: 0 }).cleared, false);
    f.wanted.loseSight();
    assert.equal(f.wanted.tick(100, { x: 0, y: 0, z: 0 }).cleared, false);
    assert.equal(f.wanted.tick(seconds - 1, { x: radius + 10, y: 0, z: 0 }).cleared, false);
    assert.equal(f.wanted.tick(1, { x: radius + 10, y: 0, z: 0 }).cleared, true);
    assert.equal(f.state.wanted.tier, 0);
  });
}
test('unseen vehicle change leaves new car unknown, a seen switch links it, foot identity survives', () => {
  const f = fixture(); f.crime.remoteAlarm({ x: 0, y: 0, z: 0 });
  f.wanted.sight({ position: { x: 1, y: 1, z: 0 }, personId: 'mara', vehicleId: 'sedan', confirmedSuspect: true }); f.wanted.loseSight();
  assert.equal(f.wanted.changeVehicle('sedan', 'van', false).identified, false);
  assert.equal(f.state.wanted.personId, 'mara');
  assert.equal(f.wanted.sight({ position: { x: 2, y: 2, z: 0 }, vehicleId: 'van' }).ok, false);
  f.wanted.changeVehicle('van', 'cruiser', true);
  assert.equal(f.state.wanted.vehicleIds.includes('cruiser'), true);
});
test('tier-one surrender requires safe holstered deliberate hold and creates arrest retry', () => {
  const f = fixture(); f.state.wanted.tier = 1;
  assert.equal(f.wanted.surrender({ safe: true, holstered: false, heldSeconds: 2 }).ok, false);
  assert.equal(f.wanted.surrender({ safe: true, holstered: true, heldSeconds: 0.9 }).ok, false);
  assert.equal(f.wanted.surrender({ safe: true, holstered: true, heldSeconds: 1 }).ok, true);
  assert.match(f.state.mission.failure.reason, /Arrested/);
});
test('fire cadence, empty magazine and reload accounting have one owner', () => {
  const state = createGameState(), combat = new CombatSystem(state);
  for (let i = 0; i < 12; i++) { state.tick = i * WEAPONS.pistol.cadenceTicks; assert.equal(combat.fire().ok, true); }
  state.tick += WEAPONS.pistol.cadenceTicks;
  assert.equal(combat.fire().reason, 'empty'); assert.equal(state.player.inventory.weapons.pistol.reserve, 48);
  combat.reload(); state.tick += WEAPONS.pistol.reloadTicks;
  assert.deepEqual(combat.tick(0), ['pistol']);
  assert.equal(state.player.inventory.weapons.pistol.magazine, 12); assert.equal(state.player.inventory.weapons.pistol.reserve, 36);
  combat.tick(0); assert.equal(state.player.inventory.weapons.pistol.reserve, 36);
  assert.equal(combat.fire().ok, true); assert.equal(combat.fire().reason, 'cadence');
});
test('switching during reload cancels transfer and pickup never duplicates gun or ammo', () => {
  const state = createGameState(), combat = new CombatSystem(state);
  combat.fire(); combat.reload(); combat.equip('unarmed'); state.tick = 1000; combat.tick(0);
  assert.equal(state.player.inventory.weapons.pistol.magazine, 11); assert.equal(state.player.inventory.weapons.pistol.reserve, 48);
  assert.equal(combat.pickup('depot-smg', 'smg').ok, true);
  assert.equal(state.player.inventory.weapons.smg.magazine, 30); assert.equal(state.player.inventory.weapons.smg.reserve, 90);
  assert.equal(combat.pickup('depot-smg', 'smg').ok, false); assert.equal(state.player.inventory.weapons.smg.reserve, 90);
});
test('muzzle obstruction consumes shot but never damages through geometry; vehicle gunplay is blocked', () => {
  const state = createGameState(), combat = new CombatSystem(state);
  const shot = combat.fire({ muzzleBlocked: true, muzzleHitId: 'crew' });
  assert.equal(shot.hitId, null); assert.equal(state.player.inventory.weapons.pistol.magazine, 11);
  assert.equal(combat.resolveHit('mara', { damage: 50, blockedByGeometry: true }).damage, 0);
  state.player.vehicleId = 'sedan'; state.tick = 100;
  assert.equal(combat.fire().reason, 'driving-gunplay-unavailable');
});
test('armor absorbs damage, melee supports combo/block/directional dodge, and Jun ignores stray bullets', () => {
  const state = createGameState(), combat = new CombatSystem(state);
  state.player.armor = 20; combat.resolveHit('mara', { damage: 34 });
  assert.equal(state.player.armor, 0); assert.equal(state.player.health, 86);
  combat.equip('unarmed'); combat.block(true);
  combat.resolveHit('mara', { damage: 20, kind: 'melee' }); assert.equal(state.player.health, 82);
  assert.equal(combat.dodge({ x: 0, y: 0 }).ok, false);
  assert.equal(combat.dodge({ x: 1, y: 0 }).ok, true);
  combat.resolveHit('mara', { damage: 20, kind: 'melee' }); assert.equal(state.player.health, 82);
  assert.equal(combat.resolveHit('jun', { damage: 1000 }).down, false);
  assert.equal(combat.resolveHit('jun', { damage: 1000, sourceId: 'crew' }).reaction, 'retreat');
  assert.equal(state.actors.jun.health, 100);
  assert.equal(combat.resolveHit('jun', { damage: 1000, sourceId: 'world', kind: 'fall', severe: true }).down, true);
});
test('aim assist cannot pick civilians or enemies behind walls', () => {
  const picked = selectAimAssistTarget([
    { id: 'civilian', hostile: false, visible: true, angle: 0, distance: 1 },
    { id: 'behind-wall', hostile: true, visible: false, angle: 0, distance: 2 },
    { id: 'crew', hostile: true, visible: true, angle: 0.05, distance: 8 },
  ]);
  assert.equal(picked.id, 'crew');
});
test('save backup preserves previous good checkpoint and corrupt primary requires explicit backup choice', () => {
  const storage = memoryStorage(), store = new SaveStore(storage), state = createGameState();
  assert.equal(store.save(state).ok, true);
  state.player.wallet = 70; assert.equal(store.save(state).ok, true);
  assert.equal(store.load().state.player.wallet, 70);
  assert.equal(store.load({ useBackup: true }).state.player.wallet, 80);
  storage.setItem(SAVE_KEY, '{broken');
  const bad = store.load(); assert.equal(bad.ok, false); assert.equal(bad.backupAvailable, true); assert.equal(bad.state, null);
  assert.equal(store.save(state).reason, 'corrupt-save-requires-choice');
  assert.equal(store.load({ useBackup: true }).state.player.wallet, 80);
  assert.equal(store.clear({ confirmed: false }).ok, false);
  assert.equal(storage.getItem(SAVE_KEY), '{broken');
});
test('checksum, unsupported version, nonfinite state, invalid attachment and duplicate seats are rejected', () => {
  const state = createGameState(), good = JSON.parse(encodeSave(state));
  good.state.player.wallet++; assert.equal(decodeSave(JSON.stringify(good)).reason, 'checksum-mismatch');
  good.schemaVersion = 99; assert.equal(decodeSave(JSON.stringify(good)).reason, 'unsupported-version');
  state.player.wallet = NaN; assert.throws(() => encodeSave(state));
  state.player.wallet = 80; state.player.vehicleId = 'missing'; assert.equal(validateGameState(state).ok, false);
  state.player.vehicleId = null; state.vehicles.a = car(); state.vehicles.b = car(); state.vehicles.a.seats.passenger = 'jun'; state.vehicles.b.seats.passenger = 'jun';
  assert.equal(validateGameState(state).reason, 'duplicate-seat-occupant');
});
test('storage failure is visible and stable writes are deferred during a handoff', () => {
  const denied = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); }, removeItem() {} };
  const store = new SaveStore(denied), state = createGameState();
  assert.equal(store.load().reason, 'storage-unavailable'); assert.equal(store.save(state).ok, false);
  state.mission.phase = 'HANDOFF'; assert.equal(store.save(state).queued, true);
});
test('settings live separately, replay has a new run and defined starting inventory, RNG resumes deterministically', () => {
  const storage = memoryStorage(), settings = new SettingsStore(storage), state = createGameState();
  new SaveStore(storage).save(state); settings.save({ volume: 0.5, subtitles: true });
  assert.equal(settings.load().settings.volume, 0.5); assert.equal(new SaveStore(storage).load().ok, true);
  const replay = createReplayState(state, 'run-two'); assert.equal(replay.player.wallet, 80); assert.equal(replay.player.inventory.weapons.pistol.reserve, 48); assert.equal(replay.mission.phase, 'INTRO');
  assert.throws(() => createReplayState(state, state.runId));
  const a = new SeededRng('ward'), b = new SeededRng('ward'); assert.equal(a.next(), b.next());
  const checkpoint = a.snapshot(), expected = a.next(); b.restore(checkpoint); assert.equal(b.next(), expected);
  assert.equal(stateDigest({ a: 1, b: 2 }), stateDigest({ b: 2, a: 1 }));
});
test('input clear removes held throttle/fire and edge triggers together', () => {
  const frame = emptyActionFrame(1); frame.throttle = 1; frame.held.add('fire'); frame.pressed.add('interact'); frame.released.add('aim');
  clearActionFrame(frame); assert.equal(frame.throttle, 0); assert.equal(frame.held.size + frame.pressed.size + frame.released.size, 0);
});
