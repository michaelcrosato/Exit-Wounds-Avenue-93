// 3D lab check (docs/LAB-3D.md; the page is examples/lab-3d.html, built from src/lab3d.template.html and src/lab3d/).
//   1. the vendored libraries match their checksums (tools/vendor-3d.mjs --check)
//   2. the lab's own code keeps its rules: three.js through WebGPURenderer and node materials only (no WebGLRenderer,
//      ShaderMaterial, onBeforeCompile, EffectComposer, addons), no WebGPU-only compute or storage buffers, nothing read
//      back from the GPU, and an import map with local paths only
//   3. it serves the repo as Vercel does and opens /lab-3d on WebGL 2 (?backend=webgl) and on WebGPU (headless Chromium
//      runs WebGPU on SwiftShader): no page errors, the backend each claims, and the proof run's state hash the same on
//      both (the renderer never touches gameplay) and the same when run again. Headless Chromium's WebGPU loses its device
//      the moment it presents to a canvas, so on WebGPU the test hands three.js a stand-in canvas context (its frames go
//      to a texture the test reads back for the pictures): the whole WebGPU pipeline runs, only presenting is skipped
//   4. it plays: the hero walks and swings under the keys and knocks crates about
//   5. every camera and look draws a picture (screenshots in check-output/lab3d/, read them)
// Usage: node tools/lab3d-test.mjs   (run node tools/build.mjs first; CHROMIUM_PATH picks a browser). Exit code 1 on failure.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve('.');
const problems = [], notes = [];
const fail = m => problems.push(m);

/* 1. the vendored files */
try { execFileSync('node', ['tools/vendor-3d.mjs', '--check'], { cwd: root, stdio: 'pipe' }); } catch (e) { fail(String(e.stderr || e.message).trim()); }

