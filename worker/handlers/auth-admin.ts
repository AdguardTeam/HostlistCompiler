/**
 * Auth Admin Handlers
 *
 * Admin endpoints for managing users and API keys via Hyperdrive.
 * All endpoints require admin authentication (ADMIN_KEY or admin-scoped API key).
 *
 * Endpoints:
 *   POST /admin/auth/users       — Create a user
 *   POST /admin/auth/api-keys    — Create an API key for a user
 *   POST /admin/auth/api-keys/revoke — Revoke an API key
 *   GET  /admin/auth/api-keys    — List API keys for a user
 */

import type { HyperdriveBinding } from '../types.ts';
import { JsonResponse } from '../utils/response.ts';
import { generateApiKey, hashKey } from '../middleware/api-key-utils.ts';
import { CreateUserSchema, CreateApiKeySchema } from '../../src/storage/schemas.ts';

// ============================================================================
// Types
// ============================================================================

interface PgPool {
    query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
}

type PgPoolFactory = (connectionString: string) => PgPool;

// ============================================================================
// Handlers
// ============================================================================

/**
 * Creates a new user.
 *
 * Request body: { email: string, displayName?: string, role?: 'admin' | 'user' | 'readonly' }
 * Response: { id: string, email: string, role: string }
 */
export async function handleCreateUser(
    request: Request,
    hyperdrive: HyperdriveBinding,
    createPool: PgPoolFactory,
): Promise<Response> {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return JsonResponse.error('Invalid JSON body', 400);
    }

    const parsed = CreateUserSchema.safeParse(body);
    if (!parsed.success) {
        return JsonResponse.error(`Validation error: ${parsed.error.message}`, 400);
    }

    const { email, displayName, role } = parsed.data;
    const pool = createPool(hyperdrive.connectionString);

    try {
        // Check for existing user
        const existing = await pool.query<{ id: string }>(
            `SELECT id FROM users WHERE email = $1`,
            [email],
        );
        if (existing.rows.length > 0) {
            return JsonResponse.error('User with this email already exists', 409);
        }

        const result = await pool.query<{ id: string; email: string; role: string }>(
            `INSERT INTO users (email, display_name, role)
             VALUES ($1, $2, $3)
             RETURNING id, email, role`,
            [email, displayName ?? null, role],
        );

        return JsonResponse.success({ user: result.rows[0] }, { status: 201 });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return JsonResponse.error(`Failed to create user: ${message}`, 500);
    }
}

/**
 * Creates a new API key for a user.
 *
 * Request body: { userId: string, name: string, scopes?: string[], rateLimitPerMinute?: number, expiresAt?: string }
 * Response: { apiKey: string, keyPrefix: string, id: string }
 *
 * IMPORTANT: The raw API key is only returned once. Store it securely.
 */
