/* =============================================================================
 * PROGRESSION: the passive constellation (P), the skills panel (K), respecHero(h) and autoAllocatePassives(h)
 * THE CONSTELLATION is generated once from a fixed seed and fixed data, so node ids never change between sessions
 * (h.tree keeps the allocated ids). The Ember sigil sits in the middle of an inner ring; six regions radiate out:
 *   MIGHT (melee, physical, life, armor, knockback)   GRACE (speed, attack speed, crit, evasion)
 *   STORM (storm, chains, crit damage)                EMBER (fire, spells, ember)
 *   RIME  (frost, area, chill)                        VOID  (void, leech, curses, statuses)
 * plus a small FORTUNE pocket (gold, item rarity, experience, pickup). Every region has a trunk to a hub, a long
 * middle road through its first notable to its KEYSTONE, and two WHEELS (an orbit of small stars around a notable)
 * that lead on to an outer notable each. Bridges join neighbouring regions; three more keystones sit on borders
 * (Glass Cannon, Vampiric Blade, and Iron Reflexes: a conversion rule run through statFinal).
 * Node types: small (one STATS key), notable (named, 2-3 stats), keystone (a rule change: REG.passives, wired
 * through BUS hooks that check the allocation at run time). Allocation spends h.pts.passive and needs a neighbour
 * that is allocated (or the start); clicking a far star buys the whole shortest road to it.
 * THE DEEP: the descent never ends, so neither does the sky. Once all 199 stars are lit, a ring of DEEP STARS wakes
 * past the rim (generated from a seed per ring, so ids 'dp<ring>_<j>' are stable), and each ring completed wakes the
 * next, a little wider and a little stronger: modest region stats, a named deep notable every sixth star.
 * THE SKILLS PANEL lists every REG.skills entry by kind, ranks them (h.pts.skill, ranks 1-5; the unlock level gates
 * rank 1), chooses runes (rank 2+) and assigns the six slots. Past rank 5 every point is a MASTERY rank (k.mastery):
 * more damage with that skill, a little less each time, and at mastery 5, 15, 30, 50... the chosen rune deepens a
 * tier (+1 to the skill). So a skill point and a passive point always buy something: PRG_canSpend(h) says so.
 * This file sorts before 60-ui-core.js, so the two panels are registered from a microtask once the UI kit exists.
 * ============================================================================= */

/* ---------- keystones: the build-defining rules (REG.passives). `rules` read in tooltips; stats go through the tree ---------- */
const PRG_KS = {};
function PRG_keystone(id, spec) { spec.keystone = true; PRG_KS[id] = def('passives', id, spec); }
PRG_keystone('juggernaut', { name: 'Juggernaut', icon: 'shield', stats: { armorPct: 30, moveSpeed: -10 },
  rules: ['You cannot be knocked down.', 'Knockback and staggers against you are 80% weaker.'] });
PRG_keystone('windwalker', { name: 'Wind Walker', icon: 'gust', stats: { dodgeCharges: 1, armorPct: -25 },
  rules: ['Dodging releases a gust that hurls nearby enemies away.'] });
PRG_keystone('overload', { name: 'Elemental Overload', icon: 'bolt', stats: { critDmg: -40 },
  rules: ['Critical strikes with elemental damage grant Overload: 40% more Damage for 4 seconds.'] });
PRG_keystone('conflagration', { name: 'Conflagration', icon: 'flame', stats: { resFire: -30 },
  rules: ['Burning enemies explode when they die, setting fire to everything around them.'] });
PRG_keystone('absolutezero', { name: 'Absolute Zero', icon: 'flake', stats: { incFire: -40 },
  rules: ['Frost hits chill twice.', 'Chilled and frozen enemies take 20% more damage from you.'] });
PRG_keystone('bloodmagic', { name: 'Blood Magic', icon: 'drop', stats: { lifePct: 15 },
  rules: ['Skills cost Life instead of Ember.', 'Your Ember is always full.'] });
PRG_keystone('vampiric', { name: 'Vampiric Blade', icon: 'fang', stats: { potionHeal: -30 },
  rules: ['Melee hits heal you for 4% of the damage they deal.', 'You have no natural Life Regeneration.'] });
PRG_keystone('glasscannon', { name: 'Glass Cannon', icon: 'glass', stats: { moreDmg: 40, lifePct: -30 },
  rules: ['Everything you do hits harder; everything that hits you hurts more.'] });
PRG_keystone('ironreflexes', { name: 'Iron Reflexes', icon: 'reflex', stats: { armorPct: 15 },
  rules: ['You can no longer evade hits.', 'Every 1% chance to evade you have becomes 5% increased Armor.'] });
// a conversion runs after every stat source (statFinal), so evasion from gear, the tree and buffs all turns to armor
// (it asks the allocation directly, not PRG_on, so the loot panels' what-if copies of the hero convert too)
statFinal((h, s) => { if (!h.tree || !h.tree.length || !PRG_set(h).has('ks_ironreflexes') || !(s.dodge > 0)) return; s.armorPct = (s.armorPct || 0) + s.dodge * 5; s.dodge = 0; });

/* ---------- the regions: ring stat, trunk and road stats, and five notables each ---------- */
// nt[0] sits on the middle road, nt[1] / nt[2] in the left / right wheel, nt[3] / nt[4] beyond them.
// lead: the two stats the small stars on the way to that notable alternate between.
const PRG_REGIONS = [
  { id: 'might', code: 'mi', name: 'MIGHT', ang: -90, color: '#e0504a', about: 'melee • physical • life • armor • knockback', ks: 'juggernaut', ring: ['life', 8],
    trunk: [['incMelee', 8], ['life', 10]], road: [['armor', 15], ['incMelee', 8]],
    nt: [{ name: 'Warbringer', stats: { incMelee: 16, knockback: 20, stun: 3 }, lead: [['incMelee', 8], ['incPhys', 8]] },
      { name: 'Titan Blood', stats: { life: 30, lifePct: 8, lifeRegen: 1.5 }, lead: [['life', 10], ['lifePct', 4]] },
      { name: 'Iron Skin', stats: { armor: 40, armorPct: 18 }, lead: [['armor', 15], ['armorPct', 8]] },
      { name: 'Brutal Edge', stats: { incPhys: 18, dmgPct: 10 }, lead: [['incPhys', 8], ['dmgPct', 5]] },
      { name: 'Crushing Blows', stats: { stun: 4, knockback: 25, incMelee: 10 }, lead: [['knockback', 10], ['stun', 1.5]] }] },
  { id: 'grace', code: 'gr', name: 'GRACE', ang: -30, color: '#5ad88a', about: 'movement • attack speed • crit • evasion', ks: 'windwalker', ring: ['moveSpeed', 2],
    trunk: [['moveSpeed', 3], ['atkSpeed', 4]], road: [['dodge', 1.5], ['dodgeCd', 6]],
    nt: [{ name: 'Quicksilver', stats: { atkSpeed: 8, castSpeed: 8, moveSpeed: 4 }, lead: [['atkSpeed', 4], ['castSpeed', 4]] },
      { name: 'Flurry of Steel', stats: { atkSpeed: 12, incMelee: 10 }, lead: [['atkSpeed', 4], ['incMelee', 6]] },
      { name: 'Hawk Eye', stats: { crit: 3, critDmg: 18 }, lead: [['crit', 1], ['critDmg', 6]] },
      { name: 'Fleet of Foot', stats: { moveSpeed: 8, dodgeCd: 20 }, lead: [['moveSpeed', 3], ['dodgeCd', 6]] },
      { name: 'Ghost Step', stats: { dodge: 5, moveSpeed: 4 }, lead: [['dodge', 1.5], ['moveSpeed', 3]] }] },
  { id: 'storm', code: 'st', name: 'STORM', ang: 30, color: '#ffe45a', about: 'storm • chains • critical damage', ks: 'overload', ring: ['incStorm', 5],
    trunk: [['incStorm', 8], ['crit', 1]], road: [['incStorm', 8], ['critDmg', 8]],
    nt: [{ name: 'Thunderous', stats: { incStorm: 18, chains: 1 }, lead: [['incStorm', 8], ['statusChance', 5]] },
      { name: 'Eye of the Storm', stats: { crit: 3, critDmg: 22 }, lead: [['crit', 1], ['critDmg', 8]] },
      { name: 'Arc Conduit', stats: { chains: 1, incSpell: 12 }, lead: [['incSpell', 6], ['castSpeed', 3]] },
      { name: 'Lightning Reflexes', stats: { castSpeed: 8, atkSpeed: 5, moveSpeed: 3 }, lead: [['atkSpeed', 3], ['castSpeed', 3]] },
      { name: 'Static Field', stats: { incStorm: 10, statusChance: 12, incStatus: 8 }, lead: [['statusChance', 6], ['incStorm', 8]] }] },
  { id: 'ember', code: 'em', name: 'EMBER', ang: 90, color: '#ff8a2a', about: 'fire • spells • ember', ks: 'conflagration', ring: ['incFire', 5],
    trunk: [['incFire', 8], ['ember', 5]], road: [['incFire', 8], ['statusDmg', 10]],
    nt: [{ name: 'Pyromancer', stats: { incSpell: 16, castSpeed: 6, incFire: 8 }, lead: [['incSpell', 8], ['incFire', 8]] },
      { name: 'Hearthkeeper', stats: { emberOnHit: 1, costRed: 8 }, lead: [['emberRegen', .5], ['costRed', 3]] },
      { name: 'Ember Heart', stats: { ember: 20, emberRegen: 2 }, lead: [['ember', 6], ['emberRegen', .5]] },
      { name: 'Kindling', stats: { incFire: 16, statusDmg: 18 }, lead: [['statusDmg', 10], ['incFire', 8]] },
      { name: 'Wildfire', stats: { incFire: 12, area: 8, statusChance: 10 }, lead: [['incFire', 8], ['area', 4]] }] },
  { id: 'rime', code: 'ri', name: 'RIME', ang: 150, color: '#7fd8ff', about: 'frost • area • chill', ks: 'absolutezero', ring: ['incFrost', 5],
    trunk: [['incFrost', 8], ['area', 4]], road: [['incFrost', 8], ['statusChance', 6]],
    nt: [{ name: 'Winter Grasp', stats: { incFrost: 16, statusChance: 12 }, lead: [['incFrost', 8], ['statusChance', 6]] },
      { name: 'Glacial Reach', stats: { area: 12, incAoe: 12 }, lead: [['area', 5], ['incAoe', 8]] },
      { name: 'Frozen Heart', stats: { resFrost: 20, armor: 25, lifePct: 5 }, lead: [['resFrost', 8], ['armor', 12]] },
      { name: 'Hoarfrost', stats: { incAoe: 10, cdr: 6 }, lead: [['cdr', 2], ['incAoe', 8]] },
      { name: 'Shatterpoint', stats: { incFrost: 10, incStatus: 16 }, lead: [['incStatus', 8], ['incFrost', 8]] }] },
  { id: 'void', code: 'vo', name: 'VOID', ang: 210, color: '#b070ff', about: 'void • leech • curses • statuses', ks: 'bloodmagic', ring: ['incVoid', 5],
    trunk: [['incVoid', 8], ['incDot', 8]], road: [['incVoid', 8], ['statusChance', 6]],
    nt: [{ name: 'Hex Weaver', stats: { incStatus: 16, statusChance: 10 }, lead: [['statusChance', 6], ['incStatus', 8]] },
      { name: 'Entropy', stats: { incDot: 20, statusDmg: 15 }, lead: [['incDot', 8], ['statusDmg', 8]] },
      { name: 'Hungering Blade', stats: { leech: 1, incMelee: 8 }, lead: [['leech', .3], ['incMelee', 6]] },
      { name: 'Void Touched', stats: { incVoid: 16, resVoid: 15 }, lead: [['resVoid', 8], ['incVoid', 8]] },
      { name: 'Soul Eater', stats: { lifeOnKill: 8, incVoid: 8 }, lead: [['lifeOnKill', 2], ['leech', .3]] }] }
];
const PRG_FORTUNE = { id: 'fortune', code: 'fo', name: 'FORTUNE', ang: -60, color: '#ffd36a', about: 'gold • item rarity • experience • pickup' };
const PRG_CORE = { id: 'core', name: 'THE EMBER', color: '#e8dcc8', about: 'the heart of the constellation' };
const PRG_RG = { core: PRG_CORE, fortune: PRG_FORTUNE }; for (const G of PRG_REGIONS) PRG_RG[G.id] = G;
// the six boundary stars of the inner ring, and the bridges between neighbouring regions (Might|Grace, Grace|Storm ...)
const PRG_RINGMIX = [['incDmg', 4], ['resAll', 4], ['incDmg', 4], ['resAll', 4], ['incDmg', 4], ['resAll', 4]];
const PRG_BRIDGE = [['atkSpeed', 3], ['crit', 1], ['incSpell', 6], ['incAoe', 6], ['statusChance', 6], ['leech', .3]];
const PRG_BORDER = { 1: { ks: 'glasscannon', road: [['crit', 1], ['critDmg', 8]] }, 5: { ks: 'vampiric', road: [['leech', .3], ['incMelee', 8]] } };
const PRG_NAME = { leech: 'Life Leech', dodge: 'Evasion', dodgeCd: 'Dodge Recovery', costRed: 'Ember Efficiency', cdr: 'Cooldown Recovery', pickup: 'Reach', statusDmg: 'Affliction', incStatus: 'Cruelty', lifeOnKill: 'Life on Kill', emberOnHit: 'Ember on Hit', resAll: 'Resilience', dmgPct: 'Weapon Damage', potionHeal: 'Potion Healing' };
function PRG_statName(k) { if (PRG_NAME[k]) return PRG_NAME[k]; const d = STATS[k]; return d ? d.name.replace(/^Increased /, '') : k; }

/* ---------- the constellation: built once. Ids come from the build order, never from the random jitter ---------- */
const PRG_T = (() => {
  const R = RNG('emberdeep:constellation'), N = {}, list = [], edges = [];
  const P = (r, a) => [Math.cos(a * Math.PI / 180) * r, Math.sin(a * Math.PI / 180) * r], jit = s => (R() - .5) * 2 * s;
  const node = (id, [x, y], type, region, o) => { if (N[id]) throw new Error('constellation: star "' + id + '" twice'); const n = Object.assign({ id, x, y, type, region, stats: {}, links: [], name: '', ring: 0 }, o); N[id] = n; list.push(n); return n; };
  const link = (a, b) => { if (a === b || N[a].links.includes(b)) return; N[a].links.push(b); N[b].links.push(a); edges.push([a, b]); };
  const small = (id, [x, y], region, st) => node(id, [x + jit(1.5), y + jit(1.5)], 'small', region, { stats: { [st[0]]: st[1] }, name: PRG_statName(st[0]) });
  const notable = (pos, region, spec) => node('nt_' + spec.name.toLowerCase().replace(/[^a-z]+/g, ''), pos, 'notable', region, { stats: Object.assign({}, spec.stats), name: spec.name });
  const keystone = (ks, pos, region) => node('ks_' + ks, pos, 'keystone', region, { stats: Object.assign({}, PRG_KS[ks].stats), name: PRG_KS[ks].name, ks });
  node('start', [0, 0], 'start', 'core', { name: 'The Ember' });
  // the inner ring: twelve stars; the six on the region axes are spokes from the start
  for (let i = 0; i < 12; i++) { const G = i % 2 ? null : PRG_REGIONS[i / 2], st = G ? G.ring : PRG_RINGMIX[(i - 1) / 2]; node('r' + i, P(42, -90 + i * 30), 'small', G ? G.id : 'core', { stats: { [st[0]]: st[1] }, name: PRG_statName(st[0]) }); if (G) link('start', 'r' + i); }
  for (let i = 0; i < 12; i++) link('r' + i, 'r' + (i + 1) % 12);
  const wheelOf = {};   // region -> { '-1': orbit ids, '1': orbit ids }
  PRG_REGIONS.forEach((G, gi) => {
    const th = G.ang; let k = 0; const nid = () => G.code + (k++);
    const chain = (from, pts, pair) => { let prev = from; pts.forEach((p, i) => { const n = small(nid(), p, G.id, pair[i % pair.length]); link(prev, n.id); prev = n.id; }); return prev; };
    // the trunk to the hub, then the middle road: two stars, the first notable, two stars, the keystone
    const hub = chain('r' + gi * 2, [P(62, th + jit(3)), P(83, th + jit(3)), P(104, th)], G.trunk);
    const m = chain(hub, [P(124, th + jit(2)), P(143, th + jit(2))], G.nt[0].lead), n0 = notable(P(163, th), G.id, G.nt[0]); link(m, n0.id);
    const kk = chain(n0.id, [P(186, th + jit(2)), P(209, th + jit(2))], G.road), ks = keystone(G.ks, P(234, th), G.id); link(kk, ks.id);
    // the wheels: a star off the hub, an orbit of five around a notable (entered on the near side, the notable on the far side)
    wheelOf[G.id] = {};
    for (const s of [-1, 1]) {
      const wi = s < 0 ? 1 : 2, a1 = chain(hub, [P(126, th + s * 9)], G.nt[wi].lead), [cx, cy] = P(164, th + s * 19), A1 = N[a1], base = Math.atan2(A1.y - cy, A1.x - cx), orb = [];
      for (let j = 0; j < 5; j++) { const a = base + j * TAU / 5, n = small(nid(), [cx + Math.cos(a) * 16, cy + Math.sin(a) * 16], G.id, G.nt[wi].lead[j % 2]); orb.push(n.id); }
      link(a1, orb[0]); for (let j = 0; j < 5; j++) link(orb[j], orb[(j + 1) % 5]);
      const nw = notable([cx, cy], G.id, G.nt[wi]); link(nw.id, orb[2]); link(nw.id, orb[3]);
      // beyond the wheel: from its outermost star, one more star and the outer notable
      const far = orb.slice(1).sort((a, b) => Math.hypot(N[b].x, N[b].y) - Math.hypot(N[a].x, N[a].y))[0];
      const o1 = chain(far, [P(200, th + s * 18)], G.nt[wi + 2].lead), no = notable(P(228, th + s * 17), G.id, G.nt[wi + 2]); link(o1, no.id);
      wheelOf[G.id][s] = orb;
    }
  });
  // bridges between neighbouring wheels, and the two border keystones beyond them
  PRG_REGIONS.forEach((G, gi) => {
    const H = PRG_REGIONS[(gi + 1) % 6], a = G.ang + 30, pos = P(176, a), st = PRG_BRIDGE[gi];
    const b = node('br' + gi, pos, 'small', G.id, { stats: { [st[0]]: st[1] }, name: PRG_statName(st[0]) });
    const nearest = orb => orb.slice().sort((p, q) => Math.hypot(N[p].x - pos[0], N[p].y - pos[1]) - Math.hypot(N[q].x - pos[0], N[q].y - pos[1]))[0];
    link(nearest(wheelOf[G.id][1]), b.id); link(nearest(wheelOf[H.id][-1]), b.id);
    const B0 = PRG_BORDER[gi]; if (!B0) return;
    const region = gi === 1 ? 'grace' : 'void'; let prev = b.id;
    [P(202, a), P(228, a)].forEach((p, i) => { const n = small('bk' + gi + '_' + i, p, region, B0.road[i]); link(prev, n.id); prev = n.id; });
    link(prev, keystone(B0.ks, P(256, a), region).id);
  });
  // the Fortune pocket off the ring between Might and Grace: two stars, a wheel around Treasure Hunter, two spurs
  { const F = PRG_FORTUNE, a = F.ang; let prev = 'r1', k = 0;
    [[P(61, a), ['goldFind', 10]], [P(79, a), ['magicFind', 6]]].forEach(([p, st]) => { const n = small('fo' + (k++), p, 'fortune', st); link(prev, n.id); prev = n.id; });
    const [cx, cy] = P(102, a), base = Math.atan2(N[prev].y - cy, N[prev].x - cx), orb = [], FS = [['goldFind', 10], ['xpGain', 3], ['pickup', 20], ['magicFind', 6], ['potionHeal', 8]];
    for (let j = 0; j < 5; j++) { const q = base + j * TAU / 5; orb.push(small('fo' + (k++), [cx + Math.cos(q) * 14, cy + Math.sin(q) * 14], 'fortune', FS[j]).id); }
    link(prev, orb[0]); for (let j = 0; j < 5; j++) link(orb[j], orb[(j + 1) % 5]);
    const th0 = notable([cx, cy], 'fortune', { name: 'Treasure Hunter', stats: { magicFind: 15, goldFind: 20 } }); link(th0.id, orb[2]); link(th0.id, orb[3]);
    for (const [ang, spec] of [[a - 9, { name: 'Scholar', stats: { xpGain: 10, pickup: 30 } }], [a + 9, { name: 'Apothecary', stats: { potionHeal: 25, potionCharges: 1 } }]]) {
      const pos = P(131, ang), near = orb.slice().sort((p, q) => Math.hypot(N[p].x - pos[0], N[p].y - pos[1]) - Math.hypot(N[q].x - pos[0], N[q].y - pos[1]))[0];
      link(near, notable(pos, 'fortune', spec).id);
    }
  }
  // Iron Reflexes on the Might | Grace border, out past their bridge (built last, so no older star's jitter moves)
  { const a = PRG_REGIONS[0].ang + 30; let prev = 'br0';
    [[P(202, a), ['armor', 15]], [P(228, a), ['dodge', 2]]].forEach(([p, st], i) => { const n = small('bk0_' + i, p, 'might', st); link(prev, n.id); prev = n.id; });
    link(prev, keystone('ironreflexes', P(256, a), 'might').id); }
  // depth from the start (lit roads flow outward), edges as objects, bounds, draw order (big stars on top)
  const q = ['start']; N.start.depth = 0;
  for (let i = 0; i < q.length; i++) for (const l of N[q[i]].links) if (N[l].depth === undefined) { N[l].depth = N[q[i]].depth + 1; q.push(l); }
  const E0 = edges.map(([a, b], i) => { const A = N[a], B = N[b], near = A.depth <= B.depth ? A : B; return { a: A, b: B, near, far: near === A ? B : A, h: E.hash2(i, 91) }; });
  let span = 0; for (const n of list) span = Math.max(span, Math.abs(n.x), Math.abs(n.y));
  const rank = { small: 0, notable: 1, keystone: 2, start: 3 };
  return { N, list, E: E0, span: span + 20, rank, coreN: list.length - 1, order: list.slice().sort((a, b) => rank[a.type] - rank[b.type]) };
})();

