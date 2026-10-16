import { cp, mkdir, rm, stat, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const out = resolve('dist');
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const name of ['index.html', 'src', 'assets', 'ENGINE_VERSION', 'THIRD-PARTY-NOTICES.md']) {
  try { await stat(name); } catch { throw new Error(`Required build input missing: ${name}`); }
  await cp(name, join(out, name), { recursive: true });
}
const mainPath=join(out,'src/main.js');
let releaseMain=await readFile(mainPath,'utf8');
releaseMain=releaseMain.replace(/\s*\/\/ EWA93_DEBUG_START[\s\S]*?\/\/ EWA93_DEBUG_END/g,'');
if(/(?:window|globalThis)\.__exitWounds/.test(releaseMain))throw new Error('Unmarked diagnostic game hook remains in release main.js');
await writeFile(mainPath,releaseMain);
// Runtime vendor resources only. Source/manuals/tools remain available in the repository.
for (const name of ['engine', 'vendor']) {
  await cp(join('vendor/my-3d2dge', name), join(out, 'vendor/my-3d2dge', name), { recursive: true });
}
// Selected native assets and animation code use their original relative paths.
for (const name of ['src/assets', 'src/mocap']) {
  await cp(join('vendor/my-3d2dge', name), join(out, 'vendor/my-3d2dge', name), { recursive: true });
}
async function size(dir) {
  let bytes = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    bytes += entry.isDirectory() ? await size(p) : (await stat(p)).size;
  }
  return bytes;
}
console.log(`Built dist/ (${((await size(out)) / 1048576).toFixed(2)} MiB). All runtime resources are local.`);
