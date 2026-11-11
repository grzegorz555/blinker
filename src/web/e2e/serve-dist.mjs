// Minimal static server for e2e tests: serves the production build (dist/blinker-web/browser) the way Azure Static
// Web Apps does (spec 003, R2): the same headers, SPA fallback and MIME types, read from staticwebapp.config.json
// in the build. No dependencies on purpose. It is not a dev server and is used only by Playwright and Lighthouse.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { headersFor, isFallbackPath, loadConfig, mimeTypeFor } from '../scripts/static-config.mjs';

const root = resolve(import.meta.dirname, '..', 'dist', 'blinker-web', 'browser');
const port = Number(process.env.PORT ?? 4300);
const config = loadConfig(join(root, 'staticwebapp.config.json'));
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

/** @returns {Promise<{ file: string, fallback: boolean } | null>} null = 404 */
async function resolveFile(urlPath) {
  const safe = normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, '');
  const file = join(root, safe);
  if (!file.startsWith(root + sep) && file !== root) return null; // path traversal guard
  try {
    if ((await stat(file)).isFile()) return { file, fallback: false };
  } catch {
    /* fall through to the SPA fallback */
  }
  return isFallbackPath(config, urlPath)
    ? { file: join(root, 'index.html'), fallback: true }
    : null;
}

createServer(async (req, res) => {
  const path = new URL(req.url ?? '/', 'http://localhost').pathname;
  const found = await resolveFile(path);
  if (!found) {
    res
      .writeHead(404, { ...headersFor(config, path), 'Content-Type': 'text/plain' })
      .end('Not found');
    return;
  }
  const headers = headersFor(config, path, { fallback: found.fallback });
  const type = mimeTypeFor(config, extname(found.file), types);
  res.writeHead(200, { ...headers, 'Content-Type': type });
  res.end(await readFile(found.file));
}).listen(port, '127.0.0.1', () => console.log(`Serving ${root} on http://127.0.0.1:${port}`));
