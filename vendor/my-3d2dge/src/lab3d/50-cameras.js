/* =============================================================================
 * CAMERAS: the engine's five fixed views, and the three a real 3D world gives for free.
 *   iso, threequarter, topdown, brawler, side   orthographic, from E.VIEWS (yaw, pitch, scale, zBoost): framed like the
 *        engine (LINES lines at zoom 1) and stretched in height by zBoost exactly as the engine does, through the
 *        projection matrix (boost() below). Q and E turn them 45°; the wheel zooms. They follow the hero while you play.
 *   orbit   perspective; drag to turn and tilt, the wheel to come closer
 *   fly     perspective, first person: WASD (arrows move the hero instead), Q and E down and up, drag to look
 *   chase   perspective, behind the hero; drag to swing round, the wheel for distance; the hero moves relative to it
 * Angles follow the engine's views: yaw 0 looks north (the camera on the south side), yaw turns the camera round to
 * the east; pitch 0 is level, 90 straight down.
 *   CAMS.update(dt, aspect)   moves the active camera (CAMS.cam) for this frame
 *   CAMS.cardView(p)          what a Card at p needs: the engine view's angles, pixels per metre, the card's axes
 *   CAMS.ground()             the camera's right and forward on the ground (the hero moves relative to them)
 *   CAMS.code() / CAMS.load(s)  the camera as text, for ?cam= (Fix camera)
 * ============================================================================= */
const FIXED_VIEWS = ['iso', 'threequarter', 'topdown', 'brawler', 'side'];
const CAM_NAMES = { iso: 'Isometric', threequarter: 'Three-quarter', topdown: 'Top-down', brawler: 'Brawler', side: 'Side', orbit: 'Orbit', fly: 'Fly', chase: 'Chase' };
const CAMS = {
  mode: 'iso', turn: 0, zoom: 1, fixed: false, aspect: 1, boostK: 1, yaw: 45, pitch: 30,
  focus: ROOM.centre.clone(),
  orbit: { yaw: 35, pitch: 32, dist: 17 },
  fly: { pos: new THREE.Vector3(ROOM.W / 2, 1.6, ROOM.H - 1.4), yaw: 0, pitch: -8 },
  chase: { yaw: 0, pitch: 16, dist: 4.4 },
  ortho: new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 120),
  persp: new THREE.PerspectiveCamera(35, 1, .05, 120)
};
CAMS.cam = CAMS.ortho;
const DEG = Math.PI / 180;
/** the direction from what a camera looks at to the camera, for engine angles (degrees) */
const toCamera = (yaw, pitch, out = new THREE.Vector3()) => out.set(Math.sin(yaw * DEG) * Math.cos(pitch * DEG), Math.sin(pitch * DEG), Math.cos(yaw * DEG) * Math.cos(pitch * DEG));
/** the engine's height boost: world heights stretched by k in the projection only (V S V^-1), so lights, shadows and
 *  physics keep true heights while the picture matches the engine's view */
