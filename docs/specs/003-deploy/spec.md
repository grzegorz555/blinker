---
type: Spec
title: "003: Deploy to Azure Static Web Apps"
description: Security headers from one config file, served the same way by the local e2e server and by Azure; a preview deploy per PR with a remote header test; production deploy on main after every gate passes.
tags: [stage-1, deploy, security, ci]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-11
---

# Goal
The friend gets a real HTTPS address to open on the phone, and every change is checked on a live copy before it
reaches him. The security headers from [security conventions](../../conventions/security.md) are actually served,
and a CSP mistake breaks a test, not the production app.

# Scope
- **`src/web/staticwebapp.config.json`**: the response headers, the SPA fallback, cache rules and MIME types. Shipped
  in `dist/` (Angular `assets`).
- **One source of headers.** The local e2e server (`e2e/serve-dist.mjs`) reads the same file and sends the same
  headers, so every e2e run (local, pre-push in CI, all three device projects) runs under the production CSP.
- **CSP compliance of the build.** Today the production `index.html` has an inline `<script>` that Angular's critical
  CSS inlining (Beasties) adds to swap the stylesheet's `media`. `script-src 'self'` blocks it, so the app would lose
  its styles in production. We turn critical CSS inlining off. Trusted Types (`require-trusted-types-for 'script'`)
  is checked the same way.
- **Deploy jobs** in `.github/workflows/ci.yml` (so they can `need` the gate jobs) plus `.github/workflows/preview-close.yml`
  for closed PRs; `Azure/static-web-apps-deploy@v1` pinned to a SHA:
  - on every PR: build, upload `dist/` as a preview environment; the action comments the URL on the PR;
  - on PR close: remove the preview environment;
  - on push to `main`: deploy production only after every CI gate has passed.
- **Remote checks** after each deploy: a Playwright project `deployed` reads the headers and runs the smoke + axe
  tests against the deployed URL.
- **Author setup guide** (Polish, local): Azure account, the Static Web App resource, the token as a GitHub secret,
  a budget alert.

# Rules
- **R1. One header list.** `staticwebapp.config.json` `globalHeaders` is the only place the headers are written. It
  must equal the list in `docs/conventions/security.md` (a unit test compares them), so a change still needs an ADR.
- **R2. Same headers locally.** `serve-dist.mjs` sends the `globalHeaders` on every response, including the SPA
  fallback and 404, and the MIME types from `mimeTypes`.
- **R3. No CSP violation, ever.** Every e2e test fails if the page reports a `securitypolicyviolation` event or a
  console CSP/Trusted Types error. A negative test proves the guard works (an inline script injected on purpose is
  reported).
- **R4. No inline script in the build.** `check-dist` fails if `index.html` contains an inline `<script>` (one without
  `src`) or an inline event handler attribute (`on…=`).
- **R5. SPA fallback and caching.**
  - Navigation requests fall back to `/index.html`; files with an extension that don't exist return 404.
  - The 404 serves our static `404.html` (`responseOverrides`), with the global headers only. The first production
    deploy showed that Azure's built-in 404 page gets no `globalHeaders`.
  - `index.html`, `ngsw.json`, `ngsw-worker.js` and `manifest.webmanifest`: `Cache-Control: no-cache`, so a new
    version is picked up. Hashed files (`*-[A-Z0-9]{8}.js|css`): long-lived and `immutable`.
- **R6. The token stays a secret.** The deployment token is only a GitHub Actions secret
  (`AZURE_STATIC_WEB_APPS_API_TOKEN`), created by the author. The AI never reads, prints or handles it. Workflow
  `permissions:` are minimal (`contents: read`, plus `pull-requests: write` only on the preview job for the comment).
- **R7. Deploy is skipped cleanly, not failed,** when the secret is not available: before the author sets it up,
  and on Dependabot and fork PRs (they get no secrets). CI stays green in those cases and the summary says why.
- **R8. Production only after green gates.** The production job runs on `push` to `main` and `needs` every CI job
  (docs, secrets, vulnerabilities, web, lighthouse). The build that is tested is the build that is deployed (one
  artifact, no second build).
- **R9. Remote header test.** After a preview or production deploy, the `deployed` Playwright project checks every
  header from R1 on `/`, on a deep link and on a 404, plus HTTPS, and runs the smoke + axe test. A failure on a
  preview fails the PR.

# UI and accessibility notes
No UI change. Turning critical CSS inlining off can show the page a few milliseconds later on the very first visit;
after that the service worker serves everything from cache. Lighthouse accessibility must stay 100.

