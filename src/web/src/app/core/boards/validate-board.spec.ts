// Spec 006, T1: the board validator (R1, R2). Every invalid case returns { path, code } and never throws.
import friendBoard from '../../../../public/boards/friend-pl.json';
import { BOARD_LIMITS, cellAt } from './board';
import {
  validateBoard,
  validateBoardBytes,
  validateBoardData,
  type BoardError,
} from './validate-board';

const valid = () => JSON.parse(JSON.stringify(friendBoard)) as Record<string, unknown>;
const errorsOf = (data: unknown): readonly BoardError[] => {
  const result = validateBoardData(data);
  return result.ok ? [] : result.errors;
};
const codes = (data: unknown) => errorsOf(data).map((e) => `${e.path} ${e.code}`);

describe('his board (friend-pl.json)', () => {
  it('is a valid board v1 of 7 columns and 5 rows in Polish', () => {
    const result = validateBoardData(friendBoard);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.board.locale).toBe('pl');
    expect(result.board.columns).toHaveLength(7);
    expect(result.board.rows).toHaveLength(5);
  });

  it('has K at column 4 row 2, W at 7/3, SZ at 5/5, and the two empty cells at 7/4 and 7/5', () => {
    const result = validateBoardData(friendBoard);
    if (!result.ok) throw new Error('invalid');
    const at = (c: number, r: number) => cellAt(result.board, c, r)?.value ?? null;
    expect([at(4, 2), at(7, 3), at(5, 5), at(7, 4), at(7, 5)]).toEqual([
      'K',
      'W',
      'SZ',
      null,
      null,
    ]);
  });
});

describe('validateBoard: the file text', () => {
  it('accepts the board as text', () => {
    expect(validateBoard(JSON.stringify(friendBoard)).ok).toBe(true);
  });

  it('refuses a file over 64 KB before parsing it', () => {
    const result = validateBoard(' '.repeat(BOARD_LIMITS.bytes + 1));
    expect(result).toEqual({ ok: false, errors: [{ path: '', code: 'too-large', limit: 65536 }] });
  });

  it('counts bytes, not characters: Polish letters take two bytes', () => {
    const text = `"${'ż'.repeat(BOARD_LIMITS.bytes / 2)}"`;
    expect(validateBoard(text)).toMatchObject({ ok: false, errors: [{ code: 'too-large' }] });
  });

  it('reports text that is not JSON', () => {
    expect(validateBoard('{ "name": ')).toEqual({
      ok: false,
      errors: [{ path: '', code: 'not-json' }],
    });
  });

  it('reports JSON that is not an object', () => {
    for (const text of ['[]', 'null', '"board"', '42']) {
      expect(validateBoard(text), text).toEqual({
        ok: false,
        errors: [{ path: '', code: 'not-object' }],
      });
    }
  });
});

describe('validateBoardBytes: the bytes of the file', () => {
  const utf8 = (text: string) => new TextEncoder().encode(text);

  it('accepts UTF-8, with or without a BOM (Notepad on Windows adds one)', () => {
    const bytes = utf8(JSON.stringify(friendBoard));
    expect(validateBoardBytes(bytes).ok).toBe(true);
    expect(validateBoardBytes(new Uint8Array([0xef, 0xbb, 0xbf, ...bytes])).ok).toBe(true);
  });

  it('refuses bytes that are not UTF-8: a binary file, UTF-16, a cut character', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0xff, 0xff]);
    const utf16 = new Uint8Array([0xff, 0xfe, 0x7b, 0x00, 0x7d, 0x00]);
    const cut = utf8('{"name": "ż"}').slice(0, 11);
    for (const bytes of [png, exe, utf16, cut]) {
      expect(validateBoardBytes(bytes)).toEqual({
        ok: false,
        errors: [{ path: '', code: 'not-text' }],
      });
    }
  });

  it('refuses more than 64 KB before decoding', () => {
    const result = validateBoardBytes(new Uint8Array(BOARD_LIMITS.bytes + 1).fill(0xff));
    expect(result).toMatchObject({ ok: false, errors: [{ code: 'too-large' }] });
  });

  it('text that is UTF-8 but not JSON is not-json: a script, a page', () => {
    for (const text of ['alert(1)', '<script>alert(1)</script>', '<!doctype html><html></html>']) {
      expect(validateBoardBytes(utf8(text)), text).toEqual({
        ok: false,
        errors: [{ path: '', code: 'not-json' }],
      });
    }
  });
});

