/**
 * Angular - Server Routes Configuration
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
        // Home and Compiler use client-side rendering: they contain MatSlideToggle
        // bound via ngModel/FormControl, which calls writeValue during SSR and
        // crashes the server renderer (Angular Material DOM access in Node.js).
        path: '',
        renderMode: RenderMode.Client,
    },
    {
        path: 'compiler',
        renderMode: RenderMode.Client,
    },
    {
        // All other routes use server-side rendering (rendered per request).
        path: '**',
        renderMode: RenderMode.Server,
    },
];
