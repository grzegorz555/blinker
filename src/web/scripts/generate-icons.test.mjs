// Spec 004, T6: the app icons, separate "any" and "maskable" files (scripts/generate-icons.mjs).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import { inflateSync } from 'node:zlib';
import { contrastRatio } from './contrast.mjs';
import { ICONS, ICONS_DIR, iconColors, inEye, png } from './generate-icons.mjs';

/** Decodes an 8-bit RGBA PNG with filter 0 on every row (what generate-icons.mjs writes). */
function decode(buffer) {
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  assert.equal(buffer[24], 8, 'bit depth');
  assert.equal(buffer[25], 6, 'color type RGBA');
  const idat = [];
  for (let i = 8; i < buffer.length;) {
    const len = buffer.readUInt32BE(i);
    const type = buffer.toString('ascii', i + 4, i + 8);
    if (type === 'IDAT') idat.push(buffer.subarray(i + 8, i + 8 + len));
    i += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4 + 1;
  const at = (x, y) => {
    assert.equal(raw[y * stride], 0, 'filter none');
    const i = y * stride + 1 + x * 4;
    return [...raw.subarray(i, i + 4)];
  };
  return { width, height, at };
}

const read = (file) => readFileSync(resolve(ICONS_DIR, file));
const manifest = JSON.parse(readFileSync(resolve(ICONS_DIR, '..', 'manifest.webmanifest'), 'utf8'));

describe('app icons', () => {
  it('the committed files are what the generator makes from the current tokens', () => {
    const colors = iconColors();
    for (const { file, size, kind } of ICONS) {
      assert.ok(read(file).equals(png(size, kind, colors)), `${file} is stale: run npm run icons`);
    }
  });

  it('the manifest lists separate "any" and "maskable" files at 192 and 512 px, each with its real size', () => {
    for (const size of [192, 512]) {
      for (const purpose of ['any', 'maskable']) {
        const icons = manifest.icons.filter(
          (i) => i.sizes === `${size}x${size}` && i.purpose === purpose,
        );
        assert.equal(icons.length, 1, `${size} ${purpose}`);
        assert.equal(icons[0].src, `icons/icon-${purpose}-${size}.png`);
        const { width, height } = decode(read(`icon-${purpose}-${size}.png`));
        assert.deepEqual([width, height], [size, size]);
      }
    }
  });

  it('"any" has transparent corners; "maskable" is opaque to the edges', () => {
    const any = decode(read('icon-any-512.png'));
    const maskable = decode(read('icon-maskable-512.png'));
    for (const [x, y] of [
      [0, 0],
      [511, 0],
      [0, 511],
      [511, 511],
    ]) {
      assert.equal(any.at(x, y)[3], 0, `any corner ${x},${y}`);
      assert.equal(maskable.at(x, y)[3], 255, `maskable corner ${x},${y}`);
    }
  });

  it('"maskable" keeps the whole eye inside the safe zone (a circle of 40% of the size)', () => {
    const size = 512;
    const { at } = decode(read('icon-maskable-512.png'));
    const bg = [...iconColors().bg, 255];
    for (let y = 0; y < size; y += 4) {
      for (let x = 0; x < size; x += 4) {
        const r = Math.hypot((x + 0.5) / size - 0.5, (y + 0.5) / size - 0.5);
        if (r > 0.4) assert.deepEqual(at(x, y), bg, `pixel ${x},${y} outside the safe zone`);
      }
    }
  });

  it('the eye shape is inside the safe zone and ends where it should (negative check)', () => {
    // The corners of the almond reach sqrt(0.36² - 0.22²) ≈ 0.285 from the centre, well inside 0.40.
    assert.equal(inEye(0.5 + 0.28, 0.5), true);
    assert.equal(inEye(0.5 + 0.29, 0.5), false);
    assert.equal(inEye(0.5 + 0.29, 0.5, 1.15), true); // the larger eye of the any icon
    assert.equal(inEye(0.5, 0.5), false); // the pupil
  });

  it('draws the eye in --on-primary on --primary, at least 4.5:1 also after rounding to 8 bits', () => {
    const hex = (rgb) => '#' + rgb.map((c) => c.toString(16).padStart(2, '0')).join('');
    const { bg, fg } = iconColors();
    assert.ok(contrastRatio(hex(fg), hex(bg)) >= 4.5);
  });
});
