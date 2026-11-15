// Lighthouse CI configuration (spec 002, R6 and R7). Run through `npm run lighthouse`, which calls it once per
// language with LHCI_LANG=en|pl and checks afterwards that each report really shows that language.
// Docs: https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md
const lang = process.env.LHCI_LANG === 'en' ? 'en' : 'pl';
const locale = lang === 'en' ? 'en-US' : 'pl-PL';
const port = Number(process.env.PORT ?? 4310);
const base = `http://127.0.0.1:${port}`;

module.exports = {
  ci: {
    collect: {
      // The production build, served like in e2e (SPA fallback for the 404 page).
      startServerCommand: 'node e2e/serve-dist.mjs',
      startServerReadyPattern: 'Serving',
      // Every page of the app (spec 007) and the 404 page.
      url: [
        `${base}/`,
        `${base}/sentences`,
        `${base}/boards`,
        `${base}/settings`,
        `${base}/calibration`,
        `${base}/diagnostics`,
        `${base}/does-not-exist`,
      ],
      numberOfRuns: 1,
      settings: {
        // Mobile emulation is Lighthouse's default. The app picks its language from the browser
        // (no saved choice in a fresh profile), so the browser language decides what is audited.
        chromeFlags: `--headless=new --lang=${locale} --accept-lang=${locale}`,
      },
    },
    assert: {
      assertions: {
        'categories:accessibility': ['error', { minScore: 1 }],
      },
    },
    upload: {
      // Never 'temporary-public-storage': it would publish the reports on a public server.
      target: 'filesystem',
      outputDir: `.lighthouseci/reports-${lang}`,
    },
  },
};
