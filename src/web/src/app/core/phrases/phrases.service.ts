import { Injectable, effect, inject, signal } from '@angular/core';
import { CountingService } from '../counting/counting.service';
import { SettingsService } from '../settings/settings.service';
import {
  STORAGE,
  readStored,
  removeStored,
  writeStored,
  type StoreProblem,
} from '../storage/local-store';
import { PHRASES_KEY, checkPhrase, validatePhrases, type PhraseError } from './phrases';

/** What "Usuń zwrot" (Delete the phrase) removed, enough for Cofnij (Undo). */
export interface RemovedPhrase {
  readonly phrase: string;
  readonly index: number;
}

/**
 * Spec 019: the favorite phrases a caregiver keeps for him, on the device only (R2, R9), and the list given to the
 * counting machine while "Podpowiadaj ulubione zwroty" (Suggest favorite phrases) is on (R1). Off, the machine gets an
 * empty list, so it never offers anything.
 */
@Injectable({ providedIn: 'root' })
export class PhrasesService {
  private readonly storage = inject(STORAGE);
  private readonly settings = inject(SettingsService).settings;
  private readonly counting = inject(CountingService);

  private readonly list = signal<readonly string[]>([]);
  readonly phrases = this.list.asReadonly();
  /** Why the stored list could not be read or written; shown in Zdania (Sentences). */
  readonly problem = signal<StoreProblem | null>(null);

  constructor() {
    this.reload();
    effect(() => {
      const on = this.settings().suggestPhrases;
      this.counting.configure({
        phrases: on ? this.list() : [],
        phrasePauseMs: this.settings().phrasePauseMs,
      });
    });
  }

  /** R2: adds a typed phrase, or a sentence from the history, at the end; the error says why not. */
  add(raw: string): PhraseError | null {
    const check = checkPhrase(raw, this.list());
    if (!check.ok) return check.error;
    this.save([...this.list(), check.phrase]);
    return null;
  }

  /** True when the phrase (compared as R3 compares) is on the list: the star in the history is filled. */
  has(raw: string): boolean {
    const check = checkPhrase(raw, this.list());
    return !check.ok && check.error === 'duplicate';
  }

  /** "Usuń zwrot" (Delete the phrase): what was removed, for Cofnij (Undo); null when it is not there. */
  remove(index: number): RemovedPhrase | null {
    const phrase = this.list()[index];
    if (phrase === undefined) return null;
    this.save(this.list().filter((_, i) => i !== index));
    return { phrase, index };
  }

  /** Cofnij (Undo) after a delete (spec 018, R6): back to its place, once. */
  restore(removed: RemovedPhrase): boolean {
    const check = checkPhrase(removed.phrase, this.list());
    if (!check.ok) return false;
    const list = [...this.list()];
    list.splice(Math.min(removed.index, list.length), 0, check.phrase);
    this.save(list);
    return true;
  }

  /** "W górę" (Up) / "W dół" (Down): one place; false at the ends. */
  move(index: number, by: -1 | 1): boolean {
    const to = index + by;
    const list = [...this.list()];
    if (index < 0 || index >= list.length || to < 0 || to >= list.length) return false;
    [list[index], list[to]] = [list[to], list[index]];
    this.save(list);
    return true;
  }

  /** Reads the stored list again (a restored backup, spec 017, R7). A bad store is ignored, not used (R9). */
  reload(): void {
    const stored = readStored(this.storage, PHRASES_KEY, validatePhrases);
    this.list.set(stored.value ?? []);
    this.problem.set(stored.problem);
  }

  /** Empty, and the stored list deleted ("Usuń wszystkie dane" (Delete all data), spec 013). */
  reset(): void {
    this.list.set([]);
    this.problem.set(removeStored(this.storage, PHRASES_KEY) ? null : 'unavailable');
  }

  private save(list: readonly string[]): void {
    this.list.set(list);
    if (!writeStored(this.storage, PHRASES_KEY, list)) this.problem.set('unavailable');
    else if (this.problem() === 'corrupted') this.problem.set(null);
  }
}
