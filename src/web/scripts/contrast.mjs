// Contrast check of the design tokens (spec 004, R3, R4). No dependencies except PostCSS, which parses the CSS.
// - Colors: oklch() (and #rrggbb for tests) -> linear sRGB via OKLab (https://bottosson.github.io/posts/oklab/,
//   the conversion in CSS Color 4: https://www.w3.org/TR/css-color-4/#color-conversion-code).
// - Contrast: the WCAG 2.x relative luminance and ratio (https://www.w3.org/TR/WCAG22/#dfn-relative-luminance).
// - A color outside the sRGB gamut is reported: a browser would map it to another color, so the ratio would lie.
// Usage: node scripts/contrast.mjs   prints the ratios of every token set; exits 1 if a pair is below its threshold.
import postcss from 'postcss';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webDir = resolve(import.meta.dirname, '..');
export const TOKENS_CSS = resolve(webDir, 'src', 'styles', 'tokens.css');
export const DESIGN_CSS = resolve(webDir, 'design', 'design.css');

/**
 * Required pairs: [foreground, background, minimum ratio, why].
 * 7:1 (SC 1.4.6, AAA) for what he reads from a distance; 4.5:1 (SC 1.4.3) for other text; 3:1 (SC 1.4.11) for
 * borders, outlines and focus rings.
 */
export const PAIRS = [
  ['fg', 'bg', 7, 'board letters, question and sentence'],
  ['fg', 'surface', 7, 'board letters on cells, active cell'],
  ['on-primary', 'primary', 4.5, 'button text'],
  ['muted', 'bg', 4.5, 'secondary text'],
  ['muted', 'surface', 4.5, 'secondary text on cells and panels'],
  ['primary', 'bg', 4.5, 'links and accent text'],
  ['border', 'bg', 3, 'control borders'],
  ['border', 'surface', 3, 'control borders on panels'],
  ['highlight', 'bg', 3, 'active column/row outline'],
  ['highlight', 'surface', 3, 'active outline next to a cell'],
];
export const TOKENS = [...new Set(PAIRS.flatMap(([a, b]) => [a, b]))];

/** Parses "oklch(45% 0.16 260)", "oklch(0.45 0.16 260 / 50%)" or "#rrggbb" into linear sRGB [r, g, b]. */
export function toLinearSrgb(color) {
  const text = color.trim().toLowerCase();
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/.exec(text);
  if (hex) {
    return hex.slice(1).map((h) => {
      const c = parseInt(h, 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
  }
  const m = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*(?:\/\s*[\d.]+%?\s*)?\)$/.exec(
    text,
  );
  if (!m) throw new Error(`unsupported color: ${color}`);
  const L = Number(m[1]) / (m[2] ? 100 : 1);
  const C = Number(m[3]);
  const h = (Number(m[4]) * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ];
}

/** True when the color can be shown in sRGB without gamut mapping (with a small rounding tolerance). */
export function inSrgbGamut(color) {
  return toLinearSrgb(color).every((c) => c >= -0.002 && c <= 1.002);
}

/** WCAG relative luminance, from linear sRGB clamped to [0, 1]. */
export function relativeLuminance(color) {
  const [r, g, b] = toLinearSrgb(color).map((c) => Math.min(1, Math.max(0, c)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, from 1 to 21. */
export function contrastRatio(a, b) {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Splits "light-dark(a, b)" into [a, b]; a plain value is used for both schemes. */
function splitLightDark(value) {
  const m = /^light-dark\((.*)\)$/s.exec(value.trim());
  if (!m) return [value.trim(), value.trim()];
  let depth = 0;
  for (let i = 0; i < m[1].length; i++) {
    const c = m[1][i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) return [m[1].slice(0, i).trim(), m[1].slice(i + 1).trim()];
  }
  throw new Error(`light-dark() needs two values: ${value}`);
}

/**
 * Reads the token sets from CSS:
 * - ":root" outside a media query = set "app", light; inside "(prefers-color-scheme: dark)" = "app", dark;
 * - "[data-direction='x']" = set "x"; its values are light-dark(light, dark).
 * @returns {Record<string, { light: Record<string,string>, dark: Record<string,string> }>}
 */
export function readTokenSets(css) {
  const sets = {};
  postcss.parse(css).walkDecls(/^--/, (decl) => {
    const rule = decl.parent;
    if (rule?.type !== 'rule') return;
    const direction = /^\[data-direction=['"]?([a-z])['"]?\]$/.exec(rule.selector.trim())?.[1];
    const name = direction ?? (rule.selector.trim() === ':root' ? 'app' : null);
    if (!name) return;
    const token = decl.prop.slice(2);
    const set = (sets[name] ??= { light: {}, dark: {} });
    const inDark =
      rule.parent?.type === 'atrule' && /prefers-color-scheme:\s*dark/.test(rule.parent.params);
    if (direction) {
      const [light, dark] = splitLightDark(decl.value);
      set.light[token] = light;
      set.dark[token] = dark;
    } else {
      set[inDark ? 'dark' : 'light'][token] = decl.value.trim();
    }
  });
  return sets;
}

/**
 * Checks every required pair of every set and scheme.
 * @returns {{ rows: object[], problems: string[] }}
 */
export function checkTokenSets(sets, pairs = PAIRS) {
  const rows = [];
  const problems = [];
  for (const [set, schemes] of Object.entries(sets)) {
    for (const scheme of ['light', 'dark']) {
      const tokens = schemes[scheme];
      const present = pairs.filter(([a, b]) => tokens[a] && tokens[b]);
      // The app tokens may lack tokens that only the mock-ups use yet; a direction must define all of them.
      if (set !== 'app') {
        for (const t of new Set(pairs.flatMap(([a, b]) => [a, b]))) {
          if (!tokens[t]) problems.push(`${set}/${scheme}: missing --${t}`);
        }
      }
      for (const t of Object.keys(tokens)) {
        if (/^(oklch|#)/.test(tokens[t]) && !inSrgbGamut(tokens[t])) {
          problems.push(`${set}/${scheme}: --${t} ${tokens[t]} is outside the sRGB gamut`);
        }
      }
      for (const [fg, bg, min, why] of present) {
        const ratio = contrastRatio(tokens[fg], tokens[bg]);
        rows.push({
          set,
          scheme,
          pair: `${fg}/${bg}`,
          ratio: Math.round(ratio * 10) / 10,
          min,
          why,
        });
        if (ratio < min) {
          problems.push(
            `${set}/${scheme}: ${fg}/${bg} = ${ratio.toFixed(2)}:1, needs ${min}:1 (${why})`,
          );
        }
      }
    }
  }
  return { rows, problems };
}

/** The app tokens and the mock-up directions together. */
export function readProjectTokenSets() {
  return {
    ...readTokenSets(readFileSync(TOKENS_CSS, 'utf8')),
    ...readTokenSets(readFileSync(DESIGN_CSS, 'utf8')),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { rows, problems } = checkTokenSets(readProjectTokenSets());
  console.table(rows);
  if (problems.length) {
    console.error(`contrast check failed (${problems.length}):\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
  console.log('contrast check passed');
}
