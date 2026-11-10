import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';

/**
 * Route `title` values are translation keys. The document title is translated on every
 * navigation and again when the language changes (spec 001, R3; SC 2.4.2).
 * Docs: https://angular.dev/api/router/TitleStrategy
 */
@Injectable({ providedIn: 'root' })
export class TranslatedTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly transloco = inject(TranslocoService);
  private key: string | undefined;

  constructor() {
    super();
    this.transloco.langChanges$.subscribe(() => this.apply());
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.key = this.buildTitle(snapshot);
    this.apply();
  }

  private apply(): void {
    if (this.key) this.title.setTitle(this.transloco.translate(this.key));
  }
}
