import { describe, expect, it } from 'vitest';
import { closureReports, detectAll, lookReports } from './detector';
import { DEFAULT_PROFILE as P } from './profile';
import { closed, pulse, pulses, record, squeezed } from './synthetic';

const signals = (frames: Parameters<typeof detectAll>[0], profile = P) =>
  detectAll(frames, profile).map((x) => x.signal);

describe('detector: his blink is strong rather than long', () => {
  it('a short (250 ms) blink with the lids squeezed is a BLINK', () => {
    expect(signals(record(2000, { eyes: squeezed(500, 750) }))).toEqual(['BLINK']);
  });

  it('the same short blink without the squeeze (to wet the eye) is not', () => {
    expect(signals(record(2000, { eyes: squeezed(500, 750, 0.3) }))).toEqual([]);
  });

  it('the squeeze counts at any moment of the closure, not only at its start', () => {
    const eyes = (t: number) => {
      const v = pulse(500, 800, 0.9, 0.05)(t);
      const q = pulse(650, 700, 0.8, 0.05)(t);
      return { eyeBlinkLeft: v, eyeBlinkRight: v, eyeSquintLeft: q, eyeSquintRight: q };
    };
    expect(signals(record(2000, { eyes }))).toEqual(['BLINK']);
  });

  it('closing the eyes also lowers them (eyeLookDown rises with the lids): still a BLINK, not a look', () => {
    // MediaPipe reports a closed eye as looking down too; the look did not come first, so it is his blink.
    const eyes = (t: number) => {
      const on = t >= 500 && t < 750;
      const v = on ? 0.9 : 0.05;
      const q = on ? 0.8 : 0.05;
      const d = on ? 0.7 : 0.05;
      return {
        eyeBlinkLeft: v,
        eyeBlinkRight: v,
        eyeSquintLeft: q,
        eyeSquintRight: q,
        eyeLookDownLeft: d,
      };
    };
    expect(signals(record(2000, { eyes }))).toEqual(['BLINK']);
  });

  it('eyes squeezed shut for 4 s is still not a blink (too long)', () => {
    expect(signals(record(6000, { eyes: squeezed(500, 4500) }))).toEqual([]);
  });
});

describe('detector: long blink (spec 011, R1)', () => {
  it('a 700 ms closure is one BLINK, sent when the eyes open', () => {
    const found = detectAll(record(2000, { eyes: closed(500, 1200) }), P);
    expect(found.map((x) => x.signal)).toEqual(['BLINK']);
    expect(found[0].at).toBeGreaterThanOrEqual(1200);
  });

  it('an involuntary 200 ms blink is ignored', () => {
    expect(signals(record(2000, { eyes: closed(500, 700) }))).toEqual([]);
  });

  it('eyes closed for 4 s (resting) is not a blink', () => {
    expect(signals(record(6000, { eyes: closed(500, 4500) }))).toEqual([]);
  });

  it('three long blinks are three signals', () => {
    const eyes = (t: number) => {
      const v = pulses(
        [
          [300, 1100, 0.9],
          [1700, 2500, 0.9],
          [3100, 3900, 0.9],
        ],
        0.05,
      )(t);
      return { eyeBlinkLeft: v, eyeBlinkRight: v };
    };
    expect(signals(record(4500, { eyes }))).toEqual(['BLINK', 'BLINK', 'BLINK']);
  });

  it('one eye closed (a wink, or a droopy lid) is not a blink: both eyes must close', () => {
    const eyes = (t: number) => ({ eyeBlinkLeft: pulse(500, 1300, 0.9, 0.05)(t) });
    expect(signals(record(2000, { eyes }))).toEqual([]);
  });

  it('noise around the threshold does not split one blink into two (hysteresis)', () => {
    // 0.9, then a dip to 0.45 (below the threshold, above the release level), then 0.9 again.
    const eyes = (t: number) => {
      const v = pulses(
        [
          [400, 800, 0.9],
          [800, 830, 0.45],
          [830, 1200, 0.9],
        ],
        0.05,
      )(t);
      return { eyeBlinkLeft: v, eyeBlinkRight: v };
    };
    expect(signals(record(2000, { eyes }))).toEqual(['BLINK']);
  });
});

