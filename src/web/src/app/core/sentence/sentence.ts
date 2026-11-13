// The sentence he builds (spec 006, R3). Plain TypeScript, immutable: every function returns a new Sentence.
// Every change is a step in the history, so undo reverses exactly the last thing this session did: an added letter
// is removed, a deleted letter or a cleared text comes back. Text that was there at the start is never undone.
import type { Cell } from '../boards/board';

/** One change, with what it needs to be reversed. */
export type SentenceStep =
  | { readonly kind: 'append'; readonly text: string }
  | { readonly kind: 'delete'; readonly removed: string }
  | { readonly kind: 'clear'; readonly removed: string };

export interface Sentence {
  readonly text: string;
  /** Newest last; at most HISTORY_LIMIT steps, older ones can no longer be undone. */
  readonly history: readonly SentenceStep[];
}

export const HISTORY_LIMIT = 200;

/** A new sentence; initial text (for example restored later) is not part of the history, so undo keeps it. */
export function createSentence(text = ''): Sentence {
  return { text: text.normalize('NFC'), history: [] };
}

function push(sentence: Sentence, text: string, step: SentenceStep): Sentence {
  const history = [...sentence.history, step];
  return {
    text,
    history: history.length > HISTORY_LIMIT ? history.slice(-HISTORY_LIMIT) : history,
  };
}

/** Appends text as one step (a letter, a digraph such as "SZ", a word with its space). */
export function append(sentence: Sentence, text: string): Sentence {
  const clean = text.normalize('NFC');
  if (!clean) return sentence;
  return push(sentence, sentence.text + clean, { kind: 'append', text: clean });
}

/** Deletes the last character (a code point after NFC, so "Ż" goes as one). Nothing to delete: no step. */
export function deleteLast(sentence: Sentence): Sentence {
  const chars = [...sentence.text];
  const removed = chars.pop();
  if (removed === undefined) return sentence;
  return push(sentence, chars.join(''), { kind: 'delete', removed });
}

/**
 * Clears the whole text, as one step that undo can reverse. The caller asks first: the counting machine clears only
 * after a confirmed yes (R5). Nothing to clear: no step.
 */
export function clear(sentence: Sentence): Sentence {
  if (!sentence.text) return sentence;
  return push(sentence, '', { kind: 'clear', removed: sentence.text });
}

/** Reverses the last step of this session. With an empty history it changes nothing. */
export function undo(sentence: Sentence): Sentence {
  const step = sentence.history.at(-1);
  if (!step) return sentence;
  const history = sentence.history.slice(0, -1);
  switch (step.kind) {
    case 'append':
      return { text: sentence.text.slice(0, -step.text.length), history };
    case 'delete':
      return { text: sentence.text + step.removed, history };
    case 'clear':
      return { text: step.removed, history };
  }
}

export const canUndo = (sentence: Sentence) => sentence.history.length > 0;

/**
 * Applies a board cell: a letter as it is, a word with a trailing space, and the actions space, delete, clear and
 * undo. "speak" does not change the text; the counting machine asks first and then reads it aloud.
 */
export function applyCell(sentence: Sentence, cell: Cell): Sentence {
  switch (cell.type) {
    case 'char':
      return append(sentence, cell.value);
    case 'word':
      return append(sentence, `${cell.value} `);
    case 'action':
      switch (cell.value) {
        case 'space':
          return append(sentence, ' ');
        case 'delete':
          return deleteLast(sentence);
        case 'clear':
          return clear(sentence);
        case 'undo':
          return undo(sentence);
        case 'speak':
          return sentence;
      }
  }
}
