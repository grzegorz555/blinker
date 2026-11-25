import { DOCUMENT } from '@angular/common';
import {
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatRadioButton, MatRadioGroup } from '@angular/material/radio';
import { TranslocoPipe } from '@jsverse/transloco';
import { BOARD_LIMITS, type Board } from '../../core/boards/board';
import { BoardsService } from '../../core/boards/boards.service';
import { exampleBoardJson } from '../../core/boards/example-board';
import { LanguageService } from '../../core/i18n/language.service';
import type { BoardError } from '../../core/boards/validate-board';
import { ConfirmService } from '../../shared/confirm-dialog/confirm-dialog';
import { ToastService } from '../../shared/toast/toast';

/**
 * Tablice (Boards) (spec 007, R10): the active board as a radio group, a preview, an import from a file with every
 * error shown in text with its path (SC 3.3.1; focus moves to the error summary), and deleting an imported board
 * after a confirmation. Board values are rendered with text bindings only: an imported file is untrusted input.
 */
@Component({
  selector: 'app-boards-page',
  imports: [MatButton, MatIconButton, MatRadioButton, MatRadioGroup, TranslocoPipe],
  templateUrl: './boards-page.html',
  styleUrl: './boards-page.css',
})
export class BoardsPage {
  private readonly service = inject(BoardsService);
  private readonly confirmService = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);
  private readonly language = inject(LanguageService).language;
  private readonly errorSummary = viewChild<ElementRef<HTMLElement>>('errorSummary');

  protected readonly boards = this.service.boards;
  protected readonly active = this.service.active;
  protected readonly problem = this.service.problem;
  protected readonly limits = { kb: BOARD_LIMITS.bytes / 1024, size: BOARD_LIMITS.maxSize };
  protected readonly errors = signal<readonly BoardError[]>([]);
  protected readonly imported = signal<{ name: string; replaced: boolean } | null>(null);
  protected readonly previewRows = computed(() =>
    this.active().cells.map((row) => row.map((cell) => this.label(cell))),
  );

  /** An example file in the language of the screen, to read or download and edit (the format, docs/board-format.md). */
  protected readonly example = computed(() => exampleBoardJson(this.language()));

  protected downloadExample(): void {
    const url = URL.createObjectURL(new Blob([this.example()], { type: 'application/json' }));
    const link = this.document.createElement('a');
    link.href = url;
    link.download = this.language() === 'pl' ? 'przyklad-tablicy.json' : 'example-board.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url));
  }

  protected isBuiltIn(board: Board): boolean {
    return this.service.isBuiltIn(board);
  }

  protected select(id: string): void {
    this.service.select(id);
    this.toast.show('toast.boardSelected', { name: this.active().name });
  }

  protected async onFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.errors.set([]);
    this.imported.set(null);
    const result = await this.service.import(file);
    input.value = ''; // the same file can be chosen again after fixing it
    if (result.ok) {
      this.imported.set({ name: result.board.name, replaced: result.replaced });
      this.toast.show(result.replaced ? 'toast.boardReplaced' : 'toast.boardImported', {
        name: result.board.name,
      });
      return;
    }
    this.errors.set(result.errors);
    afterNextRender(() => this.errorSummary()?.nativeElement.focus(), { injector: this.injector });
  }

  protected async remove(board: Board): Promise<void> {
    const yes = await this.confirmService.confirm({
      title: 'boards.deleteTitle',
      message: 'boards.deleteMessage',
      confirm: 'boards.delete',
      params: { name: board.name },
    });
    if (!yes) return;
    // What Cofnij (Undo) needs, kept only while its toast is shown (spec 018, R6).
    const index = this.service.indexOf(board.id);
    const wasActive = this.active().id === board.id;
    this.service.remove(board.id);
    this.toast.show(
      'toast.boardDeleted',
      { name: board.name },
      {
        label: 'toast.undo',
        run: () => {
          if (this.service.restore(board, index, wasActive)) {
            this.toast.show('toast.boardRestored', { name: board.name });
          }
        },
      },
    );
  }

  /** What a preview cell shows: the value, or the key of an action label. */
  private label(cell: Board['cells'][number][number]): { text: string; action: boolean } | null {
    if (!cell) return null;
    return cell.type === 'action'
      ? { text: `counting.page.action.${cell.value}`, action: true }
      : { text: cell.value, action: false };
  }
}
