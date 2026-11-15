---
type: Learning
title: With reuseExistingServer, e2e tests may run against another worktree's build
description: Playwright reuses whatever answers on the e2e port; an e2e server left over from another worktree served an older build, and the new tests failed for no visible reason. Locally the server is now reused only on request.
tags: [testing, playwright, worktrees]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-15
---

# Context

Specs 011 and 012 were built in parallel worktrees. A stopped e2e run in one worktree left its `serve-dist.mjs`
(port 4300) running. The next run in the other worktree found the port answering and, with
`reuseExistingServer: !CI`, tested that server: the old build without the new camera status. The tests failed with
"element not found" although the new build was correct.

# Lesson

`reuseExistingServer` trusts the port, not the folder. Parallel worktrees share ports, so a leftover server silently
serves the wrong `dist/`.

# How to apply

- `playwright.config.ts` reuses a running server only with `PW_REUSE_SERVER=1`; by default it starts its own and fails
  loudly if the port is taken.
- When e2e fails in a way the code can't explain, check who listens on 4300 and 4310
  (`Get-NetTCPConnection -LocalPort 4300`), and stop servers your own stopped runs left behind.
- Docs: https://playwright.dev/docs/test-webserver
