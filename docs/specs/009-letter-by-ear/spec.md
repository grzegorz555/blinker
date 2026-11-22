---
type: Spec
title: "009: The letter by ear - Blinker says only the chosen letter; a pause moves on, a shake starts the letter again"
description: The author (2026-11-14) after trying spec 008 - the voice says too much. Blinker says only the letter chosen after the column and the row, and the whole sentence when he asks for it. No "Kolumna 7?" (Column 7?) or "Wiersz 3?" (Row 3?) - a pause after the column moves on to the row, a pause after the row adds the letter and says it; blinking again starts the next letter, a shake undoes it.
tags: [stage-2, counting, interaction, speech]
status: stable
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-14
---

# Goal

The author (2026-11-14): "za dużo też mówi lektor" (the voice says too much too); it "powinno tylko mówić (…) jedną
literę (po wyborze kolumny i wiersza), cały odczyt jak będzie chciał" (should say only the one letter after the column
and the row are chosen, and the whole reading when he wants it); "nie powinna mówić »Kolumna x«, »Wiersz y«" (it should
not say "Column x", "Row y"); "jak zostanie usłyszana po krótkiej przerwie od mrugania i zacznie znowu mrugać to już
kolejna litera, jak zaprzeczy głową to od nowa litera" (once the letter is heard after a short pause and he starts
blinking again, that is the next letter; if he shakes his head, the letter starts over).

# Rules

- **R1. A pause moves on, no nod per number.** A new setting `confirmByNod` ("Potwierdzaj kolumnę i wiersz skinieniem"
  (Confirm the column and the row with a nod)), **off by default**. Off: the pause after the column (`askAfterMs`)
  confirms the column and waits for the row; the pause after the row chooses the cell: a letter or word is added and
  **said**, an action is carried out. On: the questions of spec 006 as before.
- **R2. A shake starts the letter again.** While he gives the row, a shake goes back to the columns (spec 006). Right
  after a letter (waiting for a column), a shake undoes it (spec 006 R5), so he gives the letter again. Blinking again
  after a letter is the next letter's column: nothing to confirm.
- **R3. Only the letter and the reading are said.** `speakQuestions` becomes `speakPrompts` ("Mów pytania
  i komunikaty" (Say the questions and notices)), **off by default**; the old stored `speakQuestions` is dropped, so
  every device starts quiet. Off: Blinker says only the chosen letter or word, and the sentence when he reads it
  (head right, nod). Questions ("Przeczytać na głos?" (Read it aloud?), "Nowe zdanie?" (New sentence?)), notices (an
  undo, a space, a rejection, a cleared sentence) are shown and announced to screen readers, not said. On: as spec 008.
- **R4. Nothing else changes.** Undo, space, read aloud, clear, pause and taps work as in specs 006–008; every
  (state, signal) pair stays explicit (12 × 9).

# Acceptance criteria

- [x] With the defaults: blinks for the column, a pause, blinks for the row, a pause: the letter is added and said;
      nothing else is said (R1, R3).
- [x] With the defaults: a shake right after the letter removes it; blinks right after it start the next letter (R2).
- [x] With `confirmByNod` on: "Kolumna 7?" (Column 7?) and a nod, as before (R1).
- [x] With `speakPrompts` on: the questions and notices are said as before (R3).
- [x] Old stored settings with `speakQuestions: true` load, and the voice is quiet (R3).
- [x] `npm run verify -- --lighthouse` passes.

# Test plan

- Unit: the table with the defaults and with both settings on; a pause chooses the column, then the cell; the effects
  hold only the letter's `say`; a shake after the letter undoes it; the settings validator drops `speakQuestions`.
- e2e (fake on-device voice): the path by the signal buttons with the defaults (only "W" said); the two switches in
  Ustawienia (Settings); axe.

# Out of scope

- A sound (a beep) instead of the voice for the column: the author can ask after the trial (stage 6).

# References

- Specs [006](../006-counting-core/spec.md) R4–R6, [008](../008-listener/spec.md); `docs/interaction-model.md`;
  learning [no-depends-on-context](../../knowledge/no-depends-on-context.md).
- WCAG 2.2: Status Messages https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html (the notices stay in the
  live region); Timing Adjustable https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html (the pause is
  500–5000 ms).
