/**
 * V06/S11 full-runtime integration diagnostics, NOT an acceptance playthrough.
 * Fixtures explicitly prepare logical mission/actor states. Every load uses an
 * actual document reload and the ordinary Continue UI; handoffs, services and
 * retries use normal keyboard/menu actions against the real engine and world.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, webkit, firefox } from 'playwright';
import { PHASES } from '../../src/mission/definition.js';
import { SAVE_KEY, SETTINGS_KEY, encodeSave, decodeSave } from '../../src/game/save.js';

const engine = process.env.EWA93_PERSISTENCE_ENGINE || 'chromium';
const output = process.env.EWA93_PERSISTENCE_OUTPUT || `/tmp/ewa93-persistence-${Date.now()}`;
const records = [];
let server, browser, context, page, baseline;
let origin = process.env.EWA93_BASE_URL;
const runtimeErrors = [];

async function title(tab = page) {
  await tab.locator('.screen--title [data-action="newGame"]').waitFor({ state: 'visible', timeout: 90000 });
  // Rendering and simulation are driven explicitly after boot. This keeps the
  // software-rendered diagnostic deterministic; it measures no real-time FPS.
  await tab.evaluate(() => window.__exitWounds.runtime.game.stop());
}
async function current() { return page.evaluate(() => structuredClone(window.__exitWounds.state)); }
async function saved() { return decodeSave(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY)); }
async function step(seconds = 1 / 120) { await page.evaluate(s => window.__exitWounds.runtime.game.advance(s), seconds); }
async function pressE() {
  await page.keyboard.down('KeyE');
  try { await step(1 / 60); } finally { await page.keyboard.up('KeyE'); }
  await step(1 / 60);
}
async function settleCheckpoint() {
  const result = await page.evaluate(() => {
    const a = window.__exitWounds.app;
    // Police/traffic also own seat transitions. A successful interaction can
    // legitimately queue its save behind one of those physical transitions.
    for (let steps = 0; steps <= 600; steps++) {
      if (a.ui.screen !== 'playing') return { ok: false, screen: a.ui.screen };
      if (!a.runtime.vehicles.transitions.size && !a.state.mission.pendingCheckpoint && !a.checkpoints.pendingId) return { ok: true, steps };
      a.runtime.game.advance(1 / 120);
    }
    return { ok: false, transitions: a.runtime.vehicles.transitions.size,
      pending: a.state.mission.pendingCheckpoint, pendingId: a.checkpoints.pendingId };
  });
  assert.equal(result.ok, true, `Checkpoint did not reach a stable saved boundary: ${JSON.stringify(result)}`);
  return result;
}
async function placePlayer(position) {
  await page.evaluate(p => { const a = window.__exitWounds.app; a.player.place(p); a.syncState(); a.updateHUD(); }, position);
}
async function reloadAndContinue() {
  await page.reload({ waitUntil: 'domcontentloaded' }); await title();
  await page.locator('[data-action="continue"]').click();
  await page.locator('.hud').waitFor({ state: 'visible' });
  assert.equal(await page.evaluate(() => window.__exitWounds.app.ui.screen), 'playing');
}
async function loadFixture(state, { backup = null } = {}) {
  // Only this helper writes fixture state. The tested restoration crosses a new
  // document/engine instance rather than calling restoreRuntimeFromState().
  await page.evaluate(({ key, raw, previous }) => {
    localStorage.setItem(key, raw);
    if (previous === null) localStorage.removeItem(`${key}.backup`);
    else localStorage.setItem(`${key}.backup`, previous);
  }, { key: SAVE_KEY, raw: encodeSave(state, 123456789), previous: backup && encodeSave(backup, 123456788) });
  await reloadAndContinue();
}
function fixture(phase, suffix = phase.toLowerCase()) {
  const s = structuredClone(baseline);
  const progressed = ['RECOVERY', 'EXTRACTION', 'EVASION', 'DECISION'].includes(phase);
  const recovered = ['EXTRACTION', 'EVASION', 'DECISION'].includes(phase);
  const extracted = ['EVASION', 'DECISION'].includes(phase);
  s.runId = `integration-persistence-${suffix}`; s.tick = 1440; s.elapsed = 12;
  Object.assign(s.mission, { phase, phaseEnteredTick: 1200, checkpointId: PHASES[phase].checkpoint,
    pendingCheckpoint: false, route: progressed ? 'service' : null, junReached: recovered,
    caseRecovered: recovered, junExtracted: extracted, alarmTriggered: recovered,
    acknowledgedDialogue: ['intro'], messages: recovered ? ['eli-opening', 'depot-address'] : ['eli-opening'] });
  if(phase!=='INTRO')s.mission.eliCall={version:1,status:'superseded',remaining:0,nextLine:0,contacted:true,completed:false};
  s.player.health = 73; s.player.armor = 22; s.player.wallet = 380;
  s.player.inventory.case = recovered;
  s.player.inventory.weapons.pistol.magazine = 7; s.player.inventory.weapons.pistol.reserve = 41;
  if (recovered) { s.actors.jun.state = 'follow'; s.actors.jun.position = { x: 94, y: 311, z: .05 }; s.actors.jun.lastSafe = { ...s.actors.jun.position }; }
  if (['EXTRACTION', 'EVASION'].includes(phase)) Object.assign(s.wanted, {
    tier: 2, status: 'Searching', personId: 'mara', vehicleIds: ['mara-sedan'],
    lastKnown: { x: 94, y: 311, z: .05 }, radius: 100, visible: false,
    lastSeenTick: 1390, unseenSeconds: 2.5, clearProgress: 0, reportsReceived: ['integration-depot-alarm'],
  });
  return s;
}
async function capture(name) {
  // A single engine draw makes screenshots reflect the restored world even
  // though the RAF loop is stopped for deterministic assertions.
  await page.evaluate(() => window.__exitWounds.runtime.game.advance(0, { draw: true }));
  const path = `${output}/${name}.png`; await page.screenshot({ path, timeout: 90000 }); return path;
}
function scenario(name, fn) {
  test(`${engine}: ${name}`, { timeout: 600000 }, async () => {
    const record = { name, engine, version: browser.version(), fixtureBasedIntegration: true,
      seed: 93, startedAt: new Date().toISOString(), status: 'running', observations: [] };
    records.push(record); const errorStart = runtimeErrors.length;
    try { await fn(record); assert.deepEqual(runtimeErrors.slice(errorStart), []); record.status = 'passed'; }
    catch (error) { record.status = 'failed'; record.failure = error.message; record.state = await current().catch(() => null); record.capture = await capture(`failure-${records.length}`).catch(() => null); throw error; }
    finally { record.finishedAt = new Date().toISOString(); await writeFile(`${output}/report.json`, JSON.stringify({ origin, output, records }, null, 2)); }
  });
}

before(async () => {
  await mkdir(output, { recursive: true });
  if (!origin) {
    const port = await new Promise((resolve, reject) => {
      const probe = createServer(); probe.on('error', reject);
      probe.listen(0, '127.0.0.1', () => { const p = probe.address().port; probe.close(() => resolve(p)); });
    });
    origin = `http://127.0.0.1:${port}`;
    server = spawn(process.execPath, ['tools/serve.mjs', '--host', '127.0.0.1', '--port', String(port)], { stdio: 'ignore' });
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* Server starting. */ }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!ready) throw new Error('Persistence integration server did not start.');
  }
  const type = { chromium, webkit, firefox }[engine]; if (!type) throw new Error(`Unknown persistence engine: ${engine}`);
  browser = await type.launch({ headless: true, args: engine === 'chromium' ? ['--enable-unsafe-swiftshader'] : [] });
  context = await browser.newContext({ viewport: { width: 960, height: 600 }, reducedMotion: 'reduce' });
  await context.addInitScript(({ key }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ version: 1, settings: { quality: 'low', masterVolume: 0 } }));
  }, { key: SETTINGS_KEY });
  page = await context.newPage(); page.setDefaultTimeout(60000);
  page.on('pageerror', error => runtimeErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') runtimeErrors.push(message.text()); });
  await page.goto(origin, { waitUntil: 'domcontentloaded' }); await title();
  await page.locator('[data-action="newGame"]').click(); await page.locator('.hud').waitFor();
  baseline = await current();
  assert.deepEqual(runtimeErrors, [], 'Initial full-runtime boot emitted an error.');
});
after(async () => { await browser?.close(); server?.kill(); console.log(`Persistence integration evidence: ${output}`); });

