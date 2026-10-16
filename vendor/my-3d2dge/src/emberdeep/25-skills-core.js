/* =============================================================================
 * SKILLS: the runtime for the six slots, plus the two starting skills (Blade Dance, Ember Bolt)
 * A SKILL is def('skills', id, {
 *   name, tags: ['melee', 'attack'] | ['spell', 'proj', ...], el, cost (ember), cd (s), gen (ember gained per hit),
 *   kind: 'basic' | 'core' | 'mobility' | 'ultimate' (grouping in the skills panel), unlock: hero level,
 *   runes: [{ id, name, desc }, { id, name, desc }]   (one may be chosen from rank 2: the skill's two upgrades),
 *   desc(rank, rune) -> 'text', icon(g, x, y, s, h) (a 16x16 pictogram, s = size),
 *   cast(h, ctx) -> an action (see 20-hero.js) or null (nothing happened),
 *   again(h, act, ctx) -> true if a press during its own action continues it (combos),
 *   character: 'codex' (one hero's own skill: the others never see it), bot: { heal: .65, ready(h) } (how the autopilot uses
 *   it: a heal only below that share of life; ready(h) false holds it back, e.g. until Dan has a brood; without it,
 *   the autopilot reads tags and kind)
 * })
 * ctx: { id, S, slot, rank, rune, aim, tx, ty (the cursor on the ground), hit(scale, o) (a hero hit with this
 *        skill's element and tags), area (radius multiplier), proj (extra projectiles), pierce, chains }
 * ============================================================================= */
function skillCtx(h, id, slot) {
  const S = REG.skills[id], s = h.stats, k = h.skills[id] || {};
  // a physical ATTACK strikes with the weapon, so it takes the weapon's element (a fire sword's Blade Dance burns, as its
  // tooltip promises, and Increased Fire Damage counts); a rune's own element (o.el) and spells keep theirs. The
  // weapon's status comes at 12% a hit (not an element's usual 30%) and a frost blade chills two stacks at a time: at
  // five hits a second the full rate kept a whole pack frozen solid
  const w = h.gear && h.gear.weapon, wel = S.el === 'phys' && (S.tags || []).includes('attack') && w && w.el && w.el !== 'phys' ? w.el : null, el = wel || S.el;
  return { id, S, slot, el, rank: skillRank(h, id), rune: k.rune || null, aim: h.aim, tx: h.tx, ty: h.ty,
    hit: (scale, o = {}) => { const x = heroHit(h, scale, Object.assign({ el, tags: S.tags, skill: id }, o)); if (wel && x.el === wel && x.statusChance === undefined && !x.status) { x.statusChance = .12; if (wel === 'frost') x.statusPower = 1; } return x; },
    area: 1 + (s.area || 0) / 100, proj: Math.round(s.projectiles || 0), pierce: Math.round(s.pierce || 0), chains: Math.round(s.chains || 0) };
}
const skillCost = (h, S) => DEV.resources && h === ED.hero ? 0 : Math.round((S.cost || 0) * (1 - clamp((h.stats.costRed || 0) / 100, 0, .6)));
const skillCd = (h, S) => DEV.cooldowns && h === ED.hero ? 0 : (S.cd || 0) * (1 - clamp((h.stats.cdr || 0) / 100, 0, .6));
/** press slot i: continue the running action (combo), or start the skill if it is ready.
 *  held: the key is only being held down (repeat): nothing to warn about, and nothing is consumed */
