// CountingService (spec 006, R9): a thin Angular wrapper around the pure counting machine. It holds the state in a
// signal, feeds every input signal and the one TICK scheduler to next(), and carries out the effects: the text for the
// screen and the live region, and the Speaker. No logic here that the machine could hold.
import { DestroyRef, Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import friendBoard from '../../../../public/boards/friend-pl.json';
import type { Board } from '../boards/board';
import { validateBoardData } from '../boards/validate-board';
import type { InputSignal } from '../input/signals';
import type { SpeakResult, Speaker } from '../speech/speaker';
import { createWebSpeaker } from '../speech/web-speaker';
import {
  ASK_AFTER,
  initialState,
  next,
  pointer,
  prompt,
  type CountingConfig,
  type CountingState,
  type Effect,
  type Message,
  type TouchTarget,
} from './counting';

/** Calls back with the current time at a fixed interval; returns a function that stops it. */
export interface TickScheduler {
  every(ms: number, tick: (now: number) => void): () => void;
}

/** The real scheduler: setInterval with the monotonic clock (performance.now), so a clock change can't skip a pause. */
export const browserScheduler: TickScheduler = {
  every(ms, tick) {
    const id = setInterval(() => tick(performance.now()), ms);
    return () => clearInterval(id);
  },
};

export const TICK_SCHEDULER = new InjectionToken<TickScheduler>('TICK_SCHEDULER', {
  providedIn: 'root',
  factory: () => browserScheduler,
});

export const SPEAKER = new InjectionToken<Speaker>('SPEAKER', {
  providedIn: 'root',
  factory: () => createWebSpeaker(),
});

/** How often time is passed to the machine: often enough that the question comes within 0.1 s of the pause. */
export const TICK_MS = 100;

/** His board, validated like any imported board, as the default (R1). */
export function defaultBoard(): Board {
  const result = validateBoardData(friendBoard);
  if (!result.ok) throw new Error('the built-in board is invalid');
  return result.board;
}

@Injectable({ providedIn: 'root' })
export class CountingService {
  private readonly transloco = inject(TranslocoService);
  private readonly speaker = inject(SPEAKER);
  private readonly scheduler = inject(TICK_SCHEDULER);
  private stopTicks: (() => void) | null = null;

  private readonly current = signal<CountingState>(initialState());
  private readonly settings = signal<CountingConfig>({
    board: defaultBoard(),
    askAfterMs: ASK_AFTER.default,
    speakQuestions: true,
  });

  /** The machine state (spec 007 renders it). */
  readonly state = this.current.asReadonly();
  readonly config = this.settings.asReadonly();
  /** The question or prompt as a Transloco message. */
  readonly prompt = computed(() => prompt(this.current()));
  /** The pointer on the board. */
  readonly pointer = computed(() => pointer(this.current(), this.settings().board));
  readonly sentence = computed(() => this.current().sentence.text);
  /** The latest text for the polite live region (SC 4.1.3). */
  readonly announcement = signal('');
  readonly speaking = signal(false);
  /** The result of the last attempt to speak: 'no-local-voice' is shown in text by spec 007. */
  readonly speakResult = signal<SpeakResult | null>(null);

  constructor() {
    const unsubscribe = this.speaker.subscribe((speaking) => this.speaking.set(speaking));
    inject(DestroyRef).onDestroy(() => {
      unsubscribe();
      this.stop();
    });
  }

  /** Starts passing time to the machine (Liczenie is on screen). */
  start(): void {
    if (this.stopTicks) return;
    this.stopTicks = this.scheduler.every(TICK_MS, (now) => this.apply({ type: 'TICK', now }));
  }

  /** Stops time (Liczenie left the screen): no question is asked while nobody sees it. */
  stop(): void {
    this.stopTicks?.();
    this.stopTicks = null;
  }

  /** Every source (buttons, keys, later his face) sends its signals here. */
  send(signal: InputSignal): void {
    this.apply(signal);
  }

  /** A tap on a board cell or a sentence action (spec 007, R3); "clear" only after the confirmation dialog. */
  touch(target: TouchTarget): void {
    this.apply({ type: 'TOUCH', target });
  }

  /** "Zatrzymaj" (Stop): stops reading aloud at once; the text does not change (spec 007, R7). */
  stopSpeaking(): void {
    this.speaker.cancel();
  }

  /** Changes the settings (the pause before the question within 500–5000 ms, SC 2.2.1; speaking the questions). */
  configure(patch: Partial<Omit<CountingConfig, 'board'>>): void {
    const askAfterMs =
      patch.askAfterMs === undefined
        ? undefined
        : Math.min(ASK_AFTER.max, Math.max(ASK_AFTER.min, patch.askAfterMs));
    this.settings.update((c) => ({ ...c, ...patch, ...(askAfterMs ? { askAfterMs } : {}) }));
  }

  private apply(signal: Parameters<typeof next>[1]): void {
    const { state, effects } = next(this.current(), signal, this.settings());
    this.current.set(state);
    for (const effect of effects) this.run(effect);
  }

  private text(message: Message): string {
    return this.transloco.translate(message.key, message.params ?? {});
  }

  private run(effect: Effect): void {
    switch (effect.type) {
      case 'ask':
      case 'announce':
        this.announcement.set(this.text(effect.message));
        return;
      case 'say':
        // A question or a short notice, in the UI language.
        this.speakResult.set(
          this.speaker.say(this.text(effect.message), { lang: this.transloco.getActiveLang() }),
        );
        return;
      case 'speak':
        // His sentence, in the language of the board.
        this.speakResult.set(this.speaker.say(effect.text, { lang: this.settings().board.locale }));
        return;
      case 'stopSpeaking':
        this.speaker.cancel();
        return;
    }
  }
}