export async function handleCreateApiKey(
    request: Request,
    hyperdrive: HyperdriveBinding,
    createPool: PgPoolFactory,
): Promise<Response> {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return JsonResponse.error('Invalid JSON body', 400);
    }

    const parsed = CreateApiKeySchema.safeParse(body);
    if (!parsed.success) {
        return JsonResponse.error(`Validation error: ${parsed.error.message}`, 400);
    }

    const { userId, name, scopes, rateLimitPerMinute, expiresAt } = parsed.data;
    const pool = createPool(hyperdrive.connectionString);

    try {
        // Verify user exists
        const userCheck = await pool.query<{ id: string }>(
            `SELECT id FROM users WHERE id = $1`,
            [userId],
        );
        if (userCheck.rows.length === 0) {
            return JsonResponse.error('User not found', 404);
        }

        // Generate key
        const generated = await generateApiKey();

        const result = await pool.query<{ id: string }>(
            `INSERT INTO api_keys (user_id, name, key_hash, key_prefix, scopes, rate_limit_per_minute, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [
                userId,
                name,
                generated.keyHash,
                generated.keyPrefix,
                scopes,
                rateLimitPerMinute,
                expiresAt?.toISOString() ?? null,
            ],
        );

        return JsonResponse.success({
            id: result.rows[0].id,
            apiKey: generated.rawKey,
            keyPrefix: generated.keyPrefix,
            name,
            scopes,
            message: 'Store this API key securely. It will not be shown again.',
        }, { status: 201 });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return JsonResponse.error(`Failed to create API key: ${message}`, 500);
    }
}

/**
 * Revokes an API key.
 *
 * Request body: { apiKeyId: string } or { keyPrefix: string }
 */
export async function handleRevokeApiKey(
    request: Request,
    hyperdrive: HyperdriveBinding,
    createPool: PgPoolFactory,
): Promise<Response> {
    let body: { apiKeyId?: string; keyPrefix?: string };
    try {
        body = await request.json() as { apiKeyId?: string; keyPrefix?: string };
    } catch {
        return JsonResponse.error('Invalid JSON body', 400);
    }

    if (!body.apiKeyId && !body.keyPrefix) {
        return JsonResponse.error('Provide either apiKeyId or keyPrefix', 400);
    }

    const pool = createPool(hyperdrive.connectionString);

    try {
        let result: { rowCount: number | null };

        if (body.apiKeyId) {
            result = await pool.query(
                `UPDATE api_keys SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL`,
                [body.apiKeyId],
            );
        } else {
            result = await pool.query(
                `UPDATE api_keys SET revoked_at = NOW() WHERE key_prefix = $1 AND revoked_at IS NULL`,
                [body.keyPrefix],
            );
        }

        if ((result.rowCount ?? 0) === 0) {
            return JsonResponse.error('API key not found or already revoked', 404);
        }

        return JsonResponse.success({ revoked: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return JsonResponse.error(`Failed to revoke API key: ${message}`, 500);
    }
}

/**
 * Lists API keys for a user (without the actual key hashes).
 *
 * Query param: ?userId=<uuid>
 */
export async function handleListApiKeys(
    request: Request,
    hyperdrive: HyperdriveBinding,
    createPool: PgPoolFactory,
): Promise<Response> {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
        return JsonResponse.error('Missing required query parameter: userId', 400);
    }

    const pool = createPool(hyperdrive.connectionString);

    try {
        const result = await pool.query<{
            id: string;
            name: string;
            key_prefix: string;
            scopes: string[];
            rate_limit_per_minute: number;
            created_at: string;
            expires_at: string | null;
            revoked_at: string | null;
            last_used_at: string | null;
        }>(
            `SELECT id, name, key_prefix, scopes, rate_limit_per_minute,
                    created_at, expires_at, revoked_at, last_used_at
             FROM api_keys
             WHERE user_id = $1
             ORDER BY created_at DESC`,
            [userId],
        );

        const keys = result.rows.map((row) => ({
            id: row.id,
            name: row.name,
            keyPrefix: row.key_prefix,
            scopes: row.scopes,
            rateLimitPerMinute: row.rate_limit_per_minute,
            createdAt: row.created_at,
            expiresAt: row.expires_at,
            revokedAt: row.revoked_at,
            lastUsedAt: row.last_used_at,
            status: row.revoked_at ? 'revoked'
                : (row.expires_at && new Date(row.expires_at) < new Date()) ? 'expired'
                : 'active',
        }));

        return JsonResponse.success({ keys, count: keys.length });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return JsonResponse.error(`Failed to list API keys: ${message}`, 500);
    }
}

/**
 * Validates an API key without authenticating a full request.
 * Useful for the admin UI to test keys.
 *
 * Request body: { apiKey: string }
 */
export async function handleValidateApiKey(
    request: Request,
    hyperdrive: HyperdriveBinding,
    createPool: PgPoolFactory,
): Promise<Response> {
    let body: { apiKey?: string };
    try {
        body = await request.json() as { apiKey?: string };
    } catch {
        return JsonResponse.error('Invalid JSON body', 400);
    }

    if (!body.apiKey) {
        return JsonResponse.error('Missing required field: apiKey', 400);
    }

    const keyHash = await hashKey(body.apiKey);
    const pool = createPool(hyperdrive.connectionString);

    try {
        const result = await pool.query<{
            id: string;
            name: string;
            key_prefix: string;
            scopes: string[];
            expires_at: string | null;
            revoked_at: string | null;
            user_email: string;
        }>(
            `SELECT k.id, k.name, k.key_prefix, k.scopes, k.expires_at, k.revoked_at, u.email as user_email
             FROM api_keys k
             JOIN users u ON u.id = k.user_id
             WHERE k.key_hash = $1`,
            [keyHash],
        );

        if (result.rows.length === 0) {
            return JsonResponse.success({ valid: false, error: 'Key not found' });
        }

        const key = result.rows[0];
        const isRevoked = !!key.revoked_at;
        const isExpired = key.expires_at ? new Date(key.expires_at) < new Date() : false;

        return JsonResponse.success({
            valid: !isRevoked && !isExpired,
            keyPrefix: key.key_prefix,
            name: key.name,
            scopes: key.scopes,
            userEmail: key.user_email,
            status: isRevoked ? 'revoked' : isExpired ? 'expired' : 'active',
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return JsonResponse.error(`Failed to validate API key: ${message}`, 500);
    }
}
