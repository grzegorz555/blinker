---
type: Learning
title: After a rebase merge, git branch -d says the branch is not merged
description: GitHub's "Rebase and merge" writes new commits on main, so the local feature branch looks unmerged; compare the trees before deleting it.
tags: [tooling, git]
status: stable
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-14
verified:
  - by: human:Grzegorz Roczniak
    at: 2026-11-14
---

# Context
After PR #15 was merged, `git branch -d feat/006-counting-core` refused: "the branch is not fully merged". The PR
was merged with "Rebase and merge", which replays the commits on `main` with new hashes
([merge methods](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/about-merge-methods-on-github)),
so git cannot see that the branch commits are on `main`. A squash merge does the same.

# Lesson
"Not fully merged" after a rebase or squash merge is expected, not a sign of lost work. Prove it with the content,
not the hashes.

# How to apply
When cleaning up after a merged PR:
1. `git fetch --prune`, then `git pull --ff-only` on `main`.
2. `git diff --stat <branch> main` prints nothing: the trees are equal, so `git branch -D <branch>` is safe.
3. If it prints anything, stop and show it to the author: something on the branch did not reach `main`.
