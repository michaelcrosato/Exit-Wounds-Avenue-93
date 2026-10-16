// Session recording and replay (engine section 23, tools/replay.mjs; docs/DECISIONS.md D12). Each case records a session
// in real time (the browser's own frame times, with their jitter, and real inputs from Playwright), saves it, replays it
// headless with tools/replay.mjs, and checks that the replay matched every checksum and ends in the same state:
//   1. Emberdeep at a desk: keys, mouse aim and clicks, a dodge, the bag, the wheel
//   2. Emberdeep on a phone (390 x 844 at 3x, a touch screen): the movement stick dragged, the action buttons tapped
//   3. a starter game (the brawler slice), which gives no stateHash: the engine's own checksum
//   4. the first session with one input taken out: the replay must say where it diverged
//   5. a session recorded in a browser whose own Math differs from Chromium's in the last bit (as an iPhone's Safari
//      may: every native sin, cos, pow... is nudged by one unit in the last place before the page loads) replays in
//      Chromium to the same state: while recording and replaying, the engine's portable math is used, not the browser's
// Usage: node tools/replay-test.mjs   (run node tools/build.mjs first; CHROMIUM_PATH picks a browser). Exit code 1 on failure.
// Sessions and pictures in check-output/replay-test/.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const out = resolve('check-output/replay-test'); mkdirSync(out, { recursive: true });
const failures = [], fail = m => { failures.push(m); console.log('  FAIL ' + m); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ED_PROBE = '[__ed.ED.hero.x, __ed.ED.hero.y, __ed.ED.hero.hp, __ed.ED.foes.length, __ed.ED.depth, My3D2dge.session.frame]';
const GAME_PROBE = '[My3D2dge.current.time, My3D2dge.current.cam.x, My3D2dge.current.cam.y, My3D2dge.current.sceneName, My3D2dge.session.frame]';

/** open a page with recording on, play it, then save the session and the state at that moment (between two frames) */
async function record(name, page, ctxOpts, play, probe, initScript) {
  const ctx = await browser.newContext(ctxOpts), p = await ctx.newPage(), errors = [];
  if (initScript) await p.addInitScript(initScript);
  p.on('pageerror', e => errors.push(String(e)));
  await p.goto(pathToFileURL(resolve(page.split(/[?#]/)[0])).href + page.slice(page.search(/[?#]|$/)));
  await p.waitForFunction(() => window.My3D2dge && My3D2dge.current && My3D2dge.session.recording, null, { timeout: 60000 });
  await play(p, ctx);
  const [state, json] = await p.evaluate(code => [JSON.stringify((0, eval)(code)), My3D2dge.session.save()], probe);
  await ctx.close();
  const file = join(out, name + '.json'); writeFileSync(file, json);
  const S = JSON.parse(json), dts = new Set(S.frames.slice(1).map((t, i) => Math.round((t - S.frames[i]) * 10)));
  console.log(`  recorded ${S.frames.length} frames (${dts.size} different frame times), ${S.events.length} inputs, ${(json.length / 1024).toFixed(0)} KB`);
  if (errors.length) fail(name + ': the page threw while recording: ' + errors[0]);
  if (S.events.length < 5) fail(name + ': too few inputs were recorded (' + S.events.length + ')');
  return { file, state, S };
}
/** replay a session file with tools/replay.mjs; returns its exit code, the probe it logged and its report */
function replay(file, probe, extra = []) {
  const r = spawnSync(process.execPath, ['tools/replay.mjs', file, '--log', probe, '--out', join(out, 'pictures'), ...extra], { encoding: 'utf8' });
  const text = (r.stdout || '') + (r.stderr || ''), m = text.match(/ = (\[.*\])\s*$/m);
  return { code: r.status, logged: m ? m[1] : null, text };
}
function check(name, rec, probe) {
  const r = replay(rec.file, probe);
  const line = (r.text.match(/^played .*$/m) || ['(no report)'])[0];
  console.log('  ' + line);
  if (r.code !== 0) fail(name + ': the replay failed:\n' + r.text);
  if (!/all matched/.test(line)) fail(name + ': not every checksum matched');
  if (r.logged !== rec.state) fail(`${name}: the replay ended in another state: ${r.logged} (recorded ${rec.state})`);
  else console.log('  ok   the same end state: ' + r.logged);
}

console.log('1. Emberdeep at a desk');
const desk = await record('emberdeep-desk', 'examples/emberdeep.html?record=1#depth-3', { viewport: { width: 960, height: 540 } }, async p => {
  await p.waitForFunction(() => window.__ed && __ed.game, null, { timeout: 60000 }); await p.waitForTimeout(2500);
  await p.mouse.move(600, 300);
  for (const [k, ms] of [['KeyD', 700], ['KeyS', 500], ['KeyW', 400]]) { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); }
  for (let i = 0; i < 4; i++) { await p.mouse.move(500 + i * 40, 280 + i * 20); await p.mouse.down(); await p.waitForTimeout(90); await p.mouse.up(); await p.waitForTimeout(250); }
  await p.keyboard.press('Space'); await p.waitForTimeout(400);
  await p.keyboard.press('KeyI'); await p.waitForTimeout(600); await p.keyboard.press('KeyI'); await p.waitForTimeout(300);
  await p.mouse.wheel(0, 120); await p.waitForTimeout(500);
  await p.keyboard.down('KeyA'); await p.waitForTimeout(600); await p.keyboard.up('KeyA'); await p.waitForTimeout(500);
}, ED_PROBE);
check('emberdeep-desk', desk, ED_PROBE);

console.log('2. Emberdeep on a phone (touch)');
const phone = await record('emberdeep-phone', 'examples/emberdeep.html?record=1#depth-3', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }, async (p, ctx) => {
  await p.waitForFunction(() => window.__ed && __ed.game && document.querySelector('.ed-touch-actions [data-act]'), null, { timeout: 60000 }); await p.waitForTimeout(2000);
  const cdp = await ctx.newCDPSession(p), touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const side = await p.evaluate(() => __ed.game.input.stickSide), sx = side === 'left' ? 90 : 300;
  await touch('touchStart', sx, 600);
  for (let i = 1; i <= 12; i++) { await touch('touchMove', sx + i * 4, 600 - i * 3); await p.waitForTimeout(60); }
  await p.waitForTimeout(500); await touch('touchEnd');
  const buttons = await p.evaluate(() => [...document.querySelectorAll('.ed-touch-actions [data-act]')].slice(0, 3).map(b => { const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }));
  for (const [x, y] of buttons) { await p.touchscreen.tap(x, y); await p.waitForTimeout(450); }
  await p.waitForTimeout(600);
}, ED_PROBE);
if (!phone.S.events.some(e => e[1] === 'pointerdown' && e[4] === 'touch')) fail('emberdeep-phone: no touch input was recorded');
check('emberdeep-phone', phone, ED_PROBE);

console.log('3. a starter game (brawler)');
const brawl = await record('brawler', 'dist/my-3d2dge.html?record=1#brawler', { viewport: { width: 800, height: 600 } }, async p => {
  await p.waitForTimeout(1500); await p.keyboard.press('Enter'); await p.waitForTimeout(900);
  await p.keyboard.down('ArrowRight'); await p.waitForTimeout(900); await p.keyboard.up('ArrowRight');
  for (let i = 0; i < 4; i++) { await p.keyboard.press('KeyJ'); await p.waitForTimeout(220); }
  await p.keyboard.press('KeyK'); await p.waitForTimeout(1200);
}, GAME_PROBE);
check('brawler', brawl, GAME_PROBE);

console.log('4. a session with one input taken out must diverge');
{
  const S = JSON.parse(JSON.stringify(desk.S)), i = S.events.findIndex(e => e[1] === 'keydown' && e[3] === 'KeyD');
  S.events.splice(i, 1); const file = join(out, 'emberdeep-desk-tampered.json'); writeFileSync(file, JSON.stringify(S));
  const r = replay(file, ED_PROBE), line = (r.text.match(/^played .*$/m) || ['(no report)'])[0];
  console.log('  ' + line);
  if (r.code === 0 || !/DIVERGED at frame \d+/.test(line)) fail('a session missing a key press replayed without diverging');
  else console.log('  ok   the replay found where it diverged');
}

console.log('5. recorded where the browser\'s own math differs, replayed in Chromium');
{
  const otherMath = () => {   // a browser whose libm rounds differently: one unit in the last place off, everywhere
    const F = new Float64Array(1), U = new BigUint64Array(F.buffer);
    for (const k of ['sin', 'cos', 'tan', 'atan', 'atan2', 'asin', 'acos', 'exp', 'log', 'log2', 'log10', 'pow', 'hypot', 'cbrt']) {
      const f = Math[k]; Math[k] = (...a) => { const v = f(...a); if (!isFinite(v) || v === 0) return v; F[0] = v; U[0] += 1n; return F[0]; };
    }
    window.__nudged = Math.sin(1) !== 0.8414709848078965;
  };
  const other = await record('emberdeep-other-math', 'examples/emberdeep.html?record=1#depth-3', { viewport: { width: 960, height: 540 } }, async p => {
    await p.waitForFunction(() => window.__ed && __ed.game, null, { timeout: 60000 });
    const ok = await p.evaluate(() => [window.__nudged, Math.sin === My3D2dge.session.math.sin, Math.pow === My3D2dge.session.math.pow]);
    if (!ok[0]) fail('the stand-in for another browser did not change its Math');
    if (!ok[1] || !ok[2]) fail('the recording does not use the engine\'s portable math');
    await p.waitForTimeout(2000); await p.mouse.move(620, 300);
    for (const [k, ms] of [['KeyD', 900], ['KeyW', 500]]) { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); }
    for (let i = 0; i < 5; i++) { await p.mouse.down(); await p.waitForTimeout(80); await p.mouse.up(); await p.waitForTimeout(300); }
    await p.keyboard.press('Space'); await p.waitForTimeout(1500);
  }, ED_PROBE, otherMath);
  check('emberdeep-other-math', other, ED_PROBE);
}

await browser.close();
console.log(failures.length ? failures.length + ' failure(s)' : 'all passed; sessions and pictures in ' + out);
process.exit(failures.length ? 1 : 0);
