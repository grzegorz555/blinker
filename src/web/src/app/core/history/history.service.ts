import { Injectable, InjectionToken, effect, inject, signal, untracked } from '@angular/core';
import { CountingService } from '../counting/counting.service';
import { SettingsService } from '../settings/settings.service';
import {
  STORAGE,
  readStored,
  removeStored,
  writeStored,
  type StoreProblem,
} from '../storage/local-store';
import { HISTORY_KEY, addEntry, prune, validateHistory, type HistoryEntry } from './history';

/** The wall clock, for the time of a sentence (a fixed clock in tests). */
export const CLOCK = new InjectionToken<() => number>('CLOCK', {
  providedIn: 'root',
  factory: () => () => Date.now(),
});

/**
 * Zdania (Sentences) (spec 007, R11, R12): every sentence read aloud, kept on the device only, newest first, capped
 * at 500 sentences or 30 days. Turning the history off in the settings deletes it.
 */
@Injectable({ providedIn: 'root' })
export class HistoryService {
  private readonly storage = inject(STORAGE);
  private readonly counting = inject(CountingService);
  private readonly settings = inject(SettingsService).settings;
  private readonly now = inject(CLOCK);

  private readonly list = signal<readonly HistoryEntry[]>([]);
  readonly entries = this.list.asReadonly();
  readonly problem = signal<StoreProblem | null>(null);

  constructor() {
    this.reload();

    // A sentence read aloud: keep it, when the history is on.
    effect(() => {
      const spoken = this.counting.spoken();
      if (!spoken) return;
      untracked(() => {
        if (!this.settings().history) return;
        this.save(addEntry(this.list(), spoken.text, spoken.lang, this.now()));
      });
    });
    // The history turned off: delete what is kept.
    effect(() => {
      if (!this.settings().history) untracked(() => this.clear());
    });
  }

  /** Reads the stored history again (a restored backup that holds one, spec 017, R7). */
  reload(): void {
    const stored = readStored(this.storage, HISTORY_KEY, validateHistory);
    this.list.set(stored.value ? prune(stored.value, this.now()) : []);
    this.problem.set(stored.problem);
  }

  /** "Powiedz jeszcze raz" (Say again): reads it aloud again; a repeat is not stored twice. */
  sayAgain(entry: HistoryEntry): void {
    this.counting.listen(entry.text, entry.lang);
  }

  remove(id: string): void {
    this.save(this.list().filter((e) => e.id !== id));
  }

  /**
   * Cofnij (Undo) after deleting one sentence (spec 018, R6): it goes back to its place (the list is ordered by time)
   * and is saved again. Once: false when it is already there, or when the history is off (nothing is kept then).
   */
  restore(entry: HistoryEntry): boolean {
    if (!this.settings().history || this.list().some((e) => e.id === entry.id)) return false;
    this.save(prune([...this.list(), entry], this.now()));
    return this.list().some((e) => e.id === entry.id);
  }

  /** "Usuń historię" (Delete history), after the page's confirmation. */
  clear(): void {
    this.list.set([]);
    if (!removeStored(this.storage, HISTORY_KEY)) this.problem.set('unavailable');
  }

  /** Empty, and the stored history deleted; unlike `clear`, a past problem is forgotten (spec 013, R3). */
  reset(): void {
    this.list.set([]);
    this.problem.set(removeStored(this.storage, HISTORY_KEY) ? null : 'unavailable');
  }

  private save(list: readonly HistoryEntry[]): void {
    this.list.set(list);
    if (!writeStored(this.storage, HISTORY_KEY, list)) this.problem.set('unavailable');
    else if (this.problem() === 'corrupted') this.problem.set(null);
  }
}
