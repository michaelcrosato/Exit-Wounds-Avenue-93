/* =============================================================================
 * THE GALLERY: the animation showcase (title menu > GALLERY, or #gallery)
 *   SKILLS   the hero performs every registered skill on straw training dummies
 *   BESTIARY every monster walks in, attacks, flinches and falls, one at a time
 *   POSES    the hero's whole pose vocabulary, and his reactions
 *   BOSSES   the bosses wake on the stage and run their patterns (the hero cannot be hurt here)
 *   MOVES    the engine's actions (E.ACTIONS) on the hero: an execution and a takedown on real monsters, getting up,
 *            climbing up and down a stone block, hopping down, vaulting a low wall, a roll
 *   OBJECTS  the engine's core shapes (docs/ASSETS.md), turning beside the hero; the Asset Lab (/asset-lab) has the store
 * Left / Right pick, Up / Down change the reel, Enter replays, Z toggles slow motion, V view, [ ] turn, Esc leaves.
 * The gallery plays with a COPY of the saved hero (skills are ranked up for the show), so nothing here reaches the save.
 * A deep link opens one entry, so a tool can film it: #gallery/bestiary/husk, #gallery/skills/<skill id>,
 * #gallery/bosses/<boss id>, #gallery/poses/hands-on-hips, #gallery/moves/climb-up (add ?view=topdown, ?character=codex for Codex's skills).
 * In code: game.go('gallery', { reel: 'bestiary', item: 'husk' }). A wrong name warns with the list of right ones.
 * ============================================================================= */
/* ---- a straw training dummy: a post, a stuffed body and a sack head on a damped spring, so every hit shows ---- */
def('archetypes', 'dummy', { name: 'Training Dummy', tags: ['object'], minDepth: 999, weight: 0, noPack: true, hp: 1e9, dmg: 0, speed: 0, r: 5, xp: 0, head: 26, mass: 3, stagger: false,
  ai: m => { m.vx *= .8; m.vy *= .8; m.x = lerp(m.x, m.homeX, .1); m.y = lerp(m.y, m.homeY, .1); },
  body: m => ({ ax: 0, ay: 0, vx: 0, vy: 0, kick(v) { this.vx += (Math.random() - .5) * v * 30; },
    hit(ang, k) { this.vx += Math.cos(ang) * k; this.vy += Math.sin(ang) * k; },
    update(dt) { this.vx += (-this.ax * 90 - this.vx * 7) * dt; this.vy += (-this.ay * 90 - this.vy * 7) * dt; this.ax += this.vx * dt; this.ay += this.vy * dt; this.ax = clamp(this.ax, -1.2, 1.2); this.ay = clamp(this.ay, -1.2, 1.2); },
    draw(g, ox, oy, view) {
      const s = (view.zoom || 1), P0 = (x, y, z) => { const q = view.p(x, y, z); return [ox + q[0], oy + q[1]]; };
      const lean = (z, k = 1) => [this.ax * z * .35 * k, this.ay * z * .35 * k];
      const wood = E.tones('#7a5634'), straw = E.tones('#d8b25a'), sack = E.tones('#c8a878');
      const [b0x, b0y] = P0(0, 0, 0), [l1x, l1y] = lean(10), [b1x, b1y] = P0(l1x, l1y, 10);
      px.line(g, b0x, b0y, b1x, b1y, wood.sh, Math.max(2, Math.round(2 * s))); px.line(g, b0x - 1, b0y, b1x - 1, b1y, wood.lt);
      px.rect(g, b0x - 3 * s, b0y - 1, 6 * s, 2, wood.deep);
      const [tx, ty] = lean(17), [c0x, c0y] = P0(l1x, l1y, 10), [c1x, c1y] = P0(tx, ty, 18);
      px.poly(g, [[c0x - 3.5 * s, c0y], [c1x - 4 * s, c1y], [c1x + 4 * s, c1y], [c0x + 3.5 * s, c0y]], straw.sh);
      px.poly(g, [[c0x - 2.5 * s, c0y - 1], [c1x - 3 * s, c1y + 1], [c1x + 1 * s, c1y + 1], [c0x + .5 * s, c0y - 1]], straw.base);
      for (let i = 0; i < 4; i++) px.line(g, c0x - 3 + i * 2 * s, c0y, c0x - 4 + i * 2.2 * s, c0y + 2 * s, straw.lt);
      const [ax1, ay1] = lean(16, 1.2), [armL, armLy] = P0(ax1 - 1, ay1 - 6, 16), [armR, armRy] = P0(ax1 - 1, ay1 + 6, 16);
      px.line(g, armL, armLy, armR, armRy, wood.base, Math.max(1, Math.round(1.5 * s)));
      const [hx0, hy0] = lean(23, 1.3), [hx, hy] = P0(hx0, hy0, 23);
      px.disc(g, hx, hy, 3.6 * s, sack.sh); px.disc(g, hx - .6, hy - .6, 2.9 * s, sack.base);
      px.rect(g, hx - 2 * s, hy - 1 * s, 1, 1, '#3a2a1a'); px.rect(g, hx + 1 * s, hy - 1 * s, 1, 1, '#3a2a1a'); px.line(g, hx - 1.5 * s, hy + 1.5 * s, hx + 1.5 * s, hy + 1.5 * s, '#8a3a2a');
      px.line(g, hx - 1, hy - 3.6 * s, hx + 2, hy - 4.6 * s, straw.lt);
    } }),
  react(m, hit) { if (m.body) m.body.hit(hit.ang || 0, 3 + (hit.kb || 0) * .02); m.hp = m.maxHp; P.add({ kind: 'bit', x: m.x, y: m.y, z: 16, vx: (Math.random() - .5) * 60, vy: (Math.random() - .5) * 60, vz: 60, g: 300, max: .8, color: '#d8b25a' }); }
});

