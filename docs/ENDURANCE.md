# V08 endurance probe

`tests/e2e/endurance.mjs` now has a passing **31-minute normal-rate hardware capture** and a separate accelerated capture. Both exercise repeated pursuit, checkpoint retry and sedan/van/cruiser changes with resource and memory checks. Player/car/police transforms and the first police report are explicit diagnostic staging; these results do not certify an ordinary-input mission or physical controller. The command defaults to accelerated timing, so set `EWA93_ENDURANCE_TIMING=realtime` for normal-rate play. The latest completed capture is tied to the vehicle-wake revision `f7f18b80…`; earlier source revisions are retained separately.

Run a source server with `npm run dev`, then:

```bash
node tests/e2e/endurance.mjs
```

Artifacts go to `/tmp/ewa93-endurance-<timestamp>/`: a report with before/after source-hash consistency, host/browser/renderer metadata, every cycle's state and resource sample, and selected pursuit/post-retry PNGs. It needs the source server because release builds deliberately strip `window.__exitWounds`. Fingerprints cover all game source and assets, the entry HTML, this runner, pinned Three/Rapier resources, engine bundles and loaded mocap scripts. Added, changed or deleted files invalidate a would-be pass with `invalidated-by-source-drift`; frozen-source evidence cannot silently certify later edits. The hashes compare local files before/after; they cannot detect an edit-and-revert or prove a remote URL serves this checkout. Serve this workspace and freeze it for the capture.

Environment options:

| Variable | Default | Purpose |
| --- | --- | --- |
| `EWA93_BASE_URL` | `http://127.0.0.1:5173` | Source server |
| `EWA93_ENDURANCE_OUTPUT` | New `/tmp` directory | Evidence destination |
| `EWA93_ENDURANCE_STOP_FILE` | `<output>/STOP` | Create this file to interrupt cleanly at the next short driver boundary |
| `EWA93_ENDURANCE_CDP` | Unset | Attach Chromium to a dedicated existing CDP endpoint; create/close only the probe context |
| `EWA93_ENDURANCE_ENGINE` | `chromium` | `chromium`, `webkit`, or `firefox` |
| `EWA93_ENDURANCE_TIMING` | `accelerated` | `realtime` keeps the native frame loop and waits for gameplay time |
| `EWA93_ENDURANCE_CYCLES` | `30` | Minimum 3; shorter runs are development probes, not 30-minute evidence |
| `EWA93_ENDURANCE_CYCLE_SECONDS` | `60` | Gameplay simulation duration per cycle; minimum 30 |

To stop a run, create its `<output>/STOP` file. The driver records `interrupted`, retains partial evidence, closes its own context and disconnects. This works for Windows Node as well as WSL without terminating the shared Chrome process.

The default uses 960×600 presentation and Low quality. Chromium launched under WSL normally selects SwiftShader; the report records the observed renderer. Results from that environment must remain separate from hardware-backed stability captures. For a dedicated Windows headless Chrome, run this same module with Windows Node against its CDP endpoint and use a WSL UNC evidence path. The attach path preserves pre-navigation instrumentation, native counters and CDP forced GC; it does not need `window.gc` or `--expose-gc`. It closes its isolated context and disconnects, leaving the existing Chrome process available.

## What it exercises

Before the first cycle, the probe opens the phone with T and declines Eli through the normal UI, establishing a heat-free garage checkpoint with the opening ring declined. Each cycle then selects the sedan, loaded van or patrol cruiser in rotation. The probe stages that existing car and Mara at the central intersection, resets the car to a healthy/unlocked/stationary state, then uses real browser keyboard events to enter, accelerate, brake, handbrake and sound the horn. It stages the existing patrol cars and officers about 24 m around the occupied car, then submits a diagnostic tier-3 report identifying that vehicle. All six officers, patrol response, traffic, collision, vehicle damage, police perception and wanted rules remain live for 20 seconds. It applies the service brake, waits until the normal speed limit permits an exit, exits with the normal E action and restarts the checkpoint through Pause → Restart checkpoint → confirmation. Free-roam after that retry fills the rest of the minute. The default therefore performs 30 enter/exit/retry cycles across all three vehicle types and at least 600 seconds with active tier-3 response.

The player/car/police positions and initial police report are deliberate diagnostic staging. The script does not establish that an ordinary-input player can naturally trigger and escape each pursuit or drive the mission. It fails rather than bypassing arrest, death, an obstructed exit, lost attachments or a runtime error.

The accelerated mode stops the native frame loop and calls the engine's existing fixed-step clock at 120 Hz. The district, AI, Rapier, mission and vehicle updates execute for each step; selected frames are rendered for evidence. It accumulates actual gameplay tick differences across checkpoint restores, so resetting checkpoint time cannot inflate its total. The report separately records wall duration, simulated duration and whether either 30-minute criterion was reached.

