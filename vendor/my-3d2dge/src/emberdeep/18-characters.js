/* =============================================================================
 * PLAYABLE CHARACTERS: the heroes the player picks (CHARACTER on the title). Each is registered in a file of its own:
 *   def('characters', id, spec)
 * and the game asks the entry wherever heroes differ (never the id), so a new hero needs no edits to shared code.
 * docs/CHARACTERS.md is the recipe; `npm run new:character -- <id>` writes a starting point; `npm run character:check --
 * <id>` checks one (the body contract below, the character test, the character sheet). A spec:
 *   name, title, color, desc, style    the character menu and the title ('Codex', 'The Unwritten', '#9cebdd', ...)
 *   skills: [ids]                      the starting skills (rank 1), slotted in this order on LMB, RMB, 1-4. A skill spec
 *                                      with character: id belongs to that hero alone (skillAvailable)
 *   speed, acceleration                running speed (world units a second) and how fast he gets there
 *   dodgeTime, dodgeSpeed              the dodge: how long (s) and how fast
 *   head (26), r (4.5)                 how tall (bars, text and effects sit there) and the collision radius
 *   saveKey ('ed:save:<id>')           its save slot (the Wanderer keeps the original 'ed:save')
 *   stats(h, add)                      flat bonuses: add('ember', 25) (stat names: 15-stats.js)
 *   init(h)                            fields of its own on every new or loaded hero (Codex: its manuscript pages)
 *   prime(h)                           fill its own resource for a cast outside real play: the gallery's demos,
 *                                      Tools' unlimited resources and the character test call it (Dan: a ripe brood)
 *   kit(h)                             the starting gear, over the shared kit (longsword, tunic, shoes, cape)
 *   look: { build, hair, outfit, colors: { skin, hair, cloth, ... } }   its own look under the gear: E.Humanoid options
 *                                      over the classic look (HERO_LOOK, 20-hero.js); gear still changes it, the Echo and
 *                                      the paper doll wear it too
 *   rig(h, look, over)                 its body. Default: an E.Humanoid dressed from the gear (look, see heroLook) with
 *                                      `over` on top (the Echo passes spectral colors). A custom body keeps the BODY CONTRACT
 *   ownLayers: true                    the body animates its own dodge, potion and wounds: the Wanderer's layers (the
 *                                      somersault, the IK flask, the hand to the side, footsteps, settling the cape) are skipped
 *   clips: false                       no captured clips (96-hero-clips.js); a Humanoid hero plays them by default
 *   dropIn(h, from)                    -> the action for arriving in a depth from `from` units up (default: fall and land)
 *   titlePose(t)                       -> rig state for the title screen's 12 s loop (default: the sword kata)
 *   preview(h, part, t)                -> rig state added to the character menu's preview (part 0 idle, 1 run, 2 dodge, 3 cast)
 *   titleZoom: [short, tall]           the title camera's zoom on short and tall screens (default [1.05, 1.75])
 *   dollHeight (31)                    its height in world units, to fit it on the bag's paper doll
 *   menuNotes(el, C)                   extra lines in the character menu (formElement('p', text, el))
 *
 * BODY CONTRACT: what the game calls on h.rig. E.Humanoid keeps all of it; CodexRig (21-codex.js) is a custom body that
 * does. checkRig(id) drives a body through every state in CHAR_STATES and every view and names what is missing or broken.
 *   update(dt, s)          pose it for this step. s: { x, y, z, vx, vy, facing, run, dash, air, hurt, down, pose, stance,
 *                          expr, attack: { spec, phase: 'wind' | 'active' | 'recover', u } } plus whatever its own skills
 *                          pass (unknown keys are ignored). It sets x, y, z and facing from s and advances t and phase
 *   draw(g, ox, oy, view)  draw it with its feet at screen (ox, oy) (E.charView(view) keeps faces readable in steep views)
 *   drawSmear(r, smear)    its weapon trail this step (it may draw nothing); drawPortrait(g, x, y, size) a bust for menus
 *   kick(v)                a jolt (squash, recoil): blows, landings, swings
 *   hand('L' | 'R'), head(), tip()   world points [x, y, z]: where effects start, bolts leave and held things sit
 *   _w(p)                  a point of its own frame (f forward, r right, z up) -> the world offset from (x, y, z)
 *   J                      joints in its own frame: at least hipC, shC, head, handL, handR, and bladeDir (a direction)
 *   o                      options: at least size; the hero writes o.hunch and o.lean (wounded), skills read o.weapon
 *   C                      its colors (skills borrow C.metal and C.hilt); x, y, z, facing, t, phase (the gait clock)
 *   bones (optional)       pairs of joint names that keep their length ([['hipL', 'kneeL'], ...]): the character sheet
 *                          measures them for stretching (a Humanoid's limbs are measured without it)
 * ============================================================================= */
