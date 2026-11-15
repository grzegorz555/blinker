# Blinker

Blinker helps a person who communicates by blinking. A phone or tablet camera follows the face, and the app scans a
letter board (column, then row). It recognizes deliberate signals (a long blink, head and eye movements) and turns
them into sentences that are shown on screen and read aloud.

- Runs in the browser as an installable PWA. Camera frames never leave the device.
- No accounts, no backend, no analytics.
- UI in English and Polish.

> Blinker is not a medical device. Keep the paper board as a fallback.

## Status

**Stage 1: deploy** (spec [003](docs/specs/003-deploy/spec.md), in progress: security headers and a CSP-clean build are done, the Azure deploy follows; specs [001](docs/specs/001-app-skeleton/spec.md) and [002](docs/specs/002-ci-verify/spec.md) are done).
**Stage 1.5: mock-ups** (spec [004](docs/specs/004-mockups/spec.md), done; outcome in [docs/design](docs/design/index.md): Material 3 style, Liczenie (Counting: the board) as the main screen with tappable letters, a navigation bar on phones and a rail from 600 px, Zdania (Sentences) and Kalibracja (Calibration); ADR-0005 (Angular Material where it has a component) is accepted. Every Liczenie (Counting) state can be opened from the catalog, and a signal simulator plays his signals by keys or by buttons. Kalibracja (Calibration) has a step-by-step wizard, Tablice (Boards) a JSON import with errors in text, Ustawienia (Settings) the timings, signals, voice, hints, language and theme. The final M3 tokens are in the app, with theme-color and separate any/maskable icons).
**Stage 2: board and input without a camera** (done: specs [006](docs/specs/006-counting-core/spec.md), the counting core, and [007](docs/specs/007-screens/spec.md), the screens on Angular Material). Blinker can be used without a camera:

- **Liczenie (Counting)**, the start page: a small status line (the prompt and the counter), the sentence in big letters above his board, and the pointer on the board (an outline, never color alone). He listens rather than reads (specs [008](docs/specs/008-listener/spec.md), [009](docs/specs/009-letter-by-ear/spec.md)): a pause after his blinks takes the column, a pause after the row adds the letter and **only the letter is said**; blinking again is the next letter, a shake undoes it (the nod per number and the spoken questions are switches in the settings); head shortcuts: a nod without a number = space, a shake = undo, head right = read aloud, and after reading "Nowe zdanie?" (New sentence?) - a nod clears. His signals come from buttons (+1, +5, yes, no, finish) or, when turned on in the settings, the keys; a tap on a letter adds it at once. "Cofnij literę" (Undo letter), "Spacja" (Space), "Wyczyść" (Clear, after a confirmation), "Przeczytaj" (Read aloud, then "Zatrzymaj" (Stop)) and "Pauza" (Pause). The screen stays on; a missing on-device Polish voice is shown in text.
- **Zdania (Sentences)**: every sentence read aloud, by day, with "Powiedz jeszcze raz" (Say again); delete one or all; the history can be turned off (at most 500 sentences or 30 days).
- **Tablice (Boards)**: his built-in board or an imported JSON board (checked on the device, every error shown with its path), a preview, delete after a confirmation.
- **Ustawienia (Settings)**: the pause before the question, the nod confirmation, spoken questions and notices, signal buttons, keyboard shortcuts, hints, speech rate with a voice check, language and theme.
- A navigation bar on phones and a rail from 600 px; English and Polish; everything is kept on the device only (localStorage, validated when read back).

**Stage 4: his signals from the camera** (spec [011](docs/specs/011-signals/spec.md), built; the thresholds are defaults until he is calibrated):

- **Kalibracja (Calibration)**, in the navigation: a step-by-step wizard (at rest, 3 long blinks, a look at each hand, a nod, a shake, head right), each step said aloud and showing "Wykryto n z k" (Detected n of k); "Zapisz kalibrację" (Save the calibration) keeps his thresholds on the device (numbers only, never a picture).
- **Diagnostyka (Diagnostics)** also lists the signals Blinker detects, with his calibration or the defaults.

**Stage 3: face-tracking spike** (spec [010](docs/specs/010-face-spike/spec.md), built; ADR-[0006](docs/adr/0006-face-tracking-mediapipe-worker.md) proposed, waiting for the measurements on his devices):

- **Diagnostyka (Diagnostics)**, linked from Ustawienia (Settings): the front camera, analysed on the device by MediaPipe Face Landmarker in a Web Worker (GPU, or CPU as a fallback), with the eye values (blinks, where the eyes look), the head angles, frames per second, the analysis time, the share of frames with a face and the battery; "Kopiuj wyniki" (Copy the results) copies a short text for the ADR. The wasm runtime and the model are served from our origin (the model hash is pinned); MediaPipe's usage metrics to Google are blocked.

The stage plan is in [docs/backlog.md](docs/backlog.md).

## Tech stack

- Angular 22 (standalone, zoneless, signals), TypeScript 6, in `src/web`
- Vitest for unit tests; Playwright + axe-core for e2e and accessibility tests
- Installable PWA (web manifest, Angular service worker): the app shell works offline after the first visit
- Transloco for UI translations (en, pl) in `src/web/public/i18n/`; the language comes from the saved choice, then the browser, then Polish
- Angular Material (Material 3) and the CDK for standard components, themed from our tokens (`src/web/src/material.scss`, ADR-0005); no web fonts or icon fonts
- Tailwind CSS v4 with design tokens in `src/web/src/styles/tokens.css` (light and dark, WCAG contrast checked)
- Web Speech API with on-device voices only
- Planned:
  - MediaPipe Face Landmarker `@mediapipe/tasks-vision` (pinned), in a module Web Worker (stages 3–4);
  - hosting on Azure Static Web Apps (Free).

