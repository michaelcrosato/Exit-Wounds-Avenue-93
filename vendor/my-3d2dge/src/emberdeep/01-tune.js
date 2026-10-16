/* =============================================================================
 * TUNE: the game's rule numbers, gathered in one place so Settings' tuning pages can change them while you play
 * Every knob is a plain number that the system it belongs to reads where the rule lives (TUNE.dodgeRecharge in
 * 20-hero.js, TUNE.gravity wherever something falls, ...). Its default is the shipped game, so a game with no
 * changes plays exactly as before. Settings (64-menu.js, 62-developer.js) lists them by section, explains them, and saves
 * the ones you change in this browser (ed:tune). Changes count at once, in the game you play.
 *
 * knob(section, group, tier, id, label, default, min, max, step, unit, about, where)
 *   tier 1 = Simple (the few that change the game's feel the most), 2 = Advanced (everything else)
 *   unit 'x' a multiplier, 's' seconds, '%' a percent, 'u/s' world units a second (16 = one tile), '' a plain number
 *   where: the source file that reads it, for anyone who wants to go further than the slider
 * ============================================================================= */
const TUNE_SECTIONS = [
  { id: 'hero', name: 'Hero', icon: '🗡', blurb: 'How your character moves, survives and recovers: running, the dodge roll, potions, and the base numbers every level starts from (before gear and passives).' },
  { id: 'combat', name: 'Combat', icon: '⚔', blurb: 'The rules every hit goes through, for both sides: how much damage rolls vary, how armor and resistances soften a hit, critical strikes, status effects (burn, chill, shock...) and knockback.' },
  { id: 'monsters', name: 'Monsters', icon: '👹', blurb: 'How monsters are built and how they fight: their life and damage, how they grow with depth, how many gang up on you at once, packs, and elites (champions and rares). Use the inspector at the bottom to change one monster type.' },
  { id: 'bosses', name: 'Bosses', icon: '👑', blurb: 'The boss at the end of every fifth depth: life, damage and how fast its attack patterns come. The inspector changes one boss.' },
  { id: 'loot', name: 'Loot & gold', icon: '💰', blurb: 'What drops and how good it is: drop chances, how often items roll magic, rare or legendary, gold, item power, and the price of things in town. The inspector changes one item base (sword, helm, ring...).' },
  { id: 'progress', name: 'Progression', icon: '⭐', blurb: 'How fast you level and what each level gives: the experience curve, skill and passive points, and how quickly the deep gets harder than you.' },
  { id: 'world', name: 'Physics & world', icon: '🌍', blurb: 'The world itself: gravity (falling, lobbed shots, loot bounce), how far knocks push, time, the camera, light and the screen’s reaction to hits.' },
  { id: 'skills', name: 'Skills', icon: '✨', blurb: 'Every skill’s ember cost, cooldown, ember generated, and a damage multiplier. Pick a skill in the inspector.' }
];
const TUNE_KNOBS = [], TUNE_DEFAULT = {};
function knob(sec, group, tier, id, label, def, min, max, step, unit, about, where) {
  TUNE_KNOBS.push({ sec, group, tier, id, label, def, min, max, step, unit, about, where }); TUNE_DEFAULT[id] = def;
}

