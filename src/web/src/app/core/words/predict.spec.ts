import { describe, expect, it } from 'vitest';
import { createPredictor, prefixOf, type UserWord } from './predict';

// A small list in rank order. "żółw" (tortoise) is 4 letters, so "ZOL" (3) is only 1 short of it: the length rule of
// R5 needs "żółwie" (tortoises) for the prefix examples of R4.
const LIST = [
  'nie',
  'tak',
  'żółw',
  'żółwie',
  'zostać',
  'dziękuję',
  'dobrze',
  'dobry',
  'dobranoc',
  'dobrego',
  'szkoła',
  'chcę',
  'ze',
  'ząb',
  'zab',
];
const p = createPredictor(LIST);
const suggest = (text: string, myWords: UserWord[] = [], refused: string[] = []): string[] =>
  p.suggest({ text, myWords, refused });
const mine = (word: string, count: number, lastUsed: number): UserWord => ({
  word,
  count,
  lastUsed,
});
const cp = (...codes: number[]): string => String.fromCodePoint(...codes);

describe('prefixOf (R4)', () => {
  it('is the text after the last space, in upper case', () => {
    expect(prefixOf('KOT DOB')).toEqual(['D', 'O', 'B']);
    expect(prefixOf('dob')).toEqual(['D', 'O', 'B']);
  });
  it('needs 2 or more letters', () => {
    expect(prefixOf('')).toBeNull();
    expect(prefixOf('D')).toBeNull();
    expect(prefixOf('KOT D')).toBeNull();
    expect(prefixOf('DO')).toEqual(['D', 'O']);
  });
  it('is nothing right after a space', () => {
    expect(prefixOf('DOB ')).toBeNull();
  });
  it('is nothing when the tail is not only letters', () => {
    expect(prefixOf('A1')).toBeNull();
    expect(prefixOf('DOB.')).toBeNull();
  });
  it('treats a digraph cell as two letters', () => {
    expect(prefixOf('SZ')).toEqual(['S', 'Z']);
    expect(prefixOf('CZ')).toEqual(['C', 'Z']);
  });
  it('normalizes NFD to NFC, so a Polish letter is one letter', () => {
    const nfd = cp(0x5a, 0x307, 0x4f, 0x301); // Z + dot above, O + acute
    expect(nfd.length).toBe(4);
    expect(prefixOf(nfd)).toEqual(['Ż', 'Ó']);
  });
  it('upper-cases in Polish', () => {
    expect(prefixOf('żółw')).toEqual(['Ż', 'Ó', 'Ł', 'W']);
  });
});

describe('suggest: the one-way match (R4)', () => {
  it('"ZOL", "ŻOL" and "ŻÓŁ" all give "żółwie" (tortoises)', () => {
    expect(suggest('ZOL')).toEqual(['żółwie']);
    expect(suggest('ŻOL')).toEqual(['żółwie']);
    expect(suggest('ŻÓŁ')).toEqual(['żółwie']);
    expect(suggest('zol')).toEqual(['żółwie']);
  });

  it('a Polish letter he spelled matches only itself: "ŻO" does not give "zostać" (to stay)', () => {
    expect(suggest('ŻO')).toEqual(['żółw', 'żółwie']);
    expect(suggest('ZO')).toEqual(['żółw', 'żółwie', 'zostać']);
  });

  it('a plain letter stands for each Polish letter of the table', () => {
    const one = (word: string, text: string): string[] => createPredictor([word]).suggest({ text });
    expect(one('ąbcd', 'AB')).toEqual(['ąbcd']);
    expect(one('ćbcd', 'CB')).toEqual(['ćbcd']);
    expect(one('ębcd', 'EB')).toEqual(['ębcd']);
    expect(one('łbcd', 'LB')).toEqual(['łbcd']);
    expect(one('ńbcd', 'NB')).toEqual(['ńbcd']);
    expect(one('óbcd', 'OB')).toEqual(['óbcd']);
    expect(one('śbcd', 'SB')).toEqual(['śbcd']);
    expect(one('źbcd', 'ZB')).toEqual(['źbcd']);
    expect(one('żbcd', 'ZB')).toEqual(['żbcd']);
  });

  it('a letter outside the table stands only for itself', () => {
    expect(createPredictor(['bbcd']).suggest({ text: 'AB' })).toEqual([]);
    expect(createPredictor(['ąbcd']).suggest({ text: 'BB' })).toEqual([]);
  });

  it('is not symmetric: a Polish prefix letter does not match the plain letter of a word', () => {
    expect(createPredictor(['zabawa']).suggest({ text: 'ŻA' })).toEqual([]);
    expect(createPredictor(['zabawa']).suggest({ text: 'ZA' })).toEqual(['zabawa']);
  });

  it('works with a digraph prefix "SZ"', () => {
    expect(suggest('SZ')).toEqual(['szkoła']);
  });

  it('gives nothing for an unrelated prefix', () => {
    expect(suggest('XY')).toEqual([]);
    expect(suggest('DX')).toEqual([]);
  });

  it('accepts NFD input as the same letters', () => {
    expect(suggest(cp(0x5a, 0x307, 0x4f, 0x301, 0x4c))).toEqual(['żółwie']); // Ż Ó L
    expect(suggest(cp(0x5a, 0x4f, 0x301))).toEqual(['żółw', 'żółwie']); // Z Ó: Z stands for Ż, Ó is Ó
    expect(suggest(cp(0x5a, 0x307, 0x4f))).toEqual(['żółw', 'żółwie']); // Ż then a plain O stands for Ó
  });
});

