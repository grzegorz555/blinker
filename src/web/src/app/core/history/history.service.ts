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
    const stored = readStored(this.storage, HISTORY_KEY, validateHistory);
    this.problem.set(stored.problem);
    if (stored.value) this.list.set(prune(stored.value, this.now()));

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

  /** "Powiedz jeszcze raz" (Say again): reads it aloud again; a repeat is not stored twice. */
  sayAgain(entry: HistoryEntry): void {
    this.counting.listen(entry.text, entry.lang);
  }

  remove(id: string): void {
    this.save(this.list().filter((e) => e.id !== id));
  }

  /** "Usuń historię" (Delete history), after the page's confirmation. */
  clear(): void {
    this.list.set([]);
    if (!removeStored(this.storage, HISTORY_KEY)) this.problem.set('unavailable');
  }

  private save(list: readonly HistoryEntry[]): void {
    this.list.set(list);
    if (!writeStored(this.storage, HISTORY_KEY, list)) this.problem.set('unavailable');
    else if (this.problem() === 'corrupted') this.problem.set(null);
  }
}