/* ---------- Hero ---------- */
knob('hero', 'Movement', 1, 'heroRun', 'Run speed', 1, .25, 4, .01, 'x', 'How fast you walk around (the Wanderer runs 84 units a second, the Codex 90; one tile is 16). Gear and passives with Movement Speed add on top.', '18-characters.js (speed), 20-hero.js');
knob('hero', 'Movement', 2, 'heroAccel', 'Acceleration', 1, .1, 4, .01, 'x', 'How quickly you reach full speed and stop again. Low feels slippery and heavy, high feels snappy.', '18-characters.js (acceleration)');
knob('hero', 'Dodge roll', 1, 'dodgeSpeed', 'Dodge speed', 1, .25, 3, .01, 'x', 'How fast the roll travels. Distance = speed x duration, so raise this to roll farther in the same time.', '18-characters.js (dodgeSpeed)');
knob('hero', 'Dodge roll', 2, 'dodgeTime', 'Dodge duration', 1, .3, 3, .01, 'x', 'How long the roll lasts (0.27 s for the Wanderer). You are untouchable for the whole roll, so longer also means a bigger safe window.', '18-characters.js (dodgeTime)');
knob('hero', 'Dodge roll', 1, 'dodgeRecharge', 'Dodge recharge', 1.4, .1, 10, .05, 's', 'Seconds for one spent dodge charge to come back. Faster Dodge Recharge on gear shortens it further.', '20-hero.js');
knob('hero', 'Dodge roll', 2, 'dodgeCharges', 'Extra dodge charges', 0, -1, 8, 1, '+', 'Dodges you can chain before waiting (2 to start). Added to the charges from gear.', '15-stats.js (baseStats)');
knob('hero', 'Getting hit', 2, 'hurtInv', 'Mercy invulnerability', .35, 0, 2, .01, 's', 'After a hit you are untouchable for this long, so a crowd cannot land five blows in one instant.', '20-hero.js (heroReact)');
knob('hero', 'Potions', 1, 'potionHeal', 'Potion healing', .45, .05, 1, .01, 'x', 'Share of maximum life one potion restores (0.45 = 45%). A third lands at once, the rest over 1.5 s.', '20-hero.js (drinkPotion)');
knob('hero', 'Potions', 2, 'levelHeal', 'Level-up heal', .35, 0, 1, .01, 'x', 'Share of maximum life restored when you level up (ember always refills).', '20-hero.js (gainXp)');
knob('hero', 'Potions', 2, 'potionCharges', 'Extra potion charges', 0, -2, 10, 1, '+', 'Potions you carry (3 to start). Refilled in town and from potion drops.', '15-stats.js (baseStats)');
knob('hero', 'Base stats', 1, 'baseLife', 'Starting life', 70, 1, 2000, 1, '', 'Life at level 0 before gear and passives (Difficulty’s "Hero life" multiplies the final total).', '15-stats.js (baseStats)');
knob('hero', 'Base stats', 2, 'lifePerLevel', 'Life per level', 12, 0, 500, 1, '', 'Life gained each hero level.', '15-stats.js (baseStats)');
knob('hero', 'Base stats', 2, 'lifeRegen', 'Life regeneration', .4, 0, 100, .1, '', 'Life per second at level 0. Grows by "regen per level" each level.', '15-stats.js (baseStats)');
knob('hero', 'Base stats', 2, 'regenPerLevel', 'Regen per level', .08, 0, 10, .01, '', 'Extra life per second gained each level.', '15-stats.js (baseStats)');
knob('hero', 'Base stats', 2, 'baseEmber', 'Maximum ember', 100, 10, 1000, 1, '', 'Ember is the resource spells and strong skills spend. This is the pool before gear.', '15-stats.js (baseStats)');
knob('hero', 'Base stats', 1, 'emberRegen', 'Ember regeneration', 5, 0, 200, .5, '', 'Ember per second that refills on its own (basic attacks also generate it on hit).', '15-stats.js (baseStats)');
knob('hero', 'Base stats', 2, 'baseCrit', 'Critical chance', 5, 0, 95, 1, '%', 'Chance for any of your hits to crit before gear.', '15-stats.js (baseStats)');
knob('hero', 'Base stats', 2, 'baseCritDmg', 'Critical damage', 50, 0, 500, 5, '%', 'Bonus damage on a crit before gear (50% means a crit hits for 1.5x).', '15-stats.js (baseStats)');
knob('hero', 'Base stats', 2, 'baseArmor', 'Starting armor', 4, 0, 1000, 1, '', 'Armor at level 0; it softens physical hits (see Combat > Armor strength).', '15-stats.js (baseStats)');
knob('hero', 'Base stats', 2, 'armorPerLevel', 'Armor per level', 3, 0, 200, 1, '', 'Armor gained each hero level.', '15-stats.js (baseStats)');
knob('hero', 'Base stats', 2, 'pickupRadius', 'Pickup radius', 1, .25, 6, .05, 'x', 'How close you must walk to gold and potions before they fly to you.', '40-loot-core.js');

