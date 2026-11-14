---
type: Task List
title: "008: Liczenie (Counting) for a listener - tasks"
description: Three tasks - the machine (SPOKEN, "Nowe zdanie?" (New sentence?), the word said on a space, undo said), the layout with the sentence big, and the docs.
tags: [stage-2, counting]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-14
---

Branch: `fix/008-space` (worktree `C:/Repozytorium/Blinker/wt/008-space`); it also carries the "Spacja" (Space)
button and the hint of the moment (commit before this spec). Gates: `npm run verify -- --lighthouse` before the push.

- [x] **T1 [opus]: The machine for a listener.** `SPOKEN` and `clear.asking` (R3), the finished word said on a space
      (R2), an undo said aloud (R1); CountingService sends SPOKEN when a reading ends. Tests: the 12 × 9 table and
      the paths of the test plan.
      _To understand:_ an event from the outside world as a signal, why the machine still never waits on a timer.
- [ ] **T2 [sonnet]: The layout with the sentence big.** Status line small at the top, the sentence big above the
      board, the actions with it (R4, R5). Tests: e2e fit at every size and with the wide font, the "Nowe zdanie?"
      path, axe.
      _To understand:_ designing for a person who listens: what the screen is for, and for whom.
- [ ] **T3 [haiku]: Docs.** Interaction model (the shortcuts by head), design, README, log, specs index, Polish copies.
