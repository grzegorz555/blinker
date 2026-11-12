// Tests for serve-design.mjs (spec 004, R2, R10): npm run test:scripts
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createDesignServer, lanAddresses, resolveDesignFile } from './serve-design.mjs';
import { loadConfig } from './static-config.mjs';

const config = loadConfig();
let root, outside, server, port;

before(async () => {
  const base = mkdtempSync(join(tmpdir(), 'blinker-serve-'));
  root = join(base, 'design');
  outside = base;
  mkdirSync(join(root, 'directions'), { recursive: true });
  mkdirSync(join(root, 'empty'));
  writeFileSync(join(root, 'index.html'), '<!doctype html><title>catalog</title>');
  writeFileSync(join(root, 'design.css'), 'body{}');
  writeFileSync(join(root, 'directions', 'index.html'), 'directions');
  writeFileSync(join(outside, 'secret.txt'), 'outside the root');
  server = createDesignServer({ root, config });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  port = server.address().port;
});

after(() => {
  server.close();
  rmSync(outside, { recursive: true, force: true });
});

/** A raw HTTP request: unlike fetch(), it sends the path exactly as written ("/../x" is not resolved). */
function get(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

describe('resolveDesignFile', () => {
  it('serves index.html for "/" and for a folder with a trailing slash', () => {
    assert.equal(resolveDesignFile(root, '/'), join(root, 'index.html'));
    assert.equal(resolveDesignFile(root, '/directions/'), join(root, 'directions', 'index.html'));
  });

  it('returns null for folders (no listing), missing files and malformed escapes', () => {
    for (const path of ['/directions', '/empty/', '/missing.html', '/%E0%A4%A', '/a%00.html']) {
      assert.equal(resolveDesignFile(root, path), null, path);
    }
  });

  it('never leaves the root (path traversal)', () => {
    for (const path of [
      '/../secret.txt',
      '/..%2fsecret.txt',
      '/..%5csecret.txt',
      '/%2e%2e/secret.txt',
    ]) {
      assert.equal(resolveDesignFile(root, path), null, path);
    }
  });
});

describe('createDesignServer', () => {
  it('serves a page with the production headers and the right Content-Type (R2)', async () => {
    const res = await get('/');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /^text\/html/);
    for (const [name, value] of Object.entries(config.globalHeaders)) {
      assert.equal(res.headers[name.toLowerCase()], value, name);
    }
    assert.match((await get('/design.css?v=1')).headers['content-type'], /^text\/css/);
  });

  it('answers 404 with the same headers for traversal, folders and missing files (R10)', async () => {
    for (const path of ['/../secret.txt', '/..%2fsecret.txt', '/empty/', '/directions', '/nope']) {
      const res = await get(path);
      assert.equal(res.status, 404, path);
      assert.ok(!res.body.includes('outside the root'), path);
      assert.equal(
        res.headers['content-security-policy'],
        config.globalHeaders['Content-Security-Policy'],
      );
    }
  });

  it('is read-only: other methods get 405', async () => {
    const res = await get('/', 'POST');
    assert.equal(res.status, 405);
    assert.equal(res.headers['allow'], 'GET, HEAD');
  });

  it('answers HEAD without a body', async () => {
    const res = await get('/', 'HEAD');
    assert.equal(res.status, 200);
    assert.equal(res.body, '');
  });
});

describe('lanAddresses', () => {
  it('lists external IPv4 addresses only', () => {
    const interfaces = {
      'Wi-Fi': [
        { family: 'IPv6', address: 'fe80::1', internal: false },
        { family: 'IPv4', address: '192.168.1.23', internal: false },
      ],
      Loopback: [{ family: 'IPv4', address: '127.0.0.1', internal: true }],
      Ethernet: [{ family: 'IPv4', address: '169.254.10.2', internal: false }],
      VPN: [{ family: 'IPv4', address: '10.8.0.5', internal: false }],
      Down: undefined,
    };
    assert.deepEqual(lanAddresses(interfaces), ['192.168.1.23', '10.8.0.5']);
  });
});
