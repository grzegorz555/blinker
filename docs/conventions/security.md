---
type: Convention
title: Security and privacy conventions
description: Security baseline for a static, auth-less PWA that processes a face camera feed on the device; headers, untrusted input, privacy of a third person's health data, supply chain.
tags: [convention, security, privacy]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-10
---

# Baseline
- **OWASP ASVS 5.0 level 1** (https://owasp.org/www-project-application-security-verification-standard/), limited to the chapters that apply to a static SPA without a backend: V1 Encoding and Sanitization, V3 Web Frontend Security, V12 Secure Communication, V13 Configuration, V14 Data Protection, V15 Secure Coding and Architecture.
- Angular security guide: https://angular.dev/best-practices/security
- The stricter rule wins.

# Threat model (short)
There are no accounts, no server and no shared data. The main risks are:
1. **Leaking what the person says or what the camera sees** to third parties. This is the most important risk.
2. A **malicious board file** (imported from someone else) that tries to inject script.
3. A **supply-chain compromise** (npm packages, GitHub Actions).
4. **Wrong output** (a misread signal said aloud). This is a safety risk, covered in [interaction model](../interaction-model.md).

# Privacy (on the device only)
- Camera frames are processed in the browser, never uploaded, never stored, and never kept beyond the current frame. Calibration stores numbers (thresholds), not images.
- **The camera is open only while Blinker is visible** (spec 014). When the page is hidden (another app, another tab, a locked screen) every track is stopped at once and the browser's camera indicator goes off; when the page is visible again the camera starts by itself. A caregiver can also turn the camera off by hand on each screen that uses it (Liczenie (Counting), Kalibracja (Calibration), Diagnostyka (Diagnostics)); his signals cannot do that.
- **Text-to-speech:** some browser voices are **network voices** (for example Google voices in Chrome), and the text is sent to the vendor. By default we use only voices with `SpeechSynthesisVoice.localService === true` (https://developer.mozilla.org/docs/Web/API/SpeechSynthesisVoice/localService). Network voices can be turned on only in settings, with a clear warning.
- No analytics, no error reporting service, no third-party fonts, scripts or CDNs. `connect-src 'self'` enforces this.
- **A third person's health data:** the user's disability is special-category data (GDPR/RODO art. 9).
  - **Never commit** the user's name, photos, face videos or real conversation logs.
  - Recordings used to tune detection live only in `.local/` (git-ignored), and only with his consent.
  - Docs refer to him only as "the user" or "the friend".
  - The repository holds no personal data (GDPR): no names, contact details, ID numbers or health records of him,
    and no image metadata (EXIF can hold GPS). `scripts/privacy.test.mjs` checks every tracked file on each run (images
    without EXIF, XMP or GPS; no e-mail addresses but GitHub noreply ones; no PESEL or phone numbers).
- **One erase, one prefix (spec 013, closes F1 of the [security pass](../security-review.md)):** every key Blinker
  writes to the device starts with `blinker.` (`STORAGE_PREFIX`). "Usuń wszystkie dane" (Delete all data) in
  Ustawienia (Settings) asks first, resets every service to its defaults and removes every `blinker.` key. A new store
  must use the prefix and have a reset in `DeviceDataService.eraseAll()`; a unit test fills every store, erases, and
  fails when a `blinker.` key is left or a service is not at its defaults.

# Response headers (set by the host, see ADR-0003)
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:;
  connect-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline';
  font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none';
  require-trusted-types-for 'script'; trusted-types angular angular#bundler default
Permissions-Policy: camera=(self), microphone=(), geolocation=(), usb=(), payment=()
Strict-Transport-Security: max-age=63072000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Cross-Origin-Opener-Policy: same-origin
```
`'wasm-unsafe-eval'` is required by MediaPipe wasm. **MediaPipe sends usage metrics to Google** (`odml.pa.googleapis.com`); `connect-src 'self'` blocks them and the face worker also refuses every cross-origin `fetch` (ADR-0006); a library update must be checked for new network calls. `base-uri 'self'` and the `default` Trusted Types policy (only `/ngsw-worker.js`) are explained in ADR-0004. `style-src 'unsafe-inline'` stays: Angular adds component styles at runtime, and a static host can't issue a nonce.
Critical CSS inlining is off (`inlineCritical: false`), because it adds an inline script that `script-src 'self'` blocks. Any change to this list needs an ADR.
The headers are written only in `src/web/public/staticwebapp.config.json`; a unit test keeps it equal to this list, and
the local e2e server sends the same headers, so every e2e run fails on a CSP or Trusted Types violation (spec 003).

# Untrusted input: board files
- Take only a `.json` file: the name is checked in code, because the picker's `accept` is a hint a person can switch off. The MIME type is not checked: browsers derive it from the extension, and some phones leave it empty.
- Read the bytes with a strict UTF-8 decode (`TextDecoder` with `fatal: true`), so a binary file or another encoding is refused, not guessed.
- Validate against the JSON Schema before use: reject unknown keys, limit the file size (64 KB) and string lengths.
- Scan every text (name, labels, cell values): no `<` or `>`, no control characters, no invisible or direction-changing characters (zero-width space, bidi overrides and isolates, tag characters), no private-use characters or lone surrogates. Text bindings already stop markup from running; this is a second layer, and it keeps out what a person cannot see ([Unicode TR36](https://unicode.org/reports/tr36/), [Trojan Source](https://trojansource.codes/)).
- Render values only through Angular text bindings. **Never** use `innerHTML`, `bypassSecurityTrust*`, `eval`, `new Function` or dynamic `import()` of user data.
- Parse with `JSON.parse` inside `try`, show a translated error, and keep the previous board.

# Build output
- Production builds have **no source maps** and contain **no `.md`, `.local*` or `.claude` files**. A CI step checks `dist/` (stage 1).
- Agent instructions (`CLAUDE.md`, `docs/`, `.claude/`) live in the repository (public since 2026-11-15) and are never deployed.

# Secrets
The app has no secrets. The only secret is the Azure Static Web Apps deployment token, which can only upload files to
this one app; it lives only in GitHub Actions secrets (`AZURE_STATIC_WEB_APPS_API_TOKEN`), is never given to
Dependabot or fork PRs, and is reset in the portal if it ever leaks (spec 003).
Agents never read `.env*`, the credential manager or `git credential` output.

# Supply chain
- Commit `package-lock.json` and install with `npm ci`, which installs exactly what the lockfile says.
- Version ranges in `package.json`:
  - Angular packages (`@angular/*`) and the tools `ng new`/`ng update` manage (TypeScript, Vitest, jsdom, Prettier) keep the CLI-generated `^`/`~` ranges, so `ng update` can move them together.
  - Every other dependency is added with `--save-exact`.
- New dependencies must be maintained and widely used, with a permissive license. Bigger ones need an ADR.
- Known vulnerabilities, three layers:
  - `npm audit` in CI (`npm run verify`): any high or critical advisory, or any advisory in production dependencies, blocks.
  - OSV-Scanner in CI reads `package-lock.json` against OSV.dev, a second database that also merges NVD and other sources. Any finding blocks.
  - **Exceptions** (one list for both gates): only when no fixed version exists, only for a dev dependency, and only when the vulnerable path cannot be reached with outside input. Each goes into `src/web/osv-scanner.toml` with a reason and an `ignoreUntil` date; OSV-Scanner reads it with `--config`, and the all-dependencies `npm audit` gate reads it through `scripts/audit.mjs`. After the date both gates block again. The production audit (`npm audit --omit=dev`) has no exceptions.
  - Current exception: `picomatch` 4.0.7 (GHSA-fc5q-39xc-vjpf, a ReDoS through crafted glob patterns), until 2026-12-31. It comes only through Angular CLI, Vite and Vitest. Therefore: **do not add `picomatch` (or another glob matcher) as a direct dependency**, and never pass a glob pattern from outside (a board file, a URL, user input) to any tool. Drop the exception once a fixed picomatch reaches the lockfile.
  - Dependabot alerts and security updates are on: a vulnerable dependency opens a fix PR by itself.
  - When the fix is only in a newer version than the parent package allows, an npm `overrides` entry in `src/web/package.json` pins the patched version, if the full `npm run verify` passes. Current: `basic-ftp` 6.2.6 (GHSA-c475-qrg2-pj4r, via `@lhci/cli`), `minimatch` 11.0.8 (GHSA-g3hv-75wg-m249, via ESLint and Angular tooling). Drop an entry once the parent package ships the fix.
- Dependabot version updates cover npm (daily) and GitHub Actions (weekly). Majors of `@angular/*` and TypeScript are ignored, because they move together through `ng update`.
- Malicious packages (a hijacked maintainer account, typosquatting) are not in any vulnerability database yet when they are published. Socket.dev (a GitHub app the author installs) checks every dependency change in a PR for that.
- GitHub Actions are pinned to a full commit SHA and use minimal `permissions:` (default `contents: read`).
- gitleaks scans for committed secrets in CI.
- MCP servers in `.mcp.json` are pinned to exact versions.

# How we check
- The `code-reviewer` agent checks the points above for every change.
- The `deployed` e2e project reads the response headers (on `/`, a deep link and a 404), checks HTTPS and runs a smoke
  + axe test on every preview and production deploy (spec 003, R9).
- Before the first real use: a pass through the ASVS chapters listed above, plus `/security-review`. The chapter-level pass of 2026-11-16 is in [security-review.md](../security-review.md); its F1 is closed by spec 013 and its F2 by spec 014.
