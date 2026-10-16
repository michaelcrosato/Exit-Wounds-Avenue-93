/* =============================================================================
 * LOOT: items, rarities, affixes, legendary powers, drops on the ground, pickup and equipping
 * An ITEM is { uid, base, slot, name, rarity: 0 common | 1 magic | 2 rare | 3 legendary | 4 unique, ilvl, grade,
 *   dmg: [min, max] (weapons), implicit: [{ stat, v }], affixes: [ROLLED AFFIX], power (legendary / unique power id),
 *   look: { colors, hat, armor, outfit, cape, bladeLen, weapon } (how it changes the hero), el (weapon element), value }
 * A BASE is def('itemBases', id, { slot, name, minIlvl, dmg, implicit: { stat: v }, look, colors: [palette choices], weight })
 * An AFFIX is def('itemAffixes', id, { stat, kind: 'prefix' | 'suffix', slots: [...], v: [min, max] (its five hand-named
 *   tiers at item level 1), scale: 'flat' | 'pct' | 'none', names: [5 tier names], minIlvl, weight, cap (the most one line
 *   may give: resistances, speeds, chances), also: [[affixId, share]] (a hybrid: it rolls that affix too, at share of
 *   its value), pick(R) -> stat (for rank:<skill>) })
 * A ROLLED AFFIX is { id, stat, v, tier (0-based, no top), q (0..1: the roll inside its tier), g (1: greater, x1.5),
 *   k (its share when fused), also: [{ id, stat, v, k, tier }] (the second stat of a hybrid) }. Uniques' lines are id 'u'.
 * A POWER is def('powers', id, { name, desc, slots, minIlvl, stats: { ... } (always on), install() (adds BUS listeners
 *   that check hasPower) }. Past depth 15 legendaries also roll COMPOSED powers ('cx.<trigger>.<effect>.<el>.<rank>',
 *   see the end of this file): powerSpec(id) is the lookup that builds one the first time it is seen.
 * A UNIQUE is def('uniques', id, { name, base, stats: [[stat, v], ...], power (a composed id without its rank gets one
 *   from the item level), look, flavor, minIlvl })
 * THE DEEP: loot never stops changing. Affix tiers go on past T5 with made-up names, percent affixes keep growing (capped
 *   stats stop at their cap), greater affixes appear from item level 30, hybrids from 20 and fused affixes from 60, bases
 *   come in GRADES (Tempered at 16, Runic at 26 ... then named by the language) that hit harder and recolor the gear,
 *   and loot takes the color of the depth it dropped in and the element of the monster that dropped it.
 * ============================================================================= */
const RARITY = [
  { id: 'common', name: 'Common', color: '#d8d0c0', n: [0, 0], value: 1 },
  { id: 'magic', name: 'Magic', color: '#7aa8ff', n: [1, 2], value: 3, beam: '#6a9aff' },
  { id: 'rare', name: 'Rare', color: '#ffd84a', n: [3, 5], value: 8, beam: '#ffd84a' },
  { id: 'legendary', name: 'Legendary', color: '#ff8a2a', n: [3, 4], value: 20, beam: '#ff8a2a' },
  { id: 'unique', name: 'Unique', color: '#e8c890', n: [0, 0], value: 30, beam: '#e8c890' }
];
const SLOTS = ['weapon', 'helm', 'chest', 'gloves', 'legs', 'boots', 'cloak', 'amulet', 'ring', 'ring2'];
const SLOT_NAMES = { weapon: 'Weapon', helm: 'Helm', chest: 'Chest', gloves: 'Gloves', legs: 'Legs', boots: 'Boots', cloak: 'Cloak', amulet: 'Amulet', ring: 'Ring', ring2: 'Ring' };
const ARMOR_SLOTS = ['helm', 'chest', 'gloves', 'legs', 'boots', 'cloak'], JEWEL_SLOTS = ['amulet', 'ring'];
let itemUid = 1;
const hasPower = (h, id) => !!h && h.powers.includes(id);
/** a hit that came from a proc, a chain, thorns or a dot: procs never trigger procs (no feedback loops) */
const isProcHit = hit => !!hit && (hit.proc || hit.cx || (hit.tags && (hit.tags.includes('proc') || hit.tags.includes('chain') || hit.tags.includes('thorns') || hit.tags.includes('dot'))));

/* ---------- bases ---------- */
const CLOTH = ['#2f8f86', '#8a3a3a', '#3a5a9a', '#5a7a3a', '#6a4a8a', '#8a6a3a', '#3a3a4a', '#9a8a6a', '#2a6a5a', '#7a2a4a'];
const LEATHER = ['#6a4128', '#4a3020', '#7a5a3a', '#3a2a22', '#5a3a2a'], METAL = ['#b9c1cf', '#8a94a8', '#c8b078', '#7a8290', '#d8dce8'];
const CAPES = ['#c8452f', '#3a4a9a', '#2a6a4a', '#6a2a6a', '#b88a2a', '#1e1e2a', '#8a1a2a', '#e0e0e8'];
const W = (id, name, lv, dmg, look, o = {}) => def('itemBases', id, Object.assign({ slot: 'weapon', name, minIlvl: lv, dmg, look: Object.assign({ weapon: 'sword' }, look), weight: 10 }, o));
W('shortsword', 'Short Sword', 1, [4, 8], { bladeLen: 9 });
W('longsword', 'Longsword', 1, [6, 11], { bladeLen: 11 });
W('saber', 'Saber', 3, [5, 10], { bladeLen: 10, colors: { metal: '#e8eef8', hilt: '#c8a040' } }, { implicit: { crit: 3 } });
W('broadsword', 'Broadsword', 4, [8, 14], { bladeLen: 12, colors: { metal: '#c8ccd8', metalDk: '#6a7080' } });
W('runeblade', 'Runeblade', 5, [7, 13], { bladeLen: 11, colors: { metal: '#8fe0e0', metalDk: '#2f7f82', hilt: '#3a4a5a' } }, { implicit: { incSpell: 12 } });
W('greatblade', 'Greatblade', 7, [12, 21], { bladeLen: 14, colors: { metal: '#a8b0c0', metalDk: '#505868', hilt: '#5a3a2a' } }, { implicit: { atkSpeed: -8, knockback: 25 } });
W('staff', 'Ember Staff', 2, [5, 12], { weapon: 'staff', colors: { staff: '#6a4a2a', orb: '#ffb347' } }, { implicit: { incSpell: 20, castSpeed: 8 }, el: 'fire' });
W('frostwand', 'Rime Staff', 6, [6, 13], { weapon: 'staff', colors: { staff: '#4a5a7a', orb: '#9fe8ff' } }, { implicit: { incFrost: 20, castSpeed: 8 }, el: 'frost' });
W('fang', 'Serpent Fang', 9, [7, 14], { bladeLen: 10, colors: { metal: '#c8f090', metalDk: '#3a7a1a', hilt: '#2a3a1a' } }, { implicit: { incVenom: 15 }, el: 'venom' });
W('stormedge', 'Storm Edge', 11, [8, 16], { bladeLen: 12, colors: { metal: '#fff4b0', metalDk: '#8a7a3a', hilt: '#3a3a5a' } }, { implicit: { incStorm: 15 }, el: 'storm' });
W('voidblade', 'Hollow Blade', 13, [9, 17], { bladeLen: 12, colors: { metal: '#c8a0ff', metalDk: '#4a2090', hilt: '#1a1028' } }, { implicit: { incVoid: 15 }, el: 'void' });
const AR = (id, slot, name, lv, armor, look, o = {}) => def('itemBases', id, Object.assign({ slot, name, minIlvl: lv, armor, look, weight: 10 }, o));
AR('leathercap', 'helm', 'Leather Cap', 1, 3, { hat: { style: 'cap', color: '#6a4128' } });
AR('hood', 'helm', 'Hood', 1, 2, { hood: true }, { implicit: { ember: 6 } });
AR('ironhelm', 'helm', 'Iron Helm', 3, 7, { hat: { style: 'helmet', color: '#8a94a8' } });
AR('circlet', 'helm', 'Circlet', 5, 3, { hat: { style: 'band', color: '#c8a040' } }, { implicit: { cdr: 3 } });
AR('wizardhat', 'helm', 'Wizard Hat', 6, 2, { hat: { style: 'pointed', color: '#4a2a8a' } }, { implicit: { incSpell: 8 } });
AR('crown', 'helm', 'Crown', 12, 5, { hat: { style: 'crown', color: '#e8c040' } }, { implicit: { magicFind: 10 } });
AR('tunic', 'chest', 'Tunic', 1, 4, { outfit: 'tunic' }, { colors: CLOTH });
AR('jerkin', 'chest', 'Jerkin', 2, 7, { outfit: 'tunic', sleeves: 'long' }, { colors: LEATHER });
AR('mail', 'chest', 'Mail Shirt', 4, 12, { outfit: 'tunic', armor: true }, { colors: CLOTH });
AR('plate', 'chest', 'Plate Armor', 8, 20, { outfit: 'tunic', armor: true, sleeves: 'long' }, { colors: CLOTH, implicit: { moveSpeed: -3 } });
AR('robe', 'chest', 'Robe', 3, 3, { outfit: 'robe', sleeves: 'long' }, { colors: CLOTH, implicit: { ember: 15 } });
AR('coat', 'chest', 'Long Coat', 5, 9, { outfit: 'coat', sleeves: 'long' }, { colors: CLOTH, implicit: { dodge: 3 } });
AR('wraps', 'gloves', 'Wraps', 1, 2, {}, { colors: LEATHER, lookKey: 'glove' });
AR('gauntlets', 'gloves', 'Gauntlets', 4, 6, {}, { colors: METAL, lookKey: 'glove' });
AR('trousers', 'legs', 'Trousers', 1, 3, {}, { colors: ['#3b3552', '#3a3a2a', '#2a2a3a', '#4a3a2a', '#2a3a3a'], lookKey: 'pants' });
AR('greaves', 'legs', 'Greaves', 5, 8, {}, { colors: METAL, lookKey: 'pants' });
AR('shoes', 'boots', 'Shoes', 1, 2, {}, { colors: LEATHER, lookKey: 'boot', implicit: { moveSpeed: 3 } });
AR('boots', 'boots', 'Boots', 3, 5, {}, { colors: LEATHER, lookKey: 'boot' });
AR('sabatons', 'boots', 'Sabatons', 7, 9, {}, { colors: METAL, lookKey: 'boot' });
AR('cape', 'cloak', 'Cape', 1, 2, { cape: { len: 6, width: 5, seg: 2.5 } }, { colors: CAPES, lookKey: 'cape' });
AR('longcape', 'cloak', 'Long Cape', 4, 3, { cape: { len: 8, width: 5.5, seg: 2.5 } }, { colors: CAPES, lookKey: 'cape', implicit: { dodge: 2 } });
AR('mantle', 'cloak', 'Mantle', 6, 4, { cape: { len: 4, width: 6.5, seg: 2.4 } }, { colors: CAPES, lookKey: 'cape', implicit: { armorPct: 8 } });
def('itemBases', 'amulet', { slot: 'amulet', name: 'Amulet', minIlvl: 1, weight: 8, gems: ['#e04a4a', '#4a8ae0', '#4ae08a', '#e0c04a', '#b070ff'] });
def('itemBases', 'ring', { slot: 'ring', name: 'Ring', minIlvl: 1, weight: 10, gems: ['#e04a4a', '#4a8ae0', '#4ae08a', '#e0c04a', '#b070ff', '#e8e8f0'] });