scenario('actual reload preserves every stable pre-handoff checkpoint', async record => {
  for (const phase of ['INTRO', 'COLLECTION', 'APPROACH', 'RECOVERY', 'EXTRACTION', 'EVASION', 'DECISION']) {
    const s = fixture(phase); await loadFixture(s);
    assert.deepEqual(await current(), s, `${phase}: logical state changed during Continue`);
    const runtime = await page.evaluate(() => {
      const a = window.__exitWounds.app;
      return { player: a.player.position, jun: a.jun.position, activeCrew: a.crew.active,
        activeJun: a.jun.active, caseVisible: a.runtime.world.scene.getObjectByName('payroll-case')?.visible, transitions: a.runtime.vehicles.transitions.size };
    });
    assert.deepEqual(runtime.player, s.player.position); assert.deepEqual(runtime.jun, s.actors.jun.position);
    assert.equal(runtime.activeCrew, ['RECOVERY', 'EXTRACTION', 'EVASION'].includes(phase));
    assert.equal(runtime.activeJun, s.mission.junReached); assert.equal(runtime.transitions, 0);
    assert.equal(runtime.caseVisible, !s.mission.caseRecovered, 'Recovered case geometry must stay hidden after reload.');
    record.observations.push({ phase, checkpoint: s.mission.checkpointId, runtime });
  }
});

