/* =============================================================================
 * LOOT CONTENT: more bases, legendary powers, uniques, rich item icons, clicking loot off the ground, thorns
 * Powers are build-defining: each is slot-restricted, installs BUS listeners that check hasPower, and shows
 * itself on screen. Skill powers only hook the generic events ('skill' {id}, 'hit' {hit.skill}, 'kill') and the
 * hero's current action (act.skill, act.rig.attack), never another module's internals, so they work with
 * whatever skills exist. Unique-only powers have slots: [] so legendaries never roll them.
 * UNIQUES have fixed stats, a power, flavor and a look that changes the hero's rig (colors, hats, blades, capes,
 * glowing eyes); look.smear recolors the swing ribbon and look.glow makes the weapon shine (both read here).
 * drawItemIconEx(g, it, x, y, s) is the rich icon: shaded with E.tones, outlined, cached per item and size.
 * Deep content: bases that keep arriving to item level 50, powers with a minIlvl (Riftrending 22, Stormcrowned 32) and
 * uniques whose powers are composed words ('cx.slay.vortex.void', ranked by the depth they drop at).
 * Tooltips show every rolled line's pip (how close its tier is to the best that item level rolls; a star when greater),
 * a hybrid's second stat, and with Alt (or Shift) held each line's tier, tier name and the range that tier rolls.
 * Private names start with LOT_. Everything the inventory and shop panels (42-inventory.js) share lives here too
 * (LOT_drawTip, LOT_cell, LOT_pip and LOT_rangeText for any list of lines, LOT_compare).
 * ============================================================================= */

/* ---------- more bases (the core's W / AR helpers and palettes) ---------- */
W('dirk', 'Dirk', 2, [3, 7], { bladeLen: 7, colors: { metal: '#e8ecf4', metalDk: '#6a7080', hilt: '#3a2a2a' } }, { implicit: { atkSpeed: 10, crit: 2 } });
W('falchion', 'Falchion', 3, [6, 12], { bladeLen: 10, colors: { metal: '#e0d8c8', metalDk: '#6a6258', hilt: '#8a3a2a' } }, { implicit: { dmgPct: 10 } });
W('emberbrand', 'Emberbrand', 6, [8, 15], { bladeLen: 11, colors: { metal: '#ffc890', metalDk: '#a04a1a', hilt: '#3a1a10' } }, { implicit: { incFire: 15 }, el: 'fire' });
W('claymore', 'Claymore', 10, [14, 24], { bladeLen: 15, colors: { metal: '#c0c8d8', metalDk: '#485060', hilt: '#3a2a4a' } }, { implicit: { atkSpeed: -10, area: 15 } });
W('tempestrod', 'Tempest Rod', 8, [6, 14], { weapon: 'staff', colors: { staff: '#3a3a5a', orb: '#fff08a' } }, { implicit: { incStorm: 20, castSpeed: 8 }, el: 'storm' });
W('blightstaff', 'Blight Staff', 10, [6, 14], { weapon: 'staff', colors: { staff: '#3a4a2a', orb: '#9ae05a' } }, { implicit: { incVenom: 20, statusChance: 15 }, el: 'venom' });
W('hollowrod', 'Hollow Scepter', 12, [7, 15], { weapon: 'staff', colors: { staff: '#2a1a3a', orb: '#c890ff' } }, { implicit: { incVoid: 20, castSpeed: 8 }, el: 'void' });
AR('ranger', 'helm', "Ranger's Cap", 2, 3, { hat: { style: 'cap', color: '#3a6a4a' } }, { implicit: { moveSpeed: 3 } });
AR('cowl', 'helm', 'Shadow Cowl', 4, 3, { hood: true, colors: { hair: '#2a2438' } }, { implicit: { dodge: 3 } });
AR('greathelm', 'helm', 'Great Helm', 9, 11, { hat: { style: 'helmet', color: '#b8c0d0' } }, { implicit: { resAll: 4 } });
AR('diadem', 'helm', 'Diadem', 10, 4, { hat: { style: 'band', color: '#e8e8f0' } }, { implicit: { castSpeed: 6, ember: 10 } });
AR('brigandine', 'chest', 'Brigandine', 6, 15, { outfit: 'coat', armor: true, sleeves: 'long' }, { colors: LEATHER, implicit: { life: 10 } });
AR('vestments', 'chest', 'Vestments', 7, 5, { outfit: 'robe', sleeves: 'long', colors: { trim: '#e8c040' } }, { colors: CLOTH, implicit: { incSpell: 10, ember: 10 } });
AR('duster', 'chest', "Wanderer's Coat", 10, 12, { outfit: 'coat', sleeves: 'long' }, { colors: LEATHER, implicit: { dodge: 4, moveSpeed: 3 } });
AR('warplate', 'chest', 'War Plate', 14, 28, { outfit: 'tunic', armor: true, sleeves: 'long', colors: { trim: '#c8b078' } }, { colors: CLOTH, implicit: { moveSpeed: -4, resAll: 5 } });
AR('bracers', 'gloves', 'Bracers', 3, 4, {}, { colors: LEATHER, lookKey: 'glove', implicit: { atkSpeed: 4 } });
AR('silkgloves', 'gloves', 'Silk Gloves', 6, 2, {}, { colors: ['#e8e0f0', '#3a2a5a', '#8a2a3a', '#2a4a5a'], lookKey: 'glove', implicit: { castSpeed: 6 } });
AR('chausses', 'legs', 'Mail Chausses', 3, 6, {}, { colors: METAL, lookKey: 'pants' });
AR('leggings', 'legs', 'Leggings', 4, 4, {}, { colors: ['#4a3a5a', '#2a3a4a', '#5a2a2a', '#2a4a3a'], lookKey: 'pants', implicit: { dodge: 2 } });
AR('treads', 'boots', 'Swift Treads', 6, 4, {}, { colors: LEATHER, lookKey: 'boot', implicit: { moveSpeed: 6 } });
AR('shroud', 'cloak', 'Shroud', 8, 3, { cape: { len: 9, width: 5, seg: 2.6 } }, { colors: ['#1e1e2a', '#2a1a3a', '#3a1a1a', '#1a2a2a'], lookKey: 'cape', implicit: { dodge: 3 } });
AR('warcloak', 'cloak', 'War Cloak', 11, 6, { cape: { len: 7, width: 7, seg: 2.5 } }, { colors: CAPES, lookKey: 'cape', implicit: { life: 12 } });
def('itemBases', 'talisman', { slot: 'amulet', name: 'Talisman', minIlvl: 6, weight: 6, shape: 'talisman', gems: ['#e04a4a', '#4a8ae0', '#b070ff', '#ffb040'], implicit: { resAll: 3 } });
def('itemBases', 'signet', { slot: 'ring', name: 'Signet', minIlvl: 5, weight: 6, shape: 'signet', gems: ['#c8a040', '#b9c1cf', '#d88a5a'], implicit: { incDmg: 3 } });
/* ---------- deep bases: new shapes keep arriving past the planned depths (grades then carry every base deeper) ---------- */
W('moonblade', 'Moonblade', 18, [11, 19], { bladeLen: 12, colors: { metal: '#dfe8ff', metalDk: '#5a6a9a', hilt: '#c8c8e0' } }, { implicit: { crit: 3, critDmg: 15 }, weight: 12 });
W('headsman', "Headsman's Blade", 24, [19, 31], { bladeLen: 16, colors: { metal: '#b8b0a8', metalDk: '#4a3a3a', hilt: '#3a1a1a' } }, { implicit: { incElite: 20, knockback: 30, atkSpeed: -12 }, weight: 12 });
W('starstaff', 'Starfall Staff', 28, [11, 22], { weapon: 'staff', colors: { staff: '#2a2a4a', orb: '#fff4d0' } }, { implicit: { incSpell: 25, area: 10 }, weight: 12 });
W('wyrmfang', 'Wyrmfang', 36, [13, 24], { bladeLen: 13, colors: { metal: '#f0e0c0', metalDk: '#8a6a4a', hilt: '#3a2a1a' } }, { implicit: { incFire: 15, incVenom: 15 }, el: 'fire', weight: 12 });
W('glacierrod', 'Glacial Scepter', 42, [12, 23], { weapon: 'staff', colors: { staff: '#5a7aa0', orb: '#dff8ff' } }, { implicit: { incFrost: 25, statusChance: 15 }, el: 'frost', weight: 12 });
W('sunsword', 'Sunsword', 50, [14, 26], { bladeLen: 13, colors: { metal: '#fff0b0', metalDk: '#b08a2a', hilt: '#8a2a1a' } }, { implicit: { incFire: 20, incDmg: 8 }, el: 'fire', weight: 12 });
AR('dragonhelm', 'helm', 'Dragon Helm', 22, 14, { hat: { style: 'helmet', color: '#6a8a5a' } }, { implicit: { resAll: 6 }, weight: 12 });
AR('hornedcrown', 'helm', 'Horned Crown', 34, 8, { hat: { style: 'crown', color: '#b890e0' } }, { implicit: { incDmg: 8, magicFind: 10 }, weight: 12 });
AR('shadowweave', 'chest', 'Shadowweave', 26, 8, { outfit: 'robe', sleeves: 'long' }, { colors: ['#2a1a3a', '#1a2a3a', '#3a1a2a', '#1e1e2a'], implicit: { dodge: 5, incVoid: 12 }, weight: 12 });
AR('sunplate', 'chest', 'Sunplate', 32, 34, { outfit: 'tunic', armor: true, sleeves: 'long', colors: { trim: '#ffd060' } }, { colors: CLOTH, implicit: { lifePct: 8, resFire: 10 }, weight: 12 });
AR('scalegreaves', 'legs', 'Scaled Greaves', 28, 16, {}, { colors: METAL, lookKey: 'pants', implicit: { resAll: 5, life: 15 }, weight: 12 });
AR('stormcloak', 'cloak', 'Stormcloak', 30, 6, { cape: { len: 9, width: 6.5, seg: 2.6 } }, { colors: ['#2a3a5a', '#3a3a4a', '#4a4a6a', '#1a2a3a'], lookKey: 'cape', implicit: { resStorm: 15, moveSpeed: 4 }, weight: 12 });
AR('titangrips', 'gloves', 'Titan Grips', 38, 14, {}, { colors: METAL, lookKey: 'glove', implicit: { knockback: 25, armorPct: 12 }, weight: 12 });
AR('phasewalkers', 'boots', 'Phasewalkers', 44, 9, {}, { colors: ['#3a2a5a', '#1a3a4a', '#4a2a3a'], lookKey: 'boot', implicit: { moveSpeed: 8, dodgeCd: 15 }, weight: 12 });
def('itemBases', 'oculus', { slot: 'amulet', name: 'Oculus', minIlvl: 24, weight: 8, gems: ['#e8f0ff', '#ff4a6a', '#4affc8'], implicit: { critDmg: 15 } });
def('itemBases', 'agesband', { slot: 'ring', name: 'Band of Ages', minIlvl: 38, weight: 8, shape: 'signet', gems: ['#e8e8f0', '#ffd84a', '#9fe8ff'], implicit: { cdr: 4 } });

/* ---------- helpers every power uses ---------- */
/** a hit that came from a proc, a chain, thorns, a dot or a composed power: procs never trigger procs (no feedback loops) */
const LOT_isProc = isProcHit;
/** listen to a BUS event only while the hero wears power id: fn(e, h) */
const LOT_on = (id, ev, fn) => BUS.on(ev, e => { const h = ED.hero; if (h && h.alive && hasPower(h, id)) fn(e, h); });
/** a per-hero cooldown: true (and restarts it) when key is ready */
const LOT_ready = (h, k, cd) => { const c = h._lotCd || (h._lotCd = {}); if (c[k] > game.time) return false; c[k] = game.time + cd; return true; };
/** a hero hit marked as a proc */
const LOT_hit = (h, scale, o = {}) => heroHit(h, scale, Object.assign({}, o, { extra: Object.assign({ proc: true }, o.extra || {}) }));
/** add or refresh a buff (the HUD shows it) */
function LOT_buff(h, id, name, color, t, stats) {
  let b = h.buffs.find(q => q.id === id);
  if (b) { b.t = Math.max(b.t, t); b.name = name; b.stats = stats; } else h.buffs.push(b = { id, name, color, t, stats });
  computeStats(h); return b;
}
/** spinning blades flying out from a point (dodges, spins, blade throws) */
function LOT_blades(h, x, y, z, angs, o = {}) {
  for (const a of angs) FX.bolt({ team: 'hero', src: h, x, y, z, ang: a, speed: o.speed || 230, life: o.life || .6, r: 4, el: 'phys', pierce: o.pierce === undefined ? 2 : o.pierce, tags: ['proj', 'proc'],
    hit: LOT_hit(h, o.scale || .4, { kb: 70 }), look: { kind: 'blade', color: o.color || '#bff6ff', core: '#ffffff' }, light: 22 });
}
/** a world point on the hero's rig -> buffer pixel, projected like the rig itself (steep views draw rigs from a lower angle) */
function LOT_rigPt(r, h, p) {
  const rig = h.rig, cv = rig.o.charView !== false ? E.charView(r.view) : r.view, s = r.w(rig.x, rig.y, rig.z), q = cv.p(p[0] - rig.x, p[1] - rig.y, p[2] - rig.z);
  return [s[0] + q[0], s[1] + q[1]];
}
/** a joint of the hero's rig in world space (chest 'shC', feet 'footL' / 'footR'...) */
const LOT_joint = (h, k) => { const rig = h.rig, J = rig.J[k]; if (!J) return [h.x, h.y, h.z + 12]; const w = rig._w(J); return [rig.x + w[0], rig.y + w[1], rig.z + w[2]]; };
const LOT_town = () => !!(ED.L && ED.L.kind === 'town');

/* the hero's strikes: the hero emits 'strike' as any action's rig attack enters its 'active' phase (a Blade Dance combo
   press emits no 'skill' event, so this is how powers see every swing). LOT_strike(id, fn(h, act, spec)) runs while power id is worn */
const LOT_STRIKE = [], LOT_TICK = [], LOT_DRAW = [];
const LOT_strike = (id, fn) => LOT_STRIKE.push({ id, fn });
/** per-step and per-draw hooks for a power (fn(h, dt) / fn(h, r)) */
const LOT_tick = (id, fn) => LOT_TICK.push({ id, fn }), LOT_drawFx = (id, fn) => LOT_DRAW.push({ id, fn });
const LOT_isMelee = act => { const S = act && act.skill && REG.skills[act.skill]; return !!(S && S.tags && S.tags.includes('melee')); };
BUS.on('step', e => {
  const h = ED.hero; if (!h || !h.rig) return;
  for (const s of LOT_TICK) if (hasPower(h, s.id)) s.fn(h, e.dt);
  // uniques recolor the swing ribbon (look.smear) and some burn at the feet
  const w = h.gear.weapon; if (w && w.look && w.look.smear && !h._mkaWard) h.smear = w.look.smear;   // (a ward's empowered trail wins while he stands in it)
  const bt = h.gear.boots; if (bt && bt.unique === 'ashwalker' && Math.hypot(h.vx, h.vy) > 25 && Math.random() < e.dt * 26) { const f = LOT_joint(h, Math.random() < .5 ? 'footL' : 'footR'); P.add({ kind: Math.random() < .4 ? 'fire' : 'ember', x: f[0], y: f[1], z: f[2] + 1, vz: 16, g: -8, drag: 3, max: .4, size: 1.6, color: '#ff8a3a' }); }
});
BUS.on('strike', e => { for (const s of LOT_STRIKE) if (hasPower(e.h, s.id)) s.fn(e.h, e.act, e.spec || {}); });
BUS.on('draw', e => {
  const h = ED.hero, r = e.r; if (!h || !h.rig || !h.alive || h.dead) return;
  for (const s of LOT_DRAW) if (hasPower(h, s.id)) s.fn(h, r);
  const w = h.gear.weapon, c = w && w.look && w.look.glow;
  if (c) {   // a unique weapon shines: a thin light along the edge, a soft halo at the point, a star that twinkles now and then
    const tip = h.rig.tip(), hand = h.rig.hand('R'), staff = w.look.weapon === 'staff', pul = .5 + .5 * Math.sin(game.time * 5), k = (game.time * 1.1 + h.x * .01) % 1;
    r.queue(tip[0], tip[1], tip[2], g => {
      const [tx, ty] = LOT_rigPt(r, h, tip), [hx, hy] = LOT_rigPt(r, h, hand), zm = r.view.zoom || 1;
      px.glow(g, 1);
      if (!staff) px.blend(g, .3 + .15 * pul, 'add', () => px.line(g, lerp(hx, tx, .3), lerp(hy, ty, .3), tx, ty, c));
      r.glowDisc(g, tx, ty, (staff ? 3.5 : 2.2) * zm, c, .22 + .14 * pul);
      if (k < .22) { const R = Math.max(1, Math.round(Math.sin(k / .22 * Math.PI) * 3 * zm)); px.rect(g, tx - R, ty, R * 2 + 1, 1, '#ffffff'); px.rect(g, tx, ty - R, 1, R * 2 + 1, '#ffffff'); }
    }, { emissive: true, bias: .55 });
    L.add(tip[0], tip[1], tip[2], staff ? 40 : 26, .35 + .2 * pul, { color: c });
    if (Math.random() < .05) P.glints(tip[0], tip[1], tip[2], 1, c, 3);
  }
});

