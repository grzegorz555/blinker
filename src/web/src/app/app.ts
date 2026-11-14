import { CdkPortalOutlet } from '@angular/cdk/portal';
import { Component, ElementRef, Injector, afterNextRender, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter, map } from 'rxjs';
import { SettingsService } from './core/settings/settings.service';
import { AppNav } from './shell/nav';
import { TopBar } from './shell/top-bar';

/** What a route tells the shell (app.routes.ts). */
export interface ShellData {
  /** Transloco key of the page heading, shown in the top app bar as the only <h1>. */
  readonly heading: string;
  /** The page must fit the viewport without scrolling (Liczenie (Counting), spec 007 R4). */
  readonly fit?: boolean;
}

function deepest(snapshot: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
  return snapshot.firstChild ? deepest(snapshot.firstChild) : snapshot;
}

/**
 * Application shell (spec 007 R2): skip link, the top app bar with the page heading, main, and the navigation bar or
 * rail. Landmarks: https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/
 * Skip link (SC 2.4.1): https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html
 */
@Component({
  imports: [RouterOutlet, TranslocoPipe, AppNav, CdkPortalOutlet],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');
  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');
  private navigations = 0;

  private readonly data = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => {
        this.afterNavigation();
        return deepest(this.router.routerState.snapshot.root).data as Partial<ShellData>;
      }),
    ),
    { initialValue: {} as Partial<ShellData> },
  );

  protected readonly headingKey = () => this.data().heading ?? 'app.name';
  protected readonly fit = () => this.data().fit === true;
  protected readonly actions = inject(TopBar).actions;
  /** Reads the stored settings at start, so the theme applies on every page (spec 007, R9). */
  private readonly settings = inject(SettingsService);

  /** Moves focus to <main>, so the next Tab continues inside the page content. */
  protected skipToMain(event: Event): void {
    event.preventDefault();
    this.main().nativeElement.focus();
  }

  /**
   * After an in-app navigation, focus moves to the new page heading, so a screen reader announces the page and the
   * next Tab starts at the top of it. Not on the first load: the browser starts at the top anyway.
   */
  private afterNavigation(): void {
    if (this.navigations++ === 0) return;
    afterNextRender(() => this.heading().nativeElement.focus({ preventScroll: true }), {
      injector: this.injector,
    });
  }
}
