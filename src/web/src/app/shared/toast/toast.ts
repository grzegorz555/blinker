// Spec 018: toasts that confirm what happened (R1–R4, R6). An M3 snackbar (Angular Material) with our own content, so
// the timer can pause and the action has our label.
// https://material.angular.dev/components/snack-bar/overview, https://m3.material.io/components/snackbar/guidelines
//
// - The snack bar announces its content once through its own polite live region (role="status"), because we never
//   set `announcementMessage` (SC 4.1.3). The inline success texts it replaces are gone, so nothing is said twice.
// - Our timer, not `duration`: it pauses while the pointer or the keyboard focus is in the toast (SC 2.2.1).
// - Below 600 px it sits above the navigation bar, and above the focused control when that is near the bottom
//   (SC 2.4.11), through the CSS variable --toast-offset (styles.css).
// - Material turns its animations off by itself with prefers-reduced-motion.
import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, Injectable, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_SNACK_BAR_DATA,
  MatSnackBar,
  MatSnackBarAction,
  MatSnackBarActions,
  MatSnackBarLabel,
  type MatSnackBarRef,
} from '@angular/material/snack-bar';
import { NavigationStart, Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { filter } from 'rxjs';

/** How long a toast stays when nothing holds it (R3). */
export const TOAST_MS = { plain: 6000, action: 10000 } as const;

/** What a holder of the toast is: the pointer over it, or the keyboard focus in it. */
type Holder = 'pointer' | 'focus';

/** The data the toast component gets (MAT_SNACK_BAR_DATA). */
export interface ToastData {
  readonly text: string;
  /** The action's label, or null for a toast without one. */
  readonly action: string | null;
  act(): void;
  hold(holder: Holder, on: boolean): void;
  close(): void;
}

/** A Transloco key and its parameters. */
export interface ToastAction {
  readonly label: string;
  /** Runs at most once, and only while the toast is shown (R6). */
  readonly run: () => void;
}

@Component({
  selector: 'app-toast',
  imports: [MatButton, MatSnackBarAction, MatSnackBarActions, MatSnackBarLabel],
  template: `
    <span matSnackBarLabel data-testid="toast-text">{{ data.text }}</span>
    @if (data.action) {
      <div matSnackBarActions>
        <button
          matButton
          matSnackBarAction
          type="button"
          class="toast-action"
          data-testid="toast-action"
          (click)="data.act()"
        >
          {{ data.action }}
        </button>
      </div>
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .toast-action {
      min-height: 2.75rem;
    }
  `,
  host: {
    '(pointerenter)': 'data.hold("pointer", true)',
    '(pointerleave)': 'data.hold("pointer", false)',
    '(focusin)': 'data.hold("focus", true)',
    '(focusout)': 'data.hold("focus", false)',
    '(keydown.escape)': 'data.close()',
  },
})
export class Toast {
  protected readonly data = inject<ToastData>(MAT_SNACK_BAR_DATA);
}

interface Shown {
  readonly ref: MatSnackBarRef<Toast>;
  readonly hasAction: boolean;
  remaining: number;
  startedAt: number;
  timer: ReturnType<typeof setTimeout> | null;
  readonly holders: Set<Holder>;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);
  private readonly document = inject(DOCUMENT);
  private shown: Shown | null = null;

  constructor() {
    // Leaving the screen ends a Cofnij (Undo): what it would restore is no longer in view (R6).
    const router = inject(Router, { optional: true });
    const subscription = router?.events
      .pipe(filter((e) => e instanceof NavigationStart))
      .subscribe(() => {
        if (this.shown?.hasAction) this.dismiss();
      });
    inject(DestroyRef).onDestroy(() => subscription?.unsubscribe());
  }

  /** Shows a toast for a Transloco key; a new toast replaces the one shown (R1). */
  show(key: string, params?: Record<string, unknown>, action?: ToastAction): void {
    this.dismiss();
    let acted = false;
    const data: ToastData = {
      text: this.transloco.translate(key, params ?? {}),
      action: action ? this.transloco.translate(action.label) : null,
      act: () => {
        if (acted || this.shown?.ref !== ref) return;
        acted = true;
        this.dismiss();
        action?.run();
      },
      hold: (holder, on) => this.hold(holder, on),
      close: () => this.dismiss(),
    };
    this.placeAboveNavigation();
    const ref = this.snackBar.openFromComponent(Toast, {
      data,
      politeness: 'polite',
      panelClass: 'app-toast',
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
    const shown: Shown = {
      ref,
      hasAction: !!action,
      remaining: action ? TOAST_MS.action : TOAST_MS.plain,
      startedAt: Date.now(),
      timer: null,
      holders: new Set(),
    };
    this.shown = shown;
    this.start(shown);
    ref.afterDismissed().subscribe(() => {
      if (shown.timer) clearTimeout(shown.timer);
      if (this.shown === shown) this.shown = null;
    });
  }

  /** Closes the toast shown, if any; its action can no longer run. */
  dismiss(): void {
    const shown = this.shown;
    if (!shown) return;
    this.shown = null;
    if (shown.timer) clearTimeout(shown.timer);
    shown.ref.dismiss();
  }

  private start(shown: Shown): void {
    shown.startedAt = Date.now();
    shown.timer = setTimeout(() => {
      if (this.shown === shown) this.dismiss();
    }, shown.remaining);
  }

  /** R3: the timer stops while anything holds the toast, and goes on with the time that was left. */
  private hold(holder: Holder, on: boolean): void {
    const shown = this.shown;
    if (!shown) return;
    const held = shown.holders.size > 0;
    if (on) shown.holders.add(holder);
    else shown.holders.delete(holder);
    if (!held && shown.holders.size > 0 && shown.timer) {
      clearTimeout(shown.timer);
      shown.timer = null;
      shown.remaining = Math.max(0, shown.remaining - (Date.now() - shown.startedAt));
    } else if (held && shown.holders.size === 0) {
      this.start(shown);
    }
  }

  /**
   * R1: below 600 px the navigation bar is at the bottom; the toast goes above it, and above the focused control
   * when that control is in the bottom area, so neither is covered (SC 2.4.11).
   */
  private placeAboveNavigation(): void {
    const view = this.document.defaultView;
    if (!view) return;
    const height = view.innerHeight;
    let offset = 0;
    const nav = this.document.querySelector('app-nav nav');
    if (nav) {
      const top = nav.getBoundingClientRect().top;
      if (top > height / 2) offset = height - top;
    }
    // The toast with its margins is about 5 rem high (M3: 48–68 px plus 8 px around it).
    const toastArea = 88;
    const focused = this.document.activeElement;
    if (focused instanceof HTMLElement && focused !== this.document.body) {
      const box = focused.getBoundingClientRect();
      const toastTop = height - offset - toastArea;
      if (box.bottom > toastTop && box.top < height - offset) offset = height - box.top + 8;
    }
    this.document.documentElement.style.setProperty('--toast-offset', `${Math.round(offset)}px`);
  }
}
