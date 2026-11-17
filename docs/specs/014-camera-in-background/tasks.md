---
type: Task List
title: "014: The camera stops in the background - tasks"
description: Three tasks - the tracker releases and reopens the camera with the page's visibility, the three pages start cleanly on return, and the docs.
tags: [security, privacy, vision, camera]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-16
---

Branch: `feat/014-camera-in-background`. Gates: `npm run verify -- --lighthouse`.

- [ ] **T1 [opus]: The tracker follows the page's visibility.** `FaceTrackerService` listens to `visibilitychange`
      (an injected document, as in `wake-lock.ts`): hidden releases the camera and keeps the worker, visible opens
      it again with the same facing and video; a signal tells the pages that a new run began (R1–R3, R5, R8).
      Tests: unit with a fake document, camera and worker, including the quick changes of R8.
      _To understand:_ the Page Visibility API; why a run counter makes late answers harmless; stopping a track
      against ending a worker.
- [ ] **T2 [sonnet]: A clean start on the three pages.** `CameraInput` resets the detector and the face status on a
      new run; Kalibracja (Calibration) records the step under way again and says its instruction; Diagnostyka
      (Diagnostics) restarts its measurement (R4, R6, R7). Tests: unit per page and for the camera input; e2e on the
      fake-camera projects with the visibility helper, no third-party request, axe.
      _To understand:_ why half a movement must not survive a gap; faking visibility in Playwright.
- [ ] **T3 [haiku]: Docs.** Security conventions and the security pass (F2 closed), architecture (the camera's life
      cycle), the first-session checklist (the check by hand on his phone), README, backlog, log, specs index,
      Polish copies.
      _To understand:_ nothing new.
