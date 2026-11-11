import { expect, test, type Page } from './support/test';
import { expectNoA11yViolations } from './support/a11y';

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(0);
}

test.describe('app shell', () => {
  test('has banner, main and contentinfo landmarks (R6)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('banner')).toHaveCount(1);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('contentinfo')).toHaveCount(1);
  });

  test('skip link is first in tab order, visible on focus and moves focus to main (R5)', async ({
    page,
    browserName,
  }) => {
    // Desktop Safari/WebKit skips links on Tab by default; keyboard checks run in Chromium.
    test.skip(browserName === 'webkit', 'WebKit does not focus links with Tab by default');
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeInViewport();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('main')).toBeFocused();
  });

  test('reflows without horizontal scroll at 320 px (R8)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/');
    await expectNoHorizontalScroll(page);
  });

  test('works in landscape without horizontal scroll (R8)', async ({ page }) => {
    const size = page.viewportSize()!;
    await page.setViewportSize({
      width: Math.max(size.width, size.height),
      height: Math.min(size.width, size.height),
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoA11yViolations(page);
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`home has no axe violations in ${colorScheme} mode (R7)`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expectNoA11yViolations(page);
    });

    test(`focused skip link has no axe violations in ${colorScheme} mode (R7)`, async ({
      page,
      browserName,
    }) => {
      test.skip(browserName === 'webkit', 'WebKit does not focus links with Tab by default');
      await page.emulateMedia({ colorScheme });
      await page.goto('/');
      await page.keyboard.press('Tab');
      await expectNoA11yViolations(page);
    });
  }

  test('unknown URL shows the not-found page with a way back home', async ({ page }) => {
    await page.goto('/does-not-exist');
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
    await expect(page).toHaveTitle('Page not found · Blinker');
    await expectNoA11yViolations(page);
    await page.getByRole('link', { name: 'Go to the home page' }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});
