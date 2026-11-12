---
type: Task List
title: "004: Mock-ups tasks"
description: Seven tasks, one commit each. Revised after T2 - one shadcn-style visual language, a caregiver dashboard and a full-screen communicate mode; visual polish rounds before the final tokens.
tags: [stage-1.5, design, mockups]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-12
---

Branch: `feat/004-mockups` (from `main`, worktree `C:/Repozytorium/Blinker/wt/004-mockups`) · Gates:
`npm run verify -- --quick` locally, full gates in CI.

- [x] **T1 [sonnet]: Mock-up toolchain.** `src/web/design/` with the catalog page, `design.css`, `design.js` stub;
  `design:build` (PostCSS + Tailwind to `dist/design/`), `design:serve` (LAN, port 4310, production headers, prints
  the address), `check-dist` rule against `design/` in the app build and the inline-script rule on `dist/design/`
  (R1, R2, R10). Tests: build, serve (traversal, no listing, headers, LAN address list) and check-dist cases (unit);
  a `design` Playwright project with the CSP guard and axe on the catalog (e2e).
  *To understand:* what PostCSS and Tailwind do at build time, `0.0.0.0` vs. `127.0.0.1`, a LAN IP address, why
  the firewall asks, path traversal.
- [x] **T2 [sonnet]: Three directions and a contrast test.** `scripts/contrast.mjs` (OKLCH → contrast ratio) with
  thresholds per token pair; directions A, B, C as token overrides (R3, R4); the communicate screen in the "asking
  Kolumna 7?" state, portrait and landscape, light and dark (R6). Tests: contrast unit cases incl. a failing pair; e2e
  axe + no overflow in the five viewports for each direction.
  *To understand:* OKLCH, relative luminance and the contrast ratio, why AAC text targets 7:1, CSS custom properties
  scoped by an attribute.
  *Outcome:* the layout works, the look didn't convince the author; the spec was revised (shadcn style, dashboard).
- [x] **T3 [sonnet]: Visual language, app shell, start page and communicate mode.** The `base` style (shadcn-like
  token values, `data-style="base"`) replacing A/B/C, and the `directions.html` page removed (R3); a shell with a
  top bar, a bottom navigation bar below 1024 px and a sidebar from 1024 px (R12); `start.html` with the dashboard
  cards (R13); `communicate.html` in the "Kolumna 7?" state, full screen, with "Zakończ" and the caregiver menu
  (R6, R12). Tests: contrast for `base` (unit); e2e axe in light and dark on both pages, the shell at 360/768/1280 px
  (bottom bar vs. sidebar, `aria-current`, 44 px targets, no horizontal scroll at 320 px), the communicate screen in
  the five viewports with the menu closed and open.
  *To understand:* app shells and landmarks, why navigation moves to the bottom on phones, the disclosure pattern,
  `<details>` vs. a dialog.
  **Gate:** the author looks at it on the phone; we do visual polish rounds (each round a small commit).
- [ ] **T4 [sonnet]: Communicate states and the simulator.** Every state from R8 reachable by `#state` links;
  keyboard and on-screen simulator (R7); the caregiver-held layout. Tests: e2e simulator path by keys and by buttons,
  live region announcements, axe on every state, reduced motion.
  *To understand:* `aria-live`, URL fragments as state, why the simulator is not the real state machine.
- [ ] **T5 [sonnet]: Calibrate, boards and settings.** In the shell: calibration wizard (camera explanation before the
  prompt, blink, hand left/right, nod, shake, result); boards (list, preview of the friend's layout, JSON import with
  validation errors shown in text); settings (mode, timings, signal mapping, voice, language, theme). Tests: e2e axe
  on every page and step, keyboard-only pass through the wizard, form errors linked with `aria-describedby`.
  *To understand:* wizard patterns, error messages that meet SC 3.3.1, radio vs. switch.
- [ ] **T6 [sonnet]: Final tokens, theme-color and icon.** After the polish rounds: the `base` values into
  `tokens.css` (R3); `theme-color` in `index.html` and the manifest from the tokens; icon with separate `any` and
  `maskable` files (`npm run icons`). Tests: the contrast test also runs on `tokens.css`; unit test that `theme-color`
  equals the token; the existing manifest, installability and Lighthouse checks pass.
  *To understand:* maskable icons and the safe zone, `theme-color` in light and dark.
- [ ] **T7 [haiku]: Docs and compound.** `docs/design/index.md` (visual language, token table with ratios, app
  structure, screen inventory, phone-test findings), `docs/index.md`, README (how to view the mock-ups), specs index,
  log, Polish copies, summary.
  *To understand:* the compound step.
