/* ============================== GAME START ==============================
 * MY-3D2DGE 3D STARTER: a title menu and the 3D slices (a 3D genre kit file holds one). Each slice is a complete small
 * 3D game, written to be copied and changed:
 *   SLICE 1  ACTION      a torch-lit hall (Zelda 64's dungeons, Diablo, the stress test's own): a three-hit combo, a
 *                        dash and its thrust, a jump, an ember bolt; husks, skeletons, slimes and wisps in waves that
 *                        take turns to attack, telegraphs, hit-stop, crates to smash; a knight boss
 *   SLICE 2  PLATFORMER  a sunlit course over the void (Mario 64, Spyro): run, jump, double jump, a dash in the air;
 *                        stairs, ledges, floating and moving platforms, springs; slimes to stomp, coins, three stars,
 *                        checkpoint flags and a goal
 * THE 3D WORLD UNDER THE GAME: E.Game runs the game as it runs a 2D one (scenes, exact fixed steps, input, the pause
 * menu, settings, sound) with bg: null, so its canvas is clear; E.World3D draws the 3D world under it (three.js r182 and
 * Rapier 0.19.3). A slice's scene steps its world in update (world.step(dt)) and draws it in draw (world.draw(r)), then
 * its HUD over it on r, in the game's pixels. FULL SCREEN, ANY SHAPE: res 'ps1', expand: the HUD anchors to r.W, r.H.
 * KEYS EVERY SLICE SHARES: C changes the camera (the view, the chase camera, first person), V the view, [ ] turn it, the
 * wheel, - and = (a pinch on a phone) zoom, 0 resets it, M mutes; the pause menu's Display has the 3D settings
 * (characters as cards or puppets, the picture's resolution, shadows).
 * To make your own game: copy the slice closest to your genre, then replace everything between GAME START and GAME END
 * with ONLY your game: its own title, play and game-over scenes. Deep links: #action, #platformer.
 * ======================================================================== */
const E = My3D2dge, W3 = E.World3D, { clamp, lerp, approach, TAU } = E;

/* ---- SHELL: one game, several scenes, each slice with its own world ----
 * bg: null keeps the game's canvas clear over the 3D picture; E.World3D.INPUT: WASD move, Space jump, J or a click
 * attack, Shift dash, E skill, C camera; E.World3D.SETTINGS: the 3D settings in the pause menu */
const game = new E.Game({ canvas: 'screen', res: 'ps1', expand: true, bg: null, input: W3.INPUT, menu: { settings: W3.SETTINGS } });
const P = game.particles, A = game.audio;
const scenes = {}, BOOT = [];    // BOOT: the slices' heavy setup, [label, fn] steps run behind the boot screen
const SLICES = [
  { id: 'action', label: 'ACTION', about: 'A 3D ARENA: COMBOS, DASHES AND WAVES' },
  { id: 'platformer', label: 'PLATFORMER', about: 'A 3D COURSE: ISLANDS, PLATFORMS AND COINS' }
];
// a prompt in the player's own controls ('J Sword', 'X Sword', 'ATTACK Sword' on a touch screen)
// (a phone or tablet before its first touch counts too: a coarse pointer and nothing else used yet)
const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const prompt = (a, word) => game.input.label(a) + ' ' + word, touch = () => game.input.lastDevice === 'touch' || (coarse && game.input.lastDevice === 'keyboard');
// START picks too (the touch START, a pad's Start), as Enter does
const pickOnStart = m => { if (game.input.pressed('start')) { game.input.consumeAll(); m.onPick(m.i, m.items[m.i]); } };
let active = null;               // the world of the scene that is playing (the shared keys turn its camera)

/* ---- the camera: C cycles the view, the chase camera and first person; V, [ ] and 0 work on the view (and turn the
 * others) ---- */