describe('validateBoardData: fields', () => {
  it('rejects unknown fields, at the top and in a cell', () => {
    const board = valid();
    board['script'] = 'x';
    (board['cells'] as Record<string, unknown>[][])[0][0]['onclick'] = 'x';
    expect(codes(board)).toEqual(['script unknown-field', 'cells[0][0].onclick unknown-field']);
  });

  it('rejects prototype keys, which JSON.parse keeps as own properties', () => {
    const board = validateBoard('{"__proto__": {"admin": true}, "constructor": 1}');
    expect(board.ok).toBe(false);
    if (board.ok) return;
    expect(board.errors.slice(0, 2)).toEqual([
      { path: '__proto__', code: 'forbidden-key' },
      { path: 'constructor', code: 'forbidden-key' },
    ]);
    expect(({} as Record<string, unknown>)['admin']).toBeUndefined();
  });

  it('requires schemaVersion 1', () => {
    const board = valid();
    board['schemaVersion'] = 2;
    expect(codes(board)).toEqual(['schemaVersion schema-version']);
    delete board['schemaVersion'];
    expect(codes(board)).toEqual(['schemaVersion missing']);
  });

  it('checks id, name and locale', () => {
    const board = valid();
    board['id'] = 'Moja Tablica';
    board['name'] = '   ';
    board['locale'] = 'polski';
    expect(codes(board)).toEqual(['id invalid-id', 'name empty', 'locale invalid-locale']);
    board['id'] = 'a'.repeat(41);
    board['name'] = 7;
    board['locale'] = 'pl-PL';
    expect(codes(board)).toEqual(['id too-long', 'name wrong-type']);
  });

  it('needs 1 to 10 columns and rows', () => {
    const none = valid();
    none['columns'] = [];
    expect(errorsOf(none)[0]).toEqual({ path: 'columns', code: 'too-few', limit: 1 });
    const eleven = valid();
    eleven['rows'] = Array.from({ length: 11 }, (_, i) => String(i + 1));
    expect(errorsOf(eleven)[0]).toEqual({ path: 'rows', code: 'too-many', limit: 10 });
  });

  it('needs one row of cells per row label, and one cell per column label', () => {
    const board = valid();
    (board['cells'] as unknown[][])[1].pop();
    expect(errorsOf(board)).toEqual([{ path: 'cells[1]', code: 'row-length', limit: 7 }]);
    const short = valid();
    (short['cells'] as unknown[][]).pop();
    expect(errorsOf(short)).toEqual([{ path: 'cells', code: 'row-length', limit: 5 }]);
  });
});

