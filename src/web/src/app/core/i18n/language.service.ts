import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { STORAGE, removeStored } from '../storage/local-store';
import { LANGUAGE_STORAGE_KEY, type LanguageCode, resolveLanguage } from './languages';

/**
 * Owns the active UI language: resolves it on start, applies it to Transloco and to
 * `<html lang>` (SC 3.1.1), and persists an explicit choice (spec 001, R2–R3).
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly transloco = inject(TranslocoService);
  private readonly document = inject(DOCUMENT);
  private readonly storage = inject(STORAGE);
  private readonly current = signal<LanguageCode>(this.transloco.getActiveLang() as LanguageCode);

  /** The active language as a signal, for templates. */
  readonly language = this.current.asReadonly();

  /** Resolves the start language and loads its translations before the first render. */
  async init(): Promise<void> {
    const browser = this.document.defaultView?.navigator.languages ?? [];
    const lang = resolveLanguage(this.readSaved(), browser);
    await firstValueFrom(this.transloco.load(lang));
    this.apply(lang);
  }

  /**
   * Switches the language at runtime and remembers the choice.
   * If the user clicks again before the translations load, the latest click wins.
   */
  async setLanguage(lang: LanguageCode): Promise<void> {
    const request = ++this.latestRequest;
    await firstValueFrom(this.transloco.load(lang));
    if (request !== this.latestRequest) return;
    this.apply(lang);
    this.save(lang);
  }

  private latestRequest = 0;

  /**
   * Forgets the saved choice ("Usuń wszystkie dane" (Delete all data), spec 013, R3). The language on screen stays
   * until the app is opened again, because the caregiver is reading it; a switch still loading is dropped, so it
   * cannot save the choice again. False when the storage refused.
   */
  forgetChoice(): boolean {
    this.latestRequest++;
    return removeStored(this.storage, LANGUAGE_STORAGE_KEY);
  }

  /**
   * A restored backup (spec 017, R7): its language choice is applied and saved; a backup without one forgets the
   * saved choice, and the screen keeps its language, as after "Usuń wszystkie dane" (Delete all data).
   */
  async restoreChoice(lang: LanguageCode | null): Promise<void> {
    if (lang) await this.setLanguage(lang);
    else this.forgetChoice();
  }

  private apply(lang: LanguageCode): void {
    this.transloco.setActiveLang(lang);
    this.document.documentElement.lang = lang;
    this.current.set(lang);
  }

  // localStorage can throw (e.g. storage disabled); the app must keep working without it.
  private readSaved(): string | null {
    try {
      return this.storage?.getItem(LANGUAGE_STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  }

  private save(lang: LanguageCode): void {
    try {
      this.storage?.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
      /* not persisted; the choice still applies for this session */
    }
  }
}
