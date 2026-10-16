/* =============================================================================
 * EMBERWELL  a small action-RPG arena built on my-3D2dge
 * One game, every view: set window.MY3D2DGE_CONFIG = { view: 'iso' } (or
 * 'threequarter', 'topdown', 'brawler') before this script, or use ?view= in the URL.
 * Sections: setup, map, props, hero, enemies, combat, waves, draw, HUD.
 * ============================================================================= */
(() => {
'use strict';
const E = My3D2dge, { px, clamp, lerp, approach, TAU } = E;
const CFG = window.MY3D2DGE_CONFIG || {};
const qs = new URLSearchParams(location.search);

/* ---------- setup ---------- */
const canvas = document.getElementById('screen');
const hashView = location.hash.slice(1), startView = qs.get('view') || (E.VIEWS[hashView] ? hashView : null) || CFG.view || 'iso';   // arena.html#threequarter
const game = new E.Game({ canvas, menu: false, corner: false, fullscreen: 'button', view: startView, minH: 200, maxW: 540, portrait: { maxH: 1000 }, bg: '#06050b' });
const P = game.particles;
game.lights.enabled = true;
game.lights.ambient = .1;

/* ---------- map ---------- */
const MW = 30, MH = 22, T = 16, CX = MW * T / 2, CY = MH * T / 2;
const cells = new Array(MW * MH).fill(0);
const setCell = (x, y, v) => { cells[y * MW + x] = v; };
for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (x === 0 || y === 0 || x === MW - 1 || y === MH - 1) setCell(x, y, 1);
for (const [px0, py0] of [[6, 5], [22, 5], [6, 15], [22, 15]]) for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) setCell(px0 + x, py0 + y, 2);
for (const [x, y] of [[3, 10], [3, 11], [26, 10], [26, 11], [13, 3], [16, 3], [13, 18], [16, 18]]) setCell(x, y, 3);

const PAL = {
  stones: ['#4b4559', '#554f64', '#433e51', '#5d566c'].map(E.hex), mortar: E.hex('#221e2b'),
  hi: E.hex('#6f6782'), lo: E.hex('#322d3e'), speck: E.hex('#2a2634')
};
// runes carry a 4th value: how strongly they glow under GPU lighting
const RUNE = [...E.hex('#2f7f82'), .45], RUNE_HI = [...E.hex('#6fd6cc'), 1], MOSS = [E.hex('#3f5a44'), E.hex('#4d6b4b')];
function floorTex(x, y) {
  const dx = x - CX, dy = y - CY, d = Math.hypot(dx, dy);
  if (Math.abs(d - 54) < .8 || Math.abs(d - 43) < .6) return RUNE;
  if (d > 43 && d < 54) {
    const a = (Math.atan2(dy, dx) / TAU + 1) * 16, k = a % 1;
    if (k < .05) return RUNE;
    if (Math.abs(d - 48.5) < 2 && E.hash2(Math.floor(a), Math.floor(d * .5)) > .35 && ((Math.floor(x) + Math.floor(y)) & 1)) return RUNE_HI;
  }
  if (d < 7) return d < 3 ? RUNE_HI : Math.abs(d - 5.5) < .7 ? RUNE : E.tex.flagstone(x, y, PAL);
  let c = E.tex.flagstone(x, y, PAL);
  const edge = Math.min(x - T, y - T, MW * T - T - x, MH * T - T - y);
  if (edge < 22 && E.noise2(x * .13, y * .13) > .5 + edge * .014) c = MOSS[E.hash2(x | 0, y | 0) < .5 ? 0 : 1];
  return c;
}
const map = new E.TileMap({
  w: MW, h: MH, tile: T, cells, floorTex,
  types: {
    1: { h: 46, cut: true, cutH: 7, top: '#57506a', side: '#3d3750', line: '#2a2538', course: 8 },
    2: { h: 40, top: '#6a6280', side: '#4a4360', line: '#302a40', course: 10 },
    3: { h: 12, top: '#5d566f', side: '#433d55', line: '#2e2940', course: 6 }
  }
});
game.cam.bounds = v => map.bounds(v);
const flow = new E.FlowField(map);
// WebGPU lighting: torch shadows, light that wraps around characters, glow, heat shimmer.
// Falls back to the Canvas lighting when WebGPU is missing.
const gpu = game.enableGPU({ map, ambient: [.15, .14, .24], wrap: .5, bands: 6, offscreen: qs.has('gpu-offscreen') });

/* ---------- props ---------- */
const braziers = [[9.5, 8], [20.5, 8], [9.5, 14], [20.5, 14]].map(([x, y]) => ({ x: x * T, y: y * T, r: 5, t: Math.random() * 9 }));
const sconces = [4, 10.5, 19.5, 26].map(x => ({ x: x * T, y: T + 1, z: 28, t: Math.random() * 9 }));
function pushFromCircle(a, b, rad) {
  const dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy), m = a.r + rad;
  if (d < m && d > .001) { a.x = b.x + dx / d * m; a.y = b.y + dy / d * m; }
}
// the arena's stores: the engine's core shapes (docs/ASSETS.md: a few lines of data each, right in every view), heaped in
// the corners; each pushes bodies off a circle, as the braziers do [id, x, y (tiles), facing, scale, radius]
const stores = [['barrel', 2, 2.1, 0, .85, 6], ['barrel', 3.1, 1.8, 1, .85, 6], ['crate', 2.2, 3.3, .3, .8, 7], ['crate', 27.7, 2, -.2, .8, 7], ['crate', 27.75, 2, -.5, .62, 0, 11],
  ['sack', 26.6, 1.9, .5, .9, 4], ['chest', 2.4, 19.6, -Math.PI / 2, .9, 7], ['pot', 3.6, 20, 0, 1, 3], ['jar', 4.3, 19.7, 0, 1, 2.5], ['barrel', 27.6, 19.8, 2, .85, 6], ['sack', 26.5, 20, 0, .9, 4]]
  .map(([id, x, y, facing, scale, r, z]) => ({ id, x: x * T, y: y * T, r, o: { facing, scale, z: z || 0 } }));
