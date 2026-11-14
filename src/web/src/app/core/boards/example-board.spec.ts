import { describe, expect, it } from 'vitest';
import { SUPPORTED_LANGUAGES } from '../i18n/languages';
import { exampleBoardJson } from './example-board';
import { validateBoard } from './validate-board';

describe('exampleBoardJson', () => {
  for (const lang of SUPPORTED_LANGUAGES) {
    it(`is a valid board v1 that imports as is (${lang})`, () => {
      const result = validateBoard(exampleBoardJson(lang));
      expect(result.ok).toBe(true);
    });
  }

  it('names the board in the language of the screen', () => {
    expect(JSON.parse(exampleBoardJson('pl')).name).toBe('Przykład');
    expect(JSON.parse(exampleBoardJson('en')).name).toBe('Example');
  });
});
