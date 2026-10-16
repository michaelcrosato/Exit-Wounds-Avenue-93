/* =============================================================================
 * THE CAMERAS and what the controls mean in each. Every camera is a real 3D camera; the panel's Camera section and
 * the keys pick one:
 *   View (1)       the engine's views as 3D cameras following the hero (a little ahead of his aim, with the 2D
 *                  camera's lag): isometric, three-quarter, top-down, brawler, side scrolling, or a custom turn and
 *                  tilt; in perspective (a lens: the field of view) or orthographic (the engine's flat projection, O
 *                  switches). Zoom (- = or the wheel) and camera distance (the panel) frame more or less of the hall,
 *                  [ ] turn the view by 45 degrees, 0 resets. Walls between the hall and the camera are cut low.
 *                  Side scrolling with depth (M): a perspective camera on a rail beside the hero (the 2D page's Mode 7
 *                  pose: it follows him sideways and keeps him between a near and a far distance), so he shrinks
 *                  walking into the hall and grows coming back.
 *   Chase (2)      behind the hero and above him. A click on the picture captures the mouse: it turns the camera and
 *                  the hero aims straight ahead; Esc frees it (the mouse then aims at the floor, [ ] turn). The wheel
 *                  pulls it in and out; it slides in front of a wall rather than through it
 *   First (3)      the hero's eyes (he isn't drawn): the same mouse and keys; the wheel sets the field of view
 *   Fly (4)        a free camera: WASD fly where it looks, Q and E (or Space) down and up, Shift faster, the arrows or
 *                  the captured mouse look. The hero waits (the keys are the camera's)
 *   Fix (F)        the camera stays where it is: a view stops following, a chase, first person or fly camera becomes a
 *                  fixed 3D camera and the hero is yours again (F frees it into fly mode from there)
 * In every camera the hero's controls follow it: W walks away from the camera, and he aims where the mouse points on
 * the floor (or straight ahead with the mouse captured). Cards are drawn by the engine from the camera's turn and tilt.
 * Links: ?view=iso|threequarter|topdown|brawler|side|custom  &proj=ortho  &depth=1 (side scrolling with depth)
 *   ?cam=yaw,pitch,zoom,height,boost,x,y (the 2D pages' format: a custom view fixed there)  ?cam3=chase | first |
 *   fly[,x,y,z,yaw,pitch,fov] | fixed,x,y,z,yaw,pitch,fov (engine units and degrees)
 * ============================================================================= */
const DEG = Math.PI / 180;
const camP = new THREE.PerspectiveCamera(40, 1, .1, 500);   // (metres)
const camO = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 900);
const VIEWS = ['iso', 'threequarter', 'topdown', 'brawler', 'side'];
const VIEW_LABEL = { iso: 'Isometric', threequarter: 'Three-quarter', topdown: 'Top-down', brawler: 'Brawler', side: 'Side scrolling', custom: 'Custom' };
const ZOOMS = [.5, .75, 1, 1.25, 1.5, 2, 2.5, 3];
const CAM = {
  mode: 'view', view: E.VIEWS[QS.get('view')] && QS.get('view') !== 'overhead' ? QS.get('view') : QS.get('view') === 'custom' ? 'custom' : 'iso',
  proj: QS.get('proj') === 'ortho' ? 'ortho' : 'persp', depth: QS.get('depth') === '1', zoom: 1, dist: 1, turn: 0, fov: 40,
  custom: { yaw: 30, pitch: 40 }, fix: { on: false, x: 0, y: 0, z: 0 }, focus: null,
  yaw: -Math.PI / 2, locked: false, held: new Set(),
  chase: { pitch: -.36, dist: 88, fov: 60 }, first: { pitch: -.08, fov: 75 },
  fly: { x: CXu, y: CYu + 220, z: 90, yaw: -Math.PI / 2, pitch: -.32, fov: 70 },
  fixed: null, pose: null, smooth: null, eyeZ: 24, cam: camP,
  rail: { x: 0, y: 0, z: 0, ready: false }
};
const DEPTH = { h: 70, pitch: 14, fov: 50, near: 110, far: 260 };   // the 2D page's side scrolling with depth
const CAM_LABEL = { chase: 'Chase camera', first: 'First person', fly: 'Fly camera', fixed: 'Fixed 3D camera' };
const cam3d = () => CAM.mode !== 'view';
const sideFlat = () => CAM.mode === 'view' && CAM.view === 'side' && !CAM.depth;   // (flat side scrolling is orthographic, as the engine's)
/** the engine view's angles for the view mode: [yaw, pitch] in degrees (the engine's yaw: 0 has the camera to the south) */
function viewAngles() {
  if (CAM.view === 'custom') return [CAM.custom.yaw + CAM.turn, CAM.custom.pitch];
  const v = E.VIEWS[CAM.view]; return [v.yawDeg + (v.pitchDeg < 5 ? 0 : CAM.turn), v.pitchDeg];
}
/** the picture's height at the focus, in units, before the zoom: the 2D page's (330 lines at the view's scale) times distance */
const frameUnits = () => 330 / (CAM.view === 'custom' ? 1.5 : E.VIEWS[CAM.view].scale) * CAM.dist;
/** the heading (engine ground angle) a camera looks along when the engine's yaw puts it at (sin, cos) from its target */
const headingOf = yawDeg => Math.atan2(-Math.cos(yawDeg * DEG), -Math.sin(yawDeg * DEG));
/** the engine's turn for a camera looking along heading a */
const engineYaw = a => ((Math.round(Math.atan2(-Math.cos(a), -Math.sin(a)) / DEG) % 360) + 360) % 360;

