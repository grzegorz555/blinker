---
type: Learning
title: Regexes written through `node -e` template strings lose their backslashes
description: When an agent edits files with `node -e` and the new text contains backslashes (regexes, Windows paths).
tags: [tooling, ai-workflow]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-11
---

# Context
In spec 002 a regex `/<button\b[^>]*\blang=…/` was inserted with `node -e` inside a JavaScript template literal.
The template turned `\b` into a backspace character (U+0008), so the regex silently never matched and the
Lighthouse language guard failed with "marker not found". It showed up only in a byte dump (`od -c`).

# Lesson
In a JS string or template literal, `\b`, `\n`, `\t` and so on are escape sequences. Text with backslashes doesn't
survive a `node -e` edit unless it is written with `String.raw` or escaped twice.

# How to apply
- For new files, or for text containing backslashes, use the Write/Edit tools (CLAUDE.md already says so for
  multi-line files).
- If `node -e` is unavoidable, use ``String.raw`…` `` for the inserted text, and run the tests right after the edit.
