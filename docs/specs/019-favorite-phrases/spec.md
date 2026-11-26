---
type: Spec
title: "019: Favorite phrases - Blinker recognizes a phrase from its first letters and asks"
description: A caregiver keeps a short list of his frequent phrases. When the letters he has spelled from the start of a sentence fit exactly one of them, Blinker shows the phrase and asks it aloud after a pause ("Zmień pozycję?" (Change my position?)); a nod takes the whole phrase, a shake refuses it, a blink goes on. Off by default, an empty list.
tags: [interaction, counting, prediction, privacy]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-26
---

# Goal

He says some things again and again: "Pić" (A drink), "Boli mnie" (It hurts), "Zmień pozycję" (Change my position),
"Odessać" (Suction). Each costs him the whole spelling: on [his board](../../boards/friend-board.md) a letter takes
about 4–5 signals and two pauses, so "Zmień pozycję" is some 60 signals. A caregiver at the paper board would guess it
after two letters. Blinker does the same for a short list of phrases the caregivers keep for him: it recognizes the
phrase from the first letters, asks him, and he takes it with one nod.

Decided by the author (2026-11-26):
- **off by default** and **an empty list**: the caregivers add what he really says;
- Blinker asks after **2 letters** at the earliest;
- the phrase is **shown and asked aloud**, so he can take it himself even when nobody looks at the screen.

The offer must stay predictable and forgiving (CLAUDE.md rule 13): it costs nothing when he goes on, it changes the
text only after his nod, one shake undoes it, and nothing is read aloud without "Przeczytać na głos?" (Read it aloud?)
and his nod.

# Scope

- A list of up to 20 phrases on the device (`blinker.phrases.v1`), kept by a caregiver in Zdania (Sentences): add by
  typing, add from the history with a star, delete (with Cofnij (Undo), spec 018), move up or down.
- A pure matcher: the sentence so far → the one phrase it starts, or none.
- A new state of the counting machine, `phrase.asking`, with the answers of R6, and a new step of the sentence,
  "replace the text with the phrase", undone by one shake.
- On the screen of Liczenie (Counting): the offered phrase above the board, a tap takes it.
- The switches in Ustawienia (Settings); the list in the backup (spec 017) and in "Usuń wszystkie dane" (Delete all
  data, spec 013).

# Rules

- **R1. Off by default.** Ustawienia (Settings) gets a group "Ulubione zwroty" (Favorite phrases) with a switch
  "Podpowiadaj ulubione zwroty" (Suggest favorite phrases), off by default, and "Pauza przed podpowiedzią" (Pause
  before a suggestion), 2.5 s by default, 1–10 s (SC 2.2.1), shown only when the switch is on. Off: Liczenie
  (Counting) behaves exactly as today; the list can still be kept in Zdania (Sentences). Spec 016 will use the same
  pause setting when it goes on.
- **R2. The list.** In Zdania (Sentences), a section "Ulubione zwroty" (Favorite phrases), empty at the start, says
  in text how the list is used and that the switch is in Ustawienia (Settings). A phrase:
  - is added by typing ("Dodaj zwrot" (Add a phrase)) or by the star button "Dodaj do ulubionych" (Add to favorites)
    of a sentence in the history (a sentence already on the list shows a filled star, and the button is disabled);
  - is 2–60 characters after trimming, letters of any language, digits, spaces and `.,!?-'`; the same phrase twice
    (compared as in R3) is refused; at most 20 phrases. A refused phrase gets an error as text under the field
    (SC 3.3.1);
  - is deleted with "Usuń zwrot" (Delete the phrase), with a toast and Cofnij (Undo) (spec 018, R6), no dialog;
  - is moved with "W górę" (Up) and "W dół" (Down) buttons (no dragging, SC 2.5.7). The order matters only for the
    caregiver's reading of the list; it never decides which phrase is offered (R3).
- **R3. The match: the whole sentence is the start of exactly one phrase.** The text of the sentence so far, from its
  first letter, at least **2 letters** (spaces do not count), is compared with the start of each phrase after NFC, upper
  case in the board's language, and with runs of spaces as one space and punctuation of the phrase left out. With a
  Polish board a plain letter of his text also stands for its Polish letter, and a Polish letter he spelled matches
  only itself (the table of spec 016, R4, one shared constant). An offer is made only when **exactly one** phrase
  matches and that phrase is at least 2 letters longer than his text (it must save signals); with two or more matches
  he goes on spelling until one is left. The same text and list always give the same result.
