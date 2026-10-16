/* =============================================================================
 * THE PANEL: the controls (the 2D stress test's, plus the 3D world's own: the camera's projection, physics), the
 * metrics (with the physics apart from the game logic), presets, the benchmark and its report, full screen, and
 * window.__sw for tests and agents:
 *   { ready, backend, error, S, SIM, CAM, R3, FX, STATS, hero, enemies, corpses, PROPS, renderer,
 *     set(key, value), setCam(mode), setView(v), setDepth(on), setProj(p), setMonsters(n, instant), setProps(n), placeHero(x, y),
 *     step(n, o) (n game steps of STEP: o.move [x, y], o.attack / dash / jump / skill: every that many steps),
 *     run(n) (the proof: the scripted fight's hash), hash(), benchStart(), bench, report }
 * ============================================================================= */
const ema = { physics: 0, logic: 0, draw: 0 };
const ft = []; let hudT = 0, lastHud = 0, refreshEst = 60;
function pct(arr, p) { const a = arr.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(a.length * p))] || 0; }
function snapRefresh(f) { const R = [30, 50, 60, 75, 90, 100, 120, 144, 165, 180, 240, 360]; let best = 60; for (const r of R) if (Math.abs(r - f) < Math.abs(best - f)) best = r; return best; }

/* ---- the frame-time graph ---- */
const graph = $('graph'), gctx = graph.getContext('2d');
function sizeGraph() { const d = Math.min(3, devicePixelRatio || 1), rc = graph.getBoundingClientRect(); graph.width = Math.max(1, Math.round(rc.width * d)); graph.height = Math.max(1, Math.round(rc.height * d)); }
sizeGraph(); addEventListener('resize', sizeGraph);
function drawGraph() {
  const w = graph.width, h = graph.height, g = gctx, maxMs = 50, cs = getComputedStyle(document.documentElement);
  g.clearRect(0, 0, w, h);
  const y = ms => h - Math.min(1, ms / maxMs) * h;
  g.fillStyle = cs.getPropertyValue('--line').trim() || 'rgba(255,255,255,.2)';
  for (const m of [1000 / 60, 1000 / 30]) g.fillRect(0, Math.round(y(m)), w, 1);
  const n = Math.min(ft.length, 180), bw = w / 180;
  for (let i = 0; i < n; i++) {
    const ms = ft[ft.length - n + i];
    g.fillStyle = ms <= 18 ? cs.getPropertyValue('--good') : ms <= 34 ? cs.getPropertyValue('--warn') : cs.getPropertyValue('--bad');
    g.fillRect(Math.floor(i * bw), Math.round(y(ms)), Math.max(1, Math.ceil(bw)), h);
  }
}
function hwInfo() {
  const lines = [], ua = navigator.userAgentData;
  lines.push('Browser: ' + (ua && ua.brands ? ua.brands.filter(b => !/Not/i.test(b.brand)).map(b => b.brand + ' ' + b.version).join(', ') + (ua.platform ? ' on ' + ua.platform : '') : navigator.userAgent));
  lines.push('CPU threads: ' + (navigator.hardwareConcurrency || 'unknown') + (navigator.deviceMemory ? ', memory about ' + navigator.deviceMemory + ' GB' : ''));
  lines.push('Screen: ' + screen.width + '×' + screen.height + ' at ' + (devicePixelRatio || 1) + 'x pixel ratio');
  let g = '';
  try { const c = document.createElement('canvas').getContext('webgl'), ext = c && c.getExtension('WEBGL_debug_renderer_info'); g = ext ? c.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ''; } catch (e) { g = ''; }
  lines.push('GPU: ' + (g || 'not reported by the browser') + ' (drawing on ' + BACKEND + ')');
  return lines;
}
let hwLines = null;
function hint(fps, frameMs) {
  const cpu = ema.physics + ema.logic + ema.draw;
  if (fps >= refreshEst * .93) return ['Headroom', 'good', 'Running at the display\'s refresh rate. Add more load to find the limit.'];
  if (ema.physics > frameMs * .4) return ['Physics-bound', 'warn', 'Rapier\'s step takes most of each frame: fewer monsters or props, or fewer solver iterations, help most.'];
  if (cpu > frameMs * .75) return ['CPU-bound', 'warn', 'Game logic and drawing use most of each frame. Fewer monsters, puppets instead of cards, or skipping off-screen animation helps most.'];
  return ['GPU-bound', 'bad', 'The graphics card is behind: a lower resolution, fewer torches or no shadows help most.'];
}
const fmtMs = v => v.toFixed(1) + ' ms';
function hud() {
  const now = performance.now();
  if (lastHud) { ft.push(now - lastHud); if (ft.length > 600) ft.shift(); }
  lastHud = now;
  ema.physics = lerp(ema.physics, STATS.physics, .1); ema.logic = lerp(ema.logic, STATS.logic, .1); ema.draw = lerp(ema.draw, STATS.draw, .1);
  if (bench) benchFrame(ft[ft.length - 1] || 16.7);
  drawGraph();
  if (now - hudT < 250) return; hudT = now;
  const recent = ft.slice(-60), avgMs = recent.reduce((a, b) => a + b, 0) / Math.max(1, recent.length), fps = 1000 / avgMs, low = 1000 / pct(ft.slice(-240), .99);
  if (S.monsters === 0 && S.rate === 0 && ft.length > 120) refreshEst = Math.max(refreshEst === 60 ? 0 : refreshEst, snapRefresh(fps));
  $('fpsBig').textContent = Math.round(fps);
  $('mFrame').textContent = fmtMs(avgMs); $('mLow').textContent = Math.round(low) + ' fps';
  $('mPhys').textContent = fmtMs(ema.physics); $('mUpdate').textContent = fmtMs(ema.logic); $('mRender').textContent = fmtMs(ema.draw);
  const alive = enemies.reduce((n, e) => n + (e.alive ? 1 : 0), 0);
  $('mMonsters').textContent = alive.toLocaleString() + ' (' + STATS.drawn + ' drawn)';
  $('mBodies').textContent = STATS.bodies.toLocaleString() + ' (' + PROPS.length + ' props)';
  $('mParts').textContent = P.list.length.toLocaleString() + ' / ' + S.pcap.toLocaleString();
  $('mLights').textContent = STATS.lights + (S.shadows && S.torchLights && S.lights ? ' (2 with shadows)' : '');
  $('mItems').textContent = STATS.calls.toLocaleString() + ' calls, ' + Math.round(STATS.tris / 1000).toLocaleString() + 'k tris';
  $('mRes').textContent = SCR.rw + '×' + SCR.rh + ' (' + Math.round(SCR.rw * SCR.rh / 1000) + 'k px)';
  $('mGpu').textContent = 'three.js · ' + BACKEND;
  const [tag, cls, text] = hint(fps, avgMs), tg = $('bottleneck'); tg.textContent = tag; tg.dataset.level = cls; $('hint').textContent = text;
  if (!hwLines) { hwLines = hwInfo(); $('hw').textContent = hwLines.join('\n'); }
}

