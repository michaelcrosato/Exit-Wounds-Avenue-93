// 2D stress test check (examples/stress-test.html, built from src/stress.template.html and src/stress.game.js): its
// cameras beyond the engine's named views. It serves the repo as Vercel does and opens /stress-test:
//   1. a ?cam= link opens the custom view at its turn, tilt and zoom, fixed in place
//   2. a fixed camera stays put while the hero walks, and F frees it
//   3. the side scrolling view
//   4. side scrolling with depth (Mode 7): drawn at the screen's own resolution, the crowd draws, the hero shrinks walking
//      into the hall and grows coming back, and the engine's pixel size comes back with depth off
//   5. the Shapes slider draws the engine's core shapes through the hall (more draw items, no error)
// Pictures in check-output/stress/. Usage: node tools/stress-test.mjs   (run node tools/build.mjs first; CHROMIUM_PATH
// picks a browser). Exit code 1 on failure.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';

const root = resolve('.');
const problems = [];
const fail = m => problems.push(m);

/* the page, served like Vercel (vercel.json's rewrites) */
const rules = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')).rewrites.map(r => ({
  re: new RegExp('^' + r.source.replace(/\./g, '\\.').replace(/:(\w+)\(([^)]+)\)/g, '(?<$1>$2)').replace(/:(\w+)(?![\w>])/g, '(?<$1>[^/]+)') + '$'),
  to: r.destination,
}));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json' };
const server = createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  for (const r of rules) { const m = path.match(r.re); if (m) { path = r.to.replace(/:(\w+)/g, (_, k) => m.groups[k]); break; } }
  const file = join(root, path);
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const SITE = 'http://127.0.0.1:' + server.address().port;
const OUT = join(root, 'check-output/stress'); mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

{
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto(SITE + '/stress-test?cam=300,20,1.25,8,1.2,520,410');
  await page.waitForFunction(() => window.__game && __game.game.stats.renderMs > 0, null, { timeout: 60000 }).catch(() => fail('stress-test: it did not start'));
  const s = await page.evaluate(() => ({ view: __game.game.view, fix: __game.FIX, zoom: __game.game.zoom }));
  if (!s.view.id.startsWith('custom') || s.view.yawDeg !== 300 || s.view.pitchDeg !== 20 || !s.fix.on || s.fix.x !== 520 || s.zoom !== 1.25) fail(`stress-test: the ?cam= link did not open its camera (${JSON.stringify({ id: s.view.id, yaw: s.view.yawDeg, pitch: s.view.pitchDeg, fix: s.fix, zoom: s.zoom })})`);
  await page.screenshot({ path: join(OUT, 'custom-fixed.png') });
  // fixed: the camera stays while the hero walks; freed, it follows him
  const c0 = await page.evaluate(() => [__game.game.cam.x, __game.game.cam.y]);
  await page.keyboard.down('KeyD'); await page.waitForTimeout(1000); await page.keyboard.up('KeyD');
  const c1 = await page.evaluate(() => [__game.game.cam.x, __game.game.cam.y]);
  if (Math.hypot(c1[0] - c0[0], c1[1] - c0[1]) > 1) fail('stress-test: a fixed camera moved with the hero');
  await page.keyboard.press('KeyF');
  if (await page.evaluate(() => __game.FIX.on)) fail('stress-test: F did not free the camera');
  await page.evaluate(() => document.querySelector('[data-view=side]').click());
  await page.waitForTimeout(400);
  if (await page.evaluate(() => __game.game.view.id) !== 'side') fail('stress-test: the side scrolling view did not take');
  await page.screenshot({ path: join(OUT, 'side.png') });
  // side scrolling with depth (Mode 7): it draws the crowd, and the hero shrinks walking into the hall and grows coming back
  const flatS = await page.evaluate(() => __game.game.screen.S);
  await page.evaluate(() => { __game.setDepth(true); __game.setMonsters(12, true); });
  await page.waitForTimeout(600);
  // the depth view draws at the screen's own resolution (sharp near and far, zoomed in or out); the pixel size returns after
  if (await page.evaluate(() => __game.game.screen.S) !== 1) fail('stress-test: the depth view does not draw at the screen\'s resolution');
  const drawn = await page.evaluate(() => +(document.getElementById('mMonsters').textContent.match(/\((\d+) drawn/) || [0, 0])[1]);
  if (!(drawn > 0)) fail(`stress-test: with depth, no monster was drawn`);
  await page.screenshot({ path: join(OUT, 'depth.png') });
  const size = () => page.evaluate(() => { const D = __game.DEPTH, p = D.pitch * Math.PI / 180; return 1 / ((D.y - __game.hero.y) * Math.cos(p) + D.h * Math.sin(p)); });
  const walk = async (code, sec) => { const t0 = await page.evaluate(() => __game.game.time); await page.keyboard.down(code); await page.waitForFunction(t => __game.game.time > t, t0 + sec, { timeout: 60000 }).catch(() => {}); await page.keyboard.up(code); await page.waitForTimeout(500); };
  await page.evaluate(() => __game.setMonsters(0));
  const s0 = await size(); await walk('KeyW', 1.5); const s1 = await size(); await walk('KeyS', 3); const s2 = await size();
  if (!(s1 < s0 * .85 && s2 > s1 * 1.4)) fail(`stress-test: with depth the hero did not shrink and grow (${[s0, s1, s2].map(v => (v * 1000).toFixed(2)).join(', ')})`);
  await page.evaluate(() => __game.setDepth(false)); await page.waitForTimeout(300);
  if (await page.evaluate(() => __game.game.screen.S) !== flatS) fail('stress-test: the engine\'s pixel size did not come back with depth off');
  // 5. the Shapes slider: the engine's core shapes strewn through the hall, drawn in its views (0 by default)
  await page.evaluate(() => document.querySelector('[data-view=iso]').click()); await page.waitForTimeout(400);
  const items = () => page.evaluate(() => +document.getElementById('mItems').textContent.replace(/\D/g, '') || 0);
  const before = await items();
  await page.evaluate(() => { const el = document.getElementById('shapes'); if (el) { el.value = 400; el.dispatchEvent(new Event('input')); } });
  await page.waitForTimeout(1200);
  const after = await items(), n = await page.evaluate(() => __game.S.shapes);
  await page.screenshot({ path: join(OUT, 'shapes.png') });
  if (n !== 400 || after < before + 8) fail(`stress-test: the Shapes slider at 400 drew ${after - before} more items (${before} to ${after}); its shapes do not show`);
  await page.evaluate(() => { const el = document.getElementById('shapes'); if (el) { el.value = 0; el.dispatchEvent(new Event('input')); } });
  for (const e of errors) fail(`stress-test: ${e}`);
  await page.close();
}
await browser.close();
server.close();
if (problems.length) { console.error('stress test check FAILED:\n  ' + problems.join('\n  ')); process.exit(1); }
console.log('stress test check passed: a ?cam= link, a fixed camera, side scrolling, side scrolling with depth (the hero shrinks and grows), and the Shapes slider; pictures in check-output/stress/');
