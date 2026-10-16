# The 3D engine and the 3D kits

`engine/my-3d2dge-3d.js` (v0.34.0) puts a real 3D world under a my-3D2dge game: a level written as text, its physics,
its characters, its camera and its picture, drawn by three.js r182 and simulated by Rapier 0.19.3. It is the stress
test's 3D world (`/stress-world`, `docs/LAB-3D.md`) taken apart and made general, so that a game can be built on it the
way the 2D starter kits are built on the engine. Its header is its manual: an agent reads that and the API card, never
the code below them.

| What | Where |
| --- | --- |
| The 3D engine (an ES module) | `engine/my-3d2dge-3d.js`; built copy `dist/my-3d2dge-3d.js` |
| Its manual | its header (the `/*! ... */` comment), with a complete quick-start game; a budget of 6,000 tokens (D27) |
| The 3D starter: a title stage and every 3D slice | `src/starter3d/` and `src/starter3d.template.html`, built into `dist/my-3d2dge-3d.html` ([/3d](https://my-3d2dge.vercel.app/3d)) |
| The 3D kits, one slice each | `dist/kits/my-3d2dge-3d-action.html` ([/kits/3d-action](https://my-3d2dge.vercel.app/kits/3d-action)), `dist/kits/my-3d2dge-3d-platformer.html` ([/kits/3d-platformer](https://my-3d2dge.vercel.app/kits/3d-platformer)) |
| The check | `node tools/kit3d-test.mjs` (in `npm test`) |
| The libraries | `vendor/three-0.182.0/`, `vendor/rapier3d-simd-compat-0.19.3/` (pinned, with checksums: `node tools/vendor-3d.mjs --check`) |

## How it fits the 2D engine

The 2D engine still runs the game. `new E.Game({ ..., bg: null })` makes its canvas clear (new in v0.34.0), so the
game's HUD, menus, notes and touch buttons draw over the 3D picture; everything a 2D game gets comes with it: the loop of
exact fixed steps, scenes, input with rebinding and touch buttons, the pause menu and settings, full screen, the boot
screen, sound. The 3D engine adds `E.World3D` (and `E.THREE`, `E.TSL`, `E.RAPIER`):

- **The level is text**, one character per 1-metre tile, as the stress test's hall was: walls, raised floors, stairs,
  platforms in the air, pits, pillars, braziers and marks, each character's meaning and look in a legend. The ground is
  baked once into one texture (contact shadows at the foot of walls), the sides of raised floors merged per look, walls
  and pillars instanced. The same text gives Rapier's colliders, the heights the game asks about (`ground`, `floorAt`,
  `topH`) and a walkable grid with flow fields that climb stairs and drop off ledges.
- **Actors**: a hero is a kinematic capsule walked by Rapier's character controller (stairs, slopes, curbs, jumps,
  moving platforms, pushing crates, shoving mobs); a mob is a dynamic body, so a crowd pushes and piles up by itself and
  knockback is momentum. Each step the game sets what it wants (a ground velocity, a jump, its rig's move) and
  `world.step` moves it and poses its rig from the 2D engine's rigs and moves (`E.Humanoid`, `E.Blob`, `E.Attack`,
  `E.Combo`, `E.MOVES`).
- **Characters** are drawn as the 3D Prototype drew them: cards (the 2D engine draws each rig from the camera's own turn
  and tilt onto a card in an atlas) or puppets (3D parts on the same joints, in instanced batches with outlines).
- **Things**: pickups and set dressing drawn by code from four shapes with a pen (`world.thing('coin', ...)`, chests,
  doors, flags, springs, trees...), and a registry a game adds kinds to.
- **Shapes**: the 2D engine's objects as data (`docs/ASSETS.md`: the core library, the store's sets, a game's own
  entries) drawn in 3D from the same resolved parts (`E.shapeMesh`), each material's pattern a tile of one atlas texture
  (`E.materialTile`) on one toon material, so a new shape builds no shader; a solid one gets a fixed collider from the
  box the 2D engine collides with (`E.shapeBox`). `world.shape(id, x, y, z, o)`, or `{ shape: 'bench' }` in a legend.
- **The camera**: the 2D engine's views as real 3D cameras (`game.view`, `game.yaw`, `game.zoom`: V, [ ], the wheel, a
  pinch and Settings work as in 2D), a chase camera that swings round behind the hero, first person, fly and fixed (in those a click captures the mouse to
  turn the camera; not while a session is recorded, whose record has no pointer lock). Its
  pose is worked out in the fixed steps, so the controls that read it replay the same.