/* ---- the controls ---- */
const LOOK_NOTES = {
  card: 'Card: the engine draws each character, exactly as in the 2D games, onto a card standing in the 3D hall: flat, one depth each, lit by its own tones.',
  puppet: 'Puppet: the same rigs and poses wearing 3D parts, drawn in shared batches: real depth, torchlight and shadows. The look is an approximation.'
};
const CAM_NOTES = {
  view: 'View: the engine\'s views as a 3D camera that follows the hero, in perspective or orthographic. Walls between the hall and the camera are cut low.',
  chase: 'Chase: behind the hero. Click the picture to steer with the mouse (Esc frees it); [ ] turn, the wheel pulls in and out. F fixes the camera here.',
  first: 'First person: through the hero\'s eyes. Click to look with the mouse (Esc frees it); [ ] turn, the wheel sets the field of view. F fixes the camera here.',
  fly: 'Fly: WASD fly where you look, Q and E down and up, Shift faster, the arrows or a click (mouse look) to look. The hero waits. F fixes the camera here and gives you the hero back.',
  fixed: 'Fixed: the camera stays here while you play; the hero walks away from it with W. F frees it (fly mode). Copy camera link keeps it.'
};
const FS_KEY = 'my3d2dge.stress.fullscreen';
let fsStart = false; try { fsStart = localStorage.getItem(FS_KEY) === '1'; } catch (e) { /* storage blocked: off */ }
function syncUI() {
  $('monsters').value = Math.min(5000, S.monsters); $('monstersOut').textContent = S.monsters.toLocaleString();
  $('mix').value = S.mix; $('skin').value = S.skin; $('behavior').value = S.behavior;
  $('lights').value = S.lights; $('lightsOut').textContent = S.lights;
  $('rate').value = S.rate; $('rateOut').textContent = S.rate.toLocaleString() + '/s';
  $('pcap').value = S.pcap; $('pcapOut').textContent = S.pcap.toLocaleString();
  $('props').value = S.props; $('propsOut').textContent = S.props;
  $('iters').value = S.iters; $('itersOut').textContent = S.iters;
  $('launch').checked = S.launch;
  $('distance').value = CAM.dist; $('distanceOut').textContent = CAM.dist.toFixed(2).replace(/\.?0+$/, '') + '×';
  $('zoomOut').textContent = CAM.zoom + '×'; $('turnOut').textContent = CAM.turn + '°';
  for (const [id, k] of [['god', 'god'], ['outlines', 'outlines'], ['capes', 'capes'], ['lod', 'lod'], ['mlights', 'monsterLights'], ['torchOn', 'torchLights'], ['shadows', 'shadows'], ['fog', 'fog']]) $(id).checked = S[k];
  $('shadows').disabled = !S.torchLights;
  $('dither').checked = E.style.trans === 'dither'; $('readable').checked = E.style.charPitch !== false;
  document.querySelectorAll('[data-look]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.look === R3.look)));
  $('res3d').value = R3.res; $('lookNote').textContent = LOOK_NOTES[R3.look];
  document.querySelectorAll('[data-cam3]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cam3 === CAM.mode || (b.dataset.cam3 === 'fly' && CAM.mode === 'fixed'))));
  document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(CAM.mode === 'view' && b.dataset.view === CAM.view)));
  document.querySelectorAll('[data-proj]').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.proj === (sideFlat() ? 'ortho' : CAM.view === 'side' && CAM.depth ? 'persp' : CAM.proj))); b.disabled = CAM.mode === 'view' && CAM.view === 'side'; });
  $('camNote').textContent = CAM_NOTES[CAM.mode] + (CAM.locked ? ' Mouse captured: Esc frees it.' : '');
  $('depth').checked = CAM.depth && CAM.view === 'side';
  $('customCam').hidden = CAM.view !== 'custom';
  $('camYaw').value = Math.round(CAM.custom.yaw); $('camYawOut').textContent = Math.round(CAM.custom.yaw) + '°';
  $('camPitch').value = Math.round(CAM.custom.pitch); $('camPitchOut').textContent = Math.round(CAM.custom.pitch) + '°';
  $('camFov').value = Math.round(CAM.fov); $('camFovOut').textContent = Math.round(CAM.fov) + '°';
  $('fsBtn').textContent = document.fullscreenElement ? 'Leave full screen' : 'Full screen'; $('fsStart').checked = fsStart;
  const fx = fixedNow(); $('fixBtn').setAttribute('aria-pressed', String(fx)); $('fixBtn').firstChild.textContent = fx ? 'Unfix camera ' : 'Fix camera here ';
  $('screen').style.cursor = (CAM.mode === 'chase' || CAM.mode === 'first' || CAM.mode === 'fly') && !CAM.locked ? 'pointer' : '';
}
const on = (id, ev, f) => $(id).addEventListener(ev, e => { f(e); syncUI(); });
const blurAfter = e => { if (e.target && e.target.blur) e.target.blur(); };
on('monsters', 'input', e => setMonsters(+e.target.value));
document.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => { setMonsters(b.hasAttribute('data-clear') ? 0 : Math.max(0, Math.min(10000, S.monsters + +b.dataset.add))); syncUI(); b.blur(); }));
const respawn = () => { const n = S.monsters; setMonsters(0); setMonsters(n, true); };
on('mix', 'change', e => { S.mix = e.target.value; respawn(); blurAfter(e); });
on('skin', 'change', e => { S.skin = e.target.value; respawn(); blurAfter(e); });
on('behavior', 'change', e => { S.behavior = e.target.value; blurAfter(e); });
on('lights', 'input', e => { S.lights = +e.target.value; });
on('rate', 'input', e => { S.rate = +e.target.value; });
on('pcap', 'input', e => { S.pcap = +e.target.value; P.max = S.pcap; });
on('props', 'input', e => setProps(+e.target.value));
on('iters', 'input', e => { S.iters = +e.target.value; });
on('distance', 'input', e => { CAM.dist = +e.target.value; });
for (const [id, k] of [['god', 'god'], ['outlines', 'outlines'], ['lod', 'lod'], ['mlights', 'monsterLights'], ['torchOn', 'torchLights'], ['shadows', 'shadows'], ['fog', 'fog'], ['launch', 'launch']]) on(id, 'change', e => { S[k] = e.target.checked; blurAfter(e); });
on('capes', 'change', e => { S.capes = e.target.checked; applyCapes(); blurAfter(e); });
// the engine's own looks (E.style), here on the cards: dithered translucency, and the readable tilt in steep views
on('dither', 'change', e => { E.style.trans = e.target.checked ? 'dither' : 'alpha'; blurAfter(e); });
on('readable', 'change', e => { E.style.charPitch = e.target.checked ? undefined : false; blurAfter(e); });
document.querySelectorAll('input[type=range]').forEach(el => el.addEventListener('pointerup', () => el.blur()));
document.querySelectorAll('[data-look]').forEach(b => b.addEventListener('click', () => { set3d('look', b.dataset.look); b.blur(); }));
$('res3d').addEventListener('change', e => { set3d('res', e.target.value); e.target.blur(); });
document.querySelectorAll('[data-cam3]').forEach(b => b.addEventListener('click', () => { setCam(b.dataset.cam3); b.blur(); }));
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { setView(b.dataset.view); b.blur(); }));
document.querySelectorAll('[data-proj]').forEach(b => b.addEventListener('click', () => { setProj(b.dataset.proj); b.blur(); }));
$('depth').addEventListener('change', e => { setDepth(e.target.checked); e.target.blur(); });
for (const [id, f] of [['camYaw', v => { CAM.custom.yaw = v; }], ['camPitch', v => { CAM.custom.pitch = v; }], ['camFov', v => { CAM.fov = v; }]]) $(id).addEventListener('input', e => { f(+e.target.value); if (id !== 'camFov' && CAM.view !== 'custom') setView('custom'); syncUI(); });
document.querySelectorAll('[data-zoom]').forEach(b => b.addEventListener('click', () => { zoomStep(+b.dataset.zoom); b.blur(); }));
document.querySelectorAll('[data-turn]').forEach(b => b.addEventListener('click', () => { if (CAM.mode === 'view') turn(+b.dataset.turn); else CAM.yaw += +b.dataset.turn * DEG; b.blur(); }));
$('camReset').addEventListener('click', e => { resetCam(); e.currentTarget.blur(); });
$('fixBtn').addEventListener('click', e => { toggleFix(); e.currentTarget.blur(); });
$('camLinkBtn').addEventListener('click', async e => {
  const b = e.currentTarget, link = camLink(); b.blur();
  try { await navigator.clipboard.writeText(link); b.textContent = 'Copied'; } catch (err) { prompt('The camera link:', link); }
  setTimeout(() => { b.textContent = 'Copy camera link'; }, 1500);
});
function set3d(k, v) {
  if (k === 'look' && ['card', 'puppet'].includes(v)) R3.look = v; else if (k === 'res' && RES.includes(v)) R3.res = v; else if (k === 'pixels') R3.res = v ? 'pixels' : 'full';
  SCR.key = ''; syncUI();
}
const PRESETS = {
  light: { monsters: 100, lights: 8, rate: 100, pcap: 2000, dist: 1, props: 24, capes: false, monsterLights: false },
  medium: { monsters: 400, lights: 16, rate: 400, pcap: 3000, dist: 1.5, props: 60, capes: false, monsterLights: false },
  heavy: { monsters: 1200, lights: 24, rate: 1000, pcap: 5000, dist: 2.5, props: 120, capes: true, monsterLights: false },
  extreme: { monsters: 3000, lights: 30, rate: 2500, pcap: 9000, dist: 4, props: 300, capes: true, monsterLights: true },
  reset: { monsters: 0, lights: 12, rate: 0, pcap: 2000, dist: 1, props: 24, capes: false, monsterLights: false }
};
document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
  const p = PRESETS[b.dataset.preset];
  Object.assign(S, { lights: p.lights, rate: p.rate, pcap: p.pcap, capes: p.capes, monsterLights: p.monsterLights }); CAM.dist = p.dist;
  setProps(p.props); setMonsters(p.monsters); applyCapes(); if (b.dataset.preset === 'reset') resetCam(); syncUI(); b.blur();
}));
function setPanel(open) { $('panel').hidden = !open; $('showPanel').hidden = open; }
$('hidePanel').addEventListener('click', () => setPanel(false));
$('showPanel').addEventListener('click', () => setPanel(true));
addEventListener('keydown', e => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || typingIn(e)) return;
  if (e.code === 'KeyH') setPanel($('panel').hidden);
  else if (e.code === 'KeyC') { set3d('look', R3.look === 'card' ? 'puppet' : 'card'); note(R3.look === 'card' ? 'CARDS' : 'PUPPETS'); }
  else if (e.code === 'KeyP') { set3d('res', RES[(RES.indexOf(R3.res) + 1) % RES.length]); note(R3.res === 'pixels' ? 'ENGINE PIXELS' : R3.res === 'balanced' ? 'BALANCED RESOLUTION' : 'FULL RESOLUTION'); }
  else if (e.code === 'KeyG') { S.torchLights = !S.torchLights; note(S.torchLights ? 'TORCH LIGHTS ON' : 'TORCH LIGHTS OFF'); syncUI(); }
});
INPUT.bindButtons(document);
// full screen: the stage (picture, panel and numbers); browsers allow it only from a click or a key, so "start in full
// screen" (remembered on this device) enters it on the first one
function fullScreen(go) {
  try {
    if (go && !document.fullscreenElement) { const r = $('stage').requestFullscreen(); if (r && r.catch) r.catch(() => {}); }
    else if (!go && document.fullscreenElement) document.exitFullscreen();
  } catch (e) { /* refused: stays as it is */ }
}
if (fsStart) { const go = () => { fullScreen(true); removeEventListener('pointerdown', go, true); removeEventListener('keydown', go, true); }; addEventListener('pointerdown', go, true); addEventListener('keydown', go, true); }
$('fsBtn').hidden = !document.documentElement.requestFullscreen;
$('fsBtn').addEventListener('click', e => { fullScreen(!document.fullscreenElement); e.currentTarget.blur(); });
$('fsStart').addEventListener('change', e => { fsStart = e.target.checked; try { localStorage.setItem(FS_KEY, fsStart ? '1' : '0'); } catch (err) { /* not remembered */ } e.target.blur(); });
document.addEventListener('fullscreenchange', () => syncUI());
{   // the backend switch, and the other stress tests' addresses (the site serves pages without .html, a local server as files)
  const url = new URL(location.href), webgl = BACKEND !== 'WebGPU';
  if (webgl) url.searchParams.delete('backend'); else url.searchParams.set('backend', 'webgl');
  $('backendBtn').textContent = webgl ? 'Try it on WebGPU' : 'Try it on WebGL 2';
  $('backendBtn').addEventListener('click', () => { location.href = url.href; });
  $('backend3d').innerHTML = `Drawn by <b>three.js r182</b> on <b>${BACKEND}</b>; physics by <b>Rapier 0.19.3</b> (SIMD).`;
  for (const [id, page] of [['to2d', 'stress-test']]) $(id).href = (/\.html$/.test(location.pathname) ? page + '.html' : '/' + page);
}

