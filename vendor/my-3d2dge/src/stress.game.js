/* =============================================================================
 * MY-3D2DGE STRESS TEST
 * Push the engine: thousands of animated monsters, up to 30 shadow-casting torches,
 * particle storms, a pull-back camera that multiplies the pixel count, and toggles
 * for every expensive feature. Live metrics show where each frame's time goes, and
 * the benchmark ramps the crowd up step by step to rate this device.
 * The crowd also shows off the animation kit: monsters take turns (a few attack tokens), walk in
 * to contact distance, fight with their own moves from E.MOVES behind a telegraphed wind-up,
 * flinch when hit and fall down when killed; slimes pounce and wisps pop. The hero chains slash,
 * backslash and spin, thrusts out of a dash, flinches when struck and cheers each cleared wave.
 * ============================================================================= */
(() => {
'use strict';
const E = My3D2dge, { px, clamp, lerp, approach, TAU } = E;
const qs = new URLSearchParams(location.search);

/* ---------- setup ---------- */
const canvas = document.getElementById('screen');
const BASE = { minH: 200, minW: 300, maxW: 540, maxH: 330, portrait: { maxH: 1000 } };
const game = new E.Game(Object.assign({ canvas, menu: false, corner: false, fullscreen: 'button', view: qs.get('view') && qs.get('view') !== 'custom' ? qs.get('view') : 'iso', bg: '#06050b' }, BASE));
const P = game.particles;
game.lights.enabled = true; game.lights.ambient = .12;

const S = { monsters: 0, mix: 'balanced', skin: 'hd', behavior: 'swarm', lights: 12, rate: 0, pcap: 2000, distance: 1, god: true, outlines: true, capes: false, lod: false, monsterLights: false, shapes: 0 };

/* ---------- map: a large hall with a grid of pillars ---------- */
const MW = 64, MH = 44, T = 16, CX = MW * T / 2, CY = MH * T / 2;
const cells = new Array(MW * MH).fill(0);
const setC = (x, y, v) => { if (x >= 0 && y >= 0 && x < MW && y < MH) cells[y * MW + x] = v; };
for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (!x || !y || x === MW - 1 || y === MH - 1) setC(x, y, 1);
for (let py = 7; py < MH - 4; py += 10) for (let pxx = 7; pxx < MW - 4; pxx += 10) {
  if (Math.abs(pxx + 1 - MW / 2) < 6 && Math.abs(py + 1 - MH / 2) < 5) continue;
  for (let k = 0; k < 4; k++) setC(pxx + (k & 1), py + (k >> 1), 2);
}
{
  const R = E.rng(5);
  for (let i = 0; i < 16; i++) {
    const x = 3 + Math.floor(R() * (MW - 8)), y = 3 + Math.floor(R() * (MH - 8)), horiz = R() < .5;
    if (Math.abs(x - MW / 2) < 7 && Math.abs(y - MH / 2) < 6) continue;
    for (let k = 0; k < 3; k++) { const cx = x + (horiz ? k : 0), cy = y + (horiz ? 0 : k); if (cells[cy * MW + cx] === 0) setC(cx, cy, 3); }
  }
}
const PAL = { stones: ['#4b4559', '#554f64', '#433e51', '#5d566c'].map(E.hex), mortar: E.hex('#221e2b'), hi: E.hex('#6f6782'), lo: E.hex('#322d3e'), speck: E.hex('#2a2634') };
const RUNE = [...E.hex('#2f7f82'), .45], RUNE_HI = [...E.hex('#6fd6cc'), 1], MOSS = [E.hex('#3f5a44'), E.hex('#4d6b4b')];
function floorTex(x, y) {
  const dx = x - CX, dy = y - CY, d = Math.hypot(dx, dy);
  if (Math.abs(d - 54) < .8 || Math.abs(d - 43) < .6) return RUNE;
  if (d > 43 && d < 54) {
    const a = (Math.atan2(dy, dx) / TAU + 1) * 16, k = a % 1;
    if (k < .05) return RUNE;
    if (Math.abs(d - 48.5) < 2 && E.hash2(Math.floor(a), Math.floor(d * .5)) > .35 && ((Math.floor(x) + Math.floor(y)) & 1)) return RUNE_HI;
  }
  if (d < 7) return d < 3 ? RUNE_HI : E.tex.flagstone(x, y, PAL);
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
const gpu = game.enableGPU({ map, ambient: [.15, .14, .24], wrap: .5, bands: 6, offscreen: qs.has('gpu-offscreen') });

/* ---------- torches (the first N are lit) ---------- */
const TORCHES = [];
{
  const R = E.rng(9), cand = [];
  for (let ty = 4; ty < MH - 3; ty += 6) for (let tx = 4; tx < MW - 3; tx += 7) {
    const x = tx + ((R() * 2) | 0), y = ty + ((R() * 2) | 0);
    if (Math.hypot(x - MW / 2, y - MH / 2) < 5) continue;
    let ok = true; for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if (cells[(y + oy) * MW + x + ox] !== 0) ok = false;
    if (ok) cand.push({ x: (x + .5) * T, y: (y + .5) * T, r: 4.5, t: R() * 9 });
  }
  for (let i = cand.length - 1; i > 0; i--) { const j = (R() * (i + 1)) | 0; [cand[i], cand[j]] = [cand[j], cand[i]]; }
  TORCHES.push(...cand.slice(0, 30));
}
const activeTorches = () => TORCHES.slice(0, S.lights);
/* ---------- shapes: the engine's core objects (docs/ASSETS.md) strewn through the hall, the first N drawn (the Shapes
 * slider; 0 by default, so a benchmark run as before measures what it did). In the engine's views; the depth view leaves
 * them out ---------- */
const SHAPE_SPOTS = [];
{
  const R = E.rng(17), ids = ['barrel', 'crate', 'chest', 'table', 'chair', 'stool', 'bench', 'pot', 'jar', 'sack', 'cart', 'well', 'sign', 'lamppost', 'anvil', 'bookcase', 'shelf', 'rock', 'crystal', 'bush', 'pine', 'tree', 'grass', 'fence'];
  for (let k = 0; k < 4000 && SHAPE_SPOTS.length < 400; k++) {
    const cx = 2 + ((R() * (MW - 4)) | 0), cy = 2 + ((R() * (MH - 4)) | 0), x = (cx + .5) * T, y = (cy + .5) * T;
    if (cells[cy * MW + cx] !== 0 || Math.hypot(cx - MW / 2, cy - MH / 2) < 6 || TORCHES.some(b => Math.hypot(b.x - x, b.y - y) < 20) || SHAPE_SPOTS.some(p => Math.abs(p.x - x) + Math.abs(p.y - y) < 20)) continue;
    SHAPE_SPOTS.push({ id: ids[SHAPE_SPOTS.length % ids.length], x, y, o: { facing: R() * TAU } });
  }
}
function pushFromCircle(a, b, rad) { const dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy), m = a.r + rad; if (d < m && d > .001) { a.x = b.x + dx / d * m; a.y = b.y + dy / d * m; } }
function collideWorld(a) { map.collide(a); for (let i = 0; i < S.lights; i++) pushFromCircle(a, TORCHES[i], TORCHES[i].r); }

/* ---------- hero ---------- */
// The hero's own moveset from E.MOVES: clicks chain slash > backslash > spin (E.Combo), and attacking during a
// dash is a lunging thrust. HIT gives each move its hit cone (range, half angle), damage, knockback and push (forward speed as the strike starts;
// the rig's own lunge, step and lean come from the move itself).
const SPEED = 80;
const HIT = {
  slash: { range: 27, half: 1.35, dmg: 12, kb: 130, push: 70 },
  backslash: { range: 27, half: 1.35, dmg: 12, kb: 130, push: 70 },
  spin: { range: 34, half: Math.PI, dmg: 22, kb: 230, push: 40, big: true },
  thrust: { range: 38, half: .45, dmg: 20, kb: 220, push: 130, big: true }
};
const CAPE = { len: 6, width: 5, seg: 2.5 };
const hero = {
  x: CX, y: CY + 40, z: 0, vx: 0, vy: 0, r: 4.5, facing: -Math.PI / 2, aim: undefined, hp: 100, max: 100, inv: 0, hurtT: 0, flash: 0,
  dashT: 0, dashCD: 0, dashDir: 0, boltCD: 0, castT: 0, cheer: 0, dead: false, deadT: 0, lastGhost: 0,
  // the backslash ends out to the side (not tip-down in front of the legs), the spin sweeps at the waist so the face stays clear
  combo: new E.Combo(['slash', new E.Attack('backslash', { a1: 2.2, z1: -3 }), new E.Attack('spin', { z0: -12, z1: -12 })], { window: .3 }),
  thrust: new E.Attack('thrust', { reach: 10 }),
  rig: new E.Humanoid({ cape: CAPE, colors: { cloth: '#2f8f86', cape: '#c8452f', capeIn: '#7a2622', hair: '#2e2230' } })
};
let wave = 0;
function updateHero(dt) {
  const h = hero, inp = game.input, view = game.view;
  h.inv -= dt; h.hurtT -= dt; h.dashCD -= dt; h.boltCD -= dt; h.flash -= dt; h.castT -= dt; h.z = 0;
  if (h.cheer > 0 && (h.cheer -= dt) <= 0) setMonsters(S.monsters);   // the next wave marches in after the cheer
  if (h.dead) {   // he topples ('die'), fades, and gets up again in the middle of the hall
    h.deadT += dt; h.rig.update(dt, { x: h.x, y: h.y, facing: h.facing, pose: 'die' });
    if (h.deadT > 2) Object.assign(h, { dead: false, hp: h.max, inv: 1.5, x: CX, y: CY + 40, vx: 0, vy: 0 });
    return;
  }
  const free = h.cheer <= 0, mv = free ? inp.move() : [0, 0], md = view.screenDirToGround(mv[0], mv[1]), mlen = Math.hypot(md[0], md[1]);
  let aimA = null;
  if (inp.aimSource === 'mouse') { const m = game.mouseGround(); if (m && Math.hypot(m[0] - h.x, m[1] - h.y) > 3) aimA = Math.atan2(m[1] - h.y, m[0] - h.x); }
  else if (inp.aimSource === 'pad' && inp.padAim) { const d = view.screenDirToGround(inp.padAim[0], inp.padAim[1]); aimA = Math.atan2(d[1], d[0]); }
  if (aimA === null && mlen > .1) aimA = Math.atan2(md[1], md[0]);
  if (aimA !== null) h.aim = aimA;
  if (free && inp.buffered('dash', .12) && h.dashCD <= 0 && h.dashT <= 0) {
    inp.consume('dash'); const a = mlen > .1 ? Math.atan2(md[1], md[0]) : h.facing;
    Object.assign(h, { dashDir: a, dashT: .2, dashCD: .45, facing: a }); h.inv = Math.max(h.inv, .24); h.combo.cancel(); h.thrust.cancel();
    P.dust(h.x, h.y, 0, 6, { speed: 40 }); P.ring(h.x, h.y, 3, 14, '#bff6ff', .25); h.rig.kick(-3);
  }
  // attack: out of a dash it is the thrust (keeping the dash direction), otherwise the next hit of the combo
  if (free && inp.buffered('attack', .18)) {
    const dashing = h.dashT > 0;
    if (dashing ? h.thrust.start() : !h.thrust.busy && h.combo.press()) {
      inp.consume('attack'); h.dashT = 0;
      if (!dashing && h.aim !== undefined) h.facing = h.aim;
    }
  }
  const A = h.thrust.busy ? h.thrust : h.combo;
  if (h.dashT > 0) { h.dashT -= dt; const u = 1 - h.dashT / .2, sp = 260 * (1 - .5 * u * u); h.vx = Math.cos(h.dashDir) * sp; h.vy = Math.sin(h.dashDir) * sp; }
  else { const slow = A.busy ? .25 : 1, acc = 900 * dt; h.vx = approach(h.vx, md[0] * SPEED * slow, acc); h.vy = approach(h.vy, md[1] * SPEED * slow, acc); }
  // the move plays out: the body lunges on the strike, and each monster in the cone is hit once per swing
  const began = A.update(dt), st = A.state, hit = st && HIT[st.spec.name];
  if (began === 'active') { h.vx += Math.cos(h.facing) * hit.push; h.vy += Math.sin(h.facing) * hit.push; }
  if (hit) A.hits(near(h.x, h.y, 4), e => e.alive && e.spawnT <= 0 && E.inArc(h, h.facing, e, hit.range, hit.half),
    e => damageEnemy(e, hit.dmg, Math.atan2(e.y - h.y, e.x - h.x), hit.kb, hit.big));
  if (free && inp.buffered('skill', .15) && h.boltCD <= 0) { inp.consume('skill'); fireBolt(); h.boltCD = .3; h.castT = .18; }
  // victory (1.6 s): turn to the camera in the guard, cheer (fists pump, sword point up) with little hops, and for the last
  // .4 s drop back into the guard while turning back to the aim, so no pose change and turn happen at once
  const cheering = h.cheer > .4 && h.cheer < 1.35;
  if (cheering) h.z = Math.abs(Math.sin(h.cheer * 4.5)) * 2.5;
  if (!free) h.facing = E.approachAng(h.facing, h.cheer > .4 ? Math.atan2(view.fy, view.fx) : h.aim ?? h.facing, dt * 8);
  else if (!A.busy && h.hurtT > 0) h.facing = E.approachAng(h.facing, h.hitA, dt * 30);   // flinch: a quick turn toward the hit
  else if (!A.busy && h.dashT <= 0 && h.aim !== undefined) h.facing = E.approachAng(h.facing, h.aim, dt * 16);
  h.x += h.vx * dt; h.y += h.vy * dt; collideWorld(h);
  h.rig.update(dt, { x: h.x, y: h.y, z: h.z, vx: h.vx, vy: h.vy, facing: h.facing, dash: h.dashT > 0, hurt: h.hurtT > 0 && !A.busy, attack: A.state,
    pose: cheering ? 'cheer' : !free ? 'guard' : h.castT > 0 ? 'cast' : null, expr: h.hurtT > 0 ? 'wince' : cheering ? 'shout' : null });
  if (h.dashT <= 0 && !(A.active && A.state.u < .6)) settleCape(h.rig, dt, h.hurtT > 0 ? 1 : clamp(1 - Math.hypot(h.vx, h.vy) / 60, 0, 1));
}
// The cape is verlet cloth (x, y, z and the previous px, py, pz). The engine keeps it behind the back and under the shoulders,
// but after a spin, a lunge or a knockback it keeps its swing and floats out like a flag for a moment. So once the strike
// has mostly played out, while the body is slow or staggered (w 0..1), the cloth is drawn toward its hanging shape (straight
// down, a little behind the shoulders) and loses its swing; walking and dashing leave it to trail freely.
function settleCape(rig, dt, w) {
  const k = Math.min(1, dt * 16 * w), fx = Math.cos(rig.facing), fy = Math.sin(rig.facing);
  for (const ch of [rig.capeL, rig.capeR]) ch.forEach((n, i) => {
    n.x = lerp(n.x, ch[0].x - fx * i * .5, k); n.y = lerp(n.y, ch[0].y - fy * i * .5, k); n.z = lerp(n.z, ch[0].z - i * CAPE.seg, k);
    n.px = lerp(n.px, n.x, k); n.py = lerp(n.py, n.y, k); n.pz = lerp(n.pz, n.z, k);
  });
}
// Every hit shows on the hero: a flash, a wince and a stagger. Invincible (the default) skips the damage and keeps the
// combo going; otherwise the hit costs health, cancels the swing and knocks him back further. Returns whether it landed.
function hurtHero(dmg, ang) {
  const h = hero; if (h.inv > 0 || h.dead) return false;
  h.inv = S.god ? .25 : .8; h.hurtT = .22; h.flash = .05; const kb = S.god ? 110 : 170;   // even invincible, a hit staggers him back
  h.hitA = ang + Math.PI;   // he turns to face the hit, so the hurt pose recoils away from it
  h.vx += Math.cos(ang) * kb; h.vy += Math.sin(ang) * kb;
  game.freeze(.05); game.shake(3); P.sparks(h.x, h.y, 12, 6, ang + Math.PI);
  if (S.god) return true;
  h.hp -= dmg; h.combo.cancel(); h.thrust.cancel(); P.text(h.x, h.y, 30, '-' + dmg, '#ff7a6a');
  if (h.hp <= 0) { h.hp = 0; h.dead = true; h.deadT = 0; P.bits(h.x, h.y, 8, 20, ['#2f8f86', '#c8452f', '#f1c7a0']); }
  return true;
}

/* ---------- projectiles ---------- */
const shots = [];
function fireBolt() {
  const h = hero, a = h.aim !== undefined ? h.aim : h.facing; h.facing = a;
  shots.push({ x: h.x + Math.cos(a) * 8, y: h.y + Math.sin(a) * 8, z: 11, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, life: 1.2, from: 'hero', dmg: 9, color: '#ffb347', core: '#fff3c4', r: 3 });
}
function updateShots(dt) {
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i]; s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt;
    let dead = s.life <= 0 || map.solidAt(s.x, s.y);
    if (!dead && s.from === 'hero') { for (const e of near(s.x, s.y)) if (e.alive && e.spawnT <= 0 && Math.hypot(e.x - s.x, e.y - s.y) < e.r + s.r) { damageEnemy(e, s.dmg, Math.atan2(s.vy, s.vx), 70, false); dead = true; break; } }
    else if (!dead && s.from === 'enemy' && Math.hypot(hero.x - s.x, hero.y - s.y) < hero.r + s.r) { hurtHero(s.dmg, Math.atan2(s.vy, s.vx)); dead = true; }
    if (dead) { P.ring(s.x, s.y, 1, 9, s.color, .2); shots.splice(i, 1); }
  }
}

