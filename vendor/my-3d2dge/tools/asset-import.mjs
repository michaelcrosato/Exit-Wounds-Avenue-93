// Imports a fetched library (tools/asset-fetch.mjs) into a set of the asset store, src/assets/sets/<set>.js, the way
// docs/ASSET-IMPORT.md says, and records how each entry fits in the set's ledger (src/assets/catalogs/<set>.tsv):
//   models (glTF binaries) -> shapes: read the meshes (z up, 16 units a metre, times the kit's scale, the front to the south);
//       split them by color and connectivity; fit each part to the simplest primitive whose voxels match its own at an IoU
//       of --tol (.9) or better (box, cyl, lathe, prism, wedge, ball), else boxes; fold mirrored pairs; keep 40 parts. Each
//       color keeps the kit's own hex on the pattern of the nearest core material (D31). Fit: the silhouette IoU at game
//       scale against the source's triangles, through the engine's own rasterizer, mean and worst over 8 views; color dE
//   pixel packs (PNG tiles) -> sprites: rows with one character per color, the pack's one palette; exact (fit 0)
//   PBR sets (ambientCG) -> materials: the source's category picks the pattern, a ramp of five from the color map (kept
//       where E.tones misses it by more than dE 8), the numbers from the height map's joints and the physical size (drawn
//       twice life, as props are); fit: dE of the mean color and a structure score at game scale (needs Chromium: JPEGs)
// An entry under the fit thresholds (a shape's mean IoU under .8 or a view under .6) stays out of the set, flagged in the
// ledger; the catalog's $skip keeps out what a person judged (ornate, organic, structural), with the reason.
// Usage: node tools/asset-import.mjs <set> [--scale 2] [--tol .9] [--catalog] [--only a,b] [--credit "..."] [--out file.js]
//        node tools/asset-import.mjs <set> --list         (the ledger: each file, its fit, whether the set uses it, flags)
//   --catalog takes only the ids the catalog describes (about and tags from it); without it every file comes in, named and
//   described from its file name. --scale is the kit's, kept in its source record for the next import.
import { readFileSync, existsSync } from 'node:fs';
import { join, basename, extname, dirname } from 'node:path';
import { root, engine, readCatalog, writeCatalog, readLedger, writeLedger, writeSet, readSet, cacheDir, decodePNG, readGlb, tok, js } from './asset-lib.mjs';

const args = process.argv.slice(2), opt = n => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : undefined; };
const set = args.find((a, i) => !a.startsWith('--') && !(args[i - 1] || '').startsWith('--'));
if (!set) { console.error('Usage: node tools/asset-import.mjs <set> [--scale k] [--tol .9] [--catalog] [--only a,b] [--credit "..."] [--out file.js] [--list]'); process.exit(2); }
const cat = readCatalog(set), sources = cat.$sources || {}, ledger = readLedger(set), lib = set === 'ambientcg' ? 'ambientcg' : set.split('-')[0], dir = cacheDir(lib);
if (!Object.keys(sources).length) { console.error(set + ': no downloads on record (node tools/asset-fetch.mjs first)'); process.exit(1); }
const skip = cat.$skip || {}, only = opt('only') ? new Set(opt('only').split(',')) : null, byCat = args.includes('--catalog');
const E = engine(), r2 = v => Math.round(v * 100) / 100;
const idOf = file => basename(file).replace(/(\.gltf)?\.(glb|gltf|png|jpe?g)$/i, '').replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[_\s]+/g, '-').toLowerCase();
const wanted = id => (!only || only.has(id)) && !skip[id] && (!byCat || Array.isArray(cat[id]));
const outside = id => only && !only.has(id), dropped = new Set();   // (--only: the other ids' rows and entries stay as they are; a wanted one that no longer fits leaves)

if (args.includes('--list')) {
  for (const r of ledger) { const id = idOf(r.file); console.log([id.padEnd(30), (r.kind || '').padEnd(6), String(r.tris || r.w && r.w + 'x' + r.h || '').padStart(6), (r.fit || '-').padEnd(10), r.used ? 'used' : skip[id] ? 'skip: ' + skip[id] : '    ', r.flags, Array.isArray(cat[id]) ? cat[id][1] : ''].join(' ')); }
  console.log(ledger.length + ' files; ' + ledger.filter(r => r.used).length + ' used, ' + Object.keys(skip).length + ' skipped by the catalog');
  process.exit(0);
}

/* ---------- colors ---------- */
const hex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
function lab([r, g, b]) {
  const f = v => { v /= 255; return v > .04045 ? Math.pow((v + .055) / 1.055, 2.4) : v / 12.92; }, R = f(r), G = f(g), B = f(b);
  const X = (R * .4124 + G * .3576 + B * .1805) / .95047, Y = R * .2126 + G * .7152 + B * .0722, Z = (R * .0193 + G * .1192 + B * .9505) / 1.08883;
  const h = t => t > .008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; return [116 * h(Y) - 16, 500 * (h(X) - h(Y)), 200 * (h(Y) - h(Z))];
}
const dE = (a, b) => { const p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
const unlab = ([L, a, b]) => {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200, g = t => t ** 3 > .008856 ? t ** 3 : (t - 16 / 116) / 7.787;
  const X = g(fx) * .95047, Y = g(fy), Z = g(fz) * 1.08883, f = v => 255 * (v > .0031308 ? 1.055 * Math.pow(v, 1 / 2.4) - .055 : 12.92 * v);
  return [f(X * 3.2406 - Y * 1.5372 - Z * .4986), f(-X * .9689 + Y * 1.8758 + Z * .0415), f(X * .0557 - Y * .2040 + Z * 1.0570)];
};
const lum = (a, i = 0) => .2126 * a[i] + .7152 * a[i + 1] + .0722 * a[i + 2];

const rows = new Map(ledger.map(r => [r.file, r])), entries = {}, setMats = {}, report = [];
const credit = opt('credit') || Object.values(sources).map(s => s.label).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3).join(', ') + (Object.keys(sources).length > 3 ? ' and more' : '') + ' (' + [...new Set(Object.values(sources).map(s => s.origin.split(' (')[1] ? s.origin.split(' (')[1].split(')')[0] : s.origin))].join(', ') + '), ' + [...new Set(Object.values(sources).map(s => s.license))].join(', ');
const kind = set === 'ambientcg' ? 'materials' : ledger.some(r => r.kind === 'model') ? 'shapes' : 'sprites';

