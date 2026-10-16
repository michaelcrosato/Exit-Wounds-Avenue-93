# Exit Wounds Avenue-93 — implementation design and Codex handoff

Prepared 2026-10-16. Status: **plan ready for implementation; the game has not been built or tested**. All implementation gates below start open.

## 1. Execution contract

Build one complete, polished, original urban crime game level on **my-3d2dge**. The reference is **Grand Theft Auto IV for Xbox 360, PS3 and PC**. Aim for the coherence, finish and replay value of the MGS2 Tanker demo or Ground Zeroes: an authored place with interacting systems, a complete dramatic arc, and a satisfying ending. Those examples are quality references, not a promise of their content volume.

The authoritative brief is `/home/micha/.codex/attachments/3a02681b-9f95-45bb-948d-7095303e535e/pasted-text-1.txt`, SHA-256 `bbeb4f720e40b0e582e510040fc7c90b336bb6aab9d65ca8bccd9f8e7a8ba48c`. This document is self-contained so the attachment need not travel with the handoff. Earlier attachments are superseded.

Two scope decisions are settled:

- The latest attachment removed the cel-shading requirement. Use the grounded visual direction in section 3; no mandatory toon filter.
- The user subsequently chose: **“Prioritize controller and keyboard/mouse; remove the touch completion requirement.”** Complete both of those input paths. Do not build touch gameplay controls, gesture schemes, virtual sticks or a mobile HUD. Small-screen checks still apply to layout and compatibility; a coarse-pointer device may show a single menu/settings button.

The present deliverable is this plan. The following instructions authorize and describe the **future implementation session**, including dependency installation, engine modification, local Git initialization and creation of the requested public repository. No game build, remote publication, physical controller test or engine evaluation is claimed by this planning document.

### Model selection and launch

Use exactly **`gpt-6.1-sol`**, with Codex **`model_reasoning_effort="ultra"`**. “Ultracode” is the requested mode name; the verified configuration is Sol plus Ultra, with no verified separate `--ultracode` switch. Codex Ultra supports maximum reasoning with delegation. It is distinct from a speed tier and should not be copied into an API reasoning parameter without checking that API's schema. [Codex models](https://learn.chatgpt.com/docs/models?surface=cli), [subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents).

