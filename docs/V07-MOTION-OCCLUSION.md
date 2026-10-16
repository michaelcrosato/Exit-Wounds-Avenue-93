# V07 focused motion and occlusion review

[The runner](../tests/e2e/v07-motion-occlusion.mjs) exercises four actual-engine scenes with explicit setup and normal keyboard or standard-mapped Gamepad API input. [Portable results](evidence/v07-motion-occlusion.json) retain the numerical checks and these inspected frames: [wall shot](evidence/v07-wall-shot.webp), [car beside Jun](evidence/v07-car-adjacent-side.webp), [mid-vault](evidence/v07-vault-mid.webp), [cover entered](evidence/v07-cover-active.webp), [cover left](evidence/v07-cover-left.webp) and [higher-speed impact](evidence/v07-impact-high.webp). The existing [blocked-door/rollover diagnostic](FAILURE-COLLISION-GAPS.md) covers near-obstruction vehicle exits and a physically caused side roll separately.

The combined final-source run **passed 4/4** in Windows Chrome `155.0.8059.84` through CDP port 9223, in its own browser context. It took about **15.1 wall seconds**, used Low quality and the game's fixed-step clock, and reported zero page and network errors. Before/after source fingerprints matched (`cc692c93…`). The full local report and original PNG sequence are at `C:\Temp\EWA93V07MotionFinal\`; the compact repository evidence above can travel with a fresh checkout. No app source or assets were changed to get these results.

| Focus | What actually happened |
| --- | --- |
| Wall-adjacent aim | Mara held virtual L2 and fired one normal R2 round from a camera position outside a staged brick wall. Both the camera and muzzle rays hit that physical wall. Pistol ammunition fell from 12 to 11; the guard placed behind it stayed at 65 health. The frame shows the aimed stance facing the blocking wall. |
| Moving-car adjacency | Mara drove an occupied sedan with keyboard W past a stationary, physically collidable Jun. Closest actor/car centers were **1.246 m** at **16.88 m/s**. Jun remained on foot with his body enabled, did not fall or attach to the car, and ended clear of collider overlap. A temporary diagnostic side camera captured their actual separation. |
| Vault and cover | A validated APPROACH save placed Mara outside the authored rear service barrier; unrelated crew were down in the fixture. Ordinary E started the physical vault, detached her collider and played `ClimbUp_1m_RM` midair. She landed at `(396, 88)` with her body restored, phase RECOVERY and route `service`. After normal walking, Q entered `rear-cabinet` cover and Q left it; body ownership and controls remained valid. The three retained frames show the transition and both cover states. |
| Varied impact speed | The same sedan struck the same test-only fixed barrier under ordinary virtual R2 throttle. Starting 15 m away produced **10.27 m/s** peak speed and **25.46** vehicle damage; starting 35 m away produced **15.87 m/s** and **44.25** damage. Both emitted actual `VehicleImpact` events, kept Mara in the driver seat and left the game playing. |

On the same final source, the existing [ramp/soft-prop runner](../tests/e2e/collision-animation.mjs) passed with 1.391 m peak car height, 17.15 m soft-cone displacement, retained driver seat and `Driving_Loop` animation; raw report: `C:\Temp\EWA93V07RampFinal\report.json`. The existing [witnessed-impact runner](../tests/e2e/witnessed-impact.mjs) passed a physical sedan impact with a visible officer report that identified the car; raw report: `C:\Temp\EWA93V07ImpactSedanFinal\report.json`. Those two earlier scripts do not have the new runner's source-fingerprint field, so their results remain separately attributed.

## Reproduction and limits

Serve this workspace at `http://127.0.0.1:5173`, then run the source-build diagnostic. It requires the development read hook; the packaged release deliberately removes it. On WSL, keep the machine's Playwright host override and use one gameplay browser job at a time:

```bash
npm run dev -- --host 127.0.0.1 --port 5173
PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 \
  node --test --test-concurrency=1 tests/e2e/v07-motion-occlusion.mjs
```

`EWA93_BASE_URL` chooses another source URL, `EWA93_V07_OUTPUT` chooses an out-of-repository evidence directory, `EWA93_V07_CASE` filters case names, and `EWA93_V07_CDP_URL` attaches to an existing Chromium CDP endpoint. The recorded hardware run used an isolated context on a Windows Chrome CDP endpoint. The runner saves its full JSON trace and PNGs under the selected output path and fails if source hashes drift during execution.

The wall and guard, car and Jun positions, impact barrier and depot APPROACH save were staged to isolate the named behaviors. The wall obstruction, shots, driving, actor collision, vault, cover and damage then used the live Rapier world and normal game input. The captures are still frames from an accelerated functional diagnostic. They do **not** establish natural traffic impacts, every obstacle pairing, a continuous motion/animation quality review, a normal mission playthrough or first-player pacing. Those remain distinct design gates.
