import { en, pl } from '../../../testing/transloco';

interface Tree {
  [key: string]: string | Tree;
}

function keys(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : keys(value, `${prefix}${key}.`),
  );
}

describe('translation files (spec 001, R1)', () => {
  it('en and pl define exactly the same keys', () => {
    expect(keys(pl).sort()).toEqual(keys(en).sort());
  });

  it('no translation is empty', () => {
    for (const [lang, tree] of Object.entries({ en, pl })) {
      const empty = keys(tree).filter(
        (k) => k.split('.').reduce<unknown>((node, part) => (node as Tree)[part], tree) === '',
      );
      expect(empty, `empty keys in ${lang}.json`).toEqual([]);
    }
  });
});
