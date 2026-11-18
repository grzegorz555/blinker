// Spec 011, R5: his profile from short recordings of each movement (Kalibracja (Calibration)). Plain TypeScript.
//
// Each threshold lies halfway between his value at rest and the median of his deliberate peaks, so a weak but
// deliberate movement still counts and a resting face does not. Medians and percentiles, not maxima, so one odd frame
// (a sneeze, a lost face) doesn't move a threshold. Everything is clamped to the safe ranges of the profile, and a step
// whose movement was too small to tell from rest keeps the previous value (it is not "learnt").
import type { FaceFrame } from '../vision/face-frame';
import { closureOf, cuesOf, maxCues, STRONG_CUES, type CueValues, type StrongCue } from './cues';
import { detectAll, type FaceSignal } from './detector';
import { PROFILE_LIMITS, type SignalProfile } from './profile';

export const CALIBRATION_STEPS = ['neutral', 'blink', 'hand', 'nod', 'shake', 'right'] as const;
export type CalibrationStep = (typeof CALIBRATION_STEPS)[number];
export type Recordings = Partial<Record<CalibrationStep, readonly FaceFrame[]>>;

/** What each movement step should produce, and how many times we ask for it. */
export const STEP_SIGNAL: Record<Exclude<CalibrationStep, 'neutral'>, FaceSignal> = {
  blink: 'BLINK',
  hand: 'HAND',
  nod: 'NOD',
  shake: 'SHAKE',
  right: 'RIGHT',
};
export const STEP_REPEATS: Record<Exclude<CalibrationStep, 'neutral'>, number> = {
  blink: 3,
  hand: 2,
  nod: 2,
  shake: 2,
  right: 2,
};

/** The smallest difference from rest that counts as a deliberate movement. */
export const MIN_CONTRAST = { eyes: 0.2, squeeze: 0.1, angle: 6 } as const;

/**
 * How well his strong blinks stand apart from his ordinary ones: `ok`; `noOrdinary` (no ordinary blink in the rest
 * step, so the threshold is a rough guess against his resting face); `overlap` (they look alike to the camera, so only
 * long blinks count).
 */
export type BlinkSeparation = 'ok' | 'noOrdinary' | 'overlap';

export interface Fit {
  readonly profile: SignalProfile;
  /** The steps that changed the profile; the others kept the previous values. */
  readonly learnt: readonly CalibrationStep[];
  /** Set when the blink was learnt. */
  readonly blink?: { readonly separation: BlinkSeparation; readonly ordinary: number };
}

const clamp = (v: number, [min, max]: readonly [number, number]) => Math.min(max, Math.max(min, v));
const round = (v: number, digits = 2) => Math.round(v * 10 ** digits) / 10 ** digits;

/** Nearest-rank percentile; NaN without values. */
export function percentile(values: readonly number[], p: number): number {
  if (!values.length) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
}

const withFace = (frames: readonly FaceFrame[] | undefined) => (frames ?? []).filter((f) => f.face);
interface Closure {
  readonly ms: number;
  readonly closure: number;
  readonly cues: CueValues;
}

/** Each closure of the eyes (both at or above `threshold`): how long, how far closed, how strong at most. */
function closures(frames: readonly FaceFrame[], threshold: number): Closure[] {
  const out: Closure[] = [];
  let open: { start: number; closure: number; cues: CueValues } | null = null;
  for (const f of frames) {
    const c = closureOf(f);
    if (c < threshold) {
      if (open) out.push({ ms: f.timestamp - open.start, closure: open.closure, cues: open.cues });
      open = null;
    } else if (open) {
      open.closure = Math.max(open.closure, c);
      open.cues = maxCues(open.cues, cuesOf(f));
    } else {
      open = { start: f.timestamp, closure: c, cues: cuesOf(f) };
    }
  }
  return out;
}

/** His ordinary blinks in a rest recording (Kalibracja (Calibration) shows how many it has seen). */
export function ordinaryBlinks(frames: readonly FaceFrame[] | undefined): number {
  const rest = withFace(frames);
  if (!rest.length) return 0;
  return closures(rest, percentile(rest.map(closureOf), 50) + MIN_CONTRAST.eyes).length;
}

