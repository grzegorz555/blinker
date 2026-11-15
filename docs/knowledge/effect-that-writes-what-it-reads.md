---
type: Learning
title: An Angular effect that writes a signal it reads runs forever; wrap the write in untracked
description: In spec 011 the calibration page appended each camera frame to a recordings signal inside an effect that also read it, so every write scheduled the effect again and the unit test hung. Read and write such state with untracked.
tags: [angular, signals, testing]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-15
---

# Context

Kalibracja (Calibration) records the frames of the open step: an `effect()` reads the tracker's `frame()` signal and
appends the frame to `recordings`. The helper that appended read `recordings()` first. The first unit test never
finished: the effect depended on `recordings`, the write changed it, the effect ran again and appended the same frame.

# Lesson

An effect tracks every signal it reads, also inside helpers it calls. If it writes one of them, it re-runs itself.
Angular does not stop this for you in zoneless apps; a test just times out.

# How to apply

- In an effect, read only the trigger (here `frame()`); do the work inside `untracked(() => …)`.
- When a test hangs after adding an effect, look for a signal the effect both reads and writes.
- Docs: https://angular.dev/guide/signals#reading-without-tracking-dependencies
