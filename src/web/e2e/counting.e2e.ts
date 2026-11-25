// Spec 007, T4: the Liczenie (Counting) screen on the spec 006 core (R3, R4, R5).
import { expect, test, type Page } from './support/test';
import { expectNoA11yViolations } from './support/a11y';
import { collectThirdPartyRequests } from './support/requests';
import {
  keepCameraStream,
  keptStreamEnded,
  liveVideos,
  noVideoSource,
  setPageVisibility,
} from './support/visibility';

test.use({ locale: 'pl-PL' });

/** R4: phone portrait (2), phone landscape, tablet, laptop. */
const VIEWPORTS = [
  { name: 'phone portrait 360', width: 360, height: 640 },
  { name: 'phone portrait 390', width: 390, height: 844 },
  { name: 'phone landscape', width: 740, height: 360 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1280, height: 800 },
];

const cell = (page: Page, name: string) =>
  page.getByRole('table').getByRole('button', { name, exact: true });
const sentence = (page: Page) => page.getByTestId('sentence');

/**
 * Layout problems (0 = fine): a part reaching beyond the viewport, any overlap between the question, the board, the
 * sentence and the navigation, and scrolling.
 */
function layoutProblems(page: Page) {
  return page.evaluate(() => {
    const vh = window.innerHeight;
    const vw = document.documentElement.clientWidth;
    const parts = [
      ['question', '.count-question'],
      ['board', '.count-board .board'],
      ['sentence', '.count-sentence'],
      ['signals', '.count-signals'],
      ['nav', 'app-nav'],
      ['top bar', '.shell-top'],
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
    // Only <main> scrolls (the shell is the viewport high): on Liczenie (Counting) it must not need to.
    const main = document.querySelector('main')!;
    result['main scroll'] = Math.max(0, main.scrollHeight - main.clientHeight);
    result['horizontal scroll'] = Math.max(0, document.documentElement.scrollWidth - vw);
    const letter = document.querySelector('.cell-btn')!;
    result['letter below 32 px'] = Math.max(0, 32 - parseFloat(getComputedStyle(letter).fontSize));
    return result;
  });
}

async function expectFits(page: Page, label: string) {
  const problems = await layoutProblems(page);
  const fine = Object.fromEntries(Object.keys(problems).map((k) => [k, 0]));
  expect(problems, label).toEqual(fine);
}

test.describe('Liczenie (Counting) screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Liczenie' })).toBeVisible();
  });

  test('shows his board with numbered columns and rows, the question and the empty sentence', async ({
    page,
  }) => {
    const table = page.getByRole('table');
    await expect(table).toHaveAttribute('lang', 'pl');
    await expect(table.getByRole('columnheader')).toHaveText(['1', '2', '3', '4', '5', '6', '7']);
    await expect(table.getByRole('rowheader')).toHaveText(['1', '2', '3', '4', '5']);
    await expect(table.getByRole('button')).toHaveCount(33); // 35 cells, two empty
    await expect(page.getByTestId('question')).toHaveText('Podaj kolumnę');
    await expect(sentence(page)).toHaveText('');
    await expectNoA11yViolations(page);
  });

  test('a tap on a letter adds it and announces it; Cofnij literę (Undo letter) removes it (R3)', async ({
    page,
  }) => {
    await cell(page, 'W').click();
    await cell(page, 'A').click();
    await expect(sentence(page)).toHaveText('WA');
    await expect(page.getByTestId('announcer')).toHaveText('Dodano A');
    await page.getByRole('button', { name: 'Cofnij literę' }).click();
    await expect(sentence(page)).toHaveText('W');
    await expect(page.getByTestId('announcer')).toHaveText('Cofnięto A');
  });

  test('Spacja (Space) ends a word: after a letter only, never at the start or twice', async ({
    page,
  }) => {
    const space = page.getByRole('button', { name: 'Spacja', exact: true });
    await expect(page.getByTestId('hint')).toHaveText(
      'Kiwnij bez liczby = spacja (koniec słowa) · Pokręć głową = cofnij literę',
    );
    await space.click();
    await expect(sentence(page)).toHaveText('');
    await cell(page, 'T').click();
    await cell(page, 'A').click();
    await space.click();
    await expect(page.getByTestId('announcer')).toHaveText('Spacja');
    await space.click();
    await expect(page.getByTestId('announcer')).toHaveText(
      'Bez spacji: zdanie jest puste albo kończy się spacją',
    );
    await cell(page, 'K').click();
    await expect(sentence(page)).toHaveText('TA K');
  });

  test('Wyczyść (Clear) asks first; Anuluj (Cancel) keeps the sentence, Wyczyść clears it (R5)', async ({
    page,
  }) => {
    await cell(page, 'T').click();
    await cell(page, 'A').click();
    await page.getByRole('button', { name: 'Wyczyść' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Wyczyścić zdanie?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Anuluj' })).toBeFocused();
    await expectNoA11yViolations(page);
    await dialog.getByRole('button', { name: 'Anuluj' }).click();
    await expect(sentence(page)).toHaveText('TA');

    await page.getByRole('button', { name: 'Wyczyść' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Wyczyść' }).click();
    await expect(sentence(page)).toHaveText('');
    await page.getByRole('button', { name: 'Cofnij literę' }).click();
    await expect(sentence(page)).toHaveText('TA');
  });

  test('Pauza (Pause) is a toggle in the top bar; taps do nothing while paused', async ({
    page,
  }) => {
    const pause = page.getByRole('banner').getByRole('button', { name: 'Pauza' });
    await expect(pause).toHaveAttribute('aria-pressed', 'false');
    await pause.click();
    const resume = page.getByRole('banner').getByRole('button', { name: 'Wznów' });
    await expect(resume).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('question')).toHaveText('Pauza');
    await cell(page, 'A').click();
    await expect(sentence(page)).toHaveText('');
    await expectNoA11yViolations(page);
    await resume.click();
    await cell(page, 'A').click();
    await expect(sentence(page)).toHaveText('A');
  });

  test('the Pause button leaves the top bar with the screen', async ({ page }) => {
    // The lazy screen first (its listeners), then the link; WebKit under load needs more than the default 5 s.
    await expect(page.getByRole('table')).toBeVisible();
    await page.getByRole('link', { name: 'Ustawienia' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Ustawienia' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('banner').getByRole('button')).toHaveCount(0);
  });

  test('Przeczytaj (Read aloud) with an empty sentence only says there is nothing to read', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Przeczytaj' }).click();
    await expect(page.getByTestId('announcer')).toHaveText('Zdanie jest puste');
  });

  for (const viewport of VIEWPORTS) {
    for (const wide of [false, true]) {
      test(`fits ${viewport.name}${wide ? ' with a wide font' : ''} without covering the board (R4)`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        if (wide) {
          // Verdana is wide on Windows and macOS; where it is missing the system font is used (the plain check).
          await page.addStyleTag({
            content: 'html, button { font-family: Verdana, sans-serif !important; }',
          });
        }
        await cell(page, 'W').click();
        await expectFits(page, `${viewport.name}${wide ? ', wide font' : ''}`);
      });
    }
  }

  test('light and dark have no axe violations', async ({ page }) => {
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      await expectNoA11yViolations(page);
    }
  });
});