/* ---------- monsters ---------- */
const enemies = [], corpses = [];   // the living crowd, and the fallen until they fade
const MONSTER_CAPE = { len: 5, width: 4, seg: 2.3 };
const HUSK_COLORS = [
  { skin: '#8fa38a', hair: '#3a3f38', cloth: '#5b4a3c', pants: '#3d3530', boot: '#2c2622', belt: '#7a6a4a', cape: '#4a3a5a', capeIn: '#2c2236' },
  { skin: '#9a9a7a', hair: '#403a30', cloth: '#4a5a4c', pants: '#35302c', boot: '#2a2420', belt: '#6a5a3a', cape: '#5a3a30', capeIn: '#32201a' },
  { skin: '#7f9a9a', hair: '#303a3f', cloth: '#5a4a5a', pants: '#302a36', boot: '#221e26', belt: '#6a6a7a', cape: '#3a4a5a', capeIn: '#202a36' }
];
const BONE_COLORS = [
  { bone: '#d8cfb4', cloth: '#2c2434', belt: '#5a4a38', metal: '#b3b8c0', metalDk: '#636872', hilt: '#6a5038', cape: '#3a3040', capeIn: '#1e1826' },
  { bone: '#c2c7ae', cloth: '#26303a', belt: '#4a4034', metal: '#8f9a96', metalDk: '#525a58', hilt: '#5a4430', cape: '#2a3a3a', capeIn: '#161e20' }
];
const KNIGHT_COLORS = ['#7a2e34', '#2e4a78', '#3f5a3a'].map(tabard => ({ cloth: tabard, pants: '#34303c', boot: '#2a2630', belt: '#6a5030', trim: '#d0a85a',
  metal: '#b9c1cf', metalDk: '#687488', skin: '#d6a58a', hair: '#3a2a22', cape: E.shade(tabard, -.2), capeIn: E.shade(tabard, -.45) }));
// Humanoid skins for the walking monsters. One AI drives them all; each skin has its own look, stats and moves from
// E.MOVES. 'classic' draws stick figures, the cheapest rig for huge crowds; the rest are HD rigs (the default style).
const HUSK = { weapon: null, hunch: .4, lean: .18, stride: 5, swing: 2.5, speedRef: 40, armLower: 5.6, headR: 3.2, eyeGlow: '#ff6a3d' };
const SKINS = {
  classic: { rig: Object.assign({ style: 'classic' }, HUSK), colors: HUSK_COLORS, moves: ['claw', 'haymaker'], hp: 32, speed: 28, dmg: 10 },
  hd: { rig: HUSK, colors: HUSK_COLORS, moves: ['claw', 'haymaker', 'hook'], hp: 32, speed: 28, dmg: 10 },
  skeleton: { rig: { build: 'skeleton', bladeLen: 9 }, colors: BONE_COLORS, moves: ['slash', 'overhead', 'thrust'], hp: 24, speed: 34, dmg: 10 },
  knight: { rig: { build: 'bulky', armor: true, sleeves: 'long', hat: { style: 'helmet', color: '#737c90' }, speedRef: 45 }, colors: KNIGHT_COLORS,
    moves: ['overhead', 'bash', 'thrust'], hp: 56, speed: 22, dmg: 14, r: 6, stance: 'ready' }
};
// The monsters' takes on E.MOVES, so each ends in its own silhouette at game size: the claw rakes down in front, the hook
// wraps sideways across the body, the bash drops the shoulder and shoves in with a hop (a knight keeps his blade up: a pommel
// shove), the haymaker overbalances and the slash cocks the blade up over the shoulder while the torso winds. The overhead's
// angles sit a full turn back, so its wind-up swings the blade down past the leg and up over the shoulder instead of through
// the line to the target.
const MOVE = {
  claw: { plane: 'side', a0: 1.5, a1: -1.2, reach: 7, crouch: .5, lean: .45, hold: .45 },
  slash: { a0: 2.1, z0: 1, twist: 1.8, crouch: .4 },
  hook: { a1: -1, reach: 6.6, lunge: .8, lean: .1, twist: 2.4, hold: .12 },
  haymaker: { hold: .55 },
  bash: { reach: 6, hop: 1.8, lean: .6, crouch: .5 },
  overhead: { a0: 2.4 - TAU, a1: -1.25 - TAU, twist: 0 }
};
// Monsters telegraph: twice the hero's wind-up (a red arc grows on the floor meanwhile) and a longer recovery. Each move is
// measured once on a spare rig: its reach (fist or blade tip at full stretch) and how far the head travels forward (lunge and
// lean). Its contact distance k.stand lets the strike meet the hero's body while the heads and bodies stay apart.
const strikePt = (rig, spec) => rig.o.weapon && spec.blade !== 0 ? rig.tip() : rig.hand();   // where a move connects
for (const k of Object.values(SKINS)) {
  k.specs = k.moves.map(m => { const sp = new E.Attack(m, MOVE[m]).spec; return Object.assign(sp, { wind: Math.max(.34, sp.wind * 2), recover: sp.recover + .12 }); });
  k.reach = []; k.stand = k.specs.map(spec => {
    const rig = new E.Humanoid(k.rig); let far = 0, head = 0;
    for (let u = 0; u <= 1; u += .1) {
      rig.update(1, { x: 0, y: 0, stance: k.stance, attack: { spec, phase: 'active', u } });
      far = Math.max(far, strikePt(rig, spec)[0]); head = Math.max(head, rig.head()[0]);
    }
    k.reach.push(far);
    return Math.max(far + hero.r - 1.5, head + 8.5);
  });
}
function makeWalker(x, y) {
  const k = SKINS[S.skin === 'mixed' ? E.pick(['hd', 'skeleton', 'knight']) : S.skin];
  return { type: 'walker', kind: k, x, y, z: 0, vx: 0, vy: 0, r: k.r || 5, hp: k.hp, max: k.hp, facing: Math.random() * TAU, atk: null, cool: Math.random(),
    stun: 0, flash: 0, spawnT: .6, alive: true, head: 30, speed: k.speed + Math.random() * 12, next: (Math.random() * k.specs.length) | 0, ph: Math.random() * TAU,
    rig: new E.Humanoid(Object.assign({ colors: E.pick(k.colors), cape: S.capes ? MONSTER_CAPE : null }, k.rig)) };
}
// Blob parts turn one slime into a small bestiary: plain, horned, cat-eared and bat-winged (the wings open in the air)
const SLIME_PARTS = [{}, {}, { horns: true }, { ears: 'cat' }, { wings: true }];
function makeSlime(x, y) {
  return { type: 'slime', x, y, z: 0, vx: 0, vy: 0, vz: 0, r: 6, hp: 20, max: 20, state: 'idle', t: Math.random(), stun: 0, flash: 0, spawnT: .6, alive: true, head: 16, flap: 0,
    blob: new E.Blob(Object.assign({ R: 6.2, face: 'front' }, E.pick(SLIME_PARTS))) };   // face: 'front' keeps both eyes on the camera side
}
function makeWisp(x, y) {
  return { type: 'wisp', x, y, z: 20, vx: 0, vy: 0, r: 5, hp: 14, max: 14, t: Math.random() * 9, fire: 2 + Math.random() * 2, charge: 0, stun: 0, flash: 0, spawnT: .6, alive: true, orbit: Math.random() < .5 ? 1 : -1, head: 10 };
}
const MAKERS = { walker: makeWalker, slime: makeSlime, wisp: makeWisp }, MIXES = { humanoids: 'walker', slimes: 'slime', wisps: 'wisp' };
function pickType() {
  if (MIXES[S.mix]) return MIXES[S.mix];
  const r = Math.random(); return r < .5 ? 'walker' : r < .8 ? 'slime' : 'wisp';
}
function randomFloor(minDist) {
  for (let k = 0; k < 30; k++) {
    const cx = 2 + ((Math.random() * (MW - 4)) | 0), cy = 2 + ((Math.random() * (MH - 4)) | 0);
    if (cells[cy * MW + cx] !== 0) continue;
    const x = (cx + Math.random()) * T, y = (cy + Math.random()) * T;
    if (minDist && Math.hypot(x - hero.x, y - hero.y) < minDist) continue;
    return [x, y];
  }
  return [CX + (Math.random() - .5) * 200, CY - 120];
}
function spawnOne(instant) {
  const [x, y] = randomFloor(S.behavior === 'swarm' ? 80 : 0), e = MAKERS[pickType()](x, y);
  if (instant) e.spawnT = 0; enemies.push(e); return e;
}
/** grow or shrink the crowd to exactly n (instant = skip the spawn fade) */
function setMonsters(n, instant) {
  S.monsters = n;
  while (enemies.length > n) enemies.pop();
  while (enemies.length < n) spawnOne(instant);
}
function applyCapes() { for (const e of enemies) if (e.rig) { e.rig.o.cape = S.capes ? MONSTER_CAPE : null; e.rig.capeL = null; } }

