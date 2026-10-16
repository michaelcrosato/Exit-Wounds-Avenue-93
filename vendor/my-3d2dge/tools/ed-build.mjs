// Builds an Emberdeep test page from the engine, the game's core files and a chosen set of content files, so one
// part of the game can be built and played while other parts are still being written.
// Usage: node tools/ed-build.mjs --out <page.html> [--mine 31-monsters.js,32-foo.js] [--all]
//   --all      every file in src/emberdeep (what tools/build.mjs ships as examples/emberdeep.html)
//   --mine     the core files plus these (default: just the core files)
// Then: node tools/ed-play.mjs <page.html> --hash depth-3 --steps "..."
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..'), dir = join(root, 'src/emberdeep');
const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const out = opt('out', null); if (!out) { console.error('Usage: node tools/ed-build.mjs --out <page.html> [--mine a.js,b.js] [--all]'); process.exit(2); }
// the spine every part relies on (written first; content files plug into its registries)
const CORE = ['00-core.js', '05-elements.js', '10-combat.js', '15-stats.js', '18-characters.js', '20-hero.js', '21-codex.js', '25-skills-core.js', '29-codex-skills.js', '30-monsters-core.js', '35-bosses-core.js', '40-loot-core.js', '45-mechanics-core.js', '50-levels-core.js', '55-town-core.js', '60-ui-core.js', '61-controls.js', '62-developer.js', '63-character-menu.js', '70-audio.js', '90-scenes.js', '92-gallery.js', '93-autopilot.js', '94-tips.js', '95-perf.js', '99-start.js'];
const mine = (opt('mine', '') || '').split(',').map(s => s.trim()).filter(Boolean);
const files = readdirSync(dir).filter(f => f.endsWith('.js')).sort().filter(f => args.includes('--all') || CORE.includes(f) || mine.includes(f));
for (const f of mine) if (!files.includes(f)) console.warn('warning: ' + f + ' is not in src/emberdeep');
const esc = s => s.replaceAll('</script', '<\\/script');
let html = readFileSync(join(root, 'src/emberdeep.template.html'), 'utf8');
html = html.replace(/<!-- @inline-parts (\S+) -->/g, () => `<script>\n${files.map(f => '/* ---- ' + f + ' ---- */\n' + esc(readFileSync(join(dir, f), 'utf8'))).join('\n')}\n</script>`);
html = html.replace(/<!-- @inline (\S+) -->/g, (_, f) => `<script>\n${esc(readFileSync(join(root, f), 'utf8'))}\n</script>`);
mkdirSync(dirname(resolve(out)), { recursive: true });
writeFileSync(resolve(out), html);
console.log('built', out, 'with', files.length, 'files:', files.filter(f => !CORE.includes(f)).join(', ') || '(core only)');
