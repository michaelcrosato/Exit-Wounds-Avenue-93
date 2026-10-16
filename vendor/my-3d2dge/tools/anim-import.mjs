// Animation importer: turns skeletal animation libraries in glTF binary form (.glb: a humanoid rig, a mesh and its
// clips) into a my-3D2dge animation set: readable key poses (src/mocap/readable.js) that the engine's rigs play and
// that an AI model can read, pick from and edit.
//
// For every clip it samples the skeleton at a fixed rate, runs forward kinematics, and takes 36 body points (pelvis,
// spine, head and the way it faces, collarbones, arms, fists, legs, feet) in the rig's local frame: f forward, r right,
// z up, centred on the root on the ground. It measures the body from its own clips (proportions, how its spine bends),
// then fits each clip with as few key poses as keep it within --tol mm of the capture. It also measures the first
// library's mesh (limb radii, height, the joint-ring material), so a game can draw a look-alike of its mannequin.
//
// Usage:  node tools/anim-import.mjs a.glb [b.glb ...] [--sources UAL1,UAL2] [--name QUATERNIUS] [--out src/mocap/sets/quaternius.js]
//                [--catalog src/mocap/catalogs/quaternius.json] [--credit "..."] [--tol 30] [--fps 30] [--clips A,B] [--blade Sword]
//                [--rest A_TPose,,Rest Pose]   (each library's rest-pose clip; by default a T-pose or 'Rest Pose' clip, else the first clip)
//                [--title Mesh2Motion]          (the set's name as people read it; the lab's button)
//         node tools/anim-import.mjs a.glb --list          (print the clips, the bones and the rig it recognises; write nothing)
// Rigs: the Rigify "DEF-" deform bones (Quaternius' Universal Animation Library) and the Unreal mannequin's names
// (pelvis, spine_01, upperarm_l ...; Universal Animation Library 2, Mesh2Motion's humans) are recognised, in any case. For another rig, add it to RIGS.
// Clips are named once: a later library's clip with a name already taken (its own T-pose) is left out.
// --catalog: a JSON file written by hand. { clip: [tags, what the body does, orig?] }: its words go into each clip (the
//   tags 'loop' and 'once' set whether it loops, where the clip names do not say), and
//   orig names the clip this one was made from when it is a copy or an edit of another set's ("QUATERNIUS/Walk_Loop").
//   "$sources": { ID: { label, origin, license, url } } says where each library (--sources ID) came from; every
//   clip names its library in "src", so a set always says where each of its clips came from. "$skip": { clip: why }
//   leaves clips out, with the reason on record.
// --cmu: the CMU motion capture database (tools/cmu.mjs) instead of .glb files. The catalog's "$pick" names each clip's
//   take and the stretch of it: { "Cartwheel": ["49_06", 1.2, 3.4] } (seconds; no end = to the end of the take; the take
//   alone, ["49_06"] = the stretch where it moves, from the ledger src/mocap/catalogs/cmu-takes.tsv; a loop's fourth
//   number, the shortest cycle it may cut: ["139_19", 3, 8, 0.9] for a limp whose feet meet between steps). The
//   takes are downloaded to .cache/cmu; each subject is a library (CMU_49), described by the catalog's "$sources".CMU,
//   and each clip records its take in "take" ("49_06 1.20-3.40").
//   node tools/anim-import.mjs --cmu --catalog src/mocap/catalogs/cmu.json --name CMU --title CMU --out src/mocap/sets/cmu.js
import { readFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { MR, writeSet } from './mocap-lib.mjs';
import { readCmu } from './asf-amc.mjs';
import { cmuIndex, cmuGet, readLedger } from './cmu.mjs';

const args = process.argv.slice(2);
const FLAGS = ['--list', '--cmu'], files = args.filter((a, i) => !a.startsWith('--') && (!(args[i - 1] || '').startsWith('--') || FLAGS.includes(args[i - 1])));   // flags take no value
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const CMU = args.includes('--cmu');
if (!files.length && !CMU) { console.error('Usage: node tools/anim-import.mjs a.glb [b.glb ...] [--sources A,B] [--name SET] [--out file.js] [--catalog cat.json] [--credit "..."] [--tol 30] [--fps 30] [--clips A,B] [--blade Sword] [--rest ClipA,ClipB] [--title Name] [--list]'); process.exit(2); }
const OUT = resolve(opt('out', 'src/mocap/sets/quaternius.js')), FPS = +opt('fps', 30), NAME = opt('name', 'QUATERNIUS'), TOL = +opt('tol', 30);
const SOURCES = (opt('sources', '') || '').split(',').filter(Boolean), REST = (opt('rest', '') || '').split(','), ONLY = opt('clips', null) ? new Set(opt('clips').split(',')) : null;
const BLADE = new RegExp(opt('blade', 'Sword'));
const CREDIT = opt('credit', 'Universal Animation Library 1 and 2 by Quaternius (quaternius.com), CC0 1.0 (public domain).');
const CATALOG = opt('catalog', null) ? JSON.parse(readFileSync(resolve(opt('catalog')), 'utf8')) : {};
// where each library came from: the catalog's "$sources" { ID: { label, origin, license, url } }, written by hand
const ABOUT = CATALOG.$sources || {}; delete CATALOG.$sources;
// clips left out on purpose, each with the reason: the catalog's "$skip" { clip: why }
const SKIP = CATALOG.$skip || {}; delete CATALOG.$skip;
// CMU: which take and which stretch of it each clip is (the catalog's "$pick"), grouped by subject; the takes are fetched
const PICKS = {}, SUBJECT = {};
if (CMU) {
  const pick = CATALOG.$pick || {}; delete CATALOG.$pick;
  if (!Object.keys(pick).length) { console.error('--cmu needs the catalog\'s "$pick": { clip: [take, from, to] }'); process.exit(2); }
  // a pick that names only its take plays the stretch where the take moves, as the ledger measured it (tools/cmu.mjs survey)
  const index = await cmuIndex(), byId = new Map(index.map(t => [t.id, t])), ledger = readLedger();
  for (const [name, [take, from0, to0, minCycle]] of Object.entries(pick)) {
    const [f] = await cmuGet([take]), t = byId.get(take), row = ledger[take], act = row && /^[\d.]+-[\d.]+$/.test(row.active || '') ? row.active.split('-').map(Number) : null;
    if (!t && !row) console.warn(take + ' is not in the CMU index or the ledger');
    const [from, to] = from0 === undefined && act ? act : [from0, to0];
    if (!PICKS[f.asf]) { PICKS[f.asf] = []; files.push(f.asf); SUBJECT[f.asf] = t ? t.subject : +take.split('_')[0]; }
    PICKS[f.asf].push({ name, take, from, to, minCycle, fps: t ? t.fps : row ? +row.fps : 120, loop: ((CATALOG[name] || [''])[0] || '').split(' ').includes('loop') });   // tagged 'loop': cut to its best cycle
  }
  if (!SOURCES.length) files.forEach(f => SOURCES.push('CMU_' + String(SUBJECT[f]).padStart(2, '0')));
  // one record per subject, from the catalog's "$sources".CMU: its label and page name the subject
  if (ABOUT.CMU) for (const f of files) {
    const n = SUBJECT[f], who = (index.find(t => t.subject === n) || Object.values(ledger).find(r => +r.subject === n) || {}).about;
    ABOUT['CMU_' + String(n).padStart(2, '0')] = Object.assign({}, ABOUT.CMU, { label: ABOUT.CMU.label + ', subject ' + n + (who ? ' (' + who + ')' : ''), url: 'http://mocap.cs.cmu.edu/search.php?subjectnumber=' + n });
  }
}

/* ---- rigs: which bone gives each body point. [point, bone, where]: where 'tip' = the bone's far end, 'fwd' = 12 cm in front ---- */
const RIGS = {
  rigify: {
    test: 'DEF-hips', root: 'root',
    map: s => ({ clav: 'DEF-shoulder.' + s, sh: 'DEF-upper_arm.' + s, elbow: 'DEF-forearm.' + s, wrist: 'DEF-hand.' + s, index: 'DEF-f_index.01.' + s, knuck: 'DEF-f_middle.01.' + s,
      pinky: 'DEF-f_pinky.01.' + s, fist: 'DEF-f_middle.02.' + s, hip: 'DEF-thigh.' + s, knee: 'DEF-shin.' + s, ankle: 'DEF-foot.' + s, ball: 'DEF-toe.' + s, toe: ['DEF-toe.' + s, 'tip'] }),
    core: { pelvis: 'DEF-hips', spine1: 'DEF-spine.001', spine2: 'DEF-spine.002', chest: 'DEF-spine.003', neck: 'DEF-neck', head: 'DEF-head' },
    // segments whose thickness the mesh gives (for the look-alike): [from point, to point, bone whose vertices it owns]
    segs: s => [['clav' + s, 'sh' + s, 'DEF-shoulder.' + s], ['sh' + s, 'elbow' + s, 'DEF-upper_arm.' + s], ['elbow' + s, 'wrist' + s, 'DEF-forearm.' + s],
      ['wrist' + s, 'knuck' + s, 'DEF-hand.' + s], ['hip' + s, 'knee' + s, 'DEF-thigh.' + s], ['knee' + s, 'ankle' + s, 'DEF-shin.' + s], ['ankle' + s, 'ball' + s, 'DEF-foot.' + s], ['ball' + s, 'toe' + s, 'DEF-toe.' + s]],
    coreSegs: [['pelvis', 'spine1', 'DEF-hips'], ['spine1', 'spine2', 'DEF-spine.001'], ['spine2', 'chest', 'DEF-spine.002'], ['chest', 'neck', 'DEF-spine.003'], ['neck', 'head', 'DEF-neck'], ['head', 'headTop', 'DEF-head']]
  },
  unreal: {
    test: 'spine_01', root: 'root',
    map: s => { const x = s.toLowerCase(); return { clav: 'clavicle_' + x, sh: 'upperarm_' + x, elbow: 'lowerarm_' + x, wrist: 'hand_' + x, index: 'index_01_' + x, knuck: 'middle_01_' + x,
      pinky: 'pinky_01_' + x, fist: 'middle_02_' + x, hip: 'thigh_' + x, knee: 'calf_' + x, ankle: 'foot_' + x, ball: 'ball_' + x, toe: 'ball_leaf_' + x }; },
    core: { pelvis: 'pelvis', spine1: 'spine_01', spine2: 'spine_02', chest: 'spine_03', neck: 'neck_01', head: 'Head' },
    segs: () => [], coreSegs: []
  }
};
const bonesFor = rig => {
  const R = RIGS[rig], c = R.core, list = MR.POINTS.map(p => {
    if (c[p]) return [p, c[p]];
    if (p === 'headTop') return [p, c.head, 'tip'];
    if (p === 'faceF') return [p, c.head, 'fwd']; if (p === 'chestF') return [p, c.chest, 'fwd']; if (p === 'pelvisF') return [p, c.pelvis, 'fwd'];
    const s = p.slice(-1), b = R.map(s)[p.slice(0, -1)]; return Array.isArray(b) ? [p, ...b] : [p, b];
  });
  return list;
};

/* ---- column-major 4x4 matrices, quaternions [x, y, z, w] ---- */
const mat = (t = [0, 0, 0], q = [0, 0, 0, 1], s = [1, 1, 1]) => {
  const [x, y, z, w] = q, xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
  return [(1 - 2 * (yy + zz)) * s[0], 2 * (xy + wz) * s[0], 2 * (xz - wy) * s[0], 0, 2 * (xy - wz) * s[1], (1 - 2 * (xx + zz)) * s[1], 2 * (yz + wx) * s[1], 0,
    2 * (xz + wy) * s[2], 2 * (yz - wx) * s[2], (1 - 2 * (xx + yy)) * s[2], 0, t[0], t[1], t[2], 1];
};
const mul = (a, b) => { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; };
const xf = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
const slerp = (a, b, t) => {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3], s = 1; if (d < 0) { d = -d; s = -1; }
  if (d > .9995) { const o = a.map((v, i) => v + (b[i] * s - v) * t), l = Math.hypot(...o); return o.map(v => v / l); }
  const th = Math.acos(d), k0 = Math.sin((1 - t) * th) / Math.sin(th), k1 = Math.sin(t * th) / Math.sin(th) * s;
  return a.map((v, i) => v * k0 + b[i] * k1);
};
const pct = (arr, p) => { if (!arr.length) return 0; const s = arr.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const MM = 1000;   // metres -> millimetres

/** one library: its rig, its clips captured as body points, and (Rigify) the look of its mannequin */
function readLibrary(file) {
  if (/\.asf$/i.test(file)) return readCmu(resolve(file), PICKS[file] || [], FPS);   // a CMU subject: its picked takes
  const buf = readFileSync(resolve(file));
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(file + ' is not a binary glTF (.glb) file');
  const jsonLen = buf.readUInt32LE(12), G = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8')), BIN = 20 + jsonLen + 8;
  const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  const accessor = i => {
    const a = G.accessors[i], bv = G.bufferViews[a.bufferView], n = SIZE[a.type];
    const read = { 5126: o => buf.readFloatLE(o), 5125: o => buf.readUInt32LE(o), 5123: o => buf.readUInt16LE(o), 5121: o => buf.readUInt8(o) }[a.componentType];
    const bytes = { 5126: 4, 5125: 4, 5123: 2, 5121: 1 }[a.componentType], norm = a.normalized ? { 5123: 65535, 5121: 255 }[a.componentType] || 1 : 1;
    const base = BIN + (bv.byteOffset || 0) + (a.byteOffset || 0), stride = bv.byteStride || n * bytes, out = new Array(a.count);
    for (let k = 0; k < a.count; k++) { const row = new Array(n); for (let c = 0; c < n; c++) row[c] = read(base + k * stride + c * bytes) / norm; out[k] = n === 1 ? row[0] : row; }
    return out;
  };
  const nodes = G.nodes, parent = new Array(nodes.length).fill(-1), byName = new Map();
  nodes.forEach((n, i) => { (n.children || []).forEach(c => parent[c] = i); byName.set(n.name, i); });
  // bone names match whatever their case (Quaternius' Library 2 says 'Head', Mesh2Motion's copy of the rig 'head')
  { const lower = new Map(); for (const [k, i] of byName) if (!lower.has(k.toLowerCase())) lower.set(k.toLowerCase(), i);
    const get = byName.get.bind(byName), has = byName.has.bind(byName);
    byName.get = k => has(k) ? get(k) : lower.get(String(k).toLowerCase()); byName.has = k => has(k) || lower.has(String(k).toLowerCase()); }
  const rig = Object.keys(RIGS).find(r => byName.has(RIGS[r].test));
  if (args.includes('--list')) {
    console.log(basename(file) + ': rig ' + (rig || 'not recognised'));
    console.log('clips:', (G.animations || []).map(a => a.name).join(', '));
    console.log('bones:', nodes.map(n => n.name).join(', '));
    return null;
  }
  if (!rig) throw new Error(basename(file) + ': the rig is not one the importer knows (add it to RIGS in tools/anim-import.mjs)');
  const BONES = bonesFor(rig), missing = BONES.filter(b => !byName.has(b[1])).map(b => b[1]);
  if (missing.length) throw new Error(basename(file) + ' lacks bones the ' + rig + ' map needs: ' + [...new Set(missing)].join(', '));
  const rest = nodes.map(n => ({ t: n.translation || [0, 0, 0], r: n.rotation || [0, 0, 0, 1], s: n.scale || [1, 1, 1] }));
  const order = [], seen = new Set();
  const visit = i => { if (seen.has(i)) return; if (parent[i] >= 0) visit(parent[i]); seen.add(i); order.push(i); };
  nodes.forEach((_, i) => visit(i));
  const world = trs => { const W = new Array(nodes.length); for (const i of order) { const L = mat(trs[i].t, trs[i].r, trs[i].s); W[i] = parent[i] >= 0 ? mul(W[parent[i]], L) : L; } return W; };

  // the bind pose's mesh, each vertex in the frame of the bone that moves it most. It is optional: it gives the
  // look-alike mannequin its shape and the toe tips their length (a file with no skinned mesh uses the bones alone)
  const skin = (G.skins || [])[0], joints = skin ? skin.joints : [], ibm = skin ? accessor(skin.inverseBindMatrices) : [];
  const meshNode = nodes.findIndex(n => n.mesh !== undefined && n.skin !== undefined), mesh = skin && meshNode >= 0 ? G.meshes[nodes[meshNode].mesh] : { primitives: [] };
  if (!skin || meshNode < 0) console.warn(basename(file) + ': no skinned mesh: the body is measured from the bones alone');
  const boneVerts = new Map(), bandVerts = new Map();
  let matJoint = -1; (G.materials || []).forEach((m, i) => { if (/joint/i.test(m.name)) matJoint = i; });
  let top = 0;
  for (const prim of mesh.primitives) {
    const Pp = accessor(prim.attributes.POSITION), JN = accessor(prim.attributes.JOINTS_0), W = accessor(prim.attributes.WEIGHTS_0), band = prim.material === matJoint;
    for (let v = 0; v < Pp.length; v++) {
      top = Math.max(top, Pp[v][1]);
      let best = 0; for (let k = 1; k < 4; k++) if (W[v][k] > W[v][best]) best = k;
      const ji = JN[v][best], node = joints[ji], local = xf(ibm[ji], Pp[v]);
      const m = band ? bandVerts : boneVerts; if (!m.has(node)) m.set(node, []); m.get(node).push(local);
    }
  }
  const bindW = world(rest);
  const boneLen = name => {   // distance to the bone's first child, or (a tip bone) the extent of its vertices along y
    const i = byName.get(name), kids = nodes[i].children || [];
    if (kids.length) { const a = xf(bindW[i], [0, 0, 0]), b = xf(bindW[kids[0]], [0, 0, 0]); return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); }
    const vs = (boneVerts.get(i) || []).concat(bandVerts.get(i) || []); return pct(vs.map(v => v[1]), .98);
  };
  const TIP = {}; for (const b of BONES) if (b[2] === 'tip') TIP[b[1]] = pct(((boneVerts.get(byName.get(b[1])) || []).concat(bandVerts.get(byName.get(b[1])) || [])).map(v => v[1]), .98) || boneLen(b[1]);
  // the rig's local frame, from the rest pose: up = +y, forward from the heel toward the toes, right toward the R side
  const map = RIGS[rig].map, FWD = {};
  const pos = (W, name, where) => { const i = byName.get(name); return where === 'tip' ? xf(W[i], [0, TIP[name], 0]) : where === 'fwd' ? xf(W[i], FWD[name]) : xf(W[i], [0, 0, 0]); };
  const toeOf = W => { const t = map('L').toe; return Array.isArray(t) ? pos(W, t[0], 'tip') : pos(W, t); };
  const fwd0 = (() => { const a = pos(bindW, map('L').ankle), b = toeOf(bindW), v = [b[0] - a[0], 0, b[2] - a[2]], l = Math.hypot(...v); return v.map(x => x / l); })();
  const RIGHT = [-(fwd0[1] * 0 - fwd0[2] * 1), -(fwd0[2] * 0 - fwd0[0] * 0), -(fwd0[0] * 1 - fwd0[1] * 0)];   // up x forward = left
  { const l = pos(bindW, map('L').hip), r = pos(bindW, map('R').hip), d = (r[0] - l[0]) * RIGHT[0] + (r[2] - l[2]) * RIGHT[2]; if (d < 0) RIGHT.forEach((v, i) => RIGHT[i] = -v); }
  // 'fwd' points: the rest pose's forward direction written in each bone's own frame (the transpose of its rotation)
  for (const b of BONES) if (b[2] === 'fwd') { const m = bindW[byName.get(b[1])], n = [0, 1, 2].map(c => Math.hypot(m[c * 4], m[c * 4 + 1], m[c * 4 + 2])); FWD[b[1]] = [0, 1, 2].map(c => (m[c * 4] * fwd0[0] + m[c * 4 + 1] * fwd0[1] + m[c * 4 + 2] * fwd0[2]) / (n[c] * n[c]) * .12); }
  const toLocal = (p, o) => { const d = [p[0] - o[0], p[1], p[2] - o[2]]; return [d[0] * fwd0[0] + d[2] * fwd0[2], d[0] * RIGHT[0] + d[2] * RIGHT[2], d[1]]; };

  // the look of the mannequin: per-segment radii and where the joint-ring material sits (Rigify meshes)
  let body = null;
  if (RIGS[rig].coreSegs.length && top > 0) {
    body = { height: Math.round(top * MM), segs: [], bands: [] };
    const SEGS = [...RIGS[rig].coreSegs, ...['L', 'R'].flatMap(RIGS[rig].segs)];
    for (const [a, b, bone] of SEGS) {
      const i = byName.get(bone), vs = (boneVerts.get(i) || []).concat(bandVerts.get(i) || []), L = boneLen(bone) || 1, bins = [[], [], []];
      for (const v of vs) bins[v[1] / L < .33 ? 0 : v[1] / L < .67 ? 1 : 2].push(Math.hypot(v[0], v[2]));
      body.segs.push({ a, b, r: bins.map(x => Math.round(pct(x, .8) * MM)) });
      const bv = bandVerts.get(i); if (!bv || bv.length < 12) continue;
      const NB = 24, bb = Array.from({ length: NB }, () => []), min = Math.max(4, bv.length * .02);
      for (const v of bv) bb[Math.max(0, Math.min(NB - 1, Math.floor((v[1] / L + .2) / 1.4 * NB)))].push(v);
      for (let k = 0; k < NB;) { if (bb[k].length < min) { k++; continue; } let e = k; const run = []; while (e < NB && bb[e].length >= min) run.push(...bb[e++]); body.bands.push({ a, b, t0: +pct(run.map(v => v[1] / L), .03).toFixed(2), t1: +pct(run.map(v => v[1] / L), .97).toFixed(2), r: Math.round(pct(run.map(v => Math.hypot(v[0], v[2])), .85) * MM) }); k = e; }
    }
  }

  // every clip, sampled and turned into body points
  const clips = {}, rootNode = byName.get(RIGS[rig].root) ?? order[0];
  for (const an of G.animations || []) {
    const tracks = an.channels.map(c => { const s = an.samplers[c.sampler]; return { node: c.target.node, path: c.target.path, t: accessor(s.input), v: accessor(s.output), interp: s.interpolation }; });
    const dur = Math.max(...tracks.map(k => k.t[k.t.length - 1])), n = Math.max(1, Math.round(dur * FPS) + 1);
    const data = new Float32Array(n * MR.P * 3), move = new Float32Array(n * 2); let moved = false;
    for (let f = 0; f < n; f++) {
      const time = Math.min(dur, f / FPS), trs = rest.map(r => ({ t: r.t, r: r.r, s: r.s }));
      for (const k of tracks) {
        const T = k.t; let j = 0; while (j < T.length - 2 && T[j + 1] <= time) j++;
        const u = T.length < 2 || k.interp === 'STEP' ? 0 : Math.max(0, Math.min(1, (time - T[j]) / ((T[j + 1] - T[j]) || 1)));
        const a = k.v[j], b = k.v[Math.min(j + 1, k.v.length - 1)];
        const val = k.path === 'rotation' ? slerp(a, b, u) : a.map((x, i) => x + (b[i] - x) * u);
        const key = k.path === 'translation' ? 't' : k.path === 'rotation' ? 'r' : k.path === 'scale' ? 's' : null; if (key) trs[k.node] = Object.assign({}, trs[k.node], { [key]: val });
      }
      const W = world(trs), root = xf(W[rootNode], [0, 0, 0]), rl = toLocal(root, [0, 0, 0]);
      move[f * 2] = rl[0] * MM; move[f * 2 + 1] = rl[1] * MM; if (Math.abs(rl[0]) + Math.abs(rl[1]) > .01) moved = true;
      BONES.forEach(([, bone, where], i) => { const p = toLocal(pos(W, bone, where), root); data[(f * MR.P + i) * 3] = p[0] * MM; data[(f * MR.P + i) * 3 + 1] = p[1] * MM; data[(f * MR.P + i) * 3 + 2] = p[2] * MM; });
    }
    clips[an.name] = { name: an.name, n, dur, loop: /_Loop$/.test(an.name) || /(^|_)Idle$/.test(an.name), fps: FPS, data, move: moved ? move : null };
  }
  return { rig, clips, body };
}

