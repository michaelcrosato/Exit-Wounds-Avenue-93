# Independent completeness audit

Audit date: 2026-10-16. Scope: all of `design.md`, the integrated source, build and test code, current progress/test/engine/world/animation records, and available browser evidence. The source was changing during review; the starting tracked commit was `a486740`, with most integrated files still untracked. This is an interim audit of that working tree, not certification of a release commit.

**The completion gate remains open.** Domain tests establish useful invariants; they do not establish an ordinary-play ending, polished presentation, a physical controller run or release delivery. The user's later decision excludes touch gameplay. That override is correctly retained: `InputAdapter` disables engine touch controls and no virtual gameplay sticks are supplied.

Status vocabulary: **proved** means the entire cited acceptance condition has direct evidence; **contradicted** means an inspected implementation path conflicts with a requirement; **missing** means the required implementation/evidence was not found; **too weak** means partial code or evidence exists but cannot establish the full condition. A row can have proved subparts while its complete contract remains open.

## Priority findings

1. **P1 — full route and recovery evidence is missing, with a blocked probe recorded.** `tests/e2e/smoke.test.mjs` reaches the opening job and tests UI/storage recovery, not either handoff or free roam. The WebKit reporter probe at `/tmp/ewa93-qa/route-reporter/report.json` stopped in RECOVERY at **(348.006,156.820)**: “Normal aimed fire did not resolve the visible encounter within 70 bursts.” Its only mission checkpoints reach the gate commitment; health remained 100, consistent with the subsequently reproduced hostile-fire defect. A new probe was running at final handback. `mission-route.mjs` uses a raw standard-gamepad fixture and accelerated fixed steps, keyboard interactions and mouse menu clicks; even a passing result is supplemental route evidence, not V01 or V02. Complete both real input paths and the phase reload/failure matrix before claiming S09/S11/M4/M6.

2. **P1 — earlier combat results cannot certify the repaired encounter.** The old `src/main.js::hostileShot` excluded Mara but not the shooter from its visibility ray. An independent actual Rapier query from `crew-guard-gate` at its authored muzzle height hit that same guard at distance **0**, reporting no visibility; ignoring the guard cleared the identical 8 m ray. The parent replaced this with shooter-excluding obstruction/hit resolution. This repairs a critical harmless-enemy-fire defect, but requires new fight, health/difficulty, death/retry and route evidence. Likewise the rear route now starts unaware, requires sustained sight and shares an observed last-known position; the old global alert/unknown-player fallback has been removed in source.

3. **P1 — new graph navigation needs authored-scene acceptance.** The parent replaced direct-line crew/officer movement with foot-graph routes. Its first version selected the first distant node without consuming passed nodes and oscillated around the start. Running the actual update methods on an occluded A(0,0) → B(20,0) → C(20,20) route reproduced maximum progress of **1.61 m** for crew and **2.02 m** for police after 10 s. The corrected version drops the start and consumes reached nodes: after 20 s crew reached **(19.998,19.980)** and police **(19.779,17.786)**, within its stop radius. That diagnostic regression passes; physical office walls, cover/flank entrances, stairs/vault edges and pursuit areas still require real scene checks.

4. **P1 — release tests and release diagnostics have diverged.** `tools/build.mjs` now strips the unrestricted `window.__exitWounds` block, as required. However `tests/e2e/smoke.test.mjs`, `mission-route.mjs` and `responsive-states.mjs` depend on that hook, while the test report advertises `EWA93_BASE_URL` for a packaged preview. A normal stripped build needs a UI-only packaged smoke and fresh-checkout evidence. Reproduce by building, serving `dist`, and running the current semantic suite against that preview. Do not reintroduce unrestricted release hooks to make the suite pass.

5. **P2 — endurance is still unmeasured after adding retention.** Crime/report histories previously grew on every repeated offense and were scanned every fixed step. `src/systems/crime.js::pruneHistory` now retains active/recent evidence with explicit limits, and trims old wanted report IDs. This removes the inspected unbounded-history path; V08 still needs actual 30-minute entity/audio/listener/body/memory/save-size measurements, including repeat pursuit/retry/switching.

6. **P2 — presentation remains unaccepted after recent integrations.** The parent added handbrake skid calls, muzzle/impact particles and ricochet sound during review. The vehicle layer is still a single oscillator/filter rather than demonstrated layered rev/load/tire behavior. Current signature scenes, the repaired encounter/drive in motion, consistent attachment/pose quality and complete speaker/headphone listening remain required. Asset provenance and pose tests cannot establish that finish.

7. **P2 — layout has a recorded active-gameplay failure.** The completed title matrix reports 42 captures with no errors/overflow, and the active-state WebKit run passes. The Chromium active-state report at `/tmp/ewa93-qa/responsive-states/report.json` fails the 375 × 667 gameplay layout: objective/right HUD/subtitle extend to **450.39 px**. Pause/phone in that report pass. This is an actual small-viewport compatibility defect despite no document scrollbar; inspect the screenshot, fix the grid sizing and rerun active states. Touch gameplay remains excluded.

8. **P2 — complete input parity still requires real device evidence.** The parent added mouse-direction wheel selection, driving look-behind, phone hotkey closing, missing control help and an unrecognized-controller warning. These are source-reviewed repairs. Complete remapping, wheel release, hotplug, pointer/focus recovery and the entire game on the actual required devices; retained mappings and synthetic polling cannot substitute for V01/V02.

## Repairs prompted during this review

The parent integrated these changes while the audit ran. They are **source-reviewed**, except for the two independently reproduced runtime passes below; the broader scene regressions are still required.

| Finding | Current repair and evidence |
| --- | --- |
| Jun never boarded if he reached a stopped car after Mara's entry event | `main.js::postPhysics` now retries boarding into a free compatible passenger seat. Verify late arrival, occupied front passenger/rear-seat fallback, moving car and destroyed car in the actual mission. |
| Police drivers never dismounted and foot officers ran directly into walls | `PoliceActors` now receives the vehicle system/foot graph, exits nearby stopped patrols and selects foot routes. Full pursuit/arrest/obstruction evidence is still open. |
| Patrol AI overwrote controls of an empty cruiser taken by Mara | Source now skips Mara's occupied patrol before all AI branches. **Independent actual Chromium/Rapier diagnostic:** staged entry through the real seat transition, raw R2=0.7; at heat 0 and heat 1, controls remained throttle=0.7/brake=0/handbrake=false; speed reached 0.844 m/s in the heat-zero sample. No page errors. |
| SMG returned spread data but the integrated shot ignored it | Integrated fire now applies seeded angular spread and burst growth. Verify actual hits/range/muzzle obstruction after this change. |
| Saved audio volumes showed restored sliders but used default mixer values after reload | Constructor now applies loaded settings before audio unlock. **Independent Chromium pass:** master set to 0 through settings, browser reload, New Game; loaded setting, audio setting and actual master gain all equaled 0; no page errors. |
| Options paused but did not resume despite displayed help | `GameInterface.handleFrame` now handles pause/start on the pause screen. **Independent Chromium pass:** raw `navigator.getGamepads` standard fixture; first Options paused, second resumed; no page errors. This is synthetic controller evidence only. |
| In-session retry/new run retained the previous dialogue line/timer | All transition paths now clear current dialogue and its timer. Recheck late-phase retry and replay. |
| Revived crew retained downed collision masks after retry | `CrewSystem.restore` now restores solidity for living actors. Recheck killed crew → encounter retry → hit/collision. |
| Repair was saved before runtime paint was synchronized | `captureCheckpoint` now calls `syncState` before capturing. Recheck purchase/favor consumption, respray color, attachments and immediate browser reload. |
| Visible Jun could remain blocked forever; recovery count/mode did not survive Continue | Visible failures now count toward explicit retry, and Jun's mode/recovery count/last safe point are synchronized. Verify blocked-door recovery and reload at the first recovery attempt. |
| Driving look-behind, phone hotkey closing and control-help omissions | Parent added these paths/help during review. They require direct keyboard/controller regression. |
| Release exposed mutable app/state/runtime | Build now removes its marked diagnostic block and rejects an unmarked hook. Verify the packaged output and adapt shipping smoke as noted above. |
| Rear route instantly alerted all crew and supplied hidden player position | Crew now begins unaware on the rear approach, accumulates sight before alerting, and uses shared last-known evidence. Physical rear-entry encounter acceptance remains open. |
| Crew/officer graph followers oscillated around the initial node | Reproduced with actual update methods, then rerun successfully after monotonic node consumption. Numerical before/after evidence is recorded above. |
| Enemy visibility ray hit the firing actor at distance zero | Reproduced with real Chromium/Rapier query. Shooter exclusion/hit resolution is source-repaired; every earlier encounter result needs retesting with damaging enemies. |
| Downed officers reported new crimes | `reportCrime` now skips nonliving officers. Recheck hidden crime near a corpse with no other observer. |
| Melee used distance/angle without geometry and failed across the ±π seam | Parent added wrapped angles and a chest-height obstruction check. Verify a thin wall/barrier and targets across the facing seam. |
| Companion restore retained prior navigation/stuck timers | Restore now resets target/path/replan/stuck/progress around the restored position. Recheck retry and browser Continue near a blocked route. |
| False stray-shot RNG draw was not saved | Parent now snapshots the extra RNG sample regardless of its outcome. Recheck checkpoint RNG continuity. |
| Crime history grew without bound | Source now prunes resolved/recent histories; full endurance measurements remain open. |
| Officer vision could reject the suspect car as an obstruction | Source supplies the suspect vehicle as the allowed sight target. **Independent actual Chromium/Rapier diagnostic:** known `patrol-1`, seated Mara, officer-2; sight=true, wanted.visible=true, mode=chase, no page errors. Setup used direct diagnostic staging and accelerated steps, not ordinary-play acceptance. |
| Low-cover animation masked effective stance/headroom | `registerAnimations` now supplies effective crouch and aim from the cover controller. Source repair reviewed; tuck/rise/peeks/headroom still need motion evidence. |

