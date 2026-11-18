import { Injectable, inject } from '@angular/core';
import { BoardsService } from '../boards/boards.service';
import { CountingService } from '../counting/counting.service';
import { HistoryService } from '../history/history.service';
import { LanguageService } from '../i18n/language.service';
import { SettingsService } from '../settings/settings.service';
import { ProfileService } from '../signals/profile.service';
import { STORAGE, STORAGE_PREFIX, removeByPrefix } from './local-store';

/** 'erased': nothing of Blinker is left in the storage; 'unavailable': the storage refused (spec 013, R4). */
export type EraseResult = 'erased' | 'unavailable';

/**
 * "Usuń wszystkie dane" (Delete all data) (spec 013, R3, R5). Two steps, because each covers what the other cannot:
 * - every service goes back to its defaults, so the running app holds nothing of him and has nothing to write back;
 * - then a sweep removes every key with the `blinker.` prefix, also one a service does not know of (an older
 *   version's key), and checks that none is left.
 * The running app is reset even when the storage refuses. The language on screen stays; only the choice is forgotten.
 */
@Injectable({ providedIn: 'root' })
export class DeviceDataService {
  private readonly storage = inject(STORAGE);
  private readonly counting = inject(CountingService);
  private readonly settings = inject(SettingsService);
  private readonly boards = inject(BoardsService);
  private readonly history = inject(HistoryService);
  private readonly profile = inject(ProfileService);
  private readonly language = inject(LanguageService);

  eraseAll(): EraseResult {
    // First the sentence and the speech: nothing read aloud may reach the history after this point.
    this.counting.reset();
    this.settings.reset();
    this.boards.reset();
    this.history.reset();
    this.profile.reset();
    this.language.forgetChoice();
    return removeByPrefix(this.storage, STORAGE_PREFIX) ? 'erased' : 'unavailable';
  }
}
