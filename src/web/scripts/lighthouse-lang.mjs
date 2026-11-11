// Guard for Lighthouse CI (spec 002, R6): checks that every report was rendered in the expected language.
// Chrome may ignore the --lang flag on some systems, and then both runs would silently audit the same language.
// The marker is a button of the language switch, e.g. <button … lang="en" aria-pressed="true">. Lighthouse
// records element snippets in some audits (today: dom-size-insight); which button it records varies, so both
// states count: aria-pressed="true" means "the page is in this language", "false" means "it is not".
// If no switch button is recorded at all, the check fails loudly instead of passing silently.
// Usage: node scripts/lighthouse-lang.mjs <reports dir> <en|pl>
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SWITCH_BUTTON = /<button\b[^>]*\blang="([a-z-]+)"[^>]*\baria-pressed="(true|false)"/i;

/** Collects every `snippet` string in a Lighthouse result (LHR). */
function snippets(value, found = []) {
  if (Array.isArray(value)) value.forEach((item) => snippets(item, found));
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (key === 'snippet' && typeof child === 'string') found.push(child);
      else snippets(child, found);
    }
  }
  return found;
}

/**
 * Reads the language switch buttons recorded in a report.
 * @param {object} lhr a parsed Lighthouse result
 * @returns {{ lang: string, pressed: boolean }[]}
 */
export function switchButtons(lhr) {
  return snippets(lhr).flatMap((snippet) => {
    const match = SWITCH_BUTTON.exec(snippet);
    return match
      ? [{ lang: match[1].toLowerCase(), pressed: match[2].toLowerCase() === 'true' }]
      : [];
  });
}

/**
 * @param {{ name: string, lhr: object }[]} reports
 * @param {string} expected 'en' or 'pl'
 * @returns {string[]} problems; empty when every report shows the expected language
 */
export function findLanguageProblems(reports, expected) {
  if (reports.length === 0) return ['no Lighthouse reports found'];
  return reports.flatMap(({ name, lhr }) => {
    const buttons = switchButtons(lhr);
    if (buttons.length === 0) return [`${name}: language switch marker not found`];
    return buttons.flatMap(({ lang, pressed }) => {
      if (pressed && lang !== expected)
        return [`${name}: expected language "${expected}", got "${lang}"`];
      if (!pressed && lang === expected)
        return [`${name}: expected language "${expected}", but its button is not pressed`];
      return [];
    });
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [dir, expected] = process.argv.slice(2);
  const reports = readdirSync(dir)
    .filter((name) => name.endsWith('.report.json'))
    .map((name) => ({ name, lhr: JSON.parse(readFileSync(join(dir, name), 'utf8')) }));
  const problems = findLanguageProblems(reports, expected);
  if (problems.length) {
    console.error(`Lighthouse language check failed:\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
  console.log(`Lighthouse language check passed: ${reports.length} report(s) in "${expected}"`);
}
