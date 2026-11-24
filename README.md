# Blinker

Blinker helps a person who communicates by blinking. A phone or tablet camera follows the face, and the app scans a
letter board (column, then row). It recognizes deliberate signals (a strong blink, head movements, his hand as a quick turn of the head) and turns
them into sentences that are shown on screen and read aloud.

- Runs in the browser as an installable PWA. Camera frames never leave the device.
- No accounts, no backend, no analytics.
- UI in English and Polish.

> Blinker is not a medical device. Keep the paper board as a fallback.

## Try it

**https://mango-rock-0416a080f.3.azurestaticapps.net** (production, deployed from `main`). Open it on a phone or
tablet and add it to the home screen. How to use it: the [user guide](docs/user-guide.md).

## Status

**Works today:** spelling with his board by buttons, taps or the camera (on by default: the first visit to Liczenie (Counting) asks for it); the letter and the sentence said aloud; a chime when the column is taken, so he knows to give the row; his
calibration; the sentence history; imported boards; English and Polish; offline after the first visit.
**Next:** the first session with him ([checklist](docs/trial/first-session.md)) to measure the camera on his device
and tune his thresholds (ADR-[0006](docs/adr/0006-face-tracking-mediapipe-worker.md) waits for these numbers); then a decision on
word prediction (spec [016](docs/specs/016-word-prediction/spec.md), paused after its first two tasks).

| Tab | What it is for |
| --- | --- |
| Liczenie (Counting) | The main screen: his board, the sentence above it, the camera status and "Pauza" (Pause). His signals: a strong blink = +1, a glance at his hand = +5, a nod = space, a shake = undo, head right = read aloud. |
| Zdania (Sentences) | Every sentence read aloud, by day; say again, delete. |
| Tablice (Boards) | His built-in board or an imported `.json` board, checked on the device. |
| Kalibracja (Calibration) | A short wizard that learns his signals; only numbers are saved. |
| Ustawienia (Settings) | Timings, voice, camera, hints, language and theme, history, "Usuń wszystkie dane" (Delete all data); links to Diagnostyka (Diagnostics). |

What was built and when: [docs/log.md](docs/log.md) and the [specs](docs/specs/index.md); the stage plan:
[docs/backlog.md](docs/backlog.md).

## Tech stack

- Angular 22 (standalone, zoneless, signals), TypeScript 6, in `src/web`
- Vitest for unit tests; Playwright + axe-core for e2e and accessibility tests
- Installable PWA (web manifest, Angular service worker): the app shell works offline after the first visit
- Transloco for UI translations (en, pl) in `src/web/public/i18n/`; the language comes from the saved choice, then the browser, then Polish
- Angular Material (Material 3) and the CDK for standard components, themed from our tokens (`src/web/src/material.scss`, ADR-0005); no web fonts or icon fonts
- Tailwind CSS v4 with design tokens in `src/web/src/styles/tokens.css` (light and dark, WCAG contrast checked)
- Web Speech API with on-device voices only
- MediaPipe Face Landmarker `@mediapipe/tasks-vision` (pinned), in a module Web Worker, with the wasm and the model served from our origin
- Hosting: Azure Static Web Apps (Free, ADR-0003); security headers from `src/web/public/staticwebapp.config.json`

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