const GAL = { reel: 0, i: 0, t: 0, slow: false, cur: null, key: null, reels: ['SKILLS', 'BESTIARY', 'BOSSES', 'POSES', 'MOVES', 'OBJECTS'], cam: null };

const GAL_POSES = [
  ['Idle', {}, 'He breathes and shifts his weight.'], ['Walk', { run: .55 }, 'A gait driven by velocity, not frames.'], ['Run', { run: 1.1 }, 'The cape streams behind.'],
  ['Guard', { pose: 'guard' }, 'A boxer\'s guard.'], ['Block', { pose: 'block' }, 'Blade upright across the body.'], ['Ready', { stance: 'ready' }, 'Weapon held forward.'],
  ['Cast', { pose: 'cast' }, 'Both hands forward.'], ['Cheer', { pose: 'cheer', expr: 'shout' }, 'Victory: fists pump, the blade points up.'], ['Wave', { pose: 'wave', expr: 'smile' }, 'A greeting.'],
  ['Hands on hips', { pose: 'hips', expr: 'smile' }, 'A cocky idle.'], ['Kneel', { pose: 'kneel' }, 'Resting, or wounded.'], ['Crouch', { pose: 'crouch' }, 'Ducking low.'],
  ['Airborne', { air: true }, 'Legs tuck in a jump.'], ['Dash', { dash: true }, 'Leaning into a dash.'], ['Hurt', { hurt: true, expr: 'wince' }, 'A flinch: one arm shields the face.'],
  ['Knocked down', { down: 1 }, 'Flat on his back, then up again.'], ['Fall', { pose: 'die' }, 'A stagger, the knees give, a topple.'], ['Climb', { climb: true, vz: 30 }, 'Hand over hand.']
];
/* ---- MOVES: [name, caption, what plays]. The set: a stone block (climbs, the hop) and a low wall (the vault), drawn
 * with r.box; the hero is moved by E.Action alone (galMove holds him where it puts him, on top of the block too) ---- */
const GAL_MOVES = [
  ['Execution', 'A wounded foe reels: E leaps onto it, and the two bodies play one action (E.ACTIONS.takedown, aerial).', 'finish'],
  ['Takedown', 'Behind a Warden that has not seen you: the ground takedown, silent.', 'silent'],
  ['Get up', 'Knocked flat: he sits up, comes to one knee and stands (E.ACTIONS.getUp), untouchable until he is up.', 'getUp'],
  ['Climb up', 'Reach, hang under the edge, pull up and stand (E.ACTIONS.climbUp).', 'climbUp'],
  ['Climb down', 'The same action played backwards (reverse: true).', 'climbDown'],
  ['Hop down', 'A small rise, then the drop; a deep one lands on bent knees (E.ACTIONS.hopDown).', 'hopDown'],
  ['Vault', 'A hand on a low wall and over it at a run (E.ACTIONS.vault).', 'vault'],
  ['Roll', 'A forward roll, untouchable through its middle (E.ACTIONS.roll).', 'roll']
];
/** the set, built for the view so it faces the camera: d is the ground axis toward the camera (he climbs away from it,
 *  up the face it sees), sr the screen's right on the ground. The block (a half width of 13, top 24) and the low wall
 *  (3.5 deep, 15 wide, top 10) stand round c; at(k, j) is the point k along d and j along its side from c */
