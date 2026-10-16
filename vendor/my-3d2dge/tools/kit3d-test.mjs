// The 3D engine's check (engine/my-3d2dge-3d.js) and its kits (src/starter3d/, built into dist/my-3d2dge-3d.html and
// dist/kits/my-3d2dge-3d-<slice>.html).
//   1. the rules, read from the 3D engine's and the kits' own sources (not the vendored libraries): three.js through
//      WebGPURenderer and node materials only (no WebGLRenderer, ShaderMaterial, onBeforeCompile, EffectComposer,
//      addons), no WebGPU-only compute or storage buffers, nothing read back from the GPU; the import map points at
//      vendored files that exist
//   2. the manual's quick start (the ```js quickstart block in the engine's header) runs as the manual hosts it: no
//      errors, a hero that walks and jumps, gems to take
//   3. every 3D kit, served as Vercel serves it (/kits/3d-<slice>, /3d), on WebGL 2 and on WebGPU (headless Chromium runs
//      WebGPU on SwiftShader, through a stand-in canvas as tools/stress-world-test.mjs does): no page errors, the title
//      draws, each slice starts; each slice's proof run gives the same hash twice and on both backends (the game never
//      reads the renderer); a minute of scripted play builds no GPU pipeline mid-game (the warm-up's job) and moves
//      the hero; pictures in check-output/kit3d/ (read them)
//   3b. shapes (world.shape: the 2D engine's entries in 3D): every core shape builds and draws on WebGL 2 and on WebGPU (its
//      pixels change where it stands), a hero walking into a solid one stops and one dropped on a table lands on it; a
//      sheet of every core shape in 3D beside its 2D picture (check-output/kit3d/shapes-<backend>.png: read it)
//   4. on an emulated phone held upright (390 x 844 at 3x, touch): a kit starts, the 3D picture lies exactly under the
//      game's, the touch buttons are there
// Usage: node tools/kit3d-test.mjs   (run node tools/build.mjs first; CHROMIUM_PATH picks a browser). Exit code 1 on failure.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';

const root = resolve('.');
const problems = [], notes = [];
const fail = m => problems.push(m);
const read = f => readFileSync(join(root, f), 'utf8');