scenario('seated Mara and Jun reconstruct bodies, velocity and live tier-2 search', async record => {
  const s = fixture('EVASION', 'seated-search'), car = s.vehicles['yard-van'];
  Object.assign(car, { position: { x: 249, y: 340, z: .6 }, rotation: .31,
    velocity: { x: 1.25, y: -.5, z: 0 }, health: 62, appearance: 2,
    seats: { driver: 'mara', passenger: 'jun' } });
  Object.assign(s.player, { vehicleId: 'yard-van', seat: 'driver', position: { ...car.position } });
  Object.assign(s.actors.jun, { vehicleId: 'yard-van', seat: 'passenger', state: 'seated', position: { ...car.position } });
  await loadFixture(s); assert.deepEqual((await current()).wanted, s.wanted);
  const restored = await page.evaluate(() => {
    const a = window.__exitWounds.app, v = a.runtime.vehicles.get('yard-van');
    return { velocity: v.body.linvel(), health: v.health, appearance: v.appearance,
      playerSeat: a.runtime.vehicles.occupant(a.player.actor)?.seat,
      junSeat: a.runtime.vehicles.occupant(a.jun.actor)?.seat,
      seats: v.seats.map(actor => actor?.id || null),
      playerBodyRemoved: a.player.actor.body === null, junBodyRemoved: a.jun.actor.body === null,
      playerCollisionDisabled: !a.player.actor._seatBody.isEnabled(), junCollisionDisabled: !a.jun.actor._seatBody.isEnabled(),
      junVehicle: a.jun.vehicleId, sirens: [1, 2, 3].map(i => a.runtime.vehicles.get(`patrol-${i}`).siren),
      metadata: a.runtime.metadata };
  });
  assert.deepEqual(restored.velocity, { x: 20, y: -8, z: 0 });
  assert.equal(restored.health, 62); assert.equal(restored.appearance, 2);
  assert.deepEqual(restored.seats, ['mara', 'jun']); assert.equal(restored.playerSeat, 0); assert.equal(restored.junSeat, 1);
  assert.equal(restored.playerBodyRemoved && restored.junBodyRemoved && restored.playerCollisionDisabled && restored.junCollisionDisabled, true);
  assert.equal(restored.junVehicle, 'yard-van'); assert.deepEqual(restored.sirens, [true, true, false]);
  await step(.25);
  const live = await current(); assert.equal(live.wanted.tier, 2); assert.equal(live.mission.phase, 'EVASION');
  assert.deepEqual(live.wanted.reportsReceived, s.wanted.reportsReceived); assert.equal(live.player.inventory.case, true);
  assert.ok(Math.abs(live.wanted.unseenSeconds - 2.75) < .02, 'Restored search must continue its unseen timer.');
  assert.ok(Math.abs(live.wanted.clearProgress - .25) < .02, 'An unseen, unrecognized van outside the area accumulates clearance time without erasing heat.');
  assert.equal(live.player.vehicleId, 'yard-van'); assert.equal(live.actors.jun.vehicleId, 'yard-van');
  assert.equal(live.vehicles['yard-van'].seats.passenger, 'jun');
  record.observations.push({ restored, liveWanted: live.wanted }); record.capture = await capture('seated-search-restored');
});

