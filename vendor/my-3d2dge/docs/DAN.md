# Dan, the Brood-Scythe

Dan is Emberdeep's third playable hero. Open **CHARACTER** on the title, choose **Dan**, then **PLAY AS DAN**, or open `examples/emberdeep.html?character=dan#town`. It has a save of its own (`ed:save:dan`); the Wanderer's and Codex's saves are untouched.

A thing the deep grew to harvest the deep. Dan was adapted from a set of concept art (a turnaround, a three-quarter render, and studies of the scythes, the feet and the silhouette) and built through the character recipe (`docs/CHARACTERS.md`): one file, `src/emberdeep/22-char-dan.js`, that registers with `def('characters', 'dan', ...)`.

## From the concept art to the game

The concept is a painted creature about a thousand pixels tall; in the game a hero is about 45 pixels tall and seen from above at an angle. Everything kept had to read at that size in all four views.

| In the concept | In the game | Why |
|---|---|---|
| Two long bone scythes growing from the forearms | Two ivory crescents, bowed away from the body, a bright cutting edge; each swings on its own | The silhouette's signature: the palest, largest shapes, readable on every floor |
| A crown of horns and spikes | Three horns sweeping up and back, the middle one tallest; they rise when it roars | Tells it from the Wanderer and Codex from above |
| A ridge of spines down the back | Six plates from the tail root to the neck | Reads in the three-quarter and top-down views |
| Hunched, reverse-kneed legs, three-taloned feet with a spur | Thigh, knee, hock and a long foot bone, solved with IK; three talons and a spur | The stalk is its motion language |
| Purple egg clusters on the hips | Six sacs, three a hip, that swell and glow as they ripen | Became its resource, the brood (below) |
| Tendrils hanging from the jaw | Three tendrils that fan out when it roars (red while it drinks) | A small, living detail |
| A heavy tail | Five segments that sway against the hips, stream back in a crouch and prop it when it rears | Weight and secondary motion |
| Dark chitin, violet flesh in the seams | Violet-grey chitin with pale lit plates over a darker under-shell, violet veins | The concept's near-black body vanished on dark floors; the sheet measured it at 36-40% contrast on some themes, now 67% or more on all twelve |
| A towering monster | About 1.25x the Wanderer, its head near his height, the crown and the raised scythes over it | Menacing without hiding foes or crowding a phone's screen; its hitbox (radius 5) is close to the other heroes' |

What was left out: the individual scales and the clustered eggs' texture (below a pixel at game scale), and the ground and smoke studies (mood for the depths, not the hero).

## Animation

`DanRig` is a body of its own (the engine's Humanoid is a fixed biped, and the captured clips are human, so it plays none). Every pose is a weight eased toward its state, and the joints are built from those weights:

- **Stalk**: a forward-tilted spine, scythes hanging forward with their tips near the floor, the tail swaying; it breathes harder when wounded.
- **Run**: a loping stride; the feet lift and plant, the body bobs.
- **Dodge**: it drops low and skitters, the scythes swept back along the body.
- **Strikes**: the right scythe, the left, then both in a scissor cut; each blade swings on a critically damped spring, so it gathers speed and settles.
- **Whirl**: the body turns twice with both scythes held out flat.
- **Pounce**: it coils, leaps with both blades reaching forward, and lands driving them down.
- **Rear and roar**: the spine straightens, the scythes spread or lift high, the crown rises, the tendrils fan.
- **Guard**: the scythes cross in front. **Drink**: it hunches over the draught.
- **Fall**: it slumps flat with its legs and scythes splayed, and gets up from there when revived.
- **Arrival**: it drops in, lands in a crouch and roars (moving cuts the roar short).

The character sheet (`npm run character:check -- dan`) finds no pops, no sliding feet, nothing under the floor, and every bone keeps its length (the body lists its 13 rigid bones in `rig.bones`).

## Combat

Dan starts with six skills of its own, at rank 1:

| Slot | Skill | Role | Runes |
|---|---|---|---|
| LMB | Reap | Right, left, then a scissor cut that hurls enemies back; generates Ember | Rending Reap: bleeding. Gorge: the scissor heals |
| RMB | Pounce | A leap to the cursor that lands impaling (a stun); untouchable in the air | Rake: the landing rakes all around. Stalker: farther, sooner |
| 1 | Harvest Whirl | Two turns with both scythes out, four cuts around | Vortex: drags enemies in. Harvest: its kills ripen twice |
| 2 | Hatch | Spends every ripe sac: each becomes a broodling that hunts, bites with void and bursts | Swarm: two more. Volatile: bigger bursts |
| 3 | Frenzy | A roar: faster attacks and movement and life leech for six seconds | Bloodlust: longer. Howl: stuns those close |
| 4 | Brood Burst | Ruptures every ripe sac in a void blast that grows with each one | Venom Brood: a venom pool. Rupture: 40% more damage |

**The brood.** Every kill Dan makes ripens one of the six sacs on its hips (kills by its broodlings do not), shown as six eggs over the skill bar. Hatch and Brood Burst spend all of them, so a player chooses between a swarm and a blast. The autopilot waits for a brood before using either (`bot: { ready }`).

Shared skills, gear, crafting and the passive tree all work as for any hero. Gear changes its stats and its weapon's element colors its scythe trails; its body keeps its own look.

## Verification

- `npm run character:check -- dan`: all ten checks of the character test (its entry and body, the menu and its own save, movement and the dodge, its six skills, every shared skill and its Echo, the paper doll, arriving, drinking, a knockdown, death and revival, every view, the title and gallery, a phone held upright) and a clean sheet.
- `node tools/ed-balance.mjs --character dan --to 10`: the autopilot clears depths 1-10 in 0.73x the Wanderer's time with no deaths (the Wanderer: none), reaching the same level. (Codex: 1.34x, no deaths.)
- `#gallery/skills/dan_reap` (and the other five) plays each skill on the training dummies with its runes.
