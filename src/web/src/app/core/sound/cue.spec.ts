import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUDIO, CUE_GAIN, CUES, SignalCue, type AudioLike } from './cue';

function fakeAudio(state = 'running') {
  const tones: { hz: number; start: number; stop: number }[] = [];
  const ctx: AudioLike = {
    currentTime: 10,
    state,
    destination: {},
    resume: vi.fn(async () => undefined),
    createOscillator: () => {
      const tone = { hz: 0, start: 0, stop: 0 };
      tones.push(tone);
      return {
        type: '',
        frequency: { setValueAtTime: (v: number) => void (tone.hz = v) },
        connect: () => undefined,
        start: (t: number) => void (tone.start = t),
        stop: (t: number) => void (tone.stop = t),
      };
    },
    createGain: () => ({
      gain: {
        setValueAtTime: (v: number) => expect(v).toBe(CUE_GAIN),
        exponentialRampToValueAtTime: () => undefined,
      },
      connect: () => undefined,
    }),
  };
  return { ctx, tones };
}

describe('SignalCue (spec 012, R3)', () => {
  afterEach(() => TestBed.resetTestingModule());

  function setup(create: () => AudioLike | null) {
    const factory = vi.fn(create);
    TestBed.configureTestingModule({ providers: [{ provide: AUDIO, useValue: factory }] });
    return { cue: TestBed.inject(SignalCue), factory };
  }

  it('plays a different short sound per signal, one after the other', () => {
    const { ctx, tones } = fakeAudio();
    const { cue } = setup(() => ctx);
    cue.play('NOD');
    expect(tones.map((t) => t.hz)).toEqual(CUES.NOD.map((c) => c.hz));
    expect(tones[1].start).toBeGreaterThan(tones[0].stop);
    expect(tones.every((t) => t.stop - t.start < 0.3)).toBe(true);
    expect(new Set(Object.values(CUES).map((c) => JSON.stringify(c))).size).toBe(5);
  });

  it('creates the audio context once, on first use', () => {
    const { ctx } = fakeAudio();
    const { cue, factory } = setup(() => ctx);
    expect(factory).not.toHaveBeenCalled();
    cue.play('BLINK');
    cue.play('HAND');
    expect(factory).toHaveBeenCalledOnce();
  });

  it('tries to resume a suspended context (autoplay policy)', () => {
    const { ctx } = fakeAudio('suspended');
    setup(() => ctx).cue.play('BLINK');
    expect(ctx.resume).toHaveBeenCalled();
  });

  it('never throws: without audio, or when the browser refuses', () => {
    expect(() => setup(() => null).cue.play('RIGHT')).not.toThrow();
    TestBed.resetTestingModule();
    expect(() =>
      setup(() => {
        throw new Error('NotAllowed');
      }).cue.play('RIGHT'),
    ).not.toThrow();
  });
});