scenario('seat-transition checkpoint waits then flushes at the stable boundary', async record => {
  const s = fixture('COLLECTION', 'queued-seat');
  s.player.position = { x: 94, y: 322.6, z: .05 };
  await loadFixture(s);
  const queued = await page.evaluate(key => {
    const a = window.__exitWounds.app, before = localStorage.getItem(key);
    const result = a.runtime.vehicles.enter(a.player.actor, 'mara-sedan', 'driver');
    a.captureCheckpoint('queued-seat-stable');
    return { entered: result.ok, transitions: a.runtime.vehicles.transitions.size,
      unchanged: before === localStorage.getItem(key), pendingId: a.checkpoints.pendingId };
  }, SAVE_KEY);
  assert.equal(queued.entered, true); assert.equal(queued.unchanged, true); assert.equal(queued.pendingId, 'queued-seat-stable');
  await step(1.25);
  const persisted = await saved(); assert.equal(persisted.ok, true);
  assert.equal(persisted.state.mission.checkpointId, 'queued-seat-stable', 'Queued checkpoint must flush after the physical entry finishes.');
  assert.equal(persisted.state.player.vehicleId, 'mara-sedan'); assert.equal(persisted.state.vehicles['mara-sedan'].seats.driver, 'mara');
  const raw = persisted.state; await reloadAndContinue(); assert.equal((await current()).player.vehicleId, 'mara-sedan');
  record.observations.push({ queued, checkpoint: raw.mission.checkpointId });
});

scenario('interrupted civilian-car taking restores one valid driver and survives reload', async record => {
  await loadFixture(fixture('COLLECTION', 'interrupted-taking'));
  const target = await page.evaluate(() => {
    const a = window.__exitWounds.app, record = a.traffic.records[0], v = record.vehicle;
    const door = a.runtime.vehicles.doorPosition(v, 0, .8);
    a.player.place({ x: door.x / 16, y: door.y / 16, z: .05 });
    a.syncState(); a.updateHUD(); a.runtime.world.step(1 / 120);
    return { car: v.id, driver: record.driver.id, nearest: a.nearestInteraction()?.id };
  });
  assert.equal(target.nearest, target.car); await pressE();
  const taking = await page.evaluate(() => {
    const a = window.__exitWounds.app, theft = a.traffic.pendingThefts[0];
    return { pending: a.traffic.pendingThefts.length, exiting: theft && a.runtime.vehicles.transitions.get(theft.record.driver)?.kind, abandoned: theft?.record.abandoned };
  });
  assert.equal(taking.pending, 1); assert.equal(taking.exiting, 'exit'); assert.equal(taking.abandoned, true);
  // Inject the impact notification only. Actual chassis-contact damage is
  // covered by engine.test.mjs; this probes the game's interruption orchestration.
  const interrupted = await page.evaluate(({ car, driver }) => {
    const a = window.__exitWounds.app, record = a.traffic.records.find(r => r.id === car), v = record.vehicle;
    a.onVehicleEvent({ type: 'VehicleImpact', sourceId: car, payload: { damage: 12 } });
    a.captureCheckpoint('interrupted-taking-safe');
    return { pending: a.traffic.pendingThefts.length, abandoned: record.abandoned, fleeing: record.fleeing,
      seat: v.seats[0]?.id, occupant: a.runtime.vehicles.occupant(record.driver)?.vehicle.id,
      transition: a.runtime.vehicles.transitions.has(record.driver), disabledBody: record.driver.body === null && !record.driver._seatBody.isEnabled(),
      driverSeatCount: a.runtime.vehicles.list.flatMap(v => v.seats).filter(actor => actor?.id === driver).length,
      maraSeated: !!a.runtime.vehicles.occupant(a.player.actor) };
  }, target);
  assert.deepEqual(interrupted, { pending: 0, abandoned: false, fleeing: false, seat: target.driver,
    occupant: target.car, transition: false, disabledBody: true, driverSeatCount: 1, maraSeated: false });
  const persisted = await saved(); assert.equal(persisted.ok, true); assert.equal(persisted.state.mission.checkpointId, 'interrupted-taking-safe');
  await reloadAndContinue();
  const restored = await page.evaluate(({ car, driver }) => {
    const a = window.__exitWounds.app, record = a.traffic.records.find(r => r.id === car);
    return { seat: record.vehicle.seats[0]?.id, abandoned: record.abandoned, fleeing: record.fleeing,
      driverSeatCount: a.runtime.vehicles.list.flatMap(v => v.seats).filter(actor => actor?.id === driver).length,
      disabledBody: record.driver.body === null && !record.driver._seatBody.isEnabled() };
  }, target);
  assert.deepEqual(restored, { seat: target.driver, abandoned: false, fleeing: false, driverSeatCount: 1, disabledBody: true });
  record.observations.push({ target, taking, interrupted, restored });
});

