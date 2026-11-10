---
type: Spec
title: "001: Application skeleton"
description: Angular 22 PWA skeleton in src/web with Tailwind tokens, Transloco en/pl, ESLint with a11y rules, Vitest and Playwright + axe; an accessible app shell and a placeholder home page.
tags: [stage-1, web, setup, accessibility, i18n, pwa, testing]
status: stable
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-10
verified:
  - by: human:grzegorz555
    at: 2026-11-10
---

# Goal
Get a working, installable, bilingual and accessible application shell, together with the testing tools that
every later task depends on. There are no camera, board or scanning features yet.

# Scope
- An Angular 22 workspace in `src/web`: standalone, zoneless, strict TypeScript, Vitest as the unit runner, Prettier.
- **Playwright + axe-core** e2e setup with three projects:
  - `desktop-chromium`;
  - `pixel-chromium` (Pixel 7);
  - `iphone-webkit` (iPhone 15).

  Each runs portrait and landscape checks for the shell.
- **ESLint** (`angular-eslint`): TypeScript rules, the template accessibility rules (`templateAccessibility`) and `eslint-plugin-no-unsanitized`.
- **Tailwind CSS v4** with design tokens in `src/styles/tokens.css` (OKLCH, light and dark, following `prefers-color-scheme`).
- **App shell:**
  - a skip link;
  - a header with the app name and a language switch;
  - `<main>`;
  - a footer with the disclaimer "Blinker is not a medical device…";
  - `min-h-dvh`, safe-area padding.
- **Transloco** with `public/i18n/en.json` and `pl.json`:
  - the language comes from a saved choice, then the browser, then `pl`;
  - the choice is saved in localStorage;
  - `<html lang>` follows the language;
  - route titles are translated.
- **PWA:** web manifest (name, short name, theme colors, placeholder icons) and the Angular service worker (production only). The app shell works offline after the first visit.
- A **home page** placeholder: the app name, a one-sentence description, and the information that communication arrives in stage 2.
- A 404 page.

# Rules
- R1: All visible text comes from Transloco. Every key exists in both `en.json` and `pl.json`.
- R2: The language is resolved in this order: saved choice → browser language (`pl*` → pl, `en*` → en) → `pl`. An unknown saved value is ignored.
- R3: Switching the language updates the visible text, `<html lang>` and the document title, and persists the choice.
- R4: The language switch shows the endonyms "English" and "Polski". The current language is marked with `aria-pressed="true"` (or `aria-current`), not by color alone.
- R5: The skip link is the first focusable element. It becomes visible on focus and moves focus to `<main>`.
- R6: Landmarks: exactly one each of `header` (banner), `main` and `footer` (contentinfo).
- R7: Contrast:
  - text at least 4.5:1;
  - non-text elements and the focus ring at least 3:1;
  - in both light and dark themes.
- R8: No horizontal scroll at 320 px width. The layout works in portrait and landscape.
- R9: Production builds have no source maps. Nothing is loaded from third-party origins: no web fonts from a CDN, the system font stack is used.
- R10: The service worker is registered only in production builds.

# UI and accessibility notes
- Touch targets in the header are at least 44×44 px. The focus style is `focus-visible:ring-2` with an offset.
- Respect `prefers-reduced-motion`. There are no animations in this spec.
- The real visual design comes from the mock-ups spec (004). This spec uses neutral tokens that we can replace later.

# Security and privacy notes
- No third-party requests (checked in e2e: every request goes to the same origin).
- No `innerHTML` or `bypassSecurityTrust*` (ESLint `no-unsanitized` + review).
- CSP and the other response headers are applied in spec 003 (deploy). This spec only avoids patterns that would break them: no inline scripts in `index.html` and no `eval`.

# Acceptance criteria
- [ ] `npm ci && npm run lint && npm test && npm run build && npm run e2e` pass in `src/web`.
- [ ] The app opens at 360 px and 1280 px, in portrait and landscape, without horizontal scroll.
- [ ] axe reports 0 violations (WCAG 2.0/2.1/2.2 A and AA tags) on the home and 404 pages, in light and dark mode and in both languages.
- [ ] The language switch works by keyboard and touch, persists after a reload, and updates `lang` and the title.
- [ ] Lighthouse (production build): PWA installable, Accessibility 100.
- [ ] Offline: after the first visit, a reload with the network offline shows the app shell (e2e on the production build).
- [ ] `dist/` contains no `.map` files.

# Test plan
- **Unit (Vitest):**
  - language resolution (R2): every branch, including an invalid stored value and an unsupported browser language;
  - the language service (R3): `lang` attribute, title, persistence;
  - the language switch component (R4): endonyms and `aria-pressed`;
  - the shell component: landmarks (R6) and the skip link target (R5);
  - a translation-key parity test: the `en` and `pl` key sets are equal (R1).
- **E2E (Playwright + axe):**
  - home loads in every project and passes axe (light and dark, en and pl);
  - skip link: Tab → visible → Enter → focus in `main`;
  - language switch: switch → text, `lang` and title change → reload keeps the choice;
  - 320 px width: `scrollWidth <= clientWidth`;
  - 404 page and axe;
  - only same-origin requests;
  - offline shell on the production build (`desktop-chromium` only).

# Out of scope
CI changes (spec 002), hosting and headers (spec 003), the real visual design (spec 004), spartan components (added
when first needed), the camera, boards and speech.

# References (verified 2026-11-10)
- WCAG 2.2 Understanding:
  - [2.4.1 Bypass Blocks](https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html) (R5)
  - [1.4.3 Contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) (R7)
  - [1.4.10 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) (R8)
  - [3.1.1 Language of Page](https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html) (R3)
  - [2.4.2 Page Titled](https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html) (R3)
  - [2.5.8 Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
  - [2.4.7 Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html)
- WAI-ARIA APG:
  - [Landmark Regions](https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/) (R6)
  - [Button pattern, toggle buttons and `aria-pressed`](https://www.w3.org/WAI/ARIA/apg/patterns/button/) (R4)
- Angular:
  - [Accessibility](https://angular.dev/best-practices/a11y)
  - [Zoneless](https://angular.dev/guide/zoneless)
  - [Unit testing](https://angular.dev/guide/testing)
  - [Service workers](https://angular.dev/ecosystem/service-workers) (R10)
  - [TitleStrategy](https://angular.dev/api/router/TitleStrategy) (R3)
  - [Security](https://angular.dev/best-practices/security)
- [Transloco](https://jsverse.gitbook.io/transloco) · [Tailwind CSS with Angular](https://tailwindcss.com/docs/installation/framework-guides/angular)
- Playwright:
  - [Accessibility testing (axe)](https://playwright.dev/docs/accessibility-testing)
  - [Web server](https://playwright.dev/docs/test-webserver)
  - [Emulation](https://playwright.dev/docs/emulation)
- [angular-eslint](https://github.com/angular-eslint/angular-eslint) · [eslint-plugin-no-unsanitized](https://github.com/mozilla/eslint-plugin-no-unsanitized)
- PWA: [Install criteria](https://web.dev/articles/install-criteria) · [Web app manifest (MDN)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest)
