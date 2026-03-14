/**
 * Tests for the centralized CORS utility (ZTA Phase 1).
 */
import { assertEquals, assertExists } from '@std/assert';
import { getCorsHeaders, getPublicCorsHeaders, handleCorsPreflight, isPublicEndpoint, matchOrigin, parseAllowedOrigins } from './cors.ts';
import type { Env } from '../types.ts';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeEnv(origins?: string): Partial<Env> {
    return origins !== undefined ? { CORS_ALLOWED_ORIGINS: origins } as unknown as Partial<Env> : {};
}

function makeRequest(origin?: string): Request {
    const headers = new Headers();
    if (origin) headers.set('Origin', origin);
    return new Request('https://example.com', { headers });
}

// ── parseAllowedOrigins ──────────────────────────────────────────────────────

Deno.test('parseAllowedOrigins - returns defaults when env is undefined', () => {
    const origins = parseAllowedOrigins(undefined);
    assertEquals(origins.length, 4);
    assertEquals(origins[0], 'http://localhost:4200');
});

Deno.test('parseAllowedOrigins - returns defaults when env has no CORS_ALLOWED_ORIGINS', () => {
    const origins = parseAllowedOrigins(makeEnv(undefined) as Env);
    assertEquals(origins.length, 4);
});

Deno.test('parseAllowedOrigins - returns defaults when CORS_ALLOWED_ORIGINS is empty', () => {
    const origins = parseAllowedOrigins(makeEnv('') as Env);
    assertEquals(origins.length, 4);
});

Deno.test('parseAllowedOrigins - parses comma-separated origins', () => {
    const origins = parseAllowedOrigins(makeEnv('https://a.com, https://b.com') as Env);
    assertEquals(origins, ['https://a.com', 'https://b.com']);
});

Deno.test('parseAllowedOrigins - trims whitespace', () => {
    const origins = parseAllowedOrigins(makeEnv('  https://a.com ,  https://b.com  ') as Env);
    assertEquals(origins, ['https://a.com', 'https://b.com']);
});

Deno.test('parseAllowedOrigins - filters empty entries', () => {
    const origins = parseAllowedOrigins(makeEnv('https://a.com,,https://b.com,') as Env);
    assertEquals(origins, ['https://a.com', 'https://b.com']);
});

// ── matchOrigin ──────────────────────────────────────────────────────────────

Deno.test('matchOrigin - returns null for null origin', () => {
    assertEquals(matchOrigin(null), null);
});

Deno.test('matchOrigin - matches default localhost', () => {
    assertEquals(matchOrigin('http://localhost:4200'), 'http://localhost:4200');
});

Deno.test('matchOrigin - rejects unknown origin with defaults', () => {
    assertEquals(matchOrigin('https://evil.com'), null);
});

Deno.test('matchOrigin - matches configured origin', () => {
    const env = makeEnv('https://app.example.com') as Env;
    assertEquals(matchOrigin('https://app.example.com', env), 'https://app.example.com');
});

Deno.test('matchOrigin - rejects origin not in configured list', () => {
    const env = makeEnv('https://app.example.com') as Env;
    assertEquals(matchOrigin('https://evil.com', env), null);
});

// ── isPublicEndpoint ─────────────────────────────────────────────────────────

Deno.test('isPublicEndpoint - /health is public', () => {
    assertEquals(isPublicEndpoint('/health'), true);
});

Deno.test('isPublicEndpoint - /api/version is public', () => {
    assertEquals(isPublicEndpoint('/api/version'), true);
});

Deno.test('isPublicEndpoint - /metrics is public', () => {
    assertEquals(isPublicEndpoint('/metrics'), true);
});

Deno.test('isPublicEndpoint - /turnstile-config is public', () => {
    assertEquals(isPublicEndpoint('/turnstile-config'), true);
});

Deno.test('isPublicEndpoint - /compile is NOT public', () => {
    assertEquals(isPublicEndpoint('/compile'), false);
});

Deno.test('isPublicEndpoint - /admin is NOT public', () => {
    assertEquals(isPublicEndpoint('/admin'), false);
});

Deno.test('isPublicEndpoint - /workflow/list is NOT public', () => {
    assertEquals(isPublicEndpoint('/workflow/list'), false);
});

Deno.test('isPublicEndpoint - /api-keys is NOT public', () => {
    assertEquals(isPublicEndpoint('/api-keys'), false);
});

// ── getCorsHeaders ───────────────────────────────────────────────────────────

Deno.test('getCorsHeaders - reflects allowed origin', () => {
    const req = makeRequest('http://localhost:4200');
    const headers = getCorsHeaders(req);
    assertEquals(headers['Access-Control-Allow-Origin'], 'http://localhost:4200');
    assertEquals(headers['Vary'], 'Origin');
});

Deno.test('getCorsHeaders - omits ACAO for disallowed origin', () => {
    const req = makeRequest('https://evil.com');
    const headers = getCorsHeaders(req);
    assertEquals(headers['Access-Control-Allow-Origin'], undefined);
    assertEquals(headers['Vary'], 'Origin');
});

Deno.test('getCorsHeaders - omits ACAO when no Origin header', () => {
    const req = makeRequest();
    const headers = getCorsHeaders(req);
    assertEquals(headers['Access-Control-Allow-Origin'], undefined);
    assertEquals(headers['Vary'], 'Origin');
});

Deno.test('getCorsHeaders - uses env-configured origins', () => {
    const req = makeRequest('https://myapp.com');
    const env = makeEnv('https://myapp.com,https://other.com') as Env;
    const headers = getCorsHeaders(req, env);
    assertEquals(headers['Access-Control-Allow-Origin'], 'https://myapp.com');
});

// ── getPublicCorsHeaders ─────────────────────────────────────────────────────

Deno.test('getPublicCorsHeaders - returns wildcard', () => {
    const headers = getPublicCorsHeaders();
    assertEquals(headers['Access-Control-Allow-Origin'], '*');
});

// ── handleCorsPreflight ──────────────────────────────────────────────────────

Deno.test('handleCorsPreflight - reflects allowed origin', () => {
    const req = makeRequest('http://localhost:4200');
    const res = handleCorsPreflight(req);
    assertEquals(res.status, 204);
    assertEquals(res.headers.get('Access-Control-Allow-Origin'), 'http://localhost:4200');
    assertExists(res.headers.get('Access-Control-Allow-Methods'));
    assertExists(res.headers.get('Access-Control-Allow-Headers'));
    assertEquals(res.headers.get('Access-Control-Max-Age'), '86400');
    assertEquals(res.headers.get('Vary'), 'Origin');
});

Deno.test('handleCorsPreflight - omits ACAO for disallowed origin', () => {
    const req = makeRequest('https://evil.com');
    const res = handleCorsPreflight(req);
    assertEquals(res.status, 204);
    assertEquals(res.headers.get('Access-Control-Allow-Origin'), null);
});

Deno.test('handleCorsPreflight - allows wildcard when no Origin header (same-origin)', () => {
    const req = makeRequest();
    const res = handleCorsPreflight(req);
    assertEquals(res.status, 204);
    assertEquals(res.headers.get('Access-Control-Allow-Origin'), '*');
});

Deno.test('handleCorsPreflight - includes Authorization in allowed headers', () => {
    const req = makeRequest('http://localhost:4200');
    const res = handleCorsPreflight(req);
    const allowed = res.headers.get('Access-Control-Allow-Headers') ?? '';
    assertEquals(allowed.includes('Authorization'), true);
    assertEquals(allowed.includes('X-Admin-Key'), true);
    assertEquals(allowed.includes('X-Turnstile-Token'), true);
});
