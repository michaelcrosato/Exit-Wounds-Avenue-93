/* =============================================================================
 * MOCAP  plays animation sets in the readable format (src/mocap/readable.js; written by tools/anim-import.mjs) on
 * my-3D2dge rigs.
 *   const lib = Mocap.load(window.MOCAP.QUATERNIUS);   // a set: its clips, and the bodies they were measured on
 *   const clip = lib.clip('Dance_Loop');               // { name, dur, loop, tags, desc, keys }
 *   const pose = lib.sample(clip, t);                  // Float32Array: every body point's f r z (mm), in-betweened
 *   const man = new Mocap.Mannequin(lib, { height: 34 });  man.draw(g, ox, oy, view, pose, facing)
 *   Mocap.drive(humanoid, lib)  then each step  humanoid.mocap = pose: the rig plays it at its own build.
 *     humanoid.mocapW (0..1) fades it in and out over the rig's own animation; humanoid.mocapMask = 'upper' plays
 *     only the chest, head and arms over the rig's own legs (an interaction while walking); humanoid.mocapBlade = true
 *     while the clip holds a sword (the blade follows the fist).
 * Points are in the rig's local frame: f = forward, r = right, z = up, centred on the root on the ground.
 * ============================================================================= */
const Mocap = (() => {
'use strict';
const E = My3D2dge, { px } = E, MR = MocapReadable;

/* ---- sets ---- */
/**
 * Every clip is rebuilt on the first library's proportions (the format does not depend on size); each keeps how its own
 * library bends the spine, since the key poses were measured that way.
 */
function load(set) {
  const P = MR.P, idx = MR.IDX, ids = Object.keys(set.sources), base = set.sources[ids[0]].rest, rests = {};
  for (const id of ids) rests[id] = Object.assign({}, base, { spineW: set.sources[id].rest.spineW, neckW: set.sources[id].rest.neckW });
  const meta = c => ({ name: c.clip, fps: set.fps, n: Math.round(c.dur * set.fps) + 1 }), clips = {};
  for (const [name, c] of Object.entries(set.clips)) clips[name] = Object.assign(meta(Object.assign({ clip: name }, c)), c);
  const restOf = c => rests[c.src] || base;
  const lib = { set, P, idx, clips, names: Object.keys(clips), fps: set.fps, body: set.body, rest: base, points: MR.POINTS };
  lib.clip = name => clips[name] || null;
  /** the pose at time t (seconds): key poses in-betweened, loops wrap, one-shots hold their last pose */
  lib.sample = (clip, t, out = new Float32Array(P * 3)) => { MR.pose(restOf(clip), clip, t, out); out.src = clip.src; return out; };   // (src: whose rest it is measured against)
  /** a clip that travels: how far it has carried the body at time t ([forward, right] mm), or null */
  lib.moveAt = (clip, t) => MR.moveAt(restOf(clip), clip, t);
  /** swap in an edited clip (readable text a person or a model changed); the original is kept for restore() */
  const originals = {};
  lib.replace = (name, edited) => { if (!originals[name]) originals[name] = clips[name]; clips[name] = Object.assign({}, originals[name], edited, { name, keys: edited.keys }); return clips[name]; };
  lib.restore = name => { if (originals[name]) { clips[name] = originals[name]; delete originals[name]; } return clips[name]; };
  lib.edited = name => !!originals[name];
  /** the clip as the text a model reads (its header and its key poses) */
  lib.text = clip => { const o = { clip: clip.clip || clip.name }; for (const k of ['src', 'take', 'orig', 'dur', 'loop', 'tags', 'desc']) if (clip[k] !== undefined) o[k] = clip[k]; o.keys = clip.keys; return MR.text(o); };
  /** where a clip came from: its library's label, origin and license (from the set's sources), the clip it was made from,
   *  and (a capture database's) the take and the stretch of it: '13_29 2.30-3.42' */
  lib.origin = clip => { const s = set.sources[clip.src] || {}; return { src: clip.src, label: s.label || clip.src, origin: s.origin || '', license: s.license || '', url: s.url || '', orig: clip.orig || null, take: clip.take || null }; };
  /** a pose blended from a to b (crossfades between clips) */
  lib.blend = (a, b, k, out = new Float32Array(P * 3)) => { for (let i = 0; i < P * 3; i++) out[i] = a[i] + (b[i] - a[i]) * k; out.src = (k < .5 ? a : b).src; return out; };
  lib.pt = (pose, name) => { const i = idx[name] * 3; return [pose[i], pose[i + 1], pose[i + 2]]; };
  lib.error = MR.error;
  return lib;
}

/* ---- the look-alike mannequin: shaded capsules in the source model's proportions, with its joint bands ---- */
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const add3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm3 = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
class Mannequin {
  /** o: { height: world units tall (34), main: '#e8aa3a', joint: '#aa66db' } (the colors of the source model's two materials) */
  constructor(lib, o = {}) {
    this.lib = lib; this.o = Object.assign({ height: 34, main: '#e8aa3a', joint: '#aa66db' }, o);
    this.k = this.o.height / ((lib.body && lib.body.height) || 1829);   // world units per mm
    this._ops = [];
  }
  /**
   * draw the pose into g with (ox, oy) = the projected root. Every part is a capsule between two body points,
   * sorted by true camera depth, drawn dark-then-lit like the engine's HD rigs.
   */
  draw(g, ox, oy, view, pose, facing = 0) {
    const L = this.lib, o = this.o, k = this.k, ca = Math.cos(facing), sa = Math.sin(facing), sc = view.scale;
    const pt = name => L.pt(pose, name);
    const S = p => { const wx = (p[0] * ca - p[1] * sa) * k, wy = (p[0] * sa + p[1] * ca) * k, wz = p[2] * k; return [ox + view.ax * wx + view.ay * wy, oy + view.bx * wx + view.by * wy + view.bz * wz, view.dx * wx + view.dy * wy + view.dz * wz]; };
    const R = mm => mm * k * sc;   // a radius in mm -> screen pixels
    const ops = this._ops; ops.length = 0;
    const main = E.tones(o.main), joint = E.tones(o.joint);
    // centre depth of the body: parts behind it are drawn a touch darker (the far arm and leg)
    const mid = S(pt('spine1'))[2];
    const capsule = (A, B, ra, rb, col, dx = 0, dy = 0) => {
      const ax = A[0] + dx, ay = A[1] + dy, bx = B[0] + dx, by = B[1] + dy, vx = bx - ax, vy = by - ay, l = Math.hypot(vx, vy);
      if (l > .01) { const nx = -vy / l, ny = vx / l; px.poly(g, [[ax + nx * ra, ay + ny * ra], [bx + nx * rb, by + ny * rb], [bx - nx * rb, by - ny * rb], [ax - nx * ra, ay - ny * ra]], col); }
      px.disc(g, ax, ay, Math.max(.5, ra - .3), col); px.disc(g, bx, by, Math.max(.5, rb - .3), col);
    };
    // a shaded part: dark silhouette, the base color shifted toward the light (upper left), a soft highlight
    const part = (a, b, ra, rb, T, bias = 0) => {
      const A = S(a), B = S(b), pa = R(ra), pb = R(rb), far = (A[2] + B[2]) * .5 < mid - 2 * k * 60;
      ops.push({ d: (A[2] + B[2]) * .5 + bias, f: () => {
        capsule(A, B, pa, pb, far ? T.deep : T.sh);
        capsule(A, B, Math.max(.5, pa - .9), Math.max(.5, pb - .9), far ? T.sh : T.base, -.5, -.6);
        if (pa > 2.2 && !far) capsule(A, B, pa * .32, pb * .32, T.lt, -pa * .38, -pa * .42);
      } });
    };
    // a ring painted round a limb (the second material): a straight-edged stripe across the capsule, no round ends,
    // so a thin band reads as a band from every side. Seen end-on (the limb points at the camera) it is hidden.
    const band = (a, b, t0, t1, ra, rb, T) => {
      const A = S(lerp3(a, b, t0)), B = S(lerp3(a, b, t1)), axis = S(a), end = S(b), vx = end[0] - axis[0], vy = end[1] - axis[1], l = Math.hypot(vx, vy);
      if (l < R(Math.max(ra, rb)) * .5) return;
      const nx = -vy / l, ny = vx / l, wa = R(ra + (rb - ra) * t0) + .2, wb = R(ra + (rb - ra) * t1) + .2;
      ops.push({ d: (axis[2] + end[2]) * .5 + .02, f: () => {
        const q = (w0, w1, dx, dy) => [[A[0] + nx * w0 + dx, A[1] + ny * w0 + dy], [B[0] + nx * w1 + dx, B[1] + ny * w1 + dy], [B[0] - nx * w1 + dx, B[1] - ny * w1 + dy], [A[0] - nx * w0 + dx, A[1] - ny * w0 + dy]];
        px.poly(g, q(wa, wb, 0, 0), T.sh); px.poly(g, q(Math.max(.5, wa - .9), Math.max(.5, wb - .9), -.5, -.6), T.base);
      } });
    };

    const pelvis = pt('pelvis'), sp1 = pt('spine1'), sp2 = pt('spine2'), chest = pt('chest'), neck = pt('neck'), head = pt('head'), top = pt('headTop'), face = pt('faceF'), chestF = pt('chestF');
    const fwdC = norm3(sub3(chestF, chest)), fwdH = norm3(sub3(face, head));
    // legs: thigh, shin, foot (heel to ball), toes; purple at the hip, knee and ankle
    for (const s of ['L', 'R']) {
      const hip = pt('hip' + s), knee = pt('knee' + s), ank = pt('ankle' + s), b = pt('ball' + s), toe = pt('toe' + s);
      const heel = add3(lerp3(ank, b, -.28), [0, 0, -1], 45);
      part(hip, knee, 80, 60, main); band(hip, knee, .02, .1, 80, 62, joint);
      part(knee, ank, 56, 40, main); band(knee, ank, .86, 1, 56, 41, joint);
      band(hip, knee, .9, 1, 80, 60, joint); band(knee, ank, 0, .1, 56, 40, joint);   // the knee ring
      part(heel, b, 44, 40, main, .005); part(b, toe, 38, 28, main, .006);
    }
    // torso: pelvis, a waist band, belly, a broad chest that runs shoulder to shoulder
    const shL = pt('shL'), shR = pt('shR'), clL = pt('clavL'), clR = pt('clavR');
    part(pt('hipL'), pt('hipR'), 92, 92, main, -.01);
    part(pelvis, sp1, 118, 112, main);
    part(sp1, sp2, 104, 112, main);
    band(sp1, sp2, .1, .26, 108, 112, joint);
    const pecL = add3(lerp3(chest, shL, .38), fwdC, 22), pecR = add3(lerp3(chest, shR, .38), fwdC, 22), up = norm3(sub3(neck, sp2));
    part(sp2, add3(chest, up, 40), 122, 132, main);
    part(add3(pecL, up, -30), add3(pecR, up, -30), 112, 112, main, .01);
    // neck (purple) and an egg-shaped head: a narrow jaw forward, a round crown
    part(add3(neck, up, -20), lerp3(head, top, .25), 48, 46, joint);
    const jaw = add3(lerp3(head, top, .3), fwdH, 26), crown = lerp3(head, top, .64);
    part(jaw, crown, 70, 96, main, .02);
    // arms: shoulder cap, upper arm, forearm, fist; purple elbow and wrist
    for (const s of ['L', 'R']) {
      const cl = s === 'L' ? clL : clR, sh = s === 'L' ? shL : shR, el = pt('elbow' + s), wr = pt('wrist' + s), kn = pt('knuck' + s), fist = pt('fist' + s);
      part(lerp3(cl, sh, .45), sh, 62, 68, main);
      part(sh, el, 62, 46, main); band(sh, el, .9, 1, 62, 46, joint);
      part(el, wr, 46, 34, main); band(el, wr, 0, .1, 46, 34, joint); band(el, wr, .86, 1, 46, 35, joint);
      part(wr, lerp3(kn, fist, .5), 36, 38, main, .005);
    }
    ops.sort((a, b) => a.d - b.d);
    for (const op of ops) op.f();
  }
}

/* ---- retarget onto a Humanoid: the clip's directions, the rig's own bone lengths, feet planted with IK ---- */
const V = E.V3;
const DRIVEN = ['hipC', 'hipL', 'hipR', 'kneeL', 'kneeR', 'footL', 'footR', 'shC', 'shL', 'shR', 'head', 'elbowL', 'elbowR', 'handL', 'handR', 'bladeDir'];
const UPPER = ['shC', 'shL', 'shR', 'head', 'elbowL', 'elbowR', 'handL', 'handR', 'bladeDir'];
const turn = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]]; };   // about the up axis
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** a frame from an up and a forward direction: 3x3, row-major, columns forward, right, up (the rig's f r z) */
function frame3(up, fwd) {
  const u = V.norm(up); let f = V.sub(fwd, V.mul(u, V.dot(fwd, u)));
  if (Math.hypot(f[0], f[1], f[2]) < 1e-6) f = Math.abs(u[0]) < .9 ? V.sub([1, 0, 0], V.mul(u, u[0])) : V.sub([0, 1, 0], V.mul(u, u[1]));
  f = V.norm(f); const r = cross(u, f);
  return [f[0], r[0], u[0], f[1], r[1], u[1], f[2], r[2], u[2]];
}
/** how far a part has turned from its rest: the frame now (up, forward) times the library's rest frame for it (rest: its
 *  forward, right and up, measured on the T-pose), so a part held as it stands at rest reads upright, whatever the library */
function tiltFrom(up, fwd, rest) {
  const C = frame3(up, fwd); if (!rest) return C;
  const T = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) T[i * 3 + j] = C[i * 3] * rest[0][j] + C[i * 3 + 1] * rest[1][j] + C[i * 3 + 2] * rest[2][j];
  return T;
}
/** a frame turned a about the up axis, and eased toward upright by w (0 = upright, 1 = the frame) */
function frameMix(m, a, w) {
  const col = i => turn([m[i], m[i + 3], m[i + 6]], a), f = col(0), u = col(2);
  return w >= 1 ? frame3(u, f) : frame3(V.lerp([0, 0, 1], u, w), V.lerp([1, 0, 0], f, w));
}
/**
 * Mocap.drive(rig, lib): after the rig poses itself each step it takes the pose in rig.mocap (a sampled pose, or
 * null to play its own animation). The rig keeps its build: each bone takes the clip's direction at its own length,
 * the feet and hands are placed in proportion and solved with the engine's two-bone IK, so the cape and hair follow.
 * The rig turns with the clip's chest (rig.spin: a spinning kick turns the face, hair and cape with it), and what it
 * draws around the joints follows the clip's body and head (rig.mocapTilt: upside down in a cartwheel, a face that
 * looks down). A held sword never goes through the floor.
 * rig.mocapW fades the clip over the rig's own pose; rig.mocapMask = 'upper' leaves the hips and legs to the rig.
 */
