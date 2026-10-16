# Exit Wounds Avenue-93

[Public repository](https://github.com/michaelcrosato/Exit-Wounds-Avenue-93)

An original third-person urban crime game set in Morrow Ward, Calder Bay. In the complete level, Mara Vale collects a payroll case, gets witness Jun Park out of the Northline depot, evades a geographically grounded police search, and chooses where the evidence goes. The broker and reporter handoffs have distinct payments, messages and visible district consequences. The city remains playable after the mission, and Replay starts a new run.

**Build status:** public code commit [`e6cd7524f8f1552be87aa20226848641bd1d0fd3`](https://github.com/michaelcrosato/Exit-Wounds-Avenue-93/commit/e6cd7524f8f1552be87aa20226848641bd1d0fd3) passed a clean fresh-clone install, tests, build and three-engine packaged preview. An [emulated standard-mapped controller](docs/CONTROLLER-EMULATION.md) completes the reporter route from title to credits, and [keyboard/mouse](docs/KEYBOARD-ROUTE.md) completes the broker route in one uninterrupted ordinary-time browser session. Focused police/failure and late-save matrices and a 30-minute real-time endurance diagnostic pass. Later verification prose does not change the tested e6 runtime source; the delivery handoff identifies the final public documentation HEAD. First-player pacing and subjective presentation remain unmeasured. No physical controller was available, so the user approved emulation for that input path. [The test report](docs/TEST-REPORT.md) records the evidence and limits; [the design](design.md) lists every acceptance gate.

Known limits: a new owned Windows Chrome process/profile on RTX 3060 Ti reached an enabled title in 2.339 seconds and met the 10-second target in one run, while an earlier fresh context in an existing process took 11.754 seconds. OS cache/server conditions and host load differ, so repeatable cold-load performance is unproved. WSL software-rendered Lighthouse warned slow/incomplete metrics; an earlier intermittent WSL Rapier exception remains unexplained. Human first-player pacing and speaker/headphone listening have not been measured. [Title timing evidence](docs/TITLE-COLD-HARDWARE.md) records both Windows observations.

## Run

Use Node.js 22 or newer. A modern desktop browser with WebGL2 is required; the engine attempts WebGPU and falls back to WebGL2. Gameplay is designed for a PS5-compatible standard gamepad or keyboard and mouse. Touch gameplay controls are outside the agreed scope.

```bash
npm ci
npm run dev -- --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173/`. The game must be served over HTTP. To make and inspect the standalone same-origin package:

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

Runtime modules, fonts, selected animations, Three.js and Rapier are local. The development server and packaged preview need no account, API key, backend or CDN. `dist/` is generated and should not be edited by hand.

## Play

At the garage, speak to Eli and take the collection job. Bea at Morrow Market has the depot address. The depot has a street gate and a rear service barrier. Find Jun before opening the wired payroll cabinet. Bring him out, lose police sight and leave their last-known search area. At the quiet stop, choose the broker or reporter; the choice can be changed before the final handoff. The optional market toolbox earns one free repair and respray at Eli's garage.

Eli also calls at the start. Answer on the phone, return a missed call, or meet him at the garage; missing it never blocks the job. The phone can resume an interrupted conversation and replay heard dialogue.

| Action | Controller | Keyboard / mouse |
| --- | --- | --- |
| Walk, steer / camera | Left stick / right stick | WASD / mouse |
| Sprint, short vault, crouch | Cross, Square, L3 | Shift, Space, C |
| Aim/block, fire/melee | L2, R2 | Right click, left click |
| Reload or dodge while blocking | Circle | R |
| Cover, interact / car | R1, Triangle | Q, E |
| Weapon wheel | Hold L1 | Hold Tab |
| Phone, map, pause | D-pad Up, D-pad Down, Options | T, M, Escape |
| Car throttle, brake, handbrake | R2, L2, R1 | W, S, Space |
| Menu select, confirm, back | D-pad, Cross, Circle | Arrows/WASD, Enter, Escape |

Click the 3D view to acquire mouse look; Escape or focus loss pauses and clears held input. Reconnect a controller and resume deliberately. Settings contain quality, brightness, HUD and subtitle size, camera motion, look controls, audio mix, and keyboard/controller button remapping. An unrecognized controller can be remapped from the Controls screen. Touch devices show compatible menus but no virtual gameplay controls.

## Progress and saves

The game saves logical state at stable mission checkpoints, not mid-seat transitions or during the handoff commit. Continue reconstructs actors, vehicles, attachments, mission, crime/search and UI from `localStorage`. A previous-good backup is retained. If the primary save is corrupt, **Recover save** offers an explicit validated-backup choice. New Game asks before replacing existing saved data. Settings persist separately. After either ending, free roam retains the reward once; Replay begins a distinct run with the starting $80, pistol and seed 93.

The high picture setting uses full engine render resolution and shadows; medium uses balanced resolution with shadows; low uses balanced resolution without shadows. All preserve gameplay and the independently scaled DOM HUD. Hardware performance measurements and final quality tuning are recorded in [the test report](docs/TEST-REPORT.md), not inferred from software-rendered browser checks.

## Development checks

```bash
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:integration:late
npm run test:e2e
npm run test:e2e:release
npm run audit:assets
npm run build
```

The unit suite checks mission guards, rewards, ammo, wanted truth, save validation and backup behavior. The standard integration command checks the pinned engine, Rapier, controller polling, camera queries, animation and package; `test:integration:late` runs the longer checkpoint/reload matrix separately. E2E smoke tests use the normal boot, menus and gameplay input. The full emulated-controller, keyboard, police and endurance runners are in `tests/e2e/` with methods in `docs/`. The [asset manifest](assets/manifest.json) records exact hashes, sources and licenses for local files. [Third-party notices](THIRD-PARTY-NOTICES.md) include the engine, Three.js, Rapier, fonts and selected CC0 clips. The game's city, models, text and procedural sound are original project work. No Rockstar asset is shipped.

The engine is pinned in [ENGINE_VERSION](ENGINE_VERSION); [ENGINE-FEEDBACK.md](ENGINE-FEEDBACK.md) records actual integration issues for its maintainer. The playable runtime uses both the full my-3d2dge engine and its 3D module, with documented analog-input and Firefox fallback patches.

## Source information

```text
Initial date: 2026-10-16 (first prompt known in this thread)
SOURCE: Grand Theft Auto IV — Xbox 360, PlayStation 3 and PC
GAME ENGINE: my-3d2dge 0.46.1, build dev-build, commit cfa866aa45474868350cad1a7fc015e612f9305f
Environment: Ubuntu 26.04.1 LTS under WSL2; Chromium, Firefox and WebKit opening checks, with broader QA in progress
Model and effort: GPT-6.1-Sol with Ultra for delegated implementation; root session model/effort not verified
```

This project's original material is included for playing and reviewing the game; no separate reuse license is granted. Vendored and attributed third-party material retains its respective license.