The [official Sol model page](https://developers.openai.com/api/docs/models/gpt-6.1-sol) documents a 1,050,000-token context window. Local CLI version is `0.163.0`; local configuration requests a 1,050,000 context window and compaction at 950,000, while the cached model descriptor still lists 272,000. These are observed configuration differences, not a tested runtime capacity. Verify the selected session with `/model` and `/status`; explicitly select Sol/Ultra because saved defaults may select another model. Do not silently substitute a different model or assume the large context eliminates compaction. [Configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference).

Run this only when starting implementation. Its bypass option reflects the user's requested YOLO operation; it changes approval/sandbox behavior, not reasoning quality. Local `codex --help` confirms these flags:

```bash
codex -C /home/micha/dev/gta4-gpt6a \
  -m gpt-6.1-sol \
  -c 'model_reasoning_effort="ultra"' \
  --search \
  --dangerously-bypass-approvals-and-sandbox \
  'Read design.md completely. Implement its full vertical slice on the pinned engine. Use independent subagents where useful, retain every slice requirement, and verify the completion gates before declaring done.'
```

### How to execute this plan efficiently

The parent agent owns integration, shared interfaces, this plan and final verification. After agreeing contracts, independent agents can own vehicle/input work, world/assets/animation, and combat/mission/UI in disjoint files. Assign one owner to shared files. Each handback names changed files, tests actually run, assumptions and unresolved defects. Delegate review independently; do small serial edits locally. Available concurrency is a runtime fact, not a reason to assume unlimited workers. [Subagent guidance](https://learn.chatgpt.com/docs/agent-configuration/subagents).

Use milestones with playable outcomes. Maintain `docs/PROGRESS.md` with completed IDs, evidence paths, current defects, decisions and the next executable step. At each milestone or before compaction, update that record. On resumption, reread it, this plan and the current Git state. Keep research findings concise; do not repeatedly load entire vendor bundles or ask for private chains of thought. These are general long-running Codex practices, not special Sol-only prompting claims. [Long-horizon tasks](https://developers.openai.com/blog/run-long-horizon-tasks-with-codex).

Preserve the full slice. Temporary grayboxes are acceptable during construction; they cannot pass the final gate. If an engine limitation appears, build an adapter or a narrow engine extension and retest. Do not rename a missing feature as optional, mark a milestone done on screenshots alone, or replace the required engine.

## 2. Source research and design translation

Research accessed 2026-10-16 covers the base game's campaign progression, movement and combat, vehicles, pursuit, enemies/factions, contacts, side content and UI. Guide coverage is broad; it is not a claim that every source mission was personally replayed. Expansion-only factions are not evidence for the base game's content.

| Source finding | Design response in this original slice |
| --- | --- |
| Early missions combine social context, observation, a phone call, driving and confrontation; later missions change location and locomotion as pressure rises. | A collection job moves through a living street, depot infiltration, a short fight, companion extraction, police search and a quiet personal payoff. |
| The city remains interesting between objectives, with differentiated cars, street life and personal contacts. | Preserve a calm drive with conversation, useful services, believable traffic, recognizable local residents and one earned favor. |
| Wanted escape is geographical: sightings update a search area and unseen escape matters. | Police track reported evidence and last-known location; loss of sight, route choice and an unseen vehicle change all work. |
| Cover, weapon roles and physical movement create tactical choices. | Build useful cover, one readable flank, short vaults, weighty vehicle collisions, two distinct firearms and a small complete melee system. |
| Social benefits and decisions connect to progression. | One local favor changes an extraction option; the final choice changes payment, messages and the district's aftermath. |
| Contemporary reviews praise urban atmosphere and character while criticizing camera friction, small phone text, repetitive missions and unreliable escorts. | Improve camera collision, readable menus, varied pacing and companion recovery; add stage checkpoints as our own usability improvement. |

These responses are design synthesis. New names, dialogue, maps, models, recordings and music must be original or appropriately licensed. Do not use Rockstar assets, logos, character likenesses or copied mission layouts. Do not claim Euphoria physics or equivalent simulation fidelity.

Keep this short source list in the finished plan:

1. [Rockstar Xbox 360 manual](https://media.rockstargames.com/rockstargames-newsite/img/manuals/en_uk/GTAIV_360_MANUAL_CRED18_ENG.pdf), especially controls, phone, navigation, food and radio: primary interaction inventory.
2. GTA4.net [campaign index](https://www.gta4.net/missions/index.php), [chapter one](https://www.gta4.net/missions/chapter-one.php), [two](https://www.gta4.net/missions/chapter-two.php), [three](https://www.gta4.net/missions/chapter-three.php) and [four](https://www.gta4.net/missions/chapter-four.php): broad mission and progression research. Useful patterns include the changing verbs in *Bleed Out*, approach/extraction reuse in *The Snow Storm*, and convoy-to-foot-to-car escalation in *To Live and Die in Alderney*.
3. [Grand Theft Wiki wanted system](https://www.grandtheftwiki.com/Wanted_Level_in_GTA_IV): sightings, search area, vehicle identification and escalating responses. Its numerical details are references, not calibrated constants for this game.
4. [Grand Theft Wiki faction index](https://www.grandtheftwiki.com/Gangs_in_GTA_IV): faction variety; filter out expansion-only entries.
5. GTA4.net [weapons](https://www.gta4.net/weapons/), [friends and girlfriends](https://www.gta4.net/friends-and-girlfriends/) and [completion checklist](https://www.gta4.net/100-percent-completion-checklist/): equipment, relationship rewards and the breadth of activities beyond the campaign.
6. [Ars Technica console review](https://arstechnica.com/gaming/2008/05/gta-4-review/) and [GameSpot PC review](https://www.gamespot.com/reviews/grand-theft-auto-iv-review/1900-6202100/): contemporary reception and friction worth improving. These are historical critical perspectives, not universal player opinion.

## 3. Game identity and player experience

**Title:** Exit Wounds Avenue-93. **Repository slug:** `Exit-Wounds-Avenue-93`. **Destination:** `https://github.com/michaelcrosato/Exit-Wounds-Avenue-93`. The draw and all 50 candidates are in section 13. Freeze this identity unless a repository collision requires a replacement suffix.

**Mission:** “The Last Collection.” **Setting:** Morrow Ward, a fictional industrial waterfront in Calder Bay, during a wet autumn evening. **Protagonist:** Mara Vale, a municipal recovery driver doing private jobs after her depot closed. **Contact:** Eli Serrano, who runs a repair garage. **Witness:** Jun Park, a payroll clerk carrying proof that a contractor diverted workers' wages. The adversary is a contractor's recovery crew; local police respond to observed crimes rather than serving as omniscient mission guards.

Mara agrees to collect a sealed payroll case for a broker. The depot crew has detained Jun, who explains what the case proves. Extract Jun and the case, survive the response, then decide where to hand over the evidence: the broker's secure drop for $1,200, or a neighborhood reporter's drop for $600. Jun survives either completed route; the difference is whether the evidence becomes public. Both endings include a completed exchange, distinct dialogue/messages, a visible local consequence and usable payment. No ending is a “coming soon” branch.

Target a **25–35 minute first completion**, with exploration and the favor extending it toward 40 minutes; measure this with a fresh player and tune pacing without padding travel. A skilled replay may be shorter. The district stays available for free roam afterward, and Replay starts a fresh mission run with explicit inventory/seed rules.

Core loop: hear a grounded request → navigate a living place → choose an approach → handle a physical confrontation → escape using city knowledge → see a personal consequence. The game should look and sound like a place people inhabit before the player arrives.

### Visual and audio direction

Use coherent stylized realism that the engine can sustain: believable scale, detailed silhouettes, restrained surface variation, cool gray-blue skies, warm shop windows, wet asphalt, brick, painted steel and weathered signage. Original workwear silhouettes distinguish civilians, recovery crew and police. Avoid an inconsistent mix of fantasy props and realistic cars. Main characters must have recognizable faces/clothing at gameplay distance; vehicles need modeled interiors visible through windows, turning wheels, functioning doors, lights and damage states.

Compose five signature views: the warm garage against the wet street; an elevated rail structure framing the market; a depot lit by practical lamps; a pursuit turning beneath the overpass; and the quiet waterfront aftermath. Sky, fog, lights, props, animation and physics should support those scenes during play. Do not add a technology showroom.

Author a complete soundscape: footsteps by surface, layered vehicle rev/load loops, tires/skids, collisions, rain, distant traffic, interiors, gunfire/reload, sirens and a restrained adaptive score. One original radio program can combine licensed/original music and local announcements. Record or generate licensed original dialogue if available; otherwise deliver deliberately staged text dialogue with convincing nonverbal audio, not silent unfinished cutscenes. Essential information always has subtitles. Streaming AI services are not a game runtime dependency.

## 4. One level, fully specified

Start with approximately **480 × 420 metres** of playable district. Size is a tuning target; keep the six locations and all route choices if dimensions change. Build two connected street loops, three cross-streets, a service lane and a waterfront return route. Provide real sightline breaks, car turnarounds and foot shortcuts. Police must have navigable routes to every advertised chase area.

| Location | Playable content | Spatial requirements |
| --- | --- | --- |
| A. Eli's garage, southwest | Opening, vehicle selection, optional favor, repair, final free-roam base | One complete interior, drive-through bay, safe spawn and two road exits |
| B. Market frontage, west/central | Collection stop, food/armor service, civilian life | Walkable pavement, crossings, parked cars, one open shop frontage; no fake usable doors |
| C. Elevated-road junction, central | Vehicle handling, traffic intersection, pursuit route | Two distinct turns, a usable service lane, pillars that actually obstruct sight |
| D. Dispatch depot, northeast | Observation, two approaches, case recovery and Jun extraction | Yard plus small two-level office; street gate and rear service entrance; 8–10 useful cover positions and a traversable flank |
| E. Waterfront maintenance yard, southeast | Concealment, alternate transport, reporter drop | Connected road and foot exits; sight-blocking containers; no invisible waterfront escape route |
| F. Broker drop, northwest | Alternative ending and a distinct post-mission message | Quiet enclosed loading area connected to the second loop |

Use a 4 m grid for coarse authoring if useful, with metre-based design coordinates converted through one engine adapter. Do not stamp a giant dense collision tile map before measuring its cost. Static facades can be batched; hero spaces receive distinct geometry. Every apparent jump/vault/door on the critical route must be intentionally supported or clearly closed. Water is a visible boundary with railings and an explicit recover/retry rule if the player crosses it; swimming is outside this slice.

### Mission state machine

Every phase has entry actions, guard conditions, event handlers, exit cleanup and a checkpoint policy. Dialogue is interruptible, resumable and replayable from the phone; missed calls cannot block progression. Markers communicate the active task without solving the encounter.

| State | Player experience and transition | Checkpoint/failure behavior |
| --- | --- | --- |
| `INTRO` | Brief in-engine garage scene; accept Eli's call; obtain the sedan and pistol. Let the player move before a minute has passed. | New-run state; skip dialogue retains all objective information. |
| `COLLECTION` | Drive to market in traffic. The collection contact redirects Mara to the depot. Optional: carry a misplaced toolbox back to Eli's bay, a 60–90 second detour that earns one free repair/respray. | Save after accepting the job and after the stop. Favor is optional, visible, completable and persisted once. |
| `APPROACH` | Observe the depot. Enter via the street gate with frontal cover or the service lane with a vault and a close-range guard. The message about Jun is useful on either route. | Checkpoint before committing; no claim of a full stealth system. Taking the quieter route delays detection but does not require ghosting the mission. |
| `RECOVERY` | Reach Jun and take the case during a staged but systemic encounter. Six crew members total: two guards, two rushers and two flank-capable enemies. At most four actively pressure the player together. | Jun takes cover and cannot be killed by stray AI fire; player death retries the encounter. Once recovered, the case is persistent inventory, never a losable physics trinket. |
| `EXTRACTION` | Jun follows to any compatible free passenger seat. Opening the case cabinet trips a visible wired alarm: a remote dispatcher reports the depot location and suspected theft through the normal crime system, starting tier-2 investigation. The report does not identify Mara or a car; pursuit/identification requires a real witness or arriving officer's sighting. A van at the yard is an option; the player's sedan remains valid if intact. | Checkpoint with a viable escape state and the report preserved. Vehicle destruction leaves another usable car/foot route; if Jun cannot reach the player, explicit recovery/retry applies. |
| `EVASION` | Break police sight and leave the last-known search area. Switch vehicles unseen or use the earned garage service when police no longer see the car. | Checkpoint restoration recreates the pursuit rather than erasing it. No handoff while actively wanted. |
| `DECISION` | At a quiet stop Jun explains the stakes. Choose a clearly labeled broker or reporter destination through the shared dialogue/menu interaction; route can be changed before confirming the handoff. | Save the uncommitted choice; leaving the area resumes navigation, not a failure. |
| `HANDOFF` | Deliver the case, confirm the decision, receive payment and see its consequence. Reporter ending adds an investigation notice and hopeful local radio update. Broker ending adds a contractor takeover notice and shutters an already noninteractive market storefront. Both change messages and payment; essential services stay available. | Atomic completed-run flag prevents duplicate payment. Checkpoint after the exchange. |
| `AFTERMATH` | Return to normal district play, spend money at services, read the closing message, view credits or Replay. | Save includes completion and district state. Replay begins a distinct run; New Game resets after an explicit confirmation. |

Death, arrest and an unrecoverable essential actor failure lead to a clear retry screen. The player can retry the last valid checkpoint, restart the mission or return to title. Do not force the opening drive after a late death. An out-of-bounds actor is recovered at an authored valid position; repeated failure becomes an explicit retry, never a silent infinite loop.

## 5. Frozen slice inventory and acceptance contracts

Every row is required. The examples below are observable minimums, not permission to ignore integration defects. All player-facing actions must have matching animation, sound where appropriate, prompts, collision behavior and recovery.

| ID | Complete system | Acceptance evidence |
| --- | --- | --- |
| S01 | Boot, title, New Game, Continue, settings, credits and loading/error handling | A fresh profile reaches play; a saved profile resumes; failed assets produce a recoverable message; no dev/demo selector remains. |
| S02 | Third-person walk, run, sprint, crouch, short vault, interaction and camera | Complete both depot approaches; no foot sliding on ordinary motion, floor penetration, camera-through-wall aim or input lock after an interaction. |
| S03 | Weighty sedan, loaded van and patrol cruiser; enter/exit, passenger seats, steering, analog throttle/brake, handbrake, collisions and damage | Drive each on the same route; differences are evident; damaged cars smoke/lose performance; blocked doors choose a valid side; seated actors do not collide with their own car. |
| S04 | Civilians and traffic: walk/wait/cross, lanes/signals/yield, fear, flee, witness/report and obstruction recovery | A quiet intersection flows; a collision or gunshot changes behavior; a jam resolves without a visible teleport; report can be interrupted by leaving before identification, never by an unavoidable timer unrelated to perception. |
| S05 | Melee strike, aim/block and dodge; two firearms, ammo, reload, switch, aim assist, hit reaction, health/armor and death | Pistol favors precise shots; SMG trades accuracy for close pressure; empty/reload/switch transitions cannot duplicate ammunition; cover and vehicle bodies stop appropriate shots. |
| S06 | Cover enter/leave, left/right peek, low-cover stance and reachable vaults | Corner fire uses both camera and muzzle tests; blocked muzzle cannot shoot through cover; enemies can approach a valid flank without teleporting. |
| S07 | Crew guards, rushers and flankers with perception, navigation, suppression/repositioning and death cleanup | Their choices are readable; they lose sight behind geometry, do not fire through walls, and cannot deadlock the encounter. Different roles use one coherent AI framework. |
| S08 | Crime reporting and three heat tiers; dispatch, chase, last-known search, unseen clearance, arrest/retry | A crime with no observer/report does not magically dispatch police. Renewed sight updates search. Demonstrate escape by routes and by an unseen vehicle change. Heat never clears while directly observed. |
| S09 | Mission state machine, two depot approaches, case, Jun, both endings and free roam | Complete every phase and both handoffs through ordinary play. Destroy/abandon the initial car, miss a call and take the alternate route without soft-locking. |
| S10 | Useful phone, navigation, messages, two contacts, one optional favor and local economy | Eli and the collection contact have actual responses; the favor unlocks a consumed service; purchase food/armor and repair after earning money; no inert phone buttons. |
| S11 | Save/load, settings persistence, checkpoint retry and replay | Reload each stage and ending; no duplicate reward, resurrected completed objective, missing case, invalid passenger or corrupted pursuit. Handle corrupt/unavailable storage visibly. |
| S12 | Original city art, complete characters/vehicles, integrated animation and effects | Inspect five signature views and a motion filmstrip; no grayboxes, missing textures, default fantasy hero, frozen deaths or snapping vehicle transitions. |
| S13 | Complete audio, subtitles, radio and mix settings | Test engine load, indoor/outdoor ambience, gunfire, pursuit and both endings; dialogue remains intelligible; mute/volume settings persist; no unauthorized music. |
| S14 | 10-foot menus/HUD, PS-style glyphs, keyboard/mouse parity, rebind and device recovery | Finish the whole game from title to credits on each required input; disconnect/reconnect controller safely; all dialogs/settings can be operated without a mouse. |
| S15 | Performance, browser/viewport compatibility and shipping artifacts | Pass section 11, build from a fresh checkout, publish the required public repository and produce source information and candid engine feedback. |

### Rules and tuning starting points

Keep these values in data. They are original starting targets to tune in play, not GTA IV measurements.

- Player: 100 health, 100 maximum armor, no automatic combat healing. Food $10 restores health; armor $60 refills armor; repairs $80 restore a vehicle and change its appearance only when out of police sight. Start with $80. The optional favor grants exactly one free repair/respray. No paid ammunition soft-lock: required encounter ammunition is obtainable on-site.
- Pistol: 12-round magazine, initial 48 reserve, slow accurate fire. SMG: 30-round magazine, 90 reserve on pickup, faster fire and wider sustained spread. Ammo/reload animation events have one authoritative owner; use fixed-step cadence. Friendly civilians are not valid aim-assist targets.
- Melee: one readable short combo, a held block, and directional dodge while blocking. No sprawling skill tree. Combat input prioritizes state transitions consistently over animation cosmetics.
- Police tier 1: one patrol investigates an identified offense, gives a surrender opportunity when safe, then chases if the player flees. Tier 2: two patrols and up to four officers coordinate pursuit. Tier 3: up to three patrols, six officers and one plausible roadblock. No helicopters, army or six-tier simulation in this slice. Recovery crew plus police cannot exceed the measured active-combat cap; police can hold perimeter positions.
- Crime data includes kind, location, witness identity, report delay, observed person/vehicle and severity. `Unaware → Reporting → Dispatched → Pursuing → Searching → Cleared` uses real observations. Initial search radii 60/100/140 m and unseen-clear intervals 8/12/16 s must fit the district. Vehicle changes only affect identification when unseen; foot sightings still identify Mara. Lower pressure uses pursuit/arrest, not indiscriminate shooting.
- Jun: follow/regroup/cover/board/seated/exit states. Friendly fire does not damage him; ordinary hostile hits cause a reaction and retreat to cover. A severe vehicle impact, sustained fire hazard or fall outside the level causes explicit mission failure/retry. If his vehicle becomes disabled, evacuate him through a validated exit; if it explodes with no safe evacuation, fail clearly. Surviving completed routes therefore always reach a coherent ending. At a blocked doorway, replan; at a blocked seat, try another seat/car. After 5 s without path progress, use an offscreen, validated regroup point only if neither old nor new position is visible; otherwise offer a visible regroup instruction and explicit retry. Do not make gameplay depend on a fragile escort health bar.
- Vehicle access: Triangle/E at a stationary or very slow civilian car's driver door performs a short interruptible taking animation. The driver exits to a validated position, flees and can report the theft; cancel or a collision returns both actors to valid states. Moving vehicles cannot be boarded. Empty patrol cars are usable; occupied patrol cars stay locked with clear feedback until officers leave. Jun uses a free passenger seat and never displaces the driver. Add theft/report and interrupted-entry cases to S03/S04 tests.
- Traffic uses a lane graph with intersection reservations; police obey physical routes but can break traffic rules. Seeded civilian density varies by block. Initially target 12 moving vehicles, 24 active pedestrians and 10 total active armed NPCs, then profile. Keep mission actors separate from disposable ambient populations.

### Deliberate full-game exclusions

This slice does not implement an entire GTA campaign, multiplayer, multiple boroughs, aircraft/boats, swimming, a full dating/friendship simulation, apartment/property management, extensive customization, a stunt/collectible checklist, an internet café, minigame collections or a six-star police arsenal. Do not show active-looking entry points for these. The one favor, economy, phone, population and complete mission demonstrate the foundation; no required row above can be deferred into this list.

## 6. Controller-first interaction and interface

All devices produce a shared action frame. Keyboard/mouse gets the same interactions, menus and gameplay rules. Mouse look may be direct and controller aim assisted; this does not create a separate desktop UI. Prioritize a standard-mapped PS5-compatible controller; identify unrecognized controllers visibly and allow remapping. Do not promise adaptive triggers, wireless support or vibration without testing the browser/device combination. Optional vibration must degrade gracefully.

| Action/context | Default controller | Keyboard/mouse |
| --- | --- | --- |
| Move / steer | Left stick | WASD / A–D |
| Camera / aim | Right stick | Mouse; click to acquire pointer lock |
| Sprint on foot | Hold Cross | Hold Shift |
| Jump / contextual short vault | Square | Space |
| Crouch toggle | L3 | C |
| Aim / unarmed block | L2 | Right mouse |
| Fire / melee strike | R2 | Left mouse |
| Dodge while unarmed blocking | Circle + move direction | R + move direction |
| Reload when armed | Circle | R |
| Enter/leave cover | R1 | Q |
| Interact / enter or exit car | Triangle | E |
| Weapon wheel | Hold L1; right stick chooses; release commits | Hold Tab; mouse direction chooses; release commits |
| Shoulder swap while aiming | R3 | V |
| Phone / close phone | D-pad Up | T |
| Objective/map | D-pad Down | M |
| Vehicle throttle | R2 analog | W |
| Vehicle brake / reverse near stop | L2 analog | S |
| Handbrake in vehicle | R1 | Space |
| Horn / radio station | L3 / D-pad Right | H / X |
| Look behind in vehicle | Hold R3 | Hold V |
| Pause | Options | Escape |
| Menu focus / confirm / back | D-pad or left stick / Cross / Circle | Arrows or WASD / Enter / Escape; mouse also works |

In cover, hold aim and move along the cover tangent to peek at the available edge; release aim to tuck back, and R1/Q exits. Low-cover aim rises only when headroom permits. The weapon wheel includes an explicit Unarmed slot. During an officer's safe tier-1 surrender prompt, holster and hold Triangle/E for one second to surrender; this contextual action takes priority over nearby doors and leads to the arrest/retry screen. These actions must appear in the relevant control help and prompts.

Context arbitration is explicit: menus consume navigation/confirm before gameplay; vehicle actions replace foot actions; block+dodge applies only unarmed; a stopped car exits normally and a moving car must slow below a safe threshold before an exit proceeds. A held interact cannot repeatedly toggle seats. A phone opened while driving pauses gameplay, preserving safe selection. Driving gunplay is outside the slice; combat occurs on foot.

Poll controllers every frame after browser activation; retain analog trigger values, radial stick dead zones and device identity. Start with a 0.12 dead zone, configurable sensitivity/inversion, toggle/hold aim and sprint options, and optional mild target slowdown. Aim assist never tracks through geometry. Pause on disconnect, focus loss and pointer-lock loss; clear held inputs and require a fresh deliberate resume to prevent stuck fire/throttle. Test hotplug and keyboard fallback.

HUD: lower-left readable local map with route/search region; health/armor nearby; compact weapon/ammo opposite; one current objective near the top; subtitles at bottom center. Show only information useful now. Use shape and text as well as color for heat, damage and objectives. At a 1080p presentation target, body text is approximately 28–32 px, objective headings 36–44 px, safe margins 5%, and subtitle size adjustable. These are visual targets to inspect at couch distance, not a formal accessibility certification. Scale HUD independently from reduced 3D render resolution.

Pause has Resume, Map/Objective, Phone, Restart Checkpoint, Settings, Credits and Quit to Title. Settings cover display/quality, brightness, HUD/subtitle size, motion shake, aim/controls and audio. Phone has only Job, Messages and the two functioning contacts. Lists have large focus states and short descriptions; no dense dashboard, tiny simulated smartphone text or hover-only controls. Destructive New Game/Restart choices require an ordinary controller-accessible confirmation.

Coarse-pointer layouts suppress gameplay HUD and virtual controls; show at most a menu button outside menus. If a controller is connected, switch to the normal controller presentation. A phone-sized viewport is not evidence of touch gameplay support. No time is allocated to implementing mobile input.

## 7. Verified engine foundation

Research snapshot: **my-3d2dge 0.46.1**, commit **`cfa866aa45474868350cad1a7fc015e612f9305f`**, upstream commit timestamp `2026-10-15T18:27:04-07:00`. The package and both engine headers agree. The checkout's build marker is `dev-build`; no generated distribution manifest was present. Read runtime `My3D2dge.version` and `My3D2dge.build`, and retain the commit plus any local patch identity in `ENGINE_VERSION`. Do not misreport a package version as a generated build number.

Use `engine/my-3d2dge.js` **and** `engine/my-3d2dge-3d.js`, with the pinned Three.js r182 and Rapier 0.19.3 vendor directories. The full engine supplies the game loop/input/UI/rig facilities; `E.World3D` supplies actual 3D. The slim agent edition omits useful capabilities and is unsuitable for this foundation. This is a third-person 3D game, not a top-down substitute.

Read the actual [3D module/manual](https://github.com/michaelcrosato/my-3d2dge/blob/cfa866aa45474868350cad1a7fc015e612f9305f/engine/my-3d2dge-3d.js), [API card](https://github.com/michaelcrosato/my-3d2dge/blob/cfa866aa45474868350cad1a7fc015e612f9305f/API.md) and [AI guide](https://github.com/michaelcrosato/my-3d2dge/blob/cfa866aa45474868350cad1a7fc015e612f9305f/AI_GUIDE.md). Also inspect `src/starter3d.template.html` and `src/starter3d/{00-shell,10-action,90-start}.js`. `docs/ENGINE-3D.md` opens with an older v0.34.0 label; do not use that label as the engine version.

### Integration boundaries

| Verified foundation | Required game work |
| --- | --- |
| `E.Game`, boot steps, scenes, `E.Menu`, `E.Dialog`, pause/settings and fixed updates | Themed title/HUD/phone/map, input arbitration, mission/save lifecycle |
| `E.World3D`, WebGPU renderer with WebGL2 fallback, lights, fog, shadows, particles, node materials and post effects | Original urban world, art direction, wet-road/rain treatment, quality settings and profiling |
| Rapier actors, capsules, props, slopes/stairs and moving platforms | Driving, traffic, seat attachment, collision damage and transition rules |
| Chase/fixed/first-person camera modes | Controller orbit yaw/pitch, shoulder aim, dynamic occluder sweep and vehicle camera tuning |
| Flow fields and perception/suspicion helpers | Pedestrian and road graphs, tactical cover, witnesses, dispatch and search rules |
| Shape/material libraries and humanoid/mocap runtime | Finished urban models, vehicle parts, animation graph and special transitions |
| Web Audio synthesis/effect/music facilities | Recorded/produced city audio, vehicle loops, spatial mixing and authored dialogue/radio |

Use engine objects in actual gameplay. A standalone Three.js game with the required engine imported but unused fails the engine requirement. Conversely, compatible extensions through `E.THREE`, `E.TSL`, `E.RAPIER`, `world.scene` and `world.pw` are appropriate.

### High-risk facts to resolve in the first integration milestone

1. **Coordinates:** engine and Rapier use X-east, Y-south, Z-up, **16 units = 1 metre**. Rapier's `lengthUnit` is already 16. Three.js uses metres/Y-up through `E.World3D.toThree`. Put conversions in `src/engine/units.js`; do not independently scale physics again. Verify 1.8 m character, 4.5 m sedan and 3 m lane using visible rulers in a temporary test scene.
2. **Gravity:** engine default 480 units/s² is stylized; a 9.81 m/s² baseline is 156.96 units/s². Tune deliberately and record the chosen value alongside suspension and jump/vault settings.
3. **Physics ownership:** `world.step(dt)` already advances Rapier. In game-owned orchestration, set vehicle forces and call the vehicle controller's `updateVehicle(dt, ...)` immediately before `world.step(dt)`, then synchronize presentation. There is no assumed public pre-step callback. Do not add another `pw.step()`. Upstream steps without a Rapier `EventQueue`; collision damage must use compatible contact queries or a documented engine patch that passes and drains a queue with appropriate collision-event flags. Test a ten-second movement interval at multiple render rates and real impact damage.
4. **Driving:** no engine vehicle wrapper exists. The vendored Rapier exposes `world.pw.createVehicleController(chassis)`, `addWheel`, `updateVehicle`, `setWheelEngineForce`, `setWheelBrake` and `setWheelSteering`. Build a game adapter around that controller. In this pinned package the up-axis property is `indexUpAxis = 2` and the forward-axis setter is unusually named `setIndexForwardAxis = n`; verify declarations/runtime before using them. Wheel forces/suspension must be tuned for engine units. Do not ship a car as a sliding kinematic box.
5. **Inputs:** engine polling discards analog `GamepadButton.value` while retaining `pressed`. Extend/adapt polling for L2/R2 values; preserve new fields in recording/replay. Built-in right-stick ground-plane aim does not supply the required orbit camera.
6. **Queries:** `world.clear()` filters to static level/platforms. Combat, cover, police vision and camera need deliberate collision masks that include relevant props, vehicles and actors. Use a camera ray to choose the aim point and a muzzle ray to determine the actual obstruction/hit.
7. **Seats:** `actor.setSolid(false)` still collides with level/props/platforms. Disable/remove the seated character's collision representation or implement complete masks, then restore it at a validated exit position. Test car motion, passenger swaps and checkpoint reconstruction.
8. **Camera:** default chase collision samples `world.topH()`. Add a shape sweep and near-plane clearance for buildings, moving vehicles and narrow interiors; damp recovery to avoid camera snapping.
9. **Renderer:** preserve the engine's `WebGPURenderer`/node-material path. Do not accidentally introduce `WebGLRenderer`, `ShaderMaterial`, `onBeforeCompile`, `EffectComposer` or addons from another Three version. Prepare shader variants during boot with `world.prepare()`.
10. **Replay:** `world.hash()` does not cover all game state. Add mission/decision, RNG, health/inventory, car transforms/velocities, witness/heat state and input extensions to a game-level state digest. Do not promise bit-identical physics across browsers; use tolerance-based cross-browser assertions and semantic mission-state checks.

Keep the full engine, 3D module and vendor dependencies version-coherent. Prefer adapters; record necessary engine patches under `docs/ENGINE-PATCHES.md` with reason, diff and tests. Upgrade only deliberately after regression verification. The research clone at `/tmp/gta4-engine-research` is disposable and must not become a build dependency.

## 8. Asset and animation production

Read upstream [asset import/provenance](https://github.com/michaelcrosato/my-3d2dge/blob/cfa866aa45474868350cad1a7fc015e612f9305f/docs/ASSET-IMPORT.md) and [mocap workflow](https://github.com/michaelcrosato/my-3d2dge/blob/cfa866aa45474868350cad1a7fc015e612f9305f/docs/MOCAP.md). Use `tools/asset-find.mjs`, `asset-set.mjs` and `asset-sheet.mjs` to select and inspect assets; use `tools/anim-set.mjs` to cut only the required clips. Read each tool's help before choosing arguments.

Verified reusable native 3D shapes include `lamppost`, `bench`, `crate`, `barrel`, `kenney-survival:barrel`, `kenney-furniture:desk-corner`, `chair-desk`, `laptop`, `radio`, `television-modern`, and `kaykit-restaurant-bits:chair-a`, `food-burger`, `fridge-a`. Preserve full namespace prefixes when constructing IDs; e.g. `kenney-furniture:laptop`. These can furnish the garage, office and shop when restyled consistently. `world.shape()` uses `E.shapeMesh`/`E.materialTile`; shape collision defaults may be too coarse for cover or furniture and must be replaced where play requires it.

`ambientcg:bricks104`, `bricks094`, `concrete048`, `pavingstones142` and `woodfloor043` refer to procedural material approximations in the library, not full downloaded PBR texture sets. Tiny Battle cars/trucks/helicopters are 2D sprites and do not satisfy the three drivable 3D vehicle requirements. Author the roads, building modules, signs, vehicles and key character details using the engine shape system or compatible meshes. A consistent authored low-poly finish is preferable to unfinished attempts at photorealism; the art gate still requires finished silhouettes, materials and animation.

Required asset ledger:

| Group | Minimum finished content |
| --- | --- |
| Characters | Mara, Eli, Jun, collection contact Bea Moss; crew variants, police variants, six civilian outfits on a consistent rig |
| Vehicles | Sedan, utility van, patrol cruiser; wheels/suspension, steering, doors, lights, seats, glass, damage and audio attachments |
| District | Roads/curbs/crossings, brick/metal facades, garage, market, depot yard/office/stairs, overpass, waterfront boundary, two distinct drops |
| Props | Cover crates/barriers, fences/gates, bins, street lights, benches, signs, parked vehicles, office and service furnishings |
| Effects/UI | Rain/spray, impact/muzzle/brake/smoke effects, readable map symbols, PS-style glyphs, title/credits and original signage |
| Audio | Surface footsteps, vehicle layers, combat/interaction, environment, music/radio and complete dialogue/subtitle content |

The mocap catalog contains useful `Idle_Loop`, `Walk_Loop`, `Jog_Fwd_Loop`, `Sprint_Loop`, crouch clips, jump/land clips, pistol aim/shoot/reload, punch/hit/death/get-up, `Interact`, `PickUp_Table`, sitting/`Driving_Loop`, talking/phone and `ClimbUp_1m_RM`. Explicitly copy/load upstream `src/mocap/readable.js`, then `src/mocap/mocap.js`, and the selected animation set scripts in their documented order: this runtime is not automatically bundled into the full engine. Reuse selectively via `Mocap.load`, `lib.sample`/`blend`, `Mocap.drive` and an upper-body mask where suitable. Build a real animation state graph: lower-body locomotion, upper-body weapon/phone layer, and exclusive vault/seat/death actions. Physics owns movement; reconcile any root motion explicitly. Blend foot plants and turns, align hands to the gun/steering wheel, and align characters to seats.

Author missing cover entry/peeks, door reach, vehicle entry/exit, SMG pose, Jun regroup and case handoff. Entry/exit must match door/seat positions, not teleport between idle and driving. Use authored death/hit motions with collision-aware settling; full ragdoll simulation is not required. Inspect motion in sequence, not just a still frame. Animation events drive visible attachment changes, while gameplay state remains authoritative and interruption-safe.

Keep `assets/manifest.json` with source URL, author, license, original asset/clip ID, modifications, local path and hash. Preserve selected engine sets' `sources`, `src`, `orig` and `fit`. Verified upstream licenses include engine/Three MIT, Rapier Apache-2.0, selected Kenney/KayKit/ambientCG imports and selected Quaternius/Mesh2Motion clips CC0. Check every actual selected pack; do not extend one pack's license to an entire author's catalog. Preserve notices in `THIRD-PARTY-NOTICES.md`. This is an asset shipping requirement, not a request for extra permission to use already licensed material.

## 9. Software architecture and reproducible build

Use browser-native ES modules with JSDoc/type checking, the engine's own loop, a small Node development server/static packaging script, and a locked development toolchain. A frontend framework or backend is unnecessary for this single-player game. Keep runtime resources local and same-origin so a fresh checkout can run without asset CDNs, API credentials or a network service. Test the packaged output, including nested base-path imports; do not rely on the source-tree dev server to hide missing files.

```text
design.md                       canonical specification (the brief's DESIGN.md)
README.md                       run/build/play instructions and source information
ENGINE_VERSION                  upstream version, build marker, commit, patch identity
ENGINE-FEEDBACK.md               evidence-based first-build evaluation
THIRD-PARTY-NOTICES.md
package.json / package-lock.json
index.html                      two canvases, import map, accessible menu/credits entry
vendor/my-3d2dge/                pinned engine, vendor dependencies, notices, needed runtime
src/
  main.js                       boot and scene lifecycle
  engine/{units,world,queries,input,vehicles,camera}.js
  game/{actions,state,events,rng,save}.js
  world/{district,roads,traffic,pedestrians,interactions}.js
  actors/{player,crew,police,companion,animation}.js
  systems/{combat,cover,crime,wanted,economy,audio}.js
  mission/{definition,director,checkpoints,dialogue}.js
  ui/{title,hud,phone,map,pause,settings,credits}.js
assets/{manifest.json,world,characters,vehicles,animation,audio,ui}/
tests/{unit,integration,e2e}/
tools/{serve,build,audit-assets}.mjs
docs/{PROGRESS,ENGINE-PATCHES,TEST-REPORT,DECISIONS}.md
```

Paths are intended module ownership, not an instruction to generate empty scaffolding. Implement files only when their behavior is needed. Keep unmodified upstream material separate from game code. Do not introduce both `design.md` and `DESIGN.md` on a Windows-linked workspace: uppercase references in the brief refer to this canonical lowercase file.

### Contracts that must precede parallel implementation

- `ActionFrame`: tick, device, moveX/Y, lookX/Y, throttle, brake, held/pressed/released action sets. Wrap/extend the engine's existing input polling through a single adapter; do not add a competing poller. Engine menus and gameplay consume the same normalized state, with UI consumption first. Record normalized frames for replay.
- `GameState`: schema version, run ID, fixed tick, seeded RNG state, mission phase/objective flags, ending/favor/reward flags, player/inventory/wallet, persistent vehicle/actor identifiers, and crime/search state. Runtime render/physics objects are not serialized directly.
- Stable entity IDs survive reload. `VehicleSystem.enter/exit`, `CombatSystem.resolveHit` and `MissionDirector.handle(event)` return explicit success/failure outcomes; do not advance objectives from animation timers or a UI label.
- Event records contain type, tick, source ID, target ID and typed payload. Representative events: `InteractionCompleted`, `CaseRecovered`, `ActorDown`, `CrimeObserved`, `ReportCompleted`, `VehicleEntered`, `WantedCleared`, `HandoffCommitted`. Deduplicate events by stable ID when restoring/replaying.
- Mission definitions contain predicates and actions referencing IDs, not scattered proximity checks. Rewards, pickups and handoffs are idempotent per run. A script opening a gate must update geometry, navigation and save state together.

Simulation order per fixed step: consume actions → player/AI intentions → vehicle controller forces → `world.step(dt)` once → contacts/weapon resolution → perception/crime/mission events → state transitions/checkpoint requests → presentation synchronization. Confirm engine actor hooks before finalizing the integration; keep gameplay cooldowns and timers on simulation time. `game.advance(seconds)` uses 1/120-second steps and can drive deterministic test scenes. Do not run a second independent animation/physics loop.

Mission actors and persistent vehicles always have full state. Ambient cars/pedestrians can be pooled and updated less frequently at distance; never despawn something the player is watching. Use spatial queries and road/foot graphs, avoid all-pairs perception. Prewarm shaders/audio; pool impacts/rain; unload optional far-zone detail without changing gameplay collision underneath the player.

Save schema starts at version 1. Store small logical snapshots in local storage with a previous-good backup, version validation and explicit error handling. Save only at stable checkpoint boundaries; queue requests until seat changes and mission commits finish. Restore world definition → persistent entities → transforms/velocities/health → attachments → mission/AI/wanted → UI. Test actual browser reload, not only an in-memory reset. Settings persist separately. Replay uses a new run ID and defined starting inventory; free-roam retains the completed run's reward exactly once. Never erase a corrupt save silently; offer the backup or New Game.

The build script must copy all referenced module, shader, texture, audio and physics resources with correct relative paths. Preserve the starter's stacked 3D/HUD canvases and import-map arrangement, but remove sample games, debug API buttons and retro display defaults that conflict with the art/UI targets. Choose supported high-resolution settings after inspecting the engine; extend HUD scaling if needed. Serve over HTTP, not `file://`.

## 10. Ordered implementation milestones

These gates describe future work. None is checked by the existence of this plan. Each gate ends with an integrated playable build, updated progress/evidence and a focused commit. Overlap independent production only after interfaces settle; the parent integrates in dependency order.

| Gate | Work and dependencies | Exit evidence |
| --- | --- | --- |
| M0 — foundation and risks | Pin engine; inspect current instructions; initialize Git; install/lock needed tools; establish module contracts and engine provenance. Prove a controller-driven character, analog-driven car, shared physics loop, collision camera, selected animation and WebGL2 fallback in a temporary calibration scene. | Units/physics/input tests pass; one car drives and one character enters/exits correctly; controller menu navigation works; engine/vendored imports load in Chromium and WebKit. Record actual model/effort, renderer and hardware. |
| M1 — district and traversal | Build six locations, roads, foot routes, collision, base materials, sedan/van/cruiser, entrances and garage services. Depend on M0 units/camera/vehicle contracts. | Drive all loops and walk both depot approaches; no blocked critical route or broken car transition. Inspect layout/camera views at representative aspect ratios. Temporary grayboxes are still allowed here. |
| M2 — living streets and crime | Implement lane/signals/traffic recovery, pedestrians/witnesses, three police tiers, pursuit/search/arrest and favor/service hooks. Depend on M1 navigable graph. | Reproducible witnessed/unwitnessed crimes; police lose and regain sight correctly; each escape method works; collisions do not permanently jam streets. |
| M3 — physical confrontation | Finish player weapons/melee/cover and crew AI; add full animation transitions, effects and damage feedback. Depend on M1 collision and M0 query contracts. | Both depot approaches are playable with different tactics; hit/muzzle/cover tests pass; six enemies complete without stalls; death/retry works. |
| M4 — complete mission | Implement all mission phases, Jun, case, phone/dialogue, optional favor, choice, both endings, economy, free roam, checkpoints and persistence. Integrate M2/M3. | Two complete playthroughs with distinct outcomes; recovery cases pass; money/favor/case survive reload correctly. This is the first content-complete build, not the release. |
| M5 — finished presentation | Replace every temporary asset; finalize characters/vehicles/interiors, animation, rain/lighting, audio/radio, 10-foot HUD/menus and settings. Prepare shaders/assets. | Five reviewed signature frames, motion filmstrip, recorded encounter/drive, readable couch-distance UI, coherent mix, no placeholders or dead controls. |
| M6 — adversarial QA and optimization | Run the full section 11 matrix, fix defects, profile the busiest encounter/pursuit, tune driving/aim/camera and fresh-player pacing. | Controller and keyboard/mouse end-to-end evidence; both endings; failure/reload matrix; cross-browser screenshots/reports; measured performance on named hardware. All S01–S15 evidenced. |
| M7 — reproducible delivery | Clean checkout/build test, final notices/source info, engine evaluation, repository publication and final report. Independent reviewer checks requirement-by-requirement coverage. | Public GitHub repository resolves; remote commit equals verified local commit; packaged game runs from fresh checkout; all required documents exist and agree. |

If a gate fails, diagnose and continue the necessary work. Do not broaden testing repeatedly after a passing gate without a change or unresolved concern. Record genuine environmental limits accurately; inability to exercise a hardware path is an unverified requirement, not a passing result. Sol/Ultra unavailability is a launch blocker to report while preserving the requested target.

## 11. Verification and quality gates

### Project commands to implement

Create these scripts as part of M0–M4. They are the future project's command contract, not commands that already work in this planning-only directory:

```bash
npm ci
npm run dev -- --host 127.0.0.1 --port 5173
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:e2e
npm run audit:assets
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

Keep unit tests focused on real invariants: mission transition guards and idempotence, ammo/reload accounting, crime visibility/reporting, search clearance, seat ownership, input-edge clearing and save migration/backup behavior. Integration tests exercise actual engine stepping, collision/query masks, vehicle units, entering/exiting, obstruction and checkpoint reconstruction. Use the upstream relevant tests when patching the engine; do not blindly claim its whole suite validates this game.

E2E tests use the normal boot, menus and gameplay actions. Developer test hooks may expose seeded setup, normalized input and semantic state for diagnostics; they must not directly complete objectives, kill enemies or set the ending during the end-to-end acceptance run. Test raw gamepad polling separately with a controlled `navigator.getGamepads()` fixture so analog/rebinding bugs are not hidden by an action-frame shortcut. Keep such hooks out of the release interface. Record test version/seed and inspect footage/screenshots as well as assertions.

### Required playthroughs and edge cases

| Test | Procedure and required result |
| --- | --- |
| V01 controller | From cold title, use a physical PS5-compatible controller through settings, complete the mission, handoff and credits. No keyboard/mouse rescue. Verify analog driving/aim, wheel/menu focus, unplug/reconnect and pause/resume. Record actual controller/browser/connection. Synthetic input is supplemental evidence. |
| V02 keyboard/mouse | From a fresh run, finish the other ending entirely on keyboard/mouse. Test pointer-lock exit/re-entry, menu navigation, remapping, alt-tab and focus loss. |
| V03 route and choices | Exercise both depot entries, sedan and van extraction, favor earned/not earned, both ending payments/messages and a post-mission purchase. Validate differences through saved state and visible behavior. |
| V04 failure recovery | Die in each combat stage; surrender/be arrested; abandon/destroy/overturn the starting car; block a door; miss/interrupt a call; lose Jun's path; leave and return to the mission area. Each case resolves to continued play or a clear checkpoint retry. |
| V05 police truth | Commit a hidden crime, a reported crime and a crime in direct police view; break sight, change car unseen, change car while seen, re-enter search, use garage while seen/unseen. Police information and clearance must match observations. |
| V06 persistence | Reload at each stable checkpoint, immediately before/after handoff, after favor consumption and after purchase. Corrupt a save and simulate storage failure. No double reward/ammo/case, wrong ending or silent data loss. |
| V07 collision/animation | Drive through turns/ramps and soft props; collide at varied speed; aim at a wall from a clear camera position; stand beside moving cars; vault/cover/enter/exit near obstructions. No through-wall shots, actor tunneling or permanent locked animation. |
| V08 endurance | Play/free-roam for 30 minutes with repeated pursuit, retry and vehicle switches. Entity/audio counts stabilize; no growing event listeners, detached actors, accumulating bodies or sustained memory growth. |
| V09 browsers/layout | Chromium, Firefox and WebKit on desktop; 16:9, 16:10, 4:3 and ultrawide; small phone/tablet layouts for compatibility only. Check render fallback, safe margins, focus, menu usability and no horizontal overflow. |
| V10 shipping | Fresh checkout, `npm ci`, tests, build and static preview; no dependency on `/tmp`, personal absolute paths, source-only assets, undeclared globals or live CDN resources. Source information visible in credits/About. |

The user-provided machine toolkit is installed; `viewport-matrix`, `playwright` and `lighthouse` were found on PATH during planning. The referenced `/home/micha/dev/TESTING-TOOLKIT.md` was absent, so use the supplied instructions and each installed tool's help. Preserve `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64`. Do not run `playwright install-deps` on Ubuntu 26.04. Lock the chosen test runner version for reproducibility; check compatibility with the installed browsers.

During implementation, run a viewport matrix against the actual playable build and inspect the PNGs, including active gameplay, pause, phone, decision and retry screens:

```bash
viewport-matrix http://127.0.0.1:5173 --all-engines -o /tmp/exit-wounds-avenue-93-viewports
lighthouse http://127.0.0.1:4173 --preset=desktop --output=json --output-path=/tmp/exit-wounds-avenue-93-lighthouse.json
```

Use Playwright to enter the needed states before capturing additional screenshots. A title-screen matrix alone does not verify the game. Archive compact reports/evidence references in `docs/TEST-REPORT.md`; large captures stay outside the repository. WebKit with iPhone profiles is an approximation and must not be called real iOS Safari testing. Lighthouse helps assess the HTML shell; it is not a gameplay FPS, visual-quality or controller certification. No public tunnel is needed; run `phone-preview` only if the user later asks.

### Performance and presentation targets

Record CPU/GPU, browser version, renderer, resolution, quality and whether WSL used hardware or software rendering. On a named hardware-accelerated desktop baseline, target a 60 FPS average at 1080p presentation, p95 frame time ≤22 ms and p99 ≤50 ms during the busiest repeatable pursuit after boot warmup. A lower quality mode targets 30 FPS, p95 ≤40 ms, preserving all gameplay. Report software-renderer results separately; they do not establish hardware performance.

Measure performance on the depot fight, central intersection and tier-3 escape, not an empty scene. Target no repeated >100 ms stalls after warmup, initial interactive title within 10 s on a local cold load, ≤50 MiB compressed initial transfer and ≤100 MiB total shipped runtime assets. These are initial product budgets; optimize before changing them, and record measured reasons for material changes. Watch renderer statistics, shader compiles, active entities, event listeners and memory trend. Reduce decorative density, shadow cost and render scale before removing behavior or lowering HUD legibility.

Art acceptance requires direct inspection of the five signature views, readable silhouettes under rain/night lighting, no visible world holes or z-fighting, believable road scale, consistent character/vehicle style, smooth transitions and legible focus/subtitles at couch distance. Motion acceptance requires play/video, not stills. Sound acceptance requires listening with both headphones and speakers, with every volume setting exercised.

## 12. GitHub delivery, engine feedback and completion audit

### Repository

The workspace was empty and was not a Git repository when inspected. During implementation, initialize it with `main`, preserve this plan, add suitable ignores and make milestone commits. Do not overwrite a repository that appears between planning and execution. Confirm the authenticated account can create under `michaelcrosato`; use existing credentials without printing them. A planning-time unauthenticated remote lookup returned “Repository not found”; this does not reserve or guarantee the name.

Before publishing, check the exact destination with authenticated GitHub tooling. An authorization/network error is not proof a name is available. If the exact name belongs to this project, use it; if a different project occupies it, redraw only the two-character suffix from A–Z/0–9, check again and update title/metadata consistently. Do not delete or overwrite an existing remote. Once a reviewable initial build exists, the brief already authorizes public creation and push:

```bash
git init -b main
# Add the intended project files and create a meaningful commit after inspection.
gh repo create michaelcrosato/Exit-Wounds-Avenue-93 --public --source=. --remote=origin --push
```

The create command assumes a local commit and no conflicting `origin`; inspect state and adapt if either already exists. Git identity must come from an existing/user-supplied identity. At final delivery, verify `gh repo view ... --json nameWithOwner,visibility,url`, remote HEAD and a fresh checkout. No force push is required. Public GitHub is required; a hosted web deployment is not specified. Report a playable local command and the repository URL; do not invent a hosted demo URL.

### ENGINE-FEEDBACK.md — write from the actual first build

Place it at the game repository root, next to the source tree. Keep it concise, candid and engine-focused. Do not pre-fill conclusions from research as if encountered during development. Include:

1. Engine version/build, pinned commit and patch identity, cross-checked against `ENGINE_VERSION` and runtime metadata.
2. Engine systems actually used; significant systems not used and why.
3. Wrong, missing or misleading guide/API sections, identified by file/heading and the observed behavior. The stale 3D manual version label and identified input/query limitations are investigation leads; confirm their effect in this build.
4. Every workaround, with the actual game file/function and brief reason. Check `src/engine/` and `docs/ENGINE-PATCHES.md` so none are omitted.
5. The single engine change that would have helped most, grounded in the implemented experience.

Skip praise, padding and game-design criticism. The maintainer should be able to verify each point against the repository. Keep source/environment/model information separate from this evaluation.

### Required source-information block

Put the same factual block in the finished game's README, HTML credits/About and final chat delivery. Use a concise controller-readable presentation in the game; it need not occupy the gameplay HUD.

```text
Initial date: 2026-10-16 (first prompt known in this thread)
SOURCE: Grand Theft Auto IV — Xbox 360, PlayStation 3 and PC
GAME ENGINE: my-3d2dge [actual version], build [actual marker], commit [actual hash]
Environment: [actual implementation environment and tested browsers]
Model and effort: [confirmed implementation model and reasoning effort only]
```

Planning evidence: local Codex CLI 0.163.0, Ubuntu 26.04.1 LTS under WSL2, Bash, working directory `/home/micha/dev/gta4-gpt6a`. Research used web retrieval; no gameplay browser session occurred during planning. The target implementation model is GPT-6.1-Sol/Ultra; the exact serving model and effort of this planning session were not exposed as verified runtime metadata. Do not label a requested future setting as an observed execution fact.

README must also explain install/run/build/test commands, controller and keyboard controls, browser requirements, save/replay behavior, selected quality baseline, asset notices and known actual limitations. No unfinished feature can be hidden only in a known-limitations section while its slice row is marked complete.

### Final build completion gate

- [ ] Every S01–S15 contract is implemented, polished and linked to concrete evidence in `docs/TEST-REPORT.md`.
- [ ] The level completes from title to ending/credits using a controller, and using keyboard/mouse. Touch is explicitly excluded by the user's later decision.
- [ ] Both endings, both approaches, optional favor, economy, full replay and failure/save cases pass.
- [ ] All advertised interactions work; no placeholders, inert contacts, debug UI, unhandled asset errors or blocking defects remain.
- [ ] Desktop/browser and small-screen compatibility checks have actual results and inspected images; real-device limitations are stated accurately.
- [ ] Performance and audiovisual targets have measured/observed evidence, including busiest scenes and a fresh-player pacing run.
- [ ] Fresh checkout builds/runs; source notices, README, `ENGINE_VERSION`, `ENGINE-FEEDBACK.md` and metadata are present and consistent.
- [ ] The requested repository is public, contains the verified commit, and can be retrieved.
- [ ] An independent completeness review checks this whole plan against current code/runtime/evidence. Correct defects before claiming completion.

Final implementation message: link the repository, give the run/play command, summarize what was verified and any genuine remaining limitation, then include the source-information block separately. Do not claim unperformed hardware tests. A planning handoff can be complete while these future build checkboxes remain open; keep that distinction explicit.

## 13. Recorded random title selection

Generated 50 candidates, then selected with Python `secrets.randbelow(50)` and two independent `secrets.choice('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')` draws. The observed selection was candidate **15**, suffix **93**. Display name: **Exit Wounds Avenue-93**; filesystem/GitHub-safe slug: **Exit-Wounds-Avenue-93**. Square brackets in the brief denote the naming pattern and are not part of the slug. A two-character ID reduces collisions; the authenticated repository check in section 12 establishes availability.

1. Ash Borough
2. Blackwater Ledger
3. Brake Lights
4. Broken Avenue
5. Burnside Debt
6. Cinder District
7. City of Liens
8. Cold Harbor
9. Concrete Mercy
10. Corner Office Crime
11. Crossbridge
12. Dead End Dividend
13. Dockside Reckoning
14. Eastline
15. Exit Wounds Avenue
16. Ferry Street
17. Five Borough Debts
18. Foundry Nights
19. Glass Harbor
20. Greyline
21. Harbor Debt
22. Hard Corner
23. Hollow Crown City
24. Iron Borough
25. Last Exit East
26. Low Tide City
27. Mercy on Credit
28. Midnight Transfer
29. North Quay
30. Overpass Saints
31. Paper Kings
32. Passenger Debt
33. Pier Nine
34. Raincheck City
35. Red Signal
36. Rivet City Nights
37. Second Shift
38. Signal Lost
39. Smoke over Mercer
40. Southbound Debt
41. Streetlight Oath
42. The Long Block
43. Third Rail City
44. Toll District
45. Underbridge
46. Union of Thieves
47. Unpaid Favors
48. Waterline
49. Westbound Fortune
50. Wrong Side of Dawn
