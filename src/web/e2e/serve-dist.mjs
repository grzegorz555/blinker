// Minimal static server for e2e tests: serves the production build (dist/blinker-web/browser)
// with an SPA fallback to index.html. No dependencies on purpose. It is not a dev server and is used only by Playwright.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..', 'dist', 'blinker-web', 'browser');
const port = Number(process.env.PORT ?? 4300);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.task': 'application/octet-stream',
};

async function resolveFile(urlPath) {
  const safe = normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, '');
  const file = join(root, safe);
  if (!file.startsWith(root + sep) && file !== root) return null; // path traversal guard
  try {
    if ((await stat(file)).isFile()) return file;
  } catch {
    /* fall through to SPA fallback */
  }
  return extname(safe) ? null : join(root, 'index.html');
}

createServer(async (req, res) => {
  const file = await resolveFile(new URL(req.url ?? '/', 'http://localhost').pathname);
  if (!file) {
    res.writeHead(404).end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
  res.end(await readFile(file));
}).listen(port, '127.0.0.1', () => console.log(`Serving ${root} on http://127.0.0.1:${port}`));
