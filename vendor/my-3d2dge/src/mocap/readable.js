/* =============================================================================
 * READABLE KEY POSES: the animation format my-3D2dge stores, and the one AI models (and people) read and edit.
 * A clip is a short list of key poses. Each pose names what an animator would: where the hips are, how the body,
 * chest and head turn and lean, how the shoulders reach and shrug, which way each arm and leg points with how much
 * elbow or knee bend, and how the feet point. It does not depend on body size, so the same clip fits any build, and
 * it mirrors by swapping L and R. Limbs are a direction plus a bend, not joint angles: an arm swinging through
 * straight down has no angle that flips, a bend in degrees rounds well, and an IK rig consumes exactly this.
 *
 * Shared by tools/anim-import.mjs (Node: it measures a captured body, fits each clip, writes the set) and the
 * browser (src/mocap/mocap.js: it rebuilds every body point from a set to draw or drive a rig). No dependencies.
 *   const rest = MocapReadable.measure(captureClips)          // a body's proportions, from its own clips
 *   const { clip } = MocapReadable.fit(rest, capClip, 30)     // key poses within 30 mm of the capture
 *   MocapReadable.text(clip)  MocapReadable.parse(text)  MocapReadable.mirror(clip)
 *   MocapReadable.pose(rest, clip, t, out)                    // 36 body points (mm) at time t
 * ============================================================================= */
