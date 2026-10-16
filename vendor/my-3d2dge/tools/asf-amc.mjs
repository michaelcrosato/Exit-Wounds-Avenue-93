// The Acclaim skeleton and motion formats the CMU motion capture database uses (.asf: a subject's bones; .amc: a
// take, the bones' angles frame by frame). readCmu turns picked stretches of takes into the same body points the
// importer measures from glTF rigs (36 points: pelvis, spine, head and the way it faces, collarbones, arms, fists, legs,
// feet), in the rig's local frame (f forward, r right, z up, centred on the root on the ground), so tools/anim-import.mjs
// fits them into readable key poses like any other library.
//
// Forward kinematics as the format defines it: each bone has a rest direction and length in world space and an axis
// frame C (Euler angles, X then Y then Z about fixed axes); a frame's angles R turn it as M = M_parent · C · R · C⁻¹,
// and its end sits at the parent's end + length · M · direction. Lengths are in 1/0.45 inches (":units length 0.45").
// CMU's hands have one finger bone and a thumb, so the knuckle line (index, pinky) is set across the hand, toward the
// thumb, and the fist point halfway down the fingers.
import { readFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { MR } from './mocap-lib.mjs';

const DG = Math.PI / 180, MM = 1000;
/* ---- 3x3 matrices, row major ---- */
const mm = (a, b) => { const o = new Array(9); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]; return o; };
const mv = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const tr = m => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
/** rotation by x, then y, then z degrees about the fixed axes: Rz · Ry · Rx */
const euler = (x, y, z) => {
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(x * DG), Math.sin(x * DG), Math.cos(y * DG), Math.sin(y * DG), Math.cos(z * DG), Math.sin(z * DG)];
  return mm(mm([cz, -sz, 0, sz, cz, 0, 0, 0, 1], [cy, 0, sy, 0, 1, 0, -sy, 0, cy]), [1, 0, 0, 0, cx, -sx, 0, sx, cx]);
};
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const norm = a => { const l = Math.hypot(...a) || 1; return mul(a, 1 / l); }, dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** a skeleton: { scale (metres per unit), bones: { name: { dir, len, C, Ci, dof } }, order: names parent first, parent: { name: parent } } */
export function readAsf(text) {
  const lines = text.split(/\r?\n/), bones = {}, parent = {}, order = [];
  let scale = 0.0254 / 0.45, section = '', cur = null, rootAxis = [0, 0, 0];
  for (const raw of lines) {
    const line = raw.replace(/#.*/, '').trim(); if (!line) continue;
    if (line.startsWith(':')) { const [k, ...v] = line.split(/\s+/); section = k; if (k === ':units') continue; continue; }
    const w = line.split(/\s+/);
    if (section === ':units' && w[0] === 'length') scale = 0.0254 / +w[1];
    else if (section === ':root' && w[0] === 'orientation') rootAxis = w.slice(1, 4).map(Number);
    else if (section === ':bonedata') {
      if (w[0] === 'begin') cur = { dof: [] };
      else if (w[0] === 'end') { const C = euler(...cur.axis); bones[cur.name] = { dir: norm(cur.dir), len: cur.len, C, Ci: tr(C), dof: cur.dof }; cur = null; }
      else if (cur && w[0] === 'name') cur.name = w[1];
      else if (cur && w[0] === 'direction') cur.dir = w.slice(1, 4).map(Number);
      else if (cur && w[0] === 'length') cur.len = +w[1];
      else if (cur && w[0] === 'axis') cur.axis = w.slice(1, 4).map(Number);
      else if (cur && w[0] === 'dof') cur.dof = w.slice(1).map(d => d.toLowerCase());
    } else if (section === ':hierarchy' && w[0] !== 'begin' && w[0] !== 'end') for (const c of w.slice(1)) parent[c] = w[0];
  }
  const visit = n => { if (order.includes(n)) return; if (parent[n] && parent[n] !== 'root') visit(parent[n]); order.push(n); };
  Object.keys(bones).forEach(visit);
  const rC = euler(...rootAxis);
  return { scale, bones, parent, order, root: { C: rC, Ci: tr(rC) } };
}

/** a take: one { bone: [values] } per frame */
export function readAmc(text) {
  const frames = []; let cur = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim(); if (!line || line[0] === '#' || line[0] === ':') continue;
    if (/^\d+$/.test(line)) { cur = {}; frames.push(cur); continue; }
    if (cur) { const w = line.split(/\s+/); cur[w[0]] = w.slice(1).map(Number); }
  }
  return frames;
}