function collideWorld(a) { map.collide(a); for (const b of braziers) pushFromCircle(a, b, b.r); for (const s of stores) if (s.r) pushFromCircle(a, s, s.r); }

/* ---------- hero ---------- */
const SPEED = 78;
// a three-hit combo from the engine's move library: each move winds up, strikes with a step and a lean, follows through
// and settles back. range / half / dmg / kb / push are this game's own fields (push = forward speed as the strike starts)
const SWINGS = [
  Object.assign({}, E.MOVES.slash, { range: 27, half: 1.35, dmg: 12, kb: 130, push: 70 }),
  Object.assign({}, E.MOVES.backslash, { range: 27, half: 1.35, dmg: 12, kb: 130, push: 70 }),
  Object.assign({}, E.MOVES.spin, { wind: .12, active: .24, recover: .3, range: 31, half: Math.PI, dmg: 22, kb: 230, push: 40 })
];
const hero = {
  x: CX, y: CY + 40, z: 0, vx: 0, vy: 0, r: 4.5, facing: -Math.PI / 2, aim: undefined, hp: 100, max: 100,
  inv: 0, hurtT: 0, dashT: 0, dashCD: 0, dashDir: 0, boltCD: 0, atk: null, lastN: -1, comboT: 0, dead: false, deadT: 0, lastGhost: 0, flash: 0,
  rig: new E.Humanoid({ cape: { len: 6, width: 5, seg: 2.5 }, colors: { cloth: '#2f8f86', cape: '#c8452f', capeIn: '#7a2622', hair: '#2e2230' } })
};
const phaseDur = A => A.phase === 'wind' ? A.spec.wind : A.phase === 'active' ? A.spec.active : A.spec.recover;

function updateHero(dt) {
  const h = hero, inp = game.input, view = game.view;
  h.inv -= dt; h.hurtT -= dt; h.dashCD -= dt; h.boltCD -= dt; h.comboT -= dt; h.flash -= dt;
  if (h.dead) {
    h.deadT += dt; h.vx *= .9; h.vy *= .9;
    if (h.deadT > 1.2 && inp.buffered('attack', .3)) { inp.consume('attack'); resetGame(); }
    return;
  }
  const mv = inp.move(), md = view.screenDirToGround(mv[0], mv[1]), mlen = Math.hypot(md[0], md[1]);
  let aimA = null;
  if (inp.aimSource === 'mouse') { const m = game.mouseGround(); if (m && Math.hypot(m[0] - h.x, m[1] - h.y) > 3) aimA = Math.atan2(m[1] - h.y, m[0] - h.x); }
  else if (inp.aimSource === 'pad' && inp.padAim) { const d = view.screenDirToGround(inp.padAim[0], inp.padAim[1]); aimA = Math.atan2(d[1], d[0]); }
  if (aimA === null && mlen > .1) aimA = Math.atan2(md[1], md[0]);
  if (aimA !== null) h.aim = aimA;

  if (inp.buffered('dash', .12) && h.dashCD <= 0 && h.dashT <= 0 && h.hurtT <= 0) {
    inp.consume('dash');
    const a = mlen > .1 ? Math.atan2(md[1], md[0]) : h.facing;
    h.dashDir = a; h.dashT = .2; h.dashCD = .5; h.inv = Math.max(h.inv, .24); h.atk = null; h.facing = a;
    P.dust(h.x, h.y, 0, 6, { speed: 40 }); P.ring(h.x, h.y, 3, 14, '#bff6ff', .25); h.rig.kick(-3);
  }
  if (h.dashT > 0) {
    h.dashT -= dt;
    const u = 1 - h.dashT / .2, sp = 260 * (1 - .5 * u * u);
    h.vx = Math.cos(h.dashDir) * sp; h.vy = Math.sin(h.dashDir) * sp;
  } else {
    const slow = h.atk ? .25 : 1, acc = (h.hurtT > 0 ? 200 : 900) * dt;
    h.vx = approach(h.vx, md[0] * SPEED * slow, acc); h.vy = approach(h.vy, md[1] * SPEED * slow, acc);
  }

  if (inp.buffered('attack', .18) && h.dashT <= 0 && h.hurtT <= 0 && (!h.atk || (h.atk.phase === 'recover' && h.atk.t > .04))) {
    inp.consume('attack');
    const n = h.atk ? (h.atk.n + 1) % 3 : (h.comboT > 0 ? (h.lastN + 1) % 3 : 0);
    h.atk = { n, spec: SWINGS[n], phase: 'wind', t: 0, hit: new Set() };
    if (h.aim !== undefined) h.facing = h.aim;
  }
  if (h.atk) {
    const A = h.atk, sp = A.spec; A.t += dt;
    if (A.phase === 'wind' && A.t >= sp.wind) {
      A.phase = 'active'; A.t -= sp.wind;
      h.vx += Math.cos(h.facing) * sp.push; h.vy += Math.sin(h.facing) * sp.push;
      if (sp.spin) P.ring(h.x, h.y, 6, 30, '#dff8ff', .3);
    } else if (A.phase === 'active') { swingHits(); if (A.t >= sp.active) { A.phase = 'recover'; A.t -= sp.active; } }
    else if (A.phase === 'recover' && A.t >= sp.recover) { h.lastN = A.n; h.comboT = .3; h.atk = null; }
  }
  if (inp.buffered('skill', .15) && h.boltCD <= 0 && h.dashT <= 0 && h.hurtT <= 0) { inp.consume('skill'); fireBolt(); h.boltCD = .45; }
  if (!h.atk && h.dashT <= 0 && h.aim !== undefined) h.facing = E.approachAng(h.facing, h.aim, dt * 16);

  h.x += h.vx * dt; h.y += h.vy * dt;
  collideWorld(h);
  h.rig.update(dt, {
    x: h.x, y: h.y, z: 0, vx: h.vx, vy: h.vy, facing: h.facing, dash: h.dashT > 0, hurt: h.hurtT > 0,
    attack: h.atk ? { spec: h.atk.spec, phase: h.atk.phase, u: clamp(h.atk.t / phaseDur(h.atk), 0, 1) } : null
  });
}

