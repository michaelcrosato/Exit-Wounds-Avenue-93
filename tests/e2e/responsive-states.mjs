/** Screenshots of actual normal-input gameplay/phone/pause at representative sizes. */
import { chromium, webkit } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const baseURL = process.env.EWA93_BASE_URL || 'http://127.0.0.1:5173';
const output = process.env.EWA93_LAYOUT_OUTPUT || `/tmp/ewa93-layout-${Date.now()}`;
const engines = (process.env.EWA93_ENGINES || 'chromium,webkit').split(',');
const sizes = [{ name: 'small-phone', width: 375, height: 667 }, { name: 'phone-landscape', width: 756, height: 352 }, { name: 'tablet', width: 768, height: 1024 }, { name: 'ultrawide', width: 2560, height: 1080 }];
const report = { baseURL, startedAt: new Date().toISOString(), records: [] };
await mkdir(output, { recursive: true });
async function readLayout(page) {
  return page.evaluate(() => {
    const subtitle = document.querySelector('.hud__subtitle');
    const rect = subtitle?.getBoundingClientRect();
    const overlaps = !rect?.width || !rect?.height ? [] : [...document.querySelectorAll('.minimap,.meters,.hud__right,.hud__objective')].filter(element => {
      const other = element.getBoundingClientRect();
      return Math.min(rect.right, other.right) - Math.max(rect.left, other.left) > 4 && Math.min(rect.bottom, other.bottom) - Math.max(rect.top, other.top) > 4;
    }).map(element => element.className);
    return {
    width: innerWidth, height: innerHeight, documentWidth: document.documentElement.scrollWidth,
    screen: window.__exitWounds.app.ui.screen, coarse: matchMedia('(pointer:coarse)').matches,
    horizontalOffenders: [...document.querySelectorAll('.hud__objective,.hud__subtitle,.hud__prompt,.hud__left,.hud__right,.hud__weapon,.hud__ammo,.minimap,.meters,.phone-item,.menu__button,.screen__inner')]
      .filter(element => getComputedStyle(element).display !== 'none').map(element => ({ tag: element.className, left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right }))
      .filter(rect => rect.left < -1 || rect.right > innerWidth + 1),
    subtitleOverlaps: overlaps,
  }; });
}
for (const name of engines) {
  const browser = await ({ chromium, webkit }[name]).launch({ headless: true, args: name === 'chromium' ? ['--enable-unsafe-swiftshader'] : [] });
  const page = await browser.newPage({ viewport: { width: 960, height: 600 }, reducedMotion: 'reduce' });
  const record = { engine: name, version: browser.version(), status: 'running', errors: [], issues: [], captures: [] };
  report.records.push(record); page.on('pageerror', error => record.errors.push(error.message));
  try {
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-action="newGame"]').waitFor({ state: 'visible', timeout: 90000 });
    await page.locator('[data-action="openSettings"]').click(); await page.locator('#s-quality').selectOption('low');
    await page.locator('[data-action="settingsBack"]').click(); await page.locator('[data-action="newGame"]').click();
    await page.waitForFunction(() => window.__exitWounds?.state?.tick > 12, null, { timeout: 90000 });
    for (const state of ['gameplay', 'pause', 'phone']) {
      if (state === 'pause') { await page.keyboard.press('Escape'); await page.locator('[data-action="resume"]').waitFor(); }
      if (state === 'phone') { await page.locator('[data-action="openPhone"]').click(); await page.locator('[data-action="phoneJob"]').waitFor(); }
      for (const size of sizes) {
        await page.setViewportSize({ width: size.width, height: size.height });
        await page.waitForTimeout(150);
        const path = `${output}/${name}-${size.name}-${state}.png`;
        // Screenshot synchronizes the rendered resize. Measuring immediately after
        // setViewportSize can observe a stale CSS media-query frame on SwiftShader.
        await page.screenshot({ path, timeout: 90000 });
        const layout = await readLayout(page); record.captures.push({ path, size, state, layout });
        if (layout.documentWidth > layout.width + 1 || layout.horizontalOffenders.length || layout.subtitleOverlaps.length) record.issues.push({ state, size, layout });
      }
    }
    assert.deepEqual(record.errors, []); assert.deepEqual(record.issues, [], 'Responsive UI geometry is clipped; inspect report captures.'); record.status = 'passed';
  } catch (error) { record.status = 'failed'; record.failure = error.message; process.exitCode = 1; }
  finally { await browser.close(); await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2)); }
}
console.log(`Responsive state evidence: ${output}`);