/** every bone's world rotation and end point (metres) for one frame (null: the rest pose, root at the origin) */
export function pose(sk, frame) {
  const M = {}, end = {}, r = frame && frame.root || [0, 0, 0, 0, 0, 0];
  M.root = mm(mm(sk.root.C, euler(r[3], r[4], r[5])), sk.root.Ci); end.root = mul(r.slice(0, 3), sk.scale);
  for (const n of sk.order) {
    const b = sk.bones[n], v = frame && frame[n] || [], a = [0, 0, 0];
    b.dof.forEach((d, i) => { if (v[i] !== undefined) a[{ rx: 0, ry: 1, rz: 2 }[d]] = v[i]; });
    M[n] = mm(mm(mm(M[sk.parent[n] || 'root'], b.C), euler(...a)), b.Ci);
    end[n] = add(end[sk.parent[n] || 'root'], mul(mv(M[n], b.dir), b.len * sk.scale));
  }
  return { M, end, start: n => end[sk.parent[n] || 'root'] };
}

/**
 * readCmu(asfFile, picks, fps): one subject's picked moments as importer clips, plus '_rest' (the skeleton's T-pose,
 * stood on the floor its takes stand on). picks: [{ name, take: '02_01', from, to, fps, loop }] (seconds; to omitted =
 * the take's end); the .amc files sit beside the .asf. Each clip starts at the origin, facing forward.
 * loop: the stretch is searched for its best cycle (a stride, a hop: the span whose end matches its start in pose and
 * in speed), cut there, and played in place: it faces the way it travels, and the root follows the straight line
 * through the cycle, so the hips keep their sway.
 */