/* =================== models -> shapes =================== */
// the core materials a kit color may borrow a pattern from: data materials only (no painters, glow or overlays)
const LIB = Object.entries(E.MATERIALS).filter(([, m]) => m && typeof m === 'object' && m.color && m.pattern && !m.glow && !m.over && !m.face && !m.roof && !m.tile && !m.floor).map(([id, m]) => ({ id, m, rgb: E.hex(m.color) }));
function nearestLib(rgb) { let best = null, bd = 1e9; for (const L of LIB) { const d = dE(rgb, L.rgb); if (d < bd) { bd = d; best = L; } } return { L: best, dE: bd }; }
/** the kit's palette: every model's colors (see colorsOf), shades within dE 4 as one, the most used first, each named after
 *  its nearest core material ('oak', then 'oak-b' for another color nearest oak). Built from every model in the ledger, so a
 *  re-import of a few keeps the names. The catalog's $mats ({ 'clay-b': 'oak' }) gives a color another core material's
 *  pattern and numbers (a curator's call from the sheets: this orange is wood), keeping its hex */
const PALETTE = [];
function paletteAdd(rgb, area) { const p = PALETTE.find(q => dE(rgb, q.rgb) < 4); if (p) p.area += area; else PALETTE.push({ rgb, area }); }
function paletteName() {
  PALETTE.sort((a, b) => b.area - a.area);
  const taken = new Set(), over = cat.$mats || {};
  for (const p of PALETTE) { const L = nearestLib(p.rgb).L; let id = L.id, n = 1; while (taken.has(id)) id = L.id + '-' + String.fromCharCode(97 + n++); taken.add(id); p.id = id;
    const B = over[id] === 'none' ? { m: { pattern: 'none' } } : over[id] ? LIB.find(x => x.id === over[id]) : L;   // ('none': a flat color, paint or plastic)
    if (over[id] && !B) { console.error(set + ': $mats ' + id + ' -> ' + over[id] + ', not a core data material (or none)'); process.exit(1); }
    const nums = Object.entries(B.m).filter(([k]) => !['color', 'pattern', 'ramp'].includes(k)).map(([k, v]) => k + '=' + v).join(' ');
    p.mat = [hex(p.rgb), B.m.pattern, nums].filter(Boolean).join(' '); }
}
/** a kit color's set material (its palette entry's id; the material joins the set when an entry uses it) */
function setMaterial(rgb) { let best = PALETTE[0], bd = 1e9; for (const p of PALETTE) { const d = dE(rgb, p.rgb); if (d < bd) { bd = d; best = p; } } setMats[best.id] = best.mat; return best.id; }

/** points on a part's surface about `step` apart: rows parallel to each triangle's longest edge, up to its apex (as many
 *  points as its area and edges need: a long sliver of a triangle is a few rows, not a square of them) */
function samples(T, step) {
  const out = [], L = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]), at = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
  for (const tri of T) {
    let [a, b, d] = tri;
    if (L(b, d) >= L(a, b) && L(b, d) >= L(d, a)) [a, b, d] = [b, d, a]; else if (L(d, a) >= L(a, b)) [a, b, d] = [d, a, b];   // (a-b the longest edge)
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]], base = L(a, b) || 1e-9;
    const h = Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / base, rows = Math.max(1, Math.ceil(h / step));
    for (let r = 0; r <= rows; r++) { const t = r / rows, p = at(a, d, t), q = at(b, d, t), n = Math.max(1, Math.ceil(L(p, q) / step)); for (let i = 0; i <= n; i++) out.push(at(p, q, i / n)); }
  }
  return out;
}
/** a part's solid at cell size c, as its visual hull (inside the part's silhouette along all three axes, holes filled, so
 *  gaps between a kit's pieces never leak). cells: 2 inside, 1 on the hull's skin, 0 outside */