/* ---------- the deep: seeded rings past the rim. Ring k exists (is generated) once some hero needs it; PRG_open(h)
   says how many this hero can see: one more than the complete rings once the core is complete ---------- */
const PRG_DEEP = [];   // PRG_DEEP[k] = { k, R, ids, nts, tint }
// modest stats: about half a core star each, a notable is three of them. No evasion, cooldown or cost here: those
// are capped or run away when a thousand levels stack them
const PRG_DEEP_POOL = {
  might: [['life', 6], ['armor', 8], ['incMelee', 4], ['incPhys', 4], ['lifePct', 2]], grace: [['atkSpeed', 1], ['critDmg', 4], ['dmgPct', 3], ['moveSpeed', 1], ['incMelee', 3]],
  storm: [['incStorm', 4], ['critDmg', 4], ['incSpell', 3], ['crit', .5]], ember: [['incFire', 4], ['incSpell', 3], ['statusDmg', 5], ['ember', 3]],
  rime: [['incFrost', 4], ['incAoe', 4], ['resFrost', 3], ['armor', 6]], void: [['incVoid', 4], ['incDot', 4], ['incStatus', 4], ['resVoid', 3]],
  fortune: [['goldFind', 4], ['magicFind', 3], ['xpGain', 1]]
};
const PRG_DEEP_ADJ = ['Far', 'Pale', 'Drowned', 'Hollow', 'Silent', 'Sunken', 'Starless', 'Ashen', 'Gilded', 'Waning', 'Elder', 'Veiled', 'Wandering', 'Dreaming', 'Last', 'Deep'];
const PRG_DEEP_NOUN = { might: ['Anvil', 'Bulwark', 'Titan', 'Hammer', 'Oath'], grace: ['Feather', 'Hawk', 'Zephyr', 'Dancer', 'Arrow'], storm: ['Thunderhead', 'Spark', 'Tempest', 'Conduit', 'Squall'],
  ember: ['Hearth', 'Pyre', 'Cinder', 'Kiln', 'Beacon'], rime: ['Glacier', 'Floe', 'Icicle', 'Winter', 'Hoar'], void: ['Hunger', 'Abyss', 'Hex', 'Shade', 'Maw'], fortune: ['Hoard', 'Crown', 'Coin'] };
const PRG_DEEP_TINT = ['#9ab8ff', '#c8a0ff', '#8affd8', '#ffb8d8', '#fff0a0', '#a0e8ff'];   // each ring leans its regions toward one starlight
const PRG_ringR = k => 300 + (k - 1) * 32;
/** the region a deep star at angle a (radians) belongs to: the nearest axis, or Fortune's narrow wedge */
function PRG_deepRegion(a) {
  if (Math.abs(E.angDiff(a, -Math.PI / 3)) < .12) return 'fortune';
  let best = PRG_REGIONS[0], bd = 9; for (const G of PRG_REGIONS) { const d = Math.abs(E.angDiff(a, G.ang * Math.PI / 180)); if (d < bd) { bd = d; best = G; } } return best.id;
}
function PRG_deepRing(k) {
  k = Math.min(400, Math.floor(k)); if (!(k >= 1)) return null;   // (a save can't make it build forever)
  if (PRG_DEEP[k]) return PRG_DEEP[k];
  if (k > 1) PRG_deepRing(k - 1);
  const T = PRG_T, N = T.N, R = RNG('emberdeep:deep:' + k), R0 = PRG_ringR(k), cnt = 6 * Math.max(8, Math.round(TAU * R0 / 25 / 6));
  const rot = R() * TAU, ph = R() * TAU, lobes = 3 + k % 4, adj = PRG_DEEP_ADJ[(k - 1) % PRG_DEEP_ADJ.length], tint = PRG_DEEP_TINT[(k - 1) % PRG_DEEP_TINT.length], mul = 1 + .08 * (k - 1);
  const val = v => { const x = v * mul; return x >= 2 ? Math.round(x) : Math.round(x * 10) / 10; }, ids = [], nts = [], fresh = [];
  // the ring: a wavy loop (a few slow lobes), a notable pushed a little outward every sixth star
  for (let j = 0; j < cnt; j++) {
    const a = rot + j * TAU / cnt + (R() - .5) * .012, nt = j % 6 === 3, r = R0 + Math.sin(a * lobes + ph) * 5 + (R() - .5) * 3 + (nt ? 7 : 0), reg = PRG_deepRegion(a), rid = 'd' + k + reg;
    if (!PRG_RG[rid]) { const G0 = PRG_RG[reg]; PRG_RG[rid] = { id: reg, name: G0.name, color: E.mix(G0.color, tint, .28), about: G0.about, deep: k }; }
    const pool = PRG_DEEP_POOL[reg]; let stats, name;
    if (nt) { const p = R.pick(pool), q = pool[(pool.indexOf(p) + 1 + R.int(0, pool.length - 2)) % pool.length]; stats = { [p[0]]: val(p[1] * 3), [q[0]]: val(q[1] * 3) }; name = adj + ' ' + R.pick(PRG_DEEP_NOUN[reg]); }
    else { const p = R.pick(pool); stats = { [p[0]]: val(p[1]) }; name = PRG_statName(p[0]); }
    const n = { id: 'dp' + k + '_' + j, x: Math.cos(a) * r, y: Math.sin(a) * r, type: nt ? 'notable' : 'small', region: rid, stats, links: [], name, ring: k, j };
    N[n.id] = n; T.list.push(n); ids.push(n.id); if (nt) nts.push(n.id);
  }
  const link = (a, b) => { if (a === b || N[a].links.includes(b)) return; N[a].links.push(b); N[b].links.push(a); fresh.push([a, b]); };
  for (let j = 0; j < cnt; j++) link(ids[j], ids[(j + 1) % cnt]);
  // spokes: every outer star of the core (keystones, outer notables), or every notable of the ring before, reaches in
  const anchors = k === 1 ? T.list.filter(q => !q.ring && q.type !== 'start' && Math.hypot(q.x, q.y) > 215) : PRG_DEEP[k - 1].nts.map(i => N[i]);
  for (const A of anchors) { let best = null, bd = 1e12; for (const id of ids) { const q = N[id], d = (q.x - A.x) ** 2 + (q.y - A.y) ** 2; if (d < bd) { bd = d; best = q; } } link(A.id, best.id); }
  // depth outward from the anchors (the lit roads flow away from the Ember), then the edges and the draw order
  const q = anchors.slice().sort((a, b) => a.depth - b.depth).map(n => n.id);
  for (let i = 0; i < q.length; i++) for (const l of N[q[i]].links) if (N[l].depth === undefined) { N[l].depth = N[q[i]].depth + 1; q.push(l); }
  for (const [a, b] of fresh) { const A = N[a], B = N[b], near = A.depth <= B.depth ? A : B; T.E.push({ a: A, b: B, near, far: near === A ? B : A, h: E.hash2(T.E.length, 91) }); }
  T.order = T.list.slice().sort((a, b) => T.rank[a.type] - T.rank[b.type]);
  return PRG_DEEP[k] = { k, R: R0, ids, nts, tint, cnt };
}
/** how far out the constellation reaches for a hero who sees `op` deep rings (pans, zoom and the overview use it) */
const PRG_span = op => op > 0 ? Math.max(PRG_T.span, PRG_ringR(op) + 36) : PRG_T.span;

/* ---------- allocation ---------- */
/** the allocated ids as a Set (cached; rebuilt whenever h.tree changes) */
function PRG_set(h) { const c = h._prgSet, t = h.tree || []; if (c && c.arr === t && c.n === t.length) return c.s; const s = new Set(t); h._prgSet = { arr: t, n: t.length, s }; return s; }
const PRG_has = (h, id) => !!(h && h.tree && PRG_set(h).has(id));
/** is this keystone allocated on the current hero? (every hook asks at run time) */
const PRG_on = (h, ks) => !!(h && h === ED.hero && h.tree && h.tree.length && PRG_set(h).has('ks_' + ks));
const PRG_adj = (set, n) => n.links.some(l => l === 'start' || set.has(l));
/** how many deep rings this hero sees: none until the core is complete, then one more than the complete rings (and
 *  always every ring a star is lit in, so an odd save still draws what it owns). Cached per allocation */
function PRG_open(h) {
  const t = (h && h.tree) || [], c = h && h._prgOpen; if (c && c.arr === t && c.n === t.length) return c.v;
  const N = PRG_T.N, per = []; let core = 0, v = 0;
  for (const id of t) { const n = N[id]; if (!n) continue; if (!n.ring) core++; else { per[n.ring] = (per[n.ring] || 0) + 1; v = Math.max(v, n.ring); } }
  if (core >= PRG_T.coreN) { let k = 1; while (k < 400 && (per[k] || 0) >= PRG_deepRing(k).cnt) k++; v = Math.max(v, k); }
  if (v) PRG_deepRing(v);
  if (h) h._prgOpen = { arr: t, n: t.length, v };
  return v;
}
/** the cheapest road of unallocated stars from what is allocated to id (in buying order), [] if owned, null if none */
function PRG_path(h, id) {
  const set = PRG_set(h), N = PRG_T.N, op = PRG_open(h); if (!N[id] || id === 'start' || set.has(id)) return N[id] ? [] : null;
  if (N[id].ring > op) return null;
  const prev = new Map([['start', null]]), q = ['start']; for (const s of set) { prev.set(s, null); q.push(s); }
  for (let i = 0; i < q.length && !prev.has(id); i++) for (const l of N[q[i]].links) if (!prev.has(l) && N[l].ring <= op) { prev.set(l, q[i]); q.push(l); }
  if (!prev.has(id)) return null;
  const out = []; for (let c = id; c && c !== 'start' && !set.has(c); c = prev.get(c)) out.unshift(c);
  return out;
}
/** are all these ids still joined to the start through each other? */
function PRG_connected(ids) {
  const s = new Set(ids), seen = new Set(['start']), q = ['start'];
  for (let i = 0; i < q.length; i++) for (const l of PRG_T.N[q[i]].links) if (s.has(l) && !seen.has(l)) { seen.add(l); q.push(l); }
  return seen.size - 1 === s.size;
}
/** a loaded save may hold stars that no longer exist, twice-bought ones or islands: drop them and refund the points */
function PRG_sanitize(h) {
  if (!Array.isArray(h.tree)) h.tree = [];
  if (h._prgOk === h.tree && h._prgOkN === h.tree.length) return;
  for (const id of h.tree) { const m = /^dp(\d+)_\d+$/.exec(id); if (m && !PRG_T.N[id]) PRG_deepRing(+m[1]); }   // deep stars from a save: wake their rings first
  const N = PRG_T.N, s = new Set(h.tree.filter(id => N[id] && id !== 'start')), keep = new Set(), q = ['start'];
  for (let i = 0; i < q.length; i++) for (const l of N[q[i]].links) if (s.has(l) && !keep.has(l)) { keep.add(l); q.push(l); }
  const out = []; for (const id of h.tree) if (keep.has(id) && !out.includes(id)) out.push(id);
  if (out.length !== h.tree.length) { h.pts = h.pts || { skill: 0, passive: 0 }; h.pts.passive = (h.pts.passive || 0) + h.tree.length - out.length; h.tree = out; }
  h._prgOk = h.tree; h._prgOkN = h.tree.length;
}
/* the tree's stats: every allocated star (keystones carry their own), and Vampiric Blade's missing regeneration */
statSource((h, add) => {
  if (!h.tree) return;
  PRG_sanitize(h);
  const N = PRG_T.N; for (const id of h.tree) { const n = N[id]; if (n) for (const k in n.stats) add(k, n.stats[k]); }
  if (PRG_set(h).has('ks_vampiric')) add('lifeRegen', -baseStats(h.level).lifeRegen);
});
function PRG_totals(h) { const t = {}; for (const id of h.tree || []) { const n = PRG_T.N[id]; if (n) for (const k in n.stats) t[k] = (t[k] || 0) + n.stats[k]; } return t; }

/* ---------- keystone rules at run time (global listeners; each asks PRG_on first) ---------- */
// Blood Magic: the ember a skill spent comes back and life pays instead; the orb stays full
BUS.on('skill', e => {
  const h = e.h; if (!PRG_on(h, 'bloodmagic')) return;
  const S = REG.skills[e.id], cost = S ? skillCost(h, S) : 0; if (cost <= 0) return;
  h.ember = Math.min(h.maxEmber, h.ember + cost);
  const pay = Math.min(cost, Math.max(0, h.hp - 1)); h.hp -= pay;
  P.bits(h.x, h.y, 16, 5, ['#d8303a', '#8a1a2a', '#ff6a7a']); P.text(h.x + 4, h.y, 30, '-' + Math.round(pay), '#ff4a5a'); P.ring(h.x, h.y, 2, 12, '#c8303a', .25);
});
BUS.on('step', () => { const h = ED.hero; if (h && h.alive && PRG_on(h, 'bloodmagic')) h.ember = h.maxEmber; });
// Juggernaut: the shove is mostly refused, the stagger cut short, a knockdown undone on the spot
BUS.on('hurt', e => {
  const h = e.tgt; if (!PRG_on(h, 'juggernaut')) return;
  const hit = e.hit || {}, ang = hit.ang !== undefined ? hit.ang : hit.src ? angTo(hit.src, h) : 0, v = Math.min(260, (hit.kb || 60) + 60) / (h.mass || 1);
  h.vx -= Math.cos(ang) * v * .8; h.vy -= Math.sin(ang) * v * .8; h.hurtT = Math.min(h.hurtT, .07);
  if (h.act && h.act.name === 'down') { endAction(h); h.inv = Math.max(h.inv, .3); P.ring(h.x, h.y, 3, 22, '#e8dcc8', .3); P.dust(h.x, h.y, 0, 10, { speed: 60 }); P.text(h.x, h.y, 36, 'UNSTOPPABLE', '#ffb07a'); sfx('clang', { vol: .5 }); h.rig.kick(-3); }
});
// Wind Walker: a gust where the dodge begins
BUS.on('dodge', e => {
  const h = e.h; if (!PRG_on(h, 'windwalker')) return;
  const x = h.x, y = h.y, area = 1 + (h.stats.area || 0) / 100, a0 = h.dodgeDir || 0;
  FX.nova({ team: 'hero', src: h, x, y, r0: 6, r1: 40 * area, dur: .26, el: 'phys', color: '#bff6ff', tags: ['aoe'], hit: heroHit(h, .3, { kb: 250, tags: ['aoe'] }) });
  FX.visual(.5, (r, u) => PRG_gust(r, x, y, a0, area, u));
  for (let i = 0; i < 14; i++) { const a = i / 14 * TAU + Math.random() * .3, sp = 80 + Math.random() * 50; P.add({ kind: i % 3 ? 'dust' : 'bit', x: x + Math.cos(a) * 6, y: y + Math.sin(a) * 6, z: 2 + Math.random() * 4, vx: Math.cos(a + 1.2) * sp, vy: Math.sin(a + 1.2) * sp, vz: 20 + Math.random() * 30, g: i % 3 ? -4 : 200, drag: 3, max: .5, size: 2.2, color: i % 3 ? '#b8dce8' : '#5a8a9a' }); }
  P.ring(x, y, 4, 44 * area, '#e8fcff', .28); sfx('whoosh', { vol: .6, pitch: .7 });
});
// Elemental Overload, Absolute Zero, Vampiric Blade
BUS.on('hit', e => {
  const h = ED.hero; if (!h || e.src !== h || !h.tree || !h.tree.length) return;
  const hit = e.hit, t = e.tgt, el = hit.el || 'phys';
  if (hit.crit && el !== 'phys' && PRG_on(h, 'overload')) PRG_overload(h);
  if (PRG_on(h, 'absolutezero')) {
    if (el === 'frost' && t.alive) applyStatus(t, 'chill', 0, h);
    if (t.st.chill || t.st.freeze) { t.hp -= e.dmg * .2; if (Math.random() < .3) P.glints(t.x, t.y, (t.head || 20) * .6, 2, '#e8fbff', 8); }
  }
  if ((hit.tags || []).includes('melee') && PRG_on(h, 'vampiric') && h.alive) {
    h.hp = Math.min(h.maxHp, h.hp + e.dmg * .04);
    if (Math.random() < .6) { const a = Math.atan2(h.y - t.y, h.x - t.x), d = Math.hypot(h.x - t.x, h.y - t.y); P.add({ kind: 'ember', x: t.x, y: t.y, z: (t.head || 20) * .6, vx: Math.cos(a) * d * 3.2, vy: Math.sin(a) * d * 3.2, vz: 8, drag: .4, max: .3, color: '#ff4a5a' }); }
  }
});
/** the gust's wind: four spiral streaks on the ground that swing outward, outlined dark so they read on pale floors */
function PRG_gust(r, x, y, a0, area, u) {
  const e = E.ease.outCubic(u), fade = clamp((1 - u) * 1.6, 0, 1);
  r.decal(() => {
    const g = r.tgt, arcs = [];
    for (let k = 0; k < 4; k++) { const R0 = (8 + e * 38 * area) * (1 - k * .07), a1 = a0 + k * TAU / 4 + e * 2.6, len = 1.7 * (1 - u * .55), pts = []; for (let i = 0; i <= 9; i++) { const q = i / 9, a = a1 + q * len, R = R0 * (.62 + .38 * q); pts.push(r.w(x + Math.cos(a) * R, y + Math.sin(a) * R, 1)); } arcs.push(pts); }
    px.blend(g, fade * .7, 'normal', () => { for (const pts of arcs) for (let i = 1; i < pts.length; i++) px.line(g, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], '#1e4a62', 3); });
    px.blend(g, fade, 'normal', () => { for (const pts of arcs) for (let i = 1; i < pts.length; i++) px.line(g, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], i > 6 ? '#ffffff' : i > 3 ? '#bff6ff' : '#6fc8e8', 1); });
  }, { emissive: .8 });
}
function PRG_overload(h) {
  const b = h.buffs.find(q => q.id === 'overload'); if (b) { b.t = 4; return; }
  h.buffs.push({ id: 'overload', name: 'Overload', color: '#ffe45a', t: 4, stats: { moreDmg: 40 } }); computeStats(h);
  P.sparks(h.x, h.y, 16, 14, null, { color: '#ffe45a', hot: '#ffffff' }); P.ring(h.x, h.y, 4, 28, '#ffe45a', .3); P.glints(h.x, h.y, 22, 6, '#fffbd0', 14); sfx('zap', { vol: .45 });
}
// Conflagration: a burning foe bursts into a fire nova that sets its neighbours alight (chains through packs).
// The kill event carries the statuses the foe died with (e.st), so any killer counts: a hit, a burn tick, a mechanic
let PRG_boomT = 0, PRG_boomN = 0;
BUS.on('kill', e => {
  const h = ED.hero, t = e.tgt; if (!t || t.team !== 'foe' || !(e.st && e.st.burn) || !PRG_on(h, 'conflagration')) return;
  if (game.time - PRG_boomT > .25) { PRG_boomT = game.time; PRG_boomN = 0; } if (++PRG_boomN > 10) return;   // a cap per quarter second
  const area = 1 + (h.stats.area || 0) / 100;
  FX.nova({ team: 'hero', src: h, x: t.x, y: t.y, r0: 4, r1: 34 * area, dur: .22, el: 'fire', tags: ['aoe', 'proc'], hit: heroHit(h, .5, { el: 'fire', tags: ['aoe', 'proc'], extra: { statusChance: 1 } }) });
  P.fire(t.x, t.y, 6, 9, { size: 3.5, speed: 50 }); P.sparks(t.x, t.y, 8, 8, null, { color: '#ff9a3a', hot: '#fff0a0' }); FX.scorch(t.x, t.y, 9);
  if (PRG_boomN <= 3) { sfx('explode', { vol: .3 }); shake(1.5); }
});

