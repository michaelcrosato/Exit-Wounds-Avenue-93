/* =============================================================================
 * THE HERO  (the stress test's swordsman: teal tunic, red cape, dark hair)
 * One action at a time (a skill's swing, a leap, a cast, a stagger). An ACTION is
 *   { name, t, update(dt) -> keep going?, rig: { fields merged into rig.update }, moveK (movement while busy, 0..1),
 *     cancel: true (a dodge may cut it short), face: angle | null (hold this facing), z (lift for leaps), ghost,
 *     free: true in the follow-through (a skill may start; moving ends it unless moveCancel: false), hold (a channel) }
 * A skill press that finds him busy waits in a one-deep queue (h.slotQ) for half a second.
 * Skills return actions (see 25-skills-core.js). Gear changes the rig: colors, helm, armor, cape, blade.
 * ============================================================================= */
const HERO_LOOK = {   // the classic look: every piece of gear may override parts of it
  outfit: 'tunic', hair: 'short', sleeves: 'short', armor: false, hat: null, weapon: 'sword', bladeLen: 11, cape: { len: 6, width: 5, seg: 2.5 },
  colors: { skin: '#f1c7a0', hair: '#2e2230', cloth: '#2f8f86', pants: '#3b3552', boot: '#6a4128', belt: '#e0a84a', cape: '#c8452f', capeIn: '#7a2622', metal: '#dce8f1', metalDk: '#7f93ab', hilt: '#e8b04e', glove: null, trim: null }
};
function makeHero(save, identity = CHAR.selected) {
  const character = characterId(save ? save.character || identity : identity), profile = CHARACTERS[character];   // (18-characters.js)
  const h = {
    character,
    team: 'hero', x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: profile.r || 4.5, facing: -Math.PI / 2, aim: -Math.PI / 2, alive: true, st: {}, res: {}, armor: 0, head: profile.head || 26, mass: 1.6,
    level: 1, xp: 0, gold: 0, pts: { skill: 1, passive: 0 }, gear: {}, bag: [],
    skills: Object.fromEntries(profile.skills.map(id => [id, { rank: 1 }])), slots: profile.skills.concat([null, null, null, null, null, null]).slice(0, 6),   // his starting skills, slotted in order
    tree: [], potions: 3, potionT: 0, healT: 0, healRate: 0, act: null, cds: {}, inv: 0, hurtT: 0, flash: 0, dodges: 2, dodgeT: 0, dodgeRe: 0, dodgeDir: 0, buffs: [], powers: [],
    dead: false, deadT: 0, lastGhost: 0, idleT: 0, cheerT: 0, stats: {}, maxDepth: 1, unlocked: [1], seenMech: [], kills: 0
  };
  if (save) Object.assign(h, save, { st: {}, act: null, cds: {}, buffs: [], alive: true, dead: false });
  h.character = character;
  if (profile.init) profile.init(h);
  h.react = heroReact; h.onDie = heroDie; h.onDodgedHit = heroDodgedHit; h.onBeforeHit = heroBeforeHit;
  h.hp = undefined; h.ember = undefined;
  computeStats(h); h.hp = h.maxHp; h.ember = h.maxEmber; h.potions = Math.min(h.potions, h.maxPotions); h.dodges = h.maxDodge;
  dressHero(h);
  return h;
}
/** the look from gear: each item's `look` merges over the classic look (and over the character's own, its spec's `look`) */
function heroLook(h) {
  const L0 = JSON.parse(JSON.stringify(HERO_LOOK)), own = characterOf(h).look;
  if (own) for (const k in own) if (k === 'colors') Object.assign(L0.colors, own.colors); else L0[k] = JSON.parse(JSON.stringify(own[k]));
  for (const slot of ['legs', 'boots', 'gloves', 'chest', 'cloak', 'helm', 'weapon']) {
    const it = h.gear[slot]; if (!it || !it.look) continue;
    const lk = it.look;
    for (const k in lk) if (k === 'colors') { const c = Object.assign({}, lk.colors); if (slot !== 'weapon' && c.metal) { c.plate = c.plate || c.metal; delete c.metal; delete c.metalDk; } Object.assign(L0.colors, c); } else if (k !== 'glow' && k !== 'smear') L0[k] = lk[k];
  }
  const w = h.gear.weapon; L0.el = w && w.el || 'phys';
  return L0;
}
function dressHero(h) {
  const lk = heroLook(h), old = h.rig;
  h.look = lk;
  h.rig = charRig(h, lk);   // the character's body (18-characters.js): a Humanoid dressed from his gear by default
  if (old) { h.rig.update(0, { x: h.x, y: h.y, z: h.z, facing: h.facing }); }
  const w = h.gear.weapon; h.smear = (w && w.look && w.look.smear) || EL(lk.el).smear;
}

/* ---------- actions ---------- */
function startAction(h, act) {
  if (h.act && h.act.end) h.act.end(true);
  act.t = 0; h.act = act; return act;
}
function endAction(h) { if (h.act && h.act.end) h.act.end(false); h.act = null; }

