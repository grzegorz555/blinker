# Log

## 2026-11-12 (spec 004, polish round 1)
- The author rejected the shadcn look and the start dashboard. The mock-ups move to Material 3: Liczenie (the board) is the main screen in the supporting-pane layout, with tappable letters, visible sentence actions and a Pauza toggle; a navigation bar below 600 px and a rail from 600 px; Zdania and Kalibracja take the dashboard's content. ADR-0005 (Angular Material instead of spartan-ng) proposed.
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
