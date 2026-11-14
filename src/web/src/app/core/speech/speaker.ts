// Speech (spec 006, R8). The interface the app speaks through; the Web Speech implementation is web-speaker.ts and
// tests use fake-speaker.ts. No text leaves the device: only on-device voices are used.

/** What happened to a say() call. */
export type SpeakResult =
  /** Speaking started. */
  | 'started'
  /** No on-device voice for the language: nothing was said (spec 007 shows why, in text). */
  | 'no-local-voice'
  /** The browser has no speech synthesis. */
  | 'unsupported';

export interface SayOptions {
  /** BCP 47 language of the text, for example the board locale "pl". */
  readonly lang: string;
  /** Speech rate, 0.5–2 (1 = normal). */
  readonly rate?: number;
}

export interface Speaker {
  /** Says the text; a new say() cancels the one in progress. */
  say(text: string, options: SayOptions): SpeakResult;
  /** True when there is an on-device voice for the language (nothing is said by a network voice). */
  hasVoice(lang: string): boolean;
  /** Stops speaking at once. */
  cancel(): void;
  /** True while speaking. */
  readonly speaking: boolean;
  /** Calls the listener whenever `speaking` changes; returns a function that removes it. */
  subscribe(listener: (speaking: boolean) => void): () => void;
}

export const RATE = { min: 0.5, max: 2, default: 1 } as const;
