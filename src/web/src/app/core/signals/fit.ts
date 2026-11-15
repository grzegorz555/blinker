// Spec 011, R5: his profile from short recordings of each movement (Kalibracja (Calibration)). Plain TypeScript.
//
// Each threshold lies halfway between his value at rest and the median of his deliberate peaks, so a weak but
// deliberate movement still counts and a resting face does not. Medians and percentiles, not maxima, so one odd frame
// (a sneeze, a lost face) doesn't move a threshold. Everything is clamped to the safe ranges of the profile, and a step
// whose movement was too small to tell from rest keeps the previous value (it is not "learnt").
import type { FaceFrame } from '../vision/face-frame';
import { detectAll, type FaceSignal } from './detector';
import { PROFILE_LIMITS, type SignalProfile } from './profile';

export const CALIBRATION_STEPS = [
  'neutral',
  'blink',
  'handLeft',
  'handRight',
  'nod',
  'shake',
  'right',
] as const;
export type CalibrationStep = (typeof CALIBRATION_STEPS)[number];
export type Recordings = Partial<Record<CalibrationStep, readonly FaceFrame[]>>;

/** What each movement step should produce, and how many times we ask for it. */
export const STEP_SIGNAL: Record<Exclude<CalibrationStep, 'neutral'>, FaceSignal> = {
  blink: 'BLINK',
  handLeft: 'HAND',
  handRight: 'HAND',
  nod: 'NOD',
  shake: 'SHAKE',
  right: 'RIGHT',
};
export const STEP_REPEATS: Record<Exclude<CalibrationStep, 'neutral'>, number> = {
  blink: 3,
  handLeft: 2,
  handRight: 2,
  nod: 2,
  shake: 2,
  right: 2,
};

/** The smallest difference from rest that counts as a deliberate movement. */
export const MIN_CONTRAST = { eyes: 0.2, squeeze: 0.1, angle: 6 } as const;

export interface Fit {
  readonly profile: SignalProfile;
  /** The steps that changed the profile; the others kept the previous values. */
  readonly learnt: readonly CalibrationStep[];
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
const closure = (f: FaceFrame) => Math.min(f.eyes.eyeBlinkLeft ?? 0, f.eyes.eyeBlinkRight ?? 0);
const squeeze = (f: FaceFrame) => Math.min(f.eyes.eyeSquintLeft ?? 0, f.eyes.eyeSquintRight ?? 0);
const down = (f: FaceFrame) => Math.max(f.eyes.eyeLookDownLeft ?? 0, f.eyes.eyeLookDownRight ?? 0);

interface Closure {
  readonly ms: number;
  readonly closure: number;
  readonly squeeze: number;
}

/** Each closure of the eyes (both at or above `threshold`): how long, how far closed, how hard squeezed at most. */
function closures(frames: readonly FaceFrame[], threshold: number): Closure[] {
  const out: Closure[] = [];
  let open: { start: number; closure: number; squeeze: number } | null = null;
  for (const f of frames) {
    const c = closure(f);
    if (c < threshold) {
      if (open)
        out.push({ ms: f.timestamp - open.start, closure: open.closure, squeeze: open.squeeze });
      open = null;
    } else if (open) {
      open.closure = Math.max(open.closure, c);
      open.squeeze = Math.max(open.squeeze, squeeze(f));
    } else {
      open = { start: f.timestamp, closure: c, squeeze: squeeze(f) };
    }
  }
  return out;
}

/** The value with the largest size among the top 5 %, with its sign (a movement and its direction). */
function peak(values: readonly number[]): number {
  const size = percentile(values.map(Math.abs), 95);
  if (Number.isNaN(size)) return Number.NaN;
  const big = values.filter((v) => Math.abs(v) >= size * 0.8);
  return Math.sign(percentile(big, 50)) * size;
}

export function fitProfile(recordings: Recordings, previous: SignalProfile): Fit {
  const L = PROFILE_LIMITS;
  const learnt: CalibrationStep[] = [];
  let p: SignalProfile = previous;

  // Rest: his head pose, and his eyes open and looking at the screen.
  const rest = withFace(recordings.neutral);
  let restClosure = 0.1;
  let restSqueeze = 0.1;
  let restDown = 0.1;
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
    restClosure = percentile(rest.map(closure), 50);
    restSqueeze = percentile(rest.map(squeeze), 50);
    restDown = percentile(rest.map(down), 50);
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
    // His strong blinks: halfway between the squeeze of his ordinary blinks (those in the rest recording, or the
    // resting lids if he did not blink then) and the median squeeze of his deliberate ones.
    const ordinary = closures(rest, threshold).map((c) => c.squeeze);
    const floor = Math.max(restSqueeze, ...ordinary);
    const strong = percentile(
      deliberate.map((c) => c.squeeze),
      50,
    );
    const squeezeAt =
      strong - floor >= MIN_CONTRAST.squeeze
        ? round(clamp(floor + (strong - floor) / 2, L.threshold))
        : p.blink.squeeze;
    p = { ...p, blink: { ...p.blink, threshold: round(threshold), minMs, squeeze: squeezeAt } };
    learnt.push('blink');
  }

  for (const step of ['handLeft', 'handRight'] as const) {
    const frames = withFace(recordings[step]);
    const top = percentile(frames.map(down), 90);
    if (top - restDown >= MIN_CONTRAST.eyes) {
      const threshold = clamp(restDown + (top - restDown) / 2, L.threshold);
      // Both hands share one threshold: the lower one, so the weaker side still counts.
      const merged = learnt.includes('handLeft')
        ? Math.min(threshold, p.hand.threshold)
        : threshold;
      p = { ...p, hand: { ...p.hand, threshold: round(merged) } };
      learnt.push(step);
    }
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

  return { profile: p, learnt };
}

/** How many times the step's signal is found in its recording with a profile ("Wykryto n z k" (Detected n of k)). */
export function countDetected(
  step: Exclude<CalibrationStep, 'neutral'>,
  frames: readonly FaceFrame[],
  profile: SignalProfile,
): number {
  return detectAll(frames, profile).filter((x) => x.signal === STEP_SIGNAL[step]).length;
}
