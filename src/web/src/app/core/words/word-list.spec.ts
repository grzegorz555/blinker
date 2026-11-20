import { describe, expect, it } from 'vitest';
import { parseWordList, WORD_LIST_LIMITS } from './word-list';

const bytes = (s: string): Uint8Array => new TextEncoder().encode(s);

describe('parseWordList (spec 016, R3)', () => {
  it('accepts a good file as text and keeps the line order as the rank', () => {
    expect(parseWordList('nie\ntak\nżółw\n')).toEqual({ ok: true, words: ['nie', 'tak', 'żółw'] });
  });

  it('accepts bytes (Uint8Array and ArrayBuffer)', () => {
    const u8 = bytes('dom\nkot\n');
    expect(parseWordList(u8)).toEqual({ ok: true, words: ['dom', 'kot'] });
    const buf = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
    expect(parseWordList(buf)).toEqual({ ok: true, words: ['dom', 'kot'] });
  });

  it('accepts a file without a final line break and with one', () => {
    expect(parseWordList('dom\nkot')).toEqual({ ok: true, words: ['dom', 'kot'] });
    expect(parseWordList('dom\nkot\n')).toEqual({ ok: true, words: ['dom', 'kot'] });
  });

  it('accepts CRLF line endings (a Windows checkout)', () => {
    expect(parseWordList('dom\r\nkot\r\n')).toEqual({ ok: true, words: ['dom', 'kot'] });
  });

  it('rejects a lone carriage return and a blank line', () => {
    expect(parseWordList('dom\rkot\n')).toMatchObject({ ok: false, reason: 'bad-line', line: 1 });
    expect(parseWordList('dom\n\nkot\n')).toMatchObject({ ok: false, reason: 'bad-line', line: 2 });
    expect(parseWordList('dom\nkot\n\n')).toMatchObject({ ok: false, reason: 'bad-line', line: 3 });
  });

  it('rejects an empty file and a file with only a line break', () => {
    expect(parseWordList('')).toEqual({ ok: false, reason: 'empty' });
    expect(parseWordList('\n')).toEqual({ ok: false, reason: 'empty' });
  });

  it('rejects the whole file for one bad line and says which', () => {
    for (const bad of [
      'Dom',
      'ab',
      'a'.repeat(25),
      'dom1',
      'video',
      'taxi',
      'quiz',
      'dom kot',
      'café',
      'dom-kot',
    ]) {
      expect(parseWordList(`kot\n${bad}\npies\n`)).toEqual({
        ok: false,
        reason: 'bad-line',
        line: 2,
      });
    }
  });

  it('accepts the boundary lengths 3 and 24', () => {
    const long = 'a'.repeat(24);
    expect(parseWordList(`ala\n${long}\n`)).toEqual({ ok: true, words: ['ala', long] });
  });

  it('normalizes NFC before the check and returns the NFC form', () => {
    // NFD is a plain letter plus a combining mark: o + U+0301 (acute), z + U+0307 (dot above)
    const nfd =
      ['zo', 0x301, 'ła']
        .map((p) => (typeof p === 'number' ? String.fromCodePoint(p) : p))
        .join('') +
      '\n' +
      ['z', 0x307, 'o', 0x301, 'łw']
        .map((p) => (typeof p === 'number' ? String.fromCodePoint(p) : p))
        .join('') +
      '\n';
    expect(nfd).not.toBe(nfd.normalize('NFC'));
    expect(parseWordList(nfd)).toEqual({ ok: true, words: ['zóła', 'żółw'] });
  });

  it('rejects a BOM at the start', () => {
    expect(parseWordList('﻿dom\nkot\n')).toMatchObject({ ok: false, reason: 'bad-line', line: 1 });
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...bytes('dom\n')]);
    expect(parseWordList(withBom)).toMatchObject({ ok: false, reason: 'bad-line', line: 1 });
  });

  it('rejects a byte that is not valid UTF-8 instead of replacing it', () => {
    expect(parseWordList(new Uint8Array([0x64, 0x6f, 0xff, 0x0a]))).toEqual({
      ok: false,
      reason: 'not-utf8',
    });
    // a Latin-2 "ł" (0xB3) alone is not UTF-8
    expect(parseWordList(new Uint8Array([0x7a, 0xb3, 0x79, 0x0a]))).toEqual({
      ok: false,
      reason: 'not-utf8',
    });
  });

  it('rejects a file over 256 KB, and accepts one exactly at the limit', () => {
    const word = 'abcdefgh\n'; // 9 bytes
    const tooBig = new Uint8Array(WORD_LIST_LIMITS.bytes + 1).fill(0x0a);
    expect(parseWordList(tooBig)).toEqual({ ok: false, reason: 'too-big' });
    expect(parseWordList(bytes(word.repeat(100)))).toMatchObject({ ok: true });
  });

  it('rejects more than 20,000 lines and accepts exactly 20,000', () => {
    const ok = Array.from({ length: 20_000 }, () => 'dom').join('\n') + '\n';
    const r = parseWordList(ok);
    expect(r.ok).toBe(true);
    const tooMany = Array.from({ length: 20_001 }, () => 'dom').join('\n') + '\n';
    expect(parseWordList(tooMany)).toEqual({ ok: false, reason: 'too-many-lines' });
  });
});