/* ---------- the deep language's word lists (deep tier names, grade names past the hand-made ones) ---------- */
const DEEP_ROOTS = {
  fire: ['Cinder', 'Pyre', 'Magma', 'Sol', 'Ember', 'Flame'], frost: ['Rime', 'Hoar', 'Glacier', 'Winter', 'Frost', 'Ice'],
  storm: ['Thunder', 'Tempest', 'Volt', 'Sky', 'Storm', 'Gale'], void: ['Umbra', 'Null', 'Nyx', 'Hollow', 'Void', 'Shade'],
  venom: ['Blight', 'Plague', 'Viper', 'Miasma', 'Rot', 'Venom'], might: ['Titan', 'Wyrm', 'War', 'Blood', 'Iron', 'Giant'],
  guard: ['Aegis', 'Bastion', 'Stone', 'Warden', 'Adamant', 'Rampart'], life: ['Troll', 'Phoenix', 'Heart', 'Oak', 'Hydra', 'Root'],
  swift: ['Comet', 'Wind', 'Flicker', 'Hawk', 'Arrow', 'Zephyr'], arcane: ['Rune', 'Star', 'Aether', 'Sigil', 'Moon', 'Astral'],
  wealth: ['Gold', 'Hoard', 'Crown', 'Gilt', 'Coin', 'Dragon'], deep: ['Deep', 'Elder', 'Abyss', 'Primal', 'Ancient', 'Mythic']
};
const DEEP_ADJ = ['forged', 'born', 'wrought', 'sworn', 'bound', 'touched', 'blessed', 'tempered', 'crowned', 'kissed'];
const DEEP_NOUN = ['fall', 'heart', 'crown', 'spire', 'maw', 'song', 'tide', 'forge', 'gate', 'throne', 'veil', 'brand'];
const ROMAN = n => { let s = ''; for (const [v, r] of [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]) while (n >= v) { s += r; n -= v; } return s; };
/** which word family a stat's deep names come from */
function statTheme(st) {
  const m = /^(?:inc|res)(Fire|Frost|Storm|Void|Venom)$/.exec(st); if (m) return m[1].toLowerCase();
  if (/^(dmgFlat|dmgPct|incMelee|incDmg|incPhys|critDmg|crit|knockback|thorns|incElite|incBoss|moreDmg)$/.test(st)) return 'might';
  if (/^(armor|armorPct|resAll)$/.test(st)) return 'guard';
  if (/^(life|lifePct|lifeRegen|lifeOnHit|leech|lifeOnKill|potionHeal|potionCharges)$/.test(st)) return 'life';
  if (/^(atkSpeed|castSpeed|moveSpeed|dodge|cdr|dodgeCharges|dodgeCd|pickup)$/.test(st)) return 'swift';
  if (/^(incSpell|ember|emberRegen|emberOnHit|area|projectiles|allSkills|chains|pierce|costRed|incAoe|incProj)$/.test(st) || st.startsWith('rank:')) return 'arcane';
  if (/^(goldFind|magicFind|xpGain)$/.test(st)) return 'wealth';
  if (/^(statusChance|incDot|statusDmg)$/.test(st)) return 'venom';
  return 'deep';
}

/* ---------- GRADES: the same base made deeper. Every grade hits a little harder (+5% base damage and armor each) and
 * tints the gear with its color, so the hero visibly changes as he descends. Past Elder the language names them ---------- */
const GRADE_HAND = [['Tempered', '#c8d4e8'], ['Runic', '#8fe0d8'], ['Starforged', '#ffe8a0'], ['Hollowed', '#a88ad8'], ['Wyrmscale', '#a8d878'], ['Sunforged', '#ffb060'], ['Voidglass', '#c8a0ff'], ['Elder', '#e8dcc0']];
const gradeIlvl = g => 16 + 10 * (g - 1) + (g - 1) * (g - 2);   // 16, 26, 38, 52, 68, 86, 106, 128, 152... grade 29 near 1000
function gradeTop(il) { let g = 0; while (gradeIlvl(g + 1) <= il) g++; return g; }
const GRADE_CACHE = [];
/** { name, c, k } of grade g (1..), or null */
function gradeInfo(g) {
  if (!(g > 0)) return null; if (GRADE_CACHE[g]) return GRADE_CACHE[g];
  let name, c;
  if (g <= GRADE_HAND.length) [name, c] = GRADE_HAND[g - 1];
  else { const all = [].concat(...Object.values(DEEP_ROOTS)), h = hashStr('grade' + g); name = all[h % all.length] + DEEP_ADJ[(h >>> 8) % DEEP_ADJ.length]; c = E.hsl((g * 47) % 360, .5, .72); }
  return (GRADE_CACHE[g] = { g, name, c, k: 1 + g * .05 });
}
/** a grade tints the gear: blades and orbs take its color, helms and plates a share of it, cloth and capes a trim */
function gradeLook(it, G) {
  const lk = it.look || (it.look = {}), c = lk.colors || (lk.colors = {}), base = REG.itemBases[it.base] || {};
  if (it.slot === 'weapon') {
    if (lk.weapon === 'staff') c.orb = E.mix(c.orb || '#ffb347', G.c, .5);
    else { c.metal = E.mix(c.metal || '#dce8f1', G.c, .5); c.metalDk = E.mix(c.metalDk || '#7f93ab', E.shade(G.c, -.45), .5); c.hilt = E.mix(c.hilt || '#e8b04e', G.c, .35); }
  } else if (it.slot === 'helm') { if (lk.hat) lk.hat = Object.assign({}, lk.hat, { color: E.mix(lk.hat.color, G.c, lk.hat.style === 'cap' ? .25 : .32) }); }
  else if (it.slot === 'chest' || it.slot === 'cloak') { c.trim = c.trim ? E.mix(c.trim, G.c, .5) : G.c; if (lk.armor) c.metal = E.mix(c.metal || '#b9c1cf', G.c, .4); }
  else if (base.gems) it.gem = G.c;
  else if (base.lookKey && c[base.lookKey]) c[base.lookKey] = E.mix(c[base.lookKey], G.c, METAL.includes(c[base.lookKey]) ? .45 : .2);
}

/* ---------- affixes ---------- */
const WPN = ['weapon'], ARM = ARMOR_SLOTS, JWL = JEWEL_SLOTS, ANY = SLOTS.filter(s => s !== 'ring2');
const TIERS = (a, b, c, d, e) => [a, b, c, d, e];
const AF = (id, stat, kind, slots, v, names, o = {}) => def('itemAffixes', id, Object.assign({ stat, kind, slots, v, names, scale: 'pct', weight: 10, minIlvl: 1 }, o));
// caps: a stat that stops mattering (or breaks the game) past a point caps per line: resistances, speeds, chances, finds
AF('sharp', 'dmgFlat', 'prefix', WPN, [2, 5], TIERS('Sharp', 'Keen', 'Honed', 'Vicious', 'Merciless'), { scale: 'flat', weight: 14 });
AF('heavy', 'dmgPct', 'prefix', WPN, [15, 32], TIERS('Heavy', 'Cruel', 'Brutal', 'Savage', 'Tyrannical'), { weight: 12 });
AF('fiery', 'incFire', 'prefix', WPN.concat(JWL, ['gloves']), [8, 16], TIERS('Smoldering', 'Burning', 'Blazing', 'Infernal', 'Cinderborn'));
AF('icy', 'incFrost', 'prefix', WPN.concat(JWL, ['gloves']), [8, 16], TIERS('Chilled', 'Frosted', 'Rimed', 'Glacial', 'Winterborn'));
AF('charged', 'incStorm', 'prefix', WPN.concat(JWL, ['gloves']), [8, 16], TIERS('Static', 'Charged', 'Crackling', 'Thundering', 'Stormborn'));
AF('hollow', 'incVoid', 'prefix', WPN.concat(JWL, ['gloves']), [8, 16], TIERS('Dusky', 'Hollow', 'Umbral', 'Abyssal', 'Voidborn'));
AF('toxic', 'incVenom', 'prefix', WPN.concat(JWL, ['gloves']), [8, 16], TIERS('Tainted', 'Toxic', 'Venomous', 'Virulent', 'Plagueborn'));
AF('duelist', 'incMelee', 'prefix', WPN.concat(['gloves', 'ring']), [10, 20], TIERS("Squire's", "Duelist's", "Champion's", "Warlord's", "Legend's"));
AF('arcane', 'incSpell', 'prefix', WPN.concat(['helm', 'amulet']), [10, 20], TIERS("Apprentice's", "Adept's", "Mage's", "Archmage's", "Emberlord's"));
AF('mighty', 'incDmg', 'prefix', ['amulet', 'ring'], [5, 12], TIERS('Mighty', 'Powerful', 'Dominant', 'Overwhelming', 'Godly'), { weight: 7 });
AF('hale', 'life', 'prefix', ARM.concat(JWL), [8, 20], TIERS('Hale', 'Stout', 'Robust', 'Titanic', 'Colossal'), { scale: 'flat', weight: 14 });
AF('vital', 'lifePct', 'prefix', ['chest', 'amulet'], [4, 9], TIERS('Vital', 'Hardy', 'Enduring', 'Undying', 'Eternal'), { weight: 7 });
AF('plated', 'armor', 'prefix', ARM, [6, 14], TIERS('Studded', 'Plated', 'Fortified', 'Bulwark', 'Adamant'), { scale: 'flat', weight: 12 });
AF('warded', 'armorPct', 'prefix', ARM, [10, 25], TIERS('Warded', 'Reinforced', 'Bastion', 'Citadel', 'Unbreaking'));
AF('glowing', 'ember', 'prefix', ['helm', 'amulet', 'ring', 'chest'], [8, 16], TIERS('Glowing', 'Radiant', 'Luminous', 'Blazing', 'Sunlit'), { cap: 50 });   // ember is a resource: it grows a little, then stops
AF('deadly', 'critDmg', 'prefix', WPN.concat(['amulet', 'gloves']), [12, 26], TIERS('Deadly', 'Lethal', 'Murderous', 'Executioner\'s', 'Fatal'));
AF('precise', 'crit', 'prefix', WPN.concat(['gloves', 'ring', 'helm']), [1.5, 4], TIERS('Precise', 'Keen-eyed', 'Unerring', 'Sniper\'s', 'Fateful'), { scale: 'none', cap: 8 });
AF('swift', 'atkSpeed', 'prefix', WPN.concat(['gloves', 'ring']), [4, 9], TIERS('Swift', 'Quick', 'Rapid', 'Blurring', 'Lightning'), { scale: 'none', cap: 18 });
AF('chanting', 'castSpeed', 'prefix', WPN.concat(['amulet', 'helm']), [4, 9], TIERS('Chanting', 'Fluent', 'Eloquent', 'Rapturous', 'Unending'), { scale: 'none', cap: 18 });
const RES = (id, stat, n) => AF(id, stat, 'suffix', ARM.concat(JWL), [8, 16], TIERS('of ' + n[0], 'of ' + n[1], 'of ' + n[2], 'of ' + n[3], 'of ' + n[4]), { scale: 'none', cap: 30 });
RES('ofember', 'resFire', ['Embers', 'the Hearth', 'the Forge', 'the Furnace', 'the Sun']);
RES('offrost', 'resFrost', ['Frost', 'Winter', 'the Glacier', 'the Pole', 'Endless Winter']);
RES('ofstorm', 'resStorm', ['Sparks', 'Grounding', 'the Storm', 'the Tempest', 'the Thunder King']);
RES('ofshade', 'resVoid', ['Shade', 'the Veil', 'the Hollow', 'the Abyss', 'the Void']);
RES('ofcure', 'resVenom', ['Remedy', 'the Cure', 'Purity', 'the Antidote', 'the Unblighted']);
AF('ofprism', 'resAll', 'suffix', ['amulet', 'ring', 'chest'], [4, 8], TIERS('of Warding', 'of the Prism', 'of Shelter', 'of the Sanctum', 'of Immunity'), { scale: 'none', cap: 15, weight: 5 });
AF('ofregen', 'lifeRegen', 'suffix', ARM.concat(JWL), [.5, 1.5], TIERS('of Mending', 'of Healing', 'of Renewal', 'of the Troll', 'of the Phoenix'), { scale: 'flat' });
AF('ofleech', 'lifeOnHit', 'suffix', WPN.concat(['gloves', 'ring']), [1, 3], TIERS('of the Tick', 'of the Leech', 'of the Bat', 'of the Lamprey', 'of the Vampire'), { scale: 'flat' });
AF('ofthirst', 'leech', 'suffix', WPN.concat(['ring']), [.8, 2], TIERS('of Thirst', 'of Craving', 'of Hunger', 'of Famine', 'of the Bloodlord'), { scale: 'none', cap: 4, weight: 6 });
AF('offocus', 'emberRegen', 'suffix', ['helm', 'amulet', 'weapon', 'ring'], [1, 2.5], TIERS('of Focus', 'of Kindling', 'of the Flame', 'of the Pyre', 'of the Everburn'), { scale: 'none', cap: 5 });
AF('ofspeed', 'moveSpeed', 'suffix', ['boots'], [6, 12], TIERS('of Haste', 'of Speed', 'of the Wind', 'of the Gale', 'of the Comet'), { scale: 'none', cap: 20, weight: 16 });
AF('ofevasion', 'dodge', 'suffix', ['boots', 'legs', 'cloak'], [2, 5], TIERS('of Evasion', 'of Shadows', 'of the Fox', 'of the Phantom', 'of Mist'), { scale: 'none', cap: 10 });
AF('ofreadiness', 'cdr', 'suffix', ['helm', 'amulet', 'ring'], [4, 8], TIERS('of Readiness', 'of Alacrity', 'of Tempo', 'of the Hourglass', 'of Eternity'), { scale: 'none', cap: 14, weight: 7 });
AF('ofreach', 'area', 'suffix', ['amulet', 'chest', 'gloves'], [6, 12], TIERS('of Reach', 'of Breadth', 'of the Expanse', 'of Dominion', 'of the Horizon'), { scale: 'none', cap: 30 });
AF('ofgreed', 'goldFind', 'suffix', ['ring', 'amulet', 'helm', 'boots'], [10, 25], TIERS('of Coin', 'of Greed', 'of Plenty', 'of the Hoard', 'of Midas'), { scale: 'none', cap: 80, weight: 6 });
AF('offortune', 'magicFind', 'suffix', ['ring', 'amulet', 'helm', 'boots'], [6, 15], TIERS('of Luck', 'of Fortune', 'of Chance', 'of the Gambler', 'of Destiny'), { scale: 'none', cap: 40, weight: 6 });
AF('oflore', 'xpGain', 'suffix', ['helm', 'amulet'], [4, 10], TIERS('of Study', 'of Lore', 'of Wisdom', 'of the Sage', 'of Enlightenment'), { scale: 'none', cap: 20, weight: 5 });
AF('ofreaching', 'pickup', 'suffix', ['boots', 'gloves'], [20, 40], TIERS('of Grasping', 'of Reaching', 'of the Magnet', 'of Attraction', 'of Gathering'), { scale: 'none', cap: 80, weight: 5 });
AF('ofthorns', 'thorns', 'suffix', ['chest', 'legs'], [3, 8], TIERS('of Thorns', 'of Brambles', 'of Spikes', 'of the Porcupine', 'of the Iron Maiden'), { scale: 'flat' });
AF('offorce', 'knockback', 'suffix', WPN.concat(['gloves']), [10, 25], TIERS('of Force', 'of Impact', 'of the Ram', 'of the Avalanche', 'of the Titan'), { scale: 'none', cap: 60 });
AF('ofaffliction', 'statusChance', 'suffix', WPN.concat(['amulet', 'gloves']), [10, 25], TIERS('of Affliction', 'of Blight', 'of Torment', 'of Ruin', 'of Calamity'), { scale: 'none', cap: 60 });
AF('ofvolley', 'projectiles', 'suffix', ['weapon', 'amulet'], [1, 1], TIERS('of Volleys', 'of Volleys', 'of Barrages', 'of Barrages', 'of the Storm of Blades'), { scale: 'none', weight: 3, minIlvl: 8 });
AF('ofskill', 'rank:', 'suffix', ['amulet', 'helm', 'weapon', 'gloves'], [1, 1], TIERS('of Practice', 'of Skill', 'of Mastery', 'of Virtuosity', 'of Perfection'), { scale: 'none', weight: 5, minIlvl: 3,
  pick: R => { const ids = Object.keys(REG.skills).filter(id => !REG.skills[id].noRank); return 'rank:' + R.pick(ids); } });
