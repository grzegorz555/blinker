// Validator for board files (spec 006, R1, R2). Imported boards are untrusted input (docs/conventions/security.md):
// the size is checked before parsing, the bytes must be UTF-8 text, every field is checked by type, length and
// allowed values, unknown fields and prototype keys are rejected, every text is scanned for markup and for control
// and invisible characters, and the result is a fresh object with known fields only. Errors are data
// ({ path, code }) so the UI can show them in text (SC 3.3.1).
//
// Why not a JSON Schema library: Ajv compiles schemas with `new Function`, which our CSP (no 'unsafe-eval') and
// Trusted Types block. https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
import { BOARD_ACTIONS, BOARD_LIMITS, type Board, type BoardAction, type Cell } from './board';

export type BoardErrorCode =
  /** The file name does not end with .json (checked by the service, before the file is read). */
  | 'not-json-file'
  | 'too-large'
  /** The bytes are not UTF-8 text: a binary file, or another encoding (UTF-16). */
  | 'not-text'
  | 'not-json'
  | 'not-object'
  | 'unknown-field'
  | 'forbidden-key'
  | 'missing'
  | 'wrong-type'
  | 'schema-version'
  | 'invalid-id'
  | 'invalid-locale'
  | 'empty'
  | 'too-long'
  | 'too-few'
  | 'too-many'
  | 'row-length'
  | 'unknown-cell-type'
  | 'unknown-action'
  /** A text with markup (< or >), or a control or invisible character. */
  | 'unsafe-text'
  /** An import with the id of his built-in board (spec 007, R10). */
  | 'reserved-id';

export interface BoardError {
  /** Where the problem is, as a JSON path: "cells[3][0].value". */
  readonly path: string;
  readonly code: BoardErrorCode;
  /** The limit that was crossed, when there is one (a length, a count). */
  readonly limit?: number;
}

export type BoardResult =
  | { readonly ok: true; readonly board: Board }
  | { readonly ok: false; readonly errors: readonly BoardError[] };

const TOP_FIELDS = ['schemaVersion', 'id', 'name', 'locale', 'columns', 'rows', 'cells'] as const;
const CELL_FIELDS = ['type', 'value'] as const;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const ID = /^[a-z0-9-]+$/;
// A pragmatic BCP 47 check: a 2–3 letter language, then optional subtags ("pl", "pl-PL", "sr-Latn").
const LOCALE = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

/**
 * What no board text may hold. The UI shows values with text bindings, so markup would never run; this is a second
 * layer, and it keeps out what a person cannot see but the screen and the voice would still get:
 * - `<` and `>`: no markup and no script tag, whatever a later change does with the text;
 * - control characters (Cc: NUL, escape, line breaks), also when written as \u0000 escapes;
 * - invisible and direction-changing characters (soft hyphen, zero-width space, the bidi marks, embeddings and
 *   isolates that make a text read differently from what it holds, the BOM, tag characters);
 * - private-use characters and lone surrogates.
 * The zero-width joiner and non-joiner stay allowed: emoji and several scripts need them.
 * https://unicode.org/reports/tr36/ (Unicode security considerations), https://trojansource.codes/
 */
const UNSAFE_TEXT =
  /[<>\p{Cc}\p{Co}\p{Cs}\u00AD\u061C\u200B\u200E\u200F\u2028-\u202E\u2060-\u206F\uFEFF\u{E0000}-\u{E007F}]/u;

/** Length in characters as people count them (code points after NFC), so "Ż" is 1 however it was typed. */
const length = (text: string) => [...text.normalize('NFC')].length;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Validates the bytes of a board file: the size, then a strict UTF-8 decode (a binary file or another encoding is
 * refused instead of being read with replacement characters; a leading BOM is dropped), then the text. Never throws.
 */
export function validateBoardBytes(bytes: Uint8Array): BoardResult {
  if (bytes.length > BOARD_LIMITS.bytes) {
    return { ok: false, errors: [{ path: '', code: 'too-large', limit: BOARD_LIMITS.bytes }] };
  }
  let content: string;
  try {
    content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return { ok: false, errors: [{ path: '', code: 'not-text' }] };
  }
  return validateBoard(content);
}

/** Validates the text of a board file. Never throws. */
export function validateBoard(text: string): BoardResult {
  if (new TextEncoder().encode(text).length > BOARD_LIMITS.bytes) {
    return { ok: false, errors: [{ path: '', code: 'too-large', limit: BOARD_LIMITS.bytes }] };
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, errors: [{ path: '', code: 'not-json' }] };
  }
  return validateBoardData(data);
}

/** Validates already parsed data (for a built-in board, or a test). Never throws. */
export function validateBoardData(data: unknown): BoardResult {
  const errors: BoardError[] = [];
  const fail = (path: string, code: BoardErrorCode, limit?: number) => {
    if (errors.length < BOARD_LIMITS.maxErrors) {
      errors.push(limit === undefined ? { path, code } : { path, code, limit });
    }
  };

  if (!isObject(data)) return { ok: false, errors: [{ path: '', code: 'not-object' }] };
  checkKeys(data, TOP_FIELDS, '', fail);

  if (!('schemaVersion' in data)) fail('schemaVersion', 'missing');
  else if (data['schemaVersion'] !== 1) fail('schemaVersion', 'schema-version');

  const id = text(data, 'id', BOARD_LIMITS.idLength, fail);
  if (id !== undefined && !ID.test(id)) fail('id', 'invalid-id');
  const name = text(data, 'name', BOARD_LIMITS.nameLength, fail);
  const locale = text(data, 'locale', 35, fail);
  if (locale !== undefined && !LOCALE.test(locale)) fail('locale', 'invalid-locale');

  const columns = labels(data, 'columns', fail);
  const rows = labels(data, 'rows', fail);
  const cells = grid(data, columns?.length, rows?.length, fail);

  if (errors.length || !id || !name || !locale || !columns || !rows || !cells) {
    return { ok: false, errors: errors.length ? errors : [{ path: '', code: 'missing' }] };
  }
  return { ok: true, board: { schemaVersion: 1, id, name, locale, columns, rows, cells } };
}