function galSet() {
  const cx = ED.L.w * 8, cy = ED.L.h * 8, k = (GAL_MOVES[GAL.cur] || GAL_MOVES[0])[2], v = game.view;
  const d = [[1, 0], [-1, 0], [0, 1], [0, -1]].reduce((a, b) => b[0] * v.fx + b[1] * v.fy > a[0] * v.fx + a[1] * v.fy + 1e-6 ? b : a);   // (view.fx, fy points toward the camera)
  const sd = v.screenDirToGround(1, 0), sl = Math.hypot(sd[0], sd[1]) || 1, sr = [sd[0] / sl, sd[1] / sl], c = { x: cx - 4, y: cy };
  const at = (k2, j = 0) => ({ x: c.x + d[0] * k2 - d[1] * j, y: c.y + d[1] * k2 + d[0] * j });
  const box = (hk, hj, top) => { const p0 = at(-hk, -hj), p1 = at(hk, hj); return { x0: Math.min(p0.x, p1.x), x1: Math.max(p0.x, p1.x), y0: Math.min(p0.y, p1.y), y1: Math.max(p0.y, p1.y), top, back: at(-hk) }; };
  return { k, c, d, sr, at, toward: Math.atan2(d[1], d[0]), away: Math.atan2(-d[1], -d[0]), B: box(13, 13, 24), W: box(3.5, 15, 10), block: ['climbUp', 'climbDown', 'hopDown'].includes(k), wall: k === 'vault' };
}
/** play one of the engine's actions on the hero: a beat standing where it starts, the action, then a beat where it ended */
function galMove(h) {
  const S = galSet(), { k, at, B, W } = S, edge = at(13), ledge = Object.assign(at(4), { z: B.top, edge: [edge.x, edge.y], facing: S.away });
  const make = () => k === 'climbUp' ? new E.Action('climbUp', { body: h, to: ledge })
    : k === 'climbDown' ? new E.Action('climbUp', { body: h, reverse: true, from: Object.assign(at(21), { z: 0 }), to: ledge })
    : k === 'hopDown' ? new E.Action('hopDown', { body: h, to: Object.assign(at(29), { z: 0 }) })
    : k === 'vault' ? new E.Action('vault', { body: h, to: Object.assign(at(16), { z: 0 }), top: W.top })
    : k === 'getUp' ? new E.Action('getUp', { body: h })
    : new E.Action('roll', { body: h, dir: S.sr, dist: 34 });
  let A = null, t = 0, hold = 0;
  startAction(h, { name: 'galMove', moveK: 0, cancel: false, face: h.facing, z: h.z, rig: k === 'getUp' ? { down: 1 } : {}, update(dt) {
    t += dt; this.z = h.z;
    if (t < .7) return true;   // where he starts (lying, for the get-up)
    if (!A) A = make();
    if (!A.done) { A.update(dt); this.rig = A.rigState(); this.z = h.z; this.face = h.facing; return true; }
    this.rig = { x: h.x, y: h.y, z: h.z }; return (hold += dt) < 1.1;   // where it put him (on the block: he stays up there)
  } });
}
/** the block and the wall, queued at their back faces: whatever stands on them or in front draws over them */
function galSetDraw(r) {
  const S = galSet(), box = (b, top, side) => r.queue(b.back.x, b.back.y, 0, g => r.box(g, b.x0, b.y0, 0, b.x1, b.y1, b.top, top, side));
  if (S.block) box(S.B, '#7d7590', '#544c66');
  if (S.wall) box(S.W, '#8a8070', '#5e5648');
}
function galItems() {
  if (GAL.reel === 0) return Object.keys(REG.skills).filter(id => skillAvailable(ED.hero, REG.skills[id])).sort((a, b) => Number(!!REG.skills[b].character) - Number(!!REG.skills[a].character));
  if (GAL.reel === 1) return Object.keys(REG.archetypes).filter(id => { const A0 = REG.archetypes[id]; return id !== 'dummy' && !A0.bossBody && !(A0.tags || []).includes('boss'); });   // bosses have their own reel
  if (GAL.reel === 2) return galBosses();
  if (GAL.reel === 4) return GAL_MOVES.map((p, i) => i);
  if (GAL.reel === 5) return Object.keys(E.SHAPES).filter(id => !id.includes(':'));   // (the core library: a set's entries are 'SET:id')
  return GAL_POSES.map((p, i) => i);
}
/** point the gallery at a reel by name and an entry by id (a pose by its name, spaces as dashes); unknown names warn and are ignored */
function galOpen(reel, item) {
  const r = GAL.reels.findIndex(n => n.toLowerCase() === String(reel).toLowerCase());
  if (r < 0) { console.warn('gallery: no reel "' + reel + '". Reels: ' + GAL.reels.join(', ').toLowerCase()); return; }
  GAL.reel = r; GAL.i = 0;
  if (!item) return;
  const items = galItems(), name = id => r === 3 || r === 4 ? (r === 3 ? GAL_POSES : GAL_MOVES)[id][0].toLowerCase().replace(/ /g, '-') : String(id).toLowerCase(), i = items.findIndex(id => name(id) === String(item).toLowerCase());
  if (i >= 0) GAL.i = i;
  else console.warn('gallery: no ' + GAL.reels[r].toLowerCase() + ' entry "' + item + '"' + (r === 0 ? ' for this character' : '') + '. Entries: ' + items.map(name).join(', '));
}
/** the BOSSES reel: the planned bosses, then one seeded composed boss on each body built for the endless descent (the Bone
 *  King, the Armored Colossus, the Flesh Titan...) as the deep depths compose them: that body, an element, patterns, a name */
