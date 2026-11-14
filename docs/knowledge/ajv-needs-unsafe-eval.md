---
type: Learning
title: Ajv compiles schemas with new Function, which our CSP blocks
description: Before adding a validation or templating library, check whether it generates code at run time; a strict CSP without unsafe-eval and with Trusted Types rejects it.
tags: [security, csp, dependencies]
status: stable
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-14
verified:
  - by: human:Grzegorz Roczniak
    at: 2026-11-14
stale_after: 2027-11-14
---

# Context
Spec 006 needed to validate imported boards. The obvious choice, Ajv with the JSON Schema from
`docs/board-format.md`, turns every schema into JavaScript source and runs it with `new Function`. Its own docs say
that this needs `unsafe-eval` in the CSP, or schemas compiled ahead of time
([Ajv security](https://ajv.js.org/security.html), [standalone code](https://ajv.js.org/standalone.html)).
Our CSP has `script-src 'self' 'wasm-unsafe-eval'` and `require-trusted-types-for 'script'`, so it would fail in the
browser while the unit tests in Node pass.

# Lesson
A library that builds code at run time (schema validators, template engines, some expression parsers) works in
tests and breaks under our CSP. We wrote a small validator instead (`core/boards/validate-board.ts`): no dependency,
errors shaped for the UI, and the JSON Schema stays as documentation for people.

# How to apply
- Before adding a dependency, search its docs for "CSP", "eval" or "new Function".
- If a library needs it, prefer a build-time mode (Ajv standalone) or our own code; never add `unsafe-eval`.
- The e2e CSP guard (`e2e/csp.e2e.ts`) catches it only if the code path runs in the e2e test, so cover it there.
