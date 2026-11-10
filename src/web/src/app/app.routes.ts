import { Routes } from '@angular/router';

// Titles are plain strings for now; spec 001 T5 translates them with a TitleStrategy.
export const routes: Routes = [
  {
    path: '',
    title: 'Blinker',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
  },
  {
    path: '**',
    title: 'Page not found · Blinker',
    loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFound),
  },
];
