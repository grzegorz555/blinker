import { Routes } from '@angular/router';
import type { ShellData } from './app';

// `title` is a translation key, translated by TranslatedTitleStrategy (spec 001, R3).
// `data` tells the shell the page heading and whether the page must fit the screen (spec 007 R2, R4).
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'titles.counting',
    data: { heading: 'nav.counting', fit: true } satisfies ShellData,
    loadComponent: () => import('./features/counting/counting-page').then((m) => m.CountingPage),
  },
  {
    path: 'sentences',
    title: 'titles.sentences',
    data: { heading: 'nav.sentences' } satisfies ShellData,
    loadComponent: () => import('./features/sentences/sentences-page').then((m) => m.SentencesPage),
  },
  {
    path: 'boards',
    title: 'titles.boards',
    data: { heading: 'nav.boards' } satisfies ShellData,
    loadComponent: () => import('./features/boards/boards-page').then((m) => m.BoardsPage),
  },
  {
    path: 'settings',
    title: 'titles.settings',
    data: { heading: 'nav.settings' } satisfies ShellData,
    loadComponent: () => import('./features/settings/settings-page').then((m) => m.SettingsPage),
  },
  {
    // The Angular Material spike (spec 007, T1); removed in T6.
    path: 'spike',
    title: 'titles.spike',
    data: { heading: 'spike.title' } satisfies ShellData,
    loadComponent: () => import('./features/spike/spike').then((m) => m.Spike),
  },
  {
    path: '**',
    title: 'titles.notFound',
    data: { heading: 'notFound.heading' } satisfies ShellData,
    loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFound),
  },
];
