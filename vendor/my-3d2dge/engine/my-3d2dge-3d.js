/*!
my-3D2dge 3D v0.46.1: real 3D worlds under my-3D2dge games (three.js r182 and Rapier 0.19.3)
https://github.com/michaelcrosato/my-3d2dge (MIT License)

A 3D world, its physics and its camera under a my-3D2dge game. The 2D engine (engine/my-3d2dge.js) still runs the game:
its exact fixed steps, scenes, input, pause menu, settings, touch buttons, sound, the rigs and their moves, the HUD. This
module simulates and draws the world under the game's clear canvas. Everything is drawn by code: levels written as text,
textures pixel by pixel, characters by the 2D engine's rigs (as cards, or as 3D puppets on the same joints), props and
pickups from four shapes. No image, model or sound files.

AGENTS: this header is the whole manual for the 3D side; the API card (API.md) covers the 2D side (E.Game, input, rigs,
moves, E.font, E.ui, E.Menu, audio). Read the code below only to debug: its sections start with "/* ===" and a number.

## Host it (served: browsers load modules only over http; npx serve at the repository's root, or my-3d2dge.vercel.app)
<script type="importmap">{ "imports": { "three": "/vendor/three-0.182.0/three.webgpu.min.js",
  "three/webgpu": "/vendor/three-0.182.0/three.webgpu.min.js", "three/tsl": "/vendor/three-0.182.0/three.tsl.min.js",
  "@dimforge/rapier3d-simd-compat": "/vendor/rapier3d-simd-compat-0.19.3/rapier.js" } }</script>
<div id="stage" style="position:relative;width:100%;height:100%;overflow:hidden">
  <canvas id="view"></canvas><canvas id="screen" style="position:absolute;inset:0;width:100%;height:100%"></canvas></div>
<script src="/dist/my-3d2dge.js"></script>                   the 2D engine, a classic script, first
<script type="module" src="/dist/my-3d2dge-3d.js"></script>  this file
<script type="module" src="game.js"></script>                your game, a module (const E = My3D2dge;)

## Mental model
- The 2D engine's units: x east, y south, z up; 16 units = 1 metre = 1 tile; speeds in units a second; angles in
  radians from +x toward +y (0 east, PI/2 south, -PI/2 north).
- new E.Game({ ..., bg: null }): its canvas is clear, and the HUD draws on it over the 3D picture (r.overlay, r.text,
  E.ui, E.font) in game pixels, r.W x r.H. res: 'ps1', expand: true as in the 2D games.
- await E.World3D.init(game) once (a boot step), then new E.World3D(game, { level, ... }) for each level. In a scene:
  update(dt) { your rules, then world.step(dt) } and draw(r) { world.draw(r), then your HUD }. Paused or frozen
  (game.freeze), update doesn't run, so the world holds still and still draws.
- Deterministic: the world steps in the game's fixed steps; gameplay randomness comes from E.rng(seed); the camera's
  pose is worked out in the steps. world.reset() then the same inputs give the same world.hash() on WebGPU, WebGL 2 and
  run again. Gameplay never reads the picture or the GPU: it reads actors, props and the level.
- The camera decides what "up the stick" means: move with world.camera.ground(game.input.move()).

## Quick start: a complete game (collect the gems, mind the slimes)
```js quickstart
const E = My3D2dge;
const game = new E.Game({ canvas: 'screen', res: 'ps1', expand: true, bg: null, input: E.World3D.INPUT, menu: { settings: E.World3D.SETTINGS } });
const LEVEL = { rows: [
  '################',
  '#t............t#',
  '#..g.....==..g.#',
  '#........==....#',
  '#..s.....^^....#',
  '#.............s#',
  '#..g...@....g..#',
  '#t............t#',
  '################'],
  legend: { '=': { floor: 16 }, '^': { stairs: 'n', floor: 16 }, g: { mark: 'gem' }, s: { mark: 'slime' }, '@': { mark: 'start' } } };
let world, hero, slimes, gems, hp, done;
const move = [0, 0];
const play = {
  view: 'iso', views: ['iso', 'threequarter', 'topdown'], pausable: true, touch: ['jump'], camera: { zoom: [.6, 2] },
  enter() {
    world.reset(); const rnd = E.rng(1), s = world.marks.start[0];
    hero = world.hero({ x: s.x, y: s.y, rig: new E.Humanoid({ colors: { cloth: '#2f8f86' } }) });
    slimes = world.marks.slime.map(m => world.mob({ x: m.x, y: m.y, blob: new E.Blob({ R: 6 }) }));
    gems = world.marks.gem.map(m => world.thing('gem', m.x, m.y, m.z + 2, { spin: .5, bob: 3 }));
    world.camera.follow(hero); hp = 3; done = false;
    for (const e of slimes) e.data.t = rnd() * 2;
  },
  update(dt) {
    if (game.input.pressed('camera')) world.camera.set(world.camera.mode === 'view' ? 'chase' : 'view');
    world.camera.ground(game.input.move(), move);
    hero.vx = E.approach(hero.vx, move[0] * 90, 900 * dt); hero.vy = E.approach(hero.vy, move[1] * 90, 900 * dt);
    if (Math.hypot(move[0], move[1]) > .1) hero.facing = Math.atan2(move[1], move[0]);
    if (hero.grounded && game.input.pressed('jump')) hero.jump(170);
    for (const e of slimes) {   // hop at the hero now and then; touch one: a heart lost, knocked back
      if ((e.data.t -= dt) < 0 && e.grounded) { e.data.t = 1.2; const a = Math.atan2(hero.y - e.y, hero.x - e.x); e.vx = Math.cos(a) * 60; e.vy = Math.sin(a) * 60; e.vz = 140; e.facing = a; }
      if (Math.hypot(e.x - hero.x, e.y - hero.y) < 11 && Math.abs(e.z - hero.z) < 10 && !(hero.data.inv > 0)) { hp--; hero.data.inv = 1; hero.push((hero.x - e.x) * 12, (hero.y - e.y) * 12, 120); game.shake(3); }
    }
    hero.data.inv = (hero.data.inv || 0) - dt;
    for (const t of world.touching(hero, 'gem')) { world.remove(t); gems.splice(gems.indexOf(t), 1); game.particles.glints(t.x, t.y, t.z + 6, 8, '#bff8ff'); }
    if (!done && (!gems.length || hp <= 0)) { done = true; game.note(gems.length ? 'OUCH!' : 'ALL GEMS!', 2); game.after(2, () => game.go('play')); }
    world.step(dt);
  },
  draw(r) {
    world.draw(r);
    r.overlay(g => { E.ui.hearts(g, 6, 6, Math.max(0, hp), 3); E.font.text(g, 'GEMS ' + gems.length, 6, 18, '#bff8ff'); });
  }
};
game.start({ scenes: { play }, scene: 'play', boot: { steps: [
  ['The 3D engine', () => E.World3D.init(game)],
  ['The level', () => { world = new E.World3D(game, { level: LEVEL }); world.prepare(); }]] } });
```

## The level: text, one character per tile; row 0 is north
level: { rows, legend, ground, side, colors, bottom }. A legend entry says what its character is (the defaults: '#' wall
48, 'w' wall 12, 'P' pillar 56, '.' floor, ' ' pit, 't' brazier):
  { floor: h }        walkable at height h (0 the ground; above 0 a raised floor, solid to the ground)
  { wall: h }         a solid block h tall, cut low where it stands between a view camera and the level (cut: false)
  { pillar: h }       each block of these tiles is one pillar, cut to a stump when it hides the target
  { stairs: 'n'|'s'|'e'|'w', from: 0, floor: 16 }   rising toward that side, from height `from` to `floor`
  { platform: h, thick: 4 }   a slab in the air, its top at h (walk under it); add pit: true for nothing below
  { pit: true }       no floor: a body that falls in is lost (actor.fell)
  { torch: true }     a brazier with a flickering light (the lights go to the torches nearest the target)
  { mark: 'name' }    a spot: world.marks.name -> [{ x, y, z, cx, cy }] (the tile's centre, on its surface)
  { shape: 'bench', facing, scale, mats, solid }   a shape standing on the tile (world.shape), walked round when solid
and its look: ground ('flagstone' 'grass' 'dirt' 'sand' 'snow' 'planks' 'tiles' 'plain' 'water' 'lava', or (x, y) =>
[r, g, b]) with colors { base, dark, light }, side ('brick' 'block' 'earth' 'planks' 'metal') with color (and top, line).
The level's own ground and side are every tile's default. Add looks: E.World3D.GROUND.name, E.World3D.SIDE.name.

## The world: new E.World3D(game, o)
o: { level, look: 'card' | 'puppet', res: 'pixels' | 'balanced' | 'full', gravity: 480, sky: '#06050b' or [top,
horizon], fog: { color, near, far } (units past the target) or false, ambient: [sky, ground, intensity], sun: { color,
intensity, dir: [x, y, z] (it shines along it), area, shadow }, torchLights: 6, torchShadows: 1, torchPower: 30,
lights: 2 (your own), glowLights: 4, shadows, outlines, filter, camera: { mode, proj, fov, chase, ... } }
  world.step(dt) / world.draw(r) / world.reset() / world.hash([your numbers]) / world.prepare() (build the shaders now)
  world.width, depth (units), mw, mh (tiles), bottom, marks, torches, actors, props, platforms, things, time, stats
  world.ground(x, y)   the ground's height (a wall's top on a wall; bottom over a pit)
  world.floorAt(x, y, z)   the surface a body at height z stands on or falls to (platforms too)
  world.topH(x, y)     the top of whatever stands there (shots stop below it)
  world.tile(cx, cy), spec(cx, cy), solidTile(cx, cy)   the level's character, its legend entry, walls and pillars
  world.flow() -> flow: flow.to(x, y) aims it; flow.dir(x, y, out) -> the way there ([x, y], or null: go straight);
      it climbs stairs and gentle slopes and drops off ledges, never jumps
  world.randomFloor(rnd, minDist, fx, fy) -> [x, y]; world.clear(x0, y0, z0, x1, y1, z1) -> a clear line of sight?
  world.near(x, y, r, kind) -> actors within r; world.touching(actor, kind) -> things it touches
  world.project(x, y, z) -> [x, y] in game pixels for the HUD (null behind the camera)
  world.remove(actor | prop | platform | thing)

## Actors: world.hero(o) and world.mob(o)
hero: a kinematic capsule walked by Rapier's character controller: it slides along walls, climbs stairs and slopes,
steps up curbs, rides moving platforms, pushes crates and shoves mobs. mob: a dynamic body; the crowd pushes and piles
up by itself, knockback is momentum. o: { x, y, z, rig: new E.Humanoid(...) | blob: new E.Blob(...) | orb: { color, r },
r, half (the capsule: radius, half its straight part; half 0 a ball), facing, fly (no gravity), mass, trail (a color for
the rig's weapon trail), look ('card' | 'puppet' for this one), shadow, pose: false (you pose it yourself) }
Each step you set what it wants: a.vx, a.vy (units a second on the ground: E.approach toward a target speed), a.jump(v)
or a.vz, a.facing, a.anim (what its rig does: { attack: move.state, pose: 'cheer' | 'die' | 'cast', hurt, dash, expr };
a blob's { squash, look: [dx, dy], squint, flap }); world.step moves it, reads back a.x, a.y, a.z (its feet), a.vx,
a.vy, a.vz, a.grounded, a.landed (this step), a.fell (dropped below the level), and poses its rig.
  a.place(x, y, z), a.push(vx, vy, vz) (knockback), a.setSolid(false) (fallen: it stops blocking the others), a.remove()
  a.flash (seconds of hit flash), a.fade (0..1), a.sink (units drawn into the floor: spawning, sinking away), a.visible,
  a.data (yours). E.Attack, E.Combo and E.MOVES work as in 2D: attack.hits(list, e => E.inArc(a, a.facing, e, range,
  half), e => ...) on actors.

## Props, platforms and things
  world.shape(id, x, y, z, { facing, scale, mats, flip, params, solid: true }): a shape (docs/ASSETS.md: an E.SHAPES id,
  a store set's 'SET:id' after E.addAssets, or an entry) in 3D, from the 2D engine's parts and materials, solid as
  map.solid's box. A reset takes yours away (the legend's stand again); world.shapes holds them; world.remove(s)
  world.crate(x, y, z, yaw), world.barrel(x, y, z): dynamic bodies; world.knock(p, fromX, fromY, dv, up) throws one;
  world.box({ x, y, z, w, d, h, color, side, fixed, mass }); a prop has x, y, z, q (its rotation), data
  world.platform({ w, d, h, path: [[x, y, z], ...] (its top's points), speed, wait, loop, side, color }): a platform that
  moves (there and back, or round with loop); heroes on it ride it, bodies on it are carried
  world.thing(kind, x, y, z, o): drawn by code: coin gem heart key star potion chest door flag sign lever pad spring
  tree bush rock mushroom fence crystal; o: { yaw, spin (turns a second), bob, size, color, open (0..1), on, solid:
  true | [w, d, h] (a block where it stands: world.setSolid(t, false) opens it), data }. Add a kind:
  E.World3D.THINGS.lamp = (pen, t, time) => { pen.tube(0, 0, 0, 0, 0, 20, 1, '#555').glow(0, 0, 21, 2, '#ffd36a'); }

## Drawing for one frame (in draw, before world.draw(r))
  world.arc(x, y, z, r0, r1, a0, a1, color, alpha): a flat arc on the ground (a telegraph)
  world.glow(x, y, z, r, color, { core, light: true }): a glowing ball (a bolt); the first four asked for light the scene
  world.pen.at(x, y, z, yaw, size).box(x, y, z, w, d, h, color).ball(x, y, z, rx, ry, rz, color).tube(x0, y0, z0, x1,
      y1, z1, r, color).cone(...base to tip).bar(x0, y0, z0, x1, y1, z1, w, t, color).glow(x, y, z, r, color)
  world.light({ color, reach, power }) (made once, with the world): a light; set its x, y, z and on each frame
  game.particles (sparks, dust, bits, rings, glints, fire, text): drawn in 3D; they land on the level; text goes on the HUD
  game.shake(n), game.flash(color), game.freeze(s), game.note(text): as in 2D

## The camera: world.camera
  modes: 'view' (the 2D engine's views as real 3D cameras following camera.target: game.view (V: game.nextView()),
  game.yaw ([ ]: game.rotateView(45)), game.zoom (the wheel, a pinch, Settings); proj 'persp' | 'ortho'; dist; walls in
  front cut low), 'chase' (behind the target; it swings round behind as the target moves; a click captures the mouse to
  turn it), 'first' (the target's eyes), 'fly', 'fixed' (camera.fixed = { x, y, z, yaw, pitch, fov })
  camera.set(mode), camera.follow(actor), camera.ground(move, out) -> the stick turned to the ground,
  camera.aim(actor) -> the angle the mouse (on the floor) or right stick points from it, or null; camera.heading,
  camera.pose, camera.chase = { pitch, dist, fov, height, auto }, camera.first = { pitch, fov }

## The look
  world.look = 'card' | 'puppet'; world.res = 'pixels' | 'balanced' | 'full'; world.shadows; world.outlines
  world.filter = { look: 'clean' | 'cel' (Comic cel: flat bands of light, ink) | 'pixel' (big dithered pixels), apply:
  'all' | 'objects' | 'env', bloom, fxaa, bands, ink, inkW, punch, px, levels, dither }
  E.World3D.SETTINGS in the game's menu lets the player pick the look, the picture, shadows and the filter.
  E.World3D.INPUT: WASD or arrows move, Space jumps, J or a click attacks, Shift dashes, E skill, C camera.

## Your own three.js
E.THREE (three/webgpu), E.TSL, E.RAPIER; world.scene, world.pw (Rapier's world), E.World3D.toThree(x, y, z) (engine
units to three's metres, y up). The rules: WebGPURenderer and node materials only (MeshLambertNodeMaterial,
MeshToonNodeMaterial, MeshBasicNodeMaterial, TSL): never WebGLRenderer, ShaderMaterial, onBeforeCompile, EffectComposer or
three/addons (not vendored); no compute shaders or storage buffers; nothing read back from the GPU. An InstancedMesh with
over 1,000 instances never uses DynamicDrawUsage (r182 drops its updates). Make meshes and lights when the world is made,
not mid-game (a new material builds its shader: a stall).

## Tests
Headless Chromium runs it on WebGL 2 (?backend=webgl) and WebGPU (SwiftShader). world.hash() is the proof; game.advance(s)
runs fixed steps at once; game.input.hold / tap script input. The kits expose window.__game.
*/
import * as THREE from 'three/webgpu';
import * as TSL from 'three/tsl';
import RAPIER from '@dimforge/rapier3d-simd-compat';

/* =============================================================================
 * 1. SETUP  units, helpers, collision groups, the page's renderer (World3D.init)
 * ============================================================================= */
const E = globalThis.My3D2dge;
if (!E || !E.Game) throw new Error('my-3D2dge 3D: load the engine (engine/my-3d2dge.js, a classic script) before this module');
const { clamp, lerp, approach, TAU } = E;
/** U: engine units per metre (one floor tile is 16 units: one metre). three.js works in metres with y up */
const U = 16, T = 16, DEG = Math.PI / 180, OUTLINE = '#0c0818';
const Z_UP = { x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 };   // Rapier's capsules and cylinders stand along y: this stands them up along z
/** engine units (x east, y south, z up) -> three.js metres (x east, y up, z south) */
const toThree = (x, y, z, out = new THREE.Vector3()) => out.set(x / U, z / U, y / U);
const _lin = new Map(), _col = new THREE.Color();
/** '#rrggbb' -> linear RGB floats (cached): instance colors */
function lin(hex) { let v = _lin.get(hex); if (!v) { _col.set(hex); v = [_col.r, _col.g, _col.b]; _lin.set(hex, v); } return v; }
const _F32 = new Float32Array(1), _I32 = new Uint32Array(_F32.buffer);
/** a hash of a list of numbers by their exact float32 bits (FNV-1a), as 8 hex digits: equal state, equal hash */
function hashNumbers(list) {
  let h = 0x811c9dc5;
  for (const n of list) { _F32[0] = n; h ^= _I32[0]; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
// collision groups (Rapier: membership << 16 | filter; a pair touches when each one's filter has the other's membership):
// the level and platforms touch everything; props everything but flyers; heroes the level, props, platforms and mobs
// (their capsules shove mobs aside); mobs each other too; flyers the level and each other; the downed (setSolid(false))
// the level, props and platforms only
const ig = (member, filter) => (member << 16) | filter;
const GROUPS = { level: ig(1, 0xffff), platform: ig(64, 0xffff), prop: ig(2, 1 | 2 | 4 | 8 | 32 | 64), hero: ig(4, 1 | 2 | 8 | 64),
  mob: ig(8, 1 | 2 | 4 | 8 | 64), flyer: ig(16, 1 | 16 | 64), down: ig(32, 1 | 2 | 64) };
const HERO_QUERY = ig(4, 1 | 2 | 64);   // a hero's controller steers round the level, props and platforms; its capsule shoves monsters
const LEVEL_ONLY = ig(0xffff, 1 | 64);  // sight lines and camera checks: the level and platforms

/** the page's one renderer and 3D canvas, shared by every world (World3D.init makes them) */
const PAGE = { ready: null, renderer: null, canvas: null, backend: 'none', game: null, worlds: new Set(), active: null };
async function init(game, o = {}) {
  if (PAGE.ready) return PAGE.ready;
  return (PAGE.ready = (async () => {
    await RAPIER.init({});
    PAGE.game = game;
    if (o.render === false || !game || game.headless || typeof document === 'undefined') return PAGE;
    // the 3D canvas: the page's #view, or one made right under the game's canvas, which stays on top (clear: bg null)
    const gc = game.screen.canvas;
    let cv = typeof o.canvas === 'string' ? document.getElementById(o.canvas) : o.canvas || document.getElementById('view');
    if (!cv) { cv = document.createElement('canvas'); cv.id = 'view'; gc.parentNode.insertBefore(cv, gc); }
    Object.assign(cv.style, { position: 'absolute', left: '0', top: '0', pointerEvents: 'none', zIndex: '0' });
    if (!gc.style.zIndex) gc.style.zIndex = '1';
    gc.style.background = 'transparent';
    if (!game.screen.clear) E.warn('3d:bg', 'a 3D world draws under the game\'s canvas: make the game with bg: null, or its background hides the world');
    const qs = new URLSearchParams(location.search), webgl = o.backend === 'webgl' || qs.get('backend') === 'webgl';
    const r = new THREE.WebGPURenderer({ canvas: cv, antialias: false, forceWebGL: webgl });
    await r.init();
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.NoToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
    r.info.autoReset = false; r.setPixelRatio(1);
    Object.assign(PAGE, { renderer: r, canvas: cv, backend: r.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL 2' });
    mouseLook(gc);
    return PAGE;
  })());
}

/** the mouse turns the chase, first-person and fly cameras of the world drawn last: a click on the game's canvas in
 *  play captures it (pointer lock; Esc or a pause frees it), then each move turns the camera (camera.mouseLook false:
 *  never). Off while a session is recorded or replayed: the lock is not in its record, so the replay would turn apart */
function mouseLook(gc) {
  const cam = () => { const w = PAGE.active; return w && w.camera; }, S = E.session;
  gc.addEventListener('pointerdown', e => {
    const c = cam(); if (!c || e.pointerType !== 'mouse' || !c.mouseLook || !['chase', 'first', 'fly'].includes(c.mode) || document.pointerLockElement) return;
    if (PAGE.game.paused || (S && (S.recording || S.replaying))) return;
    try { const r = gc.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (err) { /* refused: [ and ] still turn it */ }
  });
  document.addEventListener('pointerlockchange', () => { for (const w of PAGE.worlds) w.camera.locked = document.pointerLockElement === gc; });
  document.addEventListener('mousemove', e => {
    const c = cam(); if (!c || !c.locked || PAGE.game.paused) return;
    const k = .0024, dx = e.movementX || 0, dy = e.movementY || 0;
    c.yaw += dx * k; c._held = 1.5;
    if (c.mode === 'chase') c.chase.pitch = clamp(c.chase.pitch - dy * k, -1.3, .15);
    else if (c.mode === 'first') c.first.pitch = clamp(c.first.pitch - dy * k, -1.2, 1.1);
    else if (c.mode === 'fly') c.fly.pitch = clamp(c.fly.pitch - dy * k, -1.5, 1.5);
  });
}

/* =============================================================================
 * 2. TEXTURES AND MATERIALS  everything drawn by code, pixel by pixel, baked into crisp (nearest) textures
 * ============================================================================= */
/** a texture function (x, y) -> [r, g, b] baked into a w x h texture (repeating unless repeat is false) */
function bake(fn, w, h, repeat = true) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = fn(x, y), i = (y * w + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  return canvasTex(cv, repeat);
}
function canvasTex(cv, repeat = true) {
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  return t;
}
const H = E.hex;
/** the stone palette of the stress test's hall: flagstones, mortar, lit and dark edges, specks */
const STONE = { stones: ['#4b4559', '#554f64', '#433e51', '#5d566c'].map(H), mortar: H('#221e2b'), hi: H('#6f6782'), lo: H('#322d3e'), speck: H('#2a2634') };
/** the ground's looks (a level's ground, a tile's ground): (x, y, o) -> [r, g, b] or [r, g, b, glow 0..1] in engine
 *  units; o: the legend entry (its colors: base, dark, light, ...). Add your own: World3D.GROUND.lava = (x, y, o) => ... */
const GROUND = {
  flagstone: (x, y, o) => E.tex.flagstone(x, y, o.pal || STONE),
  grass: (x, y, o) => E.tex.grass(x, y, o),
  dirt: (x, y, o) => E.tex.dirt(x, y, o),
  sand: (x, y, o) => E.tex.dirt(x, y, Object.assign({ base: '#d6bc84', dark: '#b4955e', light: '#ecd8a4' }, o)),
  snow: (x, y, o) => E.tex.dirt(x, y, Object.assign({ base: '#e6ecf6', dark: '#c4cee0', light: '#ffffff' }, o)),
  planks: (x, y, o) => E.tex.planks(x, y, o),
  tiles: (x, y, o) => E.tex.checker(x, y, o),
  plain: (x, y, o) => E.tex.plain(x, y, o),
  water: (x, y, o) => E.tex.water(x, y, o),
  lava: (x, y) => { const n = E.noise2(x * .08, y * .08) * .7 + E.noise2(x * .3, y * .3) * .3; return n > .62 ? [255, 214, 106, 1] : n > .45 ? [255, 122, 42, 1] : [170, 40, 26, .7]; }
};
/** the sides' looks (walls, raised floors, platforms, stairs): { w, h, fn(x, y, c) } where c holds the entry's colors as
 *  [r, g, b] (side, line, top, hi, lo) and (x, y) is a pixel of a w x h texture that repeats every metre (16 pixels)
 *  across; h is the pixels it spans up (64: earth's grass lip sits at the top of four metres) */
const SIDE = {
  brick: { w: 16, h: 16, fn(x, y, c) {   // courses of bricks, joints staggered by course, lit brick tops and specks
    const z = 15 - y, ci = Math.floor(z / 8), fz = z - ci * 8;
    if (fz === 0) return c.line;
    const jx = (ci & 1) ? 4 : 12; if (x === jx) return c.line;
    const v = E.hash2(ci * 7 + (x < jx ? 0 : 1), ci + 99);
    if (fz === 7) return v > .5 ? c.hi : c.side;
    if (E.hash2(x * 3 + 1, z * 5 + 2) < .07) return c.lo;
    return v < .22 ? c.lo : v > .86 ? c.hi : c.side;
  } },
  block: { w: 16, h: 16, fn(x, y, c) {   // dressed stone: big blocks, bevelled (lit top and left, dark bottom and right)
    const row = Math.floor(y / 8), off = (row & 1) * 8, lx = (x + off) % 16, ly = y - row * 8;
    if (ly === 7 || lx === 15) return c.line;
    if (ly === 0 || lx === 0) return c.hi;
    if (ly === 6 || lx === 14) return c.lo;
    return E.noise2(x * .3, y * .3) > .8 ? c.lo : c.side;
  } },
  earth: { w: 16, h: 64, fn(x, y, c) {   // packed earth with stones, a grass lip at the top that hangs in tufts
    const lip = 3 + (E.hash2(x, 7) > .5 ? 1 : 0) + (E.hash2(x >> 1, 3) > .7 ? 1 : 0);
    if (y < lip) return y === lip - 1 ? c.lo2 : c.top;
    const n = E.noise2(x * .25, y * .25);
    if (n > .78) return c.hi;
    if (E.hash2(x * 5 + 1, y * 3 + 2) < .06) return c.lo;
    return n < .3 ? c.lo : c.side;
  } },
  planks: { w: 16, h: 16, fn(x, y, c) {   // boards standing up, a dark seam between each, nails at the ends
    const b = Math.floor(x / 4), lx = x % 4;
    if (lx === 3) return c.line;
    if ((y === 2 || y === 13) && lx === 1) return c.lo;
    return E.hash2(b, Math.floor(y / 5)) > .75 ? c.lo : lx === 0 ? c.hi : c.side;
  } },
  metal: { w: 16, h: 16, fn(x, y, c) {   // plates with rivets
    if (x === 0 || y === 0) return c.hi; if (x === 15 || y === 15) return c.line;
    if ((x === 2 || x === 13) && (y === 2 || y === 13)) return c.lo;
    return E.noise2(x * .2, y * .2) > .7 ? c.hi : c.side;
  } }
};
/** an entry's colors as RGB arrays (side, top, line, hi, lo, lo2), from its color (and the style's defaults) */
const STYLE_COLORS = { brick: '#3d3750', block: '#4a4360', earth: '#7d5838', planks: '#8f5f37', metal: '#5c6070' };
function sideColors(style, o) {
  const side = o.color || STYLE_COLORS[style] || '#4a4360', t = E.tones(side);
  return { side: H(side), line: H(o.line || E.shade(side, -.35)), hi: H(t.lt), lo: H(t.sh), top: H(o.top || (style === 'earth' ? '#55a94a' : E.shade(side, .25))), lo2: H(E.shade(o.top || '#55a94a', -.25)) };
}
/** a box (w, d, h in units; three's axes) whose faces keep 16 pixels per metre (BoxGeometry stretches 0..1 over a face) */
function boxGeo(w, d, h) {
  const g = new THREE.BoxGeometry(w / U, h / U, d / U), uv = g.attributes.uv, size = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];   // faces: +x -x +y -y +z -z
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * size[f][0] / T, uv.getY(i) * size[f][1] / T); }
  return g;
}
/** a box with two draw groups (its four sides, then top and bottom) instead of six: fewer draw calls */
function sidesThenTops(g) {
  const idx = g.index.array, face = f => Array.from(idx.slice(f * 6, f * 6 + 6));
  g.setIndex([0, 1, 4, 5, 2, 3].flatMap(face)); g.clearGroups(); g.addGroup(0, 24, 0); g.addGroup(24, 12, 1);
  return g;
}
/* the puppets' toon look: three bands of light (shadow, base, lit), like the engine's tones */
const TOON_BANDS = (() => {
  const t = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 255, 255, 255, 255]), 3, 1);
  t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
})();
/* outlines: an inverted hull. The same (instanced) mesh again, back faces only, each vertex pushed OUTLINE_PX pixels
 * outward on the screen (along its normal for round parts, away from the part's centre for boxes) */