/* 1. the rules */
const BANNED = [
  [/\bWebGLRenderer\b/, 'WebGLRenderer (use WebGPURenderer: it falls back to WebGL 2 by itself)'],
  [/\b(Raw)?ShaderMaterial\b/, 'ShaderMaterial (write node materials or TSL)'],
  [/\bonBeforeCompile\b/, 'onBeforeCompile (not run by WebGPURenderer)'],
  [/\bEffectComposer\b|three\/examples|three\/addons/, 'addons and EffectComposer (not vendored; post-processing is TSL)'],
  [/\bcompute\s*\(|\bStorageBufferAttribute\b|\bstorage\s*\(|\bcomputeAsync\b/, 'compute shaders or storage buffers (WebGPU only)'],
  [/readRenderTargetPixels|readPixels\s*\(/, 'reading pixels back (nothing comes back from the GPU into gameplay)']
];
const SLICES = readdirSync(join(root, 'src/starter3d')).filter(f => /^[1-8]\d-.+\.js$/.test(f)).map(f => f.replace(/^\d+-|\.js$/g, ''));
const SOURCES = ['engine/my-3d2dge-3d.js', 'src/starter3d.template.html', ...readdirSync(join(root, 'src/starter3d')).filter(f => f.endsWith('.js')).map(f => 'src/starter3d/' + f)];
const engine3d = read('engine/my-3d2dge-3d.js'), manual = engine3d.slice(0, engine3d.indexOf('*/'));
for (const f of SOURCES) {
  const text = f === 'engine/my-3d2dge-3d.js' ? engine3d.slice(manual.length) : read(f);   // (the manual names what is banned)
  text.split('\n').forEach((line, i) => {
    const code = line.replace(/\/\/.*$|\/\*.*?\*\/|^\s*\*.*$/g, '');
    for (const [re, why] of BANNED) if (re.test(code)) fail(`${f}:${i + 1}: ${why}`);
  });
}
{
  const map = JSON.parse(read('src/starter3d.template.html').match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
  for (const [k, v] of Object.entries(map.imports)) if (!v.startsWith('/vendor/') || !existsSync(join(root, v))) fail(`src/starter3d.template.html import map: ${k} -> ${v} is not a vendored file that exists`);
}

/* the site, served as Vercel serves it (vercel.json's rewrites), and the quick start's page at /check/quickstart.html */
const rules = JSON.parse(read('vercel.json')).rewrites.map(r => ({
  re: new RegExp('^' + r.source.split(/(:\w+\([^)]+\))/).map((part, i) => i % 2 ? part.replace(/:(\w+)\(([^)]+)\)/, '(?<$1>$2)') : part.replace(/\./g, '\\.').replace(/:(\w+)(?![\w>])/g, '(?<$1>[^/]+)')).join('') + '$'),
  to: r.destination
}));
const code = (manual.split('```js quickstart\n')[1] || '').split('```')[0], host = manual.split('## Host it')[1] || '';
if (!code) fail('the manual has no ```js quickstart block');
const importmap = (host.match(/<script type="importmap">[\s\S]*?<\/script>/) || [''])[0];
const QUICK = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}</style>${importmap}</head><body>
<div id="stage" style="position:relative;width:100%;height:100%;overflow:hidden"><canvas id="view"></canvas><canvas id="screen" style="position:absolute;inset:0;width:100%;height:100%"></canvas></div>
<script src="/dist/my-3d2dge.js"></script><script type="module" src="/dist/my-3d2dge-3d.js"></script>
<script type="module">${code}
window.__quick = { game, get world() { return world; }, get hero() { return hero; }, get gems() { return gems; } };</script></body></html>`;
// the shapes' page: every core shape in a row in 3D, the camera close on one at a time (__sheet.look(i))
const SHAPES_PAGE = QUICK.split('<script type="module">')[0] + `<script type="module">
const E = My3D2dge, IDS = Object.keys(E.SHAPES).filter(k => !k.includes(':')), SP = 112, T = 16, FACING = Math.PI / 2 + .6;
const game = new E.Game({ canvas: 'screen', res: [400, 300], bg: null, menu: false });
const rows = Array.from({ length: 9 }, () => '.'.repeat(Math.ceil((IDS.length * SP + 64) / T)));
let world; const focus = { x: 0, y: 72, z: 12 }, at = i => [32 + (i + .5) * SP, 72];
const sheet = { view: 'iso', enter() { world.reset(); IDS.forEach((id, i) => world.shape(id, at(i)[0], at(i)[1], 0, { facing: FACING })); world.camera.follow(focus); },
  update(dt) { world.step(dt); }, draw(r) { world.draw(r); } };
game.start({ scenes: { sheet }, scene: 'sheet', boot: { steps: [['3D', () => E.World3D.init(game)], ['level', () => { world = new E.World3D(game, { level: { rows, legend: {}, ground: 'plain', colors: { base: '#4a4458' } }, fog: false, sky: '#1c1826',
  ambient: ['#ffffff', '#8a8aa0', 2.2], sun: { color: '#fff1d6', intensity: 2.4, dir: [-.5, .6, -.8], area: 400 }, torchLights: 0, camera: { mode: 'view', proj: 'ortho', dist: .45, lag: 0 } }); world.prepare(); }]] } });
window.__sheet = { game, IDS, at, FACING, get world() { return world; }, look(i) { const [x, y] = at(i); Object.assign(focus, { x, y, z: 12 }); }, lookAt(x, y) { Object.assign(focus, { x, y, z: 6 }); } };
</script></body></html>`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json' };
const server = createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/check/quickstart.html') { res.writeHead(200, { 'content-type': TYPES['.html'] }); res.end(QUICK); return; }
  if (path === '/check/shapes.html') { res.writeHead(200, { 'content-type': TYPES['.html'] }); res.end(SHAPES_PAGE); return; }
  for (const r of rules) { const m = path.match(r.re); if (m) { path = r.to.replace(/:(\w+)/g, (_, k) => m.groups[k]); break; } }
  const file = join(root, path);
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const SITE = 'http://127.0.0.1:' + server.address().port;
const OUT = join(root, 'check-output/kit3d'); mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader', '--disable-vulkan-surface'] });
/** test-only (as tools/stress-world-test.mjs): a WebGPU canvas context that renders into a plain texture (headless
 *  Chromium can't present), and a way to read the last frame back as a PNG. Installed before the page's scripts run */
function standInCanvas() {
  const real = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, opts) {
    if (type !== 'webgpu') return real.call(this, type, opts);
    const canvas = this; let cfg = null, tex = null;
    return { canvas, configure(c) { cfg = c; tex = null; }, unconfigure() { cfg = null; tex = null; }, getConfiguration() { return cfg; },
      getCurrentTexture() {
        if (!tex || tex.width !== canvas.width || tex.height !== canvas.height) {
          tex = cfg.device.createTexture({ size: [canvas.width, canvas.height], format: cfg.format, usage: (cfg.usage || 0) | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
          window.__frameTex = tex; window.__frameDevice = cfg.device; window.__frameFormat = cfg.format;
        }
        return tex;
      } };
  };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => { const d = window.__frameDevice; if (d) d.queue.onSubmittedWorkDone().then(() => raf(cb)); else raf(cb); return 0; };
  window.__readFrame = async scale => {
    const t = window.__frameTex, d = window.__frameDevice, w = t.width, h = t.height, bpr = Math.ceil(w * 4 / 256) * 256;
    const buf = d.createBuffer({ size: bpr * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }), enc = d.createCommandEncoder();
    enc.copyTextureToBuffer({ texture: t }, { buffer: buf, bytesPerRow: bpr }, [w, h]); d.queue.submit([enc.finish()]);
    await buf.mapAsync(GPUMapMode.READ); const src = new Uint8Array(buf.getMappedRange()), img = new ImageData(w, h), bgra = /^bgra/.test(window.__frameFormat);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * bpr + x * 4, o = (y * w + x) * 4; img.data[o] = src[i + (bgra ? 2 : 0)]; img.data[o + 1] = src[i + 1]; img.data[o + 2] = src[i + (bgra ? 0 : 2)]; img.data[o + 3] = 255; }
    buf.unmap(); buf.destroy();
    const a = document.createElement('canvas'); a.width = w; a.height = h; a.getContext('2d').putImageData(img, 0, 0);
    const b = document.createElement('canvas'); b.width = w * scale; b.height = h * scale; const g = b.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(a, 0, 0, b.width, b.height);
    return b.toDataURL('image/png');
  };
}
const watch = page => { const errors = []; page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); }); return errors; };
let pictures = 0;

/* 2. the manual's quick start */
{
  const page = await browser.newPage({ viewport: { width: 900, height: 600 } }), errors = watch(page);
  await page.goto(SITE + '/check/quickstart.html?backend=webgl');
  try {
    await page.waitForFunction(() => window.__quick && __quick.world && __quick.world.stats.frames > 2, null, { timeout: 90000 });
    const r = await page.evaluate(() => {
      const g = __quick.game; g.stop(); const h = __quick.hero, x0 = h.x, y0 = h.y;
      g.input.hold('right', true); g.advance(.8); g.input.hold('right', false);
      g.input.tap('jump'); let top = h.z; for (let i = 0; i < 40; i++) { g.advance(1 / 120); top = Math.max(top, h.z); }
      return { moved: Math.hypot(h.x - x0, h.y - y0), top, gems: __quick.gems.length, things: __quick.world.things.length };
    });
    if (r.moved < 30) fail(`quick start: the hero moved only ${r.moved.toFixed(1)} units in 0.8 s`);
    if (r.top < 20) fail(`quick start: the hero's jump reached only ${r.top.toFixed(1)} units`);
    if (!r.gems || r.gems !== r.things) fail(`quick start: ${r.gems} gems, ${r.things} things`);
    await page.evaluate(() => __quick.game.start()); await page.waitForTimeout(500);
    await page.screenshot({ path: join(OUT, 'quickstart.png') }); pictures++;
  } catch (e) { fail('quick start: ' + e.message.split('\n')[0]); }
  for (const e of errors) fail('quick start: ' + e);
  await page.close();
}

