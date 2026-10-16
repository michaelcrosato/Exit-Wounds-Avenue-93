// The 3D world stress test's check (docs/LAB-3D.md; the page is examples/stress-world.html, built from
// src/stress-world.template.html and src/stress-world/).
//   1. its own sources keep the 3D labs' rules: three.js through WebGPURenderer and node materials only (no WebGLRenderer,
//      ShaderMaterial, onBeforeCompile, EffectComposer, addons), no WebGPU-only compute or storage buffers, nothing read
//      back from the GPU, and an import map with local, existing files only
//   2. it serves the repo as Vercel does and opens /stress-world on WebGL 2 (?backend=webgl) and on WebGPU (headless
//      Chromium runs WebGPU on SwiftShader, through the same stand-in canvas as tools/lab3d-test.mjs): no page errors, the
//      backend each claims, and the proof run's state hash the same on both and the same when run again (the game and
//      its physics never read the renderer)
//   3. a fight with every monster kind draws as cards and as puppets without building a GPU pipeline mid-fight (the
//      warm-up's job), nor when the crowd grows past the card atlas pages the warm-up made; the hero kills monsters and
//      some fly, the panel's numbers fill in
//   4. physics: the hero jumps, climbs the stairs onto a gallery, monsters find their way up after him, a crate is knocked
//      about
//   5. every camera (the five views, side scrolling with depth, custom, orthographic, chase, first person, fly, fixed)
//      and every filter draws a picture (check-output/stress-world/: read them); W walks the hero away from a fixed
//      camera; the benchmark writes its report
// Usage: node tools/stress-world-test.mjs   (run node tools/build.mjs first; CHROMIUM_PATH picks a browser). Exit code 1 on failure.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';

const root = resolve('.');
const problems = [], notes = [];
const fail = m => problems.push(m);

