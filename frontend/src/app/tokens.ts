/**
 * Application-wide injection tokens.
 *
 * API_BASE_URL is provided differently per environment:
 *   - Browser (app.config.ts):        '/api'  (relative, same origin)
 *   - SSR     (app.config.server.ts):  absolute Worker URL (e.g. 'https://adblock-compiler.<account>.workers.dev/api')
 *
 * This prevents SSR from attempting fetches against a relative origin
 * that doesn't exist server-side.
 */

import { InjectionToken } from '@angular/core';

/**
 * Base URL for all API calls (e.g. '/api' in browser, absolute URL in SSR).
 * Injected into services via `inject(API_BASE_URL)`.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
    providedIn: 'root',
    factory: () => '/api',
});
