// Builds the standalone pages by inlining the engine and game scripts.
// Usage: node tools/build.mjs
// Every output is a single self-contained HTML file (no network, no other files) that
// you can open, host, or hand to another AI model.
//   dist/my-3d2dge.html          readable engine + API card + all six starter slices (the reference)
//   dist/my-3d2dge-compact.html  same, with the engine minified (fewer tokens)
//   dist/kits/my-3d2dge-<genre>.html  minified engine + API card + ONE slice: the smallest file to
//                                hand a model that is making a game in that genre
//   dist/my-3d2dge.js / .min.js  the engine alone, for multi-file projects
//   dist/my-3d2dge-3d.html       the 3D starter: the engine and the 3D engine (engine/my-3d2dge-3d.js: three.js r182 and
//                                Rapier 0.19.3 from vendor/, through the page's import map: served, not double-clicked),
//                                the API card and every 3D slice (src/starter3d/)
//   dist/kits/my-3d2dge-3d-<genre>.html  the same with ONE 3D slice: a 3D genre kit
//   dist/my-3d2dge-3d.js         the 3D engine alone (an ES module), readable
//   dist/my-3d2dge-agent.js      the agent edition: the essential engine plus its manual in one readable file,
//                                for AI coding agents (source: engine/my-3d2dge-agent.js; test: node tools/agent-test.mjs)
//   API-INDEX.md                 every public name in the engine, one line each (tools/api-index.mjs)
//   dist/handoff/                the package for coding agents that need the full engine: the engines, API.md, the
//                                index, AI_GUIDE.md, the tools that check, film and replay a game, and a template game
//                                with a headless test (sources: src/handoff/). The only output of several files; text only
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENGINE = 'engine/my-3d2dge.js';
const STARTER = 'src/starter', STARTER3D = 'src/starter3d', ENGINE3D = 'engine/my-3d2dge-3d.js';
const SLICES = { adventure: 'ADVENTURE (top-down action adventure)', platformer: 'PLATFORMER (side-scroller)', brawler: "BRAWLER (beat-'em-up)", shooter: 'SHOOTER (vertical shoot-em-up)', rpg: 'RPG BATTLE (turn-based battle)', stealth: 'STEALTH (third-person stealth and parkour)', animlab: 'ANIMATION LAB (every move, pose, skin and view of the character rigs)' };
const ALL = {
  GAMES: 'six working games and an animation lab',
  CONTENTS: "a title menu plus six vertical slices\n       (ADVENTURE top-down, PLATFORMER side-scroller, BRAWLER beat-'em-up, SHOOTER, RPG BATTLE, STEALTH)\n       and an ANIMATION LAB that plays every move, pose and skin in every view.",
  LINKS: 'Deep links: add #adventure, #platformer, #brawler, #shooter, #rpg, #stealth or #animlab to the address to start a slice.'
};
const kit = id => ({
  EDITION: id + ' kit', GAMES: 'one working game to copy',
  CONTENTS: 'a title menu plus the ' + SLICES[id] + ' slice.\n       This is a genre kit. The complete file with all six slices is dist/my-3d2dge.html\n       at github.com/michaelcrosato/my-3d2dge.',
  LINKS: 'Deep link: add #' + id + ' to the address to start the slice.'
});
// the 3D slices: their ids and what each is (the kit's header names it)
const SLICES3D = { action: 'ACTION (a 3D arena: combos, dashes and waves, Zelda 64 and Diablo by way of the stress test)', platformer: 'PLATFORMER (a 3D course of islands, platforms and coins, Mario 64 and Spyro)' };
const ALL3D = { EDITION: '3D edition', GAMES: 'the 3D starter games', CONTENTS: 'a title menu plus every 3D slice (' + Object.keys(SLICES3D).map(k => k.toUpperCase()).join(', ') + ').', LINKS: 'Deep links: add #' + Object.keys(SLICES3D).join(', #') + ' to the address to start a slice.' };
const kit3d = id => ({ EDITION: '3D ' + id + ' kit', GAMES: 'one 3D game to copy', CONTENTS: 'a title menu plus the ' + SLICES3D[id] + ' slice.\n       This is a 3D genre kit. The file with every 3D slice is dist/my-3d2dge-3d.html at github.com/michaelcrosato/my-3d2dge.', LINKS: 'Deep link: add #' + id + ' to the address to start the slice.' });
const builds = [
  // one arena page for every view: iso by default, arena.html#threequarter (or keys 1-4, V) for the others
  { template: 'src/arena.template.html', out: 'examples/arena.html', vars: { VIEW: 'iso', TITLE: 'Emberwell · my-3D2dge' } },
  { template: 'src/lab.template.html', out: 'examples/perspective-lab.html', vars: {} },
  { template: 'src/stress.template.html', out: 'examples/stress-test.html', vars: {} },
  // imported animation clips (tools/anim-import.mjs) on a look-alike mannequin and on the hero
  { template: 'src/mocap.template.html', out: 'examples/mocap-lab.html', vars: {} },
  // every entry of the asset store (src/assets/sets/, inlined) and the core library, to browse, search and copy
  { template: 'src/asset-lab.template.html', out: 'examples/asset-lab.html', vars: {} },
  // temporary (src/labs.json, docs/LAB-3D.md): our characters in a fully 3D world (three.js r182 + Rapier from vendor/,
  // loaded through the page's import map, so it is served, not double-clicked); delete with its labs.json entry and vendor/
  { template: 'src/lab3d.template.html', out: 'examples/lab-3d.html', vars: {} },
  // temporary (src/labs.json): the stress test built again as a 3D game (src/stress-world/: three.js r182 and Rapier from
  // vendor/, the engine's animation system); delete with its labs.json entry
  { template: 'src/stress-world.template.html', out: 'examples/stress-world.html', vars: {} },
  // temporary (src/labs.json): Vesper's interface rebuilt on E.Shell, to count its tokens; delete with its labs.json entry
  { template: 'src/vesper-ui.template.html', out: 'examples/vesper-ui.html', vars: {} },
  // one page that links to every lab, test page and demo, from the list in src/labs.json (my-3d2dge.vercel.app/labs)
  { template: 'src/labs.template.html', out: 'examples/labs.html', vars: {} },
  // the signature game: src/emberdeep/*.js (one script, joined in name order)
  { template: 'src/emberdeep.template.html', out: 'examples/emberdeep.html', vars: {} },
  // the files to share with AI models: API card + engine + starter slices
  { template: 'src/starter.template.html', out: 'dist/my-3d2dge.html', vars: Object.assign({ EDITION: 'single-file edition' }, ALL) },
  { template: 'src/starter.template.html', out: 'dist/my-3d2dge-compact.html', vars: Object.assign({ EDITION: 'compact edition (engine minified)' }, ALL), compact: true },
  // genre kits: the shell, one slice and the start code
  ...readdirSync(join(root, STARTER)).filter(f => /^[1-8]\d-.+\.js$/.test(f)).map(f => {
    const id = f.replace(/^\d+-|\.js$/g, '');
    return { template: 'src/starter.template.html', out: 'dist/kits/my-3d2dge-' + id + '.html', vars: kit(id), compact: true, parts: p => /^(0|9)/.test(p) || p === f };
  }),
  // the 3D starter (src/starter3d/: the shell, every 3D slice, the start) and a 3D genre kit for each slice
  { template: 'src/starter3d.template.html', out: 'dist/my-3d2dge-3d.html', vars: ALL3D, compact: true },
  ...readdirSync(join(root, STARTER3D)).filter(f => /^[1-8]\d-.+\.js$/.test(f)).map(f => {
    const id = f.replace(/^\d+-|\.js$/g, '');
    if (!SLICES3D[id]) throw new Error(STARTER3D + '/' + f + ': name the slice in SLICES3D (tools/build.mjs)');
    return { template: 'src/starter3d.template.html', out: 'dist/kits/my-3d2dge-3d-' + id + '.html', vars: kit3d(id), compact: true, parts: p => /^(0|9)/.test(p) || p === f };
  })
];

