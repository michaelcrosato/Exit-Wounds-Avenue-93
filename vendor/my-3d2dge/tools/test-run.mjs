// The test runner: every suite (npm test), or only the ones that cover what changed (npm run test:changed), with how long
// each took. Changes are read from git against main (committed and not), so a lab change runs the lab's suites and not
// Emberdeep's, and a docs change runs the quick checks only.
//   node tools/test-run.mjs --changed [--base origin/main]   the suites that cover the changed files (the default)
//   node tools/test-run.mjs --all                           every suite, in order (what npm test runs)
//   node tools/test-run.mjs --list                          what --changed would run, and why, without running it
//   node tools/test-run.mjs --list --files a,b              what a change to those files would run
// What counts as changed: source files, not what the build writes (examples/, dist/) and not the changelog; a file whose
// only changes are version numbers (the bump touches the engine, the docs and the kits) counts as unchanged. A change to
// the engine, the build or the dependencies runs everything. The quick checks (version, syntax, doctrine) always run.
// Exit code 1 when a suite fails (all chosen suites run; the failures are listed at the end).
import { execFileSync, spawnSync } from 'node:child_process';

const SUITES = [   // [name, command, paths it covers (a prefix, or a whole path)]
  ['version', 'node tools/version.mjs --check', ['*']],
  ['syntax', 'node tools/ed-syntax.mjs --all', ['*']],
  ['doctrine', 'node tools/doctrine-check.mjs', ['*']],
  ['ed-controls', 'node tools/ed-controls-test.mjs', ['src/emberdeep/', 'src/emberdeep.template.html', 'tools/ed-controls-test.mjs']],
  ['ed-codex', 'node tools/ed-codex-test.mjs', ['src/emberdeep/', 'src/emberdeep.template.html', 'tools/ed-codex-test.mjs']],
  ['ed-character', 'node tools/ed-character-test.mjs', ['src/emberdeep/', 'src/emberdeep.template.html', 'tools/ed-character-test.mjs', 'tools/character-check.mjs', 'docs/CHARACTERS.md']],
  ['new-character', 'node tools/new-character.mjs --test', ['src/emberdeep/', 'src/emberdeep.template.html', 'tools/new-character.mjs', 'docs/CHARACTERS.md']],
  ['ed-tune', 'node tools/ed-tune-test.mjs', ['src/emberdeep/', 'src/emberdeep.template.html', 'tools/ed-tune-test.mjs']],
  ['ed-scenes', 'node tools/ed-scenes-test.mjs', ['src/emberdeep/', 'src/emberdeep.template.html', 'src/assets/sets/emberdeep.js', 'tools/ed-scenes-test.mjs']],
  ['bench', 'node tools/agent-bench.mjs --selftest', ['tools/agent-bench']],
  ['standard', 'node tools/standard-test.mjs', ['tools/standard-test.mjs', 'src/starter/', 'src/starter.template.html', 'src/handoff/']],
  ['phone', 'node tools/phone-test.mjs', ['src/starter/', 'tools/phone-test.mjs', 'tools/build.mjs']],
  ['contract', 'node tools/contract-test.mjs', ['API.md', 'AI_GUIDE.md', 'API-INDEX.md', 'src/handoff/', 'tools/contract-test.mjs', 'tools/api-index.mjs', 'tools/check.mjs', 'tools/replay.mjs', 'tools/filmstrip.mjs']],
  ['agent', 'node tools/agent-test.mjs', ['API.md', 'AI_GUIDE.md', 'src/mocap/', 'src/starter/', 'tools/agent-test.mjs', 'tools/anim-set.mjs', 'tools/cmu.mjs', 'tools/mocap-lib.mjs']],
  ['mocap', 'node tools/mocap-test.mjs', ['src/mocap/', 'src/mocap.template.html', 'src/mocap.game.js', 'tools/mocap-test.mjs', 'tools/mocap-lib.mjs', 'tools/anim-']],
  ['ed-clips', 'node tools/ed-clips-test.mjs', ['src/emberdeep/', 'src/mocap/', 'tools/ed-clips-test.mjs']],
  ['determinism', 'node tools/determinism-test.mjs', ['src/emberdeep/', 'src/emberdeep.template.html', 'src/starter/', 'src/starter.template.html', 'tools/filmstrip.mjs', 'tools/determinism-test.mjs']],
  ['replay', 'node tools/replay-test.mjs', ['src/emberdeep/', 'src/emberdeep.template.html', 'src/starter/', 'src/starter.template.html', 'tools/replay.mjs', 'tools/replay-test.mjs']],
  ['assets', 'node tools/assets-test.mjs', ['docs/ASSETS.md', 'docs/ASSET-IMPORT.md', 'tools/assets-test.mjs', 'tools/asset-', 'src/assets/']],
  ['labs', 'node tools/labs-test.mjs', ['src/', 'vercel.json', 'tools/labs-test.mjs']],
  ['stress', 'node tools/stress-test.mjs', ['src/stress.', 'vercel.json', 'tools/stress-test.mjs']],
  ['lab3d', 'node tools/lab3d-test.mjs', ['src/lab3d', 'vendor/', 'vercel.json', 'tools/lab3d-test.mjs', 'tools/vendor-3d.mjs']],
  ['stress-world', 'node tools/stress-world-test.mjs', ['src/stress-world', 'vendor/', 'vercel.json', 'tools/stress-world-test.mjs']],
  ['kit3d', 'node tools/kit3d-test.mjs', ['engine/my-3d2dge-3d.js', 'src/starter3d', 'vendor/', 'vercel.json', 'API.md', 'tools/kit3d-test.mjs']]
];
// changes that run everything: the engine (every page and suite uses it), the build, the dependencies (package.json:
// installs keep no lockfile, and a bump that changes only its version counts as unchanged; or a lockfile if one comes);
// not the 3D engine (only the 3D starter and kits load it: kit3d covers it)
const EVERYTHING = ['engine/', 'tools/build.mjs', 'package.json', 'package-lock.json'], NOT_EVERYTHING = ['engine/my-3d2dge-3d.js'];
// what is not a source: the build's output, the changelog, test pictures
const IGNORE = ['examples/', 'dist/', 'check-output/', 'CHANGELOG.md'];

