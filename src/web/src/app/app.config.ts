import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { TitleStrategy, provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { routes } from './app.routes';
import { LanguageService } from './core/i18n/language.service';
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from './core/i18n/languages';
import { TranslocoHttpLoader } from './core/i18n/transloco-loader';
import { TranslatedTitleStrategy } from './core/i18n/translated-title-strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch()),
    // Transloco: https://jsverse.gitbook.io/transloco
    provideTransloco({
      config: {
        availableLangs: [...SUPPORTED_LANGUAGES],
        defaultLang: DEFAULT_LANGUAGE,
        reRenderOnLangChange: true,
        missingHandler: { logMissingKey: isDevMode() },
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
    { provide: TitleStrategy, useClass: TranslatedTitleStrategy },
    // Load the start language before the first render, so no untranslated text flashes.
    provideAppInitializer(() => inject(LanguageService).init()),
  ],
};