/* ---------- small effect pictures the powers share ---------- */
/** a ring of spikes that burst out of the floor and sink back (thorns, fissures) */
function LOT_spikes(x, y, R, col = '#b8a878', n = 12) {
  const t0 = Math.random() * TAU, t = E.tones(col);
  FX.visual(.5, (r, u) => {
    const k = u < .25 ? u / .25 : 1 - (u - .25) / .75, rad = R * Math.min(1, u * 4), zm = r.view.zoom || 1;
    for (let i = 0; i < n; i++) {
      const a = t0 + i / n * TAU, d = rad * (.75 + .25 * ((i * 7) % 3) / 2), sx = x + Math.cos(a) * d, sy = y + Math.sin(a) * d, hh = (6 + (i % 3) * 2) * k;
      if (!r.visible(sx, sy, 0, 20, 20, 20)) continue;
      r.queue(sx, sy, 0, g => { const [bx, by] = r.w(sx, sy, 0), [tx, ty] = r.w(sx + Math.cos(a) * 2, sy + Math.sin(a) * 2, hh); px.poly(g, [[bx - 2 * zm, by], [tx, ty], [bx + 2 * zm, by]], t.sh); px.line(g, bx - 1, by, tx, ty, t.lt); px.dot(g, tx, ty, t.hi); });
    }
  });
}
/** a burst of ice: shards, glints and a crack of sound */
function LOT_iceBurst(x, y, z = 10, n = 10) {
  P.bits(x, y, z, n, ['#bfefff', '#7fd8ff', '#ffffff', '#4bb1d4']); P.glints(x, y, z, 4, '#e8fbff', 14); P.ring(x, y, 3, 22, '#bfefff', .3); sfx('crack', { vol: .5, pitch: 1.4 });
}
/** a flying ice shard (FX.bolt look.draw): a diamond along its path */
const LOT_SHARD = { draw(g, x, y, p, r) {
  const a = Math.atan2(p.vy, p.vx), ca = Math.cos(a), sa = Math.sin(a), P0 = (f, s) => r.w(p.x + ca * f - sa * s, p.y + sa * f + ca * s, p.z);
  const tip = P0(4.5, 0), tail = P0(-3.5, 0), l = P0(0, 1.6), rr = P0(0, -1.6);
  px.glow(g, 1); px.poly(g, [tip, l, tail, rr], '#7fd8ff'); px.poly(g, [tip, l, [(tip[0] + tail[0]) / 2, (tip[1] + tail[1]) / 2]], '#dff8ff'); px.dot(g, tip[0], tip[1], '#ffffff');
} };
/** a crescent of cutting wind (FX.bolt look.draw): a diagonal slash standing in the air, bulging where it flies */
const LOT_CRESCENT = { draw(g, x, y, p, r) {
  const a = Math.atan2(p.vy, p.vx), fx = Math.cos(a), fy = Math.sin(a), sx = -fy, sy = fx, fade = clamp((p.life - p.t) / .15, 0, 1), W0 = 10, B = 5, ct = Math.cos(.6), st = Math.sin(.6);
  const P0 = (k, f) => r.w(p.x + fx * f + sx * k * W0 * ct, p.y + fy * f + sy * k * W0 * ct, p.z + k * W0 * st), out = [], inn = [];
  for (let i = 0; i <= 10; i++) { const k = i / 5 - 1, b = (1 - k * k) * B; out.push(P0(k, b)); inn.unshift(P0(k * .9, b * .25 - 1)); }
  px.glow(g, 1);
  px.blend(g, .4 * fade, 'add', () => px.poly(g, out.concat(inn), '#8fe0f2'));
  px.blend(g, .9 * fade, 'normal', () => { for (let i = 0; i < out.length - 1; i++) px.line(g, out[i][0], out[i][1], out[i + 1][0], out[i + 1][1], i >= 3 && i <= 6 ? '#ffffff' : '#bff6ff', i >= 4 && i <= 5 ? 2 : 1); });
} };
/** a whirling wind around the hero: bright arcs that spiral in, and dust drawn along them */
function LOT_vortex(h, dur, R, keep) {
  FX.visual(dur, (r, u, f) => {
    const a = Math.min(1, f.t * 6, (dur - f.t) * 4), t = game.time * 8;
    r.decal(() => {
      const g = r.tgt;
      for (let k = 0; k < 4; k++) {
        const rr = R * (.35 + k * .18), a0 = t * (1 + k * .15) + k * 1.6, pts = [];
        for (let i = 0; i <= 10; i++) { const an = a0 + i / 10 * 2.2, q = rr * (1 - i * .035); pts.push(r.w(h.x + Math.cos(an) * q, h.y + Math.sin(an) * q, 1)); }
        px.blend(g, .6 * a, 'add', () => { for (let i = 0; i < pts.length - 1; i++) px.line(g, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], i > 6 ? '#ffffff' : '#bfe8f0'); });
      }
    }, { emissive: .6 * a });
  }, (f, dt) => { if (keep && !keep() && f.t < dur - .25) f.t = dur - .25; if (Math.random() < dt * 50) { const an = Math.random() * TAU, d = R * (.55 + Math.random() * .45); P.add({ kind: 'dust', x: h.x + Math.cos(an) * d, y: h.y + Math.sin(an) * d, z: 2 + Math.random() * 10, vx: -Math.cos(an) * d * 1.8 + Math.cos(an + 1.5) * 70, vy: -Math.sin(an) * d * 1.8 + Math.sin(an + 1.5) * 70, drag: 2, max: .45, size: 1.3, color: '#d8d0c0' }); } });
}
/** a fissure torn along the ground: a dark crack with a hot seam that races out and cools */
function LOT_fissure(x, y, ang, len, speed = 240, dur = 1.5) {
  const pts = [], sx = -Math.sin(ang), sy = Math.cos(ang);
  for (let d = 0; d <= len; d += 6) { const j = d ? (Math.random() - .5) * 6 : 0; pts.push([x + Math.cos(ang) * d + sx * j, y + Math.sin(ang) * d + sy * j]); }
  FX.visual(dur, (r, u, f) => {
    const n = Math.min(pts.length - 1, Math.floor(f.t * speed / 6)), fade = clamp((dur - f.t) / .6, 0, 1);
    r.decal(() => {
      const g = r.tgt;
      for (let i = 0; i < n; i++) {
        const A = r.w(pts[i][0], pts[i][1], 0), B = r.w(pts[i + 1][0], pts[i + 1][1], 0), hot = clamp(1 - (f.t - i * 6 / speed) * 1.4, 0, 1);
        px.blend(g, fade, 'normal', () => { px.line(g, A[0], A[1] + 1, B[0], B[1] + 1, '#140c10', 2); px.line(g, A[0], A[1], B[0], B[1], hot > .1 ? E.mix('#6a3a2a', '#ffc070', hot) : '#3a2420'); });
      }
    }, { emissive: .6 * fade });
  });
}
/** a molten crater: a dark scorched ring with glowing cracks, for dur seconds */
function LOT_crater(x, y, R, dur) {
  const seed = Math.random() * TAU;
  FX.visual(dur, (r, u) => {
    const fade = clamp((1 - u) * dur / 1.2, 0, 1), pul = .5 + .5 * Math.sin(game.time * 6 + x);
    r.decal(() => {
      const g = r.tgt;
      r.groundDisc(x, y, R, '#1a0c08', .6 * fade); r.groundDisc(x, y, R * .7, '#ff5a1a', (.28 + .12 * pul) * fade); r.groundRing(x, y, R, '#5a2a1a', .9 * fade);
      for (let i = 0; i < 7; i++) {
        const a = seed + i / 7 * TAU, p0 = r.w(x + Math.cos(a) * R * .25, y + Math.sin(a) * R * .25, 0), p1 = r.w(x + Math.cos(a + .25) * R * .62, y + Math.sin(a + .25) * R * .62, 0), p2 = r.w(x + Math.cos(a - .1) * R * 1.05, y + Math.sin(a - .1) * R * 1.05, 0);
        px.blend(g, fade, 'normal', () => { px.line(g, p0[0], p0[1], p1[0], p1[1], '#ffd070'); px.line(g, p1[0], p1[1], p2[0], p2[1], '#ff7a2a'); });
      }
    }, { emissive: .9 * fade });
    L.add(x, y, 4, R + 26, .6 * fade, { color: '#ff7a2a' });
  });
}
/** freeze everything around a point in time (bosses only slow) */
function LOT_timeStop(x, y, R, t) {
  eachEnemy('hero', x, y, R, m => { if (m.boss) { m.st.slow = { t }; return; } m.st.freeze = { t }; m.vx = m.vy = 0; if (m.atk) m.atk = null; });
  FX.visual(.7, (r, u) => {
    const k = E.ease.outQuad(u), a = 1 - u;
    r.decal(() => { r.groundDisc(x, y, R * k, '#8fe3ff', .14 * a); r.groundRing(x, y, R * k, '#bff6ff', .9 * a); r.groundRing(x, y, R * k * .7, '#8fe3ff', .6 * a);
      const g = r.tgt; for (let i = 0; i < 12; i++) { const an = i / 12 * TAU + u * .6, p0 = r.w(x + Math.cos(an) * R * k * .88, y + Math.sin(an) * R * k * .88, 0), p1 = r.w(x + Math.cos(an) * R * k, y + Math.sin(an) * R * k, 0); px.blend(g, a, 'normal', () => px.line(g, p0[0], p0[1], p1[0], p1[1], '#ffffff')); } }, { emissive: .8 * a });
  });
  sfx('freeze'); game.flash('#bff6ff', .12, .35);
}

/* =============================================================================
 * LEGENDARY POWERS
 * ============================================================================= */
/* ---- skill modifiers (the contract's skill ids) ---- */
def('powers', 'maelstrom', { name: 'Maelstrom', slots: ['weapon', 'gloves', 'amulet'], desc: 'Whirlwind drags every enemy around you into its edge. The spin of Blade Dance pulls them in too.',
  install() {
    const vortex = (h, dur, whirl) => { const f0 = FX.pull({ team: 'hero', src: h, x: h.x, y: h.y, r: 72, force: 320, dur, el: 'phys', onTick: f => { f.x = h.x; f.y = h.y; if (whirl && !(h.act && h.act.skill === 'whirlwind')) f.dur = Math.min(f.dur, f.t + .15); } }); f0.draw = null; LOT_vortex(h, dur + .15, 64, whirl ? () => h.act && h.act.skill === 'whirlwind' : null); return f0; };
    LOT_on('maelstrom', 'skill', (e, h) => { if (e.id === 'whirlwind') vortex(h, 8, true); });
    LOT_strike('maelstrom', (h, act, spec) => { if (spec.spin) { vortex(h, .5, false); P.ring(h.x, h.y, 70, 8, '#e8dcc8', .35); sfx('whoosh', { vol: .5, pitch: .7 }); } });
  } });
def('powers', 'splinter', { name: 'Splintering', slots: ['weapon', 'gloves', 'ring'], desc: 'Ember Bolt splits into two smaller bolts when it hits, and each of those splits again.',
  install() { LOT_on('splinter', 'hit', (e, h) => {
    if (e.src !== h || e.hit.skill !== 'ember' || (e.hit.gen || 0) >= 2) return;
    const gen = (e.hit.gen || 0) + 1, a0 = e.hit.ang !== undefined ? e.hit.ang : angTo(h, e.tgt), m = e.tgt;
    for (const s of [-1, 1]) FX.bolt({ team: 'hero', src: h, x: m.x, y: m.y, z: 11, ang: a0 + s * .6, speed: 250, life: .42, r: 3, el: 'fire', hitSet: new Set([m]), tags: ['spell', 'proj'],
      hit: Object.assign(heroHit(h, .5, { el: 'fire', tags: ['spell', 'proj'], skill: 'ember' }), { gen, statusChance: .35 }), look: { kind: 'bolt', color: '#ffb347', core: '#fff3c4', size: 2 - gen * .4 }, light: 18 });
    P.sparks(m.x, m.y, 12, 6, a0, { color: '#ffb347', hot: '#fff3c4' }); sfx('shoot', { vol: .25, pitch: 1.6 });
  }); } });
def('powers', 'cinderfall', { name: 'Cinderfall', slots: ['boots', 'legs'], desc: 'Every landing from a Leap (or any great height) leaves a crater of molten rock that burns enemies for 4 seconds.',
  install() {
    LOT_tick('cinderfall', (h, dt) => {
      if (h.z > 1) { h._lotPeak = Math.max(h._lotPeak || 0, h.z); return; }
      if ((h._lotPeak || 0) > 9 && !LOT_town()) {
        const R = 26 * (1 + (h.stats.area || 0) / 100);
        FX.area({ team: 'hero', src: h, x: h.x, y: h.y, r: R, dur: 4, el: 'fire', tick: .4, light: false, tags: ['aoe', 'dot', 'proc'], hit: LOT_hit(h, .32, { el: 'fire', tags: ['aoe'], extra: { statusChance: .4, kb: 0 } }) });
        FX.nova({ team: 'hero', src: h, x: h.x, y: h.y, r0: 6, r1: R + 6, dur: .22, el: 'fire', tags: ['aoe', 'proc'], hit: LOT_hit(h, .9, { el: 'fire', kb: 140, extra: { up: 60 } }) });
        LOT_crater(h.x, h.y, R, 4); P.explosion(h.x, h.y, 2, .8, { flash: false, freeze: false }); shake(4); sfx('thud');
      }
      h._lotPeak = 0;
    });
  } });
def('powers', 'shatterglass', { name: 'Shatterglass', slots: ['weapon', 'helm', 'amulet'], desc: 'Frost Nova shatters frozen and deeply chilled enemies for massive damage. Frozen enemies you kill burst into ice shards.',
  install() {
    LOT_on('shatterglass', 'skill', (e, h) => { if (e.id !== 'frostnova') return; game.after(.2, () => eachEnemy('hero', h.x, h.y, 120, m => {
      const fr = m.st.freeze, ch = m.st.chill && m.st.chill.n >= 3; if (!fr && !ch) return;
      dealDamage(m, LOT_hit(h, fr ? 2.4 : 1.3, { el: 'frost', tags: ['aoe', 'spell'], kb: 90, extra: { ang: angTo(h, m), statusChance: 0 } })); LOT_iceBurst(m.x, m.y, 12, 12); if (fr) { delete m.st.freeze; game.freeze(.04); } })); });
    // a kill on a frozen enemy (the kill event carries the statuses it died with)
    LOT_on('shatterglass', 'kill', (e, h) => { const m = e.tgt; if (e.src !== h || m.team !== 'foe' || !(e.st && e.st.freeze)) return; LOT_iceBurst(m.x, m.y, 12, 16);
      for (let i = 0; i < 6; i++) FX.bolt({ team: 'hero', src: h, x: m.x, y: m.y, z: 10, ang: i / 6 * TAU + Math.random() * .4, speed: 190, life: .45, r: 3, el: 'frost', pierce: 1, tags: ['proj', 'proc'], hit: LOT_hit(h, .5, { el: 'frost', kb: 60, extra: { statusChance: .6 } }), look: LOT_SHARD, light: 16 }); });
  } });
def('powers', 'resonant', { name: 'Resonant', slots: ['helm', 'amulet', 'ring'], desc: 'Echo and every other summon last 60% longer and shed embers that burn enemies near them.',
  install() {
    LOT_tick('resonant', (h, dt) => {
      for (const a of ED.allies) {
        if (!a._lotRes) { a._lotRes = true; for (const k of ['life', 'dur', 'ttl', 'lifetime', 'max']) if (typeof a[k] === 'number' && a[k] > 0 && a[k] < 120) a[k] *= 1.6; }
        if (!a.alive && a.alive !== undefined) continue;
        a._lotBurn = (a._lotBurn || 0) - dt;
        if (a._lotBurn <= 0 && a.x !== undefined) { a._lotBurn = .5; hitCircle('hero', a.x, a.y, 20, () => LOT_hit(h, .18, { el: 'fire', tags: ['aoe'], extra: { statusChance: .3, kb: 0 } })); }
        if (Math.random() < dt * 22 && a.x !== undefined) P.add({ kind: Math.random() < .3 ? 'fire' : 'ember', x: a.x + (Math.random() - .5) * 12, y: a.y + (Math.random() - .5) * 12, z: 2 + Math.random() * 14, vz: 22, g: -6, drag: 2, max: .6, size: 1.6, color: '#ff9a4a' });
      }
    });
    LOT_drawFx('resonant', (h, r) => { for (const a of ED.allies) if (a.x !== undefined && a.alive !== false) { const p = .5 + .5 * Math.sin(game.time * 6 + a.x); r.decal(() => { r.groundDisc(a.x, a.y, 15, '#ff5a1a', .22); r.groundRing(a.x, a.y, 15, '#ffb050', .75 + .2 * p); r.groundRing(a.x, a.y, 11 + p * 2, '#ffe070', .5); }, { emissive: .8 }); L.add(a.x, a.y, 10, 44, .6, { color: '#ff9a4a' }); } });
  } });
