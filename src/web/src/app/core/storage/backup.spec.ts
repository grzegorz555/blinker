// Spec 017, T1: the backup format (R2, R4, R5). Every refusal must leave nothing usable.
import { describe, expect, it } from 'vitest';
import friendBoard from '../../../../public/boards/friend-pl.json';
import type { Board } from '../boards/board';
import { validateBoardData } from '../boards/validate-board';
import type { HistoryEntry } from '../history/history';
import { DEFAULT_SETTINGS } from '../settings/settings';
import { DEFAULT_PROFILE } from '../signals/profile';
import {
  BACKUP_LIMITS,
  backupFileName,
  buildBackup,
  checkBackupBytes,
  checkBackupData,
  type BackupData,
} from './backup';

const parsed = validateBoardData(friendBoard);
if (!parsed.ok) throw new Error('friend board invalid');
const builtIn: Board = parsed.board;
const BUILT_IN = builtIn.id;
const other: Board = { ...builtIn, id: 'kitchen', name: 'Kuchnia' };

const NOW = Date.UTC(2026, 10, 25, 10, 0, 0);
const history: HistoryEntry[] = [{ id: '1', text: 'DZIEŃ DOBRY', lang: 'pl', at: NOW - 1000 }];
const full: BackupData = {
  settings: { ...DEFAULT_SETTINGS, rowCue: false, theme: 'dark' },
  boards: [other],
  activeBoard: 'kitchen',
  profile: DEFAULT_PROFILE,
  language: 'pl',
  history,
  phrases: ['Pić', 'Zmień pozycję'],
};

const bytes = (text: string) => new TextEncoder().encode(text);
const check = (text: string) => checkBackupBytes(bytes(text), NOW, BUILT_IN);
/** A valid envelope as an object, to break one thing at a time. */
const envelope = (data: BackupData = full) => JSON.parse(buildBackup(data, NOW));
const checkObject = (value: unknown) => checkBackupData(value, NOW, BUILT_IN);
const errorOf = (result: ReturnType<typeof checkObject>) => (result.ok ? null : result.error);

describe('buildBackup and the file name (R3, R4)', () => {
  it('writes the envelope and only the parts that are present', () => {
    const file = JSON.parse(buildBackup({ settings: DEFAULT_SETTINGS }, NOW));
    expect(file).toEqual({
      format: 'blinker-backup',
      version: 1,
      createdAt: '2026-11-25T10:00:00.000Z',
      data: { settings: DEFAULT_SETTINGS },
    });
  });

  it('has the history only when given', () => {
    expect(Object.keys(envelope({ ...full, history: undefined }).data)).not.toContain('history');
    expect(Object.keys(envelope(full).data)).toContain('history');
  });

  it('names the file by the local date, in the screen language', () => {
    const day = new Date(2026, 10, 5, 23, 59);
    expect(backupFileName(day, 'pl')).toBe('blinker-kopia-2026-11-05.json');
    expect(backupFileName(day, 'en')).toBe('blinker-backup-2026-11-05.json');
  });
});

describe('checkBackupBytes: a round trip (R5)', () => {
  it('gives back exactly what was saved', () => {
    const result = check(buildBackup(full, NOW));
    expect(result).toEqual({ ok: true, backup: { createdAt: NOW, data: full } });
  });

  it('an empty backup (a device with nothing stored) is valid and holds nothing', () => {
    expect(check(buildBackup({}, NOW))).toEqual({ ok: true, backup: { createdAt: NOW, data: {} } });
  });

  it('keeps the favorite phrases settings, on or off, like every setting (spec 019)', () => {
    for (const suggestPhrases of [true, false]) {
      const settings = { ...DEFAULT_SETTINGS, suggestPhrases, phrasePauseMs: 4000 };
      const result = check(buildBackup({ ...full, settings }, NOW));
      expect(result.ok && result.backup.data.settings).toEqual(settings);
    }
    expect(DEFAULT_SETTINGS.suggestPhrases).toBe(false);
  });

  it('drops a leading BOM', () => {
    expect(check(String.fromCharCode(0xfeff) + buildBackup(full, NOW)).ok).toBe(true);
  });
});

describe('checkBackupBytes: the file (R5)', () => {
  it('refuses a file over 4 MiB before decoding it', () => {
    const big = new Uint8Array(BACKUP_LIMITS.bytes + 1);
    expect(checkBackupBytes(big, NOW, BUILT_IN)).toEqual({
      ok: false,
      error: { part: 'file', code: 'too-large' },
    });
  });

  it('refuses bytes that are not UTF-8 (a binary file, Windows-1250)', () => {
    const latin = new Uint8Array([0x7b, 0x22, 0xb9, 0x22, 0x7d]); // {"ą"} in Windows-1250
    expect(errorOf(checkBackupBytes(latin, NOW, BUILT_IN))).toEqual({
      part: 'file',
      code: 'not-text',
    });
  });

  it('refuses text that is not JSON', () => {
    expect(errorOf(check('format: blinker-backup'))).toEqual({ part: 'file', code: 'not-json' });
  });

  it('refuses a board file or any other JSON as "not a backup"', () => {
    expect(errorOf(check(JSON.stringify(friendBoard)))).toEqual({
      part: 'file',
      code: 'not-backup',
    });
    expect(errorOf(check('[]'))).toEqual({ part: 'file', code: 'not-backup' });
  });
});

