import { Component, computed, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Board, Cell } from '../../core/boards/board';

/** A cell the person tapped: 1-based, like the numbers he gives. */
export interface CellPick {
  readonly column: number;
  readonly row: number;
}

/**
 * The letter board (spec 007, R4): a table with the column and row numbers he counts as headers, so a screen reader
 * says "column 7, row 3" for a cell (https://www.w3.org/WAI/tutorials/tables/two-headers/). Each non-empty cell is a
 * button with its value as text (never markup: board files are untrusted input); empty cells are not buttons.
 * The pointer (the column being counted, then the cell) has a 4 px outline and bold text, never color alone
 * (SC 1.4.1); `aria-current` tells assistive technology where it is. The board content keeps its own language (`lang`).
 * Cells are squares sized from the space the board really has (container query units), at least 32 px letters.
 */
@Component({
  selector: 'app-board-view',
  imports: [TranslocoPipe],
  styleUrl: './board-view.css',
  template: `
    <table
      class="board"
      [attr.lang]="board().locale"
      [style.--cols]="board().columns.length"
      [style.--rows]="board().rows.length"
    >
      <caption class="sr-only">
        {{
          'counting.page.boardCaption'
            | transloco: { columns: board().columns.length, rows: board().rows.length }
        }}
      </caption>
      <thead>
        <tr>
          <td></td>
          @for (label of board().columns; track $index) {
            <th
              scope="col"
              [class.is-active]="activeColumn() === $index + 1"
              [attr.aria-current]="activeColumn() === $index + 1 ? 'true' : null"
            >
              {{ label }}
            </th>
          }
        </tr>
      </thead>
      <tbody>
        @for (cells of board().cells; track $index; let row = $index) {
          <tr>
            <th
              scope="row"
              [class.is-active]="activeRow() === row + 1"
              [attr.aria-current]="activeRow() === row + 1 ? 'true' : null"
            >
              {{ board().rows[row] }}
            </th>
            @for (cell of cells; track $index; let column = $index) {
              <td
                class="board-cell"
                [class.is-active]="isActive(column + 1, row + 1)"
                [class.is-empty]="!cell"
                [attr.aria-current]="isActive(column + 1, row + 1) ? 'true' : null"
              >
                @if (cell) {
                  <button
                    type="button"
                    class="cell-btn"
                    [class.cell-action]="cell.type === 'action'"
                    (click)="pick.emit({ column: column + 1, row: row + 1 })"
                  >
                    @if (cell.type === 'action') {
                      <span [attr.lang]="null">{{ actionKey(cell) | transloco }}</span>
                    } @else {
                      {{ cell.value }}
                    }
                  </button>
                }
              </td>
            }
          </tr>
        }
      </tbody>
    </table>
  `,
})
export class BoardView {
  readonly board = input.required<Board>();
  /** The pointer from the counting machine: the column, then the row (1-based), or null. */
  readonly pointer = input<{ column: number | null; row: number | null }>({
    column: null,
    row: null,
  });
  readonly pick = output<CellPick>();

  protected readonly activeColumn = computed(() => this.pointer().column);
  protected readonly activeRow = computed(() => this.pointer().row);

  protected isActive(column: number, row: number): boolean {
    return this.activeColumn() === column && this.activeRow() === row;
  }

  /** Action cells show a UI label in the UI language (the content of letters is not translated). */
  protected actionKey(cell: Cell): string {
    return `counting.page.action.${cell.value}`;
  }
}
