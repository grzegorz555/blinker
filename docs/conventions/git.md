---
type: Convention
title: Git conventions
description: Branching, commits, worktrees (optional), push policy and local repo setup.
tags: [convention, git]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-10
---

- **Conventional Commits** (https://www.conventionalcommits.org): `feat(web): …`, `fix(web): …`, `docs(adr): …`, `test`, `refactor`, `chore`, `ci`. Scopes: `web`, `docs`, `adr`, `ci`, `boards`, `claude`.
- Commits written by the AI end with ` [gen]`, for example `feat(web): add scan state machine [gen]`.
- **Never work on `main`.** Branch names follow `<type>/<short-name>`; a spec number is optional (`feat/002-board-scanning`). Changes go into `main` through a PR with green CI. The author merges.
- **Stages → specs → PRs → commits:**
  - each stage from `docs/backlog.md` is split into one or more specs;
  - **each spec gets its own feature branch and its own PR** (`feat/003-scan-state-machine`);
  - inside the PR, **each task from `tasks.md` is one commit** (or a few logical ones), with its tests;
  - a PR never mixes stages or unrelated specs;
  - stage 0 is the exception: it has no spec, so it is a single branch, `chore/000-bootstrap`, with commits split by topic.
- **Merging needs green CI.** Branch protection and rulesets are not available for private repos on the free GitHub plan (the API returns 403), so we use a workaround that the author chose on 2026-11-10:
  - CI runs every gate on every PR;
  - a versioned **pre-push hook** (`.githooks/pre-push`, spec 002) runs the fast gates (`npm run verify -- --quick`: docs, Prettier, ESLint, unit and script tests, about 20–30 s) before anything leaves the machine. The full gates (audit, build, e2e, Lighthouse) are left to CI, which is the real check (decided by the author on 2026-11-11, spec 005). Agents never bypass the hook with `--no-verify`;
  - agents never merge, and the author merges only when every check is green.
- Repository settings (free tier, already applied):
  - head branches are deleted on merge;
  - only squash and rebase merges are allowed (linear history);
  - auto-merge is off;
  - Dependabot alerts and security updates are on.
- **When the repo becomes public or moves to GitHub Pro**, turn on:
  - a ruleset for `main`: PR required, required status checks (every CI job), no force-push, no deletion;
  - for a public repo, also CodeQL and secret scanning with push protection.

  Before making the repo public, re-check `docs/` for personal data.
- Make small, logical commits. **Commits stay local; push and open PRs only when the author asks.**
- Local repo setup (local config is not part of the repo, so repeat it after a fresh clone):
  ```
  git config --local user.name "Grzegorz Roczniak"
  git config --local user.email grzegorz555@users.noreply.github.com
  git config --local core.hooksPath .githooks   # or: cd src/web && npm run hooks:install
  ```
  `.githooks` holds the repo's own hooks (pre-push runs `npm run verify -- --quick`). Setting it locally also keeps the author's global work hooks out of this repo.

# One task per session (default)
- The author usually runs **one task per session**. Work on a branch in the main checkout `C:\Repozytorium\Blinker\blinker`, and `/clear` between tasks.
- Before committing, check `git branch --show-current` and `git status`. If something doesn't match the task, stop and ask.

# Worktrees (when working in parallel)
- One task = one worktree, in a short path:
  ```
  git worktree add C:/Repozytorium/Blinker/wt/<name> -b <type>/<name> origin/main
  cd C:/Repozytorium/Blinker/wt/<name>/src/web && npm ci
  ```
- A dev server in a second worktree uses a different port (`npx ng serve --port 4201`). Agents start dev servers only when the author asks.
- Remove a worktree (`git worktree remove`) only after its PR is merged, and with the author's consent.
