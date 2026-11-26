// Spec 006, T3: the counting machine (R4–R6). A table test over every (state, signal) pair, then the paths of the
// interaction model. Time is driven by hand with TICK: no fake timers.
import friendBoard from '../../../../public/boards/friend-pl.json';
import { en, pl } from '../../../testing/transloco';
import { validateBoardData } from '../boards/validate-board';
import type { Board } from '../boards/board';
import { append, createSentence } from '../sentence/sentence';
import {
  ASK_AFTER,
  COUNTING_KEYS,
  SIGNAL_TYPES,
  STATE_NAMES,
  SUGGEST_PAUSE,
  TRANSITIONS,
  initialState,
  next,
  pointer,
  prompt,
  total,
  type CountingConfig,
  type CountingState,
  type Effect,
  type Signal,
  type SignalType,
  type StateName,
} from './counting';

const parsed = validateBoardData(friendBoard);
if (!parsed.ok) throw new Error('friend board invalid');
const board: Board = parsed.board;
// Most tests run with both spec 009 settings on, the behaviour of specs 006–008; the defaults have their own tests.
const config: CountingConfig = {
  board,
  askAfterMs: ASK_AFTER.default,
  speakPrompts: true,
  confirmByNod: true,
  rowCue: false,
  phrases: [],
  phrasePauseMs: SUGGEST_PAUSE.default,
};

/** TOUCH in the table: a tap on the first cell of his board, "A" (spec 007, R3). */
const signal = (type: SignalType, now = 0): Signal =>
  type === 'TICK'
    ? { type, now }
    : type === 'TOUCH'
      ? { type, target: { kind: 'cell', column: 1, row: 1 } }
      : ({ type } as Signal);

/** A typical state for each name: the sentence "AB", 7 (hand + 2) in the column step, 3 in the row step of column 7. */
function fixture(name: StateName): CountingState {
  const base = { ...initialState(append(append(createSentence(), 'A'), 'B')), name };
  switch (name) {
    case 'column.counting':
    case 'column.asking':
      return { ...base, parts: [5, 1, 1], lastCountAt: 0 };
    case 'row.waiting':
    case 'row.rejected':
      return { ...base, column: 7 };
    case 'row.counting':
    case 'row.asking':
      return { ...base, column: 7, parts: [1, 1, 1], lastCountAt: 0 };
    case 'paused':
      return { ...base, resume: 'column.waiting' };
    case 'phrase.asking':
      return { ...base, offer: 'Abc def', offeredFor: 'AB' };
    default:
      return base;
  }
}

