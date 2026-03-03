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

/**
 * Base URL for admin endpoints (e.g. '/admin/storage').
 * Separated from API_BASE_URL to avoid fragile string manipulation.
 */
export const ADMIN_BASE_URL = new InjectionToken<string>('ADMIN_BASE_URL', {
    providedIn: 'root',
    factory: () => '/admin/storage',
});

/**
 * Endpoint for client-side error/log reporting.
 * The Cloudflare Worker backend ingests structured log payloads here.
 * Set to empty string to disable backend reporting.
 */
export const LOG_ENDPOINT = new InjectionToken<string>('LOG_ENDPOINT', {
    providedIn: 'root',
    factory: () => '/api/log',
});

/**
 * Cloudflare Turnstile public site key.
 * Empty string disables the widget. In production, provide a real key via
 * `{ provide: TURNSTILE_SITE_KEY, useValue: '0x...' }` in app.config.ts,
 * or fetch it from `/api/turnstile-config` at runtime.
 */
export const TURNSTILE_SITE_KEY = new InjectionToken<string>('TURNSTILE_SITE_KEY', {
    providedIn: 'root',
    factory: () => '',
});