const CAMS = ['view', 'chase', 'first'], CAM_NAME = { chase: 'CHASE CAMERA', first: 'FIRST PERSON' };
const viewName = () => game.view.label.toUpperCase() + ' VIEW';
/** the camera key (input action 'camera'), read in a slice's update */
function cameraKey(world) {
  if (!game.input.pressed('camera')) return;
  const c = world.camera, m = CAMS[(CAMS.indexOf(c.mode) + 1) % CAMS.length]; c.set(m); game.note(m === 'view' ? viewName() : CAM_NAME[m]);
}
addEventListener('keydown', e => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || game.paused) return;
  if (e.code === 'KeyV') { game.nextView(); if (active) active.camera.set('view'); game.note(viewName()); }
  else if (e.code === 'Digit0') { game.settings.set('zoom', 1); game.resetCamera(); game.note('CAMERA RESET'); }
  else if (e.code === 'BracketLeft' || e.code === 'BracketRight') { game.rotateView(e.code === 'BracketLeft' ? -45 : 45); game.note('TURN ' + game.yaw); }
  else if (e.code === 'KeyM') A.mute();
});
/** a dark veil over the 3D picture (the title's lower third, a game over) */
const veil = (g, r, y0, a = .55) => { g.save(); g.fillStyle = '#05030c'; g.globalAlpha = a; g.fillRect(0, y0, r.bw, r.bh - y0); g.restore(); g._c = null; };

/* ---- TITLE: a little stage in 3D, the slices' heroes on it in torchlight, the camera turning round them ---- */
const TITLE_LEVEL = {
  rows: [
    '                    ',
    ' ################## ',
    ' #t......PP......t# ',
    ' #.......PP.......# ',
    ' #................# ',
    ' #....========....# ',
    ' #....========....# ',
    ' #....========....# ',
    ' #.....^^^^^^.....# ',
    ' #t..............t# ',
    ' #................# ',
    '                    '],
  legend: { '=': { floor: 8, side: 'block', color: '#4a4360' }, '^': { stairs: 'n', floor: 8 } }
};
let title = null;
const TITLE_CAST = [
  { x: -18, face: 0, rig: () => new E.Humanoid({ cape: { len: 6, width: 5, seg: 2.5 }, colors: { cloth: '#2f8f86', cape: '#c8452f', capeIn: '#7a2622', hair: '#2e2230' } }) },
  { x: 18, face: 0, rig: () => new E.Humanoid({ weapon: null, hat: 'cap', build: 'heroic', colors: { cloth: '#d83a2a', pants: '#2f5fd0', glove: '#f0f0f0', hat: '#d83a2a' } }) }
];
BOOT.push(['The title stage', () => {
  const w = new W3(game, { level: TITLE_LEVEL, fog: { near: 140, far: 600 }, torchShadows: 1 }), cx = w.width / 2, cy = 6.5 * 16;
  const heroes = TITLE_CAST.map(c => { const a = w.hero({ x: cx + c.x, y: cy, rig: c.rig(), facing: Math.PI / 2 }); a.anim = { pose: null }; return a; });
  const slime = w.mob({ x: cx - 44, y: cy + 30, blob: new E.Blob({ R: 6.2, face: 'front', ears: 'cat' }) }), wisp = w.mob({ x: cx + 44, y: cy + 24, orb: { color: '#c78bff' }, fly: true });
  w.thing('star', cx, cy - 26, 8 + 12, { spin: .35, bob: 3 });
  w.camera.set('fixed');
  title = { world: w, cx, cy, heroes, slime, wisp, t: 0 };
}]);
const titleMenu = new E.Menu(game, SLICES.map(s => s.label), { y: 'center', onPick: i => game.go(SLICES[i].id) });
scenes.title = {
  view: 'iso', input: W3.INPUT,
  enter() { A.music('title'); active = null; game.resetCamera(); },
  update(dt) {
    if (!titleMenu.update(dt)) pickOnStart(titleMenu);
    const T = title, w = T.world; T.t += dt;
    // the camera turns slowly round the stage; the heroes swing now and then; the slime hops, the wisp hovers
    const a = T.t * .18 + 2.2, d = 120;
    w.camera.fixed = { x: T.cx + Math.cos(a) * d, y: T.cy + Math.sin(a) * d, z: 58, yaw: a + Math.PI, pitch: -.36, fov: 50 };
    T.heroes.forEach((h, i) => {
      const u = (T.t * .45 + i * .5) % 3, swing = u < .5 ? { spec: { a0: 1.4, a1: -1.6, z0: 12, z1: 8, reach: 7.5 }, phase: u < .15 ? 'wind' : 'active', u: u < .15 ? u / .15 : (u - .15) / .35 } : null;
      h.facing = Math.atan2(Math.sin(a), Math.cos(a)) + (i ? -.5 : .5); h.anim = { attack: swing };
    });
    if (T.slime.grounded && (T.t % 1.6) < dt) T.slime.vz = 140;
    T.slime.anim = { squash: T.slime.grounded ? 0 : .2 };
    T.wisp.vz = (8 + 20 + Math.sin(T.t * 2) * 3 - T.wisp.z) * 4;
    w.step(dt);
  },
  draw(r) {
    title.world.draw(r);
    const top = Math.max(10, Math.round(r.H * .1)), my = Math.round(r.H * .58);
    titleMenu.y = my;
    r.overlay(g => {
      veil(g, r, my - 14, .5);
      E.font.title(g, 'my-3D2dge', r.W / 2, top, { align: 'center', scale: 4, colors: ['#fffbe8', '#ffe08a', '#ffb347', '#e0662a'], depth: 3 });
      E.font.title(g, '3D', r.W / 2, top + 36, { align: 'center', scale: 3, colors: ['#e8fcff', '#8af4ff', '#2aa0e0'], depth: 2, depthColor: '#14304a' });
      E.font.text(g, SLICES[titleMenu.i].about, r.W / 2, r.H - 14, '#ffe7a8', { align: 'center', shadow: '#000', outline: false });
    });
    titleMenu.draw(r);
    const dev = game.input.lastDevice, how = dev === 'touch' ? 'Tap a game to play it' : dev === 'gamepad' ? 'D-pad + ' + game.input.label('confirm') + '   ' + game.input.label('start') + ' menu' : 'Arrows + Enter or click   M mute';
    r.text(how, r.W / 2, r.H - 26, '#b8b0d8', { align: 'center', shadow: '#000', outline: false });
  }
};

