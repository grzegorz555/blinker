import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { translocoTesting } from '../../testing/transloco';
import { AppNav, NAV_ITEMS } from './nav';

@Component({ template: '' })
class Page {}

describe('AppNav (spec 007, R2)', () => {
  async function render(url: string) {
    await TestBed.configureTestingModule({
      imports: [AppNav, translocoTesting()],
      providers: [
        provideRouter(NAV_ITEMS.map((i) => ({ path: i.path.slice(1), component: Page }))),
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AppNav);
    await TestBed.inject(Router).navigateByUrl(url);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const links = [...root.querySelectorAll('a')];
    return { root, links };
  }

  it('is a labelled navigation landmark with four links in a fixed order (SC 3.2.3)', async () => {
    const { root, links } = await render('/');
    expect(root.querySelector('nav')?.getAttribute('aria-label')).toBe('Main menu');
    expect(links.map((a) => a.textContent?.trim())).toEqual([
      'Counting',
      'Sentences',
      'Boards',
      'Settings',
    ]);
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/',
      '/sentences',
      '/boards',
      '/settings',
    ]);
  });

  it('marks only the current page with aria-current="page"', async () => {
    const { links } = await render('/boards');
    expect(links.map((a) => a.getAttribute('aria-current'))).toEqual([null, null, 'page', null]);
  });

  it('marks Liczenie (Counting) only on its own exact path', async () => {
    const { links } = await render('/');
    expect(links.map((a) => a.getAttribute('aria-current'))).toEqual(['page', null, null, null]);
  });

  it('hides the icons from assistive technology', async () => {
    const { root } = await render('/');
    const icons = [...root.querySelectorAll('nav > ul svg')];
    expect(icons).toHaveLength(4);
    for (const svg of icons) expect(svg.getAttribute('aria-hidden')).toBe('true');
  });
});
