// Spec 017, T4: "Kopia w pliku" (Backup file) in Ustawienia (Settings): save, delete all data, restore (R1–R9).
// The download is read with Playwright's `download` event and the file is chosen with the file chooser.
// https://playwright.dev/docs/downloads, https://playwright.dev/docs/input#upload-files
import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from './support/test';
import { toast } from './support/toast';
import { expectNoA11yViolations } from './support/a11y';
import { fakeSpeech, spoken } from './support/speech';

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
const pauseField = (page: Page) => page.getByRole('spinbutton', { name: /Pauza przed pytaniem/ });
const status = (page: Page) => page.getByTestId('backup-status');

/** His device: an imported board made active, a sentence read aloud on it, a changed pause. */
async function fill(page: Page) {
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
  await page.getByRole('radio', { name: /Tak i nie/ }).check();

  await nav(page, 'Liczenie').click();
  await page.getByRole('table').getByRole('button', { name: 'TAK', exact: true }).click();
  await page.getByRole('button', { name: 'Przeczytaj' }).click();
  await expect.poll(() => spoken(page)).toContain('TAK');

  await nav(page, 'Ustawienia').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Ustawienia' })).toBeVisible();
  await pauseField(page).fill('2500');
  await pauseField(page).blur();
}

/** "Zapisz kopię" (Save a backup): the name and the parsed content of the downloaded file. */
async function save(page: Page) {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Zapisz kopię' }).click();
  const file = await download;
  const path = await file.path();
  return { name: file.suggestedFilename(), text: await readFile(path, 'utf8') };
}

async function deleteAll(page: Page) {
  await page.getByRole('button', { name: 'Usuń wszystkie dane' }).click();
  await page
    .getByRole('alertdialog', { name: 'Usunąć wszystkie dane z tego urządzenia?' })
    .getByRole('button', { name: 'Usuń', exact: true })
    .click();
  await expect(toast(page)).toHaveText('Usunięto wszystkie dane z tego urządzenia.');
}

/** "Wczytaj kopię" (Restore a backup) with a file; returns the dialog (when the file was valid). */
async function choose(page: Page, name: string, text: string) {
  const picker = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Wczytaj kopię' }).click();
  await (await picker).setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(text) });
  return page.getByRole('alertdialog', { name: /^Wczytać kopię z / });
}

test.describe('Kopia w pliku (Backup file)', () => {
  test.beforeEach(async ({ page }) => {
    await fakeSpeech(page, undefined, 100);
  });

  test('save, delete all data, restore: the setting and the board come back; the history stays empty without it', async ({
    page,
  }) => {
    test.slow(); // four screens, a download, a dialog and axe scans
    await fill(page);

    // The section, with the history checkbox off; no axe violations.
    await expect(page.getByRole('heading', { level: 3, name: 'Kopia w pliku' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Dołącz historię zdań' })).not.toBeChecked();
    await expectNoA11yViolations(page);

    const saved = await save(page);
    expect(saved.name).toMatch(/^blinker-kopia-\d{4}-\d{2}-\d{2}\.json$/);
    const file = JSON.parse(saved.text);
    expect(file.format).toBe('blinker-backup');
    expect(file.version).toBe(1);
    expect(Object.keys(file.data).sort()).toEqual(['activeBoard', 'boards', 'settings']);
    expect(file.data.settings.askAfterMs).toBe(2500);
    expect(file.data.history).toBeUndefined();
    await expect(toast(page)).toContainText('Jest w nim jego kalibracja');

    await deleteAll(page);
    await expect(pauseField(page)).toHaveValue('1200');

    // With the keyboard: the dialog describes the file, the first focus is on Anuluj (Cancel).
    const dialog = await choose(page, saved.name, saved.text);
    await expect(dialog).toContainText('ustawienia, tablice: 1, bez kalibracji');
    await expect(dialog).toContainText('historia na tym urządzeniu zostaje');
    await expect(dialog.getByRole('button', { name: 'Anuluj' })).toBeFocused();
    await expectNoA11yViolations(page);
    await dialog.getByRole('button', { name: 'Wczytaj', exact: true }).click();
    await expect(toast(page)).toContainText(/Wczytano kopię z \d{1,2}\.\d{1,2}\.\d{4}\./);
    await expect(status(page)).toHaveText('');
    await expectNoA11yViolations(page);

    // The running app has the data at once, without a reload.
    await expect(pauseField(page)).toHaveValue('2500');
    await nav(page, 'Tablice').click();
    await expect(page.getByRole('radio', { name: /Tak i nie/ })).toBeChecked();
    await nav(page, 'Zdania').click();
    await expect(page.getByTestId('empty')).toBeVisible();

    // And after a reload.
    await page.reload();
    await nav(page, 'Liczenie').click();
    await expect(
      page.getByRole('table').getByRole('button', { name: 'NIE', exact: true }),
    ).toBeVisible();
  });

  test('with "Dołącz historię zdań" (Include the sentence history) ticked, the history comes back too', async ({
    page,
  }) => {
    test.slow();
    await fill(page);
    await page.getByRole('checkbox', { name: 'Dołącz historię zdań' }).check();
    const saved = await save(page);
    expect(JSON.parse(saved.text).data.history).toHaveLength(1);
    await expect(toast(page)).toContainText('jego kalibracja i jego zdania');

    await deleteAll(page);
    const dialog = await choose(page, saved.name, saved.text);
    await expect(dialog).toContainText('zdania: 1');
    await expect(dialog).toContainText('zostanie zastąpiona');
    await dialog.getByRole('button', { name: 'Wczytaj', exact: true }).click();
    await expect(toast(page)).toContainText('Wczytano kopię');

    await nav(page, 'Zdania').click();
    await expect(page.getByText('TAK')).toBeVisible();
  });

  test('an invalid file shows the error in text, asks nothing and changes nothing', async ({
    page,
  }) => {
    await page.goto('/settings');
    await pauseField(page).fill('3000');
    await pauseField(page).blur();
    const before = await page.evaluate(() => JSON.stringify(localStorage));

    // A board file is not a backup.
    await choose(page, 'tak-nie.json', JSON.stringify(yesNo));
    await expect(status(page)).toContainText('To nie jest kopia Blinkera');
    await expect(page.getByRole('alertdialog')).toHaveCount(0);

    // A prototype key hidden in the settings.
    const hostile = JSON.stringify({
      format: 'blinker-backup',
      version: 1,
      createdAt: new Date().toISOString(),
      data: { settings: { askAfterMs: 500 } },
    }).replace('"askAfterMs"', '"__proto__":{"askAfterMs":500},"askAfterMs"');
    await choose(page, 'kopia.json', hostile);
    await expect(status(page)).toContainText('niedozwolone pola');

    // A file that is not .json.
    await choose(page, 'kopia.txt', '{}');
    await expect(status(page)).toContainText('rozszerzeniem .json');
    await expectNoA11yViolations(page);

    expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(before);
    await expect(pauseField(page)).toHaveValue('3000');
  });
});
