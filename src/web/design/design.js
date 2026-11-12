// Mock-up behaviour (spec 004, R7). Plain DOM code only: textContent, attributes and `hidden`, never innerHTML,
// so the pages run under the production CSP and Trusted Types (R2). T3 adds the state switcher and the signal
// simulator.
(function () {
  'use strict';
  const root = document.documentElement;
  const params = new URLSearchParams(location.search);
  const ALLOWED = { direction: ['a', 'b', 'c'], scheme: ['auto', 'light', 'dark'] };

  /** A URL parameter, only if it is one of the allowed values (the URL is untrusted input). */
  function pick(key, fallback) {
    const value = params.get(key);
    return ALLOWED[key].includes(value) ? value : fallback;
  }

  // Pages with a visual direction (T2) can switch it with ?direction= and the color scheme with ?scheme=.
  const current = {
    direction: root.dataset['direction'] ? pick('direction', root.dataset['direction']) : null,
    scheme: pick('scheme', 'auto'),
  };
  if (current.direction) root.dataset['direction'] = current.direction;
  if (current.scheme === 'auto') delete root.dataset['scheme'];
  else root.dataset['scheme'] = current.scheme;

  // Switcher links keep the other setting and mark the current one.
  for (const link of document.querySelectorAll('a[data-set]')) {
    const [key, value] = link.dataset['set'].split('=');
    const next = new URLSearchParams();
    if (current.direction) next.set('direction', current.direction);
    next.set('scheme', current.scheme);
    next.set(key, value);
    link.search = next.toString();
    if (current[key] === value) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  }

  root.dataset['js'] = 'ready';
})();