AF('ofall', 'allSkills', 'suffix', ['amulet'], [1, 1], TIERS('of the Adept', 'of the Adept', 'of the Master', 'of the Master', 'of the Deep'), { scale: 'none', weight: 2, minIlvl: 15 });
AF('ofdodging', 'dodgeCharges', 'suffix', ['boots', 'cloak'], [1, 1], TIERS('of Tumbling', 'of Tumbling', 'of the Acrobat', 'of the Acrobat', 'of the Wind Dancer'), { scale: 'none', weight: 3, minIlvl: 10 });
/* ---- deep families: words the language only learns on the way down ---- */
AF('slaying', 'incElite', 'prefix', WPN.concat(['ring', 'amulet', 'gloves']), [10, 20], TIERS("Slayer's", "Hunter's", "Stalker's", "Butcher's", "Nemesis'"), { minIlvl: 20, weight: 8 });
AF('offallen', 'lifeOnKill', 'suffix', WPN.concat(['ring', 'gloves', 'amulet']), [3, 8], TIERS('of the Fallen', 'of Harvest', 'of Reaping', 'of the Scythe', 'of the Reaper'), { scale: 'flat', minIlvl: 20, weight: 8 });
AF('ofstoking', 'emberOnHit', 'suffix', WPN.concat(['gloves', 'ring']), [.5, 1.2], TIERS('of Tinder', 'of Stoking', 'of the Bellows', 'of the Kiln', 'of the Bonfire'), { scale: 'none', cap: 3, minIlvl: 24, weight: 6 });
AF('regicide', 'incBoss', 'prefix', WPN.concat(['amulet', 'ring']), [12, 24], TIERS("Kingslayer's", 'Tyrantbane', "Usurper's", 'Regicidal', "Godslayer's"), { minIlvl: 30, weight: 7 });
AF('lingering', 'incDot', 'prefix', WPN.concat(['gloves', 'amulet', 'helm']), [12, 24], TIERS('Lingering', 'Seething', 'Wasting', 'Consuming', 'Relentless'), { minIlvl: 30, weight: 8 });
AF('ofthrift', 'costRed', 'suffix', ['helm', 'amulet', 'ring', 'weapon'], [4, 8], TIERS('of Thrift', 'of Economy', 'of Frugality', 'of the Ascetic', 'of the Hermit'), { scale: 'none', cap: 15, minIlvl: 30, weight: 6 });
AF('ofrebound', 'dodgeCd', 'suffix', ['boots', 'cloak', 'legs'], [10, 20], TIERS('of Recovery', 'of Rebound', 'of the Cat', 'of the Eel', 'of Quicksilver'), { scale: 'none', cap: 40, minIlvl: 36, weight: 7 });
AF('ofpiercing', 'pierce', 'suffix', WPN.concat(['gloves']), [1, 1], TIERS('of Piercing', 'of Piercing', 'of Lancing', 'of Lancing', 'of the Needle'), { scale: 'none', minIlvl: 40, weight: 3 });
AF('ofarcing', 'chains', 'suffix', WPN.concat(['amulet']), [1, 1], TIERS('of Arcing', 'of Arcing', 'of Forking', 'of Forking', 'of the Tempest'), { scale: 'none', minIlvl: 45, weight: 3 });
AF('searing', 'statusDmg', 'prefix', WPN.concat(['gloves', 'amulet', 'ring']), [15, 30], TIERS('Scathing', 'Searing', 'Blistering', 'Excruciating', 'Agonizing'), { minIlvl: 45, weight: 7 });
AF('sweeping', 'incAoe', 'prefix', WPN.concat(['amulet', 'helm', 'gloves']), [10, 20], TIERS('Sweeping', 'Blasting', 'Ravaging', 'Cataclysmic', 'Apocalyptic'), { minIlvl: 45, weight: 7 });
AF('fletched', 'incProj', 'prefix', WPN.concat(['gloves', 'ring']), [10, 20], TIERS('Fletched', 'Soaring', 'Streaking', 'Hailing', 'Starfalling'), { minIlvl: 45, weight: 7 });
AF('ofdraughts', 'potionHeal', 'suffix', ['amulet', 'chest', 'ring'], [15, 30], TIERS('of Draughts', 'of Tonics', 'of Elixirs', 'of the Alchemist', 'of the Panacea'), { scale: 'none', cap: 80, minIlvl: 52, weight: 6 });
AF('ofthedeep', 'moreDmg', 'suffix', ['amulet'], [3, 6], TIERS('of the Deep', 'of the Depths', 'of the Abyss', 'of the Underdark', 'of the Bottomless'), { scale: 'none', cap: 12, minIlvl: 60, weight: 3 });
AF('offlask', 'potionCharges', 'suffix', ['amulet', 'chest'], [1, 1], TIERS('of the Flask', 'of the Flask', 'of the Cellar', 'of the Cellar', 'of the Endless Cask'), { scale: 'none', minIlvl: 80, weight: 2 });
/* ---- hybrids: two stats on one line, each at 60% of its own affix (the second one rolls at the same quality) ---- */
const HY = (id, a, b, kind, slots, names, minIlvl) => { const A0 = REG.itemAffixes[a]; return AF(id, A0.stat, kind, slots, [A0.v[0] * .6, A0.v[1] * .6], names, { scale: A0.scale, cap: A0.cap && A0.cap * .6, minIlvl, weight: 6, also: [[b, .6]] }); };
HY('frostember', 'fiery', 'icy', 'suffix', WPN.concat(JWL, ['gloves']), TIERS('of Frost and Ember', 'of Rime and Cinder', 'of Ice and Fire', 'of the Two Seasons', 'of the Equinox'), 20);
HY('stormshade', 'charged', 'hollow', 'suffix', WPN.concat(JWL, ['gloves']), TIERS('of Storm and Shadow', 'of Thunder and Dusk', 'of the Black Storm', 'of the Eclipse', 'of the Starless Storm'), 20);
HY('bulwark', 'hale', 'plated', 'prefix', ARM, TIERS('Bulwarked', 'Ironhearted', 'Stalwart', 'Unyielding', 'Mountainous'), 20);
HY('plaguefire', 'toxic', 'fiery', 'suffix', WPN.concat(JWL, ['gloves']), TIERS('of Pyre and Plague', 'of Ash and Venom', 'of the Burning Blight', 'of the Pestilent Sun', 'of the Last Plague'), 30);
HY('assassin', 'precise', 'deadly', 'prefix', WPN.concat(['gloves', 'amulet']), TIERS("Assassin's", "Cutthroat's", "Headhunter's", "Deathdealer's", "Fatebreaker's"), 30);
HY('spellbound', 'duelist', 'arcane', 'prefix', WPN, TIERS('Spellbound', "Battlemage's", "Runeknight's", "Warmage's", "Spellblade's"), 30);
HY('ofthehare', 'ofspeed', 'ofevasion', 'suffix', ['boots'], TIERS('of the Hare', 'of the Stag', 'of the Wolf', 'of the Panther', 'of the Wind Spirit'), 30);
HY('ofthewarden', 'ofprism', 'ofregen', 'suffix', ['chest', 'amulet', 'ring'], TIERS('of the Warden', 'of the Sentinel', 'of the Keeper', 'of the Aegis', 'of the Undying Watch'), 45);
HY('ofthestrix', 'ofleech', 'ofthirst', 'suffix', WPN.concat(['ring']), TIERS('of the Strix', 'of the Nosferat', 'of the Blood Moon', 'of the Crimson Court', 'of the Vampire Lord'), 45);
HY('oftheseer', 'oflore', 'offortune', 'suffix', ['helm', 'amulet'], TIERS('of the Scholar', 'of the Seeker', 'of the Oracle', 'of the Seer', 'of the All-Seeing'), 45);

/* ---------- affix tiers: the roll IS the tier ----------
 * An affix's base range [a, b] is five tiers, a fifth of it each; deep tiers keep stacking fifths above b (T6, T7...
 * named by the language). Item level unlocks tiers (tierIlvl) and an item rolls one of the five best it allows, the
 * best the rarest, so the pips read the same at any depth: orange is the best tier that item level rolls, and each
 * color below it one tier less (grey: four or more). The value is (a + step * (tier + q)) * k(item level), q the roll
 * inside its tier. Flat affixes grow with SCALE.ilvl like monsters; percent affixes keep growing forever (2.5% of their
 * base per item level to 61, then 0.5%); 'none' ones only by tier, up to their cap (a capped affix's tiers stop where
 * they pass it). A greater affix is x1.5, even past its cap. */