let minified = null, minified3d = null;
async function engineMin() {
  if (minified !== null) return minified;
  try {
    const { minify } = await import('terser');
    const res = await minify(readFileSync(join(root, ENGINE), 'utf8'), { compress: true, mangle: true, format: { comments: /^!/ } });
    minified = res.code;
  } catch (e) { console.warn('terser is not installed (npm install); skipping the compact build'); minified = false; }
  return minified;
}
/** the 3D engine minified as a module, its manual (the /*! header) kept */
async function engine3dMin() {
  if (minified3d !== null) return minified3d;
  try {
    const { minify } = await import('terser');
    minified3d = (await minify(readFileSync(join(root, ENGINE3D), 'utf8'), { module: true, compress: true, mangle: true, format: { comments: /^!/ } })).code;
  } catch (e) { minified3d = false; }
  return minified3d;
}

const read = file => readFileSync(join(root, file), 'utf8').replaceAll('</script', '<\\/script');
// every page may say which release it is: {{VERSION}} (package.json) and {{BUILD}}, a placeholder that tools/stamp.mjs
// turns into the commit when the site deploys (the repo's copies keep it, so a rebuild matches them exactly)
const GLOBAL = { VERSION: JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version, BUILD: 'dev-build' };
// <!-- @boot Title --> becomes the boot screen's splash (the engine's own E.bootSplash, so the page's first paint and the
// screen the engine takes it over with never drift apart): it shows while the page's scripts load
const bootSplash = (() => { const ctx = { console }; vm.createContext(ctx); vm.runInContext(read(ENGINE), ctx); return ctx.My3D2dge.bootSplash; })();
const boot = html => html.replace(/<!-- @boot ?(.*?) -->/g, (_, t) => bootSplash(t.trim()));
for (const b of builds) {
  const min = b.compact ? await engineMin() : null;
  if (b.compact && !min) continue;
  let html = readFileSync(join(root, b.template), 'utf8');
  for (const [k, v] of Object.entries(Object.assign({}, GLOBAL, b.vars))) html = html.replaceAll(`{{${k}}}`, v);
  html = boot(html);
  // a file one part needs, only where that part is (a kit of one slice leaves out the others' sets)
  html = html.replace(/<!-- @inline-with (\S+) (\S+) -->/g, (_, part, file) => !b.parts || b.parts(part) ? `<!-- @inline ${file} -->` : '');
  html = html.replace(/<!-- @inline-raw (\S+) -->/g, (_, file) => read(file));
  // a folder of script parts joined in name order into one <script> (the starter game: shell + one file per slice)
  html = html.replace(/<!-- @inline-parts (\S+) -->/g, (_, dir) => {
    const parts = readdirSync(join(root, dir)).filter(f => f.endsWith('.js') && (!b.parts || b.parts(f))).sort();
    return `<script>\n/* ---- inlined from ${dir} (${parts.join(', ')}) ---- */\n${parts.map(f => read(join(dir, f))).join('\n')}\n</script>`;
  });
  // one ES module file as a <script type="module"> (the 3D engine; minified, its manual kept, in a compact build)
  const min3d = b.compact ? await engine3dMin() : null;
  html = html.replace(/<!-- @inline-esm (\S+) -->/g, (_, file) => {
    const src = file === ENGINE3D && min3d ? min3d.replaceAll('</script', '<\\/script') : read(file);
    return `<script type="module">\n/* ---- inlined from ${file}${file === ENGINE3D && min3d ? ' (minified; the readable engine is in the repo)' : ''} ---- */\n${src}\n</script>`;
  });
  // a folder of module parts joined in name order into one <script type="module"> (they share one scope; imports go first)
  html = html.replace(/<!-- @inline-module (\S+) -->/g, (_, dir) => {
    const parts = readdirSync(join(root, dir)).filter(f => f.endsWith('.js') && (!b.parts || b.parts(f))).sort();
    return `<script type="module">\n/* ---- inlined from ${dir} (${parts.join(', ')}) ---- */\n${parts.map(f => read(join(dir, f))).join('\n')}\n</script>`;
  });
  // a file's first section, raw: everything before its second /* ==== banner (Dan's body, without Emberdeep's skills)
  html = html.replace(/<!-- @inline-head (\S+) -->/g, (_, file) => {
    const src = read(file), at = [...src.matchAll(/^\/\* =+$/gm)].map(m => m.index);
    if (at.length < 2) throw new Error(file + ': @inline-head needs a second /* ==== section banner');
    return `/* ---- inlined from ${file} (its first section) ---- */\n` + src.slice(0, at[1]);
  });
  html = html.replace(/<!-- @inline (\S+) -->/g, (_, file) => {
    const src = file === ENGINE && min ? min.replaceAll('</script', '<\\/script') : read(file);
    return `<script>\n/* ---- inlined from ${file}${file === ENGINE && min ? ' (minified; the readable engine is in the repo)' : ''} ---- */\n${src}\n</script>`;
  });
  mkdirSync(dirname(join(root, b.out)), { recursive: true });
  writeFileSync(join(root, b.out), html);
  console.log('built', b.out, (html.length / 1024).toFixed(1) + ' KB');
}
writeFileSync(join(root, 'dist/my-3d2dge.js'), readFileSync(join(root, ENGINE), 'utf8'));
console.log('built dist/my-3d2dge.js');
writeFileSync(join(root, 'dist/my-3d2dge-agent.js'), readFileSync(join(root, 'engine/my-3d2dge-agent.js'), 'utf8'));
console.log('built dist/my-3d2dge-agent.js');
writeFileSync(join(root, 'dist/my-3d2dge-3d.js'), readFileSync(join(root, ENGINE3D), 'utf8'));
console.log('built dist/my-3d2dge-3d.js');
const min = await engineMin();
if (min) { writeFileSync(join(root, 'dist/my-3d2dge.min.js'), min); console.log('built dist/my-3d2dge.min.js'); }

