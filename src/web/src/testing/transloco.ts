import { TranslocoTestingModule, type TranslocoTestingOptions } from '@jsverse/transloco';
import en from '../../public/i18n/en.json';
import pl from '../../public/i18n/pl.json';

/** Real en/pl translations for unit tests (docs/conventions/testing.md). */
export function translocoTesting(options: TranslocoTestingOptions = {}) {
  return TranslocoTestingModule.forRoot({
    langs: { en, pl },
    translocoConfig: { availableLangs: ['en', 'pl'], defaultLang: 'en' },
    preloadLangs: true,
    ...options,
  });
}

export { en, pl };
