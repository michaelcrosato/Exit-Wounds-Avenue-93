# Release reproduction — Exit Wounds Avenue-93

V10 is verified against the **published commit**, not a dirty source tree. Record the commit, machine/browser details, command results, packaged load and any limits below after the final push. The source contracts are [design.md](../design.md) and the authoritative status is [TEST-REPORT.md](TEST-REPORT.md).

## Fresh-checkout procedure

From outside the working tree, clone the public repository into a new directory. Use Node.js 22 or newer with Playwright's Chromium, Firefox and WebKit browser binaries installed. On the project WSL machine, keep `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64`; do not run `playwright install-deps` on Ubuntu 26.04.

```bash
git clone --depth 1 https://github.com/michaelcrosato/Exit-Wounds-Avenue-93.git exit-wounds-release-check
cd exit-wounds-release-check
# Force the test servers to serve this checkout, even if the parent shell used another workspace.
unset EWA93_BASE_URL EWA93_RELEASE_URL
git rev-parse HEAD
npm ci
npm run typecheck
npm run test:unit
npm run audit:assets
npm run build
```

Then run browser-backed checks one process at a time. The `unset` above ensures source and release smoke start servers from the clone instead of following inherited URLs to the development workspace; verify the reported server roots and `pwd` if any override is deliberately used. The full 11-scenario late-persistence command took about 11 minutes in the earlier WSL software-rendered run; these three groups keep each process shorter. Node 22 accepts `--test-name-pattern` before the test file. Use distinct output directories so each group's `report.json` survives, and verify that their passing records cover all 11 scenario names exactly once.

```bash
npm run test:integration
export EWA93_PERSISTENCE_ENGINE=chromium
EWA93_PERSISTENCE_OUTPUT=/tmp/ewa93-v10-late-a node --test --test-concurrency=1 --test-name-pattern='actual reload|seated Mara and Jun reconstruct|seat-transition' tests/integration/late-persistence.test.mjs
EWA93_PERSISTENCE_OUTPUT=/tmp/ewa93-v10-late-b node --test --test-concurrency=1 --test-name-pattern='interrupted civilian|earned favor|retry revives|in-session retry' tests/integration/late-persistence.test.mjs
EWA93_PERSISTENCE_OUTPUT=/tmp/ewa93-v10-late-c node --test --test-concurrency=1 --test-name-pattern='both choices|corrupt primary|storage write denial|browser storage denied' tests/integration/late-persistence.test.mjs
npm run test:e2e
npm run test:e2e:release
npm run preview
```

Keep browser jobs serial on the WSL software-rendered machine: core integration, late groups A/B/C, source opening smoke, packaged three-engine release smoke, then the packaged preview's Lighthouse run and viewport matrix. The preview server may stay up for the last two checks; do not overlap their browser processes. Inspect matrix PNGs, including small phone, tablet, wide desktop and WebKit views. Final-source active-state screenshots now cover gameplay, pause, phone, choice, retry, ending and credits; inspect any final-commit packaged recaptures separately because a title matrix alone does not check those states.

Open `http://127.0.0.1:4173/` from the packaged preview. Check title, New Game, gameplay movement, menus and Credits/About source information. The packaged release test exercises that public UI in Chromium, Firefox and WebKit and rejects browser/network errors and an exposed diagnostic hook. If port 4173 is occupied, run `node tools/serve.mjs --root dist --port 4174` instead; the `preview` script has 4173 baked into its arguments.

Compare the fresh checkout's `git rev-parse HEAD` with `git ls-remote origin refs/heads/main` and the verified local commit. Check the remote with `gh repo view michaelcrosato/Exit-Wounds-Avenue-93 --json nameWithOwner,visibility,url`. Run Lighthouse against the packaged preview and record its cold-title and transfer measurements separately from gameplay FPS. Inspect the generated `dist/` for local runtime resources and the credits' source block. Do not treat WebKit iPhone emulation as real iOS Safari or Gamepad API emulation as a physical controller test.

## Pre-commit results on the final source

These results are for the working-tree package and source before the final push. They do **not** establish the published commit or fresh-checkout result.

| Check | Observed result | Portable evidence |
| --- | --- | --- |
| Stripped `dist` public UI smoke | Chromium, WebKit and Firefox **3/3 passed**; title, gameplay movement, phone and credits/source information reached, no page/network errors or development hook. | [release-cross-browser.json](evidence/release-cross-browser.json) |
| Active responsive source views | **24/24** captures: 12 Chromium and 12 WebKit across 375×667 phone, 756×352 landscape, 768×1024 tablet and 2560×1080 ultrawide, in gameplay/phone/pause; no overflow, subtitle overlap or errors. | [responsive-active-final.json](evidence/responsive-active-final.json) |
| WebKit active state matrix | **28/28** captures: gameplay, phone, pause, decision, retry, ending and credits at four sizes; representative frames inspected. | [webkit-active-layouts-final.json](evidence/webkit-active-layouts-final.json), [phone decision](evidence/webkit-phone-decision.webp), [landscape retry](evidence/webkit-landscape-retry.webp), [phone ending](evidence/webkit-phone-ending.webp) |
| Title viewport matrix | `viewport-matrix --all-engines`: 37 clean of 42, with five Chromium SwiftShader screenshot timeouts under parallel load. Sequential DPR1 Playwright retests at those exact sizes all passed with no overflow/browser errors; representative PNGs inspected. | [viewport-final.json](evidence/viewport-final.json) |
| Packaged Lighthouse | WSL Chromium 153/SwiftShader desktop/mobile performance **0.29/0.25**; accessibility, best practices and SEO **1.00** in both. Both runs warn that loading exceeded the time limit and metrics may be incomplete. | [lighthouse-final.json](evidence/lighthouse-final.json) |

