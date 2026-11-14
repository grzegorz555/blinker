// Spec 007, T5: his signals as buttons (R6), the speech status (R7) and the screen wake lock (R8).
import { expect, test, type Page } from './support/test';
import { expectNoA11yViolations } from './support/a11y';
import { fakeSpeech, spoken } from './support/speech';

test.use({ locale: 'pl-PL' });

const signal = (page: Page, name: string) =>
  page.getByRole('region', { name: 'Jego sygnały' }).getByRole('button', { name });
const question = (page: Page) => page.getByTestId('question');
const sentence = (page: Page) => page.getByTestId('sentence');

test.describe('Liczenie (Counting) with the signal buttons', () => {
  test.beforeEach(async ({ page }) => {
    await fakeSpeech(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Liczenie' })).toBeVisible();
  });

  test('five signal buttons whose names contain their visible labels (SC 2.5.3)', async ({
    page,
  }) => {
    const panel = page.getByRole('region', { name: 'Jego sygnały' });
    await expect(panel.getByRole('button')).toHaveCount(5);
    for (const name of [
      'Mrugnięcie +1',
      'Ręka +5',
      'Skinienie: tak',
      'Kręcenie głową: nie',
      'Głowa w prawo: koniec',
    ]) {
      await expect(panel.getByRole('button', { name })).toBeVisible();
    }
  });

  test('the full path: hand + 2 blinks, "Kolumna 7?" (Column 7?), yes, 3 blinks, "Wiersz 3?" (Row 3?), yes: W; finish, yes: read aloud', async ({
    page,
  }) => {
    await signal(page, 'Ręka +5').click();
    await signal(page, 'Mrugnięcie +1').click();
    await signal(page, 'Mrugnięcie +1').click();
    await expect(page.getByTestId('tally')).toContainText('= 7');
    // The pointer: column 7, with aria-current (never color alone).
    await expect(page.getByRole('columnheader', { name: '7' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    await expect(question(page)).toHaveText('Kolumna 7?', { timeout: 5000 });
    await expectNoA11yViolations(page);

    await signal(page, 'Skinienie: tak').click();
    await expect(question(page)).toHaveText('Kolumna 7. Podaj wiersz');
    for (let i = 0; i < 3; i++) await signal(page, 'Mrugnięcie +1').click();
    await expect(question(page)).toHaveText('Wiersz 3?', { timeout: 5000 });
    await expect(page.getByRole('cell', { name: 'W' })).toHaveAttribute('aria-current', 'true');
    await signal(page, 'Skinienie: tak').click();
    await expect(sentence(page)).toHaveText('W');
    await expect(page.getByTestId('announcer')).toHaveText('Dodano W');

    await signal(page, 'Głowa w prawo: koniec').click();
    await expect(question(page)).toHaveText('Przeczytać na głos?');
    expect(await spoken(page)).not.toContain('W ');
    await signal(page, 'Skinienie: tak').click();
    await expect(question(page)).toHaveText('Czytam na głos');
    // While reading, Przeczytaj (Read aloud) turns into Zatrzymaj (Stop).
    await expect(page.getByRole('button', { name: 'Przeczytaj' })).toHaveCount(0);
    await expect.poll(() => spoken(page)).toContain('W');
    await expectNoA11yViolations(page);

    await page.getByRole('button', { name: 'Zatrzymaj' }).click();
    await expect(page.getByRole('button', { name: 'Przeczytaj' })).toBeVisible();
    await expect(sentence(page)).toHaveText('W');
  });

  test('a shake rejects the number; a second shake changes nothing', async ({ page }) => {
    await page.getByRole('table').getByRole('button', { name: 'A', exact: true }).click();
    await signal(page, 'Mrugnięcie +1').click();
    await expect(question(page)).toHaveText('Kolumna 1?', { timeout: 5000 });
    await signal(page, 'Kręcenie głową: nie').click();
    await expect(page.getByTestId('notice')).toHaveText('Nie, to nie 1. Jeszcze raz');
    await signal(page, 'Kręcenie głową: nie').click();
    await expect(sentence(page)).toHaveText('A');
  });

  test('the keys do nothing while the keyboard mapping is off (the default, SC 2.1.4)', async ({
    page,
  }) => {
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    await page.keyboard.press('h');
    await page.keyboard.press('n');
    await expect(page.getByTestId('tally')).toHaveCount(0);
    await expect(question(page)).toHaveText('Podaj kolumnę');
  });
});

test.describe('speech status', () => {
  test('with no on-device Polish voice, the screen says so in text and nothing is spoken (R7)', async ({
    page,
  }) => {
    await fakeSpeech(page, []);
    await page.goto('/');
    await page.getByRole('table').getByRole('button', { name: 'A', exact: true }).click();
    await page.getByRole('button', { name: 'Przeczytaj' }).click();
    await expect(page.getByTestId('voice-status')).toHaveText('Brak polskiego głosu na urządzeniu');
    expect(await spoken(page)).toEqual([]);
    await expectNoA11yViolations(page);
  });

  test('a network voice is never used (no data leaves the device)', async ({ page }) => {
    await fakeSpeech(page, [{ lang: 'pl-PL', localService: false, default: true, name: 'Cloud' }]);
    await page.goto('/');
    await page.getByRole('table').getByRole('button', { name: 'A', exact: true }).click();
    await page.getByRole('button', { name: 'Przeczytaj' }).click();
    await expect(page.getByTestId('voice-status')).toHaveText('Brak polskiego głosu na urządzeniu');
    expect(await spoken(page)).toEqual([]);
  });
});

test.describe('screen wake lock (R8)', () => {
  test('is taken on Liczenie (Counting) and released when leaving it', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __locks: string[] };
      w.__locks = [];
      Object.defineProperty(navigator, 'wakeLock', {
        configurable: true,
        value: {
          request: async () => {
            w.__locks.push('taken');
            return { release: async () => void w.__locks.push('released') };
          },
        },
      });
    });
    const locks = () => page.evaluate(() => (window as unknown as { __locks: string[] }).__locks);
    await page.goto('/');
    await expect.poll(locks).toEqual(['taken']);
    await page.getByRole('link', { name: 'Ustawienia' }).click();
    await expect.poll(locks).toEqual(['taken', 'released']);
  });
});
