// Spec 007, T6: Ustawienia (Settings) on Angular Material, kept on the device (R9, R12). The cspGuard fixture also
// checks the Material controls (form field, slide toggles, select overlay, radio group) under the production CSP and
// Trusted Types, as the T1 spike did.
import { expect, test, type Page } from './support/test';
import { expectNoA11yViolations } from './support/a11y';
import { collectThirdPartyRequests } from './support/requests';
import { fakeSpeech, spoken } from './support/speech';

test.use({ locale: 'pl-PL' });

const toggle = (page: Page, name: RegExp) => page.getByRole('switch', { name });
const pauseField = (page: Page) => page.getByRole('spinbutton', { name: /Pauza przed pytaniem/ });

test.describe('Ustawienia (Settings)', () => {
  test.beforeEach(async ({ page }) => {
    await fakeSpeech(page);
    await page.goto('/settings');
    await expect(page.getByRole('heading', { level: 1, name: 'Ustawienia' })).toBeVisible();
  });

  test('every group has a heading and the controls have visible labels; no axe violations', async ({
    page,
    baseURL,
  }) => {
    const thirdParty = collectThirdPartyRequests(page, baseURL!);
    for (const name of ['Liczenie', 'Głos', 'Wygląd', 'O aplikacji']) {
      await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
    }
    await expect(pauseField(page)).toHaveValue('1200');
    await expect(toggle(page, /Przyciski sygnałów/)).toHaveAttribute('aria-checked', 'true');
    await expect(toggle(page, /Skróty klawiszowe/)).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('disclaimer')).toContainText('nie jest wyrobem medycznym');
    await expectNoA11yViolations(page);
    expect(thirdParty).toEqual([]);
  });

  test('the pause shows an error in text outside 500–5000 ms and keeps the last valid value (SC 3.3.1)', async ({
    page,
  }) => {
    await pauseField(page).fill('100');
    await pauseField(page).blur();
    await expect(page.getByText('Błąd: wpisz liczbę całkowitą od 500 do 5000 ms.')).toBeVisible();
    await expect(pauseField(page)).toHaveAttribute('aria-invalid', 'true');
    // The error fades in; measure its contrast at full opacity.
    await expect(page.locator('.mat-mdc-form-field-error-wrapper')).toHaveCSS('opacity', '1');
    // WebKit animates the error element itself too (opacity and a slide): measure it at rest.
    await expect(page.locator('mat-error')).toHaveCSS('opacity', '1');
    await expect(page.locator('mat-error')).toHaveCSS('transform', 'none');
    await expectNoA11yViolations(page);
    await pauseField(page).fill('2500');
    await expect(page.getByText(/^Błąd:/)).toHaveCount(0);
    await page.reload();
    await expect(pauseField(page)).toHaveValue('2500');
  });

  test('the pause hint and its error keep clear space above the first switch, also on a narrow phone', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    const gapAbove = async () => {
      const subscript = (await page
        .locator('.mat-mdc-form-field-subscript-wrapper')
        .first()
        .boundingBox())!;
      const firstSwitch = (await page.locator('.toggles li').first().boundingBox())!;
      return firstSwitch.y - (subscript.y + subscript.height);
    };
    await expect(page.getByText(/Od 500 do 5000 ms/)).toBeVisible();
    expect(await gapAbove()).toBeGreaterThanOrEqual(8);
    await pauseField(page).fill('100');
    await pauseField(page).blur();
    await expect(page.locator('.mat-mdc-form-field-error-wrapper')).toHaveCSS('opacity', '1');
    expect(await gapAbove()).toBeGreaterThanOrEqual(8);
  });

  test('switches survive a reload and change Liczenie (Counting)', async ({ page }) => {
    await toggle(page, /Przyciski sygnałów/).click();
    await toggle(page, /Podpowiedzi w Liczeniu/).click();
    await page.reload();
    await expect(toggle(page, /Przyciski sygnałów/)).toHaveAttribute('aria-checked', 'false');
    await page.getByRole('link', { name: 'Liczenie' }).click();
    await expect(page.getByRole('region', { name: 'Jego sygnały' })).toHaveCount(0);
    await expect(page.getByTestId('hint')).toHaveCount(0);
  });

  test('the voice is quiet and a pause moves on by default; both switches are off (spec 009)', async ({
    page,
  }) => {
    await expect(toggle(page, /Potwierdzaj kolumnę i wiersz skinieniem/)).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await expect(toggle(page, /Mów pytania i komunikaty/)).toHaveAttribute('aria-checked', 'false');
    // Spec 012: the camera is on by default (the browser asks first); its sound is on; the front camera.
    await expect(toggle(page, /Sterowanie kamerą w Liczeniu/)).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(toggle(page, /Dźwięk przy sygnale/)).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('radio', { name: /Przednia/ })).toBeChecked();
  });

  test('with the keyboard shortcuts and the nod confirmation on, keys give his signals and Blinker asks (spec 006 R7, spec 009 R1)', async ({
    page,
  }) => {
    await toggle(page, /Skróty klawiszowe/).click();
    await toggle(page, /Potwierdzaj kolumnę i wiersz skinieniem/).click();
    await page.getByRole('link', { name: 'Liczenie' }).click();
    // The screen is loaded lazily: wait for it, so its key listener is attached.
    await expect(page.getByRole('heading', { level: 1, name: 'Liczenie' })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
    await page.keyboard.press('h');
    await page.keyboard.press(' ');
    await page.keyboard.press(' ');
    await expect(page.getByTestId('tally')).toContainText('= 7');
    await expect(page.getByTestId('question')).toHaveText('Kolumna 7?', { timeout: 5000 });
    await page.keyboard.press('n');
    await expect(page.getByTestId('question')).toHaveText('Kolumna 7. Podaj wiersz');
  });

  test('the speech rate is a select with an overlay list', async ({ page }) => {
    const rate = page.getByRole('combobox', { name: 'Tempo mowy' });
    await rate.click();
    await page.getByRole('option', { name: 'Wolniej' }).click();
    await expect(rate).toContainText('Wolniej');
    await page.reload();
    await expect(page.getByRole('combobox', { name: 'Tempo mowy' })).toContainText('Wolniej');
  });

  test('the theme applies at once and survives a reload', async ({ page }) => {
    await page.getByRole('radio', { name: 'Ciemny' }).check();
    await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
    await expectNoA11yViolations(page);
    await page.reload();
    await expect(page.getByRole('radio', { name: 'Ciemny' })).toBeChecked();
    await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
    await page.getByRole('radio', { name: 'Jasny' }).check();
    await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
  });

  test('says an on-device voice is available, and Posłuchaj (Listen) speaks', async ({ page }) => {
    await expect(page.getByTestId('voice-ok')).toBeVisible();
    await page.getByRole('button', { name: 'Posłuchaj' }).click();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken))
      .toEqual(['Dzień dobry']);
  });
});