/* ---------- respec (the mystic calls respecHero if it exists) and the autopilot's allocator ---------- */
const PRG_FREE = (h, id) => characterOf(h).skills.includes(id) ? 1 : 0;   // the ranks every hero starts with are not refunded
function PRG_respec(h, what = 'all', o = {}) {
  h = h || ED.hero; if (!h) return null;
  const out = { skill: 0, passive: 0 }; h.pts = h.pts || { skill: 0, passive: 0 };
  if (what !== 'skill') { PRG_sanitize(h); out.passive = h.tree.length; h.pts.passive = (h.pts.passive || 0) + out.passive; h.tree = []; }
  if (what !== 'passive') {
    for (const id in h.skills) { const k = h.skills[id], keep = Math.min(k.rank || 0, PRG_FREE(h, id)); out.skill += (k.rank || 0) - keep + (k.mastery || 0); k.rank = keep; delete k.rune; delete k.mastery; if (!keep) delete h.skills[id]; }
    h.pts.skill = (h.pts.skill || 0) + out.skill;
    h.slots = h.slots.map(id => id && h.skills[id] && h.skills[id].rank > 0 ? id : null);
  }
  h.buffs = h.buffs.filter(b => b.id !== 'overload'); computeStats(h); PRG_V.session.clear();
  if (!o.quiet) { sfx('warp', { vol: .6 }); if (out.skill + out.passive) notify('RETURNED: ' + out.skill + ' SKILL AND ' + out.passive + ' PASSIVE POINTS', '#d8b0ff', 4); }
  return out;
}
/** refund skill and passive points: respecHero(h), respecHero(h, 'skill' | 'passive'). Returns { skill, passive } */
function respecHero(h, what, o) { return PRG_respec(h, what, o); }
/** spend every passive point toward the cheapest notable, preferring the region that suits the slotted skills */
function autoAllocatePassives(h) {
  if (!h || !h.pts || !(h.pts.passive > 0)) return 0;
  PRG_sanitize(h);
  const want = PRG_autoRegion(h), N = PRG_T.N; let spent = 0, guard = 80;
  while (h.pts.passive > 0 && guard-- > 0) {
    const set = PRG_set(h), op = PRG_open(h), dist = new Map([['start', 0]]), q = ['start']; for (const s of set) { dist.set(s, 0); q.push(s); }
    for (let i = 0; i < q.length; i++) for (const l of N[q[i]].links) if (!dist.has(l) && N[l].ring <= op) { dist.set(l, dist.get(q[i]) + 1); q.push(l); }
    // the cheapest notable or keystone (the favoured region's first); when none is left in reach (a deep ring's
    // notables all lit), the nearest star of any kind, so no point ever waits
    let best = null, bc = 1e9;
    for (const n of PRG_T.list) if (n.type !== 'start' && dist.has(n.id) && !set.has(n.id)) { const c = dist.get(n.id) * ((PRG_RG[n.region] || PRG_CORE).id === want ? 1 : 2.5) + (n.type === 'keystone' ? 8 : n.type === 'small' ? 1000 : 0); if (c < bc) { bc = c; best = n; } }
    const path = best && PRG_path(h, best.id); if (!path || !path.length) break;
    h.tree.push(path[0]); h.pts.passive--; spent++;
  }
  if (spent) computeStats(h);
  return spent;
}
function PRG_autoRegion(h) {
  const score = { might: 1 }, by = { fire: 'ember', frost: 'rime', storm: 'storm', void: 'void', venom: 'void' };
  for (const id of h.slots || []) { const S = id && REG.skills[id]; if (!S) continue; const r = by[S.el] || ((S.tags || []).includes('melee') ? 'might' : (S.tags || []).includes('spell') ? 'ember' : 'grace'); score[r] = (score[r] || 0) + (S.kind === 'basic' ? 1 : 2); }
  return Object.keys(score).sort((a, b) => score[b] - score[a])[0];
}

/* ---------- mastery: the endless skill sink. Past rank 5 a point is a mastery rank (h.skills[id].mastery) ---------- */
const PRG_mast = (h, id) => (h.skills[id] && h.skills[id].mastery) || 0;
/** % more damage with the skill at mastery m: +5% for the first, then less and less (+1.9% at 10, +0.6% at 100) */
const PRG_mastDmg = m => m > 0 ? 12 * (Math.sqrt(1 + m) - 1) : 0;
/** rune tiers: I when a rune is chosen, II at mastery 5, III at 15, IV at 30, V at 50 ... (each gap 5 wider) */
const PRG_tierAt = n => 5 * n * (n - 1) / 2;   // the mastery tier n needs (n >= 2)
function PRG_tier(h, id) {
  const S = REG.skills[id], k = h.skills[id]; if (!S || !k || !k.rank || (S.runes && S.runes.length && !k.rune)) return 0;
  const m = k.mastery || 0; let n = 1; while (PRG_tierAt(n + 1) <= m && n < 99) n++; return n;
}
const PRG_ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const PRG_roman = n => n <= 10 ? PRG_ROMAN[n] : n < 40 ? 'X'.repeat(Math.floor(n / 10)) + PRG_ROMAN[n % 10] : String(n);
// a deeper rune tier is a real rank of the skill (it scales everything the rank does: radius, chains, duration)
statSource((h, add) => { if (!h.skills) return; for (const id in h.skills) { const n = h.skills[id] && h.skills[id].mastery ? PRG_tier(h, id) : 0; if (n > 1) add('rank:' + id, n - 1); } });
// the mastery damage lands on top of the hit, the way the core adds damage to elites (before the kill check), and the
// number that just rose from the hit is raised to the whole blow (a merged run of small hits, or a crit's own number)
BUS.on('hit', e => {
  const h = ED.hero, id = e.hit && e.hit.skill; if (!h || e.src !== h || !id || !h.skills || !e.tgt.alive) return;
  const m = PRG_mast(h, id); if (!(m > 0)) return;
  const add = e.dmg * PRG_mastDmg(m) / 100; e.tgt.hp -= add;
  if (!OPT.numbers || e.hit.noNumber) return;
  const q = e.tgt.numQ; if (q && q.p && q.t === game.time) { q.sum += add; q.p.text = fmt(q.sum); return; }
  if (e.hit.crit) { const L = P.list, s = fmt(e.dmg) + '!'; for (let i = L.length - 1; i >= Math.max(0, L.length - 40); i--) { const p = L[i]; if (p.kind === 'text' && !p.life && p.text === s) { p.text = fmt(e.dmg + add) + '!'; break; } } }
});
/** tooltip lines about a skill's mastery and rune tier (the HUD's skill tooltip may append them) */
function PRG_skillExtra(h, id) {
  const m = h && h.skills && PRG_mast(h, id), n = m ? PRG_tier(h, id) : 0; if (!m) return [];
  return [{ t: 'Mastery ' + m + ': +' + PRG_mastDmg(m).toFixed(1) + '% more damage', c: '#c8b0ff' }].concat(n > 1 ? [{ t: 'Rune tier ' + PRG_roman(n) + ': +' + (n - 1) + ' to the skill', c: '#ffb070' }] : []);
}
/** spend spare skill points on the mastery of the slotted skills, the least mastered first (the autopilot's sink,
 *  once every slotted skill is rank 5). Returns the points spent */
function autoAllocateMastery(h) {
  if (!h || !h.pts || !(h.pts.skill > 0)) return 0;
  const ids = (h.slots || []).filter(id => id && REG.skills[id] && PRG_base(h, id) >= 5); let spent = 0;
  while (ids.length && h.pts.skill > 0 && spent < 200) { const id = ids.reduce((a, b) => PRG_mast(h, b) < PRG_mast(h, a) ? b : a); h.skills[id].mastery = PRG_mast(h, id) + 1; h.pts.skill--; spent++; }
  if (spent) computeStats(h);
  return spent;
}

/* ---------- can a point buy anything? (the HUD's reminder asks every frame, so the answer is cached) ---------- */
/** is there a star this hero may light next to the lit ones (any visible ring)? */
function PRG_frontier(h) {
  const t = h.tree || [], c = h._prgFront; if (c && c.arr === t && c.n === t.length) return c.v;
  PRG_sanitize(h); const set = PRG_set(h), op = PRG_open(h); let v = false;
  for (const n of PRG_T.list) if (n.type !== 'start' && n.ring <= op && !set.has(n.id) && PRG_adj(set, n)) { v = true; break; }
  h._prgFront = { arr: h.tree, n: h.tree.length, v };
  return v;
}
/** { skill, passive }: true when an unspent point of that kind has something to buy (a rank, a mastery, a star) */
function PRG_canSpend(h) {
  if (!h || !h.pts) return { skill: false, passive: false };
  return { skill: h.pts.skill > 0 && !!h.skills && Object.keys(REG.skills).some(id => PRG_canRank(h, id).ok), passive: h.pts.passive > 0 && PRG_frontier(h) };
}

/* =============================================================================
 * THE CONSTELLATION PANEL (P): full screen. Dark space, faint stars and regional nebulae; roads glow where they
 * are lit; small stars are dots, notables faceted gems, keystones great rings with an emblem.
 * Drag or WASD pans, the wheel or Q / E zooms (about the cursor), click buys, right click undoes a star bought this
 * visit, Tab shows the totals, R re-centres. With the keys a reticle picks the star in the middle (Enter buys).
 * ============================================================================= */
const PRG_V = { cx: 0, cy: 0, z: 1, zt: 1, anchor: null, go: null, drag: null, hover: null, path: null, pathKey: '', session: new Set(), fx: [], sum: false, sumScroll: 0, openT: 0, W: 0, H: 0, ox: 0, oy: 0, deny: null, dirty: false, hud: false, banner: null, reveal: null, labels: [] };
const PRG_GOLDT = E.tones('#e8b04a'), PRG_BRONZE = E.tones('#6e5a48'), PRG_SILVER = E.tones('#a8a0c0');
const PRG_SKY = Array.from({ length: 8 }, (_, i) => E.mix('#0d0a1f', '#040308', i / 7));
const PRG_tones = region => E.tones((PRG_RG[region] || PRG_CORE).color);
const PRG_dim = region => E.tones(E.mix((PRG_RG[region] || PRG_CORE).color, '#3a3450', .58));
const PRG_rad = (n, z) => n.type === 'start' ? clamp(12 * z, 7, 20) : n.type === 'keystone' ? clamp(10 * z, 6, 17) : n.type === 'notable' ? clamp(5.5 * z, 3.5, 9) : clamp(3 * z, 2, 5);
/** additive glow: three stepped discs (brightest in the middle) */
function PRG_glow(g, x, y, r, c, a) { const n = r > 14 ? 5 : 3; px.blend(g, n > 3 ? a * .62 : a, 'add', () => { for (let i = 0; i < n; i++) px.disc(g, x, y, r * (1 - i / n * .8), c); }); }
/** a 1 px circle (midpoint), for rings and reticles */
function PRG_circle(g, cx, cy, r, c) {
  cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r); if (r < 1) return;
  px.col(g, c); let x = r, y = 0, e = 1 - r;
  while (x >= y) { g.fillRect(cx + x, cy + y, 1, 1); g.fillRect(cx + y, cy + x, 1, 1); g.fillRect(cx - y, cy + x, 1, 1); g.fillRect(cx - x, cy + y, 1, 1); g.fillRect(cx - x, cy - y, 1, 1); g.fillRect(cx - y, cy - x, 1, 1); g.fillRect(cx + y, cy - x, 1, 1); g.fillRect(cx + x, cy - y, 1, 1); y++; if (e < 0) e += 2 * y + 1; else { x--; e += 2 * (y - x) + 1; } }
}
const PRG_txt = (g, s, x, y, c, o) => E.font.text(g, s, x, y, c, Object.assign({ outline: false, shadow: '#05040a' }, o));

/* keystone emblems (drawn inside the ring; s = ring radius / 10) */
const PRG_RED = E.tones('#d8303a');
const PRG_EMB = {
  shield(g, x, y, s, T) { const p = (a, b) => [x + a * s, y + b * s]; px.poly(g, [p(-5, -5), p(5, -5), p(5, 0), p(0, 6), p(-5, 0)], T.deep); px.poly(g, [p(-4, -4), p(4, -4), p(4, 0), p(0, 5), p(-4, 0)], T.base); px.poly(g, [p(-4, -4), p(0, -4), p(0, 5), p(-4, 0)], T.lt); px.line(g, x, y - 3 * s, x, y + 3 * s, T.hi); },
  gust(g, x, y, s, T) { for (let k = 0; k < 3; k++) for (let i = 0; i < 11; i++) { const a = k * TAU / 3 + i * .34, rr = (1 + i * .5) * s; px.dot(g, x + Math.cos(a) * rr, y + Math.sin(a) * rr, i > 7 ? T.hi : i > 3 ? T.lt : T.base); } px.dot(g, x, y, T.hi); },
  bolt(g, x, y, s, T) { const p = (a, b) => [x + a * s, y + b * s]; px.poly(g, [p(2, -6), p(-4, 1), p(0, 1), p(-2, 6), p(4, -1), p(0, -1)], T.base); px.poly(g, [p(2, -6), p(-4, 1), p(-1, 1)], T.lt); px.dot(g, x + 1 * s, y - 4 * s, T.hi); },
  flame(g, x, y, s, T) { const p = (a, b) => [x + a * s, y + b * s]; px.poly(g, [p(0, -6), p(3, -2), p(4, 2), p(2, 5), p(-2, 5), p(-4, 2), p(-3, -1), p(-1, -3)], T.base); px.poly(g, [p(0, -2), p(2, 1), p(2, 4), p(-2, 4), p(-2, 1)], T.lt); px.disc(g, x, y + 3 * s, 1.2 * s, T.hi); },
  flake(g, x, y, s, T) { for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 - Math.PI / 2, c = Math.cos(a), d = Math.sin(a); px.line(g, x, y, x + c * 5.5 * s, y + d * 5.5 * s, T.lt); const bx = x + c * 3.2 * s, by = y + d * 3.2 * s; px.line(g, bx, by, bx + Math.cos(a + .8) * 1.8 * s, by + Math.sin(a + .8) * 1.8 * s, T.base); px.line(g, bx, by, bx + Math.cos(a - .8) * 1.8 * s, by + Math.sin(a - .8) * 1.8 * s, T.base); } px.dot(g, x, y, T.hi); },
  drop(g, x, y, s, T, on) { const R0 = on ? PRG_RED : T, p = (a, b) => [x + a * s, y + b * s]; px.poly(g, [p(0, -6), p(2, -2), p(4, 1), p(3, 4), p(0, 5), p(-3, 4), p(-4, 1), p(-2, -2)], R0.sh); px.poly(g, [p(0, -5), p(2, -1), p(3, 2), p(0, 4), p(-2, 2), p(-2, -1)], R0.base); px.dot(g, x - 1.5 * s, y + .5 * s, R0.hi); },
  fang(g, x, y, s, T, on) { const R0 = on ? PRG_RED : T; px.line(g, x - 4 * s, y + 4 * s, x + 4 * s, y - 5 * s, T.lt, Math.max(1, Math.round(s * 1.2))); px.line(g, x - 5 * s, y + 1 * s, x - 1 * s, y + 5 * s, T.base); px.disc(g, x + 3 * s, y + 3 * s, 1.6 * s, R0.base); px.dot(g, x + 3 * s, y + 1 * s, R0.base); px.dot(g, x + 2.5 * s, y + 2.5 * s, R0.hi); },
  reflex(g, x, y, s, T) {   // a shield, and an arrow glancing off its face
    const p = (a, b) => [x + a * s, y + b * s];
    px.poly(g, [p(-3, -5), p(5, -5), p(5, 0), p(1, 6), p(-3, 0)], T.deep); px.poly(g, [p(-2, -4), p(4, -4), p(4, 0), p(1, 5), p(-2, 0)], T.base); px.poly(g, [p(-2, -4), p(1, -4), p(1, 5), p(-2, 0)], T.lt);
    px.line(g, x - 7 * s, y - 5 * s, x - 3 * s, y - 1 * s, T.hi); px.line(g, x - 3 * s, y - 1 * s, x - 7 * s, y + 3 * s, T.sh); px.line(g, x - 7 * s, y + 3 * s, x - 5 * s, y + 3 * s, T.sh); px.dot(g, x - 3 * s, y - 1 * s, '#ffffff');
  },
  glass(g, x, y, s, T) { const p = (a, b) => [x + a * s, y + b * s]; px.poly(g, [p(0, -6), p(5, -1), p(0, 6), p(-5, -1)], T.sh); px.poly(g, [p(0, -6), p(5, -1), p(0, 0)], T.lt); px.poly(g, [p(-5, -1), p(0, -6), p(0, 0)], T.base); px.line(g, x - 1 * s, y - 4 * s, x + 1 * s, y - 1 * s, T.hi); px.line(g, x + 1 * s, y - 1 * s, x - 1 * s, y + 2 * s, T.hi); px.line(g, x - 1 * s, y + 2 * s, x + 1 * s, y + 4 * s, T.hi); }
};

