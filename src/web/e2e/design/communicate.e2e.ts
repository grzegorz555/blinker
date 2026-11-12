// Spec 004: Liczenie, the main screen ("Kolumna 7?"): the M3 supporting-pane layout (R4, R6, R12). CSP guard active (R2).
import { expect, test, type Page } from '../support/test';
import { expectNoA11yViolations } from '../support/a11y';

/** R6: phone portrait (2), phone landscape, tablet, laptop. */
const VIEWPORTS = [
  { name: 'phone portrait 360', width: 360, height: 740 },
  { name: 'phone portrait 390', width: 390, height: 844 },
  { name: 'phone landscape', width: 740, height: 360 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1280, height: 800 },
];

async function open(page: Page, query = '') {
  await page.goto(`/communicate.html${query}`);
  await expect(page.locator('html')).toHaveAttribute('data-js', 'ready');
}

const sentence = (page: Page) => page.locator('[data-sentence]');

/**
 * Layout problems (0 = fine): how far a part reaches beyond the viewport, any overlap between the question, the
 * board, the sentence and the navigation, and horizontal scrolling.
 */
function layoutProblems(page: Page) {
  return page.evaluate(() => {
    const vh = window.innerHeight;
    const vw = document.documentElement.clientWidth;
    const parts = [
      ['question', '.count-question'],
      ['board', '.count-board .board'],
      ['sentence', '.count-sentence'],
      ['nav', '.shell-nav'],
    ].map(([name, selector]) => [name, document.querySelector(selector)!.getBoundingClientRect()]);
    const result: Record<string, number> = {};
    for (const [name, box] of parts as [string, DOMRect][]) {
      result[`${name} outside`] = Math.max(
        0,
        Math.ceil(box.bottom - vh),
        Math.ceil(box.right - vw),
      );
    }
    for (let i = 0; i < parts.length; i++) {
      for (let j = i + 1; j < parts.length; j++) {
        const [an, a] = parts[i] as [string, DOMRect];
        const [bn, b] = parts[j] as [string, DOMRect];
        const overlaps =
          a.left < b.right - 1 &&
          a.right > b.left + 1 &&
          a.top < b.bottom - 1 &&
          a.bottom > b.top + 1;
        result[`${an} overlaps ${bn}`] = overlaps ? 1 : 0;
      }
    }
    result['vertical scroll'] = Math.max(0, document.documentElement.scrollHeight - vh);
    result['horizontal scroll'] = Math.max(0, document.documentElement.scrollWidth - vw);
    return result;
  });
}

