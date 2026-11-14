import { Routes } from '@angular/router';

// `title` is a translation key, translated by TranslatedTitleStrategy (spec 001, R3).
export const routes: Routes = [
  {
    path: '',
    title: 'titles.home',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
  },
  {
    // The Angular Material spike (spec 007, T1); removed in T6.
    path: 'spike',
    title: 'titles.spike',
    loadComponent: () => import('./features/spike/spike').then((m) => m.Spike),
  },
  {
    path: '**',
    title: 'titles.notFound',
    loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFound),
  },
];
