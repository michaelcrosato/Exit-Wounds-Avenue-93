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
- Seated actor bodies are disabled and temporarily detached from engine movement (`actor.body = null`), while the actor remains rendered. Validated alternate exits restore the same body and collider. `setSolid(false)` alone is insufficient because it still collides with level geometry.
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
