/* =============================================================================
 * COMBAT: units, the one damage pipeline, the crowd grid, the hit-stop governor and the FX verbs
 * A UNIT is any object with { team: 'hero' | 'foe', x, y, z, vx, vy, r, hp, maxHp, alive, st: {}, res: {}, armor,
 * head (height for numbers), mass (knockback resistance, 1 = normal) } and optional react(hit), onDie(hit),
 * onBeforeHit(hit, amount) -> amount (blocks, shields). The hero, monsters, allies and bosses all qualify.
 * A HIT is { src, amount, el, var, crit, critMul, kb, ang, up, stun, status, statusChance, statusPower, tags: [],
 * skill, proc, noNumber }. dealDamage(target, hit) runs it: crit, resistances, armor, statuses, reaction, events.
 * ============================================================================= */
const TEAMS_HIT = { hero: 'foe', foe: 'hero' };
/** the units a team fights: the hero side hits monsters, monsters hit the hero and his allies */
function enemiesOf(team) { return team === 'hero' ? ED.foes : heroSide(); }
function heroSide() { const out = []; if (ED.hero && ED.hero.alive) out.push(ED.hero); for (const a of ED.allies) if (a.alive && a.targetable !== false) out.push(a); return out; }

/* ---------- the crowd grid (rebuilt once per step) ---------- */
const GRID = {
  C: 16, m: new Map(),
  key: (cx, cy) => cx + cy * 8192,
  build(list) { this.m.clear(); for (const u of list) { if (!u.alive) continue; const k = this.key((u.x / this.C) | 0, (u.y / this.C) | 0); let a = this.m.get(k); if (!a) this.m.set(k, a = []); a.push(u); } },
  /** call fn(u) for foes near (x, y) within rad (+ their radius); returns count */
  each(x, y, rad, fn) {
    const C = this.C, x0 = ((x - rad - 8) / C) | 0, x1 = ((x + rad + 8) / C) | 0, y0 = ((y - rad - 8) / C) | 0, y1 = ((y + rad + 8) / C) | 0; let n = 0;
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) { const a = this.m.get(this.key(cx, cy)); if (!a) continue; for (const u of a) { const R = rad + u.r; if (d2(u.x, u.y, x, y) <= R * R && u.alive) { n++; fn(u); } } }
    return n;
  },
  near(x, y, rad) { const out = []; this.each(x, y, rad, u => out.push(u)); return out; }
};
/** every enemy of `team` within rad of (x, y): fn(u). Monsters come from the grid, the hero side from its short list */
function eachEnemy(team, x, y, rad, fn) {
  if (team === 'hero') return GRID.each(x, y, rad, u => { if (u.spawnT > 0 || u.untargetable) return; fn(u); });
  let n = 0; for (const u of heroSide()) { const R = rad + u.r; if (d2(u.x, u.y, x, y) <= R * R) { n++; fn(u); } } return n;
}
/** nearest enemy of team to (x, y) within rad, skipping a set */
function nearestEnemy(team, x, y, rad, skip) {
  let best = null, bd = rad * rad;
  eachEnemy(team, x, y, rad, u => { if (skip && skip.has(u)) return; const d = d2(u.x, u.y, x, y); if (d < bd) { bd = d; best = u; } });
  return best;
}
/** the level's hittable things (kegs, pylons, nests...) near a point: the hero side can strike them */
function eachThing(x, y, rad, fn) {
  const L0 = ED.L; if (!L0 || !L0.things) return;
  for (const t of L0.things) if (t.hittable && !t.dead) { const R = rad + (t.r || 6); if (d2(t.x, t.y, x, y) <= R * R) fn(t); }
}
function hitThing(t, hit) { if (t.dead || !t.onHit) return; t.onHit(hit); BUS.emit('thingHit', { thing: t, hit }); }

/* ---------- the hit-stop and impact governors ----------
 * Every game.freeze() (from any file, and the engine's own explosions) goes through a leaky budget: the first blow
 * of a burst stops time in full, blows that follow within a moment stop it less and less (a dash through a pack, a
 * blade thrown down a line, a meteor shower, a chain of kegs, a swarm hitting the hero), so a crowd stutters once
 * instead of once per foe. Several calls in one step never add up (freeze keeps the longest). A steady rhythm (a
 * combo, a whirlwind) refills the budget between blows and keeps its full stops. Measured on a lunge through six
 * foes: 0.30 s of stop before, 0.12 s after.
 * Impact stars are budgeted per step the same way: a pack struck at once shows two full stars and smaller ones
 * after, so the foes stay readable under the flash. */
const HITSTOP = { debt: 0, t: 0, soft: .07, refill: .22, impT: -1, impN: 0, hard: s => game.freeze(s) };
{
  const freeze0 = game.freeze.bind(game), impact0 = P.impact.bind(P);
  HITSTOP.hard = s => freeze0(s);   // a stop the budget must not shrink (the hero's death: it follows his own hurt stop)
  game.freeze = s => {
    const H = HITSTOP, now = game.real; H.debt = Math.max(0, H.debt - (now - H.t) * H.refill); H.t = now;
    const want = s * clamp(1 - H.debt / H.soft, .18, 1);
    H.debt += Math.max(0, want - Math.max(0, game.hitstop)); freeze0(want);
  };
  // glints (frost, loot, holy sparkles) are long-lived crosses: past a dozen in one step they thin out, and near the hero
  // half of them are dropped, so a frozen pack or a loot shower never buries him under white crosses
  const glints0 = P.glints.bind(P);
  P.glints = (x, y, z, n = 5, color, spread) => {
    const H = HITSTOP; if (game.time !== H.glT) { H.glT = game.time; H.glN = 0; }
    const h = ED.hero; let k = H.glN > 12 ? .35 : 1; if (h && d2(x, y, h.x, h.y) < 20 * 20) k *= .5;
    const m = k < 1 ? Math.floor(n * k + Math.random()) : n; if (m <= 0) return; H.glN += m; glints0(x, y, z, m, color, spread);
  };
  P.impact = (x, y, z, size = 6, color) => {
    const H = HITSTOP; if (game.time !== H.impT) { H.impT = game.time; H.impN = 0; }
    if (++H.impN > 8) return;
    impact0(x, y, z, H.impN > 2 ? size * Math.max(.4, 1 - (H.impN - 2) * .18) : size, color);
  };
}

