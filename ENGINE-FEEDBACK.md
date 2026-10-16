# my-3d2dge first-build feedback

Engine: **0.46.1**, runtime build marker **`dev-build`**, upstream commit **`cfa866aa45474868350cad1a7fc015e612f9305f`**, local patch **`EWA93-P1-analog-input+P2-three-stage-fallback`**. These match `ENGINE_VERSION` and metadata read from the actual engine runtime. Three r182 and Rapier 0.19.3 remain version-coherent. Detailed patch and adapters: `docs/ENGINE-PATCHES.md`.

The build uses the full engine's `E.Game` fixed loop/input/settings, `E.World3D`, native kinematic/dynamic actors, `E.Humanoid`, actual Mocap runtime, node materials/WebGPURenderer and the exposed Three/Rapier extension points. Rapier raycast vehicle controllers drive the cars before the engine's one physics step. WebGL2 fallback loaded in Chromium, Firefox and WebKit. The game's larger DOM menus replace `E.Menu`/`E.Dialog`; authored road/foot graphs replace native tile flow; custom urban geometry replaces the shape catalog. City audio uses the game's Web Audio mixer instead of ChipAudio's default retro effects. Native chase camera and `world.clear` are insufficient for this game's orbit/occlusion and combat queries.

Observed documentation/API friction:

- Pinned Three r182 fails at module evaluation in Firefox 155 without `GPUShaderStage`: `self` exists, so its enum expression selected `undefined` before dereferencing `VERTEX`. Forced WebGL cannot bypass a module-scope failure. Local patch P2 uses Three's existing numeric enum fallback when the browser omits that enum, preserving actual WebGPU detection.

- `docs/ENGINE-3D.md` opens with v0.34.0 while the package and engine headers/runtime are 0.46.1. The stale manual label must not be used as version provenance.
- Native `Input` listens for pointerdown/pointerup mouse edges. Those events only fire for a pointer's first/last pressed button, so right-aim + left-fire loses the second button in actual browser events. `InputAdapter` supplements mousedown/mouseup through the same engine press/release state.
- `Input.tick` retains `pressed` and axes but discards analog `GamepadButton.value`. Partial R2/L2 values `.37` / `.21` were unavailable to driving without patch P1. The session recorder already preserves them, so retaining them in gameplay input is a small coherent extension.
- `world.clear` explicitly filters level/platforms. It cannot answer visibility through props/cars/actors, muzzle obstruction or moving camera occluders. `floorAt` likewise knows authored level/platform data rather than arbitrary geometry added to `world.pw`; the game has to query Rapier directly.
- `Actor.setSolid(false)` is a downed-body mode: it still collides with level/props/platforms. It must not be treated as a seated actor mode. The game disables/detaches the body while keeping the actor rendered.
- The 3D constructor still reaches `document.createElement` in `bake` after `World3D.init(game,{render:false})`; that setting alone does not make 3D worlds constructible in plain Node. The actual integration suite therefore runs in browsers, while logical rules use Node tests.
- Mocap's classic scripts expose lexical `Mocap`/`MocapReadable` globals rather than properties on `globalThis`. An ES-module game needs a small explicit bridge after the documented script load order.
- The pinned Rapier forward-axis property setter is named `setIndexForwardAxis`, while its getter is `indexForwardAxis`. The adapter uses and tests the actual API, including steering handedness.

Workarounds in this build:

- `src/engine/units.js`: one metre/engine/Three coordinate boundary, plus quaternion handedness conversion. Physical gravity is 156.96 engine units/s² rather than the default 480.
- `src/engine/world.js::bootEngine`: full engine orchestration; small empty bootstrap tile level; Rapier-backed floor helpers; deferred shader preparation; recoverable module-loading errors; engine shell/corner disabled for the game's interface. The engine still owns fixed stepping/rendering.
- `src/engine/input.js::InputAdapter`: consumes the existing poll, retains analog/replay fields, adds mouse-lock deltas and release-before-reuse latches, synchronizes jump/vault aliases and swaps conflicting rebindings through persisted engine settings. It never adds another gamepad polling loop.
- `src/engine/queries.js::QuerySystem`: tagged entity registry, dynamic raycasts, endpoint-aware visibility, camera sphere sweeps, exit capsule clearance and separate camera/muzzle shot queries.
- `src/engine/vehicles.js::VehicleSystem`: the missing vehicle wrapper, physical mass/forces/suspension, one-step contact damage, complete body disabling for seats, interpolated doors/seat transitions, alternate validated exits and attachment reconstruction. Original car body geometry is batched; wheels stay physically steered and use instancing for presentation.
- `src/engine/camera.js::OrbitCamera`: controller/mouse orbit through the native fixed camera, dynamic sphere obstruction, damped recovery, close-camera actor hiding and optional cosmetic shake that leaves simulation aim unchanged.
- `src/actors/animation.js::AnimationSystem` and `assets/animation/bridge.js`: explicit runtime load order, capture sampling/blending, upper/lower masks and exclusive actions. Managed actors disable automatic posing and receive one explicit rig update after physics; captured root tracks never move bodies. `docs/ANIMATION.md` documents integration and limitations.

The most useful single engine addition would be a public `World3D` query API covering **all collider categories**, with explicit masks, exclusions and tagged entity results. Camera, combat, cover, witness sight, floor placement and seat validation currently need the same direct-Rapier query layer. Broadening that API would remove repeated boundary work while leaving game-specific behavior in the game.

Focused browser tests exercise actual engine stepping, vehicle movement, steering, contacts, seats, analog inputs, query occlusion and capture playback. They do not establish physical-controller completion, hardware-rendered performance or final audiovisual acceptance; those belong in the game's test report.

One early WSL mixed-scene diagnostic produced a Rapier WASM panic and then unsafe-alias errors. Its cause is unresolved. A later instrumented rerun of the full six-scene sequence on unchanged source completed without exceptions or non-finite cached state. The cached-handle vehicle filter is not a proven fix; `docs/ENGINE-PATCHES.md` records the evidence and uncertainty.
