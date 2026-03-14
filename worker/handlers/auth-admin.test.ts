/**
 * Tests for auth admin handlers and the full API key lifecycle.
 *
 * Covers test plan item: API key create → authenticate → revoke lifecycle
 * These tests run without a live database by using an in-memory PgPool mock.
 */

import { assertEquals } from '@std/assert';
import { handleCreateApiKey, handleCreateUser, handleListApiKeys, handleRevokeApiKey, handleValidateApiKey } from './auth-admin.ts';
import { authenticateApiKey } from '../middleware/auth.ts';
import { AuthScope } from '../types.ts';
import type { HyperdriveBinding } from '../types.ts';

// ============================================================================
// Types mirroring the local interfaces in auth-admin.ts / auth.ts
// ============================================================================

interface PgPool {
    query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
}

type PgPoolFactory = (connectionString: string) => PgPool;

// ============================================================================
// Fixtures
// ============================================================================

const MOCK_HYPERDRIVE: HyperdriveBinding = {
    connectionString: 'postgresql://test:test@localhost:5432/testdb',
    host: 'localhost',
    port: 5432,
    user: 'test',
    password: 'test',
    database: 'testdb',
};

// A valid RFC 4122 UUID (used for userId in isolation tests where we don't create the user first)
const VALID_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

// ============================================================================
// In-memory PgPool factory
// Supports all SQL patterns used by auth-admin.ts and auth.ts
// ============================================================================

interface UserRow {
    id: string;
    email: string;
    display_name: string | null;
    role: string;
}

interface ApiKeyRow {
    id: string;
    user_id: string;
    name: string;
    key_hash: string;
    key_prefix: string;
    scopes: string[];
    rate_limit_per_minute: number;
    expires_at: string | null;
    revoked_at: string | null;
    last_used_at: string | null;
    created_at: string;
}

function createInMemoryPool(): PgPoolFactory {
    const users: UserRow[] = [];
    const apiKeys: ApiKeyRow[] = [];

    return (_connectionString: string): PgPool => ({
        async query<T>(text: string, values?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }> {
            // INSERT INTO users ... RETURNING id, email, role
            if (/INSERT INTO users/.test(text) && /RETURNING/.test(text)) {
                const [email, display_name, role] = values as [string, string | null, string];
                const id = crypto.randomUUID();
                users.push({ id, email, display_name, role });
                return { rows: [{ id, email, role }] as T[], rowCount: 1 };
            }

            // SELECT id FROM users WHERE email = $1
            if (/SELECT id FROM users WHERE email/.test(text)) {
                const email = values?.[0] as string;
                const found = users.filter((u) => u.email === email);
                return { rows: found as T[], rowCount: found.length };
            }

            // SELECT id FROM users WHERE id = $1
            if (/SELECT id FROM users WHERE id/.test(text)) {
                const id = values?.[0] as string;
                const found = users.filter((u) => u.id === id);
                return { rows: found as T[], rowCount: found.length };
            }

            // INSERT INTO api_keys ... RETURNING id
            if (/INSERT INTO api_keys/.test(text) && /RETURNING id/.test(text)) {
                const [user_id, name, key_hash, key_prefix, scopes, rate_limit_per_minute, expires_at] = values as [
                    string,
                    string,
                    string,
                    string,
                    string[],
                    number,
                    string | null,
                ];
                const id = crypto.randomUUID();
                apiKeys.push({
                    id,
                    user_id,
                    name,
                    key_hash,
                    key_prefix,
                    scopes: scopes ?? ['compile'],
                    rate_limit_per_minute: rate_limit_per_minute ?? 60,
                    expires_at,
                    revoked_at: null,
                    last_used_at: null,
                    created_at: new Date().toISOString(),
                });
                return { rows: [{ id }] as T[], rowCount: 1 };
            }

            // SELECT k.id, ... FROM api_keys k JOIN users u ... WHERE k.key_hash = $1  (handleValidateApiKey)
            if (/FROM api_keys k/.test(text) && /JOIN users u/.test(text) && /key_hash = \$1/.test(text)) {
                const keyHash = values?.[0] as string;
                const key = apiKeys.find((k) => k.key_hash === keyHash);
                if (!key) return { rows: [], rowCount: 0 };
                const user = users.find((u) => u.id === key.user_id);
                return {
                    rows: [{
                        id: key.id,
                        name: key.name,
                        key_prefix: key.key_prefix,
                        scopes: key.scopes,
                        expires_at: key.expires_at,
                        revoked_at: key.revoked_at,
                        user_email: user?.email ?? '',
                    }] as T[],
                    rowCount: 1,
                };
            }

            // SELECT id, user_id, scopes, ... FROM api_keys WHERE key_hash = $1  (authenticateApiKey)
            if (/FROM api_keys/.test(text) && /key_hash = \$1/.test(text)) {
                const keyHash = values?.[0] as string;
                const key = apiKeys.find((k) => k.key_hash === keyHash);
                if (!key) return { rows: [], rowCount: 0 };
                return { rows: [key] as T[], rowCount: 1 };
            }

            // UPDATE api_keys SET revoked_at ... WHERE id = $1
            if (/UPDATE api_keys SET revoked_at/.test(text) && /WHERE id = \$1/.test(text)) {
                const id = values?.[0] as string;
                const key = apiKeys.find((k) => k.id === id && k.revoked_at === null);
                if (!key) return { rows: [], rowCount: 0 };
                key.revoked_at = new Date().toISOString();
                return { rows: [], rowCount: 1 };
            }

            // UPDATE api_keys SET revoked_at ... WHERE key_prefix = $1
            if (/UPDATE api_keys SET revoked_at/.test(text) && /WHERE key_prefix = \$1/.test(text)) {
                const prefix = values?.[0] as string;
                const key = apiKeys.find((k) => k.key_prefix === prefix && k.revoked_at === null);
                if (!key) return { rows: [], rowCount: 0 };
                key.revoked_at = new Date().toISOString();
                return { rows: [], rowCount: 1 };
            }

            // SELECT id, name, key_prefix, ... FROM api_keys WHERE user_id = $1  (handleListApiKeys)
            if (/FROM api_keys/.test(text) && /WHERE user_id = \$1/.test(text)) {
                const userId = values?.[0] as string;
                const found = apiKeys.filter((k) => k.user_id === userId);
                return { rows: found as T[], rowCount: found.length };
            }

            // UPDATE api_keys SET last_used_at ... (fire-and-forget in authenticateApiKey)
            if (/UPDATE api_keys SET last_used_at/.test(text)) {
                return { rows: [], rowCount: 1 };
            }

            return { rows: [], rowCount: 0 };
        },
    });
}

