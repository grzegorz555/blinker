import ngswConfig from '../../ngsw-config.json';

/**
 * Service worker configuration (spec 001). The manifest itself is checked in e2e/pwa.e2e.ts,
 * where it is served the same way a browser fetches it.
 */
describe('service worker configuration (spec 001)', () => {
  const prefetched = ngswConfig.assetGroups
    .filter((group) => group.installMode === 'prefetch')
    .flatMap((group) => group.resources.files);

  it('prefetches the app shell (index.html, scripts, styles, manifest)', () => {
    expect(prefetched).toEqual(
      expect.arrayContaining(['/index.html', '/*.js', '/*.css', '/manifest.webmanifest']),
    );
  });

  it('prefetches the translations, so the shell works offline in both languages', () => {
    expect(prefetched).toContain('/i18n/*.json');
  });
});
