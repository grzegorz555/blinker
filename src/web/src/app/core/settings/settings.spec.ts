import { TestBed } from '@angular/core/testing';
import { translocoTesting } from '../../../testing/transloco';
import { CountingService, SPEAKER, TICK_SCHEDULER } from '../counting/counting.service';
import { FakeSpeaker } from '../speech/fake-speaker';
import { STORAGE, type StorageLike } from '../storage/local-store';
import { DEFAULT_SETTINGS, SETTINGS_KEY, validateSettings } from './settings';
import { SettingsService } from './settings.service';

describe('validateSettings (spec 007, R12)', () => {
  it('accepts the defaults and fills missing fields from them (an older version had fewer)', () => {
    expect(validateSettings(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
    expect(validateSettings({ keyboard: true })).toEqual({ ...DEFAULT_SETTINGS, keyboard: true });
  });

  it('the camera is off by default; its sound is on; the camera faces him (spec 012)', () => {
    expect(DEFAULT_SETTINGS.camera).toBe(false);
    expect(DEFAULT_SETTINGS.cameraPreview).toBe(false);
    expect(DEFAULT_SETTINGS.signalSound).toBe(true);
    expect(DEFAULT_SETTINGS.cameraFacing).toBe('user');
    expect(validateSettings({ cameraFacing: 'environment' })?.cameraFacing).toBe('environment');
    expect(validateSettings({ cameraFacing: 'left' })).toBeNull();
    expect(validateSettings({ camera: 'yes' })).toBeNull();
  });

  it('drops unknown fields (a newer version may add some)', () => {
    expect(validateSettings({ ...DEFAULT_SETTINGS, future: 1 })).toEqual(DEFAULT_SETTINGS);
  });

  it.each([
    ['not an object', 'text'],
    ['an array', []],
    ['a pause below 500 ms', { askAfterMs: 499 }],
    ['a pause above 5000 ms', { askAfterMs: 5001 }],
    ['a pause that is not whole', { askAfterMs: 1200.5 }],
    ['a switch that is not a boolean', { keyboard: 'yes' }],
    ['an unknown theme', { theme: 'pink' }],
    ['a rate out of range', { rate: 3 }],
  ])('rejects %s', (_name, data) => {
    expect(validateSettings(data)).toBeNull();
  });
});

describe('SettingsService (spec 007, R9, R12)', () => {
  function setup(stored?: string, storage?: StorageLike | null) {
    const data = new Map<string, string>(stored === undefined ? [] : [[SETTINGS_KEY, stored]]);
    const memory: StorageLike = {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v),
      removeItem: (k) => void data.delete(k),
    };
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [
        { provide: STORAGE, useValue: storage === undefined ? memory : storage },
        { provide: SPEAKER, useValue: new FakeSpeaker() },
        { provide: TICK_SCHEDULER, useValue: { every: () => () => undefined } },
      ],
    });
    const service = TestBed.inject(SettingsService);
    TestBed.tick();
    return { service, data, counting: TestBed.inject(CountingService) };
  }

  afterEach(() => {
    document.documentElement.style.colorScheme = '';
    TestBed.resetTestingModule();
  });

  it('starts with the defaults when nothing is stored', () => {
    const { service } = setup();
    expect(service.settings()).toEqual(DEFAULT_SETTINGS);
    expect(service.problem()).toBeNull();
  });

  it('reads stored settings and applies them to the counting machine', () => {
    const { service, counting } = setup(
      JSON.stringify({ askAfterMs: 2000, speakPrompts: true, confirmByNod: true }),
    );
    expect(service.settings().askAfterMs).toBe(2000);
    expect(counting.config().askAfterMs).toBe(2000);
    expect(counting.config().speakPrompts).toBe(true);
    expect(counting.config().confirmByNod).toBe(true);
  });

  it('falls back to the defaults on a corrupted value, and says so', () => {
    const { service } = setup('{"askAfterMs": 1}');
    expect(service.settings()).toEqual(DEFAULT_SETTINGS);
    expect(service.problem()).toBe('corrupted');
  });

  it('writes every change back, and a valid write clears the corrupted notice', () => {
    const { service, data } = setup('nonsense');
    service.update({ keyboard: true });
    expect(JSON.parse(data.get(SETTINGS_KEY)!)).toEqual({ ...DEFAULT_SETTINGS, keyboard: true });
    expect(service.problem()).toBeNull();
  });

  it('never stores an invalid value', () => {
    const { service, data } = setup();
    service.update({ askAfterMs: 10 });
    expect(service.settings().askAfterMs).toBe(DEFAULT_SETTINGS.askAfterMs);
    expect(data.has(SETTINGS_KEY)).toBe(false);
  });

  it('works in memory when the storage is blocked, and says so', () => {
    const { service } = setup(undefined, null);
    expect(service.problem()).toBe('unavailable');
    service.update({ hints: false });
    expect(service.settings().hints).toBe(false);
  });

  it('applies the theme as the color-scheme of the page; "system" leaves it to the device', () => {
    const { service } = setup();
    service.update({ theme: 'dark' });
    TestBed.tick();
    expect(document.documentElement.style.colorScheme).toBe('dark');
    service.update({ theme: 'system' });
    TestBed.tick();
    expect(document.documentElement.style.colorScheme).toBe('');
  });
});