// ============================================================================
// handleCreateUser
// ============================================================================

Deno.test('handleCreateUser - creates user with valid email', async () => {
    const createPool = createInMemoryPool();
    const req = new Request('https://example.com/admin/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'alice@example.com' }),
    });

    const res = await handleCreateUser(req, MOCK_HYPERDRIVE, createPool);

    assertEquals(res.status, 201);
    const body = await res.json() as Record<string, unknown>;
    assertEquals(body.success, true);
    const user = body.user as { email: string; role: string; id: string };
    assertEquals(user.email, 'alice@example.com');
    assertEquals(user.role, 'user');
    assertEquals(typeof user.id, 'string');
});

Deno.test('handleCreateUser - returns 409 for duplicate email', async () => {
    const createPool = createInMemoryPool();

    const makeReq = () =>
        new Request('https://example.com/admin/auth/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'bob@example.com' }),
        });

    await handleCreateUser(makeReq(), MOCK_HYPERDRIVE, createPool);
    const res = await handleCreateUser(makeReq(), MOCK_HYPERDRIVE, createPool);

    assertEquals(res.status, 409);
});

Deno.test('handleCreateUser - returns 400 for invalid email', async () => {
    const createPool = createInMemoryPool();
    const req = new Request('https://example.com/admin/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-a-valid-email' }),
    });

    const res = await handleCreateUser(req, MOCK_HYPERDRIVE, createPool);
    assertEquals(res.status, 400);
});

Deno.test('handleCreateUser - returns 400 for invalid JSON', async () => {
    const createPool = createInMemoryPool();
    const req = new Request('https://example.com/admin/auth/users', {
        method: 'POST',
        body: 'not json',
    });

    const res = await handleCreateUser(req, MOCK_HYPERDRIVE, createPool);
    assertEquals(res.status, 400);
});

