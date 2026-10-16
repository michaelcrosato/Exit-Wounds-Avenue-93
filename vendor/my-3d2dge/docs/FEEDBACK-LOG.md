# Feedback log

This file keeps the points we did **not** act on from models (and people) who built games on the engine. The same point
coming back from later sources is how a pattern shows, so it can be weighed again. What we do act on goes into a plan
(`docs/HANDOFF-*.md`) and then into the changelog.

- **Sources.** Each round of feedback is a source, numbered `F1`, `F2`, ..., newest last. Each point not acted on gets one
  line (`F1.1`, ...) with a theme.
- **Status.** Each point is one of three:
  - **no**: not a problem for what the engine is for;
  - **deferred**: valid, but not now, with when to take it up;
  - **watch**: handled indirectly, or too early to tell.
- **Patterns.** The themes table counts sources. A theme reaches its threshold at three sources, or at two from different
  model families. Then the next plan takes it up and decides again.
- **Never cleaned up**, like `docs/DECISIONS.md`. A point taken up later is marked **Taken up in v0.x.y** and kept.

## Themes

| Theme | Status | Sources | Take it up when |
| --- | --- | --- | --- |
| Passages under roofs and bridges (one column per cell) | deferred | F1 | a second source asks; the stealth starter needs a bridge it can't fake |
| Side-scroller and shooter kits unused by modern third-person games | no | F1 | if third-person games keep skipping them, give their package a leaner manual |
| Melee helpers (`E.Attack`, `E.Combo`) bypassed | watch | F1 | a game built after the height-aware queries and actions still bypasses them |
| GPU lighting unused | **threshold** | F1, F6 | reached: two model families (F6.5: no lighting of any kind). The next plan takes it up: rethink its space in the manuals |
| One fixed custom view, views never switched | watch | F1 | three sources: make one view the default for third-person kits and their checks |
| Reading the engine's source (F1: its size) | **threshold** | F1, F2, F3, F4, F6 | reached: two model families. The next plan takes it up: F2.1, F3.1 and F4.1 list what the index and cards lack. `docs/HANDOFF-ASSETS.md` (v0.25.1) takes up the asset names (props, textures, presets) and four garbled index lines; `docs/HANDOFF-API-INDEX.md` (folded into D38 to D42 in v0.43.3) takes up the index's part in v0.42.2: the facts F2.1, F3.1 and F4.1 went to the source for, the instance names, and a check that keeps 25 such lookups answered (D39); F6 read the source 3 times (F3: 11), each after a search of the index (F6.1), and `map.bounds`' return is taken up in v0.43.2 (lookup 26); the cards' part is still open |
| The look below the PS1/N64 bar | **threshold** | F2, F3, F4, F6 | reached: three games at 6/10. The next plan takes it up (F2.2, F3.2, F4.2). `docs/HANDOFF-ASSETS.md` (v0.25.1) takes up objects, foliage, materials and contact shadows (done in v0.35.0 to v0.38.0, the plan folded into `docs/ASSETS.md` and `docs/ASSET-IMPORT.md`; the judge's re-run, F6: 5/10 with the core library's shapes, D36); the hero's x-ray dither and three-quarter walls stacking into flat planes are still open |
| `E.Shell` unused, the interface drawn on the canvas | **threshold** | F2, F3, F4, F6 | reached: three games with modern interfaces skipped it. The next plan takes it up (F4.3) |
| Climbing any wall and gliding written by the game (`E.Mover` climbs ledges) | **threshold** | F3, F4, F6 | reached: three games wrote their own (F6.4). The next plan takes it up |
| Not verified on physical phones or native GPUs | no | F1 | a game heads to production (principle 10) |
| Saves, checkpoints and objectives written by the game | watch | F1 | three sources write the same checkpoint or objective code |
| Music written by the game for stealth and chases | watch | F1 | two more sources: built-in `stealth` and `chase` songs |
| Production hardening asked of every game (PWA, wake lock, folds, physical devices, other gamepad mappings) | deferred | F5 | a game heads to production (principle 10) |
| Settings nothing honors yet (frame-rate limit, brightness, text size, HUD scale) | deferred | F5 | the engine or a game has something they would change |
| Assists each game writes (aim assist, auto-fire, hold or toggle, captions) | watch | F5 | two builders write the same assist: the engine gets it, as a standard setting |

