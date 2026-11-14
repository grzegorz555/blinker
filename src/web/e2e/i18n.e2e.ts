import { expect, test } from './support/test';
import { expectNoA11yViolations } from './support/a11y';

test.describe('i18n: browser language (R2)', () => {
  test.describe('Polish browser', () => {
    test.use({ locale: 'pl-PL' });

    test('starts in Polish with lang="pl" and a translated title', async ({ page }) => {
      await page.goto('/settings');
      await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
      await expect(page.getByRole('heading', { level: 1, name: 'Ustawienia' })).toBeVisible();
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
      await expect(page.getByRole('heading', { level: 1, name: 'Counting' })).toBeVisible();
    });
  });
});

test.describe('i18n: language switch (R3, R4)', () => {
  test.use({ locale: 'en-US' });

  test('switching updates text, lang, title and pressed state, and survives a reload', async ({
    page,
  }) => {
    await page.goto('/settings');
    await expect(page).toHaveTitle('Settings · Blinker');

    await page.getByRole('button', { name: 'Polski' }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'Ustawienia' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
    await expect(page).toHaveTitle('Ustawienia · Blinker');
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
    await expect(page.getByRole('heading', { level: 1, name: 'Ustawienia' })).toBeVisible();
  });

  test('a language button shows a pointer and changes on hover; the current one does not invite a click', async ({
    page,
  }) => {
    await page.goto('/settings');
    const polski = page.getByRole('button', { name: 'Polski' });
    await expect(polski).toHaveCSS('cursor', 'pointer');
    await expect(page.getByRole('button', { name: 'English' })).toHaveCSS('cursor', 'default');
    // Hover styles apply only where a pointer can hover (Tailwind wraps hover: in @media (hover: hover)).
    const canHover = await page.evaluate(() => matchMedia('(hover: hover)').matches);
    test.skip(!canHover, 'a touch screen has no hover');
    const before = await polski.evaluate((el) => getComputedStyle(el).backgroundColor);
    await polski.hover();
    await expect
      .poll(() => polski.evaluate((el) => getComputedStyle(el).backgroundColor))
      .not.toBe(before);
  });

  test('the switch works with the keyboard', async ({ page }) => {
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Polski' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
    await page.getByRole('button', { name: 'English' }).focus();
    await page.keyboard.press('Space');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});