function voxelize(S, c) {
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (const v of S) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[k]); hi[k] = Math.max(hi[k], v[k]); }
  const o = lo.map(x => Math.floor(x / c) - 1), n = hi.map((x, k) => Math.floor(x / c) - o[k] + 2), NN = n[0] * n[1] * n[2], cells = new Uint8Array(NN), I = (x, y, z) => (z * n[1] + y) * n[0] + x;
  const sil = (a, b) => {
    const w = n[a], h = n[b], m = new Uint8Array(w * h);
    for (const v of S) m[(Math.floor(v[b] / c) - o[b]) * w + Math.floor(v[a] / c) - o[a]] = 1;
    const out = new Uint8Array(w * h), q = [0]; out[0] = 1;
    while (q.length) { const i = q.pop(), x = i % w, y = (i / w) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const j = Y * w + X; if (!out[j] && !m[j]) { out[j] = 1; q.push(j); } } }
    for (let i = 0; i < w * h; i++) m[i] = out[i] ? 0 : 1;
    return m;
  };
  const mz = sil(0, 1), my = sil(0, 2), mx = sil(1, 2);
  for (let z = 0; z < n[2]; z++) for (let y = 0; y < n[1]; y++) for (let x = 0; x < n[0]; x++) if (mz[y * n[0] + x] && my[z * n[0] + x] && mx[z * n[1] + y]) cells[I(x, y, z)] = 2;
  let N = 0;
  for (let z = 0; z < n[2]; z++) for (let y = 0; y < n[1]; y++) for (let x = 0; x < n[0]; x++) {
    const i = I(x, y, z); if (!cells[i]) continue;
    if (x === 0 || y === 0 || z === 0 || x === n[0] - 1 || y === n[1] - 1 || z === n[2] - 1 || !cells[i - 1] || !cells[i + 1] || !cells[i - n[0]] || !cells[i + n[0]] || !cells[i - n[0] * n[1]] || !cells[i + n[0] * n[1]]) cells[i] = 1;
  }
  for (let i = 0; i < NN; i++) N += cells[i] === 2 ? 1 : cells[i] ? .5 : 0;
  return { o, n, cells, N, c };
}
/** a part's voxels against a candidate solid (inside(x, y, z) at cell centres); skin cells count on neither side */
function iou(vx, inside) {
  const { o, n, cells, c } = vx; let inter = 0, uni = 0;
  for (let z = 0; z < n[2]; z++) for (let y = 0; y < n[1]; y++) for (let x = 0; x < n[0]; x++) {
    const v = cells[(z * n[1] + y) * n[0] + x]; if (v === 1) continue;
    const P = inside((x + o[0] + .5) * c, (y + o[1] + .5) * c, (z + o[2] + .5) * c);
    if (P && v) inter++; if (P || v) uni++;
  }
  return inter / (uni || 1);
}
function dp(P, tol) {
  if (P.length < 3) return P;
  let k = 0, d = 0; const [a, b] = [P[0], P[P.length - 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-9;
  for (let i = 1; i < P.length - 1; i++) { const e = Math.abs((b[0] - a[0]) * (a[1] - P[i][1]) - (a[0] - P[i][0]) * (b[1] - a[1])) / L; if (e > d) { d = e; k = i; } }
  return d <= tol ? [a, b] : dp(P.slice(0, k + 1), tol).slice(0, -1).concat(dp(P.slice(k), tol));
}
/** the outer boundary of a 2D mask (1 = filled) as a polygon in cell corners, simplified */
function contour(mask, w, h, tol) {
  const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x], next = new Map(), key = (x, y) => x + ',' + y;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!at(x, y)) continue;
    if (!at(x, y - 1)) next.set(key(x + 1, y), [x, y]); if (!at(x, y + 1)) next.set(key(x, y + 1), [x + 1, y + 1]);
    if (!at(x - 1, y)) next.set(key(x, y), [x, y + 1]); if (!at(x + 1, y)) next.set(key(x + 1, y + 1), [x + 1, y]);
  }
  let best = []; const seen = new Set();
  for (const k of next.keys()) {
    if (seen.has(k)) continue;
    const loop = []; let c = k.split(',').map(Number), guard = 0;
    while (guard++ < 1e5) { const kk = key(c[0], c[1]); if (seen.has(kk)) break; seen.add(kk); loop.push(c); c = next.get(kk); if (!c) break; }
    if (loop.length > best.length) best = loop;
  }
  if (best.length < 3) return best;
  let far = 0, fd = 0; for (let i = 0; i < best.length; i++) { const d = Math.hypot(best[i][0] - best[0][0], best[i][1] - best[0][1]); if (d > fd) { fd = d; far = i; } }
  return dp(best.slice(0, far + 1), tol).slice(0, -1).concat(dp(best.slice(far).concat([best[0]]), tol).slice(0, -1));
}
const r1 = v => Math.round(v * 2) / 2, rd = v => Math.abs(v) < 4 ? Math.round(v * 10) / 10 : r1(v);   // half units, tenths when small
const AX = { z: [2, 0, 1], x: [0, 1, 2], y: [1, 0, 2] }, ROT = { z: null, x: [0, 90, 0], y: [-90, 0, 0] };
const TOL = +(opt('tol') || .9);
/** the simplest primitive for a part (its triangles T): { part, iou, cost } (part null and parts [...] when boxes) */
function fitPart(T, mat, o = {}) {
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; for (const t of T) for (const v of t) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[k]); hi[k] = Math.max(hi[k], v[k]); }
  for (let k = 0; k < 3; k++) if (hi[k] - lo[k] < .5) { const m = (hi[k] + lo[k]) / 2; lo[k] = m - .25; hi[k] = m + .25; }   // a plate under a pixel: half a unit
  const dim = hi.map((v, k) => v - lo[k]), c = Math.max(Math.min(1, Math.max(.06, Math.min(Math.max(...dim) / 36, Math.min(...dim) / 5))), Math.cbrt(dim[0] * dim[1] * dim[2] / 4e5));   // (at most about 400,000 cells: a wide, thin plate would ask for a billion)
  const surf = T.reduce((a, [p, q, r]) => a + Math.hypot((q[1] - p[1]) * (r[2] - p[2]) - (q[2] - p[2]) * (r[1] - p[1]), (q[2] - p[2]) * (r[0] - p[0]) - (q[0] - p[0]) * (r[2] - p[2]), (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])) / 2, 0);
  // (points on the surface: at most about 300,000)
  const S = samples(T, Math.max(c * .45, Math.sqrt(surf / 3e5))).map(v => v.map((x, k) => Math.min(hi[k], Math.max(lo[k], x)))), vx = voxelize(S.concat([lo, hi]), c), ctr = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2], cands = [];
  cands.push({ iou: iou(vx, (x, y, z) => x >= lo[0] && x <= hi[0] && y >= lo[1] && y <= hi[1] && z >= lo[2] && z <= hi[2]), part: ['box', mat, [rd(ctr[0]), rd(ctr[1]), rd(lo[2])], dim.map(rd)] });
  { const R = (dim[0] + dim[1]) / 4, H = dim[2] / 2; cands.push({ iou: iou(vx, (x, y, z) => ((x - ctr[0]) ** 2 + (y - ctr[1]) ** 2) / (R * R) + ((z - ctr[2]) / H) ** 2 <= 1), part: ['ball', mat, [rd(ctr[0]), rd(ctr[1]), rd(ctr[2])], rd(R), Math.abs(H / R - 1) > .05 ? { sz: r2(H / R) } : undefined] }); }
  for (const ax of ['z', 'x', 'y']) {
    const [a, p, q] = AX[ax], len = dim[a], nb = Math.max(2, Math.min(40, Math.round(len / c))), bin = len / nb, rmax = new Float64Array(nb);
    for (const v of S) { const s = Math.min(nb - 1, Math.floor((v[a] - lo[a]) / bin)), r = Math.hypot(v[p] - ctr[p], v[q] - ctr[q]); if (r > rmax[s]) rmax[s] = r; }
    const rAt = h => rmax[Math.min(nb - 1, Math.max(0, Math.floor(h / bin)))];
    const lat = iou(vx, (x, y, z) => { const w = [x, y, z], h = w[a] - lo[a]; return h >= 0 && h <= len && Math.hypot(w[p] - ctr[p], w[q] - ctr[q]) <= rAt(h); });
    let pts = [[0, 0]]; for (let s = 0; s < nb; s++) pts.push([rmax[s], s * bin], [rmax[s], (s + 1) * bin]); pts.push([0, len]);
    pts = dp(pts, Math.max(c, len / 30)).map(([r, z]) => [rd(r), rd(z)]); pts = pts.filter((v, i) => !i || v[0] !== pts[i - 1][0] || v[1] !== pts[i - 1][1]);
    const at = [0, 0, 0]; at[a] = lo[a]; at[p] = ctr[p]; at[q] = ctr[q];
    const ro = ROT[ax] ? { rot: ROT[ax] } : undefined;
    if (pts.length === 4 && pts[0][0] === 0 && pts[3][0] === 0 && pts[1][1] === 0) cands.push({ iou: lat, part: ['cyl', mat, at.map(rd), pts[1][0], rd(len), Object.assign({}, ro, pts[2][0] !== pts[1][0] ? { r2: pts[2][0] } : {})] });
    else if (pts.length <= 10) cands.push({ iou: lat, part: ['lathe', mat, at.map(rd), pts, ro] });
    { const g = c * .5, w = Math.ceil(dim[p] / g) + 1, h = Math.ceil(dim[q] / g) + 1, mask = new Uint8Array(w * h);
      for (const v of S) mask[Math.min(h - 1, Math.floor((v[q] - lo[q]) / g)) * w + Math.min(w - 1, Math.floor((v[p] - lo[p]) / g))] = 1;
      const ol = contour(mask, w, h, Math.max(1.2, Math.max(w, h) / 28)).map(([u, v]) => [lo[p] + u * g, lo[q] + v * g]);
      if (ol.length >= 3 && ol.length <= 10) {
        const inPoly = (u, v) => { let ins = false; for (let i = 0, j = ol.length - 1; i < ol.length; j = i++) { const [xi, yi] = ol[i], [xj, yj] = ol[j]; if ((yi > v) !== (yj > v) && u < (xj - xi) * (v - yi) / (yj - yi) + xi) ins = !ins; } return ins; };
        const pri = iou(vx, (x, y, z) => { const w2 = [x, y, z]; return w2[a] >= lo[a] && w2[a] <= hi[a] && inPoly(w2[p], w2[q]); });
        const atP = [0, 0, 0]; if (ax === 'z') atP[2] = lo[2]; else atP[a] = ctr[a];   // prism z: outline (x, y) up from at; y: (x, z) centred; x: (y, z)
        cands.push({ iou: pri, part: ['prism', mat, atP.map(rd), ol.map(([u, v]) => [rd(u), rd(v)]), rd(len), ax === 'z' ? undefined : { axis: ax }] });
      }
    }
  }
  for (const rr of [0, 90, 180, 270]) {   // a wedge, its high side to each of the four sides
    const sw = rr % 180 ? [dim[1], dim[0]] : [dim[0], dim[1]], cs = Math.cos(rr * Math.PI / 180), sn = Math.sin(rr * Math.PI / 180);
    const inside = (x, y, z) => { const dx = x - ctr[0], dy = y - ctr[1], lx = dx * cs + dy * sn, ly = -dx * sn + dy * cs; if (Math.abs(lx) > sw[0] / 2 || Math.abs(ly) > sw[1] / 2) return false; return z - lo[2] >= 0 && z - lo[2] <= dim[2] * (.5 - ly / sw[1]); };
    cands.push({ iou: iou(vx, inside), part: ['wedge', mat, [rd(ctr[0]), rd(ctr[1]), rd(lo[2])], [rd(sw[0]), rd(sw[1]), rd(dim[2])], rr ? { rot: rr } : undefined] });
  }
  for (const k of cands) { k.part = k.part.filter(x => x !== undefined && !(x && typeof x === 'object' && !Array.isArray(x) && !Object.keys(x).length)); k.cost = tok(js(k.part)); }
  const ok = cands.filter(k => k.iou >= (o.tol || TOL)).sort((x, y) => x.cost - y.cost);
  if (ok.length) return Object.assign(ok[0], { size: vx.N * c ** 3 });
  const best = cands.sort((x, y) => y.iou - x.iou)[0];
  if (o.noBoxes) return Object.assign(best, { size: vx.N * c ** 3 });
  const v1 = voxelize(S, Math.max(.5, c, Math.min(1, Math.min(...dim) / 1.5), Math.cbrt(dim[0] * dim[1] * dim[2] / 4e5))), boxes = greedy(v1, mat), bc = tok(js(boxes));
  if (best.iou >= .7 && best.cost * 2 < bc) return Object.assign(best, { size: vx.N * c ** 3 });
  return { iou: 1, part: null, parts: boxes, cost: bc, size: vx.N * c ** 3, boxes: boxes.length };
}
function greedy(vx, mat) {
  const { o, n, c } = vx, cells = vx.cells.map(v => v ? 1 : 0), used = new Uint8Array(cells.length), I = (x, y, z) => (z * n[1] + y) * n[0] + x, out = [];
  for (let z = 0; z < n[2]; z++) for (let y = 0; y < n[1]; y++) for (let x = 0; x < n[0]; x++) {
    if (!cells[I(x, y, z)] || used[I(x, y, z)]) continue;
    const ok = (X, Y, Z) => X < n[0] && Y < n[1] && Z < n[2] && cells[I(X, Y, Z)] && !used[I(X, Y, Z)];
    let x1 = x; while (ok(x1 + 1, y, z)) x1++;
    let y1 = y; const rowOk = Y => { for (let X = x; X <= x1; X++) if (!ok(X, Y, z)) return false; return true; }; while (rowOk(y1 + 1)) y1++;
    let z1 = z; const slabOk = Z => { for (let Y = y; Y <= y1; Y++) for (let X = x; X <= x1; X++) if (!ok(X, Y, Z)) return false; return true; }; while (slabOk(z1 + 1)) z1++;
    for (let Z = z; Z <= z1; Z++) for (let Y = y; Y <= y1; Y++) for (let X = x; X <= x1; X++) used[I(X, Y, Z)] = 1;
    const w = (x1 - x + 1) * c, d = (y1 - y + 1) * c, h = (z1 - z + 1) * c;
    out.push(['box', mat, [rd((x + o[0]) * c + w / 2), rd((y + o[1]) * c + d / 2), rd((z + o[2]) * c)], [rd(w), rd(d), rd(h)]]);
  }
  return out;
}
/** two parts the same but for x (or y) negated -> ['mirror', 'x' | 'y', part] */
function foldMirrors(parts) {
  const out = [], used = new Set(), sig = p => JSON.stringify([p[0], p[1], p.slice(3)]);
  for (let i = 0; i < parts.length; i++) {
    if (used.has(i)) continue; const p = parts[i];
    if (!Array.isArray(p[2])) { out.push(p); continue; }
    let done = false;
    for (const [axis, k] of [['x', 0], ['y', 1]]) {
      if (Math.abs(p[2][k]) < .3 || (p[0] !== 'box' && p[0] !== 'cyl' && p[0] !== 'ball' && !(p[0] === 'lathe' && !p[4]))) continue;
      for (let j = i + 1; j < parts.length; j++) {
        if (used.has(j)) continue; const q = parts[j]; if (sig(q) !== sig(p) || !Array.isArray(q[2])) continue;
        const m = [...p[2]]; m[k] = -m[k];
        if (Math.abs(m[0] - q[2][0]) < .3 && Math.abs(m[1] - q[2][1]) < .3 && Math.abs(m[2] - q[2][2]) < .3) { out.push(['mirror', axis, p[2][k] > 0 ? p : q]); used.add(j); done = true; break; }
      }
      if (done) break;
    }
    if (!done) out.push(p);
  }
  return out;
}
// the views a fit is measured in: [view, facing offset] (topdown as the engine draws steep views: from the characters' angle)
const VIEWS = () => [['iso', 0], ['threequarter', 0], ['topdown', 0], ['brawler', 0], ['side', 0], ['iso', 1.6], ['iso', 3.2], ['iso', 4.7]].map(([v, f]) => [v === 'topdown' ? E.charView(E.VIEWS.topdown) : E.VIEWS[v], Math.PI / 2 + .45 + f]);
/** the source's silhouette in a view, as the engine's pixels would be (pixel X covered when its centre is in a triangle) */
function silhouette(tris, view, facing) {
  const c = Math.cos(facing - Math.PI / 2), s = Math.sin(facing - Math.PI / 2), px = new Set();
  for (const t of tris) {
    const P = t.v.map(([x, y, z]) => view.p(x * c - y * s, x * s + y * c, z)), x0 = Math.floor(Math.min(P[0][0], P[1][0], P[2][0])), x1 = Math.ceil(Math.max(P[0][0], P[1][0], P[2][0])), y0 = Math.floor(Math.min(P[0][1], P[1][1], P[2][1])), y1 = Math.ceil(Math.max(P[0][1], P[1][1], P[2][1]));
    const area = (P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[1][1] - P[0][1]) * (P[2][0] - P[0][0]); if (Math.abs(area) < 1e-9) continue;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const qx = x + .5, qy = y + .5, e = (A, B) => ((B[0] - A[0]) * (qy - A[1]) - (B[1] - A[1]) * (qx - A[0])) * Math.sign(area);
      if (e(P[0], P[1]) >= 0 && e(P[1], P[2]) >= 0 && e(P[2], P[0]) >= 0) px.add(x + ',' + y);
    }
  }
  return px;
}
/** the engine's silhouette of an entry (its slots resolved to their materials, so nothing need be registered) */
function drawn(entry, view, facing) {
  const I = E.shapeInfo({ mats: Object.fromEntries(Object.entries(entry.mats).map(([k, v]) => [k, setMats[v] || v])), parts: entry.parts }, { view, facing }), px = new Set();
  for (let j = 0; j < I.w * I.h; j++) if (I.rgba[j * 4 + 3]) px.add((j % I.w - I.ox) + ',' + (Math.floor(j / I.w) - I.oy));
  return { px, I };
}
const jac = (a, b) => { let n = 0; for (const k of a) if (b.has(k)) n++; return n / ((a.size + b.size - n) || 1); };
/** the parts some view shows (one wholly inside another, or under it, is left out) */
function visible(entry) {
  const mats = Object.fromEntries(Object.entries(entry.mats).map(([k, v]) => [k, setMats[v] || v])), range = []; let k = 0;
  for (const p of entry.parts) { const n = E.shapeInfo({ mats, parts: [p] }, { view: E.VIEWS.iso }).prims; range.push([k, k + n]); k += n; }
  const seen = new Set();
  for (const [view, f] of VIEWS()) for (const extra of [0, Math.PI]) { const I = E.shapeInfo({ mats, parts: entry.parts }, { view, facing: f + extra }); I.parts.forEach((n, q) => { if (n) seen.add(q); }); }
  return entry.parts.filter((p, i) => { for (let q = range[i][0]; q < range[i][1]; q++) if (seen.has(q)) return true; return false; });
}
const area = t => { const [a, b, c] = t.v, u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; return Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]) / 2; };
/** a model's colors: a kit's palette shades each swatch in a gradient, so shades of one hue are one color (Lab, lightness
 *  counting a third); each its area-weighted mean. Sets each triangle's ck (its color's key) -> Map(key -> { rgb, area }) */
