---
type: Decision
title: "ADR-0001: Angular PWA with on-device face tracking, no backend"
description: Blinker is a static Angular PWA using MediaPipe Face Landmarker in the browser; .NET is deferred until a real need appears.
tags: [adr, stack, architecture]
status: stable
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-10
---

# ADR-0001: Angular PWA with on-device face tracking, no backend

- Status: Accepted (the author chose this option during planning on 2026-11-10)
- Date: 2026-11-10

## Context
The app must run "easily on any phone", detect blinks and head movements from the camera, and work without accounts.
The author's everyday stack is Angular + .NET.

## Decision criteria
1. Privacy of the person's face (the camera feed must not leave the device).
2. Easy to start on any phone: no store, no installation needed.
3. Low cost and low operational effort.
4. Reuse of the author's skills.
5. A path to a native app later.

## Considered options
1. **Angular PWA, face tracking in the browser (MediaPipe Face Landmarker), no backend.** Private, free, works offline, a single static build. The trade-off is that browser performance on older phones is limited (to be measured in stage 3).
2. **Angular + .NET API from the start.** It would give a familiar full stack, but there is nothing for the server to do: processing video on the server would hurt privacy and latency, and a backend without auth is extra attack surface and cost.
3. **A native app (Flutter / React Native).** It would have the best camera access, but it needs a store or sideloading and a new stack, and it is slower to iterate.

## Decision
Option 1. The application lives in `src/web`, and `src/api` is reserved. A native build, if ever needed, wraps the
same web app with **Capacitor** (https://capacitorjs.com/docs) instead of rewriting it.

## Consequences
- All logic is TypeScript and must be testable without a camera (keyboard and switch input, recorded signals).
- Model and wasm files are self-hosted (a few MB) and cached by the service worker.
- TTS quality depends on the voices installed on the device.

## Revisit when
- Browser tracking is too slow or unreliable on the friend's devices (stage 3 measurements).
- A feature truly needs a server: sync between devices, cloud TTS voices, or sharing boards.

## Learning resources
- MediaPipe Face Landmarker for web: https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js
- Angular service worker / PWA: https://angular.dev/ecosystem/service-workers
- Web Speech API: https://developer.mozilla.org/docs/Web/API/Web_Speech_API
- Capacitor: https://capacitorjs.com/docs
