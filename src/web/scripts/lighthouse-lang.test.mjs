// Tests for the Lighthouse language guard (spec 002, R6): npm run test:scripts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findLanguageProblems, languageTexts, nodeLabels } from './lighthouse-lang.mjs';

const en = {
  app: { name: 'Blinker' },
  nav: { settings: 'Settings' },
  page: { empty: 'No sentences yet.' },
};
const pl = {
  app: { name: 'Blinker' },
  nav: { settings: 'Ustawienia' },
  page: { empty: 'Nie ma jeszcze zdań.' },
};
const texts = languageTexts(en, pl);

/** A minimal Lighthouse result with node labels nested like in the LCP and DOM size audits. */
const lhr = (...labels) => ({
  audits: {
    'largest-contentful-paint-element': {
      details: { items: labels.map((nodeLabel) => ({ node: { type: 'node', nodeLabel } })) },
    },
  },
});

describe('languageTexts', () => {
  it('keeps only texts that differ between the languages and are long enough to identify one', () => {
    assert.deepEqual(texts, {
      en: ['Settings', 'No sentences yet.'],
      pl: ['Ustawienia', 'Nie ma jeszcze zdań.'],
    });
  });
});

describe('nodeLabels', () => {
  it('reads every node label anywhere in the report', () => {
    assert.deepEqual(nodeLabels(lhr('No sentences yet.', ' x ')), ['No sentences yet.', 'x']);
  });
});

describe('findLanguageProblems', () => {
  it('passes when the report shows text of the expected language', () => {
    assert.deepEqual(
      findLanguageProblems([{ name: 'p', lhr: lhr('No sentences yet.') }], 'en', texts),
      [],
    );
    assert.deepEqual(
      findLanguageProblems([{ name: 'p', lhr: lhr('Ustawienia') }], 'pl', texts),
      [],
    );
  });

  it('matches a text with parameters by its fixed start', () => {
    const t = languageTexts(
      { help: 'A JSON file, at most {{size}} columns' },
      { help: 'Plik JSON, najwyżej {{size}} kolumn' },
    );
    assert.deepEqual(t, { en: ['A JSON file, at most'], pl: ['Plik JSON, najwyżej'] });
    assert.deepEqual(
      findLanguageProblems([{ name: 'p', lhr: lhr('Plik JSON, najwyżej 10 ko…') }], 'pl', t),
      [],
    );
  });

  it('recognizes a truncated label', () => {
    const long = { en: ['Blinker is not a medical device. Keep the paper board.'], pl: [] };
    assert.deepEqual(
      findLanguageProblems(
        [{ name: 'p', lhr: lhr('Blinker is not a medical device…') }],
        'en',
        long,
      ),
      [],
    );
  });

  it('fails when the report shows text of the other language', () => {
    assert.deepEqual(
      findLanguageProblems([{ name: 'p', lhr: lhr('Nie ma jeszcze zdań.') }], 'en', texts),
      ['p: expected language "en", got "pl" text'],
    );
  });

  it('fails loudly when no translated text is recorded', () => {
    assert.deepEqual(findLanguageProblems([{ name: 'p', lhr: lhr('Blinker', 'A') }], 'pl', texts), [
      'p: no translated text recorded (language marker not found)',
    ]);
  });

  it('fails when there are no reports', () => {
    assert.deepEqual(findLanguageProblems([], 'pl', texts), ['no Lighthouse reports found']);
  });
});
