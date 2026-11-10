/** UI languages (docs/conventions/frontend.md, i18n). */
export const SUPPORTED_LANGUAGES = ['en', 'pl'] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number];

/** Fallback when neither a saved choice nor the browser language is supported (spec 001, R2). */
export const DEFAULT_LANGUAGE: LanguageCode = 'pl';

/** localStorage key for the user's explicit choice. */
export const LANGUAGE_STORAGE_KEY = 'blinker.language';

export function isLanguageCode(value: unknown): value is LanguageCode {
  return SUPPORTED_LANGUAGES.some((lang) => lang === value);
}

/**
 * Each language in its own name (endonym), so people can find their language even if they
 * can't read the current one. Constants, not translated.
 */
export const LANGUAGE_ENDONYMS: Record<LanguageCode, string> = {
  en: 'English',
  pl: 'Polski',
};

/**
 * Picks the UI language (spec 001, R2): a valid saved choice, then the first browser language
 * whose primary subtag we support ("pl-PL" → pl), then the default. Pure, so it is easy to test.
 */
export function resolveLanguage(
  saved: string | null | undefined,
  browserLanguages: readonly string[],
): LanguageCode {
  if (isLanguageCode(saved)) return saved;
  for (const tag of browserLanguages) {
    const primary = tag.toLowerCase().split('-')[0];
    if (isLanguageCode(primary)) return primary;
  }
  return DEFAULT_LANGUAGE;
}