const OUTLINE_PX = TSL.uniform(new THREE.Vector2(.01, .01));   // clip-space size of the push, set per frame (one game pixel)
function outlineMat(mode = 'normal') {
  const { Fn, vec4, positionLocal, normalLocal, modelViewMatrix, cameraProjectionMatrix } = TSL;
  const m = new THREE.MeshBasicNodeMaterial({ color: OUTLINE, side: THREE.BackSide, fog: false });
  m.vertexNode = Fn(() => {
    const mvp = cameraProjectionMatrix.mul(modelViewMatrix), pos = mvp.mul(vec4(positionLocal, 1));
    const out = mode === 'center' ? positionLocal : normalLocal;
    const pos2 = mvp.mul(vec4(positionLocal.add(out.normalize().mul(.01)), 1));
    const dir = pos2.xy.div(pos2.w).sub(pos.xy.div(pos.w)).normalize();
    return vec4(pos.xy.add(dir.mul(OUTLINE_PX).mul(pos.w)), pos.z, pos.w);
  })();
  return m;
}
const lambert = (map, o) => new THREE.MeshLambertNodeMaterial(Object.assign({ map }, o));
/** static meshes merged by material (one draw call each): add(geometry, [x, y, z] metres, a material or one per group,
 *  casts a shadow), then build(scene) */
class Merger {
  constructor() { this.by = new Map(); }
  add(geo, at, mats, shadow = true) {
    const P = geo.attributes.position, N = geo.attributes.normal, UV = geo.attributes.uv, idx = geo.index ? geo.index.array : null;
    const groups = geo.groups.length ? geo.groups : [{ start: 0, count: idx ? idx.length : P.count, materialIndex: 0 }];
    for (const gr of groups) {
      const m = Array.isArray(mats) ? mats[gr.materialIndex] : mats;
      let b = this.by.get(m); if (!b) this.by.set(m, b = { pos: [], nor: [], uv: [], shadow: false });
      for (let k = gr.start; k < gr.start + gr.count; k++) {
        const i = idx ? idx[k] : k;
        b.pos.push(P.getX(i) + at[0], P.getY(i) + at[1], P.getZ(i) + at[2]); b.nor.push(N.getX(i), N.getY(i), N.getZ(i)); b.uv.push(UV ? UV.getX(i) : 0, UV ? UV.getY(i) : 0);
      }
      b.shadow = b.shadow || shadow;
    }
    geo.dispose();
  }
  build(scene, own) {
    for (const [m, b] of this.by) {
      const g = own(new THREE.BufferGeometry());
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; mesh.castShadow = b.shadow; scene.add(mesh);
    }
    this.by.clear();
  }
}

/* =============================================================================
 * 3. LEVEL  written as text, one character per floor tile (1 metre, 16 units); row 0 is the far (north) edge, y grows
 *    south, x east. What each character is comes from the legend (LEGEND below, then the level's own legend over it):
 *      { floor: h }                  walkable at height h (units; 0 the ground; a raised floor is solid down to the ground)
 *      { wall: h }                   a solid block h tall (cut low where it stands between a view camera and the hall)
 *      { pillar: h }                 each block of these tiles is one pillar: plinth, shaft and capital
 *      { stairs: 'n'|'s'|'e'|'w', from, floor }   stairs rising toward that side, from height `from` (0) to `floor`
 *      { platform: h, thick: 4 }     a slab in the air whose top is at h (walk under it); with pit: true, over nothing
 *      { pit: true }                 no floor: a body that falls in is lost (actor.fell)
 *      { torch: true }               a brazier on the floor, lit by the world's torch lights
 *      { mark: 'name' }              a spot to put things: world.marks.name -> [{ x, y, z, cx, cy }] (the tile's centre)
 *    and how it looks: ground ('flagstone' 'grass' 'dirt' 'sand' 'snow' 'planks' 'tiles' 'plain' 'water' 'lava', a key of
 *    World3D.GROUND, or a function (x, y) -> [r, g, b]) with its colors (base, dark, light, flower), side ('brick' 'block'
 *    'earth' 'planks' 'metal') with color (and top, line). A level's own ground, side and color are every tile's default.
 * ============================================================================= */
const LEGEND = { '#': { wall: 48 }, w: { wall: 12 }, P: { pillar: 56 }, '.': {}, ' ': { pit: true }, t: { torch: true } };
const FLOOR = 0, WALL = 1, PILLAR = 2, STAIRS = 3, PIT = 4, TORCH = 5;
const STEP_UP = 3.5, CUT_H = 7;   // STEP_UP: the highest step a walker climbs (units); CUT_H: a wall cut low in front of a view camera
const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const STAIR_DIR = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
const _m4 = new THREE.Matrix4(), _q0 = new THREE.Quaternion(), _v0 = new THREE.Vector3(), _s0 = new THREE.Vector3();
class Level {
  constructor(world, def) {
    const rows = def.rows, legend = Object.assign({}, LEGEND, def.legend);
    if (!Array.isArray(rows) || !rows.length) throw new Error('my-3D2dge 3D: a level needs rows: an array of strings, one character per 1-metre tile');
    const mw = Math.max(...rows.map(r => r.length)), mh = rows.length, n = mw * mh;
    if (rows.some(r => r.length !== mw)) E.warn('3d:rows', 'a level\'s rows are not all the same length: the short ones end in pits');
    Object.assign(this, { world, def, rows, mw, mh, width: mw * T, depth: mh * T, bottom: def.bottom ?? -96 });
    this.specs = new Array(n); this.kind = new Uint8Array(n); this.base = new Float32Array(n); this.plat = new Float32Array(n).fill(-1e9); this.platLo = new Float32Array(n);
    this.stairOf = new Int16Array(n).fill(-1); this.marks = {}; this.torches = []; this.stairs = []; this.shapes = [];
    for (let cy = 0; cy < mh; cy++) for (let cx = 0; cx < mw; cx++) {
      const i = cy * mw + cx, ch = rows[cy][cx] ?? ' ';
      let sp = legend[ch]; if (!sp) { E.warn('3d:legend:' + ch, 'the level uses "' + ch + '", which its legend does not say: it is floor'); sp = {}; }
      this.specs[i] = sp;
      const fl = sp.floor || 0;
      const k = sp.wall ? WALL : sp.pillar ? PILLAR : sp.stairs ? STAIRS : sp.pit ? PIT : sp.torch ? TORCH : FLOOR;
      this.kind[i] = k;
      this.base[i] = k === WALL ? fl + sp.wall : k === PILLAR ? fl + sp.pillar : k === PIT ? this.bottom : fl;
      if (sp.platform) { this.plat[i] = sp.platform; this.platLo[i] = sp.platform - (sp.thick || 4); }
      if (sp.shape) this.shapes.push([sp.shape, (cx + .5) * T, (cy + .5) * T, sp.platform || (k === PIT ? this.bottom : fl), sp]);
      if (sp.mark) (this.marks[sp.mark] ||= []).push({ x: (cx + .5) * T, y: (cy + .5) * T, z: sp.platform || (k === PIT ? this.bottom : fl), cx, cy });
      if (k === TORCH) this.torches.push({ x: (cx + .5) * T, y: (cy + .5) * T, z: fl, t: E.hash2(cx, cy) * 9 });
    }
    // stairs: each block of one character is one flight, rising toward its side from `from` to `floor`
    for (const [x0, y0, x1, y1, ch] of this.rects(i => this.kind[i] === STAIRS ? this.chars(i) : null)) {
      const sp = this.specs[y0 * mw + x0], d = STAIR_DIR[sp.stairs] || STAIR_DIR.n;
      const s = { x0, y0, x1, y1, ch, dir: sp.stairs in STAIR_DIR ? sp.stairs : 'n', dx: d[0], dy: d[1], low: sp.from || 0, high: sp.floor ?? 16, sp };
      if (s.low > s.high) { [s.low, s.high] = [s.high, s.low]; s.dir = { n: 's', s: 'n', e: 'w', w: 'e' }[s.dir]; s.dx = -s.dx; s.dy = -s.dy; }   // (stairs down: the same flight, rising the other way)
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { this.stairOf[y * mw + x] = this.stairs.length; this.base[y * mw + x] = s.high; }
      this.stairs.push(s);
    }
    // the tiles a solid shape's turned footprint covers (shrunk by a unit: one flush with a tile's edge stays out of it)
    this.shapeBlock = new Uint8Array(n);
    for (const [id, x, y, z, sp] of this.shapes) {
      const b = sp.solid === false ? null : E.shapeBox(id, x, y, z, sp); if (!b) continue;
      const ex = Math.abs(b.c) * b.hx + Math.abs(b.s) * b.hy - 1, ey = Math.abs(b.s) * b.hx + Math.abs(b.c) * b.hy - 1;
      for (let cy = Math.floor((b.y - ey) / T); cy <= Math.floor((b.y + ey) / T); cy++) for (let cx = Math.floor((b.x - ex) / T); cx <= Math.floor((b.x + ex) / T); cx++) if (cx >= 0 && cy >= 0 && cx < mw && cy < mh) this.shapeBlock[cy * mw + cx] = 1;
    }
    this.pass = this._pass();
  }
  chars(i) { return this.rows[(i / this.mw) | 0][i % this.mw]; }
  /** the tile index at engine point (x, y), or -1 off the map */
  index(x, y) { const cx = Math.floor(x / T), cy = Math.floor(y / T); return cx < 0 || cy < 0 || cx >= this.mw || cy >= this.mh ? -1 : cy * this.mw + cx; }
  /** the legend entry of tile (cx, cy) (null off the map) */
  spec(cx, cy) { return cx < 0 || cy < 0 || cx >= this.mw || cy >= this.mh ? null : this.specs[cy * this.mw + cx]; }
  /** walls, pillars and braziers: nobody walks there (off the map too) */
  solidTile(cx, cy) { if (cx < 0 || cy < 0 || cx >= this.mw || cy >= this.mh) return true; const k = this.kind[cy * this.mw + cx]; return k === WALL || k === PILLAR || k === TORCH; }
  /** the ground's height at (x, y): a floor, a stair's slope, a wall's or pillar's top, `bottom` over a pit (platforms are
   *  not ground: floorAt sees them) */
  ground(x, y) {
    const i = this.index(x, y); if (i < 0) return this.bottom;
    const si = this.stairOf[i];
    if (si >= 0) {
      const s = this.stairs[si], len = (s.dx ? s.x1 - s.x0 + 1 : s.y1 - s.y0 + 1) * T;
      const t = s.dir === 'n' ? ((s.y1 + 1) * T - y) / len : s.dir === 's' ? (y - s.y0 * T) / len : s.dir === 'e' ? (x - s.x0 * T) / len : ((s.x1 + 1) * T - x) / len;
      return s.low + (s.high - s.low) * clamp(t, 0, 1);
    }
    return this.base[i];
  }
  /** the surface a body at height z stands on or falls to at (x, y): the highest ground or platform top no more than 4
   *  units above z, else `bottom` (inside a wall: nothing under it) */
  floorAt(x, y, z = 1e9) {
    const i = this.index(x, y); if (i < 0) return this.bottom;
    let best = this.bottom; const g = this.ground(x, y), p = this.plat[i];
    if (g <= z + 4) best = g;
    if (p > best && p <= z + 4) best = p;
    return best;
  }
  /** the top of whatever stands at (x, y): a wall's, a platform's or the ground (shots, the camera) */
  topH(x, y) { const i = this.index(x, y); return i < 0 ? this.bottom : Math.max(this.ground(x, y), this.plat[i]); }
  /** rectangles covering the tiles with the same key (greedy, rows first): [x0, y0, x1, y1, key] in tiles, inclusive;
   *  key(i) returns null for tiles left out */
  rects(key) {
    const { mw, mh } = this, used = new Uint8Array(mw * mh), out = [];
    for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
      const i = y * mw + x; if (used[i]) continue; const k = key(i); if (k === null || k === undefined) continue;
      let x1 = x; while (x1 + 1 < mw && !used[y * mw + x1 + 1] && key(y * mw + x1 + 1) === k) x1++;
      let y1 = y; for (;;) { const ny = y1 + 1; if (ny >= mh) break; let ok = true; for (let q = x; q <= x1; q++) if (used[ny * mw + q] || key(ny * mw + q) !== k) { ok = false; break; } if (!ok) break; y1 = ny; }
      for (let yy = y; yy <= y1; yy++) for (let xx = x; xx <= x1; xx++) used[yy * mw + xx] = 1;
      out.push([x, y, x1, y1, k]);
    }
    return out;
  }
  /* the walkable grid: from one tile to the next when neither is solid or a pit, and walking the line between their
   * centres never climbs a step higher than STEP_UP (stairs climb gently; a raised floor's edge is a wall from below,
   * a drop from above) */
  _pass() {
    const { mw, mh } = this, pass = new Uint8Array(mw * mh);
    const open = (cx, cy) => !this.solidTile(cx, cy) && this.kind[cy * mw + cx] !== PIT && !this.shapeBlock[cy * mw + cx];   // (a solid shape's tiles: walked round)
    for (let cy = 0; cy < mh; cy++) for (let cx = 0; cx < mw; cx++) {
      if (!open(cx, cy)) continue;
      let bits = 0;
      DIRS8.forEach(([dx, dy], k) => {
        const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= mw || ny >= mh || !open(nx, ny)) return;
        if (dx && dy && (!open(cx + dx, cy) || !open(cx, cy + dy))) return;   // no cutting a corner
        const ax = (cx + .5) * T, ay = (cy + .5) * T; let h = this.ground(ax, ay), ok = true;
        for (let s = 1; s <= 8; s++) { const h2 = this.ground(ax + dx * T * s / 8, ay + dy * T * s / 8); if (h2 - h > STEP_UP) { ok = false; break; } h = h2; }
        if (ok) bits |= 1 << k;
      });
      pass[cy * mw + cx] = bits;
    }
    return pass;
  }
  /** Rapier's fixed colliders for all of it, into a new physics world */
  colliders(pw) {
    const fixed = pw.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const box = (x0, y0, z0, x1, y1, z1, g = GROUPS.level) => pw.createCollider(RAPIER.ColliderDesc.cuboid((x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2).setTranslation((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2).setFriction(.6).setCollisionGroups(g), fixed);
    const hull = pts => pw.createCollider(RAPIER.ColliderDesc.convexHull(new Float32Array(pts.flat())).setFriction(.6).setCollisionGroups(GROUPS.level), fixed);
    // columns: every tile but a pit is solid from below the ground up to its top (a stair's foot: its slope is a wedge)
    const colTop = i => { const k = this.kind[i]; return k === PIT ? null : k === STAIRS ? this.stairs[this.stairOf[i]].low : this.base[i]; };
    for (const [x0, y0, x1, y1, top] of this.rects(colTop)) box(x0 * T, y0 * T, Math.min(top, 0) - 16, (x1 + 1) * T, (y1 + 1) * T, top);
    for (const [x0, y0, x1, y1, k] of this.rects(i => this.plat[i] > -1e8 ? this.plat[i] + ':' + this.platLo[i] : null)) {
      const [top, lo] = k.split(':').map(Number); box(x0 * T, y0 * T, lo, (x1 + 1) * T, (y1 + 1) * T, top, GROUPS.platform);
    }
    for (const s of this.stairs) {   // a wedge: `low` at the foot, `high` at the top side
      const a = s.x0 * T, b = (s.x1 + 1) * T, n = s.y0 * T, so = (s.y1 + 1) * T, L = s.low, Hh = s.high;
      const top = s.dir === 'n' ? [[a, n], [b, n]] : s.dir === 's' ? [[a, so], [b, so]] : s.dir === 'e' ? [[b, n], [b, so]] : [[a, n], [a, so]];
      hull([[a, n, L], [b, n, L], [a, so, L], [b, so, L], ...top.map(([x, y]) => [x, y, Hh])]);
    }
    for (const t of this.torches) pw.createCollider(RAPIER.ColliderDesc.cylinder(6, 5).setRotation(Z_UP).setTranslation(t.x, t.y, t.z + 6).setCollisionGroups(GROUPS.level), fixed);
  }
}

/* ---- the flow field: distances along the walkable grid toward one point, recomputed when the point changes tile ---- */
class Flow {
  /** new Flow(level): world.flow() makes one; flow.to(x, y) aims it, flow.dir(x, y, out) reads it */
  constructor(level) { this.L = level; this.d = new Float32Array(level.mw * level.mh); this.heap = []; this.tx = -1; this.ty = -1; }
  /** aim at (x, y) (engine units); cheap when it stays on the same tile */
  to(x, y) {
    const L = this.L, mw = L.mw, mh = L.mh, tx = Math.floor(x / T), ty = Math.floor(y / T);
    if (tx === this.tx && ty === this.ty) return this; this.tx = tx; this.ty = ty;
    const d = this.d; d.fill(1e9);
    const open = (a, b) => a >= 0 && b >= 0 && a < mw && b < mh && L.pass[b * mw + a];
    const seeds = open(tx, ty) ? [[tx, ty]] : DIRS8.map(([dx, dy]) => [tx + dx, ty + dy]).filter(([a, b]) => open(a, b));   // (standing on a wall: the tiles round it)
    const Hp = this.heap; Hp.length = 0;
    const push = (i, v) => { Hp.push([v, i]); let k = Hp.length - 1; while (k) { const p = (k - 1) >> 1; if (Hp[p][0] <= Hp[k][0]) break; [Hp[p], Hp[k]] = [Hp[k], Hp[p]]; k = p; } };
    const pop = () => { const top = Hp[0], last = Hp.pop(); if (Hp.length) { Hp[0] = last; let k = 0; for (;;) { const l = k * 2 + 1, r = l + 1; let m = k; if (l < Hp.length && Hp[l][0] < Hp[m][0]) m = l; if (r < Hp.length && Hp[r][0] < Hp[m][0]) m = r; if (m === k) break; [Hp[m], Hp[k]] = [Hp[k], Hp[m]]; k = m; } } return top; };
    for (const [a, b] of seeds) { d[b * mw + a] = 0; push(b * mw + a, 0); }
    while (Hp.length) {
      const [v, i] = pop(); if (v > d[i]) continue;
      const cx = i % mw, cy = (i / mw) | 0;
      DIRS8.forEach(([dx, dy], k) => {   // walk backwards: a neighbour reaches i if its own step toward i is passable
        const nx = cx - dx, ny = cy - dy; if (nx < 0 || ny < 0 || nx >= mw || ny >= mh) return;
        const j = ny * mw + nx; if (!(L.pass[j] & (1 << k))) return;
        const w = v + (dx && dy ? 1.414 : 1); if (w < d[j]) { d[j] = w; push(j, w); }
      });
    }
    return this;
  }
  /** the ground direction to walk from (x, y) toward the target, as [x, y] in out (length 1), or null (there already,
   *  off the grid, or no way there: walk straight) */
  dir(x, y, out = [0, 0]) {
    const L = this.L, mw = L.mw, cx = Math.floor(x / T), cy = Math.floor(y / T), i = cy * mw + cx;
    if (cx < 0 || cy < 0 || cx >= mw || cy >= L.mh) return null;
    const here = this.d[i]; if (!(here < 1e9) || here === 0) return null;
    let best = here, bx = 0, by = 0; const bits = L.pass[i];
    DIRS8.forEach(([dx, dy], k) => { if (!(bits & (1 << k))) return; const v = this.d[(cy + dy) * mw + cx + dx]; if (v < best) { best = v; bx = dx; by = dy; } });
    if (!bx && !by) return null;
    const tx = (cx + bx + .5) * T - x, ty = (cy + by + .5) * T - y, l = Math.hypot(tx, ty) || 1;
    out[0] = tx / l; out[1] = ty / l; return out;
  }
  /** steps from (x, y) to the target along the grid (1e9: no way) */
  distance(x, y) { const i = this.L.index(x, y); return i < 0 ? 1e9 : this.d[i]; }
}

/* ---- the level's meshes: the ground baked once (contact shadows at the foot of what stands taller), side faces merged
 *      per look, walls and pillars instanced (cut low or to stumps by the view camera), stairs, platforms, braziers ---- */
Level.prototype.meshes = function (world) {
  const L = this, { mw, mh, def } = L, scene = world.scene, own = x => world._own(x);
  const mat = (key, make) => world._mat(key, make);
  const sideStyle = sp => sp.side || def.side || ((sp.ground || def.ground) === 'grass' ? 'earth' : 'block');
  const sideMat = (style, sp) => { const S = SIDE[style] || SIDE.block, c = sideColors(style, Object.assign({}, def.colors, sp)); return mat('side:' + style + ':' + JSON.stringify(c), () => lambert(own(bake((x, y) => S.fn(x, y, c), S.w, S.h)))); };
  const topMat = color => mat('top:' + color, () => { const tt = E.tones(color), base = H(color), sh = H(tt.sh), lt = H(tt.lt); return lambert(own(bake((x, y) => { const v = E.hash2(x * 3 + 71, y * 5 + 37); return v < .08 ? sh : v > .96 ? lt : base; }, 16, 16))); });
  const add = m => { scene.add(m); return m; };

  /* the ground: every surface seen from above (floors, raised floors, platform tops) in one texture, a pixel per unit
   * (fewer on a level over 128 tiles), with the glow of what gives off light (lava, runes) as its emissive map */
  const ppu = Math.min(1, 2048 / Math.max(L.width, L.depth)), w = Math.round(L.width * ppu), h = Math.round(L.depth * ppu);
  const cv = document.createElement('canvas'), gv = document.createElement('canvas'); cv.width = gv.width = w; cv.height = gv.height = h;
  const g = cv.getContext('2d'), gg = gv.getContext('2d'), img = g.createImageData(w, h), gimg = gg.createImageData(w, h), d = img.data, gd = gimg.data;
  const looks = new Array(mw * mh);
  const lookOf = i => looks[i] || (looks[i] = (() => {
    const sp = L.specs[i], st = sp.ground || def.ground || 'flagstone', o = Object.assign({}, def.colors, sp.colors, sp);
    return { fn: typeof st === 'function' ? st : GROUND[st] || GROUND.flagstone, o };
  })());
  const R = 5;
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    const x = (px + .5) / ppu, y = (py + .5) / ppu, cx = Math.floor(x / T), cy = Math.floor(y / T), i = cy * mw + cx, k = L.kind[i];
    if (k === WALL || k === PILLAR || k === STAIRS || (k === PIT && L.plat[i] < -1e8)) continue;
    const lk = lookOf(i); let c = lk.fn(x, y, lk.o); if (!c) continue;
    const s = L.plat[i] > -1e8 ? L.plat[i] : L.base[i], lx = x - cx * T, ly = y - cy * T;
    if (L.plat[i] < -1e8) {   // a contact shadow at the foot of anything taller beside it
      const taller = (a, b) => a >= 0 && b >= 0 && a < mw && b < mh && L.topH((a + .5) * T, (b + .5) * T) > s + 4;
      let ao = 0;
      if (taller(cx - 1, cy)) ao = Math.max(ao, 1 - lx / R); if (taller(cx + 1, cy)) ao = Math.max(ao, 1 - (T - lx) / R);
      if (taller(cx, cy - 1)) ao = Math.max(ao, 1 - ly / R); if (taller(cx, cy + 1)) ao = Math.max(ao, 1 - (T - ly) / R);
      if (ao > 0) { const q = 1 - .4 * Math.round(ao * 5) / 5; c = [c[0] * q, c[1] * q * .98, c[2] * q * 1.02, c[3]]; }
    }
    const j = (py * w + px) * 4, glow = clamp(c[3] || 0, 0, 1);
    d[j] = c[0]; d[j + 1] = c[1]; d[j + 2] = c[2]; d[j + 3] = 255;
    gd[j] = c[0] * glow; gd[j + 1] = c[1] * glow; gd[j + 2] = c[2] * glow; gd[j + 3] = 255;
  }
  g.putImageData(img, 0, 0); gg.putImageData(gimg, 0, 0);
  const floorMat = new THREE.MeshLambertNodeMaterial({ map: own(canvasTex(cv, false)), emissiveMap: own(canvasTex(gv, false)), emissive: '#ffffff', emissiveIntensity: 1.6 });
  world._own(floorMat);
  /** a flat polygon at height z (points in units) wearing the ground texture where it stands */
  const floorPoly = (pts, z) => {
    const pos = [], uvs = [], idx = [];
    for (const [x, y] of pts) { pos.push(x / U, z / U, y / U); uvs.push(x / L.width, 1 - y / L.depth); }
    for (let i = 1; i < pts.length - 1; i++) idx.push(0, i + 1, i);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    return own(geo);
  };
  L.floorPoly = floorPoly; L.floorMat = floorMat;
  const merge = new Merger();
  for (const [x0, y0, x1, y1, z] of L.rects(i => L.kind[i] === FLOOR || L.kind[i] === TORCH ? L.base[i] : null))
    merge.add(floorPoly([[x0 * T, y0 * T], [(x1 + 1) * T, y0 * T], [(x1 + 1) * T, (y1 + 1) * T], [x0 * T, (y1 + 1) * T]], z), [0, 0, 0], floorMat, false);

  /* side faces: wherever a floor stands higher than its neighbour (a raised floor, a ledge, the edge of a pit), one quad
   * on that edge from the neighbour's height (a pit: 80 units down) up to its own, in the floor's side look */
  const quads = new Map();
  const edgeH = (cx, cy, x, y) => { if (cx < 0 || cy < 0 || cx >= mw || cy >= mh) return null; const k = L.kind[cy * mw + cx]; return k === WALL || k === PILLAR ? null : k === PIT ? -1e9 : L.ground(x, y); };
  for (let cy = 0; cy < mh; cy++) for (let cx = 0; cx < mw; cx++) {
    const i = cy * mw + cx, k = L.kind[i]; if (k !== FLOOR && k !== TORCH) continue;
    const s = L.base[i], sp = L.specs[i], style = sideStyle(sp);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ex = (cx + .5 + dx * .5) * T, ey = (cy + .5 + dy * .5) * T;
      let ns = edgeH(cx + dx, cy + dy, ex + dx * .5, ey + dy * .5); if (ns === null) { if (cx + dx >= 0 && cx + dx < mw && cy + dy >= 0 && cy + dy < mh) continue; ns = -1e9; }
      if (s - ns < .01) continue;
      const lo = Math.max(ns, s - 80, L.bottom);
      // the edge's ends, left then right as seen from outside (from the neighbour, looking in)
      const px0 = dx ? ex : cx * T, py0 = dy ? ey : cy * T, px1 = dx ? ex : (cx + 1) * T, py1 = dy ? ey : (cy + 1) * T;
      const [A, Bp] = dx === 1 || dy === -1 ? [[px1, py1], [px0, py0]] : [[px0, py0], [px1, py1]];
      const key = style + ':' + JSON.stringify(sideColors(style, Object.assign({}, def.colors, sp)));
      let q = quads.get(key); if (!q) quads.set(key, q = { style, sp, pos: [], uv: [] });
      const Sh = (SIDE[style] || SIDE.block).h, v = z => 1 - (s - z) / Sh;
      const P = (p, z) => [p[0] / U, z / U, p[1] / U];
      q.pos.push(...P(A, lo), ...P(Bp, lo), ...P(Bp, s), ...P(A, lo), ...P(Bp, s), ...P(A, s));
      q.uv.push(0, v(lo), 1, v(lo), 1, 1, 0, v(lo), 1, 1, 0, 1);
    }
  }
  for (const q of quads.values()) {
    const geo = own(new THREE.BufferGeometry()); geo.setAttribute('position', new THREE.Float32BufferAttribute(q.pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(q.uv, 2)); geo.computeVertexNormals();
    const m = add(new THREE.Mesh(geo, sideMat(q.style, q.sp))); m.receiveShadow = m.castShadow = true;
  }

  /* walls: an instanced box per tile, and a short twin shown where the wall is cut low in front of a view camera */
  L.wallTypes = [];
  for (const ch of new Set(L.rows.join(''))) {
    const cells = [];
    for (let cy = 0; cy < mh; cy++) for (let cx = 0; cx < mw; cx++) if (L.rows[cy][cx] === ch && L.kind[cy * mw + cx] === WALL) {
      // which way it faces out of the level (away from the floor beside it): a camera on that side looks over it
      let ox = (L.solidTile(cx - 1, cy) ? 0 : -1) + (L.solidTile(cx + 1, cy) ? 0 : 1), oy = (L.solidTile(cx, cy - 1) ? 0 : -1) + (L.solidTile(cx, cy + 1) ? 0 : 1);
      ox = -ox; oy = -oy; if (!ox && !oy) { ox = cx < mw / 2 ? -1 : 1; oy = cy < mh / 2 ? -1 : 1; }
      const l = Math.hypot(ox, oy); cells.push({ cx, cy, ox: ox / l, oy: oy / l, z: L.specs[cy * mw + cx].floor || 0 });
    }
    if (!cells.length) continue;
    const sp = L.specs[cells[0].cy * mw + cells[0].cx], hh = sp.wall, style = sp.side || def.wallSide || 'brick', c = Object.assign({ color: '#3d3750', top: '#57506a', line: '#2a2538' }, sp);
    const mats = [sideMat(style, c), topMat(c.top)];
    const mk = hgt => { const geo = own(sidesThenTops(boxGeo(T, T, hgt))), m = add(new THREE.InstancedMesh(geo, mats, cells.length)); m.castShadow = m.receiveShadow = true; m.frustumCulled = false; m.count = 0; return m; };
    L.wallTypes.push({ cells, h: hh, full: mk(hh), cut: hh > CUT_H + 4 && sp.cut !== false ? mk(CUT_H) : null, key: '' });
  }
  L.placeWalls('none', null);

  /* pillars: a plinth, a shaft of dressed stone and a capital on each block of pillar tiles (cut to a stump between a
   * view camera and the hero) */
  L.pillars = []; L.pillarTypes = [];
  const byChar = new Map();
  for (const r of L.rects(i => L.kind[i] === PILLAR ? L.chars(i) : null)) { if (!byChar.has(r[4])) byChar.set(r[4], []); byChar.get(r[4]).push(r); }
  for (const list of byChar.values()) {
    const [x0, y0, x1, y1] = list[0], sp = L.specs[y0 * mw + x0], hh = sp.pillar, w0 = (x1 - x0 + 1) * T, d0 = (y1 - y0 + 1) * T, fl = sp.floor || 0, col = sp.color || '#4a4360';
    const shaft = sideMat('block', { color: col }), cap = topMat(sp.top || '#6a6280'), edge = sideMat('brick', { color: E.shade(col, .08), line: '#302a40' });
    const parts = [[1.06, 0, 6, edge, cap], [.875, 6, hh - 8, shaft, shaft], [1.06, hh - 8, hh - 4, edge, cap], [1.19, hh - 4, hh, edge, cap]].map(([k, z0, z1, m1, m2]) => {
      const m = add(new THREE.InstancedMesh(own(sidesThenTops(boxGeo(w0 * k, d0 * k, z1 - z0))), [m1, m2], list.length)); m.castShadow = m.receiveShadow = true; m.frustumCulled = false;
      return { m, z0, z1 };
    });
    const type = { parts, pillars: list.map(([a, b, c, d]) => ({ x0: a * T, y0: b * T, x1: (c + 1) * T, y1: (d + 1) * T, z0: fl, z1: fl + hh, sx: (c - a + 1) * T / w0, sy: (d - b + 1) * T / d0, stump: null })) };
    L.pillarTypes.push(type); L.pillars.push(...type.pillars);
  }
  L.placePillars(null);

  /* stairs: steps of dressed stone, two to a tile, from the foot up */
  for (const s of L.stairs) {
    const a = s.x0 * T, b = (s.x1 + 1) * T, n = s.y0 * T, so = (s.y1 + 1) * T, along = s.dx ? b - a : so - n, steps = Math.max(2, Math.round(along / 8)), run = along / steps;
    const c = Object.assign({ color: '#4a4360' }, s.sp), mats = [sideMat(s.sp.side || 'brick', Object.assign({}, c, { color: E.shade(c.color, .04) })), sideMat('block', { color: E.shade(c.color, .14) })];
    const lo = Math.min(0, s.low);
    for (let k = 0; k < steps; k++) {
      const top = s.low + (s.high - s.low) * (k + 1) / steps, at = (k + .5) * run;
      const cx = s.dir === 'e' ? a + at : s.dir === 'w' ? b - at : (a + b) / 2, cy = s.dir === 's' ? n + at : s.dir === 'n' ? so - at : (n + so) / 2;
      const gw = s.dx ? run : b - a, gd = s.dx ? so - n : run;
      merge.add(sidesThenTops(boxGeo(gw, gd, top - lo)), [cx / U, (lo + top) / 2 / U, cy / U], mats);
    }
  }

  /* platforms in the text: a slab, its top the ground's texture */
  for (const [x0, y0, x1, y1] of L.rects(i => L.plat[i] > -1e8 ? L.plat[i] + ':' + L.platLo[i] + ':' + L.chars(i) : null)) {
    const i = y0 * mw + x0, sp = L.specs[i], top = L.plat[i], lo = L.platLo[i], a = x0 * T, b = (x1 + 1) * T, n = y0 * T, so = (y1 + 1) * T;
    const style = sp.side || 'planks', mats = [sideMat(style, sp), sideMat(style, Object.assign({}, sp, { color: E.shade(sp.color || STYLE_COLORS[style] || '#8f5f37', -.2) }))];
    merge.add(sidesThenTops(boxGeo(b - a, so - n, top - lo - .2)), [(a + b) / 2 / U, (lo + top - .2) / 2 / U, (n + so) / 2 / U], mats);
    merge.add(floorPoly([[a, n], [b, n], [b, so], [a, so]], top), [0, 0, 0], floorMat, false);
  }
  merge.build(scene, own);

  /* braziers: a stone base, an iron bowl, glowing coals and three flame tongues each, in a few instanced meshes */
  const NT = Math.max(1, L.torches.length), inst = (geo, m, n, shadow) => { const im = add(new THREE.InstancedMesh(own(geo), m, n)); im.frustumCulled = false; im.count = 0; im.castShadow = im.receiveShadow = !!shadow; return im; };
  L.braz = {
    base: inst(new THREE.BoxGeometry(6 / U, 8 / U, 6 / U), world._obj(new THREE.MeshLambertNodeMaterial({ color: '#4c4562' })), NT, false),
    bowl: inst(new THREE.CylinderGeometry(5.5 / U, 4.2 / U, 3 / U, 10), world._obj(new THREE.MeshLambertNodeMaterial({ color: '#2b2430' })), NT, false),
    coals: inst(new THREE.CylinderGeometry(4 / U, 4 / U, .4 / U, 10), world._obj(new THREE.MeshBasicNodeMaterial({ color: '#ff8a3c' })), NT, false),
    outer: inst(new THREE.ConeGeometry(2.2 / U, 1, 5), world._obj(new THREE.MeshBasicNodeMaterial({ color: '#ff7a2a' })), NT * 3, false),
    inner: inst(new THREE.ConeGeometry(2.2 / U, 1, 5), world._obj(new THREE.MeshBasicNodeMaterial({ color: '#ffd36a' })), NT * 3, false)
  };
};
/** stand the walls: full height, or cut low where cut(cell) says (a cell: { cx, cy, ox, oy }, its outward direction) */
Level.prototype.placeWalls = function (key, cut) {
  for (const W of this.wallTypes) {
    if (W.key === key) continue; W.key = key;
    let nf = 0, nc = 0;
    for (const c of W.cells) {
      const isCut = W.cut && cut && cut(c), hh = isCut ? CUT_H : W.h;
      (isCut ? W.cut : W.full).setMatrixAt(isCut ? nc++ : nf++, _m4.makeTranslation(c.cx + .5, (c.z + hh / 2) / U, c.cy + .5));   // (a tile is a metre)
    }
    W.full.count = nf; W.full.instanceMatrix.needsUpdate = true; if (W.cut) { W.cut.count = nc; W.cut.instanceMatrix.needsUpdate = true; }
  }
};
/** stand the pillars whole, or cut to stumps where cut(pillar) says */
Level.prototype.placePillars = function (cut) {
  for (const type of this.pillarTypes) {
    let changed = false;
    type.pillars.forEach((p, i) => {
      const stump = !!(cut && cut(p)); if (stump === p.stump) return; p.stump = stump; changed = true;
      for (const part of type.parts) {
        const z1 = stump ? Math.min(part.z1, part.z0 > 0 ? 14 : part.z1) : part.z1, hh = Math.max(0, z1 - part.z0), full = part.z1 - part.z0;
        part.m.setMatrixAt(i, hh > 0 ? _m4.compose(_v0.set((p.x0 + p.x1) / 2 / U, (p.z0 + part.z0 + hh / 2) / U, (p.y0 + p.y1) / 2 / U), _q0.identity(), _s0.set(p.sx, hh / full, p.sy)) : _m4.makeScale(0, 0, 0));
      }
    });
    if (changed) for (const part of type.parts) part.m.instanceMatrix.needsUpdate = true;
  }
};
/** the braziers' flames dance (the 2D hall's: three tongues, each with its own height and sway) */
Level.prototype.animateBraziers = function (dt) {
  const B = this.braz, n = this.torches.length;
  for (let i = 0; i < n; i++) {
    const b = this.torches[i]; b.t += dt; const x = b.x / U, z = b.y / U, y0 = b.z / U, t = b.t;
    B.base.setMatrixAt(i, _m4.makeTranslation(x, y0 + 4 / U, z)); B.bowl.setMatrixAt(i, _m4.makeTranslation(x, y0 + 9.5 / U, z)); B.coals.setMatrixAt(i, _m4.makeTranslation(x, y0 + 11.1 / U, z));
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + t * .6, hh = (7 + Math.sin(t * 9 + k * 2) * 2.2 + Math.sin(t * 17 + k) * 1.2) / U, sw = Math.sin(t * 6 + k * 1.7) * 1.4 / U, bx = x + Math.cos(a) * 1.6 / U, bz = z + Math.sin(a) * 1.6 / U;
      _q0.setFromAxisAngle(_v0.set(0, 0, 1), -sw * 3);
      B.outer.setMatrixAt(i * 3 + k, _m4.compose(_v0.set(bx + sw * .5, y0 + 11 / U + hh / 2, bz), _q0, _s0.set(1, hh, 1)));
      B.inner.setMatrixAt(i * 3 + k, _m4.compose(_v0.set(bx + sw * .3, y0 + 11 / U + hh * .65 / 2, bz), _q0, _s0.set(.55, hh * .65, .55)));
    }
  }
  for (const [k, m] of Object.entries(B)) { m.count = k === 'outer' || k === 'inner' ? n * 3 : n; m.instanceMatrix.needsUpdate = true; }
};

