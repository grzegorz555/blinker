// A small example of the board format v1, shown on Tablice (Boards) so a helper sees what a file to import looks like.
import type { Board } from './board';
import type { LanguageCode } from '../i18n/languages';

const NAMES: Record<LanguageCode, { name: string; locale: string; yes: string }> = {
  pl: { name: 'Przykład', locale: 'pl-PL', yes: 'TAK' },
  en: { name: 'Example', locale: 'en-GB', yes: 'YES' },
};

/** Three columns, two rows: letters, a word, an empty cell and a space action. Imports as is. */
export function exampleBoard(lang: LanguageCode): Board {
  const { name, locale, yes } = NAMES[lang];
  return {
    schemaVersion: 1,
    id: 'example',
    name,
    locale,
    columns: ['1', '2', '3'],
    rows: ['1', '2'],
    cells: [
      [
        { type: 'char', value: 'A' },
        { type: 'char', value: 'B' },
        { type: 'word', value: yes },
      ],
      [{ type: 'char', value: 'C' }, null, { type: 'action', value: 'space' }],
    ],
  };
}

/** The example as the text of a file: two-space JSON, as people write it by hand. */
export function exampleBoardJson(lang: LanguageCode): string {
  return JSON.stringify(exampleBoard(lang), null, 2) + '\n';
}