// spatial hash: keeps crowd separation cheap even with thousands of monsters
const grid = new Map(), GC = 12, gkey = (x, y) => ((x / GC) | 0) + ((y / GC) | 0) * 8192;
function rebuildGrid() { grid.clear(); for (const e of enemies) { if (!e.alive) continue; const k = gkey(e.x, e.y); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(e); } }
function near(x, y, rad = 1) {
  const out = [], cx = (x / GC) | 0, cy = (y / GC) | 0;
  for (let oy = -rad; oy <= rad; oy++) for (let ox = -rad; ox <= rad; ox++) { const a = grid.get(cx + ox + (cy + oy) * 8192); if (a) out.push(...a); }
  return out;
}
function separate() {
  for (const e of enemies) {
    if (!e.alive) continue;
    const cx = (e.x / GC) | 0, cy = (e.y / GC) | 0;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const a = grid.get(cx + ox + (cy + oy) * 8192); if (!a) continue;
      for (const b of a) {
        if (b === e) continue;
        const dx = e.x - b.x, dy = e.y - b.y, d = Math.hypot(dx, dy), m = e.r + b.r + 2;   // a small gap keeps bodies readable
        if (d < m && d > .01) { const k = (m - d) / d * .5; e.x += dx * k; e.y += dy * k; }
      }
    }
  }
}
function steer(e, dt) {
  const h = hero;
  if (S.behavior === 'swarm' && !h.dead) { const dx = h.x - e.x, dy = h.y - e.y, d = Math.hypot(dx, dy) || 1; return d < 70 ? [dx / d, dy / d] : flow.dir(e.x, e.y, h.x, h.y); }
  if (S.behavior === 'wander') {
    e.wtT = (e.wtT || 0) - dt;
    if (!e.wt || e.wtT <= 0 || Math.hypot(e.wt[0] - e.x, e.wt[1] - e.y) < 6) {
      e.wtT = 2 + Math.random() * 4;
      const a = Math.random() * TAU, d = 20 + Math.random() * 60, x = e.x + Math.cos(a) * d, y = e.y + Math.sin(a) * d;
      e.wt = map.solidAt(x, y) ? [e.x - Math.cos(a) * 10, e.y - Math.sin(a) * 10] : [x, y];
    }
    const dx = e.wt[0] - e.x, dy = e.wt[1] - e.y, d = Math.hypot(dx, dy) || 1; return [dx / d * .6, dy / d * .6];
  }
  return [0, 0];
}
function onScreen(e) {
  const s = game.view.p(e.x, e.y, 0), vx = s[0] - game.cam.x, vy = s[1] - game.cam.y;
  return vx > -80 && vx < game.screen.W + 80 && vy > -60 && vy < game.screen.H + 140;
}
// Attack tokens: at most MAX_ATTACKERS monsters attack at once and each new wind-up waits TURN_GAP after the last one, so
// telegraphs never merge and every hit has a readable author. The rest wait in a ring just outside striking distance.
const MAX_ATTACKERS = 3, TURN_GAP = .25;
let tokens = 0, nextTurn = 0;
function takeTurn() {
  if (tokens >= MAX_ATTACKERS || game.time < nextTurn || hero.dead) return false;
  tokens++; nextTurn = game.time + TURN_GAP * (.8 + Math.random() * .6); return true;
}
function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) if (!enemies[i].alive) corpses.push(enemies.splice(i, 1)[0]);
  // waves: kills are not replaced; once the whole crowd is down (the last body has landed) the hero cheers, then the next wave comes
  if (!enemies.length && S.monsters && hero.cheer <= 0 && corpses.every(c => c.deadT > .8)) { hero.cheer = 1.6; game.note('WAVE ' + ++wave + ' CLEARED'); P.glints(hero.x, hero.y, 26, 14, '#ffd36a'); }
  if (S.behavior === 'freeze') { rebuildGrid(); return; }
  if (S.behavior === 'swarm') flow.update(hero.x, hero.y);
  rebuildGrid();
  tokens = 0; for (const e of enemies) if (e.atk || e.state === 'wind' || e.state === 'pounce') tokens++;
  for (const e of enemies) {
    e.flash -= dt; e.stun -= dt;
    if (e.spawnT > 0) { e.spawnT -= dt; continue; }
    const vis = !S.lod || onScreen(e);
    if (e.type === 'walker') updateWalker(e, dt, vis); else if (e.type === 'slime') updateSlime(e, dt, vis); else updateWisp(e, dt, vis);
  }
  separate();
}
function updateWalker(e, dt, vis) {
  const h = hero, k = e.kind, dx = h.x - e.x, dy = h.y - e.y, d = Math.hypot(dx, dy) || 1, toH = Math.atan2(dy, dx), A = e.atk;
  const stand = Math.max(k.stand[e.next], e.r + h.r + 5);   // contact distance for the next move
  let mv = [0, 0];
  e.cool -= dt;
  if (e.stun <= 0) {
    if (A) {
      // wind-up: step to contact distance while tracking the hero (dodge the strike), then commit with a lunge that ends there
      if (A.phase === 'wind') { e.facing = E.approachAng(e.facing, toH, dt * 2.5); if (Math.abs(d - stand) > 1) { const s = Math.sign(d - stand); mv = [dx / d * s, dy / d * s]; } }
      if (A.update(dt) === 'active' && d > stand) { const v = Math.min(70, Math.sqrt(1000 * (d - stand))); e.vx += Math.cos(e.facing) * v; e.vy += Math.sin(e.facing) * v; }
      A.hits([h], t => E.inArc(e, e.facing, t, stand - h.r + 1, 1.1), () => hurtHero(k.dmg, toH) && P.impact(...strikePt(e.rig, A.spec), 6, '#ffb08a'));   // an impact star where it lands
      if (!A.busy) { e.atk = null; e.cool = .8 + Math.random(); e.next = (Math.random() * k.specs.length) | 0; }
    } else if (S.behavior === 'swarm' && !h.dead) {
      // no token: wait in a ring outside contact distance, facing the hero; take a turn when one is free. Waiters on the
      // camera side of the hero stand further back and wait longer, so he stays in sight (view.fx, fy points at the camera;
      // the lower the camera, the more a body in front hides him: none from straight above)
      const v = game.view, front = Math.max(0, -(dx * v.fx + dy * v.fy) / d) * Math.cos(v.pitch), ring = stand + 10 + 20 * front;
      // in the ring nobody stands still: a slow sidestep drifts back and forth and the body sways around the hero (own phase each)
      const sway = Math.sin(game.time * .9 + e.ph);
      mv = d > ring + 3 ? steer(e, dt) : d < ring - 3 ? [-dx / d * .5, -dy / d * .5] : [-dy / d * .4 * sway, dx / d * .4 * sway];
      e.facing = E.approachAng(e.facing, d > ring + 3 ? Math.atan2(mv[1], mv[0]) : toH + sway * .25, dt * 5);
      // the Attack is made when needed, so idle crowds cost nothing
      if (d < ring + 6 && e.cool <= -2 * front && takeTurn()) { e.atk = new E.Attack(k.specs[e.next]); e.atk.start(); }
    } else { mv = steer(e, dt); if (mv[0] || mv[1]) e.facing = E.approachAng(e.facing, Math.atan2(mv[1], mv[0]), dt * 5); }
  }
  const acc = (e.stun > 0 ? 160 : 500) * dt;
  e.vx = approach(e.vx, mv[0] * e.speed, acc); e.vy = approach(e.vy, mv[1] * e.speed, acc);
  e.x += e.vx * dt; e.y += e.vy * dt; collideWorld(e);
  if (!h.dead) pushFromCircle(e, h, e.atk && e.atk.phase !== 'wind' ? stand - e.r : h.r + 3);   // strikes stop at contact, bodies a step off
  // a knight's bash (blade: 0) keeps his sword pointing up: point + aim hold the blade while the hands drive in
  const pommel = !!(e.atk && e.atk.spec.blade === 0 && e.rig.o.weapon);
  if (vis) e.rig.update(dt, { x: e.x, y: e.y, z: 0, vx: e.vx, vy: e.vy, facing: e.facing, hurt: e.stun > 0, attack: e.atk && e.atk.state, stance: k.stance, point: pommel, aim: 1.2,
    expr: e.stun > 0 ? 'wince' : e.atk ? 'angry' : null });
}
// the fallen: humanoids play the 'die' pose (a stagger, the knees give, a topple; a sword ends flat beside them), slimes melt,
// then all fade out; wisps pop instead (see drawWisp)
const DEAD_T = 1.6, POP_T = .35;
function updateCorpses(dt) {
  while (corpses.length > 300) corpses.shift();
  for (let i = corpses.length - 1; i >= 0; i--) {
    const e = corpses[i]; e.deadT += dt; e.flash -= dt;
    if (e.deadT > (e.type === 'wisp' ? POP_T : DEAD_T)) { corpses.splice(i, 1); continue; }
    e.vx = approach(e.vx, 0, 300 * dt); e.vy = approach(e.vy, 0, 300 * dt); e.x += e.vx * dt; e.y += e.vy * dt; collideWorld(e);
    if (e.rig) e.rig.update(dt, { x: e.x, y: e.y, z: 0, facing: e.facing, pose: 'die' });
    else if (e.blob) { e.z = Math.max(0, e.z - 80 * dt); e.flap = approach(e.flap, 0, dt * 5); e.blob.update(dt, { squash: -.42, squint: true, flap: e.flap }); }
  }
}
// Slimes hop in but land in a ring outside the hero's reach. With an attack token a slime winds up (squashes flat and shivers
// while a red arc grows toward the hero), then pounces: a low, fast leap that lands at contact, bumps him and bounces off.
const SLIME_G = 480, HOP = { vz: 150, air: 2 * 150 / SLIME_G }, POUNCE = { vz: 85, air: 2 * 85 / SLIME_G }, SLIME_RING = 34;
function updateSlime(e, dt, vis) {
  const h = hero, swarm = S.behavior === 'swarm';
  let dx = h.x - e.x, dy = h.y - e.y, d = Math.hypot(dx, dy) || 1;
  if (e.z <= 0 && e.vz <= 0) {
    e.vx = approach(e.vx, 0, 400 * dt); e.vy = approach(e.vy, 0, 400 * dt);
    if (e.stun <= 0 && S.behavior !== 'hold') {
      e.t -= dt;
      if (e.state === 'wind') { e.blob.kick((Math.random() - .5) * 3); e.facing = Math.atan2(dy, dx); }   // shiver and track the hero
      if (e.state === 'idle' && e.t <= 0) {
        const turn = swarm && Math.abs(d - SLIME_RING) < 8 && takeTurn();   // pounces start from the ring
        e.state = turn ? 'wind' : 'crouch'; e.t = turn ? .5 : .28; e.facing = Math.atan2(dy, dx);
      } else if ((e.state === 'crouch' || e.state === 'wind') && e.t <= 0) {
        // pounces land at contact; hops land on the ring, back out again after a pounce, and stop there to wait and watch
        const pounce = e.state === 'wind', jump = pounce ? POUNCE : HOP, out = swarm && !pounce && d < SLIME_RING;
        const dir = pounce ? [dx, dy] : out ? [-dx, -dy] : steer(e, dt), l = Math.hypot(dir[0], dir[1]) || 1;
        const len = pounce ? d - e.r - h.r + 3 : swarm ? Math.min(Math.abs(d - SLIME_RING), 44) : 44;
        if (len < 4) { e.state = 'idle'; e.t = .3; }
        else { e.state = pounce ? 'pounce' : 'air'; e.vz = jump.vz; e.vx = dir[0] / l * len / jump.air; e.vy = dir[1] / l * len / jump.air; e.blob.kick(pounce ? 6 : 4.5); }
      }
    }
  }
  if (e.z > 0 || e.vz > 0) {
    e.vz -= SLIME_G * dt; e.z += e.vz * dt;
    if (e.z <= 0) { e.z = 0; e.vz = 0; const rest = e.state === 'pounce' ? 1.1 : .45; e.state = 'idle'; e.t = rest + Math.random() * .6; e.blob.kick(-5); }
  }
  e.x += e.vx * dt; e.y += e.vy * dt; collideWorld(e);
  dx = h.x - e.x; dy = h.y - e.y; d = Math.hypot(dx, dy) || 1;
  if (!h.dead && e.z < 6 && d < e.r + h.r + 1) {
    if (e.state === 'pounce') { hurtHero(6, Math.atan2(dy, dx)); e.state = 'air'; e.vx *= -.7; e.vy *= -.7; e.vz = Math.max(e.vz, 90); }   // bump and bounce back
    pushFromCircle(e, h, h.r);
  }
  e.flap = approach(e.flap, e.z > 0 ? 1 : 0, dt * 5);   // wings (if any) spread on the hop and fold on landing
  const low = e.state === 'crouch' || e.state === 'wind';
  if (vis) e.blob.update(dt, { squash: e.state === 'wind' ? -.42 : low ? -.32 : e.z > 0 ? clamp(e.vz / 600, -.2, .28) : 0, look: [dx, dy], squint: low, flap: e.flap });
}
function updateWisp(e, dt) {
  const h = hero, dx = h.x - e.x, dy = h.y - e.y, d = Math.hypot(dx, dy) || 1; e.t += dt;
  let ax = 0, ay = 0;
  if (e.stun <= 0) {
    if (S.behavior === 'swarm') { const want = d > 100 ? 1 : d < 70 ? -1 : 0; ax = dx / d * want * 60 + (-dy / d) * e.orbit * 34; ay = dy / d * want * 60 + (dx / d) * e.orbit * 34; }
    else if (S.behavior === 'wander') { const s = steer(e, dt); ax = s[0] * 50; ay = s[1] * 50; }
  }
  e.vx += (ax - e.vx * 1.6) * dt; e.vy += (ay - e.vy * 1.6) * dt; e.x += e.vx * dt; e.y += e.vy * dt; collideWorld(e);
  e.z = 20 + Math.sin(e.t * 2) * 3;
  if (S.behavior === 'swarm' && !h.dead && e.stun <= 0 && d < 160) {
    if (e.charge > 0) { e.charge -= dt; if (e.charge <= 0) { const a = Math.atan2(dy, dx); shots.push({ x: e.x, y: e.y, z: e.z, vx: Math.cos(a) * 95, vy: Math.sin(a) * 95, life: 3, from: 'enemy', dmg: 8, color: '#c78bff', core: '#f4e6ff', r: 3 }); e.fire = 2.5 + Math.random() * 2; } }
    else { e.fire -= dt; if (e.fire <= 0) e.charge = .6; }
  }
}

