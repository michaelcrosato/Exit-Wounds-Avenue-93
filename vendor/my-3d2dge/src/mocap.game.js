/* =============================================================================
 * MOCAP LAB  animation sets in my-3D2dge's readable format, played on the engine's rigs.
 * Four sets: QUATERNIUS (Universal Animation Library 1 and 2 by Quaternius, CC0: every free clip), MESH2MOTION (its
 * human clips, CC0), CMU (moments cut from the CMU motion capture database), all imported by tools/anim-import.mjs, and
 * HERO (the clips Emberdeep's Wanderer adopted, picked by tools/anim-set.mjs). A look-alike
 * of the libraries' mannequin plays each clip at their proportions; the engine's hero plays it retargeted to his build.
 * The AI panel shows a clip as the text a model reads and edits, the catalog it picks from, and the format.
 * The CMU library (?set=library) is every take of the CMU database, loaded from cmu-lib/ as it is picked.
 * Deep links: mocap-lab.html#Dance_Loop, ?set=hero, ?set=library#49_06, ?view=side, ?cast=both|hero|mannequin, ?speed=.25, ?true (true
 * camera), ?facing=90 (degrees), ?spin (turntable), ?sword=0 (the hero's sword put away), ?caption (the clip's name
 * drawn into the image, for recordings)
 * ============================================================================= */
