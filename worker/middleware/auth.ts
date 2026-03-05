/**
 * API Key Authentication Middleware
 *
 * Authenticates requests using Bearer tokens that map to API keys
 * stored in PlanetScale PostgreSQL via Hyperdrive. Falls back to
 * the static ADMIN_KEY for backward compatibility.
 *
 * Authentication flow:
 *   1. Extract Bearer token from Authorization header
 *   2. Hash token with SHA-256
 *   3. Look up hash in api_keys table via Hyperdrive
 *   4. Validate: not revoked, not expired, has required scope
 *   5. Return authenticated context (userId, apiKeyId, scopes)
 */

import type { HyperdriveBinding } from '../types.ts';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of API key authentication.
 */
export interface ApiKeyAuthResult {
    authenticated: boolean;
    userId?: string;
    apiKeyId?: string;
    scopes?: string[];
    error?: string;
}

/**
 * Authenticated request context attached after successful auth.
 */
export interface AuthContext {
    userId: string;
    apiKeyId: string;
    scopes: string[];
}

/**
 * Minimal pg Pool interface for auth queries.
 */
interface PgPool {
    query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
}

/**
 * Factory to create a pg Pool from a connection string.
 */
export type PgPoolFactory = (connectionString: string) => PgPool;

// ============================================================================
// Token Hashing
// ============================================================================

/**
 * Hashes an API key token using SHA-256.
 * Uses the Web Crypto API available in Cloudflare Workers.
 */
async function hashToken(token: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Extracts Bearer token from the Authorization header.
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

// ============================================================================
// Authentication
// ============================================================================

/**
 * Authenticates a request using an API key stored in PostgreSQL.
 *
 * @param request - Incoming HTTP request
 * @param hyperdrive - Cloudflare Hyperdrive binding
 * @param createPool - Factory to create a pg Pool
 * @param requiredScope - Scope the API key must have (e.g., 'compile', 'admin')
 * @returns Authentication result with user context
 *
 * @example
 * ```typescript
 * const auth = await authenticateApiKey(request, env.HYPERDRIVE, poolFactory, 'compile');
 * if (!auth.authenticated) {
 *     return JsonResponse.error(auth.error, 401);
 * }
 * // auth.userId, auth.apiKeyId, auth.scopes are available
 * ```
 */
export async function authenticateApiKey(
    request: Request,
    hyperdrive: HyperdriveBinding,
    createPool: PgPoolFactory,
    requiredScope?: string,
): Promise<ApiKeyAuthResult> {
    const token = extractBearerToken(request);
    if (!token) {
        return { authenticated: false, error: 'Missing or invalid Authorization header. Use: Bearer <api-key>' };
    }

    const keyHash = await hashToken(token);
    const pool = createPool(hyperdrive.connectionString);

    try {
        const result = await pool.query<{
            id: string;
            user_id: string;
            scopes: string[];
            rate_limit_per_minute: number;
            expires_at: string | null;
            revoked_at: string | null;
        }>(
            `SELECT id, user_id, scopes, rate_limit_per_minute, expires_at, revoked_at
             FROM api_keys
             WHERE key_hash = $1`,
            [keyHash],
        );

        if (result.rows.length === 0) {
            return { authenticated: false, error: 'Invalid API key' };
        }

        const apiKey = result.rows[0];

        // Check if revoked
        if (apiKey.revoked_at) {
            return { authenticated: false, error: 'API key has been revoked' };
        }

        // Check if expired
        if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
            return { authenticated: false, error: 'API key has expired' };
        }

        // Check scope
        if (requiredScope && !apiKey.scopes.includes(requiredScope)) {
            return {
                authenticated: false,
                error: `API key missing required scope: ${requiredScope}`,
            };
        }

        // Update last_used_at (fire-and-forget, don't block the response)
        pool.query(
            `UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`,
            [apiKey.id],
        ).catch(() => { /* intentional: non-critical update */ });

        return {
            authenticated: true,
            userId: apiKey.user_id,
            apiKeyId: apiKey.id,
            scopes: apiKey.scopes,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { authenticated: false, error: `Authentication service error: ${message}` };
    }
}

/**
 * Combined auth check: tries API key auth via Hyperdrive first,
 * falls back to static ADMIN_KEY for backward compatibility.
 *
 * Use this for admin routes during the migration period.
 *
 * @param request - Incoming HTTP request
 * @param env - Partial env with ADMIN_KEY and optional HYPERDRIVE
 * @param createPool - Optional pg Pool factory (required if HYPERDRIVE is set)
 * @returns Authentication result
 */
export async function authenticateRequest(
    request: Request,
    env: { ADMIN_KEY?: string; HYPERDRIVE?: HyperdriveBinding },
    createPool?: PgPoolFactory,
): Promise<ApiKeyAuthResult> {
    // Try API key auth if Hyperdrive is available
    const token = extractBearerToken(request);
    if (token && env.HYPERDRIVE && createPool) {
        return authenticateApiKey(request, env.HYPERDRIVE, createPool, 'admin');
    }

    // Fall back to static ADMIN_KEY
    const adminKey = request.headers.get('X-Admin-Key');
    if (!env.ADMIN_KEY) {
        return { authenticated: false, error: 'Authentication not configured' };
    }
    if (!adminKey || adminKey !== env.ADMIN_KEY) {
        return { authenticated: false, error: 'Unauthorized' };
    }

    return { authenticated: true };
}