const A = 'announce';
const S = 'say';
// prettier-ignore
/** Expected next state and effect types, per signal in SIGNAL_TYPES order: BLINK HAND NOD SHAKE RIGHT PAUSE TICK TOUCH SPOKEN. */
const TABLE: Record<StateName, readonly (readonly [StateName, readonly Effect['type'][]])[]> = {
  'column.waiting':  [['column.counting', []], ['column.counting', []], ['column.waiting', [A, S]], ['column.waiting', [A, S]], ['speak.asking', ['ask', S]], ['paused', [A]], ['column.waiting', []], ['column.waiting', [A, S]], ['column.waiting', []]],
  'column.counting': [['column.counting', []], ['column.counting', []], ['column.counting', []], ['column.rejected', [A, S]], ['column.counting', []], ['paused', [A]], ['column.counting', []], ['column.waiting', [A, S]], ['column.counting', []]],
  'column.asking':   [['column.counting', []], ['column.counting', []], ['row.waiting', [A]], ['column.rejected', [A, S]], ['column.asking', []], ['paused', [A]], ['column.asking', []], ['column.waiting', [A, S]], ['column.asking', []]],
  'column.rejected': [['column.counting', []], ['column.counting', []], ['column.waiting', [A, S]], ['column.rejected', []], ['speak.asking', ['ask', S]], ['paused', [A]], ['column.rejected', []], ['column.waiting', [A, S]], ['column.rejected', []]],
  'phrase.asking':   [['column.counting', []], ['column.counting', []], ['speak.asking', ['ask', S]], ['column.rejected', [A, S]], ['speak.asking', ['ask', S]], ['paused', [A]], ['phrase.asking', []], ['column.waiting', [A, S]], ['phrase.asking', []]],
  'row.waiting':     [['row.counting', []], ['row.counting', []], ['row.waiting', []], ['column.waiting', [A]], ['speak.asking', ['ask', S]], ['paused', [A]], ['row.waiting', []], ['column.waiting', [A, S]], ['row.waiting', []]],
  'row.counting':    [['row.counting', []], ['row.counting', []], ['row.counting', []], ['row.rejected', [A, S]], ['row.counting', []], ['paused', [A]], ['row.counting', []], ['column.waiting', [A, S]], ['row.counting', []]],
  'row.asking':      [['row.counting', []], ['row.counting', []], ['column.waiting', [A, S]], ['row.rejected', [A, S]], ['row.asking', []], ['paused', [A]], ['row.asking', []], ['column.waiting', [A, S]], ['row.asking', []]],
  'row.rejected':    [['row.counting', []], ['row.counting', []], ['row.rejected', []], ['row.rejected', []], ['speak.asking', ['ask', S]], ['paused', [A]], ['row.rejected', []], ['column.waiting', [A, S]], ['row.rejected', []]],
  'speak.asking':    [['speak.asking', []], ['speak.asking', []], ['speaking', ['speak']], ['column.waiting', ['stopSpeaking', A]], ['speak.asking', []], ['paused', [A]], ['speak.asking', []], ['column.waiting', [A, S]], ['speak.asking', []]],
  speaking:          [['column.counting', []], ['column.counting', []], ['speaking', ['speak']], ['column.waiting', ['stopSpeaking', A]], ['speaking', []], ['paused', ['stopSpeaking', A]], ['speaking', []], ['column.waiting', [A, S]], ['clear.asking', ['ask', S]]],
  'clear.asking':    [['column.counting', []], ['column.counting', []], ['column.waiting', [A, S]], ['column.waiting', [A, S]], ['speak.asking', ['ask', S]], ['paused', [A]], ['clear.asking', []], ['column.waiting', [A, S]], ['clear.asking', []]],
  paused:            [['paused', []], ['paused', []], ['paused', []], ['paused', []], ['paused', []], ['column.waiting', [A]], ['paused', []], ['paused', []], ['paused', []]],
};

/** The only pairs that change the text (everything else must leave the sentence as it was). */
const TEXT_CHANGES = new Set([
  'column.waiting NOD', // a space
  'column.waiting SHAKE', // undo
  'column.rejected NOD', // a space
  'row.asking NOD', // the letter W
  'phrase.asking NOD', // the phrase replaces his text (spec 019, R6)
  'clear.asking NOD', // a new sentence: cleared (spec 008, R3)
  // a tap on "A" adds it in every state but the pause (spec 007, R3)
  ...STATE_NAMES.filter((name) => name !== 'paused').map((name) => `${name} TOUCH`),
]);

describe('the transition table (R4)', () => {
  it('has an entry for every state and every signal: 13 × 9 = 117', () => {
    expect(Object.keys(TRANSITIONS).sort()).toEqual([...STATE_NAMES].sort());
    for (const name of STATE_NAMES) {
      expect(Object.keys(TRANSITIONS[name]).sort(), name).toEqual([...SIGNAL_TYPES].sort());
    }
    expect(STATE_NAMES.length * SIGNAL_TYPES.length).toBe(117);
  });

  for (const name of STATE_NAMES) {
    SIGNAL_TYPES.forEach((type, i) => {
      const [expectedName, expectedEffects] = TABLE[name][i];
      it(`${name} + ${type} → ${expectedName} [${expectedEffects.join(', ')}]`, () => {
        const before = fixture(name);
        const { state, effects } = next(before, signal(type, 500), config);
        expect(state.name).toBe(expectedName);
        expect(effects.map((e) => e.type)).toEqual(expectedEffects);
        expect(state.sentence.text !== before.sentence.text).toBe(
          TEXT_CHANGES.has(`${name} ${type}`),
        );
      });
    });
  }

  it('never mutates the state it was given', () => {
    for (const name of STATE_NAMES) {
      for (const type of SIGNAL_TYPES) {
        const before = fixture(name);
        const copy = JSON.parse(JSON.stringify(before));
        next(before, signal(type, 5000), config);
        expect(JSON.parse(JSON.stringify(before)), `${name} ${type}`).toEqual(copy);
      }
    }
  });
});

