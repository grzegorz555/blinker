import { CdkPortal } from '@angular/cdk/portal';
import {
  Component,
  computed,
  inject,
  type AfterViewInit,
  type OnDestroy,
  viewChild,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import { TranslocoPipe } from '@jsverse/transloco';
import { CountingService } from '../../core/counting/counting.service';
import { total, type TouchTarget } from '../../core/counting/counting';
import type { InputSignalType } from '../../core/input/signals';
import { ConfirmService } from '../../shared/confirm-dialog/confirm-dialog';
import { TopBar } from '../../shell/top-bar';
import { BoardView, type CellPick } from './board-view';

/**
 * Liczenie (Counting), the main screen (spec 007, R4, R5): the M3 supporting-pane layout on the spec 006 counting core.
 * The board is the main pane; the question with the counter and the sentence with its actions are the supporting
 * pane. Every change of the text goes through CountingService (his signals, or TOUCH for a tap), so the screen holds
 * no logic of its own. Time runs only while the screen is shown (start/stop).
 */
@Component({
  selector: 'app-counting-page',
  imports: [BoardView, CdkPortal, MatButton, TranslocoPipe],
  templateUrl: './counting-page.html',
  styleUrl: './counting-page.css',
})
export class CountingPage implements AfterViewInit, OnDestroy {
  private readonly counting = inject(CountingService);
  private readonly confirmService = inject(ConfirmService);
  private readonly topBar = inject(TopBar);
  private readonly actions = viewChild.required(CdkPortal);

  protected readonly state = this.counting.state;
  protected readonly board = computed(() => this.counting.config().board);
  protected readonly prompt = this.counting.prompt;
  protected readonly pointer = this.counting.pointer;
  protected readonly sentence = this.counting.sentence;
  protected readonly announcement = this.counting.announcement;
  protected readonly paused = computed(() => this.state().name === 'paused');
  protected readonly total = computed(() => total(this.state()));
  protected readonly notice = computed(() => this.state().notice);
  /** "Podpowiedzi w Liczeniu" (Hints in Counting): a setting from T6; on until then. */
  protected readonly showHints = computed(() => true);

  /** "Krok 1 z 2 · kolumna" (Step 1 of 2 · column) while giving a number. */
  protected readonly stepKey = computed(() =>
    this.state().name.startsWith('row.') ? 'counting.page.stepRow' : 'counting.page.stepColumn',
  );

  protected readonly tallyParams = computed(() => {
    const parts = this.state().parts;
    return {
      hands: parts.filter((p) => p === 5).length,
      blinks: parts.filter((p) => p === 1).length,
      n: this.total(),
    };
  });

  constructor() {
    this.counting.start();
  }

  ngAfterViewInit(): void {
    this.topBar.show(this.actions());
  }

  ngOnDestroy(): void {
    this.topBar.clear(this.actions());
    this.counting.stop();
  }

  protected send(type: InputSignalType): void {
    this.counting.send({ type });
  }

  protected tapCell({ column, row }: CellPick): void {
    const cell = this.board().cells[row - 1]?.[column - 1];
    if (cell?.type === 'action' && cell.value === 'clear') {
      void this.clear();
      return;
    }
    this.counting.touch({ kind: 'cell', column, row });
  }

  protected touch(kind: Exclude<TouchTarget['kind'], 'cell' | 'clear'>): void {
    this.counting.touch({ kind });
  }

  /** Clearing cannot be undone by a glance at the screen, so it asks first (spec 007, R5); undo still brings it back. */
  protected async clear(): Promise<void> {
    if (!this.sentence()) return;
    const yes = await this.confirmService.confirm({
      title: 'counting.page.clearTitle',
      message: 'counting.page.clearMessage',
      confirm: 'counting.page.clear',
    });
    if (yes) this.counting.touch({ kind: 'clear' });
  }
}
