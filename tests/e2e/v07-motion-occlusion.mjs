/** V07 focused actual-engine diagnostics; fixture setup is explicit, actions use the normal poller. */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { encodeSave, SAVE_KEY, SETTINGS_KEY } from '../../src/game/save.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const origin = process.env.EWA93_BASE_URL || 'http://127.0.0.1:5173';
const cdpURL = process.env.EWA93_V07_CDP_URL;
const output = process.env.EWA93_V07_OUTPUT || `/tmp/ewa93-v07-${Date.now()}`;
const selected = process.env.EWA93_V07_CASE;
const records = [], errors = [], networkErrors = [], heldKeys = new Set();
let browser, context, page, baseline, sourceStart, sourceEnd;

async function fingerprint() {
  async function walk(dir) {
    const result = [];
    for (const entry of await readdir(join(repoRoot, dir), { withFileTypes: true })) {
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
    'tests/e2e/v07-motion-occlusion.mjs'];
  const h = createHash('sha256');
  for (const path of paths.sort()) { h.update(path); h.update(await readFile(join(repoRoot, path))); }
  return h.digest('hex');
}
async function report() {
  await writeFile(join(output, 'report.json'), JSON.stringify({
    kind: 'V07 focused motion/occlusion diagnostic', origin, output,
    browserVersion: browser?.version(), fixtureBasedIntegration: true,
    acceleratedFixedSteps: true, acceptancePlaythrough: false,
    sourceStart, sourceEnd, sourceStable: sourceEnd ? sourceStart === sourceEnd : null,
    errors, networkErrors, records,
  }, null, 2));
}
async function read() {
  return page.evaluate(() => {
    const a = window.__exitWounds.app, car = a.runtime.vehicles.get('mara-sedan');
    return { screen: a.ui.screen, appError: a.error?.message || null, tick: a.state.tick,
      phase: a.state.mission.phase, route: a.state.mission.route,
      failure: a.state.mission.failure, player: a.player.position,
      playerVehicle: a.state.player.vehicleId, bodyEnabled: !!a.player.actor.body?.isEnabled(),
      animation: a.player.actor.data.animation?.base || null,
      ammo: a.state.player.inventory.weapons.pistol.magazine,
      crewGuardHealth: a.crew.enemies[0].health,
      cover: a.cover.active?.id || null, inCover: a.player.inCover,
      vaulting: !!a.vaultState, canFire: a.cover.canFire,
      car: { position: car.position, speed: car.speed / 16, health: car.health,
        disabled: car.disabled, driver: car.seats[0]?.id || null },
      jun: { position: a.jun.position, bodyEnabled: !!a.jun.actor.body?.isEnabled(),
        vehicleId: a.jun.vehicleId, fell: a.jun.actor.fell },
    };
  });
}
async function advance(seconds = 1 / 120) {
  await page.evaluate(seconds => window.__exitWounds.runtime.game.advance(seconds), seconds);
  const s = await read(); assert.notEqual(s.screen, 'error', s.appError || 'Runtime error screen.'); return s;
}
async function keys(next = []) {
  const wanted = new Set(next);
  for (const key of heldKeys) if (!wanted.has(key)) { await page.keyboard.up(key); heldKeys.delete(key); }
  for (const key of wanted) if (!heldKeys.has(key)) { await page.keyboard.down(key); heldKeys.add(key); }
}
async function press(key) {
  await keys([key]); const result = await advance(1 / 60);
  await keys(); await advance(1 / 60); return result;
}
async function capture(name) {
  await page.evaluate(() => window.__exitWounds.runtime.game.advance(0, { draw: true }));
  const path = join(output, `${name}.png`); await page.screenshot({ path, timeout: 90000 }); return path;
}
async function captureCarSide(name) {
  await page.evaluate(() => {
    const a = window.__exitWounds.app, v = a.runtime.vehicles.get('mara-sedan');
    const p = v.position, jun = a.jun.position, U = 16;
    const eye = { x: p.x + 1.5, y: p.y + 10, z: 3.1 };
    const target = { x: jun.x, y: jun.y, z: 1.25 };
    const dx = target.x - eye.x, dy = target.y - eye.y, dz = target.z - eye.z;
    a.runtime.world.camera.set('fixed');
    a.runtime.world.camera.fixed = { x: eye.x * U, y: eye.y * U, z: eye.z * U,
      yaw: Math.atan2(dy, dx), pitch: Math.atan2(dz, Math.hypot(dx, dy)), fov: 48 };
    a.runtime.world.camera.update(0);
    a.runtime.game.advance(0, { draw: true });
  });
  const path = join(output, `${name}.png`);
  await page.screenshot({ path, timeout: 90000 });
  await page.evaluate(() => {
    const a = window.__exitWounds.app, v = a.runtime.vehicles.get('mara-sedan');
    a.runtime.camera.update(0, {}, v, { vehicle: v });
  });
  return path;
}
async function reset() {
  await keys();
  await page.evaluate(() => {
    const a = window.__exitWounds.app;
    window.__qaPad.values.fill(0); window.__qaPad.axes.fill(0);
    a.newGame(); a.runtime.game.stop();
  });
  const s = await read(); assert.equal(s.screen, 'playing'); return s;
}
async function cleanFixture() {
  await page.evaluate(() => {
    const a = window.__exitWounds?.app;
    if (!a) return;
    for (const prop of [...a.runtime.world.props].filter(p => p.data?.ewa93V07Fixture)) a.runtime.world.remove(prop);
    if (window.__v07OriginalVehicleEvent) {
      a.runtime.vehicles.onEvent = window.__v07OriginalVehicleEvent;
      delete window.__v07OriginalVehicleEvent;
    }
  }).catch(() => {});
}
function scenario(name, fn) {
  if (selected && !new RegExp(selected).test(name)) return;
  test(`Windows Chromium: ${name}`, { timeout: 900000 }, async () => {
    const record = { name, status: 'running', startedAt: new Date().toISOString(),
      observations: [], captures: [], fixtureBasedIntegration: true };
    records.push(record); const errorStart = errors.length, networkStart = networkErrors.length;
    try {
      await fn(record);
      assert.deepEqual(errors.slice(errorStart), []);
      assert.deepEqual(networkErrors.slice(networkStart), []);
      record.status = 'passed';
    } catch (error) {
      record.status = 'failed'; record.failure = error.stack || error.message;
      record.final = await read().catch(() => null);
      record.captures.push(await capture(`failure-${records.length}`).catch(() => null));
      throw error;
    } finally {
      await keys().catch(() => {}); await cleanFixture();
      record.finishedAt = new Date().toISOString(); await report();
    }
  });
}
async function walkTo(x, y, radius = .7) {
  let previous = await read(), stuck = 0;
  for (let i = 0; i < 400; i++) {
    const p = previous.player, dx = x - p.x, dy = y - p.y, gap = Math.hypot(dx, dy);
    if (gap < radius) { await keys(); return advance(.08); }
    const yaw = await page.evaluate(() => window.__exitWounds.runtime.camera.yaw);
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const side = -s * dx + c * dy, forward = c * dx + s * dy;
    const next = ['ShiftLeft'];
    if (Math.abs(side) > gap * .2) next.push(side > 0 ? 'KeyD' : 'KeyA');
    if (Math.abs(forward) > gap * .2) next.push(forward > 0 ? 'KeyW' : 'KeyS');
    await keys(next);
    const now = await advance(Math.min(.16, Math.max(.025, gap / 5.15 * .48)));
    assert.equal(now.screen, 'playing');
    stuck = Math.hypot(now.player.x - p.x, now.player.y - p.y) < .015 ? stuck + 1 : 0;
    assert.ok(stuck < 35, `Physical walk blocked at ${JSON.stringify(now.player)}`);
    previous = now;
  }
  throw new Error(`Physical walk did not reach ${x},${y}.`);
}

before(async () => {
  await mkdir(output, { recursive: true }); sourceStart = await fingerprint();
  browser = cdpURL ? await chromium.connectOverCDP(cdpURL) :
    await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
  context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  await context.addInitScript(({ key }) => {
    localStorage.setItem(key, JSON.stringify({ version: 1,
      settings: { quality: 'low', masterVolume: 0 } }));
    window.__qaPad = { axes: [0, 0, 0, 0], values: Array(17).fill(0) };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [{
      index: 0, id: 'V07 isolated standard fixture', mapping: 'standard', connected: true,
      timestamp: performance.now(), axes: window.__qaPad.axes,
      buttons: window.__qaPad.values.map(value => ({ value, pressed: value > .5, touched: value > 0 })),
    }] });
  }, { key: SETTINGS_KEY });
  page = await context.newPage(); page.setDefaultTimeout(90000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => networkErrors.push({ url: request.url(), reason: request.failure()?.errorText }));
  page.on('response', response => { if (response.status() >= 400) networkErrors.push({ url: response.url(), status: response.status() }); });
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.locator('.screen--title [data-action="newGame"]').waitFor();
  await page.locator('[data-action="newGame"]').click(); await page.locator('.hud').waitFor();
  await page.evaluate(() => window.__exitWounds.runtime.game.stop());
  baseline = await page.evaluate(() => structuredClone(window.__exitWounds.state));
  assert.deepEqual(errors, []);
});
after(async () => {
  sourceEnd = await fingerprint(); await report(); await context?.close(); await browser?.close();
  assert.equal(sourceEnd, sourceStart, 'Diagnostic source drifted during execution.');
  console.log(`V07 evidence: ${output}`);
});

