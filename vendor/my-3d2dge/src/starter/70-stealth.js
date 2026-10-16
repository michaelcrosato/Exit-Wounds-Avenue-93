/* =====================================================================================
 * SLICE 7  STEALTH  (Assassin's Creed, Metal Gear, Tenchu). A rooftop district at dusk: steal the ledger from the brick
 * roof and slip out by the east gate. Three guards (one on a roof) patrol with sight cones; what they see makes them
 * notice (?), search the last place they saw you, and at last chase (!) across the roofs. Hide in tall grass while
 * crouched, take a guard down silently from behind (J), or from a roof above (J as you stand over them). In a fight their
 * swings are telegraphed: K just before the blow parries and stuns them.
 * Keys (E.Input.THIRDPERSON): WASD move, Shift sprint, Space jump, climb a wall, vault, leap a gap, C crouch, J attack or
 * take down, K block or parry, L dodge roll, V view. The ledger is a checkpoint.
 * HOW IT WORKS: the hero and the guards are E.Mover bodies (the same climbing, vaulting and gap-leaping for both); a
 * guard's eyes are E.sees through the map's heights, its mind an E.Suspicion, its legs a FlowField that climbs, drops and
 * jumps. Climbs, vaults, rolls and takedowns are E.ACTIONS; the facades are wall-type options; the belfry's canopy sorts by
 * its footprint; r.sightCone and r.marker draw the cones and the objective.
 * ===================================================================================== */
