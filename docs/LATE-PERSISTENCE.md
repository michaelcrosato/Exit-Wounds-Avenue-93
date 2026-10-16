# Late persistence integration evidence

This record covers V06 and the persistence/retry/replay portions of S11. The authoritative acceptance contract is [design.md](../design.md). The runnable diagnostic is [late-persistence.test.mjs](../tests/integration/late-persistence.test.mjs).

The diagnostic uses explicit logical-state fixtures to reach late stages. It boots the complete source game, creates its real world/actors/physics, writes a validated save, reloads the document and selects Continue. It then exercises actual engine stepping, ordinary E interactions and menu controls. It is integration evidence; it does not establish a normal-play mission completion, physical-controller support, first-player pacing, rendering performance or the complete failure matrix.

Run one browser job at a time on this software-rendered machine:

```sh
PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 \
EWA93_PERSISTENCE_ENGINE=chromium \
node --test --test-concurrency=1 tests/integration/late-persistence.test.mjs
```

`EWA93_PERSISTENCE_ENGINE` also accepts `webkit` and `firefox`. `EWA93_BASE_URL` selects an existing source server; otherwise the test starts and removes a server on an available local port. The packaged release deliberately removes its diagnostic hook and is covered separately by release UI tests. `EWA93_PERSISTENCE_OUTPUT` selects the evidence directory; the default is under `/tmp/ewa93-persistence-*`.

After title boot, the diagnostic stops the RAF loop and uses the engine's fixed-step `game.advance()` to make state assertions deterministic. Screenshots receive a single explicit draw. Actual document reloads build new engine/runtime instances. The test does not maintain a second physics loop.

| Scenario | Required assertions |
| --- | --- |
| Every stable pre-handoff checkpoint | INTRO, COLLECTION, APPROACH, RECOVERY, EXTRACTION, EVASION and DECISION survive actual reload with the same full logical state, inventory, case, money, actor transforms and mission activation. |
| Seated escape | Mara in the van's driver seat and Jun in its passenger seat reconstruct unique seat ownership, disabled actor collision bodies, vehicle velocity/health/appearance, case and tier-2 search. Live stepping preserves heat and attachments. |
| Queued checkpoint | A request during physical seat entry preserves the prior SaveStore bytes, waits until entry ends, writes the requested checkpoint and reconstructs the completed attachment after reload. |
| Interrupted civilian-car taking | An actual E begins the driver's physical exit. A synthetic impact notification interrupts the game-level taking sequence, restores unique driver/seat ownership and collision disablement, and remains coherent after save/reload. Actual chassis impact generation is covered separately by the engine tests. |
| Favor and purchases | Actual E interactions consume one earned repair/respray favor, remove the car's recorded identity, restore the car, charge food/armor and grant a single ammo pickup. Reload retains cost, health, armor, appearance and inventory without duplicate ammo. |
| Retry | Defeated crew cease participating in hero collision queries. The Retry UI restores the checkpoint's living crew, actual Rapier collision masks/query participation, inventory and money. |
| Seated-to-foot retry | A fresh on-foot checkpoint boards Mara and Jun through the actual E/automatic-companion sequence, then retries in the same document. Both actors regain enabled foot bodies; Jun regains his original collision group and mob-query participation. This specifically catches state that a fresh reload would conceal. |
| Both handoffs | A chosen reporter/broker destination survives pre-handoff reload. Actual E commits the exchange and writes AFTERMATH with the correct reward, message, case removal and district consequence. Reload, repeated E, a duplicate commit event and checkpoint retry do not pay again. |
| Replay after Continue | The completed free-roam pause menu exposes Replay. Cancel retains the completed run; confirmation creates a distinct run with initial wallet/ammo, no case/heat/consequence and a fresh persisted checkpoint. |
| Corrupt primary | Original corrupt bytes remain unchanged through New Game cancellation and the first Continue attempt. The error visibly offers the previous-good checkpoint; explicit Retry restores/promotes it. |
| Write denial | A simulated quota failure preserves the previous good save and visibly reports that the checkpoint could not be saved. |
| Storage unavailable at boot | Browser storage denial visibly states that progress lasts only for the session. Play and in-session checkpoints work; a new document has no false Continue option. |

Executed 2026-10-16 on Chromium **153.0.8010.12**, seed **93**, 960×600, using the WSL2 software-rendered environment. **All 11 scenarios have passing runtime evidence across two serial runs.** Every passing case also asserted no page/console errors. Both Chromium processes closed, and the browser slot was returned to the next QA owner.

- Bulk run: `/tmp/ewa93-persistence-chromium-20261016/report.json` — 9/11 passed, 679.2 seconds. The two retained failures were test-harness issues: reading the save before an officer's boarding transition finished, and expecting title-case `innerText` despite CSS uppercase rendering.
- Focused rerun: `/tmp/ewa93-persistence-chromium-targeted-20261016/report.json` — repaired service/pickup and corrupt-save scenarios both passed, 160.0 seconds. The service test now waits for all seat transitions and pending checkpoints to settle before inspecting storage; the recovery label assertion ignores case.
- All eight generated PNGs across those directories were inspected: seated escape/search, both handoff presentations, explicit backup recovery, storage denial warnings and the two retained harness diagnostics. The write-denial PNG predates a later copy-only improvement to “Checkpoint could not be saved. Browser storage may be full or blocked.” The test assertion was updated to that wording and syntax checked; that copy-only assertion has not received a separate browser rerun.

The source-inspection findings fixed by the root agent now have passing regressions: queued `CheckpointManager.pendingId` requests flush after seat entry; Replay remains accessible from the completed-run pause menu after Continue; and Jun regains his on-foot collision group after an in-session retry from a seated state. Interrupted civilian-car taking also retains one valid driver through save/reload.

The late-stage matrix was run in Chromium only. The fixtures deliberately prepare late mission states; this does not certify a normal-play route or the physical-controller gate. The complete V04/V05 matrix, including arrest and tier-3 roadblock retries, remains separate. Two unverified source-inspection leads were reported to the root agent: `PoliceActors.restore()` retains transient arrest/path/shot fields, and `restoreRuntimeFromState()` does not reset `roadblockSet`. This suite did not exercise those paths and does not assign them a runtime pass or failure.
