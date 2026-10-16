# Verification report

Status: **in progress; the full completion gate is open**. This report separates domain checks, accelerated functional probes, public release UI checks and actual browser play. Tests here do not establish a physical-controller completion, a full keyboard/mouse completion, first-player pacing, audio quality or hardware performance.

## Environment and reproducibility

- Date: 2026-10-16. Ubuntu 26.04.1 LTS under WSL2; kernel `6.18.33.1-microsoft-standard-WSL2`.
- CPU exposed to WSL: Intel Core i9-13900K, 32 logical CPUs. `/dev/dxg` is present; these headless Chromium checks explicitly allow SwiftShader and do not establish a hardware-accelerated performance baseline.
- Playwright 1.63.0. Observed browser versions: Chromium `153.0.8010.12`, WebKit `26.6`, Firefox `155.0`.
- `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64`. No dependency installation was needed for browser engines.
- Live source server: `http://127.0.0.1:5173`. Initial QA ran against commit `a486740` plus active uncommitted runtime/engine/world work; the integrated foundation was subsequently committed as `36687f9`. Subsequent fixes were tested against the evolving source tree; final verified commit remains pending.
- Seed 93; fresh runs use distinct run IDs and the defined $80/pistol 12+48 starting inventory.

Run domain checks with `npm run test:unit`. The semantic opening/storage suite, `node --test tests/e2e/smoke.test.mjs`, requires the **development** build and its diagnostic read hook. It uses an existing local dev server or starts one if needed; `EWA93_BASE_URL` selects another development URL and `EWA93_QA_OUTPUT=/tmp/desired-path` chooses evidence storage. `EWA93_ENGINES=chromium`, `webkit` or `firefox` selects a browser; comma-separated selections run sequentially. The default is Chromium and WebKit.

The separate `npm run test:e2e:release` (or `node --test tests/e2e/release.test.mjs`) builds `dist`, starts an isolated static preview and exercises only public UI, ordinary keyboard input and DOM canvases; it asserts that `window.__exitWounds` is absent. `EWA93_RELEASE_URL` may target an already built packaged preview, `EWA93_RELEASE_ENGINES` selects browsers, and `EWA93_RELEASE_OUTPUT` selects its evidence directory. The default release check covers Chromium/WebKit/Firefox. `npm run test:e2e` runs the development semantic suite only; it cannot be redirected to a stripped release. No large screenshots are checked into the repository.

## Results actually observed

