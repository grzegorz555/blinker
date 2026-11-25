---
type: Task List
title: "017: A backup of his data in a file - tasks"
description: Four tasks - the pure format (build and check), the restore in the core with a reload per service, the section in Ustawienia (Settings), and e2e with the docs.
tags: [settings, storage, privacy, security]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-25
---

Branch: `feat/017-backup`. Gates: `npm run verify -- --lighthouse`. The author approved the spec on 2026-11-25. The e2e path is `e2e/backup.e2e.ts`.

- [x] **T1 [opus]: The format, pure.** `core/storage/backup.ts`: `buildBackup(stores, { history }, now)` and
      `checkBackup(bytes, now)` → the parts or the first error with its part (R2, R4, R5), reusing the store
      validators. Tests: build with and without the history; every refusal of R5; a round trip.
      _To understand:_ an envelope with a version; why "all or nothing" and not "skip the bad part".
- [x] **T2 [opus]: The restore in the core.** `BackupService`: `save(includeHistory)` (the file and its name) and
      `restore(parts)`: write every key with the old values kept, put them back on the first failure, then each
      service reads its store again (`reload()` on settings, boards, profile, history, language) and the counting
      clears the sentence (R7). Tests: a round trip through the services; the history kept when the file has none;
      a storage that throws on the n-th write.
      _To understand:_ a write that can fail half way, and undoing it; why the services reload instead of a page
      reload.
- [x] **T3 [sonnet]: The section in Ustawienia (Settings).** The text, the checkbox, the two buttons, the hidden file
      input, the dialog through `ConfirmService` with both history cases, the statuses; strings in `en.json` and
      `pl.json` (R1, R3, R6, R8, R9). Tests: the page spec.
      _To understand:_ formatting a date for the screen language (`Intl.DateTimeFormat`).
- [x] **T4 [sonnet]: e2e and docs.** The e2e path of the acceptance criteria on 3 device projects with axe; README,
      user guide (how to move to a new phone), architecture (the backup), security pass (V14), the first-session
      checklist (save a backup after the calibration), Polish copies. The log entry goes into the next batch
      `docs(log)` PR.
      _To understand:_ Playwright's `download` event and `setInputFiles`.
