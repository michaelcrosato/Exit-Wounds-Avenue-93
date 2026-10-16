// Emberdeep playtest driver: loads the game (optionally at a deep link), runs a script of inputs, takes
// screenshots, and reports errors and frame times. Made for agents working on src/emberdeep.
//
// Usage: node tools/ed-play.mjs [page.html] [--hash depth-3|town|proving] [--out dir] [--steps "<steps>"] [--god]
// Steps (space separated, or ' | ' separated when code needs spaces; run in order):
//   wait:600            wait 600 ms                     press:KeyE      tap a key (KeyboardEvent.code)
//   down:KeyD / up:KeyD hold / release a key            hold:KeyD:500   hold a key for 500 ms
//   click / rclick      tap the left / right mouse button at the current mouse position
//   mouse:640,360       move the mouse (page pixels; the page is 1280x720)
//   aim:dx,dy           point the mouse dx, dy page pixels from the screen center (around the hero)
//   aimfoe              point the mouse at the nearest living monster;  aimat:<js returning [x, y]> at a world point
//   shot:name           save a screenshot as <out>/<name>.png
//   eval:<js>           run JavaScript in the page (window.__ed has the game: ED, REG, UI, spawnMonster...)
//   evalfile:<path>     run a JavaScript file in the page
//   log:<js>            evaluate and print the result
// --god makes the hero very hard to kill (monster damage x0.05) so long scripts do not end in death.
// Exit code 1 if the page threw.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const file = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && !['--god'].includes(args[i - 1]))) || 'examples/emberdeep.html';
const out = resolve(opt('out', 'check-output/ed')), hash = opt('hash', '');
// steps are separated by spaces, or by ' | ' when the list contains that (so eval:/log: code may hold spaces)
const rawSteps = (opt('steps', 'wait:2500 shot:start') || '').trim(), steps = rawSteps.includes(' | ') ? rawSteps.split(' | ').map(s => s.trim()).filter(Boolean) : rawSteps.split(/\s+/);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], warns = [];
page.on('pageerror', e => errors.push(String(e && e.stack || e)));
page.on('console', m => { const t = m.text(); if (m.type() === 'error') errors.push(t); else if (m.type() === 'warning') warns.push(t); });
await page.goto(pathToFileURL(resolve(file)).href + (hash ? '#' + hash : ''));
try { await page.waitForFunction(() => window.__ed && window.__ed.game, null, { timeout: 60000 }); }
catch (e) { console.log('ed-play: the game never started.' + (errors.length ? '\n  ERRORS:\n    ' + errors.join('\n    ') : ' (no page errors: too slow?)')); await browser.close(); process.exit(1); }
if (args.includes('--god')) await page.evaluate(() => { window.__ed.DIFF.foeDmg = .05; });
let mx = 640, my = 360;
await page.mouse.move(mx, my);
for (const step of steps) {
  const [kind, ...rest] = step.split(':'), arg = rest.join(':');
  if (kind === 'wait') await page.waitForTimeout(+arg);
  else if (kind === 'press') { await page.keyboard.down(arg); await page.waitForTimeout(70); await page.keyboard.up(arg); }
  else if (kind === 'down') await page.keyboard.down(arg);
  else if (kind === 'up') await page.keyboard.up(arg);
  else if (kind === 'hold') { const [k, ms] = arg.split(':'); await page.keyboard.down(k); await page.waitForTimeout(+ms); await page.keyboard.up(k); }
  else if (kind === 'click' || kind === 'rclick') { const b = kind === 'click' ? 'left' : 'right'; await page.mouse.down({ button: b }); await page.waitForTimeout(60); await page.mouse.up({ button: b }); }
  else if (kind === 'mouse') { [mx, my] = arg.split(',').map(Number); await page.mouse.move(mx, my); }
  else if (kind === 'aim') { const [dx, dy] = arg.split(',').map(Number); mx = 640 + dx; my = 360 + dy; await page.mouse.move(mx, my); }
  else if (kind === 'aimat' || kind === 'aimfoe') {   // point the mouse at a world point (or at the nearest monster)
    const pt = await page.evaluate(code => {
      const { game, ED } = window.__ed, h = ED.hero; let w;
      if (code) w = (0, eval)(code); else { let best = null, bd = 1e9; for (const m of ED.foes) { const d = Math.hypot(m.x - h.x, m.y - h.y); if (m.alive && d < bd) { bd = d; best = m; } } w = best ? [best.x, best.y] : [h.x + 30, h.y]; }
      const sc = game.screen, p = game.view.p(w[0], w[1], 0), bx = p[0] - sc.ix - sc.fx, by = p[1] - sc.iy - sc.fy, rc = sc.canvas.getBoundingClientRect();
      return [rc.left + (bx * sc.S + sc.OX) / sc.dpr, rc.top + (by * sc.S + sc.OY) / sc.dpr];
    }, kind === 'aimat' ? arg : null);
    [mx, my] = pt; await page.mouse.move(mx, my);
  }
  else if (kind === 'shot') await page.screenshot({ path: join(out, arg + '.png') });
  else if (kind === 'eval') await page.evaluate(arg);
  else if (kind === 'evalfile') await page.evaluate(readFileSync(resolve(arg), 'utf8'));
  else if (kind === 'log') console.log('  log', arg.slice(0, 60), '=>', JSON.stringify(await page.evaluate(arg)));
  else console.warn('unknown step', step);
}
const st = await page.evaluate(() => { const g = window.__ed.game, ED = window.__ed.ED; return { scene: g.sceneName, fps: g.fps, updateMs: +g.stats.updateMs.toFixed(2), renderMs: +g.stats.renderMs.toFixed(2), items: g.stats.items, foes: ED.foes.length, depth: ED.depth, hp: ED.hero && Math.round(ED.hero.hp), lvl: ED.hero && ED.hero.level, errs: g.errors.map(e => e.where + ': ' + e.message) }; });
console.log('ed-play:', JSON.stringify(st));
const all = errors.concat(st.errs);
if (warns.length) console.log('  warnings:\n    ' + [...new Set(warns)].slice(0, 12).join('\n    '));
console.log(all.length ? '  ERRORS:\n    ' + all.join('\n    ') : '  no errors');
await browser.close();
process.exit(all.length ? 1 : 0);