function useSlot(h, i, held) {
  const id = h.slots[i]; if (!id || h.dead) return false;
  const S = REG.skills[id]; if (!skillAvailable(h, S) || skillRank(h, id) <= 0) return false;
  if (held && (h.act ? !(h.act.skill === id && S.again) && !(h.act.free || h.act.cancel === 'skill') : h.cds[id] > 0 || h.ember < skillCost(h, S))) return false;   // cheap early out: nothing a held key could start
  const ctx = skillCtx(h, id, i);
  if (h.act && h.act.skill === id && S.again) return S.again(h, h.act, ctx);
  if (h.act && !(h.act.free || h.act.cancel === 'skill')) return false;
  if (h.cds[id] > 0) return h.act || held ? false : (h.cdWarn = { slot: i, t: .3 }, true);
  const cost = skillCost(h, S);
  if (h.ember < cost) { if (!h.act && !held) { notify('NOT ENOUGH EMBER', '#ff9a7a', 1); sfx('cancel', { vol: .5 }); } return !h.act && !held; }
  const act = S.cast(h, ctx);
  if (!act) return false;
  h.ember -= cost; if (S.cd) h.cds[id] = skillCd(h, S);
  act.skill = id; act.slot = i; act.gained = 0;
  if (act !== h.act) startAction(h, act);
  BUS.emit('skill', { id, slot: i, h, ctx });
  return true;
}
/* hits by the hero's skills feed ember (generators), life on hit and leech */
BUS.on('hit', e => {
  const h = ED.hero; if (!h || e.src !== h) return;
  const s = h.stats, S = e.hit.skill && REG.skills[e.hit.skill], act = h.act;
  if (S && S.gen && S.genOnHit && !e.hit.proc) h.ember = Math.min(h.maxEmber, h.ember + S.gen);
  else if (S && S.gen && act && act.skill === S.id && act.gained < S.gen * 3) { h.ember = Math.min(h.maxEmber, h.ember + S.gen); act.gained += S.gen; }
  if (s.emberOnHit) h.ember = Math.min(h.maxEmber, h.ember + s.emberOnHit);
  const heal = (s.lifeOnHit || 0) + e.dmg * (s.leech || 0) / 100;
  if (heal > 0 && h.alive) h.hp = Math.min(h.maxHp, h.hp + heal);
  if (e.tgt.elite && s.incElite) e.tgt.hp -= e.dmg * s.incElite / 100;
  if (e.tgt.boss && s.incBoss) e.tgt.hp -= e.dmg * s.incBoss / 100;
});
BUS.on('kill', e => { const h = ED.hero; if (h && e.src === h && h.stats.lifeOnKill) h.hp = Math.min(h.maxHp, h.hp + h.stats.lifeOnKill); });

/**
 * A melee swing action from an E.Attack or E.Combo: the rig plays the move; the hit cone lands during 'active'
 * (from the move's hitAt on), a push carries the body into the strike, and the swing sound plays on the strike.
 * o: { name, range, half, hit(u) -> hit, push, moveK, onStrike(act), onHit(u, act), sound }
 */
function swingAction(h, atk, o) {
  const act = { name: o.name || 'swing', atk, moveK: o.moveK === undefined ? .28 : o.moveK, face: h.aim, cancel: true, speed: h.atkMul, rig: { attack: null }, set: new Set(), free: false,
    update(dt) {
      const began = atk.update(dt), st = atk.state;
      this.rig.attack = st;
      if (st && st.phase === 'wind' && this.stepSpec !== st.spec) {
        // the step-in, as each swing winds up: a foe just beyond the blade, ahead of him, draws him toward it (the body
        // slides the gap shut: a push v carries v^2 / 2000), so a combo keeps connecting on a staggered, backing foe
        this.stepSpec = st.spec;
        const range = typeof o.range === 'function' ? o.range(st.spec) : o.range, fx = Math.cos(h.facing), fy = Math.sin(h.facing), tg = nearestEnemy('hero', h.x + fx * range * .7, h.y + fy * range * .7, range * .7 + 24);
        if (tg && tg.team === 'foe' && !tg.boss && !(tg.arch && (tg.arch.tags || []).includes('object'))) {
          const dx = tg.x - h.x, dy = tg.y - h.y, gap = Math.hypot(dx, dy) - tg.r - range * .55;
          if (gap > 0 && (dx * fx + dy * fy) > 0) { const v = Math.min(220, Math.sqrt(2000 * Math.min(gap, 24))); h.vx += fx * v; h.vy += fy * v; }
        }
      }
      if (began === 'active') {
        const push = o.push === undefined ? 70 : o.push; h.vx += Math.cos(h.facing) * push; h.vy += Math.sin(h.facing) * push;
        sfx(o.sound || 'swing', { vol: .6 }); if (o.onStrike) o.onStrike(this);
      }
      if (st && st.phase === 'active' && st.u >= (st.spec.hitAt === undefined ? .3 : st.spec.hitAt)) {
        const range = typeof o.range === 'function' ? o.range(st.spec) : o.range, half = typeof o.half === 'function' ? o.half(st.spec) : o.half;
        hitCone('hero', h.x, h.y, h.facing, range, half, u => { const hh = o.hit(u, st.spec, this); if (o.onHit) o.onHit(u, this); return hh; }, this.set);
      }
      this.free = !st || st.phase === 'recover';
      if (o.tick) o.tick(this, dt);
      return atk.busy;
    } };
  return act;
}