/* ---- each camera's pose: { x, y, z (engine units), yaw (the heading it looks along), pitch (radians, - down), fov } ---- */
const _cp = [0, 0, 0];
function viewPose(dt) {
  const h = hero, k = 1 - Math.exp(-dt / .18);
  // the focus: a little ahead of the hero's aim (the 2D camera's), with its lag; a fixed camera keeps its own
  const a = h.aim !== undefined ? h.aim : h.facing, tx = h.x + Math.cos(a) * 16, ty = h.y + Math.sin(a) * 16, tz = h.z + 8;
  const f = CAM.focus || (CAM.focus = [tx, ty, tz]);
  if (CAM.fix.on) { f[0] = CAM.fix.x; f[1] = CAM.fix.y; f[2] = CAM.fix.z; }
  else { f[0] += (tx - f[0]) * k; f[1] += (ty - f[1]) * k; f[2] += (tz - f[2]) * k; }
  if (CAM.view === 'side' && CAM.depth) return railPose(dt);
  // perspective: as far back as frames the 2D picture's height at the focus (distance dollies it further), zoom narrows
  // the lens; orthographic: far back, its frame is its size (zoom shrinks it)
  const [yw, pt] = viewAngles(), ortho = CAM.proj === 'ortho' || sideFlat(), Hb = frameUnits(), cp = Math.cos(pt * DEG);
  const d = ortho ? 900 : Hb / 2 / Math.tan(CAM.fov * DEG / 2), fov = 2 * Math.atan(Math.tan(CAM.fov * DEG / 2) / CAM.zoom) / DEG;
  return { x: f[0] + Math.sin(yw * DEG) * cp * d, y: f[1] + Math.cos(yw * DEG) * cp * d, z: f[2] + Math.sin(pt * DEG) * d, yaw: headingOf(yw), pitch: -pt * DEG, fov, ortho, Hf: Hb / CAM.zoom };
}
/** side scrolling with depth: the 2D page's rail (it follows the hero sideways, and in depth only when he comes nearer
 *  than near or goes past far); a fixed camera stays where it is */
