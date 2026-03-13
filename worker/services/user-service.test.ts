/**
 * Tests for User Service — raw pg Pool CRUD operations.
 *
 * Covers:
 *   - upsertUserFromClerk (insert new, update existing by clerk_user_id)
 *   - deleteUserByClerkId (hard delete, returns boolean)
 *   - findUserByClerkId (lookup by clerk ID)
 *   - updateUserTier
 *
 * Uses in-memory PgPool mock.
 */

import { assertEquals } from '@std/assert';
import { deleteUserByClerkId, findUserByClerkId, updateUserTier, upsertUserFromClerk } from './user-service.ts';
import type { ClerkUserData, UserRow } from './user-service.ts';

// ============================================================================
// Types
// ============================================================================

interface PgPool {
    query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
}

// ============================================================================
// In-memory PgPool mock
// ============================================================================

function createMockPool(): PgPool {
    const users: UserRow[] = [];

    return {
        async query<T>(text: string, values?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }> {
            // INSERT INTO users ... ON CONFLICT (clerk_user_id) DO UPDATE ... RETURNING *
            if (/INSERT INTO users/.test(text) && /ON CONFLICT \(clerk_user_id\)/.test(text)) {
                const email = values?.[0] as string;
                const displayName = values?.[1] as string | null;
                const role = values?.[2] as string;
                const clerkUserId = values?.[3] as string;
                const tier = values?.[4] as string;
                const firstName = values?.[5] as string | null;
                const lastName = values?.[6] as string | null;
                const imageUrl = values?.[7] as string | null;
                const emailVerified = values?.[8] as boolean;
                const lastSignIn = values?.[9] as string | null;
                const now = new Date().toISOString();

                const existingIdx = users.findIndex((u) => u.clerk_user_id === clerkUserId);
                if (existingIdx >= 0) {
                    // Update existing
                    users[existingIdx] = {
                        ...users[existingIdx],
                        email,
                        display_name: displayName,
                        role,
                        tier,
                        first_name: firstName,
                        last_name: lastName,
                        image_url: imageUrl,
                        email_verified: emailVerified,
                        last_sign_in_at: lastSignIn,
                        updated_at: now,
                    };
                    return { rows: [users[existingIdx]] as T[], rowCount: 1 };
                }

                // Insert new
                const row: UserRow = {
                    id: crypto.randomUUID(),
                    email,
                    display_name: displayName,
                    role,
                    clerk_user_id: clerkUserId,
                    tier,
                    first_name: firstName,
                    last_name: lastName,
                    image_url: imageUrl,
                    email_verified: emailVerified,
                    last_sign_in_at: lastSignIn,
                    created_at: now,
                    updated_at: now,
                };
                users.push(row);
                return { rows: [row] as T[], rowCount: 1 };
            }

            // DELETE FROM users WHERE clerk_user_id = $1
            if (/DELETE FROM users WHERE clerk_user_id/.test(text)) {
                const clerkUserId = values?.[0] as string;
                const idx = users.findIndex((u) => u.clerk_user_id === clerkUserId);
                if (idx >= 0) {
                    users.splice(idx, 1);
                    return { rows: [] as T[], rowCount: 1 };
                }
                return { rows: [] as T[], rowCount: 0 };
            }

            // SELECT * FROM users WHERE clerk_user_id = $1 LIMIT 1
            if (/SELECT \* FROM users WHERE clerk_user_id/.test(text)) {
                const clerkUserId = values?.[0] as string;
                const found = users.find((u) => u.clerk_user_id === clerkUserId);
                return { rows: found ? [found] as T[] : [] as T[], rowCount: found ? 1 : 0 };
            }

            // UPDATE users SET tier = $1, updated_at = NOW() WHERE clerk_user_id = $2 RETURNING *
            if (/UPDATE users SET tier/.test(text)) {
                const tier = values?.[0] as string;
                const clerkUserId = values?.[1] as string;
                const idx = users.findIndex((u) => u.clerk_user_id === clerkUserId);
                if (idx >= 0) {
                    users[idx].tier = tier;
                    users[idx].updated_at = new Date().toISOString();
                    return { rows: [users[idx]] as T[], rowCount: 1 };
                }
                return { rows: [] as T[], rowCount: 0 };
            }

            return { rows: [] as T[], rowCount: 0 };
        },
    };
}

// ============================================================================
// upsertUserFromClerk
// ============================================================================

