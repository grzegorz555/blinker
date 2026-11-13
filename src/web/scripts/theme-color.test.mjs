// Spec 004, T6: theme-color comes from the tokens (scripts/theme-color.mjs).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readIndexColors, themeColorProblems, themeColors, toHex } from './theme-color.mjs';

describe('toHex', () => {
  it('converts known OKLCH colors to sRGB hex', () => {
    assert.equal(toHex('oklch(100% 0 0)'), '#ffffff');
    assert.equal(toHex('oklch(0% 0 0)'), '#000000');
    // oklch(62.8% 0.2577 29.23) is sRGB red (CSS Color 4 example).
    assert.equal(toHex('oklch(62.8% 0.2577 29.23)'), '#ff0000');
  });

  it('keeps a hex color as it is', () => {
    assert.equal(toHex('#2b4fac'), '#2b4fac');
  });
});

describe('theme-color in index.html and the manifest', () => {
  it('equals --bg of the tokens in light and dark, and the manifest uses the light one', () => {
    assert.deepEqual(themeColorProblems(), []);
  });

  it('is the page color, not the accent: light is near white, dark is near black', () => {
    const { light, dark } = themeColors();
    const sum = (hex) => [1, 3, 5].reduce((s, i) => s + parseInt(hex.slice(i, i + 2), 16), 0);
    assert.ok(sum(light) > 700, light);
    assert.ok(sum(dark) < 80, dark);
  });

  it('reports a mismatch (negative test)', () => {
    const html =
      '<meta name="theme-color" content="#000000" media="(prefers-color-scheme: light)" />' +
      '<meta name="theme-color" content="#0c0e14" media="(prefers-color-scheme: dark)" />';
    const colors = { light: '#f9fafe', dark: '#0c0e14' };
    const problems = themeColorProblems(colors, html, {
      theme_color: '#f9fafe',
      background_color: '#ffffff',
    });
    assert.equal(problems.length, 2);
    assert.match(problems[0], /theme-color \(light\) is #000000/);
    assert.match(problems[1], /background_color/);
  });

  it('reads one value per scheme from the meta tags', () => {
    const html =
      '<meta name="theme-color" content="#111111" media="(prefers-color-scheme: light)" />\n' +
      '<meta name="theme-color" content="#222222" media="(prefers-color-scheme: dark)" />';
    assert.deepEqual(readIndexColors(html), { light: '#111111', dark: '#222222' });
  });
});