function colorsOf(tris) {
  const shades = new Map(); for (const t of tris) { const k = t.rgb.join(','); if (!shades.has(k)) shades.set(k, { rgb: t.rgb, lab: lab(t.rgb), a: 0 }); shades.get(k).a += area(t); }
  const clusters = [];
  for (const s2 of [...shades.values()].sort((x, y) => y.a - x.a)) {
    let best = null, bd = 11;
    for (const cl of clusters) { const d = Math.hypot((s2.lab[0] - cl.lab[0]) / 3, s2.lab[1] - cl.lab[1], s2.lab[2] - cl.lab[2]); if (d < bd) { bd = d; best = cl; } }
    if (!best) clusters.push(best = { lab: s2.lab, sum: [0, 0, 0], a: 0, keys: [] });
    best.keys.push(s2.rgb.join(',')); best.a += s2.a; for (let k = 0; k < 3; k++) best.sum[k] += s2.rgb[k] * s2.a;
  }
  const colors = new Map(), ofShade = new Map();
  clusters.forEach((cl, i) => { colors.set(i, { rgb: cl.sum.map(v => v / (cl.a || 1)), area: cl.a }); for (const k of cl.keys) ofShade.set(k, i); });
  for (const t of tris) t.ck = ofShade.get(t.rgb.join(','));
  return colors;
}
/** one model -> { entry, fit, flags, tris } */
function convert(file, o) {
  const { tris } = readGlb(file, { srgbFactors: o.srgb }); if (!tris.length) throw new Error('no triangles');
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; for (const t of tris) for (const v of t.v) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[k]); hi[k] = Math.max(hi[k], v[k]); }
  const sc = o.scale || 1, sh = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, lo[2]];
  for (const t of tris) t.v = t.v.map(v => [(v[0] - sh[0]) * sc, (v[1] - sh[1]) * sc, (v[2] - sh[2]) * sc]);
  const colors = colorsOf(tris);
  // pieces: connected triangles of one color
  const vkey = v => v.map(x => Math.round(x * 8)).join(','), id = new Map(), P = [], find = i => P[i] === i ? i : (P[i] = find(P[i]));
  const vi = tris.map(t => t.v.map(v => { const k = t.ck + '|' + vkey(v); if (!id.has(k)) { id.set(k, P.length); P.push(P.length); } return id.get(k); }));
  for (const t of vi) { P[find(t[1])] = find(t[0]); P[find(t[2])] = find(t[0]); }
  const groups = new Map(); tris.forEach((t, i) => { const r = find(vi[i][0]); if (!groups.has(r)) groups.set(r, { ck: t.ck, T: [] }); groups.get(r).T.push(t.v); });
  // slots: a letter per color, the set's material for it
  const slots = {}, mats = {}; let sl = 0;
  for (const [k, col] of [...colors].sort((x, y) => y[1].area - x[1].area)) { const s = String.fromCharCode(97 + sl % 26) + (sl >= 26 ? Math.floor(sl / 26) : ''); sl++; slots[k] = s; mats[s] = setMaterial(col.rgb); }
  // fit: all the pieces of a color together first; what does not fit is split where its pieces spread most, down to
  // single pieces (which may become boxes). Pieces under a pixel are left out
  const fitted = [], tiny = .6;
  const solve = list => {
    const T = list.flatMap(g => g.T), mat = slots[list[0].ck];
    if (list.length === 1) { fitted.push(fitPart(T, mat)); return; }
    const f = fitPart(T, mat, { noBoxes: true }); if (f.iou >= TOL) { fitted.push(f); return; }
    const C = list.map(g => { const s = [0, 0, 0]; for (const t of g.T) for (const v of t) for (let k = 0; k < 3; k++) s[k] += v[k] / (g.T.length * 3); return s; });
    let ax = 0, sp = -1; for (let k = 0; k < 3; k++) { const vs = C.map(q => q[k]), d = Math.max(...vs) - Math.min(...vs); if (d > sp) { sp = d; ax = k; } }
    const order = list.map((g, i) => [C[i][ax], g]).sort((x, y) => x[0] - y[0]).map(x => x[1]), half = order.length >> 1;
    solve(order.slice(0, half)); solve(order.slice(half));
  };
  const byColor = new Map();
  for (const g of groups.values()) {
    const l0 = [1e9, 1e9, 1e9], h0 = [-1e9, -1e9, -1e9]; for (const t of g.T) for (const v of t) for (let k = 0; k < 3; k++) { l0[k] = Math.min(l0[k], v[k]); h0[k] = Math.max(h0[k], v[k]); }
    if (Math.max(h0[0] - l0[0], h0[1] - l0[1], h0[2] - l0[2]) < tiny) continue;
    if (!byColor.has(g.ck)) byColor.set(g.ck, []); byColor.get(g.ck).push(g);
  }
  for (const list of byColor.values()) solve(list);
  fitted.sort((a, b) => b.size - a.size);
  const entry = { about: o.about, tags: o.tags, mats, parts: foldMirrors(fitted.flatMap(f => f.part ? [f.part] : f.parts)) };
  const used = new Set(); entry.parts = visible(entry);
  const flags = []; if (entry.parts.length > 40) { entry.parts = entry.parts.slice(0, 40); flags.push('budget'); }
  if (fitted.some(f => f.boxes)) flags.push('boxes');
  const slotsIn = p => { if (!Array.isArray(p)) return; const k = p[0]; if (k === 'mirror') slotsIn(p[2]); else if (k === 'ring' || k === 'row') slotsIn(p[3]); else if (k === 'group') (p[3] || []).forEach(slotsIn); else if (k !== 'use' && typeof p[1] === 'string') used.add(p[1]); };
  entry.parts.forEach(slotsIn);
  for (const s of Object.keys(mats)) if (!used.has(s)) delete mats[s];
  // the fit: silhouettes at game scale in 8 views, and the color (each triangle's own against its slot's)
  const ious = VIEWS().map(([view, f]) => jac(drawn(entry, view, f).px, silhouette(tris, view, f)));
  let tot = 0, de = 0; for (const t of tris) { const a = area(t), col = colors.get(t.ck); tot += a; de += a * dE(t.rgb, col.rgb); }
  const fit = { iou: r2(ious.reduce((a, b) => a + b, 0) / ious.length), worst: r2(Math.min(...ious)), dE: Math.round(de / (tot || 1)) };
  return { entry, fit, flags, tris: tris.length };
}
if (kind === 'shapes') {
  for (const [key, rec] of Object.entries(sources)) if (opt('scale')) rec.scale = +opt('scale');
  // the palette from every model, skipped or not, so the names $mats uses never move
  for (const row of ledger.filter(r => r.kind === 'model')) { try { const { tris } = readGlb(join(dir, row.file), { srgbFactors: (sources[row.src] || {}).factors === 'srgb' }); for (const c of colorsOf(tris).values()) paletteAdd(c.rgb, c.area); } catch (e) { /* (flagged below) */ } }
  paletteName();
  for (const row of ledger.filter(r => r.kind === 'model')) {
    const id = idOf(row.file); if (outside(id)) continue; if (!wanted(id)) { row.used = ''; if (skip[id]) row.flags = 'skip'; continue; }
    const rec = sources[row.src] || {}, c = Array.isArray(cat[id]) ? cat[id] : null;
    let r; try { r = convert(join(dir, row.file), { scale: rec.scale || 1, srgb: rec.factors === 'srgb', about: c ? c[1] : id.replace(/-/g, ' '), tags: c ? c[0] : '' }); }
    catch (e) { row.flags = 'unreadable: ' + e.message.slice(0, 60); row.used = ''; console.log(`  ${id}: ${row.flags}`); continue; }
    const ok = r.fit.iou >= .8 && r.fit.worst >= .6;
    row.fit = r.fit.iou + '/' + r.fit.worst; row.used = ok ? '1' : ''; row.flags = [...r.flags, ok ? '' : 'fit'].filter(Boolean).join(' ');
    if (ok) entries[id] = Object.assign(r.entry, { src: row.src, orig: row.file.split('/').slice(1).join('/'), fit: r.fit }); else dropped.add(id);
    report.push([id, r.tris, r.entry.parts.length, tok(js(r.entry)), r.fit.iou, r.fit.worst, r.fit.dE, row.flags]);
    console.log(`  ${id.padEnd(28)} ${String(r.tris).padStart(5)} tris -> ${String(r.entry.parts.length).padStart(2)} parts, ${String(tok(js(r.entry))).padStart(4)} tokens; IoU ${r.fit.iou} (worst ${r.fit.worst}), dE ${r.fit.dE}${row.flags ? '  [' + row.flags + ']' : ''}`);
  }
}