scenario('near wall a real shot is stopped while the camera stays outside geometry', async record => {
  await reset();
  const setup = await page.evaluate(() => {
    const a = window.__exitWounds.app, U = 16;
    a.player.place({ x: 230, y: 202, z: .05 });
    a.crew.enemies[0].actor.place(241 * U, 202 * U, .05 * U);
    a.runtime.camera.reset(a.player.actor, 0);
    const wall = a.runtime.world.box({ x: 236 * U, y: 202 * U, z: 0,
      w: .6 * U, d: 6 * U, h: 3 * U, fixed: true, color: '#9a624b' });
    wall.data.ewa93V07Fixture = true;
    window.__qaPad.values[6] = 1; // Normal L2 aim through the engine poller.
    a.runtime.game.advance(.1);
    const ray = a.runtime.camera.aimRay(90 * U);
    const cameraHit = a.runtime.queries.ray(ray.from, ray.to, { ignore: [a.player.actor] });
    const tip = a.player.actor.rig.tip();
    const muzzle = { x: tip[0], y: tip[1], z: tip[2] };
    const muzzleHit = a.runtime.queries.ray(muzzle, { x: 241 * U, y: 202 * U, z: 1.35 * U }, { ignore: [a.player.actor] });
    return { eye: { x: ray.from.x / U, y: ray.from.y / U, z: ray.from.z / U },
      wall: { x: wall.body.translation().x / U, y: wall.body.translation().y / U },
      cameraHitsWall: cameraHit?.body?.handle === wall.body.handle,
      muzzleHitsWall: muzzleHit?.body?.handle === wall.body.handle,
      aiming: a.player.aiming,
      ammo: a.state.player.inventory.weapons.pistol.magazine,
      targetHealth: a.crew.enemies[0].health };
  });
  record.observations.push({ setup });
  assert.equal(setup.aiming, true, 'The shot must be tested while normal L2 aim is held.');
  assert.equal(setup.cameraHitsWall, true, 'Camera ray must meet the actual wall from clear space.');
  assert.equal(setup.muzzleHitsWall, true, 'Muzzle ray must meet the same wall before the target.');
  record.captures.push(await capture('wall-shot-before'));
  await page.evaluate(() => { window.__qaPad.values[7] = 1; });
  const fired = await advance(1 / 60);
  await page.evaluate(() => { window.__qaPad.values[7] = 0; }); await advance(.1);
  await page.evaluate(() => { window.__qaPad.values[6] = 0; });
  assert.equal(fired.ammo, setup.ammo - 1, 'Normal R2 input must fire a real round.');
  assert.equal(fired.crewGuardHealth, setup.targetHealth, 'Enemy behind physical wall must take no damage.');
  assert.equal(fired.failure, null);
  record.observations.push({ fired }); record.captures.push(await capture('wall-shot-after'));
});