export function readCmu(asfFile, picks, FPS = 30) {
  const sk = readAsf(readFileSync(asfFile, 'latin1')), B = sk.bones, dir = dirname(asfFile), rest = pose(sk, null);
  const need = ['lowerback', 'upperback', 'thorax', 'upperneck', 'head', ...['l', 'r'].flatMap(s => ['hipjoint', 'femur', 'tibia', 'foot', 'toes', 'clavicle', 'humerus', 'radius', 'hand', 'fingers', 'thumb'].map(b => s + b))];
  const missing = need.filter(n => !B[n]); if (missing.length) throw new Error(basename(asfFile) + ' lacks bones: ' + missing.join(', '));
  // the rig's frame from the rest pose: up is +y; forward from the heel toward the toes; right toward the right hip
  const fwd0 = norm([rest.end.ltoes[0] - rest.end.ltibia[0], 0, rest.end.ltoes[2] - rest.end.ltibia[2]]);
  let RIGHT = [fwd0[2], 0, -fwd0[0]]; if (dot(sub(rest.end.rhipjoint, rest.end.lhipjoint), RIGHT) < 0) RIGHT = mul(RIGHT, -1);
  // points fixed on a bone: [bone, along (0 = its start, 1 = its end), offset at rest (metres, world)]
  const on = (b, t, off = [0, 0, 0]) => [b, t, off], F12 = mul(fwd0, .12);
  const across = s => { const h = B[s + 'hand'].dir, th = B[s + 'thumb'].dir, v = sub(th, mul(h, dot(th, h))); return norm(v); };   // toward the thumb, across the hand
  const P = {
    pelvis: on('root', 1), spine1: on('lowerback', 1), spine2: on('upperback', 1), chest: on('thorax', .5), neck: on('thorax', 1), head: on('upperneck', 1),
    headTop: on('head', 1), faceF: on('head', 0, F12), chestF: on('thorax', .5, F12), pelvisF: on('root', 1, F12)
  };
  for (const [S, s] of [['L', 'l'], ['R', 'r']]) Object.assign(P, {
    ['clav' + S]: on(s + 'clavicle', .15), ['sh' + S]: on(s + 'clavicle', 1), ['elbow' + S]: on(s + 'humerus', 1), ['wrist' + S]: on(s + 'radius', 1),
    ['knuck' + S]: on(s + 'hand', 1), ['index' + S]: on(s + 'hand', 1, mul(across(s), .035)), ['pinky' + S]: on(s + 'hand', 1, mul(across(s), -.035)), ['fist' + S]: on(s + 'fingers', .5),
    ['hip' + S]: on(s + 'hipjoint', 1), ['knee' + S]: on(s + 'femur', 1), ['ankle' + S]: on(s + 'tibia', 1), ['ball' + S]: on(s + 'foot', 1), ['toe' + S]: on(s + 'toes', 1)
  });
  const at = (ps, [b, t, off]) => b === 'root' ? add(ps.end.root, mv(ps.M.root, off)) : add(add(ps.start(b), mul(mv(ps.M[b], B[b].dir), B[b].len * sk.scale * t)), mv(ps.M[b], off));
  const pts = ps => MR.POINTS.map(n => at(ps, P[n]));
  const local = (p, o) => { const d = [p[0] - o[0], p[1], p[2] - o[2]]; return [d[0] * fwd0[0] + d[2] * fwd0[2], d[0] * RIGHT[0] + d[2] * RIGHT[2], d[1]]; };
  const I = MR.POINTS.indexOf('pelvis'), J = MR.POINTS.indexOf('pelvisF'), heading = W => { const h = sub(W[J], W[I]); return Math.atan2(dot([h[0], 0, h[2]], RIGHT), dot([h[0], 0, h[2]], fwd0)); };
  /** the best cycle in [from, to] (seconds): frames i < j, half a second (or min) to 2.5 s apart, whose poses (seen
   *  from the hips, turned to face the same way) and speeds match best, among the spans that keep moving (a pause
   *  matches itself perfectly: a span must move at least half as fast as the stretch's typical frame). min: a gait
   *  whose feet meet between steps (a robot's, a limp) matches itself after one step; a full stride is longer */
  const cycle = (frames, src, from, to, min = .5) => {
    const a = Math.round(from * src), b = Math.min(frames.length - 1, Math.round(to * src)), F = [];
    for (let k = a; k <= b; k++) {
      const W = pts(pose(sk, frames[k])), g = -heading(W), c = Math.cos(g), s = Math.sin(g), o = W[I], v = new Float64Array(MR.P * 3);
      W.forEach((p, i) => { const d = [p[0] - o[0], p[2] - o[2]], f = d[0] * fwd0[0] + d[1] * fwd0[2], r = d[0] * RIGHT[0] + d[1] * RIGHT[2]; v[i * 3] = f * c - r * s; v[i * 3 + 1] = f * s + r * c; v[i * 3 + 2] = p[1]; });
      F.push(v);
    }
    const rms = (x, y, z, w) => { let e = 0; for (let k = 0; k < x.length; k++) { const d = w ? (x[k] - y[k]) - (z[k] - w[k]) : x[k] - y[k]; e += d * d; } return Math.sqrt(e / x.length); };
    // how far the pose travels, frame to frame (summed, so any span's motion is a subtraction)
    const step = F.map((v, k) => k ? rms(v, F[k - 1]) : 0), sum = [0]; step.forEach((d, k) => sum.push(sum[k] + d));
    const typical = step.slice(1).sort((x, y) => x - y)[Math.floor((step.length - 1) / 2)] || 0;
    let best = null;
    for (let i = 1; i < F.length - 1; i++) for (let j = i + Math.round(src * min); j < Math.min(F.length - 1, i + 2.5 * src); j++) {
      if ((sum[j + 1] - sum[i + 1]) / (j - i) < typical / 2) continue;   // too still to be the motion's cycle
      const cost = rms(F[i], F[j]) + .1 * rms(F[i + 1], F[i - 1], F[j + 1], F[j - 1]) * src / 2 + .002 * (j - i) / src;
      if (!best || cost < best.cost) best = { cost, i, j };
    }
    if (!best) throw new Error('no cycle of ' + min + ' s or more between ' + from + ' s and ' + to + ' s');
    return [(a + best.i) / src, (a + best.j) / src, best.cost];
  };
  const takes = {}, clips = {}, lows = [], low = W => Math.min(...['toeL', 'toeR', 'ballL', 'ballR'].map(k => W[MR.POINTS.indexOf(k)][1]));
  for (const pk of picks) {
    if (!takes[pk.take]) {   // a new take: its lowest foot point, frame by frame (where the floor is, below)
      takes[pk.take] = readAmc(readFileSync(join(dir, pk.take + '.amc'), 'latin1'));
      for (let k = 0; k < takes[pk.take].length; k += Math.max(1, Math.round((pk.fps || 120) / 30))) lows.push(low(pts(pose(sk, takes[pk.take][k]))));
    }
    const frames = takes[pk.take];
    const src = pk.fps || 120; let from = pk.from || 0, to = Math.min(pk.to === undefined ? Infinity : pk.to, (frames.length - 1) / src);
    if (!(to > from)) throw new Error(pk.name + ': ' + pk.take + ' has no frames from ' + from + ' s to ' + pk.to + ' s (it lasts ' + ((frames.length - 1) / src).toFixed(2) + ' s)');
    let seam = 0; if (pk.loop) [from, to, seam] = cycle(frames, src, from, to, pk.minCycle);
    // a loop's frames are spaced to end exactly on its cycle (a stretch of a few milliseconds at most)
    const n = Math.max(1, Math.round((to - from) * FPS) + 1), step = pk.loop && n > 1 ? (to - from) / (n - 1) : 1 / FPS, world = [];
    for (let f = 0; f < n; f++) { const ps = pose(sk, frames[Math.min(frames.length - 1, Math.round((from + f * step) * src))]); world.push(pts(ps)); }
    // face forward and start at the origin: turn the take about the vertical so the hips face the rig's forward at its
    // first frame (a loop: the way it travels, when it travels), and slide it so the root starts at 0
    const travel = sub(world[n - 1][I], world[0][I]), far = Math.hypot(travel[0], travel[2]) > .2;
    const ang = pk.loop && far ? Math.atan2(dot([travel[0], 0, travel[2]], RIGHT), dot([travel[0], 0, travel[2]], fwd0)) : heading(world[0]);
    const c = Math.cos(ang), s = Math.sin(ang), o = world[0][I];
    const spin = p => { const d = [p[0] - o[0], p[2] - o[2]], f = d[0] * fwd0[0] + d[1] * fwd0[2], r = d[0] * RIGHT[0] + d[1] * RIGHT[2], f2 = f * c + r * s, r2 = -f * s + r * c; return [fwd0[0] * f2 + RIGHT[0] * r2, p[1], fwd0[2] * f2 + RIGHT[2] * r2]; };
    const data = new Float32Array(n * MR.P * 3), move = new Float32Array(n * 2), Wn = world[n - 1].map(spin); let moved = false;
    world.forEach((W, f) => {
      // the root: the hips (a loop: the straight line from its first frame's hips to its last's, so it plays in place)
      const Wr = W.map(spin), u = n > 1 ? f / (n - 1) : 0, root = pk.loop ? [Wn[I][0] * u, 0, Wn[I][2] * u] : Wr[I], rl = local(root, [0, 0, 0]);
      move[f * 2] = rl[0] * MM; move[f * 2 + 1] = rl[1] * MM; if (!pk.loop && Math.abs(rl[0]) + Math.abs(rl[1]) > .01) moved = true;
      Wr.forEach((p, i) => { const q = local(p, root); data[(f * MR.P + i) * 3] = q[0] * MM; data[(f * MR.P + i) * 3 + 1] = q[1] * MM; data[(f * MR.P + i) * 3 + 2] = q[2] * MM; });
    });
    // a loop closes exactly: what its last frame still differs from its first is spread over the cycle, a little a frame
    if (pk.loop && n > 2) { const L = (n - 1) * MR.P * 3; for (let f = 1; f < n; f++) for (let k = 0; k < MR.P * 3; k++) data[f * MR.P * 3 + k] -= (data[L + k] - data[k]) * f / (n - 1); }   // (the last frame is corrected last)
    clips[pk.name] = { name: pk.name, n, dur: (n - 1) / FPS, loop: !!pk.loop, fps: FPS, data, move: moved ? move : null, take: pk.take + ' ' + from.toFixed(2) + '-' + to.toFixed(2) };
    if (pk.loop) console.log(`${pk.name}: a ${(to - from).toFixed(2)} s cycle at ${from.toFixed(2)}-${to.toFixed(2)} s of ${pk.take} (its seam is off by ${Math.round(seam * MM)} mm)`);
  }
  // the rest pose, stood where the takes stand: its lowest toe at the floor, the height the lowest foot point keeps
  // most often over the subject's takes (a foot spends most of its time flat on the floor; the most common centimetre
  // among the lower half of the frames, so a landing's dip or a climb's rungs do not move it)
  const R = pts(rest), lowR = low(R);
  let floor = 0; if (lows.length) { const half = lows.sort((a, b) => a - b).slice(0, Math.ceil(lows.length / 2)), bins = new Map(); for (const v of half) { const b = Math.round(v * 100); bins.set(b, (bins.get(b) || 0) + 1); } floor = [...bins].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0] / 100; }
  const rd = new Float32Array(MR.P * 3), lift = floor - lowR;
  R.forEach((p, i) => { const q = local([p[0], p[1] + lift, p[2]], [R[MR.POINTS.indexOf('pelvis')][0], 0, R[MR.POINTS.indexOf('pelvis')][2]]); rd[i * 3] = q[0] * MM; rd[i * 3 + 1] = q[1] * MM; rd[i * 3 + 2] = q[2] * MM; });
  clips._rest = { name: '_rest', n: 1, dur: 0, loop: false, fps: FPS, data: rd, move: null };
  return { rig: 'cmu', clips, body: null };
}
