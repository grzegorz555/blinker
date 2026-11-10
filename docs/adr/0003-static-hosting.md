---
type: Decision
title: "ADR-0003: Azure Static Web Apps (Free) with security headers"
description: Host the PWA on Azure Static Web Apps Free, which supports custom response headers and a preview environment per PR; Cloudflare Pages was the alternative.
tags: [adr, hosting, security]
status: stable
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-10
verified:
  - by: human:grzegorz555
    at: 2026-11-10
---

# ADR-0003: Azure Static Web Apps (Free) with security headers

- Status: Accepted (the author chose option 1 on 2026-11-10)
- Date: 2026-11-10

## Context
The app is a static build, and camera access requires HTTPS. The security baseline requires response headers:
CSP, Permissions-Policy and HSTS. The repository is private, and everything must be free.

## Decision criteria
1. The host can set custom response headers.
2. It is free for a private repo.
3. Each PR gets a preview deployment.
4. The author already knows it, and lock-in is low: any static host would work, so moving later is easy.

## Considered options
1. **Azure Static Web Apps, Free plan.**
   - Headers are set in `staticwebapp.config.json`.
   - Preview environment for each PR, custom domain, free TLS.
   - Deploys from GitHub Actions.
   - The author already knows Azure.
2. **Cloudflare Pages, Free plan.**
   - Headers are set in a `_headers` file.
   - Preview deployments and a fast CDN; no Azure account needed.
3. **GitHub Pages.**
   - Needs a paid plan for private repos.
   - **Can't set custom headers.** Rejected.

## Decision
**Option 1: Azure Static Web Apps, Free plan.**
- Deployment runs from GitHub Actions. Its deployment token is stored as a GitHub Actions secret, never in the repo.
- Headers are set in `staticwebapp.config.json`, using the set defined in `docs/conventions/security.md`.
- Implemented in spec 003.

## Consequences
- The author creates the Static Web App resource once in the Azure portal and adds the deployment token as a repository secret. The AI never handles the token.
- The headers are tested on the preview environment: an e2e check reads them.
- Free plan limits: 100 GB of bandwidth per month and 3 preview environments at a time. That is plenty for one user.

## Revisit when
- The free-tier limits are reached.
- The app needs a backend: the Free plan only supports managed Functions, which would need a new ADR.

## Learning resources
- Azure Static Web Apps overview: https://learn.microsoft.com/azure/static-web-apps/overview
- Configuration (headers, routes, navigation fallback): https://learn.microsoft.com/azure/static-web-apps/configuration
- Preview environments: https://learn.microsoft.com/azure/static-web-apps/preview-environments
- Plans and quotas: https://learn.microsoft.com/azure/static-web-apps/plans