(() => {
'use strict';
const E = My3D2dge, { clamp } = E;
// every animation set the page carries (each set file assigns window.MOCAP[NAME]), by lowercase name, in page order
const SETS = {}; for (const [k, v] of Object.entries(window.MOCAP)) SETS[k.toLowerCase()] = Mocap.load(v);
const SET_IDS = Object.keys(SETS);
const LIB = 'library';   // the CMU library: every take of the database, loaded as it is picked (section 7b)

/* 1. Game and a studio floor: light grey with a grid, like the libraries' preview stage */
const game = new E.Game({ canvas: document.getElementById('screen'), menu: false, corner: false, fullscreen: 'button', view: 'threequarter', minH: 230, maxW: 520, portrait: { maxH: 1000 }, bg: '#cfcac3' });
const MW = 40, MH = 40, T = 16, CX = MW * T / 2, CY = MH * T / 2;
const map = new E.TileMap({
  w: MW, h: MH, tile: T, cells: new Array(MW * MH).fill(0), types: {},
  floorTex: (x, y) => {
    const gx = ((x % T) + T) % T, gy = ((y % T) + T) % T, major = x % (T * 4) < 1 || y % (T * 4) < 1;
    if (major) return [92, 88, 86];
    if (gx < 1 || gy < 1) return [126, 121, 117];
    const n = (E.hash2(x >> 2, y >> 2) - .5) * 4; return [169 + n, 164 + n, 158 + n];
  }
});
game.cam.bounds = null;

/* 2. The cast: the libraries' mannequin and the engine's hero (retargeted, cape and all) */
let lib = SETS[SET_IDS[0]];
const man = new Mocap.Mannequin(lib, { height: 34 });
const hero = Mocap.drive(new E.Humanoid({ cape: { len: 6, width: 5, seg: 2.5 } }), lib);
const heroK = () => hero.o.hipZ * hero.o.size / lib.rest.hipZ;   // hero world units per mm (for clips that travel)

/* 3. Clips, grouped by their catalog tags; the starred ones are the core set */
const GROUPS = [
  ['Idle', ['idle']], ['Locomotion', ['walk', 'run', 'crouch', 'crawl', 'strafe', 'turn']], ['Jump, dodge, climb, fly', ['jump', 'dodge', 'climb', 'slide', 'fly']],
  ['Combat', ['attack', 'stance', 'block', 'shield', 'sword', 'unarmed', 'magic', 'gun', 'bow', 'throw', 'kick']], ['Reactions', ['hurt', 'death', 'getup']],
  ['Interacting', ['interact', 'work', 'item', 'chest', 'carry', 'eat', 'farm', 'fish', 'sport']], ['Social', ['talk', 'emote', 'gesture', 'dance', 'cheer', 'exercise']],
  ['Sitting and resting', ['sit', 'rest', 'lie']], ['Swimming', ['swim']], ['Monsters', ['zombie', 'monster']], ['Reference', ['reference']]
];
const CORE = new Set(['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Jump_Start', 'Roll', 'Punch_Jab', 'Sword_Attack', 'Sword_Regular_Combo', 'Hit_Chest', 'Death01',
  'LayToIdle', 'Interact', 'PickUp_Table', 'Chest_Open', 'Walk_Carry_Loop', 'Consume', 'Sitting_Enter', 'Dance_Loop', 'ClimbUp_1m_RM']);
const groupOf = c => { const tags = c.tags || []; for (const [label, keys] of GROUPS) if (tags.some(t => keys.includes(t))) return label; return 'Other'; };
const pretty = n => n.replace(/_Loop$/, '').replace(/_RM$/, ' (travels)').replace(/_/g, ' ');

/* 4. State */
const qs = new URLSearchParams(location.search);
const CASTS = ['mannequin', 'hero', 'both'];
const S = {
  set: SETS[qs.get('set')] || qs.get('set') === LIB ? qs.get('set') : SET_IDS[0], clip: null, t: 0, hold: 0, playing: true,
  speed: clamp(+qs.get('speed') || 1, .1, 2), cast: CASTS.includes(qs.get('cast')) ? qs.get('cast') : 'both',
  facing: qs.has('facing') ? +qs.get('facing') * E.DEG : null, spin: qs.has('spin'), bones: false, props: qs.has('props'), trueCam: qs.has('true'), caption: qs.has('caption'), sword: qs.get('sword') !== '0',
  fade: 0, pose: new Float32Array(lib.P * 3), prev: new Float32Array(lib.P * 3), order: []
};

function play(name, cut) {
  if (S.set === LIB && !lib.clip(name)) { playLib(name, cut); return; }   // a take of another subject: load it first
  const c = lib.clip(name); if (!c) return;
  if (S.clip && S.clip !== c && !cut) { S.prev.set(S.pose); S.fade = .18; }   // crossfade from the pose on screen (cut: no blend)
  S.clip = c; S.t = 0; S.hold = 0;
  history.replaceState(null, '', location.pathname + location.search + '#' + c.name);
  syncInfo(); syncList(); showText();   // (the note sets the panels' height before the list scrolls to the clip)
}

/* 5. Update: advance the clip, pose both figures */
const pos = {};   // where each figure on stage stands this step
const actors = () => S.cast === 'both' ? ['mannequin', 'hero'] : [S.cast];
function update(dt) {
  const c = S.clip;
  if (S.playing) {
    S.t += dt * S.speed;
    if (!c.loop && S.t >= c.dur) { S.hold += dt; if (S.hold > .8) { S.t = 0; S.hold = 0; } S.t = Math.min(S.t, c.dur); }   // one-shots hold their end, then replay
  }
  lib.sample(c, S.t, S.pose);
  if (S.fade > 0) { S.fade = Math.max(0, S.fade - dt); lib.blend(S.pose, S.prev, S.fade / .18, S.pose); }
  if (S.spin && S.playing) S.facing = (S.facing ?? baseFacing()) + dt * .6;
  const f = facing(), mv = lib.moveAt(c, S.t), list = actors();
  let side = sideDir(), gap = 30;
  if (mv) {   // travelling clips: parallel lanes, still left to right
    const v = game.view; side = [-Math.sin(f), Math.cos(f)]; if (v.ax * side[0] + v.ay * side[1] < 0) side = [-side[0], -side[1]];
    // lanes that run away from the camera (the side view) would hide one figure behind the other: stagger them along
    // the way they travel instead, one ahead of the other, far enough apart for a kick or a lunge
    if (Math.hypot(v.ax * side[0] + v.ay * side[1], v.bx * side[0] + v.by * side[1]) < .45 * Math.hypot(v.ax, v.ay)) { side = sideDir(); gap = 40; }
  }
  for (const a in pos) delete pos[a];
  list.forEach((a, i) => {
    const off = (i - (list.length - 1) / 2) * gap, k = a === 'hero' ? heroK() : man.k;
    let x = CX + side[0] * off, y = CY + side[1] * off;
    if (mv) { x += (mv[0] * Math.cos(f) - mv[1] * Math.sin(f)) * k; y += (mv[0] * Math.sin(f) + mv[1] * Math.cos(f)) * k; }
    pos[a] = [x, y];
  });
  hero.mocap = S.pose; hero.mocapBlade = /Sword/.test(c.name); hero.o.weapon = S.sword ? 'sword' : null;
  if (pos.hero) hero.update(dt, { x: pos.hero[0], y: pos.hero[1], facing: f });
  const ps = list.map(a => pos[a]), sh = panelShift();   // the camera keeps the cast in frame, centred between the panels
  game.focus(ps.reduce((t, p) => t + p[0], 0) / ps.length - sideDir()[0] * sh, ps.reduce((t, p) => t + p[1], 0) / ps.length - sideDir()[1] * sh, 14);
  scrub.value = String(Math.round(S.t / Math.max(.001, c.dur) * 1000));
  frameEl.textContent = S.t.toFixed(2) + ' / ' + c.dur.toFixed(2) + ' s';
}
/** in-place jumps keep the root on the floor while the feet point down (a game lifts the body); lift the figure so
 *  its lowest point touches the floor instead of sinking through it (mm) */
function groundLift(pose) { let lo = 0; for (let i = 2; i < pose.length; i += 3) if (pose[i] < lo) lo = pose[i]; return -lo; }
/** the ground direction that runs left to right across the screen */
function sideDir() { const v = game.view, l = Math.hypot(v.ax, v.ay) || 1; return [v.ax / l, v.ay / l]; }
/** three-quarter toward the camera by default, so both arms and both legs read */
function baseFacing() { const v = game.view; return v.isSide ? 0 : Math.atan2(v.fy, v.fx) - .75; }
const facing = () => S.facing ?? baseFacing();
/** world units to slide the camera so the figures sit in the middle of the space the side panels leave open */
function panelShift() {
  const W = document.getElementById('screen').clientWidth || innerWidth, l = $('clips').closest('.side'), a = $('ai');
  const left = l && l.offsetParent ? l.getBoundingClientRect().right : 0, right = a && !a.hidden && a.offsetParent ? W - a.getBoundingClientRect().left : 0;
  const v = game.view, ppu = Math.hypot(v.ax, v.ay) * (W / game.screen.W);
  return ppu > 0 ? (left - right) / 2 / ppu : 0;
}

/* 6. Draw. Props (off by default, ?props or O): the engine's core shapes behind the cast, for scale [id, x, y, facing, scale] */
const PROPS = [['table', -80, -14, Math.PI / 2, .9], ['stool', -62, -2, Math.PI / 2, .8], ['crate', 66, -12, Math.PI / 2 + .3, .8], ['barrel', 84, -2, 0, .8]];

function draw(r) {
  const view = r.view, mv = camFor(view), f = facing(), lift = groundLift(S.pose);
  map.drawFloor(r);
  for (const a of actors()) r.shadow(pos[a][0], pos[a][1], 7, .35);
  if (pos.mannequin) r.actor(pos.mannequin[0], pos.mannequin[1], lift * man.k, (g, ox, oy) => man.draw(g, ox, oy, mv, S.pose, f), { outlineColor: '#3a2a1c' });
  if (pos.hero) r.actor(pos.hero[0], pos.hero[1], 0, (g, ox, oy) => hero.draw(g, ox, oy, view));   // (Mocap.drive lifts a clip that dips below the floor itself)
  if (S.props) for (const [id, x, y, facing, scale] of PROPS) r.shape(id, CX + x, CY + y, 0, { facing, scale });
  if (S.bones) r.overlay(g => drawBones(r, g, f));
  if (S.caption) r.overlay(g => {   // for recordings, which capture the game's own image
    E.font.text(g, pretty(S.clip.name).toUpperCase(), 6, 6, '#2a2140');
    E.font.text(g, view.label + (S.trueCam ? ', true camera' : '') + (S.speed < 1 ? '  ' + S.speed + 'x' : ''), 6, 17, '#4a3f5c');
  });
}
/**
 * The angle the figures are drawn from. By default the engine's character view: in steep views (three-quarter,
 * top-down) characters are drawn from a lower, sprite-like angle so faces and poses read, as SNES RPGs did.
 * The true camera draws them exactly as the view sees the floor, with no height boost: the fair comparison with a 3D game.
 */
const _tv = new Map();
function camFor(v) {
  if (!S.trueCam) return E.charView(v);
  if (v.zBoost === 1) return v;
  const key = v.yawDeg + ':' + v.pitchDeg + ':' + v.scale; let t = _tv.get(key);
  if (!t) { t = new E.View(v.id, v.label, v.yawDeg, v.pitchDeg, v.scale, 1); _tv.set(key, t); }
  return t;
}
// the pose's body points and the bones between them, over the mannequin
const BONES = [['pelvis', 'spine1'], ['spine1', 'spine2'], ['spine2', 'chest'], ['chest', 'neck'], ['neck', 'head'], ['head', 'headTop'], ['head', 'faceF'],
  ...['L', 'R'].flatMap(s => [['chest', 'clav' + s], ['clav' + s, 'sh' + s], ['sh' + s, 'elbow' + s], ['elbow' + s, 'wrist' + s], ['wrist' + s, 'knuck' + s], ['pelvis', 'hip' + s], ['hip' + s, 'knee' + s], ['knee' + s, 'ankle' + s], ['ankle' + s, 'ball' + s], ['ball' + s, 'toe' + s]])];
function drawBones(r, g, f) {
  if (!pos.mannequin) return;
  const view = camFor(r.view), [x0, y0] = pos.mannequin, k = man.k, c = Math.cos(f), s = Math.sin(f), lift = groundLift(S.pose) * k;
  const W = n => { const p = lib.pt(S.pose, n), wx = (p[0] * c - p[1] * s) * k, wy = (p[0] * s + p[1] * c) * k, q = r.w(x0, y0, lift); return [q[0] + view.ax * wx + view.ay * wy, q[1] + view.bx * wx + view.by * wy + view.bz * p[2] * k]; };
  for (const [a, b] of BONES) { const A = W(a), B = W(b); E.px.line(g, A[0], A[1], B[0], B[1], b.endsWith('L') || a.endsWith('L') ? '#2f7fff' : '#ff3a6a'); }
  for (const n of lib.points) { const p = W(n); E.px.rect(g, p[0] - 1, p[1] - 1, 2, 2, '#ffffff'); }
}

/* 7. UI: sets, clip list, views, cast, playback */
const $ = id => document.getElementById(id);
const listEl = $('clips'), pick = $('pick'), scrub = $('scrub'), frameEl = $('frame');
function buildList() {
  listEl.innerHTML = ''; pick.innerHTML = '';
  const groups = new Map(); for (const n of lib.names) { const g = groupOf(lib.clip(n)); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(n); }
  S.order = [];
  for (const [label] of [...GROUPS, ['Other']]) {
    const names = groups.get(label); if (!names) continue;
    names.sort((a, b) => Number(CORE.has(b)) - Number(CORE.has(a)));
    const h = document.createElement('h2'); h.textContent = label; listEl.appendChild(h);
    const og = document.createElement('optgroup'); og.label = label; pick.appendChild(og);
    for (const n of names) {
      S.order.push(n);
      const c = lib.clip(n), b = document.createElement('button'); b.type = 'button'; b.dataset.clip = n; b.textContent = (CORE.has(n) ? '★ ' : '') + pretty(n);
      if (c.desc) b.title = c.desc;
      b.addEventListener('click', () => { play(n); b.blur(); }); listEl.appendChild(b);
      const op = document.createElement('option'); op.value = n; op.textContent = b.textContent; og.appendChild(op);
    }
  }
  $('setNote').textContent = lib.names.length + ' clips' + (lib.set.from ? ', picked from the ' + [].concat(lib.set.from).map(n => (SETS[n.toLowerCase()] && SETS[n.toLowerCase()].set.title) || n.toLowerCase()).join(' and ') + ' set' + ([].concat(lib.set.from).length > 1 ? 's' : '') : '') + '. ' + (lib.set.credit || '') + ' ★ the core set.';
}
pick.addEventListener('change', () => play(pick.value));
function syncList() {
  for (const b of listEl.querySelectorAll('button')) { const on = b.dataset.clip === S.clip.name; b.setAttribute('aria-pressed', String(on)); if (on) b.scrollIntoView({ block: 'nearest' }); }
  pick.value = S.clip.name;
}
function syncInfo() {
  const c = S.clip, fit = lib.set.fit && lib.set.fit[c.name];
  const o = lib.origin(c);   // where it came from: its library, and the clip it was made from
  $('note').textContent = pretty(c.name) + (c.desc ? ': ' + c.desc + '.' : '.') + ' ' + c.keys.length + ' key poses, ' + c.dur.toFixed(2) + ' s, ' + (c.loop ? 'loops' : 'plays once') + (c.keys[0].root ? ', travels' : '') + (fit ? '; within ' + fit[0] + ' mm of the capture on average.' : '.')
    + ' From ' + o.label + (o.license ? ' (' + o.license + ')' : '') + (o.orig ? ', made from ' + o.orig.replace('/', ' ') : '')
    + (o.take ? ', take ' + o.take.replace(' ', ' at ').replace('-', ' to ') + ' s' : '') + '.';
  $('note').title = o.origin;
  $('playBtn').setAttribute('aria-pressed', String(!S.playing));
  placePanels();
}
scrub.addEventListener('input', () => { S.playing = false; S.t = +scrub.value / 1000 * S.clip.dur; S.hold = 0; syncInfo(); });
// one button per set (G cycles them); the label is the set's name, the tooltip its credit
const setBtns = SET_IDS.map((id, i) => {
  const b = document.createElement('button'), L = SETS[id], label = L.set.title || L.set.set.charAt(0) + L.set.set.slice(1).toLowerCase().replace(/_/g, ' ');
  b.type = 'button'; b.dataset.set = id; b.title = L.set.credit || ''; b.setAttribute('aria-pressed', 'false');
  b.innerHTML = (i === 0 ? '<kbd>G</kbd>' : '') + label + ' (' + L.names.length + ')'; $('sets').appendChild(b); return b;
});
function setSet(id, clipName) {
  if (id === LIB) { setLibrary(clipName); return; }
  S.set = id; lib = SETS[id]; man.lib = lib; Mocap.drive(hero, lib);
  setBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.set === id)));
  buildList(); showCatalog(); formatDone = false; if (!$('paneFormat').hidden) showFormat();
  play(lib.clip(clipName) ? clipName : S.order[0], true);
}
/* 7b. The CMU library: every take of the CMU database, fitted within 50 mm for browsing (node tools/cmu.mjs library writes
 *     examples/cmu-lib: an index and one set file a subject). It is not inlined (about 65 MB): the index loads when the
 *     library opens, and a subject's file when one of its takes is picked. The CMU set holds the moments cut for games. */
