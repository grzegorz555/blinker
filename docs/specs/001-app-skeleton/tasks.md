---
type: Task List
title: "001: Application skeleton tasks"
description: Seven tasks, one commit each, each with its own tests.
tags: [stage-1, web]
status: stable
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-10
verified:
  - by: human:Grzegorz Roczniak
    at: 2026-11-10
---

Branch: `feat/001-app-skeleton` · One task = one commit (with its tests) · Gates: `npm run lint` (from T3), `npm test`, `npm run build`, `npm run e2e` (from T2).

- [x] **T1: Scaffold the Angular workspace.** `ng new` in `src/web` (standalone, zoneless, no SSR, CSS, routing, Vitest), strict TS, Prettier, npm scripts, a `.nvmrc`/`engines` Node pin, no source maps in production. Test: the root component renders.
  *To understand:* Angular CLI workspace, zoneless change detection, Vitest + TestBed, the package-lock and `npm ci`.
- [x] **T2: E2E infrastructure.** Playwright (3 projects), `@axe-core/playwright`, a shared `expectNoA11yViolations(page)` helper, the `webServer` setting in the config, and a smoke test (the page loads, axe passes, only same-origin requests).
  *To understand:* Playwright projects and devices, the `webServer` option, how axe works and what it can't see.
- [x] **T3: Linting.** `angular-eslint` with `templateAccessibility`, `eslint-plugin-no-unsanitized`, and `npm run lint`. Fix every finding. Test: lint passes; a deliberately bad template snippet is described in the summary, not committed.
  *To understand:* ESLint flat config, template a11y rules, why `innerHTML` is dangerous.
- [x] **T4: Tailwind and the app shell.** Tailwind v4 (PostCSS), `tokens.css` (light/dark, contrast checked and noted in comments), the shell (skip link, header, main, footer disclaimer), safe area, `min-h-dvh`, a home placeholder and a 404 route. Unit tests: landmarks and the skip link. E2E: skip link, 320 px reflow, portrait and landscape, axe in light and dark.
  *To understand:* Tailwind v4 `@theme`, OKLCH, WCAG contrast, landmarks, `prefers-color-scheme`, `dvh`.
- [x] **T5: i18n.** Transloco loader, `core/i18n` (language resolution as a pure function, the language service), the language switch component, translated route titles (a `TitleStrategy`), en/pl JSON, and a key-parity unit test. E2E: switch, persistence after reload, `lang`, title, axe in both languages.
  *To understand:* Transloco runtime loading, `TitleStrategy`, `aria-pressed`, endonyms, SC 3.1.1.
- [x] **T6: PWA.** `@angular/pwa` (manifest, ngsw, placeholder icons), registration only in production, a script that serves the production build locally for e2e, and an offline e2e test.
  *To understand:* service worker lifecycle, `ngsw-config.json` asset groups, web manifest, installability criteria.
- [ ] **T7: Docs and compound.** Update `docs/architecture.md` (actual structure), the commands in `CLAUDE.md`, and the Polish copies. Write the learning summary, capture learnings, and add a `docs/log.md` entry.
  *To understand:* the compound step: what is worth turning into a rule.