describe('validateBoardData: cells', () => {
  const withCell = (value: unknown) => {
    const board = valid();
    (board['cells'] as unknown[][])[0][0] = value;
    return board;
  };

  it('a char has at most 2 characters, counted after NFC: SZ is fine, "Ż" typed as Z + dot is 1', () => {
    expect(codes(withCell({ type: 'char', value: 'SZ' }))).toEqual([]);
    expect(codes(withCell({ type: 'char', value: 'Ż' }))).toEqual([]);
    expect(errorsOf(withCell({ type: 'char', value: 'SZC' }))).toEqual([
      { path: 'cells[0][0].value', code: 'too-long', limit: 2 },
    ]);
  });

  it('a word has at most 20 characters', () => {
    expect(codes(withCell({ type: 'word', value: 'DZIĘKUJĘ' }))).toEqual([]);
    expect(errorsOf(withCell({ type: 'word', value: 'A'.repeat(21) }))).toEqual([
      { path: 'cells[0][0].value', code: 'too-long', limit: 20 },
    ]);
  });

  it('an action is one of space, delete, speak, clear, undo', () => {
    for (const value of ['space', 'delete', 'speak', 'clear', 'undo']) {
      expect(codes(withCell({ type: 'action', value })), value).toEqual([]);
    }
    expect(codes(withCell({ type: 'action', value: 'format-disk' }))).toEqual([
      'cells[0][0].value unknown-action',
    ]);
  });

  it('rejects an unknown type, a value that is not text, and an empty value', () => {
    expect(codes(withCell({ type: 'image', value: 'x' }))).toEqual([
      'cells[0][0].type unknown-cell-type',
    ]);
    expect(codes(withCell({ type: 'char', value: 1 }))).toEqual(['cells[0][0].value wrong-type']);
    expect(codes(withCell({ type: 'char', value: ' ' }))).toEqual(['cells[0][0].value empty']);
    expect(codes(withCell('A'))).toEqual(['cells[0][0] wrong-type']);
  });

  it('rejects markup in any text: a script tag in a cell, the name or a label', () => {
    expect(codes(withCell({ type: 'word', value: '<script>x</script>' }))).toEqual([
      'cells[0][0].value unsafe-text',
    ]);
    expect(codes(withCell({ type: 'char', value: '<' }))).toEqual([
      'cells[0][0].value unsafe-text',
    ]);
    const board = valid();
    board['name'] = 'Tablica <img src=x onerror=alert(1)>';
    (board['columns'] as string[])[0] = '>';
    expect(codes(board)).toEqual(['name unsafe-text', 'columns[0] unsafe-text']);
  });

  it('rejects control and invisible characters, also written as JSON escapes', () => {
    const hidden: Record<string, string> = {
      NUL: 'A\u0000B',
      escape: 'A\u001bB',
      'line break': 'A\nB',
      'zero-width space': 'A​B',
      'right-to-left override': 'A‮B',
      'bidi isolate': 'A⁦B',
      'soft hyphen': 'A­B',
      BOM: 'A﻿B',
      'private use': 'AB',
      'lone surrogate': 'A\ud800B',
      'tag character': 'A\u{e0041}B',
    };
    for (const [name, value] of Object.entries(hidden)) {
      expect(codes(withCell({ type: 'word', value })), name).toEqual([
        'cells[0][0].value unsafe-text',
      ]);
    }
    const escaped = JSON.stringify(withCell({ type: 'word', value: 'TAK' })).replace(
      'TAK',
      'T\\u0000K',
    );
    expect(validateBoard(escaped)).toMatchObject({ ok: false, errors: [{ code: 'unsafe-text' }] });
  });

  it('keeps ordinary text: Polish letters, punctuation, an emoji joined with a zero-width joiner', () => {
    for (const value of ['ŻÓŁĆ', 'TAK!', "NIE, 'A' & B?", '👩‍⚕️', 'نه‌']) {
      expect(codes(withCell({ type: 'word', value })), value).toEqual([]);
    }
  });

  it('returns a fresh object with known fields only', () => {
    const result = validateBoardData(valid());
    expect(result.ok && Object.keys(result.board)).toEqual([
      'schemaVersion',
      'id',
      'name',
      'locale',
      'columns',
      'rows',
      'cells',
    ]);
  });

  it('stops at 50 errors and never throws', () => {
    const board = valid();
    board['cells'] = Array.from({ length: 5 }, () => Array.from({ length: 7 }, () => 'x'));
    expect(errorsOf(board)).toHaveLength(35);
    const many = valid();
    for (let i = 0; i < 60; i++) many[`field${i}`] = i;
    expect(errorsOf(many)).toHaveLength(BOARD_LIMITS.maxErrors);
  });
});
