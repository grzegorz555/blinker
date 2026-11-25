---
type: Convention
title: AI workflow (Compound Engineering with human gates)
description: How the AI plans, writes, reviews and compounds knowledge in staged loops under the author's supervision; skills, agents, summaries.
tags: [convention, ai, process]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-10
---

Method: **Compound Engineering**: each unit of work should make the next one easier. The loop is Plan → Work →
Review → Compound, and 80% of the effort goes into planning and review (ADR-0002).

# The loop
| Step | Skill | What the AI does | Human gate |
|---|---|---|---|
| 1. Plan | `/plan` | Reads `docs/index.md`, the related ADRs and **the relevant `docs/knowledge/` learnings**. Asks at most 3–4 questions, then writes `docs/specs/NNN-slug/spec.md` (goal, scope, rules R1…Rn, acceptance criteria, test plan, out of scope) and `tasks.md` (small tasks, each with its tests). | **The author approves the spec and the tasks.** |
| 2. Work | `/work` | Implements **one** task from `tasks.md` on the feature branch, with unit tests in the same commit (e2e waits for the next e2e pass, `testing.md`). Runs the fast gates and leaves the changes uncommitted. | **The author reviews the diff in the IDE**; then one commit with `[gen]`. |
| 3. Review | `/review` | The `code-reviewer` agent works in a fresh context against the spec, conventions and ADRs. Blocking findings go back to step 2. | The author decides which findings to apply. |
| 4. Compound | `/compound` | Writes the Polish learning summary in `.local/summaries/`. Captures new learnings as `type: Learning` concepts in `docs/knowledge/`. Proposes updates to `CLAUDE.md`, conventions or skills when a mistake could repeat. Updates the indexes; the `docs/log.md` entry goes into the next batch `docs(log)` PR ([git](git.md)). | **The author approves the learnings.** Only then does the AI add `verified: [{by: "human:Grzegorz Roczniak", at: …}]`. |

After step 4: `/clear`, then the next task.

# Model routing (spec 005)
Goal: as few tokens as possible without lowering quality where it matters. Hooks can't choose a model; skills and
agents can (`model` and `effort` in their frontmatter, https://code.claude.com/docs/en/skills). A skill's model
applies only to the current turn, so the author's `/model` choice for the session stays.

| Step | Runs | Model | Effort |
|---|---|---|---|
| `/plan` | inline | opus | high |
| `/work`, task `[sonnet]` | inline | sonnet | medium |
| `/work`, task `[haiku]` | `implementer-haiku` agent | haiku | low |
| `/work`, task `[opus]` | `implementer-opus` agent | opus | high |
| `/review` | `code-reviewer` agent | haiku | medium |
| `/compound` | inline (it must see the conversation) | haiku | low |
| `/new-adr` | inline | sonnet | medium |

**Labels.** `/plan` gives every task one label, once:
- `[haiku]`: mechanical and local. Docs or text only, config values, renames, a few lines in one or two files with an
  obvious test. No new logic.
- `[sonnet]`: the default. A typical feature or fix with its unit and e2e tests, following existing patterns.
- `[opus]`: hard or risky. A new architecture or pattern; state machines, signal detection or calibration;
  security or privacy-sensitive code; changes across many modules; a bug whose cause is unknown; or a task that already
  failed twice at a lower level.

When in doubt, choose `[sonnet]`. Agents start with a fresh context and re-read files, so for small tasks an agent
can cost more than doing it inline; that is why `[sonnet]`, the most common label, runs inline.
A config test (`src/web/scripts/check-claude-config.test.mjs`) checks that every skill and agent sets a model and
effort, and that every task in specs 005 and later has a label.

# Learning summaries (for the author, Polish, not in git)
Every step ends with `.local/summaries/YYYY-MM-DD-NN-topic.md` (template: `.local/summaries/_TEMPLATE.md`). It covers:
- what was done and why;
- which files changed;
- each new tool or concept, explained from scratch with an official doc link;
- **how to check it yourself** (commands, URLs, expected result);
- 2–3 quiz questions.

# Repo tooling
- Skills (`.claude/skills/`): `/plan`, `/work`, `/review`, `/compound`, `/new-adr`.
- Agents (`.claude/agents/`): `code-reviewer`, `implementer-haiku`, `implementer-opus`.
- MCP (`.mcp.json`, pinned versions): `angular-cli` (Angular docs and best practices; Angular Material docs are at https://material.angular.dev).

# Rules of thumb
- One task per session. Keep the context small: `CLAUDE.md` is short, and the details stay in `docs/`, loaded through the indexes.
- Use Explore subagents for broad code searches.
- When a learning contradicts a convention, propose a change to the convention instead of silently diverging.
- The AI never pushes, opens PRs, merges or changes ADR decisions without the author's explicit request.
