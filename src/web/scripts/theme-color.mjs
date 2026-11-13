// theme-color from the tokens (spec 004, T6). The browser UI (the address bar on Android, the title bar of the
// installed app) takes the page color, --bg, the color of the top app bar, so the bar and the app read as one surface
// (https://m3.material.io/components/top-app-bar/specs, https://developer.mozilla.org/docs/Web/HTML/Reference/Elements/meta/name/theme-color).
// index.html has one theme-color per scheme; the manifest has one value, so it uses the light one, and the splash
// screen (background_color) uses the same page color.
//
// Run: node scripts/theme-color.mjs          checks index.html and the manifest, exit 1 on a mismatch
//      node scripts/theme-color.mjs --write  writes the values from the tokens
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readProjectTokenSets, resolveVars, toLinearSrgb } from './contrast.mjs';

const webDir = resolve(import.meta.dirname, '..');
export const INDEX_HTML = resolve(webDir, 'src', 'index.html');
export const MANIFEST = resolve(webDir, 'public', 'manifest.webmanifest');

/** An OKLCH (or hex) color as "#rrggbb" in sRGB, clamped to the gamut. */
export function toHex(color) {
  return (
    '#' +
    toLinearSrgb(color)
      .map((c) => Math.min(1, Math.max(0, c)))
      .map((c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055))
      .map((c) =>
        Math.round(c * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

/** The theme colors from the app tokens: --bg in light and dark. */
export function themeColors(sets = readProjectTokenSets()) {
  const light = resolveVars(sets.app.light).bg;
  const dark = resolveVars(sets.app.dark).bg;
  return { light: toHex(light), dark: toHex(dark) };
}

const META =
  /<meta name="theme-color" content="(#[0-9a-f]{6})" media="\(prefers-color-scheme: (light|dark)\)" \/>/g;

/** The theme-color values in index.html, by scheme. */
export function readIndexColors(html) {
  return Object.fromEntries([...html.matchAll(META)].map(([, color, scheme]) => [scheme, color]));
}

/** Differences between the tokens and the files (an empty list = in sync). */
export function themeColorProblems(
  colors = themeColors(),
  html = readFileSync(INDEX_HTML, 'utf8'),
  manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')),
) {
  const problems = [];
  const index = readIndexColors(html);
  for (const scheme of ['light', 'dark']) {
    if (index[scheme] !== colors[scheme]) {
      problems.push(
        `index.html theme-color (${scheme}) is ${index[scheme]}, the token gives ${colors[scheme]}`,
      );
    }
  }
  for (const key of ['theme_color', 'background_color']) {
    if (manifest[key] !== colors.light) {
      problems.push(`manifest ${key} is ${manifest[key]}, the token gives ${colors.light}`);
    }
  }
  return problems;
}

function write(colors) {
  const html = readFileSync(INDEX_HTML, 'utf8').replace(
    META,
    (_, _color, scheme) =>
      `<meta name="theme-color" content="${colors[scheme]}" media="(prefers-color-scheme: ${scheme})" />`,
  );
  writeFileSync(INDEX_HTML, html);
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  manifest.theme_color = colors.light;
  manifest.background_color = colors.light;
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const colors = themeColors();
  if (process.argv.includes('--write')) {
    write(colors);
    console.log(`theme-color written: light ${colors.light}, dark ${colors.dark}`);
  } else {
    const problems = themeColorProblems(colors);
    if (problems.length) {
      console.error(`theme-color out of sync (run with --write):\n- ${problems.join('\n- ')}`);
      process.exit(1);
    }
    console.log(`theme-color in sync: light ${colors.light}, dark ${colors.dark}`);
  }
}
