# Morrow Ward

The district uses positive metre coordinates: X east, Y south, Z up. The authored
land extends from (22,24) to (456,396), inside a 480 × 420 m logical level. Harbor
water begins beyond the east/south seawalls. Visible safety barriers mark that
boundary. The game owns the explicit recovery/retry action for boundary crossing.

| Place | Anchor | Real geometry |
| --- | --- | --- |
| Eli’s Motor Works | 94,306 | Furnished drive-through bay, north service lane, south apron, office corner, workbench and hydraulic lift |
| Morrow Market | 113,216 | Two open shop counters, workwear display, covered pavement, closed neighboring storefront and a rear toolbox alley |
| Rivet Junction | 240,202 | Crossings, signals, two turns, elevated freight line and solid sight-obstructing pillars |
| Northline Dispatch | 348,124 | Open street gate, rear service vault, yard, ten cover objects, two-storey office and stairwell |
| Low Water Maintenance | 382,356 | Two road exits, container concealment, maintenance shed, reporter drop and waterfront foot return |
| Northline Loading Court | 91,88 | Enclosed court, north-loop access, loading dock and broker safe |

`createDistrict({E,world,rain,quality})` requires the real initialized E.World3D.
It adds compatible E.THREE meshes to `world.scene` and static E.RAPIER colliders
to `world.pw`; it creates no independent renderer, loop or physics world.
Engine coordinates cross the ×16 conversion once at collider placement. Instanced
meshes use Three's metre/Y-up space. Materials use the pinned node-material/TSL
pipeline, including world-space texture projection so surface scale is consistent.

The returned object includes `locations`, `interactables`, `spawnPoints`,
`roadGraph`, `footGraph`, `cover`, `obstacles`, `landmarks`, `interiorVolumes`,
`signatureViews` and the district root group. `update(dt,focusInMetres)` moves the
local rain field, suppresses it indoors and selects four nearby practical lights.
Interior ceilings remain visible and the collision camera handles their clearance.
`surfaceAt`, `contains`, `isWater`, `path`
and `nearestNode` support gameplay. `setEnding('broker'|'reporter'|null)` changes
the already closed market storefront/notice; services remain usable. `dispose()`
removes owned scene resources and physics bodies.

Cover entries expose both compact fields (`h`, `normal:{x,y}`) and integration
aliases (`height`, `normalX`, `normalY`, `flank`). Each has two usable adjacent
positions. Foot-graph edges identify the rear vault and office stairs with
`action`; ordinary edges are clear passages. The rear interaction has both landing
points, (396,88) and (404,88), for entry or extraction.

The street graph contains three cross-streets and three north/south routes,
connected western/eastern loops, the garage service lane, depot front access,
loading court and waterfront return. Traffic follows rounded right-hand lane
points derived from those routes. `TrafficSystem` supplies controls to the same
Rapier VehicleSystem as the player's car before its one physics step; signals,
intersection reservations, nearby vehicles and crossing pedestrians influence
speed. Stalled cars reverse physically rather than teleport. Civilian drivers
leave through the shared seat/door transition when their car is taken.

`PedestrianSystem` creates 24 engine actors with six outfit palettes. Residents
walk, wait, yield at crossings, flee visible/audible danger and call about crimes
they can see. Identification takes 0.8 s of continuous sight; merely recording a
hidden crime creates no civilian report. Police reporting and the report timer
remain owned by the crime system. Both ambient systems implement
`snapshot()`, `restore(snapshot)` and `reset()`. Restore vehicles first with
traffic driver actors in its actor map, then restore traffic records.

World checks performed during implementation use actual engine colliders in
Chromium, after one physics step updates Rapier's query structures. The geometry
review includes every ordinary foot edge and road edge, followed by character-
radius/vehicle-radius sweeps. Vault/stair action edges require their traversal
behavior and are checked separately by game integration. World-only static
screenshots are stored outside the repository at `/tmp/ewa93-world-*.png`; they
are diagnostic signature compositions, not evidence of a full mission playthrough.

Implementation verification on 2026-10-16:

- `npm run typecheck` passes after the final world changes.
- Chromium and WebKit boot without world errors. After a physics step, every
  ordinary foot edge clears a 0.3 m sphere sweep and every road edge clears a
  0.85 m sphere sweep against fixed geometry. Stair/vault edges are explicitly
  marked and excluded from that straight-line check.
- A 90 s synchronous simulation using the game's actual updates and Rapier wheel
  controls follows the district's rounded corners. This caught and led to the
  engine adapter's positive-steering regression test; the corrected adapter is
  required.
- A separate 90 s simulation put a parked sedan across the westbound garage lane.
  Ambient car 2 waited, physically detoured around it and reached x62.73 (past the
  obstruction at x94). All 12 ambient cars retained 100 health in that run. No
  position teleport or vehicle replacement was used.
- A nearby crime behind the depot office wall produced zero civilian reports;
  an unobstructed crime with continuous sight produced one. A pedestrian
  snapshot/restore round trip matched exactly.