test.describe('Liczenie', () => {
  for (const scheme of ['light', 'dark']) {
    test(`${scheme}: has no WCAG A/AA violations detectable by axe`, async ({ page }) => {
      await open(page, `?scheme=${scheme}`);
      await expectNoA11yViolations(page);
    });
  }

  test('fits every target viewport: no scrolling, nothing covers the board (R6)', async ({
    page,
  }) => {
    await open(page);
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      const problems = await layoutProblems(page);
      const fine = Object.fromEntries(Object.keys(problems).map((k) => [k, 0]));
      expect(problems, viewport.name).toEqual(fine);
    }
  });

  test('board letters are at least 32 px in every viewport (R4)', async ({ page }) => {
    await open(page);
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      const smallest = await page
        .locator('.board-cell')
        .evaluateAll((cells) =>
          Math.min(...cells.map((c) => parseFloat(getComputedStyle(c).fontSize))),
        );
      expect(smallest, viewport.name).toBeGreaterThanOrEqual(32);
    }
  });

  test('board cells are squares in every viewport (R6)', async ({ page }) => {
    await open(page);
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      const sizes = await page
        .locator('.board-cell')
        .evaluateAll((cells) =>
          cells.map((c) => [c.getBoundingClientRect().width, c.getBoundingClientRect().height]),
        );
      for (const [width, height] of sizes) {
        expect(Math.abs(width - height), viewport.name).toBeLessThanOrEqual(2);
      }
    }
  });

  test('empty cells show nothing and have no button', async ({ page }) => {
    await open(page);
    const empty = page.locator('.board-cell:not(:has(button))');
    await expect(empty).toHaveCount(2);
    for (const text of await empty.allTextContents()) expect(text.trim()).toBe('');
  });

  test('is the first destination of the app navigation, marked as current (R12)', async ({
    page,
  }) => {
    await open(page);
    const nav = page.getByRole('navigation', { name: 'Menu główne' });
    await expect(nav.getByRole('link').first()).toHaveText('Liczenie');
    await expect(nav.getByRole('link', { name: 'Liczenie' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('the sentence actions are always visible, labelled and big enough (SC 2.5.8)', async ({
    page,
  }) => {
    await open(page);
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      const actions = page.getByRole('region', { name: 'Zdanie' }).getByRole('button');
      await expect(actions, viewport.name).toHaveText(['Cofnij literę', 'Wyczyść', 'Przeczytaj']);
      for (const box of await actions.evaluateAll((els) =>
        els.map((el) => el.getBoundingClientRect().toJSON()),
      )) {
        expect(box.width, viewport.name).toBeGreaterThanOrEqual(44);
        expect(box.height, viewport.name).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test('a tap on a letter adds it, and "Cofnij literę" removes it, both announced', async ({
    page,
  }) => {
    await open(page);
    const announce = page.locator('[data-announce]');
    await expect(announce).toHaveAttribute('aria-live', 'polite');

    await page.getByRole('button', { name: 'W', exact: true }).click();
    await page.getByRole('button', { name: 'SZ', exact: true }).click();
    await expect(sentence(page)).toHaveText('CHCĘ SIĘ NAPIĆ WSZ');
    await expect(announce).toHaveText('Dodano SZ');

    await page.getByRole('button', { name: 'Cofnij literę' }).click();
    await expect(sentence(page)).toHaveText('CHCĘ SIĘ NAPIĆ W');
    await expect(announce).toHaveText('Usunięto SZ');
    await page.getByRole('button', { name: 'Cofnij literę' }).click();
    await expect(sentence(page)).toHaveText('CHCĘ SIĘ NAPIĆ ');
  });

  test('the letters work from the keyboard too', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'A', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(sentence(page)).toHaveText('CHCĘ SIĘ NAPIĆ A');
  });

  test('"Pauza" is a toggle button and the status says the mode in words', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page);
    const pause = page.getByRole('button', { name: 'Pauza' });
    await expect(pause).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByText('Automat: widzę twarz')).toBeVisible();
    await pause.click();
    await expect(pause).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Wstrzymane')).toBeVisible();
  });

  test('the pointer marks the column number and one letter by a 4 px outline and bold text, not by color alone (R4)', async ({
    page,
  }) => {
    await open(page);
    const active = page.locator('.board .is-active');
    await expect(active).toHaveText(['7', 'G']); // the column number and the cell the count has got to
    await expect(active.nth(1)).toHaveAttribute('aria-current', 'true');
    for (const style of await active.evaluateAll((els) =>
      els.map((el) => {
        const s = getComputedStyle(el);
        return { outline: `${s.outlineStyle} ${s.outlineWidth}`, weight: Number(s.fontWeight) };
      }),
    )) {
      expect(style.outline).toBe('solid 4px');
      expect(style.weight).toBeGreaterThanOrEqual(700);
    }
    const others = await page
      .locator('.board-cell:not(.is-active)')
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).outlineStyle));
    expect(new Set(others)).toEqual(new Set(['none']));
  });

  test('the outline change is not animated with reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    await expect(page.locator('.board-cell.is-active').first()).toHaveCSS(
      'transition-duration',
      '0s',
    );
  });

  test('the question is a polite live region; the board has a caption and the column header', async ({
    page,
  }) => {
    await open(page);
    await expect(page.getByText('Kolumna 7?')).toHaveAttribute('aria-live', 'polite');
    await expect(page.getByRole('table')).toHaveAccessibleName(/Tablica liter/);
    await expect(page.getByRole('columnheader', { name: '7' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  test('a long sentence shows its newest letters', async ({ page }) => {
    await page.setViewportSize({ width: 740, height: 360 });
    await open(page);
    const ends = await page.locator('.sentence').evaluate((el) => {
      const box = el.getBoundingClientRect();
      const text = el.firstElementChild!.getBoundingClientRect();
      return { textRight: Math.round(text.right), boxRight: Math.round(box.right) };
    });
    expect(ends.textRight).toBeLessThanOrEqual(ends.boxRight);
    expect(ends.boxRight - ends.textRight).toBeLessThan(4);
  });
});

test.describe('catalog and scheme', () => {
  test('unknown scheme values in the URL fall back to the system scheme', async ({ page }) => {
    await page.goto('/communicate.html?scheme=%3Cscript%3E');
    await expect(page.locator('html')).toHaveAttribute('data-js', 'ready');
    await expect(page.locator('html')).not.toHaveAttribute('data-scheme', /.*/);
  });

  test('the dark scheme really changes the colors', async ({ page }) => {
    await open(page, '?scheme=light');
    const light = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await open(page, '?scheme=dark');
    const dark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(dark).not.toBe(light);
  });

  test('the catalog switcher marks the chosen scheme and passes it on to the mock-ups', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Ciemny' }).click();
    await expect(page.getByRole('link', { name: 'Ciemny' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    await expect(page.getByRole('link', { name: /Liczenie/ })).toHaveAttribute(
      'href',
      /communicate\.html\?scheme=dark/,
    );
  });
});
