// Shared by the asset tools (tools/asset-*.mjs): the engine in this process, the license allowlist, the catalogs and
// ledgers (src/assets/catalogs/), set files (src/assets/sets/), and readers for glTF binaries and PNGs. docs/ASSET-IMPORT.md
// says how they fit together.
import { readFileSync, writeFileSync, existsSync, mkdirSync, openSync, readSync, closeSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import vm from 'node:vm';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
/** the full engine's file: the repository's, or the handoff package's (its engine sits at the top, beside src/assets/) */
export const engineFile = ['engine/my-3d2dge.js', 'my-3d2dge.js'].map(f => join(root, f)).find(f => existsSync(f)) || join(root, 'engine/my-3d2dge.js');
/** the only licenses the store takes (the assets suite fails on any other) */
export const LICENSES = ['CC0 1.0', 'Public Domain Mark 1.0'];
export const cacheDir = lib => join(root, '.cache/assets', lib);
export const catalogFile = lib => join(root, 'src/assets/catalogs', lib + '.json');
export const ledgerFile = lib => join(root, 'src/assets/catalogs', lib + '.tsv');
let tokens = s => Math.ceil(s.length / 3.2); try { const { encode } = await import('gpt-tokenizer/encoding/cl100k_base'); tokens = s => encode(s).length; } catch (e) { /* estimated */ }
/** cl100k tokens of a text (estimated without gpt-tokenizer) */
export const tok = s => tokens(s);

/** the full engine, run in this process (a vm context's globals are slow for the rasterizer): My3D2dge */
let _E = null;
export function engine() {
  if (_E) return _E;
  globalThis.window = globalThis.window || globalThis;
  vm.runInThisContext(readFileSync(engineFile, 'utf8'), { filename: engineFile });
  return (_E = globalThis.My3D2dge);
}

/* ---- catalogs: hand-written "id": ["tags", "what it looks like"], with $sources, $skip { id: reason }, $mats { kit color:
 * core material whose pattern it takes } and $pick ---- */
export function readCatalog(lib) { const f = catalogFile(lib); return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {}; }
/** one key a line: $sources (one record a line), $skip, $pick, then the entries */
export function writeCatalog(lib, cat) {
  mkdirSync(dirname(catalogFile(lib)), { recursive: true });
  const lines = [], obj = o => '{\n' + Object.entries(o).map(([k, v]) => '    ' + JSON.stringify(k) + ': ' + JSON.stringify(v)).join(',\n') + '\n  }';
  for (const k of ['$sources', '$skip', '$mats']) if (cat[k] && Object.keys(cat[k]).length) lines.push('  ' + JSON.stringify(k) + ': ' + obj(cat[k]));
  if (cat.$pick) lines.push('  "$pick": ' + JSON.stringify(cat.$pick));
  for (const [k, v] of Object.entries(cat)) if (k[0] !== '$') lines.push('  ' + JSON.stringify(k) + ': ' + JSON.stringify(v));
  writeFileSync(catalogFile(lib), '{\n' + lines.join(',\n') + '\n}\n');
}

/* ---- ledgers: one row per file of a source, tab-separated; the note column is a person's and survives re-surveys ---- */
export const LEDGER = ['src', 'file', 'bytes', 'kind', 'tris', 'mats', 'w', 'h', 'fit', 'used', 'flags', 'note'];
export function readLedger(lib) {
  const f = ledgerFile(lib); if (!existsSync(f)) return [];
  const [head, ...rows] = readFileSync(f, 'utf8').split('\n').filter(Boolean), cols = head.split('\t');
  return rows.map(r => Object.fromEntries(r.split('\t').map((v, i) => [cols[i], v])));
}
export function writeLedger(lib, rows) {
  mkdirSync(dirname(ledgerFile(lib)), { recursive: true });
  writeFileSync(ledgerFile(lib), [LEDGER.join('\t'), ...rows.map(r => LEDGER.map(c => String(r[c] === undefined ? '' : r[c]).replace(/[\t\n]/g, ' ')).join('\t'))].join('\n') + '\n');
}
/** what a ledger records of a file: a model's triangles and materials, an image's size; null for files the store ignores
 *  (other model formats, a kit's preview renders) */
export function surveyFile(p) {
  const ext = extname(p).toLowerCase(), name = p.split('/').pop();
  if (ext === '.glb' || ext === '.gltf') { try { const g = readGlb(p, { noTextures: true }); return { kind: 'model', tris: g.tris.length, mats: g.materials }; } catch (e) { return { kind: 'model', flags: 'unreadable' }; } }
  if (/^(preview|sample|thumbnail)/i.test(name) || /\/(Previews?|Isometric|Side|Textures?)\//i.test(p)) return null;   // (a kit's renders and its palette)
  if (ext === '.png') { const b = head(p, 33); return b.readUInt32BE(12) === 0x49484452 ? { kind: 'image', w: b.readUInt32BE(16), h: b.readUInt32BE(20) } : null; }
  if (ext === '.jpg' || ext === '.jpeg') { const s = jpegSize(p); return s ? { kind: 'image', w: s[0], h: s[1] } : null; }
  return null;
}
const head = (p, n) => { const fd = openSync(p, 'r'), b = Buffer.alloc(n); readSync(fd, b, 0, n, 0); closeSync(fd); return b; };
function jpegSize(p) {
  const b = readFileSync(p); let o = 2;
  while (o < b.length) { if (b[o] !== 0xff) return null; const m = b[o + 1], len = b.readUInt16BE(o + 2); if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [b.readUInt16BE(o + 7), b.readUInt16BE(o + 5)]; o += 2 + len; }
  return null;
}

/* ---- set files: (window.ASSETS = window.ASSETS || {})['name'] = { set, format: 1, credit, sources, materials, shapes, sprites } ---- */
/** a set file -> its object */
export function readSet(file) {
  const sb = { window: {} }; vm.runInNewContext(readFileSync(file, 'utf8'), sb, { filename: String(file) });
  const names = Object.keys(sb.window.ASSETS || {}); if (names.length !== 1) throw new Error(file + ' should define one set (found ' + names.length + ')');
  return JSON.parse(JSON.stringify(sb.window.ASSETS[names[0]]));   // (plain objects, out of the sandbox's realm)
}
/** a value as dense JavaScript: bare keys, single-quoted strings, no spaces (the card's style: a third fewer tokens) */
export function js(v) {
  if (Array.isArray(v)) return '[' + v.map(js).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => (/^([A-Za-z_$][\w$]*|[1-9]\d*|0)$/.test(k) ? k : "'" + k.replace(/'/g, "\\'") + "'") + ':' + js(x)).join(',') + '}';
  if (typeof v === 'string') return "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'";
  return String(v);
}
/** writes a set: a header (its credit, counts and the card), then one line per material, shape and sprite */
export function writeSet(s, out) {
  const n = k => Object.keys(s[k] || {}).length, block = k => '{\n' + Object.entries(s[k] || {}).map(([id, e]) => (/^[A-Za-z_$][\w$]*$/.test(id) ? id : "'" + id + "'") + ': ' + js(e)).join(',\n') + '}';
  const text = `/* ${s.set}: a set of my-3D2dge's asset store (written by tools/asset-*.mjs; entries may be edited by hand).
 * ${s.credit}
 * ${n('shapes')} shapes, ${n('materials')} materials, ${n('sprites')} sprites. docs/ASSETS.md is the format; docs/ASSET-IMPORT.md how it was made.
 * "sources" records each download (its url, date, sha256 and license); an entry's src names its download, orig the file in
 * it, and fit how close it is: a shape's silhouette IoU at game scale (mean and worst view) and color dE.
 * Load it with E.addAssets(window.ASSETS[${js(s.set)}]): its ids become '${s.set}:id'. */
(window.ASSETS = window.ASSETS || {})[${js(s.set)}] = { set: ${js(s.set)}, format: 1, credit: ${js(s.credit)},
sources: ${js(s.sources || {})},
materials: ${block('materials')},
shapes: ${block('shapes')},
sprites: ${block('sprites')}};
`;
  mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, text); return text;
}

/* ---- PNG (8 or 16 bits, not interlaced; 16-bit samples keep their high byte) ---- */
export function decodePNG(buf) {
  let o = 8, w = 0, h = 0, ct = 0, bd = 8, pal = null, trns = null; const idat = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o), type = buf.toString('ascii', o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + len); o += 12 + len;
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bd = d[8]; if (![1, 2, 4, 8, 16].includes(bd) || d[12]) throw new Error('PNG: interlaced'); ct = d[9]; }
    else if (type === 'PLTE') pal = d; else if (type === 'tRNS') trns = d; else if (type === 'IDAT') idat.push(d); else if (type === 'IEND') break;
  }
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ct], bits = ch * bd, bpp = Math.max(1, bits >> 3), raw = zlib.inflateSync(Buffer.concat(idat)), stride = Math.ceil(w * bits / 8), px = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), row = px.subarray(y * stride, (y + 1) * stride), up = y ? px.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? row[x - bpp] : 0, b = up ? up[x] : 0, c = up && x >= bpp ? up[x - bpp] : 0;
      let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      row[x] = v & 255;
    }
  }
  // a sample: low bit depths packed high bit first; a 16-bit sample keeps its high byte
  const at = (i, c) => { const y = (i / w) | 0, x = i % w; if (bd >= 8) return px[y * stride + (x * ch + c) * (bd >> 3)]; const bit = (x * ch + c) * bd; return (px[y * stride + (bit >> 3)] >> (8 - bd - (bit & 7))) & ((1 << bd) - 1); };
  const rgba = new Uint8Array(w * h * 4), scale = bd < 8 && ct !== 3 ? 255 / ((1 << bd) - 1) : 1;
  for (let i = 0; i < w * h; i++) {
    let r, g, b, al = 255;
    if (ct === 3) { const k = at(i, 0); r = pal[k * 3]; g = pal[k * 3 + 1]; b = pal[k * 3 + 2]; if (trns && k < trns.length) al = trns[k]; }
    else if (ct === 0 || ct === 4) { r = g = b = Math.round(at(i, 0) * scale); if (ct === 4) al = at(i, 1); else if (trns && at(i, 0) === trns.readUInt16BE(0) >> (bd === 16 ? 8 : 0)) al = 0; }
    else { r = at(i, 0); g = at(i, 1); b = at(i, 2); if (ct === 6) al = at(i, 3); else if (trns && r === trns[1] && g === trns[3] && b === trns[5]) al = 0; }
    rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = al;
  }
  return { w, h, rgba };
}

