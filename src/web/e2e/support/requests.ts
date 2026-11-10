import type { Page } from '@playwright/test';

/**
 * Collects every request the page makes to an origin other than its own.
 * Privacy rule: Blinker never talks to third parties (docs/conventions/security.md).
 */
export function collectThirdPartyRequests(page: Page, baseURL: string): string[] {
  const ownOrigin = new URL(baseURL).origin;
  const thirdParty: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith('http') && url.origin !== ownOrigin) thirdParty.push(request.url());
  });
  return thirdParty;
}
