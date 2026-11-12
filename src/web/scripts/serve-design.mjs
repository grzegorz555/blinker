// Serves the built mock-ups (dist/design/) so the author can open them on a phone over the home Wi-Fi (spec 004).
// Started only by the author with `npm run design:serve` (R10); never by CI or an agent, except Playwright, which
// binds it to 127.0.0.1. No dependencies on purpose.
// - R2: every response carries the production headers from public/staticwebapp.config.json (CSP, Trusted Types...).
// - R10: read-only GET/HEAD, only files inside dist/design/, a path-traversal guard, no directory listing.
// Listening on 0.0.0.0 accepts connections on every network interface, which is what lets the phone in:
// https://nodejs.org/api/net.html
import { createServer } from 'node:http';
import { existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DESIGN_OUT } from './build-design.mjs';
import { loadConfig } from './static-config.mjs';

export const DEFAULT_PORT = 4310;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

/**
 * The file to serve for a request path, or null for 404.
 * "/" and "/folder/" serve that folder's index.html; a folder without one is a 404, never a listing.
 * @param {string} root absolute path of dist/design
 * @param {string} urlPath the request path, still URL-encoded
 */
export function resolveDesignFile(root, urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null; // malformed escape such as "%E0%A4%A"
  }
  if (decoded.includes('\0')) return null;
  const wanted = decoded.endsWith('/') ? `${decoded}index.html` : decoded;
  const file = join(root, normalize(wanted).replace(/^([/\\])+/, ''));
  if (!file.startsWith(root + sep)) return null; // path traversal guard
  try {
    return statSync(file).isFile() ? file : null;
  } catch {
    return null;
  }
}

/** IPv4 addresses a phone on the same network can use; skips loopback, internal and link-local (169.254.x.x). */
export function lanAddresses(interfaces = networkInterfaces()) {
  return Object.values(interfaces)
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal && !i.address.startsWith('169.254.'))
    .map((i) => i.address);
}

/** An HTTP server for the mock-ups; every response, including errors, carries the production headers. */
export function createDesignServer({ root = DESIGN_OUT, config = loadConfig() } = {}) {
  const headers = { ...config.globalHeaders };
  return createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { ...headers, Allow: 'GET, HEAD', 'Content-Type': 'text/plain' });
      res.end('Method not allowed');
      return;
    }
    // The raw request path, not new URL(...): a client can send "/../x" unresolved, and the guard must see it.
    const file = resolveDesignFile(root, (req.url ?? '/').split(/[?#]/)[0]);
    if (!file) {
      res.writeHead(404, { ...headers, 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
    const type = TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
    res.writeHead(200, { ...headers, 'Content-Type': type });
    res.end(req.method === 'HEAD' ? undefined : await readFile(file));
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!existsSync(join(DESIGN_OUT, 'index.html'))) {
    console.error('No mock-ups in dist/design/. Run "npm run design:build" first.');
    process.exit(1);
  }
  const host = process.env['HOST'] ?? '0.0.0.0';
  const port = Number(process.env['PORT'] ?? DEFAULT_PORT);
  createDesignServer().listen(port, host, () => {
    console.log(`Mock-ups from ${relative(process.cwd(), DESIGN_OUT)}`);
    console.log(`  on this computer: http://localhost:${port}/`);
    if (host === '0.0.0.0') {
      for (const address of lanAddresses())
        console.log(`  on the phone:     http://${address}:${port}/`);
      console.log(
        '\nThe phone must be on the same Wi-Fi. If Windows asks about the firewall, allow private networks only.' +
          '\nAnyone on this network can open the mock-ups while this runs; they hold no personal data.' +
          '\nDon’t run it on public Wi-Fi. Stop with Ctrl+C.',
      );
    }
  });
}