function hurtHero(dmg, ang) {
  const h = hero;
  if (h.inv > 0 || h.dead) return;
  h.hp -= dmg; h.inv = .8; h.hurtT = .25; h.flash = .12; h.atk = null;
  h.vx += Math.cos(ang) * 170; h.vy += Math.sin(ang) * 170;
  game.freeze(.06); game.shake(4);
  P.sparks(h.x, h.y, 12, 8, ang, { color: '#ff6a4a' }); P.text(h.x, h.y, 30, '-' + dmg, '#ff7a6a');
  if (h.hp <= 0) {
    h.hp = 0; h.dead = true; h.deadT = 0;
    P.bits(h.x, h.y, 8, 20, ['#2f8f86', '#c8452f', '#f1c7a0']); P.ring(h.x, h.y, 4, 34, '#ff7a6a', .5);
    banner('You fell', 'Press attack to rise again');
  }
}

/* ---------- projectiles ---------- */
const shots = [];
function fireBolt() {
  const h = hero, a = h.aim !== undefined ? h.aim : h.facing;
  h.facing = a;
  const hand = h.rig.J.handR ? h.rig.worldOffset(h.rig.J.handR) : [0, 0, 12];
  shots.push({ x: h.x + hand[0] + Math.cos(a) * 4, y: h.y + hand[1] + Math.sin(a) * 4, z: Math.max(8, hand[2]), vx: Math.cos(a) * 250, vy: Math.sin(a) * 250, life: 1.1, from: 'hero', dmg: 9, color: '#ffb347', core: '#fff3c4', r: 3 });
  P.sparks(h.x + Math.cos(a) * 8, h.y + Math.sin(a) * 8, 12, 4, a, { color: '#ffb347' });
  h.rig.kick(1.5);
}
function updateShots(dt) {
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i];
    s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt;
    if (Math.random() < dt * 40) P.add({ kind: 'ember', x: s.x, y: s.y, z: s.z, vx: (Math.random() - .5) * 20, vy: (Math.random() - .5) * 20, vz: 10, max: .3, color: s.color });
    let dead = s.life <= 0;
    if (map.solidAt(s.x, s.y)) { dead = true; P.sparks(s.x, s.y, s.z, 8, Math.atan2(-s.vy, -s.vx), { color: s.color }); }
    if (!dead && s.from === 'hero') {
      for (const e of enemies) {
        if (!e.alive || e.spawnT > 0) continue;
        if (Math.hypot(e.x - s.x, e.y - s.y) < e.r + s.r && Math.abs((e.z || 0) + 8 - s.z) < 16) { damageEnemy(e, s.dmg, Math.atan2(s.vy, s.vx), 70, false); dead = true; break; }
      }
    } else if (!dead && s.from === 'enemy' && !hero.dead) {
      if (Math.hypot(hero.x - s.x, hero.y - s.y) < hero.r + s.r) { hurtHero(s.dmg, Math.atan2(s.vy, s.vx)); dead = true; }
    }
    if (dead) { P.ring(s.x, s.y, 1, 9, s.color, .2); shots.splice(i, 1); }
  }
}

/* ---------- enemies ---------- */
const enemies = [];
const HUSK = { wind: .45, active: .14, recover: .5, range: 22 };
const HUSK_SWING = { a0: 1.5, a1: -.8, z0: 16, z1: 7, reach: 6.5, blade: 0 };
function makeHusk(x, y) {
  return {
    type: 'husk', x, y, z: 0, vx: 0, vy: 0, r: 5, hp: 32, max: 32, facing: Math.atan2(hero.y - y, hero.x - x), state: 'chase', t: 0, stun: 0, flash: 0, spawnT: .7, alive: true,
    speed: 28 + Math.random() * 10, head: 30,
    rig: new E.Humanoid({ weapon: null, hunch: .4, lean: .18, stride: 5, swing: 2.5, speedRef: 40, armLower: 5.6, headR: 3.2, eyeGlow: '#ff6a3d',
      colors: { skin: '#8fa38a', hair: '#3a3f38', cloth: '#5b4a3c', pants: '#3d3530', boot: '#2c2622', belt: '#7a6a4a' } })
  };
}
function makeSlime(x, y) {
  return { type: 'slime', x, y, z: 0, vx: 0, vy: 0, vz: 0, r: 6, hp: 20, max: 20, state: 'idle', t: .4 + Math.random() * .6, stun: 0, flash: 0, spawnT: .7, alive: true, head: 16,
    blob: new E.Blob({ R: 6.2 }) };
}
function makeWisp(x, y) {
  return { type: 'wisp', x, y, z: 20, vx: 0, vy: 0, r: 5, hp: 14, max: 14, t: Math.random() * 9, fire: 1.6 + Math.random(), charge: 0, stun: 0, flash: 0, spawnT: .7, alive: true,
    orbit: Math.random() < .5 ? 1 : -1, head: 10 };
}
const MAKERS = { husk: makeHusk, slime: makeSlime, wisp: makeWisp };

