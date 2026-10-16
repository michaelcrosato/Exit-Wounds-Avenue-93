// Filmstrip: records a run of frames from a my-3D2dge game into one contact-sheet PNG, so an animation
// (a sword swing, a combo, a jump) can be judged frame by frame. Screenshots of single moments hide
// broken animation; a strip shows it.
//
// Usage:  node tools/filmstrip.mjs game.html[?query][#scene] --steps "<steps>" [--out strip.png] [--cols 8] [--scale 2] [--crop x,y,w,h]
//                                  [--seed 1] [--hz 60] [--compare other.html[#scene]]
// Steps run in order, separated by spaces (or by ' | ' when eval: code needs spaces):
//   wait:600          wait 600 ms
//   press:Enter       tap a key (KeyboardEvent.code, e.g. KeyJ, Space, ArrowRight)
//   down:ArrowRight   hold a key down            up:ArrowRight   release it
//   rec:16:2          start recording 16 frames, one every 2 display frames (runs alongside the next steps)
//   eval:<js>         run JavaScript in the page (the game is My3D2dge.current)
// The strip waits for the recording to finish. Frames are the game's own low-resolution buffer, scaled
// up with whole pixels; --crop takes a region of that buffer (in game pixels) to zoom on one character.
// --seed N makes the run repeatable: time is virtual (every display frame is exactly 1/60 s, and wait:600 runs
// 36 frames at once instead of waiting) and Math.random is seeded, so the same command gives the same frames,
// pixel for pixel, on any machine. Use it whenever two strips will be compared. --hz 144 makes the virtual display run at
// another refresh rate (frames of exactly 1/144 s; it implies --seed): the clock's steps per frame show on the strip.
// --compare b.html records the same steps from a second page (another build, or the game after your change) and
// lays the strips out A above B, with a third row that marks every pixel that differs. It implies --seed (1 if
// not given) and prints which frames changed, so a visual change can be checked to do only what it should.
// --expect-same (with --compare) exits with code 1 when any frame differs: tools/determinism-test.mjs compares a page with
// itself this way, to prove the same steps give the same pixels.
// Example: node tools/filmstrip.mjs dist/my-3d2dge.html#brawler --steps "wait:1500 press:Enter wait:800 rec:16:2 press:KeyJ wait:120 press:KeyJ" --out jab.png
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--'));
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
if (!file) { console.error('Usage: node tools/filmstrip.mjs game.html[?query][#scene] --steps "wait:1000 rec:16:2 press:KeyJ" [--out strip.png] [--cols 8] [--scale 2] [--crop x,y,w,h] [--seed 1] [--compare other.html]'); process.exit(2); }
const rawSteps = (opt('steps', 'wait:1000 rec:16:2') || '').trim(), steps = rawSteps.includes(' | ') ? rawSteps.split(' | ').map(x => x.trim()).filter(Boolean) : rawSteps.split(/\s+/);   // ' | ' separates steps whose eval: code has spaces
const out = resolve(opt('out', 'filmstrip.png')), cols = +opt('cols', 8), scale = +opt('scale', 2), crop = opt('crop', null);
const compare = opt('compare', null), hz = +opt('hz', 60), seed = opt('seed', compare || hz !== 60 ? '1' : null);
if (!(hz >= 10 && hz <= 1000)) { console.error('--hz takes a refresh rate, 10 to 1000'); process.exit(2); }
if (seed !== null && !/^\d+$/.test(seed)) { console.error('--seed takes a whole number'); process.exit(2); }

