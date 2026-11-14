---
type: Spec
title: "008: Liczenie (Counting) for a listener - head shortcuts said aloud, a new sentence after reading, the sentence big"
description: Stage 2 follow-up after the author's answers on 2026-11-14 - he knows the digits and the letter under each column and row, but builds words by ear, not by reading. Every shortcut is a head signal and is said aloud; after reading aloud Blinker asks "Nowe zdanie?" (New sentence?); the screen shows the sentence big and the prompts small.
tags: [stage-2, counting, accessibility, interaction]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-14
---

# Goal

He spells by numbers (column, then row) and **composes words by ear; he does not read**. So what reaches him must be
heard, and the frequent actions need quick head signals. The author (2026-11-14): "na spację powinna być jakaś szybka
metoda" (space needs a quick method), "na przeczytanie i czyszczenie też musimy wymyślić jakieś skróty" (shortcuts for
reading aloud and clearing too), "lub na cofanie litery" (or for undoing a letter), and "Podaj kolumnę" (Give the
column) "małym druczkiem u góry, a dużymi literami zdanie" (small print at the top, the sentence in big letters).

# Decisions (author, 2026-11-14, from the question form)

- He knows the digits and which letter is under a column and row; words are put together by ear.
- **Space**: stays a nod without a number while Blinker waits for a column (one signal, spec 006).
- **Read aloud and clear**: head right → "Przeczytać na głos?" (Read it aloud?) → nod reads; **when the reading ends Blinker
  asks "Nowe zdanie?" (New sentence?)**: a nod clears (undo brings it back), a shake keeps it.
- **Layout**: the prompts small at the top, the sentence big above the board.

# Rules

- **R1. Shortcuts by head, all said aloud.** At the columns: nod without a number = space, shake = undo the last step;
  head right = read aloud (after the question). Each result is said, not only shown: an undo says what it removed
  ("Cofnięto A" (Undid A)).
- **R2. A space says the word.** A space after a word says **the word just finished** ("CHCĘ"), so he hears what he
  built; the notice on screen stays "Spacja" (Space). No space at the start or twice (spec 006).
- **R3. "Nowe zdanie?" (New sentence?) after reading.** A new signal `SPOKEN` comes from the speaker when a reading
  ends; in `speaking` it leads to a new state `clear.asking` with the question said aloud. There: nod = clear the
  sentence (one undo brings it back) and say "Nowe zdanie" (New sentence); shake = keep it, back to writing; a blink or
  a hand = he goes on with the sentence (starts a number); head right = read it again (the question); pause and taps
  as everywhere. `SPOKEN` in every other state changes nothing. The table grows to 12 × 9 pairs, every pair explicit.
- **R4. Layout for a listener and his helpers.** Liczenie (Counting): at the top a small status line (the prompt, such
  as "Podaj kolumnę" (Give the column), and the counter); below it the sentence in big letters with its actions; the
  board below that (portrait). Landscape: the board on the left, the status, sentence and actions on the right. The
  step label goes. The board still fits at every size of spec 007, also with the wide font.
- **R5. Hints for helpers** stay small text (they are for a caregiver), and say the shortcuts of the moment.

# Acceptance criteria

- [ ] The table test covers 12 × 9 pairs; SPOKEN changes nothing outside `speaking` (R3).
- [ ] Head right, nod: read aloud; when it ends: "Nowe zdanie?" is said; nod clears and a shake at the columns brings
      it back; shake keeps the sentence (R3).
- [ ] A space after "TAK" says "TAK"; an undo says what it removed (R1, R2).
- [ ] The sentence is the biggest text on Liczenie (Counting), above the board; the prompt is small at the top; the
      board fits at 360 × 640 … 1280 × 800 in both orientations, also with a wide font (R4).
- [ ] `npm run verify -- --lighthouse` passes.

# Test plan

- Unit: the table test (12 × 9); paths: read → SPOKEN → "Nowe zdanie?" → nod clears → shake at the columns undoes;
  → shake keeps; → blink continues; space says the word; undo is said; the service turns the speaker's end into
  SPOKEN only while reading.
- e2e (fake on-device voice that ends on demand): read aloud with the signal buttons, the question after the end, nod
  clears, undo brings it back; layout fit with the sentence above the board; axe.

# Out of scope

- An auditory scanning mode (the board read aloud letter by letter) and a picture board: not needed, he knows the
  digits and the letters under them.

# References

- Spec [006](../006-counting-core/spec.md) R4–R5 and [007](../007-screens/spec.md) R3–R4; interaction model
  `docs/interaction-model.md`; learning [no-depends-on-context](../../knowledge/no-depends-on-context.md).
- WCAG 2.2: Status Messages https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html; Timing Adjustable
  https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html
- Web Speech API, utterance end event: https://developer.mozilla.org/docs/Web/API/SpeechSynthesisUtterance/end_event
