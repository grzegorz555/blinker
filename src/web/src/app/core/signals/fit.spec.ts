import { describe, expect, it } from 'vitest';
import { countDetected, fitProfile, ordinaryBlinks, percentile } from './fit';
import { DEFAULT_PROFILE as P } from './profile';
import { pulses, record } from './synthetic';

/** His resting face: head turned 8° and tilted -5°, lids a little low (0.2), eyes a little down (0.15). */
const rest = { yaw: () => 8, pitch: () => -5 };
const restEyes = {
  eyeBlinkLeft: 0.2,
  eyeBlinkRight: 0.2,
  eyeLookDownLeft: 0.15,
  eyeLookDownRight: 0.15,
};
const neutral = record(3000, { ...rest, eyes: () => restEyes });

/** Three long blinks of 800 ms that close the eyes to 0.7 only (a weak but deliberate blink). */
const blinks = record(4500, {
  ...rest,
  eyes: (t) => {
    const v = pulses(
      [
        [300, 1100, 0.7],
        [1700, 2500, 0.7],
        [3100, 3900, 0.7],
      ],
      0.2,
    )(t);
    return { ...restEyes, eyeBlinkLeft: v, eyeBlinkRight: v };
  },
});

describe('fitProfile (spec 011, R5)', () => {
  it('with nothing recorded, keeps the previous profile and learns nothing', () => {
    expect(fitProfile({}, P)).toEqual({ profile: P, learnt: [] });
  });

  it('takes his resting head pose as neutral', () => {
    const { profile, learnt } = fitProfile({ neutral }, P);
    expect(profile.neutral).toEqual({ yaw: 8, pitch: -5 });
    expect(learnt).toEqual(['neutral']);
  });

  it('puts the blink threshold halfway between his rest (0.2) and his blinks (0.7), and detects all 3', () => {
    const { profile } = fitProfile({ neutral, blink: blinks }, P);
    expect(profile.blink.threshold).toBeCloseTo(0.45, 2);
    expect(countDetected('blink', blinks, profile)).toBe(3);
    // With the defaults (threshold 0.5 against his resting 0.2 and peaks 0.7) it also works, but closer to the edge.
    expect(profile.blink.minMs).toBeGreaterThanOrEqual(350);
  });

  it('learns his short, strong blinks: a long recording, 3 blinks of 250 ms, ordinary blinks at rest', () => {
    const lids = (list: readonly (readonly [number, number])[], q: number) => (t: number) => {
      const on = list.some(([a, b]) => t >= a && t < b);
      return {
        ...restEyes,
        eyeBlinkLeft: on ? 0.9 : 0.2,
        eyeBlinkRight: on ? 0.9 : 0.2,
        eyeSquintLeft: on ? q : 0.05,
        eyeSquintRight: on ? q : 0.05,
      };
    };
    // At rest he blinks twice to wet his eyes: short, the lids barely squeezed (0.3).
    const calm = record(4000, {
      ...rest,
      eyes: lids(
        [
          [1000, 1200],
          [2500, 2700],
        ],
        0.3,
      ),
    });
    // 12 s for 3 strong blinks: closed in about 6 % of the frames, which a percentile of all frames would miss.
    const strong = record(12000, {
      ...rest,
      eyes: lids(
        [
          [2000, 2250],
          [6000, 6250],
          [10000, 10250],
        ],
        0.8,
      ),
    });
    const { profile, learnt } = fitProfile({ neutral: calm, blink: strong }, P);
    expect(learnt).toContain('blink');
    expect(profile.blink.squeeze).toBeCloseTo(0.55, 2);
    expect(countDetected('blink', strong, profile)).toBe(3);
    expect(countDetected('blink', calm, profile)).toBe(0);
  });

  describe('his strong blink against his ordinary ones', () => {
    type Shapes = Partial<Record<'eyeSquint' | 'cheekSquint' | 'browDown', number>>;
    const blinksAt = (list: readonly (readonly [number, number])[], on: Shapes) => (t: number) => {
      const closed = list.some(([a, b]) => t >= a && t < b);
      const v = (k: keyof Shapes) => (closed ? (on[k] ?? 0.05) : 0.05);
      return {
        ...restEyes,
        eyeBlinkLeft: closed ? 0.9 : 0.2,
        eyeBlinkRight: closed ? 0.9 : 0.2,
        eyeSquintLeft: v('eyeSquint'),
        eyeSquintRight: v('eyeSquint'),
        cheekSquintLeft: v('cheekSquint'),
        cheekSquintRight: v('cheekSquint'),
        browDownLeft: v('browDown'),
        browDownRight: v('browDown'),
      };
    };
    const calm = (on: Shapes) =>
      record(4000, {
        ...rest,
        eyes: blinksAt(
          [
            [1000, 1200],
            [2500, 2700],
          ],
          on,
        ),
      });
    const strong = (on: Shapes) =>
      record(6000, {
        ...rest,
        eyes: blinksAt(
          [
            [1000, 1250],
            [3000, 3250],
            [5000, 5250],
          ],
          on,
        ),
      });

    it('counts his ordinary blinks at rest', () => {
      expect(ordinaryBlinks(calm({ eyeSquint: 0.3 }))).toBe(2);
      expect(ordinaryBlinks(neutral)).toBe(0);
    });

    it('picks the cue that tells them apart best (here the brows), and says it is ok', () => {
      const r = {
        neutral: calm({ eyeSquint: 0.6 }),
        blink: strong({ eyeSquint: 0.7, browDown: 0.6 }),
      };
      const fit = fitProfile(r, P);
      expect(fit.profile.blink.cue).toBe('browDown');
      // Halfway between his ordinary blinks (0.05) and the weaker strong one (0.6).
      expect(fit.profile.blink.squeeze).toBeCloseTo(0.325, 1);
      expect(fit.blink).toEqual({ separation: 'ok', ordinary: 2 });
      expect(countDetected('blink', r.blink, fit.profile)).toBe(3);
      expect(countDetected('blink', r.neutral, fit.profile)).toBe(0);
    });

    it('when they look alike, turns the strong blink off rather than type a letter on an ordinary blink', () => {
      const r = { neutral: calm({ eyeSquint: 0.8 }), blink: strong({ eyeSquint: 0.8 }) };
      const fit = fitProfile(r, P);
      expect(fit.profile.blink.squeeze).toBe(1);
      expect(fit.blink?.separation).toBe('overlap');
      expect(countDetected('blink', r.neutral, fit.profile)).toBe(0);
    });

    it('without ordinary blinks at rest, the threshold is a guess and says so', () => {
      const fit = fitProfile({ neutral, blink: strong({ eyeSquint: 0.8 }) }, P);
      expect(fit.blink?.separation).toBe('noOrdinary');
      expect(fit.profile.blink.squeeze).toBeLessThan(0.8);
    });
  });

  describe('his glance at his hand (spec 015, R8)', () => {
    // His sides from his profile of 2026-11-17: his left is yaw +1, his right -1.
    const his = {
      ...P,
      hand: { ...P.hand, direction: 1 as const },
      right: { ...P.right, direction: -1 as const },
    };
    /** Two quick turns of the head from his neutral (yaw 8, pitch -5), `tilt` degrees of pitch during each. */
    const glances = (first: number, second: number, tilt = 0) => {
      const list = [
        [300, 900],
        [2000, 2600],
      ] as const;
      return record(4000, {
        yaw: pulses(
          [
            [...list[0], 8 + first],
            [...list[1], 8 + second],
          ],
          8,
        ),
        pitch: pulses(
          list.map(([a, b]) => [a, b, -5 + tilt] as const),
          -5,
        ),
      });
    };

    it('two glances of 44° and 65° to his left learn amplitude ≈ 30°, direction 1 and the signed pitch', () => {
      const hand = glances(44, 65, 9);
      const { profile, learnt } = fitProfile({ neutral, hand }, his);
      expect(learnt).toEqual(['neutral', 'hand']);
      // Half of the peak (65°), so his smaller glance (44°) still passes it.
      expect(profile.hand.amplitude).toBe(32.5);
      expect(profile.hand.direction).toBe(1);
      expect(profile.hand.pitch).toBe(9);
      expect(profile.hand.windowMs).toBe(his.hand.windowMs);
      expect(countDetected('hand', hand, profile)).toBe(2);
    });

    it('keeps the sign of a glance to the other side and of a pitch up', () => {
      const left = { ...P, right: { ...P.right, direction: 1 as const } };
      const { profile } = fitProfile({ neutral, hand: glances(-50, -50, -8) }, left);
      expect(profile.hand).toEqual({ ...P.hand, amplitude: 25, direction: -1, pitch: -8 });
    });

    it('a step too small (under 6°) is not learnt and keeps the previous hand', () => {
      const { profile, learnt } = fitProfile({ neutral, hand: glances(5, 5, 9) }, his);
      expect(learnt).toEqual(['neutral']);
      expect(profile.hand).toEqual(his.hand);
    });

    it('a step on the side of head right is not learnt: the same turn cannot mean both', () => {
      const { profile, learnt } = fitProfile({ neutral, hand: glances(-50, -50) }, his, true);
      expect(learnt).toEqual(['neutral']);
      expect(profile.hand).toEqual(his.hand);
    });

    it('compares with head right learnt in the same calibration, not the guess of the defaults', () => {
      const right = record(3000, {
        pitch: () => -5,
        yaw: pulses([[300, 1000, -22]], 8),
      });
      // The defaults guess his right is +1; he turns his right to -1 and his hand to +1.
      const fit = fitProfile({ neutral, hand: glances(50, 50), right }, P);
      expect(fit.learnt).toEqual(['neutral', 'hand', 'right']);
      expect(fit.profile.hand.direction).toBe(1);
      expect(fit.profile.right.direction).toBe(-1);
      // Without the hand step, his hand moves to the other side of his new right.
      const noHand = fitProfile({ neutral, right }, P);
      expect(noHand.learnt).toEqual(['neutral', 'right']);
      expect(noHand.profile.hand).toEqual({ ...P.hand, direction: 1 });
    });

    it('a head right that is only the guess of the defaults never refuses his glance: the guess moves to the other side', () => {
      // Head right skipped, no calibration before: the default guess is on the side of his glance.
      const guess = { ...P, right: { ...P.right, direction: 1 as const } };
      const { profile, learnt } = fitProfile({ neutral, hand: glances(50, 50) }, guess);
      expect(learnt).toEqual(['neutral', 'hand']);
      expect(profile.hand.direction).toBe(1);
      expect(profile.right.direction).toBe(-1);
      // From a calibrated profile the same head right is his, and refuses that side.
      expect(fitProfile({ neutral, hand: glances(50, 50) }, guess, true).learnt).toEqual([
        'neutral',
      ]);
    });
  });

  it('a step without a real movement keeps the previous value (not learnt)', () => {
    const still = record(3000, { ...rest, eyes: () => restEyes });
    const { profile, learnt } = fitProfile({ neutral, blink: still, nod: still }, P);
    expect(profile.blink).toEqual(P.blink);
    expect(profile.nod).toEqual(P.nod);
    expect(learnt).toEqual(['neutral']);
  });

  it('learns the nod direction and size relative to neutral', () => {
    const nod = record(3000, {
      yaw: () => 8,
      pitch: pulses(
        [
          [300, 800, -25],
          [1500, 2000, -25],
        ],
        -5,
      ),
    });
    const { profile } = fitProfile({ neutral, nod }, P);
    expect(profile.nod.direction).toBe(-1);
    expect(profile.nod.amplitude).toBe(10); // half of 20° from his neutral -5°
    expect(countDetected('nod', nod, profile)).toBe(2);
  });

  it('learns which way his right is, and its size', () => {
    const right = record(3000, {
      pitch: () => -5,
      yaw: pulses(
        [
          [300, 1000, -22],
          [1600, 2300, -22],
        ],
        8,
      ),
    });
    const { profile } = fitProfile({ neutral, right }, P);
    expect(profile.right.direction).toBe(-1);
    expect(profile.right.amplitude).toBeCloseTo(18, 1);
    expect(countDetected('right', right, profile)).toBe(2);
  });

  it('learns the shake size', () => {
    const shake = record(3000, {
      pitch: () => -5,
      yaw: pulses(
        [
          [300, 500, -6],
          [600, 800, 22],
          [1500, 1700, -6],
          [1800, 2000, 22],
        ],
        8,
      ),
    });
    const { profile, learnt } = fitProfile({ neutral, shake }, P);
    expect(profile.shake.amplitude).toBe(7);
    expect(learnt).toEqual(['neutral', 'shake']);
  });

  it('clamps to the safe ranges', () => {
    const huge = record(2000, { pitch: pulses([[300, 800, 170]]) });
    expect(fitProfile({ nod: huge }, P).profile.nod.amplitude).toBe(45);
  });
});

describe('percentile', () => {
  it('nearest rank, NaN without values', () => {
    expect(percentile([5, 1, 3], 50)).toBe(3);
    expect(percentile([], 50)).toBeNaN();
  });
});
