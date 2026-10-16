/* =============================================================================
 * STATS: every number the hero has, where it comes from, and how it reads in a tooltip
 * A stat source is a function (h, add) that calls add(key, value) for each contribution. Gear, the passive
 * tree, buffs and powers each register one with statSource(fn). computeStats(h) sums them over the base.
 * Keys ending in Pct / inc* / res* are percents. 'rank:<skillId>' adds levels to one skill.
 * ============================================================================= */
const STATS = {
  life: { name: 'Maximum Life', f: 'flat' }, lifePct: { name: 'Increased Maximum Life', f: 'pct' }, lifeRegen: { name: 'Life per Second', f: 'dec' },
  lifeOnHit: { name: 'Life on Hit', f: 'flat' }, lifeOnKill: { name: 'Life on Kill', f: 'flat' }, leech: { name: 'Damage Leeched as Life', f: 'pctd' },
  ember: { name: 'Maximum Ember', f: 'flat' }, emberRegen: { name: 'Ember per Second', f: 'dec' }, emberOnHit: { name: 'Ember on Hit', f: 'dec' },
  dmgFlat: { name: 'Weapon Damage', f: 'flat' }, dmgPct: { name: 'Increased Weapon Damage', f: 'pct' },
  incDmg: { name: 'Increased Damage', f: 'pct' }, incMelee: { name: 'Increased Melee Damage', f: 'pct' }, incSpell: { name: 'Increased Spell Damage', f: 'pct' },
  incProj: { name: 'Increased Projectile Damage', f: 'pct' }, incAoe: { name: 'Increased Area Damage', f: 'pct' }, incDot: { name: 'Increased Damage over Time', f: 'pct' },
  incPhys: { name: 'Increased Physical Damage', f: 'pct' }, incFire: { name: 'Increased Fire Damage', f: 'pct' }, incFrost: { name: 'Increased Frost Damage', f: 'pct' },
  incStorm: { name: 'Increased Storm Damage', f: 'pct' }, incVoid: { name: 'Increased Void Damage', f: 'pct' }, incVenom: { name: 'Increased Venom Damage', f: 'pct' },
  incElite: { name: 'Increased Damage to Elites', f: 'pct' }, incBoss: { name: 'Increased Damage to Bosses', f: 'pct' }, incStatus: { name: 'Increased Damage to Afflicted Enemies', f: 'pct' },
  moreDmg: { name: 'More Damage', f: 'pct' },
  atkSpeed: { name: 'Increased Attack Speed', f: 'pct' }, castSpeed: { name: 'Increased Cast Speed', f: 'pct' }, moveSpeed: { name: 'Increased Movement Speed', f: 'pct' },
  crit: { name: 'Critical Strike Chance', f: 'pctd' }, critDmg: { name: 'Critical Strike Damage', f: 'pct' },
  armor: { name: 'Armor', f: 'flat' }, armorPct: { name: 'Increased Armor', f: 'pct' }, dodge: { name: 'Chance to Evade Hits', f: 'pctd' },
  resFire: { name: 'Fire Resistance', f: 'pct' }, resFrost: { name: 'Frost Resistance', f: 'pct' }, resStorm: { name: 'Storm Resistance', f: 'pct' },
  resVoid: { name: 'Void Resistance', f: 'pct' }, resVenom: { name: 'Venom Resistance', f: 'pct' }, resAll: { name: 'All Resistances', f: 'pct' },
  area: { name: 'Increased Area of Effect', f: 'pct' }, projectiles: { name: 'Additional Projectiles', f: 'plus' }, pierce: { name: 'Projectiles Pierce', f: 'plus' },
  chains: { name: 'Additional Chains', f: 'plus' }, cdr: { name: 'Cooldown Reduction', f: 'pct' }, costRed: { name: 'Ember Cost Reduction', f: 'pct' },
  statusChance: { name: 'Increased Status Chance', f: 'pct' }, statusDmg: { name: 'Increased Burn, Poison and Bleed Damage', f: 'pct' },
  thorns: { name: 'Thorns Damage', f: 'flat' }, dodgeCharges: { name: 'Dodge Charges', f: 'plus' }, dodgeCd: { name: 'Faster Dodge Recharge', f: 'pct' },
  goldFind: { name: 'Increased Gold Found', f: 'pct' }, magicFind: { name: 'Increased Item Rarity', f: 'pct' }, xpGain: { name: 'Increased Experience', f: 'pct' },
  pickup: { name: 'Increased Pickup Radius', f: 'pct' }, potionHeal: { name: 'Increased Potion Healing', f: 'pct' }, potionCharges: { name: 'Potion Charges', f: 'plus' },
  knockback: { name: 'Increased Knockback', f: 'pct' }, allSkills: { name: 'to All Skills', f: 'plus' }, stun: { name: 'Chance to Stun', f: 'pctd' }
};
/** '+12% Increased Fire Damage', '+30 Maximum Life', '+1 to Whirlwind' */
function statText(key, v) {
  if (key.startsWith('rank:')) { const s = REG.skills[key.slice(5)]; return '+' + v + ' to ' + (s ? s.name : key.slice(5)); }
  const d = STATS[key]; if (!d) return key + ' ' + v;
  const n = Math.abs(v) < 10 && v % 1 ? v.toFixed(1) : Math.abs(v) >= 1e4 ? fmt(v) : Math.round(v), sg = v < 0 ? '' : '+';
  if (d.f === 'pct' || d.f === 'pctd') return sg + n + '% ' + d.name;
  if (d.f === 'plus') return sg + n + ' ' + d.name;
  return sg + n + ' ' + d.name;
}
const STAT_SOURCES = [], STAT_FINAL = [];
/** register where stats come from: statSource((h, add) => { add('life', 20); }) */
function statSource(fn) { STAT_SOURCES.push(fn); }
/** rules that read the summed stats and change them (conversions like 'evasion becomes armor'): statFinal((h, s) => {...}) */
function statFinal(fn) { STAT_FINAL.push(fn); }
/** base stats at a hero level */
function baseStats(lvl) {
  const T = TUNE;   // (Settings > Tuning: Hero > Base stats)
  return { life: T.baseLife + lvl * T.lifePerLevel, ember: T.baseEmber, emberRegen: T.emberRegen, lifeRegen: T.lifeRegen + lvl * T.regenPerLevel, crit: T.baseCrit, critDmg: T.baseCritDmg, armor: T.baseArmor + lvl * T.armorPerLevel, dmgFlat: 0, potionCharges: 3 + T.potionCharges, dodgeCharges: 2 + T.dodgeCharges };
}
function computeStats(h) {
  const s = baseStats(h.level);
  const add = (k, v) => { if (!v) return; s[k] = (s[k] || 0) + v; };
  for (const src of STAT_SOURCES) { try { src(h, add); } catch (e) { game._fail('stat source', e); } }
  for (const b of h.buffs) if (b.stats) for (const k in b.stats) add(k, b.stats[k]);
  for (const fn of STAT_FINAL) { try { fn(h, s); } catch (e) { game._fail('stat final', e); } }
  h.stats = s;
  // derived values the combat code reads directly
  const ra = s.resAll || 0, rc = TUNE.resCap;
  h.res = { fire: clamp((s.resFire || 0) + ra, -100, rc) / 100, frost: clamp((s.resFrost || 0) + ra, -100, rc) / 100, storm: clamp((s.resStorm || 0) + ra, -100, rc) / 100, void: clamp((s.resVoid || 0) + ra, -100, rc) / 100, venom: clamp((s.resVenom || 0) + ra, -100, rc) / 100 };
  h.armor = s.armor * (1 + (s.armorPct || 0) / 100);
  h.critChance = clamp(s.crit, 0, 95) / 100; h.critMul = TUNE.critMul + (s.critDmg - 50) / 100;
  h.statusMul = 1 + (s.statusChance || 0) / 100;
  const was = h.maxHp || 1, frac = h.hp / was;
  h.maxHp = Math.round(s.life * (1 + (s.lifePct || 0) / 100) * DIFF.heroHp);
  h.hp = clamp(h.alive ? frac * h.maxHp : h.maxHp, 1, h.maxHp);
  h.maxEmber = Math.round(s.ember); h.ember = Math.min(h.ember === undefined ? h.maxEmber : h.ember, h.maxEmber);
  h.maxPotions = Math.max(1, Math.round(s.potionCharges)); h.maxDodge = Math.max(1, Math.round(s.dodgeCharges));
  // the Settings 'hero speed' slider is the whole tempo: running, attacking and casting (a playtest knob, not only legs)
  h.speedMul = (1 + (s.moveSpeed || 0) / 100) * DIFF.heroSpeed;
  h.atkMul = (1 + (s.atkSpeed || 0) / 100) * DIFF.heroSpeed; h.castMul = (1 + (s.castSpeed || 0) / 100) * DIFF.heroSpeed;
  return s;
}
/** a skill's rank including +skill gear */
function skillRank(h, id) { const k = h.skills[id]; if (!k || !k.rank) return 0; return k.rank + ((h.stats && h.stats['rank:' + id]) || 0) + ((h.stats && h.stats.allSkills) || 0); }

