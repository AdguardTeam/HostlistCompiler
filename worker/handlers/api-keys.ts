/**
 * API Key Management Handlers
 *
 * CRUD operations for user API keys:
 *   - POST   /api/keys       — Create a new API key
 *   - GET    /api/keys       — List the authenticated user's keys
 *   - DELETE /api/keys/:id   — Revoke a key
 *   - PATCH  /api/keys/:id   — Update key name or scopes
 *
 * All endpoints require Clerk JWT authentication (authMethod !== 'anonymous').
 * Keys are generated with a `abc_` prefix and stored as SHA-256 hashes —
 * the plaintext is returned **only once** on creation.
 *
 * Uses raw pg Pool via Hyperdrive (no Prisma client at runtime).
 */

import { JsonResponse } from '../utils/response.ts';
import type { IAuthContext } from '../types.ts';

// ---------------------------------------------------------------------------
// PgPool interface (matches worker/middleware/auth.ts)
// ---------------------------------------------------------------------------

interface PgPool {
    query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
}

type PgPoolFactory = (connectionString: string) => PgPool;

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

/** Row shape for api_keys table queries. */
interface ApiKeyRow {
    id: string;
    user_id: string;
    key_prefix: string;
    name: string;
    scopes: string[];
    rate_limit_per_minute: number;
    last_used_at: string | null;
    expires_at: string | null;
    revoked_at: string | null;
    created_at: string;
    updated_at: string;
}

// ---------------------------------------------------------------------------
// Key generation helpers
// ---------------------------------------------------------------------------

const API_KEY_PREFIX = 'abc_';
const KEY_BYTE_LENGTH = 32;

/**
 * Generate a cryptographically random API key with `abc_` prefix.
 * The raw bytes are base64url-encoded for URL safety.
 */
function generateApiKey(): string {
    const bytes = new Uint8Array(KEY_BYTE_LENGTH);
    crypto.getRandomValues(bytes);
    // base64url encoding (no padding)
    const base64 = btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    return `${API_KEY_PREFIX}${base64}`;
}

/**
 * Hash an API key using SHA-256 (Web Crypto API).
 */
async function hashKey(key: string): Promise<string> {
    const data = new TextEncoder().encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

// ---------------------------------------------------------------------------
// Request body shapes
// ---------------------------------------------------------------------------

interface CreateKeyBody {
    name: string;
    scopes?: string[];
    expiresInDays?: number;
}

interface UpdateKeyBody {
    name?: string;
    scopes?: string[];
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const VALID_SCOPES = ['compile', 'rules', 'admin'] as const;
const MAX_KEY_NAME_LENGTH = 100;
const MAX_KEYS_PER_USER = 25;

function validateScopes(scopes: unknown): string[] | null {
    if (!Array.isArray(scopes)) return null;
    const valid = scopes.every((s) => typeof s === 'string' && (VALID_SCOPES as readonly string[]).includes(s));
    return valid ? (scopes as string[]) : null;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * POST /api/keys — Create a new API key.
 *
 * The plaintext key is returned in the response body **once**. The caller must
 * store it securely; only the SHA-256 hash is persisted.
 */
export async function handleCreateApiKey(
    request: Request,
    authContext: IAuthContext,
    connectionString: string,
    createPool: PgPoolFactory,
): Promise<Response> {
    let body: CreateKeyBody;
    try {
        body = await request.json() as CreateKeyBody;
    } catch {
        return JsonResponse.badRequest('Invalid JSON body');
    }

    // Validate name
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
        return JsonResponse.badRequest('name is required');
    }
    if (body.name.length > MAX_KEY_NAME_LENGTH) {
        return JsonResponse.badRequest(`name must be at most ${MAX_KEY_NAME_LENGTH} characters`);
    }

    // Validate scopes
    const scopes = body.scopes ? validateScopes(body.scopes) : ['compile'];
    if (scopes === null) {
        return JsonResponse.badRequest(`Invalid scopes — allowed values: ${VALID_SCOPES.join(', ')}`);
    }

    // Validate expiry
    let expiresAt: string | null = null;
    if (body.expiresInDays !== undefined) {
        if (typeof body.expiresInDays !== 'number' || body.expiresInDays < 1 || body.expiresInDays > 365) {
            return JsonResponse.badRequest('expiresInDays must be between 1 and 365');
        }
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + body.expiresInDays);
        expiresAt = expiry.toISOString();
    }

    const pool = createPool(connectionString);

    // Enforce per-user key limit
    const countResult = await pool.query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM api_keys WHERE user_id = $1 AND revoked_at IS NULL',
        [authContext.userId],
    );
    const currentCount = parseInt(countResult.rows[0]?.count ?? '0', 10);
    if (currentCount >= MAX_KEYS_PER_USER) {
        return JsonResponse.badRequest(`Maximum of ${MAX_KEYS_PER_USER} active API keys per user`);
    }

    // Generate key + hash
    const plaintext = generateApiKey();
    const keyHash = await hashKey(plaintext);
    const keyPrefix = plaintext.substring(0, API_KEY_PREFIX.length + 4); // "abc_XXXX"

    const result = await pool.query<ApiKeyRow>(
        `INSERT INTO api_keys (
            id, user_id, key_hash, key_prefix, name, scopes,
            rate_limit_per_minute, expires_at, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5,
            60, $6, NOW(), NOW()
        ) RETURNING id, key_prefix, name, scopes, rate_limit_per_minute,
                    expires_at, created_at`,
        [authContext.userId, keyHash, keyPrefix, body.name.trim(), scopes, expiresAt],
    );

    const row = result.rows[0];
    if (!row) {
        return JsonResponse.serverError('Failed to create API key');
    }

    return JsonResponse.success({
        id: row.id,
        key: plaintext, // Plaintext returned only on creation
        keyPrefix: row.key_prefix,
        name: row.name,
        scopes: row.scopes,
        rateLimitPerMinute: row.rate_limit_per_minute,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
    }, { status: 201 });
}

