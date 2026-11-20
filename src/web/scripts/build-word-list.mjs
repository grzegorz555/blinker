// Builds public/words/pl.txt and public/words/pl.LICENSE.txt from the FrequencyWords list (spec 016, R2, R3).
// Run by hand, not in CI. The source file is UNTRUSTED data: it is read as text only (strict UTF-8, size cap),
// every line must pass an allowlist, and nothing in it is ever executed or interpreted.
//
//   curl -o pl_50k.txt https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/pl/pl_50k.txt
//   node scripts/build-word-list.mjs <path to pl_50k.txt> [output folder]
//
// Source: FrequencyWords by Hermit Dave (CC BY-SA 4.0), counts from OpenSubtitles 2018 via OPUS. See ADR-0007.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_OUT = resolve(import.meta.dirname, '..', 'public', 'words');
export const SOURCE_URL =
  'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/pl/pl_50k.txt';

export const WORD_COUNT = 20_000; // R2
export const MAX_SOURCE_BYTES = 2 * 1024 * 1024; // the real file is about 660 KB
export const MAX_OUTPUT_BYTES = 256 * 1024; // R3
/** One lowercase Polish word, 3-24 letters, in NFC (R2, R3). The same rule the app applies when it reads the file. */
/** Letters the Polish alphabet does not have; the build drops such words (R2), and the allowlist of R3 refuses them. */
export const FOREIGN_LETTERS = /[qvx]/;
export const WORD_PATTERN = /^[a-pr-uwyząćęłńóśźż]{3,24}$/;

/**
 * Vulgar and insulting forms left out of the suggestions (R2). Sorted by code point (the test checks it). THE AUTHOR REVIEWS THIS LIST.
 * He can still spell any of these himself; then they are his own words (spec 016, R9).
 * Entries that are not in the source are harmless.
 */
export const EXCLUDED_WORDS = [
  'chuj',
  'chuja',
  'chujem',
  'chujowo',
  'chujowy',
  'chuju',
  'chujów',
  'ciota',
  'cioty',
  'cipa',
  'cipka',
  'cipę',
  'debil',
  'debile',
  'debilu',
  'dziwka',
  'dziwki',
  'dziwko',
  'fiucie',
  'fiut',
  'fiuta',
  'jebana',
  'jebane',
  'jebany',
  'jebać',
  'jebał',
  'jebie',
  'jebię',
  'jebnięty',
  'kurew',
  'kurwa',
  'kurwach',
  'kurwie',
  'kurwo',
  'kurwy',
  'kurwą',
  'kurwę',
  'kutas',
  'kutasa',
  'odpierdol',
  'odpierdolcie',
  'pedał',
  'pedały',
  'pierdol',
  'pierdoli',
  'pierdolisz',
  'pierdolić',
  'pierdolnięty',
  'pierdolona',
  'pierdolone',
  'pierdolony',
  'pierdolę',
  'pizda',
  'pizdy',
  'pizdę',
  'skurwiel',
  'skurwysyn',
  'skurwysyna',
  'skurwysynu',
  'skurwysyny',
  'spierdalaj',
  'spierdalać',
  'szmata',
  'szmato',
  'szmaty',
  'zjebane',
  'zjebany',
  'zjebał',
];

/** Thrown for a source we refuse; the CLI prints the message and exits 1. */
export class WordListError extends Error {}

/** Strict UTF-8 decode: a bad byte or a BOM is an error, never a silent replacement. */
export function decodeSource(bytes) {
  if (bytes.length > MAX_SOURCE_BYTES) {
    throw new WordListError(`source is too big: ${bytes.length} bytes (max ${MAX_SOURCE_BYTES})`);
  }
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    throw new WordListError('source starts with a byte order mark (BOM)');
  }
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw new WordListError('source is not valid UTF-8');
  }
}

/**
 * The words of the filtered list: source order kept (frequency order), allowlist, exclusions, first duplicate wins.
 * A line is "word count"; a line of any other shape is skipped.
 * @param {string} text decoded source
 * @param {number} limit how many words to keep
 * @returns {string[]}
 */