// the API index, from the engine itself
const { build: indexOf, render: renderIndex } = await import('./api-index.mjs');
writeFileSync(join(root, 'API-INDEX.md'), renderIndex(indexOf()));
console.log('built API-INDEX.md');

// the handoff package: [its path, the source] (the README, package.json and index page take {{VERSION}} and {{BUILD}})
const H = 'dist/handoff', HANDOFF = [
  ['README.md', 'src/handoff/README.md'], ['package.json', 'src/handoff/package.json'],
  ['my-3d2dge.js', ENGINE], ['my-3d2dge-agent.js', 'engine/my-3d2dge-agent.js'],
  ['API.md', 'API.md'], ['API-INDEX.md', 'API-INDEX.md'], ['AI_GUIDE.md', 'AI_GUIDE.md'],
  ['tools/check.mjs', 'tools/check.mjs'], ['tools/filmstrip.mjs', 'tools/filmstrip.mjs'], ['tools/replay.mjs', 'tools/replay.mjs'],
  // the asset card, its tools and the store, at the repository's own paths so the card's commands work as written
  ['docs/ASSETS.md', 'docs/ASSETS.md'], ...['find', 'sheet', 'set', 'lib'].map(t => ['tools/asset-' + t + '.mjs', 'tools/asset-' + t + '.mjs']),
  ...readdirSync(join(root, 'src/assets/sets')).filter(f => f.endsWith('.js')).sort().map(f => ['src/assets/sets/' + f, 'src/assets/sets/' + f]),
  ...readdirSync(join(root, 'src/assets/catalogs')).filter(f => f.endsWith('.json')).sort().map(f => ['src/assets/catalogs/' + f, 'src/assets/catalogs/' + f]),
  ...readdirSync(join(root, 'src/handoff/game')).sort().map(f => ['game/' + f, 'src/handoff/game/' + f])
];
const SAY = { 'README.md': 'start here: what the package holds, which page to read, how to run and test a game', 'package.json': 'pins Playwright for the tools',
  'my-3d2dge.js': 'the full engine, readable', 'my-3d2dge-agent.js': 'the agent edition: the essential engine, its header a short manual',
  'API.md': 'the API card: read it whole', 'API-INDEX.md': 'every public name, one line each: search it', 'AI_GUIDE.md': 'the guide: recipes, the look, heights, sessions',
  'tools/check.mjs': 'plays a game headless and reports errors, screenshots and its snapshot', 'tools/filmstrip.mjs': 'records frames into one picture',
  'tools/replay.mjs': 'replays a recorded play session exactly', 'game/index.html': 'the template game: play it', 'game/game.js': 'the template game: copy it',
  'game/test.mjs': 'its headless test: node game/test.mjs', 'docs/ASSETS.md': 'the asset card: objects and materials as data (r.shape), the core library, writing one',
  'tools/asset-find.mjs': 'searches the core library and the store: node tools/asset-find.mjs "tavern table"', 'tools/asset-sheet.mjs': 'draws an object in every view and says what reads badly',
  'tools/asset-set.mjs': 'cuts the few entries a game uses from the store\'s sets', 'tools/asset-lib.mjs': 'shared by the asset tools' };
