# Objective audio settings verification

`tests/e2e/audio-volume-matrix.mjs` checks the S13 mix settings through the normal settings menus. It changes sliders with keyboard focus, Home/End and arrow keys, using no application setters, direct gain writes, saved-state fixtures or simulation-clock shortcuts.

```bash
node tests/e2e/audio-volume-matrix.mjs --plan
EWA93_AUDIO_MATRIX_OUTPUT=/tmp/ewa93-audio-volume-matrix node tests/e2e/audio-volume-matrix.mjs
```

The plan command validates the 27 distinct combinations without starting a browser. The live check needs the game server at `http://127.0.0.1:5173`; set `EWA93_BASE_URL` to use another address. `EWA93_AUDIO_MATRIX_ENGINE` accepts `chromium`, `firefox` or `webkit`, with Chromium as the default. Other engines require their own recorded pass. On WSL, retain `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64` and coordinate the software-rendered browser slot.

The check covers:

- Every combination of master, music/radio and dialogue at 0%, 50% and 100%. After the initial row, each matrix transition changes exactly one control.
- Actual native `AudioParam.setTargetAtTime` requests, settled gain values and the master/effects/music/dialogue bus connections. Passive observers call the original browser methods unchanged. The test waits for audio time and measured parameters to settle instead of treating a settings object as output evidence.
- Actual master output through an analyser tee. Master mute must reduce the measured mix to near silence; nonzero master settings must retain the live city ambience. The tee adds only a measurement branch and does not replace the audible destination or set game gains.
- Three distinct settings configurations across real document reloads: `(0, 0.5, 1)`, `(0.5, 1, 0)` and `(1, 0, 0.5)`. These cover every level and each mute independently after reload, including reconstructed native gain targets.
- Subtitle sizes 80%, 100% and 140%, applied through settings and measured on an actual Eli call. Captions must remain visible when master or dialogue is muted; HUD scaling remains independent. A final reload checks subtitle-size persistence and actual typography again. Normal radio and Eli cue sources must connect to the music and dialogue buses.

One `report.json` is written under the output directory. It includes the matrix, reload observations, actual gain targets/values, output RMS, subtitle measurements, source hashes and browser errors. A failure also retains `failure.png`. No output recording is needed for this settings check; existing `audio-mix.mjs` and `footstep-audio.mjs` cover separate generated-cue captures.

This is objective settings and signal-path evidence. It does not assess speech intelligibility, subjective mix quality, speaker/headphone listening or operating-system output volume. It does not by itself complete all S13 listening acceptance.

The [recorded matrix](evidence/audio-volume-matrix.json) passed against source commit `928d93c` (the same audio/settings runtime as published e6) in Chromium 153.0.8010.12 on WSL, at 1280×720 with a 44.1 kHz AudioContext. All 27 combinations, three independent reload configurations and eight objective checks passed with zero browser errors. The checked audio/UI/settings/runner source hashes remained unchanged. The later e642 body-lifecycle/shadow patch does not alter the audio mixer; a separate full-source rerun is not inferred from this record.

Master mute measured zero RMS and peak across all nine muted combinations. Mean measured output RMS was approximately 0.007514 at master 50% and 0.015104 at 100%. Actual subtitle font sizes were 21.504, 26.88 and 37.632 px at 80%, 100% and 140%, with HUD scale unchanged at 100%; the 140% setting and typography survived a further reload. Captions remained present with master or dialogue muted, and normal radio/Eli cue connections were observed on their separate buses.

The passing run took 387.724 wall seconds, using normal UI input and browser/audio time. Its full 56.6 KB report is retained at `/tmp/ewa93-audio-volume-matrix-928d93c-final/report.json`; the portable record includes its SHA-256. The pass produced parameter/RMS observations only, with no screenshot or audio recording. The initial attempt encountered a stopped default server before exercising settings; the recorded pass used `EWA93_BASE_URL=http://127.0.0.1:5279` against the same workspace source.
