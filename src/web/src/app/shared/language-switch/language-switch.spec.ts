import { TestBed } from '@angular/core/testing';
import { translocoTesting } from '../../../testing/transloco';
import { LanguageService } from '../../core/i18n/language.service';
import { LanguageSwitch } from './language-switch';

describe('LanguageSwitch (spec 001, R4)', () => {
  async function render() {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LanguageSwitch, translocoTesting()],
    }).compileComponents();
    const service = TestBed.inject(LanguageService);
    await service.setLanguage('en');
    const fixture = TestBed.createComponent(LanguageSwitch);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const button = (name: string) =>
      [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === name)!;
    return { fixture, root, service, button };
  }

  it('shows each language by its own name, with its own lang attribute', async () => {
    const { button } = await render();
    expect(button('English').getAttribute('lang')).toBe('en');
    expect(button('Polski').getAttribute('lang')).toBe('pl');
  });

  it('marks only the current language as pressed', async () => {
    const { button } = await render();
    expect(button('English').getAttribute('aria-pressed')).toBe('true');
    expect(button('Polski').getAttribute('aria-pressed')).toBe('false');
  });

  it('is a labelled group', async () => {
    const { root } = await render();
    expect(root.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe('Language');
  });

  it('switches the language on click and updates the pressed state', async () => {
    const { fixture, service, button } = await render();
    button('Polski').click();
    await fixture.whenStable();
    expect(service.language()).toBe('pl');
    expect(button('Polski').getAttribute('aria-pressed')).toBe('true');
    expect(button('English').getAttribute('aria-pressed')).toBe('false');
  });

  it('does nothing when the current language is clicked again', async () => {
    const { service, button } = await render();
    const spy = vi.spyOn(service, 'setLanguage');
    button('English').click();
    expect(spy).not.toHaveBeenCalled();
  });
});
