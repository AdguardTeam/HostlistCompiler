/**
 * Tests for API Key Management Handlers.
 *
 * Covers:
 *   - POST   /api/keys       (handleCreateApiKey)
 *   - GET    /api/keys       (handleListApiKeys)
 *   - DELETE /api/keys/:id   (handleRevokeApiKey)
 *   - PATCH  /api/keys/:id   (handleUpdateApiKey)
 *
 * Uses in-memory PgPool mock (same pattern as auth-admin.test.ts).
 */

import { assertEquals } from '@std/assert';
import { handleCreateApiKey, handleListApiKeys, handleRevokeApiKey, handleUpdateApiKey } from './api-keys.ts';
import { UserTier } from '../types.ts';
import type { IAuthContext } from '../types.ts';

// ============================================================================
// Types mirroring local interfaces in api-keys.ts
// ============================================================================

interface PgPool {
    query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
}

type PgPoolFactory = (connectionString: string) => PgPool;

// ============================================================================
// Fixtures
// ============================================================================

const CONNECTION_STRING = 'postgresql://test:test@localhost:5432/testdb';

function makeAuthContext(overrides: Partial<IAuthContext> = {}): IAuthContext {
    return {
        userId: 'user-uuid-001',
        clerkUserId: 'clerk_abc123',
        tier: UserTier.Pro,
        role: 'user',
        apiKeyId: null,
        sessionId: 'sess_001',
        scopes: ['compile', 'rules'],
        authMethod: 'clerk-jwt',
        ...overrides,
    };
}

// ============================================================================
// In-memory PgPool factory for api-keys handlers
// ============================================================================

interface ApiKeyRow {
    id: string;
    user_id: string;
    key_prefix: string;
    key_hash: string;
    name: string;
    scopes: string[];
    rate_limit_per_minute: number;
    last_used_at: string | null;
    expires_at: string | null;
    revoked_at: string | null;
    created_at: string;
    updated_at: string;
}