const LIB_DIR = 'cmu-lib/', LIBRARY = { index: null, byName: {}, subjects: {} }, CYCLE = [...SET_IDS, LIB];
const CATS = ['locomotion', 'jump', 'climb', 'combat', 'acrobatics', 'reaction', 'sit and lie', 'idle', 'everyday', 'gesture and talk', 'exercise', 'dance', 'sports', 'animal and character', 'other', 'undescribed', 'calibration'];
const loadScript = src => new Promise((ok, no) => { const el = document.createElement('script'); el.src = src; el.onload = ok; el.onerror = () => no(new Error('could not load ' + src)); document.head.appendChild(el); });
async function libIndex() {
  if (!LIBRARY.index) {
    await loadScript(LIB_DIR + 'index.js'); LIBRARY.index = window.CMU_LIB;
    for (const [id, s, cat, sec, desc, parts] of LIBRARY.index.takes) for (let k = 1; k <= parts; k++) LIBRARY.byName[parts > 1 ? id + '_part' + k : id] = { id, s, cat, sec, desc, part: parts > 1 ? k : 0, parts };
    libBtn.textContent = 'CMU library (' + LIBRARY.index.takes.length.toLocaleString('en') + ')';
  }
  return LIBRARY.index;
}
async function libSubject(s) {
  if (!LIBRARY.subjects[s]) { const name = 'CMU_' + String(s).padStart(2, '0'); await loadScript(LIB_DIR + name + '.js'); LIBRARY.subjects[s] = Mocap.load(window.MOCAP[name]); delete window.MOCAP[name]; }
  return LIBRARY.subjects[s];
}
let libWant = null;
/** play a take of the library: its subject's file loads first (once) */
async function playLib(name, cut) {
  const e = LIBRARY.byName[name]; if (!e) return;
  libWant = name; if (!LIBRARY.subjects[e.s]) $('note').textContent = 'Loading CMU subject ' + e.s + '...';
  try {
    const L = await libSubject(e.s); if (libWant !== name || S.set !== LIB) return;
    if (lib !== L) { lib = L; man.lib = lib; Mocap.drive(hero, lib); formatDone = false; if (!$('paneFormat').hidden) showFormat(); }
    play(name, cut);
  } catch (err) { $('note').textContent = err.message + '. node tools/cmu.mjs all, then library, writes the library.'; }
}
async function setLibrary(clipName) {
  S.set = LIB; setBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.set === LIB)));
  try { await libIndex(); } catch (err) { $('setNote').textContent = 'The CMU library is not here (' + err.message + '): node tools/cmu.mjs all, then library, writes it.'; return; }
  buildLibList(); showCatalog();
  const name = LIBRARY.byName[clipName] ? clipName : LIBRARY.byName[clipName + '_part1'] ? clipName + '_part1' : '02_01';   // (a long take: its first part)
  await playLib(name, true);
}
function buildLibList() {
  listEl.innerHTML = ''; pick.innerHTML = ''; S.order = [];
  const groups = new Map(); for (const n of Object.keys(LIBRARY.byName)) { const c = LIBRARY.byName[n].cat || 'other'; if (!groups.has(c)) groups.set(c, []); groups.get(c).push(n); }
  for (const cat of [...CATS, ...[...groups.keys()].filter(c => !CATS.includes(c))]) {
    const names = groups.get(cat); if (!names) continue;
    const h = document.createElement('h2'); h.textContent = cat + ' (' + names.length + ')'; listEl.appendChild(h);
    const og = document.createElement('optgroup'); og.label = cat; pick.appendChild(og);
    for (const n of names) {
      const e = LIBRARY.byName[n], label = (e.desc || 'undescribed') + ' · ' + e.id + (e.part ? ' part ' + e.part + '/' + e.parts : '');
      S.order.push(n);
      const b = document.createElement('button'); b.type = 'button'; b.dataset.clip = n; b.textContent = label; b.title = 'Subject ' + e.s + ' (' + (LIBRARY.index.subjects[e.s] || 'undescribed') + '), take ' + e.id + ', ' + e.sec + ' s';
      b.addEventListener('click', () => { play(n); b.blur(); }); listEl.appendChild(b);
      const op = document.createElement('option'); op.value = n; op.textContent = label; og.appendChild(op);
    }
  }
  $('setNote').textContent = LIBRARY.index.takes.length.toLocaleString('en') + ' takes: every one in the CMU motion capture database, fitted within ' + LIBRARY.index.tol + ' mm for browsing; a take of more than 20 s is in 10 s parts. A subject loads when you pick one of its takes. The CMU set holds the moments cut for games. CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu), free for all uses.';
}
const libBtn = document.createElement('button');
libBtn.type = 'button'; libBtn.dataset.set = LIB; libBtn.title = 'Every take of the CMU motion capture database, loaded as you pick'; libBtn.setAttribute('aria-pressed', 'false'); libBtn.textContent = 'CMU library (all)';
$('sets').appendChild(libBtn); setBtns.push(libBtn);
setBtns.forEach(b => b.addEventListener('click', () => { setSet(b.dataset.set, S.clip && S.clip.name); b.blur(); }));
const viewBtns = [...document.querySelectorAll('[data-view]')];
function setView(id) { game.setView(id); viewBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === id))); }
viewBtns.forEach(b => b.addEventListener('click', () => { setView(b.dataset.view); b.blur(); }));
const castBtns = [...document.querySelectorAll('[data-cast]')];
function setCast(c) { S.cast = c; castBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cast === c))); }
castBtns.forEach(b => b.addEventListener('click', () => { setCast(b.dataset.cast); b.blur(); }));
const speedBtns = [...document.querySelectorAll('[data-speed]')];
function setSpeed(v) { S.speed = v; speedBtns.forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.speed === v))); }
speedBtns.forEach(b => b.addEventListener('click', () => { setSpeed(+b.dataset.speed); b.blur(); }));
const tog = (id, get, set) => { const b = $(id); const sync = () => b.setAttribute('aria-pressed', String(get())); b.addEventListener('click', () => { set(!get()); sync(); b.blur(); }); sync(); return sync; };
const syncBones = tog('boneBtn', () => S.bones, v => { S.bones = v; });
const syncProps = tog('propsBtn', () => S.props, v => { S.props = v; });
const syncSpin = tog('spinBtn', () => S.spin, v => { S.spin = v; if (!v) S.facing = null; });
const syncTrue = tog('trueBtn', () => S.trueCam, v => { S.trueCam = v; hero.o.charView = !v; });
const syncAI = tog('aiBtn', () => !$('ai').hidden, v => { $('ai').hidden = !v; });
const syncSword = tog('swordBtn', () => S.sword, v => { S.sword = v; });
$('playBtn').addEventListener('click', e => { S.playing = !S.playing; syncInfo(); e.currentTarget.blur(); });

