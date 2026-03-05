/**
 * Angular - Application Configuration (Server)
 *
 * Angular 21 SSR Pattern: Server-specific providers merged with browser config
 * Adds server-side rendering providers on top of the base app config
 *
 * Angular SSR 21.1+ Pattern: provideServerRendering(withRoutes()) replaces the
 * old provideServerRendering() + provideServerRoutesConfig() pair.
 */

import { mergeApplicationConfig, ApplicationConfig, inject } from '@angular/core';
import { provideServerRendering, withRoutes, REQUEST } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { API_BASE_URL } from './tokens';

/**
 * Factory for `API_BASE_URL` in SSR contexts.
 *
 * Extracts the origin from the incoming `REQUEST` so that server-side HTTP
 * calls use a fully-qualified URL (e.g. `https://example.workers.dev/api`).
 * There is no browser origin server-side, so a relative `/api` path would
 * not resolve.
 *
 * Falls back to `'/api'` when:
 *   - `REQUEST` is not provided (prerendering / static generation)
 *   - The request URL is malformed and `new URL()` throws
 *
 * Exported for unit testing — the spec imports this function directly so
 * tests always exercise the exact production implementation.
 */
export function ssrApiBaseUrlFactory(): string {
    const request = inject(REQUEST, { optional: true });
    if (request?.url) {
        try {
            const { origin } = new URL(request.url);
            return `${origin}/api`;
        } catch {
            // Malformed request URL — fall through to relative default.
        }
    }
    return '/api';
}

const serverConfig: ApplicationConfig = {
    providers: [
        provideServerRendering(withRoutes(serverRoutes)),

        // Override API base URL for SSR — the server-side render needs an absolute
        // origin since there is no browser origin to resolve relative paths against.
        // Uses the same origin as the incoming request so this works on any deployment
        // (local wrangler dev, staging, production) without hardcoded hostnames.
        // The REQUEST token is injected with { optional: true } so prerendering /
        // static generation (where no request object exists) safely falls back to
        // the relative '/api' path.
        { provide: API_BASE_URL, useFactory: ssrApiBaseUrlFactory },
    ],
};

export const appServerConfig = mergeApplicationConfig(appConfig, serverConfig);
