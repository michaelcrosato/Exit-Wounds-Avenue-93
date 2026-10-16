# Decisions

The decisions log the doctrine asks for (`DOCTRINE.md`, "Deviations and escalation"): every deviation from a principle
in the engine tier, every call made without a human's answer, every exception granted, and what was grandfathered when
the doctrine was adopted. One entry per decision, newest last, numbered `D1`, `D2`, ...

**The log is never cleaned up.** Unlike finished plans, entries stay when they are done: an entry that no longer holds
is marked **Superseded by D<n>** and kept. `node tools/doctrine-check.mjs` fails when an entry on `main` is gone.

An entry:

```
## D<n> · YYYY-MM-DD · <the call, in a few words>
- **Principle:** which one (or "process")
- **Call:** what was decided
- **Why:** the reasoning, and what would change it
- **Answered:** yes (who asked or approved) | no: made without a response, to review
- **Landed in:** the version (v0.15.0) and, once merged, the pull request
```

## D1 · 2026-10-10 · Adopt the doctrine

- **Principle:** all
- **Call:** `DOCTRINE.md` is this repository's doctrine: the draft "Agent-First Game Engine: Doctrine" as rewritten in
  discussion with the owner. Changes from the draft: two tiers (the engine and prototypes); a ground station and a
  measured North Star; replay in place of capture and restore; prototypes may reach past the API; "the version agents
  write correctly" in place of the 12-month rule; escalation by blast radius; a token budget for the manual; a check for
  each principle. What existing code keeps as it is: D3 to D7. The checks: `tools/doctrine-check.mjs` and
  `tools/determinism-test.mjs`.
- **Why:** the owner's context: rapid prototyping, about 1 idea in 100 reaches production, and production pays for its
  own hardening. Deep in the development cycle, so existing code is grandfathered rather than rewritten; new code follows
  the doctrine.
- **Answered:** yes, the owner asked for the adoption and left the grandfathering to the agent's judgment.
- **Landed in:** v0.15.0

## D2 · 2026-10-10 · Prototypes are the Temporary labs

- **Principle:** process (the two tiers)
- **Call:** in this repository a prototype is a Temporary lab: an entry in the Temporary section of `src/labs.json`, with
  the date and the question it answers, and the sources only its page inlines. A change confined to prototypes merges
  without a version bump or a changelog line; its documentation is its `labs.json` entry and its file headers. It may
  reach past the engine's API and deviate from any principle except binary assets (4). It graduates by leaving
  Temporary, and from then on it is held to the engine tier: version, changelog, docs, and no engine-private members
  (the boundary check fails on them once the lab is no longer Temporary).
- **Why:** the Temporary section already worked this way in spirit (one-off questions, deleted once settled); this
  names it and drops the ceremony that was paid on pages that are mostly deleted.
- **Answered:** yes, part of D1.
- **Landed in:** v0.15.0

## D3 · 2026-10-10 · The engine keeps drawing with Canvas 2D (principle 6 grandfathered)

- **Principle:** 6 (WebGPU only, gameplay on the CPU)
- **Call:** the engine draws with Canvas 2D; WebGPU drives only its optional lighting, which falls back to the canvas
  path by itself. Gameplay never reads the GPU (holds). New GPU code in the engine is WebGPU, never WebGL. The two 3D
  labs, prototypes leaving for their own repository, keep three.js's WebGL 2 fallback as their cross-check.
- **Why:** Canvas 2D is how the engine keeps its promises: crisp pixel art drawn by code, one HTML file that works from a
  double-click and on every device, and a renderer that every model already knows. Moving to WebGPU would rewrite the
  renderer and every game's look for no gain in what the engine is for.
- **Answered:** yes, part of D1.
- **Landed in:** v0.15.0

## D4 · 2026-10-10 · Determinism comes from the harness (principle 5 grandfathered)

- **Principle:** 5 (deterministic by construction)
- **Call:** the engine's loop keeps splitting each display frame into equal substeps (the step size follows the frame
  rate), and Emberdeep keeps drawing gameplay randomness from `Math.random` and an unseeded stream. Runs are made
  repeatable from outside instead: `tools/filmstrip.mjs --seed` installs a virtual clock (every frame exactly 1/60 s),
  a seeded `Math.random`, no sound, no controller and no GPU, and the same steps then give the same pixels.
  `tools/determinism-test.mjs` checks that this keeps holding. New code keeps it working: gameplay takes time only from
  `dt` and the game's clocks, and randomness only from `Math.random` or the engine's seeded streams (`E.rng`).
- **Why:** an exact fixed step needs render interpolation and touches every game; seeding Emberdeep means auditing
  hundreds of random draws that mix gameplay with looks. The harness already gives agents what determinism is for
  (reproducible bugs, before-and-after pictures). Revisit when a feature needs replay inside the game itself, or a bug
  will not reproduce under the harness.
- **Answered:** yes, part of D1.
- **Landed in:** v0.15.0
- **Revised by D12** (v0.16.0): the plan for replaying recorded sessions, and sound on its own random stream.
- **Superseded in part by D16** (v0.17.5): the clock is an exact fixed step. Emberdeep's `Math.random` stays as it is.

## D5 · 2026-10-10 · One-file pages and shared-scope sources stay (principle 7 grandfathered)

- **Principle:** 7 (common ground)
- **Call:** the sources joined in name order into one shared scope (`src/emberdeep/`, `src/starter/`), the build's
  `@inline` directives and the dense code style stay. Tools keep using standard ES modules.
- **Why:** every page ships as one self-contained HTML file that a model can be handed whole or a person can
  double-click; standard modules would need a server or a bundler. Emberdeep's 24,000 lines are written for this scope,
  and its contract (`src/emberdeep/DESIGN.md`) is built on it.
- **Answered:** yes, part of D1.
- **Landed in:** v0.15.0

## D6 · 2026-10-10 · Engine-private members already used outside the engine are grandfathered

- **Principle:** 8 (quality under the hood)
- **Call:** the uses outside `engine/` of engine-private members (names starting with `_`) that existed at adoption are
  listed by area in `GRANDFATHERED` in `tools/doctrine-check.mjs`; a new one in the engine tier fails the check. The
  list only shrinks. First on the engine's to-do list: `rig._w` (a joint's world offset), which the starter games use,
  so every model that copies them learns a private name; promote it to a public name the next time the engine's rig
  API changes.
- **Why:** promoting each name now is an engine change across the full engine, the agent edition and the API card, for
  code that works. The ratchet stops it growing, and the to-do list says which names are wanted.
- **Answered:** yes, part of D1.
- **Landed in:** v0.15.0
- **Progress:** v0.16.0 made `rig._w` public as `rig.worldOffset(p)` in both editions; the starters and the arena use
  it, and their entries left `GRANDFATHERED`. A new use of `_w` is told to use the public name.

## D7 · 2026-10-10 · Approved binaries and imported data