// Spec 012: with the camera switch on, his face signals drive Liczenie (Counting). Chromium has a fake camera (a test
// pattern without a face); WebKit in tests has none, so it shows the reason and the buttons keep working.
test.describe('Liczenie (Counting) with the camera', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem('blinker.settings.v1', JSON.stringify({ camera: true })),
    );
    await page
      .context()
      .grantPermissions(['camera'])
      .catch(() => undefined);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Liczenie' })).toBeVisible();
  });

  test('says whether it sees his face; the buttons still work; the board still fits at 360 × 640', async ({
    page,
    browserName,
  }) => {
    test.slow(); // the wasm and the model load on a cold start
    const status = page.getByTestId('camera-status');
    if (browserName === 'chromium') {
      await expect(status).toHaveText('Brak twarzy', { timeout: 60_000 });
    } else {
      const detail = async () =>
        (await page.locator('app-camera-chip').getAttribute('data-detail')) ?? '';
      await expect
        .poll(async () => `${await status.innerText()} ${await detail()}`, { timeout: 20_000 })
        .toMatch(/^(Brak twarzy|Bez zgody|Brak kamery|Bez kamery|Błąd kamery)/);
      await expect(status).toHaveText(/Brak twarzy|Bez zgody|Brak kamery|Bez kamery|Błąd kamery/, {
        timeout: 20_000,
      });
    }
    await cell(page, 'W').click();
    await expect(sentence(page)).toHaveText('W');
    await expectNoA11yViolations(page);
    await page.setViewportSize({ width: 360, height: 640 });
    await expectFits(page, 'phone portrait 360 with the camera status');
  });

  test('the camera stops when leaving Liczenie (Counting)', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'only Chromium has a fake camera in tests');
    test.slow();
    await expect(page.getByTestId('camera-status')).toHaveText('Brak twarzy', {
      timeout: 60_000,
    });
    const live = () =>
      page.evaluate(
        () =>
          [...document.querySelectorAll('video')].filter(
            (v) => (v.srcObject as MediaStream | null)?.active,
          ).length,
      );
    expect(await live()).toBe(1);
    await page.getByRole('link', { name: 'Ustawienia' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Ustawienia' })).toBeVisible();
    expect(await live()).toBe(0);
  });

  // Spec 014, R1, R2, R4, R5: the page made hidden releases the camera; made visible, it opens again without a tap.
  test('hidden releases the camera, visible opens it again without a tap; the buttons work all the time (spec 014)', async ({
    page,
    browserName,
    baseURL,
  }) => {
    test.skip(browserName !== 'chromium', 'only Chromium has a fake camera in tests');
    test.slow();
    const thirdParty = collectThirdPartyRequests(page, baseURL!);
    const status = page.getByTestId('camera-status');
    await expect(status).toHaveText('Brak twarzy', { timeout: 60_000 });
    await keepCameraStream(page);

    await setPageVisibility(page, 'hidden');
    await expect.poll(() => keptStreamEnded(page)).toBe(true);
    expect(await noVideoSource(page)).toBe(true);
    expect(await liveVideos(page)).toBe(0);
    await expect(status).toHaveText('Kamera…');
    await cell(page, 'W').click();
    await expect(sentence(page)).toHaveText('W');

    await setPageVisibility(page, 'visible');
    await expect(status).toHaveText('Brak twarzy', { timeout: 20_000 });
    await expect.poll(() => liveVideos(page)).toBe(1);
    await cell(page, 'A').click();
    await expect(sentence(page)).toHaveText('WA');
    await expectNoA11yViolations(page);
    expect(thirdParty).toEqual([]);
  });

  // Spec 014, R10: "Kamera" (Camera) in the top bar, a toggle like "Pauza" (Pause).
  test('Kamera (Camera) turns the camera off and on by hand; the top bar fits at 360 px portrait and in landscape', async ({
    page,
    browserName,
  }) => {
    test.slow();
    const chromium = browserName === 'chromium';
    const status = page.getByTestId('camera-status');
    const toggle = page.getByRole('button', { name: 'Kamera', exact: true });
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    if (chromium) {
      await expect(status).toHaveText('Brak twarzy', { timeout: 60_000 });
      await keepCameraStream(page);
    }

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(status).toHaveText('Kamera wyłączona');
    if (chromium) {
      await expect.poll(() => keptStreamEnded(page)).toBe(true);
      expect(await noVideoSource(page)).toBe(true);
    }
    // The signal buttons keep working with the camera off.
    await cell(page, 'W').click();
    await page
      .getByRole('region', { name: 'Jego sygnały' })
      .getByRole('button', { name: 'Kręcenie głową: nie' })
      .click();
    await expect(sentence(page)).toHaveText('');
    await expectNoA11yViolations(page);

    for (const viewport of [
      { name: 'phone portrait 360', width: 360, height: 640 },
      { name: 'phone landscape', width: 740, height: 360 },
    ]) {
      await page.setViewportSize(viewport);
      await expectFits(page, `${viewport.name} with the camera off`);
      expect(await topBarProblems(page), viewport.name).toEqual([]);
    }

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    if (chromium) {
      await expect(status).toHaveText('Brak twarzy', { timeout: 20_000 });
      await expect.poll(() => liveVideos(page)).toBe(1);
    } else {
      // WebKit in tests has no camera: the reason is said again in text.
      await expect(status).toHaveText(/Brak twarzy|Bez zgody|Brak kamery|Bez kamery|Błąd kamery/, {
        timeout: 20_000,
      });
    }
    for (const viewport of [
      { name: 'phone portrait 360', width: 360, height: 640 },
      { name: 'phone landscape', width: 740, height: 360 },
    ]) {
      await page.setViewportSize(viewport);
      await expectFits(page, `${viewport.name} with the camera on`);
      expect(await topBarProblems(page), viewport.name).toEqual([]);
    }
    await expectNoA11yViolations(page);
  });
});

