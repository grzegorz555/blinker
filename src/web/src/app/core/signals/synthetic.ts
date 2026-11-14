// Synthetic face recordings for tests (spec 011): 30 frames per second, values given as functions of time.
// Not used by the app; kept next to the detector so detector, fitting and page tests share one generator.
import type { EyeShape, FaceFrame } from '../vision/face-frame';

export const FPS = 30;

export interface Motion {
  /** Eye shapes over time (ms from the start), default 0.05 (open, looking ahead). */
  readonly eyes?: (t: number) => Partial<Record<EyeShape, number>>;
  readonly yaw?: (t: number) => number;
  readonly pitch?: (t: number) => number;
  /** Whether a face is found at time t (default always). */
  readonly face?: (t: number) => boolean;
}

/** Frames from `start` for `ms` milliseconds. */
export function record(ms: number, motion: Motion = {}, start = 0): FaceFrame[] {
  const frames: FaceFrame[] = [];
  for (let i = 0; i * (1000 / FPS) <= ms; i++) {
    const t = i * (1000 / FPS);
    const face = motion.face?.(t) ?? true;
    frames.push({
      timestamp: start + t,
      inferenceMs: 10,
      face,
      eyes: face
        ? {
            eyeBlinkLeft: 0.05,
            eyeBlinkRight: 0.05,
            eyeLookDownLeft: 0.05,
            eyeLookDownRight: 0.05,
            ...motion.eyes?.(t),
          }
        : {},
      head: face ? { yaw: motion.yaw?.(t) ?? 0, pitch: motion.pitch?.(t) ?? 0, roll: 0 } : null,
    });
  }
  return frames;
}

/** A value `peak` between `from` and `to` ms (a square pulse), `rest` otherwise. */
export const pulse =
  (from: number, to: number, peak: number, rest = 0) =>
  (t: number) =>
    t >= from && t < to ? peak : rest;

/** Several pulses: [from, to, peak] each. */
export const pulses =
  (list: readonly (readonly [number, number, number])[], rest = 0) =>
  (t: number) =>
    list.find(([from, to]) => t >= from && t < to)?.[2] ?? rest;

/** Both eyes closed (blink 0.9) between `from` and `to`. */
export const closed = (from: number, to: number) => (t: number) => {
  const v = pulse(from, to, 0.9, 0.05)(t);
  return { eyeBlinkLeft: v, eyeBlinkRight: v };
};
