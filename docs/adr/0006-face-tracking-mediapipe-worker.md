---
type: Decision
title: "ADR-0006: Face tracking with MediaPipe Face Landmarker in a module worker, self-hosted, metrics blocked"
description: Proposed after the stage 3 spike (spec 010). MediaPipe Face Landmarker runs on the device in a module Web Worker with the wasm and model served from our origin; its usage metrics to Google are blocked twice; the Trusted Types default policy also accepts the build's worker files. Accepted once the author's measurements on his devices are in the table.
tags: [adr, vision, privacy, performance]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-15
---

# ADR-0006: Face tracking with MediaPipe Face Landmarker in a module worker, self-hosted, metrics blocked

- Status: Proposed (waiting for the measurements below)
- Date: 2026-11-15

## Context

Stage 4 turns his blinks, the look at his hand and head movements into signals. ADR-0001 chose MediaPipe Face
Landmarker on the device. The spike (spec 010) had to show that it runs under our CSP and Trusted Types, keeps every
frame on the device, and is fast enough on a phone.

Found on the way (2026-11-14):

- `@mediapipe/tasks-vision` 1.2.3 **sends usage metrics to Google** (`https://odml.pa.googleapis.com/v1/log`, every
  60 s, with `fetch`), and its README asks apps to get users' consent. Blinker promises that nothing leaves the device.
- `new Worker(url)` is a Trusted Types sink; the `default` policy of ADR-0004 accepted only the service worker.
- In a module worker the library loads its ES module loader with `import()`, which Trusted Types do not guard.

## Decision criteria

1. Privacy: no picture and no data leave the device.
2. A responsive page while the model runs (the counting screen must not stutter).
3. Works offline and from our origin only.
4. Enough frames per second for a blink of about 300 ms (at least 15 FPS, to be confirmed).

## Considered options

1. **Module worker, self-hosted, metrics blocked by the CSP and a fetch guard in the worker** (built in the spike).
2. Main thread: simpler, but every analysis (10–30 ms) blocks the page.
3. Accept the metrics with a consent screen: against criterion 1, and he can't give informed consent to a technical
   detail on his own.

## Decision

**Option 1** (proposed):

- Face Landmarker in VIDEO mode, one face, blendshapes and the facial transformation matrix, GPU delegate with a CPU
  fallback, in a module worker; the page sends one `ImageBitmap` at a time (backpressure).
- The wasm and its ES module loader are copied from the pinned package to `/mediapipe/` at build; the model
  (`face_landmarker.task`, float16 v1) is committed with its SHA-256 pinned by a test; the service worker caches both
  lazily.
- Metrics: `connect-src 'self'` blocks them, and the worker wraps `fetch` to refuse every other origin before the
  library loads. e2e checks that no request leaves the origin.
- ADR-0004 amended: the `default` policy also accepts same-origin `/worker-<hash>.js` (a worker file of our build), no
  query, no fragment.

## Measurements (filled in by the author with Diagnostyka (Diagnostics), "Kopiuj wyniki" (Copy the results))

| Device, browser                    | Engine | FPS | Analysis median / p95 (ms) | Battery over 10 min | Light, glasses | Face found    |
| ---------------------------------- | ------ | --- | -------------------------- | ------------------- | -------------- | ------------- |
| Desktop Chromium, fake camera (CI) | GPU    | > 0 | n/a                        | n/a                 | test pattern   | no (expected) |
| His phone, Chrome                  |        |     |                            |                     |                |               |
| His tablet or phone, Safari        |        |     |                            |                     |                |               |

## Consequences

- The camera path is ready for stage 4; the values (`FaceFrame`) are plain data and testable without a camera.
- About 18 MB is downloaded on the first camera use (wasm 15 MB, model 3.7 MB), not on install.
- A library update must keep the pinned files and be checked for new network calls (`grep` for `https://` in the
  bundle, as done here).

## Revisit when

- The measurements are below 15 FPS on his device, or the battery drains too fast for a session: try a smaller input,
  fewer frames, or the CPU delegate.
- MediaPipe adds a documented switch to turn metrics off: use it as a third layer.
- Angular emits workers with a `TrustedScriptURL`: drop the worker rule from the `default` policy.

## Learning resources

- MediaPipe Face Landmarker for web: https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js
- The package and its privacy notice: https://www.npmjs.com/package/@mediapipe/tasks-vision
- Angular web workers: https://angular.dev/ecosystem/web-workers
- MDN Trusted Types: https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API
- MDN `requestVideoFrameCallback()`:
  https://developer.mozilla.org/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback
