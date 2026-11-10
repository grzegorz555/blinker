---
type: Decision
title: "ADR-0003: Static hosting with security headers (proposed)"
description: Host the PWA on a free static host that supports custom headers and PR previews; Azure Static Web Apps Free recommended, Cloudflare Pages as alternative.
tags: [adr, hosting, security]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-10
---

# ADR-0003: Static hosting with security headers

- Status: **Proposed**. The author decides in stage 1.
- Date: 2026-11-10

## Context
The app is a static build. Camera access requires HTTPS. The security baseline requires response headers
(CSP, Permissions-Policy, HSTS). The repository is private, and everything must be free.

## Decision criteria
1. Can set custom response headers.
2. Free for a private repo.
3. Preview deployment for each PR.
4. Familiar to the author, low lock-in (any static host works, so moving later is easy).

## Considered options
1. **Azure Static Web Apps, Free plan.**
   - Headers are set in `staticwebapp.config.json`.
   - Gives a preview environment for each PR, a custom domain and free TLS.
   - Deploys from GitHub Actions.
   - The author already knows Azure.
2. **Cloudflare Pages, Free plan.**
   - Headers are set in a `_headers` file.
   - Gives preview deployments and a fast CDN; no Azure account is needed.
3. **GitHub Pages.**
   - Requires a paid plan for private repos.
   - **Can't set custom headers.** Rejected.

## Decision
To be decided. Recommendation: option 1. Either way, the header set is defined once in `docs/conventions/security.md`.

## Consequences
- The headers are tested on the preview environment (an e2e check reads them).

## Revisit when
- Free-tier limits are reached (unlikely for a single user).

## Learning resources
- Azure Static Web Apps configuration: https://learn.microsoft.com/azure/static-web-apps/configuration
- Cloudflare Pages headers: https://developers.cloudflare.com/pages/configuration/headers/
