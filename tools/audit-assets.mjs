import { readFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative, join, sep, extname } from 'node:path';

const argv = process.argv.slice(2);
const root = resolve(argv.includes('--root') ? argv[argv.indexOf('--root') + 1] : '.');
const failures = [];
const requireText = (entry, field, label) => {
  const value = entry[field];
  if (typeof value !== 'string' || !value.trim() || /^(tbd|todo|unknown|pending|placeholder|unlicensed)$/i.test(value.trim())) failures.push(`${label}: missing or placeholder ${field}`);
};
const hash = buffer => createHash('sha256').update(buffer).digest('hex');
async function files(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isSymbolicLink()) { failures.push(`Symlink is not a portable runtime asset: ${relative(root, path)}`); continue; }
    if (entry.isDirectory()) result.push(...await files(path));
    else result.push(path);
  }
  return result;
}
let manifest;
try { manifest = JSON.parse(await readFile(join(root, 'assets/manifest.json'), 'utf8')); }
catch (error) { console.error(`Asset audit failed: ${error.message}`); process.exit(1); }
if (manifest.version !== 1) failures.push('assets/manifest.json must use version 1');
if (!Array.isArray(manifest.assets) || !manifest.assets.length) failures.push('Asset manifest must contain a nonempty assets array');
const ids = new Set(), listed = new Set();
let bytes = 0;
for (const entry of manifest.assets || []) {
  const label = entry.id || entry.path || 'unnamed entry';
  for (const field of ['id', 'path', 'source', 'author', 'license']) requireText(entry, field, label);
  if (ids.has(entry.id)) failures.push(`${label}: duplicate ID`);
  ids.add(entry.id);
  if (typeof entry.path !== 'string') continue;
  const path = resolve(root, entry.path);
  if (path === root || !path.startsWith(root + sep) || entry.path.includes('\\')) { failures.push(`${label}: path must be portable and inside the project`); continue; }
  listed.add(path);
  if (!/^[a-f0-9]{64}$/i.test(entry.sha256 || '')) { failures.push(`${label}: sha256 must contain 64 hexadecimal digits`); continue; }
  try {
    const contents = await readFile(path);
    if (hash(contents) !== entry.sha256.toLowerCase()) failures.push(`${label}: SHA-256 does not match ${entry.path}`);
    bytes += contents.length;
  } catch (error) { failures.push(`${label}: cannot read ${entry.path} (${error.code})`); }
}
try {
  for (const path of await files(join(root, 'assets'))) {
    if (path.endsWith(sep + 'manifest.json')) continue;
    if (!listed.has(path)) failures.push(`Unlisted asset: ${relative(root, path)}`);
  }
} catch (error) { failures.push(`Cannot enumerate assets: ${error.message}`); }
// Runtime must remain local. Attribution URLs in manifests and notices are expected.
const runtimeFiles = [];
try { runtimeFiles.push(join(root, 'index.html'), ...await files(join(root, 'src'))); }
catch (error) { failures.push(`Cannot enumerate runtime sources: ${error.message}`); }
for (const file of runtimeFiles) {
  if (!['.html', '.css', '.js', '.mjs'].includes(extname(file))) continue;
  const source = await readFile(file, 'utf8');
  if (/(?:\b(?:src|href)\s*=\s*["']https?:|\b(?:import\s*\(|fetch\s*\()\s*["']https?:|\bfrom\s*["']https?:|\burl\(\s*["']?https?:)/i.test(source)) failures.push(`Remote runtime resource: ${relative(root, file)}`);
}
try { if (!(await stat(join(root, 'THIRD-PARTY-NOTICES.md'))).isFile()) failures.push('THIRD-PARTY-NOTICES.md is missing'); }
catch { failures.push('THIRD-PARTY-NOTICES.md is missing'); }
if (failures.length) {
  console.error(`Asset audit failed (${failures.length} issue${failures.length === 1 ? '' : 's'}):\n${failures.map(f => `- ${f}`).join('\n')}`);
  process.exitCode = 1;
} else console.log(`Asset audit passed: ${ids.size} attributed entries, ${(bytes / 1048576).toFixed(2)} MiB, all hashes verified; no remote runtime dependencies.`);
