/* =============================================================================
 * EMBERDEEP  the signature game of my-3D2dge
 * A hack-and-slash that goes down forever. The hero from the stress test (teal tunic, red cape) climbs out of
 * the rune hall into Emberhold, the last lit town, then descends: depth after depth, each one named after the
 * one new element it brings (powder kegs, chasms, gale vents, time wells...). Past the planned depths the game
 * keeps composing new ones out of the same parts.
 *
 * THE LANGUAGE. Everything is built from small registered parts that snap together, so the game never runs out:
 *   elements  phys fire frost storm void venom: a color family, a status effect and a sound each
 *   units     the hero, monsters and allies share one damage pipeline (hits, crits, resistances, statuses)
 *   effects   FX.* verbs (projectile, nova, area, strike, meteor, chain, beam, wave, pull, telegraph) used by
 *             skills, monster attacks, boss patterns, level mechanics and legendary powers alike
 *   skills    an action for the hero's rig (an E.MOVES move, a pose, a leap) plus effects, ranks and runes
 *   monsters  archetype (body + AI + attacks) x element x elite affixes x depth scaling x palette
 *   bosses    a body plus phases of patterns
 *   loot      base x rarity x affixes (x legendary power); gear changes how the hero looks
 *   levels    layout generator x theme x mechanics x monster pool (x boss)
 *   mechanics one level element each: placement, update, draw and event hooks
 * Every registry is REG.<kind>[id]; content files call def(kind, id, spec). See src/emberdeep/DESIGN.md.
 * Source: src/emberdeep/*.js, joined in name order into one script by tools/build.mjs.
 * ============================================================================= */
