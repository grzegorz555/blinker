---
type: Architecture
title: Blinker architecture
description: Modules, data flow from camera to speech, storage, and how the PWA is deployed.
tags: [engineering, architecture]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-10
---

# Data flow

```
camera (getUserMedia)
  → FaceTracker      [Web Worker, MediaPipe Face Landmarker: blendshapes and head pose for each frame]
  → SignalDetector   [thresholds and timing from calibration → LONG_BLINK, HEAD_NOD, LOOK_AT_HAND ...]
  → InputController  [maps signals to actions, based on the current mode and the settings]
  → ScanStateMachine / CountingMachine  [pure TypeScript, no Angular: board position → selected cell]
  → TextBuffer       [the sentence and its undo history]
  → Speech           [Web Speech API, pl-PL / en-US]
```

Keyboard and switch input join the flow at the level of the `SignalDetector` output, as `SWITCH` signals and test
signals. That way all the logic can be tested without a camera.

# Current structure (`src/web`, spec 001)

```
src/web/
  src/app/
    app.ts|html|css        shell: top app bar (page heading, skip link, page actions), main (the only scroll area), navigation
    app.config.ts          router, HttpClient, Transloco, TranslatedTitleStrategy, language initializer, service worker
    app.routes.ts          lazy routes; `title` is a translation key
    core/i18n/             languages.ts (pure resolveLanguage), LanguageService, TranslocoHttpLoader, TranslatedTitleStrategy
    core/boards/           board.ts (format v1), validate-board.ts (imported files are untrusted input)  (spec 006)
    core/sentence/         sentence.ts (the text with undo of every step this session made)
    core/counting/         counting.ts (the counting state machine: pure, every state × signal explicit, taps as TOUCH, time from TICK),
                           counting.service.ts (Angular: state in a signal, one TICK scheduler, effects to the speaker)
    core/input/            signals.ts (one input type for every source), keyboard.ts (off by default, SC 2.1.4)
    core/speech/           speaker.ts (interface), web-speaker.ts (on-device voices only), fake-speaker.ts (tests)
    core/boards/boards.service.ts   built-in and imported boards, the active board  (spec 007)
    core/settings/         settings.ts (defaults, validator), SettingsService (applies and stores them)
    core/history/          history.ts (cap, days), HistoryService (sentences read aloud)
    core/storage/          local-store.ts (localStorage that may throw; values validated when read back)
    core/screen/           wake-lock.ts (screen on while Liczenie (Counting) is visible)
    shell/                 nav.ts (M3 navigation bar and rail), top-bar.ts (page actions through a CDK portal)
    features/counting/     the Liczenie (Counting) screen, board-view, signal-panel
    features/sentences/, features/boards/, features/settings/, features/not-found/
    shared/confirm-dialog/ (MatDialog, Cancel first), shared/language-switch/
  src/material.scss        Angular Material (M3) theme mapped to tokens.css (ADR-0005)
  src/styles/tokens.css    design tokens (OKLCH, light/dark, contrast noted)
  src/testing/             test helpers (translocoTesting with the real en/pl files)
  public/i18n/{en,pl}.json, public/boards/friend-pl.json, public/manifest.webmanifest, public/icons/
  e2e/                     Playwright specs (*.e2e.ts), support/ (axe helper, third-party request check), serve-dist.mjs
  scripts/                 generate-icons.mjs (icons from the tokens); theme-color.mjs (theme-color = --bg); verify.mjs (every gate, CI order); check-dist.mjs; lighthouse.mjs +
                           lighthouse-lang.mjs (Lighthouse CI en/pl + language guard); *.test.mjs (node --test)
  ngsw-config.json, eslint.config.js, playwright.config.ts, lighthouserc.cjs
.githooks/pre-push         runs npm run verify -- --quick (enable with npm run hooks:install)
.github/workflows/ci.yml   docs, secrets (gitleaks), vulnerabilities (OSV-Scanner), web (npm run verify), lighthouse,
                           deploy-preview (PR) / deploy-production (main), both after every gate (spec 003)
.github/workflows/preview-close.yml   removes the PR preview on Azure when the PR closes
```

E2E tests run against the **production build** served by `e2e/serve-dist.mjs`, not against the dev server.
This way the service worker, hashing and the absence of source maps are tested as they will be deployed.
`npm run verify` is the single definition of "green": the CI `web` job runs all of it, and the pre-push hook runs its fast part (`--quick`, spec 005).

# Modules (`src/web/src/app`; boards, sentence, counting, input and speech exist since spec 006)

The core is plain TypeScript with no Angular imports and no clock (a lint rule enforces it); a thin Angular service
wraps it. Data flow without a camera: a button or a key → `InputSignal` → `CountingService.send()` → `next(state,
signal)` → effects (the text for the screen and the live region, `Speaker.say()`). A tap on a cell or a sentence
action is the `TOUCH` signal (`CountingService.touch()`, spec 007), so every change of the text goes through the
machine. Stage 4 adds his face signals as one more source of `InputSignal`.

- `core/vision/camera-input.service.ts` (spec 012): frames → detector → the same sink as the buttons; the face-in-view
  status with a 1.5 s grace. `core/sound/cue.ts`: a tone per signal with the Web Audio API (no audio files).
  Liczenie (Counting) provides the tracker, so the camera lives exactly as long as the screen; the video plays inside
  the camera chip in the top bar.