const CHARACTERS = REG.characters;   // (the registry, under the name tools and tests use: __ed.CHARACTERS)
const characterId = id => (Object.hasOwn(CHARACTERS, id) ? id : 'wanderer');
/** the chosen hero. The wish (a ?character= link or the last choice) is resolved on first use, after every character
 *  file has registered (they load after this one) */
const CHAR = {
  wanted: qs.get('character') || E.store.get('ed:character', 'wanderer'), chosen: null, preview: null,
  get selected() { return this.chosen || characterId(this.wanted); },
  set selected(id) { this.chosen = characterId(id); }
};
const characterOf = h => CHARACTERS[characterId(h && h.character)];
const characterSaveKey = (id = CHAR.selected) => { const C = CHARACTERS[characterId(id)]; return C.saveKey || 'ed:save:' + C.id; };
const characterSave = (id = CHAR.selected) => E.store.get(characterSaveKey(id), null);
const skillAvailable = (h, S) => !!S && (!S.character || S.character === characterOf(h).id);
statSource((h, add) => { const C = characterOf(h); if (C.stats) C.stats(h, add); });
/** a hero's body (the hero himself, his Echo, the bag's paper doll): the character's own rig, or a Humanoid dressed from
 *  the gear look with `over` on top */
function charRig(h, look = h.look, over = null) {
  const C = characterOf(h); over = over || { colors: Object.assign({}, look.colors) };
  return C.rig ? C.rig(h, look, over) : new E.Humanoid(Object.assign({}, look, over));
}

/* ---------- the Wanderer: the stress test's swordsman, the hero every default above describes ---------- */
def('characters', 'wanderer', {
  name: 'Wanderer', title: 'The emberbound swordsman', color: '#6fd6cc',
  desc: 'Steel, fire, and a stubborn heart. Chain sword strikes and tumble through danger.',
  style: 'Grounded footwork · sword combos · somersault dodge',
  skills: ['blade', 'ember'], speed: 84, acceleration: 1000, dodgeTime: .27, dodgeSpeed: 255,
  saveKey: 'ed:save'   // the original slot: saves from before there were characters are his
});

/* ---------- checking a body against the contract ---------- */
/** the states a body is checked and drawn in (checkRig, tools/ed-sheet.mjs): [label, rig state, seconds to hold it] */
const CHAR_STATES = [
  ['idle', {}, .6], ['run', { vx: 84, run: 1 }, .6], ['dodge', { dash: true, vx: 220 }, .15], ['jump', { air: true, z: 10 }, .3],
  ['wind-up', { attack: E.move('slash', .8, 'wind') }, .2], ['strike', { attack: E.move('slash', .5, 'active') }, .2],
  ['follow-through', { attack: E.move('slash', .5, 'recover') }, .2], ['cast', { pose: 'cast' }, .5], ['guard', { stance: 'guard' }, .5],
  ['hurt', { hurt: true, expr: 'wince' }, .2], ['knocked down', { down: 1 }, 1], ['death', { pose: 'die', expr: 'wince' }, 2.2],
  ['cheer', { pose: 'cheer', expr: 'shout' }, .6], ['wave', { pose: 'wave' }, .6]
];
const CHAR_VIEWS = ['iso', 'threequarter', 'topdown', 'brawler', 'side'];
const CHAR_JOINTS = ['hipC', 'shC', 'head', 'handL', 'handR', 'bladeDir'];
/**
 * Does a body keep the contract? checkRig('codex') (or a function that builds a fresh body) drives it through every state
 * of CHAR_STATES at two facings, draws it in every view and as a portrait, and returns { ok, problems: [plain sentences],
 * states, views, pixels: { view: pixels drawn at idle } }. In the console or a test: __ed.checkRig('codex').
 */