scenario('a moving occupied car passes a standing actor without tunneling or stale seats', async record => {
  await reset();
  const setup = await page.evaluate(() => {
    const a = window.__exitWounds.app, U = 16, v = a.runtime.vehicles.get('mara-sedan');
    v.body.setTranslation({ x: 300 * U, y: 332 * U, z: .8 * U }, true);
    v.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    v.body.setLinvel({ x: 0, y: 0, z: 0 }, true); v.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    a.runtime.vehicles.postStep(0); a.player.place({ x: 298.5, y: 332, z: .05 });
    a.runtime.camera.reset(a.player.actor, 0);
    const entry = a.runtime.vehicles.enter(a.player.actor, v.id, 'driver');
    a.runtime.game.advance(1.2);
    a.jun.actor.place(335 * U, 333.24 * U, 0);
    a.runtime.game.advance(.05);
    return { entry: entry.ok, car: v.position, jun: a.jun.position,
      junBodyEnabled: !!a.jun.actor.body?.isEnabled() };
  });
  assert.equal(setup.entry, true); assert.equal(setup.junBodyEnabled, true);
  record.observations.push({ setup }); record.captures.push(await capture('car-adjacent-before'));
  let closest = Infinity, nearSpeed = 0, nearCapture = false, after;
  await keys(['KeyW']);
  for (let i = 0; i < 120; i++) {
    after = await advance(.1);
    const separation = Math.hypot(after.car.position.x - after.jun.position.x,
      after.car.position.y - after.jun.position.y);
    closest = Math.min(closest, separation);
    if (Math.abs(after.car.position.x - after.jun.position.x) < 2.5) {
      nearSpeed = Math.max(nearSpeed, Math.abs(after.car.speed));
      if (!nearCapture) {
        record.captures.push(await capture('car-adjacent-pass'));
        record.captures.push(await captureCarSide('car-adjacent-side'));
        nearCapture = true;
      }
    }
    if (i % 8 === 0) record.observations.push({ car: after.car, jun: after.jun });
    if (after.car.position.x > setup.jun.x + 7) break;
  }
  await keys(); after = await advance(.3);
  assert.ok(nearCapture && nearSpeed > 2, 'Car must physically pass close to Jun at driving speed.');
  assert.ok(after.car.position.x > setup.jun.x + 7, 'Car must clear the standing actor.');
  assert.equal(after.jun.bodyEnabled, true); assert.equal(after.jun.vehicleId, null);
  assert.equal(after.jun.fell, false); assert.equal(after.failure, null);
  assert.ok(after.jun.position.x >= 22 && after.jun.position.x <= 456 &&
    after.jun.position.y >= 24 && after.jun.position.y <= 396);
  const clear = await page.evaluate(() => {
    const a = window.__exitWounds.app, actor = a.jun.actor;
    return a.runtime.queries.capsuleClear({ x: actor.x, y: actor.y, z: actor.z },
      actor.r, actor.half, { ignore: [actor] });
  });
  assert.equal(clear, true, 'Jun must not remain interpenetrating after the vehicle passes.');
  record.observations.push({ closest, nearSpeed, after });
  record.captures.push(await capture('car-adjacent-after'));
});

