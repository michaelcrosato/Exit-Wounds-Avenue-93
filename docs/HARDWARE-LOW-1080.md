# 1080p Low hardware frame times

The Low target passed on Windows Chrome **155.0.8059.84**, Intel **i9-13900K** and NVIDIA **RTX 3060 Ti** with the **WebGPU** backend. Presentation and HUD were 1920×1080 at DPR 1; Low used the normal balanced 960×540 3D buffer. The separate High confirmation used a full 1920×1080 3D buffer.

**Source scope:** these measurements use the e6 runtime, before published `e6426f6` changed how Low suppresses shadow-map updates. The e642 source-browser quality-switch regression passes, but its named-hardware Low 1080p frame-time remeasurement is a separate gate; these figures are not silently transferred to the new adapter.

| Native-loop sample | Warmup | Measured interval | Average FPS | p95 / p99 | Maximum | >100 ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Low central intersection | 8 s | 480 frames / 8.0001 s | 59.9993 | 16.8 / 16.8 ms | 16.9 ms | 0 |
| Low active depot fight | 10 s | 480 frames / 7.9999 s | 60.0008 | 16.8 / 16.8 ms | 16.9 ms | 0 |
| Low nearby tier-3 pursuit | 12 s | 480 frames / 8 s | 60.0000 | 16.8 / 16.8 ms | 16.8 ms | 0 |
| Low same continuous pursuit | Continuing scene | 3,601 frames / 60.0165 s | 60.0002 | 16.8 / 16.9 ms | 17.2 ms | 0 |
| High nearby tier-3 confirmation | 12 s after quality switch | 480 frames / 8 s | 60.0000 | 16.8 / 16.8 ms | 16.8 ms | 0 |

Low meets the design target of ≥30 FPS and p95 ≤40 ms in all three scenes. The short High repeat meets the nominal 60 FPS, p95 ≤22 ms and p99 ≤50 ms targets. The 60-second sample applies to Low only.

This diagnostic uses the published runtime modules at `e6cd7524f8f1552be87aa20226848641bd1d0fd3`, served from checkout `928d93c22215636b078b0e478f2f70df34464b08`; their runtime diff is empty. The source diagnostic hook stages the player, mission, camera and existing patrol/officer positions. Depot and pursuit health/armor are boosted to keep the full hostile group alive; a future recent-gunfire timestamp keeps police in the armed-threat branch. Mara and the camera remain at the staged location while native traffic, perception, pursuit, hostile firing, collisions, hit reactions, audio and rendering continue. These samples measure a repeatable active load rather than an ordinary escape route. No engine stepping, AI suppression, arrest suppression, forced GC or app source edit is used.

All six officers remained alive and in chase at every one-second pursuit sample. During the continuous Low window they fired **339 shots**, with **225–247 draw calls** and **113,082–115,118 triangles**. The High window had **356–398 draw calls** and **189,616–193,530 triangles**. All samples retained **52 registered actors, 18 vehicles, 281 physics bodies and 298 colliders**. The active depot retained six living crew and recorded 42 shots during its measured eight seconds. All five PNGs were inspected; pursuit frames show nearby officers and cruisers.

Timing uses consecutive `requestAnimationFrame` timestamps, with mean FPS from total intervals and nearest-rank percentiles. It measures display-paced browser cadence, rather than GPU execution or scanout latency. Every sampled state remained visible, playing, unpaused and at time scale 1. This is one warm browser/hardware run; OS/GPU caches and unrelated machine work were not controlled. One pre-existing title page was left untouched. The probe's isolated context closed normally, preserving the existing Chrome process.

There were zero page, console, engine or network errors. All **60 file fingerprints** matched before/after and **51 served file bodies** matched local hashes. The [portable evidence](evidence/hardware-low-1080.json) records timings, count ranges, exact setup, browser/GPU details, source hashes and limits. Full frame intervals, one-second samples, PNGs and the hashed probe remain outside the repository under `/tmp/ewa93-hardware-low-1080-20261016/`.