var MocapReadable = (() => {
'use strict';

/** the body points a pose rebuilds, in the rig's local frame (f forward, r right, z up), millimetres */
const POINTS = ['pelvis', 'spine1', 'spine2', 'chest', 'neck', 'head', 'headTop', 'faceF', 'chestF', 'pelvisF',
  ...['L', 'R'].flatMap(s => ['clav', 'sh', 'elbow', 'wrist', 'index', 'knuck', 'pinky', 'fist', 'hip', 'knee', 'ankle', 'ball', 'toe'].map(p => p + s))];
const IDX = {}; POINTS.forEach((p, i) => IDX[p] = i);
const P = POINTS.length;

const LEGEND = `// my-3D2dge readable clip. Times in seconds; every other number is a whole number. Rig frame: forward, right, up.
// L and R are the figure's own sides. Directions are percentages and need not add up: [100, 0, 0] and [50, 0, 0] agree.
// hips   [forward, right, up]   the pelvis, in percent of standing hip height (100 = standing, 55 = sitting on a chair)
// body   [turn, lean, tilt]     the pelvis, degrees: turn + = toward the right, lean + = forward, tilt + = toward the right
// chest  [turn, lean, tilt]     the chest, relative to the pelvis        head [turn, lean, tilt]  relative to the chest
// shL shR    [reach, shrug]     degrees the shoulder swings forward (into a punch or an aim) and up, from rest
// armL armR  [forward, out, up, bend, twist]  which way the arm points from the shoulder to the fist, in chest space
//            (out + = away from the body on that side; [0, 0, -100] hangs down, [100, 0, 0] punches ahead);
//            bend = elbow bend in degrees (0 = straight); twist = degrees the elbow swings round the arm from its
//            natural direction (back and down)
// legL legR  [forward, out, up, bend, twist]  hip to ankle in pelvis space; bend: the knee; twist: from pointing forward
// footL footR [down, out, toes]   degrees the foot points down from standing, turns outward, and the toes bend up
// blade  [forward, right, up]   (sword clips) the direction of a blade held in the right fist, in chest space
// root   [forward, right]       (clips that travel) how far the whole body has moved, in percent of standing hip height`;

/* ---- vectors, frames, rotations ---- */
const RV = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len: a => Math.hypot(a[0], a[1], a[2]),
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
};
// a frame is [F, R, U]: its forward, right and up axes written in the parent's coordinates (f x r = u)
const frameFR = (right, fwd) => { const R = RV.norm(right), F = RV.norm(RV.sub(fwd, RV.mul(R, RV.dot(fwd, R)))); return [F, R, RV.cross(F, R)]; };
const frameUF = (up, fwd) => { const U = RV.norm(up), F = RV.norm(RV.sub(fwd, RV.mul(U, RV.dot(fwd, U)))); return [F, RV.cross(U, F), U]; };
const loc = (M, v) => [RV.dot(v, M[0]), RV.dot(v, M[1]), RV.dot(v, M[2])];
const wld = (M, l) => [M[0][0] * l[0] + M[1][0] * l[1] + M[2][0] * l[2], M[0][1] * l[0] + M[1][1] * l[1] + M[2][1] * l[2], M[0][2] * l[0] + M[1][2] * l[1] + M[2][2] * l[2]];
const rel = (Pm, Cm) => Cm.map(c => loc(Pm, c));          // child frame in parent coordinates
const compose = (Pm, Rm) => Rm.map(c => wld(Pm, c));      // parent then relative -> child in the grandparent's coordinates
const DG = Math.PI / 180;
// rotations as quaternions [x, y, z, w], to spread a bend over the spine and the neck
const quatOf = M => {   // frame [F, R, U] (columns) -> quaternion
  const [m00, m10, m20] = M[0], [m01, m11, m21] = M[1], [m02, m12, m22] = M[2], tr = m00 + m11 + m22;
  let q;
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, s / 4]; }
  else if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; q = [s / 4, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]; }
  else if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; q = [(m01 + m10) / s, s / 4, (m12 + m21) / s, (m02 - m20) / s]; }
  else { const s = Math.sqrt(1 + m22 - m00 - m11) * 2; q = [(m02 + m20) / s, (m12 + m21) / s, s / 4, (m10 - m01) / s]; }
  const l = Math.hypot(...q); return q.map(v => v / l);
};
const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qconj = q => [-q[0], -q[1], -q[2], q[3]];
const qrot = (q, v) => { const p = qmul(qmul(q, [v[0], v[1], v[2], 0]), qconj(q)); return [p[0], p[1], p[2]]; };
const qslerp = (a, b, t) => {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3], bb = b; if (d < 0) { d = -d; bb = b.map(v => -v); }
  if (d > .9995) { const o = a.map((v, i) => v + (bb[i] - v) * t), l = Math.hypot(...o); return o.map(v => v / l); }
  const th = Math.acos(d), k0 = Math.sin((1 - t) * th) / Math.sin(th), k1 = Math.sin(t * th) / Math.sin(th);
  return a.map((v, i) => v * k0 + bb[i] * k1);
};
/** the rotation that takes rest frame A to frame B (both [F, R, U]), as a quaternion */
const qFromTo = (A, B) => qmul(quatOf(B), qconj(quatOf(A)));
/** degrees [turn, lean, tilt] of a frame: yaw about up, then pitch about right (+ = forward), then roll (+ = toward the right) */
function euler(M) {
  const [F, , U] = M, yaw = Math.atan2(F[1], F[0]), pitch = Math.asin(Math.max(-1, Math.min(1, -F[2])));
  const cy = Math.cos(yaw), sy = Math.sin(yaw), u1 = [U[0] * cy + U[1] * sy, -U[0] * sy + U[1] * cy, U[2]], cp = Math.cos(pitch), sp = Math.sin(pitch);
  const u2 = [u1[0] * cp - u1[2] * sp, u1[1], u1[0] * sp + u1[2] * cp];
  return [yaw / DG, pitch / DG, -Math.atan2(-u2[1], u2[2]) / DG];
}
function fromEuler(a) {
  const y = a[0] * DG, p = a[1] * DG, r = -a[2] * DG, cy = Math.cos(y), sy = Math.sin(y), cp = Math.cos(p), sp = Math.sin(p), cr = Math.cos(r), sr = Math.sin(r);
  const rot = v => { let [x, yy, z] = v; [yy, z] = [yy * cr - z * sr, yy * sr + z * cr]; [x, z] = [x * cp + z * sp, -x * sp + z * cp]; return [x * cy - yy * sy, x * sy + yy * cy, z]; };
  return [rot([1, 0, 0]), rot([0, 1, 0]), rot([0, 0, 1])];
}
/** two-bone IK in 3D (the engine's E.ik3): returns [joint, end]; hint points the way the joint should bend */
function ik3(a, b, L1, L2, hint) {
  let d = RV.sub(b, a), dist = RV.len(d);
  const max = L1 + L2 - .01;
  if (dist > max) { d = RV.mul(d, max / dist); b = RV.add(a, d); dist = max; }
  dist = Math.max(dist, .01);
  const n = RV.mul(d, 1 / dist);
  let h = RV.sub(hint, RV.mul(n, RV.dot(hint, n)));
  const hl = RV.len(h);
  h = hl < 1e-4 ? [n[1], -n[0], 0] : RV.mul(h, 1 / hl);
  const x = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist), y = Math.sqrt(Math.max(0, L1 * L1 - x * x));
  return [RV.add(RV.add(a, RV.mul(n, x)), RV.mul(h, y)), b];
}
/** a two-bone limb: the bend at the middle joint (degrees, 0 = straight) for a root-to-end distance, and back */
const bendOf = (dist, L1, L2) => 180 - Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + L2 * L2 - dist * dist) / (2 * L1 * L2)))) / DG;
const reachOf = (bend, L1, L2) => Math.sqrt(Math.max(0, L1 * L1 + L2 * L2 + 2 * L1 * L2 * Math.cos(bend * DG)));
const unwrap = (v, prev) => prev === undefined ? v : v + 360 * Math.round((prev - v) / 360);
const r0 = v => Math.round(v);
// A twist is measured round the limb from the way its middle joint naturally bends. That direction is known for one
// limb direction (REST: an arm hanging forward, out and down, its elbow bending back; a leg down, its knee forward)
// and carried to the limb's actual direction by the shortest turn, so it moves smoothly with the limb everywhere
// except straight opposite REST, where no arm or leg reaches (an arm behind the head across the back; a leg up behind).
// (An earlier reference blended two fixed directions; where they faced apart it flipped, and in-betweens put the elbow
// on the wrong side.) Both sides compute it from the stored direction, so they always agree.
const REST = { arm: s => [.5, s * .5, -.7], leg: s => [.3, 0, -1] }, BEND = { arm: s => [-1, s * .5, -.3], leg: s => [1, s * .1, 0] };
const across = (h, d) => RV.norm(RV.sub(h, RV.mul(d, RV.dot(h, d))));
const hintFor = (limb, s, M, dLocal) => {
  const d = RV.norm(dLocal), r = RV.norm(REST[limb](s)), n0 = across(RV.norm(BEND[limb](s)), r), ax = RV.cross(r, d), sn = RV.len(ax), cs = RV.dot(r, d);
  let n = n0;
  if (sn > 1e-9) { const k = RV.mul(ax, 1 / sn), a = Math.atan2(sn, cs), c = Math.cos(a), si = Math.sin(a);   // turn n0 by a round k (Rodrigues)
    n = RV.add(RV.add(RV.mul(n0, c), RV.mul(RV.cross(k, n0), si)), RV.mul(k, RV.dot(k, n0) * (1 - c))); }
  return wld(M, across(n, d));
};
/** the signed angle (degrees) round axis d from hint h to the bend direction b */
const poleOf = (d, h, b) => { const hn = RV.norm(RV.sub(h, RV.mul(d, RV.dot(h, d)))), bn = RV.norm(RV.sub(b, RV.mul(d, RV.dot(b, d)))); return Math.atan2(RV.dot(RV.cross(hn, bn), d), RV.dot(hn, bn)) / DG; };
const poleHint = (d, h, deg) => { const hn = RV.norm(RV.sub(h, RV.mul(d, RV.dot(h, d)))), a = deg * DG; return RV.add(RV.mul(hn, Math.cos(a)), RV.mul(RV.cross(d, hn), Math.sin(a))); };
const SG = { L: -1, R: 1 };
const pt = (X, n) => { const i = IDX[n] * 3; return [X[i], X[i + 1], X[i + 2]]; };

