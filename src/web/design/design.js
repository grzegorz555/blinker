// Mock-up behaviour (spec 004). Plain DOM code only: textContent, attributes and `hidden`, never innerHTML,
// so the pages run under the production CSP and Trusted Types (R2). T4 adds the communicate states and the signal
// simulator (R7).
(function () {
  'use strict';
  const root = document.documentElement;
  const params = new URLSearchParams(location.search);
  const SCHEMES = ['auto', 'light', 'dark'];

  // ?scheme=light|dark forces a color scheme; the URL is untrusted input, so only known values count.
  const scheme = SCHEMES.includes(params.get('scheme')) ? params.get('scheme') : 'auto';
  if (scheme === 'auto') delete root.dataset['scheme'];
  else root.dataset['scheme'] = scheme;

  // Links to other mock-ups keep the forced scheme; the switcher links mark the current one.
  for (const link of document.querySelectorAll('a[href]')) {
    const url = new URL(link.href);
    if (url.origin !== location.origin) continue;
    const set = link.dataset['set'];
    if (set) {
      const value = set.split('=')[1];
      url.search = `?scheme=${value}`;
      if (value === scheme) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    } else if (scheme !== 'auto') {
      url.searchParams.set('scheme', scheme);
    }
    link.href = url.href;
  }

  // Liczenie: a tap on a letter adds it to the sentence, "Cofnij literę" removes the last one added (a board cell
  // can hold two letters, e.g. SZ). The polite live region announces both (SC 4.1.3).
  const sentence = document.querySelector('[data-sentence]');
  const announce = document.querySelector('[data-announce]');
  const added = [];
  const say = (text) => {
    if (announce) announce.textContent = text;
  };
  for (const cell of document.querySelectorAll('.cell-btn')) {
    cell.addEventListener('click', () => {
      const letter = cell.textContent.trim();
      added.push(letter);
      sentence.textContent += letter;
      say(`Dodano ${letter}`);
    });
  }
  document.querySelector('[data-undo]')?.addEventListener('click', () => {
    // A trailing space (after a word) stays, so the next letter starts the next word.
    const text = sentence.textContent.trimEnd();
    const trailing = sentence.textContent.slice(text.length);
    const last = added.pop() ?? text.slice(-1);
    if (!last || !text.endsWith(last)) return;
    sentence.textContent = text.slice(0, -last.length) + trailing;
    say(`Usunięto ${last}`);
  });

  // Pause: a toggle button (aria-pressed); the mode status says what is happening in words.
  const pause = document.querySelector('[data-pause]');
  const modeText = document.querySelector('[data-mode-text]');
  pause?.addEventListener('click', () => {
    const paused = pause.getAttribute('aria-pressed') !== 'true';
    pause.setAttribute('aria-pressed', String(paused));
    if (modeText) modeText.textContent = paused ? 'Wstrzymane' : 'Automat: widzę twarz';
  });

  root.dataset['js'] = 'ready';
})();
