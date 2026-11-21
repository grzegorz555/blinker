---
type: Task List
title: "003: Deploy to Azure Static Web Apps tasks"
description: Five tasks, one commit each. T1–T3 need no Azure account; T4 needs the author's setup.
tags: [stage-1, deploy, security, ci]
status: stable
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-11
---

Branch: `feat/003-deploy` (from `main`, worktree `C:/Repozytorium/Blinker/wt/003-deploy`) · Gates: `npm run verify -- --quick`
locally, full gates in CI.

- [x] **T1 [sonnet]: One header config, served locally.** `staticwebapp.config.json` (headers, fallback, cache,
  MIME) copied to `dist/`; `serve-dist.mjs` applies it (R1, R2, R5). Tests: config vs. `security.md`, serve-dist
  mapping, cache patterns (unit); a local header e2e.
  *To understand:* response headers, what each header blocks, SPA fallback, why `ngsw.json` must not be cached.
- [x] **T2 [opus]: The build passes the production CSP.** `inlineCritical: false`; `check-dist` rejects inline
  scripts and handlers (R4); a shared e2e fixture fails on any CSP or Trusted Types violation, with a negative test
  (R3). Fix whatever the CSP breaks (likely suspects: the service worker registration and Transloco loading under
  Trusted Types). Tests: `check-dist` cases (unit); the fixture across all e2e.
  *To understand:* CSP directives, Trusted Types, why inline scripts are the main XSS vector, critical CSS.
  *Done together with T1 in one commit: serving the headers (T1) fails e2e until the build passes the CSP (T2). ADR-0004 came out of it.*
- [x] **T3 [sonnet]: Remote test project.** Playwright project `deployed` driven by `DEPLOY_URL`: headers on `/`, a
  deep link and a 404, HTTPS, smoke + axe (R9); skipped when `DEPLOY_URL` is not set. Tests: run it against the local
  server with `DEPLOY_URL=http://127.0.0.1:4300` (headers only, HTTPS check skipped on http).
  *To understand:* testing a deployed environment vs. a local build, Playwright projects and `baseURL`.
- [x] **T4 [opus]: Deploy workflow.** `ci.yml` deploy jobs + `preview-close.yml`: preview per PR with the URL comment, close on PR close, production
  on `main` after all CI jobs (R6, R7, R8); one build artifact reused; the remote test after each deploy. Needs the
  author's secret (setup guide). Tests: the first PR gets a preview and passes the remote test; a Dependabot PR skips.
  *To understand:* GitHub Actions events, `needs`, secrets and why Dependabot/forks don't get them, artifacts.
  *Merged before the author's Azure setup: the skip path (R7) is verified in CI; the first real preview and production
  deploy are verified after the secret is added.*
- [x] **T5 [haiku]: Docs and compound.** `security.md` (headers now live in the config, the test keeps them equal),
  `architecture.md`, README (production URL), specs index, log, Polish copies, summary.
  *To understand:* the compound step.
