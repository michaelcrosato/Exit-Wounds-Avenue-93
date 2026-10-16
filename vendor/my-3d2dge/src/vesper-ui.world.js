// The stand-in for Vesper's simulation, so its interface (src/vesper-ui.ui.js, the part being measured) has a game under
// it: a harbour district at dusk, the courier, two guards, three cipher seals, the bell tower, the ledger on the archive
// roof and a boat to leave by. It exposes what Vesper's interface read: sim.phase, objective(), player, guards, alert,
// detected, interaction, collected, stats, checkpoint, time, waypoint; and it tells the interface what happens through
// sim.on(type, data). Not counted: Vesper's own simulation was some 20k tokens more.
const E = My3D2dge, T = 16;
const game = new E.Game({ canvas: 'screen', res: 'ps1', view: location.hash === '#threequarter' ? 'threequarter' : 'iso', views: ['iso', 'threequarter'], input: 'THIRDPERSON' });
const map = new E.TileMap({ rows: [
  '##########################',
  '#....,,,.................#',
  '#.AAAA...BBBB....CCCC....#',
  '#.AAAA...BBBB....CCCC....#',
  '#.AAAA...BBBB....CCCC....#',
  '#........................#',
  '#..,,,......p.....,,,....#',
  '#.DDDD..EEE....FFF.......#',
  '#.DDDD..EEE....FFF...TT..#',
  '#.DDDD..EEE....FFF...TT..#',
  '#........................#',
  '#~~~~~~~~~~~~~..~~~~~~~~~#',
  '##########################'],
  legend: { '#': 1, A: 2, B: 3, C: 2, D: 4, E: 5, F: 2, T: 6, p: 7, ',': { floor: 'grass' }, '~': { floor: 'water', block: true } },
  types: { 1: { h: 64, top: '#2e3a3c', side: '#46585a', face: 'stone', cut: true, cutH: 6 },
    2: { h: 40, top: '#8a4a3a', side: '#c8b89a', face: 'plaster', roof: 'tiles', windows: { lit: .3 }, shutters: '#2a5a6a', door: { chance: .4 } },
    3: { h: 48, top: '#5a4a3a', side: '#9a6a4a', face: 'brick', roof: 'slab', windows: { lit: .2 }, balcony: { z: 30, color: '#3a2a1e' } },
    4: { h: 24, top: '#7a4a32', side: '#d0c0a0', face: 'plaster', roof: 'tiles', door: { chance: .5 } },
    5: { h: 48, top: '#5a6a6a', side: '#7a8a8a', face: 'stone', roof: 'plain', windows: { w: 4, h: 12, lit: .15 } },
    6: { h: 72, top: '#7a6a5a', side: '#a89878', face: 'stone', roof: 'plain', windows: { w: 3, h: 10, step: 22, lit: .5 } },
    7: { h: 10, top: '#3e6a5a', side: '#5a4a32', face: 'plank', roof: 'leaves' } },
  floorTex: (x, y, tag) => tag === 'grass' ? E.tex.grass(x, y, { base: '#3e6a42', dark: '#2a5236', light: '#5a8a52' }) : tag === 'water' ? E.tex.water(x, y) : E.tex.dirt(x, y, { base: '#6a6258', dark: '#585048', light: '#7a7266' })
});
const at = (cx, cy, z = 0, id) => ({ x: cx * T, y: cy * T, z, id });
const MARK = { survey: at(22, 9, 72, 'survey'), ledger: at(11, 3.5, 48, 'ledger'), escape: at(15.5, 10.6, 0, 'escape') };
const SEALS = [at(3.5, 3, 40, 'seal1'), at(16.5, 8.5, 40, 'seal2'), at(4.5, 6.5, 0, 'seal3')];
const ROUTES = [[[7, 5.5], [21, 5.5]], [[8, 10.3], [20, 10.3]]];
const STEPS = ['survey', 'ledger', 'escape'];
const sim = {
  map, marks: MARK, seals: SEALS, opts: { cones: true }, on() {}, onStep() {}, frozen: () => false,
  objective() {
    return { survey: { title: 'Reach the bell tower', detail: 'Climb above the harbour and read the patrols.', marker: MARK.survey },
      ledger: { title: 'Steal the ledger', detail: 'It lies on the archive roof, the brick house to the north.', marker: MARK.ledger },
      escape: { title: 'Leave by boat', detail: 'The boat waits at the gap in the harbour wall.', marker: MARK.escape },
      complete: { title: 'Contract complete', detail: '' }, failed: { title: 'The watch has you', detail: '' } }[this.phase];
  },
  restart(fromCheckpoint) {
    const cp = fromCheckpoint && E.store.get('vesper-ui-cp', null);
    this.phase = cp ? cp.phase : 'survey'; this.time = cp ? cp.time : 0; this.collected = new Set(cp ? cp.seals : []);
    this.stats = cp ? Object.assign({}, cp.stats) : { detections: 0, takedowns: 0 }; this.checkpoint = !!cp; this.alert = 0; this.detected = false; this.caught = 0; this.waypoint = null;
    const p = cp ? cp.at : { x: 2.5 * T, y: 10.4 * T, z: 0 };
    this.player = Object.assign(new E.Mover({ x: p.x, y: p.y, z: p.z, r: 5 }), { hp: 5, maxHp: 5, facing: -Math.PI / 2 });
    this.guards = ROUTES.map((r, i) => Object.assign(new E.Mover({ x: r[0][0] * T, y: r[0][1] * T, r: 5, walk: 30, run: 70 }), { i, route: r, leg: 1, mode: 'patrol', hitT: 0 }));
    this.interaction = null; this._hold = 0;
  },
  save() { E.store.set('vesper-ui-cp', { phase: this.phase, time: this.time, seals: [...this.collected], stats: this.stats, at: { x: this.player.x, y: this.player.y, z: this.player.z } }); this.checkpoint = true; this.on('checkpoint'); },
  update(dt) {
    const p = this.player, I = game.input; this.time += dt;
    p.exposure = p.crouch && p.z < 2 && map.floorAt(p.x, p.y) === 'grass' ? 0 : 1; p.hidden = p.exposure === 0;
    p.update(dt, map, I); if (p.inHazard) p.respawn();
    let seen = false;
    for (const g of this.guards) {
      const s = E.sees(g, p, { map, range: 100, fov: 1.4 }), chase = g.mode === 'chase';
      if (s.seen) { seen = true; if (!chase && this.alert > .9) { g.mode = 'chase'; this.stats.detections++; this.on('spotted'); } }
      const tgt = g.mode === 'chase' ? p : { x: g.route[g.leg][0] * T, y: g.route[g.leg][1] * T }, d = Math.hypot(tgt.x - g.x, tgt.y - g.y);
      if (g.mode !== 'chase' && d < 6) g.leg = 1 - g.leg;
      g.update(dt, map, { move: d > 10 ? [(tgt.x - g.x) / d * (chase ? 1 : .5), (tgt.y - g.y) / d * (chase ? 1 : .5)] : [0, 0] });
      if (chase && d < 14 && E.sameLevel(g, p) && (g.hitT -= dt) < 0) { g.hitT = 1.1; p.hp--; this.on('hurt'); }
      if (chase && !s.seen && this.alert < .3) g.mode = 'patrol';
    }
    this.alert = E.clamp(this.alert + (seen ? dt * 1.2 : -dt * .35), 0, 1); this.detected = this.guards.some(g => g.mode === 'chase');
    for (const s of SEALS) if (!this.collected.has(s.id) && E.dist(p, s) < 12) { this.collected.add(s.id); this.on('seal', { count: this.collected.size }); }
    const m = MARK[this.phase], near = m && Math.hypot(m.x - p.x, m.y - p.y) < 18 && Math.abs((m.z || 0) - p.z) < 10;
    this._hold = near && I.down('interact') ? this._hold + dt : 0;
    this.interaction = near ? { label: { survey: 'Survey the district', ledger: 'Take the ledger', escape: 'Board the boat' }[this.phase], progress: this._hold / 1.2 } : null;
    if (near && this._hold >= 1.2) { this._hold = 0; const i = STEPS.indexOf(this.phase); this.phase = STEPS[i + 1] || 'complete'; this.on('phase', { phase: this.phase }); if (this.phase === 'escape') this.save(); }
    if (p.hp <= 0 && this.phase !== 'failed') { this.phase = 'failed'; this.failureReason = 'The watch cut you down in the street.'; }
    if (this.phase === 'complete' || this.phase === 'failed') { E.store.set('vesper-ui-cp', this.phase === 'failed' && this.checkpoint ? E.store.get('vesper-ui-cp') : null); this.on(this.phase); }
  }
};
sim.restart(false);
const rigs = new Map(), rig = (b, o) => rigs.get(b) || (rigs.set(b, new E.Humanoid(o)), rigs.get(b));
const HERO = { size: 1.1, build: 'heroic', hood: true, outfit: 'coat', sleeves: 'long', cape: { len: 6, width: 5, seg: 2.3 }, weapon: 'sword', bladeLen: 8, colors: { cloth: '#426878', pants: '#2e3e48', cape: '#7a2a2a' } };
const GUARD = { size: 1.05, build: 'heroic', armor: true, hat: 'helmet', weapon: 'sword', colors: { cloth: '#985444', metal: '#c2b58a' } };
const play = {
  pausable: true,
  enter() { game.follow(sim.player, { z: 18 }); game.cam.bounds = v => map.bounds(v); },
  update(dt) {
    if (!sim.frozen() && sim.phase !== 'complete' && sim.phase !== 'failed') sim.update(dt);
    const p = sim.player; rig(p, HERO).update(dt, p.rigState());
    for (const g of sim.guards) rig(g, GUARD).update(dt, g.rigState({ stance: g.mode === 'chase' ? 'ready' : null }));
    sim.onStep();
  },
  draw(r) {
    r.sky(['#0e1a22', '#2a3c4a', '#6a5a5a']); map.drawFloor(r); map.queueWalls(r);
    if (sim.opts.cones) for (const g of sim.guards) r.sightCone(g, { map, range: 100, fov: 1.4, color: g.mode === 'chase' ? '#ff6a4a' : '#ffe0a0', alpha: .25 });
    for (const s of SEALS) if (!sim.collected.has(s.id)) r.sprite(s.x, s.y, s.z + 6 + Math.sin(game.time * 3) * 1.5, E.sprite(['.c.', 'cCc', '.c.'], { c: '#5ab8a0', C: '#d8fff0' }), { glow: .5 });
    const m = sim.objective().marker; if (m) r.marker(m.x, m.y, m.z, { color: '#ffe0a0' });
    for (const b of [sim.player, ...sim.guards]) { r.shadow(b.x, b.y, 6, .35, undefined, map.groundAt(b.x, b.y, b.r, b.z)); r.actor(b.x, b.y, b.z, (g, ox, oy) => rigs.get(b).draw(g, ox, oy, r.view), { xray: b === sim.player ? { actors: true } : undefined, alpha: b.hidden ? .55 : 1 }); }
  }
};
