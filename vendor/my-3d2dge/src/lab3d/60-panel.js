/* =============================================================================
 * THE LOOP AND THE PANEL
 *   renderer     WebGPURenderer: WebGPU, or WebGL 2 by itself when WebGPU is missing; ?backend=webgl forces WebGL 2
 *   frame()      fixed 60 Hz steps (SIM.step, then poseCast), then one picture: cards drawn, puppets posed, rendered
 *                (in Both the picture is split: cards on the left, puppets on the right, the same camera)
 *   OPT          { look: card | puppet | both, play, pixels, outlines, shadows, fog } (the panel, the keys, the address)
 *   keys         WASD / arrows move the hero (fly: arrows), J or a click attacks, K or Space dashes, 1-8 cameras,
 *                Q / E turn the fixed views (fly: down / up), C cycles card, puppet and both, P plays, X pixels
 *   window.__lab3d  { ready, backend, proof, run(n), state(), hash(), set(key, value), camera(code), frames }
 * The address takes ?view=iso|...|chase (where to start), ?cam=<CAMS.code()> (a fixed camera), ?look=card|puppet|both,
 * ?play=1, ?pixels=0, ?backend=webgl.
 * ============================================================================= */
const canvas = $('view');
const renderer = new THREE.WebGPURenderer({ canvas, antialias: false, forceWebGL: QS.get('backend') === 'webgl' });
await renderer.init();
const BACKEND = renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL 2';
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NoToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.autoClear = false; renderer.setClearColor(BG);

const OPT = { look: 'card', play: QS.get('play') === '1', pixels: QS.get('pixels') !== '0', outlines: true, shadows: true, fog: false };
if (['card', 'puppet', 'both'].includes(QS.get('look'))) OPT.look = QS.get('look');
for (const c of CAST) scene.add(c.card.mesh, c.puppet.group, c.blob);

/* the proof: the scripted run's hash on this backend, then a fresh start for live play */
const PROOF = { steps: 600, t0: performance.now() };
PROOF.hash = SIM.run(PROOF.steps); PROOF.ms = performance.now() - PROOF.t0;
SIM.reset();
// the camera from the address: ?cam= a fixed camera (Fix camera's code), ?view= a camera to start with (chase plays)
if (QS.get('cam')) CAMS.fixed = CAMS.load(QS.get('cam'));
else { const v = CAM_NAMES[QS.get('view')] ? QS.get('view') : 'iso'; CAMS.set(v); if (v === 'chase') { CAMS.chaseSnap = true; OPT.play = true; } }