# Security and privacy notes
- Preview URLs on the Free plan are public to anyone who knows the random address; there is no password on Free. The
  app holds no data and sends nothing, so this is acceptable. Never put real conversations or the friend's details
  into a PR, since previews would serve them.
- Custom domains don't work on preview environments; production uses the default `*.azurestaticapps.net` address
  with free TLS. A custom domain can be added later without a code change.
- Pinned action SHA; Dependabot keeps it up to date.
- Free plan: if usage quotas are exceeded, Azure stops serving the site; it never bills. A budget alert in the
  Azure subscription is the second safety net.

# Acceptance criteria
- [ ] `staticwebapp.config.json` exists, is in `dist/`, and its headers equal `security.md` (unit test).
- [ ] Local e2e on all three projects runs with the production headers, and none reports a CSP or Trusted Types
      violation; the negative test proves the guard.
- [ ] `check-dist` rejects inline scripts and inline handlers; the production `index.html` has none.
- [ ] A PR gets a preview URL comment; the remote header + smoke + axe test passes on it; the preview disappears when
      the PR closes.
- [ ] A Dependabot PR and a run without the secret are green, with "deploy skipped" in the job summary.
- [ ] A push to `main` deploys production only after all CI jobs pass; the remote test passes on production.
- [ ] The production URL opens on the author's phone, installs, and works offline.
- [ ] Lighthouse accessibility stays 100 in en and pl.

# Test plan
- **Unit (`node --test`):**
  - headers in the config equal the `security.md` block (R1); a changed value is reported;
  - `serve-dist` header and MIME mapping, fallback vs. 404 for unknown files with an extension (R2, R5);
  - `check-dist`: an inline `<script>`, an `onload=` attribute, and a clean `index.html` (R4);
  - the cache rule patterns match `index.html`, `ngsw.json` and a hashed bundle (R5).
- **e2e, local (3 projects):** a shared fixture fails on any `securitypolicyviolation` (R3); negative test with an
  injected inline script; the existing smoke, i18n, offline and installability tests all pass under the CSP; a header
  test against the local server (R2).
- **e2e, remote (`deployed` project, Chromium only, `DEPLOY_URL`):** headers on `/`, a deep link and a 404; HTTPS;
  smoke + axe (R9).
- **CI behaviour (checked on the first PRs):** a preview from a normal PR; a skipped deploy on a Dependabot PR (R7).

# Out of scope
- A custom domain (later, no code change).
- `style-src 'unsafe-inline'` removal: Angular injects component styles at runtime and a static host can't issue a
  nonce. Stays as recorded in `security.md`.
- Monitoring and uptime alerts.
- Azure Functions or any backend (ADR-0003, "Revisit when").

# Author setup (done by the author once, before T4)
A step-by-step guide in Polish is in `docs/specs/003-deploy/setup.local.md`. In short: create an Azure free account,
create a Static Web App (Free plan, source "Other", region West Europe), copy its deployment token into the GitHub
repository secret `AZURE_STATIC_WEB_APPS_API_TOKEN`, and add a budget alert. The AI never sees the token.

# References
- Azure Static Web Apps configuration (globalHeaders, navigationFallback, mimeTypes):
  https://learn.microsoft.com/azure/static-web-apps/configuration
- Preview environments: https://learn.microsoft.com/azure/static-web-apps/preview-environments
- Build configuration (`skip_app_build`, `action: close`): https://learn.microsoft.com/azure/static-web-apps/build-configuration
- Deployment token management: https://learn.microsoft.com/azure/static-web-apps/deployment-token-management
- Plans and quotas: https://learn.microsoft.com/azure/static-web-apps/plans
- Azure budgets: https://learn.microsoft.com/azure/cost-management-billing/costs/tutorial-acm-create-budgets
- Angular security (CSP, Trusted Types): https://angular.dev/best-practices/security
- Angular workspace config (styles optimization, `inlineCritical`): https://angular.dev/reference/configs/workspace-config
- MDN CSP: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy
- MDN Trusted Types: https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API
- MDN `securitypolicyviolation`: https://developer.mozilla.org/en-US/docs/Web/API/Element/securitypolicyviolation_event
- OWASP HTTP Headers Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html
- OWASP Secure Headers Project: https://owasp.org/www-project-secure-headers/
- GitHub Actions secrets: https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets
- Dependabot PRs and secrets: https://docs.github.com/en/code-security/dependabot/troubleshooting-dependabot/troubleshooting-dependabot-on-github-actions
