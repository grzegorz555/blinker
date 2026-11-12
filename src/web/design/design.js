// Mock-up behaviour (spec 004, R7). Plain DOM code only: textContent, attributes and `hidden`, never innerHTML,
// so the pages run under the production CSP and Trusted Types (R2). T3 adds the state switcher and the signal
// simulator; for now it only marks that the script ran, which the e2e test checks.
document.documentElement.dataset['js'] = 'ready';