const TIER_W = [1.1, 1.05, 1, .95, .9];   // a gentle lean: the best tier is the rarest, and an average roll stays near the middle of the range
const tierIlvl = t => t < 4 ? 1 : t === 4 ? 6 : Math.round(12 + 12 * (t - 4) + 1.5 * (t - 4) * (t - 4));   // T1-T4 from the start, T5 at 6, T6 at 26, T7 42, T8 62, T9 84, T10 110 ... T26 near 1000
const TIER_TOP = new Map();
function tierTop(il) { il = Math.max(1, Math.floor(il)); let t = TIER_TOP.get(il); if (t !== undefined) return t; t = 3; while (tierIlvl(t + 1) <= il) t++; if (TIER_TOP.size > 2000) TIER_TOP.clear(); TIER_TOP.set(il, t); return t; }
const pctGrow = il => il <= 61 ? 1 + (il - 1) * .025 : 2.5 + (il - 61) * .005;
const affixK = (A, il) => A.scale === 'flat' ? SCALE.ilvl(il) : A.scale === 'pct' ? pctGrow(il) : 1;
const affixStep = A => (A.v[1] - A.v[0]) / 5;
const affixInt = A => A.stat.startsWith('rank:') || !!(STATS[A.stat] && STATS[A.stat].f === 'plus');
/** the best tier affix A rolls at item level il */
function affixTop(A, il) {
  let t = tierTop(il); const s = affixStep(A);
  if (s > 0 && A.cap) { const k = affixK(A, il); while (t > 4 && (A.v[0] + s * t) * k >= A.cap) t--; }
  return t;
}
function roundAffix(A, v) {
  if (affixInt(A)) return Math.max(1, Math.round(v));
  const dec = A.v[1] - A.v[0] < 3 && A.scale !== 'flat' && Math.abs(v) < 100;
  return Math.max(A.v[0] < 1 ? .1 : 1, dec ? Math.round(v * 10) / 10 : Math.round(v));
}
/** the unrounded value of affix A at tier t, roll q (0..1), item level il; g: greater */
function affixRaw(A, t, q, il, g) {
  let v = (A.v[0] + affixStep(A) * (t + q)) * affixK(A, il);
  if (A.cap) v = Math.min(v, A.cap);
  return g ? v * 1.5 : v;
}
const affixValue = (A, t, q, il, g, k = 1) => roundAffix(A, affixRaw(A, t, q, il, g) * k);
/** greater affixes: none before item level 30, then 3% of lines, up to one in five deep down */
const greaterChance = il => il < 30 ? 0 : Math.min(.2, .03 + (il - 30) * .0008);
/** the second stat of a hybrid or a fused line: partner B as far below its own best tier (d) as the first, at share k */
function alsoRoll(B, d, q, il, g, k) { const t = Math.max(0, affixTop(B, il) - d); return { id: B.id, stat: B.stat, v: affixValue(B, t, q, il, g, k), k, tier: t }; }
/** roll affix A at item level ilvl: { id, stat, v, tier, q, g, also } */
function rollAffix(A, ilvl, R) {
  const top = affixTop(A, ilvl), lo = Math.max(0, top - 4); let t = top, sum = 0;
  for (let i = lo; i <= top; i++) sum += TIER_W[i - lo];
  let x = R() * sum; for (let i = lo; i <= top; i++) { x -= TIER_W[i - lo]; if (x <= 0) { t = i; break; } }
  const q = Math.round(R() * 999) / 1000, g = R() < greaterChance(ilvl);
  const a = { id: A.id, stat: A.pick ? A.pick(R) : A.stat, v: affixValue(A, t, q, ilvl, g), tier: t, q };
  if (g) a.g = 1;
  for (const [bid, k] of A.also || []) { const B = REG.itemAffixes[bid]; if (B) (a.also || (a.also = [])).push(alsoRoll(B, top - t, q, ilvl, g, k)); }
  return a;
}
/** fuse a rolled line with partner B (the deep game's hybrids: any two words of the language on one line) */
function fuseAffix(a, A, B, ilvl) {
  const k = .6;
  a.k = k; a.v = affixValue(A, a.tier, a.q, ilvl, a.g, k);
  (a.also || (a.also = [])).push(alsoRoll(B, affixTop(A, ilvl) - a.tier, a.q, ilvl, a.g, k));
  return a;
}
const fuseChance = il => il < 60 ? 0 : Math.min(.25, (il - 60) * .002 + .03);
/** an old save's line (no q): read its tier and roll back out of its value */
function affixMigrate(a, A, il) {
  if (a.q !== undefined || !A) return a;
  const s = affixStep(A), top = affixTop(A, il);
  if (s <= 0) { a.tier = top; a.q = .5; return a; }
  const x = (a.v / ((a.k || 1) * affixK(A, il)) - A.v[0]) / s, t = clamp(Math.floor(x), 0, top);
  a.tier = t; a.q = clamp(x - t, 0, .999); return a;
}
/** a tier's name: the five hand-written ones, then the language's (Thunderwrought, of the Rimeheart...) */
function affixTierName(A, t) {
  if (t < 5 || !A.names) return A.names ? A.names[Math.max(0, Math.min(t, A.names.length - 1))] : '';
  const h = hashStr(A.id), roots = DEEP_ROOTS[statTheme(A.stat)] || DEEP_ROOTS.deep, root = roots[(h + t * 5) % roots.length], cyc = Math.floor((t - 5) / 30);
  return (A.kind === 'prefix' ? root + DEEP_ADJ[(h * 3 + t * 7) % DEEP_ADJ.length] : 'of the ' + root + DEEP_NOUN[(h * 5 + t * 3) % DEEP_NOUN.length]) + (cyc ? ' ' + ROMAN(cyc + 1) : '');
}
/** growth of a fixed stat (a unique's, a base's implicit) with item level: flat stats like weapons, damage and life
 *  percents gently, the rest never. Ember is a resource, not item power: it never grows (a deep Crown of the Deep once
 *  gave a hundred thousand of it) */
const GROW_PCT = /^(dmgPct|incDmg|incMelee|incSpell|incProj|incAoe|incDot|incPhys|incFire|incFrost|incStorm|incVoid|incVenom|incElite|incBoss|lifePct|armorPct|critDmg|statusDmg)$/;
const GROW_FLAT = /^(life|lifeRegen|lifeOnHit|lifeOnKill|dmgFlat|armor|thorns)$/;
const statGrowth = (st, il) => GROW_FLAT.test(st) ? SCALE.ilvl(il) : GROW_PCT.test(st) ? pctGrow(il) : 1;
/**
 * What the tooltips show about a rolled line: { A, t (tier, 0-based), pos (0..4: 4 is the best tier its item level
 * rolls, one less per tier below; 4 for fixed lines), name, lo, hi (its tier's range at this item level), g, fixed,
 * also: [{ lo, hi }] (a hybrid's second stat) }, or null for a unique's line
 */
function affixInfo(it, a) {
  const A = REG.itemAffixes[a.id]; if (!A) return null;
  const il = it.ilvl || 1; affixMigrate(a, A, il);
  const fixed = affixStep(A) <= 0, t = a.tier, pos = fixed ? 4 : clamp(4 - (affixTop(A, il) - t), 0, 4);   // orange: the best tier this item level rolls
  const info = { A, t, pos, fixed, g: !!a.g, name: affixTierName(A, t), lo: affixValue(A, t, 0, il, a.g, a.k || 1), hi: affixValue(A, t, .999, il, a.g, a.k || 1), also: [] };
  for (const b of a.also || []) { const B = REG.itemAffixes[b.id]; if (B) info.also.push({ lo: affixValue(B, b.tier, 0, il, a.g, b.k || 1), hi: affixValue(B, b.tier, .999, il, a.g, b.k || 1) }); }
  return info;
}
/** a line's text (a hybrid reads both stats) */
const affixText = a => statText(a.stat, a.v) + (a.also ? a.also.map(b => ' & ' + statText(b.stat, b.v)).join('') : '');
/** a value the way the range readout prints it: 2.5, 38, 12.3K */
const fmtV = v => Math.abs(v) < 10 && v % 1 ? v.toFixed(1) : fmt(v);
/** a line raised from item level 'from' to 'to' (the smith's temper): it keeps its place in its window and its roll */
function rescaleAffix(a, from, to) {
  const A = REG.itemAffixes[a.id];
  if (!A) { const k = statGrowth(a.stat, to) / statGrowth(a.stat, from); if (k !== 1) { const v = a.v * k; a.v = Math.abs(v) < 10 ? Math.round(v * 10) / 10 : Math.round(v); } return a; }
  affixMigrate(a, A, from);
  const d = affixTop(A, from) - a.tier; a.tier = clamp(affixTop(A, to) - d, 0, affixTop(A, to));
  a.v = affixValue(A, a.tier, a.q, to, a.g, a.k || 1);
  for (const b of a.also || []) { const B = REG.itemAffixes[b.id]; if (!B) continue; const db = affixTop(B, from) - b.tier; b.tier = clamp(affixTop(B, to) - db, 0, affixTop(B, to)); b.v = affixValue(B, b.tier, a.q, to, a.g, b.k || 1); }
  return a;
}

/* ---------- generation ---------- */
function pickBase(slot, ilvl, R) {
  const opts = Object.values(REG.itemBases).filter(b => (b.minIlvl || 1) <= ilvl + 1 && (!slot || b.slot === slot || (slot === 'ring2' && b.slot === 'ring')));
  return R.weighted(opts, b => (b.weight || 10) * (1 + Math.max(0, (b.minIlvl || 1) - ilvl * .5) * 0));
}
/** a rarity for an item level: about half common, a third magic, one in ten rare, one in a hundred legendary. mf is item
 *  rarity (%), boost shifts the odds up (elites, bosses, gambles). Commons are hidden by the default loot filter, so this
 *  is what sets how often a pack leaves something worth a look */
function rollRarity(ilvl, R, mf = 0, boost = 0) {
  const k = 1 + mf / 100;
  const w = [52, 32 * k, (8.5 + boost * 20) * k, (1.1 + boost * 6) * k * (ilvl >= 3 ? 1 : 0), (.35 + boost * 2) * k * (ilvl >= 5 ? 1 : 0)];
  let s = w.reduce((a, b) => a + b, 0), x = R() * s;
  for (let i = 0; i < w.length; i++) { x -= w[i]; if (x <= 0) return i; }
  return 0;
}
const RARE_A = ['Grim', 'Doom', 'Blood', 'Storm', 'Dread', 'Soul', 'Bone', 'Ember', 'Rune', 'Gloom', 'Wraith', 'Night', 'Ash', 'Iron', 'Raven', 'Hollow', 'Dusk', 'Viper', 'Oath', 'Star'];
const RARE_B = { weapon: ['Bite', 'Edge', 'Song', 'Fang', 'Razor', 'Thirst', 'Cleaver', 'Spike'], helm: ['Crown', 'Visage', 'Cowl', 'Brow', 'Mask', 'Hood'], chest: ['Shell', 'Hide', 'Coat', 'Carapace', 'Mantle', 'Wrap'],
  gloves: ['Grip', 'Hand', 'Claw', 'Fist', 'Touch'], legs: ['Stride', 'Legs', 'Greaves', 'Pace'], boots: ['Stride', 'Tread', 'Step', 'Trail', 'Road'], cloak: ['Shroud', 'Wing', 'Veil', 'Mantle', 'Banner'],
  amulet: ['Heart', 'Eye', 'Charm', 'Talisman', 'Star', 'Tear'], ring: ['Loop', 'Band', 'Coil', 'Circle', 'Knot', 'Spiral'] };
/**
 * make an item. o: { ilvl, slot, base, rarity, R, power, unique, grade, el (what dropped it: deep loot leans to that
 * element), hue (recolor its cloth; by default the depth's own hue past the planned depths) }
 */
