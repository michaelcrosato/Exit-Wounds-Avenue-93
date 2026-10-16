/* =============================================================================
 * AUTOPILOT: a bot that plays the hero (balance runs, soak tests, and the title screen's attract mode)
 * It drives a virtual input (h.bot.input) the hero controller reads instead of the keyboard: a world move
 * direction, an aim point, and the slot / dodge / potion presses. It picks the nearest foe it can actually reach
 * (path distance on the level's flow field, so nothing across a chasm or inside a wall), gives up on a target it
 * cannot hurt, rolls out of telegraphs, wind-ups and shots (and sometimes THROUGH a blow for a perfect dodge),
 * walks out of burning ground, spends AoE on crowds, mobility on gaps and ultimates on elites, holds channels,
 * drinks when low, loots, spends points, equips upgrades, and takes the waystone once the depth is mostly clear.
 *   window.__ed.bot(true)   take over the current hero        __ed.botRun({ to: 10, speed: 3 }) play depths down to 10
 * ============================================================================= */
function makeBotInput() {
  return { aimSource: 'bot', aimAt: null, worldMove: [0, 0], padAim: null, _p: {}, _d: {},
    move() { return [0, 0]; }, buffered(a) { return !!this._p[a]; }, consume(a) { this._p[a] = false; }, pressed(a) { return !!this._p[a]; }, released() { return false; },
    down(a) { return !!this._d[a]; }, repeat() { return false; }, press(a) { this._p[a] = true; }, clear() { this._p = {}; } };
}
function botOn(h, on = true) {
  if (!h) return;
  h.bot = on ? { input: makeBotInput(), flow: null, ft: [-1, -1], t: 0, stuck: 0, stuckSum: 0, side: 1, lx: h.x, ly: h.y, goal: null, think: 0, log: [], ignore: new Map(), tgt: null, tgtT: 0, lastHit: 0, L: null, total: 1, holdT: 0, retreat: 0 } : null;
}
/* ---------- the ground: what the bot may walk or roll onto ---------- */
const BOT_BAD_FLOOR = { pit: 1, deep: 1, lava: 1 };
function botWalkable(L0, x, y) {
  const M = L0.map, cx = Math.floor(x / T16), cy = Math.floor(y / T16);
  if (cx < 0 || cy < 0 || cx >= M.w || cy >= M.h) return false;
  if (M.walkable ? !M.walkable(cx, cy) : M.solidCell(cx, cy)) return false;
  return !BOT_BAD_FLOOR[M.floorAt(x, y)];
}
/** the closest direction to a (tried in widening fans) whose roll or step lands on safe ground */
function botSafeDir(h, a, reach = 38) {
  const L0 = ED.L; if (!L0 || !L0.map) return a;
  for (const k of [0, .5, -.5, 1, -1, 1.6, -1.6, 2.4, -2.4, Math.PI]) {
    const b = a + k; let ok = true;
    for (const s of [.4, .7, 1]) if (!botWalkable(L0, h.x + Math.cos(b) * reach * s, h.y + Math.sin(b) * reach * s)) { ok = false; break; }
    if (ok) return b;
  }
  return a;
}
/** out of burning ground (lava): the nearest safe footing, favouring the way it was going. It used to step straight back
 *  the way it came, then walk on into the same fissure, and burned to death wading to and fro across it */
