// Spec 019, T3: the favorite phrases in Zdania (Sentences) (R2): add, refuse with a text error, the star in the history,
// move with the focus kept, delete with Cofnij (Undo).
import { TestBed } from '@angular/core/testing';
import { memoryStorage } from '../../../testing/memory-storage';
import { translocoTesting } from '../../../testing/transloco';
import { SPEAKER, TICK_SCHEDULER } from '../../core/counting/counting.service';
import { HISTORY_KEY, type HistoryEntry } from '../../core/history/history';
import { CLOCK } from '../../core/history/history.service';
import { PHRASES_KEY } from '../../core/phrases/phrases';
import { PhrasesService } from '../../core/phrases/phrases.service';
import { FakeSpeaker } from '../../core/speech/fake-speaker';
import { STORAGE } from '../../core/storage/local-store';
import { ConfirmService } from '../../shared/confirm-dialog/confirm-dialog';
import { ToastService, type ToastAction } from '../../shared/toast/toast';
import { SentencesPage } from './sentences-page';

const NOW = Date.UTC(2026, 10, 26, 12, 0, 0);
const history: HistoryEntry[] = [
  { id: 'b', text: 'PIĆ', lang: 'pl', at: NOW - 1000 },
  { id: 'a', text: 'ZMIEŃ POZYCJĘ', lang: 'pl', at: NOW - 2000 },
];

describe('SentencesPage favorite phrases (spec 019)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function render(phrases: string[] = []) {
    const show =
      vi.fn<(key: string, params?: Record<string, unknown>, action?: ToastAction) => void>();
    await TestBed.configureTestingModule({
      imports: [SentencesPage, translocoTesting()],
      providers: [
        {
          provide: STORAGE,
          useValue: memoryStorage(
            new Map([
              [HISTORY_KEY, JSON.stringify(history)],
              [PHRASES_KEY, JSON.stringify(phrases)],
            ]),
          ),
        },
        { provide: SPEAKER, useValue: new FakeSpeaker() },
        { provide: TICK_SCHEDULER, useValue: { every: () => () => undefined } },
        { provide: CLOCK, useValue: () => NOW },
        { provide: ConfirmService, useValue: { confirm: vi.fn(async () => true) } },
        { provide: ToastService, useValue: { show } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(SentencesPage);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const phrasesService = TestBed.inject(PhrasesService);
    const texts = () =>
      [...root.querySelectorAll('[data-testid="phrase"] .sentence')].map((p) =>
        p.textContent?.trim(),
      );
    return { fixture, root, phrases: phrasesService, show, texts };
  }

  async function type(
    fixture: { whenStable(): Promise<unknown> },
    root: HTMLElement,
    text: string,
  ) {
    const input = root.querySelector<HTMLInputElement>('[data-testid="phrase-input"]')!;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    root.querySelector<HTMLButtonElement>('[data-testid="phrase-add"]')!.click();
    await fixture.whenStable();
    return input;
  }

  it('starts empty and says so; the switch is off', async () => {
    const { root } = await render();
    expect(root.querySelector('[data-testid="phrases-empty"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="phrases-state"]')!.textContent).toContain('Settings');
  });

  it('a typed phrase is added with a toast, and the field is emptied', async () => {
    const { fixture, root, texts, show } = await render();
    const input = await type(fixture, root, '  Boli mnie ');
    expect(texts()).toEqual(['Boli mnie']);
    expect(input.value).toBe('');
    expect(show).toHaveBeenCalledWith('toast.phraseAdded');
  });

  it('a refused phrase keeps the text and says why under the field, tied to it (SC 3.3.1)', async () => {
    const { fixture, root, texts, show } = await render(['Pić']);
    const input = await type(fixture, root, 'pić!');
    expect(texts()).toEqual(['Pić']);
    expect(input.value).toBe('pić!');
    const error = root.querySelector('[data-testid="phrase-error"]')!;
    expect(error.textContent).toContain('already on the list');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe(error.id);
    expect(show).not.toHaveBeenCalled();
  });

  it('the star adds a sentence from the history; once it is a phrase, the star is filled and disabled', async () => {
    const { root, texts, show } = await render();
    const stars = () => [...root.querySelectorAll<HTMLButtonElement>('[data-testid="star"]')];
    expect(stars()).toHaveLength(2);
    stars()
      .find((b) => b.getAttribute('aria-label')!.includes('PIĆ'))!
      .click();
    await vi.waitFor(() => expect(texts()).toEqual(['PIĆ']));
    expect(show).toHaveBeenCalledWith('toast.phraseAdded');
    const starred = root.querySelector<HTMLButtonElement>('[data-testid="starred"]')!;
    expect(starred.disabled).toBe(true);
    expect(starred.getAttribute('aria-label')).toContain('PIĆ');
    expect(stars()).toHaveLength(1);
  });

  it('moves with buttons; the first Up and the last Down are disabled; the focus stays on the moved phrase', async () => {
    const { fixture, root, texts } = await render(['Pić', 'Boli mnie', 'Zmień pozycję']);
    const items = () => [...root.querySelectorAll<HTMLElement>('[data-testid="phrase"]')];
    const button = (i: number, move: string) =>
      items()[i].querySelector<HTMLButtonElement>(`[data-move="${move}"]`)!;
    expect(button(0, '-1').disabled).toBe(true);
    expect(button(2, '1').disabled).toBe(true);
    expect(button(1, '-1').getAttribute('aria-label')).toBe('Up: Boli mnie');

    button(2, '-1').click();
    await fixture.whenStable();
    expect(texts()).toEqual(['Pić', 'Zmień pozycję', 'Boli mnie']);
    await vi.waitFor(() => expect(document.activeElement).toBe(button(1, '-1')));

    // Up to the top: its Up is disabled now, so the focus goes to its Down.
    button(1, '-1').click();
    await fixture.whenStable();
    expect(texts()).toEqual(['Zmień pozycję', 'Pić', 'Boli mnie']);
    await vi.waitFor(() => expect(document.activeElement).toBe(button(0, '1')));
  });

  it('a delete is a toast without the phrase, with Cofnij (Undo) back to its place', async () => {
    const { fixture, root, texts, show } = await render(['Pić', 'Boli mnie', 'Zmień pozycję']);
    root
      .querySelector<HTMLButtonElement>('button[aria-label="Delete the phrase: Boli mnie"]')!
      .click();
    await fixture.whenStable();
    expect(texts()).toEqual(['Pić', 'Zmień pozycję']);
    const [key, params, action] = show.mock.lastCall!;
    expect(key).toBe('toast.phraseDeleted');
    expect(params).toBeUndefined();
    action!.run();
    await fixture.whenStable();
    expect(texts()).toEqual(['Pić', 'Boli mnie', 'Zmień pozycję']);
    expect(show).toHaveBeenLastCalledWith('toast.phraseRestored');
  });

  it('a full list hides the field and says so', async () => {
    const { root } = await render(Array.from({ length: 20 }, (_, i) => `zwrot ${i}`));
    expect(root.querySelector('[data-testid="phrase-input"]')).toBeNull();
    expect(root.querySelector('[data-testid="phrases-full"]')).not.toBeNull();
  });
});
