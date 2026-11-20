// The word predictor (spec 016, R4, R5, and the spelling rule of R9). Plain TypeScript, no Angular imports, no clock,
// no I/O: the same input always gives the same output (CLAUDE.md rule 13: predictable, forgiving).
//
// - The prefix is the text after the last space, when it is 2 or more letters (R4).
// - The match is one-way and letter by letter, after NFC and upper case in Polish: a plain letter of the prefix
//   matches itself or its Polish letter (PLAIN_TO_POLISH); a Polish letter he spelled matches only itself.
// - Letters are compared by code points (`[...s]`), not by UTF-16 units.
// - Candidates: his own words first (count desc, latest use desc, then the word in code-unit order of its upper-case
//   form: no locale data, so the same in every browser), then the list by rank. A word in both appears once, as his.
//   Refused words are left out. A candidate is at least 2 letters longer than the prefix. At most 3.
// - Output shape: every word comes back lowercase in NFC (the list's own form); the caller upper-cases it for the
//   sentence (`toLocaleUpperCase('pl')`) and says it as it is.

/** The words of his own sentences, as T4 keeps them (`blinker.words.v1`). */
export interface UserWord {
  readonly word: string;
  readonly count: number;
  /** The day (or time) of the latest use, ms since the epoch; larger = later. */
  readonly lastUsed: number;
}

export const MIN_PREFIX_LETTERS = 2;
export const MIN_GAIN = 2; // a guess must be at least this many letters longer than the prefix
export const MAX_CANDIDATES = 3;

/** One table for the whole match (R4): a plain upper-case letter and the Polish letters it also stands for. */
export const PLAIN_TO_POLISH: Readonly<Record<string, string>> = {
  A: 'Ą',
  C: 'Ć',
  E: 'Ę',
  L: 'Ł',
  N: 'Ń',
  O: 'Ó',
  S: 'Ś',
  Z: 'ŹŻ',
};

export interface SuggestInput {
  /** The whole sentence text so far; the prefix is taken from its end. */
  readonly text: string;
  readonly myWords?: readonly UserWord[];
  /** Words refused for this word (any case or normalization). */
  readonly refused?: readonly string[];
}

export interface Predictor {
  /** Up to 3 candidates, lowercase NFC, in the fixed order of R5. */
  suggest(input: SuggestInput): string[];
  /**
   * R9: which spelling a word he spelled counts for. The exact spelling in the list first, else the best-ranked list
   * word of the same length that it matches by R4, else the word as spelled. Lowercase NFC.
   */
  listSpelling(spelled: string): string;
}

/** NFC + Polish upper case: the one form words and prefixes are compared in. */
function upperForm(s: string): string {
  return s.normalize('NFC').toLocaleUpperCase('pl');
}

function lowerForm(s: string): string {
  return s.normalize('NFC').toLocaleLowerCase('pl');
}

/** The letters being written: the text after the last space, in the comparison form; null if it is not a prefix. */
export function prefixOf(text: string): string[] | null {
  const tail = upperForm(text.slice(text.lastIndexOf(' ') + 1));
  if (!/^\p{L}+$/u.test(tail)) return null;
  const letters = [...tail];
  return letters.length >= MIN_PREFIX_LETTERS ? letters : null;
}

function letterMatches(prefixLetter: string, wordLetter: string): boolean {
  return (
    prefixLetter === wordLetter || (PLAIN_TO_POLISH[prefixLetter]?.includes(wordLetter) ?? false)
  );
}

/** Does the word start with the prefix by R4, and is it at least `minGain` letters longer? Both are letter arrays. */
function matches(prefix: readonly string[], word: readonly string[], minGain: number): boolean {
  if (word.length < prefix.length + minGain) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (!letterMatches(prefix[i], word[i])) return false;
  }
  return true;
}

/** Builds a predictor for one list (rank = index). The list is indexed once; each call is a scan that stops early. */
export function createPredictor(list: readonly string[]): Predictor {
  const entries = list.map((word) => {
    const lower = lowerForm(word);
    const upper = upperForm(word);
    return { lower, upper, letters: [...upper] };
  });
  const firstByUpper = new Map<string, number>();
  entries.forEach((e, i) => {
    if (!firstByUpper.has(e.upper)) firstByUpper.set(e.upper, i);
  });

  function suggest({ text, myWords = [], refused = [] }: SuggestInput): string[] {
    const prefix = prefixOf(text);
    if (!prefix) return [];
    const blocked = new Set(refused.map(upperForm));
    const seen = new Set<string>();
    const out: string[] = [];
    const take = (upper: string, lower: string): void => {
      seen.add(upper);
      out.push(lower);
    };

    const mine = myWords
      .map((w) => ({
        upper: upperForm(w.word),
        lower: lowerForm(w.word),
        count: w.count,
        lastUsed: w.lastUsed,
      }))
      .sort(
        (a, b) =>
          b.count - a.count ||
          b.lastUsed - a.lastUsed ||
          (a.upper < b.upper ? -1 : a.upper > b.upper ? 1 : 0),
      );
    for (const w of mine) {
      if (out.length >= MAX_CANDIDATES) return out;
      if (seen.has(w.upper) || blocked.has(w.upper)) continue;
      if (matches(prefix, [...w.upper], MIN_GAIN)) take(w.upper, w.lower);
    }
    for (const e of entries) {
      if (out.length >= MAX_CANDIDATES) break;
      if (seen.has(e.upper) || blocked.has(e.upper)) continue;
      if (matches(prefix, e.letters, MIN_GAIN)) take(e.upper, e.lower);
    }
    return out;
  }

  function listSpelling(spelled: string): string {
    const upper = upperForm(spelled);
    const exact = firstByUpper.get(upper);
    if (exact !== undefined) return entries[exact].lower;
    const letters = [...upper];
    for (const e of entries) {
      if (e.letters.length === letters.length && matches(letters, e.letters, 0)) return e.lower;
    }
    return lowerForm(spelled);
  }

  return { suggest, listSpelling };
}