function makeItem(o = {}) {
  const R = o.R || rnd, ilvl = Math.max(1, Math.floor(o.ilvl || ED.depth || 1));
  if (o.unique || o.rarity === 4) {
    const pool = Object.values(REG.uniques).filter(u => (u.minIlvl || 1) <= ilvl + 2), id = o.unique || (pool.length ? R.pick(pool).id : null);
    const u = id && makeUnique(id, ilvl, R); if (u) return u;
    return makeItem(Object.assign({}, o, { rarity: 3, unique: null }));
  }
  const base = o.base ? REG.itemBases[o.base] : pickBase(o.slot, ilvl, R);
  const rarity = o.rarity === undefined ? rollRarity(ilvl, R) : Math.min(3, o.rarity);
  const gt = gradeTop(ilvl), grade = o.grade !== undefined ? o.grade : gt > 0 ? (R() < .7 ? gt : gt - 1) : 0, G = gradeInfo(grade);
  const eh = ilvl > 15 && o.el && o.el !== 'phys' && REG.elements[o.el] ? o.el : null;   // the element of the monster that dropped it
  const it = { uid: itemUid++, base: base.id, slot: base.slot, rarity, ilvl, affixes: [], implicit: [], look: JSON.parse(JSON.stringify(base.look || {})), name: base.name };
  if (grade) it.grade = grade;
  const bs = itemBase(it, ilvl);
  if (bs.dmg) { it.dmg = bs.dmg; it.el = base.el || 'phys'; }
  if (bs.armor) it.armor = bs.armor;
  if (base.implicit) for (const k in base.implicit) it.implicit.push({ stat: k, v: implicitValue(k, base.implicit[k], ilvl) });
  if (it.armor) it.implicit.unshift({ stat: 'armor', v: it.armor });
  // colors: a piece of cloth, leather or metal in one of the base's colors. Past the planned depths loot wears the
  // colors of the depth it dropped in (its hue turns the cloth, never the metal), like that depth's monsters
  if (base.colors) {
    const hue = o.hue !== undefined ? o.hue : ilvl > 15 && ED.L && ED.L.kind === 'level' ? ED.L.hue || 0 : 0, key = base.lookKey || 'cloth';
    let c = R.pick(base.colors); if (hue && !METAL.includes(c)) c = hueShift(c, hue);
    it.look.colors = Object.assign(it.look.colors || {}, { [key]: c }); if (key === 'cape') it.look.colors.capeIn = E.shade(c, -.4); if (key === 'cloth' && it.look.armor) it.look.colors.metal = R.pick(METAL);
  }
  if (base.gems) it.gem = R.pick(base.gems);
  // affixes: no stat twice (a hybrid's second stat counts), the dropping monster's element three times as likely
  const [n0, n1] = RARITY[rarity].n, n = R.int(n0, n1), taken = new Set();
  const free = A => !taken.has(A.stat) && !(A.also || []).some(([b]) => REG.itemAffixes[b] && taken.has(REG.itemAffixes[b].stat));
  const elw = A => eh && (A.stat === 'inc' + cap(eh) || A.stat === 'res' + cap(eh)) ? 3 : 1;
  const pool = Object.values(REG.itemAffixes).filter(A => (A.minIlvl || 1) <= ilvl && A.slots.includes(it.slot));
  for (let i = 0; i < n; i++) {
    const kindWant = i % 2 === 0 ? 'prefix' : 'suffix';
    const opts = pool.filter(A => free(A) && (rarity < 2 || A.kind === kindWant || R() < .3));
    if (!opts.length) break;
    const A = R.weighted(opts, a => (a.weight || 10) * elw(a)), a = rollAffix(A, ilvl, R);
    taken.add(A.stat); for (const b of a.also || []) taken.add(b.stat);
    // deep down any two words of the language may fuse on one line (a rare or better; never a +1 line)
    if (rarity >= 2 && !a.also && !affixInt(A) && R() < fuseChance(ilvl)) {
      const mates = pool.filter(B => B !== A && free(B) && !B.also && !B.pick && !affixInt(B));
      if (mates.length) { const B = R.weighted(mates, b => (b.weight || 10) * elw(b)); fuseAffix(a, A, B, ilvl); taken.add(B.stat); }
    }
    it.affixes.push(a);
  }
  // element: a weapon with an elemental affix takes that element; deep down, often the element of what dropped it
  if (it.slot === 'weapon' && it.el === 'phys') { const ea = it.affixes.find(a => /^inc(Fire|Frost|Storm|Void|Venom)$/.test(a.stat)); if (ea && rarity >= 2) it.el = ea.stat.slice(3).toLowerCase(); else if (eh && R() < .5) it.el = eh; }
  // legendary power: a hand-made one, or past depth 15 more and more often one the language composes
  if (rarity === 3) {
    let pid = o.power && powerSpec(o.power) ? o.power : null;
    if (!pid) {
      const hand = Object.values(REG.powers).filter(p => !p.composed && (p.minIlvl || 1) <= ilvl && (!p.slots || p.slots.includes(it.slot)));
      pid = ilvl > 15 && (!hand.length || R() < cxShare(ilvl)) ? cxRoll(it.slot, ilvl, R, eh || (it.el !== 'phys' ? it.el : null)) : hand.length ? R.pick(hand).id : null;
    }
    if (pid && powerSpec(pid)) it.power = pid; else it.rarity = 2;
  }
  it.name = itemName(it, R);
  it.value = itemValue(ilvl, it.rarity, it);
  if (G && it.look) gradeLook(it, G);
  if (it.look && (it.rarity >= 2 || it.el !== (base.el || 'phys'))) tintLegend(it, R);
  return it;
}
function makeUnique(id, ilvl, R) {
  const U = REG.uniques[id]; if (!U) return null;
  const base = REG.itemBases[U.base]; if (!base) return null;
  const pw = U.power && /^cx\.[^.]+\.[^.]+\.[^.]+$/.test(U.power) ? U.power + '.' + cxRankFor(ilvl) : U.power;   // a composed power without a rank takes the item level's
  const it = { uid: itemUid++, base: base.id, slot: base.slot, rarity: 4, ilvl, affixes: [], implicit: [], look: JSON.parse(JSON.stringify(Object.assign({}, base.look || {}, U.look || {}))), name: U.name, unique: id, power: pw, flavor: U.flavor };
  const bs = itemBase(it, ilvl);
  if (bs.dmg) { it.dmg = bs.dmg; it.el = U.el || base.el || 'phys'; }
  if (bs.armor) { it.armor = bs.armor; it.implicit.push({ stat: 'armor', v: it.armor }); }
  // fixed stats grow with the item level the way their kind of affix does (flat ones like weapons, damage percents gently)
  for (const [stat, v] of U.stats || []) { const x = v * statGrowth(stat, ilvl); it.affixes.push({ id: 'u', stat, v: Math.abs(x) < 10 ? Math.round(x * 10) / 10 : Math.round(x) }); }
  if (base.gems) it.gem = U.gem || base.gems[0];
  if (pw) powerSpec(pw);
  it.value = itemValue(ilvl, 4, it);
  return it;
}
/** an item's base damage and armor at item level il: its grade and a unique's premium included */
function itemBase(it, il) {
  const base = REG.itemBases[it.base] || {}, G = gradeInfo(it.grade), k = SCALE.ilvl(il) * (G ? G.k : 1), u = it.rarity === 4;
  return { dmg: base.dmg ? [Math.round(base.dmg[0] * k * (u ? 1.15 : 1)), Math.round(base.dmg[1] * k * (u ? 1.15 : 1))] : null, armor: base.armor ? Math.round(base.armor * k * (u ? 1.2 : 1)) : 0 };
}
/** a base's implicit at an item level: it grows like a unique's fixed stat */
const implicitValue = (st, v, il) => { const x = v * statGrowth(st, il); return Math.abs(x) < 10 ? Math.round(x * 10) / 10 : Math.round(x); };
/**
 * raise an item to item level 'to' (the smith's temper): base damage and armor, implicits, every line and a composed
 * power's rank follow. Lines keep their place in their windows and their rolls, so the pips read the same after
 */
function rescaleItem(it, to) {
  const from = it.ilvl || 1; to = Math.floor(to); if (!(to > from)) return it;
  const b = itemBase(it, to), base = REG.itemBases[it.base] || {};
  if (b.dmg) it.dmg = b.dmg;
  if (b.armor) it.armor = b.armor;
  for (const a of it.implicit) if (a.stat === 'armor') { if (b.armor) a.v = b.armor; } else if (base.implicit && base.implicit[a.stat] !== undefined) a.v = implicitValue(a.stat, base.implicit[a.stat], to);
  for (const a of it.affixes) rescaleAffix(a, from, to);
  if (it.power && it.power.startsWith('cx.')) { it.power = it.power.replace(/\.\d+$/, '') + '.' + cxRankFor(to); powerSpec(it.power); }
  it.ilvl = to; it.value = itemValue(to, it.rarity, it);
  return it;
}
/** what an item sells for: it follows the gold curve, so shops stay meaningful at any depth (greater lines add to it) */
function itemValue(ilvl, rarity, it) { const gr = it ? it.affixes.filter(a => a.g).length : 0; return Math.round(4 * SCALE.gold(ilvl) * (1 + ilvl * .2) * RARITY[rarity].value * (1 + gr * .25)); }
/** rares, legendaries and elemental weapons get a matching finish */
function tintLegend(it, R) {
  const c = it.look.colors || (it.look.colors = {});
  if (it.slot === 'weapon' && it.el !== 'phys') { const e = EL(it.el); c.metal = E.mix(c.metal || '#dce8f1', e.light, .45); c.metalDk = E.mix(c.metalDk || '#7f93ab', e.dark, .5); if (it.look.weapon === 'staff') c.orb = e.color; }
  if (it.slot === 'chest' && it.rarity >= 3 && !c.trim) c.trim = R.pick(['#e8c040', '#c8d8f0', '#ff8a4a']);
}
function itemName(it, R) {
  const base = REG.itemBases[it.base], G = gradeInfo(it.grade);
  if (it.rarity === 1) {
    const find = kind => it.affixes.find(a => REG.itemAffixes[a.id] && REG.itemAffixes[a.id].kind === kind), pre = find('prefix'), suf = find('suffix');
    return (pre ? affixTierName(REG.itemAffixes[pre.id], pre.tier) + ' ' : '') + base.name + (suf ? ' ' + affixTierName(REG.itemAffixes[suf.id], suf.tier) : '');
  }
  if (it.rarity === 2) { const b = RARE_B[it.slot === 'ring2' ? 'ring' : it.slot] || ['Relic']; return R.pick(RARE_A) + ' ' + R.pick(b); }
  if (it.rarity === 3) { const pw = powerSpec(it.power); return pw ? pw.name + (pw.noun ? '' : ' ' + base.name) : base.name; }
  return (G ? G.name + ' ' : '') + base.name;
}
/** a weapon's damage line: '12.3K-20.1K Frost Damage' */
const dmgText = it => fmt(it.dmg[0]) + '-' + fmt(it.dmg[1]) + ' ' + (it.el && it.el !== 'phys' ? EL(it.el).name + ' ' : '') + 'Damage';
/** tooltip lines: [{ t, c }] */
function itemLines(it) {
  const out = [], rc = RARITY[it.rarity].color, base = REG.itemBases[it.base], G = gradeInfo(it.grade);
  out.push({ t: it.name, c: rc, big: true });
  out.push({ t: RARITY[it.rarity].name + ' ' + (G ? G.name + ' ' : '') + (base ? base.name : '') + '  •  item level ' + fmt(it.ilvl), c: '#9a90b0' });
  if (it.dmg) out.push({ t: dmgText(it), c: '#ffffff' });
  for (const a of it.implicit) out.push({ t: statText(a.stat, a.v), c: '#c8c0d8' });
  if (it.implicit.length && it.affixes.length) out.push({ t: '', c: '#000', sep: true });
  for (const a of it.affixes) out.push({ t: (a.g ? '★ ' : '') + affixText(a), c: a.g ? '#ffe070' : '#8ab4ff' });
  const pw = powerSpec(it.power); if (pw) { out.push({ t: '', sep: true }); for (const l of E.font.wrap(pw.desc, 150)) out.push({ t: l, c: '#ff9a4a' }); }
  if (it.flavor) out.push({ t: it.flavor, c: '#a89878' });
  out.push({ t: 'Sells for ' + fmt(it.value) + ' gold', c: '#8a8070' });
  return out;
}

