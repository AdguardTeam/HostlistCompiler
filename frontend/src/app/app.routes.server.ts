/**
 * Angular - Server Routes Configuration
 *
 * Angular SSR rendering modes per route:
 *
 *   RenderMode.Prerender  — rendered once at build time (SSG).
 *     Best for static content that never changes between requests.
 *     Routes prerendered here are served from the CDN with zero Worker invocations.
 *
 *   RenderMode.Server     — rendered on each request (SSR).
 *     Required when content is dynamic or user-specific (Compiler, Benchmark).
 *
 *   RenderMode.Client     — no server rendering (CSR).
 *     Use only when SSR/SSG is impossible (e.g. heavy canvas/WebGL components).
 *
 * Multi-mode SSR is a key Angular 21 capability: different routes use the most
 * appropriate rendering strategy, optimising both performance and freshness.
 */

import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
    {
        // Home dashboard: no request-specific data — prerender once at build time (SSG).
        // mat-slide-toggle bindings converted from ngModel to [checked]/(change),
        // removing the FormsModule writeValue() SSR crash.
        path: '',
        renderMode: RenderMode.Prerender,
    },
    {
        // Auth routes: Clerk SDK is browser-only (loads JS, mounts UI into DOM).
        // CSR is the only viable mode — no server rendering possible.
        path: 'sign-in',
        renderMode: RenderMode.Client,
    },
    {
        path: 'sign-up',
        renderMode: RenderMode.Client,
    },
    {
        // Compiler: dynamic (form state, SSE connections, query params) — SSR per request.
        // mat-button-toggle-group converted from [(ngModel)] to [value]/(change).
        path: 'compiler',
        renderMode: RenderMode.Server,
    },
    {
        // API docs: serves static OpenAPI documentation — never changes between deploys.
        // Prerender once at build time; serve from CDN with zero Worker invocations.
        path: 'api-docs',
        renderMode: RenderMode.Prerender,
    },
    {
        // Validation: static UI shell — AGTree parser runs entirely client-side.
        // Prerender the shell at build time.
        path: 'validation',
        renderMode: RenderMode.Prerender,
    },
    {
        // All other routes (performance, admin, etc.) — SSR per request.
        path: '**',
        renderMode: RenderMode.Server,
    },
];