/** The value with the largest size among the top 5 %, with its sign (a movement and its direction). */
function peak(values: readonly number[]): number {
  const size = percentile(values.map(Math.abs), 95);
  if (Number.isNaN(size)) return Number.NaN;
  const big = values.filter((v) => Math.abs(v) >= size * 0.8);
  return Math.sign(percentile(big, 50)) * size;
}

/**
 * `previousCalibrated`: the previous profile came from a calibration, so its head right is his, not the guess of the
 * defaults (spec 015, R8: only a known head right can refuse his hand).
 */
export function fitProfile(
  recordings: Recordings,
  previous: SignalProfile,
  previousCalibrated = false,
): Fit {
  const L = PROFILE_LIMITS;
  const learnt: CalibrationStep[] = [];
  let blinkFit: Fit['blink'];
  let p: SignalProfile = previous;

  // Rest: his head pose, and his eyes open and looking at the screen.
  const rest = withFace(recordings.neutral);
  let restClosure = 0.1;
  if (rest.length) {
    const yaw = percentile(
      rest.map((f) => f.head?.yaw ?? 0),
      50,
    );
    const pitch = percentile(
      rest.map((f) => f.head?.pitch ?? 0),
      50,
    );
    p = {
      ...p,
      neutral: { yaw: round(clamp(yaw, L.angle), 1), pitch: round(clamp(pitch, L.angle), 1) },
    };
    restClosure = percentile(rest.map(closureOf), 50);
    learnt.push('neutral');
  }

  // His blinks, one closure at a time: a short blink is only a few frames of a recording, so a percentile of all
  // frames would miss it. A closure is anything clearly more closed than his rest.
  const blink = withFace(recordings.blink);
  const deliberate = closures(blink, restClosure + MIN_CONTRAST.eyes);
  if (deliberate.length) {
    const blinkPeak = percentile(
      deliberate.map((c) => c.closure),
      50,
    );
    const threshold = clamp(restClosure + (blinkPeak - restClosure) / 2, L.threshold);
    const typical = percentile(
      closures(blink, threshold).map((c) => c.ms),
      50,
    );
    // His long blinks, minus a margin; never so short that an involuntary blink (100–300 ms) passes.
    const minMs = Number.isNaN(typical)
      ? p.blink.minMs
      : Math.round(clamp(Math.min(p.blink.minMs, typical * 0.6), [350, L.blinkMinMs[1]]));
    // His strong blinks: of the three cues, the one with the widest gap between his ordinary blinks (in the rest
    // step; without them, his resting face) and the weaker of his strong ones; the threshold in the middle of the gap.
    // Without a gap, the strong blink is off and only long blinks count: an ordinary blink must never type a letter.
    const ordinary = closures(rest, threshold);
    const strong = closures(blink, threshold);
    const gaps = STRONG_CUES.map((cue) => {
      const top = ordinary.length
        ? Math.max(...ordinary.map((c) => c.cues[cue]))
        : percentile(
            rest.map((f) => cuesOf(f)[cue]),
            50,
          );
      const low = percentile(
        strong.map((c) => c.cues[cue]),
        25,
      );
      return { cue, top: Number.isNaN(top) ? 0 : top, gap: low - (Number.isNaN(top) ? 0 : top) };
    }).sort((a, b) => b.gap - a.gap);
    const best = gaps[0];
    const needed = ordinary.length ? MIN_CONTRAST.squeeze / 2 : MIN_CONTRAST.squeeze;
    const separation: BlinkSeparation =
      best.gap >= needed ? (ordinary.length ? 'ok' : 'noOrdinary') : 'overlap';
    const cue: StrongCue = separation === 'overlap' ? p.blink.cue : best.cue;
    const squeeze = separation === 'overlap' ? 1 : round(clamp(best.top + best.gap / 2, L.squeeze));
    p = { ...p, blink: { ...p.blink, threshold: round(threshold), minMs, cue, squeeze } };
    blinkFit = { separation, ordinary: ordinary.length };
    learnt.push('blink');
  }

  const nod = withFace(recordings.nod).map((f) => (f.head?.pitch ?? 0) - p.neutral.pitch);
  const nodPeak = peak(nod);
  if (Math.abs(nodPeak) >= MIN_CONTRAST.angle) {
    p = {
      ...p,
      nod: {
        ...p.nod,
        amplitude: round(clamp(Math.abs(nodPeak) / 2, L.amplitude), 1),
        direction: Math.sign(nodPeak) as -1 | 1,
      },
    };
    learnt.push('nod');
  }

  const shake = withFace(recordings.shake).map((f) => (f.head?.yaw ?? 0) - p.neutral.yaw);
  const shakeSize = percentile(shake.map(Math.abs), 95);
  if (shakeSize >= MIN_CONTRAST.angle) {
    p = { ...p, shake: { ...p.shake, amplitude: round(clamp(shakeSize / 2, L.amplitude), 1) } };
    learnt.push('shake');
  }

  const right = withFace(recordings.right).map((f) => (f.head?.yaw ?? 0) - p.neutral.yaw);
  const rightPeak = peak(right);
  if (Math.abs(rightPeak) >= MIN_CONTRAST.angle) {
    p = {
      ...p,
      right: {
        ...p.right,
        amplitude: round(clamp(Math.abs(rightPeak) * 0.6, L.amplitude), 1),
        direction: Math.sign(rightPeak) as -1 | 1,
      },
    };
    learnt.push('right');
  }

  // His glance at his hand (spec 015, R8): a quick turn of the head, learnt like head right from the signed peak of the
  // yaw. After head right, because a side that a known head right uses is refused: the same turn cannot mean both.
  // A head right that is only the guess of the defaults never refuses a real glance; it moves to the other side.
  const rightKnown = learnt.includes('right') || previousCalibrated;
  const hand = withFace(recordings.hand).map((f) => ({
    yaw: (f.head?.yaw ?? 0) - p.neutral.yaw,
    pitch: (f.head?.pitch ?? 0) - p.neutral.pitch,
  }));
  const handPeak = peak(hand.map((f) => f.yaw));
  const handSide = Math.sign(handPeak) as -1 | 1;
  if (Math.abs(handPeak) >= MIN_CONTRAST.angle && (handSide !== p.right.direction || !rightKnown)) {
    if (handSide === p.right.direction) {
      p = { ...p, right: { ...p.right, direction: -handSide as -1 | 1 } };
    }
    const amplitude = round(clamp(Math.abs(handPeak) / 2, L.amplitude), 1);
    // The tilt of his glance: the median pitch while the head is turned past the amplitude (shown, not used to decide).
    const pitch = percentile(
      hand.filter((f) => f.yaw * handSide >= amplitude).map((f) => f.pitch),
      50,
    );
    p = {
      ...p,
      hand: {
        ...p.hand,
        amplitude,
        direction: handSide,
        pitch: Number.isNaN(pitch) ? p.hand.pitch : round(clamp(pitch, L.angle), 1),
      },
    };
    learnt.push('hand');
  } else if (p.hand.direction === p.right.direction) {
    // Head right was learnt on the side his hand had: his left is the other way from his right (R7).
    p = { ...p, hand: { ...p.hand, direction: -p.right.direction as -1 | 1 } };
  }
  learnt.sort((a, b) => CALIBRATION_STEPS.indexOf(a) - CALIBRATION_STEPS.indexOf(b));

  return blinkFit ? { profile: p, learnt, blink: blinkFit } : { profile: p, learnt };
}

/** How many times the step's signal is found in its recording with a profile ("Wykryto n z k" (Detected n of k)). */
export function countDetected(
  step: Exclude<CalibrationStep, 'neutral'>,
  frames: readonly FaceFrame[],
  profile: SignalProfile,
): number {
  return detectAll(frames, profile).filter((x) => x.signal === STEP_SIGNAL[step]).length;
}
