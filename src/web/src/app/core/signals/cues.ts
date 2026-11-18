// What the detector and the fitting read from a face frame: how far the eyes are closed, how strong a closure is, and
// where the eyes look. One place, so Kalibracja (Calibration) and the detector always measure the same way.
import type { EyeShape, FaceFrame } from '../vision/face-frame';

/**
 * The signs of a strong blink: the lids squeezed, the cheeks raised and the brows pulled down (the ring muscle of the
 * eye contracts). Which one tells his strong blink from his ordinary one best is learnt in Kalibracja (Calibration).
 */
export const STRONG_CUES = ['eyeSquint', 'cheekSquint', 'browDown'] as const;
export type StrongCue = (typeof STRONG_CUES)[number];
export type CueValues = Readonly<Record<StrongCue, number>>;

export const NO_CUES: CueValues = { eyeSquint: 0, cheekSquint: 0, browDown: 0 };

/** Both sides must move: the smaller of the two (a wink or one droopy lid is not both). */
const both = (f: FaceFrame, left: EyeShape, right: EyeShape) =>
  Math.min(f.eyes[left] ?? 0, f.eyes[right] ?? 0);

export const closureOf = (f: FaceFrame) => both(f, 'eyeBlinkLeft', 'eyeBlinkRight');

export const cuesOf = (f: FaceFrame): CueValues => ({
  eyeSquint: both(f, 'eyeSquintLeft', 'eyeSquintRight'),
  cheekSquint: both(f, 'cheekSquintLeft', 'cheekSquintRight'),
  browDown: both(f, 'browDownLeft', 'browDownRight'),
});

export const maxCues = (a: CueValues, b: CueValues): CueValues => ({
  eyeSquint: Math.max(a.eyeSquint, b.eyeSquint),
  cheekSquint: Math.max(a.cheekSquint, b.cheekSquint),
  browDown: Math.max(a.browDown, b.browDown),
});

export const downOf = (f: FaceFrame) =>
  Math.max(f.eyes.eyeLookDownLeft ?? 0, f.eyes.eyeLookDownRight ?? 0);
