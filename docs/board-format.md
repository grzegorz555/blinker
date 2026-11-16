---
type: Board Format
title: Letter board JSON format, version 1
description: The swappable board file (spec 006) - its shape, the rules the validator enforces on imported files, his board as the default, and a JSON Schema that documents the format for people.
tags: [product, boards, format]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-13
---

# Shape

```json
{
  "schemaVersion": 1,
  "id": "friend-pl",
  "name": "Tablica przyjaciela",
  "locale": "pl",
  "columns": ["1", "2", "3", "4", "5", "6", "7"],
  "rows": ["1", "2", "3", "4", "5"],
  "cells": [
    [{ "type": "char", "value": "A" }, { "type": "char", "value": "B" }, "…"],
    [{ "type": "char", "value": "SZ" }, null, "…"]
  ]
}
```

# Rules

- Cells are addressed as `cells[row][column]`. Counting goes column first, then row; scanning (after the PoC) uses
  the same order. `columns` and `rows` are the labels printed above and to the left of the board.
- A cell is `null` (empty: nothing is shown, and choosing it is rejected) or exactly `{ "type", "value" }`:
  - `char`: 1–2 characters, a letter or a digraph that sits in one cell on the paper board (`SZ`, `CZ`);
  - `word`: 1–20 characters, appended with a trailing space;
  - `action`: one of `space | delete | speak | clear | undo`, so he can do everything with blinks alone on a day
    when head signals are unreliable.
- 1–10 columns and 1–10 rows; every row has exactly one cell per column.
- `id`: lowercase letters, digits and `-`, at most 40; `name`: at most 60 characters; `locale`: a BCP 47 tag
  (`pl`, `pl-PL`), applied as `lang` on the board container. Lengths count characters after NFC normalization, so
  `Ż` is one character however it was typed.
- His board is [`src/web/public/boards/friend-pl.json`](../src/web/public/boards/friend-pl.json), the
  [paper board](boards/friend-board.md) copied 1:1; `scripts/friend-board.test.mjs` checks every cell.

# Imported files are untrusted input

`src/web/src/app/core/boards/validate-board.ts` ([security conventions](conventions/security.md)):

- only a file whose name ends with `.json` (checked in code before the file is read; the picker's `accept` is only
  a hint);
- at most 64 KB, counted in bytes **before** parsing;
- the bytes must be UTF-8 text (a strict decode; a leading BOM is fine): a binary file or UTF-16 is rejected;
- `JSON.parse` inside `try`; anything that is not an object is rejected;
- every text (`name`, the labels, cell values) is scanned: `<` and `>`, control characters, invisible and
  direction-changing characters (zero-width space, bidi overrides and isolates, soft hyphen, tag characters),
  private-use characters and lone surrogates are rejected with `unsafe-text`, also when written as `\u` escapes.
  The zero-width joiner and non-joiner stay allowed (emoji, several scripts);
- every field checked by type, length and allowed values; **unknown fields** and the keys `__proto__`,
  `constructor` and `prototype` are rejected;
- the result is a fresh object with the known fields only;
- errors are data, `{ path, code, limit? }` (for example `{ "path": "cells[3][0].value", "code": "too-long",
  "limit": 2 }`), so the UI shows them in text next to the file field (SC 3.3.1); at most 50;
- values are plain text: the UI renders them with text bindings, never as HTML.

**Why our own validator and not a JSON Schema library:** Ajv, the common one, compiles a schema into code with
`new Function`, which our CSP (no `'unsafe-eval'`) and Trusted Types block
([Ajv standalone code](https://ajv.js.org/standalone.html) would avoid it, at the cost of a build step and a
dependency). The schema below documents the format for people who write boards by hand.

# JSON Schema (documentation)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Blinker board v1",
  "type": "object",
  "additionalProperties": false,
  "required": ["schemaVersion", "id", "name", "locale", "columns", "rows", "cells"],
  "properties": {
    "schemaVersion": { "const": 1 },
    "id": { "type": "string", "pattern": "^[a-z0-9-]{1,40}$" },
    "name": { "type": "string", "minLength": 1, "maxLength": 60 },
    "locale": { "type": "string", "pattern": "^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$" },
    "columns": { "$ref": "#/$defs/labels" },
    "rows": { "$ref": "#/$defs/labels" },
    "cells": {
      "type": "array",
      "minItems": 1,
      "maxItems": 10,
      "items": {
        "type": "array",
        "minItems": 1,
        "maxItems": 10,
        "items": { "oneOf": [{ "type": "null" }, { "$ref": "#/$defs/cell" }] }
      }
    }
  },
  "$defs": {
    "labels": {
      "type": "array",
      "minItems": 1,
      "maxItems": 10,
      "items": { "type": "string", "minLength": 1, "maxLength": 3 }
    },
    "cell": {
      "type": "object",
      "additionalProperties": false,
      "required": ["type", "value"],
      "oneOf": [
        { "properties": { "type": { "const": "char" }, "value": { "type": "string", "minLength": 1, "maxLength": 2 } } },
        { "properties": { "type": { "const": "word" }, "value": { "type": "string", "minLength": 1, "maxLength": 20 } } },
        {
          "properties": {
            "type": { "const": "action" },
            "value": { "enum": ["space", "delete", "speak", "clear", "undo"] }
          }
        }
      ]
    }
  }
}
```

The schema cannot say that every row has one cell per column, that `cells` has one row per row label, or that
lengths count characters after NFC, or which characters a text may not hold; the validator checks those too.

# References

- OWASP Input Validation Cheat Sheet https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- JSON Schema 2020-12 https://json-schema.org/draft/2020-12
- Unicode normalization (NFC) https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String/normalize
- OWASP File Upload Cheat Sheet https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- TextDecoder `fatal` https://developer.mozilla.org/docs/Web/API/TextDecoder/TextDecoder
- Unicode Security Considerations (TR36) https://unicode.org/reports/tr36/ · Trojan Source https://trojansource.codes/