function updateEnemies(dt) {
  flow.update(hero.x, hero.y);
  for (const e of enemies) {
    if (!e.alive) continue;
    e.flash -= dt; e.stun -= dt;
    if (e.spawnT > 0) {
      e.spawnT -= dt;
      if (Math.random() < dt * 50) P.add({ kind: 'ember', x: e.x + (Math.random() - .5) * 10, y: e.y + (Math.random() - .5) * 10, z: 0, vz: 40 + Math.random() * 40, max: .5, color: '#7fe3d6' });
      continue;
    }
    if (e.type === 'husk') updateHusk(e, dt);
    else if (e.type === 'slime') updateSlime(e, dt);
    else updateWisp(e, dt);
  }
  for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
    const a = enemies[i], b = enemies[j]; if (!a.alive || !b.alive) continue;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r;
    if (d < m && d > .01) { const k = (m - d) / d * .5; a.x -= dx * k; a.y -= dy * k; b.x += dx * k; b.y += dy * k; }
  }
  for (let i = enemies.length - 1; i >= 0; i--) if (!enemies[i].alive) enemies.splice(i, 1);
}
function updateHusk(e, dt) {
  const h = hero, dx = h.x - e.x, dy = h.y - e.y, d = Math.hypot(dx, dy) || 1, toH = Math.atan2(dy, dx);
  let mvx = 0, mvy = 0;
  if (e.stun > 0) { /* knocked back */ }
  else if (e.state === 'chase') {
    let dir = (d < 70 && map.los(e.x, e.y, h.x, h.y)) ? [dx / d, dy / d] : flow.dir(e.x, e.y, h.x, h.y);
    if (h.dead) dir = [0, 0];
    mvx = dir[0] * e.speed; mvy = dir[1] * e.speed;
    if (dir[0] || dir[1]) e.facing = E.approachAng(e.facing, Math.atan2(dir[1], dir[0]), dt * 5);
    if (d < 21 && !h.dead) { e.state = 'wind'; e.t = 0; }
  } else if (e.state === 'wind') {
    e.t += dt; e.facing = E.approachAng(e.facing, toH, dt * 2.5);
    if (e.t >= HUSK.wind) { e.state = 'active'; e.t = 0; e.hitDone = false; e.vx += Math.cos(e.facing) * 90; e.vy += Math.sin(e.facing) * 90; }
  } else if (e.state === 'active') {
    e.t += dt;
    if (!e.hitDone && d < HUSK.range + h.r && Math.abs(E.angDiff(e.facing, toH)) < 1.1) { e.hitDone = true; hurtHero(12, toH); }
    if (e.t >= HUSK.active) { e.state = 'recover'; e.t = 0; }
  } else if (e.state === 'recover') { e.t += dt; if (e.t >= HUSK.recover) e.state = 'chase'; }
  const acc = (e.stun > 0 ? 160 : 500) * dt;
  e.vx = approach(e.vx, mvx, acc); e.vy = approach(e.vy, mvy, acc);
  e.x += e.vx * dt; e.y += e.vy * dt; collideWorld(e);
  const ph = e.state === 'wind' || e.state === 'active' || e.state === 'recover' ? e.state : null;
  e.rig.update(dt, { x: e.x, y: e.y, z: 0, vx: e.vx, vy: e.vy, facing: e.facing, hurt: e.stun > 0,
    attack: ph && e.stun <= 0 ? { spec: HUSK_SWING, phase: ph, u: clamp(e.t / HUSK[ph], 0, 1) } : null });
}
function updateSlime(e, dt) {
  const h = hero, dx = h.x - e.x, dy = h.y - e.y, d = Math.hypot(dx, dy) || 1;
  const grounded = e.z <= 0 && e.vz <= 0;
  if (grounded) {
    e.vx = approach(e.vx, 0, 400 * dt); e.vy = approach(e.vy, 0, 400 * dt);
    if (e.stun <= 0 && !h.dead) {
      e.t -= dt;
      if (e.state === 'idle' && e.t <= 0) { e.state = 'crouch'; e.t = .28; }
      else if (e.state === 'crouch' && e.t <= 0) {
        const dir = d < 60 ? [dx / d, dy / d] : flow.dir(e.x, e.y, h.x, h.y);
        e.state = 'air'; e.vz = 150; e.vx = dir[0] * 72; e.vy = dir[1] * 72; e.blob.kick(4.5);
      }
    }
  }
  if (e.state === 'air' || e.z > 0) {
    e.vz -= 480 * dt; e.z += e.vz * dt;
    if (e.z <= 0) { e.z = 0; e.vz = 0; e.state = 'idle'; e.t = .45 + Math.random() * .5; e.blob.kick(-5); P.dust(e.x, e.y, 0, 4, { speed: 25 }); }
  }
  e.x += e.vx * dt; e.y += e.vy * dt; collideWorld(e);
  if (!h.dead && e.z < 5 && d < e.r + h.r) hurtHero(8, Math.atan2(dy, dx));
  e.blob.update(dt, { squash: e.state === 'crouch' ? -.32 : e.z > 0 ? clamp(e.vz / 600, -.2, .28) : 0, look: [dx, dy], squint: e.state === 'crouch' });
}
function updateWisp(e, dt) {
  const h = hero, dx = h.x - e.x, dy = h.y - e.y, d = Math.hypot(dx, dy) || 1;
  e.t += dt;
  let ax = 0, ay = 0;
  if (e.stun <= 0) {
    const want = d > 100 ? 1 : d < 70 ? -1 : 0;
    ax = dx / d * want * 60 + (-dy / d) * e.orbit * 34; ay = dy / d * want * 60 + (dx / d) * e.orbit * 34;
  }
  e.vx += (ax - e.vx * 1.6) * dt; e.vy += (ay - e.vy * 1.6) * dt;
  e.x += e.vx * dt; e.y += e.vy * dt; collideWorld(e);
  e.z = 20 + Math.sin(e.t * 2) * 3;
  if (!h.dead && e.stun <= 0) {
    if (e.charge > 0) {
      e.charge -= dt;
      if (e.charge <= 0) {
        const a = Math.atan2(dy, dx);
        shots.push({ x: e.x, y: e.y, z: e.z, vx: Math.cos(a) * 95, vy: Math.sin(a) * 95, life: 3, from: 'enemy', dmg: 10, color: '#c78bff', core: '#f4e6ff', r: 3 });
        e.fire = 2 + Math.random() * 1.2;
      }
    } else { e.fire -= dt; if (e.fire <= 0) e.charge = .6; }
  }
}

