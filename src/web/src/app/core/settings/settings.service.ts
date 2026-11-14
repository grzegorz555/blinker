import { Injectable, signal } from '@angular/core';
import { DEFAULT_SETTINGS, type Settings } from './settings';

/**
 * The settings as a signal (spec 007, R9). Changes apply at once; T6 keeps them on the device (R12).
 */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly current = signal<Settings>(DEFAULT_SETTINGS);
  readonly settings = this.current.asReadonly();

  update(patch: Partial<Settings>): void {
    this.current.update((s) => ({ ...s, ...patch }));
  }
}