/* ---- captured clips (the importer's input): { name, n, dur, loop, fps, data: n x 36 points x f r z (mm), move? } ---- */
function capSample(c, t, out = new Float32Array(P * 3)) {
  const n = c.n, u = Math.max(0, t) * c.fps, f = c.loop ? u % Math.max(1, n - 1) : Math.min(u, n - 1), i0 = Math.floor(f), k = f - i0, a = i0 * P * 3, b = Math.min(n - 1, i0 + 1) * P * 3, D = c.data;
  for (let i = 0; i < P * 3; i++) out[i] = D[a + i] + (D[b + i] - D[a + i]) * k;
  return out;
}
// the finger helpers only aim a blade: errors leave them out
const SHOWN = POINTS.map((p, i) => /^(index|pinky)/.test(p) ? -1 : i * 3).filter(i => i >= 0);
/** the largest distance between matching body points of two poses (mm) */
function error(A, B) { let w = 0; for (const i of SHOWN) w = Math.max(w, (A[i] - B[i]) ** 2 + (A[i + 1] - B[i + 1]) ** 2 + (A[i + 2] - B[i + 2]) ** 2); return Math.sqrt(w); }
/** the average distance between matching body points (mm) */
function meanError(A, B) { let s = 0; for (const i of SHOWN) s += Math.hypot(A[i] - B[i], A[i + 1] - B[i + 1], A[i + 2] - B[i + 2]); return s / SHOWN.length; }
/** key frames (Ramer-Douglas-Peucker over whole poses): in-betweening the rest stays within tol mm of the capture */
function reduce(c, tol) {
  const D = c.data, n = c.n, keep = [0, n - 1], tmp = new Float32Array(P * 3);
  const off = (a, b, i) => { const t = (i - a) / (b - a); for (let j = 0; j < P * 3; j++) tmp[j] = D[a * P * 3 + j] + (D[b * P * 3 + j] - D[a * P * 3 + j]) * t; return error(tmp, D.subarray(i * P * 3, (i + 1) * P * 3)); };
  const go = (a, b) => { if (b - a < 2) return; let wi = -1, we = 0; for (let i = a + 1; i < b; i++) { const e = off(a, b, i); if (e > we) { we = e; wi = i; } } if (we > tol) { keep.push(wi); go(a, wi); go(wi, b); } };
  if (n > 1) go(0, n - 1);
  return [...new Set(keep)].sort((x, y) => x - y);
}

