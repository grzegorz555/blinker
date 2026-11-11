---
type: Task List
title: "005: Model routing and a faster pre-push tasks"
description: Three tasks, one commit each.
tags: [tooling, ai-workflow]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-11
---

Branch: `chore/005-model-routing` (from `feat/002-ci-verify`) · Gates: `npm run verify -- --quick`, full gates in CI.

- [ ] **T1 [sonnet]: Quick verify for the pre-push hook.** `planGates` in `verify.mjs` with `--quick` (R1), the hook (R2), and git.md, README, CLAUDE.md. Tests: `verify.test.mjs`.
  *To understand:* why a local hook and CI have different jobs.
- [ ] **T2 [sonnet]: Models per step and task labels.** `model`/`effort` in every skill and agent (R3, R6), the `implementer` agent, the routing in `/work` (R5), labels in `/plan`, the review agent on Haiku, the criteria in `ai-workflow.md`, and `scripts/check-claude-config.mjs` (R3, R4). Tests: `check-claude-config.test.mjs`.
  *To understand:* skill vs. subagent, inline vs. fresh context, what a model choice costs.
- [ ] **T3 [haiku]: Docs and compound.** Specs index, log, the Polish copies, and the summary.
  *To understand:* the compound step.
