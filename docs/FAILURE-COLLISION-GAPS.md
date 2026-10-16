# Focused V04/V07 collision and return diagnostics

[The runner](../tests/e2e/failure-collision-gaps.mjs) is a **fixture-based actual-runtime** diagnostic for blocked vehicle exits, a physically induced rollover and leaving/returning to the depot. It uses the source development build because setup and measurements need `window.__exitWounds`; the packaged release removes that hook. The result is [portable JSON](evidence/failure-collision-gaps.json) with four reviewed frames: [alternate exit](evidence/failure-collision-door-alternate.webp), [both doors blocked](evidence/failure-collision-door-blocked.webp), [side roll](evidence/failure-collision-roll.webp) and [depot return](evidence/failure-collision-depot-return.webp).

## Executed result

On 2026-10-16 the final combined run **passed 4/4** in Windows Chrome `155.0.8059.84` through CDP port 9223, in an isolated context, using Low quality and the game's fixed-step clock. It took about **30.9 wall seconds**. The before/after game, asset, engine and runner fingerprint matched (`1e201979…`); page and network errors were empty. Full local evidence is `C:\Temp\EWA93FailureCollisionFullPass\report.json` with PNGs in that directory. That path is machine-local; the portable result above retains the key measurements. This is accelerated functional evidence, not ordinary-time play or a full mission route.

| Case | Observed outcome |
| --- | --- |
| One blocked side | A fixed wall blocked all three driver-side capsule landings; all three passenger-side landings were clear after a fixed Rapier step refreshed scene queries. Normal E chose `(330.05, 333.54)` on the passenger side; Mara exited with her body enabled and no failure. |
| Both sides blocked | Two walls blocked all six landings. Normal E kept the occupied seat and displayed `doors blocked`. Pause → Restart checkpoint → confirmation restored Mara on foot at the authored garage spawn `(91, 311)`. |
| Collision-created roll | A test-only kinematic lift plate rose into one side of an upright occupied sedan while a fixed curb constrained the other side. The **car's rotation was never written after initial upright placement**. The report records 57 real car/plate contact observations; at tick 195 its up-vector reached `0.181`, the vehicle became disabled, and the screenshot visibly shows the side roll. Normal E exited Mara with an enabled body. After the lift and curb were removed and two more seconds of physics ran, she settled at ground height in play with no failure. |
| Depot leave/return | A validated APPROACH save placed Mara near the depot, with unrelated crew down in the fixture. Normal walking left the depot's 61 m radius (77.41 m from its center), returned to its gate, and ordinary E advanced to RECOVERY with route `gate` and checkpoint `recovery`. A second walk outside and back preserved RECOVERY without error or retry. |

The first raw run, preserved at `C:\Temp\EWA93FailureCollisionInitialRaw\report.json`, passed leave/return but failed the blocked-door **fixture precondition** because newly created Rapier wall colliders were queried before the next world step; the runner now advances one fixed step before measuring clearance. Its side ram made 23 contact observations and damaged the car but did not roll it (minimum up-vector `0.993`). Two further dynamic-ram attempts are preserved at `C:\Temp\EWA93FailureCollisionRollSide2\report.json` and `C:\Temp\EWA93FailureCollisionRollRoof1\report.json`; both contacted the car but remained **inconclusive rollover fixtures** with minimum up-vectors `0.970` and `0.960`. Those nonpassing attempts were not relabeled as passes. The successful lift profile demonstrates physical contact causing roll, but does not reproduce a traffic collision or ordinary driving crash.

## Reproduction and limits

Start the source server, then run one browser job at a time. From WSL:

```bash
npm run dev -- --host 127.0.0.1 --port 5173
EWA93_GAPS_ROLL_PROFILE=lift-plate PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 \
  node --test --test-concurrency=1 tests/e2e/failure-collision-gaps.mjs
```

`EWA93_BASE_URL` selects another source URL; `EWA93_GAPS_ENGINE` selects Chromium, WebKit or Firefox; `EWA93_GAPS_CASE` filters names by regular expression; `EWA93_GAPS_OUTPUT` selects an output directory outside the repository. `EWA93_GAPS_CDP_URL` attaches to an existing Chromium CDP endpoint for hardware testing. The default rollover profile is `side-high` and remains inconclusive in the recorded attempt; set `lift-plate` for the calibrated physical rollover case. The runner fails if a collision fixture does not actually roll the car, if a valid rollover does not disable it, if door-clearance preconditions are not met, or if runtime/source consistency breaks. The temporary walls, curb and lift are removed after each case.

The car and actor start locations, collision rig and APPROACH save are staged. The physical collision, seat/door clearance, keyboard walking, gate interaction, exit and retry use the live game and Rapier world. The test does not establish natural collision-caused overturn during ordinary driving, every blocked door in the district, long-run stability, frame rate, first-player pacing or a finished animation filmstrip. [The police/failure matrix](POLICE-QA.md), [witnessed impacts](../tests/e2e/witnessed-impact.mjs) and [ramp/animation probe](../tests/e2e/collision-animation.mjs) remain separate evidence.