/* ---------- xp, levels, gold ---------- */
function gainXp(h, n) {
  if (!h.alive) return;
  n *= (1 + (h.stats.xpGain || 0) / 100) * DIFF.xp;
  h.xp += n;
  let up = 0;
  while (h.xp >= SCALE.xpNeed(h.level)) {
    if (up >= 50) { h.xp = SCALE.xpNeed(h.level) - 1; break; }   // (a safety net: no kill is worth more than 50 levels)
    h.xp -= SCALE.xpNeed(h.level); h.level++; h.pts.skill += TUNE.skillPts; h.pts.passive += TUNE.passivePts; up++;
    computeStats(h);
    BUS.emit('heroLevel', { lvl: h.level });
  }
  // a level-up is a second wind, not a free full heal (every boss gave two or three levels, so the depth after it began
  // at full life): a third of his life back and a full ember pool, once however many levels the kill gave
  if (up) { h.hp = Math.min(h.maxHp, h.hp + h.maxHp * TUNE.levelHeal); h.ember = h.maxEmber; levelUpFx(h, up); }
}
/**
 * The level-up: he throws his arms up (cheer, shouting) inside a column of golden light that shoots up from his feet
 * and thins toward the top, motes spiral up around him, two rings roll out and "LEVEL n" pops out BESIDE him (over his
 * head it sat on the notice feed and hid him). It is short (under a second): fights go on through it.
 * The column is three faint additive shafts (never a solid bar: he must stay visible inside it), sized by the zoom.
 */
function levelUpFx(h, up = 1) {
  const pts = up > 1 ? up + ' SKILL POINTS  +' + up + ' PASSIVE POINTS' : '1 SKILL POINT  +1 PASSIVE POINT';
  sfx('powerup'); notify('LEVEL ' + h.level + '  •  +' + pts, '#ffe070', 3);
  h.cheerT = .75; P.glints(h.x, h.y, 16, 10, '#ffe070', 18); P.ring(h.x, h.y, 4, 34, '#ffe070', .4);
  const sd = game.view.screenDirToGround(1, 0), sl = Math.hypot(sd[0], sd[1]) || 1;   // the ground direction that reads as screen-right
  P.text(h.x + sd[0] / sl * 20, h.y + sd[1] / sl * 20, (h.head || 26) * .7, 'LEVEL ' + h.level, '#ffe070', { bounce: true });
  let ring2 = false;
  FX.visual(.85, (r, u) => {
    const zm = r.view.zoom || 1, grow = E.ease.outCubic(Math.min(1, u * 6)), a = u < .15 ? 1 : 1 - (u - .15) / .85, x0 = h.x, y0 = h.y;
    r.queue(x0, y0, 0, g => {
      const [x, y] = r.w(x0, y0, 0), [, ty] = r.w(x0, y0, 70 * grow), H = y - ty; if (H < 1) return;
      px.glow(g, 1);
      for (const [w, c, k] of [[5.5, '#ff9a3a', .1], [3.2, '#ffd36a', .16], [1.1, '#fff6d0', .3]]) {   // wide and faint to narrow and bright
        const W = Math.max(1, Math.round(w * zm));
        for (let i = 0; i < 5; i++) { const b0 = Math.round(ty + H * i / 5), b1 = Math.round(ty + H * (i + 1) / 5); px.blend(g, a * k * (.25 + .75 * i / 4), 'add', () => px.rect(g, x - W, b0, 2 * W, b1 - b0, c)); }   // it thins toward the top
      }
      r.glowDisc(g, x, y, 6 * zm * grow, '#ffd36a', .2 * a * a);
    }, { emissive: true, bias: -.6 });
    L.add(x0, y0, 20, 110, 1.3 * a, { color: '#ffd36a' });
  }, (f, dt) => {
    if (f.t < .55 && Math.random() < dt * 40) { const an = f.t * 9 + Math.random() * .6, rr = 7 + Math.random() * 3; P.add({ kind: 'ember', x: h.x + Math.cos(an) * rr, y: h.y + Math.sin(an) * rr, z: 2 + Math.random() * 6, vx: -Math.sin(an) * 18, vy: Math.cos(an) * 18, vz: 45 + Math.random() * 25, drag: 1.2, max: .8, color: Math.random() < .5 ? '#ffe070' : '#fff6d0' }); }   // motes spiral up around him
    if (!ring2 && f.t > .18) { ring2 = true; P.ring(h.x, h.y, 3, 50, '#fff0b0', .45); P.glints(h.x, h.y, 30, 8, '#fff6d0', 14); }
  });
}
function gainGold(h, n) { h.gold += n; BUS.emit('gold', { n }); }

