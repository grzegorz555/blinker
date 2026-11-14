import { Component, inject, Injectable } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';

/** Transloco keys of one confirmation (spec 007, R5). */
export interface ConfirmData {
  readonly title: string;
  readonly message: string;
  /** The destructive action, for example "Wyczyść" (Clear). */
  readonly confirm: string;
  /** Defaults to "Anuluj" (Cancel). */
  readonly cancel?: string;
  readonly params?: Readonly<Record<string, string | number>>;
}

/**
 * A modal confirmation before anything that cannot be undone (CLAUDE.md rule 13).
 * Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/ ; MatDialog traps focus, closes on Esc and
 * returns focus to the control that opened it (https://material.angular.dev/components/dialog/overview).
 * "Anuluj" (Cancel) gets the first focus, so a stray Enter never confirms.
 */
@Component({
  selector: 'app-confirm-dialog',
  imports: [
    MatButton,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    TranslocoPipe,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.title | transloco: data.params }}</h2>
    <mat-dialog-content>
      <p>{{ data.message | transloco: data.params }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton="outlined" type="button" [mat-dialog-close]="false" cdkFocusInitial>
        {{ data.cancel ?? 'common.cancel' | transloco }}
      </button>
      <button matButton="filled" type="button" [mat-dialog-close]="true">
        {{ data.confirm | transloco: data.params }}
      </button>
    </mat-dialog-actions>
  `,
})
export class ConfirmDialog {
  protected readonly data = inject<ConfirmData>(MAT_DIALOG_DATA);
}

/** Opens {@link ConfirmDialog}; resolves true only when the person confirms. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly dialog = inject(MatDialog);

  async confirm(data: ConfirmData): Promise<boolean> {
    const ref = this.dialog.open<ConfirmDialog, ConfirmData, boolean>(ConfirmDialog, {
      data,
      role: 'alertdialog',
      // 'first-tabbable' honors cdkFocusInitial (Cancel).
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      maxWidth: '28rem',
    });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }
}
