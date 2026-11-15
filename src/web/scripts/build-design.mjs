// Builds the mock-ups (spec 004) from design/ into dist/design/:
// - copies the pages and scripts; pages get their shared parts from design/partials/ (renderPage);
// - compiles design/design.css with PostCSS + @tailwindcss/postcss (the same tools the app build uses, no new
//   dependency): https://tailwindcss.com/docs/installation/using-postcss
// - fails on a raw color in the markup (R3: colors come only from the tokens) and on inline scripts or handlers
//   (R2: the pages run under the production CSP), reusing the check-dist rules.
// Usage: node scripts/build-design.mjs   (npm run design:build)
import tailwindcss from '@tailwindcss/postcss';
import postcss from 'postcss';
import {
  cpSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findDistProblems } from './check-dist.mjs';

const webDir = resolve(import.meta.dirname, '..');
export const DESIGN_SRC = join(webDir, 'design');
export const DESIGN_OUT = join(webDir, 'dist', 'design');
const CSS_ENTRY = 'design.css';
const PARTIALS = 'partials';
const INCLUDE = /<!--\s*include\s+([\w./-]+)\s*-->/g;

/**
 * Puts shared markup into a page and marks the current navigation link, so the caregiver panel pages share one
 * navigation (spec 004, R12) without a framework:
 * - `<!-- include nav.html -->` is replaced by design/partials/nav.html;
 * - in a page with `<html data-page="start">`, the link with `data-nav="start"` gets aria-current="page".
 * @param {string} html the page
 * @param {(name: string) => string} readPartial returns a partial by its file name
 */
export function renderPage(html, readPartial) {
  const out = html.replace(INCLUDE, (_, name) => {
    if (name.includes('..')) throw new Error(`partial outside design/${PARTIALS}/: ${name}`);
    return readPartial(name);
  });
  const page = /<html\b[^>]*\sdata-page="([\w-]+)"/.exec(out)?.[1];
  if (!page) return out;
  return out.replace(
    new RegExp(`(<a\\b[^>]*\\sdata-nav="${page}")`, 'g'),
    '$1 aria-current="page"',
  );
}

const PALETTE =
  'red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|' +
  'slate|gray|zinc|neutral|stone|black|white';
const UTILITY =
  'bg|text|border|border-[trblxyse]|ring|ring-offset|outline|fill|stroke|from|via|to|accent|caret|' +
  'decoration|shadow|divide|placeholder';
const RAW_COLOR_CHECKS = [
  { label: 'style attribute', pattern: /\sstyle\s*=/i },
  { label: 'arbitrary color value', pattern: /-\[(?:#|rgba?\(|hsla?\(|oklch\(|oklab\(|color\()/i },
  {
    label: 'Tailwind palette color',
    pattern: new RegExp(
      `(?:^|[\\s"':])(?:${UTILITY})-(?:${PALETTE})(?:-\\d{2,3})?(?:/\\d+)?(?=[\\s"']|$)`,
    ),
  },
];

/** Raw colors in one HTML document; the mock-ups must use token classes such as bg-bg or text-fg (R3). */
export function findRawColors(html) {
  return RAW_COLOR_CHECKS.filter(({ pattern }) => pattern.test(html)).map(({ label }) => label);
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/**
 * Builds the mock-ups and returns a list of problems; an empty list means success.
 * @param {{ src?: string, out?: string }} [dirs]
 * @returns {Promise<string[]>}
 */
export async function buildDesign({ src = DESIGN_SRC, out = DESIGN_OUT } = {}) {
  rmSync(out, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  mkdirSync(out, { recursive: true });
  const problems = [];

  for (const file of walk(src)) {
    const name = relative(src, file).split(sep).join('/');
    if (name === CSS_ENTRY || name.startsWith(`${PARTIALS}/`)) continue;
    const target = join(out, name);
    mkdirSync(dirname(target), { recursive: true });
    if (!name.endsWith('.html')) {
      cpSync(file, target);
      continue;
    }
    const html = renderPage(readFileSync(file, 'utf8'), (partial) =>
      readFileSync(join(src, PARTIALS, partial), 'utf8'),
    );
    writeFileSync(target, html);
    for (const p of findRawColors(html)) problems.push(`${p}: ${name}`);
  }

  const from = join(src, CSS_ENTRY);
  const to = join(out, CSS_ENTRY);
  const result = await postcss([tailwindcss()]).process(readFileSync(from, 'utf8'), { from, to });
  writeFileSync(to, result.css);

  return [...problems, ...findDistProblems(out)];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = await buildDesign();
  if (problems.length) {
    console.error(`design build failed (${problems.length}):\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
  console.log(`mock-ups built: ${relative(process.cwd(), DESIGN_OUT)}`);
}
