/**
 * User Service — raw pg Pool CRUD operations for Clerk-managed users.
 *
 * Uses the same PgPool interface as worker/middleware/auth.ts.
 * No Prisma client at runtime — Prisma is for schema/migrations only.
 */

// ---------------------------------------------------------------------------
// PgPool interface (matches worker/middleware/auth.ts)
// ---------------------------------------------------------------------------

interface PgPool {
    query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Clerk user data extracted from webhook events. */
export interface ClerkUserData {
    readonly clerkUserId: string;
    readonly email: string;
    readonly firstName?: string | null;
    readonly lastName?: string | null;
    readonly imageUrl?: string | null;
    readonly emailVerified?: boolean;
    /** Tier from Clerk public metadata (`public_metadata.tier`). */
    readonly tier?: string;
    /** Role from Clerk public metadata (`public_metadata.role`). */
    readonly role?: string;
    readonly lastSignInAt?: string | null;
}

/** Row shape returned by user queries. */
export interface UserRow {
    id: string;
    email: string;
    display_name: string | null;
    role: string;
    clerk_user_id: string | null;
    tier: string;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
    email_verified: boolean;
    last_sign_in_at: string | null;
    created_at: string;
    updated_at: string;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Upsert a user record from Clerk webhook event data.
 *
 * On conflict by `clerk_user_id` the existing row is updated.
 * On conflict by `email` with no `clerk_user_id` the Clerk ID is linked.
 */
export async function upsertUserFromClerk(pool: PgPool, data: ClerkUserData): Promise<UserRow | null> {
    const displayName = [data.firstName, data.lastName].filter(Boolean).join(' ') || null;
    const tier = data.tier ?? 'free';
    const role = data.role ?? 'user';
    const lastSignIn = data.lastSignInAt ? new Date(data.lastSignInAt).toISOString() : null;

    const result = await pool.query<UserRow>(
        `INSERT INTO users (
            id, email, display_name, role, clerk_user_id, tier,
            first_name, last_name, image_url, email_verified, last_sign_in_at,
            created_at, updated_at
        ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10,
            NOW(), NOW()
        )
        ON CONFLICT (clerk_user_id) DO UPDATE SET
            email          = EXCLUDED.email,
            display_name   = EXCLUDED.display_name,
            role           = EXCLUDED.role,
            tier           = EXCLUDED.tier,
            first_name     = EXCLUDED.first_name,
            last_name      = EXCLUDED.last_name,
            image_url      = EXCLUDED.image_url,
            email_verified = EXCLUDED.email_verified,
            last_sign_in_at = EXCLUDED.last_sign_in_at,
            updated_at     = NOW()
        RETURNING *`,
        [
            data.email,
            displayName,
            role,
            data.clerkUserId,
            tier,
            data.firstName ?? null,
            data.lastName ?? null,
            data.imageUrl ?? null,
            data.emailVerified ?? false,
            lastSignIn,
        ],
    );

    return result.rows[0] ?? null;
}

/**
 * Hard-delete a user by their Clerk user ID.
 *
 * Returns `true` if a row was deleted.
 */
export async function deleteUserByClerkId(pool: PgPool, clerkUserId: string): Promise<boolean> {
    const result = await pool.query('DELETE FROM users WHERE clerk_user_id = $1', [clerkUserId]);
    return (result.rowCount ?? 0) > 0;
}

/**
 * Look up a user by their Clerk user ID.
 */
export async function findUserByClerkId(pool: PgPool, clerkUserId: string): Promise<UserRow | null> {
    const result = await pool.query<UserRow>('SELECT * FROM users WHERE clerk_user_id = $1 LIMIT 1', [clerkUserId]);
    return result.rows[0] ?? null;
}

/**
 * Update a user's tier (e.g. when changed via Clerk metadata).
 */
export async function updateUserTier(pool: PgPool, clerkUserId: string, tier: string): Promise<UserRow | null> {
    const result = await pool.query<UserRow>(
        `UPDATE users SET tier = $1, updated_at = NOW() WHERE clerk_user_id = $2 RETURNING *`,
        [tier, clerkUserId],
    );
    return result.rows[0] ?? null;
}