scenario('earned favor, respray, food, armor and ammo persist once through actual interactions', async record => {
  const s = fixture('COLLECTION', 'services'); s.mission.favor = 'earned';
  s.player.wallet = 180; s.player.health = 37; s.player.armor = 0;
  s.player.position = { x: 94, y: 305, z: .05 };
  Object.assign(s.vehicles['mara-sedan'], { position: { x: 94, y: 310, z: .6 }, health: 39, appearance: 0 });
  Object.assign(s.wanted, { tier: 1, status: 'Searching', visible: false, personId: 'mara', vehicleIds: ['mara-sedan'], lastKnown: { x: 94, y: 310, z: 0 }, radius: 60 });
  await loadFixture(s); await pressE(); await settleCheckpoint();
  let purchased = await saved(); assert.equal(purchased.ok, true); assert.equal(purchased.state.mission.favor, 'consumed');
  assert.equal(purchased.state.player.wallet, 180); assert.equal(purchased.state.vehicles['mara-sedan'].health, 100);
  assert.equal(purchased.state.vehicles['mara-sedan'].appearance, 1); assert.deepEqual(purchased.state.wanted.vehicleIds, []);
  await reloadAndContinue(); await placePlayer({ x: 96, y: 223, z: .05 }); await pressE(); await settleCheckpoint();
  let state = await current(); assert.equal(state.player.health, 100); assert.equal(state.player.wallet, 170);
  await placePlayer({ x: 143, y: 223, z: .05 }); await pressE(); await settleCheckpoint();
  state = await current(); assert.equal(state.player.armor, 100); assert.equal(state.player.wallet, 110);
  await placePlayer({ x: 320, y: 106, z: .05 }); await pressE(); await settleCheckpoint();
  purchased = await saved(); assert.equal(purchased.ok, true);
  assert.equal(purchased.state.player.inventory.weapons.pistol.reserve, 77);
  assert.ok(purchased.state.player.inventory.pickups.includes('depot-ammo'));
  await reloadAndContinue(); await pressE();
  state = await current(); assert.equal(state.mission.favor, 'consumed'); assert.equal(state.player.wallet, 110);
  assert.equal(state.player.health, 100); assert.equal(state.player.armor, 100);
  assert.equal(state.player.inventory.weapons.pistol.reserve, 77); assert.equal(state.player.inventory.weapons.pistol.magazine, 7);
  assert.equal(state.economy.transactions.length, 3); assert.equal(state.vehicles['mara-sedan'].appearance, 1);
  assert.equal(await page.evaluate(() => window.__exitWounds.runtime.world.scene.getObjectByName('ammo-box')?.visible), false);
  record.observations.push({ transactions: state.economy.transactions, inventory: state.player.inventory, favor: state.mission.favor });
});

