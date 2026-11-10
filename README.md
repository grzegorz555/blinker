# Blinker

Blinker helps a person who communicates by blinking. A phone or tablet camera follows the face, and the app scans a
letter board (column, then row). It recognizes deliberate signals (a long blink, head and eye movements) and turns
them into sentences that are shown on screen and read aloud.

- Runs in the browser as an installable PWA. Camera frames never leave the device.
- No accounts, no backend, no analytics.
- UI in English and Polish.

> Blinker is not a medical device. Keep the paper board as a fallback.

## Status
**Stage 1: application skeleton** (spec [001](docs/specs/001-app-skeleton/spec.md), in progress).
There are no user-facing features yet. The stage plan is in [docs/backlog.md](docs/backlog.md).

## Tech stack
- Angular 22 (standalone, zoneless, signals), TypeScript 6, in `src/web`
- Vitest for unit tests; Playwright + axe-core for e2e and accessibility tests
- Planned:
  - Tailwind CSS v4, Transloco (en, pl), PWA service worker;
  - MediaPipe Face Landmarker, Web Speech API;
  - hosting on Azure Static Web Apps (Free).

## Getting started
Requirements: Node.js 26 (see `src/web/.nvmrc`) and npm.

```
cd src/web
npm ci            # install exact versions from package-lock.json
npm start         # dev server at http://localhost:4200
```

## Tests and verification
Run these from `src/web`:

| Command | What it does |
|---|---|
| `npm test` | Vitest unit tests (single run). `npm run test:watch` runs them in watch mode. |
| `npm run build` | Production build into `dist/` (no source maps) |
| `npm run e2e` | Builds the app, then runs Playwright e2e tests with axe-core accessibility checks on desktop Chrome, Pixel 7 (Chromium) and iPhone 15 (WebKit). The first time, run `npx playwright install chromium webkit`. |
| `npm run format:check` | Prettier check. `npm run format` fixes formatting. |

From the repo root, `node scripts/check-okf.mjs` checks the documentation bundle.

## Documentation
- [docs/index.md](docs/index.md): vision, interaction model, architecture, decisions (ADR), conventions, specs.
- [CLAUDE.md](CLAUDE.md) and [AGENTS.md](AGENTS.md): how AI agents work in this repo.
