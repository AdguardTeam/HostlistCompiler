/**
 * Admin child routes — lazy-loaded panels inside the admin shell.
 *
 * Each route loads a standalone component on demand so the admin bundle
 * only includes code for panels the user actually visits.
 */

import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
    { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    {
        path: 'dashboard',
        loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent),
        title: 'Admin Dashboard',
    },
    {
        path: 'users',
        loadComponent: () => import('./users/users.component').then(m => m.UsersComponent),
        title: 'User Management',
    },
    {
        path: 'roles',
        loadComponent: () => import('./roles/roles.component').then(m => m.RolesComponent),
        title: 'Roles & Permissions',
    },
    {
        path: 'api-keys',
        loadComponent: () => import('./api-keys/api-keys.component').then(m => m.ApiKeysComponent),
        title: 'API Key Management',
    },
    {
        path: 'tiers',
        loadComponent: () => import('./tiers/tiers.component').then(m => m.TiersComponent),
        title: 'Tier Registry',
    },
    {
        path: 'scopes',
        loadComponent: () => import('./scopes/scopes.component').then(m => m.ScopesComponent),
        title: 'Scope Registry',
    },
    {
        path: 'endpoints',
        loadComponent: () => import('./endpoints/endpoints.component').then(m => m.EndpointsComponent),
        title: 'Endpoint Auth',
    },
    {
        path: 'feature-flags',
        loadComponent: () => import('./feature-flags/feature-flags.component').then(m => m.FeatureFlagsComponent),
        title: 'Feature Flags',
    },
    {
        path: 'observability',
        loadComponent: () => import('./observability/observability.component').then(m => m.ObservabilityComponent),
        title: 'Observability',
    },
    {
        path: 'audit-log',
        loadComponent: () => import('./audit-log/audit-log.component').then(m => m.AuditLogComponent),
        title: 'Audit Log',
    },
    {
        path: 'storage',
        loadComponent: () => import('./storage/storage.component').then(m => m.StorageComponent),
        title: 'Storage Tools',
    },
    {
        path: 'announcements',
        loadComponent: () => import('./announcements/announcements.component').then(m => m.AnnouncementsComponent),
        title: 'Announcements',
    },
    {
        path: 'webhooks',
        loadComponent: () => import('./webhooks/webhooks.component').then(m => m.WebhooksComponent),
        title: 'Webhooks',
    },
];