Web Audio and radio/rain intervals retain the real browser clock. Accelerated stepping stresses gameplay-triggered effects, vehicle loop reuse and checkpoint lifecycle; it does not compress 30 minutes of real radio/ambience into the test. Use `EWA93_ENDURANCE_TIMING=realtime` for actual continuous runtime evidence. This mode leaves the native frame loop running, requires engine time scale 1, records rendered-frame counts, cross-checks elapsed seconds against fixed-step ticks and fails if the gameplay clock stalls for 10 wall seconds. It records heap slopes against both gameplay and wall time. Accounted gameplay excludes snapshot, screenshot and input gaps, so its 30-minute threshold is conservative. On slow software rendering it may take substantially longer than 30 wall minutes because it waits for 30 minutes of accounted gameplay as well.

## Measurements and acceptance checks

Instrumentation is installed before boot. Listener target/callback records and AudioNode records use `WeakRef`, so the counters do not keep discarded objects alive. Listener tracking handles duplicate registrations, explicit removal, `once` listeners and abort signals. Audio tracking records live contexts, creation by node kind, live nodes and started sources that have not ended; active interval handles are counted separately. The probe leaves a 1.1-second wall-time drain before samples and forces GC in Chromium. Chromium native document/DOM-node/listener counters independently cross-check the JavaScript instrumentation; documents must stay constant, DOM nodes may vary by 32, and native listeners by 12 for transient audio/browser callbacks.

After three warmup cycles, it checks:

- Constant Rapier rigid body, enabled-body and collider counts; constant actor, vehicle, prop, pickup, shape, scene-node, unique CPU geometry and query-registry counts after retry.
- No query-registry references to freed bodies, actors without a body or valid seat, or seated actors with enabled collision bodies or inconsistent seat ownership. Mara’s body must be enabled when she is on foot.
- No listener growth above two registrations, no increase in detached DOM targets with active listeners, no growing interval/audio-context count, and no accumulation of scheduled audio sources beyond six voices of sampling allowance.
- Bounded crime/report histories and a readable, nonempty checkpoint. Primary and previous-good save bytes may each grow by at most 4 KiB after warmup; logical state may grow by at most 8 KiB after retry. GPU geometry/texture registrations may grow by at most 32 after warmup while existing scene assets become visible, then must stay within a two-resource range throughout the final third. Unique CPU geometry counts must remain constant. Active CPU material counts may vary by two because traffic signals substitute their existing cached red/amber/green materials; a renderer cache increase alone cannot be mistaken for a new scene entity.
- Chromium post-GC early/late heap medians within an 8 MiB allowance after warmup. The report also records the fitted bytes-per-simulation-minute slope and fails sustained growth above 128 KiB per simulated minute when the median increases by more than 2 MiB. Other engines explicitly report the unavailable forced-GC trend instead of substituting an incomparable estimate.
- No page errors, console errors, failed requests, unexpected game failure or error UI.

In Chromium, live AudioNodes after drain and forced GC may not exceed the first stable sample by more than 24 nodes; other engines record the counts without making a comparable GC assertion. The node allowance recognizes browser-dependent native Web Audio cleanup and does not require an exact count. Heap checks cover the exposed JavaScript heap, not all native, GPU or audio memory. Chromium external backing-storage bytes (`Runtime.getHeapUsage.backingStorageSize`) also receive an 8 MiB early/late median growth allowance. These generous allowances are leak alarms, not memory-budget certification. A stable accelerated pass remains supplemental V08 evidence until actual 30-minute play is measured.

## Execution evidence

### Normal-rate hardware capture — vehicle-wake revision

**Passed: 1,801.49 accounted gameplay seconds over 1,882.24 wall seconds (31m 22.24s).** The native frame loop stayed running at time scale 1; rendered frames advanced from 166 to 111,701. That is 111,535 observed frames over 1,864.03 seconds between sample endpoints, or 59.836 FPS aggregate cadence. No sampled page was hidden. This is evidence of continuing native rendering, not a frame-time distribution or a 1080p performance certification.

The isolated Windows Chrome `155.0.8059.84` context used WebGPU on NVIDIA GeForce RTX 3060 Ti at 960×600/Low/balanced resolution. All 30 vehicle entry/exit/checkpoint-retry cycles completed, including 29 successive vehicle changes and 638.69 accounted seconds of active tier-3 response. The normal T/Decline call UI established the safe checkpoint before staging. Police perception, driving, collisions, exit restrictions and arrests stayed live; no invulnerability or arrest suppression was used.