/* ---------- Combat ---------- */
knob('combat', 'Damage', 2, 'dmgVariance', 'Damage roll spread', .12, 0, .9, .01, 'x', 'Every hit rolls within plus or minus this share of its damage (0.12 = 88% to 112%). 0 makes every hit exact.', '10-combat.js (dealDamage)');
knob('combat', 'Damage', 1, 'critMul', 'Base crit multiplier', 1.5, 1, 6, .05, 'x', 'What a critical hit multiplies damage by before Critical Damage bonuses (monsters’ crits use it too).', '15-stats.js, 10-combat.js');
knob('combat', 'Mitigation', 2, 'armorK', 'Armor strength', 1, 0, 5, .05, 'x', 'How much armor reduces physical hits. 0 turns armor off; 2 makes every point count double. Armor can never block more than the cap below.', '10-combat.js (dealDamage)');
knob('combat', 'Mitigation', 2, 'armorCap', 'Armor cap', .75, 0, .95, .01, 'x', 'The most armor can ever block of one hit (0.75 = 75%).', '10-combat.js (dealDamage)');
knob('combat', 'Mitigation', 2, 'resCap', 'Resistance cap', 75, 0, 95, 1, '%', 'The highest elemental resistance the hero can reach (fire, frost, storm, void, venom).', '15-stats.js (computeStats)');
knob('combat', 'Statuses', 1, 'statusChance', 'Elemental status chance', .3, 0, 1, .01, 'x', 'Chance an elemental hit applies its status when it has no chance of its own: fire burns, frost chills, storm shocks, void curses, venom poisons.', '10-combat.js (dealDamage)');
knob('combat', 'Statuses', 2, 'statusPower', 'Status strength', 1, 0, 5, .05, 'x', 'Scales the damage of burns, poison and bleeding.', '05-elements.js (applyStatus)');
knob('combat', 'Statuses', 2, 'statusTime', 'Status duration', 1, .1, 5, .05, 'x', 'How long statuses last on anyone.', '05-elements.js (applyStatus)');
knob('combat', 'Knockback', 1, 'knockback', 'Knockback strength', 1, 0, 5, .05, 'x', 'How far hits shove whoever they land on, both ways. 0 pins everyone in place; heavy monsters (mass) still move less.', '10-combat.js (knock)');
knob('combat', 'Knockback', 2, 'knockUp', 'Launch height', 1, 0, 5, .05, 'x', 'How high uppercuts and blasts throw monsters into the air.', '10-combat.js (knock)');
knob('combat', 'Executions', 1, 'exeLife', 'Execution threshold', .25, 0, 1, .01, 'x', 'A humanoid monster staggered (or crit) by you at or under this share of its life reels and can be executed with E (0.25 = 25%; elites at 60% of it). 0 turns executions off.', '23-executions.js');
knob('combat', 'Executions', 2, 'exeWindow', 'Reeling time', 2, .3, 8, .05, 's', 'How long a staggered monster stays open to an execution.', '23-executions.js');
knob('combat', 'Executions', 2, 'exeHeal', 'Execution heal', .06, 0, 1, .01, 'x', 'Share of maximum life an execution or a takedown gives back (it also returns a dodge charge).', '23-executions.js');

