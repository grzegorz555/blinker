// Runs a step again when it fails, a fixed number of times (spec 002, R6). For Lighthouse: Chrome sometimes loses a
// trace event ("NO_NAVSTART", 2026-11-24 on PR #56), which fails one run although the page is fine. A real
// accessibility problem fails every try, so a retry never hides it; it only costs the time of one more run.

/**
 * Calls `attempt(n)` (n = 1, 2, ...) until it returns true, at most `tries` times.
 * @param {(n: number) => boolean} attempt
 * @param {{ tries?: number, onRetry?: (n: number) => void }} options onRetry runs before try n + 1
 * @returns {boolean} true when one try passed
 */
export function runWithRetry(attempt, { tries = 2, onRetry = () => undefined } = {}) {
  if (!Number.isInteger(tries) || tries < 1)
    throw new RangeError(`tries must be a whole number >= 1, got ${tries}`);
  for (let n = 1; n <= tries; n++) {
    if (attempt(n)) return true;
    if (n < tries) onRetry(n);
  }
  return false;
}