/** The defaults of spec 009: no questions or notices said, a pause moves on (R1, R3). */
const quiet: CountingConfig = { ...config, speakPrompts: false, confirmByNod: false };

describe('the transition table with the defaults (spec 009, R3)', () => {
  // The same table, but only the chosen letter is said: a nod on the row ("W") and a tap on "A".
  const LETTER_SAID = new Set([
    'row.asking NOD',
    ...STATE_NAMES.filter((name) => name !== 'paused').map((name) => `${name} TOUCH`),
  ]);
  for (const name of STATE_NAMES) {
    SIGNAL_TYPES.forEach((type, i) => {
      const [expectedName, withPrompts] = TABLE[name][i];
      const expected = LETTER_SAID.has(`${name} ${type}`)
        ? withPrompts
        : withPrompts.filter((t) => t !== S);
      it(`${name} + ${type} → ${expectedName} [${expected.join(', ')}]`, () => {
        const { state, effects } = next(fixture(name), signal(type, 500), quiet);
        expect(state.name).toBe(expectedName);
        expect(effects.map((e) => e.type)).toEqual(expected);
      });
    });
  }
});

/** Runs signals from a state and returns the end state and every effect. */
function run(signals: Signal[], from = initialState(), cfg = config) {
  let state = from;
  const effects: Effect[] = [];
  for (const s of signals) {
    const t = next(state, s, cfg);
    state = t.state;
    effects.push(...t.effects);
  }
  return { state, effects };
}
const B = signal('BLINK');
const H = signal('HAND');
const N = signal('NOD');
const X = signal('SHAKE');
const R = signal('RIGHT');
const P = signal('PAUSE');
const T = (now: number) => signal('TICK', now);
const texts = (effects: Effect[], type: Effect['type']) =>
  effects.filter((e) => e.type === type).map((e) => ('message' in e ? e.message : e));

describe('counting paths (R5)', () => {
  it('hand + 2 blinks = 7, asked only after the pause, then row 3: W is added and said', () => {
    let { state } = run([T(0), H, T(300), B, T(600), B]);
    let effects: Effect[];
    expect(total(state)).toBe(7);
    ({ state } = run([T(600 + ASK_AFTER.default - 1)], state));
    expect(state.name).toBe('column.counting'); // not yet
    ({ state, effects } = run([T(600 + ASK_AFTER.default)], state));
    expect(state.name).toBe('column.asking');
    expect(texts(effects, 'ask')).toEqual([{ key: 'counting.askColumn', params: { n: 7 } }]);
    expect(prompt(state)).toEqual({ key: 'counting.askColumn', params: { n: 7 } });
    expect(pointer(state, board)).toEqual({ column: 7, row: null });

    ({ state } = run([N, T(5000), B, B, B, T(9000)], state));
    expect(state.name).toBe('row.asking');
    expect(pointer(state, board)).toEqual({ column: 7, row: 3 });
    ({ state, effects } = run([N], state));
    expect(state.sentence.text).toBe('W');
    expect(texts(effects, 'say')).toEqual([{ key: 'counting.letter', params: { letter: 'W' } }]);
    expect(state.notice).toEqual({ key: 'counting.added', params: { letter: 'W' } });
    expect(state.name).toBe('column.waiting');
  });

  it('a new blink before the question resets the pause', () => {
    const { state } = run([T(0), B, T(1000), B, T(2100)]);
    expect(state.name).toBe('column.counting');
    expect(run([T(2200)], state).state.name).toBe('column.asking');
  });

  it('uses askAfterMs from the config', () => {
    const quick = { ...config, askAfterMs: ASK_AFTER.min };
    expect(run([T(0), B, T(500)], initialState(), quick).state.name).toBe('column.asking');
    expect(run([T(0), B, T(500)]).state.name).toBe('column.counting');
  });

  it('10 is past the board: rejected with the reason, shown and said', () => {
    const { state, effects } = run([T(0), H, H, T(2000)]);
    expect(state.name).toBe('column.rejected');
    expect(state.notice).toEqual({ key: 'counting.noColumn', params: { n: 10 } });
    expect(texts(effects, 'say')).toEqual([{ key: 'counting.noColumn', params: { n: 10 } }]);
  });

  it('an empty cell (column 7, row 5) is rejected', () => {
    const atRow = { ...initialState(), name: 'row.waiting', column: 7 } as const;
    const { state } = run([T(0), H, T(2000)], atRow);
    expect(state.name).toBe('row.rejected');
    expect(state.notice).toEqual({ key: 'counting.emptyCell', params: { column: 7, row: 5 } });
  });

  it('a double shake after "Kolumna 7?" (Column 7?) keeps the sentence (review of T4)', () => {
    const from = { ...fixture('column.asking') };
    const { state } = run([X, X, X], from);
    expect(state.name).toBe('column.rejected');
    expect(state.sentence.text).toBe('AB');
  });

  it('a shake while waiting for a column undoes the last letter; with no history it says so', () => {
    const { state } = run([X], fixture('column.waiting'));
    expect(state.sentence.text).toBe('A');
    const fresh = { ...initialState(createSentence('START')) };
    const result = run([X], fresh);
    expect(result.state.sentence.text).toBe('START');
    expect(result.state.notice).toEqual({ key: 'counting.nothingToUndo' });
  });

  it('a shake while waiting for a row goes back to the columns', () => {
    const { state } = run([X], fixture('row.waiting'));
    expect(state.name).toBe('column.waiting');
    expect(state.column).toBeNull();
  });
});