- **R4. The offer, when he pauses.** With the switch on, while Blinker waits for a column (`column.waiting` or
  `column.rejected`) and R3 gives a phrase, and no signal came for "Pauza przed podpowiedzią" (Pause before a
  suggestion) after the last letter, Blinker offers it: the state is `phrase.asking`, the phrase is shown as the
  question of the status line and above the board (R7), and **said aloud** as a question ("Zmień pozycję?"), whatever
  "Mów pytania i komunikaty" (Say the questions and notices) is, because he listens. At most one offer for the same
  text: a letter added or undone makes a new text and restarts the pause. While he is giving a number, during another
  question, a reading or the pause, nothing is offered. The offer never ends by itself; it waits for his answer like
  "Kolumna 7?" (Column 7?).
- **R5. Refused phrases.** A phrase refused with a shake (R6) or undone (R8) is not offered again until the sentence
  is cleared or read aloud.
- **R6. His answer.** In `phrase.asking`:
  - `NOD`: his text is replaced by the phrase, in upper case like the board's letters, as one step of the sentence;
    then Blinker asks "Przeczytać na głos?" (Read it aloud?) at once (`speak.asking`), because a favorite phrase is
    usually the whole message. There a nod reads it, and a shake goes back to the columns with the phrase kept, so he
    can add to it;
  - `SHAKE`: the text stays; the phrase is refused (R5) and Blinker goes to `column.rejected`, so a second shake right
    after changes nothing (it does not delete the last letter,
    [knowledge](../../knowledge/no-depends-on-context.md));
  - `BLINK` / `HAND`: he goes on: the offer is dropped and the signal counts as the first number of the column, as in
    "Nowe zdanie?" (New sentence?);
  - `RIGHT`: "Przeczytać na głos?" (Read it aloud?) with his own text, as at the columns; `PAUSE`: the pause, back to
    the columns after;
  - `TICK`, `SPOKEN`: nothing; `TOUCH`: as in every other state, and a tap on the offered phrase (a new tap target
    `{ kind: 'phrase', phrase }`) takes it like a nod.
  The machine's table lists every signal for the new state.
- **R7. On the screen.** Above the board, in a row that keeps its height so the board does not jump (shown only when
  the switch is on), the offered phrase is a button "Zwrot: Zmień pozycję" (Phrase: Change my position), at least
  44 px high, in the board's `lang`; a tap takes it (R6). Nothing is shown when there is no offer. His signals cannot
  reach the button; by ear he hears the question.
- **R8. Undo.** At the columns, after a shake at "Przeczytać na głos?" (Read it aloud?), one more shake undoes the
  taken phrase as one step: his letters come back exactly as he spelled them; "Cofnięto zwrot" (Undid the phrase) is
  said only with "Mów pytania i komunikaty" (Say the questions and notices) on, like other undos. The phrase is
  refused (R5).
- **R9. On the device only, checked when read back.** `blinker.phrases.v1`: an array of at most 20 strings, each
  checked as in R2 when read back; a bad store is ignored (not used, not overwritten until a caregiver saves the list
  again), like the other stores. Phrases are part of the backup file (spec 017: a part `phrases`, checked by the same
  validator; a file without it, as from before this spec, keeps the phrases of the device, like the history) and
  are erased by "Usuń wszystkie dane" (Delete all data) (`DeviceDataService.eraseAll()`). Nothing about phrases leaves
  the device.

# UI and accessibility notes

- The list is a native list of phrases with a text label each; "W górę" (Up), "W dół" (Down) and "Usuń zwrot"
  (Delete the phrase) are buttons with the phrase in their accessible name ("Usuń zwrot: Pić" (Delete the phrase:
  A drink)); the first "W górę" (Up) and the last "W dół" (Down) are disabled. Targets at least 44 × 44 px.
- After a move the focus stays on the moved button, and a toast is not used (a move shows itself; spec 018, R5).
- The offer is announced politely with the other questions (SC 4.1.3); the button above the board has the board's
  `lang` (SC 3.1.2).
- Mobile first: the row fits at 360 px; a long phrase is cut with an ellipsis on the screen, never in speech; checked
  with the wider CI font ([knowledge](../../knowledge/layout-fits-with-a-wider-font.md)). Both languages for every new
  string.