/* ---------- combat ---------- */
function swingHits() {
  const A = hero.atk, sp = A.spec;
  for (const e of enemies) {
    if (!e.alive || e.spawnT > 0 || A.hit.has(e)) continue;
    const dx = e.x - hero.x, dy = e.y - hero.y, d = Math.hypot(dx, dy);
    if (d > sp.range + e.r) continue;
    if (!sp.spin && Math.abs(E.angDiff(hero.facing, Math.atan2(dy, dx))) > sp.half) continue;
    A.hit.add(e);
    damageEnemy(e, sp.dmg, Math.atan2(dy, dx), sp.kb, sp.spin);
  }
}
const BITS = { husk: ['#8fa38a', '#5b4a3c', '#3d3530'], slime: ['#c95f9a', '#f5a3cc', '#6d2658'], wisp: ['#c78bff', '#f4e6ff', '#7a4ac0'] };
function damageEnemy(e, dmg, ang, kb, big) {
  e.hp -= dmg; e.flash = .1; e.stun = .22;
  e.vx += Math.cos(ang) * kb; e.vy += Math.sin(ang) * kb;
  if (e.type === 'husk') { e.state = 'chase'; e.rig.kick(2.5); }
  if (e.type === 'slime') { e.blob.kick(5); e.state = 'idle'; e.t = .5; }
  if (e.type === 'wisp') e.charge = 0;
  game.freeze(big ? .075 : .055); game.shake(big ? 3.5 : 2.4);
  const z = e.type === 'wisp' ? e.z : 10;
  P.sparks(lerp(hero.x, e.x, .6), lerp(hero.y, e.y, .6), z, 9, ang);
  P.ring(e.x, e.y, 2, 12, '#fff3c4', .18);
  P.text(e.x, e.y, (e.z || 0) + e.head + 4, dmg, big ? '#ffd36a' : '#fff2c4');
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  e.alive = false; kills++;
  P.bits(e.x, e.y, (e.z || 0) + 6, 16, BITS[e.type]);
  P.dust(e.x, e.y, 0, 8, { speed: 45, size: 1.6 });
  P.ring(e.x, e.y, 3, 24, BITS[e.type][1], .35);
  game.freeze(.08); game.shake(2);
  if (Math.random() < .3) orbs.push({ x: e.x, y: e.y, z: 6, vx: (Math.random() - .5) * 40, vy: (Math.random() - .5) * 40, vz: 90, t: 0 });
}

/* ---------- pickups ---------- */
const orbs = [];
function updateOrbs(dt) {
  for (let i = orbs.length - 1; i >= 0; i--) {
    const o = orbs[i]; o.t += dt;
    o.vz -= 400 * dt; o.z += o.vz * dt;
    if (o.z < 0) { o.z = 0; o.vz = Math.abs(o.vz) > 30 ? -o.vz * .5 : 0; o.vx *= .6; o.vy *= .6; }
    const dx = hero.x - o.x, dy = hero.y - o.y, d = Math.hypot(dx, dy) || 1;
    if (o.t > .4 && d < 56 && !hero.dead) { o.vx += dx / d * 500 * dt; o.vy += dy / d * 500 * dt; }
    o.x += o.vx * dt; o.y += o.vy * dt;
    if (d < 8 && !hero.dead && hero.hp < hero.max) {
      const heal = Math.min(12, hero.max - hero.hp); hero.hp += heal;
      P.text(hero.x, hero.y, 30, '+' + heal, '#8dffb0'); P.ring(hero.x, hero.y, 2, 14, '#8dffb0', .3);
      orbs.splice(i, 1); continue;
    }
    if (o.t > 14) orbs.splice(i, 1);
  }
}

