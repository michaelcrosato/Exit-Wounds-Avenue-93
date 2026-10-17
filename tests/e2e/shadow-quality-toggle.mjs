/** Regression for r182 shadow-map disposal during the player's Quality setting changes. */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { SETTINGS_KEY } from '../../src/game/save.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const requestedBackend = process.env.EWA93_SHADOW_BACKEND || 'webgl';
const cdpURL = process.env.EWA93_SHADOW_CDP_URL || null;
const output = process.env.EWA93_SHADOW_OUTPUT || `/tmp/ewa93-shadow-quality-${Date.now()}`;
let baseURL = process.env.EWA93_SHADOW_BASE_URL || null;
let browser, server, sourceAtStart, sourceAtEnd;
const records = [];

assert.ok(['webgl', 'webgpu'].includes(requestedBackend), 'Select webgl or webgpu.');
async function sourceHashes() {
  const paths = ['src/main.js', 'src/engine/world.js',
    'vendor/my-3d2dge/engine/my-3d2dge-3d.js',
    'vendor/my-3d2dge/vendor/three-0.182.0/three.webgpu.min.js',
    'tests/e2e/shadow-quality-toggle.mjs'];
  return Object.fromEntries(await Promise.all(paths.map(async name => [name,
    createHash('sha256').update(await readFile(join(root, name))).digest('hex')])));
}
async function saveReport() {
  await writeFile(join(output, 'report.json'), JSON.stringify({
    kind: 'normal UI High/Low shadow-quality regression', requestedBackend,
    browserVersion: browser?.version(), baseURL, cdpURL: cdpURL || null,
    sourceAtStart, sourceAtEnd,
    sourceStable: sourceAtEnd ? JSON.stringify(sourceAtStart) === JSON.stringify(sourceAtEnd) : null,
    records,
  }, null, 2));
}
async function startServer() {
  const port = await new Promise((resolve, reject) => {
    const probe = createServer(); probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const number = probe.address().port; probe.close(() => resolve(number));
    });
  });
  server = spawn(process.execPath, ['tools/serve.mjs', '--host', '127.0.0.1', '--port', String(port)],
    { cwd: root, stdio: 'ignore' });
  baseURL = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { const response = await fetch(baseURL, { signal: AbortSignal.timeout(500) });
      if (response.ok) return; } catch { /* server starting */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Source preview failed to start.');
}
function snapshot(page, label) {
  return page.evaluate(label => {
    const app = window.__exitWounds.app, world = app.runtime.world;
    const lights = [world._sun, ...world._shadowLights].filter(Boolean);
    return {
      label, screen: app.ui.screen, appError: app.error?.message || null,
      backend: app.runtime.metadata.backend, quality: app.settings.quality,
      resolution: world.res, worldShadows: world.shadows,
      frames: world.stats.frames, drawCalls: world.stats.calls, tick: app.state?.tick ?? null,
      lights: lights.map((light, index) => ({
        kind: index === 0 ? 'sun' : 'torch', id: light.id,
        lightIntensity: light.intensity, castShadow: light.castShadow,
        shadowIntensity: light.shadow.intensity,
        autoUpdate: light.shadow.autoUpdate,
        needsUpdate: light.shadow.needsUpdate,
        mapPresent: !!light.shadow.map,
        updateMatricesCalls: window.__ewaShadowUpdates?.[light.id] || 0,
      })),
    };
  }, label);
}
async function instrument(page) {
  await page.evaluate(() => {
    const world = window.__exitWounds.app.runtime.world;
    window.__ewaShadowUpdates = {};
    for (const light of [world._sun, ...world._shadowLights].filter(Boolean)) {
      const shadow = light.shadow, original = shadow.updateMatrices;
      window.__ewaShadowUpdates[light.id] = 0;
      shadow.updateMatrices = function (...args) {
        window.__ewaShadowUpdates[light.id]++;
        return original.apply(this, args);
      };
    }
  });
}
async function assertQuality(s, quality, baselineSunIntensity) {
  assert.equal(s.quality, quality);
  assert.equal(s.resolution, quality === 'high' ? 'full' : 'balanced');
  assert.equal(s.worldShadows, true, 'Caster identity must stay stable across Quality changes.');
  const sun = s.lights[0]; assert.ok(sun, 'The authored sun must exist.');
  assert.equal(sun.castShadow, true, 'The authored sun remains a shadow caster.');
  assert.equal(sun.lightIntensity, baselineSunIntensity, 'Low must preserve direct illumination.');
  if (quality === 'low') {
    for (const light of s.lights) {
      assert.equal(light.shadowIntensity, 0, `${light.kind}: Low must suppress shadow attenuation.`);
      assert.equal(light.autoUpdate, false, `${light.kind}: Low must skip shadow-map updates.`);
      assert.equal(light.needsUpdate, false, `${light.kind}: Low must not queue an update.`);
    }
  } else {
    for (const light of s.lights) {
      assert.ok(light.shadowIntensity > 0, `${light.kind}: High restores shadow attenuation.`);
      assert.equal(light.autoUpdate, true, `${light.kind}: High restores shadow updates.`);
    }
  }
}
async function runScenario(name, initialQuality, sequence) {
  const record = { name, initialQuality, sequence, status: 'running', stages: [], errors: [], networkErrors: [],
    startedAt: new Date().toISOString() };
  records.push(record);
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  if (initialQuality === 'low') await context.addInitScript(({ key }) => {
    localStorage.setItem(key, JSON.stringify({ version: 1, settings: { quality: 'low' } }));
  }, { key: SETTINGS_KEY });
  const page = await context.newPage(); page.setDefaultTimeout(90000);
  page.on('pageerror', error => record.errors.push({ kind: 'page', message: error.message }));
  page.on('console', message => { if (message.type() === 'error')
    record.errors.push({ kind: 'console', message: message.text() }); });
  page.on('requestfailed', request => record.networkErrors.push({ url: request.url(), error: request.failure()?.errorText }));
  try {
    const url = new URL(baseURL);
    if (requestedBackend === 'webgl') url.searchParams.set('backend', 'webgl');
    await page.goto(url.href, { waitUntil: 'domcontentloaded' });
    await page.locator('.screen--title [data-action="newGame"]').waitFor({ timeout: 90000 });
    assert.equal(await page.evaluate(() => window.__exitWounds.runtime.metadata.backend),
      requestedBackend === 'webgpu' ? 'WebGPU' : 'WebGL 2', 'Requested renderer must actually be selected.');
    await instrument(page);
    await page.locator('[data-action="newGame"]').click(); await page.locator('.hud').waitFor();
    await page.waitForFunction(() => window.__exitWounds?.state?.tick > 3, null, { timeout: 30000 });
    const initial = await snapshot(page, 'initial'); record.stages.push(initial);
    const sunIntensity = initial.lights[0].lightIntensity;
    await assertQuality(initial, initialQuality, sunIntensity);
    for (const quality of sequence) {
      await page.keyboard.press('Escape');
      await page.locator('.screen--pause [data-action="openSettings"]').waitFor();
      await page.locator('.screen--pause [data-action="openSettings"]').click();
      await page.locator('#s-quality').selectOption(quality);
      await page.waitForFunction(q => window.__exitWounds.app.settings.quality === q, quality);
      const menu = await snapshot(page, `settings-${quality}`); record.stages.push(menu);
      await assertQuality(menu, quality, sunIntensity);
      await page.locator('[data-action="settingsBack"]').click();
      await page.locator('.screen--pause [data-action="resume"]').click();
      const before = await snapshot(page, `resume-${quality}`);
      await page.waitForFunction(({ frames, tick }) => {
        const app = window.__exitWounds?.app;
        return app?.runtime?.world?.stats?.frames >= frames + 2 && app?.state?.tick >= tick + 2;
      }, { frames: before.frames, tick: before.tick }, { timeout: 30000, polling: 250 });
      const after = await snapshot(page, `playing-${quality}`);
      after.frameDelta = after.frames - before.frames;
      after.tickDelta = after.tick - before.tick;
      record.stages.push(after);
      await assertQuality(after, quality, sunIntensity);
      for (let i = 0; i < after.lights.length; i++) {
        const updates = after.lights[i].updateMatricesCalls - before.lights[i].updateMatricesCalls;
        if (quality === 'low') assert.equal(updates, 0, 'Low must stop actual shadow matrix/render updates.');
        else if (after.lights[i].castShadow) assert.ok(updates > 0, 'High must resume actual shadow updates.');
      }
      assert.deepEqual(record.errors, [], 'No renderer or application console errors.');
      assert.deepEqual(record.networkErrors, [], 'No failed runtime resource requests.');
    }
    record.status = 'passed';
  } catch (error) {
    record.status = 'failed'; record.failure = error.stack || error.message;
    record.lastSnapshot = await snapshot(page, 'failure').catch(() => null);
    await page.screenshot({ path: join(output, `${name}-failure.png`), timeout: 45000 }).catch(() => {});
    throw error;
  } finally {
    record.finishedAt = new Date().toISOString(); await saveReport(); await context.close();
  }
}

before(async () => {
  await mkdir(output, { recursive: true }); sourceAtStart = await sourceHashes();
  if (!baseURL) await startServer();
  browser = cdpURL ? await chromium.connectOverCDP(cdpURL) :
    await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
});
after(async () => {
  sourceAtEnd = await sourceHashes(); await saveReport();
  await browser?.close(); server?.kill();
  assert.deepEqual(sourceAtEnd, sourceAtStart, 'Source changed during quality regression.');
});

test('normal Settings UI survives High→Low→High twice', { timeout: 300000 },
  () => runScenario('warm-high-two-cycles', 'high', ['low', 'high', 'low', 'high']));
test('cold Low profile restores High and switches back safely', { timeout: 300000 },
  () => runScenario('cold-low-to-high', 'low', ['high', 'low', 'high']));
