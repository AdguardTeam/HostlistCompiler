/**
 * Clerk JWT Verification Middleware
 *
 * Verifies Clerk-issued JWTs on Cloudflare Workers using the `jose` library.
 * Uses `createRemoteJWKSet()` for automatic JWKS fetching and caching.
 *
 * Authentication flow:
 *   1. Extract Bearer token from Authorization header or `__session` cookie
 *   2. Fetch/cache JWKS from Clerk's well-known endpoint
 *   3. Verify JWT signature, expiration, and claims
 *   4. Return typed `IJwtVerificationResult` with decoded claims
 *   5. Graceful fallback: missing token → `{ valid: false }` (anonymous OK)
 *
 * @see https://clerk.com/docs/backend-requests/handling/manual-jwt
 */

import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTVerifyGetKey } from 'jose';
import type { Env, IClerkClaims, IJwtVerificationResult } from '../types.ts';

// ============================================================================
// JWKS Cache (module-level singleton per Worker isolate)
// ============================================================================

/**
 * Module-level cache for JWKS key sets, keyed by JWKS URL.
 * `createRemoteJWKSet()` handles its own HTTP caching internally,
 * but we avoid recreating the function on every request.
 */
const jwksCache = new Map<string, JWTVerifyGetKey>();

/**
 * Returns a cached JWKS resolver for the given URL.
 * Creates one on first call; subsequent calls return the cached instance.
 */
function getJwksResolver(jwksUrl: string): JWTVerifyGetKey {
    let resolver = jwksCache.get(jwksUrl);
    if (!resolver) {
        resolver = createRemoteJWKSet(new URL(jwksUrl));
        jwksCache.set(jwksUrl, resolver);
    }
    return resolver;
}

// ============================================================================
// Token Extraction
// ============================================================================

/**
 * Extracts a Bearer token from the Authorization header.
 * Returns null if no valid Bearer token is present.
 */
function extractBearerToken(request: Request): string | null {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return null;

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;

    const token = parts[1].trim();
    return token.length > 0 ? token : null;
}

/**
 * Extracts the Clerk session token from the `__session` cookie.
 * Clerk's frontend SDK sets this cookie automatically.
 */
function extractSessionCookie(request: Request): string | null {
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) return null;

    const cookies = cookieHeader.split(';');
    for (const cookie of cookies) {
        const [name, ...valueParts] = cookie.trim().split('=');
        if (name === '__session') {
            const value = valueParts.join('=').trim();
            return value.length > 0 ? value : null;
        }
    }
    return null;
}

/**
 * Extracts a JWT token from the request, checking:
 *   1. Authorization: Bearer <token> header (preferred)
 *   2. __session cookie (Clerk's cookie-based auth)
 */
function extractToken(request: Request): string | null {
    return extractBearerToken(request) ?? extractSessionCookie(request);
}

// ============================================================================
// JWT Verification
// ============================================================================

/**
 * Verifies a Clerk-issued JWT from the incoming request.
 *
 * Returns `{ valid: true, claims }` on success, or `{ valid: false, error }`
 * on failure. If no token is present, returns `{ valid: false }` without an
 * error message — this is the expected anonymous flow.
 *
 * @param request - Incoming HTTP request
 * @param env - Worker environment bindings (needs CLERK_JWKS_URL)
 * @returns JWT verification result with optional decoded claims
 *
 * @example
 * ```typescript
 * const result = await verifyClerkJWT(request, env);
 * if (result.valid) {
 *     // result.claims is populated
 *     console.log('Authenticated user:', result.claims.sub);
 * } else if (result.error) {
 *     // Token was present but invalid
 *     return new Response('Unauthorized', { status: 401 });
 * }
 * // No token and no error = anonymous request (OK)
 * ```
 */
export async function verifyClerkJWT(
    request: Request,
    env: Env,
): Promise<IJwtVerificationResult> {
    // Bail out if Clerk is not configured
    if (!env.CLERK_JWKS_URL) {
        return { valid: false };
    }

    const token = extractToken(request);
    if (!token) {
        return { valid: false };
    }

    try {
        const jwks = getJwksResolver(env.CLERK_JWKS_URL);

        const { payload } = await jwtVerify(token, jwks, {
            // Clerk tokens use RS256 by default
            algorithms: ['RS256'],
            // Clock tolerance of 5 seconds to account for slight skew
            clockTolerance: 5,
        });

        const claims = payload as unknown as IClerkClaims;

        // Validate issuer is a Clerk domain
        if (claims.iss && !isClerkIssuer(claims.iss)) {
            return { valid: false, error: 'Invalid token issuer' };
        }

        // Validate authorized party (azp) if present and we have a known origin
        const requestOrigin = request.headers.get('Origin');
        if (claims.azp && requestOrigin && claims.azp !== requestOrigin) {
            return { valid: false, error: 'Token authorized party mismatch' };
        }

        return { valid: true, claims };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        // Distinguish between expected errors and unexpected failures
        if (isExpectedJwtError(message)) {
            return { valid: false, error: `JWT verification failed: ${message}` };
        }

        // Unexpected error — log but still return invalid
        console.error('[clerk-jwt] Unexpected verification error:', message);
        return { valid: false, error: 'JWT verification failed' };
    }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Validates that the issuer is a Clerk domain.
 * Clerk issuers follow the pattern: https://<instance>.clerk.accounts.dev
 */
function isClerkIssuer(issuer: string): boolean {
    try {
        const url = new URL(issuer);
        return url.hostname.endsWith('.clerk.accounts.dev') ||
            url.hostname.endsWith('.clerk.com');
    } catch {
        return false;
    }
}

/**
 * Returns true for JWT errors that are expected (expired, malformed, etc.)
 * as opposed to unexpected infrastructure failures.
 */
function isExpectedJwtError(message: string): boolean {
    const expectedPatterns = [
        'exp', // expired
        'nbf', // not yet valid
        'iat', // issued at
        'JWS', // signature error
        'JWK', // key error
        'alg', // algorithm mismatch
        'compact', // malformed token
        'decode', // decode failure
        'invalid', // generic invalid
    ];
    const lowerMessage = message.toLowerCase();
    return expectedPatterns.some((pattern) => lowerMessage.includes(pattern.toLowerCase()));
}