/* ---------- combat ---------- */
// Damage numbers born together close by (one swing through a crowd) stack in a column over the first one instead of
// printing over each other
let numCol = null;
function damageNumber(e, dmg, color) {
  const t = game.time, c = numCol && t - numCol.t < .12 && Math.hypot(e.x - numCol.x, e.y - numCol.y) < 28 ? numCol : numCol = { x: e.x, y: e.y, z: (e.z || 0) + e.head + 4, n: 0 };
  c.t = t; P.text(c.x, c.y, c.z + (c.n++ % 5) * 8, dmg, color);
}
const BITS = { slime: ['#c95f9a', '#f5a3cc', '#6d2658'], wisp: ['#c78bff', '#f4e6ff', '#7a4ac0'] };
function damageEnemy(e, dmg, ang, kb, big) {
  e.hp -= dmg; e.flash = big ? .04 : .07; e.stun = .22; e.vx += Math.cos(ang) * kb; e.vy += Math.sin(ang) * kb;   // a short tint flash, so crowds hit at once stay apart
  if (e.rig) { e.atk = null; e.rig.kick(2.5); }   // a hit interrupts the swing (and frees its token): the rig flinches (hurt) instead
  else if (e.type === 'slime') { e.blob.kick(5); e.state = 'idle'; e.t = .5; } else e.charge = 0;
  game.freeze(big ? .06 : .045); game.shake(big ? 3 : 2);
  P.sparks(lerp(hero.x, e.x, .6), lerp(hero.y, e.y, .6), e.type === 'wisp' ? e.z : 10, 7, ang);
  damageNumber(e, dmg, big ? '#ffd36a' : '#fff2c4');
  if (e.hp <= 0) {
    e.alive = false; e.deadT = 0;
    if (e.rig) P.bits(e.x, e.y, 8, 6, [e.rig.C.skin, e.rig.C.cloth, e.rig.C.boot]);
    else { P.bits(e.x, e.y, e.z + 6, 12, BITS[e.type]); P.ring(e.x, e.y, 3, 22, BITS[e.type][1], .3); }
    if (e.type === 'wisp') { e.vx = e.vy = 0; P.glints(e.x, e.y, e.z, 10, '#e3c8ff'); }   // a wisp has no body to leave: it pops where it was hit
  }
}

/* ---------- particle storm ---------- */
let emitAcc = 0;
function storm(dt) {
  P.max = S.pcap;
  if (!S.rate) { emitAcc = 0; return; }
  emitAcc += S.rate * dt;
  const torches = activeTorches();
  while (emitAcc >= 1) {
    emitAcc--;
    if (torches.length && Math.random() < .45) {
      const b = torches[(Math.random() * torches.length) | 0];
      P.add({ kind: 'ember', x: b.x + (Math.random() - .5) * 6, y: b.y + (Math.random() - .5) * 6, z: 14, vx: (Math.random() - .5) * 14, vy: (Math.random() - .5) * 14, vz: 20 + Math.random() * 40, max: .8 + Math.random() * .8, color: '#ff8a3a' });
    } else {
      const a = Math.random() * TAU, rr = Math.random() * 170, x = hero.x + Math.cos(a) * rr, y = hero.y + Math.sin(a) * rr, k = Math.random();
      P.add({ kind: k < .55 ? 'spark' : k < .8 ? 'dust' : 'bit', x, y, z: 2, vx: (Math.random() - .5) * 60, vy: (Math.random() - .5) * 60, vz: 60 + Math.random() * 120, g: 300, drag: 1.5, bounce: .4, max: .6 + Math.random() * .6, color: k < .8 ? '#ffb85c' : '#7fe3d6', size: 1.3 });
    }
  }
}

/* ---------- update ---------- */
function update(dt) {
  updateHero(dt);
  updateEnemies(dt);
  updateCorpses(dt);
  updateShots(dt);
  storm(dt);
  for (const b of TORCHES) b.t += dt;
  const a = hero.aim !== undefined ? hero.aim : hero.facing;
  if (FIX.on) game.focus(FIX.x, FIX.y, FIX.z);   // a fixed camera stays where it was fixed
  else game.focus(hero.x + Math.cos(a) * 16, hero.y + Math.sin(a) * 16, 8);
  if (depthActive()) depthFollow(dt);
  depthResolution(depthActive());
  if (DEPTH.note) { if (!game._note) game._note = DEPTH.note; DEPTH.note = null; }   // (the note, borrowed by the depth view to draw it large)
}

/* ---------- draw ---------- */
const flicker = t => .9 + Math.sin(t * 13) * .05 + Math.sin(t * 29) * .04 + Math.sin(t * 7.3) * .04;
const CLAW_SMEAR = ['#ffffff', '#ffd6c8', '#ff7a5a', '#b8302a'];   // monster strikes trail red, the hero's blade the default blue
// the hit flash (hero and monsters) is a light tint and a bright outline, not a solid fill: the body stays readable, and a crowd
// hit at once doesn't merge into one blob
const FLASH = '#ffe6d8', FLASH_LINE = '#fff4e6';
function drawFlame(g, r, x, y, z, t) {
  px.glow(g, 1);
  const sc = r.view.scale;
  for (let k = 0; k < 3; k++) {
    const a = k * 2.1 + t * .6, bx = x + Math.cos(a) * 1.6, by = y + Math.sin(a) * 1.6, h = 7 + Math.sin(t * 9 + k * 2) * 2.2 + Math.sin(t * 17 + k) * 1.2, sw = Math.sin(t * 6 + k * 1.7) * 1.4;
    const [x0, y0] = r.w(bx, by, z), [tx, ty] = r.w(bx + sw, by, z + h), w = 2.2 * sc;
    px.poly(g, [[x0 - w, y0], [tx, ty], [x0 + w, y0]], '#ff7a2a');
    const [mx, my] = r.w(bx + sw * .5, by, z + h * .65); px.poly(g, [[x0 - w * .55, y0], [mx, my], [x0 + w * .55, y0]], '#ffd36a');
  }
}
function drawBrazier(g, r, b) {
  r.box(g, b.x - 3, b.y - 3, 0, b.x + 3, b.y + 3, 8, '#5d566f', '#433d55');
  px.poly(g, r.groundPts(b.x, b.y, 5.5, 14, 11), '#2b2430'); px.poly(g, r.groundPts(b.x, b.y, 5.5, 14, 9), '#3a3036');
  px.glow(g, .9); px.poly(g, r.groundPts(b.x, b.y, 4, 12, 11.2), '#ff8a3c');
  drawFlame(g, r, b.x, b.y, 11, b.t);
}
function drawWisp(g, ox, oy, e) {   // charging swells the orb; dying pops it (it swells fast as it fades)
  const k = !e.alive ? 1 + e.deadT / POP_T * 1.8 : e.charge > 0 ? 1 + (1 - e.charge / .6) * .8 : 1;
  game.r.glowDisc(g, ox, oy, 7 * k, '#7a4ac0', .55);
  px.disc(g, ox, oy, 3.2 * k, e.flash > 0 ? '#ffffff' : '#c78bff'); px.disc(g, ox - .5, oy - .5, 1.8 * k, '#f4e6ff');
  for (let i = 0; i < 3; i++) { const a = e.t * 4 + i * TAU / 3; px.dot(g, ox + Math.cos(a) * 6 * k, oy + Math.sin(a) * 3 * k, '#e3c8ff'); }
}
// the telegraph: a red arc on the floor that grows toward the target as the wind-up (u 0..1) runs, out to the strike's reach
function telegraph(r, e, u, reach) {
  r.decal(() => r.groundArc(e.x, e.y, e.r * .6, e.r * .6 + (reach - e.r * .6) * u, e.facing - .8, e.facing + .8, '#ff4a3a', .25 + .45 * u), { emissive: .2 + .35 * u });
}
function draw(r) {
  if (depthActive()) { drawDepth(r); return; }   // side scrolling with depth: Mode 7 (below)
  const view = r.view, L = game.lights, t = game.time;
  map.drawFloor(r);
  if (!hero.dead) r.shadow(hero.x, hero.y, 5.5, .55);
  map.queueWalls(r);
  let heats = 0;
  for (let i = 0; i < S.lights; i++) {
    const b = TORCHES[i];
    if (r.visible(b.x, b.y, 0)) { r.queue(b.x, b.y, 0, g => drawBrazier(g, r, b)); if (heats++ < 8) L.heat(b.x, b.y, 17, 7, 1.1); }
    L.add(b.x, b.y, 16, 124, 1.25 * flicker(b.t), { color: '#ff9a4a', shadow: true });
    L.caster(b.x, b.y, 4.5, 11);
  }
  for (let i = 0; i < Math.min(S.shapes, SHAPE_SPOTS.length); i++) { const p = SHAPE_SPOTS[i]; r.shape(p.id, p.x, p.y, 0, p.o); }
  L.add(CX, CY, 3, 78, .5 + .12 * Math.sin(t * 1.7), { color: '#4fe0cc', shadow: true });
  let monsterLights = 0;
  const outline = S.outlines;
  for (const list of [enemies, corpses]) for (const e of list) {
    const alpha = !e.alive ? clamp(e.type === 'wisp' ? 1 - e.deadT / POP_T : (DEAD_T - e.deadT) * 2, 0, 1) : e.spawnT > 0 ? clamp(1 - e.spawnT / .6, .05, 1) : 1;
    const flash = e.flash > 0 && FLASH, flashMix = .3, outlineColor = flash ? FLASH_LINE : undefined;
    if (e.type === 'walker') {
      if (!r.visible(e.x, e.y, 0)) { r.game.stats.culled++; continue; }
      r.shadow(e.x, e.y, 5, .5 * alpha);
      const A = e.alive && e.atk && e.atk.busy ? e.atk : null;
      if (A && A.phase === 'wind') telegraph(r, e, A.u, e.kind.reach[e.next]);
      if (r.gpu) L.caster(e.x, e.y, 3.2, 22);
      r.actor(e.x, e.y, 0, (g, ox, oy) => e.rig.draw(g, ox, oy, view), { flash, flashMix, alpha, outline: outline || flash, outlineColor, rim: outline });
      if (A) e.rig.drawSmear(r, CLAW_SMEAR);
    } else if (e.type === 'slime') {
      if (!r.visible(e.x, e.y, e.z)) { r.game.stats.culled++; continue; }
      r.shadow(e.x, e.y, 6 - Math.min(3, e.z * .1), .5 * alpha);
      if (e.state === 'wind') telegraph(r, e, 1 - e.t / .5, Math.hypot(hero.x - e.x, hero.y - e.y) - hero.r);
      if (r.gpu) L.caster(e.x, e.y, 5, e.z + 11);
      r.actor(e.x, e.y, e.z, (g, ox, oy) => e.blob.draw(g, ox, oy, view), { flash, flashMix, alpha, outline: outline || flash, outlineColor, rim: outline });
    } else {
      r.actor(e.x, e.y, e.z, (g, ox, oy) => drawWisp(g, ox, oy, e), { rim: false, alpha, emissive: 1, outline });
      if (S.monsterLights && e.alive && monsterLights < 16 && r.visible(e.x, e.y, e.z)) { monsterLights++; L.add(e.x, e.y, e.z, 52, .8, { color: '#b78bff' }); }
    }
  }
  {
    const h = hero, ghost = h.dashT > 0 && t - h.lastGhost > .03; if (ghost) h.lastGhost = t;
    r.actor(h.x, h.y, h.z, (g, ox, oy) => h.rig.draw(g, ox, oy, view), { xray: true, alpha: h.dead ? clamp(4 - h.deadT * 2, 0, 1) : 1, flash: h.flash > 0 && FLASH, flashMix: .3, outlineColor: h.flash > 0 ? FLASH_LINE : undefined, ghost: ghost ? { color: '#62d8ff', life: .22 } : null });
    h.rig.drawSmear(r);
    if (r.gpu) { L.add(h.x, h.y, 18, 84, .6, { color: '#c9c2ec' }); L.caster(h.x, h.y, 3.2, 24); } else L.add(h.x, h.y, 10, 82, .8);
  }
  for (const s of shots) {
    if (!r.visible(s.x, s.y, s.z, 10, 10, 10)) continue;
    r.queue(s.x, s.y, s.z, g => { px.glow(g, 1); const [x, y] = r.w(s.x, s.y, s.z); px.ddisc(g, x, y, 5, s.color, .5, r.ix, r.iy); px.disc(g, x, y, 2, s.color); px.dot(g, x, y, s.core); });
    L.add(s.x, s.y, s.z, 40, .85, { color: s.color });
  }
  if (showRig) r.overlay(() => { if (!hero.dead) hero.rig.debug(r); for (const e of enemies) if (e.alive && e.rig && r.visible(e.x, e.y, 0)) e.rig.debug(r); });
  frameStats.lights = L.list.length;
}