describe('the row cue: a tune when the column is taken (spec 012, R7)', () => {
  const cues = (effects: Effect[]) => effects.filter((e) => e.type === 'cue');
  const ROW_READY = { type: 'cue', cue: 'rowReady' };

  it('the pause takes the column: one tune, then he gives the row', () => {
    const { state, effects } = run([T(0), B, T(100), B, T(1500)], initialState(), {
      ...quiet,
      rowCue: true,
    });
    expect(state.name).toBe('row.waiting');
    expect(state.column).toBe(2);
    expect(cues(effects)).toEqual([ROW_READY]);
  });

  it('a nod on "Kolumna 2?" (Column 2?) takes the column: the tune comes after the nod, not with the question', () => {
    const cfg = { ...config, rowCue: true };
    const asked = run([T(0), B, T(100), B, T(1500)], initialState(), cfg);
    expect(asked.state.name).toBe('column.asking');
    expect(cues(asked.effects)).toEqual([]);
    const { state, effects } = run([N], asked.state, cfg);
    expect(state.name).toBe('row.waiting');
    expect(cues(effects)).toEqual([ROW_READY]);
  });

  it('no tune after the row (the letter is said instead), for a rejected column, or for a tap', () => {
    const cfg = { ...quiet, rowCue: true };
    const column = run([T(0), B, T(1500)], initialState(), cfg);
    const row = run([T(2000), B, T(3500)], column.state, cfg);
    expect(row.state.sentence.text).not.toBe('');
    expect(cues(row.effects)).toEqual([]);
    const tooMany = run([T(0), H, T(100), H, T(1500)], initialState(), cfg);
    expect(tooMany.state.name).not.toBe('row.waiting');
    expect(cues(tooMany.effects)).toEqual([]);
    expect(cues(run([signal('TOUCH')], initialState(), cfg).effects)).toEqual([]);
  });

  it('off: the column is taken without a tune', () => {
    const { state, effects } = run([T(0), B, T(1500)], initialState(), quiet);
    expect(state.name).toBe('row.waiting');
    expect(cues(effects)).toEqual([]);
  });
});