/* ---------- the damage pipeline ---------- */
/* damage numbers: hits landing together near one spot stack in a short column (a crit takes a double row, so the
 * big numbers never overprint each other); a quick string of small hits on ONE target (whirlwind cuts, orbiting
 * blades, a flurry) rolls up into a single growing number instead of a spray of 5s. Crits always stand alone. */
let numCol = null;
function damageNumber(u, amt, crit, el) {
  if (!OPT.numbers) return;
  const t = game.time, hero = u.team === 'hero', col = hero ? '#ff6a5a' : crit ? '#ffd23a' : el && el !== 'phys' ? EL(el).light : '#fff2c4', q = u.numQ;
  if (!crit && q && q.col === col && t - q.t < .35 && t - q.t0 < 1.6 && q.p.life < q.p.max * .75) {
    q.sum += amt; q.t = t; q.p.text = fmt(q.sum); q.p.life = Math.min(q.p.life, .1); return;
  }
  const c = numCol && t - numCol.t < .12 && d2(u.x, u.y, numCol.x, numCol.y) < 28 * 28 ? numCol : numCol = { x: u.x, y: u.y, z: (u.z || 0) + (u.head || 20) + 4, n: 0 };
  c.t = t; const row = c.n % 6; c.n += crit ? 2 : 1;
  // the text is screen-sized but the column is stacked in world height: a top-down view flattens height (4 px per 10
  // units against iso's 15) and a close zoom stretches it, so the rows and the rise scale to stay ~10 px apart
  const zk = clamp(1.5 / Math.max(.1, Math.abs(game.view.p(0, 0, 10)[1] - game.view.p(0, 0, 0)[1]) / 10), .6, 4);
  // never on his head: the hero's own numbers pop out beside his shoulder (alternating sides), and a monster's number
  // that would rise through him (a foe in his face) is pushed out to the far side of it, so he stays readable in a brawl
  const H = ED.hero, sd = game.view.screenDirToGround(1, 0), sl = Math.hypot(sd[0], sd[1]) || 1;
  let nx = c.x + (hero ? 0 : (Math.random() - .5) * 6), ny = c.y, z0 = c.z + row * 7 * zk;
  if (hero) { const side = (damageNumber.side = -(damageNumber.side || 1)) * 13; nx += sd[0] / sl * side; ny += sd[1] / sl * side; z0 = (u.z || 0) + (u.head || 20) * .6 + row * 7 * zk; }
  else if (H && H.alive && d2(nx, ny, H.x, H.y) < 18 * 18) { const dx = nx - H.x, dy = ny - H.y, d = Math.hypot(dx, dy); const ux = d > .5 ? dx / d : sd[0] / sl, uy = d > .5 ? dy / d : sd[1] / sl; nx = H.x + ux * 18; ny = H.y + uy * 18; }
  const p = P.add({ kind: 'text', x: nx, y: ny, z: z0, vz: (crit ? 70 : 38) * zk, g: (crit ? 260 : 40) * zk, bounce: crit ? .35 : 0, floor: crit ? z0 : undefined, text: crit ? fmt(amt) + '!' : fmt(amt), color: col, max: crit ? 1.1 : .8, scale: crit ? 2 : 1 });
  u.numQ = p && !crit ? { p, col, sum: amt, t, t0: t } : null;
}
/** run a hit on a unit. Returns the damage dealt (0 if it missed or was ignored) */
function dealDamage(tgt, hit) {
  if (!tgt || !tgt.alive || tgt.spawnT > 0) return 0;
  if (DEV.god && tgt === ED.hero) return 0;
  if (tgt.team === 'hero' && (tgt.inv > 0 || tgt.ghost)) { if (tgt.onDodgedHit) tgt.onDodgedHit(hit); return 0; }
  const src = hit.src || null, el = hit.el || 'phys';
  let amt = hit.amount * (hit.var === 0 ? 1 : 1 + (Math.random() * 2 - 1) * (hit.var || TUNE.dmgVariance));
  let crit = hit.crit;
  if (crit === undefined) crit = !!(src && src.critChance && Math.random() < src.critChance);
  if (crit) amt *= hit.critMul || (src && src.critMul) || TUNE.critMul;
  // mitigation: armor against physical, resistances against the rest (both capped), and status multipliers
  if (el === 'phys') { const ar = tgt.armor || 0; if (ar > 0 && TUNE.armorK > 0) { const a2 = ar * TUNE.armorK; amt *= 1 - clamp(a2 / (a2 + 5 * amt + 30), 0, TUNE.armorCap); } }
  else if (tgt.res) amt *= 1 - clamp(tgt.res[el] || 0, -1, .8);
  if (tgt.st.shock) amt *= 1.15; if (tgt.st.vuln) amt *= 1.25; if (tgt.st.freeze && el === 'phys') amt *= 1.3;
  if (src && src.st && src.st.curse) amt *= .8;
  if (tgt.dmgTaken) amt *= tgt.dmgTaken;
  amt *= tgt.team === 'foe' ? DIFF.heroDmg : DIFF.foeDmg;
  if (tgt.onBeforeHit) { amt = tgt.onBeforeHit(hit, amt); if (amt <= 0) return 0; }
  amt = Math.max(1, amt);
  tgt.hp -= amt; hit.dmg = amt; hit.crit = crit; tgt.lastHit = game.time; tgt.hitBy = src;
  // statuses: the hit's own, or the element's with a chance
  const stId = hit.status || (el !== 'phys' || hit.statusChance ? EL(el).status : null);
  if (stId) { let ch = hit.statusChance === undefined ? (el === 'phys' ? 0 : TUNE.statusChance) : hit.statusChance; if (src && src.statusMul) ch *= src.statusMul; if (Math.random() < ch) applyStatus(tgt, stId, hit.statusPower === undefined ? amt * .4 : hit.statusPower, src); }
  if (hit.stun) applyStatus(tgt, 'stun', 0); if (hit.stun && tgt.st.stun) tgt.st.stun.t = Math.max(tgt.st.stun.t, hit.stun);
  if (tgt.react) tgt.react(hit);
  if (!hit.noNumber) damageNumber(tgt, amt, crit, el);
  if (crit && tgt.team === 'foe') P.impact(tgt.x, tgt.y, (tgt.z || 0) + (tgt.head || 20) * .55, 9, '#ffd23a');
  BUS.emit('hit', { src, tgt, hit, dmg: amt });
  if (tgt.hp <= 0 && tgt.alive) killUnit(tgt, hit);
  return amt;
}
function killUnit(u, hit) {
  if (!u.alive) return;
  const st = u.st; u.alive = false; u.hp = 0; u.deadT = 0; u.st = {};
  if (u.onDie) u.onDie(hit || {});
  BUS.emit('kill', { src: hit && hit.src, tgt: u, hit: hit || {}, st });   // st: what it was afflicted with when it died
  // the last of a pack falls: a heartbeat of slow motion (a finisher)
  if (u.pack && u.team === 'foe' && !SLOW.live && !ED.demo && ED.mode === 'level' && !ED.foes.some(o => o.alive && o.pack === u.pack)) {
    const n = ED.corpses.filter(o => o.pack === u.pack).length + 1;
    if (n >= 4) slowMo(.4, .3, 'finisher');
  }
}
/** push a unit away from (x, y) (or along ang) with speed kb; heavy units (mass) move less. up launches it */
function knock(u, ang, kb, up = 0) {
  const m = u.mass || 1; if (m >= 99) return;
  kb *= TUNE.knockback; up *= TUNE.knockUp;
  u.vx += Math.cos(ang) * kb / m; u.vy += Math.sin(ang) * kb / m;
  if (up && u.canFly !== true) { u.vz = Math.max(u.vz || 0, up / Math.sqrt(m)); u.air = true; }
}
/** hit every enemy of a team in a circle (and the level's things, for the hero side). mk(u) returns the hit */
function hitCircle(team, x, y, rad, mk, set) {
  let n = 0;
  eachEnemy(team, x, y, rad, u => { if (set) { if (set.has(u)) return; set.add(u); } const h = mk(u); if (h) { dealDamage(u, h); n++; } });
  if (team === 'hero') eachThing(x, y, rad, t => { if (set) { if (set.has(t)) return; set.add(t); } const h = mk(t); if (h) hitThing(t, h); });
  return n;
}
/** melee cone: enemies within range of (x, y) and within half of facing */
function hitCone(team, x, y, facing, range, half, mk, set) {
  let n = 0;
  const test = u => { const dx = u.x - x, dy = u.y - y; return Math.abs(E.angDiff(facing, Math.atan2(dy, dx))) <= half || dx * dx + dy * dy < (u.r + 3) * (u.r + 3); };
  eachEnemy(team, x, y, range, u => { if (set && set.has(u)) return; if (!test(u)) return; if (set) set.add(u); dealDamage(u, mk(u)); n++; });
  if (team === 'hero') eachThing(x, y, range, t => { if (set && set.has(t)) return; if (!test(t)) return; if (set) set.add(t); hitThing(t, mk(t)); });
  return n;
}

