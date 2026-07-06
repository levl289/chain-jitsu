import { Routes } from '@angular/router';
import {
  authGuard,
  loginGuard,
  provisionGuard,
  setupGuard,
} from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'setup',
    canActivate: [setupGuard],
    loadComponent: () =>
      import('./features/setup/setup-needed').then((m) => m.SetupNeededComponent),
  },
  {
    path: 'login',
    canActivate: [provisionGuard, loginGuard],
    loadComponent: () =>
      import('./features/login/login').then((m) => m.LoginComponent),
  },
  {
    path: 'play',
    canActivate: [provisionGuard, authGuard],
    loadComponent: () =>
      import('./features/game/game-page').then((m) => m.GamePageComponent),
  },
  { path: '', pathMatch: 'full', redirectTo: 'play' },
  { path: '**', redirectTo: 'play' },
];
