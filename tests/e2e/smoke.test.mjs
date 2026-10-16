import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { chromium, firefox, webkit } from 'playwright';

const baseURL = process.env.EWA93_BASE_URL || 'http://127.0.0.1:5173';
const output = process.env.EWA93_QA_OUTPUT || `/tmp/ewa93-e2e-${new Date().toISOString().replaceAll(':', '-')}`;
const engines = (process.env.EWA93_ENGINES || 'chromium,webkit').split(',');
const records = [];
let ownedServer = null;

// A fresh `npm run test:e2e` can run without a manually started server. An explicit
// EWA93_BASE_URL targets an existing source or packaged server instead.
try { await fetch(baseURL, { signal: AbortSignal.timeout(1500) }); }
catch (error) {
  if (process.env.EWA93_BASE_URL) throw new Error(`EWA93_BASE_URL is unavailable: ${baseURL}`, { cause: error });
  ownedServer = spawn(process.execPath, ['tools/serve.mjs', '--host', '127.0.0.1', '--port', '5173'], { stdio: 'ignore' });
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 100));
    try { await fetch(baseURL, { signal: AbortSignal.timeout(500) }); ready = true; break; } catch { /* Server starting. */ }
  }
  if (!ready) { ownedServer.kill(); throw new Error('The E2E development server did not start.'); }
}

/** Read semantic diagnostics only. This suite never calls app methods or changes game state. */
async function snapshot(page) {
  return page.evaluate(() => {
    const app = window.__exitWounds?.app, s = window.__exitWounds?.state;
    return {
      screen: app?.ui.screen, error: app?.error?.message,
      tick: s?.tick, elapsed: s?.elapsed, runId: s?.runId, phase: s?.mission.phase,
      checkpointId: s?.mission.checkpointId, position: s?.player.position,
      health: s?.player.health, wallet: s?.player.wallet, case: s?.player.inventory.case,
      pistol: s?.player.inventory.weapons.pistol, favor: s?.mission.favor,
      metadata: window.__exitWounds?.runtime?.metadata,
    };
  });
}
async function screen(page, name) {
  await page.waitForFunction(expected => window.__exitWounds?.app?.ui.screen === expected, name, { timeout: 90000 });
}
async function waitTicks(page, amount = 12) {
  const initial = (await snapshot(page)).tick;
  await page.waitForFunction(tick => window.__exitWounds?.state?.tick >= tick, initial + amount, { timeout: 60000 });
}
async function capture(page, engine, name) {
  const path = `${output}/${engine}-${name}.png`;
  await page.screenshot({ path, timeout: 90000 });
  return path;
}
async function noHorizontalOverflow(page) {
  const widths = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  assert.ok(widths.document <= widths.viewport + 1 && widths.body <= widths.viewport + 1, `horizontal overflow: ${JSON.stringify(widths)}`);
}
async function walkAxis(page, axis, coordinate, key) {
  const initial = (await snapshot(page)).position[axis], increasing = coordinate > initial;
  await page.keyboard.down(key);
  try {
    await page.waitForFunction(({ axis, coordinate, increasing }) => {
      const s = window.__exitWounds?.state;
      if (!s || s.mission.failure) return false;
      return increasing ? s.player.position[axis] >= coordinate : s.player.position[axis] <= coordinate;
    }, { axis, coordinate, increasing }, { timeout: 120000 });
  } finally { await page.keyboard.up(key); }
}