/* ---- node drawing: st 0 closed, 1 open (a neighbour is lit), 2 allocated; prev = on the hovered road ---- */
function PRG_drawSmall(g, x, y, r, st, T, D, pulse, prev, pts, glowed) {
  px.disc(g, x + 1, y + 1, r + 1, '#030208');
  if (st === 2) { if (!glowed) PRG_glow(g, x, y, r * 2.4, T.base, .28); px.disc(g, x, y, r + 1, '#0a0812'); px.disc(g, x, y, r, T.sh); px.disc(g, x - r * .2, y - r * .2, r * .72, T.base); px.disc(g, x - r * .35, y - r * .35, Math.max(.6, r * .34), T.lt); px.dot(g, x - r * .45, y - r * .5, T.hi); return; }
  const ring = prev ? (pulse > .5 ? '#fff0b0' : PRG_GOLDT.base) : st === 1 ? (pts > 0 ? E.mix(T.base, T.hi, pulse) : T.sh) : D.base;
  px.disc(g, x, y, r + 1, '#0a0812'); px.disc(g, x, y, r, ring); px.disc(g, x, y, r - 1, '#120e1d');
  px.dot(g, x, y, st === 1 || prev ? T.base : D.sh);
}
function PRG_drawNotable(g, x, y, r, st, T, D, t, prev) {
  const dia = (k, ox = 0, oy = 0) => [[x + ox, y - k + oy], [x + k + ox, y + oy], [x + ox, y + k + oy], [x - k + ox, y + oy]];
  if (st === 2) PRG_glow(g, x, y, r * 2.3, T.base, .28);
  px.poly(g, dia(r + 2.5, 1, 1), '#030208'); px.poly(g, dia(r + 2.5), '#0a0812');
  const F = st === 2 || prev ? PRG_GOLDT : st === 1 ? PRG_SILVER : PRG_BRONZE;
  px.poly(g, dia(r + 1.5, -1, -1), F.lt); px.poly(g, dia(r + 1.5), F.base); px.poly(g, dia(r + .5, 1, 1), F.deep);
  const G = st === 2 ? T : st === 1 ? E.tones(E.mix(T.base, '#3a3450', .35)) : D, c = [x, y], top = [x, y - r], rt = [x + r, y], bot = [x, y + r], lf = [x - r, y];
  px.poly(g, [top, rt, c], G.base); px.poly(g, [rt, bot, c], G.sh); px.poly(g, [bot, lf, c], G.deep); px.poly(g, [lf, top, c], G.lt);
  px.poly(g, dia(r * .36), st === 2 ? G.lt : G.base); px.dot(g, x - r * .4, y - r * .4, G.hi);
  if (st === 2) { const k = (t * .7 + x * .013) % 1; if (k < .3) { const a = Math.sin(k / .3 * Math.PI), sx = x - r * .45, sy = y - r * .45, L0 = Math.round(1 + a * 2.5); px.line(g, sx - L0, sy, sx + L0, sy, '#ffffff'); px.line(g, sx, sy - L0, sx, sy + L0, '#ffffff'); } }
}
function PRG_drawKeystone(g, n, x, y, R, st, T, D, t, prev) {
  const on = st === 2, F = on || prev ? PRG_GOLDT : st === 1 ? PRG_SILVER : PRG_BRONZE;
  if (on) { PRG_glow(g, x, y, R * 2, T.base, .3); for (let i = 0; i < 8; i++) { const a = t * .5 + i * TAU / 8; px.dot(g, x + Math.cos(a) * (R + 5), y + Math.sin(a) * (R + 5), i % 2 ? T.lt : T.hi); } }
  px.disc(g, x + 1, y + 2, R + 3, '#030208'); px.disc(g, x, y, R + 3, '#0a0812');
  px.disc(g, x, y, R + 2, F.deep); px.disc(g, x - 1, y - 1, R + 1, F.lt); px.disc(g, x, y, R + 1, F.base);
  px.disc(g, x, y, R - 1, '#0a0812'); px.disc(g, x, y, R - 2, on ? T.deep : '#130f1e');
  if (on) px.disc(g, x - R * .15, y - R * .15, R * .62, E.mix(T.deep, T.sh, .5));
  for (let i = 0; i < 8; i++) { const a = i * TAU / 8 - Math.PI / 2; px.dot(g, x + Math.cos(a) * R, y + Math.sin(a) * R, i % 2 ? F.deep : F.hi); }
  const S = PRG_KS[n.ks], f = S && PRG_EMB[S.icon]; if (f) f(g, x, y, R / 10, on ? T : st === 1 ? E.tones(E.mix(T.base, '#3a3450', .3)) : D, on);
}
function PRG_drawStart(g, x, y, R, t) {
  PRG_glow(g, x, y, R * 1.9, '#ff7a2a', .2);
  const star = (k, rot, inner, ox = 0, oy = 0) => { const pts = []; for (let i = 0; i < 12; i++) { const a = rot + i * TAU / 12, rr = i % 2 ? k * inner : k; pts.push([x + ox + Math.cos(a) * rr, y + oy + Math.sin(a) * rr]); } return pts; };
  const rot = t * .12 - Math.PI / 2, G = PRG_GOLDT;
  px.poly(g, star(R + 2, rot, .5, 1, 1), '#030208'); px.poly(g, star(R + 2, rot, .5), '#0a0812');
  px.poly(g, star(R + 1, rot, .48, -1, -1), G.lt); px.poly(g, star(R + 1, rot, .48), G.sh); px.poly(g, star(R, rot, .44), G.base); px.poly(g, star(R * .72, -rot * 1.6, .5), G.lt);
  const fl = Math.sin(t * 9) * .5 + Math.sin(t * 13.7) * .5;
  px.disc(g, x, y, R * .42, '#1a0a06'); px.disc(g, x, y, R * .34, '#b8321a'); px.disc(g, x, y - 1, R * (.24 + fl * .03), '#ff8a3a'); px.disc(g, x, y - 1, R * .12, '#ffe070'); px.dot(g, x - 1, y - 2, '#fffbe0');
}

/* ---- the nebula texture: fractal noise, tinted by the region each pixel's angle falls in, dithered to five steps ---- */
let PRG_neb = null;
function PRG_nebula() {
  if (PRG_neb) return PRG_neb;
  const S = 320, K = 2, c = E.mkCanvas(S, S), cg = c.getContext('2d'), img = cg.createImageData(S, S), d = img.data;
  const regs = PRG_REGIONS.map(G => ({ a: G.ang * Math.PI / 180, c: E.hex(E.tones(G.color).base) })).concat([{ a: -Math.PI / 3, c: E.hex('#c89a2a'), narrow: true }]), warm = E.hex('#ff6a2a');
  const sm = (a, b, v) => { const q = clamp((v - a) / (b - a), 0, 1); return q * q * (3 - 2 * q); };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const tx = (x - S / 2) * K, ty = (y - S / 2) * K, r = Math.hypot(tx, ty), a = Math.atan2(ty, tx);
    const n = E.noise2(tx * .011, ty * .011) * .5 + E.noise2(tx * .027 + 7, ty * .027 + 3) * .32 + E.noise2(tx * .07 + 11, ty * .07 + 5) * .18;
    let R0 = 0, G0 = 0, B0 = 0, wsum = 0;
    for (const q of regs) { const da = E.angDiff(a, q.a), w = q.narrow ? Math.exp(-((da / .16) ** 2)) * sm(50, 90, r) * (1 - sm(120, 150, r)) * .8 : Math.exp(-((da / .44) ** 2)) * sm(34, 120, r) * (1 - sm(245, 330, r)); R0 += q.c[0] * w; G0 += q.c[1] * w; B0 += q.c[2] * w; wsum += w; }
    const wc = Math.exp(-((r / 62) ** 2)) * 1.2; R0 += warm[0] * wc; G0 += warm[1] * wc; B0 += warm[2] * wc; wsum += wc;
    const I = clamp(wsum * Math.pow(n, 1.7) * 1.9, 0, 1), lv = Math.floor(I * 9 + (E.hash2(x * 7 + 3, y * 13 + 1) - .5) * .9) / 9, i = (y * S + x) * 4;   // 9 steps, a grain instead of a grid
    if (lv <= 0 || wsum < .01) continue;
    d[i] = R0 / wsum; d[i + 1] = G0 / wsum; d[i + 2] = B0 / wsum; d[i + 3] = Math.round(lv * 72);
  }
  cg.putImageData(img, 0, 0);
  return PRG_neb = { c, S, K };
}
/* ---- the space behind: a deep gradient, parallax stars that twinkle, a nebula over each region ---- */
function PRG_space(g, x0, y0, W, H, V, t, op) {
  for (let i = 0; i < 8; i++) px.rect(g, x0, y0 + Math.floor(i * H / 8), W, Math.ceil(H / 8) + 1, PRG_SKY[i]);
  const TW = 640, TH = 360, ox = -V.cx * V.z * .3, oy = -V.cy * V.z * .3;
  for (let i = 0; i < 170; i++) {
    const hb = E.hash2(i, 47), sx = ((E.hash2(i, 11) * TW + ox) % TW + TW) % TW, sy = ((E.hash2(i, 29) * TH + oy) % TH + TH) % TH; if (sx >= W || sy >= H) continue;
    const tw = .5 + .5 * Math.sin(t * (.8 + hb * 2.4) + i * 1.7), X = x0 + sx, Y = y0 + sy;
    if (hb > .95) { px.dot(g, X, Y, tw > .5 ? '#f0ecff' : '#a8a2d8'); if (tw > .8) { px.dot(g, X - 1, Y, '#6a64a0'); px.dot(g, X + 1, Y, '#6a64a0'); px.dot(g, X, Y - 1, '#6a64a0'); px.dot(g, X, Y + 1, '#6a64a0'); } }
    else px.dot(g, X, Y, hb > .75 ? (tw > .4 ? '#5c5690' : '#3e3a66') : '#2a2646');
  }
  // the nebulae: one dithered cloud texture in tree space (baked once), scaled with the zoom
  const NB = PRG_nebula(), size = Math.round(NB.S * NB.K * V.z), nx = Math.round(V.ox + (-NB.S * NB.K / 2 - V.cx) * V.z), ny = Math.round(V.oy + (-NB.S * NB.K / 2 - V.cy) * V.z);
  if (nx < x0 + W && ny < y0 + H && nx + size > x0 && ny + size > y0) px.blend(g, 1, 'add', () => g.drawImage(NB.c, nx, ny, size, size));
  const S = (tx, ty) => [V.ox + (tx - V.cx) * V.z, V.oy + (ty - V.cy) * V.z];
  // a star chart's faint dotted circles
  const [cx0, cy0] = S(0, 0);
  const rings = [42, 104, 164, 234]; for (let k = 1; k <= (op || 0); k++) rings.push(PRG_ringR(k));   // and one for every deep ring awake
  for (const rr of rings) { const R = rr * V.z, n = Math.max(24, Math.floor(TAU * R / 7)); for (let i = 0; i < n; i++) { const a = i / n * TAU, X = cx0 + Math.cos(a) * R, Y = cy0 + Math.sin(a) * R; if (X >= x0 && Y >= y0 && X < x0 + W && Y < y0 + H) px.dot(g, X, Y, rr > 290 ? '#221a3c' : '#1e1a34'); } }
}

/* ---- the panel ---- */
function PRG_treeTip(h, n) {
  const G = PRG_RG[n.region] || PRG_CORE, set = PRG_set(h);
  if (n.type === 'start') return [{ t: 'The Ember', c: GOLD, big: true }, { t: 'Every road begins here. Allocate a star that touches a lit one.', c: '#c8c0d8' }];
  const kind = (n.ring ? 'Deep ' : '') + (n.type === 'keystone' ? 'Keystone' : n.type === 'notable' ? 'Notable' : n.ring ? 'Star' : 'Passive');
  const out = [{ t: n.name, c: n.type === 'keystone' ? '#ff9a4a' : n.type === 'notable' ? GOLD : '#f0e8ff', big: true }, { t: kind + '  •  ' + cap(G.id === 'core' ? 'the Ember' : G.id) + (n.ring ? '  •  Ring ' + n.ring : ''), c: G.color }];
  if (n.type === 'keystone') for (const l of PRG_KS[n.ks].rules) out.push({ t: l, c: '#ffd0a0' });
  for (const k in n.stats) out.push({ t: statText(k, n.stats[k]), c: n.stats[k] < 0 ? '#ff8a8a' : '#8ab4ff' });
  out.push({ t: '', sep: true });
  const pts = h.pts.passive || 0;
  if (set.has(n.id)) { out.push({ t: 'Allocated', c: '#8affc8' }); if (PRG_V.session.has(n.id)) out.push({ t: PRG_canUndo(h, n.id) ? 'Right click to take it back' : 'Take back the stars beyond it first', c: '#9a90b0' }); }
  else { const path = PRG_path(h, n.id) || [], c = path.length;
    if (c <= 1) out.push(pts ? { t: 'Click to allocate  (1 point)', c: GOLD } : { t: 'No passive points: earn one each level', c: '#ff8a7a' });
    else out.push(pts >= c ? { t: 'Click to allocate the road: ' + c + ' points', c: GOLD } : { t: 'The road costs ' + c + ' points (you have ' + pts + ')', c: '#ff8a7a' }); }
  return out;
}
/** a star bought this visit can be taken back while the rest stays joined, and no star of a ring further out is lit */
function PRG_canUndo(h, id) { const r = PRG_T.N[id].ring; return PRG_V.session.has(id) && !h.tree.some(x => PRG_T.N[x] && PRG_T.N[x].ring > r) && PRG_connected(h.tree.filter(x => x !== id)); }
function PRG_undo(h, id) {
  if (!PRG_has(h, id)) return false;
  if (!PRG_canUndo(h, id)) { PRG_V.deny = { id, t: 0 }; sfx('cancel', { vol: .5 }); return false; }
  h.tree = h.tree.filter(x => x !== id); h.pts.passive++; PRG_V.session.delete(id); PRG_V.dirty = true;
  h.buffs = h.buffs.filter(b => b.id !== 'overload' || PRG_has(h, 'ks_overload')); computeStats(h);
  PRG_V.fx.push({ id, t: 0, dur: .35, undo: true }); sfx('bloop', { vol: .5 });
  return true;
}
function PRG_buy(h, id) {
  const path = PRG_path(h, id); if (!path || !path.length) return 0;
  if ((h.pts.passive || 0) < path.length) { PRG_V.deny = { id, t: 0 }; sfx('cancel', { vol: .6 }); return 0; }
  const op0 = PRG_open(h);
  path.forEach((p, i) => { h.tree.push(p); PRG_V.session.add(p); PRG_V.fx.push({ id: p, t: -i * .07, dur: .6 }); });
  h.pts.passive -= path.length; computeStats(h); PRG_V.dirty = true;
  const n = PRG_T.N[id]; sfx(n.type === 'keystone' ? 'secret' : n.type === 'notable' ? 'powerup' : 'chime', { vol: n.type === 'small' ? .35 : .55 });
  for (const p of path) { const q = PRG_T.N[p]; if (q.type !== 'small') PRG_V.banner = { text: (q.type === 'keystone' ? 'KEYSTONE  ' : '') + q.name.toUpperCase(), sub: q.type === 'keystone' ? PRG_KS[q.ks].rules[0] : Object.keys(q.stats).map(k => statText(k, q.stats[k])).join('  •  '), color: (PRG_RG[q.region] || PRG_CORE).color, t: 0 }; }
  // the last star of the core (or of a deep ring) wakes the next ring: the view pulls back, a comet runs round it
  // and lights its stars
  const op1 = PRG_open(h);
  if (op1 > op0) { const D = PRG_deepRing(op1), V = PRG_V; V.reveal = { k: op1, t: 0 }; V.go = { x: 0, y: 0 }; V.anchor = null; V.zt = PRG_zMin(); PRG_V.banner = { text: op1 === 1 ? 'THE DEEP OPENS' : 'DEEP RING ' + PRG_roman(op1), sub: D.cnt + ' deep stars wake past the edge of the sky', color: D.tint, t: 0 }; sfx('secret', { vol: .7 }); sfx('warp', { vol: .4 }); }
  return path.length;
}
function PRG_click(h, id) { if (!id || id === 'start') return; if (PRG_has(h, id)) { sfx('select', { vol: .3 }); return; } PRG_buy(h, id); }
/** the widest the view may zoom out: the whole sky (with every awake ring) fits the screen */
const PRG_zMin = () => { const op = ED.hero ? PRG_open(ED.hero) : 0; return Math.min(.34, Math.max(.12, ((PRG_V.H || 240) - 40) / 2 / PRG_span(op))); };
function PRG_zoomBy(k, sx, sy) { const V = PRG_V; V.zt = clamp(V.zt * k, PRG_zMin(), 2.4); V.anchor = { sx, sy, tx: V.cx + (sx - V.ox) / V.z, ty: V.cy + (sy - V.oy) / V.z }; V.go = null; }
/** the star under a screen point (from the last drawn positions; stars of rings still asleep are not drawn) */
function PRG_pick(mx, my) { let best = null, bd = 1e9; const z = PRG_V.z; for (const n of PRG_T.list) { if (n.sx === undefined || !n.vis) continue; const rr = PRG_rad(n, z) + 3, d = (n.sx - mx) ** 2 + (n.sy - my) ** 2; if (d < rr * rr && d < bd) { bd = d; best = n; } } return best ? best.id : null; }
const PRG_inR = (m, r0) => m.x >= r0[0] && m.y >= r0[1] && m.x < r0[0] + r0[2] && m.y < r0[1] + r0[3];

