// A fake Web Speech API for e2e tests (spec 007, T5). Headless browsers have no voices, so without it every test
// would see "no local voice". The fake records what was said in window.__spoken; an utterance ends when the test
// calls window.__endSpeech() (or after `autoEndMs`).
import type { Page } from '@playwright/test';

export interface FakeVoice {
  lang: string;
  localService: boolean;
  default: boolean;
  name: string;
}

export const POLISH_LOCAL_VOICE: FakeVoice = {
  lang: 'pl-PL',
  localService: true,
  default: true,
  name: 'Fake Polish (on device)',
};

/** Installs the fake before the app loads. Pass [] for a device without any voice. */
export async function fakeSpeech(
  page: Page,
  voices: FakeVoice[] = [POLISH_LOCAL_VOICE],
  autoEndMs = 0,
): Promise<void> {
  await page.addInitScript(
    ({ voices, autoEndMs }) => {
      type U = {
        text: string;
        lang: string;
        onend: (() => void) | null;
        onerror: (() => void) | null;
      };
      const w = window as unknown as {
        __spoken: string[];
        __endSpeech: () => void;
        __current: U | null;
      };
      w.__spoken = [];
      w.__current = null;
      w.__endSpeech = () => {
        const u = w.__current;
        w.__current = null;
        u?.onend?.();
      };
      class FakeUtterance {
        text: string;
        lang = '';
        rate = 1;
        voice: unknown = null;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(text: string) {
          this.text = text;
        }
      }
      const synth = {
        getVoices: () => voices,
        speak: (u: U) => {
          w.__spoken.push(u.text);
          w.__current = u;
          if (autoEndMs) setTimeout(() => w.__current === u && w.__endSpeech(), autoEndMs);
        },
        cancel: () => {
          w.__current = null;
        },
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      };
      Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
      Object.defineProperty(window, 'SpeechSynthesisUtterance', {
        value: FakeUtterance,
        configurable: true,
      });
    },
    { voices, autoEndMs },
  );
}

/** What the app has said so far. */
export function spoken(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);
}