await mkdir(output, { recursive: true });
for (const engine of engines) {
  const type = { chromium, firefox, webkit }[engine];
  if (!type) throw new Error(`Unsupported EWA93_ENGINES entry: ${engine}`);
  await test(`${engine}: normal keyboard/menu traversal, job acceptance and actual reload`, { timeout: 600000 }, async () => {
    const browser = await type.launch({ headless: true, args: engine === 'chromium' ? ['--enable-unsafe-swiftshader'] : [] });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    const errors = [], failedRequests = [], captures = [];
    const record = { engine, scenario: 'opening-storage', browserVersion: browser.version(), baseURL, startedAt: new Date().toISOString(), status: 'running', errors, failedRequests, captures, checkpoints: [] };
    records.push(record);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('requestfailed', request => failedRequests.push({ url: request.url(), failure: request.failure()?.errorText }));
    try {
      const start = Date.now();
      await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
      await screen(page, 'title');
      record.titleReadyMs = Date.now() - start;
      assert.equal(await page.locator('[data-action="continue"]').isDisabled(), true);
      await noHorizontalOverflow(page);
      captures.push(await capture(page, engine, 'title'));

      // All setting changes travel through the ordinary UI. Arrow navigation must
      // reach editable settings and left/right must modify their actual value.
      await page.locator('[data-action="openSettings"]').click();
      await screen(page, 'settings');
      await page.waitForFunction(() => document.activeElement?.id === 's-quality');
      assert.equal(await page.locator('#s-quality').inputValue(), 'high');
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.locator('#s-quality').inputValue(), 'medium');
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.locator('#s-quality').inputValue(), 'low');
      await page.keyboard.press('ArrowDown');
      assert.equal(await page.evaluate(() => document.activeElement?.id), 's-brightness');
      const brightness = Number(await page.locator('#s-brightness').inputValue());
      await page.keyboard.press('ArrowLeft');
      assert.ok(Number(await page.locator('#s-brightness').inputValue()) < brightness);
      captures.push(await capture(page, engine, 'settings'));
      await page.keyboard.press('Escape');
      await screen(page, 'title');

      // Regress B01: Enter in the title must start play and be consumed by the menu.
      await page.keyboard.press('Enter');
      await screen(page, 'playing');
      await waitTicks(page);
      const fresh = await snapshot(page);
      assert.equal(fresh.phase, 'INTRO'); assert.equal(fresh.wallet, 80); assert.equal(fresh.health, 100);
      record.checkpoints.push({ name: 'fresh-play', ...fresh });
      captures.push(await capture(page, engine, 'gameplay'));
      await walkAxis(page, 'x', fresh.position.x + 1, 'KeyD');
      assert.ok((await snapshot(page)).position.x > fresh.position.x + 0.8);

      await page.keyboard.press('Escape'); await screen(page, 'pause');
      const pausedTick = (await snapshot(page)).tick;
      await page.waitForTimeout(500);
      assert.equal((await snapshot(page)).tick, pausedTick);
      captures.push(await capture(page, engine, 'pause'));

      // At a compact viewport, a focused lower menu item must scroll into view.
      await page.setViewportSize({ width: 960, height: 600 });
      await page.keyboard.press('ArrowUp');
      const focusRect = await page.evaluate(() => {
        const r = document.activeElement.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, height: innerHeight, text: document.activeElement.textContent };
      });
      assert.ok(focusRect.top >= 0 && focusRect.bottom <= focusRect.height + 1, `focused menu item clipped: ${JSON.stringify(focusRect)}`);
      captures.push(await capture(page, engine, 'compact-pause'));
      await noHorizontalOverflow(page);
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.locator('[data-action="openPhone"]').click(); await screen(page, 'phone');
      // The new opening call presents Answer/Decline first. Decline through the
      // visible phone UI, then inspect the regular contacts before meeting Eli.
      if(await page.locator('[data-action="declineEliCall"]').isVisible()){
        await page.locator('[data-action="declineEliCall"]').click();await screen(page,'playing');
        await page.keyboard.press('Escape');await screen(page,'pause');
        await page.locator('[data-action="openPhone"]').click();await screen(page,'phone');
      }
      await page.locator('[data-action="phoneBea"]').click();
      assert.match(await page.locator('body').innerText(), /market/i);
      await page.locator('[data-action="phoneMessages"]').click();
      assert.match(await page.locator('body').innerText(), /collection job/i);
      captures.push(await capture(page, engine, 'phone'));
      await page.keyboard.press('Escape'); await screen(page, 'playing'); await waitTicks(page);

      // Real keyboard locomotion and E interaction; no teleport/event injection.
      await walkAxis(page, 'y', 308, 'KeyW');
      await walkAxis(page, 'x', 104.5, 'KeyD');
      await page.keyboard.press('KeyE');
      await page.waitForFunction(() => window.__exitWounds?.state?.mission.phase === 'COLLECTION', null, { timeout: 15000 });
      await waitTicks(page);
      const accepted = await snapshot(page);
      assert.equal(accepted.checkpointId, 'job-accepted');
      record.checkpoints.push({ name: 'job-accepted', ...accepted });
      captures.push(await capture(page, engine, 'job-accepted'));
      await page.keyboard.press('KeyT');await screen(page,'phone');
      await page.locator('[data-action="phoneEli"]').click();
      assert.match(await page.locator('body').innerText(), /toolbox/i);
      await page.keyboard.press('Escape');await screen(page,'playing');
      await page.keyboard.press('Escape'); await screen(page, 'pause');

      // Actual browser reload and Continue must restore logical state and physics.
      await page.reload({ waitUntil: 'domcontentloaded' }); await screen(page, 'title');
      assert.equal(await page.locator('[data-action="continue"]').isDisabled(), false);
      await page.keyboard.press('Enter'); await screen(page, 'playing'); await waitTicks(page);
      const restored = await snapshot(page);
      assert.equal(restored.runId, accepted.runId); assert.equal(restored.phase, 'COLLECTION');
      assert.equal(restored.wallet, 80); assert.equal(restored.pistol.magazine, 12); assert.equal(restored.pistol.reserve, 48);
      assert.equal(restored.case, false);
      assert.ok(Math.hypot(restored.position.x - accepted.position.x, restored.position.y - accepted.position.y) < 1);
      record.checkpoints.push({ name: 'reloaded-job', ...restored });

      await page.keyboard.press('Escape'); await screen(page, 'pause');
      await page.locator('[data-action="openCredits"]').click(); await screen(page, 'credits');
      assert.match(await page.locator('.source-info').innerText(), /GAME ENGINE: my-3d2dge 0\.46\.1/);
      captures.push(await capture(page, engine, 'credits'));

      // Fault injection changes storage bytes only. It never advances an objective
      // or supplies a mission snapshot. Recover through the user-facing choice.
      const backup = await page.evaluate(() => {
        const raw = localStorage.getItem('exit-wounds-avenue-93.save.v1.backup');
        const state = raw ? JSON.parse(raw).state : null;
        localStorage.setItem('exit-wounds-avenue-93.save.v1', '{deliberately-corrupt');
        return state ? { runId: state.runId, phase: state.mission.phase, wallet: state.player.wallet } : null;
      });
      assert.ok(backup, 'A previous-good checkpoint must exist before corruption.');
      await page.reload({ waitUntil: 'domcontentloaded' }); await screen(page, 'title');
      assert.equal(await page.locator('[data-action="continue"]').isDisabled(), false, 'Valid backup must be accessible.');
      assert.match(await page.locator('[data-action="continue"]').innerText(), /recover/i);
      await page.locator('[data-action="continue"]').click(); await screen(page, 'error');
      assert.match(await page.locator('body').innerText(), /previous good checkpoint/i);
      assert.equal(await page.evaluate(() => localStorage.getItem('exit-wounds-avenue-93.save.v1')), '{deliberately-corrupt', 'Do not erase corruption before a user chooses recovery.');
      captures.push(await capture(page, engine, 'save-recovery'));
      await page.locator('[data-action="retryError"]').click(); await screen(page, 'playing'); await waitTicks(page);
      const recovered = await snapshot(page);
      assert.equal(recovered.runId, backup.runId); assert.equal(recovered.phase, backup.phase); assert.equal(recovered.wallet, backup.wallet);
      record.checkpoints.push({ name: 'backup-recovered', ...recovered });
      await page.reload({ waitUntil: 'domcontentloaded' }); await screen(page, 'title');
      assert.match(await page.locator('[data-action="continue"]').innerText(), /continue/i, 'Explicit recovery must promote the valid backup so future checkpoints can save.');
      await page.locator('[data-action="newGame"]').click(); await screen(page, 'confirm');
      await page.locator('[data-action="confirmNo"]').click(); await screen(page, 'title');
      assert.equal(await page.locator('[data-action="continue"]').isDisabled(), false, 'Cancel New Game preserves saved progress.');
      assert.deepEqual(errors, [], `browser errors: ${errors.join('\n')}`);
      assert.deepEqual(failedRequests, [], 'Runtime assets must load from the local server.');
      record.status = 'passed';
    } catch (error) {
      record.status = 'failed'; record.failure = error.message;
      record.lastState = await snapshot(page).catch(() => null);
      captures.push(await capture(page, engine, 'failure').catch(() => 'screenshot unavailable'));
      throw error;
    } finally {
      record.finishedAt = new Date().toISOString();
      await writeFile(`${output}/report.json`, JSON.stringify({ output, records }, null, 2));
      console.log(`QA ${engine}: ${record.status}; evidence: ${output}`);
      await browser.close();
    }
  });
}

