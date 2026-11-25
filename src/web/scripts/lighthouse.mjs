// Runs Lighthouse CI on the production build in English and Polish (spec 002, R6 and R7), then checks that
// each report really shows the expected language. Needs a build (`npm run build`) and Google Chrome.
// Reports: src/web/.lighthouseci/reports-<lang>/ (git-ignored; uploaded as a CI artifact).
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { runWithRetry } from './retry.mjs';

const webDir = resolve(import.meta.dirname, '..');
const languages = [
  { lang: 'en', locale: 'en-US' },
  { lang: 'pl', locale: 'pl-PL' },
];

function run(command, env = {}) {
  // shell: true resolves npx.cmd on Windows; the commands are fixed strings, never user input.
  const { status } = spawnSync(command, {
    cwd: webDir,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...env },
  });
  return status === 0;
}

rmSync(resolve(webDir, '.lighthouseci'), {
  recursive: true,
  force: true,
  maxRetries: 5,
  retryDelay: 100,
});

let ok = true;
for (const { lang, locale } of languages) {
  console.log(`\n=== Lighthouse (${lang})`);
  // LANGUAGE: Chrome on Linux may take the UI language from the environment instead of --lang.
  // One retry: a flaky Chrome trace (NO_NAVSTART) fails a single run; a real problem fails both (retry.mjs).
  ok =
    runWithRetry(
      () =>
        run('npx lhci autorun --config=lighthouserc.cjs', {
          LHCI_LANG: lang,
          LANGUAGE: locale,
          PORT: '4310',
        }),
      {
        onRetry: () => {
          console.log(`\n=== Lighthouse (${lang}) failed; one more try`);
          // The reports of the failed try must not reach the language check; the other language's stay.
          rmSync(resolve(webDir, '.lighthouseci', `reports-${lang}`), {
            recursive: true,
            force: true,
          });
        },
      },
    ) && ok;
  ok = run(`node scripts/lighthouse-lang.mjs .lighthouseci/reports-${lang} ${lang}`) && ok;
}

console.log(ok ? '\nLighthouse passed (en, pl)' : '\nLighthouse FAILED');
process.exit(ok ? 0 : 1);
