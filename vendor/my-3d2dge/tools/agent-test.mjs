// Tests the agent edition (engine/my-3d2dge-agent.js), the one-file engine plus manual for AI coding agents:
//   1. every ```js example in its header plays (start, move, attack, pause) with no errors and a drawn screen,
//      on the agent edition AND on the full engine (games written for it must run unchanged on the full engine)
//   2. a coverage scene drives every rig option, pose, move, view, tile kind and kit for runtime errors, on both engines
//   3. its public API is a subset of the full engine's (every name it offers exists there too)
//   4. the store it points to (its "More" section, and the same in the full engine, API.md and AI_GUIDE.md): every path
//      named exists, and its recipe works: the ledger search, the cut of a curated clip and a motion-capture take into a
//      set of its own, and both clips playing on the agent edition's Humanoid
//   5. its size, in bytes and tokens (cl100k when the optional gpt-tokenizer package is installed, otherwise an estimate)
// Usage: node tools/agent-test.mjs [--out check-output/agent] [--only quickstart]    (exit code 1 on any failure)
// Setup: npm install (Playwright). Set CHROMIUM_PATH to use an already installed Chromium.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const AGENT = join(root, 'engine/my-3d2dge-agent.js'), FULL = join(root, 'engine/my-3d2dge.js');
const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const out = resolve(opt('out', 'check-output/agent')), only = opt('only', null);
mkdirSync(out, { recursive: true });
const src = readFileSync(AGENT, 'utf8');
const failures = [];
const fail = (what, why) => { failures.push(what + ': ' + why); console.log('  FAIL ' + what + ': ' + why); };

// the header is the manual: its ```js <name> blocks are complete games
const header = src.slice(0, src.indexOf('*/'));
const examples = [...header.matchAll(/```js (\w+)\n([\s\S]*?)\n```/g)].map(m => ({ name: m[1], code: m[2] }));
if (examples.length < 3) fail('header', 'expected at least 3 ```js examples, found ' + examples.length);

