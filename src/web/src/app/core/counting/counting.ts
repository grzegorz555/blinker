// The counting machine (spec 006, R4–R6; docs/interaction-model.md, mode B). Plain TypeScript, no Angular imports.
//
// Blinker plays the caregiver's role: he gives a number (a long blink = 1, a look at his hand = 5), Blinker asks
// "Kolumna 7?" (Column 7?), he nods (yes) or shakes his head (no); then the row the same way, and the letter is added and said.
//
// - `next(state, signal, config)` is a pure function: the same input always gives the same output, and it never reads
//   the clock or sets a timer. Time comes in only as the TICK signal (R6).
// - TRANSITIONS lists every (state, signal) pair explicitly. Its type is a Record over all states and all signals, so
//   a missing pair is a compile error; nothing falls through to a default (docs/knowledge/no-depends-on-context.md).
// - Effects are data (what to ask, say, announce or read aloud); the Angular service carries them out.
// - Texts are Transloco keys with parameters, so the machine has no language.
import { cellAt, type Board, type Cell } from '../boards/board';
import {
  applyCell,
  append,
  canUndo,
  clear,
  createSentence,
  undo,
  type Sentence,
  type SentenceStep,
} from '../sentence/sentence';

export const STATE_NAMES = [
  'column.waiting',
  'column.counting',
  'column.asking',
  'column.rejected',
  'row.waiting',
  'row.counting',
  'row.asking',
  'row.rejected',
  'speak.asking',
  'speaking',
  'paused',
] as const;
export type StateName = (typeof STATE_NAMES)[number];

export const SIGNAL_TYPES = [
  'BLINK',
  'HAND',
  'NOD',
  'SHAKE',
  'RIGHT',
  'PAUSE',
  'TICK',
  'TOUCH',
] as const;
export type SignalType = (typeof SIGNAL_TYPES)[number];

/**
 * What a tap chose (spec 007, R3): a board cell (1-based, like the numbers he gives) or one of the sentence actions.
 * "clear" is sent only after the confirmation dialog, so the machine clears at once.
 */
export type TouchTarget =
  | { readonly kind: 'cell'; readonly column: number; readonly row: number }
  | { readonly kind: 'undo' | 'clear' | 'speak' };

/**
 * His signals (stages 3–4 detect them on the face; until then buttons and keys), TICK for time, and TOUCH for a tap
 * on the screen (spec 007, R3): a deliberate choice by the person who taps, so it needs no nod.
 */
export type Signal =
  | { readonly type: Exclude<SignalType, 'TICK' | 'TOUCH'> }
  | { readonly type: 'TICK'; readonly now: number }
  | { readonly type: 'TOUCH'; readonly target: TouchTarget };

/** A text for the screen or the voice: a Transloco key with its parameters. */
export interface Message {
  readonly key: string;
  readonly params?: Readonly<Record<string, string | number>>;
}

export type Effect =
  /** A new question: show it and announce it (polite live region). */
  | { readonly type: 'ask'; readonly message: Message }
  /** Say a short text aloud (a question when speakQuestions is on, an added letter, "Spacja" (Space)). */
  | { readonly type: 'say'; readonly message: Message }
  /** Announce a change to screen readers, and show it as the notice. */
  | { readonly type: 'announce'; readonly message: Message }
  /** Read the sentence aloud: only after a nod on "Przeczytać na głos?" (Read it aloud?). */
  | { readonly type: 'speak'; readonly text: string }
  /** Stop reading aloud. */
  | { readonly type: 'stopSpeaking' };

export interface CountingConfig {
  readonly board: Board;
  /** How long Blinker waits after the last blink before it asks; 500–5000 ms (SC 2.2.1). */
  readonly askAfterMs: number;
  /** Say the questions aloud ("Kolumna 7?" (Column 7?)), not only show them. */
  readonly speakQuestions: boolean;
}

export const ASK_AFTER = { min: 500, max: 5000, default: 1200 } as const;

