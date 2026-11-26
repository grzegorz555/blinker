// Spec 019: favorite phrases. The validator and the matcher (pure), then the service (store, undo, order, wiring).
import { TestBed } from '@angular/core/testing';
import { memoryStorage } from '../../../testing/memory-storage';
import { translocoTesting } from '../../../testing/transloco';
import { CountingService, SPEAKER, TICK_SCHEDULER } from '../counting/counting.service';
import { SettingsService } from '../settings/settings.service';
import { FakeSpeaker } from '../speech/fake-speaker';
import { STORAGE } from '../storage/local-store';
import {
  PHRASES_KEY,
  checkPhrase,
  matchPhrase,
  phraseForSentence,
  validatePhrases,
} from './phrases';
import { PhrasesService } from './phrases.service';

const LIST = ['Pić', 'Pić herbatę', 'Zmień pozycję'];

describe('checkPhrase (R2)', () => {
  it('keeps a phrase trimmed, in NFC, with runs of spaces as one', () => {
    expect(checkPhrase('  Zmień   pozycję ', [])).toEqual({ ok: true, phrase: 'Zmień pozycję' });
    // Z with a combining dot is one letter after NFC: still too short.
    expect(checkPhrase('Z\u0307', [])).toEqual({ ok: false, error: 'too-short' });
    // A line break or a tab becomes a space, like any run of spaces.
    expect(checkPhrase('Boli\nmnie', [])).toEqual({ ok: true, phrase: 'Boli mnie' });
    expect(checkPhrase('Boli\tmnie', [])).toEqual({ ok: true, phrase: 'Boli mnie' });
  });

  it('refuses too short, too long, other characters, a duplicate, a 21st phrase', () => {
    expect(checkPhrase('a', [])).toEqual({ ok: false, error: 'too-short' });
    expect(checkPhrase('a'.repeat(61), [])).toEqual({ ok: false, error: 'too-long' });
    expect(checkPhrase('a'.repeat(60), [])).toMatchObject({ ok: true });
    for (const bad of ['<b>pić</b>', 'pić;', 'null\u0000byte', 'emoji 🙂', 'a"b']) {
      expect(checkPhrase(bad, []), bad).toEqual({ ok: false, error: 'characters' });
    }
    expect(checkPhrase("Nie wiem, czy tak! Co? Tak-nie 'raz'.", [])).toMatchObject({ ok: true });
    // Compared as the match compares: case, punctuation and spaces do not make a new phrase.
    expect(checkPhrase('ZMIEŃ  POZYCJĘ!', LIST)).toEqual({ ok: false, error: 'duplicate' });
    const full = Array.from({ length: 20 }, (_, i) => `zwrot ${i}`);
    expect(checkPhrase('nowy', full)).toEqual({ ok: false, error: 'full' });
  });
});

describe('validatePhrases (R9)', () => {
  it('takes a good list', () => {
    expect(validatePhrases(LIST)).toEqual(LIST);
    expect(validatePhrases([])).toEqual([]);
  });

  it('refuses anything else, whole', () => {
    for (const bad of [
      null,
      'Pić',
      { 0: 'Pić' },
      [1],
      ['Pić', 'pić'],
      [' Pić'],
      ['<script>'],
      Array.from({ length: 21 }, (_, i) => `zwrot ${i}`),
    ]) {
      expect(validatePhrases(bad), JSON.stringify(bad)).toBeNull();
    }
  });
});

describe('matchPhrase (R3)', () => {
  it('the whole text from its start fits exactly one phrase', () => {
    expect(matchPhrase('ZM', LIST, 'pl')).toBe('Zmień pozycję');
    expect(matchPhrase('ZMIEN P', LIST, 'pl')).toBe('Zmień pozycję'); // a plain N for Ń
    expect(matchPhrase('PIC H', LIST, 'pl')).toBe('Pić herbatę'); // a plain C for Ć
    expect(matchPhrase('PIĆ ', LIST, 'pl-PL')).toBe('Pić herbatę');
  });

  it('nothing for one letter, two that fit, a phrase only 1 letter longer, or a word in the middle', () => {
    expect(matchPhrase('Z', LIST, 'pl')).toBeNull();
    expect(matchPhrase('PI', LIST, 'pl')).toBeNull(); // "Pić" and "Pić herbatę"
    expect(matchPhrase('PIĆ', LIST, 'pl')).toBeNull();
    expect(matchPhrase('ZMIEŃ POZYCJ', LIST, 'pl')).toBeNull(); // saves only one letter
    expect(matchPhrase('A ZM', LIST, 'pl')).toBeNull(); // only from the start of the sentence
    expect(matchPhrase('', LIST, 'pl')).toBeNull();
  });

  it('a Polish letter he spelled matches only itself; an English board has no table', () => {
    expect(matchPhrase('ŻM', LIST, 'pl')).toBeNull();
    expect(matchPhrase('PIC H', LIST, 'en')).toBeNull();
    expect(matchPhrase('PIĆ H', LIST, 'en')).toBe('Pić herbatę');
  });

  it('refused phrases are left out, in any case', () => {
    expect(matchPhrase('PIĆ ', LIST, 'pl', ['PIĆ HERBATĘ'])).toBeNull();
    expect(matchPhrase('PI', LIST, 'pl', ['pić'])).toBe('Pić herbatę');
  });

  it('the same input always gives the same result', () => {
    expect(matchPhrase('ZM', LIST, 'pl')).toBe(matchPhrase('ZM', [...LIST], 'pl'));
  });

  it('the phrase goes into the sentence in upper case', () => {
    expect(phraseForSentence('Zmień pozycję', 'pl')).toBe('ZMIEŃ POZYCJĘ');
  });
});

