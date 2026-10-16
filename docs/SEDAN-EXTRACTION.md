# Sedan passenger extraction

The focused sedan route **passed** on 2026-10-16 in Windows Chrome 155 through the hardware-backed CDP endpoint. Its raw report, eight numbered screenshots and browser storage snapshots are in `/mnt/c/Temp/EWA93SedanFinalPass/`. The report has zero page/console errors, zero trusted keyboard/mouse/touch inputs and matching before/after hashes for all six tracked source files.

This is a **checkpoint replay**, not a cold-title completion. The starting `03-bea-market.storage.json` was recorded by the separate final cold controller route and contains a normal APPROACH save: Mara at Bea, Jun and the case untouched, and the original sedan at Eli’s garage (`99.51, 325.65`). The diagnostic loaded that saved run, bought armor, walked back to the sedan, drove it over the authored roads to the depot (`348.44, 148.70`), exited, committed the gate, fought through the office, reached Jun and opened the case using a standard-mapped virtual DualSense through `navigator.getGamepads()` and the engine poller. It then led Jun to the parked sedan. The phase was still EXTRACTION and `junExtracted=false` before boarding. Jun completed the actual passenger transition; the occupied seats became `['mara','jun']` and the phase advanced to EVASION. Mara then reversed the occupied sedan through the open gate to (`353.42, 196.98`), **48.54 m** from the boarding position, with 100 vehicle health and Jun still in the passenger seat. No actor or vehicle transform, health, mission event or phase was injected.

The runner uses accelerated fixed steps to advance the live browser game. It establishes functional Gamepad API input, actual Rapier vehicle movement, real passenger seating and the mission transition. It does not establish physical-controller feel or first-player pacing. The final saved origin is `http://127.0.0.1:5173`; an `EWA93_BASE_URL` override must retain the supplied save's origin. The passing run used:

```powershell
$env:EWA93_SEDAN_STORAGE = 'C:\Temp\EWA93ControllerFinal\03-bea-market.storage.json'
$env:EWA93_SEDAN_CDP_URL = 'http://127.0.0.1:9223'
$env:EWA93_SEDAN_OUTPUT = 'C:\Temp\EWA93SedanFinalPass'
& 'C:\Program Files\nodejs\node.exe' '\\wsl.localhost\Ubuntu\home\micha\dev\gta4-gpt6a\tests\e2e\sedan-extraction.mjs'
```

The first full attempt in `/mnt/c/Temp/EWA93SedanFinal/` correctly reached Jun’s passenger entry, but a speed-limited reverse controller was pushed north by the approaching tier-2 cruiser and eventually blocked. A replay from its real post-boarding save at `/mnt/c/Temp/EWA93SedanPIDReplay/` captured the collision: the cruiser came up the access lane, hit the sedan around y157, lowered vehicle health to 95.5 and imposed forward speed while L2 was braking. The neutral-steering, continuous L2 reverse test in `/mnt/c/Temp/EWA93SedanDepartureRetry/` passed; the final full replay above independently repeated that result. These raw failures remain available for diagnosis. For departure-only calibration, pass the first attempt’s `07-jun-boards-sedan-evasion.storage.json` through `EWA93_SEDAN_STORAGE`; the script labels that mode as a real post-boarding checkpoint. `EWA93_SEDAN_PROBE=1` records a short reverse-motion trace without claiming a passed extraction.

The final report records stable SHA-256 hashes including `src/main.js` `2203654f3e716babe094d7baac02e431c34bf90de278fb3d21900f8341debd6c`, `src/engine/vehicles.js` `f7f18b80301e13645b356d47a61799a6816780d160cf10012951ae299007718b`, and the tested `tests/e2e/sedan-extraction.mjs` `9f35d4ae52a0931bd5e2d52ed1c910b76de8fccca41556080a7257afb88a5804`.