# Security and privacy notes

- Phrases are what he says: personal data of a special category (GDPR art. 9,
  [security conventions](../../conventions/security.md)). On the device only, under the `blinker.` prefix, capped,
  validated when read back and when restored from a file, erased with the rest. A toast never shows a phrase:
  "Usunięto zwrot." (Deleted the phrase.), like a sentence (spec 018).
- Phrases are rendered with text bindings only; the allowlist of R2 keeps control characters and markup out.

# Acceptance criteria

- [ ] With the switch off (the default) Liczenie (Counting) behaves exactly as before: no offer, no row.
- [ ] Unit (matcher): with "Pić", "Pić herbatę" and "Zmień pozycję": "ZM" gives "Zmień pozycję"; "PI" gives nothing
      (two match); "PIC H" gives "Pić herbatę" (a plain C for Ć); "Z" gives nothing (one letter); "ZMIEŃ POZYCJ" gives
      nothing (not 2 letters shorter); the same call twice gives the same result; an English board does not use the
      Polish table.
- [ ] Unit (machine): after 2 letters and the pause, `phrase.asking` with a `say` of the phrase; `NOD` replaces the
      text and asks "Przeczytać na głos?" (Read it aloud?); `SHAKE` keeps the text and a second `SHAKE` changes
      nothing; `BLINK` counts 1 for the column; no second offer without a new letter; a refused phrase is not offered
      again until the sentence is cleared; one shake at the columns after a taken phrase brings back his letters;
      every state × signal pair is in the table.
- [ ] Unit (list): add, refuse a duplicate, a phrase too long or with a forbidden character, at most 20; delete with
      Cofnij (Undo); move up and down; the star in the history; a bad store is ignored; the backup round trip and a
      file without phrases; "Usuń wszystkie dane" (Delete all data) leaves no `blinker.phrases.v1`.
- [ ] e2e (3 device projects, with the signal buttons): the switch on, "Zmień pozycję" on the list; spell "ZM"; after
      the pause the question and the button show the phrase; "Tak" (Yes) puts it in the sentence and asks to read it;
      a tap on the button takes it; "Nie" (No) keeps "ZM"; axe on Liczenie (Counting) with an offer and on Zdania
      (Sentences) with the list.
- [ ] `npm run verify -- --lighthouse` passes.

# Test plan

- **Unit (Vitest):** `phrases.spec.ts` (the validator, the store, the matcher); `counting.spec.ts` (the new state, the
  answers, the refused phrases, the undo); `sentence.spec.ts` (the replace step and its undo); the Zdania (Sentences),
  Liczenie (Counting) and Ustawienia (Settings) page specs; `backup.spec.ts` and `device-data.service.spec.ts`; the
  translation-keys test covers the new strings.
- **e2e (Playwright + axe):** `e2e/phrases.e2e.ts` with the acceptance path above.

# Out of scope

- A board of phrases chosen by a number (a separate mode he would have to learn): to ask him in the first session.
- Phrases learnt by themselves from his history (a caregiver decides what is on the list).
- Offering a phrase in the middle of a sentence, or more than one phrase by ear.
- Word prediction itself (spec 016, paused); this spec only shares the pause setting and the table of Polish letters
  with it.

# Open questions

1. Does he take the offer with a nod, or does it break his rhythm? To watch in the first session
   ([checklist](../../trial/first-session.md)).

# References

- WCAG 2.2: SC 2.2.1 Timing Adjustable https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html ·
  SC 2.5.7 Dragging Movements https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html ·
  SC 2.5.8 Target Size (Minimum) https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html ·
  SC 3.1.2 Language of Parts https://www.w3.org/WAI/WCAG22/Understanding/language-of-parts.html ·
  SC 3.3.1 Error Identification https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html ·
  SC 4.1.3 Status Messages https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- MDN `String.prototype.normalize()` https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize
  and `String.prototype.toLocaleUpperCase()` https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/toLocaleUpperCase
- OWASP Input Validation Cheat Sheet (allowlists) https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- Specs [006](../006-counting-core/spec.md) (the machine, the sentence), [009](../009-letter-by-ear/spec.md) (by ear),
  [013](../013-delete-all-data/spec.md), [016](../016-word-prediction/spec.md) (the offer by ear, the Polish letters),
  [017](../017-backup/spec.md), [018](../018-toasts/spec.md).
