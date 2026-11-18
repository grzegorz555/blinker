import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { STORAGE } from '../storage/local-store';
import { DEFAULT_PROFILE, PROFILE_KEY, validateProfile } from './profile';
import { ProfileService } from './profile.service';
import { memoryStorage } from '../../../testing/memory-storage';

describe('validateProfile (spec 011, R2)', () => {
  it('accepts the defaults and returns a clean copy (unknown fields dropped)', () => {
    expect(validateProfile(DEFAULT_PROFILE)).toEqual(DEFAULT_PROFILE);
    expect(validateProfile({ ...DEFAULT_PROFILE, extra: 1 })).toEqual(DEFAULT_PROFILE);
  });

  it('a profile stored before the cue existed gets its default', () => {
    const { minMs, maxMs, squeeze } = DEFAULT_PROFILE.blink;
    const old = { ...DEFAULT_PROFILE, blink: { threshold: 0.4, minMs, maxMs, squeeze } };
    expect(validateProfile(old)).toEqual({
      ...DEFAULT_PROFILE,
      blink: { ...DEFAULT_PROFILE.blink, threshold: 0.4 },
    });
    expect(
      validateProfile({ ...DEFAULT_PROFILE, blink: { ...DEFAULT_PROFILE.blink, cue: 'nose' } }),
    ).toBeNull();
  });

  it('a profile stored before the squeeze existed gets the default squeeze', () => {
    const { minMs, maxMs } = DEFAULT_PROFILE.blink;
    const old = { ...DEFAULT_PROFILE, blink: { threshold: 0.4, minMs, maxMs } };
    expect(validateProfile(old)?.blink).toEqual({ ...DEFAULT_PROFILE.blink, threshold: 0.4 });
  });

  describe('his hand by the head (spec 015, R7)', () => {
    /** His profile as stored on 2026-11-17, with the eye hand of spec 011. */
    const his = {
      version: 1,
      neutral: { yaw: 4.9, pitch: 5.7 },
      blink: { threshold: 0.45, minMs: 600, maxMs: 2500, cue: 'eyeSquint', squeeze: 0.6 },
      hand: { threshold: 0.5, holdMs: 400, left: null, right: null },
      nod: { amplitude: 7.7, direction: 1, windowMs: 1200 },
      shake: { amplitude: 16, windowMs: 1500 },
      right: { amplitude: 34, direction: -1, holdMs: 300 },
      refractoryMs: 400,
    };

    it('reads his old stored profile: the eye fields go, the hand takes its defaults and his left', () => {
      const p = validateProfile(his);
      expect(p?.hand).toEqual({ amplitude: 25, direction: 1, pitch: 0, windowMs: 1500 });
      expect(p?.right).toEqual(his.right);
      expect(p?.nod).toEqual(his.nod);
      expect(p?.neutral).toEqual(his.neutral);
    });

    it('his left is the other way from his right', () => {
      const right1 = { ...his, right: { ...his.right, direction: 1 } };
      expect(validateProfile(right1)?.hand.direction).toBe(-1);
      expect(DEFAULT_PROFILE.hand.direction).toBe(-DEFAULT_PROFILE.right.direction);
    });

    it('keeps a stored hand of spec 015 as it is', () => {
      const hand = { amplitude: 30, direction: 1, pitch: -8.5, windowMs: 1200 };
      expect(validateProfile({ ...his, hand })?.hand).toEqual(hand);
      expect(validateProfile({ ...his, hand: {} })?.hand).toEqual({
        amplitude: 25,
        direction: 1,
        pitch: 0,
        windowMs: 1500,
      });
    });

    it.each([
      ['an amplitude of 3°', { amplitude: 3 }],
      ['an amplitude of 46°', { amplitude: 46 }],
      ['a direction of 0', { direction: 0 }],
      ['a pitch of 61°', { pitch: 61 }],
      ['a window of 300 ms', { windowMs: 300 }],
      ['a text amplitude', { amplitude: '25' }],
    ])('refuses a hand with %s', (_label, hand) => {
      expect(validateProfile({ ...his, hand })).toBeNull();
    });

    it('refuses a profile without a hand', () => {
      expect(validateProfile({ ...his, hand: undefined })).toBeNull();
    });
  });

  it.each([
    ['not an object', 'x'],
    ['another version', { ...DEFAULT_PROFILE, version: 2 }],
    [
      'a threshold above 1',
      { ...DEFAULT_PROFILE, blink: { ...DEFAULT_PROFILE.blink, threshold: 1.5 } },
    ],
    [
      'minMs over maxMs',
      { ...DEFAULT_PROFILE, blink: { threshold: 0.5, minMs: 2000, maxMs: 1500 } },
    ],
    ['a nod direction of 2', { ...DEFAULT_PROFILE, nod: { ...DEFAULT_PROFILE.nod, direction: 2 } }],
    [
      'a head right direction of 0',
      { ...DEFAULT_PROFILE, right: { ...DEFAULT_PROFILE.right, direction: 0 } },
    ],
    ['a missing part', { ...DEFAULT_PROFILE, shake: undefined }],
    ['a squeeze of 0', { ...DEFAULT_PROFILE, blink: { ...DEFAULT_PROFILE.blink, squeeze: 0 } }],
    ['NaN', { ...DEFAULT_PROFILE, neutral: { yaw: Number.NaN, pitch: 0 } }],
  ])('refuses %s', (_label, value) => {
    expect(validateProfile(value)).toBeNull();
  });
});

