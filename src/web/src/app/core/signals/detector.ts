// Spec 011, R1: his signals from face frames. A pure function, like the counting machine: the same frames and profile
// always give the same signals, time comes only from the frame timestamps, and nothing is kept but numbers.
//
// Each signal is a small state machine with hysteresis (it starts at the threshold and ends a little below it, so noise
// around the threshold can't make it flicker) and fires once, mostly on release (a long blink when the eyes open, a head
// right when the head comes back), so holding a position never repeats a signal. His blink is strong rather than long:
// a closure counts if it is long enough or if the lids squeeze hard enough while it lasts.
import type { FaceFrame } from '../vision/face-frame';
import { closureOf, cuesOf, downOf, maxCues, NO_CUES, sidesOf, type CueValues } from './cues';
import type { SignalProfile } from './profile';

/** The signals his face can give (the same types as the buttons and keys). */
export type FaceSignal = 'BLINK' | 'HAND' | 'NOD' | 'SHAKE' | 'RIGHT';

export interface DetectorState {
  /** When both eyes closed, and whether he was looking down then (the look at his hand lowers the lids). */
  readonly closedSince: number | null;
  readonly closedWhileDown: boolean;
  /** The strongest signs of a strong blink, the deepest closure and the lowest look during the current closure. */
  readonly closedCues: CueValues;
  readonly closedPeak: number;
  readonly closedDown: number;
  /** When the eyes went down, and whether HAND was already sent for this look. */
  readonly downSince: number | null;
  readonly handSent: boolean;
  /** Any look down past the threshold (side and head aside), for the report: since when, its peaks, what stopped it. */
  readonly lookSince: number | null;
  readonly look: LookPeaks;
  /** The nod: when the head left neutral (pitch), or null at rest. */
  readonly nodSince: number | null;
  /** The sides the head passed in the shake window, newest last: -1 or 1 with their time. */
  readonly shakeSides: readonly { readonly side: -1 | 1; readonly at: number }[];
  /** When the head went right past the amplitude, or null. */
  readonly rightSince: number | null;
  /** The last signal's time, for the refractory time. */
  readonly lastSignalAt: number;
}

/** The peaks of one look down, and what happened during it. */
export interface LookPeaks {
  readonly down: number;
  readonly left: number;
  readonly right: number;
  /** The largest head turn and tilt from his neutral during the look, degrees. */
  readonly yaw: number;
  readonly pitch: number;
  readonly sideOk: boolean;
  readonly nodding: boolean;
  readonly sent: boolean;
}

const NO_LOOK: LookPeaks = {
  down: 0,
  left: 0,
  right: 0,
  yaw: 0,
  pitch: 0,
  sideOk: false,
  nodding: false,
  sent: false,
};

/** Why a look down was or was not a look at his hand (Diagnostyka (Diagnostics), Kalibracja (Calibration)). */
export type LookVerdict = 'hand' | 'short' | 'wrongSide' | 'nodding';

/** One look down, reported when the eyes come back up. */
export interface LookReport extends Omit<LookPeaks, 'sideOk' | 'nodding' | 'sent'> {
  readonly ms: number;
  readonly verdict: LookVerdict;
}

export const INITIAL_DETECTOR: DetectorState = {
  closedSince: null,
  closedWhileDown: false,
  closedCues: NO_CUES,
  closedPeak: 0,
  closedDown: 0,
  downSince: null,
  handSent: false,
  lookSince: null,
  look: NO_LOOK,
  nodSince: null,
  shakeSides: [],
  rightSince: null,
  lastSignalAt: Number.NEGATIVE_INFINITY,
};

/** Hysteresis: a state that started at a threshold ends below this share of it. */
export const RELEASE = 0.8;

/** Why a closure of the eyes was or was not his blink (Diagnostyka (Diagnostics) shows it, to tune with him). */
export type ClosureVerdict = 'blink' | 'weak' | 'tooLong' | 'lookingDown';

/** One closure of the eyes, reported when the eyes open: its length and peaks, and the verdict. */
export interface ClosureReport {
  readonly ms: number;
  readonly closure: number;
  /** His strong-blink cue at its peak (the one his profile uses), and all three cues. */
  readonly squeeze: number;
  readonly cues: CueValues;
  readonly down: number;
  readonly verdict: ClosureVerdict;
}

export interface Detection {
  readonly state: DetectorState;
  readonly signals: readonly FaceSignal[];
  /** Set on the frame where a closure ends. */
  readonly closure?: ClosureReport;
  /** Set on the frame where a look down ends. */
  readonly look?: LookReport;
}

/** Without a face: every half-done signal is dropped (only the refractory time is kept). */
const lost = (state: DetectorState): DetectorState => ({
  ...INITIAL_DETECTOR,
  lastSignalAt: state.lastSignalAt,
});