function galBosses() {
  const named = Object.keys(REG.bosses).filter(id => !REG.bosses[id].composed);
  return named.concat(Object.keys(REG.archetypes).filter(id => REG.archetypes[id].bossBody && !bossPlanned(id)).map(id => 'gal:' + id));
}
/** a reel entry's boss id: a showcase body is composed once, from a seed of its own (so it is the same boss every time) */
function galBossId(key) {
  if (!String(key).startsWith('gal:')) return key;
  const body = key.slice(4); return composeBoss(45, RNG('emberdeep:gallery:' + body), { body, id: 'gallery:' + body });
}
function galStage() {
  const w = 26, hh = 20, cells = new Array(w * hh).fill(0);
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) if (!x || !y || x === w - 1 || y === hh - 1) cells[y * w + x] = 1;
  const L0 = { kind: 'gallery', rec: { depth: 3, seed: 3, pool: [] }, depth: 3, name: 'The Gallery', theme: REG.themes.crypt, hue: 0, w, h: hh, cells, tags: new Array(w * hh).fill(null), rooms: [{ x: 1, y: 1, w: w - 2, h: hh - 2, cx: w / 2, cy: hh / 2 }], things: [], props: [], torches: [], runes: [{ x: w * 8, y: hh * 8, r: 44 }], mechs: [], seen: new Uint8Array(w * hh).fill(1), t: 0 };
  L0.pal = CRYPT; L0.map = new E.TileMap({ w, h: hh, tile: T16, cells, types: REG.themes.crypt.walls, floorTex: (x, y, tag) => cryptFloor(L0, x, y, tag, CRYPT) }); deepCutaway(L0.map); L0.flow = new E.FlowField(L0.map);
  for (const [x, y] of [[5, 5], [21, 5], [5, 15], [21, 15]]) L0.torches.push({ x: x * T16, y: y * T16, t: Math.random() * 9, kind: 'brazier', color: '#ff9a4a', r: 4.5, solid: true });
  L0.randomFloor = (R, o) => randomFloor(L0, R, o); L0.start = { x: w * 8 - 30, y: hh * 8 };
  return L0;
}
/* ---- SKILLS staging: a tight cluster of dummies east of the rune circle's centre; the hero's mark depends on the skill ---- */
const GAL_DUMMIES = [[-12, 0], [0, -13], [0, 13], [13, -6], [13, 8], [27, 0]];
const GAL_K = 20;   // the cluster's centre, east of the stage centre
/** how far west of the cluster the hero stands: melee within reach, spells at range, movers far back so they travel */
function galMark(id) {
  const S = REG.skills[id] || {}, t = S.tags || [];
  if (S.kind === 'mobility' || t.includes('movement')) return 66;
  if (t.includes('melee') && !t.includes('proj')) return 29;
  if (S.range) return clamp(S.range * .75, 26, 46);
  return 60;
}
function galReset() {
  // bosses leave their marks on the floor (webs, lava, craters) and things: a fresh stage for the next take
  if (ED.L.things.length || (ED.L.map.floorTags || []).some(Boolean) || ED.L.mechs.length) { enterWorld(galStage()); ED.depth = 3; L.ambient = .16; }
  const h = ED.hero, L0 = ED.L, cx = L0.w * 8, cy = L0.h * 8;
  ED.foes.length = 0; ED.corpses.length = 0; ED.fx.length = 0; ED.allies.length = 0; ED.drops.length = 0; P.list.length = 0; ED.boss = null;
  endAction(h); h.vx = h.vy = 0; h.z = 0; h.facing = h.aim = 0; h.hp = h.maxHp; h.st = {}; h.inv = 0; h.dead = false; h.alive = true; h.ember = h.maxEmber; h.cds = {}; h.buffs = []; computeStats(h);
  h.bot = { manual: true, input: makeBotInput() };   // the gallery drives him through the autopilot's virtual input (the mouse must not steer the show)
  GAL.t = 0; GAL.fired = 0; GAL.next = .8; GAL.hold = 0; GAL.mon = null; GAL.rune = null;
  const items = galItems(); GAL.i = (GAL.i + items.length) % Math.max(1, items.length); GAL.cur = items[GAL.i];
  if (GAL.reel === 0) {   // a cluster of dummies to strike
    const kx = cx + GAL_K; GAL.markX = kx - galMark(GAL.cur); h.x = GAL.markX; h.y = cy;
    for (const [dx, dy] of GAL_DUMMIES) { const m = spawnMonster('dummy', kx + dx, cy + dy, { instant: true }); if (m) { m.homeX = m.x; m.homeY = m.y; m.noLoot = true; m.facing = Math.PI; } }
    const id = GAL.cur; h.skills[id] = Object.assign({}, h.skills[id] || {}, { rank: Math.max(3, (h.skills[id] && h.skills[id].rank) || 0) }); h.slots[5] = id;
  } else if (GAL.reel === 1) {   // one monster walks in from the east
    h.x = cx - 22; h.y = cy;
    const m = spawnMonster(GAL.cur, cx + 40, cy, { instant: true, level: 3 }); if (m) { m.noLoot = true; m.ai.aware = true; m.facing = Math.PI; GAL.mon = m; }
  } else if (GAL.reel === 2) {   // a boss, awake
    h.x = cx - 44; h.y = cy;
    GAL.boss = galBossId(GAL.cur);
    const m = spawnBoss(GAL.boss, cx + 30, cy, { level: 3 }); if (m) { m.noLoot = true; m.facing = Math.PI; GAL.mon = m; ED.boss = m; if (typeof wakeBoss === 'function') wakeBoss(m); }
  } else if (GAL.reel === 4) {   // moves: the set, and a monster for the takedowns (across the screen from him)
    const S = galSet(), put = p => { h.x = p.x; h.y = p.y; }; GAL.doneT = null; h.z = 0;
    if (S.k === 'finish' || S.k === 'silent') {
      const far = S.k === 'finish' ? 10 : -4, m = spawnMonster(S.k === 'finish' ? 'skeleton' : 'warden', S.c.x + S.sr[0] * far, S.c.y + S.sr[1] * far, { instant: true, level: 3 });
      const back = S.k === 'finish' ? 28 : 22; h.x = S.c.x - S.sr[0] * back; h.y = S.c.y - S.sr[1] * back; h.facing = h.aim = Math.atan2(S.sr[1], S.sr[0]);
      if (m) { m.noLoot = true; m.facing = h.facing; m.cool = 99; GAL.mon = m; if (S.k === 'finish') { m.hp = m.maxHp * .2; m.reelT = game.time + 99; } else { m.ai.wd.wait = 99; m.ai.wd.sweep = m.facing; } }
    } else {
      put(S.k === 'climbUp' ? S.at(21) : S.k === 'climbDown' ? S.at(4) : S.k === 'hopDown' ? S.at(7) : S.k === 'vault' ? S.at(-16) : S.c);
      h.facing = h.aim = S.k === 'climbUp' || S.k === 'climbDown' ? S.away : S.k === 'roll' ? Math.atan2(S.sr[1], S.sr[0]) : S.toward;
      if (S.k === 'climbDown' || S.k === 'hopDown') h.z = S.B.top;
      galMove(h);
    }
  } else if (GAL.reel === 5) { h.x = cx - 26; h.y = cy; h.facing = h.aim = 0; }   // objects: the hero beside it, for its size
  else { h.x = cx; h.y = cy; }   // poses: centre stage
  if (GAL.reel !== 2) playSong('title');
  game.setZoom(GAL.reel === 3 ? 2.5 : GAL.reel === 2 ? 1.25 : GAL.reel === 4 || GAL.reel === 5 ? 2 : 1.75);
  GAL.cam = null;
}
/** the SKILLS reel's autopilot: walk back to the mark, face the dummies, cast (holding channels), let combos run on */
function galSkill(h, dt) {
  const id = GAL.cur, S = REG.skills[id], I = h.bot.input, cy = ED.L.h * 8, kx = ED.L.w * 8 + GAL_K;
  I.clear(); I._d = {}; I.worldMove = [0, 0]; I.aimAt = [kx, cy];
  if (!S) return;
  const dx = GAL.markX - h.x, dy = cy - h.y, d = Math.hypot(dx, dy);
  if (!h.act && d > 3 && GAL.t > .3) { I.worldMove = [dx / d, dy / d]; I.aimAt = null; h.speedK = d < 10 ? .5 : 1; return; }   // back to his mark (a walk, not a jump cut)
  h.speedK = 0;
  if (GAL.hold > 0) { GAL.hold -= dt; I._d.s5 = true; }                                              // channels (Whirlwind) are held down
  if (S.again && h.act && h.act.skill === id && h.act.free) useSlot(h, 5);                             // whole combos
  if (!h.act && GAL.fired < 4 && GAL.t >= GAL.next && d <= 3) {
    h.cds = {}; h.ember = h.maxEmber; h.aim = h.facing = Math.atan2(cy - h.y, kx - h.x); h.tx = kx; h.ty = cy;
    { const C = characterOf(h); if (C.prime) C.prime(h); }   // a character's own resource, full for the demo (Dan's brood)
    // the takes run through the skill's runes: plain, the first rune, the second, plain again (runes change the animation too)
    const rn = S.runes && S.runes[[-1, 0, 1, -1][GAL.fired]]; if (h.skills[id]) h.skills[id].rune = rn ? rn.id : null; GAL.rune = rn || null;
    if (useSlot(h, 5)) { GAL.fired++; if (h.act && h.act.hold) GAL.hold = 1.8; }
  }
  if (h.act) GAL.next = GAL.t + 1.1;   // the next take starts a beat after this one ends
}
const galleryScene = {
  enter(data) {
    ED.mode = 'gallery'; UI.closeAll(); BUS.clear('level');
    GAL.real = ED.hero; ED.hero = loadHeroOrNew();   // a copy from the save: the show ranks skills up, and none of that may be saved
    const L0 = galStage(); enterWorld(L0); ED.depth = 3; L.ambient = .16;
    GAL.i = 0; if (data && data.reel) galOpen(data.reel, data.item);   // a deep link: one reel and entry
    galReset(); game.cam.snap = true;
  },
  exit() { slowMoReset(1); ED.foes.length = 0; ED.boss = null; ED.hero = GAL.real || null; GAL.real = null; },
  update(dt) {
    const inp = game.input, h = ED.hero, L0 = ED.L, cx = L0.w * 8, cy = L0.h * 8;
    if (updateUI(dt) || ED.mode !== 'gallery') return;
    if (inp.pressed('cancel')) { game.go('title'); return; }
    const galKey = inp.repeat('menuRight') ? 'ArrowRight' : inp.repeat('menuLeft') ? 'ArrowLeft' : inp.repeat('menuUp') ? 'ArrowUp' : inp.repeat('menuDown') ? 'ArrowDown' : inp.pressed('confirm') ? 'Enter' : null;
    if (galKey) { const k = galKey;
      if (k === 'ArrowRight' || k === 'ArrowLeft') { GAL.i += k === 'ArrowRight' ? 1 : -1; galReset(); sfx('select'); }
      else if (k === 'ArrowUp' || k === 'ArrowDown') { GAL.reel = (GAL.reel + (k === 'ArrowDown' ? 1 : GAL.reels.length - 1)) % GAL.reels.length; GAL.i = 0; galReset(); sfx('confirm'); }
      else if (k === 'Enter') galReset(); }
    GAL.t += dt; h.speedK = 0;   // the arrow keys browse here, so the hero stays put
    h.inv = 99; h.hp = h.maxHp; h.ember = h.maxEmber;
    const I = h.bot && h.bot.input; if (I && GAL.reel !== 0) { I.clear(); I._d = {}; I.worldMove = [0, 0]; I.aimAt = GAL.mon ? [GAL.mon.x, GAL.mon.y] : [h.x + 30, h.y]; }
    if (GAL.reel === 0) {
      galSkill(h, dt);
      if (GAL.fired >= 4 && !h.act && GAL.t > GAL.next + .6 || GAL.t > 16) galReset();
    } else if (GAL.reel === 1) {
      const m = GAL.mon;
      if (m && m.alive && GAL.t > 7) { m.st = {}; dealDamage(m, { src: h, amount: m.hp + 1, el: 'phys', kb: 90, ang: angTo(h, m), noNumber: false }); }
      if (GAL.t > 10) galReset();
    } else if (GAL.reel === 2) {   // the show runs every phase: the boss is worn down to its second and third
      const m = GAL.mon, B = m && m.bossDef, ph = (B && B.phases) || [];
      for (let i = 1; i < ph.length; i++) if (m.alive && GAL.t > 1 + i * 7 && m.phase < i && m.hp > m.maxHp * (ph[i].at - .02)) m.hp = m.maxHp * (ph[i].at - .02);
      if (GAL.t > 8 + ph.length * 7) galReset();
    } else if (GAL.reel === 4) {   // moves: the takedowns start after a beat; each entry plays again once it is over
      const k = galSet().k;
      if ((k === 'finish' || k === 'silent') && !GAL.fired && GAL.t > .7 && GAL.mon && GAL.mon.alive) { GAL.fired = 1; exeStart(h, GAL.mon, k); }
      if (!h.act && GAL.t > .8) { if (GAL.doneT === null) GAL.doneT = GAL.t; if (GAL.t - GAL.doneT > (GAL.fired ? 1.2 : 0)) galReset(); }
    }
    if (GAL.reel === 3) {   // poses: the rig alone
      const p = GAL_POSES[GAL.cur] || GAL_POSES[0], st = Object.assign({ x: h.x, y: h.y, z: 0, vx: 0, vy: 0, facing: Math.PI / 2 + Math.sin(GAL.t * .5) * .8 }, p[1]);
      if (p[1].down) st.down = GAL.t % 4 < 2.2 ? 1 : 0;
      if (p[1].pose === 'die' && GAL.t > 3.5) galReset();
      h.rig.update(dt, st); h.facing = st.facing; settleCape(h.rig, dt, .3);
      for (const b of ED.L.torches) b.t += dt;
    } else worldStep(dt, { canAct: false, gallery: true });
    // keep the show on the stage: the hero near his mark, monsters leashed to the circle (kiters and flyers wander off otherwise)
    h.x = clamp(h.x, cx - 80, cx + 60); h.y = clamp(h.y, cy - 40, cy + 40);
    if (GAL.reel === 1 || GAL.reel === 2) for (const m of ED.foes) if (m.alive) { const R = GAL.reel === 2 ? 76 : 58, dx = m.x - cx, dy = m.y - cy, d = Math.hypot(dx, dy); if (d > R) { m.x = cx + dx / d * R; m.y = cy + dy / d * R; } }
    if (GAL.reel === 1 && h.act === null && GAL.mon) { h.facing = E.approachAng(h.facing, angTo(h, GAL.mon), dt * 6); h.aim = h.facing; }
    // the camera frames what matters: the hero and the dummies, the monster (at its height: flyers too), or the hero alone
    const m = GAL.mon, tgt = GAL.reel === 0 ? [(GAL.markX + cx + GAL_K) / 2 + 4, cy, 10]
      : (GAL.reel === 1 || GAL.reel === 2) && m ? [(h.x + m.x) / 2, (h.y + m.y) / 2, 8 + Math.max(0, (m.z || 0)) * .5 + (GAL.reel === 2 ? 14 : 0)]
      : GAL.reel === 4 ? [ED.L.w * 8 - 4, ED.L.h * 8, 16] : GAL.reel === 5 ? [cx - 10, cy, 14] : [h.x, h.y, 19];
    const c = GAL.cam || (GAL.cam = tgt.slice()), k = Math.min(1, dt * 3); for (let i = 0; i < 3; i++) c[i] += (tgt[i] - c[i]) * k;
    game.focus(c[0], c[1], c[2]);
    if (inp.pressed('labels')) { GAL.slow = !GAL.slow; }
    if (SLOW.raw !== (GAL.slow ? .3 : 1)) slowMoReset(GAL.slow ? .3 : 1);
  },
  draw(r) {
    const L0 = ED.L;
    L0.map.drawFloor(r); L0.map.queueWalls(r); drawTorches(L0, r);
    if (GAL.reel === 4) galSetDraw(r);
    if (GAL.reel === 5 && E.SHAPES[GAL.cur]) r.shape(GAL.cur, L0.w * 8 + 6, L0.h * 8, 0, { facing: Math.PI / 2 + GAL.t * .6 });   // (turning, so every side shows)
    for (const m of ED.corpses) drawFoe(m, r);
    for (const m of ED.foes) drawFoe(m, r);
    for (const a of ED.allies) if (a.draw) a.draw(r);
    drawHero(ED.hero, r); drawFx(r); drawThings(L0, r);
    BUS.emit('draw', { r, L: L0 });   // what skills leave behind (blades, rifts, totems) and the powers' own light
    L.add(L0.w * 8, L0.h * 8, 3, 70, .5, { color: '#4fe0cc' });
    r.overlay(g => { const f = HUD_in(g, r); try {   // inside a phone's safe frame, the top band under its touch buttons
      const W = f.W, H = f.H, cx = W / 2, items = galItems(), T = HUD_under();
      px.blend(g, .6, 'normal', () => { px.rect(g, 0, -UI.frame.t, W, 31 + T + UI.frame.t, '#05040a'); px.rect(g, 0, H - 38, W, 38 + UI.frame.b, '#05040a'); });   // bands behind the text, so it reads on any floor
      E.font.title(g, 'GALLERY', cx, 4 + T, { scale: 2, colors: ['#fff6c8', '#ffd36a', '#e07a2a'], depth: 2, align: 'center' });
      const sp = Math.min(60, (W - 16) / GAL.reels.length);   // (six reels fit a phone held upright)
      GAL.reels.forEach((n, i) => E.font.text(g, n, cx + (i - (GAL.reels.length - 1) / 2) * sp, 22 + T, i === GAL.reel ? GOLD : '#8a80a8', { align: 'center', font: 'tiny', outline: '#0c0818' }));
      let title = '', sub = '';
      if (GAL.reel === 0) { const S = REG.skills[GAL.cur]; if (S) { const rn = GAL.rune; title = S.name + (rn ? '  -  ' + rn.name.toUpperCase() : ''); sub = rn ? rn.desc : typeof S.desc === 'function' ? S.desc(3, null) : S.desc || ''; drawSkillIcon(g, GAL.cur, 8, H - 32, 1); } }
      else if (GAL.reel === 1) { const A0 = REG.archetypes[GAL.cur]; if (A0) { title = A0.name; sub = (A0.tags || []).join(', ') + (A0.themes ? '  ·  lives in: ' + A0.themes.join(', ') : '  ·  found everywhere'); } }
      else if (GAL.reel === 2) { const B = REG.bosses[GAL.boss]; if (B) { const A0 = REG.archetypes[B.arch]; title = B.name + (B.composed && B.title ? ', ' + B.title : ''); sub = (B.composed ? (A0 ? A0.name : 'a body') + ', composed in ' + EL(B.el).name.toLowerCase() + ' for the endless descent  ·  ' : B.title ? B.title + '  ·  ' : '') + (B.depth ? 'depth ' + B.depth + '  ·  ' : '') + 'patterns: ' + ((GAL.mon && GAL.mon.patterns) || (B.phases || []).flatMap(p => p.patterns || []).filter((v, i, a) => a.indexOf(v) === i)).join(', '); } }
      else if (GAL.reel === 4) { const p = GAL_MOVES[GAL.cur] || GAL_MOVES[0]; title = p[0]; sub = p[1]; }
      else if (GAL.reel === 5) { const S = E.SHAPES[GAL.cur]; title = String(GAL.cur); sub = (S && S.about || '') + '  ·  r.shape(\'' + GAL.cur + '\', x, y, z), docs/ASSETS.md; the Asset Lab (/asset-lab) has the whole store'; }
      else { const p = GAL_POSES[GAL.cur] || GAL_POSES[0]; title = p[0]; sub = p[2]; }
      E.font.text(g, title.toUpperCase(), cx, H - 35, '#ffffff', { align: 'center', scale: 1, shadow: '#05040a', outline: '#0c0818' });
      E.font.wrap(sub.replace(/·/g, '•'), W - 60).slice(0, 2).forEach((l, i) => E.font.text(g, l, cx, H - 25 + i * 9, '#d8d0e8', { align: 'center', shadow: '#05040a', outline: false }));
      E.font.text(g, (GAL.i + 1) + ' / ' + items.length + '   ← → pick   ↑ ↓ reel   ENTER replay   Z slow' + (GAL.slow ? ' (ON)' : '') + '   V view   ESC back', cx, H - 6, '#a89ec8', { align: 'center', font: 'tiny', outline: false });
    } finally { HUD_out(g); } });
    drawPanels(r);
  }
};
