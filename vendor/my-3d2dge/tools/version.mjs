// The release number: one version for the engine, its agent edition, the docs and the games, kept in step everywhere.
// Usage: node tools/version.mjs            print the version and every place it is written
//        node tools/version.mjs --check    exit 1 when a place disagrees with package.json, the built engine files were
//                                          not rebuilt, or CHANGELOG.md has no section for it (npm test runs this first)
//        node tools/version.mjs 0.8.0      write 0.8.0 everywhere and open a CHANGELOG.md section for it (fill it in, then
//                                          run node tools/build.mjs so the pages carry it)
// Semantic versioning while the major number is 0: the minor number (0.8.0) for features, the patch (0.7.1) for fixes.
// Every change merged to main bumps it and adds its lines to CHANGELOG.md, except one confined to a prototype (a Temporary
// lab; CLAUDE.md, DOCTRINE.md). The build (which commit)
// is not written here: tools/stamp.mjs adds it to the deployed pages (My3D2dge.build, My3D2dge.versionLabel()).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SEMVER = /^\d+\.\d+\.\d+$/;
// each place the number is written: [file, pattern with the number as group 2]
const PLACES = [
  ['package.json', /("version":\s*")([^"]+)(")/],
  ['engine/my-3d2dge.js', /(\* my-3D2dge v)(\d+\.\d+\.\d+)()/],
  ['engine/my-3d2dge.js', /(const E = \{ version: ')([^']+)(')/],
  ['engine/my-3d2dge-agent.js', /(my-3D2dge AGENT EDITION v)(\d+\.\d+\.\d+)()/],
  ['engine/my-3d2dge-agent.js', /(const E = \{ version: ')([^']+)(')/],
  ['engine/my-3d2dge-3d.js', /(my-3D2dge 3D v)(\d+\.\d+\.\d+)()/],
  ['API.md', /(# my-3D2dge API card \(v)([^)]+)(\))/],
  ['AI_GUIDE.md', /(`engine\/my-3d2dge\.js` v)(\d+\.\d+\.\d+)()/],
  ['README.md', /(`My3D2dge\.version`, now \*\*)(\d+\.\d+\.\d+)(\*\*)/]
];
// copies tools/build.mjs makes: they must carry the same number (a bump without a rebuild leaves them behind)
const BUILT = [
  ['dist/my-3d2dge.js', /(const E = \{ version: ')([^']+)(')/],
  ['dist/my-3d2dge-agent.js', /(const E = \{ version: ')([^']+)(')/],
  ['dist/my-3d2dge-3d.js', /(my-3D2dge 3D v)(\d+\.\d+\.\d+)()/]
];
const read = f => readFileSync(join(root, f), 'utf8');
const found = ([file, re]) => { const m = existsSync(join(root, file)) ? re.exec(read(file)) : null; return m ? m[2] : null; };
const pkg = () => JSON.parse(read('package.json')).version;
const changelogHas = v => existsSync(join(root, 'CHANGELOG.md')) && new RegExp('^## ' + v.replaceAll('.', '\\.') + '\\b', 'm').test(read('CHANGELOG.md'));

const arg = process.argv[2];
if (arg === '--check') {
  const v = pkg(), bad = [];
  if (!SEMVER.test(v)) bad.push(`package.json: "${v}" is not a version like 0.7.0`);
  for (const p of PLACES) { const got = found(p); if (got !== v) bad.push(`${p[0]}: ${got === null ? 'no version found' : got} (package.json says ${v})`); }
  for (const p of BUILT) { const got = found(p); if (got !== v) bad.push(`${p[0]}: ${got === null ? 'no version found' : got}; run node tools/build.mjs`); }
  if (!changelogHas(v)) bad.push(`CHANGELOG.md: no "## ${v}" section; add what this release changed`);
  if (bad.length) { console.error('version check FAILED:\n  ' + bad.join('\n  ')); process.exit(1); }
  console.log(`version ok: ${v} in ${PLACES.length + BUILT.length} places, CHANGELOG.md has its section`);
} else if (arg && !arg.startsWith('-')) {
  if (!SEMVER.test(arg)) { console.error(`"${arg}" is not a version like 0.8.0`); process.exit(1); }
  const was = pkg();
  for (const [file, re] of PLACES) {
    const s = read(file); if (!re.test(s)) { console.error(`${file}: the version pattern was not found; fix PLACES in tools/version.mjs`); process.exit(1); }
    writeFileSync(join(root, file), s.replace(re, (_, a, _v, b) => a + arg + b));
  }
  if (!changelogHas(arg)) {
    const s = read('CHANGELOG.md'), at = s.search(/^## /m), today = new Date().toISOString().slice(0, 10);
    const section = `## ${arg} (${today})\n\n- **Area**: what changed, in a line a player or a model can use.\n\n`;
    writeFileSync(join(root, 'CHANGELOG.md'), at < 0 ? s + '\n' + section : s.slice(0, at) + section + s.slice(at));
  }
  console.log(`version ${was} -> ${arg} in ${PLACES.length} places. Next: fill in its CHANGELOG.md section, then node tools/build.mjs`);
} else {
  const v = pkg();
  console.log(`version ${v}`);
  for (const p of [...PLACES, ...BUILT]) console.log(`  ${(found(p) || 'missing').padEnd(8)} ${p[0]}`);
}
