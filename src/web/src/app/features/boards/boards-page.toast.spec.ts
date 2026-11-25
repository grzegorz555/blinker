// Spec 018, T3: the toasts of Tablice (Boards) (R5) and Cofnij (Undo) after a delete (R6).
import { TestBed } from '@angular/core/testing';
import { memoryStorage } from '../../../testing/memory-storage';
import { translocoTesting } from '../../../testing/transloco';
import type { Board } from '../../core/boards/board';
import { BoardsService } from '../../core/boards/boards.service';
import { SPEAKER, TICK_SCHEDULER } from '../../core/counting/counting.service';
import { FakeSpeaker } from '../../core/speech/fake-speaker';
import { STORAGE } from '../../core/storage/local-store';
import { ConfirmService } from '../../shared/confirm-dialog/confirm-dialog';
import { ToastService, type ToastAction } from '../../shared/toast/toast';
import { BoardsPage } from './boards-page';

const kitchen: Board = {
  schemaVersion: 1,
  id: 'kitchen',
  name: 'Kuchnia',
  locale: 'pl',
  columns: ['1', '2'],
  rows: ['1'],
  cells: [
    [
      { type: 'word', value: 'TAK' },
      { type: 'word', value: 'NIE' },
    ],
  ],
};
const fileOf = (board: Board) =>
  new File([JSON.stringify(board)], `${board.id}.json`, { type: 'application/json' });

describe('BoardsPage toasts (spec 018)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function render() {
    const show =
      vi.fn<(key: string, params?: Record<string, unknown>, action?: ToastAction) => void>();
    const confirm = vi.fn(async () => true);
    await TestBed.configureTestingModule({
      imports: [BoardsPage, translocoTesting()],
      providers: [
        { provide: STORAGE, useValue: memoryStorage() },
        { provide: SPEAKER, useValue: new FakeSpeaker() },
        { provide: TICK_SCHEDULER, useValue: { every: () => () => undefined } },
        { provide: ConfirmService, useValue: { confirm } },
        { provide: ToastService, useValue: { show } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(BoardsPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const service = TestBed.inject(BoardsService);
    const choose = async (board: Board) => {
      const input = root.querySelector<HTMLInputElement>('[data-testid="board-file"]')!;
      Object.defineProperty(input, 'files', { configurable: true, value: [fileOf(board)] });
      input.dispatchEvent(new Event('change'));
      await vi.waitFor(() => expect(service.boards().some((b) => b.id === board.id)).toBe(true));
      await fixture.whenStable();
    };
    return { fixture, root, service, show, confirm, choose };
  }

  it('an import is a toast with its name; the hint to choose it stays on the page', async () => {
    const { root, show, choose } = await render();
    await choose(kitchen);
    expect(show).toHaveBeenCalledWith('toast.boardImported', { name: 'Kuchnia' });
    expect(root.querySelector('[data-testid="import-hint"]')?.textContent?.trim()).toBe(
      'Choose it above to use it.',
    );
    expect(root.querySelector('[role="status"][data-testid="import-ok"]')).toBeNull();

    await choose({ ...kitchen, name: 'Kuchnia 2' });
    expect(show).toHaveBeenLastCalledWith('toast.boardReplaced', { name: 'Kuchnia 2' });
    expect(root.querySelector('[data-testid="import-hint"]')).toBeNull();
  });

  it('choosing a board says which one is active', async () => {
    const { fixture, root, show, choose } = await render();
    await choose(kitchen);
    root.querySelector<HTMLInputElement>('input[type="radio"][value="kitchen"]')!.click();
    await fixture.whenStable();
    expect(show).toHaveBeenLastCalledWith('toast.boardSelected', { name: 'Kuchnia' });
  });

  it('a delete is a toast with Cofnij (Undo), which puts the board back and active again (R6)', async () => {
    const { fixture, root, service, show, choose } = await render();
    await choose(kitchen);
    service.select('kitchen');
    await fixture.whenStable();

    root.querySelector<HTMLButtonElement>('button[aria-label*="Kuchnia"]')!.click();
    await vi.waitFor(() => expect(service.boards().some((b) => b.id === 'kitchen')).toBe(false));
    const [key, params, action] = show.mock.lastCall!;
    expect([key, params]).toEqual(['toast.boardDeleted', { name: 'Kuchnia' }]);
    expect(action?.label).toBe('toast.undo');

    action!.run();
    await fixture.whenStable();
    expect(service.boards().map((b) => b.id)).toContain('kitchen');
    expect(service.active().id).toBe('kitchen');
    expect(show).toHaveBeenLastCalledWith('toast.boardRestored', { name: 'Kuchnia' });
  });
});
