/**
 * Tests for Cloudflare Access JWT Verification Middleware.
 *
 * Covers:
 *   - Skip verification when CF Access is not configured (local dev)
 *   - Missing CF-Access-JWT-Assertion header
 *   - Invalid JWT token (signature verification failure)
 *
 * Note: We cannot generate valid JWTs signed by CF Access in tests, so
 * we test the error paths and the skip-when-unconfigured path.
 */

import { assertEquals } from '@std/assert';
import { verifyCfAccessJwt } from './cf-access.ts';
import type { Env } from '../types.ts';

// ============================================================================
// Fixtures
// ============================================================================

function makeEnv(overrides: Partial<Env> = {}): Env {
    return {
        CF_ACCESS_TEAM_DOMAIN: 'myteam',
        CF_ACCESS_AUD: 'aud_test_123456',
        ...overrides,
    } as unknown as Env;
}

// ============================================================================
// Skip when not configured
// ============================================================================

Deno.test('verifyCfAccessJwt - returns valid when CF_ACCESS_TEAM_DOMAIN is not set', async () => {
    const req = new Request('https://example.com/admin/auth/users');
    const result = await verifyCfAccessJwt(req, makeEnv({ CF_ACCESS_TEAM_DOMAIN: undefined }));
    assertEquals(result.valid, true);
    assertEquals(result.email, undefined);
    assertEquals(result.identity, undefined);
});

Deno.test('verifyCfAccessJwt - returns valid when CF_ACCESS_AUD is not set', async () => {
    const req = new Request('https://example.com/admin/auth/users');
    const result = await verifyCfAccessJwt(req, makeEnv({ CF_ACCESS_AUD: undefined }));
    assertEquals(result.valid, true);
});

Deno.test('verifyCfAccessJwt - returns valid when both CF_ACCESS fields are empty', async () => {
    const req = new Request('https://example.com/admin/auth/users');
    const result = await verifyCfAccessJwt(req, makeEnv({ CF_ACCESS_TEAM_DOMAIN: '', CF_ACCESS_AUD: '' }));
    assertEquals(result.valid, true);
});

// ============================================================================
// Missing header
// ============================================================================

Deno.test('verifyCfAccessJwt - returns invalid when CF-Access-JWT-Assertion header is missing', async () => {
    const req = new Request('https://example.com/admin/auth/users');
    const result = await verifyCfAccessJwt(req, makeEnv());
    assertEquals(result.valid, false);
    assertEquals(typeof result.error, 'string');
    assertEquals(result.error!.includes('Missing'), true);
});

// ============================================================================
// Invalid token
// ============================================================================

Deno.test('verifyCfAccessJwt - returns invalid for malformed JWT', async () => {
    const req = new Request('https://example.com/admin/auth/users', {
        headers: {
            'CF-Access-JWT-Assertion': 'not.a.valid.jwt',
        },
    });

    const result = await verifyCfAccessJwt(req, makeEnv());
    assertEquals(result.valid, false);
    assertEquals(typeof result.error, 'string');
    assertEquals(result.error!.includes('failed'), true);
});

Deno.test('verifyCfAccessJwt - returns invalid for expired/bad JWT', async () => {
    // Create a structurally valid but unsigned JWT (header.payload.signature)
    const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).replace(/=/g, '');
    const payload = btoa(JSON.stringify({
        sub: 'test-user',
        email: 'test@example.com',
        iss: 'https://myteam.cloudflareaccess.com',
        aud: ['aud_test_123456'],
        exp: Math.floor(Date.now() / 1000) - 3600, // expired
    })).replace(/=/g, '');
    const fakeToken = `${header}.${payload}.fake_signature`;

    const req = new Request('https://example.com/admin/auth/users', {
        headers: {
            'CF-Access-JWT-Assertion': fakeToken,
        },
    });

    const result = await verifyCfAccessJwt(req, makeEnv());
    assertEquals(result.valid, false);
    assertEquals(typeof result.error, 'string');
});
