// Replays a recorded play session (E.session, engine section 23; docs/DECISIONS.md D12) in headless Chromium, frame by
// frame: the same seed, frame times, inputs, screen and save give the same game (with the engine's portable math, the same
// in every browser), so a bug seen on a phone happens again here, where an agent can look at it.
//   node tools/replay.mjs session.json [--page examples/emberdeep.html] [--to <frame>] [--shots f1,f2,...] [--out dir]
//                                      [--log "<js>"] [--keep-going]
//   --page   the page to replay on; by default the one the session was recorded on (the site's address, read through
//            vercel.json's rewrites, or a local file's name), with the address's ?query and #hash
//   --to     stop at this frame (default: the end); --shots saves a screenshot at each of these frames (and at the end)
//   --log    JavaScript evaluated in the page at the end, printed (e.g. "__ed.ED.hero.x"); without it, the game's own
//            game.debug.snapshot() when it has one
//   --keep-going  play on after the first frame whose checksum differs (by default it stops there)
//   --pacing      no replay: the device's refreshes as recorded (a frame's time is its refresh's): the refresh, how many
//                 were missed (the page or its GPU behind) second by second, and how unevenly (choppy play's evidence)
// Prints how far it played, how many checksums matched and the first frame that differed. Exit code 1 when it diverged,
// when an input's target was missing, or when the page threw. Pictures in --out (check-output/replay/ by default).
// A session recorded on another build may play differently: it says so when the version or the build differs.
import { chromium } from 'playwright';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const file = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && args[i - 1] !== '--keep-going'));
if (!file) { console.error('Usage: node tools/replay.mjs session.json [--page page.html] [--to frame] [--shots f1,f2] [--out dir] [--log "<js>"] [--keep-going] [--pacing]'); process.exit(2); }
const S = JSON.parse(readFileSync(file, 'utf8'));
if (S.format !== 'my3d2dge-session') { console.error(file + ' is not a my-3D2dge session (format: ' + S.format + ')'); process.exit(2); }
if (args.includes('--pacing')) {
  // each recorded frame is a refresh the browser gave the page. Second by second: the display's refresh there (the shortest
  // gap that recurs in that second, to half a millisecond, 3 times at least, else in the 3 s around it: a phone with
  // adaptive refresh changes it; a second missing every other refresh reads as half the rate, and is even), the refreshes it had that the page missed (the page or its GPU behind; a gap spanning seconds shares its misses
  // out by time, each second's share at its own refresh), the longest gap, and the gaps a different number of refreshes
  // long than the one before (8 then 17 ms: what reads as choppy). Time the page was hidden (its recorded visibility
  // events; a first one that shows it means it began hidden) is left out: no refresh is owed then
  const F = S.frames, hid = new Set(); let h0 = null, first = true;
  for (const e of S.events || []) if (e[1] === 'visibilitychange') {
    if (first && !e[3]) for (let i = 0; i <= e[0]; i++) hid.add(i);
    else if (e[3] && h0 === null) h0 = e[0]; else if (!e[3] && h0 !== null) { for (let i = h0; i <= e[0]; i++) hid.add(i); h0 = null; }
    first = false;
  }
  if (h0 !== null) for (let i = h0; i < F.length; i++) hid.add(i);
  const G = []; for (let i = 1; i < F.length; i++) if (!hid.has(i) && F[i] - F[i - 1] > 4) G.push({ t: F[i - 1], g: F[i] - F[i - 1] });
  const refresh = (a, b) => { const bins = new Map(); for (const { t, g } of G) if (t >= a && t < b) { const k = Math.round(g * 2) / 2; bins.set(k, (bins.get(k) || 0) + 1); }
    const k0 = [...bins].filter(([, c]) => c >= 3).map(([k]) => k).sort((x, y) => x - y)[0]; if (k0 === undefined) return null;
    const near = G.filter(({ t, g }) => t >= a && t < b && Math.abs(g - k0) <= .5); return near.reduce((s, { g }) => s + g, 0) / near.length; };
  const all = refresh(-Infinity, Infinity) || 16.7, T0 = F[0], nb = Math.max(1, Math.ceil((F[F.length - 1] - T0) / 1000));
  const B = Array.from({ length: nb }, (_, k) => ({ per: refresh(T0 + k * 1000, T0 + (k + 1) * 1000) || refresh(T0 + (k - 1) * 1000, T0 + (k + 2) * 1000) || all, frames: 0, missed: 0, long: 0, uneven: 0, seen: false }));
  let prev = 0, frames = 0, missed = 0, uneven = 0;
  for (const { t, g } of G) {
    // the refreshes the gap took: its time in each second at that second's refresh (a stall can span a change of rate)
    const end = t + g, kb = Math.min(nb - 1, Math.floor((end - T0) / 1000)), parts = []; let owed = 0;
    for (let k = Math.max(0, Math.floor((t - T0) / 1000)); k <= kb; k++) {
      const o = Math.min(end, T0 + (k + 1) * 1000) - Math.max(t, T0 + k * 1000); if (o <= 0) continue;
      const r = o / B[k].per; owed += r; parts.push([k, r, o]);
    }
    const n = Math.max(1, Math.round(owed));
    B[kb].frames++; frames++; missed += n - 1; if (prev && n !== prev) { B[kb].uneven++; uneven++; } prev = n;
    for (const [k, r, o] of parts) { B[k].missed += (n - 1) * r / owed; if (o > .5) { B[k].long = Math.max(B[k].long, g); B[k].seen = true; } }
  }
  const hz = p => Math.round(1000 / p);
  console.log(`${S.href}  v${S.version} ${S.build || ''}\n${S.ua}\n${F.length} frames over ${((F[F.length - 1] - T0) / 1000).toFixed(1)} s${hid.size ? ' (hidden for ' + [...hid].filter(i => i >= 1 && i < F.length).length + ' gaps, left out)' : ''}; the refresh ${all.toFixed(2)} ms (${hz(all)} Hz)`);
  console.log(`${missed} refreshes missed (${(missed / Math.max(1, frames + missed) * 100).toFixed(1)}%), ${(uneven / Math.max(1, frames - 1) * 100).toFixed(1)}% of gaps unlike the one before`);
  console.log('second by second (frames/refreshes missed/the longest gap in ms, @Hz where the refresh differs; - hidden):');
  for (let k = 0; k < nb; k += 8) console.log('  ' + B.slice(k, k + 8).map(b => b.seen ? `${b.frames}/${Math.round(b.missed)}/${Math.round(b.long)}${hz(b.per) !== hz(all) ? '@' + hz(b.per) : ''}` : '-').join('  '));
  process.exit(0);
}
const root = resolve('.'), out = resolve(opt('out', 'check-output/replay')); mkdirSync(out, { recursive: true });
// (the repository has the engine in engine/; the handoff package, dist/handoff/, beside its tools/)
const enginePath = ['engine/my-3d2dge.js', 'my-3d2dge.js'].map(f => join(root, f)).find(f => existsSync(f));
const engine = enginePath ? readFileSync(enginePath, 'utf8').match(/version: '([^']+)'/)[1] : S.version;