- `core/signals/` (spec 011): `detector.ts` (a pure detector of his five face signals), `profile.ts` and
  `ProfileService` (his thresholds, `blinker.profile.v1`, validated when read back), `fit.ts` (the profile from
  calibration recordings), `synthetic.ts` (recordings for tests only).
- `core/vision/` (spec 010): `FaceTrackerService` (camera, one frame in flight to the worker), `face.worker.ts` (MediaPipe Face Landmarker, GPU or CPU; a fetch guard refuses every other origin), and pure functions: `head-pose` (angles from the transform matrix), `face-frame` (the values stage 4 needs), `frame-stats`. The model is served from `/models/` (in `public/models/`, hash pinned) and the wasm from `/mediapipe/` (copied from the pinned package at build), never from a CDN (ADR-0006).
- `core/signals/`: the signal detector, the calibration profile and the thresholds.
- `core/input/`: the signal-to-action mapping and the input modes.
- `core/counting/`: the counting state machine (mode B); `core/scanning/` (mode A) after the PoC.
- `core/boards/`: the board model, the import validator, the built-in and imported boards (localStorage).
- `core/speech/`: the Speaker interface and the Web Speech implementation (on-device voices only).
- `core/i18n/`: Transloco (en, pl).
- `core/settings/`, `core/history/`, `core/storage/`: settings, the sentence history, storage that may fail; `core/storage/device-data.service.ts` is the one erase ("Usuń wszystkie dane" (Delete all data), spec 013).
- `features/counting`, `features/sentences`, `features/boards`, `features/settings`; `features/calibrate` in stage 4.

# Camera life cycle (spec 014)

`FaceTrackerService` (`core/vision/face-tracker.service.ts`) owns the camera and follows the page's visibility through
the injected document (`visibilitychange`, as `wake-lock.ts` does):

- **start** (a page opens, or the page is visible): the camera opens with the front or rear facing of the settings, and
  the face worker loads its model the first time only.
- **hidden**: a camera that is starting or running stops every track and clears the video element, so the browser's
  camera indicator goes off. The face worker and its model are kept. No frame is grabbed while hidden.
- **visible** again: a camera that the hiding stopped opens again with the same facing and video, and `resumes()`
  counts the return, so the page restarts its own state (`CameraInput` resets the detector; Kalibracja (Calibration)
  records the step under way again; Diagnostyka (Diagnostics) restarts its measurement). A camera that was off, in
  error, or stopped by the page before the hiding stays off.
- **release()** (the "Kamera" (Camera) toggle in Liczenie (Counting), "Wyłącz kamerę" (Turn off the camera) in
  Kalibracja (Calibration) and Diagnostyka (Diagnostics)): the same stop as hidden, but remembered, so a return to the
  page does not reopen the camera. **reopen()** undoes it, with the same video and facing and no model reload and no
  count in `resumes()`.
- **stop()** (leaving the page that uses the tracker): the run is forgotten, the camera and the worker end.
- A stream that arrives late for a run that was already stopped, released or hidden is closed at once. Quick changes
  of visibility end with one open stream when visible and none when hidden.
- A refused camera on return shows the error in text; there is no retry loop.

Only a person at the screen reaches `release()` and `reopen()`: no face signal and no board key does.

# Storage

Everything stays on the device:

- localStorage (spec 007): the settings, the imported boards and the active board, the sentence history, the signal
  profile (numbers only) and the language choice. Every key starts with the prefix `blinker.` (`STORAGE_PREFIX` in
  `core/storage/local-store.ts`); most keys carry a version (`blinker.settings.v1`, `blinker.boards.v1`,
  `blinker.activeBoard.v1`, `blinker.history.v1`, `blinker.profile.v1`), the language key does not
  (`blinker.language`). Every value is validated when read back, and the app keeps working in memory when the storage
  is blocked or full;
- the erase (spec 013): `DeviceDataService.eraseAll()` puts every service back to its defaults in memory, without a
  reload, and then removes every `blinker.` key from localStorage. It returns `erased` or `unavailable`. It is reached
  from Ustawienia (Settings), "Dane na tym urządzeniu" (Data on this device), after a confirmation. A new store must
  use the prefix and have a reset; a unit test fills every store, erases, and fails when a `blinker.` key is left;
- IndexedDB later, if calibration profiles or many boards outgrow localStorage.

There are no cookies, no server state and no telemetry.

# Deployment

- A static build, served over HTTPS (the camera only works over HTTPS), on Azure Static Web Apps, Free plan
  ([ADR-0003](adr/0003-static-hosting.md)). Production: https://mango-rock-0416a080f.3.azurestaticapps.net
- The headers, the SPA fallback, the 404 page and the MIME types come from `src/web/public/staticwebapp.config.json`;
  the local e2e server reads the same file (spec 003).
- CI deploys the build that passed every gate: a preview per PR (its URL commented on the PR, removed when the PR
  closes) and production on `main` (a GitHub environment `production`), each followed by the `deployed` e2e tests.
- Installable as a PWA, with a service worker for offline use.
