import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { Router, TitleStrategy, provideRouter } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { translocoTesting } from '../../../testing/transloco';
import { TranslatedTitleStrategy } from './translated-title-strategy';

@Component({ template: '' })
class Blank {}

describe('TranslatedTitleStrategy (spec 001, R3)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [
        provideRouter([{ path: 'missing', title: 'titles.notFound', component: Blank }]),
        { provide: TitleStrategy, useClass: TranslatedTitleStrategy },
      ],
    });
  });

  it('translates the route title key on navigation', async () => {
    await TestBed.inject(Router).navigateByUrl('/missing');
    expect(TestBed.inject(Title).getTitle()).toBe('Page not found · Blinker');
  });

  it('re-translates the current title when the language changes', async () => {
    await TestBed.inject(Router).navigateByUrl('/missing');
    TestBed.inject(TranslocoService).setActiveLang('pl');
    expect(TestBed.inject(Title).getTitle()).toBe('Nie znaleziono strony · Blinker');
  });
});