| Command                                | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify`                       | All gates: docs check, Prettier, ESLint, unit tests, script tests, `npm audit` (high in any dependency except the dated exceptions of `osv-scanner.toml`, any in production), build, `dist/` check, mock-ups build. Stops at the first failure. `-- --e2e` adds e2e. `-- --quick` runs only docs, Prettier, ESLint, unit and script tests (about 20–30 s; the pre-push hook uses it).                                                                                                                      |
| `npm run lint`                         | ESLint: TypeScript rules, Angular template accessibility rules, and security rules (no `innerHTML`/`eval`)                                                                                                                                                                                                                                                                                                                                                                                                 |
| `npm test`                             | Vitest unit tests (single run). `npm run test:watch` runs them in watch mode.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `npm run build`                        | Production build into `dist/` (no source maps)                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `npm run e2e`                          | By hand, not after every change: builds the app, then runs Playwright e2e tests with axe-core accessibility checks on desktop Chrome, Pixel 7 (Chromium) and iPhone 15 (WebKit), including a manifest check over the DevTools Protocol. It also builds the mock-ups and runs the `design` project (Chromium) against them. The local server sends the production security headers, and every test fails on a CSP or Trusted Types violation. The first time, run `npx playwright install chromium webkit`. |
| `DEPLOY_URL=<url> npx playwright test` | Runs only the `deployed` project against a deployed copy (preview or production): headers, HTTPS, smoke + axe. In PowerShell: `$env:DEPLOY_URL='<url>'; npx playwright test`.                                                                                                                                                                                                                                                                                                                              |
| `npm run test:scripts`                 | Tests of the Node helper scripts (built-in `node --test`)                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `npm run check:dist`                   | Fails if the production build contains a `design/` folder (mock-ups), `.map` or `.md` files, `sourceMappingURL` comments, or inline scripts and `on…=` handlers in HTML                                                                                                                                                                                                                                                                                                                                    |
| `npm run lighthouse`                   | Lighthouse CI on the production build (home and 404, English and Polish); fails unless Accessibility = 100. Needs `npm run build` first and Google Chrome. Reports: `.lighthouseci/reports-en`, `reports-pl`. `npm run verify -- --lighthouse` includes it.                                                                                                                                                                                                                                                |
| `npm run design:build`                 | Builds the clickable mock-ups (spec 004) from `design/` into `dist/design/` (Tailwind via PostCSS); fails on raw colors in the markup and on inline scripts. They never ship in the app build. Without a server, open `dist/design/index.html` in a browser. The catalog links to every Liczenie (Counting) state (`communicate.html#asking-row`) and to the simulator (`?sim=1`); keys: Space = blink +1, H = hand +5, N = nod, S = shake, R = head right, P = pause, F = face lost.                      |
| `node scripts/contrast.mjs`            | Prints the contrast ratio of every token pair (the app tokens, light and dark) and fails below the threshold: 7:1 for what he reads, 4.5:1 for other text, 3:1 for outlines. Also part of `npm run test:scripts`.                                                                                                                                                                                                                                                                                          |
| `npm run design:serve`                 | Builds the mock-ups and serves them on port 4310 with the production headers, **for viewing on a phone over the home Wi-Fi**: it prints the address to open (`http://192.168.x.x:4310/`). If Windows asks about the firewall, allow private networks only; don't run it on public Wi-Fi. Stop with Ctrl+C.                                                                                                                                                                                                 |
| `npm run icons`                        | Regenerates the app icons in `public/icons/` from the tokens: `icon-any-*` and `icon-maskable-*` (192, 512 px), the favicon and the apple-touch-icon (pure Node, no dependencies)                                                                                                                                                                                                                                                                                                                          |
| `node scripts/theme-color.mjs`         | Checks that `theme-color` in `index.html` and the manifest equals the `--bg` token (light and dark); `--write` updates them. Also part of `npm run test:scripts`.                                                                                                                                                                                                                                                                                                                                          |
| `npm run format:check`                 | Prettier check. `npm run format` fixes formatting.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

From the repo root, `node scripts/check-okf.mjs` checks the documentation bundle.

**CI** (`.github/workflows/ci.yml`) runs on every pull request and on `main` (on Ubuntu 24.04, pinned): the docs check, a gitleaks secret scan, an OSV-Scanner vulnerability scan (exceptions with a reason and an expiry in `src/web/osv-scanner.toml`), `npm run verify` (the same gates as above, without e2e; e2e runs by hand through the `E2E` workflow), and Lighthouse in a separate job (reports kept as a workflow artifact for 7 days). After every gate passes, the tested build is deployed to Azure Static Web Apps: a preview per PR (its URL is commented on the PR) or production on `main`, followed by the `deployed` e2e tests on that URL. Without the `AZURE_STATIC_WEB_APPS_API_TOKEN` secret (and on Dependabot PRs) the deploy is skipped, not failed. Dependabot proposes weekly updates for npm (minor and patch grouped) and GitHub Actions.

## Documentation

- [User guide](docs/user-guide.md): the tabs, his signals, the first setup and what to do when something goes wrong.
- [docs/index.md](docs/index.md): vision, interaction model, architecture, decisions (ADR), conventions, specs.
- [CLAUDE.md](CLAUDE.md) and [AGENTS.md](AGENTS.md): how AI agents work in this repo.
