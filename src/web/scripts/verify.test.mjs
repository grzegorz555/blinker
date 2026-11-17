// Tests for the gate selection in verify.mjs (spec 002 R1, spec 005): npm run test:scripts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { planGates } from './verify.mjs';

const running = (args) =>
  planGates(args)
    .filter((g) => !g.skipReason)
    .map((g) => g.name);

describe('planGates', () => {
  it('runs every gate except e2e and Lighthouse by default, in CI order', () => {
    const names = running([]);
    assert.equal(names.length, 10);
    assert.equal(names[0], 'docs (OKF)');
    assert.equal(names.at(-1), 'mock-ups build (spec 004)');
    assert.ok(!names.includes('e2e (Playwright + axe)'));
    assert.ok(!names.includes('Lighthouse (a11y = 100)'));
    const e2e = planGates([]).find((g) => g.name === 'e2e (Playwright + axe)');
    assert.equal(e2e.skipReason, 'skipped (by hand: --e2e or npm run e2e)');
  });

  it('adds e2e last with --e2e, and both e2e and Lighthouse when asked', () => {
    assert.equal(running(['--e2e']).at(-1), 'e2e (Playwright + axe)');
    assert.deepEqual(running(['--e2e', '--lighthouse']).slice(-2), [
      'e2e (Playwright + axe)',
      'Lighthouse (a11y = 100)',
    ]);
  });

  it('builds the mock-ups before e2e, which serves them (spec 004)', () => {
    const names = running(['--e2e']);
    assert.equal(
      names.indexOf('mock-ups build (spec 004)'),
      names.indexOf('e2e (Playwright + axe)') - 1,
    );
  });

  it('adds Lighthouse last with --lighthouse', () => {
    assert.equal(running(['--lighthouse']).at(-1), 'Lighthouse (a11y = 100)');
  });

  it('runs only the fast gates with --quick and says why the others are skipped', () => {
    assert.deepEqual(running(['--quick']), [
      'docs (OKF)',
      'format (Prettier)',
      'lint (ESLint)',
      'unit (Vitest)',
      'scripts (node --test)',
    ]);
    const e2e = planGates(['--quick']).find((g) => g.name === 'e2e (Playwright + axe)');
    assert.equal(e2e.skipReason, 'skipped (--quick; CI runs it)');
  });

  it('rejects --quick together with --lighthouse or --e2e', () => {
    assert.throws(() => planGates(['--quick', '--lighthouse']), /cannot be combined/);
    assert.throws(() => planGates(['--quick', '--e2e']), /cannot be combined/);
  });
});
