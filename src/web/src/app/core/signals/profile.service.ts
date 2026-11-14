import { Injectable, inject, signal } from '@angular/core';
import {
  STORAGE,
  readStored,
  removeStored,
  writeStored,
  type StoreProblem,
} from '../storage/local-store';
import { DEFAULT_PROFILE, PROFILE_KEY, validateProfile, type SignalProfile } from './profile';

/**
 * His calibrated profile (spec 011, R2): read once from the device and validated like untrusted input; saved only by
 * "Zapisz kalibrację" (Save the calibration). Without a stored profile the defaults are used and `calibrated` is false.
 */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly storage = inject(STORAGE);
  private readonly current = signal<SignalProfile>(DEFAULT_PROFILE);
  readonly profile = this.current.asReadonly();
  readonly calibrated = signal(false);
  readonly problem = signal<StoreProblem | null>(null);

  constructor() {
    const stored = readStored(this.storage, PROFILE_KEY, validateProfile);
    if (stored.value) {
      this.current.set(stored.value);
      this.calibrated.set(true);
    }
    this.problem.set(stored.problem);
  }

  save(profile: SignalProfile): boolean {
    const valid = validateProfile(profile);
    if (!valid) return false;
    this.current.set(valid);
    this.calibrated.set(true);
    const written = writeStored(this.storage, PROFILE_KEY, valid);
    this.problem.set(written ? null : 'unavailable');
    return written;
  }

  /** Back to the defaults ("Usuń kalibrację" (Delete the calibration)). */
  reset(): void {
    removeStored(this.storage, PROFILE_KEY);
    this.current.set(DEFAULT_PROFILE);
    this.calibrated.set(false);
    this.problem.set(null);
  }
}
