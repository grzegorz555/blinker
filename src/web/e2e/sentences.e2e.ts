// Spec 007, T8: Zdania (Sentences) (R11, R12): the sentences read aloud, kept on the device, say again, delete.
import { expect, test, type Page } from './support/test';
import { expectNoA11yViolations } from './support/a11y';
import { fakeSpeech, spoken } from './support/speech';

test.use({ locale: 'pl-PL' });

/** On Liczenie (Counting): tap the letters, then Przeczytaj (Read aloud). */
async function say(page: Page, letters: string[]) {
  await page.getByRole('link', { name: 'Liczenie' }).click();
  const board = page.getByRole('table');
  for (const letter of letters)
    await board.getByRole('button', { name: letter, exact: true }).click();
  // Each letter is said aloud; the fake voice ends after 100 ms and Przeczytaj (Read aloud) comes back.
  await page.getByRole('button', { name: 'Przeczytaj' }).click();
  const sentence = await page.getByTestId('sentence').textContent();
  await expect.poll(() => spoken(page)).toContain(sentence);
}

const entries = (page: Page) => page.getByTestId('entry');

test.describe('Zdania (Sentences)', () => {
  test.beforeEach(async ({ page }) => {
    await fakeSpeech(page, undefined, 100);
    await page.goto('/sentences');
    await expect(page.getByRole('heading', { level: 1, name: 'Zdania' })).toBeVisible();
  });

  test('empty at first, with the history switch on; no axe violations', async ({ page }) => {
    await expect(page.getByTestId('empty')).toBeVisible();
    await expect(page.getByRole('switch', { name: /Zapisuj zdania/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expectNoA11yViolations(page);
  });

  test('a sentence read aloud appears under today, survives a reload, and can be said again', async ({
    page,
  }) => {
    await say(page, ['T', 'A', 'K']);
    await page.getByRole('link', { name: 'Zdania' }).click();
    await expect(entries(page)).toHaveCount(1);
    await expect(entries(page).first()).toContainText('TAK');
    await expect(entries(page).first().locator('[lang="pl"]')).toHaveText('TAK');
    await page.reload();
    await expect(entries(page)).toHaveCount(1);
    await expectNoA11yViolations(page);

    await page.getByRole('button', { name: 'Powiedz jeszcze raz' }).click();
    await expect.poll(async () => (await spoken(page)).filter((t) => t === 'TAK')).toHaveLength(1);
  });

  test('deletes one sentence and the whole history, each after a confirmation', async ({
    page,
  }) => {
    await say(page, ['A']);
    await say(page, ['B']);
    await page.getByRole('link', { name: 'Zdania' }).click();
    await expect(entries(page)).toHaveCount(2);

    await page.getByRole('button', { name: 'Usuń zdanie: AB' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Usuń' }).click();
    await expect(entries(page)).toHaveCount(1);

    await page.getByRole('button', { name: 'Usuń historię' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Usunąć całą historię?' });
    await expect(dialog.getByRole('button', { name: 'Anuluj' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Usuń historię' }).click();
    await expect(page.getByTestId('empty')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('empty')).toBeVisible();
  });

  test('turning the history off asks first, deletes it and keeps nothing new', async ({ page }) => {
    await say(page, ['A']);
    await page.getByRole('link', { name: 'Zdania' }).click();
    const keep = page.getByRole('switch', { name: /Zapisuj zdania/ });
    await keep.click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Anuluj' }).click();
    await expect(keep).toHaveAttribute('aria-checked', 'true');
    await expect(entries(page)).toHaveCount(1);

    await keep.click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Wyłącz i usuń' }).click();
    await expect(keep).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('empty')).toBeVisible();
    await say(page, ['B']);
    await page.getByRole('link', { name: 'Zdania' }).click();
    await expect(page.getByTestId('empty')).toBeVisible();
  });
});
