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
const config: CountingConfig = { board, askAfterMs: ASK_AFTER.default, speakQuestions: true };

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
    default:
      return base;
  }
}

const A = 'announce';
const S = 'say';
// prettier-ignore
/** Expected next state and effect types, per signal in SIGNAL_TYPES order: BLINK HAND NOD SHAKE RIGHT PAUSE TICK TOUCH. */
const TABLE: Record<StateName, readonly (readonly [StateName, readonly Effect['type'][]])[]> = {
  'column.waiting':  [['column.counting', []], ['column.counting', []], ['column.waiting', [A, S]], ['column.waiting', [A]], ['speak.asking', ['ask', S]], ['paused', [A]], ['column.waiting', []], ['column.waiting', [A, S]]],
  'column.counting': [['column.counting', []], ['column.counting', []], ['column.counting', []], ['column.rejected', [A, S]], ['column.counting', []], ['paused', [A]], ['column.counting', []], ['column.waiting', [A, S]]],
  'column.asking':   [['column.counting', []], ['column.counting', []], ['row.waiting', [A]], ['column.rejected', [A, S]], ['column.asking', []], ['paused', [A]], ['column.asking', []], ['column.waiting', [A, S]]],
  'column.rejected': [['column.counting', []], ['column.counting', []], ['column.waiting', [A, S]], ['column.rejected', []], ['speak.asking', ['ask', S]], ['paused', [A]], ['column.rejected', []], ['column.waiting', [A, S]]],
  'row.waiting':     [['row.counting', []], ['row.counting', []], ['row.waiting', []], ['column.waiting', [A]], ['speak.asking', ['ask', S]], ['paused', [A]], ['row.waiting', []], ['column.waiting', [A, S]]],
  'row.counting':    [['row.counting', []], ['row.counting', []], ['row.counting', []], ['row.rejected', [A, S]], ['row.counting', []], ['paused', [A]], ['row.counting', []], ['column.waiting', [A, S]]],
  'row.asking':      [['row.counting', []], ['row.counting', []], ['column.waiting', [A, S]], ['row.rejected', [A, S]], ['row.asking', []], ['paused', [A]], ['row.asking', []], ['column.waiting', [A, S]]],
  'row.rejected':    [['row.counting', []], ['row.counting', []], ['row.rejected', []], ['row.rejected', []], ['speak.asking', ['ask', S]], ['paused', [A]], ['row.rejected', []], ['column.waiting', [A, S]]],
  'speak.asking':    [['speak.asking', []], ['speak.asking', []], ['speaking', ['speak']], ['column.waiting', ['stopSpeaking', A]], ['speak.asking', []], ['paused', [A]], ['speak.asking', []], ['column.waiting', [A, S]]],
  speaking:          [['column.counting', []], ['column.counting', []], ['speaking', ['speak']], ['column.waiting', ['stopSpeaking', A]], ['speaking', []], ['paused', ['stopSpeaking', A]], ['speaking', []], ['column.waiting', [A, S]]],
  paused:            [['paused', []], ['paused', []], ['paused', []], ['paused', []], ['paused', []], ['column.waiting', [A]], ['paused', []], ['paused', []]],
};

/** The only pairs that change the text (everything else must leave the sentence as it was). */
const TEXT_CHANGES = new Set([
  'column.waiting NOD', // a space
  'column.waiting SHAKE', // undo
  'column.rejected NOD', // a space
  'row.asking NOD', // the letter W
  // a tap on "A" adds it in every state but the pause (spec 007, R3)
  ...STATE_NAMES.filter((name) => name !== 'paused').map((name) => `${name} TOUCH`),
]);

describe('the transition table (R4)', () => {
  it('has an entry for every state and every signal: 11 × 8 = 88', () => {
    expect(Object.keys(TRANSITIONS).sort()).toEqual([...STATE_NAMES].sort());
    for (const name of STATE_NAMES) {
      expect(Object.keys(TRANSITIONS[name]).sort(), name).toEqual([...SIGNAL_TYPES].sort());
    }
    expect(STATE_NAMES.length * SIGNAL_TYPES.length).toBe(88);
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

describe('the space: a nod without a number (author, 2026-11-13)', () => {
  it('adds a space, says "Spacja" (Space), and a shake removes it', () => {
    const first = run([N], fixture('column.waiting'));
    let { state } = first;
    const { effects } = first;
    expect(state.sentence.text).toBe('AB ');
    expect(texts(effects, 'say')).toEqual([{ key: 'counting.space' }]);
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
