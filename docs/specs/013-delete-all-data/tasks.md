---
type: Task List
title: "013: Delete all data from this device - tasks"
description: Three tasks - the erase in the core (every store and every service), the section in Ustawienia (Settings) with the confirmation and the status, and the docs.
tags: [security, privacy, settings, storage]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-16
---

Branch: `feat/013-delete-all-data`. Gates: `npm run verify -- --lighthouse`.

- [x] **T1 [opus]: The erase in the core.** A `DeviceData` service with `eraseAll()`: every service gets a reset to
      its defaults (`SettingsService`, `BoardsService`, `HistoryService`, `CountingService` for the sentence and its
      undo, `LanguageService` for the saved choice; `ProfileService.reset()` exists), then a sweep removes every
      `blinker.` key (`StorageLike` gains `key` and `length`); the result says whether the storage obeyed (R3, R5).
      Tests: unit per service, the fill-erase-check test, the prefix test, a storage that throws.
      _To understand:_ why a sweep by prefix and a reset per service together; effects that would write a value back
      after it was removed (`docs/knowledge/effect-that-writes-what-it-reads.md`).
- [ ] **T2 [sonnet]: The section in Ustawienia (Settings).** "Dane na tym urządzeniu" (Data on this device): the
      text, the button, the confirmation through `ConfirmService`, the status and the error in text; strings in
      `en.json` and `pl.json` (R1, R2, R4, R6, R7). Tests: unit for the page, e2e on 3 device projects with axe, the
      layout at 360 px.
      _To understand:_ SC 3.3.4 (confirmed, not reversible); `role="status"` and where focus goes after a dialog.
- [ ] **T3 [haiku]: Docs.** Security conventions and the security pass (F1 closed), architecture (where data is
      stored, the key prefix), README, backlog, log, specs index, Polish copies.
      _To understand:_ nothing new.
