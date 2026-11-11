# Blinker

Blinker helps a person who communicates by blinking. A phone or tablet camera follows the face, and the app scans a
letter board (column, then row). It recognizes deliberate signals (a long blink, head and eye movements) and turns
them into sentences that are shown on screen and read aloud.

- Runs in the browser as an installable PWA. Camera frames never leave the device.
- No accounts, no backend, no analytics.
- UI in English and Polish.

> Blinker is not a medical device. Keep the paper board as a fallback.

## Status
**Stage 1: CI and local verification** (spec [002](docs/specs/002-ci-verify/spec.md), in progress; spec [001](docs/specs/001-app-skeleton/spec.md), the application skeleton, is done).
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
npm run hooks:install   # once per clone: the pre-push hook runs npm run verify
```

## Tests and verification
Run these from `src/web`. **`npm run verify` runs every gate below in the same order as CI** and prints which passed, which failed and which were not run.

| Command | What it does |
|---|---|
| `npm run verify` | All gates: docs check, Prettier, ESLint, unit tests, script tests, `npm audit` (high in any dependency, any in production), build, `dist/` check, e2e. Stops at the first failure. |
| `npm run lint` | ESLint: TypeScript rules, Angular template accessibility rules, and security rules (no `innerHTML`/`eval`) |
| `npm test` | Vitest unit tests (single run). `npm run test:watch` runs them in watch mode. |
| `npm run build` | Production build into `dist/` (no source maps) |
| `npm run e2e` | Builds the app, then runs Playwright e2e tests with axe-core accessibility checks on desktop Chrome, Pixel 7 (Chromium) and iPhone 15 (WebKit). The first time, run `npx playwright install chromium webkit`. |
| `npm run test:scripts` | Tests of the Node helper scripts (built-in `node --test`) |
| `npm run check:dist` | Fails if the production build contains `.map` or `.md` files or `sourceMappingURL` comments |
| `npm run icons` | Regenerates the placeholder app icons in `public/icons/` (pure Node, no dependencies) |
| `npm run format:check` | Prettier check. `npm run format` fixes formatting. |

From the repo root, `node scripts/check-okf.mjs` checks the documentation bundle.

## Documentation
- [docs/index.md](docs/index.md): vision, interaction model, architecture, decisions (ADR), conventions, specs.
- [CLAUDE.md](CLAUDE.md) and [AGENTS.md](AGENTS.md): how AI agents work in this repo.