function drive(rig, lib) {
  const base = E.Humanoid.prototype._pose, update = E.Humanoid.prototype.update, R = lib.rest, hipH = R.hipZ, ankleH = R.ankleZ;
  const legSrc = R.thigh + R.shin, armSrc = R.up + R.fore + R.fist * .6;
  // the rig's own turn this step (an attack's spin), read before the clip turns it: _pose can run more than once a step
  rig.update = function (dt, s) { this._ownSpin = null; return update.call(this, dt, s); };
  rig._pose = function () {
    base.call(this);
    const pose = this.mocap, w = this.mocapW === undefined ? 1 : Math.max(0, Math.min(1, this.mocapW));
    if (this._ownSpin == null) this._ownSpin = this.spin || 0;
    if (!pose || w <= 0) { this.mocapTilt = null; this.spin = this._ownSpin; return; }
    const o = this.o, J = this.J, k = o.hipZ / hipH, upper = this.mocapMask === 'upper';
    // the body's heading: where the chest faces, flat on the floor. The rig turns to it, so the clip is read in a frame
    // turned with the body. A chest that faces up or down (lying, bent double) has no heading to trust: the rig faces ahead
    let yaw = 0;
    if (!upper) {
      const c = lib.pt(pose, 'chest'), cf = lib.pt(pose, 'chestF'), fx = cf[0] - c[0], fy = cf[1] - c[1], fl = Math.hypot(fx, fy);
      const trust = Math.max(0, Math.min(1, (fl / (Math.hypot(fx, fy, cf[2] - c[2]) || 1) - .3) / .3));
      if (trust > 0) yaw = Math.atan2(fy, fx) * trust;
    }
    const pt = yaw ? n => turn(lib.pt(pose, n), -yaw) : n => lib.pt(pose, n);
    const keep = w < 1 ? {} : null; if (keep) for (const key of DRIVEN) keep[key] = J[key] && J[key].slice();
    const mid = (a, b) => V.lerp(pt(a), pt(b), .5), hipsS = mid('hipL', 'hipR'), shS = mid('shL', 'shR');
    if (!upper) {
      // a clip that dips below the ground (an in-place jump's pointed toes, a zombie climbing out of a grave) is lifted
      // until its lowest point stands on it: the floor here hides nothing beneath it
      let lo = 0; for (let i = 2; i < pose.length; i += 3) if (pose[i] < lo) lo = pose[i];
      const hipC = V.add(V.mul(hipsS, k), [0, 0, -lo * k]), across = V.norm(V.sub(pt('hipR'), pt('hipL')));
      J.hipC = hipC; J.hipL = V.add(hipC, V.mul(across, -o.hipHalf)); J.hipR = V.add(hipC, V.mul(across, o.hipHalf));
      const legK = (o.legUpper + o.legLower) / legSrc;
      for (const s of ['L', 'R']) {
        const hip = J['hip' + s], hipSrc = pt('hip' + s), ank = pt('ankle' + s), knee = pt('knee' + s);
        const footSrc = V.sub(ank, [0, 0, ankleH * Math.min(1, Math.max(0, 1 - (ank[2] - ankleH) / 300))]);   // the sole, not the ankle, touches the ground
        let foot = V.add(hip, V.mul(V.sub(footSrc, hipSrc), legK)); if (foot[2] < 0) foot = [foot[0], foot[1], 0];
        const hint = V.norm(V.sub(knee, V.lerp(hipSrc, ank, .5)));
        const [kn, ft] = E.ik3(hip, foot, o.legUpper, o.legLower, hint); J['knee' + s] = kn; J['foot' + s] = ft;
      }
    }
    J.shC = V.add(J.hipC, V.mul(V.norm(V.sub(shS, hipsS)), o.torso));
    const sAcross = V.norm(V.sub(pt('shR'), pt('shL')));
    J.shL = V.add(J.shC, V.mul(sAcross, -o.shoulderHalf)); J.shR = V.add(J.shC, V.mul(sAcross, o.shoulderHalf));
    const headC = V.lerp(pt('head'), pt('headTop'), .45);
    J.head = V.add(J.shC, V.mul(V.norm(V.sub(headC, shS)), o.neck + o.headR));
    const armK = (o.armUpper + o.armLower) / armSrc;
    for (const s of ['L', 'R']) {
      const sh = J['sh' + s], shSrc = pt('sh' + s), fist = pt('fist' + s), el = pt('elbow' + s);
      const hand = V.add(sh, V.mul(V.sub(fist, shSrc), armK));
      const hint = V.norm(V.sub(el, V.lerp(shSrc, fist, .5)));
      const [e, h] = E.ik3(sh, hand, o.armUpper, o.armLower, hint); J['elbow' + s] = e; J['hand' + s] = h;
    }
    // a sword in a fist runs along the knuckles, out past the index finger (otherwise the blade keeps its resting angle)
    if (this.mocapBlade) J.bladeDir = V.norm(V.sub(pt('indexR'), pt('pinkyR')));
    // the frames the rig draws its details in (Humanoid._offsets): the chest's and the head's, as turned from how they sit
    // at rest. Only a whole-body clip sets them; an upper-body one keeps the rig's own
    const src = lib.set.sources[pose.src] || lib.set.sources[Object.keys(lib.set.sources)[0]], rest = src && src.rest;
    const body = upper ? null : tiltFrom(V.sub(pt('neck'), pt('chest')), V.sub(pt('chestF'), pt('chest')), rest && rest.Cr);
    const head = upper ? null : tiltFrom(V.sub(pt('headTop'), pt('head')), V.sub(pt('faceF'), pt('head')), rest && rest.Hr);
    // the turn the rig is drawn with: the clip's heading, faded in with the clip over the rig's own (an attack's spin)
    const own = this._ownSpin, spin = upper ? own : own * (1 - w) + yaw * w;
    if (keep) {
      const toM = yaw - spin, toK = own - spin;   // both poses into the frame the rig is drawn with, then blended
      for (const key of upper ? UPPER : DRIVEN) if (keep[key]) {
        const m = upper ? J[key] : turn(J[key], toM), kp = upper ? keep[key] : turn(keep[key], toK);
        J[key] = key === 'bladeDir' ? V.norm(V.lerp(kp, m, w)) : V.lerp(kp, m, w);
      }
    }
    this.spin = spin;
    this.mocapTilt = body ? { body: frameMix(body, yaw - spin, w), head: frameMix(head, yaw - spin, w) } : null;
    // lying on the back: the rig's knocked-down measure follows the torso (the game reads it: shadows, what a body on
    // the floor can do); the face, hair and toes it draws around the joints lie with the body through mocapTilt
    if (!upper) {
      const d = V.sub(shS, hipsS), back = Math.max(0, -d[0]), side = Math.hypot(d[0], d[1]), tilt = Math.atan2(side, d[2]);
      const down = side > 1e-6 ? Math.max(0, Math.min(1, tilt / (Math.PI / 2 * .96))) * back / side : 0;
      this.downW = (this.downW || 0) * (1 - w) + down * w;
      // and a weapon he is not holding up (no mocapBlade) drops flat on the floor beside the hand as he goes down
      const kn = V.sub(pt('indexR'), pt('pinkyR')), kl = Math.hypot(kn[0], kn[1]);
      if (!this.mocapBlade && down > 0 && kl > 1e-6 && J.bladeDir) J.bladeDir = V.norm(V.lerp(J.bladeDir, [kn[0] / kl, kn[1] / kl, -.08], Math.min(1, down * 1.5) * w));
    }
    // a sword never goes through the floor (hands planted in a cartwheel, a roll): the blade lowers no further than
    // to lie along it
    if (o.weapon === 'sword' && J.handR && J.bladeDir) {
      const h = J.handR[2], b = J.bladeDir, L = o.bladeLen, floor = .3;
      if (h + b[2] * L < floor && h > floor - L) {
        const bz = (floor - h) / L, hl = Math.hypot(b[0], b[1]), r = Math.sqrt(Math.max(0, 1 - bz * bz));
        J.bladeDir = hl > 1e-6 ? [b[0] / hl * r, b[1] / hl * r, bz] : [r, 0, bz];
      }
    }
  };
  return rig;
}

return { load, Mannequin, drive, LEGEND: MR.LEGEND };
})();
