/**
 * Angular - Application Routes Configuration
 *
 * ANGULAR ROUTER PATTERN: Declarative routing with standalone components
 *
 * Key Router Features Demonstrated:
 * 1. Lazy Loading      - loadComponent() splits code by route (smaller initial bundle)
 * 2. Route Titles      - title property updates the browser tab automatically
 * 3. Route Data        - Static metadata attached to routes, readable via ActivatedRoute
 * 4. Wildcard Route    - '**' catches all unmatched URLs and redirects to home
 */

import { Routes } from '@angular/router';

/**
 * Application Routes
 *
 * ANGULAR ROUTER: Using loadComponent() for automatic code splitting.
 * Angular compiles each lazily-loaded component into a separate JS chunk that
 * is only fetched from the network when the user navigates to that route.
 * This reduces the initial bundle size and improves Time-to-Interactive.
 */
export const routes: Routes = [
    {
        path: '',
        loadComponent: () => import('./home/home.component').then((m) => m.HomeComponent),
        title: 'Home - Adblock Compiler',
    },
    {
        path: 'compiler',
        loadComponent: () => import('./compiler/compiler.component').then((m) => m.CompilerComponent),
        title: 'Compiler - Adblock Compiler',
        data: { description: 'Configure and run filter list compilations' },
    },
    {
        path: 'performance',
        loadComponent: () => import('./performance/performance.component').then((m) => m.PerformanceComponent),
        title: 'Performance - Adblock Compiler',
        data: { description: 'Real-time compilation performance metrics' },
    },
    {
        path: 'validation',
        loadComponent: () => import('./validation/validation.component').then((m) => m.ValidationComponent),
        title: 'Validation - Adblock Compiler',
        data: { description: 'Validate adblock filter rules' },
    },
    {
        path: 'api-docs',
        loadComponent: () => import('./api-docs/api-docs.component').then((m) => m.ApiDocsComponent),
        title: 'API Reference - Adblock Compiler',
        data: { description: 'HTTP API endpoint documentation' },
    },
    {
        path: 'admin',
        loadComponent: () => import('./admin/admin.component').then((m) => m.AdminComponent),
        title: 'Admin - Adblock Compiler',
        data: { description: 'Storage administration' },
        canActivate: [() => import('./guards/admin.guard').then((m) => m.adminGuard)],
    },
    {
        path: '**',
        redirectTo: '',
    },
];