// Spec 012, R7: a chime when the column is taken, so he knows when to give the row. A fake AudioContext records the
// frequency of every tone, so the test hears what he would hear. The camera is off, so the +1 button gives the blink.
test.describe('Liczenie (Counting): the chime before the row', () => {
  const ROW_READY_HZ = [523, 659, 784];

  async function recordTones(page: Page, settings: Record<string, unknown>) {
    await page.addInitScript((stored) => {
      localStorage.setItem('blinker.settings.v1', JSON.stringify(stored));
      const tones: number[] = [];
      (window as unknown as { __tones: number[] }).__tones = tones;
      class FakeAudioContext {
        currentTime = 0;
        state = 'running';
        destination = {};
        resume() {
          return Promise.resolve();
        }
        createOscillator() {
          return {
            type: 'sine',
            frequency: { setValueAtTime: (hz: number) => void tones.push(hz) },
            connect: () => undefined,
            start: () => undefined,
            stop: () => undefined,
          };
        }
        createGain() {
          return {
            gain: {
              setValueAtTime: () => undefined,
              exponentialRampToValueAtTime: () => undefined,
            },
            connect: () => undefined,
          };
        }
      }
      Object.defineProperty(window, 'AudioContext', { value: FakeAudioContext });
    }, settings);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Liczenie' })).toBeVisible();
  }
  const tones = (page: Page) =>
    page.evaluate(() => (window as unknown as { __tones: number[] }).__tones);
  const blink = (page: Page) =>
    page.getByRole('region', { name: 'Jego sygnały' }).getByRole('button', { name: /Mrugnięcie/ });

  test('on by default: the pause takes the column, then C-E-G plays once', async ({ page }) => {
    await recordTones(page, { camera: false });
    await blink(page).click();
    await expect(page.getByTestId('question')).toHaveText('Kolumna 1. Podaj wiersz', {
      timeout: 5000,
    });
    await expect.poll(() => tones(page)).toEqual(ROW_READY_HZ);
    // The row and the letter: no second chime (the letter is said instead).
    await blink(page).click();
    await expect(sentence(page)).not.toHaveText('', { timeout: 5000 });
    expect(await tones(page)).toEqual(ROW_READY_HZ);
  });

  test('"Dźwięk: teraz wiersz" (Sound: now the row) off: the column is taken in silence', async ({
    page,
  }) => {
    await recordTones(page, { camera: false, rowCue: false });
    await blink(page).click();
    await expect(page.getByTestId('question')).toHaveText('Kolumna 1. Podaj wiersz', {
      timeout: 5000,
    });
    expect(await tones(page)).toEqual([]);
  });
});