describe('suggest: prefix and length rules (R4, R5)', () => {
  it('gives nothing for an empty, 1-letter or space-ended prefix', () => {
    expect(suggest('')).toEqual([]);
    expect(suggest('D')).toEqual([]);
    expect(suggest('NIE D')).toEqual([]);
    expect(suggest('DOB ')).toEqual([]);
  });

  it('uses only the text after the last space', () => {
    expect(suggest('TAK DZI')).toEqual(['dziękuję']);
  });

  it('offers only words at least 2 letters longer than the prefix', () => {
    expect(suggest('DOBR')).toEqual(['dobrze', 'dobranoc', 'dobrego']); // "dobry" is only 1 longer
    expect(suggest('DOBRY')).toEqual([]); // the same length
    expect(suggest('DOBRZ')).toEqual([]); // "dobrze" is only 1 longer
    expect(suggest('NI')).toEqual([]); // "nie" is only 1 longer
    expect(suggest('ZE')).toEqual([]); // "ze" is not longer at all
    expect(suggest('ZOL')).not.toContain('żółw'); // only 1 longer
    expect(suggest('DOB')).toContain('dobry'); // 2 longer
  });
});

describe('suggest: candidates and their order (R5)', () => {
  it('returns the list words by rank, at most 3', () => {
    expect(suggest('DO')).toEqual(['dobrze', 'dobry', 'dobranoc']);
  });

  it('puts his own words first (count desc), then the list', () => {
    const my = [mine('dobranocka', 2, 5), mine('dobroć', 9, 1)];
    expect(suggest('DOB', my)).toEqual(['dobroć', 'dobranocka', 'dobrze']);
  });

  it('breaks a count tie by the latest use', () => {
    const my = [mine('dobry', 3, 10), mine('dobroć', 3, 20)];
    expect(suggest('DOB', my)).toEqual(['dobroć', 'dobry', 'dobrze']);
  });

  it('breaks a full tie by the word itself, whatever the input order', () => {
    const a = [mine('dobroć', 3, 10), mine('dobier', 3, 10), mine('dobrota', 3, 10)];
    const b = [...a].reverse();
    expect(suggest('DOB', a)).toEqual(['dobier', 'dobrota', 'dobroć']); // code-unit order: ć (U+0107) after t
    expect(suggest('DOB', b)).toEqual(['dobier', 'dobrota', 'dobroć']); // code-unit order: ć (U+0107) after t
  });

  it('shows a word that is in both once, as his', () => {
    expect(suggest('DOB', [mine('dobry', 1, 1)])).toEqual(['dobry', 'dobrze', 'dobranoc']);
    expect(suggest('DOB', [mine('DOBRY', 1, 1)])).toEqual(['dobry', 'dobrze', 'dobranoc']);
  });

  it('compares his word and the list word in one normalized form (NFD)', () => {
    const nfdWord = cp(0x7a, 0x307, 0x6f, 0x301) + 'łwie'; // "żółwie" with combining marks
    expect(nfdWord).not.toBe('żółwie');
    expect(suggest('ZOL', [mine(nfdWord, 1, 1)])).toEqual(['żółwie']);
  });

  it('his word also follows the one-way match and the length rule', () => {
    expect(suggest('ŻO', [mine('żółć', 5, 1)])).toEqual(['żółć', 'żółw', 'żółwie']);
    expect(suggest('ZOL', [mine('żółty', 5, 1)])).toEqual(['żółty', 'żółwie']);
    expect(suggest('ŻOL', [mine('zółty', 5, 1)])).toEqual(['żółwie']); // a plain Z in his word is not a spelled Ż
    expect(suggest('DOBR', [mine('dobry', 5, 1)])).not.toContain('dobry'); // only 1 longer
  });

  it('leaves out refused words, in any case, and the next one takes the place', () => {
    expect(suggest('DO', [], ['dobrze'])).toEqual(['dobry', 'dobranoc', 'dobrego']);
    expect(suggest('DO', [], ['DOBRZE', 'Dobry'])).toEqual(['dobranoc', 'dobrego']);
    expect(suggest('ZOL', [], ['żółwie'])).toEqual([]);
  });

  it('leaves out a refused word of his, and its list twin', () => {
    expect(suggest('DOB', [mine('dobry', 9, 9)], ['dobry'])).toEqual([
      'dobrze',
      'dobranoc',
      'dobrego',
    ]);
  });

  it('gives at most 3 even with many matches and many of his words', () => {
    const my = ['dobrota', 'dobrobyt', 'dobroć', 'dobrawa'].map((w, i) => mine(w, i + 1, i));
    expect(suggest('DOB', my)).toHaveLength(3);
    expect(suggest('DO')).toHaveLength(3);
  });

  it('gives the same result on every call and does not change its inputs', () => {
    const my = [mine('dobroć', 2, 3), mine('dobrota', 2, 3)];
    const copy = JSON.stringify(my);
    const first = suggest('DOB', my, ['dobry']);
    for (let i = 0; i < 5; i++) expect(suggest('DOB', my, ['dobry'])).toEqual(first);
    expect(JSON.stringify(my)).toBe(copy);
  });

  it('works without the list (only his words)', () => {
    const empty = createPredictor([]);
    expect(empty.suggest({ text: 'DOB', myWords: [mine('dobroć', 1, 1)] })).toEqual(['dobroć']);
    expect(empty.suggest({ text: 'DOB' })).toEqual([]);
  });
});