scenario('service vault and nearby cover retain collision bodies and responsive controls', async record => {
  const s = structuredClone(baseline);
  s.runId = 'v07-service-vault-cover'; s.tick = 1200; s.elapsed = 10;
  s.player.position = { x: 402, y: 88, z: .05 }; s.player.rotation = Math.PI;
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
    a.continueGame(); a.runtime.game.stop(); a.runtime.camera.reset(a.player.actor, Math.PI);
    a.updateHUD();
    return { screen: a.ui.screen, interaction: a.nearestInteraction()?.id || null };
  }, { key: SAVE_KEY, raw: encodeSave(s, 123456789) });
  assert.deepEqual(loaded, { screen: 'playing', interaction: 'depot-rear-vault' });
  record.captures.push(await capture('service-vault-before'));
  await press('KeyE'); const started = await read();
  assert.equal(started.vaulting, true); assert.equal(started.bodyEnabled, false);
  const mid = await advance(.32);
  assert.equal(mid.vaulting, true); assert.equal(mid.animation, 'ClimbUp_1m_RM');
  record.captures.push(await capture('service-vault-mid'));
  const landed = await advance(.5);
  assert.equal(landed.vaulting, false); assert.equal(landed.bodyEnabled, true);
  assert.equal(landed.phase, 'RECOVERY'); assert.equal(landed.route, 'service');
  assert.ok(Math.hypot(landed.player.x - 396, landed.player.y - 88) < 1);
  await walkTo(391, 84, .65);
  await press('KeyQ'); const covered = await read();
  assert.equal(covered.cover, 'rear-cabinet'); assert.equal(covered.inCover, true);
  assert.equal(covered.bodyEnabled, true);
  record.captures.push(await capture('service-cover-active'));
  await press('KeyQ'); const left = await read();
  assert.equal(left.cover, null); assert.equal(left.inCover, false);
  assert.equal(left.bodyEnabled, true); assert.equal(left.failure, null);
  record.observations.push({ loaded, started, mid, landed, covered, left });
  await advance(.12); // Let the throttled HUD refresh its cover prompt before capture.
  record.captures.push(await capture('service-cover-left'));
});

