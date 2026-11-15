import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { STORAGE, type StorageLike } from '../storage/local-store';
import { DEFAULT_PROFILE, PROFILE_KEY, validateProfile } from './profile';
import { ProfileService } from './profile.service';

describe('validateProfile (spec 011, R2)', () => {
  it('accepts the defaults and returns a clean copy (unknown fields dropped)', () => {
    expect(validateProfile(DEFAULT_PROFILE)).toEqual(DEFAULT_PROFILE);
    expect(validateProfile({ ...DEFAULT_PROFILE, extra: 1 })).toEqual(DEFAULT_PROFILE);
  });

  it('a profile stored before the cue and the hand sides existed gets their defaults', () => {
    const { threshold, holdMs } = DEFAULT_PROFILE.hand;
    const { minMs, maxMs, squeeze } = DEFAULT_PROFILE.blink;
    const old = {
      ...DEFAULT_PROFILE,
      blink: { threshold: 0.4, minMs, maxMs, squeeze },
      hand: { threshold, holdMs },
    };
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
    const storage: StorageLike = {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v),
      removeItem: (k) => void data.delete(k),
    };
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
      hand: { ...DEFAULT_PROFILE.hand, threshold: 0.4, holdMs: 500 },
    };
    expect(service.save(custom)).toBe(true);
    expect(JSON.parse(data.get(PROFILE_KEY)!)).toEqual(custom);
    expect(service.calibrated()).toBe(true);
    service.reset();
    expect(data.has(PROFILE_KEY)).toBe(false);
    expect(service.profile()).toEqual(DEFAULT_PROFILE);
  });
});
