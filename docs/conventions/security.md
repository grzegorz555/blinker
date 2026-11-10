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
- **Text-to-speech:** some browser voices are **network voices** (for example Google voices in Chrome), and the text is sent to the vendor. By default we use only voices with `SpeechSynthesisVoice.localService === true` (https://developer.mozilla.org/docs/Web/API/SpeechSynthesisVoice/localService). Network voices can be turned on only in settings, with a clear warning.
- No analytics, no error reporting service, no third-party fonts, scripts or CDNs. `connect-src 'self'` enforces this.
- **A third person's health data:** the user's disability is special-category data (GDPR/RODO art. 9).
  - **Never commit** the user's name, photos, face videos or real conversation logs.
  - Recordings used to tune detection live only in `.local/` (git-ignored), and only with his consent.
  - Docs refer to him only as "the user" or "the friend".

# Response headers (set by the host, see ADR-0003)
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:;
  connect-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline';
  font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none';
  require-trusted-types-for 'script'; trusted-types angular angular#bundler
Permissions-Policy: camera=(self), microphone=(), geolocation=(), usb=(), payment=()
Strict-Transport-Security: max-age=63072000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Cross-Origin-Opener-Policy: same-origin
```
`'wasm-unsafe-eval'` is required by MediaPipe wasm. `style-src 'unsafe-inline'` is kept until stage 1 checks
whether Angular's critical CSS inlining can be replaced with a nonce. Any change to this list needs an ADR.

# Untrusted input: board files
- Validate against the JSON Schema before use: reject unknown keys, limit the file size (64 KB) and string lengths.
- Render values only through Angular text bindings. **Never** use `innerHTML`, `bypassSecurityTrust*`, `eval`, `new Function` or dynamic `import()` of user data.
- Parse with `JSON.parse` inside `try`, show a translated error, and keep the previous board.

# Build output
- Production builds have **no source maps** and contain **no `.md`, `.local*` or `.claude` files**. A CI step checks `dist/` (stage 1).
- Agent instructions (`CLAUDE.md`, `docs/`, `.claude/`) live in the private repo and are never deployed.

# Secrets
The app has no secrets. If one ever appears (for example a deploy token), it lives only in GitHub Actions secrets.
Agents never read `.env*`, the credential manager or `git credential` output.

# Supply chain
- Commit `package-lock.json` and install with `npm ci`.
- New dependencies must be maintained and widely used, with a permissive license. Bigger ones need an ADR.
- `npm audit --audit-level=high` runs in CI. Dependabot covers npm and GitHub Actions.
- GitHub Actions are pinned to a full commit SHA and use minimal `permissions:` (default `contents: read`).
- gitleaks scans for committed secrets in CI.
- MCP servers in `.mcp.json` are pinned to exact versions.

# How we check
- The `code-reviewer` agent checks the points above for every change.
- An e2e test reads the response headers on the preview deploy.
- Before the first real use: a pass through the ASVS chapters listed above, plus `/security-review`.
