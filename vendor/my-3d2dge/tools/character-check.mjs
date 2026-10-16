// One command for a playable character's whole loop (docs/CHARACTERS.md): the syntax of the game's script, a build,
// the character test (tools/ed-character-test.mjs: the body contract and everything a hero must do) and the character
// sheet (tools/ed-sheet.mjs: one image and its numbers), then a short summary. Read the summary and the sheet; open the
// test's screenshots only when something failed.
// Usage: npm run character:check -- <id> [--quick] [--no-build]
//   --quick skips the slow parts of the test (every shared skill, the phone); --no-build uses the pages as they are
// Exit code 1 when the syntax, the build or the test fails (the sheet's lints are things to look at, not failures).
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const id = process.argv.slice(2).find(a => !a.startsWith('--'));
if (!id) { console.error('Usage: npm run character:check -- <id> [--quick] [--no-build]'); process.exit(2); }
const quick = process.argv.includes('--quick');
const step = (label, args, show = true) => {
  const t0 = Date.now(), r = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' }), out = (r.stdout || '') + (r.stderr || '');
  if (show || r.status) process.stdout.write(out.split('\n').filter(l => l.trim()).map(l => '  ' + l).join('\n') + '\n');
  console.log(`${r.status ? 'FAILED' : 'ok'} ${label} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  return { ok: !r.status, out };
};
console.log(`character check: ${id}`);
if (!step('syntax', ['tools/ed-syntax.mjs', '--all'], false).ok) process.exit(1);
if (!process.argv.includes('--no-build') && !step('build', ['tools/build.mjs'], false).ok) process.exit(1);
const test = step('character test', ['tools/ed-character-test.mjs', '--character', id].concat(quick ? ['--quick'] : []));
const sheet = step('character sheet', ['tools/ed-sheet.mjs', '--character', id]);
const lints = (sheet.out.match(/^ {4}\S.*$/gm) || []).length;
console.log(`\n${id}: ${test.ok ? 'the test passed' : 'the test FAILED (screenshots in check-output/character-' + id + ')'}; the sheet is check-output/sheet-${id}.png, ${lints ? lints + ' thing' + (lints === 1 ? '' : 's') + ' to look at' : 'nothing to look at'}`);
process.exit(test.ok && sheet.ok ? 0 : 1);