/* =============================================================================
 * 4. PARTS DRAWN BY CODE  instanced batches of four shapes (tube, ball, box, cone) in a toon look with outlines, and
 *    two that glow (glow, halo); a pen that draws with them in engine units. Puppets, things and anything a game draws
 *    in 3D go through them, so thousands of parts cost a handful of draw calls
 * ============================================================================= */
const FLASH = lin('#ffe6d8'), BLACKISH = lin('#1a1320');
/** an instanced batch of one shape: parts are written between begin() and end() */
class Batch {
  constructor(scene, geo, mat, o = {}) { this.scene = scene; this.geo = geo; this.mat = mat; this.o = o; this.cap = 0; this.n = 0; this.grow(o.cap || 1024); }
  grow(cap) {
    const old = this.mesh, sc = this.scene;
    const mk = mat => { const m = new THREE.InstancedMesh(this.geo, mat, cap); m.frustumCulled = false; m.count = 0; sc.add(m); return m; };
    const mesh = mk(this.mat);
    // (no DynamicDrawUsage: in r182 an instanced mesh over 1,000 slots marked dynamic never uploads its changes)
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    mesh.castShadow = mesh.receiveShadow = !!this.o.shadow; mesh.renderOrder = this.o.order || 0;
    if (old) { mesh.instanceMatrix.array.set(old.instanceMatrix.array); mesh.instanceColor.array.set(old.instanceColor.array); sc.remove(old); old.dispose(); }
    if (this.shell) { sc.remove(this.shell); this.shell.dispose(); }
    this.shell = this.o.outline ? mk(this.o.shellMat) : null;
    if (this.shell) this.shell.instanceMatrix = mesh.instanceMatrix;   // the outline shares the parts' matrices
    this.mesh = mesh; this.M = mesh.instanceMatrix.array; this.C = mesh.instanceColor.array; this.cap = cap;
  }
  begin() { this.n = 0; }
  /** one part from its basis columns (x, y, z axes with their lengths) and its centre, three.js metres */
  put(ax, ay, az, bx, by, bz, cx, cy, cz, tx, ty, tz, col) {
    if (this.n >= this.cap) this.grow(this.cap * 2);
    const M = this.M, i = this.n * 16, k = this.n * 3; this.n++;
    M[i] = ax; M[i + 1] = ay; M[i + 2] = az; M[i + 3] = 0; M[i + 4] = bx; M[i + 5] = by; M[i + 6] = bz; M[i + 7] = 0;
    M[i + 8] = cx; M[i + 9] = cy; M[i + 10] = cz; M[i + 11] = 0; M[i + 12] = tx; M[i + 13] = ty; M[i + 14] = tz; M[i + 15] = 1;
    this.C[k] = col[0]; this.C[k + 1] = col[1]; this.C[k + 2] = col[2];
  }
  /** a tube (or the cone) from a to b, radius r (metres) */
  tube(a, b, r, col) {
    let dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2]; const L = Math.hypot(dx, dy, dz); if (L < 1e-5) return;
    dx /= L; dy /= L; dz /= L;
    let px = Math.abs(dy) < .95 ? -dz : 0, py = Math.abs(dy) < .95 ? 0 : dz, pz = Math.abs(dy) < .95 ? dx : -dy; const pl = Math.hypot(px, py, pz); px /= pl; py /= pl; pz /= pl;
    const qx = py * dz - pz * dy, qy = pz * dx - px * dz, qz = px * dy - py * dx;
    this.put(px * r, py * r, pz * r, dx * L, dy * L, dz * L, qx * r, qy * r, qz * r, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, col);
  }
  ball(p, rx, ry, rz, col) { this.put(rx, 0, 0, 0, ry, 0, 0, 0, rz, p[0], p[1], p[2], col); }
  /** a box from a to b (its length), w wide along `across` (a unit vector), t thick (metres) */
  box(a, b, across, w, t, col) {
    let dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2]; const L = Math.hypot(dx, dy, dz) || 1e-4; dx /= L; dy /= L; dz /= L;
    let zx = across[1] * dz - across[2] * dy, zy = across[2] * dx - across[0] * dz, zz = across[0] * dy - across[1] * dx; const zl = Math.hypot(zx, zy, zz) || 1; zx /= zl; zy /= zl; zz /= zl;
    const xx = dy * zz - dz * zy, xy = dz * zx - dx * zz, xz = dx * zy - dy * zx;
    this.put(xx * w, xy * w, xz * w, dx * L, dy * L, dz * L, zx * t, zy * t, zz * t, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, col);
  }
  end(outlines) {
    const m = this.mesh; m.count = this.n;
    m.instanceMatrix.clearUpdateRanges(); m.instanceMatrix.addUpdateRange(0, Math.max(1, this.n) * 16); m.instanceMatrix.needsUpdate = true;
    m.instanceColor.clearUpdateRanges(); m.instanceColor.addUpdateRange(0, Math.max(1, this.n) * 3); m.instanceColor.needsUpdate = true;
    if (this.shell) this.shell.count = outlines ? this.n : 0;
  }
}
function makeBatches(world) {
  const sc = world.scene, obj = m => world._obj(m), TOON = obj(new THREE.MeshToonNodeMaterial({ color: '#ffffff', gradientMap: TOON_BANDS })), shell = { normal: obj(outlineMat('normal')), center: obj(outlineMat('center')) };
  return {
    tube: new Batch(sc, new THREE.CylinderGeometry(.85, 1, 1, 7, 1, true), TOON, { outline: 'normal', shellMat: shell.normal, shadow: true, cap: 2048 }),
    ball: new Batch(sc, new THREE.SphereGeometry(1, 9, 6), TOON, { outline: 'normal', shellMat: shell.normal, shadow: true, cap: 2048 }),
    box: new Batch(sc, new THREE.BoxGeometry(1, 1, 1), TOON, { outline: 'center', shellMat: shell.center, shadow: true }),
    cone: new Batch(sc, new THREE.ConeGeometry(1, 1, 6), TOON, { outline: 'normal', shellMat: shell.normal, shadow: true }),
    glow: new Batch(sc, new THREE.SphereGeometry(1, 8, 6), obj(new THREE.MeshBasicNodeMaterial({ color: '#ffffff' }))),
    halo: new Batch(sc, new THREE.SphereGeometry(1, 10, 7), new THREE.MeshBasicNodeMaterial({ color: '#ffffff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), { order: 2 }),
    blob: new Batch(sc, new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicNodeMaterial({ color: '#ffffff', transparent: true, opacity: .45, depthWrite: false }), { order: 1 })
  };
}
const _pa = [0, 0, 0], _pb = [0, 0, 0];
/**
 * the pen: draws shapes in engine units, in a frame you set with at(x, y, z, yaw, size) (yaw turns it about z, from +x
 * toward +y). Colors are '#rrggbb'. world.pen in a draw (before world.draw(r)), and every thing's drawing, use it:
 *   ball(x, y, z, rx, ry, rz, color)   a ball (an egg: three radii along the frame's x, y and z)
 *   box(x, y, z, w, d, h, color, yaw)  a box centred at (x, y, z): w along x, d along y, h up, turned by yaw more
 *   tube(x0, y0, z0, x1, y1, z1, r, color), cone(x0, y0, z0, x1, y1, z1, r, color) (base to tip)
 *   bar(x0, y0, z0, x1, y1, z1, w, t, color)   a flat bar from one point to the other (a blade, a plank), w wide, t thick
 *   glow(x, y, z, r, color), halo(x, y, z, r, color)   unlit: a glowing ball, and light that adds round it
 */
class Pen {
  constructor(world) { this.world = world; this.B = null; this.at(0, 0, 0); this.flash = false; }
  /** set the frame: origin (x, y, z) in engine units, turned by yaw (radians) about z, scaled by k; returns the pen */
  at(x = 0, y = 0, z = 0, yaw = 0, k = 1) { this.ox = x; this.oy = y; this.oz = z; this.ca = Math.cos(yaw); this.sa = Math.sin(yaw); this.k = k; return this; }
  _p(x, y, z, out) { const k = this.k; out[0] = (this.ox + (x * this.ca - y * this.sa) * k) / U; out[1] = (this.oz + z * k) / U; out[2] = (this.oy + (x * this.sa + y * this.ca) * k) / U; return out; }
  _c(color) { const c = typeof color === 'string' ? lin(color) : color; return this.flash ? [lerp(c[0], FLASH[0], .4), lerp(c[1], FLASH[1], .4), lerp(c[2], FLASH[2], .4)] : c; }
  _rot(B, rx, ry, rz, yaw, x, y, z, color) {
    const ca = Math.cos(yaw) * this.ca - Math.sin(yaw) * this.sa, sa = Math.sin(yaw) * this.ca + Math.cos(yaw) * this.sa, k = this.k / U;
    this._p(x, y, z, _pa);
    B.put(ca * rx * k, 0, sa * rx * k, 0, rz * k, 0, -sa * ry * k, 0, ca * ry * k, _pa[0], _pa[1], _pa[2], this._c(color));
  }
  ball(x, y, z, rx, ry = rx, rz = rx, color = '#ffffff') { this._rot(this.B.ball, rx, ry, rz, 0, x, y, z, color); return this; }
  box(x, y, z, w, d, h, color = '#ffffff', yaw = 0) { this._rot(this.B.box, w, d, h, yaw, x, y, z, color); return this; }
  tube(x0, y0, z0, x1, y1, z1, r, color = '#ffffff') { this.B.tube.tube(this._p(x0, y0, z0, _pa), this._p(x1, y1, z1, _pb), r * this.k / U, this._c(color)); return this; }
  cone(x0, y0, z0, x1, y1, z1, r, color = '#ffffff') { this.B.cone.tube(this._p(x0, y0, z0, _pa), this._p(x1, y1, z1, _pb), r * this.k / U, this._c(color)); return this; }
  bar(x0, y0, z0, x1, y1, z1, w, t, color = '#ffffff') {
    const a = this._p(x0, y0, z0, _pa), b = this._p(x1, y1, z1, _pb), hx = b[0] - a[0], hz = b[2] - a[2], l = Math.hypot(hx, hz);
    this.B.box.box(a, b, l > 1e-6 ? [-hz / l, 0, hx / l] : [1, 0, 0], w * this.k / U, t * this.k / U, this._c(color)); return this;
  }
  glow(x, y, z, r, color = '#ffffff') { const k = r * this.k / U; this.B.glow.ball(this._p(x, y, z, _pa), k, k, k, typeof color === 'string' ? lin(color) : color); return this; }
  halo(x, y, z, r, color = '#ffffff') { const k = r * this.k / U; this.B.halo.ball(this._p(x, y, z, _pa), k, k, k, typeof color === 'string' ? lin(color) : color); return this; }
}

/* =============================================================================
 * 5. THINGS  pickups and set dressing drawn by code with the pen: world.thing(kind, x, y, z, o). A thing has
 *    { kind, x, y, z, yaw, spin (turns a second), bob (units it floats up and down), size, color, open (0..1: a chest's
 *    lid, a door), on, visible, t (its own clock) }. Add a kind: World3D.THINGS.lamp = (pen, t) => pen.tube(...)...
 *    (local units: z up from the thing's base, x its front)
 * ============================================================================= */
const THINGS = {
  coin(p, t) { p.ball(0, 0, 6, 4, 1.1, 4, t.color || '#ffd34a').ball(0, 0, 6, 2.6, 1.4, 2.6, '#ffe98a').box(0, 0, 6, 1, 1.6, 3.2, '#c8901e'); },
  gem(p, t) { const c = t.color || '#4ae0ff'; p.cone(0, 0, 6, 0, 0, 11, 3.6, c).cone(0, 0, 6, 0, 0, 1, 3.6, E.shade(c, -.25)).glow(0, 0, 6, .9, '#ffffff'); },
  heart(p, t) { const c = t.color || '#ff4a5a'; p.ball(-1.7, 0, 7, 2.4, 1.4, 2.4, c).ball(1.7, 0, 7, 2.4, 1.4, 2.4, c).cone(0, 0, 6.6, 0, 0, 1.6, 3.4, c).ball(-1.8, -.8, 8, .8, .6, .8, '#ffd0d6'); },
  key(p, t) { const c = t.color || '#ffd34a'; p.ball(0, 0, 9, 2.6, .9, 2.6, c).ball(0, -.2, 9, 1.3, 1.1, 1.3, '#3a2a1a').tube(0, 0, 6.6, 0, 0, 1.2, .8, c).box(1.2, 0, 2, 2, 1, 1, c).box(1.2, 0, 4, 1.6, 1, 1, c); },
  star(p, t) {
    const c = t.color || '#ffe24a'; p.ball(0, 0, 8, 2.4, 1.6, 2.4, c);
    for (let k = 0; k < 5; k++) { const a = k * TAU / 5 - Math.PI / 2; p.cone(Math.cos(a) * 1.5, 0, 8 - Math.sin(a) * 1.5, Math.cos(a) * 6.5, 0, 8 - Math.sin(a) * 6.5, 2, c); }
    p.ball(-.9, -1.3, 8.6, .5, .4, .7, '#3a2a10').ball(.9, -1.3, 8.6, .5, .4, .7, '#3a2a10');
  },
  potion(p, t) { const c = t.color || '#ff5aa8'; p.ball(0, 0, 3.6, 3.2, 3.2, 3.2, c).tube(0, 0, 6, 0, 0, 8.6, 1.2, '#cfe6f0').box(0, 0, 9.2, 1.8, 1.8, 1.4, '#9a6a3a').ball(-1.2, -1.6, 4.6, .7, .5, .7, '#ffffff'); },
  chest(p, t) {   // the lid turns up about its back edge as it opens
    const o = clamp(t.open || 0, 0, 1), a = o * 1.9, w = 14, d = 10, hb = 7, wood = t.color || '#8a5a30', trim = '#e8b84a';
    p.box(0, 0, hb / 2, w, d, hb, wood).box(0, 0, hb / 2, w + .4, d + .4, 1.4, trim);
    p.bar(0, d / 2, hb + 2, 0, d / 2 - d * Math.cos(a), hb + 2 + d * Math.sin(a), w, 4, E.shade(wood, .1));
    if (o < .2) p.box(0, -d / 2 - .3, hb - .6, 2, .8, 2.4, trim);
    if (o > .3) p.glow(0, 0, hb + 2, 2.4 * o, '#fff2a8').halo(0, 0, hb + 3, 7 * o, [.5, .4, .1]);
  },
  door(p, t) {   // a frame and a gate that slides up as it opens; t.w wide (32), t.h tall (40)
    const w = t.w || 32, h = t.h || 40, o = clamp(t.open || 0, 0, 1), c = t.color || '#6a4a2e', stone = '#5a5470';
    p.box(-w / 2 - 2, 0, h / 2, 4, 8, h, stone).box(w / 2 + 2, 0, h / 2, 4, 8, h, stone).box(0, 0, h + 2, w + 8, 8, 4, stone);
    if (o < 1) { const z0 = o * (h - 2); p.box(0, 0, z0 + (h - z0) / 2, w, 3, h - z0, c); for (let x = -w / 2 + 4; x < w / 2; x += 6) p.box(x, -1.8, z0 + (h - z0) / 2, 1, .6, h - z0, E.shade(c, -.3)); if (t.locked) p.ball(0, -2.4, z0 + h * .45 * (1 - o), 2.2, 1, 2.6, '#ffd34a'); }
  },
  flag(p, t) { const c = t.color || '#ff4a3a', w = Math.sin((t.t || 0) * 5) * 1.5; p.tube(0, 0, 0, 0, 0, 44, .8, '#d8d8e0').ball(0, 0, 44.5, 1.4, 1.4, 1.4, '#ffd34a'); p.bar(0, 0, 38, 12, w, 37, 8, 1, c); },
  sign(p, t) { p.box(0, 0, 6, 1.6, 1.6, 12, '#6a4a2e').box(0, 0, 13, 14, 1.4, 8, t.color || '#9d6a3f').box(0, -.8, 13, 10, .3, 1, '#3a2614').box(0, -.8, 11.4, 8, .3, 1, '#3a2614'); },
  lever(p, t) { const a = (t.on ? .7 : -.7); p.box(0, 0, 1.5, 8, 6, 3, '#5a5470').tube(0, 0, 2.5, Math.sin(a) * 8, 0, 2.5 + Math.cos(a) * 8, .7, '#b8b8c8').ball(Math.sin(a) * 8, 0, 2.5 + Math.cos(a) * 8, 1.6, 1.6, 1.6, t.on ? '#4ae070' : '#ff4a3a'); },
  pad(p, t) { const c = t.color || '#4ae0ff', on = t.on ? 1 : 0; p.box(0, 0, .8, 14, 14, 1.6, '#5a5470').box(0, 0, 1.8 - on * .6, 10, 10, 1, on ? E.shade(c, .2) : c); if (on) p.halo(0, 0, 3, 7, lin(c).map(v => v * .4)); },
  spring(p, t) { const s = 1 - clamp(t.squash || 0, 0, .7); p.box(0, 0, 1, 12, 12, 2, '#5a5470'); for (let k = 0; k < 4; k++) p.ball(0, 0, 3 + k * 2 * s, 4.4, 4.4, .8, '#b8b8c8'); p.box(0, 0, 3 + 8 * s, 12, 12, 1.8, t.color || '#ff4a3a'); },
  tree(p, t) { const c = t.color || '#3f8a3a', k = t.big || 1; p.tube(0, 0, 0, 0, 0, 22 * k, 2.4 * k, '#6a4a2e').cone(0, 0, 12 * k, 0, 0, 34 * k, 11 * k, c).cone(0, 0, 22 * k, 0, 0, 42 * k, 8.5 * k, E.shade(c, .1)).cone(0, 0, 31 * k, 0, 0, 49 * k, 5.5 * k, E.shade(c, .2)); },
  bush(p, t) { const c = t.color || '#4a9a42'; p.ball(0, 0, 4, 6, 6, 4.6, c).ball(3.6, 1, 5.4, 4, 4, 3.6, E.shade(c, .12)).ball(-3.4, -1, 5, 4.2, 4.2, 3.4, E.shade(c, -.08)); },
  rock(p, t) { const c = t.color || '#7a7488'; p.ball(0, 0, 3, 6, 5, 4, c).ball(2.4, -1.6, 5.4, 3, 3, 2.4, E.shade(c, .14)); },
  mushroom(p, t) { const c = t.color || '#e84a3a'; p.tube(0, 0, 0, 0, 0, 7, 1.8, '#efe4cc').ball(0, 0, 7.5, 6, 6, 3.6, c).ball(2.6, -2, 9.4, 1.2, 1.2, .8, '#ffffff').ball(-2.4, 1.4, 9.6, 1.1, 1.1, .8, '#ffffff'); },
  fence(p, t) { const c = t.color || '#9d6a3f'; p.box(-7, 0, 6, 1.6, 1.6, 12, c).box(7, 0, 6, 1.6, 1.6, 12, c).box(0, 0, 9, 16, 1, 2, E.shade(c, .1)).box(0, 0, 4.6, 16, 1, 2, E.shade(c, .1)); },
  crystal(p, t) { const c = t.color || '#9a6aff'; for (const [x, y, hh, r] of [[0, 0, 16, 3.4], [3.4, 1.6, 10, 2.4], [-3, -1, 8, 2]]) p.cone(x, y, 0, x * 1.2, y * 1.2, hh, r, c); p.halo(0, 0, 8, 8, lin(c).map(v => v * .25)); }
};
/** a thing's size from its kind: where its base sits and how wide it is (for pickups' reach: world.touching) */
const THING_R = { coin: 5, gem: 5, heart: 5, key: 5, star: 7, potion: 5, chest: 9, door: 18, flag: 4, sign: 7, lever: 5, pad: 8, spring: 7 };

/* =============================================================================
 * 5b. SHAPES  the 2D engine's shapes (docs/ASSETS.md: E.SHAPES ids, a store set's 'SET:id', or an entry) in 3D, from the
 *     same resolved parts (E.shapeMesh): each kind (an entry with its params, mats and mirror) is one instanced mesh, all
 *     of them in one toon material whose texture is an atlas of the materials' patterns (E.materialTile) at world scale,
 *     so a new kind or placement builds no shader. A solid one gets a fixed collider from the box the 2D engine collides
 *     with (E.shapeBox)
 * ============================================================================= */
const SH_TILE = 32, SH_PX = 2, SH_N = SH_TILE * SH_PX, SH_ATLAS = 1024, SH_PER = SH_ATLAS / SH_N, SH_CAP = 1024;   // 256 tiles, each 32 units square
function shapeKit(world) {
  const cv = document.createElement('canvas'); cv.width = cv.height = SH_ATLAS;
  const g = cv.getContext('2d'), tex = world._own(canvasTex(cv, false)), { attribute, texture, fract } = TSL;
  // a corner's tile in the atlas (x, y, w, h in uv) and its own uv in tiles: the pattern repeats inside its tile
  const tile = attribute('tile', 'vec4'), col = texture(tex, tile.xy.add(fract(attribute('uv', 'vec2')).mul(tile.zw)));
  const mat = world._obj(new THREE.MeshToonNodeMaterial({ gradientMap: TOON_BANDS }));
  mat.colorNode = col; mat.emissiveNode = col.rgb.mul(attribute('glow', 'float'));
  const shell = world._obj(outlineMat('normal')), tiles = new Map(), ids = new WeakMap(); let nTile = 0, nId = 0;
  /** a material's tile (its pattern on a side or a lid, turned or flat; a face pattern's whole face, 16 units), drawn into
   *  the atlas the first time: [x, y, w, h] in uv */
  const tileOf = (m, lid, curved, face) => {
    const key = (ids.get(m.q) || (ids.set(m.q, ++nId), nId)) + (lid ? 'L' : 'S') + (curved ? 'C' : '') + (face ? 'F' : ''); let t = tiles.get(key); if (t) return t;
    const i = nTile++ % (SH_PER * SH_PER), tx = i % SH_PER, ty = Math.floor(i / SH_PER), px = E.materialTile(m.q, { size: face ? 16 : SH_TILE, px: face ? SH_N / 16 : SH_PX, lid, curved });
    if (nTile > SH_PER * SH_PER) E.warn('3d:shape-tiles', 'more than ' + SH_PER * SH_PER + ' materials on shapes: the first are drawn over');
    if (px) { const img = g.createImageData(px.w, px.h); img.data.set(px.rgba); g.putImageData(img, tx * SH_N, ty * SH_N); tex.needsUpdate = true; }
    tiles.set(key, t = [(tx * SH_N + .5) / SH_ATLAS, 1 - (ty * SH_N + SH_N - .5) / SH_ATLAS, (SH_N - 1) / SH_ATLAS, (SH_N - 1) / SH_ATLAS]); return t;
  };
  /** the geometries from E.shapeMesh's groups: three's axes (metres, y up), each triangle wound to face its normal; and
   *  the outline's, the same corners with the normals averaged where faces meet (a box's outline closes round its corners;
   *  as 'normal', instancing turns them with the placement) */
  const build = (M, flip) => {
    const pos = [], nrm = [], uv = [], tl = [], gl = [], fx = flip ? -1 : 1;
    for (const G of M.groups) {
      const t = tileOf(G.mat, G.lid, G.curved, G.face), glow = G.mat.glow ? 1 : 0, P = G.pos, N = G.nrm, V = G.uv;
      const uvOf = q => G.face ? clamp(q, .001, .999) : q / SH_TILE;   // (a face pattern: once across its face)
      for (let i = 0; i < P.length; i += 9) {
        const c = [0, 1, 2].map(k => [P[i + k * 3] * fx / U, P[i + k * 3 + 2] / U, P[i + k * 3 + 1] / U]), n = [0, 1, 2].map(k => [N[i + k * 3] * fx, N[i + k * 3 + 2], N[i + k * 3 + 1]]);
        const a = c[0], e1 = [c[1][0] - a[0], c[1][1] - a[1], c[1][2] - a[2]], e2 = [c[2][0] - a[0], c[2][1] - a[1], c[2][2] - a[2]];
        const cx = e1[1] * e2[2] - e1[2] * e2[1], cy = e1[2] * e2[0] - e1[0] * e2[2], cz = e1[0] * e2[1] - e1[1] * e2[0];
        const order = cx * (n[0][0] + n[1][0] + n[2][0]) + cy * (n[0][1] + n[1][1] + n[2][1]) + cz * (n[0][2] + n[1][2] + n[2][2]) < 0 ? [0, 2, 1] : [0, 1, 2];
        for (const k of order) { pos.push(...c[k]); nrm.push(...n[k]); const j = (i / 3 + k) * 2; uv.push(uvOf(V[j]), uvOf(V[j + 1])); tl.push(...t); gl.push(glow); }
      }
    }
    const at = new Map(), onrm = new Float32Array(nrm.length), kk = i => Math.round(pos[i] * 1e4) + ',' + Math.round(pos[i + 1] * 1e4) + ',' + Math.round(pos[i + 2] * 1e4);
    for (let i = 0; i < pos.length; i += 3) { const k = kk(i), a = at.get(k) || [0, 0, 0]; a[0] += nrm[i]; a[1] += nrm[i + 1]; a[2] += nrm[i + 2]; at.set(k, a); }
    for (let i = 0; i < pos.length; i += 3) {   // (faces that cancel, two discs back to back: the corner's own normal)
      let a = at.get(kk(i)), l = Math.hypot(a[0], a[1], a[2]); if (l < 1e-4) { a = nrm.slice(i, i + 3); l = 1; }
      onrm[i] = a[0] / l; onrm[i + 1] = a[1] / l; onrm[i + 2] = a[2] / l;
    }
    const geo = world._own(new THREE.BufferGeometry()), sgeo = world._own(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setAttribute('tile', new THREE.Float32BufferAttribute(tl, 4)); geo.setAttribute('glow', new THREE.Float32BufferAttribute(gl, 1));
    sgeo.setAttribute('position', geo.attributes.position); sgeo.setAttribute('normal', new THREE.BufferAttribute(onrm, 3));
    return [geo, sgeo];
  };
  /** an instanced mesh and its outline for the geometries, its slots growing as placements come */
  const meshes = ([geo, sgeo], cap) => {
    const m = new THREE.InstancedMesh(geo, mat, cap), o = new THREE.InstancedMesh(sgeo, shell, cap);
    m.frustumCulled = o.frustumCulled = false; m.castShadow = m.receiveShadow = true; m.count = o.count = 0; o.instanceMatrix = m.instanceMatrix;
    world.scene.add(m); world.scene.add(o); return [m, o];
  };
  const kinds = new Map(), _m = new THREE.Matrix4(), _s = new THREE.Vector3();
  // the probe: one empty triangle in the same material, so the warm-up builds the shapes' shaders before any is placed
  const pg = new THREE.BufferGeometry(), psg = new THREE.BufferGeometry(), z3 = n => new THREE.Float32BufferAttribute(new Array(n * 3).fill(0), n);
  for (const [k, n] of [['position', 3], ['normal', 3], ['uv', 2], ['tile', 4], ['glow', 1]]) pg.setAttribute(k, z3(n));
  for (const k of ['position', 'normal']) psg.setAttribute(k, z3(3));
  // (every mesh starts with SH_CAP slots: three reads more than 1,000 instances from an attribute, the same shader at any
  // count; fewer come from a uniform array sized in the shader's code, a new pipeline at each size)
  const [probe, probeShell] = meshes([world._own(pg), world._own(psg)], SH_CAP);
  return {
    probe, probeShell, kinds,
    /** the kind for an id and placement (made once): { mesh, shell, list (its placements), cap } */
    kind(id, o) {
      const key = (typeof id === 'string' ? id : 'e' + (ids.get(id) || (ids.set(id, ++nId), nId))) + '|' + JSON.stringify([o.params || null, o.mats || null, !!o.flip]);
      let K = kinds.get(key); if (K) return K;
      const M = E.shapeMesh(id, { params: o.params, mats: o.mats }); if (!M) return null;
      const [mesh, sh] = meshes(build(M, o.flip), SH_CAP); kinds.set(key, K = { mesh, shell: sh, list: [], cap: SH_CAP, bounds: M.bounds }); return K;
    },
    /** write a placement's slot: at (x, y, z), turned to its facing, scaled */
    put(K, p) {
      if (p.i >= K.cap) {   // more slots: a bigger mesh with the same geometry (the old one's placements copied over)
        const [m2, o2] = meshes([K.mesh.geometry, K.shell.geometry], K.cap * 2); m2.instanceMatrix.array.set(K.mesh.instanceMatrix.array);
        for (const x of [K.mesh, K.shell]) { world.scene.remove(x); x.dispose(); }
        K.mesh = m2; K.shell = o2; K.cap *= 2;
      }
      const k = p.scale, a = p.facing - Math.PI / 2;   // (three's y is the engine's z: a turn about z is one about y, the other way)
      _m.makeRotationY(-a).scale(_s.set(k, k, k)).setPosition(p.x / U, p.z / U, p.y / U);
      K.mesh.setMatrixAt(p.i, _m); K.mesh.count = K.shell.count = Math.max(K.mesh.count, p.i + 1); K.mesh.instanceMatrix.needsUpdate = true;
    },
    /** take a placement out: the last one moves into its slot */
    take(K, p) {
      const last = K.list.pop(); if (last !== p) { K.list[p.i] = last; last.i = p.i; K.mesh.getMatrixAt(K.list.length, _m); K.mesh.setMatrixAt(p.i, _m); }
      K.mesh.count = K.shell.count = K.list.length; K.mesh.instanceMatrix.needsUpdate = true;
    },
    clear() { for (const K of kinds.values()) { K.list.length = 0; K.mesh.count = K.shell.count = 0; } },
    outlines(on) { for (const K of kinds.values()) K.shell.visible = on; }
  };
}

/* =============================================================================
 * 6. CHARACTERS DRAWN  each rig as it stands (the game poses it; this only reads it), as a Puppet (3D parts on the
 *    rig's joints, sized from its build and colored from its palette) or a Card (the 2D engine draws the rig, exactly as
 *    in the 2D games, from the camera's own turn and tilt, onto a card standing where it is). Blobs (slimes) squash as
 *    they do in 2D; orbs ({ color, r }) glow. A blob shadow lies on the surface under every body
 * ============================================================================= */
const P3 = Array.from({ length: 24 }, () => [0, 0, 0]);   // scratch points, three.js metres
let _ca, _sa, _k, _kz, _rx, _ry, _rz, _sink = 0;
function frame(rig) { const a = rig.facing + (rig.spin || 0); _ca = Math.cos(a); _sa = Math.sin(a); const sz = rig.o.size || 1; _k = (1 - (rig.sq || 0) * .4) * sz; _kz = (1 + (rig.sq || 0)) * sz; _rx = rig.x; _ry = rig.y; _rz = rig.z || 0; }
/** a rig's local point (forward, right, up) plus an offset in the body's frame -> three.js metres */
function wp(p, out, df = 0, dr = 0, dz = 0) {
  const f = p[0] + df, r = p[1] + dr, z = p[2] + dz;
  out[0] = ((f * _ca - r * _sa) * _k + _rx) / U; out[1] = (z * _kz + _rz + _sink) / U; out[2] = ((f * _sa + r * _ca) * _k + _ry) / U;
  return out;
}
const lerp3 = (a, b, t, out) => { out[0] = a[0] + (b[0] - a[0]) * t; out[1] = a[1] + (b[1] - a[1]) * t; out[2] = a[2] + (b[2] - a[2]) * t; return out; };
/** a rig's colors as linear RGB, tinted toward the hit flash (cached on the rig) */
function cols(rig, flash) {
  const key = flash ? '_c3f' : '_c3'; if (rig[key] && rig[key + 'C'] === rig.C) return rig[key];
  const out = {}; for (const [k, v] of Object.entries(rig.C)) if (typeof v === 'string' && v[0] === '#') { const c = lin(v); out[k] = flash ? [lerp(c[0], FLASH[0], .3), lerp(c[1], FLASH[1], .3), lerp(c[2], FLASH[2], .3)] : c; }
  rig[key + 'C'] = rig.C; return (rig[key] = out);
}
/** a Humanoid's parts, sized from its build as its own drawing sizes them */
function humanParts(B, rig, flash) {
  const o = rig.o, J = rig.J, C = cols(rig, flash), classic = o.style === 'classic', bones = !!o.skeleton;
  const lw = classic ? .45 : Math.max(.55, o.limbW / 2), R = o.headR, u = 1 / U;
  frame(rig);
  const [hipL, hipR, knL, knR, ftL, ftR, hipC, shC, shL, shR, head, elL, elR, hdL, hdR, t0, t1, t2, t3, t4, t5] = P3;
  wp(J.hipL, hipL); wp(J.hipR, hipR); wp(J.kneeL, knL); wp(J.kneeR, knR); wp(J.footL, ftL); wp(J.footR, ftR);
  wp(J.hipC, hipC, 0, 0, .8); wp(J.shC, shC, 0, 0, -.4); wp(J.shL, shL); wp(J.shR, shR); wp(J.head, head);
  wp(J.elbowL, elL); wp(J.elbowR, elR); wp(J.handL, hdL); wp(J.handR, hdR);
  const upper = o.sleeves === 'none' || bones ? C.skin : C.cloth, lower = o.sleeves === 'long' ? C.cloth : C.skin;
  for (const [hip, kn, ft, J0] of [[hipL, knL, ftL, J.footL], [hipR, knR, ftR, J.footR]]) {   // legs: thigh, shin, boot to the toe
    lerp3(kn, ft, .62, t0); wp(J0, t1, 1.9, 0, .3);
    B.tube.tube(hip, kn, 1.35 * lw * u, C.pants); B.ball.ball(kn, 1.2 * lw * u, 1.2 * lw * u, 1.2 * lw * u, C.pants);
    B.tube.tube(kn, t0, 1.15 * lw * u, C.pants); B.tube.tube(t0, t1, 1.1 * lw * u, C.boot); B.ball.ball(t0, 1.1 * lw * u, 1.1 * lw * u, 1.1 * lw * u, C.boot);
  }
  B.tube.tube(hipL, hipR, 1.4 * lw * u, C.pants);
  const plate = o.armor ? C.plate || C.metal : null;
  B.tube.tube(hipC, shC, (bones ? .55 : classic ? .5 : .68) * o.torsoW * u, plate || (bones ? C.skin : C.cloth));   // the torso (a knight's breastplate, a skeleton's ribs)
  B.tube.tube(shL, shR, 1.15 * lw * u, plate || upper);
  if (!bones && !classic) { wp(J.hipL, t2, 0, -.3, .7); wp(J.hipR, t3, 0, .3, .7); B.tube.tube(t2, t3, o.torsoW * .7 * u, C.belt); }
  for (const [sh, el, hd] of [[shL, elL, hdL], [shR, elR, hdR]]) {   // arms
    B.tube.tube(sh, el, 1.1 * lw * u, upper); B.ball.ball(el, lw * u, lw * u, lw * u, upper);
    B.tube.tube(el, hd, .95 * lw * u, lower); B.ball.ball(hd, .85 * lw * u, .85 * lw * u, .85 * lw * u, C.glove || C.skin);
    if (o.armor) B.ball.ball(sh, 1.5 * u, 1.5 * u, 1.5 * u, plate);
  }
  // the head: the face, the hair (or a helmet) behind and above it, the eyes (glowing for husks and skeletons)
  wp(J.shC, t0, 0, 0, -.2); wp(J.head, t1, 0, 0, -R * .6); B.tube.tube(t0, t1, .7 * u, C.skin);
  wp(J.head, t0, R * .1, 0, -R * .05); B.ball.ball(t0, R * .9 * u, R * .9 * u, R * .9 * u, C.skin);
  const hat = o.hat && o.hat.style === 'helmet';
  if (hat) { wp(J.head, t1, -R * .05, 0, R * .12); const hc = flash ? FLASH : lin(o.hat.color || '#737c90'); B.ball.ball(t1, R * 1.02 * u, R * .98 * u, R * 1.02 * u, hc); }
  else if (!bones && o.hair && o.hair.style !== 'bald') { wp(J.head, t1, -R * .32, 0, R * .16); B.ball.ball(t1, R * .95 * u, R * .95 * u, R * .95 * u, C.hair); }
  const glow = o.eyeGlow ? lin(o.eyeGlow) : null;
  for (const sd of [-1, 1]) { wp(J.head, t2, R * .86, sd * R * .36, -R * .02); if (glow) B.glow.ball(t2, .55 * u, .55 * u, .55 * u, glow); else B.ball.ball(t2, .4 * u, .45 * u, .4 * u, BLACKISH); }
  if (o.weapon === 'sword') {   // the blade along the weapon's direction (J.bladeDir), flat across the swing, and its guard
    const bd = J.bladeDir, Lb = o.bladeLen, hx = J.handR[0], hy = J.handR[1], hz = J.handR[2];
    wp(J.handR, t0, bd[0] * 1.5, bd[1] * 1.5, bd[2] * 1.5); wp(J.handR, t1, bd[0] * Lb, bd[1] * Lb, bd[2] * Lb);
    const fl = Math.hypot(bd[0], bd[1]) > 1e-3 ? [-bd[1], bd[0]] : [0, 1]; wp([hx + fl[0], hy + fl[1], hz], t2); wp(J.handR, t3);
    const ax = t2[0] - t3[0], ay = t2[1] - t3[1], az = t2[2] - t3[2], al = Math.hypot(ax, ay, az) || 1; t4[0] = ax / al; t4[1] = ay / al; t4[2] = az / al;
    B.box.box(t0, t1, t4, 1.3 * u, .3 * u, C.metal || lin('#dce8f1'));
    wp(J.handR, t2, bd[0] * 1.2, bd[1] * 1.2, bd[2] * 1.2); wp(J.handR, t5, bd[0] * 1.7, bd[1] * 1.7, bd[2] * 1.7); B.box.box(t2, t5, t4, 3.4 * u, .5 * u, C.hilt || lin('#e8b04e'));
  }
}
/** a Blob (slime): its body squashed as the Blob squashes, eyes looking where it looks, horns, ears or wings */
function blobParts(B, a, flash, sink) {
  const b = a.blob, o = b.o, R = o.R * (b.scale || 1), sq = b.sq || 0, ka = 1 - sq * .55, hk = 1 + sq, C = b.C, u = 1 / U;
  const base = flash ? FLASH : lin(C.base), dk = lin(C.dk), x = a.x / U, z = a.y / U, y = ((a.z || 0) + R * hk + sink) / U;
  const [c, p] = P3; c[0] = x; c[1] = y; c[2] = z;
  B.ball.ball(c, R * ka * u, R * hk * u, R * ka * u, base);
  const look = b.look || [Math.cos(a.facing), Math.sin(a.facing)], la = Math.atan2(look[1], look[0]), fx = Math.cos(la), fz = Math.sin(la);
  for (const s of [-1, 1]) {   // eyes: white, a pupil in front (a squint is a dark slit)
    const ea = la + s * .42; p[0] = x + Math.cos(ea) * R * ka * .86 * u; p[1] = y + R * hk * .2 * u; p[2] = z + Math.sin(ea) * R * ka * .86 * u;
    if (b.squint) { B.ball.ball(p, 1.1 * u, .3 * u, 1.1 * u, lin(C.pupil)); continue; }
    B.ball.ball(p, 1.25 * u, 1.6 * u, 1.25 * u, lin(C.eye)); p[0] += fx * .9 * u; p[2] += fz * .9 * u; B.ball.ball(p, .7 * u, 1 * u, .7 * u, lin(C.pupil));
  }
  if (o.horns || o.ears) for (const s of [-1, 1]) {   // horns and cat ears: cones on top, toward the sides
    const sa = la + s * Math.PI / 2, bx = x + Math.cos(sa) * R * ka * .45 * u, bz = z + Math.sin(sa) * R * ka * .45 * u, by = y + R * hk * .7 * u;
    const ht = (o.horns ? .9 : .75) * R * u, tip = [bx + Math.cos(sa) * ht * .35, by + ht, bz + Math.sin(sa) * ht * .35];
    B.cone.tube([bx, by, bz], tip, R * .3 * u, o.horns ? lin(C.horn || '#e8dcc0') : dk);
  }
  if (o.wings) for (const s of [-1, 1]) {   // bat wings: they open on the hop and beat (the Blob's flap)
    const sa = la + s * Math.PI / 2, f = Math.sin(b.flapP || 0) * .5 + .5, fold = Math.min(1, (b.flap ?? 1) * 2), span = R * (.8 + (.9 + f * .5) * fold) * u;
    const root = [x + Math.cos(sa) * R * ka * .6 * u, y, z + Math.sin(sa) * R * ka * .6 * u], tip = [root[0] + Math.cos(sa) * span, y + (1.2 - f * 1.3) * fold * R * .6 * u, root[2] + Math.sin(sa) * span];
    B.box.box(root, tip, [fx, 0, fz], R * .9 * u, .25 * u, dk);
  }
}
/** an orb ({ color, r, core }): a glowing ball, a halo and three motes circling it (the stress test's wisps) */
function orbParts(B, a, t) {
  const o = a.orb, r = (o.r || 3.2) * (o.swell || 1), u = 1 / U, fade = clamp(a.fade, 0, 1), c = lin(o.color || '#c78bff');
  const [p, q] = P3; p[0] = a.x / U; p[1] = (a.z + (o.lift ?? 0)) / U; p[2] = a.y / U;
  B.glow.ball(p, r * u, r * u, r * u, a.flash > 0 ? [1, 1, 1] : c);
  B.halo.ball(p, r * 1.45 * u, r * 1.45 * u, r * 1.45 * u, c.map(v => v * .4 * fade));
  const dot = lin(o.core || '#f4e6ff');
  for (let i = 0; i < 3; i++) { const an = t * 4 + i * TAU / 3; q[0] = p[0] + Math.cos(an) * r * 1.9 * u; q[1] = p[1] + Math.sin(an * 1.3) * 2 * u; q[2] = p[2] + Math.sin(an) * r * 1.9 * u; B.glow.ball(q, .7 * u, .7 * u, .7 * u, dot); }
}
/* capes: every rig's cloth in one mesh (two rows of points from the rig's cape chains) */
function makeCapes(world) {
  const SLOT = 8, mat = world._obj(new THREE.MeshToonNodeMaterial({ color: '#ffffff', gradientMap: TOON_BANDS, vertexColors: true, side: THREE.DoubleSide }));
  let cap = 0, mesh = null, pos, col, n = 0;
  function grow(c) {
    cap = c; pos = new Float32Array(cap * SLOT * 2 * 3); col = new Float32Array(cap * SLOT * 2 * 3);
    const idx = []; for (let s = 0; s < cap; s++) for (let i = 0; i < SLOT - 1; i++) { const a = (s * SLOT + i) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(idx);
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(pos.length), 3));
    if (mesh) { world.scene.remove(mesh); mesh.geometry.dispose(); }
    mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.castShadow = true; world.scene.add(mesh);
  }
  grow(16);
  return {
    get mesh() { return mesh; },
    begin() { n = 0; },
    add(rig, sink, flash) {
      const Lc = rig.capeL, Rc = rig.capeR; if (!Lc) return;
      if (n >= cap) { const p0 = pos, c0 = col; grow(cap * 2); pos.set(p0); col.set(c0); }
      const c = flash ? FLASH : lin(rig.C.cape), base = n * SLOT * 2 * 3;
      for (let i = 0; i < SLOT; i++) {
        const j = Math.min(i, Lc.length - 1), a = Lc[j], b = Rc[j], o = base + i * 6;
        pos[o] = a.x / U; pos[o + 1] = (a.z + sink) / U; pos[o + 2] = a.y / U; pos[o + 3] = b.x / U; pos[o + 4] = (b.z + sink) / U; pos[o + 5] = b.y / U;
        col[o] = col[o + 3] = c[0]; col[o + 1] = col[o + 4] = c[1]; col[o + 2] = col[o + 5] = c[2];
      }
      n++;
    },
    end() { const g = mesh.geometry; mesh.visible = n > 0; g.setDrawRange(0, n * (SLOT - 1) * 6); g.attributes.position.needsUpdate = g.attributes.color.needsUpdate = true; g.computeVertexNormals(); }
  };
}
/* ---- cards: the engine's own drawings in atlas pages (fixed 512+ pixel canvases, each its own texture and instanced
 *      mesh, made when first needed and kept; only the pages used upload each frame; every page compiles to the same
 *      shader: each card's cell comes from a per-card attribute, and each page has room for over 1,000 cards (three
 *      r182 keeps the matrices of an instanced mesh with 1,000 or fewer in a uniform buffer named after the mesh, which
 *      makes every such mesh's shader its own) ---- */
const CARD_QUAD = new THREE.PlaneGeometry(1, 1), CARD_RECT = TSL.attribute('cardRect', 'vec4');
function makeAtlas(world) {
  const pages = [], scene = world.scene;
  let P = 0, cell = 0, ncol = 0, per = 0, n = 0, key = '';
  function page(i) {
    if (pages[i]) return pages[i];
    const cv = document.createElement('canvas'), out = document.createElement('canvas'); cv.width = cv.height = out.width = out.height = P;
    const tex = canvasTex(out, false), room = Math.max(per, 1001), rect = new THREE.InstancedBufferAttribute(new Float32Array(room * 4), 4), geo = CARD_QUAD.clone(); geo.setAttribute('cardRect', rect);
    const mat = world._obj(new THREE.MeshBasicNodeMaterial({ alphaTest: .5 }));
    mat.colorNode = TSL.texture(tex).sample(TSL.uv().mul(CARD_RECT.zw).add(CARD_RECT.xy));
    const mesh = new THREE.InstancedMesh(geo, mat, room); mesh.frustumCulled = false; mesh.count = 0; scene.add(mesh);
    return (pages[i] = { cv, out, g: cv.getContext('2d'), go: out.getContext('2d'), tex, rect, mesh, M: mesh.instanceMatrix.array, n: 0, rows: 0 });
  }
  function reset() { for (const pg of pages) { scene.remove(pg.mesh); pg.mesh.dispose(); pg.mesh.geometry.dispose(); pg.mesh.material.dispose(); pg.tex.dispose(); } pages.length = 0; }
  return {
    /** start a frame: the cell size from the cards' view scale */
    begin(view) {
      cell = Math.ceil(64 * view.scale / 8) * 8;
      let size = 512; while (size < 4 * cell && size < 2048) size *= 2;
      if (size + ':' + cell !== key) { reset(); key = size + ':' + cell; P = size; }
      ncol = Math.floor(P / cell); per = ncol * ncol; n = 0;
      for (const pg of pages) { if (pg.rows) pg.g.clearRect(0, 0, P, pg.rows * cell); pg.n = 0; }
    },
    /** draw one character into the next cell (draw(g, ox, oy) as the 2D engine's actors draw) and stand its card at
     *  (x, y, z) engine units; false when the atlas is full */
    add(x, y, z, draw, flash, alpha, v) {
      if (n >= 64 * per) return false;
      const pg = page(Math.floor(n / per)), j = pg.n, g = pg.g;
      const cx = (j % ncol) * cell, cy = Math.floor(j / ncol) * cell, ox = cx + cell / 2, oy = cy + Math.round(cell * .72);
      g.save(); g.beginPath(); g.rect(cx + 1, cy + 1, cell - 2, cell - 2); g.clip();
      if (alpha < 1) g.globalAlpha = alpha;
      try { draw(g, ox, oy); } finally { g.restore(); }
      if (flash) { g.save(); g.beginPath(); g.rect(cx, cy, cell, cell); g.clip(); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = .3; g.fillStyle = '#ffe6d8'; g.fillRect(cx, cy, cell, cell); g.restore(); }
      // the cell's size in the world (v.ppm: the cards' pixels per metre), its root on the rig's root, facing the camera,
      // pushed toward the camera so the floor can't cut its feet
      const ppm = v.ppm, w = cell / ppm, h = cell / (ppm * v.vert);
      const dx = (cell / 2 - (ox - cx)) / ppm, dy = ((oy - cy) - cell / 2) / (ppm * v.vert);
      const r = v.right, up = v.up, bk = v.back, i = j * 16;
      const tx = x / U + r.x * dx + up.x * dy + bk.x * .45, ty = z / U + r.y * dx + up.y * dy + bk.y * .45, tz = y / U + r.z * dx + up.z * dy + bk.z * .45;
      const A = pg.M; A[i] = r.x * w; A[i + 1] = r.y * w; A[i + 2] = r.z * w; A[i + 3] = 0; A[i + 4] = up.x * h; A[i + 5] = up.y * h; A[i + 6] = up.z * h; A[i + 7] = 0;
      A[i + 8] = bk.x; A[i + 9] = bk.y; A[i + 10] = bk.z; A[i + 11] = 0; A[i + 12] = tx; A[i + 13] = ty; A[i + 14] = tz; A[i + 15] = 1;
      const q = pg.rect.array, k = j * 4; q[k] = cx / P; q[k + 1] = 1 - (cy + cell) / P; q[k + 2] = cell / P; q[k + 3] = cell / P;
      pg.n++; n++; return true;
    },
    /** finish: each used page's outline (each sprite grown by `thick` pixels in the outline color, under it) over its
     *  used rows, and one upload per used page */
    end(outlines, thick = 1) {
      const t = Math.max(1, Math.round(thick)), d = Math.max(1, Math.round(t * .7));
      const OFFS = t === 1 ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : [[t, 0], [-t, 0], [0, t], [0, -t], [d, d], [-d, d], [d, -d], [-d, -d]];
      for (const pg of pages) {
        const rows = Math.ceil(pg.n / ncol), hNow = rows * cell, hWas = pg.rows * cell, go = pg.go;
        if (hWas) go.clearRect(0, 0, P, hWas);
        if (pg.n) {
          if (outlines) { for (const [dx, dy] of OFFS) go.drawImage(pg.cv, 0, 0, P, hNow, dx, dy, P, hNow); go.globalCompositeOperation = 'source-in'; go.fillStyle = OUTLINE; go.fillRect(0, 0, P, hNow + t); go.globalCompositeOperation = 'source-over'; }
          go.drawImage(pg.cv, 0, 0, P, hNow, 0, 0, P, hNow);
        }
        if (pg.n || hWas) pg.tex.needsUpdate = true;
        pg.rows = rows; pg.mesh.count = pg.n;
        if (pg.n) {
          pg.mesh.instanceMatrix.clearUpdateRanges(); pg.mesh.instanceMatrix.addUpdateRange(0, pg.n * 16); pg.mesh.instanceMatrix.needsUpdate = true;
          pg.rect.clearUpdateRanges(); pg.rect.addUpdateRange(0, pg.n * 4); pg.rect.needsUpdate = true;
        }
      }
    },
    /** make the first k pages now, so the first frames of a crowd don't */
    prepare(view, k) { this.begin(view); for (let i = 0; i < k; i++) page(i); },
    get pages() { return pages; }, dispose: reset
  };
}

/* =============================================================================
 * 7. CAMERA  world.camera: every camera a real 3D one, its pose worked out in the game's fixed steps (so the controls
 *    that read it play back the same), its picture placed when the world draws.
 *      'view'   the 2D engine's views as 3D cameras following the target (camera.target: the first hero unless set), a
 *               little ahead of its aim with the 2D camera's lag: game.view (V cycles it), game.yaw ([ ] turn it),
 *               game.zoom (the wheel, a pinch, Settings: Camera zoom). proj 'persp' (a lens, camera.fov) or 'ortho'
 *               (the 2D engine's flat projection); dist pulls it back. Walls between the level and the camera are cut
 *               low, pillars between it and the target cut to stumps (camera.cut false keeps them)
 *      'chase'  behind the target and above it: it swings round behind as the target moves (chase.auto), turns with
 *               [ ], the mouse once a click captures it (Esc frees it); game.zoom pulls it in; it slides in front of
 *               walls rather than through them
 *      'first'  the target's eyes (its body isn't drawn), 'fly' a free camera the move stick flies (jump up, dash
 *               down), 'fixed' stays where camera.fixed says ({ x, y, z, yaw, pitch, fov })
 *    camera.ground(move) -> the move stick turned to the ground ([x, y], W walks away from the camera);
 *    camera.aim(actor) -> the angle the mouse (on the floor) or right stick points from it, or null;
 *    camera.heading: the ground angle it looks along; camera.pose: { x, y, z, yaw, pitch, fov, ortho } now
 * ============================================================================= */
const headingOf = yawDeg => Math.atan2(-Math.cos(yawDeg * DEG), -Math.sin(yawDeg * DEG));
const engineYaw = a => ((Math.round(Math.atan2(-Math.cos(a), -Math.sin(a)) / DEG) % 360) + 360) % 360;
class Camera3D {
  /** made by the world: new E.World3D(game, { camera: { mode, proj, fov, dist, lag, lead, chase, first } }) */
  constructor(world, o = {}) {
    /** mode: 'view' | 'chase' | 'first' | 'fly' | 'fixed'; proj: 'persp' | 'ortho' (view mode); fov: the view lens
     *  (degrees); dist: how far back a view stands (1 frames the 2D game's picture); lag: seconds the focus trails the
     *  target; lead: units ahead of its aim; target: the actor (or { x, y, z }) followed; cut: walls and pillars cut
     *  away in view mode */
    Object.assign(this, { world, mode: o.mode || 'view', proj: o.proj || 'persp', fov: o.fov || 40, dist: o.dist || 1, lag: o.lag ?? .18, lead: o.lead ?? 16, target: o.target || null, cut: o.cut !== false });
    /** chase: { pitch (radians, - looks down), dist (units), fov, height (units above the feet it looks at), auto (swings
     *  round behind the target as it moves) }; first: { pitch, fov }; fly: { x, y, z, yaw, pitch, fov }; fixed: a pose */
    this.chase = Object.assign({ pitch: -.36, dist: 88, fov: 60, height: 24, auto: true }, o.chase);
    this.first = Object.assign({ pitch: -.08, fov: 75 }, o.first);
    this.fly = { x: 0, y: 0, z: 90, yaw: -Math.PI / 2, pitch: -.32, fov: 70 }; this.fixed = o.fixed || null;
    /** yaw: the heading of the chase, first and fly cameras (radians, the ground angle they look along); locked: the
     *  mouse is captured (pointer lock) and turns them; mouseLook: false never captures it */
    this.yaw = o.yaw ?? -Math.PI / 2; this.locked = false; this.mouseLook = o.mouseLook !== false;
    this.focus = null; this.smooth = null; this.eyeZ = 24; this.pose = null; this._gyaw = null; this._held = 0;
    this.persp = new THREE.PerspectiveCamera(40, 1, .1, 600); this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 2000); this.cam = this.persp;
    /** the cards' view of the world: the camera's axes in three.js space, the cards' pixels per metre, its turn and tilt */
    this.cv = { right: new THREE.Vector3(), up: new THREE.Vector3(1, 0, 0), back: new THREE.Vector3(), q: new THREE.Quaternion(), ppm: 24, vert: 1, thick: 1, scale: 1.5, yaw: 0, pitch: 45 };
    this._fr = new THREE.Frustum(); this._views = new Map();
  }
  /** switch mode, keeping the way it looks where it can ('view' -> 'chase' looks the same way) */
  set(mode) {
    if (!['view', 'chase', 'first', 'fly', 'fixed'].includes(mode) || mode === this.mode) return this;
    const p = this.pose, was = this.mode;
    if (p && mode !== 'view') this.yaw = p.yaw;
    if (mode === 'fly' && p) Object.assign(this.fly, was === 'first' ? { x: p.x - Math.cos(p.yaw) * 56, y: p.y - Math.sin(p.yaw) * 56, z: p.z + 26, yaw: p.yaw, pitch: Math.min(p.pitch, -.3), fov: 70 } : { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, fov: p.fov || 70 });
    if (mode === 'fixed' && !this.fixed && p) this.fixed = { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, fov: p.fov || 60 };
    this.mode = mode; this.smooth = null;
    if ((mode === 'view' || mode === 'fixed') && typeof document !== 'undefined' && document.pointerLockElement) { document.exitPointerLock(); this.locked = false; }
    return this;
  }
  /** follow an actor (or any { x, y, z }) */
  follow(t) { this.target = t; this.focus = null; this.smooth = null; return this; }
  _target() { const w = this.world; return this.target || w.actors.find(a => a.kind === 'hero') || { x: w.width / 2, y: w.depth / 2, z: 0 }; }
  /** the view mode's angles [yaw, pitch] in degrees (the 2D engine's: yaw 0 has the camera to the south) */
  viewAngles() { const g = this.world.game, v = g.baseView || g.view; return [v.yawDeg + (v.pitchDeg < 5 ? 0 : g.yaw || 0), v.pitchDeg]; }
  /** the ground angle the camera looks along now */
  get heading() { return this.pose ? this.pose.yaw : this.mode === 'view' ? headingOf(this.viewAngles()[0]) : this.yaw; }
  /** a step of the game: where every camera is (fixed steps: the controls read it) */
  update(dt) {
    const g = this.world.game, t = this._target();
    // [ and ] (game.rotateView) turn the chase, first and fly cameras too
    const gy = g.yaw || 0; if (this._gyaw !== null && gy !== this._gyaw) { const d = ((gy - this._gyaw + 540) % 360) - 180; this.yaw += d * DEG; this.fly.yaw += d * DEG; this._held = 1.5; } this._gyaw = gy;
    this._held = Math.max(0, this._held - dt);
    this.pose = this.mode === 'view' ? this._viewPose(dt, t) : this.mode === 'chase' ? this._chasePose(dt, t) : this.mode === 'first' ? this._firstPose(dt, t) : this.mode === 'fly' ? this._flyPose(dt) : Object.assign({ ortho: false }, this.fixed || this._viewPose(dt, t));
    return this.pose;
  }
  _viewPose(dt, t) {
    const g = this.world.game, k = dt > 0 ? 1 - Math.exp(-dt / Math.max(.001, this.lag)) : 1;
    const a = t.aim ?? t.facing, ld = typeof a === 'number' ? this.lead : 0;
    const tx = t.x + (ld ? Math.cos(a) * ld : 0), ty = t.y + (ld ? Math.sin(a) * ld : 0), tz = (t.z || 0) + 8;
    const f = this.focus || (this.focus = [tx, ty, tz]);
    f[0] += (tx - f[0]) * k; f[1] += (ty - f[1]) * k; f[2] += (tz - f[2]) * k;
    // the picture's height at the focus: the 2D game's (its height in pixels at the view's scale and zoom)
    const [yw, pt] = this.viewAngles(), v = g.baseView || g.view, ortho = this.proj === 'ortho' || pt < 1, Hf = g.H / ((v.scale || 1.5) * (g.zoom || 1)) * this.dist, cp = Math.cos(pt * DEG);
    const d = ortho ? 900 : Hf / 2 / Math.tan(this.fov * DEG / 2);
    return { x: f[0] + Math.sin(yw * DEG) * cp * d, y: f[1] + Math.cos(yw * DEG) * cp * d, z: f[2] + Math.sin(pt * DEG) * d, yaw: headingOf(yw), pitch: -pt * DEG, fov: this.fov, ortho, Hf };
  }
  _chasePose(dt, t) {
    const C = this.chase, g = this.world.game, k = dt > 0 ? 1 - Math.exp(-dt * 12) : 1;
    const s = this.smooth || (this.smooth = [t.x, t.y, t.z || 0]); s[0] += (t.x - s[0]) * k; s[1] += (t.y - s[1]) * k; s[2] += ((t.z || 0) - s[2]) * k;
    const sp = Math.hypot(t.vx || 0, t.vy || 0);
    if (C.auto && !this.locked && !this._held && sp > 20 && dt > 0) {   // swing round behind it as it moves (more the faster)
      const want = Math.atan2(t.vy, t.vx), off = Math.abs(((want - this.yaw + Math.PI * 3) % TAU) - Math.PI);
      if (off < 2.6) this.yaw = E.approachAng(this.yaw, want, dt * 1.6 * Math.min(1, sp / 80) * (off > 1.6 ? .4 : 1));
    }
    const tx = s[0], ty = s[1], tz = s[2] + C.height, cp = Math.cos(C.pitch), fx = Math.cos(this.yaw) * cp, fy = Math.sin(this.yaw) * cp, fz = Math.sin(C.pitch);
    const want = C.dist / clamp(g.zoom || 1, .5, 3); let d = want;
    for (let r = 6; r <= want; r += 3) { const x = tx - fx * r, y = ty - fy * r, z = tz - fz * r; if (z < this.world.topH(x, y) + 4) { d = Math.max(6, r - 5); break; } }   // in front of a wall
    return { x: tx - fx * d, y: ty - fy * d, z: tz - fz * d, yaw: this.yaw, pitch: C.pitch, fov: C.fov, ortho: false };
  }
  _firstPose(dt, t) {
    let ez = (t.z || 0) + 24;
    if (t.rig && t.rig.J) { frame(t.rig); _sink = 0; wp(t.rig.J.head, P3[22]); ez = P3[22][1] * U + 1; }   // its head (it bobs with its steps)
    this.eyeZ += (ez - this.eyeZ) * (dt > 0 ? 1 - Math.exp(-dt * 16) : 1);
    return { x: t.x + Math.cos(this.yaw) * 2.5, y: t.y + Math.sin(this.yaw) * 2.5, z: this.eyeZ, yaw: this.yaw, pitch: this.first.pitch, fov: this.first.fov, ortho: false };
  }
  _flyPose(dt) {
    const F = this.fly, I = this.world.game.input, mv = I.move(), sp = 90 * dt, up = (I.down('jump') ? 1 : 0) - (I.down('dash') ? 1 : 0);
    F.yaw = this.yaw;
    const cy = Math.cos(F.yaw), sy = Math.sin(F.yaw), cp = Math.cos(F.pitch), spp = Math.sin(F.pitch), fwd = -mv[1], str = mv[0];
    F.x += (cp * cy * fwd - sy * str) * sp; F.y += (cp * sy * fwd + cy * str) * sp; F.z = clamp(F.z + (spp * fwd + up) * sp, this.world.bottom + 8, 900);
    return Object.assign({}, F, { ortho: false });
  }
  /** the move stick ([x, y]: x right, y down, as game.input.move() gives it) turned to the ground: W walks away from the
   *  camera, D to its right. Returns [x, y] in out */
  ground(mv, out = [0, 0]) {
    const a = this.heading, fx = Math.cos(a), fy = Math.sin(a);
    out[0] = -fy * mv[0] + fx * -mv[1]; out[1] = fx * mv[0] + fy * -mv[1];
    return out;
  }
  /** the angle an actor aims at: straight ahead with the mouse captured (chase, first), the right stick (turned to the
   *  ground), the mouse's point on the floor at the actor's height; null when nothing aims */
  aim(a) {
    const I = this.world.game.input, p = this.pose || this.update(0);
    if ((this.mode === 'chase' || this.mode === 'first') && this.locked) return p.yaw;
    if (I.aimSource === 'pad' && I.padAim) { const v = this.ground([I.padAim[0], I.padAim[1]], [0, 0]); return Math.atan2(v[1], v[0]); }
    if (I.aimSource === 'mouse' && I.mouse.active) { const m = this.world.screenToFloor(I.mouse.cx, I.mouse.cy, (a.z || 0) + 4); if (m && Math.hypot(m[0] - a.x, m[1] - a.y) > 3) return Math.atan2(m[1] - a.y, m[0] - a.x); }
    return null;
  }
  /** aim the three.js camera at the pose, with the game's screen shake; w x h: the picture's aspect */
  place(w, h) {
    const p = this.pose || this.update(0), g = this.world.game, cam = p.ortho ? this.ortho : this.persp, aspect = w / h, sh = g.shaking || 0, t = g.real || 0;
    const shx = sh > .05 ? (Math.sin(t * 83) + Math.sin(t * 57.3)) * .5 * sh : 0, shy = sh > .05 ? (Math.sin(t * 71) + Math.sin(t * 49.7)) * .5 * sh : 0;
    if (p.ortho) { const hh = p.Hf / U / 2; Object.assign(this.ortho, { left: -hh * aspect, right: hh * aspect, top: hh, bottom: -hh, near: .1, far: 3000 }); }
    else Object.assign(this.persp, { fov: p.fov, aspect, near: this.mode === 'first' ? .3 : .1, far: 600 });
    const cp = Math.cos(p.pitch), fx = Math.cos(p.yaw) * cp, fz = Math.sin(p.yaw) * cp, fy = Math.sin(p.pitch), rx = -Math.sin(p.yaw), rz = Math.cos(p.yaw), k = .05 / U * 4;
    cam.position.set(p.x / U + rx * shx * k, p.z / U - shy * k, p.y / U + rz * shx * k);
    cam.up.set(0, 1, 0); if (Math.abs(fy) > .999) cam.up.set(Math.cos(p.yaw), 0, Math.sin(p.yaw));   // (straight down: up on the screen is where it heads)
    cam.lookAt(_v0.set(cam.position.x + fx, cam.position.y + fy, cam.position.z + fz));
    cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    const CV = this.cv; cam.getWorldQuaternion(CV.q);
    CV.right.set(1, 0, 0).applyQuaternion(CV.q); CV.up.set(0, 1, 0).applyQuaternion(CV.q); CV.back.set(0, 0, 1).applyQuaternion(CV.q);
    CV.yaw = engineYaw(p.yaw); CV.pitch = clamp(Math.round(-p.pitch / DEG), 0, 89);
    // the cards' pixel size: about the screen's where the target stands (whole eighths, changed only when it moves by a
    // fifth: a new size remakes the atlas)
    const tg = this._target(); let ppu;
    if (p.ortho) ppu = h / p.Hf;
    else { const hv = _v0.set(tg.x / U, ((tg.z || 0) + 14) / U, tg.y / U).sub(cam.position), dz = Math.max(.5, -hv.dot(CV.back)) * U; ppu = h / 2 / (Math.tan(p.fov * DEG / 2) * dz); }
    const want = clamp(Math.round(ppu * 8) / 8, .5, 4);
    if (Math.abs(want - CV.scale) / CV.scale > .2) CV.scale = want;
    CV.ppm = CV.scale * U; CV.thick = Math.max(1, Math.round(CV.scale / 1.5));
    this._fr.setFromProjectionMatrix(_m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse), cam.coordinateSystem);
    this.cam = cam;
    return cam;
  }
  /** on screen: a sphere of radius r (units) round (x, y, z) inside the camera's view */
  sees(x, y, z, r = 36) { return this._fr.intersectsSphere(_sph.set(_v0.set(x / U, (z + 14) / U, y / U), r / U)); }
  /** the 2D engine's view the cards are drawn from: the camera's turn and tilt, at the cards' pixel size */
  cardView() {
    const CV = this.cv, key = CV.yaw + ':' + CV.pitch + ':' + CV.scale; let v = this._views.get(key);
    if (!v) { if (this._views.size > 500) this._views.clear(); v = new E.View('card', 'Card', CV.yaw, CV.pitch, CV.scale, 1); this._views.set(key, v); }
    return v;
  }
}
const _sph = new THREE.Sphere();

/* =============================================================================
 * 8. ACTORS  world.hero(o): a kinematic capsule that Rapier's character controller walks (it slides along walls,
 *    climbs stairs and slopes, steps up curbs, jumps, rides moving platforms, pushes crates and shoves mobs aside);
 *    world.mob(o): a dynamic body (a capsule, or a ball for blobs and orbs) that the crowd's own physics resolves.
 *    Either way the game sets what it wants each step (vx, vy: ground velocity in units a second; jump(v) or vz) and
 *    world.step moves it and reads back where it is.
 * ============================================================================= */
class Actor {
  /** made by world.hero(o) and world.mob(o); see the manual for its fields */
  constructor(world, kind, o) {
    const round = !!(o.blob || o.orb), r = o.r ?? (kind === 'hero' ? 4.5 : round ? 6 : 5), half = o.half ?? (round ? 0 : kind === 'hero' ? 9 : 8);
    /** kind: 'hero' | 'mob'; x, y, z: its feet (engine units); vx, vy, vz: velocity (units a second); facing: radians;
     *  r, half: its capsule (radius, half its straight part; half 0 is a ball); rig | blob | orb: what is drawn; fly:
     *  no gravity; grounded, landed (this step), fell (dropped below the world): read them; alive: yours to keep */
    Object.assign(this, { world, kind, x: o.x ?? 0, y: o.y ?? 0, z: o.z ?? 0, vx: 0, vy: 0, vz: 0, facing: o.facing ?? -Math.PI / 2, r, half, foot: half + r,
      rig: o.rig || null, blob: o.blob || null, orb: o.orb || null, fly: !!o.fly, mass: o.mass ?? 1, grounded: false, landed: false, fell: false, solid: true, alive: true });
    /** anim: what its rig is doing this step, given to rig.update with its motion (world.step poses it: { attack, pose,
     *  hurt, dash, expr, ... } as the 2D engine's rigs take them; a blob's: { squash, look, squint, flap }); pose: false
     *  poses it yourself; look: 'card' | 'puppet' for this one (null: the world's); flash: seconds of hit flash; fade:
     *  0..1 shown; sink: units drawn into the floor (rising from it, falling into it); visible; shadow; trail: a color
     *  for its rig's weapon trail (null none); data: yours */
    Object.assign(this, { anim: null, pose: o.pose !== false, look: o.look || null, flash: 0, fade: 1, sink: 0, visible: o.visible !== false, shadow: o.shadow !== false, trail: o.trail || null, data: o.data || {}, on: null, _rv: [0, 0, 0] });
    if (this.rig) { this.rig.x = this.x; this.rig.y = this.y; this.rig.z = this.z; this.rig.facing = this.facing; }
  }
  /** put it at (x, y) on the floor there (or at height z), standing still */
  place(x, y, z) {
    const w = this.world; z = z ?? w.floorAt(x, y);
    Object.assign(this, { x, y, z, vx: 0, vy: 0, vz: 0, fell: false });
    if (this.body) { this.body.setTranslation({ x, y, z: z + this.foot + (this.kind === 'hero' ? .4 : 0) }, true); if (this.kind === 'mob') this.body.setLinvel({ x: 0, y: 0, z: 0 }, true); }
    this._rv[0] = this._rv[1] = this._rv[2] = 0;
    return this;
  }
  /** leave the ground at v units a second upward (a hero only from the ground: check grounded first if it matters) */
  jump(v) { this.vz = v; this.grounded = false; return this; }
  /** add a push of velocity (knockback; vz > 0 throws it up) */
  push(vx, vy, vz = 0) { this.vx += vx; this.vy += vy; if (vz) this.vz = Math.max(this.vz, vz); return this; }
  /** false: it stops blocking heroes and mobs (a body that has fallen): it still rests on the level, props and platforms */
  setSolid(on) {
    this.solid = !!on; if (!this.col) return this;
    this.col.setCollisionGroups(on ? (this.kind === 'hero' ? GROUPS.hero : this.fly ? GROUPS.flyer : GROUPS.mob) : GROUPS.down);
    if (!on && this.kind === 'mob') { this.col.setFriction(.9); this.col.setFrictionCombineRule(RAPIER.CoefficientCombineRule.Average); }
    return this;
  }
  /** take it out of the world */
  remove() { this.world.remove(this); }
}

/* =============================================================================
 * 9. THE WORLD  new E.World3D(game, o) (after await E.World3D.init(game)): a level, its physics, its actors, props,
 *    platforms and things, its lights, sky and camera. world.step(dt) in the game's update, world.draw(r) in its draw
 * ============================================================================= */
const RES = ['pixels', 'balanced', 'full'];
class World3D {
  constructor(game, o = {}) {
    if (!PAGE.ready) throw new Error('my-3D2dge 3D: await E.World3D.init(game) (a boot step) before new E.World3D(game, ...)');
    if (!o.level || !o.level.rows) throw new Error('my-3D2dge 3D: new E.World3D(game, { level: { rows: [...], legend: {...} } }) needs a level written as text');
    /** game: the 2D engine's game that runs it; scene: its three.js scene (add your own meshes: E.THREE); o: its options */
    this.game = game; this.o = o; this.scene = new THREE.Scene(); this._owned = []; this._mats = new Map(); this._objMats = new Set();
    const st = game.settings || {};
    /** look: 'card' (each rig drawn by the 2D engine on a card, exactly as in 2D) | 'puppet' (3D parts on its joints);
     *  res: the picture's resolution: 'pixels' (the game's own pixels: PS1 chunky), 'balanced' (half the screen's) or
     *  'full'; outlines: an outline round characters and things; gravity: units a second squared (480: the 2D slimes'
     *  cartoon gravity) */
    this.look = o.look || st.look3d || 'card'; this.res = RES.includes(o.res) ? o.res : RES.includes(st.picture3d) ? st.picture3d : 'pixels';
    this.outlines = o.outlines !== false; this.gravity = o.gravity ?? 480; this.shadows = o.shadows ?? (st.shadows3d !== false);
    /** filter: a look over the whole picture (section 10b): { look: 'clean' | 'cel' | 'pixel', apply, bloom, fxaa, ... } */
    this.filter = Object.assign({}, FX_DEFAULT, st.filter3d && st.filter3d !== 'clean' ? { look: st.filter3d } : null, o.filter);
    /** the level: its size (width, depth in units; mw, mh in tiles), bottom (where a fall is lost), marks */
    const L = this.level = new Level(this, o.level);
    Object.assign(this, { width: L.width, depth: L.depth, mw: L.mw, mh: L.mh, bottom: L.bottom, marks: L.marks, torches: L.torches });
    /** actors, props, platforms, things: what is in the world now (read them; add and remove with the methods below) */
    this.actors = []; this.props = []; this.platforms = []; this.things = []; this.shapes = [];
    this.B = makeBatches(this); this.capes = makeCapes(this); this.atlas = makeAtlas(this);
    /** pen: draw your own 3D shapes for this frame (in draw, before world.draw(r)): world.pen.at(x, y, z, yaw).box(...) */
    this.pen = new Pen(this); this.pen.B = this.B;
    this.part = {
      add: new Batch(this.scene, new THREE.CircleGeometry(1, 6), new THREE.MeshBasicNodeMaterial({ color: '#ffffff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), { order: 4, cap: 2048 }),
      solid: new Batch(this.scene, new THREE.CircleGeometry(1, 6), this._obj(new THREE.MeshBasicNodeMaterial({ color: '#ffffff' })), { cap: 2048 }),
      bit: new Batch(this.scene, new THREE.PlaneGeometry(2, 2), this._obj(new THREE.MeshBasicNodeMaterial({ color: '#ffffff' })), { cap: 1024 })
    };
    this._arcs = floorPool(this, 12); this._rings = floorPool(this, 24); this._ribbons = ribbons(this);
    this._propMesh = propMeshes(this); this._shapeKit = shapeKit(this);
    L.meshes(this);
    this._lights(o);
    this._sky(o);
    /** camera: see section 7 */
    this.camera = new Camera3D(this, o.camera);
    /** time: seconds stepped; n: steps; stats: the last frame's numbers (draw calls, triangles, actors drawn, physics
     *  and draw milliseconds) */
    this.time = 0; this.n = 0; this.stats = { calls: 0, tris: 0, drawn: 0, culled: 0, physicsMs: 0, drawMs: 0, bodies: 0, frames: 0 };
    this._queue = { arcs: [], glows: [] }; this._warm = false; this._seen = new Set();
    PAGE.worlds.add(this);
    this.reset();
  }
  _own(x) { this._owned.push(x); return x; }
  _mat(key, make) { let m = this._mats.get(key); if (!m) { m = this._own(make()); this._mats.set(key, m); } return m; }
  _obj(m) { this._objMats.add(m); return m; }
  /** a fresh physics world: the level's colliders and shapes, nothing else (actors, props, platforms, things and the
   *  shapes you placed are gone: add them again). The same seed and the same inputs from here give the same state (world.hash) */
  reset() {
    if (this.pw) this.pw.free();
    const pw = this.pw = new RAPIER.World({ x: 0, y: 0, z: -this.gravity });
    pw.lengthUnit = U; pw.numSolverIterations = this.o.iterations || 4;
    for (const p of this.platforms) if (p.mesh) this.scene.remove(p.mesh);
    for (const p of this.props) if (p.mesh) this.scene.remove(p.mesh);
    this.actors.length = 0; this.props.length = 0; this.platforms.length = 0; this.things.length = 0;
    this.level.colliders(pw);
    // the level's own shapes (a legend's { shape }) stand again; a game's are gone with the rest
    this.shapes.length = 0; this._shapeKit.clear(); for (const [id, x, y, z, sp] of this.level.shapes) this.shape(id, x, y, z, sp);
    this.time = 0; this.n = 0; this.camera && (this.camera.focus = null, this.camera.smooth = null);
    return this;
  }

  /* ---- the level, as the game asks about it ---- */
  /** the ground's height at (x, y) (a floor, a stair, a wall's top; `bottom` over a pit) */
  ground(x, y) { return this.level.ground(x, y); }
  /** the surface under a body at height z at (x, y): the highest ground or platform top no more than 4 units above it */
  floorAt(x, y, z) { return this.level.floorAt(x, y, z); }
  /** the top of whatever stands at (x, y) (shots stop below it) */
  topH(x, y) { return this.level.topH(x, y); }
  /** the character at tile (cx, cy), its legend entry, whether nobody walks there */
  tile(cx, cy) { return (this.level.rows[cy] || '')[cx] ?? ''; }
  spec(cx, cy) { return this.level.spec(cx, cy); }
  solidTile(cx, cy) { return this.level.solidTile(cx, cy); }
  /** a new flow field over the walkable grid: flow.to(x, y) aims it, flow.dir(x, y, out) is the way there from (x, y) */
  flow() { return new Flow(this.level); }
  /** a random walkable spot ([x, y]): rnd (E.rng) picks it, at least minDist from (fx, fy) if given */
  randomFloor(rnd, minDist = 0, fx = 0, fy = 0) {
    const L = this.level;
    for (let k = 0; k < 60; k++) {
      const cx = (rnd() * L.mw) | 0, cy = (rnd() * L.mh) | 0, i = cy * L.mw + cx;
      if (!L.pass[i] || L.kind[i] === STAIRS) continue;
      const x = (cx + .2 + rnd() * .6) * T, y = (cy + .2 + rnd() * .6) * T;
      if (minDist && Math.hypot(x - fx, y - fy) < minDist) continue;
      return [x, y];
    }
    return [L.width / 2, L.depth / 2];
  }
  /** a clear straight line from one point to another through the level and platforms (engine units)? */
  clear(x0, y0, z0, x1, y1, z1) {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, L = Math.hypot(dx, dy, dz); if (L < 1e-6) return true;
    const hit = this.pw.castRay(new RAPIER.Ray({ x: x0, y: y0, z: z0 }, { x: dx / L, y: dy / L, z: dz / L }), L, true, undefined, LEVEL_ONLY);
    return !hit;
  }

  /* ---- actors ---- */
  /** a hero: { x, y (where it starts; on the floor there), rig, r (4.5), half (9), facing, trail, look, fly } */
  hero(o = {}) {
    const a = new Actor(this, 'hero', o), pw = this.pw, z = o.z ?? this.floorAt(a.x, a.y);
    a.body = pw.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(a.x, a.y, z + a.foot + .4));
    a.col = pw.createCollider((a.half ? RAPIER.ColliderDesc.capsule(a.half, a.r).setRotation(Z_UP) : RAPIER.ColliderDesc.ball(a.r)).setCollisionGroups(GROUPS.hero), a.body);
    const cc = a.cc = pw.createCharacterController(.3);
    cc.setUp({ x: 0, y: 0, z: 1 }); cc.enableSnapToGround(o.snap ?? 4); cc.enableAutostep(o.step ?? 4, 2, false); cc.setMaxSlopeClimbAngle((o.slope ?? 50) * DEG); cc.setSlideEnabled(true);
    cc.setApplyImpulsesToDynamicBodies(true); cc.setCharacterMass(o.mass ?? 2500);
    a.z = z; a.grounded = true; this.actors.push(a);
    return a;
  }
  /** a mob: { x, y, rig | blob | orb, r, half, mass, fly (no gravity: it holds its own height), facing, look } */
  mob(o = {}) {
    const a = new Actor(this, 'mob', o), pw = this.pw, z = o.z ?? this.floorAt(a.x, a.y) + (a.fly ? 20 : 0);
    const desc = RAPIER.RigidBodyDesc.dynamic().setTranslation(a.x, a.y, z + a.foot).lockRotations().setCanSleep(true).setLinearDamping(o.damping ?? 0);
    if (a.fly) desc.setGravityScale(0);
    a.body = pw.createRigidBody(desc);
    const shape = a.half ? RAPIER.ColliderDesc.capsule(a.half, a.r).setRotation(Z_UP) : RAPIER.ColliderDesc.ball(a.r);
    a.col = pw.createCollider(shape.setFriction(0).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min).setRestitution(0).setDensity(a.mass).setCollisionGroups(a.fly ? GROUPS.flyer : GROUPS.mob), a.body);
    a.z = z; this.actors.push(a);
    return a;
  }
  /** take an actor, prop, platform or thing out of the world */
  remove(x) {
    if (!x) return;
    const from = x instanceof Actor ? this.actors : x.isThing ? this.things : x.isPlatform ? this.platforms : x.isShape ? this.shapes : this.props, i = from.indexOf(x);
    if (i >= 0) from.splice(i, 1); else if (x.isShape) return;
    if (x.body && this.pw) { try { this.pw.removeRigidBody(x.body); } catch (e) { /* gone with a reset */ } x.body = null; }
    if (x.isShape) this._shapeKit.take(x.kind, x);
    if (x.mesh) { this.scene.remove(x.mesh); x.mesh = null; }
  }
  /** actors of a kind ('hero' | 'mob' | null for all) within r of (x, y) (and of z when given: 24 up or down) */
  near(x, y, r, kind = null, z = null) {
    const out = [];
    for (const a of this.actors) if ((!kind || a.kind === kind) && Math.hypot(a.x - x, a.y - y) < r && (z === null || Math.abs(a.z - z) < 24)) out.push(a);
    return out;
  }

  /* ---- props: crates and barrels are dynamic bodies (swings, bolts and the crowd knock them about); boxes are yours ---- */
  /** a crate (12 units) at (x, y), on the floor there or at height z */
  crate(x, y, z, yaw = 0) { return this._prop('crate', x, y, z ?? this.floorAt(x, y) + 6.1, yaw, RAPIER.ColliderDesc.cuboid(6, 6, 6)); }
  /** a barrel (12 across, 14 tall) */
  barrel(x, y, z, yaw = 0) { return this._prop('barrel', x, y, z ?? this.floorAt(x, y) + 7.1, yaw, RAPIER.ColliderDesc.cylinder(7, 6), true); }
  /** a box: { x, y, z (its base), w, d, h, color, side (a SIDE look), fixed (it never moves), mass } */
  box(o) {
    const w = o.w || 16, d = o.d || 16, hh = o.h || 16, z = (o.z ?? this.floorAt(o.x, o.y)) + hh / 2;
    const p = this._prop('box', o.x, o.y, z, o.yaw || 0, RAPIER.ColliderDesc.cuboid(w / 2, d / 2, hh / 2), false, o.fixed, o.mass);
    const style = o.side || 'block', S = SIDE[style] || SIDE.block, c = sideColors(style, o), m = this._mat('box:' + style + JSON.stringify(c), () => lambert(this._own(bake((x, y) => S.fn(x, y, c), S.w, S.h))));
    p.mesh = new THREE.Mesh(this._own(boxGeo(w, d, hh)), m); p.mesh.castShadow = p.mesh.receiveShadow = true; this.scene.add(p.mesh);
    return p;
  }
  _prop(kind, x, y, z, yaw, shape, upright = false, fixed = false, mass = .5) {
    const half = yaw / 2, rot = upright ? Z_UP : { x: 0, y: 0, z: Math.sin(half), w: Math.cos(half) };
    const body = this.pw.createRigidBody((fixed ? RAPIER.RigidBodyDesc.fixed() : RAPIER.RigidBodyDesc.dynamic()).setTranslation(x, y, z).setRotation(rot).setLinearDamping(.3).setAngularDamping(.8));
    this.pw.createCollider(shape.setDensity(mass).setFriction(.7).setRestitution(.05).setCollisionGroups(fixed ? GROUPS.level : GROUPS.prop), body);
    const p = { kind, x, y, z, q: [rot.x, rot.y, rot.z, rot.w], body, hit: 0, mesh: null, data: {} };
    this.props.push(p); return p;
  }
  /** knock a prop: a push of dv units a second away from (fx, fy), and up by up */
  knock(p, fx, fy, dv, up = 0) {
    if (!p.body || p.body.isFixed()) return;
    const dx = p.x - fx, dy = p.y - fy, d = Math.hypot(dx, dy) || 1, m = p.body.mass();
    p.body.applyImpulse({ x: dx / d * dv * m, y: dy / d * dv * m, z: up * m }, true);
    p.body.applyTorqueImpulse({ x: -dy / d * m * 40, y: dx / d * m * 40, z: m * 20 }, true);
    p.hit = 10;
  }

  /* ---- platforms that move: { x, y, z (its top), w, d, h (6), path: [[x, y, z], ...] (its top's points; it goes there
   *      and back, or round with loop: true), speed (units a second), wait (seconds at each end), side, color } ---- */
  platform(o) {
    const w = o.w || 32, d = o.d || 32, hh = o.h || 6, path = (o.path || [[o.x, o.y, o.z]]).map(p => [p[0], p[1], p[2]]);
    const [x, y, z] = path[0], body = this.pw.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z - hh / 2));
    this.pw.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, d / 2, hh / 2).setFriction(1).setCollisionGroups(GROUPS.platform), body);
    let len = 0; const seg = [0]; for (let i = 1; i < path.length; i++) seg.push(len += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1], path[i][2] - path[i - 1][2]));
    if (o.loop) { const a = path[path.length - 1], b = path[0]; seg.push(len += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])); path.push(b); }
    const style = o.side || 'planks', S = SIDE[style] || SIDE.block, c = sideColors(style, o);
    const top = this._mat('ptop:' + style + JSON.stringify(c), () => { const tc = Object.assign({}, c, { side: c.hi, hi: H(E.shade(o.color || STYLE_COLORS[style] || '#8f5f37', .3)) }); return lambert(this._own(bake((x2, y2) => S.fn(x2, y2, tc), S.w, S.h))); });
    const mesh = new THREE.Mesh(this._own(sidesThenTops(boxGeo(w, d, hh))), [this._mat('box:' + style + JSON.stringify(c), () => lambert(this._own(bake((x2, y2) => S.fn(x2, y2, c), S.w, S.h)))), top]);
    mesh.castShadow = mesh.receiveShadow = true; this.scene.add(mesh);
    const p = { isPlatform: true, x, y, z, w, d, h: hh, path, seg, len, loop: !!o.loop, speed: o.speed || 30, wait: o.wait ?? .6, s: 0, dir: 1, hold: 0, dx: 0, dy: 0, dz: 0, body, mesh, data: o.data || {} };
    this.platforms.push(p); return p;
  }
  _movePlatform(p, dt) {
    if (p.len > 0) {
      if (p.hold > 0) p.hold -= dt;
      else {
        p.s += p.speed * dt * p.dir;
        if (p.loop) { if (p.s >= p.len) p.s -= p.len; }
        else if (p.s >= p.len) { p.s = p.len; p.dir = -1; p.hold = p.wait; } else if (p.s <= 0) { p.s = 0; p.dir = 1; p.hold = p.wait; }
      }
    }
    let i = 1; while (i < p.seg.length - 1 && p.seg[i] < p.s) i++;
    const a = p.path[i - 1], b = p.path[i] || a, k = p.seg[i] > p.seg[i - 1] ? (p.s - p.seg[i - 1]) / (p.seg[i] - p.seg[i - 1]) : 0;
    const x = lerp(a[0], b[0], k), y = lerp(a[1], b[1], k), z = lerp(a[2], b[2], k);
    p.dx = x - p.x; p.dy = y - p.y; p.dz = z - p.z; p.x = x; p.y = y; p.z = z;
  }

  /* ---- things (section 5) ---- */
  /** a thing of a kind (World3D.THINGS) at (x, y) on the floor there or at z: { yaw, spin, bob, size, color, open, on,
   *  solid (true or [w, d, h]: a fixed block where it stands, as a door or chest has), data } */
  thing(kind, x, y, z, o = {}) {
    if (!THINGS[kind]) E.warn('3d:thing:' + kind, 'unknown thing "' + kind + '". Things: ' + Object.keys(THINGS).join(', ') + ' (add one: E.World3D.THINGS.' + kind + ' = (pen, t) => ...)');
    const t = Object.assign({ isThing: true, kind, x, y, z: z ?? this.floorAt(x, y), yaw: 0, spin: 0, bob: 0, size: 1, open: 0, on: false, visible: true, t: 0, r: (THING_R[kind] || 6) * (o.size || 1), data: {}, body: null }, o);
    if (t.solid) this.setSolid(t, true);
    this.things.push(t); return t;
  }
  /** a thing's block on (a door shut, a chest) or off (open): a fixed collider of its solid size where it stands */
  setSolid(t, on) {
    if (t.body) { this.pw.removeRigidBody(t.body); t.body = null; }
    if (on) {
      const s = Array.isArray(t.solid) ? t.solid : t.kind === 'door' ? [(t.w || 32) + 8, 8, (t.h || 40) + 4] : t.kind === 'chest' ? [14, 10, 10] : [t.r * 2, t.r * 2, 12];
      t.body = this.pw.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(t.x, t.y, t.z + s[2] / 2).setRotation({ x: 0, y: 0, z: Math.sin(t.yaw / 2), w: Math.cos(t.yaw / 2) }));
      this.pw.createCollider(RAPIER.ColliderDesc.cuboid(s[0] / 2, s[1] / 2, s[2] / 2).setCollisionGroups(GROUPS.level), t.body);
    }
    t.solid = on ? (t.solid || true) : false;
    return t;
  }
  /** the things (of a kind, or any) an actor touches: within its radius plus theirs, and 20 units up or down */
  touching(a, kind = null) {
    const out = [];
    for (const t of this.things) if (t.visible && (!kind || t.kind === kind) && Math.hypot(t.x - a.x, t.y - a.y) < a.r + t.r && t.z + t.bob + 2 > a.z - 6 && t.z < a.z + 2 * a.foot + 4) out.push(t);
    return out;
  }

  /* ---- shapes (section 5b) ---- */
  /** a shape (an E.SHAPES id, a store set's 'SET:id' after E.addAssets, or an entry) standing at (x, y), on the floor
   *  there or at z, with the 2D placement's options and units: { facing (where its front points; PI/2 south), scale,
   *  mats, flip, params, solid (default true: a fixed collider from the box map.solid uses; false: bodies pass) } -> its
   *  placement { id, x, y, z, facing, scale, body }; null for an unknown shape. world.remove(it) takes it away */
  shape(id, x, y, z, o = {}) {
    const K = this._shapeKit.kind(id, o); if (!K) return null;
    const p = { isShape: true, id, x, y, z: z ?? this.floorAt(x, y), facing: o.facing ?? Math.PI / 2, scale: o.scale || 1, kind: K, i: K.list.length, body: null, data: o.data || {} };
    K.list.push(p); this._shapeKit.put(K, p); this.shapes.push(p);
    if (o.solid !== false) {   // the 2D engine's box: its footprint turned with it, from its base to its top
      const b = E.shapeBox(id, x, y, p.z, o), hz = Math.max(.5, (b.top - p.z) / 2), a = Math.atan2(b.s, b.c);
      p.body = this.pw.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(b.x, b.y, p.z + hz).setRotation({ x: 0, y: 0, z: Math.sin(a / 2), w: Math.cos(a / 2) }));
      this.pw.createCollider(RAPIER.ColliderDesc.cuboid(Math.max(.5, b.hx), Math.max(.5, b.hy), hz).setCollisionGroups(GROUPS.level), p.body);
    }
    return p;
  }

  /* ---- a step of the game: platforms, the heroes' controllers, the mobs' wishes, Rapier, then where all is ---- */
  /** advance the world by dt (the game's fixed step): call it once in your scene's update, after your rules */
  step(dt) {
    if (!(dt > 0)) { this.camera.update(0); return; }
    const t0 = performance.now(), pw = this.pw;
    this.time += dt; this.n++;
    // where the platforms go this step (worked out first, given to Rapier after the heroes' controllers have looked:
    // a controller that saw a platform's next place would carry its rider some steps and not others)
    for (const p of this.platforms) this._movePlatform(p, dt);
    for (const a of this.actors) {
      if (!a.body) continue;
      if (a.kind === 'hero') this._moveHero(a, dt);
      else if (a.vx !== a._rv[0] || a.vy !== a._rv[1] || a.vz !== a._rv[2]) a.body.setLinvel({ x: a.vx, y: a.vy, z: a.vz }, true);
    }
    for (const p of this.platforms) p.body.setNextKinematicTranslation({ x: p.x, y: p.y, z: p.z - p.h / 2 });
    pw.timestep = dt; pw.step();
    this._readBack(dt);
    this.camera.update(dt);
    this.stats.physicsMs = performance.now() - t0;
  }
  _moveHero(a, dt) {
    if (!a.fly) a.vz = Math.max(-600, a.vz - this.gravity * dt);
    a.cc.computeColliderMovement(a.col, { x: a.vx * dt, y: a.vy * dt, z: a.vz * dt }, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, HERO_QUERY);
    const m = a.cc.computedMovement(), p = a.body.translation(), on = a.on, ground = a.cc.computedGrounded() || (on && a.vz <= 0);
    if (ground && a.vz <= 0) a.vz = 0;
    if (!ground && a.vz > 0 && m.z < a.vz * dt * .5) a.vz = 0;   // a head bump
    a.landed = ground && !a.grounded; a.grounded = !!ground;
    // carried by the moving platform under it: the platform's step added to the hero's own, unless the controller has
    // added it already (Rapier's controller follows a moving floor on some steps and not others)
    let cx = 0, cy = 0, cz = 0;
    if (on && Math.hypot(m.x - a.vx * dt - on.dx, m.y - a.vy * dt - on.dy) > .02) { cx = on.dx; cy = on.dy; cz = on.dz; }
    a.body.setNextKinematicTranslation({ x: p.x + m.x + cx, y: p.y + m.y + cy, z: p.z + m.z + cz });
  }
  _readBack(dt) {
    const L = this.level;
    for (const a of this.actors) {
      if (!a.body) continue;
      const p = a.body.translation();
      a.x = p.x; a.y = p.y;
      if (a.kind === 'hero') {
        a.z = p.z - a.foot - .3;
        if (a.grounded) { const f = this.floorAt(a.x, a.y, a.z + 2); if (Math.abs(a.z - f) < 1.5) a.z = f; }   // (feet on the floor, not the controller's skin above it)
      } else {
        const v = a.body.linvel(); a.z = p.z - a.foot;
        const pvz = a.vz; a.vx = v.x; a.vy = v.y; a.vz = v.z;
        const was = a.grounded; a.grounded = a.fly || (Math.abs(a.vz) < 6 && (a.z - this.floorAt(a.x, a.y, a.z + 1) < 2 || Math.abs(a.vz - pvz) < 1)); a.landed = a.grounded && !was;
        a._rv[0] = a.vx; a._rv[1] = a.vy; a._rv[2] = a.vz;
      }
      a.fell = a.z < L.bottom + 8;
      // standing on a moving platform (it carries a hero: world.step adds its motion)
      a.on = null;
      for (const q of this.platforms) if (Math.abs(a.x - q.x) < q.w / 2 + a.r * .5 && Math.abs(a.y - q.y) < q.d / 2 + a.r * .5 && Math.abs(a.z - q.z) < 2.5 && a.vz <= 1) { a.on = q; break; }
      if (a.pose) this._pose(a, dt);
    }
    for (const p of this.props) {
      if (!p.body) continue;
      const q = p.body.translation(), r = p.body.rotation(); p.x = q.x; p.y = q.y; p.z = q.z; p.q[0] = r.x; p.q[1] = r.y; p.q[2] = r.z; p.q[3] = r.w; if (p.hit) p.hit--;
      p.fell = q.z < L.bottom;
    }
    for (const t of this.things) t.t += dt;
  }
  /** pose an actor's rig (or blob) from its motion and its anim (world.step does it for every actor with pose on) */
  _pose(a, dt) {
    if (a.rig) {
      const s = Object.assign({ x: a.x, y: a.y, z: a.z, vx: a.vx, vy: a.vy, facing: a.facing, air: !a.grounded && !a.fly }, a.anim);
      a.rig.update(dt, s);
      const A = s.attack; if (a.rig.capeL && !s.dash && !(A && A.phase === 'active')) settleCape(a.rig, dt, clamp(1 - Math.hypot(a.vx, a.vy) / 60, 0, 1));
    } else if (a.blob) a.blob.update(dt, Object.assign({ look: [Math.cos(a.facing), Math.sin(a.facing)] }, a.anim));
  }
  /** the state's hash: the step count, every actor, prop and platform (positions by their float bits) and your own
   *  numbers. The same seed and the same inputs give the same hash on WebGPU, WebGL 2 and run again */
  hash(extra = []) {
    const list = [this.n, ...extra];
    for (const a of this.actors) list.push(a.x, a.y, a.z, a.vx, a.vy);
    for (const p of this.props) list.push(p.x, p.y, p.z);
    for (const p of this.platforms) list.push(p.x, p.y, p.z);
    return hashNumbers(list);
  }
}
/** a cape at rest in 3D: its chains settle behind and below the shoulders (w: how much, 0 moving fast .. 1 still) */
function settleCape(rig, dt, w) {
  const k = Math.min(1, dt * 16 * w), fx = Math.cos(rig.facing), fy = Math.sin(rig.facing), seg = (rig.o.cape && rig.o.cape.seg) || 2.5;
  for (const ch of [rig.capeL, rig.capeR]) ch.forEach((n, i) => {
    n.x = lerp(n.x, ch[0].x - fx * i * .5, k); n.y = lerp(n.y, ch[0].y - fy * i * .5, k); n.z = lerp(n.z, ch[0].z - i * seg, k);
    if (n.px !== undefined) { n.px = lerp(n.px, n.x, k); n.py = lerp(n.py, n.y, k); n.pz = lerp(n.pz, n.z, k); }
  });
}