/* =================== pixel packs -> sprites =================== */
if (kind === 'sprites') {
  const imgs = ledger.filter(r => r.kind === 'image'), sizes = new Map();
  for (const r of imgs) { const k = r.w + 'x' + r.h; sizes.set(k, (sizes.get(k) || 0) + 1); }
  const tile = [...sizes].sort((a, b) => b[1] - a[1])[0][0];   // the pack's tile size: the commonest
  const CH = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+-/<=>?@^_~', pal = new Map(), decoded = [];
  for (const r of imgs) {
    const id = idOf(r.file); if (r.w + 'x' + r.h !== tile) { r.used = ''; r.flags = 'not a ' + tile + ' tile'; continue; }
    if (outside(id)) continue; if (!wanted(id)) { r.used = ''; if (skip[id]) r.flags = 'skip'; continue; }
    const im = decodePNG(readFileSync(join(dir, r.file)));
    if ([...Array(im.w * im.h).keys()].some(i => im.rgba[i * 4 + 3] > 0 && im.rgba[i * 4 + 3] < 255)) { r.used = ''; r.flags = 'translucent'; continue; }
    if (![...Array(im.w * im.h).keys()].some(i => im.rgba[i * 4 + 3])) { r.used = ''; r.flags = 'empty'; continue; }
    for (let i = 0; i < im.w * im.h; i++) if (im.rgba[i * 4 + 3]) { const h = hex([im.rgba[i * 4], im.rgba[i * 4 + 1], im.rgba[i * 4 + 2]]); pal.set(h, (pal.get(h) || 0) + 1); }
    decoded.push([r, id, im]);
  }
  if (pal.size > CH.length) { console.error(set + ': ' + pal.size + ' colors, more than the ' + CH.length + ' characters a pack palette has'); process.exit(1); }
  const chOf = new Map([...pal].sort((a, b) => b[1] - a[1]).map(([h], i) => [h, CH[i]]));
  for (const [r, id, im] of decoded) {
    const rows = [], colors = {};
    for (let y = 0; y < im.h; y++) { let s = ''; for (let x = 0; x < im.w; x++) { const i = (y * im.w + x) * 4; if (!im.rgba[i + 3]) { s += '.'; continue; } const h = hex([im.rgba[i], im.rgba[i + 1], im.rgba[i + 2]]), ch = chOf.get(h); colors[ch] = h; s += ch; } rows.push(s); }
    const c = Array.isArray(cat[id]) ? cat[id] : null;
    entries[id] = { about: c ? c[1] : id.replace(/-/g, ' '), tags: c ? c[0] : '', rows, colors, src: r.src, orig: r.file.split('/').slice(1).join('/'), fit: 0 };
    r.fit = '0'; r.used = '1'; r.flags = '';
  }
  console.log(`  ${decoded.length} sprites of ${tile}, one palette of ${pal.size} colors`);
}