def('powers', 'flicker', { name: 'Flickering', slots: ['boots', 'cloak'], desc: 'Kills reset the cooldown of Blink and refund a dodge charge (once per second).',
  install() { LOT_on('flicker', 'kill', (e, h) => {
    if (e.src !== h || e.tgt.team !== 'foe' || !LOT_ready(h, 'flicker', 1)) return;
    let did = false; if (h.cds.blink > 0) { delete h.cds.blink; did = true; } if (h.dodges < h.maxDodge) { h.dodges++; did = true; }
    if (did) { P.ring(h.x, h.y, 3, 20, '#8fe3ff', .3); P.glints(h.x, h.y, 14, 5, '#bff6ff', 12); sfx('blip', { vol: .4, pitch: 1.6 }); }
  }); } });
def('powers', 'seismic', { name: 'Seismic', slots: ['weapon', 'gloves'], desc: 'Cleave, Uppercut, Kick and Lunge tear a fissure along the ground that launches enemies.',
  install() { LOT_on('seismic', 'skill', (e, h) => {
    if (!['cleave', 'uppercut', 'kick', 'lunge'].includes(e.id)) return;
    game.after(.1, () => { if (!h.alive) return; FX.wave({ team: 'hero', src: h, x: h.x, y: h.y, ang: h.facing, speed: 240, len: 120, w: 18, el: 'phys', up: 130, hit: LOT_hit(h, .9, { kb: 90 }) }); LOT_fissure(h.x + Math.cos(h.facing) * 6, h.y + Math.sin(h.facing) * 6, h.facing, 120); shake(3); sfx('crack', { vol: .6 }); P.dust(h.x, h.y, 0, 8, { speed: 50 }); });
  }); } });
def('powers', 'starfall', { name: 'Starfall', slots: ['helm', 'amulet'], desc: 'Meteor calls down two more meteors around the first.',
  install() { LOT_on('starfall', 'skill', (e, h) => {
    if (e.id !== 'meteor') return; const tx = (e.ctx && e.ctx.tx) || h.tx || h.x, ty = (e.ctx && e.ctx.ty) || h.ty || h.y;
    for (let i = 0; i < 2; i++) { const a = Math.random() * TAU, d = 26 + Math.random() * 18; FX.meteor({ team: 'hero', src: h, x: tx + Math.cos(a) * d, y: ty + Math.sin(a) * d, r: 20, delay: 1 + i * .25, el: 'fire', size: .75, burn: 2, hit: LOT_hit(h, 1.3, { el: 'fire', tags: ['aoe', 'spell'] }) }); }
  }); } });
def('powers', 'stormcaller', { name: "Stormcaller's", slots: ['gloves', 'ring', 'amulet'], stats: { crit: 3 }, desc: 'Critical strikes arc lightning to three nearby enemies.',
  install() { LOT_on('stormcaller', 'hit', (e, h) => {
    if (e.src !== h || !e.hit.crit || LOT_isProc(e.hit) || !LOT_ready(h, 'storm', .12)) return;
    FX.chain({ team: 'hero', src: h, from: e.tgt, hops: 3, range: 75, el: 'storm', set: new Set([e.tgt]), hit: LOT_hit(h, .6, { el: 'storm', tags: ['spell'] }) });
  }); } });
def('powers', 'bladesinger', { name: 'Bladesinger', slots: ['weapon', 'gloves', 'cloak'], desc: 'The spin of Blade Dance flings a ring of blades. Blade Throw and Bladestorm fire two extra blades.',
  install() {
    LOT_on('bladesinger', 'skill', (e, h) => { if (e.id === 'bladethrow' || e.id === 'bladestorm') game.after(.08, () => LOT_blades(h, h.x, h.y, 12, [h.aim - .35, h.aim + .35], { scale: .7, speed: 260, life: .7 })); });
    LOT_strike('bladesinger', (h, act, spec) => { if (!spec.spin) return; const n = 8; LOT_blades(h, h.x, h.y, 11, Array.from({ length: n }, (_, i) => i / n * TAU + h.facing), { scale: .45, speed: 210, life: .5 }); sfx('slash2', { vol: .5 }); });
  } });
def('powers', 'rallying', { name: 'Rallying', slots: ['helm', 'chest', 'amulet'], desc: 'Warcry also heals 20% of your life and grants 30% attack and cast speed for 6 seconds.',
  install() { LOT_on('rallying', 'skill', (e, h) => {
    if (e.id !== 'warcry') return; const heal = h.maxHp * .2; h.hp = Math.min(h.maxHp, h.hp + heal);
    LOT_buff(h, 'rally', 'Rallied', '#ffd36a', 6, { atkSpeed: 30, castSpeed: 30 }); P.ring(h.x, h.y, 4, 54, '#ffd36a', .5); P.glints(h.x, h.y, 16, 12, '#ffe070', 20); P.text(h.x, h.y, 34, '+' + fmt(heal), '#8aff8a');
  }); } });
def('powers', 'ninepins', { name: 'Ninepins', slots: ['gloves', 'boots', 'legs'], desc: 'Enemies you knock back hard become missiles that crash into the enemies behind them.',
  install() {
    const flying = new Set();
    LOT_on('ninepins', 'hit', (e, h) => { const m = e.tgt; if (e.src !== h || m.team !== 'foe' || m.boss || (e.hit.kb || 0) < 110 || LOT_isProc(e.hit)) return; m._lotPin = { t: .5, set: new Set([m]), amt: LOT_hit(h, .7).amount }; flying.add(m); });
    LOT_tick('ninepins', (h, dt) => {
      for (const m of flying) {
        const p = m._lotPin; if (!p || !m.alive || (p.t -= dt) <= 0) { m._lotPin = null; flying.delete(m); continue; }
        const sp = Math.hypot(m.vx, m.vy); if (sp < 45) continue;
        eachEnemy('hero', m.x, m.y, m.r + 3, o => {
          if (p.set.has(o)) return; p.set.add(o); const a = Math.atan2(m.vy, m.vx);
          dealDamage(o, { src: h, amount: p.amt, el: 'phys', kb: Math.min(220, sp * .9), ang: a, tags: ['proc'], proc: true });
          P.impact((m.x + o.x) / 2, (m.y + o.y) / 2, 12, 7, '#ffe070'); P.dust(o.x, o.y, 0, 4); shake(1.5); sfx('punch', { vol: .45 });
          if (o._lotPin === undefined || !o._lotPin) { o._lotPin = { t: .35, set: new Set(p.set), amt: p.amt * .7 }; flying.add(o); }
        });
      }
    });
  } });
def('powers', 'skyfall', { name: 'Skyfall', slots: ['weapon', 'gloves', 'helm', 'legs'], desc: 'Enemies you launch into the air take 50% more damage and crash down with a shockwave.',
  install() {
    const up = new Set();
    LOT_on('skyfall', 'hit', (e, h) => { const m = e.tgt; if (e.src !== h || m.team !== 'foe' || !m.alive) return; if (m.air || m.z > 3) { if (!LOT_isProc(e.hit)) { m.hp -= e.dmg * .5; P.impact(m.x, m.y, m.z + 12, 5, '#bff6ff'); } up.add(m); } });
    LOT_tick('skyfall', h => { for (const m of up) { if (!m.alive) { up.delete(m); continue; } if (!m.air && m.z <= 0) { up.delete(m); FX.nova({ team: 'hero', src: h, x: m.x, y: m.y, r0: 4, r1: 30, dur: .22, el: 'phys', tags: ['aoe', 'proc'], hit: LOT_hit(h, .8, { kb: 130 }) }); LOT_spikes(m.x, m.y, 16, '#a89878', 8); P.dust(m.x, m.y, 0, 10, { speed: 70 }); shake(2.5); sfx('thud', { vol: .6 }); } } });
  } });

/* ---- general powers ---- */
def('powers', 'bramble', { name: 'Bramblewoven', slots: ['chest', 'legs', 'cloak'], stats: { thorns: 6 }, desc: 'When struck, a nova of iron thorns bursts from you (once per second). It deals triple your thorns damage.',
  install() { LOT_on('bramble', 'hurt', (e, h) => {
    if (e.tgt !== h || !LOT_ready(h, 'bramble', 1)) return;
    const amt = (h.stats.thorns || 0) * 3 + LOT_hit(h, .5).amount;
    FX.nova({ team: 'hero', src: h, x: h.x, y: h.y, r0: 4, r1: 46, dur: .3, el: 'phys', color: '#c8b890', tags: ['aoe', 'proc', 'thorns'], hit: { src: h, amount: amt, el: 'phys', kb: 150, proc: true, statusChance: .5, status: 'bleed', statusPower: amt * .3 } });
    LOT_spikes(h.x, h.y, 34, '#a89870', 14); sfx('crack', { vol: .5, pitch: .8 });
  }); } });
def('powers', 'phoenix', { name: 'Phoenix', slots: ['amulet', 'ring', 'chest'], desc: 'Drinking a potion bursts into flame around you and grants 25% more damage and 15% movement speed for 8 seconds.',
  install() {
    LOT_on('phoenix', 'potion', (e, h) => {   // drinkPotion's own event
      LOT_buff(h, 'phoenix', 'Phoenix', '#ff8a3a', 8, { moreDmg: 25, moveSpeed: 15 });
      FX.nova({ team: 'hero', src: h, x: h.x, y: h.y, r0: 6, r1: 48, dur: .3, el: 'fire', tags: ['aoe', 'proc'], hit: LOT_hit(h, 1.1, { el: 'fire', kb: 160, extra: { statusChance: .8 } }) });
      for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; P.fire(h.x + Math.cos(a) * 14, h.y + Math.sin(a) * 14, 4, 1, { size: 4, speed: 30 }); }
      game.flash('#ffb050', .12, .3); sfx('explode', { vol: .5 }); shake(3);
    });
    LOT_tick('phoenix', h => { if (h.buffs.some(b => b.id === 'phoenix') && Math.random() < .35) P.add({ kind: 'ember', x: h.x + (Math.random() - .5) * 10, y: h.y + (Math.random() - .5) * 10, z: 4 + Math.random() * 18, vz: 30, max: .7, color: '#ff8a3a' }); });
  } });
def('powers', 'dancer', { name: "Dancer's", slots: ['boots', 'cloak', 'gloves'], desc: 'Dodging throws a fan of five spinning blades where you aim.',
  install() { LOT_on('dancer', 'dodge', (e, h) => { const a = h.aim; LOT_blades(h, h.x, h.y, 10, [-.5, -.25, 0, .25, .5].map(k => a + k), { scale: .5, speed: 270, life: .55 }); sfx('slash2', { vol: .45 }); }); } });
def('powers', 'midas', { name: 'Midas', slots: ['ring', 'amulet', 'gloves'], stats: { goldFind: 30 }, desc: 'Picking up gold heals 3% of your life.',
  install() { LOT_on('midas', 'gold', (e, h) => {
    const heal = h.maxHp * .03; h.hp = Math.min(h.maxHp, h.hp + heal); P.glints(h.x, h.y, 16, 3, '#ffd23a', 12);
    if (LOT_ready(h, 'midasTxt', .4)) P.text(h.x + 6, h.y, 24, '+' + fmt(heal), '#8aff8a');
  }); } });
def('powers', 'frenzy', { name: 'Bloodfrenzied', slots: ['helm', 'amulet', 'gloves'], desc: 'Kills extend your other buffs by a second and stack Frenzy: +4% attack speed and +1% movement speed each, up to 10.',
  install() { LOT_on('frenzy', 'kill', (e, h) => {
    if (e.src !== h || e.tgt.team !== 'foe') return;
    for (const b of h.buffs) if (b.id !== 'frenzy') { b._lotMax = b._lotMax || b.t * 2 + 2; b.t = Math.min(b.t + 1, b._lotMax); }
    const f = h.buffs.find(b => b.id === 'frenzy'), n = Math.min(10, (f ? f.n : 0) + 1), b = LOT_buff(h, 'frenzy', 'Frenzy ' + n, '#ff5a5a', 4, { atkSpeed: 4 * n, moveSpeed: n }); b.n = n;
    P.glints(h.x, h.y, 20, 2, '#ff5a5a', 10);
  }); } });
def('powers', 'hoarder', { name: "Hoarder's", slots: ['helm', 'ring', 'amulet'], stats: { magicFind: 15 }, desc: 'Elites and bosses drop an extra item of higher rarity and burst into a shower of gold.',
  install() { LOT_on('hoarder', 'kill', (e, h) => {
    const m = e.tgt; if (m.team !== 'foe' || !m.elite || m.noLoot) return; const d = m.level || ED.depth || 1;
    dropLoot('item', m.x, m.y, { item: makeItem({ ilvl: d + 1, rarity: rollRarity(d, rnd, (h.stats.magicFind || 0) + 150, .6) }) });
    const n = Math.max(1, Math.round(6 * SCALE.gold(d) * (1 + (h.stats.goldFind || 0) / 100))); for (let i = 0; i < 5; i++) dropLoot('gold', m.x, m.y, { n: Math.ceil(n / 2) });
    P.glints(m.x, m.y, 16, 14, '#ffd23a', 26); sfx('coin', { vol: .6, pitch: .8 });
  }); } });
def('powers', 'rimeguard', { name: 'Rimeguard', slots: ['chest', 'amulet', 'cloak'], desc: 'When your life drops below 35%, you encase yourself in ice: immune for 2 seconds, 20% of your life restored and every enemy nearby frozen solid (once every 30 seconds).',
  install() { LOT_on('rimeguard', 'hurt', (e, h) => {
    if (e.tgt !== h || h.hp > h.maxHp * .35 || h.hp <= 0 || !LOT_ready(h, 'rime', 30)) return;
    h.inv = Math.max(h.inv, 2); h.hp = Math.min(h.maxHp, h.hp + h.maxHp * .2); LOT_timeStop(h.x, h.y, 70, 2.5); LOT_iceBurst(h.x, h.y, 14, 18);
    FX.visual(2, (r, u) => {
      const a = u < .08 ? u / .08 : u > .85 ? (1 - u) / .15 : 1;
      r.queue(h.x, h.y, h.z, g => {
        const [x, y] = r.w(h.x, h.y, h.z), zm = r.view.zoom || 1, W0 = 10 * zm, H0 = 34 * zm;
        const pts = [[x - W0, y + 1], [x - W0 * .8, y - H0 * .8], [x - W0 * .2, y - H0], [x + W0 * .5, y - H0 * .92], [x + W0, y - H0 * .6], [x + W0 * .9, y + 1], [x, y + 4 * zm]];
        px.glow(g, 1); px.blend(g, .38 * a, 'normal', () => px.poly(g, pts, '#9fe8ff'));
        px.blend(g, .7 * a, 'add', () => { for (let i = 0; i < pts.length - 1; i++) px.line(g, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], '#dff8ff'); px.line(g, x - W0 * .5, y - H0 * .7, x - W0 * .2, y - H0 * .1, '#ffffff'); px.line(g, pts[2][0], pts[2][1], x, y - H0 * .3, '#bfefff'); });
      }, { emissive: true, bias: .8 });
      L.add(h.x, h.y, 16, 60, .7 * a, { color: '#9fe8ff' });
    });
    notify('RIMEGUARD', '#9fe8ff', 1.5);
  }); } });
def('powers', 'soulfire', { name: 'Soulfire', slots: ['helm', 'weapon', 'amulet'], desc: 'Enemies you kill release a soul flame that seeks out another enemy.',
  install() { LOT_on('soulfire', 'kill', (e, h) => {
    const m = e.tgt; if (e.src !== h || m.team !== 'foe' || (LOT_isProc(e.hit) && Math.random() < .4) || !LOT_ready(h, 'soul', .08)) return;
    FX.bolt({ team: 'hero', src: h, x: m.x, y: m.y, z: 14, ang: Math.random() * TAU, speed: 115, life: 2.2, r: 4, el: 'void', home: 7, tags: ['proj', 'proc'], hit: LOT_hit(h, .8, { el: 'void', tags: ['spell', 'proj'] }), look: { kind: 'orb', color: '#b070ff', core: '#ecd8ff', size: 1.8 }, light: 30 });
    P.add({ kind: 'ember', x: m.x, y: m.y, z: 16, vz: 30, max: .6, color: '#c890ff' });
  }); } });
def('powers', 'conduit', { name: 'Conduit', slots: ['helm', 'amulet', 'weapon'], desc: 'Every 80 Ember you spend calls a meteor down on the nearest enemy.',
  install() { LOT_on('conduit', 'skill', (e, h) => {
    const S = REG.skills[e.id]; if (!S) return; h._lotSpent = (h._lotSpent || 0) + skillCost(h, S);
    while (h._lotSpent >= 80) {
      h._lotSpent -= 80; const m = nearestEnemy('hero', h.tx || h.x, h.ty || h.y, 140) || nearestEnemy('hero', h.x, h.y, 160);
      const x = m ? m.x : h.x + Math.cos(h.aim) * 50, y = m ? m.y : h.y + Math.sin(h.aim) * 50;
      FX.meteor({ team: 'hero', src: h, x, y, r: 24, delay: .7, el: 'fire', size: .9, burn: 2, hit: LOT_hit(h, 2, { el: 'fire', tags: ['aoe', 'spell'] }) });
      P.glints(h.x, h.y, 24, 6, '#ffb050', 10);
    }
  }); } });
