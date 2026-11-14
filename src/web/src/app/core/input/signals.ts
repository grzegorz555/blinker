// Signal input (spec 006, R7). One input type for every source: the on-screen buttons and keys now (spec 007), his
// face signals later (stages 3–4). All of them call the same sink, so the counting machine never knows the source.
import type { Signal } from '../counting/counting';

/** A signal from a person: his signals and a tap on the screen (TICK is time, not input). */
export type InputSignal = Exclude<Signal, { type: 'TICK' }>;

/** His six signals, the ones a button, a key or (later) his face gives; a tap (TOUCH) carries a target instead. */
export const INPUT_SIGNALS = [
  'BLINK',
  'HAND',
  'NOD',
  'SHAKE',
  'RIGHT',
  'PAUSE',
] as const satisfies readonly InputSignal['type'][];
export type InputSignalType = (typeof INPUT_SIGNALS)[number];

/** Where every source sends its signals. */
export type SignalSink = (signal: InputSignal) => void;