/* 3. the kits on both backends */
const hashes = {};
const pages = [['3d', '/3d'], ...SLICES.map(s => ['3d-' + s, '/kits/3d-' + s])];
for (const want of ['webgl', 'webgpu']) for (const [name, path] of pages) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
  if (want === 'webgpu') await page.addInitScript(standInCanvas);
  const errors = watch(page), label = name + ' ' + want;
  const r = await page.goto(SITE + path + (want === 'webgl' ? '?backend=webgl' : ''));
  if (!r || r.status() !== 200) { fail(`${path}: status ${r && r.status()}`); await page.close(); continue; }
  try { await page.waitForFunction(() => window.__game && __game.game.sceneName === 'title' && My3D2dge.World3D.worlds.some(w => w.stats.frames > 2), null, { timeout: 120000 }); }
  catch (e) { fail(`${label}: the title did not draw in 120 s ${errors.slice(0, 2).join(' | ')}`); await page.close(); continue; }
  const backend = await page.evaluate(() => My3D2dge.World3D.backend);
  if (want === 'webgl' && backend !== 'WebGL 2') fail(`${label}: ?backend=webgl gave ${backend}`);
  if (want === 'webgpu' && backend !== 'WebGPU') { notes.push('WebGPU is not available in this browser: the WebGPU runs fell back to WebGL 2'); await page.close(); continue; }
  const picture = async shot => {
    let png;
    if (want === 'webgl') png = await page.screenshot();
    else { const d = await page.evaluate(() => window.__readFrame ? __readFrame(2) : null).catch(() => null); png = d ? Buffer.from(d.split(',')[1], 'base64') : await page.screenshot(); }
    writeFileSync(join(OUT, `${name}-${want}-${shot}.png`), png); pictures++;
  };
  await picture('title');
  const slices = await page.evaluate(() => Object.keys(__game.scenes).filter(k => !['title', 'over'].includes(k)));
  for (const s of slices) {
    await page.evaluate(id => __game.game.go(id, null, { fade: 0 }), s);
    await page.waitForFunction(id => __game.game.sceneName === id && __game.scenes[id].world.stats.frames > 2, s, { timeout: 60000 }).catch(() => fail(`${label}: ${s} did not start`));
    // the proof: twice, the same hash (and the same on both backends, below)
    const proof = await page.evaluate(id => [__game.scenes[id].run(600), __game.scenes[id].run(600)], s);
    if (proof[0] !== proof[1]) fail(`${label}: ${s}'s proof run is not repeatable (${proof.join(', then ')})`);
    (hashes[s] ||= {})[want] = proof[0];
    // play: start the slice afresh, hold the stick and press its buttons for a while; no GPU pipeline is built mid-game
    const play = await page.evaluate(async id => {
      const g = __game.game, S = __game.scenes[id], R = My3D2dge.World3D.renderer, pipes = () => { const p = R._pipelines; return p && p.caches ? p.caches.size : null; };
      g.go(id, null, { fade: 0 }); await new Promise(r => setTimeout(r, 400));
      const h0 = S.hero, x0 = h0.x, y0 = h0.y, p0 = pipes(), f0 = S.world.stats.frames;
      const keys = id === 'action' ? ['attack', 'dash', 'jump', 'skill'] : ['jump', 'dash'];
      g.input.hold('up', true);
      // (the farthest it got: the course's edge is a second's run north, and a fall puts the hero back at the start)
      let moved = 0; for (let i = 0; i < 24; i++) { g.input.tap(keys[i % keys.length]); if (i === 8) { g.input.hold('up', false); g.input.hold('left', true); } await new Promise(r => setTimeout(r, 120)); moved = Math.max(moved, Math.hypot(S.hero.x - x0, S.hero.y - y0)); }
      g.input.hold('left', false);
      return { moved, p0, p1: pipes(), frames: S.world.stats.frames - f0, calls: S.world.stats.calls };
    }, s);
    if (play.frames < 5) fail(`${label}: ${s} drew only ${play.frames} frames in about 3 s of play`);
    if (play.moved < 20) fail(`${label}: ${s}: the hero moved only ${play.moved.toFixed(1)} units under the held stick`);
    if (play.p0 !== null && play.p1 > play.p0) fail(`${label}: ${s}: ${play.p1 - play.p0} GPU pipeline(s) built mid-game (the warm-up should have built them)`);
    await picture(s);
  }
  for (const e of errors) fail(`${label}: ${e}`);
  await page.close();
}
for (const [s, h] of Object.entries(hashes)) if (h.webgl && h.webgpu && h.webgl !== h.webgpu) fail(`${s}: the proof's hash differs between WebGL 2 (${h.webgl}) and WebGPU (${h.webgpu})`);