/* the page: --page, or the recorded address mapped to a file the way the site maps it */
const href = new URL(S.href, 'http://site'), tail = href.search + href.hash;
let page = opt('page', null);
if (!page) {
  const p = decodeURIComponent(href.pathname);
  if (p.endsWith('.html')) page = ['examples', 'dist', 'dist/kits', 'game', '.'].map(d => d + '/' + basename(p)).find(f => existsSync(join(root, f)));
  else if (existsSync(join(root, 'vercel.json'))) for (const r of JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')).rewrites) {
    const re = new RegExp('^' + r.source.replace(/:(\w+)\(([^)]+)\)/g, '(?<$1>$2)').replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), m = re.exec(p);
    if (m) { page = r.destination.replace(/:(\w+)/g, (_, k) => m.groups[k]).replace(/^\//, ''); break; }
  }
  if (!page) { console.error('no local page for ' + S.href + ': give one with --page'); process.exit(2); }
}
const url = pathToFileURL(resolve(page.replace(/[?#].*$/, ''))).href + (/[?#]/.test(page) ? page.slice(page.search(/[?#]/)) : tail);
console.log(`replaying ${file}: ${S.frames.length} frames (${(((S.frames.at(-1) || 0) - (S.frames[0] || 0)) / 1000).toFixed(1)} s), ${S.events.length} inputs, recorded ${S.started} on v${S.version} ${S.build}`);
console.log(`  on ${url}, ${S.env.innerWidth}x${S.env.innerHeight} at ${S.env.devicePixelRatio}x` + (S.env.media['(pointer: coarse)'] ? ', a touch screen' : ''));
if (S.version !== engine) console.log(`  note: recorded on v${S.version}, replaying on v${engine}: other code may play differently (git checkout the release it was recorded on)`);
else if (S.build !== 'dev-build') console.log(`  note: recorded on the deployed build ${S.build}; if it diverges, replay on that commit (git checkout ${S.build.split(' ')[0]}, then node tools/build.mjs)`);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: S.env.innerWidth, height: S.env.innerHeight }, deviceScaleFactor: S.env.devicePixelRatio, hasTouch: !!S.env.media['(pointer: coarse)'] });
const tab = await ctx.newPage(), errors = [];
tab.on('pageerror', e => errors.push(String(e && e.stack || e)));
tab.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await tab.addInitScript(s => { window.__my3d2dgeReplay = s; }, S);
await tab.goto(url);
await tab.waitForFunction(() => window.My3D2dge && My3D2dge.session && My3D2dge.session.replaying, null, { timeout: 30000 });

const to = Math.min(+opt('to', S.frames.length), S.frames.length), shots = new Set((opt('shots', '') || '').split(',').filter(Boolean).map(Number));
let r = { frame: 0 };
while (r.frame < to) {
  const next = Math.min(to, ...[...shots].filter(f => f > r.frame)), n = Math.min(300, next - r.frame);
  r = await tab.evaluate(k => My3D2dge.session.step(k), n);
  if (r.resize) { await tab.setViewportSize({ width: r.resize[0], height: r.resize[1] }); continue; }
  if (shots.has(r.frame)) await tab.screenshot({ path: join(out, `frame-${r.frame}.png`) });
  if (r.diverged !== undefined && !args.includes('--keep-going')) break;
  if (r.done) break;
}
await tab.screenshot({ path: join(out, `frame-${r.frame}-end.png`) });
const LOG = opt('log', null) || (await tab.evaluate(() => { const d = My3D2dge.current && My3D2dge.current.debug; return !!(d && typeof d.snapshot === 'function'); }) ? 'My3D2dge.current.debug.snapshot()' : null);
const logged = LOG ? await tab.evaluate(code => { try { return JSON.stringify((0, eval)(code)); } catch (e) { return 'threw: ' + e.message; } }, LOG) : null;
await browser.close();

console.log(`played ${r.frame} of ${S.frames.length} frames, ${r.events} inputs; ${r.checked} checksum(s) compared` + (r.diverged === undefined ? ', all matched' : `; it DIVERGED at frame ${r.diverged} (the first checksum that differed)`));
if (r.missing) console.log(`  ${r.missing} input(s) found no element to go to (the page's elements differ from the recording's)`);
if (logged !== null) console.log('  ' + LOG + ' = ' + logged);
if (errors.length) console.log('page errors:\n  ' + errors.slice(0, 5).join('\n  '));
console.log('pictures in ' + out);
process.exit(r.diverged !== undefined || r.missing || errors.length ? 1 : 0);