/* ---------- getting hurt ---------- */
// every hit shows: a flash, a wince and a stagger; big hits (kb >= 200 or a slam) knock him down for a moment
function heroReact(hit) {
  const h = this;
  h.hurtT = .22; h.flash = .06; h.inv = Math.max(h.inv, TUNE.hurtInv);
  const ang = hit.ang !== undefined ? hit.ang : (hit.src ? angTo(hit.src, h) : 0);
  h.hitA = ang + Math.PI;
  if (hit.ang !== undefined || hit.src) knock(h, ang, hit.kb === 0 ? 0 : Math.min(260, (hit.kb || 60) + 60), 0);   // a sourceless hit (lava, a trap tick) has no direction to shove him in
  game.freeze(.05); shake(3); P.sparks(h.x, h.y, 12, 10, ang + Math.PI, { color: '#ff7a6a' });
  sfx('hurt', { vol: .6 });
  if ((hit.kb || 0) >= 200 || hit.knockdown) knockDown(h, hit.knockdown === 'long' || (hit.src && hit.src.boss) ? .9 : .45);   // a quick fall from trash, a long one from bosses
  else if (h.act && h.act.cancel !== false && h.act.interrupt !== false && (hit.dmg || 0) > h.maxHp * .12) endAction(h);
  BUS.emit('hurt', { tgt: h, hit, dmg: hit.dmg });
}
/** knocked flat: he turns to the blow and falls back from it ('down'), lies a moment, gets up (invulnerable while
 *  down). The body holds that facing on the floor (it no longer swings round after the cursor). A quick fall: the body
 *  hits the floor in ~0.16 s, lies until t, then gets up through the engine's get-up (E.ACTIONS.getUp: he sits up, comes
 *  to one knee and stands, ~0.45 s), and from 60% of t a dodge cuts it short: a tech roll straight off the floor. (A full
 *  second flat from a trash monster read as sluggish) */
function knockDown(h, t = .45) {
  const f = h.hitA !== undefined ? h.hitA : h.facing; h.facing = f;
  let up = null;
  startAction(h, { name: 'down', cancel: false, moveK: 0, face: f, rig: { down: 1 }, update(dt) {
    this.t += dt; this.cancel = this.t >= t * .6; h.inv = Math.max(h.inv, .2);
    if (this.t < t) return true;
    if (!up) { up = new E.Action('getUp', { body: h, speed: 1.8 }); up.update(.22 / 1.8); }   // (he already lies flat: from its 'sit')
    const going = up.update(dt); this.rig = up.rigState(); return going;
  } });
}
/** the killing blow has weight: a long hard stop, a red flash, a heavy shake, then the world crawls (slow motion for a
 *  second) while the camera pushes in on him as he staggers, his knees give and he topples. The body stays in view
 *  (drawHero no longer fades it) under the YOU DIED panel */
function heroDie(hit) {
  const h = this;
  if (h.act) endAction(h); h.dead = true; h.deadT = 0; h.deadAt = wallClock(); h.act = null; h.vz = Math.min(0, h.vz || 0); h.dodgeT = 0; h.slotQ = null;   // killed in the air (a leap, a roll): he falls from there
  P.bits(h.x, h.y, 8, 20, [h.look.colors.cloth, h.look.colors.cape, h.look.colors.skin]);
  P.sparks(h.x, h.y, 14, 18, h.hitA !== undefined ? h.hitA + Math.PI : null, { color: '#ff6a5a', hot: '#fff0d0' }); P.ring(h.x, h.y, 3, 30, '#ff6a5a', .45);
  sfx('die'); sfx('thud', { vol: .7, pitch: .6 }); A.music(null);
  h.deathZ = 0;
  if (!ED.demo) {
    HITSTOP.hard(.07); shake(7); game.flash('#ff3a2a', .22, .55); slowMo(.3, 1.4, 'death');   // (the stop is game time: under the slow motion it holds ~0.25 s)
    h.deathZ = game.zoom;   // the push-in starts from wherever the player had the camera
  }
  BUS.emit('heroDie', { h, hit });
}
/** evasion: a chance to sidestep a hit entirely */
function heroBeforeHit(hit, amt) {
  const ev = (this.stats.dodge || 0) / 100;
  if (ev > 0 && Math.random() < Math.min(.6, ev)) { P.text(this.x, this.y, 30, 'EVADE', '#bff6ff'); return 0; }
  return amt;
}
function heroDodgedHit(hit) {
  const h = this;
  if (h.dodgeT > 0 && h.dodgeT > .1 && !h.perfectT && hit.src && hit.src.team === 'foe') {   // dodged right through a strike: time slows for everyone else
    h.perfectT = 1.1 * TUNE.perfectSlow; if (TUNE.perfectSlow > 0) slowMo(.35, 1.1 * TUNE.perfectSlow, 'perfect'); sfx('warp', { vol: .6 }); notify('PERFECT DODGE', '#8fe3ff', 1.5);
    P.ring(h.x, h.y, 4, 40, '#8fe3ff', .4); game.flash('#8fe3ff', .15, .5);
    BUS.emit('perfectDodge', { h, hit });
  }
}
/**
 * The near miss: a blow that goes off in the first moments of a roll, where he stood when he rolled (or within ~16
 * units of it, or of where he is now), is a perfect dodge too, though it never touches him: rolling AWAY from a blow is
 * what most players do, and it used to count for nothing. gap(x, y) = how far a point is outside the blow's reach
 * (<= 0: inside it). Called for monster swings (the melee AI's m.atk, from the hero's own step), every hostile telegraph
 * as it fires and hostile bolts that fly past (10-combat.js), and any module's BUS.emit('foeStrike', { src, x, y, r })
 * for attacks of its own.
 */
