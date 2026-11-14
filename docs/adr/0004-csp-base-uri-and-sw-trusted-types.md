---
type: Decision
title: "ADR-0004: CSP base-uri 'self' and a Trusted Types default policy for the service worker"
description: The production CSP blocked Angular's <base href> and the service worker registration; we allow base-uri 'self' and add a default Trusted Types policy that accepts only /ngsw-worker.js.
tags: [adr, security, csp, pwa]
status: stable
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-11
verified:
  - by: human:Grzegorz Roczniak
    at: 2026-11-11
---

# ADR-0004: CSP base-uri 'self' and a Trusted Types default policy for the service worker

- Status: Accepted (the author chose option 1 on 2026-11-11)
- Date: 2026-11-11

## Context
Spec 003 serves the production headers to every e2e run. The CSP from `docs/conventions/security.md` then blocked
two things the app needs, in Chromium and WebKit alike:
1. `base-uri 'none'` blocks Angular's `<base href="/">`. On a deep link such as `/settings/voice`, relative bundle
   URLs would resolve under `/settings/` and the app would not load.
2. `require-trusted-types-for 'script'` blocks `navigator.serviceWorker.register('ngsw-worker.js')`, because
   `@angular/service-worker` passes a plain string, not a `TrustedScriptURL`. Without the service worker the app
   does not work offline. Angular core only creates the `angular` and `angular#unsafe-bypass` policies.

## Decision criteria
1. Keep the XSS protection: no inline script, no string-to-code sinks.
2. Offline must work (the friend's phone may have no signal).
3. The smallest change to the header list.

## Considered options
1. **Narrow exceptions.** `base-uri 'self'` and a Trusted Types `default` policy that accepts exactly the
   same-origin `/ngsw-worker.js` for `createScriptURL` and rejects everything else. The policy defines no
   `createHTML` or `createScript`, so those sinks stay blocked.
2. **Drop Trusted Types.** `base-uri 'self'` and no `require-trusted-types-for`. Simpler, but loses the second layer
   against DOM XSS.

## Decision
**Option 1.** `base-uri 'self'` still stops an injected `<base>` that points elsewhere, which is what the directive
protects against (OWASP CSP cheat sheet). The `default` policy is installed in `main.ts` before Angular boots and is
as strict as no policy for every value except the one worker URL.

Header changes: `base-uri 'none'` → `base-uri 'self'`; `trusted-types angular angular#bundler` →
`trusted-types angular angular#bundler default`.

## Consequences
- Offline works under the production CSP; e2e checks it on every run.
- A unit test proves the policy rejects every other URL and has no HTML or script factory.
- Any new code that hands a string to a Trusted Types sink fails loudly instead of working silently.

## Amendment (2026-11-15, spec 010, ADR-0006)
The `default` policy also accepts a web worker file of our build: same origin, path `/worker-<hash>.js` at the root,
no query and no fragment (`new Worker(new URL(...))` of the face worker). Every other URL is still refused; the unit
test lists the rejected cases.

## Revisit when
- `@angular/service-worker` registers with a `TrustedScriptURL` itself: remove the `default` policy.
- Angular no longer needs `<base href>`.

## Learning resources
- MDN Trusted Types, the default policy: https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API
- MDN `base-uri`: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/base-uri
- OWASP CSP Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html
- Angular security (Trusted Types): https://angular.dev/best-practices/security