/* 1. the rules, read from the page's own sources (not the vendored libraries) */
const BANNED = [
  [/\bWebGLRenderer\b/, 'WebGLRenderer (use WebGPURenderer: it falls back to WebGL 2 by itself)'],
  [/\b(Raw)?ShaderMaterial\b/, 'ShaderMaterial (write node materials or TSL)'],
  [/\bonBeforeCompile\b/, 'onBeforeCompile (not run by WebGPURenderer)'],
  [/\bEffectComposer\b|three\/examples|three\/addons/, 'addons and EffectComposer (not vendored; post-processing is TSL)'],
  [/\bcompute\s*\(|\bStorageBufferAttribute\b|\bstorage\s*\(|\bcomputeAsync\b/, 'compute shaders or storage buffers (WebGPU only)'],
  [/readRenderTargetPixels|getImageData\s*\(|readPixels\s*\(/, 'reading pixels back (nothing comes back from the GPU into gameplay)']
];
const DIR = 'src/stress-world', TPL = 'src/stress-world.template.html';
const srcs = readdirSync(join(root, DIR)).filter(f => f.endsWith('.js')).map(f => DIR + '/' + f);
for (const f of [...srcs, TPL]) {
  readFileSync(join(root, f), 'utf8').split('\n').forEach((line, i) => {
    const code = line.replace(/\/\/.*$|\/\*.*?\*\/|^\s*\*.*$/g, '');   // comments may name what is banned
    for (const [re, why] of BANNED) if (re.test(code)) fail(`${f}:${i + 1}: ${why}`);
  });
}
{
  const map = JSON.parse(readFileSync(join(root, TPL), 'utf8').match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
  for (const [k, v] of Object.entries(map.imports)) {
    if (!v.startsWith('/vendor/')) fail(`${TPL} import map: ${k} -> ${v} is not a vendored file`);
    else if (!existsSync(join(root, v))) fail(`${TPL} import map: ${k} -> ${v} does not exist`);
  }
}

/* 2. the page, served like Vercel (vercel.json's rewrites) */
const rules = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')).rewrites.map(r => ({
  re: new RegExp('^' + r.source.replace(/\./g, '\\.').replace(/:(\w+)\(([^)]+)\)/g, '(?<$1>$2)').replace(/:(\w+)(?![\w>])/g, '(?<$1>[^/]+)') + '$'),
  to: r.destination,
}));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json' };
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
const OUT = join(root, 'check-output/stress-world'); mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader', '--disable-vulkan-surface'] });
/** test-only (as tools/lab3d-test.mjs): a WebGPU canvas context that renders into a plain texture (headless Chromium
 *  can't present), and a way to read the last frame back as a PNG (data URL). Installed before the page's scripts run */
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
const hashes = {}, done = [];
let pictures = 0;
for (const want of ['webgl', 'webgpu']) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
  if (want === 'webgpu') await page.addInitScript(standInCanvas);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const r = await page.goto(SITE + '/stress-world' + (want === 'webgl' ? '?backend=webgl' : ''));
  if (!r || r.status() !== 200) { fail(`/stress-world (${want}): status ${r && r.status()}`); await page.close(); continue; }
  try { await page.waitForFunction(() => window.__sw && (__sw.ready || __sw.error), null, { timeout: 120000 }); }
  catch (e) { fail(`${want}: the page did not start in 120 s`); await page.close(); continue; }
  const st = await page.evaluate(() => ({ error: __sw.error || null, backend: __sw.backend }));
  if (st.error) { fail(`${want}: ${st.error}`); await page.close(); continue; }
  const label = st.backend === 'WebGPU' ? 'webgpu' : 'webgl';
  if (want === 'webgl' && label !== 'webgl') fail('?backend=webgl did not give WebGL 2');
  if (want === 'webgpu' && label !== 'webgpu') { notes.push('WebGPU is not available in this browser: the WebGPU run fell back to WebGL 2'); await page.close(); continue; }
  const frames = async (what, n = 6) => { const f0 = await page.evaluate(() => __sw.STATS.frames); await page.waitForFunction(k => __sw.STATS.frames > k, f0 + n, { timeout: 90000 }).catch(() => fail(`${label} ${what}: frames stopped`)); };
  const picture = async name => {
    let png;
    if (label === 'webgl') png = await page.screenshot({ path: join(OUT, `${label}-${name}.png`) });
    else { png = Buffer.from((await page.evaluate(() => __readFrame(3))).split(',')[1], 'base64'); writeFileSync(join(OUT, `${label}-${name}.png`), png); }
    pictures++; return png;
  };
  const pipelines = () => page.evaluate(() => { const p = __sw.renderer._pipelines; return p && p.caches ? p.caches.size : null; });
  await frames('start', 3);

  /* the proof: the scripted fight's hash, twice */
  const proof = await page.evaluate(() => [__sw.run(600), __sw.run(600)]);
  if (proof[0] !== proof[1]) fail(`${label}: the proof run is not repeatable (${proof.join(', then ')})`);
  hashes[label] = proof[0];
  await frames('after the proof', 3);

  /* 3. a fight: every kind of monster and rig, the hero swinging and throwing, wisps lit */
  const p0 = await pipelines();
  const fight = await page.evaluate(() => {
    const W = __sw; W.S.skin = 'mixed'; W.S.monsterLights = true; W.setMonsters(36, true);
    let flew = 0;
    for (let i = 0; i < 40; i++) { W.step(15, { attack: 15, skill: 60 }); for (const e of W.corpses) if (e.z > 8) flew++; }
    return { alive: W.enemies.filter(e => e.alive).length, dead: 36 - W.enemies.filter(e => e.alive).length, flew, kinds: [...new Set(W.enemies.map(e => e.type))].length };
  });
  if (fight.dead < 3) fail(`${label}: the hero killed only ${fight.dead} of 36 monsters in 10 s of swinging`);
  if (!fight.flew) fail(`${label}: no fallen monster flew (launches)`);
  for (const look of ['card', 'puppet']) {
    await page.evaluate(l => { __sw.set('look', l); __sw.setMonsters(36, true); __sw.step(240, { attack: 15 }); }, look);
    await frames(look, 8);
    const drawn = await page.evaluate(() => __sw.STATS.drawn);
    if (drawn < 10) fail(`${label} ${look}: only ${drawn} characters drawn`);
    const png = await picture('fight-' + look);
    if (png.length < 25000) fail(`${label} ${look}: the picture looks blank (${png.length} bytes)`);
  }
  const p1 = await pipelines();
  if (p0 !== null && p1 !== p0) fail(`${label}: ${p1 - p0} GPU pipelines were built during the fight (the warm-up should have built them)`);
  // a crowd that needs more card atlas pages than the warm-up made: still none (every page shares one shader)
  await page.evaluate(() => { __sw.set('look', 'card'); __sw.setMonsters(300, true); __sw.step(120); });
  await frames('a big crowd', 4);
  const big = await page.evaluate(() => __sw.STATS.drawn), p2 = await pipelines();
  if (p0 !== null && p2 !== p0) fail(`${label}: ${p2 - p0} GPU pipelines were built when the crowd grew to ${big} cards on screen (a new atlas page should share the first one's)`);
  const panel = await page.evaluate(() => ['fpsBig', 'mMonsters', 'mPhys', 'mRender', 'mBodies', 'mGpu'].map(id => document.getElementById(id).textContent));
  if (!/\d/.test(panel[1]) || !/ms/.test(panel[2]) || !/\d/.test(panel[4]) || !/three\.js/.test(panel[5])) fail(`${label}: the panel's numbers did not fill in (${panel.join(' | ')})`);

  /* 4. physics: a jump, the stairs to a gallery (monsters following), a crate knocked about */
  const phys = await page.evaluate(() => {
    const W = __sw, H = W.hero, out = {};
    W.setMonsters(0); W.step(30);
    // the press held 6 steps, as the game's input buffer holds one: a stray hit from the fight starts a hit-stop that skips steps
    const z0 = H.z; let top = z0; W.step(6, { jump: 1 }); for (let i = 0; i < 60; i++) { W.step(1); top = Math.max(top, H.z); }
    out.jump = top - z0;
    const go = (x, y, n) => { for (let i = 0; i < n; i++) { const dx = x - H.x, dy = y - H.y, d = Math.hypot(dx, dy); if (d < 4) return true; W.step(1, { move: [dx / d, dy / d] }); } return false; };
    // (each check starts from a known place: the fight before leaves the hero and the props anywhere)
    W.placeHero(12.5 * 16, 12 * 16); W.step(10);   // at the foot of the west gallery's stairs, then up them
    out.stairs = go(12.5 * 16, 2.5 * 16, 600); out.galleryZ = H.z;
    W.S.mix = 'humanoids'; W.setMonsters(16, true); W.step(1800);
    out.followed = W.enemies.filter(e => e.alive && e.z > 12).length;
    W.setMonsters(0); W.S.mix = 'balanced';
    // a crate on the floor: the hero placed beside it on the side toward the hall's centre, swinging at it
    const p = W.PROPS.find(q => q.kind === 'crate' && q.z < 8) || W.PROPS[0], a0 = [p.x, p.y], cx = 32 * 16 - p.x, cy = 22 * 16 - p.y, cd = Math.hypot(cx, cy) || 1;
    W.placeHero(p.x + cx / cd * 18, p.y + cy / cd * 18); W.step(5);
    for (let i = 0; i < 40; i++) W.step(1, { attack: 10, aim: Math.atan2(p.y - H.y, p.x - H.x) });
    W.step(60);
    out.crate = Math.hypot(p.x - a0[0], p.y - a0[1]);
    return out;
  });
  if (!(phys.jump > 18)) fail(`${label}: the hero's jump rose ${phys.jump.toFixed(1)} units (want over 18)`);
  if (!phys.stairs || !(phys.galleryZ > 14)) fail(`${label}: the hero did not climb the stairs onto the gallery (height ${phys.galleryZ.toFixed(1)})`);
  if (!phys.followed) fail(`${label}: no monster found its way up onto the gallery`);
  if (!(phys.crate > 4)) fail(`${label}: the swung-at crate moved ${phys.crate.toFixed(1)} units`);

  /* 5. every camera draws the fight */
  await page.evaluate(() => { __sw.setMonsters(30, true); __sw.step(300); });
  const CAMS = [['iso', () => __sw.setView('iso')], ['threequarter', () => __sw.setView('threequarter')], ['topdown', () => __sw.setView('topdown')], ['brawler', () => __sw.setView('brawler')],
    ['side', () => __sw.setView('side')], ['depth', () => __sw.setDepth(true)], ['custom', () => { __sw.setDepth(false); __sw.setView('custom'); }], ['ortho', () => { __sw.setView('iso'); __sw.setProj('ortho'); }],
    ['chase', () => { __sw.setProj('persp'); __sw.setCam('chase'); }], ['first', () => __sw.setCam('first')], ['fly', () => __sw.setCam('fly')], ['fixed', () => __sw.toggleFix()]];
  for (const [name, fn] of CAMS) {
    await page.evaluate(fn); await frames('camera ' + name, 4);
    const s = await page.evaluate(() => ({ mode: __sw.CAM.mode, view: __sw.CAM.view, drawn: __sw.STATS.drawn }));
    const png = await picture('cam-' + name);
    if (png.length < 15000) fail(`${label} camera ${name}: the picture looks blank (${png.length} bytes)`);
    if (['chase', 'first', 'fly', 'fixed'].includes(name) && s.mode !== name) fail(`${label}: the ${name} camera did not take (${s.mode})`);
    if (s.drawn < 1 && name !== 'first') fail(`${label} camera ${name}: nothing drawn`);
  }
  // in the fixed 3D camera, W walks the hero away from it
  await page.evaluate(() => __sw.setMonsters(0));
  const before = await page.evaluate(() => [__sw.hero.x, __sw.hero.y, __sw.CAM.pose.yaw, __sw.SIM.time]);
  await page.keyboard.down('KeyW');
  await page.waitForFunction(t => __sw.SIM.time > t, before[3] + .6, { timeout: 60000 }).catch(() => fail(`${label}: the game stopped while W was held`));
  await page.keyboard.up('KeyW');
  const after = await page.evaluate(() => [__sw.hero.x, __sw.hero.y]);
  const fwd = (after[0] - before[0]) * Math.cos(before[2]) + (after[1] - before[1]) * Math.sin(before[2]);
  if (!(fwd > 4)) fail(`${label}: W did not walk the hero away from the fixed camera (${fwd.toFixed(1)} units)`);

  /* every filter draws */
  await page.evaluate(() => { __sw.setCam('view'); __sw.setView('iso'); __sw.setMonsters(24, true); __sw.step(240); });
  for (const [name, look, to, extras] of [['cel-all', 'cel', 'all', false], ['cel-objects', 'cel', 'objects', false], ['pixel-env', 'pixel', 'env', false], ['pixel-all-bloom-fxaa', 'pixel', 'all', true], ['clean', 'clean', 'all', false]]) {
    await page.evaluate(([l, t, x]) => {
      document.querySelector(`[data-fx=${l}]`).click(); const s = document.getElementById('fxApply'); s.value = t; s.dispatchEvent(new Event('change'));
      for (const id of ['fxBloom', 'fxFxaa']) { const c = document.getElementById(id); c.checked = x; c.dispatchEvent(new Event('change')); }
    }, [look, to, extras]);
    await frames('filter ' + name, 4);
    const png = await picture('fx-' + name);
    if (png.length < 25000) fail(`${label} filter ${name}: the picture looks blank (${png.length} bytes)`);
  }
  const desc = await page.evaluate(() => __sw.rendererDesc());
  if (!/Rapier/.test(desc) || !/no filter/.test(desc)) fail(`${label}: the report's renderer line is off (${desc})`);
  // the benchmark: in a headless browser it stops after its first step (under 20 fps) and writes its report
  if (label === 'webgl') {
    await page.evaluate(() => __sw.benchStart());
    await page.waitForFunction(() => !__sw.bench, null, { timeout: 120000 }).catch(() => fail('the benchmark did not finish'));
    const rep = await page.evaluate(() => __sw.report);
    if (!/physics ms \| logic ms \| drawing ms \| CPU ms/.test(rep) || !/Rapier/.test(rep)) fail('the benchmark report is off: ' + rep.slice(0, 200));
  }
  for (const e of errors) fail(`${label}: ${e}`);
  done.push(label);
  await page.close();
}
await browser.close();
server.close();
if (hashes.webgl && hashes.webgpu && hashes.webgl !== hashes.webgpu) fail(`the proof run differs: WebGL 2 ${hashes.webgl}, WebGPU ${hashes.webgpu}`);
writeFileSync(join(OUT, 'results.json'), JSON.stringify({ hashes, notes, problems }, null, 2));
if (problems.length) { console.error('stress world check FAILED:\n  ' + problems.join('\n  ')); process.exit(1); }
console.log(`stress world check passed: rules kept in ${srcs.length} files, proof run ${Object.entries(hashes).map(([k, v]) => k + ' ' + v).join(' = ')}, a fight in both looks with no pipeline built mid-fight on ${done.join(' and ')}, the hero jumps and climbs to a gallery with monsters following, crates fly, every camera and filter draws (${pictures} pictures in check-output/stress-world/)${notes.length ? ' (' + notes.join('; ') + ')' : ''}`);
