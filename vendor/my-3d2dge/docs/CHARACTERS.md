# Adding a playable character to Emberdeep

A playable character is one file. It registers with `def('characters', id, spec)` (`src/emberdeep/18-characters.js`), and every place the game treats heroes differently asks that entry: its body, starting skills and gear, save slot, stats, arrival, title pose, paper doll, captured clips. No shared file changes. This page is the recipe, from a brief to a checked hero; the header of `18-characters.js` is the reference for every field.

## The loop

```
npm run new:character -- <id> [--body humanoid|custom] [--name "Ranger"] [--title "The Far-Sighted"]
npm run character:check -- <id> [--quick]     # after every change: syntax, build, the character test, the sheet
node tools/ed-balance.mjs --character <id> --to 5   # once its skills are real: the autopilot against the Wanderer
npm test                                      # before you push: every hero, the templates, everything else
```

1. `new:character` writes `src/emberdeep/22-char-<id>.js`, a hero that already passes every check: an entry, a body (a dressed Humanoid, or a custom body that keeps the contract) and two skills of its own.
2. Change one thing (the brief, the look, a skill), then run `character:check` (`--quick` skips every shared skill and the phone while you iterate). Read its summary and the sheet image (`check-output/sheet-<id>.png`); open the test's screenshots (`check-output/character-<id>/`) only when something failed.
3. Play it: `examples/emberdeep.html?character=<id>#town`, or one gallery entry: `#gallery/poses/fall`, `#gallery/skills/<skill id>` (add `?view=topdown` to change the view). For an animation, record a filmstrip: `node tools/filmstrip.mjs "examples/emberdeep.html?character=<id>#gallery/skills/<skill>" --seed 1 --steps "wait:200 rec:16:20"`.
4. Bump the version and add a line to `CHANGELOG.md` under **Characters** (see `CLAUDE.md`).

## 1. The brief, first

Write it before any code, in the entry's `desc` and `style` and the file's header comment. A brief that answers these keeps every later choice consistent:

- **Who**: who it is and why it goes down, in a sentence. The game has no story; a line is enough.
- **Silhouette**: three words that tell it from the Wanderer and Codex at 40 pixels tall (a hood and floating hands; a broad shield; a tail and a crouch).
- **Motion language**: how it moves and turns (grounded strides, a hover with inertia, quick hops), and how it dodges (a roll, a fold, a blink).
- **Combat**: its role and its starting skills as verbs (cleave, pin, pull, mark). One should hurt what stands in front of it; the character test checks that.
- **Palette**: three materials, each shaded with `E.tones(color)` (deep, shadow, base, light, highlight). Shadows lean cool and highlights warm by themselves.
- **Readability**: it must read at game scale in all four of the game's views (iso, three-quarter, top-down, brawler) on every theme's floor. The sheet measures this.

## 2. Pick the body

| | `--body humanoid` (the default) | `--body custom` |
|---|---|---|
| What it is | The engine's `E.Humanoid`, dressed with the entry's `look` (build, outfit, hair, hat, armor, colors) under the gear | A class of your own, drawn with `px` and `E.tones`, that keeps the body contract |
| What it gets for free | Every move of `E.MOVES`, every pose, IK legs and arms, cloth cape and hair, captured clips, the somersault dodge, the IK potion, the wounded hunch, weapon trails, portraits | Nothing: it animates everything itself (`ownLayers: true`) |
| What it costs | A `look` and a `kit`: tens of lines | A body: Codex's is about 440 lines, Dan's about 250 |
| Pick it when | The hero is a person | The hero is not a person (a book, a wisp, a beast), or the body is the point |

## 3. The entry

`def('characters', id, spec)` in your file. The required fields are `name`, `title`, `color`, `desc`, `style`, `skills` (1 to 6 starting skill ids, slotted LMB, RMB, then 1-4) and the movement numbers `speed`, `acceleration`, `dodgeTime`, `dodgeSpeed` (the Wanderer: 84, 1000, .27, 255). Every hook is optional and falls back to the Wanderer's behavior:

