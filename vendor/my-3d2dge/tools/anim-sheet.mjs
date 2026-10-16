// Contact sheets of animation clips: each clip as a row of frames from start to end, played on the libraries'
// mannequin look-alike in the mocap lab. For writing a library's catalog (what each clip's body does, its tags) and
// for checking an import by eye. It plays the set file itself, so it shows exactly what was imported.
// Usage: node tools/anim-sheet.mjs src/mocap/sets/quaternius.js [--clips A,B | --uncataloged src/mocap/catalogs/x.json]
//          [--out check-output/anim-sheets] [--rows 6] [--frames 8] [--view threequarter] [--every 0.5]
// --every s: a frame every s seconds, each marked with its time, over as many rows as the clip needs (for finding the
//   moments worth cutting from a long take: tools/cmu.mjs, the catalog's "$pick")
// Writes <out>/<set>-1.png, -2.png ... (--rows clips per sheet). Run node tools/build.mjs first (it reads the lab's sources,
// not the built page, so a new set needs no build). CHROMIUM_PATH picks a browser.
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readSet } from './mocap-lib.mjs';

const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const file = args.find((a, i) => !a.startsWith('--') && !(args[i - 1] || '').startsWith('--'));
if (!file) { console.error('Usage: node tools/anim-sheet.mjs set.js [--clips A,B | --uncataloged catalog.json] [--out dir] [--rows 6] [--frames 8] [--view threequarter]'); process.exit(2); }
const set = readSet(resolve(file)), all = Object.keys(set.clips);
let names = opt('clips') ? opt('clips').split(',') : all;
if (opt('uncataloged')) { const cat = JSON.parse(readFileSync(resolve(opt('uncataloged')), 'utf8')); names = names.filter(n => !cat[n]); }
const missing = names.filter(n => !set.clips[n]); if (missing.length) { console.error('not in ' + set.set + ': ' + missing.join(', ')); process.exit(1); }
if (!names.length) { console.log('nothing to draw: every clip is in the catalog'); process.exit(0); }
const OUT = resolve(opt('out', 'check-output/anim-sheets')), ROWS = +opt('rows', 6), FRAMES = +opt('frames', 8), VIEW = opt('view', 'threequarter'), EVERY = +opt('every', 0);

// the lab's page with this set alone in it
const esc = s => s.replaceAll('</script', '<\\/script');
const html = readFileSync('src/mocap.template.html', 'utf8').replace(/<!-- @inline (\S+) -->/g, (_, f) =>
  f.startsWith('src/mocap/sets/') ? (f.endsWith('quaternius.js') ? '<script>\n' + esc(readFileSync(resolve(file), 'utf8')) + '\n</script>' : '') : '<script>\n' + esc(readFileSync(f, 'utf8')) + '\n</script>');

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
const problems = []; page.on('pageerror', e => problems.push(e.message));
mkdirSync(OUT, { recursive: true });
const tmp = join(OUT, '.sheet-page.html'); writeFileSync(tmp, html);   // (a real file: the lab keeps the clip in its URL)
await page.goto(pathToFileURL(tmp).href + '#' + encodeURIComponent(names[0]));
await page.waitForFunction(() => window.__mocap && __mocap.game.fps > 0, null, { timeout: 20000 }).catch(e => { console.error(problems.join('\n') || e.message); process.exit(1); });
const written = [];
for (let s = 0; s < names.length; s += ROWS) {
  const url = await page.evaluate(async ({ chunk, F, view, every }) => {
    const M = __mocap, wait = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    document.querySelectorAll('.hud').forEach(e => { e.style.display = 'none'; });
    M.setCast('mannequin'); M.setView(view); M.game.setZoom(1.3);
    const cv = document.getElementById('screen'), cw = 140, ch = 150, sheet = document.createElement('canvas');
    // each clip's frame times: F spread over the clip, or (every) one every so many seconds, F to a row
    const times = chunk.map(n => { const d = __mocap.lib.clip(n).dur; if (!every) return Array.from({ length: F }, (_, i) => d * i / (F - 1)); const t = []; for (let x = 0; x <= d + 1e-6; x += every) t.push(x); return t; });
    sheet.width = cw * F; sheet.height = (ch + 16) * times.reduce((a, t) => a + Math.ceil(t.length / F), 0);
    const g = sheet.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, sheet.width, sheet.height);
    let row = 0;
    for (const [ci, n] of chunk.entries()) {
      M.play(n, true); const c = M.S.clip;
      for (let k = 0; k < 20; k++) await wait();   // the camera settles on the figure
      g.fillStyle = '#000'; g.font = '13px sans-serif';
      g.fillText(n + '   ' + c.dur.toFixed(2) + ' s, ' + (c.loop ? 'loops' : 'once') + (c.keys[0].root ? ', travels' : '') + (c.take ? '   take ' + c.take : '') + (c.desc ? '   ' + c.desc : ''), 4, row * (ch + 16) + 12);
      for (let i = 0; i < times[ci].length; i++) {
        const t = times[ci][i], x = (i % F) * cw, y = (row + Math.floor(i / F)) * (ch + 16) + 16;
        M.seek(t); await wait(); await wait();
        const W = cv.width, H = cv.height, sw = W * .36, sh = H * .55;
        g.drawImage(cv, W / 2 - sw / 2, H / 2 - sh * .6, sw, sh, x, y, cw, ch);
        if (every) { g.fillStyle = '#000'; g.font = '12px sans-serif'; g.fillText(t.toFixed(2) + ' s', x + 4, y + ch - 4); }
      }
      row += Math.ceil(times[ci].length / F);
    }
    return sheet.toDataURL('image/png');
  }, { chunk: names.slice(s, s + ROWS), F: FRAMES, view: VIEW, every: EVERY });
  const out = join(OUT, set.set.toLowerCase() + '-' + (s / ROWS + 1) + '.png');
  writeFileSync(out, Buffer.from(url.split(',')[1], 'base64')); written.push(out);
}
await browser.close(); rmSync(tmp, { force: true });
if (problems.length) { console.error('page errors:\n  ' + problems.join('\n  ')); process.exit(1); }
console.log(`${names.length} clips of ${set.set} on ${written.length} sheet(s):\n  ` + written.join('\n  '));