/* ---------- element particles: one call makes any element's burst ---------- */
function elBurst(x, y, z, el, n = 8, ang = null) {
  const e = EL(el);
  switch (el) {
    case 'fire': P.fire(x, y, z, Math.ceil(n * .6), { size: 3.5, speed: 30 }); P.sparks(x, y, z, Math.ceil(n * .5), ang, { color: '#ff9a3a', hot: '#fff0a0' }); break;
    case 'frost': P.glints(x, y, z, Math.ceil(n * .5), '#e8fbff', 12); P.bits(x, y, z, Math.ceil(n * .6), ['#bfefff', '#7fd8ff', '#ffffff']); break;
    case 'storm': P.sparks(x, y, z, n, ang, { color: '#ffe45a', hot: '#ffffff' }); P.glints(x, y, z, 2, '#fffbd0', 8); break;
    case 'void': for (let i = 0; i < n; i++) P.add({ kind: 'ember', x: x + (Math.random() - .5) * 10, y: y + (Math.random() - .5) * 10, z: z + Math.random() * 6, vx: (Math.random() - .5) * 30, vy: (Math.random() - .5) * 30, vz: 20 + Math.random() * 30, drag: 2, max: .7, color: Math.random() < .5 ? '#b070ff' : '#6a30c0' }); P.smoke(x, y, z, 2, { size: 3, color: '#3a2458', dark: '#1a1028', light: '#6a4a90' }); break;
    case 'venom': P.bits(x, y, z, n, ['#8ae04a', '#c8f090', '#3a7a1a']); P.add({ kind: 'dust', x, y, z, vz: 10, max: .6, size: 2.5, color: '#8ae04a' }); break;
    default: P.sparks(x, y, z, n, ang); P.dust(x, y, 0, Math.ceil(n * .3));
  }
  void e;
}

/* =============================================================================
 * FX: the verbs. FX.x(opts) makes a live effect in ED.fx with update(dt) -> keep? and draw(r).
 * Every FX takes team ('hero' | 'foe'), src (the unit), el (element) and hit (a template: amount, kb, status...).
 * ============================================================================= */
const FX = {};
function addFx(f) { ED.fx.push(f); return f; }
function mkHit(o, extra) { return Object.assign({ src: o.src || null, amount: 1, el: o.el || 'phys' }, o.hit || {}, extra || {}); }
/** a jagged lightning polyline between two screen points (for chains, strikes, pylons) */
function zig(g, x0, y0, x1, y1, color, w = 1, jag = 4, seed = 0) {
  const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 7)); let px0 = x0, py0 = y0;
  const nx = -(y1 - y0), ny = x1 - x0, l = Math.hypot(nx, ny) || 1;
  for (let i = 1; i <= n; i++) {
    const u = i / n, off = i === n ? 0 : (E.hash2(i * 13 + seed, Math.floor(game.real * 24)) - .5) * jag * 2;
    const x = lerp(x0, x1, u) + nx / l * off, y = lerp(y0, y1, u) + ny / l * off;
    px.line(g, px0, py0, x, y, color, w); px0 = x; py0 = y;
  }
}