describe('the space: a nod without a number (author, 2026-11-13)', () => {
  it('adds a space, says the word just finished (spec 008, R2), and a shake removes it', () => {
    const first = run([N], fixture('column.waiting'));
    let { state } = first;
    const { effects } = first;
    expect(state.sentence.text).toBe('AB ');
    expect(texts(effects, 'say')).toEqual([{ key: 'counting.letter', params: { letter: 'AB' } }]);
    expect(state.notice).toEqual({ key: 'counting.space' });
    ({ state } = run([X], state));
    expect(state.sentence.text).toBe('AB');
    expect(state.notice).toEqual({ key: 'counting.undoneSpace' });
  });

  it('adds nothing on an empty sentence or after a space, and says so', () => {
    expect(run([N]).state.notice).toEqual({ key: 'counting.spaceNotAdded' });
    expect(run([N]).state.sentence.text).toBe('');
    const { state } = run([N, N], fixture('column.waiting'));
    expect(state.sentence.text).toBe('AB ');
    expect(state.notice).toEqual({ key: 'counting.spaceNotAdded' });
  });

  it('a nod while giving a row adds nothing', () => {
    expect(run([N], fixture('row.waiting')).state.sentence.text).toBe('AB');
  });
});

describe('reading aloud: never without a nod (R5)', () => {
  it('head right asks first; a shake goes back to writing, and nothing was read', () => {
    const { state, effects } = run([R, X], fixture('column.waiting'));
    expect(state.name).toBe('column.waiting');
    expect(effects.some((e) => e.type === 'speak')).toBe(false);
    expect(state.sentence.text).toBe('AB');
  });

  it('head right, then a nod reads the sentence', () => {
    const { state, effects } = run([R, N], fixture('column.waiting'));
    expect(state.name).toBe('speaking');
    expect(effects.filter((e) => e.type === 'speak')).toEqual([{ type: 'speak', text: 'AB' }]);
  });

  it('an empty sentence is not offered for reading', () => {
    const { state } = run([R]);
    expect(state.name).toBe('column.waiting');
    expect(state.notice).toEqual({ key: 'counting.nothingToSpeak' });
  });

  it('only a nod or a shake answers "Przeczytać na głos?" (Read it aloud?); blinks are ignored', () => {
    const { state } = run([R, B, H, T(9000)], fixture('column.waiting'));
    expect(state.name).toBe('speak.asking');
  });
});

describe('pause (R5)', () => {
  it('ignores every signal except PAUSE, and goes back where it was', () => {
    let { state } = run([P], fixture('row.waiting'));
    expect(state.name).toBe('paused');
    ({ state } = run([B, H, N, X, R, T(9000)], state));
    expect(state.name).toBe('paused');
    expect(state.sentence.text).toBe('AB');
    ({ state } = run([P], state));
    expect(state.name).toBe('row.waiting');
    expect(state.column).toBe(7);
  });

  it('a pause in the middle of a number discards it, and stops reading aloud', () => {
    expect(run([P, P], fixture('column.counting')).state.parts).toEqual([]);
    expect(run([P], fixture('speaking')).effects[0]).toEqual({ type: 'stopSpeaking' });
  });
});

describe('time comes only from TICK (R6)', () => {
  it('a TICK earlier than the last one does not move time back', () => {
    const { state } = run([T(5000), T(100)]);
    expect(state.now).toBe(5000);
  });

  it('without a TICK, the question never comes', () => {
    const { state } = run([B, B]);
    expect(state.name).toBe('column.counting');
  });
});

describe('action cells on a board', () => {
  const actions: Board = {
    ...board,
    columns: ['1', '2', '3'],
    rows: ['1'],
    cells: [
      [
        { type: 'action', value: 'space' },
        { type: 'action', value: 'delete' },
        { type: 'action', value: 'speak' },
      ],
    ],
  };
  const cfg = { ...config, board: actions };
  it('space and delete change the text; speak asks first', () => {
    const one = (column: number) =>
      run([N], { ...fixture('column.waiting'), name: 'row.asking', column, parts: [1] }, cfg);
    expect(one(1).state.sentence.text).toBe('AB ');
    expect(one(2).state.sentence.text).toBe('A');
    expect(one(3).state.name).toBe('speak.asking');
  });
});

describe('texts (Transloco keys)', () => {
  const lookup = (tree: Record<string, unknown>, key: string) =>
    key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], tree);

  it('every key the machine uses exists in en.json and pl.json, with the same parameters', () => {
    for (const key of COUNTING_KEYS) {
      const params = (text: unknown) =>
        [...String(text).matchAll(/{{(\w+)}}/g)].map((m) => m[1]).sort();
      const plText = lookup(pl, key);
      const enText = lookup(en, key);
      expect(typeof plText, `pl ${key}`).toBe('string');
      expect(typeof enText, `en ${key}`).toBe('string');
      expect(params(plText), key).toEqual(params(enText));
    }
  });
});

