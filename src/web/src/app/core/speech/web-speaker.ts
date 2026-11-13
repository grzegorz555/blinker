// The Web Speech API implementation of Speaker (spec 006, R8).
// Privacy: some browsers offer network voices (for example the "Google" voices in Chrome), which send the text to a
// server. His sentences must not leave the device, so only voices with localService === true are used.
// https://developer.mozilla.org/docs/Web/API/SpeechSynthesisVoice/localService
// https://webaudio.github.io/web-speech-api/
import { RATE, type SayOptions, type SpeakResult, type Speaker } from './speaker';

/** The parts of SpeechSynthesisVoice we use. */
export interface VoiceLike {
  readonly lang: string;
  readonly localService: boolean;
  readonly default: boolean;
  readonly name: string;
}

/** The parts of SpeechSynthesis we use (window.speechSynthesis, or a fake in tests). */
export interface SynthLike {
  getVoices(): readonly VoiceLike[];
  speak(utterance: UtteranceLike): void;
  cancel(): void;
}

/** The parts of SpeechSynthesisUtterance we use. */
export interface UtteranceLike {
  text: string;
  lang: string;
  rate: number;
  voice: VoiceLike | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

/**
 * The best on-device voice for a language: same language (the primary subtag, so "pl" matches "pl-PL"), on-device
 * only, an exact tag match first, then the system default. Null when there is none.
 */
export function pickVoice(voices: readonly VoiceLike[], lang: string): VoiceLike | null {
  const primary = lang.toLowerCase().split('-')[0];
  const candidates = voices.filter(
    (v) => v.localService && v.lang.toLowerCase().replace('_', '-').split('-')[0] === primary,
  );
  const score = (v: VoiceLike) =>
    (v.lang.toLowerCase().replace('_', '-') === lang.toLowerCase() ? 2 : 0) + (v.default ? 1 : 0);
  return [...candidates].sort((a, b) => score(b) - score(a))[0] ?? null;
}

const clampRate = (rate: number = RATE.default) => Math.min(RATE.max, Math.max(RATE.min, rate));

export class WebSpeaker implements Speaker {
  private current: UtteranceLike | null = null;
  private readonly listeners = new Set<(speaking: boolean) => void>();
  private isSpeaking = false;

  constructor(
    private readonly synth: SynthLike | null,
    private readonly createUtterance: (text: string) => UtteranceLike,
  ) {}

  get speaking() {
    return this.isSpeaking;
  }

  say(text: string, options: SayOptions): SpeakResult {
    if (!this.synth) return 'unsupported';
    const voice = pickVoice(this.synth.getVoices(), options.lang);
    if (!voice) return 'no-local-voice';
    this.cancel();
    const utterance = this.createUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = clampRate(options.rate);
    const done = () => {
      if (this.current !== utterance) return; // a newer say() already took over
      this.current = null;
      this.setSpeaking(false);
    };
    utterance.onend = done;
    utterance.onerror = done;
    this.current = utterance;
    this.setSpeaking(true);
    this.synth.speak(utterance);
    return 'started';
  }

  cancel(): void {
    if (!this.synth) return;
    this.current = null;
    this.synth.cancel();
    this.setSpeaking(false);
  }

  subscribe(listener: (speaking: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setSpeaking(value: boolean) {
    if (this.isSpeaking === value) return;
    this.isSpeaking = value;
    for (const listener of this.listeners) listener(value);
  }
}

/** The browser globals createWebSpeaker needs (window, or {} in a test). */
export interface SpeechGlobals {
  readonly speechSynthesis?: SpeechSynthesis;
  readonly SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance;
}

/** A WebSpeaker on the real browser API, or one that reports "unsupported" when there is none. */
export function createWebSpeaker(
  win: SpeechGlobals | undefined = globalThis.window as SpeechGlobals | undefined,
): WebSpeaker {
  const synth = win?.speechSynthesis ?? null;
  const Utterance = win?.SpeechSynthesisUtterance;
  return new WebSpeaker(
    synth && Utterance ? (synth as unknown as SynthLike) : null,
    (text) => new (Utterance as typeof SpeechSynthesisUtterance)(text) as unknown as UtteranceLike,
  );
}