| Post-warmup measurement | Observed range |
| --- | --- |
| Rigid bodies / enabled bodies / colliders | 281 / 269 / 298, constant |
| Actors / vehicles / query registrations | 52 / 18 / 58, constant |
| Scene nodes / unique CPU geometries / materials | 1,212 / 771 / 357, constant |
| Tracked listeners / native listeners | 36 constant / 86–90 |
| Detached DOM targets with listeners | 0 |
| Native DOM nodes | 179–187 |
| AudioContexts / intervals | 1 / 2, constant |
| Live AudioNodes / active sources | 22–37 / 5–9 |
| Readable primary / previous-good checkpoint bytes | 22,064 / 18,956, constant |
| Logical state bytes after retry | 22,134–22,174 |
| GPU geometry registrations / textures | 518 / 71, constant |

Post-GC early/late JavaScript heap medians were 28,145,600 and 28,347,932 bytes: **202,332 bytes difference**. The fitted slope was −6,940 bytes per wall minute. External backing-storage medians differed by +422 bytes; the observed garbage-collected embedder-heap median fell by 67,152 bytes. No sustained-growth alarm fired. AudioContext time advanced **1,872.872 actual seconds**, covering more than 30 real minutes of the running audio graph.

There were zero page/console/engine/network errors, invalid seats, disabled on-foot Mara bodies, orphaned query registrations or unreadable saves. All 61 before/after fingerprints matched. The tested hashes include main `2203654f…`, save `fe8306f2…`, UI `5abf6734…`, CSS `57176f99…`, vehicles `f7f18b80…`, manifest `e2978636…` and runner `cbb8d12c…`. Later source changes are outside this capture's coverage.

Portable outcome/method/hash/limit evidence is in [endurance-realtime.json](evidence/endurance-realtime.json). Full samples and PNGs remain outside the repository at `/tmp/ewa93-endurance-realtime-vehicle-wake-20261016/`. The pursuit-20 and pursuit-30 frames were inspected and show nearby officers/patrols; the final cycle-30 frame shows Mara restored on foot at the garage. The owned context and Windows Node process closed normally; the existing CDP Chrome was preserved.

This is an automated, normal-rate diagnostic with labeled staging. It establishes the measured 30-minute liveness/resource scenario; it does not establish physical-controller support, natural mission pacing, continuous audiovisual quality or a total native/GPU/audio memory budget. The parked-van sleeping/reverse regression has a separate real-Rapier integration test; the endurance fixture deliberately positions and wakes its selected car before ordinary driving.

### Historical normal-rate hardware capture

The preceding vehicle revision `aad74795…` also passed **1,801.47 gameplay seconds over 1,870.30 wall seconds (31m 10.30s)**, with 30 successful cycles, 638.6 pursuit seconds, native frame counts 150→111,494, and AudioContext time 1,864.32 seconds. Its median heap difference was +208,396 bytes, external backing-storage difference −10 bytes, with no runtime/network/attachment errors. All 61 fingerprints matched that earlier source, but it does not cover the later vehicle-wake patch.

Its portable evidence is preserved unchanged as [endurance-realtime-prior.json](evidence/endurance-realtime-prior.json). Full raw evidence remains at `/tmp/ewa93-endurance-realtime-final-20261016/`.

### Accelerated hardware capture

The earlier frozen-source capture also **passed**: **1,801 simulated gameplay seconds in 406.73 wall seconds**, with 30 entry/exit/retry cycles and 636 accounted pursuit seconds. It used the same Windows Chrome/GPU/viewport/quality, stopped native frame updates and rendered selected evidence frames. All 61 endpoint fingerprints matched (main `0f482b70…`, CSS `98ed7109…`, vehicles `aad74795…`).

Bodies/actors/vehicles/scene nodes/listeners stayed fixed at 281/52/18/1,212/36. Primary/backup saves stayed readable at 21,933/18,956 bytes. Post-GC heap medians rose by 341,152 bytes; external backing-storage medians were unchanged. GPU geometry registrations made one bounded 509→514 realization step, then plateaued; CPU geometries/materials stayed 771/356 and textures 71. No runtime/network/attachment errors occurred.

Its AudioContext ran only **401.6 actual seconds**, so this accelerated result alone is not 30-minute wall-clock evidence. Portable evidence is in [endurance-accelerated.json](evidence/endurance-accelerated.json); full raw data remains at `/tmp/ewa93-endurance-hardware-frozen-20261016/`.

The initial WSL capture completed 1,801 simulated seconds but retains a failed verifier status because its original +2 GPU-geometry allowance rejected the one-time 509→514 realization of existing assets. It was not relabeled as a pass. A normal-rate pilot was intentionally interrupted for a settings-load source fix; its raw target-closed result and interruption sidecar remain outside the repository. The three passing captures above are separate fresh runs on their recorded source hashes.