export interface CountingState {
  readonly name: StateName;
  /** The number being given, as he built it: [5, 1, 1] = hand + 2 blinks = 7. */
  readonly parts: readonly (1 | 5)[];
  /** The confirmed column while he gives the row. */
  readonly column: number | null;
  /** The time of the last BLINK or HAND, for the pause before the question. */
  readonly lastCountAt: number | null;
  /** The time of the last TICK. */
  readonly now: number;
  /** What happened last (a rejection and why, an added letter, a space), for the screen. */
  readonly notice: Message | null;
  /** Where to go back to when the pause ends. */
  readonly resume: StateName | null;
  readonly sentence: Sentence;
}

export interface Transition {
  readonly state: CountingState;
  readonly effects: readonly Effect[];
}

/** Every Transloco key the machine can use (each must be in en.json and pl.json). */
export const COUNTING_KEYS = [
  'counting.giveColumn',
  'counting.giveRow',
  'counting.counting',
  'counting.askColumn',
  'counting.askRow',
  'counting.rejectedNo',
  'counting.noColumn',
  'counting.noRow',
  'counting.emptyCell',
  'counting.added',
  'counting.letter',
  'counting.space',
  'counting.spaceNotAdded',
  'counting.undone',
  'counting.undoneSpace',
  'counting.nothingToUndo',
  'counting.deleted',
  'counting.cleared',
  'counting.backToColumns',
  'counting.askSpeak',
  'counting.nothingToSpeak',
  'counting.speaking',
  'counting.backToWriting',
  'counting.paused',
  'counting.resumed',
] as const;
type Key = (typeof COUNTING_KEYS)[number];

const msg = (key: Key, params?: Message['params']): Message => (params ? { key, params } : { key });

/** The machine at the start: waiting for a column, with an empty sentence (or a given one). */
export function initialState(sentence: Sentence = createSentence(), now = 0): CountingState {
  return {
    name: 'column.waiting',
    parts: [],
    column: null,
    lastCountAt: null,
    now,
    notice: null,
    resume: null,
    sentence,
  };
}

export const total = (state: Pick<CountingState, 'parts'>) =>
  state.parts.reduce((a, b) => a + b, 0);

/** The one entry point (R4). */
export function next(state: CountingState, signal: Signal, config: CountingConfig): Transition {
  const now = signal.type === 'TICK' ? Math.max(state.now, signal.now) : state.now;
  return TRANSITIONS[state.name][signal.type]({ ...state, now }, config, signal);
}

// ---- helpers ---------------------------------------------------------------------------------------------------

type Handler = (state: CountingState, config: CountingConfig, signal: Signal) => Transition;

const stay: Handler = (state) => ({ state, effects: [] });

const go = (
  state: CountingState,
  patch: Partial<CountingState>,
  effects: Effect[] = [],
): Transition => ({
  state: { ...state, ...patch },
  effects,
});

/** A question: shown and announced; also said aloud when speakQuestions is on. */
function ask(config: CountingConfig, message: Message): Effect[] {
  return config.speakQuestions
    ? [
        { type: 'ask', message },
        { type: 'say', message },
      ]
    : [{ type: 'ask', message }];
}

/** Start or continue giving a number. */
const count =
  (value: 1 | 5, step: 'column' | 'row', keep: boolean): Handler =>
  (state) =>
    go(state, {
      name: `${step}.counting`,
      parts: keep ? [...state.parts, value] : [value],
      lastCountAt: state.now,
      notice: null,
    });

/** What the last step of the sentence did, so undo can say what it removed. */
function describeUndo(step: SentenceStep | undefined): Message {
  if (!step) return msg('counting.nothingToUndo');
  const text = step.kind === 'append' ? step.text : step.removed;
  return step.kind === 'append' && text === ' '
    ? msg('counting.undoneSpace')
    : msg('counting.undone', { text: text.trim() || text });
}

function pause(resume: StateName, stopSpeaking = false): Handler {
  return (state) =>
    go(
      state,
      { name: 'paused', resume, parts: [], lastCountAt: null, notice: msg('counting.paused') },
      [
        ...(stopSpeaking ? [{ type: 'stopSpeaking' } as const] : []),
        { type: 'announce', message: msg('counting.paused') },
      ],
    );
}

// ---- column step -----------------------------------------------------------------------------------------------

