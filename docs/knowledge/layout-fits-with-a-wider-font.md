---
type: Learning
title: A layout that fits "to the pixel" breaks on another system font; test it with a wider font
description: The CI runs on Linux (DejaVu Sans, wider than Segoe UI), so text wraps to more lines there; a no-overflow test that passes on Windows can fail in CI.
tags: [testing, e2e, layout, css]
status: stable
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-13
verified:
  - by: human:Grzegorz Roczniak
    at: 2026-11-13
---

# Context
In spec 004 (T4) Liczenie (Counting) fitted a 360×740 phone on Windows, and every e2e layout check passed locally. In CI
the hints wrapped to one more line, the question card grew, and the board overlapped the question and the
sentence in four states. The same thing had happened before with a navigation label at 320 px (polish round 1).
A probe also showed a hidden 4 px error in the board height formula: within the test's tolerance on Windows, past
it in CI.

# Lesson
Fonts differ per system (Segoe UI on Windows, Roboto on Android, San Francisco on iOS, DejaVu Sans on the Linux CI),
and so does the text width. A screen that must fit without scrolling needs a margin, not a pixel-perfect fit, and a
check with a wider font than the one on the developer's machine.

# How to apply
- For every "fits the viewport" e2e check, add the same check with
  `page.addStyleTag({ content: 'html { font-family: Verdana, sans-serif !important; }' })` (Verdana is wide on
  Windows and macOS); see `e2e/design/communicate-states.e2e.ts`.
- When a layout is tight, measure the spare space per state (`container height - content height`) instead of
  trusting "the test passed".
- Prefer giving the space to the board: drop secondary text on small screens, keep status lines to one line with an
  ellipsis when the full text is visible elsewhere.
