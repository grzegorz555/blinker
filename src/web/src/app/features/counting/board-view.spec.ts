import { TestBed } from '@angular/core/testing';
import { translocoTesting } from '../../../testing/transloco';
import type { Board } from '../../core/boards/board';
import { BoardView, type CellPick } from './board-view';

const board: Board = {
  schemaVersion: 1,
  id: 'test',
  name: 'Test',
  locale: 'pl',
  columns: ['1', '2'],
  rows: ['1', '2'],
  cells: [
    [
      { type: 'char', value: 'A' },
      { type: 'char', value: '<b>x</b>' },
    ],
    [{ type: 'action', value: 'space' }, null],
  ],
};

describe('BoardView (spec 007, R4)', () => {
  async function render(pointer = { column: null as number | null, row: null as number | null }) {
    await TestBed.configureTestingModule({
      imports: [BoardView, translocoTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(BoardView);
    fixture.componentRef.setInput('board', board);
    fixture.componentRef.setInput('pointer', pointer);
    const picks: CellPick[] = [];
    fixture.componentInstance.pick.subscribe((p) => picks.push(p));
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    return { root, picks };
  }

  it('is a table in the board language, with the numbers as column and row headers', async () => {
    const { root } = await render();
    const table = root.querySelector('table')!;
    expect(table.getAttribute('lang')).toBe('pl');
    expect(table.querySelector('caption')?.textContent).toContain('columns 1 to 2, rows 1 to 2');
    expect(
      [...table.querySelectorAll('th[scope="col"]')].map((t) => t.textContent?.trim()),
    ).toEqual(['1', '2']);
    expect(
      [...table.querySelectorAll('th[scope="row"]')].map((t) => t.textContent?.trim()),
    ).toEqual(['1', '2']);
  });

  it('renders cell values as text, never as markup; empty cells are not buttons', async () => {
    const { root } = await render();
    const buttons = [...root.querySelectorAll('button')];
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['A', '<b>x</b>', 'Space']);
    expect(root.querySelector('b')).toBeNull();
    expect(root.querySelectorAll('td.is-empty button')).toHaveLength(0);
  });

  it('labels action cells in the UI language', async () => {
    const { root } = await render();
    const action = root.querySelector('.cell-action')!;
    expect(action.textContent?.trim()).toBe('Space');
  });

  it('emits the 1-based column and row of a tapped cell', async () => {
    const { root, picks } = await render();
    [...root.querySelectorAll('button')][1]!.click();
    expect(picks).toEqual([{ column: 2, row: 1 }]);
  });

  it('marks the column, then the cell, with a class and aria-current (never color alone)', async () => {
    const column = await render({ column: 2, row: null });
    const header = column.root.querySelectorAll('th[scope="col"]')[1]!;
    expect(header.classList).toContain('is-active');
    expect(header.getAttribute('aria-current')).toBe('true');
    expect(column.root.querySelectorAll('td.is-active')).toHaveLength(0);
    TestBed.resetTestingModule();

    const cell = await render({ column: 1, row: 2 });
    const active = cell.root.querySelectorAll('td.is-active');
    expect(active).toHaveLength(1);
    expect(active[0]!.textContent?.trim()).toBe('Space');
    expect(active[0]!.getAttribute('aria-current')).toBe('true');
  });
});