type Fail = (path: string, code: BoardErrorCode, limit?: number) => void;

/** Rejects prototype keys and fields the format does not know. */
function checkKeys(
  obj: Record<string, unknown>,
  known: readonly string[],
  path: string,
  fail: Fail,
) {
  for (const key of Object.keys(obj)) {
    const at = path ? `${path}.${key}` : key;
    if (FORBIDDEN_KEYS.has(key)) fail(at, 'forbidden-key');
    else if (!known.includes(key)) fail(at, 'unknown-field');
  }
}

/** A required, non-empty string field, trimmed and NFC-normalized. */
function text(obj: Record<string, unknown>, key: string, max: number, fail: Fail) {
  if (!(key in obj)) return void fail(key, 'missing');
  const value = obj[key];
  if (typeof value !== 'string') return void fail(key, 'wrong-type');
  const clean = value.trim().normalize('NFC');
  if (!clean) return void fail(key, 'empty');
  if (length(clean) > max) return void fail(key, 'too-long', max);
  if (UNSAFE_TEXT.test(clean)) return void fail(key, 'unsafe-text');
  return clean;
}

/** Column or row labels: 1–10 short strings. */
function labels(obj: Record<string, unknown>, key: 'columns' | 'rows', fail: Fail) {
  if (!(key in obj)) return void fail(key, 'missing');
  const list = obj[key];
  if (!Array.isArray(list)) return void fail(key, 'wrong-type');
  if (list.length < BOARD_LIMITS.minSize) return void fail(key, 'too-few', BOARD_LIMITS.minSize);
  if (list.length > BOARD_LIMITS.maxSize) return void fail(key, 'too-many', BOARD_LIMITS.maxSize);
  const out: string[] = [];
  list.forEach((label: unknown, i) => {
    const at = `${key}[${i}]`;
    if (typeof label !== 'string') return fail(at, 'wrong-type');
    const clean = label.trim().normalize('NFC');
    if (!clean) return fail(at, 'empty');
    if (length(clean) > BOARD_LIMITS.labelLength)
      return fail(at, 'too-long', BOARD_LIMITS.labelLength);
    if (UNSAFE_TEXT.test(clean)) return fail(at, 'unsafe-text');
    out.push(clean);
  });
  return out.length === list.length ? out : undefined;
}

/** cells[row][column]: one row per row label, one cell per column label. */
function grid(
  obj: Record<string, unknown>,
  width: number | undefined,
  height: number | undefined,
  fail: Fail,
) {
  if (!('cells' in obj)) return void fail('cells', 'missing');
  const rows = obj['cells'];
  if (!Array.isArray(rows)) return void fail('cells', 'wrong-type');
  if (height !== undefined && rows.length !== height) fail('cells', 'row-length', height);
  const out: (Cell | null)[][] = [];
  let valid = true;
  rows.slice(0, BOARD_LIMITS.maxSize).forEach((row: unknown, r) => {
    const at = `cells[${r}]`;
    if (!Array.isArray(row)) {
      valid = false;
      return fail(at, 'wrong-type');
    }
    if (width !== undefined && row.length !== width) {
      valid = false;
      fail(at, 'row-length', width);
    }
    out.push(
      row.slice(0, BOARD_LIMITS.maxSize).map((value: unknown, c) => {
        const result = cell(value, `${at}[${c}]`, fail);
        if (result === undefined) valid = false;
        return result ?? null;
      }),
    );
  });
  return valid && (height === undefined || rows.length === height) ? out : undefined;
}

/** One cell: null, or exactly { type, value } with a valid value for its type; undefined when invalid. */
function cell(value: unknown, path: string, fail: Fail): Cell | null | undefined {
  if (value === null) return null;
  if (!isObject(value)) return void fail(path, 'wrong-type');
  checkKeys(value, CELL_FIELDS, path, fail);
  const { type, value: content } = value;
  if (typeof content !== 'string') return void fail(`${path}.value`, 'wrong-type');
  const clean = content.trim().normalize('NFC');
  if (!clean) return void fail(`${path}.value`, 'empty');
  if (UNSAFE_TEXT.test(clean)) return void fail(`${path}.value`, 'unsafe-text');
  switch (type) {
    case 'char':
      if (length(clean) > BOARD_LIMITS.charLength) {
        return void fail(`${path}.value`, 'too-long', BOARD_LIMITS.charLength);
      }
      return { type, value: clean };
    case 'word':
      if (length(clean) > BOARD_LIMITS.wordLength) {
        return void fail(`${path}.value`, 'too-long', BOARD_LIMITS.wordLength);
      }
      return { type, value: clean };
    case 'action':
      if (!(BOARD_ACTIONS as readonly string[]).includes(clean)) {
        return void fail(`${path}.value`, 'unknown-action');
      }
      return { type, value: clean as BoardAction };
    default:
      return void fail(`${path}.type`, 'unknown-cell-type');
  }
}
