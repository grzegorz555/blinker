// The built-in word list (spec 016, R3). Plain TypeScript, no Angular imports, no I/O, no clock.
//
// The list is our own static file (`/words/pl.txt`, ADR-0007), but it is still checked like untrusted input: a byte
// cap, a strict UTF-8 decode, a line cap and an allowlist per line. Any bad line rejects the whole file, and the
// result is typed data (`ok: false` plus a reason), never a throw, so the caller can fall back to his own words.
//
// Decisions (the spec leaves room):
// - The rank of a word is its line order (line 1 = the most frequent).
// - A leading BOM (U+FEFF) is NOT accepted: the decoder keeps it (`ignoreBOM: true`), so the first line fails the
//   allowlist and the file is rejected. Our build never writes one; a BOM means the file was not made by our script.
// - Line endings: LF, and CRLF too (one `\r` before `\n` is dropped), because a Windows checkout with autocrlf turns
//   our LF file into CRLF and the app should not break because of it. A lone `\r` is a bad line.
// - One final line break is allowed. An empty line anywhere else (also a second final line break) is a bad line.
// - A file without any word (empty, or only one line break) is rejected: it is not a list.
// - Every line is NFC-normalized before the check, and the words returned are the NFC forms.
// - Repeated words are not rejected here (the spec does not ask); the predictor shows a word once.

export const WORD_LIST_LIMITS = { bytes: 256 * 1024, lines: 20_000 } as const;

/** One word of the list: lowercase, 3–24 letters of a–z without q, v, x, plus the Polish letters (R2, R3). */
export const WORD_LINE = /^[a-pr-uwyząćęłńóśźż]{3,24}$/;

export type WordListError =
  | 'too-big' // more than 256 KB
  | 'not-utf8' // a byte sequence that is not valid UTF-8
  | 'empty' // no word at all
  | 'too-many-lines' // more than 20,000 lines
  | 'bad-line'; // a line outside the allowlist (`line` is 1-based)

export type WordListResult =
  | { readonly ok: true; readonly words: readonly string[] }
  | { readonly ok: false; readonly reason: WordListError; readonly line?: number };

const encoder = new TextEncoder();

/**
 * Parses and validates the list file as fetched: bytes (`ArrayBuffer` / `Uint8Array`) or already decoded text.
 * The words come back in line order (rank = index).
 */
export function parseWordList(input: ArrayBuffer | Uint8Array | string): WordListResult {
  const bytes =
    typeof input === 'string'
      ? encoder.encode(input)
      : input instanceof Uint8Array
        ? input
        : new Uint8Array(input);
  if (bytes.byteLength > WORD_LIST_LIMITS.bytes) return { ok: false, reason: 'too-big' };

  let text: string;
  try {
    // fatal: an invalid byte throws instead of becoming U+FFFD; ignoreBOM: the BOM stays in the text (see above).
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return { ok: false, reason: 'not-utf8' };
  }

  if (text.endsWith('\n')) text = text.slice(0, -1); // one final line break
  if (text === '') return { ok: false, reason: 'empty' };
  const lines = text.split('\n');
  if (lines.length > WORD_LIST_LIMITS.lines) return { ok: false, reason: 'too-many-lines' };

  const words: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].endsWith('\r') ? lines[i].slice(0, -1) : lines[i];
    const word = raw.normalize('NFC');
    if (!WORD_LINE.test(word)) return { ok: false, reason: 'bad-line', line: i + 1 };
    words.push(word);
  }
  return { ok: true, words };
}
