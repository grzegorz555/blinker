// CountingService (spec 006, R9): a thin Angular wrapper around the pure counting machine. It holds the state in a
// signal, feeds every input signal and the one TICK scheduler to next(), and carries out the effects: the text for the
// screen and the live region, and the Speaker. No logic here that the machine could hold.
import { DestroyRef, Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import friendBoard from '../../../../public/boards/friend-pl.json';
import type { Board } from '../boards/board';
import { validateBoardData } from '../boards/validate-board';
import type { InputSignal } from '../input/signals';
import { createSentence } from '../sentence/sentence';
import { SignalCue } from '../sound/cue';
import { RATE, type SpeakResult, type Speaker } from '../speech/speaker';
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
  private readonly cue = inject(SignalCue);
  private stopTicks: (() => void) | null = null;
  /** True while his sentence is being read aloud; a cancel clears it first, so only a natural end sends SPOKEN. */
  private reading = false;

  private readonly current = signal<CountingState>(initialState());
  private readonly rate = signal<number>(RATE.default);
  private readonly settings = signal<CountingConfig>({
    board: defaultBoard(),
    askAfterMs: ASK_AFTER.default,
    speakPrompts: false,
    confirmByNod: false,
    rowCue: true,
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
  /** The last sentence read aloud after his nod or a tap (a new object each time, so a repeat counts). */
  readonly spoken = signal<{ readonly text: string; readonly lang: string } | null>(null);
  /** The result of the last attempt to speak: 'no-local-voice' is shown in text by spec 007. */
  readonly speakResult = signal<SpeakResult | null>(null);

  constructor() {
    const unsubscribe = this.speaker.subscribe((speaking) => {
      this.speaking.set(speaking);
      // A reading of his sentence ended by itself (not cancelled): tell the machine (spec 008, R3).
      if (!speaking && this.reading) {
        this.reading = false;
        if (this.current().name === 'speaking') this.apply({ type: 'SPOKEN' });
      }
    });
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
    this.reading = false;
    this.speaker.cancel();
  }

  /**
   * Back to the start ("Usuń wszystkie dane" (Delete all data), spec 013, R3): speech under way stops, the sentence is
   * empty with nothing left to undo, and nothing is waiting to be kept in the history. The board, the rate and the
   * settings come from their own services.
   */
  reset(): void {
    this.stopSpeaking();
    this.current.update((state) => initialState(createSentence(), state.now));
    this.announcement.set('');
    this.spoken.set(null);
    this.speakResult.set(null);
  }

  /** The speech rate from Ustawienia (Settings), 0.5–2. */
  setRate(rate: number): void {
    this.rate.set(Math.min(RATE.max, Math.max(RATE.min, rate)));
  }

  /** Uses another board (Tablice (Boards), spec 007 R10); the count starts again at the columns, the sentence stays. */
  useBoard(board: Board): void {
    this.settings.update((c) => ({ ...c, board }));
    this.current.update((state) => initialState(state.sentence, state.now));
  }

  /** True when the device has an on-device voice for the language of the board (Ustawienia (Settings), R7). */
  hasVoice(): boolean {
    return this.speaker.hasVoice(this.settings().board.locale);
  }

  /**
   * Says a text at the current rate, in the board language unless given: "Posłuchaj" (Listen) in the settings,
   * "Powiedz jeszcze raz" (Say again) in Zdania (Sentences). Not added to the history again.
   */
  listen(text: string, lang = this.settings().board.locale): void {
    this.reading = false;
    this.speakResult.set(this.speaker.say(text, { lang, rate: this.rate() }));
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
        this.reading = false; // a short text replaces the reading
        // A question or a short notice, in the UI language.
        this.speakResult.set(
          this.speaker.say(this.text(effect.message), {
            lang: this.transloco.getActiveLang(),
            rate: this.rate(),
          }),
        );
        return;
      case 'speak': {
        // His sentence, in the language of the board.
        const lang = this.settings().board.locale;
        this.reading = false; // say() cancels the reading in progress first
        const result = this.speaker.say(effect.text, { lang, rate: this.rate() });
        this.reading = result === 'started';
        this.speakResult.set(result);
        // Zdania (Sentences) keeps what was really read aloud (spec 007, R11).
        if (result === 'started') this.spoken.set({ text: effect.text, lang });
        return;
      }
      case 'stopSpeaking':
        this.reading = false;
        this.speaker.cancel();
        return;
      case 'cue':
        // The column is taken: a short chime, so he knows he can give the row (spec 012, R7).
        this.cue.play('ROW_READY');
        return;
    }
  }
}