| Field | What it changes |
|---|---|
| `look` | Its Humanoid look under the gear (any `E.Humanoid` option and `colors`); the Echo and paper doll wear it too |
| `rig(h, look, over)` | Its body: return a custom rig (`over` carries the Echo's spectral colors, for a body that wants them) |
| `ownLayers: true` | It animates its own dodge, potion and wounds (the Wanderer's layers would bend a Humanoid's joints) |
| `clips: false` | No captured clips (a Humanoid hero plays the HERO set's moments by default) |
| `head`, `r` | How tall it is (bars and effects sit there) and its collision radius (26 and 4.5) |
| `stats(h, add)` | Flat bonuses: `add('ember', 25)` (stat names: `15-stats.js`) |
| `prime(h)` | Fill its own resource for a cast outside real play: the gallery's demos, Tools' unlimited resources and the character test call it (Dan: a ripe brood) |
| `init(h)` | Fields of its own on every new or loaded hero (Codex: its manuscript pages) |
| `kit(h)` | Its starting gear, over the shared kit (longsword, tunic, shoes, cape) |
| `dropIn(h, from)` | Its arrival in a depth (returns an action, see `20-hero.js`) |
| `titlePose(t)` | Its rig state over the title screen's 12 s loop |
| `preview(h, part, t)` | Extra rig state for the character menu's preview (part 0 idle, 1 run, 2 dodge, 3 cast) |
| `titleZoom`, `dollHeight` | Framing on the title ([1.05, 1.75]) and on the paper doll (31) |
| `menuNotes(el, C)` | Extra lines in the character menu |
| `saveKey` | Its save slot (default `ed:save:<id>`) |

Its own rules (a resource, a passive) go in its file as `BUS.on(...)` listeners that check `h.character === '<id>'`, the way Codex's manuscript pages do in `29-codex-skills.js`.

## 4. A custom body

The body contract is the comment block at the top of `18-characters.js`: `update(dt, s)`, `draw(g, ox, oy, view)`, `drawSmear(r)`, `drawPortrait(g, x, y, size)`, `kick(v)`, `hand(side)`, `head()`, `tip()`, `_w(p)`, joints `J` (at least `hipC`, `shC`, `head`, `handL`, `handR`, `bladeDir`), options `o` (at least `size`), colors `C`, and `x, y, z, facing, t, phase`. `__ed.checkRig('<id>')` drives it through every state and view and names what is missing; the character test runs it first.

What makes a custom body look like it belongs:

- **Ease every weight.** Each state (`dash`, `down`, `pose`, `attack`) moves a number toward its target with `approach(w, target, dt * rate)`, and the joints are built from those numbers. A pose that sets a joint directly snaps, and the sheet flags it as a pop.
- **Project through the view.** Points in its own frame go through `_w`, then `view.p(...)`; use `E.charView(view)` so faces stay readable in steep views, and keep it in `this._lastView` (held items and effects use it).
- **Sort its parts** by `view.depth(...)` and draw far to near, so an arm passes behind the body when it turns away.
- **Pixel rules**: only `px.*` and the engine's primitives, whole pixels, `E.tones` for every material. No `ctx.arc`, no gradients.
- **Keep bones rigid.** Solve a limb with `E.ik3` (a hip to a hock, a shoulder to a wrist) and build a spine as one length at an angle, then list those pairs in `rig.bones` (`[['hipL', 'kneeL'], ...]`): the sheet measures exactly those for stretching. A Humanoid's limbs are measured without it; a custom body that lists none has nothing measured.
- **Blend directions as angles.** A blade's direction blended as a vector passes through zero when two poses point opposite ways and flips; blend its pitch and yaw instead (`DanRig` does).
- **Swing on a spring.** A strike's wind-up, sweep and recovery driven through a critically damped spring gathers speed and settles instead of jumping a frame where one phase hands over to the next.
- Start from the template (`--body custom`), from `CodexRig` in `21-codex.js` (a floating body) or from `DanRig` in `22-char-dan.js` (a beast on reverse-kneed legs with a tail).

## 5. Skills

A skill is `def('skills', id, spec)`; the spec is documented at the top of `25-skills-core.js`. Add `character: '<id>'` to keep it the hero's own. The templates show the two common shapes: a melee swing (`swingAction` with an `E.Attack`, any move of `E.MOVES`) and a projectile (`FX.bolt` from `h.rig.hand('L')`). `26-skills-melee.js` and `27-skills-spells.js` hold many more patterns (leaps, channels, novas, summons). Give the autopilot what it needs: `tags` (melee, proj, aoe, channel, movement), `kind` (basic, core, mobility, ultimate) and, for a heal, `bot: { heal: .65 }`; a skill that spends a resource of the hero's own says when it is worth casting with `bot: { ready: h => h.brood > 1 }`.

## 6. Reading the checks

**The character test** (`tools/ed-character-test.mjs`) fails with the reason in one line. It checks that:
- the entry is complete and the body keeps the contract;
- the hero is picked in the menu and saves to its own slot, and survives a reload;
- it moves and dodges;
- its starting skills cast and one of them hurts;
- every shared skill works with its body, and its Echo has its body;
- it shows on the paper doll;
- it drops into a depth, drinks, is knocked down, dies and is revived;
- it plays in every view, on the title and in the gallery, and on a phone held upright;
- the game throws no error and the engine prints no warning.

**The sheet** (`tools/ed-sheet.mjs`) is one image: every state in every view, a turnaround, and game scale on each theme's floor. Its numbers and what to do about each:

| It says | Do this |
|---|---|
| a pop: a joint jumps far in one step (against the steps around it: a fast, steady sweep is not one) | Ease that pose's weight instead of setting the joint |
| its feet slide while it stands | Keep the feet still in idle; sway the hips instead |
| a joint goes under the floor | Clamp it (`Math.max(1, z)`) or lift the pose |
| a bone stretches | Solve the limb with `E.ik3` so its length holds |
| it nearly vanishes in one view | Give it size or a shape in that view (top-down shows the head and shoulders) |
| few colors | Shade each material with `E.tones` (3 to 5 tones) |
| only n% of it stands out on a floor | Lighten or darken a big area, or add a light trim or glow; the renderer's dark outline does not help on dark floors |

**The balance run** (`tools/ed-balance.mjs`) is a rough guide: the autopilot plays every hero the same way, so a hero that needs a human's timing will look weaker than it is.

## 7. Done

- [ ] The brief is in the file and in `desc` and `style`.
- [ ] `npm run character:check -- <id>` passes and the sheet has nothing left to look at that you did not choose.
- [ ] It looks right in all four views and plays well in the gallery and a depth.
- [ ] The balance run is within reach of the Wanderer's.
- [ ] `npm test` passes; the version is bumped and `CHANGELOG.md` says what was added.
