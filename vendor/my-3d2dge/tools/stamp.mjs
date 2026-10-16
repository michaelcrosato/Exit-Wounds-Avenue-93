// The deploy-time build stamp. Vercel runs this (vercel.json "buildCommand") on the commit it deploys: every built
// page and engine file says 'dev-build' where the build goes (My3D2dge.build, the Emberdeep title, its Settings,
// the Labs page, the Mocap Lab), and this replaces it with '<commit> <date>', so the live site and every branch
// preview show exactly which commit they run. The repo's own copies keep the placeholder, so a rebuild still matches
// them byte for byte.
// Usage: node tools/stamp.mjs [--commit a1b2c3d] [--date 2026-10-07] [--dry]
//   the commit comes from --commit, else Vercel's VERCEL_GIT_COMMIT_SHA, else git; the date is today (UTC)
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const opt = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : null; };
let commit = opt('commit') || process.env.VERCEL_GIT_COMMIT_SHA || '';
if (!commit) { try { commit = execSync('git rev-parse HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) { commit = 'unknown'; } }
const stamp = commit.slice(0, 7) + ' ' + (opt('date') || new Date().toISOString().slice(0, 10));
const dry = process.argv.includes('--dry');

// the deployable files: the built pages and the engine files (not the sources, not the CMU library's data)
const files = [];
for (const dir of ['examples', 'dist', 'dist/kits', 'dist/handoff']) {
  if (!existsSync(join(root, dir))) continue;
  for (const f of readdirSync(join(root, dir))) if (/\.(html|js)$/.test(f)) files.push(join(dir, f));
}
let n = 0;
for (const f of files) {
  const s = readFileSync(join(root, f), 'utf8'), k = s.split('dev-build').length - 1;
  if (!k) continue;
  n += k;
  if (!dry) writeFileSync(join(root, f), s.replaceAll('dev-build', stamp));
  console.log(`${dry ? 'would stamp' : 'stamped'} ${f} (${k})`);
}
console.log(`build ${stamp}: ${n} placeholder${n === 1 ? '' : 's'} in ${files.length} files${dry ? ' (dry run)' : ''}`);
