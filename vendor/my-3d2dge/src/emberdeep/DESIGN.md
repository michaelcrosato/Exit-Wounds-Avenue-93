# EMBERDEEP: design and module contract

Emberdeep is my-3D2dge's signature game: a fast hack-and-slash (Diablo IV / Path of Exile II feel) that goes down forever. It showcases the engine: procedural 2D "puppet" animation (Humanoid and Blob rigs, E.MOVES, poses, cloth capes, flowing hair), pixel-art rendering in every classic view, lighting, particles and chip sound.

**The brief (from the owner):**
- The hero is the stress test's swordsman: teal tunic, red cape, dark hair, sword. His animation is the centerpiece. Show off every animation the engine can do, and invent new ones.
- Combat is fluid and fast. There's a deep skill system (actives with ranks and runes, plus a large passive tree), XP, levels, gold and loot like PoE II / D4. Gear visibly changes the hero.
- **Every depth introduces exactly one new element (mechanic), and the level is named after it.** A player can ignore it and still get through by hack-and-slash. Speedrunners and power-levelers can exploit it hard.
- Past the planned depths everything composes: mechanics combine, themes recolor, monsters, bosses and loot are built from parts. The game never runs out.
- **Emberhold**, the town, is fleshed out, with a few core characters who are animated well. There is no story, just one depth after another.
- It's challenging. Difficulty sliders (hero damage, life, speed, and the same for monsters) live in Settings for playtesting.
- A few really high-quality monsters, abilities and elements are the showcase. The procedural, modular systems are "a language of their own".

## Files and load order

`src/emberdeep/*.js` are joined in name order into ONE script inside one IIFE (`00-core.js` opens it, `99-start.js` closes it). Every file shares one scope.

- Top-level `const` / `function` names are visible to every later file.
- They must not collide. Prefix private helpers with your module's short name (e.g. `mechGale_`), or wrap private state in a block `{ ... }` or an IIFE.
- Code that runs at load time may only use things from files that sort before yours. Code inside functions may use anything.

The **core** files, which you must NOT edit, are:

```
00-core.js          setup, input, ED state, DIFF/OPT, REG registries, def(), BUS events, RNG, helpers, SCALE curves
01-tune.js          TUNE: the rule numbers Settings' tuning pages change (knob(...) defaults = the shipped game); see TUNING.md
05-elements.js      elements (phys fire frost storm void venom), statuses, dot(), applyStatus(), statusSpeed(), statusTint()
10-combat.js        units, dealDamage(), killUnit(), knock(), GRID, eachEnemy(), hitCircle(), hitCone(), elBurst(), FX verbs
15-stats.js         STATS, statText(), statSource(), computeStats(), skillRank(), heroHit()
18-characters.js    playable characters: def('characters'), the body contract, checkRig(), charRig(), the Wanderer
20-hero.js          the hero: actions, xp, dodge, potions, drawing, collideUnit(), settleCape()
25-skills-core.js   skill runtime (useSlot, skillCtx, swingAction), ICON, drawSkillIcon, Blade Dance, Ember Bolt
30-monsters-core.js monsters: spawnMonster(), AI helpers + melee/pouncer/orb AIs, affixes, packs, drawFoe(), 5 archetypes
35-bosses-core.js   bosses: spawnBoss(), the 'boss' AI, patterns slam/charge/nova/summon/cleave, composeBoss()
40-loot-core.js     items: RARITY, SLOTS, bases, affixes, makeItem(), equip(), drops, labels, drawItemIcon(), 3 powers
45-mechanics-core.js things (addThing), blast(), heroHitAmount(), the Powder Kegs mechanic (the reference)
50-levels-core.js   PLAN (the planned depths), recipe(), levelName(), the 'halls' layout, the 'crypt' theme, buildLevel()
55-town-core.js     heldItem(), NPC framework (makeNPC/updateNPC/drawNPC/say), TOWN.build hook + fallback, the Waykeeper
60-ui-core.js       UI kit (UI.def/open/close, hot(), button, slider, tipBox, panelBox, menuKeys), HUD, minimap, the pause,
                    death and waystone panels (Settings, the HTML window for everything, is 64-menu.js)
70-audio.js         extra sfx (zap freeze portal clang thud crack bloop roar chime slash2), songs: town deep deep2 title
90-scenes.js        scenes: title, town, level, proving; worldStep/worldDraw; save/load; portals; camera keys
99-start.js         starts the game; window.__ed debug handle
```

