# Engine integration and local patches

Pinned upstream: my-3d2dge 0.46.1, build marker `dev-build`, commit `cfa866aa45474868350cad1a7fc015e612f9305f`. Both full engine and 3D module are used. Vendor files are copied from that exact commit, without a nested Git repository; engine documentation, source assets and selection tools are retained for reproducibility.

## EWA93-P1 — analog input retention

File: `vendor/my-3d2dge/engine/my-3d2dge.js`, `Input.constructor`, `Input.clear`, `Input.tick`.

Upstream polls gamepads once per engine step and records each button's `value` in its session recorder, but its gameplay input only retains `pressed`. Add `padValues` (clamped 0…1), `padMapping`, clear them on loss/reset, and recognize trigger-only analog activity as controller use. Session recording already preserves analog values through `padSnap` / `padObj`; no second polling loop is introduced. An optional sixth field preserves the controller mapping string; replay defaults older five-field records to standard mapping. The game adapter serializes analog values in its normalized frame as well.

## EWA93-P2 — Three r182 import without WebGPU enums

File: `vendor/my-3d2dge/vendor/three-0.182.0/three.webgpu.min.js`.

Firefox 155 exposes browser `self` but no `GPUShaderStage` while WebGPU is unavailable. The pinned Three module chose `self.GPUShaderStage` solely because `self` exists, then evaluated `wR.VERTEX` at module scope; import failed before WebGL fallback could initialize. The same failure occurred with forced `?backend=webgl`. Keep the existing standard enum fallback when either `self` or `self.GPUShaderStage` is absent. Real WebGPU detection/rendering is unchanged; no fake GPU API is installed.

```diff
-wR="undefined"!=typeof self?self.GPUShaderStage:{VERTEX:1,FRAGMENT:2,COMPUTE:4}
+wR="undefined"!=typeof self&&self.GPUShaderStage?self.GPUShaderStage:{VERTEX:1,FRAGMENT:2,COMPUTE:4}
```

## Adapter decisions

- `src/engine/units.js` is the single metre/engine conversion boundary. Engine and Rapier use Z up and 16 units/metre; Three uses metres and Y up. Gravity is deliberately 9.81 m/s² (156.96 engine units/s²).
- `src/engine/world.js` uses `E.Game`'s 120 Hz update/input loop and `E.World3D`'s WebGPU renderer with WebGL2 fallback. Root update calls `vehicles.preStep`, `world.step` once, then `vehicles.postStep`. No adapter calls `pw.step`.
- `src/engine/vehicles.js` uses Rapier's four-wheel raycast vehicle controller. Its up-axis is `indexUpAxis = 2`; its forward setter is the pinned API's unusual `setIndexForwardAxis = 0`. Forces use engine units with physical mass. Contact pairs plus measured velocity loss drive impact damage without another physics step or an undrained event queue.
- Seated actor bodies are disabled and temporarily detached from engine movement (`actor.body = null`), while the actor remains rendered. `src/engine/body-lifecycle.js::setBodyEnabled` zeroes each collider's solver groups before disabling and restores its original groups after re-enabling, preventing the pinned SIMD contact-mask trap diagnosed below. Validated alternate exits restore the same body and collider. `setSolid(false)` alone is insufficient because it still collides with level geometry.
- `src/engine/queries.js` uses explicit all-body Rapier queries. Native `world.clear` excludes props/actors; camera sweeps and weapon obstruction cannot rely on it. Urban `floorAt` uses the authored Rapier geometry rather than the tiny bootstrap tile level.
- `src/engine/camera.js` supplies controller orbit, shoulder aim and a sphere sweep covering the near-plane region. Hold R3/V adds a damped 180-degree rear view in a vehicle and smoothly restores on release. It hides a followed actor when clearance falls below 1.2 m, restores it on recovery, and provides damped cosmetic shake independent of aim/physics. It places the engine camera in fixed mode; it preserves the engine renderer and camera projection path.
- `src/engine/input.js` consumes the already-polled engine input. It adds pointer-lock deltas, normalized recording, and release-before-reuse analog latches after modal/focus clearing; it never polls gamepads independently. Conflicting rebindings swap through persisted engine settings and jump/vault aliases stay synchronized. Mouse mousedown/mouseup edges supplement pointer events because browser pointerdown/pointerup only describe the first/last button; without them aim+fire chords lose the second button. Touch gameplay is disabled as requested.
- `src/actors/animation.js` and `assets/animation/bridge.js` load and sample actual selected Mocap clips, mask upper/lower layers and explicitly pose managed rigs once after physics. `docs/ANIMATION.md` records the sequence and captured root-motion ownership.

