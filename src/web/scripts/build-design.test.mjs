// Tests for build-design.mjs (spec 004, R2, R3): npm run test:scripts
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { buildDesign, findRawColors } from './build-design.mjs';

describe('findRawColors (R3)', () => {
  it('accepts token classes, fragment links and text that looks like a color', () => {
    const html =
      '<a class="bg-bg text-fg ring-primary border-border" href="#face-lost">#face</a>' +
      '<p class="text-muted outline-4">Kolor: white, black</p>';
    assert.deepEqual(findRawColors(html), []);
  });

  it('reports a style attribute', () => {
    assert.deepEqual(findRawColors('<p style="color: red">x</p>'), ['style attribute']);
  });

  it('reports arbitrary color values', () => {
    for (const cls of ['bg-[#ff0]', 'text-[rgb(0,0,0)]', 'ring-[oklch(50%_0.1_200)]']) {
      assert.deepEqual(findRawColors(`<p class="${cls}">x</p>`), ['arbitrary color value'], cls);
    }
  });

  it('reports Tailwind palette colors, with shade, opacity and variants', () => {
    for (const cls of ['bg-red-500', 'text-white', 'dark:border-slate-700', 'ring-blue-600/50']) {
      assert.deepEqual(findRawColors(`<p class="${cls}">x</p>`), ['Tailwind palette color'], cls);
    }
  });
});

describe('buildDesign', () => {
  let root, src, out;

  beforeEach(() => {
    // Inside the project (dist/ is git-ignored): Tailwind resolves 'tailwindcss' from the CSS file's folder.
    const dist = resolve(import.meta.dirname, '..', 'dist');
    mkdirSync(dist, { recursive: true });
    root = mkdtempSync(join(dist, '.test-design-'));
    src = join(root, 'design');
    out = join(root, 'out');
    mkdirSync(join(src, 'directions'), { recursive: true });
    // source(none) + @source './' scans only this temporary folder, like the real entry.
    writeFileSync(join(src, 'design.css'), "@import 'tailwindcss' source(none);\n@source './';\n");
    writeFileSync(
      join(src, 'index.html'),
      '<!doctype html><link rel="stylesheet" href="design.css"><script src="design.js"></script>' +
        '<p class="font-bold underline">x</p>',
    );
    writeFileSync(join(src, 'design.js'), 'document.title = "x";');
    writeFileSync(join(src, 'directions', 'a.html'), '<p class="italic">a</p>');
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('copies pages and scripts, keeps subfolders, and compiles only the classes the pages use', async () => {
    assert.deepEqual(await buildDesign({ src, out }), []);
    assert.ok(existsSync(join(out, 'index.html')));
    assert.ok(existsSync(join(out, 'design.js')));
    assert.ok(existsSync(join(out, 'directions', 'a.html')));
    const css = readFileSync(join(out, 'design.css'), 'utf8');
    for (const cls of ['.font-bold', '.underline', '.italic']) assert.ok(css.includes(cls), cls);
    assert.ok(!css.includes('.text-3xl'), 'unused classes are not generated');
  });

  it('removes files left over from a previous build', async () => {
    mkdirSync(out);
    writeFileSync(join(out, 'old.html'), 'x');
    await buildDesign({ src, out });
    assert.ok(!existsSync(join(out, 'old.html')));
  });

  it('reports raw colors and inline code with the page name (R2, R3)', async () => {
    writeFileSync(
      join(src, 'directions', 'b.html'),
      '<p class="bg-red-500">b</p><script>alert(1)</script><button onclick="x()">x</button>',
    );
    assert.deepEqual((await buildDesign({ src, out })).sort(), [
      'Tailwind palette color: directions/b.html',
      'inline <script>: directions/b.html',
      'inline event handler (on...=): directions/b.html',
    ]);
  });
});
