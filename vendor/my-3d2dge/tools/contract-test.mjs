// Contract tests: one test for each documented behavior an agent relies on, on both editions (the full engine and the
// agent edition). A promise in API.md, AI_GUIDE.md or a header that no test holds drifts: the old header promised the
// same motion at 60, 120 and 144 Hz for months while the step size followed the refresh rate.
//   the clock      the same inputs at 60, 90, 120 and 144 Hz give the same state after the same time; steps are 1/120 s
//                  of real time, slow motion shortens them, pause and timeScale 0 still tick input, fps reads real time,
//                  the first frame updates before it draws
//   flow fields    a FlowField follows map.block() and map.set() at its next update
//   heights        E.HEIGHTS, map.ray/sight/standable/ledge/landing/drop/arcClear, E.inArc's dz, E.sameLevel, E.targets
//                  and FlowField over heights, on small maps (a roof edge, a kerb, a gap, a planter, a guard above)
//   audio          audio.duck(on) is public
//   third person   E.sees, E.hears, maps built in code (fill, setFloor) and r.marker's edge arrow on both editions; on the
//                  full one E.Mover climbs, vaults, leaps a gap, hops down, rolls, takes fall damage and jumps once a press,
//                  E.ACTIONS and E.Action (your own, paired, invulnerable, cancellable), E.Suspicion, FlowField jump links
//                  and next(), and in Chromium footprint sorting, the decorate hook and r.sightCone cut by a wall
//   shell          E.Shell: its HUD shows the state it is given, its pause screen follows game.paused (with the standard
//                  menu's Settings, Controls and Full screen), the game's input moves the focus and is held back while a
//                  screen is open, a button's act reaches the game, settings apply, toasts time out, dispose() takes it
//                  away; headless it keeps its screens' names (the standard features in depth: tools/standard-test.mjs)
//   the asset card docs/ASSETS.md's examples: on the full engine the shapes draw, the solid is placed, the sprite made, the
//                  surfaces take their materials and every worked entry draws; on the agent edition they run, the
//                  registries keep what a game adds and the calls warn (the suite in depth: tools/assets-test.mjs)
// Usage: node tools/contract-test.mjs [--node]   (exit code 1 on a failure; --node runs only the part without a browser). What runs without a screen runs in Node; the game loop
// runs in headless Chromium on a virtual clock (CHROMIUM_PATH picks a browser).
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const EDITIONS = [['full', 'engine/my-3d2dge.js'], ['agent', 'engine/my-3d2dge-agent.js']];
const failures = [];
let passed = 0;
const check = (name, ok, detail = '') => { if (ok) passed++; else { failures.push(name + (detail ? ': ' + detail : '')); console.log('  FAIL ' + name + (detail ? ': ' + detail : '')); } };
/** the engine loaded in Node, as a game's script would load it (a context of its own per call) */
const load = file => { const ctx = { console }; vm.createContext(ctx); vm.runInContext(readFileSync(join(root, file), 'utf8'), ctx, { filename: file }); return ctx.My3D2dge; };

// the fenced examples of the cards and the index (```js name ... ```)
const FENCED = file => [...readFileSync(join(root, file), 'utf8').matchAll(/```js( \w+)?\n([\s\S]*?)\n```/g)].map((m, i) => ({ file, name: (m[1] || '').trim() || '#' + (i + 1), code: m[2] }));
const EXAMPLES = [...FENCED('API.md'), ...FENCED('API-INDEX.md')];

// ---- in Node: what needs no screen
for (const [ed, file] of EDITIONS) {
  const E = load(file);
  console.log(`\n${ed} edition (Node)`);
  // flow fields follow the map: a corridor along the top, a way round along the bottom
  const map = new E.TileMap({ rows: ['#########', '#.......#', '#.#####.#', '#.......#', '#########'], legend: { '#': 1 }, types: { 1: { h: 24 } } });
  const flow = new E.FlowField(map), T = map.T, d = (cx, cy) => flow.d[cy * map.w + cx];
  const at = () => { flow.update(1.5 * T, 1.5 * T); return d(7, 1); };
  check(`${ed}: flow field, open corridor`, at() === 6, 'distance ' + d(7, 1));
  const v0 = map.version; map.block(4, 1);
  check(`${ed}: block() bumps map.version`, map.version === v0 + 1);
  map.block(4, 1); check(`${ed}: block() with the same value leaves map.version`, map.version === v0 + 1);
  check(`${ed}: flow field follows block()`, at() === 10, 'distance ' + d(7, 1) + ', want 10 (round the bottom)');
  map.block(4, 1, false); check(`${ed}: flow field follows unblocking`, at() === 6, 'distance ' + d(7, 1));
  map.set(4, 1, 1); check(`${ed}: flow field follows set() closing a door`, at() === 10, 'distance ' + d(7, 1));
  map.set(4, 1, 0); check(`${ed}: flow field follows set() opening a door`, at() === 6, 'distance ' + d(7, 1));
  heights(E, ed);
  examples(E, ed);
  lifecycle(E, ed);
  seesAndMaps(E, ed);
  if (ed === 'full') thirdPerson(E, ed);   // (the rest of the kit is the full engine's)
  shellHeadless(E, ed);
}

