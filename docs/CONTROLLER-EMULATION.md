# Emulated controller completion

The user confirmed that no physical controller is available and asked for simulation/emulation. `tests/e2e/controller-route.mjs` therefore supplies a standard-mapped virtual DualSense through `navigator.getGamepads()`. The pinned engine performs its normal poll and the game receives its normal action frame. No keyboard or mouse command selects a menu item, moves Mara, interacts, aims, fires, drives or advances the ending. The runner reads semantic state for navigation, screenshots and assertions; it never writes a mission event, actor transform, health value, reward or objective flag. It calls the engine's existing fixed-step `Game.advance` between pad changes, so this is an **accelerated functional playthrough**, not a physical-controller feel or real-time pacing test.

Run against the development server:

```bash
npm run dev -- --host 127.0.0.1 --port 5173
node tests/e2e/controller-route.mjs
```

The runner accepts `EWA93_BASE_URL`, `EWA93_CONTROLLER_ENGINE=chromium|webkit`, `EWA93_CONTROLLER_ENDING=reporter|broker`, and `EWA93_CONTROLLER_OUTPUT`. It can connect to an existing Windows GPU Chrome through `EWA93_CONTROLLER_CDP_URL` when launched with Windows Node; this is how the recorded full route was measured. Local WSL Chromium/WebKit use software rendering and are much slower. Large screenshots and raw browser storage snapshots remain outside the repository.

The final cold run used Windows Chrome 155 through CDP on the RTX 3060 Ti host at 1280×720, with the game set to Low in its own settings using D-pad controls. Portable evidence is [controller-run.json](evidence/controller-run.json) and three reviewed images in `docs/evidence/`; the full local report and thirteen PNG checkpoints are at `/mnt/c/Temp/EWA93ControllerFinal/`. It passed title → Settings → controller button remap and reset → New Game → proportional R2/L2 sedan driving and exit → missed Eli call with normal in-person acceptance → Bea → phone → right-stick weapon wheel → simulated unplug/pause/reconnect/manual resume → $60 armor purchase → normal aimed pistol combat → Jun/case/alarm → Jun's physical on-foot extraction → geographical police clearance → reporter decision/handoff → Credits. The right stick scrolled the credits/source information by 95 px. The handoff completed after **361.08 simulation seconds** with Mara at 100 health, 40 armor, $620, and Jun **6.97 m** away, inside the required 8 m proximity. The runner verified **zero trusted keyboard, mouse or touch events**, zero page/console errors and matching before/after hashes across **320** shipped-source files. The full route was rerun on the vehicle-wake revision after the phone-call, companion-floor/detour, car-brake, interaction and credits fixes.

The title appeared **11.754 wall seconds** after navigation began in a fresh Chrome context on that named hardware. This misses the brief's 10-second local cold-title target by 1.754 seconds. The browser process itself was already running, so this is a fresh-context measure rather than a full process-cold benchmark; the product cold-load budget remains open.

The emulation checks the browser-level standard mapping, game UI, game logic, analog values, disconnect edge, and recovery. It does not establish the feel of a physical PS5 pad, browser HID device enumeration, cable or Bluetooth behavior, rumble, or physical latency. A single skilled accelerated run also does not measure the 25–35 minute first-player pacing target. Real iOS Safari is unavailable; responsive WebKit profiles are covered separately.
