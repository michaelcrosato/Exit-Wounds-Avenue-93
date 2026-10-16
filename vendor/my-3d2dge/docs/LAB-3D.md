# The 3D Proof and the 3D Prototype: our characters in a fully 3D world

Two temporary, self-contained experiments on the Labs page: the 3D Proof (`/lab-3d`) and, built after it, the 3D
Prototype, the stress test as a 3D world (`/stress-world`, [below](#the-3d-prototype-the-stress-test-as-a-3d-world-v0130)).
Until v0.34.2 they were called the 3D world lab and Stress test: 3D world. The first answers one question:

> Can our character system (rigs, animation, the mocap store, combat poses and their look) live in a real 3D world
> built with three.js and Rapier, with every piece of art drawn by code or made procedurally, while staying as easy
> for AI coding agents to work on as the animation system is?

It is a test, not a new engine. Nothing in `engine/` or `src/emberdeep/` changes: the lab reads the engine's rigs,
the mocap player and Dan's body as they are. When the question is settled, the lab, its vendored libraries and its
Labs entry are deleted or promoted.

**Since v0.34.0 the 3D Prototype's parts are an engine:** `engine/my-3d2dge-3d.js` (the level as text, the physics,
cards and puppets, the cameras, the filters) puts a 3D world under any my-3D2dge game, with its own starter kits
(`docs/ENGINE-3D.md`, D27). The vendored libraries are the engine's now too; the labs stay as the prototypes it came from.

## Running and checking it (since v0.9.0)

The lab is at `/lab-3d` (Labs → Temporary → 3D Proof); locally, run
`node tools/build.mjs`, serve the repository's root (`npx serve`, `python3 -m http.server`) and open
`examples/lab-3d.html`. `node tools/lab3d-test.mjs` (part of `npm test`) checks it: the vendored files' checksums, the
rules below, the same state hash on WebGL 2 and WebGPU, a short session of play, and a picture of every camera and look
(`check-output/lab3d/`). Headless Chromium's WebGPU loses its device as soon as it shows a frame on a canvas, so on
WebGPU the test gives three.js a stand-in canvas context and reads the frames back itself: the whole WebGPU pipeline
runs; only showing the frame is skipped. A real browser shows it.

## Decisions

| Topic | Decision |
|---|---|
| Renderer | three.js **r182** (`three@0.182.0`, released 10 December 2025: the last stable release of 2025). `WebGPURenderer` from `three/webgpu`, which falls back to WebGL 2 by itself when WebGPU is missing. One code path for both. |
| Physics | Rapier 3D, SIMD build, **`@dimforge/rapier3d-simd-compat@0.19.3`** (5 November 2025). The WebAssembly is embedded in the JavaScript, so nothing is fetched at run time. |
| Why these versions | Not the newest on purpose. The core libraries should be ones the models already know well: releases with plenty of examples in their training, so an agent writes working code first time instead of guessing at APIs that changed. r182 and Rapier 0.19.3 are the best mix of what the newest releases offer (r180+ has the mature `WebGPURenderer` and TSL) and what the models know. Both are pinned exactly; upgrading is a deliberate change. |
| GPU rule | WebGPU never decides anything in gameplay. Gameplay (movement, physics, combat, the hero's lap) runs on the CPU at a fixed 60 Hz; the renderer only reads the state. Every visual feature must work on both backends. |
| Art | Everything drawn by code or made procedurally: geometry built in code, textures generated pixel by pixel by code (our `E.tex` functions and a few more in the same style), characters drawn by our engine or built from parts listed as data. No image, model or sound files. No 3D model imports. |
| Player | The hero walks a lap by itself, or the player takes over (move, attack, dash) and pushes and knocks the boxes about. |
| Self-contained | All dependencies are vendored in the repository (`vendor/`), no CDN, no network. |
| Performance | Not a concern for this test. |

## Things to be clear about (trade-offs)

1. **The GPU rule is mostly automatic.** Rapier and our game code run on the CPU, so the renderer can't change
   gameplay by accident. In practice the rule means three things:
   - no WebGPU-only features (compute shaders, storage buffers);
   - materials written only in TSL or as three's node materials, which compile to both WebGPU and WebGL 2;
   - nothing read back from the GPU into gameplay (no GPU picking, no GPU particles that hit things).

   The lab proves it: it runs the same 600 scripted steps on both backends and shows a hash of the game state, which
   must match. The test does this on both backends in a headless browser (WebGPU through SwiftShader).
2. **SIMD needs a 2023-or-later browser.** WebAssembly SIMD runs in every current browser (Safari from 16.4). No
   non-SIMD fallback is planned; adding one later is a one-line package swap.
3. **Self-contained, but served, not double-clicked.** three.js ships as ES modules, which browsers won't load from a
   file opened straight off the disk. The lab is one built page like the other labs (`examples/lab-3d.html`, the
   engine and the lab's code inlined) that loads the vendored libraries from `/vendor/` through an import map. It
   works on the site and from any local web server at the repository's root (`npx serve`,
   `python3 -m http.server`), not from a double-click.
4. **"All art by code" rules out the CC0 model kits.** Props, walls and floors are written as code (boxes,
   cylinders, cones, procedural textures), the way our props are today. Agents can write new ones; nobody imports
   files.
5. **Putting our characters in 3D has two answers, and the lab shows both, alone or side by side:**
   - **Card:** our engine draws the character exactly as it does now, from the camera's angle, into a picture on a
     camera-facing card in the 3D scene. The look is identical. The limits: a character is flat, at one depth (a
     sword can't swing behind a pillar), and it is shaded by our tone ramps, not by the scene's lights.
   - **Puppet:** the same rig, driven by the same animation, but with real 3D parts (tapered limbs, head, hair, cape)
     hung on its joints. Our rig already computes every joint in 3D (`rig.J`, placed in the world by `rig._w`), so
     the motion is identical. The character becomes truly 3D: correct depth, real light and shadow, any camera. The
     look is an approximation of ours (toon shading in our colors, outlines, optional pixel-art pass), not our
     hand-tuned drawing. A puppet's body is a short list of parts written as data (`['limb', 'hipL', 'kneeL', 1.45,
     1.2, 'pants']`), so an agent adds a body the way it adds a clip.
6. **Readable for agents means two rules.** Agents never read the vendored libraries (minified, several MB); they
   read the lab's own small files, each with a header in the style of the agent edition. The known risk is that
   agents write older three.js code (`WebGLRenderer`, `ShaderMaterial`, `EffectComposer`, `onBeforeCompile`) that
   doesn't work with `WebGPURenderer`. A check fails on those APIs, as Riftlight's does.
7. **Cameras.** Fixed presets match our five views (isometric, three-quarter, top-down, brawler, side). Our views
   stretch height slightly (the "boost"); a custom projection matrix reproduces that exactly. Because this world
   has perspective, the lab also offers a free orbit, a free-floating (fly) camera and a third-person chase camera.
   Those come free with real 3D, so they're included even though we decided we could live without them.

## What the lab contains

### The room
- Four walls, four pillars and a floor, built from an ASCII map (`#` wall, `P` pillar, `.` floor, `T` a wall with a
  torch, `c` a crate, `C` two stacked, `m` and `d` where the mocap figure and Dan stand), so an agent can edit the
  level as text (`src/lab3d/20-world.js`).
- Crates in the middle: a stack and a few loose ones, real Rapier bodies that the hero pushes, knocks and topples.
- Procedural materials: flagstone floor (`E.tex.flagstone`, the engine's own), brick walls, stone pillars and wood
  crates, each generated pixel by pixel into a texture with nearest filtering, so texels stay crisp.
- Light: a sun with real shadows, torches on the walls (point lights that flicker), an ambient fill.

### Characters
- **The hero walking a lap round the pillars**, as in the free camera room, or **under the player's control**:
  WASD or the arrow keys move (relative to the camera), J or a click attacks (a three-hit combo from `E.MOVES`),
  K or Space dashes. Attacks knock crates away; walking into a crate pushes it.
- **Card, Puppet, or both:** every character switches together. "Both" splits the screen: the left half shows
  cards, the right half puppets, at the same camera.
- **A mocap figure** playing clips from the store (the hero's set and a CMU take) through `Mocap.drive`, to show
  that the store drives both modes unchanged.
- **Dan**, Emberdeep's custom rig, read from `src/emberdeep/22-char-dan.js` unchanged, prowling and swinging, to
  show that a non-human body works too.
- **The attack's weapon trail**: in Card mode drawn into the picture by the engine, in Puppet mode a real 3D ribbon.

### Cameras
- Fixed: the five engine views, with rotation in 45° steps (Q and E). They follow the hero while the player
  controls it.
- Free orbit: drag to turn and tilt, the wheel to zoom.
- Fly (first person): WASD, R/F up and down, drag or pointer lock to look.
- Chase: a third-person camera behind the hero; the hero moves relative to it.
- Fix camera: puts the current view in the address (`?cam=`) to share or reload.

### Look
- Full resolution, or a pixel-art pass (the scene drawn at the engine's 240 lines and enlarged with whole pixels).
- Outlines (inverted hulls in the engine's outline color), distance fog, shadows: each a toggle.

### Proof and tools
- The backend in use (WebGPU or WebGL 2), `?backend=webgl` to force the fallback, and the game-state hash after the
  fixed scripted run.
- `window.__lab3d`: `run(n)` resets and runs n scripted fixed steps and returns the hash, `state()` returns positions
  and the hash, `camera(code)` sets a camera from its code (as `?cam=` has it), `set(option, value)` (`cam`, `look`,
  `play`, `pixels`, `outlines`, `shadows`, `fog`). Tests and agents drive the lab through it. The address takes
  `?view=` (a camera to start with), `?cam=` (a fixed camera), `?look=`, `?play=1`, `?pixels=0` and `?backend=webgl`.
- An info line per camera and per look, and a list of what carried over from our engine and what didn't.

## How it's built

```
vendor/three-0.182.0/                three.core.min.js, three.webgpu.min.js, three.tsl.min.js, LICENSE, VERSION.json
vendor/rapier3d-simd-compat-0.19.3/  rapier.js (the package's rapier.mjs), LICENSE, VERSION.json
tools/vendor-3d.mjs                  fetches the exact versions once with npm pack, copies the files, records sizes and
                                     sha256 checksums (--check verifies the files on disk against them)
src/lab3d.template.html              the page and its panel, the import map (local paths only)
src/lab3d/                           the lab's code: one module, its parts joined in name order by tools/build.mjs
  00-setup.js                        imports, constants, units (16 engine units = 1 metre = 1 floor tile), helpers
  10-materials.js                    procedural textures (E.tex and friends) and the node materials
  20-world.js                        ASCII map -> wall, pillar, floor and crate meshes, torches, the sun
  30-physics.js                      Rapier world, colliders from the same map, crates, the character controller,
                                     the fixed 60 Hz step, the scripted run and the state hash
  40-characters.js                   the cast (hero, mocap figure, Dan): rig updates, Card mode, Puppet mode
  50-cameras.js                      fixed presets (with the boost), orbit, fly, chase, fix
  60-panel.js                        render loop, look options, controls, info, window.__lab3d
tools/lab3d-test.mjs                 the banned-API check; opens the lab on WebGL 2 and WebGPU, runs the scripted steps,
                                     compares hashes, checks for errors, writes screenshots
```

- `tools/build.mjs` writes `examples/lab-3d.html` (the engine, the mocap player and sets, Dan's body section and the
  lab's module inlined: `@inline-module` joins `src/lab3d/` into one module, `@inline-head` takes the first section of
  `src/emberdeep/22-char-dan.js`, the class `DanRig`); `vercel.json` serves it at `/lab-3d`; `src/labs.json` lists it
  under Temporary with the date and the question. The vendored files are served as they are from `/vendor/`.
- Our engine (`engine/my-3d2dge.js`) is loaded as is, for the rigs, the animation, the mocap store and the textures.
  The lab only reads from it.

## The 3D-drawn stress test (v0.10.0 to v0.13.0, retired in v0.14.0)

`/stress-3d` was the 2D stress test's own game (`src/stress.game.js`, unchanged) drawn by three.js instead of the
engine's canvas, for a head-to-head: cards or puppets in a 3D hall, torchlight and shadows, chase, first-person and fly
cameras, filters. It was retired because it sat between the two things worth having. The engine is already the light
"3D": a 3D world drawn in classic views, side scrolling with depth (Mode 7) and optional WebGPU lighting, with no
libraries, in one file. Real 3D is the 3D world below (`/stress-world`): a hall with height, physics and jumping, where
those cameras have something to show. The 3D-drawn page paid three.js's weight for a world that was still flat, and its
code read the 2D game's internals by name, so it was no 3D view for any other game. Its cameras, filters, lights,
cards and puppets live on in `src/stress-world/`; old `/stress-3d` links open `/stress-world`. What it taught:

- **The rules never read the drawing.** The same game ran under the engine's canvas and under three.js with the same
  results: gameplay that reads only its input and its own state can be drawn any way at all. Both 3D pages keep this
  rule (the proof hash is the same on WebGPU, WebGL 2 and run again).
- **No stalls mid-fight.** A material's first draw builds its shader and GPU pipelines (tens of milliseconds; a 1% low
  of 34 fps at 50 monsters in the first benchmark). Draw everything once, empty, before the fight (again after a
  filter change); share one material per effect pool; keep the card atlas as fixed pages that share one shader.
- **A three.js r182 bug to remember:** an `InstancedMesh` with more than 1,000 instances whose matrices use
  `DynamicDrawUsage` never sends its changes to the GPU (the monsters vanished). Keep the default usage and mark the
  update ranges each frame. With 1,000 or fewer, the matrices live in a uniform buffer named after the mesh, so each
  such mesh made at run time compiles its own shader.

Side scrolling with depth stays on the 2D stress test (M, or `?view=side&depth=1`): a perspective camera on a rail
follows the hero sideways and keeps him 110 to 260 units away, so he shrinks walking into the hall and grows coming
back. The page draws it the SNES way, Mode 7: the floor one screen row at a time, then walls, braziers, telegraphs and
every character back to front, each drawn by the engine at the size its distance gives, at the screen's own resolution
so near and far stay sharp. `node tools/stress-test.mjs` checks the 2D page's cameras: a `?cam=` link, a fixed camera
staying put, side scrolling, and the depth view (the hero shrinks and grows).

## The 3D Prototype: the stress test as a 3D world (v0.13.0)

`/stress-world` (Labs → Temporary → 3D Prototype; locally `examples/stress-world.html`) is the stress test built
again from the ground up as a 3D game. It is not a fair head-to-head and isn't meant to be: it tries to do what the 2D
stress test does (a torch-lit hall, a crowd that takes turns to attack, waves, a particle storm, the same panel and
benchmark) the way a 3D game would, and may look and feel different. What it shares with the 2D games is what is
truly shared: the animation system (the engine's rigs, `E.MOVES`, `E.Attack` and `E.Combo`, the particles' emitters,
the pixel font) and the 2D hall's floor texture and layout. Everything else is its own (`src/stress-world/`).

- **One coordinate system.** The game and Rapier both run in the engine's units with z up (16 units = 1 metre = one
  tile; Rapier's length unit is 16, gravity -480 along z, the 2D slimes' own cartoon gravity), so the rigs, moves and
  reaches read exactly as in the 2D games. three.js gets metres, y up, at the drawing's edge (`toThree`).
- **The hall is text** (`10-hall.js`): a 64 x 44 ASCII map, one character per tile (`#` wall, `P` pillar, `w` low
  wall, `t` brazier, `=` gallery, `^` stairs, `o` the rune dais). It is the 2D hall's layout from the same seeds, plus
  what a 3D hall can add: a raised rune dais with a gentle slope all round, and two galleries along the north wall up
  stairs. The colliders, the floor heights, the walkable grid and the meshes all come from the text. Every texture is
  drawn by code (the floor is the 2D hall's own `floorTex`); pillars have plinths and capitals; braziers burn.
- **Physics** (Rapier 0.19.3, SIMD; `20-sim.js`). The hero is a kinematic capsule moved by Rapier's character
  controller: he walks, dashes, **jumps** (Space: onto low walls and galleries), climbs the stairs and the dais, pushes
  crates, and shoves monsters aside. Every monster is a dynamic body (walkers capsules, slimes balls, wisps weightless
  balls hovering over whatever is below): each step the 2D page's AI sets the velocity a monster wants and the physics
  resolves the crowd, so there is no separation code; knockback is momentum. With **Launches** on, big hits (the spin,
  the thrust) throw bodies up and the fallen fly with the blow, then slide; they stop blocking the crowd. Crates and
  barrels (0 to 300) are knocked about by swings, bolts and the crowd. Swarming monsters follow a flow field over the
  walkable grid, which knows that stairs and the dais's edge climb gently while a gallery's edge is a wall from below
  and a drop from above: they find their way up the stairs after the hero; slimes hop, wisps fly.
- **The proof** works as the 3D Proof's does: `SIM.run(600)` resets and plays a scripted fight (40 mixed monsters, the hero
  walking a square, swinging, dashing, jumping and throwing) and hashes the state. The hash is the same on WebGPU and
  WebGL 2 and when run again: the game reads its controls as input and never the renderer. Its randomness is seeded;
  only particles and the rigs' idle motion use `Math.random` (looks, never read back).
- **Cameras** (1 to 4; `40-cameras.js`). **View**: the engine's five views and a custom turn and tilt, as real 3D
  cameras following the hero with the 2D camera's lag, in **perspective** (a lens: field of view) or **orthographic**
  (the engine's projection; O switches); zoom, camera distance, turn, fix (F), a link. Walls facing an outside camera
  are cut low, and pillars between the camera and the fight are cut to stumps. **Side scrolling** is orthographic, or
  with **depth** (M) the 2D page's Mode 7 rail as a perspective camera. **Chase** (behind the hero, sliding in front of
  walls), **first person** (his eyes; bodies pressed against the camera aren't drawn) and **fly** (WASD, Q and E,
  Shift), and F fixes any of them. In every camera W
  walks away from it and the mouse aims at the floor.
- **Drawing** (`30-crowd.js`, `35-effects.js`, `45-filters.js`): Cards (the engine draws each rig from the camera's
  turn and tilt, at about the screen's pixel size where the hero stands) or Puppets in instanced batches; a blob
  shadow on the surface under every body (under a thrown one too); telegraphs at the floor's height; trails, bolts,
  particles. Filters (N): Comic cel or Pixel on the whole scene, the characters and objects, or the hall, with
  bloom and FXAA, all TSL (the scene draws a mask of the characters alongside the picture, MRT). Resolution: the engine's pixels (the 2D page's 200 to 330 lines,
  enlarged with whole pixels), balanced or full. Fog starts past the hero, however far the camera stands.
- **The numbers.** The loop steps the game in equal steps no longer than a sixtieth, then draws once. The panel and
  the benchmark split the CPU's time three ways: **physics** (Rapier's world step), **logic** (AI, combat, the rigs'
  animation, particles) and **drawing**. In a headless Chromium the game alone costs about 1 ms a step with 100
  monsters, 5.6 ms with 1,000 (2.6 ms physics) and 33 ms with 5,000 crowding the hero (21 ms physics).
- `node tools/stress-world-test.mjs` checks it on both backends: the rules, the same proof hash, a fight in both looks
  with no GPU pipeline built mid-fight, kills and launches, the hero jumping and climbing to a gallery with monsters
  following, a crate knocked about, every camera and filter, W walking away from a fixed camera, the benchmark's
  report. Pictures in `check-output/stress-world/`.
