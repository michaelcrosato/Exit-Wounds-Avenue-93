/**
 * V04/V05/S08 browser integration diagnostics, NOT an acceptance playthrough.
 * Explicit fixture saves stage people, evidence, vehicles and failure conditions.
 * After setup, ordinary browser keys/mouse/menu actions drive the actual engine,
 * witnesses, LOS queries, police AI, seats, services and retry interfaces.
 * Existing Game.advance drives deterministic fixed time; no FPS/pacing claim.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, webkit, firefox } from 'playwright';
import { encodeSave, SAVE_KEY, SETTINGS_KEY } from '../../src/game/save.js';

const engine = process.env.EWA93_POLICE_ENGINE || 'chromium';
const origin = process.env.EWA93_BASE_URL || 'http://127.0.0.1:5173';
const output = process.env.EWA93_POLICE_OUTPUT || `/tmp/ewa93-police-${Date.now()}`;
const selected = process.env.EWA93_POLICE_CASE;
const records = [], errors = [];
let browser, context, page, baseline;
const heldKeys = new Set();

async function read() {
  return page.evaluate(() => {
    const a = window.__exitWounds.app, s = a.state, v = a.runtime.vehicles;
    return {
      screen: a.ui.screen, appError: a.error?.message, state: structuredClone(s),
      yaw: a.runtime.camera.yaw, safeSurrender: a.police.safeSurrender,
      prompt: document.querySelector('#hud-prompt')?.textContent,
      toast: document.querySelector('#hud-toast')?.textContent,
      roadblockSet: a.roadblockSet, assignedPatrols: [...a.policeDriverAssigned],
      officers: a.police.officers.map(o => {
        const p = a.police.position(o), q = a.player.position;
        const from = { ...p, z: p.z + 1.65 }, to = { ...q, z: q.z + 1.45 };
        const ray = a.runtime.queries.raycast(from, to, { ignore: [o.actor] });
        return { id: o.id, position: p, health: o.health, mode: o.mode,
          vehicle: v.occupant(o.actor)?.vehicle.id || null,
          range: Math.hypot(p.x - q.x, p.y - q.y),
          obstruction: ray ? { id: ray.entity?.id || ray.body?.userData?.id || null, point: ray.point } : null,
          lineOfSight: a.runtime.queries.lineOfSight(
            from, to,
            { ignore: [o.actor], targetId: s.player.vehicleId || 'mara' }) };
      }),
      vehicles: v.list.map(car => ({ id: car.id, position: car.position,
        health: car.health, disabled: car.disabled, appearance: car.appearance,
        rotation: car.body.rotation(), yaw: car.yaw, speed: car.speed / 16, siren: car.siren,
        navigation: car.id.startsWith('patrol-') ? (() => {
          const number = Number(car.id.split('-')[1]);
          const actual = a.patrolNavResults?.get(number);
          if (actual) return { mode: 'persistent', ...structuredClone(actual), cursor: structuredClone(a.patrolRouteCursors.get(number)) };
          const target = car.id === 'patrol-3' ? { x: 240, y: 202, z: 0 } : s.wanted.visible ? a.player.position : s.wanted.lastKnown || { x: 348, y: 124, z: 0 };
          const start = a.district.nearestNode('road', car.position), goal = a.district.nearestNode('road', target);
          const route = a.district.path('road', start?.id, goal?.id) || [];
          const waypoint = route.find(node => Math.hypot(node.x - car.position.x, node.y - car.position.y) > 8) || target;
          const desired = Math.atan2(waypoint.y - car.position.y, waypoint.x - car.position.x);
          return { mode: 'legacy-derived', target, start, goal, route, waypoint, desired, angle: Math.atan2(Math.sin(desired - car.yaw), Math.cos(desired - car.yaw)) };
        })() : null,
        controls: { ...car.controls }, seats: car.seats.map(actor => actor?.id || null) })),
      transitions: [...v.transitions].map(([actor, t]) => ({ actor: actor.id, kind: t.kind, vehicle: t.vehicle.id, time: t.time })),
      jun: { ...a.jun.snapshot(), stuckFor: a.jun.stuckFor },
    };
  });
}
async function advance(seconds = 1 / 120) {
  await page.evaluate(seconds => window.__exitWounds.runtime.game.advance(seconds), seconds);
  const s = await read();
  assert.notEqual(s.screen, 'error', s.appError || 'Runtime entered the error screen.');
  return s;
}
async function keys(next = []) {
  const wanted = new Set(next);
  for (const key of heldKeys) if (!wanted.has(key)) { await page.keyboard.up(key); heldKeys.delete(key); }
  for (const key of wanted) if (!heldKeys.has(key)) { await page.keyboard.down(key); heldKeys.add(key); }
}
async function press(key = 'KeyE', seconds = 1 / 60) {
  await keys([key]); await advance(seconds); await keys(); return advance(1 / 60);
}
async function chooseMenu(action) {
  await page.locator(`.screen [data-action="${action}"]`).waitFor();
  await page.locator('.screen [data-focused="true"]').waitFor();
  for (let i = 0; i < 20; i++) {
    const focused = await page.locator('.screen [data-focused="true"]').getAttribute('data-action');
    if (focused === action) { await page.keyboard.press('Enter'); return; }
    await page.keyboard.press('ArrowDown');
  }
  throw new Error(`Normal keyboard menu selection did not reach ${action}.`);
}
async function shoot() {
  await page.mouse.move(460, 280);
  await page.mouse.down({ button: 'left' }); await advance(1 / 60);
  await page.mouse.up({ button: 'left' }); return advance(1 / 60);
}
async function capture(name) {
  await page.evaluate(() => window.__exitWounds.runtime.game.advance(0, { draw: true }));
  const path = `${output}/${name}.png`;
  await page.screenshot({ path, timeout: 90000 }); return path;
}
async function walkTo(x, y, { radius = .8, sprint = true, onStep = null } = {}) {
  let previous = await read(), stuck = 0;
  for (let i = 0; i < 1000; i++) {
    const p = previous.state.player.position, dx = x - p.x, dy = y - p.y, distance = Math.hypot(dx, dy);
    if (distance <= radius) { await keys(); return advance(.12); }
    const c = Math.cos(previous.yaw), s = Math.sin(previous.yaw);
    const side = -s * dx + c * dy, forward = c * dx + s * dy;
    const next = [];
    if (Math.abs(side) > distance * .2) next.push(side > 0 ? 'KeyD' : 'KeyA');
    if (Math.abs(forward) > distance * .2) next.push(forward > 0 ? 'KeyW' : 'KeyS');
    if (sprint) next.push('ShiftLeft');
    await keys(next);
    const current = await advance(Math.min(.2, Math.max(.025, distance / (sprint ? 5.15 : 3.05) * .5)));
    assert.equal(current.screen, 'playing', `Walk interrupted: ${JSON.stringify(current.state.mission.failure)}`);
    if (onStep) onStep(current);
    const q = current.state.player.position;
    stuck = Math.hypot(q.x - p.x, q.y - p.y) < .015 ? stuck + 1 : 0;
    assert.ok(stuck < 45, `Physical route blocked to ${x},${y} at ${JSON.stringify(q)}`);
    previous = current;
  }
  throw new Error(`Walking did not converge on ${x},${y}.`);
}
function fixture(name, { phase = 'COLLECTION', position = { x: 240, y: 202, z: .05 } } = {}) {
  const s = structuredClone(baseline);
  s.runId = `police-integration-${name}`; s.tick = 1200; s.elapsed = 10;
  s.player.position = position; s.player.rotation = 0; s.player.vehicleId = null; s.player.seat = null;
  s.mission.phase = phase; s.mission.phaseEnteredTick = 1200;
  if(phase!=='INTRO')s.mission.eliCall={version:1,status:'superseded',remaining:0,nextLine:0,contacted:true,completed:false};
  s.mission.checkpointId = `police-fixture-${name}`; s.mission.pendingCheckpoint = false;
  s.mission.failure = null; s.mission.acknowledgedDialogue = ['intro'];
  // Observation tests isolate their witnesses by staging the other residents
  // and officers far away. Perception functions and query results stay live.
  for (let i = 1; i <= 6; i++) Object.assign(s.actors[`officer-${i}`], {
    position: { x: 65 + (i % 3) * 2, y: 60 + Math.floor(i / 3) * 2, z: .05 },
    health: 100, state: 'patrol', vehicleId: null, seat: null,
  });
  for (const resident of s.district.pedestrians.records) Object.assign(resident, {
    position: { x: 421 + Number(resident.id.split('-')[1]) % 6, y: 60 + Math.floor(Number(resident.id.split('-')[1]) / 6), z: .05 },
    state: 'wait', wait: 99999, fear: 0, danger: null, targetId: null,
  });
  s.district.pedestrians.pendingCrimes = [];
  if (['RECOVERY', 'EXTRACTION', 'EVASION'].includes(phase)) {
    s.mission.route = 'gate';
    // Failure fixtures choose separately whether live hostile fire is needed.
    for (const id of Object.keys(s.actors).filter(id => id.startsWith('crew-'))) {
      s.actors[id].health = 0; s.actors[id].state = 'down';
    }
    s.district.crewMeta = { alerted: false, sharedLastKnown: null };
  }
  if (['EXTRACTION', 'EVASION'].includes(phase)) {
    Object.assign(s.mission, { junReached: true, caseRecovered: true, junExtracted: phase === 'EVASION', alarmTriggered: true });
    s.player.inventory.case = true;
    Object.assign(s.actors.jun, { state: 'follow', position: { ...position, x: position.x + 2 }, lastSafe: { ...position, x: position.x + 2 } });
  }
  return s;
}
function heat(s, { tier = 1, position = s.player.position, known = true } = {}) {
  Object.assign(s.wanted, { tier, status: 'Searching', personId: known ? 'mara' : null,
    vehicleIds: [], lastKnown: { ...position }, radius: tier === 1 ? 60 : tier === 2 ? 100 : 140,
    visible: false, lastSeenTick: -1, unseenSeconds: 0, clearProgress: 0,
    reportsReceived: [`${s.runId}:fixture-report`], surrendered: false });
}
async function loadFixture(s) {
  await keys();
  const result = await page.evaluate(({ key, raw }) => {
    const a = window.__exitWounds.app;
    a.runtime.input.clear(); a.saveStore.clear({ confirmed: true });
    localStorage.setItem(key, raw); a.continueGame(); a.runtime.game.stop(); a.updateHUD();
    return { screen: a.ui.screen, runId: a.state.runId };
  }, { key: SAVE_KEY, raw: encodeSave(s, 123456789) });
  assert.deepEqual(result, { screen: 'playing', runId: s.runId });
  assert.equal((await read()).state.mission.failure, null);
}
async function saveReport() {
  await writeFile(`${output}/report.json`, JSON.stringify({ origin, output, engine,
    browserVersion: browser?.version(), seed: 93, fixtureBasedIntegration: true,
    acceleratedFixedSteps: true, acceptancePlaythrough: false, errors, records }, null, 2));
}
function scenario(name, fn) {
  if (selected && !new RegExp(selected).test(name)) return;
  test(`${engine}: ${name}`, { timeout: 600000 }, async () => {
    const record = { name, status: 'running', startedAt: new Date().toISOString(),
      fixtureBasedIntegration: true, observations: [] };
    records.push(record); const errorStart = errors.length;
    try { await fn(record); assert.deepEqual(errors.slice(errorStart), []); record.status = 'passed'; }
    catch (error) {
      record.status = 'failed'; record.failure = error.message;
      record.final = await read().catch(() => null);
      record.capture = await capture(`failure-${records.length}`).catch(() => null);
      throw error;
    } finally { await keys().catch(() => {}); record.finishedAt = new Date().toISOString(); await saveReport(); }
  });
}

before(async () => {
  await mkdir(output, { recursive: true });
  const type = { chromium, webkit, firefox }[engine]; assert.ok(type, `Unknown engine ${engine}`);
  browser = await type.launch({ headless: true, args: engine === 'chromium' ? ['--enable-unsafe-swiftshader'] : [] });
  context = await browser.newContext({ viewport: { width: 960, height: 600 }, reducedMotion: 'reduce' });
  await context.addInitScript(({ key }) => {
    localStorage.setItem(key, JSON.stringify({ version: 1, settings: { quality: 'low', masterVolume: 0 } }));
  }, { key: SETTINGS_KEY });
  page = await context.newPage(); page.setDefaultTimeout(90000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.locator('.screen--title [data-action="newGame"]').waitFor();
  await page.evaluate(() => window.__exitWounds.runtime.game.stop());
  await page.locator('[data-action="newGame"]').click(); await page.locator('.hud').waitFor();
  baseline = await page.evaluate(() => structuredClone(window.__exitWounds.state));
  assert.deepEqual(errors, []);
});
after(async () => { await saveReport(); await browser?.close(); console.log(`Police/failure integration evidence: ${output}`); });

// This goes first because entry animation used to replace recognizable Mara
// with an unknown car before VehicleEntered could link a continuously seen switch.
scenario('continuously seen versus unseen E vehicle entry', async record => {
  for (const seen of [true, false]) {
    const s = fixture(`switch-${seen}`, { position: { x: 395.5, y: 369, z: .05 } });
    heat(s, { position: seen ? s.player.position : { x: 240, y: 202, z: .05 } });
    s.wanted.vehicleIds = ['mara-sedan'];
    if (seen) s.actors['officer-2'].position = { x: 402, y: 369, z: .05 };
    await loadFixture(s); await advance(.05);
    const before = await read(); assert.equal(before.state.wanted.visible, seen);
    assert.equal(before.prompt?.includes('sedan'), true, `Expected nearby alternate sedan, got ${before.prompt}`);
    record.observations.push({ seen, at: 'before-entry', state: before });
    await keys(['KeyE']); await advance(1 / 60); await keys();
    for (let i = 0; i < 12; i++) record.observations.push({ seen, at: `entry-${i}`, state: await advance(.1) });
    const after = await read();
    assert.equal(after.state.player.vehicleId, 'waterfront-sedan');
    if (seen) {
      const trace = record.observations.filter(o => o.seen && o.at.startsWith('entry-'));
      assert.equal(trace[0].state.officers.find(p => p.id === 'officer-2').lineOfSight, true, 'The officer must genuinely see Mara entering the new car.');
      assert.equal(after.officers.find(p => p.id === 'officer-2').lineOfSight, true, 'The officer must genuinely see the occupied car after entry.');
      assert.ok(after.state.wanted.vehicleIds.includes('waterfront-sedan'), 'A continuously observed vehicle entry must identify the new car.');
      assert.equal(after.state.wanted.visible, true);
    } else {
      assert.equal(after.state.wanted.vehicleIds.includes('waterfront-sedan'), false);
      assert.equal(after.state.wanted.personId, 'mara', 'An unseen switch must retain existing person evidence.');
      const cleared = await advance(8.1);
      assert.equal(cleared.state.wanted.tier, 0, 'The unseen new car outside the staged search region must allow clearance.');
      assert.equal(cleared.state.wanted.status, 'Cleared');
      record.observations.push({ seen, at: 'after-clearance', state: cleared });
    }
    record.observations.push({ seen, at: 'after-entry', state: after });
    record[`capture-${seen}`] = await capture(`vehicle-switch-${seen ? 'seen' : 'unseen'}`);
  }
});

scenario('hidden gunfire produces no omniscient report', async record => {
  const s = fixture('hidden', { position: { x: 380, y: 355, z: .05 } });
  await loadFixture(s); await shoot(); const after = await advance(5);
  assert.equal(after.state.player.inventory.weapons.pistol.magazine, 11);
  assert.equal(after.state.crime.incidents.filter(c => c.kind === 'gunfire').length, 1);
  assert.deepEqual(after.state.crime.reports, []); assert.equal(after.state.wanted.tier, 0);
  record.observations.push(after); record.capture = await capture('hidden-gunfire');
});

scenario('civilian gunfire call is delayed and identifies only observed information', async record => {
  const s = fixture('reported'); s.district.pedestrians.records[0].position = { x: 235, y: 202, z: .05 };
  await loadFixture(s); await shoot(); const reporting = await advance(.9);
  assert.equal(reporting.state.wanted.tier, 0); assert.equal(reporting.state.wanted.status, 'Reporting');
  const report = reporting.state.crime.reports.find(r => r.witnessKind === 'civilian');
  assert.ok(report); assert.equal(report.status, 'Reporting'); assert.equal(report.observedPersonId, 'mara');
  assert.equal(report.observedVehicleId, null);
  const dispatched = await advance(2.9);
  assert.equal(dispatched.state.wanted.tier, 2); assert.equal(dispatched.state.wanted.personId, 'mara');
  assert.deepEqual(dispatched.state.wanted.vehicleIds, []);
  assert.ok(dispatched.state.crime.reports.some(r => r.status === 'Dispatched'));
  record.observations.push({ reporting, dispatched }); record.capture = await capture('civilian-report');
});

scenario('leaving a witness before identification prevents the civilian call', async record => {
  const s = fixture('witness-lost'); s.district.pedestrians.records[0].position = { x: 282, y: 202, z: .05 };
  await loadFixture(s); const fired = await shoot();
  assert.equal(fired.state.crime.incidents.filter(c => c.kind === 'gunfire').length, 1);
  await walkTo(230, 202); const escaped = await advance(5);
  assert.deepEqual(escaped.state.crime.reports, []); assert.equal(escaped.state.wanted.tier, 0);
  record.observations.push({ fired, escaped }); record.capture = await capture('witness-identification-interrupted');
});

scenario('gunfire in actual police view dispatches immediately', async record => {
  const s = fixture('direct'); s.actors['officer-2'].position = { x: 246, y: 202, z: .05 };
  await loadFixture(s); const after = await shoot();
  const report = after.state.crime.reports.find(r => r.witnessKind === 'police');
  assert.ok(report); assert.equal(report.delay, 0); assert.equal(report.status, 'Dispatched');
  assert.equal(after.state.wanted.tier, 2); assert.equal(after.state.wanted.personId, 'mara');
  assert.equal(after.state.wanted.visible, true); assert.equal(after.state.wanted.status, 'Pursuing');
  record.observations.push(after); record.capture = await capture('direct-police-view');
});

scenario('actual cabinet alarm supplies depot location without person or car', async record => {
  const s = fixture('alarm', { phase: 'RECOVERY', position: { x: 324, y: 84, z: .05 } });
  s.mission.junReached = true; s.actors.jun.state = 'follow';
  await loadFixture(s); await advance(.05); const after = await press();
  assert.equal(after.state.mission.phase, 'EXTRACTION'); assert.equal(after.state.player.inventory.case, true);
  assert.equal(after.state.wanted.tier, 2); assert.equal(after.state.wanted.personId, null);
  assert.deepEqual(after.state.wanted.vehicleIds, []); assert.deepEqual(after.state.wanted.lastKnown, { x: 348, y: 124, z: 0 });
  assert.ok(after.state.crime.reports.some(r => r.witnessKind === 'remote' && r.status === 'Dispatched'));
  record.observations.push(after); record.capture = await capture('cabinet-remote-alarm');
});

scenario('geographical search reentry resets clearance then an unseen escape clears', async record => {
  const s = fixture('search-reentry', { position: { x: 305, y: 202, z: .05 } });
  heat(s, { position: { x: 240, y: 202, z: .05 } });
  await loadFixture(s); const outside = await advance(3);
  assert.ok(outside.state.wanted.clearProgress > 2.9);
  await walkTo(280, 202); const reentered = await advance(2);
  assert.equal(reentered.state.wanted.visible, false); assert.equal(reentered.state.wanted.tier, 1);
  assert.equal(reentered.state.wanted.clearProgress, 0);
  await walkTo(320, 202); const cleared = await advance(8.1);
  assert.equal(cleared.state.wanted.tier, 0); assert.equal(cleared.state.wanted.status, 'Cleared');
  assert.equal(cleared.state.wanted.personId, null); assert.deepEqual(cleared.state.wanted.vehicleIds, []);
  record.observations.push({ outside, reentered, cleared }); record.capture = await capture('search-cleared');
});

scenario('real pursuit loses sight after sprinting beyond officer view', async record => {
  const s = fixture('sight-loss', { position: { x: 250, y: 202, z: .05 } });
  heat(s); s.actors['officer-2'].position = { x: 238, y: 202, z: .05 };
  await loadFixture(s); const pursuing = await advance(.05); assert.equal(pursuing.state.wanted.visible, true);
  let sightLost = false, updatedLocation = false, samples = 0;
  const sample = current => {
    if (samples++ % 5 === 0 || current.state.wanted.visible !== !sightLost) record.observations.push({ tick: current.state.tick, wanted: current.state.wanted, position: current.state.player.position, officers: current.officers });
    if (current.state.wanted.visible && current.state.wanted.lastKnown && Math.hypot(current.state.wanted.lastKnown.x - pursuing.state.wanted.lastKnown.x, current.state.wanted.lastKnown.y - pursuing.state.wanted.lastKnown.y) > 3) updatedLocation = true;
    if (!current.state.wanted.visible) sightLost = true;
  };
  await walkTo(250, 212, { onStep: sample });
  await walkTo(425, 212, { onStep: sample });
  if (!sightLost) await walkTo(425, 350, { onStep: sample });
  assert.equal(sightLost, true, 'Actual police perception must release sight after distance or an obstruction.');
  assert.equal(updatedLocation, true, 'Police sightings must update the real last-known location while Mara moves.');
  const after = await read(); assert.equal(after.state.mission.failure, null);
  record.observations.push({ pursuing, after }); record.capture = await capture('real-sight-loss');
});

scenario('walking around garage geometry restores sight and updates the search center', async record => {
  const s = fixture('sight-regained', { position: { x: 120, y: 305, z: .7 } });
  heat(s, { position: { x: 91, y: 311, z: .05 } });
  s.actors['officer-2'].position = { x: 106, y: 307, z: .05 };
  await loadFixture(s); const hidden = await advance(.05);
  assert.equal(hidden.state.wanted.visible, false);
  assert.equal(hidden.officers.find(o => o.id === 'officer-2').lineOfSight, false);
  let regained = null;
  const observe = current => { if (!regained && current.state.wanted.visible) regained = current; };
  await walkTo(120, 322, { onStep: observe }); await walkTo(94, 322, { onStep: observe });
  assert.ok(regained, 'Passing the real garage corner/door opening must permit a renewed officer sighting.');
  assert.equal(regained.state.wanted.status, 'Pursuing'); assert.equal(regained.state.wanted.clearProgress, 0);
  const p = regained.state.player.position, last = regained.state.wanted.lastKnown;
  assert.ok(Math.hypot(p.x - last.x, p.y - last.y) < .1);
  assert.ok(Math.hypot(last.x - 91, last.y - 311) > 3);
  record.observations.push({ hidden, regained, after: await read() }); record.capture = await capture('sight-regained-at-garage');
});

scenario('observed known vehicle cannot clear after the tier1 clearance interval', async record => {
  const s = fixture('observed-no-clear', { position: { x: 240, y: 202, z: .6 } });
  heat(s); s.wanted.vehicleIds = ['mara-sedan'];
  s.actors['officer-2'].position = { x: 250, y: 202, z: .05 };
  Object.assign(s.vehicles['mara-sedan'], { position: { ...s.player.position }, rotation: 0,
    seats: { driver: 'mara', passenger: null, rearLeft: null, rearRight: null } });
  Object.assign(s.player, { vehicleId: 'mara-sedan', seat: 'driver' });
  await loadFixture(s);
  for (let i = 0; i < 20; i++) {
    const current = await advance(.5);
    assert.equal(current.screen, 'playing'); assert.equal(current.state.wanted.visible, true);
    assert.equal(current.state.wanted.tier, 1); assert.equal(current.state.wanted.clearProgress, 0);
    if (i % 4 === 0) record.observations.push(current);
  }
  record.capture = await capture('observed-vehicle-still-wanted');
});

scenario('garage rejects a seen car and consumes an unseen repair favor once', async record => {
  for (const seen of [true, false]) {
    const s = fixture(`garage-${seen}`, { position: { x: 94, y: 305, z: .05 } });
    heat(s); s.wanted.vehicleIds = ['mara-sedan']; s.mission.favor = 'earned';
    Object.assign(s.vehicles['mara-sedan'], { position: { x: 94, y: 310, z: .6 }, health: 31, appearance: 0 });
    if (seen) s.actors['officer-2'].position = { x: 94, y: 312, z: .05 };
    await loadFixture(s); const before = await advance(.05); assert.equal(before.state.wanted.visible, seen);
    const after = await press(); record.observations.push({ seen, before, after });
    if (seen) {
      assert.equal(after.state.mission.favor, 'earned'); assert.equal(after.state.vehicles['mara-sedan'].health, 31);
      assert.equal(after.state.vehicles['mara-sedan'].appearance, 0);
      assert.ok(after.toast?.includes('Lose sight'), after.toast);
    } else {
      assert.equal(after.state.mission.favor, 'consumed'); assert.equal(after.state.vehicles['mara-sedan'].health, 100);
      assert.equal(after.state.vehicles['mara-sedan'].appearance, 1);
      assert.equal(after.state.wanted.vehicleIds.includes('mara-sedan'), false);
      assert.equal(after.state.wanted.personId, 'mara'); assert.equal(after.state.player.wallet, s.player.wallet);
      assert.equal(after.state.economy.transactions.length, 1);
    }
    record[`capture-${seen}`] = await capture(`garage-${seen ? 'seen-rejected' : 'unseen-resprayed'}`);
  }
});

scenario('tier1 deliberate surrender and automatic arrest offer checkpoint retry', async record => {
  for (const surrender of [true, false]) {
    const s = fixture(`arrest-${surrender}`); heat(s);
    s.actors['officer-2'].position = { x: 243, y: 202, z: .05 };
    await loadFixture(s);
    if (surrender) {
      await page.keyboard.down('Tab'); await advance(1 / 60);
      await page.keyboard.up('Tab');
      await advance(1 / 60); assert.equal((await read()).state.player.inventory.equipped, 'unarmed');
      assert.equal((await read()).safeSurrender, true);
      await keys(['KeyE']); await advance(1.05); await keys();
    } else await advance(1.5);
    const arrested = await read(); assert.equal(arrested.screen, 'retry');
    assert.ok(arrested.state.mission.failure.reason.includes('Arrested'));
    assert.equal(arrested.state.wanted.surrendered, surrender);
    record[`capture-${surrender}`] = await capture(`tier1-${surrender ? 'surrender' : 'arrest'}`);
    await chooseMenu('retryCheckpoint');
    const retried = await read(); assert.equal(retried.screen, 'playing');
    assert.equal(retried.state.mission.failure, null); assert.equal(retried.state.wanted.tier, 1);
    assert.equal(retried.state.mission.checkpointId, s.mission.checkpointId);
    record.observations.push({ surrender, arrested, retried });
  }
});

scenario('tier3 activates three physical patrols and places the junction roadblock', async record => {
  const s = fixture('tier3', { position: { x: 380, y: 355, z: .05 } });
  heat(s, { tier: 3, position: { x: 380, y: 355, z: .05 }, known: false });
  // Place each crew at its own actual cruiser so the fixture does not rely on
  // an initial foot hike before entry. The roadblock still drives from Quay.
  for (let i = 1; i <= 3; i++) {
    const p = s.vehicles[`patrol-${i}`].position;
    s.actors[`officer-${i * 2 - 1}`].position = { x: p.x + 1, y: p.y, z: .05 };
  }
  await loadFixture(s); const initial = await read(); let after;
  for (let i = 0; i < 120; i++) {
    after = await advance(.5);
    if (i % 8 === 0) record.observations.push({ time: after.state.elapsed, roadblockSet: after.roadblockSet, vehicles: after.vehicles.filter(v => v.id.startsWith('patrol-')), officers: after.officers });
    assert.equal(after.screen, 'playing'); assert.equal(after.state.wanted.tier, 3);
    if (after.roadblockSet) break;
  }
  const patrols = after.vehicles.filter(v => v.id.startsWith('patrol-'));
  assert.deepEqual(patrols.map(v => v.siren), [true, true, true]);
  assert.deepEqual(after.assignedPatrols.sort(), [1, 2, 3]);
  for (const car of patrols) {
    const before = initial.vehicles.find(v => v.id === car.id);
    assert.ok(Math.hypot(car.position.x - before.position.x, car.position.y - before.position.y) > 5, `${car.id} must physically drive, rather than only illuminate its siren.`);
  }
  assert.equal(after.roadblockSet, true, 'Third cruiser must reach the junction and form a real roadblock.');
  const block = patrols.find(v => v.id === 'patrol-3');
  assert.ok(Math.hypot(block.position.x - 240, block.position.y - 202) < 7);
  record.observations.push({ initial, after }); record.capture = await capture('tier3-roadblock');
});

scenario('inactive parked patrols stay stationary under their AI brake command', async record => {
  const s = fixture('parked-patrols', { position: { x: 380, y: 355, z: .05 } });
  await loadFixture(s); const initial = await read(); const after = await advance(4);
  record.observations.push({ initial });
  for (const car of after.vehicles.filter(v => v.id.startsWith('patrol-'))) {
    const start = initial.vehicles.find(v => v.id === car.id);
    const displacement = Math.hypot(car.position.x - start.position.x, car.position.y - start.position.y);
    record.observations.push({ id: car.id, initial: start, after: car, displacement });
    assert.equal(car.siren, false); assert.ok(displacement < .75, `${car.id} moved ${displacement.toFixed(2)} m under a parking command.`);
    assert.ok(Math.abs(car.speed) < .25, `${car.id} has parking speed ${car.speed.toFixed(2)} m/s.`);
  }
  record.capture = await capture('inactive-patrols-parked');
});

scenario('abandoned and destroyed escape cars leave Mara and Jun another vehicle', async record => {
  for (const destroyed of [false, true]) {
    const s = fixture(`car-loss-${destroyed}`, { phase: 'EVASION', position: { x: 330, y: 332, z: .6 } });
    heat(s, { tier: 2, position: { x: 348, y: 124, z: 0 }, known: false });
    Object.assign(s.vehicles['mara-sedan'], { position: { x: 330, y: 332, z: .6 }, health: destroyed ? 0 : 100,
      disabled: destroyed, rotation: 0, seats: { driver: 'mara', passenger: 'jun', rearLeft: null, rearRight: null } });
    Object.assign(s.vehicles['waterfront-sedan'], { position: { x: 340, y: 332, z: .6 }, rotation: 0 });
    Object.assign(s.player, { vehicleId: 'mara-sedan', seat: 'driver' });
    Object.assign(s.actors.jun, { vehicleId: 'mara-sedan', seat: 'passenger', state: 'seated', position: { ...s.player.position } });
    await loadFixture(s); await advance(1.1); await press(); await advance(2);
    let exited = await read(); assert.equal(exited.state.player.vehicleId, null); assert.equal(exited.state.actors.jun.vehicleId, null);
    assert.equal(exited.state.mission.failure, null);
    await walkTo(340, 329.7, { sprint: false }); await advance(1);
    await press(); const entered = await advance(2);
    assert.equal(entered.state.player.vehicleId, 'waterfront-sedan');
    assert.equal(entered.state.actors.jun.vehicleId, 'waterfront-sedan');
    assert.equal(entered.state.vehicles['waterfront-sedan'].seats.passenger, 'jun');
    assert.equal(entered.state.mission.failure, null);
    record.observations.push({ destroyed, exited, entered });
    record[`capture-${destroyed}`] = await capture(`car-${destroyed ? 'destroyed' : 'abandoned'}-recovery`);
  }
});

scenario('offscreen companion boundary recovery and unrecoverable fall have explicit outcomes', async record => {
  const s = fixture('jun-boundary', { phase: 'EVASION', position: { x: 91, y: 311, z: .05 } });
  s.actors.jun.position = { x: 480, y: 380, z: .05 };
  await loadFixture(s); const recovered = await advance(.05);
  assert.equal(recovered.jun.recoveryAttempts, 1); assert.equal(recovered.state.mission.failure, null);
  assert.ok(recovered.jun.position.x >= 22 && recovered.jun.position.x <= 456);
  assert.ok(recovered.jun.position.y >= 24 && recovered.jun.position.y <= 396);
  assert.equal(recovered.jun.mode, 'follow');
  record.captureRecovered = await capture('jun-offscreen-recovered');
  const fall = fixture('jun-fall', { phase: 'EVASION' }); fall.actors.jun.position = { x: 333, y: 103, z: -4 };
  await loadFixture(fall); const failed = await advance(.05);
  assert.equal(failed.screen, 'retry'); assert.ok(failed.state.mission.failure.reason.includes('Jun'));
  record.captureRetry = await capture('jun-unrecoverable-retry');
  await chooseMenu('retryCheckpoint');
  assert.equal((await read()).screen, 'playing');
  record.observations.push({ recovered, failed, retried: await read() });
});

scenario('staged overturned occupied car permits a valid physical exit or explicit retry', async record => {
  const s = fixture('overturned', { phase: 'EVASION', position: { x: 330, y: 332, z: .9 } });
  Object.assign(s.vehicles['mara-sedan'], { position: { ...s.player.position }, rotation: 0,
    seats: { driver: 'mara', passenger: 'jun', rearLeft: null, rearRight: null } });
  Object.assign(s.player, { vehicleId: 'mara-sedan', seat: 'driver' });
  Object.assign(s.actors.jun, { vehicleId: 'mara-sedan', seat: 'passenger', state: 'seated', position: { ...s.player.position } });
  await loadFixture(s);
  // The roll is the only additional fixture operation. The subsequent settling,
  // door-clearance query, exit animations and companion behavior stay live.
  await page.evaluate(() => {
    const v = window.__exitWounds.runtime.vehicles.get('mara-sedan');
    v.body.setRotation({ x: 1, y: 0, z: 0, w: 0 }, true);
    v.body.setLinvel({ x: 0, y: 0, z: 0 }, true); v.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    window.__exitWounds.runtime.vehicles.postStep(0);
  });
  const rolled = await advance(.1); await press(); let after = await advance(2);
  if (after.screen === 'retry') assert.ok(after.state.mission.failure.reason);
  else {
    assert.equal(after.screen, 'playing'); assert.equal(after.state.player.vehicleId, null);
    assert.equal(after.state.actors.jun.vehicleId, null); assert.equal(after.state.mission.failure, null);
    const valid = await page.evaluate(() => {
      const a = window.__exitWounds.app;
      return [a.player.actor, a.jun.actor].every(actor => a.runtime.queries.capsuleClear(
        { x: actor.x, y: actor.y, z: actor.z }, actor.r, actor.half, { ignore: [actor] }));
    });
    assert.equal(valid, true, 'Both actors must finish their real exit in clear physical space.');
  }
  record.observations.push({ rolled, after }); record.capture = await capture('overturned-car-outcome');
});

scenario('live crew fire causes death and restores the current combat-stage checkpoint', async record => {
  for (const phase of ['RECOVERY', 'EXTRACTION', 'EVASION']) {
    const s = fixture(`death-${phase.toLowerCase()}`, { phase, position: { x: 348, y: 158, z: .05 } });
    s.player.health = 1; s.player.armor = 0;
    Object.assign(s.actors['crew-guard-gate'], { position: { x: 339, y: 150, z: .05 }, health: 65, state: 'alert', lastKnown: { ...s.player.position } });
    s.district.crewMeta = { alerted: true, sharedLastKnown: { ...s.player.position } };
    await loadFixture(s); let died;
    for (let i = 0; i < 24; i++) { died = await advance(.5); if (died.screen === 'retry') break; }
    assert.equal(died.screen, 'retry', `${phase}: actual hostile shots must resolve a lethal hit.`);
    assert.equal(died.state.player.health, 0); assert.ok(died.state.mission.failure);
    record[`capture-${phase}`] = await capture(`death-${phase.toLowerCase()}-retry`);
    await chooseMenu('retryCheckpoint'); const retried = await read();
    assert.equal(retried.screen, 'playing'); assert.equal(retried.state.mission.phase, phase);
    assert.equal(retried.state.mission.failure, null); assert.equal(retried.state.player.health, 1);
    assert.equal(retried.state.mission.checkpointId, s.mission.checkpointId);
    assert.equal(retried.state.player.inventory.case, phase !== 'RECOVERY');
    record.observations.push({ phase, died, retried });
  }
});