## S01–S15 contracts

No full S-row is certified by this audit. Statuses below refer to complete rows, not to whether some implementation exists.

| ID | Status | Evidence and remaining acceptance |
| --- | --- | --- |
| S01 | Too weak | Cold title, menus/settings, New Game, opening Continue, credits and explicit corrupt-save recovery have actual Chromium/WebKit/Firefox smoke evidence. `/tmp/ewa93-qa/asset-failure/report.json` proves WebKit required-animation failure and recovery. Final packaged boot/error recovery is open. |
| S02 | Too weak | Real movement, capsule collision, orbit/sweep and selected locomotion exist. Both ordinary-play approaches, contextual vault, wall-adjacent aiming and sustained motion inspection are open. |
| S03 | Too weak | Real Rapier raycast-wheel sedan/van/cruiser, analog controls, damage, complete seat-body disabling and validated exits exist; adapter integration tests are relevant. Same-route differences, late Jun boarding, blocked doors, actual theft/interruption and usable stolen cruiser need mission-scene proof. |
| S04 | Too weak | Twelve physical ambient cars, 24 residents, signals/reservations/fear/witness candidates exist. `docs/WORLD.md` records useful 90-second detour/theft/occlusion diagnostics. Quiet/collision/gunshot flow and no-jam/no-visible-teleport behavior over normal play remain open. |
| S05 | Too weak | Ammo, health/armor, reload, two weapons, melee/block/dodge and camera/muzzle queries exist. The previously ignored spread was repaired during audit; actual scene accuracy/obstruction/assist/hit/death and interruption checks are still needed. |
| S06 | Too weak | Authored cover, tangent/peek, headroom/fire gating and effective animation inputs exist after repair. Both cover edges, actual flank reachability, tucked/rising motion and vault-near-obstruction acceptance remain open. |
| S07 | Too weak | Six persistent roles, a four-pressure cap, rear detection delay/shared last-known and consumed graph routes exist after repairs. A focused graph regression passes; full damaging encounter/flank/death/retry is not evidenced. |
| S08 | Too weak | Domain rules distinguish hidden crimes, reports, identity, geographical search and all three tiers. Actual runtime alarm carries location without identity. Independent seated-suspect vision and cruiser-control diagnostics pass; recent police path/dismount/ownership changes still need the full sight/vehicle-switch/respray/arrest matrix. |
| S09 | Too weak | Every named phase, both domain rewards/consequences, case inventory and companion logic exist. No ordinary-play full ending is certified; alternate approaches/cars, missed calls and essential-actor/car failures remain open. |
| S10 | Too weak | Phone responses/messages, toolbox favor and food/armor/repair economics exist; the opening phone works in browser smoke. Complete the physical favor, consume its service, buy after either ending and reload those states. |
| S11 | Too weak | Version/checksum/backup/seat validation, stable-seat deferral, checkpoint retry and replay exist; actual opening reload/corruption UI passes. Latest runtime-sync/escort restoration repairs need all late-phase/seat/pursuit/handoff/purchase reloads and storage-failure proof. |
| S12 | Too weak | Original procedural city/vehicle geometry, outfits, selected licensed mocap and recent muzzle/impact integrations exist. Diagnostic frames and actual opening screenshots were inspected. They do not prove current five signature compositions, a pursuit beneath the overpass, all transitions or attachment quality. |
| S13 | Too weak | Procedural city/combat/vehicle/skid sounds, staged text, subtitles, radio program changes and mix controls exist. Persisted master mute passed independently after repair. Layered vehicle behavior and convincing complete mix/listening on speakers and headphones are not established. |
| S14 | Too weak | Large DOM menus/HUD, PS-style glyphs, keyboard/menu smoke, remapping and raw analog polling exist; Options regression passed synthetically. Physical PS5-compatible completion, full keyboard/mouse run, hotplug/focus/remap, wheel parity and unknown-device presentation remain open. |
| S15 | Missing | Parts exist: pinned engine/notices/source block, browser opening checks, build and asset tools. Named hardware performance, full active-state layouts, fresh checkout, verified public remote and remote/local commit equality have no final evidence. |