Focused tests live in `tests/integration/engine.test.mjs` and `animation.test.mjs`. Browser boot/render verification is recorded separately by the project test report; synthetic controller polling is supplemental to physical hardware testing.

## Recorded P1 patch diff

```diff
--- upstream/engine/my-3d2dge.js
+++ vendor/my-3d2dge/engine/my-3d2dge.js
@@ -642,5 +642,5 @@
      *  anywhere on the screen but the buttons steers by drag(), with no stick drawn: a shooter's ship that follows the
      *  thumb); padAxes: the gamepad's raw axes */
-    this.touchEnabled = true; this.stickSide = 'left'; this.steer = 'stick'; this.stickRadius = 44; this.stickDeadzone = .12; this.padAxes = []; this._taps = new Set(); this._tapsDue = new Set();
+    this.touchEnabled = true; this.stickSide = 'left'; this.steer = 'stick'; this.stickRadius = 44; this.stickDeadzone = .12; this.padAxes = []; this.padValues = []; this.padMapping = ''; this._taps = new Set(); this._tapsDue = new Set();
     /** pinching: two fingers on the canvas are pinching the camera's zoom (they moved apart or together: not the stick,
      *  not a tap). The game lets the player zoom only where its scene does (camera.zoom): then the wheel, - and = (keys no
@@ -897,5 +897,5 @@
   clear() {
     this.held.clear(); this.consumeAll(); this._nowUp.clear(); this._freshUp.clear(); this._pt = {}; this._rk = {}; this._down = null;
-    this.padMove = [0, 0]; this.padAim = null; this._fingers.clear(); this._pinching = false; this._zoomAcc = 1;
+    this.padMove = [0, 0]; this.padAim = null; this.padValues = []; this._fingers.clear(); this._pinching = false; this._zoomAcc = 1;
     this._stickEnd({ pointerId: this.stickId });
     for (const b of this._boundButtons || []) { b.classList.remove('on'); b._inputPointers.clear(); }
@@ -944,5 +944,5 @@
       this.padPrev.forEach((on, i) => { if (on) this.release('Pad' + i); });
       for (const c of ['PadAxisUp', 'PadAxisDown', 'PadAxisLeft', 'PadAxisRight']) this.release(c);
-      this.padPrev = []; this.padMove = [0, 0]; this.padAim = null; this.padAxes = [];
+      this.padPrev = []; this.padMove = [0, 0]; this.padAim = null; this.padAxes = []; this.padValues = []; this.padMapping = '';
       this.padIndex = p ? p.index : null; this.padId = p ? p.id : '';
       if (this.aimSource === 'pad') this.aimSource = 'move';
@@ -951,4 +951,8 @@
       const dz = (x, y) => { const l = Math.hypot(x, y), d = clamp(this.deadzone, 0, .8); return l <= d ? [0, 0] : [x / l * Math.min(1, (l - d) / (1 - d)), y / l * Math.min(1, (l - d) / (1 - d))]; };
       this.padAxes = Array.from(p.axes);
+      // EWA93-P1: retain analog buttons through the engine's one controller poll.
+      this.padValues = Array.from(p.buttons, b => clamp(Number(b.value) || 0, 0, 1));
+      this.padMapping = p.mapping || '';
+      if (this.padValues.some(v => v > .05)) this.lastDevice = 'gamepad';
       this.padMove = dz(p.axes[0] || 0, p.axes[1] || 0);
       const aim = dz(p.axes[2] || 0, p.axes[3] || 0);
@@ -8462,6 +8466,6 @@
   // gamepads: each reading the game takes, stored when it changes, given back reading by reading
   let gpCalls = 0, gpLast = '', gpAt = 0, gpCur = [];
-  const padSnap = pads => Array.from(pads || []).filter(Boolean).map(p => [p.index, p.id, p.connected !== false ? 1 : 0, Array.from(p.axes), p.buttons.map(b => [b.pressed ? 1 : 0, b.value])]);
-  const padObj = s => ({ index: s[0], id: s[1], connected: !!s[2], mapping: 'standard', timestamp: 0, axes: s[3].slice(), buttons: s[4].map(b => ({ pressed: !!b[0], touched: !!b[0], value: b[1] })) });
+  const padSnap = pads => Array.from(pads || []).filter(Boolean).map(p => [p.index, p.id, p.connected !== false ? 1 : 0, Array.from(p.axes), p.buttons.map(b => [b.pressed ? 1 : 0, b.value]), p.mapping || '']);
+  const padObj = s => ({ index: s[0], id: s[1], connected: !!s[2], mapping: s[5] ?? 'standard', timestamp: 0, axes: s[3].slice(), buttons: s[4].map(b => ({ pressed: !!b[0], touched: !!b[0], value: b[1] })) });
   if (realGP) fixed(navigator, 'getGamepads', () => {
     if (!R) { const pads = realGP(), snap = padSnap(pads), k = JSON.stringify(snap); if (k !== gpLast) { rec.pads.push([gpCalls, snap]); gpLast = k; } gpCalls++; return pads; }
```

