// Spec 017, T2: save, check and restore through the real services (R2, R3, R5, R7).
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
import { DEFAULT_SETTINGS } from '../settings/settings';
import { SettingsService } from '../settings/settings.service';
import { DEFAULT_PROFILE, PROFILE_KEY } from '../signals/profile';
import { ProfileService } from '../signals/profile.service';
import { FakeSpeaker } from '../speech/fake-speaker';
import { BACKUP_LIMITS, type Backup } from './backup';
import { BackupService } from './backup.service';
import { DeviceDataService } from './device-data.service';
import { STORAGE } from './local-store';

const NOW = Date.UTC(2026, 10, 25, 10, 0, 0);

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

/** A File-like object, as the page passes it from the picker. */
const fileOf = (text: string, name = 'blinker-kopia-2026-11-25.json') => {
  const bytes = new TextEncoder().encode(text);
  return { name, size: bytes.length, arrayBuffer: async () => bytes.slice().buffer };
};

const calibrated = { ...DEFAULT_PROFILE, refractoryMs: DEFAULT_PROFILE.refractoryMs + 100 };

describe('BackupService (spec 017)', () => {
  afterEach(() => {
    document.documentElement.style.colorScheme = '';
    TestBed.resetTestingModule();
  });

  function setup(storage = memoryStorage()) {
    const speaker = new FakeSpeaker();
    TestBed.configureTestingModule({
      imports: [
        translocoTesting({ translocoConfig: { availableLangs: ['en', 'pl'], defaultLang: 'pl' } }),
      ],
      providers: [
        { provide: STORAGE, useValue: storage },
        { provide: SPEAKER, useValue: speaker },
        { provide: TICK_SCHEDULER, useValue: { every: () => () => undefined } },
        { provide: CLOCK, useValue: () => NOW },
      ],
    });
    const s = {
      storage,
      speaker,
      backup: TestBed.inject(BackupService),
      erase: TestBed.inject(DeviceDataService),
      counting: TestBed.inject(CountingService),
      settings: TestBed.inject(SettingsService),
      boards: TestBed.inject(BoardsService),
      history: TestBed.inject(HistoryService),
      profile: TestBed.inject(ProfileService),
      language: TestBed.inject(LanguageService),
    };
    TestBed.tick();
    return s;
  }
  type Setup = ReturnType<typeof setup>;

  /** His device: settings, two boards (the second active), a calibration, Polish, one sentence read aloud. */
  async function fill(s: Setup) {
    s.settings.update({ theme: 'dark', rowCue: false, keyboard: true });
    await s.boards.import(fileOf(JSON.stringify(board('one')), 'one.json'));
    await s.boards.import(fileOf(JSON.stringify(board('two')), 'two.json'));
    s.boards.select('two');
    s.profile.save(calibrated);
    await s.language.setLanguage('pl');
    s.counting.touch({ kind: 'cell', column: 1, row: 1 });
    s.counting.touch({ kind: 'speak' });
    TestBed.tick();
    s.speaker.finish();
    TestBed.tick();
  }

  async function restoreText(s: Setup, text: string) {
    const checked = await s.backup.check(fileOf(text));
    if (!checked.ok) throw new Error(`check failed: ${JSON.stringify(checked.error)}`);
    const result = await s.backup.restore(checked.backup);
    TestBed.tick();
    return result;
  }

  function expectFilled(s: Setup) {
    expect(s.settings.settings()).toEqual({
      ...DEFAULT_SETTINGS,
      theme: 'dark',
      rowCue: false,
      keyboard: true,
    });
    expect(s.boards.boards().map((b) => b.id)).toEqual([s.boards.builtIn.id, 'one', 'two']);
    expect(s.boards.active().id).toBe('two');
    expect(s.counting.config().board.id).toBe('two');
    expect(s.counting.config().rowCue).toBe(false);
    expect(s.profile.profile()).toEqual(calibrated);
    expect(s.profile.calibrated()).toBe(true);
    expect(s.language.language()).toBe('pl');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  }

  describe('save (R2, R3)', () => {
    it('holds every store, but the history only when asked; the file is named by the date and language', async () => {
      const s = setup();
      await fill(s);
      expect(s.history.entries()).toHaveLength(1);

      const without = s.backup.save(false);
      expect(without.fileName).toBe('blinker-kopia-2026-11-25.json');
      const data = JSON.parse(without.text).data;
      expect(Object.keys(data).sort()).toEqual(
        ['activeBoard', 'boards', 'language', 'profile', 'settings'].sort(),
      );
      expect(Object.keys(JSON.parse(s.backup.save(true).text).data)).toContain('history');
    });

    it('a corrupted store is left out, not copied; an active board that is gone is left out', () => {
      const storage = memoryStorage(
        new Map([
          [PROFILE_KEY, '{"version":1,'],
          [ACTIVE_BOARD_KEY, '"garden"'],
          [LANGUAGE_STORAGE_KEY, 'de'],
        ]),
      );
      const s = setup(storage);
      expect(JSON.parse(s.backup.save(true).text).data).toEqual({});
    });
  });

  describe('check (R5)', () => {
    it('refuses a file not named .json, or too large, before reading it', async () => {
      const s = setup();
      const read = vi.fn(async () => new ArrayBuffer(0));
      expect(await s.backup.check({ name: 'kopia.txt', size: 10, arrayBuffer: read })).toEqual({
        ok: false,
        error: { part: 'file', code: 'not-json-file' },
      });
      expect(
        await s.backup.check({ name: 'a.json', size: BACKUP_LIMITS.bytes + 1, arrayBuffer: read }),
      ).toEqual({ ok: false, error: { part: 'file', code: 'too-large' } });
      expect(read).not.toHaveBeenCalled();
    });

    it('a file that can no longer be read is refused, never thrown', async () => {
      const s = setup();
      const gone = {
        name: 'a.json',
        size: 10,
        arrayBuffer: async () => Promise.reject(new Error('NotFound')),
      };
      expect(await s.backup.check(gone)).toEqual({
        ok: false,
        error: { part: 'file', code: 'not-text' },
      });
    });

    it('his built-in board in a file is refused (it ships with the app)', async () => {
      const s = setup();
      const text = JSON.stringify({
        format: 'blinker-backup',
        version: 1,
        createdAt: new Date(NOW).toISOString(),
        data: { boards: [s.boards.builtIn] },
      });
      expect(await s.backup.check(fileOf(text))).toEqual({
        ok: false,
        error: { part: 'boards', code: 'reserved-id' },
      });
    });
  });

  describe('restore (R7)', () => {
    it('a round trip: save, delete all data, restore — the device is as it was, at once', async () => {
      const s = setup();
      await fill(s);
      const saved = s.backup.save(true);
      const history = s.history.entries();
      expect(history).toHaveLength(1);
      s.erase.eraseAll();
      TestBed.tick();
      expect(s.profile.calibrated()).toBe(false);

      expect(await restoreText(s, saved.text)).toBe('restored');
      expectFilled(s);
      expect(s.history.entries()).toEqual(history);
      for (const service of [s.settings, s.boards, s.history, s.profile]) {
        expect(service.problem()).toBeNull();
      }
    });

    it('a file without a history leaves the history on this device as it is', async () => {
      const s = setup();
      await fill(s);
      const saved = s.backup.save(false);
      const before = s.storage.data.get(HISTORY_KEY);
      expect(before).toBeDefined();

      expect(await restoreText(s, saved.text)).toBe('restored');
      expect(s.storage.data.get(HISTORY_KEY)).toBe(before);
      expect(s.history.entries()).toHaveLength(1);
    });

    it('a file with a history replaces it', async () => {
      const s = setup();
      const other = {
        format: 'blinker-backup',
        version: 1,
        createdAt: new Date(NOW).toISOString(),
        data: { history: [{ id: 'x', text: 'NIE', lang: 'pl', at: NOW - 60_000 }] },
      };
      await fill(s);
      expect(await restoreText(s, JSON.stringify(other))).toBe('restored');
      expect(s.history.entries().map((e) => e.text)).toEqual(['NIE']);
    });

    it('a part absent from the file goes back to its default', async () => {
      const s = setup();
      await fill(s);
      const onlySettings = JSON.stringify({
        format: 'blinker-backup',
        version: 1,
        createdAt: new Date(NOW).toISOString(),
        data: { settings: { ...DEFAULT_SETTINGS, theme: 'light' } },
      });
      expect(await restoreText(s, onlySettings)).toBe('restored');
      expect(s.settings.settings().theme).toBe('light');
      expect(s.boards.boards().map((b) => b.id)).toEqual([s.boards.builtIn.id]);
      expect(s.boards.active().id).toBe(s.boards.builtIn.id);
      expect(s.profile.calibrated()).toBe(false);
      expect(s.profile.profile()).toEqual(DEFAULT_PROFILE);
      for (const key of [BOARDS_KEY, ACTIVE_BOARD_KEY, PROFILE_KEY, LANGUAGE_STORAGE_KEY]) {
        expect(s.storage.data.has(key), key).toBe(false);
      }
      // The screen keeps its language when the file has no choice (as after Delete all data).
      expect(s.language.language()).toBe('pl');
    });

    it('applies the language of the file to the screen at once', async () => {
      const s = setup();
      const english = JSON.stringify({
        format: 'blinker-backup',
        version: 1,
        createdAt: new Date(NOW).toISOString(),
        data: { language: 'en' },
      });
      expect(await restoreText(s, english)).toBe('restored');
      expect(s.language.language()).toBe('en');
      expect(document.documentElement.lang).toBe('en');
      expect(s.storage.data.get(LANGUAGE_STORAGE_KEY)).toBe('en');
    });

    it('clears the sentence being written and stops speech', async () => {
      const s = setup();
      const saved = s.backup.save(false);
      s.counting.touch({ kind: 'cell', column: 1, row: 1 });
      s.counting.touch({ kind: 'speak' });
      TestBed.tick();
      expect(s.speaker.speaking).toBe(true);
      await restoreText(s, saved.text);
      expect(s.counting.sentence()).toBe('');
      expect(s.speaker.speaking).toBe(false);
    });

    it.each([1, 2, 3, 4, 5])(
      'a storage that refuses write %i puts the old values back and changes nothing in the app',
      async (failAt) => {
        const s = setup();
        await fill(s);
        const saved = s.backup.save(false);
        const checked = await s.backup.check(fileOf(saved.text.replace('"dark"', '"light"')));
        if (!checked.ok) throw new Error('check failed');
        const before = new Map(s.storage.data);
        // Refuse the n-th write of the restore (a full quota), then nothing more.
        let writes = 0;
        const { setItem, removeItem } = s.storage;
        const counted =
          <A extends unknown[]>(op: (...args: A) => void) =>
          (...args: A) => {
            writes++;
            if (writes === failAt) throw new DOMException('full', 'QuotaExceededError');
            op(...args);
          };
        s.storage.setItem = counted(setItem);
        s.storage.removeItem = counted(removeItem);
        const result = await s.backup.restore(checked.backup);
        s.storage.setItem = setItem;
        s.storage.removeItem = removeItem;
        TestBed.tick();

        expect(result).toBe('unavailable');
        expect(s.storage.data).toEqual(before);
        expectFilled(s);
      },
    );

    it('without any storage, nothing is restored', async () => {
      const s = setup();
      const checked = await s.backup.check(fileOf(s.backup.save(false).text));
      if (!checked.ok) throw new Error('check failed');
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [translocoTesting()],
        providers: [
          { provide: STORAGE, useValue: null },
          { provide: SPEAKER, useValue: new FakeSpeaker() },
          { provide: TICK_SCHEDULER, useValue: { every: () => () => undefined } },
        ],
      });
      const backup: Backup = checked.backup;
      expect(await TestBed.inject(BackupService).restore(backup)).toBe('unavailable');
    });
  });
});
