import { DEFAULT_LANGUAGE, isLanguageCode, resolveLanguage } from './languages';

describe('isLanguageCode', () => {
  it.each(['en', 'pl'])('accepts %s', (value) => expect(isLanguageCode(value)).toBe(true));

  it.each(['PL', 'de', '', ' ', null, undefined, 42])('rejects %s', (value) =>
    expect(isLanguageCode(value)).toBe(false),
  );
});

describe('resolveLanguage (spec 001, R2)', () => {
  it('uses a valid saved choice before the browser language', () => {
    expect(resolveLanguage('en', ['pl-PL'])).toBe('en');
  });

  it('ignores an invalid saved value and falls back to the browser language', () => {
    expect(resolveLanguage('de', ['pl-PL'])).toBe('pl');
  });

  it('maps a regional browser tag to its primary language, case-insensitively', () => {
    expect(resolveLanguage(null, ['EN-gb'])).toBe('en');
  });

  it('takes the first supported browser language in preference order', () => {
    expect(resolveLanguage(undefined, ['de-DE', 'en-US', 'pl-PL'])).toBe('en');
  });

  it('falls back to the default when nothing is supported', () => {
    expect(resolveLanguage(null, ['de-DE', 'fr'])).toBe(DEFAULT_LANGUAGE);
    expect(DEFAULT_LANGUAGE).toBe('pl');
  });

  it('falls back to the default when the browser reports no languages', () => {
    expect(resolveLanguage(null, [])).toBe('pl');
  });
});
