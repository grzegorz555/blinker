---
type: Spec
title: "007: Screens - the shell, Liczenie (Counting), boards, settings and sentences on Angular Material"
description: Stage 2, part 2. Angular Material (M3) on our tokens, the app shell with a custom navigation bar and rail, the Liczenie (Counting) screen on the spec 006 core with on-screen signal buttons and touch, settings, boards with import, and the sentence history, all kept on the device.
tags: [stage-2, ui, counting, angular-material, accessibility]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-14
---

# Goal

Make Blinker usable without a camera: a caregiver, a switch or the keys give his signals, the board on the screen
follows the counting machine from spec 006, and the sentence is read aloud on the device. The screens follow the
approved mock-ups ([design](../../design/index.md)) and ADR-0005: Angular Material for the components it provides,
our own navigation bar and rail, board and Liczenie (Counting) layout. Stages 3–4 then only add the face as one more
signal source.

# Scope

- Angular Material and the CDK on our tokens; the stage 2 spike from ADR-0005 (zoneless, CSP, Trusted Types).
- The shell: top app bar, navigation bar below 600 px and rail from 600 px, routes for the pages.
- Liczenie (Counting) at `/`: board, question with the counter, sentence with its actions, on-screen signal buttons,
  touch on cells, the keyboard mapping from settings, the screen kept awake.
- One core change: a `TOUCH` signal, so that tapping a cell or an action goes through the machine like every other
  change of the text.
- Ustawienia (Settings), Tablice (Boards) with import, Zdania (Sentences) with the history, all stored on the device.

# Rules

- **R1. Angular Material on our tokens** (ADR-0005). `@angular/material` and `@angular/cdk`; the M3 theme maps the
  system tokens to `tokens.css`, so the colors and contrast ratios of the design stay as they are; the system font
  stack; icons stay inline SVG (no Material Symbols font, no `MatIconRegistry`). Before any screen uses it, a spike
  proves that a dialog, a slide toggle and a select work **zoneless**, under our CSP and Trusted Types, with no
  console errors (the existing e2e CSP guard). spartan-ng and its MCP server are removed from the repo and the docs.
- **R2. Shell** (design, App structure): a small top app bar (the page title, and "Pauza" (Pause) on Liczenie
  (Counting)); the same navigation in the same order on every page (SC 3.2.3), the current page with
  `aria-current="page"`: **Liczenie** (Counting) · **Zdania** (Sentences) · **Tablice** (Boards) · **Ustawienia**
  (Settings). Below 600 px a bottom **navigation bar** (icons with labels, targets at least 44 px, safe-area
  padding); from 600 px a **navigation rail** on the left. Both are our components (`<nav>` with links), in portrait
  and landscape. **Kalibracja** (Calibration) joins the navigation in stage 4, when there is a camera to calibrate.
  The shell is exactly the viewport high and only the main area scrolls, so nothing slides under the navigation bar.
  The skip link stays, in the top app bar over the page title; the footer disclaimer moves to Ustawienia (Settings),
  section "O aplikacji" (About).
- **R3. Touch through the machine.** A new signal `TOUCH` with a target: a cell (`row`, `column`) or an action
  (`undo`, `clear`, `speak`). It is a deliberate choice by the person who taps, so it needs no nod:
  - a cell appends its value (R1 of spec 006) and says it, from any writing state; the number being given is dropped
    and the machine waits for a column;
  - `undo` removes the last thing this session added; `speak` reads the sentence aloud; `clear` is sent only after the
    confirmation dialog (R5), so the machine clears at once;
  - `paused` ignores `TOUCH` like every other signal except `PAUSE`; in `speaking` a tap goes on writing, like a
    blink does (the machine does not know when the reading ends, so ignoring taps there could lock the board), and
    `speak` reads the sentence again.
  The table test grows to 11 × 8 pairs; every pair stays explicit.
- **R4. Liczenie (Counting) screen** (design, Screens and states; spec 004 layout):
  - the board as a table with column and row headers (the numbers he gives), each cell a button with the cell
    value as text, `lang` from the board's `locale`; empty cells are not buttons; cells at least 32 px;
  - the pointer (the active column, then the cell) with a 4 px outline and bold text, never color alone (SC 1.4.1);
  - the question and the counter ("Kolumna 7?" (Column 7?), `[5, 1, 1]` as a hand and two blinks), the notice
    (rejected and why, "Dodano W" (Added W), "Spacja" (Space)); announcements in one polite live region (SC 4.1.3);
  - the sentence, large, with "Cofnij literę" (Undo letter), "Wyczyść" (Clear) and "Przeczytaj" (Read aloud) as the
    one filled button; "Pauza" (Pause) as a toggle button (`aria-pressed`);
  - portrait: question, board, sentence from top to bottom; landscape: board left, pane right; the board is never
    covered or scrolled at 360 × 640, 390 × 844, 768 × 1024, 1280 × 800 and in landscape, also with a wider font
    ([learning](../../knowledge/layout-fits-with-a-wider-font.md));
  - the hints line ("Podpowiedzi w Liczeniu" (Hints in Counting)) shown only when the setting is on.