await test('webkit: a required animation load failure has a recoverable UI and reload starts normally', { timeout: 180000 }, async () => {
  const browser = await webkit.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  const record = { engine: 'webkit', scenario: 'asset-failure', browserVersion: browser.version(), baseURL, startedAt: new Date().toISOString(), status: 'running', captures: [], pageErrors: [] };
  records.push(record);
  page.on('pageerror', error => record.pageErrors.push(error.message));
  const requiredAsset = '**/assets/animation/urban.js';
  let intercepted = false;
  try {
    await page.route(requiredAsset, route => { intercepted = true; return route.abort('failed'); });
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
    await screen(page, 'error');
    assert.equal(intercepted, true, 'The fixture must block the required selected animation set.');
    assert.match(await page.locator('body').innerText(), /Animation resource could not load:.*animation\/urban\.js/i);
    assert.equal(await page.locator('[data-action="retryError"]').isVisible(), true);
    record.captures.push(await capture(page, 'webkit', 'asset-failure'));
    await page.unroute(requiredAsset);
    await page.reload({ waitUntil: 'domcontentloaded' }); await screen(page, 'title');
    await page.locator('[data-action="newGame"]').click(); await screen(page, 'playing'); await waitTicks(page);
    const restored = await snapshot(page);
    assert.equal(restored.phase, 'INTRO'); assert.equal(restored.health, 100);
    record.captures.push(await capture(page, 'webkit', 'asset-recovered'));
    assert.deepEqual(record.pageErrors, [], 'A required-asset error must be caught by the recoverable UI.');
    record.status = 'passed';
  } catch (error) {
    record.status = 'failed'; record.failure = error.message;
    record.lastState = await snapshot(page).catch(() => null);
    record.captures.push(await capture(page, 'webkit', 'asset-recovery-failed').catch(() => 'screenshot unavailable'));
    throw error;
  } finally {
    record.finishedAt = new Date().toISOString();
    await writeFile(`${output}/report.json`, JSON.stringify({ output, records }, null, 2));
    console.log(`QA asset failure: ${record.status}; evidence: ${output}`);
    await browser.close();
  }
});
ownedServer?.kill();
