// Syntax-checks the joined Emberdeep script (every file in src/emberdeep, or --mine a.js,b.js on top of the core)
// without a browser: node tools/ed-syntax.mjs [--all | --mine a.js,b.js]
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { Script } from 'node:vm';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..'), dir = join(root, 'src/emberdeep');
const args = process.argv.slice(2), mine = (args[args.indexOf('--mine') + 1] || '').split(',').filter(Boolean);
const core = readFileSync(join(root, 'tools/ed-build.mjs'), 'utf8').match(/const CORE = (\[[^\]]+\])/)[1].replace(/'/g, '"');
const CORE = JSON.parse(core), files = readdirSync(dir).filter(f => f.endsWith('.js')).sort().filter(f => args.includes('--all') || CORE.includes(f) || mine.includes(f));
const src = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
try { new Script(src, { filename: 'joined.js' }); console.log('syntax ok:', files.length, 'files'); }
catch (e) { const msg = String(e.stack || e.message); const m = /joined\.js:(\d+)/.exec(msg); let where = ''; if (m) { let n = +m[1]; for (const f of files) { const c = readFileSync(join(dir, f), 'utf8').split('\n').length; if (n <= c) { where = f + ':' + n; break; } n -= c; } } console.log('SYNTAX ERROR at ' + where + '\n' + msg.split('\n').slice(0, 6).join('\n')); process.exit(1); }
