/*!
 * my-3D2dge v0.46.1  (My "3D" 2D Game Engine)
 * Procedural pixel-puppet engine for every 2D perspective.
 * https://github.com/michaelcrosato/my-3d2dge  (MIT License)
 *
 * READ THIS FIRST (humans and AI models extending a my-3D2dge game)
 * -----------------------------------------------------------------------------
 * 0. EVERY GAME STARTS WITH  const E = My3D2dge;  and then uses E.Game, E.px, ...
 * 1. WORLD SPACE IS 3D. x = east, y = south, z = up. One floor tile = 16 units.
 *    Game logic never thinks about screen pixels.
 * 2. A VIEW turns world points into screen pixels. Swap the view and the whole game
 *    re-renders from another angle: E.VIEWS.iso, .threequarter, .topdown,
 *    .brawler, .side  (or build your own: new E.View(id, label, yaw, pitch, scale, zBoost)).
 * 3. CHARACTERS ARE RIGS, NOT SPRITES. E.Humanoid and E.Blob recompute their
 *    joints from math every step, in 3D, then project them. That is why they move
 *    fluidly and can face any angle in any view without extra art. Small things
 *    (coins, bullets, icons) can be pixel sprites written as strings: E.sprite().
 * 4. PIXEL RULES. Draw with E.px (rect, line, disc, ell, poly, sprite...). Every shape
 *    snaps to whole pixels. Never use ctx.arc / ctx.stroke / ctx.fillText on the game
 *    buffer: they anti-alias and break the look. Translucency and glow go through
 *    px.blend / polyDither / ddisc / r.glowDisc: stepped alpha and blend modes like PS1
 *    hardware (E.style.trans = 'dither' switches to NES / Genesis style dithering).
 * 5. FRAME ORDER (handled by the Renderer):
 *      background (r.sky, map.drawFloor or level.draw) -> decals (ground marks, shadows)
 *      -> sorted queue (walls, props, actors, particles) -> lighting -> overlays -> present
 *    Anything that can be in front of or behind something else goes through
 *    r.queue(x, y, z, fn), r.actor(x, y, z, drawFn, opts) or r.sprite(...).
 * 6. TIME. game.start({ update(dt), draw(r) }) or game.start({ scenes, scene }).
 *    update runs in exact fixed steps: each 1/120 s of real time is one update with
 *    dt = 1/120 * timeScale, so motion is identical at 60, 90, 120 or 144 Hz (game.alpha =
 *    the part of a step left over). game.freeze(s) = hit-stop, game.shake(n) = screen shake,
 *    game.timeScale = slow motion, game.paused = pause, game.after(s, fn) = timer.
 * 7. LEVELS. Top-down / isometric / brawler floors: E.TileMap (walls on the ground
 *    plane). Side-scrollers: E.PlatformMap + E.Platformer (tiles on the x/z plane,
 *    solid, one-way, ladders, hazards, moving platforms). Both read ASCII rows. Third person (Assassin's Creed):
 *    E.Mover on a TileMap of roofs climbs, vaults and leaps; E.ACTIONS, and E.sees / E.Suspicion for guards (17b-17d).
 * 8. SOUND, TEXT, MENUS. game.audio.sfx('jump'), game.audio.music(song);
 *    E.font.text(...) (5x7 proportional font), E.font.title(...), E.ui.box/bar/hearts,
 *    new E.Dialog(game), new E.Menu(game, items). An HTML interface (title, pause, settings, help, results, map
 *    screens and a HUD with a minimap) from data: new E.Shell(game, {...}) (21d).
 * 8a. STANDARD FEATURES come with every game (10b): a pause menu with settings and controls the player rebinds, saved
 *    per game (game.settings), full screen (game.fullscreen; a phone's first tap), pausing when the page is hidden, and
 *    input.label(action) for prompts, and a boot (10c): heavy setup in game.start({ boot: { steps } }) runs behind a
 *    boot screen, and an error before play shows a report to screenshot. Don't build your own: adjust them with
 *    new E.Game({ menu: { items, settings, controls, quit } }), or leave them out (menu: false, fullscreen: false,
 *    corner: false, autoPause: false).
 * 8b. LOOK. Aim for PS1 / N64 era 2D, not NES: HD rigs (size, outfit, hair, armor),
 *    new E.Backdrop('castle-night') behind levels, textured tiles (stone, brick, wood,
 *    metal), r.prop('torch', ...) set dressing, particles.explosion / smoke / fire,
 *    game.flash, and E.tones(hex) / E.ramp(hex) for hue-shifted shading.
 * 9. GPU LIGHTING is optional: game.enableGPU({ map }). Mark glowing things with
 *    px.glow(g, 1) inside queue callbacks, pass { color, shadow } to lights.add, and
 *    register shadow casters with game.lights.caster(). Falls back to Canvas lighting.
 * 10. SESSIONS. E.session.record(true) records every later page load (or ?record=1 for one): the frame times, the
 *    inputs, the random seed, the screen and the save. E.session.share() saves it as a file; node tools/replay.mjs
 *    plays it back headless, exactly, and stops where it differs (game.stateHash = () => [...] sharpens that).
 * 11. TESTS. new E.Game({ headless: true }) (the default in Node) runs with no screen: game.advance(1) runs 120 fixed
 *    steps at once, game.input.tap('jump') and hold('right') script input, game.debug = { snapshot() { ... } } is
 *    your game's handle for tests and tools; game.stop(), start() and dispose() stop, resume and end it.
 * Errors in your game are shown on screen and in the console (game.errors).
 * THE HANDOFF PACKAGE holds this file and what it needs (dist/handoff/ in the repo, my-3d2dge.vercel.app/handoff/):
 *    API.md, the card (read it whole; the single-file editions embed it), API-INDEX.md (every public name, one line
 *    each: search it), AI_GUIDE.md (the recipes), tools/check.mjs, filmstrip.mjs and replay.mjs, and game/, a
 *    template game with a headless test.
 * MORE, outside this file (github.com/michaelcrosato/my-3d2dge; search it and take only what a game needs, its files
 *    are large): 325 curated motion clips and 2,548 motion-capture takes as readable key poses that play on any
 *    Humanoid (src/mocap/: the catalogs list every clip's tags and description, tools/anim-set.mjs cuts the ones you
 *    want into a small set, src/mocap/mocap.js plays them), and Emberdeep (src/emberdeep/), a whole game of worked
 *    examples: monsters, bosses, heroes with bodies that are not people, skills. AI_GUIDE.md, "Where to find more",
 *    says how to search them and take what you need. Still objects and materials as data (r.shape, E.MATERIALS):
 *    docs/ASSETS.md, its recipe checked with tools/asset-sheet.mjs.
 */
(function (root) {
'use strict';

/** TAU: 2π, a full turn in radians; DEG: π/180, one degree in radians (angle * DEG) */
const TAU = Math.PI * 2, DEG = Math.PI / 180;
/** version: the release (package.json, written everywhere by node tools/version.mjs); build: the commit this copy was built
 *  from, a placeholder in the repo that tools/stamp.mjs replaces when the site deploys (e.g. 'a1b2c3d 2026-10-07');
 *  name: the engine's name, 'my-3D2dge'; current: the latest game made (My3D2dge.current, for tools and tests) */
const E = { version: '0.46.1', build: 'dev-build', name: 'my-3D2dge', TAU, DEG, current: null };
/** 'v0.7.0 · a1b2c3d 2026-10-07': the label to show on screens and in reports */
E.versionLabel = () => 'v' + E.version + ' · ' + E.build;
const _warned = new Set();
/** one console warning per distinct problem, prefixed so tools (and people) can spot engine advice: warn(key, message) */
const warn = (key, msg) => { if (_warned.has(key)) return; _warned.add(key); console.warn('my-3D2dge: ' + msg); };
E.warn = warn;

/* =============================================================================
 * 1. MATH
 * ============================================================================= */
/** v kept between a and b */
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
/** a + (b - a) * t: the point t of the way from a to b (t 0..1) */
const lerp = (a, b, t) => a + (b - a) * t;
/** a moved toward b by at most s, never past it: approach(speed, top, accel * dt) */
const approach = (a, b, s) => a < b ? Math.min(b, a + s) : Math.max(b, a - s);
/** easing curves for u 0..1 */
const ease = {
  outCubic: u => 1 - Math.pow(1 - u, 3),   // fast start, smooth stop
  outQuad: u => 1 - (1 - u) * (1 - u),   // fast start, smooth stop (gentler than outCubic)
  inQuad: u => u * u,   // slow start, fast end
  inOut: u => u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2,   // slow start and end
  outBack: u => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); }   // overshoots past 1, then settles: pop-ups, landings
};
/** the shortest signed turn from angle a to angle b, -π..π (radians) */
const angDiff = (a, b) => ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
/** an angle t of the way from a to b by the shorter way round */
const lerpAng = (a, b, t) => a + angDiff(a, b) * t;
/** angle a turned toward b by at most s radians: facing = approachAng(facing, target, turnSpeed * dt) */
const approachAng = (a, b, s) => { const d = angDiff(a, b); return Math.abs(d) <= s ? b : a + Math.sign(d) * s; };
/** a seeded random stream: const R = E.rng(42); R() gives 0..1, the same numbers for the same seed (mulberry32) */
function rng(s) { return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
/** a fixed random number 0..1 for whole-number grid coordinates (texture specks, scatter that never flickers) */
function hash2(x, y) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
/** smooth value noise 0..1 over the plane (one bump per whole unit): blotches, clouds, wobble */
function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(hash2(xi, yi), hash2(xi + 1, yi), u), lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v);
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16);
/** the 4 x 4 ordered-dither threshold 0..1 at pixel (x, y): pixel on when value > bayer(x, y) */
const bayer = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
/** critically damped follow: [next, nextVelocity] = smoothDamp(cur, target, vel, smoothTime, dt); settles in about
 *  smoothTime seconds without overshoot */
function smoothDamp(cur, target, vel, st, dt) {
  const om = 2 / st, x = om * dt, ex = 1 / (1 + x + .48 * x * x + .235 * x * x * x), ch = cur - target, tmp = (vel + om * ch) * dt;
  return [target + (ch + tmp) * ex, (vel - om * tmp) * ex];
}
/** '#rrggbb' or '#rgb' (or an [r, g, b] array) -> [r, g, b] */
const hex = h => {
  if (Array.isArray(h)) return h.slice(0, 3);
  let s = String(h).trim(); if (s[0] === '#') s = s.slice(1);
  if (s.length === 3 || s.length === 4) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  const n = parseInt(s.slice(0, 6), 16);
  if (s.length < 6 || isNaN(n)) { warn('hex:' + h, 'color "' + h + '" is not a "#rrggbb" hex color; engine color helpers need hex (drawn magenta)'); return [255, 0, 255]; }
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
};
/** [r, g, b] -> '#rrggbb' */
const toHex = c => '#' + c.map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
const _shades = new Map();
/** shade('#336699', -0.3) darker, (+0.3) lighter. Hue-shifted like painted pixel art: darker drifts cool, lighter drifts warm */
const shade = (h, a) => {
  const key = h + '|' + a; let r = _shades.get(key); if (r) return r;
  const c = hex(h), flat = toHex(c.map(v => a < 0 ? v * (1 + a) : v + (255 - v) * a)), [hh, s, l] = toHsl(flat);
  r = s < .08 ? flat : hsl(hueToward(hh, a < 0 ? 250 : 55, Math.abs(a) * 24), s + (a < 0 ? .05 : -.05) * Math.min(1, Math.abs(a) * 3), l);
  if (_shades.size > 2000) _shades.clear(); _shades.set(key, r); return r;
};
/** the color t of the way from h1 to h2 ('#rrggbb') */
const mix = (h1, h2, t) => { const a = hex(h1), b = hex(h2); return toHex(a.map((v, i) => lerp(v, b[i], t))); };
/** a new canvas of w x h pixels (scratch images and sprite sheets). With no document (Node: a headless game) a stand-in
 *  whose drawing does nothing, so sprites and other images made while a game loads don't stop it */
const mkCanvas = (w, h) => { if (typeof document === 'undefined') return nullCanvas(w, h); const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const nullCanvas = (w, h) => {
  const c = { width: w, height: h }, img = (iw, ih) => ({ width: iw, height: ih, data: new Uint8ClampedArray(Math.max(0, iw * ih * 4)) });
  const made = { getImageData: (x, y, iw, ih) => img(iw, ih), createImageData: (iw, ih) => img(iw.width || iw, ih || iw.height), measureText: () => ({ width: 0 }),
    createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }), createPattern: () => ({}), canvas: c };
  const g = new Proxy({}, { get: (t, k) => k in t ? t[k] : k in made ? made[k] : () => {}, set: (t, k, v) => { t[k] = v; return true; } });
  c.getContext = () => g;
  return c;
};
/** a canvas's 2D context with smoothing off (crisp pixels) */
const ctx2d = c => { const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return g; };
/** small 3D vector helpers on [x, y, z] arrays */
const V3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],   // a + b
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],   // a - b
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],   // a scaled by s
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],   // dot product
  len: a => Math.hypot(a[0], a[1], a[2]),   // length
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },   // unit vector the same way
  lerp: (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)],   // the point t of the way from a to b
  rz: (v, a) => { const c = Math.cos(a), s = Math.sin(a); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]]; }   // v turned by angle a (radians) about the z axis
};
/** two-bone IK in 3D: returns [joint, end]. hint points the way the joint should bend. */
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
/* ---- color ramps: hue-shifted shading, the way pixel artists shade (shadows cooler, highlights warmer) ---- */
/** a color's hue (degrees), saturation and lightness (0..1): toHsl('#e05a3a') -> [h, s, l] */
function toHsl(h) {
  const [r, g, b] = hex(h).map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1)); let hh;
  if (mx === r) hh = ((g - b) / d) % 6; else if (mx === g) hh = (b - r) / d + 2; else hh = (r - g) / d + 4;
  return [(hh * 60 + 360) % 360, s, l];
}
/** '#rrggbb' from hue (degrees), saturation and lightness (0..1) */
function hsl(hh, s, l) {
  s = clamp(s, 0, 1); l = clamp(l, 0, 1); hh = ((hh % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((hh / 60) % 2 - 1)), m = l - c / 2;
  const [r, g, b] = hh < 60 ? [c, x, 0] : hh < 120 ? [x, c, 0] : hh < 180 ? [0, c, x] : hh < 240 ? [0, x, c] : hh < 300 ? [x, 0, c] : [c, 0, x];
  return toHex([(r + m) * 255, (g + m) * 255, (b + m) * 255]);
}
const hueToward = (hh, target, amt) => { const d = ((target - hh + 540) % 360) - 180; return hh + clamp(d, -amt, amt); };
const _tones = new Map();
/**
 * five shades of a color for painted-looking pixel art: { deep, sh, base, lt, hi }.
 * Shadows drift toward blue-violet, highlights toward warm yellow (strength 0..2, default 1).
 */
function tones(c, strength = 1) {
  const key = c + ':' + strength; let t = _tones.get(key); if (t) return t;
  const [hh, s, l] = toHsl(c), k = strength, grey = s < .08;
  const f = (dl, dh, target, ds) => grey ? hsl(hh, s, l + dl * k) : hsl(hueToward(hh, target, dh * k), s + ds, l + dl * k);
  const skin = !grey && l > .62 && (hh < 50 || hh > 340);   // skin, sand, cream: shadows go dusky, not orange-red
  t = { deep: skin ? f(-.3, 22, 280, -.22) : f(-.3, 16, 250, .06), sh: skin ? f(-.14, 14, 280, -.16) : f(-.15, 9, 250, .05), base: c, lt: f(.1, 6, 50, -.02), hi: f(.24, 12, 55, -.08) };
  if (_tones.size > 600) _tones.clear();
  _tones.set(key, t); return t;
}
/** a ramp of n colors from dark to light around a base color (hue shifted), for palettes and gradients */
function ramp(c, n = 5, strength = 1) {
  const [hh, s, l] = toHsl(c), out = [];
  for (let i = 0; i < n; i++) { const u = n < 2 ? 0 : i / (n - 1) * 2 - 1; out.push(s < .08 ? hsl(hh, s, l + u * .3 * strength) : hsl(hueToward(hh, u < 0 ? 250 : 55, Math.abs(u) * 14 * strength), s + (u < 0 ? .06 : -.06) * Math.abs(u), l + u * .3 * strength)); }
  return out;
}
Object.assign(E, { toHsl, hsl, tones, ramp });

/* ---- small helpers games write over and over ---- */
/** rand() 0..1, rand(b) 0..b, rand(a, b) a..b */
const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
/** whole number from a to b, both included */
const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
/** a random item of list (Math.random) */
const pick = list => list[(Math.random() * list.length) | 0];
/** true with probability p (0..1) */
const chance = p => Math.random() < p;
/** distance between two objects with x, y (and optional z) */
const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y, (b.z || 0) - (a.z || 0));
/** ground angle from a to b (radians, 0 = east, PI/2 = south) */
const angleTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
/** circles on the ground plane: { x, y, r } */
const overlap = (a, b) => { const dx = a.x - b.x, dy = a.y - b.y, r = (a.r || 0) + (b.r || 0); return dx * dx + dy * dy < r * r; };
/** side-view boxes: { x (center), z (feet), w, h } (the Platformer / PlatformMap convention) */
const overlapBox = (a, b) => Math.abs(a.x - b.x) * 2 < a.w + b.w && a.z < b.z + b.h && b.z < a.z + a.h;
/**
 * the numbers of THE HEIGHT RULES, which collision, standing, sight, reach, navigation and drawing all read (API.md,
 * "Heights", and the API index's head give the rules), in world units above a body's feet. The defaults fit a size-1.3
 * Humanoid; a body's own eye and chest override these (crouching lowers them)
 */
const HEIGHTS = { eye: 30, chest: 22, level: 8, step: 2 };
/** melee cone on the ground: is b (with optional radius r) within range of a and within halfAngle of facing? dz (optional)
 *  also limits the height difference, so a hero on a roof can't hit a guard in the street (left out, height is ignored) */
const inArc = (a, facing, b, range, halfAngle, dz) => { const dx = b.x - a.x, dy = b.y - a.y; return Math.hypot(dx, dy) <= range + (b.r || 0) && Math.abs(angDiff(facing, Math.atan2(dy, dx))) <= halfAngle && (dz === undefined || Math.abs((b.z || 0) - (a.z || 0)) <= dz); };
/** within tol (default E.HEIGHTS.level, 8) of the same height: sameLevel(hero, guard) */
const sameLevel = (a, b, tol = HEIGHTS.level) => Math.abs((a.z || 0) - (b.z || 0)) <= tol;
/**
 * the things in list that `from` can reach, nearest first, each as { target, d (ground distance), dz, angle (from -> it) }:
 * melee auto-aim, lock-on, takedowns, interaction prompts. o: { range, arc (half angle around facing, radians; default all
 * round), facing (default from.facing), dz (most height difference, default E.HEIGHTS.level), sight: map (only those its
 * eyes see), filter: t => bool }. A target's r adds to the range
 */
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
/** remove items in place: prune(bullets, b => b.dead) */
const prune = (list, fn) => { let j = 0; for (let i = 0; i < list.length; i++) if (!fn(list[i])) list[j++] = list[i]; list.length = j; return list; };
/** saved data that survives reloads (localStorage, JSON). Never throws. */
const store = {
  get(key, fallback = null) { try { const v = localStorage.getItem('my3d2dge:' + key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; } },   // the value saved under key (any JSON), or fallback
  set(key, value) { try { localStorage.setItem('my3d2dge:' + key, JSON.stringify(value)); return true; } catch (e) { return false; } },   // save value (any JSON) under key; false when storage is blocked
  remove(key) { try { localStorage.removeItem('my3d2dge:' + key); } catch (e) { /* storage blocked */ } }   // forget key
};
Object.assign(E, { clamp, lerp, approach, ease, angDiff, lerpAng, approachAng, rng, hash2, noise2, bayer, smoothDamp, hex, toHex, shade, mix, mkCanvas, ctx2d, V3, ik3,
  rand, randInt, pick, chance, dist, angleTo, overlap, overlapBox, inArc, sameLevel, targets, HEIGHTS, prune, store });

/* =============================================================================
 * 2. PIXEL PRIMITIVES  (all snap to whole pixels, never anti-aliased)
 *    g = CanvasRenderingContext2D, coordinates in buffer pixels.
 * ============================================================================= */
/** the pixel primitives: px.rect, px.line, px.dot, px.disc, px.poly, px.sprite, ... (each snaps to whole pixels) */
const px = {};
/** set the fill color (px.* do it themselves) */
px.col = (g, c) => { const s = g._info ? g._mat : c; if (g._c !== s) { g.fillStyle = s; g._c = s; } };
/** GPU lighting: what follows glows (0..1). No effect in Canvas mode, so call it freely. */
px.glow = (g, e = 1) => { if (g._info && g._r) { g._mat = g._r._infoCol(g._z || 0, 10, e); g._c = null; } };
/** forget the color cache (after drawing on g with the canvas API directly) */
px.reset = g => { g._c = null; };
/** a filled rectangle, snapped to whole pixels */
px.rect = (g, x, y, w, h, c) => { px.col(g, c); g.fillRect(Math.round(x), Math.round(y), w, h); };
/** one pixel */
px.dot = (g, x, y, c) => { px.col(g, c); g.fillRect(Math.round(x), Math.round(y), 1, 1); };
/** a line w pixels thick, no smoothing */
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
/** a filled circle */
px.disc = (g, cx, cy, r, c) => {
  px.col(g, c); cx = Math.round(cx); cy = Math.round(cy);
  const R = r + .35, R2 = R * R, n = Math.floor(R);
  for (let dy = -n; dy <= n; dy++) { const hw = Math.floor(Math.sqrt(R2 - dy * dy)); g.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1); }
};
/** a filled ellipse */
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
/** a filled polygon through [[x, y], ...] */
px.poly = (g, pts, c) => { px.col(g, c); scan(pts, (a, b, y) => g.fillRect(a, y, b - a + 1, 1)); };
/**
 * Translucency style. 'alpha' (default, PS1 / N64 / SNES color math): real transparency in 1/8 steps, plus blend modes.
 * 'dither' (NES, Game Boy, Genesis look): ordered-dither patterns. Set E.style.trans = 'dither' for the older look.
 */
E.style = { trans: 'alpha' };
const qa = a => Math.round(clamp(a, 0, 1) * 8) / 8;
const useAlpha = g => E.style.trans !== 'dither' && !g._info;
/** draw with translucency and a blend mode: px.blend(g, .5, 'add' | 'normal' | 'multiply' | 'screen' | 'sub', () => {...draws...}) */
const BLEND = { normal: 'source-over', add: 'lighter', multiply: 'multiply', screen: 'screen', sub: 'difference', overlay: 'overlay' };
/** draw fn() at alpha a (stepped, like PS1 hardware) with a blend mode: 'normal', 'add', 'multiply', 'screen'
 *  (E.style.trans = 'dither' dithers instead) */
px.blend = (g, a, mode, fn) => {
  if (g._info) { if (mode === 'normal' || !mode) fn(); return; }
  if (g._cover) { fn(); return; }   // (the renderer's glow cut mask: every pixel a glow touches counts, whatever its blend)
  const ga = g.globalAlpha, gc = g.globalCompositeOperation;
  g.globalAlpha = ga * qa(a); g.globalCompositeOperation = BLEND[mode] || mode || 'source-over';
  try { fn(); } finally { g.globalAlpha = ga; g.globalCompositeOperation = gc; }
};
/** translucent polygon: a = 0..1 opacity (stepped alpha, or a dither pattern in 'dither' style). wx/wy = world pixel offset for the pattern */
px.polyDither = (g, pts, c, a, wx = 0, wy = 0) => {
  if (a <= 0) return; if (a >= 1) return px.poly(g, pts, c);
  if (useAlpha(g)) { const A = qa(a); if (A > 0) px.blend(g, A, 'normal', () => px.poly(g, pts, c)); return; }
  px.col(g, c);
  scan(pts, (xa, xb, y) => { for (let x = xa; x <= xb; x++) if (a > bayer(x + wx, y + wy)) g.fillRect(x, y, 1, 1); });
};
/** soft disc that fades toward its edge (glows, smoke, dust): stepped alpha rings, or dithering in 'dither' style */
px.ddisc = (g, cx, cy, r, c, a, wx = 0, wy = 0) => {
  if (a <= 0) return;
  if (useAlpha(g)) { const ga = g.globalAlpha; for (const [k, f] of [[1, .42], [.7, .42], [.4, .5]]) { const A = qa(a * f); if (A <= 0 || r * k < .4) continue; g.globalAlpha = ga * A; px.disc(g, cx, cy, r * k, c); } g.globalAlpha = ga; return; }
  px.col(g, c); cx = Math.round(cx); cy = Math.round(cy);
  const R = r + .35, R2 = R * R, n = Math.floor(R);
  for (let dy = -n; dy <= n; dy++) {
    const hw = Math.floor(Math.sqrt(R2 - dy * dy));
    for (let dx = -hw; dx <= hw; dx++) if (a * (1 - (dx * dx + dy * dy) / R2 * .6) > bayer(cx + dx + wx, cy + dy + wy)) g.fillRect(cx + dx, cy + dy, 1, 1);
  }
};
/**
 * Pixel sprite written as strings. Each character is one pixel; colors maps a character
 * to a hex color; '.' and ' ' are transparent. scale (whole number) enlarges each pixel.
 *   const COIN = E.sprite(['.yy.', 'yYYy', 'yYYy', '.yy.'], { y: '#f0b020', Y: '#fff0a0' });
 * Draw it with r.sprite(x, y, z, COIN) (depth sorted) or px.sprite(g, COIN, sx, sy).
 */
function sprite(rows, colors = {}, scale = 1) {
  if (typeof rows === 'string') rows = rows.split('\n');
  rows = rows.map(s => String(s));
  const s = Math.max(1, Math.round(scale)), w = Math.max(1, ...rows.map(r => r.length)) * s, h = Math.max(1, rows.length) * s;
  const cv = mkCanvas(w, h), g = ctx2d(cv), fl = mkCanvas(w, h), fg = ctx2d(fl), runs = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') { x++; continue; }
      let n = 1; while (x + n < row.length && row[x + n] === ch) n++;
      const c = colors[ch];
      if (!c) warn('sprite:' + ch, 'sprite character "' + ch + '" has no color in the colors map (drawn magenta)');
      g.fillStyle = c || '#ff00ff'; g.fillRect(x * s, y * s, n * s, s);
      fg.fillStyle = c || '#ff00ff'; fg.fillRect(w - (x + n) * s, y * s, n * s, s);
      runs.push([x * s, y * s, n * s, s]);
      x += n;
    }
  });
  return { w, h, cv, fl, runs, isSprite: true };
}
E.sprite = sprite;
/** draw a sprite with its top-left corner at buffer pixel (x, y). flip mirrors it left-right. */
px.sprite = (g, spr, x, y, flip = false) => {
  x = Math.round(x); y = Math.round(y);
  if (g._info) { px.col(g, '#000'); for (const [rx, ry, rw, rh] of spr.runs) g.fillRect(flip ? x + spr.w - rx - rw : x + rx, y + ry, rw, rh); return; }
  g.drawImage(flip ? spr.fl : spr.cv, x, y);
};
E.px = px;
/** a nearest-neighbour scaled copy of a sprite (cached per factor), used by the camera zoom */
function scaleSprite(spr, z) {
  const c = spr._zc || (spr._zc = {}); if (c[z]) return c[z];
  const w = Math.max(1, Math.round(spr.w * z)), h = Math.max(1, Math.round(spr.h * z)), cv = mkCanvas(w, h), fl = mkCanvas(w, h);
  ctx2d(cv).drawImage(spr.cv, 0, 0, w, h); ctx2d(fl).drawImage(spr.fl || spr.cv, 0, 0, w, h);
  const runs = spr.runs.map(([rx, ry, rw, rh]) => [Math.round(rx * z), Math.round(ry * z), Math.max(1, Math.round(rw * z)), Math.max(1, Math.round(rh * z))]);
  return (c[z] = Object.assign({}, spr, { w, h, cv, fl, runs, _zc: null, mx: (spr.mx || 0) * z, my: (spr.my || 0) * z }, spr.foot ? { foot: [Math.round(spr.foot[0] * z), Math.round(spr.foot[1] * z)] } : null));
}
/** GPU surface class for a vertical face normal: 5 +x, 6 -x, 7 +y, 8 -y */
const faceClass = (nx, ny) => nx > 0 ? 5 : nx < 0 ? 6 : ny > 0 ? 7 : 8;

/* =============================================================================
 * 3. VIEWS (projections)
 *    A view is an orthographic camera: yaw spins around the up axis, pitch tilts
 *    from horizontal (0 = side view) to straight down (90). scale = pixels per world
 *    unit. zBoost exaggerates height (a classic pixel-art cheat for readability).
 *      screen x = ax*x + ay*y
 *      screen y = bx*x + by*y + bz*z
 * ============================================================================= */
class View {
  /** new E.View(id, label, yaw, pitch, scale, zBoost): an orthographic camera (degrees; scale = screen pixels per
   *  world unit; zBoost stretches heights). id: its name ('iso', or yours); label: its name for people ('Isometric') */
  constructor(id, label, yaw, pitch, scale = 1, zBoost = 1) { this.id = id; this.label = label; this.set(yaw, pitch, scale, zBoost); }
  /** change the angles and scale in place (game.setView and rotateView use their own copies); returns the view */
  set(yaw, pitch, scale = 1, zBoost = 1) {
    /** yawDeg: the turn about the up axis, degrees (0: north is up the screen; iso is 45); pitchDeg: the tilt, 0
     *  side view to 90 straight down; scale: screen pixels per world unit; zBoost: how much heights are stretched on
     *  screen (1 = true) */
    this.yawDeg = yaw; this.pitchDeg = pitch; this.scale = scale; this.zBoost = zBoost;
    const w = yaw * DEG, p = pitch * DEG, cw = Math.cos(w), sw = Math.sin(w), cp = Math.cos(p), sp = Math.sin(p);
    /** yaw, pitch: the same angles in radians */
    this.yaw = w; this.pitch = p;
    /** ax, ay: screen x = ax * x + ay * y (the projection's first row) */
    this.ax = scale * cw; this.ay = -scale * sw;
    /** bx, by, bz: screen y = bx * x + by * y + bz * z (the second row; bz < 0 lifts things up the screen) */
    this.bx = scale * sp * sw; this.by = scale * sp * cw; this.bz = -scale * cp * zBoost;
    /** dx, dy, dz: the direction toward the camera, for true depth (view.depth); bigger is nearer */
    this.dx = sw * cp; this.dy = cw * cp; this.dz = sp;   // true camera depth (bigger = nearer)
    /** fx, fy: the ground direction that points at the camera (the front of a wall faces it) */
    this.fx = sw; this.fy = cw;                           // ground direction that points at the camera
    /** isTop: looking straight down (pitch 89 or more); isSide: a side view (pitch 1 or less: x right, z up, y is
     *  depth) */
    this.isTop = pitch >= 89; this.isSide = pitch <= 1;
    const det = this.ax * this.by - this.ay * this.bx;
    /** inv: the inverse of the ground projection (screen -> ground at z 0), null in side views */
    this.inv = Math.abs(det) > 1e-6 && pitch > 5 ? [this.by / det, -this.ay / det, -this.bx / det, this.ax / det] : null;
    return this;
  }
  /** world -> projected screen pixels (not yet camera-relative) */
  p(x, y, z = 0) { return [this.ax * x + this.ay * y, this.bx * x + this.by * y + this.bz * z]; }
  /** true camera depth: use it to sort parts inside one object */
  depth(x, y, z = 0) { return this.dx * x + this.dy * y + this.dz * z; }
  /** painter's order for whole objects standing on the ground */
  order(x, y, z = 0) { return this.isTop ? z + (this.bx * x + this.by * y) * 1e-3 : this.fx * x + this.fy * y + z * 1e-3; }
  /** projected screen point -> ground point (z = 0). null in side view */
  toGround(sx, sy) { const i = this.inv; return i ? [i[0] * sx + i[1] * sy, i[2] * sx + i[3] * sy] : null; }
  /** a direction the player pushed on screen (x right, y down) -> normalized ground direction */
  screenDirToGround(dx, dy) {
    if (!dx && !dy) return [0, 0];
    let g = this.inv ? [this.inv[0] * dx + this.inv[1] * dy, this.inv[2] * dx + this.inv[3] * dy] : [dx, dy];
    const l = Math.hypot(g[0], g[1]) || 1, m = Math.min(1, Math.hypot(dx, dy));
    return [g[0] / l * m, g[1] / l * m];
  }
}
E.View = View;
/** the ready-made views: iso (yaw 45, pitch 30), threequarter (pitch 55), topdown (80), brawler (25), side (0) and
 *  overhead (90, scale 1: world x/y = screen pixels); new E.Game({ view: 'iso' }) and game.setView('side') take
 *  their names */
E.VIEWS = {
  iso: new View('iso', 'Isometric', 45, 30, Math.SQRT2, 1),                 // Diablo, Bastion (2:1 pixel iso)
  threequarter: new View('threequarter', 'Three-quarter', 0, 55, 1.5, 1.35), // Zelda, Stardew, Enter the Gungeon
  topdown: new View('topdown', 'Top-down', 0, 80, 1.5, 1.3),                 // Hotline Miami, GTA 1
  brawler: new View('brawler', 'Brawler', 0, 25, 1.5, 1),                    // Streets of Rage, Castle Crashers
  side: new View('side', 'Side', 0, 0, 1.5, 1),                              // Mega Man, platformers
  overhead: new View('overhead', 'Overhead', 0, 90, 1, 1)                    // 1942, puzzles: world x/y = screen pixels
};
/** the order game.nextView() cycles through when a game doesn't set game.views ('overhead' is left out) */
E.VIEW_ORDER = ['iso', 'threequarter', 'topdown', 'brawler', 'side'];   // 'overhead' is left out: it is for flat games
/**
 * The classic SNES RPG cheat: in steep ground views (pitch 40-70, like threequarter) characters are drawn from a lower,
 * sprite-like angle so their faces show, at the same height on screen. Humanoid and Blob do this by themselves
 * (option charView: false turns it off for one rig, E.style.charPitch = false for all). E.charView(view) gives that view.
 */
/** the view a rig in `view` is drawn from (the sprite-like angle above; the view itself outside pitch 40-89) */
function charView(view) {
  const P = E.style.charPitch;
  if (P === false || view.pitchDeg < 40 || view.pitchDeg >= 89) return view;
  const cp = P || 30, key = view.yawDeg + ':' + view.pitchDeg + ':' + view.scale + ':' + view.zBoost + ':' + cp;
  let v = _cviews.get(key);
  // height on screen: kept as the view has it up to 70 degrees; steeper (top-down) views draw upright sprites as tall as three-quarter ones
  const h = view.pitchDeg <= 70 ? view.zBoost * Math.cos(view.pitchDeg * DEG) : .78;
  if (!v) { v = new View(view.id, view.label, view.yawDeg, cp, view.scale, h / Math.cos(cp * DEG)); _cviews.set(key, v); }
  return v;
}
const _cviews = new Map();
E.charView = charView;

/* =============================================================================
 * 4. SCREEN  low-res buffer, whole-number upscale, sub-pixel camera on present
 * ============================================================================= */
/** classic console resolutions for new Game({ res: 'snes' }) (width x height in pixels) */
E.RES = { nes: [256, 240], snes: [256, 224], gb: [160, 144], gbc: [160, 144], gba: [240, 160], genesis: [320, 224], md: [320, 224], pce: [256, 224], n64: [320, 240], ps1: [320, 240], wide: [400, 225] };
class Screen {
  /** the game's low-resolution screen (game.screen: the game makes it): its buffer, scale and letterbox. canvas null: a
   *  headless game's, sized as a 1280 x 720 window would size it, with nothing to draw on */
  constructor(canvas, o, signal) {
    /** canvas: the page's canvas (null in a headless game); o: the sizing options (the game's o) */
    this.canvas = canvas; this._sctx = canvas ? canvas.getContext('2d') : null; this._o = o;
    /** buf: the low-resolution buffer the game draws into (W + 2 by H + 2 pixels; null when headless); ctx: its 2D
     *  context (r.ctx is the same) */
    this.buf = canvas ? mkCanvas(8, 8) : null; this.ctx = canvas ? ctx2d(this.buf) : null;
    /** W, H: the buffer's size in game pixels; S: the whole-number scale up to the canvas; OX, OY: the letterbox
     *  margins on the canvas, in canvas pixels; dpr: the device pixel ratio used (at most 3) */
    this.W = 320; this.H = 200; this.S = 3; this.OX = 0; this.OY = 0; this.dpr = 1;
    /** ix, iy: the camera's whole-pixel offset this frame; fx, fy: its sub-pixel part (0..1, applied when
     *  presenting); listeners: functions called after every resize */
    this.ix = 0; this.iy = 0; this.fx = 0; this.fy = 0; this.listeners = [];
    /** scale: how a fixed resolution fills the screen: 'sharp' (whole-number scale, every pixel the same size, black
     *  bars unless o.expand grows the picture into them), 'fill' (the largest fit, pixels a device pixel apart in size)
     *  or 'auto' (fill on high-density screens, phones and tablets, where that difference can't be seen; sharp
     *  elsewhere). game.settings.scale sets it */
    this.scale = 'auto';
    this.resize();
    if (canvas) addEventListener('resize', () => this.resize(), { signal });
  }
  /**
   * the sizing options in force: the game's, with o.portrait's over them while the screen is taller than wide (a phone
   * held upright). new Game({ maxH: 330, portrait: { maxH: 1000 } }) lets the picture grow to fill a 9:16 screen
   */
  _options(pw, ph) { const o = this._o; return o.portrait && ph > pw ? Object.assign({}, o, o.portrait) : o; }
  /** fixed internal size from o.res ('snes', [256, 224], ...) or null for the adaptive size */
  _fixedRes(o = this._o) {
    const r = o.res; if (!r) return null;
    const v = Array.isArray(r) ? r : E.RES[String(r).toLowerCase()];
    if (!v) { warn('res:' + r, 'unknown res "' + r + '". Use one of ' + Object.keys(E.RES).join(', ') + ' or [width, height]'); return null; }
    return [Math.max(16, v[0] | 0), Math.max(16, v[1] | 0)];
  }
  /** fit the buffer to the canvas again (on window resize; after changing sizing options, setOptions does it) */
  resize() {
    const c = this.canvas, dpr = c ? Math.min(window.devicePixelRatio || 1, 3) : 1, rc = c ? c.getBoundingClientRect() : { width: 1280, height: 720 };
    const pw = Math.max(1, Math.round(rc.width * dpr)), ph = Math.max(1, Math.round(rc.height * dpr)), o = this._options(pw, ph);
    /** portrait: true while the screen is taller than wide (a phone held upright) */
    if (c) { c.width = pw; c.height = ph; } this.dpr = dpr; this.portrait = ph > pw;
    const fix = this._fixedRes(o);
    if (fix) {
      // fixed resolution: whole-number scale, letterboxed (or the largest fit: scale). HUD pixel positions stay the same on every screen.
      // o.expand: the resolution is the least the screen shows, and the picture grows on both sides to fill the window
      // (no bars at any shape, up to expand.maxW x maxH): a HUD anchors to W and H
      const fit = Math.min(pw / fix[0], ph / fix[1]), fill = this.scale === 'fill' || (this.scale === 'auto' && dpr >= 2 && fit >= 2), x = o.expand;
      this.S = fill ? Math.max(1, fit) : Math.max(1, Math.min(Math.floor(pw / fix[0]), Math.floor(ph / fix[1])));
      this.W = x ? clamp(Math.ceil(pw / this.S - 1e-6), fix[0], Math.max(fix[0], x.maxW || 1e4)) : fix[0]; this.H = x ? clamp(Math.ceil(ph / this.S - 1e-6), fix[1], Math.max(fix[1], x.maxH || 1e4)) : fix[1];   // (a cap never cuts below res)
    } else {
      const S = Math.max(1, Math.min(Math.floor(ph / o.minH), Math.floor(pw / o.minW)));
      this.S = S; this.W = Math.min(o.maxW, Math.ceil(pw / S)); this.H = Math.min(o.maxH, Math.ceil(ph / S));
    }
    this.OX = Math.floor((pw - this.W * this.S) / 2); this.OY = Math.floor((ph - this.H * this.S) / 2);
    if (this.buf) { this.buf.width = this.W + 2; this.buf.height = this.H + 2; this.ctx = ctx2d(this.buf); this.ctx._c = null; }
    for (const f of this.listeners) f();
  }
  /** change sizing at runtime, e.g. { minH: 400, maxW: 1080, maxH: 660 } to pull the camera back */
  setOptions(o) { Object.assign(this._o, o); this.resize(); }
  /** how a fixed resolution fills the screen: 'sharp' | 'fill' | 'auto' (see scale) */
  setScale(v) { this.scale = v === 'sharp' || v === 'fill' ? v : 'auto'; this.resize(); }
  /** clear: true when the game's bg is null (or 'transparent'): the buffer and the canvas are cleared instead of filled,
   *  so a picture under the canvas shows through the game's (a 3D world drawn by engine/my-3d2dge-3d.js) */
  get clear() { return this._o.bg == null || this._o.bg === 'transparent'; }
  /** start a frame: clear the buffer to bg with the camera at (cx, cy) projected pixels (the renderer calls it) */
  _begin(cx, cy, bg) {
    this.ix = Math.floor(cx); this.iy = Math.floor(cy); this.fx = cx - this.ix; this.fy = cy - this.iy;
    const g = this.ctx; g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g._c = null;
    if (bg == null || bg === 'transparent') g.clearRect(0, 0, this.buf.width, this.buf.height);
    else { g.fillStyle = bg; g.fillRect(0, 0, this.buf.width, this.buf.height); }
  }
  /** copy the buffer to the canvas, scaled up with whole pixels and the camera's sub-pixel offset (the renderer
   *  calls it) */
  _present() {
    const s = this._sctx, S = this.S; if (!s) return;
    s.imageSmoothingEnabled = false;
    if (this.clear) s.clearRect(0, 0, this.canvas.width, this.canvas.height);
    else { s.fillStyle = '#000'; s.fillRect(0, 0, this.canvas.width, this.canvas.height); }
    s.save(); s.beginPath(); s.rect(this.OX, this.OY, this.W * S, this.H * S); s.clip();
    s.drawImage(this.buf, 0, 0, this.W + 1, this.H + 1, this.OX - Math.round(this.fx * S), this.OY - Math.round(this.fy * S), (this.W + 1) * S, (this.H + 1) * S);
    s.restore();
  }
  /** browser client coords -> projected screen pixels (same space as view.p) */
  clientToScreen(cx, cy) {
    if (!this.canvas) return null;
    const rc = this.canvas.getBoundingClientRect(), dx = (cx - rc.left) * this.dpr, dy = (cy - rc.top) * this.dpr;
    return [(dx - this.OX + Math.round(this.fx * this.S)) / this.S + this.ix, (dy - this.OY + Math.round(this.fy * this.S)) / this.S + this.iy];
  }
}

/* =============================================================================
 * 5. INPUT  keyboard, mouse, gamepad, touch stick, on-screen buttons
 *    Actions are names you choose. Codes: KeyboardEvent.code, 'Mouse0'/'Mouse2',
 *    'Pad0'..'Pad15' (standard gamepad buttons). Every action also accepts
 *    'Act:<name>' so DOM buttons with data-act="<name>" work automatically.
 * ============================================================================= */
class Input {
  /** signal: an AbortSignal that removes every listener this adds (game.dispose()). A screen without a canvas (headless)
   *  gets no DOM listeners: input comes from press(code), release(code), tap(action) and hold(action, on) */
  constructor(screen, map, signal) {
    this.screen = screen; this._signal = signal;   // screen: the game's screen (mouse positions are read through it)
    this.use(map);
    /** held: the key and button codes down right now ('KeyD', 'Mouse0', 'Pad0', 'Act:jump'); clock: seconds of input
     *  time (the steps' dt added up) */
    this.held = new Set(); this.clock = 0; this._pt = {}; this._used = {};
    this._fresh = new Set(); this._now = new Set(); this._freshUp = new Set(); this._nowUp = new Set(); this._rk = {};
    this._suppressed = new Set();
    /** mouse: { cx, cy } its page position, active once it has moved over the canvas, t the input clock when it last
     *  moved */
    this.mouse = { cx: 0, cy: 0, active: false, t: -99 };
    /** clickAt: where a click or tap on the canvas landed, in screen pixels [x, y], for the one step after it (clicked()) */
    this._clickAt = null; this._click = null; this._down = null;
    /** stick: the touch stick's direction [x, y], length <= 1; stickOn: a finger is on it; padMove: the gamepad's
     *  left stick after the dead zone; padAim: its right stick, or null when centered; padPrev: which gamepad buttons
     *  were down at the last step; aimSource: what aims right now: 'move' | 'mouse' | 'pad' */
    this.stick = [0, 0]; this.stickOn = false; this.padMove = [0, 0]; this.padAim = null; this.padPrev = []; this.aimSource = 'move';
    /** deadzone: how far a gamepad stick moves before it counts (0..0.8); padIndex, padId: the gamepad in use (null
     *  and '' without one); lastDevice: 'keyboard' | 'mouse' | 'gamepad' | 'touch', the last one used (show the
     *  right button prompts) */
    this.deadzone = .18; this.padIndex = null; this.padId = ''; this.lastDevice = 'keyboard';
    /** touchEnabled: false turns the touch stick off; stickSide: 'left' or 'right', the half of the screen the stick
     *  lives on; stickRadius: how far (CSS pixels) a finger drags for full tilt; stickDeadzone: the part of that radius a
     *  thumb moves before the stick counts (0..0.5); steer: 'stick' (a stick drawn under the thumb) or 'drag' (a finger
     *  anywhere on the screen but the buttons steers by drag(), with no stick drawn: a shooter's ship that follows the
     *  thumb); padAxes: the gamepad's raw axes */
    this.touchEnabled = true; this.stickSide = 'left'; this.steer = 'stick'; this.stickRadius = 44; this.stickDeadzone = .12; this.padAxes = []; this.padValues = []; this.padMapping = ''; this._taps = new Set(); this._tapsDue = new Set();
    /** pinching: two fingers on the canvas are pinching the camera's zoom (they moved apart or together: not the stick,
     *  not a tap). The game lets the player zoom only where its scene does (camera.zoom): then the wheel, - and = (keys no
     *  action uses) and a pinch ask for it, read by zoom() */
    this._pinching = false; this._zoomAcc = 1; this._zoomNow = 1; this._zoomOn = false; this._wheelOn = false; this._fingers = new Map();
    /** glyphs: the gamepad's button symbols for label(): 'auto' (from the controller's name) | 'xbox' | 'playstation' |
     *  'nintendo' | 'generic' (positions); rumbleScale: vibration strength 0..1 (0 = off; game.settings.rumble sets it);
     *  padLost: true for the step after the gamepad in use was unplugged (a pausable scene pauses) */
    this.glyphs = 'auto'; this.rumbleScale = .6; this.padLost = false;
    /** names: the actions' names on the Controls screen ({ attack: 'Sword' }; false hides one from rebinding: the
     *  game's menu.controls); onBindings(b): called with the player's new bindings (the game saves and applies them) */
    this.names = null; this._onBindings = null;
    const el = screen.canvas;
    if (!el) return;
    // the keyboard's own letters for labels (an AZERTY Z where the code says KeyW), where the browser tells them
    try { if (navigator.keyboard && navigator.keyboard.getLayoutMap) navigator.keyboard.getLayoutMap().then(m => { this._layout = m; }).catch(() => {}); } catch (e) { /* no layout map */ }
    if (screen.listeners) screen.listeners.push(() => { if (this.stickOn) this._stickEnd({ pointerId: this.stickId }); });   // a resize or a turn of the phone moves the stick's origin: lift it (a screen of a page's own may have no listeners)
    const on = (t, type, fn) => t.addEventListener(type, fn, { signal });
    const typing = e => {
      const t = e.target; if (!t || !t.tagName) return false;
      if (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) return true;
      return t.tagName === 'INPUT' && !['range', 'checkbox', 'radio', 'button', 'submit', 'color'].includes(t.type);
    };
    on(window, 'keydown', e => {
      if (typing(e)) return;
      if (this._codes[e.code]) { e.preventDefault(); if (!e.repeat) this.press(e.code); }
      else if (this._zoomOn && ZOOM_KEYS[e.code] && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); if (!e.repeat) this._zoomAcc *= ZOOM_KEYS[e.code]; }   // - and =, where no action uses them
    });
    // the wheel zooms where the game lets it (a mouse's notch 10%; a trackpad's pinch comes as the wheel with ctrlKey);
    // not over a menu, which scrolls
    el.addEventListener('wheel', e => {
      if (!this._wheelOn) return; e.preventDefault();
      const d = e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 100 : 1);
      this._zoomAcc *= clamp(Math.exp(-d * (e.ctrlKey ? .01 : .001)), .8, 1.25);
    }, { signal, passive: false });
    on(window, 'keyup', e => this.release(e.code));
    on(window, 'blur', () => this.clear());
    on(document, 'visibilitychange', () => { if (document.hidden) this.clear(); });
    on(el, 'contextmenu', e => e.preventDefault());
    on(el, 'pointermove', e => { if (e.pointerType === 'mouse') { this.mouse.cx = e.clientX; this.mouse.cy = e.clientY; this.mouse.active = true; this.mouse.t = this.clock; this.aimSource = 'mouse'; } else { this._pinchMove(e); this._stickMove(e); } });
    on(el, 'pointerdown', e => {
      if (e.pointerType !== 'mouse') this.lastDevice = 'touch';   // any touch, on the stick's half or not: prompts follow it
      if (e.pointerType !== 'mouse' || e.button === 0) this._down = { id: e.pointerId, x: e.clientX, y: e.clientY };   // a click or tap once it lifts near here (pointerup)
      if (e.pointerType === 'mouse') { this.mouse.cx = e.clientX; this.mouse.cy = e.clientY; this.mouse.active = true; this.aimSource = 'mouse'; this.press('Mouse' + e.button); }
      else {
        if (e.pointerType === 'touch' && !this._touched) { this._touched = true; if (this._touchArgs && !this._touchEl) this._touchSync(); }
        this._fingers.set(e.pointerId, { x: e.clientX, y: e.clientY }); this._pinchArm();
        if (!this.touchFilter || this.touchFilter(e)) this._stickStart(e);
      }
    });
    on(window, 'pointerup', e => {
      const d = this._down; this._down = null;   // a click or tap: lifted within a few pixels of where it landed (a drag, the stick's, is none): clicked() for a step,
      // in screen pixels now: where it touched what was drawn, before a phone's first tap goes full screen and moves the canvas
      if (d && d.id === e.pointerId && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 12) this._click = this.screenPoint(e.clientX, e.clientY);
      if (e.pointerType === 'mouse') this.release('Mouse' + e.button); else { this._fingerUp(e); this._stickEnd(e); }
    });
    on(window, 'pointercancel', e => { this._down = null; this._fingerUp(e); this._stickEnd(e); });
    on(el, 'lostpointercapture', e => this._stickEnd(e));
  }
  /** switch key layout at runtime: input.use(E.Input.PLATFORMER) or input.use('SHMUP'). The player's own bindings
   *  (bindings, set by rebind() and the Controls screen) are laid over it. Every preset (E.Input.DEFAULT, PLATFORMER,
   *  THIRDPERSON, SHMUP) has the moves (up, down, left, right) and the menu's actions (start, pause, confirm, cancel) */
  use(map) {
    if (this.held) this.clear();
    if (typeof map === 'string') map = Input[map.toUpperCase()] || Input.DEFAULT;
    const B = this.bindings || {};
    /** map: each action's codes ({ jump: ['Space', 'Pad0', 'Act:jump'] }); every action also answers to 'Act:<name>'
     *  (DOM buttons with data-act, tap, hold) */
    this.map = {};
    for (const a in map) {
      let codes = map[a].slice(); const b = B[a];
      if (b && this.rebindable(a, map)) for (const k of ['keys', 'pad']) if (Array.isArray(b[k])) codes = codes.filter(c => padCode(c) !== (k === 'pad') || FIXED_CODES.has(c)).concat(b[k]);
      if (a === 'start' || a === 'pause') codes.push('Act:menu');   // (the touch START)
      if (STICK_CODES[a]) codes.push(STICK_CODES[a]);   // (the gamepad's left stick; the touch stick presses 'Act:' + a)
      this.map[a] = [...new Set(codes), 'Act:' + a];
    }
    this._codes = {}; for (const a in this.map) for (const c of this.map[a]) (this._codes[c] = this._codes[c] || []).push(a);
    /** preset: the layout last given to use() (E.Input.DEFAULT, PLATFORMER, SHMUP or your own) */
    this.preset = map;
    return this;
  }
  /** can the player rebind action a? Every action but the menu's (start, pause, confirm, cancel: they are how a player
   *  gets back to the menu), and those the game hides with new E.Game({ menu: { controls: { a: false } } }) */
  rebindable(a, map = this.preset) { return !!map && a in map && !(a in MENU_KEYS) && !(this.names && this.names[a] === false); }
  /** the player's bindings over the preset: { action: { keys: [codes], pad: [codes] } } (game.settings.bindings keeps them) */
  get bindings() { return this._bindings || {}; }
  set bindings(b) { this._bindings = b && typeof b === 'object' ? b : {}; if (this.preset) this.use(this.preset); }
  /**
   * bind action a to one code for a device ('keys' = keyboard and mouse, 'pad' = gamepad), in place of that device's
   * codes: input.rebind('attack', 'keys', 'KeyF'). Returns null when done, the action that already uses the code (nothing
   * changes: free it first), or 'reserved' for the codes the menus keep (Escape, Enter, F keys, Start, the d-pad). The
   * arrow keys and the d-pad always move as well
   */
  rebind(a, device, code) {
    if (!this.rebindable(a) || (device !== 'keys' && device !== 'pad') || !BINDABLE.test(code) || padCode(code) !== (device === 'pad')) return 'reserved';
    const other = Object.keys(this.map).find(b => b !== a && !(b in MENU_KEYS) && this.map[b].includes(code));
    if (other) return other;
    this._setBindings(Object.assign({}, this.bindings, { [a]: Object.assign({}, this.bindings[a], { [device]: [code] }) }));
    return null;
  }
  /** take away action a's codes for one device ('keys' or 'pad'); the arrow keys and d-pad stay on the moves */
  unbind(a, device) { if (this.rebindable(a)) this._setBindings(Object.assign({}, this.bindings, { [a]: Object.assign({}, this.bindings[a], { [device]: [] }) })); }
  /** forget the player's bindings: every action back to its preset's codes */
  resetBindings() { this._setBindings({}); }
  _setBindings(b) { if (this._onBindings) this._onBindings(b); else this.bindings = b; }   // (the game saves them in its settings)
  /** a code as a person reads it: 'W' (or the keyboard's own letter there), 'Space', '↑', 'Left click', and a gamepad
   *  button by its symbol on the controller in use ('A', '✕', 'B'...; glyphs picks the family) */
  codeLabel(code) {
    if (!code) return '';
    const L = this._layout && this._layout.get && this._layout.get(code);
    if (/^Key[A-Z]$/.test(code)) return (L || code.slice(3)).toUpperCase();
    if (/^Digit\d$/.test(code)) return L || code.slice(5);
    if (/^Pad\d+$/.test(code)) return (PAD_GLYPHS[this.padStyle()] || PAD_GLYPHS.xbox)[+code.slice(3)] || code;
    return CODE_LABELS[code] || (code.startsWith('Numpad') ? 'Num ' + code.slice(6) : code.startsWith('Act:') ? code.slice(4).toUpperCase() : code);
  }
  /** the controller family whose symbols label() shows: glyphs, or with glyphs 'auto' the one its name says */
  padStyle() {
    if (this.glyphs && this.glyphs !== 'auto') return this.glyphs;
    const id = this.padId || '';
    return /054c|playstation|dualsense|dualshock|wireless controller/i.test(id) ? 'playstation' : /057e|nintendo|pro controller|joy-con/i.test(id) ? 'nintendo' : 'xbox';
  }
  /** the key or button to show in a prompt for action a, on the device the player used last (or the one named:
   *  'keyboard' | 'mouse' | 'gamepad' | 'touch'), with their bindings: input.label('jump') -> 'Space', 'A' or '✕' */
  label(a, device = this.lastDevice) {
    const m = this.map[a]; if (!m) { this._check(a); return ''; }
    if (device === 'touch') return (this._touchLabels && this._touchLabels[a]) || a.toUpperCase();
    const real = m.filter(c => !c.startsWith('Act:') && !c.startsWith('PadAxis')), pads = real.filter(padCode), keys = real.filter(c => !padCode(c));
    const c = device === 'gamepad' ? pads[0] || keys[0] : device === 'mouse' ? keys.find(c => c.startsWith('Mouse')) || keys[0] || pads[0] : keys.find(c => !c.startsWith('Mouse')) || keys[0] || pads[0];
    return c ? this.codeLabel(c) : '';
  }
  /** shake the gamepad: strength 0..1 for seconds (scaled by rumbleScale; nothing where the controller can't). Returns
   *  true when it rumbled */
  rumble(strength = .5, seconds = .15) {
    const k = clamp(strength, 0, 1) * clamp(this.rumbleScale, 0, 1); if (!(k > 0) || this.padIndex === null || !this.screen.canvas) return false;
    let a = null; try { const p = navigator.getGamepads()[this.padIndex]; a = p && p.vibrationActuator; } catch (e) { /* gamepads blocked */ }
    if (!a || !a.playEffect) return false;
    try { const r = a.playEffect('dual-rumble', { duration: Math.round(seconds * 1000), strongMagnitude: k, weakMagnitude: Math.min(1, k * 1.25) }); if (r && r.catch) r.catch(() => {}); } catch (e) { return false; }
    this._rumbling = a; return true;
  }
  /** stop a rumble now (pause, focus lost, unplugged) */
  stopRumble() { const a = this._rumbling; this._rumbling = null; try { if (a && a.reset) { const r = a.reset(); if (r && r.catch) r.catch(() => {}); } } catch (e) { /* gone */ } }
  /**
   * On-screen buttons for phones and tablets (shown on touch screens; the player's settings can show them always or hide
   * them, put them on the left, and size them): input.touchButtons(['jump', 'attack'], { labels: { jump: 'A', attack:
   * 'B' }, force }). The other half of the screen is a move stick (past halfway it presses up, down, left and right too,
   * as a d-pad does: menus and ladders). START is the corner's menu button, top right: it opens the menu, or pauses a
   * pausable scene into it (without the corner a START button there starts a title and pauses, as a gamepad's Start)
   */
  touchButtons(actions, o = {}) {
    if (!this.screen.canvas) return null;
    this._touchArgs = { actions, o }; this._touchLabels = o.labels || null; this._touchSet = {};
    return this._touchSync();
  }
  /** one touch button as the moment changes: its label (TALK beside someone, NEXT in a dialog; null: its own) and whether
   *  it shows (false: nothing for it to do here). Cheap to call every step: input.touchSet('confirm', near ? 'TALK' : null,
   *  near || talking) */
  touchSet(a, label = null, show = true) {
    const t = this._touchSet || (this._touchSet = {}); t[a] = { label, show: !!show };
    const b = this._touchBtns && this._touchBtns[a]; if (b && b.isConnected) this._touchLook(b, a);
  }
  _touchLook(b, a) {
    const t = this._touchSet && this._touchSet[a], o = this._touchArgs ? this._touchArgs.o : {}, text = (t && t.label) || (o.labels && o.labels[a]) || a.toUpperCase(), d = t && !t.show ? 'none' : '';
    if (b.textContent !== text) b.textContent = text;
    if (b.style.display !== d) { b.style.display = d; if (d) { b._inputPointers && b._inputPointers.clear(); b.classList.remove('on'); this.release('Act:' + a); } }   // (hidden under a finger: let go)
  }
  /** where the touch buttons cover the screen, in screen pixels { x0, y0, x1, y1 } (the same space as r.W and r.H), or
   *  null while none show: keep a prompt or a box clear of it (a bottom E.Dialog does by itself) */
  touchArea() {
    const el = this._touchEl, S = this.screen; if (!el || !S.canvas || !el.isConnected) return null;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const b of el.querySelectorAll('button')) { const q = b.getBoundingClientRect(); if (!q.width) continue; x0 = Math.min(x0, q.left); y0 = Math.min(y0, q.top); x1 = Math.max(x1, q.right); y1 = Math.max(y1, q.bottom); }
    if (x1 < x0) return null;
    const a = this.screenPoint(x0, y0), b = this.screenPoint(x1, y1);
    return { x0: a[0], y0: a[1], x1: b[0], y1: b[1] };
  }
  /** build the touch buttons again from the player's settings (touch, hand, touchSize, touchOpacity) */
  _touchSync() {
    if (!this._touchArgs || !this.screen.canvas) return null;
    const { actions, o } = this._touchArgs, S = this._settings || {}, mode = S.touch || 'auto', left = S.hand === 'left', size = clamp(+S.touchSize || 62, 40, 96);
    const coarse = this._touched || (window.matchMedia && matchMedia('(pointer: coarse)').matches);   // (a laptop with a touch screen: once touched)
    for (const el of [this._touchEl, this._startEl]) if (el) { for (const b of el.querySelectorAll('[data-act]')) this.release('Act:' + b.dataset.act); el.remove(); }
    this._touchEl = this._startEl = null;
    const show = mode === 'on' || (mode === 'auto' && (coarse || !!o.force));
    this.touchEnabled = mode !== 'off'; this.stickSide = left ? 'right' : 'left';
    if (!show) { if (this.stickOn) this._stickEnd({ pointerId: this.stickId }); return null; }
    const host = this.screen.canvas.parentElement || document.body, box = document.createElement('div'), side = left ? 'left' : 'right';
    box.dataset.sys = 'touch';
    box.style.cssText = 'position:absolute;' + side + ':calc(14px + env(safe-area-inset-' + side + ',0px));bottom:calc(14px + env(safe-area-inset-bottom,0px));display:flex;gap:10px;z-index:4;touch-action:none;opacity:' + clamp(+S.touchOpacity || .8, .2, 1) + (left ? ';flex-direction:row-reverse' : '');
    this._touchBtns = {};
    for (const a of actions) {
      const b = this._touchBtns[a] = document.createElement('button'); b.dataset.act = a; b.setAttribute('aria-label', a);
      b.style.cssText = 'width:' + size + 'px;height:' + size + 'px;border-radius:50%;border:2px solid rgba(255,255,255,.45);background:rgba(20,16,40,.55);color:#fff;font:600 ' + Math.round(size / 5) + 'px system-ui,sans-serif;touch-action:none;user-select:none;-webkit-user-select:none;overflow:hidden;padding:0';
      this._touchLook(b, a); box.appendChild(b);
    }
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.appendChild(box); this.bindButtons(box); this._touchEl = box;
    if (!this._cornerMenu) {   // START: the corner's menu button is it; without the corner, a button of its own in the same place
      const st = this._startEl = document.createElement('div'), b = document.createElement('button'); st.dataset.sys = 'touch';
      st.style.cssText = 'position:fixed;top:calc(8px + env(safe-area-inset-top,0px));right:calc(8px + env(safe-area-inset-right,0px));z-index:4;touch-action:none;opacity:' + clamp(+S.touchOpacity || .8, .2, 1);
      b.dataset.act = 'menu'; b.textContent = 'START'; b.setAttribute('aria-label', 'Start or menu');
      b.style.cssText = 'min-width:44px;height:44px;padding:0 10px;border-radius:10px;border:1px solid rgba(255,255,255,.4);background:rgba(20,16,40,.55);color:#fff;font:600 11px system-ui,sans-serif;touch-action:none';
      st.appendChild(b); document.body.appendChild(st); this.bindButtons(st);
    }
    return box;
  }
  /** press a key or button code ('KeyJ', 'Mouse0', 'Pad0', 'Act:attack') as if the person did: scripted input,
   *  tests, bots */
  press(code) {
    if (this.held.has(code)) return; this.held.add(code);
    if (code.startsWith('Pad')) { this.lastDevice = 'gamepad'; this.aimSource = 'pad'; }
    else if (code.startsWith('Act:')) this.lastDevice = 'touch';
    else this.lastDevice = code.startsWith('Mouse') ? 'mouse' : 'keyboard';
    for (const a of this._codes[code] || []) { this._pt[a] = this.clock; this._used[a] = false; this._rk[a] = -1; this._fresh.add(a); }
  }
  /** let go of a code pressed with press() */
  release(code) {
    if (!this.held.delete(code)) return;
    for (const a of this._codes[code] || []) if (!this.down(a)) this._freshUp.add(a);
  }
  /** press an action for one update step, as a quick tap of its key (scripted input, tests, an AI): pressed() and down()
   *  are true in the next step, released() in the one after */
  tap(a) { if (!this.map[a]) { this._check(a); return; } this._tapCode('Act:' + a); }
  _tapCode(c) { this.press(c); this._taps.add(c); }
  /** hold an action down (on) or let it go (false), as its key would */
  hold(a, on = true) { if (!this.map[a]) { this._check(a); return; } if (on) this.press('Act:' + a); else this.release('Act:' + a); }
  _check(a) { if (!this.map[a]) warn('action:' + a, 'unknown input action "' + a + '". Known actions: ' + Object.keys(this.map).join(', ') + '. Add your own with new E.Game({ input: { ...E.Input.DEFAULT, ' + a + ": ['KeyQ'] } })"); }
  /** is the action held right now? */
  down(a) { const m = this.map[a]; if (!m) { this._check(a); return false; } if (this._suppressed.has(a)) return false; for (const c of m) if (this.held.has(c)) return true; return false; }
  /** true only during the first update step after the press (menus, jumps, one-shot actions) */
  pressed(a) { if (!this.map[a]) this._check(a); return !this._suppressed.has(a) && this._now.has(a); }
  /** true only during the first update step after the action was let go */
  released(a) { return this._nowUp.has(a); }
  /** pressed, then repeats while held (after `delay` s, every `rate` s): menu cursors, puzzle pieces */
  repeat(a, delay = .3, rate = .08) {
    if (this.pressed(a)) return true;
    if (!this.down(a) || this._pt[a] === undefined) return false;
    const t = this.clock - this._pt[a]; if (t < delay) return false;
    const k = Math.floor((t - delay) / rate); if (k !== this._rk[a]) { this._rk[a] = k; return true; }
    return false;
  }
  /** was it pressed within the last `win` seconds and not yet consumed? (input buffering) */
  buffered(a, win = .15) { if (!this.map[a]) this._check(a); const t = this._pt[a]; return !this._suppressed.has(a) && t !== undefined && !this._used[a] && this.clock - t <= win; }
  /** mark a buffered press of action a as used, so buffered(a) is false until the next press */
  consume(a) { this._used[a] = true; }
  /** Suppress a held action until the next tick (a HUD widget owns the pointer this step). */
  suppress(a) { this.consume(a); this._suppressed.add(a); }
  /** A widget owns this button; other devices bound to the same action still work. */
  suppressCode(code) {
    for (const a of this._codes[code] || []) if (!this.map[a].some(c => c !== code && this.held.has(c))) this.suppress(a);
  }
  /** forget every pending press (after closing a menu or dialog, so the same press does not also attack) */
  consumeAll() { for (const a in this.map) this._used[a] = true; this._now.clear(); this._fresh.clear(); this._clickAt = this._click = null; }
  /** Release all devices and discard buffered input on focus loss or a modal transition. */
  clear() {
    this.held.clear(); this.consumeAll(); this._nowUp.clear(); this._freshUp.clear(); this._pt = {}; this._rk = {}; this._down = null;
    this.padMove = [0, 0]; this.padAim = null; this.padValues = []; this._fingers.clear(); this._pinching = false; this._zoomAcc = 1;
    this._stickEnd({ pointerId: this.stickId });
    for (const b of this._boundButtons || []) { b.classList.remove('on'); b._inputPointers.clear(); }
  }
  /** any action pressed this step (title screens: "press any button") */
  anyPressed() { return this._now.size > 0; }
  /** movement intent in screen directions: x right, y down, length <= 1 */
  move() {
    let x = (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0), y = (this.down('down') ? 1 : 0) - (this.down('up') ? 1 : 0);
    if (this.stickOn) { x = this.stick[0]; y = this.stick[1]; }
    if (Math.hypot(this.padMove[0], this.padMove[1]) > 0) { x = this.padMove[0]; y = this.padMove[1]; }
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    return [x, y];
  }
  /** mouse position in projected screen pixels, or null */
  mouseScreen() { return this.mouse.active ? this.screen.clientToScreen(this.mouse.cx, this.mouse.cy) : null; }
  /** where a click or tap on the canvas landed, in screen pixels [x, y] (the HUD's space: r.W, r.H), during the step
   *  after it lifted (a press that drags away, like the touch stick's, is none); else null. Menus and dialogs answer to
   *  it; a HUD button of your own can: if (hit(input.clicked())) ... */
  clicked() { return this._clickAt; }
  /** how far the touch stick's finger moved since the last step, in screen pixels [dx, dy] (the HUD's space), or null while
   *  no finger holds it: to steer one to one (a shooter's ship follows the thumb) instead of by the stick's direction */
  drag() { return this._drag || null; }
  /** the camera zoom the player asked for since the last step, as a factor (1.1: 10% closer, .9: farther; 1: none): the
   *  wheel, - and = and a pinch, where the scene lets them zoom. The game applies it (game.zoomBy) */
  zoom() { return this._zoomNow; }
  /** the mouse pointer in screen pixels [x, y] (the HUD's space), or null before it has moved over the canvas */
  pointer() { return this.mouse.active ? this.screenPoint(this.mouse.cx, this.mouse.cy) : null; }
  /** browser client coords -> screen pixels [x, y] (the HUD's space, with no camera), or null without a canvas */
  screenPoint(cx, cy) {
    const S = this.screen; if (!S.canvas) return null;
    const rc = S.canvas.getBoundingClientRect(); return [((cx - rc.left) * S.dpr - S.OX) / S.S, ((cy - rc.top) * S.dpr - S.OY) / S.S];
  }
  /** advance input by one step: read the gamepad and turn presses since the last step into this step's pressed() and
   *  released() (the engine calls it every step) */
  tick(dt) {
    this._suppressed.clear();
    this.clock += dt;
    let pads = [];
    try { pads = navigator.getGamepads ? navigator.getGamepads() : []; } catch (e) { /* gamepads blocked */ }
    const p = Array.from(pads || []).find(p => p && p.connected !== false && p.index === this.padIndex)
      || Array.from(pads || []).find(p => p && p.connected !== false);
    this.padLost = false;
    if (!p || p.index !== this.padIndex || p.id !== this.padId) {
      if (!p && this.padIndex !== null) { this.padLost = this.lastDevice === 'gamepad'; this.stopRumble(); }   // unplugged while in use
      this.padPrev.forEach((on, i) => { if (on) this.release('Pad' + i); });
      for (const c of ['PadAxisUp', 'PadAxisDown', 'PadAxisLeft', 'PadAxisRight']) this.release(c);
      this.padPrev = []; this.padMove = [0, 0]; this.padAim = null; this.padAxes = []; this.padValues = []; this.padMapping = '';
      this.padIndex = p ? p.index : null; this.padId = p ? p.id : '';
      if (this.aimSource === 'pad') this.aimSource = 'move';
    }
    if (p) {
      const dz = (x, y) => { const l = Math.hypot(x, y), d = clamp(this.deadzone, 0, .8); return l <= d ? [0, 0] : [x / l * Math.min(1, (l - d) / (1 - d)), y / l * Math.min(1, (l - d) / (1 - d))]; };
      this.padAxes = Array.from(p.axes);
      // EWA93-P1: retain analog buttons through the engine's one controller poll.
      this.padValues = Array.from(p.buttons, b => clamp(Number(b.value) || 0, 0, 1));
      this.padMapping = p.mapping || '';
      if (this.padValues.some(v => v > .05)) this.lastDevice = 'gamepad';
      this.padMove = dz(p.axes[0] || 0, p.axes[1] || 0);
      const aim = dz(p.axes[2] || 0, p.axes[3] || 0);
      this.padAim = Math.hypot(...aim) > 0 ? [aim[0], aim[1] * (this.invertAimY ? -1 : 1)] : null;
      if (this.padAim || Math.hypot(...this.padMove) > 0) { this.aimSource = 'pad'; this.lastDevice = 'gamepad'; }
      p.buttons.forEach((b, i) => { const on = b.pressed; if (on && !this.padPrev[i]) this.press('Pad' + i); if (!on && this.padPrev[i]) this.release('Pad' + i); this.padPrev[i] = on; });
      const dirs = [this.padMove[1] < -.5, this.padMove[1] > .5, this.padMove[0] < -.5, this.padMove[0] > .5];
      ['PadAxisUp', 'PadAxisDown', 'PadAxisLeft', 'PadAxisRight'].forEach((c, i) => dirs[i] ? this.press(c) : this.release(c));
    }
    // a tap is held for the one step after it (its release comes the step after that)
    for (const c of this._tapsDue) this.release(c);
    const due = this._tapsDue; due.clear(); this._tapsDue = this._taps; this._taps = due;
    // presses since the last step become this step's pressed()/released()
    const n = this._now; n.clear(); this._now = this._fresh; this._fresh = n;
    const u = this._nowUp; u.clear(); this._nowUp = this._freshUp; this._freshUp = u;
    this._clickAt = this._click; this._click = null; this._zoomNow = this._zoomAcc; this._zoomAcc = 1;
    const da = this._dragAcc || (this._dragAcc = [0, 0]), k = this.screen.dpr / this.screen.S; this._drag = this.stickOn ? [da[0] * k, da[1] * k] : null; da[0] = da[1] = 0;
  }
  /** wire every element with data-act="<action>" inside root to the action */
  bindButtons(root) {
    this._boundButtons = (this._boundButtons || []).filter(b => b.isConnected);
    root.querySelectorAll('[data-act]').forEach(b => {
      if (b._inputPointers) return;
      const code = 'Act:' + b.dataset.act;
      b._inputPointers = new Set(); this._boundButtons.push(b);
      const signal = this._signal;
      b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); b._inputPointers.add(e.pointerId); b.setPointerCapture(e.pointerId); this.press(code); b.classList.add('on'); }, { signal });
      const off = e => { b._inputPointers.delete(e.pointerId); if (!b._inputPointers.size) { this.release(code); b.classList.remove('on'); } };
      b.addEventListener('pointerup', off, { signal }); b.addEventListener('lostpointercapture', off, { signal }); b.addEventListener('pointercancel', off, { signal });
    });
  }
  // two fingers on the canvas: where each was as the second landed (a pinch is measured from there)
  _pinchArm() { this._pinching = false; if (this._fingers.size === 2) for (const f of this._fingers.values()) { f.x0 = f.x; f.y0 = f.y; } }
  _fingerUp(e) { if (this._fingers.delete(e.pointerId)) { if (this._fingers.size < 2) this._pinching = false; else this._pinchArm(); } }
  // a pinch: both fingers moving along the line between them, opposite ways (apart or together). A thumb on the stick
  // with another finger resting on the glass, or two moving the same way, is none. It takes over the stick and the tap
  _pinchMove(e) {
    const f = this._fingers.get(e.pointerId); if (!f) return; f.x = e.clientX; f.y = e.clientY;
    if (this._fingers.size !== 2 || !this._zoomOn) return;
    const [a, b] = [...this._fingers.values()], d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    if (!this._pinching) {
      const ux = (b.x - a.x) / d, uy = (b.y - a.y) / d, pa = (a.x - a.x0) * ux + (a.y - a.y0) * uy, pb = (b.x - b.x0) * ux + (b.y - b.y0) * uy;
      if (Math.abs(pa) < 4 || Math.abs(pb) < 4 || pa * pb >= 0 || Math.abs(d - Math.hypot(b.x0 - a.x0, b.y0 - a.y0)) < 16) return;
      this._pinching = true; this._pinchD = d; this._down = null;
      if (this.stickOn && this._fingers.has(this.stickId)) this._stickEnd({ pointerId: this.stickId });
      return;
    }
    this._zoomAcc *= d / this._pinchD; this._pinchD = d;
  }
  _stickStart(e) {
    if (!this.touchEnabled || this.stickOn) return;
    const rc = this.screen.canvas.getBoundingClientRect();
    if (this.steer !== 'drag' && (this.stickSide === 'right' ? e.clientX - rc.left < rc.width * .5 : e.clientX - rc.left > rc.width * .5)) return;   // dragging: anywhere
    this.screen.canvas.setPointerCapture(e.pointerId); this.aimSource = 'move'; this.lastDevice = 'touch';
    /** stickId: the pointer (finger) holding the touch stick */
    this.stickId = e.pointerId; this.stickOn = true; this._stickO = [e.clientX, e.clientY]; this.stick = [0, 0]; this._dragAt = [e.clientX, e.clientY];
    if (!this._stickEl) {
      const mkEl = (s, css) => { const d = document.createElement('div'); d.style.cssText = 'position:absolute;pointer-events:none;border-radius:50%;z-index:3;' + css; d.style.width = d.style.height = s + 'px'; this.screen.canvas.parentElement.appendChild(d); return d; };
      this._stickEl = mkEl(96, 'border:2px solid rgba(255,255,255,.35);background:rgba(255,255,255,.06)');
      this._knobEl = mkEl(40, 'background:rgba(255,255,255,.4)');
    }
    this._stickDraw();
  }
  _stickMove(e) {
    if (!this.stickOn || e.pointerId !== this.stickId) return;
    const da = this._dragAcc || (this._dragAcc = [0, 0]); da[0] += e.clientX - this._dragAt[0]; da[1] += e.clientY - this._dragAt[1]; this._dragAt = [e.clientX, e.clientY];
    let dx = (e.clientX - this._stickO[0]) / this.stickRadius, dy = (e.clientY - this._stickO[1]) / this.stickRadius;
    const l = Math.hypot(dx, dy), d = clamp(this.stickDeadzone, 0, .5), k = l <= d ? 0 : Math.min(1, (l - d) / (1 - d)) / l;   // a thumb resting on the glass doesn't creep
    this.stick = [dx * k, dy * k]; this._stickDirs(); this._stickDraw();
  }
  _stickEnd(e) { if (e.pointerId !== this.stickId) return; this.stickOn = false; this.stick = [0, 0]; this._stickDirs(); if (this._stickEl) this._stickEl.style.display = this._knobEl.style.display = 'none'; }
  // past halfway the stick presses the direction actions, as a d-pad would (and lets go of them)
  _stickDirs() {
    const [x, y] = this.stick, on = [y < -.5, y > .5, x < -.5, x > .5], was = this._sd || (this._sd = [false, false, false, false]);
    ['up', 'down', 'left', 'right'].forEach((d, i) => { if (on[i] !== was[i]) { was[i] = on[i]; if (on[i]) this.press('Act:' + d); else this.release('Act:' + d); } });
  }
  _stickDraw() {
    if (this.steer === 'drag') { this._stickEl.style.display = this._knobEl.style.display = 'none'; return; }   // a drag steers what it moves: no stick to show
    const rc = this.screen.canvas.getBoundingClientRect(), pr = this.screen.canvas.parentElement.getBoundingClientRect();
    const ox = this._stickO[0] - pr.left, oy = this._stickO[1] - pr.top;
    Object.assign(this._stickEl.style, { display: 'block', left: ox - 48 + 'px', top: oy - 48 + 'px' });
    Object.assign(this._knobEl.style, { display: 'block', left: ox - 20 + this.stick[0] * 36 + 'px', top: oy - 20 + this.stick[1] * 36 + 'px' });
    void rc;
  }
}
/* the player's zoom keys (Input: where no action uses them): - farther, = closer, and the numpad's */
const ZOOM_KEYS = { Minus: 1 / 1.1, NumpadSubtract: 1 / 1.1, Equal: 1.1, NumpadAdd: 1.1 };
/* menu actions shared by every preset. Pad9 = Start, Pad0 = A (bottom), Pad1 = B (right). use() adds 'Act:menu', the
   touch START button, to start and pause in any layout: like Start, it starts on a title and pauses a pausable scene */
const MENU_KEYS = {
  start: ['Enter', 'NumpadEnter', 'Pad9'], pause: ['Escape', 'KeyP', 'Pad9'],
  confirm: ['Enter', 'NumpadEnter', 'Space', 'KeyJ', 'KeyZ', 'Pad0'], cancel: ['Escape', 'Backspace', 'KeyX', 'KeyK', 'Pad1']
};
/* rebinding: the codes a player may bind (not Escape, Enter, the F keys, Start or Home: the menus and the browser keep
   them), the arrow keys and d-pad that stay on the moves whatever is bound, and which codes are a gamepad's */
const BINDABLE = /^(Key[A-Z]|Digit\d|Numpad\d|Arrow(Up|Down|Left|Right)|Space|Shift(Left|Right)|Control(Left|Right)|Alt(Left|Right)|Tab|Backspace|Backquote|Minus|Equal|Bracket(Left|Right)|Backslash|Semicolon|Quote|Comma|Period|Slash|CapsLock|Mouse[0-4]|Pad([0-8]|1[0-5]))$/;
const FIXED_CODES = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Pad12', 'Pad13', 'Pad14', 'Pad15', 'PadAxisUp', 'PadAxisDown', 'PadAxisLeft', 'PadAxisRight']);
/* the left stick past halfway presses the direction actions, as the d-pad does (menus, dialog choices, ladders) */
const STICK_CODES = { up: 'PadAxisUp', down: 'PadAxisDown', left: 'PadAxisLeft', right: 'PadAxisRight' };
const padCode = c => c.startsWith('Pad');
/* a standard gamepad's buttons by position (0 bottom, 1 right, 2 left, 3 top, 4-7 shoulders and triggers, 8 back, 9 start,
   10-11 stick clicks, 12-15 d-pad, 16 home), as each family prints them */
const PAD_GLYPHS = {
  xbox: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'LS', 'RS', 'D-pad ↑', 'D-pad ↓', 'D-pad ←', 'D-pad →', 'Guide'],
  playstation: ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'Create', 'Options', 'L3', 'R3', 'D-pad ↑', 'D-pad ↓', 'D-pad ←', 'D-pad →', 'PS'],
  nintendo: ['B', 'A', 'Y', 'X', 'L', 'R', 'ZL', 'ZR', '−', '+', 'L stick', 'R stick', 'D-pad ↑', 'D-pad ↓', 'D-pad ←', 'D-pad →', 'Home'],
  generic: ['Bottom', 'Right', 'Left', 'Top', 'L1', 'R1', 'L2', 'R2', 'Select', 'Start', 'L3', 'R3', 'D-pad ↑', 'D-pad ↓', 'D-pad ←', 'D-pad →', 'Home']
};
const CODE_LABELS = { Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'R Shift', ControlLeft: 'Ctrl', ControlRight: 'R Ctrl', AltLeft: 'Alt', AltRight: 'R Alt',
  Enter: 'Enter', NumpadEnter: 'Enter', Escape: 'Esc', Backspace: 'Backspace', Tab: 'Tab', CapsLock: 'Caps', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Mouse0: 'Left click', Mouse1: 'Middle click', Mouse2: 'Right click', Mouse3: 'Mouse 4', Mouse4: 'Mouse 5', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[',
  BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/',
  PadAxisUp: 'L stick ↑', PadAxisDown: 'L stick ↓', PadAxisLeft: 'L stick ←', PadAxisRight: 'L stick →' };
/** top-down / isometric action (Zelda, Diablo): Space dashes, J or click attacks */
Input.DEFAULT = {
  up: ['KeyW', 'ArrowUp', 'Pad12'], down: ['KeyS', 'ArrowDown', 'Pad13'], left: ['KeyA', 'ArrowLeft', 'Pad14'], right: ['KeyD', 'ArrowRight', 'Pad15'],
  attack: ['KeyJ', 'KeyX', 'Mouse0', 'Pad0', 'Pad7'], dash: ['Space', 'ShiftLeft', 'ShiftRight', 'KeyK', 'Pad1', 'Pad6'],
  skill: ['KeyL', 'KeyE', 'Mouse2', 'Pad2', 'Pad5'], jump: ['KeyZ', 'Pad3'], ...MENU_KEYS
};
/** side-scrollers (Mario, Mega Man): Space / Z / K jump, X / J attack or shoot, Shift / C dash */
Input.PLATFORMER = {
  up: ['KeyW', 'ArrowUp', 'Pad12'], down: ['KeyS', 'ArrowDown', 'Pad13'], left: ['KeyA', 'ArrowLeft', 'Pad14'], right: ['KeyD', 'ArrowRight', 'Pad15'],
  jump: ['Space', 'KeyZ', 'KeyK', 'Pad0'], attack: ['KeyX', 'KeyJ', 'Mouse0', 'Pad2'], dash: ['ShiftLeft', 'ShiftRight', 'KeyC', 'KeyL', 'Pad1', 'Pad5'],
  skill: ['KeyE', 'KeyV', 'Mouse2', 'Pad3'], ...MENU_KEYS
};
/** third-person action and stealth (Assassin's Creed, Metal Gear): WASD / stick move, Shift sprint, Space jump and parkour,
 *  C crouch (a toggle), E interact, J attack, K block, L dodge, Q use, M map. Pad: A jump, B crouch, X attack, Y interact,
 *  LB block, RB dodge, LT use, RT or L3 sprint, Back map */
Input.THIRDPERSON = {
  up: ['KeyW', 'ArrowUp', 'Pad12'], down: ['KeyS', 'ArrowDown', 'Pad13'], left: ['KeyA', 'ArrowLeft', 'Pad14'], right: ['KeyD', 'ArrowRight', 'Pad15'],
  sprint: ['ShiftLeft', 'ShiftRight', 'Pad7', 'Pad10'], jump: ['Space', 'Pad0'], crouch: ['KeyC', 'ControlLeft', 'Pad1'], interact: ['KeyE', 'KeyF', 'Pad3'],
  attack: ['KeyJ', 'Mouse0', 'Pad2'], block: ['KeyK', 'Mouse2', 'Pad4'], dodge: ['KeyL', 'Pad5'], use: ['KeyQ', 'Pad6'], map: ['KeyM', 'Tab', 'Pad8'], ...MENU_KEYS
};
/** shoot-'em-ups (1942, Gradius): Space / Z / J fire (hold for autofire), X / K bomb */
Input.SHMUP = {
  up: ['KeyW', 'ArrowUp', 'Pad12'], down: ['KeyS', 'ArrowDown', 'Pad13'], left: ['KeyA', 'ArrowLeft', 'Pad14'], right: ['KeyD', 'ArrowRight', 'Pad15'],
  fire: ['Space', 'KeyZ', 'KeyJ', 'Mouse0', 'Pad0', 'Pad7'], bomb: ['KeyX', 'KeyK', 'Mouse2', 'Pad1', 'Pad6'], ...MENU_KEYS
};
E.Input = Input;

/* =============================================================================
 * 6. PIXEL FONT  3x5 glyphs for in-world numbers and labels
 * ============================================================================= */
const GLYPHS = {
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001',
  '5': '111100111001111', '6': '111100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001111',
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100',
  G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101',
  S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111', '+': '000010111010000', '-': '000000111000000', '!': '010010010000010',
  '.': '000000000000010', ':': '000010000010000', '/': '001001010100100', ' ': '000000000000000', 'x': '000101010101000',
  '?': '111001010000010', ',': '000000000010100', "'": '010010000000000', '"': '101101000000000', '(': '001010010010001',
  ')': '100010010010100', '%': '101001010100101', '*': '000101010101000', '=': '000111000111000', '<': '001010100010001',
  '>': '100010001010100', '#': '101111101111101', '&': '010101010101011', '_': '000000000000111', ';': '000010000010100',
  '[': '110100100100110', ']': '011001001001011', '$': '011110111011110', '^': '010101000000000', '@': '111101111100011',
  '~': '000011110000000', '♥': '101111111010000', '♡': '101101101010000', '★': '010111010101000', '•': '000010111010000',
  '←': '000010111010000', '→': '000010111010000', '↑': '010111010010010', '↓': '010010010111010', '©': '111101101101111'
};
GLYPHS['←'] = '000100111100000'; GLYPHS['→'] = '000001111001000';
/* 5x7 proportional font with lower case and descenders: the default ('normal'). Rows are 7 above the baseline and up to 2 below */
const G57 = {
  "A": '.###.|#...#|#...#|#####|#...#|#...#|#...#', "B": '####.|#...#|#...#|####.|#...#|#...#|####.', "C": '.###.|#...#|#....|#....|#....|#...#|.###.', "D": '####.|#...#|#...#|#...#|#...#|#...#|####.', "E": '#####|#....|#....|####.|#....|#....|#####', "F": '#####|#....|#....|####.|#....|#....|#....',
  "G": '.###.|#...#|#....|#.###|#...#|#...#|.####', "H": '#...#|#...#|#...#|#####|#...#|#...#|#...#', "I": '###|.#.|.#.|.#.|.#.|.#.|###', "J": '..###|...#.|...#.|...#.|...#.|#..#.|.##..', "K": '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#', "L": '#....|#....|#....|#....|#....|#....|#####',
  "M": '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#', "N": '#...#|#...#|##..#|#.#.#|#..##|#...#|#...#', "O": '.###.|#...#|#...#|#...#|#...#|#...#|.###.', "P": '####.|#...#|#...#|####.|#....|#....|#....', "Q": '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#', "R": '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
  "S": '.####|#....|#....|.###.|....#|....#|####.', "T": '#####|..#..|..#..|..#..|..#..|..#..|..#..', "U": '#...#|#...#|#...#|#...#|#...#|#...#|.###.', "V": '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..', "W": '#...#|#...#|#...#|#.#.#|#.#.#|#.#.#|.#.#.', "X": '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
  "Y": '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..', "Z": '#####|....#|...#.|..#..|.#...|#....|#####', "a": '.....|.....|.###.|....#|.####|#...#|.####', "b": '#....|#....|####.|#...#|#...#|#...#|####.', "c": '.....|.....|.###.|#....|#....|#....|.###.', "d": '....#|....#|.####|#...#|#...#|#...#|.####',
  "e": '.....|.....|.###.|#...#|#####|#....|.###.', "f": '..##|.#..|####|.#..|.#..|.#..|.#..', "g": '.....|.....|.####|#...#|#...#|#...#|.####|....#|.###.', "h": '#....|#....|####.|#...#|#...#|#...#|#...#', "i": '#|.|#|#|#|#|#', "j": '..#|...|..#|..#|..#|..#|..#|#.#|.#.',
  "k": '#...|#...|#..#|#.#.|##..|#.#.|#..#', "l": '#.|#.|#.|#.|#.|#.|.#', "m": '.....|.....|##.#.|#.#.#|#.#.#|#.#.#|#.#.#', "n": '.....|.....|####.|#...#|#...#|#...#|#...#', "o": '.....|.....|.###.|#...#|#...#|#...#|.###.', "p": '.....|.....|####.|#...#|#...#|#...#|####.|#....|#....',
  "q": '.....|.....|.####|#...#|#...#|#...#|.####|....#|....#', "r": '....|....|#.##|##..|#...|#...|#...', "s": '.....|.....|.####|#....|.###.|....#|####.', "t": '.#..|.#..|####|.#..|.#..|.#..|..##', "u": '.....|.....|#...#|#...#|#...#|#...#|.####', "v": '.....|.....|#...#|#...#|#...#|.#.#.|..#..',
  "w": '.....|.....|#...#|#...#|#.#.#|#.#.#|.#.#.', "x": '.....|.....|#...#|.#.#.|..#..|.#.#.|#...#', "y": '.....|.....|#...#|#...#|#...#|#...#|.####|....#|.###.', "z": '.....|.....|#####|...#.|..#..|.#...|#####', "0": '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.', "1": '..#..|.##..|..#..|..#..|..#..|..#..|.###.',
  "2": '.###.|#...#|....#|...#.|..#..|.#...|#####', "3": '####.|....#|....#|.###.|....#|....#|####.', "4": '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.', "5": '#####|#....|####.|....#|....#|#...#|.###.', "6": '.###.|#....|#....|####.|#...#|#...#|.###.', "7": '#####|....#|...#.|..#..|.#...|.#...|.#...',
  "8": '.###.|#...#|#...#|.###.|#...#|#...#|.###.', "9": '.###.|#...#|#...#|.####|....#|....#|.###.', "!": '#|#|#|#|#|.|#', "\"": '#.#|#.#|...|...|...|...|...', "#": '.#.#.|.#.#.|#####|.#.#.|#####|.#.#.|.#.#.', "$": '..#..|.####|#.#..|.###.|..#.#|####.|..#..',
  "%": '##..#|##..#|...#.|..#..|.#...|#..##|#..##', "&": '.##..|#..#.|#.#..|.#...|#.#.#|#..#.|.##.#', "'": '#|#|.|.|.|.|.', "(": '..#|.#.|#..|#..|#..|.#.|..#', ")": '#..|.#.|..#|..#|..#|.#.|#..', "*": '.....|#.#.#|.###.|#####|.###.|#.#.#|.....',
  "+": '.....|..#..|..#..|#####|..#..|..#..|.....', ",": '..|..|..|..|..|.#|.#|#.', "-": '....|....|....|####|....|....|....', ".": '.|.|.|.|.|.|#', "/": '....#|....#|...#.|..#..|.#...|#....|#....', ":": '.|.|#|.|.|#|.',
  ";": '..|..|.#|..|..|.#|.#|#.', "<": '...#|..#.|.#..|#...|.#..|..#.|...#', "=": '.....|.....|#####|.....|#####|.....|.....', ">": '#...|.#..|..#.|...#|..#.|.#..|#...', "?": '.###.|#...#|....#|...#.|..#..|.....|..#..', "@": '.###.|#...#|#.###|#.#.#|#.###|#....|.####',
  "[": '###|#..|#..|#..|#..|#..|###', "\\": '#....|#....|.#...|..#..|...#.|....#|....#', "]": '###|..#|..#|..#|..#|..#|###', "^": '..#..|.#.#.|#...#|.....|.....|.....|.....', "_": '.....|.....|.....|.....|.....|.....|#####', "`": '#.|.#|..|..|..|..|..',
  "{": '..##|.#..|.#..|#...|.#..|.#..|..##', "|": '#|#|#|#|#|#|#', "}": '##..|..#.|..#.|...#|..#.|..#.|##..', "~": '.....|.....|.#...|#.#.#|...#.|.....|.....', "♥": '.....|.#.#.|#####|#####|.###.|..#..|.....', "★": '..#..|..#..|#####|.###.|.#.#.|#...#|.....',
  "←": '.....|..#..|.#...|#####|.#...|..#..|.....', "→": '.....|..#..|...#.|#####|...#.|..#..|.....', "↑": '..#..|.###.|#.#.#|..#..|..#..|..#..|.....', "↓": '.....|..#..|..#..|..#..|#.#.#|.###.|..#..', "•": '...|...|.#.|###|.#.|...|...', "©": '.###.|#...#|#.#.#|#.#..|#.#.#|#...#|.###.',
  "×": '.....|#...#|.#.#.|..#..|.#.#.|#...#|.....', "▸": '#...|##..|###.|####|###.|##..|#...', "♪": '..##.|..#.#|..#..|..#..|.##..|###..|.#...'
};
const parseFont = (src, h) => {
  const out = {};
  for (const ch in src) {
    const rows = typeof src[ch] === 'string' && src[ch].includes('|') ? src[ch].split('|') : null;
    let w, runs = [];
    if (rows) { w = rows[0].length; rows.forEach((r, y) => { for (let x = 0; x < r.length;) { if (r[x] !== '#') { x++; continue; } let n = 1; while (r[x + n] === '#') n++; runs.push([x, y, n]); x += n; } }); }
    else { w = 3; const bits = src[ch]; for (let k = 0; k < bits.length; k++) if (bits[k] === '1') runs.push([k % 3, (k / 3) | 0, 1]); }   // 3x5 bit strings
    out[ch] = { w, runs };
  }
  void h; return out;
};
const FONTS = {
  normal: { glyphs: parseFont(G57), h: 7, desc: 2, gap: 1, space: 3, upper: false },
  tiny: { glyphs: parseFont(GLYPHS), h: 5, desc: 0, gap: 2, space: 3, upper: true, mono: 3 }
};
/**
 * Pixel fonts. 'normal' (default) is a 5x7 proportional font with lower case; 'tiny' is the 3x5 upper-case font.
 * text(g, str, x, y, color, opts) where opts is an outline color, false, or
 *   { font: 'normal' | 'tiny', outline: '#0b0814' | false, shadow: '#000' (1 px drop shadow), gradient: ['#fff', '#8ad'] (top to bottom),
 *     scale: 1, align: 'left' | 'center' | 'right', wrap: maxWidthPx, lineGap }
 * '\n' starts a new line. Returns { w, h } of the drawn block. title(...) draws big logo text.
 */
E.font = {
  /** the font used when none is named: 'normal' (5 x 7) or 'tiny' (3 x 5) */
  default: 'normal',
  _f(o) { const n = (o && typeof o === 'object' && o.font) || this.default; return FONTS[n] || FONTS.normal; },
  _o(o) { return typeof o === 'number' ? { scale: o } : (o || {}); },
  _glyph(f, ch) { return f.glyphs[f.upper ? ch.toUpperCase() : ch] || f.glyphs[ch.toUpperCase()] || f.glyphs['?']; },
  _lineW(f, line) {
    let w = 0;
    for (const ch of line) w += ch === ' ' ? f.space + 1 : (f.mono || this._glyph(f, ch).w) + 1;
    return Math.max(0, w - 1);
  },
  /** width in pixels of the widest line. opts: a scale number or { font, scale } */
  width(s, o) { o = this._o(o); const f = this._f(o), sc = Math.max(1, Math.round(o.scale || 1)); let m = 0; for (const line of String(s).split('\n')) m = Math.max(m, this._lineW(f, line)); return m * sc; },
  /** pixels from one line to the next */
  lineHeight(o) { o = this._o(o); const f = this._f(o), sc = Math.max(1, Math.round(o.scale || 1)); return (f.h + f.desc + (o.lineGap === undefined ? f.gap : o.lineGap)) * sc; },
  /** the height in pixels of that many lines (with o's scale and font, and lineGap between them) */
  height(lines = 1, o, lineGap) { o = this._o(o); if (lineGap !== undefined) o = Object.assign({}, o, { lineGap }); const f = this._f(o), sc = Math.max(1, Math.round(o.scale || 1)); return this.lineHeight(o) * (lines - 1) + (f.h + f.desc) * sc; },
  /** split text into lines no wider than maxW pixels */
  wrap(s, maxW, o) {
    o = this._o(o); const f = this._f(o), sc = Math.max(1, Math.round(o.scale || 1)), lim = maxW / sc, out = [];
    for (const para of String(s).split('\n')) {
      let line = '';
      for (const word of para.split(' ')) {
        const t = line ? line + ' ' + word : word;
        if (this._lineW(f, t) <= lim || !line) line = t; else { out.push(line); line = word; }
        while (this._lineW(f, line) > lim && line.length > 1) { let k = line.length - 1; while (k > 1 && this._lineW(f, line.slice(0, k)) > lim) k--; out.push(line.slice(0, k)); line = line.slice(k); }
      }
      out.push(line);
    }
    return out;
  },
  /** draw text at (x, y) (its top-left; align: 'center' or 'right' moves it) in color. o: an outline color, or {
   *  outline, shadow, gradient, scale, align, wrap, font }; returns { w, h } */
  text(g, s, x, y, color = '#ffffff', o = '#0b0814') {
    if (o === null || o === false || typeof o === 'string') o = { outline: o };
    const f = this._f(o), sc = Math.max(1, Math.round(o.scale || 1)), outline = o.outline === undefined ? '#0b0814' : o.outline, lh = this.lineHeight(o);
    const lines = o.wrap ? this.wrap(s, o.wrap, o) : String(s).split('\n');
    const grad = o.gradient && o.gradient.length ? o.gradient : null, rowsH = f.h + f.desc;
    x = Math.round(x); y = Math.round(y);
    let w = 0;
    const draw = (ox, oy, c, useGrad) => {
      lines.forEach((line, li) => {
        const lw = this._lineW(f, line) * sc, lx = x + (o.align === 'center' ? -Math.round(lw / 2) : o.align === 'right' ? -lw : 0), ly = y + li * lh;
        w = Math.max(w, lw);
        let cx = 0;
        for (const ch of line) {
          if (ch === ' ') { cx += f.space + 1; continue; }
          const gl = this._glyph(f, ch), off = f.mono ? Math.floor((f.mono - gl.w) / 2) : 0;
          for (const [rx, ry, rn] of gl.runs) {
            px.col(g, useGrad ? grad[Math.min(grad.length - 1, Math.floor(ry / Math.max(1, f.h) * grad.length))] : c);
            g.fillRect(lx + (cx + off + rx) * sc + ox, ly + ry * sc + oy, rn * sc, sc);
          }
          cx += (f.mono || gl.w) + 1;
        }
      });
    };
    if (o.shadow) draw(sc, sc, o.shadow, false);
    if (outline) for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) draw(ox, oy, outline, false);   // 1 px at every scale, so 8 and 0 keep their holes
    draw(0, 0, color, !!grad);
    return { w, h: lh * (lines.length - 1) + rowsH * sc };
  },
  /**
   * Big logo text for title screens: scaled glyphs with a vertical color gradient, an outline and an extruded 3D edge.
   * title(g, 'CASTLE OF NIGHT', x, y, { scale: 3, colors: ['#fff6c8', '#ffd36a', '#e07a2a'], outline: '#1a0c10', depth: 3, depthColor: '#6a2a1a', align: 'center' })
   */
  title(g, s, x, y, o = {}) {
    const sc = Math.max(1, Math.round(o.scale || 3)), colors = o.colors || ['#fff6c8', '#ffe08a', '#ffb347', '#e0662a'], outline = o.outline === undefined ? '#1a0c10' : o.outline;
    const depth = o.depth === undefined ? Math.max(1, sc - 1) : o.depth, dc = o.depthColor || shade(colors[colors.length - 1], -.55), f = this._f(o);
    const base = Object.assign({}, o, { scale: sc, outline: false, shadow: false, gradient: null });
    for (let d = depth; d >= 1; d--) this.text(g, s, x + d, y + d, dc, base);
    if (outline) for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) this.text(g, s, x + ox, y + oy, outline, base);
    // smooth gradient: one color band per scaled pixel row
    const rows = f.h * sc, bands = [];
    for (let k = 0; k < rows; k++) { const t = k / Math.max(1, rows - 1) * (colors.length - 1), i = Math.min(colors.length - 2, Math.floor(t)); bands.push(colors.length < 2 ? colors[0] : mix(colors[i], colors[i + 1], t - i)); }
    const lines = String(s).split('\n'), lh = this.lineHeight(base);
    lines.forEach((line, li) => {
      const lw = this._lineW(f, line) * sc, lx = Math.round(x) + (o.align === 'center' ? -Math.round(lw / 2) : o.align === 'right' ? -lw : 0), ly = Math.round(y) + li * lh;
      let cx = 0;
      for (const ch of line) {
        if (ch === ' ') { cx += f.space + 1; continue; }
        const gl = this._glyph(f, ch);
        for (const [rx, ry, rn] of gl.runs) for (let sy = 0; sy < sc; sy++) { px.col(g, bands[Math.min(rows - 1, ry * sc + sy)] || colors[0]); g.fillRect(lx + (cx + rx) * sc, ly + ry * sc + sy, rn * sc, 1); }
        if (o.shine !== false) for (const [rx, ry, rn] of gl.runs) if (ry === 0) { px.col(g, o.shine || '#ffffff'); g.fillRect(lx + (cx + rx) * sc, ly, rn * sc, 1); }
        cx += (f.mono || gl.w) + 1;
      }
    });
    return { w: this.width(s, base), h: this.height(lines.length, base) };
  }
};

/* =============================================================================
 * 7. LIGHTING  per-pixel darkness with dithered bands, lights measured on the ground
 * ============================================================================= */
class Lighting {
  /** game.lights (made by the game): canvas lighting, darkness over the frame with lights cut out of it; turn it on with
   *  game.lights.enabled = true and add lights each frame with game.lights.add(x, y, z, radius, intensity, o) */
  constructor(game) {
    /** game: the game it lights; enabled: false (the default) turns the canvas lighting off; ambient: how lit unlit
     *  places are, 0 (black) .. 1; list: this frame's lights from add() */
    this._game = game; this.enabled = false; this.ambient = .15; this.list = [];
    /** dark: the color of darkness, [r, g, b]; levels: the darkness of each lighting band, darkest first (dithered
     *  between them); glow: the color, [r, g, b, a], where light is brightest; glowAt: the light level (1 = fully
     *  lit) above which it glows */
    this.dark = [10, 6, 24]; this.levels = [.9, .7, .48, .26, .08, 0]; this.glow = [255, 200, 140, 0]; this.glowAt = 1.7;
    /** casters: this frame's shadow casters from caster(); heats: this frame's heat shimmers from heat() */
    this._casters = []; this._heats = [];
    if (!game.headless) { this._cv = mkCanvas(8, 8); this._g = this._cv.getContext('2d'); this._build(); }   // (a headless game never draws)
  }
  _build() {
    const L = this.levels, d = this.dark;
    this._cols = new Uint32Array(L.length + 1);
    L.forEach((a, i) => { this._cols[i] = ((Math.round(a * 255) << 24) | (d[2] << 16) | (d[1] << 8) | d[0]) >>> 0; });
    const gl = this.glow; this._cols[L.length] = ((gl[3] << 24) | (gl[2] << 16) | (gl[1] << 8) | gl[0]) >>> 0;
  }
  /** forget this frame's lights, casters and heat (the renderer does it every frame: add lights in draw) */
  _clear() { this.list.length = 0; this._casters.length = 0; this._heats.length = 0; this._screenFrame = false; }
  /** radius in world units; intensity ~0.5..1.5. opts (GPU lighting only): { color: '#ffaa55', shadow: true } */
  add(x, y, z, radius, intensity = 1, o) {
    if (!(isFinite(x) && isFinite(y) && isFinite(z) && radius > 0)) { warn('light:nan', 'lights.add(x, y, z, radius, intensity) got a non-number or zero radius; light skipped'); return; }
    this.list.push({ x, y, z, r: radius, i: intensity, color: o && o.color, shadow: !!(o && o.shadow) });
  }
  /** something that blocks light (GPU shadows): a cylinder of radius r from the floor up to height top */
  caster(x, y, r, top) { this._casters.push({ x, y, r, top }); }
  /** heat shimmer above a point (GPU only). width in world units, strength ~0.5..1.5 */
  heat(x, y, z, width, strength = 1) { this._heats.push({ x, y, z, w: width, s: strength }); }
  /** darken the frame by the lights (the renderer calls it after the queue, when enabled) */
  render(r) {
    const W = r.bw, H = r.bh, n = W * H, al = E.style.trans !== 'dither';
    if (!this._I || this._I.length !== n) {
      this._I = new Float32Array(n); this._cv.width = W; this._cv.height = H;
      this._img = this._g.createImageData(W, H); this._u32 = new Uint32Array(this._img.data.buffer);
      this._CR = new Float32Array(n); this._CG = new Float32Array(n); this._CB = new Float32Array(n);
      this._cv2 = mkCanvas(W, H); this._g2 = this._cv2.getContext('2d'); this._img2 = this._g2.createImageData(W, H); this._u32b = new Uint32Array(this._img2.data.buffer);
    }
    const CR = this._CR, CG = this._CG, CB = this._CB; if (al) { CR.fill(0); CG.fill(0); CB.fill(0); }
    // screen-space lights when there is no ground plane to measure on (side view, or side-scroller levels)
    const I = this._I, view = r.view, ix = r.ix, iy = r.iy, inv = (this.screen || this._screenFrame) ? null : view.inv;
    I.fill(this.ambient);
    for (const L of this.list) {
      const R = L.r, R2 = R * R, lc = L.color ? hex(L.color) : [255, 236, 200], cr = lc[0] / 255, cg = lc[1] / 255, cb = lc[2] / 255;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let k = 0; k < 16; k++) {
        const a = k / 16 * TAU, s = view.p(L.x + Math.cos(a) * R * 1.02, L.y + Math.sin(a) * R * 1.02, 0);
        x0 = Math.min(x0, s[0]); x1 = Math.max(x1, s[0]); y0 = Math.min(y0, s[1]); y1 = Math.max(y1, s[1]);
      }
      if (!inv) { const s = view.p(L.x, L.y, L.z), rr = R * view.scale; x0 = s[0] - rr; x1 = s[0] + rr; y0 = s[1] - rr; y1 = s[1] + rr; }
      const X0 = Math.max(0, Math.floor(x0 - ix)), X1 = Math.min(W - 1, Math.ceil(x1 - ix)), Y0 = Math.max(0, Math.floor(y0 - iy)), Y1 = Math.min(H - 1, Math.ceil(y1 - iy));
      if (X0 > X1 || Y0 > Y1) continue;
      if (inv) {
        for (let py = Y0; py <= Y1; py++) {
          const sy = py + iy; let gx = inv[0] * (X0 + ix) + inv[1] * sy - L.x, gy = inv[2] * (X0 + ix) + inv[3] * sy - L.y, k = py * W + X0;
          for (let pxx = X0; pxx <= X1; pxx++, k++, gx += inv[0], gy += inv[2]) { const d2 = gx * gx + gy * gy; if (d2 < R2) { const f = (1 - d2 / R2) * L.i; I[k] += f; if (al) { CR[k] += f * cr; CG[k] += f * cg; CB[k] += f * cb; } } }
        }
      } else {
        const s = view.p(L.x, L.y, L.z), rr = R * view.scale, rr2 = rr * rr;
        for (let py = Y0; py <= Y1; py++) for (let pxx = X0; pxx <= X1; pxx++) { const dx = pxx + ix - s[0], dy = py + iy - s[1], d2 = dx * dx + dy * dy; if (d2 < rr2) { const k = py * W + pxx, f = (1 - d2 / rr2) * L.i; I[k] += f; if (al) { CR[k] += f * cr; CG[k] += f * cg; CB[k] += f * cb; } } }
      }
    }
    const u = this._u32, cols = this._cols, NL = this.levels.length - 1;
    if (al) {
      // PS1-style lighting: a smooth cool darkness where light is weak, then the lights' own colors added on top
      const d = this.dark, maxA = this.darkness === undefined ? .9 : this.darkness, base = (d[2] << 16) | (d[1] << 8) | d[0], u2 = this._u32b, tint = (this.tint === undefined ? .32 : this.tint) * 255;
      let lit = false;
      const q = x => Math.round((1 - Math.exp(-x)) * tint / 8) * 8;   // saturates: overlapping lights warm a surface, they never bleach it white
      for (let k = 0; k < n; k++) {
        const v = I[k];
        const a8 = v >= 1 ? 0 : Math.min(255, Math.round((1 - Math.max(0, v)) * maxA * 16) * 16);
        u[k] = a8 ? ((a8 << 24) | base) >>> 0 : 0;
        const rr = CR[k], gg = CG[k], bb = CB[k];
        if (rr + gg + bb < .03) { u2[k] = 0; continue; }
        lit = true;
        u2[k] = (255 << 24 | q(bb) << 16 | q(gg) << 8 | q(rr)) >>> 0;
      }
      this._g.putImageData(this._img, 0, 0); r.ctx.drawImage(this._cv, 0, 0);
      if (lit) { this._g2.putImageData(this._img2, 0, 0); const c = r.ctx; c.save(); c.globalCompositeOperation = 'lighter'; c.drawImage(this._cv2, 0, 0); c.restore(); }
      return;
    }
    for (let py = 0, k = 0; py < H; py++) for (let pxx = 0; pxx < W; pxx++, k++) {
      const v = I[k];
      if (v >= this.glowAt) { u[k] = cols[NL + 1]; continue; }
      if (v >= 1) { u[k] = cols[NL]; continue; }
      if (v <= 0) { u[k] = cols[0]; continue; }
      const f = v * NL; let lo = f | 0; if (f - lo > bayer(pxx + ix, py + iy)) lo++;
      u[k] = cols[lo];
    }
    this._g.putImageData(this._img, 0, 0);
    r.ctx.drawImage(this._cv, 0, 0);
  }
}

/* =============================================================================
 * 8. PARTICLES  3D, projected. kinds: dust, spark, bit, ember, ring, text
 *    z gravity: g > 0 pulls down. bounce: 0..1 on the floor.
 * ============================================================================= */
class Particles {
  /** game.particles. game: its game; list: the live particles; max: at most this many at once (add() skips the rest);
   *  ground: null (the floor is z 0), or (x, y, z) -> the floor's height under a particle (a side-scroller's platforms,
   *  a 3D level: engine/my-3d2dge-3d.js sets it), asked again when a particle enters a new 8-unit cell */
  constructor(game) { this._game = game; this.list = []; this.max = 900; this.ground = null; }
  /** add one particle { x, y, z, vx, vy, vz, life, max (seconds), g (gravity, > 0 pulls down), drag, bounce (0..1),
   *  kind: 'dust' | 'spark' | 'bit' | 'ember' | 'ring' | 'text', color, size }; returns it, or null when full */
  add(p) {
    if (this.list.length >= this.max) return null;
    const q = Object.assign({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: .5, g: 0, drag: 0, bounce: 0, kind: 'dust', color: '#d8c6a8', size: 1 }, p);
    this.list.push(q); return q;
  }
  /** move and age them by dt (the engine calls it every step) */
  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i]; p.life += dt;
      if (p.life >= p.max) { L[i] = L[L.length - 1]; L.pop(); continue; }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vy *= k; p.vz = p.vz * k - p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      let fl = 0;   // particles.ground(x, y, z) -> floor height (side-scroller platforms, a 3D level), looked up again whenever a particle enters a new 8-unit cell
      if (p.floor !== undefined) fl = p.floor;
      else if (this.ground) { const c = Math.floor(p.x / 8) + Math.floor(p.y / 8) * 65536; if (p._fc !== c) { p._fc = c; p._fl = this.ground(p.x, p.y, p.z) || 0; } fl = p._fl; }
      if (p.z < fl && p.kind !== 'ring') { p.z = fl; if (p.bounce) { p.vz = -p.vz * p.bounce; p.vx *= .7; p.vy *= .7; } else p.vz = 0; }
    }
  }
  /** queue them for drawing (the renderer calls it) */
  draw(r) {
    const view = r.view, s = view.scale;
    // flat overhead views have no screen height, so rising and bouncing particles lift on screen instead
    if (view.isTop) r = Object.create(r, { w: { value: (x, y, z) => { const q = Renderer.prototype.w.call(r, x, y, 0); q[1] -= z * .5; return q; } } });
    for (const p of this.list) {
      if (p.kind !== 'ring' && !r.visible(p.x, p.y, p.z, 12, 12, 12)) continue;
      const u = p.life / p.max;
      switch (p.kind) {
        case 'dust': r.queue(p.x, p.y, p.z, g => {
          const [x, y] = r.w(p.x, p.y, p.z), rad = p.size * s * (1 + u * 1.4);
          if (!useAlpha(g)) { px.ddisc(g, x, y, rad, p.color, (1 - u) * .9, r.ix, r.iy); return; }
          px.blend(g, (1 - u) * .85, 'normal', () => { px.disc(g, x, y, rad, p.color); if (rad > 1.5) px.disc(g, x - rad * .3, y - rad * .3, rad * .45, shade(p.color, .18)); });
        }); break;
        case 'spark': r.queue(p.x, p.y, p.z, g => {
          px.glow(g, .8);
          const [x, y] = r.w(p.x, p.y, p.z), [x2, y2] = r.w(p.x - p.vx * .025, p.y - p.vy * .025, p.z - p.vz * .025);
          px.line(g, x, y, x2, y2, u < .5 ? (p.hot || '#fff5cf') : p.color, p.size > 1.5 ? 2 : 1);
        }, { emissive: true }); break;
        case 'bit': r.queue(p.x, p.y, p.z, g => { const [x, y] = r.w(p.x, p.y, p.z); px.rect(g, x, y, p.size, p.size, p.color); }); break;
        case 'ember': r.queue(p.x, p.y, p.z, g => { px.glow(g, .4); const [x, y] = r.w(p.x, p.y, p.z); if (useAlpha(g)) px.blend(g, 1 - u * .8, 'add', () => px.dot(g, x, y, u < .4 ? '#fff0b0' : p.color)); else if ((1 - u) > bayer(Math.round(x) + r.ix, Math.round(y) + r.iy) * .7) px.dot(g, x, y, u < .4 ? '#fff0b0' : p.color); }, { emissive: true }); break;
        case 'ring': if (view.pitchDeg < 20) r.queue(p.x, p.y, p.z, g => { const [x, y] = r.w(p.x, p.y, p.z), rad = lerp(p.r0, p.r1, ease.outQuad(u)) * s, n = Math.max(16, Math.round(rad * 3)); px.blend(g, 1 - u, 'add', () => { px.col(g, p.color); for (let i = 0; i < n; i++) { const a = i / n * TAU; g.fillRect(Math.round(x + Math.cos(a) * rad), Math.round(y + Math.sin(a) * rad * .9), 1, 1); } }); }, { emissive: true, bias: .3 });
          else r.decal(g => r.groundRing(p.x, p.y, lerp(p.r0, p.r1, ease.outQuad(u)), p.color, 1 - u, p.z), { emissive: .8 * (1 - u) }); break;
        case 'text': r.overlay(g => { const [x, y] = r.w(p.x, p.y, p.z), sc2 = p.scale || 1; if (u < .75 || Math.floor(p.life * 20) % 2) E.font.text(g, p.text, x, y, p.color, { align: 'center', scale: sc2, outline: '#0b0814' }); }); break;
        case 'fire': r.queue(p.x, p.y, p.z, g => {   // fireball puff: white-hot core, yellow, orange, red rim, then smoke
          const [x, y] = r.w(p.x, p.y, p.z), rad = p.size * s * (u < .3 ? .6 + u * 1.4 : 1.02 - (u - .3) * .5), hot = u < .45;
          if (hot) px.glow(g, 1 - u);
          const c = u < .15 ? '#fffbe0' : u < .3 ? '#ffe070' : u < .5 ? '#ffa030' : u < .7 ? '#e0502a' : '#5a4a4a';
          if (!useAlpha(g)) { px.ddisc(g, x, y, rad, c, u < .7 ? 1 : 1.4 - u, r.ix, r.iy); if (u < .5) px.ddisc(g, x - rad * .2, y - rad * .2, rad * .55, u < .25 ? '#ffffff' : '#fff0a0', .9, r.ix, r.iy); }
          else px.blend(g, u < .7 ? 1 : (1 - u) / .3, 'normal', () => { px.disc(g, x, y, rad, c); if (u < .5) px.disc(g, x - rad * .2, y - rad * .2, rad * .55, u < .25 ? '#ffffff' : '#fff0a0'); else px.disc(g, x - rad * .25, y - rad * .25, rad * .4, shade(c, .2)); });
        }, { bias: .2, emissive: u < .5 }); break;
        case 'smoke': r.queue(p.x, p.y, p.z, g => {   // a hard-edged puff in three flat tones that fades in 1/8 steps
          const [x, y] = r.w(p.x, p.y, p.z), rad = p.size * s * (.6 + u * 1.3), body = u < .3 ? (p.dark || '#3a3438') : (p.color || '#7a7078');
          if (!useAlpha(g)) { px.ddisc(g, x, y, rad, body, (1 - u) * .85, r.ix, r.iy); px.ddisc(g, x - rad * .3, y - rad * .3, rad * .45, p.light || '#9a9098', (1 - u) * .5, r.ix, r.iy); return; }
          px.blend(g, (1 - u) * .8, 'normal', () => { px.disc(g, x, y, rad, shade(body, -.12)); px.disc(g, x - rad * .18, y - rad * .22, rad * .74, body); px.disc(g, x - rad * .34, y - rad * .4, rad * .34, p.light || shade(body, .22)); });
        }, { bias: .1 }); break;
        case 'impact': r.queue(p.x, p.y, p.z, g => {   // hit spark: a star burst that pops and shrinks (two frames of impact)
          const [x, y] = r.w(p.x, p.y, p.z), R = p.size * s * (u < .35 ? 1 : 1.4 - u), c = u < .35 ? '#ffffff' : p.color, n = 8;
          px.glow(g, 1);
          const pts = []; for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * TAU + p.rot, rr = i % 2 ? R * .38 : R; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
          px.poly(g, pts, c); px.disc(g, x, y, Math.max(1, R * .3), '#ffffff');
        }, { bias: .4, emissive: true }); break;
        case 'glint': r.queue(p.x, p.y, p.z, g => { const [x, y] = r.w(p.x, p.y, p.z), k = Math.round((1 - Math.abs(u * 2 - 1)) * p.size * 2.5); px.glow(g, 1); px.rect(g, x - k, y, k * 2 + 1, 1, p.color); px.rect(g, x, y - k, 1, k * 2 + 1, p.color); px.dot(g, x, y, '#ffffff'); }, { bias: .3, emissive: true }); break;
      }
    }
  }
  /** n puffs of dust from (x, y, z) that drift and fade. o: { speed: 30, color, size } */
  dust(x, y, z, n, o = {}) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, sp = (o.speed || 30) * (.4 + Math.random()); this.add({ kind: 'dust', x: x + Math.cos(a) * 2, y: y + Math.sin(a) * 2, z: z + Math.random() * 2, vx: Math.cos(a) * sp + (o.vx || 0), vy: Math.sin(a) * sp + (o.vy || 0), vz: 8 + Math.random() * 14, g: -6, drag: 5, max: .35 + Math.random() * .35, size: (o.size || 1.2) * (.7 + Math.random() * .6), color: o.color || '#b9a88f' }); } }
  /** n bright sparks thrown from (x, y, z), every way or around angle dir (radians). o: { color, speed } */
  sparks(x, y, z, n, dir = null, o = {}) { for (let i = 0; i < n; i++) { const a = dir === null ? Math.random() * TAU : dir + (Math.random() - .5) * 1.6, sp = 80 + Math.random() * 170; this.add({ kind: 'spark', x, y, z, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 20 + Math.random() * 110, g: 360, drag: 3, max: .15 + Math.random() * .2, color: o.color || '#ffb85c', hot: o.hot }); } }
  /** n pieces of debris that fly, fall and bounce (colors: a list to pick from) */
  bits(x, y, z, n, colors) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, sp = 30 + Math.random() * 90; this.add({ kind: 'bit', x, y, z: z + Math.random() * 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 60 + Math.random() * 120, g: 420, bounce: .45, drag: .8, max: .7 + Math.random() * .6, size: Math.random() < .35 ? 2 : 1, color: colors[(Math.random() * colors.length) | 0] }); } }
  /** a ring on the ground growing from radius r0 to r1 over dur seconds (shockwaves, landings) */
  ring(x, y, r0, r1, color, dur = .35, z = 0) { this.add({ kind: 'ring', x, y, z, r0, r1, color, max: dur }); }
  /** floating number or word: text(x, y, z, '12', color, { scale: 2, bounce: true }) (bounce: lands and holds, Final Fantasy style) */
  text(x, y, z, text, color = '#fff2c4', o = {}) { this.add({ kind: 'text', x, y, z, vz: o.bounce ? 70 : 38, g: o.bounce ? 260 : 40, bounce: o.bounce ? .35 : 0, floor: o.bounce ? z : undefined, text: String(text), color, max: o.bounce ? 1.1 : .8, scale: o.scale || 1 }); }
  /** rising smoke puffs: smoke(x, y, z, n, { size, color, dark, light }) */
  smoke(x, y, z, n = 4, o = {}) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, sp = 8 + Math.random() * 14; this.add(Object.assign({ kind: 'smoke', x: x + Math.cos(a) * 3, y: y + Math.sin(a) * 3, z: z + Math.random() * 4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 14 + Math.random() * 18, g: -4, drag: 1.5, max: .9 + Math.random() * .7, size: (o.size || 4) * (.7 + Math.random() * .6) }, o, { size: (o.size || 4) * (.7 + Math.random() * .6) })); } }
  /** fireball puffs for explosions and fire breath */
  fire(x, y, z, n = 6, o = {}) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, sp = (o.speed || 40) * Math.random(); this.add({ kind: 'fire', x: x + Math.cos(a) * 2, y: y + Math.sin(a) * 2, z: z + Math.random() * 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 10 + Math.random() * 30, g: -10, drag: 3, max: .35 + Math.random() * .35, size: (o.size || 5) * (.6 + Math.random() * .6) }); } }
  /** a hit star at the point of impact: impact(x, y, z, size = 6, color) */
  impact(x, y, z, size = 6, color = '#ffe070') { this.add({ kind: 'impact', x, y, z, max: .16, size, color, rot: Math.random() * TAU }); }
  /** twinkling star glints for magic, treasure and pickups */
  glints(x, y, z, n = 5, color = '#fff6c0', spread = 10) { for (let i = 0; i < n; i++) this.add({ kind: 'glint', x: x + (Math.random() - .5) * spread, y: y + (Math.random() - .5) * spread, z: z + Math.random() * spread, vz: 6, max: .35 + Math.random() * .4, size: 1 + Math.random(), color }); }
  /**
   * a full explosion in one call: fireball, smoke, sparks, debris, shockwave ring, screen shake and flash, sound.
   * explosion(x, y, z, size = 1, { debris: ['#6a5a4a'], sound: true, flash: true })
   */
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
E.Particles = Particles;

/* =============================================================================
 * 9. RENDERER  per-frame drawing API handed to your draw(r) function
 * ============================================================================= */
const AS = 256, AOX = 128, AOY = 200;  // scratch image per character: room for bosses up to about 250 px, capes, lying bodies
class Renderer {
  /** the r handed to draw(r), made by the game */
  constructor(game) {
    /** game: its game; items: this frame's queue (sorted by depth when the frame ends) */
    this.game = game; this._items = []; this._decals = []; this._overlays = [];
    this._aCv = mkCanvas(AS, AS); this._aG = ctx2d(this._aCv);
    // track what each actor actually draws, so outlines, tints and rim light only touch that rectangle
    const aG = this._aG, bb = this._bb = [AS, AS, 0, 0], fr = aG.fillRect.bind(aG), di = aG.drawImage.bind(aG);
    const grow = (x, y, w, h) => { if (x < bb[0]) bb[0] = x; if (y < bb[1]) bb[1] = y; if (x + w > bb[2]) bb[2] = x + w; if (y + h > bb[3]) bb[3] = y + h; };
    aG.fillRect = (x, y, w, h) => { grow(x, y, w, h); fr(x, y, w, h); };
    aG.drawImage = (img, ...a) => { if (a.length >= 8) grow(a[4], a[5], a[6], a[7]); else if (a.length >= 4) grow(a[0], a[1], a[2], a[3]); else grow(a[0], a[1], img.width, img.height); di(img, ...a); };
    for (const m of ['fill', 'stroke', 'fillText', 'strokeText', 'putImageData']) { const f = aG[m].bind(aG); aG[m] = (...a) => { grow(0, 0, AS, AS); return f(...a); }; }
    this._R = [0, 0, AS, AS];
    this._mCv = mkCanvas(AS, AS); this._mG = ctx2d(this._mCv);
    this._rCv = mkCanvas(AS, AS); this._rG = ctx2d(this._rCv);
    this._xCv = mkCanvas(8, 8); this._xG = ctx2d(this._xCv); this._xoCv = mkCanvas(8, 8); this._xoG = ctx2d(this._xoCv);   // x-ray silhouettes (checkered fill) and their solid outlines
    this._oCv = mkCanvas(8, 8); this._oG = ctx2d(this._oCv);
    this._eCv = mkCanvas(8, 8); this._eG = ctx2d(this._eCv); this._sCv = mkCanvas(8, 8); this._sG = ctx2d(this._sCv);   // canvas lighting: the glow mask, a scratch layer
    this._ghostPool = Array.from({ length: 10 }, () => { const c = mkCanvas(AS, AS); return { cv: c, g: ctx2d(c) }; });
    /** ghosts: the afterimages fading out (actor option ghost) */
    this._ghostIdx = 0; this._ghosts = [];
    const ck = mkCanvas(2, 2), cg = ck.getContext('2d'); cg.fillStyle = '#000'; cg.fillRect(0, 0, 1, 1); cg.fillRect(1, 1, 1, 1);
    /** checker: a 2 x 2 checkerboard canvas (a pattern for x-ray and dithered fills) */
    this._checker = ck;
    /** outline: the color of the 1-pixel outline round every actor; rim: the rim light's color on actors' lit edges;
     *  rimAlpha: its strength 0..1; xrayColor: the default color of x-ray silhouettes */
    this.outline = '#140c1c'; this.rim = '#ffe2b8'; this.rimAlpha = .28; this.xrayColor = '#8fe3ff';
    // GPU mode: a hidden "info" image (height, surface type, glow) and an unlit overlay image
    this._iCv = mkCanvas(8, 8); this._iG = this._iCv.getContext('2d'); this._iG._info = true; this._iG._r = this; this._iG._mat = '#000';
    /** gpu: true during a frame drawn with GPU lighting (draw code can check r.gpu) */
    this._vCv = mkCanvas(8, 8); this._vG = ctx2d(this._vCv); this.gpu = false; this._tg = null;
  }
  /** current draw target for ground helpers (switches during GPU info and overlay passes) */
  get tgt() { return this._tg || this.ctx; }
  /** the low-resolution buffer's 2D context: draw on it with E.px */
  get ctx() { return this.game.screen.ctx; }
  /** the view this frame is drawn in (the game's, with zoom and turn) */
  get view() { return this.game.view; }
  /** the screen's width in game pixels */
  get W() { return this.game.screen.W; }
  /** the screen's height in game pixels */
  get H() { return this.game.screen.H; }
  /** the buffer's width (W + 2: a pixel of margin each side for the sub-pixel camera) */
  get bw() { return this.game.screen.buf.width; }
  /** the buffer's height (H + 2) */
  get bh() { return this.game.screen.buf.height; }
  /** start a frame with the camera at (cx, cy) projected pixels (the game calls it before your draw) */
  _begin(cx, cy) {
    const sc = this.game.screen; this._frameNo = (this._frameNo || 0) + 1;   // (kept actor images count frames drawn)
    sc._begin(cx, cy, this.game.o.bg);
    /** ix, iy: the camera's whole-pixel offset this frame (a world point is at r.w(x, y, z) on the buffer) */
    this.ix = sc.ix; this.iy = sc.iy; this._items.length = 0; this._decals.length = 0; this._overlays.length = 0; this._map = null; (this._emis || (this._emis = [])).length = 0;
    const st = this.game.stats; st.actors = 0; st.culled = 0;
    if (this._xCv.width !== this.bw || this._xCv.height !== this.bh) { this._xCv.width = this._xoCv.width = this._oCv.width = this._eCv.width = this._sCv.width = this.bw; this._xCv.height = this._xoCv.height = this._oCv.height = this._eCv.height = this._sCv.height = this.bh; }
    this._xrayUsed = false; this._xrayOl = false; this._emOn = false;
    const gpu = this.game.gpu;
    this.gpu = !!(gpu && gpu.active(this.view));
    if (gpu) gpu._show(this.gpu);
    if (this.gpu) {
      if (this._iCv.width !== this.bw || this._iCv.height !== this.bh) { this._iCv.width = this._vCv.width = this.bw; this._iCv.height = this._vCv.height = this.bh; }
      const iG = this._iG; iG.globalCompositeOperation = 'source-over'; iG.globalAlpha = 1; iG.fillStyle = '#000'; iG.fillRect(0, 0, this.bw, this.bh); iG._c = null; iG._mat = '#000';
      this._vG.clearRect(0, 0, this.bw, this.bh); this._vG._c = null;
    }
  }
  /** world -> buffer pixel coords */
  w(x, y, z = 0) { const v = this.game.view; return [v.ax * x + v.ay * y - this.ix, v.bx * x + v.by * y + v.bz * z - this.iy]; }
  /** queue a depth-sorted draw. fn(g) draws into g. opts: {bias, occluder, hides, xray, emissive, solid (hides a glow behind it), footprint}
   *  occluder: a wall (x-ray silhouettes show through it, it sorts as a block). hides: only lets x-ray silhouettes show
   *  through it (props, sprites, bodies), nothing else changes */
  queue(x, y, z, fn, o) {
    let k = this.game.view.order(x, y, z) + (o && o.bias || 0);
    // things standing on top of a TileMap wall block must sort after that block; a footprint ([x0, y0, x1, y1], world units)
    // lifts a big thing over every block under its base (a canopy over a tower's top, a cart across two cells)
    if (z > .5 && this._map && !(o && o.occluder)) {
      const f = o && o.footprint, M = this._map, T = M.T;
      if (f) { for (let cy = Math.floor(f[1] / T); cy <= Math.floor((f[3] - .01) / T); cy++) for (let cx = Math.floor(f[0] / T); cx <= Math.floor((f[2] - .01) / T); cx++) k = M._liftOrder(this.game.view, (cx + .5) * T, (cy + .5) * T, z, k); }
      else k = M._liftOrder(this.game.view, x, y, z, k);
      if (M.solids && M.solids.length) k = M._liftSolids(this.game.view, x, y, z, k);
    }
    const it = { k, fn, occ: o && o.occluder, hides: o && o.hides, box: o && o.box, actor: o && o.actor, xray: o && o.xray, x, y, z, info: o && o.info, noInfo: o && o.noInfo, em: !!(o && o.emissive), solid: !!(o && (o.solid || o.occluder)) };
    this._items.push(it);
    if (it.em) this._emis.push(it);   // glowing things: canvas lighting leaves them out of the darkness (see flush)
  }
  /** draw on the floor before the queue. opts.emissive (0..1) makes it glow under GPU lighting */
  decal(fn, o) { this._decals.push({ fn, e: o && o.emissive || 0 }); }
  /** draw fn(g) on top of everything, in screen pixels (HUD, dialog, menus) */
  overlay(fn) { this._overlays.push(fn); }
  // ground helpers (all dithered, correct in every view)
  /** n screen points round a circle of radius rad on the ground at (x, y), height z: the outline of a ring or a fan */
  groundPts(x, y, rad, n = 18, z = 0) { const pts = []; for (let i = 0; i < n; i++) { const a = i / n * TAU; pts.push(this.w(x + Math.cos(a) * rad, y + Math.sin(a) * rad, z)); } return pts; }
  /** a dithered disc lying on the ground (radius in world units, z its height): shadows, auras, area attacks */
  groundDisc(x, y, rad, color, alpha = 1, z = 0) { px.polyDither(this.tgt, this.groundPts(x, y, rad, 18, z), color, alpha, this.ix, this.iy); }
  /** a ring lying on the ground (radius in world units) */
  groundRing(x, y, rad, color, alpha = 1, z = 0) {
    const g = this.tgt, n = Math.max(16, Math.round(rad * this.view.scale * 5)), al = useAlpha(g), ga = g.globalAlpha; px.col(g, color);
    if (al) g.globalAlpha = ga * qa(alpha);
    for (let i = 0; i < n; i++) { const a = i / n * TAU, [sx, sy] = this.w(x + Math.cos(a) * rad, y + Math.sin(a) * rad, z), X = Math.round(sx), Y = Math.round(sy); if (al || alpha > bayer(X + this.ix, Y + this.iy)) g.fillRect(X, Y, 1, 1); }
    g.globalAlpha = ga;
  }
  /** a band of a ring on the ground from radius r0 to r1 and angle a0 to a1 (radians): melee telegraphs, sight cones */
  groundArc(x, y, r0, r1, a0, a1, color, alpha = 1, z = 0, g = this.tgt) {
    const n = Math.max(3, Math.ceil(Math.abs(a1 - a0) / .18)), pts = [];
    for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); pts.push(this.w(x + Math.cos(a) * r1, y + Math.sin(a) * r1, z)); }
    for (let i = n; i >= 0; i--) { const a = lerp(a0, a1, i / n); pts.push(this.w(x + Math.cos(a) * r0, y + Math.sin(a) * r0, z)); }
    px.polyDither(g, pts, color, alpha, this.ix, this.iy);
  }
  /** an observer's view on the ground: a dithered fan fov wide (radians) about its facing, out to range, cut short where
   *  the map hides a body's chest (map.ray, the height rules), draped over the ground below. o: { range: 120, fov: 1.6,
   *  facing, map, eye, color: '#ffe080', alpha: .3, rays }. Call it in draw (it is a decal: under walls and bodies) */
  sightCone(obs, o = {}) {
    const range = o.range === undefined ? 120 : o.range, fov = o.fov === undefined ? 1.6 : o.fov, facing = o.facing === undefined ? obs.facing || 0 : o.facing;
    const z = obs.z || 0, eye = o.eye !== undefined ? o.eye : obs.eye !== undefined ? obs.eye : HEIGHTS.eye, n = o.rays || Math.max(8, Math.ceil(fov * 12)), map = o.map, pts = [this.w(obs.x, obs.y, z)];
    for (let i = 0; i <= n; i++) {
      const a = facing - fov / 2 + fov * i / n, ex = obs.x + Math.cos(a) * range, ey = obs.y + Math.sin(a) * range;
      const t = map ? (h => h.clear ? 1 : h.t)(map.ray(obs, { x: ex, y: ey, z }, { eye, target: HEIGHTS.chest })) : 1, px2 = lerp(obs.x, ex, t), py2 = lerp(obs.y, ey, t);
      pts.push(this.w(px2, py2, map ? Math.min(z, map.groundAt(px2, py2, 0, z, HEIGHTS.step)) : z));
    }
    const color = o.color || '#ffe080', alpha = o.alpha === undefined ? .3 : o.alpha;
    this.decal(g => px.polyDither(g, pts, color, alpha, this.ix, this.iy));
  }
  /** an objective marker over a world point: a bobbing diamond (and its label) while it is on screen, an arrow at the
   *  screen's edge pointing to it while it is off (offscreen: false hides it then). o: { label, color: '#ffd040', offscreen: 'arrow' } */
  marker(x, y, z = 0, o = {}) {
    const [sx, sy] = this.w(x, y, z), color = o.color || '#ffd040', dark = shade(color, -.6), W = this.W, H = this.H, m = 9, bob = this.game.reduceMotion ? 0 : Math.sin(this.game.real * 4) * 1.5;
    this.overlay(g => {
      if (sx >= m && sx <= W - m && sy >= m + 14 && sy <= H - m) {
        const cx = Math.round(sx), cy = Math.round(sy - 14 + bob);
        px.poly(g, [[cx, cy - 5], [cx + 4, cy], [cx, cy + 5], [cx - 4, cy]], dark); px.poly(g, [[cx, cy - 4], [cx + 3, cy], [cx, cy + 4], [cx - 3, cy]], color);
        if (o.label) E.font.text(g, o.label, cx, cy - 13, color, { align: 'center', font: 'tiny', shadow: '#000', outline: false });
      } else if (o.offscreen !== false) {
        const mx = W / 2, my = H / 2, a = Math.atan2(sy - my, sx - mx), k = Math.min((W / 2 - m) / Math.max(1e-6, Math.abs(Math.cos(a))), (H / 2 - m) / Math.max(1e-6, Math.abs(Math.sin(a))));
        const ax = Math.round(mx + Math.cos(a) * k), ay = Math.round(my + Math.sin(a) * k), c = Math.cos(a), s = Math.sin(a), tip = [ax + c * 5, ay + s * 5];
        px.poly(g, [[tip[0] + c, tip[1] + s], [ax - s * 5 - c * 2, ay + c * 5 - s * 2], [ax + s * 5 - c * 2, ay - c * 5 - s * 2]], dark);
        px.poly(g, [tip, [ax - s * 4 - c, ay + c * 4 - s], [ax + s * 4 - c, ay - c * 4 - s]], color);
        if (o.label) E.font.text(g, o.label, clamp(ax - c * 10, 14, W - 14), clamp(ay - s * 10 - 3, 2, H - 8), color, { align: 'center', font: 'tiny', shadow: '#000', outline: false });
      }
    });
  }

  _stamp(key, make) {
    const m = this._stamps || (this._stamps = new Map());
    let st = m.get(key); if (st) return st;
    if (m.size > 400) m.clear();
    st = make(); m.set(key, st); return st;
  }
  /** soft contact shadow under a character: a cached dithered ellipse, correct for the current view.
   *  z = height of the surface it falls on (0 = floor; the top of a block or platform otherwise) */
  shadow(x, y, rad, alpha = .5, color = '#0c0818', z = 0) {
    (z > .5 ? f => this.queue(x, y, z - .01, f, { noInfo: true, bias: -.001 }) : f => this.decal(f))(() => {
      const v = this.view, R = Math.round(rad * 2) / 2, A = Math.round(alpha * 20) / 20, st2 = E.style.trans;
      const st = this._stamp('s' + v.id + v.pitchDeg + v.yawDeg + v.scale + ':' + R + ':' + A + color + st2, () => {
        const pts = []; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (let i = 0; i < 18; i++) { const a = i / 18 * TAU, q = v.p(Math.cos(a) * R, Math.sin(a) * R, 0); pts.push(q); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
        const ox = Math.floor(x0) - 1, oy = Math.floor(y0) - 1, c = mkCanvas(Math.ceil(x1) - ox + 2, Math.ceil(y1) - oy + 2), g = ctx2d(c);
        px.polyDither(g, pts.map(q => [q[0] - ox, q[1] - oy]), color, A, 0, 0);
        return { c, ox, oy };
      });
      const [sx, sy] = this.w(x, y, z); (z > .5 ? this.ctx : this.tgt).drawImage(st.c, Math.round(sx) + st.ox, Math.round(sy) + st.oy);
    });
  }
  /**
   * Queue a pixel sprite (from E.sprite) standing at world point (x, y, z). Depth sorted like an actor.
   * opts: { flip, anchor: 'bottom' (feet on the point, default; E.shapeSprite's: its own feet) | 'center' | 'top', glow: 0..1,
   *         bias, flash, outline, alpha, xray, ghost }  (the last five use the actor path)
   */
  sprite(x, y, z, spr, o = {}) {
    if (!spr || !spr.isSprite) { warn('r.sprite', 'r.sprite(x, y, z, spr) needs a sprite made with E.sprite(rows, colors)'); return; }
    if (this.view.zoom && this.view.zoom !== 1) spr = scaleSprite(spr, this.view.zoom);   // camera zoom: whole-pixel nearest-neighbour copy
    const flip = !!o.flip, gl = o.glow || 0, ft = o.anchor === undefined && spr.foot;   // (a shape's sprite stands on its feet)
    const ax = ft ? (flip ? spr.w - ft[0] : ft[0]) : Math.floor(spr.w / 2), ay = ft ? ft[1] : o.anchor === 'center' ? Math.floor(spr.h / 2) : o.anchor === 'top' ? 0 : spr.h;
    if (o.flash || o.outline || o.xray || o.ghost || (o.alpha !== undefined && o.alpha < 1)) {
      this.actor(x, y, z, (g, ox, oy) => { if (gl) px.glow(g, gl); px.sprite(g, spr, ox - ax, oy - ay, flip); }, Object.assign({ outline: false, rim: false, emissive: gl }, o));
      return;
    }
    if (!this.visible(x, y, z, spr.w + 8, spr.h + 8, spr.h + 8)) return;
    this.queue(x, y, z, g => { if (gl) px.glow(g, gl); const [sx, sy] = this.w(x, y, z); px.sprite(g, spr, Math.round(sx) - ax, Math.round(sy) - ay, flip); }, { bias: o.bias, emissive: gl > .4, hides: o.hides, footprint: o.footprint });
  }
  /**
   * set dressing from E.prop: r.prop('torch', x, y, z, { size, color, flip, light: true, halo: true, bias, hides, footprint })
   * feet on the world point; flames animate and glow. light: true also adds a warm light to game.lights.
   * A prop drawn in front of an x-ray actor (a pillar, a statue, a brazier) shows the actor's silhouette through it;
   * hides: false opts a prop out.
   */
  prop(name, x, y, z, o = {}) {
    const zm = this.view.zoom || 1, p = E.prop(name, zm !== 1 ? Object.assign({}, o, { size: (o.size || 1) * zm }) : o); if (!p) return;
    const spr = p.frames[0], ax = Math.floor(spr.w / 2), ay = o.anchor === 'top' ? 0 : spr.h, flip = !!o.flip, t = this.game.real;
    if (!this.visible(x, y, z, spr.w + 20, spr.h + 20, spr.h + 20)) return;
    const gf = p.glow ? p.glow[Math.floor((t * 9 + x * .37) % p.glow.length)] : null;
    const at = () => { const [sx, sy] = this.w(x, y, z); return [Math.round(sx) - ax, Math.round(sy) - ay]; };
    const [bX, bY] = at();
    this.queue(x, y, z, g => { const [X, Y] = at(); if (p.emissive) px.glow(g, .8); px.sprite(g, spr, X, Y, flip); }, { bias: o.bias, hides: o.hides !== false, box: [bX, bY, bX + spr.w, bY + spr.h], footprint: o.footprint });
    if (p.glowAt && o.halo !== false) this.queue(x, y, z, g => {   // lamps, lanterns and crystals glow even with lighting off; cone: true adds a light cone below
      if (g._info) return;
      const [X, Y] = at(), gx = X + spr.w * p.glowAt[0], gy = Y + spr.h * p.glowAt[1], R = o.haloR || Math.max(6, spr.w * .9), c = o.haloColor || p.glowAt[2];
      if (o.cone) px.blend(g, .14, 'add', () => px.poly(g, [[gx - spr.w * .25, gy], [gx + spr.w * .25, gy], [gx + R * 1.3, Y + spr.h], [gx - R * 1.3, Y + spr.h]], c));
      this.glowDisc(g, gx, gy, R, c, .2); this.glowDisc(g, gx, gy, R * .5, c, .3);
    }, { bias: (o.bias || 0) + .001, emissive: true });
    if (gf) this.queue(x, y, z, g => {   // flames: their own item, emissive so lighting never dims them
      const [X, Y] = at(); px.glow(g, 1); px.sprite(g, gf, X, Y, flip);
      if (o.halo !== false && !g._info) this.glowDisc(g, X + (flip ? spr.w - gf.mx : gf.mx), Y + gf.my, o.haloR || Math.max(3, Math.min(10, spr.w * .45)), o.haloColor || '#ffb040', .16);
    }, { bias: (o.bias || 0) + .001, emissive: true });
    if (o.light && p.light) this.game.lights.add(x, y, z + spr.h * .7 / Math.max(.1, this.view.scale), o.lightRadius || 70, o.lightIntensity || 1, { color: o.lightColor || p.light, shadow: !!o.shadow });
  }
  /** background of dithered color bands, top to bottom: r.sky(['#0b1030', '#3b2d6b', '#e0806a']). Call first in draw. */
  sky(colors, o = {}) {
    if (typeof colors === 'string') colors = [colors];
    const W = this.bw, H = this.bh, smooth = (o.style || (E.style.trans === 'dither' ? 'dither' : 'smooth')) === 'smooth', key = 'sky' + colors.join() + W + 'x' + H + (o.bands || 0) + smooth;
    const st = this._stamp(key, () => {
      const c = mkCanvas(W, H), g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data, cs = colors.map(hex), n = cs.length, steps = o.bands || 0;
      for (let y = 0; y < H; y++) {
        let f = n < 2 ? 0 : y / Math.max(1, H - 1) * (n - 1); if (steps) f = Math.round(f * steps) / steps;
        const i = Math.min(n - 2, Math.max(0, Math.floor(f))), t = f - i;
        // smooth: a 15-bit color gradient (PS1 style bands of one row); dither: ordered dither between stops
        const sm = n < 2 ? cs[0] : cs[i].map((v, j) => (Math.round(lerp(v, cs[i + 1][j], t) / 8) * 8));
        for (let x = 0; x < W; x++) {
          const col = smooth ? sm : n < 2 ? cs[0] : (t > bayer(x, y) ? cs[i + 1] : cs[i]), k = (y * W + x) * 4;
          d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; d[k + 3] = 255;
        }
      }
      g.putImageData(img, 0, 0); return c;
    });
    this.ctx.drawImage(st, 0, 0);
  }
  /** scrolling star dots for space and night skies. opts: { count: 70, speed: 30 px/s, dir: 'down' | 'up' | 'left' | 'right', colors, layers: 3, seed } */
  starfield(o = {}) {
    const g = this.ctx, W = this.bw, H = this.bh, t = this.game.time, n = o.count || 70, sp = o.speed === undefined ? 30 : o.speed;
    const cols = o.colors || ['#ffffff', '#a9b8ff', '#5d6aa0'], layers = o.layers || 3, seed = o.seed || 7, dir = o.dir || 'down', maxY = o.height ? H * o.height : H;
    for (let i = 0; i < n; i++) {
      const L = i % layers, k = 1 - L / (layers + .5), d = t * sp * k;
      let x = hash2(i, seed) * W, y = hash2(i + 7919, seed) * maxY;
      if (dir === 'down') y += d; else if (dir === 'up') y -= d; else if (dir === 'left') x -= d; else x += d;
      x = ((x % W) + W) % W; y = ((y % maxY) + maxY) % maxY;
      const c = cols[Math.min(cols.length - 1, L)];
      px.dot(g, x, y, c);
      if (L === 0 && hash2(i, seed + 1) > .75) { if (dir === 'down' || dir === 'up') px.dot(g, x, y + (dir === 'down' ? -1 : 1), c); else px.dot(g, x + (dir === 'left' ? 1 : -1), y, c); }
    }
  }
  /** HUD text in screen pixels, drawn on top and never lit: r.text('SCORE 120', 4, 4, '#fff', { align, scale, outline }) */
  text(str, x, y, color = '#ffffff', o) { this.overlay(g => E.font.text(g, str, x, y, color, o)); }
  /** text floating at a world point (names, prompts): r.textAt(x, y, z, 'OPEN', '#ffe08a') */
  textAt(x, y, z, str, color = '#ffffff', o = {}) { this.overlay(g => { const [sx, sy] = this.w(x, y, z); E.font.text(g, str, sx, sy, color, Object.assign({ align: 'center' }, o)); }); }
  /** 4x4 dithered black pattern covering `level` (0..1) of the pixels, for fades */
  _fadePattern(level) {
    const q = Math.round(clamp(level, 0, 1) * 16);
    return this._stamp('fade' + q, () => { const c = mkCanvas(4, 4), g = c.getContext('2d'); g.fillStyle = '#000'; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (bayer(x, y) < q / 16) g.fillRect(x, y, 1, 1); return c; });
  }
  /** glow halo from a cache: additive light rings (alpha style) or a dithered disc (dither style). a = 0..1 strength */
  glowDisc(g, cx, cy, rad, color, a) {
    if (g._info) return px.ddisc(g, cx, cy, rad, color, a, 0, 0);
    if (g._cover) return px.disc(g, cx, cy, rad * .7, '#fff');   // (the glow cut mask: its bright core is in front)
    const R = Math.round(rad * 2) / 2, A = Math.round(a * 20) / 20, n = Math.ceil(R) + 1, al = E.style.trans !== 'dither';
    const st = this._stamp('d' + R + ':' + A + color + al, () => { const c = mkCanvas(n * 2 + 1, n * 2 + 1), cg = ctx2d(c); px.ddisc(cg, n, n, R, color, al ? Math.min(1, A * 1.6) : A, 0, 0); return c; });
    if (al) px.blend(g, 1, 'add', () => g.drawImage(st, Math.round(cx) - n, Math.round(cy) - n));
    else g.drawImage(st, Math.round(cx) - n, Math.round(cy) - n);
  }
  /** extruded box prop (crate, pedestal, table). Call inside a queue fn with its g. */
  box(g, x0, y0, z0, x1, y1, z1, top, side) {
    if (typeof top !== 'string' || typeof side !== 'string') { warn('box:args', 'r.box(g, x0, y0, z0, x1, y1, z1, topColor, sideColor) needs 9 arguments: both corners in x, y, z, then two hex colors'); top = typeof top === 'string' ? top : '#ff00ff'; side = typeof side === 'string' ? side : top; }
    const view = this.view, P = (x, y, z) => this.w(x, y, z), inf = g._info, prev = g._mat;
    if (!view.isTop) {
      for (const [nx, ny, A, B] of [[0, -1, [x1, y0], [x0, y0]], [0, 1, [x0, y1], [x1, y1]], [-1, 0, [x0, y0], [x0, y1]], [1, 0, [x1, y1], [x1, y0]]]) {
        if (nx * view.fx + ny * view.fy <= .02) continue;
        if (inf) { g._mat = this._faceMat(g, A, B, z0, z1, faceClass(nx, ny)); g._c = null; }
        const lit = .6 * nx + .8 * ny, col = lit < -.2 ? shade(side, .12) : lit > .5 ? shade(side, -.25) : side;
        px.poly(g, [P(A[0], A[1], z0), P(B[0], B[1], z0), P(B[0], B[1], z1), P(A[0], A[1], z1)], col);
      }
    }
    if (inf) { g._mat = this._infoCol(z1, 4, 0); g._c = null; }
    px.poly(g, [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], top);
    if (inf) { g._mat = prev; g._c = null; }
  }
  /* ---- GPU info encoding: R = height * 3, G = surface class * 20, B = glow * 255 ---- */
  _infoCol(z, cls, e) { return 'rgb(' + clamp(Math.round(z * 3), 0, 255) + ',' + cls * 20 + ',' + clamp(Math.round(e * 255), 0, 255) + ')'; }
  _infoVert(g, x, y, z, cls, e, oy) {
    const v = this.view, span = Math.max(1, Math.min(50, 85 - z));
    if (e > 0 || Math.abs(v.bz) < .05) return this._infoCol(z, cls, e);
    const sy = oy !== undefined ? oy : this.w(x, y, z)[1], gr = g.createLinearGradient(0, sy, 0, sy + v.bz * span);
    gr.addColorStop(0, this._infoCol(z, cls, 0)); gr.addColorStop(1, this._infoCol(z + span, cls, 0));
    return gr;
  }
  /** height gradient across a vertical face whose bottom edge runs A -> B (ground points) */
  _faceMat(g, A, B, z0, z1, cls) {
    const P0 = this.w(A[0], A[1], z0), P1 = this.w(B[0], B[1], z0), Ex = P1[0] - P0[0], Ey = P1[1] - P0[1], c = Ex * this.view.bz;
    if (Math.abs(c) < 1e-6) return this._infoCol(z0, cls, 0);
    const nx = -Ey, ny = Ex, k = (z1 - z0) * c / (nx * nx + ny * ny), gr = g.createLinearGradient(P0[0], P0[1], P0[0] + nx * k, P0[1] + ny * k);
    gr.addColorStop(0, this._infoCol(z0, cls, 0)); gr.addColorStop(1, this._infoCol(z1, cls, 0));
    return gr;
  }
  _actorInfo(gI, x, y, z, o) {
    const [sx, sy] = this.w(x, y, z), bx = Math.round(sx) - AOX, by = Math.round(sy) - AOY;
    const R = this._R; if (!R[2]) return;
    this._tint(this._mG, this._aCv, this._infoVert(this._mG, 0, 0, z, 10, o.emissive || 0, AOY), R);
    gI.drawImage(this._mCv, R[0], R[1], R[2], R[3], bx + R[0], by + R[1], R[2], R[3]);
  }
  /** is a world point near the visible area? margins in pixels (characters extend upward from their feet) */
  visible(x, y, z = 0, mx = 60, up = 30, down = 90) { const [sx, sy] = this.w(x, y, z); return sx > -mx && sx < this.bw + mx && sy > -up && sy < this.bh + down; }
  /**
   * Queue a character. drawFn(g, ox, oy) must draw with (ox, oy) as the projected
   * position of world point (x, y, z). The engine adds outline, rim light, hit flash,
   * afterimages and x-ray silhouettes.
   * opts: {outline=true, rim=true, flash=false, alpha=1, xray=false, ghost:{color, life, alpha, owner}, hides, bias, every, key}
   * - xray: true shows a checkered silhouette wherever a wall (or a prop, or anything queued with hides) is drawn in
   *     front of the actor; xray: { color, outline, actors } picks the fill color, adds a solid 1-px outline in that
   *     color around the hidden part (reads through busy pillars and dark walls), and with actors: true other bodies
   *     drawn in front hide it too (a hero lost in a crowd keeps his shape)
   * - hides: true: this actor counts as an x-ray occluder even when no x-ray actor asked for actors
   * - ghost: ghost.owner (any {x, y, z}, usually the actor itself) keeps its afterimages sorted behind the live body
   * - every, key: every: n, key (any object, the character's own): its finished image is drawn again for n - 1 frames
   *     before drawFn runs again, at the place it is now (a background character animating at a lower rate, as classic
   *     games' townsfolk do: a phone's frame keeps the time for the ones that matter); not while it flashes, with a
   *     ghost, x-ray or GPU lighting
   */
  actor(x, y, z, drawFn, o = {}) {
    const st = this.game.stats;
    if (!this.visible(x, y, z, o.margin || 60)) { st.culled++; return; }
    st.actors++;
    // fast path: nothing needs the offscreen composite, so draw straight into the frame
    if (o.outline === false && !o.flash && !o.ghost && !o.xray && (o.rim === false || this.gpu) && (o.alpha === undefined || o.alpha >= 1)) {
      const info = o.emissive ? gI => { gI._mat = this._infoCol(z, 10, o.emissive); gI._c = null; const [a, b] = this.w(x, y, z); drawFn(gI, Math.round(a), Math.round(b)); } : undefined;
      this.queue(x, y, z, g => { const [a, b] = this.w(x, y, z); drawFn(g, Math.round(a), Math.round(b)); }, { bias: o.bias, info, solid: true, actor: true, hides: o.hides });
      return;
    }
    this.queue(x, y, z, g => this._composite(g, x, y, z, drawFn, o), { bias: o.bias, xray: o.xray, info: gI => this._actorInfo(gI, x, y, z, o), solid: o.alpha === undefined || o.alpha > .5, actor: !o.xray, hides: o.hides });
  }
  _tint(dst, src, color, R = [0, 0, AS, AS]) {
    const [x0, y0, w, h] = R;
    dst.globalCompositeOperation = 'source-over'; dst.clearRect(x0, y0, w, h); dst.drawImage(src, x0, y0, w, h, x0, y0, w, h);
    dst.globalCompositeOperation = 'source-in'; dst.fillStyle = color; dst._c = null; dst.fillRect(x0, y0, w, h);
    dst.globalCompositeOperation = 'source-over';
  }
  _composite(g, x, y, z, drawFn, o) {
    const keep = o.every > 1 && o.key && g === this.ctx && !this.gpu && !o.flash && !o.ghost && !o.xray ? this._kept || (this._kept = new WeakMap()) : null;
    let K = keep && keep.get(o.key);
    if (K && this._frameNo - K.n < o.every) {   // its kept image, where it stands now
      const [sx, sy] = this.w(x, y, z); g.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
      g.drawImage(K.cv, 0, 0, K.w, K.h, Math.round(sx) - AOX + K.x0, Math.round(sy) - AOY + K.y0, K.w, K.h); g.globalAlpha = 1; this._comp = null; return;
    }
    const aG = this._aG, bb = this._bb, P = this._R;
    aG.clearRect(P[0], P[1], P[2], P[3]); aG._c = null;
    bb[0] = AS; bb[1] = AS; bb[2] = 0; bb[3] = 0;
    drawFn(aG, AOX, AOY);
    const x0 = Math.max(0, Math.floor(bb[0]) - 2), y0 = Math.max(0, Math.floor(bb[1]) - 2), x1 = Math.min(AS, Math.ceil(bb[2]) + 2), y1 = Math.min(AS, Math.ceil(bb[3]) + 2);
    if (x1 <= x0 || y1 <= y0) { this._R = [0, 0, 0, 0]; return; }
    const R = this._R = [x0, y0, x1 - x0, y1 - y0], w = R[2], h = R[3];
    const [sx, sy] = this.w(x, y, z), bx = Math.round(sx) - AOX, by = Math.round(sy) - AOY, al = o.alpha === undefined ? 1 : o.alpha;
    if (g === this.ctx) this._comp = { x0, y0, w, h, bx, by, ol: o.outline !== false };
    let T = g, tx = bx, ty = by, ta = al;   // where the layers go: the frame, or the kept image (a pixel of margin for the outline), drawn into it after
    if (keep) {
      if (!K) keep.set(o.key, K = { cv: mkCanvas(8, 8) });
      if (!K.g || K.cv.width < w + 2 || K.cv.height < h + 2) { K.cv.width = Math.max(K.cv.width, w + 2); K.cv.height = Math.max(K.cv.height, h + 2); K.g = ctx2d(K.cv); }
      Object.assign(K, { n: this._frameNo, w: w + 2, h: h + 2, x0: x0 - 1, y0: y0 - 1 }); K.g.clearRect(0, 0, K.w, K.h);
      T = K.g; tx = 1 - x0; ty = 1 - y0; ta = 1;
    }
    const put = (cv, dx, dy) => T.drawImage(cv, x0, y0, w, h, tx + x0 + dx, ty + y0 + dy, w, h);
    T.globalAlpha = ta;
    if (o.outline !== false) { this._tint(this._mG, this._aCv, o.outlineColor || this.outline, R); for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) put(this._mCv, dx, dy); }
    if (o.flash) {   // palette flash: the tint over the sprite, so its shading still shows (flashMix: 1 = solid)
      const fm = o.flashMix === undefined ? .5 : o.flashMix;
      if (fm < 1) put(this._aCv, 0, 0);
      this._tint(this._mG, this._aCv, typeof o.flash === 'string' ? o.flash : '#fff6ea', R); g.globalAlpha = al * fm; put(this._mCv, 0, 0);
    } else {
      put(this._aCv, 0, 0);
      if (o.rim !== false && !this.gpu) {
        const rG = this._rG; rG.globalCompositeOperation = 'source-over'; rG.clearRect(x0, y0, w, h); rG.drawImage(this._aCv, x0, y0, w, h, x0, y0, w, h);
        rG.globalCompositeOperation = 'destination-out'; rG.drawImage(this._aCv, x0, y0, w, h, x0 - 1, y0, w, h);
        rG.globalCompositeOperation = 'source-in'; rG.fillStyle = o.rimColor || this.rim; rG._c = null; rG.fillRect(x0, y0, w, h); rG.globalCompositeOperation = 'source-over';
        T.globalAlpha = ta * this.rimAlpha; put(this._rCv, 0, 0);
      }
    }
    T.globalAlpha = 1;
    if (keep) { g.globalAlpha = al; g.drawImage(K.cv, 0, 0, K.w, K.h, bx + K.x0, by + K.y0, K.w, K.h); g.globalAlpha = 1; }
    if (o.ghost) {
      const gp = this._ghostPool[this._ghostIdx++ % this._ghostPool.length];
      gp.g.clearRect(0, 0, AS, AS); this._tint(gp.g, this._aCv, o.ghost.color || '#62d8ff', R);
      this._ghosts = this._ghosts.filter(q => q.gp !== gp);
      this._ghosts.push({ gp, x, y, z, t: this.game.time, life: o.ghost.life || .22, alpha: o.ghost.alpha === undefined ? .5 : o.ghost.alpha, owner: o.ghost.owner || null });
    }
    if (o.xray) {
      const X = o.xray === true ? null : o.xray;
      this._tint(this._mG, this._aCv, X && X.color || this.xrayColor, R); this._xG.drawImage(this._mCv, x0, y0, w, h, bx + x0, by + y0, w, h); this._xrayUsed = true;
      const B = this._xrB || (this._xrB = [1e9, 1e9, -1e9, -1e9]); B[0] = Math.min(B[0], bx + x0 - 2); B[1] = Math.min(B[1], by + y0 - 2); B[2] = Math.max(B[2], bx + x0 + w + 2); B[3] = Math.max(B[3], by + y0 + h + 2);   // where silhouettes are: occluders elsewhere need not join the mask
      if (X && X.outline) {   // the ring just outside the silhouette: four shifted copies, less the silhouette itself
        const xo = this._xoG; this._tint(this._mG, this._aCv, X.outline, R);
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) xo.drawImage(this._mCv, x0, y0, w, h, bx + x0 + dx, by + y0 + dy, w, h);
        xo.globalCompositeOperation = 'destination-out'; xo.drawImage(this._aCv, x0, y0, w, h, bx + x0, by + y0, w, h); xo.globalCompositeOperation = 'source-over';
        this._xrayOl = true;
      }
    }
  }
  /** add a solid item's shape to the cut mask: a body from its composite (with its outline), a wall by drawing it again */
  _emCut(eG, it) {
    const c = this._comp;
    if (c) { const cut = (dx, dy) => eG.drawImage(this._aCv, c.x0, c.y0, c.w, c.h, c.bx + c.x0 + dx, c.by + c.y0 + dy, c.w, c.h); cut(0, 0); if (c.ol) { cut(-1, 0); cut(1, 0); cut(0, -1); cut(0, 1); } }
    else if (it.occ) { this._tg = eG; try { it.fn(eG); } finally { this._tg = null; } eG.globalAlpha = 1; }
    else {   // anything else solid (a body drawn straight into the frame): drawn again on a scratch layer, in a body-sized box
      const [sx, sy] = this.w(it.x, it.y, it.z), x0 = Math.max(0, Math.round(sx) - AOX), y0 = Math.max(0, Math.round(sy) - AOY), w = Math.min(this.bw, x0 + AS) - x0, h = Math.min(this.bh, y0 + AS) - y0;
      if (w > 0 && h > 0) { const sG = this._sG; sG.globalCompositeOperation = 'source-over'; sG.globalAlpha = 1; sG.clearRect(x0, y0, w, h); sG._c = null; this._tg = sG; try { it.fn(sG); } finally { this._tg = null; } eG.drawImage(this._sCv, x0, y0, w, h, x0, y0, w, h); }
    }
    eG.globalAlpha = 1; eG._c = null;
  }
  /** afterimages sort just behind their own spot; with ghost.owner (any {x, y, z}: the actor itself) a ghost left nearer
   *  the camera than where its owner is now (running or rolling away from the camera) sorts behind the owner instead,
   *  so a trail never covers the live body with a blob of tinted copies */
  _drawGhosts() {
    const t = this.game.time, v = this.game.view;
    this._ghosts = this._ghosts.filter(q => t - q.t < q.life);
    for (const q of this._ghosts) {
      const w = q.owner, ahead = w && v.order(q.x, q.y, q.z) > v.order(w.x, w.y, w.z || 0) - .05, at = ahead ? [w.x, w.y, w.z || 0] : [q.x, q.y, q.z];
      this.queue(at[0], at[1], at[2], g => {
        const [sx, sy] = this.w(q.x, q.y, q.z);
        g.globalAlpha = q.alpha * (1 - (t - q.t) / q.life); g.drawImage(q.gp.cv, Math.round(sx) - AOX, Math.round(sy) - AOY); g.globalAlpha = 1;
      }, { bias: -.05, noInfo: true });
    }
  }
  /** sort the queue by depth and draw it (finish() calls it) */
  _flush() {
    const g = this.ctx, items = this._items;
    this.game.stats.items = items.length;
    items.sort((a, b) => a.k - b.k);
    const pb = this._xrPrev; if (pb) { this._xG.clearRect(pb[0], pb[1], pb[2] - pb[0], pb[3] - pb[1]); this._xoG.clearRect(pb[0], pb[1], pb[2] - pb[0], pb[3] - pb[1]); this._xrPrev = null; }   // (the x-ray layers only ever hold the silhouettes' box)
    this._oG.clearRect(0, 0, this.bw, this.bh); this._oG._c = null;
    let xr = false, xa = false, xRe = 0;   // an x-ray actor has been drawn (walls and hiding things after it cover it); one asked for bodies too
    this._xrB = null;
    const xOver = (x0, y0, x1, y1) => { const B = this._xrB; return !!B && x1 > B[0] && x0 < B[2] && y1 > B[1] && y0 < B[3]; };
    const gpu = this.gpu, iG = this._iG;
    // canvas lighting draws the glows again after the darkness (so it never dims them). The cut mask K keeps that redraw
    // behind what stands in front: in depth order, a wall or a body drawn after a glow adds its shape to K, and a glow
    // drawn later still (in front of that) takes its whole footprint back out. finish() then restores K's lit pixels
    // (a coarse grid of where glows have been drawn so far lets the walls and bodies nowhere near one skip the mask)
    const em = this.glowMask !== false && !gpu && this.game.lights.enabled && this._emis.length > 0, eG = this._eG;   // (r.glowMask = false: glows over everything, cheaper)
    let eOn = false, kOn = false, eg = null, gw = 0;
    if (em) {
      eG.globalCompositeOperation = 'source-over'; eG.globalAlpha = 1; eG.clearRect(0, 0, this.bw, this.bh); eG._c = null;
      gw = (this.bw >> 5) + 1; const n = gw * ((this.bh >> 5) + 1); eg = this._eGrid && this._eGrid.length === n ? this._eGrid.fill(0) : (this._eGrid = new Uint8Array(n));
    }
    const gh = em ? (this.bh >> 5) + 1 : 0, cell = (x0, y0, x1, y1, mark) => {   // screen box -> grid cells: mark them, or test them
      const a = clamp(x0 >> 5, 0, gw - 1), b = clamp(x1 >> 5, 0, gw - 1), c = clamp(y0 >> 5, 0, gh - 1), d = clamp(y1 >> 5, 0, gh - 1);
      for (let y = c; y <= d; y++) for (let x = a; x <= b; x++) { if (mark) eg[y * gw + x] = 1; else if (eg[y * gw + x]) return true; }
      return false;
    };
    for (const it of items) {
      this._comp = null;
      it.fn(g);
      if (em) {
        if (it.em) {
          eOn = true; const [sx, sy] = this.w(it.x, it.y, it.z); cell(sx - 56 | 0, sy - 96 | 0, sx + 56 | 0, sy + 40 | 0, true);
          if (kOn) { eG._cover = true; eG.globalCompositeOperation = 'destination-out'; this._tg = eG; try { it.fn(eG); } finally { this._tg = null; eG._cover = false; eG.globalCompositeOperation = 'source-over'; eG.globalAlpha = 1; eG._c = null; } }
        } else if (eOn && it.solid) {
          const c = this._comp; let hit;
          if (c) hit = cell(c.bx + c.x0, c.by + c.y0, c.bx + c.x0 + c.w, c.by + c.y0 + c.h, false);
          else { const [sx, sy] = this.w(it.x, it.y, it.z), s = this.view.scale || 1; hit = cell(sx - 24 * s | 0, sy - 72 * s | 0, sx + 24 * s | 0, sy + 16 * s | 0, false); }
          if (hit) { this._emCut(eG, it); kOn = true; }
        }
      }
      if (gpu && !it.noInfo) {
        if (it.info) it.info(iG);
        else { iG._mat = this._infoVert(iG, it.x, it.y, it.z, 10, 0); iG._z = it.z; iG._c = null; it.fn(iG); }
      }
      if (it.xray) { xr = true; if (it.xray.actors) xa = true; }
      else if (xr && (it.occ || it.hides || (xa && it.actor))) {   // x-ray occluders go into the mask: walls and props drawn again, bodies from their composite
        const c = this._comp;   // (props and bodies only where they overlap a silhouette: a crowd redrawn in full cost a third of the frame)
        if (it.actor && !it.occ) {
          if (c) { if (xOver(c.bx + c.x0, c.by + c.y0, c.bx + c.x0 + c.w, c.by + c.y0 + c.h)) this._oG.drawImage(this._aCv, c.x0, c.y0, c.w, c.h, c.bx + c.x0, c.by + c.y0, c.w, c.h); }
          else { const [sx, sy] = this.w(it.x, it.y, it.z), s = this.view.scale || 1; if (xRe < 4 && xOver(sx - 12 * s, sy - 30 * s, sx + 12 * s, sy + 4 * s)) { xRe++; this._oG.globalAlpha = 1; it.fn(this._oG); this._oG.globalAlpha = 1; } }   // a body drawn straight to the frame is drawn again: only the few right in front
        } else if (it.box ? xOver(it.box[0], it.box[1], it.box[2], it.box[3]) : !it.occ || (() => { const [sx, sy] = this.w(it.x, it.y, 0), s = this.view.scale || 1; return xOver(sx - 24 * s, sy - 120 * s, sx + 24 * s, sy + 20 * s); })()) { this._oG.globalAlpha = 1; it.fn(this._oG); this._oG.globalAlpha = 1; }   // (a wall block far from every silhouette is skipped: a generous box, a block is 16 wide and rarely 70 tall)
      }
    }
    this._emOn = kOn;
    if (this._xrayUsed && this._xrB) {   // every x-ray pass works inside the silhouettes' box only (full-frame composites cost more than the rest of it)
      const B = this._xrB, x0 = Math.max(0, Math.floor(B[0])), y0 = Math.max(0, Math.floor(B[1])), x1 = Math.min(this.bw, Math.ceil(B[2])), y1 = Math.min(this.bh, Math.ceil(B[3])), w = x1 - x0, h = y1 - y0;
      if (w > 0 && h > 0) {
        this._xrPrev = [x0, y0, x1, y1];
        const xG = this._xG, dst = gpu ? this._vG : g, mask = G => { G.save(); G.beginPath(); G.rect(x0, y0, w, h); G.clip(); G.globalCompositeOperation = 'destination-in'; G.drawImage(this._oCv, x0, y0, w, h, x0, y0, w, h); };
        mask(xG); xG.fillStyle = xG.createPattern(this._checker, 'repeat'); xG._c = null;
        xG.translate((this.ix + this.iy) & 1, 0); xG.fillRect(x0 - 2, y0, w + 2, h); xG.restore(); xG.globalCompositeOperation = 'source-over';
        dst.drawImage(this._xCv, x0, y0, w, h, x0, y0, w, h);
        if (this._xrayOl) { const xo = this._xoG; mask(xo); xo.restore(); xo.globalCompositeOperation = 'source-over'; dst.drawImage(this._xoCv, x0, y0, w, h, x0, y0, w, h); }
      } else this._xrPrev = [0, 0, this.bw, this.bh];
    }
  }
  // the player's zoom while they ask for it (game._zoomTo): the world drawn so far (at the zoom it has, from what is
  // cached) scaled about the camera's focus by k, under the HUD, nearest pixels; the edges a zoom out uncovers are the
  // background. Once they stop, the frame is drawn at the new size
  _zoomPreview(k) {
    const c = this.game.cam, f = this.w(c.tx, c.ty, c.tz), fx = clamp(f[0], 0, this.bw), fy = clamp(f[1], 0, this.bh);
    const t = this._pvCv || (this._pvCv = mkCanvas(this.bw, this.bh)), tg = ctx2d(t);
    if (t.width !== this.bw || t.height !== this.bh) { t.width = this.bw; t.height = this.bh; }
    for (const g of this.gpu ? [this.ctx, this._iG] : [this.ctx]) {
      tg.clearRect(0, 0, t.width, t.height); tg.drawImage(g.canvas, 0, 0);
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.imageSmoothingEnabled = false;
      if (g === this.ctx && this.game.screen.clear) g.clearRect(0, 0, this.bw, this.bh);
      else { g.fillStyle = g === this.ctx ? this.game.o.bg : '#000'; g.fillRect(0, 0, this.bw, this.bh); }
      g.setTransform(k, 0, 0, k, fx * (1 - k), fy * (1 - k)); g.drawImage(t, 0, 0); g.restore(); g._c = null;
    }
  }
  /** end the frame: particles, decals, the queue, lighting, overlays, then present (the game calls it after your
   *  draw) */
  _finish() {
    const game = this.game, g = this.ctx, gpu = this.gpu, iG = this._iG;
    game.particles.draw(this); this._drawGhosts();
    for (const d of this._decals) {
      this._tg = null; d.fn(g);
      if (gpu && d.e > 0) { iG._mat = this._infoCol(0, 2, d.e); iG._c = null; this._tg = iG; d.fn(iG); }
    }
    this._tg = null;
    this._flush();
    if (gpu) {
      if (game._zoomTo) this._zoomPreview(game._zoomTo / game.zoom);   // (the lights stay where they were until it is drawn at the new size)
      this._tg = this._vG; for (const f of this._overlays) f(this._vG); this._tg = null;
      try { game.gpu._render(this); } catch (e) { game.gpu._fail(e); game.screen._present(); }
    } else {
      if (game.lights.enabled) {
        game.lights.render(this);
        if (this._emis.length) {
          const sG = this._sG, cv = g.canvas;
          if (this._emOn) { sG.globalCompositeOperation = 'source-over'; sG.globalAlpha = 1; sG.clearRect(0, 0, this.bw, this.bh); sG.drawImage(cv, 0, 0); sG.globalCompositeOperation = 'destination-in'; sG.drawImage(this._eCv, 0, 0); sG.globalCompositeOperation = 'source-over'; }
          this._emis.sort((a, b) => a.k - b.k); for (const it of this._emis) it.fn(g);
          if (this._emOn) g.drawImage(this._sCv, 0, 0);   // walls and bodies in front of a glow keep their lit pixels
        }
      }
      if (game._zoomTo) this._zoomPreview(game._zoomTo / game.zoom);
      for (const f of this._overlays) f(g);
      game.screen._present();
    }
  }
}

/* =============================================================================
 * 10. GAME  loop, clock, camera, hit-stop, shake, slow motion
 * ============================================================================= */
/** on-screen error box: the fastest way for a person (or model) to see why a game broke */
let _errBox = null;
/* the boot screen's state (section 10c): an error before play starts turns it into a report instead of the red box */
const BOOT = { el: null, game: null, played: false, failed: false, lines: [] };
/** show an error in the red box at the top of the page (the engine does it for errors in update and draw); a click
 *  hides it. Before play has started it shows on the boot screen instead, as a report a player can screenshot */
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
  /**
   * new E.Game({ canvas, view, views, res, expand, input, bg, step: 1 / 120, loop: true, headless: false, menu,
   * fullscreen: 'tap', corner: true, backGesture: true, autoPause: true, id, pace, camera }). The standard features
   * (section 10b) every game gets: menu, fullscreen, corner, backGesture, autoPause.
   * - res: a fixed resolution ('ps1' or [w, h]), whole pixels
   * - expand: true makes res the least the screen shows and grows the picture to fill the window, any shape, no bars
   *   (expand: { maxW, maxH } stops it growing there)
   * - bg: the color behind everything, or null: the canvas is clear, and the game draws its HUD and menus over a picture
   *   under it (a 3D world, engine/my-3d2dge-3d.js)
   * - headless: no screen, renderer, sound or DOM input (tests, tools, a simulation in Node, where it is the default):
   *   scenes update and draw is skipped; drive it with advance() and input.press / release / tap / hold
   * - loop: false makes a game in a page that runs only by advance()
   * - menu: the pause, settings and controls screens ({ items, settings, controls, quit } adjusts them, false leaves them out)
   * - fullscreen: 'tap' (a phone goes full screen at its first tap and when a game starts, unless the player turned it
   *   off), 'button' (only when asked) or false
   * - corner, backGesture: corner: the menu and full-screen buttons (top right; top left on a touch screen); backGesture: a
   *   phone's back steps back in the game first (false: it leaves the page)
   * - autoPause: a pausable scene pauses when the page is hidden or loses focus
   * - id: the name the player's settings are saved under (the page's path)
   * - pace: false draws every refresh of a fast display even when the frames can't keep up (by default it draws every
   *   other one, evenly), unless the player picks Frame rate 60
   * - camera: the camera of every scene without its own (a scene's camera option: the player's zoom, start)
   */
  constructor(o = {}) {
    o = Object.assign({}, o);
    /** true for a game with no display (o.headless, or no DOM: Node) */
    this.headless = !!o.headless || typeof document === 'undefined';
    if (this.headless) o.canvas = null;
    else {
      if (typeof o.canvas === 'string') o.canvas = document.getElementById(o.canvas.replace(/^#/, '')) || document.querySelector(o.canvas);
      if (!o.canvas) o.canvas = document.getElementById('screen') || document.querySelector('canvas') || Game._makeCanvas();
    }
    if (typeof o.input === 'string') o.input = Input[o.input.toUpperCase()] || (warn('input:' + o.input, 'unknown input preset "' + o.input + '" (use DEFAULT, PLATFORMER or SHMUP)'), Input.DEFAULT);
    /** o: the options the game was made with, the defaults filled in (view, res, expand, minW, minH, maxW, maxH, bg,
     *  step, input, loop, headless) */
    this.o = Object.assign({ view: 'iso', minH: 190, minW: 300, maxW: 560, maxH: 330, bg: '#07060d', step: 1 / 120, input: Input.DEFAULT, loop: !this.headless }, o);
    // every listener the engine adds to the window, the document, the canvas and its buttons goes through this: dispose() removes them all
    this._abort = typeof AbortController === 'function' ? new AbortController() : null;
    const signal = this._abort ? this._abort.signal : undefined;
    /** screen: the low-resolution screen (its W, H, scale and buffer) */
    this.screen = new Screen(this.o.canvas, this.o, signal);
    /** input: keyboard, mouse, gamepad and touch, read as actions (pressed, down, move, ...) */
    this.input = new Input(this.screen, this.o.input, signal);
    /** view: the view the game draws in now (the chosen one, with zoom and turn: read it, change it with setView);
     *  baseView: the chosen view without zoom and turn */
    this.view = this.baseView = this._view(this.o.view) || E.VIEWS.iso;
    /** zoom: the camera's zoom now (1 = as the view is): the game's (setZoom, a scene's camera.start) times the player's
     *  (settings.zoom: the wheel, a pinch), within the scene's camera.zoom range; yaw: its turn in degrees on top of the
     *  view (rotateView) */
    this.zoom = 1; this.yaw = 0; this._zoomBase = 1; this._zoomTo = null; this._zoomAt = 0; this._wall = 0;   // camera zoom and turn on top of the chosen view (setZoom, rotateView)
    /** views this game is designed for (view cycling and the checker use it). null = every view */
    this.views = this.o.views || null;
    /** time: game seconds since start (it stops during pause and hit-stop, and slows with timeScale); real: seconds
     *  the game has stepped through, pauses and hit-stop included (blinking HUD, notes); hitstop: seconds of
     *  hit-stop left (freeze); timeScale: game speed, 1 normal, .25 slow motion, 0 stopped; reduceMotion: the player
     *  asked for less motion (prefers-reduced-motion): shake and flashes are softened */
    this.time = 0; this.real = 0; this.hitstop = 0; this.timeScale = 1; this._shakeAmt = 0; this.reduceMotion = !this.headless && !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    /** camera. smooth = seconds of lag; bounds(view) = clamp rect; room = [w, h] world units for screen-by-screen
     *  rooms; moving = sliding between rooms; offset = [dx, dy] screen pixels from the screen's centre to where the
     *  focus sits (above a phone's touch buttons: [0, -40]); x, y: the camera's position in projected pixels (its
     *  top-left corner); vx, vy: how fast it is moving there; tx, ty, tz: the world point it is following (focus
     *  sets it); snap: true makes it jump there at the next step instead of gliding (a new level, a teleport) */
    this.cam = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, tz: 0, smooth: .18, bounds: null, snap: true, room: null, moving: false, offset: null };
    /** particles: dust, sparks, debris and text in the world; lights: canvas lighting (lights.enabled, lights.add in
     *  draw); r: the renderer handed to draw(r) (null when headless) */
    this.particles = new Particles(this); this.lights = new Lighting(this); this.r = this.headless ? null : new Renderer(this);
    /** fps: frames drawn per second over the last half second of real time; hz: the display's refresh rate, measured;
     *  drawEvery: 1, or 2 while a fast display (a 120 Hz phone) refreshes quicker than the game can draw (a frame's cost,
     *  or refreshes missed: its GPU behind): every other refresh is drawn, evenly, instead of random ones missed (the
     *  updates still run every refresh). The player's Frame rate setting (game.settings.frameRate: 'auto', '60', 'full')
     *  can fix it at 2 or 1; gpu: the WebGPU lighting after enableGPU(), or null */
    this.fps = 60; this.hz = 60; this.drawEvery = 1; this._viewListeners = []; this.gpu = null;
    /** paused: true while paused (a pausable scene toggles it on 'pause'; steps still run, scenes don't update);
     *  pauseOverlay: false hides the engine's PAUSED overlay (a game drawing its own pause screen); errors: the
     *  errors caught in update and draw, each { where, scene, message, stack }, once per kind */
    this.paused = false; this.pauseOverlay = true; this._timers = []; this.errors = []; this._errKeys = new Set();
    /** the E.Shell over this game (an HTML interface: screens and HUD), or null */
    this.shell = null;
    /** seconds for the dithered fade between scenes (0 = instant cuts) */
    this.fadeTime = .22; this._fade = null;
    /** scenes: the scenes given to start(), by name; scene: the scene running; sceneName: its name ('main' for a
     *  game started with one scene) */
    this.scenes = null; this.scene = null; this.sceneName = null; this._next = null; this._hooks = null;
    /** chip-sound synthesizer: game.audio.sfx('jump'), game.audio.music(song) */
    this.audio = new ChipAudio(this, signal);
    if (this.headless) this.audio.failed = 'a headless game has no sound';
    /** a game's own handle for tools and tests: game.debug = { snapshot() { return {...} }, teleport(x, y, z) {...} }.
     *  tools/check.mjs prints snapshot() and tools/replay.mjs logs it at the end */
    this.debug = null;
    /** per-frame timings (ms) and counts, for profiling overlays. frameMs: the real time since the last frame;
     *  updateMs, renderMs: milliseconds the last frame spent updating and drawing; steps: the updates it ran; items:
     *  what it queued for drawing; actors: actors drawn; culled: actors skipped off screen */
    this.stats = { updateMs: 0, renderMs: 0, frameMs: 16.7, steps: 0, items: 0, actors: 0, culled: 0 };
    /** the fraction of a fixed step (0..1) of real time not yet run: interpolate drawing with it if motion must be smooth
     *  at any refresh rate. The accumulator starts half a step in, so frame times that wobble keep a steady step count */
    this.alpha = .5; this._acc = this.o.step / 2;
    /** the player's choices (game.settings.volume, game.settings.set('volume', .5), your own from menu.settings), saved
     *  and applied (section 10b) */
    this.settings = new Settings(this, (this.o.menu && this.o.menu.settings) || []);
    /** full screen: game.fullscreen.toggle(), .on, .supported */
    this.fullscreen = new FullScreen(this);
    /** why the game paused: 'player' | 'focus' (the page was hidden) | 'controller' (unplugged) | 'menu', or null */
    this.pauseReason = null;
    /** a promise of the game once its boot (start's boot option, section 10c) has run and it has started: await it in a
     *  test whose boot steps return promises */
    this.booted = Promise.resolve(this);
    /** the error a boot step failed with (the game did not start), or null */
    this.bootError = null;
    if (!this.headless) this._standard(signal);
    E.current = this;   // handy for tools and tests: My3D2dge.current is the latest game
  }
  static _makeCanvas() {
    const c = document.createElement('canvas'); c.id = 'screen';
    c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block;image-rendering:pixelated;background:#000;touch-action:none';   // fixed + inset 0 follows a phone's browser bars (100vh does not)
    document.body.style.margin = '0'; document.body.appendChild(c); return c;
  }
  /** internal buffer size in pixels (HUD layout) */
  get W() { return this.screen.W; }
  /** the screen's height in game pixels (W is its width) */
  get H() { return this.screen.H; }
  /** turn on WebGPU lighting (falls back to Canvas lighting automatically). opts: { map, bands, ambient, ... } */
  enableGPU(o = {}) { if (this.headless) return null; this.gpu = new GPULighting(this, o); return this.gpu; }
  _view(v) {
    if (v instanceof View) return v;
    const w = E.VIEWS[v];
    if (!w) warn('view:' + v, 'unknown view "' + v + '". Use one of: ' + Object.keys(E.VIEWS).join(', ') + ', or a new E.View(...)');
    return w || null;
  }
  /** switch the view: an id from E.VIEWS ('iso', 'side', ...) or a View; keeps zoom and turn */
  setView(v) {
    const w = this._view(v); if (!w) return;
    this.baseView = w; this._applyView();
  }
  /**
   * camera zoom on top of the view: game.setZoom(1.5) (.5 .. 3), the game's own; where the scene lets the player zoom
   * (camera.zoom), theirs multiplies it (game.zoom is the two together). Characters, maps, props, particles and lights are
   * drawn by code, so they re-rasterize crisply at the new size; HUD text and overlays stay the same.
   */
  setZoom(z) { this._zoomBase = clamp(+z || 1, .5, 3); this._zoomApply(true); }
  /** turn the camera around the vertical axis in ground views: game.rotateView(45) (degrees). Side views never turn */
  rotateView(deg) { this.yaw = (((this.yaw || 0) + deg) % 360 + 360) % 360; this._applyView(); }
  /** undo setZoom and rotateView: the scene's own zoom again (camera.start, or camera.tall on a screen held upright; 1
   *  without), no turn. The player's zoom stays (settings.zoom) */
  resetCamera() { this.yaw = 0; this._zoomBase = this._zoomStart(); this._zoomApply(true); }
  /**
   * the player zooms the camera by a factor (1.1: 10% closer, .9: farther), as the wheel, - and = and a pinch do (a zoom
   * button of the game's own can): within the scene's camera.zoom range, kept as their setting (settings.zoom, on top of
   * the game's zoom), and noted at the top of the screen ('ZOOM 1.65x': the number a scene's camera.start takes). Does
   * nothing where the scene doesn't let the player zoom. Returns the zoom
   */
  zoomBy(k) {
    const R = this.zoomRange(), b = this._zoomBase; if (!R || !(k > 0) || !this._zoomStd()) return this.zoom;
    const lo = Math.max(ZOOM_PLAYER[0], R[0] / b), hi = Math.min(ZOOM_PLAYER[1], R[1] / b); if (lo > hi) return this.zoom;
    const f = clamp(clamp(+this.settings.zoom || 1, lo, hi) * k, lo, hi); this.settings.set('zoom', f);   // (one carried from a scene with more room starts at this one's end: every step moves it)
    const z = this._zoomTo || this.zoom; this.note('ZOOM ' + z + 'x' + (f <= lo + 1e-9 && k < 1 ? ' MIN' : f >= hi - 1e-9 && k > 1 ? ' MAX' : ''), 1);
    return z;
  }
  /** the zooms the player may take the camera to here, [min, max] (the scene's camera.zoom, or the game's; a function of
   *  the game gives one per screen shape or level), or null where they can't (camera.zoom false or none) */
  zoomRange() {
    let z = (this._camera() || {}).zoom; if (typeof z === 'function') try { z = z(this); } catch (e) { this._fail('camera.zoom', e); z = null; }
    return Array.isArray(z) && z.length === 2 && z[0] > 0 && z[1] >= z[0] ? [clamp(z[0], .5, 3), clamp(z[1], .5, 3)] : null;
  }
  /** true while the game's screen (r.W x r.H) is upright, taller than 1.3 times its width: a phone held upright, with
   *  expand: true (a fixed res keeps its own shape on any phone, so it is never upright there). A scene's camera.tall zoom
   *  applies then: it zooms a tall picture in to fill it */
  get upright() { return this.H > this.W * 1.3; }
  _camera() { const s = this.scene; return (s && s.camera) || this.o.camera || null; }
  _zoomStart() { const c = this._camera(); if (!c) return 1; return clamp(+(this.upright && c.tall !== undefined ? c.tall : c.start) || 1, .5, 3); }
  // the camera's zoom: the game's (_zoomBase), times the player's where the scene allows it, snapped to twentieths (each
  // zoom is a view, its own baked floor, walls and props)
  _zoomGoal() {
    const R = this.zoomRange(), b = this._zoomBase, f = R && this._zoomStd() ? +this.settings.zoom || 1 : 1;
    return f === 1 ? b : clamp(Math.round(b * f * 20) / 20, Math.min(R[0], b), Math.max(R[1], b));
  }
  // the zoom becomes the goal: the game's own at once; the player's (wait) drawn as a preview (_zoomTo: the world as it
  // was drawn, scaled about the focus, Renderer._zoomPreview) while they pinch, turn the wheel or slide the setting, and
  // re-rasterized at its new size a quarter second after they stop. A new size bakes the floor, walls and props again
  // (a third of a second in the adventure): once, not at every step
  _zoomApply(force, wait) {
    const z = this._zoomGoal();
    if (wait && z !== this.zoom) { this._zoomTo = z; this._zoomAt = this._wall; return; }
    this._zoomTo = null; if (z === this.zoom && !force) return; this.zoom = z; this._applyView();
  }
  // a scene's camera.start and camera.tall: as it starts, and when the screen turns upright or back
  _zoomFit(enter) {
    const c = this._camera(), up = this.upright, turned = up !== this._up; enter = enter || this._up === undefined; this._up = up;   // (a game without scenes: its first step)
    if (c && (enter || (turned && c.tall !== undefined))) { this._zoomBase = this._zoomStart(); this._zoomApply(true); }
    else if (enter || turned) this._zoomApply();   // (a scene without a camera: the player's zoom no longer applies; turned: its range may have changed)
  }
  // is settings.zoom the engine's Camera zoom (not a game's own setting of that name)? Not while the settings are made
  _zoomStd() { const sp = this.settings && this.settings.spec('zoom'); return !!sp && sp.apply === STANDARD_SETTINGS.zoom.apply; }
  /** does any of the game's scenes let the player zoom (the settings screen shows Camera zoom)? */
  _zooms() { const z = c => !!c && (Array.isArray(c.zoom) || typeof c.zoom === 'function'); return z(this.o.camera) || Object.values(this.scenes || {}).some(s => s && z(s.camera)) || z(this.scene && this.scene.camera); }
  /** a short notice at the top of the screen (zoom level, saved, ...): game.note('ZOOM 1.5x', 1) */
  note(text, seconds = 1.2) { this._note = { text: String(text), end: this.real + seconds }; }
  /** pause the game, saying why ('player' | 'focus' | 'controller' | 'menu': pauseReason); returns true if it paused.
   *  The player resumes (Escape, Start, Resume); resume() does it from code */
  pause(reason = 'player') { this.input.stopRumble(); if (this.paused) return false; this.paused = true; this.pauseReason = reason; return true; }
  /** take the game out of pause (and close the pause screen) */
  resume() { this.paused = false; this.pauseReason = null; }
  /** a pausable scene in play pauses when the page is hidden, the window loses focus or the controller is unplugged
   *  (new E.Game({ autoPause: false }) turns that off); coming back never resumes by itself */
  _autoPause(reason) { this.input.stopRumble(); return this.o.autoPause !== false && !!this.scene && !!this.scene.pausable && this.pause(reason); }
  /**
   * open the menu (the corner's menu button and the touch START do it): a pausable scene (or a game started without
   * scenes) pauses on its pause screen; any other scene, a title, waits under the settings. menu('settings') or
   * menu('controls') opens that screen. Without a menu (menu: false, or the agent edition) it pauses a scene in play.
   * Returns true when a menu opened
   */
  menu(name) {
    const sh = this.shell, s = this.scene, play = !!s && (!!s.pausable || this.sceneName === 'main');
    if (!sh || !sh._menu()) { if (play) this.pause('player'); return false; }
    if (!name && play) { this.pause('player'); return true; }
    if (this.pause('menu')) sh._ownPause = true;
    sh.show(name || 'settings'); return true;
  }
  /** the standard features in a page (section 10b): the page set up for phones, pausing when it is hidden, the player's
   *  full-screen choice kept, a phone's first tap going full screen, the corner buttons and the menu screens */
  _standard(signal) {
    const on = (t, type, fn, o) => t.addEventListener(type, fn, Object.assign({ signal }, o)), fs = this.fullscreen;
    pageSetup(this.screen.canvas);
    on(window, 'blur', () => this._autoPause('focus'));
    on(document, 'visibilitychange', () => { if (document.hidden) this._autoPause('focus'); this.audio._background(document.hidden && !this.settings.background); });   // a hidden page sleeps its sound
    on(window, 'pagehide', () => this._autoPause('focus'));
    // held keys and the stick let go as the screen changes; a tap that has landed (the one that went full screen) still counts
    const fsChange = () => { const I = this.input, c = I._click; I.clear(); I._click = c; if (this.shell && this.shell.screen) this.shell._render(); };   // (the player's choice is what they asked for: fullscreen.toggle() keeps it)
    on(document, 'fullscreenchange', fsChange); on(document, 'webkitfullscreenchange', fsChange);
    on(window, 'pointerup', e => {   // (a browser goes full screen only from a tap: this one, or a game started by it)
      if (e.pointerType === 'mouse') return;
      if (!this._fsAuto && !(e.target && e.target.closest && e.target.closest('[data-sys="corner"]'))) this._fsAuto = this._autoFull();   // once until a game starts: the player who leaves it mid-game stays out
      if (!this._guard && this.o.backGesture !== false && this._canBack() && window.top === window && history.pushState) try { history.pushState({ e3: 'back' }, ''); this._guard = true; } catch (err) { /* a sandboxed page */ }
    }, { capture: true });
    // the phone's back gesture (and the browser's back button, after a tap) steps back in the game before it leaves the page:
    // an entry of the game's own in the page's history while there is somewhere to go back to (a menu open, a game in play)
    on(window, 'popstate', e => { if (!this._guard || (e.state && e.state.e3 === 'back')) return; this._guard = false; if (!this.back()) this.note('BACK AGAIN TO LEAVE', 1.5); });
    on(window, 'pointermove', e => { if (e.pointerType === 'mouse' && e.clientY < 80 && (e.movementX || e.movementY)) this._mouseTop = performance.now(); }, { passive: true });   // (a real mouse moved: not a page's synthetic event)
    this.input.names = (this.o.menu && this.o.menu.controls) || null;
    if (this.o.corner !== false && (this.o.menu !== false || this.o.fullscreen !== false)) this._corner = makeCorner(this);
    this.input._cornerMenu = !!this._corner;   // (on a touch screen the corner's menu button is the touch START)
    if (this.o.menu !== false) new Shell(this, { system: true });
  }
  /** full screen by itself on a touch screen (fullscreen: 'tap', the default): at the first tap, and again when a game
   *  starts after the player left it, unless they turned it off (settings.fullscreen false); only from a tap. True when
   *  it is on or was asked for */
  _autoFull() {
    const fs = this.fullscreen, o = this.o.fullscreen, ua = typeof navigator !== 'undefined' && navigator.userActivation;
    if (this.headless) return false; if (fs.on) return true;
    if ((o !== undefined && o !== 'tap') || this.settings.fullscreen === false || !fs.supported || fs.standalone) return false;
    if (!this.input._touched && !(window.matchMedia && matchMedia('(pointer: coarse)').matches)) return false;
    if (ua && !ua.isActive) return false;   // (no tap behind this: the next one asks)
    fs.enter(true); return true;
  }
  /** is there somewhere for game.back() to go (an open menu screen, a scene in play, a scene with its own back())? */
  _canBack() { const s = this.scene; return !!(this.shell && this.shell.screen) || !!s && (!!s.pausable || this.sceneName === 'main' || !!s.back); }
  /**
   * a step back, as a phone's back gesture asks for (the engine calls it for one; a back button of the game's own can):
   * the open menu screen goes back one; else the scene's own back() takes it (it returns true when it did); else a scene
   * in play pauses into the menu, and a paused one goes on. Returns false where there is nowhere to go (a title)
   */
  back() {
    const sh = this.shell, s = this.scene; if (sh && sh.screen) { sh.back(); return true; }
    if (s && s.back && s.back()) return true;
    if (!s || !(s.pausable || this.sceneName === 'main')) return false;
    if (this.paused) this.resume(); else this.menu();
    return true;
  }
  /** where the corner's buttons (menu and full screen, top right; the touch START) cover the screen, in screen pixels
   *  { x0, y0, x1, y1 } (r.W and r.H's space), or null while none show: keep a HUD clear of it */
  cornerArea() {
    const c = this._corner && this._corner.style.display !== 'none' ? this._corner : this.input._startEl; if (!c || !c.isConnected || !this.screen.canvas) return null;
    const q = c.getBoundingClientRect(); if (!q.width) return null;
    const a = this.input.screenPoint(q.left, q.top), b = this.input.screenPoint(q.right, q.bottom);
    return { x0: a[0], y0: a[1], x1: b[0], y1: b[1] };
  }
  /** show or hide the corner buttons: shown while the game isn't being played (a title, a game over, a pause without
   *  the menu), for a moment after the mouse comes near the top, and the menu always on a touch screen (with the
   *  engine's touch buttons it is their START); hidden under an open menu screen (its close button is there) */
  _cornerSync() {
    const c = this._corner; if (!c) return;
    const sh = this.shell, s = this.scene, I = this.input, fs = this.fullscreen, open = !!(sh && sh.screen);
    const main = !!s && (!!s.pausable || this.sceneName === 'main'), play = main && !this.paused, near = performance.now() - (this._mouseTop || -1e9) < 2500;
    const touch = I._touched || !!(this._coarse || (this._coarse = window.matchMedia && matchMedia('(pointer: coarse)')) || {}).matches;   // (the query kept: this runs every frame)
    const showM = !open && (this.o.menu !== false ? (!!(sh && sh._menu()) || main) && (!play || near || touch) : !!I._touchEl);   // (menu: false: the touch START alone)
    const showF = this.o.fullscreen !== false && fs.supported && !fs.standalone && !open && (!play || near);
    const key = (showM ? 1 : 0) + (showF ? 2 : 0) + (fs.on ? 4 : 0);
    if (key === this._cornerKey) return; this._cornerKey = key;
    const [m, f] = c.children; c.style.display = showM || showF ? 'flex' : 'none'; m.style.display = showM ? 'grid' : 'none'; f.style.display = showF ? 'grid' : 'none';
    f.innerHTML = cornerIcon(fs.on ? CORNER_ICONS.exit : CORNER_ICONS.full); f.setAttribute('aria-label', fs.on ? 'Leave full screen' : 'Full screen'); f.title = f.getAttribute('aria-label');
  }
  _applyView() {
    const b = this.baseView, z = this.zoom || 1, y = b.pitchDeg < 5 ? 0 : (this.yaw || 0);
    if (z === 1 && !y) this.view = b;
    else {
      const key = b.id + ':' + b.yawDeg + ':' + b.pitchDeg + ':' + b.scale + ':' + b.zBoost + ':' + z + ':' + y, vc = this._vc || (this._vc = new Map());
      let v = vc.get(key);
      if (!v) { v = new View(b.id, b.label, b.yawDeg + y, b.pitchDeg, b.scale * z, b.zBoost); v.zoom = z; vc.set(key, v); }
      this.view = v;
    }
    this.cam.snap = true;
    for (const f of this._viewListeners) f(this.view);
  }
  /** cycle through game.views (or every view): bind it to a key for players who like to switch */
  nextView(dir = 1) { const list = this.views || E.VIEW_ORDER, i = list.indexOf(this.baseView.id); this.setView(list[((i + dir) % list.length + list.length) % list.length]); }
  /** call f(view) whenever the view changes (re-bake caches, move HUD) */
  onView(f) { this._viewListeners.push(f); }
  /** shake the screen by a (pixels, decaying; at most 10 in all); none when reduceMotion, scaled by the player's
   *  settings.shake */
  shake(a) { if (!this.reduceMotion) this._shakeAmt = Math.min(10, this._shakeAmt + a * clamp(this.settings.shake, 0, 1)); }
  /** how hard the screen shakes now (0 still, up to 10): shake() adds to it and it dies away. A camera of the game's own
   *  (a 3D world's) shakes by it */
  get shaking() { return this._shakeAmt; }
  /**
   * everything a good hit needs in one call: hit-stop, shake, an impact star, sparks along the hit direction, a sound,
   * a damage number and a rumble on a gamepad. hitFx(x, y, z, { power: 1, angle, damage, color, sound: 'hit', rumble: true })
   */
  hitFx(x, y, z, o = {}) {
    const p = o.power === undefined ? 1 : o.power, P = this.particles;
    this.freeze(.035 + .03 * p); this.shake(1.5 + 1.5 * p);
    P.impact(x, y, z, 5 + 3 * p, o.color || '#ffe070');
    P.sparks(x, y, z, Math.round(5 + 5 * p), o.angle === undefined ? null : o.angle, { color: o.color || '#ffb85c' });
    if (o.damage !== undefined) P.text(x + (Math.random() - .5) * 10, y, z + (o.textZ === undefined ? 22 : o.textZ), o.damage, o.textColor || '#fff2c4', { bounce: o.bounce !== false, scale: o.textScale || 1 });
    if (o.sound !== false) this.audio.sfx(o.sound || (p > 1.3 ? 'kick' : 'hit'));
    if (p >= 2) this.flash('#ffffff', .06);
    if (this.input.lastDevice === 'gamepad' && o.rumble !== false) this.input.rumble(.2 + .2 * Math.min(2, p), .06 + .03 * p);
  }
  /** flash the whole screen with a color for `seconds` (dithered fade out): hits, explosions, lightning. Shorter when
   *  reduceMotion, dimmer by the player's settings.flashes */
  flash(color = '#ffffff', seconds = .12, strength = 1) { if (this.reduceMotion) seconds *= .4; this._flash = { color, t: 0, dur: seconds, k: strength * clamp(this.settings.flashes, 0, 1) }; }
  /** hit-stop: the game stands still for s seconds (.04-.08 for a hit); input still ticks */
  freeze(s) { this.hitstop = Math.max(this.hitstop, s); }
  /** camera follows this world point. Side-scrollers: game.focus(x, 0, z) */
  focus(x, y, z = 0) { this.cam.tx = x; this.cam.ty = y; this.cam.tz = z; }
  /**
   * keep the camera on an object automatically (instead of calling focus every update).
   * opts: { z: extra height to look at (default 16), lead: look ahead in the facing / moving direction }. follow(null) stops.
   */
  follow(target, o = {}) { this._follow = target ? { target, z: o.z === undefined ? 16 : o.z, lead: o.lead || 0 } : null; this.cam.snap = true; }
  /** mouse position on the ground (world units), or null */
  mouseGround() { const m = this.input.mouseScreen(); return m ? this.view.toGround(m[0], m[1]) : null; }
  /** run fn once after `seconds` of game time. Cleared on scene change. Returns { cancel() } */
  after(seconds, fn) { const t = { at: this.time + seconds, fn, every: 0, dead: false }; this._timers.push(t); return { cancel() { t.dead = true; } }; }
  /** run fn every `seconds` of game time. Cleared on scene change. Returns { cancel() } */
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
      // a level shorter than the screen sits on the bottom edge in side views (sky above), centered otherwise
      ty = b.y1 - b.y0 < H ? (bottom ? b.y1 - H : (b.y0 + b.y1 - H) / 2) : clamp(ty, b.y0, b.y1 - H);
    }
    if (c.snap) { c.x = tx; c.y = ty; c.vx = c.vy = 0; c.snap = false; c.moving = false; return; }
    if (!(c.smooth > 0)) { c.x = tx; c.y = ty; c.vx = c.vy = 0; c.moving = false; return; }   // smooth 0 = locked camera
    [c.x, c.vx] = smoothDamp(c.x, tx, c.vx, c.smooth, dt);
    [c.y, c.vy] = smoothDamp(c.y, ty, c.vy, c.smooth, dt);
    c.moving = Math.hypot(tx - c.x, ty - c.y) > 1.5;
  }
  /**
   * Start the loop. Either one scene:  game.start({ update(dt), draw(r) })
   * or several:  game.start({ scenes: { title: {...}, play: {...} }, scene: 'title' })
   * A scene is { enter(data), exit(), update(dt), draw(r), back(), pausable, view, views, input, res, expand, touch, camera }
   * (all optional). start() with nothing resumes a stopped loop. A headless game, or one made with loop: false, runs only
   * by advance().
   * - view, views, input, res, expand, touch: a scene's, applied when it starts: input ('PLATFORMER'), res ('snes'),
   *   expand (true), touch (['jump', 'attack']); res and expand stay until another scene sets them
   * - back: a scene's back() takes a phone's back gesture (game.back()) first: return true when it went back somewhere (a
   *   sub-menu closed)
   * - camera: a scene's { zoom: [.75, 2], start: 1, tall: 1.5, wheel: true }: the player zooms the camera within zoom (the
   *   wheel, - and =, a pinch, Settings, Camera zoom: theirs, kept, on top of the game's; false or none: they can't; a
   *   function of the game: a range per screen shape, g => [g.upright ? 1 : .85, 2]), from start, the zoom it starts at
   *   (tall: on a screen held upright, game.upright; 1 without); wheel: false leaves the mouse wheel to the game
   * - boot: { title, version, steps: [[label, fn]], messages, min, checks, accent } runs the boot first (section 10c): the
   *   steps one a frame behind the boot screen (all at once when headless or loop: false); boot: false hides a splash
   */
  start(hooks) {
    if (hooks && hooks.boot !== undefined && !this._booting) return this._boot(hooks);
    if (hooks !== undefined || !this._hooks) {
      if (!hooks || typeof hooks !== 'object') throw new Error('game.start needs { update(dt), draw(r) } or { scenes: { name: { update, draw } }, scene: "name" }');
      this._hooks = hooks;
      if (hooks.scenes) {
        this.scenes = hooks.scenes;
        const first = hooks.scene || Object.keys(hooks.scenes)[0];
        this._enter(first, hooks.data);
      } else {
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
        try { this._frame(); } catch (e) { this._fail('draw', e); try { this.screen._present(); } catch (e2) { /* nothing to show */ } }
        const st = this.stats, t2 = performance.now(); st.updateMs = t1 - t0; st.renderMs = t2 - t1; st.frameMs = since * 1000; st.steps = steps;
        // a display at 90 Hz and up that the frames won't fit: every other refresh, back to each once they fit again. Two
        // signs they won't: a frame's own cost, and refreshes missed between frames drawn at each (the GPU behind, which no
        // clock here sees: that one holds 3 s, then 6, 12... up to a minute, before each refresh is tried again; 3 s again
        // after 10 s drawn at each)
        cost += ((t2 - t0) / 1000 - cost) * .1;
        if (this.drawEvery === 1) miss += ((since > per * 1.5 ? 1 : 0) - miss) * .05;
        since = 0;
        // the player's Frame rate (Settings, Display): Full draws every refresh, 60 every other one at 100 Hz and up (a
        // game made with pace: false draws every refresh unless the player picked 60)
        let e = this.drawEvery; const fr = this.settings.frameRate;
        if (fr === 'full' || (this.o.pace === false && fr !== '60') || per > 1 / 85) e = 1;
        else if (fr === '60') e = per < 1 / 95 ? 2 : 1;
        else if (cost > per * .8) e = 2;
        else if (miss > .2) { if (now - full > 1e4) back = 3; e = 2; miss = 0; hold = now + back * 1000; back = Math.min(60, back * 2); }
        else if (cost < per * .55 && now >= hold) e = 1;
        if (e < this.drawEvery) full = now;
        this.drawEvery = e;
      }
      acc += raw; if (acc > .5) { this.fps = Math.round(n / acc); this.hz = Math.round(1 / per); acc = 0; n = 0; }   // real time: a slow device reads slow
    };
    this._raf = requestAnimationFrame(frame);
    return this;
  }
  /** run the boot (section 10c), then start: the system's checks on the screen, the game's steps one a frame (or all at
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
  /** stop the loop; the game keeps its state, and start() resumes it */
  stop() { this._running = false; if (this._raf != null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this._raf); this._raf = null; return this; }
  /**
   * end the game for good: stop the loop and remove everything the engine added to the page (its listeners on the window,
   * the document, the canvas and the buttons, the touch controls, the GPU lighting's canvas) and close the sound. Tests and
   * tools that make many games call it; the canvas stays
   */
  dispose() {
    /** disposed: true after dispose() */
    this.stop(); this.disposed = true;
    if (this._abort) this._abort.abort();
    if (this.shell) this.shell.dispose();
    const A = this.audio; try { A.stopMusic(); if (A.ctx && A.ctx.close) A.ctx.close(); } catch (e) { /* already closed */ } A.ctx = null; A.failed = 'the game was disposed';
    const I = this.input; I.stopRumble(); for (const el of [I._touchEl, I._stickEl, I._knobEl, this._corner]) if (el && el.remove) el.remove();
    this._corner = null;
    const G = this.gpu; if (G) { try { if (G._cv) G._cv.remove(); if (G._dev && G._dev.destroy) G._dev.destroy(); } catch (e) { /* gone */ } G.enabled = G.ready = false; this.gpu = null; }
    if (E.current === this) E.current = null;
  }
  /**
   * run the game for `seconds` of real time in exact fixed steps, at once, without requestAnimationFrame: tests, tools and
   * headless runs (advance(1) is 120 updates). o.draw: then draw one frame (not in a headless game). Returns the updates run
   */
  advance(seconds = this.o.step, o = {}) {
    if (!this.scene && !this._next) throw new Error('game.advance() needs a started game: game.start({ update, draw }) first');
    this._acc += Math.max(0, seconds);
    const n = this._steps(); this.stats.steps = n;
    if (o.draw && !this.headless) try { this._frame(); } catch (e) { this._fail('draw', e); }
    return n;
  }
  /**
   * the clock: an exact fixed step. Real time (at most 50 ms a frame, so a stall can't run away) fills an accumulator;
   * each whole o.step of it (1/120 s) runs one update of o.step * timeScale game seconds (split in two or more when
   * timeScale > 1, so no step is longer than o.step), and the remainder waits for the next frame (game.alpha = its
   * fraction of a step). 60 Hz runs two steps a frame, 120 Hz one, 144 Hz one on most frames: the same steps at any rate.
   * Slow motion makes steps shorter, never fewer. Paused or at timeScale 0 the steps still run (dt 0), so input ticks.
   * The first frame always updates (with dt 0 when its time is short of a step), so draw never comes before update.
   * Returns the updates run
   */
  _run(real) { this._acc += Math.min(.05, real); return this._steps(); }
  /** run the whole steps the accumulator holds (see _run) */
  _steps() {
    const step = this.o.step; let n = 0;
    try {
      while (this._acc > step - 1e-9) {   // (the tolerance absorbs the rounding in frame times: 1/60 s is two steps)
        this._acc -= step; this._wall += step;   // (_wall: seconds stepped through, unscaled: slow motion or a stop doesn't hold up the player's zoom)
        const k = this.timeScale > 1 ? Math.ceil(this.timeScale - 1e-9) : 1, h = step * Math.max(0, this.timeScale) / k;
        for (let i = 0; i < k; i++, n++) this._step(h);
      }
      if (!n && !this._stepped) { n++; this._step(0); }   // the first frame updates before it draws, even when its time is short
    } catch (e) { this._acc %= step; this._fail('update', e); }   // an error drops the frame's other steps, as before
    if (n) this._stepped = true;
    if (this._acc < 0) this._acc = 0;
    this.alpha = this._acc / step;
    return n;
  }
  /** switch scene: game.go('play', { level: 2 }). It fades through black (dithered) unless opts.fade is 0 */
  go(name, data, o = {}) {
    if (!this.scenes) { warn('go:noscenes', 'game.go() needs game.start({ scenes: {...}, scene }) first'); return; }
    if (!this.scenes[name]) { warn('go:' + name, 'game.go("' + name + '"): no such scene. Scenes: ' + Object.keys(this.scenes).join(', ')); return; }
    const fade = o.fade === undefined ? this.fadeTime : o.fade;
    if (fade > 0 && this.scene) this._fade = { t: 0, dur: fade, name, data, out: true };
    else { this._fade = null; this._next = { name, data }; }
  }
  _fadeStep(dt) {
    const f = this._fade; f.t += dt;
    if (f.out && f.t >= f.dur) { f.out = false; f.t = 0; this._enter(f.name, f.data); }
    else if (!f.out && f.t >= f.dur) this._fade = null;
  }
  _fadeLevel() { const f = this._fade; return f ? clamp(f.out ? f.t / f.dur : 1 - f.t / f.dur, 0, 1) : 0; }
  _enter(name, data) {
    const s = this.scenes[name];
    if (!s) throw new Error('scene "' + name + '" does not exist. Scenes: ' + Object.keys(this.scenes).join(', '));
    const old = this.scene;
    if (old && old.exit) old.exit();
    if (old && old._propWas !== undefined) { E.style.propSize = old._propWas; old._propWas = undefined; }
    this.scene = s; this.sceneName = name; this.paused = false; this._timers.length = 0; this.hitstop = 0;
    this.particles.list.length = 0; this.cam.snap = true; this.audio._duck(false); this._follow = null;
    if (s.view) this.setView(s.view);
    if (s.views) this.views = s.views;
    if (s.input) this.input.use(s.input);
    if (s.res || s.expand !== undefined) this.screen.setOptions(Object.assign(s.res ? { res: s.res } : {}, s.expand !== undefined ? { expand: s.expand } : {}));
    if (s.touch) this.input.touchButtons(s.touch);
    if (s.propSize !== undefined) { s._propWas = E.style.propSize; E.style.propSize = s.propSize; }   // scene option: prop scale while this scene runs
    this._zoomFit(true);   // its camera: its zoom to start at, and whether the player's applies
    if (s.pausable || name === 'main') this._fsAuto = this._autoFull();   // a game starting from a tap goes full screen again
    if (s.enter) s.enter(data);
  }
  _fail(where, e) {
    const msg = (e && e.message) || String(e), key = where + ':' + msg;
    if (!this._errKeys.has(key)) {
      this._errKeys.add(key); this.errors.push({ where, scene: this.sceneName, message: msg, stack: e && e.stack });
      console.error('my-3D2dge: error in ' + where + (this.sceneName ? ' (scene "' + this.sceneName + '")' : '') + ': ' + ((e && e.stack) || msg));
    }
    E.showError('error in ' + where + '()' + (this.sceneName && this.sceneName !== 'main' ? ' of scene "' + this.sceneName + '"' : ''), e);
    if (this.onError) try { this.onError(e, where); } catch (e2) { /* ignore */ }
  }
  _step(dt) {
    if (this._next) { const nx = this._next; this._next = null; this._enter(nx.name, nx.data); }
    this.real += dt; this._shakeAmt *= Math.exp(-dt * 9); this.input.tick(dt);
    if (this.input.padLost) { this._autoPause('controller'); if (this.shell) this.shell.toast('Controller disconnected', 'Press a button on a controller to use it, or play on.'); else this.note('CONTROLLER DISCONNECTED', 2.5); }
    if (this.shell) this.shell._step();   // its screens move the focus with this step's input, and hold it back from the game
    if (this._flash) this._flash.t += dt / Math.max(.05, this.timeScale);   // real time: slow motion does not stretch a flash
    if (this._fade) { const out = this._fade.out; this._fadeStep(dt); if (out) return; }   // the old scene freezes while it fades out
    const s = this.scene;
    if (s && s.pausable && this.input.pressed('pause')) { this.paused = !this.paused; this.pauseReason = this.paused ? 'player' : null; this.audio.sfx('pause'); }
    if (!this.paused) this.pauseReason = null;
    this.audio._duck(this.paused);
    // the player's zoom: the wheel, - and = and a pinch ask for it while a scene that allows it plays (input.zoom())
    const I = this.input, zr = !this.paused && !(this.shell && this.shell.screen) && !!this.zoomRange();
    I._zoomOn = zr; I._wheelOn = zr && (this._camera() || {}).wheel !== false;
    if (this._zoomTo && !I._pinching && this._wall - this._zoomAt > .25) this._zoomApply();   // they stopped: the new zoom, drawn crisp
    if (this.paused) return;
    this._zoomFit(); const zk = I.zoom(); if (zk !== 1) this.zoomBy(zk);
    if (this.hitstop > 0) { this.hitstop -= dt; return; }
    this.time += dt;
    const T = this._timers;
    if (T.length) {
      for (let i = 0; i < T.length; i++) { const t = T[i]; if (t.dead || this.time < t.at) continue; if (t.every) t.at += t.every; else t.dead = true; t.fn(); }
      prune(T, t => t.dead);
    }
    if (s && s.update) s.update(dt);
    const f = this._follow;
    if (f && f.target) {
      const t = f.target, sp = Math.hypot(t.vx || 0, t.vy || 0), dir = typeof t.facing === 'number' && Math.abs(t.facing) === 1 && !t.vy ? [t.facing, 0] : sp > 1 ? [(t.vx || 0) / sp, (t.vy || 0) / sp] : [0, 0];
      this.focus(t.x + dir[0] * f.lead, (t.y || 0) + dir[1] * f.lead, (t.z || 0) + f.z);
    }
    this.particles.update(dt);
    this._camStep(dt);
  }
  _frame() {
    if (this._next) { const nx = this._next; this._next = null; this._enter(nx.name, nx.data); }
    const c = this.cam, s = this._shakeAmt;
    const shx = s > .05 ? (Math.sin(this.real * 83) + Math.sin(this.real * 57.3)) * .5 * s : 0, shy = s > .05 ? (Math.sin(this.real * 71) + Math.sin(this.real * 49.7)) * .5 * s : 0;
    this.lights._clear();
    this.r._begin(c.x + shx, c.y + shy);
    const sc = this.scene;
    if (sc && sc.draw) sc.draw(this.r);
    if (this._note && this.real < this._note.end) { const n = this._note; this.r.overlay(g => E.font.text(g, n.text, this.r.W / 2, 3, '#ffffff', { align: 'center', shadow: '#000', outline: false, font: 'tiny' })); }
    if (this.settings.showFps) { const st = this.stats, t = this.fps + ' FPS  ' + this.hz + ' HZ' + (this.drawEvery > 1 ? ' (EVERY ' + this.drawEvery + ')' : '') + '  ' + (st.updateMs + st.renderMs).toFixed(1) + ' MS';   // Settings, Display
      this.r.overlay(g => { const w = E.font.width(t, { font: 'tiny' }) + 6; g.fillStyle = '#000000b0'; g.fillRect(Math.round(this.r.W / 2 - w / 2), 0, w, 9); g._c = null; E.font.text(g, t, this.r.W / 2, 2, '#9cff9c', { align: 'center', outline: false, font: 'tiny' }); }); }
    this._cornerSync();
    if (this.paused && this.pauseOverlay && !(this.shell && this.shell._sys && this.shell.screen)) this.r.overlay(g => {
      const r = this.r; g.save(); if (E.style.trans === 'dither') g.fillStyle = g.createPattern(r._checker, 'repeat'); else { g.fillStyle = '#05030c'; g.globalAlpha = .55; } g.fillRect(0, 0, r.bw, r.bh); g.restore(); g._c = null;
      E.font.text(g, 'PAUSED', r.W / 2, r.H / 2 - 8, '#ffffff', { align: 'center', scale: 2 });
      E.font.text(g, 'PRESS ESC OR START', r.W / 2, r.H / 2 + 8, '#c9c0e0', { align: 'center' });
    });
    const fx = this._flash;
    if (fx) { const a = (1 - fx.t / fx.dur) * (fx.k === undefined ? 1 : fx.k); if (a <= 0) this._flash = null; else this.r.overlay(g => { const r = this.r; g.save(); if (E.style.trans === 'dither') { const pat = r._fadePattern(a * .85), c = mkCanvas(4, 4), cg = c.getContext('2d'); cg.drawImage(pat, 0, 0); cg.globalCompositeOperation = 'source-in'; cg.fillStyle = fx.color; cg.fillRect(0, 0, 4, 4); g.fillStyle = g.createPattern(c, 'repeat'); } else { g.fillStyle = fx.color; g.globalAlpha = qa(a * .75); g.globalCompositeOperation = 'lighter'; } g.fillRect(0, 0, r.bw, r.bh); g.restore(); g._c = null; }); }
    const fl = this._fadeLevel();
    if (fl > 0) this.r.overlay(g => { const r = this.r; g.save(); if (E.style.trans === 'dither') g.fillStyle = g.createPattern(r._fadePattern(fl), 'repeat'); else { g.fillStyle = '#000000'; g.globalAlpha = Math.round(fl * 16) / 16; } g.fillRect(0, 0, r.bw, r.bh); g.restore(); g._c = null; });
    this.r._finish();
    if (!BOOT.played && !this._booting && (this._drawn = (this._drawn || 0) + 1) >= 2) BOOT._finish();   // play has begun (two frames drawn under the boot screen: the caches are warm)
  }
}
E.Game = Game;

/* =============================================================================
 * 10b. STANDARD FEATURES  what every game gets without writing it, so a game's code goes to the game:
 *    - game.settings: the player's choices (display, sound, comfort, controls), saved per game (a version, every value
 *      checked when it loads, a bad one falls back to its default), applied at once. A game adds its own with
 *      new E.Game({ menu: { settings: [{ key: 'hints', label: 'Hints', value: true }] } }) and reads game.settings.hints.
 *    - game.fullscreen: the page full screen from a tap, click or key. A phone's first tap takes it there, and a game
 *      started by a tap does again; turning it off (the corner's button, the menu) is the player's choice, kept.
 *    - the back gesture: a phone's back steps back in the game (game.back(): a menu screen closes, play pauses) before it
 *      leaves the page.
 *    - pausing: a pausable scene pauses when the page is hidden or loses focus, or the controller in use is unplugged,
 *      and waits for the player (game.pause(reason), game.resume(), game.pauseReason).
 *    - the corner: a menu button and a full-screen button at the top right, inside the safe area; on a touch screen the
 *      menu stays there in play (it is the touch START), and over a menu screen a close button takes its place.
 *    - the page set up for phones: a viewport that reaches the safe areas, and no scrolling, zooming, text selection or
 *      callouts on the game's canvas (menus keep theirs).
 *    E.Shell draws the menu's screens (pause, settings, controls): section 21d.
 * ============================================================================= */
const ZOOM_PLAYER = [.5, 2];   // the player's zoom (settings.zoom): half to twice the game's, within each scene's range
const SETTINGS_VERSION = 2;   // 2: fullscreen false means turned off (version 1's also meant left by a gesture: forgotten)
/** the standard settings by key: { group, label, type: 'toggle' | 'slider' | 'select', value (the default, or a
 *  function of the game), min, max, step, options: [[value, label]], help, apply(game, value) }. Groups: Display,
 *  Sound, Comfort (the settings screen), Controller, Touch (the controls screen) */
const STANDARD_SETTINGS = {
  fullscreen: { group: 'Display', label: 'Full screen', type: 'fullscreen', value: null },   // the player's choice: true, false (turned it off), null (never chose)
  zoom: { group: 'Display', label: 'Camera zoom', type: 'slider', value: 1, min: ZOOM_PLAYER[0], max: ZOOM_PLAYER[1], step: .05, unit: '×', help: 'Closer or farther than the game frames it. In play: the mouse wheel, - and =, or a pinch', apply: g => g._zoomApply(false, true) },
  frameRate: { group: 'Display', label: 'Frame rate', type: 'select', value: 'auto', options: [['auto', 'Auto'], ['60', '60'], ['full', 'Full']], help: 'Auto: every refresh while the game keeps up, every other one, evenly, when it can\'t. 60: every other refresh on a 120 Hz screen. Full: every refresh' },
  showFps: { group: 'Display', label: 'Show frame rate', type: 'toggle', value: false, help: 'At the top of the screen: frames drawn a second, the screen\'s refresh and a frame\'s cost' },
  scale: { group: 'Display', label: 'Pixel scaling', type: 'select', value: 'auto', options: [['auto', 'Auto'], ['sharp', 'Sharp'], ['fill', 'Fill']], help: 'Sharp: every pixel the same size. Fill: the whole screen', apply: (g, v) => g.screen.setScale(v) },
  sound: { group: 'Sound', label: 'Sound', type: 'toggle', value: true, apply: (g, v) => g.audio.mute(!v) },
  volume: { group: 'Sound', label: 'Volume', type: 'slider', value: .7, apply: (g, v) => g.audio.setVolume(v) },
  music: { group: 'Sound', label: 'Music', type: 'slider', value: .5, apply: (g, v) => { g.audio.musicVolume = v; g.audio._levels(); } },
  effects: { group: 'Sound', label: 'Effects', type: 'slider', value: 1, apply: (g, v) => { g.audio.sfxVolume = v; g.audio._levels(); } },
  background: { group: 'Sound', label: 'Sound in the background', type: 'toggle', value: false, help: 'Keep playing sound while the page is hidden' },
  motion: { group: 'Comfort', label: 'Reduce motion', type: 'toggle', value: g => !!g.reduceMotion, help: 'No screen shake, shorter flashes, still menus', apply: (g, v) => { g.reduceMotion = !!v; } },
  shake: { group: 'Comfort', label: 'Screen shake', type: 'slider', value: 1 },
  flashes: { group: 'Comfort', label: 'Screen flashes', type: 'slider', value: 1 },
  bindings: { group: 'Controls', type: 'bindings', value: () => ({}), apply: (g, v) => { g.input.bindings = v; } },
  deadzone: { group: 'Controller', label: 'Stick dead zone', type: 'slider', value: .18, min: .05, max: .5, step: .01, apply: (g, v) => { g.input.deadzone = v; } },
  invertY: { group: 'Controller', label: 'Invert aim up and down', type: 'toggle', value: false, apply: (g, v) => { g.input.invertAimY = !!v; } },
  glyphs: { group: 'Controller', label: 'Button symbols', type: 'select', value: 'auto', options: [['auto', 'Auto'], ['xbox', 'Xbox'], ['playstation', 'PlayStation'], ['nintendo', 'Nintendo'], ['generic', 'Positions']], apply: (g, v) => { g.input.glyphs = v; } },
  rumble: { group: 'Controller', label: 'Vibration', type: 'slider', value: .6, apply: (g, v) => { g.input.rumbleScale = v; } },
  touch: { group: 'Touch', label: 'Touch buttons', type: 'select', value: 'auto', options: [['auto', 'Automatic'], ['on', 'Always'], ['off', 'Hidden']], apply: g => g.input._touchSync() },
  hand: { group: 'Touch', label: 'Buttons on', type: 'select', value: 'right', options: [['right', 'Right'], ['left', 'Left']], apply: g => g.input._touchSync() },
  touchSize: { group: 'Touch', label: 'Button size', type: 'slider', value: 62, min: 44, max: 88, step: 2, unit: ' px', apply: g => g.input._touchSync() },
  touchOpacity: { group: 'Touch', label: 'Button opacity', type: 'slider', value: .8, min: .3, max: 1, step: .05, apply: g => g.input._touchSync() }
};
/** a value for a setting, checked: the value kept, or undefined when it can't be one */
function settingValue(sp, v) {
  if (sp.type === 'toggle') return typeof v === 'boolean' ? v : undefined;
  if (sp.type === 'fullscreen') return v === true || v === false || v === null ? v : undefined;
  if (sp.type === 'slider') return typeof v === 'number' && isFinite(v) ? clamp(v, sp.min === undefined ? 0 : sp.min, sp.max === undefined ? 1 : sp.max) : undefined;
  if (sp.type === 'select') return (sp.options || []).some(o => (Array.isArray(o) ? o[0] : o) === v) ? v : undefined;
  if (sp.type === 'bindings') {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
    const out = {};
    for (const a in v) { const b = v[a]; if (!b || typeof b !== 'object') continue; const o = {}; for (const k of ['keys', 'pad']) if (Array.isArray(b[k])) o[k] = b[k].filter(c => typeof c === 'string' && BINDABLE.test(c) && padCode(c) === (k === 'pad')).slice(0, 4); out[a] = o; }
    return out;
  }
  return v === undefined || typeof v === 'function' ? undefined : v;   // a type of the game's own: any JSON value
}
class Settings {
  /**
   * game.settings: the player's choices, one property each (game.settings.volume), with the game's own (o.menu.settings)
   * beside the standard ones (STANDARD_SETTINGS). Saved with E.store under 'settings:' + the game's id, with a version;
   * on load every value is checked and a bad one falls back to its default. Where storage is blocked the game plays on
   * with the defaults (saved: false)
   */
  constructor(game, own = []) {
    const hide = (k, v) => Object.defineProperty(this, k, { value: v, writable: true });
    hide('_g', game); hide('_specs', {}); hide('_saved', {}); hide('_key', 'settings:' + (game.o.id || (typeof location !== 'undefined' && location.pathname) || 'game'));
    hide('saved', true);
    /** onChange(key, value): called after every change (E.Shell's settings.onChange goes through it) */
    hide('onChange', null);
    const raw = store.get(this._key, null);
    hide('_raw', raw && typeof raw === 'object' && raw.values && typeof raw.values === 'object' ? raw.values : {});   // (a newer version's values are checked like the rest)
    if (!(raw && raw.v >= 2) && this._raw.fullscreen === false) delete this._raw.fullscreen;
    game.input._settings = this; game.input._onBindings = b => this.set('bindings', b);
    for (const k in STANDARD_SETTINGS) this.define(Object.assign({ key: k }, STANDARD_SETTINGS[k]));
    for (const sp of own) this.define(sp);
  }
  /** add a setting: { key, label, type: 'toggle' | 'slider' | 'select', value, min, max, step, options: [[value,
   *  label]] or [value], help, group: 'Game', apply(game, value) }. Its saved value is loaded (when it is a valid one) and
   *  applied; it shows on the settings screen. Returns its value */
  define(sp) {
    if (!sp || !sp.key || typeof sp.key !== 'string') { warn('setting', 'a setting needs a key: { key: "hints", label: "Hints", value: true }'); return undefined; }
    if (sp.key in Settings.prototype || sp.key === 'saved' || sp.key === 'onChange' || sp.key[0] === '_') { warn('setting:' + sp.key, 'a setting cannot be called "' + sp.key + '" (a name the settings object uses)'); return undefined; }
    const s = Object.assign({ group: 'Game', type: sp.options ? 'select' : typeof sp.value === 'number' ? 'slider' : typeof sp.value === 'boolean' || sp.value === undefined ? 'toggle' : 'value' }, sp);
    this._specs[s.key] = s;
    const saved = settingValue(s, this._raw[s.key]);
    if (saved !== undefined) this._saved[s.key] = saved;
    this[s.key] = saved !== undefined ? saved : this.default(s.key);
    this._apply(s.key);
    return this[s.key];
  }
  /** a setting's default value */
  default(key) { const s = this._specs[key]; if (!s) return undefined; const v = typeof s.value === 'function' ? s.value(this._g) : s.value; return v === undefined && s.type === 'toggle' ? false : v; }
  /** the spec a setting was defined with (its label, type, range, options), or undefined */
  spec(key) { return this._specs[key]; }
  /** the keys of a group's settings, in order ('Display', 'Sound', 'Comfort', 'Controller', 'Touch', 'Game'), or every key */
  keys(group) { return Object.keys(this._specs).filter(k => !group || this._specs[k].group === group); }
  /** change a setting: checked (a slider kept in range, a choice among its options), saved, applied, onChange told.
   *  Returns the value kept (the old one when v is not a valid value) */
  set(key, v) {
    const s = this._specs[key]; if (!s) { warn('setting:' + key, 'unknown setting "' + key + '". Settings: ' + this.keys().join(', ')); return undefined; }
    const ok = settingValue(s, v); if (ok === undefined) return this[key];
    this[key] = ok; this._saved[key] = ok; this._save(); this._apply(key);
    if (this.onChange) try { this.onChange(key, ok); } catch (e) { this._g._fail('settings.onChange', e); }
    return ok;
  }
  /** put a group's settings (or all of them) back to their defaults; a game's saves are not touched */
  reset(group) {
    for (const k of this.keys(group)) { if (k === 'fullscreen') continue; delete this._saved[k]; this[k] = this.default(k); this._apply(k); if (this.onChange) this.onChange(k, this[k]); }
    this._save();
  }
  _apply(key) { const s = this._specs[key]; if (s && s.apply) try { s.apply(this._g, this[key]); } catch (e) { this._g._fail('setting "' + key + '"', e); } }
  _save() {
    if (this._g.headless) return;
    this.saved = store.set(this._key, { v: SETTINGS_VERSION, values: this._saved });   // false when the last save failed (storage blocked or full: the choices last for this visit)
    if (!this.saved) warn('settings:save', 'the settings could not be saved (storage is blocked or full): they last for this visit');
  }
}
class FullScreen {
  /** game.fullscreen: the whole page full screen (the game, its menus and buttons), where the browser can */
  constructor(game) {
    /** game: the game it serves; failed: why the last request was refused (a message), or null */
    this._game = game; this.failed = null;
  }
  /** true where this page can go full screen (not an iPhone, which has Add to Home Screen instead; not a frame
   *  without permission; not headless) */
  get supported() { if (this._game.headless) return false; const d = document, el = d.documentElement; return !!((d.fullscreenEnabled || d.webkitFullscreenEnabled) && (el.requestFullscreen || el.webkitRequestFullscreen)); }
  /** true while the page is full screen */
  get on() { return !this._game.headless && !!(document.fullscreenElement || document.webkitFullscreenElement); }
  /** true when the page was opened from a home screen as an app (no browser bars: nothing to go full screen from) */
  get standalone() { const Q = this._mq || (this._mq = {}), m = q => !!(window.matchMedia && (Q[q] || (Q[q] = matchMedia(q))).matches); return !this._game.headless && (m('(display-mode: standalone)') || (m('(display-mode: fullscreen)') && !this.on) || navigator.standalone === true); }   // (full screen from here matches display-mode: fullscreen too)
  /** go full screen. Browsers allow it only from a tap, click or key press: call it from one (a button, the menu, a
   *  key's update step). Returns a promise of whether it worked (a refusal is kept in failed and noted on screen, unless
   *  quiet) */
  enter(quiet) {
    if (this.on || !this.supported) return Promise.resolve(this.on);
    const el = document.documentElement, f = el.requestFullscreen || el.webkitRequestFullscreen;
    const no = e => { this.failed = (e && e.message) || 'refused'; if (!quiet) this._game.note('FULL SCREEN NOT ALLOWED HERE', 2); return false; };
    try { const p = f.call(el, { navigationUI: 'hide' }); this.failed = null; return p && p.then ? p.then(() => true, no) : Promise.resolve(true); } catch (e) { return Promise.resolve(no(e)); }
  }
  /** leave full screen (Escape and the phone's back gesture do it too) */
  exit() {
    if (!this.on) return Promise.resolve(false);
    const f = document.exitFullscreen || document.webkitExitFullscreen;
    try { const p = f && f.call(document); return p && p.then ? p.then(() => true, () => false) : Promise.resolve(true); } catch (e) { return Promise.resolve(false); }
  }
  /** full screen on or off, as the player asked (the corner's button, the menu): their choice is kept in
   *  settings.fullscreen, so a game starting on a phone goes full screen by itself only while they haven't turned it off */
  toggle() { const on = this.on; if (!this._game.headless) this._game.settings.set('fullscreen', !on); return on ? this.exit() : this.enter(); }
}
/* the corner buttons: menu and full screen, 44 px, top right inside the safe area (Game._cornerSync shows them); on a
   touch screen the menu is the touch START */
const CORNER_ICONS = { menu: 'M4 7h16M4 12h16M4 17h16', full: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5', exit: 'M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5' };
const cornerIcon = d => '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>';
function makeCorner(game) {
  const box = document.createElement('div'); box.id = 'e3-corner'; box.dataset.sys = 'corner';
  box.style.cssText = 'position:fixed;top:calc(8px + env(safe-area-inset-top,0px));right:calc(8px + env(safe-area-inset-right,0px));z-index:21;display:none;gap:8px';
  const btn = (label, fn) => {
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', label); b.title = label;
    b.style.cssText = 'width:44px;height:44px;display:none;place-items:center;padding:0;margin:0;border-radius:10px;border:1px solid rgba(255,255,255,.3);background:rgba(8,8,18,.6);color:#f4f0ff;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent';
    b.addEventListener('click', e => { e.stopPropagation(); b.blur(); fn(); });   // (blurred, so a later Space or Enter is the game's)
    box.appendChild(b); return b;
  };
  btn('Menu', () => { if (game.o.menu !== false) game.menu(); else game.input._tapCode('Act:menu'); }).innerHTML = cornerIcon(CORNER_ICONS.menu);   // (menu: false: the touch START)
  btn('Full screen', () => game.fullscreen.toggle());
  document.body.appendChild(box); return box;
}
/* a page made for phones, once: a viewport that reaches the safe areas (pinch zoom left alone), the home-screen app tags,
   no overscroll (pull to refresh, a sideways swipe off the page), and on each game's canvas no page gestures, text
   selection, callouts or tap highlights */
let _paged = false;
function pageSetup(canvas) {
  const st = canvas && canvas.style;
  if (st) { st.touchAction = 'none'; st.userSelect = 'none'; st.webkitUserSelect = 'none'; st.webkitTouchCallout = 'none'; st.webkitTapHighlightColor = 'transparent'; }
  if (_paged || !document.head) return; _paged = true;
  for (const el of [document.documentElement, document.body]) if (el) el.style.overscrollBehavior = 'none';   // no pull to refresh, no swipe away from the page
  const meta = (name, content) => { let m = document.querySelector('meta[name="' + name + '"]'); if (!m) { m = document.createElement('meta'); m.name = name; m.content = content; document.head.appendChild(m); } return m; };
  const vp = meta('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
  if (!/viewport-fit/.test(vp.content)) vp.content += ', viewport-fit=cover';
  meta('mobile-web-app-capable', 'yes'); meta('apple-mobile-web-app-capable', 'yes');
}

/* =============================================================================
 * 10c. BOOT  the start of every game, like a console's BIOS: the system checked, the renderer started, the game's own
 *    setup run one step a frame (a procedural level, a baked cache, loaded data) behind a boot screen that shows each
 *    step, a progress bar and lines of its own ("Reticulating splines"), then a warm-up frame drawn under it, so play
 *    starts without a hitch. A step may return a promise (it is waited for). If anything fails before play, the screen
 *    becomes a report a player can screenshot: what failed, the error, the engine and game versions, the browser, the
 *    screen, the renderer, sound, storage and input, and a short code. E.diagnose() gives that report at any time.
 *      game.start({ scenes, scene: 'title', boot: { title: 'VESPER', version: '1.0',
 *        steps: [['Raising the harbour', () => { map = buildHarbour(); }], ['Teaching the guards to look up', loadGuards]],
 *        messages: ['Counting the bells', 'Oiling the hinges'], min: 0 } })
 *    A page shows the screen from its first paint when E.bootSplash(title) is the first thing in its <body> (the build
 *    puts it in every game page; a hand-written page pastes it): the engine takes it over when it runs, and it goes
 *    away once the game has drawn (hidden, not removed). A game with no steps and no splash shows nothing (it starts at once).
 * ============================================================================= */
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

/* =============================================================================
 * 11. HUMANOID RIG
 *    Local frame: f = forward, r = right, z = up. The rig poses itself every step
 *    from movement, attacks and state, then projects through any view.
 *    Attack specs (angles relative to facing, + = toward the right hand):
 *      { a0, a1, z0, z1, reach, blade, spin }   e.g. horizontal slash a0: 1.7 -> a1: -1.9
 *    Drive with rig.update(dt, { x, y, z, vx, vy, facing, dash, hurt, attack:{ spec, phase, u } })
 *    where phase is 'wind' | 'active' | 'recover' and u is 0..1 progress in that phase.
 * ============================================================================= */
const HUMAN_COLORS = {
  skin: '#f1c7a0', hair: '#3b2a2f', cloth: '#2f8f86', pants: '#3b3552', boot: '#6a4128', belt: '#e0a84a',
  cape: '#c8452f', capeIn: '#7a2622', metal: '#dce8f1', metalDk: '#7f93ab', hilt: '#e8b04e', eye: '#1a1320'
};
const JOINT_KEYS = ['hipL', 'hipR', 'kneeL', 'kneeR', 'footL', 'footR', 'hipC', 'shC', 'shL', 'shR', 'head', 'elbowL', 'elbowR', 'handL', 'handR'];
/** body proportions: 'chibi' (default, big head, Secret of Mana), 'heroic' (tall, Symphony of the Night), 'bulky' (brawlers, bosses) */
const BUILDS = {
  chibi: {},
  heroic: { legUpper: 7.4, legLower: 7.4, hipZ: 14.3, torso: 9.6, shoulderHalf: 3.5, headR: 3.05, neck: 1.5, armUpper: 5.5, armLower: 5.4, hipHalf: 1.8, stride: 7.8, speedRef: 80 },
  bulky: { legUpper: 6.4, legLower: 6.2, hipZ: 12.2, torso: 9.4, shoulderHalf: 4.6, headR: 3.2, neck: .9, armUpper: 5.2, armLower: 5.2, hipHalf: 2.4, limbW: 2.6, torsoW: 4.2, footSpread: 2.4, stride: 6.6, speedRef: 60 },
  // bones: rib cage, skull with glowing sockets and a jaw (colors.bone to tint; outfit, cape, hat and weapons still work)
  skeleton: { legUpper: 7, legLower: 7, hipZ: 13.4, torso: 9, shoulderHalf: 3.2, headR: 3.1, neck: 1.6, armUpper: 5.3, armLower: 5.2, hipHalf: 1.5, limbW: .6, torsoW: 2.6, stride: 7, hunch: .2, skeleton: true, hair: 'bald', sleeves: 'none', eyeGlow: '#ff5a40' }
};
class Humanoid {
  /** new E.Humanoid({ size: 1.3, build, weapon, outfit, hair, hat, sleeves, armor, hood, cape, colors, ... }): a
   *  character rig posed from math every step (API.md, "Characters", lists the options); update(dt, state) each
   *  step, draw(g, ox, oy, view) inside r.actor. hat: 'cap' | 'band' | 'crown' | 'helmet' | 'pointed' (or { style,
   *  color }); hood: true */
  constructor(o = {}) {
    if (o.build && !BUILDS[o.build]) warn('build:' + o.build, 'Humanoid build "' + o.build + '" is unknown (chibi, heroic, bulky, skeleton)');
    o = Object.assign({}, BUILDS[o.build] || {}, o);
    /** o: its options, with the build's proportions and the defaults filled in (size, build, weapon, outfit, ...;
     *  legUpper, torso, headR and the other lengths are at size 1) */
    this.o = Object.assign({
      legUpper: 6, legLower: 6, hipZ: 11.6, hipHalf: 1.9, footSpread: 1.9, torso: 8, shoulderHalf: 3.3, neck: 1.2, headR: 3.4,
      armUpper: 4.6, armLower: 4.6, limbW: 2, torsoW: 3, lean: 0, hunch: 0, stride: 6.5, lift: 3.4, swing: 4, speedRef: 70,
      weapon: 'sword', bladeLen: 11, cape: null, hood: false, eyeGlow: null, hat: null,
      style: 'hd', size: 1, hair: 'short', outfit: 'shirt', sleeves: 'short', armor: false, cheat: .5
    }, o);
    /** trail: recent points of the blade (or fist) tip, for the swing's smear */
    this._cheat = 0; this.trail = [];
    if (typeof this.o.hair === 'string' || !this.o.hair) this.o.hair = { style: this.o.hair || 'short' };
    /** hairPts: the long hair's simulated points (null until it has some) */
    this._hairPts = null;
    if (this.o.weapon && !['sword', 'gun', 'staff'].includes(this.o.weapon)) { warn('weapon:' + this.o.weapon, 'Humanoid weapon "' + this.o.weapon + '" is not built in (sword, gun, staff or null); drawing a sword'); this.o.weapon = 'sword'; }
    if (typeof this.o.hat === 'string') this.o.hat = { style: this.o.hat };
    /** C: its colors (skin, hair, cloth, pants, boot, belt, cape, capeIn, metal, hilt, eye, ...), the defaults with
     *  o.colors over them; change one and it shows at the next draw */
    this.C = Object.assign({}, HUMAN_COLORS, o.colors || {});
    const C = this.C;
    if (this.o.skeleton) C.skin = C.pants = C.boot = C.glove = C.bone || '#e6dfc8';
    C.clothDk = C.clothDk || shade(C.cloth, -.3); C.clothLt = C.clothLt || shade(C.cloth, .25);
    C.pantsDk = C.pantsDk || shade(C.pants, -.3); C.bootDk = C.bootDk || shade(C.boot, -.3); C.skinDk = C.skinDk || shade(C.skin, -.2);
    /** t: seconds of its own clock (idle breathing, blinks); phase: the walk cycle's phase, radians; mv: the last
     *  ground direction it moved, a unit vector; hurtW: 0..1, how far into the hurt flinch */
    this.t = Math.random() * 10; this.phase = 0; this._spW = 0; this._mv = [1, 0]; this._dashW = 0; this.hurtW = 0; this._atkW = 0;
    /** atkZ: the height of the weapon hand during an attack; reach: how far it reaches forward; spin: the body's
     *  extra turn during a spinning move, radians */
    this._theta = 1.2; this.atkZ = 10; this.reach = 7; this._twist = 0; this.spin = 0; this._atkLean = 0;
    /** sq: squash and stretch, -0.45..0.45 (kick adds to it); sqV: its speed; blink: seconds to the next blink;
     *  facing: the angle it faces, radians; x, y, z: where its feet are (from the last update); J: its joints this
     *  step in its own frame ({ hipL, kneeL, footL, shC, head, handR, ... }; rig.worldOffset(J.handR) gives one in
     *  the world); smear: the swing's smear arc, or null */
    this.sq = 0; this.sqV = 0; this.blink = 2; this.facing = 0; this.x = 0; this.y = 0; this.z = 0; this.J = {}; this._smear = null;
    /** capeL: the cape's left edge points (null until it has a cape and has moved) */
    this.capeL = null; this._airW = 0; this._pointW = 0; this._kicking = false;
    this._pose();
  }
  /** a squash-and-stretch kick: + stretches (a jump), - squashes (a landing, a hit) */
  kick(v) { this.sqV += v; }
  /** a heavy landing: knees bend deep and spring back over a moment; strength 1 or more drops a hand to the ground
   *  (a three-point landing), .3-.6 is a soft one. Call it on the step the body lands */
  land(strength = 1) { this._landT = 0; this._landK = clamp(strength, 0, 1.5); this.kick(-1.5 * Math.min(1, strength)); }
  /** how much a stride stretches: shorter while sneaking, longer while sprinting */
  _strideK() { return 1 - .35 * (this._sneakW || 0) + .25 * (this._sprintW || 0); }
  /** the roll (state flip: u 0..1, a forward somersault about the hips, tucked in the middle): turns every joint, and the
   *  cape and hair for this step's drawing only (the next update puts them back before they simulate, so they never
   *  jump or gain speed). Emberdeep's dodge roll, moved into the rig */
  _roll(u) {
    const J = this.J, o = this.o, a = -ease.inOut(clamp(u, 0, 1)) * TAU, c = Math.cos(a), s = Math.sin(a), cz = o.hipZ * .55, tuck = Math.sin(clamp(u, 0, 1) * Math.PI);
    const T0 = p => { const f = p[0] * (1 - .35 * tuck), z = (p[2] - cz) * (1 - .45 * tuck); return [f * c - z * s, p[1] * (1 - .25 * tuck), f * s + z * c + cz * (1 - .55 * tuck)]; };
    let lift = 0; for (const k in J) { const p = J[k]; if (p && k !== 'bladeDir') lift = Math.max(lift, -T0(p)[2] + (k === 'head' ? o.headR : .5)); }   // rolls over on the shoulders: nothing goes through the floor
    const T = p => { const q = T0(p); q[2] += lift; return q; };
    for (const k in J) { const p = J[k]; if (p && k !== 'bladeDir') J[k] = T(p); }
    const b = J.bladeDir; if (b) J.bladeDir = [b[0] * c - b[2] * s, b[1], b[0] * s + b[2] * c];
    const an = this.facing + this.spin + this._cheat, ca = Math.cos(an), sa = Math.sin(an), k = (1 - this.sq * .4) * o.size, kz = (1 + this.sq) * o.size, keep = this._unroll = [];
    for (const ch of [this.capeL, this.capeR, this._hairPts]) if (ch) for (const n of ch) {
      keep.push(n, n.x, n.y, n.z);
      const dx = n.x - this.x, dy = n.y - this.y, q = T([(dx * ca + dy * sa) / k, (-dx * sa + dy * ca) / k, (n.z - this.z) / kz]);
      n.x = this.x + (q[0] * ca - q[1] * sa) * k; n.y = this.y + (q[0] * sa + q[1] * ca) * k; n.z = this.z + q[2] * kz;
    }
  }
  /** world position of a hand ('R' holds the weapon): spawn bullets, sparks or thrown things here */
  hand(which = 'R') { const w = this._w(this.J['hand' + which] || this.J.handR); return [this.x + w[0], this.y + w[1], this.z + w[2]]; }
  /** world position of the weapon tip (sword tip, gun muzzle, staff orb) */
  tip() { const J = this.J, L = this.o.weapon === 'gun' ? 5 : this.o.weapon === 'staff' ? 10 : this.o.bladeLen, w = this._w(V3.add(J.handR, V3.mul(J.bladeDir, L))); return [this.x + w[0], this.y + w[1], this.z + w[2]]; }
  /** where a point in the rig's own frame ([forward, right, up]; a joint such as rig.J.head, or one offset from it)
   *  sits, in world units from the rig's feet: add rig.x, y, z for the world point, or project it to draw at a joint */
  worldOffset(p) { return this._w(p); }
  /** local (f, r, z) -> world offset */
  _w(p) {
    const a = this.facing + this.spin + this._cheat, c = Math.cos(a), s = Math.sin(a), sz = this.o.size, k = (1 - this.sq * .4) * sz;
    return [(p[0] * c - p[1] * s) * k, (p[0] * s + p[1] * c) * k, p[2] * (1 + this.sq) * sz];
  }
  /**
   * s: { x, y, z, vx, vy, facing, dash, hurt, attack, air, point }
   *   air: true while jumping or falling (legs tuck), point: true to hold the weapon hand forward (aiming a gun)
   *   attack: { spec, phase: 'wind' | 'active' | 'recover', u: 0..1 }. spec.kick = true swings the right foot instead of the hand
   *   also aim (radians up), crouch, sprint, climb, hang (hangZ: the top it hangs from, above the feet), flip: 0..1 (a roll),
   *   pose: 'cheer' | 'cast' | 'guard' | 'kneel' | 'crouch' | 'wave' | 'hips' | 'down' | 'die', stance: 'guard' | 'ready',
   *   down: 0..1
   */
  update(dt, s = {}) {
    const o = this.o;
    const un = this._unroll; if (un) { this._unroll = null; for (let i = 0; i < un.length; i += 4) { un[i].x = un[i + 1]; un[i].y = un[i + 2]; un[i].z = un[i + 3]; } }   // last step's roll turned the cloth for drawing only
    if (this.t > 0 && Math.hypot((s.x || 0) - this.x, (s.y || 0) - this.y, (s.z || 0) - this.z) > 24 * o.size) { this.capeL = null; this._hairPts = null; this.trail.length = 0; }   // teleported: cloth and hair start fresh
    /** expr: the face shown ('smile', 'shout', 'angry', 'wince'), or null */
    this.t += dt; this.x = s.x; this.y = s.y; this.z = s.z || 0; this.facing = s.facing || 0; this.expr = s.expr || null;
    const speed = s.run ? s.run * o.speedRef : Math.hypot(s.vx || 0, s.vy || 0);   // run: 0..1 runs in place (an RPG 'run away', a treadmill)
    // traversal: hang from a ledge (hangZ: its top above the feet), a sneaking crouch while moving, a sprint's lean, and a
    // heavy landing from land(); a roll (flip) turns the whole body after posing
    this._hangW = approach(this._hangW || 0, s.hang ? 1 : 0, dt * 14); if (s.hang) this._hangZ = s.hangZ;
    this._sneakW = approach(this._sneakW || 0, s.crouch ? 1 : 0, dt * 8); this._sprintW = approach(this._sprintW || 0, s.sprint ? 1 : 0, dt * 6);
    if (s.land > 0 && this._landT === undefined) this.land(s.land);   // (an action's landing step)
    if (this._landT !== undefined) {
      const k = this._landK, lt = this._landT += dt, dur = .22 + .3 * Math.min(1, k);
      this._landW = lt < .05 ? lt / .05 * k : lt < dur ? k * (1 - ease.inOut((lt - .05) / (dur - .05))) : 0;
      if (lt >= dur) this._landT = undefined;
    }
    this._spW = approach(this._spW, clamp(speed / o.speedRef, 0, 1.25), dt * 7);
    if (speed > 3 && !s.run) {
      const c = Math.cos(this.facing), sn = Math.sin(this.facing), k = Math.min(1, dt * 10);
      this._mv[0] = lerp(this._mv[0], (s.vx * c + s.vy * sn) / speed, k); this._mv[1] = lerp(this._mv[1], (-s.vx * sn + s.vy * c) / speed, k);
    }
    this.phase += dt * speed / (o.stride * o.size * this._strideK() * Math.max(.4, Math.min(1, this._spW)));
    this._dashW = approach(this._dashW, s.dash ? 1 : 0, dt * (s.dash ? 24 : 8));
    this.hurtW = approach(this.hurtW, s.hurt ? 1 : 0, dt * 14);
    this._atkW = approach(this._atkW, s.attack ? 1 : 0, dt * (s.attack ? 30 : 7));
    this._airW = approach(this._airW, s.air ? 1 : 0, dt * (s.air ? 10 : 18));
    // held poses: 'cheer' (item get, victory), 'cast' (both hands forward), 'guard' (fists up), 'kneel', 'crouch', 'wave', 'hips'
    // (hands on hips), and down: 0..1 (knocked flat). stance: 'guard' (fists up while moving) | 'ready' (weapon held forward)
    const pk = this.poseW || (this.poseW = { cheer: 0, cast: 0, guard: 0, kneel: 0, crouch: 0, wave: 0, hips: 0, block: 0 });
    for (const k in pk) pk[k] = approach(pk[k], s.pose === k ? 1 : 0, dt * 9);
    this._stW = approach(this._stW || 0, s.stance === 'guard' ? 1 : 0, dt * 10); this._rdW = approach(this._rdW || 0, s.stance === 'ready' ? 1 : 0, dt * 10);
    this._climbW = approach(this._climbW || 0, s.climb ? 1 : 0, dt * 12); if (s.climb) this._climbP = (this._climbP || 0) + dt * Math.abs(s.vz || 0) / (.4 * (o.armUpper + o.armLower) * o.size) * Math.PI;   // hands keep pace with the climb   // climb: hand over hand on a ladder
    this.dieT = s.pose === 'die' ? (this.dieT || 0) + dt : 0;   // pose 'die': a stagger, the knees give, then the body topples
    const dT = s.down !== undefined ? clamp(+s.down, 0, 1) : s.pose === 'down' || this.dieT > .45 ? 1 : 0;
    /** downW: how far down it is, 0..1 (state down, pose 'down' or 'die'): it falls faster and faster and gets up steadily */
    this.downW = approach(this.downW || 0, dT, dt * (dT > (this.downW || 0) ? 2.5 + 10 * (this.downW || 0) : 3.2));
    if (this.dieT > 0) { this.hurtW = approach(this.hurtW, this.dieT < .25 ? 1 : 0, dt * 14); pk.kneel = approach(pk.kneel, this.dieT > .2 && this.dieT < .6 ? 1 : 0, dt * 10); }
    this._pointW = approach(this._pointW, s.point ? 1 : 0, dt * (s.point ? 30 : 8));
    this._aimA = approach(this._aimA || 0, s.aim || 0, dt * 14);   // aim: radians above (+) or below (-) level while pointing
    if (s.attack) this._kicking = !!s.attack.spec.kick;
    this.blink -= dt; if (this.blink < -.12) this.blink = 2 + Math.random() * 3;
    this.sqV += (-260 * this.sq - 15 * this.sqV) * dt; this.sq = clamp(this.sq + this.sqV * dt, -.3, .3);

    const A = s.attack; let tLean = 0, tTwist = 0, tLunge = 0, tHop = 0, tCrouch = 0, armT = A ? 1 : 0;
    this.spin = 0;
    // side views swing weapons in the screen plane (an overhead chop), ground views in the ground plane.
    // spec.plane or the rig option swingPlane ('side' | 'ground') choose it yourself.
    this._sidePlane = !!A && !A.spec.kick && (A.spec.plane ? A.spec.plane === 'side' : o.swingPlane ? o.swingPlane === 'side' : this._pitch !== undefined && this._pitch < 15 && !!o.weapon && A.spec.blade !== 0 && A.spec.hand !== 'L');
    if (A) {
      // wind: anticipation (pull back, crouch). active: the strike, with a lunge, lead-foot step, lean, twist and hop.
      // recover: follow through, hold the end pose, then blend back to the stance by position (never swing backwards)
      const sp = A.spec, side = this._sidePlane, rest = side ? -.9 : 1.1, RS = sp.rel ? (o.armUpper + o.armLower) / 9.2 : 1, R = (sp.reach || 7.5) * RS, r0 = sp.r0 === undefined ? R : sp.r0 * RS, r1 = sp.r1 === undefined ? R : sp.r1 * RS;
      /** atkRel: the attack's heights are relative to the shoulders (its spec's rel) */
      this._atkRel = !!sp.rel; const zRest = sp.rel ? (sp.kick ? .1 : -7) : 9, z0 = sp.z0 === undefined ? zRest : sp.z0, z1 = sp.z1 === undefined ? z0 : sp.z1;   // side-plane moves have no heights
      // lunge / hop / crouch are body motion in local units, clamped so a game's own 'lunge' speed field can't stretch the rig
      const hold = sp.hold === undefined ? .3 : sp.hold, lean = sp.lean === undefined ? (sp.kick ? -.22 : .3) : clamp(sp.lean, -.8, .8), lunge = sp.lunge === undefined ? (sp.kick ? .4 : 1.2) : clamp(sp.lunge, -4, 5);
      if (A.phase === 'wind' && (this._aPh !== 'wind' || this._aSp !== sp)) {   // a chained hit starts where the arm is
        const chain = (this._armW || 0) > .3 && this._theta !== undefined, fists = !o.weapon || sp.hand === 'L' || sp.blade === 0;
        this._th0 = chain ? this._theta : rest; this._z0 = chain && this._atkRel === !!sp.rel && isFinite(this.atkZ) ? this.atkZ : fists ? z0 : zRest; this._r0 = chain ? this.reach : R * .75;
        const J = this.J; if (J.handR) this._from = { R: J.handR.slice(), L: J.handL.slice(), bd: J.bladeDir.slice() };   // the wind blends from the real pose: no snaps
      }
      this._aPh = A.phase; this._aSp = sp; this._atkHand = sp.hand || 'R'; if (A.phase !== 'wind') this._windK = 1;
      if (A.phase === 'wind') {
        const k = ease.outQuad(A.u);
        this._theta = lerp(this._th0, sp.a0, k); this.atkZ = lerp(this._z0, z0, A.u); this.reach = lerp(this._r0, r0, k); this._windK = k;
        tLean = -Math.abs(lean) * .45; tLunge = -lunge * .3 * k; tCrouch = clamp(sp.crouch === undefined ? (sp.kick ? 0 : .15) : sp.crouch, 0, 1) * k;   // coil: lean back, draw back, dip
      } else if (A.phase === 'active') {
        const k = ease.outCubic(A.u);
        this._theta = sp.spin ? sp.a0 : lerp(sp.a0, sp.a1, k); this.atkZ = lerp(z0, z1, k); this.reach = lerp(r0, r1, k);
        tLean = lean; tLunge = lunge * k; tHop = clamp(sp.hop || 0, 0, 12) * Math.sin(k * Math.PI); tCrouch = clamp(sp.crouch === undefined ? (sp.kick ? 0 : .15) : sp.crouch, 0, 1) * (1 - k);
        if (sp.spin) { if (side) this._theta = sp.a0 - TAU * k; else this.spin = -TAU * k; }   // side views: the blade loops a full circle in front (a windmill) instead of a turn the camera sees edge-on
      } else {
        const k = ease.outQuad(clamp(A.u / hold, 0, 1)), span = sp.spin ? 0 : sp.a1 - sp.a0;
        this._theta = (sp.spin ? sp.a0 : sp.a1) + span * .08 * k; this.atkZ = z1; this.reach = r1;
        armT = A.u < hold ? 1 : 1 - ease.inOut((A.u - hold) / (1 - hold));
        tLean = lean * armT; tLunge = lunge * armT;
      }
      tTwist = sp.spin ? 0 : clamp(this._theta * (side ? .08 : .32) * (sp.twist === undefined ? 1 : sp.twist) * (this._atkHand === 'L' ? -1 : 1), -.7, .7);
      // smear arc in absolute ground angles
      if (this._sidePlane) this._smear = null;
      else if (sp.blade !== 0) {
        const base = this.facing, len = ((sp.reach || 7.5) + (sp.blade || o.bladeLen)) * o.size;
        if (A.phase === 'active') this._smear = { a0: base + sp.a0, a1: base + this.spin + this._theta, r0: len * .45, r1: len, z: (this.atkZ + 1) * o.size, fade: 1 };
        else if (A.phase === 'recover' && this._smear) { const u = clamp(A.u / .5, 0, 1); const end = base + (sp.spin ? sp.a0 - TAU : sp.a1); this._smear.a0 = lerp(base + sp.a0, end, ease.inQuad(u)); this._smear.a1 = end; this._smear.fade = 1 - u; if (u >= 1) this._smear = null; }
        else if (A.phase === 'wind') this._smear = null;
      }
    } else { this._smear = null; this._windK = 1; this._aPh = null; }
    this._armW = approach(this._armW || 0, armT, dt * (armT > (this._armW || 0) ? 30 : 12));
    /** lunge: how far the body leans into an attack now, world units; hop: how high an attack's hop lifts it now */
    this.lunge = lerp(this.lunge || 0, tLunge, Math.min(1, dt * 22)); this.hop = lerp(this.hop || 0, tHop, Math.min(1, dt * 25)); this._crouchA = lerp(this._crouchA || 0, tCrouch, Math.min(1, dt * 20));
    this._atkLean = lerp(this._atkLean, tLean, Math.min(1, dt * 25));
    this._twist = lerp(this._twist, tTwist, Math.min(1, dt * 25));
    this._pose();
    if (o.cape) this._cape(dt);
    if (o.hair.style === 'long' || o.hair.style === 'ponytail') this._hair(dt);
    if (s.flip > 0 && s.flip < 1) this._roll(s.flip);
    // weapon trail: remember where the blade (or fist, or foot) really went, so the smear works in every view
    const T = this.trail;
    for (const p of T) p.age += dt;
    const maxAge = s.attack && s.attack.phase === 'active' ? .14 : .07;   // after the strike the ribbon clears quickly: no ghost slivers
    while (T.length && T[0].age > maxAge) T.shift();
    const atk = s.attack, swinging = atk && (atk.phase === 'active' || (atk.phase === 'recover' && atk.u < .12));
    if (swinging && (atk.spec.blade !== 0 || atk.spec.kick || !o.weapon || atk.spec.hand === 'L')) {
      const J = this.J, kick = atk.spec.kick, left = atk.spec.hand === 'L', sword = o.weapon === 'sword' && !kick && !left;
      const b = kick ? J.kneeR : sword ? V3.add(J.handR, V3.mul(J.bladeDir, 2)) : left ? J.elbowL : J.elbowR, t = kick ? J.footR : sword ? V3.add(J.handR, V3.mul(J.bladeDir, o.bladeLen)) : left ? J.handL : J.handR;
      const wb = this._w(b), wt = this._w(t), last = T[T.length - 1];
      if (last && Math.hypot(this.x + wt[0] - last.t[0], this.y + wt[1] - last.t[1], this.z + wt[2] - last.t[2]) > 14 * o.size) T.length = 0;   // a jump (teleport, respawn): start a new ribbon
      T.push({ b: [this.x + wb[0], this.y + wb[1], this.z + wb[2]], t: [this.x + wt[0], this.y + wt[1], this.z + wt[2]], o: [this.x, this.y, this.z], age: 0, w: sword ? 1 : .6 });
      if (T.length > 12) T.shift();
    }
  }
  /** long hair and ponytails: a verlet strand that trails behind the head */
  _hair(dt) {
    const o = this.o, long = o.hair.style === 'long', N = o.hair.len || (long ? 6 : 4), seg = (long ? 1.9 : 1.6) * o.size;
    const J = this.J, anchor = () => { const w = this._w([J.head[0] - o.headR * .8, 0, J.head[2] + (long ? o.headR * .1 : o.headR * .55)]); return [this.x + w[0], this.y + w[1], this.z + w[2]]; };
    if (!this._hairPts) { const a = anchor(), hx = -Math.cos(this.facing) * .8 * o.size, hy = -Math.sin(this.facing) * .8 * o.size; this._hairPts = Array.from({ length: N }, (_, i) => ({ x: a[0] + hx * i * .3, y: a[1] + hy * i * .3, z: a[2] - i * seg, px: a[0] + hx * i * .3, py: a[1] + hy * i * .3, pz: a[2] - i * seg })); }
    const P = this._hairPts, a = anchor(), damp = Math.pow(.97, dt * 120), fx = Math.cos(this.facing + this.spin), fy = Math.sin(this.facing + this.spin), dt2 = dt * dt;   // trails behind the body's turn
    Object.assign(P[0], { x: a[0], y: a[1], z: a[2], px: a[0], py: a[1], pz: a[2] });
    for (let i = 1; i < P.length; i++) { const n = P[i], vx = (n.x - n.px) * damp, vy = (n.y - n.py) * damp, vz = (n.z - n.pz) * damp; n.px = n.x; n.py = n.y; n.pz = n.z; n.x += vx - fx * 20 * dt2; n.y += vy - fy * 20 * dt2; n.z += vz - 200 * dt2; }
    const shZ = this.z + J.shC[2] * o.size, bodyR = (o.torsoW * .75 + .6) * o.size, headTop = this.z + (J.head[2] + o.headR * .6) * o.size;
    for (let it = 0; it < 3; it++) for (let i = 1; i < P.length; i++) {
      const A = P[i - 1], B = P[i], dx = B.x - A.x, dy = B.y - A.y, dz = B.z - A.z, d = Math.hypot(dx, dy, dz) || 1e-6, kk = (d - seg) / d;
      if (i === 1) { B.x -= dx * kk; B.y -= dy * kk; B.z -= dz * kk; } else { A.x += dx * kk * .5; A.y += dy * kk * .5; A.z += dz * kk * .5; B.x -= dx * kk * .5; B.y -= dy * kk * .5; B.z -= dz * kk * .5; }
      const rx = B.x - this.x, ry = B.y - this.y, rd = Math.hypot(rx, ry);
      if (B.z < shZ + 2 * o.size && rd < bodyR) { const ux = rd > .01 ? rx / rd : -fx, uy = rd > .01 ? ry / rd : -fy; B.x = this.x + ux * bodyR; B.y = this.y + uy * bodyR; }
      if (B.z < this.z + .5) B.z = this.z + .5;
      if (B.z > headTop) B.z = headTop;   // no plume over the head on attacks and knockbacks
    }
  }
  _pose() {
    const o = this.o, J = this.J, sp = Math.min(1, this._spW), mf = this._mv[0], mr = this._mv[1], ph = this.phase, dash = this._dashW, hurt = this.hurtW, rz = V3.rz, add = V3.add;
    const breathe = Math.sin(this.t * 2.3) * (1 - sp);
    const bob = (.5 - Math.abs(Math.cos(ph)) * 1.3) * sp;
    const PW = this.poseW || { cheer: 0, cast: 0, guard: 0, kneel: 0 }, kn = PW.kneel, lg = this.lunge || 0, cw = this._climbW || 0;
    const hw = this._hangW || 0, snk = this._sneakW || 0, spr = (this._sprintW || 0) * sp, ld = this._landW || 0, sk = this._strideK();
    const cr = Math.max(PW.crouch || 0, this._crouchA || 0, Math.sin(clamp(this.downW || 0, 0, 1) * Math.PI) * .85);   // falling (and getting up) buckles the knees
    const sway = Math.sin(this.t * 1.15) * .3 * (1 - sp) * (1 - this._atkW);   // idle weight shift from foot to foot
    const hipC = [mf * .4 * sp - .4 * hurt + lg * .55, mr * .3 * sp + sway, o.hipZ + bob + breathe * .3 - dash * 2.2 - hurt * .6 - kn * o.hipZ * .42 - PW.guard * .9 - cr * o.hipZ * .32 - snk * o.hipZ * .3 - ld * o.hipZ * .42 + (this.hop || 0)];
    J.hipL = add(hipC, rz([0, -o.hipHalf, 0], this._twist * .4)); J.hipR = add(hipC, rz([0, o.hipHalf, 0], this._twist * .4));
    for (const s of [-1, 1]) {
      const p = ph + (s > 0 ? Math.PI : 0), along = Math.sin(p) * o.stride * sp * sk;
      let foot = [mf * along + (s > 0 ? .8 : -.6) * (1 - sp), s * o.footSpread + mr * along, Math.max(0, Math.cos(p)) * o.lift * sp];
      foot = V3.lerp(foot, [s > 0 ? 4 : -5, s * 2.2, s > 0 ? 1.5 : .3], dash);
      if (this._airW > 0) foot = V3.lerp(foot, [s > 0 ? 3.2 : -2.6, s * 1.9, s > 0 ? 6 : 3.6], this._airW);
      if (kn > 0) foot = V3.lerp(foot, [s > 0 ? 3.4 : -4.2, s * 2, s > 0 ? 0 : 0], kn);
      if (PW.guard > 0) foot = V3.lerp(foot, [s > 0 ? 2.6 : -2.8, s * 2.6, 0], PW.guard * (1 - sp));
      if (cr > 0) foot = V3.lerp(foot, [s > 0 ? 1.6 : -1.4, s * (o.footSpread + .7), foot[2] * (1 - cr)], cr * (1 - sp * .5));
      if (lg > 0) foot[0] += (s === (this._atkHand === 'L' ? 1 : -1) ? lg * 1.3 : -lg * .15) * (1 - sp);   // the lead foot steps into the strike
      if (this.hop) foot[2] += this.hop;
      if (cw > 0) foot = V3.lerp(foot, [.6, s * 1.5, Math.max(0, Math.sin(this._climbP + (s > 0 ? Math.PI : 0))) * 3.4], cw);
      if (snk > 0) foot[1] += s * .6 * snk;                                                                     // a wider, lower stance
      if (ld > 0) foot = V3.lerp(foot, [s > 0 ? 2.6 : -2.4, s * (o.footSpread + 1), 0], Math.min(1, ld));      // planted wide
      if (hw > 0) foot = V3.lerp(foot, [1.3, s * 1.3, o.hipZ * .08 + (s > 0 ? .8 : 0)], hw);                   // dangling against the wall
      if (s > 0 && this._kicking && this._atkW > 0) foot = V3.lerp(foot, [Math.cos(this._theta) * (this.reach + 3), Math.sin(this._theta) * (this.reach + 3), (this._atkRel ? this.atkZ * o.hipZ : this.atkZ) + (this.hop || 0)], this._armW || 0);
      const hip = s > 0 ? J.hipR : J.hipL;
      const [knee, f2] = ik3(hip, foot, o.legUpper, o.legLower, [1, s * .15, .1]);
      J[s > 0 ? 'kneeR' : 'kneeL'] = knee; J[s > 0 ? 'footR' : 'footL'] = f2;
    }
    const leanF = (o.lean + .16 * sp * mf + .45 * dash + this._atkLean - .35 * hurt + cr * .22 + snk * .34 + spr * .3 + ld * .42) * (1 - hw) + hw * .06, leanR = .1 * sp * mr;
    const dir = V3.norm([Math.sin(leanF), Math.sin(leanR), Math.cos(leanF)]);
    const shC = add(hipC, V3.mul(dir, o.torso));
    J.hipC = hipC; J.shC = shC;
    J.shL = add(shC, rz([0, -o.shoulderHalf, 0], this._twist)); J.shR = add(shC, rz([0, o.shoulderHalf, 0], this._twist));
    J.head = add(shC, V3.mul(V3.norm([dir[0] + o.hunch * .9, dir[1], dir[2]]), o.neck + o.headR));
    const armLen = o.armUpper + o.armLower, aw = this._armW || 0, sA = this._atkHand === 'L' ? -1 : 1, two = this._atkHand === 'both', fists = !o.weapon || this._stW > .5;
    // where the striking hand goes, and the weapon's direction, for the current attack angle
    const aT = this._sidePlane ? add(shC, [Math.cos(this._theta) * this.reach, sA * .8, Math.sin(this._theta) * this.reach]) : add(shC, [Math.cos(this._theta) * this.reach, Math.sin(this._theta) * this.reach, this._atkRel ? this.atkZ : this.atkZ - shC[2]]);
    const aDir = this._sidePlane ? V3.norm([Math.cos(this._theta), .05, Math.sin(this._theta)]) : V3.norm([Math.cos(this._theta), Math.sin(this._theta), -.12]);
    for (const s of [-1, 1]) {
      const sh = s > 0 ? J.shR : J.shL, q = ph + (s > 0 ? 0 : Math.PI), along = -Math.sin(q) * o.swing * sp * (1 + .6 * spr) * (1 - .4 * snk);
      let hand = add(sh, [mf * along + .5 * (1 - sp) + o.hunch * 3, s * .9 + mr * along, -armLen * .86 + Math.abs(Math.sin(q)) * 1.2 * sp]);
      hand = V3.lerp(hand, add(sh, [-4.5, s * 1.6, -5]), dash);
      hand = V3.lerp(hand, add(sh, s > 0 ? [1.4, -.6, .6] : [-1.6, s * 2.2, -3.2]), hurt);   // a flinch: one arm up to shield the face, the other flung back
      if (this._airW > 0) hand = V3.lerp(hand, add(sh, [1.2, s * 2.6, -1.2]), this._airW * .7);
      if (s > 0 && this._pointW > 0) { const aa = this._aimA || 0; hand = V3.lerp(hand, add(sh, [armLen * .92 * Math.cos(aa), -.6, armLen * .92 * Math.sin(aa) - .4]), this._pointW); }
      if (PW.cheer > 0) hand = V3.lerp(hand, add(sh, [.6, s * 1.4, armLen * (.74 + .12 * Math.sin(this.t * 9 + (s > 0 ? 0 : .7)))]), PW.cheer);   // fists pump
      if (PW.cast > 0) hand = V3.lerp(hand, add(shC, [armLen * .82, s * 1.3, -1.2]), PW.cast);
      const guardAt = add(shC, s < 0 ? [3.8, -1, .4] : [2.3, 1.5, -.6]);   // boxer's guard: lead fist out at chin height, face stays visible
      if (PW.guard > 0) hand = V3.lerp(hand, guardAt, PW.guard);
      if (this._stW > 0) hand = V3.lerp(hand, guardAt, this._stW * (1 - dash));
      if (this._rdW > 0 && o.weapon) hand = V3.lerp(hand, s > 0 ? add(shC, [2.8, .9, -3]) : add(shC, [2.2, .2, -3.6]), this._rdW * (1 - dash));   // ready: weapon held forward in both hands
      if (PW.wave > 0 && s === (o.weapon ? -1 : (this._camSide || 1))) { const w = Math.sin(this.t * 11); hand = V3.lerp(hand, add(sh, [.8 + w * 1.7, s * (2 + Math.max(0, w) * 1.4), armLen * .8]), PW.wave); }   // the free hand waves (the camera-side one when both are free)
      if (PW.hips > 0) hand = V3.lerp(hand, add(s > 0 ? J.hipR : J.hipL, [-.2, s * 1.5, 1.5]), PW.hips);
      if (PW.block > 0) hand = V3.lerp(hand, add(shC, s > 0 ? [2.6, .6, -2.4] : [2.4, -.2, -3.4]), PW.block);   // block: weapon upright across the body, both hands on it
      if (cw > 0) hand = V3.lerp(hand, add(sh, [1.7, s * .5, armLen * (.08 + .8 * (.5 + .5 * Math.sin(this._climbP + (s > 0 ? 0 : Math.PI))))]), cw);   // hands on the rails, one reaching high above the head while the other pulls down
      if (snk > 0) hand = V3.lerp(hand, add(sh, [2.2 + along * .3, s * 1.3, -armLen * .6]), snk * .55);       // sneaking: hands low and forward
      if (ld > 0) hand = V3.lerp(hand, s > 0 && this._landK >= 1 ? [3.2, 1.6, .3] : add(sh, [-1.4, s * 3.2, -armLen * .3]), Math.min(1, ld));   // a three-point landing: one hand on the ground, the other back
      if (hw > 0) hand = V3.lerp(hand, add(sh, [2.4, s * .4, clamp((this._hangZ === undefined ? sh[2] + armLen : this._hangZ) - sh[2], 1, armLen * .96)]), hw);   // gripping the edge above
      const wk = this._from && this._windK < 1 ? this._windK : 1, from = wk < 1 ? this._from[s > 0 ? 'R' : 'L'] : null;
      if (aw > 0 && !this._kicking) {
        if (s === sA) hand = V3.lerp(hand, from ? V3.lerp(from, aT, wk) : aT, aw);                // the striking hand
        else if (two) hand = V3.lerp(hand, add(aT, V3.mul(aDir, -1.7)), aw);                      // two-handed grip below it
        else { const offT = fists ? guardAt : add(shC, [1.6, s * 1.6, -1.6]); hand = V3.lerp(hand, from ? V3.lerp(from, offT, wk) : offT, from ? aw : aw * .85); }   // the other hand guards the chin (fists) or pulls back
      }
      if (this._kicking && aw > 0) hand = V3.lerp(hand, add(shC, [1.8, s * 2.2, .6 - (s > 0 ? 1.5 : 0)]), aw * .85);   // arms up for balance during a kick
      const [elbow, h2] = ik3(sh, hand, o.armUpper, o.armLower, [-1, s * .7, -.2]);
      J[s > 0 ? 'elbowR' : 'elbowL'] = elbow; J[s > 0 ? 'handR' : 'handL'] = h2;
    }
    const wp = o.weapon, rest = V3.norm(wp === 'staff' ? [.3, .15, 1] : wp === 'gun' ? [.8, 0, -.6] : [.55, .35, -.75]), atk = aDir;
    let bd = V3.lerp(rest, atk, this._kicking || sA < 0 ? 0 : aw);
    if (this._from && this._windK < 1 && !this._kicking && sA > 0) bd = V3.lerp(this._from.bd, bd, this._windK);   // the weapon turns from where it was
    if (PW.cheer > 0) bd = V3.lerp(bd, [.15, .05, 1], PW.cheer);   // raised in triumph, point up
    if (PW.block > 0) bd = V3.lerp(bd, [.35, -.3, .9], PW.block);   // held upright across the body
    if (this._rdW > 0) bd = V3.lerp(bd, [.62, .08, .78], this._rdW * (1 - aw));
    if (this._pointW > 0) bd = V3.lerp(bd, [Math.cos(this._aimA || 0), 0, Math.sin(this._aimA || 0)], this._pointW);
    J.bladeDir = V3.norm(bd);
    const dw = this.downW || 0;
    if (dw > 0) J.bladeDir = V3.norm(V3.lerp(J.bladeDir, [0, .9, -.4], dw));   // a dropped weapon lies flat once the body is down
    if (dw > 0) {   // knocked down: rotate the whole skeleton backward so it lies flat, face up, centred on the rig's position
      const a = dw * Math.PI / 2 * .96, ca = Math.cos(a), sa = Math.sin(a), lift = dw * 1.4, shift = dw * (o.hipZ + o.torso) * .5;
      for (const k in J) { if (k === 'bladeDir') continue; const p = J[k]; J[k] = [p[0] * ca - p[2] * sa + shift, p[1], p[0] * sa + p[2] * ca + lift]; }
      const b = J.bladeDir; J.bladeDir = [b[0] * ca - b[2] * sa, b[1], b[0] * sa + b[2] * ca];
    }
  }
  /** world position of the head (for speech bubbles, portraits, halos) */
  head() { const w = this._w(this.J.head); return [this.x + w[0], this.y + w[1], this.z + w[2]]; }
  /**
   * a close-up bust for dialog boxes and menus, drawn live from the rig (blinks, hair and hats included):
   *   rig.drawPortrait(g, x, y, 40, { zoom: 3, turn: .6, bg: '#1a2050', frame: true })   // inside r.overlay(g => ...)
   * zoom: pixels per world unit (3 = face fills the frame), turn: 0 = facing you, .6 = three-quarter.
   * The bust stays upright while the rig kneels or lies down (upright: false shows the real pose); cape: false hides the cape;
   * tint: '#808080' greys it out (a KO'd party member).
   */
  drawPortrait(g, x, y, size = 40, o = {}) {
    const S = Math.round(size), zoom = o.zoom || 3, turn = o.turn === undefined ? .6 : o.turn, pitch = o.pitch || 12;
    const v = this._pv || (this._pv = new View('portrait', 'Portrait', 0, pitch, zoom, 1));
    v.set((Math.PI / 2 - this.facing - this.spin + turn) / DEG, pitch, zoom, 1);
    const cache = this._pcs || (this._pcs = new Map());
    let cvs = cache.get(S); if (!cvs) { cvs = [mkCanvas(S, S), mkCanvas(S, S)]; cache.set(S, cvs); }
    const [cv, c2] = cvs, cg = cv.getContext('2d'), g2 = c2.getContext('2d');
    cg.clearRect(0, 0, S, S); g2.clearRect(0, 0, S, S);
    const PW = this.poseW || {}, keep = { trail: this.trail, cheat: this._cheat, pitch: this._pitch, cape: this.o.cape, weapon: this.o.weapon, down: this.downW, kneel: PW.kneel, cheer: PW.cheer, cast: PW.cast, hurt: this.hurtW };
    const pose = o.upright !== false && (keep.down > 0 || keep.kneel > 0 || keep.cheer > 0 || keep.cast > 0 || keep.hurt > 0);
    if (pose) { this.downW = 0; this.hurtW = 0; if (this.poseW) PW.kneel = PW.cheer = PW.cast = 0; this._pose(); }
    if (o.cape === false) this.o.cape = null;
    if (o.weapon === false) this.o.weapon = null;
    { const st = clamp(1 - v.pitchDeg / 45, 0, 1), camA = Math.atan2(v.fy, v.fx); this._cheat = st > 0 && this.o.cheat ? clamp(angDiff(this.facing, camA), -this.o.cheat, this.o.cheat) * st : 0; }   // frame the head where draw() will put it
    this.trail = [];
    try {
      const hw = this._w(this.J.head), hp = v.p(hw[0], hw[1], hw[2]);
      this.draw(cg, Math.round(S / 2 - hp[0]), Math.round(S * (o.headY || .46) - hp[1]), v);
    } finally {
      this.trail = keep.trail; this._cheat = keep.cheat; this._pitch = keep.pitch; this.o.cape = keep.cape; this.o.weapon = keep.weapon;
      if (pose) { this.downW = keep.down; this.hurtW = keep.hurt; if (this.poseW) { PW.kneel = keep.kneel; PW.cheer = keep.cheer; PW.cast = keep.cast; } this._pose(); }
    }
    if (o.tint) { cg.globalCompositeOperation = 'source-atop'; cg.globalAlpha = .6; cg.fillStyle = o.tint; cg.fillRect(0, 0, S, S); cg.globalAlpha = 1; cg.globalCompositeOperation = 'source-over'; }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g2.drawImage(cv, dx, dy);   // outline like the in-game sprite
    g2.globalCompositeOperation = 'source-in'; g2.fillStyle = o.outline || '#0c0818'; g2.fillRect(0, 0, S, S); g2.globalCompositeOperation = 'source-over';
    g2.drawImage(cv, 0, 0);
    if (o.frame !== false) E.ui.box(g, x - 2, y - 2, S + 4, S + 4, { bg: o.bg || '#1a2050', border: o.border, shadow: o.shadow });
    g.drawImage(c2, 1, 1, S - 2, S - 2, Math.round(x) + 1, Math.round(y) + 1, S - 2, S - 2);
  }
  _cape(dt) {
    const c = this.o.cape, sz = this.o.size, N = c.len || 6, seg = (c.seg || 2.4) * sz, W0 = (c.width || 5) * sz;
    const anchor = s => { const J = this.J, sh = s > 0 ? J.shR : J.shL, w = this._w(V3.add(sh, [-1.3, -s * .6, -.6])); return [this.x + w[0], this.y + w[1], this.z + w[2]]; };
    if (!this.capeL) {
      /** capeR: the cape's right edge points */
      this.capeL = []; this.capeR = [];
      const bx = -Math.cos(this.facing) * (c.body || 3.4) * sz, by = -Math.sin(this.facing) * (c.body || 3.4) * sz;   // start hanging behind the back, not inside the body
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
        const n = ch[i]; if (n.z < this.z + .4) n.z = this.z + .4; if (n.z > shZ + seg * .6) n.z = shZ + seg * .6;   // never whips up over the head
        const rx = n.x - this.x, ry = n.y - this.y, d = Math.hypot(rx, ry), fwd = rx * fx + ry * fy;
        if (n.z < shZ + 1 && fwd > -bodyR * .35) { n.x -= fx * (fwd + bodyR * .35); n.y -= fy * (fwd + bodyR * .35); }   // cloth stays behind the back plane, never across the chest
        else if (n.z < shZ + 1 && d < bodyR) { const ux = d > .01 ? rx / d : -fx, uy = d > .01 ? ry / d : -fy; n.x = this.x + ux * bodyR; n.y = this.y + uy * bodyR; }
      }
    }
  }
  /**
   * Sp(joint, f, r, z): a detail drawn around a joint (the face, hair, belt, toes) at offsets in the body's own frame,
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
  /** draw into g with (ox, oy) = projected position of the rig's root */
  draw(g, ox, oy, view) {
    this._pitch = view.pitchDeg;
    if (this.o.charView !== false) view = charView(view);
    if (view.id !== 'portrait') this._lastView = view;   // drawSmear projects the trail with the same view
    // cheated 3/4 pose: in side-ish views turn the body partly toward the camera, like hand-drawn sprites
    const st = clamp(1 - view.pitchDeg / 45, 0, 1), camA = Math.atan2(view.fy, view.fx);
    this._camSide = Math.cos(camA - this.facing - Math.PI / 2) >= 0 ? 1 : -1;   // which hand the camera sees
    this._cheat = st > 0 && this.o.cheat ? clamp(angDiff(this.facing, camA), -this.o.cheat, this.o.cheat) * st : 0;
    if (this.o.style === 'classic') this._drawClassic(g, ox, oy, view); else this._drawHD(g, ox, oy, view);
  }
  /**
   * HD style: volumetric limbs, shaped torso, outfits, hair styles, hands and boots, each shaded with
   * hue-shifted tones and a light from the upper left (the look of hand-drawn PS1 / N64 era sprites).
   */
  _drawHD(g, ox, oy, view) {
    const o = this.o, C = this.C, J = this.J, sz = o.size, sc = view.scale * sz, ops = this._ops || (this._ops = []);
    ops.length = 0;
    const an = this.facing + this.spin + this._cheat, ca = Math.cos(an), sa = Math.sin(an), k = (1 - this.sq * .4) * sz, kz = (1 + this.sq) * sz;
    const vax = view.ax, vay = view.ay, vbx = view.bx, vby = view.by, vbz = view.bz, vdx = view.dx, vdy = view.dy, vdz = view.dz;
    const S = (f, r, z) => { const wx = (f * ca - r * sa) * k, wy = (f * sa + r * ca) * k, wz = z * kz; return [ox + vax * wx + vay * wy, oy + vbx * wx + vby * wy + vbz * wz, vdx * wx + vdy * wy + vdz * wz]; };
    const Sp = this._offsets(S);   // details around a joint (face, hair, belt, toes) turn with the body
    const Q = {};
    for (const key of JOINT_KEYS) Q[key] = Sp(J[key]);
    const lq = (A, B, t) => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
    const dC = (Q.hipC[2] + Q.shC[2]) * .5, u = sc, lw = o.limbW / 2;   // u: screen pixels per world unit, lw: limb thickness from the build
    // a capsule between projected points A and B with screen radii ra, rb (dx, dy shift it)
    const cap = (A, B, ra, rb, col, dx = 0, dy = 0) => {
      const ax = A[0] + dx, ay = A[1] + dy, bx = B[0] + dx, by = B[1] + dy, vx = bx - ax, vy = by - ay, L = Math.hypot(vx, vy);
      if (ra < .75 && rb < .75) { px.line(g, ax, ay, bx, by, col, 1); return; }
      if (L > .01) { const nx = -vy / L, ny = vx / L; px.poly(g, [[ax + nx * ra, ay + ny * ra], [bx + nx * rb, by + ny * rb], [bx - nx * rb, by - ny * rb], [ax - nx * ra, ay - ny * ra]], col); }
      px.disc(g, ax, ay, Math.max(0, ra - .35), col); px.disc(g, bx, by, Math.max(0, rb - .35), col);
    };
    // shaded capsule: dark silhouette, base shifted toward the light, highlight along the lit edge
    const limb = (A, B, ra, rb, c, far, bias = 0) => {
      const t = tones(c), dk = far ? t.deep : t.sh, base = far ? t.sh : t.base, lt = far ? t.base : t.lt;
      ops.push({ d: (A[2] + B[2]) * .5 + bias, f: () => {
        cap(A, B, ra, rb, dk);
        cap(A, B, Math.max(.45, ra - .7), Math.max(.45, rb - .7), base, -.6, -.6);
        if (ra > 1.5 && !far) { const vx = B[0] - A[0], vy = B[1] - A[1], L = Math.hypot(vx, vy) || 1; let nx = -vy / L, ny = vx / L; if (nx * -.6 + ny * -.8 < 0) { nx = -nx; ny = -ny; } const off = ra - 1.1; px.line(g, A[0] + vx * .2 + nx * off, A[1] + vy * .2 + ny * off, A[0] + vx * .75 + nx * off, A[1] + vy * .75 + ny * off, lt); }
      } });
    };
    // shaded polygon: dark shape, then a slightly inset copy shifted toward the light
    const inset = (pts, d) => { let cx = 0, cy = 0; for (const p of pts) { cx += p[0]; cy += p[1]; } cx /= pts.length; cy /= pts.length; return pts.map(p => { const vx = p[0] - cx, vy = p[1] - cy, l = Math.hypot(vx, vy) || 1, m = Math.max(0, l - d) / l; return [cx + vx * m - .6, cy + vy * m - .6]; }); };
    const slab = (pts, c, far) => { const t = tones(c); px.poly(g, pts, far ? t.deep : t.sh); px.poly(g, inset(pts, 1.1), far ? t.sh : t.base); };
    const W = s => (s > 0 ? 1 : -1);
    // ---- legs and boots ----
    for (const s of [-1, 1]) {
      const hip = s > 0 ? Q.hipR : Q.hipL, knee = s > 0 ? Q.kneeR : Q.kneeL, foot = s > 0 ? Q.footR : Q.footL, far = knee[2] < dC;
      const ank = lq(knee, foot, .62), toe = Sp(s > 0 ? J.footR : J.footL, 1.9, 0, .3);
      limb(hip, knee, 1.45 * u * lw, 1.2 * u * lw, C.pants, far);
      limb(knee, ank, 1.2 * u * lw, 1.05 * u * lw, C.pants, far, .001);
      limb(ank, foot, 1.15 * u * lw, 1.05 * u * lw, C.boot, far, .002);
      limb(foot, toe, 1.0 * u * lw, .85 * u * lw, C.boot, far, .003);
    }
    // ---- outfit below the belt: tunic / robe / coat ----
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
    // ---- torso: a shaped front plate plus a core for depth, belt, seam, armor ----
    const shL = Sp(J.shL, 0, -.4, 0), shR = Sp(J.shR, 0, .4, 0), hL = Sp(J.hipL, 0, -.25, .5), hR = Sp(J.hipR, 0, .25, .5);
    const wL = lq(Sp(J.hipL, 0, -.2, 0), shL, .5), wR = lq(Sp(J.hipR, 0, .2, 0), shR, .5), core0 = Sp(J.hipC, 0, 0, .8), core1 = Sp(J.shC, 0, 0, -.4);
    const facingCam = S(2, 0, 6)[2] > S(0, 0, 6)[2];
    if (o.skeleton) ops.push({ d: dC, f: () => {   // rib cage cut by dark gaps (reads in every view), a bare spine, pelvis and collarbones
      const b = tones(C.skin), rib0 = Sp(J.shC, .2, 0, -.7), rib1 = lq(Sp(J.shC, .3, 0, -.7), Sp(J.hipC, .2, 0, 1), .55), gap = '#1a1018';
      cap(core0, rib1, .32 * u, .32 * u, b.sh); px.line(g, core0[0] - .5, core0[1], rib1[0] - .5, rib1[1], b.base);   // spine below the ribs
      const pl = Sp(J.hipL, 0, -.2, .9), pr = Sp(J.hipR, 0, .2, .9); cap(pl, pr, .75 * u, .75 * u, b.sh); cap(pl, pr, Math.max(.4, .75 * u - .8), Math.max(.4, .75 * u - .8), b.base, -.5, -.5);
      const rw = o.torsoW * .8 * u, rb = o.torsoW * .55 * u;
      cap(rib0, rib1, rw, rb, b.sh); cap(rib0, rib1, Math.max(.5, rw - .9), Math.max(.5, rb - .9), b.base, -.5, -.5);
      const len = rib1[1] - rib0[1];
      for (let i = 1; i <= 3; i++) {   // horizontal gaps between the ribs
        const y = Math.round(rib0[1] + len * (i / 4) + rw * .25), half = Math.max(1, (rw - (rw - rb) * i / 4) - 1.2), cx0 = lerp(rib0[0], rib1[0], i / 4);
        px.rect(g, cx0 - half, y, half * 2, 1, gap); px.rect(g, cx0 - half, y - 1, half * 2, 1, b.lt);
      }
      if (facingCam) { const s0 = Sp(J.shC, 1, 0, -.9), s1 = lq(Sp(J.shC, 1, 0, -.9), rib1, .8); px.line(g, s0[0], s0[1], s1[0], s1[1], b.hi); }   // sternum
      px.line(g, shL[0], shL[1], shR[0], shR[1], b.base, Math.max(1, Math.round(u * .5)));
    } });
    else ops.push({ d: dC, f: () => {
      const t = tones(C.cloth), plate = [shL, shR, [wR[0] - .3, wR[1]], hR, hL, [wL[0] + .3, wL[1]]];
      px.poly(g, plate, t.sh); cap(core0, core1, o.torsoW * .62 * u, o.torsoW * .72 * u, t.sh);
      px.poly(g, inset(plate, 1.1), t.base); cap(core0, core1, Math.max(.5, o.torsoW * .62 * u - .9), Math.max(.5, o.torsoW * .72 * u - .9), t.base, -.6, -.6);
      if (facingCam) { const n0 = Sp(J.shC, .9, 0, -.8), n1 = Sp(J.hipC, 1.1, 0, 1.4); px.line(g, n0[0], n0[1], n1[0], n1[1], t.sh); const c0 = Sp(J.shC, .7, -.9, -.2), c1 = Sp(J.shC, 1.1, 0, -1.3), c2 = Sp(J.shC, .7, .9, -.2); px.line(g, c0[0], c0[1], c1[0], c1[1], tones(C.trim || C.clothLt).base); px.line(g, c1[0], c1[1], c2[0], c2[1], tones(C.trim || C.clothLt).base); }
      else { const n0 = Sp(J.shC, .3, 0, -.6), n1 = Sp(J.hipC, .3, 0, 1.6); px.line(g, n0[0], n0[1], n1[0], n1[1], t.lt); }
      const bl = Sp(J.hipL, 0, -.3, .7), br = Sp(J.hipR, 0, .3, .7), bt = tones(C.belt);
      px.line(g, bl[0], bl[1], br[0], br[1], bt.sh, Math.max(1, Math.round(u * .7))); px.line(g, bl[0], bl[1] - 1, br[0], br[1] - 1, bt.base);
      if (facingCam) { const bk = Sp(J.hipC, 1.1, 0, .7); px.rect(g, bk[0] - 1, bk[1] - 1, 2, 2, bt.hi); }
      if (o.armor) { const m = tones(C.plate || C.metal); const p0 = Sp(J.shC, .5, 0, -1), p1 = Sp(J.hipC, .5, 0, 3.2); cap(p0, p1, o.torsoW * .5 * u, o.torsoW * .4 * u, m.sh); cap(p0, p1, o.torsoW * .5 * u - 1, o.torsoW * .4 * u - 1, m.base, -.6, -.6); px.dot(g, p0[0] - 1, p0[1] + 1, m.hi); }
    } });
    // ---- cape: cloth strip with folds ----
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
    // ---- flowing hair (long / ponytail) ----
    if (this._hairPts) {
      const P = this._hairPts, x0 = this.x, y0 = this.y, z0 = this.z, ht = tones(C.hair), w0 = (this.o.hair.style === 'ponytail' ? .9 : 1.5) * u;
      const PW = n => { const wx = n.x - x0, wy = n.y - y0, wz = n.z - z0; return [ox + vax * wx + vay * wy, oy + vbx * wx + vby * wy + vbz * wz, vdx * wx + vdy * wy + vdz * wz]; };
      const pts = P.map(PW);
      for (let i = 0; i < pts.length - 1; i++) { const r0 = w0 * (1 - i / pts.length * .75), r1 = w0 * (1 - (i + 1) / pts.length * .75); ops.push({ d: (pts[i][2] + pts[i + 1][2]) / 2 - .4, f: () => { cap(pts[i], pts[i + 1], r0, r1, ht.sh); cap(pts[i], pts[i + 1], Math.max(.4, r0 - .8), Math.max(.4, r1 - .8), i % 2 ? ht.base : ht.lt, -.5, -.5); } }); }
    }
    // ---- head: face, hair, eyes, hats ----
    const neck0 = Sp(J.shC, 0, 0, -.2), neck1 = Sp(J.head, 0, 0, -o.headR * .6);
    limb(neck0, neck1, .75 * u, .75 * u, C.skin, false, -.01);
    ops.push({ d: Q.head[2], f: () => {
      // head in layers: hair mass behind, a face set slightly forward, a hair cap with bangs, then eyes, brows and mouth
      const R = o.headR, r = R * u * .93, st = tones(C.skin), ht = tones(C.hair), hs = o.hair.style;
      const H = Sp(J.head, R * .1, 0, -R * .05), back = Sp(J.head, -R * .42, 0, R * .18), cap = Sp(J.head, -R * .2, 0, R * .74);
      const disc2 = (P0, rad, t, far) => { px.disc(g, P0[0], P0[1], rad, far ? t.deep : t.sh); px.disc(g, P0[0] - .6, P0[1] - .6, Math.max(.5, rad - 1), far ? t.sh : t.base); };
      if (o.skeleton) {   // skull: cranium, jaw, dark sockets with glowing eyes, nose hole and teeth
        const bt = tones(C.skin), jaw = Sp(J.head, R * .45, 0, -R * .78), gap = '#1a1018';
        disc2(jaw, r * .5, bt, false); disc2(H, r * .86, bt, false);
        if (r > 2.5) px.dot(g, H[0] - r * .4, H[1] - r * .45, bt.lt);
        const t0 = Sp(J.head, R * .72, -R * .34, -R * .5), t1 = Sp(J.head, R * .72, R * .34, -R * .5);   // tooth row: a dark gap with white teeth
        if ((t0[2] + t1[2]) / 2 > H[2] - .2) { px.line(g, t0[0], t0[1], t1[0], t1[1], gap, Math.max(1, Math.round(u * .6))); if (u > 1.3) for (let k = 0; k <= 4; k += 2) { const q = lq(t0, t1, k / 4); px.dot(g, q[0], q[1], bt.hi); } }
        for (const sd of [-1, 1]) {
          const E2 = Sp(J.head, R * .78, sd * R * .4, -R * .02); if (E2[2] <= H[2] + .1) continue;
          const br = Sp(J.head, R * .82, sd * R * .4, R * .3); px.line(g, br[0] - r * .3, br[1], br[0] + r * .3, br[1], bt.sh);   // brow ridge
          px.disc(g, E2[0], E2[1], Math.max(1, r * .38), gap); if (o.eyeGlow) { px.glow(g, 1); px.dot(g, E2[0], E2[1], o.eyeGlow); }
          const ck = Sp(J.head, R * .7, sd * R * .5, -R * .4); if (u > 1.5) px.dot(g, ck[0], ck[1], bt.sh);   // cheek hollow
        }
        const ns = Sp(J.head, R * .92, 0, -R * .28);
        if (ns[2] > H[2]) px.rect(g, ns[0], ns[1], 1, Math.max(1, Math.round(u * .6)), gap);
        if (o.hat) this._hat(g, Sp, J, r, H);
        return;
      }
      const bald = hs === 'bald', hairBehind = back[2] < H[2];
      if (!bald && hairBehind) disc2(back, r * .98, ht, false);
      disc2(H, r * .9, st, false);
      if (r > 2.5) px.dot(g, H[0] - r * .45, H[1] - r * .4, st.lt);
      // ears on the side that faces the camera
      if (hs !== 'long' && !o.hood && r > 2) for (const sd of [-1, 1]) { const ear = Sp(J.head, -R * .05, sd * R * .92, -R * .1); if (ear[2] > H[2] - R * .2) { px.disc(g, ear[0], ear[1], Math.max(.6, r * .2), st.sh); } }
      if (!bald) {
        if (!hairBehind) disc2(back, r * .98, ht, false);
        disc2(cap, r * .7, ht, false);   // the cap stops above the eyes; the fringe (bangs) covers the forehead
        const bangs = o.face && o.face.bangs !== undefined ? o.face.bangs : .7, fringe = Sp(J.head, R * .6, 0, R * .56);   // bangs over the forehead (face.bangs 0..1), clear of the eyes
        if (bangs > 0 && fringe[2] > H[2]) { const fr = r * .42 * bangs; px.disc(g, fringe[0], fringe[1], fr, ht.sh); px.disc(g, fringe[0] - .5, fringe[1] - .5, Math.max(.4, fr - .8), ht.base); }
        if (hs === 'spiky') for (const [df, dr, dz] of [[-1, 0, .7], [-.6, .7, .75], [-.6, -.7, .75], [-.25, .42, 1.02], [-.25, -.42, 1.02], [-1.1, 0, .05]]) {   // spikes sweep up and back
          const root = Sp(J.head, df * R * .6, dr * R * .6, dz * R * .6), tip = Sp(J.head, df * R * 1.55, dr * R * 1.55, dz * R * 1.55);
          const vx = tip[0] - root[0], vy = tip[1] - root[1], l = Math.hypot(vx, vy) || 1, nx = -vy / l * r * .42, ny = vx / l * r * .42;
          px.poly(g, [[root[0] + nx, root[1] + ny], [tip[0], tip[1]], [root[0] - nx, root[1] - ny]], ht.sh); px.poly(g, [[root[0] + nx * .5 - .5, root[1] + ny * .5 - .5], [tip[0] - .5, tip[1] - .5], [root[0] - nx * .2, root[1] - ny * .2]], ht.base);
        }
        px.dot(g, cap[0] - r * .35, cap[1] - r * .45, ht.hi); px.dot(g, cap[0] - r * .1, cap[1] - r * .55, ht.lt);
      }
      if (o.hood) { const tp = Sp(J.head, -R * 1.1, 0, R * .9); px.disc(g, tp[0], tp[1], r * .45, ht.base); }
      if (o.hat) this._hat(g, Sp, J, r, H);
      // face: eyes (with a catch-light when big enough), brows and a mouth, on the side facing the camera
      const big = o.face && o.face.eyes === 'big', eh = Math.max(1, Math.round(u * (big ? 1.4 : 1.05))), ew = u > 2.6 || (big && u > 1.8) ? 2 : 1;
      for (const sd of [-1, 1]) {
        const E2 = Sp(J.head, R * .9, sd * R * .36, -R * .02);
        if (E2[2] <= H[2] + .15) continue;
        if (o.eyeGlow) { px.glow(g, 1); px.rect(g, E2[0], E2[1], Math.max(1, ew + (u > 1.6 ? 1 : 0)), Math.max(1, eh - 1), o.eyeGlow); continue; }
        if (this.blink > 0 && this.hurtW < .5 && this.expr !== 'wince') {
          const top = E2[1] - eh + 1;
          if (eh >= 2 && u > 1.7) { px.rect(g, E2[0], top, ew, 1, C.eye); px.rect(g, E2[0], top + 1, ew, eh - 1, C.iris || '#3a4a8a'); px.dot(g, E2[0], top + 1, C.eyeWhite || '#ffffff'); }   // lash line, iris, catch-light
          else { px.rect(g, E2[0], top, ew, eh, C.eye); if (u > 1.7) px.dot(g, E2[0] + (ew > 1 ? 1 : 0), top, C.eyeWhite || '#ffffff'); }
        } else px.rect(g, E2[0] - (ew > 1 ? 1 : 0), E2[1], ew + 1, 1, C.eye);
        if (u > 2.2 && !bald) { const b0 = Sp(J.head, R * .9, sd * R * .22, R * .42), b1 = Sp(J.head, R * .86, sd * R * .52, R * .38); px.line(g, b0[0], b0[1] - 2, b1[0], b1[1] - 2, ht.sh); }   // brows on bigger heads, clear of the eyes
      }
      if (u > 1.9) {   // mouth: expr 'smile' | 'shout' | 'angry' | 'wince', and it moves while the rig talks (Dialog portraits)
        const m = Sp(J.head, R * .95, 0, -R * .5), ex = this.expr, open = ex === 'shout' || (this._talk && Math.floor(this.t * 9) % 2 === 0), w = u > 2.6 ? 2 : 1;
        if (m[2] > H[2]) {
          if (open) px.rect(g, m[0] - (w > 1 ? 1 : 0), m[1] - (ex === 'shout' ? 1 : 0), w + (ex === 'shout' ? 1 : 0), ex === 'shout' ? 3 : 2, '#4a1418');
          else if (ex === 'smile') { px.rect(g, m[0] - w, m[1], w * 2 + 1, 1, st.deep); px.dot(g, m[0] - w, m[1] - 1, st.deep); px.dot(g, m[0] + w, m[1] - 1, st.deep); }
          else px.rect(g, m[0] - (w > 1 ? 1 : 0), m[1], w, 1, this.hurtW > .3 || ex === 'wince' ? '#6a1a1a' : st.deep);
        }
        if (ex === 'angry' && u > 1.7) for (const sd of [-1, 1]) { const b0 = Sp(J.head, R * .9, sd * R * .15, R * .3), b1 = Sp(J.head, R * .86, sd * R * .55, R * .45); if (b0[2] > H[2]) px.line(g, b0[0], b0[1] - 1, b1[0], b1[1] - 1, ht.deep); }
      }
    } });
    // ---- arms, hands, shoulder pads ----
    for (const s of [-1, 1]) {
      const sh = s > 0 ? Q.shR : Q.shL, el = s > 0 ? Q.elbowR : Q.elbowL, hd = s > 0 ? Q.handR : Q.handL, far = el[2] < dC;
      const upper = o.sleeves === 'none' ? C.skin : C.cloth, lower = o.sleeves === 'long' ? C.cloth : C.skin;
      limb(sh, el, 1.15 * u * lw, 1.0 * u * lw, upper, far);
      limb(el, hd, 1.0 * u * lw, .9 * u * lw, lower, far, .001);
      const hc = C.glove || C.skin, ht = tones(hc);
      ops.push({ d: hd[2] + .02, f: () => { px.disc(g, hd[0], hd[1], Math.max(.6, .82 * u * lw - .35), far ? ht.deep : ht.sh); px.disc(g, hd[0] - .5, hd[1] - .5, Math.max(.4, .58 * u * lw - .35), far ? ht.sh : ht.base); } });
      if (o.armor) { const pad = Sp(s > 0 ? J.shR : J.shL, -.1, s * .3, .5), m = tones(C.plate || C.metal); ops.push({ d: sh[2] + .03, f: () => { px.disc(g, pad[0], pad[1], 1.55 * u, far ? m.deep : m.sh); px.disc(g, pad[0] - .6, pad[1] - .6, Math.max(.5, 1.55 * u - 1), far ? m.sh : m.base); px.dot(g, pad[0] - u * .8, pad[1] - u * .8, m.hi); } }); }
    }
    // ---- weapons ----
    if (o.weapon === 'gun') {
      const hd = J.handR, bd = J.bladeDir, Hn = Q.handR, mz = Sp(hd, bd[0] * 5.5, bd[1] * 5.5, bd[2] * 5.5), gp = Sp(hd, -bd[0] * .6, -bd[1] * .6, -bd[2] * .6 - 1.4), m = tones(C.metal);
      ops.push({ d: Hn[2] + .03, f: () => { cap(Hn, gp, .8 * u, .7 * u, m.deep); cap(Hn, mz, .95 * u, .75 * u, m.sh); cap(Hn, mz, Math.max(.4, .95 * u - .8), Math.max(.4, .75 * u - .8), m.base, -.5, -.5); px.dot(g, mz[0], mz[1], '#ffffff'); } });
    } else if (o.weapon === 'staff') {
      const hd = J.handR, bd = J.bladeDir, Hn = Q.handR, top = Sp(hd, bd[0] * 10, bd[1] * 10, bd[2] * 10), bot = Sp(hd, -bd[0] * 7, -bd[1] * 7, -bd[2] * 7), wt = tones(C.staff || '#8a5a32'), ot = tones(C.orb || '#7fe3ff');
      ops.push({ d: (Hn[2] + top[2]) / 2, f: () => { cap(bot, top, .6 * u, .6 * u, wt.sh); px.line(g, bot[0] - .5, bot[1] - .5, top[0] - .5, top[1] - .5, wt.lt); px.glow(g, 1); px.disc(g, top[0], top[1], Math.max(1, u * 1.5), ot.sh); px.disc(g, top[0] - .6, top[1] - .6, Math.max(.6, u * 1.5 - 1), ot.base); px.dot(g, top[0] - 1, top[1] - 1, '#ffffff'); } });
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
  /** classic style: thin stick limbs (cheapest; good for huge crowds) */
  _drawClassic(g, ox, oy, view) {
    const o = this.o, C = this.C, J = this.J, sc = view.scale * o.size, ops = this._ops || (this._ops = []);
    ops.length = 0;
    // local (f, r, z) -> [screen x, screen y, depth], with facing, spin and squash applied
    const an = this.facing + this.spin + this._cheat, ca = Math.cos(an), sa = Math.sin(an), k = (1 - this.sq * .4) * o.size, kz = (1 + this.sq) * o.size;
    const vax = view.ax, vay = view.ay, vbx = view.bx, vby = view.by, vbz = view.bz, vdx = view.dx, vdy = view.dy, vdz = view.dz;
    const S = (f, r, z) => { const wx = (f * ca - r * sa) * k, wy = (f * sa + r * ca) * k, wz = z * kz; return [ox + vax * wx + vay * wy, oy + vbx * wx + vby * wy + vbz * wz, vdx * wx + vdy * wy + vdz * wz]; };
    const Sp = this._offsets(S);   // details around a joint (face, hair, belt, toes) turn with the body
    const Q = {};
    for (const key of JOINT_KEYS) Q[key] = Sp(J[key]);
    const lq = (A, B, t) => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
    const lw = Math.max(1, Math.round(o.limbW * sc * .75)), tw = Math.max(2, Math.round(o.torsoW * sc * .9));
    const dC = (Q.hipC[2] + Q.shC[2]) * .5;
    const seg = (A, B, c, w) => ops.push({ d: (A[2] + B[2]) * .5, f: () => px.line(g, A[0], A[1], B[0], B[1], c, w) });
    for (const s of [-1, 1]) {
      const hip = s > 0 ? Q.hipR : Q.hipL, knee = s > 0 ? Q.kneeR : Q.kneeL, foot = s > 0 ? Q.footR : Q.footL;
      const far = knee[2] < dC, pc = far ? C.pantsDk : C.pants, bc = far ? C.bootDk : C.boot, ank = lq(knee, foot, .55), toe = Sp(s > 0 ? J.footR : J.footL, .8, 0, 0);
      seg(hip, knee, pc, lw); seg(knee, ank, pc, lw); seg(ank, foot, bc, lw);
      ops.push({ d: foot[2] + .01, f: () => px.rect(g, toe[0] - 1, toe[1] - 1, 2, 2, bc) });
    }
    ops.push({
      d: dC, f: () => {
        const a = Q.shL, b = Q.shR, h = Q.hipC, sh = Q.shC;
        px.poly(g, [a, b, Q.hipR, Q.hipL], C.cloth);
        px.line(g, h[0], h[1], sh[0], sh[1], C.cloth, tw);
        px.line(g, a[0], a[1], b[0], b[1], C.cloth, 2);
        const bl = Sp(J.hipL, 0, 0, .6), br = Sp(J.hipR, 0, 0, .6); px.line(g, bl[0], bl[1], br[0], br[1], C.belt);
        if (S(2, 0, 6)[2] > S(0, 0, 6)[2]) { const n0 = Sp(J.shC, .6, 0, -.3), n1 = Sp(J.hipC, .9, 0, 2); px.line(g, n0[0], n0[1], n1[0], n1[1], C.clothLt); }
      }
    });
    if (this.capeL) {
      const L = this.capeL, R = this.capeR, x0 = this.x, y0 = this.y, z0 = this.z;
      const PW = n => { const wx = n.x - x0, wy = n.y - y0, wz = n.z - z0; return [ox + vax * wx + vay * wy, oy + vbx * wx + vby * wy + vbz * wz, vdx * wx + vdy * wy + vdz * wz]; };
      for (let i = 0; i < L.length - 1; i++) {
        const q = [PW(L[i]), PW(R[i]), PW(R[i + 1]), PW(L[i + 1])];
        ops.push({ d: (q[0][2] + q[2][2]) / 2 - .6, f: () => { let ar = 0; for (let m = 0; m < 4; m++) { const A = q[m], B = q[(m + 1) % 4]; ar += A[0] * B[1] - B[0] * A[1]; } px.poly(g, q, ar > 0 ? C.cape : C.capeIn); } });
      }
    }
    ops.push({
      d: Q.head[2], f: () => {
        const H = Q.head, r = o.headR * sc * .9;
        px.disc(g, H[0], H[1], r, C.skin);
        const hc = Sp(J.head, -.95, 0, .95); px.disc(g, hc[0], hc[1], r * (o.hood ? 1.05 : .95), C.hair);
        if (o.hood) { const tp = Sp(J.head, -o.headR * 1.1, 0, o.headR * .9); px.disc(g, tp[0], tp[1], r * .45, C.hair); }
        if (o.hat) this._hat(g, Sp, J, r, H);
        for (const s of [-1, 1]) {
          const E2 = Sp(J.head, o.headR * .82, s * 1.25, .2);
          if (E2[2] > H[2] + .3) { if (o.eyeGlow) px.rect(g, E2[0], E2[1], 1, 1, o.eyeGlow); else if (this.blink > 0 && this.hurtW < .5) px.rect(g, E2[0], E2[1] - (sc > 1.45 ? 1 : 0), 1, sc > 1.45 ? 2 : 1, C.eye); else px.dot(g, E2[0], E2[1], C.eye); }
        }
      }
    });
    for (const s of [-1, 1]) {
      const sh = s > 0 ? Q.shR : Q.shL, el = s > 0 ? Q.elbowR : Q.elbowL, hd = s > 0 ? Q.handR : Q.handL, far = el[2] < dC;
      seg(sh, el, far ? C.clothDk : C.cloth, lw); seg(el, hd, far ? C.skinDk : C.skin, lw);
      ops.push({ d: hd[2] + .02, f: () => px.rect(g, hd[0] - 1, hd[1] - 1, 2, 2, far ? C.skinDk : C.skin) });
    }
    if (o.weapon === 'gun') {
      const hd = J.handR, bd = J.bladeDir, Hn = Q.handR, mz = Sp(hd, bd[0] * 5, bd[1] * 5, bd[2] * 5), gp = Sp(hd, -bd[0] * .6, -bd[1] * .6, -bd[2] * .6 - 1.2);
      ops.push({ d: Hn[2] + .03, f: () => { px.line(g, Hn[0], Hn[1], gp[0], gp[1], C.metalDk, 2); px.line(g, gp[0], gp[1], mz[0], mz[1], C.metalDk, 2); px.line(g, Hn[0], Hn[1] - 1, mz[0], mz[1] - 1, C.metal); px.dot(g, mz[0], mz[1], '#ffffff'); } });
    } else if (o.weapon === 'staff') {
      const hd = J.handR, bd = J.bladeDir, Hn = Q.handR, top = Sp(hd, bd[0] * 10, bd[1] * 10, bd[2] * 10), bot = Sp(hd, -bd[0] * 7, -bd[1] * 7, -bd[2] * 7);
      ops.push({ d: (Hn[2] + top[2]) / 2, f: () => { px.line(g, bot[0], bot[1], top[0], top[1], C.staff || '#8a5a32', Math.max(1, Math.round(sc * .9))); px.glow(g, 1); px.disc(g, top[0], top[1], Math.max(1, sc * 1.4), C.orb || '#7fe3ff'); px.dot(g, top[0] - 1, top[1] - 1, '#ffffff'); } });
    }
    if (o.weapon === 'sword') {
      const hd = J.handR, bd = J.bladeDir, L = o.bladeLen, Hn = Q.handR, sl = Math.hypot(bd[0], bd[1]) || 1, sx = -bd[1] / sl * 1.6, sy = bd[0] / sl * 1.6;
      const tip = Sp(hd, bd[0] * L, bd[1] * L, bd[2] * L), b0 = Sp(hd, bd[0] * 1.4, bd[1] * 1.4, bd[2] * 1.4), pom = Sp(hd, -bd[0] * 1.2, -bd[1] * 1.2, -bd[2] * 1.2);
      const g0 = Sp(hd, bd[0] * 1.4 + sx, bd[1] * 1.4 + sy, bd[2] * 1.4), g1 = Sp(hd, bd[0] * 1.4 - sx, bd[1] * 1.4 - sy, bd[2] * 1.4);
      ops.push({
        d: (Hn[2] + tip[2]) / 2, f: () => {
          px.line(g, pom[0], pom[1], Hn[0], Hn[1], '#5a3620'); px.line(g, g0[0], g0[1], g1[0], g1[1], C.hilt);
          px.line(g, b0[0] + 1, b0[1], tip[0], tip[1], C.metalDk); px.line(g, b0[0], b0[1], tip[0], tip[1], C.metal); px.dot(g, tip[0], tip[1], '#ffffff');
        }
      });
    }
    ops.sort((a, b) => a.d - b.d);
    for (const op of ops) op.f();
  }
  _hat(g, Sp, J, r, H) {
    const h = this.o.hat, st = h.style || 'cap', c = h.color || '#d83a2a', R = this.o.headR, dk = shade(c, -.3);
    if (st === 'cap') {            // plumber / baseball cap with a brim facing forward
      const t = Sp(J.head, -.4, 0, R * .55), b = Sp(J.head, R * 1.05, 0, R * .25), b2 = Sp(J.head, R * 1.7, 0, R * .1);
      px.disc(g, t[0], t[1], r * .92, c); px.line(g, b[0], b[1], b2[0], b2[1], dk, 2);
    } else if (st === 'pointed') { // elf / wizard cap flopping backward (two triangles so it reads from the side and the front)
      const a = Sp(J.head, R * .2, -R * .95, R * .45), b = Sp(J.head, R * .2, R * .95, R * .45), f = Sp(J.head, R * .75, 0, R * .5), k = Sp(J.head, -R * .9, 0, R * .25), tip = Sp(J.head, -R * 2.3, 0, R * 1.6);
      px.poly(g, [f, k, tip], c); px.poly(g, [a, b, tip], c); px.line(g, a[0], a[1], b[0], b[1], dk); px.line(g, f[0], f[1], k[0], k[1], dk);
    } else if (st === 'helmet') {  // robot / knight helmet that leaves the face open
      const t = Sp(J.head, -.8, 0, .6), cr = Sp(J.head, 0, 0, R * 1.05);
      px.disc(g, t[0], t[1], r * 1.02, c); px.disc(g, cr[0], cr[1], Math.max(1, r * .28), shade(c, .35));
      const f = Sp(J.head, R * .75, 0, -.2); px.disc(g, f[0], f[1], r * .55, this.C.skin);
    } else if (st === 'band') {    // headband around the forehead with two tails
      const a = Sp(J.head, R * .6, -R * .9, R * .55), b = Sp(J.head, R * .6, R * .9, R * .55), f = Sp(J.head, R * .95, 0, R * .5), k = Sp(J.head, -R * .95, 0, R * .5), t2 = Sp(J.head, -R * 2.2, -.6, -.4), t3 = Sp(J.head, -R * 2, .6, -1.2);
      px.line(g, a[0], a[1], b[0], b[1], c, 2); px.line(g, f[0], f[1], k[0], k[1], c, 2); px.line(g, k[0], k[1], t2[0], t2[1], c); px.line(g, k[0], k[1], t3[0], t3[1], c);
    } else if (st === 'crown') {
      for (const k of [-1, 0, 1]) { const p = Sp(J.head, 0, k * R * .6, R * .9), q = Sp(J.head, 0, k * R * .6, R * 1.6); px.line(g, p[0], p[1], q[0], q[1], c, 2); }
      const a = Sp(J.head, 0, -R * .8, R * .85), b = Sp(J.head, 0, R * .8, R * .85); px.line(g, a[0], a[1], b[0], b[1], c, 2);
    }
    void H;
  }
  /** motion smear for the current swing, queued in front of the rig */
  drawSmear(r, colors = ['#ffffff', '#dff8ff', '#8fe0f2', '#4bb1d4']) {
    const T = this.trail;
    if (T.length >= 2) {   // ribbon along the real blade path: correct in side, top-down and every other view
      r.queue(this.x, this.y, this.z + 1, g => {
        const lv = this._lastView, cv = lv && lv.id === r.view.id ? lv : this.o.charView !== false ? charView(r.view) : r.view;   // the angle the rig was drawn from
        const W = cv === r.view ? (p, w) => r.w(w[0], w[1], w[2]) : (p, w) => { const s = r.w(p.o[0], p.o[1], p.o[2]), q = cv.p(w[0] - p.o[0], w[1] - p.o[1], w[2] - p.o[2]); return [s[0] + q[0], s[1] + q[1]]; };
        px.glow(g, .85);
        const n = T.length - 1, taper = (p, u) => V3.lerp(p.t, p.b, .25 + .75 * u);   // older samples are narrower
        for (let i = 0; i < n; i++) {
          const p0 = T[i], p1 = T[i + 1], f = 1 - p1.age / .14, u0 = i / n, u1 = (i + 1) / n;
          const pts = [W(p0, taper(p0, u0)), W(p0, p0.t), W(p1, p1.t), W(p1, taper(p1, u1))];
          px.polyDither(g, pts, colors[u1 > .85 ? 1 : u1 > .55 ? 2 : 3], (.35 + .65 * u1) * f, r.ix, r.iy);
        }
        // hot core: a bright line along the tip path, strongest at the newest end
        const last = T[n];
        if (last.w >= 1) {   // blades get a hot core line and a glint at the tip while the swing is fresh; fists and feet just the ribbon
          for (let i = Math.max(0, n - 5); i < n; i++) { const [ax, ay] = W(T[i], T[i].t), [bx, by] = W(T[i + 1], T[i + 1].t); px.line(g, ax, ay, bx, by, i >= n - 2 ? colors[0] : colors[1], i >= n - 1 ? 2 : 1); }
          if (last.age < .06) { const [tx, ty] = W(last, last.t); px.dot(g, tx, ty, '#ffffff'); }
        }
      }, { bias: .6, emissive: true });
      return;
    }
    const s = this._smear; if (!s || s.fade <= 0 || r.view.pitchDeg < 30) return;
    const x = this.x, y = this.y, z = this.z + s.z, span = s.a1 - s.a0;
    if (Math.abs(span) < .05) return;
    r.queue(x, y, this.z + 1, g => {
      px.glow(g, .85);
      const n = Math.max(4, Math.ceil(Math.abs(span) / .16));
      for (let i = 0; i < n; i++) {
        const u0 = i / n, u1 = (i + 1) / n, a0 = s.a0 + span * u0, a1 = s.a0 + span * u1;
        const rin0 = s.r1 - (s.r1 - s.r0) * (.2 + .8 * u0), rin1 = s.r1 - (s.r1 - s.r0) * (.2 + .8 * u1);
        const pts = [r.w(x + Math.cos(a0) * s.r1, y + Math.sin(a0) * s.r1, z), r.w(x + Math.cos(a1) * s.r1, y + Math.sin(a1) * s.r1, z), r.w(x + Math.cos(a1) * rin1, y + Math.sin(a1) * rin1, z), r.w(x + Math.cos(a0) * rin0, y + Math.sin(a0) * rin0, z)];
        const c = colors[u1 > .85 ? 0 : u1 > .6 ? 1 : u1 > .3 ? 2 : 3];
        px.polyDither(g, pts, c, (.25 + .75 * u1) * s.fade, r.ix, r.iy);
      }
    }, { bias: .6 });
  }
  /** skeleton overlay for debugging, draws straight into the buffer */
  debug(r) {
    const J = this.J, g = r.tgt, [ox, oy] = r.w(this.x, this.y, this.z);
    const P = p => { const w = this._w(p), s = r.view.p(w[0], w[1], w[2]); return [ox + s[0], oy + s[1]]; };
    const L = (a, b, c) => { const A = P(a), B = P(b); px.line(g, A[0], A[1], B[0], B[1], c); };
    L(J.hipL, J.kneeL, '#2aa6c0'); L(J.kneeL, J.footL, '#2aa6c0'); L(J.hipR, J.kneeR, '#46f0ff'); L(J.kneeR, J.footR, '#46f0ff');
    L(J.shL, J.elbowL, '#b04a98'); L(J.elbowL, J.handL, '#b04a98'); L(J.shR, J.elbowR, '#ff5ad1'); L(J.elbowR, J.handR, '#ff5ad1');
    L(J.hipL, J.hipR, '#ffe45a'); L(J.shL, J.shR, '#ffe45a'); L(J.hipC, J.shC, '#ffe45a'); L(J.shC, J.head, '#ffe45a');
    if (this.o.weapon) L(J.handR, V3.add(J.handR, V3.mul(J.bladeDir, this.o.bladeLen)), '#ffffff');
    for (const k of ['hipL', 'hipR', 'kneeL', 'kneeR', 'footL', 'footR', 'shL', 'shR', 'elbowL', 'elbowR', 'handL', 'handR', 'head']) { const p = P(J[k]); px.dot(g, p[0], p[1], '#ffffff'); }
    if (this.capeL) for (const n of [...this.capeL, ...this.capeR]) { const [x, y] = r.w(n.x, n.y, n.z); px.dot(g, x, y, '#ff8a2a'); }
  }
}
E.Humanoid = Humanoid;

/**
 * Attack: the wind-up / active / recover timer every melee game needs (swords, punches, kicks, claws).
 *   const slash = new E.Attack({ a0: 1.6, a1: -1.7, z0: 12, z1: 9, reach: 7.5, wind: .06, active: .1, recover: .18 });
 *   if (input.buffered('attack') && slash.start()) input.consume('attack');
 *   slash.update(dt);                                     // returns the phase that just began ('active' = play the swing sound)
 *   if (slash.active) slash.hits(enemies, e => E.inArc(hero, facing, e, 22, 1.4), e => { ...damage e once per swing... });
 *   rig.update(dt, { ..., attack: slash.state });        // null when idle
 * spec durations are in seconds; the rest of the spec is the Humanoid attack spec.
 */
class Attack {
  /** new E.Attack(spec) or new E.Attack('slash', { reach: 9 }): a name from E.MOVES plus overrides */
  constructor(spec = {}, over) {
    if (typeof spec === 'string') { const m = E.MOVES[spec]; if (!m) warn('move:' + spec, 'unknown move "' + spec + '". Moves: ' + Object.keys(E.MOVES).join(', ')); spec = Object.assign({ name: spec, hitAt: .35 }, m || E.MOVES.slash, over); }
    else if (over) spec = Object.assign({}, spec, over);
    /** spec: the move: seconds of wind, active and recover, and its shape for the rig (a0, a1, z0, z1, reach,
     *  hitAt); phase: 'wind' | 'active' | 'recover', or null when idle; t: seconds into the phase; hit: the targets
     *  this swing has hit (each is hit once) */
    this.spec = Object.assign({ wind: .06, active: .1, recover: .18 }, spec); this.phase = null; this.t = 0; this.hit = new Set();
  }
  /** begin a swing if idle (or when canCancel and already recovering). Returns true if it started */
  start(canCancel = false) {
    if (this.phase && !(canCancel && this.phase === 'recover')) return false;
    this.phase = 'wind'; this.t = 0; this.hit.clear(); return true;
  }
  /** true from the wind-up to the end of the recovery */
  get busy() { return !!this.phase; }
  /** true while the strike can connect */
  get active() { return this.phase === 'active'; }
  /** 0..1 progress through the current phase */
  get u() { return this.phase ? clamp(this.t / this.spec[this.phase], 0, 1) : 0; }
  /** what Humanoid.update wants as `attack` (null when idle) */
  get state() { return this.phase ? { spec: this.spec, phase: this.phase, u: this.u } : null; }
  /** advance the swing by dt seconds; returns the phase that began during it ('active' = play the swing sound), or
   *  null */
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
  /** during 'active', call fn(target) once per swing for each target where test(target) is true. Returns how many were hit */
  hits(targets, test, fn) {
    if (this.phase !== 'active' || this.u < (this.spec.hitAt || 0)) return 0;   // hitAt: share of the swing before it can connect
    let n = 0;
    for (const t of targets) { if (!t || t.dead || this.hit.has(t) || !test(t)) continue; this.hit.add(t); n++; fn(t); }
    return n;
  }
  /** stop the swing at once (hurt, dodged into) */
  cancel() { this.phase = null; this.t = 0; }
}
E.Attack = Attack;

/**
 * Combo: a chain of attacks (a 3-hit punch string, a sword combo). Press again during the recover of one
 * hit (or within `window` seconds after it ends) to flow into the next; otherwise it starts over.
 *   const combo = new E.Combo([jab, jab2, uppercut], { window: .3 });   // each item is an Attack spec
 *   if (input.buffered('attack') && combo.press()) input.consume('attack');
 *   combo.update(dt); combo.hits(enemies, test, e => {...}); rig.update(dt, { ..., attack: combo.state });
 *   combo.step = index of the current hit (0, 1, 2), combo.current = its Attack
 */
class Combo {
  /** new E.Combo(items, { window: .3 }): items are move names, specs or Attacks. moves: the Attacks; window: seconds
   *  after a hit ends that a press still chains; step: the index of the current hit (-1 before the first); idle:
   *  seconds since the last hit ended */
  constructor(specs, o = {}) { this.moves = specs.map(sp => sp instanceof Attack ? sp : new Attack(sp)); this.window = o.window === undefined ? .3 : o.window; this.step = -1; this.idle = 99; }   // items: specs, Attacks or move names
  /** the Attack of the current hit */
  get current() { return this.moves[Math.max(0, this.step)]; }
  /** true while a hit of the chain is swinging */
  get busy() { return this.step >= 0 && this.current.busy; }
  /** true while the current hit can connect */
  get active() { return this.busy && this.current.active; }
  /** what Humanoid.update wants as `attack` (null when idle) */
  get state() { return this.busy ? this.current.state : null; }
  /** start or continue the chain. Returns true if a hit started */
  press() {
    const cur = this.step >= 0 ? this.current : null;
    if (cur && cur.busy && cur.phase !== 'recover') return false;
    const next = (cur && (cur.busy || this.idle <= this.window) && this.step + 1 < this.moves.length) ? this.step + 1 : 0;
    if (cur && cur.busy) cur.cancel();
    this.step = next; this.idle = 0; return this.moves[next].start();
  }
  /** advance the current hit; returns the phase that began, as Attack.update */
  update(dt) { if (this.step < 0) return null; const r = this.current.update(dt); if (!this.current.busy) this.idle += dt; return r; }
  /** the current hit's hits(targets, test, fn): fn(target) once per swing where test(target) is true */
  hits(targets, test, fn) { return this.step >= 0 ? this.current.hits(targets, test, fn) : 0; }
  /** stop the chain; the next press starts it over */
  cancel() { if (this.step >= 0) this.current.cancel(); this.step = -1; this.idle = 99; }
}
E.Combo = Combo;
/**
 * E.MOVES: a library of named attacks with timing and body motion (anticipation, lunge, step, twist, hop).
 *   new E.Attack('overhead'), new E.Attack('thrust', { reach: 10 }), new E.Combo(['jab', 'cross', 'hook', 'uppercut'])
 *   rig.update(dt, { ..., attack: E.move('roundhouse', .5) })   // any move at any moment, for previews and cutscenes
 * The same move works on every build and in every view: heights are relative to the shoulders (rel: true), reaches scale
 * with arm length, and horizontal swings turn into screen-plane swings in side views. A move's spec fields:
 * - a0, a1, z0, z1: a0 / a1 angles (+ = the right side, or up in the screen plane), z0 / z1 heights
 * - reach, r0, r1, hand, plane, blade: reach, or r0 / r1 (an extending thrust); hand: 'R' | 'L' | 'both', plane: 'side'
 *   (always vertical), blade: 0 (no trail)
 * - wind, active, recover: the phases' seconds
 * - kick, spin, lunge, hop, crouch, lean, twist, hold: the body's motion (kick: true swings the right foot)
 */
E.MOVES = {
  // blades, staves and clubs (the right hand)
  slash:      { rel: true, a0: 1.7, a1: -1.7, z0: -6, z1: -9, reach: 7.5, wind: .08, active: .1, recover: .22 },
  backslash:  { rel: true, a0: -1.5, a1: 1.6, z0: -8, z1: -5, reach: 7.5, wind: .07, active: .1, recover: .2, lunge: .8 },
  overhead:   { rel: true, plane: 'side', a0: 2.4, a1: -1.25, reach: 7, wind: .16, active: .09, recover: .26, lunge: 2, crouch: .35, lean: .4 },
  rising:     { rel: true, plane: 'side', a0: -1.35, a1: 2.1, reach: 7, wind: .09, active: .11, recover: .24, hop: 3.5, lunge: .8, crouch: .4 },
  thrust:     { rel: true, a0: .12, a1: 0, z0: -5, z1: -4, r0: 3, r1: 10, wind: .11, active: .07, recover: .22, lunge: 3, lean: .5 },
  spin:       { rel: true, a0: 1.3, a1: 1.3, spin: true, z0: -6, z1: -6, reach: 8, wind: .09, active: .3, recover: .18, lunge: 0, lean: .1 },
  plunge:     { rel: true, plane: 'side', a0: -1.45, a1: -1.5, r0: 5, r1: 9, wind: .06, active: .25, recover: .15, lunge: 0, lean: .1 },
  twohand:    { rel: true, hand: 'both', plane: 'side', a0: 2.5, a1: -1.4, reach: 6.5, wind: .2, active: .1, recover: .3, lunge: 2.4, crouch: .5, lean: .5 },
  // fists (jab leads with the left)
  jab:        { rel: true, hand: 'L', a0: .05, a1: 0, z0: -1, z1: -.5, r0: 3, r1: 8.6, wind: .035, active: .06, recover: .13, lunge: .9, lean: .22, blade: 0 },
  cross:      { rel: true, a0: .25, a1: 0, z0: -1, z1: -.5, r0: 2.5, r1: 8.8, wind: .06, active: .07, recover: .17, lunge: 1.8, lean: .38, twist: 1.8, blade: 0 },
  hook:       { rel: true, a0: 1.45, a1: -.4, z0: -.5, z1: 0, reach: 6.8, wind: .08, active: .09, recover: .2, lunge: 1.3, lean: .3, twist: 1.5, blade: 0 },
  uppercut:   { rel: true, plane: 'side', a0: -1.15, a1: .95, reach: 7.2, wind: .11, active: .09, recover: .26, crouch: .6, hop: 2.5, lunge: 1.2, lean: .2, blade: 0 },
  haymaker:   { rel: true, a0: 2.1, a1: -.5, z0: 1, z1: -1, reach: 7.8, wind: .22, active: .1, recover: .3, lunge: 2.6, lean: .5, twist: 1.6, blade: 0 },
  elbow:      { rel: true, a0: .9, a1: -.3, z0: -.5, z1: 0, reach: 3.5, wind: .05, active: .07, recover: .16, lunge: 1, twist: 1.4, blade: 0 },
  // kicks (the right foot; heights are shares of hip height)
  kick:       { rel: true, kick: true, a0: .1, a1: 0, z0: .35, z1: .8, reach: 6.5, wind: .07, active: .09, recover: .2 },
  roundhouse: { rel: true, kick: true, a0: 1.7, a1: -.45, z0: 1, z1: 1.55, reach: 7, wind: .1, active: .13, recover: .24, twist: 1.3, lean: -.3 },
  sweep:      { rel: true, kick: true, a0: 1.9, a1: -1.7, z0: .08, z1: .08, reach: 7.5, wind: .08, active: .16, recover: .24, crouch: .9, lean: .3 },
  flyingkick: { rel: true, kick: true, a0: .1, a1: 0, z0: .5, z1: .75, reach: 7.5, wind: .1, active: .22, recover: .24, hop: 7, lunge: 3.5, lean: -.35 },
  knee:       { rel: true, kick: true, a0: 0, a1: 0, z0: .45, z1: .85, reach: 2, wind: .06, active: .08, recover: .18, lean: .2, lunge: 1 },
  axekick:    { rel: true, kick: true, a0: .2, a1: 0, z0: 2, z1: .5, reach: 4.8, wind: .14, active: .08, recover: .24, lean: -.2 },
  // magic, throws and shoves
  cast:       { rel: true, hand: 'both', plane: 'side', a0: 1.4, a1: .1, reach: 8, wind: .22, active: .12, recover: .32, lunge: .6, lean: .15, blade: 0 },
  throw:      { rel: true, plane: 'side', a0: 2.5, a1: -.25, reach: 7.5, wind: .16, active: .08, recover: .24, lunge: 1.8, lean: .45, blade: 0 },
  bash:       { rel: true, hand: 'both', plane: 'side', a0: 1, a1: -.35, reach: 5, wind: .12, active: .07, recover: .24, lunge: 3, hop: 1.2, crouch: .45, lean: .55, blade: 0 },   // a short, heavy shove (pommel, shield or shoulder)
  claw:       { rel: true, a0: 1.2, a1: -1, z0: 1, z1: -4, reach: 7, wind: .12, active: .08, recover: .24, lunge: 1.8, lean: .4, blade: 0 }
};
/** the attack state of any move at a moment, for previews: rig.update(dt, { attack: E.move('uppercut', .4, 'active') }) */
const _moveSpecs = {};
/** any move from E.MOVES at any moment, for previews and cutscenes: rig.update(dt, { ..., attack:
 *  E.move('roundhouse', .5) }) (u 0..1 through phase) */
E.move = (name, u = .5, phase = 'active') => ({ spec: _moveSpecs[name] || (_moveSpecs[name] = Object.assign({ name, wind: .06, active: .1, recover: .18 }, E.MOVES[name] || E.MOVES.slash)), phase, u });
/** push a target away from a point (attacker): uses target.push (E.Body) or its vx / vy. up = upward speed (knock into the air) */
E.knockback = (from, target, speed = 160, up = 0) => {
  const dx = target.x - from.x, dy = (target.y || 0) - (from.y || 0), d = Math.hypot(dx, dy) || 1, ix = dx / d * speed, iy = dy / d * speed;
  if (typeof target.push === 'function') target.push(ix, iy, up);
  else { target.vx = (target.vx || 0) + ix; target.vy = (target.vy || 0) + iy; if (up) target.vz = (target.vz || 0) + up; }
  return target;
};

/* =============================================================================
 * 12. BLOB RIG  (slimes, jellies) squash-and-stretch sphere that looks at a target
 * ============================================================================= */
class Blob {
  /** new E.Blob({ R: 6.5, colors, ears, horns, wings, feet, tail, mouth, face }): a squash-and-stretch rig for slimes and
   *  jellies; blob.update(dt, state) each step, blob.draw(g, ox, oy, view) in an r.actor */
  constructor(o = {}) {
    /** o: its options (R: the radius, 6.5; ears, horns, wings, feet, tail, mouth, face, colors) */
    this.o = Object.assign({ R: 6.5 }, o);
    /** C: its colors: dk, base, lt, spec, eye, pupil */
    this.C = Object.assign({ dk: '#6d2658', base: '#c95f9a', lt: '#f5a3cc', spec: '#fff2f8', eye: '#ffffff', pupil: '#2a0f24' }, o.colors || {});
    /** sq: squash -0.45..0.45 (- flat, + tall); sqV: its speed; target: the squash it springs toward; look: where
     *  its eyes look, a ground direction; t: its clock, seconds; squint: eyes narrowed; scale: drawing scale (1) */
    this.sq = 0; this.sqV = 0; this.target = 0; this.look = [1, 0]; this.t = 0; this.squint = false; this.scale = 1;
  }
  /** a squash kick: + stretches (a hop), - squashes (a landing, a hit) */
  kick(v) { this.sqV += v; }
  /** s: {squash target -0.4..0.4, look:[dx,dy] ground dir, squint} */
  update(dt, s = {}) {
    this.t += dt;
    const target = s.squash || 0;
    this.sqV += (-(this.sq - target) * 320 - 14 * this.sqV) * dt; this.sq = clamp(this.sq + this.sqV * dt, -.45, .45);
    if (s.look) { const l = Math.hypot(s.look[0], s.look[1]); if (l > .01) { this.look[0] = lerp(this.look[0], s.look[0] / l, Math.min(1, dt * 8)); this.look[1] = lerp(this.look[1], s.look[1] / l, Math.min(1, dt * 8)); } }
    /** walk: 0..1, how fast it is walking (its feet patter) */
    this.squint = !!s.squint; this.walk = s.walk || 0;
    /** flap: the wings' speed now, 0 (folded) .. 1; flapP: the wing beat's phase; hang: roosting upside down */
    this.flap = approach(this.flap === undefined ? 1 : this.flap, s.flap === undefined ? 1 : s.flap, dt * 6); this.flapP = (this.flapP || 0) + dt * 14 * this.flap; this.hang = !!s.hang;   // wings: flap speed 0..1 (0 folds them); hang: roost upside down
  }
  /**
   * draw(g, ox, oy, view). Creature features from the constructor options:
   *   ears: 'rabbit' | 'cat', horns: true, wings: true (flapping bat wings), feet: true, tail: true,
   *   mouth: true | 'fangs', face: 'front' (eyes always on the camera side, for Mana-style monsters)
   * update(dt, { flap: 0..1, hang: true }) slows or folds the wings and hangs a bat upside down from its anchor.
   */
  draw(g, ox, oy, view) {
    if (!this.hang) return this._drawBody(g, ox, oy, view);
    const pv = Math.round(oy - this.o.R * this.scale * view.scale);   // flip around the body's middle
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
    // behind the body: wings, ears, tail
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
    // body with shading
    px.ell(g, cx, cy, rx, ry, C.dk);
    px.ell(g, cx + .5, cy - .8, Math.max(1, rx - 1.2), Math.max(1, ry - 1.3), C.base);
    px.ell(g, cx - rx * .15, cy + ry * .35, Math.max(1, rx * .7), Math.max(.6, ry * .3), tb.sh);
    px.ell(g, cx + rx * .3, cy - ry * .42, Math.max(1, rx * .38), Math.max(.6, ry * .28), C.lt);
    px.rect(g, cx + rx * .45, cy - ry * .6, 2, 1, C.spec);
    if (o.feet) for (const sd of [-1, 1]) { const st = Math.sin(t * 9 + sd) * (this.walk || 0); px.ell(g, cx + sd * rx * .45 + st, cy + ry * .9, Math.max(1.2, rx * .28), Math.max(.8, ry * .16), ext); }
    if (o.horns) for (const sd of [-1, 1]) { const hx = cx + sd * rx * .45, hy = cy - ry * .72; px.poly(g, [[hx - sd * rx * .15, hy + 1], [hx + sd * rx * .3, hy - ry * .7], [hx + sd * rx * .2, hy + 1]], C.horn || '#e8dcc0'); px.dot(g, hx + sd * rx * .26, hy - ry * .6, '#ffffff'); }
    // face
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

/* =============================================================================
 * 13. TILE MAP  floor texture baked per view, walls as extruded boxes, collision
 *    cells: array of type ids (0 = floor). types: { id: { h, top, side, line, cut, cutH } }
 *    floorTex(x, y) -> [r, g, b] or null  (called per pixel when a view is first used)
 * ============================================================================= */
/**
 * Parse an ASCII level (top row first; every character is one tile). legend maps a character to
 *   a number  -> tile / wall type id (0 = empty)
 *   a string  -> a spawn tag; the cell stays empty and spawns[] gets { tag, ch, cx, cy }
 *   an object -> any of { tile: id, floor: 'water', spawn: 'hero', block: true }  (block: nobody can walk on this cell)
 * '.' and ' ' are empty unless the legend says otherwise. Unknown characters warn once and become empty.
 */
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
/**
 * the facade vocabulary, wall type options painted by the decoration hook (each true, or an object of its options):
 *   windows: { w: 6, h: 9, every: 16, from: 9, step: 17, glass: '#241e34', frame, lit: .25 (the share that glow), sill: true }
 *   shutters: true or a color (a pair beside each window); door: { w: 7, h: 13, color, chance: .25 } (on the ground floor);
 *   balcony: { z (its floor's height), color }; arch: { w: 10, h: 14, color, chance: .3 } (a dark arched opening)
 * Positions are hashed from the cell, so a street of the same type varies and stays the same on every bake
 */
function facade(f, t) {
  const T = f.u1 - f.u0, ct = f.tones, seed = f.cx * 73 + f.cy * 37 + (f.nx + 2) * 11 + f.ny * 5, H = (k, s = 0) => hash2(seed + s * 131, k * 17 + 3);
  const door = t.door && (t.door === true ? {} : t.door), arch = t.arch && (t.arch === true ? {} : t.arch), win = t.windows && (t.windows === true ? {} : t.windows);
  const hasDoor = door && H(1) < (door.chance === undefined ? .25 : door.chance) && f.z0 < 1, hasArch = !hasDoor && arch && H(2) < (arch.chance === undefined ? .3 : arch.chance) && f.z0 < 1;
  const mid = f.u0 + T / 2;
  if (hasDoor) {
    const w = door.w || 7, h = Math.min(door.h || 13, f.z1 - f.z0 - 2), dc = door.color || '#4a2e1e', dt = tones(dc);
    f.quad(mid - w / 2 - 1, f.z0, mid + w / 2 + 1, f.z0 + h + 1, ct.deep); f.quad(mid - w / 2, f.z0, mid + w / 2, f.z0 + h, dc);
    f.line(mid, f.z0, mid, f.z0 + h - 1, dt.sh); f.dot(mid + w / 2 - 1.5, f.z0 + h * .45, '#e8c860');
  }
  if (hasArch) {
    const w = arch.w || 10, h = Math.min(arch.h || 14, f.z1 - f.z0 - 2), c = arch.color || '#140e1a', pts = [];
    for (let i = 0; i <= 8; i++) { const a = Math.PI * i / 8; pts.push(f.at(mid + Math.cos(a) * w / 2, f.z0 + h - w / 2 + Math.sin(a) * w / 2)); }
    px.poly(f.g, [f.at(mid + w / 2, f.z0), ...pts, f.at(mid - w / 2, f.z0)], c);
  }
  if (win) {
    const w = win.w || 6, h = win.h || 9, every = win.every || T, from = win.from === undefined ? 9 : win.from, step = win.step || 17, glass = win.glass || '#241e34', frame = win.frame || ct.lt;
    for (let z = f.z0 + from, row = 0; z + h <= f.z1 - 3; z += step, row++) {
      if ((hasDoor || hasArch) && z < f.z0 + 15) continue;
      for (let u = Math.ceil((f.u0 - every / 2) / every) * every + every / 2; u < f.u1; u += every) {
        if (u - w / 2 < f.u0 + 1 || u + w / 2 > f.u1 - 1) continue;
        const lit = H(10 + row, Math.round(u)) < (win.lit === undefined ? .25 : win.lit);
        f.quad(u - w / 2 - 1, z - 1, u + w / 2 + 1, z + h + 1, frame); f.quad(u - w / 2, z, u + w / 2, z + h, lit ? '#ffd27a' : glass);
        if (lit) f.quad(u - w / 2, z + h * .55, u + w / 2, z + h, '#ffe8a8'); else f.line(u - w / 2 + 1, z + h - 2, u - w / 2 + 2, z + h - 1, shade(glass, .5));
        f.line(u, z, u, z + h, frame); if (win.sill !== false) f.quad(u - w / 2 - 1.5, z - 2, u + w / 2 + 1.5, z - 1, ct.lt);
        if (t.shutters) { const sc = t.shutters === true ? '#3a6a52' : t.shutters; f.quad(u - w / 2 - 3.5, z, u - w / 2 - 1, z + h, sc); f.quad(u + w / 2 + 1, z, u + w / 2 + 3.5, z + h, sc); }
      }
    }
  }
  if (t.balcony) {
    const b = t.balcony === true ? {} : t.balcony, z = b.z === undefined ? f.z0 + Math.min(26, (f.z1 - f.z0) * .55) : b.z, c = b.color || '#5a4030', bt = tones(c);
    if (z > f.z0 + 4 && z < f.z1 - 4) {
      f.quad(f.u0, z - 2, f.u1, z, bt.sh); f.quad(f.u0, z, f.u1, z + .8, bt.lt);
      f.line(f.u0, z + 6, f.u1, z + 6, bt.base); for (let u = f.u0 + 2; u < f.u1; u += 3) f.line(u, z, u, z + 6, bt.sh);
    }
  }
}
/** a direction as a unit ground vector: an angle (radians) or [dx, dy] */
const groundDir = d => { if (typeof d === 'number') return [Math.cos(d), Math.sin(d)]; const l = Math.hypot(d[0], d[1]) || 1; return [d[0] / l, d[1] / l]; };
class TileMap {
  /**
   * Walls standing on a floor (top-down, isometric, brawler). Either
   *   { rows: [...ASCII...], legend: { '#': 1, '@': 'hero' }, types, floorTex }   (recommended)
   * or { w, h, cells: [ids...], floor: [tags...], blocked: [0 | 1...], types, floorTex } (built in code: fill, setFloor;
   * with no cells it starts as open floor).
   * - types: types[id] = { h, top, side, line, course, cut, cutH, face, roof }
   * - types[id].face: the wall's material (E.MATERIALS): 'brick' (default) | 'stone' | 'rock' | 'plank' | 'timber' |
   *     'plaster' | 'hedge' | 'none' | any material id or '#hex pattern'
   * - types[id].roof: the top's material: 'speckle' (default) | 'plain' | 'tiles' (roof shingles) | 'slab' (paving) |
   *     'leaves' | 'grass' | any material id or '#hex pattern'
   * - floorTex: floorTex(x, y, floorTag, view) -> [r, g, b] or [r, g, b, glow]
   * - floorMat, floorMats: a material for the floor, floorMats: { tag: material } for tagged cells (in place of floorTex)
   * - block: ['water', 'lava'] floor tags nobody can walk on (or put block: true in a legend entry)
   */
  constructor(o = {}) {
    /** T: the tile size in world units (16) */
    this.T = o.tile || 16;
    const L = o.rows ? parseLevel(o.rows, o.legend) : o.level || null;
    if (L) o = Object.assign({}, o, { w: L.w, h: L.h, cells: L.cells });
    else if (o.w && o.h && !o.cells) o = Object.assign({}, o, { cells: new Array(o.w * o.h).fill(0) });   // open floor, to fill in code
    if (!o.w || !o.h || !o.cells) throw new Error('TileMap needs { rows, legend } or { w, h } (and cells)');
    if (o.cells.length !== o.w * o.h) throw new Error('TileMap: cells has ' + o.cells.length + ' entries but w * h = ' + (o.w * o.h));
    /** w, h: the map's size in cells; cells: the wall type id of every cell, row by row (index cy * w + cx; change
     *  one with set); types: the wall types by id ({ h, top, side, face, roof, cut, ... }) */
    this.w = o.w; this.h = o.h; this.cells = o.cells; this.types = Object.assign({}, o.types || {});
    /** floorTags: each cell's floor tag from the legend ('water', 'lava', ...), row by row, or null for a map built
     *  from cells */
    this.floorTags = L ? L.floor : o.floor ? o.floor.slice() : null;
    /** cells nobody can walk on (deep water, lava, pits): legend { floor: 'water', block: true } or TileMap { block: ['water'] } */
    this.blocked = L ? L.block : o.blocked ? Uint8Array.from(o.blocked) : new Uint8Array(this.w * this.h);
    if (o.block && this.floorTags) { const tags = [].concat(o.block); this.floorTags.forEach((f, i) => { if (f && tags.includes(f)) this.blocked[i] = 1; }); }
    /** spawn points from the ASCII rows: { tag, ch, cx, cy, x, y, z } (x, y = cell center) */
    this.spawns = L ? L.spawns.map(sp => Object.assign(sp, { x: (sp.cx + .5) * this.T, y: (sp.cy + .5) * this.T, z: 0 })) : [];
    for (const id of new Set(this.cells)) if (id > 0 && !this.types[id]) { warn('walltype:' + id, 'TileMap: wall type ' + id + ' is used in the map but missing from types (using a plain grey wall)'); this.types[id] = DEFAULT_WALL; }
    /** floorTex: floorTex(x, y, tag, view) -> [r, g, b], the floor's color per pixel; cutaway: walls between the
     *  camera and the floor drop low (types with cut: true; false turns it off); floors: the baked floor images by
     *  view (floors = {} re-bakes them after floorTex changes) */
    this.floorTex = o.floorTex || (() => [60, 56, 72]); this.cutaway = o.cutaway !== false; this.floors = {};
    /** floorMat: a material (E.MATERIALS id or '#hex pattern') for every floor cell; floorMats: { tag: material } for
     *  the cells with that floor tag, over floorMat (untagged cells have the tag null). Either stands in for floorTex */
    this.floorMat = o.floorMat || null; this.floorMats = o.floorMats || null;
    /** contact shadow width (world units) along the foot of walls; 0 turns it off */
    this.ao = o.ao === undefined ? 5 : o.ao;
    /** animated sparkle on floor cells tagged 'water' or 'lava' */
    this.shimmer = o.shimmer !== false;
    /** light: the direction light comes from, for shading wall faces; version: counts every change to cells and
     *  blocked cells (set, block), so caches and flow fields know to rebuild */
    this.light = V3.norm([-.6, -.8, 0]); this.version = 0;
  }
  /** first spawn with this tag ({ x, y, z, cx, cy }), or null */
  find(tag) { return this.spawns.find(s => s.tag === tag) || null; }
  /** every spawn with this tag */
  findAll(tag) { return this.spawns.filter(s => s.tag === tag); }
  /** the wall type id at a cell (0 = floor, -1 outside the map) */
  cell(cx, cy) { return cx < 0 || cy < 0 || cx >= this.w || cy >= this.h ? -1 : this.cells[cy * this.w + cx]; }
  /** put wall type v at a cell (0 opens it: a door, a broken wall); bumps version, so caches and flow fields rebuild */
  set(cx, cy, v) { if (cx >= 0 && cy >= 0 && cx < this.w && cy < this.h) { if (v > 0 && !this.types[v]) this.types[v] = DEFAULT_WALL; this.cells[cy * this.w + cx] = v; this.floors = {}; this.version++; } }
  /** world point -> [cx, cy] cell (center(cx, cy) goes back) */
  toCell(x, y) { return [Math.floor(x / this.T), Math.floor(y / this.T)]; }
  /** the world point at a cell's center */
  center(cx, cy) { return [(cx + .5) * this.T, (cy + .5) * this.T]; }
  /** true where a cell has a wall (or is outside the map); walkable() also counts blocked floor */
  solidCell(cx, cy) { const c = this.cell(cx, cy); return c !== 0; }
  /** true where a body can walk: no wall and not a blocked floor (water, lava). Pathfinding uses this. */
  walkable(cx, cy) { return this.cell(cx, cy) === 0 && !this.blocked[cy * this.w + cx]; }
  /** put wall type id in every cell of a w x h block of cells (0 clears them): build maps in code */
  fill(cx, cy, w, h, id) {
    if (id > 0 && !this.types[id]) this.types[id] = DEFAULT_WALL;
    for (let y = Math.max(0, cy); y < Math.min(this.h, cy + h); y++) for (let x = Math.max(0, cx); x < Math.min(this.w, cx + w); x++) this.cells[y * this.w + x] = id;
    this.floors = {}; this.version++;
  }
  /** give a cell a floor tag ('water', 'grass', what floorTex and floorAt read), and block it (deep water, lava) or not */
  setFloor(cx, cy, tag, block) {
    if (cx < 0 || cy < 0 || cx >= this.w || cy >= this.h) return;
    if (!this.floorTags) this.floorTags = new Array(this.w * this.h).fill(null);
    const i = cy * this.w + cx; this.floorTags[i] = tag; if (block !== undefined) this.blocked[i] = block ? 1 : 0;
    this.floors = {}; this.version++;
  }
  /** mark a cell blocked or free at runtime (a bridge appears, lava cools) */
  block(cx, cy, on = true) { const i = cy * this.w + cx, v = on ? 1 : 0; if (cx >= 0 && cy >= 0 && cx < this.w && cy < this.h && this.blocked[i] !== v) { this.blocked[i] = v; this.version++; } }
  /** solidCell at a world point */
  solidAt(x, y) { return this.solidCell(Math.floor(x / this.T), Math.floor(y / this.T)); }
  /** a cell's top: its wall's h, 0 on the floor, 1e9 outside the map (the height rules: E.HEIGHTS) */
  height(cx, cy) { const c = this.cell(cx, cy); return c > 0 ? this.types[c].h : c < 0 ? 1e9 : 0; }
  /** wall height at a world point (0 on the floor) */
  heightAt(x, y) { return this.height(Math.floor(x / this.T), Math.floor(y / this.T)); }
  /** floor tag from the legend ({ floor: 'water' }) at a world point, or null */
  floorAt(x, y) { if (!this.floorTags) return null; const cx = Math.floor(x / this.T), cy = Math.floor(y / this.T); return cx < 0 || cy < 0 || cx >= this.w || cy >= this.h ? null : this.floorTags[cy * this.w + cx]; }
  /** highest surface under a circle footprint that a body at height z can stand on (floor = 0) */
  groundAt(x, y, r = 0, z = 1e9, step = 2) {
    const T = this.T, rr = r * .6; let g = 0;
    for (let cy = Math.floor((y - rr) / T); cy <= Math.floor((y + rr) / T); cy++) for (let cx = Math.floor((x - rr) / T); cx <= Math.floor((x + rr) / T); cx++) {
      const c = this.cell(cx, cy); if (c <= 0) continue; const h = this.types[c].h; if (h <= z + step && h > g) g = h;
    }
    return g;
  }
  /** push a circle { x, y, r } out of walls. If the body has a number z, walls lower than z + step (default 2) do not block it
   *  (it is standing or jumping above them). Returns true when it touched a wall. */
  collide(b) {
    const T = this.T, zA = typeof b.z === 'number', step = b.step === undefined ? 2 : b.step;
    let hit = false;
    for (let it = 0; it < 2; it++) {
      const c0 = Math.floor((b.x - b.r) / T), c1 = Math.floor((b.x + b.r) / T), r0 = Math.floor((b.y - b.r) / T), r1 = Math.floor((b.y + b.r) / T);
      for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
        const c = this.cell(cx, cy);
        if (c === 0) { if (!this.blocked[cy * this.w + cx] || (zA && b.z > step)) continue; }   // blocked floor: stops walkers, not jumpers
        else if (zA && c > 0 && this.types[c].h <= b.z + step) continue;
        const nx = clamp(b.x, cx * T, cx * T + T), ny = clamp(b.y, cy * T, cy * T + T);
        let dx = b.x - nx, dy = b.y - ny, d = Math.hypot(dx, dy);
        if (d >= b.r) continue;
        hit = true;
        if (d < 1e-4) {   // center inside the cell: leave toward the nearest open neighbour, or search for open ground
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
  /** move a body buried in walls or blocked floor to the nearest open cell (within 8 cells) */
  _escape(b, zA, step) {
    const T = this.T, cx = Math.floor(b.x / T), cy = Math.floor(b.y / T); let best = null, bd = 1e9;
    for (let y = cy - 8; y <= cy + 8; y++) for (let x = cx - 8; x <= cx + 8; x++) {
      const n = this.cell(x, y); if (n < 0 || (n === 0 && this.blocked[y * this.w + x]) || (n > 0 && !(zA && this.types[n].h <= b.z + step))) continue;
      const px2 = clamp(b.x, x * T + b.r, x * T + T - b.r), py2 = clamp(b.y, y * T + b.r, y * T + T - b.r), dd = Math.hypot(px2 - b.x, py2 - b.y);
      if (dd < bd) { bd = dd; best = [px2, py2]; }
    }
    if (best) { b.x = best[0]; b.y = best[1]; }
  }
  /** renderer hook: something standing on a wall block, or on a solid shape (map.solid), sorts after it */
  _liftOrder(view, x, y, z, k) {
    const T = this.T, cx = Math.floor(x / T), cy = Math.floor(y / T), c = this.cell(cx, cy), t = c > 0 ? this.types[c] : null;
    if (!t || z < t.h - 1) return k;
    return Math.max(k, view.order((cx + .5) * T, (cy + .5) * T, 0) + .002 + z * 1e-5);
  }
  /** renderer hook: something standing on a solid shape (map.solid: a jar on a table, a crate on a crate) sorts after it,
   *  even on its back half, where its own point sorts before the shape's */
  _liftSolids(view, x, y, z, k) {
    const own = view.order(x, y, z);
    for (const so of this.solids) {
      if (z < so.top - 1) continue;
      const dx = x - so.x, dy = y - so.y, lx = dx * so.c + dy * so.s, ly = -dx * so.s + dy * so.c;
      if (Math.abs(lx) <= so.hx && Math.abs(ly) <= so.hy) {   // (just after the shape, and the things on it in their own order)
        const base = Math.max(view.order(so.x, so.y, so.z), view.order(so.px, so.py, so.z));
        k = Math.max(k, base + .002 + z * 1e-5 + Math.max(-150, own - base) * 1e-5);
      }
    }
    return k;
  }
  /** line of sight across the ground (true if nothing solid in between). It ignores heights: sight() is the one that sees
   *  over a low wall and from a roof */
  los(x0, y0, x1, y1) { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4); for (let i = 1; i < n; i++) if (this.solidAt(lerp(x0, x1, i / n), lerp(y0, y1, i / n))) return false; return true; }
  /* ---- height-aware queries: the rules are E.HEIGHTS' (section 1). dir is an angle (radians) or a ground vector [dx, dy];
   *      `from` is a body or any { x, y, z, r } ---- */
  /**
   * the first cell top that rises above the straight segment from a to b ({ x, y, z } world points; o.eye and o.target lift
   * each end): { clear, t (0..1 along it), x, y, z } where it stops (b's point when clear). It walks every cell the segment
   * crosses, not samples; a top level with the segment doesn't block it, and outside the map is solid
   */
  ray(a, b, o = {}) {
    const z0 = (a.z || 0) + (o.eye || 0), dz = (b.z || 0) + (o.target || 0) - z0, dx = b.x - a.x, dy = b.y - a.y;
    return this._walk(a.x, a.y, b.x, b.y, (cx, cy, t0, t1) => {
      const top = this.height(cx, cy), za = z0 + dz * t0, zb = z0 + dz * t1;
      if (top <= Math.min(za, zb) + 1e-6) return null;   // (the segment is straight: its lowest point in a cell is at one end)
      const t = za <= top ? t0 : (top - z0) / dz;   // it meets the cell's side, or comes down onto its top
      return { clear: false, t, x: a.x + dx * t, y: a.y + dy * t, z: z0 + dz * t, cx, cy };
    }) || { clear: true, t: 1, x: b.x, y: b.y, z: z0 + dz };
  }
  /** can a's eyes (z + eye) see b's chest (z + chest)? E.HEIGHTS gives both unless o ({ eye, target }) or the bodies' own
   *  eye and chest say otherwise. A guard sees over a planter lower than its eyes, and down from a roof */
  sight(a, b, o = {}) {
    const eye = o.eye !== undefined ? o.eye : a.eye !== undefined ? a.eye : HEIGHTS.eye, target = o.target !== undefined ? o.target : b.chest !== undefined ? b.chest : HEIGHTS.chest;
    return this.ray(a, b, { eye, target }).clear;
  }
  /** can a body of radius r stand at (x, y) with its feet at z? Nothing under its footprint rises above z + step (it would
   *  collide), no blocked floor (water, lava) is under it at floor level, and a top within step below z holds it up */
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
  /**
   * a ledge to climb: in direction dir from `from`, the nearest top that rises min..rise above its feet within reach, with
   * room to stand past the edge, looking straight ahead and spread radians to each side (a gap first means a jump: landing).
   * { x, y, z (the spot to stand on top), rise, facing (the angle climbed), edge: [x, y] (where the hands grip) } or null.
   * o: { reach: 18, min: 4, rise: 82, spread: .28 }
   */
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
  /**
   * where a jump from `from` in direction dir lands across a gap: past the first drop ahead (a top more than step below its
   * feet), the nearest spot min..max away that rises at most rise and falls at most drop from its feet, stands above the
   * gap's bottom, has room to stand, and that a jump arc peaking apex above the higher end clears (arcClear).
   * { x, y, z, d } or null (a wall before any gap, or nowhere to land). o: { min: 35, max: 83, rise: 11, drop: 18, apex: 20 }
   */
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
  /** what lies past the edge ahead: the first drop of more than step within reach (default 12) of `from` in direction dir,
   *  and the ground a body of its radius lands on just past it: { x, y, z, fall } or null (no edge, or a wall first).
   *  AI that won't walk off roofs, hop-downs, fall warnings */
  drop(from, dir, o = {}) {
    const reach = o.reach === undefined ? 12 : o.reach, r = from.r || 5, z = from.z || 0, st = HEIGHTS.step, [dx, dy] = groundDir(dir);
    for (let d = 1; d <= reach; d++) {
      const h = this.heightAt(from.x + dx * d, from.y + dy * d);
      if (h > z + st) return null;
      if (h < z - st) { const x = from.x + dx * (d + r), y = from.y + dy * (d + r), g = this.groundAt(x, y, r, z, st); return { x, y, z: g, fall: z - g }; }
    }
    return null;
  }
  /** does a jump arc from a to b (feet, { x, y, z }) clear every top on the way? The arc is a parabola peaking apex above the
   *  higher end; r > 0 also checks a track on each side of it. Jumps, throws, aerial takedowns */
  arcClear(a, b, apex = 20, r = 0) {
    const za = a.z || 0, zb = b.z || 0, D = zb - za, M = Math.max(za, zb) + apex - (za + zb) / 2, k = 2 * M + Math.sqrt(Math.max(0, 4 * M * M - D * D));
    const zAt = t => za + D * t + k * t * (1 - t), l = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / l * r * .9, ny = (b.x - a.x) / l * r * .9;
    for (const s of r > 0 ? [0, -1, 1] : [0])   // (the arc is concave: over a cell its lowest point is at one end)
      if (this._walk(a.x + nx * s, a.y + ny * s, b.x + nx * s, b.y + ny * s, (cx, cy, t0, t1) => this.height(cx, cy) > Math.min(zAt(t0), zAt(t1)) + 1e-6)) return false;
    return true;
  }
  /** every cell the segment (x0, y0) -> (x1, y1) crosses, in order, as fn(cx, cy, t0, t1) (its stretch in that cell, 0..1); stops
   *  at the first truthy fn and returns that. Through a corner exactly, both cells beside it count */
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
  /** projected pixel bounds of the whole map for this view, { x0, y0, x1, y1 } with an 8-pixel margin (camera clamping:
   *  game.cam.bounds = v => map.bounds(v)) */
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
    const icv = view.inv ? mkCanvas(cw, ch) : null, ig = icv && icv.getContext('2d'), iimg = ig && ig.createImageData(cw, ch), id = iimg && iimg.data;
    for (let py = 0; py < ch; py++) for (let pxx = 0; pxx < cw; pxx++) {
      let gx, gy;
      if (view.inv) { const q = view.toGround(pxx + x0 + .5, py + y0 + .5); gx = q[0]; gy = q[1]; }
      else { gx = (pxx + x0 + .5) / view.ax; gy = H * .5 + py * 2; }
      if (gx < 0 || gy < 0 || gx >= W || gy >= H) continue;
      if (view.inv && this.cell(Math.floor(gx / T), Math.floor(gy / T)) !== 0) continue;
      const tag = this.floorTags ? this.floorTags[Math.floor(gy / T) * this.w + Math.floor(gx / T)] : null, fmat = (this.floorMats && tag !== null && this.floorMats[tag]) || this.floorMat;
      let c = fmat ? this._floorColor(fmat, gx, gy, tag, view) : this.floorTex(gx, gy, tag, view); if (!c) continue;
      if (this.ao) {   // soft contact shadow where the floor meets a wall (not at the map's edge: a floor can run on past it)
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
      if (id) { id[k] = 0; id[k + 1] = 40; id[k + 2] = Math.round(clamp(c[3] || 0, 0, 1) * 255); id[k + 3] = 255; }
    }
    g.putImageData(img, 0, 0);
    if (ig) ig.putImageData(iimg, 0, 0);
    return (this.floors[key] = { cv, info: icv, x0, y0 });
  }
  /** draw the baked floor (first thing in draw, after r.sky); walls come from queueWalls(r) */
  drawFloor(r) {
    r._map = this; const f = this._floor(r.view); r.ctx.drawImage(f.cv, f.x0 - r.ix, f.y0 - r.iy); if (r.gpu && f.info) r._iG.drawImage(f.info, f.x0 - r.ix, f.y0 - r.iy);
    if (this.shimmer && this.floorTags && r.view.inv) {
      const T = this.T, t = r.game.real, g = r.ctx;
      for (let cy = 0; cy < this.h; cy++) for (let cx = 0; cx < this.w; cx++) {
        const tag = this.floorTags[cy * this.w + cx]; if (tag !== 'water' && tag !== 'lava') continue;
        for (let k = 0; k < 2; k++) {
          const ph = hash2(cx * 7 + k, cy * 13), u = ((t * (tag === 'lava' ? .12 : .25) + ph) % 1), wx = cx * T + u * T, wy = cy * T + ((ph * 7.3 + k * .5) % 1) * T, [sx, sy] = r.w(wx, wy, 0);
          if (sx < -4 || sx > r.bw + 4 || sy < -4 || sy > r.bh + 4) continue;
          const a = Math.sin(u * Math.PI); if (a < .35) continue;
          px.rect(g, sx, sy, a > .8 ? 3 : 2, 1, tag === 'lava' ? '#ffd070' : '#dff4ff');
        }
      }
    }
  }
  _isFront(cx, cy, view) {
    if (!this.cutaway || view.isTop || view.pitchDeg > 75) return false;
    const t = this.types[this.cell(cx, cy)]; if (!t || !t.cut) return false;
    const bx = -Math.round(view.fx), by = -Math.round(view.fy);
    const behindFloor = (bx && this.cell(cx + bx, cy) === 0) || (by && this.cell(cx, cy + by) === 0);
    return !!behindFloor;
  }
  /** queue every visible wall box. Call once per frame after drawFloor. */
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
  /** each wall block is baked once per view into a small image (pixel-identical: camera offsets are whole pixels), for the
   *  last four views (a zoom or turn and back is drawn from them) */
  _boxCached(g, r, cx, cy, t, h) {
    const view = r.view, key = view.id + ':' + view.yawDeg + ':' + view.pitchDeg + ':' + view.scale + ':' + this.version, wc = this._wcs || (this._wcs = new Map());
    let c = wc.get(key); if (!c) { if (wc.size >= 4) wc.delete(wc.keys().next().value); wc.set(key, c = { m: new Map() }); }
    const idx = cy * this.w + cx; let e = c.m.get(idx);
    if (!e || e.h !== h) {
      const T = this.T; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const z of [0, h]) for (const [x, y] of [[cx * T, cy * T], [cx * T + T, cy * T], [cx * T, cy * T + T], [cx * T + T, cy * T + T]]) { const q = view.p(x, y, z); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
      e = { h, x0: Math.floor(x0) - 2, y0: Math.floor(y0) - 2, w: Math.ceil(x1) - Math.floor(x0) + 5, hh: Math.ceil(y1) - Math.floor(y0) + 5, cv: null, info: null };
      c.m.set(idx, e);
    }
    const bake = info => {
      const c = mkCanvas(e.w, e.hh), cg = info ? c.getContext('2d') : ctx2d(c);
      if (info) { cg._info = true; cg._r = r; cg._mat = '#000'; }
      const sx = r.ix, sy = r.iy; r.ix = e.x0; r.iy = e.y0;
      try { this._box(cg, r, cx, cy, t, h); } finally { r.ix = sx; r.iy = sy; }
      return c;
    };
    if (g._info) { if (!e.info) e.info = bake(true); g.drawImage(e.info, e.x0 - r.ix, e.y0 - r.iy); }
    else { if (!e.cv) e.cv = bake(false); g.drawImage(e.cv, e.x0 - r.ix, e.y0 - r.iy); }
  }
  /**
   * a wall face's painter, for types[id].decorate(face) and the facade options (windows, door, shutters, balcony, arch).
   * It is called as each wall face is baked, so whatever it paints is cached with the wall. face: { side ('north' | 'south'
   * | 'east' | 'west'), nx, ny (its outward normal), cx, cy (the cell), u0, u1 (where the face runs along the wall, in world
   * units: x on north and south faces, y on east and west, so patterns line up across cells), z0, z1 (its bottom and top),
   * color (its lit color), tones (shades of it), at(u, z) (the buffer pixel of a point on it), quad(u0, z0, u1, z1, color),
   * line(u0, z0, u1, z1, color), dot(u, z, color), g (the 2D context, for E.px), view, type }
   */
  _dressFace(g, r, t, cx, cy, nx, ny, A, B, z0, z1, col) {
    const alongX = A[1] === B[1], fixed = alongX ? A[1] : A[0], u0 = alongX ? Math.min(A[0], B[0]) : Math.min(A[1], B[1]);
    const W = (u, z) => alongX ? r.w(u, fixed, z) : r.w(fixed, u, z);
    const face = { side: ny < 0 ? 'north' : ny > 0 ? 'south' : nx < 0 ? 'west' : 'east', nx, ny, cx, cy, u0, u1: u0 + this.T, z0, z1, color: col, tones: tones(col), view: r.view, g, type: t,
      at: W, quad: (a, za, b, zb, c) => px.poly(g, [W(a, za), W(b, za), W(b, zb), W(a, zb)], c),
      line: (a, za, b, zb, c) => { const p = W(a, za), q = W(b, zb); px.line(g, p[0], p[1], q[0], q[1], c); }, dot: (u, z, c) => { const p = W(u, z); px.dot(g, p[0], p[1], c); } };
    if (t.windows || t.door || t.shutters || t.balcony || t.arch) facade(face, t);
    if (t.decorate) t.decorate(face);
  }
  _box(g, r, cx, cy, t, h) {
    const view = r.view, T = this.T, x0 = cx * T, y0 = cy * T, x1 = x0 + T, y1 = y0 + T, P = (x, y, z) => r.w(x, y, z);
    if (!view.isTop) {
      const faces = [[0, -1, [x1, y0], [x0, y0]], [0, 1, [x0, y1], [x1, y1]], [-1, 0, [x0, y0], [x0, y1]], [1, 0, [x1, y1], [x1, y0]]];
      for (const [nx, ny, A, B] of faces) {
        if (nx * view.fx + ny * view.fy <= .02) continue;
        const nh = this.cell(cx + nx, cy + ny) > 0 ? (this._isFront(cx + nx, cy + ny, view) ? (this.types[this.cell(cx + nx, cy + ny)].cutH || 6) : this.height(cx + nx, cy + ny)) : 0;
        if (nh >= h) continue;
        if (g._info) { g._mat = r._faceMat(g, A, B, nh, h, faceClass(nx, ny)); g._c = null; }
        const lit = -(nx * this.light[0] + ny * this.light[1]);
        const col = lit > .2 ? t.sideLt || shade(t.side, .12) : lit < -.2 ? t.sideDk || shade(t.side, -.25) : t.side;
        const face = [P(A[0], A[1], nh), P(B[0], B[1], nh), P(B[0], B[1], h), P(A[0], A[1], h)];
        px.poly(g, face, col);
        const pat = t.texture === false ? 'none' : t.face || 'brick', fm = pat === 'brick' || pat === 'none' ? null : MATERIALS[pat] || (material(pat, null, 'wall face') && pat);
        if (!g._info && fm) this._paintFace(g, r, face, fm, t, col, cx, cy, nx * 3 + ny, nh, h, A, B, lit > .2 ? 3 : lit < -.2 ? 1 : 2);
        if (!g._info && (t.decorate || t.windows || t.door || t.shutters || t.balcony || t.arch)) this._dressFace(g, r, t, cx, cy, nx, ny, A, B, nh, h, col);
        if (!g._info && pat === 'brick') {   // per-brick color variation, speckle and lit brick tops, anchored to the wall
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
    if (g._info) { g._mat = r._infoCol(h, 4, 0); g._c = null; }
    px.poly(g, top, t.top);
    const roof = t.texture === false ? 'plain' : t.roof || 'speckle';
    if (!g._info && roof === 'speckle') { const tt = tones(t.top); scan(top, (xa, xb, y) => { for (let x = xa; x <= xb; x++) { const v = hash2(x * 3 + cx * 71, y * 5 + cy * 37); if (v < .08 || v > .96) { px.col(g, v < .08 ? tt.sh : tt.lt); g.fillRect(x, y, 1, 1); } } }); }
    else if (!g._info && roof !== 'plain') { const rm = MATERIALS[roof] || (material(roof, null, 'wall top') && roof); if (rm) this._paintRoof(g, top, rm, t, x0, y0, r); }
    const re = MATERIALS[roof], edge = t.edge || shade(t.top, re && re.edge !== undefined ? re.edge : .22);
    for (const [ax, ay, bx, by, nx, ny] of [[x0, y0, x1, y0, 0, -1], [x0, y1, x0, y0, -1, 0]]) {
      const nb = this.cell(cx + nx, cy + ny); if (nb > 0 && this.height(cx + nx, cy + ny) >= h) continue;
      const a = P(ax, ay, h), b = P(bx, by, h); px.line(g, a[0], a[1], b[0], b[1], edge);
    }
  }
}
E.TileMap = TileMap;
/* =============================================================================
 * 13b. MATERIALS  one open registry for every surface: wall faces, wall tops, floors, platform tiles and the faces of
 *    shapes (21e). A material is data: { color, pattern, ...the pattern's numbers, ramp, glow } or the shorthand
 *    '#8a5a36 planks bw=3'. Its pattern (E.PATTERNS) gives a tone step at each point of a surface and the light gives
 *    the band, so a material works on every surface and in every palette, keeps the house's hue-shifted shading
 *    (E.tones, or its own ramp of five), and recolors with one hex.
 *      E.MATERIALS.oak = { color: '#8a5a36', pattern: 'planks', bw: 3 };
 *      types: { 1: { h: 32, top: '#6a6280', side: '#4a4360', face: 'oak', roof: 'slab' } }   // a TileMap's walls
 *      new E.TileMap({ rows, legend, types, floorMat: 'flagstone', floorMats: { water: 'water' } })
 *      platform types: { 1: { style: 'block', mat: 'mossy-stone' } }
 * A material may also paint a surface its own way, per pixel (null keeps the surface's color): face(wx, z, tones, type,
 * cx, cy, fi, nh, h) for wall faces (wx along the wall, z up), roof(wx, wy, tones, type) for wall tops, floor(x, y, tag,
 * view) -> [r, g, b] for floors, tile(g, f) for platform tiles. The engine's own wall faces (brick stone rock plank
 * timber plaster hedge), wall tops (speckle plain tiles slab leaves grass), floor textures (E.tex) and tile styles are
 * entries of this kind, so they draw exactly as they always have, and a game's own register the same way.
 * ============================================================================= */
/** the materials by id: { color, pattern, ...its numbers, ramp, glow } or a painter of a surface (face, roof, floor,
 *  tile); add your own: E.MATERIALS.oak = { color: '#8a5a36', pattern: 'planks', bw: 3 }. Any material id takes
 *  '#hex pattern key=value' too */
const MATERIALS = E.MATERIALS = {};
/** '#8a5a36 planks bw=3' -> { color: '#8a5a36', pattern: 'planks', bw: 3 } */
function parseMat(s) {
  const w = String(s).trim().split(/\s+/), o = { color: w[0] };
  for (const t of w.slice(1)) { const i = t.indexOf('='); if (i < 0) o.pattern = t; else { const v = t.slice(i + 1); o[t.slice(0, i)] = isNaN(+v) ? v : +v; } }
  return o;
}
const _mats = new Map(), _matOf = new WeakMap();
/** a material ready to draw: { q (its entry), ramp (five [r, g, b], dark to light), hexes (the same as '#rrggbb'), pat
 *  (its pattern), glow }. id: an id (looked up in local first, a set's own, then E.MATERIALS), a shorthand string or an
 *  entry; kind names the surface, for the warning when the id is unknown (then null) */
function material(id, local, kind = 'material', depth = 0) {
  if (typeof id === 'string' && id[0] === '#') { let m = _mats.get(id); if (!m) { if (_mats.size > 500) _mats.clear(); _mats.set(id, m = resolveMat(parseMat(id))); } return m; }
  let q = typeof id === 'string' ? (local && local[id]) || MATERIALS[id] : id;
  if (typeof q === 'string') {   // another material's id: a set's 'oak': 'oak' means the registry's oak; a loop ends after 8
    if (depth > 8) { warn(kind + ':loop:' + id, kind + ' "' + id + '" names materials in a loop'); return null; }
    return material(q, q === id ? null : local, kind, depth + 1);
  }
  if (!q || typeof q !== 'object') { warn(kind + ':' + id, 'unknown ' + kind + ' "' + id + '". Materials: ' + Object.keys(MATERIALS).join(', ') + ' (or "#hex pattern", or your own E.MATERIALS entry)'); return null; }
  let m = _matOf.get(q); if (m && m.color === q.color && m.pattern === q.pattern && m.r0 === q.ramp) return m;
  _matOf.set(q, m = resolveMat(q)); return m;
}
function resolveMat(q) {
  const t = q.ramp ? null : tones(q.color || '#808080'), pat = PATTERNS[q.pattern || 'none'];
  if (!pat) warn('pattern:' + q.pattern, 'unknown pattern "' + q.pattern + '". Patterns: ' + Object.keys(PATTERNS).join(', '));
  const base = q.ramp || [t.deep, t.sh, t.base, t.lt, t.hi], hexes = base.slice(), over = [];
  // overlays: each brings five tones of its own after the material's (a tone index k * 5 + 0..4 picks the k-th's)
  for (const [kind, col, o] of q.over || []) {
    const f = OVERLAYS[kind]; if (!f) { warn('overlay:' + kind, 'unknown overlay "' + kind + '". Overlays: ' + Object.keys(OVERLAYS).join(', ')); continue; }
    const c = col || OVER_COLOR[kind], u = c && tones(c);
    hexes.push(...(u ? [u.deep, u.sh, u.base, u.lt, u.hi] : [base[0], base[0], base[1], base[2], base[3]])); over.push({ f, o: o || {} });
  }
  return { q, ramp: hexes.map(hex), hexes, pat: pat || PATTERNS.none, glow: !!q.glow, color: q.color, pattern: q.pattern, r0: q.ramp, over: over.length ? over : null };
}
E.material = material;
/* ---- overlays: over: [[kind, color, { amount, size, up, h }]] on any material, the last on top; each draws in its own
 * color's tones (cracks without one: the material's own, a step darker) ---- */
const OVERLAYS = {
  moss: (s, o) => s.nz > 1 - (o.up || .6) && noise2(s.u / (o.size || 4), s.v / (o.size || 4)) < (o.amount || .55),   // on what looks up
  cracks: (s, o) => { const c = worley(s.u + 31, s.v + 17, o.size || 7); return c.id < (o.amount || .4) && c.e < seam(s) * .5; },
  dirt: (s, o) => noise2(s.u / (o.size || 3), s.v / (o.size || 3) + 7) < (o.amount || .6) * (1 - s.z / (o.h || 6)),   // near the ground
  rust: (s, o) => noise2(s.u / (o.size || 3) + 13, s.v / (o.size || 3)) > 1 - (o.amount || .35)
}, OVER_COLOR = { moss: '#5f7a3a', dirt: '#6a5038', rust: '#9a4a22' };
/** which overlay covers a point (0: none; k: the k-th, its tones at k * 5): s with nz (the normal's z) and z (height) */
const overAt = (m, s) => { for (let k = m.over.length - 1; k >= 0; k--) if (m.over[k].f(s, m.over[k].o)) return k + 1; return 0; };
const _S = { u: 0, v: 0, W: 16, H: 16, lid: true, curved: false, lit: .5, px: 1, part: 0, nz: 1, z: 0 };
/** a data material's tone (0..4, plus 5 per overlay) at a point of a flat surface (u, v world units across and up; band
 *  0..4 from the light; z the height there: by default v on a side, 0 on a lid) */
const matTone = (m, u, v, W, H, lid, band, px1, z, curved = false) => {
  _S.u = u; _S.v = v; _S.W = W; _S.H = H; _S.lid = lid; _S.curved = curved; _S.lit = band > 2 ? .8 : band < 2 ? -.2 : .5; _S.px = px1;
  const t = clamp((m.glow ? 3 : band) + m.pat(_S, m.q), 0, 4);
  if (!m.over) return t;
  _S.nz = lid ? 1 : 0; _S.z = z === undefined ? (lid ? 0 : v) : z; return t + 5 * overAt(m, _S);
};

/* ---- patterns: a tone step (-1 dark .. +2 bright) at a point of a surface ----
 * s: { u, v (world units on the surface: across and up a side; x and y on a lid), W, H (the face's size), lid (it looks up
 *   or down), curved (turned or round), lit (the light on it, -1..1), px (world units per pixel there), part };
 * m: the material's numbers. Names and numbers follow MaterialX's and Blender's texture nodes where they overlap. */
const seam = s => Math.max(.62, s.px * .98);
const FACE_PATTERNS = { crate: 'side', bark: 'lid' };   // (patterns drawn once per face, from its size: a 3D tile covers one face)   // a joint: never thinner than a pixel, so it never drops out
const _V = { id: 0, e: 0, dx: 0, dy: 0 };
/** Voronoi (Worley) cells of size S: { id (the cell's own value 0..1), e (distance to its edge), dx, dy (from its heart) } */
function worley(x, y, S, jit = .85) {
  const gx = Math.floor(x / S), gy = Math.floor(y / S); let d1 = 1e9, d2 = 1e9, ax = 0, ay = 0, bx = 0, by = 0, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = gx + i, cy = gy + j, qx = (cx + .5 + (hash2(cx, cy) - .5) * jit) * S, qy = (cy + .5 + (hash2(cy + 71, cx + 13) - .5) * jit) * S, ex = x - qx, ey = y - qy, d = ex * ex + ey * ey;
    if (d < d1) { d2 = d1; bx = ax; by = ay; d1 = d; ax = qx; ay = qy; id = hash2(cx * 7 + 3, cy * 11 + 5); } else if (d < d2) { d2 = d; bx = qx; by = qy; }
  }
  _V.id = id; _V.e = (d2 - d1) / (2 * (Math.hypot(bx - ax, by - ay) || 1)); _V.dx = x - ax; _V.dy = y - ay; return _V;
}
/** the patterns, by name: (s, m) => a tone step (-1 .. +2) at a point s of a surface, for a material m's numbers. Add your
 *  own: E.PATTERNS.waves = (s, m) => Math.sin(s.u / (m.size || 3)) > .8 ? 1 : 0 */
E.PATTERNS = {
  /** none: the light's bands alone */
  none: () => 0,
  /** planks: boards bw wide (3) with joints and butt ends every len (14); along u on lids and flat sides, along v (staves)
   *  on turned surfaces; dir: 'v' turns them on flat faces */
  planks(s, m) {
    const bw = m.bw || 3, len = m.len || 14, vert = s.curved || m.dir === 'v', along = vert ? s.v : s.u, across = vert ? s.u : s.v;
    const row = Math.floor(across / bw), w = seam(s);
    if (across - row * bw < w) return -1;
    const off = hash2(row, 7) * len, k = Math.floor((along + off) / len);
    if (!s.curved && along + off - k * len < w) return -1;
    const h = hash2(row, k + 3); return h > .78 ? 1 : h < .22 ? -1 : 0;
  },
  /** crate: a framed and braced crate side (frame 2 wide, a diagonal brace, boards bw 3 inside); lids are planks */
  crate(s, m) {
    if (s.lid || s.curved) return PATTERNS.planks(s, m);
    // (wrapped into the face: a wall face or a tile past the first repeats the crate)
    const f = m.frame || 2, w = seam(s), W = s.W || 16, H = s.H || 16, u = ((s.u % W) + W) % W, v = ((s.v % H) + H) % H, e = Math.min(u, W - u, v, H - v);
    if (e < f) return e > f - w ? -1 : 1;
    const iw = W - 2 * f, ih = H - 2 * f, d = Math.abs((u - f) * ih - (v - f) * iw) / (Math.hypot(iw, ih) || 1);
    if (d < f * .7) return d > f * .7 - w ? -1 : 1;
    const bw = m.bw || 3, r = Math.floor((v - f) / bw); return v - f - r * bw < w ? -1 : hash2(r, 5) > .7 ? -1 : 0;
  },
  /** bricks: running bond, bw x bh (6 x 3), mortar a step darker (mortar: its step) */
  bricks(s, m) {
    const bh = m.bh || 3, bw = m.bw || 6, w = seam(s), row = Math.floor(s.v / bh), u = s.u + (row & 1) * bw / 2, col = Math.floor(u / bw);
    if (s.v - row * bh < w || u - col * bw < w) return m.mortar === undefined ? -1 : m.mortar;
    const h = hash2(col, row); return h > .86 ? 1 : h < .14 ? -1 : 0;
  },
  /** stones: irregular stones (Voronoi cells about size across, 5) with dark joints and a lit rim */
  stones(s, m) {
    const c = worley(s.u, s.v, m.size || 5), w = seam(s);
    if (c.e < w * .8) return -1;
    if (c.e < w * 1.8 && c.dy > 0) return 1;
    return c.id > .82 ? 1 : c.id < .22 ? -1 : 0;
  },
  /** tiles: square tiles size (4) with grout */
  tiles(s, m) { const S = m.size || 4, w = seam(s), a = s.u / S, b = s.v / S; if ((a - Math.floor(a)) * S < w || (b - Math.floor(b)) * S < w) return -1; return hash2(Math.floor(a), Math.floor(b)) > .8 ? 1 : 0; },
  /** speck: dark and light specks (amount .08) */
  speck(s, m) { const h = hash2(Math.floor(s.u * 1.4), Math.floor(s.v * 1.4)), a = m.amount || .08; return h < a ? -1 : h > 1 - a * .5 ? 1 : 0; },
  /** noise: soft patches (scale 4) */
  noise(s, m) { const n = noise2(s.u / (m.scale || 4), s.v / (m.scale || 4)); return n > .66 ? 1 : n < .34 ? -1 : 0; },
  /** foliage: leaf clumps (size 3.5), each lit at its top and dark at its foot, a few bright leaves */
  foliage(s, m) {
    const S = m.size || 3.5, c = worley(s.u, s.v * 1.15, S, 1), r = c.dy / S;
    if (c.e < seam(s) * .7) return -1;
    if (hash2(Math.floor(s.u * 2), Math.floor(s.v * 2)) > .94) return 1;
    return r > .18 ? 1 : r < -.22 ? -1 : 0;
  },
  /** bark: fissures running up a trunk; a cut end shows its rings */
  bark(s) { if (s.lid) { const r = Math.hypot(s.u - s.W / 2, s.v - s.H / 2); return (r % 1.6) < seam(s) ? -1 : 1; } const n = noise2(s.u * 1.1, s.v * .16); return n > .64 ? -1 : n < .22 ? 1 : 0; },
  /** metal: hard light (a shine where lit, darker in shade); rivet: a rivet every rivet units */
  metal(s, m) { if (m.rivet && s.v % m.rivet < .9 && s.u % m.rivet < .9) return 1; return s.lit > .8 ? 1 : s.lit < .05 ? -1 : 0; },
  /** cloth: a fine weave and soft folds (fold .9) */
  cloth(s, m) {
    const f = Math.sin(s.u * (m.fold || .9) + noise2(s.u * .3, s.v * .2) * 3);
    if (f > .82) return -1; if (f < -.9) return 1;
    return (Math.floor(s.u * 1.2) + Math.floor(s.v * 1.2)) & 1 && hash2(Math.floor(s.u), Math.floor(s.v)) > .7 ? -1 : 0;
  },
  /** glaze: a glossy shine where the light is strongest, a few specks */
  glaze(s) { if (s.lit > .86) return 2; if (s.lit > .74) return 1; return hash2(Math.floor(s.u * 1.5), Math.floor(s.v * 1.5)) < .04 ? -1 : 0; },
  /** thatch: straw in overlapping courses (course 3) */
  thatch(s, m) { const c = m.course || 3, row = Math.floor(s.v / c); if (s.v - row * c < seam(s)) return -1; const n = hash2(Math.floor(s.u * 1.6 + row * 5), row); return n > .7 ? 1 : n < .25 ? -1 : 0; },
  /** shingles: staggered rows of roof tiles (course 2.5, bw 4) */
  shingles(s, m) {
    const c = m.course || 2.5, bw = m.bw || 4, row = Math.floor(s.v / c), u = s.u + (row & 1) * bw / 2, col = Math.floor(u / bw), w = seam(s);
    if (s.v - row * c < w || u - col * bw < w) return -1; return hash2(col, row) > .8 ? 1 : 0;
  }
};
const PATTERNS = E.PATTERNS;

/* ---- the engine's own wall faces (types[id].face) and wall tops (types[id].roof): per pixel, anchored to the wall so they
 *      never swim; f carries the map's tile size T ---- */
const FACES = {
  /** big ashlar blocks with offset joints, lit top edges and chipped corners */
  stone(wx, z, ct, t, cx, cy, fi, nh, h, f) {
    const T = f.T, course = t.course || 10, seed = cx * 7 + cy * 13 + fi * 31, ci = Math.floor(z / course), fz = z / course - ci, off = hash2(ci * 3 + cx * 5 + cy * 11, 7) * T, bwid = T * .7, q = (wx + off) / bwid, bi = Math.floor(q), fq = q - bi;
    const v = hash2(bi * 5 + cx, ci + cy * 17);
    let c2 = fz < .1 || fq < .06 ? ct.deep : fz > .86 || fq < .14 ? ct.lt : fq > .93 ? ct.sh : v < .3 ? ct.sh : v > .8 ? shade(ct.base, .06) : null;
    if (!c2 && hash2(Math.floor(wx * 1.3), Math.floor(z * 1.3) + seed) < .05) c2 = ct.sh;
    return c2;
  },
  /** natural cliff: layered blotches and cracks */
  rock(wx, z, ct, t, cx, cy) {
    const n = noise2(wx / 6 + cx * 3, z / 4 + cy * 5) * .7 + noise2(wx / 2.5, z / 2) * .3, strata = Math.sin(z * .9 + noise2(wx / 5, z / 8) * 4);
    return n < .28 ? ct.deep : n < .42 ? ct.sh : n > .72 ? ct.lt : strata > .92 ? ct.sh : null;
  },
  /** vertical boards with dark gaps, grain and nail heads */
  plank(wx, z, ct, t, cx, cy, fi, nh, h, f) {
    const seed = cx * 7 + cy * 13 + fi * 31, bw = f.T / 4, q = wx / bw, bi = Math.floor(q), fq = q - bi, v = hash2(bi * 13 + cx, cy * 7);
    let c2 = fq < .14 ? ct.deep : fq > .86 ? ct.sh : fq < .3 ? ct.lt : hash2(bi, Math.floor(z / 2.5) + seed) < .18 ? ct.sh : v < .3 ? shade(ct.base, -.06) : null;
    if (Math.abs(z - (nh + 2.5)) < .6 || Math.abs(z - (h - 2.5)) < .6) if (fq > .4 && fq < .6) c2 = '#d8d0c0';
    return c2;
  },
  /** tudor: plaster between dark posts, a mid rail and braces */
  timber(wx, z, ct, t, cx, cy, fi, nh, h, f) {
    const T = f.T, beam = tones(t.beam || '#4a3222'), seed = cx * 7 + cy * 13 + fi * 31, lx = ((wx % T) + T) % T, mid = nh + (h - nh) * .5, post = lx < 1.6 || lx > T - 1.6, rail = Math.abs(z - mid) < 1.1 || z > h - 1.6 || z < nh + 1.4;
    const brace = z < mid && Math.abs(lx - (z - nh) / (mid - nh) * T * ((cx + cy + fi) & 1 ? 1 : -1) - ((cx + cy + fi) & 1 ? 0 : T)) < 1.1;
    if (post || rail || brace) return (post && lx < .8) || (rail && z > mid) ? beam.base : beam.sh;
    const n = noise2(wx / 3, z / 3 + seed); return n < .25 ? ct.sh : n > .78 ? ct.lt : null;
  },
  /** smooth render with soft mottling, a skirting band and a cornice line */
  plaster(wx, z, ct, t, cx, cy, fi, nh, h) {
    const seed = cx * 7 + cy * 13 + fi * 31, n = noise2(wx / 4 + seed, z / 4);
    let c2 = z < nh + 2.5 ? ct.sh : z > h - 1.5 ? ct.lt : n < .22 ? shade(ct.base, -.07) : n > .8 ? shade(ct.base, .06) : null;
    if (!c2 && hash2(Math.floor(wx * 2), Math.floor(z * 2) + seed) < .015) c2 = ct.sh;
    return c2;
  },
  /** leafy clumps: dark hollows, lit leaves on the upper side */
  hedge(wx, z, ct, t, cx, cy, fi) {
    const seed = cx * 7 + cy * 13 + fi * 31, n = noise2(wx / 3.2 + seed, z / 3.2) * .65 + noise2(wx / 1.6, z / 1.6) * .35, m = noise2(wx / 6, z / 6 + 9);
    return n < .3 ? ct.deep : n < .43 ? ct.sh : n > .64 && m > .35 ? ct.lt : null;
  }
};
const leafRoof = sc => (wx, wy, tt) => { const n = noise2(wx / sc, wy / sc) * .65 + noise2(wx / 1.6 + 5, wy / 1.6) * .35, k = hash2(Math.floor(wx), Math.floor(wy)); return n < .34 ? tt.sh : n > .66 ? tt.lt : k > .975 ? tt.hi : null; };
const ROOFS = {
  /** overlapping shingles in rows running east-west */
  tiles(wx, wy, tt, t) {
    const row = Math.floor(wy / 4), fr = wy / 4 - row, q = (wx + (row & 1) * 3) / 6, col = Math.floor(q), fq = q - col, v = hash2(col * 7 + row, 3);
    return fr > .72 ? tt.deep : fr < .22 ? tt.lt : fq < .1 ? tt.sh : v < .25 ? tt.sh : v > .85 ? shade(t.top, .08) : null;
  },
  /** square paving slabs */
  slab(wx, wy, tt, t) {
    const q = wx / 8, s = wy / 8, fq = q - Math.floor(q), fs = s - Math.floor(s), v = hash2(Math.floor(q) * 11, Math.floor(s) * 7);
    return fq < .08 || fs < .08 ? tt.sh : fq > .92 || fs > .92 ? tt.lt : v < .25 ? shade(t.top, -.06) : v > .8 ? shade(t.top, .05) : null;
  },
  leaves: leafRoof(3), grass: leafRoof(3.4)
};
// the entries: each surface it paints its own way, and a color and pattern for every other surface (a shape's faces)
Object.assign(MATERIALS, {
  brick: { color: '#9a5a4a', pattern: 'bricks' },   // (wall faces: the TileMap's own brick courses, its default face)
  stone: { color: '#8a8490', pattern: 'stones', face: FACES.stone }, rock: { color: '#7c7688', pattern: 'noise', face: FACES.rock },
  plank: { color: '#8a5a36', pattern: 'planks', dir: 'v', face: FACES.plank }, timber: { color: '#d8ccb0', pattern: 'noise', face: FACES.timber },
  plaster: { color: '#d8ccb0', pattern: 'noise', face: FACES.plaster }, hedge: { color: '#3f7a3a', pattern: 'foliage', face: FACES.hedge },
  speckle: { color: '#6a6280', pattern: 'speck' },  // (wall tops: the TileMap's default speckle)
  plain: { color: '#6a6280', pattern: 'none' },     // (wall tops: no pattern)
  tiles: { color: '#8a4a3a', pattern: 'shingles', roof: ROOFS.tiles }, slab: { color: '#8a8490', pattern: 'tiles', size: 8, roof: ROOFS.slab },
  leaves: { color: '#3f8a45', pattern: 'foliage', roof: ROOFS.leaves, edge: .12 }, grass: { color: '#55a94a', pattern: 'foliage', roof: ROOFS.grass, edge: .12 }
});
/** paint a wall face with a material's face(...) per pixel (or a data material's pattern), over the face's own color */
TileMap.prototype._paintFace = function (g, r, face, m, t, col, cx, cy, fi, nh, h, A, B, band) {
  const view = r.view, T = this.T, PA = face[0], ex = face[1][0] - PA[0], ey = face[1][1] - PA[1], bz = view.bz, ct = tones(col);
  if (Math.abs(ex) < .3 || Math.abs(bz) < .05) return;
  const along = A[0] === B[0] ? (A[1] < B[1] ? 1 : -1) : (A[0] < B[0] ? 1 : -1), base0 = A[0] === B[0] ? A[1] : A[0], q = m.face ? null : material(m), f = { T, view, band };
  const paint = q ? (wx, z) => q.hexes[matTone(q, wx, z, T, h - nh, false, band, 1 / view.scale)] : m.face;
  scan(face, (xa, xb, y) => {
    for (let x = xa; x <= xb; x++) {
      const u = clamp((x + .5 - PA[0]) / ex, 0, 1), z = nh + (y + .5 - PA[1] - u * ey) / bz, c = paint(base0 + along * u * T, z, ct, t, cx, cy, fi, nh, h, f);
      if (c) { px.col(g, c); g.fillRect(x, y, 1, 1); }
    }
  });
};
/** paint a wall top with a material's roof(...) per pixel (or a data material's pattern), in world coordinates */
TileMap.prototype._paintRoof = function (g, top, m, t, wx0, wy0, r) {
  const T = this.T, P0 = top[0], ex = top[1][0] - P0[0], ey = top[1][1] - P0[1], fx = top[3][0] - P0[0], fy = top[3][1] - P0[1], det = ex * fy - fx * ey;
  if (Math.abs(det) < .5) return;
  const tt = tones(t.top), q = m.roof ? null : material(m), pxu = 1 / ((r && r.view.scale) || 1);
  const paint = q ? (wx, wy) => q.hexes[matTone(q, wx, wy, T, T, true, 2, pxu, t.h || 32)] : m.roof;
  scan(top, (xa, xb, y) => {
    for (let x = xa; x <= xb; x++) {
      const dx = x + .5 - P0[0], dy = y + .5 - P0[1], c = paint(wx0 + (dx * fy - fx * dy) / det * T, wy0 + (ex * dy - dx * ey) / det * T, tt, t);
      if (c) { px.col(g, c); g.fillRect(x, y, 1, 1); }
    }
  });
};
/** a floor's color at (x, y): the material for the cell's tag (floorMats), else floorMat; its floor(...) or its pattern */
TileMap.prototype._floorColor = function (id, x, y, tag, view) {
  const e = typeof id === 'string' && id[0] !== '#' ? MATERIALS[id] : null;
  if (e && e.floor) return e.floor(x, y, tag, view);
  const m = material(id, null, 'floor material'); if (!m) return null;
  const c = m.ramp[matTone(m, x, y, this.T, this.T, true, 2, 1 / (view.scale || 1))];
  return m.glow ? [c[0], c[1], c[2], 1] : c;
};

/* =============================================================================
 * 14. FLOW FIELD  BFS distance map toward a target: cheap pathfinding for crowds
 * ============================================================================= */
class FlowField {
  /**
   * new E.FlowField(map, { step: 2, climb: 0, drop: 0, jump: 0 }): distances over the tops a body can stand on (E.HEIGHTS).
   * With no options it covers the floor (and walls no higher than step, which bodies walk over); a target on a roof gets a
   * field across the roofs it connects to
   * - step, climb, drop: next-door cells connect when their tops differ by at most step, or going up by up to climb and
   *   down by up to drop (agents that climb walls or hop down)
   * - jump: (world units) links tops across a gap that a jump clears, straight along a row or column, by map.landing's
   *   rules (up to jumpRise higher, 11, and jumpDrop lower, 18): an agent with E.Mover's leap chases across roofs. With
   *   jump, distances are travel: a jump of k cells costs k, and a climb 1 plus its rise in cells (climbing is slow), so a
   *   chase leaps a gap rather than drop into the street and climb back up
   */
  constructor(map, o = {}) {
    /** map: the map it paths over; d: each cell's distance in steps to the target cell (1e9 where it can't get
     *  there), row by row; tx, ty: the target's cell; version: the map's version it was built for */
    this.map = map; const n = map.w * map.h; this.d = new Int32Array(n); this._q = new Int32Array(n); this._tops = new Float64Array(n); this.tx = -1; this.ty = -1; this.version = -1;
    /** step: the height difference walked over freely (2); climb: how much higher a next-door top may be (an agent
     *  that climbs walls); drop: how much lower (an agent that hops down) */
    this.step = o.step === undefined ? HEIGHTS.step : o.step; this.climb = o.climb || 0; this.drop = o.drop || 0;
    /** jump: the widest gap jumped (world units, 0 = none); jumpRise, jumpDrop: how much higher and lower a jump may land */
    this.jump = o.jump || 0; this.jumpRise = o.jumpRise === undefined ? 11 : o.jumpRise; this.jumpDrop = o.jumpDrop === undefined ? 18 : o.jumpDrop; this._hts = new Float64Array(n);
  }
  /** can an agent at cell i jump k cells along (dx, dy) to cell j, over a gap lower than both by more than step? */
  _jumpable(i, j, dx, dy, k) {
    const a = this._tops[i], b = this._tops[j], W = this.map.w; if (!(b - a <= this.jumpRise && a - b <= this.jumpDrop)) return false;   // (NaN: false)
    for (let m = 1; m < k; m++) if (!(this._hts[i + (dy * W + dx) * m] < Math.min(a, b) - this.step)) return false;
    return true;
  }
  /** the height an agent stands at in a cell, or NaN where it can't (outside, a blocked floor; a wall where the map has no heights) */
  _top(cx, cy) {
    const m = this.map;
    if (m.types && m.height) { const c = m.cell(cx, cy); return c < 0 || (c === 0 && m.blocked && m.blocked[cy * m.w + cx]) ? NaN : c > 0 ? m.height(cx, cy) : 0; }
    return (m.walkable ? m.walkable(cx, cy) : !m.solidCell(cx, cy)) ? 0 : NaN;
  }
  /** what a link from cell i to cell j costs: k cells, or 1 plus a climb's rise in cells in a field with jumps */
  _cost(i, j, k) { return k > 1 ? k : this.jump ? 1 + Math.max(0, Math.ceil((this._tops[j] - this._tops[i] - this.step) / this.map.T)) : 1; }
  /** can an agent step from cell i to the cell j next to it? */
  _link(i, j) { const dz = this._tops[j] - this._tops[i]; return dz >= 0 ? dz <= Math.max(this.step, this.climb) : -dz <= Math.max(this.step, this.drop); }   // (NaN: false)
  /** aim the field at a world point; it rebuilds only when the target's cell or the map (map.version) changes */
  update(x, y) {
    const m = this.map, T = m.T, W = m.w, H = m.h, tx = Math.floor(x / T), ty = Math.floor(y / T);
    if (tx === this.tx && ty === this.ty && m.version === this.version) return;
    this.tx = tx; this.ty = ty; this.version = m.version;
    const d = this.d, q = this._q, top = this._tops; d.fill(1e9);
    for (let cy = 0, i = 0; cy < H; cy++) for (let cx = 0; cx < W; cx++, i++) { top[i] = this._top(cx, cy); if (this.jump) this._hts[i] = m.height ? m.height(cx, cy) : 0; }
    if (tx < 0 || ty < 0 || tx >= W || ty >= H || Number.isNaN(top[ty * W + tx])) return;
    if (this.jump) return this._withJumps(ty * W + tx);
    let h = 0, t = 0; d[ty * W + tx] = 0; q[t++] = ty * W + tx;
    while (h < t) {
      const i = q[h++], cx = i % W, cy = (i / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx; if (d[j] > d[i] + 1 && this._link(j, i)) { d[j] = d[i] + 1; q[t++] = j; }   // (from j an agent can step to i)
      }
    }
  }
  /** the field with jump links (a jump of k cells costs k, a climb more, see _cost): Dial's buckets, smallest distance first */
  _withJumps(ti) {
    const m = this.map, W = m.w, H = m.h, d = this.d, K = Math.max(2, Math.floor(this.jump / m.T) + 1), B = [[ti]]; d[ti] = 0;
    for (let dist = 0; dist < B.length; dist++) {
      const list = B[dist]; if (!list) continue;
      for (const i of list) {
        if (d[i] !== dist) continue;
        const cx = i % W, cy = (i / W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          for (let k = 1; k <= K; k++) {
            const jx = cx + dx * k, jy = cy + dy * k; if (jx < 0 || jy < 0 || jx >= W || jy >= H) break;
            const j = jy * W + jx, ok = k === 1 ? this._link(j, i) : this._jumpable(j, i, -dx, -dy, k);   // (from j an agent steps or jumps to i)
            const c = ok ? dist + this._cost(j, i, k) : 0;
            if (ok && d[j] > c) { d[j] = c; (B[c] || (B[c] = [])).push(j); }
          }
        }
      }
    }
  }
  /** the next cell to head for from (x, y): { x, y, z (its center and top), kind: 'walk' | 'climb' | 'drop' | 'jump', edge
   *  (how far (x, y) is from the side of its cell it leaves by) }, or null where the field doesn't reach (or at the target).
   *  An AI standing on the ground presses jump for a 'climb' or a 'jump' once edge is under its radius plus a little
   *  (E.Mover climbs or leaps; a press in the air would be kept for the landing) */
  next(x, y) {
    const m = this.map, T = m.T, W = m.w, cx = Math.floor(x / T), cy = Math.floor(y / T), i = cy * W + cx, here = cx >= 0 && cy >= 0 && cx < W && cy < m.h ? this.d[i] : 1e9;
    if (here === 0 || here >= 1e9) return null;
    let best = here + 1, bj = -1, bk = 0, bd = null;
    const K = this.jump ? Math.max(2, Math.floor(this.jump / T) + 1) : 1;
    for (const dir of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let k = 1; k <= K; k++) {
      const [dx, dy] = dir, nx = cx + dx * k, ny = cy + dy * k; if (nx < 0 || ny < 0 || nx >= W || ny >= m.h) break;
      const j = ny * W + nx; if (!(k === 1 ? this._link(i, j) : this._jumpable(i, j, dx, dy, k))) continue;
      const c = this.d[j] + this._cost(i, j, k); if (c < best) { best = c; bj = j; bk = k; bd = dir; }
    }
    if (bj < 0) return null;
    const dz = this._tops[bj] - this._tops[i], [dx, dy] = bd, edge = dx > 0 ? (cx + 1) * T - x : dx < 0 ? x - cx * T : dy > 0 ? (cy + 1) * T - y : y - cy * T;
    return { x: (bj % W + .5) * T, y: (((bj / W) | 0) + .5) * T, z: this._tops[bj], kind: bk > 1 ? 'jump' : dz > this.step ? 'climb' : dz < -this.step ? 'drop' : 'walk', edge };
  }
  /** normalized ground direction to walk from (x, y) toward the target (straight at it where the field doesn't reach) */
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

/* =============================================================================
 * 15. TEXTURE HELPERS for floorTex functions
 * ============================================================================= */
/** floor textures for a TileMap's floorTex(x, y), each giving [r, g, b] at a world point; as materials too: floorMat: 'grass' */
E.tex = {
  /** stone flagstones with running-bond rows. pal: {stones:[hex..], mortar, hi, lo, speck} */
  flagstone(x, y, pal, size = 16) {
    const row = Math.floor(y / size), off = (row & 1) * size / 2, col = Math.floor((x + off) / size), lx = x + off - col * size, ly = y - row * size;
    if (lx < 1 || ly < 1) return pal.mortar;
    const h = hash2(col, row); let c = pal.stones[(h * pal.stones.length) | 0];
    if (lx < 2 || ly < 2) c = pal.hi; else if (lx > size - 1.5 || ly > size - 1.5) c = pal.lo;
    const n = hash2(Math.floor(x * 1.3), Math.floor(y * 1.3)); if (n < .05) c = pal.speck;
    if (h > .93 && lx > 3 && lx < size - 3 && Math.abs(lx - ly * .7 - 3) < .6) c = pal.mortar;
    return c;
  },
  /** grass with darker tufts and a few flowers. o: { base, dark, light, flower } hex colors */
  grass(x, y, o = {}) {
    // blotches of light and dark grass at two scales, short blade marks, rare flower clusters (no single-pixel static)
    const n = noise2(x * .07, y * .07) * .65 + noise2(x * .23, y * .23) * .35, blade = noise2(x * .9, y * .35);
    const fl = noise2(x * .12 + 40, y * .12 + 40), fh = hash2(Math.floor(x / 2), Math.floor(y / 2));
    if (fl > .82 && fh > .8) return hex(fh > .93 ? (o.flower || '#f4e27a') : (o.flower2 || '#f2f2f6'));
    if (n > .66 || (blade > .78 && n > .5)) return hex(o.dark || '#3e8a3a');
    if (n < .34 || blade < .16) return hex(o.light || '#6cc25a');
    return hex(o.base || '#55a94a');
  },
  /** dirt, sand or snow: base color with soft noise and specks. o: { base, dark, light } */
  dirt(x, y, o = {}) {
    // soft patches plus small pebbles (2-3 px clusters with a lit edge), no static
    const n = noise2(x * .1, y * .1) * .7 + noise2(x * .3, y * .3) * .3, peb = noise2(x * .45 + 9, y * .45 + 3);
    if (peb > .84) return hex(noise2(x * .45 + 9, (y - 1) * .45 + 3) > .84 ? (o.dark || '#6e4a2e') : (o.light || '#c9a276'));
    return hex(n > .62 ? (o.light || '#b08a5e') : n < .3 ? (o.dark || '#7d5838') : (o.base || '#9a7048'));
  },
  /** water with static ripple lines (baked, so it does not move). o: { base, dark, light } */
  water(x, y, o = {}) {
    const w = Math.sin(x * .35 + Math.sin(y * .18) * 2.2 + y * .05);
    if (w > .93 && ((Math.floor(x) + Math.floor(y)) & 1)) return hex(o.light || '#9fe3ff');
    return hex(noise2(x * .05, y * .05) > .55 ? (o.base || '#2f7fd0') : (o.dark || '#2464b0'));
  },
  /** wooden floor boards running along x. o: { base, dark, line } */
  planks(x, y, o = {}) {
    const row = Math.floor(y / 6), ly = y - row * 6, len = 20 + Math.floor(hash2(row, 3) * 18), joint = (x + row * 13) % len;
    if (ly < 1 || joint < 1) return hex(o.line || '#4a2e1c');
    const g = hash2(Math.floor(x / 3), row); return hex(g > .7 ? (o.dark || '#8a5a34') : (o.base || '#9d6a3f'));
  },
  /** checkerboard tiles (castle floors, bonus rooms). o: { a, b, size } */
  checker(x, y, o = {}) { const s = o.size || 16; return hex(((Math.floor(x / s) + Math.floor(y / s)) & 1) ? (o.a || '#d8d0e8') : (o.b || '#5a5270')); },
  /** plain color with light noise, for roads, carpets and space floors. o: { base, amount } */
  plain(x, y, o = {}) { const c = hex(o.base || '#4a4458'), k = 1 + (Math.round((noise2(x * .15, y * .15) - .5) * 4) / 4) * (o.amount === undefined ? .14 : o.amount); return c.map(v => v * k); }
};

// the floor textures as materials: floorMat: 'dirt' draws E.tex.dirt, and the same names work on every other surface
const FLAG_PAL = { stones: ['#6b6f5a', '#767a63', '#626653'].map(hex), mortar: hex('#3a3c31'), hi: hex('#8b8f75'), lo: hex('#51543f'), speck: hex('#45473a') };
Object.assign(MATERIALS, {
  flagstone: { color: '#6b6f5a', pattern: 'stones', size: 8, floor: (x, y) => E.tex.flagstone(x, y, FLAG_PAL) },
  dirt: { color: '#9a7048', pattern: 'speck', floor: (x, y) => E.tex.dirt(x, y) },
  water: { color: '#2f7fd0', pattern: 'glaze', floor: (x, y) => E.tex.water(x, y) },
  planks: { color: '#9d6a3f', pattern: 'planks', bw: 6, floor: (x, y) => E.tex.planks(x, y) },
  checker: { color: '#d8d0e8', pattern: 'tiles', size: 16, floor: (x, y) => E.tex.checker(x, y) }
});
MATERIALS.grass.floor = (x, y) => E.tex.grass(x, y); MATERIALS.plain.floor = (x, y) => E.tex.plain(x, y);

/* =============================================================================
 * 16. PLATFORM MAP  side-scroller levels (Mario, Mega Man, Castlevania, Metroid).
 *    Tiles sit on the x/z plane (x right, z up) and are extruded a little in y, so the
 *    'side' view looks like an NES/SNES game and a tilted view ('brawler', or any
 *    View with yaw 0) looks like a 2.5D N64/PS1 remake. The play plane is y = 0.
 *    types[id] = { kind, style, side, top, line, mat }
 *      kind:  'solid' (default) | 'oneway' (jump up through, stand on top) | 'ladder'
 *             | 'slope' (dir: 1 rises to the right, -1 to the left; or from/to heights 0..1 for gentle slopes)
 *             | 'hazard' (spikes, lava: not solid, test with level.touching(body, 'hazard'))
 *             | 'deco' (drawn in the play plane, not solid) | 'back' (background wall, not solid)
 *      style: 'stone' | 'brick' | 'block' | 'ground' | 'wood' | 'metal' | 'plank' | 'spikes' | 'ladder' | 'pipe' | 'bonus' | 'liquid' | 'plain'
 *      mat:   a material (E.MATERIALS id or '#hex pattern') for a solid square tile's face in place of its style's look
 *             (plank, spikes, ladder, liquid and slopes keep their own)
 *      extra: moss: '#4a7a3a' (stone), flower: '#ffe070' (ground), glyph (bonus)
 * ============================================================================= */
const PT_DEFAULT = { kind: 'solid', style: 'block', side: '#8a7a9a' };
const PT_STYLE_FOR_KIND = { oneway: 'plank', ladder: 'ladder', hazard: 'spikes', slope: 'ground' };
class PlatformMap {
  /** { rows: [...ASCII, top row first...], legend: { '#': 1, '@': 'hero' }, types: { 1: {...} }, tile: 16, depth: 16 }.
   *  Tile kinds: 'solid' (default) | 'oneway' | 'ladder' | 'slope' | 'hazard' | 'deco' | 'back' */
  constructor(o = {}) {
    /** T: the tile size (16); depth: how deep tiles are drawn in tilted views, world units (the tile size) */
    this.T = o.tile || 16; this.depth = o.depth === undefined ? this.T : o.depth;
    const L = o.rows ? parseLevel(o.rows, o.legend) : o.level;
    if (!L) throw new Error('PlatformMap needs { rows: [...], legend: {...}, types: {...} }');
    /** w, h: the level's size in cells; types: the tile types by id, with their defaults filled in ({ kind, style,
     *  side, top, ... }) */
    this.w = L.w; this.h = L.h; this.types = {};
    for (const k in (o.types || {})) { const t = Object.assign({ kind: 'solid' }, o.types[k]); t.style = t.style || PT_STYLE_FOR_KIND[t.kind] || 'block'; t.side = t.side || t.color || (t.mat && (material(t.mat, null, 'tile material') || {}).color) || PT_DEFAULT.side; this.types[k] = t; }
    // stored bottom row first: cz = 0 is the lowest row and z grows upward
    this.cells = new Array(this.w * this.h).fill(0);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) this.cells[(this.h - 1 - y) * this.w + x] = L.cells[y * this.w + x];
    for (const id of new Set(this.cells)) if (id > 0 && !this.types[id]) { warn('ptype:' + id, 'PlatformMap: tile type ' + id + ' is used but missing from types (using a plain solid block)'); this.types[id] = Object.assign({}, PT_DEFAULT); }
    /** spawn points: { tag, ch, cx, cz, x, y: 0, z } with x = cell center and z = bottom of the cell (feet) */
    this.spawns = L.spawns.map(sp => { const cz = this.h - 1 - sp.cy; return Object.assign(sp, { cz, x: (sp.cx + .5) * this.T, y: 0, z: cz * this.T }); });
    /** version: counts every change to the cells (set); edges: 'solid' (the default) makes the level's left and
     *  right edges walls, 'open' lets bodies walk off them */
    this.version = 0; this._bake = null; this.edges = o.edges || 'solid';
  }
  /** the first spawn with this tag ({ x, y: 0, z, cx, cz }), or null */
  find(tag) { return this.spawns.find(s => s.tag === tag) || null; }
  /** every spawn with this tag */
  findAll(tag) { return this.spawns.filter(s => s.tag === tag); }
  /** tile id at column cx, row cz (cz = 0 is the bottom). Left and right of the level are solid walls unless edges: 'open' */
  cell(cx, cz) { if (cx < 0 || cx >= this.w) return this.edges === 'open' ? 0 : -1; if (cz < 0 || cz >= this.h) return 0; return this.cells[cz * this.w + cx]; }
  /** a cell's kind: 'solid', 'oneway', 'ladder', 'slope', 'hazard', 'deco' or 'back', null when empty ('solid'
   *  outside) */
  kind(cx, cz) { const c = this.cell(cx, cz); return c < 0 ? 'solid' : c === 0 ? null : this.types[c].kind; }
  /** put tile type id at a cell (0 clears it; cz counts from the bottom row); bumps version */
  set(cx, cz, id) {
    if (cx < 0 || cz < 0 || cx >= this.w || cz >= this.h) return;
    if (id > 0 && !this.types[id]) this.types[id] = Object.assign({}, PT_DEFAULT);
    this.cells[cz * this.w + cx] = id; this.version++;
  }
  /** a world point -> [cx, cz] */
  toCell(x, z) { return [Math.floor(x / this.T), Math.floor(z / this.T)]; }
  /** a cell's center -> [x, z] */
  center(cx, cz) { return [(cx + .5) * this.T, (cz + .5) * this.T]; }
  /** kind() at a world point */
  kindAt(x, z) { return this.kind(Math.floor(x / this.T), Math.floor(z / this.T)); }
  /** true where a world point is inside a solid tile */
  solidAt(x, z) { return this.kindAt(x, z) === 'solid'; }
  /** width and height of the level in world units */
  get width() { return this.w * this.T; }
  /** the level's height in world units (width is its width) */
  get height() { return this.h * this.T; }
  /** top of the highest solid or one-way tile at or below height z in this column, or null over a pit */
  groundBelow(x, z) {
    const T = this.T, cx = Math.floor(x / T);
    for (let cz = Math.min(this.h - 1, Math.floor((z + .5) / T)); cz >= 0; cz--) {
      const k = this.kind(cx, cz);
      if (k === 'slope') { const sz = this.slopeZ(cx, cz, x); if (sz <= z + .5) return sz; }
      else if ((k === 'solid' || k === 'oneway') && (cz + 1) * T <= z + .5) return (cz + 1) * T;
    }
    return null;
  }
  /** surface height of a slope tile at world x */
  slopeZ(cx, cz, x) {
    const t = this.types[this.cell(cx, cz)] || {}, T = this.T, u = clamp((x - cx * T) / T, 0, 1);
    const a = t.from !== undefined ? t.from : (t.dir < 0 ? 1 : 0), b = t.to !== undefined ? t.to : (t.dir < 0 ? 0 : 1);
    return cz * T + lerp(a, b, u) * T;
  }
  /** highest surface (tile top or slope) under the body within maxDrop below its feet, or null */
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
  /** tiles overlapped by a body box { x, z, w, h }: [{ cx, cz, id, kind }] (optionally only one kind or id) */
  cellsTouching(b, what) {
    const T = this.T, out = [], x0 = Math.floor((b.x - b.w / 2 + .01) / T), x1 = Math.floor((b.x + b.w / 2 - .01) / T), z0 = Math.floor((b.z + .01) / T), z1 = Math.floor((b.z + b.h - .01) / T);
    for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
      const id = this.cell(cx, cz); if (id <= 0) continue; const k = this.types[id].kind;
      if (what === undefined || what === k || what === id) out.push({ cx, cz, id, kind: k });
    }
    return out;
  }
  /** does the body box overlap a tile of this kind ('hazard', 'ladder', ...) or id? */
  touching(b, what) { return this.cellsTouching(b, what).length > 0; }
  /**
   * Move a body { x, z, vx, vz, w, h } (x = center, z = feet, vz > 0 = up) by its velocity, colliding with the level.
   * Sets b.onGround, b.onOneWay, b.hitWall (-1 left, 1 right, 0), b.hitCeiling, b.bumped ({ cx, cz, id } of a ceiling
   * tile hit from below, for ? blocks and bricks) and b.ground (the moving solid it stands on).
   * One-way tiles hold the body from above unless b.drop > 0. solids: optional array of extra boxes
   * { x, z, w, h, vx, vz, oneway } (moving platforms, elevators, crates) that also carry what stands on them.
   */
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
    // stick to the ground when walking down slopes or small steps (never while jumping or climbing)
    if (!b.onGround && wasGround && (b.vz || 0) <= 0 && !b.climbing) { const sz = this._surfaceBelow(b, Math.max(b.w / 2 + 3, Math.abs(b.vx || 0) * dt * 1.5 + 2)); if (sz !== null) { b.z = sz; b.vz = 0; b.onGround = true; } }
    return b;
  }
  _stands(k, cx, cz, prevZ, top, b) {
    if (k === 'solid') return true;
    if (b.drop > 0 || prevZ < top - .01) return false;
    if (k === 'oneway') return true;
    return k === 'ladder' && !b.climbing && this.kind(cx, cz + 1) !== 'ladder';   // stand on the top of a ladder
  }
  _mx(b, dx, solids) {
    const T = this.T, hw = b.w / 2; b.x += dx;
    const cx = Math.floor((dx > 0 ? b.x + hw : b.x - hw) / T);
    const blocked = () => { for (let cz = Math.floor((b.z + .01) / T); cz <= Math.floor((b.z + b.h - .01) / T); cz++) if (this.kind(cx, cz) === 'solid') return cz; return null; };
    let hit = blocked();
    if (hit !== null && b._grounded) {   // step up onto a low ledge (the top of a slope, a small step)
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
      // slopes first: they hold the body at their surface under its center (check the row of the feet and the one above)
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
  /** standing still exactly on a surface: detect it without needing gravity */
  _probe(b, solids) {
    const T = this.T, hw = b.w / 2 - .01, cz = Math.floor((b.z - .25) / T), top = (cz + 1) * T;
    const sc = Math.floor(b.x / T), zc = Math.floor((b.z - .01) / T);
    if (this.kind(sc, zc) === 'slope' && Math.abs(b.z - this.slopeZ(sc, zc, b.x)) < .5) { b.onGround = true; b.onOneWay = false; return; }
    if (Math.abs(b.z - top) < .3) for (let cx = Math.floor((b.x - hw) / T); cx <= Math.floor((b.x + hw) / T); cx++) { const k = this.kind(cx, cz); if (k && this._stands(k, cx, cz, b.z, top, b)) { b.onGround = true; b.onOneWay = k !== 'solid'; return; } }
    if (solids) for (const s of solids) if (s.solid !== false && s !== b && Math.abs(b.x - s.x) * 2 < b.w + s.w && Math.abs(b.z - (s.z + s.h)) < .3) { b.onGround = true; b.ground = s; b.onOneWay = !!s.oneway; return; }
  }
  /** projected pixel bounds of the level for this view (use for game.cam.bounds) */
  bounds(view) {
    const W = this.w * this.T, H = this.h * this.T, d = this.depth / 2; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const x of [0, W]) for (const y of [-d, d]) for (const z of [0, H]) { const s = view.p(x, y, z); x0 = Math.min(x0, s[0]); x1 = Math.max(x1, s[0]); y0 = Math.min(y0, s[1]); y1 = Math.max(y1, s[1]); }
    return { x0, y0: y0 - 4, x1, y1: y1 + 4 };
  }
  /** draw the level as the background layer: call right after r.sky() and before anything else */
  draw(r) {
    const view = r.view, g = r.ctx;
    r.game.lights._screenFrame = true;   // side-scroller lighting is measured on screen, not on a ground plane
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
    const col = back ? shade(side, -.38) : side, hi = shade(col, .28), lo = shade(col, -.32), line = t.line || shade(col, -.3);
    // front face as a screen rectangle (exact for yaw-0 views)
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
    const wx0 = cx * W, wy0 = (this.h - cz) * H;   // world-anchored pixel origin, so textures continue across tiles
    // the face: the type's material (mat) per pixel, else the style's own painter (E.MATERIALS[style].tile)
    const f = { X0, Y0, X1, Y1, W, H, col, tt, hi, lo, wx0, wy0, t, openTop, cz, T };
    const tm = t.mat ? material(t.mat, null, 'tile material') : null;
    if (tm) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) px.dot(g, X0 + x, Y0 + y, tm.hexes[matTone(tm, (wx0 + x) * T / W, (cz * H + H - y - .5) * T / H, T, T, false, 2, T / W)]);
    else if (st !== 'plain') { const e = MATERIALS[st]; if (!e || !e.tile) warn('style:' + st, 'unknown tile style "' + st + '" (drawn as a block). Styles: ' + Object.keys(MATERIALS).filter(k => MATERIALS[k].tile).concat(['plain', 'plank', 'spikes', 'ladder', 'liquid']).join(', ') + ' (or mat: a material)'); (e && e.tile || TILES.block)(g, f); }
    // carved edges: light where the tile meets open air above, shadow below and on the sides
    if (st !== 'ground' && st !== 'pipe' && st !== 'plain') {
      if (openTop) px.rect(g, X0, Y0, W, 1, tt.hi);
      if (openB) { px.rect(g, X0, Y1 - 1, W, 1, tt.deep); px.rect(g, X0, Y1 - 2, W, 1, tt.sh); }
      if (openL) px.rect(g, X0, Y0, 1, H, tt.lt);
      if (openR) px.rect(g, X1 - 1, Y0, 1, H, tt.deep);
    } else if (openB) px.rect(g, X0, Y1 - 1, W, 1, tt.deep);
  }
}
E.PlatformMap = PlatformMap;

/* ---- the platform tile styles' faces (types[id].style), as material entries' tile(g, f): f = { X0, Y0, X1, Y1, W, H (the
 *      face's screen rectangle), col (its color), tt (its tones), hi, lo, wx0, wy0 (its world-anchored pixel origin), t (the
 *      type), openTop, cz, T } ---- */
const TILES = {
  brick(g, f) {
    const { X0, Y0, W, H, col, tt, wx0, wy0, t, T } = f, course = Math.max(3, Math.round((t.course || 8) / T * H)), bw = Math.max(4, Math.round(W / 2));
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
  },
  /** castle blocks: two courses per tile, offset joints, chipped edges, cracks */
  stone(g, f) {
    const { X0, Y0, W, H, col, tt, wx0, wy0, t } = f, course = Math.max(4, Math.round(H / 2)), bw = W;
    for (let y = 0; y < H; y++) {
      const k = Math.floor((wy0 + y) / course), cy2 = (wy0 + y) % course, off = (k & 1) ? Math.round(bw / 2) : 0;
      for (let x = 0; x < W; x++) {
        const bx = Math.floor((wx0 + x + off) / bw), cxb = (wx0 + x + off) % bw, v = hash2(bx * 11 + 5, k * 17 + 3), n = noise2((wx0 + x) * .35, (wy0 + y) * .35);
        let c = v < .3 ? tt.sh : v > .78 ? tt.lt : col;
        if (n > .72) c = c === tt.lt ? col : c === col ? tt.sh : tt.deep;
        if (cy2 === 0 || cxb === 0) c = t.line || tt.deep;
        else if (cy2 === 1 || cxb === 1) c = hash2(wx0 + x, 3) > .15 ? tt.lt : col;
        else if (cy2 === course - 1 || cxb === bw - 1) c = tt.sh;
        else if (v > .9 && Math.abs(cxb - cy2 * 1.3 - bw * .3) < .6) c = tt.deep;   // a crack
        if (t.moss && cy2 < 3 && hash2(wx0 + x, wy0 + y) < .25 + (cy2 === 1 ? .2 : 0)) c = t.moss;
        if (c !== col) px.dot(g, X0 + x, Y0 + y, c);
      }
    }
  },
  /** vertical planks with grain and nails */
  wood(g, f) {
    const { X0, Y0, W, H, col, tt, wx0, wy0 } = f, pw = Math.max(3, Math.round(W / 3));
    for (let x = 0; x < W; x++) {
      const pl = Math.floor((wx0 + x) / pw), cxp = (wx0 + x) % pw, v = hash2(pl, 7);
      for (let y = 0; y < H; y++) {
        let c = v < .3 ? tt.sh : v > .75 ? tt.lt : col;
        if (cxp === 0) c = tt.deep; else if (cxp === 1) c = tt.lt;
        else if (noise2((wx0 + x) * .5, (wy0 + y) * .08 + pl * 3) > .66) c = tt.sh;
        if ((y === 2 || y === H - 3) && cxp === Math.floor(pw / 2)) c = tt.hi;
        if (c !== col) px.dot(g, X0 + x, Y0 + y, c);
      }
    }
  },
  /** riveted plate with a diagonal sheen */
  metal(g, f) {
    const { X0, Y0, W, H, col, tt } = f;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let c = col; const d = (x + y) % Math.max(6, W);
      if (d < 2) c = tt.lt; else if (d === 2) c = tt.hi;
      if (x === 0 || y === 0) c = tt.hi; else if (x === W - 1 || y === H - 1) c = tt.deep;
      if ((x === 2 || x === W - 3) && (y === 2 || y === H - 3)) c = tt.hi;
      if (c !== col) px.dot(g, X0 + x, Y0 + y, c);
    }
  },
  /** soil: soft patches and small stones, anchored to the world; grass on an open top */
  ground(g, f) {
    const { X0, Y0, X1, Y1, W, tt, wx0, wy0, t, openTop } = f;
    for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) {   // soil: soft patches and small stones, anchored to the world
      const X = wx0 + x - X0, Y = wy0 + y - Y0, n = noise2(X * .2, Y * .2) * .7 + noise2(X * .5, Y * .5) * .3, st = noise2(X * .42 + 5, Y * .42 + 11);
      if (st > .83) px.dot(g, x, y, noise2(X * .42 + 5, (Y - 1) * .42 + 11) > .83 ? tt.sh : tt.lt); else if (n > .64) px.dot(g, x, y, tt.sh); else if (n < .28) px.dot(g, x, y, tt.lt);
    }
    if (openTop) {
      const grass = t.top || '#5fbf4a', gt = tones(grass);
      for (let x = X0; x < X1; x++) { const L = 3 + (hash2(x, 11) > .6 ? 1 : 0) + (hash2(x, 23) > .9 ? 2 : 0); px.rect(g, x, Y0, 1, L, gt.base); px.dot(g, x, Y0 + L, gt.deep); if (hash2(x, 5) > .7) px.dot(g, x, Y0 + L - 1, gt.sh); if (hash2(x, 31) > .96) { px.dot(g, x, Y0 - 1, gt.lt); px.dot(g, x, Y0 - 2, t.flower || '#ffe070'); } }
      px.rect(g, X0, Y0, W, 1, gt.lt);
    }
  },
  pipe(g, f) {
    const { X0, Y0, X1, W, H, hi, lo, openTop } = f;
    const bw = Math.max(1, Math.round(W * .18)); px.rect(g, X0 + 1, Y0, bw, H, hi); px.rect(g, X1 - bw - 1, Y0, bw, H, lo); px.rect(g, X0, Y0, 1, H, lo); px.rect(g, X1 - 1, Y0, 1, H, lo);
    if (openTop) { px.rect(g, X0, Y0, W, Math.max(2, Math.round(H * .28)), hi); px.rect(g, X0, Y0 + Math.max(2, Math.round(H * .28)), W, 1, lo); }
  },
  /** a bevelled block with a speck of noise and four rivets */
  block(g, f) { TILES._bevel(g, f); const { X0, Y0, X1, Y1, W, lo } = f, q = Math.max(1, Math.round(W * .15)); for (const [qx, qy] of [[X0 + q, Y0 + q], [X1 - q - 1, Y0 + q], [X0 + q, Y1 - q - 1], [X1 - q - 1, Y1 - q - 1]]) px.dot(g, qx, qy, lo); },
  /** the block with a glyph on it (t.glyph, '?'; t.glyphColor) */
  bonus(g, f) { TILES._bevel(g, f); const { X0, Y0, W, H, lo, t } = f, sc = Math.max(1, Math.round(W / 12)); E.font.text(g, t.glyph || '?', X0 + W / 2, Y0 + Math.round(H / 2) - Math.round(3.5 * sc), t.glyphColor || '#fff4c8', { align: 'center', outline: lo, scale: sc }); },
  _bevel(g, f) {
    const { X0, Y0, X1, Y1, W, H, tt, hi, lo, wx0, wy0 } = f;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const n = noise2((wx0 + x) * .3, (wy0 + y) * .3); if (n > .7) px.dot(g, X0 + x, Y0 + y, tt.sh); else if (n < .22) px.dot(g, X0 + x, Y0 + y, tt.lt); }
    px.rect(g, X0, Y0, W, 1, hi); px.rect(g, X0, Y0, 1, H, hi); px.rect(g, X0, Y1 - 1, W, 1, lo); px.rect(g, X1 - 1, Y0, 1, H, lo);
  }
};
for (const k of ['brick', 'stone', 'wood', 'metal', 'ground', 'pipe', 'block', 'bonus']) MATERIALS[k] = Object.assign(MATERIALS[k] || {}, { tile: TILES[k] });
Object.assign(MATERIALS.wood, { color: '#8a5a36', pattern: 'planks', dir: 'v' }); Object.assign(MATERIALS.metal, { color: '#6a6e7a', pattern: 'metal' }); Object.assign(MATERIALS.ground, { color: '#7a5838', pattern: 'speck' });
Object.assign(MATERIALS.pipe, { color: '#3a9a4a', pattern: 'metal' }); Object.assign(MATERIALS.block, { color: '#8a7a9a', pattern: 'noise' }); Object.assign(MATERIALS.bonus, { color: '#d8a838', pattern: 'noise' });

/**
 * Platformer: a side-scroller character body with modern, forgiving controls (coyote time,
 * jump buffering, variable jump height, optional double jump, wall jump, dash, ladders, knockback).
 *   const hero = new E.Platformer({ x, z, w: 8, h: 22 });
 *   update: hero.update(dt, level, game.input)   (or an intent object for enemies: { x: -1..1, jump, jumpPressed, up, down, dash })
 *   then read hero.onGround, hero.jumped, hero.landed, hero.facing (1 or -1), hero.climbing, hero.air
 *   draw a Humanoid with rig.update(dt, hero.rigState())
 * Units: world units per second. One tile = 16. A 285 jump with gravity 800 clears about 3 tiles.
 */
class Platformer {
  constructor(o = {}) {
    /** x, z: its feet's position (side view: x right, z up); y: its depth (0); vx, vz: its speed; w, h: its box (x is
     *  its center, z its feet); run: top running speed; accel, decel, airAccel: how fast it speeds up and slows down
     *  on the ground and in the air; jump: the jump's starting speed; gravity: while rising; fallGravity: while
     *  falling (snappier landings); maxFall: the fastest fall; cut: the share of upward speed kept when jump is let
     *  go early (short hops); coyote: seconds a jump still works after walking off a ledge; buffer: seconds a jump
     *  pressed before landing is kept; climb: ladder speed; airJumps: extra jumps in the air (1 = double jump);
     *  wallJump: jumps off walls; wallSlide: the slowest fall against a wall; dash: dash speed (0 = no dash);
     *  dashTime: seconds a dash lasts; facing: 1 right, -1 left; onGround: standing on something; climbing: on a
     *  ladder; jumped, landed: it jumped or landed this step; air: in the air, not climbing; stun: seconds of
     *  knockback left (no control); drop: seconds left of dropping through a one-way platform; dashing: seconds of
     *  dash left */
    Object.assign(this, {
      x: 0, y: 0, z: 0, vx: 0, vz: 0, w: 8, h: 22,
      run: 95, accel: 900, decel: 1100, airAccel: 650, jump: 285, gravity: 800, fallGravity: 1150, maxFall: 330,
      cut: .45, coyote: .09, buffer: .13, climb: 70, airJumps: 0, wallJump: false, wallSlide: 70, dash: 0, dashTime: .22,
      facing: 1, onGround: false, climbing: false, jumped: false, landed: false, air: false, stun: 0, drop: 0, dashing: 0
    }, o);
    this._coy = 0; this._airJ = 0; this._cut = true; this._dashCD = 0;
  }
  /** push the body (getting hit): dir = -1 / 1 */
  knock(dir, speed = 130, up = 170, stun = .3) { this.vx = dir * speed; this.vz = up; this.stun = stun; this.climbing = false; this.dashing = 0; }
  /** state for Humanoid.update: rig.update(dt, hero.rigState({ attack })) */
  rigState(extra) { return Object.assign({ x: this.x, y: this.y, z: this.z, vx: this.vx, vy: 0, vz: this.vz, facing: this.facing > 0 ? 0 : Math.PI, air: this.air && !this.climbing, climb: !!this.climbing, hurt: this.stun > 0, dash: this.dashing > 0 }, extra); }
  /** move it one step: ctl is game.input or an intent { x: -1..1, jump, jumpPressed, up, down, dash } (enemies,
   *  bots); solids: moving platforms [{ x, z, w, h, vx, vz }] to stand on */
  update(dt, level, ctl = {}, solids) {
    let ix, jumpHeld, jumpPressed, up, down, dashPressed, consume = () => {};
    if (ctl && typeof ctl.move === 'function') {   // an E.Input
      ix = ctl.move()[0]; jumpHeld = ctl.down('jump'); jumpPressed = ctl.buffered('jump', this.buffer); up = ctl.down('up'); down = ctl.down('down');
      dashPressed = this.dash > 0 && !!ctl.map.dash && ctl.buffered('dash', .1); consume = a => ctl.consume(a);
    } else { ix = ctl.x || 0; jumpHeld = !!ctl.jump; jumpPressed = !!ctl.jumpPressed; up = !!ctl.up; down = !!ctl.down; dashPressed = !!ctl.dash; }
    if (Math.abs(ix) < .25) ix = 0;
    const wasGround = this.onGround; this.jumped = false; this.landed = false;
    this.stun -= dt; this.drop -= dt; this._dashCD -= dt;
    const ok = this.stun <= 0;
    // ladders: grab with up (or down at the top of one), leave with jump or by climbing off the end
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
      // dash (Mega Man X style)
      if (dashPressed && ok && this._dashCD <= 0) { consume('dash'); this.dashing = this.dashTime; this._dashCD = this.dashTime + .15; this.vz = Math.max(0, this.vz); }
      if (this.dashing > 0) { this.dashing -= dt; this.vx = this.facing * this.dash; if (!this.onGround) this.vz = Math.max(this.vz, 0); }
      else {
        const target = ok ? ix * this.run : this.vx, turning = ix && this.vx && Math.sign(ix) !== Math.sign(this.vx);
        const a = this.onGround ? (ix ? (turning ? this.decel * 1.3 : this.accel) : this.decel) : this.airAccel;
        this.vx = ok ? approach(this.vx, target, a * dt) : approach(this.vx, 0, 300 * dt);
      }
      if (ix && ok && this.dashing <= 0) this.facing = ix > 0 ? 1 : -1;
      if (!(this.dashing > 0 && !this.onGround)) this.vz = Math.max(-this.maxFall, this.vz - (this.vz > 0 ? this.gravity : this.fallGravity) * dt);
      if (!jumpHeld && this.vz > 0 && !this._cut) { this.vz *= this.cut; this._cut = true; }   // let go early = lower jump
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
      if (!this.hitWall && pushing && ix === pushing && !this.onGround) this.hitWall = pushing;   // keep wall contact while holding toward it
    }
    if (this.onGround && !wasGround) this.landed = true;
    this.air = !this.onGround && !this.climbing;
    return this;
  }
}
E.Platformer = Platformer;

/* =============================================================================
 * 17. BODY  ground-plane physics for top-down, isometric and brawler games:
 *    velocity, friction, wall bounce, knockback and real jumping (z) onto blocks.
 *      const b = new E.Body({ x, y, r: 5 });   b.vx = ...; b.update(dt, map);
 *    Walls lower than your feet (plus step) are walkable, so you can jump onto blocks.
 * ============================================================================= */
class Body {
  /** new E.Body({ x, y, r: 5, ... }). x, y, z: its position (z = feet); vx, vy, vz: its speed, world units per
   *  second; r: its radius; h: its height (32, a standing actor's: it spans z to z + h, so it passes under a solid shape
   *  above that and walks into one in that span); gravity: pulls z down (world units per second squared); friction: slows vx and vy per
   *  second (0 = none); bounce: 0..1, how much speed it keeps off walls and the floor; step: the height it walks up
   *  without jumping (E.HEIGHTS.step); onGround: standing; groundZ: the height of what is under it; hitWall: it
   *  touched a wall this step; landed: it landed this step */
  constructor(o = {}) { Object.assign(this, { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 5, h: 32, gravity: 700, friction: 0, bounce: 0, step: 2, onGround: true, groundZ: 0, hitWall: false, landed: false }, o); }
  /** add an impulse (knockback, explosion): push(vx, vy, vz) */
  push(ix, iy, iz = 0) { this.vx += ix; this.vy += iy; if (iz) { this.vz += iz; this.onGround = false; } return this; }
  /** leave the ground with upward speed v (only when standing). Returns true if it jumped */
  jump(v = 220) { if (!this.onGround) return false; this.vz = v; this.onGround = false; return true; }
  /** move it one step: speed, friction, walls (map.collide: lower walls are walked onto), gravity and the ground
   *  under it (map.groundAt) */
  update(dt, map) {
    /** bounced: it hit the ground and bounced up this step (dust, a thud) */
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
    if (this.onGround && this.z > ground + .5) this.onGround = false;   // walked off a ledge
    if (this.onGround) { this.z = ground; this.vz = 0; }
    else {
      this.vz -= this.gravity * dt; this.z += this.vz * dt;
      if (this.z <= ground) {
        this.z = ground;
        if (this.bounce > 0 && this.vz < -80) { this.vz = -this.vz * this.bounce; this.bounced = true; }   // bounced: hit the ground and bounced up (dust, thud)
        else { this.landed = true; this.vz = 0; this.onGround = true; }
      }
    }
    this.groundZ = ground;
    return this;
  }
}
E.Body = Body;

/* =============================================================================
 * 17b. ACTIONS  timed actions of several beats that move a body along a curve and drive its rig: climb up (and down),
 *    vault, hop down, roll, get up, and a takedown that moves two bodies at once.
 *      const act = new E.Action('climbUp', { body: hero, to: map.ledge(hero, hero.facing) });
 *      each step: if (act.update(dt)) rig.update(dt, act.rigState()); else (it is over: back to normal control)
 *    act.beat is the beat playing ('hang', 'pull', 'stand'), act.u its progress through the whole action (0..1),
 *    act.canCancel says the action may be cut short now (a marked beat), act.invulnerable that hits should miss (a roll's
 *    middle, a get-up). { reverse: true } plays it backwards (climb down). Timings are seeded from classic games
 *    (Prince of Persia's 14 frames to hang and 17 to climb up, KOF's 39-frame dodge) and quickened for modern pacing.
 *    Your own: E.ACTIONS.myMove = { beats: [['name', seconds], ...], cancel: ['name'], setup(A) {...}, at(A, beat, u) {...} },
 *    where at() returns { x, y, z, state: {...rig state...}, other: { x, y, z, state } }
 * ============================================================================= */
const _dir = d => typeof d === 'number' ? d : Math.atan2(d[1], d[0]);
const _p = (a, b, u) => ({ x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), z: lerp(a.z || 0, b.z || 0, u) });
/** the actions E.Action plays: climbUp, vault, hopDown, roll, getUp, takedown. Add your own: E.ACTIONS.name = { beats, setup, at };
 *  setup(A) and at(A, beat, u) get the action: its options A.o, A.start (where the body began), A.body; setup may change
 *  A.beats. Play one: mover.play('takedown', { other }) */
const ACTIONS = {
  /** onto a ledge (o.to: a map.ledge result): reach and hang below the edge, pull up, stand. reverse: climb down from it to o.from */
  climbUp: {
    beats: [['hang', .28], ['pull', .42], ['stand', .2]], cancel: ['hang'],
    setup(A) {
      if (!A.o.to) throw new Error('E.Action("climbUp") needs { to }: a ledge, as map.ledge(body, dir) gives it (null means there is none to climb)');
      const L = A.o.to, f = A.o.from || A.start, a = L.facing !== undefined ? L.facing : Math.atan2(L.y - f.y, L.x - f.x), c = Math.cos(a), s = Math.sin(a), r = A.body.r || 5;
      const reach = A.o.reach === undefined ? 30 : A.o.reach, ex = L.edge ? L.edge[0] : L.x - c * (r + 1), ey = L.edge ? L.edge[1] : L.y - s * (r + 1);
      A.facing = a; A.top = L.z; A.from = f;
      A.hang = { x: ex - c * r * .8, y: ey - s * r * .8, z: Math.max(f.z || 0, L.z - reach) };   // against the wall, the hands on its top
      A.lip = { x: ex + c * 2, y: ey + s * 2, z: L.z };   // a knee on the edge
      A.end = { x: L.x, y: L.y, z: L.z };
    },
    at(A, b, u) {
      const st = { facing: A.facing };
      if (b === 'hang') { const p = _p(A.from, A.hang, ease.outQuad(u)); return Object.assign(p, { state: Object.assign(st, { hang: u > .3, hangZ: A.top - p.z, air: u <= .3 }) }); }
      if (b === 'pull') {
        const z = lerp(A.hang.z, A.top, ease.inOut(u)), k = clamp((u - .45) / .55, 0, 1), xy = _p(A.hang, A.lip, ease.inQuad(k));
        return { x: xy.x, y: xy.y, z, state: Object.assign(st, u < .6 ? { hang: true, hangZ: A.top - z } : { air: true, crouch: true }) };
      }
      return Object.assign(_p(A.lip, A.end, ease.outQuad(u)), { state: Object.assign(st, { crouch: u < .55 }) });
    }
  },
  /** over a low wall at a run: a hand on its top, the body swings over, land beyond. o.to: the spot beyond; o.top: the wall's top */
  vault: {
    beats: [['plant', .1], ['over', .26], ['land', .14]],
    setup(A) {
      if (!A.o.to) throw new Error('E.Action("vault") needs { to }: the spot beyond the wall');
      const f = A.start, t = A.o.to, top = A.o.top === undefined ? Math.max(f.z || 0, t.z || 0) + 8 : A.o.top;
      A.facing = Math.atan2(t.y - f.y, t.x - f.x); A.from = f; A.end = t;
      A.near = Object.assign(_p(f, t, .3), { z: top }); A.far = Object.assign(_p(f, t, .72), { z: top });
    },
    at(A, b, u) {
      const st = { facing: A.facing };
      if (b === 'plant') return Object.assign(_p(A.from, A.near, ease.outQuad(u)), { state: Object.assign(st, { air: true }) });
      if (b === 'over') { const p = _p(A.near, A.far, u); p.z += Math.sin(u * Math.PI) * 5; return Object.assign(p, { state: Object.assign(st, { air: true, crouch: true }) }); }
      return Object.assign(_p(A.far, A.end, ease.inQuad(u)), { state: Object.assign(st, u > .8 ? { land: .5 } : { air: true }) });
    }
  },
  /** a ledge hop down (o.to: a map.drop result, or any spot below): a small rise, then the fall, the shadow staying on the
   *  ground below. The beat lasts longer the deeper it goes */
  hopDown: {
    beats: [['hop', .34]],
    setup(A) {
      if (!A.o.to) throw new Error('E.Action("hopDown") needs { to }: the spot below, as map.drop(body, dir) gives it');
      const f = A.start, t = A.o.to; A.from = f; A.end = t; A.facing = Math.atan2(t.y - f.y, t.x - f.x) || A.body.facing || 0;
      A.scale = Math.sqrt(1 + Math.max(0, (f.z || 0) - (t.z || 0)) / 30);   // deeper drops take longer (falls go as the square root)
    },
    at(A, b, u) {
      const p = _p(A.from, A.end, u); p.z = lerp(A.from.z || 0, A.end.z || 0, u * u) + Math.sin(u * Math.PI) * 6;   // the Pokémon ledge hop: up a little, then down
      return Object.assign(p, { state: { facing: A.facing, air: u < .92, land: u >= .92 ? (A.from.z - A.end.z > 24 ? 1 : .5) : 0 } });
    }
  },
  /** a roll: a dodge (o.dir, o.dist: 34) or a landing roll that carries the body on. Hits miss in its middle */
  roll: {
    beats: [['roll', .48], ['rise', .12]], cancel: ['rise'], safe: [.06, .4],
    setup(A) { const a = A.o.dir === undefined ? A.body.facing || 0 : _dir(A.o.dir), d = A.o.dist === undefined ? 34 : A.o.dist; A.facing = a; A.from = A.start; A.end = { x: A.start.x + Math.cos(a) * d, y: A.start.y + Math.sin(a) * d, z: A.start.z }; },
    at(A, b, u) {
      if (b === 'roll') return Object.assign(_p(A.from, A.end, ease.outQuad(u)), { state: { facing: A.facing, flip: u, crouch: true } });
      return Object.assign({ x: A.end.x, y: A.end.y, z: A.end.z }, { state: { facing: A.facing, crouch: u < .6 } });
    }
  },
  /** from lying down to standing: lie, sit up, one knee, stand. Hits miss until it stands */
  getUp: {
    beats: [['lie', .22], ['sit', .3], ['kneel', .28], ['stand', .22]], safe: [0, .92],
    setup(A) { A.facing = A.body.facing || 0; },
    at(A, b, u) {
      const p = { x: A.start.x, y: A.start.y, z: A.start.z }, st = { facing: A.facing };
      if (b === 'lie') st.down = 1; else if (b === 'sit') st.down = 1 - .55 * ease.inOut(u); else if (b === 'kneel') { st.down = .45 * (1 - u); st.pose = 'kneel'; } else st.pose = u < .45 ? 'kneel' : null;
      return Object.assign(p, { state: st });
    }
  },
  /** a paired takedown: the attacker (body) closes on the victim (o.other) from behind, strikes, and the victim drops.
   *  o.aerial: leap down onto them from above. act.otherState() is the victim's rig state */
  takedown: {
    beats: [['reach', .2], ['strike', .22], ['drop', .45], ['recover', .2]],
    setup(A) {
      if (!A.o.other) throw new Error('E.Action("takedown") needs { other }: the body taken down');
      const v = A.o.other, a = A.o.aerial ? Math.atan2(v.y - A.start.y, v.x - A.start.x) : v.facing !== undefined ? v.facing : Math.atan2(v.y - A.start.y, v.x - A.start.x);
      const gap = (A.body.r || 5) + (v.r || 5) - 2;
      A.facing = a; A.vic = { x: v.x, y: v.y, z: v.z || 0, facing: v.facing || 0 }; A.from = A.start;
      A.behind = { x: v.x - Math.cos(a) * gap, y: v.y - Math.sin(a) * gap, z: v.z || 0 };
      if (A.o.aerial) A.beats = [['leap', .38], ['strike', .18], ['drop', .45], ['recover', .25]];
    },
    at(A, b, u) {
      const st = { facing: A.facing }, vs = { facing: A.vic.facing }, V = { x: A.vic.x, y: A.vic.y, z: A.vic.z };
      if (b === 'reach') return Object.assign(_p(A.from, A.behind, ease.outQuad(u)), { state: Object.assign(st, { stance: 'ready' }), other: Object.assign(V, { state: vs }) });
      if (b === 'leap') {
        const p = _p(A.from, A.behind, u); p.z = lerp(A.from.z || 0, A.behind.z, u * u) + Math.sin(u * Math.PI) * 10;
        return Object.assign(p, { state: Object.assign(st, { air: true }), other: Object.assign(V, { state: vs }) });
      }
      const p = { x: A.behind.x, y: A.behind.y, z: A.behind.z };
      if (b === 'strike') return Object.assign(p, { state: Object.assign(st, { attack: E.move(A.o.aerial ? 'overhead' : 'thrust', u), land: A.o.aerial && u < .2 ? 1 : 0 }), other: Object.assign(V, { state: Object.assign(vs, { hurt: u > .4, expr: 'wince' }) }) });
      if (b === 'drop') return Object.assign(p, { state: Object.assign(st, { attack: E.move(A.o.aerial ? 'overhead' : 'thrust', 1, 'recover') }), other: Object.assign(V, { state: Object.assign(vs, { down: ease.inQuad(u) }) }) });
      return Object.assign(p, { state: Object.assign(st, { crouch: u < .5 }), other: Object.assign(V, { state: Object.assign(vs, { down: 1 }) }) });
    }
  }
};
E.ACTIONS = ACTIONS;
class Action {
  /**
   * new E.Action(name, { body, to, other, dir, dist, top, aerial, reverse, speed: 1 }): play E.ACTIONS[name] on a body (and
   * on o.other for a paired action). It moves them itself: run update(dt) every step instead of their physics, and feed
   * rigState() to the rig. Each body ends standing where the action put it
   */
  constructor(name, o = {}) {
    const spec = typeof name === 'string' ? ACTIONS[name] : name;
    if (!spec) throw new Error('E.Action: no action "' + name + '". Actions: ' + Object.keys(ACTIONS).join(', '));
    if (!o.body) throw new Error('E.Action("' + name + '") needs { body } (a Body, a Mover or any { x, y, z })');
    /** name: the action's name; spec: its E.ACTIONS entry; o: the options it was given; body, other: the bodies it moves */
    this.name = typeof name === 'string' ? name : spec.name || 'action'; this.spec = spec; this.o = o; this.body = o.body; this.other = o.other || null;
    /** start: where the body was when it began; beats: [[name, seconds], ...]; t: seconds played; done: it has ended (or
     *  was cancelled); vx, vy, vz: the body's speed this step, for the rig */
    this.start = { x: o.body.x, y: o.body.y, z: o.body.z || 0 }; this.beats = spec.beats; this.t = 0; this.done = false; this._vx = this._vy = this._vz = 0;
    spec.setup(this);
    /** the action's length in seconds (o.speed shortens it) */
    this.duration = this.beats.reduce((a, b) => a + b[1], 0) / (o.speed || 1);
    this._apply(0);
  }
  /** the beat playing now and how far through it (0..1): [name, u] */
  _at(t) {
    const k = clamp(t / this.duration, 0, 1), T = this.beats.reduce((a, b) => a + b[1], 0), raw = (this.o.reverse ? 1 - k : k) * T;
    let acc = 0;
    for (const [n, d] of this.beats) { if (raw <= acc + d || n === this.beats[this.beats.length - 1][0]) return [n, clamp((raw - acc) / d, 0, 1)]; acc += d; }
    return [this.beats[0][0], 0];
  }
  _apply(dt) {
    const [beat, bu] = this._at(this.t), r = this.spec.at(this, beat, bu), b = this.body;
    if (dt > 0) { this._vx = (r.x - b.x) / dt; this._vy = (r.y - b.y) / dt; this._vz = ((r.z || 0) - (b.z || 0)) / dt; }
    b.x = r.x; b.y = r.y; b.z = r.z || 0;
    if (b.vx !== undefined) { b.vx = 0; b.vy = 0; b.vz = 0; }
    if (r.state && r.state.facing !== undefined) b.facing = r.state.facing;
    /** the name of the beat playing now */
    this.beat = beat; this._state = r.state || {}; this._other = r.other || null;
    if (this.other && r.other) { const v = this.other; v.x = r.other.x; v.y = r.other.y; v.z = r.other.z || 0; if (v.vx !== undefined) { v.vx = v.vy = 0; } }
    if (this.o.map) this._shadowZ = this.o.map.groundAt(b.x, b.y, b.r || 0, b.z, HEIGHTS.step);   // the ground under the body (with o.map), for its shadow
  }
  /** move the bodies one step; returns true while the action runs (false once it has ended) */
  update(dt) {
    if (this.done) return false;
    this.t = Math.min(this.duration, this.t + dt);
    this._apply(dt);
    if (this.t >= this.duration) {
      this.done = true; const b = this.body;
      if (b.onGround !== undefined) { b.onGround = true; b.vz = 0; b.groundZ = b.z; }
      if (this.other && this.other.onGround !== undefined) this.other.onGround = true;
    }
    return !this.done;
  }
  /** 0..1 through the whole action */
  get u() { return this.duration ? this.t / this.duration : 1; }
  /** true during a beat marked as one the action may be cut short in (spec.cancel) */
  get canCancel() { return !this.done && !!this.spec.cancel && this.spec.cancel.includes(this.beat); }
  /** true while hits should miss (spec.safe: [from, to] of the action's progress) */
  get invulnerable() { const s = this.spec.safe; return !this.done && !!s && this.u >= s[0] && this.u <= s[1]; }
  /** stop now: the bodies stay where they are */
  cancel() { this.done = true; }
  /** the rig state for the body (merge extra over it): x, y, z, its speed, facing and the beat's pose */
  rigState(extra) { const b = this.body; return Object.assign({ x: b.x, y: b.y, z: b.z, vx: this._vx, vy: this._vy, vz: this._vz }, this._state, extra); }
  /** the rig state for the other body of a paired action (the victim of a takedown) */
  otherState(extra) { const v = this.other || {}; return Object.assign({ x: v.x, y: v.y, z: v.z, vx: 0, vy: 0 }, this._other && this._other.state, extra); }
}
E.Action = Action;

/* =============================================================================
 * 17c. MOVER  the ground views' character controller, what Platformer is to side views. Walking, running, sprinting and
 *    sneaking with acceleration; a jump with coyote time and buffering; climbing onto ledges and vaulting low walls (with
 *    E.ACTIONS); a gap-jump assist (map.landing) and hop-downs (map.drop); falls tracked (a roll above rollAt, hurt above
 *    hurtAt); the last safe spot and respawn().
 *      const hero = new E.Mover({ x, y, r: 5 });   // a Body, so map.collide, groundAt and the height rules all apply
 *      each step: hero.update(dt, map, game.input) (with new E.Game({ input: 'THIRDPERSON' })), or for an AI an intent
 *        { move: [dx, dy] (a ground direction, length <= 1), sprint, crouch, jumpPressed };   rig.update(dt, hero.rigState())
 *    read: onGround, action (the E.Action playing: climbing, vaulting, rolling; null when free), crouch, sprinting,
 *    fell (how far it fell, on the step it lands), hurt (that fall was over hurtAt), inHazard (it landed in deep water
 *    or a pit: call respawn()), lastSafe
 * ============================================================================= */
class Mover extends Body {
  /**
   * new E.Mover({ x, y, z, r: 5, ... }): any of its fields, below, as options. An E.Body: it has body.jump, push and the
   * body's fields too
   */
  constructor(o = {}) {
    super(Object.assign({ r: 5 }, o));
    /** walk, run, sprintSpeed, sneak: top speeds (world units a second); accel, airAccel: how fast it gets there; jumpSpeed: a
     *  jump's upward speed; coyote: seconds a jump still works after leaving an edge; buffer: seconds a jump press is kept;
     *  climb: climbs ledges (true); climbMax: the highest ledge it climbs; vault: walls up to this high are vaulted at a run; gapAssist: a jump at a gap
     *  aims for the far side; hopMax: drops up to this deep are hopped down; rollAt, hurtAt: fall heights that roll and that
     *  hurt; turn: how fast it turns, radians a second; facing: the angle it faces; crouch: sneaking (a toggle); sprinting:
     *  sprinting now; action: the E.Action playing, or null; fell, hurt, inHazard: what happened this step; lastSafe: the
     *  last spot it stood safely, for respawn() */
    Object.assign(this, { walk: 50, run: 85, sprintSpeed: 125, sneak: 32, accel: 700, airAccel: 260, jumpSpeed: 220, coyote: .1, buffer: .12, climb: true, climbMax: 82,
      vault: 14, gapAssist: true, hopMax: 48, rollAt: 26, hurtAt: 72, turn: 14, facing: 0, crouch: false, sprinting: false, action: null, fell: 0, hurt: false,
      inHazard: false, lastSafe: null }, o);
    this._coy = 0; this._jb = 0; this._peak = this.z; this._land = 0; this._leap = false;
  }
  /** start an action now (E.ACTIONS name, its options): it moves the body until it ends */
  play(name, o = {}) { this.action = new Action(name, Object.assign({ body: this }, o)); return this.action; }
  /** a dodge roll toward dir (an angle or [dx, dy]; default its facing) when it stands free. Returns the action, or null */
  dodge(dir, dist = 34) { if (this.action || !this.onGround) return null; return this.play('roll', { dir: dir === undefined ? this.facing : dir, dist }); }
  /** back to the last safe spot (after water, a pit, a fall it shouldn't survive) */
  respawn() { if (this.lastSafe) Object.assign(this, this.lastSafe); Object.assign(this, { vx: 0, vy: 0, vz: 0, onGround: true, action: null, inHazard: false }); this._peak = this.z; return this; }
  /** one step. ctl: game.input (needs the actions move, jump, and sprint / crouch if it has them; screen directions turn into
   *  ground ones through view, the game's by default) or an intent { move: [dx, dy], sprint, crouch, jumpPressed } */
  update(dt, map, ctl = {}, view) {
    this.fell = 0; this.hurt = false; this._land = 0;
    let mx = 0, my = 0, sprint = false, jumpPressed = false;
    if (ctl && typeof ctl.move === 'function') {
      const v = view || (E.current && E.current.view), m = ctl.move(), g = v ? v.screenDirToGround(m[0], m[1]) : m, has = a => !!ctl.map[a];
      mx = g[0]; my = g[1]; sprint = has('sprint') && ctl.down('sprint'); jumpPressed = has('jump') && ctl.pressed('jump');
      if (has('crouch') && ctl.pressed('crouch')) this.crouch = !this.crouch;
    } else if (ctl) { const m = ctl.move || [0, 0]; mx = m[0]; my = m[1]; sprint = !!ctl.sprint; jumpPressed = !!ctl.jumpPressed; if (ctl.crouch !== undefined) this.crouch = !!ctl.crouch; }
    this._jb = jumpPressed ? this.buffer : Math.max(0, this._jb - dt);
    if (this.action) {
      if (this.action.canCancel && this.action.name === 'climbUp' && this.crouch) { this.action.cancel(); this.crouch = false; this.onGround = false; }   // let go of the ledge
      else if (this.action.update(dt)) return this;
      this.action = null; this._peak = this.z;
      if (!this.onGround) return this;
    }
    const len = Math.min(1, Math.hypot(mx, my)), moving = len > .08;
    if (moving) this.facing = approachAng(this.facing, Math.atan2(my, mx), this.turn * dt);
    this.sprinting = sprint && moving && !this.crouch;
    // coyote time and a buffered jump: parkour first (a ledge, a wall to vault, a gap), else an ordinary jump
    this._coy = this.onGround ? this.coyote : Math.max(0, this._coy - dt);
    if (this._jb > 0 && (this.onGround || this._coy > 0) && map) {
      this._jb = 0; this._coy = 0;   // (one jump a press: a leap or a climb ends coyote time too)
      if (this._parkour(map, moving)) return this;
      this.vz = this.jumpSpeed; this.onGround = false; this._peak = this.z;
    }
    if (!this._leap) {
      const top = !moving ? 0 : this.crouch ? this.sneak : this.sprinting ? this.sprintSpeed : len < .55 ? this.walk : this.run, a = (this.onGround ? this.accel : this.airAccel) * dt;
      const tx = moving ? mx / Math.hypot(mx, my) * top : 0, ty = moving ? my / Math.hypot(mx, my) * top : 0, dx = tx - this.vx, dy = ty - this.vy, dl = Math.hypot(dx, dy);
      if (dl <= a) { this.vx = tx; this.vy = ty; } else { this.vx += dx / dl * a; this.vy += dy / dl * a; }
    }
    // deep water or a pit under a body coming down onto it
    const wasOver = map && this.z > HEIGHTS.step && map.blocked && (() => { const cx = Math.floor(this.x / map.T), cy = Math.floor(this.y / map.T); return map.cell(cx, cy) === 0 && map.blocked[cy * map.w + cx]; })();
    const before = this.onGround;
    super.update(dt, map);
    if (wasOver && this.z <= HEIGHTS.step) this.inHazard = true;
    if (!this.onGround) this._peak = Math.max(this._peak, this.z);
    else if (!before || this.landed) {
      this._leap = false;
      const fall = this._peak - this.z; this.fell = fall > 1 ? fall : 0;
      if (fall >= this.hurtAt) { this.hurt = true; this._land = 1.2; }
      else if (fall >= this.rollAt && Math.hypot(this.vx, this.vy) > 30) this.play('roll', { dir: Math.atan2(this.vy, this.vx), dist: Math.min(40, Math.hypot(this.vx, this.vy) * .35) });
      else if (fall >= this.rollAt) this._land = 1;
      else if (fall > 6) this._land = .4;
      this._peak = this.z;
    }
    if (this.onGround && !this.action && map && map.standable(this.x, this.y, this.z, this.r)) this.lastSafe = { x: this.x, y: this.y, z: this.z };
    return this;
  }
  /** jump at a ledge: climb it (or vault it if it is low and there is floor beyond), leap a gap, or hop down */
  _parkour(map, moving) {
    const a = this.facing;
    if (this.climb) {
      const L = map.ledge(this, a, { rise: this.climbMax });
      if (L) {
        if (L.rise <= this.vault && moving) { const over = this._beyond(map, L); if (over) { this.play('vault', { to: over, top: L.z, map }); return true; } }
        this.play('climbUp', { to: L, map }); return true;
      }
    }
    if (moving) {
      const dr = map.drop(this, a, { reach: 10 });
      if (dr && dr.fall > HEIGHTS.step) {
        const land = this.gapAssist && map.landing(this, a);
        if (land) {   // aim the jump for the far side: the speed that lands it there
          const g = this.gravity, dz = land.z - this.z, vz = Math.max(this.jumpSpeed, Math.sqrt(Math.max(0, 2 * g * dz)) + 30), t = (vz + Math.sqrt(Math.max(0, vz * vz - 2 * g * dz))) / g, d = Math.hypot(land.x - this.x, land.y - this.y);
          this.vx = (land.x - this.x) / d * d / t; this.vy = (land.y - this.y) / d * d / t; this.vz = vz; this.onGround = false; this._leap = true; this._peak = this.z;
          return true;
        }
        if (dr.fall <= this.hopMax) { this.play('hopDown', { to: dr, map }); return true; }
      }
    }
    return false;
  }
  /** past a low wall: floor at its own level beyond it, room to stand */
  _beyond(map, L) {
    const c = Math.cos(L.facing), s = Math.sin(L.facing);
    for (let k = 2; k <= 30; k++) {
      const x = L.edge[0] + c * k, y = L.edge[1] + s * k;
      if (map.heightAt(x, y) > this.z + HEIGHTS.step) continue;
      const px2 = x + c * (this.r + 1), py2 = y + s * (this.r + 1), g = map.groundAt(px2, py2, this.r, this.z + HEIGHTS.step);
      return g <= this.z + HEIGHTS.step && map.standable(px2, py2, g, this.r) ? { x: px2, y: py2, z: g } : null;
    }
    return null;
  }
  /** the rig state: rig.update(dt, hero.rigState({ attack })): its motion, crouch, sprint and landing, or the playing
   *  action's pose; extra is merged over it */
  rigState(extra) {
    if (this.action) return this.action.rigState(extra);
    return Object.assign({ x: this.x, y: this.y, z: this.z, vx: this.vx, vy: this.vy, vz: this.vz, facing: this.facing, air: !this.onGround, crouch: this.crouch, sprint: this.sprinting, land: this._land }, extra);
  }
}
E.Mover = Mover;

/* =============================================================================
 * 17d. PERCEPTION  sight, hearing and suspicion, read through the height rules (E.HEIGHTS, map.ray).
 *      const seen = E.sees(guard, hero, { map, range: 120, fov: 1.6 });   // { seen, d, angle, exposure }
 *      guard.mind.update(dt, seen, hero);   // a new E.Suspicion(): 'calm' -> 'notice' -> 'search' -> 'alert', with .last
 *      if (E.hears(guard, { x, y, z, loud: 90 }, map)) guard.mind.hear(...);   r.sightCone(guard, { map }) draws its view
 *    A target hides by its own exposure (0..1: tall grass, shadow) and by crouching (target.crouch: it shows lower and less).
 * ============================================================================= */
/**
 * can observer see target? { seen, d (ground distance), angle (observer -> target), exposure: 0..1 }. The target must be
 * within range and inside the cone fov wide (radians) about the observer's facing; exposure is the share of three points on
 * it (its feet, its chest, its head) that the observer's eyes see past every top of o.map, times the target's own exposure
 * (default 1) and .6 when it crouches (it also shows lower). o: { range: 120, fov: 1.6, facing, map, eye }
 */
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
/** how loud a noise ({ x, y, z, loud: its radius in world units, 80 }) is where listener stands: 1 at the noise, 0 at its
 *  radius and beyond, halved when a top of map stands between them (a wall muffles it) */
const hears = (lis, noise, map) => {
  const R = noise.loud === undefined ? 80 : noise.loud, d = Math.hypot(noise.x - lis.x, noise.y - lis.y, (noise.z || 0) - (lis.z || 0));
  let k = Math.max(0, 1 - d / R);
  if (k > 0 && map && !map.ray(lis, noise, { eye: HEIGHTS.eye, target: 4 }).clear) k *= .5;
  return k;
};
Object.assign(E, { sees, hears });
class Suspicion {
  /**
   * new E.Suspicion({ rise, decay, notice, search, alert, forget }): a guard's mind (its fields, below, are its options). Its level rises
   * while it sees the target (faster the more exposed and nearer), decays while it doesn't, and names a state: 'calm', 'notice'
   * (turn and look), 'search' (go to last), 'alert' (chase). An alert guard that loses the target searches for forget seconds.
   * Each step: suspicion.update(dt, seen, target)
   */
  constructor(o = {}) {
    /** level: 0..1.2, how suspicious; rise, decay: per second; notice, search, alert: the levels where each state starts;
     *  forget: seconds an alert guard searches after losing the target; state: 'calm' | 'notice' | 'search' | 'alert';
     *  last: where it last saw or heard the target ({ x, y, z }), or null; changed: the state changed this step;
     *  since: seconds since it last saw or heard anything */
    Object.assign(this, { level: 0, rise: 1.5, decay: .3, notice: .3, search: .65, alert: 1, forget: 6, state: 'calm', last: null, changed: false, since: 0 }, o);
  }
  /** one step: seen is E.sees' result (or true / false), target the body seen. Returns the state */
  update(dt, seen, target) {
    const e = seen && typeof seen === 'object' ? seen.exposure : seen ? 1 : 0, near = seen && seen.d !== undefined ? clamp(1.6 - seen.d / 80, .4, 1.6) : 1, was = this.state;
    if (e > 0) { this.level = Math.min(1.2, this.level + dt * this.rise * e * near); this.since = 0; if (target) this.last = { x: target.x, y: target.y, z: target.z || 0 }; }
    else { this.since += dt; this.level = Math.max(this._hot && this.since < this.forget ? this.search : 0, this.level - dt * this.decay); }   // once alerted, it searches a while
    this.state = this.level >= this.alert ? 'alert' : this.level >= this.search ? 'search' : this.level >= this.notice ? 'notice' : 'calm';
    if (this.state === 'alert') this._hot = true; else if (this.state === 'calm') this._hot = false;
    this.changed = this.state !== was;
    return this.state;
  }
  /** a noise heard (strength 0..1, from E.hears) at a point: at least noticed, never more than searching */
  hear(strength, at) { if (!(strength > 0)) return; this.level = Math.max(this.level, Math.min(this.search, this.notice + strength * .4)); this.since = 0; if (at) this.last = { x: at.x, y: at.y, z: at.z || 0 }; }
  /** back to calm */
  reset() { Object.assign(this, { level: 0, state: 'calm', last: null, changed: false, since: 0, _hot: false }); }
}
E.Suspicion = Suspicion;

/* =============================================================================
 * 18. BULLETS  a pool of projectiles for shooters, boss patterns and magic.
 *    plane 'ground' (top-down: bullets fly over x/y) or 'side' (side-scrollers: x/z).
 *      const shots = new E.Bullets(game, { plane: 'ground' });
 *      shots.fire({ x, y, z, vx, vy, r: 2, dmg: 1, team: 'player', color: '#ffe060', life: 2 });
 *      shots.update(dt, map);  shots.hit(enemies, (b, e) => {...}, 'player');  shots.draw(r);
 * ============================================================================= */
class Bullets {
  /** new E.Bullets(game, { plane: 'ground' | 'side', max: 800, sparks: true }). game: its game; list: the live
   *  bullets; max: at most this many at once; plane: 'ground' (they fly over x and y) or 'side' (x and z); sparks: a
   *  puff of sparks where one hits a wall */
  constructor(game, o = {}) { this._game = game; this.list = []; this.max = o.max || 800; this.plane = o.plane || 'ground'; this.sparks = o.sparks !== false; }
  /** fire one bullet. Fields: x, y, z, vx, vy, vz, r, dmg, life, team, color, core, sprite, pierce, grav, data */
  fire(b) {
    if (this.list.length >= this.max) return null;
    const q = Object.assign({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 2, dmg: 1, life: 3, t: 0, team: 'player', color: '#ffe066', core: '#ffffff', pierce: false, grav: 0, dead: false }, b);
    this.list.push(q); return q;
  }
  /** fire several at once from a pattern list of [vx, v2] (v2 = vy on the ground plane, vz in side view) */
  burst(base, vels) { const out = []; for (const v of vels) out.push(this.fire(Object.assign({}, base, this.plane === 'side' ? { vx: v[0], vz: v[1] } : { vx: v[0], vy: v[1] }))); return out; }
  /** move them one step; with a map they stop at walls (a TileMap, or a PlatformMap in side views) */
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
  /** test bullets of `team` against targets (objects with x, y, z and r, or w/h in side view). fn(bullet, target). Returns hits */
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
  /** remove every bullet, or only one team's */
  clear(team) { if (team) prune(this.list, b => b.team === team); else this.list.length = 0; }
  /** queue them for drawing (glowing cores, or their sprites) */
  draw(r) {
    const s = r.view.scale;
    for (const b of this.list) {
      if (b.sprite) { r.sprite(b.x, b.y, b.z, b.sprite, { anchor: 'center', glow: 1, flip: b.vx < 0 }); continue; }
      if (!r.visible(b.x, b.y, b.z, 12, 12, 12)) continue;
      r.queue(b.x, b.y, b.z, g => {
        const [x, y] = r.w(b.x, b.y, b.z), [tx, ty] = r.w(b.x - b.vx * .02, b.y - b.vy * .02, b.z - b.vz * .02), rad = Math.max(.6, b.r * s * .7);
        px.glow(g, 1); px.line(g, tx, ty, x, y, b.color, Math.max(1, Math.round(rad))); px.disc(g, x, y, rad, b.color); px.dot(g, x, y, b.core);
      }, { bias: .3, emissive: true });
    }
  }
}
E.Bullets = Bullets;
/** velocity helpers for bullet patterns. Angles in radians (0 = east / right). Each returns [vx, v2] or a list of them */
E.pattern = {
  /** one velocity at an angle */
  dir: (angle, speed) => [Math.cos(angle) * speed, Math.sin(angle) * speed],
  /** aim from a to b on the ground plane (x, y); aimSide uses x, z */
  aim: (a, b, speed) => { const an = Math.atan2(b.y - a.y, b.x - a.x); return [Math.cos(an) * speed, Math.sin(an) * speed]; },
  /** a velocity from a toward b in a side view (x, z) */
  aimSide: (a, b, speed) => { const an = Math.atan2((b.z || 0) - (a.z || 0), b.x - a.x); return [Math.cos(an) * speed, Math.sin(an) * speed]; },
  /** n bullets fanned across `arc` radians around `angle` */
  spread: (angle, n, arc, speed) => Array.from({ length: n }, (_, i) => { const a = angle + (n < 2 ? 0 : (i / (n - 1) - .5) * arc); return [Math.cos(a) * speed, Math.sin(a) * speed]; }),
  /** n bullets in a full circle, rotated by offset */
  ring: (n, speed, offset = 0) => Array.from({ length: n }, (_, i) => { const a = offset + i / n * TAU; return [Math.cos(a) * speed, Math.sin(a) * speed]; })
};

/* =============================================================================
 * 19. SPATIAL HASH  find nearby things fast (crowds, bullets vs many enemies)
 *      const grid = new E.SpatialHash(32); grid.build(enemies);  grid.near(x, y, 20, e => ...)
 *    Side-scrollers: grid.build(list, 'x', 'z') and query with (x, z).
 * ============================================================================= */
class SpatialHash {
  /** new E.SpatialHash(cell = 32): buckets things by position, to find what is near cheaply. cell: the bucket size
   *  in world units; map: the buckets */
  constructor(cell = 32) { this.cell = cell; this._map = new Map(); }
  _k(cx, cy) { return (cx & 0xffff) * 65536 + (cy & 0xffff); }
  /** empty it */
  clear() { this._map.clear(); return this; }
  /** put o in the bucket at (x, y) */
  add(o, x = o.x, y = o.y) { const k = this._k(Math.floor(x / this.cell), Math.floor(y / this.cell)); let a = this._map.get(k); if (!a) this._map.set(k, a = []); a.push(o); return this; }
  /** clear, then add every live thing in list (skips o.dead); do it once a step */
  build(list, xk = 'x', yk = 'y') { this.clear(); for (const o of list) if (o && !o.dead) this.add(o, o[xk], o[yk]); return this; }
  /** call fn(o) for everything in the cells touching the circle (check the exact distance yourself) */
  near(x, y, r, fn) {
    const C = this.cell;
    for (let cy = Math.floor((y - r) / C); cy <= Math.floor((y + r) / C); cy++) for (let cx = Math.floor((x - r) / C); cx <= Math.floor((x + r) / C); cx++) {
      const a = this._map.get(this._k(cx, cy)); if (a) for (const o of a) fn(o);
    }
  }
  /** what lies within about r of (x, y), as a list (near() calls a function instead) */
  query(x, y, r) { const out = []; this.near(x, y, r, o => out.push(o)); return out; }
}
E.SpatialHash = SpatialHash;

/* =============================================================================
 * 20. AUDIO  a tiny chip synthesizer (no sound files): square, pulse, triangle,
 *    saw, sine and noise voices, ready-made sound effects and a step sequencer.
 *    Browsers allow sound only after the first key press or click; the engine
 *    waits for that by itself, so call sfx() and music() whenever you like.
 * ============================================================================= */
const NOTE_RE = /^([A-Ga-g])([#b]?)(-?\d)$/, SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** note name -> frequency: E.note('A4') = 440, E.note('C#5'), E.note('Bb2'). Numbers pass through */
function noteFreq(n) {
  if (typeof n === 'number') return n;
  const m = NOTE_RE.exec(String(n).trim()); if (!m) return 0;
  const s = SEMI[m[1].toUpperCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (+m[3] + 1) * 12;
  return 440 * Math.pow(2, (s - 69) / 12);
}
E.note = noteFreq;
/** built-in sound effects. A voice is { wave, freq, to, dur, vol, arp, step, vib: [rate, depth], filter, delay } */
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
/* drum kit for music tracks with wave 'drums': k kick, s snare, h hat, o open hat, c crash, t tom */
const DRUMS = {
  k: [{ wave: 'sine', freq: 150, to: 42, dur: .14, vol: .7 }],
  s: [{ wave: 'noise', freq: 1800, dur: .12, vol: .38 }, { wave: 'triangle', freq: 220, to: 130, dur: .06, vol: .3 }],
  h: [{ wave: 'noise', freq: 7500, dur: .035, vol: .14, filter: 'highpass' }],
  o: [{ wave: 'noise', freq: 6500, dur: .2, vol: .13, filter: 'highpass' }],
  c: [{ wave: 'noise', freq: 4500, dur: .7, vol: .18, filter: 'highpass' }],
  t: [{ wave: 'triangle', freq: 180, to: 90, dur: .16, vol: .45 }]
};
class ChipAudio {
  /** game.audio: a chip synthesizer, no sound files. Sound starts after the person's first tap or key (browsers'
   *  rule); until then, and where there is no Web Audio, every call is silently skipped */
  constructor(game, signal) {
    /** game: the game it plays for; ctx: the Web Audio context, made at the first sound (null before, or where there
     *  is none); volume: master volume 0..1; sfxVolume, musicVolume: 0..1 for effects and music; muted: true while
     *  mute() is on */
    this._game = game; this._signal = signal; this.ctx = null; this.volume = .7; this.sfxVolume = 1; this.musicVolume = .5; this.muted = false;
    /** presets: the named sound effects, sfx(name) plays one and define(name, voice) adds one; song: the music
     *  playing (null for none); failed: why there is no sound (a message), or null; ducked: true while duck(true)
     *  holds the music down */
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
  /** true once the browser lets the game make sound */
  get ready() { return !!this.ctx && this.ctx.state === 'running'; }
  _levels() { if (!this.ctx) return; this._master.gain.value = this.muted ? 0 : this.volume; this._sfxBus.gain.value = this.sfxVolume; this._musBus.gain.value = this.musicVolume * (this._ducked || this.ducked ? .35 : 1); }
  /** set the master volume, 0..1 */
  setVolume(v) { this.volume = clamp(v, 0, 1); this._levels(); }
  /** toggle (or set) mute; returns the new state */
  mute(on = !this.muted) { this.muted = on; this._levels(); return on; }
  /** the page is hidden (sleep true) or back: the sound sleeps with it unless the player keeps it on (settings.background) */
  _background(sleep) { const c = this.ctx; if (!c) return; try { if (sleep && c.state === 'running') { this._slept = true; c.suspend().catch(() => {}); } else if (!sleep && this._slept) { this._slept = false; c.resume().catch(() => {}); } } catch (e) { /* closed */ } }
  /** quiet the music (to 35%) while on: under a game's own pause, map or dialog screen. The engine also ducks it while game.paused */
  duck(on = true) { on = !!on; if (this.ducked === on) return; this.ducked = on; this._levels(); }
  _duck(on) { if (this._ducked === on) return; this._ducked = on; this._levels(); }   // (the engine's own: game.paused)
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
      src.connect(f); f.connect(g); src.start(t, this._rnd() * .5);
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
  /**
   * Play a sound effect: a preset name ('jump', 'coin', 'hit', 'explode', ...), a voice object, or a list of voices.
   * opts: { vol: 0..1, pitch: multiplier, vary: random pitch spread (default 0.03) }
   */
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
  /** add or replace a named sound: audio.define('zap', { wave: 'saw', freq: 1200, to: 200, dur: .2 }) */
  define(name, voice) { this.presets[name] = voice; }
  /**
   * Loop a song (or play once with { loop: false }). song = { bpm: 120, steps: 4, tracks: [
   *   { wave: 'square', vol: .2, notes: 'C5 - E5 - G5 - . . | ...' },   one token per step
   *   { wave: 'triangle', notes: 'C3 . C3 . G2 . G2 .' },
   *   { wave: 'drums', notes: 'k . h . s . h . k k h . s . h .' } ] }
   * tokens: C4 F#3 Bb2 = note, '-' holds the previous note, '.' = rest, '|' is ignored (bar lines).
   * steps = steps per beat (4 = sixteenth notes). Each track loops on its own length.
   * E.songs has ready-made loops: title, adventure, dungeon, boss, victory.
   */
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
  /** stop the music (it fades out over 60 ms) */
  stopMusic() {
    if (this._timer) clearInterval(this._timer); this._timer = null;
    const S = this.song; this.song = null;
    if (S && this.ctx) { const t = this.ctx.currentTime; S.bus.gain.setValueAtTime(S.bus.gain.value, t); S.bus.gain.linearRampToValueAtTime(0, t + .06); setTimeout(() => { try { S.bus.disconnect(); } catch (e) { /* gone */ } }, 300); }
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
/** ready-made chiptune loops (original compositions): title, adventure, dungeon, boss, victory. game.audio.music('adventure') */
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


/* =============================================================================
 * 21b. BACKDROPS  layered parallax scenery behind the level: sky gradient, sun or
 *    moon with a halo, stars, and silhouette layers (mountains, hills, forest, city,
 *    castle, clouds, sea, fog), each shaded with hue-shifted tones and hazed toward
 *    the horizon. Layers are baked once into tiling strips, so they cost little.
 *      const bg = new E.Backdrop('castle-night');            // a preset, or:
 *      const bg = new E.Backdrop({ sky: ['#0b0a24', '#3a2860', '#b0607a'], moon: { x: .75, y: .22 }, stars: 80,
 *        layers: [{ kind: 'mountains', color: '#3a3460', y: .5, height: .3, parallax: .08 },
 *                 { kind: 'castle', color: '#1c1830', y: .62, height: .4, parallax: .18 },
 *                 { kind: 'forest', color: '#101c1c', y: .82, height: .22, parallax: .35 }] });
 *      draw(r) { bg.draw(r); level.draw(r); ... }
 *    y = where the layer's skyline sits (0 top .. 1 bottom of the screen), height = its tallest
 *    point as a share of the screen, parallax = how fast it scrolls with the camera (0..1).
 * ============================================================================= */
const BACKDROPS = {
  'day': { sky: ['#3a78d8', '#78b0ee', '#c8e4f8'], sun: { x: .8, y: .18, r: 10, color: '#fff8d8' },
    layers: [{ kind: 'clouds', color: '#ffffff', y: .28, height: .16, parallax: .05, drift: 4 }, { kind: 'mountains', color: '#7a98c8', y: .56, height: .3, parallax: .06, snow: '#eef4ff' }, { kind: 'hills', color: '#5aa060', y: .74, height: .2, parallax: .2 }, { kind: 'forest', color: '#2f7040', y: .86, height: .16, parallax: .4 }] },
  'dusk': { sky: ['#1a1440', '#6a3a78', '#e0766a', '#f8c080'], sun: { x: .3, y: .62, r: 16, color: '#ffd8a0' },
    layers: [{ kind: 'clouds', color: '#f0a090', y: .3, height: .12, parallax: .04, drift: 3 }, { kind: 'mountains', color: '#5a3a6a', y: .58, height: .32, parallax: .07 }, { kind: 'hills', color: '#3a2448', y: .76, height: .18, parallax: .2 }, { kind: 'forest', color: '#1c1428', y: .88, height: .16, parallax: .38 }] },
  'night': { sky: ['#05061a', '#141a44', '#2a3464'], moon: { x: .76, y: .2, r: 11 }, stars: 90,
    layers: [{ kind: 'mountains', color: '#1e2448', y: .58, height: .3, parallax: .06 }, { kind: 'hills', color: '#141a34', y: .76, height: .18, parallax: .18 }, { kind: 'forest', color: '#0a0e1e', y: .88, height: .16, parallax: .36 }] },
  'castle-night': { sky: ['#07051a', '#1e1648', '#4a2a6a', '#8a4a78'], moon: { x: .74, y: .22, r: 13, color: '#f4ecd8' }, stars: 80,
    layers: [{ kind: 'mountains', color: '#2a2450', y: .54, height: .28, parallax: .05 }, { kind: 'castle', color: '#18142e', y: .66, height: .5, parallax: .14, windows: '#ffcf6a' }, { kind: 'fog', color: '#8a6aa0', y: .8, height: .12, parallax: .25, drift: 6 }, { kind: 'forest', color: '#0c0a18', y: .9, height: .18, parallax: .45 }] },
  'city-night': { sky: ['#07081c', '#1c1a48', '#5a2a5a'], moon: { x: .2, y: .2, r: 9 }, stars: 50,
    layers: [{ kind: 'city', color: '#262048', y: .6, height: .42, parallax: .08, windows: '#ffd87a' }, { kind: 'city', color: '#161230', y: .74, height: .36, parallax: .22, windows: '#ffb85a', seed: 7 }] },
  'desert': { sky: ['#3a88d8', '#8ac0e8', '#f0dca8'], sun: { x: .7, y: .2, r: 12, color: '#fffbe8' },
    layers: [{ kind: 'mountains', color: '#c89a6a', y: .6, height: .22, parallax: .06 }, { kind: 'hills', color: '#e0b070', y: .76, height: .16, parallax: .2 }, { kind: 'hills', color: '#c88a4a', y: .88, height: .12, parallax: .4, seed: 5 }] },
  'forest': { sky: ['#4a88c8', '#9ac8e0', '#d8ecd8'], sun: { x: .82, y: .14, r: 9, color: '#fffbe0' },
    layers: [{ kind: 'forest', color: '#6a9a8a', y: .5, height: .26, parallax: .06 }, { kind: 'forest', color: '#3a7a4a', y: .66, height: .3, parallax: .16, seed: 3 }, { kind: 'forest', color: '#1e4a2a', y: .84, height: .34, parallax: .34, seed: 9 }] },
  'ocean': { sky: ['#2a6ad0', '#7ab8f0', '#d8f0ff'], sun: { x: .25, y: .2, r: 11, color: '#fffbe0' },
    layers: [{ kind: 'clouds', color: '#ffffff', y: .34, height: .14, parallax: .04, drift: 5 }, { kind: 'hills', color: '#6a90b8', y: .6, height: .08, parallax: .05 }, { kind: 'sea', color: '#2a70c0', y: .64, height: .36, parallax: .12 }] },
  'cave': { sky: ['#0a0810', '#1a1424', '#241a2a'],
    layers: [{ kind: 'stalactites', color: '#2a2032', y: 0, height: .3, parallax: .1 }, { kind: 'mountains', color: '#1e1826', y: .64, height: .4, parallax: .12, seed: 4 }, { kind: 'fog', color: '#4a3a5a', y: .84, height: .12, parallax: .2, drift: 3 }] },
  'space': { sky: ['#020208', '#080a1c', '#140c28'], stars: 160,
    layers: [{ kind: 'clouds', color: '#4a2a6a', y: .5, height: .5, parallax: .03, drift: 1, nebula: true }] }
};
class Backdrop {
  /** new E.Backdrop('castle-night') (a preset: E.Backdrop.presets) or new E.Backdrop({ sky: [colors top to bottom],
   *  sun, moon, stars, layers: [{ kind: 'mountains' | 'hills' | 'forest' | 'city' | 'castle' | 'clouds' | 'sea' |
   *  'fog' | 'stalactites', color, y, height, parallax, seed }] }): a parallax sky and scenery drawn behind a level.
   *  sun, moon: { x, y (0..1 of the screen), r, color } */
  constructor(o = {}) {
    if (typeof o === 'string') { const p = BACKDROPS[o]; if (!p) warn('backdrop:' + o, 'unknown backdrop preset "' + o + '". Presets: ' + Object.keys(BACKDROPS).join(', ')); o = p || BACKDROPS.day; }
    /** o: the options it was made from; sky: the sky's gradient colors, top to bottom; layers: its scenery layers,
     *  back to front, with their defaults filled in */
    this._o = o; this.sky = o.sky || ['#3a78d8', '#c8e4f8']; this.layers = (o.layers || []).map((l, i) => Object.assign({ seed: i * 17 + 3, parallax: .2, y: .7, height: .25 }, l)); this._bake = new Map();
  }
  /** the preset names, all ten: day, dusk, night, castle-night, city-night, desert, forest, ocean, cave, space */
  static get presets() { return Object.keys(BACKDROPS); }
  _strip(l, H) {
    const key = l.kind + ':' + l.seed + ':' + l.color + ':' + H + ':' + l.height + ':' + (l.windows || '') + ':' + (l.snow || '');
    let c = this._bake.get(key); if (c) return c;
    const P = 512, lh = Math.max(4, Math.round(l.height * H)), cv = mkCanvas(P, lh + 2), g = ctx2d(cv), t = tones(l.color), s = l.seed;
    const n1 = x => noise2(x * .012 + s, s * .37), n2 = x => noise2(x * .045 + s * 1.7, s), n3 = x => noise2(x * .17 + s * 3.1, s * .5);
    const wrapN = (f, x) => lerp(f(x), f(x - P), x / P);   // make the strip tile seamlessly
    const col = (x, top, cTop, cBody) => { px.rect(g, x, top, 1, lh + 2 - top, cBody); if (cTop) px.dot(g, x, top, cTop); };
    const k = l.kind;
    // seamless profiles: sums of sines with whole cycles per strip, ridged for mountains, smooth for hills
    const rp = rng(s * 7919 + 11), ph = Array.from({ length: 6 }, () => rp() * TAU);
    const ridge = x => { const u = x / P * TAU; return (.52 * (1 - Math.abs(Math.sin(u * 1.5 + ph[0]))) + .3 * (1 - Math.abs(Math.sin(u * 3.5 + ph[1]))) + .18 * (1 - Math.abs(Math.sin(u * 8.5 + ph[2])))) * .92 + .08 * noise2(x * .2, s); };
    const smooth = x => { const u = x / P * TAU; return .55 + .25 * Math.sin(u * 2 + ph[3]) + .14 * Math.sin(u * 5 + ph[4]) + .06 * Math.sin(u * 11 + ph[5]); };
    const range = (fn, x, lo, hi) => clamp((fn(x) - lo) / (hi - lo), 0, 1);
    const terrain = (fn, lo, hi, snow) => {
      for (let x = 0; x < P; x++) {
        const h = range(fn, x, lo, hi) * lh, top = Math.round(lh - h), slope = range(fn, (x + 2) % P, lo, hi) - range(fn, (x - 2 + P) % P, lo, hi);
        const litK = clamp(.5 + slope * 40, 0, 1), lit = litK > .5, rim = lit ? t.lt : t.base;
        const dith = E.style.trans === 'dither', face = litK > .62 ? t.base : litK < .38 ? t.sh : (dith ? null : mix(t.base, t.sh, .5));
        for (let y = top; y < lh + 2; y++) {
          const d = (y - top) / Math.max(1, lh - top), c = face || (litK > bayer(x, y) ? t.base : t.sh);
          if (dith) px.dot(g, x, y, d > .45 && (d - .45) * 1.6 > bayer(x + 2, y + 1) ? (c === t.base ? t.sh : t.deep) : c);
          else px.dot(g, x, y, d > .45 ? mix(c, c === t.base ? t.sh : t.deep, Math.round(Math.min(1, (d - .45) * 1.6) * 6) / 6) : c);
        }
        px.dot(g, x, top, rim);
        if (snow && h > lh * .62) { const sd = Math.round((h - lh * .62) * .55); px.rect(g, x, top, 1, sd, lit ? snow : shade(snow, -.18)); }
      }
    };
    if (k === 'mountains') terrain(ridge, .12, .95, l.snow);
    else if (k === 'hills') terrain(smooth, .15, 1, null);
    else if (k === 'forest' || k === 'stalactites') {
      const rnd = rng(s * 991 + 7), trees = [];
      for (let x = -12; x < P + 12; x += 2 + rnd() * 4) trees.push({ x, h: (.5 + range(smooth, (Math.floor(x) + P) % P, .2, 1) * .5 - rnd() * .12) * lh, r: 3.5 + rnd() * 5 });
      if (k === 'stalactites') {
        for (const tr of trees) { const w = tr.r * .9; for (const o2 of [0, P, -P]) px.poly(g, [[tr.x + o2 - w, 0], [tr.x + o2 + w, 0], [tr.x + o2 + rnd() * 2 - 1, tr.h]], rnd() < .5 ? t.base : t.sh); }
        this._bake.set(key, cv); return cv;
      }
      const floorY = Math.round(lh * .55);
      px.rect(g, 0, floorY, P, lh + 2 - floorY, t.deep);
      trees.sort((p1, p2) => p2.h - p1.h);
      for (const tr of trees) for (const o2 of [0, P, -P]) {
        const cx = tr.x + o2, cyy = lh - tr.h + tr.r;
        if (cx < -12 || cx > P + 12) continue;
        px.rect(g, cx, cyy, 1, Math.max(0, floorY + 4 - cyy), t.deep);
        px.disc(g, cx, cyy, tr.r, t.sh); px.disc(g, cx - .8, cyy - .8, Math.max(1, tr.r - 1.3), t.base);
        px.disc(g, cx - tr.r * .35, cyy - tr.r * .35, Math.max(.6, tr.r * .38), t.lt);
        px.ddisc(g, cx + tr.r * .3, cyy + tr.r * .45, tr.r * .6, t.sh, .5, 0, 0);
      }
    } else if (k === 'city') {
      const rnd = rng(s * 131 + 1);
      for (let x = 0; x < P;) {
        const w = 10 + Math.floor(rnd() * 22), h = Math.round((.3 + rnd() * .7) * lh), top = lh - h;
        px.rect(g, x, top, w, h + 2, rnd() < .5 ? t.base : t.sh); px.rect(g, x, top, 1, h, t.lt);
        if (rnd() < .3) px.rect(g, x + Math.floor(w / 2), top - 5, 1, 5, t.base);
        if (l.windows) for (let wy = top + 3; wy < lh - 2; wy += 4) for (let wx = x + 2; wx < x + w - 2; wx += 3) if (rnd() < .28) px.dot(g, wx, wy, rnd() < .8 ? l.windows : shade(l.windows, -.35));
        x += w + (rnd() < .2 ? 2 : 0);
      }
    } else if (k === 'castle') {
      const rnd = rng(s * 71 + 5), base = Math.round(lh * .38);
      px.rect(g, 0, lh - base, P, base + 2, t.sh);
      for (let x = 0; x < P; x += 4) if ((x / 4) & 1) px.rect(g, x, lh - base - 3, 3, 3, t.sh);   // battlements on the curtain wall
      for (let y = lh - base + 3; y < lh; y += 4) for (let x = (y & 4) ? 0 : 3; x < P; x += 6) px.rect(g, x, y, 1, 1, t.deep);
      for (let x = 6; x < P - 20;) {
        const w = 12 + Math.floor(rnd() * 16), h = Math.round((.5 + rnd() * .5) * lh), top = lh - h, roofH = Math.round(w * (.8 + rnd() * .5));
        px.rect(g, x, top, w, h + 2, t.base); px.rect(g, x, top, 2, h, t.lt); px.rect(g, x + w - 3, top, 3, h, t.sh);
        for (let y = top + 4; y < lh - base; y += 5) px.rect(g, x + 2, y, w - 5, 1, t.sh);   // stone courses
        if (rnd() < .65) { px.poly(g, [[x - 2, top + 1], [x + w + 2, top + 1], [x + w / 2, top - roofH]], t.deep); px.poly(g, [[x - 2, top + 1], [x + w / 2, top + 1], [x + w / 2, top - roofH]], t.sh); }
        else { for (let bx = x - 1; bx < x + w + 1; bx += 4) px.rect(g, bx, top - 3, 3, 3, t.base); px.rect(g, x - 1, top - 1, w + 2, 2, t.base); }
        if (l.windows) for (let wy = top + 6; wy < lh - base - 5; wy += 9) if (rnd() < .7) { const wx = x + Math.floor(w / 2) - 1; px.rect(g, wx, wy, 3, 4, l.windows); px.rect(g, wx + 1, wy, 1, 4, shade(l.windows, -.3)); px.rect(g, wx, wy - 1, 3, 1, t.deep); }
        x += w + 4 + Math.floor(rnd() * 24);
      }
    } else if (k === 'clouds') {
      const rnd = rng(s * 53 + 9);
      for (let i = 0; i < 14; i++) {
        const cx = rnd() * P, cy = lh * (.3 + rnd() * .5), w = 16 + rnd() * 30;
        for (let j = 0; j < 5; j++) for (const o2 of [0, P, -P]) { const bx = cx + o2 + (j - 2) * w * .22, by = cy - Math.sin(j / 4 * Math.PI) * w * .18, br = w * (.14 + Math.sin(j / 4 * Math.PI) * .12); px.ddisc(g, bx, by, br, l.nebula ? t.base : t.lt, l.nebula ? .5 : .95, 0, 0); if (!l.nebula) px.ddisc(g, bx, by + br * .4, br * .8, t.base, .6, 0, 0); }
      }
    } else if (k === 'sea') {
      px.rect(g, 0, 0, P, lh + 2, t.base);
      for (let y = 0; y < lh; y += 2 + Math.floor(y / 12)) { const w = 6 + (y % 5) * 3; for (let x = (y * 7) % 23; x < P; x += 23 + (y % 7)) px.rect(g, x, y, w, 1, y < lh * .15 ? t.hi : t.lt); }
      px.rect(g, 0, 0, P, 1, t.hi);
    } else if (k === 'fog') {
      if (E.style.trans === 'dither') { for (let y = 0; y < lh; y++) { const a = Math.sin(y / lh * Math.PI) * .55; for (let x = 0; x < P; x++) if (a * (.6 + .4 * wrapN(n2, x)) > bayer(x, y)) px.dot(g, x, y, l.color); } }
      else for (let y = 0; y < lh; y++) for (let x = 0; x < P; x += 8) { const a = Math.sin(y / lh * Math.PI) * .5 * (.55 + .45 * wrapN(n2, x)); g.globalAlpha = qa(a); px.rect(g, x, y, 8, 1, l.color); }
      g.globalAlpha = 1;
    } else warn('bdkind:' + k, 'unknown backdrop layer kind "' + k + '" (mountains, hills, forest, city, castle, clouds, sea, fog, stalactites)');
    this._bake.set(key, cv); return cv;
  }
  /** draw the backdrop first in draw(r), before the level; it scrolls with the camera by each layer's parallax */
  draw(r) {
    const o = this._o, g = r.ctx, W = r.bw, H = r.bh, t = this._o.time === undefined ? r.game.real : this._o.time;
    r.sky(this.sky);
    if (o.stars) r.starfield({ count: o.stars, speed: 0, layers: 3, height: o.starsY || .7 });
    const orb = o.sun || o.moon;
    if (orb) {
      const x = Math.round((orb.x === undefined ? .75 : orb.x) * W - r.ix * .02), y = Math.round((orb.y === undefined ? .2 : orb.y) * H), rad = orb.r || 11, c = orb.color || (o.moon ? '#f2ecd8' : '#fff4d0');
      r.glowDisc(g, x, y, rad * 2.6, c, .22); r.glowDisc(g, x, y, rad * 1.7, c, .35);
      const ct = tones(c); px.disc(g, x, y, rad, ct.base); px.disc(g, x - 1, y - 1, rad - 1.5, ct.lt);
      if (o.moon) { px.disc(g, x + rad * .3, y + rad * .15, rad * .25, ct.sh); px.disc(g, x - rad * .35, y + rad * .35, rad * .16, ct.sh); px.disc(g, x - rad * .1, y - rad * .4, rad * .12, ct.sh); }
    }
    for (const l of this.layers) {
      const strip = this._strip(l, H), P = strip.width, drift = (l.drift || 0) * t;
      const off = Math.floor(((r.ix * l.parallax + drift) % P + P) % P), top = Math.round(l.y * H - (l.kind === 'stalactites' ? 0 : strip.height - 2) - r.iy * l.parallax * .35);
      for (let x = -off; x < W; x += P) g.drawImage(strip, x, top);
      if (l.fill !== false && l.kind !== 'stalactites' && l.kind !== 'clouds' && l.kind !== 'fog' && top + strip.height < H) px.rect(g, 0, top + strip.height, W, H, tones(l.color).sh);   // fill: false leaves the sky showing below
    }
  }
}
E.Backdrop = Backdrop;

/* =============================================================================
 * 21c. PROPS  procedural pixel-art set dressing, so rooms never look empty:
 *    torch, candle, candelabra, chandelier, brazier, window (stained glass), banner,
 *    pillar, statue, crate, barrel, chest, pot, sign, fence, lamp, door, tree, pine,
 *    bush, flowers, grass, rock, crystal, bones, skull, vines, cobweb, lantern, streetlamp, awning,
 *    hydrant, trashcan, firedrum, sandbags, cactus, palm, mushroom.
 *    Options: chest / door { open: true }, pillar { broken: true }, vines / cobweb / lantern hang ({ anchor: 'top' }).
 *    E.style.propSize scales every prop (1.3-1.5 suits heroes drawn with size 1.2+).
 *    Props are upright billboards (they work in every view), cached per size and color,
 *    with animated flames that glow under GPU lighting.
 *      r.prop('torch', x, y, z)                                   // depth sorted, feet on (x, y, z)
 *      r.prop('tree', x, y, 0, { size: 1.4, color: '#3a8a4a' })   // size scales it, color tints it
 *      r.prop('window', x, 0, 40, { colors: ['#e04a4a', '#4a8ae0', '#e0c04a'] })
 *    E.prop(name, opts) returns { frames: [sprite...], glow: [sprite...] } if you want to draw it yourself.
 * ============================================================================= */
const PROP_DEFAULTS = {
  torch: { color: '#6a4a3a', w: 7, h: 20 }, candle: { color: '#e8dcc0', w: 5, h: 13 }, candelabra: { color: '#c8a040', w: 15, h: 24 },
  chandelier: { color: '#c8a040', w: 29, h: 20 }, brazier: { color: '#6a6078', w: 14, h: 18 }, window: { color: '#3a3448', w: 18, h: 32 },
  banner: { color: '#9a2a3a', w: 12, h: 30 }, pillar: { color: '#8a8098', w: 14, h: 48 }, statue: { color: '#8a8a9a', w: 16, h: 34 },
  crate: { color: '#9a6a3a', w: 14, h: 13 }, barrel: { color: '#8a5a32', w: 12, h: 15 }, chest: { color: '#8a4a2a', w: 15, h: 12 },
  pot: { color: '#b0603a', w: 10, h: 11 }, sign: { color: '#9a6a3a', w: 14, h: 16 }, fence: { color: '#9a6a3a', w: 16, h: 11 },
  lamp: { color: '#3a3a4a', w: 9, h: 36 }, door: { color: '#7a4a2a', w: 18, h: 28 }, tree: { color: '#3f8a45', w: 30, h: 40 },
  pine: { color: '#2f6a4a', w: 20, h: 38 }, bush: { color: '#4a9a4a', w: 16, h: 11 }, flowers: { color: '#e05a8a', w: 12, h: 7 },
  grass: { color: '#5aa04a', w: 10, h: 6 }, rock: { color: '#8a8490', w: 13, h: 9 }, crystal: { color: '#6ad8f0', w: 11, h: 16 },
  bones: { color: '#e8e0d0', w: 13, h: 5 }, skull: { color: '#e8e0d0', w: 7, h: 7 },
  vines: { color: '#3a8a3a', w: 14, h: 34 }, cobweb: { color: '#c8c8d8', w: 16, h: 16 }, lantern: { color: '#d8402a', w: 9, h: 14 },
  streetlamp: { color: '#2a2a3a', w: 14, h: 52 }, awning: { color: '#c83a3a', w: 32, h: 12 }, hydrant: { color: '#d83a2a', w: 9, h: 14 },
  trashcan: { color: '#7a8a8a', w: 11, h: 14 }, firedrum: { color: '#6a5a50', w: 12, h: 24 }, sandbags: { color: '#b0a070', w: 24, h: 12 },
  cactus: { color: '#4a9a4a', w: 14, h: 28 }, palm: { color: '#3a9a4a', w: 34, h: 44 }, mushroom: { color: '#d83a3a', w: 14, h: 14 }
};
const _props = new Map();
function drawFlame(g, cx, by, w, h, f, hot = '#fff4c0', mid = '#ffc040', out = '#ff6a20') {
  const sway = Math.sin(f * 1.7) * w * .18, tipX = cx + sway, tipY = by - h * (.85 + .15 * Math.sin(f * 2.3));
  px.poly(g, [[cx - w / 2, by], [tipX, tipY], [cx + w / 2, by]], out);
  px.disc(g, cx, by - h * .22, w * .45, out);
  px.poly(g, [[cx - w * .3, by], [tipX * .6 + cx * .4, by - h * .62], [cx + w * .3, by]], mid);
  px.disc(g, cx, by - h * .18, Math.max(.5, w * .22), hot);
}
/** build (and cache) a prop: { frames: [sprite], glow: [sprite] | null, w, h } */
function prop(name, o = {}) {
  const d = PROP_DEFAULTS[name];
  if (!d) { warn('prop:' + name, 'unknown prop "' + name + '". Props: ' + Object.keys(PROP_DEFAULTS).join(', ')); return null; }
  const size = (o.size || 1) * (E.style.propSize || 1), color = o.color || d.color, key = name + ':' + size + ':' + color + ':' + (o.colors || '') + ':' + (o.variant || 0) + ':' + (o.open ? 1 : 0) + (o.broken ? 1 : 0) + ':' + (o.color2 || '') + ':' + (o.blossom || '') + ':' + (o.emblem || '') + ':' + (o.berries || '') + ':' + (o.flame || '') + (o.flameOut || '');
  let p = _props.get(key); if (p) return p;
  const W = Math.max(3, Math.round(d.w * size)), H = Math.max(3, Math.round(d.h * size)), t = tones(color), rnd = rng((o.variant || 0) * 97 + name.length * 13);
  const make = (fn) => { const c = mkCanvas(W, H), g = ctx2d(c); fn(g); return c; };
  const toSprite = c => { const g = c.getContext('2d'), data = g.getImageData(0, 0, W, H).data, runs = [], fl = mkCanvas(W, H), fg = ctx2d(fl); fg.save(); fg.scale(-1, 1); fg.drawImage(c, -W, 0); fg.restore(); for (let y = 0; y < H; y++) for (let x = 0; x < W;) { if (!data[(y * W + x) * 4 + 3]) { x++; continue; } let n = 1; while (x + n < W && data[(y * W + x + n) * 4 + 3]) n++; runs.push([x, y, n, 1]); x += n; } let mx = 0, my = 0; for (const r0 of runs) { mx += r0[0] + r0[2] / 2; my += r0[1]; } return { w: W, h: H, cv: c, fl, runs, isSprite: true, mx: runs.length ? mx / runs.length : W / 2, my: runs.length ? my / runs.length : H / 2 }; };
  const cx = W / 2, s = size, flames = [];
  const base = make(g => {
    switch (name) {
      case 'torch': px.rect(g, cx - 1.5 * s, H * .45, 3 * s, H * .55, t.sh); px.rect(g, cx - 1.5 * s, H * .45, 1 * s, H * .55, t.base); px.rect(g, cx - 3 * s, H * .42, 6 * s, 2 * s, tones('#8a8090').base); flames.push([cx, H * .43, 5 * s, H * .42]); break;
      case 'candle': px.rect(g, cx - 1.5 * s, H * .45, 3 * s, H * .55, t.base); px.rect(g, cx + .5 * s, H * .45, 1 * s, H * .55, t.sh); px.rect(g, cx - 1.5 * s, H * .45, 3 * s, 1, t.hi); px.rect(g, cx - .5, H * .38, 1, H * .08, '#3a2a2a'); flames.push([cx, H * .4, 3 * s, H * .38]); break;
      case 'candelabra': { px.rect(g, cx - 1, H * .35, 2, H * .6, t.base); px.rect(g, cx - 4 * s, H - 2 * s, 8 * s, 2 * s, t.sh); px.rect(g, cx - 6 * s, H * .45, 12 * s, 1.5 * s, t.base); for (const dx of [-6, 0, 6]) { px.rect(g, cx + dx * s - 1, H * .32, 2, H * .14, '#e8dcc0'); flames.push([cx + dx * s, H * .31, 3 * s, H * .3]); } px.dot(g, cx - 1, H * .5, t.hi); break; }
      case 'chandelier': { px.rect(g, cx - .5, 0, 1, H * .35, t.sh); px.ell(g, cx, H * .55, W * .46, 2 * s, t.sh); px.ell(g, cx, H * .52, W * .44, 1.2 * s, t.base); for (const dx of [-11, -5.5, 0, 5.5, 11]) { px.rect(g, cx + dx * s - 1, H * .38, 2, H * .14, '#e8dcc0'); flames.push([cx + dx * s, H * .37, 3 * s, H * .34]); } for (const dx of [-8, 0, 8]) px.dot(g, cx + dx * s, H * .62 + 2, tones('#bfe8ff').lt); break; }
      case 'brazier': { const bt = tones('#6a6078'); px.poly(g, [[cx - W * .45, H * .45], [cx + W * .45, H * .45], [cx + W * .3, H * .65], [cx - W * .3, H * .65]], bt.sh); px.rect(g, cx - W * .45, H * .45, W * .9, 1, bt.lt); px.rect(g, cx - 1.5 * s, H * .65, 3 * s, H * .3, bt.base); px.rect(g, cx - 4 * s, H - 2 * s, 8 * s, 2 * s, bt.sh); flames.push([cx, H * .47, W * .7, H * .46]); break; }
      case 'window': {   // gothic stained glass: a rose of radial panes in the arch, lancets below, dark lead cames, a stone frame
        const cols = o.colors || ['#d8404a', '#4a7ad8', '#e8c04a', '#4ac070', '#9a5ad8'], lead = '#140e1c', ac = Math.max(H * .3, W / 2), ar = (W - 4) / 2;
        px.rect(g, 0, ac, W, H - ac, t.sh); px.disc(g, cx, ac, W / 2 - .35, t.sh); px.rect(g, 0, ac, 1, H - ac, t.lt);
        for (let y = 2; y < H - 3; y++) for (let x = 2; x < W - 2; x++) {
          const dx = x + .5 - cx, dy = y + .5 - ac, d = Math.hypot(dx, dy);
          let c;
          if (d < ar - .6) {   // the rose: 12 sectors in 3 rings, a gold boss in the middle
            const a = (Math.atan2(dy, dx) + TAU) % TAU, sec = a / TAU * 12, ring = d / (ar - .6) * 3;
            if (d < Math.max(1.2, ar * .22)) c = d < ar * .12 ? '#fff6c8' : '#e8b840';
            else if (Math.abs(sec - Math.round(sec)) * d < .55 || Math.abs(ring - Math.round(ring)) * ar / 3 < .45) c = lead;
            else { const pc = cols[(Math.floor(sec) + Math.floor(ring) * 5) % cols.length]; c = ring < 1.6 ? shade(pc, .25) : pc; }
          } else if (y < ac) continue;                  // outside the arch
          else if (y < ac + ar) c = t.base;             // carved stone beside the rose
          else {                                        // three lancets with lead cames
            const lx = (x - 2) / (W - 4) * 3, li = Math.floor(lx), row = Math.floor((y - ac - ar) / 4);
            c = (lx - li) * (W - 4) / 3 < 1 || (y - ac - ar) % 4 === 0 ? lead : cols[(li * 2 + row + 1) % cols.length];
          }
          px.dot(g, x, y, c);
        }
        px.rect(g, 1, H - 3, W - 2, 3, t.base); px.rect(g, 1, H - 3, W - 2, 1, t.lt); break; }
      case 'banner': { const bt = tones(color); px.rect(g, 0, 0, W, 2 * s, tones('#c8a040').base); px.poly(g, [[1, 2 * s], [W - 1, 2 * s], [W - 1, H], [cx, H - 5 * s], [1, H]], bt.base); px.rect(g, 1, 2 * s, 2, H - 4 * s, bt.lt); px.rect(g, W - 3, 2 * s, 2, H - 4 * s, bt.sh); const et = tones(o.emblem || '#e8c04a'); px.disc(g, cx, H * .42, W * .22, et.base); px.disc(g, cx - .5, H * .42 - .5, W * .12, et.lt); break; }
      case 'pillar': if (o.broken) { const top = H * .35; px.poly(g, [[2, top + 4 * s], [cx - 2, top], [cx + 1, top + 3 * s], [W - 2, top - 2 * s], [W - 2, H - 5 * s], [2, H - 5 * s]], t.base); for (let x = 3; x < W - 3; x += 3) px.rect(g, x, top + 4 * s, 1, H - top - 9 * s, t.sh); px.rect(g, 2, top + 4 * s, 2, H - top - 9 * s, t.lt); px.rect(g, W - 4, top, 2, H - top - 5 * s, t.deep); px.rect(g, 0, H - 5 * s, W, 2 * s, t.base); px.rect(g, 1, H - 3 * s, W - 2, 3 * s, t.sh); px.ell(g, W - 2, H - 2, 3 * s, 1.5 * s, t.sh); px.dot(g, 1, H - 2, t.lt); break; }
        { px.rect(g, 1, 0, W - 2, 4 * s, t.lt); px.rect(g, 0, 3 * s, W, 2 * s, t.base); px.rect(g, 2, 5 * s, W - 4, H - 10 * s, t.base); for (let x = 3; x < W - 3; x += 3) px.rect(g, x, 5 * s, 1, H - 10 * s, t.sh); px.rect(g, 2, 5 * s, 2, H - 10 * s, t.lt); px.rect(g, W - 4, 5 * s, 2, H - 10 * s, t.deep); px.rect(g, 0, H - 5 * s, W, 2 * s, t.base); px.rect(g, 1, H - 3 * s, W - 2, 3 * s, t.sh); break; }
      case 'statue': { px.rect(g, 1, H - 7 * s, W - 2, 7 * s, t.sh); px.rect(g, 1, H - 7 * s, W - 2, 1, t.lt); px.disc(g, cx, H * .18, 3.2 * s, t.base); px.poly(g, [[cx - 5 * s, H * .3], [cx + 5 * s, H * .3], [cx + 4 * s, H - 7 * s], [cx - 4 * s, H - 7 * s]], t.base); px.rect(g, cx + 2 * s, H * .3, 2 * s, H * .5, t.sh); px.line(g, cx + 6 * s, H * .05, cx + 5 * s, H - 8 * s, t.lt, Math.max(1, Math.round(s))); px.disc(g, cx - 1, H * .17, 1.4 * s, t.lt); break; }
      case 'crate': { px.rect(g, 0, 0, W, H, t.base); px.rect(g, 0, 0, W, 2, t.lt); px.rect(g, 0, H - 2, W, 2, t.sh); px.rect(g, 0, 0, 2, H, t.lt); px.rect(g, W - 2, 0, 2, H, t.sh); px.line(g, 2, 2, W - 3, H - 3, t.sh, 2); px.line(g, 2, 3, W - 3, H - 2, t.lt); break; }
      case 'barrel': { px.ell(g, cx, H / 2, W / 2 - .3, H / 2 - .3, t.base); px.rect(g, 1, 2, W - 2, H - 4, t.base); px.rect(g, 2, 2, 2, H - 4, t.lt); px.rect(g, W - 4, 2, 2, H - 4, t.sh); const hb = tones('#6a6a78'); for (const y of [2, H / 2, H - 4]) px.rect(g, 1, y, W - 2, 1.5, hb.base); px.ell(g, cx, 2, W / 2 - 1, 1.5, t.sh); break; }
      case 'chest': if (o.open) { px.rect(g, 1, 0, W - 2, H * .42, t.deep); px.rect(g, 2, 1, W - 4, H * .34, t.sh); px.rect(g, 1, 0, W - 2, 1, t.lt); const gt = tones('#e8c04a'); px.ell(g, cx, H * .4, W / 2 - 2, H * .1, gt.base); for (let i = 0; i < 4; i++) px.dot(g, 3 + rnd() * (W - 6), H * (.34 + rnd() * .1), gt.hi); }
        else px.ell(g, cx, H * .35, W / 2 - .3, H * .3, t.lt);
        { px.rect(g, 0, H * .35, W, H * .65, t.base); px.rect(g, 0, H * .35, W, 1, t.sh); const mt = tones('#e8c04a'); px.rect(g, 0, H * .35, 2, H * .65, mt.sh); px.rect(g, W - 2, H * .35, 2, H * .65, mt.sh); px.rect(g, cx - 1.5, H * .4, 3, 3, mt.lt); px.rect(g, 0, H - 2, W, 2, t.sh); break; }
      case 'pot': { px.ell(g, cx, H * .6, W / 2 - .3, H * .4 - .3, t.base); px.rect(g, cx - W * .25, 0, W * .5, H * .25, t.base); px.rect(g, cx - W * .3, 0, W * .6, 1.5, t.lt); px.ell(g, cx - W * .15, H * .5, W * .15, H * .15, t.lt); px.ell(g, cx + W * .2, H * .7, W * .12, H * .15, t.sh); break; }
      case 'sign': { px.rect(g, cx - 1, H * .4, 2, H * .6, t.sh); px.rect(g, 0, 0, W, H * .5, t.base); px.rect(g, 0, 0, W, 1, t.lt); px.rect(g, 0, H * .5 - 1, W, 1, t.sh); for (let y = 3; y < H * .45; y += 2) px.rect(g, 3, y, W - 6 - (y % 3) * 2, 1, t.deep); break; }
      case 'fence': { for (const x of [1, cx - 1, W - 3]) { px.rect(g, x, 0, 2, H, t.base); px.rect(g, x, 0, 1, H, t.lt); } px.rect(g, 0, H * .25, W, 2, t.base); px.rect(g, 0, H * .65, W, 2, t.base); px.rect(g, 0, H * .25 + 1, W, 1, t.sh); break; }
      case 'lamp': { const lt = tones('#3a3a4a'); px.rect(g, cx - 1, H * .25, 2, H * .75, lt.base); px.rect(g, cx - 3, H - 3, 6, 3, lt.sh); px.rect(g, cx - 3, H * .12, 6, H * .16, lt.sh); px.rect(g, cx - 2, H * .14, 4, H * .12, '#ffe8a0'); px.rect(g, cx - 4, H * .1, 8, 2, lt.base); flames.push(null); break; }
      case 'door': if (o.open) { const st = tones('#6a6078'); px.rect(g, 0, H * .3, W, H * .7, st.sh); px.disc(g, cx, H * .32, W / 2 - .35, st.sh); px.rect(g, 2, H * .32, W - 4, H * .68, '#0c0a14'); px.disc(g, cx, H * .33, W / 2 - 2.3, '#0c0a14'); px.rect(g, 3, H - 3, W - 6, 3, '#2a2030'); px.rect(g, 2, H * .3, 3, H * .7, t.base); px.rect(g, 2, H * .3, 1, H * .7, t.lt); break; }
        { px.rect(g, 0, H * .3, W, H * .7, t.deep); px.disc(g, cx, H * .32, W / 2 - .35, t.deep); px.rect(g, 2, H * .32, W - 4, H * .68, t.base); px.disc(g, cx, H * .33, W / 2 - 2.3, t.base); for (let x = 5; x < W - 3; x += 4) px.rect(g, x, H * .15, 1, H * .85, t.sh); const mt = tones('#5a5a6a'); px.rect(g, 2, H * .45, W - 4, 1.5, mt.base); px.rect(g, 2, H * .8, W - 4, 1.5, mt.base); px.disc(g, W - 5, H * .62, 1.2, tones('#e8c04a').lt); break; }
      case 'tree': { const tr = tones('#6a4a2a'); px.rect(g, cx - 2 * s, H * .55, 4 * s, H * .45, tr.base); px.rect(g, cx - 2 * s, H * .55, 1, H * .45, tr.lt); px.rect(g, cx + s, H * .55, 1, H * .45, tr.sh);
        const blobs = [[0, .3, .36], [-.28, .42, .26], [.28, .42, .26], [-.14, .18, .24], [.16, .2, .22]];
        for (const [bx, by, br] of blobs) { px.disc(g, cx + bx * W, H * by, br * W, t.sh); } for (const [bx, by, br] of blobs) { px.disc(g, cx + bx * W - 1, H * by - 1, br * W - 1.5, t.base); px.disc(g, cx + bx * W - br * W * .35, H * by - br * W * .35, br * W * .45, t.lt); }
        for (let i = 0; i < 12; i++) px.dot(g, cx + (rnd() - .5) * W * .7, H * (.12 + rnd() * .45), rnd() < .5 ? t.hi : t.deep); break; }
      case 'pine': { const tr = tones('#5a3a24'); px.rect(g, cx - 1.5 * s, H * .8, 3 * s, H * .2, tr.base); for (let i = 0; i < 4; i++) { const y0 = H * (.05 + i * .2), y1 = y0 + H * .32, w2 = W * (.25 + i * .09); px.poly(g, [[cx, y0], [cx + w2, y1], [cx - w2, y1]], t.sh); px.poly(g, [[cx, y0 + 1], [cx, y1 - 1], [cx - w2 + 2, y1 - 1]], t.base); px.line(g, cx - 1, y0 + 2, cx - w2 * .6, y1 - 2, t.lt); } break; }
      case 'bush': { for (const [bx, by, br] of [[-.25, .6, .32], [.25, .6, .32], [0, .45, .38]]) px.disc(g, cx + bx * W, H * by, br * W, t.sh); for (const [bx, by, br] of [[-.25, .6, .32], [.25, .6, .32], [0, .45, .38]]) { px.disc(g, cx + bx * W - 1, H * by - 1, br * W - 1.4, t.base); px.dot(g, cx + bx * W - br * W * .4, H * by - br * W * .4, t.lt); } if (o.berries) for (let i = 0; i < 4; i++) px.dot(g, cx + (rnd() - .5) * W * .7, H * (.4 + rnd() * .4), o.berries); break; }
      case 'flowers': { const gt = tones('#4a9a4a'); for (let i = 0; i < 5; i++) { const x = 1 + rnd() * (W - 2), y = 1 + rnd() * (H - 3); px.line(g, x, y, x + (rnd() - .5) * 2, H, gt.base); const ft = tones(i % 2 ? color : (o.color2 || '#f0e060')); px.dot(g, x - 1, y, ft.base); px.dot(g, x + 1, y, ft.base); px.dot(g, x, y - 1, ft.base); px.dot(g, x, y + 1, ft.sh); px.dot(g, x, y, ft.hi); } break; }
      case 'grass': { for (let i = 0; i < 7; i++) { const x = 1 + i * (W - 2) / 6, hh = H * (.5 + rnd() * .5); px.line(g, x, H, x + (rnd() - .5) * 3, H - hh, i % 2 ? t.base : t.lt); } break; }
      case 'rock': { px.ell(g, cx, H * .6, W / 2 - .3, H * .45, t.sh); px.ell(g, cx - 1, H * .52, W / 2 - 1.5, H * .38, t.base); px.ell(g, cx - W * .18, H * .38, W * .18, H * .15, t.lt); px.dot(g, cx + W * .2, H * .6, t.deep); break; }
      case 'crystal': { for (const [dx, hh, w2] of [[-3, .7, 2.5], [3, .6, 2.2], [0, 1, 3]]) { px.poly(g, [[cx + dx * s - w2 * s, H], [cx + dx * s, H * (1 - hh)], [cx + dx * s + w2 * s, H]], t.base); px.poly(g, [[cx + dx * s - w2 * s, H], [cx + dx * s, H * (1 - hh)], [cx + dx * s, H]], t.lt); px.dot(g, cx + dx * s - 1, H * (1 - hh) + 2, t.hi); } flames.push(null); break; }
      case 'bones': { px.line(g, 1, H - 2, W - 2, 1, t.base, 2); px.line(g, 1, 1, W - 3, H - 1, t.sh, 2); px.disc(g, 1, H - 2, 1.2, t.lt); px.disc(g, W - 2, 1, 1.2, t.lt); break; }
      case 'vines': { for (let k = 0; k < 3; k++) { const x0 = W * (.2 + k * .3), len = H * (.55 + rnd() * .45); for (let y = 0; y < len; y++) { const x = x0 + Math.sin(y * .3 + k * 2) * 1.5 * s; px.dot(g, x, y, t.deep); if ((y + k * 2) % Math.max(3, Math.round(4 * s)) === 0) { const sd = (y >> 2) & 1 ? 1 : -1; px.ell(g, x + sd * 2 * s, y, 1.8 * s, 1.1 * s, t.base); px.dot(g, x + sd * 2 * s - .5, y - .5, t.lt); } } if (o.blossom) px.disc(g, x0, len - 1, 1.2 * s, o.blossom); } break; }
      case 'cobweb': { for (let k = 0; k <= 4; k++) { const a = k / 4 * Math.PI / 2; px.line(g, 0, 0, Math.cos(a) * (W - 1), Math.sin(a) * (H - 1), t.base); } for (let rr = 4 * s; rr < W; rr += 4 * s) for (let k = 0; k < 4; k++) { const a0 = k / 4 * Math.PI / 2, a1 = (k + 1) / 4 * Math.PI / 2, am = (a0 + a1) / 2, sg = .84; px.line(g, Math.cos(a0) * rr, Math.sin(a0) * rr, Math.cos(am) * rr * sg, Math.sin(am) * rr * sg, t.sh); px.line(g, Math.cos(am) * rr * sg, Math.sin(am) * rr * sg, Math.cos(a1) * rr, Math.sin(a1) * rr, t.sh); } break; }
      case 'lantern': { px.rect(g, cx - .5, 0, 1, 2 * s, '#2a2024'); px.rect(g, cx - 2 * s, 2 * s, 4 * s, 1.5 * s, '#2a2024'); px.ell(g, cx, H * .55, W / 2 - .3, H * .36, t.base); px.ell(g, cx - 1, H * .52, W * .28, H * .28, t.lt); px.ell(g, cx - 1.5, H * .48, W * .12, H * .16, '#fff0c0'); for (const y of [H * .35, H * .55, H * .75]) px.rect(g, cx - W * .38, y, W * .76, 1, t.sh); px.rect(g, cx - 2 * s, H - 2 * s, 4 * s, 1.5 * s, '#2a2024'); flames.push(null); break; }
      case 'streetlamp': { px.rect(g, cx - s, H * .15, 2 * s, H * .85, t.base); px.rect(g, cx - s, H * .15, 1, H * .85, t.lt); px.rect(g, cx - 3 * s, H - 4 * s, 6 * s, 4 * s, t.sh); px.rect(g, cx - 3 * s, H - 4 * s, 6 * s, 1, t.lt); px.rect(g, cx - 2 * s, H * .6, 4 * s, 2, t.sh); px.rect(g, cx - 5 * s, H * .06, 10 * s, 2 * s, t.sh); px.rect(g, cx - 5 * s, H * .06, 10 * s, 1, t.lt); px.poly(g, [[cx - 4 * s, H * .06 + 2 * s], [cx + 4 * s, H * .06 + 2 * s], [cx + 2.5 * s, H * .17], [cx - 2.5 * s, H * .17]], '#ffe8a0'); px.rect(g, cx - 1.5 * s, H * .06 + 2 * s, 3 * s, 2 * s, '#fffbe8'); px.rect(g, cx - .5, 0, 1, H * .06, t.sh); flames.push(null); break; }
      case 'awning': { const c2 = tones(o.color2 || '#f0e8d8'), sw = Math.max(3, Math.round(4 * s)); for (let x = 0, i = 0; x < W; x += sw, i++) { const st = i & 1 ? c2 : t; px.rect(g, x, 2 * s, sw, H - 5 * s, st.base); px.rect(g, x, 2 * s, sw, 1.5, st.lt); px.disc(g, x + sw / 2, H - 3.2 * s, sw / 2, st.base); px.rect(g, x + sw - 1, 2 * s, 1, H - 5 * s, st.sh); } px.rect(g, 0, 0, W, 2 * s, t.deep); px.rect(g, 0, 0, W, 1, tones('#8a8a9a').lt); break; }
      case 'hydrant': { px.rect(g, cx - 3 * s, H * .3, 6 * s, H * .6, t.base); px.rect(g, cx - 3 * s, H * .3, 1.5 * s, H * .6, t.lt); px.rect(g, cx - 2.4 * s, H * .3, .6 * s, H * .6, t.hi); px.rect(g, cx + 1 * s, H * .3, 2 * s, H * .6, t.sh); px.rect(g, cx + 2.2 * s, H * .3, .8 * s, H * .6, t.deep); for (const yy of [H * .62, H * .8]) px.rect(g, cx - 3 * s, yy, 6 * s, Math.max(1, .5 * s), t.sh); px.disc(g, cx, H * .3, 3 * s, t.base); px.dot(g, cx - 1, H * .22, t.hi); px.rect(g, cx - 1, 0, 2, H * .15, t.sh); px.rect(g, 0, H * .45, W, 2.5 * s, t.base); px.rect(g, 0, H * .45 + 2 * s, W, 1, t.sh); px.rect(g, cx - 4 * s, H - 2 * s, 8 * s, 2 * s, t.deep); break; }
      case 'trashcan': { px.poly(g, [[1, H * .2], [W - 1, H * .2], [W - 2, H], [2, H]], t.base); for (let x = 4; x < W - 3; x += 2) px.rect(g, x, H * .28, 1, H * .66, t.sh); px.rect(g, 2, H * .2, 2, H * .8, t.lt); px.rect(g, W - 3, H * .2, 1, H * .8, t.deep); px.rect(g, 0, H * .12, W, 2 * s, t.lt); px.rect(g, 0, H * .12 + 2 * s, W, 1, t.sh); px.rect(g, cx - 1.5, H * .02, 3, H * .1, t.sh); break; }
      case 'firedrum': { const y0 = H * .45, rt = tones('#8a4a2a'); px.rect(g, 1, y0, W - 2, H - y0, t.base); px.rect(g, 1, y0, Math.max(2, W * .22), H - y0, t.lt); px.rect(g, 1 + W * .12, y0, Math.max(1, W * .06), H - y0, t.hi); px.rect(g, W * .66, y0, W * .34 - 1, H - y0, t.sh); px.rect(g, W * .84, y0, W * .16 - 1, H - y0, t.deep); for (let i = 0; i < 6; i++) px.dot(g, 2 + rnd() * (W - 4), y0 + 2 + rnd() * (H - y0 - 3), rnd() < .5 ? rt.base : rt.sh); for (const y of [y0 + 3, H - 4]) px.rect(g, 1, y, W - 2, 1, t.deep); px.ell(g, cx, y0, W / 2 - 1, 1.5, '#1a0c08'); flames.push([cx, y0 + 1, W * .85, H * .5]); break; }
      case 'sandbags': { const bw = 8 * s, bh = 4 * s; for (let row = 0; row < 3; row++) { const y = H - bh * (row + .5) - .5, off = row & 1 ? bw / 2 : 0; for (let x = off + bw / 2; x + bw / 2 <= W - off + .5; x += bw) { px.ell(g, x, y, bw / 2 - .3, bh / 2 + .2, t.sh); px.ell(g, x - .5, y - .5, bw / 2 - 1, bh / 2 - .5, t.base); px.rect(g, x - bw * .25, y - bh * .3, bw * .35, 1, t.lt); } } break; }
      case 'cactus': { const tw = 4 * s, aw = 3 * s, seg = (x0, y0, w, h) => { px.rect(g, x0, y0 + w / 2, w, h - w / 2, t.base); px.disc(g, x0 + w / 2, y0 + w / 2, w / 2, t.base); px.rect(g, x0, y0 + w / 2, 1, h - w / 2, t.lt); px.rect(g, x0 + w - 1, y0 + w / 2, 1, h - w / 2, t.sh); };
        seg(cx - W * .45, H * .3, aw, H * .3); px.rect(g, cx - W * .45, H * .57, W * .45, aw, t.base); px.rect(g, cx - W * .45, H * .57 + aw - 1, W * .45, 1, t.sh);
        seg(cx + W * .45 - aw, H * .18, aw, H * .3); px.rect(g, cx, H * .45, W * .45, aw, t.base); px.rect(g, cx, H * .45 + aw - 1, W * .45, 1, t.sh);
        seg(cx - tw / 2, 0, tw, H); for (let y = 3; y < H - 1; y += 3) px.dot(g, cx + ((y / 3) & 1 ? -1 : 1), y, t.hi); break; }
      case 'palm': { const tr = tones('#8a6a3a'), bend = W * .12, tx = cx + bend * .7, ty = H * .16;
        for (let y = Math.floor(ty); y < H; y++) { const u = (y - ty) / (H - ty), x = cx + bend * (1 - u) * (1 - u) - bend * .3, w2 = (1.4 + u) * s; px.rect(g, x - w2, y, w2 * 2, 1, ((y / (3 * s)) | 0) & 1 ? tr.base : tr.sh); px.dot(g, x - w2, y, tr.lt); }
        for (const [a, l] of [[-2.9, .5], [-2.4, .44], [-1.9, .3], [-1.1, .34], [-.5, .46], [.05, .5]]) { const exx = tx + Math.cos(a) * W * l, eyy = ty + Math.sin(a) * H * .1 + H * .14; for (let k = 0; k <= 9; k++) { const u = k / 9, x = lerp(tx, exx, u), y = lerp(ty, eyy, u) - Math.sin(u * Math.PI) * H * .08; px.disc(g, x, y, Math.max(.6, (2.3 - u * 1.6) * s), u < .45 ? t.base : t.sh); px.dot(g, x, y - 1, t.lt); } }
        px.disc(g, tx - 1, ty + 2 * s, 1.6 * s, tones('#5a3a1a').base); px.disc(g, tx + 1.5 * s, ty + 2.5 * s, 1.4 * s, tones('#5a3a1a').sh); break; }
      case 'mushroom': { const st = tones('#f0e4c8'); px.rect(g, cx - 2 * s, H * .45, 4 * s, H * .55, st.base); px.rect(g, cx + s, H * .45, s, H * .55, st.sh); px.ell(g, cx, H * .42, W / 2 - .3, H * .3, t.sh); px.ell(g, cx, H * .38, W / 2 - 1, H * .28, t.base); px.ell(g, cx - W * .15, H * .28, W * .18, H * .1, t.lt); for (const [dx, dy, rr] of [[-.25, .36, .1], [.2, .25, .08], [.08, .44, .07]]) px.disc(g, cx + dx * W, H * dy, rr * W, '#f8f0e0'); break; }
      case 'skull': { px.disc(g, cx, H * .42, W / 2 - .6, t.base); px.rect(g, cx - W * .3, H * .6, W * .6, H * .38, t.base); px.dot(g, cx - 1.5, H * .45, t.deep); px.dot(g, cx + 1, H * .45, t.deep); px.rect(g, cx - 1, H - 2, 1, 2, t.sh); px.rect(g, cx + 1, H - 2, 1, 2, t.sh); px.dot(g, cx - 1.5, H * .25, t.hi); break; }
    }
  });
  const frames = [toSprite(base)];
  let glow = null;
  if (flames.length && flames.some(Boolean)) {
    glow = [];
    for (let f = 0; f < 4; f++) glow.push(toSprite(make(g => { for (const fl of flames) if (fl) drawFlame(g, fl[0], fl[1], fl[2], fl[3], f * 1.6 + fl[0], '#fff6d0', o.flame || '#ffc040', o.flameOut || '#ff6a20'); })));
  }
  const GLOW_AT = { lamp: [.5, .2, '#ffe8a0'], streetlamp: [.5, .13, '#ffe8a0'], lantern: [.5, .55, t.lt], crystal: [.5, .6, color] };
  p = { glowAt: GLOW_AT[name] || null, frames, glow, w: W, h: H, emissive: name === 'lamp' || name === 'crystal' || name === 'window' || name === 'lantern' || name === 'streetlamp', light: flames.length ? (name === 'crystal' ? color : name === 'lantern' ? t.lt : name === 'streetlamp' ? '#ffe0a0' : name === 'window' ? null : '#ffb060') : null };
  _props.set(key, p);
  return p;
}
E.prop = prop;
/** the names of the built-in props for r.prop(name, x, y, z, opts) and E.prop(name, opts) */
E.PROPS = Object.keys(PROP_DEFAULTS);

/* =============================================================================
 * 21e. SHAPES  still 3D objects written as data: named parts, each a primitive with a material, drawn from any view and
 *    facing at game size (a depth buffer per shape, shaded with the material's five tones and pattern, creases where parts
 *    meet, lit top edges, the actors' outline), with a contact shadow. docs/ASSETS.md is the card: the parts, the
 *    materials, the library, how to make one and check it headless.
 *      r.shape('barrel', x, y, 0, { facing })                          // feet on (x, y, z), front toward facing
 *      E.SHAPES.stool = { about: 'a three-legged stool', mats: { w: 'oak' },
 *        parts: [['cyl','w',[0,0,8],5,1.5], ['ring',3,3,['box','w',[0,0,0],[1.5,1.5,8]]]] };
 *      map.solid('table', x, y, 0, { facing })                         // collision: bodies stop at it, land on it
 *    Units: 16 = 1 m = one tile; x east, y south, z up. A shape's origin is the middle of its footprint on the ground; it
 *    is written facing south (+y). Parts ([kind, material slot, at, ...sizes, { options }]; at is the bottom middle,
 *    except a ball's and a rock's, which is their centre):
 *      ['box', m, at, [w, d, h], { rot }]     ['cyl', m, at, r, h, { r2, seg, sq }]     ['lathe', m, at, [[r, z]...], { seg }]
 *      ['ball', m, at, r, { sz }]             ['prism', m, at, [[a, b]...], h, { axis: 'z' | 'y' | 'x' }]
 *      ['wedge', m, at, [w, d, h]]            ['rock', m, at, r, { sz, seed, rough }]
 *      ['use', id, at, { rot, scale, mats, ...params }]   ['mirror', 'x' | 'y' | 'xy', part]   ['ring', n, radius, part]
 *      ['row', n, [dx, dy, dz], part]          ['group', at, rot, [parts]]
 *    rot: a yaw in degrees, or [x, y, z] degrees. Nothing below the floor is drawn (a half-sunk rock).
 * ============================================================================= */
/** the shapes by id: { about, tags, mats: { slot: material }, parts | make(params), params, foot, lights, flames } (the
 *  core library's, the sets' as 'SET:id' from E.addAssets, and your own: E.SHAPES.stool = {...}) */
const SHAPES = E.SHAPES = {};
const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const mm3 = (A, B) => [
  A[0] * B[0] + A[1] * B[3] + A[2] * B[6], A[0] * B[1] + A[1] * B[4] + A[2] * B[7], A[0] * B[2] + A[1] * B[5] + A[2] * B[8],
  A[3] * B[0] + A[4] * B[3] + A[5] * B[6], A[3] * B[1] + A[4] * B[4] + A[5] * B[7], A[3] * B[2] + A[4] * B[5] + A[5] * B[8],
  A[6] * B[0] + A[7] * B[3] + A[8] * B[6], A[6] * B[1] + A[7] * B[4] + A[8] * B[7], A[6] * B[2] + A[7] * B[5] + A[8] * B[8]];
const mv3 = (A, v) => [A[0] * v[0] + A[1] * v[1] + A[2] * v[2], A[3] * v[0] + A[4] * v[1] + A[5] * v[2], A[6] * v[0] + A[7] * v[1] + A[8] * v[2]];
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const crs3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const nrm3 = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const rz3 = a => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
const rx3 = a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
const ry3 = a => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const rot3 = r => typeof r === 'number' ? rz3(r * DEG) : !Array.isArray(r) ? I3 : mm3(rz3((r[2] || 0) * DEG), mm3(ry3((r[1] || 0) * DEG), rx3((r[0] || 0) * DEG)));
const dg3 = (x, y, z) => [x, 0, 0, 0, y, 0, 0, 0, z];
function invT3(M) {   // the inverse transpose (normals), sign kept so a mirrored part's normals still point out
  const [a, b, c, d, e, f, g, h, i] = M, A = e * i - f * h, B = f * g - d * i, C = d * h - e * g, det = a * A + b * B + c * C || 1e-9;
  return [A / det, B / det, C / det, (c * h - b * i) / det, (a * i - c * g) / det, (b * g - a * h) / det, (b * f - c * e) / det, (c * d - a * f) / det, (a * e - b * d) / det];
}
/** a shape entry from an id ('barrel', 'SET:chair', a set's own id when local is that set's shapes) or an entry */
function shapeOf(id, local) {
  if (id && typeof id === 'object') return id;
  const S = (local && local[id]) || SHAPES[id];
  if (!S) warn('shape:' + id, 'unknown shape "' + id + '". Shapes: ' + Object.keys(SHAPES).join(', ') + ' (or your own E.SHAPES entry)');
  return S || null;
}
/** a placement's size: the entry's own scale times the placement's */
const scaleOf = (S, o) => (o && o.scale || 1) * (S && S.scale || 1);
const SHAPE_PARTS = { box: 4, cyl: 5, lathe: 4, ball: 4, prism: 5, wedge: 4, rock: 4 };   // where each primitive's options are
/** a shape with its placement's params and mats -> { prims, mats, parts } (every part as a primitive with its transform) */
function resolveShape(S, o = {}, name) {
  const out = { prims: [], mats: [], mq: [], idx: new Map(), parts: 0 };
  if (S) addShape(S, o, I3, [0, 0, 0], k => o.mats && o.mats[k], out, 0, name);
  return out;
}
/** the problems with one part's own fields (not its children's): [] when it can be drawn */
function partBad(p) {
  const num = v => typeof v === 'number' && isFinite(v), vec = (v, n) => Array.isArray(v) && v.length === n && v.every(num), pairs = (v, n) => Array.isArray(v) && v.length >= n && v.every(q => vec(q, 2));
  if (!Array.isArray(p)) return ['is a part: [kind, ...]'];
  const k = p[0], out = [], rot = o => { if (o && o.rot !== undefined && !num(o.rot) && !vec(o.rot, 3)) out.push('its rot is degrees about z, or [x, y, z] degrees'); };
  if (k === 'mirror') { if (!['x', 'y', 'xy'].includes(p[1])) out.push("its axis is 'x', 'y' or 'xy'"); if (!Array.isArray(p[2])) out.push('its part is [kind, ...]'); return out; }
  if (k === 'ring' || k === 'row') { if (!(p[1] >= 1)) out.push('its count is a whole number, 1 or more'); if (k === 'ring' ? !num(p[2]) : !vec(p[2], 3)) out.push(k === 'ring' ? 'its radius is a number' : 'its step is [dx, dy, dz]'); if (!Array.isArray(p[3])) out.push('its part is [kind, ...]'); return out; }
  if (k === 'group') { if (!vec(p[1], 3)) out.push('its at is [x, y, z]'); if (p[2] !== undefined && !num(p[2]) && !vec(p[2], 3)) out.push('its rot is degrees about z, or [x, y, z] degrees'); if (!Array.isArray(p[3])) out.push('its parts are a list'); return out; }
  if (k === 'use') { if (typeof p[1] !== 'string' && !(p[1] && typeof p[1] === 'object')) out.push('it names a shape'); if (!vec(p[2], 3)) out.push('its at is [x, y, z]'); rot(p[3]); return out; }
  if (!SHAPE_PARTS[k]) return ['unknown part "' + k + '" (parts: ' + Object.keys(SHAPE_PARTS).join(', ') + ', use, mirror, ring, row, group)'];
  if (typeof p[1] !== 'string') out.push('its material is a slot name or a material');
  if (!vec(p[2], 3)) out.push('its at is [x, y, z]');
  const sz = { box: () => vec(p[3], 3) || 'its size is [w, d, h]', wedge: () => vec(p[3], 3) || 'its size is [w, d, h]', cyl: () => (num(p[3]) && num(p[4])) || 'its radius and height are numbers',
    lathe: () => pairs(p[3], 2) || 'its profile is [[r, z], ...], two points or more', ball: () => num(p[3]) || 'its radius is a number', rock: () => num(p[3]) || 'its radius is a number',
    prism: () => (pairs(p[3], 3) && num(p[4])) || 'its outline is [[a, b], ...], three points or more, then its depth' }[k]();
  if (sz !== true) out.push(sz);
  rot(p[SHAPE_PARTS[k]]);
  return out;
}
/** the problems with a shape's parts, each naming the entry and the field: ['stool: parts[1] (box): its size is [w, d, h]'] */
function checkParts(name, parts, where = 'parts') {
  const out = [];
  if (!Array.isArray(parts)) return [name + ': ' + where + ' is a list of parts'];
  parts.forEach((p, i) => {
    const at = where + '[' + i + ']', k = Array.isArray(p) ? p[0] : null, bad = partBad(p);
    if (!Array.isArray(p)) { out.push(name + ': ' + at + ' is a part: [kind, ...]'); return; }
    out.push(...bad.map(b => name + ': ' + at + (SHAPE_PARTS[k] || ['mirror', 'ring', 'row', 'group', 'use'].includes(k) ? ' (' + k + ')' : '') + ': ' + b));
    if (k === 'mirror' && Array.isArray(p[2])) out.push(...checkParts(name, [p[2]], at + '[2]'));
    if ((k === 'ring' || k === 'row') && Array.isArray(p[3])) out.push(...checkParts(name, [p[3]], at + '[3]'));
    if (k === 'group' && Array.isArray(p[3])) out.push(...checkParts(name, p[3], at + '[3]'));
  });
  return out;
}
const _checked = new WeakSet();
function addShape(S, params, M, t, outer, out, depth, name = S.about || 'a shape') {
  if (depth > 8) { warn('shape:deep', 'shapes nested more than 8 deep (a shape that uses itself?)'); return; }
  const P = Object.assign({}, S.params, params), made = S.make ? S.make(P) : S.parts, parts = Array.isArray(made) ? made : [], set = S._set;
  if (!_checked.has(S)) { _checked.add(S); const bad = checkParts(name, made === undefined && !S.make ? [] : made); if (!S.parts && !S.make) bad.unshift(name + ': an entry has parts, or make(params)'); for (const b of bad) warn('check:' + b, 'shape ' + b); }
  // a slot: the placement's (or the using shape's) choice, then the shape's own mats, then the name as a material
  const slot = name => outer(name) || (S.mats && S.mats[name]) || name;
  const mi = name => { const id = slot(name), key = (set && set.materials && set.materials[id] ? set.set + ':' : '') + (typeof id === 'string' ? id : JSON.stringify(id));
    let i = out.idx.get(key); if (i === undefined) { const m = material(id, set && set.materials, 'material'); i = out.mats.length; out.mats.push(m || material('#ff00ff')); out.mq.push([id, set && set.materials, m]); out.idx.set(key, i); } return i; };
  const part = (p, M, t) => {
    if (partBad(p).length) return;   // (warned once, by checkParts)
    const k = p[0];
    if (k === 'mirror') {
      const ax = p[1], q = p[2]; part(q, M, t);
      if (ax.includes('x')) part(q, mm3(M, dg3(-1, 1, 1)), t);
      if (ax.includes('y')) part(q, mm3(M, dg3(1, -1, 1)), t);
      if (ax.includes('x') && ax.includes('y')) part(q, mm3(M, dg3(-1, -1, 1)), t);
      return;
    }
    if (k === 'ring') { for (let i = 0; i < p[1]; i++) { const Mi = mm3(M, rz3(i * TAU / p[1])); part(p[3], Mi, add3(t, mv3(Mi, [p[2], 0, 0]))); } return; }
    if (k === 'row') { const n = p[1], d = p[2]; for (let i = 0; i < n; i++) { const f = i - (n - 1) / 2; part(p[3], M, add3(t, mv3(M, [d[0] * f, d[1] * f, d[2] * f]))); } return; }
    if (k === 'group') { const M2 = mm3(M, rot3(p[2])), t2 = add3(t, mv3(M, p[1])); for (const q of p[3]) part(q, M2, t2); return; }
    if (k === 'use') {
      const S2 = shapeOf(p[1], set && set.shapes), uo = p[3] || {}; if (!S2) return;
      const sc = (uo.scale || 1) * (S2.scale || 1), M2 = mm3(mm3(M, rot3(uo.rot)), dg3(sc, sc, sc)), t2 = add3(t, mv3(M, p[2]));
      const params = Object.assign({}, uo); delete params.rot; delete params.scale; delete params.mats;
      // the used shape's slots: this part's mats (a material, or one of this shape's slots), else its own
      addShape(S2, params, M2, t2, k2 => { const v = uo.mats && uo.mats[k2]; return v ? slot(v) : null; }, out, depth + 1, typeof p[1] === 'string' ? p[1] : undefined);
      return;
    }
    if (!SHAPE_PARTS[k]) { warn('part:' + k, 'unknown part "' + k + '". Parts: ' + Object.keys(SHAPE_PARTS).join(', ') + ', use, mirror, ring, row, group'); return; }
    const o = p[SHAPE_PARTS[k]] || {};
    out.prims.push({ k, p, o, mi: mi(p[1]), part: out.parts++, M: mm3(M, rot3(o.rot)), t: add3(t, mv3(M, p[2] || [0, 0, 0])) });
  };
  for (const p of parts) part(p, M, t);
}

/* ---- tessellation: faces with surface coordinates (u, v world units: round or across a side and up it; x and y on a
 *      lid), in a primitive's own frame. emit({ v: [[x, y, z]...], n: normal | [normals], uv, W, H, lid, curved }) ---- */
function planarUV(v, n) {
  let us, vs;
  if (Math.abs(n[2]) > .7) { us = v.map(p => p[0]); vs = v.map(p => p[1]); }
  else { const l = Math.hypot(n[0], n[1]) || 1, tx = -n[1] / l, ty = n[0] / l; us = v.map(p => p[0] * tx + p[1] * ty); vs = v.map(p => p[2]); }
  const u0 = Math.min(...us), v0 = Math.min(...vs);
  return { uv: us.map((u, i) => [u - u0, vs[i] - v0]), W: Math.max(...us) - u0, H: Math.max(...vs) - v0, lid: Math.abs(n[2]) > .7 };
}
/** a flat face; frame: the vertices whose planar coordinates it shares (a cap cut into triangles keeps one frame) */
function flatFace(emit, v, n, frame) { const P = planarUV(frame ? frame.concat(v) : v, n), k = frame ? frame.length : 0; emit({ v, n, uv: P.uv.slice(k), W: P.W, H: P.H, lid: P.lid, curved: false }); }
/** a profile [[r, z]...] turned about z in n segments: steps across become flat lids (planks run straight across a barrel's
 *  top), the rest smooth bands whose normals are shared where neighbours meet at under 40 degrees */
function latheFaces(emit, pr, n, sq = 1, ball = false, sz = 1) {
  let R = 0; for (const q of pr) R = Math.max(R, q[0]);
  const cs = [], sn = []; for (let i = 0; i <= n; i++) { cs.push(Math.cos(i / n * TAU)); sn.push(Math.sin(i / n * TAU)); }
  const segN = [], len = [0];
  for (let j = 0; j + 1 < pr.length; j++) { const dr = pr[j + 1][0] - pr[j][0], dz = pr[j + 1][1] - pr[j][1], l = Math.hypot(dr, dz) || 1; segN.push([dz / l, -dr / l]); len.push(len[j] + l); }
  const vn = (j, end) => {
    if (ball) { const q = pr[j + end]; const l = Math.hypot(q[0], q[1] / (sz * sz)) || 1; return [q[0] / l, q[1] / (sz * sz) / l]; }
    const a = segN[j], b = segN[end ? j + 1 : j - 1];
    if (!b || a[0] * b[0] + a[1] * b[1] < .77) return a;
    const l = Math.hypot(a[0] + b[0], a[1] + b[1]) || 1; return [(a[0] + b[0]) / l, (a[1] + b[1]) / l];
  };
  for (let j = 0; j + 1 < pr.length; j++) {
    const [r0, z0] = pr[j], [r1, z1] = pr[j + 1]; if (r0 < 1e-6 && r1 < 1e-6) continue;
    if (Math.abs(z1 - z0) < 1e-6 && !ball) {   // a flat ring or disc
      const up = r1 < r0 ? 1 : -1, rA = Math.max(r0, r1), rB = Math.min(r0, r1);
      for (let i = 0; i < n; i++) {
        const a = [cs[i] * rA, sn[i] * rA * sq, z0], b = [cs[i + 1] * rA, sn[i + 1] * rA * sq, z0];
        const v = rB > 1e-6 ? [a, b, [cs[i + 1] * rB, sn[i + 1] * rB * sq, z0], [cs[i] * rB, sn[i] * rB * sq, z0]] : [a, b, [0, 0, z0]], vv = up > 0 ? v : v.slice().reverse();
        emit({ v: vv, n: [0, 0, up], uv: vv.map(p => [p[0] + R, p[1] + R]), W: 2 * R, H: 2 * R, lid: true, curved: false });
      }
      continue;
    }
    const nA = vn(j, 0), nB = vn(j, 1), P = (r, z, k) => [cs[k] * r, sn[k] * r * sq, z], N = (q, k) => [cs[k] * q[0], sn[k] * q[0] / sq, q[1]];
    for (let i = 0; i < n; i++) emit({ v: [P(r0, z0, i), P(r0, z0, i + 1), P(r1, z1, i + 1), P(r1, z1, i)], n: [N(nA, i), N(nA, i + 1), N(nB, i + 1), N(nB, i)],
      uv: [[i / n * TAU * R, len[j]], [(i + 1) / n * TAU * R, len[j]], [(i + 1) / n * TAU * R, len[j + 1]], [i / n * TAU * R, len[j + 1]]], W: TAU * R, H: len[len.length - 1], lid: false, curved: true });
  }
}
let _ico = null;
function icosphere() {
  if (_ico) return _ico;
  const t = (1 + Math.sqrt(5)) / 2, v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(nrm3);
  let f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  const mid = new Map(), m = (a, b) => { const k = a < b ? a + ',' + b : b + ',' + a; if (!mid.has(k)) { mid.set(k, v.length); v.push(nrm3(add3(v[a], v[b]))); } return mid.get(k); };
  f = f.flatMap(([a, b, c]) => { const ab = m(a, b), bc = m(b, c), ca = m(c, a); return [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]]; });
  return (_ico = { v, f });
}
/** ear clipping for a counter-clockwise outline: [[i, j, k]...] */
function earClip(pts) {
  const idx = pts.map((_, i) => i), out = [], cr = (a, b, c) => (pts[b][0] - pts[a][0]) * (pts[c][1] - pts[a][1]) - (pts[b][1] - pts[a][1]) * (pts[c][0] - pts[a][0]);
  const inside = (p, a, b, c) => cr(a, b, p) >= 0 && cr(b, c, p) >= 0 && cr(c, a, p) >= 0;
  for (let guard = 0; idx.length > 3 && guard < 500; guard++) {
    let cut = false;
    for (let i = 0; i < idx.length; i++) {
      const a = idx[(i + idx.length - 1) % idx.length], b = idx[i], c = idx[(i + 1) % idx.length];
      if (cr(a, b, c) <= 1e-9 || idx.some(p => p !== a && p !== b && p !== c && inside(p, a, b, c))) continue;
      out.push([a, b, c]); idx.splice(i, 1); cut = true; break;
    }
    if (!cut) break;
  }
  for (let i = 1; i + 1 < idx.length; i++) out.push([idx[0], idx[i], idx[i + 1]]);
  return out;
}
const AXIS3 = { z: I3, y: [1, 0, 0, 0, 0, 1, 0, 1, 0], x: [0, 0, 1, 1, 0, 0, 0, 1, 0] };
const TESS = {
  box(emit, P) {
    const [w, d, h] = P.p[3], x = w / 2, y = d / 2, c = (i, j, k) => [i ? x : -x, j ? y : -y, k ? h : 0];
    emit({ v: [c(0, 0, 1), c(1, 0, 1), c(1, 1, 1), c(0, 1, 1)], n: [0, 0, 1], uv: [[0, 0], [w, 0], [w, d], [0, d]], W: w, H: d, lid: true });
    emit({ v: [c(0, 0, 0), c(0, 1, 0), c(1, 1, 0), c(1, 0, 0)], n: [0, 0, -1], uv: [[0, 0], [0, d], [w, d], [w, 0]], W: w, H: d, lid: true });
    emit({ v: [c(0, 1, 0), c(1, 1, 0), c(1, 1, 1), c(0, 1, 1)], n: [0, 1, 0], uv: [[0, 0], [w, 0], [w, h], [0, h]], W: w, H: h });
    emit({ v: [c(1, 0, 0), c(0, 0, 0), c(0, 0, 1), c(1, 0, 1)], n: [0, -1, 0], uv: [[0, 0], [w, 0], [w, h], [0, h]], W: w, H: h });
    emit({ v: [c(1, 1, 0), c(1, 0, 0), c(1, 0, 1), c(1, 1, 1)], n: [1, 0, 0], uv: [[0, 0], [d, 0], [d, h], [0, h]], W: d, H: h });
    emit({ v: [c(0, 0, 0), c(0, 1, 0), c(0, 1, 1), c(0, 0, 1)], n: [-1, 0, 0], uv: [[0, 0], [d, 0], [d, h], [0, h]], W: d, H: h });
  },
  wedge(emit, P) {   // h tall at the back (-y), down to the floor at the front (+y): a ramp facing the front
    const [w, d, h] = P.p[3], x = w / 2, y = d / 2;
    flatFace(emit, [[-x, y, 0], [-x, -y, 0], [x, -y, 0], [x, y, 0]], [0, 0, -1]);
    flatFace(emit, [[x, -y, 0], [-x, -y, 0], [-x, -y, h], [x, -y, h]], [0, -1, 0]);
    flatFace(emit, [[-x, y, 0], [x, y, 0], [x, -y, h], [-x, -y, h]], nrm3([0, h, d]));
    flatFace(emit, [[x, y, 0], [x, -y, 0], [x, -y, h]], [1, 0, 0]);
    flatFace(emit, [[-x, -y, 0], [-x, y, 0], [-x, -y, h]], [-1, 0, 0]);
  },
  cyl(emit, P, seg) { const r = P.p[3], h = P.p[4], r2 = P.o.r2 === undefined ? r : P.o.r2; latheFaces(emit, r2 > 0 ? [[0, 0], [r, 0], [r2, h], [0, h]] : [[0, 0], [r, 0], [0, h]], P.o.seg || seg(Math.max(r, r2)), P.o.sq || 1); },
  lathe(emit, P, seg) { const pr = P.p[3]; latheFaces(emit, pr, P.o.seg || seg(Math.max(...pr.map(q => q[0]))), P.o.sq || 1); },
  ball(emit, P, seg) {   // (fewer segments than a turned profile: the shading hides the facets, and leaf clumps come by the dozen)
    const r = P.p[3], sz = P.o.sz || 1, n = P.o.seg || Math.max(8, Math.min(20, Math.round(seg(r) * .6 / 2) * 2)), m = Math.max(3, n >> 1), pts = [];
    for (let j = 0; j <= m; j++) { const a = -Math.PI / 2 + j / m * Math.PI; pts.push([j && j < m ? Math.cos(a) * r : 0, Math.sin(a) * r * sz]); }
    latheFaces(emit, pts, n, 1, true, sz);
  },
  rock(emit, P) {   // an icosahedron split once, its corners pushed in and out by the seed, faceted
    const r = P.p[3], sz = P.o.sz || .75, rough = P.o.rough === undefined ? .28 : P.o.rough, rnd = rng(((P.o.seed || 0) + 1) * 7919 + P.part * 131);
    const { v, f } = icosphere(), k = v.map(() => 1 - rough / 2 + rnd() * rough), at = i => [v[i][0] * r * k[i], v[i][1] * r * k[i], v[i][2] * r * k[i] * sz];
    for (const [a, b, c] of f) { const A = at(a), B = at(b), C = at(c); flatFace(emit, [A, B, C], nrm3(crs3(sub3(B, A), sub3(C, A)))); }
  },
  prism(emit, P) {   // an outline pushed h along z (up from at), y or x (centred on at)
    const ol = P.p[3], h = P.p[4], ax = P.o.axis || 'z', A = AXIS3[ax] || I3;
    const to = ax === 'z' ? (a, b, c) => [a, b, c] : ax === 'y' ? (a, b, c) => [a, c - h / 2, b] : (a, b, c) => [c - h / 2, a, b];
    let area = 0; for (let i = 0; i < ol.length; i++) { const a = ol[i], b = ol[(i + 1) % ol.length]; area += a[0] * b[1] - b[0] * a[1]; }
    const pts = area < 0 ? ol.slice().reverse() : ol, capT = pts.map(q => to(q[0], q[1], h)), capB = pts.map(q => to(q[0], q[1], 0)), nT = mv3(A, [0, 0, 1]), nB = mv3(A, [0, 0, -1]);
    for (const tr of earClip(pts)) { flatFace(emit, tr.map(i => capT[i]), nT, capT); flatFace(emit, tr.map(i => capB[i]).reverse(), nB, capB); }
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], ex = b[0] - a[0], ey = b[1] - a[1], l = Math.hypot(ex, ey) || 1;
      flatFace(emit, [to(a[0], a[1], 0), to(b[0], b[1], 0), to(b[0], b[1], h), to(a[0], a[1], h)], nrm3(mv3(A, [ey / l, -ex / l, 0])));
    }
  }
};

/* ---- the raster: every face into a depth buffer at game size (whole pixels, nearer wins), shaded afterwards ---- */
const SHAPE_BANDS = [-.38, .3, .7];   // the light above each picks sh, base, lt (deep below the first)
let _tri = new Float64Array(28 * 512);   // the triangles of the shape being drawn (grown as needed, reused)
/** the light's direction for a view: from the viewer's upper left, so a shape's top and left face are lit in every view */
function shapeLight(view) {
  const w = view.yaw, p = view.pitch, cw = Math.cos(w), sw = Math.sin(w), cp = Math.cos(p), sp = Math.sin(p);
  return nrm3([-.45 * cw - .45 * sp * sw + .77 * sw * cp, .45 * sw - .45 * sp * cw + .77 * cw * cp, .45 * cp + .77 * sp]);
}
/** draw a shape at game size: { w, h, ox, oy (its origin's pixel), rgba, tris, prims, part (per pixel, -1 empty) } */
function rasterShape(S, view, o = {}) {
  const R = resolveShape(S, Object.assign({}, o.params, { mats: o.mats }), o.name), facing = o.facing === undefined ? Math.PI / 2 : o.facing, k = scaleOf(S, o), a = facing - Math.PI / 2;
  const F = mm3(rz3(a), dg3(o.flip ? -k : k, k, k)), D = [view.dx, view.dy, view.dz], L = shapeLight(view), vs = Math.hypot(view.ax, view.ay) || 1, pxu = 1 / (vs * k);
  const faces = [], P9 = new Float64Array(9 * 64); let T = _tri, tn = 0;
  for (const P of R.prims) {
    const Mw = mm3(F, P.M), N = invT3(Mw), tw = mv3(F, P.t), sMax = Math.max(Math.hypot(Mw[0], Mw[3], Mw[6]), Math.hypot(Mw[1], Mw[4], Mw[7]));
    const seg = r => Math.max(6, Math.min(48, Math.round(TAU * r * sMax * vs / 3 / 2) * 2));   // a segment every 3 pixels or so
    TESS[P.k](f => {
      const fi = faces.length, smooth = Array.isArray(f.n[0]), nv = Math.min(64, f.v.length);
      faces.push({ mi: P.mi, part: P.part, W: f.W, H: f.H, lid: !!f.lid, curved: !!f.curved });
      let fx = 0, fy = 0, fz = 0;
      if (!smooth) { const q = f.n; fx = N[0] * q[0] + N[1] * q[1] + N[2] * q[2]; fy = N[3] * q[0] + N[4] * q[1] + N[5] * q[2]; fz = N[6] * q[0] + N[7] * q[1] + N[8] * q[2]; const l = Math.sqrt(fx * fx + fy * fy + fz * fz) || 1; fx /= l; fy /= l; fz /= l; }
      for (let i = 0; i < nv; i++) {
        const p = f.v[i], wx = Mw[0] * p[0] + Mw[1] * p[1] + Mw[2] * p[2] + tw[0], wy = Mw[3] * p[0] + Mw[4] * p[1] + Mw[5] * p[2] + tw[1], wz = Mw[6] * p[0] + Mw[7] * p[1] + Mw[8] * p[2] + tw[2], o9 = i * 9;
        P9[o9] = view.ax * wx + view.ay * wy; P9[o9 + 1] = view.bx * wx + view.by * wy + view.bz * wz; P9[o9 + 2] = D[0] * wx + D[1] * wy + D[2] * wz; P9[o9 + 3] = wz;
        if (smooth) { const q = f.n[i], a1 = N[0] * q[0] + N[1] * q[1] + N[2] * q[2], b1 = N[3] * q[0] + N[4] * q[1] + N[5] * q[2], c1 = N[6] * q[0] + N[7] * q[1] + N[8] * q[2], l = Math.sqrt(a1 * a1 + b1 * b1 + c1 * c1) || 1; P9[o9 + 4] = a1 / l; P9[o9 + 5] = b1 / l; P9[o9 + 6] = c1 / l; }
        else { P9[o9 + 4] = fx; P9[o9 + 5] = fy; P9[o9 + 6] = fz; }
        P9[o9 + 7] = f.uv[i][0]; P9[o9 + 8] = f.uv[i][1];
      }
      for (let i = 1; i + 1 < nv; i++) {   // a fan: [face (negative: seen from behind, the inside of an open part), A, B, C]
        if (tn + 28 > T.length) { const T2 = new Float64Array(T.length * 2); T2.set(T); T = _tri = T2; }
        const back = (P9[4] + P9[i * 9 + 4] + P9[i * 9 + 13]) * D[0] + (P9[5] + P9[i * 9 + 5] + P9[i * 9 + 14]) * D[1] + (P9[6] + P9[i * 9 + 6] + P9[i * 9 + 15]) * D[2] < 0;
        T[tn] = back ? -1 - fi : fi;
        for (let j = 0; j < 9; j++) { T[tn + 1 + j] = P9[j]; T[tn + 10 + j] = P9[i * 9 + j]; T[tn + 19 + j] = P9[i * 9 + 9 + j]; }
        tn += 28;
      }
    }, P, seg);
  }
  let x0 = 0, y0 = 0, x1 = 0, y1 = 0;
  const grow = (qx, qy) => { if (qx < x0) x0 = qx; if (qx > x1) x1 = qx; if (qy < y0) y0 = qy; if (qy > y1) y1 = qy; };
  for (let i = 0; i < tn; i += 28) for (let j = 1; j < 28; j += 9) {   // the corners above the floor, and where edges cross it
    const ga = T[i + j + 3]; if (ga >= -.01) grow(T[i + j], T[i + j + 1]);
    const q = i + (j === 19 ? 1 : j + 9), gb = T[q + 3]; if ((ga < -.01) !== (gb < -.01)) { const t = (-.01 - ga) / (gb - ga); grow(T[i + j] + (T[q] - T[i + j]) * t, T[i + j + 1] + (T[q + 1] - T[i + j + 1]) * t); }
  }
  const ox = 2 - Math.floor(x0), oy = 2 - Math.floor(y0), W = Math.ceil(x1) + ox + 3, H = Math.ceil(y1) + oy + 3, n = W * H;
  const zb = new Float32Array(n).fill(-Infinity), fid = new Int32Array(n).fill(-1), bk = new Uint8Array(n), Nx = new Float32Array(n), Ny = new Float32Array(n), Nz = new Float32Array(n), U = new Float32Array(n), Vv = new Float32Array(n), G = new Float32Array(n);
  let tris = 0;
  for (let i = 0; i < tn; i += 28) {
    const fb = T[i], fi = fb < 0 ? -1 - fb : fb, A = i + 1, B = i + 10, C = i + 19, ax = T[A] + ox, ay = T[A + 1] + oy, bx = T[B] + ox, by = T[B + 1] + oy, cx = T[C] + ox, cy = T[C + 1] + oy;
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax); if (area * area < 1e-12) continue;
    tris++;
    // the weights of A and B as planes over the screen (C's is 1 - both)
    const ia = 1 / area, a0 = -(cy - by) * ia, b0 = (cx - bx) * ia, c0 = ((cy - by) * bx - (cx - bx) * by) * ia, a1 = -(ay - cy) * ia, b1 = (ax - cx) * ia, c1 = ((ay - cy) * cx - (ax - cx) * cy) * ia;
    const za = T[A + 2], zbb = T[B + 2], zc = T[C + 2], ga = T[A + 3], gb = T[B + 3], gc = T[C + 3];
    const mx = Math.max(0, Math.floor(Math.min(ax, bx, cx))), Mx = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx))), my = Math.max(0, Math.floor(Math.min(ay, by, cy))), My = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
    for (let y = my; y <= My; y++) {
      const qy = y + .5; let l0 = a0 * (mx + .5) + b0 * qy + c0, l1 = a1 * (mx + .5) + b1 * qy + c1;
      for (let x = mx; x <= Mx; x++, l0 += a0, l1 += a1) {
        const l2 = 1 - l0 - l1; if (l0 < -1e-7 || l1 < -1e-7 || l2 < -1e-7) continue;
        const z = l0 * za + l1 * zbb + l2 * zc, j = y * W + x, gz = l0 * ga + l1 * gb + l2 * gc;
        if (z <= zb[j] + 1e-5 || gz < -.01) continue;   // (nearer wins; below the floor is not drawn)
        zb[j] = z; fid[j] = fi; bk[j] = fb < 0 ? 1 : 0; G[j] = gz;
        Nx[j] = l0 * T[A + 4] + l1 * T[B + 4] + l2 * T[C + 4]; Ny[j] = l0 * T[A + 5] + l1 * T[B + 5] + l2 * T[C + 5]; Nz[j] = l0 * T[A + 6] + l1 * T[B + 6] + l2 * T[C + 6];
        U[j] = l0 * T[A + 7] + l1 * T[B + 7] + l2 * T[C + 7]; Vv[j] = l0 * T[A + 8] + l1 * T[B + 8] + l2 * T[C + 8];
      }
    }
  }
  // shade: the light's band, the pattern's step, a step darker on an inside
  const tone = new Int8Array(n).fill(-1), part = new Int32Array(n).fill(-1), ov = new Uint8Array(n), Sx = { u: 0, v: 0, W: 0, H: 0, lid: false, curved: false, lit: 0, px: pxu, part: 0, nz: 0, z: 0 };
  for (let j = 0; j < n; j++) {
    const fi = fid[j]; if (fi < 0) continue;
    const f = faces[fi], m = R.mats[f.mi];
    let nx = Nx[j], ny = Ny[j], nz = Nz[j]; const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; nx /= l; ny /= l; nz /= l;
    let inner = 0; if (bk[j]) { nx = -nx; ny = -ny; nz = -nz; inner = 1; }
    const lit = nx * L[0] + ny * L[1] + nz * L[2]; Nz[j] = nz; part[j] = f.part;
    Sx.u = U[j]; Sx.v = Vv[j]; Sx.W = f.W; Sx.H = f.H; Sx.lid = f.lid; Sx.curved = f.curved; Sx.lit = lit; Sx.part = f.part;
    tone[j] = clamp((m.glow ? 3 : lit > SHAPE_BANDS[2] ? 3 : lit > SHAPE_BANDS[1] ? 2 : lit > SHAPE_BANDS[0] ? 1 : 0) + m.pat(Sx, m.q) - inner, 0, 4);
    if (m.over) { Sx.nz = nz; Sx.z = G[j]; ov[j] = overAt(m, Sx); }
  }
  // creases: a pixel just behind a nearer part darkens a step; lit edges: the top silhouette of a face looking up brightens
  const out = new Int8Array(tone), near = (j, q) => part[q] >= 0 && part[q] !== part[j] && zb[q] > zb[j] + 1.2;
  for (let y = 1; y < H - 1; y++) for (let x = 1, j = y * W + 1; x < W - 1; x++, j++) if (part[j] >= 0 && (near(j, j - 1) || near(j, j + 1) || near(j, j - W) || near(j, j + W))) out[j] = Math.max(0, tone[j] - 1);
  for (let j = W; j < n; j++) if (tone[j] >= 0 && Nz[j] >= .5 && (tone[j - W] < 0 || zb[j - W] < zb[j] - 2.5)) out[j] = Math.min(4, out[j] + 1);
  const rgba = new Uint8ClampedArray(n * 4), glow = R.mats.some(m => m.glow) ? new Uint8Array(n) : null;   // (glow: the pixels of glowing materials)
  for (let j = 0; j < n; j++) { if (out[j] < 0) continue; const m = R.mats[faces[fid[j]].mi], c = m.ramp[out[j] + 5 * ov[j]]; rgba[j * 4] = c[0]; rgba[j * 4 + 1] = c[1]; rgba[j * 4 + 2] = c[2]; rgba[j * 4 + 3] = 255; if (glow && m.glow) glow[j] = 1; }
  return { w: W, h: H, ox, oy, rgba, tris, prims: R.prims.length, part, mq: R.mq, glow };
}
/** a raster as a canvas, with the actors' 1-px outline round it in a color ('#140c1c', the renderer's) or none */
function rasterCanvas(r, outline) {
  const W = r.w, H = r.h, cv = mkCanvas(W, H), g = cv.getContext('2d'), img = g.createImageData(W, H), a = img.data, oc = outline && hex(outline); a.set(r.rgba);
  if (oc) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (r.rgba[i * 4 + 3]) continue;
    if ((x > 0 && r.rgba[(i - 1) * 4 + 3]) || (x < W - 1 && r.rgba[(i + 1) * 4 + 3]) || (y > 0 && r.rgba[(i - W) * 4 + 3]) || (y < H - 1 && r.rgba[(i + W) * 4 + 3])) { a[i * 4] = oc[0]; a[i * 4 + 1] = oc[1]; a[i * 4 + 2] = oc[2]; a[i * 4 + 3] = 255; }
  }
  g.putImageData(img, 0, 0); return cv;
}
/** a raster's opaque pixels (or those keep(j) picks) as runs [x, y, n] (the lighting pass fills them with its own colors) */
function rasterRuns(r, keep) {
  const out = [], W = r.w, A = r.rgba, on = j => A[j * 4 + 3] && (!keep || keep(j));
  for (let y = 0; y < r.h; y++) for (let x = 0; x < W;) { if (!on(y * W + x)) { x++; continue; } let n = 1; while (x + n < W && on(y * W + x + n)) n++; out.push(x, y, n); x += n; }
  return out;
}
/** a raster's glowing pixels alone, as a canvas and runs (drawn again after the lighting, so the dark never dims them) */
function rasterGlow(r) {
  const cv = mkCanvas(r.w, r.h), g = cv.getContext('2d'), img = g.createImageData(r.w, r.h);
  for (let j = 0; j < r.w * r.h; j++) if (r.glow[j]) for (let k = 0; k < 4; k++) img.data[j * 4 + k] = r.rgba[j * 4 + k];
  g.putImageData(img, 0, 0); return { cv, runs: rasterRuns(r, j => r.glow[j]) };
}
const _geomOf = new WeakMap();
/** a shape's resolved size in its own frame: the bounds [x0, y0, z0, x1, y1, z1], and its footprint and contact
 *  polygons for the shadow (ground points of every part, and of the parts that touch the floor) */
function shapeGeom(S, o = {}) {
  const key = o.params ? JSON.stringify(o.params) : '';   // (materials never move a part)
  let c = _geomOf.get(S); if (!c) _geomOf.set(S, c = new Map()); let G = c.get(key);   // (kept beside the entry, never on it)
  if (G) { c.delete(key); c.set(key, G); return G; }   // (most recently used last)
  const R = resolveShape(S, Object.assign({}, o.params)), b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9], all = [], contact = [];
  for (const P of R.prims) {
    const pts = []; TESS[P.k](f => { for (const p of f.v) pts.push(add3(mv3(P.M, p), P.t)); }, P, () => 12);
    for (const w of pts) { for (let i = 0; i < 3; i++) { b[i] = Math.min(b[i], w[i]); b[i + 3] = Math.max(b[i + 3], w[i]); } all.push([w[0], w[1]]); }
    const low = pts.filter(w => w[2] < .8 && w[2] > -1e9).map(w => [w[0], w[1]]); if (low.length >= 3) contact.push(hull2(low));
  }
  if (b[0] > b[3]) b.fill(0);
  b[2] = Math.max(0, b[2]);
  if (c.size >= 64) c.delete(c.keys().next().value);
  c.set(key, G = { bounds: b, foot: S.foot || [b[0], b[1], b[3], b[4]], hull: hull2(all), contact: contact.filter(q => q.length >= 3) }); return G;
}
/** the convex hull of 2D points (monotone chain) */
function hull2(P) {
  const p = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) return p;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], hi = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}
/** a placement's turn: shape frame -> world ground (scale, mirror, facing) */
const placeXY = (o, px0, py0, k = o.scale || 1) => { const a = (o.facing === undefined ? Math.PI / 2 : o.facing) - Math.PI / 2, c = Math.cos(a), s = Math.sin(a); return ([x, y]) => { x *= o.flip ? -k : k; y *= k; return [px0 + x * c - y * s, py0 + x * s + y * c]; }; };
const _rasters = new Map(), RASTER_CAP = 800, _specKey = new WeakMap(); let _specN = 0;
const viewKey = v => v.id + ':' + v.yawDeg + ':' + v.pitchDeg + ':' + v.scale + ':' + v.zBoost;
/** a shape's raster for a view and placement, cached (facing in 32 steps); null for an unknown shape */
function shapeRaster(id, view, o = {}) {
  const S = shapeOf(id); if (!S) return null;
  const step = ((Math.round((o.facing === undefined ? Math.PI / 2 : o.facing) / TAU * 32) % 32) + 32) % 32;
  let sk = _specKey.get(S); if (!sk) _specKey.set(S, sk = 'spec' + ++_specN);   // (each entry object its own key: one redefined under the same id draws afresh)
  const ol = o.outline === true ? '#140c1c' : o.outline || '';
  const key = sk + '|' + viewKey(view) + '|' + step + '|' + scaleOf(S, o) + '|' + (o.flip ? 1 : 0) + '|' + (o.mats ? JSON.stringify(o.mats) : '') + '|' + (o.params ? JSON.stringify(o.params) : '') + '|' + ol;
  let r = _rasters.get(key);
  if (r && r.mq.every(q => material(q[0], q[1]) === q[2])) { _rasters.delete(key); _rasters.set(key, r); return r; }   // (most recently used last; one whose materials were edited since is drawn again)
  if (r) _rasters.delete(key);
  r = rasterShape(S, view, Object.assign({}, o, { facing: step / 32 * TAU, name: typeof id === 'string' ? id : undefined }));
  r.cv = rasterCanvas(r, ol); r.runs = rasterRuns(r); if (r.glow && r.glow.some(Boolean)) r.lit = rasterGlow(r); r.rgba = null; r.part = null; r.glow = null;
  if (_rasters.size >= RASTER_CAP) _rasters.delete(_rasters.keys().next().value);
  _rasters.set(key, r); return r;
}
const _shadows = new Map();
/** a placed shape's shadow for a view, as a picture: its footprint's hull soft, darker where parts meet the floor ({ cv,
 *  ox, oy }: the placement's point in it), at the picture's facing step; cached as the pictures are */
function shapeShadow(S, view, o, k, G) {
  const step = ((Math.round((o.facing === undefined ? Math.PI / 2 : o.facing) / TAU * 32) % 32) + 32) % 32;
  const key = _specKey.get(S) + '|' + viewKey(view) + '|' + step + '|' + k + '|' + (o.flip ? 1 : 0) + '|' + (o.params ? JSON.stringify(o.params) : '') + '|' + E.style.trans;
  let sw = _shadows.get(key); if (sw) { _shadows.delete(key); _shadows.set(key, sw); return sw; }
  const place = placeXY(Object.assign({}, o, { facing: step / 32 * TAU }), 0, 0, k), rel = q => { const w = place(q); return [view.ax * w[0] + view.ay * w[1], view.bx * w[0] + view.by * w[1]]; };
  const polys = [[G.hull, .26], ...G.contact.map(c => [c, .4])].filter(p => p[0].length >= 3).map(([p, a]) => [p.map(rel), a]);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [P] of polys) for (const [a, b] of P) { x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, a); y1 = Math.max(y1, b); }
  if (!polys.length) sw = { cv: null };
  else {
    const ox = 1 - Math.floor(x0), oy = 1 - Math.floor(y0), cv = mkCanvas(Math.ceil(x1) + ox + 2, Math.ceil(y1) + oy + 2), g = ctx2d(cv);
    for (const [P, a] of polys) px.polyDither(g, P.map(([a2, b]) => [a2 + ox, b + oy]), '#0c0818', a, 0, 0);
    sw = { cv, ox, oy };
  }
  if (_shadows.size >= RASTER_CAP) _shadows.delete(_shadows.keys().next().value);
  _shadows.set(key, sw); return sw;
}
/**
 * Queue a shape standing at (x, y, z), feet on the point, depth sorted like an actor: r.shape(id | entry, x, y, z, o).
 * o: { facing (radians, where its front points; default PI/2, south, as written), scale, mats: { slot: material },
 * flip (mirror it x to -x before facing), params (a generator's: { h: 30 }), bias, hides (default true: x-ray
 * silhouettes show through it), footprint, light (add its lights to game.lights), shadow (default true), charView (default
 * true: steep views draw it from the characters' lower angle), flash, alpha, xray }
 */
Renderer.prototype.shape = function (id, x, y, z = 0, o = {}) {
  const S = shapeOf(id); if (!S) return;
  // its picture with the outline baked in, drawn as it is; a flash, an x-ray or see-through goes through r.actor's composite
  const view = this.view, rv = o.charView !== false && view.pitchDeg >= 70 ? charView(view) : view, k = scaleOf(S, o), comp = o.flash || o.xray || (o.alpha !== undefined && o.alpha < 1);
  const G = shapeGeom(S, o), B = G.bounds, ext = (Math.max(B[3] - B[0], B[4] - B[1]) + B[5]) * k * (view.scale || 1) * (view.zoom || 1) + 20;
  if (!this.visible(x, y, z, ext, ext, ext)) return;   // (before its picture is made: a room's far side costs nothing)
  const r = shapeRaster(id, rv, comp ? o : Object.assign({}, o, { outline: this.outline })); if (!r) return;
  if (!this.visible(x, y, z, r.w + 20, r.oy + 20, r.h - r.oy + 20)) return;
  const place = placeXY(o, x, y, k);
  if (o.shadow !== false) {   // the footprint, soft, and darker where parts meet the floor: a picture made once per view, then copied
    const sw = shapeShadow(S, view, o, k, G), sh = g => { const [sx, sy] = this.w(x, y, z); g.drawImage(sw.cv, Math.round(sx) - sw.ox, Math.round(sy) - sw.oy); };
    if (sw.cv) { if (z > .5) this.queue(x, y, z - .01, g => { if (!g._info) sh(g); }, { bias: -.001, noInfo: true }); else this.decal(g => { if (!g._info) sh(g); }); }
  }
  const fp = o.footprint || (z > .5 ? (() => { const c = [[G.foot[0], G.foot[1]], [G.foot[2], G.foot[1]], [G.foot[2], G.foot[3]], [G.foot[0], G.foot[3]]].map(place); return [Math.min(...c.map(q => q[0])), Math.min(...c.map(q => q[1])), Math.max(...c.map(q => q[0])), Math.max(...c.map(q => q[1]))]; })() : undefined);
  const hides = o.hides !== false;
  if (comp && r.w <= AS - 8 && r.oy <= AOY - 4 && r.h - r.oy <= AS - AOY - 4 && r.ox <= AOX - 4 && r.w - r.ox <= AS - AOX - 4) this.actor(x, y, z, (g, ox, oy) => g.drawImage(r.cv, ox - r.ox, oy - r.oy), { rim: false, hides, bias: o.bias, flash: o.flash, alpha: o.alpha, xray: o.xray, margin: r.w });
  else {   // (one bigger than an actor's scratch image is drawn this way too, flash or not)
    const b = comp ? shapeRaster(id, rv, Object.assign({}, o, { outline: this.outline })) : r, at = () => { const [sx, sy] = this.w(x, y, z); return [Math.round(sx) - b.ox, Math.round(sy) - b.oy]; };
    const info = gI => {   // GPU lighting's pass: its pixels in the height gradient, as r.actor's composite gives them
      gI._mat = this._infoVert(gI, x, y, z, 10, 0); gI._c = null; px.col(gI, '#000');
      const [bx, by] = at(), R = b.runs; for (let i = 0; i < R.length; i += 3) gI.fillRect(bx + R[i], by + R[i + 1], R[i + 2], 1);
    };
    this.queue(x, y, z, g => { const [bx, by] = at(); g.drawImage(b.cv, bx, by); }, { bias: o.bias, hides, footprint: fp, solid: true, info });
    if (b.lit) this.queue(x, y, z, g => { const [bx, by] = at(); g.drawImage(b.lit.cv, bx, by); }, { bias: (o.bias || 0) + .0005, footprint: fp, emissive: true, info: gI => {   // its glowing parts (a crystal, a flame): unlit
      gI._mat = this._infoCol(z, 10, 1); gI._c = null; px.col(gI, '#000'); const [bx, by] = at(), R = b.lit.runs; for (let i = 0; i < R.length; i += 3) gI.fillRect(bx + R[i], by + R[i + 1], R[i + 2], 1);
    } });
  }
  if (o.light && S.lights) for (const [lx, ly, lz, c, rad] of S.lights) { const w = place([lx, ly]); this.game.lights.add(w[0], w[1], z + lz * k, rad || 60, 1, { color: c }); }
  if (S.flames) for (const [fx, fy, fz, fw, fh] of S.flames) {
    const w = place([fx, fy]), fk = k * view.scale, t = this.game.real * 9 + x * .37;
    this.queue(w[0], w[1], z + fz * k + .01, g => { const [sx, sy] = this.w(w[0], w[1], z + fz * k); px.glow(g, 1); drawFlame(g, sx, sy, fw * fk, fh * fk, t); }, { emissive: true, bias: (o.bias || 0) + .002 });
  }
};
/**
 * a shape as a sprite (E.sprite's kind: r.sprite, px.sprite, inventories, HUDs, portraits): E.shapeSprite(id, { view:
 * 'iso', facing, size (its scale, 1), mats, params, outline: true | a color | false }). The view is a name or a View, as
 * given (r.shape draws steep views from the characters' angle: E.charView(view) gives that); a bag icon is the item's
 * shape seen at an angle. r.sprite stands it on its feet (foot: [x, y] in the sprite) unless an anchor is given
 */
E.shapeSprite = (id, o = {}) => {
  const v = typeof o.view === 'object' ? o.view : VIEWS_BY_ID(o.view || 'iso'), r = shapeRaster(id, v, { facing: o.facing === undefined ? Math.PI / 2 + .6 : o.facing, scale: o.size || 1, mats: o.mats, params: o.params, outline: o.outline === undefined ? true : o.outline });
  if (!r) return null;
  const W = r.w, H = r.h, cv = r.cv, fl = mkCanvas(W, H), fg = ctx2d(fl), d = cv.getContext('2d').getImageData(0, 0, W, H).data, runs = [];
  fg.save(); fg.scale(-1, 1); fg.drawImage(cv, -W, 0); fg.restore();
  for (let y = 0; y < H; y++) for (let x = 0; x < W;) { if (!d[(y * W + x) * 4 + 3]) { x++; continue; } let n = 1; while (x + n < W && d[(y * W + x + n) * 4 + 3]) n++; runs.push([x, y, n, 1]); x += n; }
  return { w: W, h: H, cv, fl, runs, isSprite: true, ox: r.ox, oy: r.oy, foot: [r.ox, r.oy] };
};
/** what a shape draws, for tools and tests: E.shapeInfo(id, { view: 'iso', facing, scale, mats, params }) -> { w, h, ox,
 *  oy, tris, prims (its primitives), parts (each primitive's pixels on screen: 0 is never seen there), colors (distinct),
 *  pixels, bounds [x0, y0, z0, x1, y1, z1], rgba }; null for an unknown shape */
E.shapeInfo = (id, o = {}) => {
  const S = shapeOf(id); if (!S) return null;
  const v = typeof o.view === 'object' ? o.view : VIEWS_BY_ID(o.view || 'iso'), r = rasterShape(S, v, Object.assign({ name: typeof id === 'string' ? id : undefined }, o)), parts = new Array(r.prims).fill(0), cols = new Set(); let pixels = 0;
  for (let j = 0; j < r.part.length; j++) if (r.part[j] >= 0) { parts[r.part[j]]++; pixels++; cols.add((r.rgba[j * 4] << 16) | (r.rgba[j * 4 + 1] << 8) | r.rgba[j * 4 + 2]); }
  return { w: r.w, h: r.h, ox: r.ox, oy: r.oy, tris: r.tris, prims: r.prims, parts, colors: cols.size, pixels, bounds: shapeGeom(S, o).bounds.slice(), rgba: r.rgba };
};
/**
 * a shape's triangles, for a 3D renderer (the 3D engine's world.shape): E.shapeMesh(id | entry, { params, mats, seg })
 * -> { groups: [{ mat, key, lid, curved, face, pos, nrm, uv }], bounds [x0, y0, z0, x1, y1, z1] } in the entry's own
 * units and frame (z up, its front +y, its own scale applied: place it with the placement's facing, scale and flip). The
 * same parts as r.shape draws; null for an unknown shape
 * - seg: seg(r): the segments round a radius r (default 8 to 24)
 * - → groups: each one's mat (the material ready to draw: E.material's), key (its id), lid (true: the faces looking up or
 *   down, which some patterns draw their own way), curved (turned or round faces: planks run up them), face (a pattern
 *   drawn once per face, the crate's sides and bark's ends: uv runs 0 to 1 across each face), pos, nrm, uv
 *   (Float32Arrays: three numbers a corner, three corners a triangle; uv two a corner, world units across the surface)
 */
E.shapeMesh = (id, o = {}) => {
  const S = shapeOf(id); if (!S) return null;
  const R = resolveShape(S, Object.assign({}, o.params, { mats: o.mats }), typeof id === 'string' ? id : undefined), k = S.scale || 1, groups = new Map(), b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
  const seg = o.seg || (r => Math.max(8, Math.min(24, Math.round(r * k * .8) * 2)));
  for (const P of R.prims) {
    const N = invT3(P.M);
    TESS[P.k](f => {
      const m = R.mats[P.mi], face = FACE_PATTERNS[m.pattern] === (f.lid ? 'lid' : 'side'), key = P.mi + (f.lid ? 'L' : 'S') + (f.curved ? 'C' : '') + (face ? 'F' : ''); let G = groups.get(key);
      if (!G) groups.set(key, G = { mat: m, key: R.mq[P.mi] && typeof R.mq[P.mi][0] === 'string' ? R.mq[P.mi][0] : 'm' + P.mi, lid: !!f.lid, curved: !!f.curved, face, pos: [], nrm: [], uv: [] });
      const nv = f.v.length, W = f.v.map(p => add3(mv3(P.M, p), P.t).map(c => c * k)), nn = i => { const q = Array.isArray(f.n[0]) ? f.n[i] : f.n, m = mv3(N, q), l = Math.hypot(m[0], m[1], m[2]) || 1; return [m[0] / l, m[1] / l, m[2] / l]; };
      for (const w of W) for (let i = 0; i < 3; i++) { b[i] = Math.min(b[i], w[i]); b[i + 3] = Math.max(b[i + 3], w[i]); }
      for (let i = 1; i + 1 < nv; i++) for (const j of [0, i, i + 1]) { G.pos.push(...W[j]); G.nrm.push(...nn(j)); G.uv.push(face ? f.uv[j][0] / (f.W || 1) : f.uv[j][0], face ? f.uv[j][1] / (f.H || 1) : f.uv[j][1]); }
    }, P, seg);
  }
  if (b[0] > b[3]) b.fill(0);
  return { groups: [...groups.values()].map(G => Object.assign(G, { pos: new Float32Array(G.pos), nrm: new Float32Array(G.nrm), uv: new Float32Array(G.uv) })), bounds: b };
};
/** a material's pattern as a tile of pixels, for a 3D renderer's texture: E.materialTile(id, { size: 32 (world units
 *  square: it repeats every size; a face pattern's whole face), px: 2 (pixels a unit), lid: false (true: as on a face
 *  looking up), curved (as on a turned face), band: 2 (the light: 0 dark .. 4 bright) }) -> { w, h, rgba
 *  (Uint8ClampedArray, top row first, v up the tile) }; null for an unknown material */
E.materialTile = (id, o = {}) => {
  const m = material(id); if (!m) return null;
  const size = o.size || 32, k = o.px || 2, n = Math.round(size * k), rgba = new Uint8ClampedArray(n * n * 4), band = o.band === undefined ? 2 : o.band;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u = (x + .5) / k, v = (n - 1 - y + .5) / k, c = m.ramp[matTone(m, u, v, size, size, !!o.lid, band, 1 / k, o.lid ? 0 : v, !!o.curved)], j = (y * n + x) * 4;
    rgba[j] = c[0]; rgba[j + 1] = c[1]; rgba[j + 2] = c[2]; rgba[j + 3] = 255;
  }
  return { w: n, h: n, rgba };
};
/** where a placed shape stands, as both engines collide with it: E.shapeBox(id | entry, x, y, z, { facing, scale, flip,
 *  params }) -> { x, y (its footprint's middle), z, top, hx, hy (half its footprint, along its own x and y), c, s (the
 *  turn's cosine and sine) }; null for an unknown shape. map.solid makes one solid; world.shape gives it a collider */
E.shapeBox = (id, x, y, z = 0, o = {}) => {
  const S = shapeOf(id); if (!S) return null;
  const G = shapeGeom(S, o), k = scaleOf(S, o), a = (o.facing === undefined ? Math.PI / 2 : o.facing) - Math.PI / 2, c = Math.cos(a), s = Math.sin(a), f = G.foot;
  // the footprint's middle, turned into place, and its half sizes (mirroring only moves the middle)
  const mx = (f[0] + f[2]) / 2 * (o.flip ? -k : k), my = (f[1] + f[3]) / 2 * k;
  return { x: x + mx * c - my * s, y: y + mx * s + my * c, z, top: z + G.bounds[5] * k, hx: (f[2] - f[0]) / 2 * k, hy: (f[3] - f[1]) / 2 * k, c, s };
};
const VIEWS_BY_ID = id => E.VIEWS[id] || (warn('view:' + id, 'unknown view "' + id + '": ' + Object.keys(E.VIEWS).join(', ')), E.VIEWS.iso);
/**
 * register a store set (src/assets/sets/*.js: { set, format: 1, credit, sources, materials, shapes, sprites }): its entries
 * are named 'SET:id' (so one set never changes another's, or the core's) and find their own set's materials and shapes
 * first. An id that is already there warns and keeps the first. Returns { shapes: [ids], materials: [ids], sprites: {
 * id: sprite } } (sprites are E.sprite data; a color may be 'material:tone', tone deep | sh | base | lt | hi)
 */
E.addAssets = set => {
  const name = set && set.set, out = { shapes: [], materials: [], sprites: {} };
  if (!name) { warn('assets:name', 'E.addAssets(set): a set needs its name (set.set)'); return out; }
  const local = { set: name, materials: set.materials || {}, shapes: {} };
  for (const [id, q] of Object.entries(set.materials || {})) { const k = name + ':' + id; if (MATERIALS[k]) { warn('asset:' + k, 'E.addAssets: ' + k + ' is already there (the first is kept)'); continue; } MATERIALS[k] = q; out.materials.push(k); }
  for (const [id, q] of Object.entries(set.shapes || {})) {
    const k = name + ':' + id; if (SHAPES[k]) { warn('asset:' + k, 'E.addAssets: ' + k + ' is already there (the first is kept)'); continue; }
    const e = Object.assign({}, q); Object.defineProperty(e, '_set', { value: local }); local.shapes[id] = e; SHAPES[k] = e; out.shapes.push(k);
  }
  const TONE = { deep: 0, sh: 1, base: 2, lt: 3, hi: 4 };
  for (const [id, q] of Object.entries(set.sprites || {})) {
    const colors = {};
    for (const [ch, c] of Object.entries(q.colors || {})) { const [m, t] = String(c).split(':'); if (!t && m[0] === '#') { colors[ch] = m; continue; } const mt = material(m, local.materials, 'sprite color') || material(m.startsWith('#') ? m : '#ff00ff'); colors[ch] = mt.hexes[TONE[t || 'base'] === undefined ? 2 : TONE[t || 'base']]; }
    out.sprites[name + ':' + id] = sprite(q.rows, colors, q.scale || 1);
  }
  return out;
};

/* ---- collision: a solid shape is a box with a bottom and a top, turned with the shape ---- */
/** make a shape solid in this map: map.solid(id | entry, x, y, z, o) with r.shape's placement (facing, scale, flip, params)
 *  -> the solid ({ x, y (the footprint's middle), z, top, hx, hy, c, s, shape, px, py (where it was placed) }; map.solids
 *  holds them; what stands on one sorts after it). A body overlapping its span in height is pushed
 *  out of its footprint; one coming down onto it lands on its top; one wholly below passes under. Register solids before
 *  the bodies' updates; drawing never sets them */
TileMap.prototype.solid = function (id, x, y, z = 0, o = {}) {
  const b = E.shapeBox(id, x, y, z, o); if (!b) return null;
  const sol = Object.assign(b, { shape: id, px: x, py: y });
  (this.solids || (this.solids = [])).push(sol); this.version++;
  return sol;
};
/** where a circle (x, y, r) meets a solid's footprint: the push out [dx, dy] (0, 0 when they don't touch) */
function solidPush(sol, x, y, r) {
  const lx = (x - sol.x) * sol.c + (y - sol.y) * sol.s, ly = -(x - sol.x) * sol.s + (y - sol.y) * sol.c;
  const qx = clamp(lx, -sol.hx, sol.hx), qy = clamp(ly, -sol.hy, sol.hy); let dx = lx - qx, dy = ly - qy, d = Math.hypot(dx, dy);
  if (d >= r) return null;
  if (d < 1e-6) { const ex = sol.hx - Math.abs(lx), ey = sol.hy - Math.abs(ly); if (ex < ey) { dx = Math.sign(lx) || 1; dy = 0; d = -ex; } else { dx = 0; dy = Math.sign(ly) || 1; d = -ey; } }
  else { dx /= d; dy /= d; }
  const m = r - d; return [(dx * sol.c - dy * sol.s) * m, (dx * sol.s + dy * sol.c) * m];
}
const _collide = TileMap.prototype.collide, _groundAt = TileMap.prototype.groundAt, _heightAt = TileMap.prototype.heightAt;
TileMap.prototype.collide = function (b) {
  let hit = _collide.call(this, b);
  if (this.solids && this.solids.length) {
    const zA = typeof b.z === 'number', z = zA ? b.z : 0, h = b.h || HEIGHTS.eye + 2, step = b.step === undefined ? HEIGHTS.step : b.step;
    for (const s of this.solids) {
      if (z >= s.top - step || z + h <= s.z) continue;   // on top of it (or a step below its top), or wholly below it
      const p = solidPush(s, b.x, b.y, b.r || 0); if (p) { b.x += p[0]; b.y += p[1]; hit = true; }
    }
  }
  return hit;
};
TileMap.prototype.groundAt = function (x, y, r = 0, z = 1e9, step = 2) {
  let g = _groundAt.call(this, x, y, r, z, step);
  if (this.solids) for (const s of this.solids) if (s.top <= z + step && s.top > g && solidPush(s, x, y, Math.max(.01, r * .6))) g = s.top;
  return g;
};
TileMap.prototype.heightAt = function (x, y) {
  let h = _heightAt.call(this, x, y);
  // a raised solid counts only from what reaches it (a crate on a shelf is not a wall to a bullet under the shelf): passes until none adds
  if (this.solids) for (let n = 0, up = true; up && n < 8; n++) { up = false; for (const s of this.solids) if (s.top > h && s.z <= h + HEIGHTS.step && solidPush(s, x, y, .01)) { h = s.top; up = true; } }
  return h;
};

/* =============================================================================
 * 21f. THE CORE LIBRARY  the materials and shapes every game has (docs/ASSETS.md lists them; the store, src/assets/, has
 *    the rest). Written as the store's entries are: parts in whole or half units, dense arrays. Generators (make) seed
 *    their noise from their params, never from Math.random, so an entry draws the same pixels everywhere
 * ============================================================================= */
const LIB_MATS = {
  oak: '#8a5a36 planks bw=3', walnut: '#5e3c26 planks bw=2', birch: '#b08050 planks bw=3', crate: '#9a6a3a crate',
  cobble: '#7a7486 stones size=4', marble: '#c8c0b8 noise', granite: '#6e6a74 speck', sandstone: '#c8a878 bricks bw=8 bh=4', slate: '#4a4e5a tiles size=6',
  iron: '#5e6274 metal', steel: '#8a92a0 metal', gold: '#d0a038 metal', copper: '#b06a3a metal', bronze: '#9a7a3a metal',
  clay: '#b0603a glaze', glazed: '#3a6a8a glaze', porcelain: '#e8e4dc glaze',
  linen: '#d8ccb0 cloth', burlap: '#a88a58 cloth fold=1.4', wool: '#9a2a3a cloth', velvet: '#4a2a6a cloth', leather: '#6a4028 cloth fold=.6',
  bark: '#6a4a2e bark', needles: '#2f6a4a foliage size=3', shrub: '#4a8a3e foliage size=3', moss: '#5f7a3a foliage size=2', straw: '#c8a850 thatch',
  sand: '#c8b080 speck', snow: '#e8ecf4 noise', mud: '#5a4632 noise',
  shingle: '#6a4a4a shingles', bone: '#d8ceb4 noise', ice: '#a8d0e8 glaze', crystal: '#6ad8f0 glaze glow=1', flame: '#ffd070 none glow=1',
  ruin: { color: '#7a7486', pattern: 'stones', size: 5, over: [['cracks'], ['moss'], ['dirt']] }, rusted: { color: '#5e6274', pattern: 'metal', over: [['rust']] }
};
for (const [k, v] of Object.entries(LIB_MATS)) MATERIALS[k] = typeof v === 'string' ? parseMat(v) : v;
Object.assign(SHAPES, {
barrel: { about: 'oak barrel, two iron hoops', tags: 'container wood', mats: { w: 'oak', h: 'iron' },
  parts: [['lathe','w',[0,0,0],[[0,0],[5,0],[6,3],[6.5,8],[6,13],[5,16],[0,16]]], ['row',2,[0,0,9],['cyl','h',[0,0,7.5],6.5,1.5]]] },
crate: { about: 'wooden crate, framed and braced', tags: 'container wood', mats: { c: 'crate' }, parts: [['box','c',[0,0,0],[15,15,14]]] },
chest: { about: 'oak chest, round lid, iron bands', tags: 'container treasure', mats: { w: 'oak', b: 'iron', l: 'gold' },
  parts: [['box','w',[0,0,0],[16,10,8]], ['prism','w',[0,0,8],[[-5,0],[5,0],[4,3],[0,5],[-4,3]],16,{axis:'x'}], ['mirror','x',['box','b',[5.5,0,0],[1.5,11,8.5]]], ['box','l',[0,5,5],[3,1,3]]] },
table: { about: 'plank table, four legs', tags: 'furniture tavern', mats: { t: 'oak', l: 'walnut' }, parts: [['box','t',[0,0,10],[24,14,2]], ['mirror','xy',['box','l',[10,5,0],[2,2,10]]]] },
chair: { about: 'wooden chair', tags: 'furniture tavern', mats: { w: 'oak', l: 'walnut' },
  parts: [['box','w',[0,0,7],[9,9,1.5]], ['mirror','xy',['box','l',[3.5,3.5,0],[1.5,1.5,7]]], ['mirror','x',['box','l',[3.5,-3.5,8.5],[1.5,1.5,10]]], ['box','w',[0,-3.5,13],[6,1,4]]] },
stool: { about: 'round three-legged stool', tags: 'furniture tavern', mats: { w: 'oak', l: 'walnut' }, parts: [['cyl','w',[0,0,8],5,1.5], ['ring',3,3,['box','l',[0,0,0],[1.5,1.5,8],{rot:[0,-8,0]}]]] },
bench: { about: 'plank bench on two trestles', tags: 'furniture tavern', mats: { w: 'oak', l: 'walnut' }, parts: [['box','w',[0,0,7],[26,7,1.5]], ['mirror','x',['wedge','l',[10,0,0],[2,6,7],{rot:90}]]] },
bed: { about: 'wooden bed, red blanket, head at the back', tags: 'furniture inn', mats: { f: 'oak', s: 'linen', b: 'wool' },
  parts: [['box','f',[0,0,0],[17,30,5]], ['box','s',[0,-1,5],[15,26,2]], ['box','b',[0,4,6],[16,19,1.5]], ['box','s',[0,-9.5,7],[11,5,2]], ['box','f',[0,-14.5,5],[17,2,9]]] },
bookcase: { about: 'tall bookcase full of books', tags: 'furniture library', mats: { w: 'walnut', a: '#8a2a2a', b: '#2a4a8a' },
  parts: [['box','w',[0,-3.5,0],[17,1,30]], ['mirror','x',['box','w',[8,0,0],[1.5,8,30]]], ['row',4,[0,0,9.5],['box','w',[0,0,14],[16,8,1.5]]],
    ['row',3,[0,0,9.5],['row',3,[5,0,0],['group',[0,0,10.5],0,[['box','a',[-1,0,0],[2,6,7]],['box','b',[1.5,0,0],[2,6,6]]]]]]] },
shelf: { about: 'low shelf with a jar and a pot', tags: 'furniture shop', mats: { w: 'birch' },
  parts: [['mirror','x',['box','w',[8,0,0],[1.5,6,16]]], ['row',2,[0,0,7.5],['box','w',[0,0,7],[17,6,1.5]]], ['use','jar',[-4,0,5],{scale:.7}], ['use','pot',[4,0,12.5],{scale:.5}]] },
pot: { about: 'round glazed clay pot', tags: 'container breakable', mats: { c: 'clay' }, parts: [['lathe','c',[0,0,0],[[0,0],[3,0],[5,3],[5,6],[3.5,9],[4,10],[3,10],[2.5,9],[0,9]]]] },
jar: { about: 'blue glazed jar, corked', tags: 'container shop', mats: { g: 'glazed', c: '#a87850' }, parts: [['lathe','g',[0,0,0],[[0,0],[2.5,0],[3.5,4],[3,7],[2,8],[2,9],[0,9]]], ['cyl','c',[0,0,9],1.5,1.5]] },
sack: { about: 'full burlap sack, tied', tags: 'container farm', mats: { b: 'burlap', t: '#6a4a2e' },
  parts: [['ball','b',[0,0,5],5.5,{sz:.9}], ['lathe','b',[0,0,8.5],[[2.5,0],[1,2.5],[2.5,4.5],[0,5]]], ['cyl','t',[0,0,10.5],1.5,1]] },
cart: { about: 'hand cart, two wheels, shafts forward', tags: 'vehicle farm', mats: { w: 'birch', d: 'walnut', r: 'iron' },
  parts: [['box','w',[0,-2,6],[13,18,1.5]], ['mirror','x',['box','w',[6,-2,7.5],[1,18,4]]], ['box','w',[0,-10.5,7.5],[13,1,4]], ['mirror','x',['box','d',[3.5,13,5.5],[1,16,1.5]]], ['mirror','x',['cyl','r',[7,-1,6],6,1.5,{rot:[0,90,0]}]]] },
well: { about: 'stone well, shingled roof, crank', tags: 'village water', mats: { s: 'stone', w: 'walnut', r: 'shingle', a: 'water' },
  parts: [['lathe','s',[0,0,0],[[9,0],[9,8],[6.5,8],[6.5,2]]], ['cyl','a',[0,0,0],7,2], ['mirror','x',['box','w',[8,0,8],[1.5,1.5,15]]], ['prism','r',[0,0,22],[[-9,0],[9,0],[0,7]],20,{axis:'x'}], ['box','w',[0,0,18],[16,1,1]]] },
sign: { about: 'signpost with a blank board', tags: 'village road', mats: { p: 'walnut', b: 'birch' }, parts: [['box','p',[0,0,0],[2,2,22]], ['box','b',[0,1.5,11],[14,1,8]]] },
lamppost: { about: 'iron street lamp, glowing head', tags: 'town light', mats: { m: 'iron', g: 'flame' }, lights: [[0,0,40,'#ffd070',70]],
  parts: [['cyl','m',[0,0,0],2.5,3], ['cyl','m',[0,0,3],1,34], ['box','g',[0,0,37],[4,4,5]], ['cyl','m',[0,0,42],3.5,3,{r2:0,seg:4}]] },
anvil: { about: 'iron anvil on a wooden block', tags: 'forge smithy', mats: { m: 'iron', w: 'walnut' },
  parts: [['cyl','w',[0,0,0],6,7,{sq:.8}], ['box','m',[0,0,7],[4,3.5,5]], ['prism','m',[0,0,0],[[-7,12],[6,12],[11,14],[6,15.5],[-7,15.5]],5,{axis:'y'}]] },
fence: { about: 'rail fence, len long (16)', tags: 'village farm', mats: { w: 'oak' }, params: { len: 16 },
  make: p => [['mirror','x',['box','w',[p.len / 2 - 1,0,0],[2,2,12]]], ['row',2,[0,0,5],['box','w',[0,0,6],[p.len - 2,1,1.5]]]] },
pine: { about: 'pine of tiers (4), h tall (41)', tags: 'tree forest', mats: { b: 'bark', l: 'needles' }, params: { h: 41, tiers: 4 },
  make: ({ h, tiers: n }) => [['cyl','b',[0,0,0],h / 18,h / 3], ...[...Array(n)].map((_, i) => {
    const z = h * (.17 + .6 * i / n), r = h * (.3 - .19 * i / n); return ['lathe','l',[0,0,z],[[0,0],[r * .6,0],[r,h / 25],[0,h * (.35 - .03 * i)]]]; })] },
tree: { about: 'broadleaf tree: a crown of leaf clumps, h tall (40)', tags: 'tree forest', mats: { b: 'bark', l: 'leaves' }, params: { h: 40, seed: 1 },
  make: ({ h, seed }) => { const r = rng(seed * 977 + 13), t = h * .62, out = [['cyl','b',[0,0,0],h / 14,t,{r2:h / 25}], ['ball','l',[0,0,t + h * .16],h * .2,{sz:.85}]];
    for (let i = 0, n = 7 + Math.floor(r() * 3); i < n; i++) { const a = i * 2.4 + r() * .6, d = h * (.16 + r() * .08); out.push(['ball','l',[Math.cos(a) * d,Math.sin(a) * d,t + (r() - .4) * h / 4],h * (.13 + r() * .05),{sz:.85}]); }
    return out; } },   // (a crown round a raised middle: every clump shows from some side)
bush: { about: 'round bush, r wide (7)', tags: 'plant garden', mats: { l: 'shrub' }, params: { r: 7 },
  make: ({ r }) => [['ball','l',[0,0,r * .55],r * .65,{sz:.85}], ['ring',5,r * .5,['ball','l',[0,0,r * .5],r * .55,{sz:.85}]]] },
grass: { about: 'tuft of grass, h tall (6)', tags: 'plant nature', mats: { l: 'shrub' }, params: { h: 6, n: 6 },
  make: ({ h, n }) => [['cyl','l',[0,0,0],.8,h,{r2:0,seg:4}], ['ring',n,1.2,['cyl','l',[0,0,0],.7,h * .8,{r2:0,seg:4,rot:[0,24,0]}]]] },
rock: { about: 'boulder, half sunk, r across (7.5)', tags: 'nature cave', mats: { s: 'rock' }, params: { r: 7.5, seed: 2 },
  make: ({ r, seed }) => [['rock','s',[0,0,r / 8],r,{sz:.7,seed}], ['rock','s',[r * .8,r * .4,0],r * .45,{seed:seed + 3}]] },
crystal: { about: 'cluster of glowing crystals, h tall (18)', tags: 'cave magic', mats: { c: 'crystal' }, params: { h: 18, seed: 1 },
  make: ({ h, seed }) => { const q = rng(seed * 31 + 5); return [0, 1, 2].map(i => { const k = i ? .45 + q() * .2 : 1, w = h / 7 * (i ? .75 : 1), a = i * 2.2 + q();
    return ['lathe','c',[Math.cos(a) * (i && h / 5),Math.sin(a) * (i && h / 7),0],[[0,0],[w,0],[w,h * k * .78],[0,h * k]],{seg:6,rot:[0,i ? 28 * (i === 1 ? 1 : -1) : -10,a * 30]}]; }); } }
});

/* =============================================================================
 * 21. UI  window frames, bars, hearts, dialog boxes and menus (all pixel-drawn,
 *    drawn in the overlay layer so they are never lit or covered)
 * ============================================================================= */
let _hearts = null;
const heartSprites = () => _hearts || (_hearts = {
  full: sprite(['.RR.RR.', 'RWRRRRR', 'RRRRRRR', '.RRRRR.', '..RRR..', '...R...'], { R: '#e8384a', W: '#ffd0d6' }),
  half: sprite(['.RR.DD.', 'RWRDDDD', 'RRRDDDD', '.RRDDD.', '..RDD..', '...D...'], { R: '#e8384a', W: '#ffd0d6', D: '#3a1826' }),
  empty: sprite(['.DD.DD.', 'DDDDDDD', 'DDDDDDD', '.DDDDD.', '..DDD..', '...D...'], { D: '#3a1826' })
});
/** pixel-drawn interface pieces for r.overlay */
E.ui = {
  /**
   * window frame: ui.box(g, x, y, w, h, { bg, border, shadow, gradient })
   * bg: one color (drawn as a soft top-to-bottom gradient, like Final Fantasy windows) or [top, bottom] colors.
   * gradient: false for a flat fill.
   */
  box(g, x, y, w, h, o = {}) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    const bg = o.bg || '#141a3a', bd = o.border || '#e8e4ff', sh = o.shadow === undefined ? '#05040a' : o.shadow;
    if (o.alpha !== undefined && o.alpha < 1) {   // see-through window: translucent fill inside an opaque 1 px frame
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
  /** a bar (a meter: health, magic, stamina, a boss's): ui.bar(g, x, y, w, h, 0..1, '#e0463c') */
  bar(g, x, y, w, h, frac, color = '#e0463c', o = {}) {
    const f = Math.round((w - 2) * clamp(frac, 0, 1));
    px.rect(g, x, y, w, h, o.border || '#140b12'); px.rect(g, x + 1, y + 1, w - 2, h - 2, o.bg || '#3a1a26');
    if (f > 0) { px.rect(g, x + 1, y + 1, f, h - 2, color); px.rect(g, x + 1, y + 1, f, 1, shade(color, .35)); }
  },
  /** row of hearts: hp and max in hearts (halves allowed, e.g. 2.5 of 3) */
  hearts(g, x, y, hp, max, o = {}) {
    const H = heartSprites(), per = o.perRow || 10;
    for (let i = 0; i < Math.ceil(max); i++) { const v = hp - i, s = v >= 1 ? H.full : v >= .5 ? H.half : H.empty; px.sprite(g, s, x + (i % per) * 8, y + Math.floor(i / per) * 7); }
  },
  /** label + value, e.g. ui.counter(g, 4, 4, 'RUPEES', 12) */
  counter(g, x, y, label, value, color = '#ffffff', o = {}) { return E.font.text(g, label + ' ' + value, x, y, color, o); }
};

/**
 * Dialog box with a typewriter effect (Zelda, Dragon Quest, Final Fantasy).
 *   const talk = new E.Dialog(game);
 *   talk.say(['Hello, traveler!', 'It is dangerous to go alone.'], { name: 'OLD MAN', onDone() {...} });
 *   talk.say('Buy the shield?', { choices: ['YES', 'NO'], onChoice(i) {...} });
 *   update: if (talk.update(dt)) return;   // true while it is open, so gameplay waits
 *   draw:   talk.draw(r);                  // anywhere in draw (it goes to the overlay)
 * confirm (Enter, Space, J, Z, pad A), or a click or tap on the box, finishes the line, then turns the page.
 */
class Dialog {
  /** new E.Dialog(game, { speed, lines, place, color, nameColor, voice, bg, border }): a dialog box that types its
   *  text; say() opens it, update(dt) and draw(r) run it */
  constructor(game, o = {}) {
    /** game: its game */
    this.game = game;
    /** speed: letters typed per second; lines: text lines per page; place: 'bottom' | 'top' | 'middle'; color: the
     *  text's color; nameColor: the speaker's name's color; voice: the sound effect each letter blips ('text'; null
     *  for silence); bg, border: the box's colors */
    Object.assign(this, { speed: 50, lines: 3, place: 'bottom', color: '#ffffff', nameColor: '#ffd36a', voice: 'text', bg: '#141a3a', border: '#e8e4ff' }, o);
    /** open: true while it shows; pages: the text wrapped into pages of lines; i: the page shown; shown: letters
     *  typed so far on it; choice: the choice under the cursor */
    this.open = false; this.pages = []; this.i = 0; this.shown = 0; this.choice = 0;
  }
  _dims() {
    const W = this.game.W, H = this.game.H, lh = E.font.lineHeight(), w = Math.min(W - 12, 320), P = this.portrait ? this._pSize : 0, h = Math.max(this.lines * lh + 9, P ? P + 8 : 0), tx = P ? P + 12 : 7;
    const pl = this._place || this.place; let x = Math.round((W - w) / 2), y = this._y !== undefined ? this._y : pl === 'top' ? 12 : pl === 'middle' ? Math.round((H - h) / 2) : H - h - 6;
    const t = this._y === undefined && pl === 'bottom' && this.game.input.touchArea && this.game.input.touchArea();
    if (t && x + w > t.x0 && x < t.x1 && y + h > t.y0) {   // clear of the touch buttons: beside them where it fits, else above them
      if (t.x0 - 4 - w >= 4) x = Math.floor(t.x0 - 4 - w); else if (t.x1 + 4 + w <= W - 4) x = Math.ceil(t.x1 + 4); else y = Math.max(4, Math.floor(t.y0 - h - 4));
    }
    return { x, y, w, h, lh, tx, P };
  }
  /**
   * open with one string or a list of strings (each starts a new page).
   * opts: { name, onDone, choices, onChoice, portrait: rig (a live close-up of that Humanoid beside the text) or a function (g, x, y, size),
   *         portraitSize: 40, portraitOpts: { zoom, turn, bg } }
   * choices: ['YES', 'NO'], shown on the last page; onChoice(i) gets the one picked
   */
  say(text, o = {}) {
    /** portrait: the portrait beside the text (a Humanoid, or a function (g, x, y, size)), or null; pSize: its size
     *  in pixels; pOpts: its options ({ zoom, turn, bg }) */
    this.portrait = o.portrait || null; this._pSize = o.portraitSize || 40; this._pOpts = o.portraitOpts || {};
    this._place = o.place; this._y = o.y; this._alpha = o.alpha;   // per line: place 'top' | 'middle' | 'bottom', or a pixel y, and a see-through box
    const d = this._dims(), pages = [];
    for (const t of Array.isArray(text) ? text : [text]) { const L = E.font.wrap(String(t), d.w - d.tx - 5); for (let k = 0; k < L.length; k += this.lines) pages.push(L.slice(k, k + this.lines)); }
    this.pages = pages.length ? pages : [['']]; this.i = 0; this.shown = 0; this.open = true; this.choice = 0;
    /** name: the speaker's name shown on the box; onDone: called when the last page closes; choices: the answers
     *  offered on the last page, or null; onChoice: called with the index picked */
    this.name = o.name || null; this.onDone = o.onDone || null; this.choices = o.choices || null; this.onChoice = o.onChoice || null; this._blip = 0;
    this.auto = o.auto || 0; this.modal = o.modal !== false; this._wait = 0;   // auto: seconds each page stays after typing; modal: false lets play go on (radio chatter)
    return this;
  }
  /** close it now (and forget pending presses, so the same press doesn't also attack) */
  close() { this.open = false; this.game.input.consumeAll(); }
  /** the lines of the page shown */
  get _page() { return this.pages[this.i] || []; }
  /** the letters on the page shown */
  get pageLen() { return this._page.reduce((a, l) => a + l.length, 0); }
  /** true while the page is still typing */
  get typing() { return this.shown < this.pageLen; }
  /** type and turn pages (confirm finishes the line, then turns the page); returns true while open and modal, so
   *  gameplay can wait: if (talk.update(dt)) return; */
  update(dt) {
    if (!this.open) return false;
    const inp = this.game.input, len = this.pageLen, prev = Math.floor(this.shown);
    this.shown = Math.min(len, this.shown + this.speed * dt);
    if (this.voice && Math.floor(this.shown) > prev && (this._blip++ % 2 === 0)) this.game.audio.sfx(this.voice);
    const last = this.i >= this.pages.length - 1, asking = last && this.choices && !this.typing;
    if (this.auto && !this.choices && !this.typing && (this._wait += dt) >= this.auto) {   // pages turn and the box closes by itself
      this._wait = 0;
      if (last) { this.open = false; if (this.onDone) this.onDone(); } else { this.i++; this.shown = 0; }
      return this.modal && this.open;
    }
    if (!this.modal) return false;
    if (asking) {
      if (inp.repeat('up') || inp.repeat('left')) { this.choice = (this.choice + this.choices.length - 1) % this.choices.length; this.game.audio.sfx('select'); }
      if (inp.repeat('down') || inp.repeat('right')) { this.choice = (this.choice + 1) % this.choices.length; this.game.audio.sfx('select'); }
    }
    const c = inp.clicked(), d = c && this._dims(), tapped = !!d && c[0] >= d.x && c[0] < d.x + d.w && c[1] >= d.y && c[1] < d.y + d.h;   // a tap on the box, as confirm
    if (inp.pressed('confirm') || tapped) {
      if (this.typing) this.shown = len;
      else if (!last) { this.i++; this.shown = 0; }
      else { this.close(); this.game.audio.sfx('confirm'); if (this.choices && this.onChoice) this.onChoice(this.choice, this.choices[this.choice]); if (this.onDone) this.onDone(); }
    } else if (asking && inp.pressed('cancel')) { this.choice = this.choices.length - 1; }
    return true;
  }
  /** draw it (anywhere in draw: it goes to the overlay) */
  draw(r) {
    if (!this.open) return;
    r.overlay(g => {
      const d = this._dims(), ui = E.ui;
      ui.box(g, d.x, d.y, d.w, d.h, { bg: this.bg, border: this.border, alpha: this._alpha });
      if (this.portrait) {
        const px0 = d.x + 5, py0 = d.y + Math.round((d.h - d.P) / 2);
        if (typeof this.portrait === 'function') this.portrait(g, px0, py0, d.P);
        else { this.portrait._talk = this.typing; this.portrait.drawPortrait(g, px0, py0, d.P, Object.assign({ bg: shade(Array.isArray(this.bg) ? this.bg[0] : this.bg, .12), border: this.border, shadow: false }, this._pOpts)); this.portrait._talk = false; }   // the mouth moves while the text types
      }
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

/**
 * Menu with a cursor (title screens, pause menus, shops, battle commands).
 *   const menu = new E.Menu(game, ['START', 'OPTIONS', { label: 'CONTINUE', disabled: !save }], { onPick(i, item) {...}, onCancel() {...} });
 *   update: menu.update(dt)      draw: menu.draw(r)
 * opts: { x: 'center' | px, y: 'center' | px, title, box: true, color, pick: '#ffd36a', columns: 1 }
 */
class Menu {
  constructor(game, items, o = {}) {
    /** game: its game; items: the entries (strings, or { label, disabled }); i: the one under the cursor; active:
     *  false stops it reading input */
    this.game = game; this.items = items || []; this.i = 0; this.active = true;
    /** x, y: where it sits, 'center' or pixels; title: a heading, or null; box: draw a window round it; color: the
     *  entries' color; pick: the color of the one under the cursor; dim: disabled entries' color; bg, border: the
     *  window's colors; onPick: called (i, item) on confirm; onCancel: called on cancel; onMove: called (i, item)
     *  when the cursor moves; sound: false silences it */
    Object.assign(this, { x: 'center', y: 'center', title: null, box: true, color: '#ffffff', pick: '#ffd36a', dim: '#6a6488', bg: '#141a3a', border: '#e8e4ff', onPick: null, onCancel: null, onMove: null, sound: true }, o);
    this._skip(1);
  }
  _label(it) { return typeof it === 'string' ? it : it.label; }
  _off(it) { return typeof it === 'object' && it.disabled; }
  _skip(dir) { for (let k = 0; k < this.items.length && this._off(this.items[this.i]); k++) this.i = (this.i + dir + this.items.length) % this.items.length; }
  /** the entry under the cursor */
  get selected() { return this.items[this.i]; }
  /** move the cursor (up, down; held keys repeat; the mouse over an entry) and pick (confirm, or a click or tap on an
   *  entry) or cancel; returns true when it picked or cancelled */
  update() {
    if (!this.active || !this.items.length) return false;
    const inp = this.game.input, n = this.items.length, old = this.i, b = this._box;
    const row = p => { if (!b || !p || p[0] < b.x || p[0] >= b.x + b.w) return -1; const k = Math.floor((p[1] - b.y) / b.rowH); return k >= 0 && k < n && !this._off(this.items[k]) ? k : -1; };
    if (inp.repeat('up')) { this.i = (this.i + n - 1) % n; this._skip(-1); }
    if (inp.repeat('down')) { this.i = (this.i + 1) % n; this._skip(1); }
    if (inp.mouse.t !== this._mt) { this._mt = inp.mouse.t; const k = row(inp.pointer()); if (k >= 0) this.i = k; }   // the mouse moved over an entry
    const tap = row(inp.clicked());   // a click or tap on an entry picks it
    if (tap >= 0) this.i = tap;
    if (this.i !== old) { if (this.sound) this.game.audio.sfx('select'); if (this.onMove) this.onMove(this.i, this.items[this.i]); }
    if ((inp.pressed('confirm') || tap >= 0) && !this._off(this.items[this.i])) { if (this.sound) this.game.audio.sfx('confirm'); inp.consumeAll(); if (this.onPick) this.onPick(this.i, this.items[this.i]); return true; }
    if (inp.pressed('cancel') && this.onCancel) { if (this.sound) this.game.audio.sfx('cancel'); inp.consumeAll(); this.onCancel(); return true; }
    return false;
  }
  /** draw it to the overlay */
  draw(r) {
    r.overlay(g => {
      const labels = this.items.map(it => this._label(it)), w = Math.max(E.font.width(this.title || ''), ...labels.map(l => E.font.width(l))) + 22, rowH = E.font.lineHeight() + 2;
      const h = labels.length * rowH + (this.title ? rowH + 3 : 0) + 8;
      const x = this.x === 'center' ? Math.round((r.W - w) / 2) : this.x, y = this.y === 'center' ? Math.round((r.H - h) / 2) : this.y;
      if (this.box) E.ui.box(g, x, y, w, h, { bg: this.bg, border: this.border });
      let yy = y + 5;
      if (this.title) { E.font.text(g, this.title, x + w / 2, yy, this.pick, { align: 'center', outline: false, shadow: '#05040a' }); yy += rowH + 3; }
      this._box = { x: x + 3, y: yy - 2, w: w - 6, rowH };   // where the entries are, for a click or tap
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

/* =============================================================================
 * 21d. SHELL  an HTML interface over the game, built from data: the screens (title, pause, settings, help, results, map)
 *    and the HUD pieces (toast, tutorial card, interaction prompt, objective with its distance, status, bars, counts,
 *    minimap) a modern adaptation would otherwise write by hand in HTML and CSS. It shows game state and holds none:
 *    the game passes values in every step and callbacks for the buttons, and it reaches the game only through those and
 *    input actions (a button's act is tapped, as input.bindButtons presses one).
 *      const ui = new E.Shell(game, { theme: { accent: '#d9b77c' }, settings: { items: ['sound', 'volume', 'motion'] },
 *        screens: { pause: { text: () => objective.title }, help: { keys: [['WASD', 'Move'], ['SPACE', 'Climb']] } } });
 *      ui.show('title', { name: 'VESPER', subtitle: 'The Ninth Bell', actions: [['Enter the district', start]] });
 *      every step: ui.hud({ objective: { title, text, at: ledger, from: hero }, status: 'UNSEEN',
 *        bars: [{ value: hp, max: 5, kind: 'pips' }], prompt: near && { key: 'E', label: 'Take the ledger', progress },
 *        minimap: { map, at: hero, markers: [{ x, y, kind: 'diamond' }] } });
 *      ui.toast('Checkpoint', 'The ledger is yours'); ui.show('results', { title: 'The names are safe', stats, medals })
 *    With a pause screen, it opens while game.paused and Resume unpauses. Keys, d-pad, stick and touch move the focus
 *    (up / down / left / right turn a slider or a choice, confirm presses, cancel goes back, pause or Start closes the
 *    menu); while a screen is open the game's input is held back. It honors reduced motion and the safe-area insets, CSS
 *    variables theme it (ink, paper, accent, muted, danger, line, font, titleFont), and a headless game keeps its screens'
 *    names and draws nothing.
 *    THE STANDARD MENU: every game gets one (new E.Game makes this shell for itself, and a game's own E.Shell takes over
 *    from it): the pause screen (Resume, the game's items, Settings, Controls, Full screen, Help, Save session while the
 *    page is recorded, Quit to title with a confirmation), the settings screen (Display, Sound, Comfort and the game's own settings, from game.settings) and the
 *    controls screen (every action's keys and buttons, rebound by pressing the new one, conflicts said before anything
 *    changes; the controller's dead zone, aim, symbols and vibration; the touch buttons' side, size and opacity; restore
 *    defaults). new E.Game({ menu: { items: [['Restart', fn]], settings: [...], controls: { attack: 'Sword', skill:
 *    false }, quit: 'title' } }) adjusts it; menu: false, or new E.Shell(game, { standard: false }), leaves it out.
 * ============================================================================= */
const SHELL_CSS = `.esh{position:fixed;inset:0;pointer-events:none;z-index:20;font:14px/1.45 var(--font);color:var(--ink);--sat:env(safe-area-inset-top,0px);
--pt:calc(14px + env(safe-area-inset-top,0px));--pr:calc(14px + env(safe-area-inset-right,0px));--pb:calc(14px + env(safe-area-inset-bottom,0px));--pl:calc(14px + env(safe-area-inset-left,0px))}
.esh *{box-sizing:border-box}.esh [hidden]{display:none!important}.esh p{margin:4px 0 0;white-space:pre-line}
.esh h1,.esh h2{font-family:var(--title);font-weight:600;margin:2px 0 0;line-height:1.05}.esh h2{font-size:26px}
.esh-pan{background:var(--paper);border:1px solid var(--line);border-radius:6px;padding:10px 13px;box-shadow:0 8px 28px #0009}
.esh-k{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent)}.esh-m{color:var(--muted);font-size:12px}
.esh-obj{position:absolute;left:var(--pl);top:var(--pt);max-width:min(330px,58vw)}.esh-obj b{font:600 17px var(--title);display:block}
.esh-dist{color:var(--accent);font-size:12px;margin-top:4px;letter-spacing:.06em}
.esh-vit{text-align:right;min-width:120px}.esh-hb{display:flex;gap:6px;pointer-events:auto}.esh-hb button{padding:6px 10px;font-size:11px;background:var(--paper)}
.esh-st{font-size:11px;letter-spacing:.16em}.esh-st i{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:6px;background:var(--c)}
.esh-pips{margin-top:5px}.esh-pips i{display:inline-block;width:9px;height:9px;margin-left:4px;transform:rotate(45deg);background:var(--c,var(--danger))}.esh-pips i.off{opacity:.22}
.esh-bar{height:4px;background:#ffffff1c;border-radius:2px;overflow:hidden;margin-top:6px}.esh-bar i{display:block;height:100%;background:var(--c,var(--accent));transition:width .2s}
.esh-cnt{margin-top:6px;font-size:12px;color:var(--muted)}.esh-cnt b{color:var(--ink);margin-left:5px}
.esh-toast{position:absolute;left:50%;top:var(--pt);transform:translate(-50%,calc(-100% - 30px));transition:transform .35s;max-width:min(420px,80vw);text-align:center}.esh-toast.on{transform:translate(-50%,0)}
.esh-tut{position:absolute;left:var(--pl);bottom:var(--pb);max-width:min(330px,62vw);pointer-events:auto;padding-right:30px}
.esh-x{position:absolute;right:6px;top:4px;background:none!important;border:0!important;color:var(--muted)!important;padding:2px 6px!important;font-size:16px!important}
.esh-pr{position:absolute;left:50%;bottom:calc(var(--pb) + 44px);transform:translateX(-50%);display:flex;gap:10px;align-items:center;min-width:200px}
.esh kbd{font:700 12px var(--font);border:1px solid var(--accent);border-bottom-width:2px;border-radius:4px;padding:2px 7px;color:var(--accent)}
.esh-tip{position:absolute;left:50%;bottom:calc(var(--pb) + 100px);transform:translateX(-50%);text-align:center;border-color:var(--danger)}
.esh-col{position:absolute;right:var(--pr);top:var(--pt);display:flex;flex-direction:column;align-items:flex-end;gap:8px}.esh-place{text-align:right;font:italic 13px var(--title);color:var(--muted)}
.esh-mini{position:absolute;right:var(--pr);bottom:var(--pb);width:min(176px,28vw);border-radius:6px;border:1px solid var(--line);pointer-events:auto;cursor:pointer}
.esh-keys{position:absolute;left:50%;bottom:var(--pb);transform:translateX(-50%);display:flex;gap:14px;font-size:12px;color:var(--muted);white-space:nowrap}.esh-keys kbd{margin-right:4px}
@media (pointer:coarse){.esh-keys{display:none}}@media (max-width:640px){.esh-obj{max-width:calc(100vw - 214px)}.esh-toast{left:var(--pl);right:var(--pr);top:auto;bottom:calc(var(--pb) + 124px);max-width:none;transform:translateY(calc(100% + 160px))}.esh-toast.on{transform:none}
.esh-pr{bottom:calc(var(--pb) + 196px)}.esh-tip{bottom:calc(var(--pb) + 262px)}}
.esh-sh{position:absolute;inset:0;display:grid;place-items:center;background:#04060acc;pointer-events:auto;padding:calc(var(--pt) + 46px) var(--pr) var(--pb) var(--pl);animation:esh-in .25s;touch-action:pan-y}.esh-ttl{padding-top:var(--pt)}
.esh-sh *{touch-action:pan-y}.esh-sh input{touch-action:auto}
.esh .esh-nav{position:fixed;top:calc(8px + env(safe-area-inset-top,0px));z-index:2;width:44px;height:44px;min-height:44px;display:grid;place-items:center;padding:0;border-radius:10px;background:rgba(8,8,18,.6);border-color:rgba(255,255,255,.3);pointer-events:auto}
.esh-nav.x{right:calc(8px + env(safe-area-inset-right,0px))}.esh-nav.bk{left:calc(8px + env(safe-area-inset-left,0px))}.esh-sw{transition:transform .2s,opacity .2s}
.esh-mod{width:min(460px,100%);max-height:100%;overflow:auto;padding:22px 24px}.esh-wide{width:min(760px,100%)}
.esh-ttl{place-items:center start;background:linear-gradient(90deg,#04060aee,#04060a99 50%,#04060a00 85%)}.esh-ttl>div{max-width:min(520px,92vw);padding-left:4vw}
.esh-ttl h1{font-size:clamp(44px,10vw,92px);letter-spacing:.07em}.esh-sub{font:italic 20px var(--title);color:var(--accent);margin-top:6px}
.esh-btns{display:flex;flex-direction:column;gap:8px;margin-top:18px}.esh-tags{display:flex;gap:10px;margin-top:18px;font-size:11px;letter-spacing:.16em;color:var(--muted)}
.esh button{font:600 13px var(--font);letter-spacing:.08em;text-transform:uppercase;color:var(--ink);background:#ffffff0f;border:1px solid #ffffff2c;border-radius:4px;padding:10px 14px;text-align:left;cursor:pointer}
.esh button.pri{background:var(--accent);border-color:var(--accent);color:#16130e}.esh button:disabled{opacity:.4;cursor:default}
.esh button:focus-visible,.esh input:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.esh-row{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:7px 0;border-bottom:1px solid var(--line)}.esh-row button{min-width:64px;text-align:center}
.esh input[type=range]{accent-color:var(--accent);width:140px}.esh-grid{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;margin-top:12px;align-items:center}
.esh-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:10px;margin:16px 0 8px}.esh-stats b{display:block;font:600 24px var(--title)}
.esh-stats small{color:var(--muted);font-size:10px;letter-spacing:.14em}.esh-med{display:inline-block;margin:6px 6px 0 0;padding:3px 9px;border-radius:12px;border:1px solid var(--accent);font-size:12px}.esh-med.off{opacity:.35;border-color:var(--muted)}
.esh-sec{margin-top:14px}.esh-emb{font-size:34px;color:var(--accent);text-align:center}.esh-map{width:100%;margin-top:12px;border-radius:4px;cursor:crosshair;display:block}
.esh-still,.esh-still *{transition:none!important;animation:none!important}@media (prefers-reduced-motion:reduce){.esh *{transition:none!important;animation:none!important}}
.esh-cornered .esh-col{top:calc(var(--pt) + 50px)}.esh-sh button{min-height:44px}.esh-row{flex-wrap:wrap}.esh-row>span{flex:1 1 150px}.esh-row small{display:block;color:var(--muted);font-size:11px;line-height:1.3}
.esh-ctl{display:flex;align-items:center;gap:8px}.esh output{min-width:46px;text-align:right;color:var(--muted);font-size:12px;font-variant-numeric:tabular-nums}
.esh-sel{min-width:136px;text-align:center!important}.esh input[type=range]{height:30px}.esh-status{min-height:20px;margin-top:8px;color:var(--accent);font-size:12px}
.esh-bind{display:grid;grid-template-columns:1fr minmax(92px,auto) minmax(92px,auto);gap:6px 10px;align-items:center;margin-top:8px}.esh-bind small{color:var(--muted);font-size:10px;letter-spacing:.14em;text-transform:uppercase;text-align:center}
.esh-bind button{text-align:center;text-transform:none;letter-spacing:.02em;font-size:12px;padding:8px 10px}.esh-bind button.cap{outline:2px dashed var(--accent);outline-offset:2px}
@keyframes esh-in{from{opacity:0}}`;
const SHELL_THEME = { ink: '#f1e8d6', paper: 'rgba(14,18,22,.86)', accent: '#d9b77c', muted: '#a49d8c', danger: '#e8836a', line: 'rgba(217,183,124,.3)', font: 'system-ui, sans-serif', titleFont: 'Georgia, serif' };
/** the settings screen's groups, in order (the standard ones; a game's own are 'Game' unless they name another) */
const SHELL_GROUPS = ['Display', 'Sound', 'Comfort'];
/** 'menuUp' -> 'Menu up': an action's name on the controls screen when the game gives none */
const actionName = a => { const t = String(a).replace(/([a-z])([A-Z0-9])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase(); return t.charAt(0).toUpperCase() + t.slice(1); };
class Shell {
  /**
   * new E.Shell(game, { theme, screens: { name: spec }, settings: { items, onChange(settings, key) }, store: 'shell-settings',
   * meters: .125, standard: true }): an HTML interface over the game (see the section's header)
   * - theme: CSS variables (ink, paper, accent, muted, danger, line, font, titleFont)
   * - screens: specs ui.show(name) starts from (the pause screen follows game.paused; screens: { pause: false } leaves it out)
   * - settings: settings.items: the game's own settings, { key, label, type: 'toggle' | 'slider' | 'select', min, max,
   *   step, options, value } (kept in game.settings, beside the standard ones)
   * - store, meters: store: where an older version saved them; meters: meters per world unit for distances
   * - standard: false leaves out the standard menu (the pause screen's Settings, Controls, Full screen and Quit, and the
   *   settings' groups)
   */
  constructor(game, o = {}) {
    if (game.shell && game.shell._sys && !o.system) game.shell.dispose();   // the game's own shell takes over from the engine's
    /** game: the game it is over; o: its options; root: its DOM element (null in a headless game) */
    this._game = game; this._o = o; this.root = null; this._stack = []; this._keep = new Set(); this._held = new Set(); this._last = {};
    this._sys = !!o.system; this._std = o.standard !== false && game.o.menu !== false;
    const old = store.get(o.store || 'shell-settings', null) || {}, S = game.settings;   // (settings saved by an older version are kept)
    for (const it of this._items()) if (!S.spec(it.key)) { if (S._raw[it.key] === undefined && old[it.key] !== undefined) S._raw[it.key] = old[it.key]; S.define(Object.assign({ group: 'Game' }, it)); }
    for (const k of ['sound', 'volume', 'motion']) if (S._raw[k] === undefined && old[k] !== undefined && this._items().some(it => it.key === k)) S.set(k, old[k]);
    if (o.settings && o.settings.onChange) S.onChange = k => o.settings.onChange(S, k);
    game.shell = this;
    if (!this._sys && this._pauseSpec()) game.pauseOverlay = false;
    if (game.headless || typeof document === 'undefined') return;
    // rebinding: the next key or mouse button goes to the action being bound (before the game's own listeners see it)
    const signal = game._abort ? game._abort.signal : undefined;
    addEventListener('keydown', e => { const c = this._cap; if (!c) return; e.preventDefault(); e.stopImmediatePropagation(); if (e.code === 'Escape') this._capEnd('Not changed.'); else if (c.device === 'keys' && !e.repeat) this._capBind(e.code); }, { capture: true, signal });
    addEventListener('pointerdown', e => { const c = this._cap; if (!c || c.device !== 'keys' || e.pointerType !== 'mouse') return; e.preventDefault(); e.stopImmediatePropagation(); this._capBind('Mouse' + e.button); }, { capture: true, signal });
    if (!document.getElementById('esh-css')) { const st = document.createElement('style'); st.id = 'esh-css'; st.textContent = SHELL_CSS; document.head.appendChild(st); }
    const r = this.root = this._el('div', 'esh' + (game._corner ? ' esh-cornered' : '')), th = Object.assign({}, SHELL_THEME, o.theme);   // (the top-right column starts below the corner's buttons)
    for (const k in th) r.style.setProperty('--' + (k === 'titleFont' ? 'title' : k), th[k]);
    const host = document.body; host.appendChild(r);
    const E2 = (cls, parent = r, tag = 'div') => { const e = this._el(tag, cls); e.hidden = true; parent.appendChild(e); return e; };
    const col = this._el('div', 'esh-col'); r.appendChild(col);
    /** the HUD's elements, by piece (hb, obj, vit, toast, tut, pr, tip, place, mini, keys) and the screen layer (scr) */
    this._els = { hb: E2('esh-hb', col), obj: E2('esh-obj esh-pan'), vit: E2('esh-vit esh-pan', col), place: E2('esh-place', col), tip: E2('esh-tip esh-pan'), pr: E2('esh-pr esh-pan'), keys: E2('esh-keys'),
      tut: E2('esh-tut esh-pan'), mini: E2('esh-mini', r, 'canvas'), toast: E2('esh-toast esh-pan'), scr: this._el('div', '') };
    r.appendChild(this._els.scr); this._els.toast.hidden = false;
    const mini = this._els.mini; mini.width = 176; mini.height = 158; mini.onclick = () => { const m = this._miniLast; if (m && m.onClick) m.onClick(); };
  }
  /** the name of the open screen ('pause', 'settings', 'controls', ...), or null while the game plays */
  get screen() { const t = this._stack[this._stack.length - 1]; return t ? t.name : null; }
  /** the player's settings: game.settings (the standard ones and the game's own, by key) */
  get settings() { return this._game.settings; }
  /** the pause screen's spec ({} for the standard one), or null without one */
  _pauseSpec() { const sc = this._o.screens; return sc && 'pause' in sc ? sc.pause || null : this._std ? {} : null; }
  /** does this shell give the standard menu (the corner's menu button and game.menu() open it)? */
  _menu() { return this._std; }
  /** open a screen: 'title' | 'pause' | 'settings' | 'help' | 'results' | 'map' or a name of your own, from spec over
   *  o.screens[name]. A spec: { kicker, title, text (strings or functions), actions: [[label, fn] or { label, fn, act,
   *  primary, disabled }], back (fn for cancel) }. From another screen it stacks (back() returns); shown again, it updates
   *  (the new spec over the old). 'settings' takes its items
   *  - 'title': { name, subtitle, meta: [...], footer }
   *  - 'help': { keys: [[key, what]], sections: [[heading, text]] }
   *  - 'results': { emblem, stats: [[value, label]], medals: [[label, earned]] }
   *  - 'map': { map, at, markers (a list or a function), labels: [[text, x, y]], onPick(x, y) } */
  show(name, spec = {}) {
    const top = this._stack[this._stack.length - 1], again = top && top.name === name, s = Object.assign({}, this._o.screens && this._o.screens[name], again ? top.s : null, spec);
    if (again) this._stack.pop();   // the same screen again: updated in place
    else { if (top) top.focus = this._focusAt(); this._status = ''; }   // (the focus comes back here when the new screen closes)
    this._stack.push({ name, s, focus: again ? top.focus : undefined }); this._capEnd(); this._render(); return this;
  }
  /** what cancel does: the screen's own back(), or close it (back to the screen under it; closing the pause screen resumes) */
  back() {
    const top = this._stack[this._stack.length - 1]; if (!top) return this;
    if (top.s.back) { top.s.back(); return this; }
    this._stack.pop(); this._capEnd(); if (top.name === 'pause') this._game.resume();
    this._closed(); this._render(); return this;
  }
  /** close every screen (and resume, when the menu paused the game) */
  hide() { const p = this._stack.some(t => t.name === 'pause'); this._stack.length = 0; this._capEnd(); if (p) this._game.resume(); this._closed(); this._render(); return this; }
  /** the last screen closed: a game the menu paused (a title under its settings) goes on */
  _closed() { if (!this._stack.length && this._ownPause) { this._ownPause = false; this._game.resume(); } }
  /** which focusable element of the open screen has the focus (its index), or -1 */
  _focusAt() { if (!this.root) return -1; const all = this._focusables(); return all.indexOf(document.activeElement); }
  _focusables() { return [...this._els.scr.querySelectorAll('.esh-sh button:not(:disabled), .esh-sh input:not(:disabled)')]; }
  /** close the menu: every screen over the title (a game's own title screen stays), resuming a game the menu paused */
  _close() { const i = this._stack.findIndex(t => t.name === 'title'); if (i < 0) return this.hide(); this._stack.length = i + 1; this._capEnd(); this._render(); return this; }
  /** a close or back button over the screen (an icon, 44 px; the keys have Escape and Start, so it takes no focus) */
  _navBtn(cls, label, d, fn) {
    const b = this._el('button', 'esh-nav ' + cls); b.type = 'button'; b.tabIndex = -1; b.setAttribute('aria-label', label); b.title = label; b.innerHTML = cornerIcon(d);
    b.onclick = e => { e.stopPropagation(); fn(); }; return b;
  }
  /** a sideways swipe on a screen goes back: the panel follows the finger and goes back past 70 px (a slider keeps its own) */
  _swipe(sh, box, title) {
    if (title) return; let s0 = null, swiped = false;
    const end = e => { if (!s0 || e.pointerId !== s0.id) return; const dx = e.clientX - s0.x, go = s0.on && Math.abs(dx) > 70 && e.type === 'pointerup'; swiped = s0.on; s0 = null;
      box.classList.add('esh-sw'); box.style.transform = go ? 'translateX(' + Math.sign(dx) * 110 + '%)' : ''; box.style.opacity = go ? '0' : '';
      if (go) setTimeout(() => this.back(), 120); };
    sh.addEventListener('pointerdown', e => { swiped = false; if (e.pointerType === 'mouse' || s0 || (e.target.closest && e.target.closest('input'))) return; s0 = { id: e.pointerId, x: e.clientX, y: e.clientY, on: false }; box.classList.remove('esh-sw'); });
    sh.addEventListener('click', e => { if (swiped) { e.stopPropagation(); e.preventDefault(); swiped = false; } }, true);   // (the button a swipe began on isn't pressed)
    sh.addEventListener('pointermove', e => {
      if (!s0 || e.pointerId !== s0.id) return; const dx = e.clientX - s0.x, dy = e.clientY - s0.y;
      if (!s0.on && Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.3) s0.on = true;
      if (s0.on) { box.style.transform = 'translateX(' + dx + 'px)'; box.style.opacity = String(clamp(1 - Math.abs(dx) / 300, .3, 1)); }
    });
    for (const t of ['pointerup', 'pointercancel']) sh.addEventListener(t, end);
  }
  /** a message that slides in at the top for a few seconds */
  toast(title, text = '', seconds = 4) {
    if (!this.root) return this;
    const e = this._els.toast; e.replaceChildren(this._el('b', '', title)); if (text) e.appendChild(this._el('p', 'esh-m', text));
    e.classList.add('on'); this._toastEnd = this._game.real + seconds; return this;
  }
  /** a tutorial card (bottom left, dismissable) for some seconds; tutorial(null) takes it away */
  tutorial(title, text = '', seconds = 15) {
    if (!this.root) return this;
    const e = this._els.tut; e.hidden = !title; this._tutEnd = title ? this._game.real + seconds : 0; if (!title) return this;
    const x = this._el('button', 'esh-x', '×'); x.setAttribute('aria-label', 'Dismiss'); x.onclick = () => this.tutorial(null);
    e.replaceChildren(this._el('div', 'esh-k', 'Tutorial'), this._el('b', '', title), this._el('p', 'esh-m', text), x); return this;
  }
  /**
   * the HUD, from this step's state (call it every step; a piece left out is hidden, and only what changed is redrawn)
   * - objective: { step: '01 / 04', title, text, at: { x, y, z }, from: hero } (the distance in meters, and above or below)
   * - status, place, tip: status: 'UNSEEN' or { text, color }; place: 'The Old Harbour'; tip: 'text' or { title, text }
   * - bars, counts: bars: [{ label, value, max, kind: 'bar' | 'pips', color }] (health, stamina, a meter); counts: [[label,
   *   value]]
   * - prompt: { key: 'E' (or act: 'interact': its key on the player's device), label, hint, progress: 0..1 }
   * - keys, buttons: keys: [['WASD', 'Move'], ...] (hidden on touch screens); buttons: [[label, fn or action]] (top right:
   *   pause and map where there is no Escape key)
   * - minimap: { map, at (with facing), markers: [{ x, y, kind: 'dot' | 'diamond' | 'ring' | 'cross', color }], onClick }
   */
  hud(st = {}) {
    if (!this.root) return this;
    const s = st || {}, E3 = this._els, play = !this.screen;
    this._piece('obj', play && s.objective, o => {
      const d = o.at && o.from ? Math.round(Math.hypot(o.at.x - o.from.x, o.at.y - o.from.y) * (this._o.meters || .125)) : null, dz = o.at && o.from ? (o.at.z || 0) - (o.from.z || 0) : 0;
      return [o.step && this._el('div', 'esh-k', o.step), this._el('b', '', o.title), o.text && this._el('p', 'esh-m', o.text),
        d !== null && this._el('div', 'esh-dist', d + ' m' + (dz > 12 ? '  ·  ABOVE YOU' : dz < -12 ? '  ·  BELOW YOU' : ''))];
    });
    this._piece('vit', play && (s.status || s.bars || s.counts) && [s.status, s.bars, s.counts], ([sta, bars, cnt]) => {
      const out = [];
      if (sta) { const t = typeof sta === 'string' ? { text: sta } : sta, e = this._el('div', 'esh-st'); e.style.setProperty('--c', t.color || 'var(--accent)'); e.append(this._el('i'), t.text); out.push(e); }
      for (const b of bars || []) {
        const e = this._el('div', b.kind === 'pips' ? 'esh-pips' : 'esh-bar'); if (b.color) e.style.setProperty('--c', b.color);
        if (b.label) out.push(this._el('div', 'esh-m', b.label));
        if (b.kind === 'pips') for (let i = 0; i < (b.max || 0); i++) e.appendChild(this._el('i', i < b.value ? '' : 'off'));
        else { const f = this._el('i'); f.style.width = clamp(b.value / (b.max || 1), 0, 1) * 100 + '%'; e.appendChild(f); }
        e.setAttribute('aria-label', (b.label || '') + ' ' + b.value + ' of ' + (b.max || 1)); out.push(e);
      }
      for (const [k, v] of cnt || []) { const e = this._el('div', 'esh-cnt', k); e.appendChild(this._el('b', '', v)); out.push(e); }
      return out;
    });
    const pr = s.prompt && Object.assign({}, s.prompt, { key: s.prompt.key || (s.prompt.act ? this._game.input.label(s.prompt.act) : 'E') });   // (the key follows the device in use)
    this._piece('pr', play && pr, p => {
      const box = this._el('div'), bar = this._el('div', 'esh-bar'), f = this._el('i'); f.style.width = clamp(p.progress || 0, 0, 1) * 100 + '%'; bar.appendChild(f);
      box.append(this._el('div', 'esh-k', p.hint || (p.progress !== undefined ? 'Hold to interact' : 'Interact')), this._el('b', '', p.label || ''));
      if (p.progress !== undefined) box.appendChild(bar);
      return [this._el('kbd', '', p.key), box];
    });
    this._btns = s.buttons || [];   // (clicks call this step's: the functions may be new every step)
    this._piece('hb', play && s.buttons && s.buttons.map(b => b[0]), labels => labels.map((l, i) => { const b = this._el('button', '', l); b.onclick = () => { const f = this._btns[i] && this._btns[i][1]; if (typeof f === 'function') f(); else if (f) { this._game.input.tap(f); this._held.add(f); } }; return b; }));
    this._piece('tip', play && s.tip, t => typeof t === 'string' ? [this._el('b', '', t)] : [this._el('b', '', t.title), t.text && this._el('p', 'esh-m', t.text)]);
    this._piece('place', play && s.place, p => [p]);
    this._piece('keys', play && s.keys, ks => ks.map(([k, w]) => { const e = this._el('span'); e.append(this._el('kbd', '', k), w); return e; }));
    const m = play && s.minimap; E3.mini.hidden = !m; if (m) this._miniLast = m;
    if (m && (this._game.real - (this._miniT || -1) > .1)) { this._miniT = this._game.real; this._map(E3.mini, m, false); }
    return this;
  }
  /** take its elements away and let go of the game (game.dispose() does it) */
  dispose() { if (this.root) this.root.remove(); this.root = null; if (this._game.shell === this) this._game.shell = null; }
  /** the settings items the game gave (a name is a standard setting: 'sound', 'volume', 'motion', ...) */
  _items() { const it = this._o.settings && this._o.settings.items || []; return it.map(i => typeof i === 'string' ? Object.assign({ key: i }, STANDARD_SETTINGS[i]) : i).filter(i => i && i.key); }
  /** an element with a class and text (text is never parsed as HTML) */
  _el(tag, cls = '', text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null && text !== false) e.textContent = String(text); return e; }
  /** redraw one HUD piece when its state changed: build(state) -> its children */
  _piece(k, state, build) {
    const e = this._els[k], key = state ? JSON.stringify(state, (n, v) => n === 'from' || n === 'at' ? (v ? [Math.round(v.x), Math.round(v.y), Math.round(v.z || 0)] : v) : v) : '';
    if (key === this._last[k]) return; this._last[k] = key; e.hidden = !state;
    if (state) e.replaceChildren(...build(state).filter(Boolean).map(c => typeof c === 'string' ? document.createTextNode(c) : c));
  }
  /** a settings value changed: game.settings checks, saves and applies it, and tells the game */
  _set(key, v) { return this._game.settings.set(key, v); }
  /** one settings row: its label (and help), and a control for its type: a switch, a slider with its value, a choice
   *  that turns with left and right, full screen (with why not, where it can't) */
  _row(key) {
    const S = this._game.settings, sp = S.spec(key); if (!sp) return null;
    const row = this._el('div', 'esh-row'), lab = this._el('span', '', sp.label || actionName(key)), fs = this._game.fullscreen;
    row.appendChild(lab);
    const help = t => { if (t) lab.appendChild(this._el('small', '', t)); };
    if (sp.type === 'fullscreen') {
      const can = fs.supported && !fs.standalone, b = this._el('button', '', !can ? (fs.standalone ? 'App' : 'Not here') : fs.on ? 'On' : 'Off');
      b.disabled = !can; b.setAttribute('role', 'switch'); b.setAttribute('aria-checked', String(fs.on)); b.onclick = () => { fs.toggle(); };
      help(fs.standalone ? 'Opened from the home screen: no browser bars.' : !fs.supported ? (/iP(hone|od)/.test(navigator.userAgent) ? 'On an iPhone: Share, then Add to Home Screen, plays without the browser\'s bars.' : 'This browser or page doesn\'t allow it.') : '');
      row.appendChild(b); return row;
    }
    help(sp.help);
    if (sp.type === 'slider') {
      const box = this._el('span', 'esh-ctl'), r = this._el('input'), out = this._el('output'), lo = sp.min === undefined ? 0 : sp.min, hi = sp.max === undefined ? 1 : sp.max;
      const fmt = v => hi <= 1 && lo >= 0 ? Math.round(v * 100) + '%' : Math.round(v * 100) / 100 + (sp.unit || '');
      Object.assign(r, { type: 'range', min: lo, max: hi, step: sp.step || (hi - lo) / 20, value: S[key] }); r.setAttribute('aria-label', sp.label || key); out.textContent = fmt(S[key]);
      r.oninput = () => { out.textContent = fmt(this._set(key, +r.value)); };
      box.append(r, out); row.appendChild(box); return row;
    }
    if (sp.type === 'select') {
      const opts = (sp.options || []).map(o => Array.isArray(o) ? o : [o, String(o)]), b = this._el('button', 'esh-sel');
      const show = () => { const o = opts.find(o => o[0] === S[key]) || opts[0]; b.textContent = '‹ ' + (o ? o[1] : '') + ' ›'; b.setAttribute('aria-label', (sp.label || key) + ': ' + (o ? o[1] : '')); };
      b._cycle = d => { const i = opts.findIndex(o => o[0] === S[key]); this._set(key, opts[((i < 0 ? 0 : i) + d + opts.length) % opts.length][0]); show(); };
      b.onclick = () => b._cycle(1); show(); row.appendChild(b); return row;
    }
    if (sp.type !== 'toggle') return null;
    const b = this._el('button', '', S[key] ? 'On' : 'Off'); b.setAttribute('role', 'switch'); b.setAttribute('aria-checked', String(!!S[key]));
    b.onclick = () => { const v = this._set(key, !S[key]); b.textContent = v ? 'On' : 'Off'; b.setAttribute('aria-checked', String(!!v)); };
    row.appendChild(b); return row;
  }
  /** the settings screen's rows: Display, Sound and Comfort, then the game's own (standard: false, the game's items only) */
  _settingsRows(add) {
    const S = this._game.settings, own = this._items().map(i => i.key);
    if (!this._std) { for (const k of own) add(this._row(k)); return; }
    const groups = SHELL_GROUPS.concat([...new Set(S.keys().map(k => S.spec(k).group))].filter(g => !SHELL_GROUPS.includes(g) && !['Controls', 'Controller', 'Touch'].includes(g)));
    for (const g of groups) {
      const keys = S.keys(g).filter(k => (k !== 'scale' || this._game.screen._fixedRes()) && (k !== 'fullscreen' || this._game.o.fullscreen !== false) && (k !== 'zoom' || !this._game._zoomStd() || this._game._zooms()) && S.spec(k).type !== 'value');
      if (!keys.length) continue;
      add(this._el('div', 'esh-k esh-sec', g)); for (const k of keys) add(this._row(k));
    }
  }
  /** the controls screen: each action's keys and buttons (press a new one to rebind), the controller's and the touch
   *  buttons' settings */
  _controls(add) {
    const I = this._game.input, names = I.names || {}, st = this._el('div', 'esh-status', this._status || ''); st.setAttribute('role', 'status'); st.setAttribute('aria-live', 'polite');
    add(this._el('p', 'esh-m', 'Choose a key or button, then press the new one. The arrow keys, the d-pad, Enter and Escape always work in menus.'), st);
    const S = this._game.settings, coarse = window.matchMedia && matchMedia('(any-pointer: coarse)').matches, touch = I._touchArgs && (coarse || I._touched || S.touch === 'on');
    const touchRows = () => { add(this._el('div', 'esh-k esh-sec', 'Touch')); for (const k of S.keys('Touch')) add(this._row(k)); }, first = touch && I.lastDevice === 'touch';
    if (first) touchRows();   // (a phone in hand: its buttons first)
    const grid = this._el('div', 'esh-bind'); grid.append(this._el('span'), this._el('small', '', 'Keyboard'), this._el('small', '', 'Controller'));
    for (const a of Object.keys(I.map).filter(a => I.rebindable(a))) {
      const name = typeof names[a] === 'string' ? names[a] : actionName(a); grid.appendChild(this._el('span', '', name));
      for (const d of ['keys', 'pad']) {
        const codes = I.map[a].filter(c => !c.startsWith('Act:') && !c.startsWith('PadAxis') && padCode(c) === (d === 'pad')), cap = this._cap && this._cap.a === a && this._cap.device === d;
        const b = this._el('button', cap ? 'cap' : '', cap ? 'Press…' : codes.map(c => I.codeLabel(c)).join(' / ') || '—');
        b.setAttribute('aria-label', name + ', ' + (d === 'pad' ? 'controller' : 'keyboard') + ': ' + (codes.map(c => I.codeLabel(c)).join(', ') || 'none'));
        b.onclick = () => this._capStart(a, d, name); grid.appendChild(b);
      }
    }
    add(grid);
    const pad = I.padId ? 'Controller: ' + I.padId.replace(/\s*\(.*$/, '') : 'No controller found: press a button on one to connect it.';
    add(this._el('div', 'esh-k esh-sec', 'Controller'), this._el('p', 'esh-m', pad));
    for (const k of S.keys('Controller')) add(this._row(k));
    if (touch && !first) touchRows();
  }
  _capStart(a, device, name) {
    this._cap = { a, device, name, prev: this._game.input.padPrev.slice() };
    this._status = device === 'pad' ? 'Press a controller button for ' + name + ' (Start cancels).' : 'Press a key or mouse button for ' + name + ' (Escape cancels).';
    this._render();
  }
  _capBind(code) {
    const c = this._cap; if (!c) return;
    const I = this._game.input, r = I.rebind(c.a, c.device, code), names = I.names || {}, nm = a => typeof names[a] === 'string' ? names[a] : actionName(a);
    if (r === 'reserved') { this._status = I.codeLabel(code) + ' is kept for the menus. Choose another, or press Escape.'; this._render(); return; }
    if (r) { this._status = I.codeLabel(code) + ' is already ' + nm(r) + '. Rebind ' + nm(r) + ' first, or choose another.'; this._render(); return; }
    this._capEnd(nm(c.a) + ': ' + I.codeLabel(code) + '. Saved.');
  }
  /** stop listening for a new binding (msg: what the status line says) */
  _capEnd(msg) { if (!this._cap) { if (msg !== undefined) this._status = msg; return; } this._cap = null; this._status = msg || ''; this._game.input.clear(); this._render(); }
  /** a button: [label, fn] or { label, fn, act, primary, disabled } */
  _btn(a, i, pri = true) {
    const b = Array.isArray(a) ? { label: a[0], fn: a[1] } : a, e = this._el('button', b.primary || (b.primary === undefined && i === 0 && pri) ? 'pri' : '', b.label);
    e.disabled = !!b.disabled;
    e.onclick = () => { if (b.fn) b.fn(); else if (b.act) { this._game.input.tap(b.act); this._held.add(b.act); } };
    return e;
  }
  /** build the open screen */
  _render() {
    if (!this.root) return;
    const scr = this._els.scr, top = this._stack[this._stack.length - 1];
    if (!top) { scr.replaceChildren(); return; }
    for (const k of ['hb', 'obj', 'vit', 'place', 'tip', 'pr', 'keys', 'mini']) { this._els[k].hidden = true; this._last[k] = null; }   // the HUD hides under a screen (a paused game calls no hud())
    const { name, s } = top, v = x => typeof x === 'function' ? x() : x, title = name === 'title';
    const sh = this._el('div', 'esh-sh' + (title ? ' esh-ttl' : '')), box = this._el('div', title ? '' : 'esh-pan esh-mod' + (name === 'map' ? ' esh-wide' : ''));
    sh.appendChild(box); sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-label', v(s.title || s.name) || name);
    const add = (...c) => box.append(...c.filter(Boolean));
    add(s.emblem && this._el('div', 'esh-emb', s.emblem), s.kicker && this._el('div', 'esh-k', v(s.kicker)));
    if (title) add(this._el('h1', '', v(s.name || s.title)), s.subtitle && this._el('div', 'esh-sub', v(s.subtitle)));
    else add(this._el('h2', '', v(s.title) || { pause: 'Paused', settings: 'Settings', controls: 'Controls', help: 'Help', map: 'Map' }[name] || ''));
    add(v(s.text) && this._el('p', title ? '' : 'esh-m', v(s.text)));
    if (name === 'settings') this._settingsRows(add);
    if (name === 'controls') this._controls(add);
    if (s.keys) { const g = this._el('div', 'esh-grid'); for (const [k, w] of v(s.keys)) g.append(this._el('kbd', '', k), this._el('span', '', w)); add(g); }
    for (const [h, t] of v(s.sections) || []) add(this._el('div', 'esh-k esh-sec', h), this._el('p', 'esh-m', t));
    if (s.stats) { const g = this._el('div', 'esh-stats'); for (const [val, lab] of v(s.stats)) { const c = this._el('div'); c.append(this._el('b', '', val), this._el('small', '', lab)); g.appendChild(c); } add(g); }
    if (s.medals) { const g = this._el('div'); for (const [lab, got] of v(s.medals)) g.appendChild(this._el('span', 'esh-med' + (got ? '' : ' off'), (got ? '✓ ' : '') + lab)); add(g); }
    if (name === 'map' && s.map) {
      const cv = this._el('canvas', 'esh-map'); cv.width = 720; cv.height = Math.round(720 * s.map.h / s.map.w); this._map(cv, s, true); add(cv);
      if (s.onPick) cv.onclick = e => { const b = cv.getBoundingClientRect(), t = cv._xf, x = ((e.clientX - b.left) * cv.width / b.width - t.ox) / t.k, y = ((e.clientY - b.top) * cv.height / b.height - t.oy) / t.k; s.onPick(x, y); this._map(cv, s, true); };
    }
    const acts = (name === 'pause' ? [['Resume', () => this.hide()]] : []).concat(v(s.actions) || [], name === 'pause' && this._std && v(this._game.o.menu && this._game.o.menu.items) || []).filter(Boolean);
    if (name === 'pause') this._pauseActs(acts);
    if (name === 'settings' && this._std) acts.push(['Controls', () => this.show('controls')], ['Restore defaults', () => { for (const g of SHELL_GROUPS.concat('Game')) this._game.settings.reset(g); this.show('settings'); }]);
    if (name === 'controls') acts.push(['Restore defaults', () => { this._game.input.resetBindings(); this._game.settings.reset('Controller'); this._game.settings.reset('Touch'); this._status = 'Every control is back to its default.'; this.show('controls'); }]);
    if (!acts.length && !title || name === 'settings' || name === 'controls') acts.push(['Back', () => this.back()]);
    const btns = this._el('div', 'esh-btns'), lists = name === 'settings' || name === 'controls'; acts.forEach((a, i) => btns.appendChild(this._btn(a, i, !lists))); add(btns);
    if (s.meta) { const g = this._el('div', 'esh-tags'); for (const t of v(s.meta)) g.appendChild(this._el('span', '', t)); add(g); }
    add(s.footer && this._el('div', 'esh-m', v(s.footer)));
    const keep = top.focus !== undefined ? top.focus : this._shown === top ? this._focusAt() : -1; this._shown = top;   // (redrawn in place: the focus stays where it was)
    // the way out, always in sight: close at the top right (where the menu button was), back at the top left over another
    // screen, and a sideways swipe goes back (a phone's edge swipe would leave the page)
    const nav = [];
    if (!title) nav.push(this._navBtn('x', 'Close', 'M6 6l12 12M18 6L6 18', () => this._close()));
    if (this._stack.length > 1) nav.push(this._navBtn('bk', 'Back', 'M15 5l-7 7 7 7', () => this.back()));
    this._swipe(sh, box, title);
    this._els.scr.replaceChildren(sh, ...nav);
    const all = this._focusables(), f = all[keep] || (name === 'settings' || name === 'controls' ? null : sh.querySelector('button.pri:not(:disabled)')) || all[0];
    top.focus = undefined; if (f) { f.focus({ preventScroll: true }); if (f.scrollIntoView) f.scrollIntoView({ block: 'nearest' }); }
  }
  /** the standard pause screen's buttons after Resume and the game's own: Settings, Controls, Full screen, Help, Save
   *  session (while the page is recorded: E.session), Quit */
  _pauseActs(acts) {
    const g = this._game, fs = g.fullscreen, M = g.o.menu || {}, quit = M.quit === false ? null : M.quit || 'title', help = this._o.screens && this._o.screens.help;
    if (this._std || this._items().length) acts.push(['Settings', () => this.show('settings')]);
    if (!this._std) { if (help) acts.push(['Help', () => this.show('help')]); return; }
    acts.push(['Controls', () => this.show('controls')]);
    if (g.o.fullscreen !== false && fs.supported && !fs.standalone) acts.push([fs.on ? 'Leave full screen' : 'Full screen', () => { fs.toggle(); }]);
    if (help) acts.push(['Help', () => this.show('help')]);
    // a recorded page (?record=1) saves its session from the menu: a phone has no console (the share sheet, or a download).
    // Its replay has the button too (doing nothing): the recorded tap on it lands on it, not on the next one (Quit)
    if (E.session && (E.session.recording || E.session.replaying)) acts.push(['Save session', () => { if (E.session.recording) E.session.share(); }]);
    if (quit && g.scenes && g.scenes[quit] && g.sceneName !== quit) acts.push(['Quit to ' + (quit === 'title' ? 'title' : actionName(quit).toLowerCase()), () => this.show('confirm', { kicker: 'Quit', title: 'Leave this game?', text: 'Progress since the last save is lost.',
      actions: [{ label: 'Keep playing', fn: () => this.back() }, { label: 'Quit', fn: () => { this.hide(); g.go(quit); } }] })]);
  }
  /** draw a TileMap from above: floor, roofs by height, water and grass, then markers and the body at (an arrow) */
  _map(cv, s, large) {
    const m = s.map, g = cv.getContext('2d'), W = cv.width, H = cv.height, T = m.T, ww = m.w * T, hh = m.h * T, pad = large ? 22 : 8;
    const k = Math.min((W - pad * 2) / ww, (H - pad * 2) / hh), ox = (W - ww * k) / 2, oy = (H - hh * k) / 2, P = (x, y) => [ox + x * k, oy + y * k];
    cv._xf = { k, ox, oy };
    if (!m._shellBase || m._shellBase.v !== m.version || m._shellBase.w !== W) {   // the cells, cached until the map changes
      const b = mkCanvas(W, H), bg = ctx2d(b); bg.fillStyle = '#121b1d'; bg.fillRect(0, 0, W, H);
      let top = 1; for (let cy = 0; cy < m.h; cy++) for (let cx = 0; cx < m.w; cx++) top = Math.max(top, m.height(cx, cy));
      for (let cy = 0; cy < m.h; cy++) for (let cx = 0; cx < m.w; cx++) {
        const c = m.cell(cx, cy), tag = m.floorAt((cx + .5) * T, (cy + .5) * T);
        bg.fillStyle = c > 0 ? mix('#4a5650', '#d2c296', m.height(cx, cy) / top) : tag === 'water' || tag === 'lava' ? (tag === 'water' ? '#1d3e56' : '#6a2a1a') : tag === 'grass' ? '#29452f' : '#1f2b2c';
        bg.fillRect(Math.floor(ox + cx * T * k), Math.floor(oy + cy * T * k), Math.ceil(T * k), Math.ceil(T * k));
      }
      m._shellBase = { v: m.version, w: W, cv: b };
    }
    g.drawImage(m._shellBase.cv, 0, 0);
    g.textAlign = 'center'; g.font = (large ? 12 : 7) + 'px ' + (this._o.theme && this._o.theme.font || 'sans-serif');
    if (large) for (const [t, x, y] of s.labels || []) { g.fillStyle = '#cbbf9e'; g.fillText(t, ...P(x, y)); }
    for (const q of (typeof s.markers === 'function' ? s.markers() : s.markers) || []) {
      const [x, y] = P(q.x, q.y), r = (q.size || (large ? 6 : 3)); g.strokeStyle = g.fillStyle = q.color || '#ffe0a0'; g.lineWidth = large ? 2 : 1; g.beginPath();
      if (q.kind === 'diamond') { g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath(); g.stroke(); }
      else if (q.kind === 'cross') { g.moveTo(x - r, y); g.lineTo(x + r, y); g.moveTo(x, y - r); g.lineTo(x, y + r); g.stroke(); }
      else if (q.kind === 'ring') { g.arc(x, y, r, 0, TAU); g.stroke(); }
      else { g.arc(x, y, r * .7, 0, TAU); g.fill(); }
      if (large && q.label) { g.fillStyle = '#ebd3a0'; g.fillText(q.label, x, y + r + 13); }
    }
    if (s.at) {
      const [x, y] = P(s.at.x, s.at.y), a = s.at.facing || 0, r = large ? 9 : 5; g.fillStyle = '#f8efd0'; g.strokeStyle = '#10181a'; g.lineWidth = 1.5; g.beginPath();
      g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); g.lineTo(x + Math.cos(a + 2.45) * r * .8, y + Math.sin(a + 2.45) * r * .8); g.lineTo(x + Math.cos(a - 2.45) * r * .8, y + Math.sin(a - 2.45) * r * .8); g.closePath(); g.fill(); g.stroke();
    }
    g.fillStyle = '#b6c5b5'; g.textAlign = 'right'; g.fillText('N', W - (large ? 12 : 5), large ? 18 : 10);
  }
  /** each step (the game calls it after reading input): follow game.paused, time out the toast and the card, and while a
   *  screen is open, move the focus with the game's input and hold the rest of it back from the game */
  _step() {
    const g = this._game, I = g.input, now = g.real, sc = g.scene, play = !!sc && (!!sc.pausable || g.sceneName === 'main');
    const pause = this._pauseSpec() && (!this._sys || (g.pauseOverlay !== false && play));   // (the engine's own menu stays out of a game that draws its own pause)
    if (pause && g.paused && !this._stack.length) this.show('pause');
    if (!g.paused && this._stack.length && (this._ownPause || (pause && this._stack.some(t => t.name === 'pause')))) { this._stack.length = 0; this._ownPause = false; this._capEnd(); this._render(); }   // resumed from code
    if (this.root) {
      if (this._toastEnd && now > this._toastEnd) { this._els.toast.classList.remove('on'); this._toastEnd = 0; }
      if (this._tutEnd && now > this._tutEnd) this.tutorial(null);
      this.root.classList.toggle('esh-still', !!g.reduceMotion);
    }
    if (!this._stack.length) return;
    const keep = this._held; this._held = new Set();
    const has = a => !!I.map[a], confirm = has('confirm') && I.pressed('confirm'), cancel = has('cancel') && I.pressed('cancel'), closeAll = has('pause') && I.pressed('pause'), mv = I.move();
    const hit = ['up', 'down', 'left', 'right'].find(a => has(a) && I.pressed(a)), dir = Math.abs(mv[1]) > .5 ? (mv[1] < 0 ? 'up' : 'down') : Math.abs(mv[0]) > .5 ? (mv[0] < 0 ? 'left' : 'right') : null;
    for (const a in I.map) if (!keep.has(a)) I.suppress(a);   // the game doesn't see what the menu used
    if (this._cap) { this._capPad(); return; }   // binding: the next button is the answer, not a move in the menu
    if (!this.root) { if (cancel) this.back(); else if (closeAll) this.hide(); return; }
    if (hit) { this._dir = hit; this._dirT = now + .35; this._nav(hit); }   // a press (however short), then the held direction repeats
    else if (dir !== this._dir) { this._dir = dir; this._dirT = now + .35; if (dir) this._nav(dir); }
    else if (dir && now > this._dirT) { this._dirT = now + .09; this._nav(dir); }
    const f = document.activeElement, mine = f && this._els.scr.contains(f);
    if (confirm && mine && f.tagName === 'BUTTON') f.click();
    else if (cancel) this.back();
    else if (closeAll) this.hide();   // Start (or P) closes the whole menu; Escape and B go back one screen
  }
  /** binding a controller button: the first one pressed since binding began (Start cancels) */
  _capPad() {
    const c = this._cap, I = this._game.input; if (!c || c.device !== 'pad') return;
    const i = I.padPrev.findIndex((on, k) => on && !c.prev[k]); c.prev = I.padPrev.slice();
    if (i === 9) this._capEnd('Not changed.'); else if (i >= 0) this._capBind('Pad' + i);
  }
  /** move the focus (or turn a focused slider or choice), keeping it in view */
  _nav(dir) {
    const all = this._focusables(); if (!all.length) return;
    const f = document.activeElement, i = all.indexOf(f), side = dir === 'left' || dir === 'right', d = dir === 'up' || dir === 'left' ? -1 : 1;
    if (f && side && f.type === 'range') { if (d < 0) f.stepDown(); else f.stepUp(); f.dispatchEvent(new Event('input')); return; }
    if (f && side && f._cycle) { f._cycle(d); return; }
    const n = all[((i < 0 ? 0 : i + d) + all.length) % all.length]; n.focus({ preventScroll: true }); if (n.scrollIntoView) n.scrollIntoView({ block: 'nearest' });
  }
}
E.Shell = Shell;

/* =============================================================================
 * 22. GPU LIGHTING (WebGPU)  optional. game.enableGPU({ map }) turns it on.
 *    The Canvas renderer still draws every color. Alongside it, it writes an
 *    "info" image (height, surface type, glow per pixel). The GPU then lights each
 *    pixel: colored point lights, soft shadows marched through a heightmap of the
 *    level, light wrapping around characters (normals from their silhouettes),
 *    glow spilling onto nearby surfaces, dithered light bands, and heat shimmer.
 *    If WebGPU is missing or fails, the game keeps the Canvas lighting.
 * ============================================================================= */
const WGSL_COMMON = /* wgsl */`
struct Params {
  a: vec4f, b: vec4f, c: vec4f, camv: vec4f,
  right: vec4f, up: vec4f, amb: vec4f, fx: vec4f,
  mapd: vec4f, scr: vec4f, scr2: vec4f, bufd: vec4f,
  nheat: vec4f, p0: vec4f, p1: vec4f, p2: vec4f,
  lights: array<vec4f, 64>,
  heat: array<vec4f, 8>,
};
@group(0) @binding(0) var<uniform> U: Params;
@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  return vec4f(p[i], 0.0, 1.0);
}
fn bayer(p: vec2i) -> f32 {
  var m = array<f32, 16>(0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  let x = ((p.x % 4) + 4) % 4;
  let y = ((p.y % 4) + 4) % 4;
  return (m[y * 4 + x] + 0.5) / 16.0;
}
`;
const WGSL_LIGHT = /* wgsl */`
@group(0) @binding(1) var albedoT: texture_2d<f32>;
@group(0) @binding(2) var infoT: texture_2d<f32>;
@group(0) @binding(3) var hmT: texture_2d<f32>;
fn clsOf(v: vec4f) -> i32 { return i32(round(v.g * 12.75)); }
fn zOf(v: vec4f) -> f32 { return v.r * 85.0; }
fn hmAt(q: vec2f) -> f32 {
  let d = vec2i(U.mapd.xy);
  let t = clamp(vec2i(floor(q * U.fx.w)), vec2i(0, 0), d - vec2i(1, 1));
  return textureLoad(hmT, t, 0).r * 85.0;
}
fn shadowAt(p: vec3f, l: vec3f) -> f32 {
  let d = l.xy - p.xy;
  let D = length(d);
  if (D < 2.0) { return 1.0; }
  let n = clamp(i32(D * 0.5), 4, 48);
  let t0 = min(0.9, 4.5 / D);
  var s = 1.0;
  for (var k = 0; k < n; k++) {
    let t = mix(t0, 0.97, (f32(k) + 0.5) / f32(n));
    let rz = mix(p.z, l.z, t);
    let h = hmAt(p.xy + d * t);
    let occ = clamp((h - rz) / (0.8 + t * D * 0.05), 0.0, 1.0);
    s = min(s, 1.0 - occ);
    if (s <= 0.0) { break; }
  }
  return s;
}
@fragment fn fsLight(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let pix = vec2i(floor(fc.xy));
  let dims = vec2i(U.bufd.xy);
  let alb = textureLoad(albedoT, pix, 0);
  let inf = textureLoad(infoT, pix, 0);
  let cl = clsOf(inf);
  let wpx = pix + vec2i(i32(U.c.z), i32(U.c.w));
  let dth = bayer(wpx);
  let bands = U.up.w;

  // glow from nearby emissive pixels: lights neighbours and adds a pixel bloom
  var spill = vec3f(0.0);
  var near = vec3f(0.0);
  var rad = array<f32, 5>(3.0, 7.0, 12.0, 19.0, 28.0);
  var wt = array<f32, 5>(0.28, 0.2, 0.14, 0.09, 0.06);
  for (var ri = 0; ri < 5; ri++) {
    for (var k = 0; k < 8; k++) {
      let a = f32(k) * 0.7853982 + f32(ri) * 0.39;
      let q = clamp(pix + vec2i(round(vec2f(cos(a), sin(a)) * rad[ri])), vec2i(0, 0), dims - vec2i(1, 1));
      let e = textureLoad(infoT, q, 0).b;
      if (e > 0.02) { let c = textureLoad(albedoT, q, 0).rgb * e * wt[ri]; spill += c; if (ri < 2) { near += c; } }
    }
  }
  // bloom only from the closest rings, so glows stay tight and pixel-crisp
  let glow = floor(near * U.fx.y * bands + dth) / bands;
  if (cl == 0) { return vec4f(min(alb.rgb + glow, vec3f(1.0)), 1.0); }

  // rebuild the world position of this pixel from its height
  let z = zOf(inf);
  let sx = f32(wpx.x) + 0.5;
  let sy = f32(wpx.y) + 0.5 - U.b.x * z;
  let wp = vec3f(U.b.y * sx + U.b.z * sy, U.b.w * sx + U.c.x * sy, z);

  // surface normal: floors and tops face up, wall faces by class, characters from their silhouette
  var n = vec3f(0.0, 0.0, 1.0);
  if (cl == 5) { n = vec3f(1.0, 0.0, 0.0); }
  else if (cl == 6) { n = vec3f(-1.0, 0.0, 0.0); }
  else if (cl == 7) { n = vec3f(0.0, 1.0, 0.0); }
  else if (cl == 8) { n = vec3f(0.0, -1.0, 0.0); }
  else if (cl == 10) {
    var gs = vec2f(0.0);
    for (var dy = -3; dy <= 3; dy++) {
      for (var dx = -3; dx <= 3; dx++) {
        if (dx == 0 && dy == 0) { continue; }
        let q = clamp(pix + vec2i(dx, dy), vec2i(0, 0), dims - vec2i(1, 1));
        if (clsOf(textureLoad(infoT, q, 0)) != 10) { gs += vec2f(f32(dx), f32(dy)) / f32(dx * dx + dy * dy); }
      }
    }
    let gl = length(gs);
    var ns = vec3f(0.0, 0.0, 1.0);
    if (gl > 0.001) { let e = clamp(gl * 0.5, 0.0, 0.92); let dd = gs / gl; ns = vec3f(dd.x * e, -dd.y * e, sqrt(1.0 - e * e)); }
    n = normalize(U.right.xyz * ns.x + U.up.xyz * ns.y + U.camv.xyz * ns.z);
  }

  // soft sky ambient: up-facing surfaces catch a little more than walls.
  // characters get extra fill and wrap so they stay readable when backlit.
  let actor = cl == 10;
  let wrap = select(U.amb.w, 0.85, actor);
  var light = U.amb.rgb * (0.8 + 0.4 * max(n.z, 0.0)) * select(1.0, 1.7, actor);
  let nl = i32(U.right.w);
  for (var i = 0; i < nl; i++) {
    let lp = U.lights[i * 2];
    let lc = U.lights[i * 2 + 1];
    let d = lp.xyz - wp;
    let dist = length(d);
    if (dist >= lp.w) { continue; }
    let att = 1.0 - dist * dist / (lp.w * lp.w);
    let ndl = dot(n, d / max(dist, 0.001));
    let diff = clamp((ndl + wrap) / (1.0 + wrap), 0.0, 1.0);
    var sh = 1.0;
    if (lc.w > 0.0 && U.fx.z > 0.5) { sh = shadowAt(wp, lp.xyz); }
    light += lc.rgb * abs(lc.w) * att * diff * sh;
  }
  light += spill * U.fx.x;

  // snap light to dithered bands so it stays pixel art
  let lum = max(light.r, max(light.g, light.b));
  let q = floor(lum * bands + dth) / bands;
  let lq = light * (q / max(lum, 0.0001));
  let col = alb.rgb * max(lq, vec3f(inf.b * 1.15)) + glow;
  return vec4f(min(col, vec3f(1.0)), 1.0);
}
`;
const WGSL_FINAL = /* wgsl */`
@group(0) @binding(1) var litT: texture_2d<f32>;
@group(0) @binding(2) var ovT: texture_2d<f32>;
@fragment fn fsFinal(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let p = fc.xy;
  if (p.x < U.scr2.x || p.y < U.scr2.y || p.x >= U.scr2.z || p.y >= U.scr2.w) { return vec4f(0.0, 0.0, 0.0, 1.0); }
  let b = floor((p - U.scr.yz) / U.scr.x);
  let dims = vec2i(U.bufd.xy);
  var t = vec2i(b);
  // heat shimmer: whole-pixel sideways offsets above hot things
  var off = 0.0;
  let nh = i32(U.nheat.x);
  for (var i = 0; i < nh; i++) {
    let h = U.heat[i];
    let dy = h.y - b.y;
    let dx = b.x - h.x;
    if (dy > -2.0 && dy < h.z * 1.8 && abs(dx) < h.z) {
      let f = (1.0 - abs(dx) / h.z) * clamp((dy + 2.0) / 5.0, 0.0, 1.0) * (1.0 - dy / (h.z * 1.8));
      off += sin((b.y + U.c.w) * 0.85 + U.camv.w * 10.0 + h.x * 0.37) * h.w * f;
    }
  }
  let wpx = t + vec2i(i32(U.c.z), i32(U.c.w));
  t.x += i32(floor(off + bayer(wpx)));
  t = clamp(t, vec2i(0, 0), dims - vec2i(1, 1));
  let lit = textureLoad(litT, t, 0).rgb;
  let ov = textureLoad(ovT, clamp(vec2i(b), vec2i(0, 0), dims - vec2i(1, 1)), 0);
  return vec4f(mix(lit, ov.rgb, ov.a), 1.0);
}
`;
class GPULighting {
  /** game.enableGPU({ map, bands, ambient, ... }) makes it: per-pixel WebGPU lighting with shadows and glow, falling back to
   *  the canvas lighting where there is no WebGPU */
  constructor(game, o = {}) {
    /** enabled: false switches it off for now (the canvas lighting takes over); ready: true once the GPU is set up;
     *  failed: why it couldn't start, or null; bands: how many light bands (fewer is more retro); wrap: how far
     *  light wraps round wall corners, 0..1; ambient: the unlit color, [r, g, b] 0..1; spill: how far light spills
     *  past its radius; glow: the strength of px.glow surfaces; shadows: casters block light; map: the TileMap it
     *  measures walls on; onStatus: called (gpu) when its status changes; offscreen: render into a texture instead
     *  of the page (automated tests; read it with snapshot()) */
    Object.assign(this, { enabled: true, ready: false, failed: null, bands: 6, wrap: .45, ambient: [.07, .07, .12], spill: 1.1, glow: .22, shadows: true, map: null, onStatus: null, offscreen: false }, o);
    /** game: its game */
    this._game = game; this._u = new Float32Array(352); this._colors = {};
    /** cv: the canvas it draws on, laid over the game's */
    this._cv = document.createElement('canvas');
    this._cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:none;pointer-events:none;image-rendering:pixelated';
    game.screen.canvas.insertAdjacentElement('afterend', this._cv);
    /** loading: true while it starts up */
    this._loading = true;
    this._init();
  }
  /** true where the browser has WebGPU */
  static supported() { return typeof navigator !== 'undefined' && !!navigator.gpu; }
  /** 'loading' | 'on' | 'off' | 'unavailable' */
  status() { return this.failed ? 'unavailable' : this._loading ? 'loading' : this.enabled ? 'on' : 'off'; }
  /** true when it lights frames in this view (ready, enabled and a ground view) */
  active(view) { return this.ready && this.enabled && !!view.inv; }
  /** show or hide its canvas */
  _show(on) { const d = on && !this.offscreen ? 'block' : 'none'; if (this._cv.style.display !== d) this._cv.style.display = d; }
  /** offscreen mode only: read the last frame back as a PNG data URL */
  async snapshot() {
    const t = this._outT; if (!t) return null;
    const w = t.width, h = t.height, bpr = Math.ceil(w * 4 / 256) * 256, dev = this._dev;
    const buf = dev.createBuffer({ size: bpr * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const enc = dev.createCommandEncoder(); enc.copyTextureToBuffer({ texture: t }, { buffer: buf, bytesPerRow: bpr }, [w, h]); dev.queue.submit([enc.finish()]);
    await buf.mapAsync(GPUMapMode.READ);
    const src = new Uint8Array(buf.getMappedRange()), c = mkCanvas(w, h), g = c.getContext('2d'), img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) img.data.set(src.subarray(y * bpr, y * bpr + w * 4), y * w * 4);
    buf.unmap(); buf.destroy(); g.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  }
  /** give up on the GPU (an error): the canvas lighting takes over */
  _fail(e) { this.failed = (e && e.message) || String(e); this.ready = false; this._loading = false; this._show(false); if (this.onStatus) this.onStatus(this); console.warn('my-3D2dge GPU lighting disabled:', this.failed); }
  async _init() {
    try {
      if (!navigator.gpu) throw new Error('WebGPU is not available in this browser');
      const ad = await navigator.gpu.requestAdapter();
      if (!ad) throw new Error('No compatible GPU was found');
      /** adapterInfo: the GPU's description from the browser (vendor, architecture), or null */
      this._adapter = ad; this.adapterInfo = ad.info || null;
      const dev = await ad.requestDevice(); this._dev = dev;
      dev.lost.then(i => { if (!this.failed) this._fail(new Error('GPU device lost: ' + i.message)); });
      dev.addEventListener('uncapturederror', ev => this._fail(ev.error));
      if (this.offscreen) this._fmt = 'rgba8unorm';
      else { this._gctx = this._cv.getContext('webgpu'); this._fmt = navigator.gpu.getPreferredCanvasFormat(); this._gctx.configure({ device: dev, format: this._fmt, alphaMode: 'opaque' }); }
      this._ubuf = dev.createBuffer({ size: this._u.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      dev.pushErrorScope('validation');
      const m1 = dev.createShaderModule({ code: WGSL_COMMON + WGSL_LIGHT }), m2 = dev.createShaderModule({ code: WGSL_COMMON + WGSL_FINAL });
      for (const m of [m1, m2]) { const info = await m.getCompilationInfo(); const err = info.messages.find(x => x.type === 'error'); if (err) throw new Error('Shader: ' + err.message + ' (line ' + err.lineNum + ')'); }
      const pipe = (m, fs, format) => dev.createRenderPipeline({ layout: 'auto', vertex: { module: m, entryPoint: 'vs' }, fragment: { module: m, entryPoint: fs, targets: [{ format }] }, primitive: { topology: 'triangle-list' } });
      this._pLight = pipe(m1, 'fsLight', 'rgba8unorm'); this._pFinal = pipe(m2, 'fsFinal', this._fmt);
      const err = await dev.popErrorScope(); if (err) throw new Error(err.message);
      this.ready = true;
    } catch (e) { this.failed = e.message || String(e); console.warn('my-3D2dge GPU lighting unavailable:', this.failed); }
    this._loading = false;
    if (this.onStatus) this.onStatus(this);
  }
  _tex(w, h, format, usage) { return this._dev.createTexture({ size: [w, h], format, usage }); }
  _ensure(bw, bh, hmW, hmH) {
    const U = GPUTextureUsage;
    if (this._bw !== bw || this._bh !== bh) {
      for (const t of [this._albedoT, this._infoT, this._ovT, this._litT]) if (t) t.destroy();
      const up = U.TEXTURE_BINDING | U.COPY_DST | U.RENDER_ATTACHMENT;
      this._albedoT = this._tex(bw, bh, 'rgba8unorm', up); this._infoT = this._tex(bw, bh, 'rgba8unorm', up); this._ovT = this._tex(bw, bh, 'rgba8unorm', up);
      this._litT = this._tex(bw, bh, 'rgba8unorm', U.TEXTURE_BINDING | U.RENDER_ATTACHMENT);
      /** bw, bh: the size of the buffer it lights */
      this._bw = bw; this._bh = bh; this._bgL = null;
    }
    if (this._hmW !== hmW || this._hmH !== hmH) {
      if (this._hmT) this._hmT.destroy();
      this._hmT = this._tex(hmW, hmH, 'r8unorm', U.TEXTURE_BINDING | U.COPY_DST);
      this._hmData = new Uint8Array(hmW * hmH); this._hmW = hmW; this._hmH = hmH; this._hmKey = null; this._bgL = null;
    }
    if (!this._bgL) {
      const d = this._dev, B = (t) => t.createView();
      this._bgL = d.createBindGroup({ layout: this._pLight.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: this._ubuf } }, { binding: 1, resource: B(this._albedoT) }, { binding: 2, resource: B(this._infoT) }, { binding: 3, resource: B(this._hmT) }] });
      this._bgF = d.createBindGroup({ layout: this._pFinal.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: this._ubuf } }, { binding: 1, resource: B(this._litT) }, { binding: 2, resource: B(this._ovT) }] });
    }
  }
  /** heightmap of the level (1 texel per world unit): walls from the map plus this frame's casters */
  _heightmap(view) {
    const m = this.map, W = this._hmW, H = this._hmH, key = view.id + ':' + (m ? m.version : 0);
    if (this._hmKey !== key) {
      this._hmStatic = new Uint8Array(W * H);
      if (m) for (let cy = 0; cy < m.h; cy++) for (let cx = 0; cx < m.w; cx++) {
        const id = m.cell(cx, cy); if (id <= 0) continue;
        const t = m.types[id], h = m._isFront(cx, cy, view) ? (t.cutH || 6) : t.h, v = Math.min(255, Math.round(h * 3));
        for (let y = cy * m.T; y < (cy + 1) * m.T; y++) this._hmStatic.fill(v, y * W + cx * m.T, y * W + (cx + 1) * m.T);
      }
      this._hmKey = key;
    }
    const d = this._hmData; d.set(this._hmStatic);
    for (const c of this._game.lights._casters) {
      const v = Math.min(255, Math.round(c.top * 3)), r2 = c.r * c.r;
      const x0 = Math.max(0, Math.floor(c.x - c.r)), x1 = Math.min(W - 1, Math.ceil(c.x + c.r)), y0 = Math.max(0, Math.floor(c.y - c.r)), y1 = Math.min(H - 1, Math.ceil(c.y + c.r));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const dx = x + .5 - c.x, dy = y + .5 - c.y; if (dx * dx + dy * dy <= r2) { const k = y * W + x; if (d[k] < v) d[k] = v; } }
    }
    this._dev.queue.writeTexture({ texture: this._hmT }, d, { bytesPerRow: W }, [W, H]);
  }
  _color(c) {
    if (!c) return [1, .9, .75];
    if (typeof c !== 'string') return c;
    return this._colors[c] || (this._colors[c] = hex(c).map(v => v / 255));
  }
  /** light and present the frame (the renderer calls it when active) */
  _render(r) {
    // never queue more than two frames: a slow GPU drops frames instead of building up lag
    if ((this._inflight || 0) >= 2) { this.skipped = (this.skipped || 0) + 1; return; }
    const game = this._game, sc = game.screen, view = r.view, dev = this._dev, bw = r.bw, bh = r.bh, m = this.map;
    if (this._cv.width !== sc.canvas.width || this._cv.height !== sc.canvas.height) { this._cv.width = sc.canvas.width; this._cv.height = sc.canvas.height; }
    this._ensure(bw, bh, m ? m.w * m.T : 1, m ? m.h * m.T : 1);
    this._heightmap(view);
    dev.queue.copyExternalImageToTexture({ source: sc.buf }, { texture: this._albedoT }, [bw, bh]);
    dev.queue.copyExternalImageToTexture({ source: r._iCv }, { texture: this._infoT }, [bw, bh]);
    dev.queue.copyExternalImageToTexture({ source: r._vCv }, { texture: this._ovT, premultipliedAlpha: false }, [bw, bh]);
    const u = this._u, inv = view.inv, S = sc.S, sc_ = view.scale;
    const Rw = [view.ax / sc_, view.ay / sc_, 0], Cw = [view.dx, view.dy, view.dz];
    const Uw = [Rw[1] * Cw[2] - Rw[2] * Cw[1], Rw[2] * Cw[0] - Rw[0] * Cw[2], Rw[0] * Cw[1] - Rw[1] * Cw[0]];
    u.fill(0);
    const L = game.lights.list; let n = 0;
    for (const l of L) {
      if (n >= 32) break; if (!(l.i > 0)) continue;
      const c = this._color(l.color), b = 64 + n * 8;
      u[b] = l.x; u[b + 1] = l.y; u[b + 2] = l.z; u[b + 3] = l.r; u[b + 4] = c[0]; u[b + 5] = c[1]; u[b + 6] = c[2]; u[b + 7] = l.shadow ? l.i : -l.i; n++;
    }
    let nh = 0;
    for (const h of game.lights._heats) { if (nh >= 8) break; const [x, y] = r.w(h.x, h.y, h.z), b = 320 + nh * 4; u[b] = x; u[b + 1] = y; u[b + 2] = h.w * sc_; u[b + 3] = h.s; nh++; }
    u.set([view.ax, view.ay, view.bx, view.by], 0);
    u.set([view.bz, inv[0], inv[1], inv[2]], 4);
    u.set([inv[3], sc_, r.ix, r.iy], 8);
    u.set([Cw[0], Cw[1], Cw[2], game.time], 12);
    u.set([Rw[0], Rw[1], Rw[2], n], 16);
    u.set([Uw[0], Uw[1], Uw[2], this.bands], 20);
    u.set([this.ambient[0], this.ambient[1], this.ambient[2], this.wrap], 24);
    u.set([this.spill, this.glow, this.shadows ? 1 : 0, 1], 28);
    u.set([this._hmW, this._hmH, 0, 0], 32);
    u.set([S, sc.OX - Math.round(sc.fx * S), sc.OY - Math.round(sc.fy * S), 0], 36);
    u.set([sc.OX, sc.OY, sc.OX + sc.W * S, sc.OY + sc.H * S], 40);
    u.set([bw, bh, sc.W, sc.H], 44);
    u.set([nh, 0, 0, 0], 48);
    dev.queue.writeBuffer(this._ubuf, 0, u);
    const enc = dev.createCommandEncoder();
    let pass = enc.beginRenderPass({ colorAttachments: [{ view: this._litT.createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }] });
    pass.setPipeline(this._pLight); pass.setBindGroup(0, this._bgL); pass.draw(3); pass.end();
    let target;
    if (this.offscreen) {
      const w = this._cv.width, h = this._cv.height;
      if (!this._outT || this._outT.width !== w || this._outT.height !== h) { if (this._outT) this._outT.destroy(); this._outT = this._tex(w, h, 'rgba8unorm', GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC); }
      target = this._outT.createView();
    } else target = this._gctx.getCurrentTexture().createView();
    pass = enc.beginRenderPass({ colorAttachments: [{ view: target, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }] });
    pass.setPipeline(this._pFinal); pass.setBindGroup(0, this._bgF); pass.draw(3); pass.end();
    dev.queue.submit([enc.finish()]);
    /** frames: frames it has lit */
    this._inflight = (this._inflight || 0) + 1; this._frames = (this._frames || 0) + 1;
    dev.queue.onSubmittedWorkDone().then(() => { this._inflight--; });
  }
}

/* =============================================================================
 * 23. SESSIONS  record a play session on any device, replay it exactly in a headless browser
 *    E.session.record(true) (or ?record=1 for one load) records from the next page load on, starting before the game's
 *    code, so it sees all the game sees: a seed for Math.random, every display frame's time (performance.now and
 *    Date.now read that time during the frame), every input event and the frame it arrived before (keys, pointer,
 *    wheel, clicks and form edits, focus, visibility, resize, full screen), gamepad readings, the media queries the game
 *    asked, the safe-area insets, the screen's size and the save (localStorage) at the start, plus a checksum every 60
 *    frames. E.session.save() returns it as JSON; E.session.share() hands it to the phone's share sheet (or downloads
 *    it). node tools/replay.mjs session.json plays it back headless, frame by frame, and stops at the first checksum
 *    that differs; game.stateHash = () => [numbers] makes the checksum sharper. The engine's loop needs nothing else:
 *    the same frame times, inputs and seed give the same game (docs/DECISIONS.md, D12). Math.sin, cos, pow and the other
 *    functions browsers may round differently are replaced by portable ones while recording and replaying, so a session
 *    from an iPhone's Safari replays in Chromium bit for bit (D15).
 *    While recording, GPU lighting stays off (it starts up on real time) and update/draw timings read 0 ms. A recording
 *    starts when the page has loaded, as a replay does: frames wait for it, and the person's inputs before it are held back.
 * ============================================================================= */
/** sin, cos, tan, atan, atan2, asin, acos, exp, log, log2, log10, pow, hypot and cbrt from exact operations only, the
 *  same bits in every browser (fdlibm 5.3's algorithms and constants for sin, cos, atan, atan2, exp and log) */
const PORTABLE_MATH = (() => {
  const N = { pow: Math.pow, sqrt: Math.sqrt }, F = new Float64Array(1), U = new Uint32Array(F.buffer);
  const H = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1 ? 1 : 0, L = 1 - H;   // which word is high (little-endian: 1)
  const hi = x => { F[0] = x; return U[H] | 0; }, lo = x => { F[0] = x; return U[L]; };
  const make = (h, l) => { U[H] = h >>> 0; U[L] = l >>> 0; return F[0]; }, withHi = (x, h) => { F[0] = x; U[H] = h >>> 0; return F[0]; };
  // sin and cos: reduce to [-pi/4, pi/4] (Cody-Waite, up to three steps), then the kernels
  const S1 = -1.66666666666666324348e-01, S2 = 8.33333333332248946124e-03, S3 = -1.98412698298579493134e-04, S4 = 2.75573137070700676789e-06, S5 = -2.50507602534068634195e-08, S6 = 1.58969099521155010221e-10;
  const C1 = 4.16666666666666019037e-02, C2 = -1.38888888888741095749e-03, C3 = 2.48015872894767294178e-05, C4 = -2.75573143513906633035e-07, C5 = 2.08757232129817482790e-09, C6 = -1.13596475577881948265e-11;
  const kSin = (x, y, iy) => {
    if ((hi(x) & 0x7fffffff) < 0x3e400000 && (x | 0) === 0) return x;
    const z = x * x, v = z * x, r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)));
    return iy === 0 ? x + v * (S1 + z * r) : x - ((z * (.5 * y - v * r) - y) - v * S1);
  };
  const kCos = (x, y) => {
    const ix = hi(x) & 0x7fffffff;
    if (ix < 0x3e400000 && (x | 0) === 0) return 1;
    const z = x * x, r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
    if (ix < 0x3fd33333) return 1 - (.5 * z - (z * r - x * y));
    const qx = ix > 0x3fe90000 ? .28125 : make(ix - 0x00200000, 0), hz = .5 * z - qx, a = 1 - qx;
    return a - (hz - (z * r - x * y));
  };
  const invpio2 = 6.36619772367581382433e-01, pio2_1 = 1.57079632673412561417e+00, pio2_1t = 6.07710050650619224932e-11, pio2_2 = 6.07710050630396597660e-11,
    pio2_2t = 2.02226624879595063154e-21, pio2_3 = 2.02226624871116645580e-21, pio2_3t = 8.47842766036889956997e-32;
  const NPIO2 = [0x3FF921FB, 0x400921FB, 0x4012D97C, 0x401921FB, 0x401F6A7A, 0x4022D97C, 0x4025FDBB, 0x402921FB, 0x402C463A, 0x402F6A7A, 0x4031475C, 0x4032D97C, 0x40346B9C, 0x4035FDBB, 0x40378FDB, 0x403921FB,
    0x403AB41B, 0x403C463A, 0x403DD85A, 0x403F6A7A, 0x40407E4C, 0x4041475C, 0x4042106C, 0x4042D97C, 0x4043A28C, 0x40446B9C, 0x404534AC, 0x4045FDBB, 0x4046C6CB, 0x40478FDB, 0x404858EB, 0x404921FB];
  const Y = [0, 0];
  /** x = n * pi/2 + Y[0] + Y[1]; returns n. Beyond 2^19 pi/2 (fdlibm's own reduction ends there and turns to a 1,200-bit
   *  2/pi) n is split in two halves whose products stay exact, good to about 1e12; past that any angle in range will do */
  const remPio2 = x => {
    const hx = hi(x), ix = hx & 0x7fffffff;
    if (ix <= 0x3fe921fb) { Y[0] = x; Y[1] = 0; return 0; }   // |x| <= pi/4 already
    if (ix > 0x413921fb) {
      let t = hx < 0 ? -x : x, n;
      if (t >= 1.7e12) { t -= Math.floor(t / 6.283185307179586) * 6.283185307179586; n = remPio2(t); }
      else {
        const fn = Math.floor(t * invpio2 + .5), f0 = fn % 1048576, f1 = fn - f0;
        let r = (t - f1 * pio2_1) - f0 * pio2_1; r = (r - f1 * pio2_2) - f0 * pio2_2;
        const w = (f1 * pio2_3 + f0 * pio2_3) + fn * pio2_3t;
        Y[0] = r - w; Y[1] = (r - Y[0]) - w; n = fn % 4;
      }
      if (hx < 0) { Y[0] = -Y[0]; Y[1] = -Y[1]; return -n; }
      return n;
    }
    if (ix < 0x4002d97c) {   // |x| < 3pi/4: n = +-1
      if (hx > 0) { let z = x - pio2_1; if (ix !== 0x3ff921fb) { Y[0] = z - pio2_1t; Y[1] = (z - Y[0]) - pio2_1t; } else { z -= pio2_2; Y[0] = z - pio2_2t; Y[1] = (z - Y[0]) - pio2_2t; } return 1; }
      let z = x + pio2_1; if (ix !== 0x3ff921fb) { Y[0] = z + pio2_1t; Y[1] = (z - Y[0]) + pio2_1t; } else { z += pio2_2; Y[0] = z + pio2_2t; Y[1] = (z - Y[0]) + pio2_2t; } return -1;
    }
    const t0 = hx < 0 ? -x : x, fn = (t0 * invpio2 + .5) | 0, n = fn;
    let r = t0 - fn * pio2_1, w = fn * pio2_1t;
    if (n < 32 && ix !== NPIO2[n - 1]) Y[0] = r - w;
    else {
      const j = ix >> 20; Y[0] = r - w;
      let i = j - ((hi(Y[0]) >> 20) & 0x7ff);
      if (i > 16) {
        let t = r; w = fn * pio2_2; r = t - w; w = fn * pio2_2t - ((t - r) - w); Y[0] = r - w;
        i = j - ((hi(Y[0]) >> 20) & 0x7ff);
        if (i > 49) { t = r; w = fn * pio2_3; r = t - w; w = fn * pio2_3t - ((t - r) - w); Y[0] = r - w; }
      }
    }
    Y[1] = (r - Y[0]) - w;
    if (hx < 0) { Y[0] = -Y[0]; Y[1] = -Y[1]; return -n; }
    return n;
  };
  const sin = x => {
    const ix = hi(x) & 0x7fffffff;
    if (ix <= 0x3fe921fb) return kSin(x, 0, 0);
    if (ix >= 0x7ff00000) return x - x;
    const n = remPio2(x) & 3;
    return n === 0 ? kSin(Y[0], Y[1], 1) : n === 1 ? kCos(Y[0], Y[1]) : n === 2 ? -kSin(Y[0], Y[1], 1) : -kCos(Y[0], Y[1]);
  };
  const cos = x => {
    const ix = hi(x) & 0x7fffffff;
    if (ix <= 0x3fe921fb) return kCos(x, 0);
    if (ix >= 0x7ff00000) return x - x;
    const n = remPio2(x) & 3;
    return n === 0 ? kCos(Y[0], Y[1]) : n === 1 ? -kSin(Y[0], Y[1], 1) : n === 2 ? -kCos(Y[0], Y[1]) : kSin(Y[0], Y[1], 1);
  };
  // atan and atan2
  const ATANHI = [4.63647609000806093515e-01, 7.85398163397448278999e-01, 9.82793723247329054082e-01, 1.57079632679489655800e+00];
  const ATANLO = [2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399573676603587e-17];
  const AT = [3.33333333333329318027e-01, -1.99999999998764832476e-01, 1.42857142725034663711e-01, -1.11111104054623557880e-01, 9.09088713343650656196e-02, -7.69187620504482999495e-02,
    6.66107313738753120669e-02, -5.83357013379057348645e-02, 4.97687799461593236017e-02, -3.65315727442169155270e-02, 1.62858201153657823623e-02];
  const atan = x0 => {
    let x = x0, id;
    const hx = hi(x), ix = hx & 0x7fffffff;
    if (ix >= 0x44100000) { if (x !== x) return x + x; return hx > 0 ? ATANHI[3] + ATANLO[3] : -ATANHI[3] - ATANLO[3]; }
    if (ix < 0x3fdc0000) { if (ix < 0x3e200000) return x; id = -1; }
    else {
      x = Math.abs(x);
      if (ix < 0x3ff30000) { if (ix < 0x3fe60000) { id = 0; x = (2 * x - 1) / (2 + x); } else { id = 1; x = (x - 1) / (x + 1); } }
      else if (ix < 0x40038000) { id = 2; x = (x - 1.5) / (1 + 1.5 * x); } else { id = 3; x = -1 / x; }
    }
    const z = x * x, w = z * z;
    const s1 = z * (AT[0] + w * (AT[2] + w * (AT[4] + w * (AT[6] + w * (AT[8] + w * AT[10]))))), s2 = w * (AT[1] + w * (AT[3] + w * (AT[5] + w * (AT[7] + w * AT[9]))));
    if (id < 0) return x - x * (s1 + s2);
    const r = ATANHI[id] - ((x * (s1 + s2) - ATANLO[id]) - x);
    return hx < 0 ? -r : r;
  };
  const PI = 3.1415926535897931160E+00, PI_LO = 1.2246467991473531772E-16, PI_2 = 1.5707963267948965580E+00, PI_4 = 7.8539816339744827900E-01;
  const neg = v => v < 0 || (v === 0 && 1 / v < 0);
  const atan2 = (y, x) => {
    if (x !== x || y !== y) return x + y;
    if (x === 1) return atan(y);
    const m = (neg(y) ? 1 : 0) | (neg(x) ? 2 : 0);
    if (y === 0) return m === 0 || m === 1 ? y : m === 2 ? PI : -PI;
    if (x === 0) return neg(y) ? -PI_2 : PI_2;
    if (x === Infinity || x === -Infinity) {
      if (y === Infinity || y === -Infinity) return m === 0 ? PI_4 : m === 1 ? -PI_4 : m === 2 ? 3 * PI_4 : -3 * PI_4;
      return m === 0 ? 0 : m === 1 ? -0 : m === 2 ? PI : -PI;
    }
    if (y === Infinity || y === -Infinity) return neg(y) ? -PI_2 : PI_2;
    const k = ((hi(y) & 0x7fffffff) - (hi(x) & 0x7fffffff)) >> 20;
    const z = k > 60 ? PI_2 + .5 * PI_LO : x < 0 && k < -60 ? 0 : atan(Math.abs(y / x));
    return m === 0 ? z : m === 1 ? -z : m === 2 ? PI - (z - PI_LO) : (z - PI_LO) - PI;
  };
  // exp and log
  const LN2HI = [6.93147180369123816490e-01, -6.93147180369123816490e-01], LN2LO = [1.90821492927058770002e-10, -1.90821492927058770002e-10], INVLN2 = 1.44269504088896338700e+00;
  const P1 = 1.66666666666666019037e-01, P2 = -2.77777777770155933842e-03, P3 = 6.61375632143793436117e-05, P4 = -1.65339022054652515390e-06, P5 = 4.13813679705723846039e-08, TWOM1000 = 9.33263618503218878990e-302;
  const exp = x0 => {
    let x = x0, k = 0, hiP = 0, loP = 0;
    const h = hi(x), xsb = (h >>> 31) & 1, hx = h & 0x7fffffff;
    if (hx >= 0x40862E42) {
      if (hx >= 0x7ff00000) return x !== x ? x + x : xsb === 0 ? x : 0;
      if (x > 7.09782712893383973096e+02) return Infinity;
      if (x < -7.45133219101941108420e+02) return 0;
    }
    if (hx > 0x3fd62e42) {
      if (hx < 0x3FF0A2B2) { hiP = x - LN2HI[xsb]; loP = LN2LO[xsb]; k = 1 - xsb - xsb; }
      else { k = (INVLN2 * x + (xsb ? -.5 : .5)) | 0; hiP = x - k * LN2HI[0]; loP = k * LN2LO[0]; }
      x = hiP - loP;
    } else if (hx < 0x3e300000) return 1 + x;
    const t = x * x, c = x - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
    if (k === 0) return 1 - ((x * c) / (c - 2) - x);
    const y = 1 - ((loP - (x * c) / (2 - c)) - hiP);
    return k >= -1021 ? withHi(y, hi(y) + (k << 20)) : withHi(y, hi(y) + ((k + 1000) << 20)) * TWOM1000;
  };
  const LN2_HI = 6.93147180369123816490e-01, LN2_LO = 1.90821492927058770002e-10, TWO54 = 1.80143985094819840000e+16;
  const LG1 = 6.666666666666735130e-01, LG2 = 3.999999999940941908e-01, LG3 = 2.857142874366239149e-01, LG4 = 2.222219843214978396e-01, LG5 = 1.818357216161805012e-01, LG6 = 1.531383769920937332e-01, LG7 = 1.479819860511658591e-01;
  const log = x0 => {
    let x = x0, hx = hi(x), k = 0;
    const lx = lo(x);
    if (hx < 0x00100000) {
      if (((hx & 0x7fffffff) | lx) === 0) return -Infinity;
      if (hx < 0) return NaN;
      k -= 54; x *= TWO54; hx = hi(x);
    }
    if (hx >= 0x7ff00000) return x + x;
    k += (hx >> 20) - 1023; hx &= 0x000fffff;
    const i0 = (hx + 0x95f64) & 0x100000;
    x = withHi(x, hx | (i0 ^ 0x3ff00000)); k += i0 >> 20;
    const f = x - 1;
    if ((0x000fffff & (2 + hx)) < 3) {
      if (f === 0) return k === 0 ? 0 : k * LN2_HI + k * LN2_LO;
      const R = f * f * (.5 - .33333333333333333 * f);
      return k === 0 ? f - R : k * LN2_HI - ((R - k * LN2_LO) - f);
    }
    const s = f / (2 + f), dk = k, z = s * s, w = z * z;
    let i = hx - 0x6147a; const j = 0x6b851 - hx;
    const t1 = w * (LG2 + w * (LG4 + w * LG6)), t2 = z * (LG1 + w * (LG3 + w * (LG5 + w * LG7))), R = t2 + t1;
    i |= j;
    if (i > 0) { const hfsq = .5 * f * f; return k === 0 ? f - (hfsq - s * (hfsq + R)) : dk * LN2_HI - ((hfsq - (s * (hfsq + R) + dk * LN2_LO)) - f); }
    return k === 0 ? f - s * (f - R) : dk * LN2_HI - ((s * (f - R) - dk * LN2_LO) - f);
  };
  // the rest, from those and exact operations (exact powers of 2 and 10 give exact logs, so floor(log10(1000)) is 3)
  const tens = new Map(); for (let n = 0, p = 1; n <= 22; n++, p *= 10) tens.set(p, n);   // 1 .. 1e22, each exact
  const log2 = x => { if (x > 0 && x !== Infinity && lo(x) === 0 && (hi(x) & 0x000fffff) === 0 && hi(x) >= 0x00100000) return (hi(x) >> 20) - 1023; return log(x) / 6.93147180559945286227e-01; };
  const log10 = x => tens.has(x) ? tens.get(x) : log(x) / 2.30258509299404590109e+00;
  const pow = (x, y) => {
    if (y === 0) return 1;
    if (x !== x || y !== y) return NaN;
    if (x === 0 || x === Infinity || x === -Infinity || y === Infinity || y === -Infinity || x === 1) return N.pow(x, y);   // exact by definition, the same everywhere
    if (y === .5 && x > 0) return N.sqrt(x);
    const yi = Number.isInteger(y);
    if (yi && Math.abs(y) <= 1024) { let r = 1, b = x, e = Math.abs(y); while (e > 0) { if (e & 1) r *= b; b *= b; e >>= 1; } return y < 0 ? 1 / r : r; }
    if (x < 0) { if (!yi) return NaN; const r = exp(y * log(-x)); return y % 2 ? -r : r; }
    return exp(y * log(x));
  };
  const hypot = function () {
    let s = 0, inf = false, nan = false;
    for (let i = 0; i < arguments.length; i++) { const v = +arguments[i]; if (v === Infinity || v === -Infinity) inf = true; else if (v !== v) nan = true; else s += v * v; }
    return inf ? Infinity : nan ? NaN : N.sqrt(s);
  };
  const cbrt = x => { if (x === 0 || x !== x || x === Infinity || x === -Infinity) return x; const a = Math.abs(x); let r = exp(log(a) / 3); r = r - (r * r * r - a) / (3 * r * r); return x < 0 ? -r : r; };
  const asin = x => x !== x || x > 1 || x < -1 ? NaN : atan2(x, N.sqrt((1 - x) * (1 + x)));
  const acos = x => x !== x || x > 1 || x < -1 ? NaN : atan2(N.sqrt((1 - x) * (1 + x)), x);
  const tan = x => sin(x) / cos(x);
  return { sin, cos, tan, atan, atan2, asin, acos, exp, log, log2, log10, pow, hypot, cbrt };
})();
/** E.session: records a play session on any device and replays it exactly (this section's header says how) */
const SESSION = (() => {
  /** recording: true while this page load is recorded; replaying: true while it is a replay; frame: the frames run
   *  since the page loaded */
  const S = { recording: false, replaying: false, frame: 0 };
  /** turn recording on or off for the next page loads (each load is a session of its own) */
  S.record = on => { try { if (on) localStorage.setItem('my3d2dge:record', '1'); else localStorage.removeItem('my3d2dge:record'); } catch (e) { /* no storage */ } return !!on; };
  /** true when recording is on for page loads (record(true)) */
  S.wanted = () => { try { return localStorage.getItem('my3d2dge:record') === '1'; } catch (e) { return false; } };
  if (typeof window === 'undefined' || typeof requestAnimationFrame !== 'function') return S;
  const R = window.__my3d2dgeReplay || null;
  if (!R && !(S.wanted() || /[?&]record=1\b/.test(location.search))) return S;
  /** recording: true while this page load is recorded; replaying: true while it is a replay */
  S.recording = !R; S.replaying = !!R;
  // the session's record. Events are arrays: [frame, type, target, ...the fields SCHEMA names for their kind]
  const SCHEMA = { key: 'code key repeat mods', pointer: 'pointerId pointerType button buttons clientX clientY isPrimary mods movementX movementY pressure',
    wheel: 'deltaX deltaY deltaMode clientX clientY mods', mouse: 'button buttons clientX clientY detail mods', value: 'value checked',
    resize: 'innerWidth innerHeight devicePixelRatio safeTop safeRight safeBottom safeLeft', hidden: 'hidden', fullscreen: 'on', capture: 'pointerId pointerType', plain: '' };
  const KIND = { keydown: 'key', keyup: 'key', pointerdown: 'pointer', pointermove: 'pointer', pointerup: 'pointer', pointercancel: 'pointer', wheel: 'wheel',
    click: 'mouse', dblclick: 'mouse', contextmenu: 'mouse', input: 'value', change: 'value', resize: 'resize', visibilitychange: 'hidden',
    fullscreenchange: 'fullscreen', webkitfullscreenchange: 'fullscreen', gotpointercapture: 'capture', lostpointercapture: 'capture', blur: 'plain', focus: 'plain', cancel: 'plain' };
  const ON_DOC = ['visibilitychange', 'fullscreenchange', 'webkitfullscreenchange'];
  const realNow = performance.now.bind(performance), realDate = Date.now, realRAF = requestAnimationFrame.bind(window);
  const realMM = window.matchMedia ? matchMedia.bind(window) : null, realGP = navigator.getGamepads ? navigator.getGamepads.bind(navigator) : null;
  const fixed = (o, k, v) => { try { Object.defineProperty(o, k, { value: v, configurable: true, writable: true }); } catch (e) { /* read-only here */ } };
  const getter = (o, k, f) => { try { Object.defineProperty(o, k, { get: f, configurable: true }); } catch (e) { /* read-only here */ } };
  const insets = () => {   // the safe-area insets (a phone's notch and home bar), read the way a page reads them
    if (!document.body) return [0, 0, 0, 0];
    const p = document.createElement('div'); p.style.cssText = 'position:fixed;inset:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
    document.body.appendChild(p); const c = getComputedStyle(p), v = [c.paddingTop, c.paddingRight, c.paddingBottom, c.paddingLeft].map(x => parseFloat(x) || 0); p.remove(); return v;
  };
  const rec = R || { format: 'my3d2dge-session', v: 1, version: E.version, build: E.build, href: location.pathname + location.search + location.hash,
    started: new Date(realDate()).toISOString(), ua: navigator.userAgent, seed: (crypto.getRandomValues(new Uint32Array(1))[0] >>> 0) || 1, clock0: realNow(), epoch0: realDate() - realNow(),
    env: { innerWidth, innerHeight, devicePixelRatio: window.devicePixelRatio || 1, safe: null, media: {}, fullscreenEnabled: !!(document.fullscreenEnabled || document.webkitFullscreenEnabled) },
    storage: [], frames: [], events: [], pads: [], checks: [], schema: SCHEMA };
  if (!R) try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); rec.storage.push([k, localStorage.getItem(k)]); } } catch (e) { /* no storage */ }
  else try { localStorage.clear(); for (const [k, v] of R.storage) localStorage.setItem(k, v); } catch (e) { /* no storage */ }
  S.data = rec;
  // the same math everywhere: + - * / and sqrt are exact in every JavaScript engine, but sin, cos, pow and the rest may
  // differ in their last bit between browsers (an iPhone's Safari and Chromium use different libraries), and a game
  // grows that bit into a different fight. While recording and replaying they are these, built from exact operations
  // only (fdlibm's algorithms, the ones Chromium's own are derived from), so a session plays the same in any browser.
  S.math = PORTABLE_MATH;
  for (const k in PORTABLE_MATH) Math[k] = PORTABLE_MATH[k];
  // the same random numbers, counted (the count is part of the checksum: a draw too many shows at once)
  let draws = 0; const rnd = rng(rec.seed);
  Math.random = () => { draws++; return rnd(); };
  // one clock: the current display frame's time, the same in the recording and the replay
  let clock = rec.clock0;
  fixed(performance, 'now', () => clock);
  Date.now = () => Math.floor(rec.epoch0 + clock);
  fixed(navigator, 'gpu', undefined);   // GPU lighting starts up on real time; the canvas lighting is the same everywhere
  // the media queries the game asks (touch screen or not, reduced motion) answer as they did on the device
  if (realMM) window.matchMedia = q => {
    const m = realMM(q);
    if (!R) { if (!(q in rec.env.media)) rec.env.media[q] = m.matches; return m; }
    return q in R.env.media ? new Proxy(m, { get: (t, k) => k === 'matches' ? R.env.media[q] : typeof t[k] === 'function' ? t[k].bind(t) : t[k] }) : m;
  };
  // gamepads: each reading the game takes, stored when it changes, given back reading by reading
  let gpCalls = 0, gpLast = '', gpAt = 0, gpCur = [];
  const padSnap = pads => Array.from(pads || []).filter(Boolean).map(p => [p.index, p.id, p.connected !== false ? 1 : 0, Array.from(p.axes), p.buttons.map(b => [b.pressed ? 1 : 0, b.value]), p.mapping || '']);
  const padObj = s => ({ index: s[0], id: s[1], connected: !!s[2], mapping: s[5] ?? 'standard', timestamp: 0, axes: s[3].slice(), buttons: s[4].map(b => ({ pressed: !!b[0], touched: !!b[0], value: b[1] })) });
  if (realGP) fixed(navigator, 'getGamepads', () => {
    if (!R) { const pads = realGP(), snap = padSnap(pads), k = JSON.stringify(snap); if (k !== gpLast) { rec.pads.push([gpCalls, snap]); gpLast = k; } gpCalls++; return pads; }
    while (gpAt < R.pads.length && R.pads[gpAt][0] <= gpCalls) gpCur = R.pads[gpAt++][1].map(padObj);
    gpCalls++; return gpCur;
  });
  // a target as a path from the nearest element with an id: '#screen', 'body>3>0', 'w' (window), 'd' (document)
  const pathOf = t => {
    if (t === window || !t || !t.nodeType) return 'w';
    if (t === document) return 'd';
    const idx = []; let el = t;
    while (el && !el.id && el !== document.body && el !== document.documentElement && el.parentNode) { idx.unshift(Array.prototype.indexOf.call(el.parentNode.children, el)); el = el.parentNode; }
    return (el && el.id ? '#' + el.id : el === document.documentElement ? 'html' : 'body') + (idx.length ? '>' + idx.join('>') : '');
  };
  const atPath = p => {
    if (p === 'w') return window; if (p === 'd') return document;
    const [base, ...idx] = p.split('>'); let el = base[0] === '#' ? document.getElementById(base.slice(1)) : base === 'html' ? document.documentElement : document.body;
    for (const i of idx) el = el && el.children[+i];
    return el || null;
  };
  const mods = e => (e.shiftKey ? 1 : 0) | (e.ctrlKey ? 2 : 0) | (e.altKey ? 4 : 0) | (e.metaKey ? 8 : 0);
  const fields = (kind, e) => kind === 'key' ? [e.code, e.key, e.repeat ? 1 : 0, mods(e)]
    : kind === 'pointer' ? [e.pointerId, e.pointerType, e.button, e.buttons, e.clientX, e.clientY, e.isPrimary ? 1 : 0, mods(e), e.movementX || 0, e.movementY || 0, e.pressure || 0]
    : kind === 'wheel' ? [e.deltaX, e.deltaY, e.deltaMode, e.clientX, e.clientY, mods(e)]
    : kind === 'mouse' ? [e.button, e.buttons, e.clientX, e.clientY, e.detail, mods(e)]
    : kind === 'value' ? [e.target.value === undefined ? null : e.target.value, e.target.checked ? 1 : 0]
    : kind === 'resize' ? [innerWidth, innerHeight, window.devicePixelRatio || 1, ...insets()]
    : kind === 'hidden' ? [document.hidden ? 1 : 0]
    : kind === 'fullscreen' ? [document.fullscreenElement || document.webkitFullscreenElement ? 1 : 0]
    : kind === 'capture' ? [e.pointerId, e.pointerType] : [];
  // only what came from the person (or the device): a page's own events happen again by themselves in the replay
  const wanted = e => KIND[e.type] && e.isTrusted && ((e.type !== 'blur' && e.type !== 'focus') || e.target === window);
  const mm = a => ({ shiftKey: !!(a & 1), ctrlKey: !!(a & 2), altKey: !!(a & 4), metaKey: !!(a & 8) });
  // checksums: the frame, the draws, the game's time, camera and scene, and whatever game.stateHash() adds
  const checksum = () => {
    const g = E.current, parts = [S.frame, draws];
    if (g) { parts.push(g.time, g.cam.x, g.cam.y, g.sceneName || ''); if (typeof g.stateHash === 'function') try { parts.push(...[].concat(g.stateHash())); } catch (e) { parts.push('stateHash threw'); } }
    let h = 2166136261; const s = parts.map(String).join('|');
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  };
  // the frame loop: requestAnimationFrame callbacks run with the frame's time, the same way in both
  let queue = [], ids = 0, pending = false;
  window.requestAnimationFrame = cb => { const id = ++ids; queue.push([id, cb]); if (!R && !pending) { pending = true; realRAF(tick); } return id; };
  window.cancelAnimationFrame = id => { queue = queue.filter(q => q[0] !== id); };
  const CHECKS = R ? new Map(R.checks) : null;
  S.checked = 0;
  const compare = (frame, want) => { S.checked++; if (want !== checksum() && S.diverged === undefined) S.diverged = frame; };
  const runFrame = ts => {
    clock = ts; const q = queue; queue = [];
    for (const [, cb] of q) try { cb(ts); } catch (e) { setTimeout(() => { throw e; }); }
    S.frame++;
    if (!R) { if (S.frame % 60 === 0) rec.checks.push([S.frame, checksum()]); }
    else if (CHECKS.has(S.frame)) compare(S.frame, CHECKS.get(S.frame));
  };
  // a recording's frames start once the page has loaded, as a replay's do: a frame run while the page was still parsing saw
  // another document (sizes, layout) than its replay, and a game that reads it played differently from its first frame
  function tick(ts) { if (document.readyState !== 'complete') { realRAF(tick); return; } pending = false; rec.frames.push(ts); runFrame(ts); }
  if (!R) {
    // RECORDING: every wanted event, with the number of frames run before it
    // the person's inputs before the page has loaded (a browser's own pointer move as the page lays out under the cursor)
    // are held back: the game's listeners may not exist yet, and a replay could only give them to a loaded page
    const PERSON = ['key', 'pointer', 'wheel', 'mouse', 'value', 'capture'];
    const log = e => {
      if (!wanted(e)) return;
      if (document.readyState !== 'complete' && PERSON.includes(KIND[e.type])) { e.stopImmediatePropagation(); return; }
      rec.events.push([S.frame, e.type, pathOf(e.target), ...fields(KIND[e.type], e)]);
    };
    for (const t in KIND) (ON_DOC.includes(t) ? document : window).addEventListener(t, log, { capture: true });
    const first = () => { rec.env.safe = insets(); };
    if (document.body) first(); else addEventListener('DOMContentLoaded', first);
    S.frames = () => rec.frames.length;
    /** the session so far, as JSON */
    S.save = () => JSON.stringify(Object.assign({}, rec, { saved: new Date(realDate()).toISOString(), final: [S.frame, checksum()] }));   // final: after the inputs that came after the last frame
    /** offer the session as a file: the share sheet on a phone, a download elsewhere */
    S.share = (name = 'session-' + new Date(realDate()).toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.json') => {
      const file = new File([S.save()], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) return navigator.share({ files: [file], title: name }).catch(() => {});
      const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      return Promise.resolve();
    };
    return S;
  }
  // REPLAYING: the page sees only the recorded events, the recorded screen and the recorded device
  for (const t in KIND) (ON_DOC.includes(t) ? document : window).addEventListener(t, e => { if (e.isTrusted && wanted(e)) e.stopImmediatePropagation(); }, { capture: true });
  window.AudioContext = window.webkitAudioContext = undefined;
  let hidden = false, fs = false, safe = R.env.safe || [0, 0, 0, 0];
  getter(document, 'hidden', () => hidden); getter(document, 'visibilityState', () => hidden ? 'hidden' : 'visible');
  getter(document, 'fullscreenElement', () => fs ? document.documentElement : null); getter(document, 'webkitFullscreenElement', () => fs ? document.documentElement : null);
  getter(document, 'fullscreenEnabled', () => R.env.fullscreenEnabled); getter(document, 'webkitFullscreenEnabled', () => R.env.fullscreenEnabled);
  Element.prototype.requestFullscreen = Element.prototype.webkitRequestFullscreen = function () { return Promise.resolve(); };
  document.exitFullscreen = document.webkitExitFullscreen = () => Promise.resolve();
  Element.prototype.setPointerCapture = Element.prototype.releasePointerCapture = function () {};
  // elements padded by env(safe-area-inset-*) report the device's insets (a headless browser has none)
  const realGCS = window.getComputedStyle.bind(window), PADS = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'], PADC = ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'];
  window.getComputedStyle = (el, ps) => {
    const cs = realGCS(el, ps);
    if (!el || !el.style || !/safe-area-inset/.test(el.style.cssText)) return cs;
    return new Proxy(cs, { get: (t, k) => {
      if (PADS.includes(k)) return safe[PADS.indexOf(k)] + 'px';
      if (k === 'getPropertyValue') return n => PADC.includes(n) ? safe[PADC.indexOf(n)] + 'px' : t.getPropertyValue(n);
      const v = t[k]; return typeof v === 'function' ? v.bind(t) : v;
    } });
  };
  let at = 0;
  S.missing = 0;
  const dispatch = ev => {
    const [, type, path, ...a] = ev, kind = KIND[type], t = atPath(path);
    if (!t) { S.missing++; return; }
    const base = { bubbles: !['blur', 'focus', 'cancel'].includes(type), cancelable: true, composed: true };
    if (kind === 'key') t.dispatchEvent(new KeyboardEvent(type, Object.assign(base, { code: a[0], key: a[1], repeat: !!a[2] }, mm(a[3]))));
    else if (kind === 'pointer') t.dispatchEvent(new PointerEvent(type, Object.assign(base, { pointerId: a[0], pointerType: a[1], button: a[2], buttons: a[3], clientX: a[4], clientY: a[5], isPrimary: !!a[6], movementX: a[8], movementY: a[9], pressure: a[10] }, mm(a[7]))));
    else if (kind === 'wheel') t.dispatchEvent(new WheelEvent(type, Object.assign(base, { deltaX: a[0], deltaY: a[1], deltaMode: a[2], clientX: a[3], clientY: a[4] }, mm(a[5]))));
    else if (kind === 'mouse') {
      if (type === 'click' && t.tagName === 'INPUT' && /^(checkbox|radio)$/.test(t.type)) return;   // its input and change events carry the new state
      t.dispatchEvent(new MouseEvent(type, Object.assign(base, { button: a[0], buttons: a[1], clientX: a[2], clientY: a[3], detail: a[4] }, mm(a[5]))));
    }
    else if (kind === 'value') { if ('value' in t && a[0] !== null) t.value = a[0]; if ('checked' in t) t.checked = !!a[1]; t.dispatchEvent(new Event(type, { bubbles: true })); }
    else if (kind === 'resize') { safe = a.slice(3, 7); t.dispatchEvent(new Event(type)); }
    else if (kind === 'hidden') { hidden = !!a[0]; t.dispatchEvent(new Event(type, { bubbles: true })); }
    else if (kind === 'fullscreen') { fs = !!a[0]; t.dispatchEvent(new Event(type, { bubbles: true })); }
    else if (kind === 'capture') t.dispatchEvent(new PointerEvent(type, Object.assign(base, { pointerId: a[0], pointerType: a[1] })));
    else t.dispatchEvent(type === 'blur' || type === 'focus' ? new FocusEvent(type) : new Event(type, base));
  };
  /**
   * replay n frames: each frame's events, then its callbacks at its time. Returns { frame, frames, diverged, resize, done }:
   * resize = [w, h, dpr] asks the driver (tools/replay.mjs) to set the screen to the recorded size before going on
   */
  S.step = n => {
    for (let i = 0; i < n && S.frame < R.frames.length; i++) {
      while (at < R.events.length && R.events[at][0] <= S.frame) {
        const ev = R.events[at];
        if (ev[1] === 'resize' && (innerWidth !== ev[3] || innerHeight !== ev[4]) && !S._sized) { S._sized = true; return { frame: S.frame, frames: R.frames.length, resize: [ev[3], ev[4], ev[5]] }; }
        S._sized = false; at++; dispatch(ev);
      }
      runFrame(R.frames[S.frame]);
    }
    const done = S.frame >= R.frames.length;
    if (done && !S._final) {   // the inputs after the last frame, then the checksum taken when the session was saved
      S._final = true; while (at < R.events.length) dispatch(R.events[at++]);
      if (R.final) compare(R.final[0], R.final[1]);
    }
    return { frame: S.frame, frames: R.frames.length, events: at, checked: S.checked, diverged: S.diverged, missing: S.missing, done };
  };
  S.frames = () => R.frames.length;
  return S;
})();
E.session = SESSION;

root.My3D2dge = E;
})(typeof window !== 'undefined' ? window : globalThis);
