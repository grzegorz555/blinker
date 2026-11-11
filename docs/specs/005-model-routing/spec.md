---
type: Spec
title: "005: Model routing and a faster pre-push"
description: Each loop step runs on a fixed model chosen for its difficulty, /plan labels every task haiku, sonnet or opus, and /work routes by that label; the pre-push hook runs only the fast gates.
tags: [tooling, ai-workflow, ci, cost]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-11
---

# Goal
Spend as few tokens as possible without lowering quality where it matters. Decided by the author on 2026-11-11:
- the model follows the **loop step** and a **difficulty label** that `/plan` gives each task once;
- the pre-push hook runs only the fast gates, because CI checks everything on every PR.

The number 005 is used because 003 (deploy) and 004 (mock-ups) are already reserved in the specs index.

# Scope
- **`npm run verify -- --quick`**: docs, Prettier, ESLint, unit and script tests (about 20–30 s). The pre-push hook
  runs it. Audit, build, e2e and Lighthouse are left to CI.
- **Models per step**, set in the skill and agent frontmatter (`model`, `effort`):

  | Step | Where it runs | Model | Effort | Why |
  |---|---|---|---|---|
  | `/plan` | main session | `opus` | `high` | Runs once per spec, and a weak plan costs more later. |
  | `/work` | main session | `sonnet` | `medium` | Most tasks. It runs inline, so it keeps the context and doesn't re-read everything. |
  | `/work` on a task labeled `opus` | `implementer` agent | `opus` | `high` | Hard tasks only. |
  | `/work` on a task labeled `haiku` | `implementer` agent | `haiku` | `low` | Mechanical tasks, with a short self-contained brief. |
  | `/review` | `code-reviewer` agent | `haiku` | `medium` | A checklist review in a fresh context. |
  | `/compound` | main session | `haiku` | `low` | Writing summaries. It must see the conversation, so it runs inline. |
  | `/new-adr` | main session | `sonnet` | `medium` | Filling a template. |
- **Difficulty labels in `tasks.md`**: every task starts with `**T1 [sonnet]: …**`. `/plan` picks the label using the
  criteria in `docs/conventions/ai-workflow.md`.
- **A config test** (`node --test`): every skill and agent sets a valid `model`, and every task in specs 005+ has a label.

# Rules
- R1: `verify --quick` runs only the five fast gates and lists the others as "skipped (--quick; CI runs it)".
  `--quick` together with `--lighthouse` is an error.
- R2: The pre-push hook runs `npm run verify -- --quick`. Agents still never bypass it.
- R3: Every skill in `.claude/skills/` and every agent in `.claude/agents/` sets `model` to one of `haiku`, `sonnet`,
  `opus` or `inherit`, and sets `effort` to one of `low`, `medium`, `high`, `xhigh` or `max`.
- R4: Every task line in the `tasks.md` of spec 005 and later carries one label: `[haiku]`, `[sonnet]` or `[opus]`.
  Specs 001–004 are exempt (they were planned before the labels).
- R5: Escalation: if a `[haiku]` or `[sonnet]` task fails its gates twice, `/work` stops and proposes moving the
  task up one level. It never switches silently.
- R6: A skill's `model` applies only to the current turn and is not saved
  ([Skills](https://code.claude.com/docs/en/skills)). The author's `/model` choice for the session stays untouched.

# Security and privacy notes
No change: the agents keep their tool lists, and project permissions are unchanged.

# Acceptance criteria
- [ ] `npm run verify -- --quick` passes in under a minute and prints the skipped gates.
- [ ] The pre-push hook runs the quick gates.
- [ ] The config test passes, and fails when a skill loses its `model` (checked by hand, not committed).
- [ ] `/plan`, `/work`, `/review` and `/compound` describe the routing, and `ai-workflow.md` lists the labeling criteria.

# Test plan
- **Script tests (`node --test`):** gate selection (`planGates`): default, `--lighthouse`, `--quick`, the rejected
  combination; the config check: valid frontmatter, a missing or unknown model, a task without a label, an exempt
  older spec, and the real repository.
- **No app code changes**, so the unit and e2e suites stay as they are (CI).

# Out of scope
Automatic classification of free-form requests (a dispatcher skill). Measuring the actual token use; we will look at
`/cost` after a few tasks and adjust the table.

# References (verified 2026-11-11)
- Claude Code: [Skills (frontmatter `model`, `effort`, `context: fork`)](https://code.claude.com/docs/en/skills) · [Subagents (`model`, `effort`, cost)](https://code.claude.com/docs/en/sub-agents) · [Model configuration](https://code.claude.com/docs/en/model-config) · [Hooks](https://code.claude.com/docs/en/hooks)
- Git: [githooks (pre-push)](https://git-scm.com/docs/githooks#_pre_push)
- Node.js: [Test runner](https://nodejs.org/api/test.html)