## Sources

### F1 · 2026-10-10 · Vesper: The Ninth Bell (Assassin's Creed)

- **Builder:** GPT-6 Astra Pro (OpenAI), in a ChatGPT cloud workspace with a shell, Node 24 and headless Chromium 131;
  no web research.
- **Handed:** the full engine as one file, `my-3d2dge.js` v0.17.2 (`dev-build`), and nothing else.
- **Built:** an isometric stealth and parkour mission in one offline HTML file. That is about 50k cl100k tokens of game
  code (30% UI, 16% facades, 16% traversal, sight, guard AI and takedowns), an engine patch (`vesper-1`: the clock,
  flow-field revisions, the FPS counter) and 16 simulation checks.
- **Used:** the renderer, views, `TileMap`, `Body`, `FlowField`, `Humanoid`, input, camera, particles, audio, the font
  and storage.
- **Acted on:** the plan `docs/HANDOFF-VESPER-FEEDBACK.md` (deleted when done; `git show
  8b736f5:docs/HANDOFF-VESPER-FEEDBACK.md`), in six releases: the clock and the caches (v0.17.5, D16), one height-aware
  spatial API (v0.18.0), the handoff package with the API index and contract tests (v0.19.0, D17), a third-person kit
  (v0.20.0, D18), an HTML UI shell (v0.21.0) and the benchmark (v0.22.0, D19).
