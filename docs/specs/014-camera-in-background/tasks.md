---
type: Task List
title: "014: The camera stops in the background and can be turned off by hand - tasks"
description: Four tasks - the tracker releases and reopens the camera with the page's visibility, the three pages start cleanly on return, a camera button on each screen, and the docs.
tags: [security, privacy, vision, camera]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-16
---

Branch: `feat/014-camera-in-background`. Gates: `npm run verify -- --quick`; CI runs `npm run verify`. E2E waits
for the next e2e pass (the paths are in the spec's Test plan).

- [x] **T1 [opus]: The tracker follows the page's visibility.** `FaceTrackerService` listens to `visibilitychange`
      (an injected document, as in `wake-lock.ts`): hidden releases the camera and keeps the worker, visible opens
      it again with the same facing and video; a signal tells the pages that a new run began (R1–R3, R5, R8). A stop
      by hand is remembered, so visible does not undo it (R13).
      Tests: unit with a fake document, camera and worker, including the quick changes of R8.
      _To understand:_ the Page Visibility API; why a run counter makes late answers harmless; stopping a track
      against ending a worker.
- [x] **T2 [sonnet]: A clean start on the three pages.** `CameraInput` resets the detector and the face status on a
      new run; Kalibracja (Calibration) records the step under way again and says its instruction; Diagnostyka
      (Diagnostics) restarts its measurement (R4, R6, R7). Tests: unit per page and for the camera input.
      _To understand:_ why half a movement must not survive a gap.
- [x] **T3 [sonnet]: A camera button on each screen.** "Kamera" (Camera) toggle in the top bar of Liczenie
      (Counting) with "Kamera wyłączona" (Camera off) in the chip (R10); "Wyłącz kamerę" (Turn off the camera) /
      "Włącz kamerę" (Turn on the camera) on the steps of Kalibracja (Calibration) (R11); the Diagnostyka (Diagnostics)
      buttons in a bar that stays in view (R12); none of them reachable by his signals (R13). New strings in en and pl.
      Tests: unit per page.
      _To understand:_ toggle buttons and `aria-pressed`; a sticky bar that does not hide the focus (SC 2.4.11).
- [ ] **T4 [haiku]: Docs.** Security conventions and the security pass (F2 closed), architecture (the camera's life
      cycle), the first-session checklist (the checks by hand on his phone), README, backlog, log, specs index,
      Polish copies.
      _To understand:_ nothing new.