function PRG_treeDraw(g, x0, y0, W, H) {
  const h = ED.hero; if (!h) return;
  PRG_sanitize(h);
  const V = PRG_V, T = PRG_T, t = game.real, set = PRG_set(h), op = PRG_open(h), pts = h.pts.passive || 0, m = UI.mouse, open = E.ease.outQuad(clamp(V.openT / .35, 0, 1));
  const z = V.z * (.86 + .14 * open); V.W = W; V.H = H; V.ox = x0 + Math.round(W / 2); V.oy = y0 + Math.round(H / 2) + 3;
  const zv = V.z; V.z = z; PRG_space(g, x0, y0, W, H, V, t, op); V.z = zv;
  // a ring waking: its stars light one after another behind a comet that runs once round it
  const rv = V.reveal && V.reveal.k <= op && V.reveal.t < 1.6 ? V.reveal : null, rvD = rv && PRG_DEEP[rv.k], rvU = rv ? clamp(rv.t / 1.1, 0, 1) : 1;
  for (const n of T.list) { n.vis = n.ring <= op && !(rv && n.ring === rv.k && n.j / rvD.cnt > rvU); n.sx = Math.round(V.ox + (n.x - V.cx) * z); n.sy = Math.round(V.oy + (n.y - V.cy) * z); }
  // chrome rects (the tree gives way to them for hover and clicks)
  const mini = Math.min(64, Math.round(H * .27)), miniR = [x0 + W - mini - 5, y0 + H - mini - 14, mini, mini], sumR = [x0 + 4, y0 + 22, Math.min(178, Math.round(W * .45)), H - 38];
  const overChrome = m.y < y0 + 18 || m.y >= y0 + H - 11 || PRG_inR(m, miniR) || (V.sum && PRG_inR(m, sumR)) || V.labels.some(l => PRG_inR(m, l.r));
  // hover: the star under the cursor, or under the reticle when steering with keys
  let hov = null;
  if (UI.keyNav) { let bd = 24 * 24; for (const n of T.list) { if (!n.vis) continue; const d = (n.sx - V.ox) ** 2 + (n.sy - V.oy) ** 2; if (d < bd) { bd = d; hov = n; } } }
  else if (!overChrome && !(V.drag && V.drag.moved > 3)) { let bd = 1e9; for (const n of T.list) { if (!n.vis) continue; const rr = PRG_rad(n, z) + 3, d = (n.sx - m.x) ** 2 + (n.sy - m.y) ** 2; if (d < rr * rr && d < bd) { bd = d; hov = n; } } }
  V.hover = hov ? hov.id : null;
  const key = hov && !set.has(hov.id) ? hov.id + ':' + h.tree.length : '';
  if (key !== V.pathKey) { V.pathKey = key; V.path = key ? PRG_path(h, hov.id) : null; }
  const road = V.path && V.path.length ? new Set(V.path) : null, pulse = .5 + .5 * Math.sin(t * 5);
  // roads
  const wz = z >= 1.5 ? 2 : 1, dash = Math.floor(t * 14), lit = [];
  for (const e of T.E) {
    const A = e.a, B = e.b; if (!A.vis || !B.vis) continue;
    if ((A.sx < x0 - 2 && B.sx < x0 - 2) || (A.sx > x0 + W + 2 && B.sx > x0 + W + 2) || (A.sy < y0 - 2 && B.sy < y0 - 2) || (A.sy > y0 + H + 2 && B.sy > y0 + H + 2)) continue;
    const ia = A.id === 'start' || set.has(A.id), ib = B.id === 'start' || set.has(B.id), C = PRG_tones(e.far.region);
    if (ia && ib) lit.push(e);
    else if (road && (road.has(A.id) || road.has(B.id)) && (road.has(A.id) || ia) && (road.has(B.id) || ib)) {
      px.blend(g, .25, 'add', () => px.line(g, A.sx, A.sy, B.sx, B.sy, PRG_GOLDT.base, 3));
      const dx = B.sx - A.sx, dy = B.sy - A.sy, n = Math.max(1, Math.round(Math.hypot(dx, dy)));
      for (let k = 0; k <= n; k++) if (((k + dash) & 3) < 2) px.dot(g, A.sx + dx * k / n, A.sy + dy * k / n, pts >= V.path.length ? '#ffe9a0' : '#ff8a7a');
    } else if (ia || ib) px.line(g, A.sx, A.sy, B.sx, B.sy, E.mix(C.sh, '#1e1a30', .35), wz);
    else px.line(g, A.sx, A.sy, B.sx, B.sy, A.ring || B.ring ? '#221c3a' : '#241e38', wz);
  }
  // lit roads glow, and a mote of light runs along each, away from the Ember (drawn in three passes, one blend each:
  // a deep sky holds hundreds of them)
  if (lit.length) {
    px.blend(g, .3, 'add', () => { for (const e of lit) px.line(g, e.a.sx, e.a.sy, e.b.sx, e.b.sy, PRG_tones(e.far.region).base, wz + 2); });
    for (const e of lit) px.line(g, e.a.sx, e.a.sy, e.b.sx, e.b.sy, PRG_tones(e.far.region).lt, wz);
    const mote = e => { const u = (t * .5 + e.h) % 1; return [e.near.sx + (e.far.sx - e.near.sx) * u, e.near.sy + (e.far.sy - e.near.sy) * u]; };
    px.blend(g, .7, 'add', () => { for (const e of lit) { const [fx, fy] = mote(e); px.disc(g, fx, fy, 1.4, PRG_tones(e.far.region).hi); } });
    for (const e of lit) { const [fx, fy] = mote(e); px.dot(g, fx, fy, '#ffffff'); }
  }
  // the halos of the lit small stars, in one pass (a single disc each when zoomed far out, where three can't be told apart)
  const onScr = (n, r) => n.vis && n.sx >= x0 - r - 8 && n.sx <= x0 + W + r + 8 && n.sy >= y0 - r - 8 && n.sy <= y0 + H + r + 8;
  px.blend(g, .28, 'add', () => { for (const n of T.order) { if (n.type !== 'small' || !set.has(n.id)) continue; const r = PRG_rad(n, z); if (!onScr(n, r)) continue; const R0 = r * 2.4, c = PRG_tones(n.region).base; if (z < .6) px.disc(g, n.sx, n.sy, R0 * .75, c); else for (let i = 0; i < 3; i++) px.disc(g, n.sx, n.sy, R0 * (1 - i / 3 * .8), c); } });
  // stars
  for (const n of T.order) {
    if (!n.vis) continue;
    const r = PRG_rad(n, z); if (n.sx < x0 - r - 8 || n.sx > x0 + W + r + 8 || n.sy < y0 - r - 8 || n.sy > y0 + H + r + 8) continue;
    const st = n.id === 'start' || set.has(n.id) ? 2 : PRG_adj(set, n) ? 1 : 0, C = PRG_tones(n.region), D = PRG_dim(n.region), onRoad = !!(road && road.has(n.id));
    if (n.type === 'start') PRG_drawStart(g, n.sx, n.sy, r, t);
    else if (n.type === 'keystone') PRG_drawKeystone(g, n, n.sx, n.sy, r, st, C, D, t, onRoad);
    else if (n.type === 'notable') PRG_drawNotable(g, n.sx, n.sy, r, st, C, D, t, onRoad);
    else PRG_drawSmall(g, n.sx, n.sy, r, st, C, D, pulse, onRoad, pts, true);
    if (hov === n) { PRG_circle(g, n.sx, n.sy, r + (n.type === 'notable' ? 5 : 4), pulse > .5 ? '#ffffff' : C.hi); }
  }
  if (rv && rvU < 1) {   // the comet: a hot head on the star it is lighting, a ring of light rolling out at the ring's radius
    const hd = T.N['dp' + rv.k + '_' + Math.min(rvD.cnt - 1, Math.floor(rvU * rvD.cnt))], C = E.tones(rvD.tint);
    if (hd) { PRG_glow(g, hd.sx, hd.sy, 7 + 5 * z, C.lt, .55); px.disc(g, hd.sx, hd.sy, 2, '#ffffff'); for (let i = 0; i < 5; i++) { const a = t * 9 + i * TAU / 5, d = 4 + (i % 2) * 3; px.dot(g, hd.sx + Math.cos(a) * d, hd.sy + Math.sin(a) * d, i % 2 ? C.hi : '#ffffff'); } }
    const [ox0, oy0] = [V.ox - V.cx * z, V.oy - V.cy * z]; px.blend(g, .5 * (1 - rvU), 'add', () => PRG_circle(g, ox0, oy0, (rvD.R - 30 + rvU * 36) * z, C.hi));
  }
  // bursts where stars were just lit (a ring and sparks), a red shake where one was refused
  for (const f of V.fx) {
    const n = T.N[f.id]; if (!n || f.t < 0) continue; const u = f.t / f.dur, r = PRG_rad(n, z), C = PRG_tones(n.region);
    if (f.undo) { PRG_circle(g, n.sx, n.sy, r + 2 + (1 - u) * 8 * z, '#6a6488'); continue; }
    const big = n.type === 'keystone' ? 2.2 : n.type === 'notable' ? 1.4 : 1, ns = n.type === 'small' ? 8 : 14;
    px.blend(g, 1 - u, 'add', () => { PRG_circle(g, n.sx, n.sy, r + 2 + u * 16 * z * big, C.hi); PRG_circle(g, n.sx, n.sy, r + 1 + u * 10 * z * big, C.lt); if (big > 2) PRG_circle(g, n.sx, n.sy, r + u * 30 * z, '#ffffff'); });
    for (let i = 0; i < ns; i++) { const a = i / ns * TAU + n.x, d = r + 3 + E.ease.outQuad(u) * 18 * z * big; px.dot(g, n.sx + Math.cos(a) * d, n.sy + Math.sin(a) * d, u < .5 ? '#ffffff' : C.hi); }
    if (u < .25) PRG_glow(g, n.sx, n.sy, r * 3, C.hi, .5 * (1 - u * 4));
  }
  if (V.deny && V.deny.t < .4) { const n = T.N[V.deny.id]; if (n) PRG_circle(g, n.sx + Math.round(Math.sin(V.deny.t * 60) * 2), n.sy, PRG_rad(n, z) + 4, '#ff5a5a'); }
  // the region names, over the sky and never over a star
  V.labels = PRG_labels(g, x0, y0, W, H, z, op, [miniR].concat(V.sum ? [sumR] : []));
  // the opening fade, and the reticle when steering with keys
  if (open < 1) px.blend(g, 1 - open, 'normal', () => px.rect(g, x0, y0, W, H, '#040308'));
  if (UI.keyNav) { const c = pulse > .5 ? GOLD : '#c8a040'; PRG_circle(g, V.ox, V.oy, 12, '#5a4a70'); if (hov) px.blend(g, .6, 'normal', () => px.line(g, V.ox, V.oy, hov.sx, hov.sy, c)); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) px.line(g, V.ox + dx * 9, V.oy + dy * 9, V.ox + dx * 15, V.oy + dy * 15, c); }
  if (V.banner && V.banner.t < 2.4) {   // the name of a notable or keystone just lit, under the top bar (right of the totals when they are open)
    const b = V.banner, a = clamp(Math.min(b.t * 6, (2.4 - b.t) * 2), 0, 1), C = E.tones(b.color), cy = y0 + 26 + Math.round((1 - clamp(b.t * 5, 0, 1)) * -6);
    const bl = V.sum ? sumR[0] + sumR[2] + 2 : x0, bw = x0 + W - bl, bc = Math.round(bl + bw / 2), subs = E.font.wrap(b.sub, bw - 12, { font: 'tiny' }).slice(0, 2);
    px.blend(g, a * .8, 'normal', () => px.rect(g, bl, cy - 4, bw, 19 + subs.length * 7, '#06040c'));
    px.blend(g, a, 'normal', () => { E.font.title(g, b.text, bc, cy, { scale: 1, colors: [C.hi, C.lt, C.base], depth: 1, depthColor: C.deep, align: 'center' }); subs.forEach((s, i) => PRG_txt(g, s, bc, cy + 11 + i * 7, '#d8d0ec', { font: 'tiny', align: 'center' })); });
  }
  // the tree itself: drag to pan, click to buy (on release, so a drag never buys), right click to undo. It registers before
  // the chrome, so the bars, the overview and the totals (drawn over it, topmost) take their own clicks
  hot(x0, y0 + 18, W, H - 29, { drag: (mx, my) => {
    if (!V.drag) { V.drag = { x: mx, y: my, cx: V.cx, cy: V.cy, moved: 0, node: UI.keyNav ? V.hover : PRG_pick(mx, my) }; return; }
    const d = V.drag; d.moved = Math.max(d.moved, Math.abs(mx - d.x) + Math.abs(my - d.y));
    if (d.moved > 3) { V.cx = d.cx - (mx - d.x) / V.z; V.cy = d.cy - (my - d.y) / V.z; V.anchor = null; V.go = null; }
  }, rclick: () => { const id = PRG_pick(UI.mouse.x, UI.mouse.y) || V.hover; if (id) PRG_undo(h, id); }, tip: hov && !UI.keyNav ? () => PRG_treeTip(h, hov) : undefined, tipBorder: hov ? (hov.type === 'keystone' ? '#ff9a4a' : hov.type === 'notable' ? GOLD : undefined) : undefined });
  for (const l of V.labels) hot(l.r[0], l.r[1], l.r[2], l.r[3], { click: () => { V.go = { x: l.go[0], y: l.go[1] }; V.anchor = null; sfx('select', { vol: .35 }); }, tip: [{ t: l.name, c: l.color }, { t: cap(l.about), c: '#c8c0d8' }, { t: 'Click to fly to its keystone', c: '#9a90b0' }] });
  PRG_treeChrome(g, x0, y0, W, H, h, set, pts, miniR, sumR, t, op);
  if (hov && UI.keyNav) tipBox(g, PRG_treeTip(h, hov), V.ox + 8, V.oy + 8, { border: '#8a7aa8' });
}
/* the region names: each just past the rim on its own axis (big, with what the region is about, when zoomed in). One
   whose place is off screen becomes a small marker on the edge, an arrow pointing the way, slid along the edge to the
   nearest spot with no star under it. A name never covers a star: with no clear spot it waits. Returns the rects */
