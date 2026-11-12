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

  // Disclosure buttons (the caregiver menu, R12): aria-expanded on the button, `hidden` on the panel.
  // https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/
  const screen = document.querySelector('.screen');
  for (const button of document.querySelectorAll('[data-disclosure]')) {
    const panel = document.getElementById(button.getAttribute('aria-controls'));
    if (!panel) continue;
    const setOpen = (open) => {
      button.setAttribute('aria-expanded', String(open));
      panel.hidden = !open;
      if (screen) screen.dataset['menu'] = open ? 'open' : 'closed';
    };
    button.addEventListener('click', () =>
      setOpen(button.getAttribute('aria-expanded') !== 'true'),
    );
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        button.focus();
      }
    });
  }

  root.dataset['js'] = 'ready';
})();
