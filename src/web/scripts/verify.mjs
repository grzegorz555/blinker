// Runs the quality gates in the same order as CI (spec 002, R1) and prints an honest summary:
// which gates passed, which failed and which were not run. It stops at the first failure.
// Usage (from src/web):
//   npm run verify                   every gate except Lighthouse (what the CI `web` job runs)
//   npm run verify -- --lighthouse   also Lighthouse CI (needs a build and Google Chrome)
//   npm run verify -- --quick        fast gates only, about 30 s (what the pre-push hook runs, spec 005);
//                                    e2e, audit, build and Lighthouse are left to CI
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webDir = resolve(import.meta.dirname, '..');

/** Every gate in CI order. `quick` gates also run with --quick; `lighthouse` only with --lighthouse. */
export const GATES = [
  { name: 'docs (OKF)', command: 'node ../../scripts/check-okf.mjs ../../docs', quick: true },
  { name: 'format (Prettier)', command: 'npm run format:check', quick: true },
  { name: 'lint (ESLint)', command: 'npm run lint', quick: true },
  { name: 'unit (Vitest)', command: 'npm test', quick: true },
  { name: 'scripts (node --test)', command: 'npm run test:scripts', quick: true },
  // R3: any high/critical advisory, or any advisory in production dependencies, blocks.
  { name: 'audit (high, all deps)', command: 'npm audit --audit-level=high' },
  { name: 'audit (any, production)', command: 'npm audit --omit=dev' },
  { name: 'build (production)', command: 'npm run build' },
  { name: 'dist check', command: 'npm run check:dist' },
  { name: 'e2e (Playwright + axe)', command: 'npm run e2e:only' },
  { name: 'Lighthouse (a11y = 100)', command: 'npm run lighthouse', lighthouse: true },
];

/**
 * Decides for each gate whether it runs, from the command-line flags.
 * @param {string[]} args e.g. ['--quick'] or ['--lighthouse']
 * @returns {{ name: string, command: string, skipReason: string | null }[]}
 */
export function planGates(args) {
  const quick = args.includes('--quick');
  const withLighthouse = args.includes('--lighthouse');
  if (quick && withLighthouse) throw new Error('--quick and --lighthouse cannot be combined');
  return GATES.map(({ name, command, quick: isQuick, lighthouse }) => {
    let skipReason = null;
    if (quick && !isQuick) skipReason = 'skipped (--quick; CI runs it)';
    else if (lighthouse && !withLighthouse) skipReason = 'skipped (use --lighthouse)';
    return { name, command, skipReason };
  });
}

function main(args) {
  const results = [];
  let failed = false;
  for (const gate of planGates(args)) {
    if (gate.skipReason) {
      results.push({ ...gate, status: gate.skipReason, seconds: 0 });
      continue;
    }
    if (failed) {
      results.push({ ...gate, status: 'not run', seconds: 0 });
      continue;
    }
    console.log(`\n=== ${gate.name}: ${gate.command}`);
    const start = Date.now();
    // shell: true resolves npm.cmd on Windows; the commands are fixed strings above, never user input.
    const { status } = spawnSync(gate.command, { cwd: webDir, stdio: 'inherit', shell: true });
    const seconds = Math.round((Date.now() - start) / 1000);
    const ok = status === 0;
    results.push({ ...gate, status: ok ? 'passed' : `FAILED (exit ${status})`, seconds });
    failed = !ok;
  }

  const width = Math.max(...results.map((r) => r.name.length));
  console.log('\n=== verify summary');
  for (const r of results)
    console.log(`${r.name.padEnd(width)}  ${r.status}${r.seconds ? ` (${r.seconds}s)` : ''}`);
  console.log(failed ? '\nverify FAILED' : '\nverify passed');
  return failed ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
