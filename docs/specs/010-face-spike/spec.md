---
type: Spec
title: "010: Face-tracking spike - MediaPipe Face Landmarker in a worker and a diagnostic screen"
description: Stage 3. MediaPipe Face Landmarker runs on the device in a module Web Worker (self-hosted wasm and model, no metrics sent to Google), and a Diagnostyka (Diagnostics) screen shows live eye and head values with frame rate and analysis time, so the author can measure on Android Chrome and iOS Safari. Ends with a proposed ADR filled in from the measurements.
tags: [stage-3, vision, spike, privacy]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-14
---

# Goal

Find out whether MediaPipe Face Landmarker, running in the browser on his phone or tablet, gives eye-blink and head
values steady and fast enough to detect his signals (stage 4), without any data leaving the device. The spike builds
the camera → worker → values path and a screen to look at them; the author measures on real devices (FPS, analysis
time, battery, light, glasses) and the results go into an ADR.

# Findings before the code (2026-11-14)

- `@mediapipe/tasks-vision` 1.2.3 (Apache-2.0) ships a wasm runtime (about 15 MB) and an ES module loader
  (`vision_wasm_module_internal.js`); in a module worker it loads the loader with `import()`, which Trusted Types do
  not guard.
- **The library sends usage metrics to Google** (`https://odml.pa.googleapis.com/v1/log`, every 60 s, by `fetch`);
  its README asks apps to get consent. Blinker sends nothing: the CSP (`connect-src 'self'`) blocks the request, and
  the worker also refuses every cross-origin `fetch` before the library loads (two layers; e2e checks that no request
  leaves the origin).
- The model `face_landmarker.task` (float16, version 1, 3 758 596 bytes, SHA-256
  `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`) comes from the official URL in the MediaPipe
  docs and is committed to `public/models/`; a script test pins its hash.

# Rules

- **R1. Self-hosted, nothing sent.** The wasm and loader are copied from the package at build time to `/mediapipe/`,
  the model is served from `/models/`; no CDN. The worker refuses cross-origin `fetch`; the CSP is unchanged.
- **R2. Analysis in a worker.** A module Web Worker runs Face Landmarker in VIDEO mode with blendshapes and the facial
  transformation matrix, one face, GPU delegate with a CPU fallback (the delegate in use is reported). The page sends a
  frame (an `ImageBitmap`, transferred) only when the worker is free, so frames never pile up.
- **R3. Values for stage 4.** Each result becomes a `FaceFrame`: face found or not; `eyeBlinkLeft/Right`;
  `eyeLookDownLeft/Right`, `eyeLookInLeft/Right`, `eyeLookOutLeft/Right` (for the look at his hand); head yaw, pitch
  and roll in degrees from the matrix; the analysis time. Pure functions, unit-tested.
- **R4. Diagnostyka (Diagnostics) screen.** `/diagnostics`, linked from Ustawienia (Settings). The camera starts only
  on "Włącz kamerę" (Turn on the camera) and stops on "Wyłącz kamerę" (Turn off the camera) and when leaving the
  page. It shows the mirrored preview, face found, FPS, analysis time (median and p95), the delegate, the eye values
  as meters with numbers, the head angles, and the battery level where the browser reports it. "Kopiuj wyniki" (Copy
  the results) copies a short text for the ADR. Errors (no permission, no camera, the model failed) are said in text.
- **R5. Privacy in words.** The screen says the picture stays on the device, is never saved, and nothing is sent.
  Frames are not kept after analysis; no image is stored.
- **R6. Offline.** The wasm and model are cached by the service worker on first use (a lazy group), not on install.

# Acceptance criteria

- [x] On desktop Chromium with a fake camera: the camera starts, the worker reports a delegate, frames are analysed
      (FPS > 0, "no face" on the test pattern), no CSP or Trusted Types violation, no request leaves the origin (R1, R2).
- [x] Unit: the head angles from known matrices; the `FaceFrame` from a result with and without a face; the rolling
      statistics; the fetch guard (R1, R3).
- [x] The page passes axe on every device project; without a camera (WebKit in tests) the error is in text (R4).
- [x] The model hash test passes (R1).
- [x] ADR-0006 (proposed) records the setup and a table for the author's measurements on his devices.
- [x] `npm run verify -- --lighthouse` passes.

# Test plan

- Unit: `head-pose`, `face-frame`, `frame-stats`, `fetch-guard`; the tracker service with a fake worker and a fake
  camera (start, one frame in flight, stop releases the camera and the worker).
- e2e: Chromium with `--use-fake-device-for-media-stream` and `--use-fake-ui-for-media-stream`: start, values move,
  stop; third-party requests none; axe. WebKit: the page and its text without a camera.

# Out of scope

- Turning the values into his signals (blink, hand, nod, shake, head right): stage 4, with calibration.
- Measurements on his devices: the author does them with this screen; the ADR is then accepted.

# References

- MediaPipe Face Landmarker for web: https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js
- Package README, privacy notice (metrics): https://www.npmjs.com/package/@mediapipe/tasks-vision
- Angular web workers: https://angular.dev/ecosystem/web-workers
- MDN: `HTMLVideoElement.requestVideoFrameCallback()`
  https://developer.mozilla.org/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback; `createImageBitmap()`
  https://developer.mozilla.org/docs/Web/API/Window/createImageBitmap; Trusted Types
  https://developer.mozilla.org/docs/Web/API/Trusted_Types_API
- Playwright fake media flags: https://peter.sh/experiments/chromium-command-line-switches/#use-fake-device-for-media-stream
- WCAG 2.2: Status Messages https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
