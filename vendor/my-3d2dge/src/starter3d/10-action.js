/* =====================================================================================
 * SLICE 1  ACTION  (Zelda 64's dungeons, Diablo; the stress test's hall in real 3D). A torch-lit hall of stone, pillars
 * and low walls, a raised dais in the middle with stairs up both sides. J or a click: a three-hit combo (slash,
 * backslash, spin; the spin hits all round); Shift dashes (through attacks: a moment untouchable), J while dashing
 * thrusts; Space jumps (onto the dais, over low walls); E throws an ember bolt where the mouse points. Five waves:
 * husks, skeletons, slimes that hop and pounce, wisps that orbit and shoot; at most three of them attack at once, each
 * telegraphing its swing with a red arc on the floor; then a knight. Big hits throw bodies; crates and barrels break.
 * THE 3D: every monster is a Rapier body (the crowd pushes and piles up by itself, knockback is momentum); the hero is a
 * character controller; the monsters find their way up the stairs on the level's flow field. The camera: the 2D views
 * as 3D cameras (V), the chase camera and first person (C). ACTION.run(n): a scripted fight's hash (the proof)
 * ===================================================================================== */
const ACTION = (() => {
  const T = 16;
  /* ---- LEVEL: one character per 1-metre tile ('=' the dais, half a metre up; '^' and 'v' its stairs) ---- */
  const LEVEL = {
    rows: [
      '########################################',
      '#tr...K.....b..............b.....K...rt#',
      '#.k..................................k.#',
      '#...PP.......PP..........PP.......PP...#',
      '#...PP.......PP..........PP.......PP...#',
      '#......................................#',
      '#.......www....................www.....#',
      '#......................................#',
      '#t....................................t#',
      '#...............................ww.....#',
      '#.............t...^^^^...t.............#',
      '#..............==========..............#',
      '#..............==========..............#',
      '#..www.........==========.........www..#',
      '#..............==========..............#',
      '#..............==========..............#',
      '#..............==========..............#',
      '#.............t...vvvv...t.............#',
      '#......................................#',
      '#t....................................t#',
      '#......ww..............................#',
      '#..aPP.......PP..........PP.......PPk..#',
      '#...PP.......PP..........PP.......PP...#',
      '#......................................#',
      '#...................h..................#',
      '#......................................#',
      '#t....................................t#',
      '########################################'],
    legend: { '=': { floor: 8 }, '^': { stairs: 's', floor: 8 }, 'v': { stairs: 'n', floor: 8 }, h: { mark: 'hero' },
      // shapes (E.SHAPES, docs/ASSETS.md) stand on their tiles: bookcases and benches along the north wall, sacks, an anvil
      K: { shape: 'bookcase' }, b: { shape: 'bench' }, k: { shape: 'sack', facing: 1 }, a: { shape: 'anvil', facing: .4 },
      // a dungeon barrel from the asset store, cut into the page's 'action3d' set (src/assets/sets/action3d.js); the core's without it
      r: { shape: E.addAssets((window.ASSETS || {}).action3d || { set: 'action3d' }).shapes.length ? 'action3d:barrel' : 'barrel', facing: .5 } }
  };

  /* ---- THE CAST: the stress test's monsters (its skins, colors and takes on E.MOVES) ---- */
  const HUSK_COLORS = [
    { skin: '#8fa38a', hair: '#3a3f38', cloth: '#5b4a3c', pants: '#3d3530', boot: '#2c2622', belt: '#7a6a4a', cape: '#4a3a5a', capeIn: '#2c2236' },
    { skin: '#9a9a7a', hair: '#403a30', cloth: '#4a5a4c', pants: '#35302c', boot: '#2a2420', belt: '#6a5a3a', cape: '#5a3a30', capeIn: '#32201a' }];
  const BONE_COLORS = [{ bone: '#d8cfb4', cloth: '#2c2434', belt: '#5a4a38', metal: '#b3b8c0', metalDk: '#636872', hilt: '#6a5038', cape: '#3a3040', capeIn: '#1e1826' }];
  const KNIGHT_COLORS = [{ cloth: '#7a2e34', pants: '#34303c', boot: '#2a2630', belt: '#6a5030', trim: '#d0a85a', metal: '#b9c1cf', metalDk: '#687488', skin: '#d6a58a', hair: '#3a2a22', cape: '#5a1e24', capeIn: '#3a1218' }];
  const MOVE = {   // the monsters' takes on E.MOVES
    claw: { plane: 'side', a0: 1.5, a1: -1.2, reach: 7, crouch: .5, lean: .45, hold: .45 }, hook: { a1: -1, reach: 6.6, lunge: .8, lean: .1, twist: 2.4, hold: .12 },
    haymaker: { hold: .55 }, slash: { a0: 2.1, z0: 1, twist: 1.8, crouch: .4 }, bash: { reach: 6, hop: 1.8, lean: .6, crouch: .5 }, overhead: { a0: 2.4 - TAU, a1: -1.25 - TAU, twist: 0 }
  };
  const KINDS = {
    husk: { rig: { weapon: null, hunch: .4, lean: .18, stride: 5, swing: 2.5, speedRef: 40, armLower: 5.6, headR: 3.2, eyeGlow: '#ff6a3d' }, colors: HUSK_COLORS, moves: ['claw', 'haymaker', 'hook'], hp: 30, speed: 30, dmg: 10, score: 10 },
    skeleton: { rig: { build: 'skeleton', bladeLen: 9 }, colors: BONE_COLORS, moves: ['slash', 'overhead', 'thrust'], hp: 24, speed: 36, dmg: 10, score: 15 },
    knight: { rig: { size: 1.35, build: 'bulky', armor: true, sleeves: 'long', hat: { style: 'helmet', color: '#737c90' }, speedRef: 45 }, colors: KNIGHT_COLORS, moves: ['overhead', 'bash', 'thrust'], hp: 320, speed: 26, dmg: 16, r: 8, stance: 'ready', score: 200 }
  };
  const HERO_R = 4.5, SPEED = 80, JUMP = 150, MAX_ATTACKERS = 3, TURN_GAP = .25;
  const strikePt = (rig, spec) => rig.o.weapon && spec.blade !== 0 ? rig.tip() : rig.hand();
  // each move measured once on a spare rig (its clock at 0, so the numbers never change): its reach, and the distance
  // a monster stands at to land it
  for (const k of Object.values(KINDS)) {
    k.specs = k.moves.map(m => { const sp = new E.Attack(m, MOVE[m]).spec; return Object.assign(sp, { wind: Math.max(.34, sp.wind * 2), recover: sp.recover + .12 }); });
    k.reach = []; k.stand = k.specs.map(spec => {
      const rig = new E.Humanoid(k.rig); rig.t = 0; let far = 0, head = 0;
      for (let u = 0; u <= 1; u += .1) { rig.update(1, { x: 0, y: 0, stance: k.stance, attack: { spec, phase: 'active', u } }); far = Math.max(far, strikePt(rig, spec)[0]); head = Math.max(head, rig.head()[0]); }
      k.reach.push(far); return Math.max(far + HERO_R - 1.5, head + 8.5) * (k.rig.size || 1);
    });
  }
  const HIT = {   // the hero's moves: reach, the cone's half-angle, damage, knockback, his own lunge, a big hit throws
    slash: { range: 27, half: 1.35, dmg: 12, kb: 130, push: 70 }, backslash: { range: 27, half: 1.35, dmg: 12, kb: 130, push: 70 },
    spin: { range: 34, half: Math.PI, dmg: 22, kb: 230, push: 40, big: true }, thrust: { range: 38, half: .45, dmg: 20, kb: 220, push: 130, big: true }
  };
  const WAVES = [{ husk: 4 }, { husk: 4, slime: 3 }, { skeleton: 4, slime: 2, wisp: 2 }, { husk: 3, skeleton: 3, slime: 3, wisp: 3 }, { knight: 1, husk: 2, wisp: 2 }];
  const BITS = { slime: ['#c95f9a', '#f5a3cc', '#6d2658'], wisp: ['#c78bff', '#f4e6ff', '#7a4ac0'], crate: ['#9d6a3f', '#6e4528', '#c08a55'], barrel: ['#8f5f37', '#5d5a66', '#a87547'] };

  /* ---- THE STATE ---- */
  let world = null, flow = null, hero = null, H = null, rnd = Math.random, lamp = null;
  let wave = 0, kills = 0, score = 0, tokens = 0, nextTurn = 0, boss = null, ended = 0, hint = 0;
  const enemies = [], corpses = [], shots = [];
  BOOT.push(['The hall', () => { world = new W3(game, { level: LEVEL, torchShadows: 1, torchLights: 8, lights: 2, ambient: ['#6a64a0', '#2a2438', 6] }); flow = world.flow(); lamp = world.light({ color: '#c9c2ec', reach: 160, power: 20 }); }]);

  /** a fresh hall: the hero at his mark, the crates and barrels, wave 1 on its way (seed: the fight's randomness) */
  function reset(seed = 1) {
    world.reset(); rnd = E.rng(seed);
    enemies.length = corpses.length = shots.length = 0; wave = kills = score = tokens = nextTurn = 0; boss = null; ended = 0; hint = 7;
    const s = world.marks.hero[0];
    hero = world.hero({ x: s.x, y: s.y, r: HERO_R, rig: new E.Humanoid({ cape: { len: 6, width: 5, seg: 2.5 }, colors: { cloth: '#2f8f86', cape: '#c8452f', capeIn: '#7a2622', hair: '#2e2230' } }), trail: '#d8f2ff' });
    H = { hp: 100, max: 100, inv: 0, hurtT: 0, hitA: 0, dashT: 0, dashCD: 0, dashDir: 0, boltCD: 0, castT: 0, cheer: 0, dead: false, deadT: 0, aim: undefined,
      combo: new E.Combo(['slash', new E.Attack('backslash', { a1: 2.2, z1: -3 }), new E.Attack('spin', { z0: -12, z1: -12 })], { window: .3 }), thrust: new E.Attack('thrust', { reach: 10 }) };
    // crates and barrels on spots chosen from the seed, away from the hero and the dais
    for (let n = 0; n < 14;) {
      const [x, y] = world.randomFloor(rnd, 70, s.x, s.y); if (world.ground(x, y) > 0) continue;
      const p = rnd() < .6 ? world.crate(x, y, undefined, rnd() * TAU) : world.barrel(x, y); p.data.hits = 0; n++;
    }
    hero.facing = -Math.PI / 2; world.camera.follow(hero);
    nextWave(true);
  }
  function nextWave(first) {
    const W = WAVES[wave++]; if (!W) return;
    for (const [type, n] of Object.entries(W)) for (let i = 0; i < n; i++) spawn(type);
    game.note(boss ? 'THE KNIGHT' : 'WAVE ' + wave, 1.8); if (!first) A.sfx('powerup');
  }
  function spawn(type) {
    const [x, y] = world.randomFloor(rnd, 90, hero.x, hero.y), k = KINDS[type];
    let e;
    if (k) { e = world.mob({ x, y, r: k.r || 5, half: 8, rig: new E.Humanoid(Object.assign({ colors: k.colors[(rnd() * k.colors.length) | 0], cape: type === 'knight' ? { len: 7, width: 6, seg: 2.8 } : null }, k.rig)), mass: type === 'knight' ? 4 : 1 }); Object.assign(e, { type: 'walker', k, hp: k.hp, max: k.hp, atk: null, cool: rnd(), speed: k.speed + rnd() * 10, next: (rnd() * k.specs.length) | 0, ph: rnd() * TAU, head: 30 * (k.rig.size || 1) }); if (type === 'knight') boss = e; }
    else if (type === 'slime') { e = world.mob({ x, y, blob: new E.Blob(Object.assign({ R: 6.2, face: 'front' }, [{}, { horns: true }, { ears: 'cat' }, { wings: true }][(rnd() * 4) | 0])) }); Object.assign(e, { type, hp: 20, max: 20, state: 'idle', t: rnd(), flap: 0, airT: 0, head: 16, score: 8 }); }
    else { e = world.mob({ x, y, orb: { color: '#c78bff' }, fly: true, r: 5 }); Object.assign(e, { type: 'wisp', hp: 14, max: 14, t: rnd() * 9, fire: 2 + rnd() * 2, charge: 0, orbit: rnd() < .5 ? 1 : -1, head: 10, score: 12 }); }
    Object.assign(e, { stun: 0, spawnT: .6, facing: rnd() * TAU, sink: 34, fade: 0 });
    enemies.push(e); return e;
  }

  /* ---- THE HERO: moves from the controls (ctl: move, aim, pressed(a, window), use(a)) ---- */
  function takeTurn() { if (tokens >= MAX_ATTACKERS || world.time < nextTurn || H.dead) return false; tokens++; nextTurn = world.time + TURN_GAP * (.8 + rnd() * .6); return true; }
  function heroStep(dt, ctl) {
    const h = hero, S = H;
    S.inv -= dt; S.hurtT -= dt; S.dashCD -= dt; S.boltCD -= dt; S.castT -= dt; hero.flash -= dt;
    if (S.dead) { S.deadT += dt; h.vx = h.vy = 0; h.anim = { pose: 'die' }; return; }
    const free = S.cheer <= 0, md = free ? ctl.move : [0, 0], ml = Math.hypot(md[0], md[1]);
    let aim = free ? ctl.aim : null; if ((aim === null || aim === undefined) && ml > .1) aim = Math.atan2(md[1], md[0]); if (aim !== null && aim !== undefined) S.aim = aim;
    if (free && ctl.pressed('dash', .12) && S.dashCD <= 0 && S.dashT <= 0) {
      ctl.use('dash'); const a = ml > .1 ? Math.atan2(md[1], md[0]) : h.facing;
      Object.assign(S, { dashDir: a, dashT: .2, dashCD: .45 }); h.facing = a; S.inv = Math.max(S.inv, .24); S.combo.cancel(); S.thrust.cancel();
      P.dust(h.x, h.y, h.z, 6, { speed: 40 }); P.ring(h.x, h.y, 3, 14, '#bff6ff', .25, h.z); h.rig.kick(-3); A.sfx('whoosh');
    }
    if (free && h.grounded && ctl.pressed('jump', .12)) { ctl.use('jump'); h.jump(JUMP); P.dust(h.x, h.y, h.z, 5, { speed: 30 }); h.rig.kick(-2); A.sfx('jump'); }
    if (free && ctl.pressed('attack', .18)) {   // out of a dash it is the thrust (keeping the dash's direction), otherwise the combo's next hit
      const dashing = S.dashT > 0;
      if (dashing ? S.thrust.start() : (!S.thrust.busy && S.combo.press())) { ctl.use('attack'); S.dashT = 0; if (!dashing && S.aim !== undefined) h.facing = S.aim; A.sfx('swing'); }
    }
    const At = S.thrust.busy ? S.thrust : S.combo;
    if (S.dashT > 0) { S.dashT -= dt; const u = 1 - S.dashT / .2, sp = 260 * (1 - .5 * u * u); h.vx = Math.cos(S.dashDir) * sp; h.vy = Math.sin(S.dashDir) * sp; }
    else { const slow = At.busy ? .25 : 1, acc = (h.grounded ? 900 : 420) * dt; h.vx = approach(h.vx, md[0] * SPEED * slow, acc); h.vy = approach(h.vy, md[1] * SPEED * slow, acc); }
    const began = At.update(dt), st = At.state, hit = st && HIT[st.spec.name];
    if (began === 'active') { h.vx += Math.cos(h.facing) * hit.push; h.vy += Math.sin(h.facing) * hit.push; }
    if (hit) {
      At.hits(enemies, e => e.alive && e.spawnT <= 0 && Math.abs(e.z - h.z) < 24 && E.inArc(h, h.facing, e, hit.range + (e === boss ? 6 : 0), hit.half), e => hurt(e, hit.dmg, Math.atan2(e.y - h.y, e.x - h.x), hit.kb, hit.big));
      At.hits(world.props, p => Math.abs(p.z - h.z - 8) < 22 && E.inArc(h, h.facing, p, hit.range + 4, hit.half), p => smash(p, hit.big ? 110 : 75, hit.big ? 60 : 40));
    }
    if (free && ctl.pressed('skill', .15) && S.boltCD <= 0) {   // an ember bolt where he aims
      ctl.use('skill'); const a = S.aim !== undefined ? S.aim : h.facing; h.facing = a; S.boltCD = .3; S.castT = .18; A.sfx('shoot');
      shots.push({ x: h.x + Math.cos(a) * 8, y: h.y + Math.sin(a) * 8, z: h.z + 11, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, vz: 0, life: 1.2, from: 'hero', dmg: 9, color: '#ffb347', core: '#fff3c4' });
    }
    if (S.cheer > 0) S.cheer -= dt;
    if (!free) h.facing = E.approachAng(h.facing, Math.atan2(ctl.cam[1], ctl.cam[0]), dt * 8);   // (cheering: he turns to the camera)
    else if (!At.busy && S.hurtT > 0) h.facing = E.approachAng(h.facing, S.hitA, dt * 30);
    else if (!At.busy && S.dashT <= 0 && S.aim !== undefined) h.facing = E.approachAng(h.facing, S.aim, dt * 16);
    h.anim = { dash: S.dashT > 0, hurt: S.hurtT > 0 && !At.busy, attack: At.state, pose: S.cheer > .3 ? 'cheer' : S.castT > 0 ? 'cast' : null, expr: S.hurtT > 0 ? 'wince' : S.cheer > .3 ? 'shout' : null };
  }
  function hurtHero(dmg, ang) {
    const h = hero, S = H; if (S.inv > 0 || S.dead) return false;
    S.inv = .8; S.hurtT = .22; h.flash = .05; S.hitA = ang + Math.PI; h.push(Math.cos(ang) * 170, Math.sin(ang) * 170);
    game.freeze(.05); game.shake(3); P.sparks(h.x, h.y, h.z + 12, 6, ang + Math.PI); A.sfx('hurt');
    S.hp -= dmg; S.combo.cancel(); S.thrust.cancel(); P.text(h.x, h.y, h.z + 30, '-' + dmg, '#ff7a6a');
    if (S.hp <= 0) { S.hp = 0; S.dead = true; S.deadT = 0; P.bits(h.x, h.y, h.z + 8, 20, ['#2f8f86', '#c8452f', '#f1c7a0']); }
    return true;
  }
  /** a crate or barrel struck: knocked away, and broken at its second blow (a heart inside, now and then) */
  function smash(p, dv, up) {
    world.knock(p, hero.x, hero.y, dv, up); A.sfx('bump');
    if (++p.data.hits < 2) return;
    P.bits(p.x, p.y, p.z, 14, BITS[p.kind] || BITS.crate); P.dust(p.x, p.y, p.z - 4, 6, { speed: 40 }); world.remove(p); A.sfx('explode');
    if (rnd() < .35) world.thing('heart', p.x, p.y, undefined, { spin: .5, bob: 2 });
  }

  /* ---- THE MONSTERS ---- */
  function hurt(e, dmg, ang, kb, big) {
    e.hp -= dmg; e.flash = big ? .04 : .07; e.stun = .22; e.push(Math.cos(ang) * kb, Math.sin(ang) * kb, big ? 70 : 0);
    if (e.rig) { e.atk = null; e.rig.kick(2.5); } else if (e.type === 'slime') { e.blob.kick(5); e.state = 'idle'; e.t = .5; } else e.charge = 0;
    game.freeze(big ? .06 : .045); game.shake(big ? 3 : 2); A.sfx(big ? 'kick' : 'hit');
    P.sparks(lerp(hero.x, e.x, .6), lerp(hero.y, e.y, .6), e.z + (e.type === 'wisp' ? 0 : 10), 7, ang);
    P.text(e.x, e.y, e.z + e.head + 4, dmg, big ? '#ffd36a' : '#fff2c4');
    if (e.hp > 0) return;
    e.alive = false; e.deadT = 0; kills++; score += e.k ? e.k.score : e.score; enemies.splice(enemies.indexOf(e), 1); corpses.push(e);
    if (e.rig) { P.bits(e.x, e.y, e.z + 8, 6, [e.rig.C.skin || e.rig.C.bone, e.rig.C.cloth, e.rig.C.boot || e.rig.C.cloth]); e.trail = null; }
    else { P.bits(e.x, e.y, e.z + 6, 12, BITS[e.type]); P.ring(e.x, e.y, 3, 22, BITS[e.type][1], .3, e.z); }
    if (e.type === 'wisp') { P.glints(e.x, e.y, e.z, 10, '#e3c8ff'); e.orb.swell = 1; world.remove(e); return; }
    e.push(e.vx * .3, e.vy * .3, big ? 170 : 95); e.setSolid(false);   // the fallen fly with the blow, then slide; they stop blocking the crowd
    if (e === boss) { game.flash('#fff4d0', .3, .6); game.freeze(.25); P.glints(e.x, e.y, e.z + 20, 24, '#ffd36a', 30); }
    if (rnd() < .08) world.thing('heart', e.x, e.y, undefined, { spin: .5, bob: 2 });
  }
  const _dir = [0, 0];
  function steer(e, out) {   // toward the hero: straight when near and level, else down the flow field
    const dx = hero.x - e.x, dy = hero.y - e.y, d = Math.hypot(dx, dy) || 1;
    if (d < 70 && Math.abs(hero.z - e.z) < 8) { out[0] = dx / d; out[1] = dy / d; return out; }
    if (flow.dir(e.x, e.y, out)) return out;
    out[0] = dx / d; out[1] = dy / d; return out;
  }
  function walker(e, dt, cam) {
    const h = hero, k = e.k, dx = h.x - e.x, dy = h.y - e.y, d = Math.hypot(dx, dy) || 1, toH = Math.atan2(dy, dx), At = e.atk, level = Math.abs(h.z - e.z) < 14;
    const stand = Math.max(k.stand[e.next], e.r + HERO_R + 5); let mx = 0, my = 0;
    e.cool -= dt;
    if (e.stun <= 0 && e.grounded) {
      if (At) {
        if (At.phase === 'wind') { e.facing = E.approachAng(e.facing, toH, dt * 2.5); if (Math.abs(d - stand) > 1) { const s = Math.sign(d - stand); mx = dx / d * s; my = dy / d * s; } }
        if (At.update(dt) === 'active' && d > stand) { const v = Math.min(70, Math.sqrt(1000 * (d - stand))); e.vx += Math.cos(e.facing) * v; e.vy += Math.sin(e.facing) * v; }
        At.hits([h], t => level && E.inArc(e, e.facing, t, stand - HERO_R + 1, 1.1), () => hurtHero(k.dmg, toH) && P.impact(...strikePt(e.rig, At.spec), 6, '#ffb08a'));
        if (!At.busy) { e.atk = null; e.cool = .8 + rnd(); e.next = (rnd() * k.specs.length) | 0; }
      } else if (!H.dead && level) {
        // wait in a ring outside contact distance (further back, and longer, on the camera's side of the hero), swaying
        const front = Math.max(0, -(dx * cam[0] + dy * cam[1]) / d) * cam[2], ring = stand + 10 + 20 * front, sway = Math.sin(world.time * .9 + e.ph);
        if (d > ring + 3) { steer(e, _dir); mx = _dir[0]; my = _dir[1]; } else if (d < ring - 3) { mx = -dx / d * .5; my = -dy / d * .5; } else { mx = -dy / d * .4 * sway; my = dx / d * .4 * sway; }
        e.facing = E.approachAng(e.facing, d > ring + 3 ? Math.atan2(my, mx) : toH + sway * .25, dt * 5);
        if (d < ring + 6 && e.cool <= -2 * front && takeTurn()) { e.atk = new E.Attack(k.specs[e.next]); e.atk.start(); }
      } else { steer(e, _dir); mx = _dir[0]; my = _dir[1]; if (mx || my) e.facing = E.approachAng(e.facing, Math.atan2(my, mx), dt * 5); }
    }
    if (e.grounded) { const acc = (e.stun > 0 ? 160 : 500) * dt; e.vx = approach(e.vx, mx * e.speed, acc); e.vy = approach(e.vy, my * e.speed, acc); }
    else if (e.atk) e.atk = null;   // (thrown into the air: the swing is lost)
    const pommel = !!(e.atk && e.atk.spec.blade === 0 && e.rig.o.weapon);
    e.trail = e.atk && e.atk.busy ? '#ff7a5a' : null;
    e.anim = { hurt: e.stun > 0, attack: e.atk && e.atk.state, stance: k.stance, point: pommel, aim: 1.2, expr: e.stun > 0 ? 'wince' : e.atk ? 'angry' : null };
  }
  const HOP = { vz: 150, air: 2 * 150 / 480 }, POUNCE = { vz: 85, air: 2 * 85 / 480 }, SLIME_RING = 34;
  function slime(e, dt) {
    const h = hero, dx = h.x - e.x, dy = h.y - e.y, d = Math.hypot(dx, dy) || 1, level = Math.abs(h.z - e.z) < 14;
    if (e.state === 'air' || e.state === 'pounce') {
      e.airT += dt;
      if (!(e.airT > .1 && e.grounded)) {
        if (e.state === 'pounce' && !H.dead && e.z < h.z + 12 && d < e.r + HERO_R + 1) { hurtHero(6, Math.atan2(dy, dx)); e.state = 'air'; e.vx *= -.7; e.vy *= -.7; e.vz = Math.max(e.vz, 90); }
      } else { const rest = e.state === 'pounce' ? 1.1 : .45; e.state = 'idle'; e.t = rest + rnd() * .6; e.blob.kick(-5); }
    } else {
      e.vx = approach(e.vx, 0, 400 * dt); e.vy = approach(e.vy, 0, 400 * dt);
      if (e.stun <= 0) {
        e.t -= dt;
        if (e.state === 'wind') { e.blob.kick((rnd() - .5) * 3); e.facing = Math.atan2(dy, dx); }
        if (e.state === 'idle' && e.t <= 0) { const turn = level && Math.abs(d - SLIME_RING) < 8 && takeTurn(); e.state = turn ? 'wind' : 'crouch'; e.t = turn ? .5 : .28; e.facing = Math.atan2(dy, dx); }
        else if ((e.state === 'crouch' || e.state === 'wind') && e.t <= 0) {
          const pounce = e.state === 'wind', jump = pounce ? POUNCE : HOP, out = level && !pounce && d < SLIME_RING;
          const dir = pounce ? [dx, dy] : out ? [-dx, -dy] : steer(e, _dir).slice();
          const l = Math.hypot(dir[0], dir[1]) || 1, len = pounce ? d - e.r - HERO_R + 3 : level ? Math.min(Math.abs(d - SLIME_RING), 44) : 44;
          if (len < 4) { e.state = 'idle'; e.t = .3; }
          else { e.state = pounce ? 'pounce' : 'air'; e.airT = 0; e.vz = jump.vz; e.vx = dir[0] / l * len / jump.air; e.vy = dir[1] / l * len / jump.air; e.blob.kick(pounce ? 6 : 4.5); }
        }
      }
    }
    e.flap = approach(e.flap, e.state === 'air' || e.state === 'pounce' ? 1 : 0, dt * 5);
    const low = e.state === 'crouch' || e.state === 'wind';
    e.anim = { squash: e.state === 'wind' ? -.42 : low ? -.32 : !e.grounded ? clamp(e.vz / 600, -.2, .28) : 0, look: [dx, dy], squint: low, flap: e.flap };
  }
  function wisp(e, dt) {
    const h = hero, dx = h.x - e.x, dy = h.y - e.y, d = Math.hypot(dx, dy) || 1; e.t += dt;
    let ax = 0, ay = 0;
    if (e.stun <= 0) { const want = d > 100 ? 1 : d < 70 ? -1 : 0; ax = dx / d * want * 60 + (-dy / d) * e.orbit * 34; ay = dy / d * want * 60 + (dx / d) * e.orbit * 34; }
    const hover = world.floorAt(e.x, e.y, e.z) + 20 + Math.sin(e.t * 2) * 3;   // over whatever is below: the floor, the dais
    e.vx += (ax - e.vx * 1.6) * dt; e.vy += (ay - e.vy * 1.6) * dt; e.vz = (hover - e.z) * 6;
    e.orb.swell = e.charge > 0 ? 1 + (1 - e.charge / .6) * .8 : 1;
    if (!H.dead && e.stun <= 0 && d < 160) {
      if (e.charge > 0) {
        if ((e.charge -= dt) <= 0) {   // a bolt at the hero's chest, wherever he stands
          const tz = h.z + 14, dz = tz - e.z, L = Math.hypot(dx, dy, dz) || 1;
          shots.push({ x: e.x, y: e.y, z: e.z, vx: dx / L * 95, vy: dy / L * 95, vz: dz / L * 95, life: 3, from: 'enemy', dmg: 8, color: '#c78bff', core: '#f4e6ff' }); e.fire = 2.5 + rnd() * 2;
        }
      } else if ((e.fire -= dt) <= 0) e.charge = .6;
    }
  }
  function shotsStep(dt) {
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i]; s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      let dead = s.life <= 0 || s.z < world.topH(s.x, s.y);
      if (!dead) for (const p of world.props) if (Math.abs(p.x - s.x) < 9 && Math.abs(p.y - s.y) < 9 && Math.abs(p.z - s.z) < 9) { world.knock(p, s.x - s.vx, s.y - s.vy, 40, 15); dead = true; break; }
      if (!dead && s.from === 'hero') {
        for (const e of enemies) if (e.spawnT <= 0 && (e.type === 'wisp' ? Math.hypot(e.x - s.x, e.y - s.y, e.z - s.z) < e.r + 5 : Math.hypot(e.x - s.x, e.y - s.y) < e.r + 3 && s.z > e.z - 2 && s.z < e.z + e.head + 4)) { hurt(e, s.dmg, Math.atan2(s.vy, s.vx), 70, false); dead = true; break; }
      } else if (!dead && s.from === 'enemy' && Math.hypot(hero.x - s.x, hero.y - s.y) < HERO_R + 3 && s.z > hero.z - 2 && s.z < hero.z + 30) { hurtHero(s.dmg, Math.atan2(s.vy, s.vx)); dead = true; }
      if (dead) { P.ring(s.x, s.y, 1, 9, s.color, .2, Math.max(world.floorAt(s.x, s.y, s.z), s.z - 6)); shots.splice(i, 1); }
    }
  }

  /* ---- ONE STEP: the rules, then the world ---- */
  function step(dt, ctl) {
    flow.to(hero.x, hero.y);
    heroStep(dt, ctl);
    tokens = 0; for (const e of enemies) if (e.atk || e.state === 'wind' || e.state === 'pounce') tokens++;
    for (const e of enemies) {
      e.flash -= dt; e.stun -= dt;
      if (e.spawnT > 0) { e.spawnT -= dt; const u = clamp(1 - e.spawnT / .6, 0, 1); e.fade = Math.max(.05, u); e.sink = (1 - u) * 34; e.vx = e.vy = 0; continue; }
      e.fade = 1; e.sink = 0;
      if (e.type === 'walker') walker(e, dt, ctl.cam); else if (e.type === 'slime') slime(e, dt); else wisp(e, dt);
    }
    for (let i = corpses.length - 1; i >= 0; i--) {   // the fallen slide to a stop, then sink away
      const e = corpses[i]; e.deadT += dt; e.flash -= dt;
      if (e.deadT > 1.6) { world.remove(e); corpses.splice(i, 1); continue; }
      e.fade = clamp((1.6 - e.deadT) * 2, 0, 1); e.sink = (1 - e.fade) * 34;
      if (e.grounded) { const k = 300 * dt; e.vx = approach(e.vx, 0, k); e.vy = approach(e.vy, 0, k); }
      e.anim = e.rig ? { pose: 'die' } : { squash: -.42, squint: true, flap: 0 };
    }
    shotsStep(dt);
    for (const t of world.touching(hero, 'heart')) { world.remove(t); H.hp = Math.min(H.max, H.hp + 20); P.glints(t.x, t.y, t.z + 6, 8, '#ff9aa8'); A.sfx('heal'); }
    for (const e of enemies) if (e.fell) e.place(...world.randomFloor(rnd, 60, hero.x, hero.y));   // (thrown off the world: back on the floor)
    // a wave cleared: the hero cheers and the next marches in; the last one ends it
    if (!enemies.length && !H.dead && H.cheer <= 0 && !ended && corpses.every(c => c.deadT > .8)) {
      if (wave >= WAVES.length) { ended = 1; H.cheer = 2; game.after(2.4, () => game.go('over', { from: 'action', world, won: true, title: 'HALL CLEARED', lines: ['ALL ' + WAVES.length + ' WAVES   ' + kills + ' DEFEATED', 'SCORE ' + score] })); A.music('victory'); }
      else { H.cheer = 1.6; P.glints(hero.x, hero.y, hero.z + 26, 14, '#ffd36a'); game.after(1.6, () => nextWave()); }
    }
    if (H.dead && H.deadT > 1.6 && !ended) { ended = 1; game.go('over', { from: 'action', world, lines: ['WAVE ' + wave + ' OF ' + WAVES.length + '   ' + kills + ' DEFEATED', 'SCORE ' + score] }); }
    world.step(dt);
  }

  /* ---- THE HUD: health, the wave, the score; the knight's bar; the controls for a few seconds ---- */
  function hud(g, r) {
    const x = 6, y = 6, top = 0;
    E.font.text(g, 'HP', x, y + top + 1, '#ffd6d6', { outline: '#0b0814' });
    E.ui.bar(g, x + 14, y + top, 72, 7, H.hp / H.max, H.hp > 30 ? '#e0463c' : '#ff7a3a');
    E.font.text(g, 'WAVE ' + wave + '/' + WAVES.length + '   SCORE ' + score, x, y + top + 11, '#f0e6ff', { outline: '#0b0814' });
    if (boss && boss.alive) { const w = Math.min(180, r.W - 40); E.font.text(g, 'THE KNIGHT', r.W / 2, r.H - 26, '#ffd36a', { align: 'center', outline: '#0b0814' }); E.ui.bar(g, r.W / 2 - w / 2, r.H - 16, w, 8, boss.hp / boss.max, '#c8452f'); }
    if (hint > 0 && !touch()) E.font.text(g, prompt('attack', 'combo') + '   ' + prompt('dash', 'dash') + '   ' + prompt('jump', 'jump') + '   ' + prompt('skill', 'bolt') + '   C camera', r.W / 2, r.H - 40, '#e8e0ff', { align: 'center', outline: '#0b0814', font: 'tiny' });
  }

  /* ---- the controls this step, from the camera ---- */
  const ctl = { move: [0, 0], aim: null, cam: [0, 1, .5], pressed: (a, w) => game.input.buffered(a, w), use: a => game.input.consume(a) };
  function controls() {
    world.camera.ground(game.input.move(), ctl.move); ctl.aim = world.camera.aim(hero);
    const a = world.camera.heading; ctl.cam[0] = -Math.cos(a); ctl.cam[1] = -Math.sin(a); ctl.cam[2] = Math.cos((world.camera.pose || { pitch: -.6 }).pitch);
    return ctl;
  }
  /** the proof: a fixed fight (twelve mixed monsters), the hero walking a square, swinging, dashing, jumping and throwing
   *  on a timetable; n steps of 1/120 s. Returns the world's hash (the same on WebGPU, WebGL 2 and run again) */
  function run(n = 600) {
    reset(7); for (const t of ['husk', 'husk', 'skeleton', 'skeleton', 'slime', 'slime', 'slime', 'wisp', 'wisp', 'husk', 'skeleton', 'slime']) spawn(t).spawnT = 0;
    const s = world.marks.hero[0], PATH = [[s.x + 90, s.y - 30], [s.x + 90, s.y - 140], [s.x - 110, s.y - 140], [s.x - 110, s.y - 30]];
    let i = 0; const c = { move: [0, 0], aim: null, cam: [0, 1, .5], use() {}, pressed: a => (a === 'attack' && i % 48 === 24) || (a === 'dash' && i % 300 === 150) || (a === 'jump' && i % 400 === 260) || (a === 'skill' && i % 180 === 80) };
    for (i = 0; i < n; i++) { const [tx, ty] = PATH[Math.floor(i / 240) % 4], dx = tx - hero.x, dy = ty - hero.y, d = Math.hypot(dx, dy); c.move = d > 6 ? [dx / d, dy / d] : [0, 0]; step(1 / 120, c); }
    return world.hash([H.hp, kills, wave]);
  }

  return {
    view: 'iso', views: ['iso', 'threequarter', 'topdown', 'brawler'], input: W3.INPUT, pausable: true, touch: ['attack', 'dash', 'jump', 'skill'], camera: { zoom: [.6, 2], tall: 1.6 },
    enter() { reset(1); active = world; A.music('dungeon'); world.camera.set('view'); },
    update(dt) { cameraKey(world); hint -= dt; step(dt, controls()); },
    draw(r) {
      // telegraphs on the floor, bolts, the hero's lamp
      for (const e of enemies) {
        if (e.type === 'walker' && e.atk && e.atk.busy && e.atk.phase === 'wind') { const u = e.atk.u, r0 = e.r * .6; world.arc(e.x, e.y, e.z, r0, r0 + (e.k.reach[e.next] * (e.k.rig.size || 1) - r0) * u, e.facing - .8, e.facing + .8, '#ff4a3a', .25 + .45 * u); }
        else if (e.type === 'slime' && e.state === 'wind') { const u = clamp(1 - e.t / .5, 0, 1), reach = Math.hypot(hero.x - e.x, hero.y - e.y) - HERO_R, r0 = e.r * .6, a = Math.atan2(hero.y - e.y, hero.x - e.x); world.arc(e.x, e.y, e.z, r0, r0 + (reach - r0) * u, a - .8, a + .8, '#ff4a3a', .25 + .45 * u); }
      }
      for (const s of shots) world.glow(s.x, s.y, s.z, 3, s.color, { core: s.core, light: true });
      Object.assign(lamp, { x: hero.x, y: hero.y, z: hero.z + 40, on: !H.dead });
      world.draw(r);
      r.overlay(g => hud(g, r));
    },
    get world() { return world; }, get hero() { return hero; }, get state() { return H; }, get enemies() { return enemies; }, reset, run, spawn
  };
})();
scenes.action = ACTION;