scenario('retry revives checkpoint crew with actual hero collision masks and inventory', async record => {
  const s = fixture('RECOVERY', 'retry'); await loadFixture(s);
  const before = await page.evaluate(() => {
    const a = window.__exitWounds.app, e = a.crew.enemies[0], R = a.runtime.E.RAPIER;
    a.runtime.world.step(1 / 120);
    const hit = () => !!a.runtime.world.pw.castRay(new R.Ray({ x: e.actor.x - 32, y: e.actor.y, z: e.actor.z + 16 }, { x: 1, y: 0, z: 0 }), 64, true, undefined, a.player.actor.col.collisionGroups(), undefined, undefined, c => c.handle === e.actor.col.handle);
    const healthy = { health: e.health, groups: e.actor.col.collisionGroups(), hit: hit() };
    a.crew.handleHit(e.id, 999); a.runtime.world.step(1 / 120);
    const down = { health: e.health, groups: e.actor.col.collisionGroups(), hit: hit() };
    a.state.player.inventory.weapons.pistol.reserve = 1; a.state.player.wallet = 1;
    a.dispatch('ActorDown', { actorId: 'mara' }, 'mara');
    a.runtime.game.advance(1 / 120);
    return { id: e.id, healthy, down, screen: a.ui.screen };
  });
  assert.equal(before.healthy.hit, true); assert.equal(before.down.hit, false); assert.equal(before.down.health, 0); assert.equal(before.screen, 'retry');
  await page.locator('[data-action="retryCheckpoint"]').click();
  const restored = await page.evaluate(id => {
    const a = window.__exitWounds.app, e = a.crew.enemies.find(e => e.id === id), R = a.runtime.E.RAPIER;
    a.runtime.world.step(1 / 120);
    const hit = a.runtime.world.pw.castRay(new R.Ray({ x: e.actor.x - 32, y: e.actor.y, z: e.actor.z + 16 }, { x: 1, y: 0, z: 0 }), 64, true, undefined, a.player.actor.col.collisionGroups(), undefined, undefined, c => c.handle === e.actor.col.handle);
    return { health: e.health, groups: e.actor.col.collisionGroups(), solid: e.actor.solid, enabled: e.actor.body.isEnabled(), hit: !!hit, state: structuredClone(a.state), screen: a.ui.screen };
  }, before.id);
  assert.equal(restored.health, before.healthy.health); assert.equal(restored.groups, before.healthy.groups);
  assert.equal(restored.solid && restored.enabled && restored.hit, true); assert.equal(restored.screen, 'playing');
  assert.equal(restored.state.player.wallet, 380); assert.equal(restored.state.player.inventory.weapons.pistol.reserve, 41);
  assert.equal(restored.state.mission.phase, 'RECOVERY'); assert.equal(restored.state.mission.failure, null);
  record.observations.push({ before, restored: { health: restored.health, groups: restored.groups, hit: restored.hit } });
});

scenario('in-session retry from seated Mara and Jun restores the on-foot checkpoint collision bodies', async record => {
  const s = fixture('RECOVERY', 'seated-to-foot-retry');
  s.mission.junReached = true; s.player.health = 100; s.player.armor = 100;
  s.player.position = { x: 367, y: 148, z: .05 };
  Object.assign(s.actors.jun, { position: { x: 367, y: 150, z: .05 }, state: 'follow' });
  s.actors.jun.lastSafe = { ...s.actors.jun.position };
  await loadFixture(s);
  const footGroups = await page.evaluate(() => ({ mara: window.__exitWounds.app.player.actor.col.collisionGroups(), jun: window.__exitWounds.app.jun.actor.col.collisionGroups() }));
  await pressE(); await step(2.1);
  const seated = await page.evaluate(() => {
    const a = window.__exitWounds.app;
    return { mara: a.runtime.vehicles.occupant(a.player.actor)?.vehicle.id,
      jun: a.runtime.vehicles.occupant(a.jun.actor)?.vehicle.id, junGroups: a.jun.actor.col.collisionGroups(),
      checkpointJunVehicle: a.checkpoints.snapshot.actors.jun.vehicleId };
  });
  assert.equal(seated.mara, 'yard-van'); assert.equal(seated.jun, 'yard-van');
  assert.notEqual(seated.junGroups, footGroups.jun); assert.equal(seated.checkpointJunVehicle, null);
  await page.evaluate(() => window.__exitWounds.app.dispatch('ActorDown', { actorId: 'mara' }, 'mara'));
  await step(); await page.locator('[data-action="retryCheckpoint"]').click();
  const restored = await page.evaluate(() => {
    const a = window.__exitWounds.app, actor = a.jun.actor, R = a.runtime.E.RAPIER;
    a.runtime.world.step(1 / 120);
    const hit = a.runtime.world.pw.castRay(new R.Ray({ x: actor.x - 32, y: actor.y, z: actor.z + 16 }, { x: 1, y: 0, z: 0 }), 64, true, undefined, a.crew.enemies[0].actor.col.collisionGroups(), undefined, undefined, c => c.handle === actor.col.handle);
    return { maraGroups: a.player.actor.col.collisionGroups(), junGroups: actor.col.collisionGroups(),
      maraEnabled: !!a.player.actor.body?.isEnabled(), junEnabled: !!actor.body?.isEnabled(),
      maraVehicle: a.runtime.vehicles.occupant(a.player.actor)?.vehicle.id || null,
      junVehicle: a.runtime.vehicles.occupant(actor)?.vehicle.id || null,
      junSolid: actor.solid, junMobQuery: !!hit, mode: a.jun.mode, phase: a.state.mission.phase };
  });
  assert.equal(restored.maraGroups, footGroups.mara); assert.equal(restored.junGroups, footGroups.jun);
  assert.equal(restored.maraEnabled && restored.junEnabled && restored.junSolid && restored.junMobQuery, true);
  assert.equal(restored.maraVehicle, null); assert.equal(restored.junVehicle, null);
  assert.equal(restored.mode, 'follow'); assert.equal(restored.phase, 'RECOVERY');
  record.observations.push({ freshReloadFootGroups: footGroups, seated, inSessionRetry: restored });
});