function checkRig(make, o = {}) {
  const problems = [], seen = new Set(), say = (key, text) => { if (!seen.has(key)) { seen.add(key); problems.push(text); } };
  if (typeof make === 'string') { const id = make; if (!CHARACTERS[id]) return { ok: false, problems: ['no character "' + id + '" (registered: ' + Object.keys(CHARACTERS).join(', ') + ')'] }; const h = newHero(id); make = () => charRig(h); }
  const fin = p => Array.isArray(p) && p.length >= 3 && p.every(Number.isFinite);
  const tryIt = (what, fn) => { try { return fn(); } catch (e) { say(what, what + ' threw: ' + (e && e.message || e)); return undefined; } };
  let rig = tryIt('building the body', make); if (!rig) return { ok: false, problems };
  for (const m of ['update', 'draw', 'drawSmear', 'drawPortrait', 'kick', 'hand', 'head', 'tip', '_w']) if (typeof rig[m] !== 'function') say('m:' + m, 'it has no ' + m + '() (see the BODY CONTRACT in 18-characters.js)');
  if (problems.length) return { ok: false, problems };
  const base = { x: 0, y: 0, z: 0, vx: 0, vy: 0 };
  tryIt('update', () => rig.update(0, Object.assign({ facing: 0 }, base)));
  for (const k of CHAR_JOINTS) if (!fin(rig.J && rig.J[k])) say('j:' + k, 'J.' + k + ' is missing or not three numbers after update()');
  if (!(rig.o && rig.o.size > 0)) say('size', 'o.size is missing (the body\'s scale, 1 for a hero)');
  // every state, held long enough for eased weights to settle, at two facings
  const states = o.states || CHAR_STATES;
  for (const [label, st, hold] of states) for (const facing of [0, 2.2]) {
    rig = tryIt('building the body', make); if (!rig) break;
    const s = Object.assign({ facing }, base, st), steps = Math.max(1, Math.round((hold || .5) * 60));
    for (let i = 0; i < steps; i++) tryIt('update(' + label + ')', () => rig.update(1 / 60, s));
    for (const k in rig.J) if (rig.J[k] && !fin(rig.J[k])) say('nan:' + label + k, label + ': J.' + k + ' is not a number');
    if (Math.abs(E.angDiff(rig.facing || 0, facing)) > .01) say('face:' + label, label + ': facing does not follow s.facing (' + (rig.facing || 0).toFixed(2) + ' for ' + facing + ')');
    if (rig.x !== 0 || rig.y !== 0) say('pos:' + label, label + ': x, y do not follow s.x, s.y');
    const reach = 70 * (rig.o.size || 1);
    for (const [name, fn] of [['hand(\'L\')', () => rig.hand('L')], ['hand(\'R\')', () => rig.hand('R')], ['head()', () => rig.head()], ['tip()', () => rig.tip()]]) {
      const p = tryIt(label + ': ' + name, fn); if (p === undefined) continue;
      if (!fin(p)) say('pt:' + label + name, label + ': ' + name + ' is not a world point [x, y, z]');
      else if (Math.hypot(p[0], p[1]) > reach || p[2] < -12 || p[2] > reach) say('far:' + label + name, label + ': ' + name + ' is ' + Math.round(Math.hypot(p[0], p[1], p[2])) + ' units from its feet (a world point, not a local one?)');
    }
    tryIt('kick', () => { rig.kick(3); rig.update(1 / 60, s); });
    for (const k of CHAR_JOINTS) if (rig.J[k] && !fin(rig.J[k])) say('kick:' + k, 'after kick(): J.' + k + ' is not a number');
  }
  // drawing: every view at idle and in the strike, a portrait, and the trail through a stand-in renderer
  const cv = E.mkCanvas(200, 200), g = cv.getContext('2d', { willReadFrequently: true }), pixels = {};
  g.imageSmoothingEnabled = false;
  const count = () => { const d = g.getImageData(0, 0, 200, 200).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; };
  for (const vid of CHAR_VIEWS) for (const [label, st] of [['idle', {}], ['strike', { attack: E.move('slash', .5, 'active') }]]) {
    rig = tryIt('building the body', make); if (!rig) break;
    const s = Object.assign({ facing: .6 }, base, st), view = E.VIEWS[vid];
    for (let i = 0; i < 20; i++) tryIt('update(' + label + ')', () => rig.update(1 / 60, s));
    g.clearRect(0, 0, 200, 200); tryIt('draw (' + vid + ')', () => rig.draw(g, 100, 150, view));
    const n = count(); if (label === 'idle') pixels[vid] = n;
    if (!n) say('draw:' + vid + label, label + ': draw() put nothing on screen in the ' + vid + ' view');
    const r = { view, ix: 0, iy: 0, w: (x, y, z) => { const p = view.p(x, y, z); return [100 + p[0], 150 + p[1]]; }, queue: (x, y, z, fn) => tryIt('drawSmear\'s queued drawing', () => fn(g)) };
    tryIt('drawSmear', () => rig.drawSmear(r, ['#ffffff', '#dff8ff', '#8fe0f2', '#4bb1d4']));
  }
  g.clearRect(0, 0, 200, 200); tryIt('drawPortrait', () => rig.drawPortrait(g, 10, 10, 40));
  if (!count()) say('portrait', 'drawPortrait() put nothing on screen');
  return { ok: !problems.length, problems, states: states.length, views: CHAR_VIEWS.length, pixels };
}
