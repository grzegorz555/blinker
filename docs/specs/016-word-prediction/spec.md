---
type: Spec
title: "016: Word prediction for Polish - Blinker guesses the word, like his caregiver does"
description: When he pauses inside a word, Blinker says the most likely word as a question and he takes it with a nod, ignores it by going on, or refuses it with a shake; one shake undoes a taken word. A self-hosted list of 20,000 frequent Polish words (OpenSubtitles, CC BY-SA 4.0, ADR-0007) plus the words of his own sentences kept on the device; a plain letter also stands for its Polish letter. Off by default; the offer by ear is a second option, also off.
tags: [interaction, counting, prediction, privacy, i18n]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-20
---

# Goal

Every letter costs him a lot: on his board a letter takes about 4–5 signals (blinks and looks at his hand) and two
pauses ([his board](../../boards/friend-board.md): the column costs 1–4 signals, the row 1–4). A word of 8 letters is
some 40 signals. A caregiver at the paper board shortens this today by guessing the word aloud once it is clear
("Dziękuję?" (Thank you?)), and he nods or goes on. Blinker shows its guesses on the screen for the people around
him and, as an option, asks about the best one by ear (R6), because he puts words together by ear and does not read
the screen ([interaction model](../../interaction-model.md), "He listens").

The guess must stay predictable and forgiving (CLAUDE.md rule 13): it costs nothing when he ignores it, it changes the
text only after his nod, one shake undoes it, and the same prefix always gives the same guess.

# Scope

- A word list for Polish, built once from a published frequency list, filtered, committed and served from our own
  origin (ADR-0007), loaded only when the feature is on.
- A pure predictor: the prefix of the word being written → up to 3 candidates, in a fixed order, where a plain letter
  also stands for its Polish letter (he drops them sometimes).
- With the option "Pytaj o słowo na głos" (Ask about the word aloud) on, the counting machine offers the first candidate by ear when he pauses inside a word (a new state `word.asking`); a
  nod takes it, a shake refuses it, a blink or a hand goes on with the next letter.
- A new step of the sentence, "replace the prefix with the word", undone by one shake.
- His own words: the words of the sentences read aloud are counted on the device (`blinker.words.v1`) and come before
  the list's words; erased by "Usuń wszystkie dane" (Delete all data) and by their own button.
- The screen: a row of up to 3 suggestions above the board for the people around him (a tap takes a word), and the
  switches in Ustawienia (Settings).

# Rules

- **R1. Off by default, for Polish boards only.** Ustawienia (Settings) gets a group "Podpowiadanie słów" (Word
  prediction) with a switch "Podpowiadaj słowa" (Suggest words), off by default. It works only when the active board's
  `locale` is Polish (`pl`, `pl-PL`); with another board the switch is disabled and a text says why. A caregiver turns
  it on during the trial with him (stage 6), so nothing changes for him until then.
- **R2. The built-in list.** `public/words/pl.txt`: the 20,000 most frequent word forms of the Polish list of
  FrequencyWords (OpenSubtitles 2018, `pl_50k.txt`), one lowercase word per line in frequency order, after a filter:
  only the letters `a–z ą ć ę ł ń ó ś ź ż` (no q, v, x and no foreign forms), 3–24 letters, without a short
  exclusion list of vulgar and insulting forms in the build script (he can still spell them, and then they are his
  words, R9). The script (`scripts/build-word-list.mjs <source file>`) is run by hand, the result is committed with
  `public/words/pl.LICENSE.txt` (source, authors, changes, CC BY-SA 4.0), and "O aplikacji" (About) names the source
  and the license. Size: about 175 KB, about 77 KB gzipped (measured 2026-11-20 on the 2018 list).
