// The handoff package's template game: a rooftop thief in the isometric view. Climb onto the roof, take the gem, and
// don't let the guard in the street watch you for long. It shows what a game is made of (scenes, a TileMap with roofs, a
// Body and a Humanoid, input, the camera, a HUD) and the height-aware API: map.ledge to climb, map.sight and E.inArc for
// the guard's eyes (they see over the planter, not through the roof), shapes and materials (docs/ASSETS.md: barrels and
// crates as data, solid with map.solid; the street's cobbles a material), and game.debug for tests and tools. The pause menu,
// settings, rebinding and full screen come with every game: menu: { controls } names the actions on its Controls screen,
// and input.label() puts the player's own key or button in a prompt.
// Copy it and make it your game. Test it headless: node game/test.mjs. Check it in a browser: node tools/check.mjs game/index.html
(() => {
const E = My3D2dge;
const game = new E.Game({ canvas: 'screen', res: 'snes', expand: true, view: 'iso', views: ['iso', 'threequarter'],   // expand: full screen at any shape (the HUD anchors to r.W, r.H)
  menu: { controls: { jump: 'Jump and climb', attack: false, dash: false, skill: false } } });   // (this game uses moves and jump only)
const ROOF = 32;
const map = new E.TileMap({
  rows: ['############',
         '#..........#',
         '#.@........#',
         '#....p.....#',
         '#......RRR.#',
         '#......RGR.#',
         '#..s...RRR.#',
         '#..........#',
         '############'],
  legend: { '#': 1, R: 2, G: { tile: 2, spawn: 'gem' }, p: 3, '@': 'hero', s: 'guard' },
  types: { 1: { h: 48, top: '#5a5068', side: '#3e3650', cut: true },
           2: { h: ROOF, top: '#9a4a3a', side: '#c8b89a', face: 'plaster', roof: 'tiles' },
           3: { h: 10, top: '#3e7a3a', side: '#5a4a32', face: 'plank', roof: 'leaves' } },
  floorMat: 'cobble'   // a material (E.MATERIALS, or '#hex pattern'): the floor, wall faces and tops, shapes' parts all take them
});
// set dressing: shapes (E.SHAPES: objects as data, right in every view), solid where they stand (map.solid: walk into one, land on it)
const DRESS = [['barrel', 152, 30, { facing: .5 }], ['barrel', 166, 26, { facing: 2 }], ['crate', 22, 120, { facing: .3 }], ['cart', 72, 26, { facing: 0 }]];
for (const [id, x, y, o] of DRESS) map.solid(id, x, y, 0, o);
const GEM = E.sprite(['.c.', 'cCc', '.c.'], { c: '#48c8f0', C: '#e8faff' }, 2);
let hero, heroRig, guard, guardRig, climb, alert, got, won;

function reset() {
  const h = map.find('hero'), g = map.find('guard');
  hero = new E.Body({ x: h.x, y: h.y, r: 5 }); hero.facing = 0;
  heroRig = heroRig || new E.Humanoid({ size: 1.2, build: 'heroic', weapon: null, hood: true, outfit: 'coat', colors: { cloth: '#3a4a6a', cape: '#2a3a52' } });
  guard = new E.Body({ x: g.x, y: g.y, r: 5 }); guard.facing = 0; guard.dir = 1;
  guardRig = guardRig || new E.Humanoid({ size: 1.2, build: 'heroic', weapon: 'sword', hat: 'helmet', colors: { cloth: '#8a3a32' } });
  climb = null; alert = 0; got = false; won = false;
}

const title = {
  update() { if (game.input.pressed('start')) { reset(); game.go('play'); } },
  draw(r) {
    r.sky(['#141030', '#3a2a60']);
    const m = Math.round(r.H / 2);   // centred on any screen
    r.overlay(g => E.font.title(g, 'ROOFTOP', r.W / 2, m - 52, { scale: 3, align: 'center' }));
    r.text(('CLIMB WITH ' + game.input.label('jump') + '  TAKE THE GEM  STAY UNSEEN').toUpperCase(), r.W / 2, m + 8, '#e8e0ff', { align: 'center' });
    r.text(('PRESS ' + game.input.label('start')).toUpperCase(), r.W / 2, m + 38, '#ffffff', { align: 'center', shadow: '#000' });
  }
};

const play = {
  pausable: true,
  enter() { game.follow(hero, { z: 16 }); game.cam.bounds = v => map.bounds(v); },
  update(dt) {
    const I = game.input;
    if (climb) {   // pull up onto the ledge: rise along the wall, then step over the edge
      climb.t += dt; const u = Math.min(1, climb.t / climb.dur), rise = Math.min(1, u / .7), over = Math.max(0, (u - .7) / .3);
      hero.z = E.lerp(climb.z0, climb.to.z, E.ease.outQuad(rise));
      hero.x = E.lerp(climb.x0, climb.to.x, over); hero.y = E.lerp(climb.y0, climb.to.y, over);
      if (u >= 1) { hero.onGround = true; hero.vz = 0; climb = null; game.audio.sfx('land'); }
    } else {
      const [mx, my] = I.move(), [dx, dy] = game.view.screenDirToGround(mx, my);
      hero.vx = dx * 80; hero.vy = dy * 80;
      if (dx || dy) hero.facing = Math.atan2(dy, dx);
      if (I.pressed('jump')) {
        const up = map.ledge(hero, hero.facing);   // a top to pull up onto, straight ahead or a little to the side
        if (up && hero.onGround) { climb = { t: 0, dur: .3 + up.rise / 80, x0: hero.x, y0: hero.y, z0: hero.z, to: up }; hero.facing = up.facing; hero.vx = hero.vy = 0; game.audio.sfx('jump'); }
        else if (hero.jump(230)) game.audio.sfx('jump');
      }
      hero.update(dt, map);
    }
    // the guard walks the street and watches ahead: its eyes see over the planter, not through the roof
    guard.vx = guard.dir * 30; guard.update(dt, map);
    if (guard.x > 112 || guard.hitWall) guard.dir = -1; else if (guard.x < 40) guard.dir = 1;
    guard.facing = guard.dir > 0 ? 0 : Math.PI;
    const sees = map.sight(guard, hero) && E.inArc(guard, guard.facing, hero, 110, .6);
    alert = sees ? alert + dt : Math.max(0, alert - dt * .5);
    const gem = map.find('gem');
    if (!got && E.dist(hero, { x: gem.x, y: gem.y, z: ROOF }) < 12) { got = true; game.audio.sfx('coin'); game.flash('#c8f4ff', .15); }
    if (got && hero.z < 2) { won = true; game.go('end'); }   // back down in the street with it
    else if (alert > 1.2) { won = false; game.audio.sfx('hurt'); game.go('end'); }
    // the rigs are posed every step from the bodies' motion; draw only draws them
    heroRig.update(dt, { x: hero.x, y: hero.y, z: hero.z, vx: climb ? 0 : hero.vx, vy: climb ? 0 : hero.vy, vz: climb ? 60 : hero.vz, facing: hero.facing, air: !hero.onGround && !climb, climb: !!climb });
    guardRig.update(dt, { x: guard.x, y: guard.y, z: guard.z, vx: guard.vx, vy: 0, facing: guard.facing, stance: 'ready' });
  },
  draw(r) {
    r.sky(['#101828', '#28304a']);
    map.drawFloor(r); map.queueWalls(r);
    for (const [id, x, y, o] of DRESS) r.shape(id, x, y, 0, o);
    r.decal(() => r.groundArc(guard.x, guard.y, 6, 110, guard.facing - .6, guard.facing + .6, alert > 0 ? '#ff6040' : '#ffe080', .4));   // its sight cone
    const gem = map.find('gem');
    if (!got) r.sprite(gem.x, gem.y, ROOF + 6 + Math.sin(game.time * 3) * 2, GEM);
    for (const [b, rig] of [[hero, heroRig], [guard, guardRig]]) {
      r.shadow(b.x, b.y, 7, .35, undefined, b.groundZ || 0);
      r.actor(b.x, b.y, b.z, (g, ox, oy) => rig.draw(g, ox, oy, r.view));
    }
    r.overlay(g => {
      E.font.text(g, got ? 'GEM: BRING IT DOWN' : 'GEM: ON THE ROOF', 6, 6, got ? '#80e8ff' : '#ffffff');
      E.ui.bar(g, r.W - 70, 6, 64, 6, Math.min(1, alert / 1.2), '#ff6040');
    });
  }
};

const end = {
  update() { if (game.input.pressed('start')) { reset(); game.go('play'); } },
  draw(r) {
    r.sky(won ? ['#103020', '#2a6a48'] : ['#301010', '#6a2a2a']);
    const m = Math.round(r.H / 2);
    r.overlay(g => E.font.title(g, won ? 'STOLEN' : 'CAUGHT', r.W / 2, m - 42, { scale: 3, align: 'center' }));
    r.text(('PRESS ' + game.input.label('start') + ' TO TRY AGAIN').toUpperCase(), r.W / 2, m + 28, '#ffffff', { align: 'center', shadow: '#000' });
  }
};

reset();
// a handle for tests and tools (node game/test.mjs, tools/check.mjs prints snapshot(), tools/replay.mjs logs it)
game.debug = {
  snapshot: () => ({ scene: game.sceneName, hero: [hero.x, hero.y, hero.z].map(v => Math.round(v * 10) / 10), climbing: !!climb,
    guard: [Math.round(guard.x), Math.round(guard.y), guard.facing], alert: Math.round(alert * 100) / 100, got, won }),
  teleport(x, y, z = 0, facing = hero.facing) { Object.assign(hero, { x, y, z, vx: 0, vy: 0, vz: 0, onGround: true, facing }); climb = null; }
};
game.start({ scenes: { title, play, end }, scene: 'title' });
})();
