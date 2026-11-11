---
type: Learning
title: Page.getInstallabilityErrors returns an empty list even for a missing manifest; use Page.getAppManifest
description: When automating a PWA installability check in Playwright over the DevTools Protocol.
tags: [testing, pwa, playwright]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-11
stale_after: 2027-05-11
---

# Context
Spec 002 automated the installability check deferred from spec 001. The first version asked Chromium for
`Page.getInstallabilityErrors` over CDP. The positive test passed, but the negative test (a manifest without icons,
then a 404 manifest) also got an empty list in Playwright's Chromium 1254, both desktop and Pixel emulation. One early
green run of the negative test was a coincidence.

# Lesson
- `Page.getInstallabilityErrors` proved nothing in this Chromium. A check that cannot fail is not a check.
- `Page.getAppManifest` returns the manifest parser's errors and warnings, the same list DevTools shows in
  Application → Manifest. It reliably reported both a JSON syntax error and properties with wrong types
  (https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-getAppManifest).
- The install criteria fields themselves (name, start_url, display, 192/512 px icons) are best asserted directly on
  the manifest JSON (https://web.dev/articles/install-criteria).

# How to apply
- Every automated check gets a **negative test that proves it can fail** (as in `e2e/installability.e2e.ts`).
- Re-check `Page.getInstallabilityErrors` after a Playwright upgrade before relying on it.
