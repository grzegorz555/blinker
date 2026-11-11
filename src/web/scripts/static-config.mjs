// Reads public/staticwebapp.config.json, the one place the response headers are written (spec 003, R1), and answers
// what Azure Static Web Apps would send for a path, so the local e2e server serves the same headers (R2, R5).
// Only the subset of the format we use is implemented; behaviour follows
// https://learn.microsoft.com/azure/static-web-apps/configuration:
// - route wildcards only at the end of the path ("/main-*" = starts with "/main-"); first matching route wins;
// - route headers override global headers with the same name, otherwise both are sent;
// - route rules are not applied to responses served by navigationFallback;
// - navigationFallback.exclude globs: paths that match and don't exist return 404 instead of index.html.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const configPath = resolve(import.meta.dirname, '..', 'public', 'staticwebapp.config.json');

export function loadConfig(path = configPath) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Converts a fallback-exclude glob ("*" within one segment, "{a,b}" alternatives) to a RegExp. */
export function globToRegExp(glob) {
  let source = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') source += '[^/]*';
    else if (c === '{') {
      const end = glob.indexOf('}', i);
      const options = glob.slice(i + 1, end).split(',');
      source += `(?:${options.map((o) => o.replace(/[.+^${}()|[\]\\?]/g, '\\$&')).join('|')})`;
      i = end;
    } else source += c.replace(/[.+^${}()|[\]\\?]/g, '\\$&');
  }
  return new RegExp(`^${source}$`);
}

/** True when a missing file at this path should get index.html (an app route), false when it should get 404. */
export function isFallbackPath(config, path) {
  const exclude = config.navigationFallback?.exclude ?? [];
  return !exclude.some((glob) => globToRegExp(glob).test(path));
}

function routeMatches(route, path) {
  return route.endsWith('*') ? path.startsWith(route.slice(0, -1)) : path === route;
}

/**
 * The headers Azure would send.
 * @param {object} config parsed staticwebapp.config.json
 * @param {string} path request path, e.g. "/main-ABC.js"
 * @param {{ fallback?: boolean }} options fallback: the response is index.html served for an app route
 */
export function headersFor(config, path, { fallback = false } = {}) {
  const headers = { ...config.globalHeaders };
  if (fallback) return headers;
  const route = (config.routes ?? []).find((r) => routeMatches(r.route, path));
  return { ...headers, ...(route?.headers ?? {}) };
}

/** The Content-Type for a file extension: mimeTypes from the config first, then the defaults. */
export function mimeTypeFor(config, extension, defaults) {
  return config.mimeTypes?.[extension] ?? defaults[extension] ?? 'application/octet-stream';
}

/**
 * Parses the header block under "# Response headers" in docs/conventions/security.md:
 * "Name: value" lines, where an indented line continues the previous value.
 */
export function parseSecurityHeaders(markdown) {
  const section = markdown.split(/^# Response headers.*$/m)[1] ?? '';
  const block = /```\r?\n([\s\S]*?)```/.exec(section)?.[1] ?? '';
  const headers = {};
  let last = null;
  for (const line of block.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (/^\s/.test(line) && last) headers[last] += ` ${line.trim()}`;
    else {
      const [name, ...rest] = line.split(':');
      last = name.trim();
      headers[last] = rest.join(':').trim();
    }
  }
  return headers;
}
