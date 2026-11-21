// Tests for static-config.mjs (spec 003, R1, R2, R5): npm run test:scripts
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import {
  globToRegExp,
  headersFor,
  isFallbackPath,
  loadConfig,
  mimeTypeFor,
  notFoundPage,
  parseSecurityHeaders,
} from './static-config.mjs';
import { findInlineCode } from './check-dist.mjs';

const config = loadConfig();
const securityMd = readFileSync(
  resolve(import.meta.dirname, '..', '..', '..', 'docs', 'conventions', 'security.md'),
  'utf8',
);
const IMMUTABLE = 'public, max-age=31536000, immutable';

describe('R1: one header list', () => {
  it('the config sends exactly the headers in security.md, plus Cache-Control', () => {
    const { 'Cache-Control': cache, ...security } = config.globalHeaders;
    assert.equal(cache, 'no-cache');
    assert.deepEqual(security, parseSecurityHeaders(securityMd));
  });

  it('parseSecurityHeaders joins continuation lines and reports a changed value', () => {
    const md = '# Response headers (x)\n```\nA: one;\n  two\nB: x\n```\n# Next\n';
    assert.deepEqual(parseSecurityHeaders(md), { A: 'one; two', B: 'x' });
    assert.notDeepEqual(parseSecurityHeaders(md.replace('B: x', 'B: y')), {
      A: 'one; two',
      B: 'x',
    });
  });

  it('the security.md block is parsed into all six headers', () => {
    assert.deepEqual(Object.keys(parseSecurityHeaders(securityMd)), [
      'Content-Security-Policy',
      'Permissions-Policy',
      'Strict-Transport-Security',
      'X-Content-Type-Options',
      'Referrer-Policy',
      'Cross-Origin-Opener-Policy',
    ]);
  });
});

describe('R5: SPA fallback', () => {
  it('app routes fall back to index.html', () => {
    for (const path of ['/', '/settings', '/boards/friend', '/does-not-exist']) {
      assert.equal(isFallbackPath(config, path), true, path);
    }
  });

  it('missing files with a known extension or under assets folders are 404', () => {
    for (const path of [
      '/missing.js',
      '/main-ABCDEFGH.css',
      '/ngsw.json',
      '/icons/x.png',
      '/i18n/de.json',
    ]) {
      assert.equal(isFallbackPath(config, path), false, path);
    }
  });

  it('globToRegExp: * stays within one segment, {a,b} are alternatives', () => {
    assert.match('/a.js', globToRegExp('/*.{js,css}'));
    assert.doesNotMatch('/x/a.js', globToRegExp('/*.{js,css}'));
    assert.doesNotMatch('/a.jsx', globToRegExp('/*.{js,css}'));
  });
});

describe('R5: caching', () => {
  it('index.html, ngsw files and the manifest are revalidated', () => {
    for (const path of ['/index.html', '/ngsw.json', '/ngsw-worker.js', '/manifest.webmanifest']) {
      assert.equal(headersFor(config, path)['Cache-Control'], 'no-cache', path);
    }
  });

  it('hashed bundles are immutable and keep the security headers', () => {
    for (const path of ['/main-PKTFQDX7.js', '/chunk-GZROVNNY.js', '/styles-EFPZ56LM.css']) {
      const headers = headersFor(config, path);
      assert.equal(headers['Cache-Control'], IMMUTABLE, path);
      assert.equal(headers['X-Content-Type-Options'], 'nosniff', path);
    }
  });

  it('a fallback response gets only the global headers (route rules are not applied)', () => {
    assert.equal(headersFor(config, '/main-x', { fallback: true })['Cache-Control'], 'no-cache');
  });
});

describe('R2: MIME types', () => {
  it('uses the config first, then the defaults, then octet-stream', () => {
    const defaults = { '.js': 'text/javascript' };
    assert.equal(mimeTypeFor(config, '.webmanifest', defaults), 'application/manifest+json');
    assert.equal(mimeTypeFor(config, '.js', defaults), 'text/javascript');
    assert.equal(mimeTypeFor(config, '.bin', defaults), 'application/octet-stream');
  });
});

describe('R9: the 404 page gets the security headers', () => {
  const page = notFoundPage(config);
  const file = resolve(import.meta.dirname, '..', 'public', '.' + page);

  it('the config overrides the built-in 404 with a file from public/', () => {
    assert.equal(page, '/404.html');
    assert.equal(existsSync(file), true, file);
    assert.equal(notFoundPage({}), null);
  });

  it('the page is CSP-clean, has a language and a title, and links back to the app', () => {
    const html = readFileSync(file, 'utf8');
    assert.deepEqual(findInlineCode(html), []);
    assert.doesNotMatch(html, /<script|style=/i);
    assert.match(html, /<html lang="pl">/);
    assert.match(html, /<title>[^<]+<\/title>/);
    assert.match(html, /<a href="\/"/);
  });

  it('a 404 gets the global headers only, so a missing bundle is never cached as immutable', () => {
    const headers = headersFor(config, '/main-MISSING.js', { fallback: true });
    assert.equal(headers['Cache-Control'], 'no-cache');
    assert.equal(
      headers['Content-Security-Policy'],
      config.globalHeaders['Content-Security-Policy'],
    );
  });
});
