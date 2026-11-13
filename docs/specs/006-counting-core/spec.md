---
type: Spec
title: "006: Counting core - board, sentence, the counting state machine and speech, without UI"
description: Stage 2, part 1. The board format v1 with a validator and his board as the default, the sentence with undo, the counting state machine (every state and signal mapped explicitly, time injected), signal input from buttons and keys that can be turned off, and speech behind an interface with on-device voices only. Plain TypeScript with thin Angular services; the screens come in spec 007.
tags: [stage-2, counting, state-machine, boards, speech]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-13
---

# Goal

The logic Blinker needs to let him talk, without a camera and without screens: a board, a sentence, the counting
machine that plays the caregiver's role ("Kolumna 7?"), the signals as input, and speech. Spec 007 builds the
Liczenie screen and the shell on top of it; stages 3–4 replace the on-screen buttons with his face signals, without
changing this core.

# Scope

- **Board format v1** (`docs/board-format.md` finalized) with a validator for imported files and his board
  (`friend-board.md`, 7×5, copied 1:1) as the built-in default.
- **Sentence**: the text he builds, with undo of what this session added.
- **Counting state machine** (mode B from `docs/interaction-model.md`): plain TypeScript, every (state, signal)
  pair mapped explicitly, time injected, the pause before the question configurable.
- **Signal input**: one `Signal` type for every source; the keyboard mapping (Space, H, N, S, R, P) can be turned off
  (SC 2.1.4); on-screen buttons and his face signals (stage 4) feed the same function.
- **Speech**: a `Speaker` interface over the Web Speech API, Polish voice, on-device voices only, cancel and queue.
- **Thin Angular services** that hold the machine state in signals for spec 007.

# Rules

- **R1. Board format v1.** `{ schemaVersion: 1, id, name, locale, columns: string[], rows: string[], cells }`, cells as
  `cells[row][column]`, each `null` (empty) or `{ type: 'char' | 'word' | 'action', value }`:
  - `char`: 1–2 characters (SZ, CZ); `word`: 1–20 characters, appended with a trailing space; `action`: one of
    `space | delete | speak | clear | undo`;
  - 1–10 columns and 1–10 rows; every row has one cell per column; `locale` is a BCP 47 tag (`pl`);
  - his board is `src/web/public/boards/friend-pl.json`, identical to `friend-board.md` (a test compares them).
- **R2. Imported boards are untrusted input** (`docs/conventions/security.md`): at most 64 KB before parsing;
  `JSON.parse` in a `try`; every field checked by type, length and allowed values; unknown fields rejected;
  `__proto__`, `constructor` and `prototype` keys rejected; errors returned as data (`{ path, code }`), so the UI can
  show them in text (SC 3.3.1). Our own validator, not a JSON Schema library: Ajv compiles schemas with
  `new Function`, which our CSP (no `unsafe-eval`) and Trusted Types block. The JSON Schema in `docs/board-format.md`
  documents the format for people.
- **R3. Sentence.** Appends a cell (`char` as is, `word` plus a space, actions `space`, `delete`, `clear`); `undo`
  removes the last thing **this session** added, never text it did not write; `clear` only after a confirmed yes
  (R5). It keeps the history needed for undo, at most 200 steps.
- **R4. Counting machine, states and signals.** States: `column.waiting`, `column.counting`, `column.asking`,
  `column.rejected`, `row.waiting`, `row.counting`, `row.asking`, `row.rejected`, `speak.asking`, `speaking`,
  `paused`. Signals: `BLINK` (+1), `HAND` (+5), `NOD`, `SHAKE`, `RIGHT` (finish), `PAUSE` (toggle), and `TICK(now)`
  for time. The machine is a pure function `next(state, signal, config) → { state, effects }`; **every (state, signal)
  pair has an explicit entry**, no default branch for signals that change the text
  ([learning](../../knowledge/no-depends-on-context.md)). The state holds the sentence (T2), so the machine decides
  every change of the text itself. Effects, as data for the service: `ask`, `say`, `announce` (Transloco keys with
  parameters) and `speak(text)` (read the sentence aloud).
- **R5. Counting behavior** (interaction model, mode B):
  - `BLINK` adds 1, `HAND` adds 5 while giving a number; after `config.askAfterMs` without a signal (default 1200 ms,
    from 500 to 5000, SC 2.2.1) the machine asks "Kolumna N?" / "Wiersz N?" (effects `ask`, and `say` if
    `config.speakQuestions`);
  - a number past the board, or an empty cell, is rejected with a reason;
  - `NOD` on a question confirms it; on the row question it appends the cell and says the letter;
  - **`NOD` without a number while waiting for a column adds a space** (the end of a word; author, 2026-11-13): shown
    and said as "Spacja", undone by a `SHAKE` like any letter; on an empty sentence, or one that already ends with a
    space, it adds nothing and says so;
  - `SHAKE` on a question rejects the number; **a second `SHAKE` right after a rejection changes nothing**; `SHAKE`
    while waiting for a row goes back to the columns; `SHAKE` while waiting for a column undoes the last letter added;
  - `RIGHT` asks "Przeczytać na głos?"; only `NOD` then says the sentence; `SHAKE` goes back to writing;
  - **nothing is said aloud and nothing is cleared without a `NOD`**; `PAUSE` stops every signal except `PAUSE`.
- **R6. Time is injected.** The machine never reads the clock or sets timers. The Angular service passes
  `TICK(now)` from one scheduler, so tests drive time by hand (no fake timers needed for the machine).
