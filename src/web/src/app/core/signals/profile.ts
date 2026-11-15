// Spec 011, R2: his calibrated thresholds (a profile), with defaults and a validator. Plain TypeScript.
import { isPlainObject } from '../storage/local-store';
import { STRONG_CUES, type StrongCue } from './cues';

export interface SignalProfile {
  readonly version: 1;
  /** His head at rest, looking at the screen (degrees, MediaPipe's frame). */
  readonly neutral: { readonly yaw: number; readonly pitch: number };
  /**
   * His blink: both eyes at or above the threshold, no longer than maxMs, and either long (at least minMs) or strong
   * (his `cue` reaches `squeeze` at some point), so a short, forceful blink counts and an ordinary one (to wet the eye)
   * does not. A squeeze of 1 turns the strong blink off: then only long blinks count.
   */
  readonly blink: {
    readonly threshold: number;
    readonly minMs: number;
    readonly maxMs: number;
    readonly cue: StrongCue;
    readonly squeeze: number;
  };
  /**
   * Look at his hand: eyes down at or above the threshold for holdMs, with the head still. With `left` or `right` set,
   * the eyes must also go that way (to his left: `sidesOf().left`) at least that far; with both null, any way.
   */
  readonly hand: {
    readonly threshold: number;
    readonly holdMs: number;
    readonly left: number | null;
    readonly right: number | null;
  };
  /** Nod: pitch away by the amplitude and back within windowMs; direction 1 or -1 (0 = either). */
  readonly nod: {
    readonly amplitude: number;
    readonly direction: -1 | 0 | 1;
    readonly windowMs: number;
  };
  /** Shake: yaw past the amplitude to one side, then the other, within windowMs. */
  readonly shake: { readonly amplitude: number; readonly windowMs: number };
  /** Head right: yaw past the amplitude in the direction of his right, held for holdMs. */
  readonly right: {
    readonly amplitude: number;
    readonly direction: -1 | 1;
    readonly holdMs: number;
  };
  /** Quiet time after any signal. */
  readonly refractoryMs: number;
}

/** Reasonable guesses until he is calibrated (spec 011, R1). */
export const DEFAULT_PROFILE: SignalProfile = {
  version: 1,
  neutral: { yaw: 0, pitch: 0 },
  blink: { threshold: 0.5, minMs: 600, maxMs: 2500, cue: 'eyeSquint', squeeze: 0.6 },
  hand: { threshold: 0.5, holdMs: 400, left: null, right: null },
  nod: { amplitude: 12, direction: 0, windowMs: 1200 },
  shake: { amplitude: 10, windowMs: 1500 },
  right: { amplitude: 20, direction: 1, holdMs: 300 },
  refractoryMs: 400,
};

/** Safe ranges: a fitted or stored value outside them is clamped (fitting) or refused (stored). */
export const PROFILE_LIMITS = {
  threshold: [0.15, 0.95],
  squeeze: [0.15, 1],
  blinkMinMs: [250, 2000],
  blinkMaxMs: [1000, 6000],
  holdMs: [100, 2000],
  amplitude: [4, 45],
  windowMs: [400, 4000],
  angle: [-60, 60],
  refractoryMs: [0, 2000],
} as const satisfies Record<string, readonly [number, number]>;

export const PROFILE_KEY = 'blinker.profile.v1';

type Range = readonly [number, number];
const inRange = (v: unknown, [min, max]: Range): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const optionalSide = (v: unknown) =>
  v === undefined || v === null || inRange(v, PROFILE_LIMITS.threshold);
const obj = (v: unknown): Record<string, unknown> | null => (isPlainObject(v) ? v : null);

/** A stored profile, checked field by field; anything wrong gives null (the caller falls back and says so). */
export function validateProfile(data: unknown): SignalProfile | null {
  const p = obj(data);
  if (!p || p['version'] !== 1) return null;
  const n = obj(p['neutral']);
  const b = obj(p['blink']);
  const h = obj(p['hand']);
  const nod = obj(p['nod']);
  const s = obj(p['shake']);
  const r = obj(p['right']);
  const L = PROFILE_LIMITS;
  if (!n || !b || !h || !nod || !s || !r) return null;
  const ok =
    inRange(n['yaw'], L.angle) &&
    inRange(n['pitch'], L.angle) &&
    inRange(b['threshold'], L.threshold) &&
    inRange(b['minMs'], L.blinkMinMs) &&
    inRange(b['maxMs'], L.blinkMaxMs) &&
    (b['minMs'] as number) < (b['maxMs'] as number) &&
    // Added after the first profiles were stored: missing means the default.
    (b['squeeze'] === undefined || inRange(b['squeeze'], L.squeeze)) &&
    (b['cue'] === undefined || (STRONG_CUES as readonly unknown[]).includes(b['cue'])) &&
    optionalSide(h['left']) &&
    optionalSide(h['right']) &&
    inRange(h['threshold'], L.threshold) &&
    inRange(h['holdMs'], L.holdMs) &&
    inRange(nod['amplitude'], L.amplitude) &&
    [-1, 0, 1].includes(nod['direction'] as number) &&
    inRange(nod['windowMs'], L.windowMs) &&
    inRange(s['amplitude'], L.amplitude) &&
    inRange(s['windowMs'], L.windowMs) &&
    inRange(r['amplitude'], L.amplitude) &&
    [-1, 1].includes(r['direction'] as number) &&
    inRange(r['holdMs'], L.holdMs) &&
    inRange(p['refractoryMs'], L.refractoryMs);
  if (!ok) return null;
  return {
    version: 1,
    neutral: { yaw: n['yaw'] as number, pitch: n['pitch'] as number },
    blink: {
      threshold: b['threshold'] as number,
      minMs: b['minMs'] as number,
      maxMs: b['maxMs'] as number,
      cue: (b['cue'] as StrongCue | undefined) ?? DEFAULT_PROFILE.blink.cue,
      squeeze: (b['squeeze'] as number | undefined) ?? DEFAULT_PROFILE.blink.squeeze,
    },
    hand: {
      threshold: h['threshold'] as number,
      holdMs: h['holdMs'] as number,
      left: (h['left'] as number | null | undefined) ?? null,
      right: (h['right'] as number | null | undefined) ?? null,
    },
    nod: {
      amplitude: nod['amplitude'] as number,
      direction: nod['direction'] as -1 | 0 | 1,
      windowMs: nod['windowMs'] as number,
    },
    shake: { amplitude: s['amplitude'] as number, windowMs: s['windowMs'] as number },
    right: {
      amplitude: r['amplitude'] as number,
      direction: r['direction'] as -1 | 1,
      holdMs: r['holdMs'] as number,
    },
    refractoryMs: p['refractoryMs'] as number,
  };
}
