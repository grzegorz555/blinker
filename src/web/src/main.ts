import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { installDefaultPolicy, type TrustedTypesFactory } from './trusted-types';

// ADR-0004: before Angular registers the service worker.
installDefaultPolicy(
  (globalThis as { trustedTypes?: TrustedTypesFactory }).trustedTypes,
  () => document.baseURI,
);

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
