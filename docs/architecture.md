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

- `core/vision/`: camera access, the worker, and the MediaPipe wrapper. The model (`.task`) and the wasm files are served from `public/models/`, never from a CDN.
- `core/signals/`: the signal detector, the calibration profile and the thresholds.
- `core/input/`: the signal-to-action mapping and the input modes.
- `core/counting/`: the counting state machine (mode B); `core/scanning/` (mode A) after the PoC.
- `core/boards/`: the board model, the import validator, the built-in and imported boards (localStorage).
- `core/speech/`: the Speaker interface and the Web Speech implementation (on-device voices only).
- `core/i18n/`: Transloco (en, pl).
- `core/settings/`, `core/history/`, `core/storage/`: settings, the sentence history, storage that may fail.
- `features/counting`, `features/sentences`, `features/boards`, `features/settings`; `features/calibrate` in stage 4.

# Storage

Everything stays on the device:

- localStorage (spec 007): the settings, the imported boards and the active board, the sentence history, under
  versioned keys (`blinker.*.v1`); every value is validated when read back, and the app keeps working in memory
  when the storage is blocked or full;
- IndexedDB later, if calibration profiles or many boards outgrow localStorage.

There are no cookies, no server state and no telemetry.

# Deployment

- A static build, served over HTTPS (the camera only works over HTTPS).
- The host must be able to set security headers (see [ADR-0003](adr/0003-static-hosting.md)).
- Installable as a PWA, with a service worker for offline use.
