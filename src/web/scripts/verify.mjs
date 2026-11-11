// Runs every quality gate in the same order as CI (spec 002, R1) and prints an honest summary:
// which gates passed, which failed and which were not run. It stops at the first failure.
// Usage (from src/web): npm run verify            all gates except Lighthouse
//                       npm run verify -- --lighthouse   also Lighthouse CI (needs Chrome)
// The pre-push hook (.githooks/pre-push) runs this script.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const webDir = resolve(import.meta.dirname, '..');
const withLighthouse = process.argv.includes('--lighthouse');

/** @type {{ name: string, command: string, enabled?: boolean }[]} */
const gates = [
  { name: 'docs (OKF)', command: 'node ../../scripts/check-okf.mjs ../../docs' },
  { name: 'format (Prettier)', command: 'npm run format:check' },
  { name: 'lint (ESLint)', command: 'npm run lint' },
  { name: 'unit (Vitest)', command: 'npm test' },
  { name: 'scripts (node --test)', command: 'npm run test:scripts' },
  // R3: any high/critical advisory, or any advisory in production dependencies, blocks.
  { name: 'audit (high, all deps)', command: 'npm audit --audit-level=high' },
  { name: 'audit (any, production)', command: 'npm audit --omit=dev' },
  { name: 'build (production)', command: 'npm run build' },
  { name: 'dist check', command: 'npm run check:dist' },
  { name: 'e2e (Playwright + axe)', command: 'npm run e2e:only' },
  { name: 'Lighthouse (a11y = 100)', command: 'npm run lighthouse', enabled: withLighthouse },
];

const results = [];
let failed = false;
for (const gate of gates) {
  if (gate.enabled === false) {
    results.push({ ...gate, status: 'skipped (use --lighthouse)', seconds: 0 });
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
process.exit(failed ? 1 : 0);
