import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { translocoTesting } from '../../../testing/transloco';
import { LanguageService } from './language.service';
import { LANGUAGE_STORAGE_KEY } from './languages';

describe('LanguageService (spec 001, R2–R3)', () => {
  let service: LanguageService;
  let transloco: TranslocoService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [translocoTesting()] });
    service = TestBed.inject(LanguageService);
    transloco = TestBed.inject(TranslocoService);
  });

  afterEach(() => vi.restoreAllMocks());

  it('starts with the saved language', async () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'pl');
    await service.init();
    expect(service.language()).toBe('pl');
    expect(transloco.getActiveLang()).toBe('pl');
    expect(document.documentElement.lang).toBe('pl');
  });

  it('starts with the browser language when nothing is saved', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-GB']);
    await service.init();
    expect(service.language()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('does not save anything on start (only an explicit choice is persisted)', async () => {
    await service.init();
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
  });

  it('setLanguage switches Transloco, <html lang> and persists the choice', async () => {
    await service.setLanguage('pl');
    expect(transloco.getActiveLang()).toBe('pl');
    expect(document.documentElement.lang).toBe('pl');
    expect(service.language()).toBe('pl');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('pl');
  });

  it('keeps working when localStorage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE']);

    await service.init();
    expect(service.language()).toBe('pl');
    await expect(service.setLanguage('en')).resolves.toBeUndefined();
    expect(service.language()).toBe('en');
  });
});
