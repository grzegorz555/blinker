// Spec 011, R1: his signals from face frames. A pure function, like the counting machine: the same frames and profile
// always give the same signals, time comes only from the frame timestamps, and nothing is kept but numbers.
//
// Each signal is a small state machine with hysteresis (it starts at the threshold and ends a little below it, so noise
// around the threshold can't make it flicker) and fires once, mostly on release (a long blink when the eyes open, a head
// right when the head comes back), so holding a position never repeats a signal. His blink is strong rather than long:
// a closure counts if it is long enough or if the lids squeeze hard enough while it lasts. His look at his hand is a
// quick turn of the head to his left and back (spec 015).
import type { FaceFrame } from '../vision/face-frame';
import { closureOf, cuesOf, downOf, maxCues, NO_CUES, type CueValues } from './cues';
import type { SignalProfile } from './profile';

/** The signals his face can give (the same types as the buttons and keys). */
export type FaceSignal = 'BLINK' | 'HAND' | 'NOD' | 'SHAKE' | 'RIGHT';

/** Hysteresis: a state that started at a threshold ends below this share of it. */
export const RELEASE = 0.8;

/**
 * Spec 015, R2: after the head comes back from a turn to his hand, the hand waits this long before it is sent. A shake
 * also starts with one side; if the other side follows within this time, it was a shake, not a hand.
 */
export const HAND_SETTLE_MS = 300;

/** Spec 015, R9: a movement of the head starts this far from neutral (degrees), and ends under RELEASE of it. */
export const MOVE_START = 6;

/**
 * The hand as a small state machine (spec 015, R1–R2): `out` once the yaw passed the amplitude towards his hand,
 * `settle` once it came back in time, then HAND. `wait` after a lost face: a turn already under way when the face comes
 * back is not a hand, so the head must come back first.
 */
export type HandPhase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'wait' }
  | { readonly kind: 'out'; readonly since: number; readonly shook: boolean }
  | { readonly kind: 'settle'; readonly at: number };

const IDLE: HandPhase = { kind: 'idle' };
const WAIT: HandPhase = { kind: 'wait' };

/**
 * Why a movement of the head was or was not his look at his hand (spec 015, R9): `hand`; `small` (towards his hand,
 * under the amplitude); `slow` (back after the window); `shake` (the other side followed, R2); `otherSide`; `tooSoon`
 * (a hand, but inside the refractory time of another signal, so not sent).
 */
export type HandVerdict = 'hand' | 'small' | 'slow' | 'shake' | 'otherSide' | 'tooSoon';

/** One movement of the head, reported when it comes back (Kalibracja (Calibration), Diagnostyka (Diagnostics)). */
export interface HeadReport {
  readonly ms: number;
  /** The signed peaks from his neutral (the value with the largest size), degrees, MediaPipe's sign. */
  readonly yaw: number;
  readonly pitch: number;
  /** The signal sent during the movement, or null. */
  readonly signal: FaceSignal | null;
  readonly verdict: HandVerdict;
}

/** A movement of the head under way: its start, signed peaks, when it came back, and what happened. */
interface Movement {
  readonly since: number;
  readonly yaw: number;
  readonly pitch: number;
  readonly backAt: number | null;
  readonly signal: FaceSignal | null;
  readonly verdict: HandVerdict | null;
}

export interface DetectorState {
  /** When both eyes closed, and whether the head was turned to his hand then or when HAND was sent (R5). */
  readonly closedSince: number | null;
  readonly closedAtHand: boolean;
  /** The strongest signs of a strong blink, the deepest closure and the lowest look during the current closure. */
  readonly closedCues: CueValues;
  readonly closedPeak: number;
  readonly closedDown: number;
  /** The hand (spec 015, R1–R2). */
  readonly hand: HandPhase;
  /** The nod: when the head left neutral (pitch), or null at rest; and whether the yaw passed half the hand (R3). */
  readonly nodSince: number | null;
  readonly nodTurned: boolean;
  /** The sides the head passed in the shake window, newest last: -1 or 1 with their time. */
  readonly shakeSides: readonly { readonly side: -1 | 1; readonly at: number }[];
  /** When the head went right past the amplitude, or null. */
  readonly rightSince: number | null;
  /** The movement of the head under way, for the report (R9). */
  readonly move: Movement | null;
  /** The last signal's time, for the refractory time. */
  readonly lastSignalAt: number;
}

