---
type: Convention
title: Testing conventions
description: Every task ships with Vitest unit tests and Playwright + axe e2e tests; how to test camera-driven features without a camera.
tags: [convention, testing]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-10
---

# Definition of done
A task is done only when **in the same commit** as the code there are:
1. **Unit tests (Vitest)** for every rule in the spec. Pure logic (state machines, the signal detector, the board validator, the input mapping) aims for **100% branch coverage**.
2. **E2E tests (Playwright)** for every user-visible path the task touches, each with an **axe-core scan** that allows zero violations.
3. Green gates: `ng lint`, `ng test`, `ng build`, `npx playwright test`.

# Unit tests (Vitest)
- Test names say what happens: `describe('ScanStateMachine')` → `it('returns to column scanning after undo in row scanning')`.
- Use the Arrange / Act / Assert layout, with one reason to fail per test.
- **Time is injected**: never call `Date.now()` or `setTimeout` directly in the logic. Inject a clock and use `vi.useFakeTimers()`.
- Signal detection is tested with **recorded or synthetic frame sequences** (arrays of blendshape values with timestamps) stored as fixtures in `src/web/src/testing/fixtures/`. Fixtures are synthetic, or anonymized numbers only: never images.
- Components are tested through TestBed by their user-visible behavior (text, roles, clicks). Transloco uses `TranslocoTestingModule.forRoot({ langs: { en, pl } })`.

# E2E tests (Playwright)
- They run in Chromium (desktop + Pixel emulation) and WebKit (iPhone emulation).
- **No real camera in CI:**
  - Chromium runs with `--use-fake-ui-for-media-stream` and `--use-fake-device-for-media-stream`. For face tests, it also gets `--use-file-for-fake-video-capture=<synthetic.y4m>`.
  - Most flows inject signals directly through a **test-only signal source**: in development and test builds, the `SWITCH` adapter and a `window.__blinkerTest.emit('LONG_BLINK')` hook. The hook is compiled out of production builds, and a test checks that it is absent in the production build.
- Accessibility: `new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze()` must return no violations (https://playwright.dev/docs/accessibility-testing).
- For each page, also check the 390 px portrait viewport and the landscape viewport.
- A screen that must fit without scrolling is also checked with a wider font (`html { font-family: Verdana, sans-serif }`),
  because the CI font (DejaVu Sans on Linux) is wider than the one on Windows ([learning](../knowledge/layout-fits-with-a-wider-font.md)).

# Manual testing on real devices
- Required from stage 3: Android Chrome and iPhone Safari, in the stand, hand-held and tablet setups. Record the results as a `type: Learning` concept with `stale_after`.