describe('detector: the look at his hand', () => {
  it('eyes down for 600 ms is one HAND, even if held longer', () => {
    const eyes = (t: number) => ({ eyeLookDownLeft: pulse(300, 1800, 0.8, 0.05)(t) });
    const found = detectAll(record(2500, { eyes }), P);
    expect(found.map((x) => x.signal)).toEqual(['HAND']);
    expect(found[0].at).toBeGreaterThanOrEqual(300 + P.hand.holdMs);
  });

  it('a glance down shorter than the hold is nothing', () => {
    const eyes = (t: number) => ({ eyeLookDownRight: pulse(300, 500, 0.8, 0.05)(t) });
    expect(signals(record(1500, { eyes }))).toEqual([]);
  });

  it('looking down lowers the lids: that closure is not a blink', () => {
    const eyes = (t: number) => {
      const lids = pulse(300, 1300, 0.7, 0.05)(t);
      return {
        eyeLookDownLeft: pulse(300, 1300, 0.8, 0.05)(t),
        eyeBlinkLeft: lids,
        eyeBlinkRight: lids,
      };
    };
    expect(signals(record(2000, { eyes }))).toEqual(['HAND']);
  });

  it('two looks are two signals; a hand + 2 blinks is HAND, BLINK, BLINK (7)', () => {
    const eyes = (t: number) => {
      const lids = pulses(
        [
          [1500, 2200, 0.9],
          [2800, 3500, 0.9],
        ],
        0.05,
      )(t);
      return {
        eyeLookDownLeft: pulse(200, 900, 0.8, 0.05)(t),
        eyeBlinkLeft: lids,
        eyeBlinkRight: lids,
      };
    };
    expect(signals(record(4000, { eyes }))).toEqual(['HAND', 'BLINK', 'BLINK']);
  });
});

describe('detector: head signals', () => {
  it('a nod down and back within the window is NOD', () => {
    expect(signals(record(2000, { pitch: pulse(400, 900, -18) }))).toEqual(['NOD']);
  });

  it('a slow look down that stays (over the window) is not a nod', () => {
    expect(signals(record(4000, { pitch: pulse(400, 2500, -18) }))).toEqual([]);
  });

  it('with a learnt direction, the other way is not a nod', () => {
    const profile = { ...P, nod: { ...P.nod, direction: -1 as const } };
    expect(signals(record(2000, { pitch: pulse(400, 900, 18) }), profile)).toEqual([]);
    expect(signals(record(2000, { pitch: pulse(400, 900, -18) }), profile)).toEqual(['NOD']);
  });

  it('left then right within the window is SHAKE, once', () => {
    const yaw = pulses([
      [300, 500, -15],
      [600, 800, 15],
      [900, 1100, -15],
    ]);
    expect(signals(record(2000, { yaw }))).toEqual(['SHAKE']);
  });

  it('a head right held and back is RIGHT, not a shake', () => {
    expect(signals(record(2000, { yaw: pulse(300, 900, 25) }))).toEqual(['RIGHT']);
  });

  it('a head turn to his left is not RIGHT', () => {
    expect(signals(record(2000, { yaw: pulse(300, 900, -25) }))).toEqual([]);
  });

  it('a quick flick right (shorter than the hold) is not RIGHT', () => {
    expect(signals(record(2000, { yaw: pulse(300, 400, 25) }))).toEqual([]);
  });

  it('the neutral pose is subtracted: a head resting turned 15° is quiet', () => {
    const profile = { ...P, neutral: { yaw: 15, pitch: -10 } };
    expect(signals(record(2000, { yaw: () => 15, pitch: () => -10 }), profile)).toEqual([]);
  });
});

describe('detector: why a closure was or was not his blink (Diagnostyka (Diagnostics))', () => {
  const reports = (frames: Parameters<typeof detectAll>[0]) => closureReports(frames, P);

  it('reports each closure once, when the eyes open, with its length, peaks and verdict', () => {
    const [r] = reports(record(2000, { eyes: squeezed(500, 750) }));
    expect(r.verdict).toBe('blink');
    expect(r.ms).toBeGreaterThanOrEqual(250);
    expect(r.closure).toBeCloseTo(0.9);
    expect(r.squeeze).toBeCloseTo(0.8);
  });

  it('a short closure without the squeeze is weak; a 4 s closure is too long', () => {
    expect(reports(record(2000, { eyes: squeezed(500, 750, 0.3) }))[0].verdict).toBe('weak');
    expect(reports(record(6000, { eyes: closed(500, 4500) }))[0].verdict).toBe('tooLong');
  });

  it('a closure that starts while he already looks down is a look, not a blink', () => {
    const eyes = (t: number) => {
      const v = pulse(800, 1000, 0.9, 0.05)(t);
      return { eyeLookDownLeft: pulse(300, 1200, 0.8, 0.05)(t), eyeBlinkLeft: v, eyeBlinkRight: v };
    };
    expect(reports(record(2000, { eyes }))[0].verdict).toBe('lookingDown');
  });
});

