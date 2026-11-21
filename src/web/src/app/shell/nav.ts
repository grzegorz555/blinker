import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * One navigation item; `icon` picks an inline SVG in the template (no icon font, ADR-0005). Each icon is an outline;
 * on the current page it is filled (M3: filled active icon): `.fill` shapes take the icon color, and the `.cutout`
 * details are drawn in the indicator color, so they stay visible on the filled shape.
 */
export interface NavItem {
  readonly path: string;
  readonly label: string;
  readonly icon: 'board' | 'sentences' | 'boards' | 'calibration' | 'settings';
}

/**
 * The same items in the same order on every page (SC 3.2.3). Kalibracja (Calibration) joins in stage 4 (spec 007, R2).
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { path: '/', label: 'nav.counting', icon: 'board' },
  { path: '/sentences', label: 'nav.sentences', icon: 'sentences' },
  { path: '/boards', label: 'nav.boards', icon: 'boards' },
  { path: '/calibration', label: 'nav.calibration', icon: 'calibration' },
  { path: '/settings', label: 'nav.settings', icon: 'settings' },
];

/**
 * The M3 navigation bar (below 600 px) and navigation rail (from 600 px), one component restyled by a media query
 * (spec 007 R2; https://m3.material.io/components/navigation-bar/overview,
 * https://m3.material.io/components/navigation-rail/overview). Angular Material has neither, so it is ours:
 * a <nav> landmark with links; the current page has aria-current="page", the indicator pill and a bolder label, never
 * color alone (SC 1.4.1).
 */
@Component({
  selector: 'app-nav',
  imports: [RouterLink, RouterLinkActive, TranslocoPipe],
  styleUrl: './nav.css',
  template: `
    <nav class="shell-nav" [attr.aria-label]="'nav.label' | transloco">
      <ul>
        @for (item of items; track item.path) {
          <li>
            <a
              class="nav-link"
              [routerLink]="item.path"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: item.path === '/' }"
              ariaCurrentWhenActive="page"
            >
              <span class="nav-indicator">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  @switch (item.icon) {
                    @case ('board') {
                      <svg:rect class="fill" x="3" y="4" width="18" height="16" rx="2" />
                      <svg:path class="cutout" d="M3 9h18M9 4v16M15 4v16" />
                    }
                    @case ('sentences') {
                      <svg:path
                        class="fill"
                        d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z"
                      />
                      <svg:path class="cutout" d="M8.5 10.5h7M8.5 14h4" />
                    }
                    @case ('boards') {
                      <svg:rect class="fill" x="3" y="3" width="7" height="7" rx="1" />
                      <svg:rect class="fill" x="14" y="3" width="7" height="7" rx="1" />
                      <svg:rect class="fill" x="3" y="14" width="7" height="7" rx="1" />
                      <svg:rect class="fill" x="14" y="14" width="7" height="7" rx="1" />
                    }
                    @case ('calibration') {
                      <svg:path class="fill" d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
                      <svg:circle class="cutout-fill" cx="12" cy="12" r="3" />
                    }
                    @case ('settings') {
                      <svg:path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
                      <svg:circle class="fill" cx="15" cy="6" r="2" />
                      <svg:circle class="fill" cx="9" cy="12" r="2" />
                      <svg:circle class="fill" cx="17" cy="18" r="2" />
                    }
                  }
                </svg>
              </span>
              <span class="nav-label">{{ item.label | transloco }}</span>
            </a>
          </li>
        }
      </ul>
    </nav>
  `,
})
export class AppNav {
  protected readonly items = NAV_ITEMS;
}
