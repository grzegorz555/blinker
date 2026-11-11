import { expect, test } from './support/test';
import { expectNoA11yViolations } from './support/a11y';

/**
 * Spec 001 acceptance: axe reports 0 violations on the home and 404 pages,
 * in light and dark mode, in both languages.
 */
const pages = [
  { path: '/', heading: { en: 'Blinker', pl: 'Blinker' } },
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