- **R3. Loaded from our origin, checked like input, cached for offline.** The list is fetched from `/words/pl.txt`
  only when the switch is on and the board is Polish, and the service worker caches it (a lazy asset group "words", so
  it is not part of the first install). The file is checked before use: at most 256 KB, a strict UTF-8 decode, at most
  20,000 lines, every line matching `^[a-pr-uwyząćęłńóśźż]{3,24}---
type: Spec
title: "016: Word prediction for Polish - Blinker guesses the word, like his caregiver does"
description: When he pauses inside a word, Blinker says the most likely word as a question and he takes it with a nod, ignores it by going on, or refuses it with a shake; one shake undoes a taken word. A self-hosted list of 20,000 frequent Polish words (OpenSubtitles, CC BY-SA 4.0, ADR-0007) plus the words of his own sentences kept on the device; a plain letter also stands for its Polish letter. Off by default; the offer by ear is a second option, also off.
tags: [interaction, counting, prediction, privacy, i18n]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-20
---

# Goal

Every letter costs him a lot: on his board a letter takes about 4–5 signals (blinks and looks at his hand) and two
pauses ([his board](../../boards/friend-board.md): the column costs 1–4 signals, the row 1–4). A word of 8 letters is
some 40 signals. A caregiver at the paper board shortens this today by guessing the word aloud once it is clear
("Dziękuję?" (Thank you?)), and he nods or goes on. Blinker shows its guesses on the screen for the people around
him and, as an option, asks about the best one by ear (R6), because he puts words together by ear and does not read
the screen ([interaction model](../../interaction-model.md), "He listens").

The guess must stay predictable and forgiving (CLAUDE.md rule 13): it costs nothing when he ignores it, it changes the
text only after his nod, one shake undoes it, and the same prefix always gives the same guess.

# Scope

- A word list for Polish, built once from a published frequency list, filtered, committed and served from our own
  origin (ADR-0007), loaded only when the feature is on.
- A pure predictor: the prefix of the word being written → up to 3 candidates, in a fixed order, where a plain letter
  also stands for its Polish letter (he drops them sometimes).
- With the option "Pytaj o słowo na głos" (Ask about the word aloud) on, the counting machine offers the first candidate by ear when he pauses inside a word (a new state `word.asking`); a
  nod takes it, a shake refuses it, a blink or a hand goes on with the next letter.
- A new step of the sentence, "replace the prefix with the word", undone by one shake.
- His own words: the words of the sentences read aloud are counted on the device (`blinker.words.v1`) and come before
  the list's words; erased by "Usuń wszystkie dane" (Delete all data) and by their own button.
- The screen: a row of up to 3 suggestions above the board for the people around him (a tap takes a word), and the
  switches in Ustawienia (Settings).

# Rules

- **R1. Off by default, for Polish boards only.** Ustawienia (Settings) gets a group "Podpowiadanie słów" (Word
  prediction) with a switch "Podpowiadaj słowa" (Suggest words), off by default. It works only when the active board's
  `locale` is Polish (`pl`, `pl-PL`); with another board the switch is disabled and a text says why. A caregiver turns
  it on during the trial with him (stage 6), so nothing changes for him until then.
- **R2. The built-in list.** `public/words/pl.txt`: the 20,000 most frequent word forms of the Polish list of
  FrequencyWords (OpenSubtitles 2018, `pl_50k.txt`), one lowercase word per line in frequency order, after a filter:
  only the letters `a–z ą ć ę ł ń ó ś ź ż` (no q, v, x and no foreign forms), 3–24 letters, without a short
  exclusion list of vulgar and insulting forms in the build script (he can still spell them, and then they are his
  words, R9). The script (`scripts/build-word-list.mjs <source file>`) is run by hand, the result is committed with
  `public/words/pl.LICENSE.txt` (source, authors, changes, CC BY-SA 4.0), and "O aplikacji" (About) names the source
  and the license. Size: about 175 KB, about 77 KB gzipped (measured 2026-11-20 on the 2018 list).
- **R3. Loaded from our origin, checked like input, cached for offline.** The list is fetched from `/words/pl.txt`
  only when the switch is on and the board is Polish, and the service worker caches it (a lazy asset group "words", so
  it is not part of the first install). The file is checked before use: at most 256 KB, a strict UTF-8 decode, at most
  20,000 lines, every line matching  (the letters of R2: a–z without q, v, x, and the Polish letters); any bad line rejects the whole file. Without the list
  (not loaded yet, offline before the first load, rejected) only his own words are suggested, and Ustawienia
  (Settings) says in text that the list is not available.
- **R4. The prefix and the match: a plain letter stands for its Polish letter too.** The prefix is the text after the
  last space of the sentence, when it is 2 or more letters (a `SZ` or `CZ` cell adds two letters, so "SZ" is a
  prefix). Words and prefix are compared letter by letter after NFC and upper case in Polish
  (`toLocaleUpperCase('pl')`). He drops Polish letters sometimes, even those on his board, and uses them at other times
  (the author, 2026-11-20), so the match is one-way: a plain letter of the prefix matches itself or its Polish letter
  from a fixed table (`A → A Ą`, `C → C Ć`, `E → E Ę`, `L → L Ł`, `N → N Ń`, `O → O Ó`, `S → S Ś`, `Z → Z Ź Ż`), and a
  Polish letter he did spell matches only itself ("ZOL" and "ŻOL" both give "ŻÓŁW"; "ŻO" does not give "ZOSTAĆ"). The
  table is one constant, so the trial can change it.
- **R5. The candidates, always in the same order.** A candidate starts with the prefix by the match of R4 and is at
  least 2 letters longer than the prefix (a guess must save signals). His own words (R9) come first, by count and then
  by the latest use; then the list's words, by rank; a word in both appears once, as his. Words refused in this word
  (R7) are left out. At most 3 candidates. The same prefix, list and his words always give the same candidates.
- **R6. The offer, by ear, when he pauses inside a word: an option, off by default.** Ustawienia (Settings) gets a
  second switch in the group, "Pytaj o słowo na głos" (Ask about the word aloud), off by default and shown only when
  prediction is on (the author, 2026-11-20: it may help him, but only as an option). Off: only the row of R8 is shown
  and there is no `word.asking`; the counting machine behaves exactly as without prediction. On: while Blinker waits for a column and the sentence ends in a
  prefix with a candidate, and no signal came for "Pauza przed podpowiedzią" (Pause before a suggestion) after the
  last letter (default 2.5 s, 1–10 s in Ustawienia (Settings), SC 2.2.1), Blinker asks about the first candidate: the
  state is `word.asking`, the word is shown and **said aloud** as a question in its full spelling ("Żółw?"), whatever
  "Mów pytania i komunikaty" (Say the questions and notices) is, because he listens. At most one offer per letter: a
  new offer needs a new prefix (a letter added or undone restarts the pause; refused words stay refused until the
  next space). It is offered in `column.waiting` and `column.rejected` only: while he is giving a number, during a
  question, a reading or the pause, nothing is offered.
- **R7. His answer.** In `word.asking`:
  - `NOD`: the prefix is replaced by the word in its full spelling (with Ł and Ó), in upper case like the board's
    letters, plus a space, as one step of the sentence; the word is said (as a letter is said, spec 009, R3). At the
    columns a nod is a space, so a nod meant as a space just as the offer starts takes the word: one shake undoes it
    and the next nod is the space (R10). To watch in the trial;
  - `SHAKE`: the text stays; the word joins the refused words of this word (cleared at the next space) and Blinker
    goes to `column.rejected`, so a second shake right after changes nothing (it does not delete the last letter,
    [knowledge](../../knowledge/no-depends-on-context.md));
  - `BLINK` / `HAND`: he goes on: the offer is dropped and the signal counts as the first number of the column, as in
    "Nowe zdanie?" (New sentence?);
  - `RIGHT`: "Przeczytać na głos?" (Read it aloud?), as at the columns; `PAUSE`: the pause, back to the columns after;
  - `TICK`, `SPOKEN`: nothing; `TOUCH`: as in every other state (a tap on a cell or on a suggestion, R8; a
    suggestion is a new tap target `{ kind: 'word', word }` that replaces the prefix like a nod, in every state but
    the pause).
  The machine's table lists all of them for the new state (every state × signal explicit).
- **R8. On the screen.** Above the board, a row "Podpowiedzi" (Suggestions) shows up to 3 candidates as buttons
  (`lang` of the board, at least 44 px high); the one being asked is marked by more than color (a border and the
  text "pytam" (asking)). A tap takes that word at once, like a tap on a cell (spec 007, R3). The row keeps its height
  when it is empty, so the board does not jump; it is not shown when the switch is off. His signals cannot move
  between the suggestions: by ear he hears only the first one, and only with "Pytaj o słowo na głos" (Ask about the
  word aloud) on; off, the row is for the people around him and only a tap takes a word.
- **R9. His own words, on the device only.** With "Ucz się z moich zdań" (Learn from my sentences) on (default on,
  shown only when prediction is on), every sentence read aloud from Liczenie (Counting) (the same moment it goes to Zdania (Sentences),
  whether he nodded on "Przeczytać na głos?" (Read it aloud?) or a caregiver tapped "Przeczytaj" (Read aloud)) adds its words of 3–24 letters to
  `blinker.words.v1`: the word, a count and the day of the latest use, at most 2,000 words, the least recently used
  dropped first. A word he spelled without its Polish letters counts for the list's spelling when the list has it: the exact
  spelling first, otherwise the best-ranked list word it matches by R4 ("ZOLW" counts for "ŻÓŁW"; "ZE" stays "ZE",
  because "ze" is in the list), otherwise as he spelled it; so a taken suggestion and a spelled word add up. Read back, the store is validated like untrusted input (a bad store
  is ignored, not used). "Zapomnij moje słowa" (Forget my words) removes them after a confirmation; "Usuń wszystkie
  dane" (Delete all data) removes them too (`DeviceDataService.eraseAll()`, spec 013, R5). Off: nothing is learnt and
  the stored words are not used.
- **R10. Undo.** A shake at the columns right after a taken word undoes the whole step: the word and its space go and
  his prefix comes back exactly as he spelled it; "Cofnięto ŻÓŁW" (Undid ŻÓŁW) is said only with "Mów pytania i
  komunikaty" (Say the questions and notices) on, like other undos. The undone word joins the refused words, so it
  is not offered again for the same prefix. A taken word is learnt only when the sentence is read aloud (R9), so an
  undone word is never learnt.
- **R11. Nothing leaves the device and nothing is read aloud without his nod.** The list is our own static file; his
  words stay in localStorage under the `blinker.` prefix; the offer is a question, not the sentence: the sentence is
  still read aloud only after "Przeczytać na głos?" (Read it aloud?) and his nod.

# UI and accessibility notes

- The suggestion row is a labelled group (`role="group"`, the name "Podpowiedzi" (Suggestions)) of native buttons;
  the asked one has `aria-current="true"` and the visible "pytam" (asking). Targets at least 44 × 44 px (above SC 2.5.8,
  our convention); the word inside has the board's `lang` (SC 3.1.2).
- The offer is announced politely with the other questions (SC 4.1.3) and shown as the question of the status line.
- The pause before a suggestion is a setting from 1 to 10 s (ten times the range, SC 2.2.1); the offer never ends by
  itself, it waits for his answer like "Kolumna 7?" (Column 7?).
- Mobile first: the row fits at 360 px with 3 words of up to 12 letters (longer words are cut with an ellipsis on the
  screen, never in speech); the board still fits the viewport (check with the wider CI font,
  [knowledge](../../knowledge/layout-fits-with-a-wider-font.md)). Both languages (en, pl) for every new string.

# Security and privacy notes

- No third-party origin: the list is committed and served from `/words/`; `connect-src 'self'` is unchanged.
- The list is checked as untrusted input even though it is ours (R3): a stricter allowlist per line than the board
  import, caps in bytes and lines, and a whole-file rejection. Words are rendered with text bindings only.
- His words are personal data about what he says (special category, GDPR art. 9, see
  [security conventions](../../conventions/security.md)): only on the device, capped, validated when read back, under
  the `blinker.` prefix, with a reset in `DeviceDataService.eraseAll()` and a test that fills and erases it.
- License: the list is Adapted Material of a CC BY-SA 4.0 database, so `pl.txt` itself is shared under CC BY-SA 4.0
  with the attribution; the app's code is not an adaptation of it (ADR-0007).

# Acceptance criteria

- [ ] With the switch off (the default) Liczenie (Counting) behaves exactly as before: no offer, no row, no fetch of
      `/words/pl.txt`.
- [ ] Unit: the built `pl.txt` has 20,000 lines in frequency order, each matching the allowlist, none in the exclusion
      list; a file with one bad line, a file over 256 KB or over 20,000 lines is rejected.
- [ ] Unit: "ZOL", "ŻOL" and "ŻÓŁ" all give "żółw" (a plain letter stands for its Polish letter); "ŻO" does not
      give "zostać" (a Polish letter he spelled matches only itself); "SZ" is a
      prefix; a 1-letter prefix gives nothing; a word only 1 letter longer than the prefix is not offered; his words
      come first; the order is the same on every call.
- [ ] Unit (machine): with "Pytaj o słowo na głos" (Ask about the word aloud) off (the default), no `word.asking`
      and no `say` of a word, only the row; with it on, after a letter and the pause, `word.asking` with a `say` of the word; `NOD` replaces the prefix
      with the full spelling and a space as one step; `SHAKE` keeps the text and a second `SHAKE` changes nothing;
      `BLINK` counts 1 for the column; one shake after a taken word brings back the prefix; no second offer without a
      new letter; every state × signal pair is in the table.
- [ ] Unit: reading a sentence aloud learns its words; an undone word is not learnt; the store keeps at most 2,000
      words; a bad store is ignored; "Usuń wszystkie dane" (Delete all data) leaves no `blinker.words.v1`.
- [ ] e2e (3 device projects, with the signal buttons): both switches on; spell a prefix; after the pause the question shows
      the word; "Tak" (Yes) puts the word and a space in the sentence; "Nie" (No) twice keeps the prefix; undo brings
      the prefix back; a tap on a suggestion takes it; offline after the first load the suggestions still come.
- [ ] axe: no violations on Liczenie (Counting) with the row and an offer, and on Ustawienia (Settings) with the group.
- [ ] `npm run verify -- --lighthouse` passes; `dist/` holds `words/pl.txt` and its license file.

# Test plan

- **Unit (Vitest):**
  - R2, R3: `word-list.spec.ts`: parse and validate (the good file, one bad line, too big, too many lines, a BOM, a
    non-UTF-8 byte); the committed file passes; `scripts/word-list.test.mjs` (node --test) checks the build output
    and the exclusion list.
  - R4, R5: `predict.spec.ts`: the one-way match (a plain letter for its Polish letter, a Polish letter only for itself), digraph prefixes, minimum lengths, the order
    (his words, then rank), refused words left out, at most 3, the same result twice.
  - R6, R7, R10: `counting.spec.ts`: the new state in the table, the offer after the pause and not before, one offer
    per letter, each answer, the second shake, the undo of a taken word, no offer while counting or with the switch off.
  - Sentence: `sentence.spec.ts`: the `replace` step, its undo, the history cap.
  - R9: `my-words.spec.ts`: learn, merge with the list spelling, cap and drop order, validation of a bad store;
    `device-data.service.spec.ts` fills `blinker.words.v1` and expects it gone.
  - R1, R8: the Liczenie (Counting) page and the settings page specs: the row hidden when off, the asked word marked,
    a tap takes it; the switch disabled for an English board; the translation-keys test covers the new strings.
- **e2e (Playwright + axe, next e2e pass):** `counting-prediction.e2e.ts` with the acceptance path above on the three
  device projects; the offline case with the service worker after the first load (wait for the words group, see
  [knowledge](../../knowledge/angular-sw-ready-is-not-cached.md)); axe on both screens; the third-party request check
  stays green.

# Out of scope

- **Shortcuts for frequent words** ([backlog](../../backlog.md), to design with him after the PoC): a word chosen with
  one number instead of letters. Related but different: prediction guesses from what he spelled, a shortcut is a fixed
  place he learns. The board format already has `word` cells for it, and the counts of R9 could later suggest which
  words deserve a shortcut.
- Predicting the next word after a space (word pairs), phrases and favorite phrases, grammar (inflection) aware
  guesses.
- More than one suggestion by ear (a shake moving to the next word), and choosing a suggestion by number.
- Lists for other languages (English boards), and phonetic matches beyond the table of R4 (U for Ó, H for CH, Ż for
  RZ): decided after the trial.
- Prediction in scanning mode (after the PoC).

# Open questions (all answered by the author, 2026-11-20; the spec approved the same day)

1. ~~How does he spell Ł and Ó?~~ Answered 2026-11-20: he drops Polish letters sometimes, even those on his board,
   and uses them at other times; R4 lets a plain letter stand for its Polish letter.
2. ~~The offer by ear: help or distraction?~~ Answered 2026-11-20: it may help, but only as an option, off by default
   (R6, "Pytaj o słowo na głos" (Ask about the word aloud)).
3. ~~Learning from his sentences: on by default?~~ Answered 2026-11-20: yes, on by default once prediction is on;
   prediction itself stays off by default, so nothing changes until a caregiver turns it on (R1, R9).
4. ~~The word list: OpenSubtitles or Leipzig?~~ Answered 2026-11-20: OpenSubtitles (spoken language, CC BY-SA 4.0),
   ADR-0007 accepted.

Branch: `feat/016-word-prediction`.

# References

- FrequencyWords (Hermit Dave): Polish lists from OpenSubtitles 2018, "CC-by-sa-4.0 for content" https://github.com/hermitdave/FrequencyWords
  and the list used, `pl_50k.txt` https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/pl/pl_50k.txt
- Creative Commons BY-SA 4.0, the deed https://creativecommons.org/licenses/by-sa/4.0/ and the legal code (Adapted
  Material, Section 4 on databases) https://creativecommons.org/licenses/by-sa/4.0/legalcode.en
- Wiktionary, Polish frequency lists and their licenses (Leipzig CC BY 4.0, FrequencyWords CC BY-SA 4.0, Kelly NC) https://en.wiktionary.org/wiki/Wiktionary:Frequency_lists/Polish
- Angular service worker configuration, asset groups (`installMode`, `updateMode`) https://angular.dev/ecosystem/service-workers/config
- MDN `String.prototype.toLocaleUpperCase()` https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/toLocaleUpperCase
  and `String.prototype.normalize()` https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize
- WCAG 2.2: SC 2.2.1 Timing Adjustable https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html ·
  SC 2.5.8 Target Size (Minimum) https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html ·
  SC 3.1.2 Language of Parts https://www.w3.org/WAI/WCAG22/Understanding/language-of-parts.html ·
  SC 4.1.3 Status Messages https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- OWASP Input Validation Cheat Sheet (allowlists) https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- [ADR-0007](../../adr/0007-polish-word-list.md), [ADR-0001](../../adr/0001-pwa-without-backend.md);
  specs [006](../006-counting-core/spec.md) (the machine, the sentence), [008](../008-listener/spec.md) and
  [009](../009-letter-by-ear/spec.md) (by ear), [013](../013-delete-all-data/spec.md) (one erase, one prefix).