## V01–V10 verification

| ID | Status | What is actually established / still required |
| --- | --- | --- |
| V01 | Missing | No physical PS5-compatible title-to-ending/settings/credits run, controller/browser/connection record or physical hotplug test. Raw fixtures cannot close this row. |
| V02 | Too weak | Real keyboard opening/menu/reload input passes. No full other-ending run, pointer-lock re-entry, remapping and focus-loss completion record. |
| V03 | Too weak | Domain branches/payments and useful scene diagnostics exist. Both entries, sedan/van, favor variants, both visible endings and post-mission purchase remain unproved as an integrated matrix. |
| V04 | Too weak | Failure/retry domain rules exist. Death per combat stage, arrest, starting-car abandon/destroy/overturn, blocked entry, missing call, Jun path failure and leaving/returning are not fully exercised. |
| V05 | Too weak | Domain truth tests and world civilian-occlusion diagnostics are relevant. Runtime police sight, seen/unseen vehicle switches, search re-entry, garage and all response tiers need scene evidence after police changes. |
| V06 | Too weak | Opening actual reload/Continue, explicit validated backup promotion and cancelled reset pass. Late seats/checkpoints/pursuit, immediately before/after handoff, favor/purchase and real storage-failure behavior remain open. |
| V07 | Too weak | Actual adapter queries/wheels/seats/collision and capture stepping pass focused integration tests. Authored ordinary driving turns/ramps, varied impacts, moving-car adjacency, vault/cover/blocked-door and permanently locked animation checks remain open. |
| V08 | Missing | No 30-minute stabilized entity/audio/memory/listener/body/save-size report; unbounded crime history is a concrete concern. |
| V09 | Contradicted | Opening smoke passes three desktop engines; completed title matrix reports 42 captures with no errors/overflow. Active Chromium gameplay at 375 × 667 clips to x450.39; active WebKit report passes. Decision/retry/final image review remain incomplete. WebKit iPhone profiles approximate Safari; touch completion is excluded. |
| V10 | Missing | No clean public checkout/`npm ci`/tests/build/normal static-preview record at a verified final commit. Hook-dependent E2E tests currently need a separate release-compatible path. |