If you need a core change, don't edit the file. Work around it through the registries, hooks and BUS events below. If you truly cannot, describe the smallest core change in your final report.

## Tuning numbers

A rule number that a designer may want to change (a speed, a chance, a growth rate, a timing) belongs in `01-tune.js` as a `knob(...)`, read as `TUNE.<id>` where the rule lives. Each knob's default is the shipped value. Settings' tuning pages (`64-menu.js`, `62-developer.js`) list, explain, save and reset every knob. Its inspectors also change any number in a registered spec (monsters, bosses, item bases and affixes, skills). See `TUNING.md`.

## The language (registries)

Register every part with `def(kind, id, spec)`. The kinds, with each spec documented at the top of the file that uses it:

| kind | spec lives in | ids that are CONTRACTUAL (others are free) |
|---|---|---|
| `skills` | 25-skills-core.js | core: `blade`, `ember` |
| `archetypes` | 30-monsters-core.js | core: `husk skeleton knight slime wisp` |
| `ai` | 30-monsters-core.js | core: `melee pouncer orb boss` |
| `affixes` (elite monster affixes) | 30-monsters-core.js | core: `hasted stoneskin vampiric` |
| `bosses` | 35-bosses-core.js | `cinderking` (depth 5), `broodmother` (10), `wyrm` (15) |
| `patterns` (boss attack verbs) | 35-bosses-core.js | core: `slam charge nova summon cleave` |
| `itemBases`, `itemAffixes`, `powers`, `uniques` | 40-loot-core.js | |
| `mechanics` | 45-mechanics-core.js | see the PLAN below |
| `themes` | 50-levels-core.js | see the PLAN below |
| `layouts` | 50-levels-core.js | `halls` (core), `islands`, `arena`, `caves` |
| `npcs` | 55-town-core.js | `waykeeper` (core) |
| `characters` (playable heroes) | 18-characters.js (recipe: `docs/CHARACTERS.md`) | `wanderer` (core), `codex` (21-codex.js), `dan` (22-char-dan.js) |
| `songs` | 70-audio.js | core: `town deep deep2 title` |

UI panels are registered with `UI.def(id, spec)`. Contractual panel ids:

- `inventory` (I), `skills` (K), `tree` (P);
- `smith`, `vendor`, `mystic` (the services town NPCs open);
- core: `pause settings death waystone`.

### The planned descent (50-levels-core.js PLAN). Every id here must exist.

| depth | mechanic id | level name | theme id | layout | boss |
|---|---|---|---|---|---|
| 1 | `powder` (core) | The Powder Vaults | crypt (core) | halls | |
| 2 | `wards` | The Warded Halls | crypt | halls | |
| 3 | `chasm` | The Sundered Bridges | ruins | islands | |
| 4 | `gale` | The Howling Galleries | ruins | halls | |
| 5 | `magma` | The Molten Throne | forge | arena | cinderking |
| 6 | `ice` | The Rime Deep | frost | caves | |
| 7 | `brood` | The Brood Warrens | fungal | caves | |
| 8 | `pylons` | The Stormglass Mines | mine | halls | |
| 9 | `timewell` | The Stilled Clockworks | clockwork | halls | |
| 10 | `webs` | The Webbed Lair | fungal | arena | broodmother |
| 11 | `dark` | The Lightless Maw | abyss | caves | |
| 12 | `bloodrush` | The Crimson Rush | ossuary | halls | |
| 13 | `launch` | The Leaping Spires | sky | islands | |
| 14 | `flood` | The Drowned Aqueduct | aqueduct | halls | |
| 15 | `quake` | The Shuddering Descent | cavern | arena | wyrm |

