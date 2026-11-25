// Spec 018, T3: the toasts of Zdania (Sentences) (R5) and Cofnij (Undo) after deleting one sentence (R6).
import { TestBed } from '@angular/core/testing';
import { memoryStorage } from '../../../testing/memory-storage';
import { translocoTesting } from '../../../testing/transloco';
import { SPEAKER, TICK_SCHEDULER } from '../../core/counting/counting.service';
import { HISTORY_KEY, type HistoryEntry } from '../../core/history/history';
import { CLOCK, HistoryService } from '../../core/history/history.service';
import { SettingsService } from '../../core/settings/settings.service';
import { FakeSpeaker } from '../../core/speech/fake-speaker';
import { STORAGE } from '../../core/storage/local-store';
import { ConfirmService } from '../../shared/confirm-dialog/confirm-dialog';
import { ToastService, type ToastAction } from '../../shared/toast/toast';
import { SentencesPage } from './sentences-page';

const NOW = Date.UTC(2026, 10, 25, 12, 0, 0);
const stored: HistoryEntry[] = [
  { id: 'b', text: 'NIE', lang: 'pl', at: NOW - 1000 },
  { id: 'a', text: 'TAK', lang: 'pl', at: NOW - 2000 },
];

describe('SentencesPage toasts (spec 018)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function render(answer = true) {
    const show =
      vi.fn<(key: string, params?: Record<string, unknown>, action?: ToastAction) => void>();
    const confirm = vi.fn(async () => answer);
    await TestBed.configureTestingModule({
      imports: [SentencesPage, translocoTesting()],
      providers: [
        {
          provide: STORAGE,
          useValue: memoryStorage(new Map([[HISTORY_KEY, JSON.stringify(stored)]])),
        },
        { provide: SPEAKER, useValue: new FakeSpeaker() },
        { provide: TICK_SCHEDULER, useValue: { every: () => () => undefined } },
        { provide: CLOCK, useValue: () => NOW },
        { provide: ConfirmService, useValue: { confirm } },
        { provide: ToastService, useValue: { show } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(SentencesPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const history = TestBed.inject(HistoryService);
    return { fixture, root, history, show, confirm };
  }

  it('a delete is a toast without his words, with Cofnij (Undo) that puts the sentence back in its place', async () => {
    const { fixture, root, history, show } = await render();
    root.querySelector<HTMLButtonElement>('button[aria-label*="NIE"]')!.click();
    await vi.waitFor(() => expect(history.entries().map((e) => e.text)).toEqual(['TAK']));
    const [key, params, action] = show.mock.lastCall!;
    expect(key).toBe('toast.sentenceDeleted');
    expect(params).toBeUndefined();
    expect(action?.label).toBe('toast.undo');

    action!.run();
    await fixture.whenStable();
    expect(history.entries().map((e) => e.text)).toEqual(['NIE', 'TAK']);
    expect(show).toHaveBeenLastCalledWith('toast.sentenceRestored');
  });

  it('"Usuń historię" (Delete history) is a toast without Cofnij (Undo)', async () => {
    const { root, history, show } = await render();
    root.querySelector<HTMLButtonElement>('button.clear-all')!.click();
    await vi.waitFor(() => expect(history.entries()).toEqual([]));
    expect(show).toHaveBeenCalledWith('toast.historyCleared');
    expect(show.mock.lastCall).toHaveLength(1);
  });

  it('the history turned off (after the dialog) and on again is said in a toast', async () => {
    const { fixture, history, show } = await render();
    const settings = TestBed.inject(SettingsService);
    const page = fixture.componentInstance as unknown as {
      toggle(on: boolean, source: { checked: boolean }): Promise<void>;
    };
    await page.toggle(false, { checked: false });
    TestBed.tick(); // the history service deletes the kept sentences in an effect
    expect(settings.settings().history).toBe(false);
    expect(history.entries()).toEqual([]);
    expect(show).toHaveBeenLastCalledWith('toast.historyOff');
    await page.toggle(true, { checked: true });
    expect(show).toHaveBeenLastCalledWith('toast.historyOn');
  });

  it('"Anuluj" (Cancel) in the dialog shows no toast', async () => {
    const { root, history, show, confirm } = await render(false);
    root.querySelector<HTMLButtonElement>('button[aria-label*="NIE"]')!.click();
    await vi.waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(history.entries()).toHaveLength(2);
    expect(show).not.toHaveBeenCalled();
  });
});