| Check | Actual result | Evidence |
| --- | --- | --- |
| Domain gameplay invariants | 28/28 tests pass | `tests/unit/gameplay.test.mjs`; most recent run 2026-10-16 |
| Domain JSDoc checking | Pass for owned game/mission/combat/crime/economy/wanted modules | Targeted TypeScript command recorded below |
| Chromium cold boot | Reaches title; no console/page errors after 15-second observation | `/tmp/ewa93-qa/chromium-boot.png` |
| WebKit cold boot | Reaches title; no console/page errors after 15-second observation | `/tmp/ewa93-qa/webkit-boot.png` |
| Initial title visual review | Both screenshots directly inspected; readable title/actions; consistent urban backdrop | Same boot PNGs |
| Keyboard activation consumption | Initial defect reproduced, root fix retested successfully; ticks advance and KeyD moves Mara | B01 below |
| Normal settings/input/job/reload path, Chromium | Pass; 59.60 s suite, title ready 2.036 s | `/tmp/ewa93-qa/e2e-chromium-retest/report.json` and PNGs |
| Normal settings/input/job/reload path, WebKit | Pass; 28.97 s suite, title ready 4.194 s | `/tmp/ewa93-qa/e2e/report.json` and WebKit PNGs |
| Engine integration | Foundation agent reports 17/17 pass, including all three browsers, raw analog/rebinding/input chords, Rapier driving/seats/queries/camera/impact, animation and package hook stripping | `/tmp/ewa-engine-evidence/integration.json`; test files listed in that record |
| Full-project typecheck, asset audit, build | Foundation agent reports pass; 5 font/license asset entries, 0.44 MiB; packaged build 8.52 MiB at that revision | Foundation handback; final post-change rerun still required |
| Packaged nested-base-path title | Foundation agent reports `/dist/?backend=webgl` title with 18 vehicles, no page errors or failed requests | `/tmp/ewa-engine-title.png`; this is a boot check, not packaged mission completion |
| Expanded corruption/regression smoke, Chromium | Pass, 130.24 s; title ready 2.130 s; zero page/console errors or failed requests | `/tmp/ewa93-qa/e2e-final-smoke/report.json` |
| Expanded corruption/regression smoke, WebKit | Pass, 85.49 s; title ready 12.282 s; zero page/console errors or failed requests | Same report; this software-renderer load exceeded the 10 s initial-title target |
| Expanded corruption/regression smoke, Firefox after P2 | Pass, 51.82 s; zero page/console errors or failed requests | `/tmp/ewa93-qa/firefox-p2/report.json` |
| All-engine title viewport matrix | 41 clean captures, one screenshot-timeout under six-way software concurrency; isolated Chromium ultrawide retest passes. Zero reported overflow/page/console/request errors in completed captures | `/tmp/ewa93-qa/viewport-matrix/{index.html,report.json}` and `/tmp/ewa93-qa/ultrawide-chromium-retest/{title.png,report.json}` |
| Responsive gameplay/phone/pause after B07 fix | 24/24 captures/checks pass across Chromium/WebKit at 375×667, 756×352, 768×1024 and 2560×1080. No horizontal clipping, subtitle overlap or page errors. Fixed landscape screenshot directly inspected | `/tmp/ewa93-qa/responsive-b07-retest/report.json` and PNGs |
| Required animation asset failure | Pass, WebKit 9.67 s: abort `urban.js`, recoverable error, unblock/reload, normal New Game advances; no unhandled page errors | `/tmp/ewa93-qa/asset-failure/report.json`, `webkit-asset-failure.png`, `webkit-asset-recovered.png` |
| Stripped packaged release UI | 3/3 pass: Chromium 45.34 s, WebKit 19.43 s, Firefox 12.32 s. Public UI/HUD, minimap-based real keyboard movement, phone/credits, absent debug hook, no page/console/network errors | `/tmp/ewa93-qa/release-ui-retest/report.json` and PNGs |
| Reporter full normal-action route, accelerated supplemental probe | Pass through all phases and reporter ending/credits; actual armor purchase, firearm damage, Jun/cabinet interactions, foot extraction, search clearance and $600 payment. 323.33 s simulated, $620 final wallet, health 100/armor 40 | `/tmp/ewa93-qa/route-reporter-hostile-fixed/report.json` and ten PNG checkpoints; `tests/e2e/mission-route.mjs` |

Targeted domain typecheck actually run successfully:

```bash
./node_modules/.bin/tsc --allowJs --checkJs --noEmit --target ES2022 \
  --module ESNext --moduleResolution bundler --lib ES2023,DOM \
  src/game/*.js src/mission/*.js src/systems/combat.js \
  src/systems/crime.js src/systems/economy.js src/systems/wanted.js
```

The domain tests cover mission guard failures, both approach flags, both complete ending transitions, one-time payments after save/load, changing an uncommitted choice, alarm location without suspect identity, valid Jun passenger ownership, late checkpoints, favor consumption, purchases, actor recovery limits, hidden/occluded crimes, interrupted witness calls, immediate police reports, all three wanted radii/timers, unseen vehicle switches, surrender, ammo/reload/cancel accounting, muzzle obstruction, melee/armor/Jun safety, aim assist exclusion, save checksum/version/seat validation, backup choice, storage errors, replay, RNG and input clearing.

The browser suite uses ordinary menu actions, real keyboard events and normal E interaction. Semantic hooks are read only: no actor teleport, objective event injection, enemy death injection, inventory grant or ending assignment. The suite verifies editable settings navigation, new-run initialization, physical movement, pause clock, phone responses, compact menu focus, approaching Eli, accepting the job, actual browser reload/Continue and credits. The expanded regression additionally corrupts only the raw primary storage bytes, then uses normal Recover save/Retry UI, reloads the promoted backup, and cancels a confirmed New Game. This is a smoke path through the opening; it does not certify the complete mission.