**Level names** (`levelName`, 50-levels-core.js) always name the new element. A planned depth takes its mechanic's `title`. A boss depth weaves the element into the boss's lair: the mechanic's `adj` + the last word of the boss's `levelName` ('The Brood Mother's Lair' + webs = 'The Webbed Lair'); the boss's own name is on its wake card.

Past depth 15, `recipe()` composes each depth:
- a random theme, recolored by `L.hue` (a recolor never brightens a material; a theme with `pale: k` also dims by k when it turns);
- a random layout;
- a NEW combination of mechanics (`comboAt(depth)`), at this pace:
  - depths 16-30: pairs;
  - 31-60: a triple one depth in three; 61-100: two in three;
  - 101-200: a quad one depth in three; 201 on: two in three;
  - a boss depth keeps one element fewer than its neighbours (never under two), so the boss is the show;
  - within a size every combination comes once, and each depth takes the one whose elements were seen least recently, so all fifteen keep turning up. A size that runs dry (quads, past depth ~2000) draws random ones;
  - why this pace: every element is freshly learned at 15, so pairs come first while each is still being mastered; each bigger size then arrives as an occasional spike before it becomes the norm, so the climb in complexity is felt every few depths without a wall (the old order, every pair before any triple, kept it flat at two until depth 120 and left the last elements out of play until then);
- the name: every element's `adj`, newest first, on a place noun from the theme's `nouns`: 'The Molten, Howling Crypts' (a noun holding any mechanic's adjective, like 'Sundered Halls', is skipped);
- a composed boss every 5th depth, built from patterns.

Mechanics, themes, archetypes, affixes, patterns and powers must therefore work in ANY combination: with each other, in any theme, at any depth and in any layout. Missing ids fall back gracefully.

### Words a mechanic and a theme carry
- A mechanic: `name`, `title` (its level name when introduced), `adj` + `noun` (composed names), `tip` (the rule and the exploit: its card and HUD icon), and for combination cards `brief` (its rule in about 40 characters), `lure` ('into a rune circle': where to bring a pack), `act` ('strike a keg': how to finish it there), `move` ('Knock packs down a wind lane': a mechanic that carries foes), `zone` ('rune circles': a place to fight inside).
- A theme: `nouns` (the place in composed names), `pale: .9` (a pale theme dims when a deep level recolors it), `lightR` / `lightI` (its braziers' light radius and intensity, default 124 and 1.25: a pale theme keeps them lower, or fights bleach its floor white).

### Standard floor tags (50-levels-core.js)
Floor tags are shared by themes, layouts and mechanics: `pit` (void, blocked for walkers; knocked-back, airborne and flying monsters cross it), `water` (slows), `deep` (blocked), `ice` (no traction), `lava` (burns), `web` (slows; fire should clear it), `blood`, `snow`.
- **Every theme's `floor(L, x, y, tag)` must start with** `const s = standardFloor(L, x, y, tag, (a, b) => <this theme's floor at a, b with no tag>); if (s !== undefined) return s;`. The theme may then render its own tags too.
- Their effects are applied by the core for every unit (`floorEffects`), so mechanics that add ice, water, lava or webs get the behaviour for free. Add only what is special.
- To add blocked tags at runtime, also set `L.map.blocked[i] = 1`, and reset `L.map.floors = {}` to re-bake the floor.

### Skill ids (contract, so powers, passives and the skills panel can refer to them)
`blade`, `ember` (core); melee: `cleave whirlwind lunge leap uppercut kick flurry bladethrow`; spells: `frostnova chainlightning meteor voidrift bladestorm echo warcry blink`.

## Core concepts you will use

- **ED** (shared state): `ED.hero`, `ED.L` (the current level or town), `ED.foes`, `ED.allies`, `ED.corpses`, `ED.fx`, `ED.drops`, `ED.boss`, `ED.depth`, `ED.mode`.
- **A level `L`**:
  - `map` (E.TileMap), `flow` (E.FlowField), `w`, `h` (cells), `cells`, `tags`;
  - `rooms` [{x, y, w, h, cx, cy} in cells], `start` / `exit` {x, y} in world, `things`, `props`, `torches`, `runes`;
  - `mechs` [ids], `theme`, `hue`, `pal`, `depth`, `rec`, `randomFloor(R, {minStart, edge, room})`;
  - `seen` (explored mask);
  - hooks: `drawUnder(r)` and `drawOver(r)`, `sky` (colors behind the map), `ambient`.
  - One tile is 16 world units (`T16`). The floor tag at a world point is `L.map.floorAt(x, y)`.
  - To change floor tags at runtime, write `L.map.floorTags[i]` and `L.map.blocked[i]`, then set `L.map.floors = {}` so the floor re-bakes.
- **Units and hits** (10-combat.js):
  - `dealDamage(unit, hit)` with hit fields `{ src, amount, el, kb, ang, up, stun, status, statusChance, statusPower, tags, knockdown }`.
  - Enemy queries: `eachEnemy(team, x, y, r, fn)`, `nearestEnemy(team, x, y, r, skipSet)`.
  - Monsters stagger on hits with `kb > 20` or a `stun`, at most 3 times a second (2 for elites): poise, so light multi-hits can't pin them. An archetype with `stagger: false` never staggers.
  - Archetype flag `ownEntrance`: a boss body that stages its own waking (the Brood Mother's drop, the Wyrm's eruption) keeps it; the generic boss intro only adds the card and the music.
- **Time:** never write `game.timeScale` directly. `slowMo(k, realSeconds, id)` stacks with the others (the slowest wins) and `slowMoReset(base)` clears them on a scene change. The hero emits `'strike'` on the bus whenever any action's rig attack enters its active phase.
  - Area hits: `hitCircle(team, x, y, r, u => hit, set)` and `hitCone(team, x, y, facing, range, half, u => hit, set)`. Both also strike the level's hittable things for team 'hero'.
  - Movement: `knock(u, ang, kb, up)` (`up` launches a unit into the air, a juggle).
- **FX verbs** (10-combat.js): `FX.bolt`, `FX.nova`, `FX.area`, `FX.telegraph`, `FX.strike`, `FX.meteor`, `FX.chain`, `FX.beam`, `FX.wave`, `FX.pull`, `FX.scorch`, and `FX.visual(dur, (r, u, f) => draw, update)`.
  - Every verb takes `team`, `src`, `el` and `hit` (a template).
  - `elBurst(x, y, z, el, n)` bursts particles in any element.
- **Hero hits**: `heroHit(h, scale, { el, tags, kb, skill, extra })` is weapon damage × scale × every increase. Mechanics can scale with `heroHitAmount(scale)`.
- **Things** (45-mechanics-core.js):
  - `addThing(L, { kind, x, y, r, solid, hittable, onHit(hit), update(dt, L), draw(r), mapColor, dead, keep })`.
  - Things with `hittable` are struck by every hero attack. `blast(x, y, r, amount, {src, el})` damages everyone.
- **Unit movement hooks** (set them every step, from your update):
  - `u.traction` (0..1, ice), `u.speedK` (a speed multiplier, mud), `u.drift = [vx, vy]` (wind, currents), `m.timeK` (a monster's clock: time wells; persistent, so reset it yourself);
  - `m.fade` (0..1, darkness);
  - Knocked-back or airborne monsters may cross pits (`kbT`, `air`, `canFly`).
- **BUS** events (`BUS.on(ev, fn, 'level')` is cleared when the level ends; `'global'` persists):
  - combat: `hit {src, tgt, hit, dmg}`, `kill {src, tgt, hit}`, `hurt {tgt, hit, dmg}`, `heroDie`;
  - hero actions: `skill {id, slot, h, ctx}`, `dodge {h}`, `perfectDodge`;
  - loot: `pickup {item}`, `gold {n}`;
  - progress: `levelStart {L}`, `levelEnd {L}`, `bossDown {m}`, `heroLevel {lvl}`, `spawn {m}`, `thingHit {thing, hit}`;
  - stealth: `execute {h, m, kind: 'finish' | 'silent'}` (an execution or a takedown dropped m), `alarm {m, n}` (a Warden rang: n monsters heard it);
  - frame: `step {dt, L}`, `draw {r, L}`.
- **The hero's actions** (20-hero.js):
  - `startAction(h, { name, update(dt) -> keep, rig: {...}, moveK, cancel, face, z, ghost, speed, free, draw(r) })`.
  - `rig` fields go straight into `Humanoid.update`: `attack` (an E.Attack state), `pose`, `air`, `dash`, `run`, `down`, `expr`, `stance`, `point`, `aim`.
- **Stats**: `statSource((h, add) => add('incFire', 10))` adds a source. Stat keys are listed in STATS (15-stats.js). Temporary buffs go in `h.buffs.push({ id, name, color, t, stats: {...} }); computeStats(h)`.
- **UI kit**, inside an `r.overlay(g => ...)` or a panel's `draw(g, x, y, w, h)`:
  - widgets: `button(g, x, y, w, h, label, onClick, {focus, disabled, tip, color, active})`, `slider(...)`, `hot(x, y, w, h, { click, rclick, tip: lines | fn })`;
  - drawing: `tipBox(g, lines, x, y)`, `panelBox(...)`, `E.ui.box`, `E.font.text(g, s, x, y, color, { font: 'tiny', align, outline, shadow })`;
  - `UI.mouse.x / y` are in screen pixels;
  - tooltip lines are `[{ t: 'text', c: '#color', big, sep }]`;
  - text: `notify(text, color, dur)` for the feed, `showCard(title, sub, mechLike, dur)`.

## Core features added after the first build wave
- `92-gallery.js`: the Gallery scene (`#gallery`, and on the title menu).
  - SKILLS plays every `REG.skills` entry on straw training dummies (the `dummy` archetype).
  - BESTIARY plays every archetype except bossBody ones: it walks in, attacks the hero and dies.
  - POSES is the hero's pose vocabulary.
  - Your content shows up there automatically, so make it look good there too.
- `93-autopilot.js`: `botOn(h)` or `__ed.bot(true)` lets an autopilot drive the hero through a virtual input (`h.bot.input`). `__ed.botRun({ to: N, speed: 3 })` plays depth after depth and logs time, level, deaths and kills in `__ed.BOT_RUN.log`. The title screen uses it as an attract-mode demo (`ED.demo`: nothing is saved).
  - The bot reads `S.kind`, `S.tags` ('aoe') and `S.range` to decide when to use a skill.
  - It spends passive points through `autoAllocatePassives(h)` when that function exists.
- `94-tips.js`: `tip(id, text, color)` shows a one-time hint per save. Tips wait for the level card to fade.
- Composed depths (after 15) each introduce a NEW combination (`comboAt(depth)`, pace above). The level card says "NEW COMBINATION".
- **The level card** comes from `levelCardInfo(L)` (50-levels-core.js): `{ title, sub: 'DEPTH n', mech }`. On a planned depth `mech` is the mechanic (its `tip` is the card's text). On a combination it is `{ name: 'A + B', combo: true, ids, lines, tip: '' }`: one line per element, `'Magma Vents: ' + brief`, then `'Together: ...'`, a line on how they play off each other (a hand-written pair in `LVL_SYNERGY` where their systems touch in code, else built from the mechanics' `lure` / `act` / `move` / `zone` words).
- Deep packs vary (`packVariant`): an element (recolor + status), a shared affix on normal monsters, and Giant and Swarming packs.
- The hero:
  - the dodge is a forward roll (the rig's `flip` state, the roll Emberdeep's hero had first: it post-rotates the joints and turns the cape and hair with them);
  - drinking re-solves the left arm with IK;
  - a wounded hero hunches.
- Monsters knocked over a pit fall and die (credited to the hero) when no `chasm` mechanic runs the level.
- HUD:
  - a camera-projected cached automap (Tab shows the big map);
  - a level clock with best times per depth (`h.best`);
  - an edge arrow to a discovered exit;
  - '!' alerts when a pack notices the hero;
  - slow-motion finishers on the last kill of a pack.
- **Notices** (60-ui-core.js): `notify(text, color, dur)` with `dur <= 1.6` goes to the quick line over the skill bar. An item name notified right after BUS `'pickup'` goes to the pickup log. Level-up lines merge. Everything else goes to the top column, which waits for level and boss cards. Buffs may carry `icon(g, x, y, s)`, a `glyph` ('sword', 'shield', 'flame', 'bolt', 'up', 'right', 'heart', 'drop', 'stars'...) or `mech` for their HUD icon.
- **Stash and crafting** (42-inventory.js): `UI.open('stash')` (the chest in Emberhold). `h.stash = { tabs: [4 x 40], mats: { scrap, dust, core }, ess: { powerId: n } }`. Crafting costs gold plus materials (salvage gives materials, not gold), and Seren imprints essences.
- **Endless loot** (40-loot-core.js): affix tiers keep coming past the hand-written ones, with `affixInfo` / `affixText` (roll quality, tier, range) and `rescaleItem(it, ilvl)` (temper). Item grades rise with depth. Legendary powers can be composed from their id (`powerSpec(id)`, `powerFits(id, slot)`, open word registries `cxTrigger` / `cxEffect`), so deep legendaries keep inventing new powers.
- **Endless progression** (28-progression.js): past rank 5 a skill point buys a mastery rank (`h.skills[id].mastery`, diminishing more damage; rune tiers at mastery 5, 15, 30, 50... add +1 rank). Once the 199-star core is complete, seeded rings of deep stars (ids `dp<ring>_<j>`) wake one after another. `PRG_canSpend(h) -> { skill, passive }` says whether an unspent point can buy anything.
- **Bosses** (35-bosses-core.js): a pattern spec carries `role: 'close' | 'zone' | 'aid'`; composed bosses pick 2 close + 2 zone + 1 aid (plus a zone past depth 40). Composed bosses use only `bossBody` archetypes (bone king, colossus, flesh titan, the Six-Armed Reaver; the planned set pieces only past depth 100, recolored). A boss that kills the hero keeps a scar (15% life per defeat at that depth, at most 3), cleared by the win.
- **Monster clock**: `foeClock(u)` is a monster's time rate (time wells times the Monster speed slider); its moves, telegraphs and shots follow it. `foeTint(m)` is the one place a monster's hit flash and status tint are decided.
- **Hero**: a one-deep skill queue (`h.slotQ`), moving cancels an action's follow-through (opt out with `moveCancel: false`), near-miss perfect dodges (`heroNearMiss`, and BUS `'foeStrike' { src, x, y, r }` for custom attacks), short knockdowns with a tech roll (he gets up through the engine's `E.ACTIONS.getUp`: sits up, one knee, stands), and a death with weight (hard stop, slow motion, camera push-in).
- **Executions and takedowns** (23-executions.js): a humanoid monster your hit staggers or crits at or under `TUNE.exeLife` of its life reels (`m.reelT`, its outline flickers) and E executes it: the hero leaps onto it and the engine's paired `E.ACTIONS.takedown` moves both bodies (the victim is held with a stun and posed through `m.rigState`). An archetype with `takedown: true` (the Warden) can be taken down from behind, silently, while `m.alarmed` is false. Every one gives back `TUNE.exeHeal` of his life and a dodge charge. `makeNoise({ x, y, z, loud }, except)` lets every monster in earshot hear something (`E.hears`): one with a mind of its own gets `m.hear(k, noise)`, any other wakes with its pack. The autopilot executes whatever it can.
- **Wardens** (32-wardens.js): the `warden` archetype (no packs: one to three walk a beat on each level from depth 3 that has no boss, placed on their own seeded stream at `levelStart`). Its mind is an `E.Suspicion` fed by `E.sees` down its lantern cone (`TUNE.wardenSight`, cut by walls); `r.sightCone` draws exactly that cone, colored by its state. Alert, it rings for `TUNE.wardenRing` (a stagger restarts it; `r.marker` points to it, on or off screen), and the alarm wakes every monster that hears it (`TUNE.wardenAlarm`). It never rang: it leaves its tithe.
- **Rumble** (97-rumble.js): a controller rumbles with every screen shake and the hero's own moments (a blow, a perfect dodge, an elite or a boss falling, a level, his death); the Vibration slider in Controls is the engine's `game.settings.rumble`.
- **Boot and debug** (99-start.js): `game.start`'s `boot` gives the page's boot screen Emberdeep's title, accent and lines and two real steps (every monster's reach measured, the composed depths ordered ahead); `game.debug.snapshot()` (mode, depth, level, foes, the Wardens' states, the hero) is what `tools/check.mjs` and `tools/replay.mjs` print, and `game.debug.teleport(x, y)` moves him.
- **Scenes** (53-scenes.js): small stories laid out in the rooms on top of each theme's own dressing (a robbed tomb, a smith's corner, a wake, a lost expedition's camp, a miners' table) and a scatter of single objects, from the asset store's shapes (the page's set `emberdeep`, cut by `tools/asset-set.mjs`, its colours toned to the game's once at load). They are laid out when a level starts (BUS `levelStart`), from a random stream of their own, clear of everything the level placed (its dressing, the mechanics' things and floors), so the level stands as it would without them. A theme gets them from its `SCENES` entry there (`scenes`: each `{ w, edge, parts: [[id, u, v, o]] }`; `scatter`).
- **The gallery's MOVES reel** (92-gallery.js): the engine's actions on the hero on a little set (a stone block and a low wall drawn with `r.box`, built to face the camera in any view): the execution and the takedown on real monsters, getting up, climbing up and down, hopping down, vaulting, a roll.

