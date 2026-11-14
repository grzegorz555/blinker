// Spec 011, R1: his signals from face frames. A pure function, like the counting machine: the same frames and profile
// always give the same signals, time comes only from the frame timestamps, and nothing is kept but numbers.
//
// Each signal is a small state machine with hysteresis (it starts at the threshold and ends a little below it, so noise
// around the threshold can't make it flicker) and fires once, mostly on release (a long blink when the eyes open, a head
// right when the head comes back), so holding a position never repeats a signal.
import type { FaceFrame } from '../vision/face-frame';
import type { SignalProfile } from './profile';

/** The signals his face can give (the same types as the buttons and keys). */
export type FaceSignal = 'BLINK' | 'HAND' | 'NOD' | 'SHAKE' | 'RIGHT';

export interface DetectorState {
  /** When both eyes closed, and whether he was looking down then (the look at his hand lowers the lids). */
  readonly closedSince: number | null;
  readonly closedWhileDown: boolean;
  /** When the eyes went down, and whether HAND was already sent for this look. */
  readonly downSince: number | null;
  readonly handSent: boolean;
  /** The nod: when the head left neutral (pitch), or null at rest. */
  readonly nodSince: number | null;
  /** The sides the head passed in the shake window, newest last: -1 or 1 with their time. */
  readonly shakeSides: readonly { readonly side: -1 | 1; readonly at: number }[];
  /** When the head went right past the amplitude, or null. */
  readonly rightSince: number | null;
  /** The last signal's time, for the refractory time. */
  readonly lastSignalAt: number;
}

export const INITIAL_DETECTOR: DetectorState = {
  closedSince: null,
  closedWhileDown: false,
  downSince: null,
  handSent: false,
  nodSince: null,
  shakeSides: [],
  rightSince: null,
  lastSignalAt: Number.NEGATIVE_INFINITY,
};

/** Hysteresis: a state that started at a threshold ends below this share of it. */
export const RELEASE = 0.8;

export interface Detection {
  readonly state: DetectorState;
  readonly signals: readonly FaceSignal[];
}

/** Without a face: every half-done signal is dropped (only the refractory time is kept). */
const lost = (state: DetectorState): DetectorState => ({
  ...INITIAL_DETECTOR,
  lastSignalAt: state.lastSignalAt,
});

export function detect(state: DetectorState, frame: FaceFrame, profile: SignalProfile): Detection {
  if (!frame.face) return { state: lost(state), signals: [] };
  const t = frame.timestamp;
  const e = frame.eyes;
  const closure = Math.min(e.eyeBlinkLeft ?? 0, e.eyeBlinkRight ?? 0);
  const down = Math.max(e.eyeLookDownLeft ?? 0, e.eyeLookDownRight ?? 0);
  const looksDown = down >= profile.hand.threshold;
  const fired: FaceSignal[] = [];
  let s: DetectorState = state;

  // Long blink: fires when the eyes open again, if the closure was long enough and not too long.
  if (s.closedSince === null) {
    if (closure >= profile.blink.threshold) {
      s = { ...s, closedSince: t, closedWhileDown: looksDown };
    }
  } else if (closure < profile.blink.threshold * RELEASE) {
    const ms = t - s.closedSince;
    if (!s.closedWhileDown && ms >= profile.blink.minMs && ms <= profile.blink.maxMs) {
      fired.push('BLINK');
    }
    s = { ...s, closedSince: null, closedWhileDown: false };
  } else if (looksDown) {
    s = { ...s, closedWhileDown: true };
  }

  // Look at his hand: fires once when the eyes have been down long enough.
  if (s.downSince === null) {
    if (looksDown) s = { ...s, downSince: t, handSent: false };
  } else if (down < profile.hand.threshold * RELEASE) {
    s = { ...s, downSince: null, handSent: false };
  } else if (!s.handSent && t - s.downSince >= profile.hand.holdMs) {
    fired.push('HAND');
    s = { ...s, handSent: true };
  }

  const head = frame.head;
  if (head) {
    const pitch = head.pitch - profile.neutral.pitch;
    const yaw = head.yaw - profile.neutral.yaw;

    // Nod: away (in his direction, if known) and back within the window.
    const nodAway =
      profile.nod.direction === 0 ? Math.abs(pitch) : Math.max(0, pitch * profile.nod.direction);
    if (s.nodSince === null) {
      if (nodAway >= profile.nod.amplitude) s = { ...s, nodSince: t };
    } else if (Math.abs(pitch) <= profile.nod.amplitude / 2) {
      if (t - s.nodSince <= profile.nod.windowMs) fired.push('NOD');
      s = { ...s, nodSince: null };
    }

    // Shake: past the amplitude on one side, then the other, within the window.
    const side: -1 | 0 | 1 =
      yaw >= profile.shake.amplitude ? 1 : yaw <= -profile.shake.amplitude ? -1 : 0;
    let sides = s.shakeSides.filter((x) => t - x.at <= profile.shake.windowMs);
    if (side !== 0 && sides.at(-1)?.side !== side) sides = [...sides, { side, at: t }];
    if (sides.length >= 2) {
      fired.push('SHAKE');
      sides = [];
      s = { ...s, rightSince: null }; // a shake is not a head right
    }
    s = { ...s, shakeSides: sides };

    // Head right: held past the amplitude, sent when the head comes back.
    const right = yaw * profile.right.direction;
    if (s.rightSince === null) {
      if (right >= profile.right.amplitude && !fired.includes('SHAKE')) s = { ...s, rightSince: t };
    } else if (right < profile.right.amplitude / 2) {
      if (t - s.rightSince >= profile.right.holdMs) {
        fired.push('RIGHT');
        s = { ...s, shakeSides: [] }; // the way back is not half a shake
      }
      s = { ...s, rightSince: null };
    }
  } else {
    s = { ...s, nodSince: null, shakeSides: [], rightSince: null };
  }

  // One signal at a time, and a quiet time after it.
  if (!fired.length || t - s.lastSignalAt < profile.refractoryMs) return { state: s, signals: [] };
  return { state: { ...s, lastSignalAt: t }, signals: [fired[0]] };
}

/** Runs the detector over a recording (calibration, tests). */
export function detectAll(
  frames: readonly FaceFrame[],
  profile: SignalProfile,
): { at: number; signal: FaceSignal }[] {
  let state = INITIAL_DETECTOR;
  const out: { at: number; signal: FaceSignal }[] = [];
  for (const frame of frames) {
    const d = detect(state, frame, profile);
    state = d.state;
    for (const signal of d.signals) out.push({ at: frame.timestamp, signal });
  }
  return out;
}