// Installed before the page's own scripts when --seed is given: a virtual clock that only moves when the
// tool calls __film.tick(), and a seeded Math.random (mulberry32). Sound is switched off: it runs on real
// time and draws its own random numbers, which would shift every random number the game draws after it.
const repeatable = ([seed, hz]) => {
  let rnd = seed >>> 0, now = 1000, id = 0;
  const due = new Map(), fixed = (obj, key, value) => Object.defineProperty(obj, key, { value, configurable: true, writable: true });
  Math.random = () => { rnd = (rnd + 0x6D2B79F5) >>> 0; let t = rnd; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  fixed(performance, 'now', () => now);
  Date.now = () => 1.7e12 + now;
  window.requestAnimationFrame = f => { due.set(++id, f); return id; };
  window.cancelAnimationFrame = i => { due.delete(i); };
  fixed(navigator, 'getGamepads', () => []);   // a controller plugged into this machine must not steer the run
  fixed(navigator, 'gpu', undefined);           // GPU lighting starts up on real time; the canvas path is the same everywhere
  window.AudioContext = window.webkitAudioContext = undefined;
  window.__film = { onFrame: null, tick(n = 1) {
    for (let i = 0; i < n; i++) { now += 1000 / hz; const run = [...due.values()]; due.clear(); for (const f of run) f(now); if (this.onFrame) this.onFrame(); }
  } };
};

// Copies the game's buffer (or the --crop region of it) on every display frame and keeps one in `every`.
// With the virtual clock it runs after each tick; otherwise on the browser's own animation frames.
function recorder([n, every, crop, virtual]) {
  const frames = [], g = My3D2dge.current; let tick = 0;
  const grab = () => {
    if (frames.length >= n) return true;
    if (tick++ % every === 0) {
      const b = g.screen.buf, [x, y, w, h] = crop ? crop.split(',').map(Number) : [1, 1, g.screen.W, g.screen.H];
      const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(b, x, y, w, h, 0, 0, w, h);
      frames.push({ c, t: g.time.toFixed(2) });
    }
    return frames.length >= n;
  };
  const result = () => frames.map(f => ({ url: f.c.toDataURL(), w: f.c.width, h: f.c.height, t: f.t }));
  if (virtual) { window.__film.rec = { done: () => frames.length >= n, result }; window.__film.onFrame = grab; return; }
  return new Promise(done => { const loop = () => grab() ? done(result()) : requestAnimationFrame(loop); requestAnimationFrame(loop); });
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];

// Plays the steps on one page and returns its recorded frames.
async function film(target, label) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => errors.push(label + String(e && e.message || e)));
  if (seed !== null) await page.addInitScript(repeatable, [+seed, hz]);
  const [page0, hash] = target.split('#'), [filePath, query] = page0.split('?'), virtual = seed !== null;
  await page.goto(pathToFileURL(resolve(filePath)).href + (query ? '?' + query : '') + (hash ? '#' + hash : ''));
  await page.waitForFunction(() => window.My3D2dge && My3D2dge.current, null, { timeout: 10000, polling: 50 });
  const framesIn = ms => Math.max(1, Math.round(ms * (virtual ? hz : 60) / 1000));
  const wait = ms => virtual ? page.evaluate(n => __film.tick(n), framesIn(ms)) : page.waitForTimeout(ms);
  let recording = null;
  for (const step of steps) {
    const [kind, ...rest] = step.split(':'), arg = rest.join(':');
    if (kind === 'wait') await wait(+arg);
    else if (kind === 'press') { await page.keyboard.down(arg); await wait(60); await page.keyboard.up(arg); }
    else if (kind === 'down') await page.keyboard.down(arg);
    else if (kind === 'up') await page.keyboard.up(arg);
    else if (kind === 'eval') await page.evaluate(arg);
    else if (kind === 'rec') {
      const [n, every] = arg.split(':').map(Number);
      recording = page.evaluate(recorder, [n, every || 1, crop, virtual]);
      if (virtual) await recording;
    } else console.warn('unknown step', step);
  }
  if (!recording) { console.error('no rec:N:every step, nothing recorded'); await browser.close(); process.exit(2); }
  // the virtual clock only moves when told to: run frames until the recording is full (a minute at most)
  const frames = virtual ? await page.evaluate(() => { for (let i = 0; i < 3600 && !__film.rec.done(); i++) __film.tick(); return __film.rec.result(); }) : await recording;
  return { page, frames };
}

const a = await film(file, compare ? 'A: ' : '');
const b = compare ? await film(compare, 'B: ') : null;

