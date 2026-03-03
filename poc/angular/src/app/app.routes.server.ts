/**
 * Angular PoC - Server Routes Configuration
 *
 * Angular SSR rendering modes per route:
 *
 *   RenderMode.Prerender  — rendered once at build time (SSG).
 *     Best for static content that never changes between requests.
 *     The Home dashboard has no user-specific or request-specific data,
 *     so it qualifies for prerendering. The HTML is cached in CDN/edge.
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
        // Home is fully static — prerender it at build time (SSG).
        // This eliminates server compute on every request and allows CDN caching.
        path: '',
        renderMode: RenderMode.Prerender,
    },
    {
        // All other routes use server-side rendering (rendered per request).
        path: '**',
        renderMode: RenderMode.Server,
    },
];