function railPose(dt) {
  const h = hero, R = CAM.rail;
  if (!R.ready) { R.x = h.x; R.y = h.y + 160; R.z = h.z; R.ready = true; }
  if (!CAM.fix.on) {
    const k = 1 - Math.exp(-dt * 5), want = clamp(R.y, h.y + DEPTH.near, h.y + DEPTH.far);
    R.x += (h.x - R.x) * k; R.y += (want - R.y) * Math.min(1, k * 2); R.z += (h.z - R.z) * k;
  }
  return { x: R.x, y: R.y, z: DEPTH.h + R.z, yaw: -Math.PI / 2, pitch: -DEPTH.pitch * DEG, fov: 2 * Math.atan(Math.tan(DEPTH.fov * DEG / 2) / CAM.zoom) / DEG, ortho: false };
}
function chasePose(dt) {
  const h = hero, C = CAM.chase, k = 1 - Math.exp(-dt * 12);
  const s = CAM.smooth || (CAM.smooth = [h.x, h.y, h.z]); s[0] += (h.x - s[0]) * k; s[1] += (h.y - s[1]) * k; s[2] += (h.z - s[2]) * k;
  const tx = s[0], ty = s[1], tz = s[2] + 24, cp = Math.cos(C.pitch), fx = Math.cos(CAM.yaw) * cp, fy = Math.sin(CAM.yaw) * cp, fz = Math.sin(C.pitch);
  let d = C.dist;
  for (let r = 6; r <= C.dist; r += 3) {   // pull in front of a wall or pillar between the hero and the camera
    const x = tx - fx * r, y = ty - fy * r, z = tz - fz * r;
    if (z < topH(x, y) + 4) { d = Math.max(6, r - 5); break; }
  }
  return { x: tx - fx * d, y: ty - fy * d, z: Math.max(3, tz - fz * d), yaw: CAM.yaw, pitch: C.pitch, fov: C.fov, ortho: false };
}
function firstPose(dt) {
  const h = hero, k = 1 - Math.exp(-dt * 16);
  frame(h.rig); wp(h.rig.J.head, _cp);   // his head (it bobs with his steps, drops when he falls)
  CAM.eyeZ += (_cp[1] * U + 1 - CAM.eyeZ) * k;
  return { x: h.x + Math.cos(CAM.yaw) * 2.5, y: h.y + Math.sin(CAM.yaw) * 2.5, z: CAM.eyeZ, yaw: CAM.yaw, pitch: CAM.first.pitch, fov: CAM.first.fov, ortho: false };
}
function flyStep(dt) {
  const F = CAM.fly, k = c => CAM.held.has(c), sp = (k('ShiftLeft') || k('ShiftRight') ? 170 : 64) * dt;
  F.yaw += ((k('ArrowRight') ? 1 : 0) - (k('ArrowLeft') ? 1 : 0)) * 1.7 * dt;
  F.pitch = clamp(F.pitch + ((k('ArrowUp') ? 1 : 0) - (k('ArrowDown') ? 1 : 0)) * 1.2 * dt, -1.5, 1.5);
  const fwd = (k('KeyW') ? 1 : 0) - (k('KeyS') ? 1 : 0), str = (k('KeyD') ? 1 : 0) - (k('KeyA') ? 1 : 0), up = (k('KeyE') || k('Space') ? 1 : 0) - (k('KeyQ') ? 1 : 0);
  const cy = Math.cos(F.yaw), sy = Math.sin(F.yaw), cp = Math.cos(F.pitch), spp = Math.sin(F.pitch);
  F.x = clamp(F.x + (cp * cy * fwd - sy * str) * sp, -6 * T, HW + 6 * T); F.y = clamp(F.y + (cp * sy * fwd + cy * str) * sp, -6 * T, HH + 6 * T);
  F.z = clamp(F.z + (spp * fwd + up) * sp, 2, 600);
  return Object.assign({}, F, { ortho: false });
}
/** the camera's pose this frame (and [ ] held turning in chase and first person) */
function cameraPose(dt) {
  if (CAM.mode === 'chase' || CAM.mode === 'first') CAM.yaw += ((CAM.held.has('BracketRight') ? 1 : 0) - (CAM.held.has('BracketLeft') ? 1 : 0)) * 2.2 * dt;
  const p = CAM.mode === 'view' ? viewPose(dt) : CAM.mode === 'chase' ? chasePose(dt) : CAM.mode === 'first' ? firstPose(dt) : CAM.mode === 'fly' ? flyStep(dt) : Object.assign({ ortho: false }, CAM.fixed);
  return (CAM.pose = p);
}

