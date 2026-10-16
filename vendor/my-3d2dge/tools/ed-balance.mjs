// Balance run: the autopilot (src/emberdeep/93-autopilot.js) plays depth after depth with a character and with the
// Wanderer, and the two are compared depth by depth: time to clear, deaths, the level reached. The game is stepped by
// hand (no drawing, a clock that moves only with the steps) with seeded randomness, so a run is fast and comes out the
// same every time.
// A rough guide, not a verdict: the bot plays every hero with the same habits (skills say how through tags, kind and
// bot: { heal } in their specs), so a hero that needs a human's timing will look weaker than it is.
// Usage: node tools/ed-balance.mjs --character codex [--vs wanderer] [--to 5] [--seed 1] [--page examples/emberdeep.html]
// Exit code 1 if a run throws or stalls.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const opt = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const id = opt('character', null), vs = opt('vs', 'wanderer'), to = +opt('to', 5), seed = +opt('seed', 1);
if (!id) { console.error('Usage: node tools/ed-balance.mjs --character <id> [--vs wanderer] [--to 5] [--seed 1]'); process.exit(2); }
const url = pathToFileURL(resolve(opt('page', 'examples/emberdeep.html'))).href;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

async function play(who) {
  const page = await (await browser.newContext()).newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  // no real-time frames (the run is stepped by hand), a clock that moves only with the steps (slow motion, the death
  // panel and the performance governor read the clock), and seeded randomness: the same run every time
  await page.addInitScript(seed => {
    window.requestAnimationFrame = () => 0;
    let vt = 1000; Object.defineProperty(performance, 'now', { value: () => vt, configurable: true }); Date.now = () => 1.7e12 + vt;
    window.__step = n => { const g = My3D2dge.current; for (let i = 0; i < n; i++) { vt += 1000 / 120; g._step(1 / 120); if (window.__ed && !__ed.BOT_RUN.on && window.__ran) return; } };
    let r = seed >>> 0; Math.random = () => { r = (r + 0x6D2B79F5) >>> 0; let t = r; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }, seed);
  await page.goto(url + '?test=balance&character=' + who);
  await page.waitForFunction(() => window.__ed);
  const t0 = Date.now();
  await page.evaluate(to => { __step(30); __ed.botRun({ to, speed: 1 }); window.__ran = true; }, to);
  let state = null;
  for (let chunk = 0; chunk < 400; chunk++) {   // 30 game seconds a chunk, at most 200 game minutes
    state = await page.evaluate(() => {
      const g = __ed.game; __step(120 * 30);
      return { on: __ed.BOT_RUN.on, log: __ed.BOT_RUN.log, depth: __ed.ED.depth, errors: g.errors.slice(), level: __ed.ED.hero && __ed.ED.hero.level };
    });
    if (!state.on || state.errors.length) break;
  }
  await page.context().close();
  return { who, log: state.log, stalled: state.on, errors: errors.concat(state.errors), secs: (Date.now() - t0) / 1000, at: state.depth };
}

const [a, b] = [await play(id), await play(vs)];
await browser.close();
const pad = (s, n) => String(s).padEnd(n);
// the log has one line for each try at a depth (a death retries it): per depth, the time over every try, the deaths, the
// level when it was cleared
const byDepth = r => { const o = {}; for (const e of r.log) { const d = o[e.depth] || (o[e.depth] = { time: 0, deaths: 0, level: 0, cleared: false }); d.time += e.time; if (e.cleared) { d.cleared = true; d.level = e.level; } else d.deaths++; } return o; };
const A = byDepth(a), B = byDepth(b), depths = [...new Set(Object.keys(A).concat(Object.keys(B)))].map(Number).sort((x, y) => x - y);
console.log(`balance: ${id} against ${vs}, depths 1-${to} (the autopilot, seed ${seed})`);
console.log('  ' + pad('depth', 7) + pad(id + ': time', 16) + pad('level', 7) + pad('deaths', 8) + '| ' + pad(vs + ': time', 16) + pad('level', 7) + 'deaths');
const cell = e => !e ? pad('-', 31) : pad(e.time.toFixed(0) + ' s' + (e.cleared ? '' : ' (not cleared)'), 16) + pad(e.cleared ? e.level : '-', 7) + pad(e.deaths, 8);
for (const d of depths) console.log('  ' + pad(d, 7) + cell(A[d]) + '| ' + cell(B[d]));
const both = depths.filter(d => A[d] && A[d].cleared && B[d] && B[d].cleared), sum = (o, k) => both.reduce((t, d) => t + o[d][k], 0);
if (both.length) console.log(`  over the ${both.length} depth${both.length === 1 ? '' : 's'} both cleared: ${id} took ${(sum(A, 'time') / sum(B, 'time')).toFixed(2)}x the time and died ${sum(A, 'deaths')} time${sum(A, 'deaths') === 1 ? '' : 's'} (${vs}: ${sum(B, 'deaths')}); it reached level ${A[both[both.length - 1]].level} (${vs}: ${B[both[both.length - 1]].level})`);
let bad = false;
for (const r of [a, b]) {
  if (r.errors.length) { bad = true; console.log(`  ${r.who}: the game threw: ${[...new Set(r.errors)].join('; ')}`); }
  if (r.stalled) { bad = true; console.log(`  ${r.who}: the run stalled at depth ${r.at} (the bot could not finish it)`); }
}
console.log(`  (${a.secs.toFixed(0)} s and ${b.secs.toFixed(0)} s of real time)`);
process.exit(bad ? 1 : 0);