/* =============================================================================
 * SIDE SCROLLING WITH DEPTH (Mode 7). The engine's side view is orthographic: a character is the same size wherever he
 * stands, and walking into the hall only changes who is drawn over whom. With depth on (M), the side view gets a
 * perspective camera on a rail: it follows the hero sideways and keeps him DEPTH.near to DEPTH.far units away, so he
 * shrinks walking into the hall and grows coming back (the camera moves in depth only past those). This page draws it
 * the way SNES games did (Mode 7, with the scaled sprites of Super Mario Kart and F-Zero): the floor one screen row at
 * a time, each row the strip of floor texture at that row's distance stretched to the screen's width; then walls,
 * braziers, shadows, telegraphs, trails, shots, particles and every character, back to front, each at the size its
 * distance gives. The characters are the engine's own: a rig draws by code at any scale, so a near one is crisp, not a
 * blown-up sprite. The torches light warm pools on the floor (the engine's lighting works in its own views only), and
 * the far end fades into the dark. Zoom narrows the field of view. ?view=side&depth=1 opens it.
 * ============================================================================= */
const DEPTH = { on: qs.get('depth') === '1', x: 0, y: 0, h: 70, pitch: 14, fov: 50, near: 110, far: 260, ready: false, text: 1, note: null };   // (units: near keeps his feet on screen)
/* the depth view draws at the screen's own resolution, one buffer pixel per screen pixel: the characters are drawn by
 * the engine at the size their distance gives there, so near or far, zoomed in or out, they stay sharp (in the engine's
 * own views the pixel size is the look; here the framing comes from the field of view, so more pixels only sharpen).
 * Its text (damage numbers, notes) is drawn as large as at the page's own pixel size. The engine's pixel size comes
 * back with depth off. */
let depthRes = false;
function depthResolution(on) {
  if (on && game.screen.S !== 1) {
    if (!depthRes) DEPTH.text = game.screen.S;
    depthRes = true; game.screen.setOptions({ minW: 1e6, minH: 1e6, maxW: 1e6, maxH: 1e6, portrait: { maxH: 1e6 } }); game.cam.snap = true;
  } else if (!on && depthRes) { depthRes = false; setDistance(S.distance); }
}
// (the depth view covers the frame and draws the particles itself: no lighting pass or engine particles under it)
{ const render = game.lights.render.bind(game.lights); game.lights.render = r => { if (!depthActive()) render(r); }; }
{ const draw = P.draw.bind(P); P.draw = r => { if (!depthActive()) draw(r); }; }
const depthActive = () => DEPTH.on && game.baseView.id === 'side';
/** the camera follows the hero sideways, and in depth only when he comes nearer than near or goes past far; a fixed
 *  camera (F) stays where it is */