scenario('same physical barrier causes distinct low and high speed impacts', async record => {
  await reset();
  const wall = await page.evaluate(() => {
    const a = window.__exitWounds.app, U = 16;
    const wall = a.runtime.world.box({ x: 255 * U, y: 202 * U, z: 0,
      w: 1.2 * U, d: 7 * U, h: 4 * U, fixed: true, color: '#8e948e' });
    wall.data.ewa93V07Fixture = true; a.runtime.game.advance(.05);
    return { x: 255, y: 202 };
  });
  record.observations.push({ wall });
  const impacts = [];
  for (const startX of [240, 220]) {
    await reset();
    const setup = await page.evaluate(x => {
      const a = window.__exitWounds.app, U = 16, v = a.runtime.vehicles.get('mara-sedan');
      v.body.setTranslation({ x: x * U, y: 202 * U, z: .8 * U }, true);
      v.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      v.body.setLinvel({ x: 0, y: 0, z: 0 }, true); v.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      a.runtime.vehicles.postStep(0); a.player.place({ x: x - 1.5, y: 202, z: .05 });
      const entry = a.runtime.vehicles.enter(a.player.actor, v.id, 'driver');
      a.runtime.game.advance(1.15);
      window.__v07OriginalVehicleEvent ||= a.runtime.vehicles.onEvent;
      window.__v07Impacts = [];
      a.runtime.vehicles.onEvent = event => {
        if (event.type === 'VehicleImpact' && event.sourceId === 'mara-sedan')
          window.__v07Impacts.push({ tick: a.state.tick, damage: event.payload.damage,
            deltaSpeed: event.payload.deltaSpeed, position: v.position });
        window.__v07OriginalVehicleEvent(event);
      };
      return { entry: entry.ok, position: v.position, health: v.health };
    }, startX);
    assert.equal(setup.entry, true);
    record.captures.push(await capture(`impact-${startX}-before`));
    await page.evaluate(() => { window.__qaPad.values[7] = 1; });
    let peakSpeed = 0, after, events = [];
    for (let i = 0; i < 100; i++) {
      after = await advance(.1);
      peakSpeed = Math.max(peakSpeed, Math.abs(after.car.speed));
      events = await page.evaluate(() => window.__v07Impacts || []);
      if (events.length) break;
    }
    await page.evaluate(() => { window.__qaPad.values[7] = 0; });
    await advance(.1);
    assert.ok(events.length > 0, `Car from x=${startX} must physically strike the wall.`);
    const impact = { startX, peakSpeed, event: events[0], finalHealth: after.car.health,
      driver: after.car.driver, screen: after.screen };
    assert.equal(impact.driver, 'mara'); assert.equal(impact.screen, 'playing');
    impacts.push(impact); record.observations.push(impact);
    record.captures.push(await capture(`impact-${startX}-after`));
  }
  assert.ok(impacts[1].peakSpeed > impacts[0].peakSpeed + 1,
    'Longer acceleration run should produce a materially faster barrier impact.');
  assert.ok(impacts[1].event.damage > impacts[0].event.damage + 1,
    'Higher-speed collision should cause materially more vehicle damage.');
});
