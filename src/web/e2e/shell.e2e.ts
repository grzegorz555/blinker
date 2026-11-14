import { expect, test, type Page } from './support/test';
import { expectNoA11yViolations } from './support/a11y';

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(0);
}

test.describe('app shell', () => {
  test('has banner, navigation and main landmarks (spec 007, R2)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('banner')).toHaveCount(1);
    await expect(page.getByRole('navigation', { name: 'Main menu' })).toHaveCount(1);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('contentinfo')).toHaveCount(0);
  });

  test('skip link is first in tab order, visible on focus and moves focus to main (R5)', async ({
    page,
    browserName,
  }) => {
    // Desktop Safari/WebKit skips links on Tab by default; keyboard checks run in Chromium.
    test.skip(browserName === 'webkit', 'WebKit does not focus links with Tab by default');
    await page.goto('/');
    // Under load the first Tab can come before the page is ready: wait for the lazy start page first.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
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
    test(`Liczenie (Counting) has no axe violations in ${colorScheme} mode (R7)`, async ({
      page,
    }) => {
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

  test('unknown URL shows the not-found page with a way back to Liczenie (Counting)', async ({
    page,
  }) => {
    await page.goto('/does-not-exist');
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
    await expect(page).toHaveTitle('Page not found · Blinker');
    await expectNoA11yViolations(page);
    await page.getByRole('link', { name: 'Go to the home page' }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});

const pages = [
  { name: 'Counting', path: '/', title: 'Counting · Blinker' },
  { name: 'Sentences', path: '/sentences', title: 'Sentences · Blinker' },
  { name: 'Boards', path: '/boards', title: 'Boards · Blinker' },
  { name: 'Settings', path: '/settings', title: 'Settings · Blinker' },
] as const;

test.describe('navigation bar and rail (spec 007, R2)', () => {
  test.use({ locale: 'en-US' });

  const sizes = [
    { width: 360, height: 640, rail: false },
    { width: 390, height: 844, rail: false },
    { width: 640, height: 360, rail: true },
    { width: 768, height: 1024, rail: true },
    { width: 1280, height: 800, rail: true },
  ];
  for (const { width, height, rail } of sizes) {
    test(`${rail ? 'a rail on the left' : 'a bar at the bottom'} at ${width} × ${height}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/settings');
      const nav = page.getByRole('navigation', { name: 'Main menu' });
      // The rail's surface is the app-nav host; the <nav> list inside is only as tall as its links.
      const box = (await page.locator('app-nav').boundingBox())!;
      if (rail) {
        expect(box.x).toBeLessThanOrEqual(1);
        expect(box.width).toBeLessThan(120);
        expect(box.height).toBeGreaterThan(height * 0.9);
      } else {
        expect(Math.round(box.y + box.height)).toBeGreaterThanOrEqual(height - 1);
        expect(box.width).toBeGreaterThanOrEqual(width - 1);
      }
      for (const link of await nav.getByRole('link').all()) {
        const target = (await link.boundingBox())!;
        expect(target.height, 'target height').toBeGreaterThanOrEqual(44);
        expect(target.width, 'target width').toBeGreaterThanOrEqual(44);
      }
      await expectNoHorizontalScroll(page);
      await expectNoA11yViolations(page);
    });
  }

  test('the same four links in the same order on every page, the current one marked', async ({
    page,
  }) => {
    for (const { name, path, title } of pages) {
      await page.goto(path);
      await expect(page).toHaveTitle(title);
      await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
      const links = page.getByRole('navigation', { name: 'Main menu' }).getByRole('link');
      await expect(links).toHaveText(pages.map((p) => p.name));
      await expect(page.locator('[aria-current="page"]')).toHaveCount(1);
      await expect(links.filter({ hasText: name })).toHaveAttribute('aria-current', 'page');
    }
  });

  test('a link moves to its page and focus to the new heading', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Boards' }).click();
    await expect(page).toHaveURL(/\/boards$/);
    const heading = page.getByRole('heading', { level: 1, name: 'Boards' });
    await expect(heading).toBeFocused();
    await expect(page).toHaveTitle('Boards · Blinker');
  });
});