The reporter route is a separate **supplemental accelerated functional probe**. It supplies a raw standard-mapped gamepad fixture to the engine's actual poller, uses real E interactions and normal menu clicks, and calls the existing `E.Game.advance` fixed-step clock between inputs. Physics, ammunition, hits, health, witnesses, wanted clearance and mission predicates remain authoritative. No mission flags, events, kills, transforms, health or rewards are injected. Five crew members were defeated through actual aimed shots; incoming hostile fire consumed 60 armor. The office/case alarm created tier 2 with depot location and no person/vehicle identity. Jun followed out on foot, including one permitted offscreen regroup, and was within about 3 m of Mara at the decision stop. At handoff his recorded physical position was about 68 m away; newer root regroup/proximity guards were not loaded in that page. This remains an escort/presentation concern. The runner now retains actual browser storage checkpoints and requires physical companion proximity after up to 30 s stationary waiting; those strengthened assertions have not yet been rerun. The recorded successful probe does **not** close S09 or V01, establish physical-controller completion, certify continuous audiovisual motion, or measure first-player pacing.

The first route attempt used a less accurate probe aim controller and an old self-occluded hostile-shot implementation; its harmless combat is not difficulty evidence. The successful fresh attempt loaded the actual shooter-ray fix and the probe's corrected stick-deadzone inversion. All ten successful-run screenshots were available for review; the office/alarm, handoff and credits frames were directly inspected.

## Defects and retest status

| ID | Observation | Status |
| --- | --- | --- |
| B01 | Settings → Low → Back → Enter on New Game leaked Enter to the gameplay `start` action. Game paused at tick 0, preventing movement. | Fixed by root; exact route retested: tick advanced to 2814 during real-input movement and collision probe. |
| B02 | At 960×600 the initial pause menu extended below the viewport; focus used `preventScroll`, allowing hidden lower actions to stay clipped. | Fixed by root; last-item visible-focus assertion passes in Chromium/WebKit. Compact pause screenshots inspected. |
| B03 | Initial focus list excluded settings inputs/selects; controller/arrow model could only reach action buttons and could not adjust settings. | Fixed by root; keyboard focus/quality/brightness assertions pass in Chromium/WebKit. Physical controller check remains open. |
| B04 | A stationary mouse over a recreated title Settings button could override keyboard focus, causing Enter to reopen Settings. | Root switched focus transfer to actual pointer movement; exact Chromium route now passes. |
| B05 | Corrupt primary disabled Continue despite a valid backup; New Game could clear both without confirmation. Loading a backup also left corrupt primary in place. | Fixed by root. Corruption, retained bytes before choice, explicit recovery, promoted-primary second reload and cancelled reset all pass in Chromium/WebKit/Firefox. |
| B06 | Firefox 155 failed before renderer initialization: `can't access property "VERTEX", wR is undefined`. The pinned Three module selected absent `self.GPUShaderStage` at import time, including when forcing WebGL. | Engine agent fixed the narrow enum fallback as P2; full Firefox opening/storage smoke now passes on automatic WebGL2 fallback. |
| B07 | At 756×352, subtitles overlapped the minimap and Health label/bar during actual gameplay. | Fixed by root. All 24 responsive-state recaptures/checks pass; actual fixed landscape screenshot shows clear health/map with subtitles above. |
| E01 | Reporter supplemental route had Jun within about 3 m at the decision, but about 68 m away at handoff despite the completed safe flag. | Root's subsequent on-foot regroup changes were not loaded in that page. A later route must verify actual companion proximity; no escort gate is closed here. |
| E02 | A manually seeded Low tier-3 performance diagnostic produced Rapier WASM `unreachable` followed by unsafe-alias errors. | Foundation marked the timing sample invalid and began first-exception investigation. Normal tier-3 pursuit and its endurance gate remain open. |
| P01 | Interior collision camera can be pushed very close to Mara, with her body occupying the left third of the view during an ordinary garage approach. | Presentation concern reported to root; no fix or acceptance claimed. Screenshot `/tmp/ewa93-qa/chromium-path-failed.png` now shows this gameplay view. |

A traversal probe walking straight east from the garage spawn was stopped by the hydraulic lift post at x104.5/y311. This is a valid physical obstruction. The automated authored route goes north of the post before approaching Eli; the collision is not recorded as a defect.

## Acceptance inventory