/* 8. The AI panel: the clip as a model reads it (editable), the catalog a model picks from, the format */
const TOK = 2, PROSE = 3.5;   // characters per token (cl100k, measured): the clip text 1.98, the catalog and legend 3.4-3.5
const tokens = (txt, per = TOK) => Math.round(txt.length / per);
const tabs = [...document.querySelectorAll('[data-tab]')], panes = { text: $('paneText'), catalog: $('paneCatalog'), format: $('paneFormat') };
function setTab(id) { tabs.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tab === id))); for (const [k, el] of Object.entries(panes)) el.hidden = k !== id; if (id === 'format') showFormat(); }
tabs.forEach(b => b.addEventListener('click', () => { setTab(b.dataset.tab); b.blur(); }));
const textEl = $('clipText'), textNote = $('textNote');
function showText() {
  const txt = lib.text(S.clip);
  textEl.value = txt;
  textNote.textContent = (lib.edited(S.clip.name) ? 'Edited. ' : '') + S.clip.keys.length + ' key poses, ~' + tokens(txt) + ' tokens. Edit, then Apply (Ctrl+Enter): both figures play your version.';
  textNote.className = 'tnote';
}
function apply() {
  try { const o = MocapReadable.parse(textEl.value); S.clip = lib.replace(S.clip.name, o); showText(); syncInfo(); }
  catch (e) { textNote.textContent = 'Not applied: ' + e.message; textNote.className = 'tnote bad'; }
}
$('applyBtn').addEventListener('click', apply);
$('resetBtn').addEventListener('click', () => { S.clip = lib.restore(S.clip.name); showText(); syncInfo(); });
$('mirrorBtn').addEventListener('click', () => { S.clip = lib.replace(S.clip.name, MocapReadable.mirror(S.clip)); showText(); });
$('copyBtn').addEventListener('click', () => { if (navigator.clipboard) navigator.clipboard.writeText(Mocap.LEGEND + '\n' + textEl.value).then(() => { textNote.textContent = 'Copied with the legend: ready to paste into a model.'; }, () => {}); });
textEl.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); apply(); } });
// the catalog: one line per clip, what a model reads to choose (it never needs the key poses to pick)
function showCatalog() {
  if (S.set === LIB && LIBRARY.index) {   // the library: one line a take (src/mocap/catalogs/cmu-takes.tsv has them measured)
    const T = LIBRARY.index.takes, txt = '// ' + T.length + ' CMU takes. id | seconds | category | what the subject does\n' + T.map(([id, , cat, sec, desc]) => id + ' | ' + sec + ' | ' + cat + ' | ' + (desc || 'undescribed')).join('\n');
    $('catalog').textContent = txt; $('catalogNote').textContent = '~' + tokens(txt, PROSE) + ' tokens for all ' + T.length + ' takes. The ledger, src/mocap/catalogs/cmu-takes.tsv, has each one measured.'; return;
  }
  const txt = '// ' + lib.names.length + ' clips. name | seconds | loop or once | tags | what the body does | library (= the clip it was made from) (take: the recording and the seconds used, for motion capture)\n' + S.order.map(n => {
    const c = lib.clip(n); return n + ' | ' + c.dur.toFixed(2) + ' | ' + (c.loop ? 'loop' : 'once') + ' | ' + (c.tags || []).join(' ') + ' | ' + (c.desc || '') + ' | ' + c.src + (c.orig ? ' (= ' + c.orig + ')' : '') + (c.take ? ' (take ' + c.take + ')' : '');
  }).join('\n');
  $('catalog').textContent = txt; $('catalogNote').textContent = '~' + tokens(txt, PROSE) + ' tokens for all ' + lib.names.length + ' clips. A model picks from this list, then opens only the clips it uses.';
}
$('legend').textContent = Mocap.LEGEND; $('legendNote').textContent = 'The legend a model reads once (~' + tokens(Mocap.LEGEND, PROSE) + ' tokens):';
let formatDone = false;
/** the set at a glance: its size as text and how closely it keeps to the captures it came from */
function showFormat() {
  if (formatDone) return; formatDone = true;
  const fits = Object.values(lib.set.fit || {}), keys = lib.names.reduce((t, n) => t + lib.clip(n).keys.length, 0), text = lib.names.map(n => lib.text(lib.clip(n))).join('\n');
  const mean = fits.length ? fits.reduce((t, f) => t + f[0], 0) / fits.length : 0, worst = fits.length ? Math.max(...fits.map(f => f[1])) : 0;
  $('formatRows').innerHTML = [['Clips', lib.names.length], ['Key poses', keys], ['As text', (text.length / 1024).toFixed(0) + ' KB, ~' + Math.round(tokens(text) / 1000) + 'k tokens'],
    ['Per clip, typically', '~' + Math.round(tokens(text) / lib.names.length) + ' tokens'], ['Body points from the capture', 'on average ' + mean.toFixed(0) + ' mm, at worst ' + worst + ' mm'],
    ['Libraries', Object.entries(lib.set.sources).map(([id, s]) => id + ' (' + s.rig + ' rig)').join(', ')]]
    .map(([k, v]) => '<tr><th>' + k + '</th><td>' + v + '</td></tr>').join('');
}

