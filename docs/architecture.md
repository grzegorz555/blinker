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