// lay the frames out on a sheet, whole-pixel scaled, with the frame number and game time under each.
// With --compare every block of columns gets three rows: A, B, and A dimmed with the differing pixels in magenta.
const sheet = await a.page.evaluate(async ([fa, fb, cols, scale]) => {
  const load = async url => { const img = new Image(); img.src = url; await img.decode(); return img; };
  const pixels = (img, w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, w, h); };
  const w = fa[0].w * scale, h = fa[0].h * scale, pad = 4, lab = 12, rows = fb ? 3 : 1, blocks = Math.ceil(fa.length / cols);
  const c = document.createElement('canvas'); c.width = cols * (w + pad) + pad; c.height = blocks * rows * (h + pad + lab) + pad;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#1b1b24'; g.fillRect(0, 0, c.width, c.height);
  g.font = '10px monospace';
  const diffs = [];
  for (let i = 0; i < fa.length; i++) {
    const x = pad + (i % cols) * (w + pad), y0 = pad + Math.floor(i / cols) * rows * (h + pad + lab), row = r => y0 + r * (h + pad + lab);
    const A = await load(fa[i].url);
    g.drawImage(A, x, row(0), w, h); g.fillStyle = '#c8c8e0'; g.fillText((fb ? 'A ' : '') + '#' + i + '  t ' + fa[i].t, x, row(0) + h + 10);
    if (!fb) continue;
    const B = fb[i] && await load(fb[i].url);
    if (!B) { diffs.push(null); continue; }
    g.drawImage(B, x, row(1), fb[i].w * scale, fb[i].h * scale); g.fillStyle = '#c8c8e0'; g.fillText('B #' + i + '  t ' + fb[i].t, x, row(1) + h + 10);
    // the diff row: A in grey, every pixel that B changed in magenta
    const fw = fa[i].w, fh = fa[i].h, pa = pixels(A, fw, fh), pb = pixels(B, fw, fh), d = new ImageData(fw, fh);
    let n = 0;
    for (let p = 0; p < pa.data.length; p += 4) {
      const same = pa.data[p] === pb.data[p] && pa.data[p + 1] === pb.data[p + 1] && pa.data[p + 2] === pb.data[p + 2] && pa.data[p + 3] === pb.data[p + 3];
      const grey = (pa.data[p] + pa.data[p + 1] + pa.data[p + 2]) / 9 + 20;
      if (!same) n++;
      d.data.set(same ? [grey, grey, grey, 255] : [255, 40, 220, 255], p);
    }
    const dc = document.createElement('canvas'); dc.width = fw; dc.height = fh; dc.getContext('2d').putImageData(d, 0, 0);
    g.drawImage(dc, x, row(2), w, h); g.fillStyle = n ? '#ff7ae8' : '#7ad88a'; g.fillText(n ? n + ' px differ' : 'same', x, row(2) + h + 10);
    diffs.push(fw === fb[i].w && fh === fb[i].h ? n : -1);
  }
  return { url: c.toDataURL('image/png'), diffs };
}, [a.frames, b && b.frames, cols, scale]);
writeFileSync(out, Buffer.from(sheet.url.split(',')[1], 'base64'));
console.log('wrote', out, a.frames.length, 'frames', seed !== null ? '(repeatable, seed ' + seed + ')' : '');
if (b) {
  const changed = sheet.diffs.map((n, i) => [i, n]).filter(([, n]) => n !== 0);
  if (b.frames.length !== a.frames.length) console.log('B recorded', b.frames.length, 'frames, A', a.frames.length);
  console.log(changed.length ? changed.length + ' of ' + a.frames.length + ' frames differ: ' + changed.map(([i, n]) => '#' + i + (n === null ? ' (missing in B)' : n < 0 ? ' (size differs)' : ' ' + n + ' px')).join(', ') : 'A and B are identical, pixel for pixel');
}
if (errors.length) console.log('errors:\n' + errors.join('\n'));
await browser.close();
if (args.includes('--expect-same') && b && (b.frames.length !== a.frames.length || sheet.diffs.some(n => n !== 0))) process.exit(1);
process.exit(errors.length ? 1 : 0);