function botLavaOut(h, goalA) {
  const L0 = ED.L; let best = null, bs = 1e9;
  for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; for (let d = 6; d <= 54; d += 6) if (botWalkable(L0, h.x + Math.cos(a) * d, h.y + Math.sin(a) * d)) { const sc = d - 14 * Math.cos(E.angDiff(a, goalA)); if (sc < bs) { bs = sc; best = { a, d }; } break; } }
  return best;
}
/** lava a step ahead along a, and safe ground past it within a roll: a fissure a player rolls over instead of wading in */
function botFissure(h, a) { const L0 = ED.L, c = Math.cos(a), s = Math.sin(a); if (L0.map.floorAt(h.x + c * 9, h.y + s * 9) !== 'lava') return false; for (let d = 14; d <= 34; d += 4) if (botWalkable(L0, h.x + c * d, h.y + s * d)) return true; return false; }
/** is something about to land on the hero? { from: [x, y], kind: 'tele' | 'swing' | 'shot' | 'ground', perfect } or null */
function botDanger(h) {
  for (const f of ED.fx) {
    if (f.kind === 'tele' && !f.cancelled && f.t > f.dur * .25) {
      if (f.shape === 'circle' && Math.hypot(h.x - f.x, h.y - f.y) < f.r + h.r + 2) return { from: [f.x, f.y], kind: 'tele' };
      if (f.shape === 'arc' && E.inArc(f, f.ang, h, f.r, f.half)) return { from: [f.x, f.y], kind: 'tele' };
      if (f.shape === 'line') { const ca = Math.cos(f.ang), sa = Math.sin(f.ang), dx = h.x - f.x, dy = h.y - f.y, al = dx * ca + dy * sa, sd = -dx * sa + dy * ca; if (al > 0 && al < f.len && Math.abs(sd) < f.w / 2 + h.r + 2) return { from: [h.x - sa * Math.sign(sd || 1) * 10, h.y + ca * Math.sign(sd || 1) * 10], kind: 'tele' }; }
    } else if (f.kind === 'bolt' && f.team === 'foe') {   // a shot on course: along its path, closing, near its line
      const ca = Math.cos(f.ang), sa = Math.sin(f.ang), dx = h.x - f.x, dy = h.y - f.y, al = dx * ca + dy * sa, sd = Math.abs(-dx * sa + dy * ca);
      if (al > 0 && al < 46 && sd < h.r + (f.r || 3) + 3) {   // decided once per shot: most are tanked (a player swings through chip damage), more when hurt
        if (f._bot === undefined) f._bot = Math.random() < (h.hp < h.maxHp * .5 ? .75 : .3);
        if (f._bot) return { from: [f.x, f.y], kind: 'shot', perfect: al < 18 };
      }
    } else if (f.kind === 'area' && f.team === 'foe' && Math.hypot(h.x - f.x, h.y - f.y) < (f.r || 20) + h.r) return { from: [f.x, f.y], kind: 'ground' };
  }
  for (const m of ED.foes) if (m.alive && m.atk && m.atk.phase === 'wind' && Math.hypot(m.x - h.x, m.y - h.y) < 30 + (m.r || 5)) {
    const A0 = m.atk, r = Math.random();   // decided once per swing: roll late THROUGH it (a perfect dodge), early out of it, or trade blows (trash, healthy)
    if (A0._bot === undefined) A0._bot = r < .3 ? 'perfect' : r < .75 || m.elite || m.boss || h.hp < h.maxHp * .5 ? 'early' : 'tank';
    if (A0._bot === 'perfect' ? A0.u > .8 : A0._bot === 'early' ? A0.u > .45 : false) return { from: [m.x, m.y], kind: 'swing', perfect: A0._bot === 'perfect' };
  }
  if (ED.L && ED.L.map && ED.L.map.floorAt(h.x, h.y) === 'lava') return { from: [h.x, h.y], kind: 'ground', lava: true };
  return null;
}
function botScore(it) { if (!it) return -1; const w = it.dmg ? (it.dmg[0] + it.dmg[1]) * 1.5 : 0; return it.rarity * 12 + it.ilvl * 3 + w + it.affixes.length * 3 + (it.armor || 0) * .3; }
function botManage(h) {
  // equip upgrades from the bag
  for (const it of h.bag.slice()) { const slot = it.slot === 'ring' ? (!h.gear.ring ? 'ring' : !h.gear.ring2 ? 'ring2' : botScore(h.gear.ring) < botScore(h.gear.ring2) ? 'ring' : 'ring2') : it.slot; if (botScore(it) > botScore(h.gear[slot]) + 2) equip(h, it, slot); }
  while (h.bag.length > 30) { const it = h.bag.shift(); gainGold(h, it.value); }   // sells the rest (the bot has no patience for shops)
  // learn skills: fill empty slots with unlocked skills, then rank up what is slotted
  const known = Object.keys(REG.skills).filter(id => skillAvailable(h, REG.skills[id]) && (REG.skills[id].unlock || 1) <= h.level);
  let guard = 20;
  while (h.pts.skill > 0 && guard-- > 0) {
    const empty = h.slots.findIndex((s, i) => !s && i > 0), fresh = known.filter(id => !(h.skills[id] && h.skills[id].rank) && !REG.skills[id].noAuto);
    if (empty > 0 && fresh.length) { const id = rnd.pick(fresh); h.skills[id] = { rank: 1 }; h.slots[empty] = id; h.pts.skill--; continue; }
    const up = h.slots.filter(Boolean).filter(id => h.skills[id] && h.skills[id].rank < 5);
    if (!up.length) break; const id = rnd.pick(up); h.skills[id].rank++; h.pts.skill--;
    if (h.skills[id].rank >= 2 && !h.skills[id].rune && REG.skills[id].runes) h.skills[id].rune = rnd.pick(REG.skills[id].runes).id;
  }
  if (h.pts.skill > 0 && typeof autoAllocateMastery === 'function') autoAllocateMastery(h);   // every slotted skill at rank 5: mastery
  if (h.pts.passive > 0 && typeof autoAllocatePassives === 'function') autoAllocatePassives(h);
  computeStats(h);
}
/** foes within r of a point, and their centre (AoE skills aim at the thick of a pack, not at its edge) */
function botCrowd(x, y, r) { let n = 0, sx = 0, sy = 0; for (const m of ED.foes) if (m.alive && !m.untargetable && Math.hypot(m.x - x, m.y - y) < r) { n++; sx += m.x; sy += m.y; } return { n, x: n ? sx / n : x, y: n ? sy / n : y }; }
/** one bot decision per step: returns nothing, fills h.bot.input */
function botThink(h, dt) {
  const B = h.bot, I = B.input, L0 = ED.L; I.clear(); I._d = {};
  if (!L0 || !L0.map || !h.alive) return;
  B.t += dt; B.think -= dt;
  if (B.L !== L0) { B.L = L0; B.total = Math.max(1, ED.foes.filter(m => m.alive).length); B.ignore.clear(); B.flow = null; B.ft = [-1, -1]; B.tgt = null; B.stuckSum = 0; }
  if (B.think <= 0) { B.think = .5; botManage(h); }
  // drink when low (sooner facing a boss, whose blows come in pairs: at a third of his life one combo was his last)
  const B0 = ED.boss, bossNear = B0 && B0.alive && !B0.dormant && Math.hypot(B0.x - h.x, B0.y - h.y) < 160;
  if (h.hp < h.maxHp * (bossNear ? .5 : .38) && h.potions > 0 && h.potionT <= 0) I.press('potion');
  // danger: roll out of telegraphs, swings and shots (sometimes through a swing, for the perfect dodge); walk out of burning ground
  let dodge = false, avoid = null;
  const dz = botDanger(h);
  if (dz && dz.kind === 'ground') avoid = dz;
  else if (dz && h.dodges > 0 && h.dodgeT <= 0 && (!h.act || h.act.cancel !== false)) {
    const toward = Math.atan2(dz.from[1] - h.y, dz.from[0] - h.x);
    let a = dz.perfect ? toward + (Math.random() - .5) * .5 : toward + Math.PI + (Math.random() < .5 ? .6 : -.6);
    a = botSafeDir(h, a);
    I.worldMove = [Math.cos(a), Math.sin(a)]; I.press('dodge'); I.aimAt = [h.x + Math.cos(a) * 30, h.y + Math.sin(a) * 30]; dodge = true;
  }
  if (dodge) return;
  // the target: the nearest foe by PATH (the level's flow field leads to the hero, so its distances are ours); a foe across a
  // chasm or inside a wall only counts within a sword's reach; foes we could not hurt for a while are ignored for a bit
  const F = L0.flow, MW = L0.map.w, MH = L0.map.h;
  const pathD = m => { if (!F || !F.d) return null; const cx = Math.floor(m.x / T16), cy = Math.floor(m.y / T16); return cx < 0 || cy < 0 || cx >= MW || cy >= MH ? 1e9 : F.d[cy * MW + cx]; };
  let foe = null, fp = 1e9, alive = 0;
  for (const m of ED.foes) {
    if (!m.alive) continue; alive++;
    const e = Math.hypot(m.x - h.x, m.y - h.y);
    if (m.spawnT > 0 || m.untargetable || (m.fade !== undefined && m.fade < .2 && !m.boss && e > 30) || (B.ignore.get(m) || 0) > B.t) continue;   // unseen in the dark, unless it is at arm's length
    const p = pathD(m), d = p === null ? e : p < 1e9 ? Math.max(e, p * T16 * .85) : e < 32 + (m.r || 5) ? e : m.boss ? e * 1.5 + 200 : 1e9;
    if (d < fp) { fp = d; foe = m; }
  }
  if (foe !== B.tgt) { B.tgt = foe; B.tgtT = 0; B.stuckSum = 0; } else B.tgtT += dt;
  if (foe && B.tgtT > 9 && B.t - B.lastHit > 7) { B.ignore.set(foe, B.t + 25); B.tgt = null; }   // chased it for 9 s without landing a blow: something is in the way
  const fd = foe ? Math.hypot(foe.x - h.x, foe.y - h.y) : 1e9;
  // done here? once most of the depth is down (or it has taken long enough), the waystone; only what blocks the way is fought
  const exitOpen = L0.exit && L0.exit.open, leave = exitOpen && (alive <= B.total * .4 || (L0.t || 0) > 150 || !foe);
  const near = foe && fp < (leave ? 50 : 170);
  let goal = null, obj = null;
  if (near) { goal = [foe.x, foe.y]; obj = foe; }
  else if (!leave) {   // loot on safe ground nearby (an item on lava or in a wall is not worth a life, or an afternoon)
    const d0 = ED.drops.filter(d => d.kind === 'item' && d.rest && labelShown(d) && !((B.ignore.get(d) || 0) > B.t) && botWalkable(L0, d.x, d.y)).sort((a, b) => dist2(a, h) - dist2(b, h))[0];
    if (d0 && Math.hypot(d0.x - h.x, d0.y - h.y) < 120 && h.bag.length < BAG_MAX) { goal = [d0.x, d0.y]; obj = d0; }
  }
  if (!goal) { goal = leave ? [L0.exit.x, L0.exit.y] : foe ? [foe.x, foe.y] : L0.exit ? [L0.exit.x, L0.exit.y] : [L0.start.x, L0.start.y]; obj = leave || !foe ? 'exit' : foe; }
  B.goal = goal;
  // progress watchdog: a goal that has not come 12 units closer in 6 s is unreachable from here; drop it for a while
  const gd0 = Math.hypot(goal[0] - h.x, goal[1] - h.y);
  if (obj !== B.gObj) { B.gObj = obj; B.gBest = gd0; B.gT = 0; } else if (gd0 < B.gBest - 12) { B.gBest = gd0; B.gT = 0; } else if (gd0 > 30) B.gT += dt;
  if (B.gT > 6) { B.gT = 0; if (obj && obj !== 'exit') B.ignore.set(obj, B.t + 25); else B.stuck = 1.6; }
  // walk there around walls and pits (a flow field toward the goal; a goal on unwalkable ground moves to its nearest walkable neighbour)
  if (!B.flow || B.flow.map !== L0.map) { B.flow = new E.FlowField(L0.map); B.ft = [-1, -1]; }
  let gx = Math.floor(goal[0] / T16), gy = Math.floor(goal[1] / T16);
  if (gx !== B.ft[0] || gy !== B.ft[1]) {
    B.ft = [gx, gy]; let best = null, bd = 1e9;
    const walk = (cx, cy) => cx >= 0 && cy >= 0 && cx < MW && cy < MH && (L0.map.walkable ? L0.map.walkable(cx, cy) : !L0.map.solidCell(cx, cy));
    if (walk(gx, gy)) best = [gx, gy]; else for (let r = 1; r <= 2 && !best; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (!walk(gx + dx, gy + dy)) continue; const d = Math.hypot((gx + dx + .5) * T16 - h.x, (gy + dy + .5) * T16 - h.y); if (d < bd) { bd = d; best = [gx + dx, gy + dy]; } }
    if (best) B.flow.update((best[0] + .5) * T16, (best[1] + .5) * T16);
  }
  const basic = REG.skills[h.slots[0]], rangedBasic = basic && (basic.tags || []).includes('proj');
  const gd = Math.hypot(goal[0] - h.x, goal[1] - h.y), reach = near ? (rangedBasic ? 74 : foe.r + 14) : 4;
  let mv = [0, 0];
  if (gd > reach) mv = gd < 22 ? [(goal[0] - h.x) / gd, (goal[1] - h.y) / gd] : B.flow.dir(h.x, h.y, goal[0], goal[1]);
  // out of potions and nearly dead next to something big: back off (still casting) until the life comes back or a potion drops
  if (h.hp < h.maxHp * .3 && h.potions <= 0 && near && (foe.elite || foe.boss || botCrowd(h.x, h.y, 40).n >= 3)) B.retreat = 5;
  if (B.retreat > 0) { B.retreat = h.hp > h.maxHp * .55 || h.potions > 0 ? 0 : B.retreat - dt; if (near && fd < 90) { const a = botSafeDir(h, Math.atan2(h.y - foe.y, h.x - foe.x), 30); mv = [Math.cos(a), Math.sin(a)]; } }
  const canRoll = h.dodges > 0 && h.dodgeT <= 0 && (!h.act || h.act.cancel !== false);
  if (avoid && avoid.lava) {   // standing in lava: out by the nearest safe side (the far one when it is as close), rolling when it is a stride away
    const out = botLavaOut(h, Math.atan2(mv[1], mv[0]));
    if (out) { mv = [Math.cos(out.a), Math.sin(out.a)]; if (out.d > 12 && canRoll) { I.worldMove = mv; I.press('dodge'); I.aimAt = [h.x + mv[0] * 30, h.y + mv[1] * 30]; return; } }
  } else if (avoid) {   // burning ground underfoot: step off it toward the nearest safe side, still facing the fight
    const a = botSafeDir(h, Math.atan2(h.y - avoid.from[1], h.x - avoid.from[0]), 24);
    mv = [Math.cos(a), Math.sin(a)];
  } else if ((mv[0] || mv[1]) && canRoll && !h.act && botFissure(h, Math.atan2(mv[1], mv[0]))) { I.worldMove = mv; I.press('dodge'); I.aimAt = [h.x + mv[0] * 30, h.y + mv[1] * 30]; return; }   // a fissure across the way: roll over it
  // stuck (wanted to move, did not, and not busy swinging): sidestep one way, then the other, then roll free, then give up the target
  // progress is measured along the way it wants to go: pressed against a solid thing, the push-out jitters the body back and
  // forth faster than 'not moving' allowed, so the stuck count hovered under its threshold forever
  const ml = Math.hypot(mv[0], mv[1]) || 1, moved = ((h.x - B.lx) * mv[0] + (h.y - B.ly) * mv[1]) / ml; B.lx = h.x; B.ly = h.y;
  const trying = (mv[0] || mv[1]) && !h.act && h.dodgeT <= 0;
  if (trying && moved < 8 * dt) { B.stuck += dt; B.stuckSum += dt; } else B.stuck = Math.max(0, B.stuck - dt * 2);
  if (B.stuck > .45) {
    const a = Math.atan2(mv[1], mv[0]) + B.side * (B.stuck > .9 ? 2.2 : 1.3); mv = [Math.cos(a), Math.sin(a)];
    if (B.stuck > 1.5) { const d = botSafeDir(h, Math.atan2(goal[1] - h.y, goal[0] - h.x) + B.side * 1.2); I.worldMove = [Math.cos(d), Math.sin(d)]; I.press('dodge'); B.stuck = 0; B.side = -B.side; return; }
  }
  if (B.stuckSum > 5 && B.tgt) { B.ignore.set(B.tgt, B.t + 20); B.tgt = null; B.stuckSum = 0; }
  I.worldMove = mv; I.aimAt = near ? [foe.x, foe.y] : [h.x + mv[0] * 30 + .01, h.y + mv[1] * 30];
  // a held channel (Whirlwind) keeps spinning while there is something to cut
  if (h.act && h.act.hold && h.act.slot !== undefined) { B.holdT -= dt; if (B.holdT > 0 && botCrowd(h.x, h.y, 44).n >= 1) I._d[SLOT_ACTS[h.act.slot]] = true; }
  if (!near) return;
  // fight: AoE on crowds, mobility to close gaps, ultimates on elites and big packs, spenders otherwise; the basic attack in reach
  const big = foe.elite || foe.boss, here = botCrowd(h.x, h.y, 50);
  for (let i = 5; i >= 1; i--) {
    const id = h.slots[i]; if (!id) continue; const S = REG.skills[id]; if (!skillAvailable(h, S) || h.cds[id] > 0 || h.ember < skillCost(h, S)) continue;
    if (S.bot && S.bot.ready && !S.bot.ready(h)) continue;   // a skill that needs something first (Dan's brood)
    if (S.bot && S.bot.heal) { if (h.hp < h.maxHp * S.bot.heal) I.press(SLOT_ACTS[i]); continue; }   // a heal (bot: { heal: .65 }): only below that share of life
    const tags = S.tags || [], melee = tags.includes('melee'), mob = S.kind === 'mobility' || tags.includes('movement'), ult = S.kind === 'ultimate', aoe = tags.includes('aoe') || tags.includes('channel'), range = S.range || (melee ? 40 : 150);
    let want, at = [foe.x, foe.y];
    if (mob) want = fd > 55 && fd < 150 && (pathD(foe) === null || pathD(foe) < 1e9);                 // close the gap (never leap at what cannot be reached)
    else if (ult) { const c = botCrowd(foe.x, foe.y, 45); want = big || c.n >= 5 || here.n >= 6; at = [c.x, c.y]; }
    else if (aoe) { const c = S.range ? botCrowd(h.x, h.y, S.range) : botCrowd(foe.x, foe.y, 40); want = c.n >= 3 || (big && fd < range); if (!S.range) at = [c.x, c.y]; }
    else want = big || here.n <= 2 || h.ember > h.maxEmber * .6;                                           // single-target spenders: bosses, stragglers, spare ember
    if (B.retreat > 0 && (melee || mob)) want = false;
    if (want && (mob || fd < range)) { I.aimAt = at; I.press(SLOT_ACTS[i]); I._d[SLOT_ACTS[i]] = true; if (tags.includes('channel')) B.holdT = 1.4; break; }
  }
  if (fd < (rangedBasic ? basic.range || 140 : foe.r + 22) && (!(B.retreat > 0) || rangedBasic)) { I.press('s0'); I._d.s0 = true; }
}
BUS.on('hit', e => { const h = ED.hero; if (h && h.bot && e.src === h) h.bot.lastHit = h.bot.t; });   // the target is still worth chasing
BUS.on('step', e => {
  const h = ED.hero; if (h && h.bot && !h.bot.manual) botThink(h, e.dt);   // manual: a scene drives the virtual input itself (the Gallery)
  // balance runs keep their speed (as the base clock: a perfect dodge or a finisher slows it by its own factor)
  if (BOT_RUN.on && ED.mode === 'level' && SLOW.raw !== BOT_RUN.speed) slowMoReset(BOT_RUN.speed);
});
/* a soak / balance run: the bot plays depth after depth and logs how it went (time, level, deaths, potions) */
const BOT_RUN = { on: false, to: 0, log: [], speed: 3 };
function botRun(o = {}) {
  BOT_RUN.on = true; BOT_RUN.to = o.to || 10; BOT_RUN.log = []; BOT_RUN.start = ED.t; BOT_RUN.deaths = 0; BOT_RUN.speed = o.speed || 3; BOT_RUN.maxDeaths = o.maxDeaths || 10;
  if (!ED.hero) ED.hero = newHero();
  botOn(ED.hero, true); slowMoReset(BOT_RUN.speed);
  descend(o.from || 1);
}
BUS.on('levelStart', e => { const h = ED.hero; if (BOT_RUN.on && h) { botOn(h, true); BOT_RUN.t0 = ED.t; BOT_RUN.deaths0 = BOT_RUN.deaths || 0; } });
BUS.on('levelEnd', e => {
  const h = ED.hero; if (!BOT_RUN.on || !h || !e.L || !e.L.depth) return;
  const died = (BOT_RUN.deaths || 0) > (BOT_RUN.deaths0 || 0);
  BOT_RUN.log.push({ depth: e.L.depth, name: e.L.name, time: +(ED.t).toFixed(1), level: h.level, hp: Math.round(h.hp / h.maxHp * 100), gold: h.gold, kills: ED.stats.kills, deaths: BOT_RUN.deaths || 0, cleared: !died });
  if ((e.L.depth >= BOT_RUN.to && !died) || (BOT_RUN.deaths || 0) >= BOT_RUN.maxDeaths) { BOT_RUN.on = false; slowMoReset(1); botOn(h, false); }
});
BUS.on('heroDie', () => { if (!BOT_RUN.on) return; BOT_RUN.deaths = (BOT_RUN.deaths || 0) + 1; game.after(2.5, () => { UI.closeAll(); reviveHero(ED.hero); descend(ED.depth || 1); }); });
