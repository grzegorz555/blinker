// Spec 012, R3: a short sound for each signal from the camera, so he hears that Blinker counted it. Made on the device
// with the Web Audio API (an oscillator and a gain envelope), no audio files.
// https://developer.mozilla.org/docs/Web/API/OscillatorNode
import { DOCUMENT } from '@angular/common';
import { inject, Injectable, InjectionToken } from '@angular/core';
import type { FaceSignal } from '../signals/detector';

/** The part of an AudioContext the cue uses (a fake in tests). */
export interface AudioLike {
  readonly currentTime: number;
  readonly state: string;
  readonly destination: unknown;
  resume(): Promise<void>;
  createOscillator(): {
    type: string;
    frequency: { setValueAtTime(value: number, time: number): void };
    connect(node: unknown): unknown;
    start(time: number): void;
    stop(time: number): void;
  };
  createGain(): {
    gain: {
      setValueAtTime(value: number, time: number): void;
      exponentialRampToValueAtTime(value: number, time: number): void;
    };
    connect(node: unknown): unknown;
  };
}

/** Creates the audio context on first use; null where the browser has none. */
export const AUDIO = new InjectionToken<() => AudioLike | null>('AUDIO', {
  factory: () => {
    const view = inject(DOCUMENT).defaultView as
      (Window & { AudioContext?: new () => AudioLike }) | null;
    return () => (view?.AudioContext ? new view.AudioContext() : null);
  },
});

/**
 * A tone (or two) per signal: a short high blip for +1, a lower one for +5, rising for yes, falling for no, a long
 * tone for finish. Quiet (gain 0.15) and short (under 0.3 s), so it never covers the voice.
 */
export const CUES: Record<FaceSignal, readonly { readonly hz: number; readonly ms: number }[]> = {
  BLINK: [{ hz: 880, ms: 90 }],
  HAND: [{ hz: 523, ms: 140 }],
  NOD: [
    { hz: 660, ms: 90 },
    { hz: 880, ms: 110 },
  ],
  SHAKE: [
    { hz: 660, ms: 90 },
    { hz: 440, ms: 110 },
  ],
  RIGHT: [{ hz: 587, ms: 260 }],
};

export const CUE_GAIN = 0.15;

@Injectable({ providedIn: 'root' })
export class SignalCue {
  private readonly create = inject(AUDIO);
  private context: AudioLike | null | undefined;

  /** Plays the signal's sound. Never throws: no sound is better than a broken screen. */
  play(signal: FaceSignal): void {
    try {
      this.context ??= this.create();
      const ctx = this.context;
      if (!ctx) return;
      // A browser may keep audio suspended until a tap (autoplay policy); try, and play if it runs.
      if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
      let at = ctx.currentTime;
      for (const { hz, ms } of CUES[signal]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(hz, at);
        gain.gain.setValueAtTime(CUE_GAIN, at);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + ms / 1000);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(at);
        osc.stop(at + ms / 1000);
        at += ms / 1000 + 0.02;
      }
    } catch {
      // ignore: the signal itself has already gone to the counting machine
    }
  }
}
