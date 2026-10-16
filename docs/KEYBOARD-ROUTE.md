# Keyboard and mouse route verification

The broker route passed from a cold title through credits on 2026-10-16. The [portable evidence record](evidence/keyboard-run.json) contains all 16 passed checks, exact source and runner hashes, mission/economy checkpoints and five small inspected screenshots. The completed run used ordinary browser time, native XTest mouse input and Playwright keyboard events, with zero errors or retries.

`tests/e2e/keyboard-route.mjs` drives the ordinary title, settings, remapping, gameplay, ending and credits interfaces. It defaults to the broker ending and ordinary browser time:

```bash
npm run dev -- --host 127.0.0.1 --port 5173
node tests/e2e/keyboard-route.mjs
```

On Ubuntu/WSL, the script starts a private Xvfb display and headed Chromium. Keyboard input uses Playwright's browser events; mouse motion and buttons use native XTest events through the installed `python3`, `libX11` and `libXtst`. Ordinary-time mouse corrections wait for the actual camera event to be consumed before sending the next delta, which prevents queued turns on a slow software renderer.

An optional Windows path uses a persistent PowerShell/C# Win32 mouse helper, with bounded corrections for the host's pointer acceleration; OS mouse settings are preserved. `EWA93_KEYBOARD_CDP=http://127.0.0.1:9224` attaches to a dedicated headed host Chrome. Windows Node and Windows Playwright browsers/FFmpeg must be installed; the session uses the repository's locked Playwright package through the WSL UNC filesystem. Accelerated segments worked on this path, but ordinary-time attempts suffered unreliable Windows foreground activation and Alt+Tab recovery. The private Xvfb route is the ordinary-time verification configuration.

Native mouse input avoids Chromium headless CDP pointer-lock motion cancelling itself with opposite cursor-warp events. The driver also disables Playwright's Chromium focus emulation immediately before the focus-loss check, so the test observes a real trusted blur event. These are test-driver/browser configuration changes; no gameplay object, save, mission event, actor transform, health value or gamepad polling API is changed.

The driver uses read-only semantic state to locate actors and navigate. The route covers E-to-F interaction remapping, the obsolete E key, dynamic HUD prompts, mouse look, pointer-lock loss/re-entry, actual browser focus loss, cleared held movement, pause, toolbox collection/return, the rear service-lane vault, pistol and depot SMG combat, Jun's van passenger seat, normal geographical evasion, a garage favor repair/respray, broker handoff with Jun physically nearby, a post-mission purchase and credits. Long road legs open a gap from foot officers before the garage; the van then uses the south drive-through exit. A Mara-down encounter can recover through the visible keyboard-operated Retry checkpoint action. The cold runner uses no saved fixture or direct game-state writes. Checkpoints write game-only localStorage snapshots and semantic reports beneath `/tmp`, with PNGs at safe points; live-combat screenshots are skipped because software-renderer capture latency would leave the driver exposed. The ordinary-time run records continuous WebM video without audio.

For a supplemental accelerated reachability probe:

```bash
EWA93_KEYBOARD_TIMING=accelerated node tests/e2e/keyboard-route.mjs
```

That option invokes only the engine's existing fixed-step clock between normal input events. Its report sets `ordinaryTimeCompletion: false`; it cannot pass V02 or establish first-player pacing. An ordinary-time automated pass is also a skilled navigation replay, so human first-player pacing remains a separate requirement.

Useful options are `EWA93_BASE_URL`, `EWA93_KEYBOARD_OUTPUT`, `EWA93_ENDING=broker|reporter` and `EWA93_KEYBOARD_ENGINE=chromium|firefox|webkit`. Chromium with native XTest or Win32 mouse is the exercised driver configuration; other engine selections remain unverified. `EWA93_KEYBOARD_NATIVE_MOUSE=0` selects Playwright mouse events and is unsuitable for Chromium's known headless pointer-lock limitation on this machine. Keep `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64` on WSL and run only one software-rendered gameplay browser at a time.

The final run used Chromium 153.0.8010.12, WebGL 2, low quality and a 1280×720 viewport on Ubuntu/WSL. It took 2,287.524 wall seconds and 929.158 game seconds. The software renderer slows the game clock through the engine's ordinary frame handling; these numbers do not measure a fresh player's completion time or hardware performance.

The retained final report and continuous 2,288.4-second WebM are under `/tmp/ewa93-keyboard-final-xvfb-6`. Their SHA-256 hashes are included in the portable record. The record verifies:

- An actual SMG burst reduced the gate guard from 65 to 45 health, with ammunition consumed; [captured firing frame](evidence/keyboard-smg.webp).
- Mara drove the van with Jun in the passenger seat, then cleared wanted heat through ordinary travel; [extraction frame](evidence/keyboard-van.webp).
- The earned favor repaired/resprayed the van at no cost, incremented its appearance and left the wallet at $20.
- Jun was 4.913 m away at the final pre-handoff check and safe after the broker paid $1,200. The wallet became $1,220 and the distinct broker message/district flags were saved; [ending frame](evidence/keyboard-broker.webp).
- A post-ending armor purchase changed armor from 0 to 100 and money from $1,220 to $1,160 while preserving completion; [purchase frame](evidence/keyboard-after-purchase.webp).
- The normal pause menu opened [credits](evidence/keyboard-credits.webp), including the source-information block.

Earlier diagnostic captures remain outside the repository. The first ordinary attempt at `/tmp/ewa93-keyboard-final-xvfb` contains a real Mara-down encounter and focused Retry UI, plus an 844.48-second traversal/combat/failure video. Subsequent checkpoint replays used untouched saves from actual ordinary play to diagnose pursuit, route geometry and the fixed sleeping-van reverse issue. They are supplemental evidence; the final V02 result comes from the complete cold run above.