/* ---- a body's rest measurements (mm), from its own captured clips ---- */
const rnd = (v, k = 10) => Array.isArray(v) ? v.map(x => rnd(x, k)) : Math.round(v * k) / k;
/**
 * measure(clips, tpose): proportions and rest offsets from the T-pose (or the first frame of the first clip), and how
 * much of the hips-to-chest turn each spine bone takes (and the neck between chest and head). That share differs per
 * library (how its animators posed the spine), so it is fitted from the clips themselves. The result is plain data.
 */
function measure(clips, tposeName = 'A_TPose') {
  const list = Object.values(clips), T = capSample(clips[tposeName] || list[0], 0), q = n => pt(T, n), d = (a, b) => RV.len(RV.sub(q(a), q(b)));
  const Pr = frameFR(RV.sub(q('hipR'), q('hipL')), RV.sub(q('pelvisF'), q('pelvis'))), Cr = frameUF(RV.sub(q('neck'), q('chest')), RV.sub(q('chestF'), q('chest')));
  const Hr = frameUF(RV.sub(q('headTop'), q('head')), RV.sub(q('faceF'), q('head')));
  const R = {
    H0: q('pelvis')[2], hipZ: (q('hipL')[2] + q('hipR')[2]) / 2, ankleZ: q('ankleL')[2], Pr, Cr, Hr,
    hip: { L: loc(Pr, RV.sub(q('hipL'), q('pelvis'))), R: loc(Pr, RV.sub(q('hipR'), q('pelvis'))) },
    // the spine's four bones at rest; in motion each turns part of the way from the hips' rotation to the chest's
    spine: [RV.sub(q('spine1'), q('pelvis')), RV.sub(q('spine2'), q('spine1')), RV.sub(q('chest'), q('spine2')), RV.sub(q('neck'), q('chest'))],
    neckSeg: RV.sub(q('head'), q('neck')),
    clav: { L: loc(Cr, RV.sub(q('clavL'), q('neck'))), R: loc(Cr, RV.sub(q('clavR'), q('neck'))) },
    cv: { L: loc(Cr, RV.sub(q('shL'), q('clavL'))), R: loc(Cr, RV.sub(q('shR'), q('clavR'))) },   // collarbone: pivot to shoulder
    topH: loc(Hr, RV.sub(q('headTop'), q('head'))), faceH: loc(Hr, RV.sub(q('faceF'), q('head'))),
    up: d('shL', 'elbowL'), fore: d('elbowL', 'wristL'), knuck: d('knuckL', 'wristL'), fist: d('fistL', 'wristL'),
    thigh: d('hipL', 'kneeL'), shin: d('kneeL', 'ankleL'), ab: d('ankleL', 'ballL'), bt: d('ballL', 'toeL'),
    abPitch: Math.asin((q('ankleL')[2] - q('ballL')[2]) / d('ankleL', 'ballL')) / DG, btPitch: Math.asin((q('ballL')[2] - q('toeL')[2]) / d('ballL', 'toeL')) / DG
  };
  const sub = RV.sub, fr = X => { const p = n => pt(X, n); return { P: frameFR(sub(p('hipR'), p('hipL')), sub(p('pelvisF'), p('pelvis'))), C: frameUF(sub(p('neck'), p('chest')), sub(p('chestF'), p('chest'))), H: frameUF(sub(p('headTop'), p('head')), sub(p('faceF'), p('head'))) }; };
  const frames = []; for (const c of list) for (let f = 0; f < c.n; f += Math.max(1, Math.floor(c.n / 6))) { const X = capSample(c, f / c.fps), F = fr(X); frames.push({ X, qP: qFromTo(Pr, F.P), qC: qFromTo(Cr, F.C), qH: qFromTo(Hr, F.H) }); }
  const fitW = (a, b, from, to, rest) => { let best = 0, be = Infinity; for (let w = 0; w <= 1.0001; w += .05) { let e = 0; for (const S of frames) e += RV.len(sub(qrot(qslerp(S[from], S[to], w), rest), sub(pt(S.X, b), pt(S.X, a)))); if (e < be) { be = e; best = w; } } return Math.round(best * 100) / 100; };
  R.spineW = [fitW('pelvis', 'spine1', 'qP', 'qC', R.spine[0]), fitW('spine1', 'spine2', 'qP', 'qC', R.spine[1]), fitW('spine2', 'chest', 'qP', 'qC', R.spine[2]), 1];
  R.neckW = fitW('neck', 'head', 'qC', 'qH', R.neckSeg);
  // plain, rounded data: it is saved in the set file
  for (const k of ['H0', 'hipZ', 'ankleZ', 'up', 'fore', 'knuck', 'fist', 'thigh', 'shin', 'ab', 'bt', 'abPitch', 'btPitch']) R[k] = rnd(R[k], 100);
  for (const k of ['Pr', 'Cr', 'Hr']) R[k] = rnd(R[k], 1e5);
  for (const k of ['spine', 'neckSeg', 'topH', 'faceH']) R[k] = rnd(R[k]);
  for (const k of ['hip', 'clav', 'cv']) R[k] = { L: rnd(R[k].L), R: rnd(R[k].R) };
  return R;
}

