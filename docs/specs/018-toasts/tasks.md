---
type: Task List
title: "018: Toasts that confirm what happened - tasks"
description: Four tasks - the ToastService with placement, timing and announcement; Cofnij (Undo) for a sentence and a board; the toasts on every screen of R5; e2e and docs.
tags: [ui, accessibility, feedback]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-25
---

Branch: `feat/018-toasts`. Gates: `npm run verify -- --lighthouse`. Starts after the author approves the spec, on
`main` with spec 017 merged (its backup statuses become toasts).

- [ ] **T1 [opus]: The `ToastService`.** `shared/toast/`: a small component inside `MatSnackBar.openFromComponent`
      (text, one optional action), our own timer (6 s, or 10 s with an action) that pauses on pointer and focus and
      restarts after, Esc, one at a time, placement above the navigation bar below 600 px and never over the focused
      control, the polite announcement, reduced motion, the M3 inverse-surface tokens and their contrast in the token
      test (R1–R4). Tests: unit with fake timers.
      _To understand:_ why our own timer instead of the snack bar's `duration`; overlays and where they sit in the tab
      order.
- [ ] **T2 [sonnet]: Cofnij (Undo) in the services.** `HistoryService.restore(entry)` and
      `BoardsService.restore(board, wasActive)`, each once, saved again (R6). Tests: unit.
      _To understand:_ keeping just enough to undo, and for how long.
- [ ] **T3 [sonnet]: The toasts on every screen.** Tablice (Boards), Zdania (Sentences), Ustawienia (Settings),
      Kalibracja (Calibration), Diagnostyka (Diagnostics) per R5; the inline success texts removed, the errors kept;
      Cofnij (Undo) wired for a sentence and a board; strings in `en.json` and `pl.json`. Tests: the page specs.
      _To understand:_ telling a success (transient) from an error (persistent) in the UI.
- [ ] **T4 [sonnet]: e2e and docs.** `e2e/toasts.e2e.ts` per the acceptance criteria, the existing e2e that read the
      removed texts, axe with a toast; frontend and accessibility conventions (the toast pattern), user guide, README,
      Polish copies. The log entry goes into the next batch `docs(log)` PR.
      _To understand:_ testing a timer in e2e without waiting it out (`page.clock`).
