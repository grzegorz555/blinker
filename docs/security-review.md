---
type: Review
title: Security pass before the first real use (ASVS 5.0 level 1, chapter level)
description: What was checked in the code against the ASVS chapters named in the security conventions, what passed, what was not checked, and the open findings to decide with the author.
tags: [security, privacy, review]
status: draft
generated:
  by: agent:claude-fable-5-2
  at: 2026-11-16
---

# Scope and method

The [security conventions](conventions/security.md) ask for a pass through the ASVS chapters that apply to a static
SPA without a backend, before the first real use. This is that pass, at **chapter level**: each chapter was checked
by reading the code and the configuration and by searching for the risky patterns. It is not a line-by-line audit
against every numbered ASVS requirement.

State of the code: `main` at `e7f1d26` plus the stricter board import (PR #30).

# Result by chapter

| Chapter | What was checked | Result |
|---|---|---|
| V1 Encoding and Sanitization | A search of `src/web/src` for `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `bypassSecurityTrust*`, `eval`, `new Function`, `document.write`, bound `href`/`src`: none in app code. Board values, sentences and error paths go through text bindings. Board files: only `.json`, strict UTF-8, every field validated, every text scanned ([board format](board-format.md)). | Pass |
| V3 Web Frontend Security | `src/web/public/staticwebapp.config.json`: CSP with `script-src 'self' 'wasm-unsafe-eval'`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, Trusted Types; `nosniff`; `Referrer-Policy: no-referrer`; COOP; a Permissions-Policy that allows only the camera. No cookies, no `window.open`, no `target="_blank"`, no cross-window `postMessage` (only the page and its own face worker). | Pass |
| V12 Secure Communication | HSTS for two years with subdomains; the host serves HTTPS only (ADR-0003). The app makes no request to another origin (`connect-src 'self'`; the face worker refuses cross-origin `fetch`, ADR-0006). | Pass (the host's TLS settings were not measured) |
| V13 Configuration | Production build without source maps (`angular.json`); the `dist/` check for `.md`, `.map`, `.local*`, `.claude` runs in `npm run verify`; no secrets in the app. | Pass |
| V14 Data Protection | Everything stays on the device in `localStorage`: settings, boards, his signal profile (numbers), the sentence history, the language. The history is capped (500 sentences, 30 days), can be deleted and can be turned off. Camera frames are never stored. The clipboard is written only by "Kopiuj wyniki" (Copy the results), with numbers and the browser name. | Pass, with findings F1 and F2 |
| V15 Secure Coding and Architecture | Every stored value is validated when read back (`readStored` with a validator per key; the language against the supported list); prototype keys rejected in board files; the lockfile, `npm audit`, OSV-Scanner, CodeQL, pinned Actions. | Pass |

# Open findings (to decide with the author)

- **F1 (low, V14): no way to erase everything from the device in one step.** Sentences can be deleted and imported
  boards removed one by one, but the UI has no action that removes his signal profile, the settings and the rest
  together (`ProfileService.reset()` exists and no screen calls it). It matters when Blinker runs on a borrowed or
  a caregiver's phone. Proposal: "Usuń wszystkie dane z tego urządzenia" (Delete all data from this device) in
  Ustawienia (Settings), after a confirmation. Planned in spec [013](specs/013-delete-all-data/spec.md).
- **F2 (low, privacy): the camera stays open while the app is in the background.** The stream stops when he leaves
  the page that uses it, not when the tab or the app is hidden. Proposal: stop on `visibilitychange` (hidden) and
  start again on return. To decide with him in mind: starting again takes a moment before signals count. Planned
  in spec [014](specs/014-camera-in-background/spec.md).

# Not checked here

- The response headers and TLS of the **live** deployment (the header e2e test for the deployed site covers the
  headers in CD; nothing was measured by hand in this pass).
- `/security-review` on the whole codebase: that tool reviews the pending changes of a branch, so it runs per PR.
- The numbered ASVS requirements one by one.

# References

- OWASP ASVS https://owasp.org/www-project-application-security-verification-standard/
- Angular security guide https://angular.dev/best-practices/security
- Page Visibility API https://developer.mozilla.org/docs/Web/API/Page_Visibility_API