export const INITIAL_DETECTOR: DetectorState = {
  closedSince: null,
  closedAtHand: false,
  closedCues: NO_CUES,
  closedPeak: 0,
  closedDown: 0,
  hand: IDLE,
  nodSince: null,
  nodTurned: false,
  shakeSides: [],
  rightSince: null,
  move: null,
  lastSignalAt: Number.NEGATIVE_INFINITY,
};

/** Why a closure of the eyes was or was not his blink (Diagnostyka (Diagnostics) shows it, to tune with him). */
export type ClosureVerdict = 'blink' | 'weak' | 'tooLong' | 'atHand';

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
  /** Set on the frame where a movement of the head is over (back, and no hand pending). */
  readonly head?: HeadReport;
}

/** Without a face: every half-done signal is dropped (only the refractory time is kept). */
const lost = (state: DetectorState): DetectorState => ({
  ...INITIAL_DETECTOR,
  hand: WAIT,
  lastSignalAt: state.lastSignalAt,
});

/** The signed value with the larger size. */
const signedPeak = (a: number, b: number) => (Math.abs(b) > Math.abs(a) ? b : a);

export function detect(state: DetectorState, frame: FaceFrame, profile: SignalProfile): Detection {
  if (!frame.face) return { state: lost(state), signals: [] };
  const t = frame.timestamp;
  const closure = closureOf(frame);
  const cues = cuesOf(frame);
  const down = downOf(frame);
  const head = frame.head;
  const pitch = head ? head.pitch - profile.neutral.pitch : 0;
  const yaw = head ? head.yaw - profile.neutral.yaw : 0;
  // Towards his hand: positive when the head turns to his left.
  const towards = yaw * profile.hand.direction;
  const fired: FaceSignal[] = [];
  let report: ClosureReport | undefined;
  let handVerdict: HandVerdict | null = null;
  let s: DetectorState = state;

  // His blink: fires when the eyes open again, if the closure was long enough or strong enough, and not too long.
  // A closure that starts while his head is turned to his hand is part of the look, not a blink (spec 015, R5).
  if (s.closedSince === null) {
    if (closure >= profile.blink.threshold) {
      s = {
        ...s,
        closedSince: t,
        closedAtHand: s.hand.kind === 'out' || (head !== null && towards >= profile.hand.amplitude),
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
    const verdict: ClosureVerdict = s.closedAtHand
      ? 'atHand'
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
      closedAtHand: false,
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

  if (head) {
    // Nod: away (in his direction, if known) and back within the window. A nod with the head turned past half the hand
    // is his glance at his hand tilting the head down, not "yes" (spec 015, R3): a nod has no side.
    const turned = Math.abs(yaw) >= profile.hand.amplitude / 2;
    const nodAway =
      profile.nod.direction === 0 ? Math.abs(pitch) : Math.max(0, pitch * profile.nod.direction);
    if (s.nodSince === null) {
      if (nodAway >= profile.nod.amplitude) s = { ...s, nodSince: t, nodTurned: turned };
    } else if (Math.abs(pitch) <= profile.nod.amplitude / 2) {
      if (t - s.nodSince <= profile.nod.windowMs && !(s.nodTurned || turned)) fired.push('NOD');
      s = { ...s, nodSince: null, nodTurned: false };
    } else if (turned) {
      s = { ...s, nodTurned: true };
    }

    // Shake: past the amplitude on one side, then the other, within the window.
    const side: -1 | 0 | 1 =
      yaw >= profile.shake.amplitude ? 1 : yaw <= -profile.shake.amplitude ? -1 : 0;
    let sides = s.shakeSides.filter((x) => t - x.at <= profile.shake.windowMs);
    if (side !== 0 && sides.at(-1)?.side !== side) sides = [...sides, { side, at: t }];
    const shook = sides.length >= 2;
    if (shook) {
      fired.push('SHAKE');
      sides = [];
      s = { ...s, rightSince: null }; // a shake is not a head right
    }
    s = { ...s, shakeSides: sides };

    // Head right: held past the amplitude, sent when the head comes back.
    const right = yaw * profile.right.direction;
    if (s.rightSince === null) {
      if (right >= profile.right.amplitude && !shook) s = { ...s, rightSince: t };
    } else if (right < profile.right.amplitude / 2) {
      if (t - s.rightSince >= profile.right.holdMs) {
        fired.push('RIGHT');
        s = { ...s, shakeSides: [] }; // the way back is not half a shake
      }
      s = { ...s, rightSince: null };
    }

    // The look at his hand (spec 015, R1–R2): out past the amplitude, back within half of it inside the window, then
    // the settle; the other side past the shake amplitude during the settle (or a shake while out) makes it a shake.
    const back = towards < profile.hand.amplitude / 2;
    const h = s.hand;
    if (h.kind === 'idle') {
      if (towards >= profile.hand.amplitude) s = { ...s, hand: { kind: 'out', since: t, shook } };
    } else if (h.kind === 'wait') {
      if (back) s = { ...s, hand: IDLE };
    } else if (h.kind === 'out') {
      if (!back) {
        if (shook && !h.shook) s = { ...s, hand: { ...h, shook: true } };
      } else if (h.shook || shook) {
        handVerdict = 'shake';
        s = { ...s, hand: IDLE };
      } else if (t - h.since <= profile.hand.windowMs) {
        s = { ...s, hand: { kind: 'settle', at: t } };
      } else {
        handVerdict = 'slow'; // he is looking at something or someone
        s = { ...s, hand: IDLE };
      }
    } else if (shook || -towards >= profile.shake.amplitude) {
      handVerdict = 'shake';
      s = { ...s, hand: IDLE };
    } else if (t - h.at >= HAND_SETTLE_MS) {
      fired.push('HAND');
      handVerdict = 'hand';
      s = {
        ...s,
        hand: IDLE,
        shakeSides: [], // the way back is not half a shake
        closedAtHand: s.closedSince !== null || s.closedAtHand, // a closure still going on is part of the look
      };
    }
  } else {
    s = {
      ...s,
      nodSince: null,
      nodTurned: false,
      shakeSides: [],
      rightSince: null,
      hand: WAIT,
      move: null,
    };
  }

  // One signal at a time, and a quiet time after it.
  const sent = fired.length && t - s.lastSignalAt >= profile.refractoryMs ? fired[0] : null;
  if (sent) s = { ...s, lastSignalAt: t };
  // A hand that was not sent says why, so tuning him never reads a hand that did nothing.
  if (handVerdict === 'hand' && sent !== 'HAND') handVerdict = 'tooSoon';

  // The report of the movement of the head (R9), once it is back and no hand is pending.
  let headReport: HeadReport | undefined;
  if (head) {
    const size = Math.max(Math.abs(yaw), Math.abs(pitch));
    const m = s.move;
    if (m === null) {
      if (size >= MOVE_START) {
        s = {
          ...s,
          move: { since: t, yaw, pitch, backAt: null, signal: sent, verdict: handVerdict },
        };
      }
    } else {
      const quiet = size < MOVE_START * RELEASE;
      const next: Movement = {
        since: m.since,
        yaw: signedPeak(m.yaw, yaw),
        pitch: signedPeak(m.pitch, pitch),
        backAt: quiet ? (m.backAt ?? t) : null,
        signal: m.signal ?? sent,
        verdict: m.verdict === 'hand' ? 'hand' : (handVerdict ?? m.verdict),
      };
      const pending = s.hand.kind === 'out' || s.hand.kind === 'settle';
      if (next.backAt !== null && !pending) {
        headReport = {
          ms: next.backAt - next.since,
          yaw: next.yaw,
          pitch: next.pitch,
          signal: next.signal,
          verdict: next.verdict ?? (next.yaw * profile.hand.direction > 0 ? 'small' : 'otherSide'),
        };
        s = { ...s, move: null };
      } else {
        s = { ...s, move: next };
      }
    }
  }

  return {
    state: s,
    signals: sent ? [sent] : [],
    ...(report ? { closure: report } : {}),
    ...(headReport ? { head: headReport } : {}),
  };
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

/** Every movement of the head in a recording, oldest first, with why it was or was not his look at his hand. */
export function headReports(frames: readonly FaceFrame[], profile: SignalProfile): HeadReport[] {
  let state = INITIAL_DETECTOR;
  const out: HeadReport[] = [];
  for (const frame of frames) {
    const d = detect(state, frame, profile);
    state = d.state;
    if (d.head) out.push(d.head);
  }
  return out;
}
