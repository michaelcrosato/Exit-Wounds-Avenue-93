# Windows process-cold title check

On 2026-10-16, Windows Node 24.16.0 launched a **new Chrome 155.0.8059.84 headless process** with a new profile under `C:\Temp\EWA93ColdTitleHardware`, a separate CDP port (9357), and the normal game page from the repository's local HTTP server. The existing Chrome process on port 9223 was untouched. Playwright waited until the title's **New Game** control was visible and enabled, then opened Settings and returned through the public UI. The title PNG was inspected. The source was published commit `e6cd7524f8f1552be87aa20226848641bd1d0fd3`; the tested main, CSS and manifest hashes are in the [portable result](evidence/title-cold-hardware.json).

| Wall-clock interval | Measured time |
| --- | ---: |
| Chrome process spawn → CDP ready | 242 ms |
| Chrome process spawn → page ready to navigate | 285 ms |
| Navigation start → visible, enabled title | **2,051 ms** |
| Chrome process spawn → visible, enabled title | **2,339 ms** |

This single process-cold observation **met the 10-second title target**. The game reported WebGPU; Chrome identified the NVIDIA GeForce RTX 3060 Ti with D3D11 and GPU WebGPU enabled. All 51 local responses returned without a browser or request error; their encoded transfer totaled 5,268,512 bytes. The owned Chrome process was stopped and port 9357 closed. Raw report, launch script, fresh profile and title PNG remain under `C:\Temp\EWA93ColdTitleHardware` outside the repository.

The new browser profile had no HTTP cache, but the operating-system file cache and local server may have been warm. This is one measured run, not a distribution or a gameplay FPS result. An earlier **11,754 ms** navigation-to-title result used a fresh context in an already-running Chrome process under different host load and remains evidence of timing variability. The WSL SwiftShader and Lighthouse timings are separate software-renderer measurements in [RELEASE-REPRO.md](RELEASE-REPRO.md).
