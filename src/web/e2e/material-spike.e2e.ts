// Spec 007, T1 (R1; ADR-0005 "Consequences"): Angular Material components work zoneless, under the production CSP
// and Trusted Types. The cspGuard fixture fails every test here on any violation.
import { expect, test } from './support/test';
import { expectNoA11yViolations } from './support/a11y';
import { collectThirdPartyRequests } from './support/requests';

test.describe('Angular Material spike', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/spike');
    await expect(page.getByRole('heading', { level: 1, name: 'Component check' })).toBeVisible();
  });

  test('the slide toggle switches on and off', async ({ page }) => {
    const toggle = page.getByRole('switch', { name: 'A switch' });
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  test('the select opens an overlay listbox and takes a choice', async ({ page }) => {
    const select = page.getByRole('combobox', { name: 'A choice' });
    await select.click();
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.getByRole('option', { name: 'Option 3' }).click();
    await expect(select).toContainText('Option 3');
    await expect(page.getByRole('listbox')).toBeHidden();
  });

  test('the dialog focuses Cancel, closes on Escape and returns focus (R5)', async ({ page }) => {
    const open = page.getByRole('button', { name: 'Open the dialog' });
    // From the keyboard: WebKit, like Safari, does not focus a button on click, so there is no focus to return.
    await open.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('alertdialog', { name: 'Clear the sentence?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await expectNoA11yViolations(page);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(open).toBeFocused();
    await expect(page.getByTestId('spike-result')).toHaveText('Cancelled.');
  });

  test('the dialog confirms only with its confirm button', async ({ page }) => {
    await page.getByRole('button', { name: 'Open the dialog' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Clear' }).click();
    await expect(page.getByTestId('spike-result')).toHaveText('Confirmed.');
  });

  test('no axe violations and no third-party requests (no Roboto, no icon font)', async ({
    page,
    baseURL,
  }) => {
    const thirdParty = collectThirdPartyRequests(page, baseURL!);
    await page.reload();
    await page.waitForLoadState('networkidle');
    expect(thirdParty).toEqual([]);
    await expectNoA11yViolations(page);
  });
});
