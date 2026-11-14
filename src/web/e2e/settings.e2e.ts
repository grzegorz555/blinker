// Spec 007, T6: Ustawienia (Settings) on Angular Material, kept on the device (R9, R12). The cspGuard fixture also
// checks the Material controls (form field, slide toggles, select overlay, radio group) under the production CSP and
// Trusted Types, as the T1 spike did.
import { expect, test, type Page } from './support/test';
import { expectNoA11yViolations } from './support/a11y';
import { collectThirdPartyRequests } from './support/requests';
import { fakeSpeech } from './support/speech';

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
    await expectNoA11yViolations(page);
    await pauseField(page).fill('2500');
    await expect(page.getByText(/^Błąd:/)).toHaveCount(0);
    await page.reload();
    await expect(pauseField(page)).toHaveValue('2500');
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

  test('with the keyboard shortcuts on, keys give his signals on Liczenie (Counting) (spec 006 R7)', async ({
    page,
  }) => {
    await toggle(page, /Skróty klawiszowe/).click();
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