describe('touch: a tap on the screen (spec 007, R3)', () => {
  const tap = (target: Extract<Signal, { type: 'TOUCH' }>['target']): Signal => ({
    type: 'TOUCH',
    target,
  });
  const cell = (column: number, row: number) => tap({ kind: 'cell', column, row });

  it('a cell adds its value and says it, with no nod, and drops the number being given', () => {
    const { state, effects } = run([H, B, cell(7, 3)]);
    expect(state.sentence.text).toBe('W');
    expect(state.name).toBe('column.waiting');
    expect(state.parts).toEqual([]);
    expect(state.column).toBeNull();
    expect(texts(effects, 'say')).toEqual([{ key: 'counting.letter', params: { letter: 'W' } }]);
  });

  it('works in the middle of the row step, and while the question about reading aloud waits', () => {
    expect(run([cell(1, 1)], fixture('row.asking')).state.sentence.text).toBe('ABA');
    expect(run([cell(1, 1)], fixture('speak.asking')).state.name).toBe('column.waiting');
  });

  it('an empty cell changes nothing', () => {
    const before = fixture('column.waiting');
    const { state, effects } = run([cell(7, 5)], before);
    expect(state).toEqual(before);
    expect(effects).toEqual([]);
  });

  it('undo removes the last thing this session added, and says so', () => {
    const { state, effects } = run([cell(1, 1), cell(2, 1), tap({ kind: 'undo' })]);
    expect(state.sentence.text).toBe('A');
    expect(texts(effects, 'announce').at(-1)).toEqual({
      key: 'counting.undone',
      params: { text: 'B' },
    });
  });

  it('clear (sent after the dialog) empties the sentence at once, and undo brings it back', () => {
    const cleared = run([tap({ kind: 'clear' })], fixture('column.waiting')).state;
    expect(cleared.sentence.text).toBe('');
    expect(cleared.notice).toEqual({ key: 'counting.cleared' });
    expect(run([tap({ kind: 'undo' })], cleared).state.sentence.text).toBe('AB');
  });

  it('speak reads the sentence at once; with nothing to read it only says so', () => {
    const { state, effects } = run([tap({ kind: 'speak' })], fixture('column.counting'));
    expect(state.name).toBe('speaking');
    expect(effects).toContainEqual({ type: 'speak', text: 'AB' });
    const empty = run([tap({ kind: 'speak' })]);
    expect(empty.state.name).toBe('column.waiting');
    expect(empty.effects.some((e) => e.type === 'speak')).toBe(false);
  });

  it('while reading aloud, a cell goes on writing and speak reads again', () => {
    expect(run([cell(1, 1)], fixture('speaking')).state.sentence.text).toBe('ABA');
    expect(run([tap({ kind: 'speak' })], fixture('speaking')).effects).toEqual([
      { type: 'speak', text: 'AB' },
    ]);
  });

  it('space (the button) follows the nod rule: after a word only, never twice', () => {
    expect(run([tap({ kind: 'space' })], fixture('row.counting')).state.sentence.text).toBe('AB ');
    const twice = run([tap({ kind: 'space' }), tap({ kind: 'space' })], fixture('column.waiting'));
    expect(twice.state.sentence.text).toBe('AB ');
    expect(texts(twice.effects, 'announce').at(-1)).toEqual({ key: 'counting.spaceNotAdded' });
    expect(run([tap({ kind: 'space' })]).state.sentence.text).toBe('');
  });

  it('a pause ignores every tap', () => {
    const before = fixture('paused');
    for (const target of [
      { kind: 'cell', column: 1, row: 1 },
      { kind: 'undo' },
      { kind: 'clear' },
      { kind: 'speak' },
      { kind: 'space' },
    ] as const) {
      const { state, effects } = run([tap(target)], before);
      expect(state).toEqual(before);
      expect(effects).toEqual([]);
    }
  });

  it('a speak action cell reads at once, like the button', () => {
    const speakBoard: Board = {
      ...board,
      columns: ['1'],
      rows: ['1'],
      cells: [[{ type: 'action', value: 'speak' }]],
    };
    const { state } = run([cell(1, 1)], fixture('column.waiting'), {
      ...config,
      board: speakBoard,
    });
    expect(state.name).toBe('speaking');
  });
});