scenario('both choices reload, commit through E, pay once after reload/retry and replay cleanly', async record => {
  for (const ending of ['reporter', 'broker']) {
    const s = fixture('DECISION', ending), position = ending === 'reporter' ? { x: 383, y: 358, z: .05 } : { x: 93, y: 88, z: .05 };
    s.mission.choice = ending; s.player.wallet = 80; s.player.position = { ...position };
    Object.assign(s.actors.jun, { position: { x: position.x, y: position.y + 2, z: .05 }, state: 'follow' });
    s.actors.jun.lastSafe = { ...s.actors.jun.position };
    await loadFixture(s); assert.equal((await current()).mission.choice, ending);
    assert.equal((await current()).player.inventory.case, true); await pressE();
    const completed = await current(), reward = ending === 'reporter' ? 600 : 1200;
    assert.equal(completed.mission.phase, 'AFTERMATH'); assert.equal(completed.mission.ending, ending);
    assert.equal(completed.mission.completed && completed.mission.rewardPaid, true); assert.equal(completed.player.inventory.case, false);
    assert.equal(completed.player.wallet, 80 + reward);
    assert.equal(completed.economy.transactions.filter(id => id === `${s.runId}:mission-reward`).length, 1);
    const committed = await saved(); assert.equal(committed.ok, true); assert.equal(committed.state.mission.phase, 'AFTERMATH');
    assert.equal(committed.state.district.investigationNotice, ending === 'reporter');
    assert.equal(committed.state.district.marketShuttered, ending === 'broker');
    assert.ok(committed.state.mission.messages.includes(`${ending}-ending`));
    record.observations.push({ ending, wallet: completed.player.wallet, checkpoint: committed.state.mission.checkpointId });
    record[`${ending}Capture`] = await capture(`handoff-${ending}`);
    await reloadAndContinue(); await pressE();
    assert.equal((await current()).player.wallet, 80 + reward);
    // A second unique domain commit probes idempotence even though ordinary UI
    // no longer offers an exchange. This is integration-only fault injection.
    const duplicate = await page.evaluate(() => window.__exitWounds.app.dispatch('HandoffCommitted', {}, 'mara', null, 'integration-duplicate-commit'));
    assert.equal(duplicate.ok, false); assert.equal(duplicate.reason, 'handoff-already-completed');
    await page.keyboard.press('Escape'); await step();
    await page.locator('[data-action="restartCheckpoint"]').click(); await page.locator('[data-action="confirmYes"]').click();
    assert.equal((await current()).player.wallet, 80 + reward); assert.equal((await current()).mission.ending, ending);
    if (ending === 'broker') {
      await page.keyboard.press('Escape'); await step();
      await page.locator('[data-action="replayMission"]').click();
      await page.locator('[data-action="confirmNo"]').click();
      assert.equal((await current()).runId, s.runId); assert.equal((await current()).player.wallet, 1280);
      await page.locator('[data-action="replayMission"]').click(); await page.locator('[data-action="confirmYes"]').click();
      const replay = await current(); assert.notEqual(replay.runId, s.runId); assert.equal(replay.mission.phase, 'INTRO');
      assert.equal(replay.mission.completed, false); assert.equal(replay.mission.favor, 'available');
      assert.equal(replay.player.wallet, 80); assert.equal(replay.player.inventory.case, false);
      assert.deepEqual(replay.player.inventory.weapons.pistol, { owned: true, magazine: 12, reserve: 48, nextFireTick: 0, reloadEndTick: 0 });
      assert.equal(replay.wanted.tier, 0); assert.deepEqual(replay.economy.transactions, []);
      assert.equal(replay.district.marketShuttered, false); assert.equal((await saved()).state.runId, replay.runId);
      record.observations.push({ replayRunId: replay.runId, previousRunId: s.runId, wallet: replay.player.wallet });
    }
  }
});

