// Tests for build-word-list.mjs and the committed word list (spec 016, R2, R3), run with: npm run test:scripts
// https://nodejs.org/api/test.html
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import {
  EXCLUDED_WORDS,
  MAX_OUTPUT_BYTES,
  WORD_COUNT,
  FOREIGN_LETTERS,
  WORD_PATTERN,
  WordListError,
  buildWordList,
  filterWords,
} from './build-word-list.mjs';

const SCRIPT = join(import.meta.dirname, 'build-word-list.mjs');
const PUBLIC = join(import.meta.dirname, '..', 'public', 'words');
const bytes = (text) => new TextEncoder().encode(text);

// Order of the source is the frequency order. Bad lines are mixed in on purpose.
const FIXTURE = [
  'nie 900',
  'się 800',
  'Dom 750', // uppercase: lowercased, then the duplicate below is dropped
  'dom 700', // duplicate of "Dom"
  'to 600', // too short
  'quad 590', // q
  'vista 580', // v
  'xenon 570', // x
  'abc123 560', // digits
  'żółw 550',
  'kurwa 540', // excluded
  'a'.repeat(25) + ' 530', // too long
  'a'.repeat(24) + ' 520', // longest allowed
  'bad-line-without-count',
  'two words 5',
  'chcę 500',
  'boli 400',
  '',
].join('\n');

describe('filterWords', () => {
  it('keeps the source order, drops bad lines, excluded words and duplicates', () => {
    assert.deepEqual(filterWords(FIXTURE, 100), [
      'nie',
      'się',
      'dom',
      'żółw',
      'a'.repeat(24),
      'chcę',
      'boli',
    ]);
  });

  it('keeps only the first N words', () => {
    assert.deepEqual(filterWords(FIXTURE, 2), ['nie', 'się']);
  });

  it('handles Windows line ends', () => {
    assert.deepEqual(filterWords('nie 1\r\nsię 2\r\n', 10), ['nie', 'się']);
  });

  it('normalizes decomposed letters to NFC', () => {
    assert.deepEqual(filterWords('żółw 5'.normalize('NFD'), 10), ['żółw']);
  });
});

describe('buildWordList', () => {
  const options = { date: '2026-01-02', limit: 5 };

  it('builds the list and a license with the source hash and date', () => {
    const { words, list, license } = buildWordList(bytes(FIXTURE), options);
    assert.deepEqual(words, ['nie', 'się', 'dom', 'żółw', 'a'.repeat(24)]);
    assert.equal(list, words.join('\n') + '\n');
    assert.match(license, /CC BY-SA 4\.0/);
    assert.match(license, /Downloaded on 2026-01-02/);
    assert.match(license, /SHA-256 of the downloaded file: [0-9a-f]{64}/);
  });

  it('fails when the source has too few usable words', () => {
    assert.throws(
      () => buildWordList(bytes(FIXTURE), { ...options, limit: 50 }),
      (e) => e instanceof WordListError && /only 7 usable words/.test(e.message),
    );
  });

  it('rejects a byte order mark', () => {
    const withBom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('nie 1\n')]);
    assert.throws(() => buildWordList(withBom, options), /byte order mark/);
  });

  it('rejects a byte that is not valid UTF-8', () => {
    const bad = Buffer.concat([
      Buffer.from('nie 1\n'),
      Buffer.from([0xff, 0xfe]),
      Buffer.from(' 2\n'),
    ]);
    assert.throws(() => buildWordList(bad, options), /not valid UTF-8/);
  });

  it('rejects a source over the size cap', () => {
    assert.throws(() => buildWordList(new Uint8Array(3 * 1024 * 1024), options), /too big/);
  });
});

describe('the build script as a command', () => {
  let dir;
  before(() => {
    dir = mkdtempSync(join(tmpdir(), 'blinker-words-'));
  });
  after(() => rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

  const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });

  it('prints usage without arguments', () => {
    assert.equal(run().status, 2);
  });

  it('fails cleanly (exit 1, no stack trace) for a non-UTF-8 source', () => {
    const source = join(dir, 'bad.txt');
    writeFileSync(source, Buffer.from([0x6e, 0x69, 0x65, 0x20, 0xff, 0x0a]));
    const result = run(source, join(dir, 'out'));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /build-word-list failed: source is not valid UTF-8/);
    assert.doesNotMatch(result.stderr, /\bat /);
  });

  it('fails cleanly for a missing file and for a source with too few words', () => {
    assert.equal(run(join(dir, 'missing.txt')).status, 1);
    const source = join(dir, 'few.txt');
    writeFileSync(source, FIXTURE);
    const result = run(source, join(dir, 'out'));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /only 7 usable words/);
  });
});

describe('the exclusion list', () => {
  it('is sorted, without duplicates, and every entry passes the allowlist', () => {
    assert.deepEqual(EXCLUDED_WORDS, [...new Set(EXCLUDED_WORDS)].sort());
    for (const word of EXCLUDED_WORDS) assert.match(word, WORD_PATTERN, word);
  });
});

describe('the committed list public/words/pl.txt', () => {
  const text = readFileSync(join(PUBLIC, 'pl.txt'), 'utf8');
  const lines = text.split('\n');

  it('has exactly 20,000 lines, ends with a newline, is within the size cap (R3)', () => {
    assert.equal(lines.pop(), '');
    assert.equal(lines.length, WORD_COUNT);
    assert.ok(Buffer.byteLength(text) <= MAX_OUTPUT_BYTES);
    assert.ok(!text.includes('\r'));
  });

  it('has only words that pass the allowlist, in NFC', () => {
    for (const word of lines.slice(0, WORD_COUNT)) {
      assert.match(word, WORD_PATTERN, word);
      assert.equal(word, word.normalize('NFC'));
      assert.doesNotMatch(word, FOREIGN_LETTERS, word);
    }
  });

  it('has no duplicate and no excluded word', () => {
    const words = lines.slice(0, WORD_COUNT);
    assert.equal(new Set(words).size, words.length);
    const excluded = new Set(EXCLUDED_WORDS);
    assert.deepEqual(
      words.filter((w) => excluded.has(w)),
      [],
    );
  });

  it('starts with the most frequent Polish words (frequency order kept)', () => {
    assert.deepEqual(lines.slice(0, 3), ['nie', 'się', 'jest']);
  });

  it('has a license file naming the source and CC BY-SA 4.0 (section 3(a))', () => {
    const license = readFileSync(join(PUBLIC, 'pl.LICENSE.txt'), 'utf8');
    assert.match(license, /Hermit Dave/);
    assert.match(license, /github\.com\/hermitdave\/FrequencyWords/);
    assert.match(license, /OpenSubtitles/);
    assert.match(license, /creativecommons\.org\/licenses\/by-sa\/4\.0\//);
    assert.match(license, /Changes made/);
    assert.match(license, /SHA-256 of the downloaded file: [0-9a-f]{64}/);
  });
});
