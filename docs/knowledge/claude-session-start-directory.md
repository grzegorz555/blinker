---
type: Learning
title: Start Claude Code in the repo root, or project agents and skills are not loaded
description: A session started in C:\Repozytorium\Blinker (the parent folder) didn't see .claude/agents/code-reviewer.md from blinker/.
tags: [ai-workflow, claude-code, tooling]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-10
stale_after: 2027-05-10
---

# Context
During spec 001, the session was started in `C:\Repozytorium\Blinker`, the parent of the repo. The `/review` step
failed with "Agent type 'code-reviewer' not found". Skills from `blinker/.claude/skills` did appear, but only as
directory-scoped skills.

# Lesson
Claude Code loads project agents, settings and `CLAUDE.md` from the directory the session starts in
(https://code.claude.com/docs/en/sub-agents).

# How to apply
- Start sessions in `C:\Repozytorium\Blinker\blinker`, or in a worktree root.
- Until then, `/review` can run a general-purpose agent and tell it to read `.claude/agents/code-reviewer.md` first.
