---
type: Task List
title: "002: CI and local verification tasks"
description: Six tasks, one commit each, each with its own tests.
tags: [stage-1, ci]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-11
---

Branch: `feat/002-ci-verify` · One task = one commit (with its tests) · Gates: everything from spec 001, then `npm run verify` (from T2).

- [x] **T1: Fix the flaky offline e2e helper.** `waitForAppShellCached` waits for every URL of the `app` group in `/ngsw.json`, not only `index.html`. Test: `npx playwright test e2e/pwa.e2e.ts --repeat-each=8` is green.
  *To understand:* why a test is flaky, how ngsw fills its caches, what `ngsw.json` contains.
- [x] **T2: `npm run verify` and the `dist/` check.** `scripts/verify.mjs` (R1, R3), `scripts/check-dist.mjs` (R4), `npm run test:scripts` with `node --test`. Tests: `check-dist` cases.
  *To understand:* npm scripts, exit codes, the Node test runner, why source maps don't belong in production.
- [x] **T3: Pre-push hook.** `.githooks/pre-push` (R5), `npm run hooks:install`, and updated local setup in `docs/conventions/git.md` and `CLAUDE.md`. Test: a manual push with a deliberate lint error is blocked (described in the summary).
  *To understand:* git hooks, `core.hooksPath`, why a local hook is only a safety net.
- [x] **T4: CI web job and Dependabot for npm.** The `web` job in `ci.yml` (R2, R3), Playwright browsers with OS dependencies, the Playwright report as an artifact, and `npm` in `dependabot.yml`. Test: CI on the PR.
  *To understand:* GitHub Actions jobs and steps, `npm ci` and caching, artifacts, Dependabot groups.
- [x] **T5: Lighthouse CI and the installability e2e.** `@lhci/cli` with the `basic-ftp` override, `lighthouserc.cjs`, `scripts/lighthouse.mjs` (en and pl), the language guard (R6), the `lighthouse` CI job (R7), and `e2e/installability.e2e.ts` (R8, `Page.getAppManifest` with a negative case). Tests: guard cases in `node --test`, and the installability e2e.
  *To understand:* how Lighthouse scores accessibility, how it differs from axe, CDP, why reports must not go to public storage.
- [x] **T6: Docs and compound.** README, `CLAUDE.md` commands, `docs/architecture.md`, the specs index, backlog and log, the Polish copies, and learnings. Check off spec 001's follow-up checks.
  *To understand:* the compound step.
