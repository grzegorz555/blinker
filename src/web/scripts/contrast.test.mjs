// Tests for contrast.mjs (spec 004, R3, R4): npm run test:scripts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PAIRS,
  checkTokenSets,
  contrastRatio,
  inSrgbGamut,
  mergeTokenSets,
  readProjectTokenSets,
  readTokenSets,
  resolveVars,
  toLinearSrgb,
} from './contrast.mjs';

const close = (actual, expected, digits = 2) =>
  assert.ok(Math.abs(actual - expected) < 10 ** -digits, `${actual} ≈ ${expected}`);

describe('contrastRatio (WCAG formula)', () => {
  it('gives 21:1 for black on white and 1:1 for a color on itself', () => {
    close(contrastRatio('#ffffff', '#000000'), 21);
    close(contrastRatio('oklch(100% 0 0)', 'oklch(0% 0 0)'), 21, 1);
    close(contrastRatio('#767676', '#767676'), 1);
  });

  it('matches the well-known #767676 on white = 4.54:1 (the lightest AA gray)', () => {
    close(contrastRatio('#767676', '#ffffff'), 4.54);
  });

  it('is the same in both directions', () => {
    close(
      contrastRatio('oklch(45% 0.16 260)', '#ffffff'),
      contrastRatio('#ffffff', 'oklch(45% 0.16 260)'),
      9,
    );
  });
});

describe('toLinearSrgb (OKLCH via OKLab)', () => {
  it('maps OKLCH white, black and sRGB blue to their sRGB values', () => {
    toLinearSrgb('oklch(100% 0 0)').forEach((c) => close(c, 1, 3));
    toLinearSrgb('oklch(0 0 0)').forEach((c) => close(c, 0, 3));
    // sRGB #0000ff is oklch(45.2% 0.313 264.05) in CSS Color 4.
    const [r, g, b] = toLinearSrgb('oklch(45.2% 0.313 264.05)');
    close(r, 0, 2);
    close(g, 0, 2);
    close(b, 1, 2);
  });

  it('accepts an alpha part and rejects other color syntaxes', () => {
    assert.doesNotThrow(() => toLinearSrgb('oklch(50% 0.1 200 / 50%)'));
    assert.throws(() => toLinearSrgb('rgb(0 0 0)'), /unsupported color/);
  });

  it('knows when a color is outside the sRGB gamut', () => {
    assert.equal(inSrgbGamut('oklch(50% 0.1 250)'), true);
    assert.equal(inSrgbGamut('oklch(70% 0.35 150)'), false);
  });
});

describe('readTokenSets', () => {
  it('reads :root as the app set (light, and dark inside the media query)', () => {
    const sets = readTokenSets(
      ':root { --bg: oklch(99% 0 0); color: red; }' +
        '@media (prefers-color-scheme: dark) { :root { --bg: oklch(18% 0 0); } }',
    );
    assert.deepEqual(sets, {
      app: { light: { bg: 'oklch(99% 0 0)' }, dark: { bg: 'oklch(18% 0 0)' } },
    });
  });

  it('splits light-dark() of a style (or a T2 direction) into its two schemes', () => {
    const style = readTokenSets(
      "[data-style='base'] { --bg: light-dark(oklch(99% 0 0), oklch(15% 0 0)); }",
    );
    assert.deepEqual(style.base, {
      light: { bg: 'oklch(99% 0 0)' },
      dark: { bg: 'oklch(15% 0 0)' },
    });
    const sets = readTokenSets(
      "[data-direction='b'] { --fg: light-dark(oklch(0% 0 0), oklch(100% 0 0)); }",
    );
    assert.deepEqual(sets.b, { light: { fg: 'oklch(0% 0 0)' }, dark: { fg: 'oklch(100% 0 0)' } });
  });
});

describe('checkTokenSets', () => {
  const good = {
    bg: 'oklch(100% 0 0)',
    surface: 'oklch(96% 0 0)',
    fg: 'oklch(0% 0 0)',
    muted: 'oklch(40% 0 0)',
    primary: 'oklch(40% 0.15 260)',
    'on-primary': 'oklch(100% 0 0)',
    border: 'oklch(45% 0 0)',
    highlight: 'oklch(40% 0.15 260)',
    'primary-container': 'oklch(94% 0.02 260)',
    'on-primary-container': 'oklch(20% 0.08 260)',
    'secondary-container': 'oklch(92% 0.02 260)',
    'on-secondary-container': 'oklch(20% 0.03 260)',
  };

  it('passes a set where every pair meets its threshold', () => {
    assert.deepEqual(checkTokenSets({ x: { light: good, dark: good } }).problems, []);
  });

  it('fails a pair below its threshold and names it (negative test)', () => {
    const weak = { ...good, fg: 'oklch(50% 0 0)' }; // about 4.5:1 on white, below the 7:1 AAC level
    const { problems } = checkTokenSets({ x: { light: weak, dark: good } });
    assert.equal(problems.length, 3); // fg on bg, on surface and on primary-container
    assert.match(problems[0], /^x\/light: fg\/bg = \d\.\d\d:1, needs 7:1/);
  });

  it('fails a direction that misses a token, and a color outside the gamut', () => {
    const { bg: _bg, ...withoutBg } = good;
    const { problems } = checkTokenSets({
      x: { light: withoutBg, dark: { ...good, highlight: 'oklch(70% 0.35 150)' } },
    });
    assert.ok(problems.includes('x/light: missing --bg'));
    assert.ok(problems.some((p) => /x\/dark: --highlight .* outside the sRGB gamut/.test(p)));
  });
});

describe('resolveVars and mergeTokenSets', () => {
  it('follows var() aliases, also through two steps, and drops unknown references', () => {
    assert.deepEqual(
      resolveVars({
        primary: 'oklch(45% 0.16 260)',
        highlight: 'var(--primary)',
        ring: 'var(--highlight)',
        ghost: 'var(--missing)',
      }),
      {
        primary: 'oklch(45% 0.16 260)',
        highlight: 'oklch(45% 0.16 260)',
        ring: 'oklch(45% 0.16 260)',
      },
    );
  });

  it('merges the same set from two files instead of replacing it', () => {
    const merged = mergeTokenSets(
      { app: { light: { bg: 'a', fg: 'b' }, dark: { bg: 'c' } } },
      { app: { light: { highlight: 'var(--fg)' }, dark: {} }, m3: { light: {}, dark: {} } },
    );
    assert.deepEqual(merged.app.light, { bg: 'a', fg: 'b', highlight: 'var(--fg)' });
    assert.deepEqual(merged.app.dark, { bg: 'c' });
    assert.ok(merged.m3);
  });
});

describe('the project tokens (R3, R4)', () => {
  it('has the app set and the m3 mock-up style', () => {
    assert.deepEqual(Object.keys(readProjectTokenSets()).sort(), ['app', 'm3']);
  });

  it('meets every contrast threshold in light and dark', () => {
    assert.deepEqual(checkTokenSets(readProjectTokenSets()).problems, []);
  });

  it('checks the AAC pairs at 7:1', () => {
    for (const pair of [
      'fg/bg',
      'fg/surface',
      'on-primary-container/primary-container',
      'fg/primary-container',
    ]) {
      assert.equal(PAIRS.find(([a, b]) => `${a}/${b}` === pair)?.[2], 7, pair);
    }
  });
});
