// Generates the placeholder app icons (an abstract eye) as PNGs, using only Node built-ins.
// Run: node scripts/generate-icons.mjs. The real icon comes with the mock-ups spec (004).
// The content stays inside the central 80% circle, so the same image is a valid maskable icon:
// https://web.dev/articles/maskable-icon
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { resolve } from 'node:path';

const BG = [43, 79, 172]; // ≈ --primary (light), oklch(45% 0.16 260)
const FG = [252, 252, 252]; // ≈ --bg (light)

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

/** Coverage of the "white" shape at (x, y) in unit coordinates (0..1): an eye with a pupil. */
function shape(x, y) {
  const dx = x - 0.5;
  const dy = y - 0.5;
  // Almond (eye) shape: intersection of two circles, inside the maskable safe zone.
  const r = 0.36;
  const offset = 0.22;
  const inEye = Math.hypot(dx, dy - offset) < r && Math.hypot(dx, dy + offset) < r;
  const inPupil = Math.hypot(dx, dy) < 0.09;
  return inEye && !inPupil;
}

function png(size) {
  const ss = 4; // supersampling for smooth edges
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < ss; sy++)
        for (let sx = 0; sx < ss; sx++)
          if (shape((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size)) hits++;
      const t = hits / (ss * ss);
      const i = y * (size * 3 + 1) + 1 + x * 3;
      for (let c = 0; c < 3; c++) raw[i + c] = Math.round(BG[c] * (1 - t) + FG[c] * t);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = resolve(import.meta.dirname, '..', 'public', 'icons');
mkdirSync(out, { recursive: true });
for (const size of [32, 180, 192, 512]) {
  writeFileSync(resolve(out, `icon-${size}.png`), png(size));
  console.log(`icons/icon-${size}.png`);
}