/** a combo skill's chain outlives its action: moving out of a recovery (or a dodge, a knock) ends the action, and the next
 *  press picks the chain up where it stopped, inside the combo's own window, instead of starting over at the first hit.
 *  make() builds a fresh combo; key (the rune) keeps a chain from carrying over into a different set of moves.
 *  The action must call comboLeft(S) when it ends */
function comboResume(S, key, make) {
  const c = S.combo, t = S.comboEnd === undefined ? -9 : S.comboEnd;
  if (c && c.key === key && c.step >= 0 && c.step + 1 < c.moves.length && game.time - t <= c.window + .05 && !(ED.hero && ED.hero.dodgeT > 0)) return c;
  const n = make(); n.key = key; return (S.combo = n);
}
const comboLeft = S => { S.comboEnd = game.time; };

/* ---------- small pictograms for skill icons (16x16 at size 1) ---------- */
const ICON = {
  frame(g, x, y, s, c) { const t = E.tones(c); px.rect(g, x, y, 16 * s, 16 * s, t.deep); px.rect(g, x + s, y + s, 14 * s, 14 * s, t.sh); px.rect(g, x + s, y + s, 14 * s, 6 * s, t.base); px.rect(g, x + s, y + s, 14 * s, s, t.lt); },
  sword(g, x, y, s, c = '#dce8f1') { px.line(g, x + 3 * s, y + 13 * s, x + 12 * s, y + 3 * s, c, Math.max(1, Math.round(s * 1.4))); px.line(g, x + 3 * s, y + 9 * s, x + 7 * s, y + 13 * s, '#e8b04e', Math.max(1, s)); px.dot(g, x + 12 * s, y + 3 * s, '#ffffff'); },
  arc(g, x, y, s, c) { for (let i = 0; i < 9; i++) { const a = -2.4 + i * .42, rr = 6 * s; px.dot(g, x + 8 * s + Math.cos(a) * rr, y + 9 * s + Math.sin(a) * rr, c); px.dot(g, x + 8 * s + Math.cos(a) * (rr - s), y + 9 * s + Math.sin(a) * (rr - s), E.shade(c, .3)); } },
  orb(g, x, y, s, c) { px.disc(g, x + 8 * s, y + 8 * s, 4 * s, c); px.disc(g, x + 7 * s, y + 7 * s, 2 * s, E.tones(c).hi); px.line(g, x + 2 * s, y + 13 * s, x + 5 * s, y + 10 * s, c, s); },
  ring(g, x, y, s, c) { for (let i = 0; i < 20; i++) { const a = i / 20 * TAU; px.dot(g, x + 8 * s + Math.cos(a) * 5.5 * s, y + 8 * s + Math.sin(a) * 5.5 * s, c); } px.disc(g, x + 8 * s, y + 8 * s, 1.5 * s, '#ffffff'); },
  bolt(g, x, y, s, c) { px.poly(g, [[x + 9 * s, y + 2 * s], [x + 4 * s, y + 9 * s], [x + 8 * s, y + 9 * s], [x + 6 * s, y + 14 * s], [x + 12 * s, y + 6 * s], [x + 8 * s, y + 6 * s]], c); },
  boot(g, x, y, s, c) { px.rect(g, x + 5 * s, y + 3 * s, 4 * s, 8 * s, c); px.rect(g, x + 5 * s, y + 10 * s, 8 * s, 3 * s, c); px.line(g, x + 2 * s, y + 6 * s, x + 4 * s, y + 6 * s, '#ffffff'); px.line(g, x + s, y + 9 * s, x + 4 * s, y + 9 * s, '#ffffff'); },
  star(g, x, y, s, c) { const pts = []; for (let i = 0; i < 10; i++) { const a = i / 10 * TAU - Math.PI / 2, rr = (i % 2 ? 2.5 : 6) * s; pts.push([x + 8 * s + Math.cos(a) * rr, y + 8.5 * s + Math.sin(a) * rr]); } px.poly(g, pts, c); },
  fist(g, x, y, s, c) { px.rect(g, x + 4 * s, y + 5 * s, 8 * s, 7 * s, c); for (let i = 0; i < 4; i++) px.rect(g, x + (4 + i * 2) * s, y + 4 * s, s * 1.6, s * 2, E.shade(c, .2)); px.rect(g, x + 3 * s, y + 8 * s, 2 * s, 3 * s, c); },
  skull(g, x, y, s, c) { px.disc(g, x + 8 * s, y + 7 * s, 5 * s, c); px.rect(g, x + 5 * s, y + 10 * s, 6 * s, 3 * s, c); px.rect(g, x + 5.5 * s, y + 6 * s, 2 * s, 2 * s, '#140c1c'); px.rect(g, x + 8.5 * s, y + 6 * s, 2 * s, 2 * s, '#140c1c'); }
};
/** draw a skill's icon (framed in its element color); a missing icon draws its initial */
function drawSkillIcon(g, id, x, y, s = 1) {
  const S = REG.skills[id]; if (!S) return;
  ICON.frame(g, x, y, s, S.color || EL(S.el).dark);
  if (S.icon) S.icon(g, x, y, s); else E.font.text(g, S.name[0], x + 8 * s, y + 4 * s, '#ffffff', { align: 'center', scale: s });
}

