// Checks the production build for files that must never be deployed (spec 002, R4):
// - source maps (*.map) and `sourceMappingURL` comments: they expose the original source;
// - Markdown files (*.md): docs and notes belong in the repo, not on the web server.
// No dependencies on purpose. Usage: node scripts/check-dist.mjs [dir]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_DIST = resolve(import.meta.dirname, '..', 'dist', 'blinker-web', 'browser');

const FORBIDDEN_EXTENSIONS = new Set(['.map', '.md']);
const SCANNED_FOR_COMMENT = new Set(['.js', '.mjs', '.css']);
const SOURCE_MAP_COMMENT = /[#@]\s*sourceMappingURL=/;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/**
 * Returns a list of human-readable problems; an empty list means the build is clean.
 * @param {string} dir the browser build folder
 * @returns {string[]}
 */
export function findDistProblems(dir) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    return [`build folder not found: ${dir} (run "npm run build" first)`];
  }
  const problems = [];
  for (const file of walk(dir)) {
    const name = relative(dir, file).split(sep).join('/');
    const ext = extname(file).toLowerCase();
    if (FORBIDDEN_EXTENSIONS.has(ext)) problems.push(`forbidden file: ${name}`);
    else if (SCANNED_FOR_COMMENT.has(ext) && SOURCE_MAP_COMMENT.test(readFileSync(file, 'utf8'))) {
      problems.push(`sourceMappingURL comment: ${name}`);
    }
  }
  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = resolve(process.argv[2] ?? DEFAULT_DIST);
  const problems = findDistProblems(dir);
  if (problems.length) {
    console.error(`dist check failed (${problems.length}):\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
  console.log(`dist check passed: ${relative(process.cwd(), dir) || '.'}`);
}
