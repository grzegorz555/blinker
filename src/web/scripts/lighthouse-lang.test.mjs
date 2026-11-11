// Tests for the Lighthouse language guard (spec 002, R6): npm run test:scripts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findLanguageProblems, switchButtons } from './lighthouse-lang.mjs';

const button = (lang, pressed) =>
  `<button type="button" class="inline-flex min-h-11…" lang="${lang}" aria-pressed="${pressed}">`;

/** A minimal Lighthouse result with the snippet nested like in the dom-size-insight audit. */
const lhr = (...snippets) => ({
  audits: {
    'dom-size-insight': {
      details: { items: snippets.map((snippet) => ({ node: { type: 'node', snippet } })) },
    },
  },
});

describe('switchButtons', () => {
  it('reads the language and pressed state of switch buttons anywhere in the report', () => {
    assert.deepEqual(switchButtons(lhr(button('en', true), '<div class="x">')), [
      { lang: 'en', pressed: true },
    ]);
  });

  it('ignores buttons without lang or aria-pressed', () => {
    assert.deepEqual(switchButtons(lhr('<button type="button">', '<p lang="en">')), []);
  });
});

describe('findLanguageProblems', () => {
  it('passes when the expected language button is pressed', () => {
    assert.deepEqual(
      findLanguageProblems([{ name: 'home', lhr: lhr(button('en', true)) }], 'en'),
      [],
    );
  });

  it('passes when only the other language button is recorded, not pressed', () => {
    assert.deepEqual(
      findLanguageProblems([{ name: 'home', lhr: lhr(button('en', false)) }], 'pl'),
      [],
    );
  });

  it('fails when another language is pressed', () => {
    assert.deepEqual(findLanguageProblems([{ name: 'home', lhr: lhr(button('pl', true)) }], 'en'), [
      'home: expected language "en", got "pl"',
    ]);
  });

  it('fails when the expected language button is not pressed', () => {
    assert.deepEqual(findLanguageProblems([{ name: '404', lhr: lhr(button('en', false)) }], 'en'), [
      '404: expected language "en", but its button is not pressed',
    ]);
  });

  it('fails loudly when no marker is recorded', () => {
    assert.deepEqual(findLanguageProblems([{ name: 'home', lhr: lhr('<main>') }], 'pl'), [
      'home: language switch marker not found',
    ]);
  });

  it('fails when there are no reports', () => {
    assert.deepEqual(findLanguageProblems([], 'pl'), ['no Lighthouse reports found']);
  });
});
