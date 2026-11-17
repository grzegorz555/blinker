import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseIgnores, findBlocking } from './audit.mjs';

const advisory = (name, severity, ghsa) => ({
  source: 1,
  name,
  severity,
  url: `https://github.com/advisories/${ghsa}`,
});
const report = (...vias) => ({
  vulnerabilities: Object.fromEntries(
    vias.map((v) => [v.name, { severity: v.severity, via: [v] }]),
  ),
});
const now = new Date('2026-11-17T00:00:00Z');

describe('parseIgnores', () => {
  test('reads id, date and reason of every entry', () => {
    const text = `[[IgnoredVulns]]\nid = "GHSA-aaaa"\nignoreUntil = 2026-12-31T00:00:00Z\nreason = "why"\n`;
    assert.deepEqual(parseIgnores(text), [
      { id: 'GHSA-aaaa', until: new Date('2026-12-31T00:00:00Z'), reason: 'why' },
    ]);
  });

  test('refuses an exception without a reason or a date (negative test)', () => {
    assert.throws(() =>
      parseIgnores(`[[IgnoredVulns]]\nid = "GHSA-aaaa"\nignoreUntil = 2026-12-31T00:00:00Z\n`),
    );
    assert.throws(() => parseIgnores(`[[IgnoredVulns]]\nid = "GHSA-aaaa"\nreason = "why"\n`));
  });

  test("the repo's file parses and every exception has an expiry", () => {
    const text = readFileSync(resolve(import.meta.dirname, '..', 'osv-scanner.toml'), 'utf8');
    for (const entry of parseIgnores(text)) assert.ok(entry.until.getTime() > 0, entry.id);
  });
});

describe('findBlocking', () => {
  const ignores = [{ id: 'GHSA-listed', until: new Date('2026-12-31T00:00:00Z') }];

  test('high and critical block; moderate and low do not', () => {
    const r = report(
      advisory('a', 'high', 'GHSA-1'),
      advisory('b', 'critical', 'GHSA-2'),
      advisory('c', 'moderate', 'GHSA-3'),
    );
    assert.deepEqual(findBlocking(r, [], now).blocking, ['a high GHSA-1', 'b critical GHSA-2']);
  });

  test('a listed advisory is ignored while its date has not passed', () => {
    const r = report(advisory('picomatch', 'high', 'GHSA-listed'));
    assert.deepEqual(findBlocking(r, ignores, now), {
      blocking: [],
      ignored: ['picomatch high GHSA-listed'],
    });
  });

  test('blocks again after ignoreUntil (negative test)', () => {
    const r = report(advisory('picomatch', 'high', 'GHSA-listed'));
    assert.deepEqual(findBlocking(r, ignores, new Date('2027-01-01T00:00:00Z')).blocking, [
      'picomatch high GHSA-listed',
    ]);
  });

  test('an exception covers only its own id', () => {
    const r = report(advisory('other', 'high', 'GHSA-other'));
    assert.deepEqual(findBlocking(r, ignores, now).blocking, ['other high GHSA-other']);
  });

  test('fails loudly when npm audit gave no report', () => {
    assert.throws(() => findBlocking({ error: { code: 'ENOTFOUND' } }, [], now));
  });
});