/* ---- the benchmark ---- */
const STEPS = [0, 50, 100, 200, 400, 700, 1000, 1500, 2000, 3000, 4000, 5000];
let bench = null, lastReport = '';
function benchStart() {
  bench = { i: 0, phase: 'warm', t0: performance.now(), samples: [], results: [] };
  S.god = true; hero.inv = 0;
  setMonsters(STEPS[0], true);
  document.body.classList.add('benching');
  $('benchBtn').textContent = 'Stop benchmark'; $('benchTable').innerHTML = ''; $('copyBtn').hidden = true; $('benchSummary').textContent = '';
  benchStatus();
}
function benchStop(done) {
  document.body.classList.remove('benching');
  $('benchBtn').textContent = 'Run benchmark';
  if (done && bench.results.length) benchReport(); else $('benchStatus').textContent = 'Stopped.';
  bench = null; syncUI();
}
function benchStatus() { $('benchStatus').textContent = 'Testing ' + STEPS[bench.i].toLocaleString() + ' monsters (step ' + (bench.i + 1) + ' of ' + STEPS.length + ')...'; }
function benchFrame(ms) {
  const now = performance.now();
  if (bench.phase === 'warm') { if (now - bench.t0 > 1500) { bench.phase = 'measure'; bench.t0 = now; bench.samples = []; } return; }
  bench.samples.push(ms);
  if (now - bench.t0 < 3000) return;
  const avg = bench.samples.reduce((a, b) => a + b, 0) / bench.samples.length;
  const res = { n: STEPS[bench.i], fps: 1000 / avg, low: 1000 / pct(bench.samples, .99), physics: ema.physics, logic: ema.logic, draw: ema.draw, cpu: ema.physics + ema.logic + ema.draw };
  bench.results.push(res);
  const row = document.createElement('tr');
  row.innerHTML = '<td>' + res.n.toLocaleString() + '</td><td>' + Math.round(res.fps) + '</td><td>' + Math.round(res.low) + '</td><td>' + res.physics.toFixed(1) + '</td><td>' + res.logic.toFixed(1) + '</td><td>' + res.draw.toFixed(1) + '</td><td>' + res.cpu.toFixed(1) + '</td>';
  $('benchTable').appendChild(row);
  bench.i++;
  if (res.fps < 20 || bench.i >= STEPS.length) return benchStop(true);
  setMonsters(STEPS[bench.i], true); bench.phase = 'warm'; bench.t0 = now; benchStatus();
}
const FX_NAMES = { cel: 'Comic cel', pixel: 'Pixel' }, FX_TO = { all: 'the entire scene', objects: 'the characters and objects', env: 'the environment' };
function rendererDesc() {
  return 'three.js r182 on ' + BACKEND + ', Rapier 0.19.3 (SIMD) physics, ' + (R3.look === 'card' ? 'Card' : 'Puppet') + ' look, ' + (R3.res === 'pixels' ? "the engine's pixels" : R3.res === 'balanced' ? 'balanced resolution (half the screen\'s)' : 'full resolution') +
    (FX.look !== 'clean' ? ', filter ' + FX_NAMES[FX.look] + ' on ' + FX_TO[FX.apply] : ', no filter') + (FX.bloom ? ', bloom' : '') + (FX.fxaa ? ', FXAA' : '');
}
function benchReport() {
  const R = bench.results, base = R[0] ? R[0].fps : 60;
  const upto = th => { let best = null; for (const r of R) if (r.fps >= th) best = r.n; return best; };
  const smooth = upto(Math.min(55, base * .92)), play = upto(30);
  const smoothText = smooth === null ? 'Not smooth even with an empty hall. ' : smooth === 0 ? 'Smooth only with an empty hall. ' : 'Smooth up to ' + smooth.toLocaleString() + ' monsters. ';
  const playText = play === null ? 'Below 30 fps even with an empty hall.' : play === 0 ? 'Playable (30 fps) only with an empty hall.' : 'Playable (30 fps) up to ' + play.toLocaleString() + ' monsters.';
  const summary = smoothText + playText;
  $('benchSummary').textContent = summary; $('benchStatus').textContent = 'Done.';
  lastReport = [
    'my-3D2dge 3D Prototype: ' + rendererDesc(),
    'Result: ' + summary,
    'Settings: ' + camDesc() + ', picture ' + SCR.rw + '×' + SCR.rh + ', ' + (S.torchLights ? S.lights + ' torch lights' + (S.shadows ? ' (2 with shadows)' : '') : 'torch lights off (' + S.lights + ' braziers)') + ', ' + S.rate + ' particles/s, mix ' + S.mix + ', rig ' + S.skin + ', behavior ' + S.behavior +
      ', ' + S.props + ' props, ' + S.iters + ' solver iterations, launches ' + (S.launch ? 'on' : 'off') + ', outlines ' + (S.outlines ? 'on' : 'off') + ', monster capes ' + (S.capes ? 'on' : 'off') + ', off-screen animation ' + (S.lod ? 'skipped' : 'on') + ', fog ' + (S.fog ? 'on' : 'off') +
      (E.style.trans === 'dither' ? ', dithered translucency' : '') + (E.style.charPitch === false ? ', characters as the camera sees them' : ''),
    ...(hwLines || hwInfo()),
    '',
    // CPU ms = physics + game logic + drawing (the CPU's side of it: what the GPU does after is in the frame time, not here)
    'Monsters | avg fps | 1% low | physics ms | logic ms | drawing ms | CPU ms',
    ...R.map(r => r.n + ' | ' + Math.round(r.fps) + ' | ' + Math.round(r.low) + ' | ' + r.physics.toFixed(1) + ' | ' + r.logic.toFixed(1) + ' | ' + r.draw.toFixed(1) + ' | ' + r.cpu.toFixed(1))
  ].join('\n');
  $('copyBtn').hidden = false;
}
$('benchBtn').addEventListener('click', () => { if (bench) benchStop(false); else benchStart(); $('benchBtn').blur(); });
$('copyBtn').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(lastReport); $('copyBtn').textContent = 'Copied'; }
  catch (e) { const ta = $('reportText'); ta.hidden = false; ta.value = lastReport; ta.select(); $('copyBtn').textContent = 'Select and copy below'; }
  setTimeout(() => { $('copyBtn').textContent = 'Copy results'; }, 2000);
});
syncFX();

/* ---- start ---- */
SIM.reset(1);
{ const n = +QS.get('monsters'); if (n > 0) setMonsters(Math.min(10000, n), true); }
$('loading3d').hidden = true;
syncUI();
requestAnimationFrame(tick);
/** test and agent helper: n game steps of STEP with scripted controls (move, and presses every so many steps) */
function stepN(n, o = {}) {
  let i = 0;
  const ctl = { move: o.move || [0, 0], aim: o.aim ?? null, cam: [0, 1, .5], use() {}, pressed: a => !!o[a] && i % o[a] === 0 };
  for (i = 0; i < n; i++) SIM.step(STEP, ctl);
}
window.__sw = { ready: true, backend: BACKEND, S, SIM, CAM, R3, FX, STATS, hero, enemies, corpses, PROPS, shots, renderer, scene, set: set3d, setCam, setView, setDepth, setProj, toggleFix,
  setMonsters, setProps, placeHero: SIM.placeHero, step: stepN, run: n => { const h = SIM.run(n); SIM.reset(1); setMonsters(S.monsters, true); return h; }, hash: () => SIM.hash(), benchStart,
  get bench() { return bench; }, get report() { return lastReport; }, rendererDesc, camDesc, camLink };
