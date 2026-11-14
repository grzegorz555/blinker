---
type: Learning
title: Check the Lighthouse report language by the recorded page text, not by one element
description: Lighthouse records different DOM nodes on every page; a guard that looks for one marker element breaks when the layout changes, so match the node labels against the translation files.
tags: [testing, ci, i18n]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-14
stale_after: 2027-11-14
---

# Context
The spec 002 guard proved that each Lighthouse run audited the expected language by finding the language switch
button (`lang` + `aria-pressed`) in the report snippets. Spec 007 T2 moved the switch to Ustawienia (Settings) and CI
failed: "language switch marker not found" on every page. Even on the settings page Lighthouse did not record the
button: it records only some nodes (the LCP element, DOM size, failing items), and which ones varies by page.
Locally the change passed, because `verify --quick` skips Lighthouse.

# Lesson
A guard that depends on one element of the layout breaks when the layout changes. Every report records the
`nodeLabel` (the text) of a few nodes, and the UI texts are known: they are the translation files.

# How to apply
- `scripts/lighthouse-lang.mjs` matches the recorded node labels against texts that differ between `en.json` and
  `pl.json` (at least 8 characters; a text with parameters by its fixed start): the expected language must appear and
  the other must not; no translated text at all fails loudly.
- After changing routes, page texts or the shell, run `npm run lighthouse` locally before pushing.
