---
type: Task List
title: "009: The letter by ear - tasks"
description: Two tasks - the machine and settings (a pause moves on, only the letter is said), and the docs.
tags: [stage-2, counting]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-14
---

Branch: `fix/settings-hint-gap` (worktree `C:/Repozytorium/Blinker/wt/009-settings-gap`), PR #18, after the fixes of
the author's look at the app. Gates: `npm run verify -- --lighthouse` before the push.

- [x] **T1 [opus]: A pause moves on, only the letter is said.** `confirmByNod` and `speakPrompts` in the settings and
      the machine config (R1, R3); the column and row pauses choose without a question when `confirmByNod` is off;
      every notice and question goes through one helper that says it only when `speakPrompts` is on. Tests: unit for
      both settings, e2e for the default path and the switches.
      _To understand:_ implicit confirmation (the next action accepts the last one) and why undo makes it safe.
- [x] **T2 [haiku]: Docs.** Interaction model, README, log, specs index, Polish copies.
