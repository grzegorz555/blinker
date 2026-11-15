---
type: Task List
title: "012: The camera drives Liczenie (Counting) - tasks"
description: Four tasks - the settings and the camera input service, the sound for each signal, Liczenie (Counting) with the camera, and the docs.
tags: [stage-5, vision, counting]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-15
---

Branch: `feat/012-camera-counting` on top of `feat/011-signals` (PR #21). Gates: `npm run verify -- --lighthouse`.

- [x] **T1 [opus]: Settings and the camera input.** `camera`, `cameraFacing`, `cameraPreview`, `signalSound` in the
      settings (validated, defaults); `FaceTrackerService` takes the facing; `CameraInput` turns frames into signals
      for a sink and says when the face is lost (R1, R2, R4, R5). Tests: unit with a fake tracker.
      _To understand:_ one input path for every source; a debounced "no face".
- [x] **T2 [sonnet]: The sound for each signal.** `core/sound/cue.ts` with the Web Audio API, a tone per signal,
      behind the setting (R3). Tests: unit with a fake audio context.
- [x] **T3 [sonnet]: Liczenie (Counting) with the camera.** Start and stop with the page, the status in the status
      line, the optional preview, the switches in Ustawienia (Settings) (R1, R4, R5). Tests: unit, e2e with the fake
      camera, layout fit, axe.
- [ ] **T4 [haiku]: Docs.** Interaction model, architecture, README, log, specs index, Polish copies.
