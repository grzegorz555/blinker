// Spec 004, T5: the calibration wizard, boards (list, preview, JSON import) and settings. CSP guard active (R2).
import { expect, test, type Page } from '../support/test';
import { expectNoA11yViolations } from '../support/a11y';

async function open(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator('html')).toHaveAttribute('data-js', 'ready');
}

/** Presses Tab until the focused element has this text (keyboard-only use, SC 2.1.1). */
async function tabTo(page: Page, text: string) {
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
    if (focused === text) return;
  }
  throw new Error(`"${text}" is not reachable with Tab`);
}

const STEPS = [
  ['intro', 'Co się stanie'],
  ['camera', 'Kamera'],
  ['blink', 'Długie mrugnięcie (+1)'],
  ['hand-left', 'Spojrzenie na lewą rękę (+5)'],
  ['hand-right', 'Spojrzenie na prawą rękę'],
  ['nod', 'Kiwnięcie głową (tak)'],
  ['shake', 'Kręcenie głową (nie)'],
  ['result', 'Wynik'],
] as const;

test.describe('calibration wizard', () => {
  for (const [id, heading] of STEPS) {
    test(`#${id}: one step shown, numbered, axe in light and dark`, async ({ page }) => {
      for (const scheme of ['light', 'dark']) {
        await open(page, `/calibrate-wizard.html?scheme=${scheme}#${id}`);
        const main = page.getByRole('main');
        await expect(main.getByRole('heading', { level: 2 })).toHaveText(heading);
        const n = STEPS.findIndex(([s]) => s === id) + 1;
        await expect(page.locator('[data-wizard-progress]')).toHaveText(`Krok ${n} z 8`);
        await expect(page).toHaveTitle(new RegExp(`krok ${n} z 8`));
        await expectNoA11yViolations(page);
      }
    });
  }

  test('"Kalibruj ponownie" (Calibrate again) on Kalibracja (Calibration) opens the wizard, and Kalibracja (Calibration) stays current', async ({
    page,
  }) => {
    await open(page, '/calibrate.html');
    await page.getByRole('link', { name: 'Kalibruj ponownie' }).click();
    await expect(page).toHaveURL(/calibrate-wizard\.html/);
    await expect(
      page
        .getByRole('navigation', { name: 'Menu główne' })
        .getByRole('link', { name: 'Kalibracja' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  test('the camera is explained before the browser asks for it', async ({ page }) => {
    await open(page, '/calibrate-wizard.html#camera');
    await expect(page.getByRole('main')).toContainText('nic nie jest wysyłane ani nagrywane');
    await expect(page.getByRole('button', { name: 'Włącz kamerę' })).toBeVisible();
  });

  test('works with the keyboard only, from the start to the result; focus moves to each step heading', async ({
    page,
  }) => {
    await open(page, '/calibrate-wizard.html');
    await tabTo(page, 'Zacznij');
    await page.keyboard.press('Enter');
    for (const [, heading] of STEPS.slice(1)) {
      await expect(page.getByRole('heading', { level: 2, name: heading })).toBeFocused();
      if (heading === 'Wynik') break;
      const action =
        heading === 'Kamera'
          ? 'Włącz kamerę'
          : heading === 'Spojrzenie na prawą rękę'
            ? 'Pomiń ten krok'
            : 'Dalej';
      await tabTo(page, action);
      await page.keyboard.press('Enter');
    }
    await expect(page.getByRole('button', { name: 'Dalej' })).toBeHidden();
    await expect(page.getByRole('link', { name: 'Zapisz kalibrację' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Powtórz od początku' })).toBeVisible();
    await expect(page.getByRole('main').getByRole('definition')).toHaveText([
      '3 z 3',
      '2 z 2',
      'Pominięto',
      '2 z 2',
      '2 z 2',
    ]);
  });

  test('"Wstecz" and the browser Back button both go one step back', async ({ page }) => {
    await open(page, '/calibrate-wizard.html#nod');
    await page.getByRole('button', { name: 'Wstecz' }).click();
    await expect(page.getByRole('heading', { level: 2 })).toHaveText('Spojrzenie na prawą rękę');
    await page.goBack();
    await expect(page.getByRole('heading', { level: 2 })).toHaveText('Kiwnięcie głową (tak)');
  });

  test('the first step has no "Wstecz"; an unknown fragment opens the first step', async ({
    page,
  }) => {
    await open(page, '/calibrate-wizard.html#%3Cscript%3E');
    await expect(page.getByRole('heading', { level: 2 })).toHaveText('Co się stanie');
    await expect(page.getByRole('button', { name: 'Wstecz' })).toBeHidden();
  });
});

test.describe('Tablice (Boards)', () => {
  const file = (page: Page) => page.getByLabel('Plik tablicy');
  const upload = (page: Page, text: string | Buffer) =>
    file(page).setInputFiles({
      name: 'tablica.json',
      mimeType: 'application/json',
      buffer: typeof text === 'string' ? Buffer.from(text) : text,
    });

  test('lists the boards as a radio group and previews the friend layout', async ({ page }) => {
    await open(page, '/boards.html');
    await expect(page.getByRole('radio', { name: /Tablica przyjaciela/ })).toBeChecked();
    const preview = page.getByRole('table', { name: /Układ tablicy przyjaciela/ });
    await expect(preview.getByRole('columnheader')).toHaveCount(7);
    await expect(preview.getByRole('rowheader')).toHaveCount(5);
  });

  test('a file that is not JSON: the error is in text, linked to the field (SC 3.3.1)', async ({
    page,
  }) => {
    await open(page, '/boards.html');
    await upload(page, '{ "name": "x", ');
    await expect(file(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(file(page)).toHaveAccessibleDescription(/To nie jest poprawny plik JSON/);
    await expectNoA11yViolations(page);
  });

  test('every problem in a board is listed with its row and column', async ({ page }) => {
    await open(page, '/boards.html');
    await upload(page, JSON.stringify({ name: ' ', rows: [['A', 'B'], ['C'], ['ABCD', 5]] }));
    await expect(page.locator('[data-board-result] p')).toHaveText(
      'Błąd: nie można użyć tego pliku (4 problemy).',
    );
    await expect(page.locator('[data-board-result] li')).toHaveText([
      'Brak nazwy tablicy: pole "name" musi być niepustym tekstem.',
      'Wiersz 2 ma 1 pole, a wiersz 1 ma 2. Wszystkie wiersze muszą być równe.',
      'Wiersz 3, kolumna 1: pole może mieć najwyżej 3 znaki.',
      'Wiersz 3, kolumna 2: pole musi być tekstem w cudzysłowie.',
    ]);
  });

  test('a file over 64 KB is refused before it is read', async ({ page }) => {
    await open(page, '/boards.html');
    await upload(page, Buffer.alloc(70 * 1024, ' '));
    await expect(page.locator('[data-board-result] li')).toHaveText(
      'Plik ma 70 KB, a najwyżej może mieć 64 KB.',
    );
  });

  test('a valid board is confirmed, and its name is shown as text, never as markup', async ({
    page,
  }) => {
    await open(page, '/boards.html');
    await upload(page, JSON.stringify({ name: 'Tak i nie', rows: [['TAK', 'NIE']] }));
    await expect(file(page)).toHaveAttribute('aria-invalid', 'false');
    await expect(page.locator('[data-board-result]')).toHaveText(
      'Tablica „Tak i nie” jest poprawna: 2 kolumny, 1 wiersz. W makiecie nie zapisuje się.',
    );

    await upload(page, JSON.stringify({ name: '<img src=x>', rows: [['A']] }));
    await expect(page.locator('[data-board-result]')).toContainText('„<img src=x>”');
    await expect(page.locator('[data-board-result] img')).toHaveCount(0);
  });
});

test.describe('Ustawienia (Settings)', () => {
  test('a timing out of range shows an error linked to the field; a valid value clears it', async ({
    page,
  }) => {
    await open(page, '/settings.html');
    const field = page.getByLabel('Przerwa przed pytaniem (sekundy)');
    await expect(field).toHaveAccessibleDescription(/Od 0,5 do 5/);
    await field.fill('9');
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(field).toHaveAccessibleDescription(/podaj liczbę od 0,5 do 5/);
    await expectNoA11yViolations(page);
    await field.fill('2');
    await expect(field).toHaveAttribute('aria-invalid', 'false');
    await expect(page.locator('#ask-after-error')).toBeHidden();
  });

  test('the switches are buttons with role="switch", by click and by keyboard, with the state in words', async ({
    page,
  }) => {
    await open(page, '/settings.html');
    const hints = page.getByRole('switch', { name: 'Podpowiedzi w Liczeniu' });
    await expect(hints).toHaveAttribute('aria-checked', 'true');
    await hints.click();
    await expect(hints).toHaveAttribute('aria-checked', 'false');
    await expect(hints).toContainText('Wył.');
    await hints.focus();
    await page.keyboard.press('Space');
    await expect(hints).toHaveAttribute('aria-checked', 'true');
    await expect(hints).toContainText('Wł.');
    const box = (await hints.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
  });

  test('the theme applies at once and starts from the forced scheme', async ({ page }) => {
    await open(page, '/settings.html?scheme=light');
    await expect(page.getByRole('radio', { name: 'Jasny' })).toBeChecked();
    await page.getByRole('radio', { name: 'Ciemny' }).check();
    await expect(page.locator('html')).toHaveAttribute('data-scheme', 'dark');
    await expectNoA11yViolations(page);
  });

  test('the speech rate says its value in words', async ({ page }) => {
    await open(page, '/settings.html');
    const rate = page.getByLabel('Tempo mowy');
    await expect(rate).toHaveAccessibleDescription('1,0 ×, zwykłe tempo');
    await rate.fill('1.5');
    await expect(rate).toHaveAccessibleDescription('1,5 ×');
  });

  test('scanning is shown but not available before the trial', async ({ page }) => {
    await open(page, '/settings.html');
    await expect(page.getByRole('radio', { name: /Liczenie/ })).toBeChecked();
    await expect(page.getByRole('radio', { name: /Skanowanie/ })).toBeDisabled();
  });
});

test('the caregiver pages reflow at 320 px without horizontal scrolling (SC 1.4.10)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const path of ['/boards.html', '/settings.html', '/calibrate-wizard.html#result']) {
    await open(page, path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBe(0);
  }
});