/** A nod without a number while waiting for a column: a space, the end of a word (author, 2026-11-13). */
const nodForSpace: Handler = (state) => {
  const text = state.sentence.text;
  if (!text || text.endsWith(' ')) {
    const notice = msg('counting.spaceNotAdded');
    return go(state, { name: 'column.waiting', notice }, [
      { type: 'announce', message: notice },
      { type: 'say', message: notice },
    ]);
  }
  const notice = msg('counting.space');
  return go(state, { name: 'column.waiting', sentence: append(state.sentence, ' '), notice }, [
    { type: 'announce', message: notice },
    { type: 'say', message: notice },
  ]);
};

/** A shake while waiting for a column: undo the last step this session made (a letter, a space, a deletion). */
const shakeToUndo: Handler = (state) => {
  const notice = describeUndo(state.sentence.history.at(-1));
  return go(
    state,
    {
      name: 'column.waiting',
      sentence: canUndo(state.sentence) ? undo(state.sentence) : state.sentence,
      notice,
    },
    [{ type: 'announce', message: notice }],
  );
};

/** Head right: finish the sentence and ask before reading it aloud; nothing is read without a nod. */
const finish: Handler = (state, config) => {
  if (!state.sentence.text.trim()) {
    const notice = msg('counting.nothingToSpeak');
    return go(state, { notice }, [{ type: 'announce', message: notice }]);
  }
  return go(
    state,
    { name: 'speak.asking', parts: [], column: null, lastCountAt: null, notice: null },
    ask(config, msg('counting.askSpeak')),
  );
};

/** A number was refused: back to giving it, with the reason shown and said. */
function reject(state: CountingState, step: 'column' | 'row', notice: Message): Transition {
  return go(state, { name: `${step}.rejected`, parts: [], lastCountAt: null, notice }, [
    { type: 'announce', message: notice },
    { type: 'say', message: notice },
  ]);
}

/** After the pause with no new signal, ask about the number (or reject it with the reason). */
const askColumnWhenReady: Handler = (state, config, signal) => {
  if (state.lastCountAt === null || state.now - state.lastCountAt < config.askAfterMs)
    return stay(state, config, signal);
  const n = total(state);
  if (n > config.board.columns.length)
    return reject(state, 'column', msg('counting.noColumn', { n }));
  return go(state, { name: 'column.asking' }, ask(config, msg('counting.askColumn', { n })));
};

const askRowWhenReady: Handler = (state, config, signal) => {
  if (state.lastCountAt === null || state.now - state.lastCountAt < config.askAfterMs)
    return stay(state, config, signal);
  const n = total(state);
  const column = state.column ?? 0;
  if (n > config.board.rows.length) return reject(state, 'row', msg('counting.noRow', { n }));
  if (!cellAt(config.board, column, n)) {
    return reject(state, 'row', msg('counting.emptyCell', { column, row: n }));
  }
  return go(state, { name: 'row.asking' }, ask(config, msg('counting.askRow', { n })));
};

const confirmColumn: Handler = (state) => {
  const column = total(state);
  const notice = msg('counting.giveRow', { column });
  return go(state, { name: 'row.waiting', column, parts: [], lastCountAt: null, notice }, [
    { type: 'announce', message: notice },
  ]);
};

const shakeNumber =
  (step: 'column' | 'row'): Handler =>
  (state) =>
    reject(state, step, msg('counting.rejectedNo', { n: total(state) }));

// ---- row step --------------------------------------------------------------------------------------------------

const BACK = { name: 'column.waiting', column: null, parts: [], lastCountAt: null } as const;

/** A nod on "Wiersz N?" (Row N?): the cell is chosen. A letter or word is added and said; an action is carried out. */
const confirmRow: Handler = (state, config, signal) => {
  const column = state.column ?? 0;
  const cell = cellAt(config.board, column, total(state));
  if (!cell) return reject(state, 'row', msg('counting.emptyCell', { column, row: total(state) }));
  if (cell.type === 'action' && cell.value === 'speak') {
    return finish({ ...state, ...BACK }, config, signal);
  }
  return useCell({ ...state, ...BACK }, cell, config, signal);
};

/**
 * A chosen cell (by a nod on the row, or a tap): a letter or word is added and said; an action is carried out. The
 * state is already back at the columns.
 */