| Contract | Current evidence status |
| --- | --- |
| S01 boot/title/settings/credits | Opening UI/storage recovery and stripped-release UI smoke pass in Chromium/WebKit/Firefox; required-animation failure/reload passes in WebKit |
| S02 traversal/camera | Ordinary movement observed; full approaches/vault/crouch/camera gate unverified |
| S03 vehicles/seats/driving | Domain guards pass; foundation reports actual driving/seat/collision/query integration checks; authored ordinary-play driving/theft gate pending |
| S04 streets/witnesses | Domain observation/report rules pass; visual traffic/civilian endurance unverified |
| S05 weapons/melee | Domain rules pass; supplemental route exercised real pistol hits/reloads/incoming damage, plus engine mouse-chord and animation regressions; full combat contract/feel remains open |
| S06 cover/vault | Scene acceptance unverified |
| S07 crew AI | Six-actor role system requires actual encounter play/footage; unverified here |
| S08 crime/police | Three-tier domain rules pass; actual pursuit/escape/roadblock matrix unverified |
| S09 full mission/endings | Domain branches pass; reporter accelerated normal-action probe reaches ending/credits, with escort-position concern. Full required input/route/endings gate remains open |
| S10 phone/favor/economy | Domain favor/economy and normal phone paths pass; actual $60 armor purchase and $600 reporter reward observed; actual favor/food/repair runtime matrix pending |
| S11 saves/retry/replay | Domain backup/atomicity guards and actual opening reload/corrupt-save UI pass in all three browsers; remaining phase/failure matrix pending |
| S12 art/animation | Title views inspected; all five signature views, motion filmstrip and vehicle/character art gate pending |
| S13 audio/subtitles | Authored text exists; listening/mix/complete dialogue delivery acceptance pending |
| S14 controller/keyboard UI | Keyboard smoke under test; no physical PS5-compatible controller run performed |
| S15 browsers/performance/shipping | Opening and stripped-release UI smoke pass all three browsers; title matrix plus isolated ultrawide retest and 24 responsive-state recaptures pass; hardware performance, fresh-checkout and final verified publication gates pending |

## Software-renderer diagnostic performance

Foundation profiling used 1920×1080 presentation on Intel Core i9-13900K, 32 logical CPUs, Chromium 153.0.8010.12. Actual renderer: `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`. An RTX 3060 Ti 8 GiB with driver 617.42 is exposed to the environment, but the tested browser did not select it. Headed attempts also selected SwiftShader or failed GL initialization. No hardware-accelerated browser baseline is established.

The diagnostic manually seeded stress scenes and preserved health to keep sampling out of menus; they are not mission-acceptance playthroughs. Each used 2 s warmup and about 8 s measured drawing. High rendered at 1920×1080, Low at 960×540 with 1080p HUD. Audio was not unlocked in these samples. Evidence: `/tmp/ewa-engine-evidence/performance.json` and `profile-*.png`.

| Scene | Quality | Observed average FPS | p95 frame time | p99 frame time |
| --- | --- | --- | --- | --- |
| Central intersection | High | 1.10 | 2,799.9 ms | 2,799.9 ms |
| Depot fight | High | 1.97 | 1,216.6 ms | 1,216.6 ms |
| Tier-3 pursuit | High | 2.14 | 1,116.6 ms | 1,116.6 ms |
| Central intersection | Low | 3.86 | 1,133.3 ms | 3,816.5 ms |
| Depot fight | Low | 6.79 | 200.0 ms | 383.3 ms |
| Tier-3 pursuit | Low | Invalid sample | Rapier WASM failure during diagnostic | Under investigation |

These software results do not meet gameplay performance targets and cannot establish the specified hardware 60/30 FPS baselines. The short samples and very low frame counts also limit percentile estimates. The failed low-tier-3 run is excluded from valid timing conclusions even if raw nominal values remain in an earlier JSON revision.

## Required remaining verification

V01 physical controller completion and V02 full keyboard/mouse completion remain open. V03 both entries, extraction cars, favor variants, both endings and purchases remain open in the actual scene. V04 failure/recovery and V05 police truth require the complete runtime matrix. V06 requires reloads at every stable phase, both sides of handoff, favor/purchases, corrupt storage and quota/denial behavior. V07 collision/animation, V08 30-minute endurance, V09 all browsers/aspect ratios and V10 fresh packaged checkout remain open unless another evidence record explicitly closes them.

Initial boot screenshots were observations after a fixed delay. The later smoke records measured title readiness in a fresh browser context, on the local development server with warm OS filesystem caches; these are not shipped cold-load measurements. No 60 FPS, p95/p99, 25–35 minute pacing, audio quality, compressed transfer budget or hardware-baseline result is inferred from them. WebKit iPhone emulation is the closest available automated approximation to iOS Safari; real iOS Safari has not been tested. Phone-sized layout compatibility does not establish touch gameplay support; touch gameplay is excluded by the user.