function PRG_labels(g, x0, y0, W, H, z, op, avoid) {
  const V = PRG_V, out = [], rim = op ? PRG_ringR(op) + 18 : 262, Ox = V.ox - V.cx * z, Oy = V.oy - V.cy * z, L = x0 + 2, R = x0 + W - 2, Tp = y0 + 21, B = y0 + H - 13;
  const near = PRG_T.list.filter(n => n.vis && n.sx > x0 - 12 && n.sx < x0 + W + 12 && n.sy > y0 - 12 && n.sy < y0 + H + 12);
  const clear = r => { for (const n of near) { const q = PRG_rad(n, z) + 2; if (n.sx + q > r[0] && n.sx - q < r[0] + r[2] && n.sy + q > r[1] && n.sy - q < r[1] + r[3]) return false; }
    for (const q of avoid.concat(out.map(o => o.r))) if (r[0] < q[0] + q[2] && r[0] + r[2] > q[0] && r[1] < q[1] + q[3] && r[1] + r[3] > q[1]) return false; return true; };
  const inside = r => r[0] >= L && r[1] >= Tp && r[0] + r[2] <= R && r[1] + r[3] <= B;
  for (const G of PRG_REGIONS) {
    const a = G.ang * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), C = E.tones(G.color), ks = PRG_T.N['ks_' + G.ks];
    const lay = (big, about, arrow) => { const tw = E.font.width(G.name, { scale: big ? 2 : 1 }), th = big ? 15 : 8, ab = G.about.toUpperCase(), aw = about ? E.font.width(ab, { font: 'tiny' }) : 0; return { big, about, arrow, tw, th, ab, w: Math.max(tw + (arrow ? 9 : 0), aw) + 8, h: th + (about ? 8 : 0) + 5 }; };
    const box = (o, cx, cy) => [Math.round(cx - o.w / 2), Math.round(cy - o.h / 2), o.w, o.h];
    let pick = null;
    // its own place: the box's near edge just past the rim, on the axis
    for (const o of z > .75 ? [lay(true, true), lay(true, false), lay(false, false)] : [lay(false, false)]) { const d = rim * z + 4 + Math.abs(c) * o.w / 2 + Math.abs(s) * o.h / 2, r = box(o, Ox + c * d, Oy + s * d); if (inside(r) && clear(r)) { pick = { o, r }; break; } }
    if (!pick) {   // off screen (or its place taken by the overview): a small name slid along the edge to a clear spot,
      // with an arrow the way the region lies from the middle of the view when it is off screen
      const d = rim * z, ex = Ox + c * d, ey = Oy + s * d, o0 = lay(false, false, true), cx = clamp(ex, L + o0.w / 2, R - o0.w / 2), cy = clamp(ey, Tp + o0.h / 2, B - o0.h / 2), side = cx !== ex, topb = cy !== ey;
      const o = side || topb ? o0 : lay(false, false, false), vx = ex - V.ox, vy = ey - V.oy; o.dir = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'r' : 'l') : vy > 0 ? 'd' : 'u';
      for (let i = 0; i < 44 && !pick; i++) {
        const k = (i % 2 ? -1 : 1) * Math.ceil(i / 2) * 7;
        for (const [px0, py0] of (side || !topb ? [[cx, cy + k]] : []).concat(topb || !side ? [[cx + k, cy]] : [])) { const r = box(o, clamp(px0, L + o.w / 2, R - o.w / 2), clamp(py0, Tp + o.h / 2, B - o.h / 2)); if (clear(r)) { pick = { o, r }; break; } }
      }
    }
    if (!pick) continue;
    const { o, r } = pick, up = s < -.2, cx = r[0] + r[2] / 2;
    px.blend(g, .7, 'normal', () => px.rect(g, r[0], r[1], r[2], r[3], '#06040c'));
    px.blend(g, .8, 'normal', () => { px.rect(g, r[0] + 1, r[1], r[2] - 2, 1, C.deep); px.rect(g, r[0] + 1, r[1] + r[3] - 1, r[2] - 2, 1, C.deep); px.rect(g, r[0], r[1] + 1, 1, r[3] - 2, C.deep); px.rect(g, r[0] + r[2] - 1, r[1] + 1, 1, r[3] - 2, C.deep); });
    const ty = r[1] + 3 + (o.about && up ? 8 : 0), tx = cx + (o.arrow ? 5 : 0);
    E.font.title(g, G.name, tx, ty, { scale: o.big ? 2 : 1, colors: [C.hi, C.lt, C.base], depth: 1, depthColor: C.deep, align: 'center' });
    if (o.about) PRG_txt(g, o.ab, cx, up ? r[1] + 3 : ty + o.th + 1, C.sh, { font: 'tiny', align: 'center' });
    if (o.arrow) {   // a crisp 5 px pixel arrow (up, down, left or right), lit on its point
      const ax = Math.round(tx - o.tw / 2 - 6), ay = Math.round(r[1] + r[3] / 2) - 1, dir = o.dir;
      for (let q = 0; q < 3; q++) { const w0 = 5 - q * 2, lc = q === 2 ? C.hi : q ? C.lt : C.base; if (dir === 'u' || dir === 'd') px.rect(g, ax - 2 + q, ay + (dir === 'u' ? 1 - q : q - 1), w0, 1, lc); else px.rect(g, ax + (dir === 'l' ? 1 - q : q - 1), ay - 2 + q, 1, w0, lc); }
    }
    out.push({ r, name: G.name, about: G.about, color: G.color, go: ks ? [ks.x, ks.y] : [c * 234, s * 234] });
  }
  return out;
}
function PRG_treeChrome(g, x0, y0, W, H, h, set, pts, miniR, sumR, t, op) {
  const V = PRG_V, span = PRG_span(op);
  // frame: gold corner brackets over the whole screen
  const C = PRG_GOLDT; for (const [cx, cy, sx, sy] of [[x0 + 1, y0 + 19, 1, 1], [x0 + W - 2, y0 + 19, -1, 1], [x0 + 1, y0 + H - 12, 1, -1], [x0 + W - 2, y0 + H - 12, -1, -1]]) { px.rect(g, Math.min(cx, cx + sx * 9), cy, 10, 1, C.sh); px.rect(g, cx, Math.min(cy, cy + sy * 9), 1, 10, C.sh); px.dot(g, cx, cy, C.hi); }
  // the top bar: title, points, count, buttons
  px.blend(g, .85, 'normal', () => px.rect(g, x0, y0, W, 18, '#06040c')); px.rect(g, x0, y0 + 18, W, 1, '#3a3050'); px.rect(g, x0, y0 + 17, W, 1, '#17122a');
  E.font.title(g, W > 400 ? 'PASSIVE CONSTELLATION' : 'PASSIVES', x0 + 6, y0 + 5, { scale: 1, colors: ['#fff6c8', '#ffd36a', '#e07a2a'], depth: 1 });
  // (the count on the right goes first: the points label takes its short wording when the two would touch)
  let cnt = set.size + ' / ' + PRG_T.coreN, cc = '#9a90b0', cnt2 = cnt;
  if (op) { const D = PRG_DEEP[op], lit = D.ids.reduce((a, id) => a + (set.has(id) ? 1 : 0), 0); cnt = 'DEEP ' + PRG_roman(op) + '  ' + lit + ' / ' + D.cnt; cnt2 = lit + ' / ' + D.cnt; cc = E.mix(D.tint, '#9a90b0', .4); }
  const blink = pts > 0 && Math.floor(t * 2.5) % 2, cx = x0 + Math.round(W * (W > 400 ? .53 : .45)), cr = x0 + W - 64 - 6;
  const fitL = l => cx - (E.font.width(l) + 12) / 2 + 10 + E.font.width(l) + 6 <= cr - E.font.width(cnt, { font: 'tiny' }) ? l : null;
  const label = pts ? fitL(pts + ' POINT' + (pts > 1 ? 'S' : '') + ' TO SPEND') || pts + ' TO SPEND' : fitL('NO POINTS  •  ONE PER LEVEL') || 'NO POINTS', lw = E.font.width(label) + 12;
  if (cx - lw / 2 + 10 + E.font.width(label) + 6 > cr - E.font.width(cnt, { font: 'tiny' })) cnt = cnt2;
  PRG_txt(g, '★', cx - lw / 2, y0 + 5, pts ? (blink ? '#fff6c8' : GOLD) : '#4a4466'); PRG_txt(g, label, cx - lw / 2 + 10, y0 + 5, pts ? (blink ? '#fff6c8' : GOLD) : '#6a6488');
  const bx = x0 + W - 14; button(g, bx, y0 + 3, 11, 11, 'x', () => UI.close('tree'), { color: '#4a2a3a' });
  button(g, bx - 46, y0 + 3, 43, 11, 'TOTALS', () => { V.sum = !V.sum; }, { active: V.sum, tip: [{ t: 'Totals (Tab)', c: GOLD }, { t: 'Everything the lit stars give you, added up.', c: '#c8c0d8' }] });
  PRG_txt(g, cnt, bx - 50, y0 + 6, cc, { font: 'tiny', align: 'right' });   // how much is lit: the core, then the outermost awake ring
  // the bottom bar: the controls
  px.blend(g, .85, 'normal', () => px.rect(g, x0, y0 + H - 11, W, 11, '#06040c')); px.rect(g, x0, y0 + H - 12, W, 1, '#3a3050');
  const hint = W > 470 ? 'DRAG OR WASD PAN  •  WHEEL OR Q E ZOOM  •  CLICK ALLOCATE  •  RIGHT CLICK UNDO  •  TAB TOTALS  •  R CENTRE  •  P CLOSE' : 'DRAG PAN • WHEEL/Q E ZOOM • CLICK TAKE • RCLICK UNDO • TAB TOTALS • R CENTRE';
  PRG_txt(g, hint, x0 + W / 2, y0 + H - 8, '#8a80a8', { font: 'tiny', align: 'center' });
  // the overview: every star, the lit ones in colour, the view as a frame; drag in it to fly there
  const [mx, my, ms] = miniR, k = (ms - 6) / (2 * span), mcx = mx + ms / 2, mcy = my + ms / 2;
  px.rect(g, mx, my, ms, ms, '#06050c'); E.ui.box(g, mx, my, ms, ms, { bg: ['#0e0b1c', '#06050c'], border: '#4a3a66', shadow: false });
  for (const e of PRG_T.E) if (e.a.vis && e.b.vis && (e.a.id === 'start' || set.has(e.a.id)) && (e.b.id === 'start' || set.has(e.b.id))) px.line(g, mcx + e.a.x * k, mcy + e.a.y * k, mcx + e.b.x * k, mcy + e.b.y * k, PRG_tones(e.far.region).sh);
  for (const n of PRG_T.list) { if (!n.vis) continue; const on = n.id === 'start' || set.has(n.id), c = on ? PRG_tones(n.region).lt : n.type === 'small' ? '#2a2442' : '#4a4264', X = mcx + n.x * k, Y = mcy + n.y * k; if (n.type === 'keystone' || n.type === 'start') px.rect(g, X - 1, Y - 1, 2, 2, on ? PRG_tones(n.region).hi : c); else px.dot(g, X, Y, c); }
  const vw = V.W / V.z * k, vh = (V.H - 30) / V.z * k, vx = clamp(mcx + V.cx * k - vw / 2, mx + 1, mx + ms - 2), vy = clamp(mcy + V.cy * k - vh / 2, my + 1, my + ms - 2), vx1 = clamp(mcx + V.cx * k + vw / 2, mx + 1, mx + ms - 2), vy1 = clamp(mcy + V.cy * k + vh / 2, my + 1, my + ms - 2);
  px.rect(g, vx, vy, Math.max(1, vx1 - vx), 1, GOLD); px.rect(g, vx, vy1, Math.max(1, vx1 - vx), 1, GOLD); px.rect(g, vx, vy, 1, Math.max(1, vy1 - vy), GOLD); px.rect(g, vx1, vy, 1, Math.max(1, vy1 - vy + 1), GOLD);
  hot(mx, my, ms, ms, { drag: (qx, qy) => { V.cx = clamp((qx - mcx) / k, -span, span); V.cy = clamp((qy - mcy) / k, -span, span); V.anchor = null; V.go = null; }, tip: [{ t: 'Overview', c: GOLD }, { t: 'Click or drag here to fly across the constellation.', c: '#c8c0d8' }] });
  if (V.sum) PRG_drawTotals(g, sumR, h);
}
function PRG_drawTotals(g, [bx, by, bw, bh], h) {
  const V = PRG_V, tot = PRG_totals(h), lines = [];
  px.rect(g, bx, by, bw, bh, '#0a0814'); E.ui.box(g, bx, by, bw, bh, { bg: ['#161028', '#0a0814'], border: '#6a5a88' });
  PRG_txt(g, 'TOTALS', bx + bw / 2, by + 4, GOLD, { align: 'center' }); px.rect(g, bx + 6, by + 13, bw - 12, 1, '#3a3050');
  for (const id of h.tree) { const n = PRG_T.N[id]; if (n && n.type === 'keystone') { lines.push({ t: n.name.toUpperCase(), c: '#ff9a4a' }); for (const l of PRG_KS[n.ks].rules) for (const w of E.font.wrap(l, bw - 14, { font: 'tiny' })) lines.push({ t: w, c: '#c8a888' }); } }
  for (const k in STATS) if (tot[k]) for (const w of E.font.wrap(statText(k, +tot[k].toFixed(2)), bw - 14, { font: 'tiny' })) lines.push({ t: w, c: tot[k] < 0 ? '#ff8a8a' : '#8ab4ff' });
  for (const k in tot) if (!STATS[k] && tot[k]) lines.push({ t: statText(k, tot[k]), c: '#8ab4ff' });
  if (!lines.length) lines.push({ t: 'NOTHING YET: LIGHT A STAR', c: '#6a6488' });
  const rows = Math.floor((bh - 20) / 7); V.sumScroll = clamp(V.sumScroll, 0, Math.max(0, lines.length - rows));
  lines.slice(V.sumScroll, V.sumScroll + rows).forEach((l, i) => PRG_txt(g, l.t, bx + 7, by + 17 + i * 7, l.c, { font: 'tiny' }));
  if (lines.length > rows) { const th = Math.max(6, (bh - 22) * rows / lines.length), ty = by + 16 + (bh - 22 - th) * V.sumScroll / Math.max(1, lines.length - rows); px.rect(g, bx + bw - 4, by + 16, 1, bh - 22, '#2a2440'); px.rect(g, bx + bw - 4, ty, 1, th, '#8a7aa8'); }
  hot(bx, by, bw, bh, {});
}
function PRG_treeUpdate(dt) {
  const V = PRG_V, h = ED.hero, inp = game.input; if (!h) return;
  V.openT += dt; if (V.deny) V.deny.t += dt; if (V.banner) V.banner.t += dt; if (V.reveal) V.reveal.t += dt;
  for (let i = V.fx.length - 1; i >= 0; i--) if ((V.fx[i].t += dt) > V.fx[i].dur) V.fx.splice(i, 1);
  if (V.drag && !UI.mouse.down) { const d = V.drag; V.drag = null; if (d.moved <= 3 && d.node) PRG_click(h, d.node); }
  const mx = (inp.down('menuRight') ? 1 : 0) - (inp.down('menuLeft') ? 1 : 0), my = (inp.down('menuDown') ? 1 : 0) - (inp.down('menuUp') ? 1 : 0);
  if (mx || my) { const sp = 250 * dt / V.z; V.cx += mx * sp; V.cy += my * sp; UI.keyNav = true; V.anchor = null; V.go = null; }
  if (inp.pressed('map')) { V.sum = !V.sum; sfx('select', { vol: .4 }); }
  if (UI.keyNav && inp.pressed('confirm') && V.hover) PRG_click(h, V.hover);
  if (inp.pressed('cancel') && V.hover) PRG_undo(h, V.hover);   // Backspace (Esc has already closed the panel)
  if (V.z !== V.zt) { V.z += (V.zt - V.z) * Math.min(1, dt * 16); if (Math.abs(V.z - V.zt) < .002) V.z = V.zt; if (V.anchor) { V.cx = V.anchor.tx - (V.anchor.sx - V.ox) / V.z; V.cy = V.anchor.ty - (V.anchor.sy - V.oy) / V.z; } }
  if (V.go) { V.cx += (V.go.x - V.cx) * Math.min(1, dt * 9); V.cy += (V.go.y - V.cy) * Math.min(1, dt * 9); if (Math.hypot(V.go.x - V.cx, V.go.y - V.cy) < .5) V.go = null; }
  const S = PRG_span(PRG_open(h)); V.cx = clamp(V.cx, -S, S); V.cy = clamp(V.cy, -S, S);
  if (V.zt < PRG_zMin()) V.zt = PRG_zMin();
}
/* keys the input map does not carry (they only act while the constellation is the top panel; + and - stop there
   instead of zooming the camera behind it) */
addEventListener('keydown', e => {
  if (e.repeat || !UI.stack.length || UI.stack[UI.stack.length - 1].id !== 'tree') return;
  const V = PRG_V, c = e.code;
  if (c === 'Equal' || c === 'NumpadAdd' || c === 'KeyE' || c === 'PageUp') { PRG_zoomBy(1.25, V.ox, V.oy); e.stopImmediatePropagation(); }
  else if (c === 'Minus' || c === 'NumpadSubtract' || c === 'KeyQ' || c === 'PageDown') { PRG_zoomBy(.8, V.ox, V.oy); e.stopImmediatePropagation(); }
  else if (c === 'KeyR' || c === 'Home' || c === 'Digit0') { V.go = { x: 0, y: 0 }; V.zt = 1; V.anchor = { sx: V.ox, sy: V.oy, tx: 0, ty: 0 }; e.stopImmediatePropagation(); }
});

/* =============================================================================
 * THE SKILLS PANEL (K): the six slots on top; every registered skill on the left, grouped by kind; the chosen
 * skill's page on the right (rank up, runes, assign). Click a slot (or open with { slot }), then a skill, to put
 * it there. Keys: up / down pick, left / right choose the rune, Enter ranks up, 1-4 assign, Backspace disarms.
 * ============================================================================= */
const PRG_KINDS = { basic: { label: 'BASIC', note: 'free, and every hit makes Ember', color: '#d8c8a8' }, core: { label: 'CORE', note: 'your main damage, spends Ember', color: '#ff9a4a' }, mobility: { label: 'MOBILITY', note: 'move, leap and reposition', color: '#8fe3ff' }, ultimate: { label: 'ULTIMATE', note: 'long cooldowns, huge effects', color: '#d8a0ff' } };
const PRG_KIND_ORDER = ['basic', 'core', 'mobility', 'ultimate'];
const PRG_K = { sel: null, armed: null, scroll: 0, follow: false, rows: [], flash: [0, 0, 0, 0, 0, 0], fx: [], pulse: null, runeShow: null, dirty: false, hud: false };
/** the list rows: a header per kind, then its skills (by unlock level, then name). Works with any registered set */
function PRG_skillRows() {
  const groups = {}; for (const id in REG.skills) { if (!skillAvailable(ED.hero, REG.skills[id])) continue; const k = REG.skills[id].kind || 'core'; (groups[k] || (groups[k] = [])).push(id); }
  const kinds = PRG_KIND_ORDER.filter(k => groups[k]).concat(Object.keys(groups).filter(k => !PRG_KIND_ORDER.includes(k)).sort()), rows = [];
  for (const k of kinds) { rows.push({ head: k }); groups[k].sort((a, b) => (REG.skills[a].unlock || 1) - (REG.skills[b].unlock || 1) || REG.skills[a].name.localeCompare(REG.skills[b].name)); for (const id of groups[k]) rows.push({ id }); }
  return rows;
}
const PRG_base = (h, id) => (h.skills[id] && h.skills[id].rank) || 0;
function PRG_canRank(h, id) {
  if (!skillAvailable(h, REG.skills[id])) return { ok: false, why: 'Codex signature skill' };
  const S = REG.skills[id], r = PRG_base(h, id), lv = S.unlock || 1;
  if (!r && h.level < lv) return { ok: false, why: 'Unlocks at level ' + lv };
  if ((h.pts.skill || 0) < 1) return { ok: false, why: 'No skill points (one per level)', mastery: r >= 5 };
  if (r >= 5) return { ok: true, why: 'Mastery ' + (PRG_mast(h, id) + 1) + ': 1 point', mastery: true };
  return { ok: true, why: r ? 'Rank up: 1 point' : 'Learn: 1 point' };
}
function PRG_rankUp(h, id) {
  const c = PRG_canRank(h, id); if (!c.ok) { sfx('cancel', { vol: .5 }); return false; }
  const k = h.skills[id] || (h.skills[id] = { rank: 0 }), t0 = PRG_tier(h, id); h.pts.skill--; PRG_K.dirty = true;
  if (c.mastery) k.mastery = (k.mastery || 0) + 1; else k.rank++;
  if (k.rank === 1 && !h.slots.includes(id)) { const free = [2, 3, 4, 5, 1, 0].find(i => !h.slots[i]); if (free !== undefined) { h.slots[free] = id; PRG_K.flash[free] = .6; } }
  const t1 = PRG_tier(h, id), deeper = c.mastery && t1 > t0 && t1 > 1;
  computeStats(h); sfx(deeper ? 'secret' : k.rank === 1 && !c.mastery ? 'powerup' : c.mastery ? 'chime' : 'coin', { vol: .6 }); PRG_K.pulse = { id, t: 0, tier: deeper };
  if (deeper) notify(REG.skills[id].name.toUpperCase() + ': RUNE TIER ' + PRG_roman(t1), '#ffb070', 2.5);
  // sparks from the icon: gold for a rank, starlight for a mastery, and a bigger burst when a rune deepens
  const at = PRG_K.iconAt, nS = deeper ? 30 : 16; if (at && PRG_K.sel === id) for (let i = 0; i < nS; i++) { const a = i / nS * TAU + Math.random() * .3, sp = (deeper ? 24 : 16) + Math.random() * 22; PRG_K.fx.push({ x: at[0], y: at[1], vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: -Math.random() * .05, dur: .45 + Math.random() * .3, c: deeper ? '#ffb070' : c.mastery ? '#c8b0ff' : k.rank === 1 ? '#ffe070' : GOLD }); }
  return true;
}
function PRG_setRune(h, id, rune) {
  const S = REG.skills[id], k = h.skills[id]; if (!S || !k || skillRank(h, id) < 2) { sfx('cancel', { vol: .5 }); return false; }
  k.rune = k.rune === rune ? null : rune; if (!k.rune) delete k.rune; PRG_K.dirty = true; sfx(k.rune ? 'chime' : 'select', { vol: .5 }); PRG_K.pulse = { id, t: 0, rune: true };
  PRG_K.runeShow = k.rune ? { id, rune: k.rune, at: game.real } : null;   // the page reads the chosen rune out in full for a moment
  if (k.mastery) computeStats(h);   // a deeper tier belongs to the chosen rune
  return true;
}
/** put a learned skill in slot i (a skill already slotted elsewhere swaps places with what was there) */
function PRG_assign(h, i, id) {
  if (!id || !skillAvailable(h, REG.skills[id]) || !PRG_base(h, id)) { sfx('cancel', { vol: .5 }); return false; }
  const was = h.slots.indexOf(id); if (was === i) return true;
  if (was >= 0) { h.slots[was] = h.slots[i] || null; PRG_K.flash[was] = .5; }
  h.slots[i] = id; PRG_K.flash[i] = .6; PRG_K.dirty = true; sfx('confirm', { vol: .6 });
  return true;
}
/* small pieces */
/** a rank pip: a 5 px diamond, filled with c (gold owned, blue from gear) or hollow */
function PRG_pip(g, x, y, c, edge) {
  px.rect(g, x + 2, y, 1, 1, edge); px.rect(g, x + 1, y + 1, 3, 1, edge); px.rect(g, x, y + 2, 5, 1, edge); px.rect(g, x + 1, y + 3, 3, 1, edge); px.rect(g, x + 2, y + 4, 1, 1, edge);
  if (c) { const T = E.tones(c); px.rect(g, x + 2, y + 1, 1, 1, T.hi); px.rect(g, x + 1, y + 2, 3, 1, T.base); px.rect(g, x + 1, y + 2, 1, 1, T.lt); px.rect(g, x + 2, y + 3, 1, 1, T.sh); } else px.rect(g, x + 1, y + 2, 3, 1, '#120e1c');
}
function PRG_lock(g, x, y) { px.rect(g, x - 3, y - 1, 7, 6, '#0a0812'); px.rect(g, x - 2, y, 5, 4, '#8a7a6a'); px.rect(g, x - 2, y, 5, 1, '#c8b8a0'); px.rect(g, x - 2, y - 4, 1, 4, '#8a7a6a'); px.rect(g, x + 2, y - 4, 1, 4, '#8a7a6a'); px.rect(g, x - 1, y - 5, 3, 1, '#8a7a6a'); px.dot(g, x, y + 1, '#2a2030'); }
function PRG_slotBox(g, h, i, x, y, armed, t) {
  const id = h.slots[i], fl = PRG_K.flash[i], S = id && REG.skills[id];
  E.ui.box(g, x - 1, y - 1, 20, 20, { bg: '#141020', border: armed ? (Math.sin(t * 10) > 0 ? '#fff6c8' : GOLD) : fl > 0 ? '#fff6c8' : '#5a4a70', shadow: false, gradient: false });
  if (S) drawSkillIcon(g, id, x + 1, y + 1, 1); else { px.rect(g, x + 4, y + 8, 10, 2, '#241e36'); px.rect(g, x + 8, y + 4, 2, 10, '#241e36'); }
  if (fl > 0) px.blend(g, fl, 'add', () => px.rect(g, x + 1, y + 1, 16, 16, '#fff0c0'));
  const kw = E.font.width(SLOT_KEYS[i], { font: 'tiny' }) + 3; px.rect(g, x + 18 - kw, y + 12, kw + 1, 7, '#0c0818'); E.font.text(g, SLOT_KEYS[i], x + 18 - kw + 2, y + 13, armed ? GOLD : '#c8c0d8', { font: 'tiny', outline: false });
  if (armed) { const bob = Math.round(Math.sin(t * 8)); px.poly(g, [[x + 5, y - 7 + bob], [x + 13, y - 7 + bob], [x + 9, y - 3 + bob]], GOLD); px.dot(g, x + 9, y - 4 + bob, '#fff6c8'); }
}

