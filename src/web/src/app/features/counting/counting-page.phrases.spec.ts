// Spec 019, T3: the offered favorite phrase on Liczenie (Counting) (R1, R7): no row while the switch is off; the row
// keeps its place while it is on; after the pause the phrase is a button that takes it, and it is asked aloud.
import { TestBed } from '@angular/core/testing';
import { memoryStorage } from '../../../testing/memory-storage';
import { translocoTesting } from '../../../testing/transloco';
import { SPEAKER, TICK_SCHEDULER, type TickScheduler } from '../../core/counting/counting.service';
import { PHRASES_KEY } from '../../core/phrases/phrases';
import { SettingsService } from '../../core/settings/settings.service';
import { FakeSpeaker } from '../../core/speech/fake-speaker';
import { STORAGE } from '../../core/storage/local-store';
import { ConfirmService } from '../../shared/confirm-dialog/confirm-dialog';
import { CountingPage } from './counting-page';

describe('CountingPage favorite phrases (spec 019)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function render(on: boolean) {
    let tick: (now: number) => void = () => undefined;
    const scheduler: TickScheduler = {
      every: (_ms, fn) => {
        tick = fn;
        return () => undefined;
      },
    };
    const speaker = new FakeSpeaker();
    await TestBed.configureTestingModule({
      imports: [CountingPage, translocoTesting()],
      providers: [
        {
          provide: STORAGE,
          useValue: memoryStorage(new Map([[PHRASES_KEY, JSON.stringify(['Zmień pozycję'])]])),
        },
        { provide: TICK_SCHEDULER, useValue: scheduler },
        { provide: SPEAKER, useValue: speaker },
        { provide: ConfirmService, useValue: { confirm: async () => true } },
      ],
    }).compileComponents();
    TestBed.inject(SettingsService).update({ suggestPhrases: on, phrasePauseMs: 1000 });
    const fixture = TestBed.createComponent(CountingPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const button = (name: string) =>
      [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === name)!;
    const text = (id: string) => root.querySelector(`[data-testid="${id}"]`)?.textContent?.trim();
    const spell = () => {
      button('Z').click();
      button('M').click();
    };
    /** Time passes in steps of 100 ms, as the service sends it. */
    const wait = async (from: number, to: number) => {
      for (let now = from; now <= to; now += 100) tick(now);
      await fixture.whenStable();
    };
    return { fixture, root, text, speaker, spell, wait };
  }

  it('the switch off (the default): no row and no offer', async () => {
    const { root, spell, wait } = await render(false);
    spell();
    await wait(0, 5000);
    expect(root.querySelector('[data-testid="phrase-row"]')).toBeNull();
  });

  it('on: the row is there and empty until the pause; then the phrase is shown, asked aloud, and a tap takes it', async () => {
    const { fixture, root, text, speaker, spell, wait } = await render(true);
    expect(root.querySelector('[data-testid="phrase-row"]')).not.toBeNull();
    spell();
    await wait(0, 500);
    expect(root.querySelector('[data-testid="phrase-offer"]')).toBeNull();

    await wait(600, 1500);
    const offer = root.querySelector<HTMLButtonElement>('[data-testid="phrase-offer"]')!;
    expect(offer.textContent?.replace(/\s+/g, ' ').trim()).toBe('Phrase: Zmień pozycję');
    expect(offer.querySelector('span')!.getAttribute('lang')).toBe('pl');
    expect(text('question')).toBe('Zmień pozycję?');
    // Asked aloud in the board's language, though "Say the questions" is off by default.
    expect(speaker.said.at(-1)).toMatchObject({ text: 'Zmień pozycję?', options: { lang: 'pl' } });

    offer.click();
    await fixture.whenStable();
    expect(text('sentence')).toBe('ZMIEŃ POZYCJĘ');
    expect(text('question')).toBe('Read it aloud?');
    expect(root.querySelector('[data-testid="phrase-offer"]')).toBeNull();
  });
});