function createInMemoryPool(): PgPoolFactory {
    const apiKeys: ApiKeyRow[] = [];

    return (_connectionString: string): PgPool => ({
        async query<T>(text: string, values?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }> {
            // SELECT COUNT(*)::text AS count FROM api_keys WHERE user_id = $1 AND revoked_at IS NULL
            if (/SELECT COUNT\(\*\)::text AS count FROM api_keys/.test(text)) {
                const userId = values?.[0] as string;
                const count = apiKeys.filter((k) => k.user_id === userId && k.revoked_at === null).length;
                return { rows: [{ count: String(count) }] as T[], rowCount: 1 };
            }

            // INSERT INTO api_keys ... RETURNING id, key_prefix, name, scopes, ...
            if (/INSERT INTO api_keys/.test(text) && /RETURNING/.test(text)) {
                const [userId, keyHash, keyPrefix, name, scopes, expiresAt] = values as [
                    string,
                    string,
                    string,
                    string,
                    string[],
                    string | null,
                ];
                const id = crypto.randomUUID();
                const now = new Date().toISOString();
                const row: ApiKeyRow = {
                    id,
                    user_id: userId,
                    key_hash: keyHash,
                    key_prefix: keyPrefix,
                    name,
                    scopes: scopes ?? ['compile'],
                    rate_limit_per_minute: 60,
                    last_used_at: null,
                    expires_at: expiresAt,
                    revoked_at: null,
                    created_at: now,
                    updated_at: now,
                };
                apiKeys.push(row);
                return {
                    rows: [{
                        id: row.id,
                        key_prefix: row.key_prefix,
                        name: row.name,
                        scopes: row.scopes,
                        rate_limit_per_minute: row.rate_limit_per_minute,
                        expires_at: row.expires_at,
                        created_at: row.created_at,
                    }] as T[],
                    rowCount: 1,
                };
            }

            // SELECT ... FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC
            if (/FROM api_keys/.test(text) && /WHERE user_id = \$1/.test(text) && /ORDER BY/.test(text)) {
                const userId = values?.[0] as string;
                const rows = apiKeys
                    .filter((k) => k.user_id === userId)
                    .sort((a, b) => b.created_at.localeCompare(a.created_at))
                    .map((k) => ({
                        id: k.id,
                        key_prefix: k.key_prefix,
                        name: k.name,
                        scopes: k.scopes,
                        rate_limit_per_minute: k.rate_limit_per_minute,
                        last_used_at: k.last_used_at,
                        expires_at: k.expires_at,
                        revoked_at: k.revoked_at,
                        created_at: k.created_at,
                        updated_at: k.updated_at,
                    }));
                return { rows: rows as T[], rowCount: rows.length };
            }

            // UPDATE api_keys SET revoked_at ... WHERE id = $1 AND user_id = $2
            if (/UPDATE api_keys/.test(text) && /SET revoked_at/.test(text) && /WHERE id = \$1/.test(text)) {
                const keyId = values?.[0] as string;
                const userId = values?.[1] as string;
                const key = apiKeys.find((k) => k.id === keyId && k.user_id === userId && k.revoked_at === null);
                if (!key) return { rows: [], rowCount: 0 };
                key.revoked_at = new Date().toISOString();
                key.updated_at = new Date().toISOString();
                return { rows: [], rowCount: 1 };
            }

            // UPDATE api_keys SET ... WHERE id = $N AND user_id = $N+1 AND revoked_at IS NULL RETURNING ...
            if (/UPDATE api_keys/.test(text) && /RETURNING/.test(text) && /revoked_at IS NULL/.test(text)) {
                // Dynamic SET: last two values are (keyId, userId)
                const keyId = values?.[values.length - 2] as string;
                const userId = values?.[values.length - 1] as string;
                const key = apiKeys.find((k) => k.id === keyId && k.user_id === userId && k.revoked_at === null);
                if (!key) return { rows: [], rowCount: 0 };

                // Apply SET fields from the SQL text
                if (/name = \$/.test(text) && values && values.length >= 3) {
                    key.name = values[0] as string;
                }
                if (/scopes = \$/.test(text)) {
                    // scopes is the first or second positional value depending on whether name is also being set
                    const scopesIdx = /name = \$/.test(text) ? 1 : 0;
                    key.scopes = values?.[scopesIdx] as string[];
                }
                key.updated_at = new Date().toISOString();

                return {
                    rows: [{
                        id: key.id,
                        key_prefix: key.key_prefix,
                        name: key.name,
                        scopes: key.scopes,
                        rate_limit_per_minute: key.rate_limit_per_minute,
                        last_used_at: key.last_used_at,
                        expires_at: key.expires_at,
                        created_at: key.created_at,
                        updated_at: key.updated_at,
                    }] as T[],
                    rowCount: 1,
                };
            }

            return { rows: [], rowCount: 0 };
        },
    });
}

// ============================================================================
// handleCreateApiKey
// ============================================================================

Deno.test('handleCreateApiKey - creates key with valid name', async () => {
    const createPool = createInMemoryPool();
    const req = new Request('https://example.com/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'My API Key' }),
    });

    const res = await handleCreateApiKey(req, makeAuthContext(), CONNECTION_STRING, createPool);
    assertEquals(res.status, 201);

    const body = await res.json() as Record<string, unknown>;
    assertEquals(body.success, true);
    assertEquals(body.name, 'My API Key');
    assertEquals(typeof body.key, 'string');
    assertEquals((body.key as string).startsWith('abc_'), true);
    assertEquals(body.scopes, ['compile']); // default scopes
});

Deno.test('handleCreateApiKey - creates key with custom scopes', async () => {
    const createPool = createInMemoryPool();
    const req = new Request('https://example.com/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Admin Key', scopes: ['compile', 'rules', 'admin'] }),
    });

    const res = await handleCreateApiKey(req, makeAuthContext(), CONNECTION_STRING, createPool);
    assertEquals(res.status, 201);

    const body = await res.json() as Record<string, unknown>;
    assertEquals(body.scopes, ['compile', 'rules', 'admin']);
});

