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
  `ambient-car-0`, and the pending theft queue drained. Waiting/parked cars use
  the handbrake because the shared brake control intentionally becomes reverse
  near a standstill.
- Seven inspected diagnostic images: `/tmp/ewa93-world-garage.png`,
  `/tmp/ewa93-world-market.png`, `/tmp/ewa93-world-depot.png`,
  `/tmp/ewa93-world-junction.png`, `/tmp/ewa93-world-waterfront.png`,
  `/tmp/ewa93-world-garage-interior.png`, `/tmp/ewa93-world-depot-interior.png`.
  Interior ceilings and lamp levels were corrected after those draft captures;
  current game captures should be used for the shipping visual audit.

These checks do not establish a full controller playthrough, pacing, audiovisual
mix approval, 30-minute endurance, or hardware-accelerated frame-rate targets.
