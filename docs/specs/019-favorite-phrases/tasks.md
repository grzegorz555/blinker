---
type: Task List
title: "019: Favorite phrases - tasks"
description: Four tasks - the phrase store and the matcher; the offer in the counting machine; the list in Zdania (Sentences), the switches and the row in Liczenie (Counting); backup, erase, e2e and docs.
tags: [interaction, counting, prediction, privacy]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-26
---

Branch: `feat/019-favorite-phrases`. Gates: `npm run verify -- --lighthouse`. Waits for the author's approval of the
spec.

- [ ] **T1 [sonnet]: The store and the matcher.** `core/phrases/`: the validator (R2, R9), `PhrasesService` (add,
      delete, restore for Cofnij (Undo), move, `reload()`), the pure `matchPhrase(text, phrases, locale)` (R3) with
      the table of Polish letters moved to one shared constant. Tests: unit.
      _To understand:_ normalizing text before comparing it (NFC, locale upper case).
- [ ] **T2 [opus]: The offer in the counting machine.** The state `phrase.asking` in the table, the pause before a
      suggestion, the answers of R6, the refused phrases, the replace step of the sentence and its undo (R4–R6, R8),
      the setting and the switch in `settings.ts`. Tests: `counting.spec.ts`, `sentence.spec.ts`.
      _To understand:_ why every state × signal pair is written out in the table.
- [ ] **T3 [sonnet]: The screens.** Zdania (Sentences): the section with the list, the field, the star in the history,
      move and delete with Cofnij (Undo) (R2); Ustawienia (Settings): the group (R1); Liczenie (Counting): the row with
      the offered phrase (R7); strings in `en.json` and `pl.json`. Tests: the page specs.
      _To understand:_ moving items without dragging (SC 2.5.7), and keeping the focus after a move.
- [ ] **T4 [sonnet]: Backup, erase, e2e and docs.** The `phrases` part of the backup and `eraseAll()` (R9);
      `e2e/phrases.e2e.ts`; user guide, README, the first-session checklist question, Polish copies. The log entry
      goes into the next batch `docs(log)` PR.
      _To understand:_ adding a part to a file format without breaking old files.
