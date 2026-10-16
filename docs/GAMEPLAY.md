# Gameplay domain contracts

These modules contain browser-native ES modules with JSDoc types. They do not import the engine, DOM, audio, renderer or physics objects. All positions are metres in game X-east/Y-south/Z-up space. The engine adapter owns conversion.

`createGameState({ seed, runId })` creates schema 1: $80, 100 health, zero armor, pistol 12/48, unowned SMG, no case, no favor and no police heat. `runId` must be unique for each fresh run. `createReplayState(previous, newRunId, seed)` deliberately resets those values, the mission, favor and district; it rejects reusing the previous run ID. Completed free-roam state retains its earned payment until a new run is explicitly started.

All systems retain the root `GameState` reference. `restoreGameState(target, snapshot)` and `CheckpointManager.retry()` replace its contents in place; runtime must refresh references to nested actors/vehicles after restoration. Persistent IDs must agree with the world. Runtime objects never belong in `GameState`.

## Simulation integration

The orchestration owner increments `state.tick` and `state.elapsed` once per 1/120-second simulation step. `CombatSystem.tick(dt)` uses the authoritative tick for reload completion; it does not increment the clock. Other domain timers consume fixed `dt`. Do not advance any of these clocks while paused.

```js
const wanted = new WantedSystem(state);
const crime = new CrimeSystem(state, wanted);
const mission = new MissionDirector(state, { crime, depotPosition });
const combat = new CombatSystem(state);
const economy = new EconomySystem(state, wanted);
const checkpoints = new CheckpointManager(state);
const saves = new SaveStore(localStorage);

// After intentions, one physics step, contacts and perception:
combat.tick(dt);
crime.tick(dt);
if (wanted.tick(dt, state.player.position).cleared) {
  mission.handle(createEvent('WantedCleared', state.tick, 'police', 'mara', {}, stableId));
}
// Capture and persist only after attachments and mission commits are complete.
const result = checkpoints.flush({ seatTransition, commitInProgress });
if (result.snapshot) saves.save(result.snapshot);
```

`createEvent(type, tick, sourceId, targetId, payload, id)` produces an immutable-by-convention event record. Supply stable IDs for source interactions. The default ID contains type/source/target/tick. `MissionDirector.handle` returns `{ ok, reason?, duplicate?, events }`; accepted event IDs are retained in the snapshot. Rejected guards do not consume an ID. Handle emitted `MissionPhaseChanged` events to clean up old runtime objective presentation, stage AI and open the next dialogue. Scene timers never advance the mission. `CheckpointRequested` marks a stable boundary for the checkpoint manager; seat/commit guards still take priority.

## Mission event sequence

| Event | Required state/payload | Result |
| --- | --- | --- |
| `JobAccepted` | INTRO | COLLECTION; checkpoint after accepting |
| `CollectionCompleted` | COLLECTION; actual Bea interaction | APPROACH; depot message saved |
| `ApproachCommitted` | APPROACH; `{ route: 'gate' \| 'service' }` | RECOVERY; approach persisted |
| `JunReached` | RECOVERY; actual office interaction | Jun follows; case guard enabled |
| `CaseRecovered` | RECOVERY and Jun reached | Case inventory; wired remote alarm; EXTRACTION |
| `EnemyDefeated` | RECOVERY/EXTRACTION/EVASION; `{ enemyId }` | Idempotent crew bookkeeping |
| `VehicleEntered` | EXTRACTION; `{ actorId:'jun', vehicleId, seat? }` | Validates car/free passenger seat, attaches Jun; EVASION |
| `CompanionExtracted` | EXTRACTION; `{ vehicleId, seat? }` or `{ onFoot:true }` | EVASION after runtime confirms a valid depot exit |
| `WantedCleared` | EVASION; actual wanted tier zero | DECISION |
| `EndingChosen` | DECISION/HANDOFF; `{ ending:'broker' \| 'reporter' }` | Saves uncommitted choice; may change before handoff |
| `HandoffRequested` | DECISION; `{ locationId:'broker' \| 'waterfront' }`; clean; case/Jun present | HANDOFF confirmation |
| `HandoffCommitted` | HANDOFF; clean; case present | Atomic payment, case removal, ending, messages, district consequence; AFTERMATH |
| `FavorStarted` | Favor available; actual toolbox pickup | Toolbox carried |
| `FavorCompleted` | Toolbox carried; actual garage return | Exactly one free repair/respray earned |
| `ActorDown` / `ActorFailed` | `{ actorId:'mara' \| 'jun', reason? }` | Explicit failure/retry state |
| `DialogueAcknowledged` | `{ dialogueId }` | Archives acknowledgement without gating progression |

