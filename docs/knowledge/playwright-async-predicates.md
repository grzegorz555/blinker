---
type: Learning
title: Use expect.poll, not waitForFunction, for async browser checks in Playwright
description: page.waitForFunction with an async predicate resolves immediately, because the returned Promise is truthy.
tags: [testing, e2e, playwright]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-10
---

# Context
In spec 001 (T6), the offline test waited for the service worker cache with `page.waitForFunction(async () => …)`.
The wait passed instantly while the cache was still empty, and the test then failed in a confusing way: the page
was blank after the offline reload.

# Lesson
`waitForFunction` checks whether the predicate's return value is truthy. An `async` function returns a Promise,
which is always truthy. Use `expect.poll(() => page.evaluate(async () => …)).toBe(true)` instead
(https://playwright.dev/docs/test-assertions#expectpoll).

# How to apply
Any e2e wait that needs `await` inside the browser (Cache Storage, IndexedDB, `navigator.serviceWorker.ready`,
`speechSynthesis.getVoices()`) uses `expect.poll` around `page.evaluate`.