/* =============================================================================
 * 10. DRAWING  effects (arcs and rings on the ground, weapon trails, glows, the game's particles), lights (the torches
 *     nearest the action, two of them casting shadows; your own; a sun), the sky and fog, then the frame: world.draw(r)
 * ============================================================================= */
/** a pool of flat ground shapes (arcs and rings), each its own mesh so each fades on its own; one material for the pool
 *  (the color and fade are in the vertices), so a new shape never builds a shader mid-fight */
function floorPool(world, segments) {
  const pool = [], mat = new THREE.MeshBasicNodeMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  return {
    get(i) {
      if (!pool[i]) {
        const geo = new THREE.BufferGeometry(), pos = new Float32Array((segments + 1) * 2 * 3), idx = [];
        for (let k = 0; k < segments; k++) { const a = k * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.length), 3)); geo.setIndex(idx);
        geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(pos.length), 3));
        const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = 1; m.visible = false; world.scene.add(m); pool[i] = m;
      }
      return pool[i];
    },
    /** shape i: from radius r0 to r1 between angles a0 and a1 round (x, y) at height z (engine units) */
    set(i, x, y, z, r0, r1, a0, a1, color, alpha) {
      const m = this.get(i), p = m.geometry.attributes.position.array, cl = m.geometry.attributes.color.array, c = typeof color === 'string' ? lin(color) : color;
      for (let k = 0; k <= segments; k++) {
        const a = a0 + (a1 - a0) * k / segments, cs = Math.cos(a), sn = Math.sin(a), o = k * 6;
        p[o] = (x + cs * r0) / U; p[o + 1] = (z + .3) / U; p[o + 2] = (y + sn * r0) / U; p[o + 3] = (x + cs * r1) / U; p[o + 4] = (z + .3) / U; p[o + 5] = (y + sn * r1) / U;
        cl[o] = cl[o + 3] = c[0] * alpha; cl[o + 1] = cl[o + 4] = c[1] * alpha; cl[o + 2] = cl[o + 5] = c[2] * alpha;
      }
      m.geometry.attributes.position.needsUpdate = m.geometry.attributes.color.needsUpdate = true; m.visible = true;
    },
    hideFrom(i) { for (let k = i; k < pool.length; k++) pool[k].visible = false; },
    prepare(n) { for (let i = 0; i < n; i++) this.get(i); },
    get list() { return pool; }
  };
}
/** weapon trails: ribbons between a blade's base and tip over its last positions, fading at the tail */
function ribbons(world) {
  const pool = [], MAX = 12, mat = new THREE.MeshBasicNodeMaterial({ vertexColors: true, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  function make() {
    const pos = new Float32Array(MAX * 2 * 3), col = new Float32Array(MAX * 2 * 3), idx = [];
    for (let i = 0; i < MAX - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(idx);
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(pos.length), 3));
    const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = 3; m.visible = false; world.scene.add(m); return m;
  }
  return {
    set(i, trail, tint) {
      const m = pool[i] || (pool[i] = make()), n = Math.min(MAX, trail.length); m.visible = n > 1; if (n < 2) return;
      const pos = m.geometry.attributes.position.array, col = m.geometry.attributes.color.array;
      for (let k = 0; k < n; k++) {
        const p = trail[trail.length - n + k], f = ((k + 1) / n) ** 1.5 * .85, o = k * 6;
        pos[o] = p.b[0] / U; pos[o + 1] = p.b[2] / U; pos[o + 2] = p.b[1] / U; pos[o + 3] = p.t[0] / U; pos[o + 4] = p.t[2] / U; pos[o + 5] = p.t[1] / U;
        col[o] = tint[0] * f * .5; col[o + 1] = tint[1] * f * .5; col[o + 2] = tint[2] * f * .5; col[o + 3] = tint[0] * f; col[o + 4] = tint[1] * f; col[o + 5] = tint[2] * f;
      }
      m.geometry.attributes.position.needsUpdate = m.geometry.attributes.color.needsUpdate = true; m.geometry.setDrawRange(0, (n - 1) * 6);
    },
    hideFrom(i) { for (let k = i; k < pool.length; k++) pool[k].visible = false; },
    prepare(n) { for (let i = 0; i < n; i++) if (!pool[i]) pool[i] = make(); },
    get list() { return pool; }
  };
}
/* crates and barrels: instanced, each where its body is (a crate's planks and a barrel's staves drawn by code) */
const WOOD = { planks: ['#9d6a3f', '#8f5f37', '#a87547'].map(H), frame: H('#6e4528'), line: H('#4a2e1c'), hi: H('#c08a55'), nail: H('#2e2420') };
function crateTex(x, y) {   // 12 x 12 pixels for a 12-unit crate: a dark frame, planks, a diagonal brace, four nails
  const P = WOOD, n = 12;
  if (x === 0 || y === 0 || x === n - 1 || y === n - 1) return P.line;
  if (x === 1 || y === 1 || x === n - 2 || y === n - 2) return (x === 1 || x === n - 2) && (y === 1 || y === n - 2) ? P.nail : P.frame;
  if (Math.abs(x - y) <= .5 || Math.abs(x - y - 1) <= .5) return x === y ? P.hi : P.frame;
  if ((y - 2) % 3 === 2) return P.line;
  return P.planks[Math.floor((y - 2) / 3) % P.planks.length];
}
function barrelTex(x, y) {   // staves round the side (36 x 14 pixels), two iron hoops
  if (y === 2 || y === 3 || y === 10 || y === 11) return y === 2 || y === 10 ? H('#5d5a66') : H('#3a3842');
  const st = Math.floor(x / 3), c = WOOD.planks[st % 3];
  return x % 3 === 2 ? WOOD.line : E.hash2(st, y) < .08 ? WOOD.frame : c;
}
function propMeshes(world) {
  const mk = (geo, mats, n) => { const m = new THREE.InstancedMesh(world._own(geo), mats, n); m.frustumCulled = false; m.count = 0; m.castShadow = m.receiveShadow = true; world.scene.add(m); return m; };
  const crate = world._obj(new THREE.MeshLambertNodeMaterial({ map: world._own(bake(crateTex, 12, 12)) }));
  const side = world._obj(new THREE.MeshLambertNodeMaterial({ map: world._own(bake(barrelTex, 36, 14)) })), lid = world._obj(new THREE.MeshLambertNodeMaterial({ color: '#7a5030' }));
  return { crate: mk(new THREE.BoxGeometry(12 / U, 12 / U, 12 / U), crate, 300), barrel: mk(new THREE.CylinderGeometry(6 / U, 6 / U, 14 / U, 12, 1), [side, lid, lid], 300) };
}
const _pq = new THREE.Quaternion(), _pv = new THREE.Vector3(), _ps = new THREE.Vector3(1, 1, 1), _rotZY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
/** a body's rotation (Rapier's, about the engine's axes, z up) as three's (y up): swap y and z and flip the handedness */
const quatToThree = (q, out) => out.set(-q[0], -q[2], -q[1], q[3]);
const FLICKER = t => .9 + Math.sin(t * 13) * .05 + Math.sin(t * 29) * .04 + Math.sin(t * 7.3) * .04;   // the 2D hall's torch flicker
const TRAIL = { hero: lin('#d8f2ff'), claw: lin('#ff7a5a') };

Object.assign(World3D.prototype, {
  /* ---- lights: a fixed set made with the world (the count never changes, so shaders never rebuild mid-game) ---- */
  _lights(o) {
    const sc = this.scene, a = o.ambient || ['#5a5480', '#241f30', 4];
    this._ambient = new THREE.HemisphereLight(a[0], a[1], a[2] ?? 4); sc.add(this._ambient);
    const point = (color, reach, decay = 1) => { const l = new THREE.PointLight(color, 0, reach / U, decay); sc.add(l); return l; };
    const nt = this.torches.length, TC = o.torchColor || '#ffc8a0', TR = o.torchReach || 170;
    this._torchLights = Array.from({ length: Math.min(nt, o.torchLights ?? 6) }, () => point(TC, TR, .5));
    this._shadowLights = nt ? Array.from({ length: o.torchShadows ?? 1 }, () => { const l = point(TC, TR, .5); l.shadow.mapSize.set(512, 512); l.shadow.camera.near = .1; l.shadow.camera.far = TR / U; l.shadow.bias = -.002; return l; }) : [];
    this._glowLights = Array.from({ length: o.glowLights ?? 4 }, () => point('#ffb347', 40));
    /** lights you place: world.light() hands out one of o.lights (made with the world, 2 unless said) */
    this._userLights = Array.from({ length: o.lights ?? 2 }, () => point('#ffffff', 120));
    this._userNext = 0; this._handles = []; this.torchPower = o.torchPower ?? 30;
    if (o.sun) {
      const s = o.sun, L = this._sun = new THREE.DirectionalLight(s.color || '#fff4e0', s.intensity ?? 2.4);
      L.castShadow = s.shadow !== false; const area = (s.area || 220) / U;
      Object.assign(L.shadow.camera, { left: -area, right: area, top: area, bottom: -area, near: .5, far: 200 }); L.shadow.mapSize.set(s.map || 1024, s.map || 1024); L.shadow.bias = -.0015; L.shadow.normalBias = .02;
      const d = s.dir || [-.5, -.7, -.6]; this._sunDir = new THREE.Vector3(d[0], d[2], d[1]).normalize().negate();   // (engine axes -> three's; it shines along dir)
      sc.add(L); sc.add(L.target);
    }
  },
  /** one of the world's own lights to place each frame: { x, y, z, color, reach, power, on } (power 0 or on false: dark) */
  light(o = {}) {
    const L = this._userLights[this._userNext++];
    if (!L) { E.warn('3d:lights', 'world.light(): every light made with the world is in use; make the world with { lights: n }'); return { x: 0, y: 0, z: 0, on: false }; }
    const h = Object.assign({ x: 0, y: 0, z: 0, color: '#ffffff', reach: 120, power: 12, on: true }, o); h._L = L; this._handles.push(h); return h;
  },
  _sky(o) {
    const sky = o.sky || '#06050b', top = Array.isArray(sky) ? sky[0] : sky, bot = Array.isArray(sky) ? sky[1] : sky;
    if (top === bot) this.scene.background = new THREE.Color(top);
    else this.scene.backgroundNode = TSL.mix(TSL.color(bot), TSL.color(top), TSL.screenUV.y.oneMinus().pow(.8));
    const f = o.fog === undefined ? { color: bot, near: 190, far: 1120 } : o.fog;
    this._fog = f ? { color: f.color || bot, near: f.near ?? 190, far: f.far ?? 1120 } : null;
    this.scene.fog = this._fog ? new THREE.Fog(this._fog.color, 30, 90) : null;
  },
  /** the torches nearest the focus lit (two of them through the shadow casters when shadows are on), your lights, the sun */
  _light(fx, fy, fz) {
    const T0 = this.torches, n = T0.length, t = this.time, P = this.torchPower;
    const near = n ? T0.map((b, i) => [Math.hypot(b.x - fx, b.y - fy), i]).sort((a, b) => a[0] - b[0]).map(a => a[1]) : [];
    const sh = this.shadows && this._shadowLights.length ? near.slice(0, this._shadowLights.length) : [];
    this._shadowLights.forEach((L, k) => { const i = sh[k], on = i !== undefined; L.castShadow = on; L.intensity = on ? P * FLICKER(t + T0[i].t) : 0; if (on) L.position.set(T0[i].x / U, (T0[i].z + 16) / U, T0[i].y / U); });
    const rest = near.slice(sh.length);
    this._torchLights.forEach((L, k) => { const i = rest[k], on = i !== undefined; L.intensity = on ? P * FLICKER(t + T0[i].t) : 0; if (on) L.position.set(T0[i].x / U, (T0[i].z + 16) / U, T0[i].y / U); });
    for (const h of this._handles) { const L = h._L; L.intensity = h.on ? h.power : 0; if (h.on) { L.position.set(h.x / U, h.z / U, h.y / U); L.color.set(h.color); L.distance = h.reach / U; } }
    if (this._sun) { const s = this._sun, d = this._sunDir; s.target.position.set(fx / U, fz / U, fy / U); s.position.copy(s.target.position).addScaledVector(d, -60); s.castShadow = this.shadows && this.o.sun.shadow !== false; }
  },

  /* ---- effects for this frame: call them in your draw, before world.draw(r) ---- */
  /** a flat shape on the ground this frame: an arc round (x, y) at height z from radius r0 to r1, between angles a0 and
   *  a1 (a telegraph: a wind-up's reach), light that adds (color, alpha 0..1) */
  arc(x, y, z, r0, r1, a0, a1, color = '#ff4a3a', alpha = .6) { this._queue.arcs.push([x, y, z, r0, r1, a0, a1, color, alpha]); },
  /** a glowing ball this frame (a bolt, a spell): radius r, its color and a white-hot core; light: true lends it one of
   *  the world's glow lights (the first four asked for) */
  glow(x, y, z, r, color = '#ffb347', o = {}) { this._queue.glows.push([x, y, z, r, color, o.core || '#fff3c4', !!o.light]); },
  /** where a point (engine units) is on the game's screen, in game pixels [x, y] (for the HUD), or null behind the camera */
  project(x, y, z) {
    const c = this.camera.cam; _pv.set(x / U, z / U, y / U).project(c); if (_pv.z > 1 || _pv.z < -1) return null;
    const g = this.game; return [(_pv.x + 1) / 2 * g.W, (1 - _pv.y) / 2 * g.H];
  },
  /** where a point of the page (client pixels: a mouse) lands on the plane at height z, in engine units [x, y], or null */
  screenToFloor(cx, cy, z = 0) {
    const cv = PAGE.canvas; if (!cv) return null; const r = cv.getBoundingClientRect(); if (!r.width) return null;
    _ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height * 2 - 1));
    _ray.setFromCamera(_ndc, this.camera.cam); const o = _ray.ray.origin, d = _ray.ray.direction, y0 = z / U;
    if (Math.abs(d.y) < 1e-4) return null; const k = (y0 - o.y) / d.y; if (k < 0) return null;
    return [(o.x + d.x * k) * U, (o.z + d.z * k) * U];
  },

  /* ---- the frame ---- */
  /** draw the world as it stands (in your scene's draw; your HUD on r after it). r: the 2D renderer (its damage numbers
   *  and notes go on the HUD) */
  draw(r) {
    const R = PAGE.renderer; if (!R) { this._queue.arcs.length = this._queue.glows.length = 0; return; }
    PAGE.active = this; if (this.camera.locked && this.game.paused) document.exitPointerLock();   // a pause frees the mouse
    const t0 = performance.now(), g = this.game;
    g.particles.ground = (x, y, z) => this.level.floorAt(x, y, z);
    // the 2D renderer draws the game's particles after the scene's draw: a frame the world drew, it puts only their text
    // (damage numbers) on the HUD; the world draws the rest in 3D
    if (!g.particles._3d) { const P = g.particles, draw2d = P.draw.bind(P); P._3d = true; P.draw = rr => { const w = P._world; P._world = null; if (w) w._texts(rr); else draw2d(rr); }; }
    g.particles._world = this;
    // the player's settings (World3D.SETTINGS), taken up when they change
    const st = g.settings || {}, sk = [st.look3d, st.picture3d, st.shadows3d, st.filter3d].join();
    if (sk !== this._sk) {
      if (this._sk !== undefined) { if (st.look3d) this.look = st.look3d; if (RES.includes(st.picture3d)) this.res = st.picture3d; if (st.shadows3d !== undefined) this.shadows = !!st.shadows3d; if (st.filter3d) this.filter.look = st.filter3d; }
      this._sk = sk;
    }
    const rw = this._fit(), cam = this.camera;
    if (!cam.pose) cam.update(0);
    const c3 = cam.place(rw[0], rw[1]), p = cam.pose, tg = cam._target();
    OUTLINE_PX.value.set(2 / rw[0] * cam.cv.thick, 2 / rw[1] * cam.cv.thick);
    // fog from a little past the target, however far the camera stands
    if (this._fog) { const dH = Math.hypot(c3.position.x - tg.x / U, c3.position.y - (tg.z || 0) / U, c3.position.z - tg.y / U); this.scene.fog.near = dH + this._fog.near / U; this.scene.fog.far = dH + this._fog.far / U; }
    this._cut(p, tg);
    this._light(tg.x, tg.y, tg.z || 0);
    const fdt = clamp(g.real - (this._real ?? g.real), 0, .1); this._real = g.real;
    this.level.animateBraziers(fdt);
    const view = cam.cardView(), first = cam.mode === 'first';
    for (const b of Object.values(this.B)) b.begin();
    this.capes.begin();
    const look = this.look;
    if (look === 'card' || this.actors.some(a => a.look === 'card')) this.atlas.begin(view);
    const drawn = this._drawActors(view, first ? tg : null);
    this._drawThings();
    this._drawProps();
    this._effects(cam.cv);
    this.atlas.end(this.outlines, cam.cv.thick);
    for (const b of Object.values(this.B)) b.end(this.outlines);
    this._shapeKit.outlines(this.outlines);
    this.capes.end();
    if (this._fx || fxOn(this.filter)) { this._fx = this._fx || makeFX(this); this._fx.tag(fxOn(this.filter)); }
    if (!this._warm) this._warmUp(c3, view);
    R.info.reset();
    const t1 = performance.now();
    this._render(c3);
    const info = R.info.render, t2 = performance.now();
    Object.assign(this.stats, { calls: info.drawCalls, tris: info.triangles, drawn, bodies: this.pw.bodies.len(), drawMs: t2 - t0, renderMs: t2 - t1 });
    this.stats.frames++;
  },
  /** the picture's size: the game's pixels ('pixels'), half the screen's or all of it, the 3D canvas laid exactly under
   *  the game's picture (so the HUD's game pixels and project() agree) */
  _fit() {
    const sc = this.game.screen, cv = PAGE.canvas, dpr = sc.dpr || 1, res = this.res;
    const rw = res === 'full' ? Math.round(sc.W * sc.S) : res === 'balanced' ? Math.round(sc.W * sc.S / 2) : sc.W, rh = res === 'full' ? Math.round(sc.H * sc.S) : res === 'balanced' ? Math.round(sc.H * sc.S / 2) : sc.H;
    const key = [rw, rh, sc.W, sc.H, sc.S, sc.OX, sc.OY, dpr].join();
    if (PAGE.fit !== key) {
      PAGE.fit = key;
      Object.assign(cv.style, { left: sc.OX / dpr + 'px', top: sc.OY / dpr + 'px', width: sc.W * sc.S / dpr + 'px', height: sc.H * sc.S / dpr + 'px', imageRendering: res === 'full' ? 'auto' : 'pixelated' });
      PAGE.renderer.setSize(Math.max(1, rw), Math.max(1, rh), false);
    }
    return [rw, rh];
  },
  /** walls between the level and a view camera cut low, pillars between it and the target cut to stumps */
  _cut(p, tg) {
    const L = this.level, cam = this.camera;
    if (cam.mode !== 'view' || !cam.cut) { L.placeWalls('none', null); L.placePillars(null); return; }
    const [yw, pt] = cam.viewAngles(), fx = Math.sin(yw * DEG), fy = Math.cos(yw * DEG);
    L.placeWalls(pt > 85 ? 'none' : 'cut:' + yw, pt > 85 ? null : c => c.ox * fx + c.oy * fy > .3);
    const far = p.ortho ? 3000 : 0, cp = Math.cos(p.pitch), a = [p.x - Math.cos(p.yaw) * cp * far, p.y - Math.sin(p.yaw) * cp * far, p.z - Math.sin(p.pitch) * far];
    const aims = pt >= 60 ? [[0, 0, 26], [0, 0, 2]] : [[0, 0, 26], [0, 0, 2], [40, 0, 2], [-40, 0, 2], [0, 40, 2], [0, -40, 2]];
    L.placePillars(P0 => aims.some(([dx, dy, dz]) => segBox(a, [tg.x + dx, tg.y + dy, (tg.z || 0) + dz], P0.x0 - 4, P0.y0 - 4, P0.z0, P0.x1 + 4, P0.y1 + 4, P0.z1)));
  },
  /** every actor the camera sees, as cards or puppets, with their shadows, capes and trails; returns how many */
  _drawActors(view, firstOf) {
    const B = this.B, cam = this.camera, v = cam.cv, t = this.time; let drawn = 0, nr = 0;
    for (const a of this.actors) {
      if (!a.visible || a.fade <= 0 || !cam.sees(a.x, a.y, a.z)) continue;
      if (firstOf && (a === firstOf || Math.hypot(a.x - firstOf.x, a.y - firstOf.y) < 12)) continue;   // (first person: its own body, and one pressed against the camera, would fill the picture)
      const flash = a.flash > 0, sink = -a.sink, alpha = clamp(a.fade, 0, 1);
      if (a.orb) { orbParts(B, a, t); drawn++; continue; }
      if (a.shadow) shadowAt(this, a.x, a.y, a.z, a.blob ? a.blob.o.R || 6 : a.r + 1, alpha);
      drawn++;
      const look = a.look || this.look;
      if (look === 'card' && this.atlas.add(a.x, a.y, a.z - a.sink, (g, ox, oy) => a.rig ? a.rig.draw(g, ox, oy, view) : a.blob.draw(g, ox, oy, view), flash, alpha, v)) { if (a.trail && a.rig && a.rig.trail.length > 1 && nr < 24) this._ribbons.set(nr++, a.rig.trail, typeof a.trail === 'string' ? lin(a.trail) : a.trail); continue; }
      if (a.rig) { a.rig._cheat = 0; _sink = sink; humanParts(B, a.rig, flash); if (a.rig.capeL && a.rig.o.cape) this.capes.add(a.rig, sink, flash); _sink = 0; }
      else if (a.blob) blobParts(B, a, flash, sink);
      if (a.trail && a.rig && a.rig.trail.length > 1 && nr < 24) this._ribbons.set(nr++, a.rig.trail, typeof a.trail === 'string' ? lin(a.trail) : a.trail);
    }
    this._ribbons.hideFrom(nr);
    this.stats.culled = this.actors.length - drawn;
    return drawn;
  },
  _drawThings() {
    const pen = this.pen, cam = this.camera;
    for (const t of this.things) {
      if (!t.visible || !cam.sees(t.x, t.y, t.z)) continue;
      const draw = THINGS[t.kind]; if (!draw) continue;
      pen.at(t.x, t.y, t.z + (t.bob ? (Math.sin(t.t * 2.4) * .5 + .5) * t.bob : 0), t.yaw + t.spin * t.t * TAU, t.size); pen.flash = t.flash > 0;
      draw(pen, t, this.time);
      if (t.shadow !== false && t.kind !== 'door') shadowAt(this, t.x, t.y, t.z + (t.bob || 0), t.r * .8, 1);
    }
    pen.at(); pen.flash = false;
  },
  _drawProps() {
    const M = this._propMesh, cam = this.camera; let nc = 0, nb = 0;
    for (const p of this.props) {
      if (p.mesh) { toThree(p.x, p.y, p.z, p.mesh.position); p.mesh.quaternion.copy(quatToThree(p.q, _pq)); continue; }
      if (!cam.sees(p.x, p.y, p.z - 8)) continue;
      quatToThree(p.q, _pq); if (p.kind === 'barrel') _pq.multiply(_rotZY);   // (the barrel's cylinder stands along Rapier's y, three's along its own y)
      _m4.compose(toThree(p.x, p.y, p.z, _pv), _pq, _ps);
      if (p.kind === 'crate') M.crate.setMatrixAt(nc++, _m4); else M.barrel.setMatrixAt(nb++, _m4);
    }
    M.crate.count = nc; M.barrel.count = nb; M.crate.instanceMatrix.needsUpdate = M.barrel.instanceMatrix.needsUpdate = true;
    for (const q of this.platforms) toThree(q.x, q.y, q.z - q.h / 2, q.mesh.position);
  },
  /** the frame's arcs, glows (the first four lit) and the game's particles; your lights */
  _effects(v) {
    const Q = this._queue, B = this.B;
    Q.arcs.forEach((a, i) => this._arcs.set(i, ...a)); this._arcs.hideFrom(Q.arcs.length);
    let nl = 0;
    for (const [x, y, z, r, color, core, lit] of Q.glows) {
      _pa[0] = x / U; _pa[1] = z / U; _pa[2] = y / U; const c = lin(color);
      B.halo.ball(_pa, r * 1.6 / U, r * 1.6 / U, r * 1.6 / U, [c[0] * .5, c[1] * .5, c[2] * .5]); B.glow.ball(_pa, r * .6 / U, r * .6 / U, r * .6 / U, lin(core));
      if (lit && nl < this._glowLights.length) { const L = this._glowLights[nl++]; L.position.set(_pa[0], _pa[1], _pa[2]); L.color.set(color); L.intensity = 10; }
    }
    for (let k = nl; k < this._glowLights.length; k++) this._glowLights[k].intensity = 0;
    Q.arcs.length = 0; Q.glows.length = 0;
    // the game's particles: tiny quads facing the camera (sparks, embers, glints, impacts add light; dust and bits are
    // solid); rings lie on the ground; text goes on the HUD (_texts)
    const PT = this.part; for (const b of Object.values(PT)) b.begin();
    let nrg = 0;
    const quad = (Bt, x, y, z, r, col) => { const s = r / U; Bt.put(v.right.x * s, v.right.y * s, v.right.z * s, v.up.x * s, v.up.y * s, v.up.z * s, v.back.x, v.back.y, v.back.z, x / U + v.back.x * .05, z / U + v.back.y * .05, y / U + v.back.z * .05, col); };
    const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
    for (const p of this.game.particles.list) {
      const u = p.life / p.max;
      switch (p.kind) {
        case 'spark': quad(PT.add, p.x, p.y, p.z, (p.size > 1.5 ? 1.4 : 1) * (1 - u * .5), lin(u < .5 ? (p.hot || '#fff5cf') : p.color)); break;
        case 'ember': quad(PT.add, p.x, p.y, p.z, .9, mul(lin(u < .4 ? '#fff0b0' : p.color), 1 - u * .8)); break;
        case 'glint': { const k = (1 - Math.abs(u * 2 - 1)) * p.size * 2.5; if (k > .2) quad(PT.add, p.x, p.y, p.z, k * .7, lin(p.color)); break; }
        case 'impact': quad(PT.add, p.x, p.y, p.z, p.size * (u < .35 ? 1 : 1.4 - u), lin(u < .35 ? '#ffffff' : p.color)); break;
        case 'fire': quad(PT.add, p.x, p.y, p.z, p.size * (u < .3 ? .6 + u * 1.4 : 1.02 - (u - .3) * .5), lin(u < .15 ? '#fffbe0' : u < .3 ? '#ffe070' : u < .5 ? '#ffa030' : u < .7 ? '#e0502a' : '#5a4a4a')); break;
        case 'bit': quad(PT.bit, p.x, p.y, p.z, p.size * .5, lin(p.color)); break;
        case 'ring': if (nrg < 48) { const rr = lerp(p.r0, p.r1, E.ease.outQuad(u)); this._rings.set(nrg++, p.x, p.y, p.z, rr - .7, rr + .7, 0, TAU, p.color, 1 - u); } break;
        case 'text': break;
        default: quad(PT.solid, p.x, p.y, p.z, p.size * (1 + u * 1.4) * (1 - u * .6), lin(p.color || '#b9a88f'));   // dust, smoke
      }
    }
    this._rings.hideFrom(nrg);
    for (const b of Object.values(PT)) b.end(false);
  },
  /** the game's text particles (damage numbers, words) on the HUD where the camera sees them */
  _texts(r) {
    for (const p of this.game.particles.list) {
      if (p.kind !== 'text') continue;
      const u = p.life / p.max; if (!(u < .75 || Math.floor(p.life * 20) % 2)) continue;
      const s = this.project(p.x, p.y, p.z); if (!s) continue;
      r.overlay(g => E.font.text(g, p.text, Math.round(s[0]), Math.round(s[1]), p.color, { align: 'center', scale: p.scale || 1, outline: '#0b0814' }));
    }
  },
  /** draw everything once, empty (scaled to nothing), so every material builds its shaders and GPU pipelines now, shadow
   *  passes too, and none stalls a frame mid-game */
  _warmUp(cam, view) {
    this._warm = true;
    this._arcs.prepare(8); this._rings.prepare(12); this._ribbons.prepare(6); this.atlas.prepare(view, 1);
    const Z = new THREE.Matrix4().makeScale(0, 0, 0), M = this._propMesh, inst = [M.crate, M.barrel];
    for (const b of [...Object.values(this.B), ...Object.values(this.part)]) { inst.push(b.mesh); if (b.shell) inst.push(b.shell); }
    for (const pg of this.atlas.pages) inst.push(pg.mesh);
    inst.push(this._shapeKit.probe, this._shapeKit.probeShell);   // (the shapes' shaders, before any is placed)
    const counts = inst.map(m => m.count), pools = [...this._arcs.list, ...this._rings.list, ...this._ribbons.list], vis = pools.map(m => m.visible);
    for (const m of inst) { m.setMatrixAt(0, Z); m.instanceMatrix.clearUpdateRanges(); m.instanceMatrix.needsUpdate = true; m.count = 1; }
    for (const m of pools) m.visible = true;
    const sh = this._shadowLights.map(L => [L.castShadow, L.intensity]), gl = this._glowLights.map(L => L.intensity), ul = this._userLights.map(L => L.intensity);
    for (const L of [...this._shadowLights, ...this._glowLights, ...this._userLights]) { L.intensity = Math.max(L.intensity, .001); }
    this._shadowLights.forEach(L => { L.castShadow = true; });
    const capes = this.capes.mesh, cd = capes.geometry.drawRange.count, cv = capes.visible; capes.geometry.setDrawRange(0, 6); capes.visible = true;
    this._render(cam);
    capes.geometry.setDrawRange(0, cd); capes.visible = cv;
    this._shadowLights.forEach((L, i) => { L.castShadow = sh[i][0]; L.intensity = sh[i][1]; }); this._glowLights.forEach((L, i) => { L.intensity = gl[i]; }); this._userLights.forEach((L, i) => { L.intensity = ul[i]; });
    inst.forEach((m, i) => { m.count = counts[i]; }); pools.forEach((m, i) => { m.visible = vis[i]; });
  },
  /** build every shader now (a boot step): one warm-up frame drawn off the record (three r182's compileAsync leaves a
   *  light's shadow without its map, so the warm-up draws instead) */
  prepare() {
    if (!PAGE.renderer) return this;
    const rw = this._fit(); this.camera.update(0); const cam = this.camera.place(rw[0], rw[1]);
    if (!this._warm) this._warmUp(cam, this.camera.cardView());
    return this;
  },
  /** free the world: its physics, meshes, materials and textures (the page's renderer stays for the next world) */
  dispose() {
    if (this.pw) { this.pw.free(); this.pw = null; }
    this.atlas.dispose();
    this.scene.traverse(o => { if (o.isMesh) { o.geometry && o.geometry.dispose(); } });
    for (const x of this._owned) if (x && x.dispose) x.dispose();
    PAGE.worlds.delete(this);
  }
});
/** a blob shadow on the surface under a body (smaller and lighter the higher the body is above it) */
function shadowAt(world, x, y, z, r, a) {
  const f = world.floorAt(x, y, z + 1); if (f <= world.bottom + 1) return;
  const up = Math.max(0, z - f), k = Math.max(.35, 1 - up / 80), sh = P3[23];
  sh[0] = x / U; sh[1] = (f + .2) / U; sh[2] = y / U; world.B.blob.ball(sh, r * k / U * a, 1, r * k * .8 / U * a, BLACKISH);
}
/** does the segment a -> b (engine units) pass through the box [x0, y0, z0] - [x1, y1, z1]? (slabs) */
function segBox(a, b, x0, y0, z0, x1, y1, z1) {
  let t0 = 0, t1 = 1;
  for (let k = 0; k < 3; k++) {
    const lo = k === 0 ? x0 : k === 1 ? y0 : z0, hi = k === 0 ? x1 : k === 1 ? y1 : z1, d = b[k] - a[k];
    if (Math.abs(d) < 1e-9) { if (a[k] < lo || a[k] > hi) return false; continue; }
    let u = (lo - a[k]) / d, v = (hi - a[k]) / d; if (u > v) [u, v] = [v, u];
    t0 = Math.max(t0, u); t1 = Math.min(t1, v); if (t0 > t1) return false;
  }
  return true;
}
const _ray = new THREE.Raycaster(), _ndc = new THREE.Vector2();