/* ---------- waves ---------- */
let wave = 0, kills = 0, spawnQueue = [], spawnTimer = 0, waveGap = 1.2;
function startWave() {
  wave++;
  const list = [];
  for (let i = 0; i < 1 + wave; i++) list.push('husk');
  for (let i = 0; i < Math.floor((wave + 1) / 2); i++) list.push('slime');
  for (let i = 0; i < Math.floor(wave / 2); i++) list.push('wisp');
  for (let i = list.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [list[i], list[j]] = [list[j], list[i]]; }
  spawnQueue = list; spawnTimer = .3;
  banner('Wave ' + wave, wave === 1 ? 'Clear the hall' : list.length + ' foes rise');
  P.ring(CX, CY, 8, 60, '#7fe3d6', .8);
}
function spawnPoint() {
  for (let k = 0; k < 60; k++) {
    const cx = 2 + ((Math.random() * (MW - 4)) | 0), cy = 2 + ((Math.random() * (MH - 4)) | 0);
    if (map.cell(cx, cy) !== 0) continue;
    const x = (cx + .5) * T, y = (cy + .5) * T;
    if (Math.hypot(x - hero.x, y - hero.y) < 110) continue;
    if (braziers.some(b => Math.hypot(b.x - x, b.y - y) < 14) || stores.some(b => Math.hypot(b.x - x, b.y - y) < 16)) continue;
    return [x, y];
  }
  return [CX, 2.5 * T];
}
function updateWaves(dt) {
  if (hero.dead) return;
  if (spawnQueue.length) {
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      const [x, y] = spawnPoint();
      enemies.push(MAKERS[spawnQueue.shift()](x, y));
      P.ring(x, y, 2, 16, '#7fe3d6', .5);
      spawnTimer = .35;
    }
  } else if (!enemies.length) { waveGap -= dt; if (waveGap <= 0) { waveGap = 1.6; startWave(); } }
}
function resetGame() {
  enemies.length = 0; shots.length = 0; orbs.length = 0; spawnQueue = [];
  Object.assign(hero, { x: CX, y: CY + 40, vx: 0, vy: 0, hp: hero.max, dead: false, inv: 1, atk: null, dashT: 0, hurtT: 0 });
  hero.rig.capeL = null;
  wave = 0; kills = 0; waveGap = .8;
}

/* ---------- update ---------- */
function update(dt) {
  updateHero(dt);
  updateEnemies(dt);
  updateShots(dt);
  updateOrbs(dt);
  updateWaves(dt);
  for (const b of braziers) { b.t += dt; if (Math.random() < dt * 9) P.add({ kind: 'ember', x: b.x + (Math.random() - .5) * 5, y: b.y + (Math.random() - .5) * 5, z: 14, vx: (Math.random() - .5) * 8, vy: (Math.random() - .5) * 8, vz: 18 + Math.random() * 22, max: .7 + Math.random() * .6, color: '#ff8a3a' }); }
  for (const s of sconces) s.t += dt;
  const a = hero.aim !== undefined ? hero.aim : hero.facing;
  game.focus(hero.x + Math.cos(a) * 16, hero.y + Math.sin(a) * 16, 8);
}

