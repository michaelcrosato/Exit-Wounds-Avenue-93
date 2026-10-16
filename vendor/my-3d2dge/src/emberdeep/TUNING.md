# Tuning Emberdeep: Settings' tuning pages

Open **Settings** from the title or the pause menu (Esc). It is one window for everything the game can change, its pages listed down the side:

- **Game**: Graphics (the view, the camera's zoom and turn, pixel size, frame rate, full screen, lighting, outlines, particles, screen shake, the automatic quality, the overlays), Sound, Interface (damage numbers, health bars, loot labels, the HUD, the tips), Controls.
- **Playtest**: Difficulty (the quick 0.25× to 4× multipliers) and **Tools**. Tools act on the hero you play, and he saves as usual: the whole game is a test bench. You can:
  - spawn any monster or boss
  - jump to any depth, the town, the Proving Grounds or the Gallery
  - grant points and gold, unlock every skill, make items
  - turn on invulnerability, unlimited resources, no cooldowns, frozen AI, pause and step frame by frame, slow or fast time (the switches last until you reload, and the screen names the ones in force)
  - record a session for a bug report
- **Tuning**: the game's rule numbers, a page per part of the game (below).
- **Help**: every key as bound now, and a "Where do I change…?" list; each question jumps straight to the right setting.

- **Hero, Combat, Monsters, Bosses, Loot & gold, Progression, Physics & world, Skills**: one page for each part of the game. Each page:
  - opens with a short description of what that part does
  - lists its settings in groups, and each setting says:
    - what it changes, in plain words
    - its default and range
    - the source file that reads it
  - has a reset for the whole page
- **Simple / Advanced**: Simple shows the settings that change the game the most, plus any you have changed. Advanced shows every setting.
- **Find a setting…**: searches every page at once, Graphics to Tuning. It also finds monsters, bosses, items and skills by name, and opens them in their inspector.
- **Inspectors** (in Monsters, Bosses, Loot and Skills): pick one part and change any number in its definition. For example:
  - a husk's life
  - a skeleton's second swing wind-up
  - a boss's rest between attacks in phase 2
  - a sword's damage range
  - an affix's roll range
  - a skill's cooldown, ember cost or damage

  Each field is explained, and **↺** puts it back.
- **Copy tuning / Paste tuning** (on every tuning page) move every change you made as a block of JSON. Paste it back later, share it, or give it to Claude and ask to "make these the new defaults".

Changes take effect at once and are saved in this browser (`ed:tune` for the settings, `ed:tune:ovr` for inspector edits) until you reset them. While anything differs from the shipped game, a small **TUNED** marker shows at the top of the screen. The Difficulty page (0.25× to 4×) is separate, and still the quickest way to make playtesting easier or harder.

**When changes apply**
- **At once:** hero stats, combat rules, gravity and the AI.
- **From the next spawn:** inspector edits to monster life, damage and size. In Tools, use **Clear enemies** and then **Spawn**, or the inspector's own **Spawn one to test** button.
- **From the next level:** pack counts per room.

## Where do I change…?

| I want to… | Go to | In the code |
|---|---|---|
| Make monsters more or less aggressive | Monsters → Aggression: sight range, attackers at once, gap between attacks, wind-up | `30-monsters-core.js` (`AI`) |
| Change one monster (life, speed, damage, an attack's timing) | Monsters → Monster inspector | its `def('archetypes', …)` in `30-monsters-core.js`, `31-monsters.js` or `33-beasts.js` |
| Change how one monster moves or decides | *Code:* ask Claude | its AI is `def('ai', …)` next to the archetype |
| Gravity, how things fall | Physics & world → Gravity | `10-combat.js`, `20-hero.js`, `30-monsters-core.js`, `40-loot-core.js` |
| How an item works (damage, armor, rolls, rarity) | Loot → Item base / Item affix inspectors | `40-loot-core.js`, `41-loot.js` |
| A legendary power or unique's effect | *Code:* ask Claude | `def('powers', …)` / `def('uniques', …)` in `40-loot-core.js`, `41-loot.js` |
| More or better loot | Loot → Drops, Rarity luck | `40-loot-core.js` (the kill drop listener, `rollRarity`) |
| Dodge distance, speed or recharge | Hero → Dodge roll | `18-characters.js`, `20-hero.js` |
| The deep gets too hard or too easy | Monsters → Life and Damage growth per depth, against Loot → Item power growth | `00-core.js` (`SCALE`) |
| Boss life, damage, tempo, phases | Bosses, plus the Boss inspector | `35-bosses-core.js`, `36-bosses.js` |
| A skill's damage, cost or cooldown | Skills → Skill inspector | `25`–`29-*.js` |
| How fast you level | Progression | `00-core.js` (`SCALE.xpNeed`), `20-hero.js` (`gainXp`) |
| How hits feel (freeze, shake, knockback) | Physics & world → Feel, Combat → Knockback | `10-combat.js` |
| Light, darkness and the camera | Physics & world → Light & camera | `90-scenes.js` |
| A level's layout, theme or mechanic | *Code:* ask Claude | `50-levels-core.js`, `51-themes.js`, `52-layouts.js`, `45`–`47-mechanics-*.js` |

Some things are behavior rather than numbers, such as a new attack, a different way to move, or a new item power. For those, describe what you want and name the part. The table shows the file where each part lives.

## Every setting

The game reads each setting from `TUNE.<id>` (defined in `src/emberdeep/01-tune.js`). Every default matches the shipped game, so an untouched game plays exactly as before.

### Hero

How your character moves, survives and recovers: running, the dodge roll, potions, and the base numbers every level starts from (before gear and passives).

| Setting | Tier | Default (range) | What it changes |
|---|---|---|---|
| **Run speed** (Movement) | Simple | 1× (0.25× to 4×) | How fast you walk around (the Wanderer runs 84 units a second, the Codex 90; one tile is 16). Gear and passives with Movement Speed add on top. |
| **Acceleration** (Movement) | Advanced | 1× (0.1× to 4×) | How quickly you reach full speed and stop again. Low feels slippery and heavy, high feels snappy. |
| **Dodge speed** (Dodge roll) | Simple | 1× (0.25× to 3×) | How fast the roll travels. Distance = speed x duration, so raise this to roll farther in the same time. |
| **Dodge duration** (Dodge roll) | Advanced | 1× (0.3× to 3×) | How long the roll lasts (0.27 s for the Wanderer). You are untouchable for the whole roll, so longer also means a bigger safe window. |
| **Dodge recharge** (Dodge roll) | Simple | 1.4 s (0.1 s to 10 s) | Seconds for one spent dodge charge to come back. Faster Dodge Recharge on gear shortens it further. |
| **Extra dodge charges** (Dodge roll) | Advanced | 0 (-1 to +8) | Dodges you can chain before waiting (2 to start). Added to the charges from gear. |
| **Mercy invulnerability** (Getting hit) | Advanced | 0.35 s (0 s to 2 s) | After a hit you are untouchable for this long, so a crowd cannot land five blows in one instant. |
| **Potion healing** (Potions) | Simple | 0.45× (0.05× to 1×) | Share of maximum life one potion restores (0.45 = 45%). A third lands at once, the rest over 1.5 s. |
| **Level-up heal** (Potions) | Advanced | 0.35× (0× to 1×) | Share of maximum life restored when you level up (ember always refills). |
| **Extra potion charges** (Potions) | Advanced | 0 (-2 to +10) | Potions you carry (3 to start). Refilled in town and from potion drops. |
| **Starting life** (Base stats) | Simple | 70 (1 to 2000) | Life at level 0 before gear and passives (Difficulty’s "Hero life" multiplies the final total). |
| **Life per level** (Base stats) | Advanced | 12 (0 to 500) | Life gained each hero level. |
| **Life regeneration** (Base stats) | Advanced | 0.4 (0 to 100) | Life per second at level 0. Grows by "regen per level" each level. |
| **Regen per level** (Base stats) | Advanced | 0.08 (0 to 10) | Extra life per second gained each level. |
| **Maximum ember** (Base stats) | Advanced | 100 (10 to 1000) | Ember is the resource spells and strong skills spend. This is the pool before gear. |
| **Ember regeneration** (Base stats) | Simple | 5 (0 to 200) | Ember per second that refills on its own (basic attacks also generate it on hit). |
| **Critical chance** (Base stats) | Advanced | 5% (0% to 95%) | Chance for any of your hits to crit before gear. |
| **Critical damage** (Base stats) | Advanced | 50% (0% to 500%) | Bonus damage on a crit before gear (50% means a crit hits for 1.5x). |
| **Starting armor** (Base stats) | Advanced | 4 (0 to 1000) | Armor at level 0; it softens physical hits (see Combat > Armor strength). |
| **Armor per level** (Base stats) | Advanced | 3 (0 to 200) | Armor gained each hero level. |
| **Pickup radius** (Base stats) | Advanced | 1× (0.25× to 6×) | How close you must walk to gold and potions before they fly to you. |

### Combat

The rules every hit goes through, for both sides: how much damage rolls vary, how armor and resistances soften a hit, critical strikes, status effects (burn, chill, shock...) and knockback.

| Setting | Tier | Default (range) | What it changes |
|---|---|---|---|
| **Damage roll spread** (Damage) | Advanced | 0.12× (0× to 0.9×) | Every hit rolls within plus or minus this share of its damage (0.12 = 88% to 112%). 0 makes every hit exact. |
| **Base crit multiplier** (Damage) | Simple | 1.5× (1× to 6×) | What a critical hit multiplies damage by before Critical Damage bonuses (monsters’ crits use it too). |
| **Armor strength** (Mitigation) | Advanced | 1× (0× to 5×) | How much armor reduces physical hits. 0 turns armor off; 2 makes every point count double. Armor can never block more than the cap below. |
| **Armor cap** (Mitigation) | Advanced | 0.75× (0× to 0.95×) | The most armor can ever block of one hit (0.75 = 75%). |
| **Resistance cap** (Mitigation) | Advanced | 75% (0% to 95%) | The highest elemental resistance the hero can reach (fire, frost, storm, void, venom). |
| **Elemental status chance** (Statuses) | Simple | 0.3× (0× to 1×) | Chance an elemental hit applies its status when it has no chance of its own: fire burns, frost chills, storm shocks, void curses, venom poisons. |
| **Status strength** (Statuses) | Advanced | 1× (0× to 5×) | Scales the damage of burns, poison and bleeding. |
| **Status duration** (Statuses) | Advanced | 1× (0.1× to 5×) | How long statuses last on anyone. |
| **Knockback strength** (Knockback) | Simple | 1× (0× to 5×) | How far hits shove whoever they land on, both ways. 0 pins everyone in place; heavy monsters (mass) still move less. |
| **Launch height** (Knockback) | Advanced | 1× (0× to 5×) | How high uppercuts and blasts throw monsters into the air. |

### Monsters

How monsters are built and how they fight: their life and damage, how they grow with depth, how many gang up on you at once, packs, and elites (champions and rares). Use the inspector at the bottom to change one monster type.

| Setting | Tier | Default (range) | What it changes |
|---|---|---|---|
| **Life growth per depth** (Strength) | Simple | 1.1× (1× to 1.4×) | Monster life multiplies by this every depth down (1.10 = +10% a depth, compounding). The biggest lever on how fast the deep gets tanky. |
| **Damage growth per depth** (Strength) | Simple | 1.075× (1× to 1.4×) | Monster damage multiplies by this every depth. Compare with item power growth in Loot: when this is the bigger one, the deep eventually outpaces your gear. |
| **Armor growth per depth** (Strength) | Advanced | 0.15 (0 to 2) | Monster armor gains this share of its base every depth. |
| **Speed growth per depth** (Strength) | Advanced | 0.012 (0 to 0.1) | Walk speed gained per depth (capped at the limit below). |
| **Speed growth limit** (Strength) | Advanced | 0.35× (0× to 3×) | The most extra walk speed depth can add (0.35 = +35%). |
| **Attackers at once** (Aggression) | Simple | 1× (0× to 4×) | Monsters take turns: only a few may swing at you at the same moment (3 at first, +1 every 4 depths, at most 8). This scales that limit. |
| **Sight range** (Aggression) | Simple | 1× (0.2× to 4×) | How far away a monster notices you (150 units, about 9 tiles, for most; it also needs a clear line unless you are very close). When one sees you, its whole pack wakes. |
| **Gap between attacks** (Aggression) | Advanced | 1× (0× to 5×) | Minimum pause between one monster starting an attack and the next one starting (0.22 s, a little random). Lower is relentless. |
| **Attack wind-up** (Aggression) | Advanced | 1× (0.2× to 4×) | How long monsters telegraph a melee swing before it lands (never under 0.36 s by default). Longer is easier to read and dodge. |
| **Pack size** (Packs) | Simple | 1× (0.2× to 5×) | Monsters per pack (4 to 8 before Difficulty’s "Monster density"). |
| **Packs per room** (Packs) | Advanced | 1× (0.1× to 5×) | How many packs each room of a level holds. Takes hold from the next level. |
| **Champion packs** (Packs) | Advanced | 0 (-5 to +20) | Extra champion packs per level (1, plus 1 every 4 depths, by default). |
| **Elite life** (Elites) | Simple | 1× (0.1× to 10×) | Scales the extra life of champions (2.6x a normal monster) and rares (4.2x). |
| **Elite damage** (Elites) | Advanced | 1× (0.1× to 10×) | Scales the extra damage of champions (1.25x) and rares (1.45x). |
| **Rare affix count** (Elites) | Advanced | 0 (-3 to +5) | Extra affixes (Hasted, Stoneskin, Vampiric...) on rare monsters, on top of 1 + 1 per 6 depths (at most 3). |
| **XP growth per depth** (Rewards) | Advanced | 1.11× (1× to 1.4×) | Experience per kill multiplies by this every depth. |

### Bosses

The boss at the end of every fifth depth: life, damage and how fast its attack patterns come. The inspector changes one boss.

| Setting | Tier | Default (range) | What it changes |
|---|---|---|---|
| **Boss life** (Strength) | Simple | 1× (0.05× to 20×) | Multiplies every boss’s life (on top of the Monster life slider and depth). |
| **Boss damage** (Strength) | Simple | 1× (0.05× to 20×) | Multiplies every boss’s damage. |
| **Boss pattern speed** (Tempo) | Advanced | 1× (0.25× to 4×) | How fast bosses think and chain their patterns (slams, charges, novas...). Higher is a faster fight with less rest between attacks. |

### Loot & gold

What drops and how good it is: drop chances, how often items roll magic, rare or legendary, gold, item power, and the price of things in town. The inspector changes one item base (sword, helm, ring...).

| Setting | Tier | Default (range) | What it changes |
|---|---|---|---|
| **Item drop chance** (Drops) | Simple | 1× (0× to 10×) | How often monsters drop an item (Difficulty’s "Loot drops" multiplies this too). |
| **Gold amount** (Drops) | Simple | 1× (0× to 20×) | How much gold each pile is worth. |
| **Potion drop chance** (Drops) | Advanced | 1× (0× to 10×) | How often monsters drop a potion. |
| **Elite & boss items** (Drops) | Advanced | 1× (0× to 10×) | Items from champions (60% chance of 1), rares (2 to 3) and bosses (5 to 8). |
| **Rarity luck** (Rarity) | Simple | 0% (-100% to 1000%) | Extra Increased Item Rarity on every drop, as if your gear had it. Higher turns more drops magic, rare and legendary. |
| **Item power growth** (Item power) | Advanced | 1.08× (1× to 1.3×) | Weapon damage, flat life and armor on items multiply by this every item level (the twin of monster growth). |
| **Shop prices** (Economy) | Advanced | 1× (0.05× to 20×) | What the vendor, smith and mystic charge. |
| **Gold growth per depth** (Economy) | Advanced | 1.08× (1× to 1.4×) | Gold per pile multiplies by this every depth. |

### Progression

How fast you level and what each level gives: the experience curve, skill and passive points, and how quickly the deep gets harder than you.

| Setting | Tier | Default (range) | What it changes |
|---|---|---|---|
| **XP needed per level** (Experience) | Simple | 1× (0.05× to 10×) | Scales the experience every hero level costs. 0.5 levels twice as fast. |
| **Skill points per level** (Points) | Simple | 1 (0 to 10) | Skill points (ranks for actives) gained each level up. |
| **Passive points per level** (Points) | Simple | 1 (0 to 10) | Passive tree points gained each level up. |
| **Damage per skill rank** (Skills) | Advanced | 0.12× (0× to 2×) | Each rank of a skill past the first adds this share of damage (0.12 = +12% a rank). |

### Physics & world

The world itself: gravity (falling, lobbed shots, loot bounce), how far knocks push, time, the camera, light and the screen’s reaction to hits.

| Setting | Tier | Default (range) | What it changes |
|---|---|---|---|
| **Gravity** (Physics) | Simple | 1× (0.1× to 5×) | How hard things fall: monsters thrown into the air, the hero’s falls, hopping slimes, lobbed shots (bone javelins, spit, mortar orbs) and loot bouncing out of corpses. Low gravity floats; lobbed shots overshoot. High gravity slams; they fall short. |
| **Projectile speed** (Physics) | Advanced | 1× (0.2× to 4×) | Speed of every projectile, yours and theirs (bolts, arrows, orbs). |
| **Game speed** (Time) | Simple | 1× (0.1× to 4×) | The whole world’s clock, like Tools’ simulation speed but kept for your next visit. Under 1 is slow motion. |
| **Perfect-dodge slow motion** (Time) | Advanced | 1× (0× to 3×) | How long the world slows after a perfect dodge (rolling through a blow). 0 turns it off. |
| **Hit stop** (Feel) | Simple | 1× (0× to 4×) | The tiny freeze on a solid hit that sells its weight. 0 turns it off. |
| **Screen shake strength** (Feel) | Advanced | 1× (0× to 4×) | Scales every screen shake (the Screen shake switch in Graphics still turns it off entirely). |
| **Darkness** (Light & camera) | Simple | 1× (0× to 6×) | Scales each place’s ambient light. Higher shows more of the level outside torchlight; 0 is pitch black. |
| **Camera smoothing** (Light & camera) | Advanced | 0.18 s (0 s to 1 s) | How long the camera takes to catch up with you. 0 locks it on you. |
| **Map reveal radius** (Light & camera) | Advanced | 1× (0.3× to 5×) | How much of the map around you is uncovered as you explore (9 tiles). |
| **Camera look-ahead** (Light & camera) | Advanced | 1× (0× to 4×) | How far the camera leans toward where you aim. |

### Skills

Every skill’s ember cost, cooldown, ember generated, and a damage multiplier. Pick a skill in the inspector.

| Setting | Tier | Default (range) | What it changes |
|---|---|---|---|

## For developers

**Adding a setting**
1. Add a `knob(...)` line in `src/emberdeep/01-tune.js` with a section, group, tier, id, label, default, range, step, unit, a plain explanation and the file that reads it.
2. Read `TUNE.<id>` where the rule lives.
3. If changing it must recompute something, handle that in `tuneApply`.

The panel, search, badges, reset and copy/paste pick the new setting up automatically, and `tools/ed-tune-test.mjs` checks that every default sits inside its range and is documented.

**Inspectors** list every number in a registered part's spec, except visual fields (palettes, rigs, looks). They explain the fields named in `DEV_FIELD` (`62-developer.js`). An edit is stored as an override keyed `kind.id.path` (for example `archetypes.husk.attacks.0.wind`) and laid over the registry when the game loads.

**Baking settings in:** to turn a pasted settings block into the shipped game, change the matching `knob(...)` defaults and spec numbers, then reset the panel.