/* 3b. shapes in 3D: built, drawn, solid; the sheet beside the 2D pictures */
{
  const { decodePNG } = await import('./asset-lib.mjs');
  for (const want of ['webgl', 'webgpu']) {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    if (want === 'webgpu') await page.addInitScript(standInCanvas);
    const errors = watch(page), label = 'shapes ' + want;
    await page.goto(SITE + '/check/shapes.html' + (want === 'webgl' ? '?backend=webgl' : ''));
    try {
      await page.waitForFunction(() => window.__sheet && __sheet.world && __sheet.world.stats.frames > 2, null, { timeout: 120000 });
      if (want === 'webgpu' && await page.evaluate(() => My3D2dge.World3D.backend) !== 'WebGPU') { notes.push('WebGPU is not available in this browser: the WebGPU runs fell back to WebGL 2'); await page.close(); continue; }
      const shot = async () => { await page.waitForTimeout(300); if (want === 'webgl') return page.screenshot(); const d = await page.evaluate(() => __readFrame(1)); return Buffer.from(d.split(',')[1], 'base64'); };
      const ids = await page.evaluate(() => { const w = __sheet.world, k = w._shapeKit; k._keep = k.outlines; k.outlines = () => {}; return __sheet.IDS; });   // (the frame's own pass would show a hidden shape's outline)
      const info = await page.evaluate(() => ({ n: __sheet.world.shapes.length, kinds: __sheet.world._shapeKit.kinds.size }));
      if (info.n !== ids.length || info.kinds !== ids.length) fail(`${label}: ${info.n} placements and ${info.kinds} kinds for ${ids.length} core shapes`);
      // each shape up close, then without it: its pixels must change where it stands
      const shots = [];
      for (let i = 0; i < ids.length; i++) {
        await page.evaluate(i => __sheet.look(i), i); const a = await shot();
        await page.evaluate(i => { const K = __sheet.world.shapes[i].kind; K.mesh.visible = K.shell.visible = false; }, i); const b = await shot();
        await page.evaluate(i => { const K = __sheet.world.shapes[i].kind; K.mesh.visible = K.shell.visible = true; }, i);
        const A = decodePNG(a), B = decodePNG(b); let changed = 0;
        for (let y = Math.round(A.h * .2); y < Math.round(A.h * .8); y++) for (let x = Math.round(A.w * .3); x < Math.round(A.w * .7); x++) { const j = (y * A.w + x) * 4; if (Math.abs(A.rgba[j] - B.rgba[j]) + Math.abs(A.rgba[j + 1] - B.rgba[j + 1]) + Math.abs(A.rgba[j + 2] - B.rgba[j + 2]) > 24) changed++; }
        if (changed < A.w * A.h / 2000) fail(`${label}: ${ids[i]} draws nothing where it stands (${changed} pixels changed)`);
        shots.push('data:image/png;base64,' + a.toString('base64'));
      }
      // the sheet: each shape's 2D picture (E.shapeSprite, the isometric view) beside its 3D one, drawn on a page of the 2D engine
      const sheet = await browser.newPage(); await sheet.setContent('<!doctype html><html><body></body></html>');
      await sheet.addScriptTag({ content: read('dist/my-3d2dge.js') });
      const png = await sheet.evaluate(async ([ids, shots, facing]) => {
        const E = My3D2dge, C = 5, CW = 300, CH = 170, cv = document.createElement('canvas'); cv.width = C * CW; cv.height = Math.ceil(ids.length / C) * CH; const g = cv.getContext('2d');
        g.fillStyle = '#1c1826'; g.fillRect(0, 0, cv.width, cv.height); g.imageSmoothingEnabled = false; g.font = '13px sans-serif';
        for (let i = 0; i < ids.length; i++) {
          const x = (i % C) * CW, y = Math.floor(i / C) * CH, im = new Image(); im.src = shots[i]; await im.decode();
          const s = E.shapeSprite(ids[i], { view: 'iso', facing }); if (s) { const k = Math.max(1, Math.min(4, Math.floor(Math.min(130 / s.w, 130 / s.h)))); g.drawImage(s.cv, x + 75 - s.w * k / 2, y + 150 - s.h * k, s.w * k, s.h * k); }
          const sw = im.width * .4, sh = im.height * .6; g.drawImage(im, im.width * .3, im.height * .2, sw, sh, x + 150, y + 10, 140, 140 * sh / sw);
          g.fillStyle = '#e8e0f0'; g.fillText(ids[i] + '  (2D | 3D)', x + 8, y + 164);
        }
        return cv.toDataURL('image/png');
      }, [ids, shots, await page.evaluate(() => __sheet.FACING)]);
      writeFileSync(join(OUT, `shapes-${want}.png`), Buffer.from(png.split(',')[1], 'base64')); pictures++; await sheet.close();
      await page.evaluate(() => { const k = __sheet.world._shapeKit; k.outlines = k._keep; });
      // more of one kind than its first slots, and a kind not seen before: no GPU pipeline built (one shader for all)
      const pipes = await page.evaluate(async () => {
        const w = __sheet.world, R = My3D2dge.World3D.renderer, n = () => { const p = R._pipelines; return p && p.caches ? p.caches.size : null; };
        const p0 = n(); for (let i = 0; i < 40; i++) w.shape('barrel', 40 + (i % 10) * 12, 20 + Math.floor(i / 10) * 12, 0, { solid: false }); w.shape('crate', 60, 120, 0, { mats: { c: '#4a8a3a crate' } });
        await new Promise(r => setTimeout(r, 600)); return { p0, p1: n() };
      });
      if (pipes.p0 !== null && pipes.p1 > pipes.p0) fail(`${label}: placing more shapes built ${pipes.p1 - pipes.p0} GPU pipeline(s)`);
      // turned as its box: a bench at facing .9 covers the picture at its two ends and leaves it clear just past its sides
      await page.evaluate(() => { const w = __sheet.world; w.reset(); w.shape('bench', 120, 72, 0, { facing: .9, solid: false }); __sheet.lookAt(120, 72); });
      const oa = decodePNG(await shot()); await page.evaluate(() => { const K = __sheet.world.shapes[0].kind; K.mesh.visible = K.shell.visible = false; }); const ob = decodePNG(await shot());
      await page.evaluate(() => { const K = __sheet.world.shapes[0].kind; K.mesh.visible = K.shell.visible = true; });
      const marks = await page.evaluate(() => {
        const w = __sheet.world, sc = __sheet.game.screen, B = My3D2dge.shapeBox('bench', 120, 72, 0, { facing: .9 }), z = B.top - 1, at = (lx, ly) => w.project(B.x + lx * B.c - ly * B.s, B.y + lx * B.s + ly * B.c, z);
        return { ends: [at(B.hx - 2, 0), at(2 - B.hx, 0)].map(p => p && [p[0] / sc.W, p[1] / sc.H]), sides: [at(0, B.hy + 5), at(0, -B.hy - 5)].map(p => p && [p[0] / sc.W, p[1] / sc.H]) };
      });
      const near = ([u, v]) => { let n = 0; const cx = Math.round(u * oa.w), cy = Math.round(v * oa.h), R = Math.max(1, Math.round(oa.w / 400)); for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) { const j = (y * oa.w + x) * 4; if (Math.abs(oa.rgba[j] - ob.rgba[j]) + Math.abs(oa.rgba[j + 1] - ob.rgba[j + 1]) + Math.abs(oa.rgba[j + 2] - ob.rgba[j + 2]) > 24) n++; } return n; };
      if (marks.ends.some(p => !p || !near(p)) || marks.sides.some(p => p && near(p))) fail(`${label}: a bench turned to .9 is not drawn where its box is (its ends ${marks.ends.map(p => p ? near(p) : 'off').join(', ')} pixels changed, beside it ${marks.sides.map(p => p ? near(p) : 'off').join(', ')})`);
      // the outline turns with the shape: row by row, it reaches past the silhouette on both sides
      await page.evaluate(() => { const k = __sheet.world._shapeKit; k._keep = k.outlines; k.outlines = () => {}; });
      for (const [id, f] of [['crate', -Math.PI / 2], ['barrel', 0]]) {
        await page.evaluate(([id, f]) => { const w = __sheet.world; w.reset(); w.shape(id, 120, 72, 0, { facing: f, solid: false }); __sheet.lookAt(120, 72); }, [id, f]);
        const vis = (m, s) => page.evaluate(([m, s]) => { const K = __sheet.world.shapes[0].kind; K.mesh.visible = m; K.shell.visible = s; }, [m, s]);
        const full = decodePNG(await shot()); await vis(true, false); const body = decodePNG(await shot()); await vis(false, false); const bg = decodePNG(await shot()); await vis(true, true);
        const span = (A, y) => { let lo = -1, hi = -1; for (let x = 0; x < A.w; x++) { const j = (y * A.w + x) * 4; if (Math.abs(A.rgba[j] - bg.rgba[j]) + Math.abs(A.rgba[j + 1] - bg.rgba[j + 1]) + Math.abs(A.rgba[j + 2] - bg.rgba[j + 2]) > 24) { if (lo < 0) lo = x; hi = x; } } return [lo, hi]; };
        let rows = 0, left = 0, right = 0;
        for (let y = 0; y < bg.h; y++) { const [b0, b1] = span(body, y); if (b0 < 0) continue; const [f0, f1] = span(full, y); rows++; if (f0 < b0) left++; if (f1 > b1) right++; }
        if (!rows || left < rows * .6 || right < rows * .6) fail(`${label}: a ${id} turned to ${f.toFixed(2)}: its outline reaches past it on the left in ${left} and the right in ${right} of ${rows} rows`);
      }
      await page.evaluate(() => { const k = __sheet.world._shapeKit; k.outlines = k._keep; });
      // solid: a hero walks east into a crate and stops; one dropped over a table lands on its top
      const solid = await page.evaluate(() => {
        const w = __sheet.world, g = __sheet.game; g.stop(); w.reset();
        const c = w.shape('crate', 120, 72, 0, { facing: Math.PI / 2 }), t = w.shape('table', 220, 72, 0, { facing: Math.PI / 2 }), b = My3D2dge.shapeBox('crate', 120, 72, 0, { facing: Math.PI / 2 });
        const h = w.hero({ x: 80, y: 72, rig: new My3D2dge.Humanoid() }); for (let i = 0; i < 120; i++) { h.vx = 60; h.vy = 0; w.step(1 / 60); }
        const stop = h.x, edge = b.x - b.hx;
        h.place(220, 72, 40); h.vx = h.vy = 0; for (let i = 0; i < 120; i++) { h.vx = h.vy = 0; w.step(1 / 60); }
        const top = My3D2dge.shapeBox('table', 220, 72, 0, { facing: Math.PI / 2 }).top;
        // a long bench turned two ways: a small hero dropped over its far end lands on it, one dropped beside it reaches the floor
        const turned = [0, Math.PI / 2 + .6].map(f => {
          w.reset(); const B = My3D2dge.shapeBox('bench', 160, 72, 0, { facing: f }), at = (lx, ly) => [B.x + lx * B.c - ly * B.s, B.y + lx * B.s + ly * B.c];
          w.shape('bench', 160, 72, 0, { facing: f });
          const drop = ([x, y]) => { const a = w.hero({ x, y, z: 30, r: 1.2, half: 3, rig: new My3D2dge.Humanoid() }); for (let i = 0; i < 90; i++) { a.vx = a.vy = 0; w.step(1 / 60); } const z = a.z; w.remove(a); return z; };
          return { f, on: drop(at(B.hx - 2, 0)), beside: drop(at(0, B.hy + 4)), top: B.top };
        });
        return { stop, edge, z: h.z, top, bodies: !!(c.body && t.body), turned };
      });
      if (!solid.bodies) fail(`${label}: a solid shape has no collider`);
      if (solid.stop > solid.edge) fail(`${label}: a hero walking into a crate passed its edge (x ${solid.stop.toFixed(1)}, the edge at ${solid.edge.toFixed(1)})`);
      if (Math.abs(solid.z - solid.top) > 2) fail(`${label}: a hero dropped on a table stands at z ${solid.z.toFixed(1)}, its top is ${solid.top.toFixed(1)}`);
      for (const t of solid.turned) if (Math.abs(t.on - t.top) > 2 || t.beside > 2) fail(`${label}: a bench turned to ${t.f.toFixed(2)}: a hero over its end stands at z ${t.on.toFixed(1)} (its top ${t.top.toFixed(1)}), one beside it at ${t.beside.toFixed(1)}: its collider is not where it is drawn`);
    } catch (e) { fail(label + ': ' + e.message.split('\n')[0]); }
    for (const e of errors) fail(label + ': ' + e);
    await page.close();
  }
}