describe('PhrasesService', () => {
  afterEach(() => TestBed.resetTestingModule());

  function setup(stored?: string) {
    const storage = memoryStorage(
      stored === undefined ? new Map() : new Map([[PHRASES_KEY, stored]]),
    );
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [
        { provide: STORAGE, useValue: storage },
        { provide: SPEAKER, useValue: new FakeSpeaker() },
        { provide: TICK_SCHEDULER, useValue: { every: () => () => undefined } },
      ],
    });
    const phrases = TestBed.inject(PhrasesService);
    TestBed.tick();
    return {
      storage,
      phrases,
      settings: TestBed.inject(SettingsService),
      counting: TestBed.inject(CountingService),
    };
  }

  it('adds, saves, and says why a phrase is refused', () => {
    const s = setup();
    expect(s.phrases.add(' Pić ')).toBeNull();
    expect(s.phrases.add('pić')).toBe('duplicate');
    expect(s.phrases.add('x')).toBe('too-short');
    expect(s.phrases.phrases()).toEqual(['Pić']);
    expect(JSON.parse(s.storage.data.get(PHRASES_KEY)!)).toEqual(['Pić']);
    expect(s.phrases.has('PIĆ')).toBe(true);
  });

  it('deletes and puts back in the same place, once', () => {
    const s = setup(JSON.stringify(LIST));
    const removed = s.phrases.remove(1)!;
    expect(s.phrases.phrases()).toEqual(['Pić', 'Zmień pozycję']);
    expect(s.phrases.restore(removed)).toBe(true);
    expect(s.phrases.phrases()).toEqual(LIST);
    expect(s.phrases.restore(removed)).toBe(false);
    expect(s.phrases.remove(9)).toBeNull();
  });

  it('moves up and down, not past the ends', () => {
    const s = setup(JSON.stringify(LIST));
    expect(s.phrases.move(2, -1)).toBe(true);
    expect(s.phrases.phrases()).toEqual(['Pić', 'Zmień pozycję', 'Pić herbatę']);
    expect(s.phrases.move(0, -1)).toBe(false);
    expect(s.phrases.move(2, 1)).toBe(false);
    expect(JSON.parse(s.storage.data.get(PHRASES_KEY)!)[1]).toBe('Zmień pozycję');
  });

  it('a bad store is ignored and not overwritten until a caregiver saves the list (R9)', () => {
    const s = setup('["<b>"]');
    expect(s.phrases.phrases()).toEqual([]);
    expect(s.phrases.problem()).toBe('corrupted');
    expect(s.storage.data.get(PHRASES_KEY)).toBe('["<b>"]');
  });

  it('gives the counting machine the list only while the switch is on (R1)', () => {
    const s = setup(JSON.stringify(LIST));
    expect(s.counting.config().phrases).toEqual([]);
    s.settings.update({ suggestPhrases: true, phrasePauseMs: 4000 });
    TestBed.tick();
    expect(s.counting.config().phrases).toEqual(LIST);
    expect(s.counting.config().phrasePauseMs).toBe(4000);
    s.settings.update({ suggestPhrases: false });
    TestBed.tick();
    expect(s.counting.config().phrases).toEqual([]);
  });

  it('reset empties the list and removes the key', () => {
    const s = setup(JSON.stringify(LIST));
    s.phrases.reset();
    expect(s.phrases.phrases()).toEqual([]);
    expect(s.storage.data.has(PHRASES_KEY)).toBe(false);
  });
});