/* ---- the three.js camera from a pose, the cards' view and axes, what is on screen ---- */
const CV = { right: new THREE.Vector3(), up: new THREE.Vector3(), back: new THREE.Vector3(), q: new THREE.Quaternion(), ppm: 1, vert: 1, thick: 1, scale: 1.5, yaw: 0, pitch: 0 };
const _look = new THREE.Vector3(), _pm = new THREE.Matrix4(), _fr = new THREE.Frustum(), _sph = new THREE.Sphere(), _hv = new THREE.Vector3();
/** aim the camera (perspective or orthographic) at a pose, with the screen shake; W x H: the picture's size in pixels */
function placeCamera(p, W, H) {
  const cam = p.ortho ? camO : camP, aspect = W / H, sh = SIM.shake, t = SIM.real;
  const shx = sh > .05 ? (Math.sin(t * 83) + Math.sin(t * 57.3)) * .5 * sh : 0, shy = sh > .05 ? (Math.sin(t * 71) + Math.sin(t * 49.7)) * .5 * sh : 0;
  if (p.ortho) { const h = p.Hf / U / 2; Object.assign(camO, { left: -h * aspect, right: h * aspect, top: h, bottom: -h, near: .1, far: 2000 }); }
  else Object.assign(camP, { fov: p.fov, aspect, near: CAM.mode === 'first' ? .3 : .1, far: 500 });   // (first person: a face right in front clips rather than filling the view)
  const cp = Math.cos(p.pitch), fx = Math.cos(p.yaw) * cp, fz = Math.sin(p.yaw) * cp, fy = Math.sin(p.pitch), rx = -Math.sin(p.yaw), rz = Math.cos(p.yaw), k = .05 / U * 4;
  cam.position.set(p.x / U + rx * shx * k, p.z / U - shy * k, p.y / U + rz * shx * k);
  cam.up.set(0, 1, 0); if (Math.abs(fy) > .999) cam.up.set(Math.cos(p.yaw), 0, Math.sin(p.yaw));   // (straight down: up on the screen is where it heads)
  cam.lookAt(_look.set(cam.position.x + fx, cam.position.y + fy, cam.position.z + fz));
  cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  cam.getWorldQuaternion(CV.q);
  CV.right.set(1, 0, 0).applyQuaternion(CV.q); CV.up.set(0, 1, 0).applyQuaternion(CV.q); CV.back.set(0, 0, 1).applyQuaternion(CV.q);
  CV.yaw = engineYaw(p.yaw); CV.pitch = clamp(Math.round(-p.pitch / DEG), 0, 89);
  // the cards' pixel size: about the screen's where the hero stands (whole eighths, changed only when it moves by a
  // fifth: a new size remakes the atlas)
  let ppu;
  if (p.ortho) ppu = H / p.Hf;
  else { _hv.set(hero.x / U, (hero.z + 14) / U, hero.y / U).sub(cam.position); const dz = Math.max(.5, -_hv.dot(CV.back)) * U; ppu = H / 2 / (Math.tan(p.fov * DEG / 2) * dz); }
  const want = clamp(Math.round(ppu * 8) / 8, .5, 4);
  if (Math.abs(want - CV.scale) / CV.scale > .2) CV.scale = want;
  CV.ppm = CV.scale * U; CV.thick = Math.max(1, Math.round(CV.scale / 1.5));
  OUTLINE_PX.value.set(2 / W * CV.thick, 2 / H * CV.thick);
  _fr.setFromProjectionMatrix(_pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse), cam.coordinateSystem);
  CAM.cam = cam;
  return cam;
}
/** on screen: a sphere round a body inside the camera's view */
const visible = (x, y, z) => _fr.intersectsSphere(_sph.set(_look.set(x / U, (z + 14) / U, y / U), 2.2));
/** a point (engine units) on the overlay's pixels (W x H), or null behind the camera */
const _pp3 = new THREE.Vector3();
function project(x, y, z, W, H) {
  _pp3.set(x / U, z / U, y / U).project(CAM.cam); if (_pp3.z > 1 || _pp3.z < -1) return null;
  return [(_pp3.x + 1) / 2 * W, (1 - _pp3.y) / 2 * H];
}
/** the engine view the cards are drawn from: the camera's turn and tilt, at the cards' pixel size */
const cardViews = new Map();
function cardView() {
  const key = CV.yaw + ':' + CV.pitch + ':' + CV.scale; let v = cardViews.get(key);
  if (!v) { if (cardViews.size > 500) cardViews.clear(); v = new E.View('card', 'Card', CV.yaw, CV.pitch, CV.scale, 1); cardViews.set(key, v); }
  return v;
}
/** which walls stand cut low (those facing an outside camera: the views), and which pillars are cut to stumps (those
 *  between a view's camera and the hero); none for cameras inside the hall (the chase camera slides in front instead) */
