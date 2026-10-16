// Labs check: the Labs page (examples/labs.html, built from src/labs.json) and the way back to it. It serves the repo the
// way Vercel does (vercel.json's rewrites), opens the Labs page at /labs and /labs.html, and opens every link on it: each
// must load (status 200) without a page error. As files on disk, every link must point at a file that exists. The list
// holds together: each next names a page on it, and each page of a line says when it was made. Each lab's
// "All labs" link and the game's Settings button (Keys & help) must reach the Labs page, and held upright on a phone every lab's
// picture must fill the screen with none of its buttons running off the edge (the Asset Lab, a page: nothing off its side). It fails (exit code 1) on any of these.
// Usage: node tools/labs-test.mjs        (run node tools/build.mjs first; CHROMIUM_PATH picks a browser)
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = resolve('.');
const problems = [];
const fail = m => problems.push(m);

/* a static server with vercel.json's rewrites: "/:page(a|b)" patterns, filled into the destination */
const rules = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')).rewrites.map(r => ({
  // (a group's own pattern, :file(.+), is kept as it is: only the dots outside groups are literal)
  re: new RegExp('^' + r.source.split(/(:\w+\([^)]+\))/).map((part, i) => i % 2 ? part.replace(/:(\w+)\(([^)]+)\)/, '(?<$1>$2)') : part.replace(/\./g, '\\.').replace(/:(\w+)(?![\w>])/g, '(?<$1>[^/]+)')).join('') + '$'),
  to: r.destination,
}));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
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

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
let errors = [];
page.on('pageerror', e => errors.push(String(e)));
const links = () => page.$$eval('#list a', as => as.map(a => a.href));

/* the Labs page on the site, at both its addresses: the same links, and each one loads without an error */
await page.goto(SITE + '/labs');
if (await page.textContent('h1') !== 'Labs') fail('/labs is not the Labs page');
const siteLinks = await links();
const sections = await page.$$eval('h2', hs => hs.map(h => h.textContent));
await page.goto(SITE + '/labs.html');
if (JSON.stringify(await links()) !== JSON.stringify(siteLinks)) fail('/labs.html links differ from /labs');
const labs = JSON.parse(readFileSync(join(root, 'src/labs.json'), 'utf8'));
for (const S of labs.sections) if (!sections.includes(S.title)) fail('section missing: ' + S.title);
// the list's own links: each next (the page a prototype led to) is on the list, and each page of a line says when it was made
const pages = new Set(labs.sections.flatMap(S => S.entries.map(L => L.page)));
for (const S of labs.sections) for (const L of S.entries) {
  if (L.next && !pages.has(L.next)) fail(`${L.title}: next is ${L.next}, not a page on the list`);
  if (S.line && !L.made) fail(`${L.title}: a page of the line "${S.title}" with no made`);
}
const want = labs.sections.reduce((n, S) => n + S.entries.reduce((m, L) => m + 1 + L.links.length, 0), 0);
if (siteLinks.length !== want) fail(`the Labs page shows ${siteLinks.length} links, src/labs.json has ${want}`);
let opened = 0;
for (const href of [...new Set(siteLinks)]) {
  await page.goto('about:blank');   // a fresh load each time (a link that only changes the #part would not reload)
  errors = [];
  const r = await page.goto(href);
  if (!r || r.status() !== 200) { fail(`${href.replace(SITE, '')}: status ${r && r.status()}`); continue; }
  await page.waitForTimeout(400);
  for (const e of errors) fail(`${href.replace(SITE, '')}: page error: ${e}`);
  opened++;
}

/* the Labs page as files: every link points at a file that exists */
await page.goto(pathToFileURL(join(root, 'examples/labs.html')).href);
const fileLinks = await links();
if (fileLinks.length !== siteLinks.length) fail('the file copy of the Labs page has a different number of links');
for (const href of fileLinks) {
  const f = fileURLToPath(href.replace(/[?#].*$/, ''));
  if (!existsSync(f)) fail('file link to a missing file: ' + f.replace(root, '.'));
}

/* the handoff package for coding agents (dist/handoff/) is served at /handoff/ */
for (const path of ['/handoff/', '/handoff/README.md', '/handoff/game/index.html', '/handoff/tools/check.mjs']) {
  const r = await fetch(SITE + path); if (r.status !== 200) fail(`${path} gave ${r.status}, not the handoff package's file`);
}

/* the way back: each lab's "All labs" link, and the game's Settings (Keys & help) */
for (const lab of ['mocap-lab', 'asset-lab', 'perspective-lab', 'stress-test', 'arena']) {
  await page.goto(SITE + '/' + lab);
  const a = page.locator('a.to-labs');
  if (await a.count() !== 1) { fail(lab + ': no All labs link'); continue; }
  await Promise.all([page.waitForURL(/\/labs\.html$/), a.click()]);
  if (await page.textContent('h1') !== 'Labs') fail(lab + ': All labs did not open the Labs page');
}
await page.goto(SITE + '/');
await page.waitForFunction(() => window.__ed && __ed.UI);
await page.evaluate(() => __ed.UI.open('settings', { tab: 'help' }));
await Promise.all([page.waitForURL(/\/labs\.html$/), page.getByRole('button', { name: 'All labs ↗' }).click()]);
if (await page.textContent('h1') !== 'Labs') fail('the Settings button did not open the Labs page');

/* held upright on a phone, every lab's picture fills the screen (the engine's portrait sizing) */
const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
for (const lab of ['mocap-lab', 'perspective-lab', 'stress-test', 'arena']) {
  await phone.goto(SITE + '/' + lab);
  await phone.waitForTimeout(500);
  const fills = await phone.evaluate(() => { const sc = (window.__mocap || window.__game).game.screen; return sc.W * sc.S >= sc.canvas.width - sc.S && sc.H * sc.S >= sc.canvas.height - sc.S; });
  if (!fills) fail(lab + ': the picture does not fill an upright phone');
  const cut = await phone.evaluate(() => [...document.querySelectorAll('.controls button, .top button')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1); }).map(e => e.textContent.trim()));
  if (cut.length) fail(lab + ': buttons run off an upright phone: ' + cut.join(', '));
}
// the Asset Lab is a page, not a picture: upright on a phone, nothing runs off its side, and picking an entry draws it
await phone.goto(SITE + '/asset-lab#barrel');
await phone.waitForTimeout(500); await phone.evaluate(() => document.getElementById('grid').scrollIntoView()); await phone.waitForTimeout(500);   // (a tile draws as it comes into view)
const wide = await phone.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, shown: !document.getElementById('pick').hidden && __assets.S.sel.id === 'barrel' && document.getElementById('pickName').textContent.includes('barrel'), tiles: document.querySelectorAll('#grid .tile canvas').length }));   // (the link's own entry: the stage always shows one)
if (wide.over > 1) fail('asset-lab: the page is ' + wide.over + ' pixels wider than an upright phone');
if (!wide.shown || !wide.tiles) fail('asset-lab: #barrel did not show the barrel, or the grid drew nothing: ' + JSON.stringify(wide));

await browser.close();
server.close();
if (problems.length) { console.error('labs check FAILED:\n  ' + problems.join('\n  ')); process.exit(1); }
console.log(`labs check passed: ${siteLinks.length} links (${opened} pages opened on the site, all found as files), the way back from 5 labs and the game, 4 labs fill an upright phone, their buttons on screen, the Asset Lab fits one`);
