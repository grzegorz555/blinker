# Specs

One folder per feature: `NNN-slug/spec.md` (`type: Spec`) and `NNN-slug/tasks.md` (`type: Task List`), created with `/plan`.

# Specs
* [001: Application skeleton](001-app-skeleton/spec.md) - Stage 1. Angular PWA shell, i18n, a11y, Vitest, Playwright + axe. [Tasks](001-app-skeleton/tasks.md).
* [002: CI and local verification](002-ci-verify/spec.md) - Stage 1. `npm run verify`, pre-push hook, full CI, Lighthouse CI (a11y = 100), installability e2e, Dependabot for npm. [Tasks](002-ci-verify/tasks.md).
* [005: Model routing and a faster pre-push](005-model-routing/spec.md) - Tooling. A model per loop step plus a difficulty label per task; the pre-push hook runs only the fast gates. [Tasks](005-model-routing/tasks.md).

# Planned
- 003-deploy (stage 1): Azure Static Web Apps, security headers, preview per PR, production on merge, header e2e test.
- 004-mockups (before stage 2): clickable HTML/Tailwind mock-ups in `docs/design/` for the communicate, calibrate, boards and settings screens; the visual direction and final tokens. Debt from 001:
  - a real app icon, with separate `any` and `maskable` variants (today one placeholder image serves both);
  - `theme-color` derived from the final tokens.