`MissionDirector.phase`, `.objective`, `.destination` expose current presentation data. Convenience methods are `.acceptJob()`, `.chooseEnding(ending)` and `.commitHandoff()`. The normal runtime must verify interaction distance, facing, line of sight, handoff presence and valid foot extraction before issuing events. Events are domain facts, not commands that teleport a player.

The cabinet alarm goes through `CrimeSystem.remoteAlarm` synchronously before the extraction checkpoint. It reports tier 2, the depot location and suspected theft, with no observed person or vehicle. A real witness or confirmed officer observation is still needed to identify Mara. The recovery encounter does not require killing every crew member to open the case; alternative tactics remain valid.

Broker pays $1,200, adds a contractor takeover notice and shutters the noninteractive market storefront. Reporter pays $600, adds an investigation notice and changes local radio. Both leave Jun safe and essential services available. `mission.completed`, `rewardPaid` and the transaction ID are committed together. Duplicate handoff events cannot pay again, including after serialization.

`recoverActor(id, validatedOffscreenPoint, eitherOldOrNewVisible)` permits at most two offscreen recoveries. A visible or invalid point returns a regroup instruction requirement; repeated actual recovery failure leads to explicit retry. Runtime performs the five-second path-progress measurement and validates authored recovery points.

## Police truth

`CrimeSystem.recordCrime({id,kind,position,severity,perpetratorId,vehicleId,tick})` alone never creates heat. `observe({crimeId,witnessId,witnessKind:'civilian'|'police',hasLineOfSight,seesPerson,seesVehicle,reportDelay})` creates a concrete report. Civilian reports default to three seconds; `interruptReport(witnessId)` cancels only incomplete calls. Police reports dispatch immediately. Runtime perception owns real line of sight, identification opportunity and witness interruption; distance/timer alone must not manufacture an observation.

`WantedSystem.receiveReport(report)` sets dispatch tier and search location from reported evidence. `sight({position,personId?,vehicleId?,confirmedSuspect?})` requires an identified person, a known vehicle, or an officer's confirmed suspect observation. Passing `confirmedSuspect` is appropriate for seeing the actual offense or the escaping suspect with evidence; merely seeing an unrelated pedestrian near an alarm is insufficient. `loseSight()` runs after the last actual officer loses sight. Call `tick(dt,position)` afterward. Heat cannot clear in sight or inside the search radius.

| Tier | Maximum patrols/officers/roadblocks | Search radius | Unseen time outside area |
| --- | --- | --- | --- |
| 1 | 1 / 2 / 0 | 60 m | 8 s |
| 2 | 2 / 4 / 0 | 100 m | 12 s |
| 3 | 3 / 6 / 1 | 140 m | 16 s |

`changeVehicle(oldId,newId,seen)` links the new car only when observed. It preserves known person identity. `respray(vehicleId)` removes that vehicle's appearance identification only when police cannot see it. It does not erase person identity, heat or the search region. `surrender({safe,holstered,heldSeconds})` accepts only a safe tier-1 opportunity after a one-second deliberate hold and produces arrest/retry. The runtime validates nearby officer, threat and safe conditions.