- **R5. Confirmations and undo** (CLAUDE.md rule 13): "Wyczyść" (Clear) opens a modal dialog (Angular Material,
  [APG dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)) with "Anuluj" (Cancel) focused
  first; the same for deleting a board or the sentence history. Everything else can be undone.
- **R6. Signal buttons** (stage 2 input): a panel with his six signals as buttons, "Mrugnięcie +1" (Blink +1),
  "Ręka +5" (Hand +5), "Skinienie: tak" (Nod: yes), "Kręcenie głową: nie" (Shake: no), "Głowa w prawo: koniec" (Head right: finish), each sending its `Signal`
  through `CountingService.send()`; "Pauza" (Pause) is the toggle in the top bar, so it is not repeated. On a phone the
  labels are short ("+1", "tak" (yes)) and the full name stays in the accessible name (SC 2.5.3). Shown by default in stage 2 (there is no camera yet), hidden by a setting. The
  keyboard mapping from spec 006 (R7) is attached on this screen only when its setting is on (SC 2.1.4).
- **R7. Speech on the screen.** The status of the voice is visible in text: while reading, the question says "Czytam na
  głos" (Reading aloud) and "Przeczytaj" (Read aloud) turns into "Zatrzymaj" (Stop); with **no local voice** the
  question card says "Brak polskiego głosu na urządzeniu" (No Polish voice on the device) in one line, and Ustawienia
  (Settings) explains what to install. Never a silent failure, and no extra row that would take the board's height.