def('powers', 'riftwalker', { name: "Riftwalker's", slots: ['boots', 'cloak'], desc: 'A perfect dodge stops time around you: every enemy nearby is frozen for 2.5 seconds.',
  install() { LOT_on('riftwalker', 'perfectDodge', (e, h) => LOT_timeStop(h.x, h.y, 84, 2.5)); } });
def('powers', 'executioner', { name: "Executioner's", slots: ['weapon', 'gloves'], desc: 'Your hits execute enemies below 15% life (not bosses) in a spray of blood.',
  install() { LOT_on('executioner', 'hit', (e, h) => {
    const m = e.tgt; if (e.src !== h || m.team !== 'foe' || m.boss || !m.alive || m.hp <= 0 || m.hp > m.maxHp * .15 || LOT_isProc(e.hit)) return;
    killUnit(m, { src: h, amount: m.hp, el: 'phys', tags: ['execute'], ang: angTo(h, m) });
    P.bits(m.x, m.y, 14, 14, ['#c82a2a', '#8a1a1a', '#ff5a5a']); P.impact(m.x, m.y, 14, 9, '#ff5a5a'); P.text(m.x, m.y, (m.head || 24) + 8, 'EXECUTED', '#ff5a5a');
    FX.visual(.3, (r, u) => r.queue(m.x, m.y, 12, g => {
      const [x, y] = r.w(m.x, m.y, 12), L0 = 10 * (r.view.zoom || 1) * Math.min(1, u * 5), a = 1 - u;
      px.glow(g, 1); px.blend(g, a, 'normal', () => { px.line(g, x - L0, y - L0 * .7, x + L0, y + L0 * .7, '#ff3a3a', 2); px.line(g, x + L0, y - L0 * .7, x - L0, y + L0 * .7, '#ff3a3a', 2); px.line(g, x - L0, y - L0 * .7, x + L0, y + L0 * .7, '#ffd0d0'); });
    }, { emissive: true, bias: .5 }));
    game.freeze(.05); shake(3); sfx('slash2', { vol: .6 });
  }); } });
def('powers', 'emberwheel', { name: 'Emberwheel', slots: ['cloak', 'amulet', 'chest'], desc: 'Three ember blades orbit you, burning everything they cut.',
  install() {
    const next = new WeakMap(), R0 = 22, spot = (h, i) => { const a = (h._lotWheel || 0) + i * TAU / 3; return [h.x + Math.cos(a) * R0, h.y + Math.sin(a) * R0, h.z + 11 + Math.sin(game.time * 3 + i * 2) * 1.5, a]; };
    LOT_tick('emberwheel', (h, dt) => {
      h._lotWheel = ((h._lotWheel || 0) + dt * 4.4) % TAU;
      for (let i = 0; i < 3; i++) {
        const [bx, by, bz] = spot(h, i);
        eachEnemy('hero', bx, by, 7, m => { if ((next.get(m) || 0) > game.time) return; next.set(m, game.time + .35); dealDamage(m, LOT_hit(h, .3, { el: 'fire', tags: ['melee', 'aoe'], kb: 40, extra: { ang: angTo(h, m), statusChance: .25 } })); P.sparks(bx, by, bz, 3, null, { color: '#ffb347', hot: '#fff3c4' }); });
        if (Math.random() < dt * 14) P.add({ kind: 'ember', x: bx, y: by, z: bz, vz: 10, drag: 2, max: .4, color: '#ff8a3a' });
      }
    });
    LOT_drawFx('emberwheel', (h, r) => {
      for (let i = 0; i < 3; i++) {
        const [bx, by, bz, a] = spot(h, i);
        r.queue(bx, by, bz, g => {
          const tan = a + Math.PI / 2, [x0, y0] = r.w(bx - Math.cos(tan) * 4, by - Math.sin(tan) * 4, bz), [x1, y1] = r.w(bx + Math.cos(tan) * 4, by + Math.sin(tan) * 4, bz);
          px.glow(g, 1);
          for (let k = 3; k >= 1; k--) { const b = a - k * .22, [tx, ty] = r.w(h.x + Math.cos(b) * R0, h.y + Math.sin(b) * R0, bz); px.blend(g, .5 - k * .12, 'add', () => px.disc(g, tx, ty, 1.5, '#ff8a3a')); }
          px.line(g, x0, y0, x1, y1, '#c83a1a', 3); px.line(g, x0, y0, x1, y1, '#ffb347', 2); px.line(g, (x0 + x1) / 2, (y0 + y1) / 2, x1, y1, '#fff3c4'); px.dot(g, x1, y1, '#ffffff');
        }, { emissive: true });
        L.add(bx, by, bz, 28, .5, { color: '#ff9a4a' });
      }
    });
  } });
def('powers', 'galeblade', { name: 'Galeblade', slots: ['weapon', 'gloves'], desc: 'Every melee strike looses a crescent of cutting wind that flies through enemies.',
  install() { LOT_strike('galeblade', (h, act) => {
    if (!LOT_isMelee(act) || !LOT_ready(h, 'gale', .12)) return; const a = h.facing;
    FX.bolt({ team: 'hero', src: h, x: h.x + Math.cos(a) * 8, y: h.y + Math.sin(a) * 8, z: 10, ang: a, speed: 270, life: .45, r: 7, pierce: 99, el: 'phys', tags: ['proj', 'proc'], hit: LOT_hit(h, .55, { kb: 80 }), look: LOT_CRESCENT, light: 20 });
    sfx('whoosh', { vol: .35, pitch: 1.4 });
  }); } });

/* ---- deep powers: legendaries only roll these past their item level ---- */
/** a rift torn in the air: a dark slit standing upright with a bright violet edge that opens, holds, and snaps shut */
function LOT_rift(x, y, dur) {
  const seed = (Math.random() * 999) | 0, H = 30;
  FX.visual(dur, (r, u) => {
    if (!r.visible(x, y, 16, 30, 30, 30)) return;
    const open = u < .2 ? E.ease.outQuad(u / .2) : u < .74 ? 1 + .08 * Math.sin(u * 60) : Math.max(0, 1 - (u - .74) / .12);
    r.queue(x, y, 14, g => {
      const zm = r.view.zoom || 1, w = 5.5 * open * zm, Lp = [], Rp = [];
      for (let i = 0; i <= 10; i++) { const k = i / 10, [sx, sy] = r.w(x, y, 2 + H * k), b = Math.sin(k * Math.PI) * w * (.75 + .5 * E.hash2(i, seed)); Lp.push([sx - b, sy]); Rp.unshift([sx + b * .85, sy]); }
      px.glow(g, 1);
      px.blend(g, .35 * Math.min(1, open), 'add', () => px.poly(g, Lp.map(q => [q[0] - 2 * zm, q[1]]).concat(Rp.map(q => [q[0] + 2 * zm, q[1]])), '#8a4ad0'));
      if (w > .6) {
        px.poly(g, Lp.concat(Rp), '#0a0414');
        for (let i = 0; i < 3; i++) { const q = Lp[2 + i * 3]; if (E.hash2(i + seed, Math.floor(game.time * 8)) > .4) px.dot(g, q[0] + w * .6, q[1], '#c890ff'); }
      }
      for (let i = 0; i < Lp.length - 1; i++) { px.line(g, Lp[i][0], Lp[i][1], Lp[i + 1][0], Lp[i + 1][1], i > 3 && i < 7 ? '#ffffff' : '#d8b0ff'); px.line(g, Rp[i][0], Rp[i][1], Rp[i + 1][0], Rp[i + 1][1], '#b070ff'); }
    }, { emissive: true, bias: .4 });
    L.add(x, y, 16, 50, .7 * Math.min(1, open), { color: '#b070ff' });
  });
}
def('powers', 'riftblade', { name: 'Riftrending', slots: ['weapon', 'gloves'], minIlvl: 22, desc: 'Every fifth strike tears a rift in the air ahead of you: it drags enemies in, then snaps shut for 250% weapon damage as void.',
  install() { LOT_strike('riftblade', (h, act) => {
    if ((h._lotRift = (h._lotRift || 0) + 1) % 5 || LOT_town()) return;
    const a = h.facing, x = h.x + Math.cos(a) * 26, y = h.y + Math.sin(a) * 26, L0 = ED.L;
    LOT_rift(x, y, .75); const f = FX.pull({ team: 'hero', src: h, x, y, r: 48, force: 300, dur: .55, el: 'void' }); f.draw = null; sfx('whoosh', { vol: .5, pitch: .5 });
    game.after(.55, () => { if (ED.L !== L0 || !h.alive) return; FX.nova({ team: 'hero', src: h, x, y, r0: 3, r1: 30, dur: .2, el: 'void', tags: ['aoe', 'proc'], hit: LOT_hit(h, 2.5, { el: 'void', kb: 170, tags: ['aoe'] }) }); elBurst(x, y, 14, 'void', 18); P.ring(x, y, 12, 28, '#ecd8ff', .3); game.freeze(.04); shake(3); sfx('explode', { vol: .45, pitch: 1.5 }); });
  }); } });
def('powers', 'tempest', { name: 'Stormcrowned', slots: ['helm', 'amulet'], minIlvl: 32, desc: 'A storm cloud follows you. While your Ember is above half, it strikes an enemy near you with lightning every 0.8 seconds for 120% weapon damage.',
  install() {
    const cloud = h => [h.x - 2, h.y - 2, h.z + 38 + Math.sin(game.time * 1.7) * 1.2];   // bobbing a hand above his head
    LOT_tick('tempest', (h, dt) => {
      if (LOT_town() || h.ember < h.maxEmber * .5 || (h._lotStorm = (h._lotStorm || 0) - dt) > 0) return;
      const near = []; eachEnemy('hero', h.x, h.y, 100, m => { if (!m.dormant) near.push(m); }); if (!near.length) return;
      h._lotStorm = .8; const m = near[(Math.random() * near.length) | 0], c = cloud(h), tz = (m.z || 0) + (m.head || 20) * .5, seed = (Math.random() * 99) | 0; h._lotZap = game.time + .15;
      dealDamage(m, LOT_hit(h, 1.2, { el: 'storm', tags: ['spell', 'aoe'], kb: 30, extra: { ang: angTo(h, m), statusChance: .4 } }));
      FX.visual(.16, (r, u) => r.queue(m.x, m.y, tz, g => { const [x0, y0] = r.w(c[0], c[1], c[2]), [x1, y1] = r.w(m.x, m.y, tz); px.glow(g, 1); if (u < .6) zig(g, x0, y0, x1, y1, '#ffe45a', 2, 5, seed); zig(g, x0, y0, x1, y1, '#ffffff', 1, 5, seed); }, { emissive: true, bias: 1 }));
      L.add(m.x, m.y, tz, 60, 1, { color: '#fff0a0' }); P.sparks(m.x, m.y, tz, 6, null, { color: '#ffe45a', hot: '#ffffff' }); sfx('zap', { vol: .35, pitch: 1.2 });
    });
    LOT_drawFx('tempest', (h, r) => {
      if (LOT_town()) return;
      const c = cloud(h), t = game.time, lit = (h._lotZap || 0) > t, t0 = E.tones(lit ? '#9a9ac8' : '#3e3e5c');
      r.queue(c[0], c[1], c[2], g => {
        const [x, y] = r.w(c[0], c[1], c[2]), zm = r.view.zoom || 1;
        const puffs = [[-8, 1.5, 4.2], [-3, -2, 5.2], [3.5, -1.5, 4.6], [8.5, 1.5, 3.6], [0, 2, 4.4], [-5, 3, 3.4], [5, 3, 3.2]];
        for (const [dx, dy, R] of puffs) px.disc(g, x + (dx + Math.sin(t * 1.3 + dx) * .6) * zm, y + (dy + 1) * zm, R * zm, t0.deep);
        for (const [dx, dy, R] of puffs) px.disc(g, x + (dx + Math.sin(t * 1.3 + dx) * .6) * zm, y + dy * zm, R * .92 * zm, t0.base);
        for (const [dx, dy, R] of puffs.slice(0, 4)) px.disc(g, x + (dx - .8 + Math.sin(t * 1.3 + dx) * .6) * zm, y + (dy - 1.4) * zm, R * .55 * zm, t0.lt);
        for (const [dx, dy, R] of puffs.slice(1, 3)) px.disc(g, x + (dx - 1.4 + Math.sin(t * 1.3 + dx) * .6) * zm, y + (dy - 2.4) * zm, R * .25 * zm, t0.hi);
        px.rect(g, x - 9 * zm, y + 4.5 * zm, 18 * zm, Math.max(1, zm), t0.deep);   // the flat dark belly of a storm cloud
        if (lit || Math.sin(t * 17) > .97) { px.glow(g, 1); px.blend(g, .7, 'add', () => px.disc(g, x, y, 3 * zm, '#fff4c0')); }
        for (let i = 0; i < 3; i++) { const k = (t * 1.6 + i / 3) % 1, rx = x + (i * 5 - 5) * zm; px.blend(g, .6 * (1 - k), 'normal', () => px.line(g, rx, y + (3 + k * 12) * zm, rx - zm, y + (5 + k * 12) * zm, '#9ab8d8')); }
      }, { emissive: lit, bias: .8 });
      if (lit) L.add(c[0], c[1], c[2], 60, .8, { color: '#fff0a0' });
    });
  } });

/* ---- unique-only powers (slots: [] keeps them off random legendaries) ---- */
def('powers', 'firstblade', { name: 'The First Blade', noun: true, slots: [], desc: "Blade Dance's spin looses the Proving Grounds' ring of cutting steel, and every Blade Dance kill restores 4 Ember.",
  install() {
    LOT_strike('firstblade', (h, act, spec) => { if (!spec.spin || act.skill !== 'blade') return; LOT_blades(h, h.x, h.y, 11, Array.from({ length: 6 }, (_, i) => i / 6 * TAU + h.facing + .26), { scale: .6, speed: 230, life: .55, color: '#8fe0f2' }); P.ring(h.x, h.y, 6, 44, '#8fe0f2', .35); });
    LOT_on('firstblade', 'kill', (e, h) => { if (e.src === h && e.hit.skill === 'blade') { h.ember = Math.min(h.maxEmber, h.ember + 4); if (LOT_ready(h, 'fbGlint', .2)) P.glints(h.x, h.y, 16, 2, '#8fe0f2', 8); } });
  } });
def('powers', 'emberheart', { name: 'Emberheart', noun: true, slots: [], desc: 'Every 4 seconds your heart beats fire: a burning pulse around you. Fire damage you deal heals you for 2% of it.',
  install() {
    LOT_tick('emberheart', (h, dt) => {
      h._lotBeat = (h._lotBeat || 0) + dt; if (h._lotBeat < 4 || LOT_town()) return; h._lotBeat = 0;
      FX.nova({ team: 'hero', src: h, x: h.x, y: h.y, r0: 5, r1: 44, dur: .32, el: 'fire', tags: ['aoe', 'proc'], hit: LOT_hit(h, .75, { el: 'fire', kb: 90, extra: { statusChance: .5 } }) });
      const c = LOT_joint(h, 'shC'); P.fire(c[0], c[1], c[2], 4, { size: 3, speed: 20 }); sfx('bloop', { vol: .5, pitch: .6 });
    });
    LOT_on('emberheart', 'hit', (e, h) => { if (e.src === h && e.hit.el === 'fire') h.hp = Math.min(h.maxHp, h.hp + e.dmg * .02); });
    LOT_drawFx('emberheart', (h, r) => {
      const c = LOT_joint(h, 'shC'), beat = h._lotBeat || 0, pul = Math.max(0, 1 - Math.abs(beat % 1 - .1) * 6) + (beat > 3.6 ? (beat - 3.6) * 2 : 0);
      r.queue(c[0], c[1], c[2], g => { const [x, y] = LOT_rigPt(r, h, [c[0] + Math.cos(h.facing) * 2.5, c[1] + Math.sin(h.facing) * 2.5, c[2] - 3]), zm = r.view.zoom || 1; px.glow(g, 1); r.glowDisc(g, x, y, (2.2 + pul * 2.2) * zm, '#ff7a2a', .28 + pul * .3); px.disc(g, x, y, Math.max(1, .8 * zm), pul > .5 ? '#fff0a0' : '#ffb040'); px.dot(g, x, y, '#ffffff'); }, { emissive: true, bias: .6 });
      L.add(c[0], c[1], c[2], 30 + pul * 24, .35 + pul * .4, { color: '#ff8a3a' });
    });
  } });