const _S = new THREE.Matrix4(), _M = new THREE.Matrix4();
function boost(cam, k) {
  cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  if (k !== 1) {
    _M.copy(cam.matrixWorldInverse).multiply(_S.makeScale(1, k, 1)).multiply(cam.matrixWorld);
    cam.projectionMatrix.multiply(_M); cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  }
}
CAMS.set = function (mode) {
  if (mode === 'fly' && CAMS.mode !== 'fly') {   // fly starts at the room's edge on the camera's side, eye high, looking in the same way
    const f = CAMS.focus, y = CAMS.yaw * DEG, dx = Math.sin(y), dz = Math.cos(y), lo = 1.3;
    const reach = (p, d, max) => d > 1e-6 ? (max - lo - p) / d : d < -1e-6 ? (lo - p) / d : Infinity, k = Math.min(reach(f.x, dx, ROOM.W), reach(f.z, dz, ROOM.H));
    CAMS.fly.pos.set(f.x + dx * k, 1.7, f.z + dz * k); CAMS.fly.yaw = CAMS.yaw; CAMS.fly.pitch = -10;
  }
  if (mode === 'orbit' && CAMS.mode !== 'orbit') { CAMS.orbit.yaw = CAMS.yaw; CAMS.orbit.pitch = clamp(CAMS.pitch, 8, 80); }
  if (mode === 'chase' && CAMS.mode !== 'chase') CAMS.chase.yaw = 90 - SIM.hero.facing / DEG + 180;   // behind the hero
  CAMS.mode = mode; CAMS.cam = FIXED_VIEWS.includes(mode) ? CAMS.ortho : CAMS.persp;
};
CAMS.update = function (dt, aspect, follow) {
  CAMS.aspect = aspect;
  const h = SIM.hero, heroAt = new THREE.Vector3(h.x, 0, h.z);
  // what fixed and orbit views look at: the room's centre, or the hero while you play (unless the camera is fixed)
  if (!CAMS.fixed) CAMS.focus.lerp(follow ? heroAt : ROOM.centre, 1 - Math.exp(-dt * 5));
  const m = CAMS.mode;
  if (FIXED_VIEWS.includes(m)) {
    const V = E.VIEWS[m], c = CAMS.ortho, hgt = LINES / (V.scale * U * CAMS.zoom);
    CAMS.yaw = V.yawDeg + CAMS.turn; CAMS.pitch = V.pitchDeg; CAMS.boostK = V.zBoost;
    Object.assign(c, { top: hgt / 2, bottom: -hgt / 2, left: -hgt / 2 * aspect, right: hgt / 2 * aspect });
    c.position.copy(CAMS.focus).addScaledVector(toCamera(CAMS.yaw, CAMS.pitch), 40); c.up.set(0, 1, 0);
    if (CAMS.pitch > 89) c.up.set(-Math.sin(CAMS.yaw * DEG), 0, -Math.cos(CAMS.yaw * DEG));
    c.lookAt(CAMS.focus);
  } else {
    const c = CAMS.persp; c.aspect = aspect; CAMS.boostK = 1;
    if (m === 'orbit') {
      const o = CAMS.orbit; c.fov = 35; CAMS.yaw = o.yaw; CAMS.pitch = o.pitch;
      const at = CAMS.focus.clone().setY(.8); c.position.copy(at).addScaledVector(toCamera(o.yaw, o.pitch), o.dist); c.lookAt(at);
    } else if (m === 'fly') {
      const f = CAMS.fly; c.fov = 70; CAMS.yaw = f.yaw; CAMS.pitch = -f.pitch;
      c.position.copy(f.pos); c.rotation.set(f.pitch * DEG, f.yaw * DEG, 0, 'YXZ');
    } else {   // chase: behind and above the hero, kept inside the room, swinging round behind it as it walks
      const o = CAMS.chase; c.fov = 55;
      if (!CAMS.dragging && Math.hypot(h.moved[0], h.moved[1]) > .5) o.yaw += E.angDiff(o.yaw * DEG, (90 - h.facing / DEG + 180) * DEG) / DEG * Math.min(1, dt * 1.6);
      CAMS.yaw = o.yaw; CAMS.pitch = o.pitch;
      const at = new THREE.Vector3(h.x, h.y + 1.15, h.z), want = at.clone().addScaledVector(toCamera(o.yaw, o.pitch), o.dist);
      want.x = clamp(want.x, 1.25, ROOM.W - 1.25); want.z = clamp(want.z, 1.25, ROOM.H - 1.25); want.y = clamp(want.y, .5, WALL_H - .2);
      c.position.lerp(want, CAMS.chaseSnap ? 1 : 1 - Math.exp(-dt * 10)); CAMS.chaseSnap = false; c.lookAt(at);
    }
  }
  boost(CAMS.cam, CAMS.boostK);
  // cut away the walls on the camera's side when it looks in from outside (fixed, orbit, or any camera out of the room)
  const p = CAMS.cam.position, inside = p.x > 1 && p.x < ROOM.W - 1 && p.z > 1 && p.z < ROOM.H - 1;
  const from = FIXED_VIEWS.includes(m) || m === 'orbit' ? p.clone().sub(CAMS.focus) : inside ? null : p.clone().sub(ROOM.centre);
  setCutaway(from && new THREE.Vector2(from.x, from.z).normalize(), CAMS.pitch < 15);
};
/** the camera's right and forward on the ground, in metres: the hero walks relative to what you see */
CAMS.ground = function () {
  const y = CAMS.yaw * DEG;
  return { right: [Math.cos(y), -Math.sin(y)], forward: [-Math.sin(y), -Math.cos(y)] };
};
/** what a Card at p (three.js) needs: the angles an engine View would have there, the game's pixels per metre, the
 *  card's axes (the camera's), and vert: how much the boost stretches the card's height (it undoes that) */