/* ---- encode and decode one key pose against a rest ---- */
const derived = R => { if (!R._d) Object.defineProperty(R, '_d', { value: { lower: R.fore + R.fist, arm: R.up + R.fore + R.fist, leg: R.thigh + R.shin } }); return R._d; };
/** the torso and head frames and the joints placed from them (shared by encode and decode, so rounding never drifts) */
function torso(R, k) {
  const p = RV.mul(k.hips, R.H0 / 100), RP = fromEuler(k.body), RC = compose(RP, fromEuler(k.chest)), RH = compose(RC, fromEuler(k.head));
  const qP = qFromTo(R.Pr, RP), qC = qFromTo(R.Cr, RC), qH = qFromTo(R.Hr, RH), sp = [p];
  R.spineW.forEach((w, i) => sp.push(RV.add(sp[i], qrot(qslerp(qP, qC, w), R.spine[i]))));
  const neck = sp[4], head = RV.add(neck, qrot(qslerp(qC, qH, R.neckW), R.neckSeg));
  const sh = s => { const sv = k['sh' + s] || [0, 0], v0 = R.cv[s], L = RV.len(v0), az = Math.atan2(v0[0], v0[1] * SG[s]) + sv[0] * DG, el = Math.asin(v0[2] / L) + sv[1] * DG;
    return RV.add(RV.add(neck, wld(RC, R.clav[s])), wld(RC, [L * Math.cos(el) * Math.sin(az), SG[s] * L * Math.cos(el) * Math.cos(az), L * Math.sin(el)])); };
  return { p, RP, RC, RH, spine1: sp[1], spine2: sp[2], chest: sp[3], neck, head, sh, hip: s => RV.add(p, wld(RP, R.hip[s])) };
}
const limbEnd = (root, M, v, s, len) => RV.add(root, wld(M, [v[0] * len, v[1] * SG[s] * len, v[2] * len]));
/** one key pose from captured body points (prev: the key before, so angles continue without jumps) */
function encodePose(R, X, prev) {
  const D = derived(R), p = n => pt(X, n), k = {}, pr = prev || {}, uw = (a, b) => a.map((v, i) => r0(unwrap(v, b && b[i])));
  // a turn, lean and tilt has a second reading (turn + 180, 180 - lean, tilt + 180): take whichever continues from the
  // key before, so a body leaning past horizontal (a flip, a fall) keeps leaning instead of jumping round
  const ue = (e, b) => { const a1 = uw(e, b); if (!b) return a1; const a2 = uw([e[0] + 180, 180 - e[1], e[2] + 180], b), d = a => a.reduce((t, v, i) => t + Math.abs(v - b[i]), 0); return d(a2) < d(a1) ? a2 : a1; };
  k.hips = p('pelvis').map(v => r0(v / R.H0 * 100));
  const RPx = frameFR(RV.sub(p('hipR'), p('hipL')), RV.sub(p('pelvisF'), p('pelvis')));
  const RCx = frameUF(RV.sub(p('neck'), p('chest')), RV.sub(p('chestF'), p('chest')));
  const RHx = frameUF(RV.sub(p('headTop'), p('head')), RV.sub(p('faceF'), p('head')));
  k.body = ue(euler(RPx), pr.body);
  k.chest = ue(euler(rel(fromEuler(k.body), RCx)), pr.chest);
  const RC = compose(fromEuler(k.body), fromEuler(k.chest));
  k.head = ue(euler(rel(RC, RHx)), pr.head);
  for (const s of ['L', 'R']) {
    const v = loc(RC, RV.sub(p('sh' + s), p('clav' + s))), v0 = R.cv[s], az = a => Math.atan2(a[0], a[1] * SG[s]) / DG, el = a => Math.asin(Math.max(-1, Math.min(1, a[2] / RV.len(a)))) / DG;
    k['sh' + s] = [r0(az(v) - az(v0)), r0(el(v) - el(v0))];
  }
  const tq = torso(R, k);
  for (const s of ['L', 'R']) {
    for (const [limb, root, M, end, mid, L1, L2] of [['arm', tq.sh(s), tq.RC, 'fist', 'elbow', R.up, D.lower], ['leg', tq.hip(s), tq.RP, 'ankle', 'knee', R.thigh, R.shin]]) {
      let v = loc(M, RV.sub(p(end + s), root));
      // a fist curled in past the shoulder (a bent wrist, mid roll) is closer than a straight hand can fold: point the
      // fully bent limb away from the elbow instead, so the elbow, the bigger shape, stays where it was
      if (RV.len(v) < Math.abs(L1 - L2) + 10) v = RV.mul(RV.norm(loc(M, RV.sub(p(mid + s), root))), -Math.abs(L1 - L2));
      const dir = RV.norm([v[0], v[1] * SG[s], v[2]]).map(x => r0(x * 100));
      const bend = r0(bendOf(RV.len(v), L1, L2)), target = limbEnd(root, M, RV.norm(dir), s, reachOf(bend, L1, L2)), dd = RV.norm(RV.sub(target, root));
      const tw = poleOf(dd, hintFor(limb, SG[s], M, [dir[0], dir[1] * SG[s], dir[2]]), RV.sub(p(mid + s), root)), prevT = pr[limb + s] && pr[limb + s][4];
      k[limb + s] = [...dir, bend, r0(unwrap(tw, prevT))];
    }
    const fd = loc(tq.RP, RV.norm(RV.sub(p('ball' + s), p('ankle' + s)))), td = loc(tq.RP, RV.norm(RV.sub(p('toe' + s), p('ball' + s))));
    const pf = pr['foot' + s], down = Math.asin(Math.max(-1, Math.min(1, -fd[2]))) / DG;
    k['foot' + s] = [r0(down - R.abPitch), r0(unwrap(Math.atan2(fd[1] * SG[s], fd[0]) / DG, pf && pf[1])), r0(down - Math.asin(Math.max(-1, Math.min(1, -td[2]))) / DG - (R.abPitch - R.btPitch))];
  }
  return k;
}
/** every body point rebuilt from one key pose, on the rest body's proportions */
function decodePose(R, k, out) {
  const D = derived(R), tq = torso(R, k), set = (n, v) => { const i = IDX[n] * 3; out[i] = v[0]; out[i + 1] = v[1]; out[i + 2] = v[2]; };
  const { p, RP, RC, RH, neck, head } = tq;
  set('pelvis', p); set('pelvisF', RV.add(p, RV.mul(RP[0], 120)));
  set('spine1', tq.spine1); set('spine2', tq.spine2);
  set('chest', tq.chest); set('chestF', RV.add(tq.chest, RV.mul(RC[0], 120)));
  set('neck', neck); set('head', head); set('headTop', RV.add(head, wld(RH, R.topH))); set('faceF', RV.add(head, wld(RH, R.faceH)));
  const blade = k.blade ? RV.norm(wld(RC, k.blade)) : null;
  for (const s of ['L', 'R']) {
    const sh = tq.sh(s), a = k['arm' + s], aN = RV.norm(a), fT = limbEnd(sh, RC, aN, s, reachOf(a[3] || 0, R.up, D.lower)), ad = RV.norm(RV.sub(fT, sh));
    const [el, fist] = ik3(sh, fT, R.up, D.lower, poleHint(ad, hintFor('arm', SG[s], RC, [aN[0], aN[1] * SG[s], aN[2]]), a[4] || 0));
    const fd = RV.norm(RV.sub(fist, el)), wr = RV.add(el, RV.mul(fd, R.fore));
    set('clav' + s, RV.add(neck, wld(RC, R.clav[s]))); set('sh' + s, sh); set('elbow' + s, el); set('wrist' + s, wr);
    set('knuck' + s, RV.add(wr, RV.mul(fd, R.knuck))); set('fist' + s, fist);
    const acr = s === 'R' && blade ? blade : RC[1];
    set('index' + s, RV.add(fist, RV.mul(acr, 20))); set('pinky' + s, RV.add(fist, RV.mul(acr, -20)));
    const hip = tq.hip(s), l = k['leg' + s], ln = RV.norm(l), aT = limbEnd(hip, RP, ln, s, reachOf(l[3] || 0, R.thigh, R.shin)), ld = RV.norm(RV.sub(aT, hip));
    const [kn, an] = ik3(hip, aT, R.thigh, R.shin, poleHint(ld, hintFor('leg', SG[s], RP, [ln[0], ln[1] * SG[s], ln[2]]), l[4] || 0));
    set('hip' + s, hip); set('knee' + s, kn); set('ankle' + s, an);
    const ft = k['foot' + s] || [0, 0, 0], pa = (ft[0] + R.abPitch) * DG, pb = (ft[0] + R.btPitch - (ft[2] || 0)) * DG, yw = ft[1] * DG;
    const dir = q => wld(RP, [Math.cos(q) * Math.cos(yw), SG[s] * Math.cos(q) * Math.sin(yw), -Math.sin(q)]);
    const ball = RV.add(an, RV.mul(dir(pa), R.ab)); set('ball' + s, ball); set('toe' + s, RV.add(ball, RV.mul(dir(pb), R.bt)));
  }
  return out;
}