## Unresolved Rapier runtime observation

An early manually seeded WSL/SwiftShader mixed-scene run failed in its low-quality tier-3 scene with WASM `unreachable`, followed by recursive/unsafe-alias errors. Its first exception was not preserved before later reads of the failed physics world, so **that initial capture alone** could not identify the cause. Its timing sample is invalid; the later deterministic diagnosis below supersedes the initial uncertainty.

A cached-handle vehicle filter now excludes the chassis and cabin colliders without a body lookup. This is not a demonstrated panic fix: in this pinned Rapier package `Collider.parent()` itself returns a cached JavaScript reference, and both the old and new predicates passed six reconstruction cycles of 480 fixed steps.

On 2026-10-16, the original six-scene sequence was rerun in Chromium with an observational first-exception trace: high intersection → depot → tier-3, then the same three low-quality scenes, each with a two-second wall warmup and eight-second wall sample. All six remained in play; page errors, console errors, app errors and engine errors were empty, and the observer saw no non-finite cached state. The measured windows advanced 864 fixed ticks in total; this is a short diagnostic, not an endurance result. Tracked source hashes matched before and after the run.

Evidence: `/tmp/ewa-engine-evidence/panic-diagnosis/run-2026-10-16T17-28-00-621Z/report.json`, its screenshots and `loaded-sources/`. The observer preserves the first stack, operation history, body/seat lifecycle and eight pre-step cached snapshots without querying WASM after failure. Scripts are under `/tmp/ewa-engine-evidence/panic-diagnosis/`. No production code was changed during that investigation. That negative run did not establish the failure's cause or resolution; the later positive diagnosis below supersedes its unreproduced status.

### Current-runtime reproduction and solver-mask diagnosis

On 2026-10-16 PDT (2026-10-17 UTC), unchanged runtime commit `928d93c22215636b078b0e478f2f70df34464b08` reproduced the initiating exception twice in isolated WSL Chromium 153/SwiftShader. Both original eight-second High/Low mixed-scene sequences failed in the Low tier-3 scene at game tick 241. The first exception was `RuntimeError: unreachable` inside `Rapier.World.step`, captured before the application's later draw queried the failed world. That subsequent `world.draw → floorAt → castRayAndGetNormal` query produced the secondary unsafe-alias exception. Stopping future frames alone did not prevent the current frame from drawing.