const _cv = { right: new THREE.Vector3(), up: new THREE.Vector3(), back: new THREE.Vector3(), quaternion: new THREE.Quaternion() };
CAMS.cardView = function (p) {
  const c = CAMS.cam, v = _cv;
  c.getWorldQuaternion(v.quaternion);
  v.right.set(1, 0, 0).applyQuaternion(v.quaternion); v.up.set(0, 1, 0).applyQuaternion(v.quaternion); v.back.set(0, 0, 1).applyQuaternion(v.quaternion);
  if (c.isOrthographicCamera) {
    v.yaw = CAMS.yaw; v.pitch = CAMS.pitch; v.boost = CAMS.boostK; v.ppm = LINES / (c.top - c.bottom);
    v.vert = 1 + (CAMS.boostK - 1) * v.up.y * v.up.y;
  } else {
    const d = c.position.clone().sub(p), depth = Math.max(.2, d.dot(v.back));   // how far in front of the camera p is
    v.yaw = Math.atan2(d.x, d.z) / DEG; v.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)) / DEG; v.boost = 1; v.vert = 1;
    v.ppm = (LINES / 2) / (Math.tan(c.fov * DEG / 2) * depth);
  }
  return v;
};
CAMS.code = function () {
  const r = n => Math.round(n * 100) / 100, m = CAMS.mode;
  if (FIXED_VIEWS.includes(m)) return [m, r(CAMS.turn), r(CAMS.zoom), r(CAMS.focus.x), r(CAMS.focus.z)].join(',');
  if (m === 'orbit') return [m, r(CAMS.orbit.yaw), r(CAMS.orbit.pitch), r(CAMS.orbit.dist), r(CAMS.focus.x), r(CAMS.focus.z)].join(',');
  if (m === 'fly') return [m, r(CAMS.fly.pos.x), r(CAMS.fly.pos.y), r(CAMS.fly.pos.z), r(CAMS.fly.yaw), r(CAMS.fly.pitch)].join(',');
  return [m, r(CAMS.chase.yaw), r(CAMS.chase.pitch), r(CAMS.chase.dist)].join(',');
};
CAMS.load = function (s) {
  const [m, ...n] = String(s).split(','), v = n.map(Number);
  if (!CAM_NAMES[m] || v.some(x => !isFinite(x))) return false;
  CAMS.set(m);
  if (FIXED_VIEWS.includes(m)) { CAMS.turn = v[0] || 0; CAMS.zoom = clamp(v[1] || 1, .5, 4); if (v.length > 3) CAMS.focus.set(v[2], 0, v[3]); }
  else if (m === 'orbit') { Object.assign(CAMS.orbit, { yaw: v[0] || 0, pitch: clamp(v[1] || 30, 2, 89), dist: clamp(v[2] || 17, 3, 40) }); if (v.length > 4) CAMS.focus.set(v[3], 0, v[4]); }
  else if (m === 'fly') { if (v.length >= 5) { CAMS.fly.pos.set(v[0], v[1], v[2]); CAMS.fly.yaw = v[3]; CAMS.fly.pitch = clamp(v[4], -89, 89); } }
  else Object.assign(CAMS.chase, { yaw: v[0] || 0, pitch: clamp(v[1] || 16, -10, 70), dist: clamp(v[2] || 4.4, 1.5, 9) });
  return true;
};
