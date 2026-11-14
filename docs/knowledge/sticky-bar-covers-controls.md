---
type: Learning
title: Content that scrolls under a sticky bar counts as covered; let only main scroll
description: axe target-size (SC 2.5.8) reports a control under a sticky navigation bar as obscured; an app shell exactly the viewport high, with main as the only scroll area, avoids it for good.
tags: [accessibility, layout, testing]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-14
---

# Context
Spec 007 put the navigation bar at the bottom with `position: sticky`, and the page scrolled under it. On the Pixel
project axe failed `target-size` on Tablice (Boards): the file input sat behind the bar when the page loaded
("partially obscured, 348 × 19 px"). On the full-height Liczenie (Counting) the visible skip link pushed the page down
and the bar covered the signal buttons the same way.

# Lesson
A control that is covered right now is covered for axe, even if scrolling would reveal it (and for a person, SC 2.4.11
Focus Not Obscured). Fixing each test (a taller viewport, scrolling first) only hides it.

# How to apply
- The shell is exactly the viewport high (`height: 100dvh`), the bars sit in their grid rows, and only `<main>`
  scrolls (`overflow-y: auto`), so nothing ever slides under a bar.
- A control revealed on focus (the skip link) covers only text, never another control, and never changes the height
  of a full-height page.
- Fit tests on a full-height page also check that `<main>` itself does not need to scroll.