/* ---- input ---- */
const held = new Set(), pressed = { attack: false, dash: false };
const KEYS = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' };
function heroInput() {
  if (!OPT.play) return SIM.lapInput();
  const fly = CAMS.mode === 'fly', k = c => held.has(c);
  // in fly the letters steer the camera, so only the arrows move the hero
  const x = (k('ArrowRight') || (!fly && k('KeyD')) ? 1 : 0) - (k('ArrowLeft') || (!fly && k('KeyA')) ? 1 : 0);
  const y = (k('ArrowUp') || (!fly && k('KeyW')) ? 1 : 0) - (k('ArrowDown') || (!fly && k('KeyS')) ? 1 : 0);
  const G = CAMS.ground(), l = Math.hypot(x, y) || 1;
  const move = [(G.right[0] * x + G.forward[0] * y) / l, (G.right[1] * x + G.forward[1] * y) / l];
  const inp = { move, attack: pressed.attack, dash: pressed.dash };
  pressed.attack = pressed.dash = false;
  return inp;
}
addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const c = e.code;
  if (/^Digit[1-8]$/.test(c)) { setCam(['iso', 'threequarter', 'topdown', 'brawler', 'side', 'orbit', 'fly', 'chase'][+c.slice(5) - 1]); return; }
  if (c === 'KeyJ' && !e.repeat) { pressed.attack = true; play(true); }
  else if ((c === 'KeyK' || c === 'Space') && !e.repeat) { pressed.dash = true; play(true); e.preventDefault(); }
  else if (c === 'KeyQ' && CAMS.mode !== 'fly') turn(-45);
  else if (c === 'KeyE' && CAMS.mode !== 'fly') turn(45);
  else if (c === 'KeyC') setOpt('look', { card: 'puppet', puppet: 'both', both: 'card' }[OPT.look]);
  else if (c === 'KeyP') play(!OPT.play);
  else if (c === 'KeyX') setOpt('pixels', !OPT.pixels);
  if (KEYS[c] && OPT.play === false && !(CAMS.mode === 'fly' && /^Key/.test(c))) play(true);
  held.add(c);
  if (c.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', e => held.delete(e.code));
addEventListener('blur', () => held.clear());
/* drag turns the free cameras, the wheel zooms; a click without a drag attacks while you play */
let drag = null;
canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, moved: false }; try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* a lost pointer */ } });
canvas.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < 4) return;
  drag.moved = true; drag.x = e.clientX; drag.y = e.clientY; CAMS.dragging = true; canvas.classList.add('dragging');
  if (CAMS.fixed) return;
  const m = CAMS.mode;
  if (m === 'orbit') { CAMS.orbit.yaw -= dx * .4; CAMS.orbit.pitch = clamp(CAMS.orbit.pitch + dy * .3, 2, 89); }
  else if (m === 'fly') { CAMS.fly.yaw -= dx * .25; CAMS.fly.pitch = clamp(CAMS.fly.pitch - dy * .25, -89, 89); }
  else if (m === 'chase') { CAMS.chase.yaw -= dx * .4; CAMS.chase.pitch = clamp(CAMS.chase.pitch + dy * .25, -10, 70); }
});
const endDrag = e => {
  if (drag && !drag.moved && e.type === 'pointerup' && CAMS.mode !== 'fly') { pressed.attack = true; play(true); }
  drag = null; CAMS.dragging = false; canvas.classList.remove('dragging');
};
canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('wheel', e => {
  e.preventDefault(); if (CAMS.fixed) return;
  const k = Math.exp(e.deltaY * .0015), m = CAMS.mode;
  if (FIXED_VIEWS.includes(m)) CAMS.zoom = clamp(CAMS.zoom / k, .5, 4);
  else if (m === 'orbit') CAMS.orbit.dist = clamp(CAMS.orbit.dist * k, 3, 40);
  else if (m === 'chase') CAMS.chase.dist = clamp(CAMS.chase.dist * k, 1.5, 9);
  else CAMS.fly.pos.y = clamp(CAMS.fly.pos.y - e.deltaY * .004, .3, 8);
}, { passive: false });
/** fly: the letters move the camera where it looks, Q and E go down and up (Shift is faster) */
function flyMove(dt) {
  if (CAMS.mode !== 'fly' || CAMS.fixed) return;
  const k = c => held.has(c) ? 1 : 0, f = CAMS.fly, y = f.yaw * DEG, sp = (held.has('ShiftLeft') || held.has('ShiftRight') ? 9 : 3.5) * dt;
  const fwd = k('KeyW') - k('KeyS'), side = k('KeyD') - k('KeyA'), up = k('KeyE') - k('KeyQ');
  f.pos.x += (-Math.sin(y) * fwd + Math.cos(y) * side) * sp; f.pos.z += (-Math.cos(y) * fwd - Math.sin(y) * side) * sp; f.pos.y = clamp(f.pos.y + up * sp, .3, 12);
}

