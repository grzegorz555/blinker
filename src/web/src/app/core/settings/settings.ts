// The settings (spec 007, R9, R12). Plain TypeScript: the defaults, and a validator for what is read back from the
// device (a hand-edited or old value must never break the app).
import { ASK_AFTER } from '../counting/counting';
import { RATE } from '../speech/speaker';
import { isPlainObject } from '../storage/local-store';

export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

/** Speech rates offered in Ustawienia (Settings). */
export const RATES = [0.75, 1, 1.25, 1.5] as const;

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

export const SETTINGS_KEY = 'blinker.settings.v1';

/** The pause is a whole number of milliseconds within 500–5000. */
export const validAskAfter = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= ASK_AFTER.min &&
  value <= ASK_AFTER.max;

const CHECKS: { readonly [K in keyof Settings]: (value: unknown) => boolean } = {
  askAfterMs: validAskAfter,
  speakQuestions: (v) => typeof v === 'boolean',
  signalButtons: (v) => typeof v === 'boolean',
  keyboard: (v) => typeof v === 'boolean',
  hints: (v) => typeof v === 'boolean',
  rate: (v) => typeof v === 'number' && v >= RATE.min && v <= RATE.max,
  theme: (v) => (THEMES as readonly unknown[]).includes(v),
  history: (v) => typeof v === 'boolean',
};

/**
 * Validates stored settings. Every known field must be valid; unknown fields are dropped (a newer version may add
 * some); a missing field takes its default (an older version had fewer). Anything else: null, so the caller falls
 * back to the defaults and says so.
 */
export function validateSettings(data: unknown): Settings | null {
  if (!isPlainObject(data)) return null;
  const result: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(CHECKS) as (keyof Settings)[]) {
    if (!Object.hasOwn(data, key)) continue;
    if (!CHECKS[key](data[key])) return null;
    result[key] = data[key];
  }
  return result as unknown as Settings;
}
