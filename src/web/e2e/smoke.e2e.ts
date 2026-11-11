import { expect, test } from './support/test';
import { expectNoA11yViolations } from './support/a11y';
import { collectThirdPartyRequests } from './support/requests';

test.describe('smoke', () => {
  test('home page loads with the app name as the main heading', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Blinker' })).toBeVisible();
  });

  test('home page has no WCAG A/AA violations detectable by axe', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test('home page makes no requests to third-party origins', async ({ page, baseURL }) => {
    const thirdParty = collectThirdPartyRequests(page, baseURL!);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(thirdParty).toEqual([]);
  });
});