const _cutA = [0, 0, 0], _hh = [0, 0, 0], AIM_HERO = [[0, 0, 26], [0, 0, 2]], AIM_FIGHT = [...AIM_HERO, [40, 0, 2], [-40, 0, 2], [0, 40, 2], [0, -40, 2]];
function placeCut() {
  const p = CAM.pose; if (!p) return;
  if (cam3d()) { placeWalls('none', null); placePillars('none', null); return; }
  const [yw, pt] = CAM.view === 'side' && CAM.depth ? [0, 14] : viewAngles();
  const fx = Math.sin(yw * DEG), fy = Math.cos(yw * DEG);
  placeWalls(pt > 85 ? 'none' : 'cut:' + yw, pt > 85 ? null : c => c.ox * fx + c.oy * fy > .3);
  // the camera (an orthographic one: far back along its direction) to the hero's head, and to the floor round him where
  // the fight is (his feet and four points 40 units out; from a steep view, which a pillar hides little of, him only):
  // a pillar in the way of any of them is cut
  const far = p.ortho ? 3000 : 0, cp = Math.cos(p.pitch);
  _cutA[0] = p.x - Math.cos(p.yaw) * cp * far; _cutA[1] = p.y - Math.sin(p.yaw) * cp * far; _cutA[2] = p.z - Math.sin(p.pitch) * far;
  const aims = pt >= 60 ? AIM_HERO : AIM_FIGHT;
  const cut = PILLARS.map(([x0, y0, x1, y1]) => aims.some(([dx, dy, dz]) => { _hh[0] = hero.x + dx; _hh[1] = hero.y + dy; _hh[2] = hero.z + dz; return segBox(_cutA, _hh, x0 * T - 4, y0 * T - 4, 0, (x1 + 1) * T + 4, (y1 + 1) * T + 4, PILLAR_H); }));
  placePillars(cut.map(c => c ? 1 : 0).join(''), r => cut[PILLARS.indexOf(r)]);
}

/* ---- the controls: what the keys, mouse and pad mean in this camera ---- */
const screenEl = $('screen');
const INPUT = new E.Input({ canvas: screenEl, clientToScreen: () => null }, {
  up: ['KeyW', 'ArrowUp', 'Pad12'], down: ['KeyS', 'ArrowDown', 'Pad13'], left: ['KeyA', 'ArrowLeft', 'Pad14'], right: ['KeyD', 'ArrowRight', 'Pad15'],
  attack: ['KeyJ', 'Mouse0', 'Pad2', 'Pad7'], dash: ['ShiftLeft', 'ShiftRight', 'KeyK', 'Pad1', 'Pad6'], jump: ['Space', 'Pad0'], skill: ['KeyE', 'KeyL', 'Mouse2', 'Pad3', 'Pad5']
});
const _ray = new THREE.Raycaster(), _ndc = new THREE.Vector2();
/** where the mouse points on the floor at the hero's height (engine units), or null */
function mouseOnFloor() {
  const r = screenEl.getBoundingClientRect(), m = INPUT.mouse; if (!r.width || !m.active) return null;
  _ndc.set((m.cx - r.left) / r.width * 2 - 1, -((m.cy - r.top) / r.height * 2 - 1));
  _ray.setFromCamera(_ndc, CAM.cam); const o = _ray.ray.origin, d = _ray.ray.direction, y0 = (hero.z + 4) / U;
  if (Math.abs(d.y) < 1e-4) return null;
  const k = (y0 - o.y) / d.y; if (k < 0) return null;
  return [(o.x + d.x * k) * U, (o.z + d.z * k) * U];
}
const CTL = {
  move: [0, 0], aim: null, cam: [0, 1, .5],
  pressed: (a, win) => INPUT.buffered(a, win), use: a => INPUT.consume(a)
};
/** this step's controls: the move turned to the camera, the aim, the camera's direction (20-sim reads them) */
function controls() {
  const p = CAM.pose || { yaw: -Math.PI / 2, pitch: -.6 }, fly = CAM.mode === 'fly';
  const fx = Math.cos(p.yaw), fy = Math.sin(p.yaw), mv = fly ? [0, 0] : INPUT.move();
  // W walks away from the camera: forward is where it looks on the ground, right is to its right
  CTL.move[0] = -fy * mv[0] + fx * -mv[1]; CTL.move[1] = fx * mv[0] + fy * -mv[1];
  CTL.cam[0] = -fx; CTL.cam[1] = -fy; CTL.cam[2] = Math.cos(p.pitch);
  let aim = null;
  if (!fly) {
    if ((CAM.mode === 'chase' || CAM.mode === 'first') && CAM.locked) aim = p.yaw;
    else if (INPUT.aimSource === 'pad' && INPUT.padAim) { const a = INPUT.padAim; aim = Math.atan2(fx * a[0] + fy * -a[1], -fy * a[0] + fx * -a[1]); }   // (the right stick, turned as the move is)
    else if (INPUT.aimSource === 'mouse') { const m = mouseOnFloor(); if (m && Math.hypot(m[0] - hero.x, m[1] - hero.y) > 3) aim = Math.atan2(m[1] - hero.y, m[0] - hero.x); }
  }
  CTL.aim = aim;
  return CTL;
}

