# Build progress

The canonical requirements and gates are in [design.md](../design.md). Evidence here is updated as the implementation changes.

| Gate | State | Evidence and next work |
| --- | --- | --- |
| M0 foundation | In progress | Pinned engine boots in Chromium/WebKit; 12 actual-engine integration tests pass (units, analog pad, Rapier vehicle, seats, queries, camera, fixed-step, selected mocap). Playable calibration exists; physical pad and complete browser motion inspection remain. |
| M1 district | In progress | Six authored locations, 169 fixed colliders, road/foot graphs, 10 depot cover positions and signature views render. Graph clearance/drive QA is underway. |
| M2 living streets | In progress | 12 ambient raycast-wheel cars, 24 pedestrians, witness logic and three heat tiers are integrated. Traffic turn sign was corrected; long-run/escape checks remain. |
| M3 confrontation | In progress | Six role-based crew, player weapons/melee, authored cover and physical muzzle checks integrated. Both-route combat/death/retry browser evidence remains. |
| M4 complete mission | In progress | All phases, both outcomes, favor/economy and versioned saves exist. Chromium/WebKit opening through Eli/Bea, reload and Continue passes. Full-route browser playthrough remains. |
| M5 presentation | In progress | Responsive 10-foot UI, local OFL fonts, procedural rain/city/combat/vehicle audio and selected 30-clip mocap runtime integrated. Signature/motion/audio inspection and polish remain. |
| M6 QA | In progress | Unit/typecheck/integration/build/audit pass; sequential browser E2E and viewport matrix underway. Physical controller, full route, endurance and measured hardware FPS remain. |
| M7 delivery | Open | Engine feedback, fresh-checkout verification and public GitHub publication follow verified build. |

No S01–S15 item is fully certified yet. Passing domain/adapter tests do not prove the complete route, presentation or physical-controller path.

