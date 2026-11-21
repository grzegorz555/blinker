// Checks the production build for files that must never be deployed (spec 002, R4):
// - source maps (*.map) and `sourceMappingURL` comments: they expose the original source;
// - Markdown files (*.md): docs and notes belong in the repo, not on the web server;
// - (spec 003, R4) inline <script> elements and inline event handlers (on...=) in HTML: the production CSP
//   (script-src 'self') blocks them, so the app would silently lose behaviour or styles;
// - (spec 004, R1) a design/ folder: the mock-ups are built separately into dist/design/ and never ship in the app.
// - (spec 016, R2) the word list words/pl.txt and its license words/pl.LICENSE.txt must be there (CC BY-SA 4.0 attribution).
// No dependencies on purpose. Usage: node scripts/check-dist.mjs [dir]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_DIST = resolve(import.meta.dirname, '..', 'dist', 'blinker-web', 'browser');

// 404.html: the page Azure serves for a missing file, with the security headers (spec 003, R9).
const REQUIRED_FILES = ['words/pl.txt', 'words/pl.LICENSE.txt', '404.html'];
const FORBIDDEN_EXTENSIONS = new Set(['.map', '.md']);
const SCANNED_FOR_COMMENT = new Set(['.js', '.mjs', '.css']);
const SOURCE_MAP_COMMENT = /[#@]\s*sourceMappingURL=/;
const SCRIPT_TAG = /<script\b([^>]*)>/gi;
const INLINE_HANDLER = /<[a-z][^>]*\son[a-z]+\s*=/i;

/** Problems with inline code in one HTML document (spec 003, R4). */
export function findInlineCode(html) {
  const problems = [];
  for (const [, attributes] of html.matchAll(SCRIPT_TAG)) {
    if (!/\bsrc\s*=/i.test(attributes)) problems.push('inline <script>');
  }
  if (INLINE_HANDLER.test(html)) problems.push('inline event handler (on...=)');
  return problems;
}

/** Files the app build must contain (spec 016, R2; spec 003, R9). Kept apart from findDistProblems: the mock-up build reuses that one. */
export function findMissingFiles(dir) {
  return REQUIRED_FILES.filter((f) => !existsSync(join(dir, f))).map((f) => 'missing file: ' + f);
}

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
  if (existsSync(join(dir, 'design')))
    problems.push('mock-ups in the app build: design/ (spec 004, R1)');
  for (const file of walk(dir)) {
    const name = relative(dir, file).split(sep).join('/');
    const ext = extname(file).toLowerCase();
    if (FORBIDDEN_EXTENSIONS.has(ext)) problems.push(`forbidden file: ${name}`);
    else if (SCANNED_FOR_COMMENT.has(ext) && SOURCE_MAP_COMMENT.test(readFileSync(file, 'utf8'))) {
      problems.push(`sourceMappingURL comment: ${name}`);
    } else if (ext === '.html') {
      for (const p of findInlineCode(readFileSync(file, 'utf8'))) problems.push(`${p}: ${name}`);
    }
  }
  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = resolve(process.argv[2] ?? DEFAULT_DIST);
  const problems = [...findDistProblems(dir), ...findMissingFiles(dir)];
  if (problems.length) {
    console.error(`dist check failed (${problems.length}):\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
  console.log(`dist check passed: ${relative(process.cwd(), dir) || '.'}`);
}
