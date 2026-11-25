import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { CountingService, defaultBoard } from '../counting/counting.service';
import {
  STORAGE,
  readStored,
  removeStored,
  writeStored,
  type StoreProblem,
} from '../storage/local-store';
import { BOARD_LIMITS, type Board } from './board';
import { validateBoardBytes, validateBoardData, type BoardError } from './validate-board';

export const BOARDS_KEY = 'blinker.boards.v1';
export const ACTIVE_BOARD_KEY = 'blinker.activeBoard.v1';

/** The result of an import: the board, or every error with its path (SC 3.3.1). */
export type ImportResult =
  | { readonly ok: true; readonly board: Board; readonly replaced: boolean }
  | { readonly ok: false; readonly errors: readonly BoardError[] };

/** The only kind of file an import takes. The picker's `accept` is a hint a person can switch off, so we check. */
const JSON_FILE = /\.json$/i;

/** Imported boards read back from the device: each is validated again, like a new import. */
export function validateStoredBoards(data: unknown): Board[] | null {
  if (!Array.isArray(data)) return null;
  const boards: Board[] = [];
  for (const item of data) {
    const result = validateBoardData(item);
    if (!result.ok) return null;
    boards.push(result.board);
  }
  return boards;
}

const validateId = (data: unknown) =>
  typeof data === 'string' && data.length <= BOARD_LIMITS.idLength ? data : null;

/**
 * Tablice (Boards) (spec 007, R10, R12): his built-in board and the imported ones, the active board, kept on the
 * device. Imported files are untrusted input: the name and the size are checked before the file is read, then the
 * spec 006 validator checks the bytes and every field. The active board goes to the counting machine.
 */
@Injectable({ providedIn: 'root' })
export class BoardsService {
  private readonly storage = inject(STORAGE);
  private readonly counting = inject(CountingService);

  /** His board, built in: it can never be deleted. */
  readonly builtIn = defaultBoard();
  private readonly imported = signal<readonly Board[]>([]);
  private readonly activeId = signal<string>(this.builtIn.id);

  readonly boards = computed(() => [this.builtIn, ...this.imported()]);
  readonly active = computed(
    () => this.boards().find((b) => b.id === this.activeId()) ?? this.builtIn,
  );
  readonly problem = signal<StoreProblem | null>(null);

  constructor() {
    this.reload();
    effect(() => this.counting.useBoard(this.active()));
  }

  /** Reads the stored boards again; nothing stored: only his board (a restored backup, spec 017, R7). */
  reload(): void {
    const boards = readStored(this.storage, BOARDS_KEY, validateStoredBoards);
    const active = readStored(this.storage, ACTIVE_BOARD_KEY, validateId);
    this.imported.set(boards.value ?? []);
    this.activeId.set(active.value ?? this.builtIn.id);
    this.problem.set(boards.problem ?? active.problem);
  }

  isBuiltIn(board: Board): boolean {
    return board.id === this.builtIn.id;
  }

  select(id: string): void {
    if (!this.boards().some((b) => b.id === id)) return;
    this.activeId.set(id);
    this.save(ACTIVE_BOARD_KEY, id);
  }

  /**
   * Imports a board from a file. Only a .json file is taken, and the size is checked before reading (R10); then the
   * bytes go through the validator (strict UTF-8, JSON, every field, a scan of every text). The file type is not
   * checked: browsers derive it from the extension, and some phones leave it empty.
   * A board with the id of an imported one replaces it (a corrected file); the id of his board is reserved.
   */
  async import(file: Pick<File, 'name' | 'size' | 'arrayBuffer'>): Promise<ImportResult> {
    if (!JSON_FILE.test(file.name)) {
      return { ok: false, errors: [{ path: '', code: 'not-json-file' }] };
    }
    if (file.size > BOARD_LIMITS.bytes) {
      return { ok: false, errors: [{ path: '', code: 'too-large', limit: BOARD_LIMITS.bytes }] };
    }
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await file.arrayBuffer());
    } catch {
      // The file was moved or deleted after it was chosen, or the system refused to read it.
      return { ok: false, errors: [{ path: '', code: 'not-text' }] };
    }
    const result = validateBoardBytes(bytes);
    if (!result.ok) return result;
    const board = result.board;
    if (board.id === this.builtIn.id) {
      return { ok: false, errors: [{ path: 'id', code: 'reserved-id' }] };
    }
    const replaced = this.imported().some((b) => b.id === board.id);
    this.imported.update((list) => [...list.filter((b) => b.id !== board.id), board]);
    this.save(BOARDS_KEY, this.imported());
    return { ok: true, board, replaced };
  }

  /** Deletes an imported board (after the page's confirmation); his board stays. */
  remove(id: string): void {
    if (id === this.builtIn.id) return;
    this.imported.update((list) => list.filter((b) => b.id !== id));
    this.save(BOARDS_KEY, this.imported());
    if (this.activeId() === id) this.select(this.builtIn.id);
  }

  /** Only his built-in board, and it is the active one; the stored boards deleted (spec 013, R3). */
  reset(): void {
    this.imported.set([]);
    this.activeId.set(this.builtIn.id);
    const removed = [BOARDS_KEY, ACTIVE_BOARD_KEY].map((key) => removeStored(this.storage, key));
    this.problem.set(removed.every(Boolean) ? null : 'unavailable');
  }

  private save(key: string, value: unknown): void {
    if (!writeStored(this.storage, key, value)) this.problem.set('unavailable');
    else if (this.problem() === 'corrupted') this.problem.set(null);
  }
}
