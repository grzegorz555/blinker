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
**Stage 1.5: mock-ups** (spec [004](docs/specs/004-mockups/spec.md), done; outcome in [docs/design](docs/design/index.md): Material 3 style, Liczenie (the board) as the main screen with tappable letters, a navigation bar on phones and a rail from 600 px, Zdania and Kalibracja; ADR-0005 (Angular Material where it has a component) is accepted. Every Liczenie state can be opened from the catalog, and a signal simulator plays his signals by keys or by buttons. Kalibracja has a step-by-step wizard, Tablice a JSON import with errors in text, Ustawienia the timings, signals, voice, hints, language and theme. The final M3 tokens are in the app, with theme-color and separate any/maskable icons).
**Stage 2: board and input without a camera** (spec [006](docs/specs/006-counting-core/spec.md) done: the board format v1 with a validator for imported files and his board as the default, the sentence with undo, the counting state machine (a nod without a number is a space), one input type with a keyboard mapping that is off by default, on-device speech, and CountingService; next: the screens in spec 007).
The app shell works in English and Polish (language switch, translated titles); there are no communication features yet. The stage plan is in [docs/backlog.md](docs/backlog.md).

## Tech stack

- Angular 22 (standalone, zoneless, signals), TypeScript 6, in `src/web`
- Vitest for unit tests; Playwright + axe-core for e2e and accessibility tests
- Installable PWA (web manifest, Angular service worker): the app shell works offline after the first visit
- Transloco for UI translations (en, pl) in `src/web/public/i18n/`; the language comes from the saved choice, then the browser, then Polish
- Tailwind CSS v4 with design tokens in `src/web/src/styles/tokens.css` (light and dark, WCAG contrast checked)
- Planned:
  - MediaPipe Face Landmarker, Web Speech API;
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

| Command                                | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify`                       | All gates: docs check, Prettier, ESLint, unit tests, script tests, `npm audit` (high in any dependency, any in production), build, `dist/` check, mock-ups build, e2e. Stops at the first failure. `-- --quick` runs only docs, Prettier, ESLint, unit and script tests (about 20–30 s; the pre-push hook uses it).                                                                                                                                                        |
| `npm run lint`                         | ESLint: TypeScript rules, Angular template accessibility rules, and security rules (no `innerHTML`/`eval`)                                                                                                                                                                                                                                                                                                                                                                 |
| `npm test`                             | Vitest unit tests (single run). `npm run test:watch` runs them in watch mode.                                                                                                                                                                                                                                                                                                                                                                                              |
| `npm run build`                        | Production build into `dist/` (no source maps)                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `npm run e2e`                          | Builds the app, then runs Playwright e2e tests with axe-core accessibility checks on desktop Chrome, Pixel 7 (Chromium) and iPhone 15 (WebKit), including a manifest check over the DevTools Protocol. It also builds the mock-ups and runs the `design` project (Chromium) against them. The local server sends the production security headers, and every test fails on a CSP or Trusted Types violation. The first time, run `npx playwright install chromium webkit`.  |
| `DEPLOY_URL=<url> npx playwright test` | Runs only the `deployed` project against a deployed copy (preview or production): headers, HTTPS, smoke + axe. In PowerShell: `$env:DEPLOY_URL='<url>'; npx playwright test`.                                                                                                                                                                                                                                                                                              |
| `npm run test:scripts`                 | Tests of the Node helper scripts (built-in `node --test`)                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `npm run check:dist`                   | Fails if the production build contains a `design/` folder (mock-ups), `.map` or `.md` files, `sourceMappingURL` comments, or inline scripts and `on…=` handlers in HTML                                                                                                                                                                                                                                                                                                    |
| `npm run lighthouse`                   | Lighthouse CI on the production build (home and 404, English and Polish); fails unless Accessibility = 100. Needs `npm run build` first and Google Chrome. Reports: `.lighthouseci/reports-en`, `reports-pl`. `npm run verify -- --lighthouse` includes it.                                                                                                                                                                                                                |
| `npm run design:build`                 | Builds the clickable mock-ups (spec 004) from `design/` into `dist/design/` (Tailwind via PostCSS); fails on raw colors in the markup and on inline scripts. They never ship in the app build. Without a server, open `dist/design/index.html` in a browser. The catalog links to every Liczenie state (`communicate.html#asking-row`) and to the simulator (`?sim=1`); keys: Space = blink +1, H = hand +5, N = nod, S = shake, R = head right, P = pause, F = face lost. |
| `node scripts/contrast.mjs`            | Prints the contrast ratio of every token pair (the app tokens, light and dark) and fails below the threshold: 7:1 for what he reads, 4.5:1 for other text, 3:1 for outlines. Also part of `npm run test:scripts`.                                                                                                                                                                                                                                                          |
| `npm run design:serve`                 | Builds the mock-ups and serves them on port 4310 with the production headers, **for viewing on a phone over the home Wi-Fi**: it prints the address to open (`http://192.168.x.x:4310/`). If Windows asks about the firewall, allow private networks only; don't run it on public Wi-Fi. Stop with Ctrl+C.                                                                                                                                                                 |
| `npm run icons`                        | Regenerates the app icons in `public/icons/` from the tokens: `icon-any-*` and `icon-maskable-*` (192, 512 px), the favicon and the apple-touch-icon (pure Node, no dependencies)                                                                                                                                                                                                                                                                                          |
| `node scripts/theme-color.mjs`         | Checks that `theme-color` in `index.html` and the manifest equals the `--bg` token (light and dark); `--write` updates them. Also part of `npm run test:scripts`.                                                                                                                                                                                                                                                                                                          |
| `npm run format:check`                 | Prettier check. `npm run format` fixes formatting.                                                                                                                                                                                                                                                                                                                                                                                                                         |

From the repo root, `node scripts/check-okf.mjs` checks the documentation bundle.

**CI** (`.github/workflows/ci.yml`) runs on every pull request and on `main`: the docs check, a gitleaks secret scan, an OSV-Scanner vulnerability scan, `npm run verify` (the same gates as above), and Lighthouse in a separate job (reports kept as a workflow artifact for 7 days). After every gate passes, the tested build is deployed to Azure Static Web Apps: a preview per PR (its URL is commented on the PR) or production on `main`, followed by the `deployed` e2e tests on that URL. Without the `AZURE_STATIC_WEB_APPS_API_TOKEN` secret (and on Dependabot PRs) the deploy is skipped, not failed. Dependabot proposes weekly updates for npm (minor and patch grouped) and GitHub Actions.

## Documentation

- [docs/index.md](docs/index.md): vision, interaction model, architecture, decisions (ADR), conventions, specs.
- [CLAUDE.md](CLAUDE.md) and [AGENTS.md](AGENTS.md): how AI agents work in this repo.
