---
type: Convention
title: Accessibility conventions (WCAG 2.2 AA)
description: WCAG 2.2 AA rules for the caregiver UI plus AAC-specific rules for the person communicating with the app.
tags: [convention, accessibility, wcag]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-10
---

Target: **WCAG 2.2 AA** for every screen (https://www.w3.org/TR/WCAG22/, quick reference: https://www.w3.org/WAI/WCAG22/quickref/).
Accessibility is part of "done". Angular guide: https://angular.dev/best-practices/a11y.

# Two audiences
1. **The person communicating:** he sees the board and the sentence, and controls the app only with face signals.
2. **The caregiver and other people:** they set things up (calibration, boards, settings) by touch, keyboard or a screen reader.

# Rules for the communicating person (AAC)
- The board and the sentence use **large text** (at least 32 px for cells, configurable) and **high contrast** (at least 7:1, which is the AAA level, because of the distance and viewing angle).
- The scanning highlight never relies on color alone: it adds a thick outline (at least 4 px) plus a size or weight change. It is visible in light, dark and high-contrast modes.
- The scanning pace, the blink duration and the counting pause are **user settings** (SC 2.2.1 Timing Adjustable).
- Every state is shown in text ("Columns", "Column 3: rows", "Paused") and can optionally be spoken aloud.
- No flashing content (SC 2.3.1). Highlight transitions respect `prefers-reduced-motion`.

# Rules for the caregiver UI
- **Contrast:** text at least 4.5:1, large text and non-text elements at least 3:1 (SC 1.4.3, 1.4.11). Check light and dark mode.
- **Reflow and zoom:** reflow at 320 px and zoom to 200% without horizontal scroll (SC 1.4.4, 1.4.10). Use `rem`.
- **Keyboard:** everything works with a keyboard in a logical order, with no traps (SC 2.1.1, 2.1.2, 2.4.3).
- **Focus:** visible focus that is never hidden (SC 2.4.7, 2.4.11), using `focus-visible:ring-2`.
- **Touch targets:** at least 24×24 px (SC 2.5.8). Main actions get 44×44 px.
- **Single-key shortcuts:** Space acts as "switch" only while the communication screen is active, and can be turned off in settings (SC 2.1.4).
- **Camera:** explain it before the permission prompt. Show a visible indicator when the camera is on and a button to stop it.
- **Labels:** icon-only buttons get an `aria-label`; decorative icons get `aria-hidden="true"`.
- **Language:** `lang` on `<html>` follows the UI language (SC 3.1.1). Each route has a translated title (SC 2.4.2).
- **Status messages:** use `aria-live="polite"` (SC 4.1.3); a new letter is announced politely.
- **Forms:** visible labels, errors shown in text and linked with `aria-describedby` (SC 3.3.1, 3.3.2).
- **Native elements first.** spartan brain primitives provide the ARIA patterns.

# How we check
- Automated: ESLint template accessibility rules (`@angular-eslint/template/accessibility`) and **axe-core in every Playwright e2e test**, with zero violations allowed.
- Manual, for new screens:
  - a keyboard-only pass;
  - Lighthouse;
  - 200% zoom;
  - device mode at 360 px;
  - TalkBack (Android) or VoiceOver (iOS), plus NVDA on Windows.
- Automated tools catch only part of the problems, so the manual pass is required.

# Resources
- WCAG 2.2: https://www.w3.org/TR/WCAG22/ · ARIA patterns: https://www.w3.org/WAI/ARIA/apg/
- axe-core with Playwright: https://playwright.dev/docs/accessibility-testing
