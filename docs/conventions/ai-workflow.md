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
| 2. Work | `/work` | Implements **one** task from `tasks.md` on the feature branch, with unit and e2e tests in the same commit. Runs all gates and commits locally with `[gen]`. | **The author reviews the diff.** |
| 3. Review | `/review` | The `code-reviewer` agent works in a fresh context against the spec, conventions and ADRs. Blocking findings go back to step 2. | The author decides which findings to apply. |
| 4. Compound | `/compound` | Writes the Polish learning summary in `.local/summaries/`. Captures new learnings as `type: Learning` concepts in `docs/knowledge/`. Proposes updates to `CLAUDE.md`, conventions or skills when a mistake could repeat. Updates `docs/log.md` and the indexes. | **The author approves the learnings.** Only then does the AI add `verified: [{by: "human:Grzegorz Roczniak", at: …}]`. |

After step 4: `/clear`, then the next task.

# Learning summaries (for the author, Polish, not in git)
Every step ends with `.local/summaries/YYYY-MM-DD-NN-topic.md` (template: `.local/summaries/_TEMPLATE.md`). It covers:
- what was done and why;
- which files changed;
- each new tool or concept, explained from scratch with an official doc link;
- **how to check it yourself** (commands, URLs, expected result);
- 2–3 quiz questions.

# Repo tooling
- Skills (`.claude/skills/`): `/plan`, `/work`, `/review`, `/compound`, `/new-adr`.
- Agents (`.claude/agents/`): `code-reviewer`.
- MCP (`.mcp.json`, pinned versions): `angular-cli` (Angular docs and best practices) and `spartan-ui`.

# Rules of thumb
- One task per session. Keep the context small: `CLAUDE.md` is short, and the details stay in `docs/`, loaded through the indexes.
- Use Explore subagents for broad code searches.
- When a learning contradicts a convention, propose a change to the convention instead of silently diverging.
- The AI never pushes, opens PRs, merges or changes ADR decisions without the author's explicit request.
