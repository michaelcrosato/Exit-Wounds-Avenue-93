/**
 * Focused actual-runtime sedan extraction. Starts from a save produced by the
 * complete controller route at Bea's market (APPROACH). The original sedan is
 * driven from Eli's garage to the depot with standard Gamepad API input; Jun,
 * the case, sedan seats, vehicle physics and mission transitions remain live.
 * No actor/vehicle transform, mission event or objective flag is injected.
 *
 * Required: EWA93_SEDAN_STORAGE=/path/to/03-bea-market.storage.json
 * Optional: EWA93_SEDAN_CDP_URL=http://127.0.0.1:9223 (Windows GPU Chrome)
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const storagePath = process.env.EWA93_SEDAN_STORAGE;
assert.ok(storagePath, 'Set EWA93_SEDAN_STORAGE to a real 03-bea-market.storage.json from controller-route.mjs.');
const storage = JSON.parse(await readFile(storagePath, 'utf8'));
const origin = storage.origins?.find(item => item.localStorage?.some(entry => entry.name === 'exit-wounds-avenue-93.save.v1'));
assert.ok(origin, 'The supplied browser storage has no real Exit Wounds save.');
const serialized = origin.localStorage.find(entry => entry.name === 'exit-wounds-avenue-93.save.v1');
const savedState = JSON.parse(serialized.value).state;
const departureOnly = savedState.mission.phase === 'EVASION';
const probeOnly = departureOnly && process.env.EWA93_SEDAN_PROBE === '1';
assert.ok(['APPROACH', 'EVASION'].includes(savedState.mission.phase),
  'Use a real Bea APPROACH save for the full route or its post-boarding EVASION save for departure calibration.');
if (departureOnly) {
  assert.equal(savedState.player.vehicleId, 'mara-sedan');
  assert.equal(savedState.actors.jun.vehicleId, 'mara-sedan');
  assert.equal(savedState.actors.jun.seat, 'passenger');
  assert.equal(savedState.mission.junExtracted, true);
} else {
  assert.equal(savedState.mission.junReached, false);
  assert.equal(savedState.mission.caseRecovered, false);
  assert.equal(savedState.mission.junExtracted, false);
}
assert.ok(savedState.vehicles['mara-sedan'] && !savedState.vehicles['mara-sedan'].disabled);
if (!departureOnly) assert.ok(savedState.vehicles['mara-sedan'].position.x < 130 && savedState.vehicles['mara-sedan'].position.y > 300,
  'The starting sedan must still be at Eli’s garage, not prepositioned at the depot.');
const baseURL = process.env.EWA93_BASE_URL || origin.origin;
assert.equal(new URL(baseURL).origin, origin.origin, 'The server URL must share the saved browser origin.');
const output = process.env.EWA93_SEDAN_OUTPUT || `/tmp/ewa93-sedan-extraction-${Date.now()}`;
await mkdir(output, { recursive: true });
const cdpURL = process.env.EWA93_SEDAN_CDP_URL;
const browser = cdpURL ? await chromium.connectOverCDP(cdpURL) : await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce', storageState: storage });
await context.addInitScript(() => {
  window.__qaPad = { axes: [0, 0, 0, 0], values: Array(17).fill(0) };
  window.__qaExternalInputs = { keydown: 0, mousedown: 0, pointerdown: 0, touchstart: 0 };
  for (const type of Object.keys(window.__qaExternalInputs)) window.addEventListener(type, event => {
    if (event.isTrusted) window.__qaExternalInputs[type]++;
  }, { capture: true });
  Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [{
    index: 0, id: 'Virtual DualSense sedan-extraction fixture', mapping: 'standard', connected: true,
    timestamp: performance.now(), axes: window.__qaPad.axes,
    buttons: window.__qaPad.values.map(value => ({ value, pressed: value > 0.5, touched: value > 0 })),
  }] });
});
const page = await context.newPage();
page.setDefaultTimeout(60000);
const sourceFiles = ['src/main.js', 'src/engine/input.js', 'src/engine/vehicles.js', 'src/actors/companion.js', 'src/mission/director.js', 'tests/e2e/sedan-extraction.mjs'];
async function hashes() { return Object.fromEntries(await Promise.all(sourceFiles.map(async name => [name,
  createHash('sha256').update(await readFile(new URL(`../../${name}`, import.meta.url))).digest('hex')]))); }
const report = {
  status: 'running', startedAt: new Date().toISOString(), browserVersion: browser.version(), baseURL,
  input: 'Standard Gamepad API emulation consumed through the engine’s normal poller',
  acceleratedFixedSteps: true, physicalController: false,
  staging: { kind: departureOnly ? 'real post-boarding browser checkpoint' : 'real Bea browser checkpoint',
    path: storagePath, phase: savedState.mission.phase,
    runId: savedState.runId, sedanPosition: savedState.vehicles['mara-sedan'].position,
    actorOrVehicleTeleport: false, injectedMissionEvents: false },
  sourceHashes: await hashes(), errors: [], checkpoints: [], driveWaypoints: [], driveSamples: [], junTrail: [],
};
page.on('pageerror', error => report.errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });

async function read() {
  return page.evaluate(() => {
    const a = window.__exitWounds.app, s = a.state, car = a.runtime.vehicles.get('mara-sedan');
    return {
      screen: a.ui.screen, phase: s?.mission.phase, failure: s?.mission.failure, tick: s?.tick, elapsed: s?.elapsed,
      runId: s?.runId, position: s?.player.position, vehicleId: s?.player.vehicleId,
      health: s?.player.health, armor: s?.player.armor, inventory: s?.player.inventory,
      caseRecovered: s?.mission.caseRecovered, junReached: s?.mission.junReached,
      junExtracted: s?.mission.junExtracted, defeatedCrew: s?.mission.defeatedCrew,
      wanted: s?.wanted, jun: s?.actors.jun, junRuntime: { position: a.jun.position, mode: a.jun.mode },
      sedan: car ? { position: car.position, yaw: car.yaw, speed: car.speed / 16, health: car.health,
        disabled: car.disabled, seats: car.seats.map(actor => actor?.id || null) } : null,
      patrol2: a.runtime.vehicles.get('patrol-2')?.position,
      transitions: [...a.runtime.vehicles.transitions].map(([actor, transition]) => ({ actor: actor.id, kind: transition.kind, vehicle: transition.vehicle.id })),
      yaw: a.runtime.camera.yaw, pitch: a.runtime.camera.pitch,
      eye: a.runtime.camera.eye ? { x: a.runtime.camera.eye.x / 16, y: a.runtime.camera.eye.y / 16, z: a.runtime.camera.eye.z / 16 } : null,
      prompt: document.querySelector('#hud-prompt')?.textContent,
      crew: a.crew.enemies.map(enemy => ({ id: enemy.id, health: enemy.health, position: a.crew.positionOf(enemy) })),
      padMapping: a.runtime.input.engine.padMapping, inputDevice: a.runtime.input.engine.lastDevice,
    };
  });
}
async function step(seconds = 0.08, axes = [0, 0, 0, 0], values = {}) {
  await page.evaluate(({ seconds, axes, values }) => {
    window.__qaPad.axes = axes;
    window.__qaPad.values = Array.from({ length: 17 }, (_, index) => values[index] || 0);
    window.__exitWounds.runtime.game.advance(seconds);
  }, { seconds, axes, values });
  const state = await read();
  if (state.failure || state.screen === 'error' || state.screen === 'retry')
    throw new Error(`Mission failure: ${JSON.stringify(state.failure || state.screen)}`);
  return state;
}
async function note(name) {
  const state = await step(0.025);
  report.checkpoints.push({ name, ...state });
  await page.screenshot({ path: `${output}/${name}.png` });
  await context.storageState({ path: `${output}/${name}.storage.json` });
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ name, phase: state.phase, elapsed: state.elapsed,
    position: state.position, sedan: state.sedan.position, jun: state.jun.position }));
}
async function padTap(index) { await step(0.05, [0, 0, 0, 0], { [index]: 1 }); return step(0.05); }
async function interact(expectedPhase) {
  await step(0.025); await padTap(3);
  if (expectedPhase) assert.equal((await read()).phase, expectedPhase,
    `Triangle interaction should reach ${expectedPhase}; ${(await read()).prompt}`);
}
async function walk(x, y, { sprint = true, radius = 1.15 } = {}) {
  let last = await read(), stagnant = 0;
  for (let count = 0; count < 1400; count++) {
    const dx = x - last.position.x, dy = y - last.position.y, distance = Math.hypot(dx, dy);
    if (distance <= radius) { await step(0.025); return; }
    const c = Math.cos(last.yaw), s = Math.sin(last.yaw);
    const axes = [(-s * dx + c * dy) / distance, (-c * dx - s * dy) / distance, 0, 0];
    const next = await step(Math.min(0.2, distance / (sprint ? 5.15 : 3.05) * 0.6), axes, sprint ? { 0: 1 } : {});
    stagnant = Math.hypot(next.position.x - last.position.x, next.position.y - last.position.y) < 0.02 ? stagnant + 1 : 0;
    if (stagnant > 35) throw new Error(`Foot route blocked toward (${x},${y}) at ${JSON.stringify(next.position)}; ${next.prompt}`);
    last = next;
  }
  throw new Error(`Foot route could not converge to (${x},${y}).`);
}
async function route(points, options) { for (const [x, y] of points) await walk(x, y, options); }
async function stopCar() {
  for (let count = 0; count < 160; count++) {
    const state = await read();
    assert.equal(state.vehicleId, 'mara-sedan', 'The sedan must remain occupied while braking.');
    if (Math.abs(state.sedan.speed) < 0.12) { await step(0.05); return; }
    await step(0.08, [0, 0, 0, 0], { 5: 1, ...(state.sedan.speed > 0.7 ? { 6: 1 } : {}) });
  }
  throw new Error('Physical gamepad braking could not stop the sedan.');
}
async function drive(x, y, { radius = 2.3, speed = 5, reverse = false } = {}) {
  let stagnant = 0, last = await read();
  for (let count = 0; count < 1800; count++) {
    assert.equal(last.vehicleId, 'mara-sedan', 'The driver seat must remain occupied.');
    assert.ok(last.sedan.health > 0 && !last.sedan.disabled, 'The sedan must remain drivable.');
    const dx = x - last.sedan.position.x, dy = y - last.sedan.position.y, distance = Math.hypot(dx, dy);
    if (distance < radius) {
      await stopCar(); report.driveWaypoints.push({ goal: { x, y }, reverse, sedan: (await read()).sedan }); return;
    }
    const desiredYaw = Math.atan2(dy, dx) + (reverse ? Math.PI : 0);
    const delta = Math.atan2(Math.sin(desiredYaw - last.sedan.yaw), Math.cos(desiredYaw - last.sedan.yaw)) * (reverse ? -1 : 1);
    const desiredSpeed = Math.min(speed, distance < 8 ? 2.4 : Math.abs(delta) > 0.55 ? 3 : speed);
    const steer = Math.max(-1, Math.min(1, delta * 1.8));
    const measuredSpeed = Math.abs(last.sedan.speed);
    const values = reverse
      ? measuredSpeed < desiredSpeed - 0.2 ? { 6: 0.9 } : measuredSpeed > desiredSpeed + 0.5 ? { 5: 1 } : {}
      : last.sedan.speed < desiredSpeed - 0.2 ? { 7: 0.75 } : last.sedan.speed > desiredSpeed + 0.5 ? { 6: 0.65 } : {};
    const next = await step(0.08, [steer, 0, 0, 0], values);
    if (count % 8 === 0 || next.sedan.health < last.sedan.health) report.driveSamples.push({
      count, goal: { x, y }, reverse, steer, values, sedan: next.sedan, patrol2: next.patrol2,
    });
    stagnant = Math.hypot(next.sedan.position.x - last.sedan.position.x, next.sedan.position.y - last.sedan.position.y) < 0.005 ? stagnant + 1 : 0;
    if (stagnant > 90) throw new Error(`Physical sedan driving blocked toward (${x},${y}): ${JSON.stringify(next.sedan)}`);
    last = next;
  }
  throw new Error(`Physical sedan route could not converge to (${x},${y}).`);
}
async function driveRoute(points, options) { for (const [x, y] of points) await drive(x, y, options); }
async function reverseOutOfDepot(start) {
  // The lane's tier-2 cruiser approaches head-on. Creeping at 2.4 m/s lets its
  // bumper push the sedan north: L2 then brakes positive speed instead of
  // reversing. Hold an ordinary full reverse trigger, as a player would when
  // escaping a pursuing car, and use the sedan's already-northward heading.
  assert.ok(start.sedan.yaw < -1.4 && start.sedan.yaw > -1.9,
    `The authored parking approach must leave the sedan facing north: ${start.sedan.yaw}`);
  let previous = start, stagnant = 0;
  for (let count = 0; count < 180; count++) {
    const state = await step(0.08, [0, 0, 0, 0], { 6: 0.9 });
    assert.equal(state.vehicleId, 'mara-sedan');
    assert.equal(state.jun.vehicleId, 'mara-sedan');
    assert.equal(state.jun.seat, 'passenger');
    assert.ok(state.sedan.health > 0 && !state.sedan.disabled, 'The sedan must remain drivable through the gate.');
    if (count % 8 === 0 || state.sedan.health < previous.sedan.health) report.driveSamples.push({
      count, goal: 'reverse out of depot', reverse: true, steer: 0, values: { 6: 0.9 },
      sedan: state.sedan, patrol2: state.patrol2,
    });
    const progress = state.sedan.position.y - previous.sedan.position.y;
    stagnant = progress < 0.005 ? stagnant + 1 : 0;
    const distance = Math.hypot(state.sedan.position.x - start.sedan.position.x,
      state.sedan.position.y - start.sedan.position.y);
    if (state.sedan.position.y > 194 && distance > 40) return state;
    if (stagnant > 65) throw new Error(`The sedan could not reverse past the pursuer: ${JSON.stringify({ sedan: state.sedan, patrol2: state.patrol2 })}`);
    previous = state;
  }
  throw new Error(`The sedan did not leave the depot after sustained physical reverse: ${JSON.stringify(previous.sedan)}`);
}
async function aimAt(position) {
  for (let count = 0; count < 80; count++) {
    const state = await read(), eye = state.eye || { ...state.position, z: state.position.z + 1.5 };
    const dx = position.x - eye.x, dy = position.y - eye.y;
    const yaw = Math.atan2(dy, dx), yawDelta = Math.atan2(Math.sin(yaw - state.yaw), Math.cos(yaw - state.yaw));
    const pitch = Math.atan2((position.z || 0) + 1.2 - eye.z, Math.hypot(dx, dy));
    const pitchDelta = pitch - state.pitch;
    if (Math.abs(yawDelta) < 0.012 && Math.abs(pitchDelta) < 0.012) return;
    const desiredX = yawDelta / (0.04 * 2.6), desiredY = -pitchDelta / (0.04 * 1.9), length = Math.hypot(desiredX, desiredY);
    const scale = length > 0 ? (0.12 + 0.88 * Math.min(1, length)) / length : 0;
    await step(0.04, [0, 0, desiredX * scale, desiredY * scale], { 6: 1 });
  }
}
async function fight() {
  const ineffective = new Map();
  for (let burst = 0; burst < 32; burst++) {
    const state = await read();
    if (!state.crew.some(enemy => enemy.health > 0)) return;
    const target = await page.evaluate(blocked => {
      const a = window.__exitWounds.app, p = a.player.position;
      return a.crew.living.filter(enemy => {
        if (blocked.includes(enemy.id)) return false;
        const q = a.crew.positionOf(enemy);
        return Math.hypot(q.x - p.x, q.y - p.y) < 85 &&
          a.runtime.queries.lineOfSight({ x: p.x, y: p.y, z: p.z + 1.5 },
            { x: q.x, y: q.y, z: q.z + 1.2 }, { ignore: [a.player.actor], target: enemy.actor });
      }).sort((a1, b1) => Math.hypot(a.crew.positionOf(a1).x - p.x, a.crew.positionOf(a1).y - p.y) -
        Math.hypot(a.crew.positionOf(b1).x - p.x, a.crew.positionOf(b1).y - p.y))
        .map(enemy => ({ id: enemy.id, position: a.crew.positionOf(enemy) }))[0] || null;
    }, [...ineffective.entries()].filter(([, count]) => count >= 2).map(([id]) => id));
    if (!target) return;
    if (state.inventory.weapons.pistol.magazine === 0 && state.inventory.weapons.pistol.reserve === 0) return;
    if (state.inventory.weapons.pistol.magazine === 0) { await padTap(1); await step(1.45); }
    await aimAt(target.position);
    await step(0.55, [0, 0, 0, 0], { 6: 1, 7: 1 });
    const after = await read(), beforeHealth = state.crew.find(enemy => enemy.id === target.id)?.health;
    const afterHealth = after.crew.find(enemy => enemy.id === target.id)?.health;
    ineffective.set(target.id, afterHealth === beforeHealth ? (ineffective.get(target.id) || 0) + 1 : 0);
  }
  throw new Error('Live controller pistol fire did not resolve the visible encounter within 32 bursts.');
}

try {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-action="continue"]').waitFor({ state: 'visible', timeout: 90000 });
  assert.equal((await read()).screen, 'title');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
  await step(0.05); await padTap(0); await page.locator('.hud').waitFor();
  assert.equal((await read()).phase, departureOnly ? 'EVASION' : 'APPROACH');
  assert.equal((await read()).runId, savedState.runId, 'Continue must restore the actual saved run.');
  assert.equal((await read()).inputDevice, 'gamepad');
  assert.equal((await read()).padMapping, 'standard');
  if (!departureOnly) {
  await note('01-continued-bea-checkpoint');

  await route([[143, 216], [143, 223]]); await interact();
  assert.equal((await read()).armor, 100, 'Normal market purchase must supply armor before depot combat.');
  await route([[143, 212], [70, 214], [70, 270], [94, 278], [94, 322], [98, 323.5]]);
  await interact(); await step(1.05);
  assert.equal((await read()).vehicleId, 'mara-sedan', 'Triangle must board the real sedan at Eli’s garage.');
  await note('02-sedan-boarded-at-garage');
  await driveRoute([[120, 332], [228, 332], [240, 320], [240, 214], [252, 202],
    [338, 202], [348, 191], [348, 147]], { speed: 5 });
  const parked = await read();
  assert.equal(parked.phase, 'APPROACH');
  assert.ok(Math.hypot(parked.sedan.position.x - savedState.vehicles['mara-sedan'].position.x,
    parked.sedan.position.y - savedState.vehicles['mara-sedan'].position.y) > 290,
  'The sedan must have physically travelled from the garage to the depot.');
  await note('03-sedan-driven-inside-depot');
  await interact(); await step(1.05);
  assert.equal((await read()).vehicleId, null, 'Triangle must give Mara a real sedan exit.');
  await route([[350, 155], [348, 165.5]]);
  await aimAt((await read()).crew.find(enemy => enemy.id === 'crew-guard-gate').position);
  await interact('RECOVERY'); await note('04-gate-committed');
  await fight(); await walk(348, 157.5); await fight();
  await route([[310, 142], [310, 112], [312, 104], [319, 104.5]]); await interact();
  await walk(333, 103); await fight(); await walk(333, 90.5); await fight();
  await walk(332, 88); await interact();
  assert.equal((await read()).junReached, true, 'Jun must be reached by a real Triangle interaction.');
  await walk(324, 84); await interact('EXTRACTION');
  assert.equal((await read()).caseRecovered, true);
  assert.equal((await read()).junExtracted, false);
  await note('05-case-recovered-with-sedan-parked');
  await route([[333, 89], [333, 104], [312, 104], [310, 112], [310, 142], [338, 142], [346, 146], [346.6, 148.2]], { sprint: false });
  for (let count = 0; count < 180; count++) {
    const state = await read(), gap = Math.hypot(state.jun.position.x - state.sedan.position.x,
      state.jun.position.y - state.sedan.position.y);
    if (count % 8 === 0) report.junTrail.push({ elapsed: state.elapsed, phase: state.phase,
      player: state.position, jun: state.jun.position, sedan: state.sedan.position, gap });
    assert.equal(state.phase, 'EXTRACTION', 'Jun must not complete an on-foot extraction before sedan boarding.');
    if (gap < 4.25) break;
    await step(0.2);
    if (count === 179) throw new Error(`Jun did not reach the parked sedan’s passenger door: ${JSON.stringify(state.jun)}`);
  }
  const beforeBoard = await read();
  assert.equal(beforeBoard.junExtracted, false);
  assert.equal(beforeBoard.sedan.seats[1], null);
  assert.ok(Math.hypot(beforeBoard.position.x - beforeBoard.sedan.position.x,
    beforeBoard.position.y - beforeBoard.sedan.position.y) < 3.2, 'Mara must reach the physical sedan interaction range.');
  await note('06-jun-ready-at-sedan');
  await interact();
  for (let count = 0; count < 80; count++) {
    const state = await read();
    if (state.jun.vehicleId === 'mara-sedan' && state.jun.seat === 'passenger' &&
      !state.transitions.some(transition => transition.actor === 'jun')) break;
    await step(0.1);
    if (count === 79) throw new Error(`Jun did not finish the real passenger entry: ${JSON.stringify(state)}`);
  }
  const boarded = await read();
  assert.equal(boarded.vehicleId, 'mara-sedan');
  assert.equal(boarded.jun.vehicleId, 'mara-sedan');
  assert.equal(boarded.jun.seat, 'passenger');
  assert.deepEqual(boarded.sedan.seats.slice(0, 2), ['mara', 'jun']);
  assert.equal(boarded.junExtracted, true);
  assert.equal(boarded.phase, 'EVASION', 'Live Jun passenger entry must advance extraction to evasion.');
  report.passengerEntry = { before: beforeBoard, after: boarded };
  await note('07-jun-boards-sedan-evasion');
  } else await note('07-resumed-jun-in-sedan');
  const boarded = await read();
  assert.equal(boarded.phase, 'EVASION');
  assert.equal(boarded.jun.vehicleId, 'mara-sedan');
  assert.equal(boarded.jun.seat, 'passenger');
  const departure = { ...boarded.sedan.position };
  if (probeOnly) {
    report.reverseProbe = [];
    for (let count = 0; count < 40; count++) {
      const state = await step(0.08, [0, 0, 0, 0], { 6: 0.9 });
      if (count % 4 === 0 || count === 39) report.reverseProbe.push({ count, sedan: state.sedan, patrol2: state.patrol2 });
    }
    report.status = 'calibration';
  } else {
  const escaped = await reverseOutOfDepot(boarded);
  assert.ok(escaped.sedan.position.y > 194, 'The sedan must physically leave the depot through the front gate.');
  assert.ok(Math.hypot(escaped.sedan.position.x - departure.x,
    escaped.sedan.position.y - departure.y) > 40, 'The sedan must carry Jun at least 40 metres from the parked position.');
  assert.equal(escaped.vehicleId, 'mara-sedan');
  assert.equal(escaped.jun.vehicleId, 'mara-sedan');
  assert.equal(escaped.jun.seat, 'passenger');
  assert.ok(['EVASION', 'DECISION'].includes(escaped.phase));
  report.departure = { from: departure, to: escaped.sedan.position, phase: escaped.phase,
    control: 'continuous analog L2 reverse, neutral steering' };
  await note('08-sedan-and-jun-outside-depot');
  report.externalInputs = await page.evaluate(() => window.__qaExternalInputs);
  assert.ok(Object.values(report.externalInputs).every(count => count === 0),
    'No trusted keyboard, mouse or touch gameplay/menu input entered this route.');
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
  }
} catch (error) {
  report.status = 'blocked'; report.blocker = error.message; report.lastState = await read().catch(() => null);
  await page.screenshot({ path: `${output}/blocker.png` }).catch(() => {});
  console.error(error.stack); process.exitCode = 1;
} finally {
  report.sourceHashesAtFinish = await hashes();
  report.sourceStable = JSON.stringify(report.sourceHashesAtFinish) === JSON.stringify(report.sourceHashes);
  if (report.status === 'passed' && !report.sourceStable) {
    report.status = 'blocked'; report.blocker = 'Source files changed during the sedan run.'; process.exitCode = 1;
  }
  report.finishedAt = new Date().toISOString();
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, output, blocker: report.blocker || null }));
  await context.close(); await browser.close();
}