- **Principle:** 4 (agent-accessible assets)
- **Call:** approved: fonts (none are used: the engine's fonts are drawn by code) and the pictures our own tools draw for
  the docs (`docs/assets/`, written by `tools/ed-codex-showcase.mjs`). The motion-capture pipeline is approved as it is:
  binary sources (FBX, GLB, ASF/AMC) are converted into readable key poses with their provenance recorded, and the
  binaries are never committed.
- **Why:** the pictures are output made from code, like `examples/`; the mocap store is text an agent reads and edits.
- **Answered:** yes, part of D1.
- **Landed in:** v0.15.0

## D8 · 2026-10-10 · The manuals' token budgets

- **Principle:** 1 (agent-readable)
- **Call:** the agent edition's header (the manual for coding agents) fits 10,000 cl100k tokens; the API card
  (`API.md`, embedded in every single-file edition) fits 13,500. Measured at adoption: 8,952 and 12,217.
- **Why:** about 10% of headroom over today. A manual that grows past its budget is cut, or the budget is raised with a
  new entry here saying why.
- **Answered:** yes, part of D1.
- **Landed in:** v0.15.0

## D9 · 2026-10-10 · The 3D labs' pinned versions meet principle 9

- **Principle:** 9 (pin what agents know)
- **Call:** three.js r182 and Rapier 0.19.3 stay pinned and vendored with checksums. They were chosen for what models
  know well (`docs/LAB-3D.md`, "Why these versions"), and the labs' tests ban the WebGL-era three.js APIs agents reach
  for. The draft's 12-month rule was not adopted; under it neither would qualify yet.
- **Why:** the choice already follows the adopted principle.
- **Answered:** yes, part of D1.
- **Landed in:** v0.15.0

## D10 · 2026-10-10 · The owner reviewed D3 to D6 and kept them

- **Principle:** process (deviations)
- **Call:** Canvas 2D (D3), determinism from the harness (D4, revised by D12), one-file pages and shared-scope sources
  (D5) and the grandfathered private-member uses (D6) stay. A deviation with a case for it is welcome: the doctrine's
  "How to read this" and `CLAUDE.md` now say so.
- **Why:** the owner's words: variation is the key to discovery, so some deviation must happen where there is a case for
  it; this engine is uniquely different from the four front-runners, and that counts for something.
- **Answered:** yes, the owner.
- **Landed in:** v0.16.0

## D11 · 2026-10-10 · The 15-minute wait is a wake-up timer

- **Principle:** process (escalation)
- **Call:** an agent that escalates arms a 15-minute wake-up and keeps working; with nothing left it ends its turn. In a
  cloud session the timer is `send_later` (claude-code-remote) with `delay_minutes: 15`, which delivers a message back
  into the same session after the turn has ended; `delete_trigger` cancels it when the answer comes first. When it fires
  with no answer, the agent makes the call in its own commit and logs it here.
- **Why:** corrects the agent's earlier claim that a cloud session can't wait 15 minutes and resume: it can, by timer.
  The owner asked.
- **Answered:** yes, the owner.
- **Landed in:** v0.16.0
- **Narrowed by D13** (v0.16.1): the timer is for calls that are hard to undo; reversible calls are made at once.

## D12 · 2026-10-10 · Replay recorded sessions, when a bug needs it; sound on its own random stream now

- **Principle:** 5 (deterministic by construction)
- **Call:** D4 argued that determinism needs an exact fixed step. Replaying a session doesn't: the engine's loop is
  already a pure function of each frame's elapsed time, so the same frame times, the same inputs at the same frames and
  the same random seed give the same game. Two parts:
  - **Now (v0.16.0):** the chip synth draws its own random numbers (`ChipAudio.rnd`) in both editions. It used to draw
    from `Math.random`: 44,100 numbers for its noise when sound first started (none where there is no Web Audio, as
    under the harness), and one per sound effect, only while sound was running, unmuted, and the same effect hadn't
    played in the last 35 ms of the audio clock. So whether sound existed, was unlocked, muted or busy shifted every
    random number the game drew after it.
  - **When it's needed:** a session recorder. Recording, installed before the game's code: a seed for `Math.random`;
    each display frame's timestamp, with `performance.now` and `Date.now` reading it during the frame (Emberdeep's slow
    motion and menus read the wall clock); every input event with the frame it arrived before (keys, pointer, wheel,
    touch, blur, focus, visibility, resize; DOM buttons by selector), and gamepad snapshots per frame; the viewport and
    pixel ratio; the save (`localStorage`) at the start; and a checksum every second (a game's own state hash when it
    gives one) so a replay can say where it diverged. Replaying: a tool opens the page in headless Chromium at the
    recorded viewport, restores the save, installs the seed and the clock, dispatches each event before its frame and
    runs every frame, drawing included (some drawing draws random numbers too); then screenshots, filmstrips or
    `__ed` queries at any frame. The owner turns recording on once (a Developer setting), plays on a phone, and on a
    bug saves the session for an agent.
- **Why:** a bug seen on a device becomes an exact, headless repro instead of a description; that's the biggest gain
  determinism can give this repository. Building the recorder waits for its trigger, as the North Star asks: the first
  bug seen on a device that the harness can't reproduce, or the owner wanting to send sessions as bug reports.