The 1080p High 60 FPS samples on Windows Chrome 155/RTX 3060 Ti are separate hardware observations in [TEST-REPORT.md](TEST-REPORT.md). A later [owned-process title check](TITLE-COLD-HARDWARE.md) on published e6 spawned a new Chrome process and empty profile: spawn→enabled title **2.339 s**, meeting the 10 s target once. An earlier fresh context in an already-running Chrome took **11.754 s** under different load, so repeatable cold-load performance is unproved. Lighthouse's low WSL software-renderer score cannot be substituted for gameplay FPS.

## Final result

At the full code/package verification, public `main` commit **`e6cd7524f8f1552be87aa20226848641bd1d0fd3`** matched the local commit and a new public clone at `/tmp/ewa93-public-v10-P7700k/repo`. The clone was clean after testing. Its preview server reported that directory's `dist/` as its root; `EWA93_BASE_URL` and `EWA93_RELEASE_URL` were unset, so test servers were clone-local. See the compact [machine-readable result](evidence/release-fresh-clone.json); raw reports and PNGs remain under `/tmp/ewa93-public-v10-P7700k/`.

On Ubuntu 26.04.1 WSL2 with Node 22.23.3, npm 12.2.0 and Playwright 1.63.0, `npm ci`, typecheck, **44/44 unit**, **19/19 core integration**, **11/11 late-persistence** across groups A/B/C, **3/3 opening** (Chromium opening, WebKit opening, WebKit required-asset recovery), **3/3 stripped packaged-release** (Chromium, WebKit, Firefox), the 15-entry asset audit and build passed. Browser versions were Chromium 153.0.8010.12, WebKit 26.6 and Firefox 155.0. The build contains 136 files totaling **9,179,349 file bytes** (8.75 MiB); individually gzipping those files would total 2,672,075 bytes, but the local preview did not enable compression. The packaged Chromium cold title fetched **5,255,248 response-body bytes** over 50 local requests, with no failed requests or browser errors. Credits displayed the required source block and the release exposed no diagnostic hook.

The packaged preview's title appeared in **16.5 seconds on WSL SwiftShader**. The three-engine release smoke recorded 16.1 seconds in Chromium, 7.7 in WebKit and 5.1 in Firefox. The desktop Lighthouse 13.5 audit scored **28 performance, 100 accessibility, 100 best practices and 100 SEO**; it warned that the page loaded too slowly to finish within its time limit. Its 38.4-second total blocking time and these title results describe software-rendered WSL, not the named hardware GPU result. The 10-second target was not met in WSL Chromium; the separate process-cold Windows GPU run met it once.

The packaged viewport matrix produced **22 clean captures** across phone, foldable, tablet and desktop sizes. Its 1366×768 and 1920×1080 Chromium screenshots timed out at 30 seconds while six contexts ran concurrently; both exact sizes passed serial retests in 2.0 and 3.1 seconds with no overflow, page/console errors or failed requests. I inspected representative iPhone SE and short-landscape WebKit, iPad Mini WebKit, Galaxy Tab S9 Chromium, 21:9 WebKit and both serial Chromium frames. On the 756×352 WebKit landscape profile, the title menu scrolls vertically; keyboard focus brings Settings into view and Credits opens. Real iOS Safari and a physical controller remain outside this test environment.

The later [Windows process-cold title record](evidence/title-cold-hardware.json) used published e6 code, a new Chrome 155 process/profile at default High on RTX 3060 Ti/WebGPU, and a Settings round trip. Process spawn→enabled title took **2,339 ms**, navigation→title **2,051 ms**, with 51 local responses/5,268,512 encoded transfer bytes and no browser/network error. The owned process and port closed. This one run met ≤10 s, while the earlier 11,754 ms existing-process fresh-context result remains; OS cache/server may have been warm, so no guaranteed load-time distribution is claimed.

This V10 reproduction certifies the **e6** runtime/code package only. Published **`e6426f64a18dcb9ae77e324e0c37b480afce84b6`** subsequently changed app Rapier body lifecycle and Three r182 shadow-quality behavior. Its local typecheck, 46 unit, 21 core integration, 15-entry audit/build, WebGL2/WebGPU source quality checks and virtual-controller route pass; e642 fresh-clone install/tests, stripped-package quality switching, preview and remote equality must be recorded separately before assigning V10 to that revision. [ENGINE-PATCHES.md](ENGINE-PATCHES.md) and [SHADOW-QUALITY-TOGGLE.md](SHADOW-QUALITY-TOGGLE.md) describe the fixes.