Deno.test('handleCreateApiKey - creates key with expiry', async () => {
    const createPool = createInMemoryPool();
    const req = new Request('https://example.com/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Temp Key', expiresInDays: 30 }),
    });

    const res = await handleCreateApiKey(req, makeAuthContext(), CONNECTION_STRING, createPool);
    assertEquals(res.status, 201);

    const body = await res.json() as Record<string, unknown>;
    assertEquals(body.expiresAt !== null, true);
});

Deno.test('handleCreateApiKey - rejects empty name', async () => {
    const createPool = createInMemoryPool();
    const req = new Request('https://example.com/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '' }),
    });

    const res = await handleCreateApiKey(req, makeAuthContext(), CONNECTION_STRING, createPool);
    assertEquals(res.status, 400);
});

Deno.test('handleCreateApiKey - rejects name exceeding 100 characters', async () => {
    const createPool = createInMemoryPool();
    const req = new Request('https://example.com/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'x'.repeat(101) }),
    });

    const res = await handleCreateApiKey(req, makeAuthContext(), CONNECTION_STRING, createPool);
    assertEquals(res.status, 400);
});

Deno.test('handleCreateApiKey - rejects invalid scopes', async () => {
    const createPool = createInMemoryPool();
    const req = new Request('https://example.com/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Bad Scopes', scopes: ['compile', 'hacker'] }),
    });

    const res = await handleCreateApiKey(req, makeAuthContext(), CONNECTION_STRING, createPool);
    assertEquals(res.status, 400);
});

Deno.test('handleCreateApiKey - rejects expiresInDays < 1', async () => {
    const createPool = createInMemoryPool();
    const req = new Request('https://example.com/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Bad Expiry', expiresInDays: 0 }),
    });

    const res = await handleCreateApiKey(req, makeAuthContext(), CONNECTION_STRING, createPool);
    assertEquals(res.status, 400);
});

Deno.test('handleCreateApiKey - rejects expiresInDays > 365', async () => {
    const createPool = createInMemoryPool();
    const req = new Request('https://example.com/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Bad Expiry', expiresInDays: 400 }),
    });

    const res = await handleCreateApiKey(req, makeAuthContext(), CONNECTION_STRING, createPool);
    assertEquals(res.status, 400);
});

Deno.test('handleCreateApiKey - rejects invalid JSON', async () => {
    const createPool = createInMemoryPool();
    const req = new Request('https://example.com/api/keys', {
        method: 'POST',
        body: 'not json',
    });

    const res = await handleCreateApiKey(req, makeAuthContext(), CONNECTION_STRING, createPool);
    assertEquals(res.status, 400);
});

Deno.test('handleCreateApiKey - enforces per-user key limit', async () => {
    // Pool that reports 25 existing keys
    const createPool: PgPoolFactory = (_cs: string): PgPool => ({
        async query<T>(text: string, _values?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }> {
            if (/SELECT COUNT/.test(text)) {
                return { rows: [{ count: '25' }] as T[], rowCount: 1 };
            }
            return { rows: [], rowCount: 0 };
        },
    });

    const req = new Request('https://example.com/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Over Limit' }),
    });

    const res = await handleCreateApiKey(req, makeAuthContext(), CONNECTION_STRING, createPool);
    assertEquals(res.status, 400);
    const body = await res.json() as Record<string, unknown>;
    assertEquals((body.error as string).includes('25'), true);
});

Deno.test('handleCreateApiKey - rejects request when auth context has no userId', async () => {
    const createPool = createInMemoryPool();
    const req = new Request('https://example.com/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'No User' }),
    });

    const res = await handleCreateApiKey(req, makeAuthContext({ userId: null }), CONNECTION_STRING, createPool);
    assertEquals(res.status, 403);
});

