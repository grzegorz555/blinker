---
type: Task List
title: "010: Face-tracking spike - tasks"
description: Four tasks - the vendored runtime and model, the worker and its pure functions, the Diagnostyka (Diagnostics) screen, and the docs with the proposed ADR.
tags: [stage-3, vision]
status: stable
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-14
---

Branch: `feat/010-face-spike` (worktree `C:/Repozytorium/Blinker/wt/010-face`). Gates: `npm run verify -- --lighthouse`
before each push.

- [x] **T1 [sonnet]: Runtime and model, self-hosted.** The package pinned; the wasm and loader copied to
      `/mediapipe/` at build; the model in `public/models/` with a hash test; a lazy service worker group (R1, R6).
      _To understand:_ why a wasm runtime and a model are served from our origin, and what a hash pin protects.
- [x] **T2 [opus]: The worker and the values.** `fetch-guard`, `head-pose`, `face-frame`, `frame-stats`, the module
      worker and `FaceTrackerService` (one frame in flight, GPU with CPU fallback) (R1–R3). Tests: unit.
      _To understand:_ a transform matrix to angles; backpressure between the page and a worker.
- [x] **T3 [sonnet]: Diagnostyka (Diagnostics).** The page, the link from the settings, texts in en and pl, e2e with a
      fake camera, axe (R4, R5).
      _To understand:_ meters for live values without flooding a screen reader.
- [x] **T4 [haiku]: Docs.** ADR-0006 (proposed) with the measurement table, architecture, security (metrics blocked),
      README, log, specs index, Polish copies.