const args = process.argv.slice(2), opt = k => args.includes('--' + k);
const baseArg = args.includes('--base') ? args[args.indexOf('--base') + 1] : null;
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 28 }).trim();

/** the changed source files since base (committed, staged, unstaged, untracked), minus version-only changes */
function changedFiles() {
  if (args.includes('--files')) return { base: 'given', files: args[args.indexOf('--files') + 1].split(',').filter(f => !IGNORE.some(p => f.startsWith(p))) };
  let base = baseArg;
  if (!base) { try { execFileSync('git', ['fetch', '-q', 'origin', 'main'], { stdio: 'ignore', timeout: 20000 }); } catch (e) { /* offline: the last fetched main */ } base = 'origin/main'; }
  const mb = git('merge-base', 'HEAD', base);
  const files = new Set([...git('diff', '--name-only', mb).split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n')].filter(Boolean));
  const out = [];
  for (const f of files) {
    if (IGNORE.some(p => f.startsWith(p))) continue;
    if (versionOnly(mb, f)) continue;
    out.push(f);
  }
  return { base: mb.slice(0, 7), files: out.sort() };
}
/** true when every changed line of a tracked file differs only in its version numbers */
function versionOnly(base, f) {
  let d; try { d = git('diff', '-U0', base, '--', f); } catch (e) { return false; }
  if (!d) return false;   // (untracked: new)
  const norm = l => l.slice(1).replace(/\d+\.\d+\.\d+/g, 'V'), minus = [], plus = [];
  for (const l of d.split('\n')) {
    if (l.startsWith('---') || l.startsWith('+++')) continue;
    // (package.json: only its own version line; a dependency's new version is a dependency change)
    if (f === 'package.json' && /^[-+]/.test(l) && !/^\s*"version":/.test(l.slice(1))) return false;
    if (l.startsWith('-')) minus.push(norm(l)); else if (l.startsWith('+')) plus.push(norm(l));
  }
  return minus.length === plus.length && minus.sort().join('\n') === plus.sort().join('\n');
}
const covers = (paths, f) => paths.some(p => p === '*' || f === p || f.startsWith(p)) && !(paths === EVERYTHING && NOT_EVERYTHING.includes(f));

let chosen, why = {};
if (opt('all')) chosen = SUITES;
else {
  const { base, files } = changedFiles(), all = files.some(f => covers(EVERYTHING, f));
  console.log(`changed since ${base}: ${files.length ? files.join(', ') : 'nothing but version numbers, the build\'s output or the changelog'}`);
  chosen = SUITES.filter(([name, , paths]) => {
    if (all || paths[0] === '*') { why[name] = all ? 'everything (' + files.filter(f => covers(EVERYTHING, f)).join(', ') + ')' : 'always'; return true; }
    const hit = files.filter(f => covers(paths, f)); if (hit.length) why[name] = hit.slice(0, 3).join(', ') + (hit.length > 3 ? ' and ' + (hit.length - 3) + ' more' : '');
    return hit.length > 0;
  });
  for (const [name] of chosen) console.log(`  ${name.padEnd(13)} ${why[name]}`);
  const skipped = SUITES.filter(s => !chosen.includes(s)).map(s => s[0]);
  if (skipped.length) console.log(`  skipped: ${skipped.join(', ')}`);
}
if (opt('list')) process.exit(0);

// build first (what the suites open), then each chosen suite in order
const t0 = Date.now(), times = [], failed = [];
const run = (name, cmd) => {
  const t = Date.now(); console.log(`\n▶ ${name}: ${cmd}`);
  const r = spawnSync(cmd, { shell: true, stdio: 'inherit' });
  const s = (Date.now() - t) / 1000; times.push([name, s, r.status === 0]); if (r.status !== 0) failed.push(name);
  return r.status === 0;
};
if (!run('build', 'node tools/build.mjs')) { console.error('the build failed'); process.exit(1); }
for (const [name, cmd] of chosen) run(name, cmd);
const fmt = s => s >= 60 ? Math.floor(s / 60) + ' min ' + Math.round(s % 60) + ' s' : s.toFixed(1) + ' s';
console.log('\n' + times.map(([n, s, ok]) => `${ok ? 'ok  ' : 'FAIL'} ${n.padEnd(13)} ${fmt(s)}`).join('\n'));
console.log(`${failed.length ? 'FAILED: ' + failed.join(', ') : 'all passed'} in ${fmt((Date.now() - t0) / 1000)}${opt('all') ? '' : ' (' + chosen.length + ' of ' + SUITES.length + ' suites)'}`);
process.exit(failed.length ? 1 : 0);