function heroNearMiss(src, gap) {
  const h = ED.hero; if (!h || !h.alive || !(h.dodgeT > .1) || h.perfectT) return;
  if (Math.min(gap(h.x, h.y), h.dodgeX === undefined ? 99 : gap(h.dodgeX, h.dodgeY)) - h.r > 16) return;
  heroDodgedHit.call(h, { src: src && src.team ? src : { team: 'foe' }, near: true });
}
BUS.on('foeStrike', e => { if (ED.hero && e) heroNearMiss(e.src, (x, y) => Math.hypot(e.x - x, e.y - y) - (e.r || 0)); }, 'global');
/** the melee AI's swings (m.atk, an E.Attack) that turn active near him while he rolls: a blow's reach is its body plus
 *  a dozen units, within its swing arc */
function heroNearSwings(h) {
  eachEnemy('hero', h.x, h.y, 90, m => {
    const A = m.atk; if (!A || A.phase !== 'active' || A.t > .12 || A._near) return; A._near = true;
    heroNearMiss(m, (x, y) => Math.abs(E.angDiff(m.facing, Math.atan2(y - m.y, x - m.x))) < 1.5 ? Math.hypot(x - m.x, y - m.y) - m.r - 12 * (m.scale || 1) : 99);
  });
}

/* ---------- the per-step controller ---------- */
// Each playable identity supplies movement and dodge timing (18-characters.js).
function heroAim(h) {
  const inp = h.bot ? h.bot.input : game.input, view = game.view;   // h.bot: the autopilot drives a virtual input (93-autopilot.js)
  const mv = inp.move(), md = inp.worldMove ? inp.worldMove.slice() : view.screenDirToGround(mv[0], mv[1]), mlen = Math.hypot(md[0], md[1]);
  let aimA = null, tgt = null;
  if (inp.aimSource === 'bot' && inp.aimAt) { tgt = inp.aimAt; aimA = Math.atan2(tgt[1] - h.y, tgt[0] - h.x); }
  else if (inp.aimSource === 'mouse') { const m = game.mouseGround(); if (m) { tgt = m; if (Math.hypot(m[0] - h.x, m[1] - h.y) > 3) aimA = Math.atan2(m[1] - h.y, m[0] - h.x); } }
  else if (inp.aimSource === 'pad' && inp.padAim) { const d = view.screenDirToGround(inp.padAim[0], inp.padAim[1]); aimA = Math.atan2(d[1], d[0]); }
  if (aimA === null && mlen > .1) aimA = Math.atan2(md[1], md[0]);
  if (aimA !== null) h.aim = aimA;
  if (!tgt) { const nearest = (!h.bot && !CONTROL.aimAssist) ? null : nearestEnemy('hero', h.x + Math.cos(h.aim) * 40, h.y + Math.sin(h.aim) * 40, 70); tgt = nearest ? [nearest.x, nearest.y] : [h.x + Math.cos(h.aim) * 60, h.y + Math.sin(h.aim) * 60]; }
  if (!h.bot && CONTROL.aimAssist && inp.aimSource !== 'mouse' && !inp.padAim && mlen < .1) h.aim = Math.atan2(tgt[1] - h.y, tgt[0] - h.x);
  h.tx = tgt[0]; h.ty = tgt[1];
  return { md, mlen };
}
function updateHero(h, dt, o = {}) {
  const inp = h.bot ? h.bot.input : game.input, town = !!o.town;
  const profile = characterOf(h), dodgeTime = profile.dodgeTime * TUNE.dodgeTime;
  if (h.perfectT > 0 && (h.perfectT -= dt / Math.max(.2, game.timeScale)) <= 0) h.perfectT = 0;
  // witch time: after a perfect dodge the world crawls but he keeps close to his own pace (his clock runs fast)
  if (h.perfectT > 0 && game.timeScale < 1 && !h.dead) dt *= Math.min(3, .85 / Math.max(.2, game.timeScale));
  h.inv -= dt; h.hurtT -= dt; h.flash -= dt; h.cheerT -= dt; h.potionT -= dt;
  for (const k in h.cds) if ((h.cds[k] -= dt) <= 0) delete h.cds[k];
  for (let i = h.buffs.length - 1; i >= 0; i--) if ((h.buffs[i].t -= dt) <= 0) { h.buffs.splice(i, 1); computeStats(h); }
  tickStatus(h, dt);
  if (h.dead) {   // he falls from wherever death found him (mid-leap, mid-roll), then crumples
    h.deadT += dt;
    if (h.deathZ) game.setZoom(h.deathZ * (1 + .3 * E.ease.outCubic(Math.min(1, h.deadT / 1.3))));   // the camera leans in on the fall (a new world entry resets the zoom)
    if (h.z > 0) { h.vz -= 520 * TUNE.gravity * dt; h.z = Math.max(0, h.z + h.vz * dt); if (!h.z) { h.vz = 0; P.dust(h.x, h.y, 0, 6, { speed: 40 }); sfx('thud', { vol: .5 }); } }
    h.rig.update(dt, { x: h.x, y: h.y, z: h.z, facing: h.facing, pose: h.z > 1 ? null : 'die', air: h.z > 1, hurt: h.z > 1, expr: 'wince' }); return;
  }
  // regeneration, heal over time (potions)
  const s = h.stats;
  h.hp = Math.min(h.maxHp, h.hp + (s.lifeRegen || 0) * dt + (h.healT > 0 ? h.healRate * dt : 0)); h.healT -= dt;
  h.ember = Math.min(h.maxEmber, h.ember + (s.emberRegen || 0) * dt);
  if (h.dodges < h.maxDodge && (h.dodgeRe -= dt * (1 + (s.dodgeCd || 0) / 100)) <= 0) { h.dodges++; h.dodgeRe = TUNE.dodgeRecharge; }
  const { md, mlen } = heroAim(h), sp = statusSpeed(h);
  // dodge: a quick low dash with invulnerability; it carries him over chasms (he is briefly airborne). A press he cannot
  // honour yet (mid-roll, mid-leap, mid-dash) is kept for a moment and rolls the instant he can: nothing is swallowed
  const canDodge = h.dodges > 0 && h.dodgeT <= 0 && sp > 0 && (!h.act || h.act.cancel !== false);
  if (inp.buffered('dodge', .12) && !canDodge && h.dodges > 0) { inp.consume('dodge'); h.dodgeQ = .35; h.dodgeQT = game.time; }   // (a roll pressed mid-roll chains)
  if (!(h.act && h.act.cancel === false) || game.time - (h.dodgeQT || 0) > 1.2) h.dodgeQ = (h.dodgeQ || 0) - dt;   // it waits out a leap or a fall
  if ((inp.buffered('dodge', .12) || h.dodgeQ > 0) && canDodge) {
    inp.consume('dodge'); h.dodgeQ = 0; h.slotQ = null;   // (a skill still waiting in the queue gives way to the roll)
    const a = mlen > .1 ? Math.atan2(md[1], md[0]) : h.aim;
    if (h.act) endAction(h);
    h.dodgeDir = a; h.dodgeT = dodgeTime; h.dodgeX = h.x; h.dodgeY = h.y; h.facing = a; h.dodges--; if (h.dodgeRe <= 0) h.dodgeRe = TUNE.dodgeRecharge; h.inv = Math.max(h.inv, dodgeTime + .04);
    P.dust(h.x, h.y, 0, 6, { speed: 40 }); P.ring(h.x, h.y, 3, 14, '#bff6ff', .25); h.rig.kick(-3); sfx('whoosh', { vol: .7 });
    BUS.emit('dodge', { h });
  }
  // skills: the six slots (in town the swing is harmless, and E / click on a person talks instead). A press is
  // buffered; a key HELD keeps the skill going (Diablo style: hold to keep attacking or casting), quietly (no
  // 'not enough ember' spam), and never restarts a channel (its own hold logic runs it)
  // A tap that lands while a longer swing is still busy (a spin, a cleave's wind-up, a leap) is not dropped: it waits in
  // a one-deep queue (the newest press wins) and goes off the moment the action is free, for up to half a second
  if (!town || o.canAct) {
    const fresh = [];
    for (let i = 0; i < 6; i++) if (inp.buffered(SLOT_ACTS[i], .16)) { fresh[i] = true; if (useSlot(h, i)) { inp.consume(SLOT_ACTS[i]); h.slotQ = null; } else if (h.act) { inp.consume(SLOT_ACTS[i]); h.slotQ = { i, t: .5, at: game.time }; } }
    // (it waits out a locked action, a leap in the air, like the dodge's queue, for up to 1.2 s; and it runs before the
    // held keys: a held attack must not starve a tapped skill)
    const q = h.slotQ; if (q && ((h.act && h.act.cancel === false ? 0 : q.t -= dt) < 0 || game.time - q.at > 1.2 || useSlot(h, q.i) || !h.act)) h.slotQ = null;
    for (let i = 0; i < 6; i++) if (!fresh[i] && inp.down(SLOT_ACTS[i]) && !(h.act && h.act.hold) && h.dodgeT <= 0) useSlot(h, i, true);
  } else h.slotQ = null;
  // hold-to-channel skills keep running while the key is down
  if (h.act && h.act.hold && !inp.down(SLOT_ACTS[h.act.slot])) h.act.release = true;
  if (inp.pressed('potion')) drinkPotion(h);
  // the current action
  if (h.act) { const k = h.act.speed || 1; if (!h.act.update(dt * k * sp, h)) endAction(h); }
  // moving cuts a recovery short: once an action is free (its follow-through), a push on the stick ends it and he runs
  // at once (combo skills pick their chain up again on the next press). Not a channel, not a locked action, and not an
  // action that says moveCancel: false (a thrown sword still in flight)
  if (h.act && h.act.free && mlen > .1 && h.act.cancel !== false && !h.act.hold && h.act.moveCancel !== false && h.dodgeT <= 0) endAction(h);
  // 'strike': any action whose rig attack enters its active phase (a combo swing, a skill's own attack), once per swing
  { const act = h.act, st = act && act.rig && act.rig.attack, ph = st ? st.phase : null;
    if (act && h.alive && ph === 'active' && act._strikePh !== 'active') BUS.emit('strike', { h, act, spec: st.spec });
    if (act) act._strikePh = ph; }
  const act = h.act;
  if (h.dodgeT > .1 && !h.perfectT) heroNearSwings(h);
  // movement
  if (h.dodgeT > 0) {
    h.dodgeT -= dt; const u = 1 - h.dodgeT / dodgeTime, v = profile.dodgeSpeed * TUNE.dodgeSpeed * h.speedMul * (1 - .5 * u * u);
    h.vx = Math.cos(h.dodgeDir) * v; h.vy = Math.sin(h.dodgeDir) * v; h.z = Math.sin(Math.min(1, u) * Math.PI) * 3 + 2.1;
  } else {
    const slow = act ? (act.moveK === undefined ? .3 : act.moveK) : 1, acc = (h.hurtT > 0 ? 300 : profile.acceleration * TUNE.heroAccel) * dt * (h.traction === undefined ? 1 : h.traction), top = profile.speed * TUNE.heroRun * h.speedMul * sp * (h.speedK === undefined ? 1 : h.speedK);
    h.vx = approach(h.vx, md[0] * top * slow, acc); h.vy = approach(h.vy, md[1] * top * slow, acc);
    h.z = act && act.z !== undefined ? act.z : 0;
  }
  // facing: an action may hold it; otherwise turn toward the aim (a quick turn toward a hit when staggered)
  if (act && act.face !== undefined && act.face !== null) h.facing = E.approachAng(h.facing, act.face, dt * 30);
  else if (h.dodgeT > 0) h.facing = h.dodgeDir;
  else if (h.hurtT > 0 && !act) h.facing = E.approachAng(h.facing, h.hitA, dt * 30);
  else h.facing = E.approachAng(h.facing, h.aim, dt * (act ? 10 : 16));
  const wasX = h.x, wasY = h.y;
  h.x += h.vx * dt * (sp || 0); h.y += h.vy * dt * (sp || 0);
  if (h.drift) { h.x += h.drift[0] * dt; h.y += h.drift[1] * dt; }
  h.traction = undefined; h.speedK = undefined; h.drift = null;   // mechanics set these every step (ice, mud, wind)
  const bx = h.x, by = h.y; collideUnit(h);
  // a wall or a solid thing pushed him back: drop the part of his velocity that points into it, so running into a wall
  // stands him still (no sprint in place, no footsteps) and running along one slides him with a walking gait
  const cx = h.x - bx, cy = h.y - by, cl = Math.hypot(cx, cy);
  if (cl > 1e-3 && h.dodgeT <= 0) { const nx = cx / cl, ny = cy / cl, vn = h.vx * nx + h.vy * ny; if (vn < 0) { h.vx -= vn * nx; h.vy -= vn * ny; } }
  h.idleT = Math.hypot(h.x - wasX, h.y - wasY) > .05 || act ? 0 : h.idleT + dt;
  // the rig: the action's fields over the locomotion state
  const low = clamp(1 - h.hp / h.maxHp / .35, 0, 1);   // how badly hurt he is (0 above a third of his life)
  const rs = { x: h.x, y: h.y, z: h.z, vx: h.vx, vy: h.vy, facing: h.facing, dash: h.dodgeT > 0, hurt: h.hurtT > 0 && !(act && act.rig && act.rig.attack), expr: h.hurtT > 0 ? 'wince' : h.cheerT > 0 ? 'shout' : low > .4 && (game.time + h.x * .01) % 2.8 < .5 ? 'wince' : null };
  if (act && act.rig) Object.assign(rs, act.rig);
  if (!act && h.cheerT > .3 && mlen < .1) rs.pose = 'cheer';
  else if (!act && town && h.idleT > 6) rs.pose = 'hips';   // waiting in town: hands on hips
  // wounded: he hunches and leans as life runs low; idle in a level, he checks his blade now and then
  h.rig.o.hunch = low * .3; h.rig.o.lean = low * .12;
  if (!act && !town && h.idleT > 5 && h.idleT % 9 < 1.4 && !rs.pose) { rs.pose = 'block'; rs.expr = null; }
  // the dodge is the rig's forward roll (state flip: a somersault about the hips, the cape and hair turned with it)
  if (h.dodgeT > 0 && !profile.ownLayers) rs.flip = 1 - h.dodgeT / dodgeTime;
  if (sp === 0) { if (!h.st.freeze) h.rig.update(dt, rs); }
  else h.rig.update(dt * (h.st.chill ? .8 : 1), rs);
  if (profile.ownLayers) return;   // a body that animates its own dodge, potion and wounds (Codex) gets none of the layers below
  if (h.dodgeT <= 0 && h.potionT > 0) heroDrinkPose(h, 1 - h.potionT / .8);
  if (!(sp === 0 && h.st.freeze)) heroWoundPose(h, dt, rs.pose || h.hurtT > 0 ? 0 : low);   // (a pose or a flinch has the hand; frozen solid, the rig keeps last step's joints and nothing may be added twice)
  // footsteps on the gait: one soft step each time a foot comes down
  const ph = Math.floor(h.rig.phase / Math.PI); if (ph !== h.stepPh) { h.stepPh = ph; if (Math.hypot(h.vx, h.vy) > 30 && h.z < 1) sfx('step', { vol: .35 }); }
  if (h.dodgeT <= 0 && !(act && act.rig && act.rig.attack && act.rig.attack.phase === 'active')) settleCape(h.rig, dt, h.hurtT > 0 ? 1 : clamp(1 - Math.hypot(h.vx, h.vy) / 60, 0, 1));
}
/** push a unit out of walls and solid things (braziers, pylons, kegs). A unit that is knocked back, airborne or
 *  flying may cross blocked floor (pits, deep water): that is how monsters get knocked into chasms */