/* ---------- draw ---------- */
const flicker = t => .9 + Math.sin(t * 13) * .05 + Math.sin(t * 29) * .04 + Math.sin(t * 7.3) * .04;
function drawFlame(g, r, x, y, z, t, s = 1) {
  const sc = r.view.scale;
  px.glow(g, 1);
  for (let k = 0; k < 3; k++) {
    const a = k * 2.1 + t * .6, bx = x + Math.cos(a) * 1.6 * s, by = y + Math.sin(a) * 1.6 * s;
    const h = (7 + Math.sin(t * 9 + k * 2) * 2.2 + Math.sin(t * 17 + k) * 1.2) * s, sw = Math.sin(t * 6 + k * 1.7) * 1.4;
    const [x0, y0] = r.w(bx, by, z), [tx, ty] = r.w(bx + sw, by, z + h), w = 2.2 * s * sc;
    px.poly(g, [[x0 - w, y0], [tx, ty], [x0 + w, y0]], '#ff7a2a');
    const [mx, my] = r.w(bx + sw * .5, by, z + h * .65);
    px.poly(g, [[x0 - w * .55, y0], [mx, my], [x0 + w * .55, y0]], '#ffd36a');
  }
  const [cx, cy] = r.w(x, y, z + 1); px.rect(g, cx - 1, cy - 1, 2, 2, '#fff4c8');
}
function drawBrazier(g, r, b) {
  r.box(g, b.x - 3, b.y - 3, 0, b.x + 3, b.y + 3, 8, '#5d566f', '#433d55');
  px.poly(g, r.groundPts(b.x, b.y, 5.5, 14, 11), '#2b2430');
  px.poly(g, r.groundPts(b.x, b.y, 5.5, 14, 9), '#3a3036');
  px.glow(g, .9); px.poly(g, r.groundPts(b.x, b.y, 4, 12, 11.2), '#ff8a3c');
  drawFlame(g, r, b.x, b.y, 11, b.t);
}
function drawSconce(g, r, s) {
  r.box(g, s.x - 2, s.y - 1, s.z - 6, s.x + 2, s.y + 3, s.z - 3, '#6a5a48', '#4a3e34');
  drawFlame(g, r, s.x, s.y + 1.5, s.z - 3, s.t, .7);
}
function drawWisp(g, ox, oy, e) {
  const k = e.charge > 0 ? 1 + (1 - e.charge / .6) * .8 : 1, f = e.flash > 0;
  game.r.glowDisc(g, ox, oy, 7 * k, '#7a4ac0', .55);
  px.disc(g, ox, oy, 3.2 * k, f ? '#ffffff' : '#c78bff');
  px.disc(g, ox - .5, oy - .5, 1.8 * k, '#f4e6ff');
  for (let i = 0; i < 3; i++) { const a = e.t * 4 + i * TAU / 3; px.dot(g, ox + Math.cos(a) * 6, oy + Math.sin(a) * 3, '#e3c8ff'); }
  for (let i = 1; i < 4; i++) px.dot(g, ox - e.vx * .03 * i + Math.sin(e.t * 9 + i) * .8, oy + i * 1.6, i < 2 ? '#c78bff' : '#7a4ac0');
}
function draw(r) {
  const view = r.view, L = game.lights, t = game.time;
  map.drawFloor(r);
  // ground decals: shadows and telegraphs
  const shadow = (x, y, rad) => r.shadow(x, y, rad, .55);
  if (!hero.dead) shadow(hero.x, hero.y, 5.5);
  for (const e of enemies) {
    if (!e.alive) continue;
    shadow(e.x, e.y, e.type === 'wisp' ? 3.5 : e.type === 'slime' ? 6 - Math.min(3, e.z * .1) : 5.5);
    if (e.type === 'husk' && e.state === 'wind' && e.stun <= 0) {
      const u = clamp(e.t / HUSK.wind, 0, 1);
      r.decal(() => r.groundArc(e.x, e.y, 4, 4 + 20 * u, e.facing - 1.05, e.facing + 1.05, '#ff4a3a', .25 + .45 * u), { emissive: .2 + .35 * u });
    }
  }
  for (const o of orbs) shadow(o.x, o.y, 2.5);
  map.queueWalls(r);
  for (const s of stores) r.shape(s.id, s.x, s.y, s.o.z, s.o);
  for (const b of braziers) {
    r.queue(b.x, b.y, 0, g => drawBrazier(g, r, b));
    L.add(b.x, b.y, 16, 124, 1.25 * flicker(b.t), { color: '#ff9a4a', shadow: true });
    L.caster(b.x, b.y, 4.5, 11); L.heat(b.x, b.y, 17, 7, 1.1);
  }
  for (const s of sconces) {
    r.queue(s.x, s.y + 4, 0, g => drawSconce(g, r, s));
    L.add(s.x, s.y + 7, s.z, 92, 1.05 * flicker(s.t + 3), { color: '#ffb465', shadow: true });
    L.heat(s.x, s.y + 1.5, s.z - 1, 5, .8);
  }
  // the rune circle breathes a cold light that also casts shadows
  L.add(CX, CY, 3, 78, .5 + .12 * Math.sin(t * 1.7), { color: '#4fe0cc', shadow: true });
  // enemies
  for (const e of enemies) {
    if (!e.alive) continue;
    if (e.spawnT <= 0) { if (e.type === 'husk') L.caster(e.x, e.y, 3.2, 22); else if (e.type === 'slime') L.caster(e.x, e.y, 5, e.z + 11); }
    const alpha = e.spawnT > 0 ? clamp(1 - e.spawnT / .7, .05, 1) : 1, flash = e.flash > 0;
    if (e.type === 'husk') r.actor(e.x, e.y, 0, (g, ox, oy) => e.rig.draw(g, ox, oy, view), { flash, alpha });
    else if (e.type === 'slime') r.actor(e.x, e.y, e.z, (g, ox, oy) => e.blob.draw(g, ox, oy, view), { flash, alpha });
    else { r.actor(e.x, e.y, e.z, (g, ox, oy) => drawWisp(g, ox, oy, e), { rim: false, alpha, emissive: 1 }); L.add(e.x, e.y, e.z, 52, .8, { color: '#b78bff' }); }
  }
  // hero
  if (!hero.dead) {
    const h = hero, ghost = h.dashT > 0 && t - h.lastGhost > .03;
    if (ghost) h.lastGhost = t;
    const blink = h.inv > 0 && h.hurtT <= 0 && Math.floor(game.real * 16) % 2 === 0;
    r.actor(h.x, h.y, 0, (g, ox, oy) => h.rig.draw(g, ox, oy, view), { xray: true, flash: h.flash > 0 ? '#ffb0a0' : false, alpha: blink ? .45 : 1, ghost: ghost ? { color: '#62d8ff', life: .22 } : null });
    h.rig.drawSmear(r);
    if (r.gpu) { L.add(h.x, h.y, 18, 84, .6, { color: '#c9c2ec' }); L.caster(h.x, h.y, 3.2, 24); }
    else L.add(h.x, h.y, 10, 82, .8);
  }
  // projectiles and pickups
  for (const s of shots) {
    r.queue(s.x, s.y, s.z, g => { px.glow(g, 1); const [x, y] = r.w(s.x, s.y, s.z); px.ddisc(g, x, y, 5, s.color, .5, r.ix, r.iy); px.disc(g, x, y, 2, s.color); px.dot(g, x, y, s.core); });
    L.add(s.x, s.y, s.z, s.from === 'hero' ? 44 : 34, .85, { color: s.color });
  }
  for (const o of orbs) {
    r.queue(o.x, o.y, o.z, g => { px.glow(g, .7); const [x, y] = r.w(o.x, o.y, o.z + 3 + Math.sin(t * 5) * .8); px.disc(g, x, y, 2.4, '#8a1f2e'); px.disc(g, x, y, 1.6, '#e8475a'); px.dot(g, x - 1, y - 1, '#ffd0d6'); });
    L.add(o.x, o.y, 4, 22, .45, { color: '#ff5a6a' });
  }
  // overlays: health bars and debug skeletons
  r.overlay(g => {
    for (const e of enemies) {
      if (!e.alive || e.spawnT > 0 || e.hp >= e.max) continue;
      const [x, y] = r.w(e.x, e.y, (e.z || 0) + e.head + 3), w = 14, f = Math.max(0, Math.round(w * e.hp / e.max));
      px.rect(g, x - w / 2 - 1, y - 1, w + 2, 4, '#140b12'); px.rect(g, x - w / 2, y, f, 2, '#e0463c'); px.rect(g, x - w / 2, y, f, 1, '#ff8a74');
    }
    if (showRig) {
      if (!hero.dead) hero.rig.debug(r);
      for (const e of enemies) if (e.alive && e.rig) e.rig.debug(r);
      for (const e of [hero, ...enemies]) if (e.alive !== false) r.groundRing(e.x, e.y, e.r, '#46f0ff', 1);
    }
  });
}