function PRG_skillsDraw(g, x, y, w, hh) {
  const h = ED.hero; if (!h) return;
  const K = PRG_K, t = game.real, m = UI.mouse, rows = PRG_skillRows(), ids = rows.filter(r => r.id).map(r => r.id); K.rows = rows;
  if (!ids.length) { PRG_txt(g, 'No skills are registered.', x + w / 2, y + hh / 2, '#9a90b0', { align: 'center' }); return; }
  if (!K.sel || !REG.skills[K.sel]) K.sel = h.slots.find(Boolean) || ids[0];
  // the header: points (left), the six slots (right)
  const pts = h.pts.skill || 0, blink = pts > 0 && Math.floor(t * 2.5) % 2;
  const gx = x + 12, gy = y + 25; px.poly(g, [[gx, gy - 5], [gx + 5, gy], [gx, gy + 5], [gx - 5, gy]], '#0a0812'); px.poly(g, [[gx, gy - 4], [gx + 4, gy], [gx, gy + 4], [gx - 4, gy]], pts ? '#ffb347' : '#3a3450'); px.poly(g, [[gx, gy - 4], [gx - 4, gy], [gx, gy]], pts ? '#ffe9a0' : '#4a4466');
  PRG_txt(g, pts ? pts + ' SKILL POINT' + (pts > 1 ? 'S' : '') : 'NO SKILL POINTS', x + 21, y + 21, pts ? (blink ? '#fff6c8' : GOLD) : '#6a6488');
  const SW = 18, sbw = 6 * (SW + 2) + 4, sbx = x + w - 10 - sbw, sby = y + 22, room = sbx - 30 - (x + 21);
  const fit = list => list.find(q => E.font.width(q, { font: 'tiny' }) <= room) || list[list.length - 1];   // the longest wording that fits
  if (K.armed !== null) PRG_txt(g, fit(['NOW CHOOSE A SKILL FOR SLOT ' + SLOT_KEYS[K.armed] + '  •  BACKSPACE CANCELS', 'CHOOSE A SKILL FOR SLOT ' + SLOT_KEYS[K.armed] + ' • BKSP CANCELS', 'CHOOSE A SKILL FOR SLOT ' + SLOT_KEYS[K.armed]]), x + 21, y + 31, Math.sin(t * 6) > 0 ? GOLD : '#c8a040', { font: 'tiny' });
  else PRG_txt(g, fit(['↑↓ PICK  •  ←→ RUNE  •  ENTER RANK UP  •  1-4 ASSIGN', '↑↓ PICK • ←→ RUNE • ENTER RANK • 1-4 SLOT', '↑↓ ←→ ENTER 1-4']), x + 21, y + 31, '#7a7098', { font: 'tiny' });
  PRG_txt(g, 'SLOTS', sbx - 4, sby + 6, '#7a7098', { font: 'tiny', align: 'right' });
  for (let i = 0; i < 6; i++) {
    const sx = sbx + i * (SW + 2) + (i >= 2 ? 4 : 0), id = h.slots[i];
    PRG_slotBox(g, h, i, sx, sby, K.armed === i, t);
    hot(sx - 1, sby - 1, 20, 20, { click: () => { if (K.armed === i) K.armed = null; else { K.armed = i; if (id) K.sel = id; K.follow = true; } sfx('select', { vol: .5 }); }, rclick: () => { if (h.slots[i]) { h.slots[i] = null; K.dirty = true; sfx('cancel', { vol: .5 }); } },
      tip: () => (id && REG.skills[id] ? skillTip(h, id) : [{ t: 'Empty slot  ' + SLOT_KEYS[i], c: '#9a90b0' }]).concat([{ t: '', sep: true }, { t: K.armed === i ? 'Now click a skill to put it here.' : 'Click, then click a skill to put it here. Right click empties it.', c: '#c8c0d8' }]) });
  }
  // the list
  const LX = x + 8, LY = y + 45, LW = clamp(Math.round(w * .43), 150, 196), LH = hh - 45 - 8, rh = r0 => r0.head ? 12 : 20;
  const rowTop = []; let acc = 0; for (const r0 of rows) { rowTop.push(acc); acc += rh(r0); }
  const total = acc, maxS = (() => { let s = 0; while (s < rows.length && total - rowTop[s] > LH) s++; return s; })();
  if (K.follow) { K.follow = false; const si = rows.findIndex(r0 => r0.id === K.sel); if (si >= 0) { if (si <= K.scroll) K.scroll = si > 0 && rows[si - 1].head ? si - 1 : si; while (K.scroll < si && rowTop[si] + 20 - rowTop[K.scroll] > LH) K.scroll++; } }
  K.scroll = clamp(K.scroll, 0, maxS); K.listR = [LX, LY, LW, LH];
  E.ui.box(g, LX - 2, LY - 2, LW + 4, LH + 4, { bg: ['#0e0b1a', '#08060e'], border: '#2e2644', shadow: false, gradient: false });
  const rw = LW - (maxS > 0 ? 6 : 1);
  for (let i = K.scroll, yy = LY; i < rows.length && yy + rh(rows[i]) <= LY + LH + 1; yy += rh(rows[i]), i++) {
    const r0 = rows[i];
    if (r0.head) {   // a kind header: its name, a rule, and what the kind is for
      const kd = PRG_KINDS[r0.head] || { label: r0.head.toUpperCase(), note: '', color: '#c8c0d8' }, C = E.tones(kd.color), lw = E.font.width(kd.label, { font: 'tiny' }), note = kd.note.toUpperCase(), nw = E.font.width(note, { font: 'tiny' }), room = rw - lw - nw - 16;
      PRG_txt(g, kd.label, LX + 2, yy + 3, kd.color, { font: 'tiny' });
      if (room > 6) { px.rect(g, LX + lw + 6, yy + 5, room, 1, C.deep); px.dot(g, LX + lw + 6 + room, yy + 5, C.sh); PRG_txt(g, note, LX + rw - 2, yy + 3, C.sh, { font: 'tiny', align: 'right' }); } else px.rect(g, LX + lw + 6, yy + 5, rw - lw - 8, 1, C.deep);
      hot(LX, yy, rw, 11, { tip: [{ t: kd.label, c: kd.color }, { t: cap(kd.note), c: '#c8c0d8' }] }); continue;
    }
    PRG_skillRow(g, h, r0.id, LX, yy, rw, t, m);
  }
  if (maxS > 0) { const tr = LH - 2, th = Math.max(10, tr * LH / total), ty = LY + 1 + (tr - th) * K.scroll / maxS; px.rect(g, LX + LW - 3, LY + 1, 2, tr, '#1c1830'); px.rect(g, LX + LW - 3, ty, 2, th, '#8a7aa8'); px.dot(g, LX + LW - 3, ty, '#c8b8e8');
    hot(LX + LW - 5, LY, 6, LH, { drag: (qx, qy) => { K.scroll = clamp(Math.round((qy - LY) / LH * (maxS + 1)), 0, maxS); } }); }
  PRG_skillPage(g, h, K.sel, LX + LW + 6, LY - 2, x + w - 8 - (LX + LW + 6), LH + 4, t);
  // sparks from a rank up
  for (const f of K.fx) { const u = f.t / f.dur; if (u < 0) continue; px.dot(g, f.x + f.vx * u, f.y + f.vy * u + 20 * u * u, u < .5 ? '#ffffff' : f.c); }
}
function PRG_skillRow(g, h, id, rx, ry, rw, t, m) {
  const K = PRG_K, S = REG.skills[id], base = PRG_base(h, id), eff = skillRank(h, id), lv = S.unlock || 1, locked = !base && h.level < lv, sel = K.sel === id, slot = h.slots.indexOf(id), cr = PRG_canRank(h, id), over = m.x >= rx && m.x < rx + rw && m.y >= ry && m.y < ry + 19;
  const plusR = cr.ok ? [rx + rw - 14, ry + 4, 11, 11] : null, overPlus = plusR && PRG_inR(m, plusR);
  E.ui.box(g, rx, ry, rw, 19, { bg: sel ? ['#3a2c58', '#221a38'] : over ? ['#2a2244', '#191430'] : ['#1a1430', '#100c1c'], border: sel ? GOLD : K.armed !== null && base ? (Math.sin(t * 6) > 0 ? '#8a7ab8' : '#5a4a88') : '#30284a', shadow: false });
  drawSkillIcon(g, id, rx + 2, ry + 2, 1);
  if (!base) px.blend(g, .62, 'normal', () => px.rect(g, rx + 2, ry + 2, 16, 16, '#08060e'));
  if (locked) PRG_lock(g, rx + 10, ry + 10);
  if (K.pulse && K.pulse.id === id && K.pulse.t < .5) px.blend(g, 1 - K.pulse.t * 2, 'add', () => px.rect(g, rx + 2, ry + 2, 16, 16, '#fff0c0'));
  const mast = PRG_mast(h, id), tier = mast ? PRG_tier(h, id) : 0, gear = eff - base - Math.max(0, tier - 1);   // ranks from gear (a deeper rune tier is its own rank)
  const maxName = rw - 22 - (slot >= 0 ? 22 : 0) - (cr.ok ? 14 : 0) - (locked ? 24 : 0); let nm = S.name; while (nm.length > 3 && E.font.width(nm) > maxName) nm = nm.slice(0, -1); if (nm !== S.name) nm = nm.slice(0, -1).trimEnd() + '.';
  PRG_txt(g, nm, rx + 22, ry + 2, base ? (sel ? '#fff6d8' : '#e8e0f8') : locked ? '#5a5478' : '#a8a0c0');
  const lit = K.pulse && K.pulse.id === id && K.pulse.t < .4;
  for (let i = 0; i < 5; i++) PRG_pip(g, rx + 22 + i * 6, ry + 12, i < base ? (i === base - 1 && lit && !mast ? '#fff6d8' : '#ffc040') : i < base + gear ? '#6a9aff' : null, i < base ? '#6a3a0a' : i < base + gear ? '#1a2a6a' : '#3a3252');
  // past the pips: the mastery (a starlight spark and its count), then what gear adds beyond five
  let mx = rx + 53;
  if (mast) { PRG_spark(g, mx + 3, ry + 14, lit ? '#ffffff' : '#c8b0ff', '#6a4aa8'); const s = String(mast); PRG_txt(g, s, mx + 8, ry + 12, lit ? '#ffffff' : '#d8c8ff', { font: 'tiny' }); mx += 11 + E.font.width(s, { font: 'tiny' }); }
  if (base + gear > 5) PRG_txt(g, '+' + (base + gear - 5), mx, ry + 12, '#8ab4ff', { font: 'tiny' });
  let rx1 = rx + rw - 3 - (cr.ok ? 14 : 0);
  if (slot >= 0) { const kw = E.font.width(SLOT_KEYS[slot], { font: 'tiny' }) + 4; E.ui.box(g, rx1 - kw, ry + 6, kw, 8, { bg: '#0c0818', border: '#6a5a88', shadow: false, gradient: false }); E.font.text(g, SLOT_KEYS[slot], rx1 - kw + 2, ry + 7, '#c8c0d8', { font: 'tiny', outline: false }); rx1 -= kw + 3; }
  if (locked) PRG_txt(g, 'LV ' + lv, rx1, ry + 7, '#8a6a7a', { font: 'tiny', align: 'right' });
  if (plusR) {   // a gold plus for a rank; a violet one (starlight) for a mastery rank
    const glow = .5 + .5 * Math.sin(t * 5), M = cr.mastery, hiC = M ? '#c8b0ff' : GOLD, mid = M ? '#5a3a8a' : '#8a5a1a';
    E.ui.box(g, plusR[0], plusR[1], 11, 11, { bg: overPlus ? (M ? ['#5a3a9a', '#321c5a'] : ['#8a5a1a', '#5a3410']) : M ? ['#3a2466', '#1e1238'] : ['#6a4214', '#3a220a'], border: overPlus ? '#fff6c8' : E.mix(hiC, mid, 1 - glow), shadow: false });
    px.rect(g, plusR[0] + 3, plusR[1] + 5, 5, 1, '#fff6d8'); px.rect(g, plusR[0] + 5, plusR[1] + 3, 1, 5, '#fff6d8');
  }
  hot(rx, ry, rw, 19, { click: () => {
    if (plusR && PRG_inR(UI.mouse, plusR)) { K.sel = id; PRG_rankUp(h, id); return; }
    K.sel = id; if (K.armed !== null) { if (PRG_assign(h, K.armed, id)) K.armed = null; else notify('LEARN ' + S.name.toUpperCase() + ' FIRST', '#ff9a7a', 1.5); } else sfx('select', { vol: .35 });
  }, tip: () => {
    const out = skillTip(h, id); if (!out.some(l => /^Mastery /.test(l.t || ''))) out.push(...PRG_skillExtra(h, id));
    out.push({ t: '', sep: true });
    if (plusR && PRG_inR(UI.mouse, plusR)) out.push({ t: cr.why, c: cr.mastery ? '#c8b0ff' : GOLD }, ...(cr.mastery ? [{ t: '+' + (PRG_mastDmg(mast + 1) - PRG_mastDmg(mast)).toFixed(1) + '% more damage with ' + S.name, c: '#c8c0d8' }] : []));
    else { out.push({ t: base ? 'Rank ' + base + ' / 5' + (mast ? '  •  Mastery ' + mast : '') + (gear > 0 ? '  (+' + gear + ' from gear)' : '') : cr.why, c: base ? '#c8c0d8' : cr.ok ? GOLD : '#ff8a7a' }); if (K.armed !== null && base) out.push({ t: 'Click to put it in slot ' + SLOT_KEYS[K.armed], c: GOLD }); }
    return out;
  } });
}
/** a 7 px four-point star (the mark of mastery) centred on x, y: long thin arms dimming to their tips, a fat heart */
function PRG_spark(g, x, y, c, edge) { px.rect(g, x - 3, y, 7, 1, edge); px.rect(g, x, y - 3, 1, 7, edge); px.rect(g, x - 1, y - 1, 3, 3, edge); px.rect(g, x - 2, y, 5, 1, c); px.rect(g, x, y - 2, 1, 5, c); px.dot(g, x, y, '#ffffff'); }
/** a wrap cut to n lines, never inside a word: the last line kept ends in '..' when text was dropped */
function PRG_clip(lines, n) {
  n = Math.max(1, n); if (lines.length <= n) return lines;
  const out = lines.slice(0, n), l = out[n - 1], cut = l.replace(/\s*\S+$/, '');
  out[n - 1] = (cut.length >= 3 ? cut : l.slice(0, -2)).replace(/[\s,:;•-]+$/, '') + '..';
  return out;
}
/** the right-hand page: the chosen skill in full */
function PRG_skillPage(g, h, id, dx, dy, dw, dh, t) {
  const K = PRG_K, S = REG.skills[id], k = h.skills[id] || {}, base = PRG_base(h, id), eff = skillRank(h, id), cr = PRG_canRank(h, id), kd = PRG_KINDS[S.kind || 'core'] || { label: (S.kind || '').toUpperCase(), color: '#c8c0d8' };
  const mast = k.mastery || 0, tier = PRG_tier(h, id), gear = eff - base - Math.max(0, tier - 1), m = UI.mouse;
  E.ui.box(g, dx, dy, dw, dh, { bg: ['#1e1834', '#0c0916'], border: '#4a3a66', shadow: false });
  // the icon, twice size, in a gold frame with an ember glow when learned
  const ix = dx + 7, iy = dy + 7, G = PRG_GOLDT; K.iconAt = [ix + 16, iy + 16];
  px.rect(g, ix - 3, iy - 3, 38, 38, '#0a0812'); px.rect(g, ix - 2, iy - 2, 36, 36, G.sh); px.rect(g, ix - 2, iy - 2, 35, 1, G.lt); px.rect(g, ix - 2, iy - 2, 1, 35, G.lt); px.rect(g, ix - 1, iy - 1, 34, 34, '#0a0812');
  drawSkillIcon(g, id, ix, iy, 2);
  if (!base) px.blend(g, .55, 'normal', () => px.rect(g, ix, iy, 32, 32, '#08060e'));
  if (K.pulse && K.pulse.id === id && K.pulse.t < .6 && !K.pulse.rune) px.blend(g, 1 - K.pulse.t / .6, 'add', () => px.rect(g, ix, iy, 32, 32, mast ? '#e0d0ff' : '#fff0c0'));
  for (const [cx, cy] of [[ix - 2, iy - 2], [ix + 33, iy - 2], [ix - 2, iy + 33], [ix + 33, iy + 33]]) { px.rect(g, cx - 1, cy - 1, 3, 3, G.base); px.dot(g, cx, cy, G.hi); }
  // name, rank (and mastery past it), what it is
  // (on a narrow page the rank drops its '/ 5' and the mastery its word before anything runs off the edge)
  const tx = ix + 41, tr = dx + dw - 5, mw = s => mast ? E.font.width(s) + 15 : 0, ms = [' Mastery ' + mast, ' ' + mast].map(s => s.trim()).find(s => tx + E.font.width(base ? 'Rank ' + base : '') + 6 + mw(s) <= tr) || String(mast);
  const rk = base ? (tx + E.font.width('Rank ' + base + ' / 5') + 6 + mw(ms) <= tr ? 'Rank ' + base + ' / 5' : 'Rank ' + base) : S.unlock > h.level ? 'Unlocks at level ' + S.unlock : 'Not learned';
  PRG_txt(g, S.name, tx, iy, GOLD); PRG_txt(g, rk, tx, iy + 10, base ? '#e8e0f8' : '#9a90b0');
  let rx0 = tx + E.font.width(rk) + 6;
  if (mast) { PRG_spark(g, rx0 + 3, iy + 13, '#c8b0ff', '#6a4aa8'); PRG_txt(g, ms, rx0 + 9, iy + 10, '#d8c8ff'); rx0 += mw(ms); }
  if (gear > 0 && rx0 + E.font.width('+' + gear + ' gear') <= tr) PRG_txt(g, '+' + gear + ' gear', rx0, iy + 10, '#8ab4ff');
  const tl = [kd.label].concat((S.tags || []).map(s => s.toUpperCase())).concat(S.el && S.el !== 'phys' ? [EL(S.el).name.toUpperCase()] : []);
  while (tl.length > 1 && tx + E.font.width(tl.join(' • '), { font: 'tiny' }) > tr) tl.splice(tl.length > 2 && S.el && S.el !== 'phys' ? tl.length - 2 : tl.length - 1, 1);   // the element stays: it says the most
  PRG_txt(g, tl.join(' • '), tx, iy + 21, kd.color, { font: 'tiny' });
  const cost = skillCost(h, S), bits = []; if (cost) bits.push(['COSTS ' + cost + ' EMBER', '#ffb070']); if (S.gen) bits.push(['GENERATES ' + S.gen + ' EMBER', '#ffb070']); if (S.cd) bits.push([skillCd(h, S).toFixed(1) + 'S COOLDOWN', '#8fe3ff']); if (!bits.length) bits.push(['FREE', '#c8c0d8']);
  let bx0 = tx; for (const [s, c] of bits) { if (bx0 + E.font.width(s, { font: 'tiny' }) > dx + dw - 4) break; PRG_txt(g, s, bx0, iy + 29, c, { font: 'tiny' }); bx0 += E.font.width(s, { font: 'tiny' }) + 8; }
  // the lower half is measured first. The rune cards grow until their whole text shows and the description takes the
  // rest (the small font when the normal one won't fit). When the page is too short for both, the description keeps
  // its room, the cards keep at least two lines each (cut at a word), and the description block shows the hovered
  // or just-chosen rune in full instead
  const runes = (S.runes || []).slice(0, 2), open = eff >= 2, descY = iy + 40, desc = typeof S.desc === 'function' ? S.desc(Math.max(1, eff), k.rune || null) : S.desc || '';
  const room = dy + dh - 58 - descY, cw = Math.floor((dw - 16) / 2), tw = dw - 14, cardH = n => 14 + 6 * n;
  const rl = runes.map(ru => E.font.wrap(ru.desc || '', cw - 17, { font: 'tiny' })), need = runes.length ? cardH(Math.max(3, ...rl.map(l => l.length))) : 16;
  const dN = E.font.wrap(desc, tw), dT = E.font.wrap(desc, tw, { font: 'tiny' });
  const ch = clamp(room - Math.min(dN.length * 9, dT.length * 7), Math.min(need, cardH(2)), need), dRoom = room - ch, useN = dN.length * 9 <= dRoom;
  const nL = Math.floor((ch - 14) / 6), cut = rl.map(l => l.length > nL), ry = dy + dh - 48 - ch, cy = ry + 27;
  const cardR = i => [dx + 6 + i * (cw + 4), cy, cw, ch];
  const shown = K.runeShow && K.runeShow.id === id && game.real - K.runeShow.at < 3 ? K.runeShow.rune : null;
  const focus = runes.find((ru, i) => cut[i] && PRG_inR(m, cardR(i))) || runes.find((ru, i) => cut[i] && ru.id === shown);
  if (focus) {   // a rune the cards can't show whole: its name and text take the description's place for a moment
    PRG_txt(g, focus.name, dx + 7, descY, '#ff9a4a');
    const av = dRoom - 10, fN = E.font.wrap(focus.desc || '', tw), fT = E.font.wrap(focus.desc || '', tw, { font: 'tiny' });
    if (fN.length * 9 <= av) fN.forEach((l, i) => PRG_txt(g, l, dx + 7, descY + 10 + i * 9, '#f0dcc8'));
    else PRG_clip(fT, Math.floor(av / 7)).forEach((l, i) => PRG_txt(g, l, dx + 7, descY + 10 + i * 7, '#f0dcc8', { font: 'tiny' }));
  } else {
    const lh = useN ? 9 : 7, lines = PRG_clip(useN ? dN : dT, Math.floor(dRoom / lh));
    lines.forEach((l, i) => PRG_txt(g, l, dx + 7, descY + i * lh, '#d8d0ec', useN ? undefined : { font: 'tiny' }));
    if (lines.length < (useN ? dN : dT).length) hot(dx + 4, descY, dw - 8, lines.length * lh, { tip: [{ t: S.name, c: GOLD }, { t: desc, c: '#e8e0f8' }] });
  }
  // rank up (a mastery rank once the five are bought)
  px.rect(g, dx + 6, ry - 4, dw - 12, 1, '#2e2644');
  const M = !!cr.mastery, nextM = PRG_mastDmg(mast + 1) - PRG_mastDmg(mast);
  button(g, dx + 6, ry, 98, 14, base ? (base >= 5 ? 'MASTERY  (1)' : 'RANK UP  (1)') : 'LEARN  (1)', () => PRG_rankUp(h, id), { disabled: !cr.ok, color: cr.ok ? (M ? '#4a2a7a' : '#6a3a14') : '#2a2438',
    tip: M ? [{ t: cr.why, c: cr.ok ? '#c8b0ff' : '#ff8a7a' }, { t: 'Past rank 5 every point is a mastery rank: more damage with ' + S.name + ', a little less each time.', c: '#c8c0d8' }, { t: 'At mastery 5, 15, 30, 50 ... the chosen rune deepens a tier: +1 to the skill.', c: '#ffb070' }]
      : [{ t: cr.why, c: cr.ok ? GOLD : '#ff8a7a' }, { t: 'Each rank adds 12% damage.', c: '#c8c0d8' }] });
  const note = M ? (cr.ok ? ['NEXT +' + nextM.toFixed(1) + '%  •  NOW +' + Math.round(PRG_mastDmg(mast)) + '% MORE DAMAGE', '+' + nextM.toFixed(1) + '% MORE DAMAGE NEXT', '+' + nextM.toFixed(1) + '% NEXT'] : [cr.why.toUpperCase(), 'NO SKILL POINTS', ''])
    : cr.ok ? ['+12% DAMAGE PER RANK', '+12% PER RANK'] : [cr.why.toUpperCase(), ''];
  PRG_txt(g, note.find(q => E.font.width(q, { font: 'tiny' }) <= dw - 116) || '', dx + 110, ry + 4, cr.ok ? (M ? '#b8a0e0' : '#c8a878') : '#8a7a9a', { font: 'tiny' });
  // runes: two cards, one may be chosen from rank 2; mastery deepens the chosen one a tier at a time
  const st = !open ? ['UNLOCK AT RANK 2'] : k.rune && mast ? ['TIER ' + PRG_roman(tier) + '  •  ' + PRG_roman(tier + 1) + ' AT MASTERY ' + PRG_tierAt(tier + 1), 'TIER ' + PRG_roman(tier) + '  •  NEXT AT ' + PRG_tierAt(tier + 1), 'TIER ' + PRG_roman(tier)]
    : k.rune ? ['CLICK THE OTHER TO SWITCH', 'CLICK TO SWITCH'] : base >= 5 ? ['CHOOSE ONE: MASTERY DEEPENS IT', 'CHOOSE ONE'] : ['CHOOSE ONE'];
  PRG_txt(g, 'RUNES', dx + 7, ry + 18, '#c8b8e8', { font: 'tiny' }); PRG_txt(g, st.find(q => E.font.width(q, { font: 'tiny' }) <= dw - 40) || st[st.length - 1], dx + 32, ry + 18, !open ? '#6a5a7a' : k.rune && mast ? '#d8a878' : '#8a80a8', { font: 'tiny' });
  runes.forEach((ru, i) => {
    const [cx] = cardR(i), on = k.rune === ru.id, over = PRG_inR(m, cardR(i));
    E.ui.box(g, cx, cy, cw, ch, { bg: on ? ['#4a2a16', '#26140a'] : over && open ? ['#2a2244', '#191430'] : ['#181228', '#0e0a18'], border: on ? (Math.sin(t * 4) > -.3 ? '#ffb070' : '#ff8a3a') : open ? '#5a4a78' : '#2a2438', shadow: false });
    if (on && K.pulse && K.pulse.id === id && K.pulse.tier && K.pulse.t < .8) px.blend(g, (1 - K.pulse.t / .8) * .8, 'add', () => px.rect(g, cx + 1, cy + 1, cw - 2, ch - 2, '#ff9a4a'));   // the rune deepening
    const gx = cx + 7, gy = cy + 8, rc = on ? E.tones('#ff9a4a') : open ? E.tones('#8a7aa8') : E.tones('#4a4060');
    px.poly(g, [[gx, gy - 5], [gx + 4, gy], [gx, gy + 5], [gx - 4, gy]], rc.deep); px.poly(g, [[gx, gy - 4], [gx + 3, gy], [gx, gy + 4], [gx - 3, gy]], rc.base); px.line(g, gx, gy - 2, gx, gy + 2, rc.hi); px.dot(g, gx - 1, gy - 1, rc.lt);
    if (on) PRG_glow(g, gx, gy, 8, '#ff8a3a', .25);
    // the name: the normal font, the small one when it is too long, a cut only if even that fails
    const nc = on ? '#ffd0a0' : open ? '#e8e0f8' : '#6a6488', ts = on && tier >= 2 ? PRG_roman(tier) : '', tbw = ts ? E.font.width(ts, { font: 'tiny' }) + 5 : 0, nmW = cw - 18 - (tbw ? tbw + 1 : 0);   // (the tier tab keeps its corner)
    if (E.font.width(ru.name) <= nmW) PRG_txt(g, ru.name, cx + 14, cy + 3, nc);
    else { let nm = ru.name.toUpperCase(); while (/\s/.test(nm.trim()) && E.font.width(nm, { font: 'tiny' }) > nmW) nm = nm.replace(/\.\.$/, '').replace(/\s*\S+$/, '') + '..'; PRG_txt(g, nm, cx + 14, cy + 4, nc, { font: 'tiny' }); }
    PRG_clip(rl[i], nL).forEach((l, j) => PRG_txt(g, l, cx + 14, cy + 12 + j * 6, on ? '#e8c0a0' : open ? '#a8a0c0' : '#5a5478', { font: 'tiny' }));
    if (ts) { const bx = cx + cw - tbw - 3; E.ui.box(g, bx, cy - 3, tbw, 9, { bg: ['#6a3a14', '#3a1e0a'], border: '#ffb070', shadow: false, gradient: false }); PRG_txt(g, ts, bx + 3, cy - 1, '#fff0c8', { font: 'tiny' }); }   // the tier, on a small gold tab over the card's corner
    hot(cx, cy, cw, ch, { click: () => PRG_setRune(h, id, ru.id), tip: (cut[i] ? [{ t: ru.name, c: '#ff9a4a' }] : [{ t: ru.name, c: '#ff9a4a' }, { t: ru.desc || '', c: '#e8e0f8' }]).concat([{ t: '', sep: true }, { t: !open ? 'Reach rank 2 to choose a rune.' : on ? 'Chosen. Click to clear it.' : 'Click to choose this rune.', c: open ? GOLD : '#ff8a7a' }]) });
  });
  if (!runes.length) PRG_txt(g, 'THIS SKILL HAS NO RUNES', dx + dw / 2, cy + 5, '#5a5478', { font: 'tiny', align: 'center' });
  // assign
  const ay = dy + dh - 15, lab = dw >= 170; if (lab) PRG_txt(g, 'ASSIGN', dx + 7, ay + 3, '#c8b8e8', { font: 'tiny' });   // a narrow page drops the word so LMB and RMB keep their room
  const aw = Math.min(22, Math.floor((dw - (lab ? 44 : 14)) / 6) - 2);
  for (let i = 0; i < 6; i++) { const ax = dx + (lab ? 36 : 6) + i * (aw + 2) + (i >= 2 ? 3 : 0); button(g, ax, ay, aw, 11, SLOT_KEYS[i], () => PRG_assign(h, i, id), { disabled: !base, active: h.slots[i] === id, color: h.slots[i] === id ? '#3a5a6a' : '#2e2648', tip: [{ t: base ? 'Put ' + S.name + ' in slot ' + SLOT_KEYS[i] : 'Learn it first', c: base ? GOLD : '#ff8a7a' }].concat(h.slots[i] && h.slots[i] !== id && REG.skills[h.slots[i]] ? [{ t: 'Replaces ' + REG.skills[h.slots[i]].name, c: '#9a90b0' }] : []) }); }
}
function PRG_skillsUpdate(dt) {
  const h = ED.hero, K = PRG_K, inp = game.input; if (!h) return;
  for (let i = 0; i < 6; i++) K.flash[i] = Math.max(0, K.flash[i] - dt * 1.5);
  if (K.pulse) K.pulse.t += dt;
  for (let i = K.fx.length - 1; i >= 0; i--) if ((K.fx[i].t += dt) > K.fx[i].dur) K.fx.splice(i, 1);
  const ids = K.rows.filter(r => r.id).map(r => r.id); if (!ids.length) return;
  let i = Math.max(0, ids.indexOf(K.sel));
  if (inp.repeat('menuUp')) { K.sel = ids[(i + ids.length - 1) % ids.length]; K.follow = true; UI.keyNav = true; sfx('select', { vol: .3 }); }
  if (inp.repeat('menuDown')) { K.sel = ids[(i + 1) % ids.length]; K.follow = true; UI.keyNav = true; sfx('select', { vol: .3 }); }
  const S = REG.skills[K.sel], runes = (S && S.runes) || [], k = h.skills[K.sel];
  if ((inp.pressed('menuLeft') || inp.pressed('menuRight')) && runes.length && k && skillRank(h, K.sel) >= 2) { const cur = runes.findIndex(r => r.id === k.rune), n = runes.length, nx = inp.pressed('menuLeft') ? (cur <= 0 ? n - 1 : cur - 1) : (cur + 1) % n; PRG_setRune(h, K.sel, runes[nx].id); }
  if (inp.pressed('confirm')) { if (K.armed !== null) { if (PRG_assign(h, K.armed, K.sel)) K.armed = null; } else PRG_rankUp(h, K.sel); }
  for (let s = 0; s < 6; s++) if (inp.pressed(SLOT_ACTS[s]) && (s >= 2 || !inp.pressed('click') && !inp.pressed('rclick'))) PRG_assign(h, s, K.sel);
  if (inp.pressed('cancel')) K.armed = null;
}

