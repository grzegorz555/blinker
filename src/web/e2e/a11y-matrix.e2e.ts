import { expect, test } from './support/test';
import { expectNoA11yViolations } from './support/a11y';

/**
 * Spec 001 acceptance, extended by spec 007: axe reports 0 violations on every page and the 404 page,
 * in light and dark mode, in both languages.
 */
const pages = [
  { path: '/', heading: { en: 'Counting', pl: 'Liczenie' } },
  { path: '/sentences', heading: { en: 'Sentences', pl: 'Zdania' } },
  { path: '/boards', heading: { en: 'Boards', pl: 'Tablice' } },
  { path: '/settings', heading: { en: 'Settings', pl: 'Ustawienia' } },
  { path: '/does-not-exist', heading: { en: 'Page not found', pl: 'Nie znaleziono strony' } },
] as const;

for (const { path, heading } of pages) {
  for (const lang of ['en', 'pl'] as const) {
    for (const colorScheme of ['light', 'dark'] as const) {
      test.describe(`${path} · ${lang} · ${colorScheme}`, () => {
        test.use({ locale: lang === 'pl' ? 'pl-PL' : 'en-US', colorScheme });

        test('has no axe WCAG A/AA violations', async ({ page }) => {
          await page.goto(path);
          await expect(page.locator('html')).toHaveAttribute('lang', lang);
          await expect(page.getByRole('heading', { level: 1, name: heading[lang] })).toBeVisible();
          await expectNoA11yViolations(page);
        });
      });
    }
  }
}
