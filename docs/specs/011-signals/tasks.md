---
type: Task List
title: "011: His signals from the camera - tasks"
description: Four tasks - the pure detector and profile, signals in Diagnostyka (Diagnostics), the Kalibracja (Calibration) wizard with fitting, and the docs.
tags: [stage-4, signals]
status: stable
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-15
---

Branch: `feat/011-signals` on top of `feat/010-face-spike` (PR #19). Gates: `npm run verify -- --lighthouse`.

- [x] **T1 [opus]: Detector and profile.** `core/signals/`: `SignalProfile` with defaults and a validator, the
      store, `detect()` for the five signals (R1, R2). Tests: synthetic frame streams.
      _To understand:_ hysteresis and a refractory time, why a signal fires on release.
- [x] **T2 [sonnet]: Signals in Diagnostyka (Diagnostics).** The detector on the live frames and a list of the last
      signals (R3). Tests: unit with a fake tracker.
- [x] **T3 [opus]: Kalibracja (Calibration).** `fitProfile()` (R5) and the wizard page (R4), in the navigation. Tests:
      fitting with synthetic steps, the page with a fake tracker, e2e with the fake camera, axe.
      _To understand:_ a threshold halfway between rest and a deliberate peak; medians against outliers.
- [x] **T4 [haiku]: Docs.** Interaction model (how each signal is detected), architecture, README, log, specs index,
      Polish copies.