/* ---------- equipping ---------- */
statSource((h, add) => {
  for (const s of SLOTS) {
    const it = h.gear[s]; if (!it) continue;
    for (const a of it.implicit) if (a.stat !== 'armor') add(a.stat, a.v);
    if (it.armor) add('armor', it.armor);
    for (const a of it.affixes) { add(a.stat, a.v); if (a.also) for (const b of a.also) add(b.stat, b.v); }
    const pw = powerSpec(it.power); if (pw && pw.stats) for (const k in pw.stats) add(k, pw.stats[k]);
  }
});
/** the powers he wears (a composed one is built the first time it is seen, e.g. from a save) and the composed ones' state */
function refreshPowers(h) {
  h.powers = SLOTS.map(s => h.gear[s] && h.gear[s].power).filter(id => id && powerSpec(id));
  h._cx = h.powers.map(cxParse).filter(Boolean);
}
/** put an item on (from the bag). Returns the item it replaced (now in the bag) */
function equip(h, it, slot) {
  slot = slot || (it.slot === 'ring' ? (!h.gear.ring ? 'ring' : !h.gear.ring2 ? 'ring2' : 'ring') : it.slot);
  const i = h.bag.indexOf(it); if (i >= 0) h.bag.splice(i, 1);
  const old = h.gear[slot]; h.gear[slot] = it;
  if (old) h.bag.push(old);
  refreshPowers(h); computeStats(h); dressHero(h); sfx('pickup', { vol: .5 });
  return old;
}
function unequip(h, slot) { const it = h.gear[slot]; if (!it || h.bag.length >= BAG_MAX) return; delete h.gear[slot]; h.bag.push(it); refreshPowers(h); computeStats(h); dressHero(h); }
const BAG_MAX = 40;

/* ---------- drops on the ground ---------- */
// ED.drops: { kind: 'item' | 'gold' | 'potion', item, n, x, y, z, vx, vy, vz, t, rest }
function dropLoot(kind, x, y, o = {}) {
  const a = Math.random() * TAU, sp = 20 + Math.random() * 40;
  const d = Object.assign({ kind, x, y, z: 8, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 110 + Math.random() * 50, t: 0, rest: false, bounces: 0 }, o);
  ED.drops.push(d);
  if (kind === 'item' && d.item.rarity >= 3) { sfx(d.item.rarity === 4 ? 'secret' : 'powerup', { vol: .7 }); notify(RARITY[d.item.rarity].name.toUpperCase() + ' DROPPED: ' + d.item.name, RARITY[d.item.rarity].color, 3); }
  else if (kind === 'item' && d.item.rarity === 2) sfx('key', { vol: .4 });
  return d;
}
/** what a dead monster leaves: gold, potions, items (champions, rares and bosses much more) */
BUS.on('kill', e => {
  const m = e.tgt; if (m.team !== 'foe' || m.noLoot) return;
  const h = ED.hero, mf = ((h && h.stats.magicFind) || 0) + TUNE.rarityBoost, gf = (h && h.stats.goldFind) || 0, depth = m.level || ED.depth || 1, lk = DIFF.loot * TUNE.dropChance;   // (TUNE: Tuning's Loot)
  const nItems = m.elite ? Math.round((m.boss ? 5 + rnd.int(0, 3) : m.elite === 2 ? 2 + rnd.int(0, 1) : rnd.chance(.6) ? 1 : 0) * TUNE.eliteLoot) : rnd.chance(.1 * lk) ? 1 : 0;
  for (let i = 0; i < nItems; i++) dropLoot('item', m.x, m.y, { item: makeItem({ ilvl: depth + (m.elite ? 1 : 0), el: m.el, rarity: m.boss && i === 0 ? 3 : rollRarity(depth, rnd, mf, m.boss ? .6 : m.elite === 2 ? .35 : m.elite ? .15 : 0) }) });   // (el: deep loot leans to its killer's element)
  if (rnd.chance(m.elite ? .9 : .32 * lk)) { const n = Math.max(1, Math.round((3 + rnd() * 7) * TUNE.goldDrop * SCALE.gold(depth) * (1 + gf / 100) * (m.elite ? 3 : 1) * (m.boss ? 8 : 1))); const piles = m.boss ? 6 : m.elite ? 3 : 1; for (let i = 0; i < piles; i++) dropLoot('gold', m.x, m.y, { n: Math.ceil(n / piles) }); }
  if (h && rnd.chance((m.elite ? .35 : .035) * TUNE.potionDrop) && h.potions + ED.drops.filter(d => d.kind === 'potion').length < h.maxPotions) dropLoot('potion', m.x, m.y);
});
const pickupR = h => 12 * TUNE.pickupRadius * (1 + ((h && h.stats.pickup) || 0) / 100);
function updateDrops(dt) {
  const h = ED.hero, map = ED.L && ED.L.map;
  for (let i = ED.drops.length - 1; i >= 0; i--) {
    const d = ED.drops[i]; d.t += dt;
    if (!d.rest) {
      d.vz -= 420 * TUNE.gravity * dt; d.z += d.vz * dt; const nx = d.x + d.vx * dt, ny = d.y + d.vy * dt;
      if (map && map.solidAt(nx, ny)) { d.vx *= -.5; d.vy *= -.5; } else { d.x = nx; d.y = ny; }
      if (d.z <= 0) { d.z = 0; if (d.bounces++ < 2 && d.vz < -40) { d.vz = -d.vz * .35; d.vx *= .5; d.vy *= .5; if (d.kind === 'gold') sfx('coin', { vol: .15, pitch: 1.5 }); } else { d.rest = true; d.vx = d.vy = d.vz = 0; if (map) lootToGround(d, map); } }
    }
    if (!h || !h.alive) continue;
    const dd = Math.hypot(h.x - d.x, h.y - d.y);
    if (d.kind === 'gold' || d.kind === 'potion') {
      if (d.t > .4 && dd < pickupR(h) * 3) { const k = Math.min(1, dt * 10); d.x = lerp(d.x, h.x, k); d.y = lerp(d.y, h.y, k); }   // gold and potions fly to him
      if (d.t > .4 && dd < pickupR(h)) {
        if (d.kind === 'gold') { gainGold(h, d.n); P.text(h.x, h.y, 30, '+' + fmt(d.n), '#ffd23a'); sfx('coin', { vol: .35 }); }
        else if (h.potions < h.maxPotions) { h.potions++; sfx('pickup'); P.text(h.x, h.y, 30, '+POTION', '#ff8a9a'); } else continue;
        ED.drops.splice(i, 1);
      }
    } else if (d.rest && dd < pickupR(h) && labelShown(d) && !d.noAuto) {
      if (h.bag.length >= BAG_MAX) { if (!d.fullWarn) { d.fullWarn = true; notify('BAG FULL', '#ff8a7a', 1.5); } continue; }
      h.bag.push(d.item); ED.drops.splice(i, 1); sfx('pickup', { vol: .6 }); BUS.emit('pickup', { item: d.item });
      if (d.item.rarity >= 1) notify(d.item.name, RARITY[d.item.rarity].color, 2.2);
    }
  }
}
/** loot that lands over a pit, deep water or a wall slides to the nearest ground a hero can reach */
function lootToGround(d, map) {
  const cx = Math.floor(d.x / T16), cy = Math.floor(d.y / T16); if (map.walkable(cx, cy)) return;
  let best = null, bd = 1e9;
  for (let y = cy - 4; y <= cy + 4; y++) for (let x = cx - 4; x <= cx + 4; x++) if (map.walkable(x, y)) { const dd = (x - cx) * (x - cx) + (y - cy) * (y - cy); if (dd < bd) { bd = dd; best = [x, y]; } }
  if (best) { d.x = (best[0] + .3 + Math.random() * .4) * T16; d.y = (best[1] + .3 + Math.random() * .4) * T16; }
}
/** the loot filter: 0 shows everything, 1 hides commons, 2 shows rares and better (Z shows all) */
const labelShown = d => d.kind !== 'item' || d.item.rarity >= OPT.labels || game.input.down('labels');
function drawDrops(r) {
  const labels = [];
  for (const d of ED.drops) {
    if (!r.visible(d.x, d.y, d.z, 20, 20, 20)) continue;
    r.shadow(d.x, d.y, 3, .4);
    if (d.kind === 'gold') r.queue(d.x, d.y, d.z, g => { const [x, y] = r.w(d.x, d.y, d.z), n = Math.min(4, 1 + Math.floor(Math.log10(d.n + 1))); for (let k = 0; k < n; k++) { px.ell(g, x + (k % 2) * 3 - 1, y - k * 1.5, 2.5, 1.4, '#b88a1a'); px.ell(g, x + (k % 2) * 3 - 1, y - k * 1.5 - 1, 2.2, 1, '#ffd23a'); } px.dot(g, x - 1, y - n * 1.5, '#fffbd0'); }, { emissive: false });
    else if (d.kind === 'potion') r.queue(d.x, d.y, d.z, g => { const [x, y] = r.w(d.x, d.y, d.z); px.rect(g, x - 1, y - 8, 2, 2, '#c8b890'); px.disc(g, x, y - 3.5, 3, '#6a1a2a'); px.disc(g, x, y - 3.5, 2.3, '#e03a4a'); px.dot(g, x - 1, y - 5, '#ffc0c8'); }, {});
    else {
      const it = d.item, rc = RARITY[it.rarity];
      if (!labelShown(d)) continue;
      r.queue(d.x, d.y, d.z, g => { const [x, y] = r.w(d.x, d.y, d.z); if (typeof drawItemIconEx === 'function') drawItemIconEx(g, it, x - 6, y - 11, .75); else drawItemIcon(g, it, x - 6, y - 11, .75); }, {});   // the loot file's shaded, outlined icon when it is there
      if (rc.beam && d.rest) {   // a loot beam: a column of light in the rarity's color
        const tall = it.rarity >= 3 ? 90 : 55, pulse = .7 + .3 * Math.sin(game.time * 4 + d.x);
        r.queue(d.x, d.y, 0, g => { const [x, y] = r.w(d.x, d.y, 0), [, ty] = r.w(d.x, d.y, tall); px.glow(g, 1); px.blend(g, .35 * pulse, 'add', () => { px.rect(g, x - 2, ty, 4, y - ty, rc.beam); px.rect(g, x - 1, ty, 2, y - ty, '#ffffff'); }); }, { emissive: true, bias: -.1 });
        L.add(d.x, d.y, 6, it.rarity >= 3 ? 60 : 36, .7, { color: rc.beam });
      }
      labels.push(d);
    }
  }
  // name labels above items (overlapping ones stack upward)
  r.overlay(g => {
    const placed = [];
    for (const d of labels) {
      let [x, y] = r.w(d.x, d.y, d.z + 16); const it = d.item, gs = !!(it.affixes && it.affixes.some(a => a.g)), w = E.font.width(it.name, { font: 'tiny' }) + 6 + (gs ? 6 : 0);   // a star marks greater lines (worth a look deep down)
      x = Math.round(x - w / 2); y = Math.round(y);
      for (let k = 0; k < 8; k++) { if (placed.some(p => x < p[0] + p[2] && x + w > p[0] && Math.abs(y - p[1]) < 9)) y -= 9; else break; }
      placed.push([x, y, w]); d.lab = [x, y, w, 9];
      const hov = UI.mouse && UI.mouse.x >= x && UI.mouse.x < x + w && UI.mouse.y >= y && UI.mouse.y < y + 9;
      px.blend(g, .8, 'normal', () => px.rect(g, x, y, w, 9, hov ? '#2a2440' : '#0c0818'));
      px.rect(g, x, y, w, 1, RARITY[it.rarity].color);
      if (gs) { px.rect(g, x + 2, y + 4, 5, 1, '#ffe070'); px.rect(g, x + 4, y + 2, 1, 5, '#ffe070'); px.dot(g, x + 4, y + 4, '#ffffff'); }   // a four-point star, like the tooltip's
      E.font.text(g, it.name, x + 3 + (gs ? 6 : 0), y + 2, RARITY[it.rarity].color, { font: 'tiny', outline: false });
      if (hov) UI.hotItem = d;
    }
  });
}