## What Emberdeep shows of the engine
Emberdeep is the engine's showcase: when the engine gains something a hack-and-slash can use, it should show here. The map, so the next feature finds its place (and so what is left out is left out on purpose):

| engine | where Emberdeep shows it |
|---|---|
| rigs, `E.MOVES`, `E.Combo`, poses, capes, hair, IK | the hero and every humanoid monster; the flask drunk with IK (20-hero.js); the gallery's POSES |
| Blob rig, custom bodies | slimes, bats, imps (31-monsters.js); crawlers, the serpent, the Watcher (33-beasts.js) |
| `Mocap` clips | the hero's captured moments (96-hero-clips.js) |
| `E.ACTIONS` / `E.Action` | executions and takedowns (paired, aerial and ground), the knockdown's get-up, the gallery's MOVES (climb, vault, hop down, roll) |
| perception: `E.sees`, `E.Suspicion`, `E.hears`, `r.sightCone`, `r.marker` | the Wardens, the noise an execution makes, the alarm |
| `E.targets` | the execution and takedown target |
| lighting (canvas and WebGPU: shadows, casters, heat), particles, `r.glowDisc` | every level; heat over braziers and the forge |
| `E.Backdrop`, themes, wall materials, `E.tones` | the themes (51-themes.js) |
| shapes and the asset store (`r.shape`, `E.addAssets`, `docs/ASSETS.md`) | the themes' barrels, crates, rocks and crystals (51-themes.js); scenes in every room and a scatter of objects, from the page's cut of the store, `src/assets/sets/emberdeep.js` (53-scenes.js); the town's barrels, tables, well, crops, graves and yards (56-town.js) |
| `FlowField`, `TileMap` floors and tags | every level; the mechanics' floors (ice, water, lava, webs, pits) |
| `E.session`, `game.debug`, the boot (`game.start({ boot })`) | Settings → Tools → Record a session; the tools' snapshot; the boot screen |
| `game.fullscreen`, `game.settings` (rumble), `input.rumble` | FULL SCREEN; the Vibration slider; rumble (97-rumble.js) |

