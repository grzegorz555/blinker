---
type: Task List
title: "007: Screens tasks"
description: Eight tasks, one commit each - the Angular Material spike, the shell, touch in the machine, the Liczenie (Counting) screen, signal input on the screen, settings, boards and sentences with the docs.
tags: [stage-2, ui, angular-material]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-14
---

Branch: `feat/007-screens` (from `main`, worktree `C:/Repozytorium/Blinker/wt/007-screens`) · Gates:
`npm run verify -- --quick` locally, full gates in CI.

- [x] **T1 [opus]: Angular Material spike and the theme.** Add `@angular/material` and `@angular/cdk`; the M3 theme
      mapped to `tokens.css`, the system font, no icon font; a dialog, a slide toggle and a select checked zoneless
      under the CSP and Trusted Types (e2e CSP guard and axe on a test page that does not ship); remove spartan-ng
      (`.mcp.json`, `CLAUDE.md`, conventions) (R1). If the spike fails, stop and bring it to the author (ADR-0005,
      "Revisit when").
      _To understand:_ M3 system tokens as CSS variables, Sass theming, why overlays and Trusted Types can clash.
- [ ] **T2 [sonnet]: The shell and routes.** Top app bar, our navigation bar and rail (R2), routes for Liczenie
      (Counting) at `/`, Zdania (Sentences), Tablice (Boards), Ustawienia (Settings) with empty pages; the home page
      removed; focus to the heading after navigation. Tests: unit for the navigation; e2e for bar and rail at every
      size and orientation, `aria-current`, axe.
      _To understand:_ M3 navigation patterns, SC 3.2.3, lazy routes, focus after navigation in an SPA.
- [ ] **T3 [opus]: `TOUCH` in the counting machine.** The new signal with a cell or action target (R3) in
      `counting.ts`; the table grows to 11 × 8; `CountingService.touch()`. Tests: the table test and every touch case
      of the test plan.
      _To understand:_ extending a state machine without breaking it, why touch skips the nod.
- [ ] **T4 [opus]: Liczenie (Counting) screen.** Board, pointer, question and counter, notice, sentence with its
      actions, the clear dialog, the live region, the hints line, portrait and landscape layout (R4, R5). Tests:
      component tests; e2e for touch, undo, clear with the dialog, the board fit at every size and with the wide
      font, axe in the main states.
      _To understand:_ table semantics for a grid of buttons, live regions, a layout that never covers the board.
- [ ] **T5 [sonnet]: Signal input, speech status and the wake lock.** The signal button panel and the keyboard
      mapping attached from settings (R6), the voice status and `no-local-voice` (R7), the screen wake lock (R8).
      Tests: unit with fakes; e2e for the full path with buttons and with keys, the no-voice message.
      _To understand:_ one input path for every source, the Screen Wake Lock API, faking `speechSynthesis` in e2e.
- [ ] **T6 [sonnet]: Ustawienia (Settings) and storage.** A settings store over `localStorage` with a versioned,
      validated value (R12); the settings page with Angular Material controls (R9); the theme and the language
      applied at once; the disclaimer in "O aplikacji" (About). Tests: the store cases; e2e for a change that
      survives a reload and a range error, axe.
      _To understand:_ validating what you stored yourself, `color-scheme`, form errors in text (SC 3.3.1).
- [ ] **T7 [sonnet]: Tablice (Boards).** The board list as a radio group, the preview, import with the size check and
      the validator errors in text, delete with a confirmation, the active board used by Liczenie (Counting) (R10).
      Tests: unit for the board store and import; e2e with a valid, an invalid and a too-big file, axe on the errors.
      _To understand:_ reading a file safely, an error summary pattern, focus management after an error.
- [ ] **T8 [sonnet]: Zdania (Sentences), docs and README.** The history store (cap, turn off), the page with say
      again, delete and delete all (R11); `docs/design/index.md` (Kalibracja (Calibration) later), architecture, the
      frontend and accessibility conventions (Angular Material instead of spartan), README status and features,
      specs index, log, Polish copies. Tests: unit for the history; e2e for a spoken sentence in the history and
      deleting it, axe.
      _To understand:_ privacy of what a person says, data retention on the device.