Deno.test('handleCreateUser - accepts admin role', async () => {
    const createPool = createInMemoryPool();
    const req = new Request('https://example.com/admin/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@example.com', role: 'admin' }),
    });

    const res = await handleCreateUser(req, MOCK_HYPERDRIVE, createPool);
    assertEquals(res.status, 201);
    const body = await res.json() as Record<string, unknown>;
    const user = body.user as { role: string };
    assertEquals(user.role, 'admin');
});

// ============================================================================
// handleCreateApiKey
// ============================================================================

Deno.test('handleCreateApiKey - creates API key for existing user', async () => {
    const createPool = createInMemoryPool();

    // First create the user
    const userReq = new Request('https://example.com/admin/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'carol@example.com' }),
    });
    const userRes = await handleCreateUser(userReq, MOCK_HYPERDRIVE, createPool);
    const userBody = await userRes.json() as { user: { id: string } };
    const userId = userBody.user.id;

    // Then create an API key
    const keyReq = new Request('https://example.com/admin/auth/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, name: 'test-key', scopes: ['compile'] }),
    });
    const keyRes = await handleCreateApiKey(keyReq, MOCK_HYPERDRIVE, createPool);

    assertEquals(keyRes.status, 201);
    const keyBody = await keyRes.json() as Record<string, unknown>;
    assertEquals(keyBody.success, true);
    assertEquals(typeof keyBody.apiKey, 'string');
    // Key should start with the 'abc_' prefix
    assertEquals((keyBody.apiKey as string).startsWith('abc_'), true);
    assertEquals(typeof keyBody.id, 'string');
    assertEquals(keyBody.name, 'test-key');
});

Deno.test('handleCreateApiKey - returns 404 for unknown user', async () => {
    const createPool = createInMemoryPool();
    const req = new Request('https://example.com/admin/auth/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: VALID_UUID, name: 'test-key', scopes: ['compile'] }),
    });

    const res = await handleCreateApiKey(req, MOCK_HYPERDRIVE, createPool);
    assertEquals(res.status, 404);
});

Deno.test('handleCreateApiKey - returns 400 for invalid UUID', async () => {
    const createPool = createInMemoryPool();
    const req = new Request('https://example.com/admin/auth/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'not-a-uuid', name: 'test-key', scopes: ['compile'] }),
    });

    const res = await handleCreateApiKey(req, MOCK_HYPERDRIVE, createPool);
    assertEquals(res.status, 400);
});

// ============================================================================
// handleRevokeApiKey
// ============================================================================

Deno.test('handleRevokeApiKey - revokes key by ID', async () => {
    const createPool = createInMemoryPool();

    // Set up user + key
    const userReq = new Request('https://example.com/admin/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'dave@example.com' }),
    });
    const userRes = await handleCreateUser(userReq, MOCK_HYPERDRIVE, createPool);
    const { user: { id: userId } } = await userRes.json() as { user: { id: string } };

    const keyReq = new Request('https://example.com/admin/auth/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, name: 'to-revoke', scopes: ['compile'] }),
    });
    const keyRes = await handleCreateApiKey(keyReq, MOCK_HYPERDRIVE, createPool);
    const { id: keyId } = await keyRes.json() as { id: string };

    // Revoke it
    const revokeReq = new Request('https://example.com/admin/auth/api-keys/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKeyId: keyId }),
    });
    const revokeRes = await handleRevokeApiKey(revokeReq, MOCK_HYPERDRIVE, createPool);

    assertEquals(revokeRes.status, 200);
    const body = await revokeRes.json() as Record<string, unknown>;
    assertEquals(body.revoked, true);
});

Deno.test('handleRevokeApiKey - returns 400 when no identifier provided', async () => {
    const createPool = createInMemoryPool();
    const req = new Request('https://example.com/admin/auth/api-keys/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
    });

    const res = await handleRevokeApiKey(req, MOCK_HYPERDRIVE, createPool);
    assertEquals(res.status, 400);
});

Deno.test('handleRevokeApiKey - returns 404 when key does not exist', async () => {
    const createPool = createInMemoryPool();
    const req = new Request('https://example.com/admin/auth/api-keys/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKeyId: VALID_UUID }),
    });

    const res = await handleRevokeApiKey(req, MOCK_HYPERDRIVE, createPool);
    assertEquals(res.status, 404);
});

// ============================================================================
// handleListApiKeys
// ============================================================================

