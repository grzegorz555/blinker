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
- **Merging needs green CI.** The repo is public since 2026-11-15 (the author's choice), so `main` is protected:
  - required status checks: Web (npm run verify), Lighthouse (accessibility = 100), Docs (OKF bundle), Secret scan
    (gitleaks), Vulnerability scan (OSV-Scanner); a branch does not have to be rebased on the newest `main` first;
  - no force-push and no deletion of `main`; the author (admin) can still merge by hand;
  - a versioned **pre-push hook** (`.githooks/pre-push`, spec 002) still runs the fast gates (`npm run verify -- --quick`)
    before anything leaves the machine. Agents never bypass it with `--no-verify`;
  - agents never merge. The author merges, by hand or with GitHub's "Enable auto-merge" (rebase) on a PR, which then
    merges by itself once every required check is green.
- Repository settings (applied):
  - head branches are deleted on merge;
  - only squash and rebase merges are allowed (linear history);
  - auto-merge is allowed (used only when the author turns it on for a PR);
  - Dependabot alerts and security updates, secret scanning with push protection, and CodeQL
    (`.github/workflows/codeql.yml`, results under Security > Code scanning).
- **Stacked PRs** (one built on another): merge from the bottom up. After a rebase merge the next branch must be rebased
  on `main` (its old commits have new hashes), otherwise GitHub shows no CI for it
  (`docs/knowledge/rebased-branch-is-not-merged-for-git.md`).
- The repo is public: every tracked file is published. No personal data of him (`scripts/privacy.test.mjs` checks
  it); the Polish copies and summaries stay git-ignored.
- Make small, logical commits. **Commit only after the author has reviewed the uncommitted changes in the IDE**; push and open PRs only when the author asks.
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
- Before pushing, rebase on `origin/main`. After a sibling PR is merged, check the open ones
  (`gh pr view N --json mergeable`) and rebase those that conflict.

# The log in batches (author, 2026-11-25)
- **Task PRs don't touch `docs/log.md`.** Every PR prepended its entry at the top of the same file, so with
  several PRs open, the second one always conflicted once the first was merged (#55, #58, #59).
- The PR description is the record until then. After a series of merges, one small `docs(log): …` PR adds an
  entry for each merged PR (newest on top, with the PR numbers). One file in one PR cannot conflict with itself.
- Other shared files (README, `docs/index.md`, the indexes) still change in the PR that needs them; when two open
  PRs touch the same lines, the second is rebased.