- The taking sequence from a stationary occupied ambient car completed through
  the actual shared exit/entry transitions: the former driver fled, Mara occupied
  `ambient-car-0`, and the pending theft queue drained. Later police QA found
  that parked cruisers reversed under a plain brake command; the shared vehicle
  adapter now requires an explicit reverse intent from player/traffic controls.
- Seven inspected diagnostic images: `/tmp/ewa93-world-garage.png`,
  `/tmp/ewa93-world-market.png`, `/tmp/ewa93-world-depot.png`,
  `/tmp/ewa93-world-junction.png`, `/tmp/ewa93-world-waterfront.png`,
  `/tmp/ewa93-world-garage-interior.png`, `/tmp/ewa93-world-depot-interior.png`.
  Interior ceilings and lamp levels were corrected after those draft captures;
  current game captures should be used for the shipping visual audit.

These checks do not establish a full controller playthrough, pacing, audiovisual
mix approval, 30-minute endurance, or hardware-accelerated frame-rate targets.

## M5 world art pass — 2026-10-16

Garage perimeter work areas now include stocked steel racks, a rebuild bench and
engine block, rolling tool chest, compressor/hose, service terminal and paperwork
board. Roof girders, lower wall paint, conduits, bay lines, worn floor stencils and
localized oil/water marks establish its working scale while the central vehicle
lane stays clear. Repair pricing and the return-to-service direction have matching
world signs.

The depot office has glazed records/staff divisions around the open extraction
aisle, dispatch consoles, filing cabinets, seated workstations, staff table and
kitchenette. The records cabinet has a visible contact wire and green armed/red
alarm indicator linked to case recovery. Lamps are selected for the occupied
floor and use their authored reach. Market counters have smaller food portions,
workwear vest silhouettes, counter labels and practical strip lights. Junction
drains/pillar paint, dock tools/mooring gear and courier-bay details distinguish
the other signature views. The rear vault and extraction van bay were unchanged.

An optional inspection lane at x120 joins the y270 garage service lane to Foundry
Road at y332. Its 4.4 m-wide inspection deck is 0.65 m high, with 10 m approach
slopes at y291–301 and y309–319. It is real convex Rapier geometry, with a separate
level deck, rather than steps drawn as a ramp. The returned road graph includes
the lane and marks ramp edges. Metadata is available through
`district.features.inspectionRamp`; `district.features.softProps` identifies two
0.7 kg plastic cones with actual dynamic collision and synchronized meshes.

Current evidence is in `/tmp/ewa93-qa/world-m5-art/`:

- `browser-report.json`: full E.World3D in Chromium/WebGL 2, zero console/page
  errors, zero blocked ordinary foot edges with 0.3 m sweeps and road edges with
  0.85 m sweeps. The district has 208 static colliders, two dynamic cones, 30
  instance batches, 6,607 primitive instances and 53 signs.
- `cpu-geometry-ramp.json`: pinned Rapier/vehicle-adapter preflight. Floor samples
  measure 0, 0.325, 0.65, 0.325 and 0 m across the inspection lane. Sedan and van
  traverse northbound; the cruiser traverses southbound. All finish with 100
  health and remain enabled. Cones move physically when struck.
- Inspected corrected signature frames: `garage.png`, `market.png`, `depot.png`,
  `junction.png`, `waterfront.png`.
- Inspected interior/interaction frames: `garage-interior.png`,
  `depot-interior.png`, `payroll-cabinet.png`, `payroll-cabinet-open.png`,
  `inspection-ramp.png`.
- `npm run typecheck` passes after the final source freeze.

The browser capture used headless ANGLE SwiftShader. Its 243–631 calls and
158–271k rendered triangles are useful scene-cost observations; software RAF
intervals were often 250–500 ms and do not establish the hardware target. Final
hardware measurements belong to the integrated test report. All added art is
procedural source in `district.js` (about 65 KB total); no external art files or
runtime network requests were added. These pictures are visual diagnostics,
separate from controller/keyboard mission acceptance.

An additional full-game, standard-pad diagnostic drove all three playable
vehicles northbound from the same (120,327) start through the inspection ramp
and two soft cones at R2=0.72. Each retained the driver, finished with 100
health, rose to approximately 1.38–1.41 m chassis height on the deck, and
ended in `Driving_Loop`. The sedan reached the north exit in 4.92 simulated
seconds at a 13.55 m/s peak; the heavier van took 5.82 s at 11.27 m/s; the
cruiser took 4.47 s at 14.74 m/s. The cones moved 5.4–35.7 m depending on
impact. The compact [comparison report](evidence/vehicle-comparison.json) and
raw `/mnt/c/Temp/EWA93Compare{Sedan,Van,Cruiser}/` reports retain the exact
samples. This is staged, accelerated physics/presentation evidence; it does
not substitute for a continuous ordinary-input mission drive.