## Getting started

Requirements: Node.js 26 (see `src/web/.nvmrc`) and npm.

```
cd src/web
npm ci            # install exact versions from package-lock.json
npm start         # dev server at http://localhost:4200
npm run hooks:install   # once per clone: the pre-push hook runs the fast gates (npm run verify -- --quick)
```

## Tests and verification

Run these from `src/web`. **`npm run verify` runs every gate below in the same order as CI** and prints which passed, which failed and which were not run.

| Command                                | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify`                       | All gates: docs check, Prettier, ESLint, unit tests, script tests, `npm audit` (high in any dependency, any in production), build, `dist/` check, mock-ups build, e2e. Stops at the first failure. `-- --quick` runs only docs, Prettier, ESLint, unit and script tests (about 20–30 s; the pre-push hook uses it).                                                                                                                                                                   |
| `npm run lint`                         | ESLint: TypeScript rules, Angular template accessibility rules, and security rules (no `innerHTML`/`eval`)                                                                                                                                                                                                                                                                                                                                                                            |
| `npm test`                             | Vitest unit tests (single run). `npm run test:watch` runs them in watch mode.                                                                                                                                                                                                                                                                                                                                                                                                         |
| `npm run build`                        | Production build into `dist/` (no source maps)                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `npm run e2e`                          | Builds the app, then runs Playwright e2e tests with axe-core accessibility checks on desktop Chrome, Pixel 7 (Chromium) and iPhone 15 (WebKit), including a manifest check over the DevTools Protocol. It also builds the mock-ups and runs the `design` project (Chromium) against them. The local server sends the production security headers, and every test fails on a CSP or Trusted Types violation. The first time, run `npx playwright install chromium webkit`.             |
| `DEPLOY_URL=<url> npx playwright test` | Runs only the `deployed` project against a deployed copy (preview or production): headers, HTTPS, smoke + axe. In PowerShell: `$env:DEPLOY_URL='<url>'; npx playwright test`.                                                                                                                                                                                                                                                                                                         |
| `npm run test:scripts`                 | Tests of the Node helper scripts (built-in `node --test`)                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `npm run check:dist`                   | Fails if the production build contains a `design/` folder (mock-ups), `.map` or `.md` files, `sourceMappingURL` comments, or inline scripts and `on…=` handlers in HTML                                                                                                                                                                                                                                                                                                               |
| `npm run lighthouse`                   | Lighthouse CI on the production build (home and 404, English and Polish); fails unless Accessibility = 100. Needs `npm run build` first and Google Chrome. Reports: `.lighthouseci/reports-en`, `reports-pl`. `npm run verify -- --lighthouse` includes it.                                                                                                                                                                                                                           |
| `npm run design:build`                 | Builds the clickable mock-ups (spec 004) from `design/` into `dist/design/` (Tailwind via PostCSS); fails on raw colors in the markup and on inline scripts. They never ship in the app build. Without a server, open `dist/design/index.html` in a browser. The catalog links to every Liczenie (Counting) state (`communicate.html#asking-row`) and to the simulator (`?sim=1`); keys: Space = blink +1, H = hand +5, N = nod, S = shake, R = head right, P = pause, F = face lost. |
| `node scripts/contrast.mjs`            | Prints the contrast ratio of every token pair (the app tokens, light and dark) and fails below the threshold: 7:1 for what he reads, 4.5:1 for other text, 3:1 for outlines. Also part of `npm run test:scripts`.                                                                                                                                                                                                                                                                     |
| `npm run design:serve`                 | Builds the mock-ups and serves them on port 4310 with the production headers, **for viewing on a phone over the home Wi-Fi**: it prints the address to open (`http://192.168.x.x:4310/`). If Windows asks about the firewall, allow private networks only; don't run it on public Wi-Fi. Stop with Ctrl+C.                                                                                                                                                                            |
| `npm run icons`                        | Regenerates the app icons in `public/icons/` from the tokens: `icon-any-*` and `icon-maskable-*` (192, 512 px), the favicon and the apple-touch-icon (pure Node, no dependencies)                                                                                                                                                                                                                                                                                                     |
| `node scripts/theme-color.mjs`         | Checks that `theme-color` in `index.html` and the manifest equals the `--bg` token (light and dark); `--write` updates them. Also part of `npm run test:scripts`.                                                                                                                                                                                                                                                                                                                     |
| `npm run format:check`                 | Prettier check. `npm run format` fixes formatting.                                                                                                                                                                                                                                                                                                                                                                                                                                    |

From the repo root, `node scripts/check-okf.mjs` checks the documentation bundle.

**CI** (`.github/workflows/ci.yml`) runs on every pull request and on `main`: the docs check, a gitleaks secret scan, an OSV-Scanner vulnerability scan, `npm run verify` (the same gates as above), and Lighthouse in a separate job (reports kept as a workflow artifact for 7 days). After every gate passes, the tested build is deployed to Azure Static Web Apps: a preview per PR (its URL is commented on the PR) or production on `main`, followed by the `deployed` e2e tests on that URL. Without the `AZURE_STATIC_WEB_APPS_API_TOKEN` secret (and on Dependabot PRs) the deploy is skipped, not failed. Dependabot proposes weekly updates for npm (minor and patch grouped) and GitHub Actions.

## Documentation

- [docs/index.md](docs/index.md): vision, interaction model, architecture, decisions (ADR), conventions, specs.
- [CLAUDE.md](CLAUDE.md) and [AGENTS.md](AGENTS.md): how AI agents work in this repo.
