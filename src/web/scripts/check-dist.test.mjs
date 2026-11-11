// Tests for check-dist.mjs, run with the built-in Node test runner: npm run test:scripts
// https://nodejs.org/api/test.html
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { findDistProblems } from './check-dist.mjs';

describe('findDistProblems', () => {
  let dir;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'blinker-dist-'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html>');
    writeFileSync(join(dir, 'main-ABC.js'), 'console.log(1);');
    writeFileSync(join(dir, 'styles-XYZ.css'), 'body{}');
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('passes a clean build', () => {
    assert.deepEqual(findDistProblems(dir), []);
  });

  it('reports a source map file, also in a subfolder', () => {
    mkdirSync(join(dir, 'chunks'));
    writeFileSync(join(dir, 'chunks', 'a.js.map'), '{}');
    assert.deepEqual(findDistProblems(dir), ['forbidden file: chunks/a.js.map']);
  });

  it('reports a Markdown file regardless of letter case', () => {
    writeFileSync(join(dir, 'README.MD'), '# notes');
    assert.deepEqual(findDistProblems(dir), ['forbidden file: README.MD']);
  });

  it('reports a sourceMappingURL comment in JS and CSS', () => {
    writeFileSync(join(dir, 'main-ABC.js'), 'x();\n//# sourceMappingURL=main-ABC.js.map');
    writeFileSync(join(dir, 'styles-XYZ.css'), 'body{}\n/*# sourceMappingURL=styles.css.map */');
    assert.deepEqual(findDistProblems(dir).sort(), [
      'sourceMappingURL comment: main-ABC.js',
      'sourceMappingURL comment: styles-XYZ.css',
    ]);
  });

  it('ignores the words in files that are not scripts or styles', () => {
    writeFileSync(join(dir, 'index.html'), '<p>sourceMappingURL=demo</p>');
    assert.deepEqual(findDistProblems(dir), []);
  });

  it('fails when the build folder is missing', () => {
    const problems = findDistProblems(join(dir, 'missing'));
    assert.equal(problems.length, 1);
    assert.match(problems[0], /build folder not found/);
  });
});
