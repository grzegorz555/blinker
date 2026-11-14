import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { translocoTesting } from '../testing/transloco';
import { App } from './app';

@Component({ template: '<p>page</p>' })
class Page {}

describe('App shell (spec 007, R2)', () => {
  async function render() {
    await TestBed.configureTestingModule({
      imports: [App, translocoTesting()],
      providers: [
        provideRouter([
          { path: '', component: Page, data: { heading: 'nav.counting', fit: true } },
          { path: 'settings', component: Page, data: { heading: 'nav.settings' } },
        ]),
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    return { fixture, root, router };
  }

  it('has one banner, one navigation and one main landmark, and no footer', async () => {
    const { root } = await render();
    expect(root.querySelectorAll('header')).toHaveLength(1);
    expect(root.querySelectorAll('nav')).toHaveLength(1);
    expect(root.querySelectorAll('main')).toHaveLength(1);
    expect(root.querySelector('footer')).toBeNull();
  });

  it('shows the route heading as the only h1, and marks a fit page', async () => {
    const { root } = await render();
    expect([...root.querySelectorAll('h1')].map((h) => h.textContent?.trim())).toEqual([
      'Counting',
    ]);
    expect(root.querySelector('.shell')?.classList).toContain('shell-fit');
  });

  it('renders the skip link as the first focusable element, pointing at main', async () => {
    const { root } = await render();
    const firstFocusable = root.querySelector<HTMLElement>('a[href], button, [tabindex="0"]');
    expect(firstFocusable?.getAttribute('href')).toBe('#main');
    expect(root.querySelector('main')?.id).toBe('main');
  });

  it('moves focus to main when the skip link is activated', async () => {
    const { root } = await render();
    document.body.appendChild(root);
    root.querySelector<HTMLAnchorElement>('a[href="#main"]')!.click();
    expect(document.activeElement).toBe(root.querySelector('main'));
    root.remove();
  });

  it('after an in-app navigation, updates the heading and moves focus to it', async () => {
    const { fixture, root, router } = await render();
    document.body.appendChild(root);
    await router.navigateByUrl('/settings');
    await fixture.whenStable();
    const h1 = root.querySelector('h1')!;
    expect(h1.textContent?.trim()).toBe('Settings');
    expect(document.activeElement).toBe(h1);
    expect(root.querySelector('.shell')?.classList).not.toContain('shell-fit');
    root.remove();
  });
});