/* =============================================================================
 * 10b. FILTERS  one look over the finished picture: world.filter = { look, apply, bloom, fxaa, ... } (change it any time)
 *   look 'clean'   no filter: the scene goes straight to the screen (no extra pass)
 *        'cel'     Comic cel: light in a few flat bands (bands), colors pushed (punch), ink where the picture changes
 *                  sharply (ink: strength, inkW: width) and round every character's and thing's silhouette
 *        'pixel'   square blocks (px: the block in the picture's pixels), a few levels per channel (levels), ordered
 *                  dithering between them (dither)
 *   apply 'all' | 'objects' (the characters, things and props only) | 'env' (the level only)
 *   bloom: bright parts glow; fxaa: edges smoothed. All in TSL, the same on WebGPU and WebGL 2. With a filter on, the
 *   scene draws a mask of its characters and things beside the picture (MRT), which is how a filter takes them alone
 * ============================================================================= */
const FX_DEFAULT = { look: 'clean', apply: 'all', bands: 4, ink: .9, inkW: 1.5, punch: 1.3, px: 4, levels: 8, dither: .35, bloom: false, fxaa: false };
const fxOn = f => f.look === 'cel' || f.look === 'pixel' || f.bloom || f.fxaa;
function makeFX(world) {
  const { pass, mrt, output, rtt, float, vec2, vec3, vec4, uv, uniform, floor, mod, abs, max, min, mix, select, smoothstep, luminance, saturation, sRGBTransferOETF } = TSL;
  const UF = { bands: uniform(4), ink: uniform(.9), inkW: uniform(1.5), punch: uniform(1.3), px: uniform(4), levels: uniform(8), dither: uniform(.35), apply: uniform(0), texel: uniform(new THREE.Vector2(1, 1)), qtexel: uniform(new THREE.Vector2(1, 1)) };
  const post = new THREE.PostProcessing(PAGE.renderer); post.outputColorTransform = false;   // (the filters end in display colors themselves)
  const scenePass = pass(world.scene, world.camera.persp); scenePass.setMRT(mrt({ output, mask: float(0) }));
  const colTex = scenePass.getTextureNode('output'), maskTex = scenePass.getTextureNode('mask'), INK = vec3(.047, .031, .094);
  const sceneAt = u => sRGBTransferOETF(colTex.sample(u).rgb), maskAt = u => maskTex.sample(u).r;
  const keep = m => select(UF.apply.equal(0), float(1), select(UF.apply.equal(1), m, float(1).sub(m)));
  function cel() {
    const u = uv(), c = sceneAt(u), l = luminance(c);
    const q = max(floor(l.mul(UF.bands).add(.5)), .5).div(UF.bands), banded = c.mul(q.div(max(l, .002))), punched = saturation(banded, UF.punch);
    const o = UF.texel.mul(UF.inkW), m = maskAt(u); let edge = float(0), rim = float(0);
    for (const d of [vec2(o.x, 0), vec2(o.x.negate(), 0), vec2(0, o.y), vec2(0, o.y.negate())]) { edge = max(edge, luminance(sceneAt(u.add(d))).sub(l)); rim = max(rim, m.sub(maskAt(u.add(d)))); }
    return mix(c, min(max(mix(punched, INK, max(smoothstep(.16, .36, edge), rim).mul(UF.ink)), vec3(0)), vec3(1)), keep(m));
  }
  function pixel() {
    const u = uv(), res = vec2(1).div(UF.texel), blk = floor(u.mul(res).div(UF.px)), cu = blk.add(.5).mul(UF.px).div(res), c = sceneAt(cu);
    const b2 = (x, y) => abs(x.sub(y)).mul(2).add(y), bayer = b2(mod(blk.x, 2), mod(blk.y, 2)).mul(4).add(b2(mod(floor(blk.x.div(2)), 2), mod(floor(blk.y.div(2)), 2))).add(.5).div(16).sub(.5);
    const L = UF.levels.sub(1), q = floor(c.mul(L).add(bayer.mul(UF.dither)).add(.5)).div(L), m = select(UF.apply.equal(1), maskAt(cu), maskAt(u));
    return mix(sceneAt(u), min(max(q, vec3(0)), vec3(1)), keep(m));
  }
  const W9 = [.227, .194, .121, .054, .016];
  function bloom() {
    const bright = rtt(vec4(sceneAt(uv()).mul(smoothstep(.72, 1, luminance(sceneAt(uv())))), 1), 1, 1);
    const blur = (src, dir) => { let acc = src.sample(uv()).rgb.mul(W9[0]); for (let i = 1; i < 5; i++) acc = acc.add(src.sample(uv().add(dir.mul(i * 1.6))).rgb.mul(W9[i])).add(src.sample(uv().sub(dir.mul(i * 1.6))).rgb.mul(W9[i])); return rtt(vec4(acc, 1), 1, 1); };
    const hh = blur(bright, vec2(UF.qtexel.x, 0)), v = blur(hh, vec2(0, UF.qtexel.y));
    return { targets: [bright, hh, v], glow: v.sample(uv()).rgb };
  }
  function fxaa(src) {
    const u = uv(), t = UF.texel, L = p => luminance(src.sample(p).rgb);
    const nw = L(u.add(vec2(-1, -1).mul(t))), ne = L(u.add(vec2(1, -1).mul(t))), sw = L(u.add(vec2(-1, 1).mul(t))), se = L(u.add(vec2(1, 1).mul(t))), m = L(u);
    const lo = min(m, min(min(nw, ne), min(sw, se))), hi = max(m, max(max(nw, ne), max(sw, se))), dir0 = vec2(nw.add(ne).sub(sw.add(se)).negate(), nw.add(sw).sub(ne.add(se)));
    const reduce = max(nw.add(ne).add(sw).add(se).mul(.25 / 8), 1 / 128), rcp = float(1).div(min(abs(dir0.x), abs(dir0.y)).add(reduce)), dir = min(vec2(8), max(vec2(-8), dir0.mul(rcp))).mul(t);
    const a = src.sample(u.add(dir.mul(1 / 3 - .5))).rgb.add(src.sample(u.add(dir.mul(2 / 3 - .5))).rgb).mul(.5), b = a.mul(.5).add(src.sample(u.add(dir.mul(-.5))).rgb.add(src.sample(u.add(dir.mul(.5))).rgb).mul(.25)), lb = luminance(b);
    return select(lb.lessThan(lo).or(lb.greaterThan(hi)), a, b);
  }
  const OBJ_MASK = mrt({ mask: float(1) }), sz = new THREE.Vector2();
  let targets = [], key = '', tagged = false;
  return {
    /** tag the world's characters and things for the mask (only while a filter is on: a material with its own MRT
     *  outputs can't draw straight to the screen) */
    tag(on) { if (on === tagged) return; tagged = on; for (const m of world._objMats) { m.mrtNode = on ? OBJ_MASK : null; m.needsUpdate = true; } world._warm = false; },
    render(cam) {
      const F = world.filter, k = [F.look, F.bloom, F.fxaa].join();
      if (k !== key) {
        key = k; let col = F.look === 'cel' ? cel() : F.look === 'pixel' ? pixel() : sceneAt(uv()); targets = [];
        if (F.bloom) { const b = bloom(); targets = b.targets; col = col.add(b.glow.mul(.6)); }
        if (F.fxaa) col = fxaa(rtt(vec4(col, 1)));
        post.outputNode = vec4(col, 1); post.needsUpdate = true; world._warm = false;
      }
      PAGE.renderer.getDrawingBufferSize(sz); UF.texel.value.set(1 / sz.x, 1 / sz.y);
      const qw = Math.max(1, Math.round(sz.x / 4)), qh = Math.max(1, Math.round(sz.y / 4));
      for (const t of targets) if (t.width !== qw || t.height !== qh) t.setSize(qw, qh);
      UF.qtexel.value.set(1 / qw, 1 / qh);
      for (const n of ['bands', 'ink', 'inkW', 'punch', 'px', 'levels', 'dither']) UF[n].value = F[n];
      UF.apply.value = F.apply === 'objects' ? 1 : F.apply === 'env' ? 2 : 0;
      scenePass.camera = cam; post.render();
    }
  };
}
Object.assign(World3D.prototype, {
  /** draw the picture: straight to the screen, or through the filter */
  _render(cam) {
    const on = fxOn(this.filter);
    if (on || this._fx) { this._fx = this._fx || makeFX(this); this._fx.tag(on); }
    if (on) this._fx.render(cam); else PAGE.renderer.render(this.scene, cam);
  }
});

