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

The 1080p High 60 FPS samples on Windows Chrome 155/RTX 3060 Ti and its **11.754-second** fresh-context title-ready measurement are separate hardware observations in [TEST-REPORT.md](TEST-REPORT.md). The latter exceeds the 10-second target; the browser process was warm, and a process-cold timing is unmeasured. Lighthouse's low WSL software-renderer score cannot be substituted for gameplay FPS.

## Final result

Pending final commit, push and **fresh-checkout** execution. Record the immutable commit, Node/npm/browser versions, test totals, build size, preview outcome, remote equality and any failures here, then reconcile [TEST-REPORT.md](TEST-REPORT.md) and [PROGRESS.md](PROGRESS.md).
