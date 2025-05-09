import { Routes } from '@angular/router';
import { AuthGuard } from './_services/auth/auth-guard';

export const routes: Routes = [
  {
    path: '**',
    redirectTo: 'error/404',
    pathMatch: 'full',
  },
  {
    path: '',
    redirectTo: 'boot',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login-page/login-page.component').then((m) => m.LoginPageComponent),
  },
  {
    path: 'boot',
    loadComponent: () => import('./pages/brain-page/brain-page.component').then((m) => m.BrainPageComponent),
  },
  {
    path: 'l/:code',
    loadComponent: () =>
      import('./pages/link-route-page/link-route-page.component').then((m) => m.LinkRoutePageComponent),
  },
  {
    path: 'create',
    loadComponent: () =>
      import('./pages/upload-create-page/upload-create-page.component').then((m) => m.UploadCreatePageComponent),
    canActivate: [AuthGuard],
    data: { roles: ['Owner', 'Editor'] },
  },
  {
    path: 'view/:groupId',
    loadComponent: () =>
      import('./pages/upload-view-page/upload-view-page.component').then((m) => m.UploadViewPageComponent),
    canActivate: [AuthGuard],
    data: { roles: ['Owner', 'Editor', 'Reader'] },
  },
  {
    path: 'links',
    loadComponent: () => import('./pages/links-page/links-page.component').then((m) => m.LinksPageComponent),
    canActivate: [AuthGuard],
    data: { roles: ['Owner'] },
  },
];
