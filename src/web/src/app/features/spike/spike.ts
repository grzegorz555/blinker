import { Component, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { TranslocoPipe } from '@jsverse/transloco';
import { ConfirmService } from '../../shared/confirm-dialog/confirm-dialog';

/**
 * The Angular Material spike (spec 007, T1; ADR-0005 "Consequences"): a dialog, a slide toggle and a select, zoneless,
 * under the production CSP and Trusted Types. Not linked from the app; removed in T6, when Ustawienia (Settings) uses
 * the same controls for real.
 */
@Component({
  selector: 'app-spike',
  imports: [MatButton, MatFormField, MatLabel, MatOption, MatSelect, MatSlideToggle, TranslocoPipe],
  template: `
    <h1 class="text-3xl font-bold">{{ 'spike.title' | transloco }}</h1>
    <div class="mt-6 flex max-w-md flex-col items-start gap-6">
      <mat-slide-toggle [checked]="toggled()" (change)="toggled.set($event.checked)">
        {{ 'spike.toggle' | transloco }}
      </mat-slide-toggle>
      <mat-form-field class="w-full">
        <mat-label>{{ 'spike.select' | transloco }}</mat-label>
        <mat-select [value]="choice()" (valueChange)="choice.set($event)">
          @for (option of options; track option) {
            <mat-option [value]="option">{{
              'spike.option' | transloco: { n: option }
            }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <button matButton="filled" type="button" (click)="ask()">
        {{ 'spike.open' | transloco }}
      </button>
      <p role="status" data-testid="spike-result">
        {{
          (confirmed() === null ? 'spike.none' : confirmed() ? 'spike.yes' : 'spike.no') | transloco
        }}
      </p>
    </div>
  `,
})
export class Spike {
  private readonly confirmService = inject(ConfirmService);
  protected readonly options = [1, 2, 3];
  protected readonly toggled = signal(false);
  protected readonly choice = signal(1);
  protected readonly confirmed = signal<boolean | null>(null);

  protected async ask(): Promise<void> {
    this.confirmed.set(
      await this.confirmService.confirm({
        title: 'spike.dialogTitle',
        message: 'spike.dialogMessage',
        confirm: 'spike.dialogConfirm',
      }),
    );
  }
}