/* =================== PBR sets -> materials =================== */
if (kind === 'materials') {
  const FAMILY = [[/^bricks/, 'bricks'], [/^(woodfloor|planks|woodsiding|wood)/, 'planks'], [/^(pavingstones|rock|cobble|stonewall)/, 'stones'], [/^(tiles|tile)/, 'tiles'], [/^(metalplates|metal|diamondplate|corrugatedsteel|rust)/, 'metal'],
    [/^roofingtiles/, 'shingles'], [/^(fabric|carpet|leather|wicker)/, 'cloth'], [/^(grass|foliage|moss|ground0(3|4))/, 'foliage'], [/^bark/, 'bark'], [/^(marble|concrete|plaster|asphalt|snow|ice)/, 'noise'], [/^(ground|sand|terrazzo|gravel)/, 'speck'], [/^thatch/, 'thatch']];
  const LIFE = 2;   // drawn twice life, as props are
  const { chromium } = await import('playwright'), browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }), page = await browser.newPage();
  // a JPEG (or PNG) decoded by Chromium, shrunk to at most 1024 pixels a side
  const decode = async f => { const b64 = readFileSync(f).toString('base64'); return page.evaluate(async ([d, t]) => { const bm = await createImageBitmap(await (await fetch('data:image/' + t + ';base64,' + d)).blob()), k = Math.min(1, 1024 / Math.max(bm.width, bm.height)), w = Math.round(bm.width * k), h = Math.round(bm.height * k), c = new OffscreenCanvas(w, h), g = c.getContext('2d'); g.drawImage(bm, 0, 0, w, h); const px = g.getImageData(0, 0, w, h).data; let s = ''; for (let i = 0; i < px.length; i += 32768) s += String.fromCharCode.apply(null, px.subarray(i, i + 32768)); return { w, h, b64: btoa(s) }; }, [b64, /png$/i.test(f) ? 'png' : 'jpeg']).then(r => ({ w: r.w, h: r.h, rgba: new Uint8Array(Buffer.from(r.b64, 'base64')) })); };   // (pixels back as base64: a JSON array of millions of numbers is slow)
  const ramp = im => {
    const P = []; for (let y = 0; y < im.h; y += 4) for (let x = 0; x < im.w; x += 4) { const i = (y * im.w + x) * 4; P.push([im.rgba[i], im.rgba[i + 1], im.rgba[i + 2]]); }
    P.sort((a, b) => lum(a) - lum(b)); let C = [0, 1, 2, 3, 4].map(k => P[Math.floor((k + .5) / 5 * P.length)].slice());
    for (let it = 0; it < 20; it++) { const S = C.map(() => [0, 0, 0, 0]); for (const p of P) { let b = 0, bd = 1e9; for (let k = 0; k < 5; k++) { const d = (p[0] - C[k][0]) ** 2 + (p[1] - C[k][1]) ** 2 + (p[2] - C[k][2]) ** 2; if (d < bd) { bd = d; b = k; } } S[b][0] += p[0]; S[b][1] += p[1]; S[b][2] += p[2]; S[b][3]++; } C = C.map((c, k) => S[k][3] ? [S[k][0] / S[k][3], S[k][1] / S[k][3], S[k][2] / S[k][3]] : c); }
    return C.sort((a, b) => lum(a) - lum(b));
  };
  // the joints' period along x (axis 0) or y (1), in pixels: the steepest few percent of a line's slope are joint events
  // (merged within 1/100 of the image); of a few cuts, the one whose lines agree best. { lag, n }
  const joints = (im, axis) => {
    const W = im.w, H = im.h, L = new Float32Array(W * H); for (let i = 0; i < W * H; i++) L[i] = lum(im.rgba, i * 4);
    const n0 = axis ? H : W, m0 = axis ? W : H, at = (i, j) => axis ? L[i * W + j] : L[j * W + i], G = [];
    for (let j = 0; j < m0; j += 2) for (let i = 2; i < n0 - 2; i++) G.push(Math.abs(at(i + 2, j) - at(i - 2, j)));
    const sorted = Float32Array.from(G).sort(), gap = Math.max(3, Math.round(n0 / 100)); let best = { lag: 0, n: 0, spread: 1e9 };
    for (const q of [.92, .94, .96, .975, .985]) {
      const cut = sorted[Math.floor(sorted.length * q)], counts = [];
      for (let j = 0; j < m0; j += 2) { let c = 0, last = -1e9; for (let i = 2; i < n0 - 2; i++) if (Math.abs(at(i + 2, j) - at(i - 2, j)) > cut) { if (i - last > gap) c++; last = i; } if (c > 0) counts.push(c); }
      if (counts.length < m0 / 8) continue;
      counts.sort((a, b) => a - b); const n = counts[counts.length >> 1], mad = counts.map(c => Math.abs(c - n)).sort((a, b) => a - b)[counts.length >> 1];
      if (n > 1 && mad / n < best.spread) best = { lag: n0 / n, n, spread: mad / n };
    }
    return best;
  };
  const shrink = (im, w, h) => { const out = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const x0 = Math.floor(x * im.w / w), x1 = Math.max(x0 + 1, Math.floor((x + 1) * im.w / w)), y0 = Math.floor(y * im.h / h), y1 = Math.max(y0 + 1, Math.floor((y + 1) * im.h / h)), s = [0, 0, 0]; let n = 0; for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const i = (yy * im.w + xx) * 4; s[0] += im.rgba[i]; s[1] += im.rgba[i + 1]; s[2] += im.rgba[i + 2]; n++; } out.set([s[0] / n, s[1] / n, s[2] / n, 255], (y * w + x) * 4); } return { w, h, rgba: out }; };
  const stats = im => { let m = 0, v = 0; const n = im.w * im.h, c = [0, 0, 0]; for (let i = 0; i < n; i++) m += lum(im.rgba, i * 4); m /= n; for (let i = 0; i < n; i++) { v += (lum(im.rgba, i * 4) - m) ** 2; for (let k = 0; k < 3; k++) c[k] += im.rgba[i * 4 + k] / n; } return { mean: c, sd: Math.sqrt(v / n) }; };
  // our material on a flat face lit evenly, k pixels a unit (the engine's own pattern and ramp)
  const render = (m, w, h, k) => { const mt = E.material(m), out = new Uint8ClampedArray(w * h * 4), s = { u: 0, v: 0, W: w / k, H: h / k, lid: false, curved: false, lit: .5, px: 1 / k, part: 0, nz: 0, z: 8 }; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { s.u = (x + .5) / k; s.v = (h - y - .5) / k; const c = mt.ramp[Math.max(0, Math.min(4, 2 + mt.pat(s, mt.q)))]; out.set([c[0], c[1], c[2], 255], (y * w + x) * 4); } return { w, h, rgba: out }; };
  for (const [key, rec] of Object.entries(sources)) {
    const src = rec.dir, id = src.toLowerCase();
    if (outside(id)) continue; if (!wanted(id)) { for (const r of ledger) if (r.src === key) { r.used = ''; if (skip[id]) r.flags = 'skip'; } continue; }
    const base = join(dir, src), files = existsSync(base) ? (await import('node:fs')).readdirSync(base) : [], pick = re => files.find(f => re.test(f));
    const cf = pick(/_Color\.(jpg|png)$/i), hf = pick(/_Displacement\.(jpg|png)$/i);
    const row = ledger.find(r => r.src === key && cf && r.file.endsWith(cf)); if (!cf) { console.log('  ' + id + ': no color map'); continue; }
    const fam = (FAMILY.find(([re]) => re.test(id)) || [0, 'noise'])[1], col = await decode(join(base, cf)), disp = hf ? await decode(join(base, hf)) : col;
    const R = ramp(col), t = E.tones(hex(R[2])), tr = [t.deep, t.sh, t.base, t.lt, t.hi].map(E.hex);
    const miss = R.reduce((a, c, k) => { const p = lab(c), q = lab(tr[k]); return a + Math.hypot(p[1] - q[1], p[2] - q[2]); }, 0) / 5;
    const [wcm, hcm] = rec.dims && rec.dims[0] ? rec.dims : [200, 200], upx = wcm / 100 * 16 * LIFE / disp.w, vpx = hcm / 100 * 16 * LIFE / disp.h;
    const px = joints(disp, 0), py = joints(disp, 1), U = px.lag * upx, V = py.lag * vpx, ok = v => v > .5 && v < 64;
    const m = { color: hex(R[2]), pattern: fam };
    if (fam === 'bricks' && ok(U) && ok(V)) { m.bw = r1(U); m.bh = r1(V); }
    else if (fam === 'planks' && ok(U) && ok(V)) { const across = py.n >= px.n; m.bw = r1(across ? V : U); m.len = r1(across ? U : V); if (!across) m.dir = 'v'; }
    else if (fam === 'stones' && ok(U + V)) m.size = r1((U + V) / 2);
    else if (fam === 'tiles' && ok(Math.min(U, V))) m.size = r1(Math.min(U, V));
    else if (fam === 'shingles' && ok(U) && ok(V)) { m.bw = r1(U); m.course = r1(V); }
    else if (fam === 'metal' && /^metalplates/.test(id) && px.n > 1 && Math.min(U, V) >= 6 && Math.min(U, V) <= 24) m.rivet = r1(Math.min(U, V));   // (rivets on riveted plates only, far enough apart to read)
    if (miss > 8) m.ramp = R.map((c, k) => hex(unlab([lab(tr[k])[0], lab(c)[1], lab(c)[2]])));
    const gw = Math.round(wcm / 100 * 16 * LIFE * 1.5), gh = Math.round(hcm / 100 * 16 * LIFE * 1.5), sc = shrink(col, Math.max(8, gw), Math.max(8, gh)), ours = render(m, sc.w, sc.h, 1.5), a = stats(sc), b = stats(ours);
    const sim = (x, y) => x && y ? Math.min(x, y) / Math.max(x, y) : x === y ? 1 : 0, pa = [joints(sc, 0).lag, joints(sc, 1).lag], pb = [joints(ours, 0).lag, joints(ours, 1).lag];
    const fit = { dE: Math.round(dE(a.mean, b.mean)), structure: r2((sim(pa[0], pb[0]) + sim(pa[1], pb[1])) / 4 + sim(a.sd, b.sd) / 2) };
    const c = Array.isArray(cat[id]) ? cat[id] : null;
    entries[id] = Object.assign(m, { about: c ? c[1] : (rec.tags || src).split(' ').filter(w => !/^\d+$/.test(w) && w !== id).slice(0, 6).join(' '), tags: c ? c[0] : fam, src: key, orig: src, fit });
    if (row) { row.fit = fit.dE + '/' + fit.structure; row.used = '1'; }
    report.push([id, fam, tok(js(m)), fit.dE, fit.structure]);
    console.log(`  ${id.padEnd(22)} ${fam.padEnd(9)} ${js(Object.fromEntries(Object.entries(m).filter(([k]) => !['about', 'tags', 'src', 'orig', 'fit'].includes(k))))}  dE ${fit.dE}, structure ${fit.structure}`);
  }
  await browser.close();
}