The exact vendored WASM caller at `0x2a79c`, its embedded Rust panic record, and paused WASM locals identify an index of **49 into a vector of length 49** at [Rapier Rust 0.30.1 `interaction_groups.rs:454`](https://github.com/dimforge/rapier/blob/v0.30.1/src/dynamics/solver/interaction_groups.rs#L454), the SIMD contact-manifold body-mask lookup. This Rust version is embedded inside the pinned JavaScript package 0.19.3; the game did not change dependencies.

A 228,336-byte physics snapshot captured immediately before the second failed step reproduces the same exception in plain Node **3/3**, without the game, renderer, input loop or callbacks. Its SHA-256 is `ea467c55b5ea04a4cd794ea76c0ce9317b34089814ac0181b07b70c608f1ad4f`. All 281 bodies and 298 colliders have finite transforms and measured numeric fields, with no negative mass/inertia and a maximum quaternion squared-norm error of `1.34e-7`. Removing only the disabled `officer-1` body prevents the captured failure; it retains two solver contacts with the ground despite its disabled body/collider state. Removing traffic, patrol cars or residents does not prevent it. No body/collider creation or removal occurred after observer installation in the original failing sequence.

Reduction does not depend on the staged pursuit: a new world containing only a fixed floor and an upright dynamic capsule reproduces the same trap after one contacting step, `body.setEnabled(false)`, and the next step. The original fixture does place one other officer inside a rotated patrol chassis, but that overlap is unnecessary to reproduce this two-body failure. The same snapshot and minimal lifecycle pass with a separately downloaded non-SIMD `@dimforge/rapier3d-compat@0.19.3` in `/tmp`; the shipped SIMD dependency remains untouched.

**Diagnostic candidate at the time; integrated below:** preserve each collider's `solverGroups`, set them to zero before disabling its body, then enable the body before restoring those original masks. This passed 50 dynamic-contact disable/restore cycles on the pinned SIMD package while preserving handles, body type, sensor state and collision masks. Repeated disable must retain the original mask rather than save zero. Immediate collider `setEnabled(false)` before or after body disabling still failed the fresh minimal case; waking unrelated bodies merely perturbed the active-set size and was not a valid workaround.

A diagnostic-only wrapper applying the solver-mask guard to app-owned body toggles passed two independent full High→Low six-scene sequences: **1,898 sampled fixed ticks**, no Rapier exception, and all 12 audits preserved **281 bodies, 298 colliders, 58 query registrations and seat ownership**. A separate Three `depthTexture` error appeared when one run switched back from Low to High for another cycle; it is retained as a renderer failure, not a Rapier recurrence.

The corrected production-lifecycle fixture then passed **18/18 checks**: player seat/exit and interrupted entry; completed/cancelled player and Jun vaults; dynamic officer seating and validated exit; the actual Retry UI restoring an on-foot checkpoint; ten fixed pickup/case-door toggle cycles; and stable counts, query references, masks and seat ownership. It used production methods and `game.advance` at controlled positions, not a natural playthrough. Original actor body identities and solver masks were restored, with zero browser/engine errors and unchanged source hashes. Raw result: `/tmp/ewa-engine-evidence/panic-diagnosis/lifecycle-2026-10-17T00-36-10-979Z/report.json`. Earlier lifecycle attempts queried a staged door's floor before the world's first physics step, placed Mara below ground and reached Retry; these harness failures remain recorded and are not counted as passes.

The diagnosis led to the shared app helper below. Final-source extended mixed-scene and release verification remain distinct from the original diagnostic captures. A fatal-update/draw latch contains secondary errors but does not replace solver-mask prevention.

Portable evidence: [rapier-panic-928d93c.json](evidence/rapier-panic-928d93c.json). Raw positive captures are under `/tmp/ewa-engine-evidence/panic-diagnosis/run-2026-10-17T00-03-24-410Z/` and `run-2026-10-17T00-13-50-749Z/`; the latter holds the deterministic snapshot, reductions and CDP locals. Runtime source hashes matched before/after every reported run. Those staged and instrumented tests do not certify natural-route pacing or performance; the production integration and its separate checks are described next.

### Integrated app-side lifecycle guard

Published production-fix commit **`e6426f64a18dcb9ae77e324e0c37b480afce84b6`** adds [`src/engine/body-lifecycle.js`](../src/engine/body-lifecycle.js). `setBodyEnabled(body, false)` stores each collider's original solver mask in a `WeakMap` and writes zero **before** disabling the body. `setBodyEnabled(body, true)` enables the body, restores valid colliders' exact original masks and clears the saved map. Repeated disable/enable calls are idempotent and retain distinct masks on compound bodies. Collision/query groups, body handles, type and seat ownership are unchanged; the pinned Rapier package and engine vendor files are not patched for this issue.

Vehicle seat entry, exit, cancel, restore and dispose; Mara/Jun vault start, completion and cancel; and pickup/case-door enable toggles now call that helper. [`tests/unit/body-lifecycle.test.mjs`](../tests/unit/body-lifecycle.test.mjs) exercises touching dynamic capsule and compound-body cycles on the actual pinned SIMD package. [`tests/integration/engine.test.mjs`](../tests/integration/engine.test.mjs) adds fatal-update/draw latch checks: after a thrown update or draw, the app stops the game, reports the original error once and skips later world access in the same frame. Published e642 source passes typecheck, **46/46 unit**, **21/21 core integration**, 15-entry asset audit and 8.76 MiB build. The [patched-source controller route](CONTROLLER-EMULATION.md) also reaches credits, but a full repeated mixed-scene panic regression and post-patch 30-minute run remain separate acceptance checks.

### Three r182 shadow quality adapter

[`src/engine/world.js`](../src/engine/world.js) now constructs `World3D` with stable **authored-sun** caster identity and exposes `runtime.setQuality`. High keeps full resolution, Medium/Low use balanced resolution; Low keeps `world.shadows=true` and the sun's `castShadow` stable while setting shadow intensity to zero and stopping `autoUpdate`/`needsUpdate`. Returning to High restores the saved values and requests an update. `src/main.js::applySetting` calls this adapter. The current scene has no bootstrap `_shadowLights`; engine torch casters added later can still change identity dynamically and need their own test. This avoids the observed Three r182 disposed-sun-shadow reuse without modifying vendored Three or direct sun intensity. The normal Settings switch runner passes High-start repeated and cold-Low sequences in source WebGL2 and WebGPU; [the quality-switch record](SHADOW-QUALITY-TOGGLE.md) gives the original failure, four source-browser passes and remaining packaged/repeated-run limits.