// drives every rig option, pose, move and view, both level kits, bullets, particles, UI and sound
const COVERAGE = `(() => {
const E = My3D2dge, px = E.px;
const game = new E.Game({ canvas: 'screen', res: 'ps1', view: 'threequarter' });
const map = new E.TileMap({ rows: ['##########', '#@..1..~~#', '#.2...s..#', '#..s.....#', '##########'], legend: { '#': 1, '1': 2, '2': 3, '@': 'hero', s: 'slime', '~': { floor: 'lava', block: true } },
  types: { 1: { h: 30, top: '#57506a', side: '#3d3750', cut: true }, 2: { h: 8, top: '#7a6a50', side: '#5a4a30', face: 'none', roof: 'plain' }, 3: { h: 16, top: '#4a7a3a', side: '#3a5a2a' } },
  floorTex: (x, y, tag) => tag === 'lava' ? E.tex.dirt(x, y, { base: '#e05020' }) : x < 48 ? E.tex.planks(x, y) : x < 96 ? E.tex.checker(x, y) : y < 40 ? E.tex.water(x, y) : E.tex.plain(x, y) });
const level = new E.PlatformMap({ rows: ['        L     ', '  ==  ?L  BB  ', ' /#\\\\  L ~~ ^^ ', '##############'],
  legend: { '#': 1, '=': 2, '?': 3, '^': 4, L: 5, '/': 6, '\\\\': 7, '~': 8, B: 9, '@': 'hero' },
  types: { 1: { style: 'brick', side: '#8a5a32' }, 2: { kind: 'oneway' }, 3: { style: 'bonus', side: '#e8a830', glyph: '!' }, 4: { kind: 'hazard' }, 5: { kind: 'ladder' },
    6: { kind: 'slope', dir: 1 }, 7: { kind: 'slope', dir: -1 }, 8: { style: 'liquid', kind: 'hazard', side: '#3060c0' }, 9: { kind: 'back', style: 'plain' } } });
const views = ['iso', 'threequarter', 'topdown', 'brawler', 'side', 'overhead'];
const builds = ['chibi', 'heroic', 'bulky'], weapons = ['sword', 'gun', 'staff', null], outfits = ['shirt', 'tunic', 'robe', 'coat'], hats = ['cap', 'pointed', 'helmet', 'crown', null];
const rigs = Array.from({ length: 12 }, (_, i) => new E.Humanoid({ build: builds[i % 3], weapon: weapons[i % 4], outfit: outfits[i % 4], hat: hats[i % 5], hair: i % 3 ? 'short' : 'bald',
  cape: i % 2 ? { len: 5 } : null, hood: i === 5, eyeGlow: i === 7 ? '#ff4030' : null, sleeves: ['short', 'long', 'none'][i % 3], face: { eyes: i % 2 ? 'big' : 'normal' }, size: 1 + (i % 3) * .2 }));
const blobs = [new E.Blob({ wings: true, mouth: 'fangs' }), new E.Blob({ ears: 'rabbit', feet: true }), new E.Blob({ ears: 'cat', tail: true, horns: true, face: 'front', mouth: true })];
const moves = Object.keys(E.MOVES), poses = ['cheer', 'cast', 'guard', 'kneel', 'crouch', 'wave', 'hips', 'block', 'die', 'down', null], phases = ['wind', 'active', 'recover'];
const shots = new E.Bullets(game), side = new E.Bullets(game, { plane: 'side' }), grid = new E.SpatialHash(32), flow = new E.FlowField(map);
const runner = new E.Platformer({ x: 24, z: 16, airJumps: 1, wallJump: true, dash: 220 }), lift = { x: 120, z: 40, w: 32, h: 6, vx: 20, vz: 0 };
const combo = new E.Combo(['jab', 'cross', 'roundhouse']), slash = new E.Attack('thrust', { reach: 10 }), ORB = E.sprite('.o.\\nooo\\n.o.', { o: '#80e0ff' }, 2);
const talk = new E.Dialog(game), menu = new E.Menu(game, ['ONE', { label: 'TWO', disabled: true }, 'THREE'], { title: 'MENU', x: 8, y: 8 });
talk.say(['A long first page that has to wrap across the dialog box more than once to test the wrapping.', 'Pick one.'], { name: 'TEST', choices: ['A', 'B'], portrait: (g, x, y, s) => px.rect(g, x, y, s, s, '#406080') });
E.store.set('agent-test', { ok: 1 }); if (!E.store.get('agent-test')) throw new Error('store');
let t = 0, vi = -1;
game.start({ update(dt) {
    t += dt;
    const v = Math.floor(t * 1.5) % views.length; if (v !== vi) { vi = v; game.setView(views[v]); game.audio.sfx(Object.keys({ jump: 1, coin: 1, hit: 1, explode: 1, powerup: 1, laser: 1 })[v]); game.audio.music(['title', 'adventure', 'dungeon', 'boss', 'victory', null][v]); }
    const isSide = game.view.isSide || game.view.id === 'brawler';
    if (talk.update(dt) && t > 1) { game.input.consumeAll(); talk.close(); }
    menu.update(dt);
    rigs.forEach((rig, i) => { const k = Math.floor(t * 3) + i, a = t + i;
      rig.update(dt, { x: 40 + (i % 4) * 28, y: 30 + Math.floor(i / 4) * 20, z: 0, vx: Math.cos(a) * 60 * (i % 2), vy: Math.sin(a) * 60 * (i % 2), vz: i === 3 ? 40 : 0, facing: a,
        attack: i % 3 === 0 ? E.move(moves[k % moves.length], (t * 4) % 1, phases[k % 3]) : null, pose: poses[k % poses.length], stance: ['guard', 'ready', null][i % 3],
        air: i === 4 && Math.sin(t * 3) > 0, point: i === 1, aim: Math.sin(t), climb: i === 3, run: i === 6 ? .8 : 0, hurt: i === 8 && Math.sin(t * 5) > .5, dash: i === 10 }); if (i === 2) rig.kick(.3); });
    blobs.forEach((b, i) => b.update(dt, { look: [Math.cos(t), Math.sin(t)], squash: Math.sin(t * 6) * .3, squint: i === 2, walk: 1, flap: i ? 1 : .2, hang: i === 0 && Math.sin(t) > .5 }));
    if (Math.floor(t * 8) !== Math.floor((t - dt) * 8)) {
      const p = game.particles; p.explosion(100, 40, 0, 1.6, { freeze: false }); p.smoke(60, 40, 0, 2); p.dust(80, 50, 0, 3); p.glints(90, 50, 8); p.ring(70, 40, 4, 20, '#ffe0a0'); p.add({ kind: 'ember', x: 50, y: 40, z: 10, vz: 10, max: .5, color: '#ff8030' }); p.text(60, 40, 10, '99', '#ffffff', { bounce: true });
      shots.burst({ x: 80, y: 40, z: 8, team: 'foe', pierce: true }, E.pattern.ring(6, 90, t)); shots.fire({ x: 80, y: 40, z: 8, vx: 100, sprite: ORB, grav: 50 }); side.burst({ x: 40, z: 30, team: 'player' }, E.pattern.spread(0, 3, .6, 160));
      if (combo.press()) game.hitFx(80, 40, 8, { damage: 7, power: 2 }); slash.start(true);
    }
    combo.update(dt); slash.update(dt); combo.hits(rigs, () => true, () => {}); slash.hits(blobs, () => true, () => {});
    shots.update(dt, map); side.update(dt, level); shots.hit(rigs.map(r => ({ x: r.x, y: r.y, r: 5 })), () => {}, 'foe'); side.hit([{ x: 100, z: 16, w: 10, h: 20 }], () => {}, 'player');
    grid.build(rigs); grid.near(60, 40, 20, () => {}); flow.update(40, 30); flow.dir(120, 50, 40, 30); map.los(20, 20, 140, 60); map.groundAt(70, 30, 5, 20);
    lift.x += lift.vx * dt; if (lift.x > 180 || lift.x < 100) lift.vx = -lift.vx;
    runner.update(dt, level, { x: Math.sin(t), jump: t % 1 < .5, jumpPressed: t % 1 < dt * 2, up: t % 4 > 3, down: t % 5 > 4.5, dash: t % 3 < dt * 2 }, [lift]);
    if (runner.z < -50) Object.assign(runner, { x: 24, z: 16, vx: 0, vz: 0 });
    game.particles.ground = isSide ? (x, y, z) => level.groundBelow(x, z) : null;
    if (isSide) game.focus(runner.x, 0, runner.z + 24); else game.focus(80, 40, 10);
    if (t > 1.5 && t < 1.52) { game.shake(3); game.flash('#ffffff', .1); game.note('NOTE'); game.timeScale = .5; game.after(.2, () => { game.timeScale = 1; }); }
  },
  draw(r) {
    const isSide = r.view.isSide || r.view.id === 'brawler';
    if (isSide) { r.sky(['#203060', '#6080c0', '#f0c080'], { bands: 8 }); r.starfield({ count: 30, height: .5, dir: 'left' }); level.draw(r); }
    else { map.drawFloor(r); map.queueWalls(r); }
    rigs.forEach((rig, i) => { r.shadow(rig.x, rig.y, 5, .5, '#0c0818', i === 2 ? 8 : 0); r.actor(rig.x, rig.y, rig.z, (g, ox, oy) => rig.draw(g, ox, oy, r.view), { flash: i === 5 && '#ff0000', flashMix: i === 5 ? 1 : .5, alpha: i === 9 ? .5 : undefined, outline: i !== 11 }); });
    blobs.forEach((b, i) => r.actor(150 + i * 14, 60, 0, (g, ox, oy) => b.draw(g, ox, oy, r.view)));
    r.actor(runner.x, 0, runner.z, (g, ox, oy) => rigs[0].draw(g, ox, oy, r.view));
    r.queue(lift.x, 0, lift.z, g => r.box(g, lift.x - 16, -6, lift.z, lift.x + 16, 6, lift.z + 6, '#c0a060', '#806030'));
    shots.draw(r); side.draw(r); r.sprite(60, 60, 0, ORB, { flip: true, outline: true }); r.sprite(64, 60, 0, ORB, { anchor: 'top', alpha: .5 });
    r.decal(() => { r.groundArc(80, 40, 6, 20, 0, 2, '#ff4040', .5); r.groundDisc(80, 40, 10, '#4080ff', .4); r.groundRing(80, 40, 14, '#ffffff', .8); });
    r.textAt(80, 40, 30, 'AT', '#ffe08a'); r.text('Right aligned', r.W - 4, 4, '#ffffff', { align: 'right', shadow: '#000', outline: false });
    r.overlay(g => { E.ui.box(g, 4, 180, 120, 40, { bg: ['#203060', '#101830'] }); E.ui.box(g, 130, 180, 60, 40, { alpha: .5 }); E.ui.bar(g, 8, 184, 60, 5, (t % 2) / 2, '#40e060');
      E.ui.hearts(g, 8, 192, 2.5, 13, { perRow: 10 }); E.ui.counter(g, 8, 208, 'GOLD', 42); E.font.title(g, 'COVER', r.W / 2, 30, { align: 'center', scale: 2 });
      E.font.text(g, 'gradient ♥★←→↑↓•×♪▸©', 200, 200, '#ffffff', { gradient: ['#ffffff', '#ff8040'], scale: 1, wrap: 100 }); r.glowDisc(g, 300, 20, 8, '#ffcc66', .8);
      px.line(g, 0, 0, 30, 10, '#ff00ff', 2); px.ell(g, 20, 20, 6, 3, '#00ff00'); px.ddisc(g, 40, 20, 6, '#0080ff', .5); px.blend(g, .5, 'multiply', () => px.rect(g, 0, 0, 10, 10, '#808080')); px.polyDither(g, [[0, 30], [20, 30], [10, 40]], '#ffff00', .4); });
    talk.draw(r); menu.draw(r);
  }
});
})();`;

