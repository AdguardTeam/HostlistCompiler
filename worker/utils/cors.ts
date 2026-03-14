/**
 * Centralized CORS utility for Zero Trust Architecture.
 *
 * All CORS headers flow through this module. Authenticated/write endpoints
 * use an env-configurable origin allowlist; public read-only endpoints
 * may use a wildcard.
 */

import type { Env } from '../types.ts';

/**
 * Public read-only endpoints that are safe to serve to any origin.
 * Everything else requires the allowlist.
 */
const PUBLIC_ENDPOINT_PREFIXES = [
    '/api/version',
    '/api/health',
    '/api/metrics',
    '/api/turnstile-config',
    '/api/clerk-config',
    '/api/deployments',
    '/health',
    '/metrics',
    '/turnstile-config',
    '/clerk-config',
    '/deployments',
] as const;

/** Fallback origins when CORS_ALLOWED_ORIGINS is not configured */
const DEFAULT_ALLOWED_ORIGINS: readonly string[] = [
    'http://localhost:4200', // Angular dev server
    'http://localhost:8787', // Wrangler dev
    'http://127.0.0.1:4200',
    'http://127.0.0.1:8787',
];

/**
 * Parse the comma-separated CORS_ALLOWED_ORIGINS env var into an array.
 * Falls back to DEFAULT_ALLOWED_ORIGINS if not set.
 */
export function parseAllowedOrigins(env?: Env): string[] {
    const raw = (env as Record<string, unknown> | undefined)?.['CORS_ALLOWED_ORIGINS'] as string | undefined;
    if (!raw || raw.trim() === '') {
        return [...DEFAULT_ALLOWED_ORIGINS];
    }
    return raw.split(',').map((o) => o.trim()).filter(Boolean);
}

/**
 * Check whether an origin is in the allowlist.
 * Returns the origin itself (for reflection) or null if not allowed.
 */
export function matchOrigin(origin: string | null, env?: Env): string | null {
    if (!origin) return null;
    const allowed = parseAllowedOrigins(env);
    return allowed.includes(origin) ? origin : null;
}

/**
 * Returns whether the given URL path is a public read-only endpoint.
 */
export function isPublicEndpoint(pathname: string): boolean {
    return PUBLIC_ENDPOINT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

// ── Header builders ─────────────────────────────────────────────────────────

/**
 * CORS headers for authenticated / write endpoints.
 * Reflects the request Origin if it's in the allowlist; otherwise omits the header.
 */
export function getCorsHeaders(request: Request, env?: Env): Record<string, string> {
    const origin = request.headers.get('Origin');
    const allowed = matchOrigin(origin, env);
    if (allowed) {
        return {
            'Access-Control-Allow-Origin': allowed,
            'Vary': 'Origin',
        };
    }
    // No matching origin — omit Access-Control-Allow-Origin entirely
    return { 'Vary': 'Origin' };
}

/**
 * CORS headers for public read-only endpoints. Uses wildcard `*`.
 */
export function getPublicCorsHeaders(): Record<string, string> {
    return {
        'Access-Control-Allow-Origin': '*',
    };
}

/**
 * Full CORS preflight response with origin reflection.
 */
export function handleCorsPreflight(request: Request, env?: Env): Response {
    const origin = request.headers.get('Origin');
    const allowed = matchOrigin(origin, env);

    const headers: Record<string, string> = {
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Key, X-Turnstile-Token',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin',
    };

    if (allowed) {
        headers['Access-Control-Allow-Origin'] = allowed;
    }
    // No matching origin (or no Origin header) — omit Access-Control-Allow-Origin.
    // Browsers always send Origin on preflight; non-browser clients don't need CORS.

    return new Response(null, { status: 204, headers });
}