/* ---- switching ---- */
/** out of the hero's head (first person) into a spot behind and above him, where fly and fixed cameras show him */
const backOff = p => ({ x: p.x - Math.cos(p.yaw) * 56, y: p.y - Math.sin(p.yaw) * 56, z: p.z + 26, yaw: p.yaw, pitch: Math.min(p.pitch, -.3), fov: p.fov });
function setCam(mode, keepPose) {
  if (mode === CAM.mode && !keepPose) return;
  const was = CAM.mode, p = CAM.pose;
  if (mode !== 'view' && was === 'view' && p) CAM.yaw = p.yaw;   // from a view: keep looking the same way
  if (mode === 'fly' && p && was !== 'view') Object.assign(CAM.fly, was === 'first' ? backOff(p) : { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, fov: p.fov });
  else if (mode === 'fly' && was === 'view') Object.assign(CAM.fly, { x: hero.x - Math.cos(CAM.yaw) * 120, y: hero.y - Math.sin(CAM.yaw) * 120, z: hero.z + 80, yaw: CAM.yaw, pitch: -.4, fov: 70 });
  if ((mode === 'chase' || mode === 'first') && p && was !== 'view') CAM.yaw = p.yaw;
  CAM.mode = mode; CAM.smooth = null; CAM.held.clear(); INPUT.clear();
  if (mode === 'view' || mode === 'fixed') { CAM.locked = false; if (document.pointerLockElement) document.exitPointerLock(); }
  note(mode === 'view' ? VIEW_LABEL[CAM.view].toUpperCase() + ' VIEW' : CAM_LABEL[mode].toUpperCase());
  syncUI();
}
function setView(v) {
  CAM.view = v; if (CAM.mode !== 'view') setCam('view');
  if (v === 'side' && CAM.depth) CAM.rail.ready = false;
  note(VIEW_LABEL[v].toUpperCase() + (v === 'side' && CAM.depth ? ' WITH DEPTH' : ' VIEW')); syncUI();
}
function setDepth(on) { CAM.depth = on; CAM.rail.ready = false; if (on && CAM.view !== 'side') CAM.view = 'side'; if (CAM.mode !== 'view') setCam('view'); note(on ? 'SIDE SCROLLING WITH DEPTH' : 'FLAT SIDE VIEW'); syncUI(); }
function setProj(p) { CAM.proj = p; note(p === 'ortho' ? 'ORTHOGRAPHIC' : 'PERSPECTIVE'); syncUI(); }
/** F: fix a view where it is, or a 3D camera into a fixed one (the hero is yours again); free a fixed one into fly mode */
function toggleFix() {
  if (CAM.mode === 'view') { const f = CAM.focus || [hero.x, hero.y, hero.z]; Object.assign(CAM.fix, { on: !CAM.fix.on, x: f[0], y: f[1], z: f[2] }); note(CAM.fix.on ? 'CAMERA FIXED' : 'CAMERA FOLLOWS THE HERO'); syncUI(); return; }
  if (CAM.mode === 'fixed') { setCam('fly', true); return; }
  const p = CAM.mode === 'first' ? backOff(CAM.pose || firstPose(0)) : CAM.pose || chasePose(0);
  CAM.fixed = { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, fov: p.fov };
  if (document.pointerLockElement) document.exitPointerLock();
  setCam('fixed', true);
}
const fixedNow = () => CAM.mode === 'fixed' || (CAM.mode === 'view' && CAM.fix.on);
function zoomStep(d) {
  if (CAM.mode === 'chase') CAM.chase.dist = clamp(CAM.chase.dist * (d > 0 ? 1 / 1.15 : 1.15), 24, 260);
  else if (CAM.mode === 'first') CAM.first.fov = clamp(CAM.first.fov - d * 5, 45, 110);
  else if (CAM.mode === 'fly' || CAM.mode === 'fixed') { const c = CAM.mode === 'fly' ? CAM.fly : CAM.fixed; c.fov = clamp(c.fov - d * 5, 30, 110); }
  else { const i = ZOOMS.findIndex(z => z >= CAM.zoom - 1e-6); CAM.zoom = ZOOMS[clamp(i + d, 0, ZOOMS.length - 1)]; note('ZOOM ' + CAM.zoom + 'X'); }
  syncUI();
}
function turn(deg) { CAM.turn = ((CAM.turn + deg) % 360 + 360) % 360; note('TURN ' + CAM.turn + ' DEG'); syncUI(); }
function resetCam() {
  Object.assign(CAM, { zoom: 1, turn: 0, fov: 40 }); CAM.fix.on = false; CAM.rail.ready = false;
  Object.assign(CAM.chase, { pitch: -.36, dist: 88, fov: 60 }); Object.assign(CAM.first, { pitch: -.08, fov: 75 });
  note('CAMERA RESET'); syncUI();
}
/** the camera in words, for the benchmark's report */
function camDesc() {
  if (CAM.mode !== 'view') return CAM_LABEL[CAM.mode] + ' (perspective, ' + Math.round((CAM.pose || {}).fov || 60) + '° field of view)';
  if (CAM.view === 'side' && CAM.depth) return 'Side scrolling with depth (a perspective camera on a rail)' + (CAM.fix.on ? ', camera fixed' : '');
  const [yw, pt] = viewAngles();
  return (CAM.view === 'custom' ? 'Custom view (turn ' + yw + '°, tilt ' + pt + '°)' : VIEW_LABEL[CAM.view] + ' view') + ', ' + (CAM.proj === 'ortho' || sideFlat() ? 'orthographic' : 'perspective, ' + Math.round(CAM.fov) + '° field of view') +
    ', distance ' + CAM.dist + 'x, zoom ' + CAM.zoom + 'x' + (CAM.turn ? ', turned ' + CAM.turn + '°' : '') + (CAM.fix.on ? ', camera fixed' : '');
}
/** the camera as a link */
function camLink() {
  const u = new URL(location.href); for (const k of ['cam', 'cam3', 'view', 'depth', 'proj']) u.searchParams.delete(k);
  const add = [];
  const pose = q => [Math.round(q.x), Math.round(q.y), Math.round(q.z), Math.round(q.yaw / DEG), Math.round(q.pitch / DEG), Math.round(q.fov)].join(',');
  if (CAM.mode === 'fixed' || CAM.mode === 'fly') add.push('cam3=' + CAM.mode + ',' + pose(CAM.mode === 'fixed' ? CAM.fixed : CAM.fly));
  else if (CAM.mode !== 'view') add.push('cam3=' + CAM.mode);
  else if (CAM.view === 'side' && CAM.depth) add.push('view=side&depth=1');
  else {
    const [yw, pt] = viewAngles(), n = [yw, pt, CAM.zoom, Math.round(CAM.fix.on ? CAM.fix.z : (CAM.focus || [0, 0, 8])[2]), 1];
    if (CAM.fix.on) n.push(Math.round(CAM.fix.x), Math.round(CAM.fix.y));
    add.push('cam=' + n.join(','));
    if (CAM.proj === 'ortho') add.push('proj=ortho');
  }
  const rest = u.search.slice(1); return u.origin + u.pathname + '?' + [rest, ...add].filter(Boolean).join('&') + u.hash;
}

