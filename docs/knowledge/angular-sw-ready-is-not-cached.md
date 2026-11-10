---
type: Learning
title: An active Angular service worker is not yet a cached app
description: navigator.serviceWorker.ready resolves before ngsw has filled its caches; offline checks must wait for the cached index.html.
tags: [pwa, service-worker, testing, offline]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-10
stale_after: 2027-11-10
---

# Context
The offline e2e test (spec 001, T6) went offline right after `navigator.serviceWorker.ready`, and the reload returned
504 from the service worker. The `ngsw/state` debug page showed an empty task queue and only the `ngsw:/:db:control` cache.

# Lesson
The Angular service worker (`@angular/service-worker` 22) initializes and prefetches its `app` asset group
**asynchronously after activation**. Until the `…:assets:app:cache` cache contains `/index.html`, an offline navigation
fails. The `/ngsw/state` URL is a quick way to inspect the driver
(https://angular.dev/ecosystem/service-workers/devops#debugging-the-angular-service-worker).

# How to apply
- In tests, poll Cache Storage for `/index.html` in the `:assets:app:cache` cache before going offline (see `e2e/pwa.e2e.ts`).
- In the UI (later), show "ready for offline use" only after the same condition, not after registration.
- Everything the app needs offline (translations, later the MediaPipe model and wasm files) belongs in a `prefetch` asset group.
