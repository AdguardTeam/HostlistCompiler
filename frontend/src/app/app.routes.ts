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
        title: 'Home',
        data: { metaDescription: 'Compile, validate, and transform adblock filter lists in real-time. Open-source compiler-as-a-service with streaming, batch, and async modes.' },
    },
    {
        path: 'sign-in',
        loadComponent: () => import('./auth/sign-in/sign-in.component').then((m) => m.SignInComponent),
        title: 'Sign In',
    },
    {
        path: 'sign-up',
        loadComponent: () => import('./auth/sign-up/sign-up.component').then((m) => m.SignUpComponent),
        title: 'Sign Up',
    },
    // Common auth path aliases — redirect to canonical routes so users
    // arriving via /login, /log-in, /register etc. land on the right page.
    // pathMatch: 'full' ensures only the exact alias path is redirected;
    // any nested segments (e.g. /login/callback) are not inadvertently consumed.
    { path: 'login', redirectTo: 'sign-in', pathMatch: 'full' },
    { path: 'log-in', redirectTo: 'sign-in', pathMatch: 'full' },
    { path: 'register', redirectTo: 'sign-up', pathMatch: 'full' },
    { path: 'signup', redirectTo: 'sign-up', pathMatch: 'full' },
    {
        path: 'compiler',
        loadComponent: () => import('./compiler/compiler.component').then((m) => m.CompilerComponent),
        title: 'Compiler',
        data: { description: 'Configure and run filter list compilations', metaDescription: 'Configure and compile adblock filter lists with real-time SSE streaming, batch processing, and async queue modes. Supports custom transformations and presets.' },
    },
    {
        path: 'performance',
        loadComponent: () => import('./performance/performance.component').then((m) => m.PerformanceComponent),
        title: 'Performance',
        data: { description: 'Real-time compilation performance metrics', metaDescription: 'Monitor real-time compilation performance metrics including latency percentiles, cache hit rates, and endpoint response times.' },
    },
    {
        path: 'validation',
        loadComponent: () => import('./validation/validation.component').then((m) => m.ValidationComponent),
        title: 'Validation',
        data: { description: 'Validate adblock filter rules', metaDescription: 'Validate adblock filter rules using the AGTree parser with color-coded error reporting and syntax highlighting.' },
    },
    {
        path: 'api-docs',
        loadComponent: () => import('./api-docs/api-docs.component').then((m) => m.ApiDocsComponent),
        title: 'API Reference',
        data: { description: 'HTTP API endpoint documentation', metaDescription: 'Complete HTTP API reference for the Adblock Compiler service. Covers compile, stream, batch, async, AST parse, metrics, and queue endpoints.' },
    },
    {
        path: 'api-keys',
        loadComponent: () => import('./components/api-keys/api-keys.component').then((m) => m.ApiKeysComponent),
        title: 'API Keys',
        data: { description: 'Manage API keys', metaDescription: 'Create and manage personal API keys for programmatic access to the Adblock Compiler service.' },
        canActivate: [() => import('./guards/auth.guard').then((m) => m.authGuard)],
    },
    {
        path: 'admin',
        loadComponent: () => import('./admin/admin.component').then((m) => m.AdminComponent),
        title: 'Admin',
        data: { description: 'Storage administration', metaDescription: 'Adblock Compiler storage administration. Manage KV, R2, and D1 storage backends.' },
        canActivate: [() => import('./guards/admin.guard').then((m) => m.adminGuard)],
    },
    {
        path: '**',
        redirectTo: '',
    },
];