Deno.test('handleListApiKeys - lists keys for a user', async () => {
    const createPool = createInMemoryPool();

    const userReq = new Request('https://example.com/admin/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'eve@example.com' }),
    });
    const userRes = await handleCreateUser(userReq, MOCK_HYPERDRIVE, createPool);
    const { user: { id: userId } } = await userRes.json() as { user: { id: string } };

    // Create two keys
    for (const name of ['key-a', 'key-b']) {
        const req = new Request('https://example.com/admin/auth/api-keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, name, scopes: ['compile'] }),
        });
        await handleCreateApiKey(req, MOCK_HYPERDRIVE, createPool);
    }

    const listReq = new Request(`https://example.com/admin/auth/api-keys?userId=${userId}`, { method: 'GET' });
    const listRes = await handleListApiKeys(listReq, MOCK_HYPERDRIVE, createPool);

    assertEquals(listRes.status, 200);
    const body = await listRes.json() as { keys: unknown[]; count: number };
    assertEquals(body.count, 2);
});

Deno.test('handleListApiKeys - returns 400 when userId is missing', async () => {
    const createPool = createInMemoryPool();
    const req = new Request('https://example.com/admin/auth/api-keys', { method: 'GET' });

    const res = await handleListApiKeys(req, MOCK_HYPERDRIVE, createPool);
    assertEquals(res.status, 400);
});

// ============================================================================
// Full lifecycle: create → validate → authenticate → revoke → validate again
// Test plan item: API key create → authenticate → revoke lifecycle
// ============================================================================

Deno.test('API key lifecycle - create user, create key, validate, authenticate, revoke, validate fails', async () => {
    const createPool = createInMemoryPool();

    // Step 1: Create a user
    const userReq = new Request('https://example.com/admin/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'lifecycle@example.com', role: 'user' }),
    });
    const userRes = await handleCreateUser(userReq, MOCK_HYPERDRIVE, createPool);
    assertEquals(userRes.status, 201);
    const { user: { id: userId } } = await userRes.json() as { user: { id: string } };

    // Step 2: Create an API key
    const keyReq = new Request('https://example.com/admin/auth/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, name: 'lifecycle-key', scopes: ['compile', 'admin'] }),
    });
    const keyRes = await handleCreateApiKey(keyReq, MOCK_HYPERDRIVE, createPool);
    assertEquals(keyRes.status, 201);
    const { apiKey: rawKey, id: keyId } = await keyRes.json() as { apiKey: string; id: string; keyPrefix: string };

    // Step 3: Validate key — should be valid
    const validateReq1 = new Request('https://example.com/admin/auth/api-keys/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: rawKey }),
    });
    const validateRes1 = await handleValidateApiKey(validateReq1, MOCK_HYPERDRIVE, createPool);
    assertEquals(validateRes1.status, 200);
    const validateBody1 = await validateRes1.json() as Record<string, unknown>;
    assertEquals(validateBody1.valid, true);
    assertEquals(validateBody1.status, 'active');

    // Step 4: Authenticate using the Bearer token — should succeed
    const authReq = new Request('https://example.com/compile', {
        headers: { 'Authorization': `Bearer ${rawKey}` },
    });
    const authResult = await authenticateApiKey(authReq, MOCK_HYPERDRIVE, createPool);
    assertEquals(authResult.authenticated, true);
    assertEquals(authResult.scopes?.includes('compile'), true);
    assertEquals(authResult.scopes?.includes('admin'), true);

    // Step 5: Revoke the key
    const revokeReq = new Request('https://example.com/admin/auth/api-keys/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKeyId: keyId }),
    });
    const revokeRes = await handleRevokeApiKey(revokeReq, MOCK_HYPERDRIVE, createPool);
    assertEquals(revokeRes.status, 200);
    const revokeBody = await revokeRes.json() as Record<string, unknown>;
    assertEquals(revokeBody.revoked, true);

    // Step 6: Validate key again — should now be invalid (revoked)
    const validateReq2 = new Request('https://example.com/admin/auth/api-keys/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: rawKey }),
    });
    const validateRes2 = await handleValidateApiKey(validateReq2, MOCK_HYPERDRIVE, createPool);
    assertEquals(validateRes2.status, 200);
    const validateBody2 = await validateRes2.json() as Record<string, unknown>;
    assertEquals(validateBody2.valid, false);
    assertEquals(validateBody2.status, 'revoked');

    // Step 7: Authenticate with revoked key — should fail
    const authReq2 = new Request('https://example.com/compile', {
        headers: { 'Authorization': `Bearer ${rawKey}` },
    });
    const authResult2 = await authenticateApiKey(authReq2, MOCK_HYPERDRIVE, createPool);
    assertEquals(authResult2.authenticated, false);
});

