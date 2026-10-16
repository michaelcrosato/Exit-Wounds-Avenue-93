/* =============================================================================
 * PERSPECTIVE LAB  the smallest complete my-3D2dge game. Copy this file to start a new one.
 * One room, one hero, two creatures, every camera view the engine ships with.
 * ============================================================================= */
(() => {
'use strict';
const E = My3D2dge, { px, clamp, approach, TAU } = E;

/* 1. Game: canvas + starting view. Everything else hangs off `game`. */
const game = new E.Game({ canvas: document.getElementById('screen'), menu: false, corner: false, fullscreen: 'button', view: 'threequarter', minH: 200, maxW: 520, portrait: { maxH: 1000 }, bg: '#0d0b14' });
const P = game.particles;

/* 2. Map: 0 = floor, other ids = wall types (height in world units, colors). */
const MW = 14, MH = 10, T = 16;
const cells = new Array(MW * MH).fill(0);
for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (!x || !y || x === MW - 1 || y === MH - 1) cells[y * MW + x] = 1;
cells[3 * MW + 4] = 2; cells[6 * MW + 9] = 2;
const PAL = { stones: ['#6b6f5a', '#767a63', '#626653'].map(E.hex), mortar: E.hex('#3a3c31'), hi: E.hex('#8b8f75'), lo: E.hex('#51543f'), speck: E.hex('#45473a') };
const map = new E.TileMap({
  w: MW, h: MH, tile: T, cells,
  floorTex: (x, y) => E.tex.flagstone(x, y, PAL),
  types: { 1: { h: 40, cut: true, cutH: 6, top: '#8a8470', side: '#625d4d', course: 8 }, 2: { h: 34, top: '#9a9480', side: '#6d6856', course: 8 } }
});
game.cam.bounds = v => map.bounds(v);

/* 2b. Objects: the engine's core shapes (docs/ASSETS.md), a line of data each, right in every view [id, x, y, facing]. */
const OBJECTS = [['bookcase', 2.6 * T, 1.45 * T, Math.PI / 2], ['table', 7.5 * T, 2.1 * T, 0], ['stool', 6.4 * T, 2.4 * T, 0], ['stool', 8.6 * T, 1.9 * T, 0],
  ['barrel', 12.25 * T, 1.75 * T, 0], ['barrel', 12.3 * T, 2.85 * T, 1.2], ['chest', 2.1 * T, 8.2 * T, -Math.PI / 2]];

/* 3. Characters: a rig is just math + colors. */
const hero = { x: 7 * T, y: 6 * T, vx: 0, vy: 0, r: 4.5, facing: 0, atk: null, dashT: 0,
  rig: new E.Humanoid({ cape: { len: 6, width: 5, seg: 2.5 } }) };
const walker = { x: 4 * T, y: 6 * T, vx: 0, vy: 0, r: 5, facing: 0, t: 0,
  rig: new E.Humanoid({ weapon: null, hood: true, colors: { cloth: '#7a5ab8', hair: '#4a3470', cape: '#e0b040', capeIn: '#8a6a20' }, cape: { len: 5, width: 4, seg: 2.4 } }) };
const slime = { x: 10 * T, y: 3.5 * T, z: 0, vz: 0, r: 6, t: 1, blob: new E.Blob({ R: 6, colors: { base: '#5fb4d9', lt: '#b8ecff', dk: '#2a5a86' } }) };
const SWING = { a0: 1.75, a1: -1.95, z0: 13, z1: 10, reach: 7.5 };
const DUR = { wind: .07, active: .1, recover: .22 };

/* 4. Update: fixed small steps. Read input, move, collide, pose rigs. */
function update(dt) {
  const inp = game.input, h = hero;
  const mv = inp.move(), d = game.view.screenDirToGround(mv[0], mv[1]);
  if (inp.buffered('dash') && h.dashT <= 0) { inp.consume('dash'); h.dashT = .18; P.dust(h.x, h.y, 0, 5); }
  if (h.dashT > 0) { h.dashT -= dt; h.vx = Math.cos(h.facing) * 220; h.vy = Math.sin(h.facing) * 220; }
  else { h.vx = approach(h.vx, d[0] * 75, 900 * dt); h.vy = approach(h.vy, d[1] * 75, 900 * dt); }
  if (Math.hypot(d[0], d[1]) > .1 && !h.atk) h.facing = E.approachAng(h.facing, Math.atan2(d[1], d[0]), dt * 14);
  if (inp.buffered('attack') && !h.atk) { inp.consume('attack'); h.atk = { phase: 'wind', t: 0 }; }
  if (h.atk) {
    h.atk.t += dt;
    if (h.atk.t >= DUR[h.atk.phase]) { h.atk.t = 0; h.atk.phase = h.atk.phase === 'wind' ? 'active' : h.atk.phase === 'active' ? 'recover' : null; if (!h.atk.phase) h.atk = null; }
  }
  h.x += h.vx * dt; h.y += h.vy * dt; map.collide(h);
  h.rig.update(dt, { x: h.x, y: h.y, vx: h.vx, vy: h.vy, facing: h.facing, dash: h.dashT > 0,
    attack: h.atk ? { spec: SWING, phase: h.atk.phase, u: clamp(h.atk.t / DUR[h.atk.phase], 0, 1) } : null });

  // the walker strolls a figure-eight so you can watch the gait from every angle
  const w = walker; w.t += dt * .45;
  const tx = 4.5 * T + Math.sin(w.t) * 34, ty = 5.5 * T + Math.sin(w.t * 2) * 18;
  w.vx = (tx - w.x) / dt * .05; w.vy = (ty - w.y) / dt * .05; w.x += w.vx * dt; w.y += w.vy * dt;
  w.facing = E.approachAng(w.facing, Math.atan2(w.vy, w.vx), dt * 6);
  w.rig.update(dt, { x: w.x, y: w.y, vx: w.vx, vy: w.vy, facing: w.facing });

  // the slime hops in place, looking at the hero
  const s = slime; s.t -= dt;
  if (s.z <= 0 && s.t <= 0) { s.vz = 140; s.t = 1.1; s.blob.kick(4); }
  s.vz -= 460 * dt; s.z = Math.max(0, s.z + s.vz * dt);
  if (s.z === 0 && s.vz < -60) { s.vz = 0; s.blob.kick(-5); P.dust(s.x, s.y, 0, 4); }
  s.blob.update(dt, { squash: s.z > 0 ? clamp(s.vz / 600, -.2, .28) : s.t < .25 ? -.3 : 0, look: [h.x - s.x, h.y - s.y] });

  game.focus(h.x, h.y, 8);
}

/* 5. Draw: floor, decals, then queue everything that sorts by depth. */
function draw(r) {
  const view = r.view;
  map.drawFloor(r);
  for (const a of [hero, walker]) r.shadow(a.x, a.y, 5.5, .45);
  r.shadow(slime.x, slime.y, 6, .45);
  map.queueWalls(r);
  r.queue(10.5 * T, 7 * T, 0, g => { r.box(g, 10 * T, 6.6 * T, 0, 11 * T, 7.4 * T, 10, '#b08a58', '#7a5a36'); });
  for (const [id, x, y, facing] of OBJECTS) r.shape(id, x, y, 0, { facing });
  r.actor(hero.x, hero.y, 0, (g, ox, oy) => hero.rig.draw(g, ox, oy, view), { xray: true, ghost: hero.dashT > 0 ? { color: '#62d8ff' } : null });
  hero.rig.drawSmear(r);
  r.actor(walker.x, walker.y, 0, (g, ox, oy) => walker.rig.draw(g, ox, oy, view));
  r.actor(slime.x, slime.y, slime.z, (g, ox, oy) => slime.blob.draw(g, ox, oy, view));
  game.lights.add(hero.x, hero.y, 10, 90, .9);
  game.lights.add(10.5 * T, 7 * T, 14, 80, .7);
  if (showRig) r.overlay(() => { hero.rig.debug(r); walker.rig.debug(r); });
  r.overlay(g => E.font.text(g, view.label.toUpperCase(), 6, r.H - 10, '#f1e4c8'));
}

/* 6. UI: view buttons, toggles. */
const $ = id => document.getElementById(id);
let showRig = false;
const btns = [...document.querySelectorAll('[data-view]')];
const NOTES = {
  iso: 'Yaw 45°, pitch 30°, 2:1 pixels. Diablo, Bastion.',
  threequarter: 'Yaw 0°, pitch 55°, height boosted. Zelda, Stardew Valley.',
  topdown: 'Yaw 0°, pitch 80°. Hotline Miami, GTA.',
  brawler: 'Yaw 0°, pitch 25°. Streets of Rage, Castle Crashers.',
  side: 'Yaw 0°, pitch 0°. Up and down walk into the screen. Platformers use this view.'
};
function setView(id) { game.setView(id); btns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === id))); $('note').textContent = NOTES[id]; }
btns.forEach(b => b.addEventListener('click', () => { setView(b.dataset.view); b.blur(); }));
const tog = (id, get, set) => { const b = $(id); b.addEventListener('click', () => { set(!get()); b.setAttribute('aria-pressed', String(get())); b.blur(); }); return () => b.setAttribute('aria-pressed', String(get())); };
const syncRig = tog('rigBtn', () => showRig, v => { showRig = v; });
const syncLight = tog('lightBtn', () => game.lights.enabled, v => { game.lights.enabled = v; });
const syncSlow = tog('slowBtn', () => game.timeScale < 1, v => { game.timeScale = v ? .25 : 1; });
addEventListener('keydown', e => {
  if (e.repeat) return;
  const order = E.VIEW_ORDER;
  if (e.code === 'KeyV') setView(order[(order.indexOf(game.view.id) + 1) % order.length]);
  else if (/^Digit[1-5]$/.test(e.code)) setView(order[+e.code.slice(5) - 1]);
  else if (e.code === 'KeyR') { showRig = !showRig; syncRig(); }
  else if (e.code === 'KeyL') { game.lights.enabled = !game.lights.enabled; syncLight(); }
  else if (e.code === 'KeyT') { game.timeScale = game.timeScale < 1 ? 1 : .25; syncSlow(); }
});
game.input.bindButtons(document);
game.lights.ambient = .35;
setView('threequarter');
game.start({ update, draw: r => { draw(r); $('fps').textContent = game.fps + ' fps'; } });
window.__game = { game, hero, setView };
})();
