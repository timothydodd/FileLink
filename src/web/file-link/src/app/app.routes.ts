import { Routes } from '@angular/router';
import { AuthGuard } from './_services/auth/auth-guard';

export const routes: Routes = [
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
    path: 'error/:errorCode',
    loadComponent: () => import('./pages/error-page/error-page.component').then((m) => m.ErrorPageComponent),
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
    data: { roles: ['Owner', 'Editor'], breadcrumb: 'Create', parent: { label: 'Links', url: '/links' } },
  },
  {
    path: 'view/:groupId',
    loadComponent: () =>
      import('./pages/upload-view-page/upload-view-page.component').then((m) => m.UploadViewPageComponent),
    canActivate: [AuthGuard],
    data: { roles: ['Owner', 'Editor', 'Reader'], breadcrumb: ':groupId', parent: { label: 'Links', url: '/links' } },
  },
  {
    path: 'links',
    loadComponent: () => import('./pages/links-page/links-page.component').then((m) => m.LinksPageComponent),
    canActivate: [AuthGuard],
    data: { roles: ['Owner'], breadcrumb: 'Links' },
  },
  {
    path: 'storage',
    loadComponent: () => import('./pages/storage-page/storage-page.component').then((m) => m.StoragePageComponent),
    canActivate: [AuthGuard],
    data: { roles: ['Owner'], breadcrumb: 'Storage' },
  },
  {
    path: 'audit-log',
    loadComponent: () =>
      import('./pages/audit-log-page/audit-log-page.component').then((m) => m.AuditLogPageComponent),
    canActivate: [AuthGuard],
    data: { roles: ['Owner'], breadcrumb: 'Activity Log' },
  },
  {
    path: '**',
    redirectTo: 'error/404',
  },
];
