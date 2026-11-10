import { Routes } from '@angular/router';

// `title` is a translation key, translated by TranslatedTitleStrategy (spec 001, R3).
export const routes: Routes = [
  {
    path: '',
    title: 'titles.home',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
  },
  {
    path: '**',
    title: 'titles.notFound',
    loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFound),
  },
];