/**
 * The hero's hit for a skill: weapon damage x the skill's scale x every increase that applies to its tags.
 * heroHit(h, 1.2, { el: 'fire', tags: ['spell', 'proj'], kb: 60 }) -> a hit template for FX or dealDamage.
 */
function heroHit(h, scale, o = {}) {
  const s = h.stats, el = o.el || 'phys', tags = o.tags || [], w = h.gear.weapon;
  const base = (w && w.dmg ? (w.dmg[0] + w.dmg[1]) / 2 : 7) * (1 + (s.dmgPct || 0) / 100) + (s.dmgFlat || 0);
  let inc = (s.incDmg || 0) + (s['inc' + cap(el)] || 0);
  if (tags.includes('melee')) inc += s.incMelee || 0;
  if (tags.includes('spell')) inc += s.incSpell || 0;
  if (tags.includes('proj')) inc += s.incProj || 0;
  if (tags.includes('aoe')) inc += s.incAoe || 0;
  if (tags.includes('dot')) inc += s.incDot || 0;
  const rank = o.skill ? skillRank(h, o.skill) : 1, rankMul = 1 + Math.max(0, rank - 1) * TUNE.rankBonus;
  const SK = o.skill && REG.skills[o.skill], amount = base * scale * (1 + inc / 100) * (1 + (s.moreDmg || 0) / 100) * rankMul * (SK && SK.dmgMul !== undefined ? SK.dmgMul : 1);   // (dmgMul: Tuning's skill inspector)
  return Object.assign({ src: h, amount, el, tags, kb: (o.kb || 0) * (1 + (s.knockback || 0) / 100), statusPower: amount * .45 * (1 + (s.statusDmg || 0) / 100), skill: o.skill }, o.extra || {});
}
