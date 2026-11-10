import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { translocoTesting } from '../testing/transloco';
import { App } from './app';

describe('App shell', () => {
  async function render(): Promise<HTMLElement> {
    await TestBed.configureTestingModule({
      imports: [App, translocoTesting()],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('has exactly one header, main and footer landmark (R6)', async () => {
    const root = await render();
    expect(root.querySelectorAll('header')).toHaveLength(1);
    expect(root.querySelectorAll('main')).toHaveLength(1);
    expect(root.querySelectorAll('footer')).toHaveLength(1);
  });

  it('renders the skip link as the first focusable element, pointing at main (R5)', async () => {
    const root = await render();
    const firstFocusable = root.querySelector<HTMLElement>('a[href], button, [tabindex="0"]');
    expect(firstFocusable?.getAttribute('href')).toBe('#main');
    expect(root.querySelector('main')?.id).toBe('main');
  });

  it('moves focus to main when the skip link is activated (R5)', async () => {
    const root = await render();
    document.body.appendChild(root);
    root.querySelector<HTMLAnchorElement>('a[href="#main"]')!.click();
    expect(document.activeElement).toBe(root.querySelector('main'));
    root.remove();
  });

  it('shows the not-a-medical-device disclaimer in the footer', async () => {
    const root = await render();
    expect(root.querySelector('footer')?.textContent).toContain('not a medical device');
  });
});