describe('detector: a look at his hand needs a still head, and his side', () => {
  it('a nod with the eyes on the screen reads as looking down, but is only NOD, not HAND', () => {
    // The head goes up 18° for 600 ms; the eyes stay on the screen, so against the head they look down.
    const eyes = (t: number) => ({ eyeLookDownLeft: pulse(300, 900, 0.8, 0.05)(t) });
    expect(signals(record(2000, { pitch: pulse(300, 900, -18), eyes }))).toEqual(['NOD']);
  });

  it('with his left side learnt, down and to his left is HAND; straight down is not', () => {
    const profile = { ...P, hand: { ...P.hand, left: 0.3 } };
    const leftDown = (t: number) => {
      const on = t >= 300 && t < 1000;
      return {
        eyeLookDownLeft: on ? 0.8 : 0.05,
        eyeLookOutLeft: on ? 0.6 : 0.05,
        eyeLookInRight: on ? 0.6 : 0.05,
      };
    };
    expect(signals(record(2000, { eyes: leftDown }), profile)).toEqual(['HAND']);
    const straightDown = (t: number) => ({ eyeLookDownLeft: pulse(300, 1000, 0.8, 0.05)(t) });
    expect(signals(record(2000, { eyes: straightDown }), profile)).toEqual([]);
  });
});

describe('detector: his look at his hand with the head turned and tilted towards it', () => {
  const leftDown = (t: number) => {
    const on = t >= 300 && t < 1000;
    return {
      eyeLookDownLeft: on ? 0.8 : 0.05,
      eyeLookOutLeft: on ? 0.6 : 0.05,
      eyeLookInRight: on ? 0.6 : 0.05,
    };
  };
  const towardsHand = { yaw: pulse(300, 1000, -15), pitch: pulse(300, 1000, 8) };

  it('the head turned 15° and tilted 8° towards his hand is still HAND', () => {
    const profile = { ...P, hand: { ...P.hand, left: 0.3 } };
    expect(signals(record(2000, { eyes: leftDown, ...towardsHand }), profile)).toEqual(['HAND']);
  });

  it('reports each look with its peaks and verdict', () => {
    const profile = { ...P, hand: { ...P.hand, left: 0.3 } };
    const [look] = lookReports(record(2000, { eyes: leftDown, ...towardsHand }), profile);
    expect(look.verdict).toBe('hand');
    expect(look.down).toBeCloseTo(0.8);
    expect(look.left).toBeCloseTo(0.6);
    expect(look.yaw).toBeCloseTo(15);
    const straight = (t: number) => ({ eyeLookDownLeft: pulse(300, 1000, 0.8, 0.05)(t) });
    expect(lookReports(record(2000, { eyes: straight }), profile)[0].verdict).toBe('wrongSide');
    const quick = (t: number) => ({ eyeLookDownLeft: pulse(300, 500, 0.8, 0.05)(t) });
    expect(lookReports(record(2000, { eyes: quick }), P)[0].verdict).toBe('short');
    const nod = { pitch: pulse(300, 900, -18), eyes: straight };
    expect(lookReports(record(2000, nod), P)[0].verdict).toBe('nodding');
  });
});

describe('detector: his strong-blink cue', () => {
  const brows = (brow: number, lids: number) => (t: number) => {
    const on = t >= 500 && t < 750;
    return {
      eyeBlinkLeft: on ? 0.9 : 0.05,
      eyeBlinkRight: on ? 0.9 : 0.05,
      eyeSquintLeft: on ? lids : 0.05,
      eyeSquintRight: on ? lids : 0.05,
      browDownLeft: on ? brow : 0.05,
      browDownRight: on ? brow : 0.05,
    };
  };
  const byBrows = { ...P, blink: { ...P.blink, cue: 'browDown' as const, squeeze: 0.5 } };

  it('uses the cue of his profile: brows down counts, squeezed lids alone do not', () => {
    expect(signals(record(2000, { eyes: brows(0.7, 0.1) }), byBrows)).toEqual(['BLINK']);
    expect(signals(record(2000, { eyes: brows(0.1, 0.9) }), byBrows)).toEqual([]);
  });

  it('a squeeze of 1 turns the strong blink off: only long blinks count', () => {
    const off = { ...P, blink: { ...P.blink, squeeze: 1 } };
    expect(signals(record(2000, { eyes: squeezed(500, 750, 1) }), off)).toEqual([]);
    expect(signals(record(2000, { eyes: closed(500, 1200) }), off)).toEqual(['BLINK']);
  });
});

describe('detector: safety', () => {
  it('a face lost in the middle of a blink drops it', () => {
    const face = (t: number) => t < 800 || t > 1000;
    expect(signals(record(2000, { eyes: closed(500, 1300), face }))).toEqual([]);
  });

  it('after a signal, the refractory time passes before the next one', () => {
    // A hand look, and a nod 200 ms after the HAND is sent: only HAND.
    const eyes = (t: number) => ({ eyeLookDownLeft: pulse(0, 700, 0.8, 0.05)(t) });
    const found = detectAll(record(2000, { eyes, pitch: pulse(450, 600, -18) }), P);
    expect(found.map((x) => x.signal)).toEqual(['HAND']);
  });
});
