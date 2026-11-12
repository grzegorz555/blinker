---
type: Task List
title: "004: Mock-ups tasks"
description: Six tasks, one commit each. A gate after T2, where the author picks the visual direction.
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
  **Gate:** the author opens A, B, C on the phone (and shows the friend if possible) and picks one.
- [ ] **T3 [sonnet]: Communicate screen, all states, and the simulator.** Every state from R8 in the chosen
  direction, reachable by `#state` links; keyboard and on-screen simulator (R7); the caregiver-held layout.
  Tests: e2e simulator path by keys and by buttons, live region announcements, axe on every state, reduced motion.
  *To understand:* `aria-live`, URL fragments as state, why the simulator is not the real state machine.
- [ ] **T4 [sonnet]: Calibrate, boards and settings.** Calibration wizard (camera explanation before the prompt,
  blink, hand left/right, nod, shake, result); boards (list, preview of the friend's layout, JSON import with
  validation errors shown in text); settings (mode, timings, signal mapping, voice, language, theme). Tests: e2e axe
  on every page and step, keyboard-only pass through the wizard, form errors linked with `aria-describedby`.
  *To understand:* wizard patterns, error messages that meet SC 3.3.1, radio vs. switch.
- [ ] **T5 [sonnet]: Final tokens, theme-color and icon.** The chosen values into `tokens.css` (R3); `theme-color`
  in `index.html` and the manifest from the tokens; icon with separate `any` and `maskable` files (`npm run icons`).
  Tests: the contrast test also runs on `tokens.css`; unit test that `theme-color` equals the token; the existing
  manifest, installability and Lighthouse checks pass.
  *To understand:* maskable icons and the safe zone, `theme-color` in light and dark.
- [ ] **T6 [haiku]: Docs and compound.** `docs/design/index.md` (direction, token table with ratios, screen
  inventory, phone-test findings), `docs/index.md`, README (how to view the mock-ups), specs index, log, Polish
  copies, summary.
  *To understand:* the compound step.