describe('the letter by ear: the defaults (spec 009)', () => {
  const later = (ms: number) => T(ms);

  it('a pause after the column moves on to the row; a pause after the row adds the letter and says only it (R1, R3)', () => {
    // hand + 2 blinks = column 7, a pause; 3 blinks = row 3, a pause: W
    let { state, effects } = run(
      [T(0), H, T(100), B, T(200), B, later(200 + ASK_AFTER.default)],
      initialState(),
      quiet,
    );
    expect(state.name).toBe('row.waiting');
    expect(state.column).toBe(7);
    expect(texts(effects, 'say')).toEqual([]);
    const at = 200 + ASK_AFTER.default;
    ({ state, effects } = run(
      [B, T(at + 100), B, T(at + 200), B, later(at + 200 + ASK_AFTER.default)],
      state,
      quiet,
    ));
    expect(state.name).toBe('column.waiting');
    expect(state.sentence.text).toBe('W');
    expect(texts(effects, 'say')).toEqual([{ key: 'counting.letter', params: { letter: 'W' } }]);
    expect(effects.some((e) => e.type === 'ask')).toBe(false);
  });

  it('a shake right after the letter undoes it, silently; blinks right after it start the next letter (R2)', () => {
    const withA = { ...initialState(append(createSentence(), 'A')) };
    const undone = run([X], withA, quiet);
    expect(undone.state.sentence.text).toBe('');
    expect(texts(undone.effects, 'say')).toEqual([]);
    const nextLetter = run([B], withA, quiet);
    expect(nextLetter.state.name).toBe('column.counting');
    expect(nextLetter.state.sentence.text).toBe('A');
  });

  it('a shake while he gives the row goes back to the columns: the letter starts over (R2)', () => {
    const giving = {
      ...initialState(),
      name: 'row.counting' as const,
      column: 7,
      parts: [1] as (1 | 5)[],
      lastCountAt: 0,
    };
    const { state } = run([X], giving, quiet);
    expect(state.name).toBe('row.rejected');
    expect(run([X], { ...giving, name: 'row.waiting', parts: [] }, quiet).state.name).toBe(
      'column.waiting',
    );
  });

  it('a number with no column is rejected without a word; it is shown and announced (R3)', () => {
    const { state, effects } = run(
      [T(0), H, T(100), H, later(100 + ASK_AFTER.default)],
      initialState(),
      quiet,
    );
    expect(state.name).toBe('column.rejected');
    expect(texts(effects, 'announce')).toEqual([{ key: 'counting.noColumn', params: { n: 10 } }]);
    expect(texts(effects, 'say')).toEqual([]);
  });
});