Deno.test('API key lifecycle - revoke by keyPrefix works end-to-end', async () => {
    const createPool = createInMemoryPool();

    // Create user
    const userReq = new Request('https://example.com/admin/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'prefix-test@example.com' }),
    });
    const userRes = await handleCreateUser(userReq, MOCK_HYPERDRIVE, createPool);
    const { user: { id: userId } } = await userRes.json() as { user: { id: string } };

    // Create key
    const keyReq = new Request('https://example.com/admin/auth/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, name: 'prefix-key', scopes: ['compile'] }),
    });
    const keyRes = await handleCreateApiKey(keyReq, MOCK_HYPERDRIVE, createPool);
    const { apiKey: rawKey, keyPrefix } = await keyRes.json() as { apiKey: string; keyPrefix: string };

    // Revoke by prefix
    const revokeReq = new Request('https://example.com/admin/auth/api-keys/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyPrefix }),
    });
    const revokeRes = await handleRevokeApiKey(revokeReq, MOCK_HYPERDRIVE, createPool);
    assertEquals(revokeRes.status, 200);

    // Authenticate should now fail
    const authReq = new Request('https://example.com/compile', {
        headers: { 'Authorization': `Bearer ${rawKey}` },
    });
    const authResult = await authenticateApiKey(authReq, MOCK_HYPERDRIVE, createPool);
    assertEquals(authResult.authenticated, false);
});

Deno.test('authenticateApiKey - returns error when no Bearer token present', async () => {
    const createPool = createInMemoryPool();
    const req = new Request('https://example.com/compile');

    const result = await authenticateApiKey(req, MOCK_HYPERDRIVE, createPool);
    assertEquals(result.authenticated, false);
    assertEquals(typeof result.error, 'string');
});

Deno.test('authenticateApiKey - returns error for unknown key', async () => {
    const createPool = createInMemoryPool();
    const req = new Request('https://example.com/compile', {
        headers: { 'Authorization': 'Bearer abc_unknownkey123456789012345678901234567890123456789012' },
    });

    const result = await authenticateApiKey(req, MOCK_HYPERDRIVE, createPool);
    assertEquals(result.authenticated, false);
});

Deno.test('authenticateApiKey - returns error when required scope is missing', async () => {
    const createPool = createInMemoryPool();

    // Create user + key with only 'compile' scope
    const userReq = new Request('https://example.com/admin/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'scoped@example.com' }),
    });
    const userRes = await handleCreateUser(userReq, MOCK_HYPERDRIVE, createPool);
    const { user: { id: userId } } = await userRes.json() as { user: { id: string } };

    const keyReq = new Request('https://example.com/admin/auth/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, name: 'compile-only', scopes: ['compile'] }),
    });
    const keyRes = await handleCreateApiKey(keyReq, MOCK_HYPERDRIVE, createPool);
    const { apiKey: rawKey } = await keyRes.json() as { apiKey: string };

    // Try to authenticate with admin scope requirement
    const authReq = new Request('https://example.com/admin', {
        headers: { 'Authorization': `Bearer ${rawKey}` },
    });
    const result = await authenticateApiKey(authReq, MOCK_HYPERDRIVE, createPool, AuthScope.Admin);
    assertEquals(result.authenticated, false);
});

// ============================================================================
// handleValidateApiKey edge cases
// ============================================================================

Deno.test('handleValidateApiKey - returns valid=false for unknown key', async () => {
    const createPool = createInMemoryPool();
    const req = new Request('https://example.com/admin/auth/api-keys/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: 'abc_nosuchkey00000000000000000000000000000000000000000' }),
    });

    const res = await handleValidateApiKey(req, MOCK_HYPERDRIVE, createPool);
    assertEquals(res.status, 200);
    const body = await res.json() as { valid: boolean };
    assertEquals(body.valid, false);
});

Deno.test('handleValidateApiKey - returns 400 when apiKey field is missing', async () => {
    const createPool = createInMemoryPool();
    const req = new Request('https://example.com/admin/auth/api-keys/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
    });

    const res = await handleValidateApiKey(req, MOCK_HYPERDRIVE, createPool);
    assertEquals(res.status, 400);
});
