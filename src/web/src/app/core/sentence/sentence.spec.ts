// Spec 006, T2: the sentence with undo (R3).
import {
  HISTORY_LIMIT,
  append,
  applyCell,
  canUndo,
  clear,
  createSentence,
  deleteLast,
  undo,
} from './sentence';

const char = (value: string) => ({ type: 'char', value }) as const;
const word = (value: string) => ({ type: 'word', value }) as const;
const action = (value: 'space' | 'delete' | 'speak' | 'clear' | 'undo') =>
  ({ type: 'action', value }) as const;

describe('sentence', () => {
  it('appends letters, a digraph as one step, a word with its space and a space', () => {
    let s = createSentence();
    for (const cell of [char('W'), char('SZ'), action('space'), word('TAK')])
      s = applyCell(s, cell);
    expect(s.text).toBe('WSZ TAK ');
    expect(s.history).toHaveLength(4);
  });

  it('undo reverses the steps one by one, newest first: "SZ" goes as a whole', () => {
    let s = createSentence();
    for (const cell of [char('W'), char('SZ'), word('TAK')]) s = applyCell(s, cell);
    const texts = [];
    while (canUndo(s)) {
      s = undo(s);
      texts.push(s.text);
    }
    expect(texts).toEqual(['WSZ', 'W', '']);
  });

  it('delete removes the last character, and undo brings it back', () => {
    let s = append(createSentence(), 'ŻABA');
    s = deleteLast(s);
    expect(s.text).toBe('ŻAB');
    expect(undo(s).text).toBe('ŻABA');
  });

  it('delete counts "Ż" as one character even if it was typed as Z and a dot', () => {
    const s = deleteLast(append(createSentence(), 'AŻ'));
    expect(s.text).toBe('A');
  });

  it('clear empties the text as one step, and undo brings the whole text back', () => {
    let s = append(createSentence(), 'CHCĘ PIĆ');
    s = clear(s);
    expect(s.text).toBe('');
    expect(undo(s).text).toBe('CHCĘ PIĆ');
  });

  it('undo with an empty history changes nothing, and never removes text it did not write', () => {
    const start = createSentence('CHCĘ SIĘ NAPIĆ ');
    expect(canUndo(start)).toBe(false);
    expect(undo(start)).toBe(start);
    const s = undo(undo(append(start, 'W')));
    expect(s.text).toBe('CHCĘ SIĘ NAPIĆ ');
  });

  it('delete and clear on an empty text add no step', () => {
    const empty = createSentence();
    expect(deleteLast(empty)).toBe(empty);
    expect(clear(empty)).toBe(empty);
    expect(append(empty, '')).toBe(empty);
  });

  it('the undo and speak cells: undo reverses, speak changes nothing (the machine asks first)', () => {
    const s = applyCell(createSentence(), char('A'));
    expect(applyCell(s, action('undo')).text).toBe('');
    expect(applyCell(s, action('speak'))).toBe(s);
    expect(applyCell(s, action('clear')).text).toBe('');
    expect(applyCell(s, action('delete')).text).toBe('');
  });

  it('keeps at most 200 steps; older ones can no longer be undone', () => {
    let s = createSentence();
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) s = append(s, 'A');
    expect(s.history).toHaveLength(HISTORY_LIMIT);
    while (canUndo(s)) s = undo(s);
    expect(s.text).toBe('AAAAA');
  });

  it('is immutable: the previous sentence stays as it was', () => {
    const before = append(createSentence(), 'A');
    const after = append(before, 'B');
    expect(before.text).toBe('A');
    expect(before.history).toHaveLength(1);
    expect(after.text).toBe('AB');
  });
});
