// Spec 004, T3: communicate mode ("Kolumna 7?"), full screen (R4, R6, R12). CSP guard active (R2).
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

const menuButton = (page: Page) => page.getByRole('button', { name: 'Menu' });

/** How far each part reaches beyond the viewport, and whether the board overlaps another part (0 = fine). */
function layoutProblems(page: Page) {
  return page.evaluate(() => {
    const vh = window.innerHeight;
    const vw = document.documentElement.clientWidth;
    const visible = (el: Element) => (el as HTMLElement).offsetParent !== null;
    const parts = [...document.querySelectorAll('.screen > *')].filter(visible);
    const result: Record<string, number> = {};
    for (const el of parts) {
      const box = el.getBoundingClientRect();
      const name = el.className.split(' ')[0] || el.tagName;
      result[name] = Math.max(0, Math.ceil(box.bottom - vh), Math.ceil(box.right - vw));
    }
    const board = document.querySelector('.screen-board')!.getBoundingClientRect();
    for (const el of parts.filter((el) => !el.classList.contains('screen-board'))) {
      const b = el.getBoundingClientRect();
      const overlaps =
        b.left < board.right - 1 &&
        b.right > board.left + 1 &&
        b.top < board.bottom - 1 &&
        b.bottom > board.top + 1;
      if (overlaps) result[`board covered by ${el.className.split(' ')[0]}`] = 1;
    }
    result['horizontal scroll'] = Math.max(0, document.documentElement.scrollWidth - vw);
    return result;
  });
}

test.describe('communicate mode', () => {
  for (const scheme of ['light', 'dark']) {
    test(`${scheme}: has no WCAG A/AA violations, with the menu closed and open`, async ({
      page,
    }) => {
      await open(page, `?scheme=${scheme}`);
      await expectNoA11yViolations(page);
      await menuButton(page).click();
      await expectNoA11yViolations(page);
    });
  }

  test('fits every target viewport, the board never covered, menu closed and open (R6)', async ({
    page,
  }) => {
    await open(page);
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      for (const menu of ['closed', 'open']) {
        if (menu === 'open') await menuButton(page).click();
        const problems = await layoutProblems(page);
        const fine = Object.fromEntries(Object.keys(problems).map((k) => [k, 0]));
        expect(problems, `${viewport.name}, menu ${menu}`).toEqual(fine);
        if (menu === 'open') await menuButton(page).click();
      }
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

  test('has no app navigation, but a visible way back to the start page (R12)', async ({
    page,
  }) => {
    await open(page);
    await expect(page.getByRole('navigation')).toHaveCount(0);
    await page.getByRole('link', { name: 'Zakończ' }).click();
    await expect(page).toHaveURL(/start\.html/);
  });

  test('the caregiver menu is a disclosure: it opens in place of the question and closes with Escape', async ({
    page,
  }) => {
    await open(page);
    const menu = page.getByRole('region', { name: 'Menu opiekuna' });
    await expect(menuButton(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(menu).toBeHidden();

    await menuButton(page).click();
    await expect(menuButton(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(menu.getByRole('button')).toHaveText([
      'Cofnij literę',
      'Pauza',
      'Przeczytaj',
      'Wyczyść',
    ]);
    await expect(page.getByText('Kolumna 7?')).toBeHidden();
    await expect(page.getByRole('table')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(menuButton(page)).toBeFocused();
    await expect(page.getByText('Kolumna 7?')).toBeVisible();
  });

  test('the active column is marked by a 4 px outline and bold text, not by color alone (R4)', async ({
    page,
  }) => {
    await open(page);
    const active = page.locator('.board .is-active');
    await expect(active).toHaveCount(6); // the column header and its five cells
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
    await expect(page.getByRole('link', { name: /Start\./ })).toHaveAttribute(
      'href',
      /start\.html\?scheme=dark/,
    );
  });
});
