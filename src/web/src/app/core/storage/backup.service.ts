import { Injectable, inject } from '@angular/core';
import {
  ACTIVE_BOARD_KEY,
  BOARDS_KEY,
  BoardsService,
  validateStoredBoards,
} from '../boards/boards.service';
import { CountingService } from '../counting/counting.service';
import { HISTORY_KEY, validateHistory } from '../history/history';
import { CLOCK, HistoryService } from '../history/history.service';
import { LanguageService } from '../i18n/language.service';
import { LANGUAGE_STORAGE_KEY, isLanguageCode } from '../i18n/languages';
import { PHRASES_KEY, validatePhrases } from '../phrases/phrases';
import { PhrasesService } from '../phrases/phrases.service';
import { SETTINGS_KEY, validateSettings } from '../settings/settings';
import { SettingsService } from '../settings/settings.service';
import { PROFILE_KEY, validateProfile } from '../signals/profile';
import { ProfileService } from '../signals/profile.service';
import {
  BACKUP_LIMITS,
  backupFileName,
  buildBackup,
  checkBackupBytes,
  type Backup,
  type BackupData,
  type BackupResult,
} from './backup';
import { STORAGE, readStored } from './local-store';

/** The file to download (R3). */
export interface SavedBackup {
  readonly fileName: string;
  readonly text: string;
}

/** 'restored': the device holds the file's data; 'unavailable': the storage refused and nothing changed (R7). */
export type RestoreResult = 'restored' | 'unavailable';

/** An empty list is not written: the file then keeps the phrases of the device it is restored on. */
const phrasesOrNone = (list: string[] | undefined) => (list?.length ? list : undefined);

/** The only kind of file a restore takes; the picker's `accept` is a hint a person can switch off, so we check. */
const JSON_FILE = /\.json$/i;

/** One key of the storage: its new raw value, or null to remove it. */
interface Write {
  readonly key: string;
  readonly value: string | null;
}

/**
 * Spec 017: a backup of his data in a file. `save` reads what the device keeps (each store through its validator, so
 * a corrupted store is left out rather than copied); `check` takes an untrusted file (backup.ts); `restore` writes the
 * file's data all or nothing, then the running app takes it at once.
 */
@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly storage = inject(STORAGE);
  private readonly now = inject(CLOCK);
  private readonly counting = inject(CountingService);
  private readonly settings = inject(SettingsService);
  private readonly boards = inject(BoardsService);
  private readonly history = inject(HistoryService);
  private readonly profile = inject(ProfileService);
  private readonly language = inject(LanguageService);
  private readonly phrases = inject(PhrasesService);

  /** R2, R3: every store that has a valid value; the history only when asked. */
  save(includeHistory: boolean): SavedBackup {
    const now = this.now();
    return {
      fileName: backupFileName(new Date(now), this.language.language()),
      text: buildBackup(this.read(includeHistory), now),
    };
  }

  /**
   * R5: checks a chosen file before anything changes. The name and the size are checked before the file is read;
   * then the bytes go through backup.ts. Never throws.
   */
  async check(file: Pick<File, 'name' | 'size' | 'arrayBuffer'>): Promise<BackupResult> {
    if (!JSON_FILE.test(file.name))
      return { ok: false, error: { part: 'file', code: 'not-json-file' } };
    if (file.size > BACKUP_LIMITS.bytes) {
      return { ok: false, error: { part: 'file', code: 'too-large' } };
    }
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await file.arrayBuffer());
    } catch {
      // The file was moved or deleted after it was chosen, or the system refused to read it.
      return { ok: false, error: { part: 'file', code: 'not-text' } };
    }
    return checkBackupBytes(bytes, this.now(), this.boards.builtIn.id);
  }

  /**
   * R7: the device holds what the file holds. A part absent from the file is removed (back to its default), except
   * the history: a file without one leaves the history on this device as it is. The writes are all or nothing: on the
   * first refusal every key written so far gets its old value back, and the running app is not changed.
   */
  async restore(backup: Backup): Promise<RestoreResult> {
    const { data } = backup;
    const json = (value: unknown) => (value === undefined ? null : JSON.stringify(value));
    const writes: Write[] = [
      { key: SETTINGS_KEY, value: json(data.settings) },
      { key: BOARDS_KEY, value: data.boards?.length ? json(data.boards) : null },
      { key: ACTIVE_BOARD_KEY, value: json(data.activeBoard) },
      { key: PROFILE_KEY, value: json(data.profile) },
      // The language is stored as plain text, not JSON (LanguageService).
      { key: LANGUAGE_STORAGE_KEY, value: data.language ?? null },
    ];
    if (data.history !== undefined) writes.push({ key: HISTORY_KEY, value: json(data.history) });
    // Like the history: a file without phrases (from before spec 019) keeps the phrases of this device (spec 019, R9).
    if (data.phrases !== undefined) writes.push({ key: PHRASES_KEY, value: json(data.phrases) });

    if (!this.writeAll(writes)) return 'unavailable';

    // The sentence being written and speech under way end, so nothing read aloud reaches the restored history.
    this.counting.reset();
    this.settings.reload();
    this.boards.reload();
    this.profile.reload();
    if (data.history !== undefined) this.history.reload();
    if (data.phrases !== undefined) this.phrases.reload();
    await this.language.restoreChoice(data.language ?? null);
    return 'restored';
  }

  /** What the device keeps, each store through the validator it uses when it reads itself back. */
  private read(includeHistory: boolean): BackupData {
    const value = <T>(key: string, validate: (data: unknown) => T | null) =>
      readStored(this.storage, key, validate).value ?? undefined;
    const boards = value(BOARDS_KEY, validateStoredBoards);
    const activeBoard = value(ACTIVE_BOARD_KEY, (d) => (typeof d === 'string' ? d : null));
    let language: string | null;
    try {
      language = this.storage?.getItem(LANGUAGE_STORAGE_KEY) ?? null;
    } catch {
      language = null; // the storage refuses: no language in the backup
    }
    return {
      settings: value(SETTINGS_KEY, validateSettings),
      boards: boards?.length ? boards : undefined,
      // Only an active board the restore will find (his board, or one in the file); otherwise his board is used.
      activeBoard:
        activeBoard === this.boards.builtIn.id || boards?.some((b) => b.id === activeBoard)
          ? activeBoard
          : undefined,
      profile: value(PROFILE_KEY, validateProfile),
      language: isLanguageCode(language) ? language : undefined,
      history: includeHistory ? value(HISTORY_KEY, validateHistory) : undefined,
      phrases: phrasesOrNone(value(PHRASES_KEY, validatePhrases)),
    };
  }

  /** Writes every key; on the first refusal puts back the old values of the keys already written. */
  private writeAll(writes: readonly Write[]): boolean {
    const storage = this.storage;
    if (!storage) return false;
    let old: (string | null)[];
    try {
      old = writes.map(({ key }) => storage.getItem(key));
    } catch {
      return false;
    }
    let done = 0;
    try {
      for (const { key, value } of writes) {
        if (value === null) storage.removeItem(key);
        else storage.setItem(key, value);
        done++;
      }
      return true;
    } catch {
      for (let i = 0; i <= Math.min(done, writes.length - 1); i++) {
        try {
          const previous = old[i];
          if (previous === null) storage.removeItem(writes[i].key);
          else storage.setItem(writes[i].key, previous);
        } catch {
          // The storage refuses even the old value; nothing more can be done here.
        }
      }
      return false;
    }
  }
}
