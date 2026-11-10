---
type: Decision
title: "ADR-0002: AI-written code via Compound Engineering, knowledge as an OKF bundle"
description: The AI writes code in staged Plan → Work → Review → Compound loops with human gates; docs and learnings follow OKF v0.2.
tags: [adr, process, ai]
status: stable
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-10
---

# ADR-0002: AI-written code via Compound Engineering, knowledge as an OKF bundle

- Status: Accepted (the author requested this during planning on 2026-11-10)
- Date: 2026-11-10

## Context
Unlike WordWise, the author wants the AI to write most of the code, while the author supervises every stage and
learns from it. Knowledge must survive between sessions (`/clear` after each task) and get better over time.

## Decision criteria
1. The author stays in control: nothing lands without approval.
2. Each task makes the next one easier.
3. Agents can find relevant context cheaply (small token cost).
4. The format is open and not tied to one AI vendor.

## Considered options
1. **Compound Engineering + OKF v0.2.** The loop puts human gates at plan, diff and learnings, and the learnings are written down as typed, verifiable markdown.
2. Spec-driven development only (as in WordWise): good specs, but there is no explicit step that turns mistakes into rules.
3. Free-form docs: no structure, so agents end up loading everything.

## Decision
- **Loop:** `/plan` → `/work` → `/review` → `/compound`, described in `docs/conventions/ai-workflow.md`.
- **Format:** `docs/` is an **OKF v0.2** bundle.
  - Every concept file has frontmatter with `type`.
  - The trust fields are used deliberately:
    - `generated` when an agent wrote the file;
    - `verified: [{by: "human:grzegorz555", at: …}]` only after the author approves it;
    - `status: draft | stable | deprecated`;
    - `stale_after` for facts that age (device measurements, library versions).
- Learnings go to `docs/knowledge/` as `type: Learning`.
- `AGENTS.md` points other agents to the same bundle.

## Consequences
- A CI check enforces OKF conformance (frontmatter with `type`, and `index.md` files list every concept).
- The extra docs step happens after every task, but it stays short (one learning is a few lines).

## Revisit when
- The bundle becomes noise (too many low-value learnings). Then prune or merge them, marking old ones `deprecated`.
- The OKF spec changes in an incompatible way.

## Learning resources
- OKF spec: https://github.com/GoogleCloudPlatform/open-knowledge-format
- Compound Engineering (Every): https://every.to/chain-of-thought/compound-engineering-how-every-codes-with-agents
- Claude Code best practices: https://code.claude.com/docs/en/best-practices