/* ---------- item icons (bag, gear, tooltips, the ground) ---------- */
function drawItemIcon(g, it, x, y, s = 1) {
  const c = (it.look && it.look.colors) || {}, slot = it.slot, R = (a, b, w, h, col) => px.rect(g, x + a * s, y + b * s, Math.max(1, w * s), Math.max(1, h * s), col);
  const T = col => E.tones(col);
  if (slot === 'weapon') {
    if (it.look && it.look.weapon === 'staff') { px.line(g, x + 3 * s, y + 14 * s, x + 12 * s, y + 3 * s, T(c.staff || '#6a4a2a').base, Math.max(1, Math.round(1.5 * s))); px.disc(g, x + 12.5 * s, y + 2.5 * s, 2.2 * s, c.orb || '#ffb347'); px.dot(g, x + 12 * s, y + 2 * s, '#ffffff'); }
    else { const L0 = ((it.look && it.look.bladeLen) || 11) / 14; px.line(g, x + 3 * s, y + 13 * s, x + (3 + 10 * L0) * s, y + (13 - 10 * L0) * s, c.metal || '#dce8f1', Math.max(1, Math.round(1.6 * s))); px.line(g, x + 4 * s, y + 13 * s, x + (3 + 10 * L0) * s, y + (13 - 10 * L0) * s, T(c.metal || '#dce8f1').hi); px.line(g, x + 2 * s, y + 10 * s, x + 6 * s, y + 14 * s, c.hilt || '#e8b04e', Math.max(1, Math.round(s))); px.dot(g, x + 2 * s, y + 14 * s, '#5a3620'); }
    if (it.el && it.el !== 'phys') px.dot(g, x + 13 * s, y + 2 * s, EL(it.el).light);
  } else if (slot === 'helm') {
    const hat = it.look.hat, col = hat ? hat.color : it.look.hood ? '#3a3448' : '#6a4128', t = T(col);
    if (hat && hat.style === 'crown') { R(3, 8, 10, 3, t.base); for (const a of [3, 7, 11]) R(a, 5, 2, 3, t.lt); }
    else if (hat && hat.style === 'pointed') { px.poly(g, [[x + 3 * s, y + 12 * s], [x + 13 * s, y + 12 * s], [x + 11 * s, y + 3 * s]], t.base); R(2, 11, 12, 2, t.sh); }
    else { px.disc(g, x + 8 * s, y + 9 * s, 5 * s, t.base); px.disc(g, x + 7 * s, y + 8 * s, 3 * s, t.lt); R(3, 10, 10, 3, t.sh); }
  } else if (slot === 'chest') {
    const t = T(c.cloth || '#2f8f86'); px.poly(g, [[x + 3 * s, y + 3 * s], [x + 13 * s, y + 3 * s], [x + 12 * s, y + 14 * s], [x + 4 * s, y + 14 * s]], t.base); R(1, 3, 3, 6, t.sh); R(12, 3, 3, 6, t.sh); R(6, 3, 4, 2, t.deep); if (it.look.armor) { const m = T(c.metal || '#b9c1cf'); R(5, 6, 6, 5, m.base); R(5, 6, 6, 1, m.hi); }
    if (c.trim) R(4, 13, 8, 1, c.trim);
  } else if (slot === 'gloves') { const t = T(c.glove || '#6a4128'); R(3, 5, 5, 8, t.base); R(8, 7, 5, 6, t.sh); R(3, 5, 5, 1, t.lt); R(2, 11, 11, 2, t.deep); }
  else if (slot === 'legs') { const t = T(c.pants || '#3b3552'); R(4, 2, 8, 4, t.base); R(4, 5, 3, 9, t.base); R(9, 5, 3, 9, t.sh); }
  else if (slot === 'boots') { const t = T(c.boot || '#6a4128'); R(4, 3, 4, 8, t.base); R(4, 10, 8, 3, t.base); R(4, 3, 4, 1, t.lt); R(4, 12, 8, 1, t.deep); }
  else if (slot === 'cloak') { const t = T(c.cape || '#c8452f'); px.poly(g, [[x + 5 * s, y + 2 * s], [x + 11 * s, y + 2 * s], [x + 14 * s, y + 14 * s], [x + 2 * s, y + 14 * s]], t.base); px.line(g, x + 8 * s, y + 3 * s, x + 7 * s, y + 13 * s, t.sh); R(5, 2, 6, 1, t.lt); }
  else if (slot === 'amulet') { for (let i = 0; i < 12; i++) { const a = Math.PI * .1 + i / 11 * Math.PI * .8; px.dot(g, x + 8 * s + Math.cos(a + Math.PI) * 5 * s, y + 6 * s + Math.sin(a + Math.PI) * -5 * s, '#c8a040'); } px.disc(g, x + 8 * s, y + 11 * s, 2.5 * s, it.gem || '#e04a4a'); px.dot(g, x + 7 * s, y + 10 * s, '#ffffff'); }
  else { px.disc(g, x + 8 * s, y + 10 * s, 4 * s, '#c8a040'); px.disc(g, x + 8 * s, y + 10 * s, 2.6 * s, '#0c0818'); px.disc(g, x + 8 * s, y + 5 * s, 2 * s, it.gem || '#4a8ae0'); px.dot(g, x + 7.5 * s, y + 4.5 * s, '#ffffff'); }
}

/* ---------- three legendary powers to start the language (more in the loot content file) ---------- */
def('powers', 'cindertrail', { name: 'Cinderstep', noun: false, slots: ['boots', 'cloak'], desc: 'Dodging leaves a trail of burning ground.',
  install() { BUS.on('dodge', e => { if (!hasPower(e.h, 'cindertrail')) return; const h = e.h; let n = 0; const tk = game.every(.05, () => { if (++n > 4) return tk.cancel(); FX.area({ team: 'hero', src: h, x: h.x, y: h.y, r: 10, dur: 2.5, el: 'fire', tick: .4, hit: heroHit(h, .25, { el: 'fire', tags: ['dot'] }) }); }); }); } });
def('powers', 'thunderstruck', { name: 'Thunderstruck', slots: ['weapon', 'gloves', 'ring'], desc: 'Every fourth hit calls down lightning on the target.',
  install() { let n = 0; BUS.on('hit', e => { const h = ED.hero; if (e.src !== h || !hasPower(h, 'thunderstruck') || isProcHit(e.hit)) return; if (++n % 4) return; FX.strike({ team: 'hero', src: h, x: e.tgt.x, y: e.tgt.y, r: 14, delay: .12, el: 'storm', hit: heroHit(h, .9, { el: 'storm', tags: ['spell', 'proc'] }) }); }); } });
def('powers', 'shatter', { name: 'Shattering', slots: ['weapon', 'amulet', 'chest'], desc: 'Enemies you kill explode in a nova of their element.',
  install() { BUS.on('kill', e => { const h = ED.hero; if (e.src !== h || !hasPower(h, 'shatter') || e.tgt.team !== 'foe') return; const el = e.tgt.el === 'phys' ? 'frost' : e.tgt.el; FX.nova({ team: 'hero', src: h, x: e.tgt.x, y: e.tgt.y, r0: 4, r1: 32, dur: .25, el, hit: heroHit(h, .5, { el, tags: ['aoe', 'proc'] }) }); }); } });
function installPowers() { for (const p of Object.values(REG.powers)) if (p.install && !p._in) { p._in = true; p.install(); } }

/* =============================================================================
 * COMPOSED LEGENDARY POWERS: past depth 15 the loot language writes its own powers, the way recipe() writes depths.
 * A composed power is a TRIGGER (a moment in a fight) x an EFFECT (an FX verb) x an ELEMENT, ranked by item level
 * (+10% per rank). Its id says everything ('cx.slay.nova.frost.4'), so a save stores only the id and powerSpec()
 * rebuilds the power the first time it meets it. cxTrigger / cxEffect are open: any module may add words.
 * Composed hits are marked cx and never set off composed powers (no chain reactions), and nothing fires in town.
 *   TRIGGER { ev (the BUS event), when (clause, or fn(el)), from / at (where it happens, for the text), cd, k (rarer
 *     moments hit harder), slots (where it may roll), test(e, h, c) -> { x, y, tgt, ang } | null }
 *   EFFECT { word (for the name), k (weapon damage share), per (the text after the share), say(W, T, c) -> clause,
 *     fire(h, S, el, k, c) }
 * ============================================================================= */
const CX_T = {}, CX_E = {}, CX_EV = {};
// per element: [name root, noun, adjective]
const CX_ELW = { phys: ['Iron', 'steel', 'steel'], fire: ['Cinder', 'fire', 'burning'], frost: ['Rime', 'frost', 'frozen'], storm: ['Thunder', 'lightning', 'crackling'], void: ['Void', 'shadow', 'shadow'], venom: ['Blight', 'venom', 'venomous'] };
const CX_STATUS = { phys: 'bleeding', fire: 'burning', frost: 'chilled', storm: 'shocked', void: 'cursed', venom: 'poisoned' };
const cxRankFor = il => Math.max(1, 1 + Math.floor((Math.max(16, il) - 16) / 10));
const cxShare = il => Math.min(.6, .3 + (il - 16) * .006);   // how often a deep legendary's power is a composed one
function cxTrigger(id, o) {
  CX_T[id] = Object.assign({ id, k: 1, cd: 0, slots: SLOTS }, o);
  if (!CX_EV[o.ev]) { CX_EV[o.ev] = true; BUS.on(o.ev, e => cxRun(o.ev, e)); }
}
function cxEffect(id, o) { CX_E[id] = Object.assign({ id, k: 1 }, o); }
/** 'cx.slay.nova.frost.4' -> { id, t, e, el, rank, k } (a fresh object: counters and cooldowns live on it), or null */
function cxParse(id) {
  if (typeof id !== 'string' || !id.startsWith('cx.')) return null;
  const [, t, e, el, r] = id.split('.'); if (!CX_T[t] || !CX_E[e] || !REG.elements[el]) return null;
  const rank = Math.max(1, parseInt(r, 10) || 1);
  return { id, t, e, el, rank, k: 1 + (rank - 1) * .1 };
}
/** a power by id: the registry's, or a composed one built (and registered) on first sight */
function powerSpec(id) {
  if (!id) return null; if (REG.powers[id]) return REG.powers[id];
  const c = cxParse(id); if (!c) return null;
  const T = CX_T[c.t], X = CX_E[c.e], W = CX_ELW[c.el] || CX_ELW.phys, when = typeof T.when === 'function' ? T.when(c.el) : T.when;
  const pct = Math.round(X.k * T.k * c.k * 100);
  const desc = when + ', ' + X.say(W, T, c) + '.' + (X.k ? ' ' + fmt(pct) + '% weapon damage' + (X.per ? ' ' + X.per : '') + '.' : '');
  return def('powers', id, { name: W[0] + X.word, desc, slots: [], composed: true, rank: c.rank, el: c.el });
}
/** may power id sit on an item of this slot? (a composed one where its trigger may roll; a unique's own power nowhere else) */
function powerFits(id, slot) {
  const p = powerSpec(id), s = slot === 'ring2' ? 'ring' : slot; if (!p) return false;
  if (p.composed) { const c = cxParse(id); return !!c && CX_T[c.t].slots.includes(s); }
  return !p.slots || p.slots.includes(s);
}
/** a composed power for an item slot: a trigger that suits the slot, any effect, an element (often the hint's) */
function cxRoll(slot, il, R, el) {
  const s = slot === 'ring2' ? 'ring' : slot, ts = Object.values(CX_T).filter(T => T.slots.includes(s)), T = ts.length ? R.pick(ts) : R.pick(Object.values(CX_T));
  const X = R.weighted(Object.values(CX_E), x => x.w || 1), e = el && R() < .5 ? el : R.pick(ELEMENT_IDS);
  return ['cx', T.id, X.id, e, cxRankFor(il)].join('.');
}
function cxRun(ev, e) {
  const h = ED.hero; if (!h || !h.alive || !h._cx || !h._cx.length || (ED.L && ED.L.kind === 'town')) return;
  for (const c of h._cx) {
    const T = CX_T[c.t]; if (T.ev !== ev) continue;
    const S = T.test(e, h, c); if (!S) continue;
    if (T.cd) { if ((c.ready || 0) > game.time) continue; c.ready = game.time + T.cd; }
    try { CX_E[c.e].fire(h, S, c.el, T.k * c.k, c); } catch (err) { game._fail('power ' + c.id, err); }
    P.glints(h.x, h.y, 18, 2, EL(c.el).light, 8);   // a spark on him: his gear did that
  }
}
/** a composed hit: weapon damage x k, a proc that never procs composed powers */
const cxHit = (h, k, el, o = {}) => heroHit(h, k, { el, tags: o.tags || ['aoe', 'proc'], kb: o.kb === undefined ? 60 : o.kb, extra: Object.assign({ proc: true, cx: true }, o.extra || {}) });
const cxArea = h => 1 + ((h.stats && h.stats.area) || 0) / 100;
const cxSpot = (x, y, tgt, ang) => ({ x, y, tgt, ang });