- **R8. Screen awake.** While Liczenie (Counting) is visible, a
  [Screen Wake Lock](https://developer.mozilla.org/docs/Web/API/Screen_Wake_Lock_API) keeps the screen on; it is
  taken again after the page becomes visible and released when he leaves the screen. Where the API is missing,
  nothing breaks.
- **R9. Ustawienia (Settings)**, Angular Material form controls with visible labels:
  - Liczenie (Counting): the pause before the question (`askAfterMs`, 500–5000 ms, error in text outside the range,
    SC 2.2.1 and 3.3.1), say the questions aloud, the signal buttons, the keyboard mapping, the hints line;
  - Głos (Voice): speech rate, the voice status (R7) and a "Posłuchaj" (Listen) test button;
  - Wygląd (Appearance): language (English, Polski) and theme (system, light, dark → `color-scheme`);
  - O aplikacji (About): the disclaimer and where his data lives (only on this device).
  Changes apply at once and are kept on the device (R12).
- **R10. Tablice (Boards):** the built-in board (his, `friend-pl.json`) and imported ones as a radio group (the
  active board); a preview of the selected board; **import** from a file: `file.size` checked against 64 KB before
  reading, then [`Blob.text()`](https://developer.mozilla.org/docs/Web/API/Blob/text) and the spec 006 validator;
  every error shown in text with its path (SC 3.3.1), focus moved to the error summary; delete an imported board
  after a confirmation; the built-in board cannot be deleted. Board values are rendered with text bindings only.
- **R11. Zdania (Sentences):** every sentence read aloud is kept, newest first, grouped by day, each with "Powiedz
  jeszcze raz" (Say again); delete one; "Usuń historię" (Delete history) after a confirmation; at most 500 sentences
  or 30 days, older ones dropped; a setting turns the history off (and deletes it).
- **R12. Storage on the device only.** Settings, imported boards, the active board and the history live in
  [`localStorage`](https://developer.mozilla.org/docs/Web/API/Window/localStorage) under versioned keys
  (`blinker.settings.v1`, …). What is read back is validated like untrusted input (a hand-edited or corrupted value
  falls back to the defaults and says so); a full or blocked storage leaves the app working in memory with a
  notice. Nothing is sent anywhere.

# UI and accessibility notes

- WCAG 2.2 AA everywhere; what he looks at (board, question, sentence) follows the AAC rules of the design: 7:1,
  cells at least 32 px, pointer not by color alone.
- Native elements and Angular Material components with their documented keyboard and screen reader support;
  targets at least 24 × 24 px (SC 2.5.8), 44 px in the navigation.
- Page titles through the existing `TranslatedTitleStrategy`; focus goes to the page heading after navigation.
- Every new string has keys in `en.json` and `pl.json`; board content is not translated.
- Lighthouse accessibility stays at 100.

# Security and privacy notes

- No new origin: Angular Material ships in the bundle; no Roboto or Material Symbols from Google Fonts.
- CSP and Trusted Types unchanged; the spike (R1) must pass without weakening them (ADR-0005, "Revisit when").
- Imported boards: spec 006 R2, plus the size check before reading the file (R10).
- His sentences are personal: kept only on the device, can be deleted, and the history can be turned off (R11).
  Speech uses on-device voices only (spec 006 R8).

# Acceptance criteria

- [x] The Angular Material spike passes: a dialog, a slide toggle and a select, zoneless, no CSP or Trusted Types
      violation in the e2e guard; spartan-ng is gone from the code, `.mcp.json` and the docs (R1).
- [x] The navigation bar and rail follow R2 at every checked size, with `aria-current="page"`, in both orientations.
- [x] A full path on Liczenie (Counting) with the signal buttons: hand + 2 blinks → "Kolumna 7?" (Column 7?) → yes →
      row 3 → yes → "W" in the sentence and announced; finish → yes → read aloud; with the keys when the mapping is
      on, and no reaction to the keys when it is off (R4, R6).
- [x] Tapping a cell and the sentence actions works through `TOUCH`; "Wyczyść" (Clear) only after the dialog; the
      table test covers 11 × 8 pairs (R3, R5).
- [x] With no local voice, the screen says so in text (R7).
- [x] The board is never covered or scrolled at the listed sizes, also with the wide font (R4).
- [x] Settings, boards and the history survive a reload; a corrupted stored value falls back to defaults with a
      notice (R9–R12).
- [x] An invalid board file shows every error in text with its path; a file over 64 KB is rejected before reading
      (R10).
- [x] axe finds no violation on any page and state; Lighthouse accessibility is 100; `npm run verify` passes.

# Test plan

- **Unit (Vitest):**
  - machine: the table test with `TOUCH` (11 × 8); touch on a cell from each writing state, while paused, while
    speaking; touch undo, clear, speak;
  - stores: settings, boards and history read, write, version, corrupted value → defaults and a notice, storage that
    throws → in-memory with a notice; the history cap (500, 30 days) and turning it off deletes it;
  - components with TestBed: the board renders cells as text and marks the pointer; the question and counter; the
    signal panel sends each signal; the keyboard mapping attaches only when on; the clear dialog; the wake lock is
    taken and released (fake `navigator.wakeLock`); the voice status for speaking and `no-local-voice`;
  - board import: size check before reading, validator errors listed with paths.
- **e2e (Playwright + axe, three device projects):**
  - the shell: bar below 600 px and rail from 600 px, order and `aria-current`, portrait and landscape;
  - Liczenie (Counting): the full path with buttons and with keys (a fake `speechSynthesis` with a local Polish voice
    injected by `addInitScript`), touch on a cell, undo, clear with the dialog, pause; the board fit at the listed
    sizes and with the wide font; no local voice → the message;
  - settings change the pause and survive a reload; boards: import a valid and an invalid file, switch the active
    board, delete; sentences: a spoken sentence appears, say again, delete the history;
  - axe on every page and the main states (asking, rejected, speaking, paused, dialog open, import errors);
  - the CSP guard on every page.

# Out of scope

- The camera, face signals and calibration (stages 3–4); the Kalibracja (Calibration) page comes with them.
- Scanning mode, the board editor, shortcuts for frequent words, word prediction, sync between devices.
- The caregiver-held layout from the mock-ups (`caregiver` state): after the PoC, if the author still wants it.

# References

- Design and decisions: [design](../../design/index.md), [ADR-0005](../../adr/0005-angular-material-m3.md), spec
  [006](../006-counting-core/spec.md), [interaction model](../../interaction-model.md); learnings
  [no-depends-on-context](../../knowledge/no-depends-on-context.md),
  [layout-fits-with-a-wider-font](../../knowledge/layout-fits-with-a-wider-font.md),
  [skip-link-must-not-overlap](../../knowledge/skip-link-must-not-overlap.md).
- Angular Material: theming https://material.angular.dev/guide/theming, dialog
  https://material.angular.dev/components/dialog/overview, slide toggle
  https://material.angular.dev/components/slide-toggle/overview, slider
  https://material.angular.dev/components/slider/overview, CDK a11y https://material.angular.dev/cdk/a11y/overview
- Material Design 3: navigation bar https://m3.material.io/components/navigation-bar/overview, navigation rail
  https://m3.material.io/components/navigation-rail/overview
- Angular: routing https://angular.dev/guide/routing, security (CSP, Trusted Types)
  https://angular.dev/best-practices/security
- WCAG 2.2: consistent navigation https://www.w3.org/WAI/WCAG22/Understanding/consistent-navigation.html, target
  size https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html, error identification
  https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html; WAI-ARIA APG modal dialog
  https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- MDN: Screen Wake Lock API https://developer.mozilla.org/docs/Web/API/Screen_Wake_Lock_API, `localStorage`
  https://developer.mozilla.org/docs/Web/API/Window/localStorage, `Blob.text()`
  https://developer.mozilla.org/docs/Web/API/Blob/text
