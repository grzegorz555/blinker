import { Injectable, signal } from '@angular/core';
import type { Portal } from '@angular/cdk/portal';

/**
 * Actions a page shows in the top app bar ("Pauza" (Pause) on Liczenie (Counting), spec 007 R2).
 * The page declares them in its own template (`<ng-template cdkPortal>`) and registers the portal here; the shell
 * renders it with a CDK portal outlet (https://material.angular.dev/cdk/portal/overview).
 */
@Injectable({ providedIn: 'root' })
export class TopBar {
  readonly actions = signal<Portal<unknown> | null>(null);

  show(portal: Portal<unknown>): void {
    this.actions.set(portal);
  }

  /** Removes the actions, only if they are still the given ones (the next page may have set its own). */
  clear(portal: Portal<unknown>): void {
    if (this.actions() === portal) this.actions.set(null);
  }
}