/* ---------- Monsters ---------- */
knob('monsters', 'Strength', 1, 'foeHpGrowth', 'Life growth per depth', 1.1, 1, 1.4, .005, 'x', 'Monster life multiplies by this every depth down (1.10 = +10% a depth, compounding). The biggest lever on how fast the deep gets tanky.', '00-core.js (SCALE.foeHp)');
knob('monsters', 'Strength', 1, 'foeDmgGrowth', 'Damage growth per depth', 1.075, 1, 1.4, .005, 'x', 'Monster damage multiplies by this every depth. Compare with item power growth in Loot: when this is the bigger one, the deep eventually outpaces your gear.', '00-core.js (SCALE.foeDmg)');
knob('monsters', 'Strength', 2, 'foeArmorGrowth', 'Armor growth per depth', .15, 0, 2, .01, '', 'Monster armor gains this share of its base every depth.', '30-monsters-core.js (spawnMonster)');
knob('monsters', 'Strength', 2, 'foeSpeedGrowth', 'Speed growth per depth', .012, 0, .1, .001, '', 'Walk speed gained per depth (capped at the limit below).', '30-monsters-core.js (spawnMonster)');
knob('monsters', 'Strength', 2, 'foeSpeedCap', 'Speed growth limit', .35, 0, 3, .01, 'x', 'The most extra walk speed depth can add (0.35 = +35%).', '30-monsters-core.js (spawnMonster)');
knob('monsters', 'Aggression', 1, 'maxAttackers', 'Attackers at once', 1, 0, 4, .05, 'x', 'Monsters take turns: only a few may swing at you at the same moment (3 at first, +1 every 4 depths, at most 8). This scales that limit.', '30-monsters-core.js (AI.maxAttackers)');
knob('monsters', 'Aggression', 1, 'sight', 'Sight range', 1, .2, 4, .05, 'x', 'How far away a monster notices you (150 units, about 9 tiles, for most; it also needs a clear line unless you are very close). When one sees you, its whole pack wakes.', '30-monsters-core.js (AI.aware)');
knob('monsters', 'Aggression', 2, 'turnGap', 'Gap between attacks', 1, 0, 5, .05, 'x', 'Minimum pause between one monster starting an attack and the next one starting (0.22 s, a little random). Lower is relentless.', '30-monsters-core.js (AI.takeTurn)');
knob('monsters', 'Aggression', 2, 'windUp', 'Attack wind-up', 1, .2, 4, .05, 'x', 'How long monsters telegraph a melee swing before it lands (never under 0.36 s by default). Longer is easier to read and dodge.', '30-monsters-core.js (foeSpec)');
knob('monsters', 'Packs', 1, 'packSize', 'Pack size', 1, .2, 5, .05, 'x', 'Monsters per pack (4 to 8 before Difficulty’s "Monster density").', '30-monsters-core.js (spawnPack)');
knob('monsters', 'Packs', 2, 'packsPerRoom', 'Packs per room', 1, .1, 5, .05, 'x', 'How many packs each room of a level holds. Takes hold from the next level.', '50-levels-core.js (populate)');
knob('monsters', 'Packs', 2, 'championPacks', 'Champion packs', 0, -5, 20, 1, '+', 'Extra champion packs per level (1, plus 1 every 4 depths, by default).', '50-levels-core.js (populate)');
knob('monsters', 'Elites', 1, 'eliteHp', 'Elite life', 1, .1, 10, .05, 'x', 'Scales the extra life of champions (2.6x a normal monster) and rares (4.2x).', '30-monsters-core.js (spawnMonster)');
knob('monsters', 'Elites', 2, 'eliteDmg', 'Elite damage', 1, .1, 10, .05, 'x', 'Scales the extra damage of champions (1.25x) and rares (1.45x).', '30-monsters-core.js (spawnMonster)');
knob('monsters', 'Elites', 2, 'eliteAffixes', 'Rare affix count', 0, -3, 5, 1, '+', 'Extra affixes (Hasted, Stoneskin, Vampiric...) on rare monsters, on top of 1 + 1 per 6 depths (at most 3).', '30-monsters-core.js (spawnMonster)');
knob('monsters', 'Rewards', 2, 'foeXpGrowth', 'XP growth per depth', 1.11, 1, 1.4, .005, 'x', 'Experience per kill multiplies by this every depth.', '00-core.js (SCALE.foeXp)');
knob('monsters', 'Wardens', 1, 'wardenSight', 'Warden sight', 130, 20, 400, 5, '', 'How far a Warden sees down its lantern cone (world units; 16 = one tile). Walls and pillars cut the cone short.', '32-wardens.js');
knob('monsters', 'Wardens', 2, 'wardenRing', 'Alarm ring time', 1.4, .2, 6, .05, 's', 'Seconds a Warden rings its bell before the alarm goes off. A stagger restarts it.', '32-wardens.js');
knob('monsters', 'Wardens', 2, 'wardenAlarm', 'Alarm reach', 320, 0, 1200, 10, '', 'How far the alarm carries: every monster that hears it (a wall halves it) wakes and comes for you.', '32-wardens.js');

/* ---------- Bosses ---------- */
knob('bosses', 'Strength', 1, 'bossHp', 'Boss life', 1, .05, 20, .05, 'x', 'Multiplies every boss’s life (on top of the Monster life slider and depth).', '35-bosses-core.js (spawnBoss)');
knob('bosses', 'Strength', 1, 'bossDmg', 'Boss damage', 1, .05, 20, .05, 'x', 'Multiplies every boss’s damage.', '35-bosses-core.js (spawnBoss)');
knob('bosses', 'Tempo', 2, 'bossTempo', 'Boss pattern speed', 1, .25, 4, .05, 'x', 'How fast bosses think and chain their patterns (slams, charges, novas...). Higher is a faster fight with less rest between attacks.', '35-bosses-core.js');

