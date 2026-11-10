import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { LANGUAGE_STORAGE_KEY, type LanguageCode, resolveLanguage } from './languages';

/**
 * Owns the active UI language: resolves it on start, applies it to Transloco and to
 * `<html lang>` (SC 3.1.1), and persists an explicit choice (spec 001, R2–R3).
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly transloco = inject(TranslocoService);
  private readonly document = inject(DOCUMENT);
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

  /** Switches the language at runtime and remembers the choice. */
  async setLanguage(lang: LanguageCode): Promise<void> {
    await firstValueFrom(this.transloco.load(lang));
    this.apply(lang);
    this.save(lang);
  }

  private apply(lang: LanguageCode): void {
    this.transloco.setActiveLang(lang);
    this.document.documentElement.lang = lang;
    this.current.set(lang);
  }

  // localStorage can throw (e.g. storage disabled); the app must keep working without it.
  private readSaved(): string | null {
    try {
      return this.document.defaultView?.localStorage.getItem(LANGUAGE_STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  }

  private save(lang: LanguageCode): void {
    try {
      this.document.defaultView?.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
      /* not persisted; the choice still applies for this session */
    }
  }
}