/* 4. an upright phone */
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }), errors = watch(page);
  await page.goto(SITE + '/kits/3d-' + SLICES[0] + '?backend=webgl#' + SLICES[0]);
  try {
    await page.waitForFunction(id => window.__game && __game.game.sceneName === id && __game.scenes[id].world.stats.frames > 2, SLICES[0], { timeout: 120000 });
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => {
      const v = document.getElementById('view').getBoundingClientRect(), sc = __game.game.screen, s = document.getElementById('screen').getBoundingClientRect();
      const under = Math.abs(v.width - sc.W * sc.S / sc.dpr) < 1.5 && Math.abs(v.height - sc.H * sc.S / sc.dpr) < 1.5 && v.width >= s.width - 2 && v.height >= s.height - 2;
      return { under, buttons: document.querySelectorAll('[data-act]').length, w: v.width, h: v.height, sw: s.width, sh: s.height };
    });
    if (!r.under) fail(`phone: the 3D picture (${r.w} x ${r.h}) is not laid exactly under the game's (${r.sw} x ${r.sh})`);
    if (r.buttons < 2) fail(`phone: ${r.buttons} touch buttons`);
    await page.screenshot({ path: join(OUT, 'phone.png') }); pictures++;
  } catch (e) { fail('phone: ' + e.message.split('\n')[0]); }
  for (const e of errors) fail('phone: ' + e);
  await page.close();
}

await browser.close();
server.close();
for (const n of [...new Set(notes)]) console.log('note: ' + n);
if (problems.length) { console.error('3D kits check FAILED:\n  ' + problems.join('\n  ')); process.exit(1); }
console.log(`3D kits check passed: the rules hold in ${SOURCES.length} sources; the manual's quick start runs; ${pages.length} pages on WebGL 2 and WebGPU, ${SLICES.length} slices (${Object.entries(hashes).map(([s, h]) => s + ' ' + (h.webgl || h.webgpu)).join(', ')}: the same hash on both backends and run again, no pipeline built mid-game); the phone; ${pictures} pictures in check-output/kit3d/`);
