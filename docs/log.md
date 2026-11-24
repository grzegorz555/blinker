# Log

## 2026-11-24 (a chime before the row)
- The author: he needs to know when the pause has taken the column and he can start blinking the row. A soft rising chime (C-E-G) plays when the column is taken, after the pause or after a nod (spec 012, R7). It is a `cue` effect of the counting machine, so it works with every input; "Dźwięk: teraz wiersz" (Sound: now the row), on by default.

## 2026-11-24 (cache for the face worker)
- The hashed face worker files (`worker-<hash>.js`, `worker-chunk-<hash>.js`) were served with `no-cache`, because the `immutable` routes listed only `main-`, `chunk-`, `polyfills-` and `styles-`. They are `immutable` now; `worker-basic.min.js` (Angular's service worker helper, no hash) stays `no-cache`.

## 2026-11-22 (housekeeping)
- Spec 016 (word prediction) is paused after T1 and T2: the word list and the pure predictor are on `main`, but nothing loads the list yet. The author decides on T3-T6 after the first session with him; the question is in the [checklist](trial/first-session.md).
- Specs 001-015 are done, so their frontmatter says `status: stable` instead of `draft`.

## 2026-11-21 (spec 003 done: Blinker on Azure)
- The author set up Azure Static Web Apps (Free; West Europe took no new customers, so East US 2) and the deploy token. The first production deploy passed every gate, but the `deployed` test found that Azure's built-in 404 page gets no security headers; our static `404.html` through `responseOverrides` fixed it (PR #45), checked on the first PR preview. Production deploys are a GitHub environment.
- Production: https://mango-rock-0416a080f.3.azurestaticapps.net. The README is short now (the address, the status, one line per tab), with a new [user guide](user-guide.md) for the caregivers; the stage history stays here.
- The author: the camera in Liczenie (Counting) is on by default (PR #47); the navigation has a hover state and a filled icon for the current page (PR #46).

## 2026-11-20 (e2e pass for specs 013–015)
- The e2e paths of specs 013, 014 and 015 are written: "Usuń wszystkie dane" (Delete all data) on 3 device projects with axe and a reload (`settings.e2e.ts`); the camera released when the page is hidden and opened again on return, and the "Kamera" (Camera) toggle with the top bar at 360 px and in landscape (`counting.e2e.ts`); "Wyłącz kamerę" (Turn off the camera) during a calibration step and the one "Ręka (+5)" (Hand (+5)) step (`calibration.e2e.ts`); the sticky camera bar covering no focused control and the copied profile JSON (`diagnostics.e2e.ts`). A helper fakes the page visibility (`e2e/support/visibility.ts`). The old calibration path still had ten steps and was brought to nine.

## 2026-11-20 (spec 016: word prediction, approved)
- Spec 016 approved: up to 3 guesses for the word he is spelling, in a row above the board for the people around him (a tap takes one), and, as a second option off by default, the best one asked aloud after a pause ("Żółw?" (Tortoise?)): a nod takes it in its full spelling with a space, a blink or a hand goes on, a shake refuses it, one shake undoes a taken word. Off by default, Polish boards only.
- He drops Polish letters sometimes, even those on his board, so a plain letter also stands for its Polish letter ("ZO" gives "ŻÓŁW"), and a Polish letter he spelled matches only itself. His own words from sentences read aloud are learnt on the device (`blinker.words.v1`, on once prediction is on) and erased with the rest.
- ADR-0007 accepted: 20,000 word forms from FrequencyWords (OpenSubtitles 2018, spoken Polish, CC BY-SA 4.0) rather than Leipzig (written Polish), self-hosted in `/words/pl.txt` (about 175 KB, 77 KB gzipped), cached offline, credited in "O aplikacji" (About).

## 2026-11-18 (spec 015: the hand from the head)
- His hand (+5) is a quick turn of the head to his left and straight back, a little down, with no hold: the eye rule goes, a nod with a downward tilt is not a nod, and a shake that starts the same way is a shake (R1–R3, R5, spec 015, T1).
- Kalibracja (Calibration) has one "Ręka (+5)" (Hand (+5)) step that learns its amplitude, side and tilt; Diagnostyka (Diagnostics) copies the whole profile with signed head angles (T2–T4). Only his left hand for now; the e2e paths wait for the next e2e pass. To try with him (`docs/trial/first-session.md`).

## 2026-11-18 (spec 014: the camera in the background)
- The camera is released when Blinker is hidden (another app, tab or locked screen) and opened again by itself on return; the face worker and its model stay loaded. F2 of the security pass is closed.
- On return the detector starts clean, Kalibracja (Calibration) records the step under way again and Diagnostyka (Diagnostics) restarts its measurement; a "Kamera" (Camera) toggle, "Wyłącz kamerę" (Turn off the camera) and a sticky bar in Diagnostyka (Diagnostics) let a caregiver turn the camera off by hand. None of them is reachable by his signals.
- E2E paths and the checks by hand on his phone wait (first-session checklist).

## 2026-11-18 (spec 013: delete all data)
- F1 of the security pass is closed: Ustawienia (Settings) has "Dane na tym urządzeniu" (Data on this device) with "Usuń wszystkie dane" (Delete all data) after a confirmation (focus on "Anuluj" (Cancel)). Every service goes back to its defaults and every `blinker.` key is removed; the result is said in text.
- `DeviceDataService.eraseAll()` resets Settings, Boards, History, Counting, Language (the saved choice) and Profile, then sweeps the `blinker.` prefix; a unit test fills every store and fails on a leftover key or a service not at its defaults. The rule for new stores is in `docs/conventions/security.md`.
- E2E paths for the section (3 device projects, axe) are in the spec and wait for the next e2e pass.

## 2026-11-17 (spec 014: the camera off by hand)
- Spec 014 also gives a caregiver one button to turn the camera off and on: a "Kamera" (Camera) toggle in the top bar of Liczenie (Counting), "Wyłącz kamerę" (Turn off the camera) in Kalibracja (Calibration), and the Diagnostyka (Diagnostics) button in a bar that stays in view (R10–R13); his signals cannot reach them. E2E paths moved to the next e2e pass. Still a draft, to approve.

## 2026-11-17 (specs for the security findings)
- Two draft specs from the security pass, following its proposals: 013 (F1) one "Usuń wszystkie dane" (Delete all data) action in Ustawienia (Settings), after a confirmation, with every stored key under the `blinker.` prefix; 014 (F2) the camera is released when the page is hidden and starts again by itself on return. Both wait for the author's approval.

## 2026-11-17 (e2e by hand)
- E2E (Playwright + axe) no longer runs after every change: `npm run verify` and the CI web job skip it (`--e2e` adds it), and `.github/workflows/e2e.yml` runs it only by hand. Tasks ship with unit tests; e2e tests are written in an e2e pass the author asks for from time to time. The `deployed` project still runs after each deploy.

## 2026-11-17 (CI: the runner and a picomatch exception)
- CI runs on `ubuntu-24.04` instead of `ubuntu-latest`: the new Ubuntu 26.04 image lacks the system packages that `playwright install --with-deps` asks for. `picomatch` 4.0.7 (GHSA-fc5q-39xc-vjpf, ReDoS, no fixed version, dev only) is a dated exception in `src/web/osv-scanner.toml`, read by OSV-Scanner and by the new `scripts/audit.mjs` gate; the production audit keeps no exceptions. Do not depend on picomatch directly.

## 2026-11-16 (security pass)
- A chapter-level pass through the ASVS chapters of the security conventions (`docs/security-review.md`): no failing chapter; two low findings to decide with the author (no single "delete all data" action; the camera stays open in the background).

## 2026-11-16 (a stricter board import)
- Tablice (Boards) takes only a `.json` file (the name is checked in code, not only by the picker), reads it with a strict UTF-8 decode so a binary file is refused, and scans every text for `<` and `>`, control characters and invisible or direction-changing characters. Three new errors: `not-json-file`, `not-text`, `unsafe-text`. Saved boards go through the same scan when read back.

## 2026-11-15 (his look at his hand with the head turned)
- The look at his hand was not recognized: it required a still head, but he turns and tilts his head towards his hand. Now only a nod under way blocks it. Kalibracja (Calibration) finds short looks in a long step (per look, not per frame) and lists his last looks with their numbers and why each did or did not count; Diagnostyka (Diagnostics) shows the last look and the hand thresholds, and copies the last 10 looks.

## 2026-11-15 (ordinary blinks, nods and his hand)
- Ordinary blinks counted and a nod sometimes gave +5. Kalibracja (Calibration) now learns his ordinary blinks in the rest step and picks the cue that tells his strong blink apart best (lids, cheeks or brows); when none does, only long blinks count and the result says so. A look at his hand needs a still head and, once learnt, his side (down and to his left).

## 2026-11-15 (Kalibracja says why)
- The blink step of Kalibracja (Calibration) lists his last 3 closures of the eyes with their numbers and why each did or did not count, judged by the thresholds fitted so far; the result shows his blink thresholds. For tuning while trying it.

## 2026-11-15 (why a blink did not count)
- MediaPipe lowers the gaze of a closed eye (eyeLookDown rises with eyeBlink), so the detector took every blink for a look at his hand. Now a closure is a look only if he was already looking down when it began, or the look lasted long enough to send HAND. Diagnostyka (Diagnostics) shows the last closure of the eyes (length, closure, squeeze, down) with the reason it did or did not count, and his blink thresholds.

## 2026-11-15 (his blink is strong, not long)
- The author saw that his deliberate blink is strong rather than long. A blink now counts when the lids squeeze hard (`eyeSquint`, calibrated against his ordinary blinks at rest) or when it is long; Kalibracja (Calibration) finds short blinks in a long recording. The camera page of Kalibracja asks for the camera at once. Tablice (Boards): space between the example file and its button.

## 2026-11-15 (the repo is public)
- The author made the repo public. `main` is protected by the required CI checks; auto-merge is available per PR; secret scanning with push protection is on; CodeQL runs on PRs, on main and weekly.

## 2026-11-15 (stage 6 preparation)
- A checklist for the first session with him (`docs/trial/first-session.md`): Diagnostyka (Diagnostics) for ADR-0006, Kalibracja (Calibration), Liczenie (Counting) with the camera, the open questions. Learnings from specs 011-012 (drafts). Local e2e runs no longer reuse a server another worktree left behind.

## 2026-11-15 (spec 012, the camera drives Liczenie (Counting))
- With the camera switch on (off by default), his face signals go to the counting machine like the buttons, each confirmed by a short tone; the top bar says whether his face is in view; a caregiver can use the rear camera. Stage 5 is built; everything waits for the first session with him (calibration, thresholds, the tones).

## 2026-11-15 (spec 011, his signals from the camera)
- A pure detector turns face frames into his signals (long blink, look at his hand, nod, shake, head right), with hysteresis and a quiet time; a profile of his thresholds is kept on the device. Diagnostyka (Diagnostics) lists the detected signals; Kalibracja (Calibration) learns his thresholds step by step and joined the navigation. The defaults are guesses until the first session with him.

## 2026-11-15 (privacy review)
- A review of every tracked file and the history for personal data (GDPR): none found (no names, contact details, ID numbers or health records; the board photo has no metadata; commits use GitHub noreply addresses). A script test now guards it.

## 2026-11-15 (spec 010, face-tracking spike)
- MediaPipe Face Landmarker runs in a module worker under the production CSP and Trusted Types (GPU in Chromium); the wasm and model are self-hosted, the model hash pinned. The library sends usage metrics to Google: blocked by the CSP and a fetch guard in the worker. Diagnostyka (Diagnostics) shows the eye and head values, FPS and analysis time; ADR-0006 proposed, waiting for the measurements on his devices.

## 2026-11-14 (spec 009, the letter by ear; fixes, PR #18)
- The author after trying spec 008: the voice says too much. Blinker now says only the chosen letter and the sentence when he reads it; a pause takes the column and then the letter, blinking again starts the next letter, a shake undoes it. The nod per number and the spoken questions and notices are settings, both off by default.
- Fixes: space between the pause hint and the switches in Ustawienia (Settings); a Material button and an example file for the board import; a pointer and hover on the language buttons.

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
