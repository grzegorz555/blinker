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
    app.ts|html            shell: skip link, header (name + language switch), main, footer disclaimer
    app.config.ts          router, HttpClient, Transloco, TranslatedTitleStrategy, language initializer, service worker
    app.routes.ts          lazy routes; `title` is a translation key
    core/i18n/             languages.ts (pure resolveLanguage), LanguageService, TranslocoHttpLoader, TranslatedTitleStrategy
    features/home/, features/not-found/
    shared/language-switch/
  src/styles/tokens.css    design tokens (OKLCH, light/dark, contrast noted)
  src/testing/             test helpers (translocoTesting with the real en/pl files)
  public/i18n/{en,pl}.json, public/manifest.webmanifest, public/icons/
  e2e/                     Playwright specs (*.e2e.ts), support/ (axe helper, third-party request check), serve-dist.mjs
  scripts/                 generate-icons.mjs; verify.mjs (every gate, CI order); check-dist.mjs; lighthouse.mjs +
                           lighthouse-lang.mjs (Lighthouse CI en/pl + language guard); *.test.mjs (node --test)
  ngsw-config.json, eslint.config.js, playwright.config.ts, lighthouserc.cjs
.githooks/pre-push         runs npm run verify -- --quick (enable with npm run hooks:install)
.github/workflows/ci.yml   docs, secrets (gitleaks), web (npm run verify), lighthouse
```
E2E tests run against the **production build** served by `e2e/serve-dist.mjs`, not against the dev server.
This way the service worker, hashing and the absence of source maps are tested as they will be deployed.
`npm run verify` is the single definition of "green": the CI `web` job runs all of it, and the pre-push hook runs its fast part (`--quick`, spec 005).

# Modules (planned, `src/web/src/app`)
- `core/vision/`: camera access, the worker, and the MediaPipe wrapper. The model (`.task`) and the wasm files are served from `public/models/`, never from a CDN.
- `core/signals/`: the signal detector, the calibration profile and the thresholds.
- `core/input/`: the signal-to-action mapping and the input modes.
- `core/scanning/`: the state machines (pure TypeScript, 100% unit-test coverage).
- `core/boards/`: the board model, the JSON Schema, the import validator and IndexedDB storage.
- `core/speech/`: the TTS wrapper.
- `core/i18n/`: Transloco (en, pl).
- `features/communicate`, `features/calibrate`, `features/boards`, `features/settings`.

# Storage
Everything stays on the device:
- IndexedDB: boards and calibration profiles;
- localStorage: small settings.

There are no cookies, no server state and no telemetry.

# Deployment
- A static build, served over HTTPS (the camera only works over HTTPS).
- The host must be able to set security headers (see [ADR-0003](adr/0003-static-hosting.md)).
- Installable as a PWA, with a service worker for offline use.