const STEALTH = (() => {
  const T = 16, HP = 3;
  const PAVE = { stones: ['#7a6a60', '#726258', '#806e64'].map(E.hex), mortar: E.hex('#3e3236'), hi: E.hex('#8e7e72'), lo: E.hex('#56484a'), speck: E.hex('#66564e') };   // warm cobbles against the cool stone walls
  /* ---- THE DISTRICT: roofs 24-56 high a jump apart (3-4 cells), a belfry, tall grass (,) and a planter (p) ---- */
  const map = new E.TileMap({ rows: [
    '############################',
    '#.......................,,,#',
    '#.AAAA...BBBBB....CCCC...,,#',
    '#.AAAA...BBBBB....CCCC.....#',
    '#.AAAA...BBBBB....CCCC..TT.#',
    '#.AAAA...BBBBB....CCCC..TT.#',
    '#.........................,#',
    '#..,,,.......p.......,,,..,#',
    '#..,,,...............,,,...#',
    '#.DDDD..EEE....FFFFF.......#',
    '#.DDDD..EEE....FFFFF..GGG..#',
    '#.DDDD..EEE....FFFFF..GGG..#',
    '#.@.......................X#',
    '############################'],
    legend: { '#': 1, A: 2, B: 3, C: 4, D: 5, E: 6, F: 7, G: 8, T: 9, p: 10, ',': { floor: 'grass' }, '@': 'hero', X: 'exit' },
    types: {
      1: { h: 64, top: '#3a3448', side: '#5a5068', face: 'stone', roof: 'plain', cut: true, cutH: 6 },   // the city wall drops low on the camera's side
      2: { h: 40, top: '#8a4a3a', side: '#c8b89a', face: 'plaster', roof: 'tiles', windows: { lit: .3 }, shutters: '#2a5a8a', door: { chance: .4 } },
      3: { h: 48, top: '#5a4a3a', side: '#9a6a4a', face: 'brick', roof: 'slab', windows: { lit: .2 }, balcony: { z: 30, color: '#3a2a1e' } },
      4: { h: 40, top: '#4a6a3a', side: '#b8a888', face: 'timber', roof: 'tiles', arch: { chance: .5 }, windows: true },
      5: { h: 24, top: '#7a4a32', side: '#d0c0a0', face: 'plaster', roof: 'tiles', door: { chance: .5, color: '#5a2a1a' }, windows: { from: 12, lit: .4 } },
      6: { h: 48, top: '#6a5a6a', side: '#7a7a8a', face: 'stone', roof: 'plain', windows: { w: 4, h: 12, lit: .15 } },
      7: { h: 40, top: '#8a5a3a', side: '#c8a888', face: 'plaster', roof: 'tiles', windows: true, shutters: '#6a3a2a', balcony: { z: 24 } },
      8: { h: 24, top: '#4a6a3a', side: '#a89878', face: 'timber', roof: 'tiles', arch: { chance: .6 } },
      9: { h: 72, top: '#7a6a5a', side: '#a89878', face: 'sandstone', roof: 'plain', windows: { w: 3, h: 10, step: 22, lit: .5 } },   // the belfry: face, a MATERIAL (docs/ASSETS.md)
      10: { h: 10, top: '#3e7a3a', side: '#5a4a32', face: 'plank', roof: 'leaves' } },
    floorTex: (x, y, tag) => tag === 'grass' ? E.tex.grass(x, y, { base: '#3e6a32', dark: '#2a5226', light: '#5a8a42' }) : E.tex.flagstone(x, y, PAVE)
  });
  const LEDGER = { x: 11.5 * T, y: 3.5 * T, z: 48 }, EXIT = map.find('exit'), GRASS = [];
  // set dressing: SHAPES (E.SHAPES, docs/ASSETS.md: objects as data, right in every view) along the north street, out of the patrols' way
  const DRESS = [['barrel', 1.5 * T, 1.4 * T, { facing: .4 }], ['barrel', 2.5 * T, 1.3 * T, { facing: 2 }], ['crate', 7.4 * T, 1.4 * T, { scale: .8, facing: .2 }],
    ['cart', 15.5 * T, 1.5 * T, { facing: 0 }], ['sack', 16.9 * T, 1.3 * T, { facing: 1 }], ['barrel', 22.6 * T, 1.4 * T, { facing: 3 }],
    // stacked planks from the asset store, cut into the page's 'stealth' set (src/assets/sets/stealth.js; none without it)
    ...(E.addAssets((window.ASSETS || {}).stealth || { set: 'stealth' }).shapes.length ? [['stealth:resource-planks', 12.2 * T, 1.4 * T, { scale: .7, facing: Math.PI / 2 + .1 }]] : [])];
  for (let cy = 0; cy < map.h; cy++) for (let cx = 0; cx < map.w; cx++) if (map.floorAt((cx + .5) * T, (cy + .5) * T) === 'grass') GRASS.push([(cx + .5) * T, (cy + .5) * T]);
  const BOOK = E.sprite(['.bbbb.', 'bBBBBb', 'bBwwBb', 'bBBBBb', '.bbbb.'], { b: '#3a2010', B: '#8a3a20', w: '#f0e0b0' });
  const STAR = E.sprite(['..y..', '.yYy.', 'yYYYy', '.yYy.', '..y..'], { y: '#e8a830', Y: '#fff0a0' });
  const ROUTES = [   // [start, ...patrol points] in cells, and the guard's roof height
    [[19.5, 3.5, 40], [21.5, 3.5, 40], [21.5, 5.5, 40], [18.5, 5.5, 40]],
    [[6.5, 6.5, 0], [20.5, 6.5, 0], [20.5, 8.5, 0], [6.5, 8.5, 0]],
    [[11.5, 12.2, 0], [20.5, 12.2, 0], [20.5, 8.2, 0], [11.5, 8.2, 0]]
  ];
  let hero, rig, guards, attack, msg, msgT, checkpoint, ledger, won, over, hp, hurtT, alertT;
  const say = (m, t = 2.5) => { msg = m; msgT = t; };
  const inGrass = b => b.z < 2 && map.floorAt(b.x, b.y) === 'grass';

  /* ---- GUARDS: a Mover with patrol points, eyes, a mind and a flow field that climbs, drops and jumps ---- */
  function makeGuard(route, i) {
    const [x, y, z] = route[0];
    const g = new E.Mover({ x: x * T, y: y * T, z, r: 5, run: 70, walk: 30, climbMax: 56, hopMax: 56 });
    Object.assign(g, { i, route: route.map(p => [p[0] * T, p[1] * T]), at: 1, mind: new E.Suspicion({ rise: 1.6, decay: .25, forget: 7 }), hp: 2, stun: 0, dead: false,
      flow: new E.FlowField(map, { climb: 56, drop: 56, jump: 60 }), wait: 0, hit: null, swing: new E.Attack('overhead', { wind: .38, recover: .3, reach: 9 }), bark: 0,
      rig: new E.Humanoid({ size: 1.2, build: 'heroic', hat: 'helmet', armor: true, weapon: 'sword', colors: { cloth: ['#8a3a32', '#6a3a5a', '#7a4a2a'][i], metal: '#c8c8d8' } }) });
    return g;
  }
  function guardUpdate(g, dt) {
    if (g.dead) return;   // (a takedown moves the body it takes: the hero's action plays it)
    if (g.stun > 0) { g.stun -= dt; g.update(dt, map, { move: [0, 0] }); return; }
    const seen = hero && !over ? E.sees(g, hero, { map, range: 110, fov: 1.5 }) : { seen: false, exposure: 0 }, st = g.mind.update(dt, seen, hero);
    if (g.mind.changed && st === 'alert') { A.sfx('select'); g.bark = 1.2; }
    let goal = null, speed = 'walk';
    if (st === 'alert') { goal = hero; speed = 'run'; }
    else if (st === 'search' && g.mind.last) goal = g.mind.last;
    else if (st === 'notice') { g.facing = E.approachAng(g.facing, Math.atan2(g.mind.last.y - g.y, g.mind.last.x - g.x), dt * 3); g.update(dt, map, { move: [0, 0] }); return; }
    else { const p = g.route[g.at]; goal = { x: p[0], y: p[1], z: 0 }; if (Math.hypot(p[0] - g.x, p[1] - g.y) < 8) { g.at = (g.at + 1) % g.route.length; g.wait = .8; } }
    if (g.wait > 0 && st === 'calm') { g.wait -= dt; g.update(dt, map, { move: [0, 0] }); return; }
    // in reach of the hero: a telegraphed swing (a long wind-up), else walk the field toward the goal
    const d = Math.hypot(hero.x - g.x, hero.y - g.y), near = st === 'alert' && d < 20 && E.sameLevel(g, hero, 10);
    if (near && !g.swing.busy && !hero.action) { g.facing = Math.atan2(hero.y - g.y, hero.x - g.x); g.swing.start(); A.sfx('swing', { vol: .5 }); }
    const began = g.swing.update(dt);
    if (g.swing.busy) { g.update(dt, map, { move: [0, 0] }); if (g.swing.active && began === 'active') strikeHero(g); return; }
    let move = [0, 0], jump = false;
    if (goal) {
      g.flow.update(goal.x, goal.y);
      const nx = g.flow.next(g.x, g.y), tx = nx ? nx.x : goal.x, ty = nx ? nx.y : goal.y, l = Math.hypot(tx - g.x, ty - g.y) || 1;
      if (Math.hypot(goal.x - g.x, goal.y - g.y) > 6) move = [(tx - g.x) / l, (ty - g.y) / l];
      if (nx && g.onGround && (nx.kind === 'climb' || nx.kind === 'jump') && nx.edge < g.r + 4) { jump = true; g.facing = Math.atan2(ty - g.y, tx - g.x); }
    }
    if (speed === 'walk') move = move.map(v => v * .5);
    g.update(dt, map, { move, sprint: false, jumpPressed: jump });
  }
  function strikeHero(g) {
    if (!E.inArc(g, g.facing, hero, 20, 1.2, 10) || (hero.action && hero.action.invulnerable)) return;
    if (game.input.down('block') && !hero.action) { A.sfx('hit', { vol: .4 }); P.sparks(hero.x, hero.y, hero.z + 16, 6, g.facing + Math.PI); return; }
    hp--; hurtT = .4; game.hitFx(hero.x, hero.y, hero.z + 16, { power: 1, angle: g.facing, sound: 'hurt' }); E.knockback(g, hero, 140);
    if (hp <= 0) lose();
  }

  /* ---- THE HERO: a Mover, a hidden blade, a parry, two takedowns ---- */
  function start() {
    const s = map.find('hero');
    hero = new E.Mover({ x: s.x, y: s.y, r: 5 }); hero.facing = 0;
    rig = rig || new E.Humanoid({ size: 1.2, build: 'heroic', hood: true, weapon: 'sword', bladeLen: 7, outfit: 'coat', sleeves: 'long', cape: { len: 6, width: 5, seg: 2.4 }, colors: { cloth: '#d8d2c4', coat: '#d8d2c4', cape: '#8a2a2a', capeIn: '#5a1a1a', pants: '#3a3448', metal: '#e8e8f0' } });
    attack = new E.Attack('slash', { reach: 9 }); guards = ROUTES.map(makeGuard);
    checkpoint = null; ledger = false; won = false; over = false; hp = HP; hurtT = 0; alertT = 0; say('STEAL THE LEDGER FROM THE BRICK ROOF', 3.5);
    game.follow(hero, { z: 18 }); game.cam.bounds = v => map.bounds(v); game.cam.offset = [0, -10]; L.enabled = false; A.music('dungeon');
  }
  function respawnAt(cp) {
    Object.assign(hero, { x: cp.x, y: cp.y, z: cp.z, vx: 0, vy: 0, vz: 0, onGround: true, action: null }); hp = HP;
    guards.forEach((g, i) => { if (!g.dead) { const [x, y, z] = ROUTES[i][0]; Object.assign(g, { x: x * T, y: y * T, z, vx: 0, vy: 0, vz: 0, at: 1, stun: 0, action: null }); g.mind.reset(); g.swing.cancel(); } });
    game.cam.snap = true; say('BACK AT THE CHECKPOINT');
  }
  function lose() { if (checkpoint) { A.sfx('die'); respawnAt(checkpoint); } else { over = true; game.after(.8, () => game.go('over', { from: 'stealth' })); } }
  // a takedown within reach: [guard, from above] or null
  function takedown() {
    for (const g of guards) {
      if (g.dead || g.action) continue;
      const dz = hero.z - g.z, d = Math.hypot(g.x - hero.x, g.y - hero.y);
      // from above: the hero stands over a guard below, close enough to drop onto them
      if (dz > 14 && d < 44 && hero.onGround) return [g, true];
      // from behind: close, on the same level, outside the guard's view and not yet hunting
      const behind = Math.abs(E.angDiff(g.facing, Math.atan2(g.y - hero.y, g.x - hero.x))) < 1.1;
      if (E.sameLevel(hero, g) && d < 18 && behind && g.mind.state !== 'alert') return [g, false];
    }
    return null;
  }
  function tryTakedown() { const t = takedown(); if (!t) return false; hero.play('takedown', { other: t[0], aerial: t[1], map }); return finishGuard(t[0], hero.action); }
  const parrying = () => guards.some(g => !g.dead && g.swing.phase === 'wind' && g.swing.u > .35 && Math.hypot(g.x - hero.x, g.y - hero.y) < 26);
  function finishGuard(g, act) { g.dead = true; g.action = act; A.sfx('punch'); game.freeze(.06); return true; }
  function heroUpdate(dt) {
    const I = game.input;
    hero.exposure = inGrass(hero) && hero.crouch ? 0 : 1;   // crouched in tall grass: unseen
    if (!hero.action) {
      if (I.pressed('dodge') && hero.dodge(undefined, 34)) A.sfx('whoosh');
      else if (I.pressed('attack') && !tryTakedown() && attack.start()) { I.consume('attack'); A.sfx('swing'); }
    }
    attack.update(dt);
    attack.hits(guards.filter(g => !g.dead), g => E.inArc(hero, hero.facing, g, 20, 1.3, 10), g => {
      game.hitFx(g.x, g.y, g.z + 16, { power: g.stun > 0 ? 2 : 1, angle: hero.facing }); E.knockback(hero, g, 90);
      if (g.stun > 0 || --g.hp <= 0) { g.dead = true; g.action = null; A.sfx('die', { vol: .5 }); } else g.mind.level = 1.2;
    });
    // a parry: block in the last moments of a guard's wind-up
    // CONTEXT touch buttons: ATTACK says TAKE DOWN when one is in reach, BLOCK says PARRY in a guard's wind-up
    I.touchSet('attack', !hero.action && takedown() ? 'TAKE DOWN' : null); I.touchSet('block', parrying() ? 'PARRY' : null);
    if (I.pressed('block')) for (const g of guards) if (!g.dead && g.swing.phase === 'wind' && g.swing.u > .35 && Math.hypot(g.x - hero.x, g.y - hero.y) < 26) {
      g.swing.cancel(); g.stun = 1.3; A.sfx('kick'); game.flash('#ffffff', .08); P.sparks(g.x, g.y, g.z + 18, 10, hero.facing); say('PARRIED', 1);
    }
    hero.update(dt, map, attack.busy ? { move: [0, 0] } : I);
    if (hero.hurt) { hp--; hurtT = .4; game.shake(3); if (hp <= 0) lose(); }
    if (hero.inHazard) hero.respawn();
    if (!ledger && E.dist(hero, LEDGER) < 12) { ledger = true; checkpoint = { x: hero.x, y: hero.y, z: hero.z }; A.sfx('powerup'); say('LEDGER TAKEN: CHECKPOINT. NOW TO THE EAST GATE'); }
    if (ledger && !won && Math.hypot(hero.x - EXIT.x, hero.y - EXIT.y) < 14 && hero.z < 2) { won = true; A.music('victory'); say('MISSION COMPLETE', 99); best('stealth', guards.filter(g => !g.dead).length); }
  }

  function update(dt) {
    if (msgT > 0) msgT -= dt; if (hurtT > 0) hurtT -= dt;
    if (won || over) { if (won && game.input.pressed('start')) game.go('title'); rig.update(dt, hero.rigState({ pose: won ? 'cheer' : null })); return; }
    heroUpdate(dt);
    for (const g of guards) guardUpdate(g, dt);
    const alert = guards.some(g => !g.dead && g.mind.state === 'alert');
    if (alert !== alertT > 0) { alertT = alert ? 1 : 0; A.music(alert ? 'boss' : 'dungeon'); }
    rig.update(dt, hero.rigState({ attack: attack.state, pose: game.input.down('block') && !hero.action ? 'block' : null, hurt: hurtT > 0 }));
    for (const g of guards) {
      if (g.dead) { g.rig.update(dt, g.action && g.action.other === g ? g.action.otherState() : { x: g.x, y: g.y, z: g.z, facing: g.facing, down: 1 }); continue; }
      g.rig.update(dt, g.rigState({ attack: g.swing.state, stance: g.mind.state === 'alert' ? 'ready' : null, hurt: g.stun > 0 }));
      if (g.bark > 0) g.bark -= dt;
    }
  }

  const MOOD = { calm: '#ffe080', notice: '#ffc040', search: '#ff9a40', alert: '#ff4a3a' };
  function draw(r) {
    r.sky(['#141030', '#3a2a5a', '#7a4a5a']);
    map.drawFloor(r); map.queueWalls(r);
    for (const [x, y] of GRASS) r.prop('grass', x, y, 0, { size: 1.3 });
    for (const [id, x, y, o] of DRESS) r.shape(id, x, y, 0, o);
    // the belfry: a canopy wider than the tower, sorted by its whole footprint (over every tower block)
    const bx = 25 * T, by = 5 * T, w = 21, H = 20, z = 72;
    r.queue(bx, by, z, g => { const P2 = (x, y, zz) => r.w(x, y, zz), c = [P2(bx - w, by - w, z), P2(bx + w, by - w, z), P2(bx + w, by + w, z), P2(bx - w, by + w, z)], tip = P2(bx, by, z + H);
      for (let i = 0; i < 4; i++) px.poly(g, [c[i], c[(i + 1) % 4], tip], ['#7a3a2a', '#9a4a32', '#6a2a22', '#8a4232'][i]);
      px.line(g, tip[0], tip[1], tip[0], tip[1] - 6, '#e8c860'); }, { footprint: [bx - w, by - w, bx + w, by + w] });
    for (const g of guards) if (!g.dead) r.sightCone(g, { map, range: 110, fov: 1.5, color: MOOD[g.mind.state], alpha: g.mind.state === 'calm' ? .22 : .38 });
    if (!ledger) r.sprite(LEDGER.x, LEDGER.y, LEDGER.z + 4 + Math.sin(game.time * 3) * 1.5, BOOK, { glow: .6 });
    const shadow = b => r.shadow(b.x, b.y, 6, .35, undefined, map.groundAt(b.x, b.y, b.r, b.z));
    shadow(hero); r.actor(hero.x, hero.y, hero.z, (g, ox, oy) => rig.draw(g, ox, oy, r.view), { xray: { actors: true }, flash: hurtT > 0, alpha: hero.exposure === 0 ? .55 : 1 });
    for (const g of guards) { shadow(g); r.actor(g.x, g.y, g.z, (gg, ox, oy) => g.rig.draw(gg, ox, oy, r.view), { flash: g.stun > 0 && Math.floor(game.time * 10) % 2 === 0 }); }
    r.marker(ledger ? EXIT.x : LEDGER.x, ledger ? EXIT.y : LEDGER.y, ledger ? 0 : LEDGER.z, { label: ledger ? 'EAST GATE' : 'LEDGER', color: ledger ? '#80e0ff' : '#ffd040' });
    r.overlay(g => {
      for (const gd of guards) if (!gd.dead && gd.mind.state !== 'calm') {   // ? and ! over their heads, with the meter
        const [sx, sy] = r.w(gd.x, gd.y, gd.z + 46), a = gd.mind.state === 'alert';
        E.font.text(g, a ? '!' : '?', Math.round(sx), Math.round(sy) - 8, MOOD[gd.mind.state], { align: 'center', shadow: '#000' });
        E.ui.bar(g, Math.round(sx) - 6, Math.round(sy) + 2, 12, 2, Math.min(1, gd.mind.level), MOOD[gd.mind.state]);
      }
      E.ui.box(g, 4, 4, 92, 20, { alpha: .75 }); E.ui.hearts(g, 9, 9, hp, HP);
      if (ledger) px.sprite(g, BOOK, 66, 10);
      E.font.text(g, hero.exposure === 0 ? 'HIDDEN' : hero.crouch ? 'CROUCHED' : '', 9, 18, '#9ae89a', { font: 'tiny', outline: false });
      if (msgT > 0) {   // the message stays clear of the touch buttons: above them where they reach under it
        const w = E.font.width(msg) + 16, ta = game.input.touchArea(), my = ta && (r.W + w) / 2 > ta.x0 ? Math.min(r.H - 34, Math.floor(ta.y0) - 22) : r.H - 34;
        E.ui.box(g, (r.W - w) / 2, my, w, 18, { alpha: .85 }); E.font.text(g, msg, r.W / 2, my + 5, '#ffe7a8', { align: 'center' });
      }
      if (won) { E.font.title(g, 'MISSION COMPLETE', r.W / 2, 60, { align: 'center', scale: 3, colors: ['#ffffff', '#ffe08a', '#e0a040'], depth: 2 }); px.sprite(g, STAR, r.W / 2 - 2, 94); }
      if (!touch()) {   // the player's own keys (a touch screen's buttons name themselves)
        const k = a => game.input.label(a).toUpperCase(), pad = game.input.lastDevice === 'gamepad', move = pad ? 'STICK' : ['up', 'left', 'down', 'right'].map(k).join('');
        E.font.text(g, [move, k('sprint') + ' SPRINT', k('jump') + ' JUMP/CLIMB', k('crouch') + ' CROUCH', k('attack') + ' STRIKE', k('block') + ' BLOCK', k('dodge') + ' ROLL'].join('  '), r.W / 2, r.H - 9, '#b8b0d8', { align: 'center', font: 'tiny', shadow: '#000', outline: false });
      }
    });
  }
  return { view: 'iso', views: ['iso', 'threequarter'], input: 'THIRDPERSON', res: 'ps1', pausable: true, touch: ['jump', 'attack', 'block', 'crouch'],
    camera: { zoom: [.75, 2], rotate: true }, enter: start, update, draw,
    state: () => ({ hero, guards, map, ledger, won, hp }),   // for tests
    exit() { game.cam.offset = null; } };
})();
scenes.stealth = STEALTH;
