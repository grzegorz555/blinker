// The settings (spec 007, R9). Plain TypeScript: the defaults here, the store and the page around them.
import { ASK_AFTER } from '../counting/counting';
import { RATE } from '../speech/speaker';

export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

export interface Settings {
  /** The pause before "Kolumna N?" (Column N?), 500–5000 ms (SC 2.2.1). */
  readonly askAfterMs: number;
  /** Say the questions aloud, not only show them. */
  readonly speakQuestions: boolean;
  /** The buttons for his signals on Liczenie (Counting): on in stage 2, there is no camera yet (R6). */
  readonly signalButtons: boolean;
  /** Single-key shortcuts for his signals: off by default (SC 2.1.4). */
  readonly keyboard: boolean;
  /** "Podpowiedzi w Liczeniu" (Hints in Counting). */
  readonly hints: boolean;
  /** Speech rate, 0.5–2. */
  readonly rate: number;
  readonly theme: Theme;
  /** Keep the sentences read aloud on the device (R11). */
  readonly history: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  askAfterMs: ASK_AFTER.default,
  speakQuestions: true,
  signalButtons: true,
  keyboard: false,
  hints: true,
  rate: RATE.default,
  theme: 'system',
  history: true,
};