/* =================== the set, the ledger, the source records =================== */
// a kit's materials: only those the set's shapes use (an entry left out for its fit took its colors with it)
if (kind === 'shapes') { const used = new Set(Object.values(entries).flatMap(e => Object.values(e.mats))); for (const k of Object.keys(setMats)) if (!used.has(k)) delete setMats[k]; }
const usedSrc = new Set(Object.values(entries).map(e => e.src)), S = { set, credit, sources: Object.fromEntries(Object.entries(sources).filter(([k]) => usedSrc.has(k))), materials: kind === 'shapes' ? setMats : kind === 'materials' ? entries : {}, shapes: kind === 'shapes' ? entries : {}, sprites: kind === 'sprites' ? entries : {} };
const out = opt('out') || join(root, 'src/assets/sets', set + '.js');
// a re-import of only some ids keeps the set's other entries
if (only && existsSync(out)) { const old = readSet(out); for (const k of ['materials', 'shapes', 'sprites']) S[k] = Object.assign({}, old[k], S[k]); for (const id of dropped) delete S.shapes[id]; Object.assign(S.sources, old.sources); }
const text = writeSet(S, out);
writeLedger(set, ledger); writeCatalog(set, cat);
const n = Object.keys(entries).length, fits = Object.values(S.shapes).map(e => e.fit.iou);
console.log(`wrote ${out}: ${n} ${kind}${kind === 'shapes' ? `, ${Object.keys(setMats).length} materials, mean IoU ${r2(fits.reduce((a, b) => a + b, 0) / (fits.length || 1))}` : ''}, ${(text.length / 1024).toFixed(0)} KB, ${tok(text)} tokens; ledger src/assets/catalogs/${set}.tsv`);
