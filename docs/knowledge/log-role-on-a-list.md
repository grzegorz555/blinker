---
type: Learning
title: A live role on a list element removes the list; put it on a wrapper
description: role="log" on an <ol> replaces the list role, so its <li> items have no list parent and axe reports "listitem". Wrap the list in a <div role="log"> instead.
tags: [accessibility, aria]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-15
---

# Context

Diagnostyka (Diagnostics) lists the detected signals and should announce new ones politely. `role="log"` on the `<ol>`
made axe fail on every device: "listitem: <li> elements must be contained in a <ul> or <ol>".

# Lesson

An explicit `role` replaces the element's own role; an `<ol role="log">` is a log, not a list, and its items lose their
parent.

# How to apply

- Put live-region roles (`log`, `status`) on a wrapper `<div>` around the list.
- Docs: https://www.w3.org/TR/wai-aria-1.2/#log, https://dequeuniversity.com/rules/axe/4.10/listitem