Left out on purpose: the standard pause menu, corner and `E.Shell` (Emberdeep keeps its own menus, D21: the canvas pause menu and the Settings window); `E.Mover`, heights and roofs (its levels are flat: a hack-and-slash's floor), `E.Bullets` (its projectiles are `FX.bolt`, which carry elements and hits).

## Where everything is: the menus

Every feature the player or a playtester can reach, and where. A new feature takes its place here, in a menu (a Settings page's data in `64-menu.js`, a Tools button in `62-developer.js`) and in Help's keys when it has one; nothing is left to the console alone.

- **Title**: Continue, New game, Character (each character's own save; play as, view in the gallery), Proving Grounds, Gallery, Settings, Full screen (on a touch screen). Left alone for 28 s it plays the attract demo.
- **In play**: WASD or the arrows move, the mouse aims; LMB, RMB and 1-4 the six skill slots; Space or Shift dodge, Q potion, E use (talk, pick up, execute, take down), T town portal; I bag, K skills, P passives, hold Tab the map, hold Z every loot label; V view, - and = zoom (and the wheel), [ and ] turn, 0 reset the camera, M mute, H hide the HUD; Esc the pause menu. A pad and touch buttons do the same (Settings > Controls).
- **Pause menu** (Esc): Resume, Inventory, Skills, Passives, Settings, Tools, Full screen, Town portal (in a depth), Save and quit.
- **Settings** (`64-menu.js`), a search box over every page:
  - *Graphics*: the camera (view, zoom with its default, turn, reset, smoothing, look-ahead); the picture (pixel size, frame rate, full screen); light (GPU lighting, full lighting, darkness); effects (outlines, particles, screen shake and its strength, screen flashes, reduce motion, skip off-screen animation, automatic quality); overlays (frame rate and timings, collision circles).
  - *Sound*: master volume, music, effects, mute, sound in the background.
  - *Interface*: damage numbers, health bars, loot labels, hide the HUD, the tips again.
  - *Controls*: every action's key and pad binding; stick dead zone, inverted aim, vibration, aim assist; touch buttons (shown, side, size, opacity); a live controller monitor.
  - *Difficulty*: the nine 0.25× to 4× multipliers.
  - *Tools*: invulnerable, unlimited resources, no cooldowns, frozen AI, pause, step a frame, simulation speed, restore life, autopilot; travel (any depth, the town, the Proving Grounds, the Gallery; the attract demo from the title); the autopilot run (depth after depth, logged: `__ed.botRun`); extra mechanics on every depth (`?mechs=`); spawn monsters (kind, count, tier) and bosses, clear them, reveal the map; points, every skill, a level, gold, an item of any level and rarity; record a session; the labs.
  - *Tuning*: a page per section of `01-tune.js` with its inspectors; Simple or Advanced; copy, paste and reset.
  - *Help*: every key as bound now, where to change what, the build, the labs.
- **In town, by walking up**: the vendors, the smith, the mystic, the stash, the waystone (any depth reached, in fives).
- **Links**: `?view=`, `?character=`, `?mechs=`, `?record=1`; `#town`, `#depth-N`, `#proving`, `#gallery/<reel>/<id>`. `window.__ed` for tools and tests.

## Quality bar (read this)

- **Look:** PS1 / N64-era 2D (Symphony of the Night, Legend of Mana), not NES.
  - Shade everything you draw with `E.tones(c)` (deep / sh / base / lt / hi), use 3-5 tones per material, and give everything outlines and depth.
  - Draw only with engine primitives: `px.*`, `r.*`, `E.ui`, `E.font`, props and sprites. Never `ctx.arc` / `fillText` / gradients on the game buffer.
  - Anything that overlaps goes through `r.queue` / `r.actor`. Glowing things use `{ emissive: true }` and `px.glow(g, 1)`.
  - A glow on a monster or a thing that a wall may hide uses `{ emissive: foeGlowSeen(x, y, z) }`: it stays in the depth-sorted pass (where walls cover it) when a wall stands in front of it.
- **Animation is the showcase:**
  - Use the rigs' full vocabulary: every `E.MOVES` move, poses (cheer cast guard kneel crouch wave hips block die down), `expr`, stances, `air`, `run`, `climb`, `hurt`, capes, hair.
  - Invent NEW procedural animation where it helps: new rigs built with `E.ik3`, `E.tones`, `px`; held items with `heldItem()`; new move specs, squash and stretch, secondary motion.
  - Everything animates from continuous values (timers, velocities, easing), never from frame lists.
  - Enemies telegraph: a visible wind-up and a red floor warning (`FX.telegraph` or the melee arc).
- **Feel:**
  - Every hit gets hit-stop (`game.freeze(.03-.06)`), `shake()`, sparks and sound. Deaths and big hits get more.
  - Fast, readable, fair.
- **Modularity:**
  - Your parts must work in any theme, at any depth (scale damage and life with the core curves: monsters via `m.dmg`, hero hits via `heroHit` / `heroHitAmount`), in any view (`V` cycles iso / three-quarter / top-down / brawler; Settings' VIEW row picks one), and at any zoom.
  - They must combine with anything else.
- **Performance:** 100-200 monsters in a level; keep per-frame work small and cull off-screen drawing with `r.visible`.
- **No external files and no network.** Keep the house style: dense, commented code like the rest of the repo, no TypeScript.

## Testing (every module MUST be tested before you report done)

1. `node tools/ed-build.mjs --out <scratch>/mine.html --mine <your files, comma separated>` builds the core plus your files only. Other agents are editing their own files at the same time, so don't use `--all` until the end.
2. `node tools/ed-play.mjs <scratch>/mine.html --hash depth-N --god --out <scratch>/shots --steps "wait:3000 | eval:<js> | aimfoe | click | ... | shot:name | log:<js>"`.
   - `window.__ed` gives you ED, REG, spawnMonster, spawnPack, spawnBoss, makeItem, equip, UI, FX, dealDamage, heroHit and more.
   - Deep links: `#depth-7`, `#town`, `#proving`, and one gallery entry: `#gallery/bestiary/<monster id>`, `#gallery/skills/<skill id>`, `#gallery/bosses/<boss id>`, `#gallery/poses/<pose name>` (add `?view=topdown` or `?character=codex` before the `#`). A wrong name warns with the list of right ones.
   - Steps separated by ` | ` may contain spaces.
3. Look at your screenshots (Read the PNGs) and judge them against the quality bar. Check several views (`eval:__ed.game.setView('threequarter')`).
4. `node tools/filmstrip.mjs <page>#depth-N --steps "..." --crop x,y,w,h` records animations frame by frame. Use it for every new animation. A monster, skill, boss or pose films best from its gallery entry (`<page>#gallery/bestiary/<id> --steps "wait:200 rec:16:36"`). Add `--seed 1` to make the strip repeatable, and `--compare <page built before your change>` to mark exactly what changed.
5. It must run with zero errors in the console and in `game.errors`.
6. A playable character has its own loop: `npm run character:check -- <id>` runs the character test (`tools/ed-character-test.mjs`) and draws the character sheet (`tools/ed-sheet.mjs`). See `docs/CHARACTERS.md`.
