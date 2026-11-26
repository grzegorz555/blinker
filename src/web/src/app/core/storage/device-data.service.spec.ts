import { TestBed } from '@angular/core/testing';
import { memoryStorage } from '../../../testing/memory-storage';
import { translocoTesting } from '../../../testing/transloco';
import type { Board } from '../boards/board';
import { ACTIVE_BOARD_KEY, BOARDS_KEY, BoardsService } from '../boards/boards.service';
import { CountingService, SPEAKER, TICK_SCHEDULER } from '../counting/counting.service';
import { HISTORY_KEY } from '../history/history';
import { CLOCK, HistoryService } from '../history/history.service';
import { LanguageService } from '../i18n/language.service';
import { LANGUAGE_STORAGE_KEY } from '../i18n/languages';
import { PHRASES_KEY } from '../phrases/phrases';
import { PhrasesService } from '../phrases/phrases.service';
import { DEFAULT_SETTINGS, SETTINGS_KEY } from '../settings/settings';
import { SettingsService } from '../settings/settings.service';
import { DEFAULT_PROFILE, PROFILE_KEY } from '../signals/profile';
import { ProfileService } from '../signals/profile.service';
import { FakeSpeaker } from '../speech/fake-speaker';
import { DeviceDataService } from './device-data.service';
import { STORAGE, STORAGE_PREFIX } from './local-store';

/** Every key Blinker stores today. A new store adds its key here, and the tests below make it reset and swept. */
const KEYS = [
  SETTINGS_KEY,
  BOARDS_KEY,
  ACTIVE_BOARD_KEY,
  PROFILE_KEY,
  HISTORY_KEY,
  LANGUAGE_STORAGE_KEY,
  PHRASES_KEY,
];

const board = (id: string): Board => ({
  schemaVersion: 1,
  id,
  name: id,
  locale: 'pl',
  columns: ['1', '2'],
  rows: ['1'],
  cells: [
    [
      { type: 'word', value: 'TAK' },
      { type: 'word', value: 'NIE' },
    ],
  ],
});

const file = (b: Board) => {
  const bytes = new TextEncoder().encode(JSON.stringify(b));
  return {
    name: `${b.id}.json`,
    size: bytes.length,
    arrayBuffer: async () => bytes.slice().buffer,
  };
};

const blinkerKeys = (data: Map<string, string>) =>
  [...data.keys()].filter((k) => k.startsWith(STORAGE_PREFIX)).sort();