const _probe = { x: 0, y: 0, r: 0, z: 0, step: 2 };
function collideUnit(u) {
  const L0 = ED.L; if (!L0 || !L0.map) return;
  if (u.team === 'foe' && (u.kbT > 0 || u.air || u.canFly || u.z > 2)) { _probe.x = u.x; _probe.y = u.y; _probe.r = u.r; _probe.z = Math.max(u.z || 0, 4.5); L0.map.collide(_probe); u.x = _probe.x; u.y = _probe.y; }
  else L0.map.collide(u);
  if (L0.things) for (const t of L0.things) if (t.solid && !t.dead) { const dx = u.x - t.x, dy = u.y - t.y, d = Math.hypot(dx, dy), m = u.r + t.r; if (d < m && d > .001) { u.x = t.x + dx / d * m; u.y = t.y + dy / d * m; } }
}
/** after a spin, lunge or knockback the cape keeps its swing: draw it back toward hanging (from the stress test) */
function settleCape(rig, dt, w) {
  if (!rig.capeL || !rig.o.cape) return;
  const k = Math.min(1, dt * 16 * w), fx = Math.cos(rig.facing), fy = Math.sin(rig.facing), seg = rig.o.cape.seg || 2.5;
  for (const ch of [rig.capeL, rig.capeR]) ch.forEach((n, i) => {
    n.x = lerp(n.x, ch[0].x - fx * i * .5, k); n.y = lerp(n.y, ch[0].y - fy * i * .5, k); n.z = lerp(n.z, ch[0].z - i * seg * rig.o.size, k);
    n.px = lerp(n.px, n.x, k); n.py = lerp(n.py, n.y, k); n.pz = lerp(n.pz, n.z, k);
  });
}
/**
 * Drinking, layered on any other animation: the free (left) arm is re-solved with the engine's two-bone IK so the
 * hand brings a flask up to the mouth, holds it while he drinks, and lowers it; he can keep moving and fighting.
 */