## M0–M7 milestones

| Gate | Status | Completion boundary |
| --- | --- | --- |
| M0 | Too weak | Pinned full engine and 3D module, unit conversion, shared stepping, analog, actual vehicles/seats/queries/camera/mocap/WebGL2 have focused evidence. Physical controller menu/gameplay proof and confirmed root model/effort are not supplied; the source block candidly distinguishes delegated model from unverified root. |
| M1 | Too weak | Six authored locations, connected graphs, colliders, interiors and both depot anchors exist. Static route clearance is useful; normal drive loops/walk approaches and transitions must still be exercised. |
| M2 | Too weak | Street population/crime/wanted integration exists with short diagnostics. Full response/escape/arrest/jam acceptance is open after police changes. |
| M3 | Too weak | Weapons/cover/crew are integrated and several critical perception/navigation/hostile-shot defects were repaired. Two-route damaging fight/death/retry and effective-cover-animation evidence are missing. |
| M4 | Too weak | Content/domain state machine exists. Two complete ordinary playthroughs plus integrated recovery/persistence are not established. |
| M5 | Too weak | Original visual/audio/animation/UI foundations and some inspected captures exist. Required final signature/motion/drive/encounter/audio/couch-distance acceptance is open. |
| M6 | Missing | Physical/full keyboard runs, complete route/failure/reload matrix, named hardware busiest-scene performance and fresh-player 25–35-minute pacing are unverified. |
| M7 | Missing | Engine evaluation/README/notices exist, but most implementation files were untracked, `git remote -v` was empty, no public verified commit/fresh checkout was demonstrated, and the release-compatible smoke is unresolved. |

## Evidence reviewed and limits

- Read `design.md` in full, every owned game module and the relevant engine input/query/seat/camera/animation/build paths; inspected the gameplay, integration and E2E test code and the current documentation. This was a source/runtime completeness review, not a new source-research exercise.
- Inspected `/tmp/ewa93-qa/e2e-final-smoke/report.json` (Chromium/WebKit opening/storage passes; earlier Firefox failure) and `/tmp/ewa93-qa/firefox-p2/report.json` (Firefox opening/storage pass after the enum patch). The tests check ordinary opening input; neither report contains a complete mission ending.
- Directly viewed current opening gameplay, diagnostic depot-interior/waterfront images, the small-phone gameplay capture, blocked-route capture and required-animation error capture. Additional motion/filmstrip artifacts exist under `/tmp/ewa-motion-profile*` and `/tmp/ewa-animation-filmstrip`; their existence does not establish that the required full motion/audio review passed.
- Independently ran a Chromium local-source diagnostic with ordinary settings/New Game UI and a raw standard-gamepad fixture: persisted mute and Options pause/resume passed with zero page errors. The fixture is supplemental controller evidence; no physical controller or complete mission was used.
- Independently reproduced the hostile ray's self-hit using actual Chromium/Rapier; independently reran the 3-node crew/officer navigation reproduction after its fix; independently checked actual player cruiser controls at heat 0/1 and known seated-suspect police sight. The latter scenarios used explicit diagnostic staging and fixed-step advancement, so they do not count as ordinary mission progress.
- Final evidence refresh inspected the blocked reporter-route report, passed WebKit asset-failure/recovery report, completed 42-capture title matrix and the Chromium-failed/WebKit-passed active-state report. The newly running route and any later layout repair/retest are outside this handback snapshot.
- No hardware-rendered FPS/p95/p99 claim, full mission/pacing claim, headphone/speaker mix approval, real iOS Safari claim or public-repository availability claim is made here.

Re-audit against the final committed tree and final evidence after fixes. Keep the release gate open until remaining requirements are actually met.
