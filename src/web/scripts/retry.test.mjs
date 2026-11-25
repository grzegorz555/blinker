// Tests for retry.mjs (spec 002, R6): npm run test:scripts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runWithRetry } from './retry.mjs';

describe('runWithRetry', () => {
  it('stops at the first pass and does not retry', () => {
    const calls = [];
    const retries = [];
    assert.equal(
      runWithRetry((n) => (calls.push(n), true), { onRetry: (n) => retries.push(n) }),
      true,
    );
    assert.deepEqual(calls, [1]);
    assert.deepEqual(retries, []);
  });

  it('a flaky step passes on the second try, after one onRetry', () => {
    const retries = [];
    assert.equal(
      runWithRetry((n) => n === 2, { onRetry: (n) => retries.push(n) }),
      true,
    );
    assert.deepEqual(retries, [1]);
  });

  it('a real failure fails every try and the result is false (negative test)', () => {
    const calls = [];
    assert.equal(
      runWithRetry((n) => (calls.push(n), false), { tries: 3 }),
      false,
    );
    assert.deepEqual(calls, [1, 2, 3]);
  });

  it('refuses a number of tries below 1 or not whole', () => {
    assert.throws(() => runWithRetry(() => true, { tries: 0 }), RangeError);
    assert.throws(() => runWithRetry(() => true, { tries: 1.5 }), RangeError);
  });
});