export function filterWords(text, limit = WORD_COUNT) {
  const excluded = new Set(EXCLUDED_WORDS);
  const seen = new Set();
  const words = [];
  for (const line of text.split(/\r?\n/)) {
    const match = /^(\S+) \d+$/.exec(line);
    if (!match) continue;
    const word = match[1].normalize('NFC').toLocaleLowerCase('pl').normalize('NFC');
    if (
      !WORD_PATTERN.test(word) ||
      FOREIGN_LETTERS.test(word) ||
      excluded.has(word) ||
      seen.has(word)
    )
      continue;
    seen.add(word);
    words.push(word);
    if (words.length === limit) break;
  }
  return words;
}

/** The text of public/words/pl.LICENSE.txt (CC BY-SA 4.0, section 3(a): creator, license, link, changes). */
export function licenseText({ sha256, date, count }) {
  return `Polish word list for word prediction (pl.txt)

Source
  FrequencyWords by Hermit Dave, Polish list of 2018 (pl_50k.txt)
  ${SOURCE_URL}
  Repository: https://github.com/hermitdave/FrequencyWords
  The counts come from the OpenSubtitles 2018 corpus (OPUS, https://opus.nlpl.eu/;
  subtitles from https://www.opensubtitles.org/).
  Downloaded on ${date}. SHA-256 of the downloaded file: ${sha256}

License
  The source content is licensed under Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0):
  https://creativecommons.org/licenses/by-sa/4.0/
  Legal code: https://creativecommons.org/licenses/by-sa/4.0/legalcode.en

Changes made (this is adapted material)
  - Kept only lowercase words of 3 to 24 letters from a-z and the Polish letters ą ć ę ł ń ó ś ź ż
    (no q, v, x, digits, punctuation or foreign letters).
  - Removed a short list of vulgar and insulting forms (see scripts/build-word-list.mjs in the repository).
  - Removed duplicates and kept the first ${count.toLocaleString('en-US')} words in the original frequency order.
  - Dropped the counts: the file has one word per line.
  Built with scripts/build-word-list.mjs.

Sharing
  This file and pl.txt are shared under CC BY-SA 4.0 (the same license as the source). The rest of the Blinker
  application is not adapted material and keeps its own license (ADR-0007).
`;
}

/**
 * Builds both files from the source bytes.
 * @param {Uint8Array} bytes the untrusted source
 * @returns {{ words: string[], list: string, license: string }}
 */
export function buildWordList(bytes, { date, limit = WORD_COUNT, count = limit } = {}) {
  const text = decodeSource(bytes);
  const words = filterWords(text, limit);
  if (words.length < limit) {
    throw new WordListError(`only ${words.length} usable words in the source, need ${limit}`);
  }
  const list = words.join('\n') + '\n';
  const size = Buffer.byteLength(list);
  if (size > MAX_OUTPUT_BYTES) {
    throw new WordListError(`result is ${size} bytes, over the ${MAX_OUTPUT_BYTES} byte cap (R3)`);
  }
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const when = date ?? new Date().toISOString().slice(0, 10);
  return { words, list, license: licenseText({ sha256, date: when, count }) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [source, outArg] = process.argv.slice(2);
  if (!source) {
    console.error('usage: node scripts/build-word-list.mjs <source file> [output folder]');
    process.exit(2);
  }
  try {
    const size = statSync(source).size;
    if (size > MAX_SOURCE_BYTES) throw new WordListError(`source is too big: ${size} bytes`);
    const { words, list, license } = buildWordList(readFileSync(source));
    const out = resolve(outArg ?? DEFAULT_OUT);
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, 'pl.txt'), list);
    writeFileSync(join(out, 'pl.LICENSE.txt'), license);
    console.log(`wrote ${words.length} words (${Buffer.byteLength(list)} bytes) to ${out}`);
  } catch (error) {
    if (!(error instanceof WordListError) && error?.code !== 'ENOENT') throw error;
    console.error(`build-word-list failed: ${error.message}`);
    process.exit(1);
  }
}