## Combat and economy

`CombatSystem.fire({weaponId?,muzzleBlocked?,muzzleHitId?})` consumes one magazine round only after cadence/ownership/reload/on-foot guards pass. It returns damage, range, spread and the actual muzzle hit ID. A blocked muzzle still consumes the shot but returns no victim. Runtime must cast from the camera to choose the aim point, then from the muzzle to resolve actual obstruction, with masks that include props, cars and actors. `resolveHit(targetId,{damage,sourceId,kind,blockedByGeometry,frontal,severe})` applies validated damage; never substitute camera line of sight for the muzzle query.

`reload(id?)` schedules the transfer; `tick(dt)` completes it once. Animation receives those events but never changes ammunition. Switching cancels an unfinished reload. `pickup(pickupId,'pistol'|'smg',{reserve?,grantWeapon?})` is idempotent by pickup ID and supplies free on-site ammunition. The SMG starts with 30/90 when first picked up. `equip('unarmed'|'pistol'|'smg')`, `block(held)`, `dodge({x,y})` and `meleeStrike()` implement the unarmed branch. Aim assistance filters hostile visible candidates; civilians and occluded targets are rejected.

Ordinary hostile bullets make Jun retreat without reducing health; player friendly fire cannot hurt him. A severe world impact, sustained fire hazard or out-of-level fall sets explicit failure. Runtime must evacuate disabled vehicles through a validated exit or issue failure if no safe evacuation exists.

`EconomySystem.purchase(service,{transactionId,vehicleId?,useFavor?})` owns deductions and effects. Food costs $10 and restores health; armor costs $60 and refills armor; repair/respray costs $80 and changes appearance. It rejects full-health/full-armor waste, insufficient funds, invalid cars and repair in actual police sight. An earned favor is consumed once before paid repairs. All effects and deductions share a durable transaction ID. Purchases request a checkpoint.

## Persistence and diagnostics

`SaveStore(storage,key?)` requires a `Storage`-compatible object; the domain has no implicit browser global. `.save(state,context)` returns an explicit success/error and defers unsafe handoff/seat/commit snapshots. Save requests must be queued by `CheckpointManager` and flushed after the transition. `.load({useBackup:false})` validates version, checksum, mission flags, inventory, wanted state and seat consistency. A corrupt/missing primary returns `backupAvailable` without silently restoring it. The UI offers the backup or New Game. Only explicit `.load({useBackup:true})` chooses the backup; a chosen backup may be restored with `.save(state,{replaceCorrupt:true})`. `.clear({confirmed:true})` is reserved for confirmed New Game.

The previous valid primary is written to `.backup` before the new primary. Invalid current saves are retained unless the user has explicitly chosen replacement. Storage denial/quota failures are returned to UI. `SettingsStore` persists independently. Schema 1 is the first shipping version; unknown versions are rejected, preserving the original bytes for a future explicit migration.

Checkpoint restoration order is world definition → persistent entities → transforms/velocities/health → attachments → mission/AI/wanted → UI. `.retry()` returns this order and keeps the root state reference. Actual physics reconstruction and browser-reload verification belong to the runtime/integration suite.

`SeededRng` supports `next`, inclusive `int`, `pick`, `snapshot` and `restore`; copy its snapshot back into `state.rngState` after generation and restore it when loading. `stateDigest` sorts object keys and hashes logical state for semantic diagnostics. It does not claim bit-identical cross-browser physics.

Verification: `node --test tests/unit/gameplay.test.mjs` exercises both endings, approach flags, guards, alarm identity, seat ownership, retry, favor consumption, purchases, crime visibility/report delays, all three clearance tiers, vehicle identification, surrender, ammunition, reload cancellation, hits, melee, Jun safety, backup corruption, storage failure, version rejection, replay, RNG and input clearing. These tests verify domain rules; they do not establish scene collision, art, hardware-controller or browser rendering acceptance.