scenario('corrupt primary remains intact until explicit backup recovery', async record => {
  const s = fixture('EVASION', 'backup'); await loadFixture(s);
  const corrupt = '{"interrupted-write":';
  await page.evaluate(({ key, raw, previous }) => { localStorage.setItem(key, raw); localStorage.setItem(`${key}.backup`, previous); }, { key: SAVE_KEY, raw: corrupt, previous: encodeSave(s, 123) });
  await page.reload({ waitUntil: 'domcontentloaded' }); await title();
  assert.match(await page.locator('[data-action="continue"]').innerText(), /recover save/i);
  await page.locator('[data-action="newGame"]').click(); await page.locator('.screen--confirm').waitFor();
  await page.locator('[data-action="confirmNo"]').click();
  assert.equal(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY), corrupt);
  await page.locator('[data-action="continue"]').click();
  await page.locator('.screen--error').waitFor();
  assert.match(await page.locator('.screen--error').innerText(), /previous good checkpoint/i);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY), corrupt);
  record.capture = await capture('corrupt-save-explicit-recovery');
  await page.locator('[data-action="retryError"]').click(); await page.locator('.hud').waitFor();
  assert.deepEqual(await current(), s); assert.equal((await saved()).ok, true);
  record.observations.push({ backupRestored: true, phase: (await current()).mission.phase });
});

scenario('storage write denial preserves the last good save and reports failure visibly', async record => {
  const s = fixture('COLLECTION', 'write-denied'); await loadFixture(s);
  const result = await page.evaluate(key => {
    const a = window.__exitWounds.app, previous = localStorage.getItem(key), original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (k.startsWith(key)) throw new DOMException('Integration quota denial', 'QuotaExceededError'); return original.call(this, k, v); };
    try { a.state.player.wallet -= 10; a.captureCheckpoint('denied-write'); return { unchanged: localStorage.getItem(key) === previous, notice: document.querySelector('#hud-toast')?.textContent }; }
    finally { Storage.prototype.setItem = original; }
  }, SAVE_KEY);
  assert.equal(result.unchanged, true); assert.match(result.notice, /checkpoint could not be saved/i);
  assert.equal(await page.locator('#hud-toast').isVisible(), true);
  assert.equal((await saved()).state.player.wallet, 380); record.observations.push(result);
  record.capture = await capture('storage-write-denied-visible');
});

scenario('browser storage denied at boot exposes session-only progress and survives play', async record => {
  const deniedContext = await browser.newContext({ viewport: { width: 960, height: 600 }, reducedMotion: 'reduce' });
  const errors = []; const denied = await deniedContext.newPage(); denied.on('pageerror', error => errors.push(error.message));
  denied.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await denied.addInitScript(() => {
    for (const name of ['getItem', 'setItem', 'removeItem']) Storage.prototype[name] = function () { throw new DOMException('Integration storage denied', 'SecurityError'); };
  });
  try {
    await denied.goto(origin, { waitUntil: 'domcontentloaded' }); await title(denied);
    assert.match(await denied.locator('.screen--title').innerText(), /storage is unavailable.*only this session/i);
    await denied.locator('[data-action="newGame"]').click(); await denied.locator('.hud').waitFor();
    const session = await denied.evaluate(() => { const a = window.__exitWounds.app; a.runtime.game.advance(.1); return { persistent: a.persistentStorage, loaded: a.saveStore.load().ok, health: a.state.player.health, phase: a.state.mission.phase }; });
    assert.deepEqual(session, { persistent: false, loaded: true, health: 100, phase: 'INTRO' });
    await denied.reload({ waitUntil: 'domcontentloaded' }); await title(denied);
    assert.equal(await denied.locator('[data-action="continue"]').isDisabled(), true);
    assert.match(await denied.locator('.screen--title').innerText(), /only this session/i); assert.deepEqual(errors, []);
    record.capture = `${output}/storage-denied-at-boot.png`;
    await denied.screenshot({ path: record.capture, timeout: 90000 });
    record.observations.push(session);
  } finally { await deniedContext.close(); }
});