/* =============================================================================
 * 11. THE ENGINE'S HANDLES  E.World3D (init, the registries, the input preset and settings), E.THREE, E.TSL, E.RAPIER
 * ============================================================================= */
/** load three.js's renderer and Rapier once for the page (await it in a boot step): the 3D canvas under the game's.
 *  o: { backend: 'webgl' (force WebGL 2; the address's ?backend=webgl does too), canvas (a canvas or its id: #view by
 *  default, made if missing), render: false (physics only: no picture) } */
World3D.init = init;
/** the drawings of things by kind: (pen, thing, time) => { pen.box(...)... } (section 5). Add your own kinds */
World3D.THINGS = THINGS;
/** the ground's looks by name (section 2): (x, y, entry) -> [r, g, b] or [r, g, b, glow]. Add your own */
World3D.GROUND = GROUND;
/** the sides' looks by name (section 2): { w, h, fn(x, y, colors) }. Add your own */
World3D.SIDE = SIDE;
/** the controls a 3D action game starts from (new E.Game({ input: E.World3D.INPUT })): WASD or the arrows or the left
 *  stick move, Space or A jumps, J or a click or X attacks, Shift or K or B dashes, E or L or a right click or Y uses a
 *  skill, C or the right stick's click changes the camera; the menu keys of the 2D engine's presets */
