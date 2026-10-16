// Emberdeep smoke test: loads every scene and a range of depths in a headless browser, lets each run for a few
// seconds with the autopilot fighting, screenshots it, and reports errors and frame times per page.
// Usage: node tools/ed-smoke.mjs [page.html] [--from 1] [--to 20] [--out dir] [--secs 6] [--character codex]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const file = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--'))) || 'examples/emberdeep.html';
const out = resolve(opt('out', 'check-output/smoke')), from = +opt('from', 1), to = +opt('to', 20), secs = +opt('secs', 6);
const character = opt('character', null);
if (character && !['wanderer', 'codex'].includes(character)) throw new Error('Unknown character: ' + character);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
const targets = ['title', 'town', 'gallery', 'proving', ...Array.from({ length: to - from + 1 }, (_, i) => 'depth-' + (from + i))];
let bad = 0;
for (const t of targets) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  page.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && /unknown (shape|material|pattern|part)/.test(m.text()))) errors.push(m.text()); });   // (a set dressing's name gone wrong warns)
  await page.goto(pathToFileURL(resolve(file)).href + (character ? '?character=' + character : '') + (t === 'title' ? '' : '#' + t));
  try { await page.waitForFunction(() => window.__ed && window.__ed.game, null, { timeout: 15000 }); } catch (e) { errors.push('never started'); }
  await page.waitForTimeout(1500);
  // let the autopilot fight on depths (invulnerable-ish), so combat, drops and mechanics all run
  if (t.startsWith('depth') || t === 'proving') await page.evaluate(() => { const E = window.__ed; E.DIFF.foeDmg = .1; E.ED.hero.level = Math.max(E.ED.hero.level, E.ED.depth * 2); E.bot(true); });
  await page.waitForTimeout(secs * 1000);
  await page.screenshot({ path: join(out, t + '.png') });
  const st = await page.evaluate(() => { const g = window.__ed.game, ED = window.__ed.ED; return { scene: g.sceneName, fps: g.fps, upd: +g.stats.updateMs.toFixed(1), draw: +g.stats.renderMs.toFixed(1), foes: ED.foes.length, name: ED.L && ED.L.name, mechs: ED.L && ED.L.mechs, errs: g.errors.map(e => e.where + ': ' + e.message).concat(ED.L ? sceneryErrs(ED.L) : []) };
    // the set dressing from the asset store (53-scenes.js): every planned depth lays out scenes, every shape it places is known
    function sceneryErrs(L) { const E = window.My3D2dge, out = [], miss = [...new Set(L.props.filter(p => p.shape && !E.SHAPES[p.shape]).map(p => p.shape))];
      if (miss.length) out.push('set dressing: unknown shapes ' + miss.join(', '));
      if (L.kind === 'level' && L.depth <= 15 && !(L.scenery || []).length) out.push('set dressing: no scenes laid out on depth ' + L.depth + ' (' + L.theme.id + ')');
      return out; } }).catch(e => ({ errs: [String(e)] }));
  const all = errors.concat(st.errs || []);
  if (all.length) bad++;
  console.log((all.length ? 'FAIL ' : 'ok   ') + t.padEnd(9) + ' ' + JSON.stringify({ scene: st.scene, fps: st.fps, upd: st.upd, draw: st.draw, foes: st.foes, name: st.name, mechs: st.mechs }) + (all.length ? '\n       ' + [...new Set(all)].slice(0, 5).join('\n       ') : ''));
  await page.close();
}
await browser.close();
console.log(bad ? bad + ' page(s) with errors' : 'all pages clean', ' · screenshots in ' + out);
process.exit(bad ? 1 : 0);