function heroDrinkPose(h, u) {
  const J = h.rig.J, o = h.rig.o; if (!J.shL || !J.head || (h.act && h.act.rig && h.act.rig.attack && h.act.rig.attack.spec.hand === 'L')) return;
  const k = u < .25 ? E.ease.outQuad(u / .25) : u > .8 ? 1 - E.ease.inQuad((u - .8) / .2) : 1;
  const mouth = [J.head[0] + o.headR * .9, J.head[1] - .6, J.head[2] - o.headR * .45], tgt = E.V3.lerp(J.handL, mouth, k);
  const [el, hd] = E.ik3(J.shL, tgt, o.armUpper, o.armLower, [-.2, -1, -.4]); J.elbowL = el; J.handL = hd;
  h.drinkK = k;
}
/**
 * Wounded, layered on the rig like the drink: below about a third of his life his free hand presses his side (two-bone
 * IK to the left flank) and his shoulders and head heave with quick, ragged breaths, deeper the closer he is to death.
 * It eases in and out; any action, the roll or the flask takes the hand back (the layer runs while he walks or stands).
 */
const HERO_HEAVE = { shL: 1, shR: 1, shC: 1, head: 1.2, elbowR: .8, handR: .6 };
function heroWoundPose(h, dt, low) {
  const want = !h.act && h.dodgeT <= 0 && !(h.potionT > 0) && !h.dead && low > .1 ? 1 : 0;
  h.woundK = approach(h.woundK || 0, want, dt * (want ? 2.5 : 6)); const k = E.ease.inOut(h.woundK);
  const J = h.rig.J, o = h.rig.o; if (k < .01 || !J.shL || !J.hipC || h.act || h.dodgeT > 0 || h.potionT > 0) return;
  const heave = Math.sin(game.time * (5 + 2 * low)) * (.25 + .35 * low) * k;   // ragged breathing: the upper body rises and sinks
  for (const n in HERO_HEAVE) if (J[n]) J[n] = [J[n][0], J[n][1], J[n][2] + heave * HERO_HEAVE[n]];
  const side = [J.hipC[0] + .9, J.hipC[1] - o.hipHalf * 1.3, J.hipC[2] + o.torso * .36], tgt = E.V3.lerp(J.handL, side, k);
  const [el, hd] = E.ik3(J.shL, tgt, o.armUpper, o.armLower, [-.5, -1, -.3]); J.elbowL = el; J.handL = hd;
}
function drawFlask(h, g, ox, oy, view) {
  if (characterOf(h).ownLayers) return;   // (its own body shows the drink)
  if (!(h.potionT > 0) || !h.drinkK) return;
  const [x, y, dep] = rigScreen(h.rig, h.rig.J.handL, ox, oy, view), hd = rigScreen(h.rig, h.rig.J.head, ox, oy, view)[2], z = view.zoom || 1, tilt = h.drinkK;
  if (dep < hd - .5 && Math.hypot(x - rigScreen(h.rig, h.rig.J.head, ox, oy, view)[0], 0) < 4 * z) return;   // hidden behind his head when he faces away
  px.rect(g, x - 1 * z, y - (4 + tilt) * z, 2 * z, 2 * z, '#c8b890'); px.disc(g, x, y - 1 * z, 2.4 * z, '#6a1a2a'); px.disc(g, x, y - 1 * z, 1.8 * z, '#e03a4a'); px.dot(g, x - 1, y - 2 * z, '#ffc0c8');
}
function drinkPotion(h) {
  if (h.potions <= 0 || h.potionT > 0 || h.dead) { if (h.potions <= 0) notify('NO POTIONS', '#ff8a7a', 1.2); return; }
  h.potions--; h.potionT = .8;
  const heal = h.maxHp * TUNE.potionHeal * (1 + (h.stats.potionHeal || 0) / 100);
  h.hp = Math.min(h.maxHp, h.hp + heal * .35); h.healT = 1.5; h.healRate = heal * .65 / 1.5;
  sfx('heal'); P.glints(h.x, h.y, 14, 10, '#ff6a7a', 14); P.ring(h.x, h.y, 2, 16, '#ff8a9a', .35);
  BUS.emit('potion', { h, heal });
}
/** is the hero standing still and free (for pickups, talk prompts) */
const heroFree = h => h.alive && !h.act && h.dodgeT <= 0;