function useCell(
  state: CountingState,
  cell: Cell,
  config: CountingConfig,
  signal: Signal,
): Transition {
  if (cell.type === 'action' && cell.value === 'undo') return shakeToUndo(state, config, signal);
  const sentence = applyCell(state.sentence, cell);
  let notice: Message;
  let spoken: Message;
  if (cell.type === 'action') {
    notice =
      cell.value === 'space'
        ? msg('counting.space')
        : cell.value === 'clear'
          ? msg('counting.cleared')
          : msg('counting.deleted', { text: state.sentence.text.slice(-1) });
    spoken = notice;
  } else {
    notice = msg('counting.added', { letter: cell.value });
    spoken = msg('counting.letter', { letter: cell.value });
  }
  return go(state, { sentence, notice }, [
    { type: 'announce', message: notice },
    { type: 'say', message: spoken },
  ]);
}

const backToColumns: Handler = (state) => {
  const notice = msg('counting.backToColumns');
  return go(state, { name: 'column.waiting', column: null, parts: [], lastCountAt: null, notice }, [
    { type: 'announce', message: notice },
  ]);
};

// ---- speaking ----------------------------------------------------------------------------------------------------

const speakNow: Handler = (state) =>
  go(state, { name: 'speaking', notice: msg('counting.speaking') }, [
    { type: 'speak', text: state.sentence.text.trim() },
  ]);

const backToWriting: Handler = (state) => {
  const notice = msg('counting.backToWriting');
  return go(state, { name: 'column.waiting', notice }, [
    { type: 'stopSpeaking' },
    { type: 'announce', message: notice },
  ]);
};

// ---- pause -------------------------------------------------------------------------------------------------------

const resume: Handler = (state) => {
  const notice = msg('counting.resumed');
  return go(state, { name: state.resume ?? 'column.waiting', resume: null, notice }, [
    { type: 'announce', message: notice },
  ]);
};

// ---- touch (spec 007, R3) ---------------------------------------------------------------------------------------

/**
 * A tap in every state but the pause (spec 007, R3): the number being given is dropped and the machine waits for a
 * column again. While reading aloud, a tap goes on writing like a blink does; "Przeczytaj" (Read aloud) reads again. A tap is a deliberate choice, so it needs no nod.
 */
const touchWhileWriting: Handler = (state, config, signal) => {
  if (signal.type !== 'TOUCH') return stay(state, config, signal);
  const back = { ...state, ...BACK, notice: null };
  const { target } = signal;
  switch (target.kind) {
    case 'cell': {
      const cell = cellAt(config.board, target.column, target.row);
      if (!cell) return stay(state, config, signal); // empty cells are not buttons
      if (cell.type === 'action' && cell.value === 'speak') return speakIfAny(back, config, signal);
      return useCell(back, cell, config, signal);
    }
    case 'undo':
      return shakeToUndo(back, config, signal);
    case 'clear': {
      const notice = msg('counting.cleared');
      return go(back, { sentence: clear(state.sentence), notice }, [
        { type: 'announce', message: notice },
        { type: 'say', message: notice },
      ]);
    }
    case 'speak':
      return speakIfAny(back, config, signal);
  }
};

/** "Przeczytaj" (Read aloud) tapped: read the sentence at once, or say there is nothing to read. */
const speakIfAny: Handler = (state, config, signal) => {
  if (!state.sentence.text.trim()) {
    const notice = msg('counting.nothingToSpeak');
    return go(state, { notice }, [{ type: 'announce', message: notice }]);
  }
  return speakNow(state, config, signal);
};

// ---- the table: every state × every signal ---------------------------------------------------------------------

