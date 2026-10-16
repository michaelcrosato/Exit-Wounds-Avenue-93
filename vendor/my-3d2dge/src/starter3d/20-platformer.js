/* =====================================================================================
 * SLICE 2  PLATFORMER  (Mario 64, Spyro, Banjo). A sunlit course of grass islands over the void, from the start in
 * the south to the flag in the north: plank platforms to hop, a terrace and a tower of stone steps, a platform that
 * rides across a gap, a spring up to a high deck. Space jumps (hold it for height), again in the air for a double jump;
 * Shift dashes (in the air too, once); land on a slime to stomp it (a bounce), touch one and you lose a heart. Coins,
 * three hidden stars, checkpoint flags; fall off and you start again at the last flag, a heart down.
 * THE 3D: the hero is a character controller on the level's heights (stairs, ledges, floating and moving platforms
 * carry him); the slimes are Rapier bodies; the sun casts real shadows; the chase camera swings round behind him as he
 * runs (C cycles the view and first person, V picks the view). PLAT.run(n): a scripted run's hash (the proof)
 * ===================================================================================== */
const PLAT = (() => {
  const T = 16;
  /* ---- THE COURSE: one character per 1-metre tile; row 0 is the north (the goal). ' ' is the void ---- */
  const PLANK = { platform: 0, thick: 6, pit: true, ground: 'planks', side: 'planks' }, DECK = { platform: 48, thick: 8, pit: true, ground: 'planks', side: 'planks' }, STONE = '#8a8478';
  const SIGNS = E.addAssets((window.ASSETS || {}).platformer3d || { set: 'platformer3d' }).shapes.length > 0;   // (the page's set: reset() places its signposts)
  const LEVEL = {
    rows: [
      '             ..............             ',
      '             .T...1G11...T.             ',
      '             .....1111.....             ',
      '             .....____.....             ',
      '             .k..........k.             ',
      '                   --                   ',
      '                   C-                   ',
      '                   --                   ',
      '          ....................          ',
      '          .T..........12Y321m.          ',
      '          .........e..12""21..          ',
      '          ...e...c....122221..          ',
      '          ......c.c...11^^11..          ',
      '          .....c.e.c..111111..          ',
      '          ......c.c....____...          ',
      '          .......c............          ',
      '          .k..f.....o.......T.          ',
      '          ....................          ',
      '                                        ',
      '                              ====      ',
      '                              =Z==      ',
      '                   M          ====      ',
      '                              ====      ',
      '         .o...............m....         ',
      '         ..122s221..........S..         ',
      '         ..1222221......e......         ',
      '         ..11^^^11..e..........         ',
      '         ..1111111.............         ',
      '         ....___...........e...         ',
      '         ...........c.c.c.c....         ',
      '         .T...........f........         ',
      '         ....................k.         ',
      '                                        ',
      '                  ----                  ',
      '                  ----                  ',
      '                                        ',
      '              -C--    --C-              ',
      '              ----    ----              ',
      '                                        ',
      '                  -C--                  ',
      '                  ----                  ',
      '                                        ',
      '           ..................           ',
      '           k................k           ',
      '           ...c..c..c..c..c....         ',
      '         ......................         ',
      '         ......................         ',
      '         ......................         ',
      '         ......o...............         ',
      '         ..........h...........         ',
      '         ...............m....           ',
      '           .T.......i......T.           ',
      '           ..................           ',
      '                                        '],
    legend: {
      '1': { floor: 16 }, '2': { floor: 32 }, '3': { floor: 48 },
      _: { stairs: 'n', floor: 16, color: STONE }, '^': { stairs: 'n', from: 16, floor: 32, color: STONE }, '"': { stairs: 'n', from: 32, floor: 48, color: STONE },
      '-': PLANK, C: Object.assign({ mark: 'coin' }, PLANK), '=': DECK, Z: Object.assign({ mark: 'star' }, DECK),
      c: { mark: 'coin' }, s: { floor: 32, mark: 'star' }, Y: { floor: 48, mark: 'star' }, G: { floor: 16, mark: 'goal' }, f: { mark: 'flag' }, e: { mark: 'slime' },
      S: { mark: 'spring' }, M: { pit: true, mark: 'mover' }, h: { mark: 'hero' }, T: { mark: 'tree' }, k: { mark: 'bush' }, o: { mark: 'rock' }, m: { mark: 'mushroom' }, i: { mark: 'sign' }
    },
    ground: 'grass', bottom: -120
  };
  const SPEED = 110, JUMP = 190, JUMP2 = 170, SPRING = 320, DASH = 230, HEARTS = 3;
  const SKY = ['#3a78d0', '#bfe6ff'];
  let world = null, hero = null, S = null, rnd = Math.random;
  const slimes = [];
  BOOT.push(['The course', () => {
    world = new W3(game, { level: LEVEL, sky: SKY, fog: { color: SKY[1], near: 260, far: 1300 }, ambient: ['#d6ecff', '#5a7a3a', 1.7],
      sun: { color: '#fff1d6', intensity: 2.6, dir: [-.45, .55, -.75], area: 260 }, camera: { mode: 'chase', chase: { pitch: -.32, dist: 96, fov: 60, height: 20 } } });
  }]);

  /** a fresh course: the hero at the start, the coins, stars, flags, springs, slimes, the moving platform, the trees */
  function reset(seed = 1) {
    world.reset(); rnd = E.rng(seed); slimes.length = 0;
    const M = world.marks, s = M.hero[0];
    hero = world.hero({ x: s.x, y: s.y, rig: new E.Humanoid({ weapon: null, hat: 'cap', build: 'heroic', colors: { cloth: '#d83a2a', pants: '#2f5fd0', glove: '#f0f0f0', boot: '#6a3a1a', hat: '#d83a2a', hair: '#3a2214' } }), facing: -Math.PI / 2 });
    S = { hearts: HEARTS, coins: 0, stars: 0, time: 0, inv: 0, hurtT: 0, air: 0, jumps: 0, dashT: 0, dashDir: 0, dashed: false, check: [s.x, s.y], won: false, lost: false, fallT: 0, sign: 0 };
    for (const c of M.coin || []) world.thing('coin', c.x, c.y, c.z + 4, { spin: .6, bob: 2 });
    for (const c of M.star || []) world.thing('star', c.x, c.y, c.z + 2, { spin: .35, bob: 3 });
    for (const c of M.flag || []) world.thing('flag', c.x, c.y, c.z, { color: '#e8e4ff' });
    for (const c of M.goal || []) world.thing('flag', c.x, c.y, c.z, { color: '#ffd34a', size: 1.4, goal: true });
    for (const c of M.spring || []) world.thing('spring', c.x, c.y, c.z, { color: '#ff4a3a' });
    for (const c of M.sign || []) world.thing('sign', c.x, c.y, c.z, { yaw: -Math.PI / 2, solid: [14, 4, 16] });
    // the trees, bushes and rocks are shapes (E.SHAPES, docs/ASSETS.md: the same entries as the 2D games'); rocks are solid
    for (const [kind, k] of [['tree', 'tree'], ['bush', 'bush'], ['rock', 'rock'], ['mushroom', 'mushroom']]) for (const c of M[kind] || []) {
      const yaw = rnd() * TAU, big = kind === 'tree' ? .9 + rnd() * .4 : 1;
      if (kind === 'mushroom') world.thing(k, c.x, c.y, c.z, { yaw, big }); else world.shape(k, c.x, c.y, c.z, { facing: yaw, scale: kind === 'tree' ? big * 1.1 : 1.2, solid: kind === 'rock' });
    }
    // signposts from the asset store (kenney-platformer, cut into the page's 'platformer3d' set: none without it) at the
    // start and beside each checkpoint flag, pointing on north
    if (SIGNS) for (const c of [s, ...(M.flag || [])]) world.shape('platformer3d:arrows', c.x + 14, c.y + 6, c.z || 0, { facing: -Math.PI / 2, scale: .8 });
    for (const c of M.mover || []) world.platform({ w: 32, d: 32, h: 6, path: [[c.x + 8, c.y + 40, 0], [c.x + 8, c.y - 8, 0]], speed: 26, wait: .8 });
    for (const c of M.slime || []) slimes.push(Object.assign(world.mob({ x: c.x, y: c.y, blob: new E.Blob({ R: 6.2, face: 'front', colors: { base: '#5ac85a', dk: '#2a7a3a', lt: '#a8f0a0' } }) }), { state: 'idle', t: rnd() * 2, home: [c.x, c.y], squashT: 0, flap: 0 }));
    world.camera.follow(hero); world.camera.yaw = -Math.PI / 2;
  }
  /* ---- THE HERO ---- */
  function heroStep(dt, I) {
    const h = hero; S.inv -= dt; S.hurtT -= dt; h.flash -= dt; S.time += dt;
    if (S.won || S.lost) { h.vx = h.vy = 0; h.anim = { pose: S.won ? 'cheer' : null }; return; }
    const md = I.move, ml = Math.hypot(md[0], md[1]);
    S.air = h.grounded ? 0 : S.air + dt;
    if (h.grounded) { S.jumps = 0; S.dashed = false; }
    // jump: on the ground (or just off it: a tenth of a second's grace), again in the air (once); short if let go early
    if (I.pressed('jump', .12)) {
      if (S.air < .1 && S.jumps === 0) { I.use('jump'); h.jump(JUMP); S.jumps = 1; P.dust(h.x, h.y, h.z, 5, { speed: 30 }); A.sfx('jump'); }
      else if (S.jumps < 2) { I.use('jump'); h.jump(JUMP2); S.jumps = 2; P.ring(h.x, h.y, 2, 12, '#ffffff', .25, h.z); A.sfx('jump'); h.rig.kick(-2); }
    }
    if (!I.down('jump') && h.vz > 70 && S.jumps === 1 && !S.sprung && !S.cut) { h.vz = 70; S.cut = true; }   // let go early: a short hop
    if (h.grounded) S.sprung = S.cut = false;
    if (I.pressed('dash', .12) && !S.dashed && S.dashT <= 0) {   // a dash, along the ground or once in the air
      I.use('dash'); S.dashT = .18; S.dashDir = ml > .1 ? Math.atan2(md[1], md[0]) : h.facing; if (!h.grounded) { S.dashed = true; h.vz = Math.max(h.vz, 30); }
      P.dust(h.x, h.y, h.z, 6, { speed: 40 }); A.sfx('whoosh');
    }
    if (S.dashT > 0) { S.dashT -= dt; h.vx = Math.cos(S.dashDir) * DASH; h.vy = Math.sin(S.dashDir) * DASH; h.facing = S.dashDir; }
    else { const acc = (h.grounded ? 1100 : 520) * dt; h.vx = approach(h.vx, md[0] * SPEED, acc); h.vy = approach(h.vy, md[1] * SPEED, acc); if (ml > .1) h.facing = E.approachAng(h.facing, Math.atan2(md[1], md[0]), dt * 14); }
    if (h.landed) { P.dust(h.x, h.y, h.z, 4, { speed: 25 }); h.rig.kick(-3); A.sfx('land'); }
    h.anim = { dash: S.dashT > 0, hurt: S.hurtT > 0, expr: S.hurtT > 0 ? 'wince' : null };
  }
  function hurtHero(from) {
    if (S.inv > 0 || S.won || S.lost) return;
    S.hearts--; S.inv = 1.3; S.hurtT = .3; hero.flash = .08; const a = Math.atan2(hero.y - from.y, hero.x - from.x);
    hero.vx = Math.cos(a) * 160; hero.vy = Math.sin(a) * 160; hero.jump(110); game.shake(3); game.freeze(.05); A.sfx('hurt');
    P.sparks(hero.x, hero.y, hero.z + 14, 6, a);
    if (S.hearts <= 0) lose();
  }
  function lose() { S.lost = true; game.after(1.4, () => game.go('over', { from: 'platformer', world, lines: ['COINS ' + S.coins + '   STARS ' + S.stars + ' OF 3'] })); }
  /** back at the last flag, a heart down (a fall) */
  function respawn() {
    S.hearts--; A.sfx('die'); game.flash('#000000', .3);
    if (S.hearts <= 0) { lose(); return; }
    hero.place(S.check[0], S.check[1]); S.inv = 1; S.jumps = 0; S.dashT = 0; world.camera.smooth = null;
  }
  /* ---- THE SLIMES: they wait, then hop at the hero when he comes near on their level ---- */
  const HOP = { vz: 150, air: 2 * 150 / 480 };
  function slimeStep(e, dt) {
    if (!e.alive) { e.squashT += dt; e.anim = { squash: -.6, squint: true }; e.fade = clamp(1 - e.squashT / .5, 0, 1); if (e.squashT > .5) { world.remove(e); slimes.splice(slimes.indexOf(e), 1); } return; }
    const dx = hero.x - e.x, dy = hero.y - e.y, d = Math.hypot(dx, dy) || 1, near = d < 130 && Math.abs(hero.z - e.z) < 20;
    if (e.state === 'air') { if (e.grounded && e.vz <= 0) { e.state = 'idle'; e.t = .5 + rnd() * .8; e.blob.kick(-5); } }
    else {
      e.vx = approach(e.vx, 0, 400 * dt); e.vy = approach(e.vy, 0, 400 * dt); e.t -= dt;
      if (e.state === 'idle' && e.t <= 0) { e.state = 'crouch'; e.t = .25; }
      else if (e.state === 'crouch' && e.t <= 0) {
        // a hop at the hero, or about its home spot; never off its ledge
        const hx = e.home[0] - e.x, hy = e.home[1] - e.y, go = near ? [dx / d, dy / d] : Math.hypot(hx, hy) > 20 ? [hx, hy] : [Math.cos(rnd() * TAU), Math.sin(rnd() * TAU)];
        const l = Math.hypot(go[0], go[1]) || 1, len = near ? Math.min(d, 40) : 24, tx = e.x + go[0] / l * len, ty = e.y + go[1] / l * len;
        if (Math.abs(world.floorAt(tx, ty, e.z + 4) - e.z) > 6) { e.state = 'idle'; e.t = .4; }
        else { e.state = 'air'; e.vz = HOP.vz; e.vx = go[0] / l * len / HOP.air; e.vy = go[1] / l * len / HOP.air; e.facing = Math.atan2(go[1], go[0]); e.blob.kick(4.5); }
      }
    }
    e.flap = approach(e.flap, e.state === 'air' ? 1 : 0, dt * 5);
    e.anim = { squash: e.state === 'crouch' ? -.35 : !e.grounded ? clamp(e.vz / 600, -.2, .28) : 0, look: [dx, dy], squint: e.state === 'crouch', flap: e.flap };
    // stomped from above, or touched from the side
    if (Math.hypot(dx, dy) < e.r + hero.r + 2) {
      if (hero.vz < -20 && hero.z > e.z + 6 && hero.z < e.z + 18) {
        e.alive = false; e.squashT = 0; e.setSolid(false); hero.jump(170); S.jumps = 1; S.dashed = false;
        P.ring(e.x, e.y, 3, 18, '#bff6b0', .3, e.z); P.bits(e.x, e.y, e.z + 4, 10, ['#5ac85a', '#a8f0a0', '#2a7a3a']); A.sfx('stomp'); game.freeze(.04);
      } else if (Math.abs(hero.z - e.z) < 12) hurtHero(e);
    }
  }
  /* ---- ONE STEP ---- */
  function step(dt, I) {
    heroStep(dt, I);
    for (const e of slimes.slice()) slimeStep(e, dt);
    for (const t of world.touching(hero)) {
      if (t.kind === 'coin') { world.remove(t); S.coins++; P.glints(t.x, t.y, t.z + 6, 5, '#ffe98a'); A.sfx('coin'); }
      else if (t.kind === 'star') { world.remove(t); S.stars++; P.glints(t.x, t.y, t.z + 8, 16, '#fff6a0', 20); game.note('STAR ' + S.stars + ' OF 3', 1.8); A.sfx('powerup'); game.flash('#fff8d0', .12, .4); }
      else if (t.kind === 'spring' && hero.vz <= 0 && hero.z < t.z + 8) { hero.jump(SPRING); S.sprung = true; S.jumps = 1; S.dashed = false; t.squash = .7; A.sfx('powerup'); P.ring(t.x, t.y, 4, 16, '#ff9a8a', .3, t.z + 4); }
      else if (t.kind === 'flag' && t.goal && !S.won) { S.won = true; A.music('victory'); P.glints(t.x, t.y, t.z + 30, 24, '#ffe98a', 30); game.flash('#fff4d0', .4, .6); game.after(3, () => game.go('over', { from: 'platformer', world, won: true, title: 'COURSE CLEAR', lines: ['STARS ' + S.stars + ' OF 3   COINS ' + S.coins, 'TIME ' + S.time.toFixed(1) + ' S'] })); }
      else if (t.kind === 'flag' && !t.goal && t.color !== '#4ae070') { t.color = '#4ae070'; S.check = [t.x + 10, t.y]; A.sfx('secret'); game.note('CHECKPOINT', 1.2); P.glints(t.x, t.y, t.z + 40, 8, '#bff6b0'); }
      else if (t.kind === 'sign') S.sign = 2;
    }
    for (const t of world.things) if (t.squash) t.squash = Math.max(0, t.squash - dt * 3);
    S.sign -= dt;
    if (hero.fell && !S.lost && !S.won) respawn();
    world.step(dt);
  }
  /* ---- THE HUD: hearts, coins, stars, the time; the sign's words; the controls for a few seconds ---- */
  function hud(g, r) {
    E.ui.hearts(g, 6, 6, S.hearts, HEARTS);
    E.font.text(g, 'COINS ' + S.coins, 6, 18, '#ffe98a', { outline: '#0b0814' });
    E.font.text(g, 'STARS ' + S.stars + '/3', 6, 28, '#fff6a0', { outline: '#0b0814' });
    E.font.text(g, S.time.toFixed(1), r.W - 6, r.H - 12, '#e8f4ff', { align: 'right', outline: '#0b0814' });
    if (S.sign > 0) { const w = Math.min(r.W - 20, 250), x = Math.round(r.W / 2 - w / 2); E.ui.box(g, x, r.H - 46, w, 30, { bg: '#3a2614', border: '#e8c890' }); E.font.text(g, 'THREE STARS ARE HIDDEN ON THE COURSE.', r.W / 2, r.H - 40, '#fff2d6', { align: 'center', outline: false }); E.font.text(g, 'THE FLAG IS FAR TO THE NORTH. GOOD LUCK!', r.W / 2, r.H - 29, '#fff2d6', { align: 'center', outline: false }); }
    else if (S.time < 6 && !touch()) E.font.text(g, prompt('jump', 'jump (twice: double)') + '   ' + prompt('dash', 'dash') + '   C camera', r.W / 2, r.H - 26, '#ffffff', { align: 'center', outline: '#0b0814', font: 'tiny' });
  }
  const I = { move: [0, 0], pressed: (a, w) => game.input.buffered(a, w), use: a => game.input.consume(a), down: a => game.input.down(a) };
  /** the proof: a scripted run north from the start (steering, jumping, dashing on a timetable): n steps of 1/120 s.
   *  Returns the world's hash */
  function run(n = 600) {
    reset(3); let i = 0;
    const c = { move: [0, -1], pressed: a => (a === 'jump' && i % 90 === 10) || (a === 'dash' && i % 200 === 150), use() {}, down: a => a === 'jump' && i % 90 < 40 };
    for (i = 0; i < n; i++) { c.move = [Math.sin(i / 60) * .6, -1]; step(1 / 120, c); }
    return world.hash([S.coins, S.hearts, S.stars]);
  }
  return {
    view: 'threequarter', views: ['threequarter', 'iso', 'brawler', 'topdown'], input: W3.INPUT, pausable: true, touch: ['jump', 'dash'], camera: { zoom: [.6, 2], tall: 1.6 },
    enter() { reset(1); active = world; A.music('adventure'); world.camera.set('chase'); },
    update(dt) { cameraKey(world); world.camera.ground(game.input.move(), I.move); step(dt, I); },
    draw(r) { world.draw(r); r.overlay(g => hud(g, r)); },
    get world() { return world; }, get hero() { return hero; }, get state() { return S; }, get slimes() { return slimes; }, reset, run
  };
})();
scenes.platformer = PLAT;