def('powers', 'deepcrown', { name: 'Crown of the Deep', noun: true, slots: [], desc: 'You grow stronger the deeper you have been: +2% damage and +1% life for every depth you have reached (up to depth 50).',
  install() {
    LOT_drawFx('deepcrown', (h, r) => {
      const hd = h.rig.head(), t = game.time;
      for (let i = 0; i < 3; i++) {
        const a = t * 1.7 + i * TAU / 3, p = [hd[0] + Math.cos(a) * 6, hd[1] + Math.sin(a) * 6, hd[2] + 7 + Math.sin(t * 3 + i * 2) * .8], col = ['#5ae0c8', '#9fe8ff', '#e8c040'][i];
        r.queue(p[0], p[1], p[2], g => { const [x, y] = LOT_rigPt(r, h, p), zm = r.view.zoom || 1, s = Math.max(1, Math.round(1.5 * zm)); px.glow(g, 1); r.glowDisc(g, x, y, 3 * zm, col, .35); px.poly(g, [[x, y - s - 1], [x + s, y], [x, y + s + 1], [x - s, y]], col); px.dot(g, x, y - s, '#ffffff'); }, { emissive: true });
      }
      L.add(hd[0], hd[1], hd[2] + 6, 30, .4, { color: '#5ae0c8' });
    });
  } });
statSource((h, add) => { if (!hasPower(h, 'deepcrown')) return; const d = Math.min(50, h.maxDepth || 1); add('incDmg', 2 * d); add('lifePct', d); });
def('powers', 'warden', { name: "The Warden's Ward", noun: true, slots: [], desc: 'Stand your ground for half a second to raise a ward: +100% armor, +20% all resistances, and enemies that strike you are hurled back.',
  install() {
    LOT_tick('warden', (h, dt) => {
      h._lotStill = Math.hypot(h.vx, h.vy) < 10 && h.dodgeT <= 0 ? (h._lotStill || 0) + dt : 0;
      const on = h.buffs.some(b => b.id === 'ward');
      if (h._lotStill > .5 && !on) { LOT_buff(h, 'ward', 'Ward', '#e8c860', 9999, { armorPct: 100, resAll: 20 }); P.ring(h.x, h.y, 22, 6, '#e8c860', .3); sfx('chime', { vol: .35 }); }
      else if (h._lotStill <= .5 && on) { h.buffs = h.buffs.filter(b => b.id !== 'ward'); computeStats(h); }
    });
    LOT_on('warden', 'hurt', (e, h) => { const m = e.hit && e.hit.src; if (!h.buffs.some(b => b.id === 'ward') || !m || m.team !== 'foe' || !m.alive || m.boss) return; knock(m, angTo(h, m), 260, 40); m.kbT = .3; P.impact(m.x, m.y, 12, 7, '#e8c860'); sfx('clang', { vol: .4 }); });
    LOT_drawFx('warden', (h, r) => {
      if (!h.buffs.some(b => b.id === 'ward')) return; const t = game.time;
      r.decal(() => {
        r.groundDisc(h.x, h.y, 15, '#e8c860', .12); r.groundRing(h.x, h.y, 15, '#e8c860', .8); r.groundRing(h.x, h.y, 11, '#fff0b0', .4);
        for (let i = 0; i < 8; i++) { const a = t * .8 + i / 8 * TAU; r.groundDisc(h.x + Math.cos(a) * 13, h.y + Math.sin(a) * 13, 1.2, '#fff0b0', .9); }
      }, { emissive: .7 });
      L.add(h.x, h.y, 6, 44, .45, { color: '#e8c860' });
    });
  } });
def('powers', 'stormglass', { name: 'Stormglass', noun: true, slots: [], desc: 'Your spells arc lightning to two nearby enemies.',
  install() { LOT_on('stormglass', 'hit', (e, h) => {
    if (e.src !== h || !(e.hit.tags || []).includes('spell') || LOT_isProc(e.hit) || !LOT_ready(h, 'sglass', .1)) return;
    FX.chain({ team: 'hero', src: h, from: e.tgt, hops: 2, range: 70, el: 'storm', set: new Set([e.tgt]), hit: LOT_hit(h, .5, { el: 'storm', tags: ['spell'] }) });
  }); } });
def('powers', 'broodfang', { name: "The Broodmother's Bite", noun: true, slots: [], desc: 'Poisoned enemies you kill burst into a venom cloud and spit three seeking globs.',
  install() {
    LOT_on('broodfang', 'kill', (e, h) => {   // poisoned when it died (e.st), or killed by his venom
      const m = e.tgt; if (m.team !== 'foe' || e.src !== h || !((e.st && e.st.poison) || (e.hit && e.hit.el === 'venom'))) return;
      FX.area({ team: 'hero', src: h, x: m.x, y: m.y, r: 22, dur: 3, el: 'venom', tick: .5, tags: ['aoe', 'dot', 'proc'], hit: LOT_hit(h, .25, { el: 'venom', extra: { statusChance: .6, kb: 0 } }) });
      for (let i = 0; i < 3; i++) FX.bolt({ team: 'hero', src: h, x: m.x, y: m.y, z: 8, ang: i / 3 * TAU + Math.random(), speed: 120, life: 1.6, r: 3, el: 'venom', home: 6, tags: ['proj', 'proc'], hit: LOT_hit(h, .45, { el: 'venom', extra: { statusChance: .7 } }), look: { kind: 'spit', color: '#8ae04a', core: '#e0ffc0', size: 2 }, light: 16 });
      elBurst(m.x, m.y, 8, 'venom', 12); sfx('bloop', { vol: .5 });
    });
  } });
def('powers', 'ouroboros', { name: 'The Endless Coil', noun: true, slots: [], desc: 'Every kill shortens all your cooldowns by 0.4 seconds.',
  install() { LOT_on('ouroboros', 'kill', (e, h) => {
    if (e.src !== h || e.tgt.team !== 'foe') return; let any = false;
    for (const k in h.cds) { h.cds[k] -= .4; any = true; }
    if (any && LOT_ready(h, 'coil', .25)) { P.ring(h.x, h.y, 16, 5, '#5ae07a', .25); P.glints(h.x, h.y, 22, 1, '#5ae07a', 8); }
  }); } });

/* =============================================================================
 * UNIQUES: fixed stats, a power, a look that changes the rig, and flavor
 * ============================================================================= */
const LOT_STRESS_SMEAR = ['#ffffff', '#dff8ff', '#8fe0f2', '#4bb1d4'];
def('uniques', 'firstblade', { name: 'The First Blade', base: 'longsword', power: 'firstblade', minIlvl: 1,
  stats: [['dmgPct', 45], ['atkSpeed', 12], ['crit', 4], ['rank:blade', 2]],
  look: { bladeLen: 13, colors: { metal: '#e4f0f8', metalDk: '#7f93ab', hilt: '#e8b04e' }, smear: LOT_STRESS_SMEAR, glow: '#8fe0f2' },
  flavor: '"It cut down ten thousand in the Proving Grounds, and it remembers every one."' });
def('uniques', 'emberheart', { name: 'Emberheart', base: 'plate', power: 'emberheart', minIlvl: 4,
  stats: [['life', 30], ['incFire', 30], ['resFire', 25], ['lifeRegen', 1.5]],
  look: { outfit: 'tunic', armor: true, sleeves: 'long', colors: { cloth: '#6a1c1a', metal: '#4a3a44', trim: '#ffb040' } },
  flavor: '"Forged around a coal from the first hearth of Emberhold. It has never gone out."' });
def('uniques', 'deepcrown', { name: 'Crown of the Deep', base: 'crown', power: 'deepcrown', minIlvl: 8,
  stats: [['magicFind', 25], ['allSkills', 1], ['ember', 20]],
  look: { hat: { style: 'crown', color: '#5ae0c8' }, eyeGlow: '#8ff0e0' },
  flavor: '"Worn by the first king who went down. He is still down there."' });
def('uniques', 'warden', { name: "The Warden's Mantle", base: 'longcape', power: 'warden', minIlvl: 3,
  stats: [['armorPct', 30], ['resAll', 10], ['life', 20]],
  look: { cape: { len: 9, width: 7, seg: 2.6 }, colors: { cape: '#1e2a5a', capeIn: '#0e1430', trim: '#e8c860' } },
  flavor: '"Ilsa\'s mother stood at the waystone for forty years. Nothing came up."' });
def('uniques', 'ashwalker', { name: 'Ashwalker Treads', base: 'boots', power: 'cindertrail', minIlvl: 2,
  stats: [['moveSpeed', 15], ['resFire', 15], ['dodge', 4]],
  look: { colors: { boot: '#2a1a1a' } },
  flavor: '"The soles are still warm. They always will be."' });
def('uniques', 'stormglass', { name: 'Stormglass Rod', base: 'staff', power: 'stormglass', minIlvl: 6, el: 'storm',
  stats: [['incStorm', 40], ['castSpeed', 15], ['chains', 1]],
  look: { weapon: 'staff', colors: { staff: '#2a2a4a', orb: '#fff4a0' }, glow: '#fff08a' },
  flavor: '"A shard of the Stormglass Mines, still humming with the storm that made it."' });
def('uniques', 'broodfang', { name: "Broodmother's Fang", base: 'fang', power: 'broodfang', minIlvl: 9, el: 'venom',
  stats: [['incVenom', 35], ['atkSpeed', 15], ['statusChance', 30]],
  look: { bladeLen: 9, colors: { metal: '#b8f070', metalDk: '#2a5a10', hilt: '#1a2a10' }, smear: ['#f0ffe0', '#c8f090', '#8ae04a', '#3a8a2a'], glow: '#8ae04a' },
  flavor: '"Pulled from her jaw while she still twitched. It still drips."' });
def('uniques', 'hollowmask', { name: 'Mask of the Hollow', base: 'hood', power: 'soulfire', minIlvl: 5,
  stats: [['incVoid', 30], ['lifeOnKill', 6], ['crit', 4]],
  look: { hood: true, eyeGlow: '#c890ff', colors: { hair: '#1a1024' } },
  flavor: '"Behind it there is no face. Only the hunger that wore one."' });
def('uniques', 'titan', { name: 'Gauntlets of the Titan', base: 'gauntlets', power: 'ninepins', minIlvl: 5,
  stats: [['knockback', 60], ['dmgPct', 25], ['armor', 10]],
  look: { colors: { glove: '#d8b048' } },
  flavor: '"Too heavy to lift a cup. Just right for lifting a knight."' });
def('uniques', 'coil', { name: 'The Ouroboros Coil', base: 'ring', power: 'ouroboros', minIlvl: 7, gem: '#5ae07a',
  stats: [['cdr', 10], ['emberRegen', 2]],
  flavor: '"The serpent has been eating its tail since before the deep had a bottom."' });
def('uniques', 'deeptear', { name: 'Tear of the Deep', base: 'amulet', power: 'rimeguard', minIlvl: 6, gem: '#9fe8ff',
  stats: [['resFrost', 25], ['life', 30], ['incFrost', 25]],
  flavor: '"Wept by something vast, very far down, and frozen before it hit the floor."' });
def('uniques', 'frostbrand', { name: 'Frostbrand', base: 'runeblade', power: 'shatterglass', minIlvl: 10, el: 'frost',
  stats: [['incFrost', 40], ['statusChance', 25], ['dmgPct', 30], ['crit', 3]],
  look: { bladeLen: 12, colors: { metal: '#e8fbff', metalDk: '#4bb1d4', hilt: '#9ab8d8' }, smear: ['#ffffff', '#dff8ff', '#8fe0f2', '#4bb1d4'], glow: '#9fe8ff' },
  flavor: '"Rime grows on the blade faster than you can wipe it off."' });
/* deep uniques: their powers are words of the composed language, ranked by the depth they drop at */
def('uniques', 'starless', { name: 'The Starless Hour', base: 'voidblade', power: 'cx.slay.vortex.void', minIlvl: 20, el: 'void',
  stats: [['incVoid', 45], ['area', 15], ['cdr', 8], ['critDmg', 25]],
  look: { bladeLen: 13, colors: { metal: '#4a3a6a', metalDk: '#120a20', hilt: '#c8a0ff' }, smear: ['#f4e8ff', '#b070ff', '#6a2a9a', '#1a0a2a'], glow: '#b070ff' },
  flavor: '"Forged in the hour after the last star went out. Somewhere in the blade, it is still that hour."' });
def('uniques', 'wyrmheart', { name: 'Wyrmheart Hauberk', base: 'warplate', power: 'cx.struck.nova.fire', minIlvl: 30,
  stats: [['life', 60], ['resFire', 30], ['armorPct', 40], ['thorns', 12]],
  look: { outfit: 'tunic', armor: true, sleeves: 'long', colors: { cloth: '#5a1a1a', metal: '#a8683a', trim: '#ffb040' } },
  flavor: '"Scaled from the Wyrm of the Quaking Deep. The scales still turn toward heat."' });
def('uniques', 'cometstride', { name: 'Cometstriders', base: 'treads', power: 'cx.dodge.strikes.storm', minIlvl: 40,
  stats: [['moveSpeed', 18], ['dodge', 6], ['dodgeCharges', 1], ['resStorm', 20]],
  look: { colors: { boot: '#2a2a4a' } },
  flavor: '"They leave no footprints. Only scorch marks, very far apart."' });
def('uniques', 'spire', { name: 'Greaves of the Leaping Spire', base: 'greaves', power: 'skyfall', minIlvl: 12,
  stats: [['knockback', 30], ['life', 25], ['dodge', 3], ['moveSpeed', 6]],
  look: { colors: { pants: '#8a90b8' } },
  flavor: '"Whoever wore these last never came down. Only the greaves did."' });

/* =============================================================================
 * THORNS (the 'thorns' stat from 'of Thorns' affixes and Bramblewoven): a struck hero hits back.
 * ED.thornsBy names the one module that applies it, so it is never applied twice.
 * ============================================================================= */
if (!ED.thornsBy) ED.thornsBy = 'loot';
BUS.on('hurt', e => {
  const h = ED.hero, m = e.hit && e.hit.src; if (ED.thornsBy !== 'loot' || !h || e.tgt !== h || !m || m.team !== 'foe' || !m.alive) return;
  const th = h.stats.thorns || 0; if (th <= 0 || Math.hypot(m.x - h.x, m.y - h.y) > 48) return;
  dealDamage(m, { src: h, amount: th, el: 'phys', kb: 50, ang: angTo(h, m), tags: ['thorns', 'proc'], proc: true, var: 0 });
  P.sparks(m.x, m.y, 12, 4, angTo(h, m), { color: '#c8b890', hot: '#fff8e0' });
});

/* =============================================================================
 * RICH ITEM ICONS: drawItemIconEx(g, it, x, y, s, o) draws a 16x16 (x s) icon at (x, y), shaded, outlined and cached.
 * o: { alpha, anim: false (no twinkle on legendaries and uniques) }. The core's drawItemIcon stays for the ground.
 * ============================================================================= */