- **R7. Signal input.** `Signal` is the only input type. A keyboard mapping (Space = `BLINK`, H = `HAND`, N = `NOD`,
  S = `SHAKE`, R = `RIGHT`, P = `PAUSE`) is **off by default** and can be turned on in settings (SC 2.1.4); it ignores
  key repeats, modifier keys, and Space or Enter on a focused control. The on-screen buttons of spec 007 call the
  same function.
- **R8. Speech, on the device.** A `Speaker` interface (`say(text, { lang, rate })`, `cancel()`, `speaking` with `subscribe()`; the Angular
  service exposes it as a signal, so the core stays free of Angular) with a
  Web Speech implementation: only voices with `localService === true` for the board locale, so no text leaves the
  device; if there is none, `say` does nothing and reports `no-local-voice` (shown in spec 007 in text). A new `say`
  cancels the previous one. A fake `Speaker` for tests.
- **R9. Angular services stay thin.** `CountingService` holds `state` in a signal, feeds signals to `next()`, runs
  the effects (sentence, speaker, announcements) and owns the one scheduler for `TICK`. No logic in the service that
  the machine could hold.

# UI and accessibility notes

- No screen in this spec. Everything a screen will show is produced as data: the question text, the counter parts
  (`[5, 1, 1]`), the pointer (column, row), the reason of a rejection, announcements for a polite live region
  (SC 4.1.3).
- Texts are Transloco keys with parameters (`counting.askColumn`: "Kolumna {{n}}?"), in `en.json` and `pl.json`;
  the machine returns keys and parameters, not strings, so it has no language.
- The keyboard mapping is off by default (R7). He uses his head; the keys are for tests and caregivers.

# Security and privacy notes

- Imported boards: R2. A board never becomes markup: spec 007 renders cell values with text bindings only.
- Speech: on-device voices only (R8). Some browsers offer network voices (for example Google voices in Chrome);
  using them would send his sentences to a third party.
- No new dependency. No storage in this spec (boards and settings are kept in memory; persistence comes with 007).

# Acceptance criteria

- [ ] `friend-pl.json` validates and equals the table in `friend-board.md`; the validator rejects every invalid case
      in the test plan with the right path and code (R1, R2).
- [ ] The machine's table test lists every (state, signal) pair and its result; there is no untested pair (R4).
- [ ] The behavior cases of R5 pass, including a double shake after a rejection, and "no speech or clear without a
      nod" (R5).
- [ ] Time only enters through `TICK`; the machine module has no `Date`, `setTimeout` or `performance` (a lint rule or
      a test checks it) (R6).
- [ ] The keyboard mapping is off by default and follows R7 (R7).
- [ ] Only local voices are used; with none, nothing is spoken and the reason is reported (R8).
- [ ] `npm run verify` passes; the existing e2e suite passes unchanged (no UI change).

# Test plan

- **Unit (Vitest):**
  - board validator: valid friend board; size over 64 KB; not JSON; not an object; unknown field; `__proto__` key;
    wrong `schemaVersion`; 0 and 11 columns; a row too short; `char` of 3 characters; `word` of 21; unknown action;
    a value with markup kept as text; every error has `path` and `code`;
  - friend board: the JSON equals the Markdown table in `friend-board.md` (parsed in the test);
  - sentence: append char, word, space; delete; undo of each, in order; undo with an empty history does nothing;
    clear; history capped at 200;
  - machine, **table test**: every state × every signal → expected state and effects (11 × 7 = 77 rows);
  - machine, paths: hand + 2 blinks = 7 → ask after `askAfterMs` (and not before) → nod → row 3 → nod → "W"
    appended and said; 10 → rejected with the reason; empty cell → rejected; double shake; undo at the columns;
    finish → no → back; finish → yes → speak; pause ignores signals; `askAfterMs` from config; a nod without a
    number adds a space, a shake removes it, a nod after a space or on an empty sentence adds nothing;
  - keyboard mapping: off by default; on → each key → its signal; repeat, modifiers, Space on a button ignored;
  - speaker: picks a local Polish voice; ignores network voices; none → `no-local-voice`; a new `say` cancels;
  - `CountingService` with a fake scheduler and speaker: a full path drives the sentence and the speaker.
- **e2e:** none new (no user-visible change); the existing suite and axe pass.

# Out of scope

- Screens (spec 007), the camera and face signals (stages 3–4), scanning mode (after the PoC), storing boards and
  settings, the board editor, shortcuts for frequent words.

# References

- Interaction model: `docs/interaction-model.md`; learning: `docs/knowledge/no-depends-on-context.md`.
- WCAG 2.2: Character Key Shortcuts https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html;
  Timing Adjustable https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html; Status Messages
  https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- Web Speech API https://webaudio.github.io/web-speech-api/; MDN SpeechSynthesis
  https://developer.mozilla.org/docs/Web/API/SpeechSynthesis, SpeechSynthesisUtterance
  https://developer.mozilla.org/docs/Web/API/SpeechSynthesisUtterance, `localService`
  https://developer.mozilla.org/docs/Web/API/SpeechSynthesisVoice/localService
- OWASP Input Validation Cheat Sheet https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- JSON Schema 2020-12 (documentation of the format) https://json-schema.org/draft/2020-12
- Angular signals https://angular.dev/guide/signals; Web Workers (later, for the detector)
  https://angular.dev/ecosystem/web-workers
- Vitest timers (for the service scheduler only) https://vitest.dev/guide/mocking/timers