/* ---- read every library, fit every clip ---- */
const libs = files.map(readLibrary);
if (args.includes('--list')) process.exit(0);
const set = Object.assign({ set: NAME }, opt('title') ? { title: opt('title') } : {}, { format: 1, credit: CREDIT, fps: FPS, sources: {}, body: null, fit: {}, clips: {} });
const r1 = v => Math.round(v);
libs.forEach((L, li) => {
  // the body at rest comes from the library's T-pose or rest-pose clip (--rest names it), else the first clip's first frame
  const restClip = [REST[li], 'A_TPose', 'T-Pose', 'TPose', 'Rest Pose', 'Rest_Pose', '_rest'].find(n => n && L.clips[n]);
  const id = SOURCES[li] || basename(files[li]).replace(/\.glb$/i, ''), rest = MR.measure(L.clips, restClip);
  if (Object.keys(CATALOG).length && !ABOUT[id]) console.warn('no "$sources" entry for ' + id + ': the set will not say where its clips came from');
  set.sources[id] = Object.assign({ file: basename(files[li]), rig: L.rig }, ABOUT[id] || {}, { rest });
  if (!set.body && L.body) set.body = L.body;
  let kept = 0;
  for (const [name, cap] of Object.entries(L.clips)) {
    if (set.clips[name] || (ONLY && !ONLY.has(name)) || name.startsWith('_')) continue;   // '_rest': a reader's rest pose, not a clip
    if (SKIP[name]) { console.log('left out ' + name + ': ' + SKIP[name]); continue; }
    const cat = CATALOG[name], extra = { blade: BLADE.test(name) };
    if (cat) {   // the tags 'loop' and 'once' say whether it loops (for libraries whose names do not: '_Loop', '_Idle')
      const tags = cat[0].split(' ').filter(Boolean); if (tags.includes('loop')) cap.loop = true; if (tags.includes('once')) cap.loop = false;
      extra.tags = tags.filter(t => t !== 'loop' && t !== 'once'); extra.desc = cat[1];
    } else if (Object.keys(CATALOG).length) console.warn('no catalog entry for ' + name);
    const { clip, max, mean } = MR.fit(rest, cap, TOL, extra);
    const ordered = { clip: clip.clip, src: id }; if (cap.take) ordered.take = cap.take;   // take: the recording and the stretch of it (CMU)
    if (cat && cat[2]) ordered.orig = cat[2];   // orig: the clip it was made from, as SET/clip
    Object.assign(ordered, { dur: clip.dur, loop: clip.loop }); if (clip.tags) ordered.tags = clip.tags; if (clip.desc) ordered.desc = clip.desc; ordered.keys = clip.keys;
    set.clips[name] = ordered; set.fit[name] = [r1(mean), r1(max)]; kept++;
  }
  console.log(`${basename(files[li])}: ${L.rig} rig, ${kept} clips; spine shares ${rest.spineW.join(' ')}, neck ${rest.neckW}`);
});
const w = writeSet(set, OUT);
console.log(`wrote ${OUT}: ${w.clips} clips, ${w.keys} key poses, ${w.kb.toFixed(0)} KB`);