/* ---- projectile: bolts, orbs, blades, bones, spit, arrows; pierce, chain, fork, homing, bounce, lob ---- */
FX.bolt = o => {
  const p = addFx(Object.assign({ kind: 'bolt', team: 'hero', x: 0, y: 0, z: 10, ang: 0, speed: 240, life: 1.2, r: 3, pierce: 0, chain: 0, fork: 0, home: 0, bounce: 0, grav: 0, vz: 0, t: 0, look: {}, hitSet: new Set(), light: 36 }, o));
  p.speed *= TUNE.projSpeed; p.vx = Math.cos(p.ang) * p.speed; p.vy = Math.sin(p.ang) * p.speed;
  const lk = p.look, e = EL(p.el || 'phys'); lk.color = lk.color || e.color; lk.core = lk.core || e.light; lk.size = lk.size || 2;
  p.update = dt => {
    if (p.team === 'foe') dt *= DIFF.foeSpeed;   // (monster shots follow the Monster speed slider)
    p.t += dt; if (p.t >= p.life) { end(); return false; }
    if (p.home && p.t > .08) {   // homing: the target is looked up ten times a second (a 110 search is ~200 grid cells), not every step
      if (!p.tg || !p.tg.alive || p.hitSet.has(p.tg) || (p.rt = (p.rt || 0) - dt) <= 0) { p.rt = .1; p.tg = nearestEnemy(p.team, p.x, p.y, 110, p.hitSet); }
      const tg = p.tg; if (tg) { const a = Math.atan2(tg.y - p.y, tg.x - p.x), cur = Math.atan2(p.vy, p.vx), na = E.approachAng(cur, a, p.home * dt), sp = Math.hypot(p.vx, p.vy); p.vx = Math.cos(na) * sp; p.vy = Math.sin(na) * sp; }
    }
    if (p.grav) { p.vz -= p.grav * TUNE.gravity * dt; p.z += p.vz * dt; if (p.z <= 0) { p.z = 0; end(); return false; } }
    const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt, map = ED.L && ED.L.map;
    if (map && map.heightAt(nx, ny) > p.z) {
      if (p.bounce > 0) { p.bounce--; if (map.heightAt(nx, p.y) > p.z) p.vx = -p.vx; else p.vy = -p.vy; elBurst(p.x, p.y, p.z, p.el, 3); }
      else { elBurst(p.x, p.y, p.z, p.el, 4); end(); return false; }
    } else { p.x = nx; p.y = ny; }
    if (lk.trail !== false && Math.random() < dt * 30) trail();
    if (p.team === 'foe' && !p.nearMiss && ED.hero && ED.hero.dodgeT > .1) { const h = ED.hero; if (d2(p.x, p.y, h.x, h.y) < (h.r + p.r + 14) ** 2 && Math.abs(p.z - (h.z || 0) - 8) < 20) { p.nearMiss = true; heroNearMiss(p.src, () => -1); } }   // a shot that flies past a roll
    // hits: the first target it overlaps (all of them when piercing)
    let done = false;
    eachEnemy(p.team, p.x, p.y, p.r, u => {
      if (done || p.hitSet.has(u) || (p.z > (u.z || 0) + (u.head || 20) + 6 && !p.grav)) return;
      p.hitSet.add(u); const h = mkHit(p, { ang: Math.atan2(p.vy, p.vx), tags: (p.tags || ['proj']) });
      dealDamage(u, h); if (p.onHit) p.onHit(p, u);
      elBurst(p.x, p.y, p.z, p.el, 5, h.ang);
      if (p.fork > 0) { p.fork--; for (const s of [-1, 1]) FX.bolt(Object.assign({}, o, { x: p.x, y: p.y, z: p.z, ang: Math.atan2(p.vy, p.vx) + s * .45, fork: 0, chain: 0, hitSet: new Set(p.hitSet), life: p.life * .6 })); }
      if (p.chain > 0) { p.chain--; const nt = nearestEnemy(p.team, p.x, p.y, 100, p.hitSet); if (nt) { const a = Math.atan2(nt.y - p.y, nt.x - p.x), sp = Math.hypot(p.vx, p.vy); p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.t = Math.min(p.t, p.life * .5); return; } }
      if (p.pierce > 0) p.pierce--; else done = true;
    });
    if (p.team === 'hero' && !done) eachThing(p.x, p.y, p.r, t => { if (done || p.hitSet.has(t)) return; p.hitSet.add(t); hitThing(t, mkHit(p, { ang: Math.atan2(p.vy, p.vx) })); done = !p.pierce; });
    if (done) { end(); return false; }
    return true;
  };
  function trail() {
    if (lk.kind === 'bone' || lk.kind === 'blade') return;
    P.add({ kind: p.el === 'fire' ? 'ember' : 'dust', x: p.x, y: p.y, z: p.z, vz: 4, drag: 4, max: .25, size: 1.1, color: lk.color });
  }
  function end() { if (p.ended) return; p.ended = true; if (p.onEnd) p.onEnd(p); }
  p.draw = r => {
    if (!r.visible(p.x, p.y, p.z, 14, 14, 14)) return;
    const k = lk.kind || 'bolt', c = lk.color, core = lk.core, sz = lk.size, a = Math.atan2(p.vy, p.vx);
    r.queue(p.x, p.y, p.z, g => {
      const [x, y] = r.w(p.x, p.y, p.z), zm = r.view.zoom || 1;
      if (lk.draw) return lk.draw(g, x, y, p, r);
      if (k === 'bone' || k === 'blade') {   // a spinning stick or a spinning sword
        const sp = p.t * (k === 'blade' ? 26 : 18), L0 = (k === 'blade' ? 7 : 5) * zm, dx = Math.cos(sp) * L0, dy = Math.sin(sp) * L0 * .6;
        if (k === 'blade') { px.glow(g, 1); px.line(g, x - dx, y - dy, x + dx, y + dy, c, 2); px.line(g, x - dx * .2, y - dy * .2, x + dx, y + dy, core); px.dot(g, x + dx, y + dy, '#ffffff'); }
        else { px.line(g, x - dx, y - dy, x + dx, y + dy, '#d8cfb4', 2); px.disc(g, x - dx, y - dy, 1.2, '#efe8d4'); px.disc(g, x + dx, y + dy, 1.2, '#efe8d4'); }
        return;
      }
      px.glow(g, 1);
      const [tx, ty] = r.w(p.x - Math.cos(a) * 8, p.y - Math.sin(a) * 8, p.z + (p.grav ? p.vz * .02 : 0));
      if (k === 'arrow') { px.line(g, tx, ty, x, y, '#b09070', 1); px.dot(g, x, y, core); return; }
      if (k === 'spit') { px.disc(g, x, y, sz * zm, c); px.dot(g, x - 1, y - 1, core); return; }
      if (k === 'orb') { r.glowDisc(g, x, y, sz * 3 * zm, c, .5); px.disc(g, x, y, sz * 1.3 * zm, c); px.disc(g, x - .5, y - .5, sz * .7 * zm, core); return; }
      px.line(g, tx, ty, x, y, c, Math.max(1, Math.round(sz * zm * .8)));
      px.ddisc(g, x, y, sz * 2.4 * zm, c, .5, r.ix, r.iy); px.disc(g, x, y, sz * zm, c); px.dot(g, x, y, core);
    }, { emissive: k !== 'bone', bias: .3 });
    if (p.light) L.add(p.x, p.y, p.z, p.light, .7, { color: c });
  };
  return p;
};

