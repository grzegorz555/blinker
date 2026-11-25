// A backup of his data in one file (spec 017, R2, R4, R5). Plain TypeScript: the time comes in as `now`.
//
// A restored file is untrusted input (docs/conventions/security.md), checked before anything changes, all or nothing:
// - the size, a strict UTF-8 decode and JSON, as for an imported board (validate-board.ts);
// - a scan of the whole tree: no `__proto__`, `constructor` or `prototype` key at any depth, and a depth cap, before
//   any validator sees the data (`validateSettings` drops unknown keys, so it would not refuse them by itself);
// - the envelope: exactly `format`, `version`, `createdAt`, `data`; a newer version is refused, never guessed;
// - each part through the validator its store already uses when it reads itself back.
// https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
import type { Board } from '../boards/board';
import { validateBoardData } from '../boards/validate-board';
import { validateHistory, type HistoryEntry } from '../history/history';
import { isLanguageCode, type LanguageCode } from '../i18n/languages';
import { validateSettings, type Settings } from '../settings/settings';
import { validateProfile, type SignalProfile } from '../signals/profile';
import { isPlainObject } from './local-store';

export const BACKUP_FORMAT = 'blinker-backup';
export const BACKUP_VERSION = 1;

const DAY_MS = 24 * 60 * 60 * 1000;

export const BACKUP_LIMITS = {
  /** 500 sentences of up to 2,000 characters and 50 boards of up to 64 KiB fit with room to spare. */
  bytes: 4 * 1024 * 1024,
  boards: 50,
  /** The deepest the format goes is a board's cells (data → boards → board → cells → row → cell → value). */
  depth: 12,
  /** A clock a little ahead on the other phone is fine; a date far in the future is not. */
  futureMs: DAY_MS,
} as const;

/** What a backup holds; an absent part means the device had nothing stored there. */
export interface BackupData {
  readonly settings?: Settings;
  readonly boards?: readonly Board[];
  readonly activeBoard?: string;
  readonly profile?: SignalProfile;
  readonly language?: LanguageCode;
  /** Only when the person asked for it (R2). */
  readonly history?: readonly HistoryEntry[];
}

export interface Backup {
  /** When the file was made, ms since the epoch. */
  readonly createdAt: number;
  readonly data: BackupData;
}

export const BACKUP_PARTS = [
  'settings',
  'boards',
  'activeBoard',
  'profile',
  'language',
  'history',
] as const;
export type BackupPart = (typeof BACKUP_PARTS)[number];

export type BackupErrorCode =
  | 'not-json-file'
  | 'too-large'
  | 'not-text'
  | 'not-json'
  | 'too-deep'
  | 'forbidden-key'
  | 'not-backup'
  | 'newer-version'
  | 'bad-date'
  | 'unknown-field'
  | 'invalid'
  | 'too-many-boards'
  | 'reserved-id'
  | 'duplicate-board'
  | 'missing-board';

/** The first problem found, and where: the whole file, or one part of `data` (R5: the error names the part). */
export interface BackupError {
  readonly part: 'file' | BackupPart;
  readonly code: BackupErrorCode;
}

export type BackupResult =
  | { readonly ok: true; readonly backup: Backup }
  | { readonly ok: false; readonly error: BackupError };

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const ENVELOPE_FIELDS = new Set(['format', 'version', 'createdAt', 'data']);
const DATA_FIELDS = new Set<string>(BACKUP_PARTS);
/** The ISO 8601 form `Date.prototype.toISOString` writes, and nothing looser. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

const fail = (part: BackupError['part'], code: BackupErrorCode): BackupResult => ({
  ok: false,
  error: { part, code },
});

/** The file's text: the envelope and the parts that are present, readable when opened in an editor. */
export function buildBackup(data: BackupData, now: number): string {
  const parts: Record<string, unknown> = {};
  for (const part of BACKUP_PARTS) {
    if (data[part] !== undefined) parts[part] = data[part];
  }
  const envelope = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date(now).toISOString(),
    data: parts,
  };
  return JSON.stringify(envelope, null, 2) + '\n';
}

/** `blinker-kopia-2026-11-25.json` (pl) or `blinker-backup-2026-11-25.json` (en), the local date (R3). */
export function backupFileName(now: Date, language: LanguageCode): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `${language === 'pl' ? 'blinker-kopia' : 'blinker-backup'}-${day}.json`;
}

/**
 * Checks the bytes of a backup file: the size, then a strict UTF-8 decode (a binary file or another encoding is
 * refused instead of being read with replacement characters; a leading BOM is dropped), then the text. Never throws.
 */
