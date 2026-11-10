---
type: Board Format
title: Letter board JSON format (draft)
description: Draft of the swappable board file; it is finalized in the stage-2 spec once the friend's real board is available.
tags: [product, boards, format]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-10
---

# Shape (draft)
```json
{
  "schemaVersion": 1,
  "id": "default-pl",
  "name": "Default Polish board",
  "locale": "pl",
  "columns": ["1", "2", "3", "4", "5", "6"],
  "rows": ["1", "2", "3", "4", "5"],
  "cells": [
    [{ "type": "char", "value": "A" }, { "type": "char", "value": "B" }],
    [{ "type": "action", "value": "space" }, { "type": "word", "value": "TAK" }]
  ]
}
```

# Rules
- Cells are addressed as `cells[row][column]`. Scanning goes column first, then row; counting uses the same order.
- Cell types:
  - `char`: a single character;
  - `word`: appended with a trailing space;
  - `action`: one of `space | delete | speak | clear | undo`.
- An empty cell is `null`. Scanning skips it.
- Imported files are **untrusted input**:
  - validated against a JSON Schema;
  - size-limited (for example 64 KB);
  - values are plain text with a length limit;
  - rendered as text, never as HTML.
- The friend's own board will be transcribed into this format in stage 2.