/* ---- nova: a ring that expands from a point and hits what its front crosses ---- */
FX.nova = o => {
  const f = addFx(Object.assign({ kind: 'nova', team: 'hero', x: 0, y: 0, r0: 4, r1: 50, dur: .35, t: 0, set: new Set(), z: 0 }, o));
  const e = EL(f.el || 'phys'), col = f.color || e.color;
  f.update = dt => {
    f.t += dt; const u = Math.min(1, f.t / f.dur), R = lerp(f.r0, f.r1, E.ease.outQuad(u));
    hitCircle(f.team, f.x, f.y, R, v => { if (f.onHit) f.onHit(v, f); return mkHit(f, { ang: Math.atan2(v.y - f.y, v.x - f.x), tags: f.tags || ['aoe'] }); }, f.set);
    if (f.onTick) f.onTick(f, R);
    return f.t < f.dur + .15;
  };
  f.draw = r => {
    const u = Math.min(1, f.t / f.dur), R = lerp(f.r0, f.r1, E.ease.outQuad(u)), a = 1 - Math.max(0, (f.t - f.dur) / .15);
    r.decal(() => { r.groundRing(f.x, f.y, R, col, .9 * a, f.z); r.groundRing(f.x, f.y, R - 1.5, e.light, .6 * a, f.z); r.groundDisc(f.x, f.y, R, col, .18 * a * (1 - u), f.z); }, { emissive: .8 });
    if (u < 1) L.add(f.x, f.y, 6, R + 20, .6 * (1 - u), { color: col });
  };
  elBurst(f.x, f.y, 4, f.el, 10);
  return f;
};

/* ---- area: lingering ground (fire, frost field, void pool, venom puddle, storm field), ticks its hit ---- */
FX.area = o => {
  const f = addFx(Object.assign({ kind: 'area', team: 'hero', x: 0, y: 0, r: 20, dur: 3, tick: .5, t: 0, nt: 0, z: 0 }, o));
  const e = EL(f.el || 'phys'), col = f.color || e.color;
  f.update = dt => {
    f.t += dt; f.nt -= dt;
    if (f.follow && f.follow.alive) { f.x = f.follow.x; f.y = f.follow.y; }
    if (f.nt <= 0) { f.nt = f.tick; if (f.hit) hitCircle(f.team, f.x, f.y, f.r, v => mkHit(f, { kb: 0, noNumber: false, tags: f.tags || ['area', 'dot'] })); if (f.onTick) f.onTick(f); }
    if (Math.random() < dt * f.r * .25) {
      const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * f.r, x = f.x + Math.cos(a) * d, y = f.y + Math.sin(a) * d;
      if (f.el === 'fire') P.add({ kind: 'fire', x, y, z: 1, vz: 18, g: -8, drag: 3, max: .45, size: 2.4 });
      else if (f.el === 'frost') P.glints(x, y, 2, 1, '#e8fbff', 3);
      else if (f.el === 'void') P.add({ kind: 'ember', x, y, z: 1, vz: 22, max: .8, color: '#b070ff' });
      else if (f.el === 'venom') P.add({ kind: 'dust', x, y, z: 1, vz: 8, g: -4, drag: 2, max: .7, size: 1.6, color: '#8ae04a' });
      else if (f.el === 'storm') P.sparks(x, y, 1, 1, null, { color: '#ffe45a' });
    }
    return f.t < f.dur;
  };
  f.draw = r => {
    const fade = Math.min(1, (f.dur - f.t) * 3, f.t * 6), pul = .5 + .5 * Math.sin(game.time * 6 + f.x);
    r.decal(() => {
      r.groundDisc(f.x, f.y, f.r, e.dark, .35 * fade, f.z);
      r.groundDisc(f.x, f.y, f.r * (.72 + .08 * pul), col, .3 * fade, f.z);
      r.groundRing(f.x, f.y, f.r, col, .7 * fade, f.z);
      if (f.el === 'frost') for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + f.x, d = f.r * .6; r.groundDisc(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, 2.2, '#e8fbff', .6 * fade, f.z); }
    }, { emissive: .5 * fade });
    if (f.light !== false) L.add(f.x, f.y, 4, f.r + 24, .45 * fade, { color: col });
  };
  return f;
};

