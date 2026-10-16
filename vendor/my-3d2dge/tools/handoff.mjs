// The handoff package for coding agents (dist/handoff/, written by node tools/build.mjs; the site serves it at /handoff/).
//   node tools/handoff.mjs                 list what the package holds, and check it is current and text only
//   node tools/handoff.mjs --zip <file>    zip it, to upload to a chat (a path outside the repository: the repository keeps
//                                          no binary files, DOCTRINE.md principle 4)
// The zip is a plain one (deflate, no dependencies): every unzip tool reads it.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..'), H = join(root, 'dist/handoff');
const args = process.argv.slice(2), zipTo = args.includes('--zip') ? args[args.indexOf('--zip') + 1] : null;
if (!existsSync(H)) { console.error('dist/handoff/ is missing: run node tools/build.mjs'); process.exit(1); }
const files = [];
const walk = d => { for (const f of readdirSync(d).sort()) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else files.push(p); } };
walk(H);
const binary = files.filter(f => readFileSync(f).subarray(0, 8192).includes(0));
if (binary.length) { console.error('the package must be text only: ' + binary.map(f => relative(H, f)).join(', ')); process.exit(1); }
let total = 0;
for (const f of files) total += statSync(f).size;
console.log(`dist/handoff/: ${files.length} files, ${(total / 1024).toFixed(0)} KB, text only`);
for (const f of files) console.log('  ' + relative(H, f));
if (!zipTo) process.exit(0);

const out = resolve(zipTo);
if (!relative(root, out).startsWith('..')) { console.error(`--zip ${zipTo}: write the zip outside the repository (it is a binary file)`); process.exit(2); }
// CRC-32 (the zip format's checksum)
const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = buf => { let c = 0xFFFFFFFF; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const parts = [], central = []; let offset = 0;
for (const f of files) {
  const name = Buffer.from('my-3d2dge-handoff/' + relative(H, f).split('\\').join('/')), data = readFileSync(f), packed = deflateRawSync(data, { level: 9 }), crc = crc32(data);
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
  local.writeUInt32LE(0, 10); local.writeUInt32LE(crc, 14); local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26);
  const cen = Buffer.alloc(46); cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(8, 10);
  cen.writeUInt32LE(0, 12); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(packed.length, 20); cen.writeUInt32LE(data.length, 24); cen.writeUInt16LE(name.length, 28); cen.writeUInt32LE(offset, 42);
  parts.push(local, name, packed); central.push(cen, name); offset += 30 + name.length + packed.length;
}
const cdir = Buffer.concat(central), end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cdir.length, 12); end.writeUInt32LE(offset, 16);
writeFileSync(out, Buffer.concat([...parts, cdir, end]));
console.log(`wrote ${out} (${(statSync(out).size / 1024).toFixed(0)} KB): unzip it into a folder of its own, then read its README.md`);