/** his x-ray: behind a wall, a pillar, a statue, a brazier or a body in the crowd, a checkered cyan silhouette with a solid
 *  pale outline shows where he is (the checker alone read as a faint dither on busy timber and in packs) */
const HERO_XRAY = { color: '#8fe3ff', outline: '#e8fdff', actors: true };
/** afterimages: the dodge leaves blue ones; an action with a ghost color (a lunge, a leap) leaves its own. owner: h keeps
 *  every copy sorted behind the live body (a roll away from the camera left its trail in front of him: a cyan blob) */
function actGhost(h, dodging) {
  if (dodging) return { color: '#62d8ff', life: .2, alpha: .42, owner: h };
  if (h.act && h.act.ghost && game.time - h.lastGhost > .04) { h.lastGhost = game.time; return { color: h.act.ghost, life: .25, owner: h }; }
  return null;
}
function drawHero(h, r) {
  if (!h.rig) return;
  const t = game.time, view = r.view;
  if (!h.dead) r.shadow(h.x, h.y, 5.5, .55, undefined, ED.L && ED.L.map ? ED.L.map.groundAt(h.x, h.y, h.r, h.z) : 0);
  const ghost = h.dodgeT > 0 && t - h.lastGhost > .04; if (ghost) h.lastGhost = t;
  const tint = statusTint(h), fl = h.flash > 0 ? ['#ffe6d8', .3] : tint;
  r.actor(h.x, h.y, h.z, (g, ox, oy) => { h.rig.draw(g, ox, oy, view); drawFlask(h, g, ox, oy, view); if (h.drawExtra) h.drawExtra(g, ox, oy, view); },
    { xray: HERO_XRAY, alpha: h.dead ? 1 : h.fade !== undefined ? h.fade : 1, flash: fl && fl[0], flashMix: fl && fl[1], outlineColor: h.flash > 0 ? '#fff4e6' : undefined, ghost: actGhost(h, ghost) });
  h.rig.drawSmear(r, (h.act && h.act.smear) || h.smear);
  if (h.act && h.act.draw) h.act.draw(r);
  // his own light: h.lightR / h.lightI let mechanics (the dark) and gear change it
  if (r.gpu) { L.add(h.x, h.y, 18, h.lightR || 84, h.lightI === undefined ? .6 : h.lightI * .7, { color: '#c9c2ec' }); L.caster(h.x, h.y, 3.2, 24); } else L.add(h.x, h.y, 10, h.lightR || 92, h.lightI === undefined ? .85 : h.lightI, { color: '#fff0d8' });
}