Deno.test('upsertUserFromClerk - inserts new user', async () => {
    const pool = createMockPool();
    const data: ClerkUserData = {
        clerkUserId: 'clerk_user_001',
        email: 'alice@example.com',
        firstName: 'Alice',
        lastName: 'Smith',
        emailVerified: true,
    };

    const user = await upsertUserFromClerk(pool, data);
    assertEquals(user !== null, true);
    assertEquals(user!.email, 'alice@example.com');
    assertEquals(user!.clerk_user_id, 'clerk_user_001');
    assertEquals(user!.first_name, 'Alice');
    assertEquals(user!.last_name, 'Smith');
    assertEquals(user!.tier, 'free'); // default
    assertEquals(user!.role, 'user'); // default
    assertEquals(user!.email_verified, true);
});

Deno.test('upsertUserFromClerk - updates existing user by clerk_user_id', async () => {
    const pool = createMockPool();
    const data1: ClerkUserData = {
        clerkUserId: 'clerk_user_002',
        email: 'bob@example.com',
        firstName: 'Bob',
    };
    await upsertUserFromClerk(pool, data1);

    // Update with new email
    const data2: ClerkUserData = {
        clerkUserId: 'clerk_user_002',
        email: 'bob.new@example.com',
        firstName: 'Robert',
    };
    const updated = await upsertUserFromClerk(pool, data2);
    assertEquals(updated!.email, 'bob.new@example.com');
    assertEquals(updated!.first_name, 'Robert');
});

Deno.test('upsertUserFromClerk - applies tier and role from metadata', async () => {
    const pool = createMockPool();
    const data: ClerkUserData = {
        clerkUserId: 'clerk_user_003',
        email: 'pro@example.com',
        tier: 'pro',
        role: 'admin',
    };

    const user = await upsertUserFromClerk(pool, data);
    assertEquals(user!.tier, 'pro');
    assertEquals(user!.role, 'admin');
});

Deno.test('upsertUserFromClerk - constructs display_name from first + last', async () => {
    const pool = createMockPool();
    const data: ClerkUserData = {
        clerkUserId: 'clerk_user_004',
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
    };

    const user = await upsertUserFromClerk(pool, data);
    assertEquals(user!.display_name, 'Jane Doe');
});

Deno.test('upsertUserFromClerk - display_name is null when no name parts', async () => {
    const pool = createMockPool();
    const data: ClerkUserData = {
        clerkUserId: 'clerk_user_005',
        email: 'noname@example.com',
    };

    const user = await upsertUserFromClerk(pool, data);
    assertEquals(user!.display_name, null);
});

// ============================================================================
// deleteUserByClerkId
// ============================================================================

Deno.test('deleteUserByClerkId - deletes existing user', async () => {
    const pool = createMockPool();
    await upsertUserFromClerk(pool, { clerkUserId: 'clerk_del_001', email: 'del@example.com' });

    const result = await deleteUserByClerkId(pool, 'clerk_del_001');
    assertEquals(result, true);
});

Deno.test('deleteUserByClerkId - returns false for non-existent user', async () => {
    const pool = createMockPool();
    const result = await deleteUserByClerkId(pool, 'clerk_nonexistent');
    assertEquals(result, false);
});

// ============================================================================
// findUserByClerkId
// ============================================================================

Deno.test('findUserByClerkId - finds existing user', async () => {
    const pool = createMockPool();
    await upsertUserFromClerk(pool, { clerkUserId: 'clerk_find_001', email: 'find@example.com' });

    const user = await findUserByClerkId(pool, 'clerk_find_001');
    assertEquals(user !== null, true);
    assertEquals(user!.email, 'find@example.com');
});

Deno.test('findUserByClerkId - returns null for non-existent user', async () => {
    const pool = createMockPool();
    const user = await findUserByClerkId(pool, 'clerk_nonexistent');
    assertEquals(user, null);
});

// ============================================================================
// updateUserTier
// ============================================================================

Deno.test('updateUserTier - updates tier for existing user', async () => {
    const pool = createMockPool();
    await upsertUserFromClerk(pool, { clerkUserId: 'clerk_tier_001', email: 'tier@example.com' });

    const updated = await updateUserTier(pool, 'clerk_tier_001', 'enterprise');
    assertEquals(updated !== null, true);
    assertEquals(updated!.tier, 'enterprise');
});

Deno.test('updateUserTier - returns null for non-existent user', async () => {
    const pool = createMockPool();
    const result = await updateUserTier(pool, 'clerk_nonexistent', 'pro');
    assertEquals(result, null);
});