const LOT_ICONS = new Map();
const LOT_iconKey = (it, s) => { const c = (it.look && it.look.colors) || {}; return it.uid + ':' + s + ':' + it.rarity + ':' + (it.el || '') + ':' + (it.gem || '') + ':' + (c.metal || '') + (c.cloth || '') + (c.orb || '') + (c.cape || '') + (c.glove || '') + (c.boot || '') + (c.pants || ''); };
function drawItemIconEx(g, it, x, y, s = 1, o = {}) {
  if (!it) return;
  const key = LOT_iconKey(it, s); let cv = LOT_ICONS.get(key);
  if (!cv) { if (LOT_ICONS.size > 600) LOT_ICONS.clear(); cv = LOT_bakeIcon(it, s); LOT_ICONS.set(key, cv); }
  const X = Math.round(x) - 1, Y = Math.round(y) - 1;
  if (o.alpha !== undefined && o.alpha < 1) px.blend(g, o.alpha, 'normal', () => g.drawImage(cv, X, Y)); else g.drawImage(cv, X, Y);
  if (o.anim !== false && it.rarity >= 3) LOT_twinkle(g, it, x, y, s);
}
/** a star that twinkles somewhere on a legendary or unique icon */
function LOT_twinkle(g, it, x, y, s) {
  const id = typeof it.uid === 'number' ? it.uid : 3, t = game.real * (it.rarity === 4 ? 1.1 : 1.5) + (id % 7) * .37, k = t % 1; if (k > .45) return;
  const n = Math.floor(t), sx = Math.round(x + (3 + E.hash2(n, id) * 10) * s), sy = Math.round(y + (3 + E.hash2(n + 91, id) * 10) * s), R = Math.round(Math.sin(k / .45 * Math.PI) * 2.4 * Math.max(1, s * .8)), c = it.rarity === 4 ? '#fff0c0' : '#ffd08a';
  if (R < 1) { px.dot(g, sx, sy, c); return; }
  px.rect(g, sx - R, sy, R * 2 + 1, 1, c); px.rect(g, sx, sy - R, 1, R * 2 + 1, c); px.dot(g, sx, sy, '#ffffff');
}
function LOT_bakeIcon(it, s) {
  const S = Math.ceil(16 * s) + 2, cv = E.mkCanvas(S, S), g = E.ctx2d(cv);
  LOT_paint(g, it, s);
  const out = E.mkCanvas(S, S), og = E.ctx2d(out);   // outline: a dark copy one pixel out on every side, behind the art
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) og.drawImage(cv, dx, dy);
  og.globalCompositeOperation = 'source-in'; og.fillStyle = '#0c0818'; og.fillRect(0, 0, S, S); og.globalCompositeOperation = 'source-over';
  og.drawImage(cv, 0, 0);
  return out;
}
/** paint an item in 16 design units (x s pixels), light from the upper left */
function LOT_paint(g, it, s) {
  const c = (it.look && it.look.colors) || {}, lk = it.look || {}, base = REG.itemBases[it.base] || {}, T = E.tones;
  const P0 = v => 1 + v * s, W0 = v => Math.max(1, Math.round(v * s));
  const rect = (x, y, w, h, col) => px.rect(g, P0(x), P0(y), W0(w), W0(h), col);
  const line = (x0, y0, x1, y1, col, w = 1) => px.line(g, P0(x0), P0(y0), P0(x1), P0(y1), col, W0(w));
  const disc = (x, y, r, col) => px.disc(g, P0(x), P0(y), Math.max(.5, r * s), col);
  const ell = (x, y, rx, ry, col) => px.ell(g, P0(x), P0(y), Math.max(.5, rx * s), Math.max(.5, ry * s), col);
  const poly = (pts, col) => px.poly(g, pts.map(([a, b]) => [P0(a), P0(b)]), col);
  const dot = (x, y, col) => px.dot(g, P0(x), P0(y), col);
  const cut = fn => px.blend(g, 1, 'destination-out', fn), glow = (fn, a = .4) => px.blend(g, a, 'add', fn);
  const gem = (x, y, r, col) => { const t = T(col); disc(x, y, r, t.deep); disc(x - .25, y - .25, r * .8, t.base); disc(x - r * .35, y - r * .35, r * .38, t.hi); dot(x - r * .45, y - r * .5, '#ffffff'); };
  const slot = it.slot === 'ring2' ? 'ring' : it.slot;
  if (slot === 'weapon' && lk.weapon === 'staff') {
    const wd = T(c.staff || '#6a4a2a'), ob = T(c.orb || '#ffb347'), gd = T('#c8a040');
    line(2.6, 14.4, 11.4, 5.6, wd.deep, 1.7); line(2.4, 14, 11, 5.4, wd.base, 1); line(3, 13, 10.4, 5.6, wd.lt);
    for (const k of [.28, .62]) { const bx = lerp(2.6, 11.4, k), by = lerp(14.4, 5.6, k); line(bx - 1, by - 1, bx + 1, by + 1, gd.base, 1.2); dot(bx - .6, by - .6, gd.hi); }
    line(11, 6.2, 10.2, 3, gd.sh, 1); line(11.2, 6.4, 14.4, 5.4, gd.sh, 1);
    glow(() => disc(12.2, 3.8, 3.8, ob.base), .3);
    disc(12.2, 3.8, 2.6, ob.deep); disc(11.9, 3.5, 2.1, ob.base); disc(11.4, 3, 1, ob.hi); dot(11.1, 2.7, '#ffffff'); dot(12.8, 4.6, ob.lt);
  } else if (slot === 'weapon') {
    const m = T(c.metal || '#dce8f1'), hl = T(c.hilt || '#e8b04e'), bl = lk.bladeLen || 11, Lb = clamp(3.8 + (bl - 6) * .92, 3.8, 11.4);
    const dx = .7071, dy = -.7071, nx = .7071, ny = .7071, gx = 5.3, gy = 10.7, tx = gx + dx * Lb, ty = gy + dy * Lb, w0 = bl >= 14 ? 1.75 : bl <= 8 ? 1.15 : 1.4;
    if (it.el && it.el !== 'phys') glow(() => line(gx, gy, tx, ty, EL(it.el).color, 3.4), .35);
    poly([[gx - nx * w0, gy - ny * w0], [tx, ty], [gx, gy]], m.lt);
    poly([[gx, gy], [tx, ty], [gx + nx * w0, gy + ny * w0]], m.sh);
    line(gx - nx * w0 * .75, gy - ny * w0 * .75, tx, ty, m.hi);
    if (Lb > 5) line(gx + dx * .8, gy + dy * .8, gx + dx * Lb * .6, gy + dy * Lb * .6, c.metalDk || m.deep);
    dot(tx, ty, '#ffffff');
    const q = bl >= 14 ? 3.4 : 2.8;
    line(gx - nx * q, gy - ny * q, gx + nx * q, gy + ny * q, hl.sh, 1.5); line(gx - nx * q - .4, gy - ny * q, gx + nx * q - .4, gy + ny * q - .6, hl.lt);
    dot(gx - nx * q, gy - ny * q, hl.hi); dot(gx + nx * q, gy + ny * q, hl.base);
    line(gx - dx * .9, gy - dy * .9, gx - dx * 3, gy - dy * 3, '#4a2a1a', 1.3);
    for (let k = 1.2; k < 3; k += .9) dot(gx - dx * k, gy - dy * k, '#8a5a30');
    disc(gx - dx * 3.8, gy - dy * 3.8, 1.1, hl.sh); dot(gx - dx * 3.8 - .4, gy - dy * 3.8 - .4, hl.hi);
    if (it.el && it.el !== 'phys') { const e = EL(it.el); dot(tx - dx * 2.5 + nx * .5, ty - dy * 2.5, e.light); dot(gx + dx * 4 - nx, gy + dy * 4 - ny, e.light); }
  } else if (slot === 'helm') {
    const hat = lk.hat, st = hat ? hat.style : lk.hood ? 'hood' : 'cap', t = T(hat ? hat.color : (c.hair || '#3a3448'));
    if (st === 'helmet') {
      ell(8, 8.4, 5.8, 5.6, t.deep); ell(7.6, 7.9, 5, 4.9, t.sh); ell(7, 7.2, 4, 3.8, t.base); ell(6, 5.6, 2, 1.4, t.lt); dot(5.4, 5, t.hi);
      line(8, 2.8, 8, 7.4, t.lt); rect(2.4, 9.2, 11.2, 1.8, t.deep); rect(2.4, 9, 11.2, .9, t.lt);
      for (const x of [3.6, 6.2, 9.8, 12.4]) dot(x, 9.9, t.hi);
      rect(5, 10.8, 6, 3.6, '#150f1e'); rect(7.3, 10, 1.4, 4.4, t.base); dot(7.4, 10.2, t.hi);
      poly([[2.6, 10.6], [5, 10.6], [5, 14.4], [3.4, 13.4]], t.sh); poly([[11, 10.6], [13.4, 10.6], [12.6, 13.4], [11, 14.4]], t.deep);
      if (base.id === 'greathelm') { rect(5, 11.8, 6, .8, t.sh); dot(6, 12.8, t.deep); dot(10, 12.8, t.deep); }
    } else if (st === 'pointed') {
      poly([[2.4, 12.6], [13.6, 12.6], [10.4, 1.6]], t.base); poly([[10.4, 1.6], [13.6, 12.6], [9.8, 12.6]], t.sh); line(4, 11.6, 9.6, 3, t.lt);
      poly([[10.4, 1.6], [13.8, 3.8], [12.2, 4.6]], t.sh);
      ell(8, 12.8, 7, 1.9, t.deep); ell(8, 12.4, 6.4, 1.3, t.sh); rect(3.8, 10.4, 8.6, 1.5, '#e8c040'); dot(4.4, 10.6, '#fff6c8');
      dot(7.4, 6.6, '#fff6c8'); dot(9.2, 8.4, '#ffe070');
    } else if (st === 'band') {
      ell(8, 9.4, 6.6, 3.6, t.deep); ell(7.8, 9, 6.2, 3.1, t.base); line(2.4, 8.4, 5, 6.4, t.hi);
      cut(() => ell(8, 9.7, 4.8, 1.9, '#000'));
      const gc = base.id === 'diadem' ? '#9fe8ff' : '#e04a4a'; gem(8, 12.3, 1.7, gc); dot(4, 11.4, t.lt); dot(12, 11.4, t.sh);
    } else if (st === 'crown') {
      for (const x of [3.6, 8, 12.4]) { poly([[x - 1.8, 9.8], [x, 3.8], [x + 1.8, 9.8]], t.sh); poly([[x - 1.4, 9.8], [x - .2, 4.4], [x + .4, 9.8]], t.base); disc(x, 3.6, .9, t.hi); }
      rect(2.2, 9.2, 11.6, 4, t.deep); rect(2.2, 9.2, 11.6, 3, t.base); rect(2.2, 9.2, 11.6, .8, t.lt);
      gem(5.2, 11, 1, '#e04a4a'); gem(8, 11, 1.2, '#4a8ae0'); gem(10.8, 11, 1, '#4ae08a');
    } else if (st === 'hood') {
      poly([[2.2, 14.6], [2.8, 7.4], [4.8, 3.4], [8, 2.2], [11.2, 3.4], [13.2, 7.4], [13.8, 14.6]], t.deep);
      poly([[3, 14], [3.4, 7.4], [5.2, 3.8], [8, 2.8], [10.4, 3.8], [12, 7], [12.4, 14]], t.base);
      line(4, 12, 4.2, 7.6, t.lt); line(5.4, 4.4, 8, 3.2, t.lt);
      ell(8.2, 9.4, 3.3, 3.9, '#0c0818'); ell(8.2, 10, 2.6, 3, '#05030a');
      if (lk.eyeGlow) { glow(() => { disc(7, 9.2, 1.4, lk.eyeGlow); disc(9.6, 9.2, 1.4, lk.eyeGlow); }, .5); rect(6.6, 9, 1.2, .8, lk.eyeGlow); rect(9.2, 9, 1.2, .8, lk.eyeGlow); }
      line(2.6, 14.4, 13.6, 14.4, t.sh);
    } else {   // leather or ranger cap: a dome with a forward brim
      if (base.id === 'ranger') { line(3.4, 9, 1.2, 2.6, '#e8e0c8', 1.2); line(1.6, 3.6, 1, 2, '#c83a2a', 1.2); }
      poly([[2.6, 11], [3.4, 6.4], [6, 4], [9.2, 3.8], [12.2, 5.6], [13, 9], [13, 11]], t.sh);
      poly([[3.2, 10.4], [3.8, 6.6], [6.2, 4.6], [9, 4.4], [11.4, 6], [12, 9], [12, 10.4]], t.base);
      line(4.2, 8.8, 5.6, 5.6, t.lt); dot(6.4, 5, t.hi);
      poly([[9.4, 10.2], [15.2, 10.6], [14.8, 12.2], [9.4, 12]], t.deep); line(9.6, 10.4, 14.8, 10.8, t.sh);
      rect(2.6, 10.2, 7.2, 1.6, t.deep); for (let x = 3.2; x < 9.4; x += 1.2) dot(x, 10.9, t.lt);
    }
  } else if (slot === 'chest') {
    const cl = T(c.coat || c.cloth || '#2f8f86'), out = lk.outfit || 'tunic', long = lk.sleeves === 'long', trim = c.trim;
    const hem = out === 'robe' ? 15.4 : out === 'coat' ? 15 : 13.8, fl = out === 'robe' ? 1.8 : out === 'coat' ? 1.1 : .7;
    if (long) { poly([[3.6, 3.4], [1, 12], [3.2, 12.6], [5.2, 6]], cl.sh); poly([[12.4, 3.4], [15, 12], [12.8, 12.6], [10.8, 6]], cl.deep); rect(1, 11.4, 2.4, 1.2, trim || cl.lt); rect(12.8, 11.4, 2.4, 1.2, trim || cl.sh); }
    else { poly([[3.8, 3.2], [1.4, 6.6], [3.6, 7.8], [5.2, 5.2]], cl.sh); poly([[12.2, 3.2], [14.6, 6.6], [12.4, 7.8], [10.8, 5.2]], cl.deep); }
    poly([[4, 2.8], [12, 2.8], [12.4, 6], [11.2, 9.6], [12 + fl, hem], [4 - fl, hem], [4.8, 9.6], [3.6, 6]], cl.sh);
    poly([[4.4, 3.2], [11.2, 3.2], [11.4, 6], [10.4, 9.6], [11 + fl, hem - .9], [4 - fl + .4, hem - .9], [4.6, 9.6], [4, 6]], cl.base);
    line(4.6, 3.8, 4.4, 9, cl.lt); line(4.2 - fl * .5, 11, 4 - fl * .7, hem - 1.2, cl.lt);
    if (out === 'coat') { line(8, 5.4, 8, hem, cl.deep); poly([[6.2, 2.8], [8, 7.4], [7.6, 9]], cl.lt); poly([[9.8, 2.8], [8.2, 7.4], [8.6, 9]], cl.sh); }
    poly([[6.2, 2.8], [9.8, 2.8], [8, 5.6]], cl.deep); line(6.2, 2.8, 8, 5.6, trim || cl.lt); line(9.8, 2.8, 8, 5.6, trim || cl.lt);
    if (lk.armor) {
      const mt = T(c.metal || '#b9c1cf');
      poly([[5, 3.8], [11, 3.8], [10.8, 8.4], [8, 9.6], [5.2, 8.4]], mt.deep); poly([[5.4, 4], [10.4, 4], [10.2, 8], [8, 9], [5.6, 8]], mt.base);
      line(8, 4.2, 8, 9, mt.hi); line(5.8, 4.6, 5.8, 7.8, mt.lt); dot(6.2, 5, '#ffffff');
      disc(4, 4, 2, mt.sh); disc(3.7, 3.7, 1.4, mt.base); dot(3.3, 3.3, mt.hi); disc(12, 4, 2, mt.deep); disc(11.7, 3.7, 1.4, mt.sh);
      if (it.unique === 'emberheart') { glow(() => disc(8, 6.4, 2.6, '#ff7a2a'), .5); gem(8, 6.4, 1.4, '#ff8a2a'); }
    }
    rect(4.8, 9.3, 6.4, 1.4, '#4a2e1c'); rect(7.3, 9.1, 1.6, 1.8, '#e8c040'); dot(7.5, 9.3, '#fff6c8');
    if (trim) line(4 - fl + .4, hem - .5, 12 + fl - .4, hem - .5, trim);
  } else if (slot === 'gloves') {
    const gl = T(c.glove || '#6a4128'), metal = METAL.includes(c.glove) || it.unique === 'titan';
    poly([[3.4, 9.4], [11.6, 9.4], [12.2, 14.6], [2.8, 14.6]], gl.sh); rect(3.2, 9.2, 8.6, 1.4, gl.lt); line(3.4, 14, 12, 14, gl.deep);
    poly([[1.8, 5], [4.2, 6], [4.2, 9], [2.4, 8.2]], gl.sh);
    rect(4, 4.4, 7.4, 5.2, gl.base);
    for (let i = 0; i < 4; i++) { const fx = 4 + i * 1.85, top = i === 0 || i === 3 ? 2.6 : 1.6; rect(fx, top, 1.6, 4, i % 2 ? gl.sh : gl.base); dot(fx + .3, top, gl.lt); }
    line(4.2, 4.6, 11.2, 4.6, gl.lt); line(11.4, 4.6, 11.4, 9.4, gl.deep);
    if (metal) { line(4.2, 7, 11.2, 7, gl.deep); for (const x of [5, 7.6, 10.2]) dot(x, 5.6, gl.hi); dot(4.6, 10.6, gl.hi); dot(11, 10.6, gl.hi); }
    else { dot(6, 11.6, gl.deep); dot(9, 11.6, gl.deep); }
  } else if (slot === 'legs') {
    const pt = T(c.pants || '#3b3552'), metal = METAL.includes(c.pants) || it.unique === 'spire';
    rect(3.4, 1.4, 9.2, 2.8, pt.sh); rect(3.4, 1.4, 9.2, 1, pt.lt); rect(7.4, 1.6, 1.4, 2.2, '#e8c040');
    poly([[3.4, 4], [7.8, 4], [7.4, 14.8], [3.8, 14.8]], pt.base); poly([[8.2, 4], [12.6, 4], [12.2, 14.8], [8.6, 14.8]], pt.sh);
    line(8, 4, 8, 7, pt.deep); line(4.6, 5, 4.6, 14, pt.lt); line(3.8, 14.6, 7.4, 14.6, pt.deep); line(8.6, 14.6, 12.2, 14.6, pt.deep);
    if (metal) { disc(5.6, 9.2, 1.9, pt.hi); disc(5.6, 9.2, 1.3, pt.lt); disc(10.4, 9.2, 1.9, pt.base); disc(10.4, 9.2, 1.2, pt.sh); line(3.8, 11.6, 7.2, 11.6, pt.deep); line(8.8, 11.6, 12.2, 11.6, pt.deep); }
  } else if (slot === 'boots') {
    const bt = T(c.boot || '#6a4128'), metal = METAL.includes(c.boot);
    if (base.id === 'treads') poly([[9, 5], [14, 2.6], [12.8, 5.2], [14.6, 5.4], [9.2, 7.6]], '#e8e0c8');
    poly([[4.2, 2.6], [9.4, 2.6], [9.6, 10], [4, 10.4]], bt.base); poly([[7.8, 2.6], [9.4, 2.6], [9.6, 10], [7.8, 10]], bt.sh);
    poly([[4, 10], [9.6, 9.6], [12.6, 10.8], [13.8, 12.6], [13.8, 13.6], [4, 13.6]], bt.base); poly([[9.6, 11.8], [13.8, 12.6], [13.8, 13.6], [9.6, 13.6]], bt.sh);
    dot(12.4, 11.4, bt.lt); line(4.6, 4, 4.6, 12.6, bt.lt);
    rect(3.8, 13.6, 10.2, 1.2, bt.deep); rect(3.8, 2.2, 6, 1.8, bt.lt); rect(3.8, 3.6, 6, .6, bt.sh);
    if (metal) { for (const y of [5.4, 7.6, 11.2]) line(4.4, y, 9.2, y, bt.deep); dot(6, 6.4, bt.hi); dot(11, 11.6, bt.hi); }
    else for (const y of [5, 7, 9]) dot(6.8, y, '#d8c8a0');
    if (it.unique === 'ashwalker') { glow(() => { disc(6, 13.6, 2, '#ff6a1a'); disc(11, 13.6, 2, '#ff6a1a'); }, .45); dot(5, 13.8, '#ffd070'); dot(9, 13.8, '#ffb040'); dot(12.6, 13.8, '#ffd070'); }
  } else if (slot === 'cloak') {
    const cp = T(c.cape || '#c8452f'), ci = T(c.capeIn || E.shade(c.cape || '#c8452f', -.4)), longc = lk.cape && lk.cape.len >= 8;
    const bot = longc ? 15.2 : 14.2, wid = lk.cape && lk.cape.width >= 7 ? 1 : 0;
    poly([[5, 2], [11, 2], [14.4 + wid, bot], [1.6 - wid, bot]], cp.base);
    poly([[5, 2], [1.6 - wid, bot], [3.4 - wid, bot], [5.8, 4]], ci.base);
    poly([[8.2, 3.4], [10.2, bot], [8.4, bot], [7.4, 5]], cp.sh); poly([[10.6, 3.4], [13.6 + wid, bot], [12.4 + wid, bot], [10, 5]], cp.deep);
    poly([[6.6, 3.4], [6.2, bot], [5.2, bot], [6, 5]], cp.lt);
    for (let x = 3; x < 14; x += 2.2) dot(x, bot - .3, cp.deep);
    rect(4.2, 1.2, 7.6, 2.4, cp.sh); rect(4.2, 1.2, 7.6, .8, cp.lt);
    if (c.trim) line(1.8 - wid, bot - .6, 14.2 + wid, bot - .6, c.trim);
    gem(8, 2.4, 1.3, c.trim || '#e8c040');
  } else if (slot === 'amulet') {
    const gd = T('#c8a040');
    for (let i = 0; i <= 14; i++) { const u = i / 14, x = 2.6 + 10.8 * u, y = 1.4 + 6.6 * Math.pow(Math.sin(u * Math.PI), .8); dot(x, y, i % 2 ? gd.lt : gd.sh); }
    if (base.shape === 'talisman') {
      poly([[8, 7.4], [12, 11.4], [8, 15.4], [4, 11.4]], gd.deep); poly([[8, 8.2], [11, 11.4], [8, 14.4], [5, 11.4]], gd.base);
      line(8, 8.6, 5.6, 11.2, gd.hi); line(6.4, 12.6, 9.6, 12.6, gd.deep); line(8, 10, 8, 13.6, gd.deep);
      gem(8, 11.2, 1.2, it.gem || '#e04a4a');
    } else { rect(7.4, 7.6, 1.2, 1.4, gd.lt); disc(8, 11, 3.3, gd.deep); disc(7.8, 10.8, 2.8, gd.base); dot(6, 9.4, gd.hi); gem(8, 11, 2, it.gem || '#e04a4a'); }
  } else if (slot === 'ring') {
    const sig = base.shape === 'signet', gd = T(sig ? (it.gem || '#c8a040') : '#c8a040');
    ell(8, 10.6, 5.4, 4, gd.deep); ell(7.7, 10.3, 4.9, 3.5, gd.base); line(3.2, 9.6, 5, 7.6, gd.hi);
    cut(() => ell(8, 11, 3.3, 2.1, '#000'));
    if (sig) { ell(8, 6.6, 3.4, 2.4, gd.deep); ell(7.8, 6.3, 2.9, 1.9, gd.lt); line(6.8, 6, 9, 6.8, gd.deep); line(7, 7, 8.8, 5.6, gd.deep); dot(6.6, 5.4, '#ffffff'); }
    else { dot(5.6, 7.2, gd.lt); dot(10.4, 7.2, gd.sh); gem(8, 5.6, 2.6, it.gem || '#4a8ae0'); }
  } else { disc(8, 8, 5, '#3a3048'); E.font.text(g, '?', P0(8), P0(4.5), '#c8c0d8', { align: 'center', outline: false }); }
}

