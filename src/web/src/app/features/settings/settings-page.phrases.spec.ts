// Spec 019, T3: the group "Ulubione zwroty" (Favorite phrases) in Ustawienia (Settings) (R1): the switch off by
// default; on, the pause before a suggestion within 1–10 s, an invalid value refused with a text error.
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { memoryStorage } from '../../../testing/memory-storage';
import { translocoTesting } from '../../../testing/transloco';
import { SettingsService } from '../../core/settings/settings.service';
import { STORAGE } from '../../core/storage/local-store';
import { ToastService } from '../../shared/toast/toast';
import { SettingsPage } from './settings-page';

describe('SettingsPage, "Ulubione zwroty" (Favorite phrases) (spec 019, R1)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function render() {
    await TestBed.configureTestingModule({
      imports: [SettingsPage, translocoTesting()],
      providers: [
        provideRouter([]),
        { provide: STORAGE, useValue: memoryStorage() },
        { provide: ToastService, useValue: { show: vi.fn() } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(SettingsPage);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    return { fixture, root, settings: TestBed.inject(SettingsService) };
  }

  it('the switch is off by default and the pause field is not shown', async () => {
    const { root, settings } = await render();
    const toggle = root.querySelector(
      '[data-testid="toggle-suggestPhrases"] button[role="switch"]',
    )!;
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(root.querySelector('[data-testid="phrase-pause"]')).toBeNull();
    expect(settings.settings().suggestPhrases).toBe(false);
  });

  it('on: the pause is shown and saved within 1–10 s; a value outside is not saved', async () => {
    const { fixture, root, settings } = await render();
    root
      .querySelector<HTMLButtonElement>(
        '[data-testid="toggle-suggestPhrases"] button[role="switch"]',
      )!
      .click();
    await fixture.whenStable();
    expect(settings.settings().suggestPhrases).toBe(true);

    const input = root.querySelector<HTMLInputElement>('[data-testid="phrase-pause"]')!;
    expect(input.value).toBe('2500');
    input.value = '4000';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(settings.settings().phrasePauseMs).toBe(4000);

    input.value = '20000';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(settings.settings().phrasePauseMs).toBe(4000);
    expect(root.textContent).toContain('enter a whole number from 1000 to 10000 ms');
  });
});