/* 9. Keys */
const step = d => { S.playing = false; S.t = clamp(S.t + d / 30, 0, S.clip.dur); S.hold = 0; syncInfo(); };
addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('textarea, input, select')) return;   // typing in the panel
  const order = E.VIEW_ORDER, i = S.order.indexOf(S.clip.name);
  if (e.code === 'ArrowDown' || e.code === 'KeyS') { play(S.order[(i + 1) % S.order.length]); e.preventDefault(); }
  else if (e.code === 'ArrowUp' || e.code === 'KeyW') { play(S.order[(i - 1 + S.order.length) % S.order.length]); e.preventDefault(); }
  else if (e.code === 'Space') { S.playing = !S.playing; syncInfo(); e.preventDefault(); }
  else if (e.code === 'Comma' || e.code === 'ArrowLeft') step(-1);
  else if (e.code === 'Period' || e.code === 'ArrowRight') step(1);
  else if (e.repeat) return;
  else if (e.code === 'KeyV') setView(order[(order.indexOf(game.view.id) + 1) % order.length]);
  else if (/^Digit[1-5]$/.test(e.code)) setView(order[+e.code.slice(5) - 1]);
  else if (e.code === 'KeyC') setCast(CASTS[(CASTS.indexOf(S.cast) + 1) % CASTS.length]);
  else if (e.code === 'KeyT') setSpeed(S.speed === 1 ? .5 : S.speed === .5 ? .25 : 1);
  else if (e.code === 'KeyB') { S.bones = !S.bones; syncBones(); }
  else if (e.code === 'KeyO') { S.props = !S.props; syncProps(); }
  else if (e.code === 'KeyP') { S.spin = !S.spin; if (!S.spin) S.facing = null; syncSpin(); }
  else if (e.code === 'KeyH') { S.trueCam = !S.trueCam; hero.o.charView = !S.trueCam; syncTrue(); }
  else if (e.code === 'KeyA') { $('ai').hidden = !$('ai').hidden; syncAI(); }
  else if (e.code === 'KeyX') { S.sword = !S.sword; syncSword(); }
  else if (e.code === 'KeyG') setSet(CYCLE[(CYCLE.indexOf(S.set) + 1) % CYCLE.length], S.clip.name);
  else if (e.code === 'KeyQ') S.facing = facing() - Math.PI / 8;
  else if (e.code === 'KeyE') S.facing = facing() + Math.PI / 8;
  else if (e.code === 'BracketLeft') game.rotateView(-15);
  else if (e.code === 'BracketRight') game.rotateView(15);
  else if (e.code === 'Minus') game.setZoom(game.zoom / 1.25);
  else if (e.code === 'Equal') game.setZoom(game.zoom * 1.25);
  else if (e.code === 'Digit0') { game.resetCamera(); game.setZoom(1.5); S.facing = null; }
});
addEventListener('wheel', e => { if (e.target.closest && e.target.closest('.list, .ai')) return; game.setZoom(game.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)); }, { passive: true });

