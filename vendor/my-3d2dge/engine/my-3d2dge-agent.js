/*!
my-3D2dge AGENT EDITION v0.46.1: the essential engine in one file, for AI coding agents
https://github.com/michaelcrosato/my-3d2dge (MIT License)

Retro-modern 2D games drawn entirely by code: no image or sound files, no dependencies, no network.
This is a curated subset of the full engine (dist/my-3d2dge.js). A game written against this file runs
unchanged on the full engine, which adds the pause, settings and controls menus, lighting, props, parallax
backdrops, touch controls, camera zoom and turn, dialog portraits, x-ray silhouettes, replayable sessions, and more.

AGENTS: this header is the whole manual. Build games from it; you do not need to read the code below.
Read a section only to debug: each starts with "// ---- N. NAME" (grep "// ---- 10." for the Humanoid).

## Host it
<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:#000;overflow:hidden}
#screen{width:100%;height:100%;display:block;image-rendering:pixelated}</style></head>
<body><canvas id="screen"></canvas><script src="my-3d2dge-agent.js"></script><script src="game.js"></script></body></html>
For a single-file game, paste both scripts inline. Start every game with: const E = My3D2dge;

## Mental model
- The world is 3D: x east, y south, z up; one tile = 16 units. Game logic uses world units and dt, never pixels.
- A view projects the world to the screen. 'iso' (Diablo), 'threequarter' (Zelda), 'topdown', 'brawler' (Final
  Fight), 'side' (Mario: x right, z up, y = 0), 'overhead' (shmups, puzzles: world x/y = screen pixels once you call
  game.focus(W / 2, H / 2)). The same game runs in every view. In ground views, turn the stick or keys into a world
  direction with game.view.screenDirToGround(mx, my).
- update(dt) runs in exact fixed steps: 1/120 s of real time each, dt = 1/120 * timeScale, the same steps at any
  refresh rate. Read input only there.
- Tests: new E.Game({ headless: true }) (the default in Node) has no screen; game.advance(seconds) runs fixed steps at
  once, game.input.tap('jump') / hold('right', on) script input, game.debug = { snapshot() {...} } is the game's handle.
- draw(r) order: backgrounds first (r.sky, map.drawFloor + map.queueWalls, level.draw), then everything that can
  overlap through r.actor / r.sprite / r.queue (depth sorted), then the HUD through r.text / r.overlay (screen pixels).
- Characters are procedural rigs posed every step (E.Humanoid, E.Blob) or string sprites (E.sprite).
- Draw only with E.px, E.font, E.ui and r.*: they snap to whole pixels. ctx.arc / stroke / fillText and canvas
  gradients blur the pixel look.
- Errors show in a red box on screen and in the console; warnings start with "my-3D2dge:". Fix the first one first.

## Quick start: a complete game (title, play, win or lose)
```js quickstart
(() => {
const E = My3D2dge;
const game = new E.Game({ canvas: 'screen', res: 'ps1', view: 'threequarter', views: ['threequarter', 'iso', 'topdown'] });
const map = new E.TileMap({
  rows: ['################',
         '#@.....#.......#',
         '#......#...s...#',
         '#..s.......##..#',
         '#......~~.....s#',
         '################'],
  legend: { '#': 1, '@': 'hero', s: 'slime', '~': { floor: 'water', block: true } },   // number = wall type, string = spawn tag
  types: { 1: { h: 28, top: '#7a7090', side: '#4a4560', cut: true } },   // cut: walls in front of the floor drop low
  floorTex: (x, y, tag) => tag === 'water' ? E.tex.water(x, y) : E.tex.grass(x, y)
});
const flow = new E.FlowField(map);
let hero, rig, sword, slimes, hp, msg = '';
const title = {
  update() { if (game.input.pressed('start')) game.go('play'); },
  draw(r) {
    r.sky(['#101848', '#5a3a80']);
    r.overlay(g => E.font.title(g, 'SLIME FIELD', r.W / 2, 70, { scale: 3, align: 'center' }));
    r.text('PRESS ENTER', r.W / 2, 150, '#ffffff', { align: 'center', shadow: '#000', outline: false });
  }
};
const play = {
  pausable: true,
  enter() {
    const s = map.find('hero');
    hero = new E.Body({ x: s.x, y: s.y, r: 5 }); hero.facing = 0; hero.hurt = 0; hp = 3;
    rig = new E.Humanoid({ size: 1.3, outfit: 'tunic', hat: 'cap', colors: { cloth: '#3a8a4a', hair: '#e0b040' } });
    sword = new E.Attack('slash');
    slimes = map.findAll('slime').map(p => ({ body: new E.Body({ x: p.x, y: p.y, r: 6 }), rig: new E.Blob(), hp: 3, hit: 0 }));
    game.cam.bounds = v => map.bounds(v); game.follow(hero);
    game.audio.music('adventure');
  },
  update(dt) {
    const inp = game.input, m = inp.move(), d = game.view.screenDirToGround(m[0], m[1]);   // screen push -> ground direction
    hero.vx = d[0] * 85; hero.vy = d[1] * 85; hero.update(dt, map);
    if (Math.hypot(d[0], d[1]) > .1) hero.facing = Math.atan2(d[1], d[0]);
    if (inp.buffered('attack') && sword.start()) { inp.consume('attack'); game.audio.sfx('swing'); }
    sword.update(dt);
    sword.hits(slimes, s => E.inArc(hero, hero.facing, s.body, 24, 1.3), s => {
      s.hp--; s.hit = .15; E.knockback(hero, s.body, 200, 80);
      game.hitFx(s.body.x, s.body.y, 8, { damage: 1, angle: hero.facing });
    });
    flow.update(hero.x, hero.y); hero.hurt -= dt;
    for (const s of slimes) {
      const dir = flow.dir(s.body.x, s.body.y, hero.x, hero.y);
      s.body.vx = E.approach(s.body.vx, dir[0] * 30, 300 * dt); s.body.vy = E.approach(s.body.vy, dir[1] * 30, 300 * dt);
      s.body.update(dt, map); s.hit -= dt;
      s.rig.update(dt, { look: dir, squash: Math.sin(game.time * 9 + s.body.x) * .15 });
      if (E.overlap(hero, s.body) && hero.hurt <= 0) { hp--; hero.hurt = 1; E.knockback(s.body, hero, 220); game.audio.sfx('hurt'); game.shake(3); }
      if (s.hp <= 0) game.particles.explosion(s.body.x, s.body.y, 6, .7);
    }
    E.prune(slimes, s => s.hp <= 0);
    rig.update(dt, { x: hero.x, y: hero.y, z: hero.z, vx: hero.vx, vy: hero.vy, facing: hero.facing, attack: sword.state, hurt: hero.hurt > .7 });
    if (hp <= 0) game.go('end', 'GAME OVER'); else if (!slimes.length) game.go('end', 'YOU WIN');
  },
  draw(r) {
    map.drawFloor(r); map.queueWalls(r);                                   // background first, then depth-sorted things
    r.shadow(hero.x, hero.y, 6);
    r.actor(hero.x, hero.y, hero.z, (g, ox, oy) => rig.draw(g, ox, oy, r.view), { alpha: hero.hurt > 0 ? .6 : 1 });
    for (const s of slimes) {
      r.shadow(s.body.x, s.body.y, 6);
      r.actor(s.body.x, s.body.y, s.body.z, (g, ox, oy) => s.rig.draw(g, ox, oy, r.view), { flash: s.hit > 0 && '#ffffff' });
    }
    r.overlay(g => E.ui.hearts(g, 6, 6, hp, 3));                        // HUD in screen pixels
  }
};
const end = {
  enter(text) { msg = text; game.audio.music(null); game.audio.sfx(text === 'YOU WIN' ? 'powerup' : 'die'); },
  update() { if (game.input.pressed('start')) game.go('title'); },
  draw(r) { r.sky(['#000000', '#301830']); r.text(msg, r.W / 2, 100, '#ffe08a', { align: 'center', scale: 2 }); }
};
game.start({ scene: 'title', scenes: { title, play, end } });
})();
```

## API
Game: new E.Game({ canvas: 'screen', res, expand, view, views, input, bg })
  res: 'nes' 256x240 | 'snes' 256x224 | 'genesis' 320x224 | 'gb' 160x144 | 'gba' 240x160 | 'ps1' 320x240 | 'wide' 400x225 | [w, h]
  expand: true fills any window with no bars: res is the least it shows, r.W x r.H grows; anchor the HUD to r.W and r.H
  input: 'DEFAULT' | 'PLATFORMER' | 'SHMUP' | your own { action: ['KeyQ', 'Pad0', 'Mouse0'] }
  start({ update(dt), draw(r) }) or start({ scene: 'title', scenes: { title: {...}, play: {...} } })
  scene: { enter(data), exit(), update(dt), draw(r), pausable, view, views, input, res, expand }; go(name, data, { fade: .22 })
  camera: follow(obj, { z: 16, lead }) once, or focus(x, y, z) every update; cam.bounds = v => map.bounds(v);
    cam.room = [w, h] for screen-by-screen rooms (cam.moving is true while it slides); cam.smooth = .18 (0 = locked)
  juice: hitFx(x, y, z, { power: 1, damage, angle, color, sound }), freeze(s), shake(n), flash(color, s), timeScale = .25
  timers in game time: after(s, fn), every(s, fn) -> { cancel() }, cleared on scene change
  also: setView(id), nextView() (cycles views), note(text, s), mouseGround() -> [x, y] or null
  fields: W, H, time, real, paused, input, audio, particles, view, cam, errors
Input (game.input): down(a) held, pressed(a) this step only, released(a), repeat(a, delay .3, rate .08) for menus,
  buffered(a, window .15) + consume(a) for combat, consumeAll(), anyPressed(), move() -> [x, y] on screen (length <= 1)
  every preset: up down left right (WASD, arrows, d-pad), start (Enter), pause (Esc, P), confirm (Enter, Space, J, Z),
    cancel (Esc, Backspace, X, K); the gamepad d-pad, A, B and Start work too, and its left stick moves
  DEFAULT: attack (J, X, click), dash (Space, Shift, K), skill (L, E, right click), jump (Z)
  PLATFORMER: jump (Space, Z, K), attack (X, J, click), dash (Shift, C, L), skill (E, V)
  SHMUP: fire (Space, Z, J, click), bomb (X, K, right click)
  label('jump') -> its key or button on the device in use, for prompts: 'Space', 'A', '✕'
Standard, with no code: game.settings (saved per game: volume music effects sound motion shake flashes scale deadzone
  glyphs; set(key, v) checks, saves, applies; yours: new E.Game({ menu: { settings: [{ key: 'hints', value: true }] } })),
  game.fullscreen (a phone's first tap, a top-right button; toggle() from a key or click), and a pausable scene pausing
  when the page is hidden or the controller unplugs (pause(reason), resume(), pauseReason). Don't build your own. Leave
  out: fullscreen: 'button' | false, corner: false, autoPause: false. The full engine adds the menu screens.
Boot: start({ ..., boot: { title, steps: [['Raising the harbour', () => build()]], messages: ['Counting the bells'] } }) runs heavy
  setup one step a frame behind a boot screen; an error before play shows a report to screenshot (E.diagnose() any time).
Drawing (r in draw(r); r.W, r.H = screen size in pixels)
  r.sky(['#top', '#mid', '#bottom']); r.starfield({ count: 70, speed: 30, dir: 'down' | 'up' | 'left' | 'right', height: 0..1 })
  r.actor(x, y, z, (g, ox, oy) => rig.draw(g, ox, oy, r.view), { outline: true, flash: '#ffffff', flashMix: .5, alpha, bias })
  r.sprite(x, y, z, spr, { anchor: 'bottom' | 'center' | 'top', flip, flash, outline, alpha })
  r.queue(x, y, z, g => {...}, { bias }) for any depth-sorted drawing; inside it r.box(g, x0, y0, z0, x1, y1, z1, top, side)
  r.shadow(x, y, radius, alpha .5, color, surfaceZ); floor marks: r.decal(() => r.groundDisc(x, y, rad, color, alpha)),
    r.groundRing(x, y, rad, color, alpha), r.groundArc(x, y, r0, r1, a0, a1, color, alpha)
  r.text(str, x, y, color, opts); r.textAt(x, y, z, str, color); r.overlay(g => {...}); r.glowDisc(g, x, y, rad, color, 0..1)
  r.marker(x, y, z, { label, color }): an objective marker, an arrow at the screen's edge when it is off screen
  r.w(x, y, z) -> [px, py] where a world point lands; r.visible(x, y, z); r.view
Pixels (g is a canvas context from r.queue, r.overlay or r.actor): E.px.rect(g, x, y, w, h, c), dot(g, x, y, c),
  line(g, x0, y0, x1, y1, c, width), disc(g, x, y, r, c), ell(g, x, y, rx, ry, c), poly(g, [[x, y], ...], c),
  polyDither(g, pts, c, alpha), ddisc(g, x, y, r, c, alpha), blend(g, alpha, 'add' | 'multiply' | 'screen' | 'normal', () => {...}),
  sprite(g, spr, x, y, flip). Colors are '#rrggbb' or '#rgb'.
Sprites: const COIN = E.sprite(['.yy.', 'yYYy', '.yy.'], { y: '#f0b020', Y: '#fff0a0' }, scale); '.' and ' ' are clear
Text: E.font.text(g, str, x, y, color, { outline: '#0b0814' | false, shadow, gradient: [top, bottom], scale, align, wrap: px })
  -> { w, h }; E.font.title(g, str, x, y, { scale: 3, colors: [top, ..., bottom], depth, align }); E.font.width(str, opts),
  lineHeight(opts), wrap(str, px). A 5x7 font with lower case and ♥ ★ ← → ↑ ↓ • × ♪ ▸ ©
UI (draw inside r.overlay): E.ui.box(g, x, y, w, h, { bg, border, alpha }), E.ui.bar(g, x, y, w, h, 0..1, color),
  E.ui.hearts(g, x, y, hp, max) (halves allowed)
  const talk = new E.Dialog(game); talk.say(['Page one.', 'Page two.'], { name: 'ELDER', choices: ['YES', 'NO'],
    onChoice(i), onDone, place: 'top' | 'bottom', auto: 2.5, modal: false (chatter that plays on) });
    in update: if (talk.update(dt)) return;   in draw: talk.draw(r)
  const menu = new E.Menu(game, ['START', { label: 'LOAD', disabled: true }], { title, x, y, onPick(i, item), onCancel });
    menu.update(); menu.draw(r)
Sound (game.audio; it starts after the first key press): sfx(name, { vol, pitch }) with presets jump jump2 land step coin
  pickup key powerup oneup heal hit hurt stomp bump swing whoosh punch kick shoot laser charge explode boom door secret
  warp die select confirm cancel pause text blip; or sfx({ wave: 'square' | 'pulse' | 'triangle' | 'saw' | 'sine' | 'noise',
  freq: 440 | 'A4', to, dur, vol, arp: [0, 4, 7], step }); define(name, voice)
  music('title' | 'adventure' | 'dungeon' | 'boss' | 'victory') or your own { bpm: 120, steps: 4, tracks: [{ wave: 'square',
  vol: .15, notes: 'C5 - E5 . G5 . | ...' }, { wave: 'drums', notes: 'k . h . s . h .' }] } ('-' holds, '.' rests; drums
  k s h o c t); music(null) stops; mute(); setVolume(0..1)
TileMap (iso, threequarter, topdown and brawler levels):
  new E.TileMap({ rows, legend, types, floorTex }); legend: a number = wall type, a string = spawn tag,
  { tile, floor: 'water', spawn, block: true }; types[id] = { h, top, side, cut: true (drops walls in front of the
  floor), face: 'brick' | 'none', roof: 'speckle' | 'plain' }; floorTex(x, y, floorTag) -> [r, g, b]
  find(tag) / findAll(tag) -> { x, y, cx, cy }; drawFloor(r) and queueWalls(r) in draw; bounds(view);
  set(cx, cy, 0) opens a door; cell(cx, cy), walkable(cx, cy), block(cx, cy, on), toCell(x, y), center(cx, cy),
  heightAt(x, y), floorAt(x, y), los(x0, y0, x1, y1). Walls lower than a body's feet are walkable (jump onto blocks).
  In code: new E.TileMap({ w, h, types }) (open floor), fill(cx, cy, w, h, id), setFloor(cx, cy, tag, block).
  floors: E.tex.grass(x, y, { base, dark, light }), dirt, water, planks, checker(x, y, { a, b, size }), plain(x, y, { base })
  new E.FlowField(map, { climb, drop }): update(tx, ty) every step, dir(x, y, tx, ty) -> [dx, dy] around walls, over roofs
  Heights: z = feet; a cell's top = height(cx, cy); eyes at z + E.HEIGHTS.eye (30) see z + chest (22); same level |dz| <= 8.
  map.sight(a, b), ray(a, b), standable(x, y, z, r), ledge / landing / drop(from, dir), arcClear(a, b, apex);
  E.sameLevel(a, b), E.targets(from, list, { range, arc, dz, sight: map }) nearest first, inArc(..., dz)
  E.sees(guard, hero, { map, range: 120, fov: 1.6 }) -> { seen, exposure } (hero.crouch, hero.exposure 0..1 hide it);
  E.hears(guard, { x, y, z, loud: 80 }, map) -> 1 at the noise .. 0 at loud, halved through a wall
Body (ground physics): new E.Body({ x, y, r: 5, gravity: 700, friction: 0, bounce: 0 }); set vx, vy, then
  update(dt, map); push(ix, iy, iz) knockback; jump(v); reads z, onGround, landed, hitWall, bounced
PlatformMap (side-scrollers, 2.5D in 'brawler'): new E.PlatformMap({ rows, legend, types }); types[id] = { kind:
  'solid' | 'oneway' | 'ladder' | 'slope' (dir: 1 rises right, -1 left) | 'hazard' | 'deco' | 'back', style: 'block' |
  'bonus' | 'brick' | 'ground' | 'plank' | 'spikes' | 'ladder' | 'liquid' | 'plain', side: '#hex', top: '#hex' }
  find(tag) -> { x, z } (z = feet); cell(cx, cz) and set(cx, cz, id) count rows from the BOTTOM; groundBelow(x, z) ->
  surface height, or null over a pit; touching(box, 'hazard'); solidAt(x, z); types[id]; bounds(view); draw(r) right
  after r.sky; move(box, dt, solids) moves enemy boxes { x, z, w, h, vx, vz } (sets onGround, hitWall -1 | 0 | 1,
  hitCeiling, bumped)
Platformer: new E.Platformer({ x, z, w: 8, h: 22, run: 95, jump: 285, gravity: 800, airJumps: 0, wallJump: false, dash: 0 })
  update(dt, level, game.input or { x: -1..1, jump, jumpPressed, up, down, dash }, movingPlatforms); coyote time,
  jump buffering, variable jump height, ladders, down + jump through one-ways. Reads onGround, jumped, landed, facing
  (1 | -1), air, climbing, hitWall, bumped { cx, cz, id }; knock(dir); rigState(extra) feeds rig.update.
  Moving platforms are { x, z, w, h, vx, vz } boxes you move yourself and pass in; riders are carried.
Bullets: const shots = new E.Bullets(game, { plane: 'ground' | 'side' }); shots.fire({ x, y, z, vx, vy, vz, r: 2, team,
  color, life: 3, dmg, pierce, sprite }); burst(base, velocities); update(dt, map) (bullets die on walls);
  hit(targets, (b, t) => {...}, team) -> hits (targets: x, y, r, or x, z, w, h in side); draw(r); clear(team)
  velocities: E.pattern.dir(angle, speed), aim(from, to, speed), aimSide(from, to, speed), spread(angle, n, arc, speed),
  ring(n, speed, offset); on the side plane a velocity is [vx, vz]
Humanoid: new E.Humanoid({ size: 1.3, build: 'chibi' | 'heroic' | 'bulky', weapon: 'sword' | 'gun' | 'staff' | null,
  outfit: 'shirt' | 'tunic' | 'robe' | 'coat', hair: 'short' | 'bald', hat: 'cap' | 'pointed' | 'helmet' | 'crown'
  (or { style, color }), cape: { len: 6 }, hood: true, sleeves: 'short' | 'long' | 'none', eyeGlow: '#ff4030', hunch,
  colors: { skin, hair, cloth, coat, pants, boot, belt, trim, glove, cape, capeIn, metal, hilt } })
  rig.update(dt, { x, y, z, vx, vy, facing, attack, hurt, dash, air, point, aim, climb, vz, pose, stance, run })
    facing in radians (side view: 0 right, Math.PI left); air tucks the legs; point holds a gun out, aim tilts it
    (+ = up); pose: 'cheer' | 'cast' | 'guard' | 'kneel' | 'crouch' | 'wave' | 'hips' | 'block' | 'die' | 'down';
    stance: 'guard' (fists up) | 'ready' (weapon forward); run: 0..1 runs in place
  rig.draw(g, ox, oy, r.view) inside r.actor; rig.hand(), rig.tip() -> world points to spawn bullets; rig.kick(v) squash
  rig.worldOffset(rig.J.head) -> [dx, dy, dz] of any joint from the feet (add rig.x, y, z for the world point)
Attack: const slash = new E.Attack('slash' | spec, overrides); if (input.buffered('attack') && slash.start()) input.consume('attack');
  slash.update(dt) -> phase that began ('active' = play the swing sound); slash.hits(targets, t => E.inArc(hero, facing, t,
  22, 1.4), t => {...}) hits each target once per swing; rig.update(dt, { ..., attack: slash.state }); busy, active, cancel()
  new E.Combo(['jab', 'cross', 'uppercut'], { window: .3 }): press() starts or chains; update, hits, state like an Attack
  E.MOVES: slash backslash overhead rising thrust spin plunge twohand | jab cross hook uppercut haymaker elbow |
    kick roundhouse sweep flyingkick knee axekick | cast throw bash claw. Give each character its own moves.
  E.knockback(from, target, speed, up) pushes a Body (or anything with vx, vy)
Blob (slimes, bats, imps): new E.Blob({ R: 6.5, colors: { dk, base, lt }, wings, horns, ears: 'rabbit' | 'cat', feet,
  tail, mouth: true | 'fangs' }); update(dt, { look: [dx, dy], squash: -0.4..0.4, walk: 0..1, flap: 0..1, hang });
  draw(g, ox, oy, r.view) inside r.actor
Particles (game.particles): explosion(x, y, z, size) (fire, smoke, debris, ring, shake, sound), fire(x, y, z, n),
  smoke(x, y, z, n), sparks(x, y, z, n, angle), dust(x, y, z, n), bits(x, y, z, n, colors), glints(x, y, z, n, color),
  ring(x, y, r0, r1, color), impact(x, y, z, size), text(x, y, z, '12', color, { bounce: true, scale })
  side views: game.particles.ground = (x, y, z) => level.groundBelow(x, z) so debris lands on platforms
Helpers: E.clamp lerp approach approachAng angDiff ease.outCubic | outQuad | inOut | outBack, rand(a, b), randInt(a, b),
  pick(list), chance(p), rng(seed), noise2(x, y), dist(a, b), angleTo(a, b), overlap(a, b) (circles x, y, r),
  overlapBox(a, b) (side boxes x, z, w, h), inArc(a, facing, b, range, halfAngle, dz), prune(list, fn) removes in place,
  tones(hex) -> { deep, sh, base, lt, hi } hue-shifted shades, ramp(hex, n), shade(hex, -1..1), mix(a, b, t),
  hex(str) -> [r, g, b], store.get(key, fallback) / store.set(key, value) save data, E.VIEWS, new E.View(id, label,
  yawDeg, pitchDeg, scale, zBoost)

## Recipes
Side-scroller (Mario, Mega Man): PlatformMap + Platformer + Humanoid, view 'side'.
```js platformer
(() => {
const E = My3D2dge;
const game = new E.Game({ canvas: 'screen', res: 'snes', view: 'side', views: ['side', 'brawler'], input: 'PLATFORMER' });
const level = new E.PlatformMap({
  rows: ['                                  ',
         '               ?                  ',
         '        ===             ==        ',
         '  @           g     ^^       g  F ',
         '#################  ###############'],
  legend: { '#': 1, '=': 2, '?': 3, '^': 4, '@': 'hero', g: 'walker', F: 'flag' },
  types: { 1: { style: 'ground', side: '#8a5a32' }, 2: { kind: 'oneway' }, 3: { style: 'bonus', side: '#e8a830' }, 4: { kind: 'hazard' } }
});
const start = level.find('hero'), flag = level.find('flag');
const hero = new E.Platformer({ x: start.x, z: start.z });
const rig = new E.Humanoid({ hat: 'cap', weapon: null, colors: { cloth: '#d83a2a', pants: '#3050c0' } });
const foes = level.findAll('walker').map(p => ({ x: p.x, z: p.z, w: 12, h: 12, vx: 0, vz: 0, dir: -1, rig: new E.Blob({ feet: true, colors: { base: '#a06030', dk: '#5a3018', lt: '#d09060' } }) }));
game.cam.bounds = v => level.bounds(v);
game.particles.ground = (x, y, z) => level.groundBelow(x, z);           // sparks and debris land on platforms
game.start({
  update(dt) {
    hero.update(dt, level, game.input);
    if (hero.jumped) game.audio.sfx('jump');
    if (hero.bumped && level.types[hero.bumped.id].style === 'bonus') { level.set(hero.bumped.cx, hero.bumped.cz, 1); game.audio.sfx('coin'); game.particles.glints(hero.x, 0, hero.z + 30, 6); }
    if (level.touching(hero, 'hazard') || hero.z < -40) { Object.assign(hero, { x: start.x, z: start.z, vx: 0, vz: 0 }); game.audio.sfx('hurt'); }
    for (const f of foes) {
      f.vz -= 800 * dt; f.vx = f.dir * 25; level.move(f, dt);
      const ahead = level.groundBelow(f.x + f.dir * 8, f.z);
      if (f.hitWall || ahead === null || ahead < f.z - 4) f.dir = -f.dir;   // turn at walls and ledges
      f.rig.update(dt, { look: [f.dir, 0], walk: 1 });
      if (!f.dead && E.overlapBox(hero, f)) {
        if (hero.vz < 0 && hero.z > f.z + f.h / 2) { f.dead = true; hero.vz = 220; game.audio.sfx('stomp'); game.particles.dust(f.x, 0, f.z, 8); }
        else { hero.knock(hero.x < f.x ? -1 : 1); game.audio.sfx('hurt'); }
      }
    }
    E.prune(foes, f => f.dead);
    if (Math.abs(hero.x - flag.x) < 8) { game.audio.sfx('powerup'); Object.assign(hero, { x: start.x, z: start.z }); }
    rig.update(dt, hero.rigState());
    game.focus(hero.x, 0, hero.z + 24);                                   // side view: y = 0, z is up
  },
  draw(r) {
    r.sky(['#5c94fc', '#a8c8ff']);
    level.draw(r);
    r.queue(flag.x, 0, flag.z, g => { const [x, y] = r.w(flag.x, 0, flag.z); E.px.rect(g, x, y - 40, 2, 40, '#e8e8e8'); E.px.poly(g, [[x + 2, y - 40], [x + 14, y - 35], [x + 2, y - 30]], '#40c040'); });
    for (const f of foes) r.actor(f.x, 0, f.z, (g, ox, oy) => f.rig.draw(g, ox, oy, r.view));
    r.actor(hero.x, 0, hero.z, (g, ox, oy) => rig.draw(g, ox, oy, r.view));
  }
});
})();
```
Shoot-'em-up (1942): view 'overhead', sprites, Bullets, a starfield.
```js shmup
(() => {
const E = My3D2dge, W = 224, H = 256;
const game = new E.Game({ canvas: 'screen', res: [W, H], view: 'overhead', views: ['overhead'], input: 'SHMUP' });
const SHIP = E.sprite(['...w...', '..wbw..', '.wwbww.', 'wwrwrww', 'w..r..w'], { w: '#e8f0ff', b: '#3a7aff', r: '#ff5030' }, 2);
const FOE = E.sprite(['r.....r', '.rrrrr.', 'rryyyrr', '.r.r.r.'], { r: '#d03040', y: '#ffd040' }, 2);
const shots = new E.Bullets(game), ship = { x: W / 2, y: H - 30, r: 4 }, foes = [];
let score = 0, cool = 0, spawn = 0;
game.start({
  update(dt) {
    game.focus(W / 2, H / 2);                                            // overhead: world x/y = screen pixels
    const m = game.input.move();
    ship.x = E.clamp(ship.x + m[0] * 120 * dt, 8, W - 8); ship.y = E.clamp(ship.y + m[1] * 120 * dt, 8, H - 8);
    if ((cool -= dt) <= 0 && game.input.down('fire')) { cool = .12; shots.fire({ x: ship.x, y: ship.y - 10, vy: -300, team: 'player' }); game.audio.sfx('shoot'); }
    if ((spawn -= dt) <= 0) { spawn = .9; foes.push({ x: E.rand(20, W - 20), y: -10, r: 7, hp: 3, t: 0 }); }
    for (const f of foes) {
      f.t += dt; f.y += 40 * dt; f.x += Math.sin(f.t * 3) * 40 * dt;
      if (E.chance(dt * .6)) shots.burst({ x: f.x, y: f.y, team: 'foe', color: '#ff6080' }, [E.pattern.aim(f, ship, 90)]);
    }
    shots.update(dt);
    shots.hit(foes, (b, f) => { f.hp--; game.particles.sparks(b.x, b.y, 0, 4); }, 'player');
    for (const f of foes) if (f.hp <= 0) { score += 100; game.particles.explosion(f.x, f.y, 0, .8); }
    E.prune(foes, f => f.hp <= 0 || f.y > H + 20);
    if (shots.hit([ship], () => {}, 'foe')) { game.flash('#ff4040', .2); game.audio.sfx('hurt'); score = 0; }
  },
  draw(r) {
    r.sky(['#000010', '#101040']); r.starfield({ dir: 'down', speed: 40 });
    for (const f of foes) r.sprite(f.x, f.y, 0, FOE, { anchor: 'center' });
    r.sprite(ship.x, ship.y, 0, SHIP, { anchor: 'center' });
    shots.draw(r);
    r.text('SCORE ' + score, 4, 4, '#ffffff', { shadow: '#000', outline: false });
  }
});
})();
```
- Beat-'em-up (Final Fight): view 'brawler', a long TileMap street, Body + Humanoid({ weapon: null, build: 'bulky' })
  with stance: 'guard', new E.Combo(['jab', 'cross', 'uppercut']); a hit needs E.inArc and |dy| < 8 (same lane);
  launch with E.knockback(hero, foe, 160, 120); lock the camera with cam.bounds while a wave is alive.
- Zelda-like: TileMap rooms with game.cam.room = [roomW, roomH]; freeze play while game.cam.moving; Dialog for NPCs.
- RPG battle: view 'brawler' with rigs in two rows and an E.Menu of commands; an action steps forward, plays an
  E.Attack, shows the damage with game.hitFx, and steps back; pose: 'down' for the fallen, 'cheer' to win.
- Puzzle (Tetris): view 'overhead', res 'nes', a 2D array drawn with E.px.rect in r.overlay,
  input.repeat('left', .17, .05) for auto-shift, game.every(speed, fall) for gravity.
- Third-person stealth (Assassin's Creed): the full engine's kit (E.Mover climbs and leaps, E.Suspicion, r.sightCone);
  here, Body + map.ledge to climb, E.sees for guards, FlowField({ climb, drop }) to chase. Kit: dist/kits/...-stealth.html.

## Rules
1. World units and dt everywhere. Feel numbers (units per second, tile = 16): walk 70-90, run 95-140, jump 250-320
   with gravity 800, dash 200-260, player bullets 250-320, enemy bullets 70-120, enemies 25-45.
2. At 320x240, heroes are 40-60 px tall (Humanoid size 1.2-1.4), bosses size 1.8-2.4; hitboxes smaller than the art.
3. Every hit gets game.hitFx; deaths get particles.explosion; sounds on jump, hit, pickup and death; music per scene.
4. A title scene, play scenes with pausable: true, and a game-over or win path back to the title.
5. Dress every character (outfit, hat, colors) and give each its own moves; enemies wind up slower than the hero.
6. Nothing on screen? The camera looks elsewhere: game.follow(hero) or game.focus(...) every update (side: y = 0).

## More, outside this file: animation and examples to take from
In the repo (github.com/michaelcrosato/my-3d2dge; every clip is free to use). Its files are large: search them and take
only what the game needs; never read one whole. All of it runs at https://my-3d2dge.vercel.app/labs.
- Motion clips: 325 curated (idles, walks, runs, jumps, fights, hits, deaths, chores, dances) and 2,548 motion-capture
  takes, as readable key poses that play on any Humanoid (either engine; the full one also turns the face and hair).
    find  src/mocap/catalogs/quaternius.json, mesh2motion.json, cmu.json: each clip's name, tags and description;
          node tools/cmu.mjs ledger kick (or grep src/mocap/catalogs/cmu-takes.tsv): the takes, one a line
    take  node tools/anim-set.mjs src/mocap/sets/quaternius.js examples/cmu-lib/CMU_10.js --clips Idle_Loop,10_01
          --name MINE --out mine.js     (take NN_xx is in examples/cmu-lib/CMU_NN.js; curated sets: src/mocap/sets/)
    play  load src/mocap/readable.js, src/mocap/mocap.js and mine.js after the engine, then
          const lib = Mocap.load(MOCAP.MINE); Mocap.drive(rig, lib);
          and each step rig.mocap = lib.sample(lib.clip(name), t) (rig.mocapW 0..1 fades it over the rig's own motion;
          rig.mocapMask = 'upper' keeps the rig's own legs)
    docs/MOCAP.md: the format, retargeting, and where every clip came from.
- Objects and materials as data (full engine): r.shape('barrel', x, y, 0, { facing }) draws a still object from any
  view; materials dress floors, walls and tiles. docs/ASSETS.md: the format, the library, tools/asset-sheet.mjs.
- Worked examples: Emberdeep (src/emberdeep/), a whole game on the full engine, one line per part:
  grep -nE "def\(['\"](archetypes|characters|skills)" src/emberdeep/*.js   (28 monster, boss and dummy bodies with
  tags, 3 heroes, 30 skills: Codex's six come from one helper); bodies that are not people: grep -n "^class "
  src/emberdeep/*.js (a spider, a serpent, a floating eye, a living book, a scythed beast). They lean on the game's
  helpers: adapt them, do not paste them (the recipe for a new body is docs/CHARACTERS.md).
- A starter game per genre: dist/kits/my-3d2dge-<adventure|platformer|brawler|shooter|rpg|stealth|animlab>.html.
*/
(function (root) {
'use strict';
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const E = { version: '0.46.1', build: 'dev-build', edition: 'agent', name: 'my-3D2dge', TAU, DEG, current: null };   // build: the commit, stamped at deploy
E.versionLabel = () => 'v' + E.version + ' · ' + E.build;
const _warned = new Set();   // one console warning per distinct problem, prefixed 'my-3D2dge:'
const warn = (key, msg) => { if (_warned.has(key)) return; _warned.add(key); console.warn('my-3D2dge: ' + msg); };
E.warn = warn;

// ---- 1. MATH, COLOR, HELPERS ----
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const approach = (a, b, s) => a < b ? Math.min(b, a + s) : Math.max(b, a - s);
const ease = {
  outCubic: u => 1 - Math.pow(1 - u, 3),
  outQuad: u => 1 - (1 - u) * (1 - u),
  inQuad: u => u * u,
  inOut: u => u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2,
  outBack: u => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); }
};
const angDiff = (a, b) => ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
const lerpAng = (a, b, t) => a + angDiff(a, b) * t;
const approachAng = (a, b, s) => { const d = angDiff(a, b); return Math.abs(d) <= s ? b : a + Math.sign(d) * s; };
function rng(s) { return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash2(x, y) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(hash2(xi, yi), hash2(xi + 1, yi), u), lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v);
}
function smoothDamp(cur, target, vel, st, dt) {
  const om = 2 / st, x = om * dt, ex = 1 / (1 + x + .48 * x * x + .235 * x * x * x), ch = cur - target, tmp = (vel + om * ch) * dt;
  return [target + (ch + tmp) * ex, (vel - om * tmp) * ex];
}
const hex = h => {
  if (Array.isArray(h)) return h.slice(0, 3);
  let s = String(h).trim(); if (s[0] === '#') s = s.slice(1);
  if (s.length === 3 || s.length === 4) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  const n = parseInt(s.slice(0, 6), 16);
  if (s.length < 6 || isNaN(n)) { warn('hex:' + h, 'color "' + h + '" is not a "#rrggbb" hex color (drawn magenta)'); return [255, 0, 255]; }
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
};
const toHex = c => '#' + c.map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
function toHsl(h) {
  const [r, g, b] = hex(h).map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1)); let hh;
  if (mx === r) hh = ((g - b) / d) % 6; else if (mx === g) hh = (b - r) / d + 2; else hh = (r - g) / d + 4;
  return [(hh * 60 + 360) % 360, s, l];
}
function hsl(hh, s, l) {
  s = clamp(s, 0, 1); l = clamp(l, 0, 1); hh = ((hh % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((hh / 60) % 2 - 1)), m = l - c / 2;
  const [r, g, b] = hh < 60 ? [c, x, 0] : hh < 120 ? [x, c, 0] : hh < 180 ? [0, c, x] : hh < 240 ? [0, x, c] : hh < 300 ? [x, 0, c] : [c, 0, x];
  return toHex([(r + m) * 255, (g + m) * 255, (b + m) * 255]);
}
const hueToward = (hh, target, amt) => { const d = ((target - hh + 540) % 360) - 180; return hh + clamp(d, -amt, amt); };
// shading leans cool in shadow and warm in light, the way pixel artists shade
const _shades = new Map();
const shade = (h, a) => {
  const key = h + '|' + a; let r = _shades.get(key); if (r) return r;
  const c = hex(h), flat = toHex(c.map(v => a < 0 ? v * (1 + a) : v + (255 - v) * a)), [hh, s, l] = toHsl(flat);
  r = s < .08 ? flat : hsl(hueToward(hh, a < 0 ? 250 : 55, Math.abs(a) * 24), s + (a < 0 ? .05 : -.05) * Math.min(1, Math.abs(a) * 3), l);
  if (_shades.size > 2000) _shades.clear(); _shades.set(key, r); return r;
};
const mix = (h1, h2, t) => { const a = hex(h1), b = hex(h2); return toHex(a.map((v, i) => lerp(v, b[i], t))); };
const _tones = new Map();
function tones(c, strength = 1) {
  const key = c + ':' + strength; let t = _tones.get(key); if (t) return t;
  const [hh, s, l] = toHsl(c), k = strength, grey = s < .08;
  const f = (dl, dh, target, ds) => grey ? hsl(hh, s, l + dl * k) : hsl(hueToward(hh, target, dh * k), s + ds, l + dl * k);
  const skin = !grey && l > .62 && (hh < 50 || hh > 340);
  t = { deep: skin ? f(-.3, 22, 280, -.22) : f(-.3, 16, 250, .06), sh: skin ? f(-.14, 14, 280, -.16) : f(-.15, 9, 250, .05), base: c, lt: f(.1, 6, 50, -.02), hi: f(.24, 12, 55, -.08) };
  if (_tones.size > 600) _tones.clear();
  _tones.set(key, t); return t;
}
function ramp(c, n = 5, strength = 1) {
  const [hh, s, l] = toHsl(c), out = [];
  for (let i = 0; i < n; i++) { const u = n < 2 ? 0 : i / (n - 1) * 2 - 1; out.push(s < .08 ? hsl(hh, s, l + u * .3 * strength) : hsl(hueToward(hh, u < 0 ? 250 : 55, Math.abs(u) * 14 * strength), s + (u < 0 ? .06 : -.06) * Math.abs(u), l + u * .3 * strength)); }
  return out;
}
// a canvas; with no document (Node, headless) a stand-in whose drawing does nothing, so sprites made at load don't stop a game
const mkCanvas = (w, h) => { if (typeof document === 'undefined') return nullCanvas(w, h); const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const nullCanvas = (w, h) => {
  const c = { width: w, height: h }, img = (iw, ih) => ({ width: iw, height: ih, data: new Uint8ClampedArray(Math.max(0, iw * ih * 4)) });
  const made = { getImageData: (x, y, iw, ih) => img(iw, ih), createImageData: (iw, ih) => img(iw.width || iw, ih || iw.height), measureText: () => ({ width: 0 }),
    createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }), createPattern: () => ({}), canvas: c };
  const g = new Proxy({}, { get: (t, k) => k in t ? t[k] : k in made ? made[k] : () => {}, set: (t, k, v) => { t[k] = v; return true; } });
  c.getContext = () => g;
  return c;
};
const ctx2d = c => { const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return g; };
const V3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  len: a => Math.hypot(a[0], a[1], a[2]),
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)],
  rz: (v, a) => { const c = Math.cos(a), s = Math.sin(a); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]]; }
};
// two-bone IK in 3D: returns [joint, end]; hint points the way the joint bends
function ik3(a, b, L1, L2, hint) {
  let d = V3.sub(b, a), dist = V3.len(d);
  const max = L1 + L2 - .01;
  if (dist > max) { d = V3.mul(d, max / dist); b = V3.add(a, d); dist = max; }
  dist = Math.max(dist, .01);
  const n = V3.mul(d, 1 / dist);
  let h = V3.sub(hint, V3.mul(n, V3.dot(hint, n)));
  const hl = V3.len(h);
  h = hl < 1e-4 ? [n[1], -n[0], 0] : V3.mul(h, 1 / hl);
  const x = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist), y = Math.sqrt(Math.max(0, L1 * L1 - x * x));
  return [V3.add(V3.add(a, V3.mul(n, x)), V3.mul(h, y)), b];
}
const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = list => list[(Math.random() * list.length) | 0];
const chance = p => Math.random() < p;
const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y, (b.z || 0) - (a.z || 0));
const angleTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const overlap = (a, b) => { const dx = a.x - b.x, dy = a.y - b.y, r = (a.r || 0) + (b.r || 0); return dx * dx + dy * dy < r * r; };
const overlapBox = (a, b) => Math.abs(a.x - b.x) * 2 < a.w + b.w && a.z < b.z + b.h && b.z < a.z + a.h;
// THE HEIGHT RULES (collision, standing, sight, reach, navigation and drawing read heights the same way): a body's z is its
// feet, a cell's top is map.height(cx, cy); a body stands on the highest top within z + step under it; eyes at z + eye see
// a target at z + chest (a body's own eye / chest override them); the same level is |dz| <= level. Fits a size-1.3 Humanoid
const HEIGHTS = { eye: 30, chest: 22, level: 8, step: 2 };
// melee cone on the ground; dz (optional) also limits the height difference
const inArc = (a, facing, b, range, halfAngle, dz) => { const dx = b.x - a.x, dy = b.y - a.y; return Math.hypot(dx, dy) <= range + (b.r || 0) && Math.abs(angDiff(facing, Math.atan2(dy, dx))) <= halfAngle && (dz === undefined || Math.abs((b.z || 0) - (a.z || 0)) <= dz); };
const sameLevel = (a, b, tol = HEIGHTS.level) => Math.abs((a.z || 0) - (b.z || 0)) <= tol;
// what `from` can reach in list, nearest first: [{ target, d, dz, angle }]. o: { range, arc (half angle), facing, dz (default
// HEIGHTS.level), sight: map, filter }
const targets = (from, list, o = {}) => {
  const range = o.range === undefined ? Infinity : o.range, arc = o.arc === undefined ? Math.PI : o.arc, facing = o.facing === undefined ? from.facing || 0 : o.facing;
  const dzMax = o.dz === undefined ? HEIGHTS.level : o.dz, out = [];
  for (const t of list) {
    if (!t || t === from || (o.filter && !o.filter(t))) continue;
    const dx = t.x - from.x, dy = t.y - from.y, d = Math.hypot(dx, dy), dz = (t.z || 0) - (from.z || 0), angle = Math.atan2(dy, dx);
    if (d > range + (t.r || 0) || Math.abs(dz) > dzMax || (arc < Math.PI && Math.abs(angDiff(facing, angle)) > arc)) continue;
    if (o.sight && !o.sight.sight(from, t)) continue;
    out.push({ target: t, d, dz, angle });
  }
  return out.sort((p, q) => p.d - q.d);
};
// sight and hearing through the height rules: E.sees(guard, hero, { map, range: 120, fov: 1.6 }) -> { seen, d, angle, exposure }
// (three points on the target past every top; its own exposure 0..1 and crouch lower it); E.hears -> 1 at a noise .. 0 at loud
const sees = (obs, tgt, o = {}) => {
  const range = o.range === undefined ? 120 : o.range, fov = o.fov === undefined ? 1.6 : o.fov, facing = o.facing === undefined ? obs.facing || 0 : o.facing;
  const dx = tgt.x - obs.x, dy = tgt.y - obs.y, d = Math.hypot(dx, dy), angle = Math.atan2(dy, dx), out = { seen: false, d, angle, exposure: 0 };
  if (d > range + (tgt.r || 0) || (d > (obs.r || 0) && Math.abs(angDiff(facing, angle)) > fov / 2)) return out;
  const low = tgt.crouch ? .55 : 1, eye = o.eye !== undefined ? o.eye : obs.eye !== undefined ? obs.eye : HEIGHTS.eye;
  let vis = 0;
  for (const h of [3, (tgt.chest !== undefined ? tgt.chest : HEIGHTS.chest) * low, (HEIGHTS.eye + 2) * low]) if (!o.map || o.map.ray(obs, tgt, { eye, target: h }).clear) vis++;
  out.exposure = vis / 3 * (tgt.exposure === undefined ? 1 : clamp(tgt.exposure, 0, 1)) * (tgt.crouch ? .6 : 1);
  out.seen = out.exposure > 0;
  return out;
};
const hears = (lis, noise, map) => {
  const R = noise.loud === undefined ? 80 : noise.loud, d = Math.hypot(noise.x - lis.x, noise.y - lis.y, (noise.z || 0) - (lis.z || 0));
  let k = Math.max(0, 1 - d / R);
  if (k > 0 && map && !map.ray(lis, noise, { eye: HEIGHTS.eye, target: 4 }).clear) k *= .5;   // a wall muffles it
  return k;
};
const prune = (list, fn) => { let j = 0; for (let i = 0; i < list.length; i++) if (!fn(list[i])) list[j++] = list[i]; list.length = j; return list; };
const store = {
  get(key, fallback = null) { try { const v = localStorage.getItem('my3d2dge:' + key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; } },
  set(key, value) { try { localStorage.setItem('my3d2dge:' + key, JSON.stringify(value)); return true; } catch (e) { return false; } },
  remove(key) { try { localStorage.removeItem('my3d2dge:' + key); } catch (e) { /* storage blocked */ } }
};
Object.assign(E, { clamp, lerp, approach, ease, angDiff, lerpAng, approachAng, rng, hash2, noise2, smoothDamp, hex, toHex, toHsl, hsl, shade, mix, tones, ramp,
  mkCanvas, ctx2d, V3, ik3, rand, randInt, pick, chance, dist, angleTo, overlap, overlapBox, inArc, sameLevel, targets, sees, hears, HEIGHTS, prune, store });

// ---- 2. PIXELS: every shape snaps to whole pixels (never anti-aliased); g is a CanvasRenderingContext2D ----
const px = {};
px.col = (g, c) => { if (g._c !== c) { g.fillStyle = c; g._c = c; } };
px.reset = g => { g._c = null; };
px.rect = (g, x, y, w, h, c) => { px.col(g, c); g.fillRect(Math.round(x), Math.round(y), w, h); };
px.dot = (g, x, y, c) => { px.col(g, c); g.fillRect(Math.round(x), Math.round(y), 1, 1); };
px.line = (g, x0, y0, x1, y1, c, w = 1) => {
  px.col(g, c);
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1, o = w >> 1;
  let e = dx + dy;
  for (let i = 0; i < 2000; i++) {
    g.fillRect(x0 - o, y0 - o, w, w);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; x0 += sx; }
    if (e2 <= dx) { e += dx; y0 += sy; }
  }
};
px.disc = (g, cx, cy, r, c) => {
  px.col(g, c); cx = Math.round(cx); cy = Math.round(cy);
  const R = r + .35, R2 = R * R, n = Math.floor(R);
  for (let dy = -n; dy <= n; dy++) { const hw = Math.floor(Math.sqrt(R2 - dy * dy)); g.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1); }
};
px.ell = (g, cx, cy, rx, ry, c) => {
  px.col(g, c); cx = Math.round(cx); cy = Math.round(cy);
  const Ry = ry + .35, n = Math.floor(Ry);
  for (let dy = -n; dy <= n; dy++) {
    const t = 1 - (dy * dy) / (Ry * Ry); if (t < 0) continue;
    const hw = Math.floor((rx + .35) * Math.sqrt(t)); g.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
  }
};
const _xs = [];
function scan(pts, span) {
  let y0 = 1e9, y1 = -1e9;
  for (const p of pts) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
  y0 = Math.round(y0); y1 = Math.round(y1);
  const n = pts.length;
  for (let y = y0; y <= y1; y++) {
    _xs.length = 0;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const a = pts[i], b = pts[j];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) _xs.push(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
    }
    _xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < _xs.length; k += 2) { const xa = Math.round(_xs[k]), xb = Math.round(_xs[k + 1]); span(xa, Math.max(xa, xb), y); }
  }
}
px.poly = (g, pts, c) => { px.col(g, c); scan(pts, (a, b, y) => g.fillRect(a, y, b - a + 1, 1)); };
// translucency in 1/8 steps with blend modes, like PS1 / SNES color math
const qa = a => Math.round(clamp(a, 0, 1) * 8) / 8;
const BLEND = { normal: 'source-over', add: 'lighter', multiply: 'multiply', screen: 'screen', sub: 'difference', overlay: 'overlay' };
px.blend = (g, a, mode, fn) => {
  const ga = g.globalAlpha, gc = g.globalCompositeOperation;
  g.globalAlpha = ga * qa(a); g.globalCompositeOperation = BLEND[mode] || mode || 'source-over';
  try { fn(); } finally { g.globalAlpha = ga; g.globalCompositeOperation = gc; }
};
px.polyDither = (g, pts, c, a) => {
  if (a <= 0) return; if (a >= 1) return px.poly(g, pts, c);
  const A = qa(a); if (A > 0) px.blend(g, A, 'normal', () => px.poly(g, pts, c));
};
px.ddisc = (g, cx, cy, r, c, a) => {
  if (a <= 0) return;
  const ga = g.globalAlpha;
  for (const [k, f] of [[1, .42], [.7, .42], [.4, .5]]) { const A = qa(a * f); if (A <= 0 || r * k < .4) continue; g.globalAlpha = ga * A; px.disc(g, cx, cy, r * k, c); }
  g.globalAlpha = ga;
};
// string sprites: one character per pixel, '.' and ' ' transparent, colors maps characters to hex
function sprite(rows, colors = {}, scale = 1) {
  if (typeof rows === 'string') rows = rows.split('\n');
  rows = rows.map(s => String(s));
  const s = Math.max(1, Math.round(scale)), w = Math.max(1, ...rows.map(r => r.length)) * s, h = Math.max(1, rows.length) * s;
  const cv = mkCanvas(w, h), g = ctx2d(cv), fl = mkCanvas(w, h), fg = ctx2d(fl);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') { x++; continue; }
      let n = 1; while (x + n < row.length && row[x + n] === ch) n++;
      const c = colors[ch];
      if (!c) warn('sprite:' + ch, 'sprite character "' + ch + '" has no color in the colors map (drawn magenta)');
      g.fillStyle = fg.fillStyle = c || '#ff00ff'; g.fillRect(x * s, y * s, n * s, s); fg.fillRect(w - (x + n) * s, y * s, n * s, s);
      x += n;
    }
  });
  return { w, h, cv, fl, isSprite: true };
}
E.sprite = sprite;
px.sprite = (g, spr, x, y, flip = false) => g.drawImage(flip ? spr.fl : spr.cv, Math.round(x), Math.round(y));
E.px = px;

// ---- 3. VIEWS: orthographic cameras. yaw spins around up, pitch tilts from side (0) to straight down (90), scale = px per unit ----
//   screen x = ax*x + ay*y;  screen y = bx*x + by*y + bz*z
class View {
  constructor(id, label, yaw, pitch, scale = 1, zBoost = 1) { this.id = id; this.label = label; this.set(yaw, pitch, scale, zBoost); }
  set(yaw, pitch, scale = 1, zBoost = 1) {
    this.yawDeg = yaw; this.pitchDeg = pitch; this.scale = scale; this.zBoost = zBoost;
    const w = yaw * DEG, p = pitch * DEG, cw = Math.cos(w), sw = Math.sin(w), cp = Math.cos(p), sp = Math.sin(p);
    this.yaw = w; this.pitch = p;
    this.ax = scale * cw; this.ay = -scale * sw;
    this.bx = scale * sp * sw; this.by = scale * sp * cw; this.bz = -scale * cp * zBoost;
    this.dx = sw * cp; this.dy = cw * cp; this.dz = sp;   // camera depth direction (bigger = nearer)
    this.fx = sw; this.fy = cw;                           // ground direction toward the camera
    this.isTop = pitch >= 89; this.isSide = pitch <= 1;
    const det = this.ax * this.by - this.ay * this.bx;
    this.inv = Math.abs(det) > 1e-6 && pitch > 5 ? [this.by / det, -this.ay / det, -this.bx / det, this.ax / det] : null;
    return this;
  }
  p(x, y, z = 0) { return [this.ax * x + this.ay * y, this.bx * x + this.by * y + this.bz * z]; }
  depth(x, y, z = 0) { return this.dx * x + this.dy * y + this.dz * z; }
  order(x, y, z = 0) { return this.isTop ? z + (this.bx * x + this.by * y) * 1e-3 : this.fx * x + this.fy * y + z * 1e-3; }
  toGround(sx, sy) { const i = this.inv; return i ? [i[0] * sx + i[1] * sy, i[2] * sx + i[3] * sy] : null; }
  screenDirToGround(dx, dy) {
    if (!dx && !dy) return [0, 0];
    let g = this.inv ? [this.inv[0] * dx + this.inv[1] * dy, this.inv[2] * dx + this.inv[3] * dy] : [dx, dy];
    const l = Math.hypot(g[0], g[1]) || 1, m = Math.min(1, Math.hypot(dx, dy));
    return [g[0] / l * m, g[1] / l * m];
  }
}
E.View = View;
E.VIEWS = {
  iso: new View('iso', 'Isometric', 45, 30, Math.SQRT2, 1),
  threequarter: new View('threequarter', 'Three-quarter', 0, 55, 1.5, 1.35),
  topdown: new View('topdown', 'Top-down', 0, 80, 1.5, 1.3),
  brawler: new View('brawler', 'Brawler', 0, 25, 1.5, 1),
  side: new View('side', 'Side', 0, 0, 1.5, 1),
  overhead: new View('overhead', 'Overhead', 0, 90, 1, 1)
};
E.VIEW_ORDER = ['iso', 'threequarter', 'topdown', 'brawler', 'side'];
E.style = {};
// steep ground views draw rigs from a lower, sprite-like angle so faces show (E.style.charPitch = false turns it off)
const _cviews = new Map();
function charView(view) {
  const P = E.style.charPitch;
  if (P === false || view.pitchDeg < 40 || view.pitchDeg >= 89) return view;
  const cp = P || 30, key = view.yawDeg + ':' + view.pitchDeg + ':' + view.scale + ':' + view.zBoost + ':' + cp;
  let v = _cviews.get(key);
  const h = view.pitchDeg <= 70 ? view.zBoost * Math.cos(view.pitchDeg * DEG) : .78;
  if (!v) { v = new View(view.id, view.label, view.yawDeg, cp, view.scale, h / Math.cos(cp * DEG)); _cviews.set(key, v); }
  return v;
}
E.charView = charView;

// ---- 4. SCREEN: low-res buffer, whole-number upscale, sub-pixel camera on present ----
E.RES = { nes: [256, 240], snes: [256, 224], gb: [160, 144], gba: [240, 160], genesis: [320, 224], n64: [320, 240], ps1: [320, 240], wide: [400, 225] };
class Screen {
  // canvas null: a headless game's screen, sized as a 1280 x 720 window would size it, with nothing to draw on
  constructor(canvas, o, signal) {
    this.canvas = canvas; this._sctx = canvas ? canvas.getContext('2d') : null; this._o = o;
    this.buf = canvas ? mkCanvas(8, 8) : null; this.ctx = canvas ? ctx2d(this.buf) : null;
    this.W = 320; this.H = 200; this.S = 3; this.OX = 0; this.OY = 0; this.dpr = 1;
    this.ix = 0; this.iy = 0; this.fx = 0; this.fy = 0;
    this.scale = 'auto';   // a fixed res: 'sharp' (whole-number scale), 'fill' (the largest fit), 'auto' (fill on high-density screens)
    // o.expand: res is the least the screen shows; the picture grows on both sides to fill it (no bars; up to expand.maxW x maxH)
    this.resize();
    if (canvas) addEventListener('resize', () => this.resize(), { signal });
  }
  /** the sizing options in force: o.portrait's fields over the game's while the screen is taller than wide */
  _options(pw, ph) { const o = this._o; return o.portrait && ph > pw ? Object.assign({}, o, o.portrait) : o; }
  _fixedRes(o = this._o) {
    const r = o.res; if (!r) return null;
    const v = Array.isArray(r) ? r : E.RES[String(r).toLowerCase()];
    if (!v) { warn('res:' + r, 'unknown res "' + r + '". Use one of ' + Object.keys(E.RES).join(', ') + ' or [width, height]'); return null; }
    return [Math.max(16, v[0] | 0), Math.max(16, v[1] | 0)];
  }
  resize() {
    const c = this.canvas, dpr = c ? Math.min(window.devicePixelRatio || 1, 3) : 1, rc = c ? c.getBoundingClientRect() : { width: 1280, height: 720 };
    const pw = Math.max(1, Math.round(rc.width * dpr)), ph = Math.max(1, Math.round(rc.height * dpr)), o = this._options(pw, ph);
    if (c) { c.width = pw; c.height = ph; } this.dpr = dpr; this.portrait = ph > pw;
    const fix = this._fixedRes(o);
    if (fix) {
      const fit = Math.min(pw / fix[0], ph / fix[1]), fill = this.scale === 'fill' || (this.scale === 'auto' && dpr >= 2 && fit >= 2), x = o.expand;
      this.S = fill ? Math.max(1, fit) : Math.max(1, Math.min(Math.floor(pw / fix[0]), Math.floor(ph / fix[1])));
      this.W = x ? clamp(Math.ceil(pw / this.S - 1e-6), fix[0], Math.max(fix[0], x.maxW || 1e4)) : fix[0]; this.H = x ? clamp(Math.ceil(ph / this.S - 1e-6), fix[1], Math.max(fix[1], x.maxH || 1e4)) : fix[1];   // (a cap never cuts below res)
    }
    else { this.S = Math.max(1, Math.min(Math.floor(ph / o.minH), Math.floor(pw / o.minW))); this.W = Math.min(o.maxW, Math.ceil(pw / this.S)); this.H = Math.min(o.maxH, Math.ceil(ph / this.S)); }
    this.OX = Math.floor((pw - this.W * this.S) / 2); this.OY = Math.floor((ph - this.H * this.S) / 2);
    if (this.buf) { this.buf.width = this.W + 2; this.buf.height = this.H + 2; this.ctx = ctx2d(this.buf); this.ctx._c = null; }
  }
  setOptions(o) { Object.assign(this._o, o); this.resize(); }
  setScale(v) { this.scale = v === 'sharp' || v === 'fill' ? v : 'auto'; this.resize(); }
  _begin(cx, cy, bg) {
    this.ix = Math.floor(cx); this.iy = Math.floor(cy); this.fx = cx - this.ix; this.fy = cy - this.iy;
    const g = this.ctx; g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g._c = null;
    g.fillStyle = bg; g.fillRect(0, 0, this.buf.width, this.buf.height);
  }
  _present() {
    const s = this._sctx, S = this.S; if (!s) return;
    s.imageSmoothingEnabled = false;
    s.fillStyle = '#000'; s.fillRect(0, 0, this.canvas.width, this.canvas.height);
    s.save(); s.beginPath(); s.rect(this.OX, this.OY, this.W * S, this.H * S); s.clip();
    s.drawImage(this.buf, 0, 0, this.W + 1, this.H + 1, this.OX - Math.round(this.fx * S), this.OY - Math.round(this.fy * S), (this.W + 1) * S, (this.H + 1) * S);
    s.restore();
  }
  clientToScreen(cx, cy) {
    if (!this.canvas) return null;
    const rc = this.canvas.getBoundingClientRect(), dx = (cx - rc.left) * this.dpr, dy = (cy - rc.top) * this.dpr;
    return [(dx - this.OX + Math.round(this.fx * this.S)) / this.S + this.ix, (dy - this.OY + Math.round(this.fy * this.S)) / this.S + this.iy];
  }
}

// ---- 5. INPUT: actions are names bound to codes (KeyboardEvent.code, 'Mouse0'/'Mouse2', 'Pad0'..'Pad15' standard gamepad buttons) ----
class Input {
  // signal removes every listener (game.dispose()); a headless game's input (no canvas) comes from press, release, tap, hold
  constructor(screen, map, signal) {
    this.screen = screen; this.use(map);
    this.held = new Set(); this.clock = 0; this._pt = {}; this._used = {}; this._rk = {};
    this._fresh = new Set(); this._now = new Set(); this._freshUp = new Set(); this._nowUp = new Set(); this._taps = new Set(); this._tapsDue = new Set();
    this.mouse = { cx: 0, cy: 0, active: false }; this.padMove = [0, 0]; this.padPrev = []; this.padIndex = null; this.padId = ''; this.deadzone = .18;
    this.lastDevice = 'keyboard'; this.glyphs = 'auto'; this.padLost = false;   // label() follows the device used last; glyphs: 'auto' | 'xbox' | 'playstation' | 'nintendo' | 'generic'
    const el = screen.canvas; if (!el) return;
    const addEventListener = (type, fn) => window.addEventListener(type, fn, { signal }), typing = e => { const t = e.target; return !!t && (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable || (t.tagName === 'INPUT' && !['range', 'checkbox', 'radio', 'button', 'submit', 'color'].includes(t.type))); };
    const at = e => { this.mouse.cx = e.clientX; this.mouse.cy = e.clientY; this.mouse.active = true; };
    addEventListener('keydown', e => { if (!typing(e) && this._codes[e.code]) { e.preventDefault(); if (!e.repeat) this.press(e.code); } });
    addEventListener('keyup', e => this.release(e.code));
    addEventListener('blur', () => this.clear());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.clear(); }, { signal });
    el.addEventListener('contextmenu', e => e.preventDefault(), { signal });
    el.addEventListener('pointermove', at, { signal });
    el.addEventListener('pointerdown', e => { at(e); this.press('Mouse' + e.button); }, { signal });
    addEventListener('pointerup', e => this.release('Mouse' + e.button));
  }
  use(map) {
    if (this.held) this.clear();
    if (typeof map === 'string') map = Input[map.toUpperCase()] || Input.DEFAULT;
    const stick = { up: 'PadAxisUp', down: 'PadAxisDown', left: 'PadAxisLeft', right: 'PadAxisRight' };   // the left stick past halfway, as the d-pad
    this.map = {}; for (const a in map) this.map[a] = [...new Set([...map[a], ...(a === 'start' || a === 'pause' ? ['Act:menu'] : []), ...(stick[a] ? [stick[a]] : []), 'Act:' + a])];   // (Act:menu: a touch START)
    this._codes = {}; for (const a in this.map) for (const c of this.map[a]) (this._codes[c] = this._codes[c] || []).push(a);
    return this;
  }
  press(code) {
    if (this.held.has(code)) return; this.held.add(code);
    this.lastDevice = code.startsWith('Pad') ? 'gamepad' : code.startsWith('Act:') ? 'touch' : code.startsWith('Mouse') ? 'mouse' : 'keyboard';
    for (const a of this._codes[code] || []) { this._pt[a] = this.clock; this._used[a] = false; this._rk[a] = -1; this._fresh.add(a); }
  }
  release(code) {
    if (!this.held.delete(code)) return;
    for (const a of this._codes[code] || []) if (!this.down(a)) this._freshUp.add(a);
  }
  // scripted input (tests, bots): tap(a) presses an action for one step; hold(a, on) holds it down or lets it go
  tap(a) { if (!this.map[a]) { this._check(a); return; } const c = 'Act:' + a; this.press(c); this._taps.add(c); }
  hold(a, on = true) { if (!this.map[a]) { this._check(a); return; } if (on) this.press('Act:' + a); else this.release('Act:' + a); }
  _check(a) { if (!this.map[a]) warn('action:' + a, 'unknown input action "' + a + '". Known actions: ' + Object.keys(this.map).join(', ') + ". Add your own with new E.Game({ input: { ...E.Input.DEFAULT, " + a + ": ['KeyQ'] } })"); }
  down(a) { const m = this.map[a]; if (!m) { this._check(a); return false; } for (const c of m) if (this.held.has(c)) return true; return false; }
  pressed(a) { if (!this.map[a]) this._check(a); return this._now.has(a); }
  released(a) { return this._nowUp.has(a); }
  repeat(a, delay = .3, rate = .08) {
    if (this.pressed(a)) return true;
    if (!this.down(a) || this._pt[a] === undefined) return false;
    const t = this.clock - this._pt[a]; if (t < delay) return false;
    const k = Math.floor((t - delay) / rate); if (k !== this._rk[a]) { this._rk[a] = k; return true; }
    return false;
  }
  buffered(a, win = .15) { if (!this.map[a]) this._check(a); const t = this._pt[a]; return t !== undefined && !this._used[a] && this.clock - t <= win; }
  consume(a) { this._used[a] = true; }
  consumeAll() { for (const a in this.map) this._used[a] = true; this._now.clear(); this._fresh.clear(); }
  clear() { this.held.clear(); this.consumeAll(); this._nowUp.clear(); this._freshUp.clear(); this._pt = {}; this._rk = {}; this.padMove = [0, 0]; }
  anyPressed() { return this._now.size > 0; }
  move() {
    let x = (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0), y = (this.down('down') ? 1 : 0) - (this.down('up') ? 1 : 0);
    if (Math.hypot(this.padMove[0], this.padMove[1]) > 0) { x = this.padMove[0]; y = this.padMove[1]; }
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    return [x, y];
  }
  mouseScreen() { return this.mouse.active ? this.screen.clientToScreen(this.mouse.cx, this.mouse.cy) : null; }
  // a code as a person reads it ('W', 'Space', 'Left click', a gamepad button by its family's symbol: 'A', '✕', 'B')
  codeLabel(code) {
    if (!code) return '';
    if (/^Key[A-Z]$/.test(code)) return code.slice(3);
    if (/^Digit\d$/.test(code)) return code.slice(5);
    if (/^Pad\d+$/.test(code)) return (PAD_GLYPHS[this.padStyle()] || PAD_GLYPHS.xbox)[+code.slice(3)] || code;
    return CODE_LABELS[code] || (code.startsWith('Act:') ? code.slice(4).toUpperCase() : code);
  }
  padStyle() { if (this.glyphs && this.glyphs !== 'auto') return this.glyphs; const id = this.padId || ''; return /054c|playstation|dualsense|dualshock|wireless controller/i.test(id) ? 'playstation' : /057e|nintendo|pro controller|joy-con/i.test(id) ? 'nintendo' : 'xbox'; }
  // the key or button to show in a prompt for action a on the device used last: input.label('jump') -> 'Space', 'A' or '✕'
  label(a, device = this.lastDevice) {
    const m = this.map[a]; if (!m) { this._check(a); return ''; }
    if (device === 'touch') return a.toUpperCase();
    const real = m.filter(c => !c.startsWith('Act:')), pads = real.filter(c => c.startsWith('Pad')), keys = real.filter(c => !c.startsWith('Pad'));
    const c = device === 'gamepad' ? pads[0] || keys[0] : device === 'mouse' ? keys.find(c => c.startsWith('Mouse')) || keys[0] || pads[0] : keys.find(c => !c.startsWith('Mouse')) || keys[0] || pads[0];
    return c ? this.codeLabel(c) : '';
  }
  tick(dt) {
    this.clock += dt; this.padLost = false;
    let p = null;
    try { p = Array.from(navigator.getGamepads ? navigator.getGamepads() : []).find(q => q && q.connected !== false) || null; } catch (e) { /* gamepads blocked */ }
    if ((p ? p.index : null) !== this.padIndex) { if (!p && this.padIndex !== null) this.padLost = this.lastDevice === 'gamepad'; this.padPrev.forEach((on, i) => { if (on) this.release('Pad' + i); }); for (const c of ['PadAxisUp', 'PadAxisDown', 'PadAxisLeft', 'PadAxisRight']) this.release(c); this.padPrev = []; this.padMove = [0, 0]; this.padIndex = p ? p.index : null; this.padId = p ? p.id : ''; }
    if (p) {
      const x = p.axes[0] || 0, y = p.axes[1] || 0, l = Math.hypot(x, y), d = clamp(this.deadzone, 0, .8), k = l <= d ? 0 : Math.min(1, (l - d) / (1 - d)) / l;
      this.padMove = [x * k, y * k];
      p.buttons.forEach((b, i) => { if (b.pressed && !this.padPrev[i]) this.press('Pad' + i); if (!b.pressed && this.padPrev[i]) this.release('Pad' + i); this.padPrev[i] = b.pressed; });
      [this.padMove[1] < -.5, this.padMove[1] > .5, this.padMove[0] < -.5, this.padMove[0] > .5].forEach((on, i) => { const c = ['PadAxisUp', 'PadAxisDown', 'PadAxisLeft', 'PadAxisRight'][i]; if (on) this.press(c); else this.release(c); });
    }
    for (const c of this._tapsDue) this.release(c);   // a tap is held for the one step after it
    const due = this._tapsDue; due.clear(); this._tapsDue = this._taps; this._taps = due;
    // presses since the last step become this step's pressed() / released()
    const n = this._now; n.clear(); this._now = this._fresh; this._fresh = n;
    const u = this._nowUp; u.clear(); this._nowUp = this._freshUp; this._freshUp = u;
  }
}
// menu actions in every preset. Pad9 = Start, Pad0 = A (bottom), Pad1 = B (right), Pad12-15 = d-pad
const MENU_KEYS = { start: ['Enter', 'NumpadEnter', 'Pad9'], pause: ['Escape', 'KeyP', 'Pad9'], confirm: ['Enter', 'NumpadEnter', 'Space', 'KeyJ', 'KeyZ', 'Pad0'], cancel: ['Escape', 'Backspace', 'KeyX', 'KeyK', 'Pad1'] };
const DIRS = { up: ['KeyW', 'ArrowUp', 'Pad12'], down: ['KeyS', 'ArrowDown', 'Pad13'], left: ['KeyA', 'ArrowLeft', 'Pad14'], right: ['KeyD', 'ArrowRight', 'Pad15'] };
Input.DEFAULT = { ...DIRS, attack: ['KeyJ', 'KeyX', 'Mouse0', 'Pad0', 'Pad7'], dash: ['Space', 'ShiftLeft', 'ShiftRight', 'KeyK', 'Pad1', 'Pad6'], skill: ['KeyL', 'KeyE', 'Mouse2', 'Pad2', 'Pad5'], jump: ['KeyZ', 'Pad3'], ...MENU_KEYS };
Input.PLATFORMER = { ...DIRS, jump: ['Space', 'KeyZ', 'KeyK', 'Pad0'], attack: ['KeyX', 'KeyJ', 'Mouse0', 'Pad2'], dash: ['ShiftLeft', 'ShiftRight', 'KeyC', 'KeyL', 'Pad1', 'Pad5'], skill: ['KeyE', 'KeyV', 'Mouse2', 'Pad3'], ...MENU_KEYS };
Input.SHMUP = { ...DIRS, fire: ['Space', 'KeyZ', 'KeyJ', 'Mouse0', 'Pad0', 'Pad7'], bomb: ['KeyX', 'KeyK', 'Mouse2', 'Pad1', 'Pad6'], ...MENU_KEYS };
E.Input = Input;
// a standard gamepad's buttons by position (0 bottom, 1 right, 2 left, 3 top, 4-7 shoulders, 8 back, 9 start, 10-11 sticks, 12-15 d-pad)
const PAD_GLYPHS = {
  xbox: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'LS', 'RS', 'D-pad ↑', 'D-pad ↓', 'D-pad ←', 'D-pad →', 'Guide'],
  playstation: ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'Create', 'Options', 'L3', 'R3', 'D-pad ↑', 'D-pad ↓', 'D-pad ←', 'D-pad →', 'PS'],
  nintendo: ['B', 'A', 'Y', 'X', 'L', 'R', 'ZL', 'ZR', '−', '+', 'L stick', 'R stick', 'D-pad ↑', 'D-pad ↓', 'D-pad ←', 'D-pad →', 'Home'],
  generic: ['Bottom', 'Right', 'Left', 'Top', 'L1', 'R1', 'L2', 'R2', 'Select', 'Start', 'L3', 'R3', 'D-pad ↑', 'D-pad ↓', 'D-pad ←', 'D-pad →', 'Home']
};
const CODE_LABELS = { Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'R Shift', ControlLeft: 'Ctrl', ControlRight: 'R Ctrl', AltLeft: 'Alt', AltRight: 'R Alt', Enter: 'Enter', NumpadEnter: 'Enter',
  Escape: 'Esc', Backspace: 'Backspace', Tab: 'Tab', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Mouse0: 'Left click', Mouse1: 'Middle click', Mouse2: 'Right click' };

// ---- 6. FONT: 5x7 proportional pixel font with lower case. Glyph data: char, width, then one base-32 digit per row (bit 1 << (w - 1 - x) = pixel x) ----
const F = { g: {}, h: 7, desc: 2, gap: 1, space: 3 };
for (const e of "05ehjlphe 154c4444e 25eh1248v 35u11e11u 4526aiv22 55vgu11he 65egguhhe 75v124888 85ehhehhe 95ehhf11e A5ehhvhhh B5uhhuhhu C5ehggghe D5uhhhhhu E5vgguggv F5vgguggg G5ehgnhhf H5hhhvhhh I37222227 J572222ic K5hikokih L5ggggggv M5hrllhhh N5hhpljhh O5ehhhhhe P5uhhuggg Q5ehhhlid R5uhhukih S5fgge11u T5v444444 U5hhhhhhe V5hhhhha4 W5hhhllla X5hha4ahh Y5hha4444 Z5v1248gv a500e1fhf b5gguhhhu c500eggge d511fhhhf e500ehvge f434f4444 g500fhhhf1e h5gguhhhh i11011111 j3101111152 k4889aca9 l22222221 m500qllll n500uhhhh o500ehhhe p500uhhhugg q500fhhhf11 r400bc888 s500fge1u t444f4443 u500hhhhf v500hhha4 w500hhlla x500ha4ah y500hhhhf1e z500v248v !11111101 \"35500000 #5aavavaa $54fke5u4 %5pp248jj &5cik8lid '11100000 (31244421 )34211124 *50level0 +5044v440 ,200000112 -4000f000 .10000001 /511248gg :10010010 ;200100112 <41248421 =500v0v00 >48421248 ?5eh12404 @5ehnlngf [37444447 \\5gg84211 ]37111117 ^54ah0000 _5000000v `22100000 {43448443 |11111111 }4c22122c ~5008l200 ♥50avve40 ★544veah0 ←5048v840 →5042v240 ↑54el4440 ↓50444le4 •30027200 ©5ehlklhe ×50ha4ah0 ▸48cefec8 ♪56544cs8".split(" ")) {
  const w = +e[1], runs = [];
  for (let y = 0; y < e.length - 2; y++) { const v = parseInt(e[y + 2], 32); for (let x = 0; x < w;) { if (!(v >> (w - 1 - x) & 1)) { x++; continue; } let n = 1; while (x + n < w && v >> (w - 1 - x - n) & 1) n++; runs.push([x, y, n]); x += n; } }
  F.g[e[0]] = { w, runs };
}
const glyph = ch => F.g[ch] || F.g[ch.toUpperCase()] || F.g['?'];
const lineW = line => { let w = 0; for (const ch of line) w += ch === ' ' ? F.space + 1 : glyph(ch).w + 1; return Math.max(0, w - 1); };
const fo = o => typeof o === 'number' ? { scale: o } : (o || {}), fsc = o => Math.max(1, Math.round(o.scale || 1));
E.font = {
  width(s, o) { o = fo(o); let m = 0; for (const line of String(s).split('\n')) m = Math.max(m, lineW(line)); return m * fsc(o); },
  lineHeight(o) { o = fo(o); return (F.h + F.desc + (o.lineGap === undefined ? F.gap : o.lineGap)) * fsc(o); },
  height(lines = 1, o) { o = fo(o); return this.lineHeight(o) * (lines - 1) + (F.h + F.desc) * fsc(o); },
  wrap(s, maxW, o) {
    const lim = maxW / fsc(fo(o)), out = [];
    for (const para of String(s).split('\n')) {
      let line = '';
      for (const word of para.split(' ')) {
        const t = line ? line + ' ' + word : word;
        if (lineW(t) <= lim || !line) line = t; else { out.push(line); line = word; }
        while (lineW(line) > lim && line.length > 1) { let k = line.length - 1; while (k > 1 && lineW(line.slice(0, k)) > lim) k--; out.push(line.slice(0, k)); line = line.slice(k); }
      }
      out.push(line);
    }
    return out;
  },
  // opts: an outline color, false, or { outline, shadow, gradient: [top, bottom], scale, align: 'left' | 'center' | 'right', wrap: maxWidthPx, lineGap }
  text(g, s, x, y, color = '#ffffff', o = '#0b0814') {
    if (o === null || o === false || typeof o === 'string') o = { outline: o };
    const sc = fsc(o), outline = o.outline === undefined ? '#0b0814' : o.outline, lh = this.lineHeight(o), grad = o.gradient && o.gradient.length ? o.gradient : null;
    const lines = o.wrap ? this.wrap(s, o.wrap, o) : String(s).split('\n');
    x = Math.round(x); y = Math.round(y);
    let w = 0;
    const draw = (ox, oy, c, useGrad) => lines.forEach((line, li) => {
      const lw = lineW(line) * sc, lx = x + (o.align === 'center' ? -Math.round(lw / 2) : o.align === 'right' ? -lw : 0), ly = y + li * lh;
      w = Math.max(w, lw);
      let cx = 0;
      for (const ch of line) {
        if (ch === ' ') { cx += F.space + 1; continue; }
        const gl = glyph(ch);
        for (const [rx, ry, rn] of gl.runs) { px.col(g, useGrad ? grad[Math.min(grad.length - 1, Math.floor(ry / F.h * grad.length))] : c); g.fillRect(lx + (cx + rx) * sc + ox, ly + ry * sc + oy, rn * sc, sc); }
        cx += gl.w + 1;
      }
    });
    if (o.shadow) draw(sc, sc, o.shadow, false);
    if (outline) for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) draw(ox, oy, outline, false);
    draw(0, 0, color, !!grad);
    return { w, h: lh * (lines.length - 1) + (F.h + F.desc) * sc };
  },
  // big logo text: title(g, 'NAME', x, y, { scale: 3, colors: [top .. bottom], outline, depth, depthColor, align, shine })
  title(g, s, x, y, o = {}) {
    const sc = Math.max(1, Math.round(o.scale || 3)), colors = o.colors || ['#fff6c8', '#ffe08a', '#ffb347', '#e0662a'], outline = o.outline === undefined ? '#1a0c10' : o.outline;
    const depth = o.depth === undefined ? Math.max(1, sc - 1) : o.depth, dc = o.depthColor || shade(colors[colors.length - 1], -.55);
    const base = Object.assign({}, o, { scale: sc, outline: false, shadow: false, gradient: null });
    for (let d = depth; d >= 1; d--) this.text(g, s, x + d, y + d, dc, base);
    if (outline) for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) this.text(g, s, x + ox, y + oy, outline, base);
    const rows = F.h * sc, bands = [];
    for (let k = 0; k < rows; k++) { const t = k / Math.max(1, rows - 1) * (colors.length - 1), i = Math.min(colors.length - 2, Math.floor(t)); bands.push(colors.length < 2 ? colors[0] : mix(colors[i], colors[i + 1], t - i)); }
    const lines = String(s).split('\n'), lh = this.lineHeight(base);
    lines.forEach((line, li) => {
      const lw = lineW(line) * sc, lx = Math.round(x) + (o.align === 'center' ? -Math.round(lw / 2) : o.align === 'right' ? -lw : 0), ly = Math.round(y) + li * lh;
      let cx = 0;
      for (const ch of line) {
        if (ch === ' ') { cx += F.space + 1; continue; }
        const gl = glyph(ch);
        for (const [rx, ry, rn] of gl.runs) for (let sy = 0; sy < sc; sy++) { px.col(g, bands[Math.min(rows - 1, ry * sc + sy)] || colors[0]); g.fillRect(lx + (cx + rx) * sc, ly + ry * sc + sy, rn * sc, 1); }
        if (o.shine !== false) for (const [rx, ry, rn] of gl.runs) if (ry === 0) { px.col(g, o.shine || '#ffffff'); g.fillRect(lx + (cx + rx) * sc, ly, rn * sc, 1); }
        cx += gl.w + 1;
      }
    });
    return { w: this.width(s, base), h: this.height(lines.length, base) };
  }
};

// ---- 7. PARTICLES: 3D, projected. kinds: dust spark bit ember ring text fire smoke impact glint. g > 0 pulls down, bounce 0..1 ----
class Particles {
  constructor(game) { this._game = game; this.list = []; this.max = 900; }
  add(p) {
    if (this.list.length >= this.max) return null;
    const q = Object.assign({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: .5, g: 0, drag: 0, bounce: 0, kind: 'dust', color: '#d8c6a8', size: 1 }, p);
    this.list.push(q); return q;
  }
  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i]; p.life += dt;
      if (p.life >= p.max) { L[i] = L[L.length - 1]; L.pop(); continue; }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vy *= k; p.vz = p.vz * k - p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      let fl = 0;   // particles.ground(x, y, z) -> floor height (side-scroller platforms), looked up per 8-unit column
      if (p.floor !== undefined) fl = p.floor;
      else if (this.ground) { const c = Math.floor(p.x / 8); if (p._fc !== c) { p._fc = c; p._fl = this.ground(p.x, p.y, p.z) || 0; } fl = p._fl; }
      if (p.z < fl && p.kind !== 'ring') { p.z = fl; if (p.bounce) { p.vz = -p.vz * p.bounce; p.vx *= .7; p.vy *= .7; } else p.vz = 0; }
    }
  }
  draw(r) {
    const view = r.view, s = view.scale;
    // flat overhead views have no screen height, so rising particles lift on screen instead
    if (view.isTop) r = Object.create(r, { w: { value: (x, y, z) => { const q = Renderer.prototype.w.call(r, x, y, 0); q[1] -= z * .5; return q; } } });
    for (const p of this.list) {
      if (p.kind !== 'ring' && !r.visible(p.x, p.y, p.z, 12, 12, 12)) continue;
      const u = p.life / p.max, at = () => r.w(p.x, p.y, p.z);
      switch (p.kind) {
        case 'dust': r.queue(p.x, p.y, p.z, g => { const [x, y] = at(), rad = p.size * s * (1 + u * 1.4); px.blend(g, (1 - u) * .85, 'normal', () => { px.disc(g, x, y, rad, p.color); if (rad > 1.5) px.disc(g, x - rad * .3, y - rad * .3, rad * .45, shade(p.color, .18)); }); }); break;
        case 'spark': r.queue(p.x, p.y, p.z, g => { const [x, y] = at(), [x2, y2] = r.w(p.x - p.vx * .025, p.y - p.vy * .025, p.z - p.vz * .025); px.line(g, x, y, x2, y2, u < .5 ? (p.hot || '#fff5cf') : p.color, p.size > 1.5 ? 2 : 1); }); break;
        case 'bit': r.queue(p.x, p.y, p.z, g => { const [x, y] = at(); px.rect(g, x, y, p.size, p.size, p.color); }); break;
        case 'ember': r.queue(p.x, p.y, p.z, g => { const [x, y] = at(); px.blend(g, 1 - u * .8, 'add', () => px.dot(g, x, y, u < .4 ? '#fff0b0' : p.color)); }); break;
        case 'ring': if (view.pitchDeg < 20) r.queue(p.x, p.y, p.z, g => { const [x, y] = at(), rad = lerp(p.r0, p.r1, ease.outQuad(u)) * s, n = Math.max(16, Math.round(rad * 3)); px.blend(g, 1 - u, 'add', () => { px.col(g, p.color); for (let i = 0; i < n; i++) { const a = i / n * TAU; g.fillRect(Math.round(x + Math.cos(a) * rad), Math.round(y + Math.sin(a) * rad * .9), 1, 1); } }); }, { bias: .3 });
          else r.decal(() => r.groundRing(p.x, p.y, lerp(p.r0, p.r1, ease.outQuad(u)), p.color, 1 - u, p.z)); break;
        case 'text': r.overlay(g => { const [x, y] = at(); if (u < .75 || Math.floor(p.life * 20) % 2) E.font.text(g, p.text, x, y, p.color, { align: 'center', scale: p.scale || 1, outline: '#0b0814' }); }); break;
        case 'fire': r.queue(p.x, p.y, p.z, g => {   // white-hot core, yellow, orange, red rim, then smoke
          const [x, y] = at(), rad = p.size * s * (u < .3 ? .6 + u * 1.4 : 1.02 - (u - .3) * .5), c = u < .15 ? '#fffbe0' : u < .3 ? '#ffe070' : u < .5 ? '#ffa030' : u < .7 ? '#e0502a' : '#5a4a4a';
          px.blend(g, u < .7 ? 1 : (1 - u) / .3, 'normal', () => { px.disc(g, x, y, rad, c); if (u < .5) px.disc(g, x - rad * .2, y - rad * .2, rad * .55, u < .25 ? '#ffffff' : '#fff0a0'); else px.disc(g, x - rad * .25, y - rad * .25, rad * .4, shade(c, .2)); });
        }, { bias: .2 }); break;
        case 'smoke': r.queue(p.x, p.y, p.z, g => {   // hard-edged puff in three flat tones
          const [x, y] = at(), rad = p.size * s * (.6 + u * 1.3), body = u < .3 ? (p.dark || '#3a3438') : (p.color || '#7a7078');
          px.blend(g, (1 - u) * .8, 'normal', () => { px.disc(g, x, y, rad, shade(body, -.12)); px.disc(g, x - rad * .18, y - rad * .22, rad * .74, body); px.disc(g, x - rad * .34, y - rad * .4, rad * .34, p.light || shade(body, .22)); });
        }, { bias: .1 }); break;
        case 'impact': r.queue(p.x, p.y, p.z, g => {   // hit star that pops and shrinks
          const [x, y] = at(), R = p.size * s * (u < .35 ? 1 : 1.4 - u), pts = [];
          for (let i = 0; i < 16; i++) { const a = i / 16 * TAU + p.rot, rr = i % 2 ? R * .38 : R; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
          px.poly(g, pts, u < .35 ? '#ffffff' : p.color); px.disc(g, x, y, Math.max(1, R * .3), '#ffffff');
        }, { bias: .4 }); break;
        case 'glint': r.queue(p.x, p.y, p.z, g => { const [x, y] = at(), k = Math.round((1 - Math.abs(u * 2 - 1)) * p.size * 2.5); px.rect(g, x - k, y, k * 2 + 1, 1, p.color); px.rect(g, x, y - k, 1, k * 2 + 1, p.color); px.dot(g, x, y, '#ffffff'); }, { bias: .3 }); break;
      }
    }
  }
  dust(x, y, z, n, o = {}) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, sp = (o.speed || 30) * (.4 + Math.random()); this.add({ kind: 'dust', x: x + Math.cos(a) * 2, y: y + Math.sin(a) * 2, z: z + Math.random() * 2, vx: Math.cos(a) * sp + (o.vx || 0), vy: Math.sin(a) * sp + (o.vy || 0), vz: 8 + Math.random() * 14, g: -6, drag: 5, max: .35 + Math.random() * .35, size: (o.size || 1.2) * (.7 + Math.random() * .6), color: o.color || '#b9a88f' }); } }
  sparks(x, y, z, n, dir = null, o = {}) { for (let i = 0; i < n; i++) { const a = dir === null ? Math.random() * TAU : dir + (Math.random() - .5) * 1.6, sp = 80 + Math.random() * 170; this.add({ kind: 'spark', x, y, z, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 20 + Math.random() * 110, g: 360, drag: 3, max: .15 + Math.random() * .2, color: o.color || '#ffb85c', hot: o.hot }); } }
  bits(x, y, z, n, colors) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, sp = 30 + Math.random() * 90; this.add({ kind: 'bit', x, y, z: z + Math.random() * 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 60 + Math.random() * 120, g: 420, bounce: .45, drag: .8, max: .7 + Math.random() * .6, size: Math.random() < .35 ? 2 : 1, color: colors[(Math.random() * colors.length) | 0] }); } }
  ring(x, y, r0, r1, color, dur = .35, z = 0) { this.add({ kind: 'ring', x, y, z, r0, r1, color, max: dur }); }
  text(x, y, z, text, color = '#fff2c4', o = {}) { this.add({ kind: 'text', x, y, z, vz: o.bounce ? 70 : 38, g: o.bounce ? 260 : 40, bounce: o.bounce ? .35 : 0, floor: o.bounce ? z : undefined, text: String(text), color, max: o.bounce ? 1.1 : .8, scale: o.scale || 1 }); }
  smoke(x, y, z, n = 4, o = {}) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, sp = 8 + Math.random() * 14; this.add(Object.assign({ kind: 'smoke', x: x + Math.cos(a) * 3, y: y + Math.sin(a) * 3, z: z + Math.random() * 4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 14 + Math.random() * 18, g: -4, drag: 1.5, max: .9 + Math.random() * .7 }, o, { size: (o.size || 4) * (.7 + Math.random() * .6) })); } }
  fire(x, y, z, n = 6, o = {}) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, sp = (o.speed || 40) * Math.random(); this.add({ kind: 'fire', x: x + Math.cos(a) * 2, y: y + Math.sin(a) * 2, z: z + Math.random() * 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 10 + Math.random() * 30, g: -10, drag: 3, max: .35 + Math.random() * .35, size: (o.size || 5) * (.6 + Math.random() * .6) }); } }
  impact(x, y, z, size = 6, color = '#ffe070') { this.add({ kind: 'impact', x, y, z, max: .16, size, color, rot: Math.random() * TAU }); }
  glints(x, y, z, n = 5, color = '#fff6c0', spread = 10) { for (let i = 0; i < n; i++) this.add({ kind: 'glint', x: x + (Math.random() - .5) * spread, y: y + (Math.random() - .5) * spread, z: z + Math.random() * spread, vz: 6, max: .35 + Math.random() * .4, size: 1 + Math.random(), color }); }
  // fireball, smoke, sparks, debris, shockwave ring, shake, hit-stop, flash and sound in one call. o: { debris: [colors] | false, sound, flash, shake, freeze }
  explosion(x, y, z, size = 1, o = {}) {
    const G = this._game;
    this.fire(x, y, z, Math.round(7 * size), { size: 5 * size, speed: 45 * size });
    this.smoke(x, y, z + 4 * size, Math.round(5 * size), { size: 5 * size });
    this.sparks(x, y, z, Math.round(10 * size));
    if (o.debris !== false) this.bits(x, y, z, Math.round(8 * size), o.debris || ['#6a5a4a', '#3a3438', '#ffb040']);
    this.ring(x, y, 3 * size, 26 * size, '#ffe0a0', .4, z);
    if (o.shake !== 0) G.shake(o.shake === undefined ? 2.5 * size : o.shake); if (o.freeze !== false) G.freeze(.03 * Math.min(2, size));
    if (o.flash !== false && size >= 1.5) G.flash('#fff4d0', .12);
    if (o.sound !== false) G.audio.sfx(size >= 1.5 ? 'boom' : 'explode');
  }
}

// ---- 8. RENDERER: the r handed to draw(r). Frame order: background, decals, depth-sorted queue, overlays, present ----
const AS = 256, AOX = 128, AOY = 200;   // scratch image per actor: room for figures up to about 250 px tall
class Renderer {
  constructor(game) {
    this.game = game; this._items = []; this._decals = []; this._overlays = []; this.outline = '#140c1c';
    this._aCv = mkCanvas(AS, AS); this._aG = ctx2d(this._aCv); this._mCv = mkCanvas(AS, AS); this._mG = ctx2d(this._mCv);
    // track what each actor draws, so outline and flash only touch that rectangle
    const aG = this._aG, bb = this._bb = [AS, AS, 0, 0], fr = aG.fillRect.bind(aG), di = aG.drawImage.bind(aG);
    const grow = (x, y, w, h) => { if (x < bb[0]) bb[0] = x; if (y < bb[1]) bb[1] = y; if (x + w > bb[2]) bb[2] = x + w; if (y + h > bb[3]) bb[3] = y + h; };
    aG.fillRect = (x, y, w, h) => { grow(x, y, w, h); fr(x, y, w, h); };
    aG.drawImage = (img, ...a) => { if (a.length >= 8) grow(a[4], a[5], a[6], a[7]); else if (a.length >= 4) grow(a[0], a[1], a[2], a[3]); else grow(a[0], a[1], img.width, img.height); di(img, ...a); };
    for (const m of ['fill', 'stroke', 'fillText', 'strokeText', 'putImageData']) { const f = aG[m].bind(aG); aG[m] = (...a) => { grow(0, 0, AS, AS); return f(...a); }; }
    this._R = [0, 0, AS, AS];
  }
  get ctx() { return this.game.screen.ctx; }
  get view() { return this.game.view; }
  get W() { return this.game.screen.W; }
  get H() { return this.game.screen.H; }
  get bw() { return this.game.screen.buf.width; }
  get bh() { return this.game.screen.buf.height; }
  _begin(cx, cy) {
    const sc = this.game.screen, st = this.game.stats;
    sc._begin(cx, cy, this.game.o.bg);
    this.ix = sc.ix; this.iy = sc.iy; this._items.length = 0; this._decals.length = 0; this._overlays.length = 0; this._map = null; st.actors = 0; st.culled = 0;
  }
  // world -> buffer pixel
  w(x, y, z = 0) { const v = this.game.view; return [v.ax * x + v.ay * y - this.ix, v.bx * x + v.by * y + v.bz * z - this.iy]; }
  queue(x, y, z, fn, o) {
    let k = this.game.view.order(x, y, z) + (o && o.bias || 0);
    if (z > .5 && this._map && !(o && o.occluder)) k = this._map._liftOrder(this.game.view, x, y, z, k);   // standing on a TileMap block: sort after it
    this._items.push({ k, fn });
  }
  decal(fn) { this._decals.push(fn); }
  overlay(fn) { this._overlays.push(fn); }
  groundPts(x, y, rad, n = 18, z = 0) { const pts = []; for (let i = 0; i < n; i++) { const a = i / n * TAU; pts.push(this.w(x + Math.cos(a) * rad, y + Math.sin(a) * rad, z)); } return pts; }
  groundDisc(x, y, rad, color, alpha = 1, z = 0) { px.polyDither(this.ctx, this.groundPts(x, y, rad, 18, z), color, alpha); }
  groundRing(x, y, rad, color, alpha = 1, z = 0) {
    const g = this.ctx, n = Math.max(16, Math.round(rad * this.view.scale * 5)), ga = g.globalAlpha;
    px.col(g, color); g.globalAlpha = ga * qa(alpha);
    for (let i = 0; i < n; i++) { const a = i / n * TAU, [sx, sy] = this.w(x + Math.cos(a) * rad, y + Math.sin(a) * rad, z); g.fillRect(Math.round(sx), Math.round(sy), 1, 1); }
    g.globalAlpha = ga;
  }
  groundArc(x, y, r0, r1, a0, a1, color, alpha = 1, z = 0, g = this.ctx) {
    const n = Math.max(3, Math.ceil(Math.abs(a1 - a0) / .18)), pts = [];
    for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); pts.push(this.w(x + Math.cos(a) * r1, y + Math.sin(a) * r1, z)); }
    for (let i = n; i >= 0; i--) { const a = lerp(a0, a1, i / n); pts.push(this.w(x + Math.cos(a) * r0, y + Math.sin(a) * r0, z)); }
    px.polyDither(g, pts, color, alpha);
  }
  marker(x, y, z = 0, o = {}) {   // an objective marker: a diamond over (x, y, z) on screen, an arrow at the edge off it
    const [sx, sy] = this.w(x, y, z), color = o.color || '#ffd040', dark = shade(color, -.6), W = this.W, H = this.H, m = 9, bob = this.game.reduceMotion ? 0 : Math.sin(this.game.real * 4) * 1.5;
    this.overlay(g => {
      if (sx >= m && sx <= W - m && sy >= m + 14 && sy <= H - m) {
        const cx = Math.round(sx), cy = Math.round(sy - 14 + bob);
        px.poly(g, [[cx, cy - 5], [cx + 4, cy], [cx, cy + 5], [cx - 4, cy]], dark); px.poly(g, [[cx, cy - 4], [cx + 3, cy], [cx, cy + 4], [cx - 3, cy]], color);
        if (o.label) E.font.text(g, o.label, cx, cy - 13, color, { align: 'center', shadow: '#000', outline: false });
      } else if (o.offscreen !== false) {
        const mx = W / 2, my = H / 2, a = Math.atan2(sy - my, sx - mx), k = Math.min((W / 2 - m) / Math.max(1e-6, Math.abs(Math.cos(a))), (H / 2 - m) / Math.max(1e-6, Math.abs(Math.sin(a))));
        const ax = Math.round(mx + Math.cos(a) * k), ay = Math.round(my + Math.sin(a) * k), c = Math.cos(a), s = Math.sin(a), tip = [ax + c * 5, ay + s * 5];
        px.poly(g, [[tip[0] + c, tip[1] + s], [ax - s * 5 - c * 2, ay + c * 5 - s * 2], [ax + s * 5 - c * 2, ay - c * 5 - s * 2]], dark);
        px.poly(g, [tip, [ax - s * 4 - c, ay + c * 4 - s], [ax + s * 4 - c, ay - c * 4 - s]], color);
        if (o.label) E.font.text(g, o.label, clamp(ax - c * 10, 14, W - 14), clamp(ay - s * 10 - 3, 2, H - 8), color, { align: 'center', shadow: '#000', outline: false });
      }
    });
  }
  _stamp(key, make) {
    const m = this._stamps || (this._stamps = new Map());
    let st = m.get(key); if (st) return st;
    if (m.size > 400) m.clear();
    st = make(); m.set(key, st); return st;
  }
  // contact shadow: a cached translucent ellipse, correct for the view. z = height of the surface it falls on
  shadow(x, y, rad, alpha = .5, color = '#0c0818', z = 0) {
    const draw = () => {
      const v = this.view, R = Math.round(rad * 2) / 2, A = Math.round(alpha * 20) / 20;
      const st = this._stamp('s' + v.id + v.pitchDeg + v.yawDeg + v.scale + ':' + R + ':' + A + color, () => {
        const pts = []; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (let i = 0; i < 18; i++) { const a = i / 18 * TAU, q = v.p(Math.cos(a) * R, Math.sin(a) * R, 0); pts.push(q); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
        const ox = Math.floor(x0) - 1, oy = Math.floor(y0) - 1, c = mkCanvas(Math.ceil(x1) - ox + 2, Math.ceil(y1) - oy + 2);
        px.polyDither(ctx2d(c), pts.map(q => [q[0] - ox, q[1] - oy]), color, A);
        return { c, ox, oy };
      });
      const [sx, sy] = this.w(x, y, z); this.ctx.drawImage(st.c, Math.round(sx) + st.ox, Math.round(sy) + st.oy);
    };
    if (z > .5) this.queue(x, y, z - .01, draw, { bias: -.001 }); else this.decal(draw);
  }
  // pixel sprite (E.sprite) standing at a world point. o: { flip, anchor: 'bottom' | 'center' | 'top', bias, flash, outline, alpha }
  sprite(x, y, z, spr, o = {}) {
    if (!spr || !spr.isSprite) { warn('r.sprite', 'r.sprite(x, y, z, spr) needs a sprite made with E.sprite(rows, colors)'); return; }
    const ax = Math.floor(spr.w / 2), ay = o.anchor === 'center' ? Math.floor(spr.h / 2) : o.anchor === 'top' ? 0 : spr.h, flip = !!o.flip;
    if (o.flash || o.outline || (o.alpha !== undefined && o.alpha < 1)) { this.actor(x, y, z, (g, ox, oy) => px.sprite(g, spr, ox - ax, oy - ay, flip), Object.assign({ outline: false }, o)); return; }
    if (!this.visible(x, y, z, spr.w + 8, spr.h + 8, spr.h + 8)) return;
    this.queue(x, y, z, g => { const [sx, sy] = this.w(x, y, z); px.sprite(g, spr, Math.round(sx) - ax, Math.round(sy) - ay, flip); }, { bias: o.bias });
  }
  // background gradient bands, top to bottom (call first in draw): r.sky(['#0b1030', '#3b2d6b', '#e0806a'], { bands })
  sky(colors, o = {}) {
    if (typeof colors === 'string') colors = [colors];
    const W = this.bw, H = this.bh;
    this.ctx.drawImage(this._stamp('sky' + colors.join() + W + 'x' + H + (o.bands || 0), () => {
      const c = mkCanvas(W, H), g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data, cs = colors.map(hex), n = cs.length, steps = o.bands || 0;
      for (let y = 0; y < H; y++) {
        let f = n < 2 ? 0 : y / Math.max(1, H - 1) * (n - 1); if (steps) f = Math.round(f * steps) / steps;
        const i = Math.min(n - 2, Math.max(0, Math.floor(f))), t = f - i, col = n < 2 ? cs[0] : cs[i].map((v, j) => Math.round(lerp(v, cs[i + 1][j], t) / 8) * 8);
        for (let x = 0; x < W; x++) { const k = (y * W + x) * 4; d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; d[k + 3] = 255; }
      }
      g.putImageData(img, 0, 0); return c;
    }), 0, 0);
  }
  // scrolling stars: { count: 70, speed: 30, dir: 'down' | 'up' | 'left' | 'right', colors, layers: 3, seed, height: 0..1 }
  starfield(o = {}) {
    const g = this.ctx, W = this.bw, H = this.bh, t = this.game.time, n = o.count || 70, sp = o.speed === undefined ? 30 : o.speed;
    const cols = o.colors || ['#ffffff', '#a9b8ff', '#5d6aa0'], layers = o.layers || 3, seed = o.seed || 7, dir = o.dir || 'down', maxY = o.height ? H * o.height : H;
    for (let i = 0; i < n; i++) {
      const L = i % layers, d = t * sp * (1 - L / (layers + .5));
      let x = hash2(i, seed) * W, y = hash2(i + 7919, seed) * maxY;
      if (dir === 'down') y += d; else if (dir === 'up') y -= d; else if (dir === 'left') x -= d; else x += d;
      x = ((x % W) + W) % W; y = ((y % maxY) + maxY) % maxY;
      const c = cols[Math.min(cols.length - 1, L)];
      px.dot(g, x, y, c);
      if (L === 0 && hash2(i, seed + 1) > .75) { if (dir === 'down' || dir === 'up') px.dot(g, x, y + (dir === 'down' ? -1 : 1), c); else px.dot(g, x + (dir === 'left' ? 1 : -1), y, c); }
    }
  }
  text(str, x, y, color = '#ffffff', o) { this.overlay(g => E.font.text(g, str, x, y, color, o)); }
  textAt(x, y, z, str, color = '#ffffff', o = {}) { this.overlay(g => { const [sx, sy] = this.w(x, y, z); E.font.text(g, str, sx, sy, color, Object.assign({ align: 'center' }, o)); }); }
  // additive glow halo (cached): glowDisc(g, x, y, radius, color, 0..1)
  glowDisc(g, cx, cy, rad, color, a) {
    const R = Math.round(rad * 2) / 2, A = Math.round(a * 20) / 20, n = Math.ceil(R) + 1;
    const st = this._stamp('d' + R + ':' + A + color, () => { const c = mkCanvas(n * 2 + 1, n * 2 + 1); px.ddisc(ctx2d(c), n, n, R, color, Math.min(1, A * 1.6)); return c; });
    px.blend(g, 1, 'add', () => g.drawImage(st, Math.round(cx) - n, Math.round(cy) - n));
  }
  // extruded box (crate, pedestal, table) inside a queue fn: r.box(g, x0, y0, z0, x1, y1, z1, topColor, sideColor)
  box(g, x0, y0, z0, x1, y1, z1, top, side) {
    if (typeof top !== 'string' || typeof side !== 'string') { warn('box:args', 'r.box(g, x0, y0, z0, x1, y1, z1, topColor, sideColor) needs 9 arguments'); top = typeof top === 'string' ? top : '#ff00ff'; side = typeof side === 'string' ? side : top; }
    const view = this.view, P = (x, y, z) => this.w(x, y, z);
    if (!view.isTop) for (const [nx, ny, A, B] of [[0, -1, [x1, y0], [x0, y0]], [0, 1, [x0, y1], [x1, y1]], [-1, 0, [x0, y0], [x0, y1]], [1, 0, [x1, y1], [x1, y0]]]) {
      if (nx * view.fx + ny * view.fy <= .02) continue;
      const lit = .6 * nx + .8 * ny;
      px.poly(g, [P(A[0], A[1], z0), P(B[0], B[1], z0), P(B[0], B[1], z1), P(A[0], A[1], z1)], lit < -.2 ? shade(side, .12) : lit > .5 ? shade(side, -.25) : side);
    }
    px.poly(g, [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], top);
  }
  visible(x, y, z = 0, mx = 60, up = 30, down = 90) { const [sx, sy] = this.w(x, y, z); return sx > -mx && sx < this.bw + mx && sy > -up && sy < this.bh + down; }
  // a character: drawFn(g, ox, oy) draws around (ox, oy) = where world point (x, y, z) lands. o: { outline = true, outlineColor, flash: '#fff' | true, flashMix: .5, alpha, bias, margin }
  actor(x, y, z, drawFn, o = {}) {
    const st = this.game.stats;
    if (!this.visible(x, y, z, o.margin || 60)) { st.culled++; return; }
    st.actors++;
    if (o.outline === false && !o.flash && (o.alpha === undefined || o.alpha >= 1)) { this.queue(x, y, z, g => { const [a, b] = this.w(x, y, z); drawFn(g, Math.round(a), Math.round(b)); }, { bias: o.bias }); return; }
    this.queue(x, y, z, g => this._composite(g, x, y, z, drawFn, o), { bias: o.bias });
  }
  _tint(dst, src, color, R) {
    const [x0, y0, w, h] = R;
    dst.globalCompositeOperation = 'source-over'; dst.clearRect(x0, y0, w, h); dst.drawImage(src, x0, y0, w, h, x0, y0, w, h);
    dst.globalCompositeOperation = 'source-in'; dst.fillStyle = color; dst._c = null; dst.fillRect(x0, y0, w, h);
    dst.globalCompositeOperation = 'source-over';
  }
  _composite(g, x, y, z, drawFn, o) {
    const aG = this._aG, bb = this._bb, P = this._R;
    aG.clearRect(P[0], P[1], P[2], P[3]); aG._c = null;
    bb[0] = AS; bb[1] = AS; bb[2] = 0; bb[3] = 0;
    drawFn(aG, AOX, AOY);
    const x0 = Math.max(0, Math.floor(bb[0]) - 2), y0 = Math.max(0, Math.floor(bb[1]) - 2), x1 = Math.min(AS, Math.ceil(bb[2]) + 2), y1 = Math.min(AS, Math.ceil(bb[3]) + 2);
    if (x1 <= x0 || y1 <= y0) { this._R = [0, 0, 0, 0]; return; }
    const R = this._R = [x0, y0, x1 - x0, y1 - y0], w = R[2], h = R[3];
    const [sx, sy] = this.w(x, y, z), bx = Math.round(sx) - AOX, by = Math.round(sy) - AOY, al = o.alpha === undefined ? 1 : o.alpha;
    const put = cv => g.drawImage(cv, x0, y0, w, h, bx + x0, by + y0, w, h);
    g.globalAlpha = al;
    if (o.outline !== false) { this._tint(this._mG, this._aCv, o.outlineColor || this.outline, R); for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) g.drawImage(this._mCv, x0, y0, w, h, bx + x0 + dx, by + y0 + dy, w, h); }
    if (o.flash) {   // the flash tints over the sprite so its shading still shows (flashMix: 1 = solid)
      const fm = o.flashMix === undefined ? .5 : o.flashMix;
      if (fm < 1) put(this._aCv);
      this._tint(this._mG, this._aCv, typeof o.flash === 'string' ? o.flash : '#fff6ea', R); g.globalAlpha = al * fm; put(this._mCv);
    } else put(this._aCv);
    g.globalAlpha = 1;
  }
  _finish() {
    const g = this.ctx, items = this._items;
    this.game.particles.draw(this);
    for (const d of this._decals) d(g);
    items.sort((a, b) => a.k - b.k);
    for (const it of items) it.fn(g);
    for (const f of this._overlays) f(g);
    this.game.stats.items = items.length;
    this.game.screen._present();
  }
}

// ---- 9. GAME: loop, fixed-step clock, scenes, camera, hit-stop, shake, flash, timers, on-screen errors ----
let _errBox = null;
const BOOT = { el: null, game: null, played: false, failed: false, lines: [] };   // the boot screen (9c): an error before play shows there, as a report
E.showError = (title, e) => {
  if (typeof document === 'undefined') return;
  if (!document.body) { addEventListener('DOMContentLoaded', () => E.showError(title, e)); return; }
  if (!BOOT.played && BOOT.fail && (BOOT.el || E.current)) { BOOT.fail(title, e); return; }
  if (!_errBox) {
    _errBox = document.createElement('div'); _errBox.id = 'my3d2dge-error'; _errBox.setAttribute('role', 'alert');
    _errBox.style.cssText = 'position:fixed;left:8px;right:8px;top:8px;z-index:99999;max-height:45vh;overflow:auto;background:rgba(40,0,8,.95);color:#ffd6d6;border:2px solid #ff5a5a;border-radius:6px;padding:10px 12px;font:12px/1.45 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap;cursor:pointer';
    _errBox.addEventListener('click', () => { _errBox.remove(); _errBox = null; });
    document.body.appendChild(_errBox);
  }
  const detail = e && e.stack ? String(e.stack) : String(e && e.message || e);
  const d = E.diagnose ? E.diagnose() : null;
  _errBox.textContent = 'my-3D2dge: ' + title + '\n' + detail.split('\n').slice(0, 5).join('\n') + (d ? '\n' + d.short : '') + '\n(click to hide. Full details are in the browser console; My3D2dge.diagnose() gives the report.)';
};
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('error', ev => { if (ev && (ev.error || ev.message)) E.showError('script error (the game could not start, or crashed outside update/draw)', ev.error || (ev.message + ' (line ' + ev.lineno + ')')); });
  window.addEventListener('unhandledrejection', ev => E.showError('unhandled promise rejection', ev.reason));
}
class Game {
  // headless (or no DOM: Node): no screen, renderer, sound or DOM input; drive it with advance(). loop: false runs only by advance().
  // The standard features (9b): fullscreen: 'tap' (a phone's first tap) | 'button' | false; corner: false hides the corner's
  // buttons; autoPause: false keeps a pausable scene running when the page is hidden; id: the name settings are saved under
  constructor(o = {}) {
    o = Object.assign({}, o);
    this.headless = !!o.headless || typeof document === 'undefined';
    if (this.headless) o.canvas = null;
    else {
      if (typeof o.canvas === 'string') o.canvas = document.getElementById(o.canvas.replace(/^#/, '')) || document.querySelector(o.canvas);
      if (!o.canvas) o.canvas = document.getElementById('screen') || document.querySelector('canvas') || Game._makeCanvas();
    }
    if (typeof o.input === 'string') o.input = Input[o.input.toUpperCase()] || (warn('input:' + o.input, 'unknown input preset "' + o.input + '" (use DEFAULT, PLATFORMER or SHMUP)'), Input.DEFAULT);
    this.o = Object.assign({ view: 'iso', minH: 190, minW: 300, maxW: 560, maxH: 330, bg: '#07060d', step: 1 / 120, input: Input.DEFAULT, loop: !this.headless }, o);
    this._abort = typeof AbortController === 'function' ? new AbortController() : null;   // dispose() removes every listener through it
    const signal = this._abort ? this._abort.signal : undefined;
    this.screen = new Screen(this.o.canvas, this.o, signal);
    this.input = new Input(this.screen, this.o.input, signal);
    this.view = this._view(this.o.view) || E.VIEWS.iso;
    this.views = this.o.views || null;   // views the game supports: nextView() cycles them
    this.time = 0; this.real = 0; this.hitstop = 0; this.timeScale = 1; this._shakeAmt = 0; this.reduceMotion = !this.headless && !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    // smooth = seconds of lag (0 = locked), bounds(view) = clamp rect, room = [w, h] screen-by-screen rooms, moving = sliding between rooms,
    // offset = [dx, dy] screen pixels from the screen's centre to where the focus sits ([0, -40] keeps it above on-screen buttons)
    this.cam = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, tz: 0, smooth: .18, bounds: null, snap: true, room: null, moving: false, offset: null };
    this.particles = new Particles(this); this.r = this.headless ? null : new Renderer(this); this.audio = new ChipAudio(this, signal);
    if (this.headless) this.audio.failed = 'a headless game has no sound';
    this.debug = null;   // a game's own handle for tools: game.debug = { snapshot() {...}, teleport(x, y, z) {...} }
    this.fps = 60; this.hz = 60; this.drawEvery = 1; this.paused = false; this.pauseOverlay = true; this._timers = []; this.errors = []; this._errKeys = new Set();   // drawEvery: 2 while a fast display outruns the frames
    this.fadeTime = .22; this._fade = null; this.scenes = null; this.scene = null; this.sceneName = null; this._next = null;
    this.stats = { updateMs: 0, renderMs: 0, frameMs: 16.7, steps: 0, items: 0, actors: 0, culled: 0 };
    this.alpha = .5; this._acc = this.o.step / 2;   // the step left over (0..1); starting half a step in keeps a steady step count
    // the player's choices (game.settings.volume; set(key, v) checks, saves, applies), full screen, why the game paused
    this.settings = new Settings(this, (this.o.menu && this.o.menu.settings) || []); this.fullscreen = new FullScreen(this); this.pauseReason = null;
    this.booted = Promise.resolve(this); this.bootError = null;   // the boot (9c): a promise of the game once started; the error a boot step failed with
    if (!this.headless) this._standard(signal);
    E.current = this;
  }
  static _makeCanvas() {
    const c = document.createElement('canvas'); c.id = 'screen';
    c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block;image-rendering:pixelated;background:#000;touch-action:none';
    document.body.style.margin = '0'; document.body.appendChild(c); return c;
  }
  get W() { return this.screen.W; }
  get H() { return this.screen.H; }
  /** true while the game's screen is upright, taller than 1.3 times its width (a phone held upright, with expand: true) */
  get upright() { return this.H > this.W * 1.3; }
  _view(v) {
    if (v instanceof View) return v;
    const w = E.VIEWS[v];
    if (!w) warn('view:' + v, 'unknown view "' + v + '". Use one of: ' + Object.keys(E.VIEWS).join(', ') + ', or a new E.View(...)');
    return w || null;
  }
  setView(v) { const w = this._view(v); if (w) { this.view = w; this.cam.snap = true; } }
  nextView(dir = 1) { const list = this.views || E.VIEW_ORDER, i = list.indexOf(this.view.id); this.setView(list[((i + dir) % list.length + list.length) % list.length]); }
  note(text, seconds = 1.2) { this._note = { text: String(text), end: this.real + seconds }; }
  // pause, saying why ('player' | 'focus' | 'controller' | 'menu': pauseReason); resume() takes it out of pause
  pause(reason = 'player') { if (this.paused) return false; this.paused = true; this.pauseReason = reason; return true; }
  resume() { this.paused = false; this.pauseReason = null; }
  _autoPause(reason) { return this.o.autoPause !== false && !!this.scene && !!this.scene.pausable && this.pause(reason); }
  // the corner's menu button: pauses (or resumes) a scene in play. The settings menu is the full engine's (E.Shell)
  menu() {
    const s = this.scene; if (!s || !(s.pausable || this.sceneName === 'main')) { warn('menu', "game.menu(): the settings menu is the full engine's (dist/my-3d2dge.js); here it pauses a scene in play"); return false; }
    if (this.paused) this.resume(); else this.pause('player'); return false;
  }
  _standard(signal) {   // the page set up for phones, pausing when hidden, the full-screen choice kept, a phone's first tap going full screen, the corner
    const on = (t, type, fn, o) => t.addEventListener(type, fn, Object.assign({ signal }, o)), fs = this.fullscreen;
    pageSetup(this.screen.canvas);
    on(window, 'blur', () => this._autoPause('focus'));
    on(document, 'visibilitychange', () => { if (document.hidden) this._autoPause('focus'); this.audio._background(document.hidden && !this.settings.background); });   // a hidden page sleeps its sound
    const fsChange = () => this.input.clear();   // (the player's choice is what they asked for: fullscreen.toggle() keeps it)
    on(document, 'fullscreenchange', fsChange); on(document, 'webkitfullscreenchange', fsChange);
    on(window, 'pointerup', e => {
      if (e.pointerType === 'mouse') return;
      if (!this._fsAuto && !(e.target && e.target.closest && e.target.closest('[data-sys="corner"]'))) this._fsAuto = this._autoFull();
      const s = this.scene; if (!this._guard && this.o.backGesture !== false && s && (s.pausable || this.sceneName === 'main') && window.top === window && history.pushState) try { history.pushState({ e3: 'back' }, ''); this._guard = true; } catch (err) { /* sandboxed */ }
    }, { capture: true });
    on(window, 'popstate', e => { if (!this._guard || (e.state && e.state.e3 === 'back')) return; this._guard = false; if (!this.back()) this.note('BACK AGAIN TO LEAVE', 1.5); });   // a phone's back pauses play first
    on(window, 'pointermove', e => { if (e.pointerType === 'mouse' && e.clientY < 80 && (e.movementX || e.movementY)) this._mouseTop = performance.now(); }, { passive: true });
    if (this.o.corner !== false && (this.o.menu !== false || this.o.fullscreen !== false)) this._corner = makeCorner(this);
  }
  _autoFull() {   // a phone's first tap, and a game started by a tap, go full screen unless the player turned it off
    const fs = this.fullscreen, o = this.o.fullscreen, ua = typeof navigator !== 'undefined' && navigator.userActivation;
    if (this.headless) return false; if (fs.on) return true;
    if ((o !== undefined && o !== 'tap') || this.settings.fullscreen === false || !fs.supported || fs.standalone || !(window.matchMedia && matchMedia('(pointer: coarse)').matches) || (ua && !ua.isActive)) return false;
    fs.enter(true); return true;
  }
  back() { const s = this.scene; if (!s || !(s.pausable || this.sceneName === 'main')) return false; if (this.paused) this.resume(); else this.pause('player'); return true; }   // (the full engine's: a menu screen first)
  _cornerSync() {   // shown while the game isn't being played (a title, a pause), after the mouse comes near the top, the menu always on a touch screen
    const c = this._corner; if (!c) return;
    const s = this.scene, fs = this.fullscreen, main = !!s && (!!s.pausable || this.sceneName === 'main'), play = main && !this.paused, near = performance.now() - (this._mouseTop || -1e9) < 2500;
    const touch = !!(this._coarse || (this._coarse = window.matchMedia && matchMedia('(pointer: coarse)')) || {}).matches;   // (the queries kept: this runs every frame)
    const showM = this.o.menu !== false && main && (!play || near || touch), showF = this.o.fullscreen !== false && fs.supported && !fs.standalone && (!play || near);
    const key = (showM ? 1 : 0) + (showF ? 2 : 0) + (fs.on ? 4 : 0);
    if (key === this._cornerKey) return; this._cornerKey = key;
    const [m, f] = c.children; c.style.display = showM || showF ? 'flex' : 'none'; m.style.display = showM ? 'grid' : 'none'; f.style.display = showF ? 'grid' : 'none';
    f.innerHTML = cornerIcon(fs.on ? CORNER_ICONS.exit : CORNER_ICONS.full); f.setAttribute('aria-label', fs.on ? 'Leave full screen' : 'Full screen'); f.title = f.getAttribute('aria-label');
  }
  shake(a) { if (!this.reduceMotion) this._shakeAmt = Math.min(10, this._shakeAmt + a * clamp(this.settings.shake, 0, 1)); }
  // a good hit in one call: hit-stop, shake, impact star, sparks, damage number, sound. o: { power: 1, angle, damage, color, textColor, textScale, textZ: 22, bounce, sound }
  hitFx(x, y, z, o = {}) {
    const p = o.power === undefined ? 1 : o.power, P = this.particles;
    this.freeze(.035 + .03 * p); this.shake(1.5 + 1.5 * p);
    P.impact(x, y, z, 5 + 3 * p, o.color || '#ffe070');
    P.sparks(x, y, z, Math.round(5 + 5 * p), o.angle === undefined ? null : o.angle, { color: o.color || '#ffb85c' });
    if (o.damage !== undefined) P.text(x + (Math.random() - .5) * 10, y, z + (o.textZ === undefined ? 22 : o.textZ), o.damage, o.textColor || '#fff2c4', { bounce: o.bounce !== false, scale: o.textScale || 1 });
    if (o.sound !== false) this.audio.sfx(o.sound || (p > 1.3 ? 'kick' : 'hit'));
    if (p >= 2) this.flash('#ffffff', .06);
  }
  flash(color = '#ffffff', seconds = .12, strength = 1) { if (this.reduceMotion) seconds *= .4; this._flash = { color, t: 0, dur: seconds, k: strength * clamp(this.settings.flashes, 0, 1) }; }
  freeze(s) { this.hitstop = Math.max(this.hitstop, s); }
  focus(x, y, z = 0) { this.cam.tx = x; this.cam.ty = y; this.cam.tz = z; }
  // keep the camera on an object: follow(hero, { z: 16, lead: 0 }); follow(null) stops
  follow(target, o = {}) { this._follow = target ? { target, z: o.z === undefined ? 16 : o.z, lead: o.lead || 0 } : null; this.cam.snap = true; }
  mouseGround() { const m = this.input.mouseScreen(); return m ? this.view.toGround(m[0], m[1]) : null; }
  after(seconds, fn) { const t = { at: this.time + seconds, fn, every: 0, dead: false }; this._timers.push(t); return { cancel() { t.dead = true; } }; }
  every(seconds, fn) { const t = { at: this.time + seconds, fn, every: Math.max(1e-3, seconds), dead: false }; this._timers.push(t); return { cancel() { t.dead = true; } }; }
  _camStep(dt) {
    const c = this.cam; let fx = c.tx, fy = c.ty, fz = c.tz;
    if (c.room) {
      const rw = Array.isArray(c.room) ? c.room[0] : c.room.w, rh = Array.isArray(c.room) ? c.room[1] : c.room.h;
      fx = (Math.floor(fx / rw) + .5) * rw;
      if (this.view.isSide) fz = (Math.floor(fz / rh) + .5) * rh; else fy = (Math.floor(fy / rh) + .5) * rh;
    }
    const [sx, sy] = this.view.p(fx, fy, fz), off = c.offset;
    let tx = sx - this.screen.W / 2 - (off ? off[0] : 0), ty = sy - this.screen.H / 2 - (off ? off[1] : 0);
    const b = c.bounds && c.bounds(this.view);
    if (b) {
      const W = this.screen.W, H = this.screen.H, bottom = (c.align || (this.view.pitchDeg < 40 ? 'bottom' : 'center')) === 'bottom';
      tx = b.x1 - b.x0 < W ? (b.x0 + b.x1 - W) / 2 : clamp(tx, b.x0, b.x1 - W);
      ty = b.y1 - b.y0 < H ? (bottom ? b.y1 - H : (b.y0 + b.y1 - H) / 2) : clamp(ty, b.y0, b.y1 - H);   // a short side-view level sits on the bottom edge
    }
    if (c.snap || !(c.smooth > 0)) { c.x = tx; c.y = ty; c.vx = c.vy = 0; c.snap = false; c.moving = false; return; }
    [c.x, c.vx] = smoothDamp(c.x, tx, c.vx, c.smooth, dt);
    [c.y, c.vy] = smoothDamp(c.y, ty, c.vy, c.smooth, dt);
    c.moving = Math.hypot(tx - c.x, ty - c.y) > 1.5;
  }
  // game.start({ update(dt), draw(r) }) or game.start({ scenes: { title: {...}, play: {...} }, scene: 'title' }); boot: { title, version,
  // steps: [[label, fn]], messages, min } runs the boot first (9c): the steps one a frame behind the boot screen
  start(hooks) {
    if (hooks && hooks.boot !== undefined && !this._booting) return this._boot(hooks);
    if (hooks !== undefined || !this._hooks) {   // start() with nothing resumes a stopped loop
      if (!hooks || typeof hooks !== 'object') throw new Error('game.start needs { update(dt), draw(r) } or { scenes: { name: { update, draw } }, scene: "name" }');
      this._hooks = hooks;
      if (hooks.scenes) { this.scenes = hooks.scenes; this._enter(hooks.scene || Object.keys(hooks.scenes)[0], hooks.data); }
      else {
        if (typeof hooks.update !== 'function' || typeof hooks.draw !== 'function') throw new Error('game.start({ update(dt), draw(r) }) needs both functions (or use { scenes, scene })');
        this.scene = hooks; this.sceneName = 'main';
      }
    }
    if (this._running || this.disposed || this.o.loop === false) return this;
    this._running = true;
    let last = performance.now(), acc = 0, n = 0, since = 0, per = 1 / 60, cost = 0, ri = 0, miss = 0, hold = 0, back = 3, full = 0, fresh = true, long = 0;
    const ring = [];
    const frame = now => {
      if (!this._running) return;
      this._raf = requestAnimationFrame(frame);   // scheduled first, so an error never stops the loop
      const raw = Math.max(0, (now - last) / 1000); last = now; since += raw;
      // the refresh: the shortest of the last 90 frames (late ones are longer). Drawn every other refresh, only gaps shorter
      // than one and a half are read (a GPU behind skips the refresh between: read, a 120 Hz screen would pass for 60); never
      // the first, timed from start() and not from a refresh (it read 5 ms on a 120 Hz screen: 200 Hz until 90 more)
      // and 90 long ones in a row, paced, mean the display slowed (a GPU behind lets the refresh between through some of the
      // time): read afresh
      if (raw > .004 && !fresh) {
        if (this.drawEvery === 1 || raw < per * 1.5) { long = 0; ring[ri++ % 90] = raw; per = Math.min(...ring); }
        else if (++long >= 90) { long = 0; ring.length = 0; ri = 1; ring[0] = per = raw; }
      }
      fresh = false;
      const t0 = performance.now(), steps = this._run(raw), t1 = performance.now();
      if (since >= (this.drawEvery - .5) * per) {   // drawn once drawEvery refreshes have passed (else a refresh left as it was: its updates have run)
        n++;
        try { this._frame(); } catch (e) { this._fail('draw', e); try { this.screen.present(); } catch (e2) { /* nothing to show */ } }
        const st = this.stats, t2 = performance.now(); st.updateMs = t1 - t0; st.renderMs = t2 - t1; st.frameMs = since * 1000; st.steps = steps;
        // a 90 Hz+ display the frames don't fit (their cost, or refreshes missed: the GPU behind): every other refresh, evenly
        cost += ((t2 - t0) / 1000 - cost) * .1;
        if (this.drawEvery === 1) miss += ((since > per * 1.5 ? 1 : 0) - miss) * .05;
        since = 0;
        let e = this.drawEvery;
        if (this.o.pace === false || per > 1 / 85) e = 1;
        else if (cost > per * .8) e = 2;
        else if (miss > .2) { if (now - full > 1e4) back = 3; e = 2; miss = 0; hold = now + back * 1000; back = Math.min(60, back * 2); }   // held 3 s, 6, 12... to 60 (3 again after 10 s at each)
        else if (cost < per * .55 && now >= hold) e = 1;
        if (e < this.drawEvery) full = now;
        this.drawEvery = e;
      }
      acc += raw; if (acc > .5) { this.fps = Math.round(n / acc); this.hz = Math.round(1 / per); acc = 0; n = 0; }   // real time: a slow device reads slow
    };
    this._raf = requestAnimationFrame(frame);
    return this;
  }
  /** run the boot (9c), then start: the system's checks on the screen, the game's steps one a frame (or all at
   *  once, headless or with loop: false), waiting for a step's promise, then the loop under the screen until it has drawn */
  _boot(hooks) {
    const o = hooks.boot || {}, h = Object.assign({}, hooks); delete h.boot;
    this._booting = true; this._bootOpt = o;
    const live = !this.headless && this.o.loop !== false && hooks.boot !== false && typeof document !== 'undefined';
    const steps = (Array.isArray(o.steps) ? o.steps : []).filter(Boolean).map(x => Array.isArray(x) ? x : [x.label || 'Getting ready', x.run]);
    if (hooks.boot === false) { BOOT.played = true; const el = typeof document !== 'undefined' && document.getElementById('e3-boot'); if (el) { el.hidden = true; el.style.display = 'none'; } BOOT.el = null; return this.start(h); }
    let res; this.booted = new Promise(r => { res = r; });
    if (live) { BOOT._open(this, o); BOOT._checks(this); }
    const now = () => typeof performance !== 'undefined' ? performance.now() : 0, t0 = now(), n = steps.length;   // (no clock in a bare Node context)
    let i = 0;
    const fail = (label, e) => { this._booting = false; this.bootError = e; this._fail('boot step "' + label + '"', e); BOOT.fail('boot step "' + label + '"', e); res(this); };
    const next = () => {
      if (this.disposed) return;
      while (i < n) {
        const [label, fn] = steps[i++], s0 = now();
        if (live) BOOT._step(i, n, label);
        let r; try { r = typeof fn === 'function' ? fn(this) : null; } catch (e) { fail(label, e); return; }
        const ok = () => { if (live) BOOT._line('  ' + (i + '. ').padEnd(4), label + ' · ' + Math.round(now() - s0) + ' ms'); };
        if (r && typeof r.then === 'function') { r.then(() => { ok(); live ? requestAnimationFrame(next) : next(); }, e => fail(label, e)); return; }
        ok(); if (live) { requestAnimationFrame(next); return; }   // one step a frame: the screen shows each
      }
      if (live && o.min && now() - t0 < o.min * 1000) { requestAnimationFrame(next); return; }
      if (live) BOOT._step(n + 1, n + 1, 'Warming up');
      this._booting = false; this.start(h); res(this);
    };
    next();
    return this;
  }
  // stop the loop (start() resumes it); dispose() ends the game for good: the loop, every listener the engine added, the sound
  stop() { this._running = false; if (this._raf != null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this._raf); this._raf = null; return this; }
  dispose() {
    this.stop(); this.disposed = true;
    if (this._abort) this._abort.abort();
    const A = this.audio; try { A.stopMusic(); if (A.ctx && A.ctx.close) A.ctx.close(); } catch (e) { /* already closed */ } A.ctx = null; A.failed = 'the game was disposed';
    if (this._corner) this._corner.remove(); this._corner = null;
    if (E.current === this) E.current = null;
  }
  // run `seconds` of real time in exact fixed steps at once, without requestAnimationFrame (tests, headless runs); o.draw: then draw a frame
  advance(seconds = this.o.step, o = {}) {
    if (!this.scene && !this._next) throw new Error('game.advance() needs a started game: game.start({ update, draw }) first');
    this._acc += Math.max(0, seconds);
    const n = this._steps(); this.stats.steps = n;
    if (o.draw && !this.headless) try { this._frame(); } catch (e) { this._fail('draw', e); }
    return n;
  }
  // the clock, an exact fixed step: real time (at most 50 ms a frame) fills an accumulator, each whole o.step (1/120 s)
  // of it runs one update of o.step * timeScale (split so no step is longer than o.step), the rest waits (game.alpha).
  // The same steps at 60, 90, 120 or 144 Hz; slow motion makes steps shorter, never fewer; paused, input still ticks
  _run(real) { this._acc += Math.min(.05, real); return this._steps(); }
  _steps() {
    const step = this.o.step; let n = 0;
    try {
      while (this._acc > step - 1e-9) {
        this._acc -= step;
        const k = this.timeScale > 1 ? Math.ceil(this.timeScale - 1e-9) : 1, h = step * Math.max(0, this.timeScale) / k;
        for (let i = 0; i < k; i++, n++) this._step(h);
      }
      if (!n && !this._stepped) { n++; this._step(0); }   // the first frame updates before it draws, even when its time is short
    } catch (e) { this._acc %= step; this._fail('update', e); }
    if (n) this._stepped = true;
    if (this._acc < 0) this._acc = 0;
    this.alpha = this._acc / step;
    return n;
  }
  // switch scene (fades through black unless o.fade is 0): game.go('play', { level: 2 })
  go(name, data, o = {}) {
    if (!this.scenes) { warn('go:noscenes', 'game.go() needs game.start({ scenes: {...}, scene }) first'); return; }
    if (!this.scenes[name]) { warn('go:' + name, 'game.go("' + name + '"): no such scene. Scenes: ' + Object.keys(this.scenes).join(', ')); return; }
    const fade = o.fade === undefined ? this.fadeTime : o.fade;
    if (fade > 0 && this.scene) this._fade = { t: 0, dur: fade, name, data, out: true };
    else { this._fade = null; this._next = { name, data }; }
  }
  _enter(name, data) {
    const s = this.scenes[name];
    if (!s) throw new Error('scene "' + name + '" does not exist. Scenes: ' + Object.keys(this.scenes).join(', '));
    if (this.scene && this.scene.exit) this.scene.exit();
    this.scene = s; this.sceneName = name; this.paused = false; this._timers.length = 0; this.hitstop = 0;
    this.particles.list.length = 0; this.cam.snap = true; this.audio._duck(false); this._follow = null;
    if (s.view) this.setView(s.view);
    if (s.views) this.views = s.views;
    if (s.input) this.input.use(s.input);
    if (s.res || s.expand !== undefined) this.screen.setOptions(Object.assign(s.res ? { res: s.res } : {}, s.expand !== undefined ? { expand: s.expand } : {}));
    if (s.pausable || name === 'main') this._fsAuto = this._autoFull();
    if (s.enter) s.enter(data);
  }
  _fail(where, e) {
    const msg = (e && e.message) || String(e), key = where + ':' + msg;
    if (!this._errKeys.has(key)) {
      this._errKeys.add(key); this.errors.push({ where, scene: this.sceneName, message: msg, stack: e && e.stack });
      console.error('my-3D2dge: error in ' + where + (this.sceneName ? ' (scene "' + this.sceneName + '")' : '') + ': ' + ((e && e.stack) || msg));
    }
    E.showError('error in ' + where + '()' + (this.sceneName && this.sceneName !== 'main' ? ' of scene "' + this.sceneName + '"' : ''), e);
  }
  _step(dt) {
    if (this._next) { const nx = this._next; this._next = null; this._enter(nx.name, nx.data); }
    this.real += dt; this._shakeAmt *= Math.exp(-dt * 9); this.input.tick(dt);
    if (this.input.padLost) { this._autoPause('controller'); this.note('CONTROLLER DISCONNECTED', 2.5); }
    if (this._flash) this._flash.t += dt / Math.max(.05, this.timeScale);   // real time: slow motion does not stretch a flash
    const f = this._fade;
    if (f) {   // the old scene freezes while it fades out
      f.t += dt;
      if (f.out) { if (f.t >= f.dur) { f.out = false; f.t = 0; this._enter(f.name, f.data); } return; }
      if (f.t >= f.dur) this._fade = null;
    }
    const s = this.scene;
    if (s && s.pausable && this.input.pressed('pause')) { this.paused = !this.paused; this.pauseReason = this.paused ? 'player' : null; this.audio.sfx('pause'); }
    if (!this.paused) this.pauseReason = null;
    this.audio._duck(this.paused);
    if (this.paused) return;
    if (this.hitstop > 0) { this.hitstop -= dt; return; }
    this.time += dt;
    const T = this._timers;
    if (T.length) {
      for (let i = 0; i < T.length; i++) { const t = T[i]; if (t.dead || this.time < t.at) continue; if (t.every) t.at += t.every; else t.dead = true; t.fn(); }
      prune(T, t => t.dead);
    }
    if (s && s.update) s.update(dt);
    const fo = this._follow;
    if (fo && fo.target) {
      const t = fo.target, sp = Math.hypot(t.vx || 0, t.vy || 0), dir = typeof t.facing === 'number' && Math.abs(t.facing) === 1 && !t.vy ? [t.facing, 0] : sp > 1 ? [(t.vx || 0) / sp, (t.vy || 0) / sp] : [0, 0];
      this.focus(t.x + dir[0] * fo.lead, (t.y || 0) + dir[1] * fo.lead, (t.z || 0) + fo.z);
    }
    this.particles.update(dt);
    this._camStep(dt);
  }
  _frame() {
    if (this._next) { const nx = this._next; this._next = null; this._enter(nx.name, nx.data); }
    const c = this.cam, s = this._shakeAmt, r = this.r;
    const shx = s > .05 ? (Math.sin(this.real * 83) + Math.sin(this.real * 57.3)) * .5 * s : 0, shy = s > .05 ? (Math.sin(this.real * 71) + Math.sin(this.real * 49.7)) * .5 * s : 0;
    r._begin(c.x + shx, c.y + shy);
    if (this.scene && this.scene.draw) this.scene.draw(r);
    const fill = (g, color, alpha, mode) => { g.save(); g.fillStyle = color; g.globalAlpha = alpha; if (mode) g.globalCompositeOperation = mode; g.fillRect(0, 0, r.bw, r.bh); g.restore(); g._c = null; };
    if (this._note && this.real < this._note.end) { const n = this._note; r.overlay(g => E.font.text(g, n.text, r.W / 2, 3, '#ffffff', { align: 'center', shadow: '#000', outline: false })); }
    this._cornerSync();
    if (this.paused && this.pauseOverlay) r.overlay(g => {
      fill(g, '#05030c', .55);
      E.font.text(g, 'PAUSED', r.W / 2, r.H / 2 - 8, '#ffffff', { align: 'center', scale: 2 });
      E.font.text(g, 'PRESS ESC OR START', r.W / 2, r.H / 2 + 8, '#c9c0e0', { align: 'center' });
    });
    const fx = this._flash;
    if (fx) { const a = (1 - fx.t / fx.dur) * (fx.k === undefined ? 1 : fx.k); if (a <= 0) this._flash = null; else r.overlay(g => fill(g, fx.color, qa(a * .75), 'lighter')); }
    const fd = this._fade, fl = fd ? clamp(fd.out ? fd.t / fd.dur : 1 - fd.t / fd.dur, 0, 1) : 0;
    if (fl > 0) r.overlay(g => fill(g, '#000000', Math.round(fl * 16) / 16));
    r._finish();
    if (!BOOT.played && !this._booting && (this._drawn = (this._drawn || 0) + 1) >= 2) BOOT._finish();   // play has begun: the boot screen goes
  }
}
E.Game = Game;

// ---- 9b. STANDARD FEATURES: the player's settings (saved, versioned, checked), full screen, pausing when the page is hidden, the corner's buttons, a page made for phones ----
const SETTINGS_VERSION = 2;   // 2: fullscreen false means turned off (version 1's also meant left by a gesture: forgotten)
// the standard settings by key: { group, label, type: 'toggle' | 'slider' | 'select', value (or a function of the game), min, max, options, apply(game, v) }
const STANDARD_SETTINGS = {
  fullscreen: { group: 'Display', label: 'Full screen', type: 'fullscreen', value: null },   // the player's choice: true, false (left it), null (never chose)
  scale: { group: 'Display', label: 'Pixel scaling', type: 'select', value: 'auto', options: [['auto', 'Auto'], ['sharp', 'Sharp'], ['fill', 'Fill']], apply: (g, v) => g.screen.setScale(v) },
  sound: { group: 'Sound', label: 'Sound', type: 'toggle', value: true, apply: (g, v) => g.audio.mute(!v) },
  volume: { group: 'Sound', label: 'Volume', type: 'slider', value: .7, apply: (g, v) => g.audio.setVolume(v) },
  music: { group: 'Sound', label: 'Music', type: 'slider', value: .5, apply: (g, v) => { g.audio.musicVolume = v; g.audio._levels(); } },
  effects: { group: 'Sound', label: 'Effects', type: 'slider', value: 1, apply: (g, v) => { g.audio.sfxVolume = v; g.audio._levels(); } },
  background: { group: 'Sound', label: 'Sound in the background', type: 'toggle', value: false },
  motion: { group: 'Comfort', label: 'Reduce motion', type: 'toggle', value: g => !!g.reduceMotion, apply: (g, v) => { g.reduceMotion = !!v; } },
  shake: { group: 'Comfort', label: 'Screen shake', type: 'slider', value: 1 },
  flashes: { group: 'Comfort', label: 'Screen flashes', type: 'slider', value: 1 },
  deadzone: { group: 'Controller', label: 'Stick dead zone', type: 'slider', value: .18, min: .05, max: .5, apply: (g, v) => { g.input.deadzone = v; } },
  glyphs: { group: 'Controller', label: 'Button symbols', type: 'select', value: 'auto', options: [['auto', 'Auto'], ['xbox', 'Xbox'], ['playstation', 'PlayStation'], ['nintendo', 'Nintendo'], ['generic', 'Positions']], apply: (g, v) => { g.input.glyphs = v; } }
};
function settingValue(sp, v) {   // a value checked against its setting: the value kept, or undefined
  if (sp.type === 'toggle') return typeof v === 'boolean' ? v : undefined;
  if (sp.type === 'fullscreen') return v === true || v === false || v === null ? v : undefined;
  if (sp.type === 'slider') return typeof v === 'number' && isFinite(v) ? clamp(v, sp.min === undefined ? 0 : sp.min, sp.max === undefined ? 1 : sp.max) : undefined;
  if (sp.type === 'select') return (sp.options || []).some(o => (Array.isArray(o) ? o[0] : o) === v) ? v : undefined;
  return v === undefined || typeof v === 'function' ? undefined : v;
}
// game.settings: one property per setting (game.settings.volume); set(key, v) checks, saves (E.store 'settings:' + id) and applies it
class Settings {
  constructor(game, own = []) {
    const hide = (k, v) => Object.defineProperty(this, k, { value: v, writable: true });
    hide('_g', game); hide('_specs', {}); hide('_saved', {}); hide('_key', 'settings:' + (game.o.id || (typeof location !== 'undefined' && location.pathname) || 'game')); hide('saved', true); hide('onChange', null);
    const raw = store.get(this._key, null); hide('_raw', raw && typeof raw === 'object' && raw.values && typeof raw.values === 'object' ? raw.values : {});
    if (!(raw && raw.v >= 2) && this._raw.fullscreen === false) delete this._raw.fullscreen;
    for (const k in STANDARD_SETTINGS) this.define(Object.assign({ key: k }, STANDARD_SETTINGS[k]));
    for (const sp of own) this.define(sp);
  }
  // add a setting { key, label, type, value, min, max, step, options, group: 'Game', apply(game, v) }: its saved value loads and applies
  define(sp) {
    if (!sp || !sp.key || typeof sp.key !== 'string' || sp.key in Settings.prototype || sp.key === 'saved' || sp.key === 'onChange' || sp.key[0] === '_') { warn('setting:' + (sp && sp.key), 'a setting needs a key of its own: { key: "hints", label: "Hints", value: true }'); return undefined; }
    const s = Object.assign({ group: 'Game', type: sp.options ? 'select' : typeof sp.value === 'number' ? 'slider' : typeof sp.value === 'boolean' || sp.value === undefined ? 'toggle' : 'value' }, sp);
    this._specs[s.key] = s;
    const saved = settingValue(s, this._raw[s.key]); if (saved !== undefined) this._saved[s.key] = saved;
    this[s.key] = saved !== undefined ? saved : this.default(s.key); this._apply(s.key);
    return this[s.key];
  }
  default(key) { const s = this._specs[key]; if (!s) return undefined; const v = typeof s.value === 'function' ? s.value(this._g) : s.value; return v === undefined && s.type === 'toggle' ? false : v; }
  spec(key) { return this._specs[key]; }
  keys(group) { return Object.keys(this._specs).filter(k => !group || this._specs[k].group === group); }
  set(key, v) {
    const s = this._specs[key]; if (!s) { warn('setting:' + key, 'unknown setting "' + key + '". Settings: ' + this.keys().join(', ')); return undefined; }
    const ok = settingValue(s, v); if (ok === undefined) return this[key];
    this[key] = ok; this._saved[key] = ok; this._save(); this._apply(key);
    if (this.onChange) this.onChange(key, ok);
    return ok;
  }
  reset(group) { for (const k of this.keys(group)) { if (k === 'fullscreen') continue; delete this._saved[k]; this[k] = this.default(k); this._apply(k); } this._save(); }
  _apply(key) { const s = this._specs[key]; if (s && s.apply) try { s.apply(this._g, this[key]); } catch (e) { this._g._fail('setting "' + key + '"', e); } }
  _save() { if (this._g.headless) return; this.saved = store.set(this._key, { v: SETTINGS_VERSION, values: this._saved }); if (!this.saved) warn('settings:save', 'the settings could not be saved (storage is blocked or full): they last for this visit'); }
}
// game.fullscreen: the whole page full screen where the browser can (supported, on, standalone; enter, exit, toggle from a tap, click or key)
class FullScreen {
  constructor(game) { this._game = game; this.failed = null; }
  get supported() { if (this._game.headless) return false; const d = document, el = d.documentElement; return !!((d.fullscreenEnabled || d.webkitFullscreenEnabled) && (el.requestFullscreen || el.webkitRequestFullscreen)); }
  get on() { return !this._game.headless && !!(document.fullscreenElement || document.webkitFullscreenElement); }
  get standalone() { const Q = this._mq || (this._mq = {}), m = q => !!(window.matchMedia && (Q[q] || (Q[q] = matchMedia(q))).matches); return !this._game.headless && (m('(display-mode: standalone)') || (m('(display-mode: fullscreen)') && !this.on) || navigator.standalone === true); }
  enter(quiet) {
    if (this.on || !this.supported) return Promise.resolve(this.on);
    const el = document.documentElement, f = el.requestFullscreen || el.webkitRequestFullscreen, no = e => { this.failed = (e && e.message) || 'refused'; if (!quiet) this._game.note('FULL SCREEN NOT ALLOWED HERE', 2); return false; };
    try { const p = f.call(el, { navigationUI: 'hide' }); this.failed = null; return p && p.then ? p.then(() => true, no) : Promise.resolve(true); } catch (e) { return Promise.resolve(no(e)); }
  }
  exit() { if (!this.on) return Promise.resolve(false); const f = document.exitFullscreen || document.webkitExitFullscreen; try { const p = f && f.call(document); return p && p.then ? p.then(() => true, () => false) : Promise.resolve(true); } catch (e) { return Promise.resolve(false); } }
  toggle() { const on = this.on; if (!this._game.headless) this._game.settings.set('fullscreen', !on); return on ? this.exit() : this.enter(); }   // the player's choice, kept
}
const CORNER_ICONS = { menu: 'M4 7h16M4 12h16M4 17h16', full: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5', exit: 'M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5' };
const cornerIcon = d => '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>';
function makeCorner(game) {   // the menu and full-screen buttons, 44 px, top right inside the safe area
  const box = document.createElement('div'); box.id = 'e3-corner'; box.dataset.sys = 'corner';
  box.style.cssText = 'position:fixed;top:calc(8px + env(safe-area-inset-top,0px));right:calc(8px + env(safe-area-inset-right,0px));z-index:21;display:none;gap:8px';
  const btn = (label, fn) => {
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', label); b.title = label;
    b.style.cssText = 'width:44px;height:44px;display:none;place-items:center;padding:0;margin:0;border-radius:10px;border:1px solid rgba(255,255,255,.3);background:rgba(8,8,18,.6);color:#f4f0ff;cursor:pointer;touch-action:manipulation';
    b.addEventListener('click', e => { e.stopPropagation(); b.blur(); fn(); }); box.appendChild(b); return b;
  };
  btn('Menu', () => game.menu()).innerHTML = cornerIcon(CORNER_ICONS.menu);
  btn('Full screen', () => game.fullscreen.toggle());
  document.body.appendChild(box); return box;
}
let _paged = false;
function pageSetup(canvas) {   // no page gestures, selection or callouts on the canvas; a viewport that reaches the safe areas (once)
  const st = canvas && canvas.style;
  if (st) { st.touchAction = 'none'; st.userSelect = 'none'; st.webkitUserSelect = 'none'; st.webkitTouchCallout = 'none'; st.webkitTapHighlightColor = 'transparent'; }
  if (_paged || !document.head) return; _paged = true;
  for (const el of [document.documentElement, document.body]) if (el) el.style.overscrollBehavior = 'none';   // no pull to refresh or swipe off the page
  const meta = (name, content) => { let m = document.querySelector('meta[name="' + name + '"]'); if (!m) { m = document.createElement('meta'); m.name = name; m.content = content; document.head.appendChild(m); } return m; };
  const vp = meta('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover'); if (!/viewport-fit/.test(vp.content)) vp.content += ', viewport-fit=cover';
  meta('mobile-web-app-capable', 'yes'); meta('apple-mobile-web-app-capable', 'yes');
}

// ---- 9c. BOOT: the system checked, the game's boot steps one a frame behind a boot screen (its progress and lines), a warm-up frame;
//      a failure before play becomes a report to screenshot (E.diagnose() gives it any time). E.bootSplash(title) first in <body> shows it from the first paint ----
/** the engine's own lines for the boot screen, when a game gives none (boot.messages) */
const BOOT_MESSAGES = ['Reticulating splines', 'Snapping every pixel to the grid', 'Teaching skeletons to walk', 'Counting to 120, every second',
  'Dithering the shadows', 'Untangling the capes', 'Warming up the chip synth', 'Sorting the world by depth', 'Lighting the torches',
  'Bribing the camera', 'Seeding the random numbers', 'Bending knees the inverse way', 'Polishing the parallax', 'Folding the pixels into 3D'];
const BOOT_CSS = `#e3-boot{position:fixed;inset:0;z-index:40;display:flex;flex-direction:column;justify-content:space-between;gap:14px;background:#05040a;color:#a9a1c8;
font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;padding:max(16px,env(safe-area-inset-top)) max(20px,env(safe-area-inset-right)) max(20px,env(safe-area-inset-bottom)) max(20px,env(safe-area-inset-left));transition:opacity .3s;overflow:auto}
#e3-boot.out{opacity:0;pointer-events:none}#e3-boot b{color:#f4f0ff;font-size:16px;letter-spacing:.08em}#e3-boot .ok{color:#8fd49a}#e3-boot .no{color:#e8a06a}
#e3-boot pre{margin:0;font:inherit;white-space:pre-wrap;word-break:break-word}#e3-boot .e3-bar{display:block;height:4px;max-width:440px;background:#ffffff14;margin:6px 0 4px;overflow:hidden}
#e3-boot .e3-bar i{display:block;height:100%;background:var(--e3-accent,#d9b77c);transition:width .2s}#e3-boot .e3-quip{color:var(--e3-accent,#d9b77c);font-style:italic}
#e3-boot[data-failed]{justify-content:flex-start;color:#e8dcd6}#e3-boot[data-failed] b{color:#ff8a7a}#e3-boot .e3-err{color:#ffd6d0;border-left:3px solid #ff5a5a;padding-left:10px;margin:8px 0}
#e3-boot button{font:600 13px system-ui,sans-serif;min-height:44px;padding:8px 16px;margin:10px 8px 0 0;border-radius:6px;border:1px solid #ffffff40;background:#ffffff14;color:#fff;cursor:pointer}
@media (prefers-reduced-motion:reduce){#e3-boot,#e3-boot .e3-bar i{transition:none}}`;
const bootEsc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
/** the boot screen's markup, for the very start of a page's <body>: it shows from the first paint, its bar moving while
 *  the page's scripts load (a pure CSS animation), and says so if the game's script never runs. The engine takes it over */
E.bootSplash = (title = '') => '<div id="e3-boot" role="status" style="position:fixed;inset:0;z-index:40;display:flex;flex-direction:column;justify-content:flex-end;gap:6px;padding:20px;background:#05040a;color:#a9a1c8;font:12px/1.5 ui-monospace,Menlo,Consolas,monospace">'
  + '<style>@keyframes e3-run{from{transform:translateX(-100%)}to{transform:translateX(340%)}}@keyframes e3-late{to{opacity:1}}</style>'
  + (title ? '<b style="color:#f4f0ff;font-size:16px;letter-spacing:.08em">' + bootEsc(title) + '</b>' : '') + '<span>Starting · my-3D2dge v' + E.version + '</span>'
  + '<span style="display:block;height:4px;max-width:440px;overflow:hidden;background:#ffffff14"><span style="display:block;width:30%;height:100%;background:#d9b77c;animation:e3-run 1.2s ease-in-out infinite"></span></span>'
  + '<span style="opacity:0;animation:e3-late .3s 12s forwards">Still starting. If this stays, the game\'s script did not run: reload, or open the browser\'s console.</span></div>';
/** a short name for the browser and system from the user agent: 'Chrome 141 · Android 15' */
const uaName = ua => {
  const m = re => (ua.match(re) || [])[1] || '';
  const b = /Edg\//.test(ua) ? 'Edge ' + m(/Edg\/(\d+)/) : /OPR\//.test(ua) ? 'Opera ' + m(/OPR\/(\d+)/) : /Firefox\//.test(ua) ? 'Firefox ' + m(/Firefox\/(\d+)/)
    : /CriOS\//.test(ua) ? 'Chrome ' + m(/CriOS\/(\d+)/) : /Chrome\//.test(ua) ? 'Chrome ' + m(/Chrome\/(\d+)/) : /Version\/\d+.*Safari/.test(ua) ? 'Safari ' + m(/Version\/(\d+)/) : 'a browser';
  const os = /Android/.test(ua) ? 'Android ' + m(/Android (\d+)/) : /iPhone|iPad|iPod/.test(ua) ? (/iPad/.test(ua) ? 'iPadOS ' : 'iOS ') + m(/OS (\d+)_/) : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X/.test(ua) ? 'macOS' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : '';
  return (b + (os ? ' · ' + os : '')).trim();
};
/**
 * the report a bug needs, at any time (and on the boot screen when a game can't start): { engine, game, time, page,
 * browser, device, screen, canvas, gpu, sound, storage, input, scene, errors, text (all of it, one line each, for a
 * screenshot or a bug report), short (one line) }. game: the game to report on (E.current)
 */
E.diagnose = (game = E.current) => {
  const W = typeof window !== 'undefined' ? window : null, N = typeof navigator !== 'undefined' ? navigator : {}, g = game, o = (g && g._bootOpt) || {};
  const mm = q => !!(W && W.matchMedia && W.matchMedia(q).matches), pads = (() => { try { return Array.from(N.getGamepads ? N.getGamepads() : []).filter(Boolean); } catch (e) { return []; } })();
  let storage = 'none'; try { if (typeof localStorage !== 'undefined') { localStorage.setItem('my3d2dge:probe', '1'); localStorage.removeItem('my3d2dge:probe'); storage = g && g.settings && !g.settings.saved ? 'full or blocked' : 'OK'; } } catch (e) { storage = 'blocked: settings last this visit'; }
  const sc = g && g.screen, A = g && g.audio, G = g && g.gpu;
  const d = {
    engine: 'my-3D2dge v' + E.version + (E.edition === 'agent' ? ' (agent edition)' : '') + ' · ' + E.build,
    game: ((o.title || (typeof document !== 'undefined' && document.title) || 'a game') + (o.version ? ' ' + o.version : '')).trim(),
    time: new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC',
    page: typeof location !== 'undefined' ? (location.pathname + location.search + location.hash).slice(-90) : 'none (no page)',
    browser: N.userAgent ? uaName(N.userAgent) : 'none (Node)',
    device: [N.hardwareConcurrency && N.hardwareConcurrency + ' cores', N.deviceMemory && N.deviceMemory + ' GB', mm('(pointer: coarse)') ? 'touch' : W ? 'mouse' : ''].filter(Boolean).join(' · ') || 'unknown',
    screen: W ? W.innerWidth + 'x' + W.innerHeight + ' @' + Math.round((W.devicePixelRatio || 1) * 100) / 100 + 'x' + (g && g.fullscreen && g.fullscreen.on ? ' · full screen' : '') : 'none',
    canvas: !g ? 'no game yet' : g.headless ? 'none (headless)' : sc._sctx ? sc.W + 'x' + sc.H + ' at ' + Math.round(sc.S * 100) / 100 + 'x (' + sc.scale + ')' : 'FAILED: no 2D drawing on this canvas',
    gpu: G ? 'WebGPU lighting ' + G.status() + (G.failed ? ': ' + G.failed : '') : N.gpu ? 'WebGPU available, not used' : 'canvas only (no WebGPU)',
    sound: !A ? 'no game yet' : A.failed ? 'off: ' + A.failed : A.ready ? 'on' : 'waits for a tap or key',
    storage,
    input: g ? g.input.lastDevice + (pads.length ? ' · controller: ' + String(pads[0].id).replace(/\s*\(.*$/, '').slice(0, 40) : ' · no controller') : 'no game yet',
    scene: g ? (g.sceneName || 'not started') + ' · ' + Math.round(g.real * 10) / 10 + ' s · ' + g.fps + ' fps' + (g.paused ? ' · paused' : '') : 'no game yet',
    errors: g ? g.errors.length : 0
  };
  const rows = [['Engine', d.engine], ['Game', d.game], ['Time', d.time], ['Page', d.page], ['Browser', d.browser], ['Device', d.device], ['Screen', d.screen],
    ['Canvas', d.canvas], ['GPU', d.gpu], ['Sound', d.sound], ['Storage', d.storage], ['Input', d.input], ['Scene', d.scene]];
  d.text = rows.map(([k, v]) => (k + '          ').slice(0, 9) + v).join('\n');
  d.short = 'v' + E.version + ' · ' + E.build + ' · ' + d.browser + ' · ' + d.screen + ' · ' + d.scene;
  return d;
};
Object.assign(BOOT, {
  /** the screen: the page's splash taken over, or a new one */
  _open(game, o) {
    if (typeof document === 'undefined' || !document.body) return null;
    if (!document.getElementById('e3-boot-css')) { const st = document.createElement('style'); st.id = 'e3-boot-css'; st.textContent = BOOT_CSS; document.head.appendChild(st); }
    let el = document.getElementById('e3-boot');
    if (!el) { el = document.createElement('div'); el.id = 'e3-boot'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.removeAttribute('style'); el.classList.remove('out'); el.removeAttribute('data-failed'); el.hidden = false; if (o && o.accent) el.style.setProperty('--e3-accent', o.accent);
    const title = (o && o.title) || document.title || '';
    el.innerHTML = '<pre class="e3-sys"></pre><div><b></b><div class="e3-step">Starting</div><span class="e3-bar"><i style="width:4%"></i></span><div class="e3-quip"></div></div>';
    el.querySelector('b').textContent = title;
    this.el = el; this.game = game; this.lines = []; this.played = false;
    const msgs = o && o.messages === false ? [] : (o && o.messages) || BOOT_MESSAGES, pick = rng((Date.now() >>> 0) || 1), q = el.querySelector('.e3-quip');   // (its own random numbers: never the game's)
    const quip = () => { if (msgs.length && this.el === el) q.textContent = msgs[Math.floor(pick() * msgs.length)] + '…'; };
    quip(); clearInterval(this._quip); this._quip = setInterval(quip, 1400);
    if (o && o.checks === false) el.querySelector('.e3-sys').hidden = true;
    return el;
  },
  /** a line of the system's check: 'Canvas    320x240 at 3x (sharp)' */
  _line(label, value, ok = true) {
    const t = (label + '          ').slice(0, 9) + value; this.lines.push(t); if (!this.el) return;
    const s = this.el.querySelector('.e3-sys'); if (!s) return;
    const row = document.createElement('div'); row.textContent = t; if (!ok) row.className = 'no'; s.appendChild(row);
  },
  /** the system's lines, from E.diagnose */
  _checks(game) {
    const d = E.diagnose(game);
    this._line('Engine', d.engine); this._line('System', d.browser + (d.device ? ' · ' + d.device : '')); this._line('Screen', d.screen);
    this._line('Canvas', d.canvas, !/FAILED/.test(d.canvas)); this._line('GPU', d.gpu); this._line('Sound', d.sound, !/^off/.test(d.sound));
    this._line('Storage', d.storage, d.storage === 'OK'); this._line('Input', d.input.replace(/^\w+ · /, ''));
  },
  /** step k of n is under way */
  _step(k, n, label) {
    if (!this.el) return;
    this.el.querySelector('.e3-step').textContent = label + (n > 1 ? '  ·  ' + k + ' / ' + n : '');
    this.el.querySelector('.e3-bar i').style.width = Math.round(4 + 92 * (k - 1) / Math.max(1, n)) + '%';
  },
  /** play has started (the game drew under the screen): take the screen away */
  _finish() {
    this.played = true; clearInterval(this._quip); const el = this.el; this.el = null;
    if (!el || el.hasAttribute('data-failed')) return;
    el.querySelector('.e3-bar i') && (el.querySelector('.e3-bar i').style.width = '100%');
    const reduce = this.game && this.game.reduceMotion;
    const gone = () => { el.hidden = true; el.style.display = 'none'; el.textContent = ''; };   // hidden, never removed: a recorded session finds the page's elements where they were
    if (reduce) gone(); else { el.classList.add('out'); setTimeout(gone, 400); }
  },
  /** something failed before play: the screen becomes the report (what failed, the error, the system), with Try again,
   *  Copy report and Continue */
  fail(title, e) {
    if (typeof document === 'undefined' || !document.body) return;
    const el = this.el || this._open(this.game || E.current, this.game && this.game._bootOpt);
    if (!el) return;
    this.failed = true; clearInterval(this._quip);
    const msg = (e && e.message) || String(e), stack = e && e.stack ? String(e.stack).split('\n').filter(l => /\d:\d/.test(l)).slice(0, 3).map(l => l.trim().replace(/^at /, '')) : [];
    const d = E.diagnose(this.game || E.current), code = 'E3-' + (hashStr(msg + (stack[0] || '')) >>> 0).toString(16).slice(0, 6).toUpperCase();
    const report = d.game + ' could not start\nWhat failed: ' + title + '\nError: ' + msg + (stack.length ? '\n  ' + stack.join('\n  ') : '') + '\nCode: ' + code + '\n\n' + d.text;
    el.setAttribute('data-failed', ''); el.setAttribute('role', 'alert'); el.classList.remove('out');
    el.innerHTML = '<div><b></b><div class="e3-err"></div><pre class="e3-rep"></pre><div class="e3-act"></div></div>';
    el.querySelector('b').textContent = d.game + ' could not start';
    el.querySelector('.e3-err').textContent = title + '\n' + msg; el.querySelector('.e3-err').style.whiteSpace = 'pre-wrap';
    el.querySelector('.e3-rep').textContent = (stack.length ? stack.join('\n') + '\n' : '') + 'Code     ' + code + '\n' + d.text;
    const act = el.querySelector('.e3-act'), btn = (t, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.onclick = fn; act.appendChild(b); return b; };
    btn('Try again', () => location.reload());
    const copy = btn('Copy report', () => { const done = () => { copy.textContent = 'Copied'; }; try { navigator.clipboard.writeText(report).then(done, () => { copy.textContent = 'Select the text to copy'; }); } catch (x) { copy.textContent = 'Select the text to copy'; } });
    btn('Continue', () => { this.played = true; el.hidden = true; el.style.display = 'none'; this.el = null; });
    this.report = report;
  }
});
/** a 32-bit hash of a string (the failure's short code) */
const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h; };
// a page whose splash is there when the engine runs: take it over at once (its title, the engine's version)
if (typeof document !== 'undefined' && document.getElementById && document.getElementById('e3-boot')) BOOT._open(null, null);

// ---- 10. HUMANOID: a 3D skeleton posed by math every step (IK legs and arms, gait, poses, attacks, cape cloth), drawn as shaded pixel art ----
//   local frame: f = forward, r = right, z = up. update(dt, state) then draw(g, ox, oy, view) inside r.actor
const HUMAN_COLORS = {
  skin: '#f1c7a0', hair: '#3b2a2f', cloth: '#2f8f86', pants: '#3b3552', boot: '#6a4128', belt: '#e0a84a',
  cape: '#c8452f', capeIn: '#7a2622', metal: '#dce8f1', hilt: '#e8b04e', eye: '#1a1320'
};
const JOINT_KEYS = ['hipL', 'hipR', 'kneeL', 'kneeR', 'footL', 'footR', 'hipC', 'shC', 'shL', 'shR', 'head', 'elbowL', 'elbowR', 'handL', 'handR'];
const BUILDS = {
  chibi: {},
  heroic: { legUpper: 7.4, legLower: 7.4, hipZ: 14.3, torso: 9.6, shoulderHalf: 3.5, headR: 3.05, neck: 1.5, armUpper: 5.5, armLower: 5.4, hipHalf: 1.8, stride: 7.8, speedRef: 80 },
  bulky: { legUpper: 6.4, legLower: 6.2, hipZ: 12.2, torso: 9.4, shoulderHalf: 4.6, headR: 3.2, neck: .9, armUpper: 5.2, armLower: 5.2, hipHalf: 2.4, limbW: 2.6, torsoW: 4.2, footSpread: 2.4, stride: 6.6, speedRef: 60 }
};
class Humanoid {
  constructor(o = {}) {
    if (o.build && !BUILDS[o.build]) warn('build:' + o.build, 'Humanoid build "' + o.build + '" is unknown (chibi, heroic, bulky)');
    o = Object.assign({}, BUILDS[o.build] || {}, o);
    this.o = Object.assign({
      legUpper: 6, legLower: 6, hipZ: 11.6, hipHalf: 1.9, footSpread: 1.9, torso: 8, shoulderHalf: 3.3, neck: 1.2, headR: 3.4,
      armUpper: 4.6, armLower: 4.6, limbW: 2, torsoW: 3, lean: 0, hunch: 0, stride: 6.5, lift: 3.4, swing: 4, speedRef: 70,
      weapon: 'sword', bladeLen: 11, cape: null, hood: false, eyeGlow: null, hat: null,
      size: 1, hair: 'short', outfit: 'shirt', sleeves: 'short', cheat: .5
    }, o);
    this._cheat = 0;
    if (typeof this.o.hair === 'string' || !this.o.hair) this.o.hair = { style: this.o.hair || 'short' };
    if (this.o.weapon && !['sword', 'gun', 'staff'].includes(this.o.weapon)) { warn('weapon:' + this.o.weapon, 'Humanoid weapon "' + this.o.weapon + '" is not built in (sword, gun, staff or null); drawing a sword'); this.o.weapon = 'sword'; }
    if (typeof this.o.hat === 'string') this.o.hat = { style: this.o.hat };
    this.C = Object.assign({}, HUMAN_COLORS, o.colors || {});
    const C = this.C;
    C.clothLt = C.clothLt || shade(C.cloth, .25);
    this.t = Math.random() * 10; this.phase = 0; this._spW = 0; this._mv = [1, 0]; this._dashW = 0; this.hurtW = 0; this._atkW = 0;
    this._theta = 1.2; this.atkZ = 10; this.reach = 7; this._twist = 0; this.spin = 0; this._atkLean = 0;
    this.sq = 0; this.sqV = 0; this.blink = 2; this.facing = 0; this.x = 0; this.y = 0; this.z = 0; this.J = {};
    this.capeL = null; this._airW = 0; this._pointW = 0; this._kicking = false;
    this._pose();
  }
  kick(v) { this.sqV += v; }
  hand(which = 'R') { const w = this._w(this.J['hand' + which] || this.J.handR); return [this.x + w[0], this.y + w[1], this.z + w[2]]; }
  tip() { const J = this.J, L = this.o.weapon === 'gun' ? 5 : this.o.weapon === 'staff' ? 10 : this.o.bladeLen, w = this._w(V3.add(J.handR, V3.mul(J.bladeDir, L))); return [this.x + w[0], this.y + w[1], this.z + w[2]]; }
  /** where a point in the rig's own frame ([forward, right, up]; a joint such as rig.J.head, or one offset from it)
   *  sits, in world units from the rig's feet: add rig.x, y, z for the world point, or project it to draw at a joint */
  worldOffset(p) { return this._w(p); }
  _w(p) {
    const a = this.facing + this.spin + this._cheat, c = Math.cos(a), s = Math.sin(a), sz = this.o.size, k = (1 - this.sq * .4) * sz;
    return [(p[0] * c - p[1] * s) * k, (p[0] * s + p[1] * c) * k, p[2] * (1 + this.sq) * sz];
  }
  update(dt, s = {}) {
    const o = this.o;
    if (this.t > 0 && Math.hypot((s.x || 0) - this.x, (s.y || 0) - this.y, (s.z || 0) - this.z) > 24 * o.size) this.capeL = null;
    this.t += dt; this.x = s.x; this.y = s.y; this.z = s.z || 0; this.facing = s.facing || 0;
    const speed = s.run ? s.run * o.speedRef : Math.hypot(s.vx || 0, s.vy || 0);
    this._spW = approach(this._spW, clamp(speed / o.speedRef, 0, 1.25), dt * 7);
    if (speed > 3 && !s.run) {
      const c = Math.cos(this.facing), sn = Math.sin(this.facing), k = Math.min(1, dt * 10);
      this._mv[0] = lerp(this._mv[0], (s.vx * c + s.vy * sn) / speed, k); this._mv[1] = lerp(this._mv[1], (-s.vx * sn + s.vy * c) / speed, k);
    }
    this.phase += dt * speed / (o.stride * o.size * Math.max(.4, Math.min(1, this._spW)));
    this._dashW = approach(this._dashW, s.dash ? 1 : 0, dt * (s.dash ? 24 : 8));
    this.hurtW = approach(this.hurtW, s.hurt ? 1 : 0, dt * 14);
    this._atkW = approach(this._atkW, s.attack ? 1 : 0, dt * (s.attack ? 30 : 7));
    this._airW = approach(this._airW, s.air ? 1 : 0, dt * (s.air ? 10 : 18));
    const pk = this.poseW || (this.poseW = { cheer: 0, cast: 0, guard: 0, kneel: 0, crouch: 0, wave: 0, hips: 0, block: 0 });
    for (const k in pk) pk[k] = approach(pk[k], s.pose === k ? 1 : 0, dt * 9);
    this._stW = approach(this._stW || 0, s.stance === 'guard' ? 1 : 0, dt * 10); this._rdW = approach(this._rdW || 0, s.stance === 'ready' ? 1 : 0, dt * 10);
    this._climbW = approach(this._climbW || 0, s.climb ? 1 : 0, dt * 12); if (s.climb) this._climbP = (this._climbP || 0) + dt * Math.abs(s.vz || 0) / (.4 * (o.armUpper + o.armLower) * o.size) * Math.PI;
    this.dieT = s.pose === 'die' ? (this.dieT || 0) + dt : 0;
    const dT = s.down !== undefined ? clamp(+s.down, 0, 1) : s.pose === 'down' || this.dieT > .45 ? 1 : 0;
    this.downW = approach(this.downW || 0, dT, dt * (dT > (this.downW || 0) ? 2.5 + 10 * (this.downW || 0) : 3.2));
    if (this.dieT > 0) { this.hurtW = approach(this.hurtW, this.dieT < .25 ? 1 : 0, dt * 14); pk.kneel = approach(pk.kneel, this.dieT > .2 && this.dieT < .6 ? 1 : 0, dt * 10); }
    this._pointW = approach(this._pointW, s.point ? 1 : 0, dt * (s.point ? 30 : 8));
    this._aimA = approach(this._aimA || 0, s.aim || 0, dt * 14);
    if (s.attack) this._kicking = !!s.attack.spec.kick;
    this.blink -= dt; if (this.blink < -.12) this.blink = 2 + Math.random() * 3;
    this.sqV += (-260 * this.sq - 15 * this.sqV) * dt; this.sq = clamp(this.sq + this.sqV * dt, -.3, .3);
    const A = s.attack; let tLean = 0, tTwist = 0, tLunge = 0, tHop = 0, tCrouch = 0, armT = A ? 1 : 0;
    this.spin = 0;
    this._sidePlane = !!A && !A.spec.kick && (A.spec.plane ? A.spec.plane === 'side' : o.swingPlane ? o.swingPlane === 'side' : this._pitch !== undefined && this._pitch < 15 && !!o.weapon && A.spec.blade !== 0 && A.spec.hand !== 'L');
    if (A) {
      const sp = A.spec, side = this._sidePlane, rest = side ? -.9 : 1.1, RS = sp.rel ? (o.armUpper + o.armLower) / 9.2 : 1, R = (sp.reach || 7.5) * RS, r0 = sp.r0 === undefined ? R : sp.r0 * RS, r1 = sp.r1 === undefined ? R : sp.r1 * RS;
      this._atkRel = !!sp.rel; const zRest = sp.rel ? (sp.kick ? .1 : -7) : 9, z0 = sp.z0 === undefined ? zRest : sp.z0, z1 = sp.z1 === undefined ? z0 : sp.z1;
      const hold = sp.hold === undefined ? .3 : sp.hold, lean = sp.lean === undefined ? (sp.kick ? -.22 : .3) : clamp(sp.lean, -.8, .8), lunge = sp.lunge === undefined ? (sp.kick ? .4 : 1.2) : clamp(sp.lunge, -4, 5);
      if (A.phase === 'wind' && (this._aPh !== 'wind' || this._aSp !== sp)) {
        const chain = (this._armW || 0) > .3 && this._theta !== undefined, fists = !o.weapon || sp.hand === 'L' || sp.blade === 0;
        this._th0 = chain ? this._theta : rest; this._z0 = chain && this._atkRel === !!sp.rel && isFinite(this.atkZ) ? this.atkZ : fists ? z0 : zRest; this._r0 = chain ? this.reach : R * .75;
        const J = this.J; if (J.handR) this._from = { R: J.handR.slice(), L: J.handL.slice(), bd: J.bladeDir.slice() };
      }
      this._aPh = A.phase; this._aSp = sp; this._atkHand = sp.hand || 'R'; if (A.phase !== 'wind') this._windK = 1;
      if (A.phase === 'wind') {
        const k = ease.outQuad(A.u);
        this._theta = lerp(this._th0, sp.a0, k); this.atkZ = lerp(this._z0, z0, A.u); this.reach = lerp(this._r0, r0, k); this._windK = k;
        tLean = -Math.abs(lean) * .45; tLunge = -lunge * .3 * k; tCrouch = clamp(sp.crouch === undefined ? (sp.kick ? 0 : .15) : sp.crouch, 0, 1) * k;
      } else if (A.phase === 'active') {
        const k = ease.outCubic(A.u);
        this._theta = sp.spin ? sp.a0 : lerp(sp.a0, sp.a1, k); this.atkZ = lerp(z0, z1, k); this.reach = lerp(r0, r1, k);
        tLean = lean; tLunge = lunge * k; tHop = clamp(sp.hop || 0, 0, 12) * Math.sin(k * Math.PI); tCrouch = clamp(sp.crouch === undefined ? (sp.kick ? 0 : .15) : sp.crouch, 0, 1) * (1 - k);
        if (sp.spin) { if (side) this._theta = sp.a0 - TAU * k; else this.spin = -TAU * k; }
      } else {
        const k = ease.outQuad(clamp(A.u / hold, 0, 1)), span = sp.spin ? 0 : sp.a1 - sp.a0;
        this._theta = (sp.spin ? sp.a0 : sp.a1) + span * .08 * k; this.atkZ = z1; this.reach = r1;
        armT = A.u < hold ? 1 : 1 - ease.inOut((A.u - hold) / (1 - hold));
        tLean = lean * armT; tLunge = lunge * armT;
      }
      tTwist = sp.spin ? 0 : clamp(this._theta * (side ? .08 : .32) * (sp.twist === undefined ? 1 : sp.twist) * (this._atkHand === 'L' ? -1 : 1), -.7, .7);
    } else { this._windK = 1; this._aPh = null; }
    this._armW = approach(this._armW || 0, armT, dt * (armT > (this._armW || 0) ? 30 : 12));
    this.lunge = lerp(this.lunge || 0, tLunge, Math.min(1, dt * 22)); this.hop = lerp(this.hop || 0, tHop, Math.min(1, dt * 25)); this._crouchA = lerp(this._crouchA || 0, tCrouch, Math.min(1, dt * 20));
    this._atkLean = lerp(this._atkLean, tLean, Math.min(1, dt * 25));
    this._twist = lerp(this._twist, tTwist, Math.min(1, dt * 25));
    this._pose();
    if (o.cape) this._cape(dt);
  }
  _pose() {
    const o = this.o, J = this.J, sp = Math.min(1, this._spW), mf = this._mv[0], mr = this._mv[1], ph = this.phase, dash = this._dashW, hurt = this.hurtW, rz = V3.rz, add = V3.add;
    const breathe = Math.sin(this.t * 2.3) * (1 - sp);
    const bob = (.5 - Math.abs(Math.cos(ph)) * 1.3) * sp;
    const PW = this.poseW || { cheer: 0, cast: 0, guard: 0, kneel: 0 }, kn = PW.kneel, lg = this.lunge || 0, cw = this._climbW || 0;
    const cr = Math.max(PW.crouch || 0, this._crouchA || 0, Math.sin(clamp(this.downW || 0, 0, 1) * Math.PI) * .85);
    const sway = Math.sin(this.t * 1.15) * .3 * (1 - sp) * (1 - this._atkW);
    const hipC = [mf * .4 * sp - .4 * hurt + lg * .55, mr * .3 * sp + sway, o.hipZ + bob + breathe * .3 - dash * 2.2 - hurt * .6 - kn * o.hipZ * .42 - PW.guard * .9 - cr * o.hipZ * .32 + (this.hop || 0)];
    J.hipL = add(hipC, rz([0, -o.hipHalf, 0], this._twist * .4)); J.hipR = add(hipC, rz([0, o.hipHalf, 0], this._twist * .4));
    for (const s of [-1, 1]) {
      const p = ph + (s > 0 ? Math.PI : 0), along = Math.sin(p) * o.stride * sp;
      let foot = [mf * along + (s > 0 ? .8 : -.6) * (1 - sp), s * o.footSpread + mr * along, Math.max(0, Math.cos(p)) * o.lift * sp];
      foot = V3.lerp(foot, [s > 0 ? 4 : -5, s * 2.2, s > 0 ? 1.5 : .3], dash);
      if (this._airW > 0) foot = V3.lerp(foot, [s > 0 ? 3.2 : -2.6, s * 1.9, s > 0 ? 6 : 3.6], this._airW);
      if (kn > 0) foot = V3.lerp(foot, [s > 0 ? 3.4 : -4.2, s * 2, s > 0 ? 0 : 0], kn);
      if (PW.guard > 0) foot = V3.lerp(foot, [s > 0 ? 2.6 : -2.8, s * 2.6, 0], PW.guard * (1 - sp));
      if (cr > 0) foot = V3.lerp(foot, [s > 0 ? 1.6 : -1.4, s * (o.footSpread + .7), foot[2] * (1 - cr)], cr * (1 - sp * .5));
      if (lg > 0) foot[0] += (s === (this._atkHand === 'L' ? 1 : -1) ? lg * 1.3 : -lg * .15) * (1 - sp);
      if (this.hop) foot[2] += this.hop;
      if (cw > 0) foot = V3.lerp(foot, [.6, s * 1.5, Math.max(0, Math.sin(this._climbP + (s > 0 ? Math.PI : 0))) * 3.4], cw);
      if (s > 0 && this._kicking && this._atkW > 0) foot = V3.lerp(foot, [Math.cos(this._theta) * (this.reach + 3), Math.sin(this._theta) * (this.reach + 3), (this._atkRel ? this.atkZ * o.hipZ : this.atkZ) + (this.hop || 0)], this._armW || 0);
      const hip = s > 0 ? J.hipR : J.hipL;
      const [knee, f2] = ik3(hip, foot, o.legUpper, o.legLower, [1, s * .15, .1]);
      J[s > 0 ? 'kneeR' : 'kneeL'] = knee; J[s > 0 ? 'footR' : 'footL'] = f2;
    }
    const leanF = o.lean + .16 * sp * mf + .45 * dash + this._atkLean - .35 * hurt + cr * .22, leanR = .1 * sp * mr;
    const dir = V3.norm([Math.sin(leanF), Math.sin(leanR), Math.cos(leanF)]);
    const shC = add(hipC, V3.mul(dir, o.torso));
    J.hipC = hipC; J.shC = shC;
    J.shL = add(shC, rz([0, -o.shoulderHalf, 0], this._twist)); J.shR = add(shC, rz([0, o.shoulderHalf, 0], this._twist));
    J.head = add(shC, V3.mul(V3.norm([dir[0] + o.hunch * .9, dir[1], dir[2]]), o.neck + o.headR));
    const armLen = o.armUpper + o.armLower, aw = this._armW || 0, sA = this._atkHand === 'L' ? -1 : 1, two = this._atkHand === 'both', fists = !o.weapon || this._stW > .5;
    const aT = this._sidePlane ? add(shC, [Math.cos(this._theta) * this.reach, sA * .8, Math.sin(this._theta) * this.reach]) : add(shC, [Math.cos(this._theta) * this.reach, Math.sin(this._theta) * this.reach, this._atkRel ? this.atkZ : this.atkZ - shC[2]]);
    const aDir = this._sidePlane ? V3.norm([Math.cos(this._theta), .05, Math.sin(this._theta)]) : V3.norm([Math.cos(this._theta), Math.sin(this._theta), -.12]);
    for (const s of [-1, 1]) {
      const sh = s > 0 ? J.shR : J.shL, q = ph + (s > 0 ? 0 : Math.PI), along = -Math.sin(q) * o.swing * sp;
      let hand = add(sh, [mf * along + .5 * (1 - sp) + o.hunch * 3, s * .9 + mr * along, -armLen * .86 + Math.abs(Math.sin(q)) * 1.2 * sp]);
      hand = V3.lerp(hand, add(sh, [-4.5, s * 1.6, -5]), dash);
      hand = V3.lerp(hand, add(sh, s > 0 ? [1.4, -.6, .6] : [-1.6, s * 2.2, -3.2]), hurt);
      if (this._airW > 0) hand = V3.lerp(hand, add(sh, [1.2, s * 2.6, -1.2]), this._airW * .7);
      if (s > 0 && this._pointW > 0) { const aa = this._aimA || 0; hand = V3.lerp(hand, add(sh, [armLen * .92 * Math.cos(aa), -.6, armLen * .92 * Math.sin(aa) - .4]), this._pointW); }
      if (PW.cheer > 0) hand = V3.lerp(hand, add(sh, [.6, s * 1.4, armLen * (.74 + .12 * Math.sin(this.t * 9 + (s > 0 ? 0 : .7)))]), PW.cheer);
      if (PW.cast > 0) hand = V3.lerp(hand, add(shC, [armLen * .82, s * 1.3, -1.2]), PW.cast);
      const guardAt = add(shC, s < 0 ? [3.8, -1, .4] : [2.3, 1.5, -.6]);
      if (PW.guard > 0) hand = V3.lerp(hand, guardAt, PW.guard);
      if (this._stW > 0) hand = V3.lerp(hand, guardAt, this._stW * (1 - dash));
      if (this._rdW > 0 && o.weapon) hand = V3.lerp(hand, s > 0 ? add(shC, [2.8, .9, -3]) : add(shC, [2.2, .2, -3.6]), this._rdW * (1 - dash));
      if (PW.wave > 0 && s === (o.weapon ? -1 : (this._camSide || 1))) { const w = Math.sin(this.t * 11); hand = V3.lerp(hand, add(sh, [.8 + w * 1.7, s * (2 + Math.max(0, w) * 1.4), armLen * .8]), PW.wave); }
      if (PW.hips > 0) hand = V3.lerp(hand, add(s > 0 ? J.hipR : J.hipL, [-.2, s * 1.5, 1.5]), PW.hips);
      if (PW.block > 0) hand = V3.lerp(hand, add(shC, s > 0 ? [2.6, .6, -2.4] : [2.4, -.2, -3.4]), PW.block);
      if (cw > 0) hand = V3.lerp(hand, add(sh, [1.7, s * .5, armLen * (.08 + .8 * (.5 + .5 * Math.sin(this._climbP + (s > 0 ? 0 : Math.PI))))]), cw);
      const wk = this._from && this._windK < 1 ? this._windK : 1, from = wk < 1 ? this._from[s > 0 ? 'R' : 'L'] : null;
      if (aw > 0 && !this._kicking) {
        if (s === sA) hand = V3.lerp(hand, from ? V3.lerp(from, aT, wk) : aT, aw);
        else if (two) hand = V3.lerp(hand, add(aT, V3.mul(aDir, -1.7)), aw);
        else { const offT = fists ? guardAt : add(shC, [1.6, s * 1.6, -1.6]); hand = V3.lerp(hand, from ? V3.lerp(from, offT, wk) : offT, from ? aw : aw * .85); }
      }
      if (this._kicking && aw > 0) hand = V3.lerp(hand, add(shC, [1.8, s * 2.2, .6 - (s > 0 ? 1.5 : 0)]), aw * .85);
      const [elbow, h2] = ik3(sh, hand, o.armUpper, o.armLower, [-1, s * .7, -.2]);
      J[s > 0 ? 'elbowR' : 'elbowL'] = elbow; J[s > 0 ? 'handR' : 'handL'] = h2;
    }
    const wp = o.weapon, rest = V3.norm(wp === 'staff' ? [.3, .15, 1] : wp === 'gun' ? [.8, 0, -.6] : [.55, .35, -.75]), atk = aDir;
    let bd = V3.lerp(rest, atk, this._kicking || sA < 0 ? 0 : aw);
    if (this._from && this._windK < 1 && !this._kicking && sA > 0) bd = V3.lerp(this._from.bd, bd, this._windK);
    if (PW.cheer > 0) bd = V3.lerp(bd, [.15, .05, 1], PW.cheer);
    if (PW.block > 0) bd = V3.lerp(bd, [.35, -.3, .9], PW.block);
    if (this._rdW > 0) bd = V3.lerp(bd, [.62, .08, .78], this._rdW * (1 - aw));
    if (this._pointW > 0) bd = V3.lerp(bd, [Math.cos(this._aimA || 0), 0, Math.sin(this._aimA || 0)], this._pointW);
    J.bladeDir = V3.norm(bd);
    const dw = this.downW || 0;
    if (dw > 0) J.bladeDir = V3.norm(V3.lerp(J.bladeDir, [0, .9, -.4], dw));
    if (dw > 0) {
      const a = dw * Math.PI / 2 * .96, ca = Math.cos(a), sa = Math.sin(a), lift = dw * 1.4, shift = dw * (o.hipZ + o.torso) * .5;
      for (const k in J) { if (k === 'bladeDir') continue; const p = J[k]; J[k] = [p[0] * ca - p[2] * sa + shift, p[1], p[0] * sa + p[2] * ca + lift]; }
      const b = J.bladeDir; J.bladeDir = [b[0] * ca - b[2] * sa, b[1], b[0] * sa + b[2] * ca];
    }
  }
  head() { const w = this._w(this.J.head); return [this.x + w[0], this.y + w[1], this.z + w[2]]; }
  _cape(dt) {
    const c = this.o.cape, sz = this.o.size, N = c.len || 6, seg = (c.seg || 2.4) * sz, W0 = (c.width || 5) * sz;
    const anchor = s => { const J = this.J, sh = s > 0 ? J.shR : J.shL, w = this._w(V3.add(sh, [-1.3, -s * .6, -.6])); return [this.x + w[0], this.y + w[1], this.z + w[2]]; };
    if (!this.capeL) {
      this.capeL = []; this.capeR = [];
      const bx = -Math.cos(this.facing) * (c.body || 3.4) * sz, by = -Math.sin(this.facing) * (c.body || 3.4) * sz;
      for (const s of [-1, 1]) { const a = anchor(s), ch = s < 0 ? this.capeL : this.capeR; for (let i = 0; i < N; i++) { const k = Math.min(1, i / 2); ch.push({ x: a[0] + bx * k, y: a[1] + by * k, z: a[2] - i * seg, px: a[0] + bx * k, py: a[1] + by * k, pz: a[2] - i * seg }); } }
    }
    const damp = Math.pow(.982, dt * 120), dt2 = dt * dt, fx = Math.cos(this.facing + this.spin), fy = Math.sin(this.facing + this.spin);   // trails behind the body's turn
    for (const [ch, s] of [[this.capeL, -1], [this.capeR, 1]]) {
      const a = anchor(s); Object.assign(ch[0], { x: a[0], y: a[1], z: a[2], px: a[0], py: a[1], pz: a[2] });
      for (let i = 1; i < N; i++) {
        const n = ch[i], vx = (n.x - n.px) * damp, vy = (n.y - n.py) * damp, vz = (n.z - n.pz) * damp;
        n.px = n.x; n.py = n.y; n.pz = n.z;
        const fl = Math.sin(this.t * 11 - i * .8 + s) * 40 * (i / N);
        n.x += vx - fx * 30 * dt2; n.y += vy - fy * 30 * dt2; n.z += vz + (-230 + fl) * dt2;
      }
    }
    const L = this.capeL, R = this.capeR, bodyR = (c.body || 3.4) * sz, shZ = this.z + this.J.shC[2] * sz;
    for (let it = 0; it < 4; it++) {
      for (const ch of [L, R]) for (let i = 1; i < N; i++) {
        const a = ch[i - 1], b = ch[i], dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz) || 1e-6, k = (d - seg) / d;
        if (i === 1) { b.x -= dx * k; b.y -= dy * k; b.z -= dz * k; } else { a.x += dx * k * .5; a.y += dy * k * .5; a.z += dz * k * .5; b.x -= dx * k * .5; b.y -= dy * k * .5; b.z -= dz * k * .5; }
      }
      for (let i = 1; i < N; i++) {
        const a = L[i], b = R[i], w = W0 * (1 + .25 * i / N), dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz) || 1e-6, k = (d - w) / d * .5;
        a.x += dx * k; a.y += dy * k; a.z += dz * k; b.x -= dx * k; b.y -= dy * k; b.z -= dz * k;
      }
      for (const ch of [L, R]) for (let i = 1; i < N; i++) {
        const n = ch[i]; if (n.z < this.z + .4) n.z = this.z + .4; if (n.z > shZ + seg * .6) n.z = shZ + seg * .6;
        const rx = n.x - this.x, ry = n.y - this.y, d = Math.hypot(rx, ry), fwd = rx * fx + ry * fy;
        if (n.z < shZ + 1 && fwd > -bodyR * .35) { n.x -= fx * (fwd + bodyR * .35); n.y -= fy * (fwd + bodyR * .35); }
        else if (n.z < shZ + 1 && d < bodyR) { const ux = d > .01 ? rx / d : -fx, uy = d > .01 ? ry / d : -fy; n.x = this.x + ux * bodyR; n.y = this.y + uy * bodyR; }
      }
    }
  }
  /**
   * Sp(joint, f, r, z): a detail drawn around a joint (the face, belt, toes) at offsets in the body's own frame,
   * projected by S. A knocked-down body turns them backward with it. While a motion clip plays (Mocap.drive sets
   * mocapTilt: the clip's body and head frames, 3x3, columns forward, right, up) they lean, roll and turn upside down with
   * the body, and the face with the head; the weapon hand's offsets (the blade) are already in the rig's frame.
   */
  _offsets(S) {
    const J = this.J, T = this.mocapTilt;
    if (T) return (p, df = 0, dr = 0, dz = 0) => {
      if (p === J.handR) return S(p[0] + df, p[1] + dr, p[2] + dz);
      const m = p === J.head ? T.head : T.body;
      return S(p[0] + m[0] * df + m[1] * dr + m[2] * dz, p[1] + m[3] * df + m[4] * dr + m[5] * dz, p[2] + m[6] * df + m[7] * dr + m[8] * dz);
    };
    const dA = (this.downW || 0) * Math.PI / 2 * .96, dca = Math.cos(dA), dsa = Math.sin(dA);
    return dA ? (p, df = 0, dr = 0, dz = 0) => S(p[0] + df * dca - dz * dsa, p[1] + dr, p[2] + df * dsa + dz * dca) : (p, df = 0, dr = 0, dz = 0) => S(p[0] + df, p[1] + dr, p[2] + dz);
  }
  draw(g, ox, oy, view) {
    this._pitch = view.pitchDeg;
    if (this.o.charView !== false) view = charView(view);
    const st = clamp(1 - view.pitchDeg / 45, 0, 1), camA = Math.atan2(view.fy, view.fx);
    this._camSide = Math.cos(camA - this.facing - Math.PI / 2) >= 0 ? 1 : -1;
    this._cheat = st > 0 && this.o.cheat ? clamp(angDiff(this.facing, camA), -this.o.cheat, this.o.cheat) * st : 0;
    this._drawHD(g, ox, oy, view);
  }
  _drawHD(g, ox, oy, view) {
    const o = this.o, C = this.C, J = this.J, sz = o.size, sc = view.scale * sz, ops = this._ops || (this._ops = []);
    ops.length = 0;
    const an = this.facing + this.spin + this._cheat, ca = Math.cos(an), sa = Math.sin(an), k = (1 - this.sq * .4) * sz, kz = (1 + this.sq) * sz;
    const vax = view.ax, vay = view.ay, vbx = view.bx, vby = view.by, vbz = view.bz, vdx = view.dx, vdy = view.dy, vdz = view.dz;
    const S = (f, r, z) => { const wx = (f * ca - r * sa) * k, wy = (f * sa + r * ca) * k, wz = z * kz; return [ox + vax * wx + vay * wy, oy + vbx * wx + vby * wy + vbz * wz, vdx * wx + vdy * wy + vdz * wz]; };
    const Sp = this._offsets(S);   // details around a joint (face, belt, toes) turn with the body
    const Q = {};
    for (const key of JOINT_KEYS) Q[key] = Sp(J[key]);
    const lq = (A, B, t) => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
    const dC = (Q.hipC[2] + Q.shC[2]) * .5, u = sc, lw = o.limbW / 2;
    const cap = (A, B, ra, rb, col, dx = 0, dy = 0) => {
      const ax = A[0] + dx, ay = A[1] + dy, bx = B[0] + dx, by = B[1] + dy, vx = bx - ax, vy = by - ay, L = Math.hypot(vx, vy);
      if (ra < .75 && rb < .75) { px.line(g, ax, ay, bx, by, col, 1); return; }
      if (L > .01) { const nx = -vy / L, ny = vx / L; px.poly(g, [[ax + nx * ra, ay + ny * ra], [bx + nx * rb, by + ny * rb], [bx - nx * rb, by - ny * rb], [ax - nx * ra, ay - ny * ra]], col); }
      px.disc(g, ax, ay, Math.max(0, ra - .35), col); px.disc(g, bx, by, Math.max(0, rb - .35), col);
    };
    const limb = (A, B, ra, rb, c, far, bias = 0) => {
      const t = tones(c), dk = far ? t.deep : t.sh, base = far ? t.sh : t.base, lt = far ? t.base : t.lt;
      ops.push({ d: (A[2] + B[2]) * .5 + bias, f: () => {
        cap(A, B, ra, rb, dk);
        cap(A, B, Math.max(.45, ra - .7), Math.max(.45, rb - .7), base, -.6, -.6);
        if (ra > 1.5 && !far) { const vx = B[0] - A[0], vy = B[1] - A[1], L = Math.hypot(vx, vy) || 1; let nx = -vy / L, ny = vx / L; if (nx * -.6 + ny * -.8 < 0) { nx = -nx; ny = -ny; } const off = ra - 1.1; px.line(g, A[0] + vx * .2 + nx * off, A[1] + vy * .2 + ny * off, A[0] + vx * .75 + nx * off, A[1] + vy * .75 + ny * off, lt); }
      } });
    };
    const inset = (pts, d) => { let cx = 0, cy = 0; for (const p of pts) { cx += p[0]; cy += p[1]; } cx /= pts.length; cy /= pts.length; return pts.map(p => { const vx = p[0] - cx, vy = p[1] - cy, l = Math.hypot(vx, vy) || 1, m = Math.max(0, l - d) / l; return [cx + vx * m - .6, cy + vy * m - .6]; }); };
    const slab = (pts, c, far) => { const t = tones(c); px.poly(g, pts, far ? t.deep : t.sh); px.poly(g, inset(pts, 1.1), far ? t.sh : t.base); };
    for (const s of [-1, 1]) {
      const hip = s > 0 ? Q.hipR : Q.hipL, knee = s > 0 ? Q.kneeR : Q.kneeL, foot = s > 0 ? Q.footR : Q.footL, far = knee[2] < dC;
      const ank = lq(knee, foot, .62), toe = Sp(s > 0 ? J.footR : J.footL, 1.9, 0, .3);
      limb(hip, knee, 1.45 * u * lw, 1.2 * u * lw, C.pants, far);
      limb(knee, ank, 1.2 * u * lw, 1.05 * u * lw, C.pants, far, .001);
      limb(ank, foot, 1.15 * u * lw, 1.05 * u * lw, C.boot, far, .002);
      limb(foot, toe, 1.0 * u * lw, .85 * u * lw, C.boot, far, .003);
    }
    const out = o.outfit, hz = Math.max(J.hipL[2], J.hipR[2]) + .9;
    if (out === 'tunic' || out === 'robe' || out === 'coat') {
      const len = out === 'robe' ? hz - .6 : out === 'coat' ? hz * .62 : hz * .42, fl = out === 'robe' ? 1.55 : 1.3, dep = o.torsoW * .7;
      const tail = out === 'coat' ? -1.2 - 2.2 * Math.min(1, this._spW) : 0, fwd = this._atkW * .3;
      const lat = [Sp([J.hipC[0], -o.hipHalf * 1.25, hz]), Sp([J.hipC[0], o.hipHalf * 1.25, hz]), Sp([J.hipC[0] + tail * .5 + fwd, o.hipHalf * 1.25 * fl, hz - len]), Sp([J.hipC[0] + tail * .5 + fwd, -o.hipHalf * 1.25 * fl, hz - len])];
      const sag = [Sp([J.hipC[0] + dep, 0, hz]), Sp([J.hipC[0] + (out === 'coat' ? dep * .3 : dep * fl) + fwd, 0, hz - len * (out === 'coat' ? .45 : 1)]), Sp([J.hipC[0] - dep * fl + tail, 0, hz - len]), Sp([J.hipC[0] - dep, 0, hz])];
      const cc = out === 'coat' ? (C.coat || C.cloth) : C.cloth, trim = C.trim || (out === 'coat' ? shade(cc, -.35) : C.belt);
      ops.push({ d: Q.hipC[2] + .05, f: () => {
        slab(lat, cc, false); slab(sag, cc, false);
        const t = tones(trim); px.line(g, lat[2][0], lat[2][1], lat[3][0], lat[3][1], t.base, Math.max(1, Math.round(u * .6)));
      } });
    }
    const shL = Sp(J.shL, 0, -.4, 0), shR = Sp(J.shR, 0, .4, 0), hL = Sp(J.hipL, 0, -.25, .5), hR = Sp(J.hipR, 0, .25, .5);
    const wL = lq(Sp(J.hipL, 0, -.2, 0), shL, .5), wR = lq(Sp(J.hipR, 0, .2, 0), shR, .5), core0 = Sp(J.hipC, 0, 0, .8), core1 = Sp(J.shC, 0, 0, -.4);
    const facingCam = S(2, 0, 6)[2] > S(0, 0, 6)[2];
    ops.push({ d: dC, f: () => {
      const t = tones(C.cloth), plate = [shL, shR, [wR[0] - .3, wR[1]], hR, hL, [wL[0] + .3, wL[1]]];
      px.poly(g, plate, t.sh); cap(core0, core1, o.torsoW * .62 * u, o.torsoW * .72 * u, t.sh);
      px.poly(g, inset(plate, 1.1), t.base); cap(core0, core1, Math.max(.5, o.torsoW * .62 * u - .9), Math.max(.5, o.torsoW * .72 * u - .9), t.base, -.6, -.6);
      if (facingCam) { const n0 = Sp(J.shC, .9, 0, -.8), n1 = Sp(J.hipC, 1.1, 0, 1.4); px.line(g, n0[0], n0[1], n1[0], n1[1], t.sh); const c0 = Sp(J.shC, .7, -.9, -.2), c1 = Sp(J.shC, 1.1, 0, -1.3), c2 = Sp(J.shC, .7, .9, -.2); px.line(g, c0[0], c0[1], c1[0], c1[1], tones(C.trim || C.clothLt).base); px.line(g, c1[0], c1[1], c2[0], c2[1], tones(C.trim || C.clothLt).base); }
      else { const n0 = Sp(J.shC, .3, 0, -.6), n1 = Sp(J.hipC, .3, 0, 1.6); px.line(g, n0[0], n0[1], n1[0], n1[1], t.lt); }
      const bl = Sp(J.hipL, 0, -.3, .7), br = Sp(J.hipR, 0, .3, .7), bt = tones(C.belt);
      px.line(g, bl[0], bl[1], br[0], br[1], bt.sh, Math.max(1, Math.round(u * .7))); px.line(g, bl[0], bl[1] - 1, br[0], br[1] - 1, bt.base);
      if (facingCam) { const bk = Sp(J.hipC, 1.1, 0, .7); px.rect(g, bk[0] - 1, bk[1] - 1, 2, 2, bt.hi); }
    } });
    if (this.capeL) {
      const L = this.capeL, R = this.capeR, x0 = this.x, y0 = this.y, z0 = this.z, ct = tones(C.cape), it = tones(C.capeIn), capeAway = Math.cos(an - Math.atan2(view.fy, view.fx)) < -.3;
      const PW = n => { const wx = n.x - x0, wy = n.y - y0, wz = n.z - z0; return [ox + vax * wx + vay * wy, oy + vbx * wx + vby * wy + vbz * wz, vdx * wx + vdy * wy + vdz * wz]; };
      for (let i = 0; i < L.length - 1; i++) {
        const q = [PW(L[i]), PW(R[i]), PW(R[i + 1]), PW(L[i + 1])], last = i === L.length - 2;
        ops.push({ d: capeAway ? (q[0][2] + q[2][2]) / 2 - .6 : Math.min((q[0][2] + q[2][2]) / 2 - .6, dC - .05), f: () => {
          let ar = 0; for (let m = 0; m < 4; m++) { const A = q[m], B = q[(m + 1) % 4]; ar += A[0] * B[1] - B[0] * A[1]; }
          const front = ar > 0, t = front ? ct : it;
          px.poly(g, q, front ? (i % 2 ? t.base : t.lt) : (i % 2 ? t.sh : t.deep));
          px.line(g, q[0][0], q[0][1], q[3][0], q[3][1], front ? t.sh : t.deep);
          if (last) px.line(g, q[2][0], q[2][1], q[3][0], q[3][1], tones(C.trim || C.belt).base);
        } });
      }
    }
    const neck0 = Sp(J.shC, 0, 0, -.2), neck1 = Sp(J.head, 0, 0, -o.headR * .6);
    limb(neck0, neck1, .75 * u, .75 * u, C.skin, false, -.01);
    ops.push({ d: Q.head[2], f: () => {
      const R = o.headR, r = R * u * .93, st = tones(C.skin), ht = tones(C.hair), hs = o.hair.style;
      const H = Sp(J.head, R * .1, 0, -R * .05), back = Sp(J.head, -R * .42, 0, R * .18), cap = Sp(J.head, -R * .2, 0, R * .74);
      const disc2 = (P0, rad, t, far) => { px.disc(g, P0[0], P0[1], rad, far ? t.deep : t.sh); px.disc(g, P0[0] - .6, P0[1] - .6, Math.max(.5, rad - 1), far ? t.sh : t.base); };
      const bald = hs === 'bald', hairBehind = back[2] < H[2];
      if (!bald && hairBehind) disc2(back, r * .98, ht, false);
      disc2(H, r * .9, st, false);
      if (r > 2.5) px.dot(g, H[0] - r * .45, H[1] - r * .4, st.lt);
      if (hs !== 'long' && !o.hood && r > 2) for (const sd of [-1, 1]) { const ear = Sp(J.head, -R * .05, sd * R * .92, -R * .1); if (ear[2] > H[2] - R * .2) { px.disc(g, ear[0], ear[1], Math.max(.6, r * .2), st.sh); } }
      if (!bald) {
        if (!hairBehind) disc2(back, r * .98, ht, false);
        disc2(cap, r * .7, ht, false);
        const bangs = o.face && o.face.bangs !== undefined ? o.face.bangs : .7, fringe = Sp(J.head, R * .6, 0, R * .56);
        if (bangs > 0 && fringe[2] > H[2]) { const fr = r * .42 * bangs; px.disc(g, fringe[0], fringe[1], fr, ht.sh); px.disc(g, fringe[0] - .5, fringe[1] - .5, Math.max(.4, fr - .8), ht.base); }
        px.dot(g, cap[0] - r * .35, cap[1] - r * .45, ht.hi); px.dot(g, cap[0] - r * .1, cap[1] - r * .55, ht.lt);
      }
      if (o.hood) { const tp = Sp(J.head, -R * 1.1, 0, R * .9); px.disc(g, tp[0], tp[1], r * .45, ht.base); }
      if (o.hat) this._hat(g, Sp, J, r, H);
      const big = o.face && o.face.eyes === 'big', eh = Math.max(1, Math.round(u * (big ? 1.4 : 1.05))), ew = u > 2.6 || (big && u > 1.8) ? 2 : 1;
      for (const sd of [-1, 1]) {
        const E2 = Sp(J.head, R * .9, sd * R * .36, -R * .02);
        if (E2[2] <= H[2] + .15) continue;
        if (o.eyeGlow) { px.rect(g, E2[0], E2[1], Math.max(1, ew + (u > 1.6 ? 1 : 0)), Math.max(1, eh - 1), o.eyeGlow); continue; }
        if (this.blink > 0 && this.hurtW < .5) {
          const top = E2[1] - eh + 1;
          if (eh >= 2 && u > 1.7) { px.rect(g, E2[0], top, ew, 1, C.eye); px.rect(g, E2[0], top + 1, ew, eh - 1, C.iris || '#3a4a8a'); px.dot(g, E2[0], top + 1, C.eyeWhite || '#ffffff'); }
          else { px.rect(g, E2[0], top, ew, eh, C.eye); if (u > 1.7) px.dot(g, E2[0] + (ew > 1 ? 1 : 0), top, C.eyeWhite || '#ffffff'); }
        } else px.rect(g, E2[0] - (ew > 1 ? 1 : 0), E2[1], ew + 1, 1, C.eye);
      }
      if (u > 1.9) { const m = Sp(J.head, R * .95, 0, -R * .5); if (m[2] > H[2]) px.rect(g, m[0] - (u > 2.6 ? 1 : 0), m[1], u > 2.6 ? 2 : 1, 1, this.hurtW > .3 ? '#6a1a1a' : st.deep); }
    } });
    for (const s of [-1, 1]) {
      const sh = s > 0 ? Q.shR : Q.shL, el = s > 0 ? Q.elbowR : Q.elbowL, hd = s > 0 ? Q.handR : Q.handL, far = el[2] < dC;
      const upper = o.sleeves === 'none' ? C.skin : C.cloth, lower = o.sleeves === 'long' ? C.cloth : C.skin;
      limb(sh, el, 1.15 * u * lw, 1.0 * u * lw, upper, far);
      limb(el, hd, 1.0 * u * lw, .9 * u * lw, lower, far, .001);
      const hc = C.glove || C.skin, ht = tones(hc);
      ops.push({ d: hd[2] + .02, f: () => { px.disc(g, hd[0], hd[1], Math.max(.6, .82 * u * lw - .35), far ? ht.deep : ht.sh); px.disc(g, hd[0] - .5, hd[1] - .5, Math.max(.4, .58 * u * lw - .35), far ? ht.sh : ht.base); } });
    }
    if (o.weapon === 'gun') {
      const hd = J.handR, bd = J.bladeDir, Hn = Q.handR, mz = Sp(hd, bd[0] * 5.5, bd[1] * 5.5, bd[2] * 5.5), gp = Sp(hd, -bd[0] * .6, -bd[1] * .6, -bd[2] * .6 - 1.4), m = tones(C.metal);
      ops.push({ d: Hn[2] + .03, f: () => { cap(Hn, gp, .8 * u, .7 * u, m.deep); cap(Hn, mz, .95 * u, .75 * u, m.sh); cap(Hn, mz, Math.max(.4, .95 * u - .8), Math.max(.4, .75 * u - .8), m.base, -.5, -.5); px.dot(g, mz[0], mz[1], '#ffffff'); } });
    } else if (o.weapon === 'staff') {
      const hd = J.handR, bd = J.bladeDir, Hn = Q.handR, top = Sp(hd, bd[0] * 10, bd[1] * 10, bd[2] * 10), bot = Sp(hd, -bd[0] * 7, -bd[1] * 7, -bd[2] * 7), wt = tones(C.staff || '#8a5a32'), ot = tones(C.orb || '#7fe3ff');
      ops.push({ d: (Hn[2] + top[2]) / 2, f: () => { cap(bot, top, .6 * u, .6 * u, wt.sh); px.line(g, bot[0] - .5, bot[1] - .5, top[0] - .5, top[1] - .5, wt.lt); px.disc(g, top[0], top[1], Math.max(1, u * 1.5), ot.sh); px.disc(g, top[0] - .6, top[1] - .6, Math.max(.6, u * 1.5 - 1), ot.base); px.dot(g, top[0] - 1, top[1] - 1, '#ffffff'); } });
    }
    if (o.weapon === 'sword') {
      const hd = J.handR, bd = J.bladeDir, Lb = o.bladeLen, Hn = Q.handR, sl = Math.hypot(bd[0], bd[1]) || 1, gx = -bd[1] / sl * 1.8, gy = bd[0] / sl * 1.8;
      const tip = Sp(hd, bd[0] * Lb, bd[1] * Lb, bd[2] * Lb), b0 = Sp(hd, bd[0] * 1.5, bd[1] * 1.5, bd[2] * 1.5), pom = Sp(hd, -bd[0] * 1.5, -bd[1] * 1.5, -bd[2] * 1.5);
      const g0 = Sp(hd, bd[0] * 1.5 + gx, bd[1] * 1.5 + gy, bd[2] * 1.5), g1 = Sp(hd, bd[0] * 1.5 - gx, bd[1] * 1.5 - gy, bd[2] * 1.5), m = tones(C.metal), h = tones(C.hilt);
      ops.push({ d: (Hn[2] + tip[2]) / 2, f: () => {
        const vx = tip[0] - b0[0], vy = tip[1] - b0[1], l = Math.hypot(vx, vy) || 1, nx = -vy / l * Math.max(.7, .65 * u), ny = vx / l * Math.max(.7, .65 * u);
        px.poly(g, [[b0[0] + nx, b0[1] + ny], [tip[0], tip[1]], [b0[0] - nx, b0[1] - ny]], m.sh);
        px.line(g, b0[0] - nx * .4, b0[1] - ny * .4, tip[0], tip[1], m.hi); px.line(g, b0[0] + nx * .5, b0[1] + ny * .5, tip[0], tip[1], m.base);
        px.line(g, pom[0], pom[1], Hn[0], Hn[1], '#5a3620', Math.max(1, Math.round(u * .7)));
        cap(g0, g1, .55 * u, .55 * u, h.sh); px.line(g, g0[0] - .5, g0[1] - .5, g1[0] - .5, g1[1] - .5, h.lt);
        px.disc(g, pom[0], pom[1], Math.max(.5, .6 * u - .35), h.base); px.dot(g, tip[0], tip[1], '#ffffff');
      } });
    }
    ops.sort((a, b) => a.d - b.d);
    for (const op of ops) op.f();
  }
  _hat(g, Sp, J, r, H) {
    const h = this.o.hat, st = h.style || 'cap', c = h.color || '#d83a2a', R = this.o.headR, dk = shade(c, -.3);
    if (st === 'cap') {
      const t = Sp(J.head, -.4, 0, R * .55), b = Sp(J.head, R * 1.05, 0, R * .25), b2 = Sp(J.head, R * 1.7, 0, R * .1);
      px.disc(g, t[0], t[1], r * .92, c); px.line(g, b[0], b[1], b2[0], b2[1], dk, 2);
    } else if (st === 'pointed') {
      const a = Sp(J.head, R * .2, -R * .95, R * .45), b = Sp(J.head, R * .2, R * .95, R * .45), f = Sp(J.head, R * .75, 0, R * .5), k = Sp(J.head, -R * .9, 0, R * .25), tip = Sp(J.head, -R * 2.3, 0, R * 1.6);
      px.poly(g, [f, k, tip], c); px.poly(g, [a, b, tip], c); px.line(g, a[0], a[1], b[0], b[1], dk); px.line(g, f[0], f[1], k[0], k[1], dk);
    } else if (st === 'helmet') {
      const t = Sp(J.head, -.8, 0, .6), cr = Sp(J.head, 0, 0, R * 1.05);
      px.disc(g, t[0], t[1], r * 1.02, c); px.disc(g, cr[0], cr[1], Math.max(1, r * .28), shade(c, .35));
      const f = Sp(J.head, R * .75, 0, -.2); px.disc(g, f[0], f[1], r * .55, this.C.skin);
    } else if (st === 'crown') {
      for (const k of [-1, 0, 1]) { const p = Sp(J.head, 0, k * R * .6, R * .9), q = Sp(J.head, 0, k * R * .6, R * 1.6); px.line(g, p[0], p[1], q[0], q[1], c, 2); }
      const a = Sp(J.head, 0, -R * .8, R * .85), b = Sp(J.head, 0, R * .8, R * .85); px.line(g, a[0], a[1], b[0], b[1], c, 2);
    }
  }
}
E.Humanoid = Humanoid;
class Attack {
  constructor(spec = {}, over) {
    if (typeof spec === 'string') { const m = E.MOVES[spec]; if (!m) warn('move:' + spec, 'unknown move "' + spec + '". Moves: ' + Object.keys(E.MOVES).join(', ')); spec = Object.assign({ name: spec, hitAt: .35 }, m || E.MOVES.slash, over); }
    else if (over) spec = Object.assign({}, spec, over);
    this.spec = Object.assign({ wind: .06, active: .1, recover: .18 }, spec); this.phase = null; this.t = 0; this.hit = new Set();
  }
  start(canCancel = false) {
    if (this.phase && !(canCancel && this.phase === 'recover')) return false;
    this.phase = 'wind'; this.t = 0; this.hit.clear(); return true;
  }
  get busy() { return !!this.phase; }
  get active() { return this.phase === 'active'; }
  get u() { return this.phase ? clamp(this.t / this.spec[this.phase], 0, 1) : 0; }
  get state() { return this.phase ? { spec: this.spec, phase: this.phase, u: this.u } : null; }
  update(dt) {
    if (!this.phase) return null;
    this.t += dt; let began = null;
    while (this.phase && this.t >= this.spec[this.phase]) {
      this.t -= this.spec[this.phase];
      this.phase = this.phase === 'wind' ? 'active' : this.phase === 'active' ? 'recover' : null;
      if (this.phase) began = this.phase;
    }
    if (!this.phase) this.t = 0;
    return began;
  }
  hits(targets, test, fn) {
    if (this.phase !== 'active' || this.u < (this.spec.hitAt || 0)) return 0;
    let n = 0;
    for (const t of targets) { if (!t || t.dead || this.hit.has(t) || !test(t)) continue; this.hit.add(t); n++; fn(t); }
    return n;
  }
  cancel() { this.phase = null; this.t = 0; }
}
E.Attack = Attack;
class Combo {
  constructor(specs, o = {}) { this.moves = specs.map(sp => sp instanceof Attack ? sp : new Attack(sp)); this.window = o.window === undefined ? .3 : o.window; this.step = -1; this.idle = 99; }
  get current() { return this.moves[Math.max(0, this.step)]; }
  get busy() { return this.step >= 0 && this.current.busy; }
  get active() { return this.busy && this.current.active; }
  get state() { return this.busy ? this.current.state : null; }
  press() {
    const cur = this.step >= 0 ? this.current : null;
    if (cur && cur.busy && cur.phase !== 'recover') return false;
    const next = (cur && (cur.busy || this.idle <= this.window) && this.step + 1 < this.moves.length) ? this.step + 1 : 0;
    if (cur && cur.busy) cur.cancel();
    this.step = next; this.idle = 0; return this.moves[next].start();
  }
  update(dt) { if (this.step < 0) return null; const r = this.current.update(dt); if (!this.current.busy) this.idle += dt; return r; }
  hits(targets, test, fn) { return this.step >= 0 ? this.current.hits(targets, test, fn) : 0; }
  cancel() { if (this.step >= 0) this.current.cancel(); this.step = -1; this.idle = 99; }
}
E.Combo = Combo;
E.MOVES = {
  slash:      { rel: true, a0: 1.7, a1: -1.7, z0: -6, z1: -9, reach: 7.5, wind: .08, active: .1, recover: .22 },
  backslash:  { rel: true, a0: -1.5, a1: 1.6, z0: -8, z1: -5, reach: 7.5, wind: .07, active: .1, recover: .2, lunge: .8 },
  overhead:   { rel: true, plane: 'side', a0: 2.4, a1: -1.25, reach: 7, wind: .16, active: .09, recover: .26, lunge: 2, crouch: .35, lean: .4 },
  rising:     { rel: true, plane: 'side', a0: -1.35, a1: 2.1, reach: 7, wind: .09, active: .11, recover: .24, hop: 3.5, lunge: .8, crouch: .4 },
  thrust:     { rel: true, a0: .12, a1: 0, z0: -5, z1: -4, r0: 3, r1: 10, wind: .11, active: .07, recover: .22, lunge: 3, lean: .5 },
  spin:       { rel: true, a0: 1.3, a1: 1.3, spin: true, z0: -6, z1: -6, reach: 8, wind: .09, active: .3, recover: .18, lunge: 0, lean: .1 },
  plunge:     { rel: true, plane: 'side', a0: -1.45, a1: -1.5, r0: 5, r1: 9, wind: .06, active: .25, recover: .15, lunge: 0, lean: .1 },
  twohand:    { rel: true, hand: 'both', plane: 'side', a0: 2.5, a1: -1.4, reach: 6.5, wind: .2, active: .1, recover: .3, lunge: 2.4, crouch: .5, lean: .5 },
  jab:        { rel: true, hand: 'L', a0: .05, a1: 0, z0: -1, z1: -.5, r0: 3, r1: 8.6, wind: .035, active: .06, recover: .13, lunge: .9, lean: .22, blade: 0 },
  cross:      { rel: true, a0: .25, a1: 0, z0: -1, z1: -.5, r0: 2.5, r1: 8.8, wind: .06, active: .07, recover: .17, lunge: 1.8, lean: .38, twist: 1.8, blade: 0 },
  hook:       { rel: true, a0: 1.45, a1: -.4, z0: -.5, z1: 0, reach: 6.8, wind: .08, active: .09, recover: .2, lunge: 1.3, lean: .3, twist: 1.5, blade: 0 },
  uppercut:   { rel: true, plane: 'side', a0: -1.15, a1: .95, reach: 7.2, wind: .11, active: .09, recover: .26, crouch: .6, hop: 2.5, lunge: 1.2, lean: .2, blade: 0 },
  haymaker:   { rel: true, a0: 2.1, a1: -.5, z0: 1, z1: -1, reach: 7.8, wind: .22, active: .1, recover: .3, lunge: 2.6, lean: .5, twist: 1.6, blade: 0 },
  elbow:      { rel: true, a0: .9, a1: -.3, z0: -.5, z1: 0, reach: 3.5, wind: .05, active: .07, recover: .16, lunge: 1, twist: 1.4, blade: 0 },
  kick:       { rel: true, kick: true, a0: .1, a1: 0, z0: .35, z1: .8, reach: 6.5, wind: .07, active: .09, recover: .2 },
  roundhouse: { rel: true, kick: true, a0: 1.7, a1: -.45, z0: 1, z1: 1.55, reach: 7, wind: .1, active: .13, recover: .24, twist: 1.3, lean: -.3 },
  sweep:      { rel: true, kick: true, a0: 1.9, a1: -1.7, z0: .08, z1: .08, reach: 7.5, wind: .08, active: .16, recover: .24, crouch: .9, lean: .3 },
  flyingkick: { rel: true, kick: true, a0: .1, a1: 0, z0: .5, z1: .75, reach: 7.5, wind: .1, active: .22, recover: .24, hop: 7, lunge: 3.5, lean: -.35 },
  knee:       { rel: true, kick: true, a0: 0, a1: 0, z0: .45, z1: .85, reach: 2, wind: .06, active: .08, recover: .18, lean: .2, lunge: 1 },
  axekick:    { rel: true, kick: true, a0: .2, a1: 0, z0: 2, z1: .5, reach: 4.8, wind: .14, active: .08, recover: .24, lean: -.2 },
  cast:       { rel: true, hand: 'both', plane: 'side', a0: 1.4, a1: .1, reach: 8, wind: .22, active: .12, recover: .32, lunge: .6, lean: .15, blade: 0 },
  throw:      { rel: true, plane: 'side', a0: 2.5, a1: -.25, reach: 7.5, wind: .16, active: .08, recover: .24, lunge: 1.8, lean: .45, blade: 0 },
  bash:       { rel: true, hand: 'both', plane: 'side', a0: 1, a1: -.35, reach: 5, wind: .12, active: .07, recover: .24, lunge: 3, hop: 1.2, crouch: .45, lean: .55, blade: 0 },
  claw:       { rel: true, a0: 1.2, a1: -1, z0: 1, z1: -4, reach: 7, wind: .12, active: .08, recover: .24, lunge: 1.8, lean: .4, blade: 0 }
};
const _moveSpecs = {};
E.move = (name, u = .5, phase = 'active') => ({ spec: _moveSpecs[name] || (_moveSpecs[name] = Object.assign({ name, wind: .06, active: .1, recover: .18 }, E.MOVES[name] || E.MOVES.slash)), phase, u });
E.knockback = (from, target, speed = 160, up = 0) => {
  const dx = target.x - from.x, dy = (target.y || 0) - (from.y || 0), d = Math.hypot(dx, dy) || 1, ix = dx / d * speed, iy = dy / d * speed;
  if (typeof target.push === 'function') target.push(ix, iy, up);
  else { target.vx = (target.vx || 0) + ix; target.vy = (target.vy || 0) + iy; if (up) target.vz = (target.vz || 0) + up; }
  return target;
};

// ---- 11. BLOB: squash-and-stretch sphere that looks at a target (slimes, bats, rabbites, imps) ----
class Blob {
  constructor(o = {}) {
    this.o = Object.assign({ R: 6.5 }, o);
    this.C = Object.assign({ dk: '#6d2658', base: '#c95f9a', lt: '#f5a3cc', spec: '#fff2f8', eye: '#ffffff', pupil: '#2a0f24' }, o.colors || {});
    this.sq = 0; this.sqV = 0; this.target = 0; this.look = [1, 0]; this.t = 0; this.squint = false; this.scale = 1;
  }
  kick(v) { this.sqV += v; }
  update(dt, s = {}) {
    this.t += dt;
    const target = s.squash || 0;
    this.sqV += (-(this.sq - target) * 320 - 14 * this.sqV) * dt; this.sq = clamp(this.sq + this.sqV * dt, -.45, .45);
    if (s.look) { const l = Math.hypot(s.look[0], s.look[1]); if (l > .01) { this.look[0] = lerp(this.look[0], s.look[0] / l, Math.min(1, dt * 8)); this.look[1] = lerp(this.look[1], s.look[1] / l, Math.min(1, dt * 8)); } }
    this.squint = !!s.squint; this.walk = s.walk || 0;
    this.flap = approach(this.flap === undefined ? 1 : this.flap, s.flap === undefined ? 1 : s.flap, dt * 6); this.flapP = (this.flapP || 0) + dt * 14 * this.flap; this.hang = !!s.hang;
  }
  draw(g, ox, oy, view) {
    if (!this.hang) return this._drawBody(g, ox, oy, view);
    const pv = Math.round(oy - this.o.R * this.scale * view.scale);
    g.save(); g.translate(0, pv * 2); g.scale(1, -1);
    try { this._drawBody(g, ox, oy, view); } finally { g.restore(); }
  }
  _drawBody(g, ox, oy, view) {
    if (this.o.charView !== false) view = charView(view);
    const o = this.o, R = o.R * this.scale, a = 1 - this.sq * .55, b = 1 + this.sq, C = this.C, sc = view.scale, t = this.t;
    const sp = Math.sin(view.pitch), cp = Math.cos(view.pitch) * view.zBoost;
    const rx = R * a * sc, ry = R * sc * Math.sqrt((a * sp) ** 2 + (b * cp) ** 2);
    const [cx0, cy0] = view.p(0, 0, R * b);
    const cx = ox + cx0, cy = oy + cy0, tb = tones(C.base), ext = C.ext || C.dk;
    if (o.wings) {
      const fold = Math.min(1, (this.flap === undefined ? 1 : this.flap) * 2), f = Math.sin(this.flapP === undefined ? t * 14 : this.flapP) * .5 + .5, wt = tones(C.wing || C.dk);
      for (const sd of [-1, 1]) {
        const x0 = cx + sd * rx * .6, y0 = cy - ry * .2, span = rx * (.7 + (.9 + f * .5) * fold), up = ry * ((1.2 - f * 1.3) * fold - .3 * (1 - fold));
        const pts = [[x0, y0], [x0 + sd * span * .55, y0 - up], [x0 + sd * span, y0 - up * .6 + ry * .2], [x0 + sd * span * .8, y0 + ry * .35], [x0 + sd * span * .5, y0 + ry * .15], [x0 + sd * span * .3, y0 + ry * .4]];
        px.poly(g, pts, wt.sh); px.line(g, x0, y0, x0 + sd * span * .55, y0 - up, wt.lt);
      }
    }
    if (o.ears === 'rabbit') for (const sd of [-1, 1]) {
      const ex = cx + sd * rx * .42, ey = cy - ry * .7, h = R * sc * (1.25 + .1 * Math.sin(t * 3 + sd)), w = Math.max(1.2, rx * .22);
      px.ell(g, ex + sd * h * .15, ey - h * .5, w + .8, h * .55, C.dk); px.ell(g, ex + sd * h * .15, ey - h * .5, w, h * .5 - .6, C.base); px.ell(g, ex + sd * h * .15, ey - h * .45, Math.max(.6, w * .45), h * .32, C.inner || '#f5a3b8');
    } else if (o.ears === 'cat') for (const sd of [-1, 1]) {
      const ex = cx + sd * rx * .55, ey = cy - ry * .55;
      px.poly(g, [[ex - rx * .3, ey + 1], [ex + sd * rx * .15, ey - ry * .75], [ex + rx * .3, ey + 1]], C.dk); px.poly(g, [[ex - rx * .15, ey], [ex + sd * rx * .1, ey - ry * .5], [ex + rx * .15, ey]], C.inner || '#f5a3b8');
    }
    if (o.tail) { const w = Math.sin(t * 5) * rx * .3; px.line(g, cx - rx * .8, cy + ry * .3, cx - rx * 1.35, cy - ry * .2 + w, C.dk, Math.max(1, Math.round(sc))); px.disc(g, cx - rx * 1.38, cy - ry * .25 + w, Math.max(1, rx * .16), C.base); }
    px.ell(g, cx, cy, rx, ry, C.dk);
    px.ell(g, cx + .5, cy - .8, Math.max(1, rx - 1.2), Math.max(1, ry - 1.3), C.base);
    px.ell(g, cx - rx * .15, cy + ry * .35, Math.max(1, rx * .7), Math.max(.6, ry * .3), tb.sh);
    px.ell(g, cx + rx * .3, cy - ry * .42, Math.max(1, rx * .38), Math.max(.6, ry * .28), C.lt);
    px.rect(g, cx + rx * .45, cy - ry * .6, 2, 1, C.spec);
    if (o.feet) for (const sd of [-1, 1]) { const st = Math.sin(t * 9 + sd) * (this.walk || 0); px.ell(g, cx + sd * rx * .45 + st, cy + ry * .9, Math.max(1.2, rx * .28), Math.max(.8, ry * .16), ext); }
    if (o.horns) for (const sd of [-1, 1]) { const hx = cx + sd * rx * .45, hy = cy - ry * .72; px.poly(g, [[hx - sd * rx * .15, hy + 1], [hx + sd * rx * .3, hy - ry * .7], [hx + sd * rx * .2, hy + 1]], C.horn || '#e8dcc0'); px.dot(g, hx + sd * rx * .26, hy - ry * .6, '#ffffff'); }
    const la = Math.atan2(this.look[1], this.look[0]), dc = view.depth(0, 0, R * b), front = o.face === 'front';
    const [lx, ly] = view.p(this.look[0], this.look[1], 0), lxs = clamp(lx, -1, 1);
    let shown = 0, eyeY = cy;
    for (const s of [-1, 1]) {
      let X, Y;
      if (front) { X = Math.round(cx + lxs * rx * .25 + s * rx * .36); Y = Math.round(cy - ry * .12); }
      else {
        const ea = la + s * .42, e = [Math.cos(ea) * R * a * .82, Math.sin(ea) * R * a * .82, R * b * 1.25];
        if (view.depth(e[0], e[1], e[2]) < dc && !view.isTop && view.pitchDeg < 70) continue;
        const [ex, ey] = view.p(e[0], e[1], e[2]); X = Math.round(clamp(ox + ex, cx - rx + 2, cx + rx - 3)); Y = Math.round(clamp(oy + ey, cy - ry + 2, cy + ry - 3));
      }
      shown++; eyeY = Y;
      if (this.squint) { px.rect(g, X - 1, Y, 2, 1, C.pupil); continue; }
      const big = rx > 7;
      px.rect(g, X - 1, Y - 1, big ? 3 : 2, big ? 4 : 3, C.eye);
      px.rect(g, X + (lx >= 0 ? (big ? 1 : 0) : -1 + (big ? 1 : 0)), Y + (ly > .4 ? 1 : 0), big ? 2 : 1, 2, C.pupil);
    }
    if (o.mouth && shown) {
      const mx = Math.round(cx + (front ? lxs * rx * .25 : 0)), my = eyeY + Math.max(3, Math.round(ry * .35));
      px.rect(g, mx - 1, my, 3, 1, C.pupil);
      if (o.mouth === 'fangs') { px.dot(g, mx - 1, my + 1, '#ffffff'); px.dot(g, mx + 1, my + 1, '#ffffff'); }
    }
  }
}
E.Blob = Blob;

// ---- 12. TILEMAP: ground-plane levels from ASCII rows (top-down, iso, three-quarter, brawler). Walls are extruded boxes baked per view ----
function parseLevel(rows, legend = {}) {
  if (typeof rows === 'string') rows = rows.replace(/^\n+|\n+$/g, '').split('\n');
  if (!Array.isArray(rows) || !rows.length) throw new Error('level rows must be a non-empty array of strings');
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  if (rows.some(r => r.length !== w)) warn('rows:' + w, 'level rows have different lengths; short rows are padded with empty cells (widest row = ' + w + ')');
  const cells = new Array(w * h).fill(0), floor = new Array(w * h).fill(null), block = new Uint8Array(w * h), spawns = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = rows[y][x] === undefined ? ' ' : rows[y][x], v = legend[ch], i = y * w + x;
    if (v === undefined || v === null) { if (ch !== '.' && ch !== ' ') warn('legend:' + ch, 'level character "' + ch + '" is not in the legend (treated as empty)'); continue; }
    if (typeof v === 'number') cells[i] = v;
    else if (typeof v === 'string') spawns.push({ tag: v, ch, cx: x, cy: y });
    else { if (v.tile) cells[i] = v.tile; if (v.floor) floor[i] = v.floor; if (v.block) block[i] = 1; if (v.spawn) spawns.push({ tag: v.spawn, ch, cx: x, cy: y }); }
  }
  return { w, h, cells, floor, block, spawns };
}
E.parseLevel = parseLevel;
const DEFAULT_WALL = { h: 32, top: '#6a6280', side: '#4a4360' };
const groundDir = d => { if (typeof d === 'number') return [Math.cos(d), Math.sin(d)]; const l = Math.hypot(d[0], d[1]) || 1; return [d[0] / l, d[1] / l]; };   // an angle or [dx, dy]
class TileMap {
  constructor(o = {}) {
    this.T = o.tile || 16;
    const L = o.rows ? parseLevel(o.rows, o.legend) : o.level || null;
    if (L) o = Object.assign({}, o, { w: L.w, h: L.h, cells: L.cells });
    else if (o.w && o.h && !o.cells) o = Object.assign({}, o, { cells: new Array(o.w * o.h).fill(0) });   // open floor, to fill in code
    if (!o.w || !o.h || !o.cells) throw new Error('TileMap needs { rows, legend } or { w, h } (and cells)');
    if (o.cells.length !== o.w * o.h) throw new Error('TileMap: cells has ' + o.cells.length + ' entries but w * h = ' + (o.w * o.h));
    this.w = o.w; this.h = o.h; this.cells = o.cells; this.types = Object.assign({}, o.types || {});
    this.floorTags = L ? L.floor : o.floor ? o.floor.slice() : null;
    this.blocked = L ? L.block : o.blocked ? Uint8Array.from(o.blocked) : new Uint8Array(this.w * this.h);
    if (o.block && this.floorTags) { const tags = [].concat(o.block); this.floorTags.forEach((f, i) => { if (f && tags.includes(f)) this.blocked[i] = 1; }); }
    this.spawns = L ? L.spawns.map(sp => Object.assign(sp, { x: (sp.cx + .5) * this.T, y: (sp.cy + .5) * this.T, z: 0 })) : [];
    for (const id of new Set(this.cells)) if (id > 0 && !this.types[id]) { warn('walltype:' + id, 'TileMap: wall type ' + id + ' is used in the map but missing from types (using a plain grey wall)'); this.types[id] = DEFAULT_WALL; }
    this.floorTex = o.floorTex || (() => [60, 56, 72]); this.cutaway = o.cutaway !== false; this.floors = {};
    this.ao = o.ao === undefined ? 5 : o.ao;
    this.light = V3.norm([-.6, -.8, 0]); this.version = 0;
  }
  find(tag) { return this.spawns.find(s => s.tag === tag) || null; }
  findAll(tag) { return this.spawns.filter(s => s.tag === tag); }
  cell(cx, cy) { return cx < 0 || cy < 0 || cx >= this.w || cy >= this.h ? -1 : this.cells[cy * this.w + cx]; }
  set(cx, cy, v) { if (cx >= 0 && cy >= 0 && cx < this.w && cy < this.h) { if (v > 0 && !this.types[v]) this.types[v] = DEFAULT_WALL; this.cells[cy * this.w + cx] = v; this.floors = {}; this.version++; } }
  fill(cx, cy, w, h, id) {   // a w x h block of wall type id (0 clears it): maps built in code
    if (id > 0 && !this.types[id]) this.types[id] = DEFAULT_WALL;
    for (let y = Math.max(0, cy); y < Math.min(this.h, cy + h); y++) for (let x = Math.max(0, cx); x < Math.min(this.w, cx + w); x++) this.cells[y * this.w + x] = id;
    this.floors = {}; this.version++;
  }
  setFloor(cx, cy, tag, block) {   // a cell's floor tag ('water', 'grass'), blocked or not
    if (cx < 0 || cy < 0 || cx >= this.w || cy >= this.h) return;
    if (!this.floorTags) this.floorTags = new Array(this.w * this.h).fill(null);
    const i = cy * this.w + cx; this.floorTags[i] = tag; if (block !== undefined) this.blocked[i] = block ? 1 : 0;
    this.floors = {}; this.version++;
  }
  toCell(x, y) { return [Math.floor(x / this.T), Math.floor(y / this.T)]; }
  center(cx, cy) { return [(cx + .5) * this.T, (cy + .5) * this.T]; }
  solidCell(cx, cy) { const c = this.cell(cx, cy); return c !== 0; }
  walkable(cx, cy) { return this.cell(cx, cy) === 0 && !this.blocked[cy * this.w + cx]; }
  block(cx, cy, on = true) { const i = cy * this.w + cx, v = on ? 1 : 0; if (cx >= 0 && cy >= 0 && cx < this.w && cy < this.h && this.blocked[i] !== v) { this.blocked[i] = v; this.version++; } }
  solidAt(x, y) { return this.solidCell(Math.floor(x / this.T), Math.floor(y / this.T)); }
  height(cx, cy) { const c = this.cell(cx, cy); return c > 0 ? this.types[c].h : c < 0 ? 1e9 : 0; }
  heightAt(x, y) { return this.height(Math.floor(x / this.T), Math.floor(y / this.T)); }
  floorAt(x, y) { if (!this.floorTags) return null; const cx = Math.floor(x / this.T), cy = Math.floor(y / this.T); return cx < 0 || cy < 0 || cx >= this.w || cy >= this.h ? null : this.floorTags[cy * this.w + cx]; }
  groundAt(x, y, r = 0, z = 1e9, step = 2) {
    const T = this.T, rr = r * .6; let g = 0;
    for (let cy = Math.floor((y - rr) / T); cy <= Math.floor((y + rr) / T); cy++) for (let cx = Math.floor((x - rr) / T); cx <= Math.floor((x + rr) / T); cx++) {
      const c = this.cell(cx, cy); if (c <= 0) continue; const h = this.types[c].h; if (h <= z + step && h > g) g = h;
    }
    return g;
  }
  collide(b) {
    const T = this.T, zA = typeof b.z === 'number', step = b.step === undefined ? 2 : b.step;
    let hit = false;
    for (let it = 0; it < 2; it++) {
      const c0 = Math.floor((b.x - b.r) / T), c1 = Math.floor((b.x + b.r) / T), r0 = Math.floor((b.y - b.r) / T), r1 = Math.floor((b.y + b.r) / T);
      for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
        const c = this.cell(cx, cy);
        if (c === 0) { if (!this.blocked[cy * this.w + cx] || (zA && b.z > step)) continue; }
        else if (zA && c > 0 && this.types[c].h <= b.z + step) continue;
        const nx = clamp(b.x, cx * T, cx * T + T), ny = clamp(b.y, cy * T, cy * T + T);
        let dx = b.x - nx, dy = b.y - ny, d = Math.hypot(dx, dy);
        if (d >= b.r) continue;
        hit = true;
        if (d < 1e-4) {
          const open = (x, y) => { const n = this.cell(x, y); return n === 0 ? !this.blocked[y * this.w + x] : zA && n > 0 && this.types[n].h <= b.z + step; };
          const opts = [[b.x - cx * T, -1, 0], [cx * T + T - b.x, 1, 0], [b.y - cy * T, 0, -1], [cy * T + T - b.y, 0, 1]].filter(o2 => open(cx + o2[1], cy + o2[2])).sort((p, q) => p[0] - q[0]);
          if (opts.length) { const [, ox, oy] = opts[0]; if (ox) b.x = ox < 0 ? cx * T - b.r : cx * T + T + b.r; else b.y = oy < 0 ? cy * T - b.r : cy * T + T + b.r; }
          else this._escape(b, zA, step);
          continue;
        }
        b.x = nx + dx / d * b.r; b.y = ny + dy / d * b.r;
      }
    }
    return hit;
  }
  _escape(b, zA, step) {
    const T = this.T, cx = Math.floor(b.x / T), cy = Math.floor(b.y / T); let best = null, bd = 1e9;
    for (let y = cy - 8; y <= cy + 8; y++) for (let x = cx - 8; x <= cx + 8; x++) {
      const n = this.cell(x, y); if (n < 0 || (n === 0 && this.blocked[y * this.w + x]) || (n > 0 && !(zA && this.types[n].h <= b.z + step))) continue;
      const px2 = clamp(b.x, x * T + b.r, x * T + T - b.r), py2 = clamp(b.y, y * T + b.r, y * T + T - b.r), dd = Math.hypot(px2 - b.x, py2 - b.y);
      if (dd < bd) { bd = dd; best = [px2, py2]; }
    }
    if (best) { b.x = best[0]; b.y = best[1]; }
  }
  _liftOrder(view, x, y, z, k) {
    const T = this.T, cx = Math.floor(x / T), cy = Math.floor(y / T), c = this.cell(cx, cy), t = c > 0 ? this.types[c] : null;
    if (!t || z < t.h - 1) return k;
    return Math.max(k, view.order((cx + .5) * T, (cy + .5) * T, 0) + .002 + z * 1e-5);
  }
  los(x0, y0, x1, y1) { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4); for (let i = 1; i < n; i++) if (this.solidAt(lerp(x0, x1, i / n), lerp(y0, y1, i / n))) return false; return true; }
  // the first cell top above the segment a -> b (o.eye / o.target lift its ends): { clear, t, x, y, z }
  ray(a, b, o = {}) {
    const z0 = (a.z || 0) + (o.eye || 0), dz = (b.z || 0) + (o.target || 0) - z0, dx = b.x - a.x, dy = b.y - a.y;
    return this._walk(a.x, a.y, b.x, b.y, (cx, cy, t0, t1) => {
      const top = this.height(cx, cy), za = z0 + dz * t0, zb = z0 + dz * t1;
      if (top <= Math.min(za, zb) + 1e-6) return null;   // (the segment is straight: its lowest point in a cell is at one end)
      const t = za <= top ? t0 : (top - z0) / dz;   // it meets the cell's side, or comes down onto its top
      return { clear: false, t, x: a.x + dx * t, y: a.y + dy * t, z: z0 + dz * t, cx, cy };
    }) || { clear: true, t: 1, x: b.x, y: b.y, z: z0 + dz };
  }
  // can a's eyes (z + eye) see b's chest (z + chest)? los() ignores heights
  sight(a, b, o = {}) {
    const eye = o.eye !== undefined ? o.eye : a.eye !== undefined ? a.eye : HEIGHTS.eye, target = o.target !== undefined ? o.target : b.chest !== undefined ? b.chest : HEIGHTS.chest;
    return this.ray(a, b, { eye, target }).clear;
  }
  // can a body of radius r stand at (x, y) with its feet at z?
  standable(x, y, z, r = 5, step = HEIGHTS.step) {
    const T = this.T;
    for (let cy = Math.floor((y - r) / T); cy <= Math.floor((y + r) / T); cy++) for (let cx = Math.floor((x - r) / T); cx <= Math.floor((x + r) / T); cx++) {
      const e = Math.hypot(x - clamp(x, cx * T, cx * T + T), y - clamp(y, cy * T, cy * T + T)); if (e > 0 && e >= r) continue;   // (a corner the circle misses)
      const c = this.cell(cx, cy); if (c < 0) return false;
      if ((c > 0 ? this.types[c].h : 0) > z + step) return false;
      if (c === 0 && z <= step && this.blocked[cy * this.w + cx]) return false;
    }
    return this.groundAt(x, y, r, z, step) >= z - step;
  }
  // a ledge to climb in direction dir (angle or [dx, dy]): { x, y, z, rise, facing, edge } or null. o: { reach: 18, min: 4, rise: 82, spread: .28 }
  ledge(from, dir, o = {}) {
    const reach = o.reach === undefined ? 18 : o.reach, min = o.min === undefined ? 4 : o.min, rise = o.rise === undefined ? 82 : o.rise, spread = o.spread === undefined ? .28 : o.spread;
    const r = from.r || 5, z = from.z || 0, [ux, uy] = groundDir(dir), a0 = Math.atan2(uy, ux); let best = null;
    for (const off of spread ? [0, -spread, spread] : [0]) {
      const a = a0 + off, dx = Math.cos(a), dy = Math.sin(a), at = d => this.heightAt(from.x + dx * d, from.y + dy * d);
      for (let d = 1, prev = 0; d <= reach; d++) {
        const h = at(d);
        if (h < z - HEIGHTS.step) break;   // a drop first: that is a jump, not a climb
        if (h - z < min) { prev = d; continue; }
        if (h - z > rise) break;           // too high to climb
        let lo = prev, hi = d; for (let i = 0; i < 8; i++) { const mid = (lo + hi) / 2; if (at(mid) >= h) hi = mid; else lo = mid; }   // the edge
        const ex = from.x + dx * hi, ey = from.y + dy * hi;
        for (const k of [r + 1, this.T / 2]) {
          const x = ex + dx * k, y = ey + dy * k, score = d + Math.abs(off) * 12;
          if (this.standable(x, y, h, r)) { if (!best || score < best.score) best = { x, y, z: h, rise: h - z, facing: a, edge: [ex, ey], score }; break; }
        }
        break;
      }
    }
    if (best) delete best.score;
    return best;
  }
  // where a jump lands across a gap: { x, y, z, d } or null. o: { min: 35, max: 83, rise: 11, drop: 18, apex: 20 }
  landing(from, dir, o = {}) {
    const min = o.min === undefined ? 35 : o.min, max = o.max === undefined ? 83 : o.max, rise = o.rise === undefined ? 11 : o.rise, drop = o.drop === undefined ? 18 : o.drop;
    const apex = o.apex === undefined ? 20 : o.apex, r = from.r || 5, z = from.z || 0, st = HEIGHTS.step, [dx, dy] = groundDir(dir);
    let gap = false, low = 1e9;
    for (let d = 1; d <= max; d++) {
      const h = this.heightAt(from.x + dx * d, from.y + dy * d);
      if (!gap) { if (h > z + st) return null; if (h < z - st) { gap = true; low = h; } continue; }
      low = Math.min(low, h);
      if (h <= low + st || h > z + rise || h < z - drop || d + r > max) continue;
      const x = from.x + dx * Math.max(min, d + r), y = from.y + dy * Math.max(min, d + r), g = this.heightAt(x, y);   // a radius in from the far edge
      if (Math.abs(g - h) <= st && this.standable(x, y, g, r) && this.arcClear(from, { x, y, z: g }, apex, r)) return { x, y, z: g, d: Math.max(min, d + r) };
    }
    return null;
  }
  // what lies past the edge ahead: { x, y, z, fall } or null. o: { reach: 12 }
  drop(from, dir, o = {}) {
    const reach = o.reach === undefined ? 12 : o.reach, r = from.r || 5, z = from.z || 0, st = HEIGHTS.step, [dx, dy] = groundDir(dir);
    for (let d = 1; d <= reach; d++) {
      const h = this.heightAt(from.x + dx * d, from.y + dy * d);
      if (h > z + st) return null;
      if (h < z - st) { const x = from.x + dx * (d + r), y = from.y + dy * (d + r), g = this.groundAt(x, y, r, z, st); return { x, y, z: g, fall: z - g }; }
    }
    return null;
  }
  // does a jump arc a -> b, peaking apex above the higher end, clear every top?
  arcClear(a, b, apex = 20, r = 0) {
    const za = a.z || 0, zb = b.z || 0, D = zb - za, M = Math.max(za, zb) + apex - (za + zb) / 2, k = 2 * M + Math.sqrt(Math.max(0, 4 * M * M - D * D));
    const zAt = t => za + D * t + k * t * (1 - t), l = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / l * r * .9, ny = (b.x - a.x) / l * r * .9;
    for (const s of r > 0 ? [0, -1, 1] : [0])   // (the arc is concave: over a cell its lowest point is at one end)
      if (this._walk(a.x + nx * s, a.y + ny * s, b.x + nx * s, b.y + ny * s, (cx, cy, t0, t1) => this.height(cx, cy) > Math.min(zAt(t0), zAt(t1)) + 1e-6)) return false;
    return true;
  }
  // every cell the segment crosses, as fn(cx, cy, t0, t1); stops at the first truthy result
  _walk(x0, y0, x1, y1, fn) {
    const T = this.T, dx = x1 - x0, dy = y1 - y0, sx = Math.sign(dx), sy = Math.sign(dy), ddx = sx ? T / Math.abs(dx) : Infinity, ddy = sy ? T / Math.abs(dy) : Infinity;
    let cx = Math.floor(x0 / T), cy = Math.floor(y0 / T), t0 = 0, res;
    let tx = sx > 0 ? ((cx + 1) * T - x0) / dx : sx < 0 ? (cx * T - x0) / dx : Infinity, ty = sy > 0 ? ((cy + 1) * T - y0) / dy : sy < 0 ? (cy * T - y0) / dy : Infinity;
    for (let n = 0; n < 1e6; n++) {
      const t1 = Math.min(tx, ty, 1);
      if ((res = fn(cx, cy, t0, t1))) return res;
      if (t1 >= 1) return null;
      if (Math.abs(tx - ty) < 1e-12) { if ((res = fn(cx + sx, cy, tx, tx) || fn(cx, cy + sy, tx, tx))) return res; cx += sx; cy += sy; t0 = tx; tx += ddx; ty += ddy; }
      else if (tx < ty) { cx += sx; t0 = tx; tx += ddx; } else { cy += sy; t0 = ty; ty += ddy; }
    }
    return null;
  }
  bounds(view) {
    const W = this.w * this.T, H = this.h * this.T; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y, z] of [[0, 0, 0], [W, 0, 0], [0, H, 0], [W, H, 0], [0, 0, 48], [W, 0, 48], [0, H, 48], [W, H, 48]]) { const s = view.p(x, y, z); x0 = Math.min(x0, s[0]); x1 = Math.max(x1, s[0]); y0 = Math.min(y0, s[1]); y1 = Math.max(y1, s[1]); }
    return { x0: x0 - 8, y0: y0 - 8, x1: x1 + 8, y1: y1 + 8 };
  }
  _floor(view) {
    const key = view.id + ':' + view.yawDeg + ':' + view.pitchDeg + ':' + view.scale;
    if (this.floors[key]) return this.floors[key];
    if (Object.keys(this.floors).length > 6) this.floors = {};
    const T = this.T, W = this.w * T, H = this.h * T;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of [[0, 0], [W, 0], [0, H], [W, H]]) { const s = view.p(x, y, 0); x0 = Math.min(x0, s[0]); x1 = Math.max(x1, s[0]); y0 = Math.min(y0, s[1]); y1 = Math.max(y1, s[1]); }
    x0 = Math.floor(x0); y0 = Math.floor(y0);
    let cw = Math.ceil(x1) - x0 + 1, ch = Math.ceil(y1) - y0 + 1;
    if (!view.inv) ch = 24;
    const cv = mkCanvas(cw, ch), g = cv.getContext('2d'), img = g.createImageData(cw, ch), d = img.data;
    for (let py = 0; py < ch; py++) for (let pxx = 0; pxx < cw; pxx++) {
      let gx, gy;
      if (view.inv) { const q = view.toGround(pxx + x0 + .5, py + y0 + .5); gx = q[0]; gy = q[1]; }
      else { gx = (pxx + x0 + .5) / view.ax; gy = H * .5 + py * 2; }
      if (gx < 0 || gy < 0 || gx >= W || gy >= H) continue;
      if (view.inv && this.cell(Math.floor(gx / T), Math.floor(gy / T)) !== 0) continue;
      let c = this.floorTex(gx, gy, this.floorTags ? this.floorTags[Math.floor(gy / T) * this.w + Math.floor(gx / T)] : null, view); if (!c) continue;
      if (this.ao) {
        const fcx = Math.floor(gx / T), fcy = Math.floor(gy / T), lx = gx - fcx * T, ly = gy - fcy * T, R = this.ao;
        let ao = 0;
        const wall = (dx, dy) => this.cell(fcx + dx, fcy + dy) > 0;
        if (wall(-1, 0)) ao = Math.max(ao, 1 - lx / R); if (wall(1, 0)) ao = Math.max(ao, 1 - (T - lx) / R);
        if (wall(0, -1)) ao = Math.max(ao, 1 - ly / R); if (wall(0, 1)) ao = Math.max(ao, 1 - (T - ly) / R);
        if (wall(-1, -1)) ao = Math.max(ao, 1 - Math.hypot(lx, ly) / R); if (wall(1, -1)) ao = Math.max(ao, 1 - Math.hypot(T - lx, ly) / R);
        if (wall(-1, 1)) ao = Math.max(ao, 1 - Math.hypot(lx, T - ly) / R); if (wall(1, 1)) ao = Math.max(ao, 1 - Math.hypot(T - lx, T - ly) / R);
        if (ao > 0) { const k = 1 - .4 * Math.round(ao * 5) / 5; c = [c[0] * k, c[1] * k * .98, c[2] * k * 1.02, c[3]]; }
      }
      if (!view.inv) c = c.map(v => v * (py < 2 ? 1.1 : .55 - py * .01));
      const k = (py * cw + pxx) * 4; d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return (this.floors[key] = { cv, x0, y0 });
  }
  drawFloor(r) { r._map = this; const f = this._floor(r.view); r.ctx.drawImage(f.cv, f.x0 - r.ix, f.y0 - r.iy); }
  _isFront(cx, cy, view) {
    if (!this.cutaway || view.isTop || view.pitchDeg > 75) return false;
    const t = this.types[this.cell(cx, cy)]; if (!t || !t.cut) return false;
    const bx = -Math.round(view.fx), by = -Math.round(view.fy);
    const behindFloor = (bx && this.cell(cx + bx, cy) === 0) || (by && this.cell(cx, cy + by) === 0);
    return !!behindFloor;
  }
  queueWalls(r) {
    const view = r.view, T = this.T; r._map = this;
    for (let cy = 0; cy < this.h; cy++) for (let cx = 0; cx < this.w; cx++) {
      const id = this.cell(cx, cy); if (id <= 0) continue;
      const t = this.types[id], h = this._isFront(cx, cy, view) ? (t.cutH || 6) : t.h;
      const [sx, sy] = r.w(cx * T + T / 2, cy * T + T / 2, 0);
      if (sx < -40 || sx > r.W + 40 || sy < -20 || sy > r.H + 90) continue;
      r.queue(cx * T + T / 2, cy * T + T / 2, 0, g => this._boxCached(g, r, cx, cy, t, h), { occluder: true });
    }
  }
  _boxCached(g, r, cx, cy, t, h) {
    const view = r.view, key = view.id + ':' + view.yawDeg + ':' + view.pitchDeg + ':' + view.scale + ':' + this.version;
    if (!this._wc || this._wc.key !== key) this._wc = { key, m: new Map() };
    const idx = cy * this.w + cx; let e = this._wc.m.get(idx);
    if (!e || e.h !== h) {
      const T = this.T; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const z of [0, h]) for (const [x, y] of [[cx * T, cy * T], [cx * T + T, cy * T], [cx * T, cy * T + T], [cx * T + T, cy * T + T]]) { const q = view.p(x, y, z); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
      e = { h, x0: Math.floor(x0) - 2, y0: Math.floor(y0) - 2, w: Math.ceil(x1) - Math.floor(x0) + 5, hh: Math.ceil(y1) - Math.floor(y0) + 5, cv: null };
      this._wc.m.set(idx, e);
    }
    if (!e.cv) {
      const c = e.cv = mkCanvas(e.w, e.hh), sx = r.ix, sy = r.iy; r.ix = e.x0; r.iy = e.y0;
      try { this._box(ctx2d(c), r, cx, cy, t, h); } finally { r.ix = sx; r.iy = sy; }
    }
    g.drawImage(e.cv, e.x0 - r.ix, e.y0 - r.iy);
  }
  _box(g, r, cx, cy, t, h) {
    const view = r.view, T = this.T, x0 = cx * T, y0 = cy * T, x1 = x0 + T, y1 = y0 + T, P = (x, y, z) => r.w(x, y, z);
    if (!view.isTop) {
      const faces = [[0, -1, [x1, y0], [x0, y0]], [0, 1, [x0, y1], [x1, y1]], [-1, 0, [x0, y0], [x0, y1]], [1, 0, [x1, y1], [x1, y0]]];
      for (const [nx, ny, A, B] of faces) {
        if (nx * view.fx + ny * view.fy <= .02) continue;
        const nh = this.cell(cx + nx, cy + ny) > 0 ? (this._isFront(cx + nx, cy + ny, view) ? (this.types[this.cell(cx + nx, cy + ny)].cutH || 6) : this.height(cx + nx, cy + ny)) : 0;
        if (nh >= h) continue;
        const lit = -(nx * this.light[0] + ny * this.light[1]);
        const col = lit > .2 ? t.sideLt || shade(t.side, .12) : lit < -.2 ? t.sideDk || shade(t.side, -.25) : t.side;
        const face = [P(A[0], A[1], nh), P(B[0], B[1], nh), P(B[0], B[1], h), P(A[0], A[1], h)];
        px.poly(g, face, col);
        const pat = t.texture === false || t.face === 'none' ? 'none' : 'brick';
        if (pat === 'brick') {
          const PA = face[0], ex = face[1][0] - PA[0], ey = face[1][1] - PA[1], bz = view.bz, ct = tones(col), course0 = t.course || 8, fi = nx * 3 + ny;
          if (Math.abs(ex) > .3 && Math.abs(bz) > .05) scan(face, (xa, xb, y) => {
            for (let x = xa; x <= xb; x++) {
              const u = clamp((x + .5 - PA[0]) / ex, 0, 1), z = nh + (y + .5 - PA[1] - u * ey) / bz, ci = Math.floor(z / course0), fz = z / course0 - ci;
              const bi = Math.floor(u * 2 + (ci & 1) * .5), v = hash2(cx * 7 + cy * 13 + fi * 31 + bi * 5, ci + 99);
              let c2 = v < .22 ? ct.sh : v > .86 ? ct.lt : null;
              if (fz > .8) c2 = v > .5 ? ct.lt : c2;
              if (hash2(Math.floor(u * T * 1.4) + cx * 53 + fi * 7, Math.floor(z * 1.4) + cy * 41) < .07) c2 = ct.sh;
              if (c2) { px.col(g, c2); g.fillRect(x, y, 1, 1); }
            }
          });
        }
        const ln = t.line || shade(col, -.3), course = t.course || 8;
        if (pat === 'brick') for (let z = Math.ceil((nh + .01) / course) * course, k = 0; z < h; z += course, k++) {
          const a = P(A[0], A[1], z), b = P(B[0], B[1], z); px.line(g, a[0], a[1], b[0], b[1], ln);
          for (let j = ((z / course) & 1) ? .25 : .75; j < 1; j += .5) { const q = [lerp(A[0], B[0], j), lerp(A[1], B[1], j)], p0 = P(q[0], q[1], z), p1 = P(q[0], q[1], Math.min(h, z + course)); px.line(g, p0[0], p0[1], p1[0], p1[1], ln); }
        }
        const b0 = P(A[0], A[1], nh + .6), b1 = P(B[0], B[1], nh + .6); px.line(g, b0[0], b0[1], b1[0], b1[1], shade(col, -.35));
      }
    }
    const top = [P(x0, y0, h), P(x1, y0, h), P(x1, y1, h), P(x0, y1, h)];
    px.poly(g, top, t.top);
    if (t.texture !== false && t.roof !== 'plain') { const tt = tones(t.top); scan(top, (xa, xb, y) => { for (let x = xa; x <= xb; x++) { const v = hash2(x * 3 + cx * 71, y * 5 + cy * 37); if (v < .08 || v > .96) { px.col(g, v < .08 ? tt.sh : tt.lt); g.fillRect(x, y, 1, 1); } } }); }
    const edge = t.edge || shade(t.top, .22);
    for (const [ax, ay, bx, by, nx, ny] of [[x0, y0, x1, y0, 0, -1], [x0, y1, x0, y0, -1, 0]]) {
      const nb = this.cell(cx + nx, cy + ny); if (nb > 0 && this.height(cx + nx, cy + ny) >= h) continue;
      const a = P(ax, ay, h), b = P(bx, by, h); px.line(g, a[0], a[1], b[0], b[1], edge);
    }
  }
}
E.TileMap = TileMap;
class FlowField {
  // new E.FlowField(map, { step: 2, climb: 0, drop: 0 }): paths over the tops a body can stand on (HEIGHTS)
  constructor(map, o = {}) {
    this.map = map; const n = map.w * map.h; this.d = new Int32Array(n); this._q = new Int32Array(n); this._tops = new Float64Array(n); this.tx = -1; this.ty = -1; this.version = -1;
    this.step = o.step === undefined ? HEIGHTS.step : o.step; this.climb = o.climb || 0; this.drop = o.drop || 0;
  }
  _top(cx, cy) {
    const m = this.map;
    if (m.types && m.height) { const c = m.cell(cx, cy); return c < 0 || (c === 0 && m.blocked && m.blocked[cy * m.w + cx]) ? NaN : c > 0 ? m.height(cx, cy) : 0; }
    return (m.walkable ? m.walkable(cx, cy) : !m.solidCell(cx, cy)) ? 0 : NaN;
  }
  _link(i, j) { const dz = this._tops[j] - this._tops[i]; return dz >= 0 ? dz <= Math.max(this.step, this.climb) : -dz <= Math.max(this.step, this.drop); }   // (NaN: false)
  update(x, y) {
    const m = this.map, T = m.T, W = m.w, H = m.h, tx = Math.floor(x / T), ty = Math.floor(y / T);
    if (tx === this.tx && ty === this.ty && m.version === this.version) return;
    this.tx = tx; this.ty = ty; this.version = m.version;
    const d = this.d, q = this._q, top = this._tops; d.fill(1e9);
    for (let cy = 0, i = 0; cy < H; cy++) for (let cx = 0; cx < W; cx++, i++) top[i] = this._top(cx, cy);
    if (tx < 0 || ty < 0 || tx >= W || ty >= H || Number.isNaN(top[ty * W + tx])) return;
    let h = 0, t = 0; d[ty * W + tx] = 0; q[t++] = ty * W + tx;
    while (h < t) {
      const i = q[h++], cx = i % W, cy = (i / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx; if (d[j] > d[i] + 1 && this._link(j, i)) { d[j] = d[i] + 1; q[t++] = j; }   // (from j an agent can step to i)
      }
    }
  }
  dir(x, y, fx, fy) {
    const m = this.map, T = m.T, W = m.w, cx = Math.floor(x / T), cy = Math.floor(y / T), i = cy * W + cx, here = cx >= 0 && cy >= 0 && cx < W && cy < m.h ? this.d[i] : 1e9;
    if (here === 0 || here >= 1e9) { const dx = fx - x, dy = fy - y, l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; }
    let best = here, bx = 0, by = 0;
    const can = (nx, ny) => nx >= 0 && ny >= 0 && nx < W && ny < m.h && this._link(i, ny * W + nx);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      if (dx && dy && (!can(cx + dx, cy) || !can(cx, cy + dy))) continue;
      const nx = cx + dx, ny = cy + dy; if (!can(nx, ny)) continue;
      const v = this.d[ny * W + nx] + (dx && dy ? .4 : 0); if (v < best) { best = v; bx = dx; by = dy; }
    }
    const tx = (cx + bx + .5) * T - x, ty = (cy + by + .5) * T - y, l = Math.hypot(tx, ty) || 1;
    return [tx / l, ty / l];
  }
}
E.FlowField = FlowField;
E.tex = {
  flagstone(x, y, pal, size = 16) {
    const row = Math.floor(y / size), off = (row & 1) * size / 2, col = Math.floor((x + off) / size), lx = x + off - col * size, ly = y - row * size;
    if (lx < 1 || ly < 1) return pal.mortar;
    const h = hash2(col, row); let c = pal.stones[(h * pal.stones.length) | 0];
    if (lx < 2 || ly < 2) c = pal.hi; else if (lx > size - 1.5 || ly > size - 1.5) c = pal.lo;
    const n = hash2(Math.floor(x * 1.3), Math.floor(y * 1.3)); if (n < .05) c = pal.speck;
    if (h > .93 && lx > 3 && lx < size - 3 && Math.abs(lx - ly * .7 - 3) < .6) c = pal.mortar;
    return c;
  },
  grass(x, y, o = {}) {
    const n = noise2(x * .07, y * .07) * .65 + noise2(x * .23, y * .23) * .35, blade = noise2(x * .9, y * .35);
    const fl = noise2(x * .12 + 40, y * .12 + 40), fh = hash2(Math.floor(x / 2), Math.floor(y / 2));
    if (fl > .82 && fh > .8) return hex(fh > .93 ? (o.flower || '#f4e27a') : (o.flower2 || '#f2f2f6'));
    if (n > .66 || (blade > .78 && n > .5)) return hex(o.dark || '#3e8a3a');
    if (n < .34 || blade < .16) return hex(o.light || '#6cc25a');
    return hex(o.base || '#55a94a');
  },
  dirt(x, y, o = {}) {
    const n = noise2(x * .1, y * .1) * .7 + noise2(x * .3, y * .3) * .3, peb = noise2(x * .45 + 9, y * .45 + 3);
    if (peb > .84) return hex(noise2(x * .45 + 9, (y - 1) * .45 + 3) > .84 ? (o.dark || '#6e4a2e') : (o.light || '#c9a276'));
    return hex(n > .62 ? (o.light || '#b08a5e') : n < .3 ? (o.dark || '#7d5838') : (o.base || '#9a7048'));
  },
  water(x, y, o = {}) {
    const w = Math.sin(x * .35 + Math.sin(y * .18) * 2.2 + y * .05);
    if (w > .93 && ((Math.floor(x) + Math.floor(y)) & 1)) return hex(o.light || '#9fe3ff');
    return hex(noise2(x * .05, y * .05) > .55 ? (o.base || '#2f7fd0') : (o.dark || '#2464b0'));
  },
  planks(x, y, o = {}) {
    const row = Math.floor(y / 6), ly = y - row * 6, len = 20 + Math.floor(hash2(row, 3) * 18), joint = (x + row * 13) % len;
    if (ly < 1 || joint < 1) return hex(o.line || '#4a2e1c');
    const g = hash2(Math.floor(x / 3), row); return hex(g > .7 ? (o.dark || '#8a5a34') : (o.base || '#9d6a3f'));
  },
  checker(x, y, o = {}) { const s = o.size || 16; return hex(((Math.floor(x / s) + Math.floor(y / s)) & 1) ? (o.a || '#d8d0e8') : (o.b || '#5a5270')); },
  plain(x, y, o = {}) { const c = hex(o.base || '#4a4458'), k = 1 + (Math.round((noise2(x * .15, y * .15) - .5) * 4) / 4) * (o.amount === undefined ? .14 : o.amount); return c.map(v => v * k); }
};

// ---- 13. PLATFORMMAP + PLATFORMER: side-scroller levels on the x/z plane (x right, z up, play plane y = 0) ----
//   kinds: solid oneway ladder slope hazard deco back. styles: block bonus brick ground plank spikes ladder liquid plain. A tilted yaw-0 view shows it as 2.5D
const PT_DEFAULT = { kind: 'solid', style: 'block', side: '#8a7a9a' };
const PT_STYLE_FOR_KIND = { oneway: 'plank', ladder: 'ladder', hazard: 'spikes', slope: 'ground' };
class PlatformMap {
  constructor(o = {}) {
    this.T = o.tile || 16; this.depth = o.depth === undefined ? this.T : o.depth;
    const L = o.rows ? parseLevel(o.rows, o.legend) : o.level;
    if (!L) throw new Error('PlatformMap needs { rows: [...], legend: {...}, types: {...} }');
    this.w = L.w; this.h = L.h; this.types = {};
    for (const k in (o.types || {})) { const t = Object.assign({ kind: 'solid' }, o.types[k]); t.style = t.style || PT_STYLE_FOR_KIND[t.kind] || 'block'; t.side = t.side || t.color || PT_DEFAULT.side; this.types[k] = t; }
    this.cells = new Array(this.w * this.h).fill(0);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) this.cells[(this.h - 1 - y) * this.w + x] = L.cells[y * this.w + x];
    for (const id of new Set(this.cells)) if (id > 0 && !this.types[id]) { warn('ptype:' + id, 'PlatformMap: tile type ' + id + ' is used but missing from types (using a plain solid block)'); this.types[id] = Object.assign({}, PT_DEFAULT); }
    this.spawns = L.spawns.map(sp => { const cz = this.h - 1 - sp.cy; return Object.assign(sp, { cz, x: (sp.cx + .5) * this.T, y: 0, z: cz * this.T }); });
    this.version = 0; this._bake = null; this.edges = o.edges || 'solid';
  }
  find(tag) { return this.spawns.find(s => s.tag === tag) || null; }
  findAll(tag) { return this.spawns.filter(s => s.tag === tag); }
  cell(cx, cz) { if (cx < 0 || cx >= this.w) return this.edges === 'open' ? 0 : -1; if (cz < 0 || cz >= this.h) return 0; return this.cells[cz * this.w + cx]; }
  kind(cx, cz) { const c = this.cell(cx, cz); return c < 0 ? 'solid' : c === 0 ? null : this.types[c].kind; }
  set(cx, cz, id) {
    if (cx < 0 || cz < 0 || cx >= this.w || cz >= this.h) return;
    if (id > 0 && !this.types[id]) this.types[id] = Object.assign({}, PT_DEFAULT);
    this.cells[cz * this.w + cx] = id; this.version++;
  }
  toCell(x, z) { return [Math.floor(x / this.T), Math.floor(z / this.T)]; }
  center(cx, cz) { return [(cx + .5) * this.T, (cz + .5) * this.T]; }
  kindAt(x, z) { return this.kind(Math.floor(x / this.T), Math.floor(z / this.T)); }
  solidAt(x, z) { return this.kindAt(x, z) === 'solid'; }
  get width() { return this.w * this.T; }
  get height() { return this.h * this.T; }
  groundBelow(x, z) {
    const T = this.T, cx = Math.floor(x / T);
    for (let cz = Math.min(this.h - 1, Math.floor((z + .5) / T)); cz >= 0; cz--) {
      const k = this.kind(cx, cz);
      if (k === 'slope') { const sz = this.slopeZ(cx, cz, x); if (sz <= z + .5) return sz; }
      else if ((k === 'solid' || k === 'oneway') && (cz + 1) * T <= z + .5) return (cz + 1) * T;
    }
    return null;
  }
  slopeZ(cx, cz, x) {
    const t = this.types[this.cell(cx, cz)] || {}, T = this.T, u = clamp((x - cx * T) / T, 0, 1);
    const a = t.from !== undefined ? t.from : (t.dir < 0 ? 1 : 0), b = t.to !== undefined ? t.to : (t.dir < 0 ? 0 : 1);
    return cz * T + lerp(a, b, u) * T;
  }
  _surfaceBelow(b, maxDrop) {
    const T = this.T, hw = b.w / 2 - .01, sc = Math.floor(b.x / T); let best = null;
    for (let cz = Math.floor((b.z + .01) / T); cz >= Math.floor((b.z - maxDrop) / T) - 1; cz--) {
      for (let cx = Math.floor((b.x - hw) / T); cx <= Math.floor((b.x + hw) / T); cx++) {
        const k = this.kind(cx, cz), top = (cz + 1) * T;
        let sz = null;
        if (k === 'slope') { if (cx === sc) sz = this.slopeZ(cx, cz, b.x); }
        else if (k === 'solid' || ((k === 'oneway') && !(b.drop > 0))) sz = top;
        if (sz !== null && sz <= b.z + .01 && sz >= b.z - maxDrop && (best === null || sz > best)) best = sz;
      }
    }
    return best;
  }
  cellsTouching(b, what) {
    const T = this.T, out = [], x0 = Math.floor((b.x - b.w / 2 + .01) / T), x1 = Math.floor((b.x + b.w / 2 - .01) / T), z0 = Math.floor((b.z + .01) / T), z1 = Math.floor((b.z + b.h - .01) / T);
    for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
      const id = this.cell(cx, cz); if (id <= 0) continue; const k = this.types[id].kind;
      if (what === undefined || what === k || what === id) out.push({ cx, cz, id, kind: k });
    }
    return out;
  }
  touching(b, what) { return this.cellsTouching(b, what).length > 0; }
  move(b, dt, solids) {
    const gr = b.ground, wasGround = !!b.onGround;
    if (gr && solids && solids.includes(gr)) { b.x += (gr.vx || 0) * dt; b.z += (gr.vz || 0) * dt; }
    b._grounded = wasGround;
    b.hitWall = 0; b.hitCeiling = false; b.bumped = null; b.onGround = false; b.onOneWay = false; b.ground = null;
    let dx = (b.vx || 0) * dt, dz = (b.vz || 0) * dt;
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / (this.T * .4)));
    dx /= n; dz /= n;
    for (let i = 0; i < n; i++) { if (dx && this._mx(b, dx, solids)) dx = 0; if (this._mz(b, dz, solids) && dz > 0) dz = 0; }
    if (!b.onGround && (b.vz || 0) <= 0) this._probe(b, solids);
    if (!b.onGround && wasGround && (b.vz || 0) <= 0 && !b.climbing) { const sz = this._surfaceBelow(b, Math.max(b.w / 2 + 3, Math.abs(b.vx || 0) * dt * 1.5 + 2)); if (sz !== null) { b.z = sz; b.vz = 0; b.onGround = true; } }
    return b;
  }
  _stands(k, cx, cz, prevZ, top, b) {
    if (k === 'solid') return true;
    if (b.drop > 0 || prevZ < top - .01) return false;
    if (k === 'oneway') return true;
    return k === 'ladder' && !b.climbing && this.kind(cx, cz + 1) !== 'ladder';
  }
  _mx(b, dx, solids) {
    const T = this.T, hw = b.w / 2; b.x += dx;
    const cx = Math.floor((dx > 0 ? b.x + hw : b.x - hw) / T);
    const blocked = () => { for (let cz = Math.floor((b.z + .01) / T); cz <= Math.floor((b.z + b.h - .01) / T); cz++) if (this.kind(cx, cz) === 'solid') return cz; return null; };
    let hit = blocked();
    if (hit !== null && b._grounded) {
      const top = (hit + 1) * T, up = top - b.z;
      if (up > 0 && up <= (b.stepUp === undefined ? 5 : b.stepUp)) { const oz = b.z; b.z = top; if (blocked() === null) hit = null; else b.z = oz; }
    }
    if (hit !== null) { b.x = dx > 0 ? cx * T - hw - .001 : (cx + 1) * T + hw + .001; b.vx = 0; b.hitWall = dx > 0 ? 1 : -1; return true; }
    if (solids) for (const s of solids) {
      if (s.oneway || s.solid === false || s === b) continue;
      if (Math.abs(b.x - s.x) * 2 < b.w + s.w && b.z < s.z + s.h - .01 && s.z < b.z + b.h - .01) { b.x = dx > 0 ? s.x - (s.w + b.w) / 2 - .001 : s.x + (s.w + b.w) / 2 + .001; b.vx = s.vx || 0; b.hitWall = dx > 0 ? 1 : -1; return true; }
    }
    return false;
  }
  _mz(b, dz, solids) {
    const T = this.T, prev = b.z; b.z += dz;
    const hw = b.w / 2 - .01, c0 = Math.floor((b.x - hw) / T), c1 = Math.floor((b.x + hw) / T);
    if (dz <= 0) {
      const cz = Math.floor(b.z / T), top = (cz + 1) * T, sc = Math.floor(b.x / T);
      for (const rz of [cz + 1, cz]) if (this.kind(sc, rz) === 'slope') {
        const sz = this.slopeZ(sc, rz, b.x);
        if (b.z <= sz && prev >= sz - T * .5) { b.z = sz; if (b.vz < 0) b.vz = 0; b.onGround = true; b.onOneWay = false; return true; }
      }
      let land = false, one = true;
      for (let cx = c0; cx <= c1; cx++) { const k = this.kind(cx, cz); if (k && this._stands(k, cx, cz, prev, top, b)) { land = true; if (k === 'solid') one = false; } }
      if (land) { b.z = top; if (b.vz < 0) b.vz = 0; b.onGround = true; b.onOneWay = one; return true; }
      if (solids) for (const s of solids) {
        if (s.solid === false || s === b) continue; const st = s.z + s.h;
        if (Math.abs(b.x - s.x) * 2 < b.w + s.w && b.z <= st && prev >= st - .01 - Math.max(0, -(s.vz || 0)) * .05 && !(s.oneway && b.drop > 0)) { b.z = st; if (b.vz < 0) b.vz = 0; b.onGround = true; b.onOneWay = !!s.oneway; b.ground = s; return true; }
      }
    } else {
      const head = b.z + b.h, cz = Math.floor(head / T);
      let best = null;
      for (let cx = c0; cx <= c1; cx++) if (this.kind(cx, cz) === 'solid') { const d = Math.abs((cx + .5) * T - b.x); if (!best || d < best.d) best = { cx, cz, id: this.cell(cx, cz), d }; }
      if (best) { b.z = cz * T - b.h - .001; b.vz = 0; b.hitCeiling = true; b.bumped = { cx: best.cx, cz: best.cz, id: best.id }; return true; }
      if (solids) for (const s of solids) {
        if (s.oneway || s.solid === false || s === b) continue;
        if (Math.abs(b.x - s.x) * 2 < b.w + s.w && head > s.z && prev + b.h <= s.z + .01) { b.z = s.z - b.h - .001; b.vz = 0; b.hitCeiling = true; return true; }
      }
    }
    return false;
  }
  _probe(b, solids) {
    const T = this.T, hw = b.w / 2 - .01, cz = Math.floor((b.z - .25) / T), top = (cz + 1) * T;
    const sc = Math.floor(b.x / T), zc = Math.floor((b.z - .01) / T);
    if (this.kind(sc, zc) === 'slope' && Math.abs(b.z - this.slopeZ(sc, zc, b.x)) < .5) { b.onGround = true; b.onOneWay = false; return; }
    if (Math.abs(b.z - top) < .3) for (let cx = Math.floor((b.x - hw) / T); cx <= Math.floor((b.x + hw) / T); cx++) { const k = this.kind(cx, cz); if (k && this._stands(k, cx, cz, b.z, top, b)) { b.onGround = true; b.onOneWay = k !== 'solid'; return; } }
    if (solids) for (const s of solids) if (s.solid !== false && s !== b && Math.abs(b.x - s.x) * 2 < b.w + s.w && Math.abs(b.z - (s.z + s.h)) < .3) { b.onGround = true; b.ground = s; b.onOneWay = !!s.oneway; return; }
  }
  bounds(view) {
    const W = this.w * this.T, H = this.h * this.T, d = this.depth / 2; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const x of [0, W]) for (const y of [-d, d]) for (const z of [0, H]) { const s = view.p(x, y, z); x0 = Math.min(x0, s[0]); x1 = Math.max(x1, s[0]); y0 = Math.min(y0, s[1]); y1 = Math.max(y1, s[1]); }
    return { x0, y0: y0 - 4, x1, y1: y1 + 4 };
  }
  draw(r) {
    const view = r.view, g = r.ctx;
    if (Math.abs(view.yawDeg % 360) > 1) warn('pmap:yaw', 'PlatformMap is drawn for views with yaw 0 (side, brawler, or a custom tilted side view); other views look wrong');
    const key = view.id + ':' + view.yawDeg + ':' + view.pitchDeg + ':' + view.scale + ':' + view.zBoost + ':' + this.version;
    if (!this._bake || this._bake.key !== key) this._bake = { key, chunks: new Map(), b: this.bounds(view) };
    const b = this._bake.b, CW = 128, x0 = Math.floor(b.x0), y0 = Math.floor(b.y0);
    const first = Math.max(0, Math.floor((r.ix - x0) / CW)), last = Math.floor((r.ix + r.bw - x0) / CW), maxC = Math.ceil((b.x1 - x0) / CW);
    for (let ci = first; ci <= Math.min(last, maxC); ci++) {
      let ch = this._bake.chunks.get(ci);
      if (!ch) { ch = this._bakeChunk(r, view, x0 + ci * CW, y0, CW, Math.ceil(b.y1 - y0) + 2); this._bake.chunks.set(ci, ch); }
      g.drawImage(ch, x0 + ci * CW - r.ix, y0 - r.iy);
    }
  }
  _bakeChunk(r, view, cx0, cy0, CW, CH) {
    const c = mkCanvas(CW, CH), g = ctx2d(c), T = this.T, sx = r.ix, sy = r.iy;
    r.ix = cx0; r.iy = cy0;
    try {
      const ax = Math.abs(view.ax) > .2 ? view.ax : 0;
      let a = 0, bnd = this.w - 1;
      if (ax) { const wa = cx0 / ax, wb = (cx0 + CW) / ax; a = Math.max(0, Math.floor(Math.min(wa, wb) / T) - 2); bnd = Math.min(this.w - 1, Math.ceil(Math.max(wa, wb) / T) + 2); }
      for (const pass of [0, 1]) for (let cz = 0; cz < this.h; cz++) for (let cx = a; cx <= bnd; cx++) {
        const id = this.cell(cx, cz); if (id <= 0) continue; const t = this.types[id];
        if ((t.kind === 'back') !== (pass === 0)) continue;
        this._tile(g, r, view, cx, cz, t);
      }
    } finally { r.ix = sx; r.iy = sy; }
    return c;
  }
  _tile(g, r, view, cx, cz, t) {
    const T = this.T, d = this.depth / 2, x0 = cx * T, x1 = x0 + T, z0 = cz * T, z1 = z0 + T, st = t.style, side = t.side;
    const back = t.kind === 'back', flat = back || t.kind === 'ladder' || t.kind === 'deco' || st === 'spikes';
    const yf = back ? -d : flat ? 0 : d, P = (x, y, z) => r.w(x, y, z);
    const above = this.cell(cx, cz + 1), aboveT = above > 0 ? this.types[above] : null, openTop = !aboveT || (aboveT.kind !== 'solid' && aboveT.kind !== 'back' && aboveT.kind !== 'slope');
    const col = back ? shade(side, -.38) : side, hi = shade(col, .28), lo = shade(col, -.32);
    const tl = P(x0, yf, z1), br = P(x1, yf, z0), X0 = Math.round(tl[0]), Y0 = Math.round(tl[1]), X1 = Math.round(br[0]), Y1 = Math.round(br[1]), W = X1 - X0, H = Y1 - Y0;
    if (W <= 0 || H <= 0) return;
    const topFace = (zt, c) => { if (view.pitchDeg > 1 && !flat) px.poly(g, [P(x0, -d, zt), P(x1, -d, zt), P(x1, d, zt), P(x0, d, zt)], c); };
    if (t.kind === 'slope') {
      const zl = this.slopeZ(cx, cz, x0), zr = this.slopeZ(cx, cz, x1), grass = t.top || (st === 'ground' ? '#5fbf4a' : hi);
      if (view.pitchDeg > 1) px.poly(g, [P(x0, -d, zl), P(x1, -d, zr), P(x1, d, zr), P(x0, d, zl)], grass);
      const a = P(x0, d, zl), b2 = P(x1, d, zr);
      px.poly(g, [P(x0, d, z0), P(x1, d, z0), b2, a], col);
      if (st === 'ground') { px.line(g, a[0], a[1] + 1, b2[0], b2[1] + 1, grass, 3); px.line(g, a[0], a[1], b2[0], b2[1], shade(grass, .3)); }
      else px.line(g, a[0], a[1], b2[0], b2[1], hi);
      return;
    }
    switch (st) {
      case 'plank': {
        const pz = Math.max(3, Math.round(4 * H / T)); topFace(z1, t.top || hi);
        px.rect(g, X0, Y0, W, pz, col); px.rect(g, X0, Y0, W, 1, hi); px.rect(g, X0, Y0 + pz - 1, W, 1, lo);
        px.rect(g, X0 + 2, Y0 + pz, 1, Math.max(1, Math.round(H * .25)), lo); px.rect(g, X1 - 3, Y0 + pz, 1, Math.max(1, Math.round(H * .25)), lo);
        return;
      }
      case 'spikes': {
        const n = 3, sw = W / n;
        for (let k = 0; k < n; k++) { const a = X0 + k * sw, m = a + sw / 2, e = a + sw; px.poly(g, [[a, Y1], [m, Y0 + H * .2], [e, Y1]], col); px.line(g, a, Y1 - 1, m, Y0 + H * .2, hi); }
        return;
      }
      case 'ladder': {
        const rw = Math.max(1, Math.round(W * .1)); px.rect(g, X0 + Math.round(W * .15), Y0, rw, H, col); px.rect(g, X1 - Math.round(W * .15) - rw, Y0, rw, H, col);
        for (let k = 0; k < 4; k++) px.rect(g, X0 + Math.round(W * .15), Y0 + Math.round((k + .5) * H / 4), W - 2 * Math.round(W * .15), 1, hi);
        return;
      }
      case 'liquid': {
        px.rect(g, X0, Y0, W, H, col);
        if (openTop) { px.rect(g, X0, Y0, W, 1, hi); for (let x = X0; x < X1; x++) if (((x + (cz & 1) * 2) & 3) === 0) px.dot(g, x, Y0 + 1, hi); }
        for (let y = Y0 + 3; y < Y1; y += 4) for (let x = X0 + ((y >> 2) & 1) * 2; x < X1; x += 5) px.dot(g, x, y, lo);
        return;
      }
    }
    topFace(z1, t.top || (st === 'ground' ? '#5fbf4a' : hi));
    px.rect(g, X0, Y0, W, H, col);
    const tt = tones(col), open = k2 => { const c2 = this.cell(k2[0], k2[1]); const t2 = c2 > 0 ? this.types[c2] : null; return !t2 || (t2.kind !== 'solid' && t2.kind !== 'back' && t2.kind !== 'slope') || c2 < 0; };
    const openB = open([cx, cz - 1]) && cz > 0, openL = open([cx - 1, cz]) && cx > 0, openR = open([cx + 1, cz]) && cx < this.w - 1;
    const wx0 = cx * W, wy0 = (this.h - cz) * H;
    if (st === 'brick') {
      const course = Math.max(3, Math.round((t.course || 8) / T * H)), bw = Math.max(4, Math.round(W / 2));
      for (let y = 0; y < H; y++) {
        const k = Math.floor((wy0 + y) / course), cy2 = (wy0 + y) % course, off = (k & 1) ? Math.round(bw / 2) : 0;
        for (let x = 0; x < W; x++) {
          const bx = Math.floor((wx0 + x + off) / bw), cxb = (wx0 + x + off) % bw, v = hash2(bx * 7 + 3, k * 13 + 1);
          let c = v < .25 ? tt.sh : v > .8 ? tt.lt : col;
          if (cy2 === 0 || cxb === 0) c = t.line || tt.deep; else if (cy2 === 1) c = v > .8 ? tt.hi : tt.lt; else if (cy2 === course - 1 || cxb === bw - 1) c = tt.sh;
          else if (hash2(wx0 + x, wy0 + y) < .05) c = tt.sh;
          if (c !== col) px.dot(g, X0 + x, Y0 + y, c);
        }
      }
    } else if (st === 'ground') {
      for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) {
        const X = wx0 + x - X0, Y = wy0 + y - Y0, n = noise2(X * .2, Y * .2) * .7 + noise2(X * .5, Y * .5) * .3, st = noise2(X * .42 + 5, Y * .42 + 11);
        if (st > .83) px.dot(g, x, y, noise2(X * .42 + 5, (Y - 1) * .42 + 11) > .83 ? tt.sh : tt.lt); else if (n > .64) px.dot(g, x, y, tt.sh); else if (n < .28) px.dot(g, x, y, tt.lt);
      }
      if (openTop) {
        const grass = t.top || '#5fbf4a', gt = tones(grass);
        for (let x = X0; x < X1; x++) { const L = 3 + (hash2(x, 11) > .6 ? 1 : 0) + (hash2(x, 23) > .9 ? 2 : 0); px.rect(g, x, Y0, 1, L, gt.base); px.dot(g, x, Y0 + L, gt.deep); if (hash2(x, 5) > .7) px.dot(g, x, Y0 + L - 1, gt.sh); if (hash2(x, 31) > .96) { px.dot(g, x, Y0 - 1, gt.lt); px.dot(g, x, Y0 - 2, t.flower || '#ffe070'); } }
        px.rect(g, X0, Y0, W, 1, gt.lt);
      }
    } else if (st !== 'plain') {
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const n = noise2((wx0 + x) * .3, (wy0 + y) * .3); if (n > .7) px.dot(g, X0 + x, Y0 + y, tt.sh); else if (n < .22) px.dot(g, X0 + x, Y0 + y, tt.lt); }
      px.rect(g, X0, Y0, W, 1, hi); px.rect(g, X0, Y0, 1, H, hi); px.rect(g, X0, Y1 - 1, W, 1, lo); px.rect(g, X1 - 1, Y0, 1, H, lo);
      if (st === 'bonus') { const sc = Math.max(1, Math.round(W / 12)); E.font.text(g, t.glyph || '?', X0 + W / 2, Y0 + Math.round(H / 2) - Math.round(3.5 * sc), t.glyphColor || '#fff4c8', { align: 'center', outline: lo, scale: sc }); }
      else { const q = Math.max(1, Math.round(W * .15)); for (const [qx, qy] of [[X0 + q, Y0 + q], [X1 - q - 1, Y0 + q], [X0 + q, Y1 - q - 1], [X1 - q - 1, Y1 - q - 1]]) px.dot(g, qx, qy, lo); }
    }
    if (st !== 'ground' && st !== 'plain') {
      if (openTop) px.rect(g, X0, Y0, W, 1, tt.hi);
      if (openB) { px.rect(g, X0, Y1 - 1, W, 1, tt.deep); px.rect(g, X0, Y1 - 2, W, 1, tt.sh); }
      if (openL) px.rect(g, X0, Y0, 1, H, tt.lt);
      if (openR) px.rect(g, X1 - 1, Y0, 1, H, tt.deep);
    } else if (openB) px.rect(g, X0, Y1 - 1, W, 1, tt.deep);
  }
}
E.PlatformMap = PlatformMap;
class Platformer {
  constructor(o = {}) {
    Object.assign(this, {
      x: 0, y: 0, z: 0, vx: 0, vz: 0, w: 8, h: 22,
      run: 95, accel: 900, decel: 1100, airAccel: 650, jump: 285, gravity: 800, fallGravity: 1150, maxFall: 330,
      cut: .45, coyote: .09, buffer: .13, climb: 70, airJumps: 0, wallJump: false, wallSlide: 70, dash: 0, dashTime: .22,
      facing: 1, onGround: false, climbing: false, jumped: false, landed: false, air: false, stun: 0, drop: 0, dashing: 0
    }, o);
    this._coy = 0; this._airJ = 0; this._cut = true; this._dashCD = 0;
  }
  knock(dir, speed = 130, up = 170, stun = .3) { this.vx = dir * speed; this.vz = up; this.stun = stun; this.climbing = false; this.dashing = 0; }
  rigState(extra) { return Object.assign({ x: this.x, y: this.y, z: this.z, vx: this.vx, vy: 0, vz: this.vz, facing: this.facing > 0 ? 0 : Math.PI, air: this.air && !this.climbing, climb: !!this.climbing, hurt: this.stun > 0, dash: this.dashing > 0 }, extra); }
  update(dt, level, ctl = {}, solids) {
    let ix, jumpHeld, jumpPressed, up, down, dashPressed, consume = () => {};
    if (ctl && typeof ctl.move === 'function') {
      ix = ctl.move()[0]; jumpHeld = ctl.down('jump'); jumpPressed = ctl.buffered('jump', this.buffer); up = ctl.down('up'); down = ctl.down('down');
      dashPressed = this.dash > 0 && !!ctl.map.dash && ctl.buffered('dash', .1); consume = a => ctl.consume(a);
    } else { ix = ctl.x || 0; jumpHeld = !!ctl.jump; jumpPressed = !!ctl.jumpPressed; up = !!ctl.up; down = !!ctl.down; dashPressed = !!ctl.dash; }
    if (Math.abs(ix) < .25) ix = 0;
    const wasGround = this.onGround; this.jumped = false; this.landed = false;
    this.stun -= dt; this.drop -= dt; this._dashCD -= dt;
    const ok = this.stun <= 0;
    const feet = { x: this.x, z: this.z - 3, w: 2, h: 3 }, body = { x: this.x, z: this.z, w: 2, h: this.h * .8 };
    const ladHere = level.touching(body, 'ladder'), ladBelow = level.touching(feet, 'ladder');
    if (!this.climbing && ok && ((up && ladHere) || (down && ladBelow && this.onGround))) {
      const lc = level.cellsTouching(up ? body : feet, 'ladder')[0]; this.climbing = true; this.x = (lc.cx + .5) * level.T; this.vx = 0; this.dashing = 0;
      if (down) this.z -= 2;
    }
    if (this.climbing) {
      this.vz = (up ? 1 : down ? -1 : 0) * this.climb; this.vx = 0;
      if (jumpPressed) { consume('jump'); this.climbing = false; if (ix) { this.vz = this.jump * .6; this.vx = ix * this.run; } }
      level.move(this, dt, solids);
      if (!level.touching({ x: this.x, z: this.z, w: 2, h: this.h }, 'ladder') || (this.onGround && down)) this.climbing = false;
    } else {
      if (dashPressed && ok && this._dashCD <= 0) { consume('dash'); this.dashing = this.dashTime; this._dashCD = this.dashTime + .15; this.vz = Math.max(0, this.vz); }
      if (this.dashing > 0) { this.dashing -= dt; this.vx = this.facing * this.dash; if (!this.onGround) this.vz = Math.max(this.vz, 0); }
      else {
        const target = ok ? ix * this.run : this.vx, turning = ix && this.vx && Math.sign(ix) !== Math.sign(this.vx);
        const a = this.onGround ? (ix ? (turning ? this.decel * 1.3 : this.accel) : this.decel) : this.airAccel;
        this.vx = ok ? approach(this.vx, target, a * dt) : approach(this.vx, 0, 300 * dt);
      }
      if (ix && ok && this.dashing <= 0) this.facing = ix > 0 ? 1 : -1;
      if (!(this.dashing > 0 && !this.onGround)) this.vz = Math.max(-this.maxFall, this.vz - (this.vz > 0 ? this.gravity : this.fallGravity) * dt);
      if (!jumpHeld && this.vz > 0 && !this._cut) { this.vz *= this.cut; this._cut = true; }
      if (this.onGround) { this._coy = this.coyote; this._airJ = this.airJumps; } else this._coy -= dt;
      const wall = this.wallJump && !this.onGround && this.hitWall;
      if (wall && this.vz < -this.wallSlide) this.vz = -this.wallSlide;
      if (jumpPressed && ok) {
        if (down && this.onGround && this.onOneWay) { consume('jump'); this.drop = .25; this.onGround = false; this._coy = 0; this._airJ = 0; }
        else if (this.onGround || this._coy > 0) { consume('jump'); this.vz = this.jump; this._coy = 0; this.jumped = true; this._cut = false; }
        else if (wall) { consume('jump'); this.vz = this.jump * .95; this.vx = -this.hitWall * this.run * 1.1; this.facing = -this.hitWall; this.stun = .12; this.jumped = true; this._cut = false; }
        else if (this._airJ > 0) { consume('jump'); this._airJ--; this.vz = this.jump * .9; this.jumped = true; this._cut = false; }
      }
      const pushing = this.hitWall;
      level.move(this, dt, solids);
      if (!this.hitWall && pushing && ix === pushing && !this.onGround) this.hitWall = pushing;
    }
    if (this.onGround && !wasGround) this.landed = true;
    this.air = !this.onGround && !this.climbing;
    return this;
  }
}
E.Platformer = Platformer;

// ---- 14. BODY, BULLETS, SPATIAL HASH ----
// Body: ground-plane physics (top-down, iso, brawler): velocity, friction, wall bounce, knockback, real jumps (z) onto lower blocks
class Body {
  constructor(o = {}) { Object.assign(this, { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 5, gravity: 700, friction: 0, bounce: 0, step: 2, onGround: true, groundZ: 0, hitWall: false, landed: false }, o); }
  push(ix, iy, iz = 0) { this.vx += ix; this.vy += iy; if (iz) { this.vz += iz; this.onGround = false; } return this; }
  jump(v = 220) { if (!this.onGround) return false; this.vz = v; this.onGround = false; return true; }
  update(dt, map) {
    this.landed = false; this.hitWall = false; this.bounced = false;
    if (this.friction) { const k = Math.exp(-this.friction * dt); this.vx *= k; this.vy *= k; }
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (map && map.collide) {
      const bx = this.x, by = this.y;
      if (map.collide(this)) {
        this.hitWall = true;
        const nx = this.x - bx, ny = this.y - by, l = Math.hypot(nx, ny);
        if (l > 1e-6) { const ux = nx / l, uy = ny / l, vn = this.vx * ux + this.vy * uy; if (vn < 0) { this.vx -= (1 + this.bounce) * vn * ux; this.vy -= (1 + this.bounce) * vn * uy; } }
      }
    }
    const ground = map && map.groundAt ? map.groundAt(this.x, this.y, this.r, this.z, this.step) : 0;
    if (this.onGround && this.z > ground + .5) this.onGround = false;
    if (this.onGround) { this.z = ground; this.vz = 0; }
    else {
      this.vz -= this.gravity * dt; this.z += this.vz * dt;
      if (this.z <= ground) {
        this.z = ground;
        if (this.bounce > 0 && this.vz < -80) { this.vz = -this.vz * this.bounce; this.bounced = true; }
        else { this.landed = true; this.vz = 0; this.onGround = true; }
      }
    }
    this.groundZ = ground;
    return this;
  }
}
E.Body = Body;
class Bullets {
  constructor(game, o = {}) { this._game = game; this.list = []; this.max = o.max || 800; this.plane = o.plane || 'ground'; this.sparks = o.sparks !== false; }
  fire(b) {
    if (this.list.length >= this.max) return null;
    const q = Object.assign({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 2, dmg: 1, life: 3, t: 0, team: 'player', color: '#ffe066', core: '#ffffff', pierce: false, grav: 0, dead: false }, b);
    this.list.push(q); return q;
  }
  burst(base, vels) { const out = []; for (const v of vels) out.push(this.fire(Object.assign({}, base, this.plane === 'side' ? { vx: v[0], vz: v[1] } : { vx: v[0], vy: v[1] }))); return out; }
  update(dt, map) {
    for (const b of this.list) {
      if (b.dead) continue;
      b.t += dt; if (b.t >= b.life) { b.dead = true; continue; }
      b.vz -= b.grav * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      if (map) {
        const wall = map instanceof PlatformMap ? map.solidAt(b.x, b.z) : (map.heightAt ? map.heightAt(b.x, b.y) > b.z : false);
        if (wall) { b.dead = true; if (this.sparks) this._game.particles.sparks(b.x, b.y, b.z, 3, null, { color: b.color }); if (b.onWall) b.onWall(b); }
      }
    }
    prune(this.list, b => b.dead);
  }
  hit(targets, fn, team) {
    let n = 0; const side = this.plane === 'side';
    for (const b of this.list) {
      if (b.dead || (team && b.team !== team)) continue;
      for (const t of targets) {
        if (!t || t.dead || t.alive === false || (b.pierce && b.hitSet && b.hitSet.has(t))) continue;
        const tr = t.r || (t.w ? t.w / 2 : 6), tz = side ? (t.z || 0) + (t.h ? t.h / 2 : 0) : null;
        const dx = b.x - t.x, dd = side ? b.z - tz : b.y - t.y, R = b.r + tr;
        if (dx * dx + dd * dd > R * R) continue;
        n++; fn(b, t);
        if (b.pierce) (b.hitSet || (b.hitSet = new Set())).add(t); else { b.dead = true; break; }
      }
    }
    prune(this.list, b => b.dead);
    return n;
  }
  clear(team) { if (team) prune(this.list, b => b.team === team); else this.list.length = 0; }
  draw(r) {
    const s = r.view.scale;
    for (const b of this.list) {
      if (b.sprite) { r.sprite(b.x, b.y, b.z, b.sprite, { anchor: 'center', flip: b.vx < 0 }); continue; }
      if (!r.visible(b.x, b.y, b.z, 12, 12, 12)) continue;
      r.queue(b.x, b.y, b.z, g => {
        const [x, y] = r.w(b.x, b.y, b.z), [tx, ty] = r.w(b.x - b.vx * .02, b.y - b.vy * .02, b.z - b.vz * .02), rad = Math.max(.6, b.r * s * .7);
        px.line(g, tx, ty, x, y, b.color, Math.max(1, Math.round(rad))); px.disc(g, x, y, rad, b.color); px.dot(g, x, y, b.core);
      }, { bias: .3 });
    }
  }
}
E.Bullets = Bullets;
E.pattern = {
  dir: (angle, speed) => [Math.cos(angle) * speed, Math.sin(angle) * speed],
  aim: (a, b, speed) => { const an = Math.atan2(b.y - a.y, b.x - a.x); return [Math.cos(an) * speed, Math.sin(an) * speed]; },
  aimSide: (a, b, speed) => { const an = Math.atan2((b.z || 0) - (a.z || 0), b.x - a.x); return [Math.cos(an) * speed, Math.sin(an) * speed]; },
  spread: (angle, n, arc, speed) => Array.from({ length: n }, (_, i) => { const a = angle + (n < 2 ? 0 : (i / (n - 1) - .5) * arc); return [Math.cos(a) * speed, Math.sin(a) * speed]; }),
  ring: (n, speed, offset = 0) => Array.from({ length: n }, (_, i) => { const a = offset + i / n * TAU; return [Math.cos(a) * speed, Math.sin(a) * speed]; })
};
class SpatialHash {
  constructor(cell = 32) { this.cell = cell; this._map = new Map(); }
  _k(cx, cy) { return (cx & 0xffff) * 65536 + (cy & 0xffff); }
  clear() { this._map.clear(); return this; }
  add(o, x = o.x, y = o.y) { const k = this._k(Math.floor(x / this.cell), Math.floor(y / this.cell)); let a = this._map.get(k); if (!a) this._map.set(k, a = []); a.push(o); return this; }
  build(list, xk = 'x', yk = 'y') { this.clear(); for (const o of list) if (o && !o.dead) this.add(o, o[xk], o[yk]); return this; }
  near(x, y, r, fn) {
    const C = this.cell;
    for (let cy = Math.floor((y - r) / C); cy <= Math.floor((y + r) / C); cy++) for (let cx = Math.floor((x - r) / C); cx <= Math.floor((x + r) / C); cx++) {
      const a = this._map.get(this._k(cx, cy)); if (a) for (const o of a) fn(o);
    }
  }
  query(x, y, r) { const out = []; this.near(x, y, r, o => out.push(o)); return out; }
}
E.SpatialHash = SpatialHash;

// ---- 15. AUDIO: chip synth (no sound files). Voice: { wave: square|pulse|pulse12|triangle|saw|sine|noise, freq, to, dur, vol, arp, step, vib: [rate, depth], filter, delay }
//   music tracks: one token per step: C4 F#3 Bb2 = note, '-' holds, '.' rests, '|' ignored; drums k s h o c t
const NOTE_RE = /^([A-Ga-g])([#b]?)(-?\d)$/, SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function noteFreq(n) {
  if (typeof n === 'number') return n;
  const m = NOTE_RE.exec(String(n).trim()); if (!m) return 0;
  const s = SEMI[m[1].toUpperCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (+m[3] + 1) * 12;
  return 440 * Math.pow(2, (s - 69) / 12);
}
E.note = noteFreq;
const SFX = {
  jump: { wave: 'pulse', freq: 280, to: 640, dur: .14, vol: .3 },
  jump2: { wave: 'pulse', freq: 420, to: 900, dur: .12, vol: .26 },
  land: { wave: 'noise', freq: 500, to: 150, dur: .07, vol: .25, filter: 'lowpass' },
  step: { wave: 'noise', freq: 3000, dur: .03, vol: .07, filter: 'highpass' },
  coin: { wave: 'square', freq: 988, arp: [0, 5], step: .07, dur: .32, vol: .26 },
  pickup: { wave: 'triangle', freq: 880, to: 1760, dur: .09, vol: .4 },
  key: { wave: 'square', freq: 1047, arp: [0, 4, 7, 12], step: .045, dur: .22, vol: .24 },
  powerup: { wave: 'square', freq: 523, arp: [0, 4, 7, 12, 16, 19, 24], step: .05, dur: .4, vol: .26 },
  oneup: { wave: 'square', freq: 659, arp: [0, 3, 12, 8, 10, 15], step: .08, dur: .5, vol: .26 },
  heal: { wave: 'triangle', freq: 523, arp: [0, 7, 12, 19], step: .06, dur: .3, vol: .4 },
  hit: [{ wave: 'noise', freq: 1600, to: 500, dur: .12, vol: .45 }, { wave: 'square', freq: 180, to: 60, dur: .1, vol: .25 }],
  hurt: { wave: 'square', freq: 520, to: 120, dur: .28, vol: .3, vib: [30, .05] },
  stomp: { wave: 'square', freq: 400, to: 820, dur: .08, vol: .28 },
  bump: { wave: 'triangle', freq: 150, to: 90, dur: .08, vol: .45 },
  swing: { wave: 'noise', freq: 2400, to: 700, dur: .12, vol: .2 },
  whoosh: { wave: 'noise', freq: 1600, to: 400, dur: .16, vol: .18 },
  punch: [{ wave: 'noise', freq: 900, to: 300, dur: .08, vol: .45, filter: 'lowpass' }, { wave: 'sine', freq: 140, to: 60, dur: .09, vol: .5 }],
  kick: [{ wave: 'noise', freq: 600, to: 200, dur: .11, vol: .45, filter: 'lowpass' }, { wave: 'sine', freq: 110, to: 45, dur: .12, vol: .55 }],
  shoot: { wave: 'pulse12', freq: 900, to: 260, dur: .1, vol: .2 },
  laser: { wave: 'saw', freq: 1500, to: 280, dur: .18, vol: .18 },
  charge: { wave: 'saw', freq: 200, to: 900, dur: .6, vol: .12 },
  explode: { wave: 'noise', freq: 900, to: 60, dur: .6, vol: .55, filter: 'lowpass' },
  boom: [{ wave: 'noise', freq: 600, to: 40, dur: 1.1, vol: .6, filter: 'lowpass' }, { wave: 'sine', freq: 90, to: 30, dur: .8, vol: .55 }],
  door: [{ wave: 'square', freq: 196, to: 98, dur: .22, vol: .22 }, { wave: 'noise', freq: 800, dur: .15, vol: .18 }],
  secret: { wave: 'square', freq: 784, arp: [0, 5, 9, 14, 12, 17, 21, 24], step: .08, dur: .7, vol: .22 },
  warp: { wave: 'sine', freq: 200, to: 1200, dur: .5, vol: .28, vib: [12, .1] },
  die: { wave: 'square', freq: 523, arp: [7, 4, 0, -5, -12], step: .12, dur: .7, vol: .26 },
  select: { wave: 'square', freq: 660, dur: .045, vol: .18 },
  confirm: { wave: 'square', freq: 784, arp: [0, 7, 12], step: .05, dur: .16, vol: .22 },
  cancel: { wave: 'square', freq: 440, to: 220, dur: .12, vol: .2 },
  pause: { wave: 'square', freq: 988, arp: [0, 12, 0, 12], step: .05, dur: .22, vol: .18 },
  text: { wave: 'square', freq: 820, dur: .018, vol: .06 },
  blip: { wave: 'square', freq: 1200, dur: .025, vol: .1 }
};
const DRUMS = {
  k: [{ wave: 'sine', freq: 150, to: 42, dur: .14, vol: .7 }],
  s: [{ wave: 'noise', freq: 1800, dur: .12, vol: .38 }, { wave: 'triangle', freq: 220, to: 130, dur: .06, vol: .3 }],
  h: [{ wave: 'noise', freq: 7500, dur: .035, vol: .14, filter: 'highpass' }],
  o: [{ wave: 'noise', freq: 6500, dur: .2, vol: .13, filter: 'highpass' }],
  c: [{ wave: 'noise', freq: 4500, dur: .7, vol: .18, filter: 'highpass' }],
  t: [{ wave: 'triangle', freq: 180, to: 90, dur: .16, vol: .45 }]
};
class ChipAudio {
  constructor(game, signal) {
    this._game = game; this._signal = signal; this.ctx = null; this.volume = .7; this.sfxVolume = 1; this.musicVolume = .5; this.muted = false;
    this.presets = Object.assign({}, SFX); this._last = {}; this.song = null; this.failed = null; this._ducked = false; this.ducked = false; this._waves = {};
    // sound draws its own random numbers (noise, pitch variation): whether sound is on, muted or not yet unlocked by a tap
    // never shifts the game's Math.random, so the same seed and inputs play the same game with or without it
    this._rnd = rng(0x51A7E);
  }
  _init() {
    if (this.ctx || this.failed) return this.ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) throw new Error('Web Audio is not available');
      const c = this.ctx = new AC();
      this._master = c.createGain(); this._master.connect(c.destination);
      this._sfxBus = c.createGain(); this._sfxBus.connect(this._master);
      this._musBus = c.createGain(); this._musBus.connect(this._master);
      this._levels();
      const nb = c.createBuffer(1, c.sampleRate, c.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = this._rnd() * 2 - 1;
      this._noise = nb;
      const resume = () => { if (c.state !== 'running') c.resume().catch(() => {}); };
      for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, resume, { capture: true, signal: this._signal });
      resume();
    } catch (e) { this.failed = e.message || String(e); warn('audio', 'sound is off: ' + this.failed); }
    return this.ctx;
  }
  get ready() { return !!this.ctx && this.ctx.state === 'running'; }
  _levels() { if (!this.ctx) return; this._master.gain.value = this.muted ? 0 : this.volume; this._sfxBus.gain.value = this.sfxVolume; this._musBus.gain.value = this.musicVolume * (this._ducked || this.ducked ? .35 : 1); }
  setVolume(v) { this.volume = clamp(v, 0, 1); this._levels(); }
  mute(on = !this.muted) { this.muted = on; this._levels(); return on; }
  // quiet the music (to 35%) under a game's own pause or map screen; the engine also ducks it while game.paused
  duck(on = true) { on = !!on; if (this.ducked === on) return; this.ducked = on; this._levels(); }
  _background(sleep) { const c = this.ctx; if (!c) return; try { if (sleep && c.state === 'running') { this._slept = true; c.suspend().catch(() => {}); } else if (!sleep && this._slept) { this._slept = false; c.resume().catch(() => {}); } } catch (e) { /* closed */ } }   // a hidden page's sound sleeps
  _duck(on) { if (this._ducked === on) return; this._ducked = on; this._levels(); }
  _pulse(duty) {
    if (this._waves[duty]) return this._waves[duty];
    const N = 40, re = new Float32Array(N), im = new Float32Array(N);
    for (let n = 1; n < N; n++) { const a = 2 / (n * Math.PI) * Math.sin(n * Math.PI * duty); re[n] = a * Math.cos(n * Math.PI * duty); im[n] = a * Math.sin(n * Math.PI * duty); }
    return (this._waves[duty] = this.ctx.createPeriodicWave(re, im));
  }
  _voice(p, bus, t0, mul = 1) {
    const c = this.ctx, wave = p.wave || 'square', dur = Math.max(.012, p.dur || .15), vol = p.vol === undefined ? .3 : p.vol, att = p.attack === undefined ? .004 : p.attack;
    const t = t0 + (p.delay || 0), end = t + dur, f0 = Math.max(20, noteFreq(p.freq || 440) * mul), to = p.to ? Math.max(20, noteFreq(p.to) * mul) : 0;
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + att);
    if (p.hold) { g.gain.setValueAtTime(vol, Math.max(t + att, end - .03)); g.gain.linearRampToValueAtTime(0, end); }
    else g.gain.exponentialRampToValueAtTime(.0005, end);
    let src;
    if (wave === 'noise') {
      src = c.createBufferSource(); src.buffer = this._noise; src.loop = true;
      const f = c.createBiquadFilter(); f.type = p.filter || 'bandpass'; f.Q.value = p.q || 1.1; f.frequency.setValueAtTime(f0, t); if (to) f.frequency.exponentialRampToValueAtTime(to, end);
      src.connect(f); f.connect(g); src.start(t, Math.random() * .5);
    } else {
      src = c.createOscillator();
      if (wave === 'pulse' || wave === 'pulse12') src.setPeriodicWave(this._pulse(wave === 'pulse' ? .25 : .125));
      else src.type = wave === 'saw' ? 'sawtooth' : ['square', 'triangle', 'sine', 'sawtooth'].includes(wave) ? wave : 'square';
      src.frequency.setValueAtTime(f0, t);
      if (to) src.frequency.exponentialRampToValueAtTime(to, end);
      if (p.arp) { const st = p.step || .06; for (let k = 0, tt = t; tt < end; tt += st, k++) src.frequency.setValueAtTime(f0 * Math.pow(2, p.arp[p.loop ? k % p.arp.length : Math.min(k, p.arp.length - 1)] / 12), tt); }
      if (p.vib) { const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = p.vib[0]; lg.gain.value = f0 * p.vib[1]; lfo.connect(lg); lg.connect(src.frequency); lfo.start(t); lfo.stop(end + .05); }
      src.connect(g); src.start(t);
    }
    g.connect(bus); src.stop(end + .05);
  }
  sfx(what, o = {}) {
    if (!this._init() || this.muted) return;
    const p = typeof what === 'string' ? this.presets[what] : what;
    if (!p) { warn('sfx:' + what, 'unknown sound "' + what + '". Presets: ' + Object.keys(this.presets).join(', ') + ' (or audio.define(name, voice))'); return; }
    if (this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (typeof what === 'string') { if (now - (this._last[what] === undefined ? -1 : this._last[what]) < .035) return; this._last[what] = now; }
    const mul = (o.pitch || 1) * (1 + (o.vary === undefined ? .03 : o.vary) * (this._rnd() * 2 - 1));
    try { for (const v of Array.isArray(p) ? p : [p]) this._voice(o.vol === undefined ? v : Object.assign({}, v, { vol: (v.vol === undefined ? .3 : v.vol) * o.vol }), this._sfxBus, now + .005, mul); }
    catch (e) { warn('sfx-fail:' + what, 'could not play sound "' + what + '": ' + e.message); }
  }
  define(name, voice) { this.presets[name] = voice; }
  music(song, o = {}) {
    if (typeof song === 'string') { const s = E.songs[song]; if (!s) { warn('song:' + song, 'unknown song "' + song + '". Built in: ' + Object.keys(E.songs).join(', ')); return; } song = s; }
    if (!song) { this.stopMusic(); return; }
    if (!this._init()) return;
    if (this.song && this.song.src === song) return;
    this.stopMusic();
    const tracks = (song.tracks || []).map(t => Object.assign({}, t, { tokens: String(t.notes || '').replace(/\|/g, ' ').trim().split(/\s+/).filter(Boolean) })).filter(t => t.tokens.length);
    if (!tracks.length) { warn('music:empty', 'music(song) needs song.tracks with notes'); return; }
    const bus = this.ctx.createGain(); bus.connect(this._musBus);
    this.song = { src: song, tracks, spb: 60 / (song.bpm || 120) / (song.steps || 4), step: 0, next: 0, len: Math.max(...tracks.map(t => t.tokens.length)), loop: o.loop !== undefined ? o.loop : song.loop !== false, bus };
    this._timer = setInterval(() => { try { this._schedule(); } catch (e) { warn('music-fail', 'music stopped: ' + e.message); this.stopMusic(); } }, 25);
  }
  stopMusic() {
    if (this._timer) clearInterval(this._timer); this._timer = null;
    const S = this.song; this.song = null;
    if (S && this.ctx) { const t = this.ctx.currentTime; S.bus.gain.setValueAtTime(S.bus.gain.value, t); S.bus.gain.linearRampToValueAtTime(0, t + .06); setTimeout(() => { try { S.bus.disconnect(); } catch (e) {  } }, 300); }
  }
  _schedule() {
    const S = this.song, c = this.ctx; if (!S || !c) return;
    if (c.state !== 'running') { S.next = 0; return; }
    if (!S.next || S.next < c.currentTime - .2) S.next = c.currentTime + .05;
    while (S.next < c.currentTime + .12) {
      if (S.step >= S.len && !S.loop) { const end = S.next; setTimeout(() => { if (this.song === S) this.stopMusic(); }, Math.max(0, (end - c.currentTime) * 1000 + 400)); S.next = 1e9; return; }
      const pos = S.step % S.len;
      for (const t of S.tracks) this._note(t, pos % t.tokens.length, S.next, S.spb, S.bus);
      S.step++; S.next += S.spb;
    }
  }
  _note(t, i, time, spb, bus) {
    const tok = t.tokens[i]; if (tok === '.' || tok === '-' || tok === '_') return;
    const vol = t.vol === undefined ? .18 : t.vol;
    if (t.wave === 'drums' || t.wave === 'noise') {
      const kit = DRUMS[tok[0].toLowerCase()]; if (!kit) { warn('drum:' + tok, 'music: drum token "' + tok + '" is unknown (k s h o c t or .)'); return; }
      for (const v of kit) this._voice(Object.assign({}, v, { vol: v.vol * vol / .18 }), bus, time);
      return;
    }
    let n = 1; while (i + n < t.tokens.length && t.tokens[i + n] === '-') n++;
    const f = noteFreq(tok); if (!f) { warn('note:' + tok, 'music: "' + tok + '" is not a note (use C4, F#3, Bb2, "." for rest, "-" to hold)'); return; }
    this._voice({ wave: t.wave || 'square', freq: f * Math.pow(2, t.octave || 0), dur: n * spb * (t.gate || .9), vol, hold: true, attack: .006, vib: t.vib }, bus, time);
  }
}
E.songs = {
  title: { bpm: 112, steps: 4, tracks: [
    { wave: 'square', vol: .16, notes: 'C5 - - - G4 - C5 - E5 - - - D5 - C5 - | D5 - - - G4 - B4 - D5 - - - F5 - E5 - | E5 - - - C5 - E5 - G5 - - - A5 - G5 - | F5 - E5 - D5 - B4 - C5 - - - - - . .' },
    { wave: 'triangle', vol: .3, notes: 'C3 - . C3 G2 - . G2 C3 - . C3 G2 - . G2 | G2 - . G2 D3 - . D3 G2 - . G2 D3 - . D3 | A2 - . A2 E3 - . E3 A2 - . A2 E3 - . E3 | F2 - . F2 G2 - . G2 C3 - . C3 G2 - . .' },
    { wave: 'drums', vol: .14, notes: 'k . h . s . h . k . h k s . h .' } ] },
  adventure: { bpm: 138, steps: 4, tracks: [
    { wave: 'pulse', vol: .15, notes: 'E5 - G5 - A5 - - C6 B5 - A5 - G5 - E5 - | D5 - E5 - G5 - - A5 G5 - E5 - D5 - . . | E5 - G5 - A5 - - C6 D6 - C6 - A5 - G5 - | A5 - G5 - E5 - D5 - C5 - - - - - . .' },
    { wave: 'square', vol: .07, notes: 'C5 . E5 . G5 . E5 . C5 . E5 . G5 . E5 . | B4 . D5 . G5 . D5 . B4 . D5 . G5 . D5 . | A4 . C5 . E5 . C5 . A4 . C5 . E5 . C5 . | F4 . A4 . C5 . A4 . G4 . B4 . D5 . B4 .' },
    { wave: 'triangle', vol: .32, notes: 'C3 . C4 . C3 . C4 . C3 . C4 . C3 . C4 . | G2 . G3 . G2 . G3 . G2 . G3 . G2 . G3 . | A2 . A3 . A2 . A3 . A2 . A3 . A2 . A3 . | F2 . F3 . F2 . F3 . G2 . G3 . G2 . G3 .' },
    { wave: 'drums', vol: .15, notes: 'k . h . s . h h k . h . s . h o' } ] },
  dungeon: { bpm: 96, steps: 4, tracks: [
    { wave: 'pulse12', vol: .13, notes: 'A4 - - - C5 - B4 - A4 - - - E4 - - - | F4 - - - A4 - G4 - E4 - - - - - . . | A4 - - - C5 - D5 - E5 - - - D5 - C5 - | B4 - - - G#4 - - - A4 - - - - - . .' },
    { wave: 'triangle', vol: .32, notes: 'A2 - . . A2 . . . E2 - . . A2 . . . | F2 - . . F2 . . . E2 - . . E2 . . . | A2 - . . A2 . . . G2 - . . G2 . . . | E2 - . . E2 . . . A2 - . . A2 . . .' },
    { wave: 'drums', vol: .1, notes: 'k . . . h . . . k . k . h . . .' } ] },
  boss: { bpm: 164, steps: 4, tracks: [
    { wave: 'saw', vol: .09, notes: 'D5 D5 . D5 F5 - D5 . D5 D5 . D5 A5 - F5 . | C5 C5 . C5 E5 - C5 . C5 C5 . C5 G5 - E5 . | Bb4 Bb4 . Bb4 D5 - F5 - Bb4 Bb4 . Bb4 F5 - D5 - | A4 - C#5 - E5 - A5 - G5 - E5 - C#5 - A4 -' },
    { wave: 'square', vol: .09, notes: 'D4 . D4 . D4 . D4 . D4 . D4 . D4 . D4 . | C4 . C4 . C4 . C4 . C4 . C4 . C4 . C4 . | Bb3 . Bb3 . Bb3 . Bb3 . Bb3 . Bb3 . Bb3 . Bb3 . | A3 . A3 . A3 . A3 . A3 . A3 . C#4 . C#4 .' },
    { wave: 'triangle', vol: .32, notes: 'D2 D3 D2 D3 D2 D3 D2 D3 D2 D3 D2 D3 D2 D3 D2 D3 | C2 C3 C2 C3 C2 C3 C2 C3 C2 C3 C2 C3 C2 C3 C2 C3 | Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 | A1 A2 A1 A2 A1 A2 A1 A2 A1 A2 A1 A2 C#2 C#3 C#2 C#3' },
    { wave: 'drums', vol: .16, notes: 'k h s h k k s h k h s h k s s s' } ] },
  victory: { bpm: 150, steps: 4, loop: false, tracks: [
    { wave: 'square', vol: .17, notes: 'G4 . C5 . E5 . G5 - - - E5 - G5 - - - A5 - G5 - E5 - F5 - G5 - - - - - . .' },
    { wave: 'triangle', vol: .3, notes: 'C3 . C3 . C3 . C3 - - - C3 - C3 - - - F2 - F2 - C3 - G2 - C3 - - - - - . .' } ] }
};

// ---- 16. UI: window boxes, bars, hearts, typewriter Dialog, Menu (draw them in r.overlay: screen pixels, on top) ----
let _hearts = null;
const heartSprites = () => _hearts || (_hearts = {
  full: sprite(['.RR.RR.', 'RWRRRRR', 'RRRRRRR', '.RRRRR.', '..RRR..', '...R...'], { R: '#e8384a', W: '#ffd0d6' }),
  half: sprite(['.RR.DD.', 'RWRDDDD', 'RRRDDDD', '.RRDDD.', '..RDD..', '...D...'], { R: '#e8384a', W: '#ffd0d6', D: '#3a1826' }),
  empty: sprite(['.DD.DD.', 'DDDDDDD', 'DDDDDDD', '.DDDDD.', '..DDD..', '...D...'], { D: '#3a1826' })
});
E.ui = {
  box(g, x, y, w, h, o = {}) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    const bg = o.bg || '#141a3a', bd = o.border || '#e8e4ff', sh = o.shadow === undefined ? '#05040a' : o.shadow;
    if (o.alpha !== undefined && o.alpha < 1) {
      const c0 = Array.isArray(bg) ? bg[0] : bg, c1 = Array.isArray(bg) ? bg[bg.length - 1] : shade(bg, -.3);
      px.blend(g, o.alpha, 'normal', () => { for (let i = 1; i < h - 1; i++) px.rect(g, x + 1, y + i, w - 2, 1, mix(c0, c1, Math.round((i - 1) / Math.max(1, h - 3) * 7) / 7)); });
      px.rect(g, x + 1, y, w - 2, 1, bd); px.rect(g, x + 1, y + h - 1, w - 2, 1, bd); px.rect(g, x, y + 1, 1, h - 2, bd); px.rect(g, x + w - 1, y + 1, 1, h - 2, bd);
      return;
    }
    const flat = !Array.isArray(bg) && o.gradient === false, c0 = Array.isArray(bg) ? bg[0] : flat ? bg : shade(bg, .16), c1 = Array.isArray(bg) ? bg[bg.length - 1] : flat ? bg : shade(bg, -.3);
    if (sh) { px.rect(g, x + 2, y + 2, w, h, sh); }
    px.rect(g, x + 1, y, w - 2, h, bd); px.rect(g, x, y + 1, w, h - 2, bd);
    if (flat) { px.rect(g, x + 2, y + 1, w - 4, h - 2, bg); px.rect(g, x + 1, y + 2, w - 2, h - 4, bg); }
    else {
      const bands = []; for (let k = 0; k < 8; k++) bands.push(mix(c0, c1, k / 7));
      for (let i = 1; i < h - 1; i++) { const c = bands[Math.round((i - 1) / Math.max(1, h - 3) * 7)], edge = i === 1 || i === h - 2; px.rect(g, x + (edge ? 2 : 1), y + i, w - (edge ? 4 : 2), 1, c); }
      px.rect(g, x + 2, y + h - 2, w - 4, 1, shade(c1, -.25));
    }
    px.rect(g, x + 2, y + 2, w - 4, 1, shade(c0, .15));
  },
  bar(g, x, y, w, h, frac, color = '#e0463c', o = {}) {
    const f = Math.round((w - 2) * clamp(frac, 0, 1));
    px.rect(g, x, y, w, h, o.border || '#140b12'); px.rect(g, x + 1, y + 1, w - 2, h - 2, o.bg || '#3a1a26');
    if (f > 0) { px.rect(g, x + 1, y + 1, f, h - 2, color); px.rect(g, x + 1, y + 1, f, 1, shade(color, .35)); }
  },
  hearts(g, x, y, hp, max, o = {}) {
    const H = heartSprites(), per = o.perRow || 10;
    for (let i = 0; i < Math.ceil(max); i++) { const v = hp - i, s = v >= 1 ? H.full : v >= .5 ? H.half : H.empty; px.sprite(g, s, x + (i % per) * 8, y + Math.floor(i / per) * 7); }
  },
  counter(g, x, y, label, value, color = '#ffffff', o = {}) { return E.font.text(g, label + ' ' + value, x, y, color, o); }
};
class Dialog {
  constructor(game, o = {}) {
    this.game = game;
    Object.assign(this, { speed: 50, lines: 3, place: 'bottom', color: '#ffffff', nameColor: '#ffd36a', voice: 'text', bg: '#141a3a', border: '#e8e4ff' }, o);
    this.open = false; this.pages = []; this.i = 0; this.shown = 0; this.choice = 0;
  }
  _dims() {
    const W = this.game.W, H = this.game.H, lh = E.font.lineHeight(), w = Math.min(W - 12, 320), P = this.portrait ? this._pSize : 0, h = Math.max(this.lines * lh + 9, P ? P + 8 : 0), tx = P ? P + 12 : 7;
    const pl = this._place || this.place, y = this._y !== undefined ? this._y : pl === 'top' ? 12 : pl === 'middle' ? Math.round((H - h) / 2) : H - h - 6;
    return { x: Math.round((W - w) / 2), y, w, h, lh, tx, P };
  }
  say(text, o = {}) {
    this.portrait = typeof o.portrait === 'function' ? o.portrait : null; this._pSize = o.portraitSize || 40;
    this._place = o.place; this._y = o.y; this._alpha = o.alpha;
    const d = this._dims(), pages = [];
    for (const t of Array.isArray(text) ? text : [text]) { const L = E.font.wrap(String(t), d.w - d.tx - 5); for (let k = 0; k < L.length; k += this.lines) pages.push(L.slice(k, k + this.lines)); }
    this.pages = pages.length ? pages : [['']]; this.i = 0; this.shown = 0; this.open = true; this.choice = 0;
    this.name = o.name || null; this.onDone = o.onDone || null; this.choices = o.choices || null; this.onChoice = o.onChoice || null; this._blip = 0;
    this.auto = o.auto || 0; this.modal = o.modal !== false; this._wait = 0;
    return this;
  }
  close() { this.open = false; this.game.input.consumeAll(); }
  get _page() { return this.pages[this.i] || []; }
  get pageLen() { return this._page.reduce((a, l) => a + l.length, 0); }
  get typing() { return this.shown < this.pageLen; }
  update(dt) {
    if (!this.open) return false;
    const inp = this.game.input, len = this.pageLen, prev = Math.floor(this.shown);
    this.shown = Math.min(len, this.shown + this.speed * dt);
    if (this.voice && Math.floor(this.shown) > prev && (this._blip++ % 2 === 0)) this.game.audio.sfx(this.voice);
    const last = this.i >= this.pages.length - 1, asking = last && this.choices && !this.typing;
    if (this.auto && !this.choices && !this.typing && (this._wait += dt) >= this.auto) {
      this._wait = 0;
      if (last) { this.open = false; if (this.onDone) this.onDone(); } else { this.i++; this.shown = 0; }
      return this.modal && this.open;
    }
    if (!this.modal) return false;
    if (asking) {
      if (inp.repeat('up') || inp.repeat('left')) { this.choice = (this.choice + this.choices.length - 1) % this.choices.length; this.game.audio.sfx('select'); }
      if (inp.repeat('down') || inp.repeat('right')) { this.choice = (this.choice + 1) % this.choices.length; this.game.audio.sfx('select'); }
    }
    if (inp.pressed('confirm')) {
      if (this.typing) this.shown = len;
      else if (!last) { this.i++; this.shown = 0; }
      else { this.close(); this.game.audio.sfx('confirm'); if (this.choices && this.onChoice) this.onChoice(this.choice, this.choices[this.choice]); if (this.onDone) this.onDone(); }
    } else if (asking && inp.pressed('cancel')) { this.choice = this.choices.length - 1; }
    return true;
  }
  draw(r) {
    if (!this.open) return;
    r.overlay(g => {
      const d = this._dims(), ui = E.ui;
      ui.box(g, d.x, d.y, d.w, d.h, { bg: this.bg, border: this.border, alpha: this._alpha });
      if (this.portrait) this.portrait(g, d.x + 5, d.y + Math.round((d.h - d.P) / 2), d.P);
      if (this.name) { const nw = E.font.width(this.name) + 12, nx = d.x + (this.portrait ? d.tx - 6 : 4); ui.box(g, nx, d.y - 12, nw, 14, { bg: this.bg, border: this.border }); E.font.text(g, this.name, nx + 6, d.y - 9, this.nameColor, { outline: false, shadow: '#05040a' }); }
      let left = Math.floor(this.shown);
      this._page.forEach((line, k) => { const s = line.slice(0, Math.max(0, left)); left -= line.length; if (s) E.font.text(g, s, d.x + d.tx, d.y + 5 + k * d.lh, this.color, { outline: false, shadow: '#05040a' }); });
      const blink = Math.floor(this.game.real * 3) % 2 === 0, last = this.i >= this.pages.length - 1;
      if (!this.typing && !(last && this.choices) && blink) px.poly(g, [[d.x + d.w - 10, d.y + d.h - 6], [d.x + d.w - 5, d.y + d.h - 6], [d.x + d.w - 7.5, d.y + d.h - 3]], this.color);
      if (last && this.choices && !this.typing) {
        const cw = Math.max(...this.choices.map(c => E.font.width(c))) + 20, ch = this.choices.length * d.lh + 7, cx = d.x + d.w - cw - 2, cy = d.y - ch - 2;
        ui.box(g, cx, cy, cw, ch, { bg: this.bg, border: this.border });
        this.choices.forEach((c, k) => { E.font.text(g, c, cx + 13, cy + 4 + k * d.lh, k === this.choice ? this.nameColor : this.color, { outline: false, shadow: '#05040a' }); if (k === this.choice && blink) E.font.text(g, '▸', cx + 5, cy + 4 + k * d.lh, this.nameColor, false); });
      }
    });
  }
}
E.Dialog = Dialog;
class Menu {
  constructor(game, items, o = {}) {
    this.game = game; this.items = items || []; this.i = 0; this.active = true;
    Object.assign(this, { x: 'center', y: 'center', title: null, box: true, color: '#ffffff', pick: '#ffd36a', dim: '#6a6488', bg: '#141a3a', border: '#e8e4ff', onPick: null, onCancel: null, onMove: null, sound: true }, o);
    this._skip(1);
  }
  _label(it) { return typeof it === 'string' ? it : it.label; }
  _off(it) { return typeof it === 'object' && it.disabled; }
  _skip(dir) { for (let k = 0; k < this.items.length && this._off(this.items[this.i]); k++) this.i = (this.i + dir + this.items.length) % this.items.length; }
  get selected() { return this.items[this.i]; }
  update() {
    if (!this.active || !this.items.length) return false;
    const inp = this.game.input, n = this.items.length, old = this.i;
    if (inp.repeat('up')) { this.i = (this.i + n - 1) % n; this._skip(-1); }
    if (inp.repeat('down')) { this.i = (this.i + 1) % n; this._skip(1); }
    if (this.i !== old) { if (this.sound) this.game.audio.sfx('select'); if (this.onMove) this.onMove(this.i, this.items[this.i]); }
    if (inp.pressed('confirm') && !this._off(this.items[this.i])) { if (this.sound) this.game.audio.sfx('confirm'); inp.consumeAll(); if (this.onPick) this.onPick(this.i, this.items[this.i]); return true; }
    if (inp.pressed('cancel') && this.onCancel) { if (this.sound) this.game.audio.sfx('cancel'); inp.consumeAll(); this.onCancel(); return true; }
    return false;
  }
  draw(r) {
    r.overlay(g => {
      const labels = this.items.map(it => this._label(it)), w = Math.max(E.font.width(this.title || ''), ...labels.map(l => E.font.width(l))) + 22, rowH = E.font.lineHeight() + 2;
      const h = labels.length * rowH + (this.title ? rowH + 3 : 0) + 8;
      const x = this.x === 'center' ? Math.round((r.W - w) / 2) : this.x, y = this.y === 'center' ? Math.round((r.H - h) / 2) : this.y;
      if (this.box) E.ui.box(g, x, y, w, h, { bg: this.bg, border: this.border });
      let yy = y + 5;
      if (this.title) { E.font.text(g, this.title, x + w / 2, yy, this.pick, { align: 'center', outline: false, shadow: '#05040a' }); yy += rowH + 3; }
      const blink = Math.floor(this.game.real * 3) % 2 === 0;
      labels.forEach((l, k) => {
        const sel = k === this.i && this.active, off = this._off(this.items[k]);
        if (sel) px.rect(g, x + 3, yy + k * rowH - 2, w - 6, rowH, shade(Array.isArray(this.bg) ? this.bg[0] : this.bg, .22));
        E.font.text(g, l, x + 14, yy + k * rowH, off ? this.dim : sel ? this.pick : this.color, { outline: false, shadow: '#05040a' });
        if (sel && blink) E.font.text(g, '▸', x + 6, yy + k * rowH, this.pick, false);
      });
    });
  }
}
E.Menu = Menu;

// ---- 17. FULL-ENGINE-ONLY CALLS: no-ops here (each warns once), so a game written for dist/my-3d2dge.js still runs ----
const fullOnly = name => function () { warn('full:' + name, name + ' is only in the full engine (dist/my-3d2dge.js); the agent edition ignores it'); return null; };
px.glow = () => {};
E.prop = fullOnly('E.prop');
Renderer.prototype.prop = fullOnly('r.prop');
// shapes and materials (docs/ASSETS.md): the registries are here (entries a game adds are kept), nothing draws them;
// E.addAssets registers nothing and returns empty lists, the rest null
Object.assign(E, { SHAPES: {}, MATERIALS: {}, PATTERNS: {}, shapeSprite: fullOnly('E.shapeSprite'), shapeInfo: fullOnly('E.shapeInfo'), shapeMesh: fullOnly('E.shapeMesh'), materialTile: fullOnly('E.materialTile'), shapeBox: fullOnly('E.shapeBox'), addAssets: (...a) => (fullOnly('E.addAssets')(...a), { shapes: [], materials: [], sprites: {} }), material: fullOnly('E.material') });
Renderer.prototype.shape = fullOnly('r.shape');
TileMap.prototype.solid = fullOnly('map.solid');
Renderer.prototype.sightCone = fullOnly('r.sightCone');
for (const k of ['Mover', 'Action', 'Suspicion']) E[k] = class { constructor() { throw new Error('E.' + k + ' is only in the full engine (dist/my-3d2dge.js), with the rest of the third-person kit'); } };
E.Shell = class { constructor(game) { fullOnly('E.Shell')(); this.game = game; this.root = null; } get settings() { return this.game.settings; } get screen() { return null; } show() { return this; } back() { return this; } hide() { return this; } toast() { return this; } tutorial() { return this; } hud() { return this; } dispose() {} };
E.Backdrop = class { constructor() { fullOnly('E.Backdrop')(); } draw() {} };
for (const m of ['enableGPU', 'setZoom', 'rotateView', 'resetCamera', 'zoomBy', 'zoomRange']) Game.prototype[m] = fullOnly('game.' + m);
for (const m of ['drawPortrait', 'drawSmear', 'debug']) Humanoid.prototype[m] = fullOnly('rig.' + m);
Input.prototype.touchButtons = fullOnly('input.touchButtons');
Object.defineProperty(Game.prototype, 'lights', { get() { return this._lights || (this._lights = { enabled: false, ambient: 1, add: fullOnly('game.lights'), caster() {}, heat() {} }); } });

root.My3D2dge = E;
})(typeof window !== 'undefined' ? window : globalThis);
