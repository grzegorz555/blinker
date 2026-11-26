// The counting machine (spec 006, R4–R6; docs/interaction-model.md, mode B). Plain TypeScript, no Angular imports.
//
// Blinker plays the caregiver's role: he gives a number (a long blink = 1, a look at his hand = 5) for the column, a
// pause, then the row, a pause: the letter is added and said (spec 009). Blinking again is the next letter; a shake
// undoes it. With confirmByNod on, Blinker asks "Kolumna 7?" (Column 7?) and he nods or shakes his head (spec 006).
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
  replaceAll,
  undo,
  type Sentence,
  type SentenceStep,
} from '../sentence/sentence';
import { matchPhrase, phraseForSentence } from '../phrases/phrases';

export const STATE_NAMES = [
  'column.waiting',
  'column.counting',
  'column.asking',
  'column.rejected',
  'phrase.asking',
  'row.waiting',
  'row.counting',
  'row.asking',
  'row.rejected',
  'speak.asking',
  'speaking',
  'clear.asking',
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
  'SPOKEN',
] as const;
export type SignalType = (typeof SIGNAL_TYPES)[number];

/**
 * What a tap chose (spec 007, R3): a board cell (1-based, like the numbers he gives) or one of the sentence actions.
 * "clear" is sent only after the confirmation dialog, so the machine clears at once.
 */
export type TouchTarget =
  | { readonly kind: 'cell'; readonly column: number; readonly row: number }
  | { readonly kind: 'undo' | 'clear' | 'speak' | 'space' }
  /** The favorite phrase offered above the board (spec 019, R7): taken like a nod. */
  | { readonly kind: 'phrase'; readonly phrase: string };

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
  /** Say a short text aloud: the chosen letter always; questions and notices only when speakPrompts is on. */
  | {
      readonly type: 'say';
      readonly message: Message;
      /** In the board's language, not the UI's: a favorite phrase asked aloud (spec 019, R4). */
      readonly inBoardLanguage?: boolean;
    }
  /** Announce a change to screen readers, and show it as the notice. */
  | { readonly type: 'announce'; readonly message: Message }
  /** Read the sentence aloud: only after a nod on "Przeczytać na głos?" (Read it aloud?). */
  | { readonly type: 'speak'; readonly text: string }
  /** Stop reading aloud. */
  | { readonly type: 'stopSpeaking' }
  /** A short tune: the column is taken and he can give the row now (rowCue on). */
  | { readonly type: 'cue'; readonly cue: 'rowReady' };

export interface CountingConfig {
  readonly board: Board;
  /** How long Blinker waits after the last blink before it asks; 500–5000 ms (SC 2.2.1). */
  readonly askAfterMs: number;
  /** Say the questions and notices aloud, not only show them; off: only the letter and the reading (spec 009, R3). */
  readonly speakPrompts: boolean;
  /** Ask "Kolumna 7?" (Column 7?) and wait for a nod; off: the pause after a number moves on (spec 009, R1). */
  readonly confirmByNod: boolean;
  /** Play a short tune when the column is taken, so he knows when to start the row. */
  readonly rowCue: boolean;
  /** His favorite phrases while "Podpowiadaj ulubione zwroty" (Suggest favorite phrases) is on; empty when off (spec 019, R1). */
  readonly phrases: readonly string[];
  /** "Pauza przed podpowiedzią" (Pause before a suggestion), 1000–10000 ms (spec 019, R4; SC 2.2.1). */
  readonly phrasePauseMs: number;
}

export const ASK_AFTER = { min: 500, max: 5000, default: 1200 } as const;
export const SUGGEST_PAUSE = { min: 1000, max: 10000, default: 2500 } as const;

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
  /** The favorite phrase being asked about in `phrase.asking` (spec 019, R4). */
  readonly offer: string | null;
  /** The text a phrase was last offered for: at most one offer for the same text (R4). */
  readonly offeredFor: string | null;
  /** Phrases refused with a shake or undone, until the sentence is cleared or read aloud (R5). */
  readonly refused: readonly string[];
  /** Since when no signal but TICK came, for the pause before a suggestion (R4); null right after a signal. */
  readonly quietSince: number | null;
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
  'counting.askNewSentence',
  'counting.newSentence',
  'counting.kept',
  'counting.askPhrase',
  'counting.phraseRefused',
  'counting.undonePhrase',
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
    offer: null,
    offeredFor: null,
    refused: [],
    quietSince: null,
  };
}

export const total = (state: Pick<CountingState, 'parts'>) =>
  state.parts.reduce((a, b) => a + b, 0);