/* ---- triggers ---- */
cxTrigger('slay', { ev: 'kill', when: 'When you kill an enemy', from: 'from its body', at: 'where it fell', cd: .15, slots: SLOTS,
  test: (e, h) => e.src === h && e.tgt.team === 'foe' && !(e.hit && e.hit.cx) ? cxSpot(e.tgt.x, e.tgt.y, e.tgt, angTo(h, e.tgt)) : null });
cxTrigger('crit', { ev: 'hit', when: 'When you land a critical strike', from: 'from the target', at: 'on the target', cd: .3, k: .8, slots: ['weapon', 'gloves', 'ring', 'amulet', 'helm'],
  test: (e, h) => e.src === h && e.hit.crit && e.tgt.team === 'foe' && !isProcHit(e.hit) ? cxSpot(e.tgt.x, e.tgt.y, e.tgt, angTo(h, e.tgt)) : null });
cxTrigger('dodge', { ev: 'dodge', when: 'When you dodge', from: 'from where you stood', at: 'where you stood', k: 1.5, slots: ['boots', 'cloak', 'legs', 'gloves'],
  test: (e, h) => e.h === h ? cxSpot(h.x, h.y, nearestEnemy('hero', h.x, h.y, 70), h.dodgeDir !== undefined ? h.dodgeDir : h.facing) : null });
cxTrigger('struck', { ev: 'hurt', when: 'When you are struck (every 1.5 seconds at most)', from: 'around you', at: 'at your feet', cd: 1.5, k: 1.5, slots: ['chest', 'legs', 'helm', 'cloak', 'amulet'],
  test: (e, h) => e.tgt === h ? cxSpot(h.x, h.y, e.hit && e.hit.src && e.hit.src.alive ? e.hit.src : nearestEnemy('hero', h.x, h.y, 70), h.facing) : null });
cxTrigger('cast', { ev: 'skill', when: 'Every third skill you use', from: 'at your target', at: 'at your target', k: 1.4, slots: ['helm', 'amulet', 'weapon', 'ring', 'gloves'],
  test: (e, h, c) => {
    if (e.h !== h || (c.n = (c.n || 0) + 1) % 3) return null;
    const tx = h.tx !== undefined ? h.tx : h.x + Math.cos(h.aim) * 40, ty = h.ty !== undefined ? h.ty : h.y + Math.sin(h.aim) * 40, m = nearestEnemy('hero', tx, ty, 60);
    const d = Math.hypot(tx - h.x, ty - h.y), k = d > 110 ? 110 / d : 1;
    return m ? cxSpot(m.x, m.y, m, angTo(h, m)) : cxSpot(h.x + (tx - h.x) * k, h.y + (ty - h.y) * k, null, h.aim);
  } });
cxTrigger('rhythm', { ev: 'strike', when: 'Every fourth strike', from: 'ahead of you', at: 'ahead of you', k: 1.2, slots: ['weapon', 'gloves', 'ring'],
  test: (e, h, c) => { if (e.h !== h || (c.n = (c.n || 0) + 1) % 4) return null; const x = h.x + Math.cos(h.facing) * 18, y = h.y + Math.sin(h.facing) * 18; return cxSpot(x, y, nearestEnemy('hero', x, y, 40), h.facing); } });
cxTrigger('quaff', { ev: 'potion', when: 'When you drink a potion', from: 'around you', at: 'at your feet', k: 2.5, slots: ['amulet', 'ring', 'chest', 'legs'],
  test: (e, h) => e.h === h ? cxSpot(h.x, h.y, nearestEnemy('hero', h.x, h.y, 90), h.facing) : null });
cxTrigger('pulse', { ev: 'step', when: 'Every 4 seconds in a fight', from: 'around you', at: 'at your feet', k: 1.3, slots: ['chest', 'amulet', 'helm', 'cloak'],
  test: (e, h, c) => { c.acc = Math.min(4, (c.acc || 0) + (e.dt || 0)); if (c.acc < 4) return null; const m = nearestEnemy('hero', h.x, h.y, 110); if (!m) return null; c.acc = 0; return cxSpot(h.x, h.y, m, angTo(h, m)); } });
cxTrigger('elite', { ev: 'hit', when: 'When you hit an elite or a boss (once a second)', from: 'from the target', at: 'on the target', cd: 1, k: 1.3, slots: ['weapon', 'ring', 'amulet', 'gloves', 'helm'],
  test: (e, h) => e.src === h && (e.tgt.elite || e.tgt.boss) && !isProcHit(e.hit) ? cxSpot(e.tgt.x, e.tgt.y, e.tgt, angTo(h, e.tgt)) : null });
cxTrigger('afflict', { ev: 'hit', when: el => 'When you hit a ' + CX_STATUS[el] + ' enemy (twice a second)', from: 'from the target', at: 'on the target', cd: .5, k: .75, slots: ['weapon', 'gloves', 'amulet', 'ring'],
  test: (e, h, c) => e.src === h && e.tgt.team === 'foe' && e.tgt.st && e.tgt.st[EL(c.el).status] && !isProcHit(e.hit) ? cxSpot(e.tgt.x, e.tgt.y, e.tgt, angTo(h, e.tgt)) : null });

/* ---- effects (the FX verbs, dressed in the element) ---- */
const CX_GROUND = { phys: 'bristles with blades', fire: 'burns', frost: 'freezes over', storm: 'crackles with lightning', void: 'opens into a hungry dark', venom: 'festers' };
cxEffect('nova', { word: 'burst', k: 1.1, say: (W, T) => 'a nova of ' + W[1] + ' bursts ' + T.from,
  fire(h, S, el, k) { FX.nova({ team: 'hero', src: h, x: S.x, y: S.y, r0: 4, r1: 38 * cxArea(h), dur: .28, el, tags: ['aoe', 'proc'], hit: cxHit(h, k * 1.1, el, { kb: 120 }) }); P.ring(S.x, S.y, 3, 30, EL(el).light, .3); sfx('explode', { vol: .3, pitch: 1.3 }); } });
cxEffect('chain', { word: 'arc', k: .8, per: 'to the first, a little less each jump', say: (W, T) => cap(W[1]) + ' arcs ' + T.from + ' through four enemies',
  fire(h, S, el, k) { const t = S.tgt && S.tgt.alive ? S.tgt : null; FX.chain({ team: 'hero', src: h, from: S.tgt || null, x: S.x, y: S.y, z: 12, hops: 4, range: 85, el, first: t || undefined, set: new Set(), hit: cxHit(h, k * .8, el, { kb: 40 }) }); } });
cxEffect('meteor', { word: 'fall', k: 2, say: (W, T) => 'a star of ' + W[1] + ' falls ' + T.at,
  fire(h, S, el, k) { const m = S.tgt && S.tgt.alive ? S.tgt : nearestEnemy('hero', S.x, S.y, 50); FX.meteor({ team: 'hero', src: h, x: m ? m.x : S.x, y: m ? m.y : S.y, r: 22 * cxArea(h), delay: .55, el, size: .8, hit: cxHit(h, k * 2, el, { kb: 120 }) }); } });
cxEffect('volley', { word: 'shard', k: .45, per: 'each', say: (W, T) => 'six ' + W[2] + ' shards fly out ' + T.from,
  fire(h, S, el, k) { const a0 = S.ang || 0; for (let i = 0; i < 6; i++) FX.bolt({ team: 'hero', src: h, x: S.x, y: S.y, z: 10, ang: a0 + i / 6 * TAU, speed: 230, life: .5, r: 3, el, pierce: 1, tags: ['proj', 'proc'], hit: cxHit(h, k * .45, el, { kb: 50, tags: ['proj', 'proc'] }), look: { kind: 'bolt', size: 1.6 }, light: 14 }); sfx('shoot', { vol: .3, pitch: 1.4 }); } });
cxEffect('ground', { word: 'mire', k: .28, per: 'every half second', say: (W, T, c) => 'the ground ' + T.at + ' ' + CX_GROUND[c.el] + ' for 3 seconds',
  fire(h, S, el, k) { FX.area({ team: 'hero', src: h, x: S.x, y: S.y, r: 22 * cxArea(h), dur: 3, tick: .5, el, tags: ['aoe', 'dot', 'proc'], hit: cxHit(h, k * .28, el, { kb: 0, tags: ['aoe', 'dot', 'proc'], extra: { statusChance: .5 } }) }); elBurst(S.x, S.y, 4, el, 10); } });
cxEffect('strikes', { word: 'wrath', k: 1, per: 'each', say: W => cap(W[1]) + ' strikes down on three enemies nearby',
  fire(h, S, el, k) {
    const hit = [], seen = new Set(); if (S.tgt && S.tgt.alive) { hit.push(S.tgt); seen.add(S.tgt); }
    eachEnemy('hero', S.x, S.y, 90, m => { if (hit.length < 3 && !seen.has(m)) { hit.push(m); seen.add(m); } });
    if (!hit.length) hit.push({ x: S.x, y: S.y });
    hit.forEach((m, i) => FX.strike({ team: 'hero', src: h, x: m.x, y: m.y, r: 14, delay: .22 + i * .12, el, tags: ['aoe', 'spell', 'proc'], hit: cxHit(h, k, el, { kb: 60 }) }));
  } });
cxEffect('wave', { word: 'rend', k: 1.1, say: (W, T) => 'a wave of ' + W[1] + ' tears along the ground ' + T.from,
  fire(h, S, el, k) { FX.wave({ team: 'hero', src: h, x: S.x, y: S.y, ang: S.ang !== undefined ? S.ang : h.facing, speed: 240, len: 110, w: 18, el, up: 60, hit: cxHit(h, k * 1.1, el, { kb: 90 }) }); sfx('crack', { vol: .45 }); } });
cxEffect('vortex', { word: 'maw', k: 1.4, say: (W, T) => 'a ' + W[2] + ' vortex opens ' + T.at + ', drags enemies in and bursts',
  fire(h, S, el, k) {
    const L0 = ED.L, R = 56 * cxArea(h), x = S.x, y = S.y;
    FX.pull({ team: 'hero', src: h, x, y, r: R, force: 260, dur: .8, el }); sfx('whoosh', { vol: .4, pitch: .6 });
    game.after(.8, () => { if (ED.L !== L0 || !h.alive) return; FX.nova({ team: 'hero', src: h, x, y, r0: 4, r1: R * .65, dur: .25, el, tags: ['aoe', 'proc'], hit: cxHit(h, k * 1.4, el, { kb: 150 }) }); elBurst(x, y, 6, el, 16); shake(2); });
  } });
cxEffect('seekers', { word: 'wisp', k: .7, per: 'each', say: (W, T) => 'three ' + W[2] + ' wisps rise ' + T.from + ' and hunt enemies down',
  fire(h, S, el, k) { for (let i = 0; i < 3; i++) FX.bolt({ team: 'hero', src: h, x: S.x, y: S.y, z: 14, ang: (S.ang || 0) + (i - 1) * 1.4 + Math.PI, speed: 120, life: 2, r: 4, el, home: 7, tags: ['proj', 'proc'], hit: cxHit(h, k * .7, el, { kb: 40, tags: ['proj', 'proc'] }), look: { kind: 'orb', size: 1.7 }, light: 24 }); } });
cxEffect('surge', { word: 'surge', k: 0, w: .6, say: (W, T, c) => 'you surge: +' + fmt(18 * CX_T[c.t].k * c.k) + '% ' + EL(c.el).name + ' damage and +12% attack and cast speed for 4 seconds',
  fire(h, S, el, k, c) {
    const id = 'cx:' + c.id, st = { ['inc' + cap(el)]: Math.round(18 * k), atkSpeed: 12, castSpeed: 12 }, b = h.buffs.find(q => q.id === id);
    if (b) b.t = 4; else { h.buffs.push({ id, name: powerSpec(c.id).name, color: EL(el).color, t: 4, stats: st }); computeStats(h); }
    P.ring(h.x, h.y, 4, 26, EL(el).light, .35); elBurst(h.x, h.y, 14, el, 8); sfx('charge', { vol: .35, pitch: 1.3 });
  } });
