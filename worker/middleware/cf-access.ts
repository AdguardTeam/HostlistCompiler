/**
 * Cloudflare Access JWT Verification Middleware
 *
 * Verifies Cloudflare Access JWTs for admin route protection.
 * Defense-in-depth: admin routes require BOTH the X-Admin-Key header
 * AND a valid CF Access JWT (when CF Access is configured).
 *
 * Authentication flow:
 *   1. Extract `CF-Access-JWT-Assertion` header
 *   2. Fetch JWKS from `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`
 *   3. Verify JWT signature, audience, issuer, and expiration using `jose`
 *   4. Return typed result with email and identity claims
 *
 * When CF_ACCESS_TEAM_DOMAIN or CF_ACCESS_AUD are not configured, verification
 * is skipped (returns success) — this allows local development without CF Access.
 *
 * @see https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/
 */

import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTVerifyGetKey } from 'jose';
import type { Env } from '../types.ts';

// ============================================================================
// Types
// ============================================================================

/** Result of CF Access JWT verification. */
export interface CfAccessVerificationResult {
    /** Whether the verification passed. */
    valid: boolean;
    /** User email from the CF Access JWT (when valid). */
    email?: string;
    /** CF Access identity (sub claim). */
    identity?: string;
    /** Error message on failure. */
    error?: string;
}

// ============================================================================
// JWKS Cache (module-level singleton per Worker isolate)
// ============================================================================

const cfAccessJwksCache = new Map<string, JWTVerifyGetKey>();

/**
 * Returns a cached JWKS resolver for the CF Access certs URL.
 */
function getCfAccessJwksResolver(certsUrl: string): JWTVerifyGetKey {
    let resolver = cfAccessJwksCache.get(certsUrl);
    if (!resolver) {
        resolver = createRemoteJWKSet(new URL(certsUrl));
        cfAccessJwksCache.set(certsUrl, resolver);
    }
    return resolver;
}

// ============================================================================
// Verification
// ============================================================================

/**
 * Verify a Cloudflare Access JWT from the request headers.
 *
 * @param request - Incoming HTTP request
 * @param env - Worker environment (needs CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD)
 * @returns Verification result with email/identity on success
 *
 * @example
 * ```ts
 * const cfAccess = await verifyCfAccessJwt(request, env);
 * if (!cfAccess.valid) {
 *     return JsonResponse.forbidden(cfAccess.error ?? 'CF Access verification failed');
 * }
 * // cfAccess.email and cfAccess.identity are available
 * ```
 */
export async function verifyCfAccessJwt(request: Request, env: Env): Promise<CfAccessVerificationResult> {
    // If CF Access is not configured, skip verification (local dev / non-Access deployments)
    if (!env.CF_ACCESS_TEAM_DOMAIN || !env.CF_ACCESS_AUD) {
        return { valid: true };
    }

    // Extract the CF Access JWT from the standard header
    const token = request.headers.get('CF-Access-JWT-Assertion');
    if (!token) {
        return {
            valid: false,
            error: 'Missing CF-Access-JWT-Assertion header — request must pass through Cloudflare Access',
        };
    }

    try {
        const teamDomain = env.CF_ACCESS_TEAM_DOMAIN;
        const certsUrl = `https://${teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs`;
        const issuer = `https://${teamDomain}.cloudflareaccess.com`;

        const jwks = getCfAccessJwksResolver(certsUrl);

        const { payload } = await jwtVerify(token, jwks, {
            issuer,
            audience: env.CF_ACCESS_AUD,
        });

        const email = payload.email as string | undefined;
        const identity = payload.sub;

        return {
            valid: true,
            email: email ?? undefined,
            identity: identity ?? undefined,
        };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            valid: false,
            error: `CF Access JWT verification failed: ${message}`,
        };
    }
}