/* ---- telegraph: a warning shape that fills, then fires then() (enemy attacks, meteors, strikes) ---- */
// shape: 'circle' { r } | 'arc' { r, ang, half } | 'line' { ang, len, w } | 'ring' { r0, r1 }
FX.telegraph = o => {
  const f = addFx(Object.assign({ kind: 'tele', shape: 'circle', x: 0, y: 0, r: 20, dur: .7, t: 0, color: '#ff4a3a' }, o));
  f.update = dt => {
    f.t += dt * foeClock(f.owner || f.src);   // a monster's warning fills at its own clock (the speed slider, time wells)
    if (f.follow && f.follow.alive) { f.x = f.follow.x; f.y = f.follow.y; if (f.followAng) f.ang = f.follow.facing; } if (f.t >= f.dur) { if (!f.cancelled && (!f.owner || f.owner.alive)) { teleNearMiss(f); if (f.then) f.then(f); } return false; } return !f.cancelled && (!f.owner || f.owner.alive); };
  f.draw = r => {
    const u = clamp(f.t / f.dur, 0, 1), c = f.color, a = .2 + .5 * u;
    r.decal(() => {
      if (f.shape === 'circle') { r.groundDisc(f.x, f.y, f.r * u, c, a * .8); r.groundRing(f.x, f.y, f.r, c, .5 + .4 * u); }
      else if (f.shape === 'arc') r.groundArc(f.x, f.y, 2, 2 + (f.r - 2) * u, f.ang - f.half, f.ang + f.half, c, a);
      else if (f.shape === 'ring') { r.groundRing(f.x, f.y, f.r0, c, .6); r.groundRing(f.x, f.y, f.r1, c, .6); r.groundArc(f.x, f.y, f.r0, lerp(f.r0, f.r1, u), 0, TAU, c, a * .7); }
      else if (f.shape === 'line') {
        const ca = Math.cos(f.ang), sa = Math.sin(f.ang), w = f.w / 2, Lx = f.len * u, g = r.tgt;
        const pts = [[0, -w], [Lx, -w], [Lx, w], [0, w]].map(([a0, b]) => r.w(f.x + ca * a0 - sa * b, f.y + sa * a0 + ca * b, 0));
        px.polyDither(g, pts, c, a, r.ix, r.iy);
        const out = [[0, -w], [f.len, -w], [f.len, w], [0, w]].map(([a0, b]) => r.w(f.x + ca * a0 - sa * b, f.y + sa * a0 + ca * b, 0));
        for (let i = 0; i < 4; i++) { const A0 = out[i], B = out[(i + 1) % 4]; px.line(g, A0[0], A0[1], B[0], B[1], c); }
      }
    }, { emissive: .3 + .4 * u });
  };
  return f;
};

/** a hostile warning goes off: how far outside its shape the hero stands (a roll just then, even away from it, is a
 *  perfect dodge: heroNearMiss in 20-hero.js). The hero's own warnings (FX.strike / FX.meteor with team 'hero') don't count */
function teleNearMiss(f) {
  const h = ED.hero; if (!h || !(h.dodgeT > .1) || h.perfectT || f.team === 'hero' || (f.owner && f.owner.team === 'hero')) return;
  heroNearMiss(f.owner || f.src, (x, y) => {
    const dx = x - f.x, dy = y - f.y, d = Math.hypot(dx, dy);
    if (f.shape === 'circle') return d - f.r;
    if (f.shape === 'ring') return Math.max(f.r0 - d, d - f.r1);
    if (f.shape === 'arc') return Math.abs(E.angDiff(f.ang, Math.atan2(dy, dx))) <= f.half + .35 ? d - f.r : 99;
    if (f.shape === 'line') { const ca = Math.cos(f.ang), sa = Math.sin(f.ang), al = dx * ca + dy * sa, sd = Math.abs(-dx * sa + dy * ca); return al < 0 ? Math.hypot(al, Math.max(0, sd - f.w / 2)) : al > f.len ? Math.hypot(al - f.len, Math.max(0, sd - f.w / 2)) : sd - f.w / 2; }
    return 99;
  });
}

/* ---- strike: lightning (or any element) from the sky at a point after a short warning ---- */
FX.strike = o => {
  const f = Object.assign({ team: 'hero', x: 0, y: 0, r: 14, delay: .45, el: 'storm' }, o);
  const warn = FX.telegraph({ shape: 'circle', x: f.x, y: f.y, r: f.r, dur: f.delay, team: f.team, src: f.src, color: f.team === 'hero' ? EL(f.el).color : '#ff4a3a', then() {
    const b = addFx({ kind: 'strikeBolt', t: 0, update: dt => (b.t += dt) < .18, draw: r => {
      r.queue(f.x, f.y, 0, g => { const [x0, y0] = r.w(f.x, f.y, 150), [x1, y1] = r.w(f.x, f.y, 0); px.glow(g, 1); zig(g, x0, y0, x1, y1, EL(f.el).color, 3, 7, f.x | 0); zig(g, x0, y0, x1, y1, '#ffffff', 1, 7, f.x | 0); }, { emissive: true, bias: .5 });
      L.add(f.x, f.y, 20, 90, 1.4 * (1 - b.t / .18), { color: EL(f.el).glow });
    } });
    hitCircle(f.team, f.x, f.y, f.r, u => { if (f.onHit) f.onHit(u, f); return mkHit(f, { ang: Math.atan2(u.y - f.y, u.x - f.x), tags: f.tags || ['aoe', 'spell'] }); });
    elBurst(f.x, f.y, 2, f.el, 12); P.ring(f.x, f.y, 2, f.r + 6, EL(f.el).light, .3); shake(2.5); sfx('zap');
    if (f.then) f.then(f);
  } });
  return warn;
};

/* ---- meteor: a warned circle, a fireball falling out of the sky, an explosion (and optional burning ground) ---- */
FX.meteor = o => {
  const f = Object.assign({ team: 'hero', x: 0, y: 0, r: 24, delay: .8, el: 'fire', size: 1 }, o);
  const m = addFx({ kind: 'meteor', t: 0, update: dt => { m.t += dt; if (m.t >= f.delay) { land(); return false; } return true; }, draw: r => {
    const u = m.t / f.delay, z = 240 * (1 - u) * (1 - u) + 2, x = f.x - 60 * (1 - u), y = f.y - 30 * (1 - u);
    r.queue(x, y, z, g => { const [sx, sy] = r.w(x, y, z), [tx, ty] = r.w(x - 16, y - 8, z + 30), s = 3.5 * f.size * (r.view.zoom || 1); px.glow(g, 1); px.line(g, sx, sy, tx, ty, EL(f.el).color, Math.round(s)); r.glowDisc(g, sx, sy, s * 3, EL(f.el).glow, .6); px.disc(g, sx, sy, s * 1.3, EL(f.el).color); px.disc(g, sx - 1, sy - 1, s * .7, EL(f.el).light); }, { emissive: true });
    L.add(x, y, z, 60, .8, { color: EL(f.el).glow });
    if (Math.random() < .5) P.add({ kind: f.el === 'fire' ? 'fire' : 'ember', x, y, z, vz: 10, max: .3, size: 3, color: EL(f.el).color });
  } });
  FX.telegraph({ shape: 'circle', x: f.x, y: f.y, r: f.r, dur: f.delay, team: f.team, src: f.src, color: f.team === 'hero' ? EL(f.el).color : '#ff4a3a' });
  function land() {
    hitCircle(f.team, f.x, f.y, f.r, u => { if (f.onHit) f.onHit(u, f); return mkHit(f, { ang: Math.atan2(u.y - f.y, u.x - f.x), kb: 160, up: 90, tags: ['aoe', 'spell'] }); });
    if (f.el === 'fire') P.explosion(f.x, f.y, 4, 1.2 * f.size, { flash: false }); else { elBurst(f.x, f.y, 4, f.el, 20); sfx('explode'); }
    P.ring(f.x, f.y, 4, f.r + 10, EL(f.el).light, .4); shake(4);
    if (f.burn) FX.area({ team: f.team, src: f.src, x: f.x, y: f.y, r: f.r * .8, dur: f.burn, el: f.el, tick: .5, hit: { amount: (f.hit && f.hit.amount || 10) * .15, statusChance: .5 } });
    if (f.then) f.then(f);
  }
  return m;
};