export function checkBackupBytes(bytes: Uint8Array, now: number, builtInId: string): BackupResult {
  if (bytes.length > BACKUP_LIMITS.bytes) return fail('file', 'too-large');
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return fail('file', 'not-text');
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    // Not JSON, or nested so deep that the parser gave up (a RangeError).
    return fail('file', 'not-json');
  }
  return checkBackupData(data, now, builtInId);
}

/** Checks parsed data (R5). Never throws; on any problem nothing of the file may be used. */
export function checkBackupData(data: unknown, now: number, builtInId: string): BackupResult {
  const shape = scanTree(data);
  if (shape) return fail('file', shape);

  if (!isPlainObject(data) || data['format'] !== BACKUP_FORMAT) return fail('file', 'not-backup');
  if (typeof data['version'] === 'number' && data['version'] > BACKUP_VERSION) {
    return fail('file', 'newer-version');
  }
  if (data['version'] !== BACKUP_VERSION) return fail('file', 'not-backup');
  if (Object.keys(data).some((key) => !ENVELOPE_FIELDS.has(key))) {
    return fail('file', 'unknown-field');
  }

  const createdAt = parseDate(data['createdAt']);
  if (createdAt === null || createdAt > now + BACKUP_LIMITS.futureMs) {
    return fail('file', 'bad-date');
  }

  const parts = data['data'];
  if (!isPlainObject(parts)) return fail('file', 'not-backup');
  if (Object.keys(parts).some((key) => !DATA_FIELDS.has(key))) {
    return fail('file', 'unknown-field');
  }

  const result: { -readonly [K in keyof BackupData]: BackupData[K] } = {};

  if (Object.hasOwn(parts, 'settings')) {
    const settings = validateSettings(parts['settings']);
    if (!settings) return fail('settings', 'invalid');
    result.settings = settings;
  }

  if (Object.hasOwn(parts, 'boards')) {
    const boards = parts['boards'];
    if (!Array.isArray(boards)) return fail('boards', 'invalid');
    if (boards.length > BACKUP_LIMITS.boards) return fail('boards', 'too-many-boards');
    const checked: Board[] = [];
    for (const item of boards) {
      const board = validateBoardData(item);
      if (!board.ok) return fail('boards', 'invalid');
      if (board.board.id === builtInId) return fail('boards', 'reserved-id');
      if (checked.some((b) => b.id === board.board.id)) return fail('boards', 'duplicate-board');
      checked.push(board.board);
    }
    result.boards = checked;
  }

  if (Object.hasOwn(parts, 'activeBoard')) {
    const id = parts['activeBoard'];
    if (typeof id !== 'string') return fail('activeBoard', 'invalid');
    // The active board must exist after the restore: his built-in board, or one of the file's boards.
    if (id !== builtInId && !result.boards?.some((b) => b.id === id)) {
      return fail('activeBoard', 'missing-board');
    }
    result.activeBoard = id;
  }

  if (Object.hasOwn(parts, 'profile')) {
    const profile = validateProfile(parts['profile']);
    if (!profile) return fail('profile', 'invalid');
    result.profile = profile;
  }

  if (Object.hasOwn(parts, 'language')) {
    const language = parts['language'];
    if (!isLanguageCode(language)) return fail('language', 'invalid');
    result.language = language;
  }

  if (Object.hasOwn(parts, 'history')) {
    const history = validateHistory(parts['history']);
    if (!history) return fail('history', 'invalid');
    result.history = history;
  }

  return { ok: true, backup: { createdAt, data: result } };
}

/** The ISO date as ms, or null when it is not the exact form, not a real date, or before Blinker existed. */
function parseDate(value: unknown): number | null {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return null;
  const ms = Date.parse(value);
  if (Number.isNaN(ms) || ms < Date.UTC(2026, 0, 1)) return null;
  return ms;
}

/**
 * Walks the whole tree once: a forbidden key anywhere, or nesting deeper than the format needs, is refused. Iterative,
 * so a hostile file can't overflow the call stack.
 */
function scanTree(root: unknown): 'forbidden-key' | 'too-deep' | null {
  const stack: { value: unknown; depth: number }[] = [{ value: root, depth: 0 }];
  while (stack.length) {
    const { value, depth } = stack.pop()!;
    if (typeof value !== 'object' || value === null) continue;
    if (depth > BACKUP_LIMITS.depth) return 'too-deep';
    if (Array.isArray(value)) {
      for (const item of value) stack.push({ value: item, depth: depth + 1 });
      continue;
    }
    for (const key of Object.keys(value)) {
      if (FORBIDDEN_KEYS.has(key)) return 'forbidden-key';
      stack.push({ value: (value as Record<string, unknown>)[key], depth: depth + 1 });
    }
  }
  return null;
}