test.describe('Ustawienia (Settings) on the device', () => {
  test('a corrupted stored value falls back to the defaults and says so (R12)', async ({
    page,
  }) => {
    await page.addInitScript(() =>
      localStorage.setItem('blinker.settings.v1', '{"askAfterMs": 3}'),
    );
    await page.goto('/settings');
    await expect(page.getByTestId('store-problem')).toContainText('Nie udało się odczytać');
    await expect(pauseField(page)).toHaveValue('1200');
    await expectNoA11yViolations(page);
  });

  test('without an on-device Polish voice, it explains what to install (R7)', async ({ page }) => {
    await fakeSpeech(page, []);
    await page.goto('/settings');
    await expect(page.getByTestId('voice-help')).toContainText('Zainstaluj polski głos');
  });
});

// Spec 013: "Usuń wszystkie dane" (Delete all data) removes everything Blinker keeps on the device after a confirmation,
// resets the running app without a reload, and says what it did. The storage is read with page.evaluate.
test.describe('Dane na tym urządzeniu (Data on this device)', () => {
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
  const blinkerKeys = (page: Page) =>
    page.evaluate(() =>
      Object.keys(localStorage)
        .filter((k) => k.startsWith('blinker.'))
        .sort(),
    );
  const nav = (page: Page, name: string) =>
    page.getByRole('navigation', { name: 'Menu główne' }).getByRole('link', { name });
  const deleteAll = (page: Page) => page.getByRole('button', { name: 'Usuń wszystkie dane' });

  test('import a board, change a setting, read a sentence aloud; Anuluj (Cancel) keeps all, Usuń (Delete) removes all, also after a reload', async ({
    page,
  }) => {
    test.slow(); // four screens, three axe scans and a reload
    await fakeSpeech(page, undefined, 100);

    // An imported board, made the active one.
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

    // A sentence read aloud on that board, so it is in the history.
    await nav(page, 'Liczenie').click();
    await page.getByRole('table').getByRole('button', { name: 'TAK', exact: true }).click();
    await page.getByRole('button', { name: 'Przeczytaj' }).click();
    await expect.poll(() => spoken(page)).toContain('TAK');

    // A changed setting.
    await nav(page, 'Ustawienia').click();
    await expect(page.getByRole('heading', { level: 1, name: 'Ustawienia' })).toBeVisible();
    await pauseField(page).fill('2500');
    await pauseField(page).blur();
    await expect
      .poll(() => blinkerKeys(page))
      .toEqual(
        expect.arrayContaining([
          'blinker.activeBoard.v1',
          'blinker.boards.v1',
          'blinker.history.v1',
          'blinker.settings.v1',
        ]),
      );

    // The section: a heading, the text of what is kept and what is not, the button; no axe violations.
    await expect(
      page.getByRole('heading', { level: 2, name: 'Dane na tym urządzeniu' }),
    ).toBeVisible();
    await expect(page.getByText(/Zgodę na kamerę cofa się w ustawieniach witryny/)).toBeVisible();
    await expectNoA11yViolations(page);

    // With the keyboard: Anuluj (Cancel) changes nothing, and focus goes back to the button. (A click does not focus
    // a button in WebKit, so there the dialog would have no button to give the focus back to.)
    await deleteAll(page).focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('alertdialog', {
      name: 'Usunąć wszystkie dane z tego urządzenia?',
    });
    await expect(dialog).toContainText('Tego nie da się cofnąć');
    await expect(dialog.getByRole('button', { name: 'Anuluj' })).toBeFocused();
    await expectNoA11yViolations(page);
    await page.keyboard.press('Enter');
    await expect(dialog).toHaveCount(0);
    await expect(deleteAll(page)).toBeFocused();
    await expect(page.getByTestId('delete-all-status')).toHaveText('');
    await expect(pauseField(page)).toHaveValue('2500');
    expect(await blinkerKeys(page)).toContain('blinker.history.v1');

    // Usuń (Delete): the status in text, the running app back at its defaults without a reload, no blinker. key.
    await deleteAll(page).click();
    await dialog.getByRole('button', { name: 'Usuń', exact: true }).click();
    await expect(page.getByTestId('delete-all-status')).toHaveText(
      'Usunięto wszystkie dane z tego urządzenia.',
    );
    await expect(pauseField(page)).toHaveValue('1200');
    expect(await blinkerKeys(page)).toEqual([]);
    await expectNoA11yViolations(page);

    await nav(page, 'Tablice').click();
    await expect(page.getByRole('radio')).toHaveCount(1);
    await expect(page.getByRole('radio', { name: /Tablica przyjaciela/ })).toBeChecked();
    await nav(page, 'Zdania').click();
    await expect(page.getByTestId('empty')).toBeVisible();
    await nav(page, 'Liczenie').click();
    await expect(page.getByTestId('sentence')).toHaveText('');
    await expect(
      page.getByRole('table').getByRole('button', { name: 'W', exact: true }),
    ).toBeVisible();

    // Still so after a reload.
    await page.reload();
    await expect(
      page.getByRole('table').getByRole('button', { name: 'W', exact: true }),
    ).toBeVisible();
    await nav(page, 'Zdania').click();
    await expect(page.getByTestId('empty')).toBeVisible();
    await nav(page, 'Ustawienia').click();
    await expect(pauseField(page)).toHaveValue('1200');
    expect(await blinkerKeys(page)).toEqual([]);
  });
});
