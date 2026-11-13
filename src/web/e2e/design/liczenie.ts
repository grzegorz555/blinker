// Spec 004: shared helpers for the Liczenie mock-up tests (communicate.html).
import { expect, type Page } from '../support/test';

/** R6: phone portrait (2), phone landscape, tablet, laptop. */
export const VIEWPORTS = [
  { name: 'phone portrait 360', width: 360, height: 740 },
  { name: 'phone portrait 390', width: 390, height: 844 },
  { name: 'phone landscape', width: 740, height: 360 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1280, height: 800 },
];

/** Opens Liczenie (optionally with a query and a #state) and waits for design.js. */
export async function open(page: Page, query = '') {
  await page.goto(`/communicate.html${query}`);
  await expect(page.locator('html')).toHaveAttribute('data-js', 'ready');
}

export const sentence = (page: Page) => page.locator('[data-sentence]');
export const question = (page: Page) => page.locator('#question');

/**
 * Layout problems (0 = fine): how far a part reaches beyond the viewport, any overlap between the question, the
 * board, the sentence, the simulator and the navigation, and scrolling. Hidden parts (a zero box) never overlap.
 */
export function layoutProblems(page: Page) {
  return page.evaluate(() => {
    const vh = window.innerHeight;
    const vw = document.documentElement.clientWidth;
    const parts = [
      ['question', '.count-question'],
      ['board', '.count-board .board'],
      ['sentence', '.count-sentence'],
      ['simulator', '.sim'],
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

/** Asserts that every layout problem is 0 in the current viewport. */
export async function expectFits(page: Page, label: string) {
  const problems = await layoutProblems(page);
  const fine = Object.fromEntries(Object.keys(problems).map((k) => [k, 0]));
  expect(problems, label).toEqual(fine);
}