describe('ProfileService', () => {
  afterEach(() => TestBed.resetTestingModule());

  function setup(stored: string | null) {
    const data = new Map<string, string>(stored === null ? [] : [[PROFILE_KEY, stored]]);
    const storage = memoryStorage(data);
    TestBed.configureTestingModule({ providers: [{ provide: STORAGE, useValue: storage }] });
    return { service: TestBed.inject(ProfileService), data };
  }

  it('uses the defaults, not calibrated, when nothing is stored', () => {
    const { service } = setup(null);
    expect(service.profile()).toEqual(DEFAULT_PROFILE);
    expect(service.calibrated()).toBe(false);
  });

  it('reads a stored profile; a broken one falls back to the defaults and says so', () => {
    const custom = { ...DEFAULT_PROFILE, neutral: { yaw: 5, pitch: -3 } };
    expect(setup(JSON.stringify(custom)).service.profile()).toEqual(custom);
    TestBed.resetTestingModule();
    const broken = setup('{"version":1}').service;
    expect(broken.profile()).toEqual(DEFAULT_PROFILE);
    expect(broken.problem()).toBe('corrupted');
  });

  it('saves only a valid profile, and reset deletes it', () => {
    const { service, data } = setup(null);
    expect(service.save({ ...DEFAULT_PROFILE, refractoryMs: -1 })).toBe(false);
    expect(data.has(PROFILE_KEY)).toBe(false);
    const custom = {
      ...DEFAULT_PROFILE,
      hand: { ...DEFAULT_PROFILE.hand, amplitude: 30, direction: 1 as const },
    };
    expect(service.save(custom)).toBe(true);
    expect(JSON.parse(data.get(PROFILE_KEY)!)).toEqual(custom);
    expect(service.calibrated()).toBe(true);
    service.reset();
    expect(data.has(PROFILE_KEY)).toBe(false);
    expect(service.profile()).toEqual(DEFAULT_PROFILE);
    expect(service.problem()).toBeNull();
  });

  it('reset still applies the defaults when the storage is blocked, and says so', () => {
    TestBed.configureTestingModule({ providers: [{ provide: STORAGE, useValue: null }] });
    const service = TestBed.inject(ProfileService);
    service.reset();
    expect(service.profile()).toEqual(DEFAULT_PROFILE);
    expect(service.calibrated()).toBe(false);
    expect(service.problem()).toBe('unavailable');
  });
});
