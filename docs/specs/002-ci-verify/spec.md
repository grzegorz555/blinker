---
type: Spec
title: "002: CI and local verification"
description: One `npm run verify` command with the same gates as CI, a versioned pre-push hook, a full CI job for the web app, Lighthouse CI (accessibility = 100) and an automated installability check, plus Dependabot for npm.
tags: [stage-1, ci, testing, tooling, accessibility, pwa]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-11
---

# Goal
Make "green" mean the same thing on the author's machine and on GitHub. Branch protection is not available on the
free plan (`docs/conventions/git.md`), so every gate runs **locally before a push** and **in CI on every PR**, from one
definition. The two checks deferred from spec 001 (Lighthouse accessibility = 100 and installability) become automated.

# Scope
- **`npm run verify`** in `src/web`: runs every gate in a fixed order and prints a summary of what passed, what failed
  and what was not run. `npm run verify -- --lighthouse` also runs Lighthouse.
- **`dist/` check** (`scripts/check-dist.mjs`): the production build contains no `.map` files, no `.md` files and no
  `sourceMappingURL` comments.
- **Versioned pre-push hook** in `.githooks/pre-push` that runs `npm run verify`, plus `npm run hooks:install`, which
  points `core.hooksPath` at `.githooks`.
- **CI:** a `web` job in `.github/workflows/ci.yml` that runs the same gates as `verify`, then a `lighthouse` job.
  Playwright and Lighthouse reports are uploaded as artifacts when a job fails.
- **Lighthouse CI** (`@lhci/cli`): home and 404 pages, in English and in Polish, mobile emulation (the default).
  It asserts that the Accessibility score is 1.0. Reports stay on disk or in CI artifacts. They are never uploaded to
  public storage.
- **Installability e2e:** Chromium reports no installability errors (`Page.getInstallabilityErrors` over CDP). A
  negative test with a broken manifest proves that the check can fail.
- **Dependabot for npm** in `/src/web`: weekly, minor and patch updates grouped.
- **Fix of a flaky e2e helper** found while measuring the gates: the offline tests went offline before every file of
  the service worker's `app` group was cached.

# Rules
- R1: `verify` runs, in this order:
  1. docs OKF check;
  2. Prettier check;
  3. ESLint;
  4. unit tests (Vitest);
  5. script tests (`node --test`);
  6. `npm audit --audit-level=high`;
  7. production build;
  8. `dist/` check;
  9. e2e tests (Playwright + axe) on that build;
  10. Lighthouse, only with `--lighthouse`.

  It stops at the first failure. Its summary lists every gate as passed, failed or not run, with the time taken.
- R2: CI runs the same gates with the same npm scripts (no second definition of a gate). Lighthouse runs in its own
  job in CI, so that a slow audit doesn't hide unit test results.
- R3: The audit policy: CI and `verify` fail on any **high** or **critical** advisory in any dependency, and on **any**
  advisory in production dependencies (`npm audit --omit=dev`). Moderate advisories in development tooling are
  reported but don't block. They are reviewed when Dependabot proposes a fix.
- R4: The `dist/` check fails if `dist/blinker-web/browser` is missing, or contains a `.map` or `.md` file or a
  `sourceMappingURL` comment in a `.js` or `.css` file. It prints every offending path.
- R5: The pre-push hook runs `npm run verify` from `src/web` and blocks the push when it fails. If `node_modules` is
  missing, the hook blocks the push and tells the author to run `npm ci`. Agents never bypass it with `--no-verify`.
- R6: Lighthouse asserts `categories:accessibility` = 1 for every URL and language. A guard script checks in each
  report that the page was rendered in the expected language, because a browser could ignore the language flag.
- R7: Lighthouse reports are written to `src/web/.lighthouseci/` (git-ignored) and, in CI, uploaded as a workflow
  artifact. `temporary-public-storage` is never used.
- R8: Installability: Chromium's `Page.getInstallabilityErrors` returns an empty list for the production build. With
  the manifest request replaced by an invalid manifest, the list is not empty.

# Security and privacy notes
- CI keeps `permissions: contents: read`, and actions are pinned to a full commit SHA, as in stage 0.
- Lighthouse CI uploads nothing (R7). Its default `temporary-public-storage` target would publish reports on a public
  server.
- `@lhci/cli` pulls in `basic-ftp` 5.x with a high-severity advisory (GHSA-c475-qrg2-pj4r). We don't use FTP. An npm
  `overrides` entry pins the patched `basic-ftp` 6.2.6.

# Acceptance criteria
- [ ] `npm run verify` passes locally and prints the summary. `npm run verify -- --lighthouse` also passes.
- [ ] A push with a failing gate is blocked by the hook (shown with a deliberate lint error, not committed).
- [ ] CI on the PR is green: `docs`, `secrets`, `web` and `lighthouse` jobs.
- [ ] Lighthouse Accessibility = 100 for home and 404, in English and Polish.
- [ ] The installability e2e passes, and its negative case shows that the check can fail.
- [ ] The offline e2e tests pass 8 runs in a row (`--repeat-each=8`).
- [ ] Dependabot has an `npm` entry for `/src/web`.

# Test plan
- **Script tests (`node --test`):** `check-dist` finds `.map`, `.md` and `sourceMappingURL`, passes a clean tree and
  fails on a missing folder; the Lighthouse language guard accepts the expected language and rejects another one or a
  missing marker.
- **E2E:** installability (positive and negative), plus the existing suite with the fixed offline helper.
- **Unit (Vitest):** no app code changes, so the existing suite must stay green.
- **Manual:** the hook blocks a push with a lint error, and the CI run on the PR is green.

# Out of scope
Deploys and response headers (spec 003), the real visual design (spec 004), performance budgets in Lighthouse.

# References (verified 2026-11-11)
- Lighthouse CI: [Configuration](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md) · [Getting started](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/getting-started.md)
- Chrome DevTools Protocol: [Page.getInstallabilityErrors](https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-getInstallabilityErrors) · Playwright [CDPSession](https://playwright.dev/docs/api/class-cdpsession)
- PWA install criteria: [web.dev](https://web.dev/articles/install-criteria)
- Playwright on CI: [Continuous Integration](https://playwright.dev/docs/ci) · [GitHub Actions](https://playwright.dev/docs/ci-intro)
- GitHub Actions: [Security hardening (pin to SHA, least privilege)](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions) · [setup-node caching](https://github.com/actions/setup-node#caching-global-packages-data)
- Dependabot: [Configuration options (groups)](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference)
- npm: [npm audit](https://docs.npmjs.com/cli/commands/npm-audit) · [overrides](https://docs.npmjs.com/cli/configuring-npm/package-json#overrides)
- Git: [githooks (pre-push)](https://git-scm.com/docs/githooks#_pre_push) · [core.hooksPath](https://git-scm.com/docs/git-config#Documentation/git-config.txt-corehooksPath)
- Node.js: [Test runner](https://nodejs.org/api/test.html)
- Angular: [Service worker devops](https://angular.dev/ecosystem/service-workers/devops)
