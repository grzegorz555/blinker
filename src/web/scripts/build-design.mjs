// Builds the mock-ups (spec 004) from design/ into dist/design/:
// - copies the pages and scripts as they are;
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
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const problems = [];

  for (const file of walk(src)) {
    const name = relative(src, file).split(sep).join('/');
    if (name === CSS_ENTRY) continue;
    const target = join(out, name);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(file, target);
    if (name.endsWith('.html')) {
      for (const p of findRawColors(readFileSync(file, 'utf8'))) problems.push(`${p}: ${name}`);
    }
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
