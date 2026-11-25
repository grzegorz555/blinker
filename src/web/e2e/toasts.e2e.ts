// Spec 018, T4: toasts that confirm what happened, with Cofnij (Undo) after a delete (R1–R7).
// The timer is tested with Playwright's clock, so no test waits 10 s: https://playwright.dev/docs/clock
import { expect, test, type Page } from './support/test';
import { expectNoA11yViolations } from './support/a11y';
import { fakeSpeech, spoken } from './support/speech';
import { anyToast, toast, toastAction } from './support/toast';

test.use({ locale: 'pl-PL' });

const yesNo = {
  schemaVersion: 1,
  id: 'yes-no',
  name: 'Tak i nie',
  locale: 'pl',
  columns: ['1', '2'],
  rows: ['1'],
  cells: [
    [
      { type: 'word', value: 'TAK' },
      { type: 'word', value: 'NIE' },
    ],
  ],
};

const nav = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Menu główne' }).getByRole('link', { name });

async function importBoard(page: Page) {
  await page.goto('/boards');
  await expect(page.getByRole('heading', { level: 1, name: 'Tablice' })).toBeVisible();
  const picker = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Wybierz plik tablicy (.json)' }).click();
  await (
    await picker
  ).setFiles({
    name: 'tak-nie.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(yesNo)),
  });
  await expect(toast(page)).toHaveText('Zaimportowano tablicę „Tak i nie”.');
}

test.describe('Toasts (spec 018)', () => {
  test('a phone at 360 × 640: the toast sits above the navigation bar; Cofnij (Undo) brings the board back, active', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await importBoard(page);
    const toastBox = await page.locator('.app-toast').boundingBox();
    const navBox = await page.getByRole('navigation', { name: 'Menu główne' }).boundingBox();
    expect(toastBox!.y + toastBox!.height).toBeLessThanOrEqual(navBox!.y + 1);

    await page.getByRole('radio', { name: /Tak i nie/ }).check();
    await expect(toast(page)).toHaveText('Wybrana tablica: Tak i nie.');

    await page.getByRole('button', { name: /Usuń tablicę.*Tak i nie/ }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Usuń', exact: true }).click();
    await expect(toast(page)).toHaveText('Usunięto tablicę „Tak i nie”.');
    await expect(page.getByRole('radio', { name: /Tak i nie/ })).toHaveCount(0);
    await expectNoA11yViolations(page);

    await toastAction(page).click();
    await expect(toast(page)).toHaveText('Przywrócono tablicę „Tak i nie”.');
    await expect(page.getByRole('radio', { name: /Tak i nie/ })).toBeChecked();
  });

  test('a sentence deleted in Zdania (Sentences) comes back with Cofnij (Undo); the toast never shows his words', async ({
    page,
  }) => {
    await fakeSpeech(page, undefined, 100);
    await page.goto('/');
    await page.getByRole('table').getByRole('button', { name: 'A', exact: true }).click();
    await page.getByRole('button', { name: 'Przeczytaj' }).click();
    await expect.poll(() => spoken(page)).toContain('A');
    // Liczenie (Counting) has no toasts (R5).
    await expect(anyToast(page)).toHaveCount(0);

    await nav(page, 'Zdania').click();
    await expect(page.getByTestId('entry')).toHaveCount(1);
    await page.getByRole('button', { name: /^Usuń zdanie/ }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Usuń', exact: true }).click();
    await expect(toast(page)).toHaveText('Usunięto zdanie.');
    await expect(page.getByTestId('empty')).toBeVisible();

    await toastAction(page).click();
    await expect(toast(page)).toHaveText('Przywrócono zdanie.');
    await expect(page.getByTestId('entry')).toHaveCount(1);
  });

  test('the timer pauses while the keyboard focus is in the toast, and goes on after (R3)', async ({
    page,
  }) => {
    await page.clock.install();
    await importBoard(page);
    await page.getByRole('button', { name: /Usuń tablicę.*Tak i nie/ }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Usuń', exact: true }).click();
    await expect(toast(page)).toHaveText('Usunięto tablicę „Tak i nie”.');

    await toastAction(page).focus();
    await page.clock.runFor(30_000);
    await expect(toast(page)).toBeVisible();

    // The focus leaves the toast: the 10 s go on.
    await page.getByRole('heading', { level: 1, name: 'Tablice' }).focus();
    await page.clock.runFor(10_500);
    await expect(anyToast(page)).toHaveCount(0);
    // After its toast, Cofnij (Undo) is gone: the board stays deleted.
    await expect(page.getByRole('radio', { name: /Tak i nie/ })).toHaveCount(0);
  });

  test('a toast without an action goes after 6 s; Esc with the focus on Cofnij (Undo) closes it without undoing', async ({
    page,
  }) => {
    await page.clock.install();
    await importBoard(page);
    await page.clock.runFor(6_500);
    await expect(anyToast(page)).toHaveCount(0);

    await page.getByRole('button', { name: /Usuń tablicę.*Tak i nie/ }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Usuń', exact: true }).click();
    await toastAction(page).focus();
    await page.keyboard.press('Escape');
    await expect(toast(page)).toHaveCount(0);
    await expect(page.getByRole('radio', { name: /Tak i nie/ })).toHaveCount(0);
  });
});