/**
 * Spec 014: the camera chip, "Kamera" (Camera) and "Pauza" (Pause) side by side in the top bar: each inside the
 * viewport, none overlapping another, the two buttons with a touch target at least 44 px high. Returns the problems found.
 */
function topBarProblems(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const parts = [
      ['chip', 'app-camera-chip [data-testid="camera-status"]'],
      ['camera', '[data-testid="camera-toggle"]'],
      ['pause', '.pause-btn:not(.camera-btn)'],
    ].map(([name, selector]) => {
      const el = document.querySelector(selector);
      return [name, el?.getBoundingClientRect() ?? null] as const;
    });
    const problems: string[] = [];
    for (const [name, box] of parts) {
      if (!box) problems.push(`${name} missing`);
      else if (box.left < 0 || box.right > vw + 0.5) problems.push(`${name} outside`);
    }
    for (let i = 0; i < parts.length; i++) {
      for (let j = i + 1; j < parts.length; j++) {
        const [an, a] = parts[i];
        const [bn, b] = parts[j];
        if (
          a &&
          b &&
          a.left < b.right - 1 &&
          a.right > b.left + 1 &&
          a.top < b.bottom - 1 &&
          a.bottom > b.top + 1
        )
          problems.push(`${an} overlaps ${bn}`);
      }
    }
    // An M3 button is drawn 40 px high; its touch target is the invisible 48 px layer Angular Material adds.
    for (const [name, selector] of [
      ['camera', '[data-testid="camera-toggle"]'],
      ['pause', '.pause-btn:not(.camera-btn)'],
    ]) {
      const button = document.querySelector(selector);
      const target = button?.querySelector('.mat-mdc-button-touch-target');
      const height = Math.max(
        button?.getBoundingClientRect().height ?? 0,
        target && getComputedStyle(target).display !== 'none'
          ? target.getBoundingClientRect().height
          : 0,
      );
      if (height < 44) problems.push(`${name} target ${Math.round(height)} px high`);
    }
    return problems;
  });
}
