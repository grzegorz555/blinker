---
type: Convention
title: Testing conventions
description: Every task ships with Vitest unit tests; Playwright + axe e2e tests are added and run in batches, by hand; how to test camera-driven features without a camera.
tags: [convention, testing]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-10
---

# Definition of done
A task is done only when **in the same commit** as the code there are:
1. **Unit tests (Vitest)** for every rule in the spec. Pure logic (state machines, the signal detector, the board validator, the input mapping) aims for **100% branch coverage**.
2. Green gates: `npm run verify -- --quick` before the push (the hook runs it); CI runs `npm run verify` (everything except e2e and Lighthouse in the web job).

**E2E is not part of a task** (the author, 2026-11-17: it takes too long after every change):
- the spec's Test plan lists the e2e paths with an axe scan, and the task names them, but does not write them;
- from time to time the author asks for an **e2e pass**: it writes the missing e2e tests for the specs done since the last pass, runs `npm run e2e` (or Actions > E2E > Run workflow) and fixes what fails;
- the `deployed` project still runs after every deploy in CI (headers, HTTPS, smoke + axe on the real host).

# Unit tests (Vitest)
- Test names say what happens: `describe('ScanStateMachine')` → `it('returns to column scanning after undo in row scanning')`.
- Use the Arrange / Act / Assert layout, with one reason to fail per test.
- **Time is injected**: never call `Date.now()` or `setTimeout` directly in the logic. Inject a clock and use `vi.useFakeTimers()`.
- Signal detection is tested with **recorded or synthetic frame sequences** (arrays of blendshape values with timestamps) stored as fixtures in `src/web/src/testing/fixtures/`. Fixtures are synthetic, or anonymized numbers only: never images.
- Components are tested through TestBed by their user-visible behavior (text, roles, clicks). Transloco uses `TranslocoTestingModule.forRoot({ langs: { en, pl } })`.

# E2E tests (Playwright)
- Run by hand: `npm run e2e` (build + mock-ups + Playwright), `npm run verify -- --e2e`, or the manual `E2E` workflow in GitHub Actions.
- They run in Chromium (desktop + Pixel emulation) and WebKit (iPhone emulation).
- **No real camera in CI:**
- Locally, Playwright starts its own servers; set `PW_REUSE_SERVER=1` to reuse ones you started yourself (a leftover
  server from another worktree would serve its build).
  - Chromium runs with `--use-fake-ui-for-media-stream` and `--use-fake-device-for-media-stream`. For face tests, it also gets `--use-file-for-fake-video-capture=<synthetic.y4m>`.
  - Most flows inject signals directly through a **test-only signal source**: in development and test builds, the `SWITCH` adapter and a `window.__blinkerTest.emit('LONG_BLINK')` hook. The hook is compiled out of production builds, and a test checks that it is absent in the production build.
- Accessibility: `new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze()` must return no violations (https://playwright.dev/docs/accessibility-testing).
- For each page, also check the 390 px portrait viewport and the landscape viewport.
- A screen that must fit without scrolling is also checked with a wider font (`html { font-family: Verdana, sans-serif }`),
  because the CI font (DejaVu Sans on Linux) is wider than the one on Windows ([learning](../knowledge/layout-fits-with-a-wider-font.md)).

# Manual testing on real devices
- Required from stage 3: Android Chrome and iPhone Safari, in the stand, hand-held and tablet setups. Record the results as a `type: Learning` concept with `stale_after`.