/* ---- chain: lightning that hops from a unit to the nearest others; visual arcs plus damage ---- */
FX.chain = o => {
  const f = Object.assign({ team: 'hero', from: null, x: 0, y: 0, z: 10, hops: 4, range: 80, el: 'storm', set: new Set() }, o);
  const pts = [[f.from ? f.from.x : f.x, f.from ? f.from.y : f.y, f.from ? (f.from.z || 0) + 12 : f.z]];
  let cur = f.first || nearestEnemy(f.team, pts[0][0], pts[0][1], f.range, f.set);
  for (let i = 0; i < f.hops && cur; i++) {
    f.set.add(cur); pts.push([cur.x, cur.y, (cur.z || 0) + (cur.head || 20) * .55]);
    dealDamage(cur, mkHit(f, { ang: Math.random() * TAU, tags: ['spell', 'chain'], amount: (f.hit && f.hit.amount || 10) * Math.pow(f.falloff || .9, i) }));
    elBurst(cur.x, cur.y, (cur.head || 20) * .5, f.el, 4);
    cur = nearestEnemy(f.team, cur.x, cur.y, f.range, f.set);
  }
  if (pts.length < 2) return null;
  sfx('zap', { vol: .7 });
  const v = addFx({ kind: 'chain', t: 0, update: dt => (v.t += dt) < .28, draw: r => {
    const a = 1 - v.t / .28;
    r.queue(pts[0][0], pts[0][1], 40, g => { px.glow(g, 1); for (let i = 1; i < pts.length; i++) { const [x0, y0] = r.w(...pts[i - 1]), [x1, y1] = r.w(...pts[i]); if (a > .3) zig(g, x0, y0, x1, y1, EL(f.el).color, 2, 5, i * 17); zig(g, x0, y0, x1, y1, '#ffffff', 1, 5, i * 17); } }, { emissive: true, bias: 2 });
    for (const q of pts) L.add(q[0], q[1], q[2], 40, .8 * a, { color: EL(f.el).glow });
  } });
  return v;
};

/* ---- beam: a sustained line from a point (or a unit) that sweeps; stops at walls; ticks damage ---- */
FX.beam = o => {
  const f = addFx(Object.assign({ kind: 'beam', team: 'foe', x: 0, y: 0, z: 14, ang: 0, turn: 0, len: 160, w: 6, dur: 1.5, tick: .15, t: 0, nt: 0, el: 'fire' }, o));
  const e = EL(f.el);
  f.update = dt => {
    f.t += dt; f.nt -= dt; f.ang += f.turn * dt;
    if (f.from) { if (!f.from.alive) return false; f.x = f.from.x; f.y = f.from.y; if (f.aimFrom) f.ang = f.from.facing; }
    // raycast to the first wall
    const map = ED.L && ED.L.map; let Lx = f.len;
    if (map) for (let s = 4; s < f.len; s += 4) if (map.heightAt(f.x + Math.cos(f.ang) * s, f.y + Math.sin(f.ang) * s) > f.z) { Lx = s; break; }
    f.reach = Lx;
    if (f.nt <= 0 && f.t > (f.warm || 0)) {
      f.nt = f.tick; const ca = Math.cos(f.ang), sa = Math.sin(f.ang);
      const targets = enemiesOf(f.team), test = u => { const dx = u.x - f.x, dy = u.y - f.y, along = dx * ca + dy * sa, side = Math.abs(-dx * sa + dy * ca); return along > 0 && along < Lx && side < f.w / 2 + u.r; };
      if (f.team === 'hero') { const mid = Lx / 2; eachEnemy('hero', f.x + ca * mid, f.y + sa * mid, mid + 10, u => { if (test(u)) dealDamage(u, mkHit(f, { ang: f.ang, kb: 10, tags: ['beam', 'spell'] })); }); }
      else for (const u of targets) if (test(u)) dealDamage(u, mkHit(f, { ang: f.ang, kb: 30 }));
    }
    return f.t < f.dur;
  };
  f.draw = r => {
    const warm = f.warm && f.t < f.warm, Lx = f.reach || f.len, ca = Math.cos(f.ang), sa = Math.sin(f.ang), zm = r.view.zoom || 1;
    if (warm) { r.decal(() => { const g = r.tgt, a0 = r.w(f.x, f.y, 0), b0 = r.w(f.x + ca * Lx, f.y + sa * Lx, 0); px.blend(g, .5, 'normal', () => px.line(g, a0[0], a0[1], b0[0], b0[1], '#ff4a3a', 1)); }); return; }
    r.queue(f.x + ca * Lx * .5, f.y + sa * Lx * .5, f.z, g => {
      const [x0, y0] = r.w(f.x, f.y, f.z), [x1, y1] = r.w(f.x + ca * Lx, f.y + sa * Lx, f.z), wob = Math.sin(game.time * 40) * .6;
      px.glow(g, 1); px.blend(g, .5, 'add', () => px.line(g, x0, y0, x1, y1, e.color, Math.round((f.w + 2 + wob) * zm)));
      px.line(g, x0, y0, x1, y1, e.color, Math.max(1, Math.round(f.w * .6 * zm))); px.line(g, x0, y0, x1, y1, e.light, Math.max(1, Math.round(f.w * .25 * zm)));
      r.glowDisc(g, x1, y1, 8 * zm, e.glow, .6);
    }, { emissive: true, bias: 1 });
    if (Math.random() < .5) elBurst(f.x + ca * Lx, f.y + sa * Lx, f.z * .5, f.el, 2);
    for (let s = 0; s < Lx; s += 40) L.add(f.x + ca * s, f.y + sa * s, f.z, 50, .5, { color: e.glow });
  };
  return f;
};

