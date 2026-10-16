// Emberdeep's set dressing from the asset store (src/emberdeep/53-scenes.js, the town's details in 56-town.js; the page's
// set src/assets/sets/emberdeep.js): every planned depth lays out scenes, every shape a level places is known and no name
// warns, the scenes move nothing (they are laid out after the level's build, none inside it, and the level's own props
// and packs are those a fresh build of the same seed makes), and the town's details stand.
// Usage: node tools/ed-scenes-test.mjs [page.html]   (run node tools/build.mjs first; CHROMIUM_PATH picks a browser).
// Exit code 1 on a failure.
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const page0 = process.argv[2] || 'examples/emberdeep.html', fails = [];
const fail = m => { fails.push(m); console.log('✗ ' + m); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } }), warns = [];
page.on('pageerror', e => warns.push('page error: ' + e.message));
page.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && /unknown (shape|material|pattern|part)|already there/.test(m.text()))) warns.push(m.text()); });
await page.goto(pathToFileURL(resolve(page0)).href + '#town');
await page.waitForFunction(() => window.__ed && window.__ed.ED.L && window.__ed.ED.L.things, null, { timeout: 30000 });
await page.waitForTimeout(800);
const town = await page.evaluate(() => window.__ed.ED.L.things.filter(t => t.kind === 'detail').length);
if (town < 20) fail(`the town: ${town} details from the store (the garden's crops, graves, the yards' pieces), not 20 or more`);
const rows = [];
for (let d = 1; d <= 15; d++) {
  const r = await page.evaluate(async d => {
    const e = window.__ed, E = window.My3D2dge; e.descend(d);
    for (let k = 0; k < 40 && !(e.ED.L && e.ED.L.depth === d && e.ED.L._scn); k++) await new Promise(f => setTimeout(f, 50));
    const L = e.ED.L; if (!L || L.depth !== d) return { d, error: 'never reached' };
    // a fresh build of the same seed: the level as it stands without scenes (and without its levelStart listeners)
    const F = e.buildLevel(L.rec), same = F.props.every((p, i) => L.props[i] && L.props[i].x === p.x && L.props[i].y === p.y && L.props[i].name === p.name)
      && F.packs.length === L.packs.length && F.packs.every((p, i) => p.x === L.packs[i].x && p.y === L.packs[i].y);
    // (scn marks the scenes' records: none in the build itself, so they come after everything the level placed)
    return { d, theme: L.theme.id, scenes: (L.scenery || []).length, parts: L.props.filter(p => p.scn).length, same, inBuild: F.props.filter(p => p.scn).length, unknown: [...new Set(L.props.filter(p => p.shape && !E.SHAPES[p.shape]).map(p => p.shape))] };
  }, d);
  rows.push(r);
  if (r.error) { fail(`depth ${d}: ${r.error}`); continue; }
  if (!r.scenes) fail(`depth ${d} (${r.theme}): no scenes laid out`);
  if (r.unknown.length) fail(`depth ${d} (${r.theme}): unknown shapes ${r.unknown.join(', ')}`);
  if (r.inBuild) fail(`depth ${d} (${r.theme}): ${r.inBuild} of the scenes' pieces are laid out inside the level's build, where the mechanics space their things from them`);
  if (!r.same) fail(`depth ${d} (${r.theme}): the level's own props or packs differ from a fresh build of its seed: the scenes moved something`);
}
for (const w of [...new Set(warns)]) fail('the page warned: ' + w);
await browser.close();
console.log(rows.map(r => `depth ${r.d} ${r.theme}: ${r.scenes} scenes, ${r.parts} pieces`).join('; '));
console.log(fails.length ? `\nFAILED ${fails.length}` : `\nall passed: the town's ${town} details; scenes on every planned depth, every shape known, the levels as their seeds build them`);
process.exit(fails.length ? 1 : 0);
