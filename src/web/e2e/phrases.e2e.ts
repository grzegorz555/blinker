// Spec 019, T4: favorite phrases. With the switch on and "Zmień pozycję" (Change my position) on the list, ZM and the
// pause bring the question; a nod takes the phrase and asks to read it; a shake refuses it; a tap on it takes it.
import { expect, test, type Page } from './support/test';
import { expectNoA11yViolations } from './support/a11y';
import { fakeSpeech, spoken } from './support/speech';

test.use({ locale: 'pl-PL' });

const signal = (page: Page, name: string) =>
  page.getByRole('region', { name: 'Jego sygnały' }).getByRole('button', { name });
const cell = (page: Page, name: string) =>
  page.getByRole('table').getByRole('button', { name, exact: true });
const question = (page: Page) => page.getByTestId('question');
const sentence = (page: Page) => page.getByTestId('sentence');

/** The switch on with a 1 s pause, and one phrase on the list. */
async function withPhrase(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem(
      'blinker.settings.v1',
      JSON.stringify({ suggestPhrases: true, phrasePauseMs: 1000 }),
    );
    localStorage.setItem('blinker.phrases.v1', JSON.stringify(['Zmień pozycję']));
  });
  await fakeSpeech(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Liczenie' })).toBeVisible();
}

async function spellZM(page: Page): Promise<void> {
  await cell(page, 'Z').click();
  await cell(page, 'M').click();
  await expect(sentence(page)).toHaveText('ZM');
  await expect(question(page)).toHaveText('Zmień pozycję?', { timeout: 5000 });
}

test.describe('Ulubione zwroty (Favorite phrases), spec 019', () => {
  test('ZM and the pause ask "Zmień pozycję?" aloud; a nod takes it and asks to read it; two shakes bring ZM back', async ({
    page,
  }) => {
    await withPhrase(page);
    await spellZM(page);
    await expect(page.getByTestId('phrase-offer')).toHaveText(/Zwrot:\s*Zmień pozycję/);
    await expect.poll(() => spoken(page)).toContain('Zmień pozycję?');
    await expectNoA11yViolations(page);

    await signal(page, 'Skinienie: tak').click();
    await expect(sentence(page)).toHaveText('ZMIEŃ POZYCJĘ');
    await expect(question(page)).toHaveText('Przeczytać na głos?');
    await expect(page.getByTestId('phrase-offer')).toHaveCount(0);

    await signal(page, 'Kręcenie głową: nie').click(); // not read: back to writing, the phrase kept
    await expect(sentence(page)).toHaveText('ZMIEŃ POZYCJĘ');
    await signal(page, 'Kręcenie głową: nie').click(); // undo the phrase
    await expect(sentence(page)).toHaveText('ZM');
  });

  test('a shake refuses it and the letters stay; a tap on the phrase takes it', async ({
    page,
  }) => {
    await withPhrase(page);
    await spellZM(page);
    await signal(page, 'Kręcenie głową: nie').click();
    await expect(sentence(page)).toHaveText('ZM');
    await expect(page.getByTestId('phrase-offer')).toHaveCount(0);

    // A new sentence: the phrase is offered again, and a tap takes it.
    await page.getByRole('button', { name: 'Cofnij literę' }).click();
    await page.getByRole('button', { name: 'Cofnij literę' }).click();
    await expect(sentence(page)).toHaveText('');
    await spellZM(page);
    await page.getByTestId('phrase-offer').click();
    await expect(sentence(page)).toHaveText('ZMIEŃ POZYCJĘ');
    await expect(question(page)).toHaveText('Przeczytać na głos?');
  });

  test('Zdania (Sentences): a phrase is added, a duplicate refused, one moved and deleted with Cofnij (Undo)', async ({
    page,
  }) => {
    await page.goto('/sentences');
    const list = page.getByTestId('phrases');
    await expect(list.getByTestId('phrases-empty')).toBeVisible();
    const field = list.getByRole('textbox', { name: 'Nowy zwrot' });
    for (const phrase of ['Pić', 'Zmień pozycję']) {
      await field.fill(phrase);
      await list.getByRole('button', { name: 'Dodaj zwrot' }).click();
    }
    await expect(list.getByTestId('phrase')).toHaveText(
      ['Pić', 'Zmień pozycję'].map((t) => new RegExp(t)),
    );

    await field.fill('PIĆ!');
    await list.getByRole('button', { name: 'Dodaj zwrot' }).click();
    await expect(list.getByTestId('phrase-error')).toHaveText(/już jest na liście/);
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expectNoA11yViolations(page);

    await list.getByRole('button', { name: 'W górę: Zmień pozycję' }).click();
    await expect(list.getByTestId('phrase').first()).toContainText('Zmień pozycję');
    await expect(list.getByRole('button', { name: 'W dół: Zmień pozycję' })).toBeFocused();

    await list.getByRole('button', { name: 'Usuń zwrot: Pić' }).click();
    await expect(list.getByTestId('phrase')).toHaveCount(1);
    await page
      .locator('.mat-mdc-snack-bar-container:not([mat-exit])')
      .getByRole('button', { name: 'Cofnij' })
      .click();
    await expect(list.getByTestId('phrase')).toHaveCount(2);
  });
});
