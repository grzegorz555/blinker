// Tests for the gate selection in verify.mjs (spec 002 R1, spec 005): npm run test:scripts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { planGates } from './verify.mjs';

const running = (args) =>
  planGates(args)
    .filter((g) => !g.skipReason)
    .map((g) => g.name);

describe('planGates', () => {
  it('runs every gate except Lighthouse by default, in CI order', () => {
    const names = running([]);
    assert.equal(names.length, 10);
    assert.equal(names[0], 'docs (OKF)');
    assert.equal(names.at(-1), 'e2e (Playwright + axe)');
    assert.ok(!names.includes('Lighthouse (a11y = 100)'));
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

  it('rejects --quick together with --lighthouse', () => {
    assert.throws(() => planGates(['--quick', '--lighthouse']), /cannot be combined/);
  });
});