export function detect(state: DetectorState, frame: FaceFrame, profile: SignalProfile): Detection {
  if (!frame.face) return { state: lost(state), signals: [] };
  const t = frame.timestamp;
  const closure = closureOf(frame);
  const cues = cuesOf(frame);
  const down = downOf(frame);
  const sides = sidesOf(frame);
  const head = frame.head;
  const pitch = head ? head.pitch - profile.neutral.pitch : 0;
  const yaw = head ? head.yaw - profile.neutral.yaw : 0;
  // His eyes stay on the screen while he nods, so the nod moves the eyes against the head: the head going up reads as
  // looking down. A look at his hand does not count while a nod is under way. Turning or tilting the head towards his
  // hand is part of the look, so the head pose itself does not matter.
  const nodding = state.nodSince !== null;
  // To his hand: down, and to the side he looks (when Kalibracja (Calibration) learnt it), with hysteresis.
  const towardsHand = (share: number) => {
    const { left, right } = profile.hand;
    if (left === null && right === null) return true;
    return (
      (left !== null && sides.left >= left * share) ||
      (right !== null && sides.right >= right * share)
    );
  };
  const atHand = down >= profile.hand.threshold && towardsHand(1) && !nodding;
  const stillAtHand = down >= profile.hand.threshold * RELEASE && towardsHand(RELEASE) && !nodding;
  const fired: FaceSignal[] = [];
  let report: ClosureReport | undefined;
  let lookReport: LookReport | undefined;
  let s: DetectorState = state;

  // His blink: fires when the eyes open again, if the closure was long enough or strong enough, and not too long.
  // Closing the eyes also lowers them (MediaPipe's eyeLookDown rises with eyeBlink), so a closure is a look at his hand
  // only if he was already looking down when it began, or if the look lasted long enough to send HAND (below).
  if (s.closedSince === null) {
    if (closure >= profile.blink.threshold) {
      s = {
        ...s,
        closedSince: t,
        closedWhileDown: s.downSince !== null,
        closedCues: cues,
        closedPeak: closure,
        closedDown: down,
      };
    }
  } else if (closure < profile.blink.threshold * RELEASE) {
    const ms = t - s.closedSince;
    const long = ms >= profile.blink.minMs;
    const peak = s.closedCues[profile.blink.cue];
    const strong = profile.blink.squeeze < 1 && peak >= profile.blink.squeeze;
    const verdict: ClosureVerdict = s.closedWhileDown
      ? 'lookingDown'
      : ms > profile.blink.maxMs
        ? 'tooLong'
        : long || strong
          ? 'blink'
          : 'weak';
    if (verdict === 'blink') fired.push('BLINK');
    report = {
      ms,
      closure: s.closedPeak,
      squeeze: peak,
      cues: s.closedCues,
      down: s.closedDown,
      verdict,
    };
    s = {
      ...s,
      closedSince: null,
      closedWhileDown: false,
      closedCues: NO_CUES,
      closedPeak: 0,
      closedDown: 0,
    };
  } else {
    s = {
      ...s,
      closedCues: maxCues(s.closedCues, cues),
      closedPeak: Math.max(s.closedPeak, closure),
      closedDown: Math.max(s.closedDown, down),
    };
  }

  // Look at his hand: fires once when the eyes have been on his hand long enough.
  if (s.downSince === null) {
    if (atHand) s = { ...s, downSince: t, handSent: false };
  } else if (!stillAtHand) {
    s = { ...s, downSince: null, handSent: false };
  } else if (!s.handSent && t - s.downSince >= profile.hand.holdMs) {
    fired.push('HAND');
    // A look long enough to count is not also a blink when the lids come back up.
    s = { ...s, handSent: true, closedWhileDown: s.closedSince !== null || s.closedWhileDown };
  }

  // The report of the look: any look down past the threshold, whatever its side and the head.
  const lookNow = {
    down,
    left: sides.left,
    right: sides.right,
    yaw: Math.abs(yaw),
    pitch: Math.abs(pitch),
    sideOk: towardsHand(1),
    nodding,
    sent: s.handSent,
  };
  if (s.lookSince === null) {
    if (down >= profile.hand.threshold) s = { ...s, lookSince: t, look: lookNow };
  } else if (down < profile.hand.threshold * RELEASE) {
    const l = s.look;
    const verdict: LookVerdict = l.sent
      ? 'hand'
      : !l.sideOk
        ? 'wrongSide'
        : l.nodding
          ? 'nodding'
          : 'short';
    lookReport = {
      ms: t - s.lookSince,
      down: l.down,
      left: l.left,
      right: l.right,
      yaw: l.yaw,
      pitch: l.pitch,
      verdict,
    };
    s = { ...s, lookSince: null, look: NO_LOOK };
  } else {
    const l = s.look;
    s = {
      ...s,
      look: {
        down: Math.max(l.down, down),
        left: Math.max(l.left, sides.left),
        right: Math.max(l.right, sides.right),
        yaw: Math.max(l.yaw, Math.abs(yaw)),
        pitch: Math.max(l.pitch, Math.abs(pitch)),
        sideOk: l.sideOk || lookNow.sideOk,
        nodding: l.nodding || nodding,
        sent: l.sent || s.handSent,
      },
    };
  }

  if (head) {
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
  const extra = {
    ...(report ? { closure: report } : {}),
    ...(lookReport ? { look: lookReport } : {}),
  };
  if (!fired.length || t - s.lastSignalAt < profile.refractoryMs) {
    return { state: s, signals: [], ...extra };
  }
  return { state: { ...s, lastSignalAt: t }, signals: [fired[0]], ...extra };
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

/** Every closure of the eyes in a recording, oldest first, with why it was or was not his blink (Kalibracja). */
export function closureReports(
  frames: readonly FaceFrame[],
  profile: SignalProfile,
): ClosureReport[] {
  let state = INITIAL_DETECTOR;
  const out: ClosureReport[] = [];
  for (const frame of frames) {
    const d = detect(state, frame, profile);
    state = d.state;
    if (d.closure) out.push(d.closure);
  }
  return out;
}

/** Every look down in a recording, oldest first, with why it was or was not a look at his hand (Kalibracja). */
export function lookReports(frames: readonly FaceFrame[], profile: SignalProfile): LookReport[] {
  let state = INITIAL_DETECTOR;
  const out: LookReport[] = [];
  for (const frame of frames) {
    const d = detect(state, frame, profile);
    state = d.state;
    if (d.look) out.push(d.look);
  }
  return out;
}