- **The picture**: torches that light the nearest action (one casting shadows), a sun with shadows, a sky, fog,
  the game's particles in 3D, ground arcs (telegraphs), glows, weapon trails, and the 3D Prototype's filters (Comic cel,
  Pixel, bloom, FXAA); the player picks cards or puppets, the resolution, shadows and the filter in the pause menu
  (`E.World3D.SETTINGS`). Every shader is built in a warm-up frame behind the boot screen, so none stalls the game.
- **The proof**: `world.hash()` after a scripted run is the same on WebGPU, WebGL 2 and run again: the game never reads
  the renderer.

## The kits

Each 3D slice is a complete small game in the style of the 2D slices (dense, commented, procedural art), with
`window.__game.scenes.<slice>.run(n)` for its proof:

- **Action** (`src/starter3d/10-action.js`): the stress test's game cut down to a kit. A torch-lit hall with pillars,
  low walls and a raised dais; a three-hit combo, a dash and the thrust out of it, a jump, an ember bolt; husks,
  skeletons, slimes and wisps in five waves that take turns to attack (at most three at once) and telegraph their swings,
  then a knight; big hits throw bodies; crates and barrels break and drop hearts. Bookcases, benches, sacks and an anvil
  (shapes, in the level's legend) stand along its walls.
- **Platformer** (`src/starter3d/20-platformer.js`): a sunlit course of grass islands over the void, from the start to
  the flag: plank platforms, a terrace and a tower of stone steps, a platform that rides across a gap, a spring up to a
  high deck; a jump held for height, a double jump, a dash on the ground and once in the air; slimes to stomp; coins,
  three stars, checkpoint flags. Its trees (the 2D engine's tree generator), bushes and rocks are shapes.

A kit is the minified 2D engine, the API card, the minified 3D engine with its manual, the shell and one slice: about
200,000 cl100k tokens (a 2D kit is about 180,000 on the same count), so a 200k-token chat holds it with little room; a
coding agent reads the 3D engine's header and the API card and builds from those. Unlike a 2D kit, a 3D kit is not one
self-contained file: it loads the two vendored libraries through its import map, so it is served (D27).

## Checks

`node tools/kit3d-test.mjs`: the 3D labs' rules on the 3D engine's and the kits' sources (WebGPURenderer and node
materials only, no compute or storage buffers, nothing read back from the GPU, vendored imports); the manual's quick start
run as the manual hosts it; every 3D page on WebGL 2 and WebGPU (SwiftShader, through the stand-in canvas the 3D labs'
tests use): the title draws, each slice starts, its proof gives the same hash twice and on both backends, a few seconds
of scripted play move the hero and build no GPU pipeline mid-game; every core shape built and drawn on both backends,
solid where it stands (a hero stops at a crate, lands on a table), and a sheet of each beside its 2D picture; an upright phone (the 3D picture lies exactly under
the game's, the touch buttons are there). Pictures in `check-output/kit3d/`. `tools/doctrine-check.mjs` holds the manual
to its budget; `tools/version.mjs` keeps its version line with the rest.

## Things to know

- **three r182's `compileAsync`** left a light's shadow without its map in this setup (an error on the next frame), so
  `world.prepare()` draws a warm-up frame instead.
- **Rapier's character controller follows a moving floor on some steps and not others.** `world.step` carries a hero on
  a moving platform by the platform's own step, unless the controller has already added it that step.
- **Point lights' shadows are expensive**: each renders the scene six times. A world makes one torch shadow by default
  (`torchShadows`), the 3D Prototype two; a sun's shadow is one pass.
- **An `InstancedMesh` of more than 1,000 instances** never uses `DynamicDrawUsage` (three r182 drops its updates); with
  1,000 or fewer each such mesh's shader is its own, so the card atlas pages keep room for 1,001.
- The 3D Prototype (`/stress-world`, once Stress test: 3D world) stays on the Labs page as the record of what the
  engine was built from, with its own copy of the panel, benchmark and hall. New 3D work goes into the engine and its kits
  (the owner's call, 2026-10-14).