describe('DeviceDataService (spec 013, R3, R5)', () => {
  afterEach(() => {
    document.documentElement.style.colorScheme = '';
    TestBed.resetTestingModule();
  });

  function setup() {
    const storage = memoryStorage(new Map([['other.app', 'kept']]));
    const speaker = new FakeSpeaker();
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [
        { provide: STORAGE, useValue: storage },
        { provide: SPEAKER, useValue: speaker },
        { provide: TICK_SCHEDULER, useValue: { every: () => () => undefined } },
        { provide: CLOCK, useValue: () => Date.UTC(2026, 10, 18) },
      ],
    });
    const services = {
      erase: TestBed.inject(DeviceDataService),
      counting: TestBed.inject(CountingService),
      settings: TestBed.inject(SettingsService),
      boards: TestBed.inject(BoardsService),
      history: TestBed.inject(HistoryService),
      profile: TestBed.inject(ProfileService),
      language: TestBed.inject(LanguageService),
      phrases: TestBed.inject(PhrasesService),
    };
    TestBed.tick();
    return { storage, speaker, ...services };
  }

  /** Every store filled through the services, a sentence being written and read aloud. */
  async function fill(s: ReturnType<typeof setup>) {
    s.settings.update({ camera: true, theme: 'dark', keyboard: true });
    await s.boards.import(file(board('one')));
    await s.boards.import(file(board('two')));
    s.boards.select('two');
    TestBed.tick();
    s.profile.save({ ...DEFAULT_PROFILE, refractoryMs: DEFAULT_PROFILE.refractoryMs + 100 });
    await s.language.setLanguage('pl');
    s.phrases.add('Zmień pozycję'); // spec 019, R9
    // "TAK" (Yes) on the board "two", read aloud: kept in the history, and the speech is still going.
    s.counting.touch({ kind: 'cell', column: 1, row: 1 });
    s.counting.touch({ kind: 'speak' });
    TestBed.tick();
  }

  function expectDefaults(s: ReturnType<typeof setup>) {
    expect(s.settings.settings()).toEqual(DEFAULT_SETTINGS);
    expect(s.boards.boards().map((b) => b.id)).toEqual([s.boards.builtIn.id]);
    expect(s.boards.active().id).toBe(s.boards.builtIn.id);
    expect(s.counting.config().board.id).toBe(s.boards.builtIn.id);
    expect(s.counting.config().confirmByNod).toBe(DEFAULT_SETTINGS.confirmByNod);
    expect(s.profile.profile()).toEqual(DEFAULT_PROFILE);
    expect(s.profile.calibrated()).toBe(false);
    expect(s.history.entries()).toEqual([]);
    expect(s.phrases.phrases()).toEqual([]);
    expect(s.counting.sentence()).toBe('');
    expect(s.counting.state().sentence.history).toEqual([]);
    expect(s.counting.spoken()).toBeNull();
    expect(document.documentElement.style.colorScheme).toBe('');
  }

  it('every storage key starts with the prefix "blinker."', () => {
    for (const key of KEYS) expect(key.startsWith(STORAGE_PREFIX), key).toBe(true);
  });

  it('filled, then erased: no "blinker." key is left, every service is at its defaults, other keys stay', async () => {
    const s = setup();
    await fill(s);
    // The fill reached every store we know of; a store missing from KEYS fails here.
    expect(blinkerKeys(s.storage.data)).toEqual([...KEYS].sort());
    expect(s.counting.sentence().trim()).toBe('TAK');
    expect(s.speaker.speaking).toBe(true);

    expect(s.erase.eraseAll()).toBe('erased');
    TestBed.tick(); // effects that ran after the erase must not write anything back

    expect(blinkerKeys(s.storage.data)).toEqual([]);
    expect(s.storage.data.get('other.app')).toBe('kept');
    expectDefaults(s);
    expect(s.speaker.speaking).toBe(false);
    for (const service of [s.settings, s.boards, s.history, s.profile, s.phrases]) {
      expect(service.problem()).toBeNull();
    }
  });

  it('the language on screen stays until the app is opened again; only the saved choice is gone', async () => {
    const s = setup();
    await fill(s);
    s.erase.eraseAll();
    expect(s.language.language()).toBe('pl');
    expect(document.documentElement.lang).toBe('pl');
    expect(s.storage.data.has(LANGUAGE_STORAGE_KEY)).toBe(false);
  });

  it('a key no service knows of (an older version) is swept too', () => {
    const s = setup();
    s.storage.data.set('blinker.old.v0', '{}');
    expect(s.erase.eraseAll()).toBe('erased');
    expect(blinkerKeys(s.storage.data)).toEqual([]);
  });

  it('nothing read aloud after the erase reaches the history', async () => {
    const s = setup();
    await fill(s);
    s.erase.eraseAll();
    s.speaker.finish(); // the browser reports the end of a speech that was cancelled
    TestBed.tick();
    expect(s.history.entries()).toEqual([]);
    expect(blinkerKeys(s.storage.data)).toEqual([]);
  });

  it('a storage that throws on removal gives the error result, and the app is still reset', async () => {
    const s = setup();
    await fill(s);
    s.storage.removeItem = () => {
      throw new Error('SecurityError');
    };
    expect(s.erase.eraseAll()).toBe('unavailable');
    TestBed.tick();
    expectDefaults(s);
    expect(s.speaker.speaking).toBe(false);
  });
});
