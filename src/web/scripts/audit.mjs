// The `npm audit` gate for all dependencies (docs/conventions/security.md, "Known vulnerabilities"):
// any high or critical advisory blocks, except one listed in osv-scanner.toml with a reason and an
// ignoreUntil date that has not passed. npm audit has no exception list of its own, so this script
// reads `npm audit --json` and applies the same list OSV-Scanner uses.
// Usage (from src/web): node scripts/audit.mjs
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webDir = resolve(import.meta.dirname, '..');
const BLOCKING = new Set(['high', 'critical']);

/**
 * Reads the [[IgnoredVulns]] entries of our own osv-scanner.toml (id, ignoreUntil, reason).
 * Only the shape this repo writes is supported; an entry without a reason or a date is an error.
 * @param {string} text the file content
 * @returns {{ id: string, until: Date, reason: string }[]}
 */
export function parseIgnores(text) {
  const blocks = text.split(/^\[\[IgnoredVulns\]\]\s*$/m).slice(1);
  return blocks.map((block) => {
    const id = /^id\s*=\s*"([^"]+)"/m.exec(block)?.[1];
    const until = /^ignoreUntil\s*=\s*(\S+)/m.exec(block)?.[1];
    const reason = /^reason\s*=\s*"([^"]+)"/m.exec(block)?.[1];
    if (!id || !until || !reason)
      throw new Error('osv-scanner.toml: every exception needs id, ignoreUntil and reason');
    const date = new Date(until);
    if (Number.isNaN(date.getTime()))
      throw new Error(`osv-scanner.toml: ${id} has an invalid ignoreUntil`);
    return { id, until: date, reason };
  });
}

/**
 * Lists the advisories that block: high or critical, and not under an exception that is still valid.
 * @param {any} report the parsed output of `npm audit --json` (lockfile v2+ format)
 * @param {{ id: string, until: Date }[]} ignores
 * @param {Date} now
 * @returns {{ blocking: string[], ignored: string[] }} lines like "picomatch high GHSA-…"
 */
export function findBlocking(report, ignores, now) {
  if (!report || typeof report.vulnerabilities !== 'object')
    throw new Error('npm audit gave no report');
  const valid = new Set(ignores.filter((i) => i.until > now).map((i) => i.id));
  const blocking = new Set();
  const ignored = new Set();
  for (const vuln of Object.values(report.vulnerabilities)) {
    for (const via of vuln.via) {
      if (typeof via !== 'object' || !BLOCKING.has(via.severity)) continue;
      const id = /GHSA-[\w-]+/.exec(via.url ?? '')?.[0] ?? String(via.source);
      const line = `${via.name} ${via.severity} ${id}`;
      (valid.has(id) ? ignored : blocking).add(line);
    }
  }
  return { blocking: [...blocking].sort(), ignored: [...ignored].sort() };
}

function main() {
  const ignores = parseIgnores(readFileSync(resolve(webDir, 'osv-scanner.toml'), 'utf8'));
  // shell: true resolves npm.cmd on Windows; the command is a fixed string.
  const run = spawnSync('npm audit --json', {
    cwd: webDir,
    shell: true,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const { blocking, ignored } = findBlocking(JSON.parse(run.stdout), ignores, new Date());
  for (const line of ignored) console.log(`ignored (osv-scanner.toml): ${line}`);
  for (const line of blocking) console.log(`BLOCKS: ${line}`);
  console.log(
    blocking.length ? `\n${blocking.length} blocking advisories` : '\nno blocking advisories',
  );
  return blocking.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