// ============================================================================
// handleListApiKeys
// ============================================================================

Deno.test('handleListApiKeys - returns empty array for user with no keys', async () => {
    const createPool = createInMemoryPool();
    const res = await handleListApiKeys(makeAuthContext(), CONNECTION_STRING, createPool);

    assertEquals(res.status, 200);
    const body = await res.json() as Record<string, unknown>;
    assertEquals(body.success, true);
    assertEquals((body.keys as unknown[]).length, 0);
    assertEquals(body.total, 0);
});

Deno.test('handleListApiKeys - returns keys created by the user', async () => {
    const createPool = createInMemoryPool();
    const ctx = makeAuthContext();

    // Create two keys
    for (const name of ['Key A', 'Key B']) {
        const req = new Request('https://example.com/api/keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        });
        await handleCreateApiKey(req, ctx, CONNECTION_STRING, createPool);
    }

    const res = await handleListApiKeys(ctx, CONNECTION_STRING, createPool);
    assertEquals(res.status, 200);

    const body = await res.json() as Record<string, unknown>;
    assertEquals(body.total, 2);
});

Deno.test('handleListApiKeys - does not return keys from other users', async () => {
    const createPool = createInMemoryPool();

    // Create a key for user A
    const reqA = new Request('https://example.com/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Key A' }),
    });
    await handleCreateApiKey(reqA, makeAuthContext({ userId: 'user-A' }), CONNECTION_STRING, createPool);

    // List for user B should be empty
    const res = await handleListApiKeys(makeAuthContext({ userId: 'user-B' }), CONNECTION_STRING, createPool);
    assertEquals(res.status, 200);

    const body = await res.json() as Record<string, unknown>;
    assertEquals(body.total, 0);
});

Deno.test('handleListApiKeys - rejects request when auth context has no userId', async () => {
    const createPool = createInMemoryPool();
    const res = await handleListApiKeys(makeAuthContext({ userId: null }), CONNECTION_STRING, createPool);
    assertEquals(res.status, 403);
});

// ============================================================================
// handleRevokeApiKey
// ============================================================================

Deno.test('handleRevokeApiKey - revokes an existing key', async () => {
    const createPool = createInMemoryPool();
    const ctx = makeAuthContext();

    // Create a key first
    const createReq = new Request('https://example.com/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Temp Key' }),
    });
    const createRes = await handleCreateApiKey(createReq, ctx, CONNECTION_STRING, createPool);
    const createBody = await createRes.json() as Record<string, unknown>;
    const keyId = createBody.id as string;

    // Revoke
    const res = await handleRevokeApiKey(keyId, ctx, CONNECTION_STRING, createPool);
    assertEquals(res.status, 200);

    const body = await res.json() as Record<string, unknown>;
    assertEquals(body.message, 'API key revoked');
});

Deno.test('handleRevokeApiKey - returns 404 for non-existent key', async () => {
    const createPool = createInMemoryPool();
    const res = await handleRevokeApiKey('non-existent-id', makeAuthContext(), CONNECTION_STRING, createPool);
    assertEquals(res.status, 404);
});

Deno.test("handleRevokeApiKey - prevents revoking another user's key", async () => {
    const createPool = createInMemoryPool();

    // Create a key for user A
    const createReq = new Request('https://example.com/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'User A Key' }),
    });
    const createRes = await handleCreateApiKey(createReq, makeAuthContext({ userId: 'user-A' }), CONNECTION_STRING, createPool);
    const createBody = await createRes.json() as Record<string, unknown>;
    const keyId = createBody.id as string;

    // User B tries to revoke
    const res = await handleRevokeApiKey(keyId, makeAuthContext({ userId: 'user-B' }), CONNECTION_STRING, createPool);
    assertEquals(res.status, 404);
});

Deno.test('handleRevokeApiKey - rejects request when auth context has no userId', async () => {
    const createPool = createInMemoryPool();
    const res = await handleRevokeApiKey('key-123', makeAuthContext({ userId: null }), CONNECTION_STRING, createPool);
    assertEquals(res.status, 403);
});

