// The keyboard mapping (spec 006, R7): Space = blink (+1), H = hand (+5), N = nod, S = shake, R = head right,
// P = pause. Single-character shortcuts must be possible to turn off or remap (SC 2.1.4), so the mapping is OFF by
// default; he uses his head, the keys are for tests and caregivers.
// https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html
import type { InputSignalType, SignalSink } from './signals';

export interface KeyboardSettings {
  readonly enabled: boolean;
}

export const DEFAULT_KEYBOARD: KeyboardSettings = { enabled: false };

export const KEY_MAP: Readonly<Record<string, InputSignalType>> = {
  ' ': 'BLINK',
  h: 'HAND',
  n: 'NOD',
  s: 'SHAKE',
  r: 'RIGHT',
  p: 'PAUSE',
};

/** The parts of a KeyboardEvent the mapping looks at (a plain object in tests). */
export interface KeyLike {
  readonly key: string;
  readonly repeat: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;
  readonly target: EventTarget | null;
}

/** Fields where a key is text, never a signal. */
const TEXT_FIELDS = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
/** Controls where Space and Enter keep their own meaning (activate the button or link). */
const CONTROLS =
  'button, a[href], [role="button"], [role="switch"], [role="checkbox"], [role="radio"], summary';

function closest(target: EventTarget | null, selector: string): boolean {
  const el = target as { closest?: (s: string) => unknown } | null;
  return typeof el?.closest === 'function' && el.closest(selector) !== null;
}

/** The signal for a key, or null when the key must keep its own meaning. */
export function keyToSignal(event: KeyLike, settings: KeyboardSettings): InputSignalType | null {
  if (!settings.enabled) return null;
  if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return null;
  const signal = KEY_MAP[event.key.toLowerCase()];
  if (!signal) return null;
  if (closest(event.target, TEXT_FIELDS)) return null;
  if (event.key === ' ' && closest(event.target, CONTROLS)) return null;
  return signal;
}

/**
 * Listens for keys on a target (the document) and sends mapped signals to the sink. Reads the settings on every key,
 * so turning the mapping on or off applies at once. Returns a function that stops listening.
 */
export function listenToKeys(
  target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>,
  settings: () => KeyboardSettings,
  sink: SignalSink,
): () => void {
  const onKey = (event: Event) => {
    const signal = keyToSignal(event as KeyboardEvent, settings());
    if (!signal) return;
    event.preventDefault(); // Space would scroll the page
    sink({ type: signal });
  };
  target.addEventListener('keydown', onKey);
  return () => target.removeEventListener('keydown', onKey);
}