/* ---------- register the panels once the UI kit exists (60-ui-core.js loads after this file) ---------- */
/** a screen pixel of the HUD / panels as a page point (tests drive the real mouse with it) */
function PRG_pagePt(x, y) { const sc = game.screen, rc = sc.canvas.getBoundingClientRect(); return [Math.round(rc.left + (x * sc.S + sc.OX - Math.round(sc.fx * sc.S)) / sc.dpr), Math.round(rc.top + (y * sc.S + sc.OY - Math.round(sc.fy * sc.S)) / sc.dpr)]; }
function PRG_hideHud(on, store) { if (on) { store.hud = !!UI.hideHud; UI.hideHud = true; } else UI.hideHud = store.hud; }
function PRG_install() {
  UI.def('tree', { title: null, box: false, dim: false, x: 0, y: 0, w: W => W, h: (W, H) => H,
    open() { const V = PRG_V; PRG_hideHud(true, V); V.openT = 0; V.drag = null; V.fx.length = 0; V.banner = null; V.reveal = null; V.labels = []; V.session.clear(); V.dirty = false; V.pathKey = ''; if (ED.hero) PRG_sanitize(ED.hero); },
    close() { const V = PRG_V; PRG_hideHud(false, V); V.drag = null; if (V.dirty && typeof saveGame === 'function') saveGame(); V.dirty = false; },
    update: PRG_treeUpdate, draw: PRG_treeDraw,
    wheel(dir) { const V = PRG_V, m = UI.mouse; if (V.sum && PRG_inR(m, [4, 22, Math.min(178, Math.round(V.W * .45)), V.H - 38])) { V.sumScroll += Math.sign(dir) * 2; return; } PRG_zoomBy(dir > 0 ? 1 / 1.2 : 1.2, m.x, m.y); },
    // test helpers: where a star is on screen, in page pixels (tools/ed-play mouse steps)
    api: { N: PRG_T.N, count: () => PRG_T.list.length, pagePt(id) { const n = PRG_T.N[id]; return n && n.sx !== undefined ? PRG_pagePt(n.sx, n.sy) : null; }, view: PRG_V, path: id => PRG_path(ED.hero, id), buy: id => PRG_buy(ED.hero, id), respec: (what, o) => respecHero(ED.hero, what, o), auto: () => autoAllocatePassives(ED.hero),
      open: () => PRG_open(ED.hero), ring: PRG_deepRing, canSpend: () => PRG_canSpend(ED.hero), labels: () => PRG_V.labels } });
  UI.def('skills', { title: 'SKILLS', w: W => Math.min(W - 8, 470), h: (W, H) => Math.min(H - 8, 290),
    open(d) { const K = PRG_K, h = ED.hero; PRG_hideHud(true, K); K.armed = d && d.slot !== undefined ? d.slot : null; if (h && K.armed !== null && h.slots[K.armed]) K.sel = h.slots[K.armed]; K.follow = true; K.dirty = false; },
    close() { const K = PRG_K; PRG_hideHud(false, K); K.armed = null; if (K.dirty && typeof saveGame === 'function') saveGame(); K.dirty = false; },
    update: PRG_skillsUpdate, draw: PRG_skillsDraw,
    wheel(dir) { const K = PRG_K; if (K.listR && PRG_inR(UI.mouse, K.listR)) K.scroll += Math.sign(dir); },
    api: { K: PRG_K, rows: PRG_skillRows, pagePt: PRG_pagePt, rankUp: id => PRG_rankUp(ED.hero, id), assign: (i, id) => PRG_assign(ED.hero, i, id), rune: (id, r) => PRG_setRune(ED.hero, id, r),
      mastery: () => autoAllocateMastery(ED.hero), tier: id => PRG_tier(ED.hero, id), canSpend: () => PRG_canSpend(ED.hero) } });
}
queueMicrotask(() => { try { PRG_install(); } catch (e) { game._fail('28-progression install', e); } });
