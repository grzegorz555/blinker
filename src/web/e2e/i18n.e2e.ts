import { expect, test } from './support/test';
import { expectNoA11yViolations } from './support/a11y';

test.describe('i18n: browser language (R2)', () => {
  test.describe('Polish browser', () => {
    test.use({ locale: 'pl-PL' });

    test('starts in Polish with lang="pl" and a translated title', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
      await expect(page.getByText('Tryb komunikacji pojawi się wkrótce.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Polski' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expectNoA11yViolations(page);
    });
  });

  test.describe('unsupported browser language', () => {
    test.use({ locale: 'de-DE' });

    test('falls back to Polish', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
    });
  });

  test.describe('English browser', () => {
    test.use({ locale: 'en-US' });

    test('starts in English', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page.getByText('The communication mode is coming soon.')).toBeVisible();
    });
  });
});

test.describe('i18n: language switch (R3, R4)', () => {
  test.use({ locale: 'en-US' });

  test('switching updates text, lang, title and pressed state, and survives a reload', async ({
    page,
  }) => {
    await page.goto('/does-not-exist');
    await expect(page).toHaveTitle('Page not found · Blinker');

    await page.getByRole('button', { name: 'Polski' }).click();

    await expect(
      page.getByRole('heading', { level: 1, name: 'Nie znaleziono strony' }),
    ).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
    await expect(page).toHaveTitle('Nie znaleziono strony · Blinker');
    await expect(page.getByRole('button', { name: 'Polski' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('button', { name: 'English' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(page.getByRole('group', { name: 'Język' })).toBeVisible();
    await expectNoA11yViolations(page);

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Nie znaleziono strony' }),
    ).toBeVisible();
  });

  test('the switch works with the keyboard', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Polski' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
    await page.getByRole('button', { name: 'English' }).focus();
    await page.keyboard.press('Space');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});
