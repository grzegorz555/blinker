---
type: Task List
title: "016: Word prediction for Polish - tasks"
description: Six tasks - the word list and its license, the pure predictor, the replace step and the offer in the counting machine, his own words and the service, the screen and the settings, and the docs.
tags: [interaction, counting, prediction, privacy, i18n]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-20
---

Branch: `feat/016-word-prediction`. Gates: `npm run verify -- --lighthouse`. The author approved the spec and accepted
ADR-0007 on 2026-11-20.

- [x] **T1 [sonnet]: The word list, its license and the offline cache.** `scripts/build-word-list.mjs <source file>`
      (run by hand on the downloaded `pl_50k.txt`; the path is an argument, the file is untrusted): the filter of R2,
      the exclusion list (the author reviews it), `public/words/pl.txt` and `public/words/pl.LICENSE.txt`; a lazy
      asset group "words" in `ngsw-config.json`; `scripts/check-dist.mjs` accepts the two files. Tests:
      `scripts/word-list.test.mjs` (node --test) checks the committed file (count, order kept, allowlist, no excluded
      word) and the build on a small fixture.
      _To understand:_ CC BY-SA 4.0 (attribution, ShareAlike for adapted material); service worker asset groups
      (`installMode` lazy, `updateMode` prefetch).
- [x] **T2 [sonnet]: The predictor (pure).** `core/words/word-list.ts` (parse and validate the file, R3) and
      `core/words/predict.ts` (the one-way match: a plain letter also stands for its Polish letter, the prefix, candidates and their order, refused
      words, at most 3; R4, R5). No Angular, no clock. Tests: `word-list.spec.ts`, `predict.spec.ts`.
      _To understand:_ Unicode NFC and locale-aware upper case; why a fixed order matters more than a clever score for
      him (CLAUDE.md rule 13).
- [ ] **T3 [opus]: The offer in the counting machine and the replace step.** `Sentence` gets a `replace` step with
      its undo; `CountingState` gets the time of the last letter, the offered word and the refused words;
      `CountingConfig` gets `suggest` (a pure function from T2, absent = off) and `suggestAfterMs` and `askAloud` (off by default: no offer, the machine as before); the tap target
      `{ kind: 'word', word }` (R7, R8); the new state `word.asking` with every signal (R6, R7, R10); new Transloco keys in `COUNTING_KEYS`. Tests: `counting.spec.ts`
      and `sentence.spec.ts` for every rule, including the second shake and one offer per letter.
      _To understand:_ adding a state to an exhaustive transition table; why a refusal goes to `column.rejected`
      ([knowledge](../../knowledge/no-depends-on-context.md)).
- [ ] **T4 [opus]: His words and the service.** `core/words/my-words.ts` (learn from a sentence, merge with the list
      spelling, cap 2,000, drop the least recently used, validate when read back; R9) and `WordsService` (loads the list
      from `/words/pl.txt` when on and the board is Polish, keeps `blinker.words.v1`, gives `suggest` to
      `CountingService`, learns when a sentence is read aloud, `reset()` and `forget()`); `DeviceDataService.eraseAll()`
      resets it. Tests: `my-words.spec.ts`, the service with a fake fetch and the in-memory storage, the
      fill-erase-check test of spec 013 with the new key.
      _To understand:_ personal data on the device (GDPR art. 9); validating stored data as untrusted input; one erase
      for every store.
- [ ] **T5 [sonnet]: The screen and the settings.** Liczenie (Counting): the "Podpowiedzi" (Suggestions) row (R8), the
      offer as the question. Ustawienia (Settings): the group with "Podpowiadaj słowa" (Suggest words), "Pytaj o słowo na głos" (Ask about the word aloud, off), "Pauza przed
      podpowiedzią" (Pause before a suggestion), "Ucz się z moich zdań" (Learn from my sentences), "Zapomnij moje
      słowa" (Forget my words) with the confirmation, the list status in text; "O aplikacji" (About) names the list and
      its license; `en.json` and `pl.json`. Tests: the page specs, the translation-keys test, the fit at 360 px with
      the wider font.
      _To understand:_ `role="group"` and `aria-current`; `lang` on a part of the page (SC 3.1.2); reserving space so
      the layout does not shift.
- [ ] **T6 [haiku]: Docs.** The interaction model (the offer and its answers), architecture (`core/words/`, the store
      `blinker.words.v1`, the `/words/` asset), the security conventions (the new store), README, backlog, log, specs
      index, ADR-0007 status after the author's decision, Polish copies.
      _To understand:_ nothing new.
