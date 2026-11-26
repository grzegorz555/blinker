// Favorite phrases (spec 019). Plain TypeScript, no Angular imports, no clock, no I/O: the same input always gives the
// same output (CLAUDE.md rule 13: predictable, forgiving).
//
// - A phrase is what a caregiver typed (R2): 2–60 characters after trimming, letters of any language, digits, spaces
//   and `.,!?-'`. The allowlist keeps control characters and markup out; phrases are rendered as text anyway.
// - The match (R3): the whole sentence so far, from its first letter, is the start of exactly one phrase. Both are
//   compared in one form: NFC, upper case in the board's language, the phrase's punctuation left out, runs of spaces as
//   one. With a Polish board a plain letter he spelled also stands for its Polish letter, and a Polish letter he spelled
//   matches only itself: the table of spec 016 (`PLAIN_TO_POLISH`), one constant for both specs.
// - Letters are compared by code points (`[...s]`), not by UTF-16 units.
import { PLAIN_TO_POLISH } from '../words/predict';

export const PHRASES_KEY = 'blinker.phrases.v1';
export const PHRASE_LIMITS = { count: 20, minLength: 2, maxLength: 60 } as const;
/** He must have spelled this many letters before a phrase is offered (the author, 2026-11-26). */
export const MIN_TEXT_LETTERS = 2;
/** A phrase must be at least this many letters longer than his text: it must save signals. */
export const MIN_GAIN = 2;

/** Letters of any language, combining marks, digits, a space and `.,!?-'`; nothing else. */
const ALLOWED = /^[\p{L}\p{M}\p{N} .,!?'-]+$/u;
const PUNCTUATION = /[.,!?'-]/g;

export type PhraseError = 'too-short' | 'too-long' | 'characters' | 'duplicate' | 'full';

export type PhraseCheck =
  | { readonly ok: true; readonly phrase: string }
  | { readonly ok: false; readonly error: PhraseError };

/** The one form a phrase is kept in: NFC, trimmed, runs of spaces as one. */
export function cleanPhrase(raw: string): string {
  return raw.normalize('NFC').trim().replace(/\s+/g, ' ');
}

/** The form phrases and his text are compared in (R3): upper case, no punctuation, runs of spaces as one. */
export function compareForm(text: string, locale = 'pl'): string {
  let upper = text.normalize('NFC');
  try {
    upper = upper.toLocaleUpperCase(locale);
  } catch {
    upper = upper.toUpperCase(); // a locale the browser does not know: plain upper case
  }
  return upper.replace(PUNCTUATION, '').replace(/\s+/g, ' ').replace(/^ /, '');
}

/** R2: a phrase a caregiver typed, checked against the phrases already on the list. */
export function checkPhrase(raw: string, list: readonly string[]): PhraseCheck {
  const phrase = cleanPhrase(raw);
  const length = [...phrase].length;
  if (length < PHRASE_LIMITS.minLength) return { ok: false, error: 'too-short' };
  if (length > PHRASE_LIMITS.maxLength) return { ok: false, error: 'too-long' };
  if (!ALLOWED.test(phrase)) return { ok: false, error: 'characters' };
  const form = compareForm(phrase).trim();
  if (list.some((p) => compareForm(p).trim() === form)) return { ok: false, error: 'duplicate' };
  if (list.length >= PHRASE_LIMITS.count) return { ok: false, error: 'full' };
  return { ok: true, phrase };
}

/**
 * R9: the stored list, validated like untrusted input when read back or restored from a file: an array of at most 20
 * phrases, each as a caregiver could have added it, kept in its clean form, no two alike. Anything else: null.
 */
export function validatePhrases(data: unknown): string[] | null {
  if (!Array.isArray(data) || data.length > PHRASE_LIMITS.count) return null;
  const list: string[] = [];
  for (const item of data) {
    if (typeof item !== 'string' || item !== cleanPhrase(item)) return null;
    const check = checkPhrase(item, list);
    if (!check.ok) return null;
    list.push(check.phrase);
  }
  return list;
}

const isPolish = (locale: string) => locale.toLowerCase().split('-')[0] === 'pl';
const letterCount = (form: string) => [...form].filter((c) => c !== ' ').length;

/**
 * R3: the one phrase his whole text so far is the start of, or null. At least 2 letters spelled, exactly one phrase
 * matching (refused ones left out; a phrase as short as his text still counts), and that phrase at least 2 letters
 * longer than his text.
 */
export function matchPhrase(
  text: string,
  phrases: readonly string[],
  locale: string,
  refused: readonly string[] = [],
): string | null {
  const typed = [...compareForm(text, locale)];
  const typedLetters = letterCount(typed.join(''));
  if (typedLetters < MIN_TEXT_LETTERS) return null;
  const polish = isPolish(locale);
  const skip = new Set(refused.map((r) => compareForm(r, locale).trim()));
  let found: string | null = null;
  for (const phrase of phrases) {
    const form = compareForm(phrase, locale).trim();
    if (skip.has(form)) continue;
    const chars = [...form];
    if (chars.length < typed.length) continue;
    const fits = typed.every(
      (c, i) => c === chars[i] || (polish && (PLAIN_TO_POLISH[c]?.includes(chars[i]) ?? false)),
    );
    if (!fits) continue;
    if (found !== null) return null; // two or more: he goes on spelling until one is left
    found = phrase;
  }
  // A short phrase that fits still counts above ("PI" fits both "Pić" and "Pić herbatę"); the one left is offered
  // only when it saves signals.
  if (found === null || letterCount(compareForm(found, locale)) < typedLetters + MIN_GAIN)
    return null;
  return found;
}

/** The phrase as it goes into his sentence: upper case like the board's letters (R6). */
export function phraseForSentence(phrase: string, locale: string): string {
  const clean = cleanPhrase(phrase);
  try {
    return clean.toLocaleUpperCase(locale);
  } catch {
    return clean.toUpperCase();
  }
}