/** The one entry point (R4). */
export function next(state: CountingState, signal: Signal, config: CountingConfig): Transition {
  // Any signal but TICK restarts the pause before a suggestion (spec 019, R4).
  const base =
    signal.type === 'TICK'
      ? { ...state, now: Math.max(state.now, signal.now) }
      : { ...state, quietSince: null };
  return TRANSITIONS[state.name][signal.type](base, config, signal);
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

/** A question: shown and announced; also said aloud when speakPrompts is on. */
function ask(config: CountingConfig, message: Message): Effect[] {
  return config.speakPrompts
    ? [
        { type: 'ask', message },
        { type: 'say', message },
      ]
    : [{ type: 'ask', message }];
}

/** A notice: shown and announced to screen readers; also said aloud when speakPrompts is on (spec 009, R3). */
function notify(config: CountingConfig, notice: Message): Effect[] {
  return config.speakPrompts
    ? [
        { type: 'announce', message: notice },
        { type: 'say', message: notice },
      ]
    : [{ type: 'announce', message: notice }];
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
  if (step.kind === 'replace') return msg('counting.undonePhrase');
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
const nodForSpace: Handler = (state, config) => {
  const text = state.sentence.text;
  if (!text || text.endsWith(' ')) {
    const notice = msg('counting.spaceNotAdded');
    return go(state, { name: 'column.waiting', notice }, notify(config, notice));
  }
  // With speakPrompts on (spec 008, R2), say the word just finished, not "Spacja" (Space); off, nothing (spec 009, R3).
  const word = text.split(' ').at(-1) ?? '';
  const notice = msg('counting.space');
  const effects: Effect[] = [{ type: 'announce', message: notice }];
  if (config.speakPrompts)
    effects.push({ type: 'say', message: msg('counting.letter', { letter: word }) });
  return go(
    state,
    { name: 'column.waiting', sentence: append(state.sentence, ' '), notice },
    effects,
  );
};

/** A shake while waiting for a column: undo the last step this session made (a letter, a space, a deletion). */
const shakeToUndo: Handler = (state, config) => {
  const last = state.sentence.history.at(-1);
  const notice = describeUndo(last);
  return go(
    state,
    {
      name: 'column.waiting',
      sentence: canUndo(state.sentence) ? undo(state.sentence) : state.sentence,
      notice,
      // An undone phrase is not offered again for this sentence (spec 019, R5, R8).
      refused: last?.kind === 'replace' ? [...state.refused, last.text] : state.refused,
    },
    notify(config, notice), // "Cofnięto A" (Undid A): said only with speakPrompts on (spec 009, R3)
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
function reject(
  state: CountingState,
  config: CountingConfig,
  step: 'column' | 'row',
  notice: Message,
): Transition {
  const patch = { name: `${step}.rejected` as const, parts: [], lastCountAt: null, notice };
  return go(state, patch, notify(config, notice));
}

/**
 * After the pause with no new signal: reject the number with the reason; or ask about it (confirmByNod on); or take
 * it at once (off, the default: spec 009, R1).
 */
const askColumnWhenReady: Handler = (state, config, signal) => {
  if (state.lastCountAt === null || state.now - state.lastCountAt < config.askAfterMs)
    return stay(state, config, signal);
  const n = total(state);
  if (n > config.board.columns.length)
    return reject(state, config, 'column', msg('counting.noColumn', { n }));
  if (!config.confirmByNod) return confirmColumn(state, config, signal);
  return go(state, { name: 'column.asking' }, ask(config, msg('counting.askColumn', { n })));
};

const askRowWhenReady: Handler = (state, config, signal) => {
  if (state.lastCountAt === null || state.now - state.lastCountAt < config.askAfterMs)
    return stay(state, config, signal);
  const n = total(state);
  const column = state.column ?? 0;
  if (n > config.board.rows.length)
    return reject(state, config, 'row', msg('counting.noRow', { n }));
  if (!cellAt(config.board, column, n)) {
    return reject(state, config, 'row', msg('counting.emptyCell', { column, row: n }));
  }
  if (!config.confirmByNod) return confirmRow(state, config, signal);
  return go(state, { name: 'row.asking' }, ask(config, msg('counting.askRow', { n })));
};

const confirmColumn: Handler = (state, config) => {
  const column = total(state);
  const notice = msg('counting.giveRow', { column });
  return go(state, { name: 'row.waiting', column, parts: [], lastCountAt: null, notice }, [
    { type: 'announce', message: notice },
    ...(config.rowCue ? [{ type: 'cue', cue: 'rowReady' } as const] : []),
  ]);
};

const shakeNumber =
  (step: 'column' | 'row'): Handler =>
  (state, config) =>
    reject(state, config, step, msg('counting.rejectedNo', { n: total(state) }));

// ---- row step --------------------------------------------------------------------------------------------------

const BACK = { name: 'column.waiting', column: null, parts: [], lastCountAt: null } as const;

/**
 * A nod on "Wiersz N?" (Row N?), or the pause after the row (spec 009): the cell is chosen. A letter or word is added
 * and said; an action is carried out.
 */
const confirmRow: Handler = (state, config, signal) => {
  const column = state.column ?? 0;
  const cell = cellAt(config.board, column, total(state));
  if (!cell)
    return reject(state, config, 'row', msg('counting.emptyCell', { column, row: total(state) }));
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
  if (cell.type === 'action') {
    const notice =
      cell.value === 'space'
        ? msg('counting.space')
        : cell.value === 'clear'
          ? msg('counting.cleared')
          : msg('counting.deleted', { text: state.sentence.text.slice(-1) });
    return go(state, { sentence, notice }, notify(config, notice));
  }
  // The chosen letter or word is always said: he builds words by ear (spec 009, R3).
  const notice = msg('counting.added', { letter: cell.value });
  return go(state, { sentence, notice }, [
    { type: 'announce', message: notice },
    { type: 'say', message: msg('counting.letter', { letter: cell.value }) },
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
  go(state, { name: 'speaking', notice: msg('counting.speaking'), refused: [] }, [
    { type: 'speak', text: state.sentence.text.trim() },
  ]);

const backToWriting: Handler = (state) => {
  const notice = msg('counting.backToWriting');
  return go(state, { name: 'column.waiting', notice }, [
    { type: 'stopSpeaking' },
    { type: 'announce', message: notice },
  ]);
};

// ---- after reading (spec 008, R3) ------------------------------------------------------------------------------

/** The reading ended (SPOKEN from the speaker): ask whether to start a new sentence. */
const afterReading: Handler = (state, config) =>
  go(state, { name: 'clear.asking', notice: null }, ask(config, msg('counting.askNewSentence')));

/** A nod on "Nowe zdanie?" (New sentence?): clear the sentence; one undo at the columns brings it back. */
const newSentence: Handler = (state, config) => {
  const notice = msg('counting.newSentence');
  const patch = { name: 'column.waiting' as const, sentence: clear(state.sentence), notice };
  return go(state, patch, notify(config, notice));
};

/** A shake on "Nowe zdanie?" (New sentence?): keep the sentence and go on writing. */
const keepSentence: Handler = (state, config) => {
  const notice = msg('counting.kept');
  return go(state, { name: 'column.waiting', notice }, notify(config, notice));
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
    case 'space':
      // The same rule as a nod without a number: no space at the start or after a space.
      return nodForSpace(back, config, signal);
    case 'clear': {
      const notice = msg('counting.cleared');
      return go(back, { sentence: clear(state.sentence), notice }, notify(config, notice));
    }
    case 'speak':
      return speakIfAny(back, config, signal);
    case 'phrase':
      return target.phrase
        ? takePhrase(back, target.phrase, config, signal)
        : stay(state, config, signal);
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

// ---- favorite phrases (spec 019) -------------------------------------------------------------------------------

/**
 * TICK while waiting for a column (R4): after "Pauza przed podpowiedzią" (Pause before a suggestion) with no signal,
 * offer the one phrase his whole text is the start of. At most one offer for the same text. A sentence with no letters
 * left forgets the refused phrases (R5).
 */
const offerWhenReady: Handler = (state, config, signal) => {
  const text = state.sentence.text;
  if (!text.trim()) {
    return state.refused.length || state.offeredFor !== null
      ? go(state, { refused: [], offeredFor: null })
      : stay(state, config, signal);
  }
  if (!config.phrases.length || state.offeredFor === text) return stay(state, config, signal);
  if (state.quietSince === null) return go(state, { quietSince: state.now });
  if (state.now - state.quietSince < config.phrasePauseMs) return stay(state, config, signal);
  const phrase = matchPhrase(text, config.phrases, config.board.locale, state.refused);
  if (!phrase) return stay(state, config, signal);
  // Said aloud whatever speakPrompts is, in the board's language: he listens (R4).
  const question = msg('counting.askPhrase', { phrase });
  return go(state, { name: 'phrase.asking', offer: phrase, offeredFor: text, notice: null }, [
    { type: 'ask', message: question },
    { type: 'say', message: question, inBoardLanguage: true },
  ]);
};

/**
 * A nod on the phrase, or a tap on it (R6): his text is replaced by the phrase in upper case, as one step, and Blinker
 * asks "Przeczytać na głos?" (Read it aloud?) at once; nothing is read without his nod.
 */
function takePhrase(
  state: CountingState,
  phrase: string,
  config: CountingConfig,
  signal: Signal,
): Transition {
  const sentence = replaceAll(state.sentence, phraseForSentence(phrase, config.board.locale));
  return finish({ ...state, ...BACK, sentence, offer: null }, config, signal);
}

const nodForPhrase: Handler = (state, config, signal) =>
  state.offer ? takePhrase(state, state.offer, config, signal) : stay(state, config, signal);

/** A shake on the phrase (R6): the text stays, the phrase is refused; a second shake right after changes nothing. */
const refusePhrase: Handler = (state, config) => {
  const notice = msg('counting.phraseRefused');
  const refused = state.offer ? [...state.refused, state.offer] : state.refused;
  return go(
    state,
    { name: 'column.rejected', offer: null, refused, notice },
    notify(config, notice),
  );
};

/** Any other answer drops the offer and does what it does at the columns. */
const droppingOffer =
  (handler: Handler): Handler =>
  (state, config, signal) =>
    handler({ ...state, offer: null }, config, signal);

// ---- the table: every state × every signal ---------------------------------------------------------------------

export const TRANSITIONS: Readonly<Record<StateName, Readonly<Record<SignalType, Handler>>>> = {
  'column.waiting': {
    BLINK: count(1, 'column', false),
    HAND: count(5, 'column', false),
    NOD: nodForSpace,
    SHAKE: shakeToUndo,
    RIGHT: finish,
    PAUSE: pause('column.waiting'),
    TICK: offerWhenReady, // a favorite phrase after the pause (spec 019, R4)
    TOUCH: touchWhileWriting,
    SPOKEN: stay, // only the end of a reading means something
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
    SPOKEN: stay, // only the end of a reading means something
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
    SPOKEN: stay, // only the end of a reading means something
  },
  'column.rejected': {
    BLINK: count(1, 'column', false),
    HAND: count(5, 'column', false),
    NOD: nodForSpace, // like waiting: the rejection was only a notice
    SHAKE: stay, // a second no right after a rejection changes nothing
    RIGHT: finish,
    PAUSE: pause('column.waiting'),
    TICK: offerWhenReady, // a favorite phrase after the pause (spec 019, R4)
    TOUCH: touchWhileWriting,
    SPOKEN: stay, // only the end of a reading means something
  },
  'phrase.asking': {
    BLINK: droppingOffer(count(1, 'column', false)), // he goes on spelling
    HAND: droppingOffer(count(5, 'column', false)),
    NOD: nodForPhrase,
    SHAKE: refusePhrase,
    RIGHT: droppingOffer(finish), // read his own text (asks first)
    PAUSE: droppingOffer(pause('column.waiting')),
    TICK: stay, // the offer waits for his answer
    TOUCH: droppingOffer(touchWhileWriting),
    SPOKEN: stay, // only the end of a reading means something
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
    SPOKEN: stay, // only the end of a reading means something
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
    SPOKEN: stay, // only the end of a reading means something
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
    SPOKEN: stay, // only the end of a reading means something
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
    SPOKEN: stay, // only the end of a reading means something
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
    SPOKEN: stay, // only the end of a reading means something
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
    SPOKEN: afterReading, // the reading ended: "Nowe zdanie?" (New sentence?)
  },
  'clear.asking': {
    BLINK: count(1, 'column', false), // he goes on with the sentence
    HAND: count(5, 'column', false),
    NOD: newSentence,
    SHAKE: keepSentence,
    RIGHT: finish, // read it again (asks first)
    PAUSE: pause('column.waiting'),
    TICK: stay,
    TOUCH: touchWhileWriting,
    SPOKEN: stay,
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
    SPOKEN: stay, // only the end of a reading means something
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
    case 'phrase.asking':
      return msg('counting.askPhrase', { phrase: state.offer ?? '' });
    case 'row.asking':
      return msg('counting.askRow', { n });
    case 'speak.asking':
      return msg('counting.askSpeak');
    case 'speaking':
      return msg('counting.speaking');
    case 'clear.asking':
      return msg('counting.askNewSentence');
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
