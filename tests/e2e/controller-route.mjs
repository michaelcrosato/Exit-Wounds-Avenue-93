/**
 * Complete emulated DualSense route. All player/menu commands come through the
 * standard Gamepad API consumed by my-3d2dge. Playwright only supplies raw pad
 * values, reads state, and captures evidence. This cannot certify physical feel.
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium, webkit } from 'playwright';

const engine = process.env.EWA93_CONTROLLER_ENGINE || 'chromium';
const ending = process.env.EWA93_CONTROLLER_ENDING || 'reporter';
assert.ok(['broker', 'reporter'].includes(ending), 'EWA93_ENDING must be broker or reporter.');
const baseURL = process.env.EWA93_BASE_URL || 'http://127.0.0.1:5173';
const output = process.env.EWA93_CONTROLLER_OUTPUT || `/tmp/ewa93-controller-${ending}-${Date.now()}`;
const cdpURL = process.env.EWA93_CONTROLLER_CDP_URL;
assert.ok(!cdpURL || engine === 'chromium', 'CDP controller route requires Chromium.');
await mkdir(output, { recursive: true });
const browser = cdpURL ? await chromium.connectOverCDP(cdpURL) : await ({ chromium, webkit }[engine]).launch({ headless: true, args: engine === 'chromium' ? ['--enable-unsafe-swiftshader'] : [] });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
await context.addInitScript(() => {
  window.__qaPad = { active: true, axes: [0, 0, 0, 0], values: Array(17).fill(0) };
  window.__qaExternalInputs = { keydown: 0, mousedown: 0, pointerdown: 0, touchstart: 0 };
  for (const type of Object.keys(window.__qaExternalInputs)) {
    window.addEventListener(type, event => {
      if (event.isTrusted) window.__qaExternalInputs[type]++;
    }, { capture: true });
  }
  Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => window.__qaPad.active ? [{
    index: 0, id: 'Virtual DualSense standard-mapping QA fixture', mapping: 'standard', connected: true,
    timestamp: performance.now(), axes: window.__qaPad.axes,
    buttons: window.__qaPad.values.map(value => ({ value, pressed: value > 0.5, touched: value > 0 })),
  }] : [] });
});
const page = await context.newPage();
page.setDefaultTimeout(60000);
const report = { engine, browserVersion: browser.version(), ending, baseURL, seed: 93,
  input: 'Gamepad API emulation; no keyboard or mouse gameplay/menu input', physicalController: false,
  acceleratedFixedSteps: true, startedAt: new Date().toISOString(), status: 'running', errors: [], checkpoints: [] };
async function listFiles(relative) {
  const entries = await readdir(new URL(`../../${relative}/`, import.meta.url), { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory()
    ? listFiles(`${relative}/${entry.name}`) : [`${relative}/${entry.name}`]))).flat();
}
const sourceFiles = [
  'index.html', 'package.json', 'package-lock.json', 'tests/e2e/controller-route.mjs', 'tools/serve.mjs',
  ...(await Promise.all(['src', 'assets', 'vendor'].map(listFiles))).flat(),
].sort();
report.sourceFileCount = sourceFiles.length;
async function sourceHashes(){return Object.fromEntries(await Promise.all(sourceFiles.map(async name=>[name,createHash('sha256').update(await readFile(new URL('../../'+name,import.meta.url))).digest('hex')])));}
report.sourceHashes=await sourceHashes();
page.on('pageerror', error => report.errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });

async function read() {
  return page.evaluate(() => {
    const a = window.__exitWounds.app, s = a.state;
    return {
      screen: a.ui.screen, tick: s?.tick, elapsed: s?.elapsed, phase: s?.mission.phase,
      inputDevice: a.runtime.input.engine.lastDevice, padId: a.runtime.input.engine.padId,
      padMapping: a.runtime.input.engine.padMapping, connected: a.runtime.input.engine.padIndex !== null,
      focusIndex: a.ui.focusIndex,
      ending: s?.mission.ending, completed: s?.mission.completed, failure: s?.mission.failure,
      position: s?.player.position, vehicleId: s?.player.vehicleId,
      sedan: s?.vehicles['mara-sedan'], health: s?.player.health, armor: s?.player.armor,
      vehicleSpeed: a.runtime.vehicles.occupant(a.player.actor)?.vehicle.speed / 16 || 0,
      vehicleTransition: a.runtime.vehicles.transitions.get(a.player.actor)?.kind || null,
      toast: document.querySelector('#hud-toast')?.textContent,
      wallet: s?.player.wallet, inventory: s?.player.inventory,
      wanted: s?.wanted, jun: s?.actors.jun, yaw: a.runtime.camera.yaw, pitch: a.runtime.camera.pitch,
      junDebug: { position: a.jun.position, mode: a.jun.mode, path: a.jun.path.map(p => p.id || 'target'),
        next: a.jun.path[0] || null, goal: a.jun.pathGoalNode, target: a.jun.target,
        stuckFor: a.jun.stuckFor, lastProgress: a.jun.lastProgress },
      eye: a.runtime.camera.eye ? { x: a.runtime.camera.eye.x / 16, y: a.runtime.camera.eye.y / 16, z: a.runtime.camera.eye.z / 16 } : null,
      prompt: document.querySelector('#hud-prompt')?.textContent,
      crew: a.crew.enemies.map(e => ({ id: e.id, health: e.health, position: a.crew.positionOf(e), visible: e.visible })),
    };
  });
}
async function step(seconds = 0.15, axes = [0, 0, 0, 0], values = {}, active = true) {
  await page.evaluate(({ seconds, axes, values, active }) => {
    window.__qaPad.active = active; window.__qaPad.axes = axes;
    window.__qaPad.values = Array.from({ length: 17 }, (_, i) => values[i] || 0);
    window.__exitWounds.runtime.game.advance(seconds);
  }, { seconds, axes, values, active });
  const s = await read();
  if (s.failure || s.screen === 'error' || s.screen === 'retry') throw new Error(`Mission failure: ${JSON.stringify(s.failure || s.screen)}`);
  return s;
}
async function note(name) {
  await step(0.025);
  const state = await read(); report.checkpoints.push({ name, ...state });
  await page.screenshot({ path: `${output}/${name}.png` });
  // Retain the actual saved checkpoint bytes for a later-code reload; this is
  // browser storage from the real route, never a synthesized mission snapshot.
  await context.storageState({ path: `${output}/${name}.storage.json` });
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ name, phase: state.phase, elapsed: state.elapsed, position: state.position, health: state.health, armor: state.armor }));
}
async function padTap(index, seconds = 0.05) {
  await step(seconds, [0, 0, 0, 0], { [index]: 1 });
  return step(0.05);
}
async function menuSelect(action) {
  // GameInterface schedules initial focus on the next browser frame.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
  await step(0.05);
  const target = await page.evaluate(action => {
    const a = window.__exitWounds.app, list = a.ui.focusables(), index = list.findIndex(el => el.dataset.action === action);
    return { index, current: a.ui.focusIndex, length: list.length, screen: a.ui.screen };
  }, action);
  assert.ok(target.index >= 0, `Missing enabled menu action ${action} on ${target.screen}`);
  const down = (target.index - target.current + target.length) % target.length;
  const up = (target.current - target.index + target.length) % target.length;
  const button = down <= up ? 13 : 12;
  for (let i = 0; i < Math.min(down, up); i++) await padTap(button);
  assert.equal((await read()).focusIndex, target.index, `${action} must be gamepad-focused before Cross (was ${target.current}, ${down <= up ? 'down' : 'up'} ${Math.min(down, up)} on ${target.screen})`);
  await padTap(0);
}
async function interact(expectedPhase) {
  await step(0.025);
  await padTap(3);
  if (expectedPhase) assert.equal((await read()).phase, expectedPhase, `Expected Triangle interaction to reach ${expectedPhase}; ${(await read()).prompt}`);
}
async function walk(x, y, { sprint = true, radius = 1.15 } = {}) {
  let last = await read(), stuck = 0;
  for (let count = 0; count < 1400; count++) {
    const dx = x - last.position.x, dy = y - last.position.y, distance = Math.hypot(dx, dy);
    if (distance <= radius) { await step(0.025); return; }
    const c = Math.cos(last.yaw), s = Math.sin(last.yaw);
    const axes = [(-s * dx + c * dy) / distance, (-c * dx - s * dy) / distance, 0, 0];
    const next = await step(Math.min(0.2, distance / (sprint ? 5.15 : 3.05) * 0.6), axes, sprint ? { 0: 1 } : {});
    if(report.traceJun&&count%12===0)(report.junTrail ||= []).push({destination:{x,y},elapsed:next.elapsed,player:next.position,jun:next.junDebug});
    const progress = Math.hypot(next.position.x - last.position.x, next.position.y - last.position.y);
    stuck = progress < 0.02 ? stuck + 1 : 0;
    if (stuck > 35) throw new Error(`Route physically blocked approaching (${x},${y}), at ${JSON.stringify(next.position)}; prompt=${next.prompt}`);
    last = next;
  }
  throw new Error(`Route could not converge to (${x},${y}).`);
}
async function route(points, options) { for (const [x, y] of points) await walk(x, y, options); }
async function aimAt(position) {
  for (let i = 0; i < 80; i++) {
    const s = await read(), eye = s.eye || { ...s.position, z: s.position.z + 1.5 }, dx = position.x - eye.x, dy = position.y - eye.y;
    const yaw = Math.atan2(dy, dx), yawDelta = Math.atan2(Math.sin(yaw - s.yaw), Math.cos(yaw - s.yaw));
    const pitch = Math.atan2((position.z || 0) + 1.2 - eye.z, Math.hypot(dx, dy));
    const pitchDelta = pitch - s.pitch;
    if (Math.abs(yawDelta) < 0.012 && Math.abs(pitchDelta) < 0.012) return;
    // Controller angular velocity is 2.6 rad/s yaw and 1.9 rad/s pitch.
    const desiredX = yawDelta / (0.04 * 2.6), desiredY = -pitchDelta / (0.04 * 1.9), length = Math.hypot(desiredX, desiredY);
    const scale = length > 0 ? (0.12 + 0.88 * Math.min(1, length)) / length : 0;
    await step(0.04, [0, 0, desiredX * scale, desiredY * scale], { 6: 1 });
  }
}
async function fightFromCurrentPosition() {
  const ineffective = new Map();
  for (let burst = 0; burst < 32; burst++) {
    let s = await read();
    const living = s.crew.filter(e => e.health > 0).sort((a, b) => Math.hypot(a.position.x - s.position.x, a.position.y - s.position.y) - Math.hypot(b.position.x - s.position.x, b.position.y - s.position.y));
    if (!living.length) return;
    const target = await page.evaluate(blocked => {
      const a = window.__exitWounds.app, p = a.player.position;
      return a.crew.living.filter(e => {
        if (blocked.includes(e.id)) return false;
        const q = a.crew.positionOf(e);
        return Math.hypot(q.x - p.x, q.y - p.y) < 85 && a.runtime.queries.lineOfSight({ x: p.x, y: p.y, z: p.z + 1.5 }, { x: q.x, y: q.y, z: q.z + 1.2 }, { ignore: [a.player.actor], target: e.actor });
      }).sort((a1, b1) => Math.hypot(a.crew.positionOf(a1).x - p.x, a.crew.positionOf(a1).y - p.y) - Math.hypot(a.crew.positionOf(b1).x - p.x, a.crew.positionOf(b1).y - p.y)).map(e => ({ id: e.id, position: a.crew.positionOf(e) }))[0] || null;
    }, [...ineffective.entries()].filter(([, count]) => count >= 2).map(([id]) => id));
    if (!target) return;
    if (s.inventory.weapons.pistol.magazine === 0 && s.inventory.weapons.pistol.reserve === 0) return;
    if (s.inventory.weapons.pistol.magazine === 0) {
      await padTap(1); await step(1.45);
    }
    await aimAt(target.position);
    await step(0.55, [0, 0, 0, 0], { 6: 1, 7: 1 });
    const after = await read();
    if (after.crew.find(e => e.id === target.id)?.health === s.crew.find(e => e.id === target.id)?.health) ineffective.set(target.id, (ineffective.get(target.id) || 0) + 1);
    else ineffective.set(target.id, 0);
    if (burst % 5 === 0) console.log(JSON.stringify({ combatBurst: burst, target: target.id, health: after.health, armor: after.armor, ammo: after.inventory.weapons.pistol, crew: after.crew.map(e => [e.id, e.health]) }));
  }
  throw new Error('Normal aimed fire did not resolve the visible encounter within 32 bursts.');
}

try {
  const titleNavigationStarted=Date.now();
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-action="newGame"]').waitFor({ state: 'visible', timeout: 90000 });
  report.titleReadyWallMs=Date.now()-titleNavigationStarted;
  assert.equal((await read()).screen, 'title', 'Route starts from the fresh title menu');
  await step(0.05);
  await menuSelect('openSettings');
  assert.equal((await read()).screen, 'settings');
  for (let i = 0; i < 2; i++) await padTap(15);
  assert.equal(await page.locator('#s-quality').inputValue(), 'low', 'D-pad changes picture quality');
  await menuSelect('openControls');
  await menuSelect('openControllerRebind');
  await menuSelect('rebind:interact');
  await padTap(2);
  assert.ok(await page.evaluate(() => window.__exitWounds.runtime.input.engine.map.interact.includes('Pad2')), 'Controller remapping accepted raw Square button');
  await menuSelect('resetBindings');
  assert.ok(await page.evaluate(() => window.__exitWounds.runtime.input.engine.map.interact.includes('Pad3')), 'Controller defaults restored');
  await menuSelect('controlsBack');
  await menuSelect('settingsBack');
  await note('00-controller-settings');
  await menuSelect('newGame');
  await page.locator('.hud').waitFor(); await note('01-new-game');
  assert.equal((await read()).inputDevice, 'gamepad');
  assert.equal((await read()).padMapping, 'standard');
  // Drive the starting sedan with proportional R2/L2 and left-stick steering.
  await route([[91, 322], [94, 322]]);
  await interact(); await step(1.05);
  assert.equal((await read()).vehicleId, 'mara-sedan', 'Triangle boards the starting sedan');
  const carBefore = (await read()).sedan.position;
  await step(1.6, [.32, 0, 0, 0], { 7: .7 });
  const carAfter = (await read()).sedan.position;
  report.analogDrive = { carBefore, carAfter };
  assert.ok(Math.hypot(carAfter.x - carBefore.x, carAfter.y - carBefore.y) > .45, 'Analog R2 moves the sedan');
  for (let i = 0; i < 16 && Math.abs((await read()).vehicleSpeed) >= .8; i++) await step(.25, [0, 0, 0, 0], { 6: 1, 5: 1 });
  await step(.2, [0, 0, 0, 0], { 6: 1, 5: 1 });
  await interact(); await step(1.05);
  assert.equal((await read()).vehicleId, null, 'Triangle exits the sedan');
  await note('01a-analog-driving');
  await route([[91, 323], [91, 307], [104.5, 307.5]]); await interact('COLLECTION'); await note('02-job-accepted');
  await padTap(12); assert.equal((await read()).screen, 'phone'); await menuSelect('phoneJob'); await menuSelect('closePhone');
  await step(0.05, [0, 0, 0, 0], { 4: 1 });
  assert.equal((await read()).screen, 'wheel');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
  await step(0.08, [0, 0, -.8, 0], { 4: 1 });
  assert.equal((await read()).focusIndex, 1, 'Right stick highlights the pistol segment');
  await step(0.05);
  assert.equal((await read()).inventory.equipped, 'pistol', 'L1 release selects the right-stick wheel choice');
  await step(0.05, [0, 0, 0, 0], { 0: 1 });
  await step(0.025, [0, 0, 0, 0], {}, false);
  assert.equal((await read()).screen, 'pause', 'Unplugging the emulated pad pauses the run');
  assert.equal(await page.evaluate(()=>document.body.classList.contains('has-controller')),false,'Disconnected pad removes the coarse-pointer controller HUD state');
  await step(0.05);
  assert.equal((await read()).screen, 'pause', 'Reconnecting requires a deliberate resume');
  assert.equal(await page.evaluate(()=>document.body.classList.contains('has-controller')),true,'Reconnected pad restores the controller HUD state');
  await menuSelect('resume'); await note('02a-hotplug-recovery');
  await route([[94, 307], [94, 278], [70, 270], [70, 214], [111.5, 216]]); await interact('APPROACH'); await note('03-bea-market');
  await route([[143, 216], [143, 223]]); await interact();
  assert.equal((await read()).armor, 100, 'Market armor purchase should be useful before combat.');
  await route([[143, 212], [249, 212], [349, 184], [348, 165.5]]);
  await aimAt((await read()).crew.find(e => e.id === 'crew-guard-gate').position);
  await interact('RECOVERY'); await note('04-gate-committed');
  await fightFromCurrentPosition(); await walk(348, 157.5); await fightFromCurrentPosition(); await note('05-gate-fight');
  await route([[310, 142], [310, 119]]); await fightFromCurrentPosition();
  await route([[310, 112], [312, 104], [319, 104.5]]); await interact();
  await walk(333, 103); await fightFromCurrentPosition();
  await walk(333, 90.5); await fightFromCurrentPosition(); await walk(332, 88); await interact();
  assert.equal(await page.evaluate(() => window.__exitWounds.state.mission.junReached), true, 'Jun must be reached through his actual E interaction.');
  await walk(324, 84); await interact('EXTRACTION'); await note('06-case-and-alarm');
  report.traceJun = true;
  await route([[333, 89], [333, 104], [312, 104], [310, 112], [310, 142], [348, 156], [348, 179], [348, 212]], { sprint: false });
  report.traceJun = false;
  for (let i = 0; i < 35; i++) { const s = await read(); if (s.phase !== 'EXTRACTION') break; await step(0.3); }
  await note('07-extracted');
  assert.ok(['EVASION', 'DECISION'].includes((await read()).phase), 'Jun must reach a valid physical extraction route.');
  await route([[249, 212], [249, 342], [272, 354]], { sprint: false });
  for (let i = 0; i < 100; i++) { if ((await read()).phase === 'DECISION') break; await step(0.25); }
  assert.equal((await read()).phase, 'DECISION'); await interact();
  await menuSelect(ending === 'broker' ? 'chooseBroker' : 'chooseReporter'); await note('08-destination-chosen');
  if (ending === 'reporter') await route([[267, 372], [380, 380], [381, 358], [383, 358]], { sprint: false });
  else await route([[249, 342], [249, 212], [249, 61], [108, 61], [108, 87], [94, 88]], { sprint: false });
  report.companionArrival = [];
  let companionNear = false;
  for (let i = 0; i < 120; i++) {
    const s = await read(), gap = Math.hypot(s.position.x - s.jun.position.x, s.position.y - s.jun.position.y);
    if (i % 8 === 0) report.companionArrival.push({ elapsed: s.elapsed, player: s.position, jun: s.jun.position, gap });
    if (gap < 8) { companionNear = true; break; }
    await step(0.25);
  }
  assert.equal(companionNear, true, 'Jun must physically reach the handoff; the completed safe flag is insufficient.');
  await interact('AFTERMATH'); await note('09-completed-handoff');
  const completed = await read(); assert.equal(completed.ending, ending); assert.equal(completed.completed, true);
  assert.equal(completed.wallet, ending === 'reporter' ? 620 : 1220);
  await menuSelect('openCredits');
  await page.locator('.source-info').waitFor(); await note('10-credits');
  const creditsScrollBefore=await page.locator('.screen--credits .panel-scroll').evaluate(el=>el.scrollTop);
  await step(.35,[0,0,0,.8]);
  const creditsScrollAfter=await page.locator('.screen--credits .panel-scroll').evaluate(el=>el.scrollTop);
  assert.ok(creditsScrollAfter>creditsScrollBefore,'Right stick scrolls credits and source information');
  report.creditsScroll={before:creditsScrollBefore,after:creditsScrollAfter};
  report.externalInputs = await page.evaluate(() => window.__qaExternalInputs);
  assert.ok(Object.values(report.externalInputs).every(count => count === 0), 'No trusted keyboard, mouse or touch commands entered the route');
  assert.deepEqual(report.errors, []); report.status = 'passed';
} catch (error) {
  report.status = 'blocked'; report.blocker = error.message; report.lastState = await read().catch(() => null);
  await page.screenshot({ path: `${output}/blocker.png` }).catch(() => {});
  console.error(error.stack); process.exitCode = 1;
} finally {
  report.sourceHashesAtFinish=await sourceHashes();
  report.sourceStable = JSON.stringify(report.sourceHashesAtFinish) === JSON.stringify(report.sourceHashes);
  if(report.status==='passed'&&!report.sourceStable){report.status='blocked';report.blocker='Source files changed during the controller run.';process.exitCode=1;}
  report.finishedAt = new Date().toISOString();
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(`Route ${report.status}; evidence: ${output}`);
  await context.close();
  await browser.close();
}