if (existsSync(join(root, H))) rmSync(join(root, H), { recursive: true });
const fill = s => boot(s.replaceAll('{{VERSION}}', GLOBAL.VERSION).replaceAll('{{BUILD}}', GLOBAL.BUILD));
for (const [to, from] of HANDOFF) {
  mkdirSync(dirname(join(root, H, to)), { recursive: true });
  const text = readFileSync(join(root, from), 'utf8');
  writeFileSync(join(root, H, to), from.startsWith('src/handoff/') && !from.endsWith('.js') && !from.endsWith('.mjs') ? fill(text) : text);
}
// the store: a page of its own listing every set (what each holds, from its header; the folder itself has no page), and
// one line for it on the index
const sets = HANDOFF.filter(([to]) => to.startsWith('src/assets/sets/')).map(([to, from]) => { const t = readFileSync(join(root, from), 'utf8'), n = /(\d+) shapes, (\d+) materials, (\d+) sprites/.exec(t);
  return `- [${to.split('/').pop()}](sets/${to.split('/').pop()}): ${n ? n[0] : ''}${existsSync(join(root, 'src/assets/catalogs', to.split('/').pop().replace(/\.js$/, '.json'))) ? ` ([catalog](catalogs/${to.split('/').pop().replace(/\.js$/, '.json')}))` : ' (a game\'s own cut)'}`; });
writeFileSync(join(root, H, 'src/assets/README.md'), '# The asset store\n\nSets of still objects, materials and sprites converted from CC0 libraries (each entry says where it came from),\nand the hand-written catalogs that describe them. `docs/ASSETS.md` is the card;\n`node tools/asset-find.mjs \"words\"` searches them; a game loads one with its script and\n`E.addAssets(window.ASSETS[\'<set>\'])`, or cuts the few it uses with `node tools/asset-set.mjs`.\n\n' + sets.join('\n') + '\n');
const list = HANDOFF.filter(([to]) => !to.startsWith('src/assets/')).map(([to]) => `<li><a href="${to}">${to}</a><span>${SAY[to] || ''}</span></li>`)
  .concat(`<li><a href="src/assets/README.md">src/assets/</a><span>the asset store: ${sets.length} sets of objects and materials converted from CC0 libraries, and their catalogs (docs/ASSETS.md, "Make one")</span></li>`).join('\n');
writeFileSync(join(root, H, 'index.html'), fill(readFileSync(join(root, 'src/handoff/index.html'), 'utf8')).replace('{{FILES}}', list));
console.log('built ' + H + '/ (' + (HANDOFF.length + 2) + ' files)');