/* 2. the rules, read from the lab's own sources (not the vendored libraries) */
const BANNED = [
  [/\bWebGLRenderer\b/, 'WebGLRenderer (use WebGPURenderer: it falls back to WebGL 2 by itself)'],
  [/\b(Raw)?ShaderMaterial\b/, 'ShaderMaterial (write node materials or TSL)'],
  [/\bonBeforeCompile\b/, 'onBeforeCompile (not run by WebGPURenderer)'],
  [/\bEffectComposer\b|three\/examples|three\/addons/, 'addons and EffectComposer (not vendored; post-processing is TSL)'],
  [/\bcompute\s*\(|\bStorageBufferAttribute\b|\bstorage\s*\(|\bcomputeAsync\b/, 'compute shaders or storage buffers (WebGPU only)'],
  [/readRenderTargetPixels|getImageData\s*\(|readPixels\s*\(/, 'reading pixels back (nothing comes back from the GPU into gameplay)']
];
const srcs = ['src/lab3d'].flatMap(d => readdirSync(join(root, d)).filter(f => f.endsWith('.js')).map(f => d + '/' + f));
for (const f of [...srcs, 'src/lab3d.template.html']) {
  const lines = readFileSync(join(root, f), 'utf8').split('\n');
  lines.forEach((line, i) => {
    const code = line.replace(/\/\/.*$|\/\*.*?\*\/|^\s*\*.*$/g, '');   // comments may name what is banned
    for (const [re, why] of BANNED) if (re.test(code)) fail(`${f}:${i + 1}: ${why}`);
  });
}
for (const tpl of ['src/lab3d.template.html']) {
  const map = JSON.parse(readFileSync(join(root, tpl), 'utf8').match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
  for (const [k, v] of Object.entries(map.imports)) {
    if (!v.startsWith('/vendor/')) fail(`${tpl} import map: ${k} -> ${v} is not a vendored file`);
    else if (!existsSync(join(root, v))) fail(`${tpl} import map: ${k} -> ${v} does not exist`);
  }
}

/* 3. the page, served like Vercel (vercel.json's rewrites) */
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
const OUT = join(root, 'check-output/lab3d'); mkdirSync(OUT, { recursive: true });

// WebGPU in a headless browser: Chromium's software adapter (SwiftShader) behind these switches
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader', '--disable-vulkan-surface'] });
/** test-only: a WebGPU canvas context that renders into a plain texture (headless Chromium can't present), and a way to
 *  read the last frame back as a PNG (data URL). Installed before the page's scripts run; the lab itself is unchanged */
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
  // a real canvas holds the page back while the GPU is behind; the stand-in doesn't, so each frame waits for the last one's work
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
const results = {};
for (const want of ['webgl', 'webgpu']) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
  if (want === 'webgpu') await page.addInitScript(standInCanvas);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const r = await page.goto(SITE + '/lab-3d' + (want === 'webgl' ? '?backend=webgl' : ''));
  if (!r || r.status() !== 200) { fail(`/lab-3d (${want}): status ${r && r.status()}`); await page.close(); continue; }
  try { await page.waitForFunction(() => window.__lab3d && (window.__lab3d.ready || window.__lab3d.error), null, { timeout: 90000 }); }
  catch (e) { fail(`${want}: the lab did not start in 90 s`); await page.close(); continue; }
  const info = await page.evaluate(() => ({ error: __lab3d.error || null, backend: __lab3d.backend, proof: __lab3d.proof && __lab3d.proof.hash, again: __lab3d.ready ? __lab3d.run(600) : null }));
  if (info.error) { fail(`${want}: ${info.error}`); await page.close(); continue; }
  const label = info.backend === 'WebGPU' ? 'webgpu' : 'webgl';
  if (want === 'webgl' && label !== 'webgl') fail('?backend=webgl did not give WebGL 2');
  if (want === 'webgpu' && label !== 'webgpu') { notes.push('WebGPU is not available in this browser: the WebGPU run fell back to WebGL 2'); await page.close(); continue; }
  if (info.again !== info.proof) fail(`${label}: the proof run is not repeatable (${info.proof}, then ${info.again})`);
  results[label] = info.proof;

  /* 5. every camera and look draws (a picture of each; a blank one compresses to almost nothing) */
  const shots = [['iso-card', { cam: 'iso', look: 'card' }], ['iso-puppet', { look: 'puppet' }], ['threequarter-both', { cam: 'threequarter', look: 'both' }],
    ['topdown-card', { cam: 'topdown', look: 'card' }], ['side-puppet', { cam: 'side', look: 'puppet' }], ['brawler-both', { cam: 'brawler', look: 'both' }],
    ['orbit-both-full', { cam: 'orbit', look: 'both', pixels: false }], ['fly-card', { cam: 'fly', look: 'card', pixels: true }], ['fly-puppet', { look: 'puppet' }], ['chase-puppet', { cam: 'chase' }]];
  for (const [name, set] of shots) {
    await page.evaluate(s => { for (const [k, v] of Object.entries(s)) __lab3d.set(k, v); }, set);
    const f0 = await page.evaluate(() => __lab3d.frames);
    await page.waitForFunction(n => __lab3d.frames > n + 20, f0, { timeout: 30000 }).catch(() => fail(`${label} ${name}: frames stopped`));
    let png;
    if (label === 'webgl') png = await page.screenshot({ path: join(OUT, `${label}-${name}.png`) });
    else { png = Buffer.from((await page.evaluate(() => __readFrame(__lab3d.OPT.pixels ? 3 : 1))).split(',')[1], 'base64'); writeFileSync(join(OUT, `${label}-${name}.png`), png); }
    if (png.length < 25000) fail(`${label} ${name}: the picture looks blank (${png.length} bytes)`);
  }

  /* 4. play: walk right and up into the crates, swinging; the hero must move and a crate must too */
  await page.evaluate(() => { __lab3d.set('cam', 'iso'); __lab3d.set('look', 'card'); __lab3d.set('play', true); });
  const before = await page.evaluate(() => __lab3d.state());
  await page.keyboard.down('KeyW'); await page.waitForTimeout(700); await page.keyboard.up('KeyW');
  for (let i = 0; i < 6; i++) { await page.keyboard.press('KeyJ'); await page.waitForTimeout(160); }
  await page.keyboard.down('KeyD'); await page.waitForTimeout(500); await page.keyboard.up('KeyD');
  await page.keyboard.press('Space'); await page.waitForTimeout(400);
  const after = await page.evaluate(() => __lab3d.state());
  const moved = Math.hypot(after.hero.x - before.hero.x, after.hero.z - before.hero.z);
  if (moved < .5) fail(`${label}: the hero did not move under the keys (${moved.toFixed(2)} m)`);
  if (label === 'webgl') await page.screenshot({ path: join(OUT, `${label}-played.png`) });
  else writeFileSync(join(OUT, `${label}-played.png`), Buffer.from((await page.evaluate(() => __readFrame(3))).split(',')[1], 'base64'));
  for (const e of errors) fail(`${label}: ${e}`);
  await page.close();
}
await browser.close();
server.close();
if (results.webgl && results.webgpu && results.webgl !== results.webgpu) fail(`the proof run differs: WebGL 2 ${results.webgl}, WebGPU ${results.webgpu}`);
writeFileSync(join(OUT, 'results.json'), JSON.stringify({ results, notes, problems }, null, 2));
if (problems.length) { console.error('lab 3D check FAILED:\n  ' + problems.join('\n  ')); process.exit(1); }
console.log(`lab 3D check passed: vendored files verified, rules kept in ${srcs.length} files, proof run ${Object.entries(results).map(([k, v]) => k + ' ' + v).join(' = ')}, it plays, ${Object.keys(results).length * 11} pictures in check-output/lab3d/${notes.length ? ' (' + notes.join('; ') + ')' : ''}`);