// ============================================================================
// handleUpdateApiKey
// ============================================================================

Deno.test('handleUpdateApiKey - updates key name', async () => {
    const createPool = createInMemoryPool();
    const ctx = makeAuthContext();

    // Create
    const createReq = new Request('https://example.com/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Original' }),
    });
    const createRes = await handleCreateApiKey(createReq, ctx, CONNECTION_STRING, createPool);
    const createBody = await createRes.json() as Record<string, unknown>;
    const keyId = createBody.id as string;

    // Update name
    const updateReq = new Request('https://example.com/api/keys/' + keyId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Renamed' }),
    });
    const res = await handleUpdateApiKey(keyId, updateReq, ctx, CONNECTION_STRING, createPool);
    assertEquals(res.status, 200);

    const body = await res.json() as Record<string, unknown>;
    assertEquals(body.name, 'Renamed');
});

Deno.test('handleUpdateApiKey - updates key scopes', async () => {
    const createPool = createInMemoryPool();
    const ctx = makeAuthContext();

    const createReq = new Request('https://example.com/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Scope Test', scopes: ['compile'] }),
    });
    const createRes = await handleCreateApiKey(createReq, ctx, CONNECTION_STRING, createPool);
    const createBody = await createRes.json() as Record<string, unknown>;
    const keyId = createBody.id as string;

    const updateReq = new Request('https://example.com/api/keys/' + keyId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scopes: ['compile', 'rules'] }),
    });
    const res = await handleUpdateApiKey(keyId, updateReq, ctx, CONNECTION_STRING, createPool);
    assertEquals(res.status, 200);
});

Deno.test('handleUpdateApiKey - rejects empty update body', async () => {
    const createPool = createInMemoryPool();
    const req = new Request('https://example.com/api/keys/123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
    });

    const res = await handleUpdateApiKey('123', req, makeAuthContext(), CONNECTION_STRING, createPool);
    assertEquals(res.status, 400);
});

Deno.test('handleUpdateApiKey - rejects invalid scopes in update', async () => {
    const createPool = createInMemoryPool();
    const req = new Request('https://example.com/api/keys/123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scopes: ['invalid'] }),
    });

    const res = await handleUpdateApiKey('123', req, makeAuthContext(), CONNECTION_STRING, createPool);
    assertEquals(res.status, 400);
});

Deno.test('handleUpdateApiKey - rejects name exceeding max length', async () => {
    const createPool = createInMemoryPool();
    const req = new Request('https://example.com/api/keys/123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'x'.repeat(101) }),
    });

    const res = await handleUpdateApiKey('123', req, makeAuthContext(), CONNECTION_STRING, createPool);
    assertEquals(res.status, 400);
});

Deno.test('handleUpdateApiKey - returns 404 for non-existent key', async () => {
    const createPool = createInMemoryPool();
    const req = new Request('https://example.com/api/keys/non-existent', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Name' }),
    });

    const res = await handleUpdateApiKey('non-existent', req, makeAuthContext(), CONNECTION_STRING, createPool);
    assertEquals(res.status, 404);
});

Deno.test('handleUpdateApiKey - rejects invalid JSON', async () => {
    const createPool = createInMemoryPool();
    const req = new Request('https://example.com/api/keys/123', {
        method: 'PATCH',
        body: 'not json',
    });

    const res = await handleUpdateApiKey('123', req, makeAuthContext(), CONNECTION_STRING, createPool);
    assertEquals(res.status, 400);
});

Deno.test('handleUpdateApiKey - rejects request when auth context has no userId', async () => {
    const createPool = createInMemoryPool();
    const req = new Request('https://example.com/api/keys/123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Renamed' }),
    });

    const res = await handleUpdateApiKey('123', req, makeAuthContext({ userId: null }), CONNECTION_STRING, createPool);
    assertEquals(res.status, 403);
});