/* =============================================================================
 * SHARED LOOT UI HELPERS (the inventory and shop panels in 42-inventory.js build on these)
 * ============================================================================= */
const LOT_RAR = [   // rarity frames: border, cell tint, glow
  { bd: '#5a5270', tint: '#141020', glow: null }, { bd: '#4a6ad0', tint: '#1a2a5a', glow: '#6a9aff' }, { bd: '#d8c040', tint: '#38340e', glow: '#ffd84a' },
  { bd: '#ff8a2a', tint: '#4a2410', glow: '#ff8a2a' }, { bd: '#e8d0a0', tint: '#3a2e1a', glow: '#e8c890' }];
const LOT_CELLBG = new Map();
/** an item cell: a rarity-framed inset with the icon (st: { hover, focus, sel, dim, empty }) */
function LOT_cell(g, x, y, S, it, st = {}) {
  const R = it ? LOT_RAR[it.rarity] || LOT_RAR[0] : null, lit = st.hover || st.focus;
  px.rect(g, x, y, S, S, '#07050c');
  const key = (it ? it.rarity : -1) + ':' + S + ':' + (lit ? 1 : 0); let bg = LOT_CELLBG.get(key);   // the inside: a gradient toward the rarity's tint, baked once per size
  if (!bg) { bg = E.mkCanvas(S - 2, S - 2); const cg = E.ctx2d(bg); if (R) for (let i = 0; i < S - 2; i++) px.rect(cg, 0, i, S - 2, 1, E.mix('#0e0a18', R.tint, clamp(i / (S - 2), 0, 1) * (lit ? 1 : .8))); else { px.rect(cg, 0, 0, S - 2, S - 2, lit ? '#1c1630' : '#100c1a'); px.rect(cg, 0, 0, S - 2, 1, '#07050c'); } LOT_CELLBG.set(key, bg); }
  g.drawImage(bg, x + 1, y + 1);
  const bd = st.bad ? '#ff5a5a' : st.good ? '#8aff8a' : lit ? GOLD : st.sel ? '#bff6ff' : R ? R.bd : '#2a2238';
  px.rect(g, x, y, S, 1, bd); px.rect(g, x, y + S - 1, S, 1, E.shade(bd, -.3)); px.rect(g, x, y, 1, S, bd); px.rect(g, x + S - 1, y, 1, S, E.shade(bd, -.3));
  if (R && R.glow && it.rarity >= 3) { const k = .5 + .5 * Math.sin(game.real * 3 + (typeof it.uid === 'number' ? it.uid : 0)); px.blend(g, .15 + .15 * k, 'add', () => { px.rect(g, x + 1, y + S - 3, S - 2, 2, R.glow); }); }
  if (it && it.rarity === 4) for (const [cx, cy] of [[x + 1, y + 1], [x + S - 3, y + 1], [x + 1, y + S - 3], [x + S - 3, y + S - 3]]) { px.rect(g, cx, cy, 2, 2, '#fff0c8'); px.dot(g, cx + (cx > x + 2 ? 0 : 1), cy + (cy > y + 2 ? 0 : 1), '#a8804a'); }
  if (it) drawItemIconEx(g, it, x + Math.floor((S - 16) / 2), y + Math.floor((S - 16) / 2), 1, { alpha: st.dim ? .35 : 1 });
  if (it && it.affixes && it.affixes.some(a => a.g)) LOT_star(g, x + 4, y + 4, LOT_GREAT);   // a greater line inside: worth a second look
  if (st.focus) { const t = Math.floor(game.real * 4) % 2; for (const [cx, cy, sx, sy] of [[x - 1 - t, y - 1 - t, 1, 1], [x + S - t, y - 1 - t, -1, 1], [x - 1 - t, y + S - t, 1, -1], [x + S - t, y + S - t, -1, -1]]) { px.rect(g, cx + (sx < 0 ? -2 : 0) + t, cy, 3, 1, '#fff6d8'); px.rect(g, cx + t, cy + (sy < 0 ? -2 : 0), 1, 3, '#fff6d8'); } }
}
/** empty paper-doll slots show a dark silhouette of what goes there */
const LOT_GHOSTS = {};
function LOT_ghost(slot) {
  if (LOT_GHOSTS[slot]) return LOT_GHOSTS[slot];
  const baseId = { weapon: 'longsword', helm: 'ironhelm', chest: 'tunic', gloves: 'wraps', legs: 'trousers', boots: 'boots', cloak: 'cape', amulet: 'amulet', ring: 'ring', ring2: 'ring' }[slot], B = REG.itemBases[baseId] || {}, d = '#4a4262';
  const look = JSON.parse(JSON.stringify(B.look || {})); look.colors = { metal: '#5a5478', metalDk: '#2e2840', hilt: '#4a4262', cloth: d, glove: d, pants: d, boot: d, cape: d, capeIn: '#2e2840', hair: d };
  if (look.hat) look.hat.color = '#524a6e';
  return (LOT_GHOSTS[slot] = { uid: 'ghost:' + slot, base: baseId, slot: B.slot || slot, rarity: 0, look, gem: '#4a4262', affixes: [], implicit: [] });
}
/** a coin pictogram (6x5; small: 4x4 for price tags) */
function LOT_coin(g, x, y, small) {
  if (small) { px.rect(g, x, y + 1, 4, 3, '#8a6a1a'); px.rect(g, x, y, 4, 3, '#ffd23a'); px.dot(g, x + 1, y, '#fff6c0'); return; } px.ell(g, x + 3, y + 3, 3, 2.2, '#8a6a1a'); px.ell(g, x + 3, y + 2, 3, 2.2, '#ffd23a'); px.rect(g, x + 2, y + 1, 2, 1, '#fff6c0'); px.dot(g, x + 3, y + 2, '#c89a2a'); }

/* ---------- comparing an item with what is worn: the hero's real stats with the item swapped in ---------- */
function LOT_sim(h, slot, it) {
  const f = Object.assign({}, h, { gear: Object.assign({}, h.gear), stats: {} });
  if (it) f.gear[slot] = it; else delete f.gear[slot];
  refreshPowers(f); computeStats(f); return f;
}
/** how hard the hero hits (a swing with his weapon, attack speed and crits folded in) */
function LOT_power(f) {
  const w = f.gear.weapon, staff = !!(w && w.look && w.look.weapon === 'staff'), el = (w && w.el) || 'phys';
  return heroHit(f, 1, { el, tags: staff ? ['spell'] : ['melee', 'attack'] }).amount * (staff ? f.castMul : f.atkMul) * (1 + f.critChance * (f.critMul - 1));
}
const LOT_score = f => LOT_power(f) * Math.sqrt(f.maxHp * (1 + f.armor / 150) * (1 + (f.res.fire + f.res.frost + f.res.storm + f.res.void + f.res.venom) / 5));
const LOT_gearSig = h => SLOTS.map(s => h.gear[s] ? h.gear[s].uid : 0).join(',') + '|' + h.level + '|' + h.buffs.length + '|' + (h.maxDepth || 0);
/** which slot an item goes to (for rings: the one where it helps most) */
function LOT_slotFor(h, it) {
  if (it.slot !== 'ring') return it.slot;
  if (!h.gear.ring) return 'ring'; if (!h.gear.ring2) return 'ring2';
  return LOT_score(LOT_sim(h, 'ring', it)) >= LOT_score(LOT_sim(h, 'ring2', it)) ? 'ring' : 'ring2';
}
const LOT_CMP = new Map();
/** the comparison: { slot, other, up (+1 / 0 / -1), head: [{ t, c }], lines: [{ t, c }] } (cached per item and gear) */
function LOT_compare(h, it) {
  const key = it.uid + '#' + LOT_gearSig(h); let c = LOT_CMP.get(key); if (c) return c;
  if (LOT_CMP.size > 300) LOT_CMP.clear();
  const slot = LOT_slotFor(h, it), other = h.gear[slot] || null, f0 = LOT_sim(h, slot, other), f1 = LOT_sim(h, slot, it);
  const G = '#8aff8a', Rd = '#ff7a6a', head = [], lines = [], sg = v => (v > 0 ? '+' : ''), sgf = v => sg(v) + fmt(v), p0 = LOT_power(f0), p1 = LOT_power(f1);
  const dp = p0 > 0 ? (p1 / p0 - 1) * 100 : 0, dl = f1.maxHp - f0.maxHp, da = f1.armor - f0.armor;
  // a deep weapon can be a thousand times the one he holds: past +1000% the gain reads as a multiplier (x25.5, x1.2K)
  if (Math.abs(dp) >= .5) { const x = p1 / p0; head.push({ t: dp >= 1000 ? '×' + (x < 100 ? x.toFixed(1) : fmt(x)) + ' damage' : sg(dp) + dp.toFixed(Math.abs(dp) >= 100 ? 0 : 1) + '% damage', c: dp > 0 ? G : Rd }); }
  if (Math.abs(dl) >= 1) head.push({ t: sgf(dl) + ' life', c: dl > 0 ? G : Rd });
  if (Math.abs(da) >= 1) head.push({ t: sgf(da) + ' armor', c: da > 0 ? G : Rd });
  const skip = { life: 1, lifePct: 1, armor: 1, armorPct: 1, dmgFlat: 1, dmgPct: 1 }, keys = Object.keys(STATS).concat(Object.keys(f1.stats).concat(Object.keys(f0.stats)).filter(k => !STATS[k]));
  const seen = new Set();
  for (const k of keys) { if (seen.has(k) || skip[k]) continue; seen.add(k); const d = (f1.stats[k] || 0) - (f0.stats[k] || 0); if (Math.abs(d) < .05) continue; const v = Math.round(d * 10) / 10; lines.push({ t: k.startsWith('rank:') && v < 0 ? v + statText(k, 1).slice(2) : statText(k, v), c: d > 0 ? G : Rd }); }
  for (const p of f1.powers) if (!f0.powers.includes(p) && powerSpec(p)) lines.push({ t: 'Gain ' + powerSpec(p).name, c: '#ff9a4a' });
  for (const p of f0.powers) if (!f1.powers.includes(p) && powerSpec(p)) lines.push({ t: 'Lose ' + powerSpec(p).name, c: Rd });
  const s0 = LOT_score(f0), s1 = LOT_score(f1), up = !other ? 1 : s1 > s0 * 1.005 ? 1 : s1 < s0 * .995 ? -1 : 0;
  c = { slot, other, up, head, lines }; LOT_CMP.set(key, c); return c;
}

/* ---------- the rich tooltip: a big icon, rarity header, tier pips, the power, flavor, a comparison and hints ---------- */
/** the pips: how close a line's tier is to the best its item level rolls (orange: the best, then one color per tier below) */
const LOT_PIP = ['#6a6488', '#7a9ae0', '#8ab4ff', '#ffd84a', '#ff8a2a'], LOT_GREAT = '#ffe070';
/** the advanced readout (every line's tier, its name and its tier's range) shows while Alt (or Shift) is held */
const LOT_KEYS = { alt: false };
addEventListener('keydown', e => { if (e.key === 'Alt') { LOT_KEYS.alt = true; e.preventDefault(); } });   // (a lone Alt would wake the browser's menu bar)
addEventListener('keyup', e => { if (e.key === 'Alt') { LOT_KEYS.alt = false; e.preventDefault(); } });
addEventListener('blur', () => { LOT_KEYS.alt = false; });
const LOT_adv = () => LOT_KEYS.alt || !!(game.input.held && (game.input.held.has('ShiftLeft') || game.input.held.has('ShiftRight')));
/** a greater line's pip: a small four-point star */
function LOT_star(g, cx, cy, c) { px.rect(g, cx - 2, cy, 5, 1, c); px.rect(g, cx, cy - 2, 1, 5, c); const d = E.shade(c, -.35); for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) px.dot(g, cx + dx, cy + dy, d); px.dot(g, cx, cy, '#ffffff'); }
/** a line's pip with its top-left at (x, y) in a 5x5 room: its quality color, a star when greater, gold on a unique (the
 *  mystic's enchant choices and any other list of lines use it, so a choice between lines shows their quality) */
