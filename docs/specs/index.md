# Specs

One folder per feature: `NNN-slug/spec.md` (`type: Spec`) and `NNN-slug/tasks.md` (`type: Task List`), created with `/plan`.

# Specs
* [001: Application skeleton](001-app-skeleton/spec.md) - Stage 1. Angular PWA shell, i18n, a11y, Vitest, Playwright + axe. [Tasks](001-app-skeleton/tasks.md).

# Planned
- 002-ci-verify (stage 1): full CI on every PR, `npm run verify`, a versioned pre-push hook, the `dist/` check, Dependabot for npm.
- 003-deploy (stage 1): Azure Static Web Apps, security headers, preview per PR, production on merge, header e2e test.
- 004-mockups (before stage 2): clickable HTML/Tailwind mock-ups in `docs/design/` for the communicate, calibrate, boards and settings screens; the visual direction and final tokens.