World3D.INPUT = Object.assign({}, E.Input.DEFAULT, {
  jump: ['Space', 'Pad0'], attack: ['KeyJ', 'Mouse0', 'Pad2', 'Pad7'], dash: ['ShiftLeft', 'ShiftRight', 'KeyK', 'Pad1', 'Pad6'],
  skill: ['KeyE', 'KeyL', 'Mouse2', 'Pad3', 'Pad5'], camera: ['KeyC', 'Pad11']
});
/** the player's 3D settings for the pause menu (new E.Game({ menu: { settings: E.World3D.SETTINGS } })): Characters
 *  (cards or puppets), 3D picture (pixels, balanced, full), Shadows and Filter, read by every world as it draws */
World3D.SETTINGS = [
  { key: 'look3d', label: 'Characters', group: 'Display', value: 'card', options: [['card', 'Drawn (cards)'], ['puppet', '3D (puppets)']], help: 'Cards are drawn exactly as in the 2D games; puppets are 3D parts on the same bones, in the scene\'s light and shadow.' },
  { key: 'picture3d', label: '3D picture', group: 'Display', value: 'pixels', options: [['pixels', 'Pixels'], ['balanced', 'Balanced'], ['full', 'Full']], help: 'Pixels: the game\'s own resolution, chunky and fast. Full: the screen\'s.' },
  { key: 'shadows3d', label: 'Shadows', group: 'Display', value: true, help: 'Torches and the sun cast real shadows.' },
  { key: 'filter3d', label: 'Filter', group: 'Display', value: 'clean', options: [['clean', 'None'], ['cel', 'Comic cel'], ['pixel', 'Pixel']], help: 'A look over the whole picture: comic-book ink and flat light, or big dithered pixels.' }
];
Object.defineProperties(World3D, {
  /** 'WebGPU' | 'WebGL 2' | 'none': what draws the 3D picture (after init) */
  backend: { get: () => PAGE.backend },
  /** the page's three.js renderer (after init), null without a picture */
  renderer: { get: () => PAGE.renderer },
  /** the worlds alive now */
  worlds: { get: () => [...PAGE.worlds] }
});
/** U: engine units per metre (16); toThree(x, y, z): engine units -> a three.js Vector3 in metres (y up) */
World3D.U = U; World3D.toThree = toThree; World3D.hashNumbers = hashNumbers;
E.World3D = World3D; E.THREE = THREE; E.TSL = TSL; E.RAPIER = RAPIER;
export { World3D, THREE, TSL, RAPIER };
export default World3D;
