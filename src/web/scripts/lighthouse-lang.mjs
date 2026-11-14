// Guard for Lighthouse CI (spec 002, R6): checks that every report was rendered in the expected language.
// Chrome may ignore the --lang flag on some systems, and then both runs would silently audit the same language.
//
// The marker is the page text. Lighthouse records DOM nodes in its audits (the LCP element, DOM size, and others),
// each with a `nodeLabel`: the element's text. Which nodes it records varies by page, so we look at all of them and
// match their text against the UI translations (public/i18n/en.json and pl.json): a report must show text from the
// expected language and none from the other one. Spec 007 moved the language switch to Ustawienia (Settings), so the
// switch buttons (the earlier marker) are no longer on every page.
// If no translated text is recorded at all, the check fails loudly instead of passing silently.
// Usage: node scripts/lighthouse-lang.mjs <reports dir> <en|pl>
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Every `nodeLabel` string in a Lighthouse result (LHR). */
export function nodeLabels(value, found = []) {
  if (Array.isArray(value)) value.forEach((item) => nodeLabels(item, found));
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (key === 'nodeLabel' && typeof child === 'string') found.push(child.trim());
      else nodeLabels(child, found);
    }
  }
  return found;
}

/** The leaf strings of a translation file. */
function leaves(tree, found = []) {
  for (const value of Object.values(tree)) {
    if (typeof value === 'string') found.push(value);
    else if (value && typeof value === 'object') leaves(value, found);
  }
  return found;
}

/**
 * Texts that identify a language: translations that differ between en and pl, at least 8 characters long (short
 * words like "Blinker" or a letter could be on either page); a text with parameters counts by its fixed start.
 * @param {Record<string, unknown>} en
 * @param {Record<string, unknown>} pl
 */
export function languageTexts(en, pl) {
  // A text with parameters is matched by its fixed start, before the first {{ (if that start is long enough).
  const fixed = (t) => (t.includes('{{') ? t.slice(0, t.indexOf('{{')).trim() : t);
  const pick = (own, other) => {
    const others = new Set(leaves(other).map(fixed));
    return [
      ...new Set(
        leaves(own)
          .map(fixed)
          .filter((t) => t.length >= 8 && !others.has(t)),
      ),
    ];
  };
  return { en: pick(en, pl), pl: pick(pl, en) };
}

/** A recorded label shows a text when it contains it, or when the label is a long prefix of it (truncated). */
const shows = (label, text) =>
  label.includes(text) || (label.length >= 20 && text.startsWith(label.replace(/…$/, '')));

/**
 * @param {{ name: string, lhr: object }[]} reports
 * @param {string} expected 'en' or 'pl'
 * @param {{ en: string[], pl: string[] }} texts from languageTexts()
 * @returns {string[]} problems; empty when every report shows the expected language
 */
export function findLanguageProblems(reports, expected, texts) {
  if (reports.length === 0) return ['no Lighthouse reports found'];
  const other = expected === 'en' ? 'pl' : 'en';
  return reports.flatMap(({ name, lhr }) => {
    const labels = nodeLabels(lhr);
    const found = (lang) => labels.some((label) => texts[lang].some((t) => shows(label, t)));
    if (found(other)) return [`${name}: expected language "${expected}", got "${other}" text`];
    if (!found(expected))
      return [`${name}: no translated text recorded (language marker not found)`];
    return [];
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [dir, expected] = process.argv.slice(2);
  const i18n = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'i18n');
  const read = (lang) => JSON.parse(readFileSync(join(i18n, `${lang}.json`), 'utf8'));
  const texts = languageTexts(read('en'), read('pl'));
  const reports = readdirSync(dir)
    .filter((name) => name.endsWith('.report.json'))
    .map((name) => ({ name, lhr: JSON.parse(readFileSync(join(dir, name), 'utf8')) }));
  const problems = findLanguageProblems(reports, expected, texts);
  if (problems.length) {
    console.error(`Lighthouse language check failed:\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
  console.log(`Lighthouse language check passed: ${reports.length} report(s) in "${expected}"`);
}