/* ---------- BLADE DANCE (LMB): slash > backslash > spin, from the stress test; out of a dodge, a lunging thrust ----------
 * The first two cuts only rock a foe back (kb 70: still enough to break its wind-up) so the spin finisher lands on
 * it; the spin and the thrust throw it away. (At kb 130 a staggered husk slid ~50 units, out of the blade's reach,
 * and the finisher cut air; the spin at 230 threw the pack ~120 away, too far to flow into the next combo.) */
const BLADE_HIT = { slash: { range: 27, half: 1.35, dmg: 1, kb: 70, push: 70 }, backslash: { range: 27, half: 1.35, dmg: 1, kb: 70, push: 70 },
  spin: { range: 34, half: Math.PI, dmg: 1.7, kb: 180, push: 40, big: true }, thrust: { range: 38, half: .45, dmg: 1.6, kb: 220, push: 150, big: true } };
def('skills', 'blade', {
  name: 'Blade Dance', kind: 'basic', tags: ['melee', 'attack'], el: 'phys', cost: 0, gen: 6, unlock: 1, color: '#6a5a4a',
  runes: [{ id: 'rend', name: 'Rending Dance', desc: 'Every hit makes the enemy bleed.' }, { id: 'tempest', name: 'Tempest Dance', desc: 'The spin throws out a ring of cutting wind.' }],
  desc: (rank, rune) => 'Slash, backslash, then spin: each press chains the next hit. Attack out of a dodge for a lunging thrust. Generates Ember.' + (rune === 'rend' ? ' Hits cause bleeding.' : rune === 'tempest' ? ' The spin releases a wind ring.' : ''),
  icon: (g, x, y, s) => { ICON.sword(g, x, y, s); ICON.arc(g, x, y, s, '#8fe0f2'); },
  combo: null,
  cast(h, ctx) {
    const self = this, hitFor = (u, spec) => { const b = BLADE_HIT[spec.name] || BLADE_HIT.slash; return ctx.hit(b.dmg, { kb: b.kb, extra: { ang: angTo(h, u), status: ctx.rune === 'rend' ? 'bleed' : undefined, statusChance: ctx.rune === 'rend' ? 1 : undefined } }); };
    const E0 = ctx.el !== 'phys' ? EL(ctx.el) : null;   // an elemental weapon's cuts spark and burst in its colors
    const onHit = (u, act) => { const big = act.atk.state && BLADE_HIT[act.atk.state.spec.name] && BLADE_HIT[act.atk.state.spec.name].big, x = lerp(h.x, u.x, .65), y = lerp(h.y, u.y, .65), a = angTo(h, u); game.freeze(big ? .06 : .04); shake(big ? 3 : 2);
      P.sparks(x, y, 10, 7, a, E0 ? { color: E0.color, hot: E0.light } : undefined); P.impact(x, y, 12, big ? 8 : 6, E0 ? E0.light : undefined); if (E0 && (big || Math.random() < .3)) elBurst(x, y, 11, ctx.el, big ? 4 : 2, a); sfx('hit', { vol: .5 }); };   // (a burst on every cut of a pack was a fireball cloud over it)
    if (h.dodgeT > 0) {   // the lunge: keeps the dodge's direction, pierces the line
      h.dodgeT = 0; const atk = new E.Attack('thrust', { reach: 10 }); atk.start();
      const act = swingAction(h, atk, { name: 'thrust', range: BLADE_HIT.thrust.range, half: BLADE_HIT.thrust.half, push: BLADE_HIT.thrust.push, hit: hitFor, onHit, moveK: .1 });
      act.face = h.dodgeDir; act.ghost = '#8fe0f2'; return act;
    }
    h.facing = h.aim;
    const combo = comboResume(self, ctx.rune || '', () => new E.Combo(['slash', new E.Attack('backslash', { a1: 2.2, z1: -3 }), new E.Attack('spin', { z0: -12, z1: -12 })], { window: .3 }));
    combo.press();
    const act = swingAction(h, combo, { name: 'blade', range: spec => (BLADE_HIT[spec.name] || BLADE_HIT.slash).range * (spec.name === 'spin' ? ctx.area : 1), half: spec => (BLADE_HIT[spec.name] || BLADE_HIT.slash).half, push: 70, hit: hitFor, onHit,
      onStrike(a) { const n = combo.current.spec.name; a.set.clear(); if (BLADE_HIT[n]) { const p = BLADE_HIT[n].push - 70; h.vx += Math.cos(h.facing) * p; h.vy += Math.sin(h.facing) * p; }
        if (n === 'spin') { P.ring(h.x, h.y, 6, 30 * ctx.area, '#dff8ff', .3); if (ctx.rune === 'tempest') FX.nova({ team: 'hero', src: h, x: h.x, y: h.y, r0: 10, r1: 70 * ctx.area, dur: .4, el: 'phys', color: '#bff6ff', hit: ctx.hit(.6, { kb: 160 }) }); } } });
    act.combo = combo; act.end = () => comboLeft(self);
    return act;
  },
  again(h, act, ctx) {
    if (!act.combo) return false;
    if (act.combo.press()) { act.face = h.aim; h.facing = h.aim; act.gained = 0; return true; }
    return false;
  }
});