- **Where its output went** (about 50k cl100k tokens of game code, the engine excluded; the benchmark's baseline):
  UI 15.2k, 30% (HTML 2.8k, CSS 7.7k, glue 1.5k, HUD and minimap 2.2k, results 1.0k: `E.Shell` now, which rebuilds it in
  2.1k); facades and cached detail drawing 7.9k, 16% (the decoration hook and facade options); traversal, guard AI,
  takedowns, perception and markers 7.8k, 16% (the spatial queries, `E.Mover`, `E.ACTIONS`, perception); city layout,
  dressing and floors 6.6k, 13% (the game's content); the simulation core 4.6k, 9% (the game's rules); setup, input,
  rigs and drawing 4.1k, 8% (the `THIRDPERSON` preset and the stealth starter); saves and checkpoints 1.9k, 4% (F1.8);
  music and sound 1.8k, 4% (F1.9). It also ran its own 1/60 s substeps inside the engine's update, not trusting the clock.
- **Plan items not done:**
  - The traversal clip set (Phase 3, item 2: cut from the motion store where code couldn't match a clip): not needed,
    the rig's code states met the bar on filmstrips. The store has them if a game wants captured motion: `ClimbUp_1m_RM`,
    Climb Wall, Ledge Hang, Pipe Climb, Crawl, `Walk_Stealth`, `Run_Stealth`, `Crouch_Walk`, Roll, `Dive_Roll`,
    `Land_Three_Point` and the NinjaJump pair (the Quaternius, Mesh2Motion and CMU catalogs).
  - The benchmark's runs (Phase 5): the tool is built; the runs spend money and wait on the owner (D19). **Taken up in
    v0.22.1 and v0.22.2:** the owner said yes, and all three briefs ran (F2, F3, F4; `DOCTRINE.md`'s measures).
- **Not acted on:**
  - **F1.1** · kits unused · "PlatformMap, Platformer, Blob, bullets, and projectile patterns: these systems did not
    fit the required movement or actors." **No:** they are for other genres.
  - **F1.2** · melee helpers bypassed · "Combat needed explicit rules for height, perception, and takedowns."
    **Watch:** the plan fixes the cause (height-aware tests, actions, perception) and leaves the helpers as they are.
  - **F1.3** · GPU lighting unused · "A single Canvas view kept rendering and verification consistent." **Watch.**
  - **F1.4** · one fixed custom view, for the same reason. It made its own view (yaw 45, pitch 35, scale 1.27) and
    never switched. **Watch.**
  - **F1.5** · passages under things · "The single-column map model also prevents walkable passages beneath roofs or
    bridges." **Deferred.** The likely shape, when it is taken up, is one solid span per cell: a type gets `base`, so it
    is solid from `base` to `h` instead of from 0. Then collision lets a body pass under when its top is below `base`;
    `groundAt` picks the floor or the deck by the body's `z`; `ray` passes under; `FlowField` gets two nodes in such
    cells; the wall baker draws the span and its underside; and draw order uses footprints (v0.20.0). Spike it first: a
    bridge over a canal and an arch over a street, walked over, walked under and seen through.
  - **F1.6** · file size · "The large source file and references to companion tools that were not supplied increased
    inspection work." **No:** reading the source was a symptom of the missing docs and tools, which the plan
    supplies. Input tokens are cheap, and one file is how the engine ships (D5).
  - **F1.7** · device performance · "They do not establish performance on physical phones or native GPUs." **No:**
    principle 10, discovery first.
  - **F1.8** · game-side systems · it added objective and checkpoint-validation modules (1.9k tokens for saves).
    **Watch:** that is game logic until several games write the same thing.
  - **F1.9** · music · seen in its code, not said: it wrote its own quiet, pursuit and win songs (1.8k tokens with its
    sound effects). **Watch.**

### F2 · 2026-10-11 · the benchmark's Assassin's Creed run ("The Acre Memory")

- **Builder:** Claude Code (Opus 5.5) with `--safe-mode` (none of this machine's instructions or tools), run by
  `tools/agent-bench.mjs`; its brief was Vesper's (F1), minimal.
- **Handed:** the handoff package v0.22.0 (`dist/handoff/`) in an empty directory.
- **Built:** an isometric Acre of sandstone roofs: climbing, guards with sight, takedowns, portrait dialogue, a minimap,
  a title. About 27.5k tokens of game code and a 4.3k-token headless test, in 39 minutes and 185.6k output tokens
  (thinking included); its first build passes `tools/check.mjs` and its test. The subscription's usage limit cut it off in
  its last read-through. It wrote its own headless playthrough bot (a `FlowField` picking the way, input only) to test
  the whole mission. It didn't patch the engine. The judge: 6/10, "strong SNES-era work rather than PS1 polish".
- **Not acted on (yet):**
  - **F2.1** · reading the source · it read the engine below its header 18 times (13 by v0.22.2's stricter count, which
    leaves out scripts that only load the engine), for: the third-person kit's own
    sections (17b-17d) rather than their index lines; the rig's state keys (`flip`, `hang`: the index lists rig methods
    and fields, not what `rig.update` takes); the backdrop and prop preset names and the backdrop's `sun`; `emissive`;
    `px.blend`; the song format (`steps`, `bpm`); `E.Combo`, `E.Attack` and `game.hitFx`; how `Dialog` holds play;
    hats and hoods; the actor box's size. **Threshold** (with F1): the next plan takes it up, likely as index entries
    for option and state keys, preset lists and the song format.
  - **F2.2** · the look · flat lighting, unshaded foliage, and the hero drawn as cyan x-ray dither while he stands in a
    rooftop recess (the stealth starter's `xray` default). **Watch.**
  - **F2.3** · `E.Shell` unused · it drew its interface on the canvas (`Dialog` with portraits, `E.ui` boxes). The brief
    didn't ask for HTML. **Watch.**

### F3 · 2026-10-11 · the benchmark's Breath of the Wild run ("Wild Heights")

- **Builder:** Claude Code (Opus 5.5) with `--safe-mode`, run by `tools/agent-bench.mjs`; the minimal Breath of the
  Wild village brief.
- **Handed:** the handoff package v0.22.1 in an empty directory.
- **Built:** a Kakariko-style village in iso and three-quarter views: climb any wall on a stamina wheel, sprint, swim,
  a paraglider with a bonfire updraft, four Spirit Orbs that each teach one move, a second wheel from the statue, a
  tower to wake, an ending with stats; talking villagers with portraits. About 27.9k tokens of game code and a 4.3k-token
  headless test (48 checks), in 38 minutes, 209k output tokens and $12.75; its first build passes the check and its
  test. No engine patch. The judge: 6/10, "solidly SNES-plus": a warm, well-dressed village, but flat two-tone pines,
  thin shadows, the hero's x-ray dither, and a camp label running into the HUD.
- **Not acted on (yet):**
  - **F3.1** · reading the source · 11 reads below the header, for: the rig's pose weights (`cheer`, `kneel`) and limb
    poses; the level legend; the song format; the pixel scale and the touch stick; the view's camera (`set`); `Body`'s
    collision and ground; the backdrop's drawing; the texture names; the Mover's `dir`; `Dialog.say` and its choices.
    The rig and `Dialog` are what all three runs looked up. **Threshold** (the theme's).
  - **F3.2** · the look · flat pines, thin shadows, and the x-ray dither on the hero behind trees, which the judge took
    for a rendering glitch (as in F2.2). **Threshold** (the theme's).
  - **F3.3** · `E.Shell` unused · its HUD (hearts, orb and rupee counters, the objective line) and dialog are drawn on
    the canvas, and they collide with world labels. **Threshold** (the theme's).
  - **F3.4** · climbing and gliding · it wrote its own climb-any-wall (latching, moving round corners, climb jumps,
    pulling up onto the top: about an eighth of its code) and its own ground movement and paraglider on `E.Body`;
    `E.Mover` climbs ledges and vaults but has no free climbing on a wall face and no glide. **Watch.**

### F4 · 2026-10-11 · the benchmark's Arkham run (the Great Hall)

- **Builder:** Claude Code (Opus 5.5) with `--safe-mode`, run by `tools/agent-bench.mjs`; the minimal Arkham predator
  room brief.
- **Handed:** the handoff package v0.22.1 in an empty directory.
- **Built:** the Great Hall: gothic windows, Joker graffiti, bookshelves, fire drums and lamps, ten gargoyles; six
  armed thugs on patrols, seeing in cones (better in light) and hearing noise, growing afraid as the room empties;
  grapple between gargoyles, glide, silent, drop, inverted and glide-kick takedowns, detective mode with heart rates
  through walls; the Joker heckling with a portrait, music that switches when spotted, a title and win or lose screens.
  It uses the third-person kit (`E.Mover`, `E.ACTIONS`, `E.sees`, `E.hears`, `E.Suspicion`, `r.sightCone`, `r.marker`,
  `FlowField`, `facades`) and `E.Attack`. About 26.2k tokens of game code and a 4.1k-token headless test (48 checks);
  278.8k output tokens with its subagents, $16.50, 41 minutes working and 77 in all: it then waited on a reviewing
  subagent that never reported, until `claude -p` stopped it after 10 minutes. Its first build passes the check and its
  test. No engine patch. The judge: 6/10, "above SNES level but short of the PS1 bar": a well-dressed hall with warm
  light pools, but small, lightly shaded figures, a three-quarter view of flat overlapping wall planes, and the button
  prompts sitting on the dialogue box.
- **Not acted on (yet):**
  - **F4.1** · reading the source · 29 reads below the header, most for the third-person kit's own code (`Mover`, the
    actions, perception: lines 4320-4790, twice) rather than its index lines; then the rig's joints, colours and hood;
    `Dialog`'s modality and its options; the game's lifecycle (`pausable`, `hitstop`, the fade); `r.actor`'s box;
    `hitFx`; `sightCone`; `FlowField`; `E.Attack`. **Threshold** (the theme's).
  - **F4.2** · the look · small, lightly shaded figures that merge when they overlap; in three-quarter, walls and
    pillars stack into flat planes. **Threshold** (the theme's).
  - **F4.3** · `E.Shell` unused · its prompt bar, threat panel and portrait dialogue are canvas boxes, and the prompts
    overlap the dialogue. The three games all wanted a modern interface and none found `E.Shell` worth it: the package
    names it in `API.md` and `AI_GUIDE.md` but the starters and the template game don't use it. **Threshold** (the
    theme's): the next plan decides whether the template and the stealth starter should.
  - **F4.4** · gliding · its glide is its own, on top of `E.Mover`; the grapple it wrote as an `E.ACTIONS` entry, as the
    kit means. **Watch** (with F3.4).

### F5 · 2026-10-11 · the owner's quality prompt (controls, display, accessibility)

- **Builder:** none: the owner's "Universal Game Controls, Display, Accessibility, and Quality Upgrade" prompt (v2),
  which they sent to builders after a game was done, because games came back without full screen, settings or
  rebinding.
- **Taken up in v0.23.0:** the standard features every game gets (D21); the requirement matrix, the action coverage and
  the verification are in `docs/STANDARD-FEATURES.md`.
- **Not acted on (yet):**
  - **F5.1** · production hardening · a PWA manifest and offline play, wake lock, folds and hinges, verification on
    physical phones, an iPhone and controllers, gamepads without the standard mapping, analog trigger values. **Deferred**
    (principle 10: done when a game heads to production).
  - **F5.2** · settings nothing honors yet · a frame-rate limit, brightness, text size and HUD scale: the prompt says not
    to offer a setting with no effect. **Deferred** until the engine or a game has something they would change.
  - **F5.3** · assists and gameplay accessibility · aim assist, auto-fire, hold or toggle for sustained actions,
    subtitles and sound captions, target lock: only the game knows its mechanics; `menu.settings` gives them a place and
    the manuals ask for them. **Watch.**

### F6 · 2026-10-15 · the benchmark's Breath of the Wild re-run ("Hateno Heights")

- **Builder:** Claude Code (Opus 5.5) with `--safe-mode`, run by the instrumented `tools/agent-bench.mjs` (D41) from a
  cloud session; the minimal Breath of the Wild village brief, the brief of F3, approved by the owner (D36, D38).
- **Handed:** the handoff package v0.43.1 (the asset store, the answering index) in an empty directory.
- **Built:** a hillside village in three-quarter view (M for iso): plaster and timber houses with tile roofs from the
  materials, a watchtower, a pond, a plateau and a 176-high spire; climb any wall on a stamina wheel, climb-jumps,
  vaulting, sprinting, a paraglider from an elder on the plateau, falls that hurt, four orbs to find, a title and win or
  game-over screens; a village elder in a dialog box. It placed its benches, signs, crates and trees as core shapes from
  a data list (`r.shape`, `map.solid`). About 14k tokens of game code and a 2.5k-token headless test (31 checks), in 13
  minutes, 66.1k output tokens and $3.43 (the judge $0.12); its first build passes the check and its test. No engine
  patch. The judge: 5/10, "solid SNES level": clean sprites, props and tiles, but mostly empty grass, flat lighting, and
  in iso a black void under a clipped sky, buildings as flat cutouts, a lone hedge block.
- **Read:** the index 8 times by search (4.8k tokens) and once by its first 40 lines, never whole; `API.md` whole (twice),
  `AI_GUIDE.md` in four ranges and by search, `docs/ASSETS.md` in one range.
- **Not acted on (yet):**
  - **F6.1** · reading the source · 3 reads below the header (F3: 11), each within three calls of a search of the index:
    the input presets' code (it grepped the engine for `THIRDPERSON` first; the index names that preset's keys and
    actions in prose), how the pixel primitives fill (the index gives their signatures), and what `map.bounds` returns
    (not in the index: taken up in v0.43.2, lookup 26). That is 3 of its 8 searches followed by the source, which
    reopens the index's split by D38's rule. **Threshold** (the theme's). Taken up in v0.43.4: the index names `px`'s
    members as games write them (`px.disc`, not `E.px.disc`) and each input preset's actions (lookups 27, 28); the
    owner kept the index whole, and the split now reopens only on two runs in a row (D43).
  - **F6.2** · the look · 5/10 against F3's 6/10 on the same brief and model, with objects from the core library
    (no store set): the judge saw empty fields, flat lighting, and the iso view's black void under the backdrop and
    flat building faces. **Threshold** (the theme's).
  - **F6.3** · `E.Shell` unused · hearts, the orb counter and the objective drawn on the canvas with `E.ui`; the elder
    talks in `E.Dialog`. **Threshold** (the theme's).
  - **F6.4** · climbing and gliding · its own climb-any-wall, climb-jump, stamina and paraglider on `E.Body`, without
    `E.Mover`. **Threshold** (the theme's: the third source).
  - **F6.5** · lighting unused · neither `game.lights` nor GPU lighting; the judge: "almost no lighting depth".
    **Threshold** (the theme's: F1 and F6, two model families).
