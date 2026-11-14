# Log

## 2026-11-14 (spec 008, he listens)
- The author: he knows the digits and the letter under each column and row, but builds words by ear, not by reading. Head shortcuts are said aloud: a space says the finished word, an undo says what it removed, and after reading Blinker asks "Nowe zdanie?" (New sentence?) - a nod clears, a shake keeps. The sentence is big above the board, the prompts small. A "Spacja" (Space) button for taps; the hint says the shortcuts of the moment.

## 2026-11-14 (spec 007, T1–T8, PR #16)
- The screens on Angular Material (spike passed under the CSP and Trusted Types): the shell with our navigation bar and rail, Liczenie (Counting) with signal buttons, taps through the machine (TOUCH), voice status and wake lock, Ustawienia (Settings), Tablice (Boards) with import, Zdania (Sentences) with the history; everything stored on the device and validated when read back. Stage 2 is done.
- CI: the Lighthouse language guard now reads the page text (the language switch moved to the settings); the board fits a short phone with the wider CI font; the skip link and the sticky navigation no longer cover controls on the full-height Liczenie (Counting), and only main scrolls.

## 2026-11-14 (spec 006 learnings, spec 007 plan)
- PR #15 merged; learnings: Ajv needs unsafe-eval (our own validator instead), a rebase-merged branch looks unmerged to git, the transition table checked by the compiler.
- Spec 007 (screens) planned: Angular Material spike first, the shell, TOUCH in the machine, Liczenie (Counting), settings, boards, sentences.

## 2026-11-13 (spec 006, T1–T6)
- The counting core without UI: board format v1 and validator, his board as the default, the sentence with undo, the counting state machine (77 explicit state × signal pairs, time only from TICK, a lint rule against clocks in the core), one input type and a keyboard mapping that is off by default, on-device speech, CountingService.
- The author: a nod without a number while Blinker waits for a column is a space (he does not signal the end of a word today).

## 2026-11-13 (stage 2 plan)
- Spec 006 (counting core, no UI) planned; stage 2 split into 006 and 007 (the screens).
- ADR-0005 accepted: Angular Material for every component it provides, custom navigation bar and rail, board and Liczenie (Counting) layout.

## 2026-11-13 (spec 004, T6 and T7)
- Final tokens: the M3 values moved unchanged into tokens.css as light-dark() pairs, with every role the mock-ups use; the mock-ups no longer override colors; the contrast check requires every token of the app.
- theme-color is --bg (the top app bar), checked by scripts/theme-color.mjs; separate any and maskable icons generated from the tokens and checked byte for byte.
- docs/design/index.md records the visual language, the token table, the app structure, the screens and states, and the author's decisions (the look approved; he should manage alone; he controls Blinker with his head). Spec 004 done.

## 2026-11-13 (spec 004, T4 and T5, PR #13)
- Liczenie (Counting): twelve states by URL fragment and a signal simulator (keys, and buttons with ?sim=1); a shake right after a rejected number no longer deletes a letter; undo removes only letters added in the session.
- Kalibracja (Calibration) wizard (eight steps by fragment), Tablice (Boards) with a JSON import checked as untrusted input and errors in text, Ustawienia (Settings) with native controls and a hints switch; new --error token.
- The author: the friend should manage the board without a caregiver, and he controls Blinker with his head, so keyboard shortcuts are a mock-up stand-in (R7 exception for SC 2.1.4).
- CI failed on layout at 360 px because of the wider Linux font and a 4 px error in the board height; fixed, with a wide-font fit test. Learnings: fit with a wider font; "no" depends on the state.

## 2026-11-12 (spec 004, polish round 1)
- The author rejected the shadcn look and the start dashboard. The mock-ups move to Material 3: Liczenie (Counting: the board) is the main screen in the supporting-pane layout, with tappable letters, visible sentence actions and a Pauza (Pause) toggle; a navigation bar below 600 px and a rail from 600 px; Zdania (Sentences) and Kalibracja (Calibration) take the dashboard's content. ADR-0005 (Angular Material instead of spartan-ng) proposed.
- The contrast script merged token sets wrongly (the `design.css` `:root` replaced the app set), which hid an out-of-gamut dark `--primary` in `tokens.css`; fixed, with `var()` aliases resolved.
- Learnings: `list-item` is a Tailwind utility (`display: list-item`), and utilities beat component classes because of the cascade layer order.

## 2026-11-11 (spec 005)
- Pre-push hook runs only the fast gates (`verify --quick`, about 20 s); CI does the full check.
- Model routing: a model and effort per loop step in skill/agent frontmatter, difficulty labels `[haiku|sonnet|opus]` per task from `/plan`, `implementer-haiku`/`implementer-opus` agents, `code-reviewer` on Haiku, and a config test.
- Counting is the default mode and the PoC scope; scanning comes after the PoC.

## 2026-11-11 (spec 002)
- Counting mode confirmed with the author: column then row, blinks +1, look at hand +5 (counting only), every number asked aloud and confirmed by a nod or rejected by a head shake. The exact way he gives numbers is still open.
- The friend's paper board transcribed (7×5, no Ł/Ó/Q/V, SZ and CZ as cells; copied 1:1).
- Spec 002: `npm run verify` (single definition of the gates), `dist/` check, versioned pre-push hook, CI `web` and `lighthouse` jobs, Lighthouse a11y = 100 in en/pl, manifest check over CDP, Dependabot for npm, `basic-ftp` override for LHCI.
- Fixed a flaky offline e2e helper (waited only for index.html). Learnings: CDP installability errors always empty; `node -e` eats backslashes.

## 2026-11-10 (spec 001)
- Spec 001 app skeleton (stage 1): Angular 22 zoneless workspace, Playwright + axe on 3 device projects, ESLint with template a11y and no-unsanitized, Tailwind tokens and an accessible shell, Transloco en/pl with a language switch and translated titles, installable offline PWA with own icons.
- ADR-0003 accepted (Azure Static Web Apps Free). Branch protection is unavailable on the Free plan; workaround recorded in conventions/git.md.
- Learnings: Playwright async predicates, Angular SW caching vs. readiness, skip-link target overlap, session start directory.

## 2026-11-10
- Stage 0: repository bootstrap, OKF bundle, conventions, ADR-0001–0003, Claude Code skills and agents, CI skeleton.
