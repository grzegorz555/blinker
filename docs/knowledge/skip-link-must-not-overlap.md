---
type: Learning
title: A visible skip link must not overlap other targets (SC 2.5.8)
description: An absolutely positioned skip link that covers the header link fails axe target-size on small screens; render it in the normal flow.
tags: [accessibility, wcag, layout]
status: stable
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-10
verified:
  - by: human:Grzegorz Roczniak
    at: 2026-11-10
---

# Context
In spec 001 (T4), the focused skip link was `position: absolute` in the top-left corner. On the Pixel 7 project, axe
reported `target-size (serious)`, because the link covered the "Blinker" home link in the header.

# Lesson
WCAG 2.2 SC 2.5.8 (Target Size, Minimum) also counts **overlapping** targets
(https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). Overlays that appear on focus count too.
axe catches this only when the overlay is visible, so the test must focus it first.

# How to apply
- Skip links and other focus-revealed controls appear in the normal flow and push content down, instead of covering it.
- E2E accessibility tests also scan **interactive states** (focused, open, expanded), not only the initial page.
