import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';
import { CountingService } from '../counting/counting.service';
import {
  STORAGE,
  readStored,
  removeStored,
  writeStored,
  type StoreProblem,
} from '../storage/local-store';
import { DEFAULT_SETTINGS, SETTINGS_KEY, validateSettings, type Settings } from './settings';

/**
 * The settings as a signal (spec 007, R9, R12). Read once from the device, validated like untrusted input; every
 * change applies at once (the counting machine, speech, the theme) and is written back. When the storage is blocked
 * or full, the app works in memory and `problem` says so.
 */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly storage = inject(STORAGE);
  private readonly counting = inject(CountingService);
  private readonly document = inject(DOCUMENT);

  private readonly current = signal<Settings>(DEFAULT_SETTINGS);
  readonly settings = this.current.asReadonly();
  /** Why the stored settings could not be read or written; shown in Ustawienia (Settings). */
  readonly problem = signal<StoreProblem | null>(null);

  constructor() {
    const stored = readStored(this.storage, SETTINGS_KEY, validateSettings);
    if (stored.value) this.current.set(stored.value);
    this.problem.set(stored.problem);

    effect(() => {
      const s = this.current();
      this.counting.configure({
        askAfterMs: s.askAfterMs,
        speakPrompts: s.speakPrompts,
        confirmByNod: s.confirmByNod,
      });
      this.counting.setRate(s.rate);
      // light-dark() in tokens.css follows the used color-scheme; "system" leaves it to the device.
      this.document.documentElement.style.colorScheme = s.theme === 'system' ? '' : s.theme;
    });
  }

  update(patch: Partial<Settings>): void {
    const next = validateSettings({ ...this.current(), ...patch });
    if (!next) return; // the page validates first; an invalid value is never stored
    this.current.set(next);
    if (!writeStored(this.storage, SETTINGS_KEY, next)) this.problem.set('unavailable');
    else if (this.problem() === 'corrupted') this.problem.set(null);
  }

  /** Back to the defaults, and the stored settings deleted ("Usuń wszystkie dane" (Delete all data), spec 013). */
  reset(): void {
    this.current.set(DEFAULT_SETTINGS);
    this.problem.set(removeStored(this.storage, SETTINGS_KEY) ? null : 'unavailable');
  }
}
