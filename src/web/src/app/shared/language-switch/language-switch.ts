import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LanguageService } from '../../core/i18n/language.service';
import {
  LANGUAGE_ENDONYMS,
  SUPPORTED_LANGUAGES,
  type LanguageCode,
} from '../../core/i18n/languages';

/**
 * UI language switch: toggle buttons showing each language in its own name (spec 001, R4).
 * The current language is exposed with aria-pressed, not by color alone.
 * Each label carries its own `lang`, so screen readers pronounce it correctly (SC 3.1.2).
 * Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/button/
 */
@Component({
  selector: 'app-language-switch',
  imports: [TranslocoPipe],
  templateUrl: './language-switch.html',
})
export class LanguageSwitch {
  private readonly languageService = inject(LanguageService);
  protected readonly languages = SUPPORTED_LANGUAGES;
  protected readonly endonyms = LANGUAGE_ENDONYMS;
  protected readonly current = this.languageService.language;

  protected select(lang: LanguageCode): void {
    if (lang !== this.current()) void this.languageService.setLanguage(lang);
  }
}