// every fenced example in API.md and API-INDEX.md runs: a snippet in Node, in a headless game when it uses one it
// doesn't make; a complete game ((() => { ... })()) in Chromium, below
function examples(E, ed) {
  for (const x of EXAMPLES.filter(x => !/^\(\(\) => \{/.test(x.code.trim()))) {
    const own = /\b(?:const|let|var)\s[^;]*\bgame\s*=/.test(x.code), game = own ? null : new E.Game({ headless: true });
    try {
      new Function('My3D2dge', ...(own ? [] : ['game']), x.code)(E, ...(own ? [] : [game]));
      if (game && game.scene) { game.input.tap('start'); game.advance(.5); }
      check(`${ed}: ${x.file} example ${x.name} runs`, true);
    } catch (e) { check(`${ed}: ${x.file} example ${x.name} runs`, false, e.message); }
  }
}

// the lifecycle and headless runs: advance, stop, start, dispose, tap and hold
function lifecycle(E, ed) {
  const game = new E.Game({ headless: true, res: 'snes' }), I = game.input;
  check(`${ed}: a game in Node is headless, sized like a 1280 x 720 window`, game.headless && game.screen.W === 256 && game.screen.H === 224 && game.r === null && new E.Game().screen.W === 427);
  let ups = 0, draws = 0, taps = 0, downs = 0, ups2 = 0;
  game.start({ update() { ups++; if (I.pressed('jump')) taps++; if (I.down('jump')) downs++; if (I.released('jump')) ups2++; }, draw() { draws++; } });
  check(`${ed}: advance(1) runs 120 fixed steps at once`, game.advance(1) === 120 && ups === 120 && Math.abs(game.time - 1) < 1e-9, ups + ' ' + game.time);
  check(`${ed}: a headless game never draws`, game.advance(.1, { draw: true }) === 12 && draws === 0);
  I.tap('jump'); game.advance(1 / 120); game.advance(1 / 120); game.advance(1 / 120);
  check(`${ed}: tap() is pressed and down for one step, released the next`, taps === 1 && downs === 1 && ups2 === 1, [taps, downs, ups2].join(','));
  I.hold('jump'); game.advance(.05); const held = I.down('jump'); I.hold('jump', false); game.advance(1 / 120);
  check(`${ed}: hold(a) holds an action until hold(a, false)`, held && !I.down('jump') && taps === 2);
  game.dispose();
  check(`${ed}: dispose() ends it`, game.disposed && E.current !== game);
  let threw = ''; try { new E.Game({ headless: true }).advance(1); } catch (e) { threw = e.message; }
  check(`${ed}: advance() before start() says what to do`, /start/.test(threw), threw);
}

// the height rules (E.HEIGHTS): collision, standing, sight, reach and navigation read heights the same way
function heights(E, ed) {
  const T = 16, C = (cx, cy, z = 0, r = 5) => ({ x: (cx + .5) * T, y: (cy + .5) * T, z, r });
  // a street between two roof blocks (40), a planter (12), a kerb (2), deep water, walls of 120 round it all
  const city = new E.TileMap({ rows: [
    '############',
    '#..........#',
    '#..p....k..#',
    '#RRR..RRR..#',
    '#RRR..RRR..#',
    '#..........#',
    '#.....~~...#',
    '############'], legend: { '#': 1, R: 2, p: 3, k: 4, '~': { floor: 'water', block: true } }, types: { 1: { h: 120 }, 2: { h: 40 }, 3: { h: 12 }, 4: { h: 2 } } });
  const H = E.HEIGHTS;
  check(`${ed}: E.HEIGHTS`, H && H.eye > H.chest && H.level === 8 && H.step === 2, JSON.stringify(H));
  // sight: over a planter lower than the eyes (los, ground only, says no), blocked by a roof, down from a roof's edge
  const a = C(1, 2), b = C(5, 2);
  check(`${ed}: sight sees over a planter lower than its eyes`, city.sight(a, b) && !city.los(a.x, a.y, b.x, b.y));
  check(`${ed}: sight from the street is blocked by a roof`, !city.sight({ x: 72, y: 40, z: 0 }, { x: 40, y: 88, z: 0 }));
  check(`${ed}: a guard at a roof's edge sees the street below`, city.sight({ x: 60, y: 72, z: 40 }, { x: 90, y: 90, z: 0 }));
  check(`${ed}: a guard in the middle of a roof can't see the street close under its edge`, !city.sight({ x: 40, y: 56, z: 40 }, { x: 72, y: 88, z: 0 }));
  check(`${ed}: a crouched body (chest 6) right behind the planter is hidden from eyes at 10`, !city.sight({ x: 1.2 * T, y: 2.5 * T, z: 0, eye: 10 }, { x: 4.2 * T, y: 2.5 * T, z: 0, chest: 6 }));
  check(`${ed}: sight's o.eye and o.target override the bodies'`, city.sight({ x: 1.2 * T, y: 2.5 * T, z: 0, eye: 10 }, { x: 4.2 * T, y: 2.5 * T, z: 0, chest: 6 }, { eye: 30, target: 22 }));
  // ray: where it stops
  const open = city.ray({ x: 4.5 * T, y: 1.5 * T, z: 0 }, { x: 4.5 * T, y: 4.5 * T, z: 0 }, { eye: 10, target: 10 });
  check(`${ed}: ray is clear down an open street`, open.clear && open.t === 1, JSON.stringify(open));
  const wall = city.ray({ x: 4.5 * T, y: 3.5 * T, z: 0 }, { x: 0.5 * T + 20, y: 3.5 * T, z: 0 }, { eye: 10, target: 10 });
  check(`${ed}: ray stops at a roof's side`, !wall.clear && Math.abs(wall.x - 4 * T) < 1e-9 && wall.z === 10, JSON.stringify(wall));
  const onto = city.ray({ x: 4.5 * T, y: 3.5 * T, z: 60 }, { x: 1.5 * T, y: 3.5 * T, z: 20 });
  check(`${ed}: ray comes down onto a roof's top`, !onto.clear && Math.abs(onto.z - 40) < 1e-9 && onto.x < 4 * T, JSON.stringify(onto));
  const diag = city.ray({ x: 4.5 * T, y: 1.5 * T, z: 0 }, { x: 9.5 * T, y: 6.5 * T, z: 0 }, { eye: 1, target: 1 });
  check(`${ed}: ray stops at a roof on a diagonal`, !diag.clear, JSON.stringify(diag));
  // standable
  check(`${ed}: standable on a roof`, city.standable(2 * T, 3.5 * T, 40, 5));
  check(`${ed}: not standable on the floor inside a roof`, !city.standable(2 * T, 3.5 * T, 0, 5));
  check(`${ed}: not standable in the air`, !city.standable(4.5 * T, 1.5 * T, 20, 5));
  check(`${ed}: not standable in deep water`, !city.standable(7 * T, 6.5 * T, 0, 5));
  check(`${ed}: standable on a kerb (2), from the floor or on it`, city.standable(8.5 * T, 2.5 * T, 0, 5) && city.standable(8.5 * T, 2.5 * T, 2, 5));
  // ledge: a 40-unit roof ahead of a body in the street; a 120-unit wall is too high; a drop first is a jump
  const climber = { x: 4.5 * T, y: 3.5 * T, z: 0, r: 5 }, L = city.ledge(climber, Math.PI);
  check(`${ed}: ledge finds the roof's edge and a spot on top`, L && L.z === 40 && L.rise === 40 && Math.abs(L.edge[0] - 4 * T) < .2 && L.x < 4 * T && city.standable(L.x, L.y, L.z, 5), JSON.stringify(L));
  check(`${ed}: ledge takes a vector as a direction`, JSON.stringify(city.ledge(climber, [-3, 0])) === JSON.stringify(L));
  check(`${ed}: no ledge on a wall higher than rise`, city.ledge({ x: 1.5 * T, y: 1.5 * T, z: 0, r: 5 }, -Math.PI / 2) === null);
  check(`${ed}: no ledge where a drop comes first`, city.ledge({ x: 3.6 * T, y: 3.5 * T, z: 40, r: 5 }, 0) === null);
  check(`${ed}: a kerb (rise 2) is no ledge`, city.ledge({ x: 8.5 * T, y: 1.5 * T, z: 0, r: 5 }, Math.PI / 2) === null);
  // landing: across the street from one roof to the other; a pole in the gap needs a higher arc; a roof too high to reach
  const jumper = { x: 3.5 * T, y: 3.5 * T, z: 40, r: 5 }, J = city.landing(jumper, 0, { min: 20 });
  check(`${ed}: landing across a gap onto the next roof`, J && J.z === 40 && J.x >= 6 * T + 5 && city.standable(J.x, J.y, J.z, 5), JSON.stringify(J));
  check(`${ed}: no landing past max`, city.landing(jumper, 0, { min: 20, max: 30 }) === null);
  check(`${ed}: no landing with a wall before the gap`, city.landing({ x: 4.5 * T, y: 1.5 * T, z: 0, r: 5 }, -Math.PI / 2) === null);
  const gaps = h => new E.TileMap({ rows: ['#########', '#AA.P.BB#', '#########'], legend: { '#': 1, A: 2, P: 3, B: 4 }, types: { 1: { h: 120 }, 2: { h: 40 }, 3: { h: 70 }, 4: { h } } });
  const runner = { x: 2.5 * T, y: 1.5 * T, z: 40, r: 5 };
  check(`${ed}: no landing when a pole in the gap rises above the arc`, gaps(40).landing(runner, 0, { min: 20 }) === null);
  const P = gaps(40).landing(runner, 0, { min: 20, apex: 40 });
  check(`${ed}: a higher arc clears the pole`, P && P.z === 40 && P.x > 6 * T, JSON.stringify(P));
  check(`${ed}: no landing on a roof higher than rise`, gaps(60).landing(runner, 0, { min: 20, apex: 45 }) === null && !!gaps(60).landing(runner, 0, { min: 20, apex: 45, rise: 25 }));
  // drop: off a roof's edge, and none facing inward
  const D = city.drop({ x: 3.6 * T, y: 3.5 * T, z: 40, r: 5 }, 0);
  check(`${ed}: drop off a roof's edge`, D && D.z === 0 && D.fall === 40, JSON.stringify(D));
  check(`${ed}: no drop facing into the roof`, city.drop({ x: 3.6 * T, y: 3.5 * T, z: 40, r: 5 }, Math.PI) === null);
  // arcClear: over the planter with a 20 apex, not with 5
  check(`${ed}: an arc clears a planter`, city.arcClear(C(1, 2), C(5, 2), 20, 5));
  check(`${ed}: a low arc doesn't`, !city.arcClear(C(1, 2), C(5, 2), 5));
  // helpers: reach and the same level
  const hero = { x: 4.5 * T, y: 3.5 * T, z: 40, facing: Math.PI }, low = { x: 3.5 * T, y: 3.5 * T, z: 0, r: 4 }, near = { x: 4.0 * T, y: 3.5 * T, z: 38, r: 4 };
  check(`${ed}: inArc without dz stays flat`, E.inArc(hero, Math.PI, low, 20, 1));
  check(`${ed}: inArc with dz limits the height difference`, !E.inArc(hero, Math.PI, low, 20, 1, 8) && E.inArc(hero, Math.PI, near, 20, 1, 8));
  check(`${ed}: sameLevel`, E.sameLevel(hero, near) && !E.sameLevel(hero, low) && E.sameLevel(hero, low, 40));
  const tg = E.targets(hero, [low, near, { x: 9 * T, y: 3.5 * T, z: 40 }], { range: 30 });
  check(`${ed}: targets keeps the same level, nearest first`, tg.length === 1 && tg[0].target === near && Math.abs(tg[0].dz + 2) < 1e-9 && Math.abs(tg[0].angle - Math.PI) < 1e-9, JSON.stringify(tg.map(t => [t.d, t.dz])));
  const tg2 = E.targets(hero, [low, near], { range: 30, dz: 50 });
  check(`${ed}: targets with dz reaches down, nearest first`, tg2.length === 2 && tg2[0].target === near && tg2[1].target === low);
  check(`${ed}: targets with an arc leaves out what's behind`, E.targets(hero, [near], { range: 30, arc: .5, facing: 0 }).length === 0);
  check(`${ed}: targets with sight leaves out what a roof hides`, E.targets({ x: 72, y: 40, z: 0 }, [{ x: 40, y: 88, z: 0 }], { range: 100, sight: city }).length === 0 && E.targets({ x: 4.5 * T, y: 5.5 * T, z: 0 }, [{ x: 4.5 * T, y: 1.5 * T, z: 0 }], { range: 100, sight: city }).length === 1);
  // Body.step: a body walks onto a kerb of 2 (E.HEIGHTS.step) and is stopped by a planter of 12
  const walker = new E.Body({ x: 8.5 * T, y: 1.5 * T, r: 5, vy: 60 });
  for (let i = 0; i < 30; i++) walker.update(1 / 120, city);   // a quarter second: onto the kerb (row 2)
  check(`${ed}: Body.step: a body walks onto a top within step`, walker.z === 2 && walker.onGround && Math.abs(walker.y - 39) < 1e-9, walker.y + ' ' + walker.z);
  const blocked = new E.Body({ x: 3.5 * T, y: 1.5 * T, r: 5, vy: 60 });
  for (let i = 0; i < 60; i++) blocked.update(1 / 120, city);
  check(`${ed}: Body.step: a top higher than step stops it`, Math.abs(blocked.y - (2 * T - 5)) < 1e-6 && blocked.z === 0, blocked.y + ' ' + blocked.z);
  // navigation over heights
  const f0 = new E.FlowField(city), fd = (f, cx, cy) => f.d[cy * city.w + cx];
  f0.update(4.5 * T, 5.5 * T);
  check(`${ed}: a default field stays on the floor`, fd(f0, 4, 1) === 4 && fd(f0, 2, 3) >= 1e9, [fd(f0, 4, 1), fd(f0, 2, 3)].join(','));
  check(`${ed}: a default field walks over a kerb no higher than step`, fd(f0, 8, 2) === 7, String(fd(f0, 8, 2)));
  check(`${ed}: a default field avoids deep water`, fd(f0, 6, 6) >= 1e9);
  const fr = new E.FlowField(city); fr.update(2.5 * T, 4.5 * T);
  check(`${ed}: a target on a roof gets a field across the roof`, fd(fr, 1, 3) === 2 && fd(fr, 4, 3) >= 1e9, [fd(fr, 1, 3), fd(fr, 4, 3)].join(','));
  const fc = new E.FlowField(city, { climb: 40, drop: 40 }); fc.update(2.5 * T, 4.5 * T);
  check(`${ed}: with climb a field reaches the roof from the street`, fd(fc, 4, 3) === 3 && fd(fc, 4, 1) === 5, [fd(fc, 4, 3), fd(fc, 4, 1)].join(','));
  const dir = fc.dir(4.5 * T, 3.5 * T, 2.5 * T, 4.5 * T);
  check(`${ed}: dir climbs toward a target on a roof`, dir[0] < -.5, JSON.stringify(dir));
  const fdn = new E.FlowField(city, { drop: 40 }); fdn.update(4.5 * T, 5.5 * T);
  check(`${ed}: with drop, a roof agent hops down; the street can't climb up`, fd(fdn, 2, 3) < 1e9 && fd(f0, 2, 3) >= 1e9);
  const fup = new E.FlowField(city, { drop: 40 }); fup.update(2.5 * T, 4.5 * T);
  check(`${ed}: with drop only, no field from the street up to a roof`, fd(fup, 4, 3) >= 1e9);
}

// the third-person kit: the ground controller, actions, perception, jump links, maps built in code
function thirdPerson(E, ed) {
  const T = 16, still = { move: [0, 0] };
  // two roofs (40 and 44) three cells apart, a low wall (10) to vault, open street round them, walls of 120
  const map = new E.TileMap({ rows: [
    '##############',
    '#............#',
    '#.AAA...BBB..#',
    '#.AAA...BBB..#',
    '#.AAA...BBB..#',
    '#............#',
    '#..w.........#',
    '#............#',
    '##############'], legend: { '#': 1, A: 2, B: 3, w: 4 }, types: { 1: { h: 120 }, 2: { h: 40 }, 3: { h: 44 }, 4: { h: 10 } } });
  const run = (m, sec, ctl = still) => { for (let i = 0; i < Math.round(sec * 120); i++) m.update(1 / 120, map, ctl); return m; };
  // climb: at the foot of A's south wall, facing it, a jump press climbs it
  const c = new E.Mover({ x: 3.5 * T, y: 5.5 * T }); c.facing = -Math.PI / 2;
  c.update(1 / 120, map, { move: [0, 0], jumpPressed: true });
  const climbing = c.action && c.action.name, hang = c.rigState();
  run(c, 1.5);
  check(`${ed}: Mover climbs a ledge with a jump press`, climbing === 'climbUp' && c.z === 40 && c.onGround && !c.action && c.y < 5 * T, [climbing, c.x, c.y, c.z].join(' '));
  check(`${ed}: Mover.rigState() is the action's while it plays`, hang.x !== undefined && hang.facing === -Math.PI / 2, JSON.stringify(hang));
  // a gap: running east off A toward B with a jump at the edge lands on B (the gap assist)
  const l = new E.Mover({ x: 3 * T, y: 3.5 * T, z: 40 }); l.facing = 0;
  let pressed = false;
  for (let i = 0; i < 240; i++) { const at = !pressed && l.onGround && map.drop(l, 0, { reach: 10 }); if (at) pressed = true; l.update(1 / 120, map, { move: [1, 0], jumpPressed: !!at }); if (pressed && l.onGround && l.x > 8 * T) break; }
  check(`${ed}: Mover leaps a gap onto the far roof`, pressed && l.z === 44 && l.x > 8 * T && l.x < 11 * T, [l.x, l.z].join(' '));
  // one jump a press: pressing again in the next steps (coyote time) doesn't jump again, after a leap or a plain jump
  const peak = (x, z, again) => { const m = new E.Mover({ x, y: 3.5 * T, z, vx: 85 }); let p = 0, t0 = -1;
    for (let i = 0; i < 120; i++) { if (t0 < 0 && (map.drop(m, 0, { reach: 10 }) || !z)) t0 = i; m.update(1 / 120, map, { move: [1, 0], jumpPressed: i === t0 || (again && i === t0 + 6) }); p = Math.max(p, m.z); } return p; };
  check(`${ed}: Mover jumps once a press, even pressed again in the air at once`, peak(4.6 * T, 40) > 60 && peak(4.6 * T, 40, true) === peak(4.6 * T, 40) && peak(6 * T, 0, true) === peak(6 * T, 0),
    [peak(4.6 * T, 40), peak(4.6 * T, 40, true), peak(6 * T, 0), peak(6 * T, 0, true)].join(' '));
  // vault: running at the low wall with a jump goes over it
  const v = new E.Mover({ x: 3.5 * T, y: 7.6 * T }); v.facing = -Math.PI / 2;
  let vaulted = null;
  for (let i = 0; i < 240; i++) { v.update(1 / 120, map, { move: [0, -1], jumpPressed: i === 6 }); if (v.action) vaulted = v.action.name; if (vaulted && !v.action && v.onGround) break; }
  check(`${ed}: Mover vaults a low wall at a run`, vaulted === 'vault' && v.y < 6 * T && v.z === 0, [vaulted, v.y, v.z].join(' '));
  // hop down: off B's south edge, where no roof is near to leap to
  const h = new E.Mover({ x: 9.5 * T, y: 4.6 * T, z: 44 }); h.facing = Math.PI / 2;
  let hop = null;
  for (let i = 0; i < 240; i++) { const at = !hop && map.drop(h, Math.PI / 2, { reach: 10 }); h.update(1 / 120, map, { move: [0, 1], jumpPressed: !!at }); if (h.action) hop = hop || h.action.name; if (hop && !h.action && h.onGround) break; }
  check(`${ed}: Mover hops down a ledge`, hop === 'hopDown' && h.z === 0 && h.onGround, [hop, h.y, h.z].join(' '));
  // falls: a long one hurts, a mid one at speed rolls
  const f = new E.Mover({ x: 11.5 * T, y: 6.5 * T, z: 90 }); f.onGround = false;
  let hurt = false; for (let i = 0; i < 240 && !hurt; i++) { f.update(1 / 120, map, still); hurt = f.hurt; }
  check(`${ed}: Mover: a fall from higher than hurtAt hurts`, hurt && f.fell >= 72, String(f.fell));
  const rl = new E.Mover({ x: 5 * T, y: 6.5 * T, z: 34, vx: 60 }); rl.onGround = false;
  let rolled = null; for (let i = 0; i < 240 && !rolled; i++) { rl.update(1 / 120, map, { move: [1, 0] }); if (rl.action) rolled = rl.action.name; }
  check(`${ed}: Mover: a fall past rollAt at speed rolls`, rolled === 'roll', String(rolled));
  const sf = new E.Mover({ x: 6.5 * T, y: 7.5 * T }); run(sf, .1); const safe = sf.lastSafe && sf.lastSafe.x;
  Object.assign(sf, { x: 1, y: 1 }); sf.respawn();
  check(`${ed}: Mover.respawn() goes back to the last safe spot`, safe === 6.5 * T && sf.x === 6.5 * T && sf.onGround, JSON.stringify(sf.lastSafe));
  // actions: the built-in names, your own, a paired takedown, invulnerable frames, a cancellable beat
  check(`${ed}: E.ACTIONS has climbUp, vault, hopDown, roll, getUp, takedown`, ['climbUp', 'vault', 'hopDown', 'roll', 'getUp', 'takedown'].every(n => E.ACTIONS[n]));
  E.ACTIONS.slide = { beats: [['go', .5]], setup() {}, at: (A, b, u) => ({ x: A.start.x + 20 * u, y: A.start.y, z: 0, state: { pose: 'crouch' } }) };
  const body = { x: 10, y: 10, z: 0 }, s = new E.Action('slide', { body }); let n = 0; while (s.update(1 / 120)) n++;
  delete E.ACTIONS.slide;
  check(`${ed}: your own E.ACTIONS entry plays on any { x, y, z }`, Math.abs(s.duration - .5) < 1e-12 && body.x === 30 && s.done && n > 50 && n < 62, [s.duration, body.x, s.done, n].join(' '));
  const hero = new E.Mover({ x: 50, y: 50 }), guard = new E.Mover({ x: 62, y: 50 }); hero.facing = guard.facing = 0;
  const td = hero.play('takedown', { other: guard }); while (td.update(1 / 120));
  check(`${ed}: a takedown moves two bodies and leaves the other down`, td.other === guard && td.otherState().down === 1 && Math.hypot(guard.x - hero.x, guard.y - hero.y) < 14, JSON.stringify(td.otherState()));
  const roll = new E.Action('roll', { body: { x: 0, y: 0, z: 0 }, dir: 0, dist: 30 }), inv = [];
  while (roll.update(1 / 120)) inv.push(roll.invulnerable);
  check(`${ed}: a roll is invulnerable in its middle only`, !inv[0] && inv.includes(true) && !inv[inv.length - 1], inv.map(Number).join('').replace(/(.)\1+/g, '$1*'));
  const cu = new E.Mover({ x: 3.5 * T, y: 5.5 * T }); cu.facing = -Math.PI / 2; cu.update(1 / 120, map, { move: [0, 0], jumpPressed: true });
  check(`${ed}: a climb can be let go of while hanging (canCancel)`, cu.action && cu.action.canCancel && cu.action.beat === 'hang');
  const g = { x: 1.5 * T, y: 1.5 * T, z: 0, facing: 0 }, tgt = (x, y, o) => Object.assign({ x, y, z: 0, r: 5 }, o), noise = { x: 5.5 * T, y: 1.5 * T, z: 0, loud: 80 };
  const mind = new E.Suspicion(), states = new Set(), who = tgt(4 * T, 1.5 * T);
  for (let i = 0; i < 240; i++) states.add(mind.update(1 / 120, E.sees(g, who, { map }), who));
  check(`${ed}: E.Suspicion rises calm, notice, search, alert while it sees, and keeps where`, ['notice', 'search', 'alert'].every(x => states.has(x)) && mind.state === 'alert' && mind.last.x === who.x, [...states].join(','));
  for (let i = 0; i < 120 * 3; i++) mind.update(1 / 120, false);
  const searching = mind.state;
  for (let i = 0; i < 120 * 8; i++) mind.update(1 / 120, false);
  check(`${ed}: E.Suspicion: an alert guard that loses the target searches, then calms down`, searching === 'search' && mind.state === 'calm', searching + ' ' + mind.state);
  mind.reset(); mind.hear(1, noise);
  check(`${ed}: E.Suspicion.hear: noticed at least, never more than searching`, mind.level >= mind.notice && mind.level <= mind.search && mind.last.x === noise.x, String(mind.level));
  // jump links: from A to B the field leaps (a climb costs more than the jump); without jump it drops and climbs
  const leapField = new E.FlowField(map, { climb: 56, drop: 56, jump: 60 }), walkField = new E.FlowField(map, { climb: 56, drop: 56 });
  leapField.update(9.5 * T, 3.5 * T); walkField.update(9.5 * T, 3.5 * T);
  const nl = leapField.next(4.5 * T, 3.5 * T), nw = walkField.next(4.5 * T, 3.5 * T);
  check(`${ed}: FlowField with jump: next() leaps the gap, with edge`, nl && nl.kind === 'jump' && nl.z === 44 && nl.x === 8.5 * T && nl.edge === 8, JSON.stringify(nl));
  check(`${ed}: FlowField without jump: next() drops into the street`, nw && nw.kind === 'drop' && nw.z === 0, JSON.stringify(nw));
  check(`${ed}: FlowField with jump: a jump of k cells costs k`, leapField.d[3 * map.w + 4] === 5, String(leapField.d[3 * map.w + 4]));
}

// sight, hearing and maps built in code (both editions)
function seesAndMaps(E, ed) {
  const T = 16, map = new E.TileMap({ rows: ['##############', '#............#', '#.AAA...BBB..#', '#.AAA...BBB..#', '#.AAA...BBB..#', '#............#', '##############'],
    legend: { '#': 1, A: 2, B: 3 }, types: { 1: { h: 120 }, 2: { h: 40 }, 3: { h: 44 } } });
  // perception: in front and in range, behind, too far, behind a roof, crouched, hidden by exposure
  const g = { x: 1.5 * T, y: 1.5 * T, z: 0, facing: 0 }, tgt = (x, y, o) => Object.assign({ x, y, z: 0, r: 5 }, o);
  const seen = E.sees(g, tgt(5.5 * T, 1.5 * T), { map });
  check(`${ed}: E.sees: in front, in range: seen, exposure 1`, seen.seen && seen.exposure === 1 && seen.d === 64, JSON.stringify(seen));
  check(`${ed}: E.sees: behind or out of range: not seen`, !E.sees(Object.assign({}, g, { facing: Math.PI }), tgt(5.5 * T, 1.5 * T)).seen && !E.sees(g, tgt(12.5 * T, 1.5 * T), { range: 100 }).seen);
  const wall = { x: 1.5 * T, y: 3.5 * T, z: 0, facing: 0 };
  check(`${ed}: E.sees: not through a roof (with map), seen without it`, !E.sees(wall, tgt(5.5 * T, 3.5 * T), { map, range: 200 }).seen && E.sees(wall, tgt(5.5 * T, 3.5 * T), { range: 200 }).seen);
  const low = E.sees(g, tgt(5.5 * T, 1.5 * T, { crouch: true }), { map });
  check(`${ed}: E.sees: a crouched target shows less, a hidden one not at all`, low.seen && low.exposure < 1 && !E.sees(g, tgt(5.5 * T, 1.5 * T, { exposure: 0 }), { map }).seen, JSON.stringify(low));
  const noise = { x: 5.5 * T, y: 1.5 * T, z: 0, loud: 80 };
  check(`${ed}: E.hears: 1 at the noise, 0 beyond its radius`, E.hears(noise, noise) === 1 && E.hears(g, Object.assign({}, noise, { loud: 30 })) === 0);
  const muffled = E.hears(wall, { x: 5.5 * T, y: 3.5 * T, z: 0, loud: 100 }, map), open = E.hears(wall, { x: 5.5 * T, y: 3.5 * T, z: 0, loud: 100 });
  check(`${ed}: E.hears: a wall between halves it`, Math.abs(muffled - open / 2) < 1e-12 && open > 0, muffled + ' ' + open);
  // a map built in code
  const built = new E.TileMap({ w: 6, h: 5, types: { 2: { h: 30 } } }), v0 = built.version;
  built.fill(1, 1, 2, 2, 2);
  check(`${ed}: new E.TileMap({ w, h }) starts open; fill() puts a block in`, built.cell(0, 0) === 0 && built.cell(2, 2) === 2 && built.cell(3, 3) === 0 && built.height(1, 1) === 30 && built.version > v0);
  built.setFloor(4, 3, 'water', true); const bf = new E.FlowField(built); bf.update(4.5 * T, .5 * T);
  check(`${ed}: setFloor() tags and blocks a cell; fields go round it`, built.floorAt(4.5 * T, 3.5 * T) === 'water' && built.blocked[3 * 6 + 4] === 1 && bf.d[3 * 6 + 4] >= 1e9);
  built.fill(1, 1, 2, 2, 0); check(`${ed}: fill() with 0 clears`, built.cell(1, 1) === 0 && built.cell(2, 2) === 0);
}

// E.Shell in a headless game: no DOM, but its screens' names, the pause it follows and back() still work; the agent
// edition's stand-in does nothing and doesn't throw
function shellHeadless(E, ed) {
  const game = new E.Game({ headless: true }), ui = new E.Shell(game, { screens: { pause: { text: 'x' } } });
  game.start({ scenes: { play: { pausable: true, update() { ui.hud({ objective: { title: 'x' } }); }, draw() {} } }, scene: 'play' });
  if (ed === 'agent') { ui.show('pause'); check(`${ed}: E.Shell is a stand-in that does nothing`, ui.screen === null && ui.root === null); return; }
  game.input.tap('pause'); game.advance(2 / 120);
  const opened = ui.screen; ui.back();
  check(`${ed}: E.Shell headless: the pause screen follows game.paused, back() resumes`, opened === 'pause' && ui.screen === null && !game.paused && ui.root === null, opened + ' ' + ui.screen + ' ' + game.paused);
}

// ---- in the browser: the game loop, on a virtual clock that only moves when the test says so
const CLOCK = () => {
  let now = 0, due = [];
  Object.defineProperty(performance, 'now', { value: () => now, configurable: true, writable: true });
  window.requestAnimationFrame = f => { due.push(f); return due.length; };
  /** run one display frame at time t (ms) */
  window.__frame = t => { now = t; const run = due; due = []; for (const f of run) f(t); };
};
// one game, played at `hz`: the hero walks, jumps onto a block, slows to half speed and back, all from input pressed at
// times every rate has a frame at (multiples of 1/6 s). Returns its state after 2.5 s, and what the clock did.
const PLAY = hz => {
  const E = My3D2dge, game = new E.Game({ canvas: 'screen', res: 'snes' }), I = game.input, frame = 1000 / hz;
  const map = new E.TileMap({ rows: ['##########', '#........#', '#....11..#', '#........#', '##########'], legend: { '#': 1, '1': 2 }, types: { 1: { h: 40 }, 2: { h: 14 } } });
  const hero = new E.Body({ x: 30, y: 40, r: 5 }), dts = new Set();
  let peak = 0, fired = 0, jumps = 0, frames = 0, steps = [];
  game.every(.25, () => fired++);
  game.start({ update(dt) {
    dts.add(dt);
    const [mx] = I.move(); hero.vx = mx * 80;
    if (I.pressed('jump') && hero.jump(210)) jumps++;
    hero.update(dt, map); if (!hero.onGround) peak = Math.max(peak, hero.z);
  }, draw(r) { r.sky(['#000', '#000']); } });
  const at = t => { while (frames * frame < t * 1000 - 1e-6) { window.__frame(++frames * frame); steps.push(game.stats.steps); } };
  at(1 / 6); I.press('KeyD');
  at(3 / 6); I.press('KeyZ'); at(4 / 6); I.release('KeyZ');
  at(1); game.timeScale = .5;
  at(8 / 6); I.press('KeyZ'); at(9 / 6); I.release('KeyZ');
  at(1.5); game.timeScale = 1; I.release('KeyD');
  at(2.5);
  const state = [game.time, hero.x, hero.y, hero.z, hero.vz, fired, jumps, I.clock].join(' ');
  return { state, peak, time: game.time, steps: steps.slice(0, 12), total: steps.reduce((a, b) => a + b, 0), dts: [...dts].sort(), alpha: game.alpha };
};
// the rest of the clock's contract, at 60 Hz
const RULES = () => {
  const E = My3D2dge, game = new E.Game({ canvas: 'screen', res: 'snes' }), I = game.input, out = {};
  let f = 0, dts = [], pressedAtZero = false, unpaused = false;
  const frames = (n, ms = 1000 / 60) => { for (let i = 0; i < n; i++) window.__frame(++f * ms); };
  game.start({ scenes: { main: { pausable: true, update(dt) { dts.push(dt); if (I.pressed('jump') && game.timeScale === 0) pressedAtZero = true; }, draw(r) { r.sky(['#000', '#000']); } } }, scene: 'main' });
  frames(30); out.steps60 = game.stats.steps;
  dts = []; game.timeScale = .3; frames(10); out.slow = { steps: dts.length, dt: dts[0] };
  dts = []; game.timeScale = 2; frames(10); out.fast = { steps: dts.length, dt: dts[0] };
  game.timeScale = 0; frames(2); I.press('KeyZ'); frames(2); I.release('KeyZ'); out.pressedAtZero = pressedAtZero; out.timeAtZero = game.time;
  frames(1); out.stillAtZero = game.time === out.timeAtZero; game.timeScale = 1;
  game.paused = true; frames(5); I.press('Escape'); frames(1); I.release('Escape'); unpaused = !game.paused; out.unpaused = unpaused;
  // the counter reads real time: ten frames a second reads 10 (the old counter, fed clamped time, never read under 20)
  for (let i = 0; i < 12; i++) frames(1, 100);
  out.fps = game.fps; out.frameMs = game.stats.frameMs;
  // the first frame updates before it draws, even when it comes at once
  const g2 = new E.Game({ canvas: 'screen', res: 'snes' }); let ready = false, drawnFirst = false;
  g2.start({ update() { ready = true; }, draw(r) { if (!ready) drawnFirst = true; r.sky(['#000', '#000']); } });
  window.__frame(f * 1000 / 60 + 1e-3); out.firstUpdates = !drawnFirst && ready;
  out.duck = typeof game.audio.duck === 'function' && (game.audio.duck(true), game.audio.ducked === true) && (game.audio.duck(false), game.audio.ducked === false);
  return out;
};

if (process.argv.includes('--node')) { console.log(failures.length ? `\nFAILED ${failures.length} of ${passed + failures.length}:\n  ${failures.join('\n  ')}` : `\nall ${passed} checks without a browser passed`); process.exit(failures.length ? 1 : 0); }
// the lifecycle in a page: dispose() takes the engine's listeners away; loop: false runs only by advance()
const LIFE = () => {
  const E = My3D2dge, out = {};
  const g = new E.Game({ canvas: 'screen', res: 'snes' }); g.start({ update() {}, draw(r) { r.sky(['#000', '#000']); } });
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' })); out.before = g.input.held.has('KeyD');
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' }));
  g.dispose(); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' })); out.after = g.input.held.has('KeyD');
  out.current = E.current === null;
  const h = new E.Game({ canvas: 'screen', res: 'snes', loop: false }); let ups = 0, draws = 0;
  h.start({ update() { ups++; }, draw(r) { draws++; r.sky(['#000', '#000']); } });
  for (let i = 1; i <= 30; i++) window.__frame(i * 1000 / 60);
  out.idle = ups === 0 && draws === 0;
  out.steps = h.advance(1, { draw: true }); out.ups = ups; out.draws = draws;
  h.stop(); h.dispose();
  return out;
};
// the third-person kit's drawing (full edition): a footprint lifts a canopy over the tower under it, the decorate hook
// paints wall faces as they bake, r.marker turns into an arrow at the edge, r.sightCone stops at a wall
const DRAW3P = () => {
  const E = My3D2dge, out = { faces: [] }, mode = {};
  const map = new E.TileMap({ rows: ['#########', '#.......#', '#..TTT..#', '#..TTT..#', '#..TTT..#', '#.......#', '#.......#', '#########'], legend: { '#': 1, T: 2 },
    types: { 1: { h: 6 }, 2: { h: 60, decorate: f => { out.faces.push({ side: f.side, du: f.u1 - f.u0, z1: f.z1, fns: typeof f.at + typeof f.quad }); f.quad(f.u0 + 4, 20, f.u0 + 12, 32, '#00ff00'); } } } });
  const game = new E.Game({ canvas: 'screen', res: 'snes', view: 'iso', loop: false }), C = 72, w = 28;   // (a canopy over the 3 x 3 tower, anchored at its middle)
  const count = (hex, edge) => { const c = game.screen.buf, W = game.screen.W, H = game.screen.H, d = c.getContext('2d').getImageData(0, 0, W, H).data, [R, G, B] = E.hex(hex); let n = 0, inner = 0;
    for (let i = 0, p = 0; i < d.length; i += 4, p++) if (d[i] === R && d[i + 1] === G && d[i + 2] === B) { n++; const x = p % W, y = (p / W) | 0; if (x > 20 && x < W - 20 && y > 20 && y < H - 20) inner++; } return edge ? { n, inner } : n; };
  game.start({ update() {}, draw(r) {
    r.sky(['#000', '#000']); map.drawFloor(r); map.queueWalls(r);
    if (mode.canopy) r.queue(C, C - 16, 60, g => { const c = [r.w(C - w, C - 16 - w, 60), r.w(C + w, C - 16 - w, 60), r.w(C + w, C - 16 + w, 60), r.w(C - w, C - 16 + w, 60)], tip = r.w(C, C - 16, 76);
      for (let i = 0; i < 4; i++) E.px.poly(g, [c[i], c[(i + 1) % 4], tip], '#ff00ff'); }, mode.canopy === 'footprint' ? { footprint: [C - w, C - 16 - w, C + w, C - 16 + w] } : {});
    if (mode.marker) r.marker(mode.marker[0], mode.marker[1], 0, { color: '#ff00ff' });
    if (mode.cone && r.sightCone) r.sightCone({ x: 120, y: C - 16, z: 0, facing: Math.PI }, { range: 150, fov: .5, color: '#00ffff', alpha: 1, map: mode.cone === 'map' ? map : undefined });
  } });
  game.follow({ x: C, y: C - 16, z: 0 }, { z: 20 });
  const frame = m => { for (const k in mode) delete mode[k]; Object.assign(mode, m); game.advance(1 / 120, { draw: true }); };
  frame({}); out.green = count('#00ff00');
  frame({ canopy: 'plain' }); out.plain = count('#ff00ff');
  frame({ canopy: 'footprint' }); out.footprint = count('#ff00ff');
  frame({ marker: [C, C] }); out.onScreen = count('#ff00ff', true);
  frame({ marker: [C + 4000, C] }); out.offScreen = count('#ff00ff', true);
  frame({ cone: 'open' }); out.coneOpen = count('#00ffff');
  frame({ cone: 'map' }); out.coneMap = count('#00ffff');
  return out;
};
// E.Shell over a game run by advance(): the HUD, the pause screen, focus moved by the game's input, input held back from
// the game while a screen is open, a button's act, settings, the toast's time, dispose
const SHELL = () => {
  const E = My3D2dge, out = {}, q = s => document.querySelector(s), texts = s => [...document.querySelectorAll(s)].map(e => e.textContent);
  const game = new E.Game({ canvas: 'screen', res: 'snes', loop: false, input: 'THIRDPERSON' }), I = game.input;
  const ui = new E.Shell(game, { screens: { pause: { text: 'The objective' }, help: { keys: [['WASD', 'Move']] } },
    settings: { items: ['motion', { key: 'cones', label: 'Cones', value: true }], onChange: (s, k) => { out.changed = k; } } });
  game.start({ scenes: { play: { pausable: true, update() {
    if (I.pressed('attack')) out.attacked = (out.attacked || 0) + 1;
    ui.hud({ objective: { title: 'Steal it', at: { x: 160, y: 0, z: 40 }, from: { x: 0, y: 0, z: 0 } }, prompt: { key: 'E', label: 'Take', progress: .5 }, bars: [{ value: 2, max: 3, kind: 'pips' }] });
  }, draw(r) { r.sky(['#000', '#000']); } } }, scene: 'play' });
  const step = (n = 1) => game.advance(n / 120);
  step();
  out.obj = q('.esh-obj').textContent; out.prompt = q('.esh-pr').textContent; out.pips = [document.querySelectorAll('.esh-pips i').length, document.querySelectorAll('.esh-pips i.off').length];
  I.tap('pause'); step(2);
  out.pause = ui.screen; out.paused = game.paused; out.buttons = texts('.esh-sh button'); out.focus = document.activeElement.textContent; out.hudHidden = q('.esh-obj').hidden;
  // (a tap holds its action through the next step: step twice before tapping the same one again, as a key is let go)
  I.tap('down'); step(2); out.f1 = document.activeElement.textContent; I.tap('down'); step(2); out.f2 = document.activeElement.textContent;
  I.tap('confirm'); step(2); out.s1 = ui.screen; I.tap('cancel'); step(2); out.s2 = ui.screen; I.tap('cancel'); step(2); out.s3 = ui.screen; out.resumed = !game.paused;
  ui.show('results', { title: 'Done', stats: [['1', 'A']], medals: [['M', true]], actions: [['Again', () => { out.again = true; }], { label: 'Hit', act: 'attack' }] });
  I.tap('attack'); step(2); out.heldBack = out.attacked || 0;
  document.querySelectorAll('.esh-sh button')[1].click(); step(); out.actPassed = out.attacked || 0;
  out.results = q('.esh-stats').textContent + '|' + q('.esh-med').textContent;
  ui.show('settings'); [...document.querySelectorAll('.esh-sh .esh-row')].find(r => /Reduce motion/.test(r.textContent)).querySelector('[role=switch]').click(); step(); out.motion = game.reduceMotion; out.still = ui.root.classList.contains('esh-still'); out.saved = ui.settings.motion;
  ui.hide(); ui.toast('Hi'); out.toastOn = q('.esh-toast').classList.contains('on'); step(600); out.toastOff = !q('.esh-toast').classList.contains('on');
  game.dispose(); out.gone = !q('.esh') && game.shell === null;
  return out;
};
// docs/ASSETS.md's examples in a game: the surfaces (on a small map), the stool, the worked entries (as card-<id>), and
// the use block in draw (its shape, its solid and its sprite); what is drawn with and without it, and every warning
const CARD = ([use, surf, entry, worked]) => {
  const E = My3D2dge, out = { warns: [] }, warn = console.warn; console.warn = (...a) => { out.warns.push(a.join(' ')); warn(...a); };
  const rows = ['#####', '#.~..', '#....', '#....'], legend = { '#': 1, '~': { floor: 'water' } };
  const { map, level } = new Function('E', 'rows', 'legend', surf + '\nreturn { map, level };')(E, rows, legend);
  new Function('E', entry)(E);
  const cards = new Function('return {' + worked + '}')(); for (const k in cards) E.SHAPES['card-' + k] = cards[k];
  const game = new E.Game({ canvas: 'screen', res: 'snes', view: 'iso', loop: false }), mode = {}, made = new Function('E', 'r', 'map', 'x', 'y', use + '\nreturn icon;');
  let last = null; const lit = () => { const c = game.screen.buf, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (last && (d[i] !== last[i] || d[i + 1] !== last[i + 1] || d[i + 2] !== last[i + 2])) n++; last = d; return n; };   // (pixels changed since the last frame)
  game.start({ update() {}, draw(r) { r.sky(['#000', '#000']); map.drawFloor(r); map.queueWalls(r); if (mode.use) out.icon = made(E, r, map, 40, 30); } });
  game.follow({ x: 40, y: 32, z: 0 });
  game.advance(1 / 120, { draw: true }); lit(); game.advance(1 / 120, { draw: true }); out.still = lit();
  mode.use = true; game.advance(1 / 120, { draw: true }); out.withUse = lit();
  out.solids = (map.solids || []).length; out.icon = !!(out.icon && out.icon.w);
  out.stool = !!E.SHAPES.stool; out.cards = Object.keys(cards);
  if (E.shapeInfo && E.SHAPES.barrel) { out.drawn = ['stool', ...out.cards.map(k => 'card-' + k)].filter(id => (E.shapeInfo(id, { view: E.VIEWS.iso }) || {}).pixels > 20); }
  out.level = !!(level && level.w); out.mossy = !!E.MATERIALS.mossy;
  console.warn = warn; return out;
};
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
for (const [ed, file] of EDITIONS) {
  console.log(`\n${ed} edition (Chromium, virtual clock)`);
  const html = '<!doctype html><html><body style="margin:0"><canvas id="screen"></canvas><script>(' + CLOCK + ')()</script><script>' + readFileSync(join(root, file), 'utf8').replace(/<\/script/gi, '<\\/script') + '</script></body></html>';
  const run = async (fn, arg) => {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.setContent(html);
    let r; try { r = await page.evaluate(fn, arg); } catch (e) { await page.close(); throw new Error(e.message + (errors.length ? '\n  page errors: ' + errors.join(' | ') : '')); }
    await page.close();
    if (errors.length) check(`${ed}: no errors`, false, errors.join(' | '));
    return r;
  };
  const rates = {};
  for (const hz of [60, 90, 120, 144]) rates[hz] = await run(PLAY, hz);
  for (const hz of [60, 90, 120, 144]) console.log(`  ${String(hz).padStart(3)} Hz: steps per frame ${rates[hz].steps.join(',')}..., ${rates[hz].total} in 2.5 s, jump peak ${rates[hz].peak.toFixed(4)}, state ${rates[hz].state}`);
  for (const hz of [90, 120, 144]) check(`${ed}: the same state at ${hz} Hz as at 60 Hz`, rates[hz].state === rates[60].state, rates[hz].state + ' vs ' + rates[60].state);
  check(`${ed}: 60 Hz runs two steps a frame`, rates[60].steps.every(s => s === 2), rates[60].steps.join(','));
  check(`${ed}: 120 Hz runs one step a frame`, rates[120].steps.every(s => s === 1), rates[120].steps.join(','));
  check(`${ed}: every step is 1/120 s of real time, slow motion half that`, rates[60].dts.length === 2 && rates[60].dts.includes(1 / 120) && rates[60].dts.includes(1 / 240), rates[60].dts.join(', '));
  check(`${ed}: 2.5 s of real time at half speed for 0.5 s is 2.25 s of game time`, Math.abs(rates[60].time - 2.25) < 1e-9, String(rates[60].time));
  check(`${ed}: game.alpha is the part of a step left over`, rates[144].alpha >= 0 && rates[144].alpha < 1, String(rates[144].alpha));
  const R = await run(RULES);
  check(`${ed}: slow motion makes steps shorter, not fewer`, R.slow.steps === 20 && Math.abs(R.slow.dt - .3 / 120) < 1e-15, JSON.stringify(R.slow));
  check(`${ed}: above timeScale 1 a step is split so none is longer than 1/120 s`, R.fast.steps === 40 && R.fast.dt === 1 / 120, JSON.stringify(R.fast));
  check(`${ed}: at timeScale 0 input still ticks and game time stands still`, R.pressedAtZero && R.stillAtZero, JSON.stringify(R));
  check(`${ed}: paused, input still ticks (pause toggles back)`, R.unpaused);
  check(`${ed}: fps reads real time (10 frames a second reads 10)`, R.fps === 10 && Math.round(R.frameMs) === 100, 'fps ' + R.fps + ', frameMs ' + R.frameMs);
  check(`${ed}: audio.duck(on) is public`, R.duck);
  check(`${ed}: the first frame updates before it draws, even when it comes at once`, R.firstUpdates);
  const LF = await run(LIFE);
  check(`${ed}: dispose() removes the engine's listeners`, LF.before && !LF.after && LF.current, JSON.stringify(LF));
  check(`${ed}: loop: false waits for advance(), which runs fixed steps and draws when asked`, LF.idle && LF.steps === 120 && LF.ups === 120 && LF.draws === 1, JSON.stringify(LF));
  if (ed === 'full') {
    const S = await run(SHELL);
    console.log('  shell:', JSON.stringify(S));
    check(`${ed}: E.Shell's HUD shows the state it is given (the objective's distance and height, the prompt, the pips)`, /Steal it/.test(S.obj) && /20 m/.test(S.obj) && /ABOVE/.test(S.obj) && /Take/.test(S.prompt) && S.pips.join() === '3,1', JSON.stringify([S.obj, S.prompt, S.pips]));
    check(`${ed}: E.Shell's pause screen follows game.paused, with Resume, Settings, Controls, Full screen and Help, the HUD hidden`, S.pause === 'pause' && S.paused && S.buttons.join() === 'Resume,Settings,Controls,Full screen,Help' && S.focus === 'Resume' && S.hudHidden, JSON.stringify(S));
    check(`${ed}: E.Shell: the game's input moves the focus, confirm opens, cancel goes back, then resumes`, S.f1 === 'Settings' && S.f2 === 'Controls' && S.s1 === 'controls' && S.s2 === 'pause' && S.s3 === null && S.resumed, JSON.stringify(S));
    check(`${ed}: E.Shell holds the game's input back while a screen is open; a button's act reaches it`, S.heldBack === 0 && S.actPassed === 1 && /A/.test(S.results), JSON.stringify(S));
    check(`${ed}: E.Shell settings apply (reduce motion) and tell the game`, S.motion === true && S.still && S.saved === true && S.changed === 'motion', JSON.stringify(S));
    check(`${ed}: E.Shell toasts time out; dispose() takes it away`, S.toastOn && S.toastOff && S.gone, JSON.stringify(S));
  }
  const D = await run(DRAW3P);
  console.log('  third person:', JSON.stringify(Object.assign({}, D, { faces: D.faces.length })));
  check(`${ed}: r.marker: a diamond on screen, an arrow at the edge off it`, D.onScreen.inner > 10 && D.offScreen.n > 10 && D.offScreen.inner === 0, JSON.stringify([D.onScreen, D.offScreen]));
  if (ed === 'full') {
    check(`${ed}: types[id].decorate(face) is called for each face with its side, u0..u1, z1, at and quad, and paints it`, D.faces.length >= 4 && new Set(D.faces.map(f => f.side)).size >= 2 && D.faces.every(f => f.du === 16 && f.z1 === 60 && f.fns === 'functionfunction') && D.green > 20, JSON.stringify(D.faces.slice(0, 2)) + ' green ' + D.green);
    check(`${ed}: a footprint sorts a canopy over every block under it`, D.footprint > D.plain + 20, D.plain + ' -> ' + D.footprint);
    check(`${ed}: r.sightCone stops at a wall (with map)`, D.coneMap > 0 && D.coneMap < D.coneOpen / 4, D.coneOpen + ' -> ' + D.coneMap);
  }
  const CODE = FENCED('docs/ASSETS.md').map(x => x.code), K = await run(CARD, CODE);
  console.log('  the asset card:', JSON.stringify(Object.assign({}, K, { warns: K.warns.length })));
  check(`${ed}: docs/ASSETS.md has its four examples (use, surfaces, an entry, worked entries)`, CODE.length === 4 && K.cards.length >= 6, CODE.length + ' blocks, ' + K.cards.length + ' worked entries');
  check(`${ed}: docs/ASSETS.md's examples keep what they add (E.SHAPES, E.MATERIALS) and build their maps`, K.stool && K.mossy && K.level, JSON.stringify(K));
  if (ed === 'full') {
    check(`${ed}: docs/ASSETS.md's examples draw without a warning: the shape, the solid, the sprite, the stool and every worked entry`, !K.warns.length && !K.still && K.withUse > 120 && K.solids >= 1 && K.icon && K.drawn.length === K.cards.length + 1, K.warns.join(' | ') + ' ' + JSON.stringify(K));
  } else check(`${ed}: docs/ASSETS.md's examples draw nothing and say so (r.shape, map.solid, E.shapeSprite are the full engine's)`, !K.still && !K.withUse && !K.solids && !K.icon && ['r.shape', 'map.solid', 'E.shapeSprite'].every(n => K.warns.some(w => w.includes(n))), K.warns.join(' | ') + ' ' + JSON.stringify(K));
  // the complete games among the examples (API.md's quick start): they start, take a start press and play, without errors
  for (const x of EXAMPLES.filter(x => /^\(\(\) => \{/.test(x.code.trim()))) {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const at = html.lastIndexOf('</body>');   // (the agent edition's header has a </body> of its own)
    await page.setContent(html.slice(0, at) + '<script>' + x.code.replace(/<\/script/gi, '<\\/script') + '</script>' + html.slice(at));
    const r = await page.evaluate(() => { let f = 0; const run = n => { for (let i = 0; i < n; i++) window.__frame(++f * 1000 / 60); };
      run(60); const g = My3D2dge.current; g.input.tap('start'); g.input.tap('confirm'); run(60); g.input.hold('right'); run(120); return { scene: g.sceneName, errors: g.errors.length }; });
    await page.close();
    check(`${ed}: ${x.file} example ${x.name} plays`, !errors.length && !r.errors, errors.join(' | ') + JSON.stringify(r));
  }
}
// the handoff package's template game: its headless test passes, and it plays in a browser without errors
if (existsSync(join(root, 'dist/handoff/game/test.mjs'))) {
  const t = spawnSync(process.execPath, [join(root, 'dist/handoff/game/test.mjs')], { encoding: 'utf8' });
  check('handoff: game/test.mjs passes', t.status === 0, (t.stdout + t.stderr).split('\n').filter(l => /FAIL|Error/.test(l)).join(' | '));
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(CLOCK); await page.goto(pathToFileURL(join(root, 'dist/handoff/game/index.html')).href);
  const snap = await page.evaluate(() => { let f = 0; const run = n => { for (let i = 0; i < n; i++) window.__frame(++f * 1000 / 60); };
    run(30); const g = My3D2dge.current; g.input.tap('start'); run(40); g.input.hold('right'); run(90); return g.debug.snapshot(); });
  await page.close();
  check('handoff: game/index.html plays in a browser', !errors.length && snap.scene === 'play', errors.join(' | ') + JSON.stringify(snap));
  // the asset card's tools run on the package alone (its engine and its copy of the store), as the card says
  const f = spawnSync(process.execPath, [join(root, 'dist/handoff/tools/asset-find.mjs'), 'graveyard urn', '--top', '3'], { encoding: 'utf8', cwd: join(root, 'dist/handoff') });
  check('handoff: docs/ASSETS.md is there and tools/asset-find.mjs finds a store entry', existsSync(join(root, 'dist/handoff/docs/ASSETS.md')) && f.status === 0 && /kenney-graveyard:urn-round/.test(f.stdout), (f.stdout + f.stderr).slice(0, 300));
}
await browser.close();

console.log(failures.length ? `\nFAILED ${failures.length} of ${passed + failures.length}:\n  ${failures.join('\n  ')}` : `\nall ${passed} contract checks passed`);
process.exit(failures.length ? 1 : 0);
