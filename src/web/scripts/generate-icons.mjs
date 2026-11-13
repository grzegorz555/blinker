// Generates the app icons (an abstract open eye) as PNGs from the tokens, using only Node built-ins (spec 004, T6).
// Run: npm run icons. Two kinds, as separate files, because one image can't serve both well
// (https://web.dev/articles/maskable-icon, https://developer.mozilla.org/docs/Web/Progressive_web_apps/Manifest/Reference/icons):
// - "any": a rounded square on a transparent background, filling the canvas; used as it is (favicon, desktop install);
// - "maskable": the background to the edges and the eye inside the safe zone (the central circle with a radius of 40%
//   of the size), so any mask the launcher applies (circle, squircle, teardrop) keeps the whole eye.
// apple-touch-icon is full-bleed too: iOS rounds the corners itself and would show transparency as black.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { readProjectTokenSets, resolveVars } from './contrast.mjs';
import { toHex } from './theme-color.mjs';

/** The icon colors from the light tokens: the eye in --on-primary on --primary. */
export function iconColors(sets = readProjectTokenSets()) {
  const tokens = resolveVars(sets.app.light);
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return { bg: rgb(toHex(tokens.primary)), fg: rgb(toHex(tokens['on-primary'])) };
}

/**
 * The eye at (x, y) in unit coordinates (0..1), centred, with a given scale (1 = the maskable size): an almond made
 * of two circles, with a round pupil cut out. At scale 1 it reaches 0.36 from the centre, inside the 0.40 safe zone.
 */
export function inEye(x, y, scale = 1) {
  const dx = (x - 0.5) / scale;
  const dy = (y - 0.5) / scale;
  const r = 0.36;
  const offset = 0.22;
  const almond = Math.hypot(dx, dy - offset) < r && Math.hypot(dx, dy + offset) < r;
  return almond && Math.hypot(dx, dy) >= 0.09;
}

/** A rounded square covering the canvas with a small margin, for the "any" icon. */
export function inRoundedSquare(x, y, margin = 0.04, radius = 0.22) {
  const lo = margin + radius;
  const hi = 1 - margin - radius;
  const cx = Math.min(Math.max(x, lo), hi);
  const cy = Math.min(Math.max(y, lo), hi);
  return Math.hypot(x - cx, y - cy) <= radius;
}

const KINDS = {
  // Full-bleed background, the eye in the safe zone.
  maskable: (x, y) => ({ bg: 1, eye: inEye(x, y, 1) }),
  // Transparent outside a rounded square; a larger eye, because nothing will be cut off.
  any: (x, y) => ({ bg: inRoundedSquare(x, y) ? 1 : 0, eye: inEye(x, y, 1.15) }),
};

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** An 8-bit RGBA PNG of one icon kind, supersampled 4×4 for smooth edges. */
export function png(size, kind, colors = iconColors()) {
  const ss = 4;
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      let cover = 0;
      let eye = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const p = KINDS[kind]((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size);
          cover += p.bg;
          if (p.bg && p.eye) eye++;
        }
      }
      const i = y * stride + 1 + x * 4;
      const t = cover ? eye / cover : 0;
      for (let c = 0; c < 3; c++)
        raw[i + c] = Math.round(colors.bg[c] * (1 - t) + colors.fg[c] * t);
      raw[i + 3] = Math.round((cover / (ss * ss)) * 255);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Every icon file: name, size and kind. */
export const ICONS = [
  { file: 'icon-any-192.png', size: 192, kind: 'any' },
  { file: 'icon-any-512.png', size: 512, kind: 'any' },
  { file: 'icon-maskable-192.png', size: 192, kind: 'maskable' },
  { file: 'icon-maskable-512.png', size: 512, kind: 'maskable' },
  { file: 'icon-32.png', size: 32, kind: 'any' }, // favicon
  { file: 'icon-180.png', size: 180, kind: 'maskable' }, // apple-touch-icon: full-bleed
];

export const ICONS_DIR = resolve(import.meta.dirname, '..', 'public', 'icons');

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  mkdirSync(ICONS_DIR, { recursive: true });
  const colors = iconColors();
  for (const { file, size, kind } of ICONS) {
    writeFileSync(resolve(ICONS_DIR, file), png(size, kind, colors));
    console.log(`icons/${file}`);
  }
}
