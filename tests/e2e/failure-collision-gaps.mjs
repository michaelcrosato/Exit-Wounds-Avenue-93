/**
 * Focused V04/V07 source-build diagnostics. Setup stages a car, test obstacles,
 * or a validated APPROACH save; outcomes use the actual Rapier world and normal
 * keyboard controls. This is fixture-based integration, not an ordinary route.
 * Do not run concurrently with another gameplay browser on software rendering.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit, firefox } from 'playwright';
import { encodeSave, SAVE_KEY, SETTINGS_KEY } from '../../src/game/save.js';

const engine = process.env.EWA93_GAPS_ENGINE || 'chromium';
const cdpURL = process.env.EWA93_GAPS_CDP_URL;
const origin = process.env.EWA93_BASE_URL || 'http://127.0.0.1:5173';
const output = process.env.EWA93_GAPS_OUTPUT || `/tmp/ewa93-failure-collision-${Date.now()}`;
const selected = process.env.EWA93_GAPS_CASE;
const rollProfile = process.env.EWA93_GAPS_ROLL_PROFILE || 'side-high';
const records = [], errors = [], networkErrors = [], heldKeys = new Set();
let browser, context, page, baseline, sourceAtStart = null, sourceAtEnd = null;
const repoRoot=fileURLToPath(new URL('../../',import.meta.url));

async function sourceFingerprint() {
  async function walk(dir) {
    const result = [];
    for (const entry of await readdir(join(repoRoot,dir), { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) result.push(...await walk(path));
      else if (entry.isFile()) result.push(path);
    }
    return result;
  }
  const paths = [...await walk('src'), ...await walk('assets'), 'index.html',
    'vendor/my-3d2dge/engine/my-3d2dge.js',
    'vendor/my-3d2dge/engine/my-3d2dge-3d.js',
    'vendor/my-3d2dge/vendor/rapier3d-simd-compat-0.19.3/rapier.js',
    'vendor/my-3d2dge/vendor/three-0.182.0/three.webgpu.min.js',
    'tests/e2e/failure-collision-gaps.mjs'];
  const hash = createHash('sha256');
  for (const path of paths.sort()) { hash.update(path); hash.update(await readFile(join(repoRoot,path))); }
  return hash.digest('hex');
}

async function read() {
  return page.evaluate(() => {
    const a = window.__exitWounds.app, v = a.runtime.vehicles.get('mara-sedan');
    const q = v.body.rotation(), upZ = 1 - 2 * (q.x * q.x + q.y * q.y);
    return {
      screen: a.ui.screen, error: a.error?.message || null,
      tick: a.state.tick, phase: a.state.mission.phase,
      checkpoint: a.state.mission.checkpointId,
      missionFailure: a.state.mission.failure,
      missionRoute: a.state.mission.route,
      player: a.player.position, playerVehicle: a.state.player.vehicleId,
      playerBodyEnabled: !!a.player.actor.body?.isEnabled(),
      prompt: document.querySelector('#hud-prompt')?.textContent || '',
      toast: document.querySelector('#hud-toast')?.textContent || '',
      car: { position: v.position, speed: v.speed / 16, health: v.health,
        disabled: v.disabled, q: { ...q }, upZ, seats: v.seats.map(actor => actor?.id || null) },
    };
  });
}
async function advance(seconds = 1 / 120) {
  await page.evaluate(seconds => window.__exitWounds.runtime.game.advance(seconds), seconds);
  const state = await read();
  assert.notEqual(state.screen, 'error', state.error || 'Runtime entered error screen.');
  return state;
}
async function keys(next = []) {
  const wanted = new Set(next);
  for (const key of heldKeys) if (!wanted.has(key)) { await page.keyboard.up(key); heldKeys.delete(key); }
  for (const key of wanted) if (!heldKeys.has(key)) { await page.keyboard.down(key); heldKeys.add(key); }
}
async function press(key = 'KeyE') {
  await keys([key]); const result = await advance(1 / 60);
  await keys(); await advance(1 / 60); return result;
}
async function capture(name) {
  await page.evaluate(() => window.__exitWounds.runtime.game.advance(0, { draw: true }));
  const path = `${output}/${name}.png`;
  await page.screenshot({ path, timeout: 90000 }); return path;
}
async function writeReport() {
  await writeFile(`${output}/report.json`, JSON.stringify({
    kind: 'V04/V07 fixture-based physical diagnostic', origin, output, engine,
    browserVersion: browser?.version(), acceptancePlaythrough: false,
    acceleratedFixedSteps: true, sourceBuildRequired: true,
    sourceAtStart, sourceAtEnd, sourceStable: sourceAtEnd ? sourceAtStart === sourceAtEnd : null,
    rollProfile, errors, networkErrors, records,
  }, null, 2));
}
function scenario(name, fn) {
  if (selected && !new RegExp(selected).test(name)) return;
  test(`${engine}: ${name}`, { timeout: 900000 }, async () => {
    const record = { name, status: 'running', startedAt: new Date().toISOString(),
      fixtureBasedIntegration: true, observations: [], captures: [] };
    records.push(record);
    const errorStart = errors.length, networkStart = networkErrors.length;
    try {
      await fn(record);
      assert.deepEqual(errors.slice(errorStart), [], 'No browser or application errors.');
      assert.deepEqual(networkErrors.slice(networkStart), [], 'No failed runtime requests.');
      record.status = 'passed';
    } catch (error) {
      record.status = 'failed'; record.failure = error.stack || error.message;
      record.final = await read().catch(() => null);
      record.captures.push(await capture(`failure-${records.length}`).catch(() => null));
      throw error;
    } finally {
      await keys().catch(() => {});
      await page.evaluate(() => {
        const world = window.__exitWounds?.runtime?.world;
        if (world && window.__ewaGapLift) {
          world.pw.removeRigidBody(window.__ewaGapLift.body);
          delete window.__ewaGapLift;
        }
        for (const prop of [...(world?.props || [])].filter(p => p.data?.ewa93GapFixture)) world.remove(prop);
      }).catch(() => {});
      record.finishedAt = new Date().toISOString(); await writeReport();
    }
  });
}

async function stageOccupiedCar() {
  const result = await page.evaluate(() => {
    const a = window.__exitWounds.app, U = 16, v = a.runtime.vehicles.get('mara-sedan');
    a.newGame(); a.runtime.game.stop();
    v.body.setTranslation({ x: 330 * U, y: 332 * U, z: .8 * U }, true);
    v.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true); // Initial fixture heading only.
    v.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    v.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    a.runtime.vehicles.postStep(0);
    a.player.place({ x: 328.5, y: 332, z: .05 });
    a.runtime.camera.reset(a.player.actor, 0);
    const entry = a.runtime.vehicles.enter(a.player.actor, v.id, 'driver');
    a.runtime.game.advance(1.2);
    return { entry: entry.ok, vehicle: a.state.player.vehicleId, position: v.position,
      orientation: { ...v.body.rotation() }, checkpoint: a.state.mission.checkpointId };
  });
  assert.equal(result.entry, true, JSON.stringify(result));
  assert.equal(result.vehicle, 'mara-sedan');
  assert.equal(result.checkpoint, 'new-run', 'A safe on-foot retry point must predate fixture staging.');
  return result;
}
async function walkTo(x, y, radius = .8) {
  let previous = await read(), stalled = 0;
  for (let i = 0; i < 900; i++) {
    const p = previous.player, dx = x - p.x, dy = y - p.y, gap = Math.hypot(dx, dy);
    if (gap <= radius) { await keys(); return advance(.08); }
    const yaw = await page.evaluate(() => window.__exitWounds.runtime.camera.yaw);
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const side = -s * dx + c * dy, forward = c * dx + s * dy;
    const next = ['ShiftLeft'];
    if (Math.abs(side) > gap * .2) next.push(side > 0 ? 'KeyD' : 'KeyA');
    if (Math.abs(forward) > gap * .2) next.push(forward > 0 ? 'KeyW' : 'KeyS');
    await keys(next);
    const now = await advance(Math.min(.18, Math.max(.025, gap / 5.15 * .48)));
    assert.equal(now.screen, 'playing', `Physical walk interrupted: ${JSON.stringify(now.missionFailure)}`);
    stalled = Math.hypot(now.player.x - p.x, now.player.y - p.y) < .015 ? stalled + 1 : 0;
    assert.ok(stalled < 45, `Physical route stopped at ${JSON.stringify(now.player)} toward ${x},${y}.`);
    previous = now;
  }
  throw new Error(`Physical walk did not converge on ${x},${y}.`);
}

before(async () => {
  await mkdir(output, { recursive: true });
  sourceAtStart = await sourceFingerprint();
  const type = { chromium, webkit, firefox }[engine];
  assert.ok(type, `Unknown browser engine: ${engine}`);
  assert.ok(!cdpURL||engine==='chromium','CDP attach requires Chromium.');
  browser = cdpURL?await chromium.connectOverCDP(cdpURL):await type.launch({ headless: true,
    args: engine === 'chromium' ? ['--enable-unsafe-swiftshader'] : [] });
  context = await browser.newContext({ viewport: { width: 960, height: 600 }, reducedMotion: 'reduce' });
  await context.addInitScript(({ key }) => {
    localStorage.setItem(key, JSON.stringify({ version: 1,
      settings: { quality: 'low', masterVolume: 0 } }));
  }, { key: SETTINGS_KEY });
  page = await context.newPage(); page.setDefaultTimeout(90000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => networkErrors.push({ url: request.url(), reason: request.failure()?.errorText }));
  page.on('response', response => { if (response.status() >= 400) networkErrors.push({ url: response.url(), status: response.status() }); });
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.locator('.screen--title [data-action="newGame"]').waitFor();
  await page.locator('[data-action="newGame"]').click();
  await page.locator('.hud').waitFor();
  await page.evaluate(() => window.__exitWounds.runtime.game.stop());
  baseline = await page.evaluate(() => structuredClone(window.__exitWounds.state));
  assert.deepEqual(errors, []);
});
after(async () => {
  sourceAtEnd = await sourceFingerprint();
  await writeReport(); await context?.close(); await browser?.close();
  assert.equal(sourceAtEnd, sourceAtStart, 'Game or runner source changed during diagnostic execution.');
  console.log(`V04/V07 diagnostic evidence: ${output}`);
});

scenario('blocked driver door chooses the free passenger-side landing', async record => {
  record.setup = await stageOccupiedCar();
  const setup = await page.evaluate(() => {
    const a = window.__exitWounds.app, U = 16, v = a.runtime.vehicles.get('mara-sedan');
    const wall = a.runtime.world.box({ x: 330 * U, y: 329.75 * U, z: 0,
      w: 6 * U, d: 2.5 * U, h: 3 * U, fixed: true, color: '#ad7860' });
    wall.data.ewa93GapFixture = true;
    // A newly created Rapier collider is queryable only after the next world step.
    a.runtime.game.advance(1 / 120);
    const clearance = [0, 1].map(seat => [.62, 1.1, 1.7].map(extra => {
      const p = a.runtime.vehicles.doorPosition(v, seat, extra);
      const floor = a.runtime.queries.floorAt(p.x, p.y, v.z + .5 * U, { ignore: [v] });
      p.z = floor;
      return a.runtime.queries.capsuleClear(p, a.player.actor.r, a.player.actor.half,
        { ignore: [v, a.player.actor, a.player.actor._seatBody] });
    }));
    return { clearance, wallPosition: wall.body.translation() };
  });
  record.observations.push({ setup });
  assert.deepEqual(setup.clearance[0], [false, false, false], 'Fixture must block all driver-side exits.');
  assert.ok(setup.clearance[1].some(Boolean), 'Fixture must leave a passenger-side exit physically clear.');
  await press('KeyE');
  const transition = await page.evaluate(() => {
    const a = window.__exitWounds.app, t = a.runtime.vehicles.transitions.get(a.player.actor);
    return t ? { kind: t.kind, seat: t.seat, target: { x: t.target.x / 16, y: t.target.y / 16, z: t.target.z / 16 } } : null;
  });
  assert.equal(transition?.kind, 'exit');
  assert.ok(transition.target.y > 333, `Exit chose blocked side: ${JSON.stringify(transition)}`);
  const afterExit = await advance(1);
  assert.equal(afterExit.playerVehicle, null);
  assert.equal(afterExit.playerBodyEnabled, true);
  assert.equal(afterExit.missionFailure, null);
  assert.ok(afterExit.player.y > 333, 'Player must finish on the passenger side.');
  record.observations.push({ transition, afterExit });
  record.captures.push(await capture('blocked-driver-door-alternate-exit'));
  await page.evaluate(() => {
    const a = window.__exitWounds.app;
    for (const prop of [...a.runtime.world.props].filter(p => p.data?.ewa93GapFixture)) a.runtime.world.remove(prop);
  });
});

scenario('both blocked doors expose a clear checkpoint retry', async record => {
  record.setup = await stageOccupiedCar();
  const setup = await page.evaluate(() => {
    const a = window.__exitWounds.app, U = 16, v = a.runtime.vehicles.get('mara-sedan');
    for (const y of [329.75, 334.25]) {
      const wall = a.runtime.world.box({ x: 330 * U, y: y * U, z: 0,
        w: 6 * U, d: 2.5 * U, h: 3 * U, fixed: true, color: '#ad7860' });
      wall.data.ewa93GapFixture = true;
    }
    a.runtime.game.advance(1 / 120);
    return [0, 1].map(seat => [.62, 1.1, 1.7].map(extra => {
      const p = a.runtime.vehicles.doorPosition(v, seat, extra);
      p.z = a.runtime.queries.floorAt(p.x, p.y, v.z + .5 * U, { ignore: [v] });
      return a.runtime.queries.capsuleClear(p, a.player.actor.r, a.player.actor.half,
        { ignore: [v, a.player.actor, a.player.actor._seatBody] });
    }));
  });
  assert.ok(setup.flat().every(value => !value), `Fixture did not block both exit sides: ${JSON.stringify(setup)}`);
  await press('KeyE'); const rejected = await read();
  assert.equal(rejected.playerVehicle, 'mara-sedan');
  assert.equal(rejected.screen, 'playing');
  assert.match(rejected.toast, /doors blocked/i, 'Blocked exit must explain why it failed.');
  record.observations.push({ clearance: setup, rejected });
  record.captures.push(await capture('both-doors-blocked'));
  await press('Escape');
  await page.locator('.screen--pause [data-action="restartCheckpoint"]').waitFor();
  await page.locator('[data-action="restartCheckpoint"]').click();
  await page.locator('.screen--confirm [data-action="confirmYes"]').click();
  const retried = await read();
  assert.equal(retried.screen, 'playing');
  assert.equal(retried.checkpoint, 'new-run');
  assert.equal(retried.playerVehicle, null);
  assert.equal(retried.playerBodyEnabled, true);
  assert.equal(retried.missionFailure, null);
  assert.ok(Math.hypot(retried.player.x - 91, retried.player.y - 311) < 3);
  record.observations.push({ retried });
  await page.evaluate(() => {
    const a = window.__exitWounds.app;
    for (const prop of [...a.runtime.world.props].filter(p => p.data?.ewa93GapFixture)) a.runtime.world.remove(prop);
  });
});

scenario('a physical collision overturns the occupied car and leaves an exit or retry', async record => {
  record.setup = await stageOccupiedCar();
  const setup = await page.evaluate(profile => {
    const a = window.__exitWounds.app, U = 16, world = a.runtime.world;
    const profiles = {
      'side-high': { curbY: 334.15, curbH: 1.15, ramX: 330.7, ramY: 326.5,
        ramZ: 1.15, ramW: 2, ramD: 1.4, ramH: 1.7, mass: 2,
        velocity: { x: 0, y: 42, z: 0 } },
      'roof-drop': { curbY: 329.85, curbH: 1.15, ramX: 330, ramY: 333.2,
        ramZ: 3.3, ramW: 4.1, ramD: 1.1, ramH: 1.3, mass: 2,
        velocity: { x: 0, y: 0, z: -18 } },
      'lift-plate': { curbY: 330.75, curbH: 1.2, ramX: 330, ramY: 333.05,
        ramZ: -.24, ramW: 6, ramD: 1.15, ramH: .48, liftSpeed: 6,
        velocity: { x: 0, y: 0, z: 0 } },
    };
    const tune = profiles[profile];
    if (!tune) throw new Error(`Unknown rollover fixture profile ${profile}`);
    const curb = world.box({ x: 330 * U, y: tune.curbY * U, z: 0,
      w: 6 * U, d: .4 * U, h: tune.curbH * U, fixed: true, color: '#8d948c' });
    curb.data.ewa93GapFixture = true;
    let ram;
    if (profile === 'lift-plate') {
      const R = a.runtime.E.RAPIER;
      const body = world.pw.createRigidBody(R.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(tune.ramX * U, tune.ramY * U, tune.ramZ * U));
      const collider = world.pw.createCollider(R.ColliderDesc.cuboid(
        tune.ramW * U / 2, tune.ramD * U / 2, tune.ramH * U / 2)
        .setFriction(1).setCollisionGroups(0x0001ffff), body);
      window.__ewaGapLift = { body, collider, speed: tune.liftSpeed * U,
        maxZ: 5 * U, x: tune.ramX * U, y: tune.ramY * U };
      ram = { body };
    } else {
      ram = world.box({ x: tune.ramX * U, y: tune.ramY * U, z: tune.ramZ * U,
        w: tune.ramW * U, d: tune.ramD * U, h: tune.ramH * U,
        fixed: false, mass: tune.mass, color: '#af6a53' });
      ram.data.ewa93GapFixture = true;
      ram.body.setLinvel({ x: tune.velocity.x * U, y: tune.velocity.y * U,
        z: tune.velocity.z * U }, true);
    }
    return { profile, tune, curb: { ...curb.body.translation() }, ram: { ...ram.body.translation() },
      ramVelocity: { ...ram.body.linvel() } };
  }, rollProfile);
  record.observations.push({ setup });
  record.captures.push(await capture('collision-overturn-start'));
  let contactFrames = 0, minUpZ = 1, rolled = false, final;
  for (let batch = 0; batch < 24 && !rolled; batch++) {
    const sample = await page.evaluate(() => {
      const a = window.__exitWounds.app, v = a.runtime.vehicles.get('mara-sedan');
      const lift = window.__ewaGapLift;
      const ramBody = lift?.body || a.runtime.world.props.find(prop => prop.data?.ewa93GapFixture && !prop.body.isFixed())?.body;
      const curb = a.runtime.world.props.find(prop => prop.data?.ewa93GapFixture && prop.body.isFixed());
      let ramContacts = 0, curbContacts = 0, lowUpZ = 1;
      for (let i = 0; i < 30; i++) {
        if (lift) {
          const z = Math.min(lift.maxZ, lift.body.translation().z + lift.speed / 120);
          lift.body.setNextKinematicTranslation({ x: lift.x, y: lift.y, z });
        }
        a.runtime.game.advance(1 / 120);
        for (const collider of [v.collider, v.cabinCollider]) {
          a.runtime.world.pw.contactPairsWith(collider, other => {
            if (other.parent()?.handle === ramBody.handle) ramContacts++;
            if (other.parent()?.handle === curb.body.handle) curbContacts++;
          });
        }
        const q = v.body.rotation(), upZ = 1 - 2 * (q.x * q.x + q.y * q.y);
        lowUpZ = Math.min(lowUpZ, upZ);
        if (upZ < .2) break;
      }
      const q = v.body.rotation();
      return { tick: a.state.tick, car: v.position, q: { ...q }, upZ: 1 - 2 * (q.x * q.x + q.y * q.y),
        minUpZ: lowUpZ, disabled: v.disabled, speed: v.speed / 16, health: v.health,
        ramContacts, curbContacts, ram: { ...ramBody.translation() } };
    });
    contactFrames += sample.ramContacts; minUpZ = Math.min(minUpZ, sample.minUpZ);
    if (batch % 2 === 0 || sample.minUpZ < .2) record.observations.push(sample);
    final = sample; rolled = sample.minUpZ < .2;
  }
  assert.ok(contactFrames > 0, 'The ram must physically contact the vehicle; fixture missed it.');
  assert.ok(rolled, `Collision setup did not cause a roll (min upZ ${minUpZ.toFixed(3)}); tune fixture, do not count this as a vehicle pass.`);
  assert.equal(final.disabled, true, 'Collision-created rollover must disable the vehicle.');
  record.captures.push(await capture('collision-caused-overturn'));
  for (let i = 0; i < 40 && Math.abs((await read()).car.speed) >= 2; i++) await advance(.25);
  const beforeExit = await read();
  if (Math.abs(beforeExit.car.speed) < 2) {
    await press('KeyE'); await advance(1);
  }
  const outcome = await read();
  if (outcome.playerVehicle === null) {
    assert.equal(outcome.playerBodyEnabled, true);
    assert.equal(outcome.missionFailure, null);
    const clear = await page.evaluate(() => {
      const a = window.__exitWounds.app, actor = a.player.actor;
      return a.runtime.queries.capsuleClear({ x: actor.x, y: actor.y, z: actor.z },
        actor.r, actor.half, { ignore: [actor] });
    });
    assert.equal(clear, true, 'Exited actor must finish in physically clear space.');
  } else {
    assert.equal(outcome.playerVehicle, 'mara-sedan');
    await press('Escape');
    await page.locator('.screen--pause [data-action="restartCheckpoint"]').waitFor();
    await page.locator('[data-action="restartCheckpoint"]').click();
    await page.locator('.screen--confirm [data-action="confirmYes"]').click();
    const retry = await read();
    assert.equal(retry.screen, 'playing');
    assert.equal(retry.playerVehicle, null);
    assert.equal(retry.playerBodyEnabled, true);
    record.observations.push({ retry });
  }
  record.observations.push({ collisionContacts: contactFrames, minUpZ, beforeExit, outcome });
  await page.evaluate(() => {
    const a = window.__exitWounds.app;
    if (window.__ewaGapLift) {
      a.runtime.world.pw.removeRigidBody(window.__ewaGapLift.body);
      delete window.__ewaGapLift;
    }
    for (const prop of [...a.runtime.world.props].filter(p => p.data?.ewa93GapFixture)) a.runtime.world.remove(prop);
  });
  const settled = await advance(2);
  assert.equal(settled.screen, 'playing');
  assert.equal(settled.playerVehicle, null);
  assert.equal(settled.playerBodyEnabled, true);
  assert.equal(settled.missionFailure, null);
  assert.ok(settled.player.x >= 22 && settled.player.x <= 456 && settled.player.y >= 24 && settled.player.y <= 396,
    'Mara must remain inside the playable district after the diagnostic collision fixture is removed.');
  assert.ok(settled.player.z > -2, 'Mara must not keep falling after exiting the rolled car.');
  record.observations.push({ settled });
});

scenario('walking out of the depot area and returning preserves mission progress', async record => {
  const s = structuredClone(baseline);
  s.runId = 'failure-collision-leave-return'; s.tick = 1200; s.elapsed = 10;
  s.player.position = { x: 348, y: 182, z: .05 }; s.player.rotation = Math.PI / 2;
  Object.assign(s.mission, { phase: 'APPROACH', phaseEnteredTick: s.tick,
    route: null, checkpointId: 'depot-approach', pendingCheckpoint: false,
    eliCall: { version: 1, status: 'superseded', remaining: 0,
      nextLine: 0, contacted: true, completed: false } });
  s.mission.messages.push('depot-address');
  for (const [id, actor] of Object.entries(s.actors)) if (id.startsWith('crew-')) {
    actor.health = 0; actor.state = 'down';
  }
  s.district.crewMeta = { alerted: false, sharedLastKnown: null };
  await keys();
  const loaded = await page.evaluate(({ key, raw }) => {
    const a = window.__exitWounds.app;
    a.saveStore.clear({ confirmed: true }); localStorage.setItem(key, raw);
    a.continueGame(); a.runtime.game.stop(); a.updateHUD();
    return { screen: a.ui.screen, phase: a.state.mission.phase };
  }, { key: SAVE_KEY, raw: encodeSave(s, 123456789) });
  assert.deepEqual(loaded, { screen: 'playing', phase: 'APPROACH' });
  const first = await read(); record.observations.push({ first });
  await walkTo(348, 202, 1);
  const outside = await read();
  assert.ok(Math.hypot(outside.player.x - 348, outside.player.y - 124) > 61,
    'Mara must actually leave the 61 m depot location radius.');
  assert.equal(outside.phase, 'APPROACH'); assert.equal(outside.missionFailure, null);
  record.observations.push({ outside });
  await walkTo(348, 164, 1);
  const returned = await read();
  assert.equal(returned.phase, 'APPROACH'); assert.equal(returned.missionFailure, null);
  assert.match(returned.prompt, /street gate/i, 'The gate objective must remain actionable after returning.');
  await press('KeyE');
  const committed = await read();
  assert.equal(committed.phase, 'RECOVERY');
  assert.equal(committed.missionRoute, 'gate');
  assert.equal(committed.checkpoint, 'recovery');
  assert.equal(committed.missionFailure, null);
  record.observations.push({ returned, committed });
  record.captures.push(await capture('depot-return-approach-committed'));
  await walkTo(348, 202, 1);
  const awayAgain = await read();
  assert.equal(awayAgain.phase, 'RECOVERY'); assert.equal(awayAgain.missionFailure, null);
  await walkTo(348, 164, 1);
  const returnedAgain = await read();
  assert.equal(returnedAgain.phase, 'RECOVERY');
  assert.equal(returnedAgain.missionFailure, null);
  record.observations.push({ awayAgain, returnedAgain });
});
