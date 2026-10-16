// Vendors the 3D lab's two libraries into vendor/ (docs/LAB-3D.md): exact versions, fetched once with npm pack, the
// files the lab loads copied out, with their sizes and sha256 checksums in VERSION.json. The lab then needs no network.
// The versions are pinned on purpose: releases the models know well (the last stable three.js of 2025, Rapier 0.19.3),
// not the newest. Upgrading is a deliberate change: edit LIBS, run this, update the import map in src/lab3d.template.html.
// Usage: node tools/vendor-3d.mjs           fetch and write vendor/ (needs npm, tar and the network)
//        node tools/vendor-3d.mjs --check   verify the files on disk against VERSION.json (no network; tools/lab3d-test.mjs runs it)
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, existsSync, rmSync, copyFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const LIBS = [
  { pkg: 'three', version: '0.182.0', dir: 'vendor/three-0.182.0', license: 'MIT', released: '2025-12-10',
    files: { 'three.core.min.js': 'build/three.core.min.js', 'three.webgpu.min.js': 'build/three.webgpu.min.js', 'three.tsl.min.js': 'build/three.tsl.min.js', LICENSE: 'LICENSE' },
    note: 'three.js r182, the last stable release of 2025. three.webgpu.min.js imports ./three.core.min.js; three.tsl.min.js imports the bare name three/webgpu, which the import map provides.' },
  { pkg: '@dimforge/rapier3d-simd-compat', version: '0.19.3', dir: 'vendor/rapier3d-simd-compat-0.19.3', license: 'Apache-2.0', released: '2025-11-05',
    files: { 'rapier.js': 'rapier.mjs' }, licenseUrl: 'https://raw.githubusercontent.com/dimforge/rapier.js/v0.19.3/LICENSE',
    note: 'Rapier 3D with WebAssembly SIMD; the compat build embeds the wasm as base64, so nothing else is fetched. rapier.js is the package\'s rapier.mjs, renamed so every static server sends it as JavaScript. Call await RAPIER.init() before use.' }
];
const sha = buf => createHash('sha256').update(buf).digest('hex');

if (process.argv.includes('--check')) {
  const bad = [];
  for (const L of LIBS) {
    const vf = join(root, L.dir, 'VERSION.json');
    if (!existsSync(vf)) { bad.push(L.dir + ': no VERSION.json'); continue; }
    const v = JSON.parse(readFileSync(vf, 'utf8'));
    if (v.version !== L.version) bad.push(`${L.dir}: VERSION.json says ${v.version}, LIBS says ${L.version}`);
    for (const [name, f] of Object.entries(v.files)) {
      const p = join(root, L.dir, name);
      if (!existsSync(p)) bad.push(L.dir + '/' + name + ': missing');
      else if (sha(readFileSync(p)) !== f.sha256) bad.push(L.dir + '/' + name + ': checksum differs from VERSION.json');
    }
  }
  if (bad.length) { console.error('vendor check FAILED:\n  ' + bad.join('\n  ')); process.exit(1); }
  console.log('vendor check passed: ' + LIBS.map(L => L.pkg + '@' + L.version).join(', '));
} else {
  const tmp = mkdtempSync(join(tmpdir(), 'vendor-3d-'));
  try {
    for (const L of LIBS) {
      const tgz = execFileSync('npm', ['pack', L.pkg + '@' + L.version, '--silent'], { cwd: tmp }).toString().trim().split('\n').pop();
      const ex = join(tmp, L.dir.replace(/\W+/g, '_')); mkdirSync(ex, { recursive: true });
      execFileSync('tar', ['xzf', join(tmp, tgz), '-C', ex]);
      const out = join(root, L.dir); rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
      const files = {};
      for (const [name, from] of Object.entries(L.files)) copyFileSync(join(ex, 'package', from), join(out, name));
      if (L.licenseUrl) writeFileSync(join(out, 'LICENSE'), execFileSync('curl', ['-fsSL', L.licenseUrl]));
      for (const name of [...Object.keys(L.files), ...(L.licenseUrl ? ['LICENSE'] : [])]) { const b = readFileSync(join(out, name)); files[name] = { bytes: b.length, sha256: sha(b) }; }
      writeFileSync(join(out, 'VERSION.json'), JSON.stringify({ package: L.pkg, version: L.version, released: L.released, license: L.license, source: 'npm pack ' + L.pkg + '@' + L.version, note: L.note, files }, null, 2) + '\n');
      console.log('vendored', L.pkg + '@' + L.version, '->', L.dir, Object.entries(files).map(([n, f]) => `${n} ${(f.bytes / 1024).toFixed(0)} KB`).join(', '));
    }
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}