function depthFollow(dt) {
  const h = hero;
  if (!DEPTH.ready) { DEPTH.x = h.x; DEPTH.y = h.y + 160; DEPTH.ready = true; }
  if (FIX.on) return;
  const k = 1 - Math.exp(-dt * 5), want = clamp(DEPTH.y, h.y + DEPTH.near, h.y + DEPTH.far);
  DEPTH.x += (h.x - DEPTH.x) * k; DEPTH.y += (want - DEPTH.y) * Math.min(1, k * 2);
}
const depthFov = () => 2 * Math.atan(Math.tan(DEPTH.fov * Math.PI / 360) / (game.zoom || 1));   // radians: zoom narrows it
/** the engine's cut-away for a camera that moves: border walls between the camera and the hero drop low */
const depthCut = (cx, cy) => { const t = map.types[map.cell(cx, cy)]; return !!(t && t.cut) && cy * T > hero.y; };
function setDepth(on) {
  DEPTH.on = on; DEPTH.ready = false;
  if (on && game.baseView.id !== 'side') game.setView('side');
  game.note(on ? 'SIDE SCROLLING WITH DEPTH' : 'FLAT SIDE VIEW'); syncUI();
}
/* the projection: a pinhole camera at (x, y, h) looking north, pitched down; f is the focal length in buffer pixels */
const PJ = { x: 0, y: 0, h: 70, cp: 1, sp: 0, f: 1, cx: 0, cy: 0 };
/** engine (x, y, z) -> [buffer x, buffer y, buffer pixels per unit there], or null at or behind the camera */
function proj(x, y, z) {
  const D = PJ.y - y, dz = z - PJ.h, zc = D * PJ.cp - dz * PJ.sp; if (zc < 6) return null;
  const k = PJ.f / zc; return [PJ.cx + (x - PJ.x) * k, PJ.cy - (D * PJ.sp + dz * PJ.cp) * k, k];
}
/** a buffer row's floor distance (the inverse of proj on the floor), or 0 above the horizon */
function rowDepth(by) {
  const k = (PJ.cy - by) / PJ.f, den = PJ.sp - k * PJ.cp; if (den <= 1e-4) return 0;
  return PJ.h * (PJ.cp + k * PJ.sp) / den;
}
// the floor texture, one texel per unit, baked from the map's own floorTex the first time it is needed
let FLOOR7 = null;
function floor7() {
  if (FLOOR7) return FLOOR7;
  const w = MW * T, h = MH * T, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (map.cell(Math.floor(x / T), Math.floor(y / T)) !== 0) continue;
    const c = map.floorTex(x + .5, y + .5), i = (y * w + x) * 4; if (!c) continue;
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return (FLOOR7 = cv);
}
// wall faces: courses of bricks in the type's colors, one canvas per type and height (16 pixels across a tile)
const FACE7 = new Map();
function face7(t, h) {
  const key = t.side + h; let cv = FACE7.get(key); if (cv) return cv;
  cv = document.createElement('canvas'); cv.width = 16; cv.height = h; const g = cv.getContext('2d'), course = t.course || 8, tn = E.tones(t.side);
  g.fillStyle = t.side; g.fillRect(0, 0, 16, h);
  for (let z = 0, ci = 0; z < h; z += course, ci++) {
    const y = h - z - course; g.fillStyle = t.line || E.shade(t.side, -.3);
    g.fillRect(0, Math.max(0, y), 16, 1); g.fillRect((ci & 1) ? 4 : 12, Math.max(0, y), 1, course);
    g.fillStyle = tn.lt; g.fillRect(0, Math.max(0, y + 1), 16, 1);
  }
  FACE7.set(key, cv); return cv;
}
const views7 = new Map();
/** the engine view a character is drawn with at k pixels per unit (whole 1/16ths, so views are reused) */
function view7(k) {
  const q = Math.max(1 / 8, Math.round(k * 16) / 16); let v = views7.get(q);
  if (!v) { if (views7.size > 400) views7.clear(); v = new E.View('side-depth', 'Side, depth', 0, DEPTH.pitch, q, 1); views7.set(q, v); }
  return v;
}
/** a pool of light on the floor at (x, y), radius R units: a radial gradient squashed as the floor squashes it there */
function pool7(g, x, y, R, rgb, a) {
  const c = proj(x, y, 0); if (!c) return;
  const n = proj(x, y - R, 0), f = proj(x, y + R, 0), rx = R * c[2], ry = Math.max(1, ((f ? f[1] : c[1] + rx * .3) - (n ? n[1] : c[1] - rx * .3)) / 2);
  if (rx < 1 || c[0] + rx < 0 || c[0] - rx > PJ.W) return;
  g.save(); g.translate(c[0], (f && n ? (f[1] + n[1]) / 2 : c[1])); g.scale(1, ry / rx);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(-rx, -rx, rx * 2, rx * 2); g.restore();
}
/** a flat shape on the floor (telegraphs): points [x, y] in engine units */
function floorPoly7(g, pts, color, a) {
  const ps = []; for (const [x, y] of pts) { const p = proj(x, y, .2); if (!p) return; ps.push(p); }
  g.globalAlpha = a; g.fillStyle = color; g.beginPath(); ps.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fill(); g.globalAlpha = 1;
}
function drawDepth(r) {
  const sc = game.screen, W = r.W, H = r.H, t = game.time;
  const pitch = DEPTH.pitch * Math.PI / 180;
  Object.assign(PJ, { x: DEPTH.x, y: DEPTH.y, h: DEPTH.h, cp: Math.cos(pitch), sp: Math.sin(pitch), f: H / 2 / Math.tan(depthFov() / 2), cx: W / 2 + sc.fx, cy: H / 2 + sc.fy, W });
  // everything standing, gathered now (the panel counts it) and drawn back to front (the far end of the hall first)
  const items = [];
  for (let cy = 0; cy < MH; cy++) for (let cx = 0; cx < MW; cx++) {
    const id = map.cell(cx, cy); if (id <= 0) continue;
    const y1 = (cy + 1) * T; if (PJ.y - y1 < 6 && PJ.y - cy * T < 6) continue;
    items.push([y1, g => wall7(g, cx, cy, map.types[id])]);
  }
  for (let i = 0; i < S.lights; i++) { const b = TORCHES[i]; items.push([b.y, g => brazier7(g, b)]); }
  let drawn = 0, culled = 0;
  for (const list of [enemies, corpses]) for (const e of list) {
    const p = proj(e.x, e.y, e.z || 0); if (!p || p[0] < -80 || p[0] > W + 80) { culled++; continue; }
    items.push([e.y, g => actor7(g, e, p)]); drawn++;
  }
  { const p = proj(hero.x, hero.y, 0); if (p) { items.push([hero.y + .01, g => actor7(g, hero, p)]); drawn++; } }
  for (const s of shots) items.push([s.y, g => { const p = proj(s.x, s.y, s.z); if (!p) return; glow7(g, p[0], p[1], 5 * p[2], s.color, .5); disc7(g, p[0], p[1], Math.max(1, 2 * p[2]), s.core); }]);
  items.sort((a, b) => a[0] - b[0]);
  game.stats.actors = drawn; game.stats.culled = culled; frameStats.lights = S.lights + 2;
  if (game._note && game.real < game._note.end) { DEPTH.note = game._note; game._note = null; }   // (drawn below, at the text's size)
  const note = DEPTH.note, tx = Math.max(1, Math.round(DEPTH.text));
  r.overlay(g => {   // (an overlay: drawn over the engine's empty world, after its lighting pass)
    g.save(); g.imageSmoothingEnabled = false;
    g.fillStyle = '#06050b'; g.fillRect(0, 0, r.bw, r.bh);
    // the floor, a row at a time (Mode 7), then the dark of the hall, fading with distance, and the light pools
    const F = floor7(), top = Math.max(0, Math.ceil(PJ.cy - PJ.f * PJ.sp / PJ.cp));
    for (let by = top; by < r.bh; by++) {
      const D = rowDepth(by + .5); if (!D || D > 2400) continue;
      const y = PJ.y - D; if (y < 0 || y >= MH * T) continue;
      const zc = D * PJ.cp + PJ.h * PJ.sp, u = zc / PJ.f;
      g.drawImage(F, PJ.x - PJ.cx * u, Math.floor(y), r.bw * u, 1, 0, by, r.bw, 1);
    }
    const fog = g.createLinearGradient(0, top, 0, r.bh); fog.addColorStop(0, 'rgba(6,5,11,.92)'); fog.addColorStop(.45, 'rgba(6,5,11,.62)'); fog.addColorStop(1, 'rgba(6,5,11,.45)');
    g.fillStyle = fog; g.fillRect(0, top, r.bw, r.bh - top);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < S.lights; i++) { const b = TORCHES[i]; pool7(g, b.x, b.y, 124, '255,154,74', .42 * flicker(b.t)); }
    pool7(g, CX, CY, 78, '79,224,204', .3 + .07 * Math.sin(t * 1.7)); pool7(g, hero.x, hero.y, 82, '201,194,236', .22);
    g.globalCompositeOperation = 'source-over';
    for (const [, fn] of items) fn(g);
    // particles and damage numbers, over the scene
    for (const q of P.list) {
      const p = proj(q.x, q.y, q.z || 0); if (!p) continue; const u = q.life / q.max;
      if (q.kind === 'text') { if (u < .75 || Math.floor(q.life * 20) % 2) E.font.text(g, q.text, Math.round(p[0]), Math.round(p[1]), q.color, { align: 'center', scale: (q.scale || 1) * tx, outline: '#0b0814' }); continue; }
      if (q.kind === 'ring') continue;
      const add = q.kind === 'spark' || q.kind === 'ember' || q.kind === 'glint' || q.kind === 'impact';
      if (add) g.globalCompositeOperation = 'lighter';
      g.fillStyle = q.kind === 'spark' && u < .5 ? (q.hot || '#fff5cf') : q.color; const sz = Math.max(1, (q.size || 1) * p[2] * .7);
      g.fillRect(Math.round(p[0] - sz / 2), Math.round(p[1] - sz / 2), Math.ceil(sz), Math.ceil(sz));
      if (add) g.globalCompositeOperation = 'source-over';
    }
    if (note) E.font.text(g, note.text, Math.round(W / 2), 3 * tx, '#ffffff', { align: 'center', shadow: '#000', outline: false, font: 'tiny', scale: tx });
    g.restore();
  });
}
function disc7(g, x, y, rad, color) { g.fillStyle = color; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill(); }
function glow7(g, x, y, rad, color, a) {
  const gr = g.createRadialGradient(x, y, 0, x, y, rad), c = E.hex(color); gr.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${a})`); gr.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
  g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); g.globalCompositeOperation = 'source-over';
}
/** one wall cell: its front face (bricks), its sides toward the camera and its top, in perspective */
function wall7(g, cx, cy, t) {
  const x0 = cx * T, x1 = x0 + T, y0 = cy * T, y1 = y0 + T, h = depthCut(cx, cy) ? (t.cutH || 6) : t.h;
  const poly = (pts, color) => { const ps = []; for (const q of pts) { const p = proj(q[0], q[1], q[2]); if (!p) return; ps.push(p); } g.fillStyle = color; g.beginPath(); ps.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fill(); };
  if (PJ.x > x1 && map.cell(cx + 1, cy) === 0) poly([[x1, y0, 0], [x1, y1, 0], [x1, y1, h], [x1, y0, h]], E.shade(t.side, -.25));
  if (PJ.x < x0 && map.cell(cx - 1, cy) === 0) poly([[x0, y0, 0], [x0, y1, 0], [x0, y1, h], [x0, y0, h]], E.shade(t.side, -.25));
  if (PJ.h > h) poly([[x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h]], t.top);
  if (map.cell(cx, cy + 1) === 0) {
    const a = proj(x0, y1, 0), b = proj(x1, y1, h); if (!a || !b) return;
    g.drawImage(face7(t, h), a[0], b[1], b[0] - a[0], a[1] - b[1]);
  }
}
/** a brazier: stone base, iron bowl, glowing coals and three flame tongues, at the size its distance gives */
function brazier7(g, b) {
  const p = proj(b.x, b.y, 0); if (!p) return; const k = p[2], x = p[0], y = p[1], t = b.t;
  g.fillStyle = '#4c4562'; g.fillRect(x - 3 * k, y - 8 * k, 6 * k, 8 * k);
  g.fillStyle = '#2b2430'; g.fillRect(x - 5.5 * k, y - 11 * k, 11 * k, 3 * k);
  g.fillStyle = '#ff8a3c'; g.fillRect(x - 4 * k, y - 11.4 * k, 8 * k, .8 * k);
  for (let i = 0; i < 3; i++) {
    const hh = (7 + Math.sin(t * 9 + i * 2) * 2.2 + Math.sin(t * 17 + i) * 1.2) * k, sw = Math.sin(t * 6 + i * 1.7) * 1.4 * k, bx = x + (i - 1) * 1.8 * k;
    for (const [w, c, f] of [[2.2, '#ff7a2a', 1], [1.2, '#ffd36a', .65]]) { g.fillStyle = c; g.beginPath(); g.moveTo(bx - w * k, y - 11 * k); g.lineTo(bx + sw * f, y - 11 * k - hh * f); g.lineTo(bx + w * k, y - 11 * k); g.fill(); }
  }
  glow7(g, x, y - 14 * k, 16 * k, '#ff9a4a', .35 * flicker(t));
}
/** a character: its shadow, a telegraph or trail if it has one, and the engine's own drawing at its distance's size */
function actor7(g, e, p) {
  const k = p[2], v = view7(k), isHero = e === hero;
  const alpha = isHero ? (e.dead ? clamp(4 - e.deadT * 2, 0, 1) : 1) : !e.alive ? clamp(e.type === 'wisp' ? 1 - e.deadT / POP_T : (DEAD_T - e.deadT) * 2, 0, 1) : e.spawnT > 0 ? clamp(1 - e.spawnT / .6, .05, 1) : 1;
  if (e.type === 'wisp') {   // a glowing orb, its halo and motes
    const kk = !e.alive ? 1 + e.deadT / POP_T * 1.8 : e.charge > 0 ? 1 + (1 - e.charge / .6) * .8 : 1;
    g.globalAlpha = alpha; glow7(g, p[0], p[1], 7 * kk * k, '#7a4ac0', .7); disc7(g, p[0], p[1], 3.2 * kk * k, e.flash > 0 ? '#ffffff' : '#c78bff'); disc7(g, p[0] - .5 * k, p[1] - .5 * k, 1.8 * kk * k, '#f4e6ff');
    for (let i = 0; i < 3; i++) { const a = e.t * 4 + i * TAU / 3; disc7(g, p[0] + Math.cos(a) * 6 * kk * k, p[1] + Math.sin(a) * 3 * kk * k, Math.max(.6, .7 * k), '#e3c8ff'); }
    g.globalAlpha = 1; return;
  }
  const s = proj(e.x, e.y, 0);
  if (s) { g.globalAlpha = .45 * alpha; g.fillStyle = '#05030c'; g.beginPath(); g.ellipse(s[0], s[1], 5.5 * s[2], Math.max(1, 5.5 * s[2] * PJ.sp * 1.6), 0, 0, TAU); g.fill(); g.globalAlpha = 1; }
  if (e.type === 'walker' && e.alive && e.atk && e.atk.busy && e.atk.phase === 'wind') { const u = e.atk.u, r0 = e.r * .6, r1 = r0 + (e.kind.reach[e.next] - r0) * u; floorPoly7(g, arc7(e.x, e.y, r0, r1, e.facing), '#ff4a3a', .25 + .45 * u); }
  if (e.type === 'slime' && e.state === 'wind') { const u = clamp(1 - e.t / .5, 0, 1), a = Math.atan2(hero.y - e.y, hero.x - e.x), r0 = e.r * .6; floorPoly7(g, arc7(e.x, e.y, r0, r0 + (Math.hypot(hero.x - e.x, hero.y - e.y) - hero.r - r0) * u, a), '#ff4a3a', .25 + .45 * u); }
  g.globalAlpha = alpha;
  if (e.rig) e.rig.draw(g, Math.round(p[0]), Math.round(p[1]), v); else e.blob.draw(g, Math.round(p[0]), Math.round(p[1]), v);
  g.globalAlpha = 1;
  const tr = e.rig && e.rig.trail; if (tr && tr.length > 1 && (isHero || (e.alive && e.atk))) trail7(g, tr, isHero ? '216,242,255' : '255,122,90');
}
const arc7 = (x, y, r0, r1, a) => { const pts = []; for (let i = 0; i <= 8; i++) { const b = a - .8 + 1.6 * i / 8; pts.push([x + Math.cos(b) * r1, y + Math.sin(b) * r1]); } for (let i = 8; i >= 0; i--) { const b = a - .8 + 1.6 * i / 8; pts.push([x + Math.cos(b) * r0, y + Math.sin(b) * r0]); } return pts; };
/** a blade's trail: its last base and tip points as a fading band */
function trail7(g, tr, rgb) {
  const n = Math.min(10, tr.length); g.globalCompositeOperation = 'lighter';
  for (let i = 1; i < n; i++) {
    const A = tr[tr.length - n + i - 1], B = tr[tr.length - n + i], pa = proj(...A.b), pb = proj(...B.b), ta = proj(...A.t), tb = proj(...B.t); if (!pa || !pb || !ta || !tb) continue;
    g.fillStyle = `rgba(${rgb},${(i / n) * .55})`; g.beginPath(); g.moveTo(pa[0], pa[1]); g.lineTo(ta[0], ta[1]); g.lineTo(tb[0], tb[1]); g.lineTo(pb[0], pb[1]); g.closePath(); g.fill();
  }
  g.globalCompositeOperation = 'source-over';
}
// aiming with the mouse: the floor point under it, through the same projection
{
  const base = game.mouseGround.bind(game);
  game.mouseGround = () => {
    if (!depthActive()) return base();
    const m = game.input.mouseScreen(); if (!m) return null;
    const bx = m[0] - game.screen.ix, by = m[1] - game.screen.iy, D = rowDepth(by); if (!D) return null;
    const zc = D * PJ.cp + PJ.h * PJ.sp; return [PJ.x + (bx - PJ.cx) * zc / PJ.f, PJ.y - D];
  };
}

/* =============================================================================
 * METRICS, CONTROLS, BENCHMARK
 * ============================================================================= */
const $ = id => document.getElementById(id);
const frameStats = { lights: 0 };
const ft = []; let lastT = 0, showRig = false;
const ema = { update: 0, render: 0 };
let gpuSkipLast = 0, gpuSkipRate = 0, gpuSkipT = performance.now(), refreshEst = 60;
function pct(arr, p) { const a = arr.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(a.length * p))] || 0; }
function snapRefresh(f) { const R = [30, 50, 60, 75, 90, 100, 120, 144, 165, 180, 240, 360]; let best = 60; for (const r of R) if (Math.abs(r - f) < Math.abs(best - f)) best = r; return best; }

// frame-time graph
const graph = $('graph'), gctx = graph.getContext('2d');
function sizeGraph() { const d = Math.min(3, devicePixelRatio || 1), rc = graph.getBoundingClientRect(); graph.width = Math.max(1, Math.round(rc.width * d)); graph.height = Math.max(1, Math.round(rc.height * d)); }
sizeGraph(); addEventListener('resize', sizeGraph);
function drawGraph() {
  const w = graph.width, h = graph.height, g = gctx, maxMs = 50, cs = getComputedStyle(document.documentElement);
  g.clearRect(0, 0, w, h);
  const y = ms => h - Math.min(1, ms / maxMs) * h;
  g.fillStyle = cs.getPropertyValue('--line').trim() || 'rgba(255,255,255,.2)';
  for (const m of [1000 / 60, 1000 / 30]) g.fillRect(0, Math.round(y(m)), w, 1);
  const n = Math.min(ft.length, 180), bw = w / 180;
  for (let i = 0; i < n; i++) {
    const ms = ft[ft.length - n + i];
    g.fillStyle = ms <= 18 ? cs.getPropertyValue('--good') : ms <= 34 ? cs.getPropertyValue('--warn') : cs.getPropertyValue('--bad');
    g.fillRect(Math.floor(i * bw), Math.round(y(ms)), Math.max(1, Math.ceil(bw)), h);
  }
}

function hwInfo() {
  const lines = [];
  const ua = navigator.userAgentData;
  lines.push('Browser: ' + (ua && ua.brands ? ua.brands.filter(b => !/Not/i.test(b.brand)).map(b => b.brand + ' ' + b.version).join(', ') + (ua.platform ? ' on ' + ua.platform : '') : navigator.userAgent));
  lines.push('CPU threads: ' + (navigator.hardwareConcurrency || 'unknown') + (navigator.deviceMemory ? ', memory about ' + navigator.deviceMemory + ' GB' : ''));
  lines.push('Screen: ' + screen.width + '×' + screen.height + ' at ' + (devicePixelRatio || 1) + 'x pixel ratio');
  let g = '';
  if (gpu.adapterInfo) { const i = gpu.adapterInfo; g = [i.vendor, i.architecture, i.description].filter(Boolean).join(' '); }
  if (!g) { try { const c = document.createElement('canvas').getContext('webgl'); const ext = c && c.getExtension('WEBGL_debug_renderer_info'); g = ext ? c.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ''; } catch (e) { g = ''; } }
  lines.push('GPU: ' + (g || 'not reported by the browser') + ' (WebGPU ' + (gpu.status() === 'unavailable' ? 'unavailable' : 'available') + ')');
  return lines;
}
let hwLines = null;

function hint(fps, frameMs, cpuMs) {
  if (gpu.active(game.view) && gpuSkipRate > 1) return ['GPU-bound', 'bad', 'The graphics card is dropping frames. Lower the camera distance, torches or shadows.'];
  if (fps >= refreshEst * .93) return ['Headroom', 'good', 'Running at the display\'s refresh rate. Add more load to find the limit.'];
  if (cpuMs > frameMs * .75) return ['CPU-bound', 'warn', 'Game logic and drawing use most of each frame. Fewer monsters, outlines off, or skipping off-screen animation helps most.'];
  return ['Browser-bound', 'warn', 'Time is going to the browser and compositor. Lower the camera distance to shrink the image.'];
}
let hudT = 0;
function hud() {
  const now = performance.now();
  if (lastT) { ft.push(now - lastT); if (ft.length > 600) ft.shift(); }
  lastT = now;
  const st = game.stats;
  ema.update = lerp(ema.update, st.updateMs, .1); ema.render = lerp(ema.render, st.renderMs, .1);
  if (bench) benchFrame(ft[ft.length - 1] || 16.7);
  drawGraph();
  if (now - hudT < 250) return; hudT = now;
  if (now - gpuSkipT > 1000) { const sk = gpu.skipped || 0; gpuSkipRate = (sk - gpuSkipLast) * 1000 / (now - gpuSkipT); gpuSkipLast = sk; gpuSkipT = now; }
  const recent = ft.slice(-60), avgMs = recent.reduce((a, b) => a + b, 0) / Math.max(1, recent.length), fps = 1000 / avgMs, low = 1000 / pct(ft.slice(-240), .99);
  if (S.monsters === 0 && S.rate === 0 && ft.length > 120) refreshEst = Math.max(refreshEst === 60 ? 0 : refreshEst, snapRefresh(fps));
  $('fpsBig').textContent = Math.round(fps);
  $('mFrame').textContent = avgMs.toFixed(1) + ' ms';
  $('mLow').textContent = Math.round(low) + ' fps';
  $('mUpdate').textContent = ema.update.toFixed(1) + ' ms';
  $('mRender').textContent = ema.render.toFixed(1) + ' ms';
  const alive = enemies.filter(e => e.alive).length;
  $('mMonsters').textContent = alive.toLocaleString() + ' (' + st.actors + ' drawn)';
  $('mParts').textContent = P.list.length.toLocaleString() + ' / ' + S.pcap.toLocaleString();
  $('mLights').textContent = frameStats.lights + (gpu.active(game.view) && frameStats.lights > 32 ? ' (GPU uses 32)' : '');
  $('mItems').textContent = st.items.toLocaleString();
  const sc = game.screen; $('mRes').textContent = sc.W + '×' + sc.H + ' (' + Math.round(sc.W * sc.H / 1000) + 'k px)';
  $('mGpu').textContent = gpu.status() === 'on' ? (gpu.active(game.view) ? 'on' + (gpuSkipRate > .5 ? ', dropping ' + Math.round(gpuSkipRate) + '/s' : '') : 'on (not used in this view)') : gpu.status() === 'off' ? 'off' : gpu.status() === 'loading' ? 'starting' : 'unavailable';
  const [tag, cls, text] = hint(fps, avgMs, ema.update + ema.render);
  const tg = $('bottleneck'); tg.textContent = tag; tg.dataset.level = cls; $('hint').textContent = text;
  if (!hwLines && gpu.status() !== 'loading') { hwLines = hwInfo(); $('hw').textContent = hwLines.join('\n'); }
}

/* ---------- controls ---------- */
const VIEWS = ['iso', 'threequarter', 'topdown', 'brawler', 'side'];
/* the camera beyond the engine's named views:
 *   Custom  any orthographic view the engine can give: a turn, a tilt (0 is the side view) and a height boost, as in the
 *           free camera room; zoom and the 45° turn keys still apply on top
 *   Fix     the camera stops following the hero and stays where it is, in any view (F)
 *   ?cam=yaw,pitch,zoom,height,boost[,x,y]  the free camera room's format: opens the custom view, fixed at x, y */
const CUSTOM = { yaw: 30, pitch: 40, boost: 1.1 };
const FIX = { on: false, x: 0, y: 0, z: 0 };
const customViews = new Map();
function customView() {   // whole degrees and boosts in .05 steps, so a slider drag reuses cached views
  const pitch = CUSTOM.pitch < 3 ? 0 : Math.max(5, Math.round(CUSTOM.pitch)), yaw = pitch ? ((Math.round(CUSTOM.yaw) % 360) + 360) % 360 : 0, boost = Math.round(CUSTOM.boost * 20) / 20;
  const key = yaw + ':' + pitch + ':' + boost; let v = customViews.get(key);
  // (the id carries the boost: the map caches its wall blocks per id, turn, tilt and scale)
  if (!v) { if (customViews.size > 300) customViews.clear(); v = new E.View('custom-' + boost, 'Custom', yaw, pitch, 1.5, boost); customViews.set(key, v); }
  return v;
}
const isCustom = () => game.baseView.id.startsWith('custom');
function setCustom() { game.setView(customView()); syncUI(); }
function toggleFix() { setFixed(!FIX.on); }
function setFixed(on) {
  FIX.on = on; if (on) { FIX.x = game.cam.tx; FIX.y = game.cam.ty; FIX.z = game.cam.tz; }
  game.note(on ? 'CAMERA FIXED' : 'CAMERA FOLLOWS THE HERO'); syncUI();
}
/** the camera in words, for the benchmark's report */
function camDesc() {
  const v = game.view, b = game.baseView;
  if (depthActive()) return 'Side scrolling with depth (Mode 7: the floor a row at a time, everything scaled by its distance)' + (FIX.on ? ', camera fixed' : '');
  return (isCustom() ? 'Custom view (turn ' + b.yawDeg + '°, tilt ' + b.pitchDeg + '°, height boost ' + b.zBoost + ')' : v.label + ' view') + (FIX.on ? ', camera fixed' : '');
}
/** the camera as a link: the free camera room's ?cam= (turn, tilt, zoom, height, boost, and where it is fixed) */
function camLink() {
  const b = game.baseView, u = new URL(location.href);
  if (depthActive()) { for (const k of ['cam', 'view', 'depth']) u.searchParams.delete(k); const rest = u.search.slice(1); return u.origin + u.pathname + '?' + [rest, 'view=side&depth=1'].filter(Boolean).join('&') + u.hash; }
  const n = [((b.yawDeg + (b.pitchDeg < 5 ? 0 : game.yaw)) % 360 + 360) % 360, b.pitchDeg, game.zoom, Math.round(FIX.on ? FIX.z : game.cam.tz), b.zBoost];
  if (FIX.on) n.push(Math.round(FIX.x), Math.round(FIX.y));
  u.searchParams.delete('cam'); u.searchParams.delete('view'); const rest = u.search.slice(1);
  return u.origin + u.pathname + '?' + [rest, 'cam=' + n.join(',')].filter(Boolean).join('&') + u.hash;
}
function setDistance(d) {
  S.distance = d;
  game.screen.setOptions({ minH: BASE.minH * d, minW: BASE.minW * d, maxW: Math.round(BASE.maxW * d), maxH: Math.round(BASE.maxH * d), portrait: { maxH: Math.round(BASE.portrait.maxH * d) } });
  game.cam.snap = true;
}
// camera: distance (above) renders more pixels, zoom scales the drawing at the same resolution, turn spins the view
const ZOOMS = [.5, .75, 1, 1.25, 1.5, 2, 2.5, 3];
function zoomStep(d) { const i = ZOOMS.findIndex(z => z >= game.zoom - 1e-6); game.setZoom(ZOOMS[clamp(i + d, 0, ZOOMS.length - 1)]); game.note('ZOOM ' + game.zoom + 'x'); syncUI(); }
function turn(deg) { game.rotateView(deg); game.note('TURN ' + game.yaw + ' DEG'); syncUI(); }   // (the pixel font has no degree sign)
function resetCam() { game.resetCamera(); game.note('CAMERA RESET'); syncUI(); }
function syncUI() {
  $('monsters').value = Math.min(5000, S.monsters); $('monstersOut').textContent = S.monsters.toLocaleString();
  $('mix').value = S.mix; $('skin').value = S.skin; $('behavior').value = S.behavior;
  $('zoomOut').textContent = game.zoom + '×'; $('turnOut').textContent = game.yaw + '°';
  $('lights').value = S.lights; $('lightsOut').textContent = S.lights;
  $('shapes').value = S.shapes; $('shapesOut').textContent = S.shapes;
  $('rate').value = S.rate; $('rateOut').textContent = S.rate.toLocaleString() + '/s';
  $('pcap').value = S.pcap; $('pcapOut').textContent = S.pcap.toLocaleString();
  $('distance').value = S.distance; $('distanceOut').textContent = S.distance.toFixed(2).replace(/\.?0+$/, '') + '×';
  $('god').checked = S.god; $('outlines').checked = S.outlines; $('capes').checked = S.capes; $('lod').checked = S.lod; $('mlights').checked = S.monsterLights;
  const st = gpu.status();
  $('gpuOn').checked = st === 'on'; $('gpuOn').disabled = st === 'unavailable' || st === 'loading';
  $('gpuLabel').title = st === 'unavailable' ? (gpu.failed || '') : '';
  $('shadows').checked = st === 'on' && gpu.shadows; $('shadows').disabled = st !== 'on';
  $('canvasLight').checked = game.lights.enabled;
  $('dither').checked = E.style.trans === 'dither'; $('readable').checked = E.style.charPitch !== false;
  document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === 'custom' ? isCustom() : b.dataset.view === game.view.id)));
  $('customCam').hidden = !isCustom(); $('depth').checked = DEPTH.on;
  $('camYaw').value = Math.round(CUSTOM.yaw); $('camYawOut').textContent = customView().pitchDeg ? customView().yawDeg + '°' : 'side';
  $('camPitch').value = Math.round(CUSTOM.pitch); $('camPitchOut').textContent = customView().pitchDeg + '°';
  $('camBoost').value = Math.round(CUSTOM.boost * 100); $('camBoostOut').textContent = customView().zBoost.toFixed(2);
  $('fsBtn').textContent = document.fullscreenElement ? 'Leave full screen' : 'Full screen'; $('fsStart').checked = fsStart;
  const fx = FIX.on; $('fixBtn').setAttribute('aria-pressed', String(fx)); $('fixBtn').firstChild.textContent = fx ? 'Unfix camera ' : 'Fix camera here ';
}
gpu.onStatus = syncUI;
const on = (id, ev, f) => $(id).addEventListener(ev, e => { f(e); syncUI(); });
on('monsters', 'input', e => setMonsters(+e.target.value));
document.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => { setMonsters(b.hasAttribute('data-clear') ? 0 : Math.max(0, Math.min(10000, S.monsters + +b.dataset.add))); syncUI(); b.blur(); }));
const respawn = () => { const n = S.monsters; setMonsters(0); setMonsters(n, true); };
on('mix', 'change', e => { S.mix = e.target.value; respawn(); e.target.blur(); });
on('skin', 'change', e => { S.skin = e.target.value; respawn(); e.target.blur(); });
on('behavior', 'change', e => { S.behavior = e.target.value; e.target.blur(); });
on('lights', 'input', e => { S.lights = +e.target.value; });
on('shapes', 'input', e => { S.shapes = +e.target.value; });
on('rate', 'input', e => { S.rate = +e.target.value; });
on('pcap', 'input', e => { S.pcap = +e.target.value; P.max = S.pcap; });
on('distance', 'input', e => setDistance(+e.target.value));
on('god', 'change', e => { S.god = e.target.checked; e.target.blur(); });
on('outlines', 'change', e => { S.outlines = e.target.checked; e.target.blur(); });
on('capes', 'change', e => { S.capes = e.target.checked; applyCapes(); e.target.blur(); });
on('lod', 'change', e => { S.lod = e.target.checked; e.target.blur(); });
on('mlights', 'change', e => { S.monsterLights = e.target.checked; e.target.blur(); });
on('gpuOn', 'change', e => { gpu.enabled = e.target.checked; e.target.blur(); });
on('shadows', 'change', e => { gpu.shadows = e.target.checked; e.target.blur(); });
on('canvasLight', 'change', e => { game.lights.enabled = e.target.checked; e.target.blur(); });
// the engine's own looks (E.style): dithered translucency (NES, Genesis) or stepped alpha (PS1); the readable tilt in steep views
on('dither', 'change', e => { E.style.trans = e.target.checked ? 'dither' : 'alpha'; e.target.blur(); });
on('readable', 'change', e => { E.style.charPitch = e.target.checked ? undefined : false; e.target.blur(); });
document.querySelectorAll('input[type=range]').forEach(el => el.addEventListener('pointerup', () => el.blur()));
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { if (b.dataset.view === 'custom') setCustom(); else game.setView(b.dataset.view); syncUI(); b.blur(); }));
for (const [id, k, f] of [['camYaw', 'yaw', v => v], ['camPitch', 'pitch', v => v], ['camBoost', 'boost', v => v / 100]]) $(id).addEventListener('input', e => { CUSTOM[k] = f(+e.target.value); setCustom(); });
$('fixBtn').addEventListener('click', e => { toggleFix(); e.currentTarget.blur(); });
$('depth').addEventListener('change', e => { setDepth(e.target.checked); e.target.blur(); });
$('camLinkBtn').addEventListener('click', async e => {
  const b = e.currentTarget, link = camLink(); b.blur();
  try { await navigator.clipboard.writeText(link); b.textContent = 'Copied'; } catch (err) { prompt('The camera link:', link); }
  setTimeout(() => { b.textContent = 'Copy camera link'; }, 1500);
});
document.querySelectorAll('[data-zoom]').forEach(b => b.addEventListener('click', () => { zoomStep(+b.dataset.zoom); b.blur(); }));
document.querySelectorAll('[data-turn]').forEach(b => b.addEventListener('click', () => { turn(+b.dataset.turn); b.blur(); }));
$('camReset').addEventListener('click', e => { resetCam(); e.target.blur(); });
let wheelT = 0;   // the mouse wheel zooms over the game (the panel keeps scrolling)
canvas.addEventListener('wheel', e => { const t = performance.now(); if (t - wheelT > 120) { wheelT = t; zoomStep(e.deltaY < 0 ? 1 : -1); } }, { passive: true });
const PRESETS = {
  light: { monsters: 100, lights: 8, rate: 100, pcap: 2000, distance: 1, capes: false, monsterLights: false, outlines: true },
  medium: { monsters: 400, lights: 16, rate: 400, pcap: 3000, distance: 1.5, capes: false, monsterLights: false, outlines: true },
  heavy: { monsters: 1200, lights: 24, rate: 1000, pcap: 5000, distance: 2.5, capes: true, monsterLights: false, outlines: true },
  extreme: { monsters: 3000, lights: 30, rate: 2500, pcap: 9000, distance: 4, capes: true, monsterLights: true, outlines: true },
  reset: { monsters: 0, lights: 12, rate: 0, pcap: 2000, distance: 1, capes: false, monsterLights: false, outlines: true, shapes: 0 }
};
document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
  const p = PRESETS[b.dataset.preset];
  Object.assign(S, { lights: p.lights, rate: p.rate, pcap: p.pcap, capes: p.capes, monsterLights: p.monsterLights, outlines: p.outlines });
  setDistance(p.distance); setMonsters(p.monsters); applyCapes(); if (b.dataset.preset === 'reset') game.resetCamera(); syncUI(); b.blur();
}));
function setPanel(open) { $('panel').hidden = !open; $('showPanel').hidden = open; }
$('hidePanel').addEventListener('click', () => setPanel(false));
$('showPanel').addEventListener('click', () => setPanel(true));
addEventListener('keydown', e => {
  if (e.repeat || (e.target && ['SELECT', 'TEXTAREA'].includes(e.target.tagName))) return;
  if (e.code === 'KeyH') setPanel($('panel').hidden);
  else if (e.code === 'KeyV') { game.setView(VIEWS[(VIEWS.indexOf(game.view.id) + 1) % VIEWS.length]); game.note(game.view.label.toUpperCase() + ' VIEW'); syncUI(); }
  else if (e.code === 'Minus' || e.code === 'NumpadSubtract') zoomStep(-1);
  else if (e.code === 'Equal' || e.code === 'NumpadAdd') zoomStep(1);
  else if (e.code === 'BracketLeft' || e.code === 'BracketRight') turn(e.code === 'BracketLeft' ? -45 : 45);
  else if (e.code === 'Digit0') resetCam();
  else if (e.code === 'KeyG' && gpu.status() !== 'unavailable' && gpu.status() !== 'loading') { gpu.enabled = !gpu.enabled; syncUI(); }
  else if (e.code === 'KeyR') showRig = !showRig;
  else if (e.code === 'KeyF') toggleFix();
  else if (e.code === 'KeyM') setDepth(!DEPTH.on);
});
game.input.bindButtons(document);

/* ---------- benchmark ---------- */
const STEPS = [0, 50, 100, 200, 400, 700, 1000, 1500, 2000, 3000, 4000, 5000];
let bench = null, lastReport = '';
function benchStart() {
  bench = { i: 0, phase: 'warm', t0: performance.now(), samples: [], results: [] };
  S.god = true; hero.inv = 0;
  setMonsters(STEPS[0], true);
  document.body.classList.add('benching');
  $('benchBtn').textContent = 'Stop benchmark'; $('benchTable').innerHTML = ''; $('copyBtn').hidden = true; $('benchSummary').textContent = '';
  benchStatus();
}
function benchStop(done) {
  document.body.classList.remove('benching');
  $('benchBtn').textContent = 'Run benchmark';
  if (done && bench.results.length) benchReport();
  else $('benchStatus').textContent = 'Stopped.';
  bench = null; syncUI();
}
function benchStatus() { $('benchStatus').textContent = 'Testing ' + STEPS[bench.i].toLocaleString() + ' monsters (step ' + (bench.i + 1) + ' of ' + STEPS.length + ')...'; }
function benchFrame(ms) {
  const now = performance.now();
  if (bench.phase === 'warm') { if (now - bench.t0 > 1500) { bench.phase = 'measure'; bench.t0 = now; bench.samples = []; } return; }
  bench.samples.push(ms);
  if (now - bench.t0 < 3000) return;
  const avg = bench.samples.reduce((a, b) => a + b, 0) / bench.samples.length;
  const res = { n: STEPS[bench.i], fps: 1000 / avg, low: 1000 / pct(bench.samples, .99), logic: ema.update, draw: ema.render, cpu: ema.update + ema.render };
  bench.results.push(res);
  const row = document.createElement('tr');
  row.innerHTML = '<td>' + res.n.toLocaleString() + '</td><td>' + Math.round(res.fps) + '</td><td>' + Math.round(res.low) + '</td><td>' + res.logic.toFixed(1) + '</td><td>' + res.draw.toFixed(1) + '</td><td>' + res.cpu.toFixed(1) + '</td>';
  $('benchTable').appendChild(row);
  bench.i++;
  if (res.fps < 20 || bench.i >= STEPS.length) return benchStop(true);
  setMonsters(STEPS[bench.i], true); bench.phase = 'warm'; bench.t0 = now; benchStatus();
}
function benchReport() {
  const R = bench.results, base = R[0] ? R[0].fps : 60;
  const upto = th => { let best = null; for (const r of R) if (r.fps >= th) best = r.n; return best; };
  const smooth = upto(Math.min(55, base * .92)), play = upto(30);
  const smoothText = smooth === null ? 'Not smooth even with an empty hall. ' : smooth === 0 ? 'Smooth only with an empty hall. ' : 'Smooth up to ' + smooth.toLocaleString() + ' monsters. ';
  const playText = play === null ? 'Below 30 fps even with an empty hall.' : play === 0 ? 'Playable (30 fps) only with an empty hall.' : 'Playable (30 fps) up to ' + play.toLocaleString() + ' monsters.';
  const summary = smoothText + playText;
  $('benchSummary').textContent = summary; $('benchStatus').textContent = 'Done.';
  const v = game.view, sc = game.screen;
  lastReport = [
    'my-3D2dge stress test',
    'Result: ' + summary,
    'Settings: ' + camDesc() + ', camera distance ' + S.distance + 'x (' + sc.W + '×' + sc.H + ' internal), zoom ' + game.zoom + 'x, turn ' + game.yaw + '°, ' + (gpu.active(v) ? 'GPU lighting' + (gpu.shadows ? ' with shadows' : ' without shadows') : 'Canvas lighting' + (game.lights.enabled ? '' : ' off')) +
      ', ' + S.lights + ' torches, ' + (S.shapes ? S.shapes + ' shapes, ' : '') + S.rate + ' particles/s, mix ' + S.mix + ', rig ' + S.skin + ', behavior ' + S.behavior + ', outlines ' + (S.outlines ? 'on' : 'off') + ', monster capes ' + (S.capes ? 'on' : 'off') + ', off-screen animation ' + (S.lod ? 'skipped' : 'on') +
      (E.style.trans === 'dither' ? ', dithered translucency' : '') + (E.style.charPitch === false ? ', characters as the camera sees them' : ''),
    ...(hwLines || hwInfo()),
    '',
    // CPU ms = game logic + drawing (the CPU's side of it: what the GPU does after is in the frame time, not here)
    'Monsters | avg fps | 1% low | logic ms | drawing ms | CPU ms',
    ...R.map(r => r.n + ' | ' + Math.round(r.fps) + ' | ' + Math.round(r.low) + ' | ' + r.logic.toFixed(1) + ' | ' + r.draw.toFixed(1) + ' | ' + r.cpu.toFixed(1))
  ].join('\n');
  $('copyBtn').hidden = false;
}
$('benchBtn').addEventListener('click', () => { if (bench) benchStop(false); else benchStart(); $('benchBtn').blur(); });
$('copyBtn').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(lastReport); $('copyBtn').textContent = 'Copied'; }
  catch (e) { const ta = $('reportText'); ta.hidden = false; ta.value = lastReport; ta.select(); $('copyBtn').textContent = 'Select and copy below'; }
  setTimeout(() => { $('copyBtn').textContent = 'Copy results'; }, 2000);
});

// a ?cam= link (Copy camera link, or the free camera room's): the custom view at that turn, tilt, zoom and boost, fixed
// where it says (x, y and the height), or following the hero without them; ?view=custom opens the custom view as it is
{
  const n = (qs.get('cam') || '').split(',').map(Number);
  if (n.length >= 5 && n.every(Number.isFinite)) {
    Object.assign(CUSTOM, { yaw: n[0], pitch: clamp(n[1], 0, 90), boost: clamp(n[4], 1, 1.5) });
    game.setView(customView()); game.setZoom(clamp(n[2], .5, 3));
    if (n.length >= 7) { Object.assign(FIX, { on: true, x: n[5], y: n[6], z: clamp(n[3], -40, 100) }); game.focus(FIX.x, FIX.y, FIX.z); }
  } else if (qs.get('view') === 'custom') game.setView(customView());
}
// full screen: the stage (picture, panel and numbers) fills the screen. Browsers allow it only from a click or a key, so
// "start in full screen" (remembered on this device) enters it on the first one
const FS_KEY = 'my3d2dge.stress.fullscreen';
let fsStart = false; try { fsStart = localStorage.getItem(FS_KEY) === '1'; } catch (e) { /* storage blocked: off */ }
function fullScreen(on) {
  try {
    if (on && !document.fullscreenElement) { const r = $('stage').requestFullscreen(); if (r && r.catch) r.catch(() => {}); }
    else if (!on && document.fullscreenElement) document.exitFullscreen();
  } catch (e) { /* refused (an embedded page, an old browser): stays as it is */ }
}
if (fsStart) { const go = () => { fullScreen(true); removeEventListener('pointerdown', go, true); removeEventListener('keydown', go, true); }; addEventListener('pointerdown', go, true); addEventListener('keydown', go, true); }
$('fsBtn').hidden = !document.documentElement.requestFullscreen;
$('fsBtn').addEventListener('click', e => { fullScreen(!document.fullscreenElement); e.currentTarget.blur(); });
$('fsStart').addEventListener('change', e => { fsStart = e.target.checked; try { localStorage.setItem(FS_KEY, fsStart ? '1' : '0'); } catch (err) { /* not remembered */ } e.target.blur(); });
document.addEventListener('fullscreenchange', () => syncUI());
// the 3D world stress test's address (the site serves pages without .html, a local server as files)
for (const [id, page] of [['toWorld', 'stress-world']]) { const a = $(id); if (a) a.href = /\.html$/.test(location.pathname) ? page + '.html' : '/' + page; }
syncUI();
game.start({ update, draw: r => { draw(r); hud(); } });
window.__game = { game, hero, enemies, corpses, S, SKINS, setMonsters, setDistance, gpu, benchStart, get bench() { return bench; }, get report() { return lastReport; },
  FIX, DEPTH, setDepth };
})();