/* ---- clips ---- */
const FIELDS = ['hips', 'body', 'chest', 'head', 'shL', 'shR', 'armL', 'armR', 'legL', 'legR', 'footL', 'footR', 'blade', 'root'];
const REQUIRED = ['hips', 'body', 'chest', 'head', 'armL', 'armR', 'legL', 'legR'];
/** the key pose at time t: every number in-betweened linearly from the keys either side (loops wrap) */
function keyAt(clip, t) {
  const K = clip.keys, dur = clip.dur || K[K.length - 1].t, tt = clip.loop && dur > 0 ? ((t % dur) + dur) % dur : Math.min(Math.max(0, t), dur);
  let i = 0; while (i < K.length - 2 && K[i + 1].t <= tt) i++;
  const a = K[i], b = K[Math.min(i + 1, K.length - 1)], u = b.t > a.t ? Math.min(1, Math.max(0, (tt - a.t) / (b.t - a.t))) : 0, k = {};
  for (const f of FIELDS) if (a[f]) k[f] = a[f].map((v, j) => v + (((b[f] || a[f])[j]) - v) * u);
  return k;
}
/** every body point at time t (mm, rig frame) on the proportions of rest R */
const pose = (R, clip, t, out = new Float32Array(P * 3)) => decodePose(R, keyAt(clip, t), out);
/** how far a travelling clip has carried the body at time t: [forward, right] in mm, or null */
const moveAt = (R, clip, t) => { if (!clip.keys[0].root) return null; const k = keyAt(clip, t); return [k.root[0] * R.H0 / 100, k.root[1] * R.H0 / 100]; };
/** a readable clip from a captured one, keeping frames kf; extra: { tags, desc, blade } */
function encode(R, cap, kf, extra = {}) {
  const keys = [], X = new Float32Array(P * 3); let prev = null;
  for (const f of kf) {
    capSample(cap, f / cap.fps, X); const k = Object.assign({ t: Math.round(f / cap.fps * 1000) / 1000 }, encodePose(R, X, prev));   // (to the millisecond: a key lands on its frame)
    if (extra.blade) k.blade = loc(compose(fromEuler(k.body), fromEuler(k.chest)), RV.norm(RV.sub(pt(X, 'indexR'), pt(X, 'pinkyR')))).map(x => r0(x * 100));
    if (cap.move) k.root = [r0(cap.move[f * 2] / R.H0 * 100), r0(cap.move[f * 2 + 1] / R.H0 * 100)];
    keys.push(k); prev = k;
  }
  return Object.assign({ clip: cap.name, dur: Math.round(cap.dur * 1000) / 1000, loop: cap.loop }, extra.tags ? { tags: extra.tags } : {}, extra.desc ? { desc: extra.desc } : {}, { keys });
}
/**
 * fit(R, cap, tol): a readable clip within tol mm of the capture. It starts from the position key frames and adds the
 * frame the readable in-betweening misses most, until the rest is within tol of what the format can capture at all
 * (a frame encoded as its own key): keys past the format's own limits are not worth their tokens.
 * Returns { clip, max, mean }: the worst and the average body-point error over the clip (mm).
 */
