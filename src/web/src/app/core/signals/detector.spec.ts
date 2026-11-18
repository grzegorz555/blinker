import { describe, expect, it } from 'vitest';
import { closureReports, detectAll, HAND_SETTLE_MS, headReports } from './detector';
import { DEFAULT_PROFILE as P, type SignalProfile } from './profile';
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

  it('a head turn to his left is not RIGHT (it is his hand, spec 015)', () => {
    expect(signals(record(2000, { yaw: pulse(300, 900, -25) }))).toEqual(['HAND']);
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

  it('looking down with the eyes no longer changes a closure (spec 015, R6): a short one is weak', () => {
    const eyes = (t: number) => {
      const v = pulse(800, 1000, 0.9, 0.05)(t);
      return { eyeLookDownLeft: pulse(300, 1200, 0.8, 0.05)(t), eyeBlinkLeft: v, eyeBlinkRight: v };
    };
    expect(reports(record(2000, { eyes }))[0].verdict).toBe('weak');
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

// His numbers, measured in Diagnostyka (Diagnostics) on 2026-11-17 (spec 015): neutral yaw 4.9°, pitch 5.7°; nod 7.7°,
// direction 1; shake 16°; head right 34°, direction -1; his glance at his left hand 44–65° of yaw and 8–9° of pitch
// down. His left is yaw +1 (the other way from his right).
const HIS = { yaw: 4.9, pitch: 5.7 };
const HIM: SignalProfile = {
  ...P,
  neutral: HIS,
  hand: { amplitude: 25, direction: 1, pitch: 0, windowMs: 1500 },
  nod: { amplitude: 7.7, direction: 1, windowMs: 1200 },
  shake: { amplitude: 16, windowMs: 1500 },
  right: { amplitude: 34, direction: -1, holdMs: 300 },
};
/** A turn of the head from his neutral (degrees, his sign) between `from` and `to` ms. */
const turn = (from: number, to: number, deg: number) => pulse(from, to, HIS.yaw + deg, HIS.yaw);
const tilt = (from: number, to: number, deg: number) => pulse(from, to, HIS.pitch + deg, HIS.pitch);
/** His frames: the head at his neutral unless the motion says otherwise. */
const hisRecord = (ms: number, motion: Parameters<typeof record>[1] = {}) =>
  record(ms, { yaw: () => HIS.yaw, pitch: () => HIS.pitch, ...motion });
const his = (frames: Parameters<typeof detectAll>[0]) => signals(frames, HIM);

describe('detector: his look at his hand is a quick turn of the head to his left and back (spec 015, R1)', () => {
  it('a turn of 50° to his left and back within 1.5 s is one HAND, sent after the settle', () => {
    const found = detectAll(
      hisRecord(2500, { yaw: turn(300, 900, 50), pitch: () => HIS.pitch }),
      HIM,
    );
    expect(found.map((x) => x.signal)).toEqual(['HAND']);
    expect(found[0].at).toBeGreaterThanOrEqual(900 + HAND_SETTLE_MS);
  });

  it('the pitch does not decide: a 4° wobble or 9° down gives the same HAND', () => {
    const wobble = (t: number) => HIS.pitch + 4 * Math.sin(t / 50);
    expect(his(hisRecord(2500, { yaw: turn(300, 900, 50), pitch: wobble }))).toEqual(['HAND']);
    expect(his(hisRecord(2500, { yaw: turn(300, 900, 50), pitch: tilt(300, 900, 9) }))).toEqual([
      'HAND',
    ]);
  });

  it('his smallest and largest glances (44° and 65°) both count', () => {
    expect(his(hisRecord(2500, { yaw: turn(300, 900, 44) }))).toEqual(['HAND']);
    expect(his(hisRecord(2500, { yaw: turn(300, 900, 65) }))).toEqual(['HAND']);
  });

  it('a turn held 2 s is not a hand (he is looking at something)', () => {
    expect(his(hisRecord(3500, { yaw: turn(300, 2300, 50) }))).toEqual([]);
  });

  it('a turn under the amplitude is nothing', () => {
    expect(his(hisRecord(2500, { yaw: turn(300, 900, 20) }))).toEqual([]);
  });

  it('a turn to his right (head right) is RIGHT, not HAND', () => {
    expect(his(hisRecord(2500, { yaw: turn(300, 900, -40) }))).toEqual(['RIGHT']);
  });

  it('the turn must come back within half of the amplitude: stopping at 15° is not back yet', () => {
    // Out to 50°, back only to 15° (over half of 25°) and held: no hand, then fully back after the window.
    const yaw = (t: number) => HIS.yaw + (t >= 300 && t < 600 ? 50 : t >= 600 && t < 2500 ? 15 : 0);
    expect(his(hisRecord(3500, { yaw }))).toEqual([]);
  });

  it('the eye look down alone is no longer a hand (R6)', () => {
    const eyes = (t: number) => ({
      eyeLookDownLeft: pulse(300, 1300, 0.8, 0.05)(t),
      eyeLookDownRight: pulse(300, 1300, 0.8, 0.05)(t),
    });
    expect(his(hisRecord(2500, { eyes }))).toEqual([]);
    expect(signals(hisRecord(2500, { eyes }))).toEqual([]);
  });

  it('without a face the turn is dropped, also if the face comes back while the head is still turned', () => {
    const lostOut = (t: number) => t < 500 || t > 700;
    expect(his(hisRecord(2500, { yaw: turn(300, 900, 50), face: lostOut }))).toEqual([]);
    const lostBack = (t: number) => t < 800 || t > 1000;
    expect(his(hisRecord(2500, { yaw: turn(300, 900, 50), face: lostBack }))).toEqual([]);
  });

  it('without a head pose the turn is dropped', () => {
    const frames = hisRecord(2500, { yaw: turn(300, 900, 50) }).map((f) =>
      f.timestamp >= 500 && f.timestamp < 700 ? { ...f, head: null } : f,
    );
    expect(his(frames)).toEqual([]);
  });

  it('two glances are two HANDs', () => {
    const yaw = pulses(
      [
        [300, 900, HIS.yaw + 50],
        [2000, 2600, HIS.yaw + 60],
      ],
      HIS.yaw,
    );
    expect(his(hisRecord(3500, { yaw }))).toEqual(['HAND', 'HAND']);
  });
});

describe('detector: a hand is one side only; a shake wins (spec 015, R2)', () => {
  it('left past the amplitude, then right past the shake amplitude within the settle, is SHAKE only', () => {
    const yaw = pulses(
      [
        [300, 600, HIS.yaw + 40],
        [650, 850, HIS.yaw - 20],
      ],
      HIS.yaw,
    );
    expect(his(hisRecord(2500, { yaw }))).toEqual(['SHAKE']);
  });

  it('his shake that starts on the right and swings past the hand amplitude is SHAKE only', () => {
    const yaw = pulses(
      [
        [300, 500, HIS.yaw - 20],
        [550, 800, HIS.yaw + 40],
      ],
      HIS.yaw,
    );
    expect(his(hisRecord(2500, { yaw }))).toEqual(['SHAKE']);
  });

  it('his ordinary shake (±20°, under the hand) is SHAKE', () => {
    const yaw = pulses(
      [
        [300, 500, HIS.yaw + 20],
        [600, 800, HIS.yaw - 20],
      ],
      HIS.yaw,
    );
    expect(his(hisRecord(2000, { yaw }))).toEqual(['SHAKE']);
  });

  it('after a HAND, a turn to his right within the shake window is not half a shake', () => {
    // The glance passed the shake amplitude on his left at 300 ms; the right at 1500 ms is still inside 1.5 s of it.
    const yaw = pulses(
      [
        [300, 800, HIS.yaw + 50],
        [1500, 1700, HIS.yaw - 20],
      ],
      HIS.yaw,
    );
    expect(his(hisRecord(2500, { yaw }))).toEqual(['HAND']);
  });
});

describe('detector: a nod has no side (spec 015, R3)', () => {
  it('his glance (yaw 50°, pitch 9° down, past his nod of 7.7°) is HAND, not NOD', () => {
    expect(his(hisRecord(2500, { yaw: turn(300, 900, 50), pitch: tilt(300, 900, 9) }))).toEqual([
      'HAND',
    ]);
  });

  it('a glance whose pitch comes back after the yaw is still not a nod', () => {
    expect(his(hisRecord(2500, { yaw: turn(300, 800, 50), pitch: tilt(300, 900, 9) }))).toEqual([
      'HAND',
    ]);
  });

  it('a glance whose pitch starts before the yaw is still not a nod', () => {
    expect(his(hisRecord(2500, { yaw: turn(400, 900, 50), pitch: tilt(300, 900, 9) }))).toEqual([
      'HAND',
    ]);
  });

  it('a plain nod (pitch 12°, yaw under 3°) is still NOD', () => {
    expect(his(hisRecord(2000, { yaw: () => HIS.yaw + 2.5, pitch: tilt(300, 700, 12) }))).toEqual([
      'NOD',
    ]);
  });
});

describe('detector: a closure during the turn is not a blink (spec 015, R5)', () => {
  it('a long closure that starts during the turn is atHand, not BLINK', () => {
    const frames = hisRecord(2500, { yaw: turn(300, 900, 50), eyes: closed(500, 1200) });
    expect(his(frames)).toEqual(['HAND']);
    expect(closureReports(frames, HIM)[0].verdict).toBe('atHand');
  });

  it('a closure that began before the turn and is still going when HAND is sent is atHand', () => {
    const frames = hisRecord(2500, { yaw: turn(300, 700, 50), eyes: closed(200, 1300) });
    expect(his(frames)).toEqual(['HAND']);
    expect(closureReports(frames, HIM)[0].verdict).toBe('atHand');
  });

  it('a blink after the hand is a BLINK again', () => {
    const frames = hisRecord(3500, { yaw: turn(300, 700, 50), eyes: closed(1800, 2600) });
    expect(his(frames)).toEqual(['HAND', 'BLINK']);
  });
});

describe('detector: the report of each movement of the head (spec 015, R9)', () => {
  const reports = (frames: Parameters<typeof detectAll>[0]) => headReports(frames, HIM);

  it('his glance: one report when it is over, with its length, signed peaks, the signal and the verdict', () => {
    const [r, ...rest] = reports(
      hisRecord(2500, { yaw: turn(300, 900, 50), pitch: tilt(300, 900, 9) }),
    );
    expect(rest).toEqual([]);
    expect(r.verdict).toBe('hand');
    expect(r.signal).toBe('HAND');
    expect(r.yaw).toBeCloseTo(50);
    expect(r.pitch).toBeCloseTo(9);
    expect(r.ms).toBeGreaterThanOrEqual(590);
    expect(r.ms).toBeLessThanOrEqual(640);
  });

  it('the peaks keep their sign: a head right is negative, otherSide, RIGHT', () => {
    const [r] = reports(hisRecord(2500, { yaw: turn(300, 900, -40), pitch: tilt(300, 900, -3) }));
    expect(r).toMatchObject({ signal: 'RIGHT', verdict: 'otherSide' });
    expect(r.yaw).toBeCloseTo(-40);
    expect(r.pitch).toBeCloseTo(-3);
  });

  it('too small, too slow and a shake each say why', () => {
    expect(reports(hisRecord(2500, { yaw: turn(300, 900, 20) }))[0]).toMatchObject({
      verdict: 'small',
      signal: null,
    });
    expect(reports(hisRecord(3500, { yaw: turn(300, 2300, 50) }))[0].verdict).toBe('slow');
    const shake = pulses(
      [
        [300, 600, HIS.yaw + 40],
        [650, 850, HIS.yaw - 20],
      ],
      HIS.yaw,
    );
    const [s, ...more] = reports(hisRecord(2500, { yaw: shake }));
    expect(more).toEqual([]);
    expect(s).toMatchObject({ verdict: 'shake', signal: 'SHAKE' });
    expect(s.yaw).toBeCloseTo(40);
  });

  it('a plain nod is reported with its pitch and NOD; a movement under 6° is not reported', () => {
    const [n] = reports(hisRecord(2000, { pitch: tilt(300, 700, 12) }));
    expect(n).toMatchObject({ signal: 'NOD' });
    expect(n.pitch).toBeCloseTo(12);
    expect(reports(hisRecord(2000, { yaw: turn(300, 900, 5) }))).toEqual([]);
  });

  it('a hand refused by the refractory time is judged too soon, without a signal', () => {
    // A blink sent at 700 ms, before the turn; the hand would come at about 1500 ms, inside a refractory time of 1 s.
    const slowDown = { ...HIM, refractoryMs: 1000 };
    const frames = hisRecord(2500, { yaw: turn(800, 1200, 50), eyes: closed(0, 700) });
    const [r] = headReports(frames, slowDown);
    expect(r).toMatchObject({ verdict: 'tooSoon', signal: null });
    expect(signals(frames, slowDown)).toEqual(['BLINK']);
  });
});

describe('detector: safety', () => {
  it('a face lost in the middle of a blink drops it', () => {
    const face = (t: number) => t < 800 || t > 1000;
    expect(signals(record(2000, { eyes: closed(500, 1300), face }))).toEqual([]);
  });

  it('after a signal, the refractory time passes before the next one', () => {
    // A glance at his hand (HAND at about 1000 ms), and a nod 100 ms later: only HAND.
    const frames = record(2500, {
      yaw: pulse(300, 700, HIS.yaw + 50, HIS.yaw),
      pitch: pulse(1100, 1300, HIS.pitch + 12, HIS.pitch),
    });
    expect(signals(frames, HIM)).toEqual(['HAND']);
  });
});