- **Answered:** yes, the owner left it to the agent ("fix it, or leave it and see how it goes").
- **Landed in:** v0.16.0 (the sound's stream); the recorder is open.
- **Done in D14** (v0.17.0): the recorder and the replay tool are built.

## D13 · 2026-10-10 · Reversible calls are made at once; the timer is for the hard to undo

- **Principle:** process (escalation)
- **Call:** in the engine tier, a call a revert undoes (code, design, a dependency, a doc) is made immediately, in its own
  commit, flagged in the pull request and logged here; nobody waits for it. Only a call that reaches outside the
  repository or can't be taken back with a revert (deleting what others rely on, publishing, spending, a license) is
  escalated with the 15-minute wake-up timer of D11. This entry is itself such a call: made at once, in its own commit,
  flagged in its pull request.
- **Why:** the doctrine optimizes good ideas per unit of time, and a reversible call's worst case is a revert, which costs
  less than an agent idling or a human being interrupted. The timer still protects the decisions a revert can't fix.
  The owner's goal for this round named both: reversible calls at once, and the timer.
- **Answered:** yes, the owner.
- **Landed in:** v0.16.1

## D14 · 2026-10-10 · Sessions recorded on any device replay exactly

- **Principle:** 5 (deterministic by construction), 3 (verifiable without a display)
- **Call:** build D12's recorder now instead of waiting for its trigger. The engine records (section 23, `E.session`):
  the seed, every frame's time (the clock reads it during the frame), every input from the person or the device with the
  frame it arrived before, gamepad readings, media queries, safe-area insets, the screen and the save at the start, and
  a checksum every 60 frames (`game.stateHash` adds a game's own state; Emberdeep gives its hero, level and crowd).
  `tools/replay.mjs` replays a session in headless Chromium and reports the first checksum that differs. Emberdeep's
  Developer panel (Guide) turns recording on and saves the session; on a phone, to the share sheet.
- **Why:** the owner's goal for this round named a working replay path. It is a reversible call (D13), so it was made at
  once. `tools/replay-test.mjs` proves it: sessions recorded in real time, with the browser's own uneven frame times,
  at a desk and on a phone by touch, replay to the same state to the last decimal, and a session with one key press
  taken out diverges where it should.
- **Limits:** the GPU lighting is off while recording (it starts on real time); a session is one page load; a session
  replays on the build it was recorded on (it carries its version and build); clicks on checkboxes replay through their
  change events.
- **Answered:** yes, the owner (this round's goal).
- **Landed in:** v0.17.0
- **Fixed in v0.17.5:** a recording starts when the page has loaded, as a replay does. A browser's own pointer move during
  the load was recorded but never reached the game, and its replay did, so sessions diverged on a slow load.

## D15 · 2026-10-10 · Portable math while recording and replaying

- **Principle:** 5 (deterministic by construction)
- **Call:** while a session records or replays, `Math.sin`, `cos`, `tan`, `atan`, `atan2`, `asin`, `acos`, `exp`, `log`,
  `log2`, `log10`, `pow`, `hypot` and `cbrt` are the engine's own (`PORTABLE_MATH`, engine section 23, `E.session.math`):
  built from `+ - * /` and `sqrt` only, which every JavaScript engine computes exactly, so a session recorded in one
  browser replays in another bit for bit. `sin`, `cos`, `atan`, `atan2`, `exp` and `log` are fdlibm 5.3's algorithms,
  the ones Chromium's are derived from: on 200,000 random inputs each they give Chromium's own bits every time (angles
  past 820,000 radians go on with an exact two-part reduction, within one unit in the last place of Chromium up to
  1e12). The others are composed from those, within a few units in the last place; exact powers of 2 and 10 give exact
  logs. They cost up to about twice the native time while recording; outside a session the browser's own are used.
- **Why:** an iPhone's Safari and Chromium round these functions differently in the last bit, and a game grows that
  bit into a different fight: in the test, a session recorded with every native function one unit off diverged at its
  first checksum (frame 60) without the portable math, and replayed exactly with it. Testing on a real phone needs the
  owner's phone; this closes the known gap between Safari and Chromium in advance.
- **Verified in Safari's engine** (v0.17.2): `tools/cross-engine-math.cjs` runs the same code in V8 and in
  JavaScriptCore (through Bun 1.2.23). Native math gave different bits in the two engines (2.8 million results), and so
  did the engine's own Humanoid animated for 3,000 steps with it; the portable math and the same Humanoid with it gave
  the same bits in both.
- **Answered:** yes, the owner (this round's goal: a bug seen on a phone, replayed headless).
- **Landed in:** v0.17.1

## D16 · 2026-10-10 · The clock is an exact fixed step

- **Principle:** 5 (deterministic by construction)
- **Call:** supersedes D4's substeps. The engine's loop (both editions, `Game._run`) adds each frame's real time, capped at
  50 ms, to an accumulator and runs one update for each whole 1/120 s of it (`o.step`), with `dt = o.step * timeScale`;
  the remainder waits for the next frame, and `game.alpha` is its fraction of a step. Slow motion makes steps shorter, not
  fewer (fixed game-time steps would update on only about 60% of frames at Emberdeep's 0.3-0.4); above speed 1 a step is
  split so none is longer than 1/120 s. Paused or at `timeScale` 0 the steps still run with `dt` 0, so input ticks. The
  accumulator starts half a step in, so frame times that wobble around 60 or 120 Hz keep two or one steps a frame. The
  engine doesn't interpolate drawing yet.
- **Why:** the old loop split each frame into equal substeps, so the step size followed the refresh rate (1/144 s at 144
  Hz, 1/180 at 90): the same `Body.jump(210)` peaked at 30.63 at 60 Hz and 30.77 at 144, though the header promised
  identical motion. A builder (Vesper, `docs/FEEDBACK-LOG.md` F1) found it and patched it. D4 kept the substeps because
  an exact step "needs render interpolation and touches every game"; it touches no game at 60 and 120 Hz, which run the
  same steps as before, and interpolation can wait until someone sees judder.
- **What it changes:** at 60 and 120 Hz a game runs the same number of steps of the same size. Under the harness the
  old steps carried the rounding of the frame time (`(now - last) / 1000 / 2` is 0.008333333333333257, not 1/120),
  which Emberdeep's fights grow into different pixels: a seeded Emberdeep fight and the brawler starter differ from
  v0.17.4, and are pixel-identical to v0.17.4 with its step made exactly 1/120. At 90 and 144 Hz games now play as at
  60. Pacing without interpolation: at 90 Hz frames advance 1, 1 and 2 steps in turn; at 144 Hz one frame in six runs
  no step and shows the last frame again. To look at on the owner's phone; `game.alpha` is there when a game or the
  engine wants to interpolate.
- **Checked by:** `tools/contract-test.mjs`: the same inputs at 60, 90, 120 and 144 Hz give the same state bit for bit,
  on both editions. `test:determinism` and `test:replay` stay green.
- **Answered:** yes: the owner's plan (`docs/HANDOFF-VESPER-FEEDBACK.md`, Phase 0) asked for it.
- **Landed in:** v0.17.5

## D17 · 2026-10-11 · The API index and its budget

- **Principle:** 1 (agent-readable)
- **Call:** `API-INDEX.md` lists every public name in the engine, one line each, written from the engine by
  `tools/api-index.mjs` (`tools/build.mjs` runs it): its signature, its default for a field, and the doc comment above
  it. `doctrine-check` fails when the index is stale or a public name has no description, so a name is documented or
  made private (`_`) when it's added. Its budget is 30,000 cl100k tokens; 27,270 at the start. The cards keep theirs
  (D8) and point to it.
- **Why:** a builder (Vesper, `docs/FEEDBACK-LOG.md` F1) used 28 public members the cards never mention, found by
  reading the 150k-token source. The cards are overviews and have under a thousand tokens of room each; the index holds
  the detail, and agents search it rather than read it, so its budget is a ceiling on growth, not a reading cost. About
  10% headroom, as D8 gave the cards. Writing it left 568 of 807 public names without a description: about 110 that
  were internal machinery became private, and the other 460 got doc comments.
- **Answered:** yes: the owner's plan (`docs/HANDOFF-VESPER-FEEDBACK.md`, Phase 2) asked for it.
- **Landed in:** v0.19.0 (#63)

## D18 · 2026-10-11 · The API index grows with the third-person kit

- **Principle:** 1 (agent-readable)
- **Call:** the index's budget rises from 30,000 to 34,000 cl100k tokens (D17's); 30,532 with the kit.
- **Why:** the third-person kit (the plan's Phase 3) added about 90 public names: `E.Mover` and its fields, `E.Action`
  and `E.ACTIONS`, `E.Suspicion`, `E.sees`, `E.hears`, `map.fill`, `map.setFloor`, `flow.next`, `r.sightCone`,
  `r.marker`, `rig.land`, about 3,300 tokens. The index is searched, not read whole (D17), so its budget caps growth
  rather than a reading cost, and cutting the kit's lines would leave public names undescribed, which `doctrine-check`
  forbids. About 10% headroom again. What would change it: if agents turn out to read the index whole (Phase 5's
  benchmark watches what they open), split it by area instead of raising it again.
- **Answered:** no: made without a response, to review (reversible: lower the number and cut lines)
- **Landed in:** v0.20.0 (#64)

## D19 · 2026-10-11 · The benchmark is built; its runs wait on the owner

- **Principle:** process (spending is a call that is hard to undo)
- **Call:** `tools/agent-bench.mjs` is merged without a run. A run starts a fresh coding agent on a brief (capped at $30
  by default) and a vision judge, so it spends money; the plan (Phase 5) says to ask the owner before running it and,
  with no answer, to run nothing. The owner is asked as the tool lands; until a yes, nothing runs.
- **Why:** the tool, its selftest and a dry run cost nothing and are ready. The measures stay open in `DOCTRINE.md` until
  the runs: Assassin's Creed (the baseline against Vesper's ~50k output tokens), a Breath of the Wild village and an
  Arkham predator room. What would change it: the owner's yes (then run the three briefs and put the rows in
  `DOCTRINE.md` and a pull request) or a budget they set.
- **Answered:** yes: the owner said to run the three briefs (2026-10-11). The Assassin's Creed run is in `DOCTRINE.md`
  (cut off by the subscription's usage limit in its last read-through, which these runs share with the owner's own
  sessions); the Breath of the Wild run was stopped by the machine's memory pressure; the Arkham run hasn't run.
  The owner then said to run both again (2026-10-11): both completed, and their rows are in `DOCTRINE.md` (v0.22.2).
- **Landed in:** v0.22.0 (#66); the first results in v0.22.1; the other two in v0.22.2

## D20 · 2026-10-11 · The API card's budget rises to 15,000

- **Principle:** 1 (agent-readable)
- **Call:** the API card's budget (D8) rises from 13,500 to 15,000 cl100k tokens; 14,000 with the standard features.
- **Why:** the card is the one page a builder reads whole, and the standard features have to be on it: a builder who
  doesn't know a pause menu, settings and full screen exist writes its own (output tokens) or ships without them. The
  section is about 500 tokens; the card had 5 to spare. About 7% headroom. What would change it: a card that keeps
  growing past this is a reason to move its detail into `AI_GUIDE.md` and the index, not to raise it again.
- **Answered:** no: made without a response, to review (reversible: lower the number and cut the section)
- **Landed in:** v0.23.0

## D21 · 2026-10-11 · Standard features in every game, on unless a game says no

- **Principle:** 1 (agent-readable) and 10 (discovery first)
- **Call:** every `new E.Game` gets the standard features (engine section 10b and `E.Shell`'s standard menu): a pause
  menu with Settings, Controls (rebinding) and Full screen; settings saved per game, versioned and checked; full screen
  from a phone's first tap (the player's exit is kept); a pausable scene pausing when the page is hidden or the
  controller unplugs; the corner's menu and full-screen buttons; the page set up for phones; a fixed resolution filling
  a high-density screen (`scale: 'auto'`); a hidden page's sound asleep. They are on by default; a game turns parts off
  (`menu: false`, `fullscreen: 'button' | false`, `corner: false`, `autoPause: false`). The canvas PAUSED overlay stays
  for `menu: false` and the agent edition. Emberdeep and the labs with panels of their own opt out of the menu and the
  corner. What the owner's quality prompt asks beyond this (PWA, wake lock, folds, physical devices, controllers with
  other mappings) is production hardening: deferred, as principle 10 says (`docs/STANDARD-FEATURES.md`).
- **Why:** the owner asked for it: games came back without full screen or settings, and a long quality prompt then
  bought them with output tokens, game by game. Built into the engine, they cost a builder a few hundred input tokens of
  manual. On by default, because an opt-in is what three builders skipped with `E.Shell` (`docs/FEEDBACK-LOG.md`,
  F2.3 to F4.3). What would change it: a builder fighting the defaults (a game whose own UI collides with the corner or
  the menu) is a reason to turn them off in that genre's starter, or to make the menu opt-in again.
- **Answered:** yes: the owner's goal for this work (2026-10-11), the defaults themselves made without a response, to review
- **Landed in:** v0.23.0

## D22 · 2026-10-11 · The API index's budget rises to 37,000

- **Principle:** 1 (agent-readable)
- **Call:** the index's budget (D17, D18) rises from 34,000 to 37,000 cl100k tokens; 34,330 with the boot.
- **Why:** the standard features (D21) and the boot (D23) added about 60 public names, every one described, as
  `doctrine-check` requires. The index is searched, not read whole (D17); the benchmark's runs (`DOCTRINE.md`) read the
  engine's source, never the index whole, so D18's reason to split it instead has not come. About 8% headroom. What
  would change it: an agent reading it whole, or a next raise: then split it by area.
- **Answered:** no: made without a response, to review (reversible: lower the number)
- **Landed in:** v0.24.0
- **Superseded by D28** (v0.34.2): the budget is 40,000, counted exactly.

## D23 · 2026-10-11 · A boot for every game; errors before play become a report

- **Principle:** 3 (verifiable) and 10 (the device the human reviews on)
- **Call:** the engine has a boot (section 10c): `game.start({ boot: { title, version, steps, messages, min } })` runs the
  game's setup one step a frame behind a boot screen (the system's checks, a progress bar, the game's lines), then a
  warm-up frame under it. The build puts the screen's splash (`E.bootSplash`) first in every game page it makes (the
  starter files, Emberdeep, Emberwell, Vesper's interface, the handoff template), so it shows from the first paint: on a
  phone, Emberdeep's first paint comes at about 0.16 s instead of 1.6 s of black. Any error before play (a failing step,
  a script error, an error in the first update or draw) turns the screen into a report a player can screenshot, in place
  of the red box; after play, errors keep the red box, with the report's short line. A game with no steps and no splash
  shows nothing and starts at once, as before.
- **Why:** the owner asked for a boot "like a BIOS and an OS loading" whose failure screen a player can screenshot for a
  diagnosis. Games here have no asset files, so most start in a fraction of a second and a fixed loading screen would
  only slow them: the screen shows only while there is work (steps, a slow page), and `min` (a splash held on purpose)
  is the game's choice. The report is for the owner, who reviews on a phone, and for the agents who fix what it shows.
  What would change it: a builder fighting the report (a game that expects the red box before play), or the splash
  showing where it shouldn't (then `boot: false`, or leave `@boot` out of that page).
- **Answered:** yes: the owner's goal (2026-10-11); the defaults (the splash in the built pages, the report before play)
  made without a response, to review
- **Landed in:** v0.24.0

## D24 · 2026-10-12 · Full screen comes back when a game starts

- **Principle:** process (a standard feature's rule: `docs/STANDARD-FEATURES.md`, 4 Full screen, "never force it back
  after the player leaves")
- **Call:** on a phone, a game started by a tap goes full screen again after a back gesture or Escape left it; only
  turning it off (the corner's button, the menu, `fullscreen.toggle()`) is the player's choice, kept in
  `settings.fullscreen` and honored. Mid-game, the player who leaves it stays out until the next game starts. Settings
  move to version 2: a version-1 `fullscreen: false` (which also meant "left by a gesture") is forgotten once.
- **Why:** the owner, testing the kits on a phone, found none of them full screen: one exit by an edge swipe (the same
  swipe that leaves a page, which the owner said players make when they can't find the way back) turned it off for good,
  and the save kept it off on every later visit. A gesture is not a choice; a button is. What would change it: players
  reporting full screen coming back when they didn't want it; then a toggle in Settings for the auto behaviour.
- **Answered:** yes: the owner's goal ("each of these need to be actually full screen") on 2026-10-11; the line between
  a gesture and a choice drawn without a response, to review
- **Landed in:** v0.27.0

## D25 · 2026-10-12 · A fast screen the frames can't keep up with is drawn every other refresh

- **Principle:** process (the engine's frame loop, both editions: a default every game gets)
- **Call:** the loop measures the display's refresh (the shortest of the last 90 frame gaps: `game.hz`). On a display of
  90 Hz and up, when a frame's update and draw cost more than 0.8 of a refresh (an average), it draws every other
  refresh, evenly (`game.drawEvery` 2), and back to every refresh once the cost is under 0.55 of one. The updates still
  run at every refresh (120 steps a second); only drawing skips. `new E.Game({ pace: false })` keeps the old way: draw
  every refresh. A 60 Hz screen is never halved.
- **Why:** the owner, testing the kits on a Galaxy S25 (a 120 Hz screen), found the adventure choppy after its GPU
  lighting was turned off for phones. Its frame (about 11 to 13 ms here, its townsfolk most of it) doesn't fit a 120 Hz
  refresh (8.3 ms), so some frames made the refresh and some missed it: frames 8 and 17 ms apart at random, which reads
  as choppy. Drawn every other refresh they come 16.7 ms apart, evenly (measured on an emulated 120 Hz screen: 90% of the
  gaps 16.7 ms paced, against a mix of 8, 17 and 25 ms not). A game that fits its frame stays at the full refresh. What
  would change it: a game that wants every refresh drawn even when it can't keep up (then `pace: false`, or make it
  the default), or a player who sees 60 frames where there were more.
- **Answered:** no: made at once as a reversible call (it is one option and a few lines of the loop), flagged in the pull
  request, to review
- **Landed in:** v0.29.0
- **Confirmed:** 2026-10-12, by the owner on the Galaxy S25 (v0.31.2, with D26): the adventure smooth with Settings,
  Display, Frame rate on Auto (the pacing's own call)

## D26 · 2026-10-12 · Refreshes missed count too, not only a frame's cost

- **Principle:** process (the engine's frame loop, both editions: D25's default, widened)
- **Call:** D25 paces by a frame's update and draw cost, the only time the page can clock. The loop now also counts the
  refreshes missed between frames drawn at each refresh (a gap over 1.5 refreshes): past about one in five (an average)
  it draws every other refresh, evenly, and holds that 3 s before trying each refresh again, then 6, 12... up to a
  minute, so a GPU that can't keep up doesn't flicker between the two. The refresh (`game.hz`) is measured only while
  each refresh is drawn.
- **Why:** a phone's browser draws the canvas on its GPU after the page's code has run. A GPU slower than the refresh
  makes the browser skip refreshes at random while the page's own cost looks small, and D25 kept drawing every refresh:
  frames 8 and 17 ms apart again, the choppiness the owner saw on a Galaxy S25 (measured on an emulated 120 Hz screen
  whose GPU is busy 5 and 11 ms by turns: 48% of the gaps 16.7 ms and the rest 8.3 before, 90% 16.7 ms after). While
  paced, a GPU behind skipped the refresh between frames too, so the refresh read 60 Hz and switched the pacing off; it is
  no longer read then. What would change it: a device where the browser skips refreshes for another reason (then the
  game is drawn at half its refresh for a minute at most, and back), or the owner's readings on the S25 saying otherwise.
- **Answered:** no: made at once as a reversible call (a few lines of the loop beside D25's), flagged in the pull
  request, to review
- **Landed in:** v0.29.1
- **Amended:** v0.29.2: the hold goes back to 3 s after 10 s drawn at each refresh (it only grew, from Codex's review);
  while paced, gaps shorter than one and a half refreshes are still read, so a display that changes its rate is followed;
  and the first frame's gap (timed from `start()`, not from a refresh) is never read: it passed for a 200 Hz screen and
  locked the pacing in (since D25)
- **Confirmed:** 2026-10-12, by the owner on the Galaxy S25 (v0.31.2): the adventure smooth with Frame rate on Auto, the
  readings this entry waited for

## D27 · 2026-10-12 · A 3D engine on three.js and Rapier, with its own kits

- **Principle:** 7 (common ground: here, no dependencies in the engine or the games; every page one self-contained file,
  D5), 6 (WebGPU only), and D3's note that the 3D labs were leaving for their own repository
- **Call:** `engine/my-3d2dge-3d.js` is an engine-tier module that depends on the two libraries the 3D labs pinned and
  vendored (three.js r182, Rapier 0.19.3; D9), and its kits (`src/starter3d/`, `dist/kits/my-3d2dge-3d-*.html`,
  `dist/my-3d2dge-3d.html`) depend on it. It keeps three.js's WebGL 2 fallback, as the 3D labs do (D3): the code is
  WebGPU's (WebGPURenderer, node materials, TSL), and three falls back by itself where a browser has no WebGPU. A 3D kit
  is not one self-contained file: it loads the libraries from `/vendor/` through its import map, so it is served. Its
  manual is its header, held to 6,000 tokens by `tools/doctrine-check.mjs` (5,000 when it landed); it is not in
  `API-INDEX.md`, whose budget is the 2D engine's. The 3D labs stay here, the stress world as the prototype the engine was
  built from.
- **Why:** the owner asked for the equivalent of the starter kits on the stress world's 3D engine. A kit is what models
  copy, so the engine under it is the engine tier, with versions, a changelog, a check and a manual. The libraries are
  the ones the doctrine already chose for what models know (principle 9), and nothing in the 2D engine or its games
  changes: a 2D page loads none of it. The fallback keeps the kits playable on every phone that reviews them (principle
  10). What would change it: the owner moving the 3D work to its own repository (D3), or WebGPU on every device the games
  are judged on (then the fallback goes).
- **Answered:** the kits, yes (the owner asked for them, 2026-10-12); the dependency, the fallback, the served pages and
  the budget: no, made at once as reversible calls, flagged in the pull request, to review
- **Landed in:** v0.34.0

## D28 · 2026-10-14 · The API index's budget rises to 40,000, counted exactly

- **Principle:** 1 (agent-readable)
- **Call:** the index's budget (D17, D18, D22) rises from 37,000 to 40,000 cl100k tokens; 35,697 at the raise. The
  budgets are counted exactly: `gpt-tokenizer` (MIT, a tool) is a dev dependency beside Playwright and terser, so
  `doctrine-check` counts cl100k tokens wherever `npm install` ran, and estimates (erring high) only without it. Nothing
  in the engine or the games depends on it, and the site installs nothing (`vercel.json`).
- **Why:** the estimate had read the index at 36,748 of 37,000 and the API card at 14,998 of 15,000, which made the
  asset store plan (`docs/HANDOFF-ASSETS.md`, about 10 new names in its Phase 1) look blocked; counted exactly they were
  35,697 and 14,543. The owner chose the raise over splitting the index by area (D22's next step), for headroom as the 2D
  engine keeps growing. About 11% headroom. What would change it: the owner's analysis of 34,000, 37,000 and 40,000 (what
  each costs an agent and what it buys), planned for after the asset store; an agent seen reading the index whole.
- **Answered:** yes: the owner chose it (2026-10-14)
- **Landed in:** v0.34.2

## D29 · 2026-10-14 · Shapes and materials are the full engine's; the agent edition keeps stubs

- **Principle:** 1 (agent-readable: the agent edition's header is the whole manual, 10,000 tokens) and 8 (the agent
  edition's API is a strict subset of the full engine's)
- **Call:** the shape renderer, `r.shape`, `map.solid`, `E.shapeSprite`, `E.shapeInfo`, `E.addAssets` and the material
  painters live in `engine/my-3d2dge.js` only. The agent edition has the registries (`E.SHAPES`, `E.MATERIALS`,
  `E.PATTERNS`, empty objects a game may fill) and calls that warn once and return null, as `r.prop` does; its header
  gets one line pointing to `docs/ASSETS.md`.
- **Why:** the renderer and the core library are about 30 KB of source, and the agent edition's header had 271 tokens
  left; a game written for the full engine still runs on the agent edition, without its objects (docs/HANDOFF-ASSETS.md,
  section 10). What would change it: games built on the agent edition asking for objects, or the agent edition taking a
  manual of its own beyond the header.
- **Answered:** no; made at once as a reversible call, flagged in the pull request
- **Landed in:** v0.35.0

## D30 · 2026-10-14 · The asset card has a budget of 4,000 tokens

- **Principle:** 1 (agent-readable: a manual with a measured budget)
- **Call:** `docs/ASSETS.md`, the card for objects and materials, is held to 4,000 cl100k tokens by
  `tools/doctrine-check.mjs`, as the other manuals are (D8, D20, D27, D28); 3,256 when it landed. The other manuals each
  get one line pointing to it.
- **Why:** the card is what a model reads whole before writing an object (its recipe says so), so its cost is paid on
  every object a game makes; the format, the library and the recipe fit in this, and the store's catalogs carry the
  rest (docs/HANDOFF-ASSETS.md, section 7). What would change it: the Phase 4 authoring test showing models miss something
  the card left out.
- **Answered:** no; made at once as a reversible call, flagged in the pull request
- **Landed in:** v0.35.0

## D31 · 2026-10-14 · How shapes look: the asset probe's decisions

- **Principle:** 3 (judged from pictures) and the North Star (the look is the open threshold theme: F2.2, F3.2, F4.2)
- **Call:** the engine draws shapes the way the asset probe decided (Phase 0 of docs/HANDOFF-ASSETS.md, one commit each in
  the pull request that added the probe): the light from the viewer's upper left in every view (not fixed in the world);
  views of pitch 70 and up draw shapes from the characters' lower angle (`E.charView`); lit top edges and creases on,
  dithering at band edges off. Converted models keep their kit's own colors on the nearest library material's pattern,
  each kit scaled once so its objects stand beside the hero as the hand-written ones do; hand-written objects are about
  1.2 times life, as props are drawn bigger than life. Asset data is written densely (`[0,0,8]`): a third fewer tokens.
- **Why:** the probe's sheets: fixed in the world the light shows iso's camera the shadow side of everything; true
  top-down, a pine is a dark disc; without edges and creases the parts merge; dithering added noise. Remapped colors
  drifted dE 8 to 24 from the source, kept ones 0 to 5. The gate's numbers (median 127 tokens, at most 2.5 ms a shape, 8
  of 8 conversions at IoU .87 or better) are in that pull request. What would change it: the owner on the preview, or the
  benchmark judge's next look.
- **Answered:** no; made at once as reversible calls, flagged in the pull requests
- **Landed in:** v0.35.0 (the probe: Phase 0, unversioned)

## D32 · 2026-10-14 · The kits carry the shape renderer and the core library: about 18k tokens more

- **Principle:** 1 (agent-readable: a genre kit is the usual choice for chat models, sold as fitting a 200k context)
- **Call:** the kits embed the full engine minified, so the asset store's Phase 1 grows each one by about 18,000 cl100k
  tokens: the shape renderer about 10,600, the core library about 3,500, the material registry about 4,100 (part of it
  the old faces and roofs, moved). The genre kits go from 163k-182k to 181k-200k tokens, the 3D kits from 200k-205k to
  218k-223k. terser's stronger options save under 100 tokens. README's table had stale estimates (119k-130k for a
  genre kit); it now gives exact counts.
- **Why:** the starters, the kits and the template game are to draw their objects from the store (Phase 3 of
  docs/HANDOFF-ASSETS.md), so the renderer has to be in the engine they embed, and an object then costs a game about a
  hundred tokens of data instead of 236-480 characters of drawing code per prop. What would change it: the owner wanting
  kits back under about 180k, by a kit engine without the props' old drawing code once shapes replace it (Phase 3), the
  API card trimmed, or kits built per genre without the parts their slice never calls.
- **Answered:** no; made at once as a reversible call, flagged in the pull request
- **Landed in:** v0.35.0

## D33 · 2026-10-15 · The asset store: CC0 libraries converted to text, with provenance, binaries never committed

- **Principle:** 4 (agent-accessible assets), as D7 is for the mocap store
- **Call:** `src/assets/` holds objects, materials and sprites converted from CC0 libraries (Kenney's kits and pixel packs,
  KayKit, ambientCG) into the text format of `docs/ASSETS.md`. Downloads stay in `.cache/assets/`; each set records every
  download (url, date, sha256 or commit, the license as read and its hash), each entry its download, its file and its fit,
  and each set's ledger every file of its sources. The store takes CC0 1.0 and the public-domain mark only, enforced by
  `asset-fetch` and the assets suite. Kenney's flat colors are read as sRGB, as its own renders show them, though the glTF
  spec calls those factors linear (recorded per download: `factors: 'srgb'`). Curation is a person's or a subagent's
  call from contact sheets: what to keep (described, so it can be found), what to leave out and why, and which pattern
  each kit color takes (`$mats`).
- **Why:** an agent can read, search, cut and edit text, not a binary; a source can change at the same URL, so the bytes
  behind each entry are named; a license added later is hard to undo (docs/HANDOFF-ASSETS.md, sections 5.3 and 10). What
  would change it: the owner allowing CC BY with credit per author (game-icons.net, the Icosa Gallery), or a library whose
  terms a re-check finds changed.
- **Answered:** no; made at once as a reversible call, flagged in the pull request
- **Landed in:** v0.36.0

## D34 · 2026-10-15 · The Asset Lab inlines every set; the kits never do

- **Principle:** 1 (agent-readable kits within their contexts) and 3 (judged from pictures)
- **Call:** the Asset Lab (`/asset-lab`, kept) is one page with the engine and every set of the store inlined, about 1.4
  MB, as the Mocap Lab inlines its sets; the kits and the template game embed the engine only, and a game loads the sets
  it uses (or cuts its own with `asset-set`).
- **Why:** browsing and search need every entry at once, and a page that works from a file needs no fetch (which `file://`
  forbids); a kit is read whole by a model, and the store is about 700 KB. What would change it: the store outgrowing
  one page (then the lab loads sets on demand, as the Mocap Lab's CMU library does).
- **Answered:** no; made at once as a reversible call, flagged in the pull request
- **Landed in:** v0.36.0

## D35 · 2026-10-15 · Emberdeep dresses with shapes one for one, so no level moves

- **Principle:** 5 (deterministic: the same seed builds the same level) and Emberdeep's contract (`DESIGN.md`: shared
  files stay as they are wherever a registry or a BUS event will do)
- **Call:** a theme's dressing list names a shape with `WLD_ps` where it named a prop with `WLD_pp` (barrels, crates,
  pots, rocks, crystals, the Sky's blossom trees), drawing the same random numbers, and the shape is kept as a prop's
  record (`L.props`, with `shape`), so every rule that spaces mechanics from props still sees it. The core file's
  `drawProps` gains one branch that draws a record's shape. The town's still pieces (barrels, crates, sacks, tables,
  stools, benches, hay, the well) and its pines become shapes and keep their collision circles; the animated ones (the
  trees that sway, the scarecrow, the stash chest) stay as they are.
- **Why:** a shape as a new kind of thing would be spaced by the things' rules, not the props', and every level after the
  first converted one would be laid out differently: the seeds the tests and the players know would change. One line in
  a core file keeps them. What would change it: a registry for what draws a level's records.
- **Answered:** no; made at once as a reversible call, flagged in the pull request
- **Landed in:** v0.37.0

## D36 · 2026-10-15 · The benchmark re-run is skipped: no answer in fifteen minutes

- **Principle:** process (spending is a call that is hard to undo; D19)
- **Call:** Phase 4 of the asset plan re-runs one `agent-bench` brief (Breath of the Wild, about $15) to see whether
  shapes move the judge's look score (6/10) and the art share of a game's code. The owner was asked at 02:03 UTC with a
  fifteen-minute wake-up; with no answer, the paid run is skipped, as the owner's goal for the plan said. The free half of
  Phase 4 ran: the authoring test (its numbers are in `docs/ASSET-IMPORT.md`, Measures, and `DOCTRINE.md`).
- **Why:** the owner set the rule: ask, and with no answer skip it and finish the rest. What would change it: the owner's
  yes, then `node tools/agent-bench.mjs --brief botw-village` and a row in `DOCTRINE.md`'s table.
- **Answered:** no answer within the wake-up
- **Answered since:** the owner's yes (2026-10-15, D38), and the run (v0.43.1, `docs/FEEDBACK-LOG.md` F6, the row in
  `DOCTRINE.md`): the same brief on the same model (Opus 5.5) scored 5/10 against F3's 6/10. The game placed its
  objects as the core library's shapes, from a 268-token list, and 4.6% of its code draws by hand (F3's code wasn't
  kept, so its share can't be counted). It was half F3's size, at a quarter of the cost ($3.43). So the store moved the
  art out of the code, but not the judge's score; one run is a signal, not a measure. The judge's complaints were no
  longer the objects: empty fields, flat lighting, the iso view's void.
- **Landed in:** v0.38.1

## D37 · 2026-10-15 · The themes' dressing weights apply, so every level dresses afresh

- **Principle:** 5 (deterministic: the same seed builds the same level) and Emberdeep's contract (`DESIGN.md`: a theme's
  dressing list weighs its items)
- **Call:** `WLD_dress` (51-themes.js) picks from a theme's list with the levels' `RNG.weighted`, which reads `.weight`;
  every list gives its weights as `w`, so every item came equally often (a ruin's pillars, weighted 3, as often as its
  pots, weighted 1). The pick now reads `w`. The same seed still builds the same level, but not the level it built
  before: a different item asks `WLD_spot` for a different spot, and the random numbers after it (the mechanics' things,
  the packs) land differently. The scenes added with it (53-scenes.js) are laid out at `levelStart` from a stream of their
  own, so they move nothing.
- **Why:** the weights are the theme's design as written, and nothing kept a level's layout from one version to the next
  (the replay suite records its sessions afresh). A reversible call, in its own commit: revert it to have the old levels
  back.
- **Answered:** no; made at once as a reversible call, flagged in the pull request
- **Landed in:** v0.40.0

## D38 · 2026-10-15 · The API index is optimized for answers, not overhauled: the owner's answers

- **Principle:** 1 (agent-readable) and 8 (quality under the hood: what leaves the API)
- **Call:** the owner's answers to the four decisions of `docs/HANDOFF-API-INDEX.md` (section 4), all yes:
  1. optimize the index, don't overhaul it: one file, and the 40,000-token budget kept (not lowered to 37,000 or
     34,000); Phases 1 (the answers), 2 (each thing said once) and 4's tool go ahead;
  2. Phase 3: the 68 machinery names nothing outside the engine uses become private, a minor version;
  3. Phase 4's run: one run of the Breath of the Wild brief on the instrumented benchmark, after Phases 1 and 2,
     about $13 to $15, which also answers D36;
  4. the handoff keeps the full index, with no index of the agent edition's names alone.
- **Why:** measured at v0.42.0, the index was 35,669 tokens; grep answered 15 of 25 lookups taken from what the
  benchmark's agents read the source for, the briefs and the kits, and no cut, split or denser format changed one of
  them. What fails is facts the index lacks and members filed under an instance's name. While agents grep, every budget
  costs an agent the same; only a whole read differs. This answers D28's "what would change it"; D28 stays as it is.
  What would change it: Phase 4's run showing an agent reading the index whole or paging through it (then split it by
  area, each file under one read), the index passing 38,000 tokens, or the lookup check unable to keep 24 of 25.
- **Answered:** yes: the owner (2026-10-15)
- **Landed in:** v0.42.1

## D39 · 2026-10-15 · The index answers its lookups

- **Principle:** 1 (agent-readable: a builder finds what it needs without reading the engine's source)
- **Call:** `API-INDEX.md` is held to answering lookups, not only to listing names. A constructor's line names the name
  its instances go by (`new E.Attack(...) → slash`), and a contents block after the examples gives each section's line
  and its classes' instance names. A doc comment's options, one to a line as `- name: what it does`, become index lines
  of their own named by their owner (`new E.Game({ expand })`); the ten lines over 200 tokens are written that way. A
  short list of names is given in full (`E.PROPS`). The facts the benchmark's agents read the source for are doc
  comments where a search finds them. `tools/api-index-lookups.json` holds 25 lookups, each a grep and the facts its hits
  must hold, and `doctrine-check` fails when one stops answering; a lookup an agent is later seen to miss is added there.
- **Why:** measured at v0.42.0, grep answered 15 of the 25, and no cut, split or denser format changed one
  (`docs/HANDOFF-API-INDEX.md`, section 2.3). Now 24 answer in one search and the 25th (`E.Attack`'s methods) in two;
  their hits hold 5,984 tokens, against 7,110. The index is 37,058 tokens: 264 more than the plan's 36,794, which counted
  three of the ten lines split (the plan says so), while its text asks for all ten; the contents block is the plan's size.
  What would change it: Phase 4's run showing agents reading the index whole (then split it, D38), or the lookups costing
  more than they save.
- **Answered:** yes: the owner approved the plan (D38)
- **Landed in:** v0.42.2

## D40 · 2026-10-15 · Machinery names leave the API

- **Principle:** 8 (quality under the hood: what games don't use stays behind the API) and 1 (the index lists what a
  builder can use)
- **Call:** 60 names of `docs/HANDOFF-API-INDEX.md`'s appendix B leave the API, in both editions.
  - 51 members are private (a leading `_`, every use inside the engines renamed):
    - what the engine calls itself (`game.screen._begin`, `r._finish`, `game.gpu._render`, ...);
    - inner state, caches and back references (`r._items`, `game.gpu._cv`, `shots._game`, `rig._mv`, `talk._page`, ...).
  - The constructors only the game makes leave `E`: `E.Screen`, `E.Renderer`, `E.Lighting`, `E.Audio`, `E.FullScreen`,
    `E.Settings` and `E.GPULighting` (with its `supported`). `E.faceClass` is a local of the engine.
  - Their instances stay public: `game.screen`, `r`, `game.lights`, `game.audio`, `game.fullscreen`, `game.settings`,
    `game.gpu`. The index lists their members under the instances' names.
- **The rule:** a name goes private when nothing outside the engine uses it through the receiver games give it, and
  either the engine calls it or it is inner state. The 3D engine is inside the engine: it may use private names.
- **Kept public, against the plan's list:** eight of its 68 stay public.
  - Six are used outside the engine. Temporary traps found them: a getter under each old name that threw, run through
    every suite. They are read through aliases the plan's receiver-by-receiver check couldn't see:
    - `game.screen.fx` and `fy`: the Emberdeep suites and `tools/ed-play.mjs` read them as `sc.fx` to turn a buffer pixel
      into a click;
    - `game.lights.list`: Emberdeep's `L.list` and the stress test;
    - `game.particles.draw` and `update`: the stress test and the stress world wrap them;
    - `action.start`: the contract suite's own action reads `A.start`.
  - Two are kept as a reversible call, in their own commit: `action.o` and `action.beats`. With `start`, they are what
    a game's own action needs (`E.ACTIONS.name = { setup(A), at(A, beat, u) }`): its options, and its beats, which a
    setup may change (the aerial takedown does). `E.ACTIONS`' line now says so.
  - The traps were run again on the 60 left: nothing outside the engine read one.
- **Why:** the index lists what a builder can use. 60 lines that no game needs cost 1,540 tokens, and each was a name
  an agent might take for API. A revert restores the names, and no game in the repository needs a change either way.
  What would change it: a game that needs one of them (then make that one public again, with a doc comment).
- **Cost outside the repository:** a game built from the handoff before v0.43.0 that reads one of the 60 gets
  `undefined` when it takes the new engine, with no error to point at it. The handoff is five days old, and the
  benchmark's games aren't kept, so how many such games exist can't be checked.
- **Answered:** yes: the owner approved Phase 3 (D38, decision 2). The eight kept public were made at once, flagged in
  the pull request: six by the plan's own rule, two as a reversible call in their own commit.
- **Landed in:** v0.43.0

## D41 · 2026-10-15 · The benchmark records how the manuals are read

- **Principle:** process (the North Star's measures, D19), and 1 (agent-readable: whether agents grep the index or read
  it whole decides whether it is split, D38)
- **Call:** `tools/agent-bench.mjs` records every read of the manuals (`API-INDEX.md`, `API.md`, `AI_GUIDE.md`,
  `docs/ASSETS.md`, `README.md`), not only of the engine.
  - Each read is classed whole, range or search, with the lines and tokens its result held and whether the Read tool cut
    it short.
  - Each read of the engine below its header records whether a search of the index came in the three tool calls before
    it: a lookup the index didn't answer.
  - `result.json` and the row sum the index's reads, and say when a run reopens the split: a whole read, ranges over
    most of the index, or more than a third of its searches followed by a read of the source.
  - The agent and the judge start without the variables of a Claude Code session that runs the bench (its session id,
    its effort, its messaging); a cloud session's sign-in is kept.
- **Why:** the index's budget and its split rest on a guess the benchmark had never measured: that agents grep it. It
  recorded reads of the engine alone, and the three runs' streams stayed on the machine that ran them. Run from inside a
  Claude Code session (as in a cloud session), a child agent took that session's id, its effort and, in this container,
  another default model: probed at $0.05, it ran as Sonnet 5.5 under this session's id. With the variables left out it
  is a fresh session; the model is the run's `--model`. What would change it: a run read by hand that the classes
  misread (then fix the reader and `--rescore` the run).
- **Answered:** yes: the owner approved Phase 4's tool and its run (D38, decisions 1 and 3)
- **Landed in:** v0.43.1

## D42 · 2026-10-15 · The API index plan, folded: what it measured, and the split reopened

- **Principle:** 1 (agent-readable) and process (a finished plan's decisions live here; the plan is deleted)
- **Call:** `docs/HANDOFF-API-INDEX.md` is deleted, as v0.38.1 did with the asset plan.
  - Its decisions are D38 (the owner's answers), D39 (the lookups), D40 (the machinery names) and D41 (the benchmark's
    reads).
  - Its lookups are `tools/api-index-lookups.json`: the 25 of its appendix A, and a 26th from the run.
  - What it measured is kept below.
- **The options**, measured at v0.42.0 (35,669 tokens, 917 names; grep answered 15 of the 25 lookups, 8 partly, 2 not):
  - A, let it be;
  - B, trim (the 68 names private, each thing said once): 32,204 tokens, the same 15;
  - C, split by area (a contents file and 3 files, or 29): 35,888 in 4 files and 36,895 in 29, the same 15, each hit 3%
    dearer;
  - D, the agent edition's 677 names alone in the handoff: 26,772, answering 12 / 6 / 7, without the props, the kit and
    the HUD;
  - E, a denser format (no bullets or backticks): 32,678, the same 15;
  - F, answers first (chosen): the plan counted 36,794, 35,053 and 33,226 for its three phases.
    - It landed at 37,058, 35,446 and 33,906: Phase 1 split all ten long lines where the count split three, and eight
      of the 68 names stayed public (D39, D40).
    - With lookup 26, 33,937.
    - 25 of 26 lookups answer in one search, and the other in two.
- **The budget** (D28's question):
  - For grepping, which the manuals tell agents to do, every budget costs an agent the same; only a whole read differs.
  - Claude Code's Read tool caps a read at 25,000 tokens of its own count, about 1.4 times cl100k: at 34,000 a whole read
    is 2 reads, at 37,000 or 40,000 it is 3.
  - 40,000 is kept (D38).
- **The † marks** (names the agent edition lacks) stay. They cost about 500 tokens and tell a builder which names are the
  essential engine. The handoff keeps the full index: its template game and the briefs use marked names.
- **Growth:**
  - From v0.19.0 to v0.42.0, 192 names and 8,330 tokens over 23 minor releases: 362 tokens a minor release on average,
    127 since v0.23.0, none from v0.38.1 to v0.42.0.
  - The third-person kit and the standard features made 60% of it.
  - The work in view (the source theme's remedy, live tuning, climbing and gliding, saves) adds about 1,500 to 3,500.
- **The split, reopened:** the plan's triggers were a whole read, ranges over most of the index, or more than a third of
  its searches followed by a read of the source.
  - The first instrumented run (v0.43.1, F6) met the third: 3 of its 8 searches were followed by the source.
  - It met neither of the others: no whole read, and only the first 40 lines (4%) read as a range.
  - Its three reads were for facts the index lacked or gave only in prose: the input presets' actions, how the pixel
    primitives fill, and what `map.bounds` returns. The last is answered now (lookup 26).
  - So by the plan's own rule the split (option C) is open again. The evidence points to index content rather than a
    split, and it is one run.
  - The owner decides. Nothing is split until then.
- **What would change it:** the owner's answer on the split; a second run that reads the index whole or pages through
  it; the index past 38,000 tokens; the lookup check unable to keep its lookups answered.
- **Answered:** the plan's decisions, yes (D38). The split's reopening goes to the owner with this pull request.
- **Answered since:** the owner kept the index whole and asked for the gaps filled (2026-10-15, D43).
- **Landed in:** v0.43.3

## D43 · 2026-10-15 · The API index stays whole; the split reopens only on two runs in a row

- **Principle:** 1 (agent-readable: an agent finds a name in one search of one file), and process (a rule that acts on one
  run acts on noise)
- **Call:** the owner's answer to D42: the index is not split. The run's three reads of the source are answered in the
  index instead, and the rule is tightened.
  - Two of them were facts the index held, but not where the agent looked:
    - The pixel primitives were listed as `E.px.disc`, and the agent searched `^- \`px\.disc`, as games write them
      (the card's first line is `const E = My3D2dge, { px, clamp } = E`; the repository writes `px.` 2,679 times and
      `E.px.` 3). The index lists `px`'s members as `px.disc` now (lookup 27).
    - The third-person preset's actions were in prose ("Shift sprint, ... E interact"). A key map among a class's
      statics names its own actions now, from the code (`E.Input.THIRDPERSON { sprint, jump, crouch, ... }`), and
      `input.use` names the presets and the actions every one has (lookup 28).
  - The third, what `map.bounds` returns, was answered in v0.43.2 (lookup 26).
  - A run that reads the index whole, covers most of it in ranges, or follows more than a third of its searches with a
    read of the source now *trips* the split rule (the benchmark's row says so); two runs in a row that trip it reopen
    the split, which then goes to the owner as D42 did.
- **Why:** the run met the rule's third trigger by one search (3 of 8 against a third), never read the index whole and
  read 4% of it as a range: the failures a split fixes didn't happen. A split answered no more lookups when it was
  measured (option C, D42) and made each one about 3% dearer; what was missing was content and naming, which a split
  doesn't change. It cost the index 73 tokens: 34,010 (from 33,937), with 28 of 28 lookups, 27 in one search.
- **What would change it:** two benchmark runs in a row that trip the rule; the index past 38,000 tokens; the lookup check
  unable to keep its lookups answered.
- **Answered:** yes: the owner, 2026-10-15 ("take care of the api index thing"), after the recommendation to fill the
  index and not split it
- **Landed in:** v0.43.4