/* ---- the picture ---- */
let lastW = 0, lastH = 0, lastPix = null;
function fit() {
  const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
  if (w === lastW && h === lastH && OPT.pixels === lastPix) return;
  lastW = w; lastH = h; lastPix = OPT.pixels;
  if (OPT.pixels) { renderer.setPixelRatio(1); renderer.setSize(Math.max(2, Math.round(LINES * w / h)), LINES, false); }   // the engine's 240 lines, enlarged by the browser with whole-pixel edges
  else { renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.setSize(w, h, false); }
  canvas.classList.toggle('pixels', OPT.pixels);
}
const SPLIT = { L: 'card', R: 'puppet' };
const FOG = { far: new THREE.Fog(BG, 36, 54), orbit: new THREE.Fog(BG, 14, 31), near: new THREE.Fog(BG, 6, 22) };   // by distance from the camera: fixed views stand 40 m off
function showOnly(look) {
  for (const c of CAST) { c.card.mesh.visible = c.blob.visible = look === 'card'; c.puppet.group.visible = look === 'puppet'; }
}
function render(t) {
  fit();
  const size = renderer.getSize(new THREE.Vector2()), both = OPT.look === 'both';
  const aspect = (both ? size.x / 2 : size.x) / size.y;
  CAMS.update(Math.min(.1, t.dt), aspect, OPT.play);
  OUTLINE_PX.value.set(2 / (LINES * aspect), 2 / LINES);   // one game pixel, whatever the resolution
  for (const o of OUTLINES) o.visible = OPT.outlines;
  sun.castShadow = OPT.shadows; FOG.orbit.near = CAMS.orbit.dist - 3; FOG.orbit.far = CAMS.orbit.dist + 14;
  scene.fog = OPT.fog ? (CAMS.cam.isOrthographicCamera ? FOG.far : CAMS.mode === 'orbit' ? FOG.orbit : FOG.near) : null;
  flicker(t.now / 1000); syncCrates(SIM.crates);
  // cards draw from the camera's angle; puppets go where their joints are; each blob shadow sits under its rig
  for (const c of CAST) {
    const at = toThree(c.rig.x, c.rig.y, 0);
    if (OPT.look !== 'puppet') c.card.draw(CAMS.cardView(at), c.pairs);
    if (OPT.look !== 'card') c.puppet.update(c.pairs);
    c.blob.position.set(at.x, .012, at.z);
  }
  renderer.clear();
  if (!both) { showOnly(OPT.look); renderer.setScissorTest(false); renderer.setViewport(0, 0, size.x, size.y); renderer.render(scene, CAMS.cam); return; }
  // Both: the same camera twice, cards in the left half, puppets in the right
  renderer.setScissorTest(true);
  for (const [i, look] of [[0, SPLIT.L], [1, SPLIT.R]]) {
    const x = i * size.x / 2; renderer.setViewport(x, 0, size.x / 2, size.y); renderer.setScissor(x, 0, size.x / 2, size.y);
    showOnly(look); renderer.render(scene, CAMS.cam);
  }
  renderer.setScissorTest(false);
}
const LOOP = { last: performance.now(), acc: 0, frames: 0 };
function frame() {
  const now = performance.now(), dt = Math.min(.1, (now - LOOP.last) / 1000); LOOP.last = now;
  LOOP.acc += dt; flyMove(dt);
  let n = 0;
  while (LOOP.acc >= STEP && n < 6) { LOOP.acc -= STEP; n++; SIM.step(heroInput()); poseCast(STEP); }
  if (n === 6) LOOP.acc = 0;   // a long stall: drop the backlog rather than race to catch up
  render({ now, dt });
  LOOP.frames++;
  if (LOOP.frames % 30 === 0) showState();
}