/* ---- wave: a front that travels along the ground (fissures, fire walls, ice spikes); hits each unit once ---- */
FX.wave = o => {
  const f = addFx(Object.assign({ kind: 'wave', team: 'hero', x: 0, y: 0, ang: 0, speed: 220, len: 120, w: 16, t: 0, set: new Set(), el: 'phys', marks: [] }, o));
  const e = EL(f.el);
  f.update = dt => {
    f.t += dt; const d = Math.min(f.len, f.t * f.speed), map = ED.L && ED.L.map;
    const hx = f.x + Math.cos(f.ang) * d, hy = f.y + Math.sin(f.ang) * d;
    if (map && map.solidAt(hx, hy)) f.len = Math.min(f.len, d);
    hitCircle(f.team, hx, hy, f.w / 2, u => { if (f.onHit) f.onHit(u, f); return mkHit(f, { ang: f.ang, up: f.up || 0, tags: ['aoe', 'wave'] }); }, f.set);
    if (!f.last || d - f.last > 7) { f.last = d; f.marks.push({ x: hx + (Math.random() - .5) * 6, y: hy + (Math.random() - .5) * 6, t: game.time }); elBurst(hx, hy, 2, f.el, 3); }
    return f.t * f.speed < f.len + 60 || game.time - (f.marks.length ? f.marks[f.marks.length - 1].t : 0) < .6;
  };
  f.draw = r => {
    for (const m of f.marks) {
      const age = game.time - m.t, a = clamp(1 - age / .7, 0, 1); if (a <= 0) continue;
      const h = (f.el === 'frost' ? 10 : f.el === 'fire' ? 9 : 6) * Math.sin(Math.min(1, age * 6) * Math.PI * .5) * a;
      r.queue(m.x, m.y, 0, g => {
        const [x, y] = r.w(m.x, m.y, 0), [tx, ty] = r.w(m.x, m.y, h), zm = r.view.zoom || 1;
        if (f.el === 'fire') { px.glow(g, 1); px.poly(g, [[x - 3 * zm, y], [tx, ty], [x + 3 * zm, y]], e.color); px.poly(g, [[x - 1.5 * zm, y], [tx, ty + 2], [x + 1.5 * zm, y]], e.light); }
        else if (f.el === 'frost') { px.poly(g, [[x - 2.5 * zm, y], [tx, ty], [x + 2.5 * zm, y]], '#bfefff'); px.line(g, x - 1, y, tx, ty, '#ffffff'); }
        else { px.poly(g, [[x - 3 * zm, y], [tx - 1, ty], [tx + 1, ty], [x + 3 * zm, y]], e.dark); px.line(g, x - 2, y, tx - 1, ty, e.color); }
      }, { emissive: f.el !== 'phys' });
    }
  };
  return f;
};

/* ---- pull: a vortex that drags enemies of the team toward a point ---- */
FX.pull = o => {
  const f = addFx(Object.assign({ kind: 'pull', team: 'hero', x: 0, y: 0, r: 60, force: 220, dur: 1.2, t: 0, el: 'void' }, o));
  f.update = dt => {
    f.t += dt;
    eachEnemy(f.team, f.x, f.y, f.r, u => { if (u.boss) return; const a = Math.atan2(f.y - u.y, f.x - u.x), d = Math.hypot(f.x - u.x, f.y - u.y); if (d > 4) { const k = f.force * dt * Math.min(1, d / 20) / (u.mass || 1); u.x += Math.cos(a) * k * .35; u.y += Math.sin(a) * k * .35; u.vx *= .9; u.vy *= .9; } });
    if (Math.random() < .6) { const a = Math.random() * TAU, d = f.r * (.6 + Math.random() * .4); P.add({ kind: 'ember', x: f.x + Math.cos(a) * d, y: f.y + Math.sin(a) * d, z: 2 + Math.random() * 10, vx: -Math.cos(a) * d * 1.6 + Math.cos(a + 1.5) * 40, vy: -Math.sin(a) * d * 1.6 + Math.sin(a + 1.5) * 40, drag: 1, max: .5, color: EL(f.el).color }); }
    if (f.onTick) f.onTick(f, dt);
    return f.t < f.dur;
  };
  f.draw = r => {
    const u = f.t / f.dur, a = Math.min(1, (1 - u) * 4, f.t * 5), sp = game.time * 5;
    r.decal(() => { for (let k = 0; k < 3; k++) r.groundArc(f.x, f.y, f.r * (.3 + k * .22), f.r * (.3 + k * .22) + 3, sp + k * 2, sp + k * 2 + 2.2, EL(f.el).color, .5 * a); r.groundDisc(f.x, f.y, 8, EL(f.el).dark, .7 * a); }, { emissive: .6 });
    L.add(f.x, f.y, 6, f.r + 20, .5 * a, { color: EL(f.el).glow });
  };
  return f;
};

/* ---- scorch: a fading mark on the floor (after explosions, slams, landings) ---- */
FX.scorch = (x, y, r0, color = '#1a1016', dur = 4) => {
  const f = addFx({ kind: 'scorch', t: 0, update: dt => (f.t += dt) < dur, draw: r => { const a = .55 * clamp((dur - f.t) / 1.5, 0, 1); r.decal(() => { r.groundDisc(x, y, r0, color, a); r.groundDisc(x + 2, y - 1, r0 * .6, color, a * .8); }); } });
  return f;
};

/* ---- simple timed visual: FX.visual(dur, draw(r, u)) for one-off flourishes ---- */
FX.visual = (dur, drawFn, upd) => { const f = addFx({ kind: 'visual', t: 0, update: dt => { f.t += dt; if (upd) upd(f, dt); return f.t < dur; }, draw: r => drawFn(r, f.t / dur, f) }); return f; };

function updateFx(dt) { const L0 = ED.fx; for (let i = L0.length - 1; i >= 0; i--) { let keep = false; try { keep = L0[i].update(dt); } catch (e) { game._fail('fx ' + L0[i].kind, e); } if (!keep) L0.splice(i, 1); } }
function drawFx(r) { for (const f of ED.fx) if (f.draw) f.draw(r); }