(() => {
'use strict';
const E = My3D2dge, { px, clamp, lerp, approach, TAU } = E;
const qs = new URLSearchParams(location.search);

/* ---------- game ---------- */
const canvas = document.getElementById('screen');
const BASE = { minH: 220, minW: 320, maxW: 640, maxH: 330, portrait: { maxH: 1000 } };   // wide enough for a phone on its side (about 2.2 : 1); held upright, its picture grows to fill the 9:16 screen
/* keys (Diablo IV style): WASD moves, the mouse aims; LMB / RMB / 1-4 are the six skill slots, Space dodges,
   Q drinks, E interacts, T opens a town portal, I bag, K skills, P passives, Tab map, Esc menu */
const INPUT = {
  up: ['KeyW', 'ArrowUp', 'Pad12'], down: ['KeyS', 'ArrowDown', 'Pad13'], left: ['KeyA', 'ArrowLeft', 'Pad14'], right: ['KeyD', 'ArrowRight', 'Pad15'],
  s0: ['Mouse0', 'KeyJ', 'Pad2'], s1: ['Mouse2', 'KeyL', 'Pad3'], s2: ['Digit1', 'Pad1'], s3: ['Digit2', 'Pad4'], s4: ['Digit3', 'Pad5'], s5: ['Digit4', 'Pad7'],
  dodge: ['Space', 'ShiftLeft', 'ShiftRight', 'Pad0'], potion: ['KeyQ', 'Pad6'], interact: ['KeyE', 'Enter', 'NumpadEnter', 'Pad10'], portal: ['KeyT', 'Pad11'],
  bag: ['KeyI', 'KeyB', 'Pad8'], skills: ['KeyK'], tree: ['KeyP'], map: ['Tab'], labels: ['KeyZ'],
  menuUp: ['ArrowUp', 'KeyW', 'Pad12', 'PadAxisUp'], menuDown: ['ArrowDown', 'KeyS', 'Pad13', 'PadAxisDown'],
  menuLeft: ['ArrowLeft', 'KeyA', 'Pad14', 'PadAxisLeft'], menuRight: ['ArrowRight', 'KeyD', 'Pad15', 'PadAxisRight'],
  click: ['Mouse0'], rclick: ['Mouse2'],
  start: ['Enter', 'NumpadEnter', 'Pad9'], pause: ['Escape', 'Pad9'], confirm: ['Enter', 'NumpadEnter', 'Space', 'KeyJ', 'Pad0'], cancel: ['Escape', 'Backspace', 'Pad1']
};
const SLOT_KEYS = ['LMB', 'RMB', '1', '2', '3', '4'], SLOT_ACTS = ['s0', 's1', 's2', 's3', 's4', 's5'];
const game = new E.Game(Object.assign({ canvas, menu: false, corner: false, fullscreen: 'button', view: qs.get('view') || 'iso', bg: '#05040a', input: INPUT }, BASE));
const P = game.particles, L = game.lights, A = game.audio;
L.enabled = true; L.ambient = .14;
game.fadeTime = .3;

/* ---------- shared state: one object every module reads ---------- */
const ED = {
  version: E.version,  // the release (package.json); E.build says which commit (shown on the title and in Developer)
  mode: null,          // 'title' | 'town' | 'level' | 'proving'
  depth: 0,            // current depth (0 = town)
  L: null,             // the current level (or town) object: map, flow, things, props, lights...
  hero: null,
  foes: [],            // living monsters (team 'foe')
  allies: [],          // the hero's summons and echoes (team 'hero', not the hero)
  corpses: [],         // fallen monsters until they fade
  fx: [],              // live effects (projectiles, novas, areas...)
  drops: [],           // loot on the ground
  boss: null,          // the boss the HUD shows a bar for
  t: 0,                // level clock (game seconds)
  stats: { kills: 0 }, // per-run counters
  paused: false        // true while a modal panel is open (the world waits)
};

/* ---------- difficulty and options (the playtest sliders live in the pause menu and on the title) ---------- */
const DIFF_DEFAULT = { heroDmg: 1, heroHp: 1, heroSpeed: 1, foeDmg: 1, foeHp: 1, foeSpeed: 1, density: 1, xp: 1, loot: 1 };
// the player's options (Settings, 64-menu.js): the interface's, the sound's and the graphics' (view, zoom, pixel size,
// lighting, outlines, particles fx 0-2, the automatic quality, the overlays)
const OPT_DEFAULT = { numbers: true, shake: true, labels: 1, music: .5, sfx: 1, gpu: false, view: 'iso', zoom: 1.25, bars: true, pixels: 0, fullLight: false, autoQuality: true, perfOverlay: false, hitboxes: false };
const DIFF = Object.assign({}, DIFF_DEFAULT, E.store.get('ed:diff', {}));
const OPT = Object.assign({}, OPT_DEFAULT, E.store.get('ed:opt', {}));
const saveOpts = () => { E.store.set('ed:diff', DIFF); E.store.set('ed:opt', OPT); };
const applyAudioOpts = () => { A.musicVolume = OPT.music; A.sfxVolume = OPT.sfx; A._levels(); };
applyAudioOpts(); P.max = [500, 1000, 1600][OPT.fx === undefined ? 2 : OPT.fx];

/* ---------- registries: the parts of the language ---------- */
const REG = {
  elements: {}, statuses: {}, skills: {}, archetypes: {}, ai: {}, affixes: {}, bosses: {}, patterns: {},
  itemBases: {}, itemAffixes: {}, powers: {}, uniques: {}, mechanics: {}, themes: {}, layouts: {}, npcs: {}, passives: {}, songs: {},
  characters: {}   // playable heroes (18-characters.js)
};
/** register a part: def('archetypes', 'husk', { ... }). Returns the spec (with .id set) */
function def(kind, id, spec) {
  if (!REG[kind]) throw new Error('EMBERDEEP: unknown registry "' + kind + '"');
  if (REG[kind][id]) E.warn('ed:dup:' + kind + id, 'EMBERDEEP: ' + kind + ' "' + id + '" registered twice (the last one wins)');
  spec.id = id; REG[kind][id] = spec; return spec;
}
const reg = (kind, id) => REG[kind][id] || null;

/* ---------- event bus: mechanics, powers, passives and the HUD listen here ---------- */
// BUS.on(event, fn, scope). scope 'level' listeners are cleared when a level ends (mechanics), 'run' on a new game.
// Events: hit {src, tgt, hit, dmg}, kill {src, tgt, hit}, hurt {tgt: hero, hit, dmg}, skill {id, slot, h}, dodge {h},
// perfectDodge {h}, pickup {item}, gold {n}, levelStart {L}, levelEnd {L}, bossDown {m}, heroLevel {lvl}, spawn {m},
// thingHit {thing, hit}, step {dt} (every update while a level runs), draw {r}
const BUS = {
  L: {},
  on(ev, fn, scope = 'global') { (this.L[ev] || (this.L[ev] = [])).push({ fn, scope }); return fn; },
  off(ev, fn) { const l = this.L[ev]; if (l) this.L[ev] = l.filter(x => x.fn !== fn); },
  emit(ev, d) { const l = this.L[ev]; if (!l) return d; for (let i = 0; i < l.length; i++) { try { l[i].fn(d); } catch (e) { game._fail('BUS ' + ev, e); } } return d; },
  clear(scope) { for (const k in this.L) this.L[k] = this.L[k].filter(x => x.scope !== scope); }
};

/* ---------- seeded randomness (levels, loot names, towns): same seed, same world ---------- */
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function RNG(seed) {
  const f = E.rng((typeof seed === 'string' ? hashStr(seed) : seed) >>> 0 || 7);
  const R = () => f();
  R.range = (a, b) => a + f() * (b - a);
  R.int = (a, b) => Math.floor(a + f() * (b - a + 1));
  R.pick = l => l[Math.floor(f() * l.length)];
  R.chance = p => f() < p;
  /** weighted pick: list of items with .weight (or a weight function) */
  R.weighted = (list, w = x => x.weight === undefined ? 1 : x.weight) => { let s = 0; for (const x of list) s += Math.max(0, w(x)); let k = f() * s; for (const x of list) { k -= Math.max(0, w(x)); if (k <= 0) return x; } return list[list.length - 1]; };
  R.shuffle = l => { for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; } return l; };
  return R;
}
const rnd = RNG((Math.random() * 1e9) | 0);   // unseeded, for combat rolls
const wpick = (list, w) => rnd.weighted(list, w);

/* ---------- small helpers every module uses ---------- */
const dist2 = (a, b) => { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; };
const d2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
const angTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
/** big numbers for a game that never ends: 12.3K, 4.5M, 6.7B, 8.9T, then Qa Qi Sx Sp Oc No Dc, then aa, ab... (1e36, 1e39...) */
const FMT_U = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
const fmt = n => {
  if (!isFinite(n)) return n < 0 ? '-MAX' : 'MAX';
  if (n < 0) return '-' + fmt(-n);
  if (n < 1e4) return String(Math.round(n));
  let e = Math.floor(Math.log10(n) / 3), v = n / Math.pow(1000, e);
  if (v < 1) { e--; v *= 1000; } else if (v >= 999.95) { e++; v /= 1000; }   // (float edges: 1e15, 999999)
  const k = e - FMT_U.length, u = k < 0 ? FMT_U[e] : String.fromCharCode(97 + Math.floor(k / 26) % 26) + String.fromCharCode(97 + k % 26);
  return v.toFixed(1) + u;
};
const pct = v => Math.round(v) + '%';
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
/** rotate a hex color's hue by deg (deep levels recolor their themes and monsters with this) */
const hueShift = (c, deg, sat = 0, lit = 0) => { if (!deg && !sat && !lit) return c; const [h, s, l] = E.toHsl(c); return E.hsl(h + deg, clamp(s + sat, 0, 1), clamp(l + lit, 0, 1)); };
/** recolor every string color in an object (a palette) */
const shiftPal = (pal, deg, sat, lit) => { const o = {}; for (const k in pal) o[k] = typeof pal[k] === 'string' && pal[k][0] === '#' ? hueShift(pal[k], deg, sat, lit) : pal[k]; return o; };
const sfx = (name, o) => A.sfx(name, o);
/** floating notice line in the HUD feed (level up, loot, tips) */
const notes = [];
function notify(text, color = '#fff2c4', dur = 3) { notes.push({ text, color, t: 0, dur }); if (notes.length > 6) notes.shift(); }
/** screen shake that respects the option */
const shake = n => { if (OPT.shake) game.shake(n); };
/** slow motion that stacks: a perfect dodge, a pack finisher and a boss's death may overlap. The slowest live one wins
 *  and time returns to SLOW.base (1, or a balance run's speed) when the last runs out. Durations are wall-clock seconds
 *  (game.real runs at the game's speed), so a slowdown never stretches itself; an id replaces that slowdown */
const SLOW = { base: 1, list: [], live: false };
const wallClock = () => performance.now() / 1000;
function slowMo(k, dur, id) {
  const o = id && SLOW.list.find(q => q.id === id), now = wallClock();
  if (o) { o.k = k; o.until = now + dur; } else SLOW.list.push({ k, until: now + dur, id });
  slowMoStep();
}
function slowMoStep() {
  const l = SLOW.list; if (!l.length && !SLOW.live) return;
  const now = wallClock(); for (let i = l.length; i--;) if (now >= l[i].until) l.splice(i, 1);
  game.timeScale = SLOW.base * l.reduce((a, q) => Math.min(a, q.k), 1); SLOW.live = l.length > 0;
}
function slowMoReset(base = 1) { SLOW.list.length = 0; SLOW.live = false; SLOW.raw = base; SLOW.base = base * TUNE.gameSpeed; game.timeScale = SLOW.base; }   // (TUNE.gameSpeed: Tuning's world clock)

/* ---------- scaling: the curves that let depth go on forever ---------- */
// Both sides grow exponentially and the monsters' base is a little higher, so every depth is a touch harder than the
// last for the same player skill: item power x1.08 per item level (weapon damage, flat life, armor), monster life x1.10
// and damage x1.075 per depth. Levels, passives, ranks and percent affixes are the hero's edge; past ~100 the deep wins.
// On top, monster damage climbs 60% and life 40% over the first twenty depths, then holds (a constant share after that,
// so the deep's slope is unchanged): the hero's first levels, ranks and gear outran the monsters, and a careless player
// walked through depths 6 to 16 above two thirds of his life
const SCALE = {
  foeHp: d => Math.pow(TUNE.foeHpGrowth, d - 1) * (1 + d * .02) * (1 + .4 * (1 - Math.exp(-(d - 1) / 8))),
  foeDmg: d => Math.pow(TUNE.foeDmgGrowth, d - 1) * (1 + d * .02) * (1 + .6 * (1 - Math.exp(-(d - 1) / 8))),
  foeXp: d => Math.pow(TUNE.foeXpGrowth, d - 1) * (1 + d * .05),
  gold: d => Math.pow(TUNE.goldGrowth, d - 1) * (1 + d * .1),
  /** xp to go from hero level l to l + 1 */
  // polynomial for the first 20 levels, then exponential too: monster experience grows as 1.11^depth, so a polynomial
  // curve alone would hand out thousands of levels a kill deep down. This keeps about 1.35 levels per depth forever
  xpNeed: l => Math.max(1, Math.round((90 * Math.pow(l, 1.75) + 30 * l) * Math.pow(1.07, Math.max(0, l - 20)) * TUNE.xpCurve)),
  /** item power grows with item level: flat stats and weapon damage (percent affixes grow gently on their own) */
  ilvl: il => Math.pow(TUNE.ilvlGrowth, il - 1) * (1 + (il - 1) * .015)
};