const page = async (browser, engine, code, tag) => {
  const dir = join(out, tag); mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'game.js'), code);
  writeFileSync(join(dir, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:#000;overflow:hidden}#screen{width:100%;height:100%;display:block;image-rendering:pixelated}</style></head>\n<body><canvas id="screen"></canvas><script src="' + pathToFileURL(engine).href + '"></script><script src="game.js"></script></body></html>\n');
  const p = await browser.newPage({ viewport: { width: 960, height: 720 } }), errors = [];
  p.on('pageerror', e => errors.push(String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(pathToFileURL(join(dir, 'index.html')).href);
  return { p, dir, errors };
};
// share of pixels that differ from the most common color (0 = a blank screen)
const filled = p => p.evaluate(() => {
  const g = My3D2dge.current, c = g.screen.ctx, d = c.getImageData(0, 0, g.screen.W, g.screen.H).data, n = new Map();
  let top = 0; for (let i = 0; i < d.length; i += 4) { const k = d[i] << 16 | d[i + 1] << 8 | d[i + 2], v = (n.get(k) || 0) + 1; n.set(k, v); if (v > top) top = v; }
  return 1 - top / (d.length / 4);
});
const state = p => p.evaluate(() => { const g = My3D2dge.current; return g ? { scene: g.sceneName, errors: g.errors.map(e => e.where + ': ' + e.message), box: !!document.querySelector('#my3d2dge-error, #e3-boot[data-failed]') } : null; });

async function play(browser, engine, ex, tag) {
  const { p, dir, errors } = await page(browser, engine, ex.code, tag);
  const hold = async (keys, ms) => { for (const k of keys) await p.keyboard.down(k); await p.waitForTimeout(ms); for (const k of keys) await p.keyboard.up(k); };
  await p.waitForTimeout(700);
  await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  await hold(['ArrowRight'], 500); await p.keyboard.press('Space'); await hold(['ArrowRight', 'Space'], 400);
  for (const k of ['KeyJ', 'KeyX', 'KeyJ', 'KeyZ']) { await p.keyboard.press(k); await p.waitForTimeout(140); }
  await hold(['ArrowDown', 'ArrowLeft'], 500); await hold(['ArrowUp'], 300);
  const fill = await filled(p); await p.screenshot({ path: join(dir, 'play.png') });
  await p.keyboard.press('Escape'); await p.waitForTimeout(250); await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  const s = await state(p); await p.close();
  return { fill, s, errors };
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
const engines = [['agent', AGENT], ['full', FULL]];

console.log('my-3D2dge agent edition test');
console.log('1. header examples, on the agent edition and the full engine');
for (const ex of examples) {
  if (only && ex.name !== only) continue;
  for (const [eng, file] of engines) {
    const tag = ex.name + '-' + eng, r = await play(browser, file, ex, tag);
    const problems = [...r.errors, ...(r.s ? r.s.errors : ['no game: My3D2dge.current is empty'])];
    if (r.s && r.s.box) problems.push('the on-screen error box is showing');
    if (r.fill < .02) problems.push('the screen is blank during play (' + (r.fill * 100).toFixed(1) + '% filled)');
    if (problems.length) fail(tag, problems.join('; ')); else console.log('  ok   ' + tag.padEnd(22) + ' scene ' + String(r.s.scene).padEnd(8) + ' ' + Math.round(r.fill * 100) + '% filled');
  }
}

if (!only) {
  console.log('2. coverage scene (every option, pose, move, view and kit), on both engines');
  for (const [eng, file] of engines) {
    const { p, dir, errors } = await page(browser, file, COVERAGE, 'coverage-' + eng);
    await p.waitForTimeout(5200);   // every view, twice over
    const fill = await filled(p), s = await state(p); await p.screenshot({ path: join(dir, 'coverage.png') }); await p.close();
    const problems = [...errors, ...(s ? s.errors : ['no game'])];
    if (problems.length) fail('coverage-' + eng, problems.join('; ')); else console.log('  ok   coverage-' + eng + ' ' + Math.round(fill * 100) + '% filled');
  }

  console.log('3. API: every name in the agent edition exists in the full engine');
  const surface = async file => {
    const { p } = await page(browser, file, '', 'api-' + (file === AGENT ? 'agent' : 'full'));
    const names = await p.evaluate(() => {
      const E = My3D2dge, out = new Set(), cv = document.getElementById('screen');
      const own = (o, path) => { const seen = new Set(); for (let q = o; q && q !== Object.prototype && q !== Function.prototype; q = Object.getPrototypeOf(q)) for (const k of Object.getOwnPropertyNames(q)) if (k !== 'constructor' && !k.startsWith('_') && !seen.has(k)) { seen.add(k); out.add(path + '.' + k); } };
      for (const k of Object.keys(E)) {
        const v = E[k]; out.add('E.' + k);
        if (typeof v === 'function' && v.prototype) { for (const s of Object.keys(v)) out.add('E.' + k + '.' + s); }
        else if (v && typeof v === 'object' && k !== 'current') for (const s of Object.keys(v)) out.add('E.' + k + '.' + s);
      }
      const game = new E.Game({ canvas: cv }), map = new E.TileMap({ rows: ['#.'], legend: { '#': 1 }, types: { 1: {} } }), level = new E.PlatformMap({ rows: ['#'], legend: { '#': 1 }, types: { 1: {} } });
      const inst = { Game: game, Renderer: game.r, Audio: game.audio, Particles: game.particles, Input: game.input, Humanoid: new E.Humanoid(), Blob: new E.Blob(), TileMap: map, PlatformMap: level,
        Platformer: new E.Platformer(), Body: new E.Body(), Bullets: new E.Bullets(game), SpatialHash: new E.SpatialHash(), FlowField: new E.FlowField(map), Attack: new E.Attack('slash'),
        Combo: new E.Combo(['jab']), Dialog: new E.Dialog(game), Menu: new E.Menu(game, ['A']), View: E.VIEWS.iso };
      for (const k in inst) own(inst[k], k);
      return [...out];
    });
    await p.close(); return new Set(names);
  };
  const a = await surface(AGENT), f = await surface(FULL), AGENT_ONLY = new Set(['E.edition']);
  const missing = [...a].filter(n => !f.has(n) && !AGENT_ONLY.has(n));
  if (missing.length) fail('api', missing.length + ' name(s) are not in the full engine: ' + missing.join(', '));
  else console.log('  ok   ' + a.size + ' names, all in the full engine (which has ' + f.size + ')');

  console.log('4. the store it points to: every path named exists, and the clip recipe works');
  // the sections that point outside the engine files, from each place an agent reads
  const cut = (text, from, to) => { const i = text.indexOf(from); if (i < 0) return null; const j = text.indexOf(to, i + from.length); return text.slice(i, j < 0 ? undefined : j); };
  const FULLSRC = readFileSync(FULL, 'utf8'), API = readFileSync(join(root, 'API.md'), 'utf8'), GUIDE = readFileSync(join(root, 'AI_GUIDE.md'), 'utf8');
  const more = [['agent header', cut(header, '## More, outside this file', '\u0000')], ['full engine header', cut(FULLSRC, ' * MORE, outside this file', ' */')],
    ['API.md', cut(API, '## More: animation and examples', '\n## ')], ['AI_GUIDE.md', cut(GUIDE, '## Where to find more', '\n## ')]];
  let named = 0;
  for (const [where, text] of more) {
    if (!text) { fail('pointers', where + ' has no section pointing to the store'); continue; }
    // repo paths: alternatives <a|b> expanded, a placeholder (<set>, NN) or a glob checked as its folder; bare catalog names
    const paths = new Set();
    for (let m of text.match(/\b(?:src|docs|tools|examples|dist)\/[\w.\/<>|*-]+/g) || []) {
      m = m.replace(/[.,;:)]+$/, '');
      const alt = m.match(/<([\w|-]+)>/);
      if (alt && alt[1].includes('|')) for (const a of alt[1].split('|')) paths.add(m.replace(alt[0], a));
      else if (/<\w+>|\*|NN/.test(m)) paths.add(m.slice(0, m.lastIndexOf('/') + 1));
      else paths.add(m);
    }
    for (const m of text.match(/\b[\w-]+\.json\b/g) || []) if (!/\//.test(m)) paths.add('src/mocap/catalogs/' + m);
    for (const p of paths) { named++; if (!existsSync(join(root, p))) fail('pointers', where + ' names ' + p + ', which does not exist'); }
  }
  // the recipe as the agent header gives it: search the ledger, cut the two clips, play them on the agent edition
  const node = (args, what) => { const r = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' }); if (r.status) fail('pointers', what + ' failed: ' + (r.stderr || r.stdout).trim().split('\n')[0]); return r.stdout || ''; };
  if (!/^\d\d_\d\d\t/m.test(node(['tools/cmu.mjs', 'ledger', 'kick', '--top', '3'], 'node tools/cmu.mjs ledger kick'))) fail('pointers', 'the ledger search found no take');
  const take = (cut(header, 'node tools/anim-set.mjs', 'mine.js') || '').replace(/\(.*?\)/g, ' ').split(/\s+/).filter(Boolean);
  const setFile = join(out, 'store', 'mine.js'); mkdirSync(dirname(setFile), { recursive: true });
  if (take.length < 4) fail('pointers', 'the agent header has no anim-set command to cut clips');
  else {
    node(take.slice(1).concat([setFile]), take.join(' ') + ' mine.js');
    const clips = (take[take.indexOf('--clips') + 1] || '').split(',');
    const { p, errors } = await page(browser, AGENT, '', 'store');
    for (const f of [join(root, 'src/mocap/readable.js'), join(root, 'src/mocap/mocap.js'), setFile]) await p.addScriptTag({ path: f });
    const moved = await p.evaluate(names => {
      const E = My3D2dge, own = new E.Humanoid({}), rig = new E.Humanoid({}), s = { x: 0, y: 0, z: 0, vx: 0, vy: 0, facing: 0 };
      const lib = Mocap.load(MOCAP.MINE); Mocap.drive(rig, lib);
      return names.map(name => { const clip = lib.clip(name); if (!clip) return name + ' is not in the set'; let far = 0;
        for (let i = 1; i <= 60; i++) { own.update(1 / 60, s); rig.mocap = lib.sample(clip, i / 60); rig.update(1 / 60, s); for (const k of ['handL', 'handR', 'footL', 'footR', 'head']) far = Math.max(far, Math.hypot(...rig.J[k].map((v, j) => v - own.J[k][j]))); }
        return far > 1 ? null : name + ' does not move the rig'; }).filter(Boolean);
    }, clips);
    await p.close();
    for (const m of moved.concat(errors)) fail('pointers', m);
    if (!moved.length && !errors.length) console.log('  ok   ' + named + ' paths named in 4 places exist; the ledger search, the cut (' + clips.join(', ') + ') and both clips on the agent edition work');
  }
}
await browser.close();

console.log('5. size');
let tok = null;
try { const { encode } = await import('gpt-tokenizer/encoding/cl100k_base'); tok = s => encode(s).length; } catch (e) { /* optional */ }
const count = s => tok ? tok(s) + ' tokens' : '~' + Math.round(s.length / 2.6) + ' tokens (estimate; npm i gpt-tokenizer for exact cl100k counts)';
console.log('  file ' + (src.length / 1024).toFixed(1) + ' KB, ' + count(src) + '; the header (the manual) ' + count(src.slice(0, src.indexOf('*/') + 2)));

console.log(failures.length ? failures.length + ' failure(s)' : 'all passed; screenshots in ' + out);
process.exit(failures.length ? 1 : 0);
