import { Routes } from '@angular/router';
import { authGuard, loginGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [loginGuard],
    loadComponent: () =>
      import('./features/login/login').then((m) => m.LoginComponent),
  },
  {
    path: 'play',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/game/game-page').then((m) => m.GamePageComponent),
  },
  { path: '', pathMatch: 'full', redirectTo: 'play' },
  { path: '**', redirectTo: 'play' },
];