/* ---- GAME OVER and COURSE CLEAR: shared by every slice, over its world, frozen where it ended ---- */
const overMenu = new E.Menu(game, ['Retry', 'Title'], { y: 'center', onPick: i => game.go(i === 0 ? over.from : 'title') });
let over = { from: 'title', world: null, won: false, lines: [] };
scenes.over = {
  input: W3.INPUT,
  enter(d) { over = Object.assign({ won: false, lines: [] }, d); overMenu.i = 0; A.music(over.won ? 'victory' : null); if (!over.won) A.sfx('die'); active = null; },
  update(dt) { if (!overMenu.update(dt)) pickOnStart(overMenu); },
  back() { game.go('title'); return true; },   // a phone's back gesture: to the title, not off the page
  draw(r) {
    if (over.world) over.world.draw(r);
    const y = Math.round(r.H / 2) - 70; overMenu.y = y + 70 + over.lines.length * 10;
    r.overlay(g => {
      veil(g, r, 0, .6);
      E.font.title(g, over.won ? over.title || 'CLEAR!' : 'GAME OVER', r.W / 2, y, { align: 'center', scale: 4, colors: over.won ? ['#fffbe8', '#ffe08a', '#ffb347'] : ['#ffe0e0', '#ff7a6a', '#c8202a'], depthColor: over.won ? '#3a2008' : '#3a0810' });
      over.lines.forEach((l, i) => E.font.text(g, l, r.W / 2, y + 44 + i * 10, '#f0e6ff', { align: 'center', shadow: '#000', outline: false }));
    });
    overMenu.draw(r);
  }
};