/**
 * GET /api/keys — List the authenticated user's API keys.
 *
 * Returns metadata only (never the key hash or plaintext).
 */
export async function handleListApiKeys(
    authContext: IAuthContext,
    connectionString: string,
    createPool: PgPoolFactory,
): Promise<Response> {
    const pool = createPool(connectionString);

    const result = await pool.query<ApiKeyRow>(
        `SELECT id, key_prefix, name, scopes, rate_limit_per_minute,
                last_used_at, expires_at, revoked_at, created_at, updated_at
         FROM api_keys
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [authContext.userId],
    );

    const keys = result.rows.map((row) => ({
        id: row.id,
        keyPrefix: row.key_prefix,
        name: row.name,
        scopes: row.scopes,
        rateLimitPerMinute: row.rate_limit_per_minute,
        lastUsedAt: row.last_used_at,
        expiresAt: row.expires_at,
        revokedAt: row.revoked_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        isActive: row.revoked_at === null && (row.expires_at === null || new Date(row.expires_at) > new Date()),
    }));

    return JsonResponse.success({ keys, total: keys.length });
}

/**
 * DELETE /api/keys/:id — Revoke an API key (soft-delete).
 *
 * Sets `revoked_at` to the current timestamp. The key remains in the
 * database for audit purposes but is no longer valid for authentication.
 */
export async function handleRevokeApiKey(
    keyId: string,
    authContext: IAuthContext,
    connectionString: string,
    createPool: PgPoolFactory,
): Promise<Response> {
    const pool = createPool(connectionString);

    const result = await pool.query(
        `UPDATE api_keys
         SET revoked_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
        [keyId, authContext.userId],
    );

    if ((result.rowCount ?? 0) === 0) {
        return JsonResponse.notFound('API key not found or already revoked');
    }

    return JsonResponse.success({ message: 'API key revoked' });
}

/**
 * PATCH /api/keys/:id — Update an API key's name or scopes.
 */
export async function handleUpdateApiKey(
    keyId: string,
    request: Request,
    authContext: IAuthContext,
    connectionString: string,
    createPool: PgPoolFactory,
): Promise<Response> {
    let body: UpdateKeyBody;
    try {
        body = await request.json() as UpdateKeyBody;
    } catch {
        return JsonResponse.badRequest('Invalid JSON body');
    }

    if (!body.name && !body.scopes) {
        return JsonResponse.badRequest('At least one of name or scopes is required');
    }

    // Validate name if provided
    if (body.name !== undefined) {
        if (typeof body.name !== 'string' || body.name.trim().length === 0) {
            return JsonResponse.badRequest('name must be a non-empty string');
        }
        if (body.name.length > MAX_KEY_NAME_LENGTH) {
            return JsonResponse.badRequest(`name must be at most ${MAX_KEY_NAME_LENGTH} characters`);
        }
    }

    // Validate scopes if provided
    let scopes: string[] | undefined;
    if (body.scopes !== undefined) {
        const validated = validateScopes(body.scopes);
        if (validated === null) {
            return JsonResponse.badRequest(`Invalid scopes — allowed values: ${VALID_SCOPES.join(', ')}`);
        }
        scopes = validated;
    }

    const pool = createPool(connectionString);

    // Build dynamic SET clause
    const setClauses: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (body.name !== undefined) {
        setClauses.push(`name = $${paramIndex}`);
        values.push(body.name.trim());
        paramIndex++;
    }

    if (scopes !== undefined) {
        setClauses.push(`scopes = $${paramIndex}`);
        values.push(scopes);
        paramIndex++;
    }

    values.push(keyId, authContext.userId);

    const result = await pool.query<ApiKeyRow>(
        `UPDATE api_keys
         SET ${setClauses.join(', ')}
         WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1} AND revoked_at IS NULL
         RETURNING id, key_prefix, name, scopes, rate_limit_per_minute,
                   last_used_at, expires_at, created_at, updated_at`,
        values,
    );

    if (result.rows.length === 0) {
        return JsonResponse.notFound('API key not found or already revoked');
    }

    const row = result.rows[0];
    return JsonResponse.success({
        id: row.id,
        keyPrefix: row.key_prefix,
        name: row.name,
        scopes: row.scopes,
        rateLimitPerMinute: row.rate_limit_per_minute,
        lastUsedAt: row.last_used_at,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    });
}