/* ---------- EMBER BOLT (RMB): the free hand hurls fire ---------- */
const EMBER_THROW = { rel: true, hand: 'L', a0: -2.3, a1: .2, z0: 1.5, z1: -1, reach: 8.5, wind: .07, active: .06, recover: .16, lunge: .9, lean: .3, twist: 1.3, blade: 0, hitAt: 0 };
def('skills', 'ember', {
  name: 'Ember Bolt', kind: 'core', tags: ['spell', 'proj'], el: 'fire', cost: 8, unlock: 1, color: '#8a3a1a',
  runes: [{ id: 'split', name: 'Scattered Embers', desc: 'Throws three bolts in a fan.' }, { id: 'blast', name: 'Ember Blast', desc: 'Bolts burst in a small fire nova.' }],
  desc: (rank, rune) => 'Hurl a bolt of fire from the free hand. It sets enemies burning.' + (rune === 'split' ? ' Three bolts in a fan.' : rune === 'blast' ? ' Bursts on impact.' : ''),
  icon: (g, x, y, s) => ICON.orb(g, x, y, s, '#ffb347'),
  cast(h, ctx) {
    const atk = new E.Attack(Object.assign({ name: 'emberthrow' }, EMBER_THROW)); atk.start(); h.facing = h.aim;
    const act = { name: 'ember', atk, moveK: .55, face: h.aim, cancel: true, speed: h.castMul, rig: { attack: null }, free: false,
      update(dt) {
        const began = atk.update(dt); this.rig.attack = atk.state;
        if (began === 'active') {
          const [hx, hy] = h.rig.hand('L'), n = 1 + ctx.proj + (ctx.rune === 'split' ? 2 : 0), spread = n > 1 ? .22 * (n - 1) : 0;
          for (let i = 0; i < n; i++) {
            const a = h.aim + (n > 1 ? (i / (n - 1) - .5) * spread : 0);
            FX.bolt({ team: 'hero', src: h, x: hx, y: hy, z: 11, ang: a, speed: 270, life: 1.1, r: 3, el: 'fire', pierce: ctx.pierce, chain: ctx.chains, hit: ctx.hit(1, { kb: 70, extra: { statusChance: .45 } }), look: { kind: 'bolt', color: '#ffb347', core: '#fff3c4', size: 2 },
              onEnd: ctx.rune === 'blast' ? p => FX.nova({ team: 'hero', src: h, x: p.x, y: p.y, r0: 3, r1: 26 * ctx.area, dur: .22, el: 'fire', hit: ctx.hit(.5, { kb: 90 }) }) : null });
          }
          sfx('shoot', { vol: .6 }); P.fire(hx, hy, 11, 3, { size: 2 });
        }
        this.free = !atk.state || atk.state.phase === 'recover';
        return atk.busy;
      } };
    return act;
  }
});
