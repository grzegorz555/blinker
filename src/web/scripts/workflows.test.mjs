// Invariants of the GitHub Actions workflows (spec 002 supply chain; spec 003, R6–R8): npm run test:scripts
// Text checks on purpose: no YAML dependency for a handful of rules.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, it } from 'node:test';

const dir = resolve(import.meta.dirname, '..', '..', '..', '.github', 'workflows');
const files = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f));
const read = (name) => readFileSync(join(dir, name), 'utf8').replace(/\r\n/g, '\n');
const ci = read('ci.yml');

/** The text of one job: from "  <id>:" to the next job or the end. */
function job(text, id) {
  const start = text.indexOf(`\n  ${id}:\n`);
  assert.notEqual(start, -1, `job ${id} exists`);
  const next = text.slice(start + 1).search(/\n {2}[a-z][a-z0-9-]*:\n/);
  return next === -1 ? text.slice(start) : text.slice(start, start + 1 + next);
}

const GATES = ['docs', 'secrets', 'vulnerabilities', 'web', 'lighthouse'];

describe('workflows', () => {
  it('pin every action to a full commit SHA', () => {
    for (const file of files) {
      for (const [, ref] of read(file).matchAll(/uses:\s*([^\s#]+)/g)) {
        assert.match(ref, /@[0-9a-f]{40}$/, `${file}: ${ref}`);
      }
    }
  });

  it('default to read-only permissions', () => {
    for (const file of files)
      assert.match(read(file), /\npermissions:\n {2}contents: read\n/, file);
  });

  it('deploy production only on a push to main, after every gate, never cancelled halfway (R8)', () => {
    const production = job(ci, 'deploy-production');
    assert.match(
      production,
      /if: \$\{\{ github\.event_name == 'push' && github\.ref == 'refs\/heads\/main' \}\}/,
    );
    assert.match(production, new RegExp(`needs: \\[${GATES.join(', ')}\\]`));
    assert.match(production, /cancel-in-progress: false/);
    assert.doesNotMatch(production, /pull-requests: write/);
  });

  it('deploy previews only for PRs, after every gate (R7)', () => {
    const preview = job(ci, 'deploy-preview');
    assert.match(preview, /if: \$\{\{ github\.event_name == 'pull_request' \}\}/);
    assert.match(preview, new RegExp(`needs: \\[${GATES.join(', ')}\\]`));
  });

  it('skip every Azure step when the token is missing, instead of failing (R7)', () => {
    for (const [file, ids] of [
      ['ci.yml', ['deploy-preview', 'deploy-production']],
      ['preview-close.yml', ['close']],
    ]) {
      for (const id of ids) {
        const steps = job(read(file), id).split('\n      - ').slice(2); // after the token check
        assert.ok(steps.length > 0, `${file} ${id} has steps`);
        for (const step of steps) {
          assert.match(
            step,
            /if: \$\{\{ steps\.token\.outputs\.available == 'true' \}\}/,
            `${file} ${id}`,
          );
        }
      }
    }
  });

  it('run e2e by hand only: not in the web job, and the E2E workflow has no automatic trigger', () => {
    assert.doesNotMatch(job(ci, 'web'), /playwright|--e2e/);
    const e2e = read('e2e.yml');
    assert.match(e2e, /\non:\n {2}workflow_dispatch:\n\n/);
    assert.match(e2e, /run: npm run e2e\n/);
  });

  it('deploy the build that passed the gates, not a second build (R8)', () => {
    assert.match(job(ci, 'web'), /name: dist\n\s+path: src\/web\/dist\/blinker-web\/browser\//);
    for (const id of ['deploy-preview', 'deploy-production']) {
      const text = job(ci, id);
      assert.match(text, /download-artifact@[0-9a-f]{40}[^\n]*\n\s+with:\n\s+name: dist/);
      assert.doesNotMatch(text, /npm run build/);
      assert.match(text, /skip_app_build: true/);
    }
  });
});