describe('listSpelling (R9)', () => {
  it('counts "ZOLW" for the list spelling "żółw" (tortoise)', () => {
    expect(p.listSpelling('ZOLW')).toBe('żółw');
    expect(p.listSpelling('zolw')).toBe('żółw');
  });

  it('keeps an exact spelling: "ZE" stays "ze" because it is in the list', () => {
    expect(p.listSpelling('ZE')).toBe('ze');
    expect(p.listSpelling('ZĄB')).toBe('ząb');
    expect(p.listSpelling('ZAB')).toBe('zab'); // exact beats the better-ranked Polish twin "ząb"
  });

  it('takes the best-ranked list word when only Polish twins match', () => {
    expect(createPredictor(['łóżko']).listSpelling('LOZKO')).toBe('łóżko');
    expect(createPredictor(['łóżko', 'lóżko']).listSpelling('LOZKO')).toBe('łóżko');
    expect(createPredictor(['lóżko', 'łóżko']).listSpelling('LOZKO')).toBe('lóżko');
  });

  it('needs an equal length: a longer list word does not count', () => {
    expect(p.listSpelling('ZOL')).toBe('zol');
  });

  it('keeps a word that is not in the list as spelled, lowercase NFC', () => {
    expect(p.listSpelling('KWAZAR')).toBe('kwazar');
    expect(p.listSpelling('ŻÓŁ')).toBe('żół');
  });
});

describe('performance sanity (no timing assertion)', () => {
  it('handles a 20,000-word list on every letter', () => {
    const big = Array.from({ length: 20_000 }, (_, i) => `abc${i.toString(36).padStart(5, 'x')}`);
    const q = createPredictor(big);
    expect(q.suggest({ text: 'ZZ' })).toEqual([]); // no match: a full scan
    expect(q.suggest({ text: 'AB' })).toHaveLength(3);
  });
});
