// Spec 006, T4: the keyboard mapping (R7, SC 2.1.4).
import { DEFAULT_KEYBOARD, KEY_MAP, keyToSignal, listenToKeys, type KeyLike } from './keyboard';
import { INPUT_SIGNALS, type InputSignal } from './signals';

const on = { enabled: true };
const key = (k: string, extra: Partial<KeyLike> = {}): KeyLike => ({
  key: k,
  repeat: false,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  target: document.body,
  ...extra,
});

describe('keyToSignal', () => {
  it('is off by default (SC 2.1.4)', () => {
    expect(DEFAULT_KEYBOARD.enabled).toBe(false);
    expect(keyToSignal(key(' '), DEFAULT_KEYBOARD)).toBeNull();
  });

  it('maps each key to its signal when turned on, upper or lower case', () => {
    expect([' ', 'h', 'n', 's', 'r', 'p'].map((k) => keyToSignal(key(k), on))).toEqual([
      'BLINK',
      'HAND',
      'NOD',
      'SHAKE',
      'RIGHT',
      'PAUSE',
    ]);
    expect(keyToSignal(key('H'), on)).toBe('HAND');
  });

  it('covers every input signal exactly once', () => {
    expect(Object.values(KEY_MAP).sort()).toEqual([...INPUT_SIGNALS].sort());
  });

  it('ignores other keys, key repeats and keys with Ctrl, Alt or Meta', () => {
    expect(keyToSignal(key('x'), on)).toBeNull();
    expect(keyToSignal(key('Enter'), on)).toBeNull();
    expect(keyToSignal(key(' ', { repeat: true }), on)).toBeNull();
    expect(keyToSignal(key('s', { ctrlKey: true }), on)).toBeNull();
    expect(keyToSignal(key('p', { altKey: true }), on)).toBeNull();
    expect(keyToSignal(key('r', { metaKey: true }), on)).toBeNull();
  });

  it('keeps Space for a focused button, link or switch, but maps letters there', () => {
    const button = document.createElement('button');
    const link = Object.assign(document.createElement('a'), { href: '#x' });
    const toggle = Object.assign(document.createElement('div'), { role: 'switch' });
    toggle.setAttribute('role', 'switch');
    for (const target of [button, link, toggle]) {
      expect(keyToSignal(key(' ', { target }), on), target.tagName).toBeNull();
      expect(keyToSignal(key('n', { target }), on), target.tagName).toBe('NOD');
    }
  });

  it('never takes a key typed into a text field, even inside other elements', () => {
    const input = document.createElement('input');
    const area = document.createElement('textarea');
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    const inner = document.createElement('span');
    editable.append(inner);
    for (const target of [input, area, inner]) {
      expect(keyToSignal(key('s', { target }), on)).toBeNull();
      expect(keyToSignal(key(' ', { target }), on)).toBeNull();
    }
  });
});

describe('listenToKeys', () => {
  it('sends mapped keys to the sink, prevents the default (no page scroll), and stops when detached', () => {
    const got: InputSignal[] = [];
    let settings = { enabled: true };
    const stop = listenToKeys(
      document,
      () => settings,
      (s) => got.push(s),
    );

    const space = new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true });
    document.body.dispatchEvent(space);
    expect(got).toEqual([{ type: 'BLINK' }]);
    expect(space.defaultPrevented).toBe(true);

    settings = { enabled: false }; // turned off at once
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }));
    expect(got).toHaveLength(1);

    settings = { enabled: true };
    stop();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }));
    expect(got).toHaveLength(1);
  });

  it('leaves an unmapped key alone (no preventDefault)', () => {
    const stop = listenToKeys(
      document,
      () => ({ enabled: true }),
      () => undefined,
    );
    const tab = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true, bubbles: true });
    document.body.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(false);
    stop();
  });
});
