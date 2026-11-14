// Spec 007, T7: Tablice (Boards) (R10, R12): the active board, the preview, an import with every error in text,
// and deleting an imported board after a confirmation.
import fs from 'node:fs';
import { expect, test, type Page } from './support/test';
import { expectNoA11yViolations } from './support/a11y';

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

// Through the button, as a helper would: it opens the system file picker (the native input stays hidden).
const choose = async (page: Page, name: string, content: string) => {
  const picker = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Wybierz plik tablicy (.json)' }).click();
  await (
    await picker
  ).setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(content) });
};

test.describe('Tablice (Boards)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/boards');
    await expect(page.getByRole('heading', { level: 1, name: 'Tablice' })).toBeVisible();
  });

  test('his board is active and previewed; no axe violations', async ({ page }) => {
    const radio = page.getByRole('radio', { name: /Tablica przyjaciela/ });
    await expect(radio).toBeChecked();
    await expect(page.getByTestId('preview').getByRole('columnheader')).toHaveCount(7);
    await expect(page.getByRole('button', { name: /Usuń tablicę/ })).toHaveCount(0);
    await expectNoA11yViolations(page);
  });

  test('shows an example file that downloads and imports as is', async ({ page }) => {
    const example = page.getByTestId('board-example');
    await example.getByText('Przykładowy plik').click();
    await expect(example.locator('pre')).toContainText('"schemaVersion": 1');
    await expectNoA11yViolations(page);
    const download = page.waitForEvent('download');
    await example.getByRole('button', { name: 'Pobierz przykład' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('przyklad-tablicy.json');
    const text = fs.readFileSync((await file.path())!, 'utf8');
    await choose(page, 'przyklad-tablicy.json', text);
    await expect(page.getByTestId('import-ok')).toContainText('„Przykład”');
  });

  test('imports a valid board, which survives a reload and becomes the board on Liczenie (Counting)', async ({
    page,
  }) => {
    await choose(page, 'tak-nie.json', JSON.stringify(yesNo));
    await expect(page.getByTestId('import-ok')).toHaveText(
      'Zaimportowano tablicę „Tak i nie”. Wybierz ją powyżej, żeby jej używać.',
    );
    await page.getByRole('radio', { name: /Tak i nie/ }).check();
    await expect(page.getByRole('heading', { level: 2, name: 'Podgląd: Tak i nie' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('radio', { name: /Tak i nie/ })).toBeChecked();

    await page.getByRole('link', { name: 'Liczenie' }).click();
    const board = page.getByRole('table');
    await expect(board.getByRole('button', { name: 'TAK', exact: true })).toBeVisible();
    await board.getByRole('button', { name: 'TAK', exact: true }).click();
    await expect(page.getByTestId('sentence')).toHaveText('TAK');
  });

  test('an invalid file shows every error in text with its path, and focus moves to them (SC 3.3.1)', async ({
    page,
  }) => {
    await choose(page, 'zla.json', JSON.stringify({ ...yesNo, columns: [], extra: '<b>x</b>' }));
    const errors = page.getByTestId('import-errors');
    await expect(errors).toBeFocused();
    await expect(errors).toContainText('Błąd: plik nie został zaimportowany');
    await expect(errors.locator('code', { hasText: 'extra' })).toBeVisible();
    await expect(errors).toContainText('Nieznane pole.');
    await expect(page.locator('b')).toHaveCount(0);
    await expect(page.getByRole('radio')).toHaveCount(1);
    await expectNoA11yViolations(page);
  });

  test('a file that is not JSON, or is too big, is rejected', async ({ page }) => {
    await choose(page, 'tekst.json', 'to nie jest JSON');
    await expect(page.getByTestId('import-errors')).toContainText(
      'Plik nie jest poprawnym JSON-em.',
    );
    await choose(page, 'duzy.json', ' '.repeat(64 * 1024 + 1));
    await expect(page.getByTestId('import-errors')).toContainText(
      'Plik jest większy niż 65536 bajtów.',
    );
  });

  test('deletes an imported board only after the confirmation; his board comes back as active', async ({
    page,
  }) => {
    await choose(page, 'tak-nie.json', JSON.stringify(yesNo));
    await page.getByRole('radio', { name: /Tak i nie/ }).check();
    await page.getByRole('button', { name: 'Usuń tablicę Tak i nie' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Usunąć tablicę „Tak i nie”?' });
    await expect(dialog.getByRole('button', { name: 'Anuluj' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Anuluj' }).click();
    await expect(page.getByRole('radio')).toHaveCount(2);

    await page.getByRole('button', { name: 'Usuń tablicę Tak i nie' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Usuń' }).click();
    await expect(page.getByRole('radio')).toHaveCount(1);
    await expect(page.getByRole('radio', { name: /Tablica przyjaciela/ })).toBeChecked();
  });
});