export const TRANSITIONS: Readonly<Record<StateName, Readonly<Record<SignalType, Handler>>>> = {
  'column.waiting': {
    BLINK: count(1, 'column', false),
    HAND: count(5, 'column', false),
    NOD: nodForSpace,
    SHAKE: shakeToUndo,
    RIGHT: finish,
    PAUSE: pause('column.waiting'),
    TICK: stay,
    TOUCH: touchWhileWriting,
  },
  'column.counting': {
    BLINK: count(1, 'column', true),
    HAND: count(5, 'column', true),
    NOD: stay, // not asked yet: a nod means nothing
    SHAKE: shakeNumber('column'),
    RIGHT: stay,
    PAUSE: pause('column.waiting'),
    TICK: askColumnWhenReady,
    TOUCH: touchWhileWriting,
  },
  'column.asking': {
    BLINK: count(1, 'column', true), // he was not done: keep counting
    HAND: count(5, 'column', true),
    NOD: confirmColumn,
    SHAKE: shakeNumber('column'),
    RIGHT: stay,
    PAUSE: pause('column.waiting'),
    TICK: stay,
    TOUCH: touchWhileWriting,
  },
  'column.rejected': {
    BLINK: count(1, 'column', false),
    HAND: count(5, 'column', false),
    NOD: nodForSpace, // like waiting: the rejection was only a notice
    SHAKE: stay, // a second no right after a rejection changes nothing
    RIGHT: finish,
    PAUSE: pause('column.waiting'),
    TICK: stay,
    TOUCH: touchWhileWriting,
  },
  'row.waiting': {
    BLINK: count(1, 'row', false),
    HAND: count(5, 'row', false),
    NOD: stay, // no space in the middle of a letter
    SHAKE: backToColumns,
    RIGHT: finish,
    PAUSE: pause('row.waiting'),
    TICK: stay,
    TOUCH: touchWhileWriting,
  },
  'row.counting': {
    BLINK: count(1, 'row', true),
    HAND: count(5, 'row', true),
    NOD: stay,
    SHAKE: shakeNumber('row'),
    RIGHT: stay,
    PAUSE: pause('row.waiting'),
    TICK: askRowWhenReady,
    TOUCH: touchWhileWriting,
  },
  'row.asking': {
    BLINK: count(1, 'row', true),
    HAND: count(5, 'row', true),
    NOD: confirmRow,
    SHAKE: shakeNumber('row'),
    RIGHT: stay,
    PAUSE: pause('row.waiting'),
    TICK: stay,
    TOUCH: touchWhileWriting,
  },
  'row.rejected': {
    BLINK: count(1, 'row', false),
    HAND: count(5, 'row', false),
    NOD: stay,
    SHAKE: stay, // a second no right after a rejection changes nothing
    RIGHT: finish,
    PAUSE: pause('row.waiting'),
    TICK: stay,
    TOUCH: touchWhileWriting,
  },
  'speak.asking': {
    BLINK: stay, // only yes or no answers the question
    HAND: stay,
    NOD: speakNow,
    SHAKE: backToWriting,
    RIGHT: stay,
    PAUSE: pause('column.waiting'),
    TICK: stay,
    TOUCH: touchWhileWriting,
  },
  speaking: {
    BLINK: count(1, 'column', false), // he starts the next letter
    HAND: count(5, 'column', false),
    NOD: speakNow, // read it again
    SHAKE: backToWriting, // stop reading
    RIGHT: stay,
    PAUSE: pause('column.waiting', true),
    TICK: stay,
    TOUCH: touchWhileWriting, // like a blink: he goes on writing (the reading is not stopped)
  },
  paused: {
    BLINK: stay,
    HAND: stay,
    NOD: stay,
    SHAKE: stay,
    RIGHT: stay,
    PAUSE: resume,
    TICK: stay,
    TOUCH: stay, // a pause stops every input but PAUSE, taps included
  },
};

/** The question or prompt for the screen, from the state alone (spec 007 shows it). */
export function prompt(state: CountingState): Message {
  const n = total(state);
  switch (state.name) {
    case 'column.waiting':
    case 'column.rejected':
      return msg('counting.giveColumn');
    case 'row.waiting':
    case 'row.rejected':
      return msg('counting.giveRow', { column: state.column ?? 0 });
    case 'column.counting':
    case 'row.counting':
      return msg('counting.counting', { n });
    case 'column.asking':
      return msg('counting.askColumn', { n });
    case 'row.asking':
      return msg('counting.askRow', { n });
    case 'speak.asking':
      return msg('counting.askSpeak');
    case 'speaking':
      return msg('counting.speaking');
    case 'paused':
      return msg('counting.paused');
  }
}

/** Where the pointer is on the board: the column being counted or confirmed, and the row (1-based). */
export function pointer(
  state: CountingState,
  board: Board,
): { column: number | null; row: number | null } {
  const n = total(state);
  if (state.name.startsWith('column.') && n > 0) {
    return { column: Math.min(n, board.columns.length), row: null };
  }
  if (state.name.startsWith('row.')) {
    return { column: state.column, row: n > 0 ? Math.min(n, board.rows.length) : null };
  }
  return { column: null, row: null };
}