/** the side panels start below whatever sits above them (the buttons wrap, the clip's note grows) */
function placePanels() {
  const wide = innerWidth > 1100, below = el => Math.round(el.getBoundingClientRect().bottom + 8) + 'px';
  $('ai').style.top = wide ? below(document.querySelector('.controls')) : '';
  const side = $('clips').closest('.side'), sr = side.getBoundingClientRect();
  let top = document.querySelector('.brand').getBoundingClientRect().bottom;
  for (const g of document.querySelectorAll('.controls > *')) { const r = g.getBoundingClientRect(); if (r.left < sr.right && r.width) top = Math.max(top, r.bottom); }   // a button row that reaches over the list
  side.style.top = innerWidth > 900 && innerHeight > 560 ? Math.round(top + 8) + 'px' : '';
}
addEventListener('resize', placePanels);
game.lights.enabled = false; hero.o.charView = !S.trueCam;
$('ai').hidden = innerWidth < 1100; syncAI();
setView(E.VIEWS[qs.get('view')] ? qs.get('view') : 'threequarter');
game.setZoom(innerWidth < 600 ? 1.8 : 1.5);   // the figures are the subject: start close
setCast(S.cast); setSpeed(S.speed); setTab('text');
{ const want = S.set, clip = decodeURIComponent(location.hash.slice(1)) || 'Idle_Loop';
  if (want === LIB) setSet(SET_IDS[0], 'Idle_Loop');   // (a set to stand on while the library's index loads)
  setSet(want, clip); }
game.start({ update, draw: r => { draw(r); $('fps').textContent = game.fps + ' fps'; } });
/** for tools (recordings, tests): switch sets, play a clip, seek to a time, change the view or the cast */
window.__mocap = { game, SETS, get lib() { return lib; }, LIBRARY, libIndex, playLib, setLibrary, hero, man, S, pos, groundLift, play, setSet, setView, setCast, setSpeed, apply, seek(t) { S.playing = false; S.t = t; S.hold = 0; }, resume() { S.playing = true; } };
})();