/* ---- keys, wheel and mouse (taken before the game sees them where a camera needs them) ---- */
const FLY_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyQ', 'KeyE', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyJ', 'KeyK', 'KeyL']);
const typingIn = e => { const t = e.target; return t && (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || (t.tagName === 'INPUT' && !['range', 'checkbox', 'radio', 'button'].includes(t.type))); };
const take = e => { e.preventDefault(); e.stopImmediatePropagation(); };
addEventListener('keydown', e => {
  if (typingIn(e) || e.ctrlKey || e.metaKey || e.altKey) return;
  if (CAM.mode === 'fly' && FLY_KEYS.has(e.code)) { CAM.held.add(e.code); take(e); return; }
  if (/^Digit[1-4]$/.test(e.code)) { if (!e.repeat) setCam(['view', 'chase', 'first', 'fly'][+e.code.slice(5) - 1]); take(e); return; }
  if (e.repeat) return;
  if (e.code === 'BracketLeft' || e.code === 'BracketRight') { if (CAM.mode === 'chase' || CAM.mode === 'first') CAM.held.add(e.code); else if (CAM.mode === 'view') turn(e.code === 'BracketLeft' ? -45 : 45); take(e); }
  else if (e.code === 'Minus' || e.code === 'NumpadSubtract' || e.code === 'Equal' || e.code === 'NumpadAdd') { zoomStep(e.code === 'Equal' || e.code === 'NumpadAdd' ? 1 : -1); take(e); }
  else if (e.code === 'Digit0') { resetCam(); take(e); }
  else if (e.code === 'KeyV') { const i = VIEWS.indexOf(CAM.view); setView(CAM.mode !== 'view' ? CAM.view : VIEWS[(i + 1) % VIEWS.length]); take(e); }
  else if (e.code === 'KeyF') { toggleFix(); take(e); }
  else if (e.code === 'KeyM') { setDepth(!(CAM.depth && CAM.view === 'side')); take(e); }
  else if (e.code === 'KeyO') { setProj(CAM.proj === 'ortho' ? 'persp' : 'ortho'); take(e); }
}, true);
addEventListener('keyup', e => CAM.held.delete(e.code), true);
addEventListener('blur', () => CAM.held.clear());
let wheelT = 0;
addEventListener('wheel', e => { if (e.target !== screenEl) return; const t = performance.now(); if (cam3d() || t - wheelT > 120) { wheelT = t; zoomStep(e.deltaY < 0 ? 1 : -1); } }, { capture: true, passive: true });
addEventListener('pointerdown', e => {
  if (e.target !== screenEl || e.pointerType !== 'mouse' || !(CAM.mode === 'chase' || CAM.mode === 'first' || CAM.mode === 'fly')) return;
  if (CAM.mode === 'fly') e.stopPropagation();   // a click in fly mode only captures the mouse (no swing)
  if (!CAM.locked && screenEl.requestPointerLock) { try { const r = screenEl.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (err) { /* refused: the keys still turn */ } }
}, true);
document.addEventListener('pointerlockchange', () => { CAM.locked = document.pointerLockElement === screenEl; syncUI(); });
document.addEventListener('mousemove', e => {
  if (!CAM.locked) return;
  const k = .0024, dx = e.movementX || 0, dy = e.movementY || 0;
  if (CAM.mode === 'fly') { CAM.fly.yaw += dx * k; CAM.fly.pitch = clamp(CAM.fly.pitch - dy * k, -1.5, 1.5); }
  else if (CAM.mode === 'chase' || CAM.mode === 'first') { CAM.yaw += dx * k; const c = CAM.mode === 'chase' ? CAM.chase : CAM.first; c.pitch = clamp(c.pitch - dy * k, CAM.mode === 'chase' ? -1.3 : -1.2, CAM.mode === 'chase' ? .15 : 1.1); }
});

/* ---- links: ?cam= (a custom view, fixed), ?cam3= (a 3D camera) ---- */
{
  const n = (QS.get('cam') || '').split(',').map(Number);
  if (n.length >= 5 && n.every(Number.isFinite)) {
    Object.assign(CAM.custom, { yaw: n[0], pitch: clamp(n[1], 0, 90) }); CAM.view = 'custom'; CAM.zoom = clamp(n[2], .5, 3);
    if (n.length >= 7) Object.assign(CAM.fix, { on: true, x: n[5], y: n[6], z: clamp(n[3], -40, 120) });
  }
  const q = (QS.get('cam3') || '').split(','), m = q.slice(1).map(Number);
  if (['chase', 'first'].includes(q[0]) || (q[0] === 'fly' && q.length === 1)) CAM.mode = q[0];
  else if (['fly', 'fixed'].includes(q[0]) && m.length >= 5 && m.every(Number.isFinite)) {
    const p = { x: m[0], y: m[1], z: m[2], yaw: m[3] * DEG, pitch: clamp(m[4], -86, 86) * DEG, fov: clamp(m[5] || 70, 30, 110) };
    if (q[0] === 'fly') Object.assign(CAM.fly, p); else CAM.fixed = p;
    CAM.mode = q[0];
  }
}