/* ---------- HUD ---------- */
const $ = id => document.getElementById(id);
const NOTES = {
  iso: 'Isometric: the camera is turned 45° and tilted 30°, like Diablo and Bastion.',
  threequarter: 'Three-quarter: the camera faces north, tilted 55°, like Zelda and Stardew Valley.',
  topdown: 'Top-down: nearly straight down, like Hotline Miami.',
  brawler: 'Brawler: a low camera, like Streets of Rage.'
};
const VIEWS = ['iso', 'threequarter', 'topdown', 'brawler'];
let showRig = false, bannerT = 0;
const viewBtns = [...document.querySelectorAll('[data-view]')];
function syncView() {
  if (typeof gpuBtn !== "undefined") syncGPU();
  viewBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === game.view.id)));
  $('note').textContent = NOTES[game.view.id] || '';
}
function setView(id) { game.setView(id); syncView(); }
viewBtns.forEach(b => b.addEventListener('click', () => { setView(b.dataset.view); b.blur(); }));
const slowBtn = $('slowBtn'), rigBtn = $('rigBtn'), gpuBtn = $('gpuBtn');
const GPU_NOTES = {
  loading: 'Starting GPU lighting...',
  on: 'GPU lighting is on: torch shadows, light that wraps around characters, glowing runes and heat shimmer.',
  off: 'Standard lighting. Press G to switch GPU lighting back on.',
  unavailable: 'WebGPU is not available here, so the standard lighting is shown.'
};
function syncGPU() {
  const st = gpu.status();
  gpuBtn.setAttribute('aria-pressed', String(st === 'on'));
  gpuBtn.disabled = st === 'unavailable' || st === 'loading';
  gpuBtn.title = st === 'unavailable' ? gpu.failed : '';
  $('gpuNote').textContent = game.view.inv ? GPU_NOTES[st] : '';
}
gpu.onStatus = syncGPU;
function setGPU(v) { if (gpu.status() === 'unavailable') return; gpu.enabled = v; syncGPU(); }
gpuBtn.addEventListener('click', () => { setGPU(!gpu.enabled); gpuBtn.blur(); });
const setSlow = v => { game.timeScale = v ? .25 : 1; slowBtn.setAttribute('aria-pressed', String(v)); };
const setRig = v => { showRig = v; rigBtn.setAttribute('aria-pressed', String(v)); };
slowBtn.addEventListener('click', () => { setSlow(game.timeScale === 1); slowBtn.blur(); });
rigBtn.addEventListener('click', () => { setRig(!showRig); rigBtn.blur(); });
addEventListener('keydown', e => {
  if (e.repeat) return;
  if (e.code === 'KeyV') setView(VIEWS[(VIEWS.indexOf(game.view.id) + 1) % VIEWS.length]);
  else if (/^Digit[1-4]$/.test(e.code)) setView(VIEWS[+e.code.slice(5) - 1]);
  else if (e.code === 'KeyT') setSlow(game.timeScale === 1);
  else if (e.code === 'KeyR') setRig(!showRig);
  else if (e.code === 'KeyG') setGPU(!gpu.enabled);
});
game.input.bindButtons(document);
function banner(title, sub) { $('bannerTitle').textContent = title; $('bannerSub').textContent = sub; $('banner').classList.add('show'); bannerT = 2.2; }
function hud() {
  $('hpFill').style.width = (hero.hp / hero.max * 100) + '%';
  $('hpText').textContent = Math.ceil(hero.hp) + ' / ' + hero.max;
  $('waveText').textContent = 'Wave ' + Math.max(1, wave) + '   Kills ' + kills;
  $('fps').textContent = game.fps + ' fps';
  if (bannerT > 0) { bannerT -= 1 / 60; if (bannerT <= 0 && !hero.dead) $('banner').classList.remove('show'); }
}

syncView(); syncGPU();
game.start({ update, draw: r => { draw(r); hud(); } });
window.__game = { game, hero, enemies, setView, map, gpu, setGPU };
})();