/* ---------- Loot ---------- */
knob('loot', 'Drops', 1, 'dropChance', 'Item drop chance', 1, 0, 10, .05, 'x', 'How often monsters drop an item (Difficulty’s "Loot drops" multiplies this too).', '40-loot-core.js (rollDrops)');
knob('loot', 'Drops', 1, 'goldDrop', 'Gold amount', 1, 0, 20, .05, 'x', 'How much gold each pile is worth.', '40-loot-core.js (rollDrops)');
knob('loot', 'Drops', 2, 'potionDrop', 'Potion drop chance', 1, 0, 10, .05, 'x', 'How often monsters drop a potion.', '40-loot-core.js (rollDrops)');
knob('loot', 'Drops', 2, 'eliteLoot', 'Elite & boss items', 1, 0, 10, .05, 'x', 'Items from champions (60% chance of 1), rares (2 to 3) and bosses (5 to 8).', '40-loot-core.js');
knob('loot', 'Rarity', 1, 'rarityBoost', 'Rarity luck', 0, -100, 1000, 5, '%', 'Extra Increased Item Rarity on every drop, as if your gear had it. Higher turns more drops magic, rare and legendary.', '40-loot-core.js (rollRarity)');
knob('loot', 'Item power', 2, 'ilvlGrowth', 'Item power growth', 1.08, 1, 1.3, .005, 'x', 'Weapon damage, flat life and armor on items multiply by this every item level (the twin of monster growth).', '00-core.js (SCALE.ilvl)');
knob('loot', 'Economy', 2, 'prices', 'Shop prices', 1, .05, 20, .05, 'x', 'What the vendor, smith and mystic charge.', '41-loot.js, 42-inventory.js');
knob('loot', 'Economy', 2, 'goldGrowth', 'Gold growth per depth', 1.08, 1, 1.4, .005, 'x', 'Gold per pile multiplies by this every depth.', '00-core.js (SCALE.gold)');

/* ---------- Progression ---------- */
knob('progress', 'Experience', 1, 'xpCurve', 'XP needed per level', 1, .05, 10, .05, 'x', 'Scales the experience every hero level costs. 0.5 levels twice as fast.', '00-core.js (SCALE.xpNeed)');
knob('progress', 'Points', 1, 'skillPts', 'Skill points per level', 1, 0, 10, 1, '', 'Skill points (ranks for actives) gained each level up.', '20-hero.js (gainXp)');
knob('progress', 'Points', 1, 'passivePts', 'Passive points per level', 1, 0, 10, 1, '', 'Passive tree points gained each level up.', '20-hero.js (gainXp)');
knob('progress', 'Skills', 2, 'rankBonus', 'Damage per skill rank', .12, 0, 2, .01, 'x', 'Each rank of a skill past the first adds this share of damage (0.12 = +12% a rank).', '15-stats.js (heroHit)');

/* ---------- Physics & world ---------- */
knob('world', 'Physics', 1, 'gravity', 'Gravity', 1, .1, 5, .05, 'x', 'How hard things fall: monsters thrown into the air, the hero’s falls, hopping slimes, lobbed shots (bone javelins, spit, mortar orbs) and loot bouncing out of corpses. Low gravity floats; lobbed shots overshoot. High gravity slams; they fall short.', '10-combat.js, 20-hero.js, 30-monsters-core.js, 40-loot-core.js');
knob('world', 'Physics', 2, 'projSpeed', 'Projectile speed', 1, .2, 4, .05, 'x', 'Speed of every projectile, yours and theirs (bolts, arrows, orbs).', '10-combat.js (FX.bolt)');
knob('world', 'Time', 1, 'gameSpeed', 'Game speed', 1, .1, 4, .05, 'x', 'The whole world’s clock, like Tools’ simulation speed but kept for your next visit. Under 1 is slow motion.', '00-core.js (slowMo)');
knob('world', 'Time', 2, 'perfectSlow', 'Perfect-dodge slow motion', 1, 0, 3, .05, 'x', 'How long the world slows after a perfect dodge (rolling through a blow). 0 turns it off.', '20-hero.js');
knob('world', 'Feel', 1, 'hitStop', 'Hit stop', 1, 0, 4, .05, 'x', 'The tiny freeze on a solid hit that sells its weight. 0 turns it off.', 'engine game.freeze');
knob('world', 'Feel', 2, 'shake', 'Screen shake strength', 1, 0, 4, .05, 'x', 'Scales every screen shake (the Screen shake switch in Graphics still turns it off entirely).', 'engine game.shake');
knob('world', 'Light & camera', 1, 'ambient', 'Darkness', 1, 0, 6, .05, 'x', 'Scales each place’s ambient light. Higher shows more of the level outside torchlight; 0 is pitch black.', '90-scenes.js (enterWorld)');
knob('world', 'Light & camera', 2, 'camSmooth', 'Camera smoothing', .18, 0, 1, .01, 's', 'How long the camera takes to catch up with you. 0 locks it on you.', 'engine game.cam.smooth');
knob('world', 'Light & camera', 2, 'reveal', 'Map reveal radius', 1, .3, 5, .05, 'x', 'How much of the map around you is uncovered as you explore (9 tiles).', '60-ui-core.js (reveal)');
knob('world', 'Light & camera', 2, 'camLead', 'Camera look-ahead', 1, 0, 4, .05, 'x', 'How far the camera leans toward where you aim.', '90-scenes.js (worldStep)');

