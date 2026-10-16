import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:net';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright';

const exec = promisify(execFile);
const output = process.env.EWA93_RELEASE_OUTPUT || `/tmp/ewa93-release-${Date.now()}`;
const engines = (process.env.EWA93_RELEASE_ENGINES || 'chromium,webkit,firefox').split(',');
let url = process.env.EWA93_RELEASE_URL;
let preview = null;
const records = [];
await mkdir(output, { recursive: true });
if (!url) {
  await exec(process.execPath, ['tools/build.mjs']);
  const port = await new Promise((resolve, reject) => {
    const probe = createServer(); probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => { const assigned = probe.address().port; probe.close(() => resolve(assigned)); });
  });
  url = `http://127.0.0.1:${port}`;
  preview = spawn(process.execPath, ['tools/serve.mjs', '--root', 'dist', '--host', '127.0.0.1', '--port', String(port)], { stdio: 'ignore' });
  let ready = false;
  for (let i = 0; i < 40; i++) {
    await new Promise(resolve => setTimeout(resolve, 100));
    try { await fetch(url, { signal: AbortSignal.timeout(500) }); ready = true; break; } catch { /* Preview starting. */ }
  }
  if (!ready) { preview.kill(); throw new Error('Packaged preview did not start.'); }
}

for (const name of engines) await test(`${name}: stripped packaged release boots, moves, and opens menus using only public UI`, { timeout: 180000 }, async () => {
  const browser = await ({ chromium, webkit, firefox }[name]).launch({ headless: true, args: name === 'chromium' ? ['--enable-unsafe-swiftshader'] : [] });
  const page = await browser.newPage({ viewport: { width: 960, height: 600 }, reducedMotion: 'reduce' });
  const record = { engine: name, version: browser.version(), url, startedAt: new Date().toISOString(), status: 'running', errors: [], networkErrors: [], captures: [] };
  records.push(record);
  page.on('pageerror', error => record.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') record.errors.push(message.text()); });
  page.on('requestfailed', request => record.networkErrors.push({ url: request.url(), error: request.failure()?.errorText }));
  page.on('response', response => { if (response.status() >= 400) record.networkErrors.push({ url: response.url(), status: response.status() }); });
  const capture = async state => { const path = `${output}/${name}-${state}.png`; await page.screenshot({ path, timeout: 90000 }); record.captures.push(path); };
  try {
    const started = Date.now();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('.screen--title [data-action="newGame"]').waitFor({ state: 'visible', timeout: 90000 });
    record.titleReadyMs = Date.now() - started;
    assert.equal(await page.evaluate(() => '__exitWounds' in window), false, 'The packaged release must not expose the diagnostic hook.');
    await capture('title');
    await page.locator('[data-action="openSettings"]').click(); await page.locator('#s-quality').selectOption('low');
    await page.locator('[data-action="settingsBack"]').click(); await page.locator('[data-action="newGame"]').click();
    await page.locator('.hud #hud-objective').waitFor({ state: 'visible' });
    await page.waitForFunction(() => /eli.*call|meet him/i.test(document.querySelector('#hud-objective')?.textContent||''));
    assert.match(await page.locator('#hud-objective').innerText(), /eli/i);
    assert.equal(await page.locator('#hud-money').innerText(), '$80');
    assert.match(await page.locator('#hud-ammo').innerText(), /12\s*\/\s*48/);
    await page.waitForFunction(() => document.querySelector('#minimap')?.getContext('2d').getImageData(0, 0, 210, 210).data.some(value => value !== 0));
    const mapBefore = await page.locator('#minimap').evaluate(canvas => canvas.toDataURL());
    await capture('before-move');
    // The public minimap paints static roads/destination relative to Mara. With
    // no interaction or mission change, its change demonstrates actual movement.
    await page.keyboard.down('KeyD');
    try {
      await page.waitForFunction(before => document.querySelector('#minimap')?.toDataURL() !== before, mapBefore, { timeout: 45000 });
    } finally { await page.keyboard.up('KeyD'); }
    await capture('after-move');
    await page.keyboard.press('Escape'); await page.locator('.screen--pause [data-action="resume"]').waitFor();
    await page.locator('[data-action="openPhone"]').click(); await page.locator('.screen--phone').waitFor();
    const pendingCall=page.locator('[data-action="answerEliCall"], [data-action="returnEliCall"]').first();
    if(await pendingCall.count()){await pendingCall.click();await page.locator('.hud').waitFor();await page.keyboard.press('KeyT');}
    await page.locator('.screen--phone [data-action="phoneEli"]').waitFor();
    if(await page.locator('[data-action="returnEliCall"]').count()){
      await page.locator('[data-action="phoneMessages"]').click();assert.match(await page.locator('.screen--phone').innerText(), /collection job/i);
    }else{
      await page.locator('[data-action="phoneEli"]').click();assert.match(await page.locator('.screen--phone').innerText(), /toolbox/i);
    }
    await capture('phone'); await page.keyboard.press('Escape'); await page.locator('.hud').waitFor();
    await page.keyboard.press('Escape'); await page.locator('.screen--pause').waitFor();
    await page.locator('[data-action="openCredits"]').click(); await page.locator('.source-info').waitFor();
    assert.match(await page.locator('.source-info').innerText(), /GAME ENGINE: my-3d2dge 0\.46\.1/);
    await capture('credits');
    assert.equal(await page.evaluate(() => '__exitWounds' in window), false);
    assert.deepEqual(record.errors, []); assert.deepEqual(record.networkErrors, []);
    record.status = 'passed';
  } catch (error) {
    record.status = 'failed'; record.failure = error.message;
    record.visibleText = await page.locator('body').innerText().catch(() => 'unavailable');
    await capture('failure').catch(() => {}); throw error;
  } finally {
    record.finishedAt = new Date().toISOString();
    await writeFile(`${output}/report.json`, JSON.stringify({ output, records }, null, 2));
    console.log(`Release QA ${name}: ${record.status}; evidence: ${output}`);
    await browser.close();
  }
});
preview?.kill();