function fit(R, cap, tol, extra = {}) {
  const kf = reduce(cap, tol), X = new Float32Array(P * 3), Y = new Float32Array(P * 3), t = f => f / cap.fps;
  const floor = Array.from({ length: cap.n }, (_, f) => error(capSample(cap, t(f), X), pose(R, encode(R, cap, [f], extra), t(f), Y)));
  for (let guard = 0; ; guard++) {
    const o = encode(R, cap, kf, extra); let worst = 0, wf = -1, max = 0, sum = 0;
    for (let f = 0; f < cap.n; f++) { capSample(cap, t(f), X); pose(R, o, t(f), Y); const e = error(X, Y), over = e - floor[f]; max = Math.max(max, e); sum += meanError(X, Y); if (over > worst) { worst = over; wf = f; } }
    if (worst <= tol || kf.includes(wf) || guard > cap.n) return { clip: o, max, mean: sum / cap.n };
    kf.push(wf); kf.sort((a, b) => a - b);
  }
}
/** the text a model reads: a clip's header, then each key pose as three short lines (torso, arms, legs) */
function text(o) {
  const head = Object.entries(o).filter(([k]) => k !== 'keys').map(([k, v]) => JSON.stringify(k) + ': ' + JSON.stringify(v)).join(', ');
  const grp = [['hips', 'body', 'chest', 'head', 'root'], ['shL', 'shR', 'armL', 'armR', 'blade'], ['legL', 'legR', 'footL', 'footR']];
  const line = k => '  {"t":' + k.t + ',\n' + grp.map(g => '   ' + g.filter(f => k[f] !== undefined).map(f => '"' + f + '":' + JSON.stringify(k[f])).join(', ')).join(',\n') + '}';
  return '{' + head + ', "keys": [\n' + o.keys.map(line).join(',\n') + '\n]}';
}
/** text -> clip (// comments allowed); throws an error that names the key and the field when one is missing */
function parse(txt) {
  const o = typeof txt === 'string' ? JSON.parse(txt.replace(/^\s*\/\/.*$/gm, '')) : txt;
  if (!o || !Array.isArray(o.keys) || !o.keys.length) throw new Error('a clip needs "keys": [ ... ] with at least one key pose');
  o.keys.forEach((k, i) => {
    if (typeof k.t !== 'number') throw new Error('key ' + (i + 1) + ' has no time "t"');
    for (const f of REQUIRED) if (!Array.isArray(k[f])) throw new Error('key ' + (i + 1) + ' (t ' + k.t + ') has no "' + f + '"');
    for (const f of FIELDS) if (k[f] && !k[f].every(Number.isFinite)) throw new Error('key ' + (i + 1) + ' (t ' + k.t + '): "' + f + '" must hold numbers');
  });
  o.keys.sort((a, b) => a.t - b.t); o.dur = o.dur || o.keys[o.keys.length - 1].t;
  return o;
}
/** the same clip on the other side: L and R swap, turns and tilts change sign */
function mirror(o) {
  const neg = v => v && [-v[0], v[1], -v[2]], keys = o.keys.map(k => {
    const m = { t: k.t, hips: [k.hips[0], -k.hips[1], k.hips[2]], body: neg(k.body), chest: neg(k.chest), head: neg(k.head) };
    if (k.root) m.root = [k.root[0], -k.root[1]];
    for (const [a, b] of [['L', 'R'], ['R', 'L']]) {
      for (const limb of ['arm', 'leg']) { const v = k[limb + b]; m[limb + a] = [v[0], v[1], v[2], v[3] || 0, -(v[4] || 0)]; }
      for (const f of ['foot', 'sh']) if (k[f + b]) m[f + a] = k[f + b].slice();
    }
    if (k.blade) m.blade = [k.blade[0], -k.blade[1], k.blade[2]];
    return m;
  });
  return Object.assign({}, o, { clip: (o.clip || 'clip') + '_Mirror', keys });
}

return { POINTS, IDX, P, LEGEND, measure, fit, encode, pose, moveAt, keyAt, text, parse, mirror, error, meanError, capSample, reduce };
})();