/* ---------- the values: shipped defaults, plus what this browser saved ---------- */
const TUNE = Object.assign({}, TUNE_DEFAULT);
{ const saved = E.store.get('ed:tune', {}); if (saved && typeof saved === 'object') for (const k in saved) if (k in TUNE_DEFAULT && Number.isFinite(saved[k])) TUNE[k] = saved[k]; }
const tuneKnob = id => TUNE_KNOBS.find(k => k.id === id);
const tuneChanged = id => Math.abs(TUNE[id] - TUNE_DEFAULT[id]) > 1e-9;
function tuneSave() { const o = {}; for (const k in TUNE) if (tuneChanged(k)) o[k] = TUNE[k]; E.store.set('ed:tune', o); }
/** set a knob (clamped to its range, snapped to its step) and let the game feel it at once */
function tuneSet(id, v) {
  const K = tuneKnob(id); if (!K || !Number.isFinite(v)) return;
  const dec = (String(K.step).split('.')[1] || '').length;
  TUNE[id] = +clamp(v, K.min, K.max).toFixed(Math.max(dec, 3)); tuneSave(); tuneApply(id);
}
/** the knobs read outside a single line: hero stats are recomputed, the clock retimed, monster swings re-measured */
function tuneApply(id) {
  if (ED.hero && ED.hero.stats) computeStats(ED.hero);
  if (!SLOW.live) { SLOW.base = (SLOW.raw === undefined ? 1 : SLOW.raw) * TUNE.gameSpeed; game.timeScale = SLOW.base; }
  if (id === 'windUp' || id === undefined) for (const k in REG.archetypes) REG.archetypes[k]._measured = false;   // (wind-ups are measured once per archetype)
}
function tuneReset(ids) { for (const id of ids || Object.keys(TUNE_DEFAULT)) TUNE[id] = TUNE_DEFAULT[id]; tuneSave(); tuneApply(); }
/* hit stop and shake are the engine's: they are scaled on their way in (10-combat.js budgets hit stop after this) */
{ const f0 = game.freeze.bind(game), s0 = game.shake.bind(game);
  game.freeze = s => f0(s * TUNE.hitStop); game.shake = n => s0(n * TUNE.shake); }
/** every world step (90-scenes.js): the light and the camera follow their knobs. A place sets its own ambient light
 *  when it is entered; the darkness knob scales whatever it set */
const TUNE_LIVE = { on: false, amb: null, ambSet: null, gpu: null, gpuSet: null, cam: false };
function tuneStep() {
  const T = TUNE_LIVE;
  if (TUNE.ambient !== 1 || T.on) {   // (untouched, the light is left alone; back at 1, one last pass restores it)
    if (L.ambient !== T.ambSet) T.amb = L.ambient;
    L.ambient = T.ambSet = clamp(T.amb * TUNE.ambient, 0, 1);
    if (typeof gpu !== 'undefined' && gpu && Array.isArray(gpu.ambient)) {
      if (gpu.ambient !== T.gpuSet) T.gpu = gpu.ambient.slice();
      gpu.ambient = T.gpuSet = T.gpu.map(v => clamp(v * TUNE.ambient, 0, 1));
    }
    T.on = TUNE.ambient !== 1;
  }
  if (game.cam && (tuneChanged('camSmooth') || T.cam)) { game.cam.smooth = TUNE.camSmooth; T.cam = tuneChanged('camSmooth'); }
  const base = (SLOW.raw === undefined ? 1 : SLOW.raw) * TUNE.gameSpeed;   // (the game speed knob, once a world runs)
  if (!SLOW.live && Math.abs(SLOW.base - base) > 1e-9) { SLOW.base = base; game.timeScale = base; }
}