describe('favorite phrases (spec 019)', () => {
  const phrases = ['Pić', 'Pić herbatę', 'Zmień pozycję'];
  const on: CountingConfig = { ...config, phrases, phrasePauseMs: 2500 };
  const typed = (text: string) => initialState(append(createSentence(), text));
  /** TICKs from `from` to `to` in steps of 100 ms, as the service sends them. */
  const ticks = (from: number, to: number) => {
    const out: Signal[] = [];
    for (let t = from; t <= to; t += 100) out.push(T(t));
    return out;
  };
  const say = (effects: Effect[]) => effects.filter((e) => e.type === 'say');

  it('offers the one phrase after the pause, asked aloud in the board language whatever speakPrompts is (R3, R4)', () => {
    const before = run(ticks(0, 2400), typed('ZM'), { ...on, speakPrompts: false }).state;
    expect(before.name).toBe('column.waiting'); // not yet
    const { state, effects } = run(ticks(2500, 2600), before, { ...on, speakPrompts: false });
    expect(state.name).toBe('phrase.asking');
    expect(state.offer).toBe('Zmień pozycję');
    expect(prompt(state)).toEqual({
      key: 'counting.askPhrase',
      params: { phrase: 'Zmień pozycję' },
    });
    expect(say(effects)).toEqual([
      {
        type: 'say',
        message: { key: 'counting.askPhrase', params: { phrase: 'Zmień pozycję' } },
        inBoardLanguage: true,
      },
    ]);
    // The offer waits for his answer: no more effects with time.
    expect(run(ticks(2700, 60_000), state, on).effects).toEqual([]);
  });

  it('nothing with the switch off, one letter, or two phrases that fit (R1, R3)', () => {
    expect(run(ticks(0, 10_000), typed('ZM')).state.name).toBe('column.waiting');
    expect(run(ticks(0, 10_000), typed('Z'), on).state.name).toBe('column.waiting');
    expect(run(ticks(0, 10_000), typed('PI'), on).state.name).toBe('column.waiting');
    // "PIC H": a plain C stands for Ć; one phrase is left.
    expect(run(ticks(0, 3000), typed('PIC H'), on).state.offer).toBe('Pić herbatę');
  });

  it('any signal restarts the pause (R4)', () => {
    let { state } = run(ticks(0, 2000), typed('ZM'), on);
    ({ state } = run([B, T(2100), X, ...ticks(2200, 4600)], state, on)); // a blink, then no: back at the columns
    expect(state.name).toBe('column.rejected');
    ({ state } = run(ticks(4700, 4800), state, on));
    expect(state.name).toBe('phrase.asking');
  });

  it('a nod takes the phrase in upper case as one step and asks to read it; nothing is read yet (R6)', () => {
    const asked = run(ticks(0, 2600), typed('ZM'), on).state;
    const { state, effects } = run([N], asked, on);
    expect(state.sentence.text).toBe('ZMIEŃ POZYCJĘ');
    expect(state.name).toBe('speak.asking');
    expect(effects.some((e) => e.type === 'speak')).toBe(false);
    // A shake at "Przeczytać na głos?" (Read it aloud?) goes back to the columns with the phrase; one more brings ZM back.
    const back = run([X], state, on).state;
    expect(back.sentence.text).toBe('ZMIEŃ POZYCJĘ');
    const undone = run([X], back, on);
    expect(undone.state.sentence.text).toBe('ZM');
    expect(undone.state.notice).toEqual({ key: 'counting.undonePhrase' });
    // Undone, it is not offered again for this sentence (R5, R8).
    expect(run(ticks(10_000, 20_000), undone.state, on).state.name).toBe('column.waiting');
  });

  it('a shake refuses it; a second shake changes nothing; it is not offered again (R5, R6)', () => {
    const asked = run(ticks(0, 2600), typed('ZM'), on).state;
    let { state } = run([X], asked, on);
    expect(state.name).toBe('column.rejected');
    expect(state.sentence.text).toBe('ZM');
    ({ state } = run([X], state, on));
    expect(state.sentence.text).toBe('ZM');
    expect(run(ticks(3000, 20_000), state, on).state.name).toBe('column.rejected');
  });

  it('refused phrases are forgotten once the sentence is read aloud (R5)', () => {
    const asked = run(ticks(0, 2600), typed('ZM'), on).state;
    const refused = run([X], asked, on).state;
    const read = run([R, N], refused, on).state;
    expect(read.refused).toEqual([]);
  });

  it('a blink goes on: the offer is dropped and the blink counts for the column (R6)', () => {
    const asked = run(ticks(0, 2600), typed('ZM'), on).state;
    const { state } = run([B], asked, on);
    expect(state.name).toBe('column.counting');
    expect(total(state)).toBe(1);
    expect(state.offer).toBeNull();
    expect(state.sentence.text).toBe('ZM');
  });

  it('no second offer for the same text (R4)', () => {
    const asked = run(ticks(0, 2600), typed('ZM'), on).state;
    // He blinks a column, then refuses the number: the same text, no new offer.
    const { state } = run([B, X, ...ticks(3000, 20_000)], asked, on);
    expect(state.name).toBe('column.rejected');
  });

  it('a tap on the offered phrase takes it like a nod (R7)', () => {
    const asked = run(ticks(0, 2600), typed('ZM'), on).state;
    const tap: Signal = { type: 'TOUCH', target: { kind: 'phrase', phrase: 'Zmień pozycję' } };
    const { state } = run([tap], asked, on);
    expect(state.sentence.text).toBe('ZMIEŃ POZYCJĘ');
    expect(state.name).toBe('speak.asking');
  });
});