describe('checkBackupData: the envelope (R5)', () => {
  it('refuses a newer version with its own code, and an unknown one as not a backup', () => {
    expect(errorOf(checkObject({ ...envelope(), version: 2 }))).toEqual({
      part: 'file',
      code: 'newer-version',
    });
    expect(errorOf(checkObject({ ...envelope(), version: '1' }))).toEqual({
      part: 'file',
      code: 'not-backup',
    });
  });

  it('refuses a date that is malformed, before 2026, or more than a day ahead', () => {
    for (const createdAt of [
      'yesterday',
      '2026-11-25',
      '2025-12-31T23:59:59.000Z',
      '2026-11-26T10:00:01.000Z',
      '2026-13-01T00:00:00.000Z',
      12345,
    ]) {
      expect(errorOf(checkObject({ ...envelope(), createdAt })), String(createdAt)).toEqual({
        part: 'file',
        code: 'bad-date',
      });
    }
    // A clock a few hours ahead on the other phone is fine.
    expect(checkObject({ ...envelope(), createdAt: '2026-11-25T20:00:00.000Z' }).ok).toBe(true);
  });

  it('refuses an unknown field in the envelope or in data', () => {
    expect(errorOf(checkObject({ ...envelope(), note: 'x' }))).toEqual({
      part: 'file',
      code: 'unknown-field',
    });
    const file = envelope();
    file.data.passwords = [];
    expect(errorOf(checkObject(file))).toEqual({ part: 'file', code: 'unknown-field' });
  });

  it('refuses a prototype key anywhere, also where a validator would drop it silently', () => {
    // validateSettings drops unknown keys, so only the tree scan stops this one.
    const inSettings = buildBackup(full, NOW).replace(
      '"settings": {',
      '"settings": { "__proto__": { "camera": false },',
    );
    expect(errorOf(check(inSettings))).toEqual({ part: 'file', code: 'forbidden-key' });
    const inHistory = buildBackup(full, NOW).replace('"text":', '"constructor": 1, "text":');
    expect(errorOf(check(inHistory))).toEqual({ part: 'file', code: 'forbidden-key' });
    expect(errorOf(check('{"prototype": {}}'))).toEqual({ part: 'file', code: 'forbidden-key' });
  });

  it('refuses nesting deeper than the format needs, without overflowing the stack', () => {
    const deep = '['.repeat(BACKUP_LIMITS.depth + 2) + ']'.repeat(BACKUP_LIMITS.depth + 2);
    expect(errorOf(check(deep))).toEqual({ part: 'file', code: 'too-deep' });
    const hostile = '['.repeat(100_000) + ']'.repeat(100_000);
    expect(() => check(hostile)).not.toThrow();
    expect(check(hostile).ok).toBe(false);
  });
});

describe('checkBackupData: each part through its own validator (R5)', () => {
  it.each([
    ['settings', { ...DEFAULT_SETTINGS, askAfterMs: 99 }],
    ['settings', 'dark'],
    ['boards', { id: 'x' }],
    ['boards', [{ ...other, name: '<script>' }]],
    ['activeBoard', 7],
    ['profile', { version: 2 }],
    ['language', 'de'],
    ['history', [{ id: '1', text: '', lang: 'pl', at: NOW }]],
    ['phrases', ['<b>Pić</b>']],
    ['phrases', ['Pić', 'pić']],
    ['phrases', 'Pić'],
  ] as const)('an invalid %s refuses the whole file and names the part', (part, value) => {
    const file = envelope();
    file.data[part] = value;
    expect(errorOf(checkObject(file))).toEqual({ part, code: 'invalid' });
  });

  it('refuses his built-in board in the file, a board twice, and more than 50 boards', () => {
    expect(errorOf(checkObject(envelope({ boards: [builtIn], activeBoard: BUILT_IN })))).toEqual({
      part: 'boards',
      code: 'reserved-id',
    });
    expect(errorOf(checkObject(envelope({ boards: [other, other] })))).toEqual({
      part: 'boards',
      code: 'duplicate-board',
    });
    const many = Array.from({ length: BACKUP_LIMITS.boards + 1 }, (_, i) => ({
      ...other,
      id: `b${i}`,
    }));
    expect(errorOf(checkObject(envelope({ boards: many })))).toEqual({
      part: 'boards',
      code: 'too-many-boards',
    });
  });

  it('the active board must be his built-in board or one of the file', () => {
    expect(checkObject(envelope({ activeBoard: BUILT_IN })).ok).toBe(true);
    expect(errorOf(checkObject(envelope({ boards: [other], activeBoard: 'garden' })))).toEqual({
      part: 'activeBoard',
      code: 'missing-board',
    });
  });

  it('keeps only the known fields of each history entry', () => {
    const file = envelope();
    file.data.history[0].extra = 'x';
    const result = checkObject(file);
    expect(result.ok && result.backup.data.history).toEqual(history);
  });
});
