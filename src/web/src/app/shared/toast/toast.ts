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
// - The time left is a ring around the toast that shrinks to nothing as the toast goes; while the toast is held the
//   ring stands still (spec 018, R3). It is decorative (aria-hidden): the live region must not change while the
//   toast is shown, or it would be announced again. A CSS animation as long as the toast's time draws it, paused
//   with animation-play-state while the toast is held, so no script runs for it and it moves smoothly; with
//   prefers-reduced-motion it moves in steps of a second.
import { DOCUMENT } from '@angular/common';
import {
  Component,
  DestroyRef,
  Injectable,
  inject,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';
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
  /** How long the toast stays when nothing holds it, in ms; the ring runs for as long. */
  readonly total: number;
  /** True while the pointer or the focus holds the toast: the time stands still. */
  readonly held: Signal<boolean>;
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
    <svg class="toast-ring" aria-hidden="true" focusable="false" data-testid="toast-ring">
      <rect
        x="1.5"
        y="1.5"
        rx="4"
        pathLength="100"
        stroke-dasharray="100 100"
        [style.animation-duration.ms]="data.total"
        [style.animation-timing-function]="timing"
        [class.held]="data.held()"
      />
    </svg>
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
    /* The ring follows the edge of the snack bar surface (position: relative in styles.css). */
    .toast-ring {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      overflow: visible;
      pointer-events: none;
    }
    .toast-ring rect {
      width: calc(100% - 3px);
      height: calc(100% - 3px);
      fill: none;
      stroke: var(--inverse-primary);
      stroke-width: 3;
      stroke-linecap: round;
      animation-name: toast-ring;
      animation-fill-mode: forwards;
    }
    .toast-ring rect.held {
      animation-play-state: paused;
    }
    @keyframes toast-ring {
      from {
        stroke-dashoffset: 0;
      }
      to {
        stroke-dashoffset: 100;
      }
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
  /** Smooth, or one step a second with prefers-reduced-motion. */
  protected readonly timing = inject(DOCUMENT).defaultView?.matchMedia?.(
    '(prefers-reduced-motion: reduce)',
  ).matches
    ? `steps(${Math.round(this.data.total / 1000)}, end)`
    : 'linear';
}

interface Shown {
  readonly ref: MatSnackBarRef<Toast>;
  readonly hasAction: boolean;
  readonly total: number;
  readonly held: WritableSignal<boolean>;
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
    const total = action ? TOAST_MS.action : TOAST_MS.plain;
    const held = signal(false);
    // Assigned below, once the snack bar has created the toast.
    const created: { ref?: MatSnackBarRef<Toast> } = {};
    const data: ToastData = {
      text: this.transloco.translate(key, params ?? {}),
      action: action ? this.transloco.translate(action.label) : null,
      act: () => {
        if (acted || this.shown?.ref !== created.ref) return;
        acted = true;
        this.dismiss();
        action?.run();
      },
      hold: (holder, on) => this.hold(holder, on),
      close: () => this.dismiss(),
      total,
      held: held.asReadonly(),
    };
    this.placeAboveNavigation();
    const ref = this.snackBar.openFromComponent(Toast, {
      data,
      politeness: 'polite',
      panelClass: 'app-toast',
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
    created.ref = ref;
    const shown: Shown = {
      ref,
      hasAction: !!action,
      total,
      held,
      remaining: total,
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
    shown.held.set(shown.holders.size > 0);
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