/* ---- the panel ---- */
const LOOK_NOTES = {
  card: '<b>Card:</b> the engine draws each character from this camera\'s angle into a picture on a card that faces the camera: the exact look, but flat, at one depth (a sword can\'t pass behind a pillar), lit by its own tones, not the torches.',
  puppet: '<b>Puppet:</b> the same rigs and animation wearing 3D parts listed as data (src/lab3d/40-characters.js): real depth, light and shadow from every side; the look is an approximation of ours.',
  both: '<b>Both:</b> cards on the left, puppets on the right, the same camera. Try Fly or Chase to see where each one holds up.'
};
const CAM_NOTES = {
  fixed: 'The engine\'s view, as an orthographic camera with the engine\'s height boost. Q and E turn it 45°, the wheel zooms.',
  orbit: 'A perspective camera the engine can\'t give: drag to turn and tilt, the wheel to come closer.',
  fly: 'First person: WASD, Q and E down and up (Shift is faster), drag to look. Cards turn to face you; puppets are solid from every side. Arrows move the hero.',
  chase: 'Third person, behind the hero: move with WASD relative to the camera, drag to swing round, the wheel for distance.'
};
function setCam(m) { CAMS.fixed = false; CAMS.set(m); if (m === 'chase') { CAMS.chaseSnap = true; play(true); } refresh(); }
function turn(d) { if (FIXED_VIEWS.includes(CAMS.mode) && !CAMS.fixed) { CAMS.turn = ((CAMS.turn + d) % 360 + 360) % 360; refresh(); } }
function play(on) { if (OPT.play === on) return; OPT.play = on; refresh(); }
function setOpt(k, v) { OPT[k] = v; refresh(); }
function refresh() {
  for (const b of document.querySelectorAll('[data-cam]')) b.setAttribute('aria-pressed', b.dataset.cam === CAMS.mode);
  for (const b of document.querySelectorAll('[data-look]')) b.setAttribute('aria-pressed', b.dataset.look === OPT.look);
  for (const b of document.querySelectorAll('[data-hero]')) b.setAttribute('aria-pressed', (b.dataset.hero === 'play') === OPT.play);
  for (const b of document.querySelectorAll('[data-opt]')) b.setAttribute('aria-pressed', !!OPT[b.dataset.opt]);
  const fixedView = FIXED_VIEWS.includes(CAMS.mode);
  $('rotL').disabled = $('rotR').disabled = !fixedView || CAMS.fixed;
  $('camTag').textContent = CAM_NAMES[CAMS.mode] + (fixedView && CAMS.turn ? ' ' + CAMS.turn + '°' : '') + (CAMS.fixed ? ' · fixed' : '');
  $('playTag').hidden = !OPT.play;
  $('camNote').textContent = CAM_NOTES[fixedView ? 'fixed' : CAMS.mode];
  $('lookNote').innerHTML = LOOK_NOTES[OPT.look];
  $('fixBtn').setAttribute('aria-pressed', CAMS.fixed); $('fixBtn').textContent = CAMS.fixed ? 'Camera fixed' : 'Fix camera';
  $('camCode').hidden = !CAMS.fixed;
  if (CAMS.fixed) $('camCode').textContent = location.origin + location.pathname + '?cam=' + CAMS.code();
  for (const id of ['divider', 'halfL', 'halfR']) $(id).hidden = OPT.look !== 'both';
  canvas.classList.toggle('still', fixedView || CAMS.fixed);
}
function showState() {
  const live = SIM.hash();
  $('proof').innerHTML = `Drawn by <b>${BACKEND}</b>. The same ${PROOF.steps} scripted steps (the hero walking through the crates, swinging) end in state <b>${PROOF.hash}</b> on this backend; the other one must give the same. Live: step ${SIM.n}, state ${live}.`;
}
document.querySelectorAll('[data-cam]').forEach(b => b.addEventListener('click', () => setCam(b.dataset.cam)));
document.querySelectorAll('[data-look]').forEach(b => b.addEventListener('click', () => setOpt('look', b.dataset.look)));
document.querySelectorAll('[data-hero]').forEach(b => b.addEventListener('click', () => play(b.dataset.hero === 'play')));
document.querySelectorAll('[data-opt]').forEach(b => b.addEventListener('click', () => setOpt(b.dataset.opt, !OPT[b.dataset.opt])));
$('rotL').addEventListener('click', () => turn(-45)); $('rotR').addEventListener('click', () => turn(45));
$('fixBtn').addEventListener('click', () => {
  CAMS.fixed = !CAMS.fixed;
  const url = new URL(location.href); if (CAMS.fixed) url.searchParams.set('cam', CAMS.code()); else url.searchParams.delete('cam');
  history.replaceState(null, '', url.pathname + url.search.replace(/%2C/g, ',') + url.hash);
  if (CAMS.fixed && navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(location.href).catch(() => {});
  refresh();
});
$('runBtn').addEventListener('click', () => {
  const t0 = performance.now(), h = SIM.run(PROOF.steps), ms = performance.now() - t0;
  $('runBtn').textContent = (h === PROOF.hash ? 'Same state: ' : 'Different: ') + h + ` (${Math.round(ms)} ms)`;
});
{
  const other = BACKEND === 'WebGPU' ? 'webgl' : null, url = new URL(location.href);
  if (other) url.searchParams.set('backend', other); else url.searchParams.delete('backend');
  $('backendBtn').textContent = other ? 'Try it on WebGL 2' : 'Try it on WebGPU';
  $('backendBtn').addEventListener('click', () => { location.href = url.href; });
}
$('backendTag').textContent = BACKEND; $('backendTag').classList.add('hot');
$('loading').hidden = true;
refresh(); showState();
renderer.setAnimationLoop(frame);

window.__lab3d = {
  ready: true, backend: BACKEND, proof: PROOF, OPT, CAMS, SIM, CAST, scene, renderer,
  run: n => SIM.run(n || PROOF.steps), state: () => SIM.state(), hash: () => SIM.hash(),
  set(k, v) { if (k === 'cam') setCam(v); else if (k === 'play') play(!!v); else setOpt(k, v); },
  camera(code) { CAMS.fixed = CAMS.load(code); refresh(); return CAMS.code(); },
  get frames() { return LOOP.frames; }
};