/* ---- glTF (binary .glb, or .gltf with its buffer): every triangle in game units (z up, 16 a metre, the front toward +y),
 * with its color. o: { noTextures, srgbFactors (a library that writes its colors' factors as sRGB) } ---- */
export function readGlb(file, o = {}) {
  const buf = readFileSync(file); let G = null, bin = null;
  if (/\.gltf$/i.test(file)) {   // a .gltf: the JSON, its buffer beside it (or inline as a data: URI)
    G = JSON.parse(buf.toString('utf8')); const u = G.buffers && G.buffers[0] && G.buffers[0].uri;
    bin = !u ? Buffer.alloc(0) : u.startsWith('data:') ? Buffer.from(u.slice(u.indexOf(',') + 1), 'base64') : readFileSync(join(dirname(file), decodeURIComponent(u)));
  } else {
    if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(file + ': not a .glb');
    let off = 12; while (off < buf.length) { const len = buf.readUInt32LE(off), type = buf.readUInt32LE(off + 4), data = buf.subarray(off + 8, off + 8 + len); if (type === 0x4e4f534a) G = JSON.parse(data.toString('utf8')); else bin = data; off += 8 + len; }
  }
  const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }, dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const RD = { 5126: [4, q => dv.getFloat32(q, true)], 5123: [2, q => dv.getUint16(q, true)], 5125: [4, q => dv.getUint32(q, true)], 5121: [1, q => dv.getUint8(q)] };
  const acc = i => { const a = G.accessors[i], bv = G.bufferViews[a.bufferView], [b, rd] = RD[a.componentType], n = SIZE[a.type], start = (bv.byteOffset || 0) + (a.byteOffset || 0), st = bv.byteStride || n * b, out = [];
    for (let k = 0; k < a.count; k++) { const row = []; for (let c = 0; c < n; c++) row.push(rd(start + k * st + c * b)); out.push(n === 1 ? row[0] : row); } return out; };
  // textures: a kit's palette (colormap.png), read from the file the glTF names beside it, or embedded
  const near = u => [join(dirname(file), u), ...['texture', 'textures', 'Textures'].map(d => join(dirname(file), '..', d, u)), join(dirname(file), 'Textures', u)].find(existsSync) || join(dirname(file), u);   // (beside it, or in the kit's texture folder)
  const images = o.noTextures ? [] : (G.images || []).map(im => { try { if (im.uri) return decodePNG(readFileSync(near(decodeURIComponent(im.uri))));
    if (im.bufferView !== undefined && /png/.test(im.mimeType || '')) { const bv = G.bufferViews[im.bufferView]; return decodePNG(Buffer.from(bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength))); } } catch (e) { /* unreadable: flat colors */ } return null; });
  const mats = (G.materials || []).map(m => { const p = m.pbrMetallicRoughness || {}, f = p.baseColorFactor || [1, 1, 1, 1], t = p.baseColorTexture;
    // (the spec's factors are linear; o.srgbFactors reads them as sRGB, as Kenney's exporter writes them: its renders agree)
    const lin = v => o.srgbFactors ? v : Math.pow(v, 1 / 2.2);
    return { name: m.name || '', rgb: f.slice(0, 3).map(v => Math.round(255 * lin(v))), tex: t && G.textures ? images[G.textures[t.index].source] : null, factor: f.map(lin) }; });
  const mul = (A, B) => { const C = new Array(16).fill(0); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) for (let k = 0; k < 4; k++) C[c * 4 + r] += A[k * 4 + r] * B[c * 4 + k]; return C; };
  const local = n => { if (n.matrix) return n.matrix; const t = n.translation || [0, 0, 0], q = n.rotation || [0, 0, 0, 1], s = n.scale || [1, 1, 1], [x, y, z, w] = q;
    return [(1 - 2 * (y * y + z * z)) * s[0], 2 * (x * y + z * w) * s[0], 2 * (x * z - y * w) * s[0], 0, 2 * (x * y - z * w) * s[1], (1 - 2 * (x * x + z * z)) * s[1], 2 * (y * z + x * w) * s[1], 0, 2 * (x * z + y * w) * s[2], 2 * (y * z - x * w) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0, t[0], t[1], t[2], 1]; };
  const tris = [];
  const walk = (ni, M) => { const n = G.nodes[ni], W = mul(M, local(n));
    if (n.mesh !== undefined) for (const p of G.meshes[n.mesh].primitives) {
      if (p.mode !== undefined && p.mode !== 4) continue;   // (triangles only)
      const P = acc(p.attributes.POSITION), UV = p.attributes.TEXCOORD_0 !== undefined && !o.noTextures ? acc(p.attributes.TEXCOORD_0) : null, I = p.indices !== undefined ? acc(p.indices) : P.map((_, i) => i), m = mats[p.material || 0] || { rgb: [200, 200, 200] };
      // glTF (x right, y up, z toward the viewer) -> game (x east, y south, z up), metres -> units: the front faces south
      const tf = v => { const x = W[0] * v[0] + W[4] * v[1] + W[8] * v[2] + W[12], y = W[1] * v[0] + W[5] * v[1] + W[9] * v[2] + W[13], z = W[2] * v[0] + W[6] * v[1] + W[10] * v[2] + W[14]; return [x * 16, z * 16, y * 16]; };
      for (let i = 0; i + 2 < I.length; i += 3) {
        let rgb = m.rgb;
        if (m.tex && UV) { const u = (UV[I[i]][0] + UV[I[i + 1]][0] + UV[I[i + 2]][0]) / 3, v = (UV[I[i]][1] + UV[I[i + 1]][1] + UV[I[i + 2]][1]) / 3, T = m.tex;
          const x = Math.min(T.w - 1, Math.max(0, Math.floor((u - Math.floor(u)) * T.w))), y = Math.min(T.h - 1, Math.max(0, Math.floor((v - Math.floor(v)) * T.h))), k = (y * T.w + x) * 4;
          rgb = [T.rgba[k], T.rgba[k + 1], T.rgba[k + 2]].map((c, j) => Math.round(c * (m.factor ? m.factor[j] : 1))); }
        tris.push({ rgb, mat: m.name, v: [tf(P[I[i]]), tf(P[I[i + 1]]), tf(P[I[i + 2]])] });
      }
    }
    for (const c of n.children || []) walk(c, W); };
  for (const r of G.scenes[G.scene || 0].nodes) walk(r, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  return { tris, materials: (G.materials || []).length };
}
