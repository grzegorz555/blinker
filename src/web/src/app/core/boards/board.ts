// Board format v1 (spec 006, R1; docs/board-format.md). Plain TypeScript, no Angular imports.

/** What a non-empty cell does when it is chosen. */
export type CellType = 'char' | 'word' | 'action';

/** Actions a cell can hold, so he can do everything with blinks alone on a day when head signals are unreliable. */
export const BOARD_ACTIONS = ['space', 'delete', 'speak', 'clear', 'undo'] as const;
export type BoardAction = (typeof BOARD_ACTIONS)[number];

export type Cell =
  | { readonly type: 'char'; readonly value: string }
  | { readonly type: 'word'; readonly value: string }
  | { readonly type: 'action'; readonly value: BoardAction };

/** A letter board. Cells are addressed as cells[row][column]; null is an empty cell. */
export interface Board {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly name: string;
  /** BCP 47 language tag of the board content (applied as lang on the board container). */
  readonly locale: string;
  /** Column labels, printed above the board (he counts them: "1" … "7"). */
  readonly columns: readonly string[];
  /** Row labels, printed on its left. */
  readonly rows: readonly string[];
  readonly cells: readonly (readonly (Cell | null)[])[];
}

/** Limits of the format (R1, R2). */
export const BOARD_LIMITS = {
  bytes: 64 * 1024,
  minSize: 1,
  maxSize: 10,
  idLength: 40,
  nameLength: 60,
  labelLength: 3,
  charLength: 2,
  wordLength: 20,
  maxErrors: 50,
} as const;

/** The cell at a 1-based column and row, or null for an empty cell or a position outside the board. */
export function cellAt(board: Board, column: number, row: number): Cell | null {
  return board.cells[row - 1]?.[column - 1] ?? null;
}