function LOT_pip(g, x, y, it, a) {
  if (a.g) return LOT_star(g, x + 2, y + 2, LOT_GREAT);
  const inf = a.id === 'u' || it.rarity === 4 ? null : affixInfo(it, a); px.rect(g, x + 1, y + 1, 3, 3, inf ? LOT_PIP[inf.pos] : '#e8c890'); px.dot(g, x + 2, y + 1, '#ffffff');
}
/** a line's tier and its tier's range as short text: 'T6 43-47' ('' for a unique's fixed line) */
function LOT_rangeText(it, a) { const inf = a.id === 'u' || it.rarity === 4 ? null : affixInfo(it, a); return !inf ? '' : inf.fixed ? 'FIXED' : 'T' + (inf.t + 1) + ' ' + fmtV(inf.lo) + '-' + fmtV(inf.hi); }
/** the pip legend under a tooltip's lines: the five pip colors, what they mean, and how to see more */
function LOT_legend(g, x, y, w, great, adv) {
  if (adv) { E.font.text(g, 'T# TIER, ITS NAME, ITS RANGE', x, y, '#8a80a8', { font: 'tiny', outline: false }); return; }
  LOT_PIP.forEach((c, i) => { px.rect(g, x + i * 4, y + 1, 3, 3, c); px.dot(g, x + i * 4 + 1, y + 1, '#ffffff'); });
  let tx = x + 22; const put = (t, c) => { E.font.text(g, t, tx, y, c, { font: 'tiny', outline: false }); tx += E.font.width(t, { font: 'tiny' }) + 6; };
  put(great ? 'QUALITY' : 'ROLL QUALITY', '#8a80a8');
  if (great) { LOT_star(g, tx + 2, y + 2, LOT_GREAT); tx += 7; put('GREATER', '#c8b060'); }
  if (tx + E.font.width('ALT: TIERS', { font: 'tiny' }) <= x + w) put('ALT: TIERS', '#6a6488');
}
/**
 * LOT_drawTip(g, it, ax, ay, o): o { equipped: true, compare: true, hint: [{ t, c }], price: { t, c }, anchor: [x, y, w, h] (place beside it) }
 * Drawn wherever it is called (panels call it last, through game.r.overlay, so nothing covers it).
 */
function LOT_drawTip(g, it, ax, ay, o = {}, WT0) {
  const h = ED.hero, SW = game.W, SH = game.H, WT = WT0 || Math.min(176, SW - 8), rc = RARITY[it.rarity], base = REG.itemBases[it.base];
  const lh = 9, body = [], wrapW = WT - 12, adv = LOT_adv(), G = gradeInfo(it.grade);
  const push = (t, c, x = 0, pip = null, q = {}) => { for (const l of E.font.wrap(q.tiny ? t.toUpperCase() : t, wrapW - x, q.tiny ? { font: 'tiny' } : undefined)) { body.push({ t: l, c, x, pip, star: q.star, tiny: q.tiny }); pip = null; } };
  if (it.dmg) push(dmgText(it), it.el && it.el !== 'phys' ? EL(it.el).light : '#ffffff');
  for (const a of it.implicit) push(statText(a.stat, a.v), '#c8c0d8');
  if (it.implicit.length || it.dmg) body.push({ sep: true });
  // every rolled line: a pip for its roll (a star when greater), a hybrid's second stat under it, and with Alt its tier
  // number, its tier's name and the range that tier rolls at this item level
  let rolled = false, great = false;
  it.affixes.forEach((a, i) => {
    const uq = it.rarity === 4 || a.id === 'u', inf = uq ? null : affixInfo(it, a), c = uq ? '#e8c890' : a.g ? LOT_GREAT : i === it.enchIdx ? '#c890ff' : '#8ab4ff';
    if (inf) rolled = true; if (a.g) great = true;
    push(statText(a.stat, a.v), c, 6, uq ? '#e8c890' : a.g ? LOT_GREAT : LOT_PIP[inf ? inf.pos : 0], { star: !!a.g });
    for (const b of a.also || []) push('& ' + statText(b.stat, b.v), c, 12);
    if (adv && inf) push((inf.fixed ? '' : 'T' + (inf.t + 1) + ' ') + inf.name + '  ' + (inf.fixed ? 'fixed' : fmtV(inf.lo) + '-' + fmtV(inf.hi) + inf.also.map(r => ' & ' + fmtV(r.lo) + '-' + fmtV(r.hi)).join('')) + (a.g ? ' x1.5' : ''), a.g ? '#c8b060' : inf.pos >= 3 ? E.mix(LOT_PIP[inf.pos], '#8a80a8', .45) : '#8a80a8', 12, null, { tiny: true });
  });
  const pw = powerSpec(it.power);
  if (pw) {
    body.push({ sep: true }); push(pw.name.toUpperCase() + (pw.rank ? '  RANK ' + fmt(pw.rank) : ''), '#ffb070', 6, '#ff8a2a');
    const c0 = pw.composed && cxParse(pw.id); if (c0) push('composed: ' + c0.t + ' + ' + c0.e + ' + ' + c0.el, '#a8704a', 6, null, { tiny: true });   // the language shows its grammar
    push(pw.desc, '#ff9a4a', 6);
  }
  if (it.flavor) { body.push({ sep: true }); push(it.flavor, '#a89878'); }
  // the comparison block
  const cmp = [];
  if (o.equipped) cmp.push({ t: 'EQUIPPED', c: '#bff6ff', head: true });
  else if (o.compare !== false && h && it.slot) {
    const C = LOT_compare(h, it);
    cmp.push({ t: C.other ? 'IF EQUIPPED (vs ' + (C.other.name.length > 18 ? C.other.name.slice(0, 17) + '.' : C.other.name) + ')' : 'IF EQUIPPED (' + SLOT_NAMES[C.slot] + ' is empty)', c: '#9a90b0', head: true });
    for (const l of C.head) cmp.push({ t: (l.c === '#8aff8a' ? '↑ ' : '↓ ') + l.t, c: l.c });
    for (const l of C.lines.slice(0, 8)) cmp.push(l);
    if (C.lines.length > 8) cmp.push({ t: '... and ' + (C.lines.length - 8) + ' more', c: '#6a6488' });
    if (!C.head.length && !C.lines.length) cmp.push({ t: 'No difference', c: '#9a90b0' });
  }
  for (let i = cmp.length - 1; i >= 0; i--) { const l = cmp[i]; if (l.head) continue; const ws = E.font.wrap(l.t, WT - 12); if (ws.length > 1) cmp.splice(i, 1, ...ws.map((t, k) => ({ t: (k ? '  ' : '') + t, c: l.c }))); }
  const foot = [], addF = l => { for (const t of E.font.wrap(l.t, WT - 12, { font: 'tiny' })) foot.push({ t, c: l.c }); };
  addF(o.price || { t: 'Sells for ' + fmt(it.value) + ' gold', c: '#8a8070' });
  if (rolled) foot.push({ legend: true });
  for (const l of o.hint || []) addF(l);
  // measure: header (icon + name), body, compare, footer
  const nameL = E.font.wrap(it.name, WT - 48), hdH = Math.max(44, nameL.length * 9 + 24 + (G ? 7 : 0)), bodyH = body.reduce((a, l) => a + (l.sep ? 5 : l.tiny ? 7 : lh), 0);
  while (foot.length > 1 && hdH + bodyH + foot.length * 8 + 10 > SH - 4) foot.pop();   // a very long item on a short screen gives up its hint lines first
  const cmpH = cmp.length ? cmp.length * lh + 6 : 0, footH = foot.length * 8 + 4;
  let HT = hdH + bodyH + footH + 6, side = false;
  if (HT + cmpH > SH - 4 && cmp.length) side = true; else HT += cmpH;
  if (side && WT * 2 + 4 > SW - 4 && !WT0) return LOT_drawTip(g, it, ax, ay, o, Math.floor((SW - 8) / 2));   // too narrow for two boxes: make both slimmer
  const totalW = side ? WT * 2 + 4 : WT, ch = cmp.length * lh + 10;
  let bx, by, cbx = 0, cby = 0;
  if (o.anchor) { const [rx, ry, rw] = o.anchor, right = rx + rw / 2 < SW * .45; bx = right ? rx + rw + 4 : rx - totalW - 4; if (bx < 2) bx = rx + rw + 4; if (bx + totalW > SW - 2) bx = rx - totalW - 4; by = ry - 6; }
  else { bx = ax + 12; if (bx + totalW > SW - 2) bx = ax - totalW - 8; by = ay - 8; }
  bx = clamp(Math.round(bx), 2, Math.max(2, SW - totalW - 2)); by = clamp(Math.round(by), 2, Math.max(2, SH - HT - 2)); cbx = bx + WT + 4; cby = by;
  if (side) {   // two boxes: keep what is pointed at (the focused cell, the cursor) in sight. The item box goes beside it (or out
    // at that screen edge), the comparison beside the item box, or under or over the anchor: the first spot that covers neither
    const A = o.anchor || [ax - 3, ay - 3, 6, 6], hit = (p, q) => p[0] < q[0] + q[2] && q[0] < p[0] + p[2] && p[1] < q[1] + q[3] && q[1] < p[1] + p[3];
    const fit = (x, y, h0) => [clamp(Math.round(x), 2, Math.max(2, SW - WT - 2)), clamp(Math.round(y), 2, Math.max(2, SH - h0 - 2)), WT, h0], right = A[0] + A[2] / 2 < SW * .45;
    let done = false;
    for (const ix of right ? [A[0] + A[2] + 4, SW - WT - 2] : [A[0] - WT - 4, 2]) {
      const ib = fit(ix, A[1] - 6, HT); if (hit(ib, A)) continue;
      for (const [x, y] of [[ib[0] + WT + 4, ib[1]], [ib[0] - WT - 4, ib[1]], [ib[0] + WT + 4, A[1] + A[3] + 4], [ib[0] - WT - 4, A[1] + A[3] + 4], [ib[0] + WT + 4, A[1] - ch - 4], [ib[0] - WT - 4, A[1] - ch - 4], [A[0] + A[2] + 4, A[1] - 6], [A[0] - WT - 4, A[1] - 6]]) {
        const cb = fit(x, y, ch); if (hit(cb, ib) || hit(cb, A)) continue;
        bx = ib[0]; by = ib[1]; cbx = cb[0]; cby = cb[1]; done = true; break;
      }
      if (done) break;
    }
  }
  const bd = LOT_RAR[it.rarity] ? LOT_RAR[it.rarity].bd : '#6a5a88';
  E.ui.box(g, bx, by, WT, HT, { bg: ['#1c1630', '#0a0812'], border: bd, shadow: '#000000' });
  if (it.rarity >= 1) px.blend(g, it.rarity >= 3 ? .3 : .18, 'normal', () => { for (let i = 0; i < hdH - 4; i++) px.rect(g, bx + 2, by + 2 + i, WT - 4, 1, E.mix(LOT_RAR[it.rarity].tint, '#0a0812', i / (hdH - 4))); });
  // header: the icon big, the name in its rarity color, the base and item level
  E.ui.box(g, bx + 5, by + 4, 36, 36, { bg: ['#141024', '#07050c'], border: bd, shadow: false });
  drawItemIconEx(g, it, bx + 7, by + 6, 2);
  nameL.forEach((l, i) => E.font.text(g, l, bx + 45, by + 5 + i * 9, rc.color, { outline: false, shadow: '#05040a' }));
  const sub = (it.rarity === 4 ? 'Unique ' : rc.name + ' ') + (base ? base.name : '');
  E.font.text(g, sub.length > 26 ? sub.slice(0, 25) + '.' : sub, bx + 45, by + 7 + nameL.length * 9, '#9a90b0', { font: 'tiny', outline: false });
  const ilv = 'ITEM LEVEL ' + fmt(it.ilvl) + (it.enchants ? '  •  ENCHANTED' : ''), room = WT - 50;
  E.font.text(g, E.font.width(ilv, { font: 'tiny' }) <= room ? ilv : ilv.replace('ITEM LEVEL', 'ILVL').replace('ENCHANTED', 'ENCH.'), bx + 45, by + 14 + nameL.length * 9, '#6a6488', { font: 'tiny', outline: false });
  if (G) { const gt = G.name.toUpperCase() + (it.dmg || it.armor ? '  +' + Math.round((G.k - 1) * 100) + '% BASE' : ''); E.font.text(g, E.font.width(gt, { font: 'tiny' }) <= room ? gt : G.name.toUpperCase(), bx + 45, by + 21 + nameL.length * 9, G.c, { font: 'tiny', outline: false }); }   // the grade: deeper bases hit harder
  let yy = by + hdH;
  for (const l of body) {
    if (l.sep) { px.rect(g, bx + 8, yy + 2, WT - 16, 1, '#2e2644'); yy += 5; continue; }
    if (l.pip) { if (l.star) LOT_star(g, bx + 8, yy + 4, l.pip); else { px.rect(g, bx + 7, yy + 3, 3, 3, l.pip); px.dot(g, bx + 8, yy + 3, '#ffffff'); } }
    if (l.tiny) { E.font.text(g, l.t, bx + 6 + l.x, yy, l.c, { font: 'tiny', outline: false }); yy += 7; continue; }
    E.font.text(g, l.t, bx + 6 + l.x, yy, l.c, { outline: false, shadow: '#05040a' }); yy += lh;
  }
  const drawCmp = (cx, cy) => { for (const l of cmp) { if (l.head) { px.rect(g, cx + 6, cy + 1, WT - 12, 1, '#2e2644'); E.font.text(g, l.t, cx + 6, cy + 3, l.c, { font: 'tiny', outline: false }); cy += lh; continue; } E.font.text(g, l.t, cx + 6, cy, l.c, { outline: false, shadow: '#05040a' }); cy += lh; } };
  if (cmp.length && !side) { drawCmp(bx, yy + 2); yy += cmpH; }
  px.rect(g, bx + 8, yy + 2, WT - 16, 1, '#2e2644'); yy += 5;
  for (const l of foot) { if (l.legend) LOT_legend(g, bx + 6, yy, WT - 12, great, adv); else E.font.text(g, l.t, bx + 6, yy, l.c, { font: 'tiny', outline: false }); yy += 8; }
  if (side) { E.ui.box(g, cbx, cby, WT, ch, { bg: ['#1a1428', '#0c0818'], border: '#6a5a88', shadow: '#000000' }); drawCmp(cbx, cby + 2); }
}

/* =============================================================================
 * LOOT ON THE GROUND: click a label to pick it up (close by), hover it for the full tooltip with the comparison.
 * UI.hotItem is the hovered drop (drawDrops sets it while drawing its labels).
 * ============================================================================= */
const LOT_PICK_R = 44;
function LOT_pickup(d) {
  const h = ED.hero; if (!h || !h.alive || !ED.drops.includes(d) || d.kind !== 'item') return;
  if (Math.hypot(h.x - d.x, h.y - d.y) > LOT_PICK_R) { notify('TOO FAR AWAY', '#9a90b0', 1); sfx('cancel', { vol: .3 }); return; }
  if (h.bag.length >= BAG_MAX) { notify('BAG FULL', '#ff8a7a', 1.5); sfx('cancel', { vol: .4 }); return; }
  ED.drops.splice(ED.drops.indexOf(d), 1); h.bag.push(d.item); d.item._new = true;
  sfx('pickup', { vol: .6 }); BUS.emit('pickup', { item: d.item }); if (d.item.rarity >= 1) notify(d.item.name, RARITY[d.item.rarity].color, 2.2);
  const it = d.item, sx = d.x, sy = d.y, sz = d.z;   // it flies into his hands
  FX.visual(.28, (r, u) => { const k = E.ease.inQuad(u), x = lerp(sx, h.x, k), y = lerp(sy, h.y, k), z = lerp(sz, h.z + 14, k) + Math.sin(u * Math.PI) * 16; r.queue(x, y, z, g => { const [X, Y] = r.w(x, y, z); drawItemIconEx(g, it, X - 8, Y - 8, 1, { anim: false }); }, { bias: .5 }); });
  P.glints(sx, sy, 6, 4, RARITY[it.rarity].color, 8);
}
BUS.on('pickup', e => {
  const it = e.item; if (!it) return; it._new = true;
  if (typeof tip === 'function') {   // one-time hints (94-tips.js) the first time loot matters
    if (it.rarity >= 3) tip('lot:legend', 'A ' + RARITY[it.rarity].name.toUpperCase() + '!  PRESS I: ITS POWER CHANGES HOW YOU FIGHT', RARITY[it.rarity].color, 6);
    else if (it.rarity >= 1) tip('lot:bag', 'I OPENS THE BAG  •  HOVER LOOT TO COMPARE  •  CLICK A LABEL TO PICK IT UP', '#bff6ff', 5);
  }
});
BUS.on('draw', e => {
  const r = e.r; UI.hotItem = null;
  for (const d of ED.drops) if (d.kind === 'item') d.lab = null;   // drawDrops' overlay sets the labels it really draws this frame
  if (UI.stack.length || !ED.hero) return;
  r.overlay(() => {
    for (const d of ED.drops) if (d.kind === 'item' && d.lab) { const [x, y, w, hh] = d.lab; hot(x, y, w, hh, { click: () => LOT_pickup(d) }); }
    const d = UI.hotItem;
    if (d && d.item) r.overlay(g => { LOT_drawTip(g, d.item, UI.mouse.x, UI.mouse.y, { anchor: d.lab, hint: [{ t: Math.hypot(ED.hero.x - d.x, ED.hero.y - d.y) <= LOT_PICK_R ? 'CLICK TO PICK UP' : 'CLICK TO PICK UP (COME CLOSER)', c: '#c8c0d8' }] }); });
  });
});

/* a handle for tests and tools (window.__ed is set up by 99-start.js) */
window.__edLoot = { drawItemIconEx, LOT_drawTip: (g, it, x, y, o) => LOT_drawTip(g, it, x, y, o), LOT_compare, LOT_pickup, makeItem, affixInfo, powerSpec, rescaleItem, tierTop, gradeInfo, keys: LOT_KEYS, cx: { T: CX_T, E: CX_E } };
